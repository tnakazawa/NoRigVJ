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
  varying vec2 vUv;

  void main() {
    // 強度調整(0〜3倍)で音声レベルが1.0を超えても発散しないようクランプする
    float volume = clamp(uVolume, 0.0, 1.0);
    float bass = clamp(uBass, 0.0, 1.0);
    float treble = clamp(uTreble, 0.0, 1.0);

    vec2 aspectVec = vec2(uAspect, 1.0);
    vec2 p = (vUv - 0.5) * aspectVec;

    // trebleで回転速度を変えつつ、極座標に変換する
    float rotation = uTime * (0.2 + treble * 0.6);
    float angle = atan(p.y, p.x) + rotation;
    float radius = length(p);

    // bassで分割数(5〜11)を段階的に変え、角度をセグメント内に鏡映対称で折り返すことで
    // 万華鏡状の反復模様を作る
    float segments = floor(5.0 + bass * 6.0);
    float segAngle = 6.28318530718 / segments;
    float a = mod(angle, segAngle);
    a = abs(a - segAngle * 0.5);

    float v = sin(radius * 12.0 - uTime * 1.5) * 0.5 + 0.5;
    v *= sin(a * 10.0) * 0.5 + 0.5;

    vec3 color = mix(uMainColor, uSubColor, v);
    float brightness = 0.4 + volume * 0.8;
    gl_FragColor = vec4(color * brightness, 1.0);
  }
`;

/** 極座標の角度分割による万華鏡状の反復模様のシーン(WebGL)。カラーパレット対応。 */
const createKaleidoscopeScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  let material: THREE.ShaderMaterial;

  const scene: Scene = {
    name: "Kaleidoscope",
    supportsPalette: true,
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
      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createKaleidoscopeScene;
