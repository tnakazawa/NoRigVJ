import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const vertexShader = `
  uniform float uTime;
  uniform float uBass;
  uniform float uPadY;
  varying float vElevation;
  varying vec3 vViewPosition;

  void main() {
    // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする
    float bass = clamp(uBass, 0.0, 3.0);

    float amp = 0.15 + bass * 0.35;
    // FXパッドY: 変位量そのものを増減する(Spike/Smoothの連続版、両者は変位量を増やす/絞る
    // という逆方向の操作なので1軸にまとめられる)。正で変位を増幅してトゲトゲに(Spike)、
    // 負で変位を0へ絞り込み真球に近づける(Smooth)。X軸は元のトリガーがこの1軸に統合できたため未使用
    if (uPadY >= 0.0) {
      amp += uPadY * 0.9;
    } else {
      amp *= (1.0 + uPadY);
    }

    vec3 dir = normalize(position);
    // 複数のsin波を方向ベクトルの各成分に重ねて合成し、有機的な塊のうねりを作る
    // (simplex noise等は使わず、Plasma Lava/Grid Terrainと同じsin波合成のアプローチに揃えている)
    float d = sin(dir.x * 3.0 + uTime * 0.8);
    d += sin(dir.y * 4.0 + uTime * 1.1);
    d += sin(dir.z * 3.5 - uTime * 0.6);
    d += sin((dir.x + dir.y) * 2.5 + uTime * 0.5);
    float elevation = d * amp;

    vec3 newPosition = position + dir * elevation;
    vElevation = elevation;

    vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
    vViewPosition = mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform vec3 uMainColor;
  uniform vec3 uSubColor;
  uniform float uVolume;
  varying float vElevation;
  varying vec3 vViewPosition;

  void main() {
    // 変位で頂点法線が崩れるため、頂点法線を使わずスクリーンスペース微分から
    // フラットシェーディング用の面法線を求める(ローポリ風の陰影で、有機的な塊にはむしろ合う)
    vec3 fdx = dFdx(vViewPosition);
    vec3 fdy = dFdy(vViewPosition);
    vec3 normal = normalize(cross(fdx, fdy));
    float light = max(dot(normal, normalize(vec3(0.4, 0.6, 1.0))), 0.0);

    float t = clamp(vElevation * 0.6 + 0.5, 0.0, 1.0);
    vec3 color = mix(uMainColor, uSubColor, t);
    float volume = clamp(uVolume, 0.0, 2.0);
    gl_FragColor = vec4(color * (0.25 + light * 0.9) * (0.8 + volume * 0.3), 1.0);
  }
`;

/**
 * 頂点シェーダーでsin波合成の変位を加えた、有機的にうねる球体のシーン(WebGL)。カラーパレット対応。
 * FXパッド対応(Y軸のみ)。marching cubes等の本格的なメタボール実装ではなく、IcosahedronGeometryの
 * 頂点を変形するだけの簡易版(誇大化を避けるため)。
 */
const createMetaballBlobScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let material: THREE.ShaderMaterial;

  const scene: Scene = {
    name: "Metaball Blob",
    supportsPalette: true,
    padSupported: true,
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.z = 4.5;

      const geometry = new THREE.IcosahedronGeometry(1.4, 24);
      material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        // dFdx/dFdyはWebGL2(three.jsのデフォルト)ではコア機能のため拡張宣言は不要
        uniforms: {
          uTime: { value: 0 },
          uBass: { value: 0 },
          uVolume: { value: 0 },
          uPadY: { value: 0 },
          uMainColor: { value: new THREE.Vector3() },
          uSubColor: { value: new THREE.Vector3() },
        },
      });
      const mesh = new THREE.Mesh(geometry, material);
      renderScene.add(mesh);
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      material.uniforms.uTime.value = ctx.time;
      material.uniforms.uBass.value = ctx.audio.bass;
      material.uniforms.uVolume.value = ctx.audio.volume;
      material.uniforms.uPadY.value = ctx.padY;
      material.uniforms.uMainColor.value.set(...hexToRgb(ctx.palette.main));
      material.uniforms.uSubColor.value.set(...hexToRgb(ctx.palette.sub));

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createMetaballBlobScene;
