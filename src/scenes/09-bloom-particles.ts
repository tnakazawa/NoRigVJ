import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const PARTICLE_COUNT = 800;

/**
 * 加算合成+Bloom(発光)のパーティクル群のシーン(WebGL)。カラーパレット対応。
 * three.js標準の後処理(`EffectComposer`/`UnrealBloomPass`、追加ライブラリ不要)を使う唯一のシーン。
 */
const createBloomParticlesScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let points: THREE.Points;
  let composer: EffectComposer;
  let bloomPass: UnrealBloomPass;
  // 各パーティクルの基準位置(この周りをsin波で揺らす)と、揺れの位相をずらすための乱数シード
  let basePositions: Float32Array;
  let seeds: Float32Array;

  const scene: Scene = {
    name: "Bloom Particles",
    supportsPalette: true,
    init(ctx: SceneContext) {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.z = 8;

      const positions = new Float32Array(PARTICLE_COUNT * 3);
      basePositions = new Float32Array(PARTICLE_COUNT * 3);
      seeds = new Float32Array(PARTICLE_COUNT);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const x = (Math.random() - 0.5) * 8;
        const y = (Math.random() - 0.5) * 8;
        const z = (Math.random() - 0.5) * 8;
        basePositions[i * 3] = x;
        basePositions[i * 3 + 1] = y;
        basePositions[i * 3 + 2] = z;
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        seeds[i] = Math.random() * Math.PI * 2;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));

      const material = new THREE.PointsMaterial({
        size: 0.12,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      points = new THREE.Points(geometry, material);
      renderScene.add(points);

      composer = new EffectComposer(ctx.renderer);
      composer.addPass(new RenderPass(renderScene, camera));
      bloomPass = new UnrealBloomPass(new THREE.Vector2(ctx.width, ctx.height), 1.2, 0.6, 0.1);
      composer.addPass(bloomPass);
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();
      composer.setSize(ctx.width, ctx.height);

      // 強度調整(0〜3倍)で音声レベルが1.0を超えても発散しないようクランプする
      const volume = Math.min(1, ctx.audio.volume);
      const bass = Math.min(1, ctx.audio.bass);
      const treble = Math.min(1, ctx.audio.treble);

      const positionAttr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
      const colorAttr = points.geometry.getAttribute("color") as THREE.BufferAttribute;
      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);
      // bassで揺れの速さ、trebleで揺れ幅(散らばり具合)を変える
      const speed = 0.3 + bass * 2.0;
      const wobbleAmount = 0.3 + treble * 1.0;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const seed = seeds[i];
        const bx = basePositions[i * 3];
        const by = basePositions[i * 3 + 1];
        const bz = basePositions[i * 3 + 2];
        positionAttr.setXYZ(
          i,
          bx + Math.sin(ctx.time * speed + seed) * wobbleAmount,
          by + Math.cos(ctx.time * speed * 0.8 + seed) * wobbleAmount,
          bz,
        );

        // パーティクルごとに固定の疑似乱数(seedベース)でメイン/サブ間を補間する
        const t = Math.sin(seed) * 0.5 + 0.5;
        colorAttr.setXYZ(i, mr + (sr - mr) * t, mg + (sg - mg) * t, mb + (sb - mb) * t);
      }
      positionAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

      // volumeでBloomの発光強度を変える
      bloomPass.strength = 0.6 + volume * 1.8;

      composer.render();
    },
  };
  return scene;
};

export default createBloomParticlesScene;
