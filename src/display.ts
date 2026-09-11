import { scenes } from "./scenes";
import { CHANNEL_NAME, type VJState } from "./shared";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

let latest: VJState | null = null;

function resize() {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
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
};

function loop() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (latest) {
    const scene = scenes[latest.sceneIndex] ?? scenes[0];
    scene.render({ ctx, width, height, time: latest.time, audio: latest.audio });
  }

  requestAnimationFrame(loop);
}

loop();
