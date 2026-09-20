import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const PARTICLE_COUNT = 500;
const ARM_COUNT = 3;

/**
 * 渦を巻くパーティクル銀河のシーン(WebGL)。カラーパレット対応。
 * Noise Field/Bloom Particles/Starfield Warpと同じパーティクル系だが、中心ほど速く回転する
 * 渦巻き状の配置という点で差別化している。FXパッド対応。
 */
const createSpiralGalaxyScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let points: THREE.Points;
  let material: THREE.PointsMaterial;
  // 各パーティクルの半径・所属アーム・基準角度・高さ方向の散らばり
  let radii: Float32Array;
  let baseAngles: Float32Array;
  let heights: Float32Array;
  let seeds: Float32Array;

  const scene: Scene = {
    name: "Spiral Galaxy",
    supportsPalette: true,
    padSupported: true,
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.set(0, 3.5, 5);
      camera.lookAt(0, 0, 0);

      radii = new Float32Array(PARTICLE_COUNT);
      baseAngles = new Float32Array(PARTICLE_COUNT);
      heights = new Float32Array(PARTICLE_COUNT);
      seeds = new Float32Array(PARTICLE_COUNT);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        // 中心付近ほど密集させる(sqrtで半径分布を偏らせる、銀河の中心集中を表現)
        const r = Math.sqrt(Math.random()) * 3.2 + 0.15;
        radii[i] = r;
        const arm = i % ARM_COUNT;
        baseAngles[i] = (arm / ARM_COUNT) * Math.PI * 2 + Math.random() * 0.5;
        heights[i] = (Math.random() - 0.5) * 0.15;
        seeds[i] = Math.random();
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));

      material = new THREE.PointsMaterial({
        size: 0.06,
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

      // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
      const bass = Math.min(2, ctx.audio.bass);
      const volume = Math.min(2, ctx.audio.volume);

      // FXパッドX: 回転速度にオフセットを加える(正で加速、負で逆回転。Spin Burstの連続版)
      const spinBurst = ctx.padX * 3;
      // FXパッドY: 白(正)/黒(負)へ寄せる対称式(Flashの連続版)
      const flash = ctx.padY;
      const toFlash = (c: number) => (flash >= 0 ? c + (1 - c) * flash : c * (1 + flash));

      const positionAttr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
      const colorAttr = points.geometry.getAttribute("color") as THREE.BufferAttribute;
      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const r = radii[i];
        // 中心に近いほど速く回転する(ケプラー的な回転を単純化した近似)
        const angularSpeed = (0.5 + bass * 0.4 + spinBurst) / (r * 0.5 + 0.3);
        const angle = baseAngles[i] + ctx.time * angularSpeed;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const y = heights[i];
        positionAttr.setXYZ(i, x, y, z);

        // 中心(main)から外側(sub)へ配色する
        const t = Math.min(1, r / 3.2);
        const cr = mr + (sr - mr) * t;
        const cg = mg + (sg - mg) * t;
        const cb = mb + (sb - mb) * t;
        colorAttr.setXYZ(i, toFlash(cr), toFlash(cg), toFlash(cb));
      }
      positionAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

      material.size = 0.05 + volume * 0.05;

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createSpiralGalaxyScene;
