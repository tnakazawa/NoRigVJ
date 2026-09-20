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
  uniform float uAspect;
  uniform vec3 uMainColor;
  uniform vec3 uSubColor;
  uniform float uCorrupt;
  uniform float uFlash;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
    float volume = clamp(uVolume, 0.0, 2.0);

    vec2 aspectVec = vec2(uAspect, 1.0);
    vec2 p = vUv * aspectVec;

    // ベースの模様: 斜めストライプ(グリッチの土台になる、それ自体は単純な絵柄でよい)
    float stripe = sin((p.x + p.y) * 30.0 + uTime * 0.6) * 0.5 + 0.5;
    vec3 baseColor = mix(uMainColor, uSubColor, stripe);

    // 一定間隔(8fps相当)で切り替わるブロックグリッド。ブロックごとの乱数がしきい値を
    // 超えた時だけグリッチさせ、それ以外は素通しにする
    float glitchStep = floor(uTime * 8.0);
    vec2 block = floor(p * 14.0);
    float blockRand = hash(block + glitchStep);
    // FXパッドY: グリッチのしきい値を連続的に上下させる(以前のCorruptの連続版。正でしきい値を
    // 下げて常時グリッチに近づけ、負でしきい値を上げてグリッチを鎮める対称的な軸)
    float threshold = clamp(0.9 - uCorrupt * 0.85, 0.0, 1.0);
    float isGlitching = step(threshold, blockRand + volume * 0.1);

    // グリッチ発生ブロックは横方向にランダムにずらしたRGBずらし風の配色にする
    float shift = (hash(block + glitchStep + 5.0) - 0.5) * 0.08;
    float stripeShifted = sin((p.x + shift + p.y) * 30.0 + uTime * 0.6) * 0.5 + 0.5;
    vec3 glitchColor = mix(uSubColor, uMainColor, stripeShifted);
    // ランダムに反転させ、ノイズ感を強める
    glitchColor = mix(glitchColor, 1.0 - glitchColor, step(0.5, hash(block + glitchStep + 9.0)));

    vec3 color = mix(baseColor, glitchColor, isGlitching);
    // FXパッドX: 正で白へ、負で黒へ寄せる(0で通常の配色、Flashの連続版)
    color = uFlash >= 0.0 ? mix(color, vec3(1.0), uFlash) : color * (1.0 + uFlash);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * 画面がブロック単位でデジタル的に乱れるグリッチノイズのシーン(WebGL)。カラーパレット対応。
 * Matrix Rainと同じ「デジタル」な質感だが、破損・ズレというグリッチ特有の
 * 表現で差別化している。FXパッド対応。
 */
const createGlitchBlocksScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  let material: THREE.ShaderMaterial;

  const scene: Scene = {
    name: "Glitch Blocks",
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
          uAspect: { value: 1 },
          uMainColor: { value: new THREE.Vector3() },
          uSubColor: { value: new THREE.Vector3() },
          uCorrupt: { value: 0 },
          uFlash: { value: 0 },
        },
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      renderScene.add(quad);
    },
    render(ctx: SceneContext) {
      material.uniforms.uTime.value = ctx.time;
      material.uniforms.uVolume.value = ctx.audio.volume;
      material.uniforms.uAspect.value = ctx.width / ctx.height;
      material.uniforms.uMainColor.value.set(...hexToRgb(ctx.palette.main));
      material.uniforms.uSubColor.value.set(...hexToRgb(ctx.palette.sub));
      material.uniforms.uCorrupt.value = ctx.padY;
      material.uniforms.uFlash.value = ctx.padX;
      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createGlitchBlocksScene;
