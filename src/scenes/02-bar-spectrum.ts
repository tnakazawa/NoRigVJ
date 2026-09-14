import * as THREE from "three";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const BAR_COUNT = 32;

/**
 * 低域〜高域でうねるバーのシーン(WebGL)。左は低域、右は高域に反応する。カラーパレット非対応
 * (時間経過で色相が回転する配色をそのまま活かすため)。奥行き・簡単なライティングによる陰影は
 * WebGLならでは。
 */
const createBarSpectrumScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let instancedMesh: THREE.InstancedMesh;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  const scene: Scene = {
    name: "Bar Spectrum",
    supportsPalette: false,
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(0, 5, 11);
      camera.lookAt(0, 0, 0);

      renderScene.add(new THREE.AmbientLight(0xffffff, 0.35));
      const light = new THREE.DirectionalLight(0xffffff, 1.8);
      light.position.set(3, 6, 6);
      renderScene.add(light);

      const geometry = new THREE.BoxGeometry(0.6, 1, 0.6);
      const material = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2 });
      instancedMesh = new THREE.InstancedMesh(geometry, material, BAR_COUNT);
      instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BAR_COUNT * 3), 3);
      renderScene.add(instancedMesh);
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      // 強度調整(0〜3倍)で音声レベルが1.0を超えても発散しないようクランプする
      const bass = Math.min(1, ctx.audio.bass);
      const mid = Math.min(1, ctx.audio.mid);
      const treble = Math.min(1, ctx.audio.treble);

      for (let i = 0; i < BAR_COUNT; i++) {
        const n = Math.sin(i * 0.5 + ctx.time * 2) * 0.5 + 0.5;

        // バーの位置(0=左端/低域 〜 1=右端/高域)に応じて反応する周波数帯を三角形状に切り替える
        const pos = i / (BAR_COUNT - 1);
        const bassWeight = Math.max(0, 1 - pos * 2);
        const trebleWeight = Math.max(0, pos * 2 - 1);
        const midWeight = 1 - bassWeight - trebleWeight;
        const level = Math.min(1, (bass * bassWeight + mid * midWeight + treble * trebleWeight) * n);
        const height = 0.4 + level * 6;

        dummy.position.set((pos - 0.5) * BAR_COUNT * 0.7, height / 2 - 1.5, 0);
        dummy.scale.set(1, height, 1);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);

        color.setHSL(((200 + i * 6 + ctx.time * 20) % 360) / 360, 0.85, 0.55);
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
