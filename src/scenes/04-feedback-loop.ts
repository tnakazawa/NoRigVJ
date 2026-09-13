import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { SceneContextWebGL, SceneFactory, SceneWebGL } from "./_shared/types";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uPrevFrame;
  uniform float uTime;
  uniform float uVolume;
  uniform float uBass;
  uniform float uTreble;
  uniform float uAspect;
  uniform vec3 uMainColor;
  uniform vec3 uSubColor;
  varying vec2 vUv;

  vec2 rotate(vec2 v, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    mat2 rot = mat2(c, -s, s, c);
    return rot * v;
  }

  void main() {
    // 強度調整(0〜3倍)で音声レベルが1.0を超えても発散しないようクランプする
    float volume = clamp(uVolume, 0.0, 1.0);
    float bass = clamp(uBass, 0.0, 1.0);
    float treble = clamp(uTreble, 0.0, 1.0);

    // canvasの縦横比を補正した中心基準の座標系(これがないとcanvasが正方形でない時に
    // 発光や回転が楕円に潰れる)
    vec2 aspectVec = vec2(uAspect, 1.0);
    vec2 centered = (vUv - 0.5) * aspectVec;

    // 前フレームをわずかに回転・縮小させながらサンプリングし、渦を巻くような残像を作る
    float angle = 0.01 + bass * 0.03;
    vec2 rotated = rotate(centered, angle) * (1.0 - 0.01 - treble * 0.01);
    vec2 uv = rotated / aspectVec + 0.5;
    vec3 prev = texture2D(uPrevFrame, uv).rgb * 0.9;

    // 中心から音量に応じて発光する種火を継ぎ足す(減衰0.9との釣り合いで収束値が1.0を超えないよう調整)
    // 発光色はメイン⇔サブの2色間を時間でゆっくり往復させる(色相が回り続ける表現はやめている)
    float d = length(centered);
    float glow = smoothstep(0.25 * 1.25, 0.0, d) * (0.01 + volume * 0.05 * 1.75);
    float mixAmount = 0.5 + 0.5 * sin(uTime * 0.5);
    vec3 seed = glow * mix(uMainColor, uSubColor, mixAmount);

    gl_FragColor = vec4(prev + seed, 1.0);
  }
`;

// 前フレームの描画結果を歪ませながら次フレームへ重ねるフィードバックループ
const createFeedbackLoopScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  let material: THREE.ShaderMaterial;
  let targetA: THREE.WebGLRenderTarget;
  let targetB: THREE.WebGLRenderTarget;
  let ready = false;

  function ensureRenderTargets(renderer: THREE.WebGLRenderer, width: number, height: number) {
    const pixelRatio = renderer.getPixelRatio();
    const w = Math.max(1, Math.floor(width * pixelRatio));
    const h = Math.max(1, Math.floor(height * pixelRatio));
    if (targetA && targetA.width === w && targetA.height === h) return;
    targetA?.dispose();
    targetB?.dispose();
    targetA = new THREE.WebGLRenderTarget(w, h);
    targetB = new THREE.WebGLRenderTarget(w, h);
  }

  const scene: SceneWebGL = {
    kind: "webgl",
    name: "Feedback Loop",
    supportsPalette: true,
    init(ctx: SceneContextWebGL) {
      renderScene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uPrevFrame: { value: null },
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
      ensureRenderTargets(ctx.renderer, ctx.width, ctx.height);
      ready = true;
    },
    render(ctx: SceneContextWebGL) {
      if (!ready) return;
      ensureRenderTargets(ctx.renderer, ctx.width, ctx.height);

      material.uniforms.uPrevFrame.value = targetA.texture;
      material.uniforms.uTime.value = ctx.time;
      material.uniforms.uVolume.value = ctx.audio.volume;
      material.uniforms.uBass.value = ctx.audio.bass;
      material.uniforms.uTreble.value = ctx.audio.treble;
      material.uniforms.uAspect.value = ctx.width / ctx.height;
      material.uniforms.uMainColor.value.set(...hexToRgb(ctx.palette.main));
      material.uniforms.uSubColor.value.set(...hexToRgb(ctx.palette.sub));

      ctx.renderer.setRenderTarget(targetB);
      ctx.renderer.render(renderScene, camera);

      ctx.renderer.setRenderTarget(null);
      ctx.renderer.render(renderScene, camera);

      const tmp = targetA;
      targetA = targetB;
      targetB = tmp;
    },
  };

  return scene;
};

export default createFeedbackLoopScene;
