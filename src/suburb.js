// Willow Bank: the suburb on the island's west side, past the west block. Its streets join the city's (so
// traffic and people come through), and it's lined with family homes: lap siding, pitched shingle roofs,
// porches, shuttered windows, garages, driveways, mailboxes, hedges and back-yard fences (the same houses as
// Physick's Saltmarsh Key). One of them is Wren's: his mum's old place. Kit's van parks on its drive.
import * as THREE from 'three';
import { canvasTex, rng } from './world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// the land (world metres; it overlaps the island's west coast, and the two get merged)
export const SUBURB_RING = [[-372, -97], [-470, -130], [-600, -124], [-692, -84], [-714, 10], [-702, 112], [-644, 172], [-520, 182], [-420, 166], [-372, 134], [-372, -97]];
export const SUBURB_X = -380; // (everything west of here is Willow Bank: the city's own infill keeps out)
// the streets: [x0, z0, x1, z1]; they meet the west block road (x = −374.3) and the north avenue
const XW = -374.3;
export const SUBURB_ROADS = [
  [XW, -43.7, -650, -43.7],   // Willow Road (the north avenue, carried on west)
  [XW, 38.0, -650, 38.0],     // Larkspur Avenue
  [XW, 113.2, -570, 113.2],   // Bay Street
  [-470, -43.7, -470, 113.2], // Fern Street
  [-570, -43.7, -570, 113.2], // Hollis Street
  [-650, -43.7, -650, 38.0],  // the west end
];
// which lots: along each east–west street, each side, the blocks between the cross streets
const STREETS = [[-43.7, [[XW, -470], [-470, -570], [-570, -650]]], [38.0, [[XW, -470], [-470, -570], [-570, -650]]], [113.2, [[XW, -470], [-470, -570]]]];
const WREN_LOT = { z: 38.0, side: 1, x: -514 }; // (Larkspur Avenue, the south side)

const cache = new Map();
const once = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
const speckle = (c, w, h, n, a = 0.08) => { for (let i = 0; i < n; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * a})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };
function worldBox(w, h, d, tile = 4, tileY = tile) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i, side = f !== 2 && f !== 3; uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / (side ? tileY : tile)); }
  return g;
}

const SIDING = ['#f2efe8', '#d9dde0', '#a9b8c4', '#c9d3b8', '#efe2b8', '#d8c3a5', '#b9c6cf', '#e8d6cf', '#9fb0a0'];
const TRIM = 0xf7f5ef;
const SHUTTER = [0x2b3a2e, 0x1f2a3a, 0x3a2b2b, 0x2a2a2a, 0x4a5a6a];
const DOORS = [0x7a1f24, 0x1f3a5a, 0x2b4a30, 0x2a2a2a, 0xc9a24a, 0xe8e2d4];
const ROOFS = ['#3a3c40', '#4a3e36', '#2f3438', '#5a4a40'];
const sidingM = (hex) => once('sid' + hex, () => std({ map: canvasTex(64, 64, (c, w, h) => { c.fillStyle = hex; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) { c.fillStyle = 'rgba(0,0,0,.13)'; c.fillRect(0, y + 6, w, 2); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, y, w, 1); } speckle(c, w, h, 80, 0.03); }), side: THREE.DoubleSide }));
const brickM = () => once('brick', () => std({ map: canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#8d8478'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? -8 : 0; x < w; x += 16) { c.fillStyle = `rgb(${140 + Math.random() * 30},${70 + Math.random() * 20},${55 + Math.random() * 15})`; c.fillRect(x + 1, y + 1, 14, 6); } }), roughness: 0.95 }));
const roofM = (hex) => once('roof' + hex, () => std({ map: canvasTex(64, 64, (c, w, h) => { c.fillStyle = hex; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? -6 : 0; x < w; x += 12) { c.fillStyle = `rgba(0,0,0,${0.1 + Math.random() * 0.2})`; c.fillRect(x, y + 6, 12, 2); c.fillRect(x, y, 1, 8); } speckle(c, w, h, 200, 0.08); }), roughness: 0.95, side: THREE.DoubleSide }));
const plain = (hex, o = {}) => once('p' + hex + JSON.stringify(o), () => std({ color: hex, roughness: 0.7, ...o }));
const glassM = () => once('glass', () => std({ color: 0x3a4d5c, roughness: 0.15, metalness: 0.4, emissive: 0x1a2530, emissiveIntensity: 0.4 }));
const concreteM = () => once('conc', () => std({ map: canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#b9b5ad'; c.fillRect(0, 0, w, h); speckle(c, w, h, 300, 0.06); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 0, w, 1); }), roughness: 0.9 }));
const garageDoorM = () => once('gdoor', () => std({ map: canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#f1efea'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, y, w, 2); } for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) { c.strokeStyle = 'rgba(0,0,0,.1)'; c.strokeRect(x + 3, y + 4, 10, 9); } }), roughness: 0.6 }));
const fenceM = () => once('fence', () => std({ map: canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#9a7650'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, 0, 1, h); c.fillStyle = `rgba(255,220,180,${Math.random() * 0.1})`; c.fillRect(x + 1, 0, 7, h); } }), roughness: 0.9 }));
const hedgeM = () => once('hedge', () => std({ color: 0x3f6a32, roughness: 1, flatShading: true }));

function gableRoof(w, d, rise, o = 0.45) {
  const hw = w / 2 + o, hd = d / 2 + o;
  const v = [-hw, 0, -hd, hw, 0, -hd, hw, rise, 0, -hw, 0, -hd, hw, rise, 0, -hw, rise, 0, -hw, 0, hd, -hw, rise, 0, hw, rise, 0, -hw, 0, hd, hw, rise, 0, hw, 0, hd];
  const slope = Math.hypot(hd, rise), uv = [0, 0, w / 2, 0, w / 2, slope / 2, 0, 0, w / 2, slope / 2, 0, slope / 2, 0, 0, 0, slope / 2, w / 2, slope / 2, 0, 0, w / 2, slope / 2, w / 2, 0];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}
function gableEnds(w, d, rise) {
  const hw = w / 2, hd = d / 2, v = [-hw, 0, -hd, -hw, 0, hd, -hw, rise, 0, hw, 0, hd, hw, 0, -hd, hw, rise, 0], uv = [0, 0, d / 2, 0, d / 4, rise / 2, 0, 0, d / 2, 0, d / 4, rise / 2];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}

// one home on a lot: (x, z) the middle of the lot's street edge; yaw the way it faces (to the street)
function home(g, x, z, yaw, lotW, lotD, R, force = {}) {
  const { world, R: RA, scene } = g, pick = (a) => a[Math.floor(R() * a.length)];
  const root = new THREE.Group(); root.position.set(x, 0, z); root.rotation.y = yaw; scene.add(root);
  const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), W = (lx, ly, lz) => V(lx, ly, lz).applyQuaternion(q).add(root.position);
  const add = (geo, mat, lx, ly, lz, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(lx, ly, lz); m.castShadow = cast; m.receiveShadow = true; root.add(m); return m; };
  const collide = (w, h, d, lx, ly, lz) => { const p = W(lx, ly + h / 2, lz); world.createCollider(RA.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })); };
  const box = (w, h, d, lx, ly, lz, mat, { solid = false, cast = true, tile = 2 } = {}) => { const m = add(worldBox(w, h, d, tile, tile), mat, lx, ly + h / 2, lz, cast); if (solid) collide(w, h, d, lx, ly, lz); return m; };
  // local frame: +z to the street; the lot runs from z = 0 (the street edge) back to z = −lotD
  const floors = force.floors ?? (R() < 0.5 ? 2 : 1), storey = 2.9;
  const hw = floors === 2 ? 9 + R() * 2 : 11 + R() * 3, hd = 8 + R() * 2;
  const garage = force.garage ?? R() < 0.75, gw = garage ? 4.8 : 0, gSide = R() < 0.5 ? -1 : 1, total = hw + gw;
  const setback = 7.5 + R() * 2, hx = garage ? -gSide * gw / 2 : 0, hz = -setback - hd / 2, wallH = floors * storey;
  const sid = sidingM(force.siding || pick(SIDING)), roofMat = roofM(pick(ROOFS)), trim = plain(TRIM), shutter = plain(pick(SHUTTER));
  box(hw + 0.2, 0.45, hd + 0.2, hx, 0, hz, plain(0x8f8a82));
  box(hw, wallH, hd, hx, 0.45, hz, sid, { solid: true });
  if (R() < 0.25) box(hw + 0.04, 1.1, 0.06, hx, 0.45, hz + hd / 2 + 0.02, brickM(), { cast: false });
  for (const s of [-1, 1]) for (const t of [-1, 1]) box(0.16, wallH, 0.16, hx + s * hw / 2, 0.45, hz + t * hd / 2, trim, { cast: false });
  if (floors === 2) box(hw + 0.06, 0.14, hd + 0.06, hx, 0.45 + storey, hz, trim, { cast: false });
  const rise = (floors === 2 ? 0.45 : 0.5) * hd;
  add(gableRoof(hw, hd, rise), roofMat, hx, 0.45 + wallH, hz); add(gableEnds(hw, hd, rise), sid, hx, 0.45 + wallH, hz);
  box(hw + 0.9, 0.12, 0.2, hx, 0.45 + wallH - 0.12, hz + hd / 2 + 0.4, trim, { cast: false }); box(hw + 0.9, 0.12, 0.2, hx, 0.45 + wallH - 0.12, hz - hd / 2 - 0.4, trim, { cast: false });
  if (R() < 0.45) box(0.9, rise + 1.6, 0.9, hx + (R() < 0.5 ? -1 : 1) * (hw / 2 - 1.2), 0.45 + wallH, hz - hd / 4, brickM());
  // the front door and the porch
  const doorX = hx + (floors === 2 ? 0 : (R() - 0.5) * (hw - 4)), front = hz + hd / 2;
  box(1.1, 2.15, 0.08, doorX, 0.45, front + 0.03, plain(force.door ?? pick(DOORS)), { cast: false }); box(1.4, 2.4, 0.06, doorX, 0.45, front + 0.01, trim, { cast: false });
  const porchW = floors === 2 ? 3.6 : 2.6;
  box(porchW, 0.4, 2, doorX, 0, front + 1, plain(0xb9b5ad), { solid: true }); box(porchW - 0.6, 0.2, 0.4, doorX, 0, front + 2.2, plain(0xb9b5ad));
  if (floors === 2 || R() < 0.5) { for (const s of [-1, 1]) box(0.18, 2.6, 0.18, doorX + s * (porchW / 2 - 0.2), 0.4, front + 1.8, trim); box(porchW + 0.3, 0.15, 2.3, doorX, 3.0, front + 1.05, roofMat); }
  // windows: a frame, glass, mullions, shutters
  const win = (lx, ly, lz, ry) => {
    const gp = new THREE.Group(); gp.add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 0.08), trim), new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.1), glassM()), new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 0.12), trim), new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.12), trim));
    for (const s of [-1, 1]) { const sh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.5, 0.06), shutter); sh.position.x = s * 0.9; gp.add(sh); }
    gp.position.set(lx, ly, lz); gp.rotation.y = ry; root.add(gp);
  };
  for (let f = 0; f < floors; f++) {
    const y = 0.45 + f * storey + 1.55, n = Math.max(2, Math.floor((hw - 1) / 3));
    for (let i = 0; i < n; i++) { const wx = hx - hw / 2 + (hw / n) * (i + 0.5); if (f === 0 && Math.abs(wx - doorX) < 1.6) continue; win(wx, y, front + 0.05, 0); if (R() < 0.7) win(wx, y, hz - hd / 2 - 0.05, Math.PI); }
    for (const s of [-1, 1]) if (!(garage && s === gSide) || f === 1) win(hx + s * (hw / 2 + 0.05), y, hz + (R() - 0.5) * 2, s * Math.PI / 2);
  }
  // an attached garage, with its own lower roof
  let drive = doorX;
  if (garage) {
    const gx = hx + gSide * (hw / 2 + gw / 2), gd = 6.6, gz = front - gd / 2 + 0.6;
    box(gw, 3, gd, gx, 0.15, gz, sid, { solid: true });
    add(gableRoof(gw, gd, 1.6, 0.3).rotateY(Math.PI / 2), roofMat, gx, 3.15, gz); add(gableEnds(gw, gd, 1.6).rotateY(Math.PI / 2), sid, gx, 3.15, gz);
    box(gw - 1, 2.3, 0.08, gx, 0.15, gz + gd / 2 + 0.03, garageDoorM(), { cast: false }); box(gw - 0.6, 0.18, 0.12, gx, 2.45, gz + gd / 2 + 0.05, trim, { cast: false });
    drive = gx;
  }
  // the driveway and the front walk, out to the sidewalk
  const conc = concreteM(), dLen = garage ? setback - 0.6 : setback, dw = garage ? gw - 0.4 : 3;
  const dm = add(new THREE.PlaneGeometry(dw, dLen), conc, drive, 0.05, -dLen / 2, false); dm.rotation.x = -Math.PI / 2;
  if (garage) { const wl = setback - 2.2, wm = add(new THREE.PlaneGeometry(1.2, wl), conc, doorX, 0.055, front + 2.4 + wl / 2, false); wm.rotation.x = -Math.PI / 2; }
  // the mailbox, by the end of the drive
  const mx = drive + gSide * (dw / 2 + 0.6);
  box(0.1, 1, 0.1, mx, 0, -0.6, plain(0x3a3c40)); box(0.3, 0.25, 0.5, mx, 1, -0.6, plain(pick([0x2a2a2a, 0x1f3a5a, 0xe8e2d4]), { metalness: 0.5 }));
  // hedges along the front
  if (R() < 0.6) { const z2 = front + 0.7; for (const [a, b] of [[hx - hw / 2 + 0.6, doorX - porchW / 2 - 0.3], [doorX + porchW / 2 + 0.3, hx + hw / 2 - 0.6]]) if (b - a > 0.8) box(b - a, 0.9, 0.7, (a + b) / 2, 0, z2, hedgeM()); }
  // a tree in the front yard (on the far side from the drive)
  if (R() < 0.6) {
    const tx = -gSide * (lotW / 2 - 2.6), tz = -Math.max(3, setback * 0.5), th = 2.2 + R() * 1.2;
    box(0.32, th, 0.32, tx, 0, tz, plain(0x5a4030)); collide(0.4, th, 0.4, tx, 0, tz);
    const leaf = plain([0x3f6a32, 0x4a7a38, 0x355a2a][Math.floor(R() * 3)], { flatShading: true });
    for (let i = 0; i < 3; i++) add(new THREE.IcosahedronGeometry(1.5 + R() * 0.8, 0), leaf, tx + (R() - 0.5) * 1.4, th + 0.8 + i * 0.7, tz + (R() - 0.5) * 1.4);
  }
  // the back-yard fence
  const fm = fenceM(), back = -lotD + 0.3, fy = 1.8, lx0 = -lotW / 2 + 0.2, lx1 = lotW / 2 - 0.2, sideFrom = hz - hd / 2 + 1;
  box(lotW - 0.4, fy, 0.08, 0, 0, back, fm, { solid: true, tile: 1.8 });
  for (const lx of [lx0, lx1]) box(0.08, fy, sideFrom - back, lx, 0, (sideFrom + back) / 2, fm, { solid: true, tile: 1.8 });
  const eL = hx - hw / 2 - (garage && gSide < 0 ? gw : 0), eR = hx + hw / 2 + (garage && gSide > 0 ? gw : 0);
  if (eL - lx0 > 0.3) box(eL - lx0, fy, 0.08, (lx0 + eL) / 2, 0, sideFrom, fm, { solid: true, tile: 1.8 });
  if (lx1 - eR > 0.3) box(lx1 - eR, fy, 0.08, (lx1 + eR) / 2, 0, sideFrom, fm, { solid: true, tile: 1.8 });
  // the footprint (house and garage), for the map and so the street lamps keep off it
  const c = [W(eL, 0, front + 0.3), W(eR, 0, front + 0.3), W(eR, 0, hz - hd / 2), W(eL, 0, hz - hd / 2)];
  return {
    ring: [...c, c[0]].map(p => [p.x, p.z]),
    door: W(doorX, 0.05, front + 2.9), doorYaw: yaw, // (just off the porch steps, facing the street)
    drive: W(drive, 0.05, -dLen / 2 - 0.5), driveYaw: yaw + Math.PI, // (nose to the garage)
  };
}

export function buildSuburb(g, { inLand, blockRect, footprints, places, RW, SW }) {
  const R = rng(4242), edge = RW / 2 + SW, lotW = 20, lotD = 26;
  let wren = null, count = 0;
  for (const [zc, blocks] of STREETS) for (const side of [-1, 1]) for (const [xa, xb] of blocks) {
    // side −1: the north side of the street (houses face south, +z); side 1: the south side (they face north)
    for (let x = xa - 14 - lotW / 2; x - lotW / 2 > xb + 12; x -= lotW) {
      const z = zc + side * edge, yaw = side < 0 ? 0 : Math.PI, zb = z + side * lotD;
      if (![[x - lotW / 2, z], [x + lotW / 2, z], [x - lotW / 2, zb], [x + lotW / 2, zb]].every(([a, b]) => inLand(a, b) && inLand(a + side * 0, b + side * 6))) continue;
      const isWren = zc === WREN_LOT.z && side === WREN_LOT.side && Math.abs(x - WREN_LOT.x) < lotW / 2;
      const h = home(g, x, z, yaw, lotW, lotD, R, isWren ? { floors: 1, garage: true, siding: '#c9d3b8', door: 0x7a1f24 } : {});
      footprints.push(h.ring); count++;
      if (isWren) wren = h;
    }
  }
  places['willow bank'] = { name: 'Willow Bank', pos: V(-520, 0, 0) };
  if (wren) places["wren's house"] = { name: "Wren's house", pos: wren.door.clone() };
  // a sign where Willow Road leaves the west block
  { const t = canvasTex(256, 96, (c, w, h) => { c.fillStyle = '#2f5a3a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e8e2d4'; c.lineWidth = 5; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = '#f4efe2'; c.font = 'bold 34px Georgia'; c.textAlign = 'center'; c.fillText('WILLOW BANK', w / 2, 52); c.font = 'italic 17px Georgia'; c.fillText('a nice place to live', w / 2, 78); });
    const s = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 0.1), [plain(0x2f5a3a), plain(0x2f5a3a), plain(0x2f5a3a), plain(0x2f5a3a), std({ map: t }), plain(0x2f5a3a)]); s.position.set(-392, 2.2, -43.7 - edge + 1.2); s.rotation.y = Math.PI / 2; s.castShadow = true; g.scene.add(s);
    for (const dz of [-1.3, 1.3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), plain(0x6a6a6a)); p.position.set(-392, 1.1, -43.7 - edge + 1.2 + dz); g.scene.add(p); } }
  g.suburbHouses = count;
  return { wren };
}
