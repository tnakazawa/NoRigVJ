import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const BAR_COUNT = 32;

/**
 * 低域〜高域でうねるバーのシーン(WebGL)。左は低域、右は高域に反応する。カラーパレット対応
 * (バーの位置に応じてmain→subへ線形補間)。奥行き・簡単なライティングによる陰影はWebGLならでは。
 * FXパッド対応。
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
    padSupported: true,
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

      // FXパッドX: 中心(0)から左右どちらへ動かしても補間方向を反転させる(絶対値を使い、
      // 左右対称にする。0=通常、|1|=完全反転)
      const flip = Math.abs(ctx.padX);
      // FXパッドY: 全バーの高さに一時的なオフセットを加える(正で伸びる、負で縮む方向。
      // 右下方向を強く感じられるよう可動幅を大きく取っている)
      const heightKick = ctx.padY * 6;

      for (let i = 0; i < BAR_COUNT; i++) {
        const n = Math.sin(i * 0.5 + ctx.time * 2) * 0.5 + 0.5;

        // バーの位置(0=左端/低域 〜 1=右端/高域)に応じて反応する周波数帯を三角形状に切り替える
        const pos = i / (BAR_COUNT - 1);
        const bassWeight = Math.max(0, 1 - pos * 2);
        const trebleWeight = Math.max(0, pos * 2 - 1);
        const midWeight = 1 - bassWeight - trebleWeight;
        const level = Math.min(2.5, (bass * bassWeight + mid * midWeight + treble * trebleWeight) * n);
        // 音声反応の可動幅も拡大(4→6)
        const height = Math.max(0.05, 0.4 + level * 6 + heightKick);

        // 底辺を画面下部寄り(-1.5→-3)にして、下部が寂しくならないようにしている
        dummy.position.set((pos - 0.5) * BAR_COUNT * 0.7, height / 2 - 3, 0);
        dummy.scale.set(1, height, 1);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);

        // バーの位置(0=左端/低域 〜 1=右端/高域)に応じてmain→subへ線形補間する(FXパッドXで反転度合いを調整)
        const colorT = pos + (1 - 2 * pos) * flip;
        color.setRGB(mr + (sr - mr) * colorT, mg + (sg - mg) * colorT, mb + (sb - mb) * colorT);
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
