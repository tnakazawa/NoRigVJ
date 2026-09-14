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

// シーン名 → sceneFactories のインデックス。クロスフェードやプリセットは sceneIndex ではなく
// シーン名で遷移先を指定するため、都度これで引く(使い捨てインスタンスを1つ作ってnameだけ読む)。
export const sceneNames: string[] = sceneFactories.map((factory) => factory().name);

export type { Scene, Scene2D, SceneWebGL, SceneContext2D, SceneContextWebGL, Palette } from "./_shared/types";
