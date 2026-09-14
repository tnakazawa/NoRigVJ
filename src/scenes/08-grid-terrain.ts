import * as THREE from "three";
import { hexToRgb } from "./_shared/color-utils";
import type { Scene, SceneContext, SceneFactory } from "./_shared/types";

const vertexShader = `
  uniform float uTime;
  uniform float uBass;
  uniform float uTreble;
  varying float vElevation;

  void main() {
    // Intensity(0〜9倍)を上げても変化が続くよう上限は高めにクランプする。
    // trebleは波の周波数に直結し、上げすぎると細かくなりすぎて見えなくなるため上限は控えめにしている
    float bass = clamp(uBass, 0.0, 3.0);
    float treble = clamp(uTreble, 0.0, 2.0);

    vec3 pos = position;
    // trebleで波の細かさ(周波数)、bassで振幅を変える
    float freq = 0.5 + treble * 2.0;
    float amp = 0.3 + bass * 1.5;
    float elevation = sin(pos.x * freq + uTime) * amp + sin(pos.y * freq * 0.8 + uTime * 1.3) * amp;
    pos.z += elevation;
    vElevation = elevation;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform float uVolume;
  uniform vec3 uMainColor;
  uniform vec3 uSubColor;
  varying float vElevation;

  void main() {
    float volume = clamp(uVolume, 0.0, 3.0);
    // 高いところ(elevationが大きい)ほどsub寄りの色にする
    float t = clamp(vElevation * 0.5 + 0.5, 0.0, 1.0);
    vec3 color = mix(uMainColor, uSubColor, t);
    gl_FragColor = vec4(color * (0.5 + volume * 0.6), 1.0);
  }
`;

/** 音声で波打つワイヤーフレーム地形のシーン(WebGL)。カラーパレット対応。奥行きのある見下ろし構図。 */
const createGridTerrainScene: SceneFactory = () => {
  let renderScene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let material: THREE.ShaderMaterial;

  const scene: Scene = {
    name: "Grid Terrain",
    supportsPalette: true,
    init() {
      renderScene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.set(0, 4, 6);
      camera.lookAt(0, 0, 0);

      const geometry = new THREE.PlaneGeometry(10, 10, 60, 60);
      material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        wireframe: true,
        uniforms: {
          uTime: { value: 0 },
          uVolume: { value: 0 },
          uBass: { value: 0 },
          uTreble: { value: 0 },
          uMainColor: { value: new THREE.Vector3() },
          uSubColor: { value: new THREE.Vector3() },
        },
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      renderScene.add(mesh);
    },
    render(ctx: SceneContext) {
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();

      material.uniforms.uTime.value = ctx.time;
      material.uniforms.uVolume.value = ctx.audio.volume;
      material.uniforms.uBass.value = ctx.audio.bass;
      material.uniforms.uTreble.value = ctx.audio.treble;
      material.uniforms.uMainColor.value.set(...hexToRgb(ctx.palette.main));
      material.uniforms.uSubColor.value.set(...hexToRgb(ctx.palette.sub));

      ctx.renderer.render(renderScene, camera);
    },
  };
  return scene;
};

export default createGridTerrainScene;
