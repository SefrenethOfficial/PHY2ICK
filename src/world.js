// The test area: a block of road around a park, a strip of buildings, and a test track to the east.
import * as THREE from 'three';

export const G_WORLD = 1, G_CAR = 2, G_PED = 4;
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

  // --- sky, light
  const skyG = new THREE.SphereGeometry(900, 32, 16);
  const skyM = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3d78c9) }, mid: { value: new THREE.Color(0x9cc4e8) }, bot: { value: new THREE.Color(0xdfe6ea) } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vp; void main(){ float h = vp.y; vec3 c = h > 0. ? mix(mid, top, pow(h, .6)) : bot; c = mix(c, bot, smoothstep(.12, -.02, h)); gl_FragColor = vec4(c,1.); }',
  });
  const sky = new THREE.Mesh(skyG, skyM); scene.add(sky); g.sky = sky;
  scene.fog = new THREE.Fog(0xc9d8e2, 120, 620);
  scene.add(new THREE.HemisphereLight(0xcfe2ff, 0x5a5040, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.position.set(60, 90, 40); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 260 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target); g.sun = sun;

  // --- ground
  const grassT = canvasTex(256, 256, (c, w, h) => { noise(c, w, h, '#5d7d3a', 0.22, 9000, 2); for (let i = 0; i < 1500; i++) { c.fillStyle = `rgba(${90 + Math.random() * 40},${120 + Math.random() * 40},50,.5)`; c.fillRect(Math.random() * w, Math.random() * h, 1, 3); } }, [120, 120]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ map: grassT, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  fixed(R.ColliderDesc.cuboid(600, 0.5, 600), 0, -0.5, 0);

  // --- roads: a loop around the park (centre line ±70 x ±50, 10 m wide), and a road east to the test track
  const asphalt = (len, lines) => canvasTex(256, 256, (c, w, h) => {
    noise(c, w, h, '#3b3d40', 0.18, 12000, 2);
    if (lines) {
      c.fillStyle = '#e8e6df'; c.fillRect(0, 10, w, 5); c.fillRect(0, h - 15, w, 5);
      c.fillStyle = '#e9c24a'; c.fillRect(0, h / 2 - 3, w * 0.5, 6);
    }
  }, [len / 10, 1]);
  const roadMat = (len, lines = true) => new THREE.MeshStandardMaterial({ map: asphalt(len, lines), roughness: 0.92 });
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
  const paveT = canvasTex(128, 128, (c, w, h) => { noise(c, w, h, '#a9a49b', 0.12, 3000, 2); c.strokeStyle = 'rgba(60,55,50,.35)'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2); });
  const pave = (len, along) => { const t = paveT.clone(); t.needsUpdate = true; t.repeat.set(along ? len / 2 : 1.75, along ? 1.75 : len / 2); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }); };
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

  // --- buildings around the outside of the loop
  const facade = (wallC, glassC, lit) => canvasTex(128, 128, (c, w, h) => {
    noise(c, w, h, wallC, 0.1, 2500, 2);
    c.fillStyle = glassC; c.fillRect(22, 26, 84, 74);
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(22, 26, 84, 8);
    if (lit) { c.fillStyle = 'rgba(255,220,150,.35)'; c.fillRect(22, 26, 84, 74); }
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 118, w, 10); c.fillRect(62, 26, 4, 74);
  });
  const palettes = [['#b9a48a', '#30404f'], ['#8f9aa1', '#26323c'], ['#c7b9a4', '#3a4652'], ['#a35a43', '#2d3a44'], ['#d7d2c8', '#2f4a5e'], ['#6f7478', '#1f2a33'], ['#c4a46a', '#33424d']];
  const roofM = new THREE.MeshStandardMaterial({ color: 0x55575a, roughness: 1 });
  const building = (x, z, w, d, h, ry) => {
    const [wc, gc] = palettes[Math.floor(rand() * palettes.length)];
    const tex = facade(wc, gc, rand() < 0.3); tex.repeat.set(Math.max(1, Math.round(w / 3.2)), Math.max(1, Math.round(h / 3.4)));
    const tex2 = tex.clone(); tex2.needsUpdate = true; tex2.repeat.set(Math.max(1, Math.round(d / 3.2)), Math.max(1, Math.round(h / 3.4)));
    const mA = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), mB = new THREE.MeshStandardMaterial({ map: tex2, roughness: 0.85 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mB, mB, roofM, roofM, mA, mA]);
    m.position.set(x, h / 2, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; scene.add(m);
    fixed(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2), x, h / 2, z, ry);
    const par = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.6, d + 0.3), roofM); par.position.set(x, h + 0.3, z); par.rotation.y = ry; scene.add(par);
  };
  const outer = A + W / 2 + SW, outerZ = Bz + W / 2 + SW;
  for (const side of [-1, 1]) { // north and south rows
    for (let x = -outer + 2; x < outer - 6;) {
      const w = 12 + rand() * 12, d = 14 + rand() * 8, h = 8 + rand() * 26;
      if (x + w > outer) break;
      building(x + w / 2, side * (outerZ + 1.5 + d / 2), w, d, h, 0);
      x += w + 2 + rand() * 4;
    }
  }
  for (let z = -outerZ + 2; z < outerZ - 6;) { // the west row
    const w = 12 + rand() * 10, d = 14 + rand() * 8, h = 8 + rand() * 26;
    if (z + w > outerZ) break;
    building(-(outer + 1.5 + d / 2), z + w / 2, d, w, h, 0);
    z += w + 2 + rand() * 4;
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
