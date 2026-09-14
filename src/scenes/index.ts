import type { SceneFactory } from "./_shared/types";

// このディレクトリ直下(サブディレクトリ除く)の *.ts をシーンファイルとしてビルド時に自動収集する。
// ファイル名の連番プレフィックス(01-, 02-, ...)で並び順・キー割当(1, 2, 3...)が決まる。
// 新しいシーンを追加したい場合は、ここに手動登録する必要はなく、
// `NN-scene-name.ts` として default export で SceneFactory を返すファイルを置くだけでよい。
const modules = import.meta.glob<{ default: SceneFactory }>("./*.ts", { eager: true });

/** ビルド時に自動収集された、ファイル名の連番順の全シーンのファクトリ。 */
export const sceneFactories: SceneFactory[] = Object.keys(modules)
  .filter((path) => path !== "./index.ts")
  .sort()
  .map((path) => modules[path].default);

// 起動時に1回だけ使い捨てインスタンスを生成し、name/supportsPaletteを読む。
const sceneInstances = sceneFactories.map((factory) => factory());

// シーン名 → sceneFactories のインデックス。クロスフェードやプリセットは sceneIndex ではなく
// シーン名で遷移先を指定するため、都度これで引く。
export const sceneNames: string[] = sceneInstances.map((scene) => scene.name);

// シーンごとのカラーパレット対応有無。sceneIndexで引き、非対応シーンのパレットUIを無効化するのに使う。
export const sceneSupportsPalette: boolean[] = sceneInstances.map((scene) => scene.supportsPalette);

export type { Scene, SceneContext, Palette } from "./_shared/types";
