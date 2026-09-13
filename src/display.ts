import * as THREE from "three";
import { sceneFactories, type Scene } from "./scenes";
import { CHANNEL_NAME, type VJState } from "./shared";

const windowId = new URLSearchParams(location.search).get("windowId") ?? "";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const glCanvas = document.getElementById("stage-gl") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });

// 投影窓専用のシーンインスタンス群。操作UI側のプレビューとは別インスタンスを持つ
// (WebGLシーンはRenderTargetなどの状態をインスタンスごとに抱えるため)。
const scenes: Scene[] = sceneFactories.map((factory) => factory());
scenes.forEach((scene) => {
  if (scene.kind === "webgl" && scene.init) {
    scene.init({
      renderer,
      width: window.innerWidth,
      height: window.innerHeight,
      time: 0,
      audio: { volume: 0, bass: 0, mid: 0, treble: 0 },
    });
  }
});

let latest: VJState | null = null;

function currentSceneIndex(): number {
  return latest?.sceneIndexByWindow[windowId] ?? 0;
}

function updateCanvasVisibility() {
  const isWebGL = latest ? scenes[currentSceneIndex()]?.kind === "webgl" : false;
  canvas.style.display = isWebGL ? "none" : "block";
  glCanvas.style.display = isWebGL ? "block" : "none";
}

function resize() {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}
window.addEventListener("resize", resize);
resize();

window.addEventListener("keydown", (e) => {
  if (e.key === "f" || e.key === "F") {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }
});

const channel = new BroadcastChannel(CHANNEL_NAME);
channel.onmessage = (e: MessageEvent<VJState>) => {
  latest = e.data;
  updateCanvasVisibility();
};

function loop() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (latest) {
    const scene = scenes[currentSceneIndex()] ?? scenes[0];
    if (scene.kind === "2d") {
      scene.render({ ctx, width, height, time: latest.time, audio: latest.audio });
    } else {
      scene.render({ renderer, width, height, time: latest.time, audio: latest.audio });
    }
  }

  requestAnimationFrame(loop);
}

loop();
