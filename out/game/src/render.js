// Renderer: ACES tone mapping, PCFSoft shadows, sun + bright ambient.
import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  // three 0.187 removed PCFSoftShadowMap; PCFShadowMap is the soft PCF path.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x9fc3dd, 180, 420);
  // sun with shadows
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
  sun.position.set(120, 180, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 520;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  // bright sky fill so facades are never nearly-black
  const hemi = new THREE.HemisphereLight(0xbfd9ee, 0x5a6a52, 1.05);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(amb);
  return { scene, sun, hemi, amb };
}

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  cam.position.set(0, 4, -14);
  return cam;
}
