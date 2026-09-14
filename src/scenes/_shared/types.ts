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
   * 手動トリガー(Trigger 1/2/3)それぞれの発生状況。発生時1になり、時間経過で0へ
   * 指数関数的に減衰する。音声解析結果ではなくUI操作由来のため `AudioLevels` には含めない。
   */
  triggers: [number, number, number];
  renderer: WebGLRenderer;
}

/**
 * 手動トリガー(Trigger 1/2/3)にシーンが対応しているかを表す。インデックスがトリガー番号
 * (0 → Trigger 1、1 → Trigger 2、2 → Trigger 3)に対応し、対応する演出があるインデックスにのみ
 * ボタン表示用の短い名前(例: "Ring Burst")を入れる。未対応のインデックスは `undefined` にする。
 * シーン自体が手動トリガーに一切対応しない場合、このプロパティごと省略してよい。
 */
export type TriggerEffectNames = [string | undefined, string | undefined, string | undefined];

/** WebGL(three.js)で描画するシーン。 */
export interface Scene {
  name: string;
  /** true の場合、投影窓のパレット設定(メイン/サブ2色)が render() の palette に渡り、UI上でも編集できる */
  supportsPalette: boolean;
  triggerEffectNames?: TriggerEffectNames;
  /** シェーダーコンパイル・RenderTarget確保など、シーンごとに初回のみ呼ばれる */
  init?(ctx: SceneContext): void;
  render(ctx: SceneContext): void;
}

/** ページ(操作UI/投影窓)ごとに独立したシーンインスタンスを作るための生成関数 */
export type SceneFactory = () => Scene;
