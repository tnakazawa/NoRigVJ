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
  /** クロスフェード実行中のみ存在する「遷移先」のレイヤーと、その instruction id */
  crossfading: { layer: Layer; instructionId: string } | null;
  /** シーン選択・パレットUI・プリセット選択が編集する「予約」state。
   * クロスフェード実行ボタンを押すまで表示には反映されない。 */
  pendingSceneIndex: number;
  pendingPalette: Palette;
  rowEl: HTMLElement;
  previewWrap: HTMLElement;
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

function updateDisplaysEmptyVisibility() {
  displaysEmptyEl.style.display = displays.size === 0 ? "block" : "none";
}

function palettesEqual(a: Palette, b: Palette): boolean {
  return a.main === b.main && a.sub === b.sub;
}

function updateCrossfadeButtonState(entry: DisplayEntry) {
  const same =
    entry.pendingSceneIndex === entry.currentLayer.sceneIndex &&
    palettesEqual(entry.pendingPalette, entry.currentLayer.palette);
  entry.crossfadeBtn.disabled = same || entry.crossfading !== null;
}

function resizeEntry(entry: DisplayEntry) {
  const width = entry.previewWrap.clientWidth || 1;
  const height = entry.previewWrap.clientHeight || 1;
  resizeLayer(entry.currentLayer, width, height);
  if (entry.crossfading) {
    resizeLayer(entry.crossfading.layer, width, height);
  }
}

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

function createDisplayRow(label: number) {
  const rowEl = document.createElement("div");
  rowEl.className = "display-row";

  const previewWrap = document.createElement("div");
  previewWrap.className = "display-preview";

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
  rowEl.append(previewWrap, controls);

  return {
    rowEl,
    previewWrap,
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

function startEntryCrossfade(entry: DisplayEntry) {
  if (entry.crossfading) return;

  const instructionId = crypto.randomUUID();
  const toLayer = createLayer(entry.pendingSceneIndex, { ...entry.pendingPalette });
  entry.crossfading = { layer: toLayer, instructionId };
  updateCrossfadeButtonState(entry);

  const width = entry.previewWrap.clientWidth || 1;
  const height = entry.previewWrap.clientHeight || 1;

  startCrossfade(entry.previewWrap, entry.currentLayer, toLayer, width, height, crossfadeDurationMs, (finishedLayer) => {
    entry.currentLayer = finishedLayer;
    entry.crossfading = null;
    updateCrossfadeButtonState(entry);
  });
}

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
    previewWrap,
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

  const initialLayer = createLayer(0, { ...DEFAULT_PALETTE });
  previewWrap.appendChild(initialLayer.wrapEl);
  resizeLayer(initialLayer, previewWrap.clientWidth || 1, previewWrap.clientHeight || 1);

  const entry: DisplayEntry = {
    id,
    window: opened,
    currentLayer: initialLayer,
    crossfading: null,
    pendingSceneIndex: 0,
    pendingPalette: { ...DEFAULT_PALETTE },
    rowEl,
    previewWrap,
    selectEl,
    paletteSelectEl,
    mainColorInput,
    subColorInput,
    presetSelectEl,
    crossfadeBtn,
  };

  selectEl.value = "0";
  paletteSelectEl.value = "0";
  mainColorInput.value = entry.pendingPalette.main;
  subColorInput.value = entry.pendingPalette.sub;
  populatePresetSelect(presetSelectEl);
  updateCrossfadeButtonState(entry);

  selectEl.addEventListener("change", () => {
    entry.pendingSceneIndex = Number(selectEl.value);
    updateCrossfadeButtonState(entry);
  });

  paletteSelectEl.addEventListener("change", () => {
    if (paletteSelectEl.value === "custom") return;
    const preset = PALETTE_PRESETS[Number(paletteSelectEl.value)];
    entry.pendingPalette = { ...preset.palette };
    mainColorInput.value = preset.palette.main;
    subColorInput.value = preset.palette.sub;
    updateCrossfadeButtonState(entry);
  });

  mainColorInput.addEventListener("input", () => {
    entry.pendingPalette = { ...entry.pendingPalette, main: mainColorInput.value };
    paletteSelectEl.value = "custom";
    updateCrossfadeButtonState(entry);
  });

  subColorInput.addEventListener("input", () => {
    entry.pendingPalette = { ...entry.pendingPalette, sub: subColorInput.value };
    paletteSelectEl.value = "custom";
    updateCrossfadeButtonState(entry);
  });

  presetSaveBtn.addEventListener("click", () => {
    const name = prompt("プリセット名を入力してください");
    if (!name) return;
    const sceneName = sceneNames[entry.pendingSceneIndex];
    savePreset(name, sceneName, entry.pendingPalette);
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
    entry.pendingSceneIndex = sceneIdx;
    entry.pendingPalette = { ...preset.palette };
    selectEl.value = String(sceneIdx);
    mainColorInput.value = preset.palette.main;
    subColorInput.value = preset.palette.sub;
    // プリセットのパレットはPALETTE_PRESETSのいずれかと一致するとは限らないため、カスタム扱いにする
    paletteSelectEl.value = "custom";
    updateCrossfadeButtonState(entry);
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

function removeDisplay(id: string) {
  const entry = displays.get(id);
  if (!entry) return;
  if (!entry.window.closed) {
    entry.window.close();
  }
  disposeLayer(entry.currentLayer);
  if (entry.crossfading) {
    disposeLayer(entry.crossfading.layer);
  }
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
    if (entry.crossfading) {
      crossfadeByWindow[id] = {
        id: entry.crossfading.instructionId,
        toSceneName: sceneNames[entry.crossfading.layer.sceneIndex],
        toPalette: entry.crossfading.layer.palette,
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
    const width = entry.previewWrap.clientWidth || 1;
    const height = entry.previewWrap.clientHeight || 1;
    renderLayer(entry.currentLayer, width, height, latestTime, latestAudio);
    if (entry.crossfading) {
      renderLayer(entry.crossfading.layer, width, height, latestTime, latestAudio);
    }
  });

  requestAnimationFrame(renderPreviews);
}

renderPreviews();
