import type { AudioLevels } from "./audio";
import type { Palette } from "./scenes/_shared/types";

/** 操作UIと投影窓が状態同期に使う `BroadcastChannel` の名前。 */
export const CHANNEL_NAME = "norigvj-vj-state";

/** `tick()` を駆動する間隔(ミリ秒、[tick-worker.ts](tick-worker.ts)と同じ値)。crossfade.tsが
 * 「durationMsが0のクロスフェードでも、tick()に最低1回は状態を観測させる」ために参照する。 */
export const TICK_INTERVAL_MS = 33;

/** 投影窓へ「クロスフェードを実行せよ」と伝える指示。 */
export interface CrossfadeInstruction {
  /** クロスフェードの発生ごとに一意。投影窓側はこのidが変わったときだけ新規に開始する
   * (毎tickで同じ内容を送り続けても、投影窓が二重に開始しないようにするため)。 */
  id: string;
  /** 遷移先シーンの名前(`sceneIndex` ではない) */
  toSceneName: string;
  /** 遷移先のカラーパレット */
  toPalette: Palette;
  /** トランジションの所要時間(ミリ秒) */
  durationMs: number;
}

/** FXパッド([specs/015-fx-pad.md](../specs/015-fx-pad.md)参照)の現在位置。全投影窓共通で、
 * 投影窓ごとの区別はない。共に-1〜1、中心が(0,0)。押している間の座標(左上(-1,-1)、右下(1,1)に
 * 正規化)、離れている間は共に0(中心と同じ、未操作状態)。 */
export interface PadState {
  x: number;
  y: number;
}

/** 操作UIから投影窓へ `BroadcastChannel` 経由で毎tick送信される状態。 */
export interface VJState {
  /** 投影窓ごとに独立したシーンを選べるよう、windowId -> sceneIndex で保持する */
  sceneIndexByWindow: Record<string, number>;
  /** 投影窓ごとに独立したカラーパレットを選べるよう、windowId -> Palette で保持する */
  paletteByWindow: Record<string, Palette>;
  /** 実行中のクロスフェードがある投影窓だけキーを持つ(実行していなければ undefined) */
  crossfadeByWindow: Record<string, CrossfadeInstruction | undefined>;
  /** FXパッドの現在位置(共に-1〜1、中心(0,0)、未操作時は共に0) */
  pad: PadState;
  intensity: number;
  audio: AudioLevels;
  time: number;
}
