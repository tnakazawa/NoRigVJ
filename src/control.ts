import * as THREE from "three";
import { AudioAnalyzer } from "./audio";
import { sceneFactories, type Scene } from "./scenes";
import { CHANNEL_NAME, type VJState } from "./shared";

const previewCanvas = document.getElementById("preview") as HTMLCanvasElement;
const previewGlCanvas = document.getElementById("preview-gl") as HTMLCanvasElement;
const previewCtx = previewCanvas.getContext("2d")!;
const hud = document.getElementById("hud")!;
const sceneButtonsEl = document.getElementById("scene-buttons")!;
const intensitySlider = document.getElementById("intensity") as HTMLInputElement;
const intensityValueEl = document.getElementById("intensity-value")!;
const micToggleBtn = document.getElementById("mic-toggle") as HTMLButtonElement;
const openDisplayBtn = document.getElementById("open-display") as HTMLButtonElement;
const statusEl = document.getElementById("status")!;

const renderer = new THREE.WebGLRenderer({ canvas: previewGlCanvas, antialias: true });

// 操作UI専用のシーンインスタンス群。投影窓は別途自分のインスタンスを持つ
// (WebGLシーンはRenderTargetなどの状態をインスタンスごとに抱えるため)。
const scenes: Scene[] = sceneFactories.map((factory) => factory());
scenes.forEach((scene) => {
  if (scene.kind === "webgl" && scene.init) {
    scene.init({
      renderer,
      width: previewCanvas.clientWidth || 1,
      height: previewCanvas.clientHeight || 1,
      time: 0,
      audio: { volume: 0, bass: 0, mid: 0, treble: 0 },
    });
  }
});

let sceneIndex = 0;
let startTime = performance.now();
let manualIntensity = 1; // ← / → キー、またはスライダーで調整

const audio = new AudioAnalyzer();
const channel = new BroadcastChannel(CHANNEL_NAME);
let displayWindow: Window | null = null;

function updateCanvasVisibility() {
  const isWebGL = scenes[sceneIndex].kind === "webgl";
  previewCanvas.style.display = isWebGL ? "none" : "block";
  previewGlCanvas.style.display = isWebGL ? "block" : "none";
}

function resize() {
  previewCanvas.width = previewCanvas.clientWidth * window.devicePixelRatio;
  previewCanvas.height = previewCanvas.clientHeight * window.devicePixelRatio;
  previewCtx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  renderer.setSize(previewGlCanvas.clientWidth, previewGlCanvas.clientHeight, false);
}
window.addEventListener("resize", resize);
resize();

function renderSceneButtons() {
  sceneButtonsEl.innerHTML = "";
  scenes.forEach((scene, i) => {
    const btn = document.createElement("button");
    btn.textContent = `${i + 1}. ${scene.name}`;
    btn.classList.toggle("active", i === sceneIndex);
    btn.addEventListener("click", () => setSceneIndex(i));
    sceneButtonsEl.appendChild(btn);
  });
}

function setSceneIndex(i: number) {
  sceneIndex = i;
  renderSceneButtons();
  updateCanvasVisibility();
  // display:none の間は clientWidth/Height が0になり renderer.setSize に反映できないため、
  // 表示状態を切り替えた直後に再計算する。
  resize();
}

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

renderSceneButtons();
updateCanvasVisibility();
setIntensity(manualIntensity);

intensitySlider.addEventListener("input", () => {
  setIntensity(Number(intensitySlider.value));
});

micToggleBtn.addEventListener("click", () => {
  enableMic();
});

openDisplayBtn.addEventListener("click", () => {
  if (displayWindow && !displayWindow.closed) {
    displayWindow.focus();
    return;
  }
  displayWindow = window.open("/display.html", "norigvj-display", "width=1280,height=720");
});

window.addEventListener("keydown", (e) => {
  if (e.key >= "1" && e.key <= String(scenes.length)) {
    setSceneIndex(Number(e.key) - 1);
  } else if (e.key === "ArrowRight") {
    setIntensity(manualIntensity + 0.1);
  } else if (e.key === "ArrowLeft") {
    setIntensity(manualIntensity - 0.1);
  } else if (e.key === " ") {
    e.preventDefault();
    enableMic();
  }
});

let latestState: VJState = {
  sceneIndex,
  intensity: manualIntensity,
  audio: { volume: 0, bass: 0, mid: 0, treble: 0 },
  time: 0,
};

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

  latestState = { sceneIndex, intensity: manualIntensity, audio: scaledLevels, time };
  channel.postMessage(latestState);

  const displayConnected = displayWindow !== null && !displayWindow.closed;
  statusEl.textContent = `投影窓: ${displayConnected ? "接続中" : "未接続"}`;

  hud.textContent = [
    `scene: ${sceneIndex + 1}/${scenes.length} (${scenes[sceneIndex].name})`,
    `mic: ${audio.isEnabled() ? "ON" : "OFF (Spaceで有効化)"}`,
    `intensity: ${manualIntensity.toFixed(1)} (←/→)`,
  ].join("\n");
}

// プレビュー描画は見た目の滑らかさ優先でrAFのまま。操作窓が隠れて一時的に
// 止まっても実害はない(音声解析・投影窓への送信は上記tickが継続する)。
function renderPreview() {
  const scene = scenes[latestState.sceneIndex];

  if (scene.kind === "2d") {
    const width = previewCanvas.clientWidth;
    const height = previewCanvas.clientHeight;
    scene.render({
      ctx: previewCtx,
      width,
      height,
      time: latestState.time,
      audio: latestState.audio,
    });
  } else {
    const width = previewGlCanvas.clientWidth;
    const height = previewGlCanvas.clientHeight;
    scene.render({
      renderer,
      width,
      height,
      time: latestState.time,
      audio: latestState.audio,
    });
  }

  requestAnimationFrame(renderPreview);
}

renderPreview();
