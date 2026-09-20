import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const GRID_SIZE = 12;
const CUBE_COUNT = GRID_SIZE * GRID_SIZE;
const SPACING = 0.9;

/**
 * 格子状に並んだ3Dキューブが音声で上下するシーン(WebGL)。カラーパレット対応。
 * Bar Spectrum(1次元配列のバー)の2次元グリッド版だが、都市のビル群のような俯瞰構図で見た目は大きく異なる。
 * FXパッド対応。
 */
const createInstancedCubeGridScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let instancedMesh: THREE.InstancedMesh;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  const scene: Scene = {
    name: "Instanced Cube Grid",
    supportsPalette: true,
    padSupported: true,
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(0, 7, 8);
      camera.lookAt(0, 0, 0);

      renderScene.add(new THREE.AmbientLight(0xffffff, 0.35));
      const light = new THREE.DirectionalLight(0xffffff, 1.6);
      light.position.set(4, 6, 4);
      renderScene.add(light);

      const geometry = new THREE.BoxGeometry(0.6, 1, 0.6);
      const material = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2 });
      instancedMesh = new THREE.InstancedMesh(geometry, material, CUBE_COUNT);
      instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CUBE_COUNT * 3), 3);
      renderScene.add(instancedMesh);
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
      const bass = Math.min(2.5, ctx.audio.bass);
      const treble = Math.min(2.5, ctx.audio.treble);

      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);
      const half = (GRID_SIZE - 1) / 2;

      // FXパッドX: 正で白へ、負で黒へ寄せる対称式(0で通常の配色、White Flashの連続版)
      const whiteMix = ctx.padX;
      const toFlash = (c: number) => (whiteMix >= 0 ? c + (1 - c) * whiteMix : c * (1 + whiteMix));
      // FXパッドY: 全キューブの高さにオフセットを加える(正で伸びる、負で縮む方向、Height Kickの連続版)。
      // 以前あったWave Pulse(波紋の振幅増幅)はHeight Kickと効果が似て重複するため今回は見送った
      const heightKick = ctx.padY * 2.5;

      let i = 0;
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        for (let gz = 0; gz < GRID_SIZE; gz++) {
          const x = (gx - half) * SPACING;
          const z = (gz - half) * SPACING;
          // 中心からの距離に応じて波紋状に位相をずらす。中心寄りはbass、外側はtrebleに反応させる
          const dist = Math.hypot(gx - half, gz - half) / half;
          const wave = Math.sin(dist * 6 - ctx.time * 2.5) * 0.5 + 0.5;
          const level = (bass * (1 - dist) + treble * dist) * wave;
          const height = 0.3 + level * 3 + heightKick;

          dummy.position.set(x, height / 2 - 0.5, z);
          dummy.scale.set(1, Math.max(0.05, height), 1);
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(i, dummy.matrix);

          // 距離(中心=main、外側=sub)に応じて配色する
          const r = mr + (sr - mr) * dist;
          const g = mg + (sg - mg) * dist;
          const b = mb + (sb - mb) * dist;
          color.setRGB(toFlash(r), toFlash(g), toFlash(b));
          instancedMesh.setColorAt(i, color);
          i++;
        }
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createInstancedCubeGridScene;
