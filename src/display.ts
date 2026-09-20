import { startCrossfade } from "./crossfade";
import { createLayer, disposeLayer, renderLayer, resizeLayer, type Layer } from "./layer";
import { DEFAULT_PALETTE } from "./palettes";
import { sceneNames } from "./scenes";
import { CHANNEL_NAME, type VJState } from "./shared";

const windowId = new URLSearchParams(location.search).get("windowId") ?? "";

const stageWrap = document.getElementById("stage-wrap")!;

let currentLayer: Layer = createLayer(0, DEFAULT_PALETTE);
stageWrap.appendChild(currentLayer.wrapEl);
resizeLayer(currentLayer, window.innerWidth, window.innerHeight);

let crossfading: { layer: Layer; instructionId: string } | null = null;
let lastCrossfadeId: string | null = null;

let latest: VJState | null = null;

/** currentLayer・(実行中なら)crossfading.layer をウィンドウサイズに合わせてリサイズする。 */
function resize() {
  resizeLayer(currentLayer, window.innerWidth, window.innerHeight);
  if (crossfading) {
    resizeLayer(crossfading.layer, window.innerWidth, window.innerHeight);
  }
}
window.addEventListener("resize", resize);

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

  const instruction = latest.crossfadeByWindow[windowId];
  if (instruction && instruction.id !== lastCrossfadeId && !crossfading) {
    lastCrossfadeId = instruction.id;
    const toSceneIndex = sceneNames.indexOf(instruction.toSceneName);
    if (toSceneIndex === -1) {
      console.warn(`Crossfade target scene "${instruction.toSceneName}" not found`);
      return;
    }
    const toLayer = createLayer(toSceneIndex, instruction.toPalette);
    crossfading = { layer: toLayer, instructionId: instruction.id };
    startCrossfade(
      stageWrap,
      currentLayer,
      toLayer,
      window.innerWidth,
      window.innerHeight,
      instruction.durationMs,
      (finishedLayer) => {
        currentLayer = finishedLayer;
        crossfading = null;
      },
    );
  }
};

/** 毎フレーム、現在のレイヤー(と実行中ならクロスフェード先のレイヤー)を描画する。 */
function loop() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (latest) {
    renderLayer(currentLayer, width, height, latest.time, latest.audio, latest.pad.x, latest.pad.y);
    if (crossfading) {
      renderLayer(crossfading.layer, width, height, latest.time, latest.audio, latest.pad.x, latest.pad.y);
    }
  }

  requestAnimationFrame(loop);
}

loop();

window.addEventListener("beforeunload", () => {
  disposeLayer(currentLayer);
  if (crossfading) disposeLayer(crossfading.layer);
});
