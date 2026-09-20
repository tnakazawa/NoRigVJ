import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const PARTICLE_COUNT = 600;
/** 星がループする奥行きの範囲(この距離だけ手前に進んだら奥へ戻す) */
const Z_RANGE = 40;

/**
 * 無数の星がカメラ手前へ流れ続けるワープ航法風のシーン(WebGL)。カラーパレット対応。FXパッド対応。
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
    padSupported: true,
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

      // FXパッドX: 前進速度への加算オフセット(Warp Speedの連続版)。正で大幅に加速し、
      // 負で減速する(0を下回らないようクランプし、星が逆走しないようにする)
      const warpBoost = ctx.padX * 6;
      const speed = Math.max(0, 3 + bass * 4 + warpBoost);

      const dt = lastTime === null ? 0 : ctx.time - lastTime;
      lastTime = ctx.time;
      advanced += speed * dt;

      // FXパッドY: 正で白く大きく光らせ、負で暗く小さく寄せる(Flashの連続版。符号で方向が変わる
      // 対称式はNoise FieldのX軸と同じ考え方)
      const flash = ctx.padY;
      const toFlash = (c: number) => (flash >= 0 ? c + (1 - c) * flash : c * (1 + flash));

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
        const r = mr + (sr - mr) * t;
        const g = mg + (sg - mg) * t;
        const b = mb + (sb - mb) * t;
        colorAttr.setXYZ(i, toFlash(r), toFlash(g), toFlash(b));
      }
      positionAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

      material.size = Math.max(0.02, (0.1 + volume * 0.15) * (1 + flash * 2));

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createStarfieldWarpScene;
