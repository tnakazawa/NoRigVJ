import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const STRAND_POINTS = 48;
const TURNS = 3;
const HEIGHT = 6;
const BASE_RADIUS = 1.2;
/** 塩基対の連結線は見た目が煩雑にならないよう間引いて表示する */
const RUNG_STRIDE = 3;

/**
 * 二重螺旋状に回転する球体列のシーン(WebGL)。カラーパレット対応。
 * 既存シーンにない「螺旋構造」という構図で差別化している。FXパッド対応。
 */
const createDnaHelixScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let group: THREE.Group;
  let strandA: THREE.InstancedMesh;
  let strandB: THREE.InstancedMesh;
  let rungs: THREE.LineSegments;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  const scene: Scene = {
    name: "DNA Helix",
    supportsPalette: true,
    padSupported: true,
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(0, 0, 7);

      renderScene.add(new THREE.AmbientLight(0xffffff, 0.4));
      const light = new THREE.DirectionalLight(0xffffff, 1.5);
      light.position.set(3, 4, 5);
      renderScene.add(light);

      group = new THREE.Group();
      renderScene.add(group);

      const sphereGeometry = new THREE.SphereGeometry(0.14, 12, 12);
      const materialA = new THREE.MeshStandardMaterial({ roughness: 0.4 });
      const materialB = new THREE.MeshStandardMaterial({ roughness: 0.4 });
      strandA = new THREE.InstancedMesh(sphereGeometry, materialA, STRAND_POINTS);
      strandB = new THREE.InstancedMesh(sphereGeometry, materialB, STRAND_POINTS);
      strandA.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(STRAND_POINTS * 3), 3);
      strandB.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(STRAND_POINTS * 3), 3);
      group.add(strandA, strandB);

      const rungCount = Math.floor(STRAND_POINTS / RUNG_STRIDE);
      const rungGeometry = new THREE.BufferGeometry();
      rungGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rungCount * 2 * 3), 3));
      rungGeometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(rungCount * 2 * 3), 3));
      const rungMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6 });
      rungs = new THREE.LineSegments(rungGeometry, rungMaterial);
      group.add(rungs);
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
      const bass = Math.min(2.5, ctx.audio.bass);
      const treble = Math.min(2, ctx.audio.treble);
      const volume = Math.min(2, ctx.audio.volume);

      // FXパッドX: 回転速度にオフセットを加える(正で加速、負で逆回転。Spin Kickの連続版)
      group.rotation.y = ctx.time * (0.3 + bass * 0.4 + ctx.padX * 2);

      // FXパッドY: 螺旋の半径にオフセットを加える(正で膨らむ、負で縮む。Radius Pulseの連続版)。
      // 以前あったFlash(白へ寄せる)はX/Yの2軸で手一杯のため今回は見送った
      const radius = Math.max(0.2, BASE_RADIUS + treble * 0.15 + ctx.padY * 0.8);

      const [mr, mg, mb] = hexToRgb(ctx.palette.main);
      const [sr, sg, sb] = hexToRgb(ctx.palette.sub);

      const rungPositionAttr = rungs.geometry.getAttribute("position") as THREE.BufferAttribute;
      const rungColorAttr = rungs.geometry.getAttribute("color") as THREE.BufferAttribute;
      let rungIndex = 0;

      for (let i = 0; i < STRAND_POINTS; i++) {
        const t = i / (STRAND_POINTS - 1);
        const y = (t - 0.5) * HEIGHT;
        const angle = t * TURNS * Math.PI * 2;

        const xA = Math.cos(angle) * radius;
        const zA = Math.sin(angle) * radius;
        const xB = Math.cos(angle + Math.PI) * radius;
        const zB = Math.sin(angle + Math.PI) * radius;

        dummy.position.set(xA, y, zA);
        dummy.updateMatrix();
        strandA.setMatrixAt(i, dummy.matrix);
        dummy.position.set(xB, y, zB);
        dummy.updateMatrix();
        strandB.setMatrixAt(i, dummy.matrix);

        color.setRGB(mr, mg, mb);
        strandA.setColorAt(i, color);
        color.setRGB(sr, sg, sb);
        strandB.setColorAt(i, color);

        if (i % RUNG_STRIDE === 0 && rungIndex < Math.floor(STRAND_POINTS / RUNG_STRIDE)) {
          rungPositionAttr.setXYZ(rungIndex * 2, xA, y, zA);
          rungPositionAttr.setXYZ(rungIndex * 2 + 1, xB, y, zB);
          const rr = mr + (sr - mr) * 0.5;
          const rg = mg + (sg - mg) * 0.5;
          const rb = mb + (sb - mb) * 0.5;
          rungColorAttr.setXYZ(rungIndex * 2, rr, rg, rb);
          rungColorAttr.setXYZ(rungIndex * 2 + 1, rr, rg, rb);
          rungIndex++;
        }
      }
      strandA.instanceMatrix.needsUpdate = true;
      strandB.instanceMatrix.needsUpdate = true;
      if (strandA.instanceColor) strandA.instanceColor.needsUpdate = true;
      if (strandB.instanceColor) strandB.instanceColor.needsUpdate = true;
      rungPositionAttr.needsUpdate = true;
      rungColorAttr.needsUpdate = true;
      (rungs.material as THREE.LineBasicMaterial).opacity = 0.4 + volume * 0.3;

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createDnaHelixScene;
