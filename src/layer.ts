import * as THREE from "three";
import type { AudioLevels } from "./audio";
import { sceneFactories, type Palette, type Scene } from "./scenes";

/**
 * 「今表示している1シーン分」の描画一式。シーン切替(クロスフェードの有無を問わず)は
 * 常に新しいレイヤーを生成し、完了後に古いレイヤーを破棄する。同じシーンを再度選んでも
 * 新しいインスタンスになるため、WebGLシーンの蓄積状態(RenderTargetの中身など)は
 * 都度リセットされる。これは意図した割り切りで、詳細は
 * specs/006-scene-crossfade.md の実装メモを参照。
 */
export interface Layer {
  sceneIndex: number;
  palette: Palette;
  scene: Scene;
  /** 2枚のcanvasをまとめて配置・アニメーションさせるための親要素(クロスフェード時のopacity制御に使う) */
  wrapEl: HTMLElement;
  canvas2d: HTMLCanvasElement;
  ctx2d: CanvasRenderingContext2D;
  canvasGl: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
}

export function createLayer(sceneIndex: number, palette: Palette): Layer {
  const wrapEl = document.createElement("div");
  wrapEl.style.position = "absolute";
  wrapEl.style.inset = "0";

  const canvas2d = document.createElement("canvas");
  const canvasGl = document.createElement("canvas");
  for (const c of [canvas2d, canvasGl]) {
    c.style.position = "absolute";
    c.style.inset = "0";
    c.style.width = "100%";
    c.style.height = "100%";
    c.style.display = "block";
  }
  wrapEl.append(canvas2d, canvasGl);

  const ctx2d = canvas2d.getContext("2d")!;
  const renderer = new THREE.WebGLRenderer({ canvas: canvasGl, antialias: true });

  const scene = sceneFactories[sceneIndex]();
  if (scene.kind === "webgl" && scene.init) {
    scene.init({
      renderer,
      width: 1,
      height: 1,
      time: 0,
      audio: { volume: 0, bass: 0, mid: 0, treble: 0 },
      palette,
    });
  }

  const layer: Layer = { sceneIndex, palette, scene, wrapEl, canvas2d, ctx2d, canvasGl, renderer };
  updateLayerVisibility(layer);
  return layer;
}

export function updateLayerVisibility(layer: Layer) {
  const isWebGL = layer.scene.kind === "webgl";
  layer.canvas2d.style.display = isWebGL ? "none" : "block";
  layer.canvasGl.style.display = isWebGL ? "block" : "none";
}

export function resizeLayer(layer: Layer, width: number, height: number) {
  const dpr = window.devicePixelRatio;
  layer.canvas2d.width = Math.max(1, width * dpr);
  layer.canvas2d.height = Math.max(1, height * dpr);
  layer.ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  layer.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
}

export function renderLayer(layer: Layer, width: number, height: number, time: number, audio: AudioLevels) {
  if (layer.scene.kind === "2d") {
    layer.scene.render({ ctx: layer.ctx2d, width, height, time, audio, palette: layer.palette });
  } else {
    layer.scene.render({ renderer: layer.renderer, width, height, time, audio, palette: layer.palette });
  }
}

export function disposeLayer(layer: Layer) {
  layer.renderer.dispose();
  layer.wrapEl.remove();
}
