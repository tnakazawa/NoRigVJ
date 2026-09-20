import type { AudioLevels } from "../../audio";
import type { WebGLRenderer } from "three";

/** メイン/サブの2色からなるカラーパレット。 */
export interface Palette {
  /** 16進カラーコード 例: "#ff00ff" */
  main: string;
  /** 16進カラーコード */
  sub: string;
}

/** シーンの `render()` に渡されるレンダリングコンテキスト。全シーンWebGL(three.js)で描画する。 */
export interface SceneContext {
  width: number;
  height: number;
  /** 経過秒数 */
  time: number;
  audio: AudioLevels;
  palette: Palette;
  /**
   * FXパッド([specs/015-fx-pad.md](../../../specs/015-fx-pad.md)参照)の現在位置(共に-1〜1、
   * 中心が(0,0))。パッドを押している間は押している座標(左上(-1,-1)、右下(1,1)に正規化)、
   * 離れている間は共に0(中心と同じ、未操作状態)になる。値の符号がそのままエフェクトの向き
   * (正方向/負方向)を表せるようにしている。音声解析結果ではなくUI操作由来のため
   * `AudioLevels` には含めない。
   */
  padX: number;
  padY: number;
  renderer: WebGLRenderer;
}

/** WebGL(three.js)で描画するシーン。 */
export interface Scene {
  name: string;
  /** true の場合、投影窓のパレット設定(メイン/サブ2色)が render() の palette に渡り、UI上でも編集できる */
  supportsPalette: boolean;
  /** true の場合、FXパッド(padX/padY)に対応した演出を持つ。省略時はfalse扱い */
  padSupported?: boolean;
  /** シェーダーコンパイル・RenderTarget確保など、シーンごとに初回のみ呼ばれる */
  init?(ctx: SceneContext): void;
  render(ctx: SceneContext): void;
}

/** ページ(操作UI/投影窓)ごとに独立したシーンインスタンスを作るための生成関数 */
export type SceneFactory = () => Scene;
