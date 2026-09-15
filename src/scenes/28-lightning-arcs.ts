import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const BOLT_COUNT = 4;
const SEGMENTS = 14;
/** 1本の稲妻が発生してから消えるまでの周期(秒)。boltごとに位相をずらして常にどれかが明滅するようにする */
const CYCLE_DURATION = 1.3;
/** 稲妻が実際に見えている時間(秒)。発生直後だけ光り、すぐ消える */
const VISIBLE_DURATION = 0.14;

function hash(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * 稲妻状のジグザグ線が明滅するシーン(WebGL)。カラーパレット対応。手動トリガー2種対応。
 * Lissajous Linesと同じ線画カテゴリだが、滑らかな曲線ではなく瞬間的なジグザグの明滅という質の違いで
 * 差別化している。
 */
const createLightningArcsScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  const bolts: THREE.Line[] = [];
  const boltMaterials: THREE.LineBasicMaterial[] = [];

  const scene: Scene = {
    name: "Lightning Arcs",
    supportsPalette: true,
    triggerEffectNames: ["Strike", "Flash", undefined],
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
      camera.position.z = 1;

      for (let b = 0; b < BOLT_COUNT; b++) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SEGMENTS * 3), 3));
        const material = new THREE.LineBasicMaterial({ transparent: true, opacity: 0 });
        const line = new THREE.Line(geometry, material);
        renderScene.add(line);
        bolts.push(line);
        boltMaterials.push(material);
      }
    },
    render(ctx: SceneContext) {
      // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
      const treble = Math.min(2, ctx.audio.treble);
      const volume = Math.min(2, ctx.audio.volume);

      // Trigger 1(Strike): 発生中は全boltを強制的に発生・可視状態にする
      const strike = ctx.triggers[0];
      // Trigger 2(Flash): 発生中は白へ寄せる
      const flash = ctx.triggers[1];

      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      for (let b = 0; b < BOLT_COUNT; b++) {
        const phaseOffset = (b / BOLT_COUNT) * CYCLE_DURATION;
        const elapsed = ctx.time - phaseOffset;
        const age = ((elapsed % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION;
        const cycleIndex = Math.floor(elapsed / CYCLE_DURATION);

        const visible = age < VISIBLE_DURATION || strike > 0.5 || flash > 0.01;
        if (!visible) {
          boltMaterials[b].opacity = 0;
          continue;
        }

        // 稲妻ごとに毎サイクル異なる形状にする(cycleIndexをシードに含める)
        const seedBase = b * 97 + cycleIndex * 13.7;
        const startX = (hash(seedBase) - 0.5) * 3.5;
        const endX = (hash(seedBase + 1) - 0.5) * 3.5;
        const positionAttr = bolts[b].geometry.getAttribute("position") as THREE.BufferAttribute;

        for (let s = 0; s < SEGMENTS; s++) {
          const t = s / (SEGMENTS - 1);
          const y = 1.8 - t * 3.6;
          const baseX = startX + (endX - startX) * t;
          // 中間点をランダムにジグザグさせる(中点変位法の簡易版)
          const jaggedness = s === 0 || s === SEGMENTS - 1 ? 0 : (hash(seedBase + s * 3.1) - 0.5) * 0.6;
          positionAttr.setXYZ(s, baseX + jaggedness, y, 0);
        }
        positionAttr.needsUpdate = true;

        const fade = strike > 0.5 || flash > 0.01 ? 1 : Math.max(0, 1 - age / VISIBLE_DURATION);
        const t = hash(seedBase + 2);
        let r = (mr + (sr - mr) * t) * fade;
        let g = (mg + (sg - mg) * t) * fade;
        let b_ = (mb + (sb - mb) * t) * fade;
        r += (1 - r) * flash;
        g += (1 - g) * flash;
        b_ += (1 - b_) * flash;
        boltMaterials[b].color.setRGB(r, g, b_);
        boltMaterials[b].opacity = fade * (0.7 + volume * 0.3 + treble * 0.2);
      }

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createLightningArcsScene;
