// Icons: every thing you carry drawn from its own 3D model (the knife, the cone, the burger, the mug you picked
// up), once, into a little picture for the hotbar and the bag. Plus a few made just for the pockets: a bag of
// Physick, a bottle of solvent, the blue salts, a sack, and what you've lifted off people or out of shops.
import * as THREE from 'three';
import { model } from './weapons.js';
import { foodMesh, FOOD } from './food.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const std = (color, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const S = 96;

export class Icons {
  constructor() {
    this.cache = new Map();
    try {
      this.r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      this.r.setSize(S, S); this.r.setPixelRatio(1); this.r.outputColorSpace = THREE.SRGBColorSpace; this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.toneMappingExposure = 1.15;
    } catch { this.r = null; }
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.6));
    const d = new THREE.DirectionalLight(0xffffff, 2.4); d.position.set(2, 3, 2.5); this.scene.add(d);
    const r2 = new THREE.DirectionalLight(0xa8c8ff, 0.8); r2.position.set(-3, 1, -2); this.scene.add(r2);
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  }
  // a picture of obj (rotated for the shot), as a data URL
  shot(obj, tilt = { x: 0, y: 0, z: 0 }) {
    if (!this.r) return '';
    const g = new THREE.Group(); g.add(obj); g.rotation.set(tilt.x, tilt.y, tilt.z); this.scene.add(g); g.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(g), c = bb.getCenter(V()), sz = bb.getSize(V()), R = Math.max(sz.x, sz.y, sz.z) * 0.62 + 0.001;
    const dist = R / Math.sin(THREE.MathUtils.degToRad(this.cam.fov / 2));
    this.cam.position.copy(c).add(V(0.55, 0.45, 1).normalize().multiplyScalar(dist)); this.cam.lookAt(c);
    this.r.render(this.scene, this.cam);
    const url = this.r.domElement.toDataURL('image/png');
    this.scene.remove(g);
    return url;
  }
  get(key, build, tilt) { if (!this.cache.has(key)) this.cache.set(key, this.shot(build(), tilt)); return this.cache.get(key); }

  // ---- what goes in the hotbar / bag
  weapon(id) {
    if (id === 'fists') return this.get('w:fists', () => fist(), { x: 0, y: -0.5, z: 0 });
    if (id === 'pistol' || id === 'shotgun') return this.get('w:' + id, () => model(id), { x: 0, y: -Math.PI / 2 + 0.35, z: 0.25 }); // (side on, barrel to the right)
    return this.get('w:' + id, () => model(id), { x: 0, y: 0.2, z: id === 'cone' ? 0.5 : -0.75 });
  }
  food(id) { return this.get('f:' + id, () => foodMesh(FOOD[id].mesh, FOOD[id].color), { x: 0.15, y: -0.4, z: 0 }); }
  prop(p) { return this.get('p:' + p.mesh.uuid, () => { const m = p.mesh.clone(true); m.position.set(0, 0, 0); m.quaternion.identity(); m.visible = true; m.traverse(o => { o.visible = true; }); return m; }, { x: 0.1, y: -0.5, z: 0 }); }
  // ---- the pockets
  pocket(kind) { return this.get('k:' + kind, () => pocketMesh(kind), { x: 0.15, y: -0.5, z: 0 }); }
}

// a fist: a box hand, four knuckles, a thumb
function fist() {
  const g = new THREE.Group(), skin = std(0xd9a47c, 0.7);
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.07), skin); g.add(palm);
  for (let i = 0; i < 4; i++) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.026, 0.035), skin); k.position.set(-0.033 + i * 0.022, 0.05, 0.03); g.add(k); }
  const th = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.03), skin); th.position.set(0.05, 0.0, 0.03); th.rotation.z = -0.4; g.add(th);
  const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.08), std(0x2b2f36)); cuff.position.y = -0.075; g.add(cuff);
  return g;
}
// pocket things, small and recognisable
function pocketMesh(kind) {
  const g = new THREE.Group(), add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  if (kind === 'physick') { // a little zip bag of blue crystals
    add(new THREE.BoxGeometry(0.1, 0.13, 0.012), std(0xeef4f8, 0.15, { transparent: true, opacity: 0.45 }));
    add(new THREE.BoxGeometry(0.1, 0.008, 0.016), std(0x3a7ad8, 0.3), 0, 0.055, 0);
    const blue = std(0x3ac8ff, 0.1, { emissive: 0x1a6aa8, emissiveIntensity: 0.4, flatShading: true });
    for (let i = 0; i < 9; i++) add(new THREE.OctahedronGeometry(0.014 + Math.random() * 0.008), blue, (Math.random() - 0.5) * 0.07, -0.045 + Math.random() * 0.05, 0, Math.random(), Math.random(), 0);
  } else if (kind === 'solvent') {
    add(new THREE.CylinderGeometry(0.04, 0.045, 0.16, 16), std(0xe8e4d4, 0.4), 0, 0, 0);
    add(new THREE.CylinderGeometry(0.046, 0.046, 0.06, 16), std(0xd8302a, 0.5), 0, 0.0, 0);
    add(new THREE.CylinderGeometry(0.016, 0.016, 0.04, 10), std(0x1a1a1a), 0, 0.1, 0);
  } else if (kind === 'salts') {
    add(new THREE.BoxGeometry(0.11, 0.14, 0.05), std(0x2a6ad8, 0.5));
    add(new THREE.BoxGeometry(0.112, 0.04, 0.052), std(0xf2f2f2, 0.5), 0, 0.02, 0);
  } else if (kind === 'sack') {
    const s = add(new THREE.SphereGeometry(0.08, 14, 10), std(0x9a7a4a, 0.95)); s.scale.set(1, 1.25, 0.8);
    add(new THREE.CylinderGeometry(0.02, 0.035, 0.05, 10), std(0x8a6a3a, 0.95), 0, 0.11, 0);
  } else if (kind === 'wallet') { add(new THREE.BoxGeometry(0.11, 0.08, 0.02), std(0x5a3a22, 0.7)); add(new THREE.BoxGeometry(0.06, 0.02, 0.022), std(0x3a2212, 0.7), 0.02, 0.015, 0); }
  else if (kind === 'watch') { add(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 20), std(0xd8b44a, 0.3, { metalness: 0.8 }), 0, 0, 0, Math.PI / 2); add(new THREE.CylinderGeometry(0.029, 0.029, 0.013, 20), std(0xf2f2ee, 0.2), 0, 0, 0.001, Math.PI / 2); add(new THREE.BoxGeometry(0.026, 0.12, 0.006), std(0x2a1a12, 0.8), 0, 0, -0.008); }
  else if (kind === 'phone') { add(new THREE.BoxGeometry(0.06, 0.12, 0.01), std(0x1a1c20, 0.3)); add(new THREE.BoxGeometry(0.054, 0.108, 0.002), std(0x2a5ab8, 0.1, { emissive: 0x1a3a78, emissiveIntensity: 0.6 }), 0, 0, 0.006); }
  else if (kind === 'necklace') { add(new THREE.TorusGeometry(0.06, 0.006, 6, 30), std(0xe8c44a, 0.2, { metalness: 0.9 })); add(new THREE.OctahedronGeometry(0.015), std(0x4ad8c8, 0.1, { metalness: 0.3 }), 0, -0.07, 0); }
  else if (kind === 'earbuds') { for (const s of [-1, 1]) { add(new THREE.SphereGeometry(0.018, 12, 8), std(0xf4f4f4, 0.3), s * 0.03, 0, 0); add(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 8), std(0xf4f4f4, 0.3), s * 0.03, -0.03, 0); } }
  else if (kind === 'lighter') { add(new THREE.BoxGeometry(0.03, 0.07, 0.015), std(0xd8302a, 0.3)); add(new THREE.BoxGeometry(0.03, 0.015, 0.016), std(0xc0c4c8, 0.3, { metalness: 0.8 }), 0, 0.04, 0); }
  else if (kind === 'can') { add(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 16), std(0xd8344a, 0.3, { metalness: 0.6 })); add(new THREE.CylinderGeometry(0.03, 0.033, 0.01, 16), std(0xc0c4c8, 0.3, { metalness: 0.8 }), 0, 0.065, 0); }
  else if (kind === 'bottle') { add(new THREE.CylinderGeometry(0.03, 0.035, 0.16, 14), std(0x3aa86a, 0.15, { transparent: true, opacity: 0.8 })); add(new THREE.CylinderGeometry(0.012, 0.02, 0.05, 10), std(0x3aa86a, 0.15), 0, 0.1, 0); }
  else if (kind === 'bagged') { const b = add(new THREE.BoxGeometry(0.13, 0.17, 0.05), std(0xf2c23a, 0.5)); b.scale.set(1, 1, 1); add(new THREE.BoxGeometry(0.135, 0.02, 0.052), std(0xd8344a, 0.5), 0, 0.075, 0); }
  else if (kind === 'game') { add(new THREE.BoxGeometry(0.1, 0.14, 0.014), std(0x2e6ac8, 0.4)); add(new THREE.BoxGeometry(0.08, 0.08, 0.015), std(0xf2f2f2, 0.4), 0, 0.01, 0.001); }
  else { add(new THREE.BoxGeometry(0.1, 0.13, 0.05), std(0xe8a23a, 0.6)); add(new THREE.BoxGeometry(0.102, 0.04, 0.052), std(0x8a3ac8, 0.6), 0, 0.03, 0); } // (a box of something)
  return g;
}
// what kind of pocket icon a stolen thing gets, from its name
export function lootKind(name) {
  const n = name.toLowerCase();
  for (const k of ['wallet', 'watch', 'phone', 'necklace', 'earbuds', 'lighter']) if (n.includes(k)) return k;
  if (/can|soda|beans|soup|paint/.test(n)) return 'can';
  if (/bottle|water|juice|wine|cola|drink/.test(n)) return 'bottle';
  if (/chips|bag|sweets|candy|crisps/.test(n)) return 'bagged';
  if (/game|disc|cd/.test(n)) return 'game';
  return 'box';
}
