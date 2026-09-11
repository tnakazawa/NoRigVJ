import { AudioAnalyzer } from "./audio";
import { scenes } from "./scenes";
import { CHANNEL_NAME, type VJState } from "./shared";

const previewCanvas = document.getElementById("preview") as HTMLCanvasElement;
const previewCtx = previewCanvas.getContext("2d")!;
const hud = document.getElementById("hud")!;
const sceneButtonsEl = document.getElementById("scene-buttons")!;
const intensitySlider = document.getElementById("intensity") as HTMLInputElement;
const intensityValueEl = document.getElementById("intensity-value")!;
const micToggleBtn = document.getElementById("mic-toggle") as HTMLButtonElement;
const openDisplayBtn = document.getElementById("open-display") as HTMLButtonElement;
const statusEl = document.getElementById("status")!;

let sceneIndex = 0;
let startTime = performance.now();
let manualIntensity = 1; // ← / → キー、またはスライダーで調整

const audio = new AudioAnalyzer();
const channel = new BroadcastChannel(CHANNEL_NAME);
let displayWindow: Window | null = null;

function resize() {
  previewCanvas.width = previewCanvas.clientWidth * window.devicePixelRatio;
  previewCanvas.height = previewCanvas.clientHeight * window.devicePixelRatio;
  previewCtx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
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

function loop() {
  const width = previewCanvas.clientWidth;
  const height = previewCanvas.clientHeight;
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

  scenes[sceneIndex].render({ ctx: previewCtx, width, height, time, audio: scaledLevels });

  const state: VJState = { sceneIndex, intensity: manualIntensity, audio: scaledLevels, time };
  channel.postMessage(state);

  const displayConnected = displayWindow !== null && !displayWindow.closed;
  statusEl.textContent = `投影窓: ${displayConnected ? "接続中" : "未接続"}`;

  hud.textContent = [
    `scene: ${sceneIndex + 1}/${scenes.length} (${scenes[sceneIndex].name})`,
    `mic: ${audio.isEnabled() ? "ON" : "OFF (Spaceで有効化)"}`,
    `intensity: ${manualIntensity.toFixed(1)} (←/→)`,
  ].join("\n");

  requestAnimationFrame(loop);
}

loop();
