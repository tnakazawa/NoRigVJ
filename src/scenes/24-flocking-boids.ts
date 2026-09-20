import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const BOID_COUNT = 70;
const BOUNDS = 3;
const NEIGHBOR_RADIUS = 0.9;
const SEPARATION_RADIUS = 0.35;
const MAX_SPEED = 3.2;
/** Gather(結合)時に近傍のboid同士を結ぶ線の最大本数(頂点バッファの上限確保用) */
const MAX_LINES = 260;

/**
 * 鳥や魚の群れのように自律的に動くパーティクル群のシーン(WebGL)。カラーパレット対応。
 * 分離・整列・結合の3ルール(boidsアルゴリズム)で速度を毎フレーム更新し続ける、既存シーンにない
 * 「群知能」的な動き。他シーンと違い、位置・速度を時刻から再計算せず前フレームの状態を積み上げる。
 * FXパッド対応。
 */
const createFlockingBoidsScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let points: THREE.Points;
  let material: THREE.PointsMaterial;
  let lineSegments: THREE.LineSegments;
  let lineMaterial: THREE.LineBasicMaterial;
  // 各boidの位置・速度(前フレームの状態を保持し続ける、他シーンには無いパターン)
  let positions: Float32Array;
  let velocities: Float32Array;
  let lastTime: number | null = null;
  // Gather時の接続線用バッファ(毎フレームのGC負荷を避けるため使い回す)
  const linePositions = new Float32Array(MAX_LINES * 2 * 3);

  const scene: Scene = {
    name: "Flocking Boids",
    supportsPalette: true,
    padSupported: true,
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

      // Gather(結合)時、近傍のboid同士を線で結んで見せる(分離・結合の違いを視覚的に区別する)
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_LINES * 2 * 3), 3));
      lineGeometry.setDrawRange(0, 0);
      lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
      lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
      renderScene.add(lineSegments);
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
      const bass = Math.min(2, ctx.audio.bass);
      const volume = Math.min(2, ctx.audio.volume);

      // FXパッドY: 正で分離力を強めて群れを散らす(Scatterの連続版)、負で分離を弱め結合を
      // 強めて群れをより密集させる(Scatterと対になる「Gather」方向、量的エフェクトとして1軸に統合)
      const scatter = Math.max(0, ctx.padY);
      const gather = Math.max(0, -ctx.padY);
      // FXパッドX: 正で白へ、負で黒へ寄せる(0で通常の配色、Flashの連続版)
      const flash = ctx.padX;

      const dt = lastTime === null ? 0 : Math.min(0.1, ctx.time - lastTime);
      lastTime = ctx.time;

      // Gather(結合)が強いときだけ、近傍のboid同士を線でつないで見せる
      // (分離との違いが見た目でも分かるようにするため)
      let lineCount = 0;

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
            if (gather > 0.05 && j > i && lineCount < MAX_LINES) {
              const base = lineCount * 6;
              linePositions[base] = ix;
              linePositions[base + 1] = iy;
              linePositions[base + 2] = iz;
              linePositions[base + 3] = positions[j * 3];
              linePositions[base + 4] = positions[j * 3 + 1];
              linePositions[base + 5] = positions[j * 3 + 2];
              lineCount++;
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

          // 無操作時でも動きが単調にならないよう、各力の基準値を全体的に強めている
          const separationForce = 2.2 + scatter * 7 - gather * 1.2;
          const cohesionForce = 0.5 + gather * 1.8;
          vx += (sepX * separationForce + aliX * 0.9 + cohX * cohesionForce) * dt;
          vy += (sepY * separationForce + aliY * 0.9 + cohY * cohesionForce) * dt;
          vz += (sepZ * separationForce + aliZ * 0.9 + cohZ * cohesionForce) * dt;
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
        const toFlash = (c: number) => (flash >= 0 ? c + (1 - c) * flash : c * (1 + flash));
        const r = toFlash(mr + (sr - mr) * t);
        const g = toFlash(mg + (sg - mg) * t);
        const b = toFlash(mb + (sb - mb) * t);
        colorAttr.setXYZ(i, r, g, b);
      }
      positionAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

      material.size = 0.12 + volume * 0.06;

      // Gather時に集めた接続線をジオメトリへ反映する(結合の強さが視覚的に分かるよう、
      // 線の不透明度もgatherの強さに応じて変える)
      const lineGeo = lineSegments.geometry;
      if (lineCount > 0) {
        const linePosAttr = lineGeo.getAttribute("position") as THREE.BufferAttribute;
        (linePosAttr.array as Float32Array).set(linePositions.subarray(0, lineCount * 6));
        linePosAttr.needsUpdate = true;
        lineGeo.setDrawRange(0, lineCount * 2);
        lineMaterial.color.setRGB(mr, mg, mb);
        lineMaterial.opacity = Math.min(0.6, gather * 0.9);
      } else {
        lineGeo.setDrawRange(0, 0);
      }

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createFlockingBoidsScene;
