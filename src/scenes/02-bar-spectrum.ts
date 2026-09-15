import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const BAR_COUNT = 32;

/**
 * 低域〜高域でうねるバーのシーン(WebGL)。左は低域、右は高域に反応する。カラーパレット対応
 * (バーの位置に応じてmain→subへ線形補間)。奥行き・簡単なライティングによる陰影はWebGLならでは。
 * 手動トリガー3種対応。
 */
const createBarSpectrumScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let instancedMesh: THREE.InstancedMesh;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  const scene: Scene = {
    name: "Bar Spectrum",
    supportsPalette: true,
    triggerEffectNames: ["Height Kick", "Color Flip", "White Flash"],
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(0, 5, 11);
      camera.lookAt(0, 0, 0);

      renderScene.add(new THREE.AmbientLight(0xffffff, 0.35));
      const light = new THREE.DirectionalLight(0xffffff, 1.8);
      light.position.set(3, 6, 6);
      renderScene.add(light);

      // バー1本の幅を従来の半分にした(0.6→0.3)
      const geometry = new THREE.BoxGeometry(0.3, 1, 0.3);
      const material = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2 });
      instancedMesh = new THREE.InstancedMesh(geometry, material, BAR_COUNT);
      instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BAR_COUNT * 3), 3);
      renderScene.add(instancedMesh);
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      // Intensity(0〜9倍)を上げても高さの変化が続くよう、上限は高めにクランプする
      const bass = Math.min(2.5, ctx.audio.bass);
      const mid = Math.min(2.5, ctx.audio.mid);
      const treble = Math.min(2.5, ctx.audio.treble);

      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      // Trigger 2(Color Flip): 発生中はmain/subの補間方向を反転させる
      const flip = ctx.triggers[1] > 0.5;
      // Trigger 1(Height Kick): 発生中は全バーの高さに一時的なオフセットを加える
      const heightKick = ctx.triggers[0] * 3;
      // Trigger 3(White Flash): 発生中は配色を白へ寄せる
      const whiteMix = ctx.triggers[2];

      for (let i = 0; i < BAR_COUNT; i++) {
        const n = Math.sin(i * 0.5 + ctx.time * 2) * 0.5 + 0.5;

        // バーの位置(0=左端/低域 〜 1=右端/高域)に応じて反応する周波数帯を三角形状に切り替える
        const pos = i / (BAR_COUNT - 1);
        const bassWeight = Math.max(0, 1 - pos * 2);
        const trebleWeight = Math.max(0, pos * 2 - 1);
        const midWeight = 1 - bassWeight - trebleWeight;
        const level = Math.min(2.5, (bass * bassWeight + mid * midWeight + treble * trebleWeight) * n);
        const height = 0.4 + level * 4 + heightKick;

        dummy.position.set((pos - 0.5) * BAR_COUNT * 0.7, height / 2 - 1.5, 0);
        dummy.scale.set(1, height, 1);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);

        // バーの位置(0=左端/低域 〜 1=右端/高域)に応じてmain→subへ線形補間する(Color Flip発生中は反転)
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

export default createBarSpectrumScene;
