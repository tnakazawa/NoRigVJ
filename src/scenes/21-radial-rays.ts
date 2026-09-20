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
  uniform float uSpin;
  uniform float uBurst;
  varying vec2 vUv;

  void main() {
    // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
    float volume = clamp(uVolume, 0.0, 2.0);
    float bass = clamp(uBass, 0.0, 2.0);

    vec2 aspectVec = vec2(uAspect, 1.0);
    vec2 p = (vUv - 0.5) * aspectVec;

    // FXパッドX: 回転速度にオフセットを加える(正で加速、負で逆回転。Spinの連続版)
    float rotation = uTime * (0.15 + uSpin * 2.0);
    float angle = atan(p.y, p.x) + rotation;
    float dist = length(p);

    // 角度方向に複数の周波数のsin波を重ね、光線状のムラを作る
    float rays = sin(angle * 20.0 + uTime * 0.5);
    rays += sin(angle * 33.0 - uTime * 0.3) * 0.5;
    rays += sin(angle * 51.0 + uTime * 0.7 + bass) * 0.3;
    rays = rays * 0.5 + 0.5;
    rays = pow(clamp(rays, 0.0, 1.0), 2.0);

    // FXパッドY: 発光範囲を広げる/狭める(正で広げる、負で狭める。Burstの連続版)
    float falloffRange = clamp(1.0 + uBurst * 2.0, 0.1, 3.0);
    float falloff = smoothstep(falloffRange, 0.0, dist);

    vec3 color = mix(uMainColor, uSubColor, clamp(dist, 0.0, 1.0));
    float brightness = rays * falloff * clamp(0.6 + volume * 0.8 + uBurst * 1.2, 0.0, 3.0);
    gl_FragColor = vec4(color * brightness, 1.0);
  }
`;

/**
 * 中心から放射する光線が明滅するシーン(WebGL)。カラーパレット対応。
 * Plasma Lava/Kaleidoscopeと同じフルスクリーンquad方式だが、放射状の光線という見た目で差別化している。
 * FXパッド対応。
 */
const createRadialRaysScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  let material: THREE.ShaderMaterial;

  const scene: Scene = {
    name: "Radial Rays",
    supportsPalette: true,
    padSupported: true,
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
          uSpin: { value: 0 },
          uBurst: { value: 0 },
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
      material.uniforms.uSpin.value = ctx.padX;
      material.uniforms.uBurst.value = ctx.padY;
      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createRadialRaysScene;
