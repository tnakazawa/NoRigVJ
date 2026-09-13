import { hsl } from "./_shared/color-utils";
import type { Scene2D, SceneFactory } from "./_shared/types";

// 低域〜高域でうねるバー。左は低域、右は高域に反応する
const createBarSpectrumScene: SceneFactory = () => {
  const scene: Scene2D = {
    kind: "2d",
    name: "Bar Spectrum",
    supportsPalette: false,
    render({ ctx, width, height, time, audio }) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, width, height);

      const bars = 32;
      const barW = width / bars;
      const baseH = 20;

      for (let i = 0; i < bars; i++) {
        const n = Math.sin(i * 0.5 + time * 2) * 0.5 + 0.5;

        // バーの位置(0=左端/低域 〜 1=右端/高域)に応じて反応する周波数帯を三角形状に切り替える
        const pos = i / (bars - 1);
        const bassWeight = Math.max(0, 1 - pos * 2);
        const trebleWeight = Math.max(0, pos * 2 - 1);
        const midWeight = 1 - bassWeight - trebleWeight;

        // 音声反応が敏感すぎたため1.5で割って落ち着かせつつ、
        // 最大値(1.0)で画面上端まで届くよう高さを baseH〜height にマッピングする
        const level = Math.min(
          1,
          ((audio.bass * bassWeight + audio.mid * midWeight + audio.treble * trebleWeight) * n) / 1.5,
        );
        const h = baseH + level * (height - baseH);
        ctx.fillStyle = hsl(200 + i * 6 + time * 20, 85, 55);
        ctx.fillRect(i * barW, height - h, barW * 0.8, h);
      }
    },
  };
  return scene;
};

export default createBarSpectrumScene;
