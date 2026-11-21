// The island: land, sea, beach, pier, roads, sidewalks, bridges, and every place on the map.
import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import { S, toX, toZ, LAND, LAND_BULGE, SAND, PIER, ROADS, PLACES, NORTH_X, NORTH_Y, NORTH_LINKS } from './map.js';
import { canvasTex, noise, rng, texPair, drawAsphalt, drawPave } from './world.js';
import { CityBuilder, worldUV } from './buildings.js';
import { makeWater } from './water.js';
import { buildInterior } from './interior.js';
import { buildDesert } from './desert.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const RW = 11, SW = 3.5, KERB = 0.15, WATER = -0.75;
const P = ([px, py]) => [toX(px), toZ(py)];
const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

// ---------- geometry helpers
const ellipseRing = (e, n = 96) => { const r = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; r.push([toX(e.cx + e.rx * Math.cos(a)), toZ(e.cy + e.ry * Math.sin(a))]); } r.push(r[0]); return r; };
const close = (ring) => [...ring, ring[0]];
function rect(a, b, half, ext) { // a strip round the line a→b
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
  const a2 = [a[0] - ux * ext, a[1] - uz * ext], b2 = [b[0] + ux * ext, b[1] + uz * ext];
  return close([[a2[0] + nx * half, a2[1] + nz * half], [b2[0] + nx * half, b2[1] + nz * half], [b2[0] - nx * half, b2[1] - nz * half], [a2[0] - nx * half, a2[1] - nz * half]]);
}
function shapesOf(mp) {
  const out = [];
  for (const poly of mp) {
    const sh = new THREE.Shape(poly[0].slice(0, -1).map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const hole of poly.slice(1)) sh.holes.push(new THREE.Path(hole.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, -z))));
    out.push(sh);
  }
  return out;
}
function flatGeo(mp, y) { const g = new THREE.ShapeGeometry(shapesOf(mp), 2); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; }
function slabGeo(mp, h) { const g = new THREE.ExtrudeGeometry(shapesOf(mp), { depth: h, bevelEnabled: false, curveSegments: 2 }); g.rotateX(-Math.PI / 2); return g; }
function inRing(x, z, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; }
const inMP = (x, z, mp) => mp.some(poly => inRing(x, z, poly[0]) && !poly.slice(1).some(h => inRing(x, z, h)));
function trimesh(g, world, R, geo) {
  const pos = geo.attributes.position.array, idx = geo.index ? geo.index.array : null;
  const v = new Float32Array(pos), i = idx ? new Uint32Array(idx) : new Uint32Array([...Array(pos.length / 3).keys()]);
  return world.createCollider(R.ColliderDesc.trimesh(v, i));
}

export function buildCity(g) {
  const { scene, world, R } = g;
  const rand = rng(777);
  const add = (m, shadow = true, recv = true) => { m.castShadow = shadow; m.receiveShadow = recv; scene.add(m); return m; };
  const col = (hx, hy, hz, x, y, z, ry = 0, rx = 0) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ'));
    return world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
  };
  const box = (w, h, d, x, y, z, mat, { collide = true, ry = 0, shadow = true } = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; add(m, shadow);
    if (collide) col(w / 2, h / 2, d / 2, x, y, z, ry);
    return m;
  };
  const city = g.city = new CityBuilder(g); city.rand = rand;
  const places = {}, footprints = [];
  g.workers = []; // (shopkeepers, from the interiors) // footprints: what's built on (rings), so lamps and people keep off it

  // ================= land, sea wall, beach, sea =================
  const landMP = polygonClipping.union(...LAND.map(p => [close(p.map(P))]), [ellipseRing(LAND_BULGE)]);
  const inLand = (x, z) => inMP(x, z, landMP);
  {
    const grassT = canvasTex(512, 512, (c, w, h) => {
      noise(c, w, h, '#5a7a3a', 0.2, 30000, 2);
      for (let i = 0; i < 9000; i++) { const gr = 95 + Math.random() * 60; c.fillStyle = `rgba(${gr * 0.7},${gr},${40 + Math.random() * 20},.55)`; c.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 4); }
    }, [1 / 6, 1 / 6]);
    const top = flatGeo(landMP, 0);
    // big soft patches of colour
    const p = top.attributes.position, colr = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), n = Math.sin(x * 0.021) * Math.cos(z * 0.017) * 0.5 + Math.sin(x * 0.007 + z * 0.011) * 0.5, k = 0.86 + n * 0.12; colr[i * 3] = k * (1 + n * 0.05); colr[i * 3 + 1] = k; colr[i * 3 + 2] = k * (0.95 - n * 0.05); }
    top.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    add(new THREE.Mesh(top, new THREE.MeshStandardMaterial({ map: grassT, vertexColors: true, roughness: 1 })), false);
    trimesh(g, world, R, top);
    // the sea wall all round
    const wallPts = [], wallIdx = [];
    for (const poly of landMP) for (const ring of poly) for (let i = 0; i < ring.length - 1; i++) {
      const [x1, z1] = ring[i], [x2, z2] = ring[i + 1], b = wallPts.length / 3;
      wallPts.push(x1, 0, z1, x2, 0, z2, x2, -8, z2, x1, -8, z1); wallIdx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wallPts, 3)); wg.setIndex(wallIdx); wg.computeVertexNormals();
    add(new THREE.Mesh(wg, std(0x8f8a80, 0.95, { side: THREE.DoubleSide })), false);
    trimesh(g, world, R, wg);
    // Palm Tree Beach: sand from the land's edge down into the water
    const n = 80, rows = [[LAND_BULGE, 0.04], [SAND, -0.5], [{ ...SAND, rx: SAND.rx + 22, ry: SAND.ry + 22 }, -3.2]];
    const bp = [], bi = [], buv = [];
    for (const [e, y] of rows) for (let i = 0; i <= n; i++) {
      const a = Math.PI * (i / n) * 1.04 - Math.PI * 0.02; // (the lower half, a touch more)
      const x = toX(e.cx + e.rx * Math.cos(a)), z = toZ(e.cy + e.ry * Math.sin(a)); bp.push(x, y, z); buv.push(x / 5, z / 5);
    }
    for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) { const a = r * (n + 1) + i, b = a + n + 1; bi.push(a, a + 1, b, a + 1, b + 1, b); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(buv, 2)); bg.setIndex(bi); bg.computeVertexNormals();
    const sandT = canvasTex(256, 256, (c, w, h) => { noise(c, w, h, '#e3cf9f', 0.16, 20000, 2); for (let i = 0; i < 300; i++) { c.fillStyle = 'rgba(150,120,80,.15)'; c.fillRect(Math.random() * w, Math.random() * h, 3, 1); } });
    add(new THREE.Mesh(bg, std(0xffffff, 1, { map: sandT, side: THREE.DoubleSide })), false);
    trimesh(g, world, R, bg);
    // the sea bed and the sea
    const bedT = canvasTex(256, 256, (c, w, h) => { noise(c, w, h, '#7a705a', 0.18, 20000, 2); for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '40,50,40' : '150,140,110'},.12)`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, 7); c.fill(); } }, [600, 600]);
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), std(0xffffff, 1, { map: bedT })); bed.rotation.x = -Math.PI / 2; bed.position.y = -8; scene.add(bed);
    world.createCollider(R.ColliderDesc.cuboid(3000, 0.5, 3000).setTranslation(0, -8.5, 0));
    g.water = makeWater(g, WATER);
    g.waterLevel = WATER;
  }

  // ================= roads, markings, crossings, sidewalks, paving, bridges =================
  const segs = ROADS.map(([a, b]) => ({ a: P(a), b: P(b) }));
  // the north grid: long lines, kept only where they're on land (a little in from the coast)
  {
    const onLand = (x, z) => inLand(x, z) && inLand(x + 9, z) && inLand(x - 9, z) && inLand(x, z + 9) && inLand(x, z - 9);
    const addLine = (a, b) => { // split a line into the pieces that are on land
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      let st = null;
      for (let t = 0; t <= L; t += 2) { const x = a[0] + ux * t, z = a[1] + uz * t, ok = onLand(x, z); if (ok && st === null) st = t; if ((!ok || t + 2 > L) && st !== null) { const e = ok ? t : t - 2; if (e - st > 25) segs.push({ a: [a[0] + ux * st, a[1] + uz * st], b: [a[0] + ux * e, a[1] + uz * e] }); st = null; } }
    };
    for (const py of NORTH_Y) addLine(P([0, py]), P([960, py]));
    for (const px of NORTH_X) addLine(P([px, 0]), P([px, 280]));
    for (const [px, y0, y1] of NORTH_LINKS) addLine(P([px, y0]), P([px, y1]));
  }
  for (const s of segs) { s.L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]); s.u = [(s.b[0] - s.a[0]) / s.L, (s.b[1] - s.a[1]) / s.L]; s.n = [-s.u[1], s.u[0]]; s.axis = Math.abs(s.u[0]) > 0.99 ? 'x' : Math.abs(s.u[1]) > 0.99 ? 'z' : null; }
  const roadMP = polygonClipping.union(...segs.map(s => [rect(s.a, s.b, RW / 2, RW / 2)]));
  const walkMP = polygonClipping.intersection(polygonClipping.difference(polygonClipping.union(...segs.map(s => [rect(s.a, s.b, RW / 2 + SW, RW / 2 + SW)])), roadMP), landMP);
  const paveMP = polygonClipping.intersection(polygonClipping.union(...segs.map(s => [rect(s.a, s.b, RW / 2 + 34, RW / 2 + 20)])), landMP);
  const inRoad = (x, z) => inMP(x, z, roadMP);
  g.inRoad = inRoad;
  {
    const urban = texPair(256, (c, w, h, bump) => { c.fillStyle = bump ? '#888' : '#9c978f'; c.fillRect(0, 0, w, h); for (let i = 0; i < 12000; i++) { const v = Math.random() < 0.5; c.fillStyle = `rgba(${v ? 255 : 0},${v ? 255 : 0},${v ? 255 : 0},${Math.random() * (bump ? 0.3 : 0.1)})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } c.fillStyle = bump ? '#444' : 'rgba(60,55,50,.35)'; c.fillRect(0, 0, w, 2); c.fillRect(0, 0, 2, h); if (!bump) for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(60,50,40,.08)'; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 0, 7); c.fill(); } }, [1 / 4, 1 / 4]);
    add(new THREE.Mesh(flatGeo(paveMP, 0.012), new THREE.MeshStandardMaterial({ ...urban, bumpScale: 0.8, roughness: 0.95 })), false);
    const asph = texPair(512, drawAsphalt, [1 / 9, 1 / 9]);
    add(new THREE.Mesh(flatGeo(roadMP, 0.03), new THREE.MeshStandardMaterial({ ...asph, bumpScale: 1.1, roughness: 0.88 })), false);
    const pave = texPair(256, drawPave, [1 / 1.6, 1 / 1.6]);
    const walkG = slabGeo(walkMP, KERB);
    add(new THREE.Mesh(walkG, new THREE.MeshStandardMaterial({ ...pave, bumpScale: 1.2, roughness: 0.93 })), false);
    trimesh(g, world, R, walkG);
  }
  // where each road meets the others (in metres along it)
  for (const s of segs) {
    s.cross = [];
    for (const o of segs) {
      if (o === s) continue;
      // proper crossing, or one end of o touching s
      const cand = [];
      const den = s.u[0] * o.u[1] - s.u[1] * o.u[0];
      if (Math.abs(den) > 1e-6) {
        const dx = o.a[0] - s.a[0], dz = o.a[1] - s.a[1];
        const t = (dx * o.u[1] - dz * o.u[0]) / den, u = (dx * s.u[1] - dz * s.u[0]) / den;
        if (t > -RW && t < s.L + RW && u > -RW && u < o.L + RW) cand.push(t);
      }
      for (const e of [o.a, o.b]) { const dx = e[0] - s.a[0], dz = e[1] - s.a[1], t = dx * s.u[0] + dz * s.u[1], d = Math.abs(dx * s.n[0] + dz * s.n[1]); if (d < RW && t > -RW && t < s.L + RW) cand.push(t); }
      for (const t of cand) if (!s.cross.some(c => Math.abs(c - t) < 3)) s.cross.push(t);
    }
    s.cross.sort((p, q) => p - q);
  }
  // markings: a dashed yellow centre line, white edge lines, zebra crossings near junctions (one merged mesh)
  {
    const mk = [];
    const quad = (cx, cz, along, across, ux, uz, color, y = 0.04) => {
      const nx = -uz, nz = ux, hx = along / 2, hy = across / 2;
      const pts = [[cx - ux * hx - nx * hy, cz - uz * hx - nz * hy], [cx + ux * hx - nx * hy, cz + uz * hx - nz * hy], [cx + ux * hx + nx * hy, cz + uz * hx + nz * hy], [cx - ux * hx + nx * hy, cz - uz * hx + nz * hy]];
      const b = mk.length;
      mk.push({ pts, color, y });
    };
    for (const s of segs) {
      const gaps = s.cross.map(t => [t - RW / 2 - 4.5, t + RW / 2 + 4.5]);
      const free = (t) => t > 2 && t < s.L - 2 && !gaps.some(([a, b]) => t > a && t < b);
      for (let t = 1.5; t < s.L; t += 6) if (free(t) && free(t + 3)) quad(s.a[0] + s.u[0] * (t + 1.5), s.a[1] + s.u[1] * (t + 1.5), 3, 0.16, s.u[0], s.u[1], 0xd9b443);
      for (const side of [-1, 1]) for (let t = 0; t < s.L; t += 2) if (free(t) && free(t + 2)) quad(s.a[0] + s.u[0] * (t + 1) + s.n[0] * side * (RW / 2 - 0.45), s.a[1] + s.u[1] * (t + 1) + s.n[1] * side * (RW / 2 - 0.45), 2.02, 0.14, s.u[0], s.u[1], 0xdcd9cf);
      for (const t0 of s.cross) for (const sgn of [-1, 1]) {
        const t = t0 + sgn * (RW / 2 + 2.6);
        if (t < 1 || t > s.L - 1 || s.cross.some(c => c !== t0 && Math.abs(c - t) < RW / 2 + 1.5)) continue;
        for (let k = -RW / 2 + 0.9; k < RW / 2 - 0.5; k += 1.1) quad(s.a[0] + s.u[0] * t + s.n[0] * k, s.a[1] + s.u[1] * t + s.n[1] * k, 3, 0.55, s.u[0], s.u[1], 0xe8e6df);
      }
    }
    const pos = [], colr = [];
    for (const q of mk) { const c = new THREE.Color(q.color); const [p0, p1, p2, p3] = q.pts; for (const p of [p0, p1, p2, p0, p2, p3]) { pos.push(p[0], q.y, p[1]); colr.push(c.r, c.g, c.b); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true; scene.add(m);
  }
  // bridges: wherever a road runs over water
  {
    const deckM = std(0x8f8a80, 0.9), railM = std(0x3a3d40, 0.4, { metalness: 0.6 });
    for (const s of segs) {
      let start = null;
      for (let t = 0; t <= s.L + 0.01; t += 1) {
        const wet = !inLand(s.a[0] + s.u[0] * t, s.a[1] + s.u[1] * t); // (only where the road itself is over water)
        if (wet && start === null) start = t;
        if ((!wet || t >= s.L) && start !== null) {
          const t0 = Math.max(-RW / 2, start - 4), t1 = Math.min(s.L + RW / 2, t + 4), mid = (t0 + t1) / 2, len = t1 - t0;
          if (t - start < 1.5) { start = null; continue; } // (just grazing the coast: the land's enough)
          const cx = s.a[0] + s.u[0] * mid, cz = s.a[1] + s.u[1] * mid, ry = Math.atan2(s.u[0], s.u[1]);
          const deck = new THREE.Mesh(new THREE.BoxGeometry(RW + 2 * SW, 0.9, len), deckM); deck.position.set(cx, -0.5, cz); deck.rotation.y = ry; add(deck); // (its top just under the road surface)
          col((RW + 2 * SW) / 2, 0.45, len / 2, cx, -0.42, cz, ry);
          // its own sidewalks and railings
          for (const sd of [-1, 1]) {
            const ox = s.n[0] * sd * (RW / 2 + SW / 2), oz = s.n[1] * sd * (RW / 2 + SW / 2);
            const w = new THREE.Mesh(new THREE.BoxGeometry(SW, KERB + 0.06, len), new THREE.MeshStandardMaterial({ ...texPair(256, drawPave, [1, len / 1.6]), roughness: 0.93 })); w.position.set(cx + ox, KERB / 2 - 0.022, cz + oz); w.rotation.y = ry; add(w); // (a hair lower than the pavement it meets, so they never fight)
            col(SW / 2, KERB / 2, len / 2, cx + ox, KERB / 2, cz + oz, ry);
            const rx = cx + s.n[0] * sd * (RW / 2 + SW - 0.1), rz = cz + s.n[1] * sd * (RW / 2 + SW - 0.1);
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, len), railM); rail.position.set(rx, 0.65, rz); rail.rotation.y = ry; add(rail);
            col(0.05, 0.5, len / 2, rx, 0.65, rz, ry);
          }
          start = null;
        }
      }
    }
  }

  // ================= the places =================
  // what's built on, so lamps and people keep off it
  const blockRect = (x0, z0, x1, z1) => footprints.push(close([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]));
  const built = (x, z) => footprints.some(r => inRing(x, z, r));
  g.built = built;
  // pull a lot's edges back from any road it's too close to
  const clear = RW / 2 + SW + 0.6;
  function clamp(r) {
    let [x0, z0, x1, z1] = r;
    for (const s of segs) {
      if (s.axis === 'z') { // a north–south road at x
        const x = s.a[0], lo = Math.min(s.a[1], s.b[1]) - RW / 2, hi = Math.max(s.a[1], s.b[1]) + RW / 2;
        if (z1 < lo || z0 > hi) continue;
        const cx = (x0 + x1) / 2;
        if (x >= cx && x - clear < x1) x1 = Math.max(x0 + 4, x - clear);
        if (x < cx && x + clear > x0) x0 = Math.min(x1 - 4, x + clear);
      } else if (s.axis === 'x') {
        const z = s.a[1], lo = Math.min(s.a[0], s.b[0]) - RW / 2, hi = Math.max(s.a[0], s.b[0]) + RW / 2;
        if (x1 < lo || x0 > hi) continue;
        const cz = (z0 + z1) / 2;
        if (z >= cz && z - clear < z1) z1 = Math.max(z0 + 4, z - clear);
        if (z < cz && z + clear > z0) z0 = Math.min(z1 - 4, z + clear);
      }
    }
    return [x0, z0, x1, z1];
  }
  // which face of a lot looks onto the nearest road
  function facing([x0, z0, x1, z1]) {
    let best = '+z', bd = Infinity;
    for (const s of segs) {
      if (s.axis === 'z') { const x = s.a[0], lo = Math.min(s.a[1], s.b[1]), hi = Math.max(s.a[1], s.b[1]); if (hi < z0 || lo > z1) continue; const d1 = x - x1, d0 = x0 - x; if (d1 >= 0 && d1 < bd) { bd = d1; best = '+x'; } if (d0 >= 0 && d0 < bd) { bd = d0; best = '-x'; } }
      else if (s.axis === 'x') { const z = s.a[1], lo = Math.min(s.a[0], s.b[0]), hi = Math.max(s.a[0], s.b[0]); if (hi < x0 || lo > x1) continue; const d1 = z - z1, d0 = z0 - z; if (d1 >= 0 && d1 < bd) { bd = d1; best = '+z'; } if (d0 >= 0 && d0 < bd) { bd = d0; best = '-z'; } }
    }
    return best;
  }
  const front = ([x0, z0, x1, z1], face, out = 3) => ({ '+z': V((x0 + x1) / 2, 0, z1 + out), '-z': V((x0 + x1) / 2, 0, z0 - out), '+x': V(x1 + out, 0, (z0 + z1) / 2), '-x': V(x0 - out, 0, (z0 + z1) / 2) })[face];
  const faceYaw = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 };
  let curAt = null;
  const placeAt = (name, pos) => { const key = name.toLowerCase(); let k = key, i = 2; while (places[k]) k = key + ' ' + i++; places[k] = { name, pos, at: curAt }; };

  // shared bits
  const bark = std(0x5a4330, 1), leafMs = [0x3f6e2f, 0x4d7a34, 0x5c8a3a, 0x3a5f2c].map(c => std(c, 0.95, { flatShading: true }));
  const iron = std(0x2b2d30, 0.5, { metalness: 0.6 }), wood = std(0x8a5a34, 0.9), stone = std(0xb8b2a6, 0.85);
  const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 3.2, 8), leafG = new THREE.IcosahedronGeometry(1, 1);
  const tree = (x, z, s = 1, y = 0) => {
    const t = new THREE.Mesh(trunkG, bark); t.position.set(x, y + 1.6 * s, z); t.scale.setScalar(s); add(t);
    const lm = leafMs[Math.floor(rand() * leafMs.length)];
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(leafG, lm); const r = (1.5 + rand() * 0.8) * s; l.scale.set(r, r * 0.85, r); l.position.set(x + (rand() - 0.5) * 1.4 * s, y + (3.4 + i * 0.7 + rand() * 0.4) * s, z + (rand() - 0.5) * 1.4 * s); add(l); }
    world.createCollider(R.ColliderDesc.cylinder(1.6 * s, 0.24 * s).setTranslation(x, y + 1.6 * s, z));
  };
  g.benches = [];
  const bench = (x, z, ry, y = 0) => {
    const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = ry; scene.add(grp);
    const a = (geo, mat, px, py, pz, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.x = rx; m.castShadow = true; grp.add(m); };
    a(new THREE.BoxGeometry(1.8, 0.06, 0.45), wood, 0, 0.46, 0); a(new THREE.BoxGeometry(1.8, 0.4, 0.05), wood, 0, 0.75, -0.22, -0.15);
    for (const s of [-0.8, 0.8]) a(new THREE.BoxGeometry(0.06, 0.46, 0.45), iron, s, 0.23, 0);
    col(0.9, 0.25, 0.25, x, y + 0.25, z, ry);
    g.benches.push({ pos: V(x, y, z).add(V(0, 0, 0.12).applyAxisAngle(V(0, 1, 0), ry)), yaw: ry, taken: null });
  };
  const lampHead = std(0xfff2cc, 0.4, { emissive: 0xffe2a0, emissiveIntensity: 0.6 });
  const lamp = (x, z, y = KERB) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 6, 8), iron); p.position.set(x, y + 3, z); add(p);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.28), lampHead); h.position.set(x, y + 6, z); scene.add(h);
    world.createCollider(R.ColliderDesc.cylinder(3, 0.1).setTranslation(x, y + 3, z));
  };
  const grass = (x0, z0, x1, z1, y = 0.02) => { const t = canvasTex(256, 256, (c, w, h) => { noise(c, w, h, '#4f7a33', 0.22, 16000, 2); for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(${70 + Math.random() * 40},${120 + Math.random() * 40},50,.5)`; c.fillRect(Math.random() * w, Math.random() * h, 1, 3); } }, [(x1 - x0) / 6, (z1 - z0) / 6]); const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), std(0xffffff, 1, { map: t })); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m); };
  const textTex = (text, { w = 512, h = 96, bg = '#1d2a38', fg = '#f1dfa8', font = 'bold 56px "Arial Narrow", Arial' } = {}) => canvasTex(w, h, (c) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle'; const fw = c.measureText(text).width; if (fw > w - 24) c.font = font.replace(/\d+px/, Math.floor(parseInt(font.match(/(\d+)px/)[1]) * (w - 24) / fw) + 'px'); c.fillText(text, w / 2, h / 2 + 2); });
  const signBoard = (text, x, y, z, ry, width, opts = {}) => { const t = textTex(text, opts); const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width * (opts.h || 96) / (opts.w || 512)), new THREE.MeshStandardMaterial({ map: t, emissive: opts.glow ? new THREE.Color(opts.glow) : 0x000000, emissiveMap: opts.glow ? t : null, emissiveIntensity: opts.glow ? 1.6 : 0, roughness: 0.5 })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };
  const onFace = (r, face, u, y, out) => { const [x0, z0, x1, z1] = r, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; return { '+z': V(cx + u, y, z1 + out), '-z': V(cx - u, y, z0 - out), '+x': V(x1 + out, y, cz - u), '-x': V(x0 - out, y, cz + u) }[face]; };
  const parked = []; // where cars get parked: [x, z, yaw, colour?]
  const lotPaint = (x0, z0, x1, z1, along = 'z') => { // an asphalt lot with bays
    const asph = texPair(512, drawAsphalt, [(x1 - x0) / 9, (z1 - z0) / 9]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ ...asph, bumpScale: 1, roughness: 0.9 })); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.025, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
    const lineM = std(0xe8e6df, 0.8, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const W = x1 - x0, D = z1 - z0, alongZ = along === 'z';
    const rows = alongZ ? Math.max(1, Math.floor(W / 13)) : Math.max(1, Math.floor(D / 13));
    for (let r = 0; r < rows; r++) {
      const c0 = (alongZ ? x0 : z0) + 1 + r * ((alongZ ? W : D) - 2) / rows, c1 = c0 + ((alongZ ? W : D) - 2) / rows;
      const len = alongZ ? D : W;
      for (const edge of [c0, c1 - 5.2]) for (let t = 1; t < len - 2.6; t += 2.7) {
        const l = new THREE.Mesh(new THREE.PlaneGeometry(alongZ ? 5.2 : 0.12, alongZ ? 0.12 : 5.2), lineM); l.rotation.x = -Math.PI / 2;
        if (alongZ) l.position.set(edge + 2.6, 0.035, z0 + t); else l.position.set(x0 + t, 0.035, edge + 2.6);
        scene.add(l);
        if (rand() < 0.22 && t + 1.35 < len - 2.6) parked.push(alongZ ? [edge + 2.6, z0 + t + 1.35, edge === c0 ? -Math.PI / 2 : Math.PI / 2] : [x0 + t + 1.35, edge + 2.6, edge === c0 ? Math.PI : 0]);
      }
    }
  };

  for (const [name, kind, px0, py0, px1, py1, ex] of PLACES) {
    const raw = [toX(px0), toZ(py0), toX(px1), toZ(py1)];
    const r = ['triangle', 'sewer', 'hedge'].includes(kind) ? raw : clamp(raw);
    const [x0, z0, x1, z1] = r, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    const face = facing(r), aw = (face === '+x' || face === '-x') ? d : w; // (aw: the length of the front face)
    const bld = (opts) => { city.building({ x: cx, z: cz, w: w - 1, d: d - 1, ...opts }); blockRect(x0, z0, x1, z1); };
    // a building with a real room inside, behind its front wall
    const withRoom = (opts, kind, iopts = {}, maxDepth = 14, floors = 1, maxWidth = 18) => {
      const avail = (face === '+z' || face === '-z' ? d : w) - 1;
      const room = { face, depth: Math.max(6, Math.min(maxDepth, avail - (avail > 10 ? 2 : 0))), floors, width: maxWidth };
      city.building({ x: cx, z: cz, w: w - 1, d: d - 1, ...opts, room }); blockRect(x0, z0, x1, z1);
      const res = buildInterior(g, room, kind, { name, ...iopts }); g.workers.push(...res.workers);
    };
    const ROOMS = { 'Mini Mart': ['store', {}], 'A Rival Mini Mart': ['store', { lines: ["The OTHER mini mart? Never heard of it.", "Our prices are lower. Probably.", "What can I get you?"] }], 'Convenience Store': ['store', {}], 'Grocery': ['store', { fridges: true }], 'Game Shop': ['store', { products: 'games', fridges: false, sign: 'NEW RELEASES', lines: ["Pre-orders are back there.", "No, we don't have the new one yet.", "You look like a racing-game person."] }], 'Home Improvements': ['store', { products: 'tools', fridges: false, sign: 'PAINT · TOOLS · TIMBER', lines: ["Aisle 4 for hammers.", "We don't hire out the chainsaw any more. Long story."] }], 'Cheap House': ['store', { products: 'cheap', fridges: false, sign: 'EVERYTHING $2', lines: ["Everything's two dollars.", "Even that. Yes, that too."] }], 'Pawn Shop': ['pawn', {}], 'Halyard Arms': ['gunstore', {}], 'Spa': ['lobby', { variant: 'spa', floor: 'wood' }], 'City Wok': ['restaurant', { variant: 'wok', floor: 'tiles' }] };
    curAt = V(cx, 0, cz);
    switch (kind) {
      case 'shop':
        if (ROOMS[name] && !ex.solid) { const [k, io] = ROOMS[name]; withRoom({ floors: ex.floors || 2, style: ex.style || 'brick', shopFaces: [face], sign: ex.sign || name.toUpperCase(), wallIndex: ex.wall ?? null }, k, { bigWindows: k !== 'lobby', ...io }); ROOMS[name] = null; }
        else bld({ floors: ex.floors || 2, style: ex.style || 'brick', shopFaces: [face], sign: ex.sign || name.toUpperCase(), wallIndex: ex.wall ?? null });
        placeAt(name, front(r, face)); break;
      case 'storefronts': { // a row of four
        const n = 4, along = w >= d;
        for (let i = 0; i < n; i++) {
          const a0 = (along ? x0 : z0) + (i / n) * (along ? w : d), a1 = a0 + (along ? w : d) / n;
          const sub = along ? [a0 + 0.4, z0, a1 - 0.4, z1] : [x0, a0 + 0.4, x1, a1 - 0.4];
          city.building({ x: (sub[0] + sub[2]) / 2, z: (sub[1] + sub[3]) / 2, w: sub[2] - sub[0] - 0.6, d: sub[3] - sub[1] - 1, floors: 2 + Math.floor(rand() * 2), style: ['brick', 'stucco', 'stucco', 'concrete'][i], shopFaces: [face] });
        }
        blockRect(x0, z0, x1, z1); placeAt('the shops', front(r, face)); break;
      }
      case 'ritz':
        withRoom({ floors: 5, style: 'brick', wallIndex: 3, shopFaces: [face], sign: "PUTIN'S RITZ", signColors: ['#1a1410', '#e8c46a'] }, 'lobby', { variant: 'ritz', floor: 'marble', tint: 0xffe2a8 }, 14, 1, 22);
        { const p = onFace(r, face, 0, 0.03, 3); const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 6), std(0x9a1c1c, 0.9)); carpet.rotation.x = -Math.PI / 2; carpet.rotation.z = faceYaw[face]; carpet.position.copy(p); scene.add(carpet); }
        placeAt("Putin's Ritz", front(r, face)); break;
      case 'triangle': {
        const pts = ex.pts.map(P), cen = [(pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3];
        const sh = pts.map(([x, z]) => [cen[0] + (x - cen[0]) * 0.72, cen[1] + (z - cen[1]) * 0.72]); // (back from the roads)
        const H = 4.2 + (ex.floors - 1) * 3.3;
        const shape = new THREE.Shape(sh.map(([x, z]) => new THREE.Vector2(x, -z)));
        const geo = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
        const W = city.walls.stucco[name.startsWith('Shitty') ? 7 : 1]; worldUV(geo, W.scale);
        add(new THREE.Mesh(geo, W.m));
        world.createCollider(R.ColliderDesc.convexHull(new Float32Array(sh.flatMap(([x, z]) => [x, 0, z, x, H, z]))));
        footprints.push(close(sh));
        // a sign on the long side facing the road (the side between the first two points)
        const mx = (sh[0][0] + sh[1][0]) / 2, mz = (sh[0][1] + sh[1][1]) / 2;
        signBoard(name.toUpperCase(), mx, 3.6, mz - 0.08, Math.PI, Math.min(9, Math.hypot(sh[1][0] - sh[0][0], sh[1][1] - sh[0][1]) * 0.8), { bg: '#2b1d1d', fg: '#f1dfa8' });
        // windows on that side
        for (let fl = 0; fl < ex.floors; fl++) for (let k = -1; k <= 1; k++) { if (fl === 0 && k === 0) continue; const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.6), std(0x24323d, 0.1, { metalness: 0.8 })); win.position.set(mx + k * 3.2, 1.6 + fl * 3.3, mz - 0.06); win.rotation.y = Math.PI; scene.add(win); }
        placeAt(name, V(mx, 0, mz - 4)); break;
      }
      case 'plot': { // a fenced vegetable garden
        const soil = new THREE.Mesh(new THREE.BoxGeometry(w - 1, 0.25, d - 1), std(0x5a4030, 1)); soil.position.set(cx, 0.12, cz); add(soil);
        for (let i = 0; i < 5; i++) for (let j = 0; j < Math.floor((w - 3) / 0.8); j++) { const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), std(0x4a7a2c, 0.9, { flatShading: true })); pl.position.set(x0 + 1.5 + j * 0.8, 0.4, z0 + 1.5 + i * ((d - 3) / 4)); scene.add(pl); }
        const pick = std(0xe8e2d4, 0.8);
        for (const [a, b, c2, e] of [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]]) { const len = Math.hypot(c2 - a, e - b); const f = new THREE.Mesh(new THREE.BoxGeometry(a === c2 ? 0.06 : len, 0.8, a === c2 ? len : 0.06), pick); f.position.set((a + c2) / 2, 0.4, (b + e) / 2); add(f); col(a === c2 ? 0.03 : len / 2, 0.4, a === c2 ? len / 2 : 0.03, (a + c2) / 2, 0.4, (b + e) / 2); }
        blockRect(x0 - 2, z0 - 2, x1 + 2, z1 + 2); placeAt('the vegetable plot', front(r, face)); break;
      }
      case 'hospital': {
        withRoom({ floors: 4, style: 'stucco', wallIndex: 5, entrance: face, entranceSign: 'HOSPITAL' }, 'lobby', { variant: 'hospital', floor: 'tiles', tint: 0xf2f6ff, wallColor: 0xf2f2ee }, 14, 1, 24);
        // red crosses, an ambulance bay, a helipad on the roof
        const H = 4.2 + 3 * 3.3;
        for (const u of [-w / 3, w / 3]) { const p = onFace(r, face, u, H - 2.2, 0.62); const cr = signBoard('+', p.x, p.y, p.z, faceYaw[face], 2.4, { w: 128, h: 128, bg: '#ffffff', fg: '#d42a2a', font: 'bold 150px Arial' }); }
        const bayP = onFace(r, face, -aw / 4, 3.2, 3.5); const bay = new THREE.Mesh(new THREE.BoxGeometry(8, 0.25, 7), std(0xd8d6d0, 0.6)); bay.position.copy(bayP); bay.rotation.y = faceYaw[face]; add(bay);
        const pad = new THREE.Mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshStandardMaterial({ map: textTex('H', { w: 256, h: 256, bg: '#33363a', fg: '#f2f0ea', font: 'bold 200px Arial' }), roughness: 0.8 }));
        pad.rotation.x = -Math.PI / 2; pad.position.set(cx, H + 0.08, cz); scene.add(pad);
        g.hospitalSpawn = front(r, face, 2.5); g.hospitalYaw = faceYaw[face];
        placeAt('the Hospital', front(r, face)); break;
      }
      case 'skatepark': { // a concrete pad with ramps, a funbox and a rail
        const conc = std(0xb4b0a8, 0.85);
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.1, 48), conc); pad.scale.set(w / 2, 1, d / 2); pad.position.set(cx, 0.05, cz); add(pad); col(w / 2 * 0.7, 0.05, d / 2 * 0.7, cx, 0.05, cz);
        const wedge = (x, z, len, wid, hgt, ry) => {
          const hw = wid / 2, pts = [[-hw, 0, -len / 2], [hw, 0, -len / 2], [-hw, 0, len / 2], [hw, 0, len / 2], [-hw, hgt, len / 2], [hw, hgt, len / 2]];
          const v = new Float32Array(pts.flat()), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(v, 3)); geo.setIndex([0, 2, 1, 1, 2, 3, 0, 4, 2, 0, 1, 5, 0, 5, 4, 1, 3, 5, 2, 4, 5, 2, 5, 3]);
          const m = new THREE.Mesh(geo.toNonIndexed(), std(0xa9a59c, 0.8, { side: THREE.DoubleSide })); m.geometry.computeVertexNormals(); m.position.set(x, 0.1, z); m.rotation.y = ry; add(m);
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)); world.createCollider(R.ColliderDesc.convexHull(v).setTranslation(x, 0.1, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
        };
        wedge(cx - w * 0.3, cz, 6, 8, 1.8, Math.PI / 2); wedge(cx + w * 0.3, cz, 6, 8, 1.8, -Math.PI / 2);
        box(6, 0.8, 4, cx, 0.5, cz, conc); wedge(cx, cz - 4.5, 4, 4, 0.8, 0); wedge(cx, cz + 4.5, 4, 4, 0.8, Math.PI);
        box(0.08, 0.06, 7, cx + 8, 0.55, cz + 6, iron); for (const dz of [-3, 3]) box(0.06, 0.5, 0.06, cx + 8, 0.3, cz + 6 + dz, iron, { collide: false });
        blockRect(x0, z0, x1, z1); placeAt('the Skatepark', V(cx, 0, z1 + 2)); break;
      }
      case 'park':
        grass(x0, z0, x1, z1); blockRect(x0, z0, x1, z1);
        for (let i = 0; i < Math.max(1, Math.floor(w * d / 260)); i++) { const x = x0 + 3 + rand() * (w - 6), z = z0 + 3 + rand() * (d - 6); if (kind === 'park' && name === 'the park' && x > toX(284.1) - 2) continue; tree(x, z, 0.8 + rand() * 0.4); }
        if (w > 20) { bench(cx - w / 4, z1 - 2, Math.PI); bench(x0 + 6, cz, Math.PI / 2); }
        placeAt(name, V(cx, 0, cz)); break;
      case 'playground': {
        const sandM = std(0xd9c79a, 1); const sp = new THREE.Mesh(new THREE.PlaneGeometry(w - 1, d - 1), sandM); sp.rotation.x = -Math.PI / 2; sp.position.set(cx, 0.03, cz); sp.receiveShadow = true; scene.add(sp);
        const red = std(0xc8402e, 0.6), yel = std(0xe8b52a, 0.6), blu = std(0x2e6ac8, 0.6);
        // swings
        const sx = x0 + w * 0.2;
        for (const dz of [-1.6, 1.6]) for (const dx of [-1.4, 1.4]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 8), red); leg.position.set(sx + dx * 0.4, 1.35, cz + dz); leg.rotation.z = dx * 0.14; add(leg); }
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8), red); beam.rotation.x = Math.PI / 2; beam.position.set(sx, 2.7, cz); add(beam);
        for (const dz of [-0.7, 0.7]) { const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.25), blu); seat.position.set(sx, 0.5, cz + dz); add(seat); for (const ox of [-0.22, 0.22]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 2.2, 4), iron); ch.position.set(sx + ox, 1.6, cz + dz); scene.add(ch); } }
        col(0.4, 1.4, 1.8, sx, 1.4, cz);
        // a slide
        const slx = x0 + w * 0.55;
        box(1.4, 2.2, 1.4, slx, 1.1, cz - 2, yel);
        const sl = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 4.4), blu); sl.position.set(slx, 1.1, cz + 0.8); sl.rotation.x = 0.5; add(sl); col(0.4, 0.04, 2.2, slx, 1.1, cz + 0.8, 0, 0.5);
        // a climbing frame
        const fx = x0 + w * 0.82;
        for (let i = 0; i <= 3; i++) for (let j = 0; j <= 3; j++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), red); b.position.set(fx - 1.5 + i, 1.2, cz - 1.5 + j); add(b); }
        for (let k = 0; k < 3; k++) for (let i = 0; i <= 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3, 6), yel); b.rotation.z = Math.PI / 2; b.position.set(fx, 0.8 + k * 0.8, cz - 1.5 + i); add(b); }
        world.createCollider(R.ColliderDesc.cuboid(1.55, 1.2, 1.55).setTranslation(fx, 1.2, cz));
        blockRect(x0, z0, x1, z1); placeAt('the Playground', V(cx, 0, cz)); break;
      }
      case 'fountain': {
        const rr = Math.min(w, d) / 2;
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr + 0.2, 0.6, 40, 1, true), stone); basin.position.set(cx, 0.3, cz); add(basin);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.18, 8, 48), stone); rim.rotation.x = Math.PI / 2; rim.position.set(cx, 0.62, cz); scene.add(rim);
        const wtr = new THREE.Mesh(new THREE.CircleGeometry(rr - 0.1, 40), std(0x3f7fa0, 0.12, { transparent: true, opacity: 0.85 })); wtr.rotation.x = -Math.PI / 2; wtr.position.set(cx, 0.45, cz); scene.add(wtr); g.fountainWater = wtr;
        const colm = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 2, 16), stone); colm.position.set(cx, 1, cz); add(colm);
        world.createCollider(R.ColliderDesc.cylinder(0.31, rr + 0.2).setTranslation(cx, 0.31, cz));
        footprints.push(close([[cx - rr - 3, cz - rr - 3], [cx + rr + 3, cz - rr - 3], [cx + rr + 3, cz + rr + 3], [cx - rr - 3, cz + rr + 3]]));
        placeAt('the fountain', V(cx, 0, cz + rr + 2)); break;
      }
      case 'nightclub': {
        withRoom({ floors: 2, style: 'stucco', wallIndex: 6, shopFaces: [face], sign: 'NIGHTCLUB', signColors: ['#120818', '#ff4fd8'] }, 'club', { windows: false, floor: 'dark', ceiling: 0x111114, wallColor: 0x1a1420, noPanels: true, tint: 0xff4fd8, power: 40 }, 16, 1, 22);
        const p = onFace(r, face, 0, 6.6, 0.4); signBoard('◆ NIGHTCLUB ◆', p.x, p.y, p.z, faceYaw[face], 14, { bg: '#0a0410', fg: '#ff4fd8', glow: 0xff4fd8 });
        // the queue rope
        const door = onFace(r, face, -aw / 4, 0, 2.2), along = (face === '+z' || face === '-z') ? V(1, 0, 0) : V(0, 0, 1);
        for (let i = 0; i < 6; i++) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1, 10), std(0xd8b44a, 0.2, { metalness: 0.9 })); post.position.copy(door).addScaledVector(along, i * 1.6).setY(0.5); add(post); }
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 8, 6), std(0x9a1c3a, 0.8)); rope.rotation.z = Math.PI / 2; if (along.z) rope.rotation.set(Math.PI / 2, 0, 0); rope.position.copy(door).addScaledVector(along, 4).setY(0.85); scene.add(rope);
        placeAt('the Nightclub', front(r, face)); break;
      }
      case 'lawfirm': {
        { const lw = w - 9, ld = d - 9, avail = (face === '+z' || face === '-z' ? ld : lw); const room = { face, depth: Math.min(12, avail - 2), floors: 1, width: 18 }; city.building({ x: cx, z: cz, w: lw, d: ld, floors: 3, style: 'brick', wallIndex: 2, entrance: face, entranceSign: 'PAUL BADFELLA · ATTORNEY AT LAW', room }); g.workers.push(...buildInterior(g, room, 'lobby', { variant: 'law', floor: 'carpet', floorColor: '#2a3a2e', name }).workers); }
        // the fence (you have to jump it)
        const fm = std(0x1f2124, 0.5, { metalness: 0.7 }), H = 1.25;
        for (const [a, b, c2, e] of [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]]) {
          const len = Math.hypot(c2 - a, e - b), alongX = b === e;
          for (let t = 0; t <= len; t += 0.18) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, H, 0.03), fm); bar.position.set(alongX ? a + t : a, H / 2, alongX ? b : b + t); scene.add(bar); }
          for (const yy of [0.15, H - 0.08]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.05, 0.05, alongX ? 0.05 : len), fm); rail.position.set((a + c2) / 2, yy, (b + e) / 2); add(rail); }
          col(alongX ? len / 2 : 0.05, H / 2, alongX ? 0.05 : len / 2, (a + c2) / 2, H / 2, (b + e) / 2);
        }
        const p = onFace(r, face, 4, 1.1, 0.12); signBoard('PRIVATE PROPERTY · NO ENTRY', p.x, p.y, p.z, faceYaw[face], 2.4, { bg: '#f2f0ea', fg: '#9a1c1c' });
        blockRect(x0, z0, x1, z1); placeAt('Paul Badfella, the law firm', front(r, face)); break;
      }
      case 'tower':
        bld({ floors: ex.floors, style: 'glass' });
        { const p = onFace(r, face, 0, 3.2, 0.3); signBoard('BOURKE', p.x, p.y, p.z, faceYaw[face], 6, { bg: '#2a2e33', fg: '#e8e8e8' }); }
        placeAt('the Bourke Office High Rise', front(r, face)); break;
      case 'coffee': {
        withRoom({ floors: 3, style: 'brick', wallIndex: 0, shopFaces: [face], sign: 'COFFEE STORE', signColors: ['#2b1d12', '#f1dfa8'] }, 'cafe', { floor: 'wood', bigWindows: true, tint: 0xffd8a8 }, 13, 2, 18);
        // the detective's office upstairs: gold letters on the window
        const p = onFace(r, face, 0, 5.3, 0.14);
        { const pi = signBoard('PRIVATE INVESTIGATOR', p.x, p.y + 0.6, p.z + 0.02, faceYaw[face], 9, { bg: 'rgba(20,16,8,.55)', fg: '#f2d27a', font: 'bold 60px Georgia', glow: 0x6a5420 }); pi.material.transparent = true; }
        for (const k of [-1, 1]) { const tp = onFace(r, face, k * 4, 0, 2.6); const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 16), iron); tb.position.copy(tp).setY(0.88); add(tb); const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 6), iron); lg.position.copy(tp).setY(0.5); add(lg); }
        placeAt('the Coffee Store', front(r, face)); break;
      }
      case 'flowers': {
        bld({ floors: 2, style: 'stucco', wallIndex: 3, shopFaces: [face], sign: "GRACE'S FLOWERS", signColors: ['#f4ece4', '#9a3a5a'] });
        const fl = [0xd8344a, 0xf2c23a, 0xf0f0f0, 0xb04ad8, 0xff8a3a];
        for (let k = -3; k <= 3; k++) { const p = onFace(r, face, k * 1.1, 0, 1.4); const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.4, 12), std(0x5a6a72, 0.5, { metalness: 0.6 })); bucket.position.copy(p).setY(0.35); add(bucket); for (let j = 0; j < 5; j++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), std(fl[(k + 3 + j) % fl.length], 0.7)); b.position.copy(p).add(V((rand() - 0.5) * 0.3, 0.75 + rand() * 0.2, (rand() - 0.5) * 0.3)); scene.add(b); } }
        placeAt("Grace's Flowers", front(r, face)); break;
      }
      case 'police': {
        withRoom({ floors: 3, style: 'concrete', wallIndex: 1, entrance: face, entranceSign: 'POLICE' }, 'lobby', { variant: 'police', floor: 'tiles', tint: 0xeef4ff }, 14, 1, 20);
        const p = onFace(r, face, 0, 9.0, 0.25); signBoard('HALYARD POLICE', p.x, p.y, p.z, faceYaw[face], 10, { bg: '#1c3a7a', fg: '#ffffff' });
        const roofY = 4.2 + 2 * 3.3 + 0.6, fp = onFace(r, face, aw / 2 - 4, 0, -3); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6, 8), std(0xd8dade, 0.3, { metalness: 0.9 })); pole.position.copy(fp).setY(roofY + 3); add(pole); // (on the roof)
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), std(0x1c3a7a, 0.8, { side: THREE.DoubleSide })); flag.position.copy(fp).add(V(0.9, roofY + 5.2, 0)); scene.add(flag);
        for (let k = 0; k < 3; k++) { const cp = onFace(r, face, -aw / 2 + 4 + k * 3.2, 0, 7.5); parked.push([cp.x, cp.z, faceYaw[face], 0x1a1c20, 'police']); }
        placeAt('the Police Station', front(r, face)); break;
      }
      case 'pool':
        withRoom({ floors: 3, style: 'glass' }, 'pool', { floor: 'tiles', tint: 0xe8f6ff, power: 24 }, 24, 2, 32);
        { const p = onFace(r, face, 0, 4.6, 0.3); signBoard('INDOOR POOL', p.x, p.y, p.z, faceYaw[face], 9, { bg: '#e8f2f6', fg: '#1f6a9a' }); }
        placeAt('the Indoor Pool', front(r, face)); break;
      case 'info': { // a little visitor kiosk in a plaza
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ ...texPair(256, drawPave, [w / 1.6, d / 1.6]), roughness: 0.9 })); pl.rotation.x = -Math.PI / 2; pl.position.set(cx, 0.02, cz); pl.receiveShadow = true; scene.add(pl);
        box(8, 3.4, 6, cx, 1.7, cz, std(0xe8e2d4, 0.8));
        box(8.8, 0.3, 6.8, cx, 3.55, cz, std(0x2e6a5a, 0.6), { collide: false });
        const p = onFace([cx - 4, cz - 3, cx + 4, cz + 3], face, 0, 2.5, 0.05); signBoard('i  VISITOR INFO', p.x, p.y, p.z, faceYaw[face], 5, { bg: '#2e6a5a', fg: '#ffffff' });
        const mp = onFace([cx - 4, cz - 3, cx + 4, cz + 3], face, 0, 1.4, 3.5); const board = signBoard('HALYARD  ·  YOU ARE HERE', mp.x, mp.y, mp.z, faceYaw[face], 2.6, { bg: '#f2f0ea', fg: '#2e6a5a' });
        blockRect(x0, z0, x1, z1); placeAt('Visitor Info', front(r, face)); break;
      }
      case 'square': { // Town Square: a paved plaza with trees, benches, lamps and a statue
        const stoneT = texPair(256, (c, w2, h2, bump) => { c.fillStyle = bump ? '#888' : '#c9c2b4'; c.fillRect(0, 0, w2, h2); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = Math.random() * 20; c.fillStyle = bump ? `rgb(${180 + v},${180 + v},${180 + v})` : `rgb(${190 + v},${183 + v},${170 + v})`; c.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); } }, [w / 4, d / 4]);
        const sq = new THREE.Mesh(new THREE.BoxGeometry(w, KERB, d), new THREE.MeshStandardMaterial({ ...stoneT, bumpScale: 0.8, roughness: 0.85 })); sq.position.set(cx, KERB / 2, cz); add(sq, false); col(w / 2, KERB / 2, d / 2, cx, KERB / 2, cz);
        // the statue: a figure on a plinth
        box(3, 1.6, 3, cx, KERB + 0.8, cz, stone);
        const bronze = std(0x6a5a3a, 0.35, { metalness: 0.8 });
        const fig = new THREE.Group(); fig.position.set(cx, KERB + 1.6, cz); scene.add(fig);
        const part = (geo, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, bronze); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; fig.add(m); };
        part(new THREE.CapsuleGeometry(0.32, 0.9, 4, 10), 0, 1.65, 0); part(new THREE.SphereGeometry(0.24, 14, 12), 0, 2.55, 0);
        for (const s of [-1, 1]) { part(new THREE.CapsuleGeometry(0.13, 0.9, 4, 8), s * 0.18, 0.6, 0); part(new THREE.CapsuleGeometry(0.1, 0.75, 4, 8), s * 0.42, 1.75, 0, 0, s * 0.25); }
        part(new THREE.CapsuleGeometry(0.1, 0.8, 4, 8), 0.5, 2.6, 0.2, -0.3, -0.6); // (an arm raised: pointing at the horizon)
        { const pp = V(cx, KERB + 0.9, cz + 1.52); signBoard('HALYARD · FOUNDED 1891', pp.x, pp.y, pp.z, 0, 2.2, { bg: '#3a3226', fg: '#e8c46a', font: 'bold 44px Georgia' }); }
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, rr = Math.min(w, d) * 0.36; const tx = cx + Math.cos(a) * rr, tz = cz + Math.sin(a) * rr; box(3, 0.6, 3, tx, KERB + 0.3, tz, stone); tree(tx, tz, 1, KERB + 0.6); }
        for (const [bx, bz, ry] of [[cx - 8, cz, Math.PI / 2], [cx + 8, cz, -Math.PI / 2], [cx, cz - 8, 0], [cx, cz + 8, Math.PI], [cx - 18, cz - 12, Math.PI / 4], [cx + 18, cz + 12, -Math.PI * 0.75]]) bench(bx, bz, ry, KERB);
        for (const [lx, lz] of [[x0 + 2, z0 + 2], [x1 - 2, z0 + 2], [x0 + 2, z1 - 2], [x1 - 2, z1 - 2], [cx, z0 + 2], [cx, z1 - 2]]) lamp(lx, lz);
        blockRect(x0, z0, x1, z1); placeAt('Town Square', V(cx, 0, z1 + 1)); g.townSquare = V(cx, KERB, cz); g.squareRect = [x0, z0, x1, z1]; break;
      }
      case 'lot':
        lotPaint(x0, z0, x1, z1, d > w ? 'z' : 'x'); blockRect(x0, z0, x1, z1); placeAt(name === 'ABT Parking Lot' ? 'the ABT Parking Lot' : name === "Rusty's Parking" ? "Rusty's Parking" : 'the parking lot', V(cx, 0, cz));
        if (name === "Rusty's Parking") g.chopLot = { x0, z0, x1, z1, face }; // (the garage at the back is built later: chopshop.js)
        break;
      case 'diner': { // a long red diner with chrome, big windows, a neon sign; the rest of its lot is its car park
        const dw = Math.min(w - 4, 17), dl = Math.min(d * 0.45, 46), dz = z0 + d * 0.3;
        if (dz - dl / 2 - 2 - z0 > 8) lotPaint(x0, z0, x1, dz - dl / 2 - 2, 'z');
        lotPaint(x0, dz + dl / 2 + 2, x1, z1, 'z'); blockRect(x0, z0, x1, z1);
        const red = std(0xc4161c, 0.4, { metalness: 0.2 }), chrome = std(0xd8dade, 0.12, { metalness: 1 });
        { const room = { face: '-x', depth: dw, floors: 1, rect: [cx - dw / 2, dz - dl / 2, cx + dw / 2, dz + dl / 2], top: 4.2, wall: { m: red, scale: 3 } }; g.workers.push(...buildInterior(g, room, 'diner', { floor: 'checker', bigWindows: true, solidFloor: true, tint: 0xffe6c4, name: 'the Diner' }).workers); }
        for (const y of [0.6, 3.9]) { for (const sx of [-1, 1]) box(0.08, 0.18, dl + 0.2, cx + sx * (dw / 2 + 0.04), y, dz, chrome, { collide: false }); for (const sz of [-1, 1]) box(dw + 0.2, 0.18, 0.08, cx, y, dz + sz * (dl / 2 + 0.04), chrome, { collide: false }); } // (chrome bands round the outside)
        box(0.3, 4.2, dl, cx + dw / 2 - 0.15, 2.1, dz, red); // (the back wall; the front is the room's)
        const roof = new THREE.Mesh(new THREE.CylinderGeometry(dw / 2 + 0.3, dw / 2 + 0.3, dl, 24, 1, false, -Math.PI / 2, Math.PI), std(0xd8dade, 0.3, { metalness: 0.8 })); roof.rotation.x = Math.PI / 2; roof.scale.set(1, 1, 0.22); roof.position.set(cx, 4.2, dz); add(roof);
        const sg = signBoard('DINER', cx, 7.6, dz, Math.PI / 2, 9, { w: 512, h: 128, bg: '#1a0606', fg: '#ff2a2a', glow: 0xff2a2a, font: 'bold 110px "Arial Black", Arial' });
        const sg2 = sg.clone(); sg2.rotation.y = -Math.PI / 2; scene.add(sg2);
        box(0.3, 2.4, 0.3, cx, 5.4, dz, chrome, { collide: false });
        blockRect(cx - dw / 2 - 1, dz - dl / 2 - 1, cx + dw / 2 + 1, dz + dl / 2 + 1);
        placeAt('the Diner', V(cx - dw / 2 - 3, 0, dz)); break;
      }
      case 'home': { // Fairview Heights: your building at the front (by the south road), a bigger block behind
        g.homeAt = { x: cx - w * 0.2, zf: z1 - 0.5 };
        city.building({ x: cx + w * 0.22, z: (z0 + z1 - 17) / 2, w: w * 0.5, d: z1 - z0 - 19, floors: 7, style: 'brick', wallIndex: 0 });
        city.building({ x: cx - w * 0.2 - 0.5, z: z0 + (z1 - z0 - 18) / 2, w: 22, d: z1 - z0 - 20, floors: 6, style: 'brick', wallIndex: 1 });
        blockRect(x0, z0, x1, z1);
        placeAt('Fairview Heights', V(g.homeAt.x, 0, z1 + 3)); break;
      }
      case 'construction': construction(r); blockRect(x0, z0, x1, z1); placeAt('the construction site', front(r, face)); break;
      case 'abandoned': abandoned(r); blockRect(x0, z0, x1, z1); placeAt('the abandoned car park', front(r, face)); break;
      case 'turkey': {
        const fw = Math.min(w - 8, 24), fd = Math.min(d - 6, 14);
        { const room = { face, depth: Math.min(fd - 1, ((face === '+z' || face === '-z') ? fd : fw) - 1), floors: 1 }; city.building({ x: cx, z: cz, w: fw, d: fd, floors: 1, style: 'stucco', wallIndex: 7, shopFaces: [face], sign: 'ALBUQUERQUE BOILED TURKEY', signColors: ['#f2e2b0', '#9a2a1a'], room }); g.workers.push(...buildInterior(g, room, 'restaurant', { variant: 'turkey', bigWindows: true, name }).workers); }
        // the big roof sign, the drive-thru window and menu board (on the loop round it)
        const rs = signBoard('ABT', cx, 7.4, cz, faceYaw[face], 5, { w: 256, h: 128, bg: '#9a2a1a', fg: '#f2e2b0', font: 'bold 100px "Arial Black", Arial' });
        box(0.3, 3, 0.3, cx, 5.3, cz, iron, { collide: false });
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), std(0x2a3a44, 0.1, { metalness: 0.6, emissive: 0x8a6a3a, emissiveIntensity: 0.4 })); win.position.set(cx - fw / 2 - 0.02, 1.5, cz); win.rotation.y = -Math.PI / 2; scene.add(win);
        signBoard('DRIVE THRU ▸', cx - fw / 2 - 0.03, 2.6, cz, -Math.PI / 2, 2.2, { bg: '#9a2a1a', fg: '#ffffff' });
        const mb = signBoard('TURKEY · TURKEY BURGER · GRAVY FRIES', cx - fw / 2 - 3, 1.6, cz + fd / 2 + 2, -Math.PI / 2, 2.4, { bg: '#1a1a1a', fg: '#f2c23a' });
        box(0.15, 1.2, 0.15, cx - fw / 2 - 3, 0.6, cz + fd / 2 + 2, iron);
        blockRect(x0, z0, x1, z1);
        placeAt('Albuquerque Boiled Turkey', front([cx - fw / 2, cz - fd / 2, cx + fw / 2, cz + fd / 2], face)); break;
      }
      case 'hedge': {
        const bushM = std(0x4f7a33, 0.95, { flatShading: true });
        for (let x = x0 + 1; x < x1; x += 1.6) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 + rand() * 0.3, 1), bushM); b.position.set(x, 0.75, cz + (rand() - 0.5) * 0.6); b.scale.y = 0.75; add(b); }
        col((x1 - x0) / 2, 0.8, 1, cx, 0.8, cz); footprints.push(close([[x0, cz - 1], [x1, cz - 1], [x1, cz + 1], [x0, cz + 1]])); break;
      }
      case 'beachblock':
        bld({ floors: 1, style: 'concrete', wallIndex: 1, shopFaces: [face], sign: ex.sign, signColors: ['#1f6a9a', '#ffffff'] });
        placeAt(name === 'Reception' ? 'Beach Reception' : 'the beach washrooms', front(r, face)); break;
      case 'sewer': { // a big concrete culvert in the inlet's bank, half under water (swim in)
        const pipeM = std(0x7a776f, 0.95), darkM = std(0x0a0a0a, 1);
        const at = V(cx, WATER - 0.75, cz), ry = Math.atan2(-410.9, 435.6) + Math.PI; // (facing out across the inlet; mostly under water)
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.35, 12, 32), pipeM); ring.position.copy(at); ring.rotation.y = ry + Math.PI / 2; add(ring);
        const hole = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), darkM); hole.position.copy(at); hole.rotation.y = ry + Math.PI / 2; scene.add(hole);
        g.sewerMouth = at.clone(); blockRect(cx - 12, cz - 12, cx + 12, cz + 12);
        placeAt('the sewer entrance', at.clone().setY(0)); break;
      }
    }
  }

  // ================= the pier: a timber boardwalk along the east coast =================
  {
    const [b0, b1, t1, t0] = PIER.map(P);
    const A = [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2], B = [(t0[0] + t1[0]) / 2, (t0[1] + t1[1]) / 2];
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L, ry = Math.atan2(ux, uz), PW = 16;
    const cx = (A[0] + B[0]) / 2, cz = (A[1] + B[1]) / 2;
    const plankT = texPair(256, (c, w, h, bump) => { for (let x = 0; x < w; x += 32) { const v = Math.random() * 30; c.fillStyle = bump ? `rgb(${200 + v / 2},${200 + v / 2},${200 + v / 2})` : `rgb(${120 + v},${88 + v * 0.7},${56 + v * 0.4})`; c.fillRect(x, 0, 32, h); c.fillStyle = bump ? '#222' : 'rgba(30,18,8,.6)'; c.fillRect(x, 0, 2, h); } if (!bump) for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(40,25,10,${Math.random() * 0.12})`; c.fillRect(Math.random() * w, Math.random() * h, 1, 6); } }, [PW / 4, L / 4]);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.35, L), new THREE.MeshStandardMaterial({ ...plankT, bumpScale: 1.2, roughness: 0.85 })); deck.position.set(cx, -0.05, cz); deck.rotation.y = ry; add(deck);
    col(PW / 2, 0.175, L / 2, cx, -0.05, cz, ry);
    const nx = -uz, nz = ux;
    const pile = new THREE.CylinderGeometry(0.25, 0.25, 8, 8), pileM = std(0x4a3a2a, 1);
    const im = new THREE.InstancedMesh(pile, pileM, Math.ceil(L / 6) * 2 + 2); let k = 0; const mtx = new THREE.Matrix4();
    for (let t = 0; t < L; t += 6) for (const s of [-1, 1]) { mtx.makeTranslation(A[0] + ux * t + nx * s * (PW / 2 - 0.5), -4.2, A[1] + uz * t + nz * s * (PW / 2 - 0.5)); im.setMatrixAt(k++, mtx); }
    im.count = k; scene.add(im);
    const railM = std(0xe8e2d4, 0.7);
    for (const s of [-1, 1]) { const rx = cx + nx * s * (PW / 2 - 0.1), rz = cz + nz * s * (PW / 2 - 0.1); const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, L), railM); rail.position.set(rx, 0.65, rz); rail.rotation.y = ry; add(rail); if (s > 0) col(0.06, 0.5, L / 2, rx, 0.65, rz, ry); }
    for (let t = 15; t < L; t += 30) { const s = (Math.floor(t / 30) % 2) ? 1 : -1; lamp(A[0] + ux * t + nx * s * (PW / 2 - 0.8), A[1] + uz * t + nz * s * (PW / 2 - 0.8), 0.12); bench(A[0] + ux * (t + 8) + nx * s * (PW / 2 - 1.2), A[1] + uz * (t + 8) + nz * s * (PW / 2 - 1.2), ry + (s > 0 ? -Math.PI / 2 : Math.PI / 2), 0.12); }
    places.pier = { name: 'the Pier', pos: V(A[0] + ux * 40, 0, A[1] + uz * 40) };
  }

  // ================= Palm Tree Beach: palms, umbrellas, towels, a lifeguard tower =================
  {
    const palmTrunk = std(0x8a6a48, 1), frondM = std(0x4a8a3a, 0.9, { side: THREE.DoubleSide });
    const palm = (x, z, h) => {
      let px = x, pz = z, py = 0; const lean = rand() * 6.28, lx = Math.cos(lean), lz = Math.sin(lean);
      for (let i = 0; i < 6; i++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.17 - i * 0.012, 0.2 - i * 0.012, h / 6, 8), palmTrunk); const bend = (i / 6) ** 2 * 0.6; seg.position.set(px, py + h / 12, pz); seg.rotation.set(lz * bend, 0, -lx * bend); add(seg); px += lx * bend * h / 6 * 0.5; pz += lz * bend * h / 6 * 0.5; py += h / 6; }
      for (let i = 0; i < 8; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3.4), frondM); const a = (i / 8) * Math.PI * 2; f.position.set(px + Math.cos(a) * 1.4, py - 0.3, pz + Math.sin(a) * 1.4); f.rotation.set(0, -a + Math.PI / 2, 0); f.rotateX(1.1); add(f); }
      world.createCollider(R.ColliderDesc.cylinder(h / 2, 0.22).setTranslation(x, h / 2, z));
    };
    for (let i = 0; i < 26; i++) { const a = 0.08 + (i / 25) * 0.84, e = SAND; const t = 0.35 + rand() * 0.4; const x = toX(e.cx + e.rx * Math.cos(Math.PI * a) * (1 - t * 0.02)), z = toZ(LAND_BULGE.cy + (LAND_BULGE.ry + (SAND.cy + SAND.ry - LAND_BULGE.cy - LAND_BULGE.ry) * t) * Math.sin(Math.PI * a)); palm(x, z, 6 + rand() * 3); }
    const umbC = [0xd8344a, 0x2e6ac8, 0xf2c23a, 0x3aa86a, 0xf0f0f0];
    for (let i = 0; i < 12; i++) { const a = 0.15 + rand() * 0.7, t = 0.45 + rand() * 0.3; const x = toX(SAND.cx + SAND.rx * Math.cos(Math.PI * a) * 0.97), z = toZ(LAND_BULGE.cy + (LAND_BULGE.ry + 10 * t) * Math.sin(Math.PI * a)); const y = -0.1; const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), std(0xe8e8e8, 0.5)); pole.position.set(x, y + 1.1, z); add(pole); const top = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.5, 12, 1, true), std(umbC[i % 5], 0.8, { side: THREE.DoubleSide })); top.position.set(x, y + 2.2, z); add(top); const towel = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.8), std(umbC[(i + 2) % 5], 0.9)); towel.rotation.x = -Math.PI / 2; towel.rotation.z = rand(); towel.position.set(x + 1, y + 0.05, z + 0.8); scene.add(towel); }
    { const x = toX(SAND.cx), z = toZ(SAND.cy + SAND.ry * 0.55); const tw = std(0xe8e2d4, 0.8); for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) box(0.12, 2.6, 0.12, x + dx, 1.1, z + dz, tw, { collide: false }); box(2.2, 0.15, 2.2, x, 2.45, z, tw); box(2.4, 1.2, 0.08, x, 3.1, z - 1.1, std(0xd8344a, 0.7), { collide: false }); places.beach = { name: 'Palm Tree Beach', pos: V(x, 0, z - 4) }; }
  }

  // ================= infill: pack every gap with buildings =================
  {
    const segDist = (x, z) => { let best = Infinity; for (const s of segs) { const dx = x - s.a[0], dz = z - s.a[1]; let t = dx * s.u[0] + dz * s.u[1]; t = Math.max(0, Math.min(s.L, t)); const px = s.a[0] + s.u[0] * t - x, pz = s.a[1] + s.u[1] * t - z; best = Math.min(best, Math.hypot(px, pz)); } return best; };
    const need = RW / 2 + SW + 0.4, pierRing = (() => { const [b0, b1, t1, t0] = PIER.map(P); return close([b0, b1, t1, t0]); })();
    // a rough grid of which points are free (2 m cells), so trying a rectangle is quick
    const minX = -440, maxX = 560, minZ = -440, maxZ = 240, C = 2, NX = (maxX - minX) / C, NZ = (maxZ - minZ) / C;
    const free = new Uint8Array(NX * NZ), near = new Float32Array(NX * NZ);
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const x = minX + (i + 0.5) * C, z = minZ + (j + 0.5) * C;
      if (!inLand(x, z) || !inLand(x + 6, z) || !inLand(x - 6, z) || !inLand(x, z + 6) || !inLand(x, z - 6)) continue;
      if (built(x, z) || inRing(x, z, pierRing)) continue;
      const d = segDist(x, z); near[i * NZ + j] = d;
      if (d < need) continue;
      if (z > toZ(578) && x > toX(140) && x < toX(660)) continue; // (keep the beach front open)
      free[i * NZ + j] = 1;
    }
    const cell = (x, z) => [Math.floor((x - minX) / C), Math.floor((z - minZ) / C)];
    const fits = (x0, z0, x1, z1) => { const [i0, j0] = cell(x0, z0), [i1, j1] = cell(x1, z1); if (i0 < 0 || j0 < 0 || i1 >= NX || j1 >= NZ) return false; for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (!free[i * NZ + j]) return false; return true; };
    const take = (x0, z0, x1, z1, gap) => { const [i0, j0] = cell(x0 - gap, z0 - gap), [i1, j1] = cell(x1 + gap, z1 + gap); for (let i = Math.max(0, i0); i <= Math.min(NX - 1, i1); i++) for (let j = Math.max(0, j0); j <= Math.min(NZ - 1, j1); j++) free[i * NZ + j] = 0; };
    const centre = V(toX(430), 0, toZ(440));
    const SHOPS2 = ['CORNER DELI', 'PHARMACY', 'LAUNDROMAT', 'BOOKS', 'NOODLE BAR', 'HARDWARE', 'BAKERY', 'BARBER', 'LIQUOR', 'PIZZA', 'TATTOO', 'GROCER', 'KEBABS', 'NAILS', 'PHONES', 'DRY CLEANING', 'BUTCHER', 'SUSHI', 'THRIFT', 'BANK', 'OPTICIAN', 'BETTING', 'PAWN', 'TACOS', 'FURNITURE', 'RECORDS', 'VAPE', 'DENTIST', 'GYM', 'BAR', 'DUMPLINGS', 'CAMERAS', 'TAILOR', 'FISH & CHIPS', 'HAIR', 'VIDEO', 'TOYS', 'GUNSMITH', 'BIKES', 'PETS'];
    let count = 0;
    const sizes = [[30, 24], [26, 20], [22, 22], [20, 16], [16, 18], [14, 14], [12, 12], [10, 10]];
    for (let pass = 0; pass < sizes.length; pass++) {
      const [bw, bd] = sizes[pass];
      for (let i = 0; i < NX; i += 2) for (let j = 0; j < NZ; j += 2) {
        if (!free[i * NZ + j]) continue;
        const x0 = minX + i * C, z0 = minZ + j * C;
        for (const [w, d] of [[bw, bd], [bd, bw]]) {
          let a0 = x0, b0 = z0;
          if (!fits(a0, b0, a0 + w, b0 + d)) continue;
          // slide toward the nearest road, so the buildings line the street
          const cx0 = a0 + w / 2, cz0 = b0 + d / 2;
          let best = null; for (const s of segs) { if (!s.axis) continue; const dist = s.axis === 'x' ? Math.abs(s.a[1] - cz0) : Math.abs(s.a[0] - cx0); const lo = Math.min(s.axis === 'x' ? s.a[0] : s.a[1], s.axis === 'x' ? s.b[0] : s.b[1]), hi = Math.max(s.axis === 'x' ? s.a[0] : s.a[1], s.axis === 'x' ? s.b[0] : s.b[1]), along = s.axis === 'x' ? cx0 : cz0; if (along < lo || along > hi) continue; if (!best || dist < best.dist) best = { s, dist }; }
          let face = null;
          if (best && best.dist < 40) {
            const s = best.s, dx = s.axis === 'z' ? Math.sign(s.a[0] - cx0) : 0, dz = s.axis === 'x' ? Math.sign(s.a[1] - cz0) : 0;
            for (let k = 0; k < 20 && fits(a0 + dx * 2, b0 + dz * 2, a0 + w + dx * 2, b0 + d + dz * 2); k++) { a0 += dx * 2; b0 += dz * 2; }
            face = dx > 0 ? '+x' : dx < 0 ? '-x' : dz > 0 ? '+z' : '-z';
            if (best.dist - (dx ? w : d) / 2 > 14) face = null;
          }
          const cx = a0 + w / 2, cz = b0 + d / 2, dc = Math.hypot(cx - centre.x, cz - centre.z);
          const floors = Math.max(2, Math.round((dc < 150 ? 5 : dc < 260 ? 4 : 3) + (rand() - 0.4) * 4));
          city.infill({ x: cx, z: cz, w: w - 0.6, d: d - 0.6, floors, face, shop: face && rand() < 0.75 ? SHOPS2[Math.floor(rand() * SHOPS2.length)] : null });
          take(a0, b0, a0 + w, b0 + d, 2.2); // (an alley's width to the next one)
          footprints.push(close([[a0, b0], [a0 + w, b0], [a0 + w, b0 + d], [a0, b0 + d]]));
          count++;
          break;
        }
      }
    }
    g.infillCount = count;
  }

  // ================= street lamps and the odd street tree =================
  for (const s of segs) {
    if (s.L < 25) continue;
    for (let t = 12; t < s.L - 8; t += 32) {
      if (s.cross.some(c => Math.abs(c - t) < RW)) continue;
      for (const sd of [-1, 1]) {
        const off = RW / 2 + SW - 0.5, x = s.a[0] + s.u[0] * t + s.n[0] * sd * off, z = s.a[1] + s.u[1] * t + s.n[1] * sd * off;
        if (!inLand(x, z) || built(x, z) || inRoad(x, z)) continue;
        if (((t / 32) | 0) % 2 === (sd > 0 ? 0 : 1)) lamp(x, z); else if (rand() < 0.5) { const tx = x - s.u[0] * 6, tz = z - s.u[1] * 6; if (inLand(tx, tz) && !built(tx, tz) && !inRoad(tx, tz)) tree(tx, tz, 0.75, KERB); }
      }
    }
  }

  // ================= cars parked along the kerbs =================
  const kerbside = [];
  for (const s of segs) {
    if (!s.axis || s.L < 30) continue;
    for (const sd of [-1, 1]) for (let t = 14, last = -99; t < s.L - 14; t += 6.5) {
      if (rand() > 0.32 || t - last < 9 || s.cross.some(c => Math.abs(c - t) < RW / 2 + 9)) continue; // (room to pull out)
      last = t;
      const off = RW / 2 - 1.25, x = s.a[0] + s.u[0] * t + s.n[0] * sd * off, z = s.a[1] + s.u[1] * t + s.n[1] * sd * off;
      if (!inLand(x, z) || !inLand(x + s.n[0] * sd * 3, z + s.n[1] * sd * 3)) continue;
      kerbside.push([x, z, Math.atan2(s.u[0] * -sd, s.u[1] * -sd)]);
    }
  }

  // ================= what everyone else needs =================
  g.places = places;
  // a point on a sidewalk (for people to walk to), optionally near somewhere
  const sidewalkPoint = (near = null, radius = 60) => {
    // (only roads that actually pass within reach: otherwise most tries miss and people pile up on the hub itself)
    const segD = (s) => { const dx = near.x - s.a[0], dz = near.z - s.a[1], t = Math.max(0, Math.min(s.L, dx * s.u[0] + dz * s.u[1])); return Math.hypot(dx - s.u[0] * t, dz - s.u[1] * t); };
    const pool = near ? segs.filter(s => segD(s) < radius) : segs;
    if (!pool.length) return near.clone();
    for (let i = 0; i < 60; i++) {
      const s = pool[Math.floor(Math.random() * pool.length)];
      const t = Math.random() * s.L, sd = Math.random() < 0.5 ? -1 : 1, off = RW / 2 + SW * (0.3 + Math.random() * 0.4);
      const x = s.a[0] + s.u[0] * t + s.n[0] * sd * off, z = s.a[1] + s.u[1] * t + s.n[1] * sd * off;
      if (near && Math.hypot(x - near.x, z - near.z) > radius) continue;
      if (!inLand(x, z) || built(x, z) || inRoad(x, z)) continue;
      return V(x, KERB, z);
    }
    return near ? near.clone() : V(toX(430), KERB, toZ(472));
  };
  // the desert, north over the causeway
  const desert = g.desert = buildDesert(g, segs);
  return { places, segs, graphSegs: segs.concat(desert.segs), desert, inLand: (x, z) => inLand(x, z) || desert.inLand(x, z), inRoad: (x, z) => inRoad(x, z) || desert.inRoad(x, z), built, sidewalkPoint, parked, kerbside, landMP, footprints };

  // ---------- the two car parks
  function deckLevels(r, levels, { broken = false } = {}) {
    const [x0, z0, x1, z1] = r;
    const W = Math.min(x1 - x0 - 6, 70), D = Math.min(z1 - z0 - 6, 44), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, H = 3.4;
    const conc = std(broken ? 0x8a867c : 0xb4b0a6, 0.95), slabM = std(broken ? 0x76726a : 0xa29e94, 0.95);
    const RL = 22, RWd = 6; // ramps: along the west side, alternating direction
    for (let l = 1; l <= levels; l++) {
      const y = l * H;
      // the slab, with a hole where the ramp comes up
      const rx0 = x0 + (x1 - x0 - W) / 2, rz0 = cz - D / 2;
      const holeZ0 = (l % 2) ? rz0 + 2 : rz0 + D - 2 - RL;
      for (const [a, b] of [[rz0, holeZ0], [holeZ0 + RL, rz0 + D]]) if (b - a > 0.5) box(RWd, 0.3, b - a, rx0 + RWd / 2, y - 0.15, (a + b) / 2, slabM);
      box(W - RWd, 0.3, D, rx0 + RWd + (W - RWd) / 2, y - 0.15, cz, slabM);
      if (broken && l === levels) for (let i = 0; i < 3; i++) box(3 + rand() * 4, 0.3, 3 + rand() * 4, rx0 + RWd + rand() * (W - RWd - 6), y + 0.1, rz0 + rand() * (D - 4), slabM, { collide: true });
      // the ramp up to this level
      const ang = Math.atan2(H, RL), len = Math.hypot(H, RL), mz = holeZ0 + RL / 2;
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(RWd - 0.2, 0.3, len), slabM); ramp.position.set(rx0 + RWd / 2, y - H / 2 - 0.15, mz); ramp.rotation.x = (l % 2) ? -ang : ang; add(ramp);
      col((RWd - 0.2) / 2, 0.15, len / 2, rx0 + RWd / 2, y - H / 2 - 0.15, mz, 0, (l % 2) ? -ang : ang);
      // columns, and low parapets (some missing if it's derelict)
      for (let x = rx0; x <= rx0 + W + 0.1; x += 8) for (let z = rz0; z <= rz0 + D + 0.1; z += 8) { if (x < rx0 + RWd + 0.5 && z > holeZ0 - 0.5 && z < holeZ0 + RL + 0.5) continue; box(0.5, H - 0.3, 0.5, x, y - H / 2 - 0.15, z, conc); }
      for (const [a, b, c2, e] of [[rx0, rz0, rx0 + W, rz0], [rx0, rz0 + D, rx0 + W, rz0 + D], [rx0 + W, rz0, rx0 + W, rz0 + D]]) {
        if (broken && rand() < 0.4) continue;
        const len2 = Math.hypot(c2 - a, e - b), ax = b === e;
        box(ax ? len2 : 0.25, 1.0, ax ? 0.25 : len2, (a + c2) / 2, y + 0.5, (b + e) / 2, conc);
      }
    }
    footprints.push(close([[x0 + (x1 - x0 - W) / 2, cz - D / 2], [x0 + (x1 - x0 - W) / 2 + W, cz - D / 2], [x0 + (x1 - x0 - W) / 2 + W, cz + D / 2], [x0 + (x1 - x0 - W) / 2, cz + D / 2]]));
    return { W, D, cx, cz, H, rx0: x0 + (x1 - x0 - W) / 2, rz0: cz - D / 2 };
  }
  function construction(r) {
    const [x0, z0, x1, z1] = r;
    const k = deckLevels(r, 4);
    // site hoarding round the lot (with a gap for the gate)
    const hoard = std(0x2e5a3a, 0.8);
    for (const [a, b, c2, e] of [[x0, z0, x1, z0], [x0, z1, x1, z1], [x1, z0, x1, z1]]) { const len = Math.hypot(c2 - a, e - b), ax = b === e; box(ax ? len : 0.1, 2.2, ax ? 0.1 : len, (a + c2) / 2, 1.1, (b + e) / 2, hoard); }
    box(0.1, 2.2, (z1 - z0) / 2 - 5, x0, 1.1, z0 + ((z1 - z0) / 2 - 5) / 2, hoard); box(0.1, 2.2, (z1 - z0) / 2 - 5, x0, 1.1, z1 - ((z1 - z0) / 2 - 5) / 2, hoard);
    { const p = V((x0 + x1) / 2, 1.3, z1 + 0.07); signBoard('DANGER · CONSTRUCTION SITE · KEEP OUT', p.x, p.y, p.z, 0, 8, { bg: '#f2c23a', fg: '#1a1a1a' }); }
    // a crane
    const yel = std(0xe8b52a, 0.6), cX = k.rx0 + k.W + 6, cZ = k.cz;
    const mast = new THREE.Mesh(new THREE.BoxGeometry(1.6, 34, 1.6), yel); mast.position.set(cX, 17, cZ); add(mast); col(0.8, 17, 0.8, cX, 17, cZ);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 46), yel); jib.position.set(cX, 34, cZ - 12); add(jib);
    const cw = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2, 3), std(0x6a6a6a, 0.8)); cw.position.set(cX, 33, cZ + 9); add(cw);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), std(0xd8d6d0, 0.5)); cab.position.set(cX + 1.6, 32.5, cZ); add(cab);
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 18, 4), iron); hook.position.set(cX, 25, cZ - 30); scene.add(hook);
    // scaffolding up one face, piles of material
    const scaf = std(0x8a8d90, 0.4, { metalness: 0.7 });
    for (let x = k.rx0 + 8; x < k.rx0 + k.W; x += 3) for (let y = 0; y < 4; y++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 6), scaf); p.position.set(x, y * 3.4 + 1.7, k.rz0 + k.D + 1.2); scene.add(p); }
    for (let y = 1; y <= 4; y++) box(k.W - 8, 0.06, 1.2, k.rx0 + 4 + k.W / 2, y * 3.4 - 0.2, k.rz0 + k.D + 1.2, wood, { shadow: false });
    for (let i = 0; i < 6; i++) box(2.4, 0.5 + rand() * 0.6, 1.2, x0 + 6 + rand() * (x1 - x0 - 12), 0.4, z0 + 4 + rand() * 6, std([0x8a5a34, 0x9a9690, 0xb04a2a][i % 3], 0.9));
  }
  function abandoned(r) {
    const k = deckLevels(r, 3, { broken: true });
    // graffiti, rubble, a burnt-out car
    const tags = ['MERIDIAN', 'VIC LIES', 'HOLLOWS', 'NO FUTURE', 'C WAS HERE'];
    tags.forEach((t, i) => { const gt = canvasTex(256, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.font = 'bold 44px "Comic Sans MS", cursive'; c.fillStyle = ['#d8344a', '#3aa86a', '#f2c23a', '#2e6ac8', '#ff4fd8'][i]; c.textAlign = 'center'; c.fillText(t, w / 2, 46); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshStandardMaterial({ map: gt, transparent: true, roughness: 0.9 })); m.position.set(k.rx0 + 6 + i * 9, 1.3 + (i % 2) * 3.4, k.rz0 + k.D + 0.14); scene.add(m); });
    for (let i = 0; i < 14; i++) { const rb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + rand() * 0.5, 0), std(0x8a867c, 1, { flatShading: true })); rb.position.set(k.rx0 + rand() * k.W, 0.2, k.rz0 + rand() * k.D); add(rb); }
    const burnt = std(0x2a2522, 1);
    box(1.8, 0.9, 4.4, k.rx0 + k.W - 8, 0.75, k.cz, burnt); box(1.6, 0.6, 2.2, k.rx0 + k.W - 8, 1.45, k.cz - 0.3, burnt, { collide: false });
  }
}
