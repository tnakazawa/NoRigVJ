import type { AudioLevels } from "../../audio";
import type { WebGLRenderer } from "three";

export interface SceneContextBase {
  width: number;
  height: number;
  time: number; // 秒
  audio: AudioLevels;
}

export interface SceneContext2D extends SceneContextBase {
  ctx: CanvasRenderingContext2D;
}

export interface SceneContextWebGL extends SceneContextBase {
  renderer: WebGLRenderer;
}

export interface Scene2D {
  kind: "2d";
  name: string;
  render(ctx: SceneContext2D): void;
}

export interface SceneWebGL {
  kind: "webgl";
  name: string;
  /** シェーダーコンパイル・RenderTarget確保など、シーンごとに初回のみ呼ばれる */
  init?(ctx: SceneContextWebGL): void;
  render(ctx: SceneContextWebGL): void;
}

export type Scene = Scene2D | SceneWebGL;

/** ページ(操作UI/投影窓)ごとに独立したシーンインスタンスを作るための生成関数 */
export type SceneFactory = () => Scene;
