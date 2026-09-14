import { lerpColor } from "./_shared/color-utils";
import type { Scene2D, SceneFactory } from "./_shared/types";

/** 高域で散らばるパーティクル風ノイズのシーン。カラーパレット対応。 */
const createNoiseFieldScene: SceneFactory = () => {
  const scene: Scene2D = {
    kind: "2d",
    name: "Noise Field",
    supportsPalette: true,
    render({ ctx, width, height, time, audio, palette }) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, 0, width, height);

      // 音声反応が鈍かったため、1.5倍(1.2倍→さらに1.25倍)敏感にする
      const volume = audio.volume * 1.5;
      const treble = audio.treble * 1.5;

      // パーティクルサイズは画面サイズ(小さい方の辺)を基準にスケールする
      const baseSize = Math.min(width, height) * 0.006;
      const count = 150 + Math.floor(treble * 300);
      const cx = width / 2;
      const cy = height / 2;
      for (let i = 0; i < count; i++) {
        // 動きをさらに遅くしている
        const a = i * 12.9898 + time * 0.7;
        let x = (Math.sin(a) * 0.5 + 0.5) * width;
        let y = (Math.cos(a * 1.3) * 0.5 + 0.5) * height;

        // ビート発生時、中心から放射方向に一瞬押し出して拡散させる
        if (audio.beatPulse > 0.01) {
          const dx = x - cx, dy = y - cy;
          const len = Math.hypot(dx, dy) || 1;
          const push = audio.beatPulse * Math.min(width, height) * 0.15;
          x += (dx / len) * push;
          y += (dy / len) * push;
        }

        const r = baseSize * (1 + volume * 3) * (1 + audio.beatPulse * 0.8);
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
