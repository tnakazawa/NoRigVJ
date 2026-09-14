import type { Palette } from "./scenes/_shared/types";

/** 投影窓の「シーン + カラーパレット」の組み合わせをユーザーが名前付きで保存したもの。 */
export interface ScenePreset {
  id: string;
  name: string;
  /** sceneIndexではなくシーン名で識別する。シーンファイルの追加・並び替えで
   * 既存プリセットが別のシーンを指してしまう事故を避けるため。 */
  sceneName: string;
  palette: Palette;
}

const STORAGE_KEY = "norigvj-scene-presets";

/** @returns `localStorage` に保存されている全プリセット。壊れているか未保存なら空配列。 */
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

/**
 * 新規プリセットを作成し `localStorage` に保存する。
 * @param name プリセット名
 * @param sceneName 保存対象シーンの名前(`sceneIndex` ではない)
 * @param palette 保存対象のカラーパレット(値はコピーされる)
 * @returns 生成されたプリセット(id発行済み)
 */
export function savePreset(name: string, sceneName: string, palette: Palette): ScenePreset {
  const presets = loadPresets();
  const preset: ScenePreset = { id: crypto.randomUUID(), name, sceneName, palette: { ...palette } };
  presets.push(preset);
  persist(presets);
  return preset;
}

/** @param id 削除するプリセットのid */
export function deletePreset(id: string): void {
  const presets = loadPresets().filter((p) => p.id !== id);
  persist(presets);
}
