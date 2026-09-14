import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const PARTICLE_COUNT = 450;

/**
 * 疑似乱数で散らばるパーティクル群のシーン(WebGL)。カラーパレット対応。手動トリガー3種対応。
 * [09-bloom-particles.ts](09-bloom-particles.ts)と同じ「毎フレームBufferAttributeを書き換える」実装
 * パターンだが、差別化のためBloom(後処理)は使わないシンプルな加算合成に留めている。
 */
const createNoiseFieldScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let points: THREE.Points;
  let material: THREE.PointsMaterial;
  // Trigger 2(Freeze)発生中、パーティクル位置の計算に使う時間を固定するための開始時刻
  let frozenAtTime: number | null = null;

  const scene: Scene = {
    name: "Noise Field",
    supportsPalette: true,
    triggerEffectNames: ["Radial Push", "Freeze", "Color Flash"],
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.z = 6;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));

      material = new THREE.PointsMaterial({
        size: 0.08,
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

      // 音声反応が鈍かったため、1.5倍敏感にする(Canvas版を踏襲)。
      // パーティクルサイズに使うため、Intensity(0〜9倍)を上げても変化が続くよう上限は高めにする
      const volume = Math.min(3, ctx.audio.volume) * 1.5;

      // Trigger 2(Freeze): 発生中はパーティクル位置の計算に使う時間経過を止める
      if (ctx.triggers[1] > 0.01) {
        if (frozenAtTime === null) frozenAtTime = ctx.time;
      } else {
        frozenAtTime = null;
      }
      const effectiveTime = frozenAtTime ?? ctx.time;

      const positionAttr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
      const colorAttr = points.geometry.getAttribute("color") as THREE.BufferAttribute;
      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        // 動きをさらに遅くしている(Canvas版を踏襲)
        const a = i * 12.9898 + effectiveTime * 0.7;
        let x = Math.sin(a) * 4;
        let y = Math.cos(a * 1.3) * 4;
        // 奥行き方向にも散らす(WebGLならではの立体的な広がり)
        const z = Math.sin(i * 3.7) * 3;

        // Trigger 1(Radial Push): 発生中は中心から放射方向に一瞬押し出す
        if (ctx.triggers[0] > 0.01) {
          const len = Math.hypot(x, y) || 1;
          const push = ctx.triggers[0] * 3;
          x += (x / len) * push;
          y += (y / len) * push;
        }
        positionAttr.setXYZ(i, x, y, z);

        // パーティクルごとに固定の疑似乱数(iベース)でメイン/サブ間を補間する。
        // time を使わないことで、色自体が時間で変化しないようにしている。
        const t = Math.sin(i * 7.3) * 0.5 + 0.5;
        let cr = mr + (sr - mr) * t;
        let cg = mg + (sg - mg) * t;
        let cb = mb + (sb - mb) * t;
        // Trigger 3(Color Flash): 発生中は白へ寄せる
        if (ctx.triggers[2] > 0.01) {
          const flash = ctx.triggers[2];
          cr += (1 - cr) * flash;
          cg += (1 - cg) * flash;
          cb += (1 - cb) * flash;
        }
        colorAttr.setXYZ(i, cr, cg, cb);
      }
      positionAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

      material.size = 0.08 * (1 + volume * 3) * (1 + ctx.triggers[0] * 0.8);

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createNoiseFieldScene;
