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

      // 音声反応が鈍かったため、1.2倍敏感にする
      const volume = audio.volume * 1.2;
      const treble = audio.treble * 1.2;

      // パーティクルサイズは画面サイズ(小さい方の辺)を基準にスケールする
      const baseSize = Math.min(width, height) * 0.006;
      const count = 150 + Math.floor(treble * 300);
      for (let i = 0; i < count; i++) {
        // 動きを遅くするため time の係数を小さくしている
        const a = i * 12.9898 + time * 1.6;
        const x = (Math.sin(a) * 0.5 + 0.5) * width;
        const y = (Math.cos(a * 1.3) * 0.5 + 0.5) * height;
        const r = baseSize * (1 + volume * 3);
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
