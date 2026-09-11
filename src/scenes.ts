import type { AudioLevels } from "./audio";

export interface SceneContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number; // 秒
  audio: AudioLevels;
}

export interface Scene {
  name: string;
  render(c: SceneContext): void;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h % 360}, ${s}%, ${l}%)`;
}

// 1: 音量に反応する同心円
const pulseRings: Scene = {
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

// 2: 低域でうねるバー
const barSpectrum: Scene = {
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

// 3: 高域で散らばるパーティクル風ノイズ
const noiseField: Scene = {
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

export const scenes: Scene[] = [pulseRings, barSpectrum, noiseField];
