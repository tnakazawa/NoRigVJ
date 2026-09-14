import type { Palette } from "./scenes/_shared/types";

export interface ScenePreset {
  id: string;
  name: string;
  /** sceneIndexではなくシーン名で識別する。シーンファイルの追加・並び替えで
   * 既存プリセットが別のシーンを指してしまう事故を避けるため。 */
  sceneName: string;
  palette: Palette;
}

const STORAGE_KEY = "norigvj-scene-presets";

export function loadPresets(): ScenePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(presets: ScenePreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (err) {
    console.error("プリセットの保存に失敗しました", err);
  }
}

export function savePreset(name: string, sceneName: string, palette: Palette): ScenePreset {
  const presets = loadPresets();
  const preset: ScenePreset = { id: crypto.randomUUID(), name, sceneName, palette: { ...palette } };
  presets.push(preset);
  persist(presets);
  return preset;
}

export function deletePreset(id: string): void {
  const presets = loadPresets().filter((p) => p.id !== id);
  persist(presets);
}
