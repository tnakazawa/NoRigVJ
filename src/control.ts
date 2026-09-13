import * as THREE from "three";
import { AudioAnalyzer, type AudioLevels } from "./audio";
import { sceneFactories, type Scene } from "./scenes";
import { CHANNEL_NAME, type VJState } from "./shared";

const displaysListEl = document.getElementById("displays-list")!;
const displaysEmptyEl = document.getElementById("displays-empty")!;
const intensitySlider = document.getElementById("intensity") as HTMLInputElement;
const intensityValueEl = document.getElementById("intensity-value")!;
const micToggleBtn = document.getElementById("mic-toggle") as HTMLButtonElement;
const addDisplayBtn = document.getElementById("add-display") as HTMLButtonElement;
const statusEl = document.getElementById("status")!;

let startTime = performance.now();
let manualIntensity = 1; // ← / → キー、またはスライダーで調整
let latestAudio: AudioLevels = { volume: 0, bass: 0, mid: 0, treble: 0 };
let latestTime = 0;

const audio = new AudioAnalyzer();
const channel = new BroadcastChannel(CHANNEL_NAME);

interface DisplayEntry {
  id: string;
  window: Window;
  sceneIndex: number;
  scenes: Scene[];
  renderer: THREE.WebGLRenderer;
  previewCanvas: HTMLCanvasElement;
  previewCtx: CanvasRenderingContext2D;
  previewGlCanvas: HTMLCanvasElement;
  rowEl: HTMLElement;
}

// 投影窓ごとに独立したシーンインスタンス・プレビュー用canvas/rendererを保持する。
// windowId(BroadcastChannelで各投影窓を識別するキー)をMapのキーにする。
const displays = new Map<string, DisplayEntry>();
let displayCounter = 0;

function updateDisplaysEmptyVisibility() {
  displaysEmptyEl.style.display = displays.size === 0 ? "block" : "none";
}

function updateDisplayCanvasVisibility(entry: DisplayEntry) {
  const isWebGL = entry.scenes[entry.sceneIndex].kind === "webgl";
  entry.previewCanvas.style.display = isWebGL ? "none" : "block";
  entry.previewGlCanvas.style.display = isWebGL ? "block" : "none";
}

function resizeDisplayEntry(entry: DisplayEntry) {
  entry.previewCanvas.width = entry.previewCanvas.clientWidth * window.devicePixelRatio;
  entry.previewCanvas.height = entry.previewCanvas.clientHeight * window.devicePixelRatio;
  entry.previewCtx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  entry.renderer.setSize(entry.previewGlCanvas.clientWidth, entry.previewGlCanvas.clientHeight, false);
}

function createDisplayRow(label: number) {
  const rowEl = document.createElement("div");
  rowEl.className = "display-row";

  const previewWrap = document.createElement("div");
  previewWrap.className = "display-preview";
  const previewCanvas = document.createElement("canvas");
  const previewGlCanvas = document.createElement("canvas");
  previewWrap.append(previewCanvas, previewGlCanvas);

  const controls = document.createElement("div");
  controls.className = "display-row-controls";

  const labelEl = document.createElement("div");
  labelEl.className = "display-row-label";
  labelEl.textContent = `投影窓 ${label}`;

  const selectEl = document.createElement("select");
  const closeBtn = document.createElement("button");
  closeBtn.className = "close-btn";
  closeBtn.textContent = "閉じる";

  controls.append(labelEl, selectEl, closeBtn);
  rowEl.append(previewWrap, controls);

  return { rowEl, previewCanvas, previewGlCanvas, selectEl, closeBtn };
}

function addDisplay() {
  const id = crypto.randomUUID();
  displayCounter += 1;

  const opened = window.open(`/display.html?windowId=${id}`, id, "width=1280,height=720");
  if (!opened) {
    console.error("投影窓のオープンに失敗しました(ポップアップブロックされている可能性があります)");
    return;
  }

  const { rowEl, previewCanvas, previewGlCanvas, selectEl, closeBtn } = createDisplayRow(displayCounter);
  displaysListEl.appendChild(rowEl);

  const previewCtx = previewCanvas.getContext("2d")!;
  const renderer = new THREE.WebGLRenderer({ canvas: previewGlCanvas, antialias: true });

  // 投影窓ごとに独立したシーンインスタンス群を持つ(WebGLシーンはRenderTargetなどの
  // 状態をインスタンスごとに抱えるため、操作UI側のプレビューも専用インスタンスが必要)。
  const scenes: Scene[] = sceneFactories.map((factory) => factory());
  scenes.forEach((scene) => {
    if (scene.kind === "webgl" && scene.init) {
      scene.init({
        renderer,
        width: previewGlCanvas.clientWidth || 1,
        height: previewGlCanvas.clientHeight || 1,
        time: 0,
        audio: { volume: 0, bass: 0, mid: 0, treble: 0 },
      });
    }
  });

  scenes.forEach((scene, i) => {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = scene.name;
    selectEl.appendChild(option);
  });

  const entry: DisplayEntry = {
    id,
    window: opened,
    sceneIndex: 0,
    scenes,
    renderer,
    previewCanvas,
    previewCtx,
    previewGlCanvas,
    rowEl,
  };

  selectEl.addEventListener("change", () => {
    entry.sceneIndex = Number(selectEl.value);
    updateDisplayCanvasVisibility(entry);
    // display:none の間は clientWidth/Height が0になり renderer.setSize に反映できないため、
    // 表示状態を切り替えた直後に再計算する。
    resizeDisplayEntry(entry);
  });

  closeBtn.addEventListener("click", () => {
    removeDisplay(id);
  });

  displays.set(id, entry);
  updateDisplayCanvasVisibility(entry);
  resizeDisplayEntry(entry);
  updateDisplaysEmptyVisibility();
}

function removeDisplay(id: string) {
  const entry = displays.get(id);
  if (!entry) return;
  if (!entry.window.closed) {
    entry.window.close();
  }
  entry.renderer.dispose();
  entry.rowEl.remove();
  displays.delete(id);
  updateDisplaysEmptyVisibility();
}

addDisplayBtn.addEventListener("click", () => {
  addDisplay();
});

window.addEventListener("resize", () => {
  displays.forEach((entry) => resizeDisplayEntry(entry));
});

function setIntensity(v: number) {
  manualIntensity = Math.min(3, Math.max(0, v));
  intensitySlider.value = String(manualIntensity);
  intensityValueEl.textContent = manualIntensity.toFixed(1);
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

intensitySlider.addEventListener("input", () => {
  setIntensity(Number(intensitySlider.value));
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
  displays.forEach((entry, id) => {
    sceneIndexByWindow[id] = entry.sceneIndex;
  });

  const state: VJState = { sceneIndexByWindow, intensity: manualIntensity, audio: scaledLevels, time };
  channel.postMessage(state);

  statusEl.textContent = `投影窓: ${displays.size}枚接続中`;
}

// プレビュー描画は見た目の滑らかさ優先でrAFのまま。操作窓が隠れて一時的に
// 止まっても実害はない(音声解析・投影窓への送信は上記tickが継続する)。
function renderPreviews() {
  displays.forEach((entry) => {
    const scene = entry.scenes[entry.sceneIndex];
    if (scene.kind === "2d") {
      const width = entry.previewCanvas.clientWidth;
      const height = entry.previewCanvas.clientHeight;
      scene.render({ ctx: entry.previewCtx, width, height, time: latestTime, audio: latestAudio });
    } else {
      const width = entry.previewGlCanvas.clientWidth;
      const height = entry.previewGlCanvas.clientHeight;
      scene.render({ renderer: entry.renderer, width, height, time: latestTime, audio: latestAudio });
    }
  });

  requestAnimationFrame(renderPreviews);
}

renderPreviews();
