import * as THREE from "three";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const BAND_COUNT = 7;

/** 虹色の弧を積み重ねたシーン(WebGL)。カラーパレット非対応(虹の配色そのものが特徴のため)。 */
const createRainbowScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  const arcs: THREE.Mesh[] = [];
  const materials: THREE.MeshBasicMaterial[] = [];

  const scene: Scene = {
    name: "Rainbow",
    supportsPalette: false,
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(0, -0.5, 8);
      camera.lookAt(0, 0.5, 0);

      for (let i = 0; i < BAND_COUNT; i++) {
        const radius = 2.0 + i * 0.28;
        // arc(第5引数)にPIを渡し、トーラスを半周だけにして虹のアーチ形状にする
        const geometry = new THREE.TorusGeometry(radius, 0.12, 16, 64, Math.PI);
        // 赤(0)〜紫(短波長側、0.8)の範囲で色相を割り当てる
        const hue = (i / (BAND_COUNT - 1)) * 0.8;
        const material = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(hue, 0.9, 0.55),
          transparent: true,
        });
        const mesh = new THREE.Mesh(geometry, material);
        renderScene.add(mesh);
        arcs.push(mesh);
        materials.push(material);
      }
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      // 速度・スケール・発光強度にしか使わないため、Intensity(0〜9倍)を上げても
      // 変化が続くよう上限は高めにクランプする
      const bass = Math.min(2, ctx.audio.bass);
      const volume = Math.min(2, ctx.audio.volume);
      const treble = Math.min(2, ctx.audio.treble);

      arcs.forEach((arc, i) => {
        // bassでアーチ全体がゆっくり脈打つように拡縮する(帯ごとに位相をずらす)
        const scale = 1 + bass * 0.15 * Math.sin(ctx.time * 1.5 + i * 0.3);
        arc.scale.setScalar(scale);
        materials[i].opacity = 0.6 + volume * 0.3;
      });
      // trebleでアーチ全体をゆっくり左右に揺らす
      renderScene.rotation.z = Math.sin(ctx.time * 0.4) * treble * 0.08;

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createRainbowScene;
