import * as THREE from "three";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const BAND_COUNT = 7;
/** 線1本の太さ(画面高さに対する比率) */
const SEGMENT_HEIGHT = 1 / 13;
const CYCLE_HEIGHT = SEGMENT_HEIGHT * BAND_COUNT;

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uOffset;
  uniform vec3 uColors[${BAND_COUNT}];
  uniform float uTrigger0;
  uniform float uTrigger1;
  uniform float uTrigger2;
  varying vec2 vUv;

  void main() {
    // 上から下へ流れるようループさせる(uOffsetは時間経過で単調増加する)
    float y = mod(vUv.y - uOffset, ${CYCLE_HEIGHT.toFixed(8)});
    int index = int(floor(y / ${SEGMENT_HEIGHT.toFixed(8)}));
    vec3 color = uColors[0];
    for (int i = 0; i < ${BAND_COUNT}; i++) {
      if (i == index) color = uColors[i];
    }

    // Trigger 1(Monochrome): 発生中は彩度を落としグレースケールに近づける
    float luminance = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(color, vec3(luminance), uTrigger0);
    // Trigger 2(Pale): 発生中は白へ寄せて淡くする
    color = mix(color, vec3(1.0), uTrigger1 * 0.85);
    // Trigger 3(Darken): 発生中は黒へ寄せて濃く沈める
    color = mix(color, vec3(0.0), uTrigger2 * 0.85);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * 画面いっぱいに引いた虹色の平行線が上から下へ流れ続けるシーン(WebGL)。
 * カラーパレット非対応(虹の配色そのものが特徴のため)。
 */
const createRainbowScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  let material: THREE.ShaderMaterial;
  let offset = 0;
  let lastTime: number | null = null;

  const scene: Scene = {
    name: "Rainbow",
    supportsPalette: false,
    triggerEffectNames: ["Monochrome", "Pale", "Darken"],
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      // 赤(0)〜紫(短波長側、0.8)の範囲で色相を割り当てる
      const colors = Array.from({ length: BAND_COUNT }, (_, i) => {
        const hue = (i / (BAND_COUNT - 1)) * 0.8;
        const c = new THREE.Color().setHSL(hue, 0.9, 0.55);
        return new THREE.Vector3(c.r, c.g, c.b);
      });

      material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uOffset: { value: 0 },
          uColors: { value: colors },
          uTrigger0: { value: 0 },
          uTrigger1: { value: 0 },
          uTrigger2: { value: 0 },
        },
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      renderScene.add(quad);
    },
    render(ctx: SceneContext) {
      // 音量で下降速度を上げるだけで、位置・拡縮の周期的な揺れは持たせない
      const volume = Math.min(2, ctx.audio.volume);
      const speed = 0.1 + volume * 0.15;

      const dt = lastTime === null ? 0 : ctx.time - lastTime;
      lastTime = ctx.time;
      offset = (offset + speed * dt) % CYCLE_HEIGHT;

      material.uniforms.uOffset.value = offset;
      material.uniforms.uTrigger0.value = ctx.triggers[0];
      material.uniforms.uTrigger1.value = ctx.triggers[1];
      material.uniforms.uTrigger2.value = ctx.triggers[2];
      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createRainbowScene;
