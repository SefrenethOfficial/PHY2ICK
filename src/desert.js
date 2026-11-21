// The Dry: the desert north of Halyard, over the causeway. Red flats and low dunes, mesas, scrub and cacti,
// a two-lane highway running up the middle with telegraph poles beside it, a couple of side roads and dirt
// tracks, and all round it a wall of mountains you can't get over (for now: there's an invisible fence at
// their foot). Out here nobody's watching.
import * as THREE from 'three';
import { canvasTex, noise } from './world.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// the patch of world it covers (metres); the south edge is under the sea between it and the island
export const DRY = { x0: -1000, x1: 1300, z0: -2400, z1: -392, shore: -470 };
const STEP = 10;
const RW = 11; // (same width as the island's roads, so the traffic's lanes line up)

// a little deterministic value noise
function hash(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
const fbm = (x, z, o = 4) => { let v = 0, a = 0.5, f = 1; for (let k = 0; k < o; k++) { v += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return v; };
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// the roads out here: [points], paved roads join the island's road graph (traffic and the police use them)
function roads(start) {
  const s = start;
  return {
    paved: [
      [s, [130.3, -760], [20, -1080], [20, -1650], [180, -1950], [180, -2110]], // the highway, up the middle
      [[130.3, -760], [620, -860], [900, -1250]],                                 // east, towards the big mesas
      [[20, -1080], [-480, -1180], [-640, -1500]],                                // west, into the flats
    ],
    dirt: [
      [[620, -860], [560, -1060], [470, -1260]],   // up an old track to a flat bit behind the mesas
      [[20, -1420], [260, -1500], [330, -1620]],
      [[-480, -1180], [-430, -930], [-560, -760]],
    ],
  };
}
// distance from a point to a polyline
function distLine(x, z, line) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), px = ax + dx * t - x, pz = az + dz * t - z;
    best = Math.min(best, px * px + pz * pz);
  }
  return Math.sqrt(best);
}

export function buildDesert(g, islandSegs) {
  const { scene, world, R } = g;
  // where the island's main north–south road runs out at the coast: the highway carries on from there
  let start = [130.3, -379];
  for (const s of islandSegs) for (const p of [s.a, s.b]) if (Math.abs(p[0] - 130.3) < 1.5 && p[1] < start[1] + 30 && p[1] < -300) start = [p[0], p[1]];
  const RD = roads(start);
  const mesas = [[-300, -820, 52, 78], [430, -1130, 70, 104], [-250, -1520, 40, 64], [650, -1560, 84, 120], [330, -1880, 34, 58], [-720, -980, 40, 70], [920, -1720, 56, 96], [-520, -1930, 62, 88], [860, -1020, 30, 52], [-120, -2080, 50, 76]]
    .filter(([x, z, r]) => [...RD.paved, ...RD.dirt].every(l => distLine(x, z, l) > r * 1.4 + 26));

  // ---- the ground: one height for everywhere
  const base = (x, z) => {
    const inl = DRY.shore - z; // (how far inland from the shore)
    let h = inl < 0 ? -4 + 4 * ss(-40, 0, inl) : 0.35 + Math.min(6, inl * 0.003) + ss(0, 30, inl) * 0.2;
    return h;
  };
  const edge = (x, z) => Math.min(x - DRY.x0, DRY.x1 - x, z - DRY.z0);
  const mountain = (x, z) => {
    const e = edge(x, z), k = Math.pow(ss(360, 0, e), 1.5) * ss(-392, -560, z);
    if (k <= 0) return 0;
    const ridge = 1 - Math.abs(fbm(x * 0.004, z * 0.004, 5) * 2 - 1); // (sharp ridges)
    return k * (150 + ridge * 260 + fbm(x * 0.02, z * 0.02, 3) * 40);
  };
  const roadMask = (x, z) => {
    let m = 0;
    for (const l of RD.paved) { const d = distLine(x, z, l); if (d < 26) m = Math.max(m, 1 - ss(7, 24, d)); }
    for (const l of RD.dirt) { const d = distLine(x, z, l); if (d < 16) m = Math.max(m, 1 - ss(3.5, 14, d)); }
    return m;
  };
  const roadY = (x, z) => Math.max(0.05, base(x, z));
  const mesaAt = (x, z) => mesas.find(([mx, mz, r]) => Math.hypot(x - mx, z - mz) < r * 1.5);
  const height = (x, z) => {
    let h = base(x, z);
    if (DRY.shore - z > 0) h += Math.max(0, fbm(x * 0.011, z * 0.011, 4) - 0.4) * 9 * ss(0, 60, DRY.shore - z); // (low dunes and swells)
    h += mountain(x, z);
    const m = roadMask(x, z); if (m > 0) h = h + (roadY(x, z) - h) * m;
    return h;
  };

  const NX = Math.round((DRY.x1 - DRY.x0) / STEP), NZ = Math.round((DRY.z1 - DRY.z0) / STEP);
  const pos = new Float32Array((NX + 1) * (NZ + 1) * 3), colr = new Float32Array(pos.length), uv = new Float32Array((NX + 1) * (NZ + 1) * 2);
  const H = new Float32Array((NX + 1) * (NZ + 1));
  const sand = new THREE.Color(0xc88e5c), red = new THREE.Color(0xa24e2a), rock = new THREE.Color(0x7a4632), dark = new THREE.Color(0x553528), pale = new THREE.Color(0xd8b88a), tmp = new THREE.Color();
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const x = DRY.x0 + i * STEP, z = DRY.z0 + j * STEP, h = height(x, z), k = j * (NX + 1) + i;
    H[k] = h; pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; uv[k * 2] = x / 7; uv[k * 2 + 1] = z / 7;
    const n = fbm(x * 0.006 + 31, z * 0.006 - 17, 3);
    tmp.copy(sand).lerp(red, ss(0.35, 0.7, n));
    if (h > 12) tmp.lerp(rock, ss(12, 60, h)); if (h > 120) tmp.lerp(dark, ss(120, 300, h) * 0.8);
    if (DRY.shore - z < 25) tmp.lerp(pale, 0.6 * ss(25, 0, DRY.shore - z));
    colr[k * 3] = tmp.r; colr[k * 3 + 1] = tmp.g; colr[k * 3 + 2] = tmp.b;
  }
  const idx = new Uint32Array(NX * NZ * 6); let q = 0;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colr, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals();
  const dirtT = canvasTex(256, 256, (c, w, h) => { noise(c, w, h, '#ffffff', 0.22, 26000, 2); for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(90,60,40,${0.05 + Math.random() * 0.1})`; c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 1); } });
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: dirtT, vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true; scene.add(ground);
  world.createCollider(R.ColliderDesc.trimesh(pos, idx));
  // the height at any point, as the mesh has it (between the grid points)
  const groundY = (x, z) => {
    const fi = (x - DRY.x0) / STEP, fj = (z - DRY.z0) / STEP; if (fi < 0 || fj < 0 || fi >= NX || fj >= NZ) return -8;
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, k = j * (NX + 1) + i;
    const a = H[k], b = H[k + 1], c = H[k + NX + 1], d = H[k + NX + 2];
    return u + v < 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  };

  // ---- the roads: asphalt with a broken yellow line and white edges; the dirt tracks just packed earth
  const ribbon = (line, width, mat, yOff) => {
    const P = [], I = [], UV = []; let along = 0;
    const pts = [];
    for (let i = 0; i < line.length - 1; i++) { const [ax, az] = line[i], [bx, bz] = line[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 4); for (let k = 0; k < n; k++) pts.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]); }
    pts.push(line[line.length - 1]);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[Math.max(0, i - 1)], n2 = pts[Math.min(pts.length - 1, i + 1)], dx = n2[0] - p[0], dz = n2[1] - p[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
      if (i) along += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      for (const s of [-1, 1]) { const x = pts[i][0] + nx * s * width / 2, z = pts[i][1] + nz * s * width / 2; P.push(x, (z > DRY.z1 - 1 ? 0.03 : groundY(x, z)) + yOff, z); UV.push(s < 0 ? 0 : 1, along / width); }
      if (i) { const a = (i - 1) * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); gg.setIndex(I); gg.computeVertexNormals();
    const m = new THREE.Mesh(gg, mat); m.receiveShadow = true; scene.add(m); return m;
  };
  const roadT = canvasTex(128, 256, (c, w, h) => {
    noise(c, w, h, '#4a4744', 0.18, 9000, 2);
    c.fillStyle = '#e8e4d8'; c.fillRect(4, 0, 4, h); c.fillRect(w - 8, 0, 4, h);
    c.fillStyle = '#e0b830'; c.fillRect(w / 2 - 3, 0, 6, h * 0.55);
  });
  roadT.wrapS = THREE.ClampToEdgeWrapping;
  const roadM = new THREE.MeshStandardMaterial({ map: roadT, roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const l of RD.paved) ribbon(l, RW, roadM, 0.06);
  const trackT = canvasTex(128, 128, (c, w, h) => { noise(c, w, h, '#9a7656', 0.25, 7000, 2); c.fillStyle = 'rgba(70,50,35,.35)'; c.fillRect(w * 0.22, 0, w * 0.12, h); c.fillRect(w * 0.66, 0, w * 0.12, h); });
  const trackM = new THREE.MeshStandardMaterial({ map: trackT, roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const l of RD.dirt) ribbon(l, 5, trackM, 0.05);
  // where the causeway meets the island's sea wall (the gap between the two)
  { const fill = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 14), new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.95 })); fill.position.set(start[0], 0.03 - 4, -389); fill.receiveShadow = true; scene.add(fill);
    world.createCollider(R.ColliderDesc.cuboid(11, 4, 7).setTranslation(start[0], 0.03 - 4, -389)); }
  // the causeway's sides: piled rocks down into the water
  { const rockM = new THREE.MeshStandardMaterial({ color: 0x7a7068, roughness: 1, flatShading: true }), rg = new THREE.DodecahedronGeometry(1, 0);
    const n = 70, im = new THREE.InstancedMesh(rg, rockM, n), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3();
    for (let k = 0; k < n; k++) { const z = -390 - (k >> 1) / (n / 2 - 1) * (-390 - DRY.shore - 4), side = k % 2 ? 1 : -1, x = start[0] + side * (8.5 + Math.random() * 3); const y = groundY(x, z); Q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, 0)); S3.setScalar(1.2 + Math.random() * 1.4); M.compose(V(x, y - 0.2, z), Q, S3); im.setMatrixAt(k, M); }
    im.castShadow = true; im.receiveShadow = true; scene.add(im); }

  // ---- mesas: flat-topped, layered rock (stripes of red, orange and cream), a slope of rubble round the foot
  const strata = [0x9a4228, 0xb85a30, 0xc98450, 0xa04a2a, 0xd6a070, 0x7e3620];
  for (const [mx, mz, r, h] of mesas) {
    const N = 22, prof = [];
    for (let i = 0; i < N; i++) prof.push(r * (0.82 + fbm(mx * 0.1 + i * 0.6, mz * 0.1, 2) * 0.36));
    const rings = [[0, 1.45], [0.1, 1.18], [0.22, 1.03], [0.26, 1.0], [0.55, 0.99], [0.6, 0.955], [0.85, 0.95], [1, 0.93]];
    const y0 = groundY(mx, mz) - 2;
    const P = [], C = [], I = [], col = new THREE.Color();
    rings.forEach(([fy, fr], ri) => {
      const y = y0 + fy * h;
      for (let i = 0; i < N; i++) {
        const a = i / N * Math.PI * 2, rr = prof[i] * fr * (ri === 0 ? 1 + Math.random() * 0.15 : 1);
        P.push(mx + Math.cos(a) * rr, ri === 0 ? groundY(mx + Math.cos(a) * rr, mz + Math.sin(a) * rr) - 1 : y, mz + Math.sin(a) * rr);
        col.setHex(ri <= 1 ? 0xa0623a : strata[(ri * 2 + Math.floor(fy * 9)) % strata.length]); col.offsetHSL(0, 0, (Math.random() - 0.5) * 0.04);
        C.push(col.r, col.g, col.b);
      }
    });
    for (let ri = 0; ri < rings.length - 1; ri++) for (let i = 0; i < N; i++) { const a = ri * N + i, b = ri * N + (i + 1) % N, c = a + N, d = b + N; I.push(a, c, b, b, c, d); }
    const top = P.length / 3; P.push(mx, y0 + h + 0.5, mz); col.setHex(0xc08050); C.push(col.r, col.g, col.b);
    for (let i = 0; i < N; i++) I.push(top, (rings.length - 1) * N + (i + 1) % N, (rings.length - 1) * N + i);
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); mg.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); mg.setIndex(I); mg.computeVertexNormals();
    const mm = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })); mm.castShadow = true; mm.receiveShadow = true; scene.add(mm);
    world.createCollider(R.ColliderDesc.convexHull(new Float32Array(P)));
  }

  // ---- scrub, cacti, rocks (instanced; nothing to bump into but the big rocks)
  const rnd = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const spots = (n, ok) => { const out = []; for (let t = 0; t < n * 6 && out.length < n; t++) { const x = DRY.x0 + 120 + rnd() * (DRY.x1 - DRY.x0 - 240), z = DRY.z0 + 120 + rnd() * (DRY.shore - 30 - DRY.z0 - 120), y = groundY(x, z); if (y < 0.3 || y > 30 || roadMask(x, z) > 0.02 || mesaAt(x, z) || !ok(x, z)) continue; out.push([x, y, z]); } return out; };
  const scatter = (geo, mat, list, scale, shadow = false) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3();
    list.forEach(([x, y, z], k) => { Q.setFromEuler(new THREE.Euler(0, rnd() * 6.28, 0)); const s = scale(); S3.set(s, s * (0.8 + rnd() * 0.4), s); M.compose(V(x, y, z), Q, S3); im.setMatrixAt(k, M); });
    im.castShadow = shadow; im.receiveShadow = true; scene.add(im); return im;
  };
  { // sagebrush: lumpy grey-green balls
    const bg = new THREE.IcosahedronGeometry(0.6, 0); bg.translate(0, 0.35, 0);
    scatter(bg, new THREE.MeshStandardMaterial({ color: 0x7a7a52, roughness: 1, flatShading: true }), spots(1800, () => true), () => 0.6 + rnd() * 1.1);
    const dg = new THREE.IcosahedronGeometry(0.5, 0); dg.translate(0, 0.25, 0);
    scatter(dg, new THREE.MeshStandardMaterial({ color: 0x9a7a4a, roughness: 1, flatShading: true }), spots(900, () => true), () => 0.5 + rnd() * 0.8);
  }
  { // saguaro cacti: a trunk and an arm or two
    const parts = [], cyl = (r, h, x, y, z, rz = 0) => { const c = new THREE.CylinderGeometry(r, r, h, 8); if (rz) c.rotateZ(rz); c.translate(x, y, z); parts.push(c); };
    cyl(0.32, 5, 0, 2.5, 0); cyl(0.22, 1.6, 0.75, 3.1, 0); cyl(0.22, 0.75, 0.42, 2.4, 0, Math.PI / 2); cyl(0.2, 1.2, -0.7, 2.6, 0); cyl(0.2, 0.7, -0.38, 2.0, 0, Math.PI / 2);
    const merged = mergeGeometries(parts, false);
    const list = spots(260, () => true);
    scatter(merged, new THREE.MeshStandardMaterial({ color: 0x4a6a3a, roughness: 0.9, flatShading: true }), list, () => 0.7 + rnd() * 0.6, true);
    for (const [x, y, z] of list) world.createCollider(R.ColliderDesc.cylinder(2.5, 0.35).setTranslation(x, y + 2.5, z));
  }
  { // rocks and boulders
    const rg = new THREE.DodecahedronGeometry(1, 0);
    const list = spots(500, () => true);
    scatter(rg, new THREE.MeshStandardMaterial({ color: 0x8a5a40, roughness: 1, flatShading: true }), list, () => 0.4 + Math.pow(rnd(), 3) * 3, true);
  }

  // ---- telegraph poles along the highway, wires sagging between them
  {
    const hw = RD.paved[0], poles = [];
    let carry = 0;
    for (let i = 0; i < hw.length - 1; i++) {
      const [ax, az] = hw[i], [bx, bz] = hw[i + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
      for (let t = carry; t < L; t += 45) { const x = ax + ux * t + uz * 10, z = az + uz * t - ux * 10; if (DRY.shore - z > 5) poles.push([x, groundY(x, z), z, Math.atan2(ux, uz)]); carry = t + 45 - L; }
    }
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a4434, roughness: 1 });
    const pg = new THREE.CylinderGeometry(0.13, 0.17, 9, 6); pg.translate(0, 4.5, 0);
    const xg = new THREE.BoxGeometry(2.2, 0.14, 0.14); xg.translate(0, 8.4, 0);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), one = V(1, 1, 1);
    const pim = new THREE.InstancedMesh(pg, wood, poles.length), xim = new THREE.InstancedMesh(xg, wood, poles.length);
    poles.forEach(([x, y, z, yaw], k) => { Q.setFromEuler(new THREE.Euler(0, yaw, 0)); M.compose(V(x, y, z), Q, one); pim.setMatrixAt(k, M); xim.setMatrixAt(k, M); });
    pim.castShadow = xim.castShadow = true; scene.add(pim, xim);
    const W = [];
    for (let k = 0; k < poles.length - 1; k++) for (const off of [-0.9, 0.9]) {
      const [x1, y1, z1, a1] = poles[k], [x2, y2, z2, a2] = poles[k + 1];
      const p1 = V(x1 + Math.cos(a1) * off, y1 + 8.5, z1 - Math.sin(a1) * off), p2 = V(x2 + Math.cos(a2) * off, y2 + 8.5, z2 - Math.sin(a2) * off);
      for (let s = 0; s < 8; s++) { const t0 = s / 8, t1 = (s + 1) / 8, sag = (t) => -Math.sin(t * Math.PI) * 0.9; const a = p1.clone().lerp(p2, t0), b = p1.clone().lerp(p2, t1); a.y += sag(t0); b.y += sag(t1); W.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(W, 3));
    scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x222222 })));
  }

  // ---- a sign at the end of the causeway, and a barrier where the highway runs into the mountains
  const sign = (x, z, yaw, w, h, draw) => {
    const y = groundY(x, z), t = canvasTex(512, Math.round(512 * h / w), draw);
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), [0, 0, 0, 0, 1, 1].map(i => i ? new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }) : new THREE.MeshStandardMaterial({ color: 0x6a6a6a })));
    board.position.set(x, y + 2.2 + h / 2, z); board.rotation.y = yaw; board.castShadow = true; scene.add(board);
    for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3 + h / 2, 0.12), new THREE.MeshStandardMaterial({ color: 0x777777 })); post.position.set(x + Math.cos(yaw) * s * w * 0.35, y + (2.3 + h / 2) / 2, z - Math.sin(yaw) * s * w * 0.35); scene.add(post); }
    world.createCollider(R.ColliderDesc.cuboid(w / 2, 0.3, 0.1).setTranslation(x, y + 1.2, z).setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0))));
  };
  sign(start[0] + 9, DRY.shore - 18, Math.PI, 5, 2.6, (c, w, h) => {
    c.fillStyle = '#1f5a34'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f2f2ea'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#f2f2ea'; c.textAlign = 'center'; c.font = 'bold 64px Arial'; c.fillText('THE DRY', w / 2, 96);
    c.font = 'bold 34px Arial'; c.fillText('NO SERVICES NEXT 60 MILES', w / 2, 158); c.fillText('CARRY WATER', w / 2, 206);
  });
  const end = RD.paved[0][RD.paved[0].length - 1];
  sign(end[0], end[1] + 8, 0, 6, 1.4, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f2f2ea' : '#d8302a'; c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64 + 64, 0); c.lineTo(i * 64, h); c.lineTo(i * 64 - 64, h); c.fill(); } c.fillStyle = '#111'; c.fillRect(120, h / 2 - 34, 272, 68); c.fillStyle = '#fff'; c.font = 'bold 48px Arial'; c.textAlign = 'center'; c.fillText('ROAD CLOSED', w / 2, h / 2 + 17); });

  // ---- the fence you can't see: at the foot of the mountains (and out to sea at the corners)
  {
    const inset = 230, Hh = 300, wall = (x, z, hx, hz) => world.createCollider(R.ColliderDesc.cuboid(hx, Hh, hz).setTranslation(x, Hh / 2 - 10, z));
    const wx0 = DRY.x0 + inset, wx1 = DRY.x1 - inset, wz0 = DRY.z0 + inset, zS = -300;
    wall(wx0, (wz0 + zS) / 2, 1, (zS - wz0) / 2); wall(wx1, (wz0 + zS) / 2, 1, (zS - wz0) / 2); wall((wx0 + wx1) / 2, wz0, (wx1 - wx0) / 2, 1);
  }

  // ---- what the rest of the game needs to know
  const segs = [];
  for (const l of RD.paved) for (let i = 0; i < l.length - 1; i++) {
    const s = { a: l[i], b: l[i + 1], desert: true }; s.L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]); s.u = [(s.b[0] - s.a[0]) / s.L, (s.b[1] - s.a[1]) / s.L]; s.n = [-s.u[1], s.u[0]]; s.axis = null; s.cross = []; segs.push(s);
  }
  const inside = (x, z) => x > DRY.x0 && x < DRY.x1 && z > DRY.z0 && z < DRY.z1;
  return {
    segs, roads: RD, mesas, groundY,
    inLand: (x, z) => inside(x, z) && groundY(x, z) > -0.45,
    inRoad: (x, z) => inside(x, z) && RD.paved.some(l => distLine(x, z, l) < RW / 2),
    inDesert: (x, z) => inside(x, z) && z < DRY.shore + 10,
    // the minimap
    draw(ctx, tx, tz, k) {
      const step = 20;
      for (let z = DRY.z0; z < DRY.z1; z += step) for (let x = DRY.x0; x < DRY.x1; x += step) {
        const y = groundY(x + step / 2, z + step / 2); if (y < -0.45) continue;
        ctx.fillStyle = y > 60 ? '#6a4a3a' : y > 12 ? '#8a6a4a' : '#b08a62'; ctx.fillRect(tx(x), tz(z), step * k + 0.6, step * k + 0.6);
      }
      ctx.fillStyle = '#9a5a3a';
      for (const [mx, mz, r] of mesas) { ctx.beginPath(); ctx.arc(tx(mx), tz(mz), r * k, 0, 7); ctx.fill(); }
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#8a7050'; ctx.lineWidth = 5 * k;
      for (const l of RD.dirt) { ctx.beginPath(); l.forEach(([x, z], i) => (i ? ctx.lineTo(tx(x), tz(z)) : ctx.moveTo(tx(x), tz(z)))); ctx.stroke(); }
      ctx.strokeStyle = '#d8d4cc'; ctx.lineWidth = RW * k;
      for (const l of RD.paved) { ctx.beginPath(); l.forEach(([x, z], i) => (i ? ctx.lineTo(tx(x), tz(z)) : ctx.moveTo(tx(x), tz(z)))); ctx.stroke(); }
    },
  };
}
