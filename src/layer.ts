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
  /** クロスフェード時のopacity制御に使う親要素(canvasを1枚だけラップする) */
  wrapEl: HTMLElement;
  canvasGl: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
}

/**
 * 新しいレイヤーを生成する。`sceneFactories` から毎回新規にシーンインスタンスを作るため、
 * 同じ `sceneIndex` を渡しても前回までの状態(WebGLシーンのRenderTargetの中身など)は引き継がれない。
 * @param sceneIndex `sceneFactories` のインデックス
 * @param palette このレイヤーが使うカラーパレット
 * @returns DOMにはまだ追加されていない、初期化済みのレイヤー
 */
export function createLayer(sceneIndex: number, palette: Palette): Layer {
  const wrapEl = document.createElement("div");
  wrapEl.style.position = "absolute";
  wrapEl.style.inset = "0";

  const canvasGl = document.createElement("canvas");
  canvasGl.style.position = "absolute";
  canvasGl.style.inset = "0";
  canvasGl.style.width = "100%";
  canvasGl.style.height = "100%";
  canvasGl.style.display = "block";
  wrapEl.append(canvasGl);

  const renderer = new THREE.WebGLRenderer({ canvas: canvasGl, antialias: true });

  const scene = sceneFactories[sceneIndex]();
  if (scene.init) {
    scene.init({
      renderer,
      width: 1,
      height: 1,
      time: 0,
      audio: { volume: 0, bass: 0, mid: 0, treble: 0 },
      palette,
      triggers: [0, 0, 0],
    });
  }

  return { sceneIndex, palette, scene, wrapEl, canvasGl, renderer };
}

/** WebGLレンダラーの出力サイズを、指定サイズ(devicePixelRatio込み)に合わせる。 */
export function resizeLayer(layer: Layer, width: number, height: number) {
  layer.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
}

/** レイヤーのシーンを1フレーム分描画する。 */
export function renderLayer(
  layer: Layer,
  width: number,
  height: number,
  time: number,
  audio: AudioLevels,
  triggers: [number, number, number],
) {
  layer.scene.render({ renderer: layer.renderer, width, height, time, audio, palette: layer.palette, triggers });
}

/** レイヤーが保持するWebGLリソースを解放し、DOMから取り除く。 */
export function disposeLayer(layer: Layer) {
  layer.renderer.dispose();
  layer.wrapEl.remove();
}
