import { hsl } from "./_shared/color-utils";
import type { Scene2D, SceneFactory } from "./_shared/types";

// 音量に反応する同心円
const createPulseRingsScene: SceneFactory = () => {
  const scene: Scene2D = {
    kind: "2d",
    name: "Pulse Rings",
    render({ ctx, width, height, time, audio }) {
      ctx.fillStyle = `rgba(0,0,0,${0.15 + audio.treble * 0.1})`;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const baseR = Math.min(width, height) * 0.15;
      const ringCount = 5;

      for (let i = 0; i < ringCount; i++) {
        const t = time * 0.6 + i * 0.4;
        const r = baseR + (i * 40 + audio.bass * 260) * (0.6 + 0.4 * Math.sin(t));
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
        ctx.strokeStyle = hsl(time * 40 + i * 60, 90, 55 + audio.mid * 20);
        ctx.lineWidth = 2 + audio.volume * 10;
        ctx.stroke();
      }
    },
  };
  return scene;
};

export default createPulseRingsScene;
