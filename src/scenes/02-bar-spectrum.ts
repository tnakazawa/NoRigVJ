import { hsl } from "./_shared/color-utils";
import type { Scene2D, SceneFactory } from "./_shared/types";

// 低域でうねるバー
const createBarSpectrumScene: SceneFactory = () => {
  const scene: Scene2D = {
    kind: "2d",
    name: "Bar Spectrum",
    render({ ctx, width, height, time, audio }) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, width, height);

      const bars = 32;
      const barW = width / bars;
      for (let i = 0; i < bars; i++) {
        const n = Math.sin(i * 0.5 + time * 2) * 0.5 + 0.5;
        const level = (audio.bass * 0.5 + audio.mid * 0.3 + audio.treble * 0.2) * n;
        const h = 20 + level * height * 0.8;
        ctx.fillStyle = hsl(200 + i * 6 + time * 20, 85, 55);
        ctx.fillRect(i * barW, height - h, barW * 0.8, h);
      }
    },
  };
  return scene;
};

export default createBarSpectrumScene;
