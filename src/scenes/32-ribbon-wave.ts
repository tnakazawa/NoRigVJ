import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const CURVE_POINTS = 48;
const TUBULAR_SEGMENTS = 64;
const RADIAL_SEGMENTS = 8;

const vertexShader = `
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 uMainColor;
  uniform vec3 uSubColor;
  uniform float uVolume;
  uniform float uFlash;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    float volume = clamp(uVolume, 0.0, 2.0);
    vec3 light = normalize(vec3(0.4, 0.6, 1.0));
    float diffuse = max(dot(normalize(vNormal), light), 0.0);

    // uv.xはチューブに沿った位置(0-1)。これでリボンの根元から先端へmain→subのグラデーションにする
    vec3 color = mix(uMainColor, uSubColor, vUv.x);
    color = mix(color, vec3(1.0), uFlash);
    gl_FragColor = vec4(color * (0.3 + diffuse * 0.8) * (0.7 + volume * 0.3), 1.0);
  }
`;

/**
 * チューブ状のリボンが波打つようにうねるシーン(WebGL)。カラーパレット対応。手動トリガー2種対応。
 * 帯状の連続体という既存にない形状。毎フレーム`THREE.TubeGeometry`を制御点から作り直す
 * (頂点attributeの書き換えではなくジオメトリ自体を再構築する、他シーンには無いパターン。
 * セグメント数を抑えているため実用上問題にならない)。
 */
const createRibbonWaveScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let mesh: THREE.Mesh;
  let material: THREE.ShaderMaterial;

  const scene: Scene = {
    name: "Ribbon Wave",
    supportsPalette: true,
    triggerEffectNames: ["Wave Kick", "Flash", undefined],
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(0, 1.5, 7);
      camera.lookAt(0, 0, 0);

      material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uMainColor: { value: new THREE.Vector3() },
          uSubColor: { value: new THREE.Vector3() },
          uVolume: { value: 0 },
          uFlash: { value: 0 },
        },
      });

      // 初期ジオメトリ(render()で毎フレーム作り直す)
      const initialPoints = Array.from({ length: CURVE_POINTS }, (_, i) => {
        const t = i / (CURVE_POINTS - 1);
        return new THREE.Vector3((t - 0.5) * 8, 0, 0);
      });
      const curve = new THREE.CatmullRomCurve3(initialPoints);
      const geometry = new THREE.TubeGeometry(curve, TUBULAR_SEGMENTS, 0.18, RADIAL_SEGMENTS, false);
      mesh = new THREE.Mesh(geometry, material);
      renderScene.add(mesh);
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
      const bass = Math.min(2, ctx.audio.bass);
      const treble = Math.min(2, ctx.audio.treble);
      const volume = Math.min(2, ctx.audio.volume);

      // Trigger 1(Wave Kick): 発生中はうねりの振幅を大きく強める
      const waveKick = ctx.triggers[0] * 1.5;
      const ampY = 0.5 + bass * 0.6 + waveKick;
      const ampZ = 0.3 + treble * 0.4 + waveKick * 0.6;

      const points = Array.from({ length: CURVE_POINTS }, (_, i) => {
        const t = i / (CURVE_POINTS - 1);
        const x = (t - 0.5) * 8;
        const y = Math.sin(t * Math.PI * 4 + ctx.time * 1.5) * ampY;
        const z = Math.cos(t * Math.PI * 3 + ctx.time * 1.2) * ampZ;
        return new THREE.Vector3(x, y, z);
      });
      const curve = new THREE.CatmullRomCurve3(points);
      mesh.geometry.dispose();
      mesh.geometry = new THREE.TubeGeometry(
        curve,
        TUBULAR_SEGMENTS,
        0.18 + volume * 0.05,
        RADIAL_SEGMENTS,
        false,
      );

      material.uniforms.uMainColor.value.set(...hexToRgb(ctx.palette.main));
      material.uniforms.uSubColor.value.set(...hexToRgb(ctx.palette.sub));
      material.uniforms.uVolume.value = ctx.audio.volume;
      // Trigger 2(Flash): 発生中は白へ寄せる
      material.uniforms.uFlash.value = ctx.triggers[1];

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createRibbonWaveScene;
