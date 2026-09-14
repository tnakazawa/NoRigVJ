import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const RING_COUNT = 5;
/** Ring Burst(Trigger 1)で生成したリングが消えるまでの寿命(秒) */
const BURST_LIFETIME = 1.2;

/** 音量に反応する同心円(トーラス)のシーン(WebGL)。カラーパレット対応。手動トリガー3種対応。 */
const createPulseRingsScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  const rings: THREE.Mesh[] = [];
  const ringMaterials: THREE.MeshBasicMaterial[] = [];
  let ringGeometry: THREE.TorusGeometry;
  // Trigger 1(Ring Burst)で動的に生成し、寿命が尽きたら破棄するリング
  let burstRings: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; born: number }[] = [];
  let lastTrigger0 = 0;

  const scene: Scene = {
    name: "Pulse Rings",
    supportsPalette: true,
    triggerEffectNames: ["Ring Burst", "Color Flip", "Radius Kick"],
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.z = 8;

      ringGeometry = new THREE.TorusGeometry(1, 0.05, 16, 64);
      for (let i = 0; i < RING_COUNT; i++) {
        const material = new THREE.MeshBasicMaterial({ transparent: true });
        const mesh = new THREE.Mesh(ringGeometry, material);
        // わずかに奥行きをずらして重なりに立体感を出す(既存Canvas版は完全に正面構図だった)
        mesh.position.z = -i * 0.4;
        renderScene.add(mesh);
        rings.push(mesh);
        ringMaterials.push(material);
      }
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      // 音声反応が敏感すぎたため、1.2で割って落ち着かせる(Canvas版を踏襲)。
      // bassは半径のうねり幅に使うため、Intensity(0〜9倍)を上げても変化が続くよう上限を高めにしている
      const bass = Math.min(3, ctx.audio.bass) / 1.2;
      const volume = Math.min(1, ctx.audio.volume) / 1.2;

      // Trigger 1の立ち上がり(発生の瞬間)を捉えてリングを1本追加する
      if (ctx.triggers[0] > 0.9 && lastTrigger0 <= 0.9) {
        const material = new THREE.MeshBasicMaterial({ transparent: true });
        const mesh = new THREE.Mesh(ringGeometry, material);
        renderScene.add(mesh);
        burstRings.push({ mesh, material, born: ctx.time });
      }
      lastTrigger0 = ctx.triggers[0];

      // Trigger 2(Color Flip): 発生中はメイン/サブの補間方向を反転させる
      const flip = ctx.triggers[1] > 0.5;
      // Trigger 3(Radius Kick): 発生中は全リングの半径に一時的なオフセットを加える
      const radiusKick = ctx.triggers[2] * 1.5;

      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      for (let i = 0; i < RING_COUNT; i++) {
        const t = ctx.time * 0.6 + i * 0.4;
        const scale = 0.6 + (i * 0.5 + bass * 2.0) * (0.6 + 0.4 * Math.sin(t)) + radiusKick;
        rings[i].scale.setScalar(Math.max(0.05, scale));

        const colorT = flip ? 1 - i / (RING_COUNT - 1) : i / (RING_COUNT - 1);
        ringMaterials[i].color.setRGB(mr + (sr - mr) * colorT, mg + (sg - mg) * colorT, mb + (sb - mb) * colorT);
        ringMaterials[i].opacity = 0.5 + volume * 0.5;
      }

      burstRings = burstRings.filter((ring) => {
        const age = ctx.time - ring.born;
        if (age >= BURST_LIFETIME) {
          renderScene.remove(ring.mesh);
          ring.material.dispose();
          return false;
        }
        const ageT = age / BURST_LIFETIME;
        ring.mesh.scale.setScalar(0.6 + age * 3);
        ring.material.opacity = 1 - ageT;
        ring.material.color.setRGB(sr + (mr - sr) * ageT, sg + (mg - sg) * ageT, sb + (mb - sb) * ageT);
        return true;
      });

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createPulseRingsScene;
