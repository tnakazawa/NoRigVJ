import type { AudioLevels } from "./audio";

export const CHANNEL_NAME = "norigvj-vj-state";

export interface VJState {
  sceneIndex: number;
  intensity: number;
  audio: AudioLevels;
  time: number;
}
