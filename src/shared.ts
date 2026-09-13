import type { AudioLevels } from "./audio";

export const CHANNEL_NAME = "norigvj-vj-state";

export interface VJState {
  /** 投影窓ごとに独立したシーンを選べるよう、windowId -> sceneIndex で保持する */
  sceneIndexByWindow: Record<string, number>;
  intensity: number;
  audio: AudioLevels;
  time: number;
}
