import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uVolume;
  uniform float uBass;
  uniform float uAspect;
  uniform vec3 uMainColor;
  uniform vec3 uSubColor;
  uniform float uBrighten;
  uniform float uRipple;
  varying vec2 vUv;

  // 1本のカーテン状の帯を描く。centerY(0-1)を中心にガウシアン状に減衰する明るさを返す
  float band(vec2 p, float centerY, float width) {
    float d = (p.y - centerY) / width;
    return exp(-d * d);
  }

  void main() {
    // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
    float volume = clamp(uVolume, 0.0, 2.0);
    float bass = clamp(uBass, 0.0, 2.0);

    vec2 aspectVec = vec2(uAspect, 1.0);
    vec2 p = vUv * aspectVec;

    // Trigger 2(Ripple): 発生中は波の振幅を大きく強め、カーテンを激しく揺らす
    float rippleAmp = 1.0 + uRipple * 4.0;
    float wave1 = sin(p.x * 2.5 + uTime * 0.35) * 0.12 * rippleAmp;
    float wave2 = sin(p.x * 4.0 - uTime * 0.55 + 2.0) * 0.08 * rippleAmp;
    float wave3 = sin(p.x * 6.5 + uTime * 0.8 + bass) * 0.05 * rippleAmp;

    // 複数レイヤーを重ねて厚みのあるカーテンにする(帯ごとに高さ・幅・配色をずらす)
    float b1 = band(p, 0.55 * aspectVec.y + wave1, 0.12);
    float b2 = band(p, 0.62 * aspectVec.y + wave2, 0.08);
    float b3 = band(p, 0.48 * aspectVec.y + wave3, 0.06);

    vec3 color = uMainColor * b1 * 0.8;
    color += mix(uMainColor, uSubColor, 0.5) * b2 * 0.7;
    color += uSubColor * b3 * 0.6;

    // Trigger 1(Brighten): 発生中は発光強度を一時的に強める
    float brightness = (0.7 + volume * 0.8) * (1.0 + uBrighten * 2.5);
    gl_FragColor = vec4(color * brightness, 1.0);
  }
`;

/**
 * カーテン状に揺らめくオーロラ光のシーン(WebGL)。カラーパレット対応。手動トリガー2種対応。
 * 複数のsin波を重ねた帯を縦方向のガウシアン減衰で描く、既存にない柔らかい光の表現。
 */
const createAuroraScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  let material: THREE.ShaderMaterial;

  const scene: Scene = {
    name: "Aurora",
    supportsPalette: true,
    triggerEffectNames: ["Brighten", "Ripple", undefined],
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uVolume: { value: 0 },
          uBass: { value: 0 },
          uAspect: { value: 1 },
          uMainColor: { value: new THREE.Vector3() },
          uSubColor: { value: new THREE.Vector3() },
          uBrighten: { value: 0 },
          uRipple: { value: 0 },
        },
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      renderScene.add(quad);
    },
    render(ctx: SceneContext) {
      material.uniforms.uTime.value = ctx.time;
      material.uniforms.uVolume.value = ctx.audio.volume;
      material.uniforms.uBass.value = ctx.audio.bass;
      material.uniforms.uAspect.value = ctx.width / ctx.height;
      material.uniforms.uMainColor.value.set(...hexToRgb(ctx.palette.main));
      material.uniforms.uSubColor.value.set(...hexToRgb(ctx.palette.sub));
      material.uniforms.uBrighten.value = ctx.triggers[0];
      material.uniforms.uRipple.value = ctx.triggers[1];
      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createAuroraScene;
