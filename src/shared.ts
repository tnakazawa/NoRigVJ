import type { AudioLevels } from "./audio";
import type { Palette } from "./scenes/_shared/types";

/** 操作UIと投影窓が状態同期に使う `BroadcastChannel` の名前。 */
export const CHANNEL_NAME = "norigvj-vj-state";

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

/** 手動トリガー(Trigger 1/2/3)の発生を投影窓へ伝える指示。全投影窓共通で、投影窓ごとの区別はない。 */
export interface TriggerInstruction {
  /** 発生ごとに一意。投影窓側はこのidが変わったときだけ新規に発生したとみなす
   * (毎tickで同じ内容を送り続けても、投影窓が二重に開始しないようにするため)。 */
  id: string;
  /** どのトリガーが発生したか(0 → Trigger 1、1 → Trigger 2、2 → Trigger 3) */
  index: 0 | 1 | 2;
}

/** 操作UIから投影窓へ `BroadcastChannel` 経由で毎tick送信される状態。 */
export interface VJState {
  /** 投影窓ごとに独立したシーンを選べるよう、windowId -> sceneIndex で保持する */
  sceneIndexByWindow: Record<string, number>;
  /** 投影窓ごとに独立したカラーパレットを選べるよう、windowId -> Palette で保持する */
  paletteByWindow: Record<string, Palette>;
  /** 実行中のクロスフェードがある投影窓だけキーを持つ(実行していなければ undefined) */
  crossfadeByWindow: Record<string, CrossfadeInstruction | undefined>;
  /** 直近に発生した手動トリガー。一度も発生していなければ null */
  trigger: TriggerInstruction | null;
  intensity: number;
  audio: AudioLevels;
  time: number;
}
