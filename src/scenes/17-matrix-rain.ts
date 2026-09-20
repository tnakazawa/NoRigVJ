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
  uniform float uBass;
  uniform float uAspect;
  uniform vec3 uMainColor;
  uniform vec3 uSubColor;
  uniform float uSpeedBoost;
  uniform float uFlash;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    // 列の流れ速度に直結するため、上げすぎると判読できなくなり見た目が崩れる上限で控えめにクランプする
    float bass = clamp(uBass, 0.0, 1.5);

    vec2 aspectVec = vec2(uAspect, 1.0);
    vec2 p = vUv * aspectVec;

    float cols = 40.0;
    float col = floor(p.x * cols / aspectVec.x);
    float colSeed = hash(vec2(col, 0.0));
    // FXパッドX: 列の流れ速度にオフセットを加える(正で加速、負で減速。Speed Burstの連続版)
    float speed = max(0.05, 0.4 + colSeed * 1.2 + bass * 0.6 + uSpeedBoost * 3.0);
    // 列ごとにランダムな位相を持たせ、上から下へ流れる先頭位置(0-1)を求める
    float head = fract(uTime * speed + colSeed * 10.0);

    // 上が0、下が1になるよう反転させ、「上から下へ流れる」向きに合わせる
    float y = 1.0 - vUv.y;
    float dist = fract(head - y);
    float trailLength = 0.35;
    float brightness = smoothstep(trailLength, 0.0, dist);

    // グリフのちらつき: 格子状のセルをランダムにON/OFFし、時間経過で切り替える
    float rows = 24.0;
    float rowIndex = floor(vUv.y * rows + floor(uTime * 3.0));
    float glyph = step(0.5, hash(vec2(col, rowIndex)));

    vec3 color = uMainColor * brightness * glyph;
    // 先頭付近だけsub色で明るく光らせる(古典的なデジタル雨の演出)
    color += uSubColor * smoothstep(0.05, 0.0, dist) * glyph;

    // FXパッドY: 白(正)/黒(負)へ寄せる対称式(Flashの連続版)
    if (uFlash >= 0.0) {
      color = color + (1.0 - color) * uFlash;
    } else {
      color = color * (1.0 + uFlash);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * デジタル文字風のブロックが列ごとに上から下へ流れ落ちるシーン(WebGL)。カラーパレット対応
 * (mainが文字色、subが先頭のハイライト色)。実際の文字グリフは描画せず、
 * 格子状のON/OFFパターンで「文字列が流れる」印象を作る(誇大化を避けるため、フォントレンダリングは行わない)。
 * FXパッド対応。
 */
const createMatrixRainScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  let material: THREE.ShaderMaterial;

  const scene: Scene = {
    name: "Matrix Rain",
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
          uBass: { value: 0 },
          uAspect: { value: 1 },
          uMainColor: { value: new THREE.Vector3() },
          uSubColor: { value: new THREE.Vector3() },
          uSpeedBoost: { value: 0 },
          uFlash: { value: 0 },
        },
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      renderScene.add(quad);
    },
    render(ctx: SceneContext) {
      material.uniforms.uTime.value = ctx.time;
      material.uniforms.uBass.value = ctx.audio.bass;
      material.uniforms.uAspect.value = ctx.width / ctx.height;
      material.uniforms.uMainColor.value.set(...hexToRgb(ctx.palette.main));
      material.uniforms.uSubColor.value.set(...hexToRgb(ctx.palette.sub));
      material.uniforms.uSpeedBoost.value = ctx.padX;
      material.uniforms.uFlash.value = ctx.padY;
      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createMatrixRainScene;
