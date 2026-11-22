// Poster frames of Paul Badfella on a transparent background (dev only: open /tools/paul.html with the dev server).
// window.frame(name) renders a pose and returns a PNG data URL.
import * as THREE from 'three';
import { Human } from '../src/character.js';
import { PAUL_LOOK } from '../src/paul.js';

const W = 1200, H = 1500;
const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
r.setSize(W, H); r.setClearColor(0x000000, 0); r.outputColorSpace = THREE.SRGBColorSpace; r.shadowMap.enabled = true; document.body.appendChild(r.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 1.1));
const key = new THREE.DirectionalLight(0xfff2e0, 2.6); key.position.set(-1.5, 3, 3); scene.add(key);
const rim = new THREE.DirectionalLight(0xb0d0ff, 1.6); rim.position.set(2.5, 2.5, -2); scene.add(rim);
const fill = new THREE.DirectionalLight(0xffe0f0, 0.6); fill.position.set(2, 1, 3); scene.add(fill);
const P = new Human(PAUL_LOOK); scene.add(P.root);
const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 50);

const POSES = {
  // pointing straight down the lens: "YOU. Got a problem?"
  point:      { s: { pose: 'stand', grounded: true, point: { up: 0.04 } }, face: 'surprised', finger: true, cam: [-0.12, 1.55, 2.7], at: [0, 1.2, 0], rot: 0.16 },
  pointClose: { s: { pose: 'stand', grounded: true, point: { up: 0.1 } }, face: 'surprised', finger: true, cam: [-0.14, 1.62, 1.45], at: [0, 1.47, 0], fov: 38, rot: 0.2 },
  point34:    { s: { pose: 'stand', grounded: true, point: { up: 0.06 } }, face: 'surprised', finger: true, cam: [-1.25, 1.55, 2.3], at: [-0.1, 1.3, 0], rot: 0.05 },
  pointLow:   { s: { pose: 'stand', grounded: true, point: { up: -0.15 } }, face: 'surprised', finger: true, cam: [-0.7, 0.75, 2.3], at: [-0.05, 1.3, 0], rot: 0.14 },
  pointSide:  { s: { pose: 'stand', grounded: true, point: { up: 0.05 } }, face: 'neutral', finger: true, cam: [-1.7, 1.5, 2.0], at: [-0.15, 1.25, 0.25] },
  pitch:      { s: { pose: 'stand', grounded: true, pitch: true }, face: 'surprised', finger: false, cam: [0.1, 1.45, 3.2], at: [0, 1.05, 0] },
};
window.frame = (name) => {
  const p = POSES[name]; P.root.rotation.y = p.rot || 0; P.pointer(p.finger); P.express(p.face, 99);
  for (let i = 0; i < 90; i++) P.update(1 / 30, p.s); // (settle into the pose)
  cam.fov = p.fov || 30; cam.updateProjectionMatrix(); cam.position.set(...p.cam); cam.lookAt(...p.at);
  r.render(scene, cam); return r.domElement.toDataURL('image/png');
};
window.poses = Object.keys(POSES);
window.P = P; window.ready = true;
