import { AudioAnalyzer, type AudioLevels } from "./audio";
import { startCrossfade } from "./crossfade";
import { createLayer, disposeLayer, renderLayer, resizeLayer, type Layer } from "./layer";
import { DEFAULT_PALETTE, PALETTE_PRESETS } from "./palettes";
import { deletePreset, loadPresets, savePreset } from "./presets";
import { sceneNames, type Palette } from "./scenes";
import { CHANNEL_NAME, type CrossfadeInstruction, type VJState } from "./shared";

const displaysListEl = document.getElementById("displays-list")!;
const displaysEmptyEl = document.getElementById("displays-empty")!;
const intensitySlider = document.getElementById("intensity") as HTMLInputElement;
const intensityValueEl = document.getElementById("intensity-value")!;
const crossfadeDurationSlider = document.getElementById("crossfade-duration") as HTMLInputElement;
const crossfadeDurationValueEl = document.getElementById("crossfade-duration-value")!;
const micToggleBtn = document.getElementById("mic-toggle") as HTMLButtonElement;
const addDisplayBtn = document.getElementById("add-display") as HTMLButtonElement;
const statusEl = document.getElementById("status")!;

let startTime = performance.now();
let manualIntensity = 1; // ← / → キー、またはスライダーで調整
let crossfadeDurationMs = 1000;
let latestAudio: AudioLevels = { volume: 0, bass: 0, mid: 0, treble: 0 };
let latestTime = 0;

const audio = new AudioAnalyzer();
const channel = new BroadcastChannel(CHANNEL_NAME);

interface DisplayEntry {
  id: string;
  window: Window;
  /** 実際にプレビュー・投影窓に描画されている「現在」のレイヤー */
  currentLayer: Layer;
  /** 「予約(次に切り替える内容)」を常時プレビューするレイヤー。シーン選択・パレットUI・
   * プリセット選択はこのレイヤーを編集する。クロスフェード実行時はこれをそのまま
   * 遷移先として使い、実行後は同じ内容の新しいインスタンスを作り直す。 */
  pendingLayer: Layer;
  /** クロスフェード実行中のみ値を持つ(投影窓へ送るinstruction idとしても使う) */
  crossfadingInstructionId: string | null;
  rowEl: HTMLElement;
  currentPreviewWrap: HTMLElement;
  pendingPreviewWrap: HTMLElement;
  selectEl: HTMLSelectElement;
  paletteSelectEl: HTMLSelectElement;
  mainColorInput: HTMLInputElement;
  subColorInput: HTMLInputElement;
  presetSelectEl: HTMLSelectElement;
  crossfadeBtn: HTMLButtonElement;
}

// windowId(BroadcastChannelで各投影窓を識別するキー)をMapのキーにする。
const displays = new Map<string, DisplayEntry>();
let displayCounter = 0;

/** 投影窓が1つもない間だけ「投影窓がありません」の案内を表示する。 */
function updateDisplaysEmptyVisibility() {
  displaysEmptyEl.style.display = displays.size === 0 ? "block" : "none";
}

function palettesEqual(a: Palette, b: Palette): boolean {
  return a.main === b.main && a.sub === b.sub;
}

/** 予約(pendingLayer)が現在の表示と同じ、またはクロスフェード実行中なら「クロスフェード実行」ボタンを無効化する。 */
function updateCrossfadeButtonState(entry: DisplayEntry) {
  const same =
    entry.pendingLayer.sceneIndex === entry.currentLayer.sceneIndex &&
    palettesEqual(entry.pendingLayer.palette, entry.currentLayer.palette);
  entry.crossfadeBtn.disabled = same || entry.crossfadingInstructionId !== null;
}

/** currentLayer・pendingLayerの両方を、それぞれの表示先要素のサイズに合わせてリサイズする。 */
function resizeEntry(entry: DisplayEntry) {
  const currentWidth = entry.currentPreviewWrap.clientWidth || 1;
  const currentHeight = entry.currentPreviewWrap.clientHeight || 1;
  resizeLayer(entry.currentLayer, currentWidth, currentHeight);

  const pendingWidth = entry.pendingPreviewWrap.clientWidth || 1;
  const pendingHeight = entry.pendingPreviewWrap.clientHeight || 1;
  // クロスフェード実行中は pendingLayer が currentPreviewWrap 側にDOM移動している
  // (旧レイヤーに重ねてフェードインさせるため)。その間は currentPreviewWrap のサイズに合わせる。
  if (entry.crossfadingInstructionId) {
    resizeLayer(entry.pendingLayer, currentWidth, currentHeight);
  } else {
    resizeLayer(entry.pendingLayer, pendingWidth, pendingHeight);
  }
}

/**
 * 予約(シーン切替を伴う)を新しいレイヤーとして作り直し、予約プレビュー欄に表示する。
 * @param entry 対象の投影窓
 * @param sceneIndex 予約するシーンのインデックス
 * @param palette 予約するカラーパレット
 */
function rebuildPendingLayer(entry: DisplayEntry, sceneIndex: number, palette: Palette) {
  disposeLayer(entry.pendingLayer);
  entry.pendingLayer = createLayer(sceneIndex, palette);
  entry.pendingPreviewWrap.appendChild(entry.pendingLayer.wrapEl);
  resizeLayer(
    entry.pendingLayer,
    entry.pendingPreviewWrap.clientWidth || 1,
    entry.pendingPreviewWrap.clientHeight || 1,
  );
  updateCrossfadeButtonState(entry);
}

/** プリセットselectの選択肢を、localStorageの最新内容で作り直す。可能なら選択中の値を維持する。 */
function populatePresetSelect(selectEl: HTMLSelectElement) {
  const presets = loadPresets();
  const prevValue = selectEl.value;
  selectEl.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = presets.length === 0 ? "(プリセットなし)" : "プリセットを選択";
  selectEl.appendChild(placeholder);

  presets.forEach((preset) => {
    const opt = document.createElement("option");
    opt.value = preset.id;
    opt.textContent = preset.name;
    selectEl.appendChild(opt);
  });

  if ([...selectEl.options].some((o) => o.value === prevValue)) {
    selectEl.value = prevValue;
  }
}

// プリセットの保存・削除は他の投影窓行にも影響するため、全行のプリセット一覧を同期し直す。
function refreshAllPresetSelects() {
  displays.forEach((entry) => populatePresetSelect(entry.presetSelectEl));
}

/** 投影窓1行分のDOM要素一式(プレビュー2枠・シーン/パレット/プリセットUI・ボタン類)を組み立てる。 */
function createDisplayRow(label: number) {
  const rowEl = document.createElement("div");
  rowEl.className = "display-row";

  const previewGroup = document.createElement("div");
  previewGroup.className = "preview-group";

  const currentSlot = document.createElement("div");
  currentSlot.className = "preview-slot";
  const currentLabel = document.createElement("div");
  currentLabel.className = "preview-slot-label";
  currentLabel.textContent = "現在";
  const currentPreviewWrap = document.createElement("div");
  currentPreviewWrap.className = "display-preview current-preview";
  currentSlot.append(currentLabel, currentPreviewWrap);

  const pendingSlot = document.createElement("div");
  pendingSlot.className = "preview-slot";
  const pendingLabel = document.createElement("div");
  pendingLabel.className = "preview-slot-label";
  pendingLabel.textContent = "次へ";
  const pendingPreviewWrap = document.createElement("div");
  pendingPreviewWrap.className = "display-preview pending-preview";
  pendingSlot.append(pendingLabel, pendingPreviewWrap);

  previewGroup.append(currentSlot, pendingSlot);

  const controls = document.createElement("div");
  controls.className = "display-row-controls";

  const labelEl = document.createElement("div");
  labelEl.className = "display-row-label";
  labelEl.textContent = `投影窓 ${label}`;

  const selectEl = document.createElement("select");
  sceneNames.forEach((name, i) => {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = name;
    selectEl.appendChild(option);
  });

  const paletteRow = document.createElement("div");
  paletteRow.className = "palette-row";

  const paletteSelectEl = document.createElement("select");
  PALETTE_PRESETS.forEach((preset, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = preset.name;
    paletteSelectEl.appendChild(opt);
  });
  const customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "カスタム";
  paletteSelectEl.appendChild(customOption);

  const mainColorInput = document.createElement("input");
  mainColorInput.type = "color";
  mainColorInput.title = "メインカラー";
  const subColorInput = document.createElement("input");
  subColorInput.type = "color";
  subColorInput.title = "サブカラー";

  paletteRow.append(paletteSelectEl, mainColorInput, subColorInput);

  const presetRow = document.createElement("div");
  presetRow.className = "preset-row";
  const presetSaveBtn = document.createElement("button");
  presetSaveBtn.textContent = "プリセット保存";
  const presetSelectEl = document.createElement("select");
  const presetDeleteBtn = document.createElement("button");
  presetDeleteBtn.textContent = "削除";
  presetRow.append(presetSaveBtn, presetSelectEl, presetDeleteBtn);

  const crossfadeBtn = document.createElement("button");
  crossfadeBtn.className = "crossfade-btn";
  crossfadeBtn.textContent = "クロスフェード実行";

  const closeBtn = document.createElement("button");
  closeBtn.className = "close-btn";
  closeBtn.textContent = "閉じる";

  controls.append(labelEl, selectEl, paletteRow, presetRow, crossfadeBtn, closeBtn);
  rowEl.append(previewGroup, controls);

  return {
    rowEl,
    currentPreviewWrap,
    pendingPreviewWrap,
    selectEl,
    paletteSelectEl,
    mainColorInput,
    subColorInput,
    presetSaveBtn,
    presetSelectEl,
    presetDeleteBtn,
    crossfadeBtn,
    closeBtn,
  };
}

/** 指定した投影窓に対し、現在の表示から予約(pendingLayer)へのクロスフェードを開始する。 */
function startEntryCrossfade(entry: DisplayEntry) {
  if (entry.crossfadingInstructionId) return;

  const instructionId = crypto.randomUUID();
  const toLayer = entry.pendingLayer;
  entry.crossfadingInstructionId = instructionId;

  // 予約プレビュー欄が空白にならないよう、今から始めるクロスフェードと同じ内容の
  // 新しい予約レイヤーを先に用意しておく(このクロスフェードが完了したら「予約=現在」になるはずなので、
  // ボタンはこの時点で正しく無効化される)。
  entry.pendingLayer = createLayer(toLayer.sceneIndex, { ...toLayer.palette });
  entry.pendingPreviewWrap.appendChild(entry.pendingLayer.wrapEl);
  resizeLayer(
    entry.pendingLayer,
    entry.pendingPreviewWrap.clientWidth || 1,
    entry.pendingPreviewWrap.clientHeight || 1,
  );
  updateCrossfadeButtonState(entry);

  const width = entry.currentPreviewWrap.clientWidth || 1;
  const height = entry.currentPreviewWrap.clientHeight || 1;

  startCrossfade(
    entry.currentPreviewWrap,
    entry.currentLayer,
    toLayer,
    width,
    height,
    crossfadeDurationMs,
    (finishedLayer) => {
      entry.currentLayer = finishedLayer;
      entry.crossfadingInstructionId = null;
      updateCrossfadeButtonState(entry);
    },
  );
}

/** 「投影窓を追加」ボタンの処理。新規投影窓を開き、対応する行・レイヤー・イベントハンドラを組み立てる。 */
function addDisplay() {
  const id = crypto.randomUUID();
  displayCounter += 1;

  const opened = window.open(`/display.html?windowId=${id}`, id, "width=1280,height=720");
  if (!opened) {
    console.error("投影窓のオープンに失敗しました(ポップアップブロックされている可能性があります)");
    return;
  }

  const {
    rowEl,
    currentPreviewWrap,
    pendingPreviewWrap,
    selectEl,
    paletteSelectEl,
    mainColorInput,
    subColorInput,
    presetSaveBtn,
    presetSelectEl,
    presetDeleteBtn,
    crossfadeBtn,
    closeBtn,
  } = createDisplayRow(displayCounter);
  displaysListEl.appendChild(rowEl);

  const currentLayer = createLayer(0, { ...DEFAULT_PALETTE });
  currentPreviewWrap.appendChild(currentLayer.wrapEl);
  resizeLayer(currentLayer, currentPreviewWrap.clientWidth || 1, currentPreviewWrap.clientHeight || 1);

  const pendingLayer = createLayer(0, { ...DEFAULT_PALETTE });
  pendingPreviewWrap.appendChild(pendingLayer.wrapEl);
  resizeLayer(pendingLayer, pendingPreviewWrap.clientWidth || 1, pendingPreviewWrap.clientHeight || 1);

  const entry: DisplayEntry = {
    id,
    window: opened,
    currentLayer,
    pendingLayer,
    crossfadingInstructionId: null,
    rowEl,
    currentPreviewWrap,
    pendingPreviewWrap,
    selectEl,
    paletteSelectEl,
    mainColorInput,
    subColorInput,
    presetSelectEl,
    crossfadeBtn,
  };

  selectEl.value = "0";
  paletteSelectEl.value = "0";
  mainColorInput.value = entry.pendingLayer.palette.main;
  subColorInput.value = entry.pendingLayer.palette.sub;
  populatePresetSelect(presetSelectEl);
  updateCrossfadeButtonState(entry);

  selectEl.addEventListener("change", () => {
    rebuildPendingLayer(entry, Number(selectEl.value), { ...entry.pendingLayer.palette });
  });

  paletteSelectEl.addEventListener("change", () => {
    if (paletteSelectEl.value === "custom") return;
    const preset = PALETTE_PRESETS[Number(paletteSelectEl.value)];
    entry.pendingLayer.palette = { ...preset.palette };
    mainColorInput.value = preset.palette.main;
    subColorInput.value = preset.palette.sub;
    updateCrossfadeButtonState(entry);
  });

  mainColorInput.addEventListener("input", () => {
    entry.pendingLayer.palette = { ...entry.pendingLayer.palette, main: mainColorInput.value };
    paletteSelectEl.value = "custom";
    updateCrossfadeButtonState(entry);
  });

  subColorInput.addEventListener("input", () => {
    entry.pendingLayer.palette = { ...entry.pendingLayer.palette, sub: subColorInput.value };
    paletteSelectEl.value = "custom";
    updateCrossfadeButtonState(entry);
  });

  presetSaveBtn.addEventListener("click", () => {
    const name = prompt("プリセット名を入力してください");
    if (!name) return;
    const sceneName = sceneNames[entry.pendingLayer.sceneIndex];
    savePreset(name, sceneName, entry.pendingLayer.palette);
    refreshAllPresetSelects();
  });

  presetSelectEl.addEventListener("change", () => {
    const presetId = presetSelectEl.value;
    if (!presetId) return;
    const preset = loadPresets().find((p) => p.id === presetId);
    if (!preset) return;
    const sceneIdx = sceneNames.indexOf(preset.sceneName);
    if (sceneIdx === -1) {
      console.warn(`プリセット "${preset.name}" が参照するシーン "${preset.sceneName}" が見つかりません`);
      return;
    }
    selectEl.value = String(sceneIdx);
    mainColorInput.value = preset.palette.main;
    subColorInput.value = preset.palette.sub;
    // プリセットのパレットはPALETTE_PRESETSのいずれかと一致するとは限らないため、カスタム扱いにする
    paletteSelectEl.value = "custom";
    rebuildPendingLayer(entry, sceneIdx, { ...preset.palette });
  });

  presetDeleteBtn.addEventListener("click", () => {
    const presetId = presetSelectEl.value;
    if (!presetId) return;
    deletePreset(presetId);
    refreshAllPresetSelects();
  });

  crossfadeBtn.addEventListener("click", () => {
    startEntryCrossfade(entry);
  });

  closeBtn.addEventListener("click", () => {
    removeDisplay(id);
  });

  displays.set(id, entry);
  updateDisplaysEmptyVisibility();
}

/** 投影窓を閉じ、対応するレイヤー・行を破棄して一覧から取り除く。 */
function removeDisplay(id: string) {
  const entry = displays.get(id);
  if (!entry) return;
  if (!entry.window.closed) {
    entry.window.close();
  }
  disposeLayer(entry.currentLayer);
  disposeLayer(entry.pendingLayer);
  entry.rowEl.remove();
  displays.delete(id);
  updateDisplaysEmptyVisibility();
}

addDisplayBtn.addEventListener("click", () => {
  addDisplay();
});

window.addEventListener("resize", () => {
  displays.forEach((entry) => resizeEntry(entry));
});

function setIntensity(v: number) {
  manualIntensity = Math.min(3, Math.max(0, v));
  intensitySlider.value = String(manualIntensity);
  intensityValueEl.textContent = manualIntensity.toFixed(1);
}

function setCrossfadeDuration(seconds: number) {
  crossfadeDurationMs = Math.round(seconds * 1000);
  crossfadeDurationValueEl.textContent = seconds.toFixed(1);
}

async function enableMic() {
  if (audio.isEnabled()) return;
  try {
    await audio.start();
    micToggleBtn.textContent = "マイク: ON";
  } catch (err) {
    console.error("マイクの取得に失敗しました", err);
  }
}

setIntensity(manualIntensity);
setCrossfadeDuration(Number(crossfadeDurationSlider.value));

intensitySlider.addEventListener("input", () => {
  setIntensity(Number(intensitySlider.value));
});

crossfadeDurationSlider.addEventListener("input", () => {
  setCrossfadeDuration(Number(crossfadeDurationSlider.value));
});

micToggleBtn.addEventListener("click", () => {
  enableMic();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") {
    setIntensity(manualIntensity + 0.1);
  } else if (e.key === "ArrowLeft") {
    setIntensity(manualIntensity - 0.1);
  } else if (e.key === " ") {
    e.preventDefault();
    enableMic();
  }
});

// 投影窓フルスクリーン化などで操作窓が他ウィンドウに完全に隠れる(occluded)と、
// Chromeは隠れたウィンドウの requestAnimationFrame だけでなく setInterval/setTimeout も
// 最小1秒間隔にクランプする。Worker内のタイマーはこの抑制を受けないため、
// tickを駆動するタイミングだけWorkerに任せる。
const tickWorker = new Worker(new URL("./tick-worker.ts", import.meta.url), { type: "module" });
tickWorker.onmessage = () => tick();

/** Workerから33ms間隔で呼ばれる。音声解析・投影窓の生存確認・BroadcastChannelへの状態送信を行う。 */
function tick() {
  const time = (performance.now() - startTime) / 1000;

  const levels = audio.isEnabled()
    ? audio.getLevels()
    : {
        // マイク未接続時はダミーの揺れで動作確認できるようにする
        volume: (Math.sin(time * 1.3) * 0.5 + 0.5) * 0.4,
        bass: (Math.sin(time * 0.7) * 0.5 + 0.5) * 0.5,
        mid: (Math.sin(time * 1.9) * 0.5 + 0.5) * 0.4,
        treble: (Math.sin(time * 2.6) * 0.5 + 0.5) * 0.3,
      };

  const scaledLevels = {
    volume: levels.volume * manualIntensity,
    bass: levels.bass * manualIntensity,
    mid: levels.mid * manualIntensity,
    treble: levels.treble * manualIntensity,
  };

  latestTime = time;
  latestAudio = scaledLevels;

  // 投影窓の生存確認。ユーザーがウィンドウ自体を閉じた場合も一覧から自動的に除去する。
  for (const [id, entry] of [...displays]) {
    if (entry.window.closed) {
      removeDisplay(id);
    }
  }

  const sceneIndexByWindow: Record<string, number> = {};
  const paletteByWindow: Record<string, Palette> = {};
  const crossfadeByWindow: Record<string, CrossfadeInstruction | undefined> = {};
  displays.forEach((entry, id) => {
    sceneIndexByWindow[id] = entry.currentLayer.sceneIndex;
    paletteByWindow[id] = entry.currentLayer.palette;
    if (entry.crossfadingInstructionId) {
      crossfadeByWindow[id] = {
        id: entry.crossfadingInstructionId,
        toSceneName: sceneNames[entry.pendingLayer.sceneIndex],
        toPalette: entry.pendingLayer.palette,
        durationMs: crossfadeDurationMs,
      };
    }
  });

  const state: VJState = {
    sceneIndexByWindow,
    paletteByWindow,
    crossfadeByWindow,
    intensity: manualIntensity,
    audio: scaledLevels,
    time,
  };
  channel.postMessage(state);

  statusEl.textContent = `投影窓: ${displays.size}枚接続中`;
}

// プレビュー描画は見た目の滑らかさ優先でrAFのまま。操作窓が隠れて一時的に
// 止まっても実害はない(音声解析・投影窓への送信は上記tickが継続する)。
function renderPreviews() {
  displays.forEach((entry) => {
    const currentWidth = entry.currentPreviewWrap.clientWidth || 1;
    const currentHeight = entry.currentPreviewWrap.clientHeight || 1;
    renderLayer(entry.currentLayer, currentWidth, currentHeight, latestTime, latestAudio);

    // クロスフェード中は pendingLayer が currentPreviewWrap 側に重ねて表示されているため
    // そちらのサイズでレンダリングし、そうでなければ予約プレビュー欄自身のサイズを使う。
    if (entry.crossfadingInstructionId) {
      renderLayer(entry.pendingLayer, currentWidth, currentHeight, latestTime, latestAudio);
    } else {
      const pendingWidth = entry.pendingPreviewWrap.clientWidth || 1;
      const pendingHeight = entry.pendingPreviewWrap.clientHeight || 1;
      renderLayer(entry.pendingLayer, pendingWidth, pendingHeight, latestTime, latestAudio);
    }
  });

  requestAnimationFrame(renderPreviews);
}

renderPreviews();
