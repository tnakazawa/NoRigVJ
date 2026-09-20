import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const NUM_POINTS = 400;

/**
 * リサージュ曲線を描く発光ラインのシーン(WebGL)。カラーパレット対応。FXパッド対応。
 * 既存シーンは全て面(塗りつぶし)で構成されているが、これは唯一の線画表現。
 */
const createLissajousLinesScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  let line: THREE.Line;

  const scene: Scene = {
    name: "Lissajous Lines",
    supportsPalette: true,
    padSupported: true,
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
      camera.position.z = 1;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NUM_POINTS * 3), 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(NUM_POINTS * 3), 3));

      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
      });
      line = new THREE.Line(geometry, material);
      renderScene.add(line);
    },
    render(ctx: SceneContext) {
      camera.left = -ctx.width / ctx.height;
      camera.right = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      // 周波数比に直結し、上げすぎると模様が判読できなくなるため上限は控えめにしている
      const bass = Math.min(2, ctx.audio.bass);
      const treble = Math.min(2, ctx.audio.treble);
      const volume = Math.min(2, ctx.audio.volume);

      // FXパッドX: 周波数比への加算オフセット(Ratio Kickの連続版)。正で模様を大きく歪ませ、
      // 負で逆方向に歪ませる(0.5を下限にクランプし、模様が完全に潰れないようにする)
      const ratioKick = ctx.padX * 3;
      const freqA = Math.max(0.5, 3 + bass * 2 + ratioKick);
      const freqB = 2 + treble * 2;

      // FXパッドY: 正で白へ・負で黒へ寄せる(0で通常の配色。Flashの連続版で、Noise Fieldと同じ対称式)
      const flash = ctx.padY;
      const toFlash = (c: number) => (flash >= 0 ? c + (1 - c) * flash : c * (1 + flash));

      const positionAttr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
      const colorAttr = line.geometry.getAttribute("color") as THREE.BufferAttribute;
      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      for (let i = 0; i < NUM_POINTS; i++) {
        const t = (i / (NUM_POINTS - 1)) * Math.PI * 2;
        const x = Math.sin(freqA * t + ctx.time * 0.3) * 1.5;
        const y = Math.sin(freqB * t + ctx.time * 0.5) * 1.5;
        positionAttr.setXYZ(i, x, y, 0);

        const colorT = i / (NUM_POINTS - 1);
        const r = mr + (sr - mr) * colorT;
        const g = mg + (sg - mg) * colorT;
        const b = mb + (sb - mb) * colorT;
        colorAttr.setXYZ(i, toFlash(r), toFlash(g), toFlash(b));
      }
      positionAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

      (line.material as THREE.LineBasicMaterial).opacity = 0.6 + volume * 0.4;

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createLissajousLinesScene;
