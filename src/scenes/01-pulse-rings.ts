import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const RING_COUNT = 5;

/** 音量に反応する同心円(トーラス)のシーン(WebGL)。カラーパレット対応。FXパッド対応。 */
const createPulseRingsScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  const rings: THREE.Mesh[] = [];
  const ringMaterials: THREE.MeshBasicMaterial[] = [];

  const scene: Scene = {
    name: "Pulse Rings",
    supportsPalette: true,
    padSupported: true,
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.z = 8;

      const ringGeometry = new THREE.TorusGeometry(1, 0.05, 16, 64);
      for (let i = 0; i < RING_COUNT; i++) {
        const material = new THREE.MeshBasicMaterial({ transparent: true });
        const mesh = new THREE.Mesh(ringGeometry, material);
        // わずかに奥行きをずらして重なりに立体感を出す(既存Canvas版は完全に正面構図だった)
        mesh.position.z = -i * 0.4;
        renderScene.add(mesh);
        rings.push(mesh);
        ringMaterials.push(material);
      }
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      // 音声反応が敏感すぎたため、1.2で割って落ち着かせる(Canvas版を踏襲)。
      // bassは半径のうねり幅に使うため、Intensity(0〜9倍)を上げても変化が続くよう上限を高めにしている
      const bass = Math.min(3, ctx.audio.bass) / 1.2;
      const volume = Math.min(1, ctx.audio.volume) / 1.2;

      // FXパッドX: 中心(0)から左右どちらへ動かしても補間方向を反転させる(絶対値を使い、
      // 左右対称にする。0=通常、|1|=完全反転)
      const flip = Math.abs(ctx.padX);
      // FXパッドY: 全リングの半径に一時的なオフセットを加える(正で膨らむ、負で縮む方向。
      // 右下方向を強く感じられるよう、画面をはみ出すレベルまで大きく振れるようにしている)
      const radiusKick = ctx.padY * 5;

      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      for (let i = 0; i < RING_COUNT; i++) {
        const t = ctx.time * 0.6 + i * 0.4;
        const scale = 0.6 + (i * 0.5 + bass * 2.0) * (0.6 + 0.4 * Math.sin(t)) + radiusKick;
        rings[i].scale.setScalar(Math.max(0.05, scale));

        const baseT = i / (RING_COUNT - 1);
        const colorT = baseT + (1 - 2 * baseT) * flip;
        ringMaterials[i].color.setRGB(mr + (sr - mr) * colorT, mg + (sg - mg) * colorT, mb + (sb - mb) * colorT);
        ringMaterials[i].opacity = 0.5 + volume * 0.5;
      }

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createPulseRingsScene;
