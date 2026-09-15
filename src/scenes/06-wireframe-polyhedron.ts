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
    triggerEffectNames: ["Spin Kick", "Scale Pulse", "Flash"],
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

      // volume/bassは回転速度・スケールに使うだけで発散の心配がないため、Intensity(0〜9倍)を
      // 上げても変化が続くよう上限は高めにする。trebleは不透明度(0-1の範囲で意味を持つ)用途のため
      // 上限は1のままにする
      const volume = Math.min(3, ctx.audio.volume);
      const bass = Math.min(3, ctx.audio.bass);
      const treble = Math.min(1, ctx.audio.treble);

      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      // Trigger 1(Spin Kick): 発生中は回転速度を一時的にブーストする
      const spinKick = ctx.triggers[0] * 3;
      // Trigger 2(Scale Pulse): 発生中は全多面体を一時的に拡大する
      const scalePulse = ctx.triggers[1] * 0.8;
      // Trigger 3(Flash): 発生中は配色を白へ寄せる
      const whiteMix = ctx.triggers[2];

      meshes.forEach((mesh, i) => {
        // 内側の多面体をmain、外側をsubへ補間した色にする
        const t = i / Math.max(1, meshes.length - 1);
        // 多面体ごとに回転方向を反転させ、見た目に複雑さを出す
        const direction = i % 2 === 0 ? 1 : -1;
        mesh.rotation.x = ctx.time * (0.2 + volume * 0.5 + spinKick) * direction;
        mesh.rotation.y = ctx.time * (0.15 + volume * 0.4 + spinKick);
        mesh.scale.setScalar(1 + bass * 0.3 * (1 - t * 0.3) + scalePulse);

        const material = materials[i];
        const r = mr + (sr - mr) * t;
        const g = mg + (sg - mg) * t;
        const b = mb + (sb - mb) * t;
        material.color.setRGB(r + (1 - r) * whiteMix, g + (1 - g) * whiteMix, b + (1 - b) * whiteMix);
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
