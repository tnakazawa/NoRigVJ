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
  uniform float uTreble;
  uniform float uAspect;
  uniform vec3 uMainColor;
  uniform vec3 uSubColor;
  uniform float uModeShift;
  uniform float uFlash;
  varying vec2 vUv;

  // Chladni図形: sin(nπx)sin(mπy) - sin(mπx)sin(nπy) の値が0に近い場所(定常波の節)に砂が集まる
  float chladni(vec2 p, float n, float m) {
    return sin(n * 3.14159265 * p.x) * sin(m * 3.14159265 * p.y)
      - sin(m * 3.14159265 * p.x) * sin(n * 3.14159265 * p.y);
  }

  void main() {
    // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
    float volume = clamp(uVolume, 0.0, 2.0);
    float bass = clamp(uBass, 0.0, 2.0);
    float treble = clamp(uTreble, 0.0, 2.0);

    vec2 aspectVec = vec2(uAspect, 1.0);
    vec2 p = vUv * aspectVec;

    // Trigger 1(Mode Shift): 発生中は振動モード(n, m)を大きくジャンプさせ、模様を組み替える
    float n = 3.0 + floor(bass * 2.0) + uModeShift * 6.0;
    float m = 2.0 + floor(treble * 2.0);

    float v = chladni(p, n, m);
    // 振動が速く切り替わりすぎないよう、ゆっくり時間で位相をずらす
    v += 0.15 * sin(uTime * 0.3);

    // 節(0に近い)ほど砂が集まって明るく見える
    float edge = 0.04 + volume * 0.02;
    float sand = 1.0 - smoothstep(0.0, edge, abs(v));

    vec3 color = mix(uMainColor * 0.08, uSubColor, sand);
    // Trigger 2(Flash): 発生中は白へ寄せる
    color = mix(color, vec3(1.0), uFlash);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * 振動する板の上で砂が集まるChladni図形のシーン(WebGL)。カラーパレット対応。手動トリガー2種対応。
 * 音楽的な定常波のパターンという、既存シーンにない題材。
 */
const createChladniPatternsScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  let material: THREE.ShaderMaterial;

  const scene: Scene = {
    name: "Chladni Patterns",
    supportsPalette: true,
    triggerEffectNames: ["Mode Shift", "Flash", undefined],
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
          uTreble: { value: 0 },
          uAspect: { value: 1 },
          uMainColor: { value: new THREE.Vector3() },
          uSubColor: { value: new THREE.Vector3() },
          uModeShift: { value: 0 },
          uFlash: { value: 0 },
        },
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      renderScene.add(quad);
    },
    render(ctx: SceneContext) {
      material.uniforms.uTime.value = ctx.time;
      material.uniforms.uVolume.value = ctx.audio.volume;
      material.uniforms.uBass.value = ctx.audio.bass;
      material.uniforms.uTreble.value = ctx.audio.treble;
      material.uniforms.uAspect.value = ctx.width / ctx.height;
      material.uniforms.uMainColor.value.set(...hexToRgb(ctx.palette.main));
      material.uniforms.uSubColor.value.set(...hexToRgb(ctx.palette.sub));
      material.uniforms.uModeShift.value = ctx.triggers[0];
      material.uniforms.uFlash.value = ctx.triggers[1];
      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createChladniPatternsScene;
