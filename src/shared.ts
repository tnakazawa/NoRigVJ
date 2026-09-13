import type { AudioLevels } from "./audio";
import type { Palette } from "./scenes/_shared/types";

export const CHANNEL_NAME = "norigvj-vj-state";

export interface VJState {
  /** 投影窓ごとに独立したシーンを選べるよう、windowId -> sceneIndex で保持する */
  sceneIndexByWindow: Record<string, number>;
  /** 投影窓ごとに独立したカラーパレットを選べるよう、windowId -> Palette で保持する */
  paletteByWindow: Record<string, Palette>;
  intensity: number;
  audio: AudioLevels;
  time: number;
}
