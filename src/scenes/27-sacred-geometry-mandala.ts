import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const PETAL_COUNT = 6;

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
  uniform float uBloom;
  uniform float uSpinBurst;
  uniform float uFlash;
  varying vec2 vUv;

  // 円の輪郭線(distanceがradiusに近いほど明るい)を返す
  float ring(vec2 p, vec2 center, float radius, float width) {
    float d = abs(length(p - center) - radius);
    return smoothstep(width, 0.0, d);
  }

  void main() {
    // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
    float volume = clamp(uVolume, 0.0, 2.0);
    float bass = clamp(uBass, 0.0, 2.0);
    float treble = clamp(uTreble, 0.0, 2.0);

    vec2 aspectVec = vec2(uAspect, 1.0);
    vec2 p = (vUv - 0.5) * aspectVec;

    // Trigger 1(Bloom): 発生中は花が開くように半径を大きく広げる
    float radius = (0.22 + bass * 0.06) * (1.0 + uBloom * 1.2);
    float width = 0.008 + volume * 0.004;
    // Trigger 2(Spin Burst): 発生中は回転速度を大幅にブーストする
    float rotation = uTime * (0.15 + treble * 0.3 + uSpinBurst * 3.0);

    // 中心円+周囲6個の円を重ねる、古典的な「生命の花」模様の基本形
    float pattern = ring(p, vec2(0.0), radius, width);
    for (int i = 0; i < ${PETAL_COUNT}; i++) {
      float angle = (float(i) / ${PETAL_COUNT}.0) * 6.28318530718 + rotation;
      vec2 center = vec2(cos(angle), sin(angle)) * radius;
      pattern += ring(p, center, radius, width);
    }
    pattern = clamp(pattern, 0.0, 1.0);

    float t = clamp(length(p) / (radius * 2.0), 0.0, 1.0);
    vec3 color = mix(uMainColor, uSubColor, t) * pattern * (0.6 + volume * 0.8);
    // Trigger 3(Flash): 発生中は白へ寄せる
    color = mix(color, vec3(1.0) * pattern, uFlash);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * 重なる円が「生命の花」状の幾何学模様を作るシーン(WebGL)。カラーパレット対応。手動トリガー3種対応。
 * Kaleidoscopeと同じフルスクリーンquad方式だが、角度分割の反復模様ではなく円の重なりで模様を作る点で
 * 差別化している。
 */
const createSacredGeometryMandalaScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  let material: THREE.ShaderMaterial;

  const scene: Scene = {
    name: "Sacred Geometry Mandala",
    supportsPalette: true,
    triggerEffectNames: ["Bloom", "Spin Burst", "Flash"],
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
          uBloom: { value: 0 },
          uSpinBurst: { value: 0 },
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
      material.uniforms.uBloom.value = ctx.triggers[0];
      material.uniforms.uSpinBurst.value = ctx.triggers[1];
      material.uniforms.uFlash.value = ctx.triggers[2];
      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createSacredGeometryMandalaScene;
