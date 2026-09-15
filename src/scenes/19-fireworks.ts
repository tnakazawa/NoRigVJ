import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const SHELL_COUNT = 6;
const PARTICLES_PER_SHELL = 55;
const PARTICLE_COUNT = SHELL_COUNT * PARTICLES_PER_SHELL;
/** 1発の打ち上げ〜消滅までの周期(秒)。shellごとに位相をずらして常にどこかが爆発中にする */
const CYCLE_DURATION = 2.4;
const GRAVITY = 1.8;

/**
 * 複数発の花火が周期的に爆発し、重力で放物線を描いて消えていくシーン(WebGL)。カラーパレット対応。
 * 手動トリガー2種対応。既存の放射状パーティクル演出(Noise FieldのRadial Push等)と違い、
 * 「爆発→重力落下→消滅」という寿命のあるライフサイクルを持つ点で差別化している。
 */
const createFireworksScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let points: THREE.Points;
  let material: THREE.PointsMaterial;
  // パーティクルごとの飛散方向(単位ベクトル)・個体差・所属shell・shellの爆発中心
  let dirs: Float32Array;
  let speedFactors: Float32Array;
  let shellIndexOf: Uint8Array;
  const shellCenters: { x: number; y: number; z: number }[] = [];
  const shellColorT: number[] = [];

  const scene: Scene = {
    name: "Fireworks",
    supportsPalette: true,
    triggerEffectNames: ["Launch Burst", "Flash", undefined],
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.z = 7;

      dirs = new Float32Array(PARTICLE_COUNT * 3);
      speedFactors = new Float32Array(PARTICLE_COUNT);
      shellIndexOf = new Uint8Array(PARTICLE_COUNT);

      for (let s = 0; s < SHELL_COUNT; s++) {
        shellCenters.push({
          x: (Math.random() - 0.5) * 5,
          y: (Math.random() - 0.5) * 1.5 + 0.5,
          z: (Math.random() - 0.5) * 2,
        });
        shellColorT.push(Math.random());
      }

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const shell = Math.floor(i / PARTICLES_PER_SHELL);
        shellIndexOf[i] = shell;
        // 球面一様分布に近い方向ベクトル(厳密な一様性は求めず、視覚的に十分ならよいという判断)
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        dirs[i * 3] = Math.sin(phi) * Math.cos(theta);
        dirs[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
        dirs[i * 3 + 2] = Math.cos(phi);
        speedFactors[i] = 0.6 + Math.random() * 0.8;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));

      material = new THREE.PointsMaterial({
        size: 0.09,
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
      const bass = Math.min(2.5, ctx.audio.bass);
      const volume = Math.min(2, ctx.audio.volume);

      // Trigger 1(Launch Burst): 発生中は爆発の勢いを大幅にブーストする
      const launchBoost = ctx.triggers[0] * 3;
      const v0 = 2 + bass * 1.5 + launchBoost;
      // Trigger 2(Flash): 発生中は白へ寄せる
      const flash = ctx.triggers[1];

      const positionAttr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
      const colorAttr = points.geometry.getAttribute("color") as THREE.BufferAttribute;
      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const shell = shellIndexOf[i];
        const center = shellCenters[shell];
        // shellごとに発生タイミングをずらし、常にどこかのshellが爆発中になるようにする
        const phaseOffset = (shell / SHELL_COUNT) * CYCLE_DURATION;
        const age = ((ctx.time - phaseOffset) % CYCLE_DURATION + CYCLE_DURATION) % CYCLE_DURATION;
        const speed = v0 * speedFactors[i];

        const x = center.x + dirs[i * 3] * speed * age;
        const y = center.y + dirs[i * 3 + 1] * speed * age - 0.5 * GRAVITY * age * age;
        const z = center.z + dirs[i * 3 + 2] * speed * age;
        positionAttr.setXYZ(i, x, y, z);

        const ageT = age / CYCLE_DURATION;
        const fade = 1 - ageT;
        const t = shellColorT[shell];
        let r = (mr + (sr - mr) * t) * fade;
        let g = (mg + (sg - mg) * t) * fade;
        let b = (mb + (sb - mb) * t) * fade;
        r += (1 - r) * flash;
        g += (1 - g) * flash;
        b += (1 - b) * flash;
        colorAttr.setXYZ(i, r, g, b);
      }
      positionAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

      material.size = 0.07 + volume * 0.08;

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createFireworksScene;
