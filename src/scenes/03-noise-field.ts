import { hsl } from "./_shared/color-utils";
import type { Scene2D, SceneFactory } from "./_shared/types";

// 高域で散らばるパーティクル風ノイズ
const createNoiseFieldScene: SceneFactory = () => {
  const scene: Scene2D = {
    kind: "2d",
    name: "Noise Field",
    render({ ctx, width, height, time, audio }) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, 0, width, height);

      const count = 60 + Math.floor(audio.treble * 200);
      for (let i = 0; i < count; i++) {
        const a = i * 12.9898 + time * 3.7;
        const x = (Math.sin(a) * 0.5 + 0.5) * width;
        const y = (Math.cos(a * 1.3) * 0.5 + 0.5) * height;
        const r = 1 + audio.volume * 6;
        ctx.fillStyle = hsl((a * 40) % 360, 90, 60);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
  return scene;
};

export default createNoiseFieldScene;
