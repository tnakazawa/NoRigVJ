import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const PARTICLE_COUNT = 600;
/** 星がループする奥行きの範囲(この距離だけ手前に進んだら奥へ戻す) */
const Z_RANGE = 40;

/**
 * 無数の星がカメラ手前へ流れ続けるワープ航法風のシーン(WebGL)。カラーパレット対応。手動トリガー2種対応。
 * Noise Field/Bloom Particlesと同じ「毎フレームBufferAttributeを書き換える」パーティクル実装だが、
 * 揺れではなく前方への一方向の流れが主役という点で差別化している。
 */
const createStarfieldWarpScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let points: THREE.Points;
  let material: THREE.PointsMaterial;
  // 各星のx/y(固定)とz方向の初期オフセット(0〜Z_RANGE)
  let basePositions: Float32Array;
  let seeds: Float32Array;
  // 手前へ進んだ距離の累積(音量で速度が変わっても位置が不連続にジャンプしないよう、
  // 経過時間ベースではなく累積方式にする。Rainbowのoffsetと同じ考え方)
  let advanced = 0;
  let lastTime: number | null = null;

  const scene: Scene = {
    name: "Starfield Warp",
    supportsPalette: true,
    triggerEffectNames: ["Warp Speed", "Flash", undefined],
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.z = 5;

      basePositions = new Float32Array(PARTICLE_COUNT * 3);
      seeds = new Float32Array(PARTICLE_COUNT);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        basePositions[i * 3] = (Math.random() - 0.5) * 14;
        basePositions[i * 3 + 1] = (Math.random() - 0.5) * 14;
        basePositions[i * 3 + 2] = Math.random() * Z_RANGE;
        seeds[i] = Math.random();
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));

      material = new THREE.PointsMaterial({
        size: 0.12,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      points = new THREE.Points(geometry, material);
      renderScene.add(points);
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      // 速度・発光強度にしか使わないため、Intensity(0〜9倍)を上げても変化が続くよう上限は高めにする
      const bass = Math.min(3, ctx.audio.bass);
      const volume = Math.min(2, ctx.audio.volume);

      // Trigger 1(Warp Speed): 発生中は前進速度を大幅にブーストする
      const warpBoost = ctx.triggers[0] * 6;
      const speed = 3 + bass * 4 + warpBoost;

      const dt = lastTime === null ? 0 : ctx.time - lastTime;
      lastTime = ctx.time;
      advanced += speed * dt;

      // Trigger 2(Flash): 発生中は星を大きく白く光らせる
      const flash = ctx.triggers[1];

      const positionAttr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
      const colorAttr = points.geometry.getAttribute("color") as THREE.BufferAttribute;
      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const x = basePositions[i * 3];
        const y = basePositions[i * 3 + 1];
        const baseZ = basePositions[i * 3 + 2];
        // 0〜Z_RANGEの範囲でループしながら手前(z=0寄り)へ進む
        const z = -((baseZ + advanced) % Z_RANGE);
        positionAttr.setXYZ(i, x, y, z);

        const t = seeds[i];
        let r = mr + (sr - mr) * t;
        let g = mg + (sg - mg) * t;
        let b = mb + (sb - mb) * t;
        r += (1 - r) * flash;
        g += (1 - g) * flash;
        b += (1 - b) * flash;
        colorAttr.setXYZ(i, r, g, b);
      }
      positionAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

      material.size = (0.1 + volume * 0.15) * (1 + flash * 2);

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createStarfieldWarpScene;
