import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const BOID_COUNT = 70;
const BOUNDS = 3;
const NEIGHBOR_RADIUS = 0.9;
const SEPARATION_RADIUS = 0.35;
const MAX_SPEED = 1.8;

/**
 * 鳥や魚の群れのように自律的に動くパーティクル群のシーン(WebGL)。カラーパレット対応。手動トリガー2種対応。
 * 分離・整列・結合の3ルール(boidsアルゴリズム)で速度を毎フレーム更新し続ける、既存シーンにない
 * 「群知能」的な動き。他シーンと違い、位置・速度を時刻から再計算せず前フレームの状態を積み上げる。
 */
const createFlockingBoidsScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let points: THREE.Points;
  let material: THREE.PointsMaterial;
  // 各boidの位置・速度(前フレームの状態を保持し続ける、他シーンには無いパターン)
  let positions: Float32Array;
  let velocities: Float32Array;
  let lastTime: number | null = null;

  const scene: Scene = {
    name: "Flocking Boids",
    supportsPalette: true,
    triggerEffectNames: ["Scatter", "Flash", undefined],
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.set(0, 0, 7);

      positions = new Float32Array(BOID_COUNT * 3);
      velocities = new Float32Array(BOID_COUNT * 3);
      for (let i = 0; i < BOID_COUNT; i++) {
        positions[i * 3] = (Math.random() - 0.5) * BOUNDS * 2;
        positions[i * 3 + 1] = (Math.random() - 0.5) * BOUNDS * 2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * BOUNDS;
        const angle = Math.random() * Math.PI * 2;
        velocities[i * 3] = Math.cos(angle) * 0.5;
        velocities[i * 3 + 1] = Math.sin(angle) * 0.5;
        velocities[i * 3 + 2] = 0;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BOID_COUNT * 3), 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(BOID_COUNT * 3), 3));

      material = new THREE.PointsMaterial({
        size: 0.14,
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

      // Trigger 1(Scatter): 発生中は分離力を大幅に強め、群れを散らす
      const scatter = ctx.triggers[0];
      // Trigger 2(Flash): 発生中は白へ寄せる
      const flash = ctx.triggers[1];

      const dt = lastTime === null ? 0 : Math.min(0.1, ctx.time - lastTime);
      lastTime = ctx.time;

      // O(n^2)の近傍探索。BOID_COUNT=70程度なら毎フレーム十分高速。
      for (let i = 0; i < BOID_COUNT; i++) {
        let sepX = 0;
        let sepY = 0;
        let sepZ = 0;
        let aliX = 0;
        let aliY = 0;
        let aliZ = 0;
        let cohX = 0;
        let cohY = 0;
        let cohZ = 0;
        let neighborCount = 0;

        const ix = positions[i * 3];
        const iy = positions[i * 3 + 1];
        const iz = positions[i * 3 + 2];

        for (let j = 0; j < BOID_COUNT; j++) {
          if (i === j) continue;
          const dx = positions[j * 3] - ix;
          const dy = positions[j * 3 + 1] - iy;
          const dz = positions[j * 3 + 2] - iz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
          if (dist < NEIGHBOR_RADIUS) {
            neighborCount++;
            aliX += velocities[j * 3];
            aliY += velocities[j * 3 + 1];
            aliZ += velocities[j * 3 + 2];
            cohX += positions[j * 3];
            cohY += positions[j * 3 + 1];
            cohZ += positions[j * 3 + 2];
            const sepDist = scatter > 0.01 ? SEPARATION_RADIUS * (1 + scatter * 4) : SEPARATION_RADIUS;
            if (dist < sepDist) {
              sepX -= dx / dist;
              sepY -= dy / dist;
              sepZ -= dz / dist;
            }
          }
        }

        let vx = velocities[i * 3];
        let vy = velocities[i * 3 + 1];
        let vz = velocities[i * 3 + 2];

        if (neighborCount > 0) {
          aliX /= neighborCount;
          aliY /= neighborCount;
          aliZ /= neighborCount;
          cohX = cohX / neighborCount - ix;
          cohY = cohY / neighborCount - iy;
          cohZ = cohZ / neighborCount - iz;

          const separationForce = 1.5 + scatter * 6;
          vx += (sepX * separationForce + aliX * 0.5 + cohX * 0.3) * dt;
          vy += (sepY * separationForce + aliY * 0.5 + cohY * 0.3) * dt;
          vz += (sepZ * separationForce + aliZ * 0.5 + cohZ * 0.3) * dt;
        }

        // 境界を超えたら中心へ戻す力を加える
        if (Math.abs(ix) > BOUNDS) vx -= Math.sign(ix) * 0.8 * dt;
        if (Math.abs(iy) > BOUNDS) vy -= Math.sign(iy) * 0.8 * dt;
        if (Math.abs(iz) > BOUNDS * 0.6) vz -= Math.sign(iz) * 0.8 * dt;

        const speed = Math.sqrt(vx * vx + vy * vy + vz * vz) || 0.0001;
        const maxSpeed = MAX_SPEED * (1 + bass * 0.6);
        if (speed > maxSpeed) {
          vx = (vx / speed) * maxSpeed;
          vy = (vy / speed) * maxSpeed;
          vz = (vz / speed) * maxSpeed;
        }

        velocities[i * 3] = vx;
        velocities[i * 3 + 1] = vy;
        velocities[i * 3 + 2] = vz;
        positions[i * 3] = ix + vx * dt;
        positions[i * 3 + 1] = iy + vy * dt;
        positions[i * 3 + 2] = iz + vz * dt;
      }

      const positionAttr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
      const colorAttr = points.geometry.getAttribute("color") as THREE.BufferAttribute;
      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      for (let i = 0; i < BOID_COUNT; i++) {
        positionAttr.setXYZ(i, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        const speed =
          Math.sqrt(
            velocities[i * 3] ** 2 + velocities[i * 3 + 1] ** 2 + velocities[i * 3 + 2] ** 2,
          ) / MAX_SPEED;
        const t = Math.min(1, speed);
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

      material.size = 0.12 + volume * 0.06;

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createFlockingBoidsScene;
