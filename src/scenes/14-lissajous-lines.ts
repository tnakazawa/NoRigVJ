import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const NUM_POINTS = 400;

/**
 * リサージュ曲線を描く発光ラインのシーン(WebGL)。カラーパレット対応。手動トリガー2種対応。
 * 既存シーンは全て面(塗りつぶし)で構成されているが、これは唯一の線画表現。
 */
const createLissajousLinesScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  let line: THREE.Line;

  const scene: Scene = {
    name: "Lissajous Lines",
    supportsPalette: true,
    triggerEffectNames: ["Ratio Kick", "Flash", undefined],
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

      // Trigger 1(Ratio Kick): 発生中は周波数比に一時的なオフセットを加え、模様を大きく歪ませる
      const ratioKick = ctx.triggers[0] * 3;
      const freqA = 3 + bass * 2 + ratioKick;
      const freqB = 2 + treble * 2;

      // Trigger 2(Flash): 発生中は白へ寄せて発光を強める
      const flash = ctx.triggers[1];

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
        let r = mr + (sr - mr) * colorT;
        let g = mg + (sg - mg) * colorT;
        let b = mb + (sb - mb) * colorT;
        r += (1 - r) * flash;
        g += (1 - g) * flash;
        b += (1 - b) * flash;
        colorAttr.setXYZ(i, r, g, b);
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
