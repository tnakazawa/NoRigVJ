import { lerpColor } from "./_shared/color-utils";
import type { Scene2D, SceneFactory } from "./_shared/types";

/** 音量に反応する同心円のシーン。カラーパレット対応。 */
const createPulseRingsScene: SceneFactory = () => {
  const scene: Scene2D = {
    kind: "2d",
    name: "Pulse Rings",
    supportsPalette: true,
    render({ ctx, width, height, time, audio, palette }) {
      // 音声反応が敏感すぎたため、1.2で割って落ち着かせる
      const bass = audio.bass / 1.2;
      const volume = audio.volume / 1.2;
      const treble = audio.treble / 1.2;

      ctx.fillStyle = `rgba(0,0,0,${0.15 + treble * 0.1})`;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      // 真円を保つため、常に width/height の小さい方を基準に半径を計算する
      const baseR = Math.min(width, height) * 0.15;
      const ringCount = 5;

      for (let i = 0; i < ringCount; i++) {
        const t = time * 0.6 + i * 0.4;
        const r = baseR + (i * 40 + bass * 260) * (0.6 + 0.4 * Math.sin(t));
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
        ctx.strokeStyle = lerpColor(palette.main, palette.sub, i / (ringCount - 1));
        ctx.lineWidth = 2 + volume * 10;
        ctx.stroke();
      }
    },
  };
  return scene;
};

export default createPulseRingsScene;
