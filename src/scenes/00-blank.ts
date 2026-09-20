import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

/** 何も描画しない空白シーン(WebGL)。暗転・シーン切替の合間に使う。カラーパレット・FXパッドは非対応。 */
const createBlankScene: SceneFactory = () => {
  const scene: Scene = {
    name: "Blank",
    supportsPalette: false,
    init(ctx: SceneContext) {
      ctx.renderer.setClearColor(0x000000, 1);
    },
    render(ctx: SceneContext) {
      ctx.renderer.clear();
    },
  };
  return scene;
};

export default createBlankScene;
