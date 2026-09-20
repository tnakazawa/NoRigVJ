import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const SEGMENT_WIDTH = 0.5;

const vertexShader = `
  uniform float uFoldAngle;
  varying float vSegmentT;
  varying vec3 vViewPosition;

  void main() {
    vec3 pos = position;
    // xをセグメント単位に区切り、セグメント内での位置(0-1)から三角波を作って
    // アコーディオン状の山折り・谷折りを表現する
    float shifted = pos.x + 10.0 * ${SEGMENT_WIDTH};
    float xInSeg = mod(shifted, ${SEGMENT_WIDTH}) / ${SEGMENT_WIDTH};
    float triangleWave = 1.0 - abs(xInSeg - 0.5) * 2.0;
    pos.z += (triangleWave - 0.5) * sin(uFoldAngle) * ${SEGMENT_WIDTH};

    vSegmentT = xInSeg;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform vec3 uMainColor;
  uniform vec3 uSubColor;
  uniform float uVolume;
  uniform float uFlash;
  varying float vSegmentT;
  varying vec3 vViewPosition;

  void main() {
    float volume = clamp(uVolume, 0.0, 2.0);

    // 変位で頂点法線が崩れるため、スクリーンスペース微分からフラットシェーディング用の
    // 面法線を求める(折り紙の平坦な面にはフラットシェーディングがよく合う)
    vec3 fdx = dFdx(vViewPosition);
    vec3 fdy = dFdy(vViewPosition);
    vec3 normal = normalize(cross(fdx, fdy));
    float light = max(dot(normal, normalize(vec3(0.3, 0.5, 1.0))), 0.0);

    vec3 color = mix(uMainColor, uSubColor, vSegmentT);
    // FXパッドX: 正で白へ、負で黒へ寄せる(0で通常の配色、Flashの連続版)
    color = uFlash >= 0.0 ? mix(color, vec3(1.0), uFlash) : color * (1.0 + uFlash);
    gl_FragColor = vec4(color * (0.25 + light * 0.9) * (0.7 + volume * 0.3), 1.0);
  }
`;

/**
 * 平面が折り紙のアコーディオン折りのように開閉するシーン(WebGL)。カラーパレット対応。
 * 既存シーンにない幾何学的な「折り目」の動き。FXパッド対応。
 */
const createOrigamiFoldingPlanesScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let mesh: THREE.Mesh;
  let material: THREE.ShaderMaterial;

  const scene: Scene = {
    name: "Origami Folding Planes",
    supportsPalette: true,
    padSupported: true,
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(2, 2.5, 4);
      camera.lookAt(0, 0, 0);

      const geometry = new THREE.PlaneGeometry(5, 3, 60, 30);
      material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uFoldAngle: { value: 0.6 },
          uMainColor: { value: new THREE.Vector3() },
          uSubColor: { value: new THREE.Vector3() },
          uVolume: { value: 0 },
          uFlash: { value: 0 },
        },
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2.4;
      renderScene.add(mesh);
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      // 動きが少なく単調だったため、常時Y軸周りに回転させ続ける
      mesh.rotation.y = ctx.time * 0.5;

      // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
      const bass = Math.min(2, ctx.audio.bass);

      // 通常時はbassでゆっくり折れ角度が変化する。
      // FXパッドY: 正で折れ角度を最大(π/2、最も深い折り)へ、負で0(平ら)へ連続的に寄せる
      // (以前のFold/Flattenという別々のワンショットを、両端の状態を作る1本の軸として統合した)
      const baseFold = 0.4 + bass * 0.5;
      const padUp = Math.max(0, ctx.padY);
      const padDown = Math.max(0, -ctx.padY);
      const fold = padUp * (Math.PI / 2) + baseFold * (1 - padUp) * (1 - padDown);

      material.uniforms.uFoldAngle.value = fold;
      material.uniforms.uMainColor.value.set(...hexToRgb(ctx.palette.main));
      material.uniforms.uSubColor.value.set(...hexToRgb(ctx.palette.sub));
      material.uniforms.uVolume.value = ctx.audio.volume;
      material.uniforms.uFlash.value = ctx.padX;

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createOrigamiFoldingPlanesScene;
