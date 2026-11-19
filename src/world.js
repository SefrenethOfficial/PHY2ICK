// The test area: a block of road around a park, a strip of buildings, and a test track to the east.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { CityBuilder } from './buildings.js';

export const G_WORLD = 1, G_CAR = 2, G_PED = 4, G_RAG = 8, G_PROP = 16, G_HELD = 32;
export const groups = (member, filter) => (member << 16) | filter;

export function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  return t;
}
const noise = (c, w, h, base, spread, n = w * h * 0.25, size = 2) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { const v = (Math.random() - 0.5) * spread; c.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v)})`; c.fillRect(Math.random() * w, Math.random() * h, size, size); }
};
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

export function buildWorld(g) {
  const { scene, world, R } = g;
  const rand = rng(1234);
  const places = {};
  const cols = [];

  const fixed = (desc, x, y, z, ry = 0) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
    desc.setTranslation(x, y, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    const c = world.createCollider(desc); cols.push(c); return c;
  };
  const box = (w, h, d, x, y, z, mat, { col = true, ry = 0, shadow = true, recv = true } = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = shadow; m.receiveShadow = recv; scene.add(m);
    if (col) fixed(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2), x, y, z, ry);
    return m;
  };

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
  scene.fog = new THREE.Fog(0xb7c6d2, 160, 900);
  scene.add(new THREE.HemisphereLight(0xc4d8f0, 0x6a5a46, 0.35));
  const sun = new THREE.DirectionalLight(0xffeedd, 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
  sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.035; sun.shadow.radius = 2;
  scene.add(sun, sun.target); g.sun = sun;

  // --- ground: grass with big soft patches of colour variation (vertex colours) under a detailed texture
  const grassT = canvasTex(512, 512, (c, w, h) => {
    noise(c, w, h, '#58773a', 0.2, 30000, 2);
    for (let i = 0; i < 9000; i++) { const gr = 95 + Math.random() * 60; c.fillStyle = `rgba(${gr * 0.7},${gr},${40 + Math.random() * 20},.55)`; c.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 4); }
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(${120 + Math.random() * 40},${110 + Math.random() * 30},60,.12)`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 16, 0, 7); c.fill(); }
  }, [160, 160]);
  const groundG = new THREE.PlaneGeometry(1200, 1200, 150, 150);
  {
    const p = groundG.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const n = Math.sin(x * 0.021) * Math.cos(y * 0.017) * 0.5 + Math.sin(x * 0.007 + y * 0.011) * 0.5;
      const k = 0.86 + n * 0.12;
      col[i * 3] = k * (1 + n * 0.05); col[i * 3 + 1] = k; col[i * 3 + 2] = k * (0.95 - n * 0.05);
    }
    groundG.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const ground = new THREE.Mesh(groundG, new THREE.MeshStandardMaterial({ map: grassT, vertexColors: true, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  fixed(R.ColliderDesc.cuboid(600, 0.5, 600), 0, -0.5, 0);

  // --- roads: a loop around the park (centre line ±70 x ±50, 10 m wide), and a road east to the test track
  // asphalt: aggregate, patched repairs, cracks, oil, tyre polish down the lanes, worn paint
  const drawAsphalt = (c, w, h, lines, bump) => {
    c.fillStyle = bump ? '#808080' : '#3a3c3f'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) { const v = Math.random(); c.fillStyle = bump ? `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},.35)` : `rgba(${v > 0.5 ? 200 : 15},${v > 0.5 ? 200 : 15},${v > 0.5 ? 205 : 18},${Math.random() * 0.25})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    if (!bump) {
      for (let i = 0; i < 3; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? 20 : 70},${Math.random() < 0.5 ? 22 : 70},${Math.random() < 0.5 ? 24 : 72},.35)`; c.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 90, 20 + Math.random() * 60); }
      for (const ly of [h * 0.27, h * 0.73]) { const gr = c.createLinearGradient(0, ly - 30, 0, ly + 30); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, ly - 30, w, 60); }
      for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(10,8,6,.25)'; c.beginPath(); c.ellipse(Math.random() * w, h * (Math.random() < 0.5 ? 0.27 : 0.73), 8 + Math.random() * 14, 5 + Math.random() * 8, 0, 0, 7); c.fill(); }
    }
    c.strokeStyle = bump ? '#202020' : 'rgba(10,10,10,.6)'; c.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { c.beginPath(); let x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.3) * 22; c.lineTo(x, y); } c.stroke(); }
    if (lines && !bump) {
      const worn = (x, y, ww, hh, col) => { c.fillStyle = col; c.fillRect(x, y, ww, hh); c.fillStyle = 'rgba(58,60,63,.5)'; for (let i = 0; i < ww * hh / 30; i++) c.fillRect(x + Math.random() * ww, y + Math.random() * hh, 2, 2); };
      worn(0, 14, w, 7, '#dcd9cf'); worn(0, h - 21, w, 7, '#dcd9cf');
      worn(0, h / 2 - 4, w * 0.5, 8, '#d9b443');
    }
  };
  const asphalt = (len, lines) => {
    const map = canvasTex(512, 512, (c, w, h) => drawAsphalt(c, w, h, lines, false), [len / 10, 1]);
    const bumpMap = canvasTex(512, 512, (c, w, h) => drawAsphalt(c, w, h, lines, true), [len / 10, 1]); bumpMap.colorSpace = THREE.NoColorSpace;
    return { map, bumpMap };
  };
  const roadMat = (len, lines = true) => new THREE.MeshStandardMaterial({ ...asphalt(len, lines), bumpScale: 1.1, roughness: 0.88 });
  const strip = (x, z, len, wid, alongX, mat, y = 0.02) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, wid), mat);
    m.rotation.x = -Math.PI / 2; if (!alongX) m.rotation.z = Math.PI / 2;
    m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m;
  };
  const A = 70, Bz = 50, W = 10;
  strip(0, -Bz, 2 * A - W, W, true, roadMat(2 * A - W)); strip(0, Bz, 2 * A - W, W, true, roadMat(2 * A - W));
  strip(-A, 0, 2 * Bz - W, W, false, roadMat(2 * Bz - W)); strip(A, 0, 2 * Bz - W, W, false, roadMat(2 * Bz - W));
  const plain = roadMat(10, false);
  for (const [x, z] of [[-A, -Bz], [A, -Bz], [-A, Bz], [A, Bz]]) strip(x, z, W, W, true, plain);
  // east road to the test track, and the track itself
  strip(A + W / 2 + 52.5, 0, 105, W, true, roadMat(105));
  const padT = canvasTex(256, 256, (c, w, h) => { noise(c, w, h, '#45474a', 0.16, 12000, 2); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.strokeRect(0, 0, w, h); }, [12, 12]);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), new THREE.MeshStandardMaterial({ map: padT, roughness: 0.9 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(245, 0.021, 0); pad.receiveShadow = true; scene.add(pad);
  places.track = { name: 'the test track', pos: new THREE.Vector3(200, 0, 0) };

  // zebra crossings, mid-way along each side
  const zebraT = canvasTex(128, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(240,240,232,.92)'; for (let i = 0; i < 8; i++) c.fillRect(i * 16 + 3, 0, 9, h); });
  const zebraM = new THREE.MeshStandardMaterial({ map: zebraT, transparent: true, roughness: 0.9, depthWrite: false });
  for (const [x, z, along] of [[0, -Bz, false], [0, Bz, false], [-A, 0, true], [A, 20, true]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W - 1, 4), zebraM); m.rotation.x = -Math.PI / 2; if (!along) m.rotation.z = Math.PI / 2; m.position.set(x, 0.03, z); scene.add(m);
  }

  // --- sidewalks (raised kerbs), inside and outside the loop
  // pavement: concrete slabs with joints, a few stains and gum spots
  const drawPave = (c, w, h, bump) => {
    c.fillStyle = bump ? '#a0a0a0' : '#aaa59c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = Math.random() < 0.5; c.fillStyle = `rgba(${v ? 255 : 0},${v ? 255 : 0},${v ? 255 : 0},${Math.random() * (bump ? 0.3 : 0.08)})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    if (!bump) { for (let i = 0; i < 3; i++) { c.fillStyle = 'rgba(70,60,50,.1)'; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 10 + Math.random() * 25, 0, 7); c.fill(); } for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(40,40,40,.35)'; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 2, 0, 7); c.fill(); } }
    c.fillStyle = bump ? '#303030' : 'rgba(55,50,45,.55)'; c.fillRect(0, 0, w, 3); c.fillRect(0, 0, 3, h);
  };
  const paveMap = canvasTex(256, 256, (c, w, h) => drawPave(c, w, h, false)), paveBump = canvasTex(256, 256, (c, w, h) => drawPave(c, w, h, true)); paveBump.colorSpace = THREE.NoColorSpace;
  const pave = (len, along) => { const t = paveMap.clone(), b = paveBump.clone(); t.needsUpdate = b.needsUpdate = true; for (const x of [t, b]) x.repeat.set(along ? len / 1.6 : 3.5 / 1.6, along ? 3.5 / 1.6 : len / 1.6); return new THREE.MeshStandardMaterial({ map: t, bumpMap: b, bumpScale: 1.2, roughness: 0.93 }); };
  const SW = 3.5, kerb = 0.14;
  const walkRing = (half, inner) => { // a ring of four slabs; half = [x, z] half-extents of the ring's centre line
    const [hx, hz] = half;
    box(2 * hx + SW, kerb, SW, 0, kerb / 2, -hz, pave(2 * hx + SW, true), { shadow: false });
    box(2 * hx + SW, kerb, SW, 0, kerb / 2, hz, pave(2 * hx + SW, true), { shadow: false });
    box(SW, kerb, 2 * hz - SW, -hx, kerb / 2, 0, pave(2 * hz - SW, false), { shadow: false });
    if (inner) box(SW, kerb, 2 * hz - SW, hx, kerb / 2, 0, pave(2 * hz - SW, false), { shadow: false });
    else { // (a gap for the east road)
      const seg = hz - W / 2 - 1;
      box(SW, kerb, seg - SW / 2, hx, kerb / 2, -(W / 2 + 1 + (seg - SW / 2) / 2 + 0), pave(seg, false), { shadow: false });
      box(SW, kerb, seg - SW / 2, hx, kerb / 2, (W / 2 + 1 + (seg - SW / 2) / 2), pave(seg, false), { shadow: false });
    }
  };
  walkRing([A - W / 2 - SW / 2, Bz - W / 2 - SW / 2], true);
  walkRing([A + W / 2 + SW / 2, Bz + W / 2 + SW / 2], false);

  // --- the park: paths, a fountain, trees, benches, a café kiosk
  const pathT = canvasTex(128, 128, (c, w, h) => noise(c, w, h, '#b9ad94', 0.14, 4000, 2));
  const pathM = (lx, lz) => { const t = pathT.clone(); t.needsUpdate = true; t.repeat.set(lx / 3, lz / 3); return new THREE.MeshStandardMaterial({ map: t, roughness: 1 }); };
  const pathX = new THREE.Mesh(new THREE.PlaneGeometry(2 * (A - W / 2 - SW), 4), pathM(2 * (A - W / 2 - SW), 4)); pathX.rotation.x = -Math.PI / 2; pathX.position.y = 0.025; pathX.receiveShadow = true; scene.add(pathX);
  const pathZ = new THREE.Mesh(new THREE.PlaneGeometry(4, 2 * (Bz - W / 2 - SW)), pathM(4, 2 * (Bz - W / 2 - SW))); pathZ.rotation.x = -Math.PI / 2; pathZ.position.y = 0.026; pathZ.receiveShadow = true; scene.add(pathZ);
  // fountain
  const stone = new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.85 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.6, 40, 1, true), stone); basin.position.y = 0.3; basin.castShadow = basin.receiveShadow = true; scene.add(basin);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.25, 0.18, 8, 48), stone); rim.rotation.x = Math.PI / 2; rim.position.y = 0.62; scene.add(rim);
  const water = new THREE.Mesh(new THREE.CircleGeometry(4.1, 40), new THREE.MeshStandardMaterial({ color: 0x3f7fa0, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.45; scene.add(water); g.fountainWater = water;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 16), stone); column.position.y = 1.1; column.castShadow = true; scene.add(column);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.4, 0.4, 24), stone); bowl.position.y = 2.2; bowl.castShadow = true; scene.add(bowl);
  fixed(R.ColliderDesc.cylinder(0.31, 4.4), 0, 0.31, 0);
  places.fountain = { name: 'the fountain', pos: new THREE.Vector3(0, 0, 6) };
  // trees
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 1 });
  const leaves = [0x3f6e2f, 0x4d7a34, 0x5c8a3a, 0x3a5f2c].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true }));
  const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 3.2, 8), leafG = new THREE.IcosahedronGeometry(1, 1);
  const tree = (x, z, s = 1) => {
    const t = new THREE.Mesh(trunkG, bark); t.position.set(x, 1.6 * s, z); t.scale.setScalar(s); t.castShadow = true; scene.add(t);
    const lm = leaves[Math.floor(rand() * leaves.length)];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(leafG, lm); const r = (1.5 + rand() * 0.8) * s;
      l.scale.set(r, r * 0.85, r); l.position.set(x + (rand() - 0.5) * 1.4 * s, (3.4 + i * 0.7 + rand() * 0.4) * s, z + (rand() - 0.5) * 1.4 * s);
      l.castShadow = true; scene.add(l);
    }
    fixed(R.ColliderDesc.cylinder(1.6 * s, 0.24 * s), x, 1.6 * s, z);
  };
  const parkX = A - W / 2 - SW - 2, parkZ = Bz - W / 2 - SW - 2;
  for (let i = 0; i < 46; i++) {
    const x = (rand() * 2 - 1) * parkX, z = (rand() * 2 - 1) * parkZ;
    if (Math.abs(x) < 4.5 || Math.abs(z) < 4.5 || Math.hypot(x, z) < 9 || (Math.abs(x - 30) < 9 && Math.abs(z - 20) < 8)) continue;
    tree(x, z, 0.85 + rand() * 0.5);
  }
  // benches
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.9 }), iron = new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.5, metalness: 0.6 });
  g.benches = [];
  const bench = (x, z, ry) => {
    const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; scene.add(grp);
    const add = (geo, mat, px, py, pz, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.x = rx; m.castShadow = true; grp.add(m); };
    add(new THREE.BoxGeometry(1.8, 0.06, 0.45), wood, 0, 0.46, 0);
    add(new THREE.BoxGeometry(1.8, 0.4, 0.05), wood, 0, 0.75, -0.22, -0.15);
    for (const s of [-0.8, 0.8]) add(new THREE.BoxGeometry(0.06, 0.46, 0.45), iron, s, 0.23, 0);
    fixed(R.ColliderDesc.cuboid(0.9, 0.25, 0.25), x, 0.25, z, ry);
    g.benches.push({ pos: new THREE.Vector3(x, 0, z).add(new THREE.Vector3(0, 0, 0.12).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry)), yaw: ry, taken: null });
  };
  for (const [x, z, ry] of [[-14, 3.6, Math.PI], [14, 3.6, Math.PI], [-14, -3.6, 0], [14, -3.6, 0], [3.6, 16, -Math.PI / 2], [-3.6, -16, Math.PI / 2], [-30, 3.6, Math.PI], [36, -3.6, 0]]) bench(x, z, ry);
  // café kiosk
  {
    const x = 30, z = 20;
    const wall = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.9 });
    box(6, 3, 4, x, 1.5, z, wall);
    const awnT = canvasTex(64, 16, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f2efe6' : '#b23a2e'; c.fillRect(i * 8, 0, 8, h); } });
    const awn = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.08, 1.8), new THREE.MeshStandardMaterial({ map: awnT, roughness: 0.8 }));
    awn.position.set(x, 2.7, z - 2.7); awn.rotation.x = -0.25; awn.castShadow = true; scene.add(awn);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.7), new THREE.MeshStandardMaterial({ map: canvasTex(256, 56, (c, w, h) => { c.fillStyle = '#2b2118'; c.fillRect(0, 0, w, h); c.fillStyle = '#f0d9a8'; c.font = 'bold 36px Georgia'; c.textAlign = 'center'; c.fillText('CAFÉ  NOIR', w / 2, 40); }) }));
    sign.position.set(x, 3.4, z - 2.01); sign.rotation.y = Math.PI; scene.add(sign);
    for (const dx of [-1.6, 1.6]) { // tables
      const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 16), iron); tb.position.set(x + dx, 0.75, z - 4.6); tb.castShadow = true; scene.add(tb);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 6), iron); leg.position.set(x + dx, 0.37, z - 4.6); scene.add(leg);
    }
    places.cafe = { name: 'Café Noir', pos: new THREE.Vector3(x, 0, z - 5.5) };
  }

  // --- street lamps along the inner sidewalk
  const lampHead = new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffe2a0, emissiveIntensity: 0.6 });
  const lamp = (x, z) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 6, 8), iron); p.position.set(x, 3, z); p.castShadow = true; scene.add(p);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.28), lampHead); h.position.set(x, 6, z); scene.add(h);
    fixed(R.ColliderDesc.cylinder(3, 0.1), x, 3, z);
  };
  const lx = A - W / 2 - 0.6, lz = Bz - W / 2 - 0.6;
  for (let x = -lx + 6; x < lx; x += 22) { lamp(x, -lz); lamp(x, lz); }
  for (let z = -lz + 14; z < lz; z += 22) { lamp(-lx, z); lamp(lx, z); }

  // --- buildings around the outside of the loop (proper facades: see buildings.js)
  const city = g.city = new CityBuilder(g);
  city.rand = rand;
  const styles = ['brick', 'brick', 'stucco', 'stucco', 'concrete', 'glass'];
  const outer = A + W / 2 + SW, outerZ = Bz + W / 2 + SW;
  const place = (cx, cz, w, d, face) => {
    let style = styles[Math.floor(rand() * styles.length)];
    let floors = style === 'glass' ? 9 + Math.floor(rand() * 6) : 3 + Math.floor(rand() * 5);
    if (style === 'glass' && rand() < 0.5) { style = 'concrete'; floors = 5 + Math.floor(rand() * 4); }
    city.building({ x: cx, z: cz, w, d, floors, style, shopFaces: rand() < 0.75 ? [face] : [] });
  };
  for (const side of [-1, 1]) { // north and south rows (the north row leaves a gap for your apartment building)
    for (let x = -outer + 2; x < outer - 6;) {
      const w = 12 + rand() * 10, d = 14 + rand() * 8;
      if (x + w > outer) break;
      if (side < 0 && x + w > -13 && x < 13) { x = 13.5; continue; }
      place(x + w / 2, side * (outerZ + 1.5 + d / 2), w, d, side < 0 ? '+z' : '-z');
      x += w + 2.5 + rand() * 3;
    }
  }
  for (let z = -outerZ + 2; z < outerZ - 6;) { // the west row
    const w = 12 + rand() * 10, d = 14 + rand() * 8;
    if (z + w > outerZ) break;
    place(-(outer + 1.5 + d / 2), z + w / 2, d, w, '+x');
    z += w + 2.5 + rand() * 3;
  }

  // --- the test track: cones, a jump ramp, a long straight
  const coneM = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.6 });
  g.cones = [];
  const coneG = new THREE.ConeGeometry(0.22, 0.6, 12); coneG.translate(0, 0.3, 0);
  for (let i = 0; i < 9; i++) { // a slalom
    const m = new THREE.Mesh(coneG, coneM); m.position.set(200 + i * 9, 0, -30 + (i % 2) * 0); m.castShadow = true; scene.add(m);
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(m.position.x, 0.3, m.position.z).setLinearDamping(0.3).setAngularDamping(0.5));
    world.createCollider(R.ColliderDesc.cone(0.3, 0.22).setDensity(40).setFriction(0.8), body);
    g.cones.push({ m, body });
  }
  const ramp = (x, z, len, wid, hgt, ry) => {
    const hw = wid / 2;
    const pts = [[-hw, 0, -len / 2], [hw, 0, -len / 2], [-hw, 0, len / 2], [hw, 0, len / 2], [-hw, hgt, len / 2], [hw, hgt, len / 2]];
    const v = new Float32Array(pts.flat());
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
    geo.setIndex([0, 2, 1, 1, 2, 3, 0, 4, 2, 0, 1, 5, 0, 5, 4, 1, 3, 5, 2, 4, 5, 2, 5, 3]); geo.computeVertexNormals();
    const rampT = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#d9a62b'; c.fillRect(0, 0, w, h); c.fillStyle = '#222'; for (let i = -2; i < 4; i++) { c.beginPath(); c.moveTo(i * 24, 0); c.lineTo(i * 24 + 12, 0); c.lineTo(i * 24 + 12 + 64, h); c.lineTo(i * 24 + 64, h); c.fill(); } });
    const m = new THREE.Mesh(geo.toNonIndexed(), new THREE.MeshStandardMaterial({ color: 0xbfb6a6, roughness: 0.8, side: THREE.DoubleSide })); m.geometry.computeVertexNormals();
    m.position.set(x, 0, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; scene.add(m);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(wid, 0.6), new THREE.MeshStandardMaterial({ map: rampT })); stripe.position.set(0, hgt / 2, len / 2 + 0.01); stripe.scale.y = hgt / 0.6; m.add(stripe);
    fixed(R.ColliderDesc.convexHull(v), x, 0, z, ry);
  };
  ramp(250, 25, 14, 6, 2.4, Math.PI / 2);
  ramp(232, -8, 9, 5, 1.2, -Math.PI / 2);
  // the sign at the entrance
  const signT = canvasTex(512, 128, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#b8b8b8'); gr.addColorStop(1, '#7c7c7c'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.lineWidth = 10; c.strokeStyle = '#000'; c.strokeRect(5, 5, w - 10, h - 10);
    c.font = 'bold 74px "Arial Narrow", Arial'; c.textBaseline = 'middle'; c.fillStyle = '#111'; c.fillText('PHY', 30, 66); const wP = c.measureText('PHY').width;
    c.fillStyle = '#ffe600'; c.fillText('2', 30 + wP, 66); const w2 = c.measureText('2').width; c.fillStyle = '#111'; c.fillText('ICK', 30 + wP + w2, 66);
    c.font = 'bold 30px Arial'; c.fillText('TEST AREA', 330, 66);
  });
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshStandardMaterial({ map: signT, roughness: 0.6 }));
  sg.position.set(178, 6.5, 8); sg.rotation.y = -Math.PI / 2; scene.add(sg);
  for (const dz of [-5, 5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6.5, 8), iron); p.position.set(178.05, 3.25, 8 + dz); p.castShadow = true; scene.add(p); fixed(R.ColliderDesc.cylinder(3.25, 0.15), 178.05, 3.25, 8 + dz); }

  // where people walk: inside the loop (the park and its sidewalk)
  const walk = { x: A - W / 2 - 1, z: Bz - W / 2 - 1 };
  return { places, walk, A, Bz, W };
}
