import { AudioAnalyzer, type AudioLevels } from "./audio";
import { startCrossfade } from "./crossfade";
import { createLayer, disposeLayer, renderLayer, resizeLayer, type Layer } from "./layer";
import { createPaletteDropdown, type PaletteDropdown } from "./palette-dropdown";
import { DEFAULT_PALETTE, PALETTE_PRESETS } from "./palettes";
import { deletePreset, loadPresets, savePreset } from "./presets";
import { sceneNames, sceneSupportsPalette, type Palette } from "./scenes";
import {
  DEFAULT_STEP_CROSSFADE_DURATION_MS,
  DEFAULT_STEP_INTERVAL_MS,
  deleteSequencePreset,
  loadSequence,
  loadSequencePresets,
  saveSequence,
  saveSequencePreset,
  type SequenceStep,
} from "./sequence";
import { CHANNEL_NAME, type CrossfadeInstruction, type VJState } from "./shared";

const displaysListEl = document.getElementById("displays-list")!;
const displaysEmptyEl = document.getElementById("displays-empty")!;
const intensitySlider = document.getElementById("intensity") as HTMLInputElement;
const intensityValueEl = document.getElementById("intensity-value")!;
const crossfadeDurationSlider = document.getElementById("crossfade-duration") as HTMLInputElement;
const crossfadeDurationValueEl = document.getElementById("crossfade-duration-value")!;
const micToggleBtn = document.getElementById("mic-toggle") as HTMLButtonElement;
const addDisplayBtn = document.getElementById("add-display") as HTMLButtonElement;
const randomBtn = document.getElementById("random-btn") as HTMLButtonElement;
const autoIntervalSection = document.getElementById("auto-interval-section") as HTMLElement;
const autoIntervalSlider = document.getElementById("auto-interval") as HTMLInputElement;
const autoIntervalValueEl = document.getElementById("auto-interval-value")!;
const autoToggleBtn = document.getElementById("auto-toggle-btn") as HTMLButtonElement;
const autoModeStatusEl = document.getElementById("auto-mode-status")!;
const autoModeRadios = document.querySelectorAll<HTMLInputElement>('input[name="auto-mode"]');
const editSequenceBtn = document.getElementById("edit-sequence-btn") as HTMLButtonElement;
const sequenceModal = document.getElementById("sequence-modal") as HTMLElement;
const sequenceSceneListEl = document.getElementById("sequence-scene-list")!;
const sequenceStepsListEl = document.getElementById("sequence-steps-list")!;
const sequenceModalCloseBtn = document.getElementById("sequence-modal-close") as HTMLButtonElement;
const sequencePresetSaveBtn = document.getElementById("sequence-preset-save") as HTMLButtonElement;
const sequencePresetSelectEl = document.getElementById("sequence-preset-select") as HTMLSelectElement;
const sequencePresetDeleteBtn = document.getElementById("sequence-preset-delete") as HTMLButtonElement;
const statusEl = document.getElementById("status")!;
const fxPadEl = document.getElementById("fx-pad") as HTMLElement;
const fxPadDotEl = document.getElementById("fx-pad-dot") as HTMLElement;
const fxPadSectionEl = document.getElementById("fx-pad-section") as HTMLElement;
const fxPadResizeHandleEl = document.getElementById("fx-pad-resize-handle") as HTMLElement;

let startTime = performance.now();
let manualIntensity = 1; // ← / → キー、またはスライダーで調整
let crossfadeDurationMs = 1000;
let latestAudio: AudioLevels = { volume: 0, bass: 0, mid: 0, treble: 0 };
let latestTime = 0;

// FXパッド([specs/015-fx-pad.md](../specs/015-fx-pad.md)参照)。押している間の座標(中心(0,0)、
// 左上(-1,-1)、右下(1,1)に正規化)を全投影窓へそのまま送る。減衰の概念はなく、離すと即座に0へ戻る
// (中心=未操作状態と一致する)。
let padX = 0;
let padY = 0;

// フルオートモード([specs/012-full-auto-mode.md](../specs/012-full-auto-mode.md)参照)。
// VJが手動でCrossfade/Randomボタンを押すと解除される(シーン予約変更・FXパッド操作・
// Intensity/Crossfade durationスライダー操作では解除しない)。
let fullAutoIntervalMs = 5 * 60 * 1000;
let fullAutoEnabled = false;
/** 次回自動実行の予定時刻(performance.now()と同じ時間軸)。fullAutoEnabled中のみ意味を持つ */
let fullAutoNextFireAt = 0;

// シーケンスモード([specs/013-sequence-mode.md](../specs/013-sequence-mode.md)参照)。
// フルオートの実行内容を「ランダム」ではなく「決めた順」にするサブモード。各ステップが自分の
// interval(表示時間)とcrossfadeDurationMs(切替時間)を個別に持つため、Sequence中はグローバルな
// Auto interval/Crossfade durationは使わない(Randomモード専用になる)。
let autoMode: "random" | "sequence" = "random";
let sequenceSteps: SequenceStep[] = loadSequence().steps;
/** 現在の再生位置(sequenceStepsのインデックス)。次回advanceSequence()は(sequenceIndex+1)%lengthへ進む。
 * -1は「まだ一度も進んでいない」= 次回は0番目から始まる、という意味。 */
let sequenceIndex = -1;

/** パッド内でのpointerイベント座標を、パッド範囲でクランプした-1〜1のx,yに変換する(中心が0,0)。 */
function pointerToPad(event: PointerEvent): { x: number; y: number } {
  const rect = fxPadEl.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  return { x: Math.min(1, Math.max(-1, x)), y: Math.min(1, Math.max(-1, y)) };
}

/** 押している間、パッドの値・ドット表示位置を更新する。 */
function setPad(x: number, y: number) {
  padX = x;
  padY = y;
  fxPadDotEl.style.left = `${((x + 1) / 2) * 100}%`;
  fxPadDotEl.style.top = `${((y + 1) / 2) * 100}%`;
  fxPadDotEl.hidden = false;
}

/** 指を離したとき、パッドの値を0(未操作)に戻す。 */
function clearPad() {
  padX = 0;
  padY = 0;
  fxPadDotEl.hidden = true;
}

/** 表示中の投影窓のいずれかがFXパッドに対応した演出を持っていれば、パッドを有効化する。 */
function updateFxPadEnabled() {
  const supported = [...displays.values()].some((entry) => entry.currentLayer.scene.padSupported);
  fxPadEl.classList.toggle("disabled", !supported);
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
  /** 実行中のクロスフェードの所要時間(ミリ秒)。シーケンスモードは専用のCrossfade durationを
   * 使うため、グローバルな`crossfadeDurationMs`とは別に、投影窓ごとに実際に使った値を憶えておく必要がある
   * (VJStateへ送る際にこれを見る)。クロスフェード実行中のみ値を持つ。 */
  crossfadingDurationMs: number | null;
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

/** 指定した投影窓に対し、現在の表示から予約(pendingLayer)へのクロスフェードを開始する。
 * @param durationMs 省略時はグローバルなCrossfade duration。シーケンスモードは専用の値を渡す。 */
function startEntryCrossfade(entry: DisplayEntry, durationMs: number = crossfadeDurationMs) {
  if (entry.crossfadingInstructionId) return;

  const instructionId = crypto.randomUUID();
  const toLayer = entry.pendingLayer;
  entry.crossfadingInstructionId = instructionId;
  entry.crossfadingDurationMs = durationMs;

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
    durationMs,
    (finishedLayer) => {
      entry.currentLayer = finishedLayer;
      entry.crossfadingInstructionId = null;
      entry.crossfadingDurationMs = null;
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

/** Crossfade durationがAuto intervalを超えていたら、Auto intervalに合わせて短縮する
 * (クロスフェードが終わる前に次の自動切替が来てしまう状態を避けるため)。Auto interval変更時・
 * フルオートをONにする瞬間・フルオートON中のCrossfade duration変更時、いずれからも呼ばれる。 */
function clampCrossfadeDurationToAutoInterval() {
  if (crossfadeDurationMs > fullAutoIntervalMs) {
    const seconds = fullAutoIntervalMs / 1000;
    setCrossfadeDuration(seconds);
    crossfadeDurationSlider.value = String(seconds);
  }
}

function setAutoInterval(seconds: number) {
  fullAutoIntervalMs = Math.round(seconds) * 1000;
  autoIntervalValueEl.textContent = String(Math.round(seconds));
  clampCrossfadeDurationToAutoInterval();
}

/** Sequenceモードで次に表示される予定のステップ(まだ`sequenceIndex`は進めない)。
 * フルオートをONにする瞬間、次回発火までの待ち時間を決めるのに使う。 */
function peekNextSequenceStep(): SequenceStep | null {
  if (sequenceSteps.length === 0) return null;
  return sequenceSteps[(sequenceIndex + 1) % sequenceSteps.length];
}

/** シーケンスモードの次のステップへ、全投影窓を同時に進める(投影窓ごとに独立ランダムなRandomとは異なり、
 * 全投影窓が同じ再生位置を共有する)。そのステップに設定されたクロスフェード時間でクロスフェードする。
 * @returns 実際に次のステップへ進めたら`true`。投影窓のいずれかがまだクロスフェード実行中で
 * 進められなかった場合は`false`(呼び出し側は`sequenceIndex`を進めず、少し待って再試行する。
 * ここで進めたことにしてしまうと、その投影窓は今回のステップを一度も表示しないまま
 * 次のステップへ飛ばされてしまう)。 */
function advanceSequence(): boolean {
  if (sequenceSteps.length === 0) return false;
  if ([...displays.values()].some((entry) => entry.crossfadingInstructionId)) return false;

  sequenceIndex = (sequenceIndex + 1) % sequenceSteps.length;
  const step = sequenceSteps[sequenceIndex];
  const sceneIndex = sceneNames.indexOf(step.sceneName);
  if (sceneIndex === -1) return true; // シーンファイルが削除された等、リスト作成後にシーン自体がなくなった場合の防御

  const presetIndex = PALETTE_PRESETS.findIndex(
    (p) => p.palette.main === step.palette.main && p.palette.sub === step.palette.sub,
  );

  displays.forEach((entry) => {
    entry.selectEl.value = String(sceneIndex);
    entry.paletteSelectEl.value = presetIndex >= 0 ? String(presetIndex) : "custom";
    entry.mainColorInput.value = step.palette.main;
    entry.subColorInput.value = step.palette.sub;

    rebuildPendingLayer(entry, sceneIndex, { ...step.palette });
    startEntryCrossfade(entry, step.crossfadeDurationMs);
  });
  return true;
}

/** Auto modeの切替・シーケンス編集ボタンの表示・Autoトグルの有効/無効を同期する。
 * Sequenceモードでシーケンスが0件の間はAutoトグルを無効化する
 * (投影窓が0個でも押せるRandomモードとは異なり、シーケンスが空では実行内容がないため)。
 * 既にONの状態で0件になった場合は強制的にOFFへ戻す(disabledでOFFに戻せなくなる事故を避ける)。 */
function updateAutoModeUI() {
  editSequenceBtn.hidden = autoMode !== "sequence";
  // SequenceモードはAuto interval(グローバル)を使わず各ステップ個別のintervalで進行するため、
  // Auto intervalスライダー自体をSequence選択中は隠す(Randomモードでのみ意味を持つ)。
  autoIntervalSection.hidden = autoMode === "sequence";
  const sequenceEmpty = autoMode === "sequence" && sequenceSteps.length === 0;
  if (sequenceEmpty && fullAutoEnabled) {
    fullAutoEnabled = false;
  }
  autoToggleBtn.disabled = sequenceEmpty;
  updateAutoToggleLabel(performance.now());
}

autoModeRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    autoMode = radio.value === "sequence" ? "sequence" : "random";
    updateAutoModeUI();
  });
});

/** モーダル内の「全シーン」一覧を描画する。「+」ボタンを押すたびにシーケンス末尾へ1ステップ追加する
 * (同じシーンを何回追加してもよい)。 */
function renderSequenceSceneList() {
  sequenceSceneListEl.innerHTML = "";
  sceneNames.forEach((name) => {
    const item = document.createElement("div");
    item.className = "sequence-scene-item";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "sequence-add-btn";
    addBtn.textContent = "+";
    addBtn.title = `Add ${name}`;
    addBtn.addEventListener("click", () => {
      sequenceSteps.push({
        id: crypto.randomUUID(),
        sceneName: name,
        palette: { ...DEFAULT_PALETTE },
        intervalMs: DEFAULT_STEP_INTERVAL_MS,
        crossfadeDurationMs: DEFAULT_STEP_CROSSFADE_DURATION_MS,
      });
      renderSequenceStepsList();
    });

    const label = document.createElement("span");
    label.textContent = name;

    item.append(addBtn, label);
    sequenceSceneListEl.appendChild(item);
  });
}

/** ドラッグ&ドロップ中、現在ドラッグ中の行のステップid(dragover先での並べ替え判定に使う)。 */
let draggingStepId: string | null = null;

/** モーダル内の「シーケンス順」ドラッグ&ドロップリストを、`sequenceSteps`の内容から描画し直す。
 * 各行はシーン名+パレット選択に加え、そのステップ専用のInterval(表示時間)・Crossfade duration
 * (切替時間)スライダーと削除ボタンを持つ。 */
function renderSequenceStepsList() {
  sequenceStepsListEl.innerHTML = "";
  sequenceSteps.forEach((step) => {
    const row = document.createElement("div");
    row.className = "sequence-step-row";
    // 行全体をdraggableにすると、行内のrangeスライダー(Duration/Crossfade)を操作しようとした
    // 瞬間にブラウザが「行のドラッグ開始」と誤認識してしまう。ドラッグハンドル上でmousedownした
    // ときだけ一時的にdraggableを立てることで、スライダー操作とドラッグ開始を区別する。
    row.draggable = false;
    row.dataset.stepId = step.id;

    function findStep() {
      return sequenceSteps.find((s) => s.id === step.id);
    }

    const main = document.createElement("div");
    main.className = "sequence-step-row-main";

    const handle = document.createElement("span");
    handle.className = "sequence-step-drag-handle";
    handle.textContent = "⋮⋮";
    handle.addEventListener("mousedown", () => {
      row.draggable = true;
    });
    handle.addEventListener("mouseup", () => {
      row.draggable = false;
    });

    const nameEl = document.createElement("span");
    nameEl.className = "sequence-step-name";
    nameEl.textContent = step.sceneName;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "sequence-step-remove-btn";
    removeBtn.textContent = "✕";
    removeBtn.title = "Remove";
    removeBtn.addEventListener("click", () => {
      sequenceSteps = sequenceSteps.filter((s) => s.id !== step.id);
      renderSequenceStepsList();
    });

    main.append(handle, nameEl, removeBtn);

    const controls = document.createElement("div");
    controls.className = "sequence-step-row-controls";

    const paletteDropdown = createPaletteDropdown(PALETTE_PRESETS);
    const mainColorInput = document.createElement("input");
    mainColorInput.type = "color";
    mainColorInput.title = "Main color";
    const subColorInput = document.createElement("input");
    subColorInput.type = "color";
    subColorInput.title = "Sub color";

    const supportsPalette = sceneSupportsPalette[sceneNames.indexOf(step.sceneName)];
    paletteDropdown.disabled = !supportsPalette;
    mainColorInput.disabled = !supportsPalette;
    subColorInput.disabled = !supportsPalette;

    const presetIndex = PALETTE_PRESETS.findIndex(
      (p) => p.palette.main === step.palette.main && p.palette.sub === step.palette.sub,
    );
    paletteDropdown.value = presetIndex >= 0 ? String(presetIndex) : "custom";
    mainColorInput.value = step.palette.main;
    subColorInput.value = step.palette.sub;

    paletteDropdown.addEventListener("change", () => {
      if (paletteDropdown.value === "custom") return;
      const preset = PALETTE_PRESETS[Number(paletteDropdown.value)];
      mainColorInput.value = preset.palette.main;
      subColorInput.value = preset.palette.sub;
      const target = findStep();
      if (target) target.palette = { ...preset.palette };
    });
    mainColorInput.addEventListener("input", () => {
      paletteDropdown.value = "custom";
      const target = findStep();
      if (target) target.palette = { main: mainColorInput.value, sub: subColorInput.value };
    });
    subColorInput.addEventListener("input", () => {
      paletteDropdown.value = "custom";
      const target = findStep();
      if (target) target.palette = { main: mainColorInput.value, sub: subColorInput.value };
    });

    // このステップの表示時間(Interval)。範囲は既存のAuto intervalスライダーと同じ5〜60秒。
    const intervalValueEl = document.createElement("span");
    intervalValueEl.textContent = String(Math.round(step.intervalMs / 1000));
    const intervalSlider = document.createElement("input");
    intervalSlider.type = "range";
    intervalSlider.min = "5";
    intervalSlider.max = "60";
    intervalSlider.step = "1";
    intervalSlider.value = String(Math.round(step.intervalMs / 1000));
    const intervalLabel = document.createElement("label");
    intervalLabel.className = "sequence-step-timing";
    intervalLabel.append(
      document.createTextNode("Duration "),
      intervalValueEl,
      document.createTextNode("s"),
      intervalSlider,
    );

    // このステップへ切り替わる際のCrossfade duration。Intervalを超えないようmax/値をクランプする。
    const crossfadeValueEl = document.createElement("span");
    crossfadeValueEl.textContent = (step.crossfadeDurationMs / 1000).toFixed(1);
    const crossfadeSlider = document.createElement("input");
    crossfadeSlider.type = "range";
    crossfadeSlider.min = "0";
    crossfadeSlider.max = String(step.intervalMs / 1000);
    crossfadeSlider.step = "0.1";
    crossfadeSlider.value = (step.crossfadeDurationMs / 1000).toFixed(1);
    const crossfadeLabel = document.createElement("label");
    crossfadeLabel.className = "sequence-step-timing";
    crossfadeLabel.append(
      document.createTextNode("Crossfade "),
      crossfadeValueEl,
      document.createTextNode("s"),
      crossfadeSlider,
    );

    intervalSlider.addEventListener("input", () => {
      const seconds = Number(intervalSlider.value);
      intervalValueEl.textContent = String(seconds);
      const target = findStep();
      if (!target) return;
      target.intervalMs = seconds * 1000;
      crossfadeSlider.max = String(seconds);
      if (target.crossfadeDurationMs > target.intervalMs) {
        target.crossfadeDurationMs = target.intervalMs;
        crossfadeSlider.value = String(seconds);
        crossfadeValueEl.textContent = seconds.toFixed(1);
      }
    });
    crossfadeSlider.addEventListener("input", () => {
      const seconds = Number(crossfadeSlider.value);
      crossfadeValueEl.textContent = seconds.toFixed(1);
      const target = findStep();
      if (target) target.crossfadeDurationMs = Math.round(seconds * 1000);
    });

    controls.append(paletteDropdown.el, mainColorInput, subColorInput, intervalLabel, crossfadeLabel);
    row.append(main, controls);

    row.addEventListener("dragstart", () => {
      draggingStepId = step.id;
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => {
      draggingStepId = null;
      row.draggable = false;
      row.classList.remove("dragging");
      syncSequenceStepsFromDom();
    });
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!draggingStepId || draggingStepId === step.id) return;
      const draggingEl = sequenceStepsListEl.querySelector<HTMLElement>(
        `.sequence-step-row[data-step-id="${CSS.escape(draggingStepId)}"]`,
      );
      if (!draggingEl) return;
      const rect = row.getBoundingClientRect();
      const before = e.clientY - rect.top < rect.height / 2;
      sequenceStepsListEl.insertBefore(draggingEl, before ? row : row.nextSibling);
    });

    sequenceStepsListEl.appendChild(row);
  });
}

/** ドラッグ&ドロップ後のDOM順序から`sequenceSteps`配列を作り直す(ドラッグ操作自体はDOM上で完結させ、
 * 完了時にまとめて配列へ反映する)。idで識別するため、同じシーンが複数ステップにあっても正しく並べ替わる。 */
function syncSequenceStepsFromDom() {
  const order = [...sequenceStepsListEl.querySelectorAll<HTMLElement>(".sequence-step-row")].map(
    (el) => el.dataset.stepId!,
  );
  sequenceSteps = order.map((id) => sequenceSteps.find((s) => s.id === id)!);
}

/** シーケンスプリセットselectの選択肢を、`localStorage` の最新内容で作り直す。可能なら選択中の値を維持する。 */
function populateSequencePresetSelect() {
  const presets = loadSequencePresets();
  const prevValue = sequencePresetSelectEl.value;
  sequencePresetSelectEl.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = presets.length === 0 ? "(No saved sequences)" : "Select sequence";
  sequencePresetSelectEl.appendChild(placeholder);

  presets.forEach((preset) => {
    const opt = document.createElement("option");
    opt.value = preset.id;
    opt.textContent = preset.name;
    sequencePresetSelectEl.appendChild(opt);
  });

  if ([...sequencePresetSelectEl.options].some((o) => o.value === prevValue)) {
    sequencePresetSelectEl.value = prevValue;
  }
}

editSequenceBtn.addEventListener("click", () => {
  renderSequenceSceneList();
  renderSequenceStepsList();
  populateSequencePresetSelect();
  sequenceModal.hidden = false;
});

sequenceModalCloseBtn.addEventListener("click", () => {
  syncSequenceStepsFromDom();
  sequenceModal.hidden = true;
  saveSequence({ steps: sequenceSteps });
  sequenceIndex = -1; // 内容が変わった可能性があるため、次回は先頭から
  updateAutoModeUI();
});

sequencePresetSaveBtn.addEventListener("click", () => {
  syncSequenceStepsFromDom(); // ドラッグ後の最新順序を確実に反映してから保存する
  const defaultName = `Sequence (${sequenceSteps.length} step${sequenceSteps.length === 1 ? "" : "s"})`;
  const name = prompt("Sequence name", defaultName);
  if (!name) return;
  saveSequencePreset(name, sequenceSteps);
  populateSequencePresetSelect();
});

sequencePresetSelectEl.addEventListener("change", () => {
  const presetId = sequencePresetSelectEl.value;
  if (!presetId) return;
  const preset = loadSequencePresets().find((p) => p.id === presetId);
  if (!preset) return;
  sequenceSteps = preset.steps.map((s) => ({ ...s, palette: { ...s.palette } }));
  renderSequenceStepsList();
});

sequencePresetDeleteBtn.addEventListener("click", () => {
  const presetId = sequencePresetSelectEl.value;
  if (!presetId) return;
  deleteSequencePreset(presetId);
  populateSequencePresetSelect();
});

/** ミリ秒を "mm:ss" 形式にする(フルオートの残り時間表示用)。 */
function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** フルオートのトグルボタンの表示を、現在時刻に応じて更新する。ボタンには「押すと切り替わる先」を表示する
 * (ONの間は「OFFにする」ボタンとして次回実行までの残り時間を、OFFの間は「ONにする」ボタンとして表示する)。 */
function updateAutoToggleLabel(now: number) {
  autoToggleBtn.textContent = fullAutoEnabled
    ? `Auto: OFF (next in ${formatMmSs(fullAutoNextFireAt - now)})`
    : "Auto: ON";
  const modeLabel = autoMode === "sequence" ? "Sequence" : "Random";
  autoModeStatusEl.textContent = `(${fullAutoEnabled ? "ON" : "OFF"} / ${modeLabel})`;
}

/** VJが手動でCrossfade/Randomボタンを押したときに呼ぶ。フルオートが有効なら解除する。 */
function disableFullAuto() {
  if (!fullAutoEnabled) return;
  fullAutoEnabled = false;
  updateAutoToggleLabel(performance.now());
}

autoIntervalSlider.addEventListener("input", () => {
  setAutoInterval(Number(autoIntervalSlider.value));
});

autoToggleBtn.addEventListener("click", () => {
  if (fullAutoEnabled) {
    fullAutoEnabled = false;
  } else {
    fullAutoEnabled = true;
    if (autoMode === "sequence") {
      // ONにした瞬間に最初のステップへすぐ切り替え、そのステップのintervalが経過したら次へ進む。
      const next = peekNextSequenceStep();
      const advanced = advanceSequence();
      fullAutoNextFireAt = performance.now() + (advanced ? (next ? next.intervalMs : DEFAULT_STEP_INTERVAL_MS) : 100);
    } else {
      fullAutoNextFireAt = performance.now() + fullAutoIntervalMs;
      clampCrossfadeDurationToAutoInterval();
    }
  }
  updateAutoToggleLabel(performance.now());
});

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
    crossfadingDurationMs: null,
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
    disableFullAuto();
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
  disableFullAuto();
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
setAutoInterval(Number(autoIntervalSlider.value));
updateAutoModeUI();

intensitySlider.addEventListener("input", () => {
  setIntensity(Number(intensitySlider.value));
});

crossfadeDurationSlider.addEventListener("input", () => {
  setCrossfadeDuration(Number(crossfadeDurationSlider.value));
  // フルオートON中は、Crossfade durationがAuto intervalを超えないようクランプする
  if (fullAutoEnabled) clampCrossfadeDurationToAutoInterval();
});

micToggleBtn.addEventListener("click", () => {
  toggleMic();
});

// FXパッド([specs/015-fx-pad.md](../specs/015-fx-pad.md)参照)。Pointer Captureにより、
// パッド外へドラッグしても(クランプした上で)値を更新し続けられる。
fxPadEl.addEventListener("pointerdown", (e) => {
  if (fxPadEl.classList.contains("disabled")) return;
  fxPadEl.setPointerCapture(e.pointerId);
  const { x, y } = pointerToPad(e);
  setPad(x, y);
});
fxPadEl.addEventListener("pointermove", (e) => {
  if (!fxPadEl.hasPointerCapture(e.pointerId)) return;
  const { x, y } = pointerToPad(e);
  setPad(x, y);
});
fxPadEl.addEventListener("pointerup", (e) => {
  if (fxPadEl.hasPointerCapture(e.pointerId)) fxPadEl.releasePointerCapture(e.pointerId);
  clearPad();
});
fxPadEl.addEventListener("pointercancel", clearPad);

// FXパッドエリアの高さをドラッグで調整できるようにする。`localStorage`に保存し次回起動時も復元する。
const FX_PAD_SECTION_HEIGHT_STORAGE_KEY = "norigvj-fx-pad-section-height";
const FX_PAD_SECTION_MIN_HEIGHT = 120;
const FX_PAD_SECTION_DEFAULT_HEIGHT = 280;

function setFxPadSectionHeight(px: number) {
  const maxHeight = window.innerHeight * 0.8;
  const clamped = Math.min(maxHeight, Math.max(FX_PAD_SECTION_MIN_HEIGHT, px));
  fxPadSectionEl.style.height = `${clamped}px`;
  localStorage.setItem(FX_PAD_SECTION_HEIGHT_STORAGE_KEY, String(clamped));
}

const savedFxPadSectionHeight = Number(localStorage.getItem(FX_PAD_SECTION_HEIGHT_STORAGE_KEY));
setFxPadSectionHeight(savedFxPadSectionHeight > 0 ? savedFxPadSectionHeight : FX_PAD_SECTION_DEFAULT_HEIGHT);

let fxPadResizeStartY = 0;
let fxPadResizeStartHeight = 0;
fxPadResizeHandleEl.addEventListener("pointerdown", (e) => {
  fxPadResizeHandleEl.setPointerCapture(e.pointerId);
  fxPadResizeHandleEl.classList.add("dragging");
  fxPadResizeStartY = e.clientY;
  fxPadResizeStartHeight = fxPadSectionEl.getBoundingClientRect().height;
});
fxPadResizeHandleEl.addEventListener("pointermove", (e) => {
  if (!fxPadResizeHandleEl.hasPointerCapture(e.pointerId)) return;
  // 上へドラッグする(clientYが減る)ほど高さが増えるようにする
  setFxPadSectionHeight(fxPadResizeStartHeight - (e.clientY - fxPadResizeStartY));
});
fxPadResizeHandleEl.addEventListener("pointerup", (e) => {
  if (fxPadResizeHandleEl.hasPointerCapture(e.pointerId)) fxPadResizeHandleEl.releasePointerCapture(e.pointerId);
  fxPadResizeHandleEl.classList.remove("dragging");
});

window.addEventListener("keydown", (e) => {
  // select等にフォーカスがある間は、そちらの標準的な入力操作を優先する
  const target = e.target as HTMLElement | null;
  const isFormField = target instanceof HTMLInputElement || target instanceof HTMLSelectElement;

  if (e.key === "ArrowRight") {
    setIntensity(manualIntensity + 0.1);
  } else if (e.key === "ArrowLeft") {
    setIntensity(manualIntensity - 0.1);
  } else if (!isFormField && (e.key === "m" || e.key === "M")) {
    toggleMic();
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

  const now = performance.now();
  if (fullAutoEnabled && now >= fullAutoNextFireAt) {
    if (autoMode === "sequence") {
      const next = peekNextSequenceStep();
      const advanced = advanceSequence();
      // 投影窓がまだクロスフェード中で進められなかった場合は、少し後で再試行する
      // (このステップを一度も表示しないまま次へ飛ばしてしまう事故を防ぐため)。
      fullAutoNextFireAt = now + (advanced ? (next ? next.intervalMs : DEFAULT_STEP_INTERVAL_MS) : 100);
    } else {
      randomizeAll();
      fullAutoNextFireAt = now + fullAutoIntervalMs;
    }
  }
  updateAutoToggleLabel(now);

  // 投影窓の生存確認。ユーザーがウィンドウ自体を閉じた場合も一覧から自動的に除去する。
  for (const [id, entry] of [...displays]) {
    if (entry.window.closed) {
      removeDisplay(id);
    }
  }

  updateFxPadEnabled();

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
        durationMs: entry.crossfadingDurationMs ?? crossfadeDurationMs,
      };
    }
  });

  const state: VJState = {
    sceneIndexByWindow,
    paletteByWindow,
    crossfadeByWindow,
    pad: { x: padX, y: padY },
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
    renderLayer(entry.currentLayer, currentWidth, currentHeight, latestTime, latestAudio, padX, padY);

    // クロスフェード中は pendingLayer が currentPreviewWrap 側に重ねて表示されているため
    // そちらのサイズでレンダリングし、そうでなければ予約プレビュー欄自身のサイズを使う。
    if (entry.crossfadingInstructionId) {
      renderLayer(entry.pendingLayer, currentWidth, currentHeight, latestTime, latestAudio, padX, padY);
    } else {
      const pendingWidth = entry.pendingPreviewWrap.clientWidth || 1;
      const pendingHeight = entry.pendingPreviewWrap.clientHeight || 1;
      renderLayer(entry.pendingLayer, pendingWidth, pendingHeight, latestTime, latestAudio, padX, padY);
    }
  });

  requestAnimationFrame(renderPreviews);
}

renderPreviews();

// 各コントロールの「?」ボタン。押すとdata-help-title/data-helpの内容を共通のヘルプモーダルに表示する。
const helpModal = document.getElementById("help-modal") as HTMLElement;
const helpModalTitleEl = document.getElementById("help-modal-title")!;
const helpModalTextEl = document.getElementById("help-modal-text")!;
const helpModalCloseBtn = document.getElementById("help-modal-close") as HTMLButtonElement;

document.querySelectorAll<HTMLButtonElement>(".help-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    helpModalTitleEl.textContent = btn.dataset.helpTitle ?? "";
    helpModalTextEl.textContent = btn.dataset.help ?? "";
    helpModal.hidden = false;
  });
});
helpModalCloseBtn.addEventListener("click", () => {
  helpModal.hidden = true;
});
helpModal.addEventListener("click", (event) => {
  if (event.target === helpModal) helpModal.hidden = true;
});
