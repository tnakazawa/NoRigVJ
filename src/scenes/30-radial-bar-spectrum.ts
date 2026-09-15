import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const BAR_COUNT = 48;
const INNER_RADIUS = 1;

/**
 * 円形に並んだバーが音声で放射方向に伸縮する、レコード盤スペクトラムアナライザー風のシーン(WebGL)。
 * カラーパレット対応。手動トリガー3種対応。Bar Spectrum(1次元配列)の円形配置版。
 */
const createRadialBarSpectrumScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let instancedMesh: THREE.InstancedMesh;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  const scene: Scene = {
    name: "Radial Bar Spectrum",
    supportsPalette: true,
    triggerEffectNames: ["Height Kick", "Color Flip", "White Flash"],
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(0, 0, 7);

      renderScene.add(new THREE.AmbientLight(0xffffff, 0.4));
      const light = new THREE.DirectionalLight(0xffffff, 1.4);
      light.position.set(2, 3, 5);
      renderScene.add(light);

      const geometry = new THREE.BoxGeometry(0.12, 1, 0.12);
      const material = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2 });
      instancedMesh = new THREE.InstancedMesh(geometry, material, BAR_COUNT);
      instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BAR_COUNT * 3), 3);
      renderScene.add(instancedMesh);
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
      const bass = Math.min(2.5, ctx.audio.bass);
      const mid = Math.min(2.5, ctx.audio.mid);
      const treble = Math.min(2.5, ctx.audio.treble);

      // Trigger 1(Height Kick): 発生中は全バーの長さに一時的なオフセットを加える
      const heightKick = ctx.triggers[0] * 2;
      // Trigger 2(Color Flip): 発生中はmain/subの補間方向を反転させる
      const flip = ctx.triggers[1] > 0.5;
      // Trigger 3(White Flash): 発生中は配色を白へ寄せる
      const whiteMix = ctx.triggers[2];

      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      for (let i = 0; i < BAR_COUNT; i++) {
        const angle = (i / BAR_COUNT) * Math.PI * 2;
        // 円環なので0と1が隣接することを考慮し、対角線上で低域/中域/高域を対称に割り当てる
        const pos = Math.abs(((i / BAR_COUNT) * 2) % 2 - 1);
        const bassWeight = Math.max(0, 1 - pos * 2);
        const trebleWeight = Math.max(0, pos * 2 - 1);
        const midWeight = 1 - bassWeight - trebleWeight;
        const n = Math.sin(angle * 3 + ctx.time * 2) * 0.5 + 0.5;
        const level = Math.min(2.5, (bass * bassWeight + mid * midWeight + treble * trebleWeight) * n);
        const length = 0.4 + level * 1.8 + heightKick;

        const cx = Math.cos(angle) * (INNER_RADIUS + length / 2);
        const cy = Math.sin(angle) * (INNER_RADIUS + length / 2);
        dummy.position.set(cx, cy, 0);
        dummy.rotation.z = angle - Math.PI / 2;
        dummy.scale.set(1, Math.max(0.05, length), 1);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);

        const colorT = flip ? 1 - pos : pos;
        const r = mr + (sr - mr) * colorT;
        const g = mg + (sg - mg) * colorT;
        const b = mb + (sb - mb) * colorT;
        color.setRGB(r + (1 - r) * whiteMix, g + (1 - g) * whiteMix, b + (1 - b) * whiteMix);
        instancedMesh.setColorAt(i, color);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createRadialBarSpectrumScene;
