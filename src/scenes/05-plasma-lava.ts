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
  uniform float uPadX;
  uniform float uPadY;
  uniform vec3 uMainColor;
  uniform vec3 uSubColor;
  varying vec2 vUv;

  void main() {
    // 速度・周波数・明るさに使うだけで発散の心配がないため、Intensity(0〜9倍)を
    // 上げても変化が続くよう上限は高めにクランプする
    float volume = clamp(uVolume, 0.0, 3.0);
    float bass = clamp(uBass, 0.0, 3.0);
    float treble = clamp(uTreble, 0.0, 3.0);

    vec2 aspectVec = vec2(uAspect, 1.0);
    vec2 p = (vUv - 0.5) * aspectVec;

    // 古典的なプラズマ効果: 複数方向のsin波を合成する。bassでうねりの速さ、trebleで模様の細かさを変える。
    // FXパッドX: 模様の細かさ(周波数)に正負のオフセットを加える(正で細かく、負で粗く)
    float speed = uTime * (0.5 + bass * 1.5);
    float freq = max(0.5, 3.0 + treble * 6.0 + uPadX * 4.0);

    float v = 0.0;
    v += sin(p.x * freq + speed);
    v += sin(p.y * freq + speed * 1.3);
    v += sin((p.x + p.y) * freq * 0.7 + speed * 0.8);
    v += sin(length(p) * freq * 1.5 - speed * 1.7);
    v = v * 0.25 + 0.5; // -2〜2 の範囲を 0-1 に正規化

    vec3 color = mix(uMainColor, uSubColor, v);
    // FXパッドY: 明るさに正負のオフセットを加える(正で明るく、負で暗く)
    float brightness = clamp(0.4 + volume * 0.8 + uPadY * 0.5, 0.05, 2.0);
    gl_FragColor = vec4(color * brightness, 1.0);
  }
`;

/** 複数のsin波を合成した古典的プラズマ模様のシーン(WebGL)。カラーパレット対応。FXパッド対応。 */
const createPlasmaLavaScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  let material: THREE.ShaderMaterial;

  const scene: Scene = {
    name: "Plasma Lava",
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
          uTreble: { value: 0 },
          uAspect: { value: 1 },
          uPadX: { value: 0 },
          uPadY: { value: 0 },
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
      material.uniforms.uPadX.value = ctx.padX;
      material.uniforms.uPadY.value = ctx.padY;
      material.uniforms.uMainColor.value.set(...hexToRgb(ctx.palette.main));
      material.uniforms.uSubColor.value.set(...hexToRgb(ctx.palette.sub));
      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createPlasmaLavaScene;
