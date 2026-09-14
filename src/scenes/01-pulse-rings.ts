import { lerpColor } from "./_shared/color-utils";
import type { Scene2D, SceneFactory } from "./_shared/types";

/** 音量に反応する同心円のシーン。カラーパレット対応。手動トリガー3種対応。 */
const createPulseRingsScene: SceneFactory = () => {
  // Trigger 1(Ring Burst)で生成し、外側へ弾けながらフェードアウトするリング
  let burstRings: { born: number }[] = [];
  let lastTrigger0 = 0;

  const scene: Scene2D = {
    kind: "2d",
    name: "Pulse Rings",
    supportsPalette: true,
    triggerEffectNames: ["Ring Burst", "Color Flip", "Radius Kick"],
    render({ ctx, width, height, time, audio, palette, triggers }) {
      // 音声反応が敏感すぎたため、1.2で割って落ち着かせる
      const bass = audio.bass / 1.2;
      const volume = audio.volume / 1.2;
      const treble = audio.treble / 1.2;

      // Trigger 1の立ち上がり(発生の瞬間)を捉えてリングを1本追加する
      if (triggers[0] > 0.9 && lastTrigger0 <= 0.9) {
        burstRings.push({ born: time });
      }
      lastTrigger0 = triggers[0];

      ctx.fillStyle = `rgba(0,0,0,${0.15 + treble * 0.1})`;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      // 真円を保つため、常に width/height の小さい方を基準に半径を計算する
      const baseR = Math.min(width, height) * 0.15;
      const ringCount = 5;

      // Trigger 2(Color Flip): 発生中はメイン/サブの補間方向を反転させ、配色を一瞬入れ替える
      const flip = triggers[1] > 0.5;
      // Trigger 3(Radius Kick): 発生中は全リングの半径に一時的なオフセットを加える
      const radiusKick = triggers[2] * baseR * 0.8;

      for (let i = 0; i < ringCount; i++) {
        const t = time * 0.6 + i * 0.4;
        const r = baseR + radiusKick + (i * 40 + bass * 260) * (0.6 + 0.4 * Math.sin(t));
        const colorT = flip ? 1 - i / (ringCount - 1) : i / (ringCount - 1);
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
        ctx.strokeStyle = lerpColor(palette.main, palette.sub, colorT);
        ctx.lineWidth = 2 + volume * 10;
        ctx.stroke();
      }

      const burstRingLifetime = 1.2;
      burstRings = burstRings.filter((ring) => time - ring.born < burstRingLifetime);
      for (const ring of burstRings) {
        const age = time - ring.born;
        const r = baseR + age * 500;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
        ctx.strokeStyle = lerpColor(palette.sub, palette.main, age / burstRingLifetime);
        ctx.globalAlpha = 1 - age / burstRingLifetime;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    },
  };
  return scene;
};

export default createPulseRingsScene;
