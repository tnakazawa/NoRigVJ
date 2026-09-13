import type { SceneFactory } from "./_shared/types";

// このディレクトリ直下(サブディレクトリ除く)の *.ts をシーンファイルとしてビルド時に自動収集する。
// ファイル名の連番プレフィックス(01-, 02-, ...)で並び順・キー割当(1, 2, 3...)が決まる。
// 新しいシーンを追加したい場合は、ここに手動登録する必要はなく、
// `NN-scene-name.ts` として default export で SceneFactory を返すファイルを置くだけでよい。
const modules = import.meta.glob<{ default: SceneFactory }>("./*.ts", { eager: true });

export const sceneFactories: SceneFactory[] = Object.keys(modules)
  .filter((path) => path !== "./index.ts")
  .sort()
  .map((path) => modules[path].default);

export type { Scene, Scene2D, SceneWebGL, SceneContext2D, SceneContextWebGL } from "./_shared/types";
