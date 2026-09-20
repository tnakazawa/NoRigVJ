import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform vec3 uMainColor;
  uniform vec3 uSubColor;
  uniform float uVolume;
  uniform float uGlowBurst;
  uniform float uCoreFlash;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    float volume = clamp(uVolume, 0.0, 2.0);

    vec3 viewDir = normalize(vViewPosition);
    vec3 normal = normalize(vNormal);
    // 視線と法線が直交に近いほど(輪郭に近いほど)1に近づく、古典的なフレネル近似
    float fresnel = pow(1.0 - clamp(dot(viewDir, normal), 0.0, 1.0), 4.5);
    // FXパッドX: 輪郭の発光を強める/弱める(正で強調、負で控えめに。Glow Burstの連続版)。
    // 負方向は係数を緩め、下限もクランプして、少し左へ動かしただけで発光が完全に消えないようにしている
    float glowFactor = uGlowBurst >= 0.0 ? 1.0 + uGlowBurst * 2.5 : 1.0 + uGlowBurst * 0.8;
    fresnel = clamp(fresnel * max(0.15, glowFactor), 0.0, 1.0);

    vec3 core = uMainColor * 0.12;
    // FXパッドY: 中心部を白(正)/黒(負)へ寄せる対称式(Core Flashの連続版)
    if (uCoreFlash >= 0.0) {
      core = core + (1.0 - core) * uCoreFlash;
    } else {
      core = core * (1.0 + uCoreFlash);
    }

    vec3 color = mix(core, uSubColor, fresnel) * (0.6 + volume * 0.5);
    float alpha = clamp(fresnel * 0.7 + 0.25 + abs(uCoreFlash) * 0.3, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * 輪郭がフレネル効果で光る半透明の球体のシーン(WebGL)。カラーパレット対応。
 * Metaball Blobと形状(球)は近いが、変形ではなく透明感のある材質表現という点で差別化している。FXパッド対応。
 */
const createFresnelGlassSphereScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let mesh: THREE.Mesh;
  let material: THREE.ShaderMaterial;

  const scene: Scene = {
    name: "Fresnel Glass Sphere",
    supportsPalette: true,
    padSupported: true,
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.z = 5.5;

      const geometry = new THREE.SphereGeometry(1.5, 48, 48);
      material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: {
          uMainColor: { value: new THREE.Vector3() },
          uSubColor: { value: new THREE.Vector3() },
          uVolume: { value: 0 },
          uGlowBurst: { value: 0 },
          uCoreFlash: { value: 0 },
        },
      });
      mesh = new THREE.Mesh(geometry, material);
      renderScene.add(mesh);
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      const bass = Math.min(2, ctx.audio.bass);
      // 操作なし・無音時でも単調にならないよう、回転速度を上げつつ、常時ゆっくり脈動させる
      mesh.rotation.y = ctx.time * (0.4 + bass * 0.5);
      mesh.rotation.x = ctx.time * 0.25;
      const pulse = 1 + Math.sin(ctx.time * 1.4) * 0.08 + bass * 0.1;
      mesh.scale.setScalar(pulse);

      material.uniforms.uMainColor.value.set(...hexToRgb(ctx.palette.main));
      material.uniforms.uSubColor.value.set(...hexToRgb(ctx.palette.sub));
      material.uniforms.uVolume.value = ctx.audio.volume;
      material.uniforms.uGlowBurst.value = ctx.padX;
      material.uniforms.uCoreFlash.value = ctx.padY;

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createFresnelGlassSphereScene;
