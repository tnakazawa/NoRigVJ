import { hexToRgb } from "./_shared/color-utils";
import type { Scene2D, SceneFactory } from "./_shared/types";

/** 高域で散らばるパーティクル風ノイズのシーン。カラーパレット対応。手動トリガー3種対応。 */
const createNoiseFieldScene: SceneFactory = () => {
  // Trigger 2(Freeze)発生中、パーティクル位置の計算に使う時間を固定するための開始時刻
  let frozenAtTime: number | null = null;

  const scene: Scene2D = {
    kind: "2d",
    name: "Noise Field",
    supportsPalette: true,
    triggerEffectNames: ["Radial Push", "Freeze", "Color Flash"],
    render({ ctx, width, height, time, audio, palette, triggers }) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, 0, width, height);

      // 音声反応が鈍かったため、1.5倍(1.2倍→さらに1.25倍)敏感にする
      const volume = audio.volume * 1.5;
      const treble = audio.treble * 1.5;

      // Trigger 2(Freeze): 発生中はパーティクル位置の計算に使う時間経過を止める
      if (triggers[1] > 0.01) {
        if (frozenAtTime === null) frozenAtTime = time;
      } else {
        frozenAtTime = null;
      }
      const effectiveTime = frozenAtTime ?? time;

      const cx = width / 2;
      const cy = height / 2;
      // パーティクルサイズは画面サイズ(小さい方の辺)を基準にスケールする
      const baseSize = Math.min(width, height) * 0.006;
      const count = 150 + Math.floor(treble * 300);
      for (let i = 0; i < count; i++) {
        // 動きをさらに遅くしている
        const a = i * 12.9898 + effectiveTime * 0.7;
        let x = (Math.sin(a) * 0.5 + 0.5) * width;
        let y = (Math.cos(a * 1.3) * 0.5 + 0.5) * height;

        // Trigger 1(Radial Push): 発生中は中心から放射方向に一瞬押し出す
        if (triggers[0] > 0.01) {
          const dx = x - cx, dy = y - cy;
          const len = Math.hypot(dx, dy) || 1;
          const push = triggers[0] * Math.min(width, height) * 0.15;
          x += (dx / len) * push;
          y += (dy / len) * push;
        }

        const r = baseSize * (1 + volume * 3) * (1 + triggers[0] * 0.8);
        // パーティクルごとに固定の疑似乱数(iベース)でメイン/サブ間を補間する。
        // time を使わないことで、色自体が時間で変化しないようにしている。
        const t = Math.sin(i * 7.3) * 0.5 + 0.5;
        const [mr, mg, mb] = hexToRgb(palette.main);
        const [sr, sg, sb] = hexToRgb(palette.sub);
        // Trigger 3(Color Flash): 発生中はパレット補間結果をさらに白へ寄せる
        const flash = triggers[2];
        const cr = Math.round((mr + (sr - mr) * t + (1 - (mr + (sr - mr) * t)) * flash) * 255);
        const cg = Math.round((mg + (sg - mg) * t + (1 - (mg + (sg - mg) * t)) * flash) * 255);
        const cb = Math.round((mb + (sb - mb) * t + (1 - (mb + (sb - mb) * t)) * flash) * 255);
        ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
  return scene;
};

export default createNoiseFieldScene;
