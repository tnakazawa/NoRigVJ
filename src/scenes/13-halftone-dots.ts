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
  uniform float uInvert;
  uniform float uZoom;
  uniform float uFlash;
  varying vec2 vUv;

  void main() {
    // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
    float volume = clamp(uVolume, 0.0, 2.0);
    float bass = clamp(uBass, 0.0, 2.0);

    vec2 aspectVec = vec2(uAspect, 1.0);
    vec2 p = (vUv - 0.5) * aspectVec;

    // Trigger 2(Zoom): 発生中はグリッドを一時的に細かくする
    float gridSize = 0.09 / (1.0 + uZoom * 1.5);
    vec2 cell = floor(p / gridSize);
    vec2 cellCenter = (cell + 0.5) * gridSize;
    vec2 localPos = p - cellCenter;

    // 中心からのリング状の輝度パターンを、時間経過で外側へ広がるように動かす
    float dist = length(p);
    float pattern = sin(dist * 8.0 - uTime * 1.2 - bass * 2.0) * 0.5 + 0.5;
    float radius = gridSize * 0.5 * pattern * (0.5 + volume * 0.6);

    float d = length(localPos);
    float dotMask = smoothstep(radius, radius - 0.006, d);

    // Trigger 1(Invert): 発生中はドット/背景の配色を入れ替える
    vec3 dotColor = mix(uMainColor, uSubColor, uInvert);
    vec3 bgColor = mix(uSubColor, uMainColor, uInvert);
    vec3 color = mix(bgColor * 0.15, dotColor, dotMask);

    // Trigger 3(Flash): 発生中は全体を白へ寄せる
    color = mix(color, vec3(1.0), uFlash);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * 格子状の円ドットが音声で拡縮する、印刷物のハーフトーン風グラフィックのシーン(WebGL)。
 * カラーパレット対応。手動トリガー3種対応。
 */
const createHalftoneDotsScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  let material: THREE.ShaderMaterial;

  const scene: Scene = {
    name: "Halftone Dots",
    supportsPalette: true,
    triggerEffectNames: ["Invert", "Zoom", "Flash"],
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
          uInvert: { value: 0 },
          uZoom: { value: 0 },
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
      material.uniforms.uAspect.value = ctx.width / ctx.height;
      material.uniforms.uMainColor.value.set(...hexToRgb(ctx.palette.main));
      material.uniforms.uSubColor.value.set(...hexToRgb(ctx.palette.sub));
      material.uniforms.uInvert.value = ctx.triggers[0] > 0.5 ? 1 : 0;
      material.uniforms.uZoom.value = ctx.triggers[1];
      material.uniforms.uFlash.value = ctx.triggers[2];
      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createHalftoneDotsScene;
