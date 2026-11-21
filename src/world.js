// The world: the sky and the sun, shared textures, and the island (city.js builds the island itself).
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { buildCity } from './city.js';

export const G_WORLD = 1, G_CAR = 2, G_PED = 4, G_RAG = 8, G_PROP = 16, G_HELD = 32;
export const groups = (member, filter) => (member << 16) | filter;

export function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  return t;
}
export const noise = (c, w, h, base, spread, n = w * h * 0.25, size = 2) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { const v = (Math.random() - 0.5) * spread; c.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v)})`; c.fillRect(Math.random() * w, Math.random() * h, size, size); }
};
export const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// a texture and its bump map from the same drawing
export function texPair(size, draw, repeat = [1, 1]) {
  const map = canvasTex(size, size, (c, w, h) => draw(c, w, h, false), repeat);
  const bumpMap = canvasTex(size, size, (c, w, h) => draw(c, w, h, true), repeat); bumpMap.colorSpace = THREE.NoColorSpace;
  return { map, bumpMap };
}

// asphalt: aggregate, patched repairs, cracks, oil
export function drawAsphalt(c, w, h, bump) {
  c.fillStyle = bump ? '#808080' : '#3a3c3f'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 26000; i++) { const v = Math.random(); c.fillStyle = bump ? `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},.35)` : `rgba(${v > 0.5 ? 200 : 15},${v > 0.5 ? 200 : 15},${v > 0.5 ? 205 : 18},${Math.random() * 0.25})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  if (!bump) {
    for (let i = 0; i < 3; i++) { const v = Math.random() < 0.5 ? 22 : 72; c.fillStyle = `rgba(${v},${v + 1},${v + 3},.3)`; c.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 90, 20 + Math.random() * 60); }
    for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(10,8,6,.22)'; c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 8 + Math.random() * 14, 5 + Math.random() * 8, 0, 0, 7); c.fill(); }
  }
  c.strokeStyle = bump ? '#202020' : 'rgba(10,10,10,.6)'; c.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) { c.beginPath(); let x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.3) * 22; c.lineTo(x, y); } c.stroke(); }
}
// pavement: concrete slabs with joints, a few stains and gum spots
export function drawPave(c, w, h, bump) {
  c.fillStyle = bump ? '#a0a0a0' : '#aaa59c'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = Math.random() < 0.5; c.fillStyle = `rgba(${v ? 255 : 0},${v ? 255 : 0},${v ? 255 : 0},${Math.random() * (bump ? 0.3 : 0.08)})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  if (!bump) { for (let i = 0; i < 3; i++) { c.fillStyle = 'rgba(70,60,50,.1)'; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 10 + Math.random() * 25, 0, 7); c.fill(); } for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(40,40,40,.35)'; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 2, 0, 7); c.fill(); } }
  c.fillStyle = bump ? '#303030' : 'rgba(55,50,45,.55)'; c.fillRect(0, 0, w, 3); c.fillRect(0, 0, 3, h);
}

export function buildWorld(g) {
  const { scene } = g;
  // --- sky, light: a physical sky; the same sky lights everything (reflections and ambient)
  const SUN = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 36), THREE.MathUtils.degToRad(215));
  g.sunDir = SUN;
  const sky = new Sky(); sky.scale.setScalar(4500);
  const su = sky.material.uniforms;
  su.turbidity.value = 3.2; su.rayleigh.value = 1.15; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.82;
  su.sunPosition.value.copy(SUN);
  {
    const pm = new THREE.PMREMGenerator(g.renderer), envScene = new THREE.Scene();
    envScene.add(sky);
    const hemiFill = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5b5448, side: THREE.BackSide }));
    envScene.add(hemiFill); // (the ground half of the world: warm grey, not black)
    scene.environment = pm.fromScene(envScene, 0.02, 0.1, 6000).texture;
    scene.environmentIntensity = 0.75;
    envScene.remove(sky);
  }
  scene.add(sky); g.sky = sky;
  scene.fog = new THREE.Fog(0xb7c6d2, 220, 1300);
  scene.add(g.hemi = new THREE.HemisphereLight(0xc4d8f0, 0x6a5a46, 0.35));
  const sun = new THREE.DirectionalLight(0xffeedd, 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 400 });
  sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.035; sun.shadow.radius = 2;
  scene.add(sun, sun.target); g.sun = sun;

  return buildCity(g);
}
