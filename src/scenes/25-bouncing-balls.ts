import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const GRID_COLS = 8;
const GRID_ROWS = 4;
const BALL_COUNT = GRID_COLS * GRID_ROWS;
const FLOOR_Y = -2;
const GRAVITY = 6;
const RESTITUTION = 0.72;

/**
 * 簡易物理でバウンドするボール群のシーン(WebGL)。カラーパレット対応。手動トリガー2種対応。
 * 前フレームの速度・位置を保持し続ける点はFlocking Boidsと同じだが、群れの相互作用ではなく
 * 重力・反発という物理的な動きが主役という点で差別化している。
 */
const createBouncingBallsScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let instancedMesh: THREE.InstancedMesh;
  let light: THREE.DirectionalLight;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  // 各ボールのx/z(固定)・y方向の速度・現在のy位置
  const xPositions: number[] = [];
  const zPositions: number[] = [];
  let yPositions: Float32Array;
  let yVelocities: Float32Array;
  let lastTime: number | null = null;

  const scene: Scene = {
    name: "Bouncing Balls",
    supportsPalette: true,
    triggerEffectNames: ["Bounce Burst", "Flash", undefined],
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(0, 1.5, 8);
      camera.lookAt(0, 0, 0);

      renderScene.add(new THREE.AmbientLight(0xffffff, 0.4));
      light = new THREE.DirectionalLight(0xffffff, 1.5);
      light.position.set(3, 5, 4);
      renderScene.add(light);

      yPositions = new Float32Array(BALL_COUNT);
      yVelocities = new Float32Array(BALL_COUNT);
      for (let col = 0; col < GRID_COLS; col++) {
        for (let row = 0; row < GRID_ROWS; row++) {
          const i = col * GRID_ROWS + row;
          xPositions.push((col - (GRID_COLS - 1) / 2) * 0.75);
          zPositions.push((row - (GRID_ROWS - 1) / 2) * 0.75);
          yPositions[i] = FLOOR_Y + 0.3 + Math.random() * 2;
          yVelocities[i] = 0;
        }
      }

      const geometry = new THREE.SphereGeometry(0.3, 16, 16);
      const material = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1 });
      instancedMesh = new THREE.InstancedMesh(geometry, material, BALL_COUNT);
      instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BALL_COUNT * 3), 3);
      renderScene.add(instancedMesh);
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
      const bass = Math.min(2, ctx.audio.bass);
      const volume = Math.min(2, ctx.audio.volume);

      const dt = lastTime === null ? 0 : Math.min(0.05, ctx.time - lastTime);
      lastTime = ctx.time;

      // Trigger 1(Bounce Burst): 発生中は立ち上がりの瞬間に全ボールへ上向きの速度を与える
      const burstEdge = ctx.triggers[0] > 0.9;
      // Trigger 2(Flash): 発生中は白へ寄せる
      const flash = ctx.triggers[1];

      // 低域が強いタイミングでたまにジャンプさせ、音楽的な弾みを出す
      const jumpChance = bass * 0.02;

      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      for (let i = 0; i < BALL_COUNT; i++) {
        yVelocities[i] -= GRAVITY * dt;
        yPositions[i] += yVelocities[i] * dt;

        if (yPositions[i] < FLOOR_Y + 0.3) {
          yPositions[i] = FLOOR_Y + 0.3;
          yVelocities[i] = Math.abs(yVelocities[i]) * RESTITUTION;
          if (Math.random() < jumpChance) {
            yVelocities[i] += 2 + Math.random() * 2;
          }
        }
        if (burstEdge && yVelocities[i] < 4) {
          yVelocities[i] = 5 + Math.random() * 1.5;
        }

        dummy.position.set(xPositions[i], yPositions[i], zPositions[i]);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);

        const t = i / (BALL_COUNT - 1);
        const r = mr + (sr - mr) * t;
        const g = mg + (sg - mg) * t;
        const b = mb + (sb - mb) * t;
        color.setRGB(r + (1 - r) * flash, g + (1 - g) * flash, b + (1 - b) * flash);
        instancedMesh.setColorAt(i, color);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

      light.intensity = 1.3 + volume * 0.8;
      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createBouncingBallsScene;
