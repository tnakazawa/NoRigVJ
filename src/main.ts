import { AudioAnalyzer } from "./audio";
import { scenes } from "./scenes";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const hud = document.getElementById("hud")!;

let sceneIndex = 0;
let startTime = performance.now();
let manualIntensity = 1; // ← / → キーで調整

const audio = new AudioAnalyzer();

function resize() {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}
window.addEventListener("resize", resize);
resize();

window.addEventListener("keydown", (e) => {
  if (e.key >= "1" && e.key <= String(scenes.length)) {
    sceneIndex = Number(e.key) - 1;
  } else if (e.key === "ArrowRight") {
    manualIntensity = Math.min(3, manualIntensity + 0.1);
  } else if (e.key === "ArrowLeft") {
    manualIntensity = Math.max(0, manualIntensity - 0.1);
  } else if (e.key === " ") {
    if (!audio.isEnabled()) {
      audio.start().catch((err) => {
        console.error("マイクの取得に失敗しました", err);
      });
    }
  }
});

function loop() {
  const width = window.innerWidth;
  const height = window.innerHeight;
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

  scenes[sceneIndex].render({ ctx, width, height, time, audio: scaledLevels });

  hud.textContent = [
    `scene: ${sceneIndex + 1}/${scenes.length} (${scenes[sceneIndex].name})`,
    `mic: ${audio.isEnabled() ? "ON" : "OFF (Spaceで有効化)"}`,
    `intensity: ${manualIntensity.toFixed(1)} (←/→)`,
    `keys: 1-${scenes.length} でシーン切替`,
  ].join("\n");

  requestAnimationFrame(loop);
}

loop();
