import * as THREE from "three";
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
  varying vec2 vUv;

  vec2 rotate(vec2 uv, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    mat2 rot = mat2(c, -s, s, c);
    return rot * (uv - 0.5) + 0.5;
  }

  void main() {
    // 強度調整(0〜3倍)で音声レベルが1.0を超えても発散しないようクランプする
    float volume = clamp(uVolume, 0.0, 1.0);
    float bass = clamp(uBass, 0.0, 1.0);
    float treble = clamp(uTreble, 0.0, 1.0);

    // 前フレームをわずかに回転・縮小させながらサンプリングし、渦を巻くような残像を作る
    float angle = 0.01 + bass * 0.03;
    vec2 uv = rotate(vUv, angle);
    uv = (uv - 0.5) * (1.0 - 0.01 - treble * 0.01) + 0.5;
    vec3 prev = texture2D(uPrevFrame, uv).rgb * 0.9;

    // 中心から音量に応じて発光する種火を継ぎ足す(減衰0.9との釣り合いで収束値が1.0を超えないよう調整)
    float d = distance(vUv, vec2(0.5));
    float glow = smoothstep(0.25, 0.0, d) * (0.01 + volume * 0.05);
    vec3 seed = glow * (0.5 + 0.5 * vec3(
      sin(uTime * 0.7),
      sin(uTime * 0.9 + 2.0),
      sin(uTime * 1.3 + 4.0)
    ));

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
