import { lerpColor } from "./_shared/color-utils";
import type { Scene2D, SceneFactory } from "./_shared/types";

// 高域で散らばるパーティクル風ノイズ
const createNoiseFieldScene: SceneFactory = () => {
  const scene: Scene2D = {
    kind: "2d",
    name: "Noise Field",
    supportsPalette: true,
    render({ ctx, width, height, time, audio, palette }) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, 0, width, height);

      const count = 60 + Math.floor(audio.treble * 200);
      for (let i = 0; i < count; i++) {
        const a = i * 12.9898 + time * 3.7;
        const x = (Math.sin(a) * 0.5 + 0.5) * width;
        const y = (Math.cos(a * 1.3) * 0.5 + 0.5) * height;
        const r = 1 + audio.volume * 6;
        // パーティクルごとに固定の疑似乱数(iベース)でメイン/サブ間を補間する。
        // time を使わないことで、色自体が時間で変化しないようにしている。
        const t = Math.sin(i * 7.3) * 0.5 + 0.5;
        ctx.fillStyle = lerpColor(palette.main, palette.sub, t);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
  return scene;
};

export default createNoiseFieldScene;
