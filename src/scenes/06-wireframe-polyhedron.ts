import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

/**
 * 回転する複数のワイヤーフレーム多面体のシーン(WebGL)。カラーパレット対応。
 * 既存シーンは全て正面構図(Orthographic)だが、これは奥行きを持つ `PerspectiveCamera` を使う初のシーン。
 */
const createWireframePolyhedronScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  const meshes: THREE.LineSegments[] = [];
  const materials: THREE.LineBasicMaterial[] = [];

  const scene: Scene = {
    name: "Wireframe Polyhedron",
    supportsPalette: true,
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.z = 6;

      // サイズ違いの多面体を3つ重ねて表示する(頂点変形など複雑な処理は行わず、誇大化を避ける)
      const sizes = [1, 1.6, 2.3];
      for (const size of sizes) {
        const geometry = new THREE.IcosahedronGeometry(size, 0);
        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({ transparent: true });
        const lineSegments = new THREE.LineSegments(edges, material);
        renderScene.add(lineSegments);
        meshes.push(lineSegments);
        materials.push(material);
      }
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      // 強度調整(0〜3倍)で音声レベルが1.0を超えても発散しないようクランプする
      const volume = Math.min(1, ctx.audio.volume);
      const bass = Math.min(1, ctx.audio.bass);
      const treble = Math.min(1, ctx.audio.treble);

      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      meshes.forEach((mesh, i) => {
        // 内側の多面体をmain、外側をsubへ補間した色にする
        const t = i / Math.max(1, meshes.length - 1);
        // 多面体ごとに回転方向を反転させ、見た目に複雑さを出す
        const direction = i % 2 === 0 ? 1 : -1;
        mesh.rotation.x = ctx.time * (0.2 + volume * 0.5) * direction;
        mesh.rotation.y = ctx.time * (0.15 + volume * 0.4);
        mesh.scale.setScalar(1 + bass * 0.3 * (1 - t * 0.3));

        const material = materials[i];
        material.color.setRGB(mr + (sr - mr) * t, mg + (sg - mg) * t, mb + (sb - mb) * t);
        // WebGLの LineBasicMaterial は linewidth がほぼ全ブラウザで1固定になる既知の制限があるため、
        // 「線の太さ」は不透明度で代替してtrebleに反応させる
        material.opacity = 0.6 + treble * 0.4;
      });

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createWireframePolyhedronScene;
