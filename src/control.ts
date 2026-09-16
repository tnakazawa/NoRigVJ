import { AudioAnalyzer, type AudioLevels } from "./audio";
import { startCrossfade } from "./crossfade";
import { createLayer, disposeLayer, renderLayer, resizeLayer, type Layer } from "./layer";
import { createPaletteDropdown, type PaletteDropdown } from "./palette-dropdown";
import { DEFAULT_PALETTE, PALETTE_PRESETS } from "./palettes";
import { deletePreset, loadPresets, savePreset } from "./presets";
import { sceneNames, sceneSupportsPalette, type Palette } from "./scenes";
import { CHANNEL_NAME, type CrossfadeInstruction, type TriggerInstruction, type VJState } from "./shared";

const displaysListEl = document.getElementById("displays-list")!;
const displaysEmptyEl = document.getElementById("displays-empty")!;
const intensitySlider = document.getElementById("intensity") as HTMLInputElement;
const intensityValueEl = document.getElementById("intensity-value")!;
const crossfadeDurationSlider = document.getElementById("crossfade-duration") as HTMLInputElement;
const crossfadeDurationValueEl = document.getElementById("crossfade-duration-value")!;
const micToggleBtn = document.getElementById("mic-toggle") as HTMLButtonElement;
const addDisplayBtn = document.getElementById("add-display") as HTMLButtonElement;
const randomBtn = document.getElementById("random-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status")!;
const triggerButtons = [
  document.getElementById("trigger-1") as HTMLButtonElement,
  document.getElementById("trigger-2") as HTMLButtonElement,
  document.getElementById("trigger-3") as HTMLButtonElement,
];

/** Trigger 1/2/3のbeatPulse相当の減衰の速さ(この時定数(秒)でe^-1倍になる) */
const TRIGGER_PULSE_DECAY_TAU = 0.2;

let startTime = performance.now();
let manualIntensity = 1; // ← / → キー、またはスライダーで調整
let crossfadeDurationMs = 1000;
let latestAudio: AudioLevels = { volume: 0, bass: 0, mid: 0, treble: 0 };
let latestTime = 0;
let latestTriggers: [number, number, number] = [0, 0, 0];

// 各トリガーが最後に発火した時刻(performance.now()、未発火は0)。VJStateへは
// 「直近に発火した1件」だけをidつきで送り、投影窓側はidの変化で新規発火を判定する
// (クロスフェードのCrossfadeInstructionと同じ方式)。
const triggerFiredAt: [number, number, number] = [0, 0, 0];
let lastTrigger: TriggerInstruction | null = null;

/** Trigger 1/2/3ボタンを押した(またはキーを押した)ときに呼ぶ。 */
function fireTrigger(index: 0 | 1 | 2) {
  triggerFiredAt[index] = performance.now();
  lastTrigger = { id: crypto.randomUUID(), index };
}

/** @returns 現在時刻におけるTrigger 1/2/3それぞれのbeatPulse相当の値(発火時1→指数減衰) */
function computeTriggers(now: number): [number, number, number] {
  return triggerFiredAt.map((firedAt) => {
    if (firedAt === 0) return 0;
    const elapsedSec = (now - firedAt) / 1000;
    return Math.exp(-elapsedSec / TRIGGER_PULSE_DECAY_TAU);
  }) as [number, number, number];
}

/** 表示中の投影窓のいずれかがそのトリガー番号に対応する演出を持っていれば、ボタンを有効化する。 */
function updateTriggerButtonStates() {
  const supported = [false, false, false];
  displays.forEach((entry) => {
    const names = entry.currentLayer.scene.triggerEffectNames;
    if (!names) return;
    names.forEach((name, i) => {
      if (name) supported[i] = true;
    });
  });
  triggerButtons.forEach((btn, i) => {
    btn.disabled = !supported[i];
  });
}

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
  paletteSelectEl: PaletteDropdown;
  mainColorInput: HTMLInputElement;
  subColorInput: HTMLInputElement;
  presetSelectEl: HTMLSelectElement;
  crossfadeBtn: HTMLButtonElement;
}

// windowId(BroadcastChannelで各投影窓を識別するキー)をMapのキーにする。
const displays = new Map<string, DisplayEntry>();
let displayCounter = 0;

/** 投影窓が1つもない間だけ「投影窓がありません」の案内を表示し、Randomボタンを無効化する。 */
function updateDisplaysEmptyVisibility() {
  displaysEmptyEl.style.display = displays.size === 0 ? "block" : "none";
  randomBtn.disabled = displays.size === 0;
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
  updatePaletteUIState(entry);
}

/** 予約シーンがカラーパレット非対応なら、パレットUI(プリセット選択・カラーピッカー)を無効化する。 */
function updatePaletteUIState(entry: DisplayEntry) {
  const supportsPalette = sceneSupportsPalette[entry.pendingLayer.sceneIndex];
  entry.paletteSelectEl.disabled = !supportsPalette;
  entry.mainColorInput.disabled = !supportsPalette;
  entry.subColorInput.disabled = !supportsPalette;
}

/** プリセットselectの選択肢を、localStorageの最新内容で作り直す。可能なら選択中の値を維持する。 */
function populatePresetSelect(selectEl: HTMLSelectElement) {
  const presets = loadPresets();
  const prevValue = selectEl.value;
  selectEl.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = presets.length === 0 ? "(No presets)" : "Select preset";
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
  currentSlot.className = "preview-slot current-slot";
  const currentLabel = document.createElement("div");
  currentLabel.className = "preview-slot-label";
  currentLabel.textContent = "Current";
  const currentPreviewWrap = document.createElement("div");
  currentPreviewWrap.className = "display-preview current-preview";
  currentSlot.append(currentLabel, currentPreviewWrap);

  const pendingSlot = document.createElement("div");
  pendingSlot.className = "preview-slot pending-slot";
  const pendingLabel = document.createElement("div");
  pendingLabel.className = "preview-slot-label";
  pendingLabel.textContent = "Next";
  const pendingPreviewWrap = document.createElement("div");
  pendingPreviewWrap.className = "display-preview pending-preview";
  pendingSlot.append(pendingLabel, pendingPreviewWrap);

  previewGroup.append(currentSlot, pendingSlot);

  const controls = document.createElement("div");
  controls.className = "display-row-controls";

  const labelEl = document.createElement("div");
  labelEl.className = "display-row-label";
  labelEl.textContent = `Display ${label}`;

  const selectEl = document.createElement("select");
  sceneNames.forEach((name, i) => {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = name;
    selectEl.appendChild(option);
  });

  const paletteRow = document.createElement("div");
  paletteRow.className = "palette-row";

  const paletteSelectEl = createPaletteDropdown(PALETTE_PRESETS);

  const mainColorInput = document.createElement("input");
  mainColorInput.type = "color";
  mainColorInput.title = "Main color";
  const subColorInput = document.createElement("input");
  subColorInput.type = "color";
  subColorInput.title = "Sub color";

  paletteRow.append(paletteSelectEl.el, mainColorInput, subColorInput);

  const crossfadeBtn = document.createElement("button");
  crossfadeBtn.className = "crossfade-btn";
  crossfadeBtn.textContent = "Crossfade";

  // シーン選択・カラー選択・Crossfadeは1行にまとめる
  const sceneColorRow = document.createElement("div");
  sceneColorRow.className = "control-row";
  sceneColorRow.append(selectEl, paletteRow, crossfadeBtn);

  const presetRow = document.createElement("div");
  presetRow.className = "preset-row";
  const presetSaveBtn = document.createElement("button");
  presetSaveBtn.textContent = "Save Preset";
  const presetSelectEl = document.createElement("select");
  const presetDeleteBtn = document.createElement("button");
  presetDeleteBtn.textContent = "Delete";
  presetRow.append(presetSaveBtn, presetSelectEl, presetDeleteBtn);

  // 「閉じる」は行のコントロール一覧ではなく、枠右上の✗ボタンで行う
  const closeBtn = document.createElement("button");
  closeBtn.className = "close-btn";
  closeBtn.textContent = "✕";
  closeBtn.title = "Close";

  controls.append(labelEl, sceneColorRow, presetRow);
  rowEl.append(previewGroup, controls, closeBtn);

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

/** Blank(index 0)と、除外したいシーン(通常は現在表示中のシーン)を除いた中から1つランダムに選ぶ。 */
function pickRandomSceneIndex(excludeIndex: number): number {
  const candidates: number[] = [];
  for (let i = 1; i < sceneNames.length; i++) {
    if (i !== excludeIndex) candidates.push(i);
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** 投影窓1つ分をランダムなシーン・パレットへクロスフェードする(セミオートモード)。 */
function randomizeEntry(entry: DisplayEntry) {
  if (entry.crossfadingInstructionId) return; // クロスフェード実行中は今回の対象から外す

  const sceneIndex = pickRandomSceneIndex(entry.currentLayer.sceneIndex);
  const paletteIndex = Math.floor(Math.random() * PALETTE_PRESETS.length);
  const palette = { ...PALETTE_PRESETS[paletteIndex].palette };

  entry.selectEl.value = String(sceneIndex);
  entry.paletteSelectEl.value = String(paletteIndex);
  entry.mainColorInput.value = palette.main;
  entry.subColorInput.value = palette.sub;

  rebuildPendingLayer(entry, sceneIndex, palette);
  startEntryCrossfade(entry);
}

/** 「Random」ボタンの処理(セミオートモード、[specs/011-semi-auto-mode.md](../specs/011-semi-auto-mode.md)参照)。
 * 表示中の各投影窓を独立にランダム化し、Intensityも1回だけランダムに変更する。 */
function randomizeAll() {
  displays.forEach((entry) => randomizeEntry(entry));
  setIntensity(Math.round(Math.random() * 90) / 10);
}

/** 「投影窓を追加」ボタンの処理。新規投影窓を開き、対応する行・レイヤー・イベントハンドラを組み立てる。 */
function addDisplay() {
  const id = crypto.randomUUID();
  displayCounter += 1;

  // GitHub Pages等サブパス配信では絶対パス"/display.html"が壊れるため、
  // Viteのbase設定(import.meta.env.BASE_URL)を基準にする
  const opened = window.open(`${import.meta.env.BASE_URL}display.html?windowId=${id}`, id, "width=1280,height=720");
  if (!opened) {
    console.error("Failed to open display window (popup may have been blocked)");
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
  updatePaletteUIState(entry);

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
    const sceneName = sceneNames[entry.pendingLayer.sceneIndex];
    const { main, sub } = entry.pendingLayer.palette;
    const defaultName = `${sceneName}-${main}-${sub}`;
    const name = prompt("Preset name", defaultName);
    if (!name) return;
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
      console.warn(`Preset "${preset.name}" references unknown scene "${preset.sceneName}"`);
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

updateDisplaysEmptyVisibility();

addDisplayBtn.addEventListener("click", () => {
  addDisplay();
});

randomBtn.addEventListener("click", () => {
  randomizeAll();
});

window.addEventListener("resize", () => {
  displays.forEach((entry) => resizeEntry(entry));
});

function setIntensity(v: number) {
  manualIntensity = Math.min(9, Math.max(0, v));
  intensitySlider.value = String(manualIntensity);
  intensityValueEl.textContent = manualIntensity.toFixed(1);
}

function setCrossfadeDuration(seconds: number) {
  crossfadeDurationMs = Math.round(seconds * 1000);
  crossfadeDurationValueEl.textContent = seconds.toFixed(1);
}

async function toggleMic() {
  if (audio.isEnabled()) {
    audio.stop();
    micToggleBtn.textContent = "Enable Mic (M)";
    return;
  }
  try {
    await audio.start();
    micToggleBtn.textContent = "Disable Mic (M)";
  } catch (err) {
    console.error("Failed to access microphone", err);
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
  toggleMic();
});

triggerButtons.forEach((btn, i) => {
  btn.addEventListener("click", () => fireTrigger(i as 0 | 1 | 2));
});

window.addEventListener("keydown", (e) => {
  // select等にフォーカスがある間は、そちらの標準的な入力操作を優先する
  const target = e.target as HTMLElement | null;
  const isFormField = target instanceof HTMLInputElement || target instanceof HTMLSelectElement;

  if (e.key === "ArrowRight") {
    setIntensity(manualIntensity + 0.1);
  } else if (e.key === "ArrowLeft") {
    setIntensity(manualIntensity - 0.1);
  } else if (e.key === " ") {
    // Trigger 1。button要素がフォーカスされていると標準動作でクリックされてしまうため、
    // どこにフォーカスがあっても常にpreventDefaultする(マイクトグルだった頃からの挙動を踏襲)
    e.preventDefault();
    fireTrigger(0);
  } else if (!isFormField && (e.key === "m" || e.key === "M")) {
    toggleMic();
  } else if (e.code === "MetaRight" || e.code === "ControlRight") {
    // Trigger 2。MacはCmd右(MetaRight)、WindowsはWinキーがOSに予約されがちなためCtrl右(ControlRight)を使う
    e.preventDefault();
    fireTrigger(1);
  } else if (e.code === "MetaLeft" || e.code === "ControlLeft") {
    // Trigger 3。Mac=Cmd左(MetaLeft)、Windows=Ctrl左(ControlLeft)
    e.preventDefault();
    fireTrigger(2);
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
  latestTriggers = computeTriggers(performance.now());

  // 投影窓の生存確認。ユーザーがウィンドウ自体を閉じた場合も一覧から自動的に除去する。
  for (const [id, entry] of [...displays]) {
    if (entry.window.closed) {
      removeDisplay(id);
    }
  }

  updateTriggerButtonStates();

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
    trigger: lastTrigger,
    intensity: manualIntensity,
    audio: scaledLevels,
    time,
  };
  channel.postMessage(state);

  statusEl.textContent = `Displays: ${displays.size} connected`;
}

// プレビュー描画は見た目の滑らかさ優先でrAFのまま。操作窓が隠れて一時的に
// 止まっても実害はない(音声解析・投影窓への送信は上記tickが継続する)。
function renderPreviews() {
  displays.forEach((entry) => {
    const currentWidth = entry.currentPreviewWrap.clientWidth || 1;
    const currentHeight = entry.currentPreviewWrap.clientHeight || 1;
    renderLayer(entry.currentLayer, currentWidth, currentHeight, latestTime, latestAudio, latestTriggers);

    // クロスフェード中は pendingLayer が currentPreviewWrap 側に重ねて表示されているため
    // そちらのサイズでレンダリングし、そうでなければ予約プレビュー欄自身のサイズを使う。
    if (entry.crossfadingInstructionId) {
      renderLayer(entry.pendingLayer, currentWidth, currentHeight, latestTime, latestAudio, latestTriggers);
    } else {
      const pendingWidth = entry.pendingPreviewWrap.clientWidth || 1;
      const pendingHeight = entry.pendingPreviewWrap.clientHeight || 1;
      renderLayer(entry.pendingLayer, pendingWidth, pendingHeight, latestTime, latestAudio, latestTriggers);
    }
  });

  requestAnimationFrame(renderPreviews);
}

renderPreviews();
