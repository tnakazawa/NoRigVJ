import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

/** 黒ベタが多く寂しかったため、既存の3倍(4→12)に増やした */
const BOLT_COUNT = 12;
const SEGMENTS = 14;
/** 1本の稲妻が発生してから消えるまでの周期(秒)。boltごとに位相をずらして常にどれかが明滅するようにする */
const CYCLE_DURATION = 1.3;
/** 稲妻が実際に見えている時間(秒)。発生直後だけ光り、すぐ消える */
const VISIBLE_DURATION = 0.14;
/** 線の太さ(ピクセル単位)。THREE.LineBasicMaterialのlinewidthはほとんどのbrowserで1に固定される
 * 既知の制限があるため、太さを指定できるFat Lines(three/examples/jsm/lines/*)を使っている。 */
const LINE_WIDTH_PX = 3.5;

function hash(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * 稲妻状のジグザグ線が明滅するシーン(WebGL)。カラーパレット対応。
 * Lissajous Linesと同じ線画カテゴリだが、滑らかな曲線ではなく瞬間的なジグザグの明滅という質の違いで
 * 差別化している。FXパッド対応。
 */
const createLightningArcsScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  const bolts: Line2[] = [];
  const boltMaterials: LineMaterial[] = [];
  const boltPositions: Float32Array[] = [];

  const scene: Scene = {
    name: "Lightning Arcs",
    supportsPalette: true,
    padSupported: true,
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
      camera.position.z = 1;

      for (let b = 0; b < BOLT_COUNT; b++) {
        const geometry = new LineGeometry();
        const positions = new Float32Array(SEGMENTS * 3);
        geometry.setPositions(positions);
        const material = new LineMaterial({ transparent: true, opacity: 0, linewidth: LINE_WIDTH_PX });
        material.resolution.set(1, 1);
        const line = new Line2(geometry, material);
        renderScene.add(line);
        bolts.push(line);
        boltMaterials.push(material);
        boltPositions.push(positions);
      }
    },
    render(ctx: SceneContext) {
      // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
      const treble = Math.min(2, ctx.audio.treble);
      const volume = Math.min(2, ctx.audio.volume);

      // FXパッドY: 「強制的に全bolt発生」という以前のStrikeはワンショット的で連続値と相性が
      // 悪いため、「可視時間の長さ」を連続的に伸縮する演出に作り直した(正で見えている時間を
      // 大きく伸ばし、強く押すとほぼ常時発生しているように見える。負で見えている時間を短くし、
      // 稲妻が消えていく対称的な軸)
      const strikeUp = Math.max(0, ctx.padY);
      const strikeDown = Math.max(0, -ctx.padY);
      const visibleDuration = VISIBLE_DURATION * (1 + strikeUp * 20) * Math.max(0, 1 - strikeDown);
      // FXパッドX: 正で白へ、負で黒へ寄せる(0で通常の配色、Flashの連続版)
      const flash = ctx.padX;
      const toFlash = (c: number) => (flash >= 0 ? c + (1 - c) * flash : c * (1 + flash));

      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      for (let b = 0; b < BOLT_COUNT; b++) {
        boltMaterials[b].resolution.set(ctx.width, ctx.height);

        const phaseOffset = (b / BOLT_COUNT) * CYCLE_DURATION;
        const elapsed = ctx.time - phaseOffset;
        const age = ((elapsed % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION;
        const cycleIndex = Math.floor(elapsed / CYCLE_DURATION);

        const visible = age < visibleDuration;
        if (!visible) {
          boltMaterials[b].opacity = 0;
          continue;
        }

        // 稲妻ごとに毎サイクル異なる形状にする(cycleIndexをシードに含める)
        const seedBase = b * 97 + cycleIndex * 13.7;
        const startX = (hash(seedBase) - 0.5) * 3.5;
        const endX = (hash(seedBase + 1) - 0.5) * 3.5;
        const positions = boltPositions[b];

        for (let s = 0; s < SEGMENTS; s++) {
          const t = s / (SEGMENTS - 1);
          const y = 1.8 - t * 3.6;
          const baseX = startX + (endX - startX) * t;
          // 中間点をランダムにジグザグさせる(中点変位法の簡易版)
          const jaggedness = s === 0 || s === SEGMENTS - 1 ? 0 : (hash(seedBase + s * 3.1) - 0.5) * 0.6;
          positions[s * 3] = baseX + jaggedness;
          positions[s * 3 + 1] = y;
          positions[s * 3 + 2] = 0;
        }
        bolts[b].geometry.setPositions(positions);

        const fade = Math.max(0, 1 - age / visibleDuration);
        const t = hash(seedBase + 2);
        const r = toFlash((mr + (sr - mr) * t) * fade);
        const g = toFlash((mg + (sg - mg) * t) * fade);
        const b_ = toFlash((mb + (sb - mb) * t) * fade);
        boltMaterials[b].color.setRGB(r, g, b_);
        boltMaterials[b].opacity = fade * (0.7 + volume * 0.3 + treble * 0.2);
      }

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createLightningArcsScene;
