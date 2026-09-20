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
  uniform float uShuffle;
  uniform float uFlash;
  varying vec2 vUv;

  // グリッドセルのIDから、そのセル内のランダムな点の位置(0-1)を求める(Worley noiseの定石)
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453123);
  }

  void main() {
    // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
    float volume = clamp(uVolume, 0.0, 2.0);
    float bass = clamp(uBass, 0.0, 2.0);

    vec2 aspectVec = vec2(uAspect, 1.0);
    // FXパッドX: 格子密度を連続的に変える(正で密に細かいセルへ、負で粗く大きいセルへ。Shuffleの連続版)
    float gridScale = clamp(6.0 + uShuffle * 5.0, 2.0, 11.0);
    vec2 p = vUv * aspectVec * gridScale;

    vec2 cellId = floor(p);
    float minDist = 8.0;
    float secondMinDist = 8.0;
    vec2 nearestCellId = cellId;

    // 3x3の近傍セルだけ調べれば最近傍点は必ず見つかる(Worley noiseの定石)
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 neighborId = cellId + neighbor;
        vec2 point = hash2(neighborId);
        // bassで点をゆっくり揺らす
        point = 0.5 + 0.5 * sin(uTime * (0.3 + bass * 0.4) + 6.28318530718 * point);
        vec2 diff = neighbor + point - fract(p);
        float dist = length(diff);
        if (dist < minDist) {
          secondMinDist = minDist;
          minDist = dist;
          nearestCellId = neighborId;
        } else if (dist < secondMinDist) {
          secondMinDist = dist;
        }
      }
    }

    // 最近傍と次点の距離差が小さいほどセル境界に近い
    float edge = secondMinDist - minDist;
    float edgeLine = smoothstep(0.0, 0.06 + volume * 0.04, edge);

    // セルごとにhashからmain/sub間の色を1色決める
    float cellT = hash2(nearestCellId).x;
    vec3 cellColor = mix(uMainColor, uSubColor, cellT);
    vec3 color = mix(vec3(0.0), cellColor, edgeLine);

    // FXパッドY: 白(正)/黒(負)へ寄せる対称式(Flashの連続版、Noise Fieldと同じ考え方)
    if (uFlash >= 0.0) {
      color = color + (1.0 - color) * uFlash;
    } else {
      color = color * (1.0 + uFlash);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * 不規則なセル境界が浮かび上がるVoronoi(Worley noise)模様のシーン(WebGL)。カラーパレット対応。
 * Kaleidoscope/Halftone Dotsと同じフルスクリーンquad方式だが、
 * 規則的な反復ではなく不規則な多角形セルという見た目で差別化している。FXパッド対応。
 */
const createVoronoiCellsScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.OrthographicCamera;
  let material: THREE.ShaderMaterial;

  const scene: Scene = {
    name: "Voronoi Cells",
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
          uShuffle: { value: 0 },
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
      material.uniforms.uShuffle.value = ctx.padX;
      material.uniforms.uFlash.value = ctx.padY;
      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createVoronoiCellsScene;
