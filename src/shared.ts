import type { AudioLevels } from "./audio";
import type { Palette } from "./scenes/_shared/types";

export const CHANNEL_NAME = "norigvj-vj-state";

export interface CrossfadeInstruction {
  /** クロスフェードの発生ごとに一意。投影窓側はこのidが変わったときだけ新規に開始する
   * (毎tickで同じ内容を送り続けても、投影窓が二重に開始しないようにするため)。 */
  id: string;
  toSceneName: string;
  toPalette: Palette;
  durationMs: number;
}

export interface VJState {
  /** 投影窓ごとに独立したシーンを選べるよう、windowId -> sceneIndex で保持する */
  sceneIndexByWindow: Record<string, number>;
  /** 投影窓ごとに独立したカラーパレットを選べるよう、windowId -> Palette で保持する */
  paletteByWindow: Record<string, Palette>;
  /** 実行中のクロスフェードがある投影窓だけキーを持つ(実行していなければ undefined) */
  crossfadeByWindow: Record<string, CrossfadeInstruction | undefined>;
  intensity: number;
  audio: AudioLevels;
  time: number;
}
