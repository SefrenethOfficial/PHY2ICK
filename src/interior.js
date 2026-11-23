// Interiors: a real room behind a building's front wall (a door, shop windows you can see through,
// walls, a floor and a ceiling), furnished by kind. Furniture is built in the room's own frame:
// x along the front wall, y up, z out of the door (so the room is at z < 0), then merged into the city.
import * as THREE from 'three';
import { canvasTex } from './world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const FACE_YAW = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 };

// floors
const floorTex = {
  tiles: () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#d9d4c8'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = `rgb(${215 + Math.random() * 15},${210 + Math.random() * 15},${200 + Math.random() * 12})`; c.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); } }),
  checker: () => canvasTex(256, 256, (c, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? '#1e1e22' : '#eeeae2'; c.fillRect(i * 32, j * 32, 32, 32); } }),
  wood: () => canvasTex(256, 256, (c, w, h) => { for (let x = 0; x < w; x += 32) { const t = 110 + Math.random() * 40; c.fillStyle = `rgb(${t + 40},${t},${t * 0.6})`; c.fillRect(x, 0, 32, h); c.fillStyle = 'rgba(30,18,8,.5)'; c.fillRect(x, 0, 2, h); for (let y = Math.random() * 120; y < h; y += 128) c.fillRect(x, y, 32, 2); } }),
  carpet: (col = '#5a2a2e') => canvasTex(128, 128, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }),
  marble: () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#ece8e0'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(120,110,100,.25)'; for (let i = 0; i < 14; i++) { c.beginPath(); let x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; c.lineTo(x, y); } c.stroke(); } c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, 0, w, 1); c.fillRect(0, 0, 1, h); }),
  dark: () => canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#16141a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 2000; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }),
};
// ---- what's on the shelves: painted rows of products (one canvas per kind, shared by every shop).
// A canvas is 2 m of shelf by 0.4 m high; products come in facings (the same thing three to six times over).
const PX = 320; // pixels per metre
const PAL = {
  food: ['#d8344a', '#f2c23a', '#3aa86a', '#2e6ac8', '#e8e2d4', '#d88a2a', '#8a4a2a', '#6a2a8a', '#1f8a8a', '#f07a2a'],
  drinks: ['#c8102e', '#f2d13a', '#3ac86a', '#7ac8f2', '#f28a1a', '#2b2b2b', '#e8e8e8', '#8a1ad8', '#1a5ad8'],
  frozen: ['#2e6ac8', '#e8f2ff', '#d8344a', '#f2c23a', '#6ad8f2', '#8a4a2a', '#f2a0c8'],
  games: ['#2e6ac8', '#d8344a', '#1a1a1a', '#3aa86a', '#f2f2f2', '#9a3ad8', '#2a8ac8', '#f2c23a'],
  tools: ['#d8b52a', '#5a5f66', '#c8402e', '#2e5a8a', '#8a8d90', '#f07a1a', '#2b8a3a', '#e8e2d4'],
  cheap: ['#ff6a1a', '#f2e23a', '#3ad8d8', '#ff4fd8', '#7bd83a', '#8a6aff', '#ff3a5a'],
  cigs: ['#f2f2f2', '#c8102e', '#1a3a8a', '#d8b44a', '#2b2b2b', '#3a8a5a'],
};
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };
function drawItem(c, type, x, w, h, col, H) { // one product, standing on the shelf (y = H at the bottom)
  const y = H - h;
  c.fillStyle = col;
  if (type === 'can') { c.fillRect(x, y + 3, w, h - 3); c.fillStyle = shade(col, 1.25); c.fillRect(x, y, w, 4); c.fillStyle = '#ffffffaa'; c.fillRect(x + 2, y + h * 0.35, w - 4, h * 0.22); c.fillStyle = '#00000033'; c.fillRect(x + w - 4, y + 3, 4, h - 3); }
  else if (type === 'bottle') { const nw = w * 0.36; c.fillRect(x + (w - nw) / 2, y, nw, h * 0.3); c.fillRect(x, y + h * 0.3, w, h * 0.7); c.beginPath(); c.moveTo(x, y + h * 0.32); c.lineTo(x + (w - nw) / 2, y + h * 0.18); c.lineTo(x + (w + nw) / 2, y + h * 0.18); c.lineTo(x + w, y + h * 0.32); c.fill(); c.fillStyle = '#ffffffcc'; c.fillRect(x + 1, y + h * 0.5, w - 2, h * 0.2); c.fillStyle = shade(col, 0.6); c.fillRect(x + (w - nw) / 2, y, nw, 4); c.fillStyle = '#ffffff44'; c.fillRect(x + 2, y + h * 0.34, 3, h * 0.6); }
  else if (type === 'case') { c.fillRect(x, y, w, h); c.fillStyle = '#ffffffdd'; c.fillRect(x, y, w, h * 0.12); c.fillStyle = shade(col, 1.4); c.fillRect(x + 3, y + h * 0.3, w - 6, h * 0.35); c.fillStyle = '#00000044'; c.fillRect(x + w - 2, y, 2, h); }
  else if (type === 'tin') { c.fillRect(x, y + 4, w, h - 4); c.fillStyle = '#c0c4c8'; c.fillRect(x, y, w, 5); c.fillStyle = '#ffffffcc'; c.fillRect(x + 3, y + h * 0.3, w - 6, h * 0.4); c.fillStyle = col; c.fillRect(x + w * 0.3, y + h * 0.38, w * 0.4, h * 0.22); }
  else if (type === 'pack') { c.fillRect(x, y, w, h); c.fillStyle = '#ffffff'; c.fillRect(x + 2, y + h * 0.15, w - 4, h * 0.25); c.fillStyle = shade(col, 0.7); c.fillRect(x, y + h * 0.75, w, h * 0.25); }
  else if (type === 'bag') { c.beginPath(); c.moveTo(x + 2, y + 6); c.lineTo(x + w - 2, y + 6); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.fill(); c.fillStyle = shade(col, 0.7); c.fillRect(x + 2, y, w - 4, 7); c.fillStyle = '#ffffffcc'; c.beginPath(); c.arc(x + w / 2, y + h * 0.5, w * 0.28, 0, 7); c.fill(); }
  else { // a box (cereal, a toy, a drill)
    c.fillRect(x, y, w, h); c.fillStyle = '#ffffffdd'; c.fillRect(x + 3, y + h * 0.12, w - 6, h * 0.16);
    c.fillStyle = shade(col, 1.5); c.beginPath(); c.arc(x + w / 2, y + h * 0.6, Math.min(w, h) * 0.22, 0, 7); c.fill(); c.fillStyle = '#00000038'; c.fillRect(x + w - 3, y, 3, h);
  }
}
const TYPES = { food: [['box', 0.07, 0.3, 0.22, 0.32], ['can', 0.075, 0.08, 0.11, 0.13], ['bottle', 0.08, 0.09, 0.24, 0.3], ['bag', 0.16, 0.2, 0.22, 0.28], ['pack', 0.09, 0.14, 0.12, 0.18], ['tin', 0.08, 0.1, 0.1, 0.13]],
  drinks: [['can', 0.066, 0.07, 0.12, 0.13], ['bottle', 0.07, 0.085, 0.24, 0.3], ['bottle', 0.09, 0.1, 0.3, 0.33]],
  frozen: [['box', 0.2, 0.26, 0.22, 0.3], ['tin', 0.12, 0.14, 0.12, 0.14], ['bag', 0.16, 0.2, 0.22, 0.28]],
  games: [['case', 0.13, 0.135, 0.19, 0.19], ['box', 0.3, 0.38, 0.26, 0.3], ['case', 0.13, 0.135, 0.19, 0.19]],
  tools: [['tin', 0.16, 0.2, 0.18, 0.22], ['box', 0.2, 0.32, 0.18, 0.3], ['pack', 0.08, 0.12, 0.2, 0.3], ['can', 0.07, 0.08, 0.2, 0.24]],
  cheap: [['bag', 0.12, 0.18, 0.15, 0.25], ['box', 0.1, 0.2, 0.12, 0.25], ['bottle', 0.07, 0.09, 0.2, 0.26], ['pack', 0.08, 0.14, 0.1, 0.18]],
  cigs: [['pack', 0.055, 0.055, 0.085, 0.085]] };
const shelfTexCache = {};
function shelfTex(kind, variant = 0) {
  const key = kind + variant; if (shelfTexCache[key]) return shelfTexCache[key];
  const W = 4 * PX, H = 0.4 * PX, pal = PAL[kind] || PAL.food, types = TYPES[kind] || TYPES.food;
  const t = canvasTex(W, H, (c) => {
    const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a2a2e'); gr.addColorStop(1, '#4a4a4e'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    if (kind === 'cigs') { for (let row = 0; row < 4; row++) { let x = 4; const base = H - row * 30 - 2; while (x < W - 20) { const col = pal[Math.floor(Math.random() * pal.length)], n = 2 + Math.floor(Math.random() * 3); for (let k = 0; k < n && x < W - 20; k++) { drawItem(c, 'pack', x, 17, 26, col, base); x += 19; } x += 3; } } return; }
    let x = 3;
    while (x < W - 10) {
      const [type, w0, w1, h0, h1] = types[Math.floor(Math.random() * types.length)], col = pal[Math.floor(Math.random() * pal.length)];
      const w = (w0 + Math.random() * (w1 - w0)) * PX, h = Math.min(H - 6, (h0 + Math.random() * (h1 - h0)) * PX), n = 2 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n && x + w < W - 3; k++) { drawItem(c, type, x, w, h, col, H - 2); x += w + 2; }
      x += 4 + Math.random() * 6;
    }
    c.fillStyle = '#00000055'; c.fillRect(0, 0, W, 6); // (the shelf above casts a shadow)
  });
  t.wrapS = THREE.RepeatWrapping;
  return (shelfTexCache[key] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.65 }));
}

const FLOOR_SCALE = { tiles: 2, checker: 4.8, wood: 2.5, carpet: 3, marble: 3, dark: 3 };

export function buildInterior(g, room, kind, opts = {}) {
  const { scene, world, R, city } = g;
  const [rx0, rz0, rx1, rz1] = room.rect, face = room.face, yaw = FACE_YAW[face];
  const along = face === '+z' || face === '-z';
  const W = along ? rx1 - rx0 : rz1 - rz0, D = room.depth, H = room.top;
  const front = { '+z': V((rx0 + rx1) / 2, 0, rz1), '-z': V((rx0 + rx1) / 2, 0, rz0), '+x': V(rx1, 0, (rz0 + rz1) / 2), '-x': V(rx0, 0, (rz0 + rz1) / 2) }[face];
  const grp = new THREE.Group(); grp.position.copy(front); grp.rotation.y = yaw; scene.add(grp); grp.updateMatrixWorld(true);
  const M = grp.matrixWorld;
  const toW = (x, y, z) => V(x, y, z).applyMatrix4(M);
  const col = (w, h, d, x, y, z, ry = 0) => { const p = toW(x, y, z), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw + ry, 0)); return world.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })); };
  // a mesh in the room (its own material)
  const mesh = (geo, mat, x, y, z, { ry = 0, rx = 0, shadow = true } = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.castShadow = shadow; m.receiveShadow = true; grp.add(m); return m; };
  // a plain coloured box, merged with everything else of its kind (cheap)
  const cbox = (w, h, d, x, y, z, color, { ry = 0, collide = false, rx = 0 } = {}) => {
    const geo = new THREE.BoxGeometry(w, h, d); if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry); geo.translate(x, y, z); geo.applyMatrix4(M); geo.deleteAttribute('uv');
    const c = new THREE.Color(color), n = geo.attributes.position.count, cl = new Float32Array(n * 3); for (let i = 0; i < n; i++) { cl[i * 3] = c.r; cl[i * 3 + 1] = c.g; cl[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); city.trim.push(geo);
    if (collide) col(w, h, d, x, y, z, ry);
  };
  const ccyl = (r, h, x, y, z, color, seg = 12) => { const geo = new THREE.CylinderGeometry(r, r, h, seg); geo.translate(x, y, z); geo.applyMatrix4(M); geo.deleteAttribute('uv'); const c = new THREE.Color(color), n = geo.attributes.position.count, cl = new Float32Array(n * 3); for (let i = 0; i < n; i++) { cl[i * 3] = c.r; cl[i * 3 + 1] = c.g; cl[i * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); city.trim.push(geo); };
  const glow = (w, h, x, y, z, color, intensity = 1.2, ry = 0) => mesh(new THREE.PlaneGeometry(w, h), std(color, 0.4, { emissive: color, emissiveIntensity: intensity }), x, y, z, { ry, shadow: false });
  const sign = (text, w, x, y, z, ry = 0, bg = '#1d2a38', fg = '#f1dfa8') => { const t = canvasTex(512, 96, (c) => { c.fillStyle = bg; c.fillRect(0, 0, 512, 96); c.fillStyle = fg; c.font = 'bold 52px "Arial Narrow", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; const fw = c.measureText(text).width; if (fw > 490) c.font = `bold ${Math.floor(52 * 490 / fw)}px "Arial Narrow", Arial`; c.fillText(text, 256, 50); }); return mesh(new THREE.PlaneGeometry(w, w * 96 / 512), std(0xffffff, 0.6, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 }), x, y, z, { ry, shadow: false }); };

  // ---- the shell: front wall with a door and windows, side walls, a lining, floor, ceiling
  const T = 0.25, outer = room.wall?.m || std(0x9a958c, 0.9), lining = std(opts.wallColor ?? 0xe8e2d6, 0.95);
  const doorU = opts.doorU ?? (kind === 'store' || kind === 'pawn' ? -W / 2 + 2.6 : 0);
  const holes = [{ a0: doorU - 1.0, a1: doorU + 1.0, y0: 0, y1: 2.7, door: true }];
  if (opts.windows !== false) {
    if (opts.bigWindows) { // shop windows either side of the door
      const segs = [[-W / 2 + 0.8, doorU - 1.6], [doorU + 1.6, W / 2 - 0.8]];
      for (const [a, b] of segs) if (b - a > 1.5) holes.push({ a0: a, a1: b, y0: 0.7, y1: Math.min(3.3, H - 0.6) });
    } else for (let u = -W / 2 + 2.5; u < W / 2 - 2; u += 4.2) if (Math.abs(u - doorU) > 2.6) holes.push({ a0: u - 0.9, a1: u + 0.9, y0: 1.0, y1: 2.9 });
  }
  const wallPieces = (x0, x1, y0, y1, hs) => { // solid pieces of a wall with holes (holes don't overlap in x)
    const out = []; let a = x0;
    for (const h of [...hs].sort((p, q) => p.a0 - q.a0)) { if (h.a0 > a) out.push([a, h.a0, y0, y1]); if (h.y0 > y0) out.push([h.a0, h.a1, y0, h.y0]); if (h.y1 < y1) out.push([h.a0, h.a1, h.y1, y1]); a = h.a1; }
    if (a < x1) out.push([a, x1, y0, y1]); return out;
  };
  const uvBox = (w, h, d, x, y, z, mat, scale = 3.3) => { const geo = new THREE.BoxGeometry(w, h, d); geo.translate(x, y, z); const p = geo.attributes.position, uv = geo.attributes.uv, n = geo.attributes.normal; for (let i = 0; i < p.count; i++) uv.setXY(i, (Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i)) / scale, p.getY(i) / scale); return mesh(geo, mat, 0, 0, 0); };
  for (const [a, b, y0, y1] of wallPieces(-W / 2, W / 2, 0, H, holes)) { uvBox(b - a, y1 - y0, T, (a + b) / 2, (y0 + y1) / 2, -T / 2, outer, room.wall?.scale || 3.3); col(b - a, y1 - y0, T, (a + b) / 2, (y0 + y1) / 2, -T / 2); }
  for (const [a, b, y0, y1] of wallPieces(-W / 2 + T, W / 2 - T, 0, H, holes)) mesh(new THREE.BoxGeometry(b - a, y1 - y0, 0.04), lining, (a + b) / 2, (y0 + y1) / 2, -T - 0.02, { shadow: false });
  for (const sx of [-1, 1]) { // side walls
    uvBox(T, H, D, sx * (W / 2 - T / 2), H / 2, -D / 2, outer, room.wall?.scale || 3.3); col(T, H, D, sx * (W / 2 - T / 2), H / 2, -D / 2);
    mesh(new THREE.BoxGeometry(0.04, H, D - T), lining, sx * (W / 2 - T - 0.02), H / 2, -D / 2 - T / 2, { shadow: false });
  }
  mesh(new THREE.BoxGeometry(W - 2 * T, H, 0.04), lining, 0, H / 2, -D + 0.03, { shadow: false }); // (the back: the solid part of the building is behind it)
  // glass in the windows (you can see in and out)
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0xa8bcc8, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
  for (const h of holes) if (!h.door) { mesh(new THREE.PlaneGeometry(h.a1 - h.a0, h.y1 - h.y0), glassM, (h.a0 + h.a1) / 2, (h.y0 + h.y1) / 2, -T / 2, { shadow: false }); col(h.a1 - h.a0, h.y1 - h.y0, 0.04, (h.a0 + h.a1) / 2, (h.y0 + h.y1) / 2, -T / 2); cbox(h.a1 - h.a0 + 0.1, 0.06, 0.4, (h.a0 + h.a1) / 2, h.y0 - 0.03, -T - 0.12, 0xe8e2d6); }
  // a door frame
  cbox(2.2, 0.12, T + 0.06, doorU, 2.76, -T / 2, 0x2b2b2b); for (const sx of [-1, 1]) cbox(0.1, 2.75, T + 0.06, doorU + sx * 1.05, 1.375, -T / 2, 0x2b2b2b);
  // floor and ceiling
  const fk = opts.floor || 'tiles', ft = floorTex[fk](opts.floorColor); ft.repeat.set(W / FLOOR_SCALE[fk], D / FLOOR_SCALE[fk]);
  const fl = mesh(new THREE.PlaneGeometry(W - 2 * T, D - T), std(0xffffff, fk === 'marble' || fk === 'checker' ? 0.5 : 0.75, { map: ft, envMapIntensity: 0.4 }), 0, 0.035, -D / 2 - T / 2, { rx: -Math.PI / 2, shadow: false });
  if (opts.solidFloor) col(W, 0.4, D, 0, -0.165, -D / 2); // (a free-standing room has no building slab under it)
  mesh(new THREE.PlaneGeometry(W - 2 * T, D - T), std(opts.ceiling ?? 0xf2efe8, 1), 0, H - 0.02, -D / 2 - T / 2, { rx: Math.PI / 2, shadow: false });
  // ceiling light panels (the light itself is the room light that follows you indoors)
  const lightPts = [];
  for (let z = -3; z > -D + 1; z -= 5) for (let x = -W / 2 + 3; x < W / 2 - 2; x += 6) { if (!opts.noPanels) glow(1.2, 0.6, x, H - 0.04, z, opts.panel ?? 0xfff2dc, 1.4).rotation.x = Math.PI / 2; }
  lightPts.push(toW(-W / 4, H - 0.5, -D * 0.35), toW(W / 4, H - 0.5, -D * 0.65));
  g.rooms = g.rooms || [];
  const roomRec = { kind, name: opts.name, ring: [toW(-W / 2, 0, 0), toW(W / 2, 0, 0), toW(W / 2, 0, -D), toW(-W / 2, 0, -D)].map(p => [p.x, p.z]), y0: -1, y1: H + 0.2, lights: lightPts, tint: opts.tint ?? 0xffe6c4, power: opts.power ?? 18, shelf: [], set: opts.products || 'food' }; // (shelf: where real things sit, to pick up)
  g.rooms.push(roomRec);
  const workers = []; // (shopkeepers: where they stand, and what they say)
  const worker = (x, z, ryLocal, lines, role, y = 0.04) => workers.push({ pos: toW(x, y, z), yaw: yaw + ryLocal, lines, role, shop: opts.name, kind, products: opts.products });

  // ---- furniture, by kind
  // a row of products, painted, facing out (ry: 0 faces +z)
  const facing = (len, x, y, z, ry, set, h = 0.4) => { const geo = new THREE.PlaneGeometry(len, h), uv = geo.attributes.uv, off = Math.random(); for (let k = 0; k < uv.count; k++) uv.setXY(k, off + uv.getX(k) * len / 4, uv.getY(k) * h / 0.4); return mesh(geo, shelfTex(set, Math.floor(Math.random() * 3)), x, y, z, { ry, shadow: false }); };
  // a gondola: shelves both sides of a central back panel, on a plinth, with end panels, price strips and products
  const aisleAccent = opts.accent ?? 0x2f6aa8;
  const gondola = (x0, x1, z, set, label) => {
    const len = x1 - x0, cx = (x0 + x1) / 2, h = 1.78;
    col(len, h, 0.1, cx, h / 2, z); col(len, 0.12, 0.94, cx, 0.06, z); // (the back panel and the plinth; each shelf has its own, below: things sit on them)
    cbox(len, 0.1, 0.94, cx, 0.05, z, 0x3a3d40);
    cbox(len, h - 0.1, 0.04, cx, 0.1 + (h - 0.1) / 2, z, 0xe4e4e0);
    for (const ex of [x0, x1]) { cbox(0.05, h, 0.96, ex, h / 2, z, aisleAccent); }
    for (const [i, y] of [0.1, 0.52, 0.94, 1.36].entries()) for (const sd of [-1, 1]) {
      if (i) { cbox(len - 0.06, 0.025, 0.44, cx, y + 0.0125, z + sd * 0.24, 0xd4d4d0); col(len - 0.06, 0.04, 0.46, cx, y + 0.005, z + sd * 0.24); }
      cbox(len - 0.06, 0.045, 0.012, cx, y + 0.01, z + sd * 0.462, 0xf2ecc8); // (the price strip)
      facing(len - 0.08, cx, y + 0.03 + 0.2, z + sd * 0.36, sd > 0 ? 0 : Math.PI, set);
      if (i) for (let x = x0 + 0.35; x < x1 - 0.3; x += 0.5) roomRec.shelf.push({ p: toW(x, y + 0.03, z + sd * 0.41), ry: yaw + (sd > 0 ? 0 : Math.PI) });
    }
    if (label) { sign(label, 2.2, cx, 2.55, z + 0.01, 0, '#ffffff', '#1d2a38'); sign(label, 2.2, cx, 2.55, z - 0.01, Math.PI, '#ffffff', '#1d2a38'); cbox(0.02, H - 2.55 - 0.2, 0.02, cx - 0.9, (H + 2.75) / 2, z, 0x8a8d90); cbox(0.02, H - 2.55 - 0.2, 0.02, cx + 0.9, (H + 2.75) / 2, z, 0x8a8d90); }
  };
  // glass-door fridges (or freezers) along a wall: lit shelves of drinks behind glass doors
  const coolers = (x0, x1, zb, set = 'drinks', title = 'COLD DRINKS') => {
    const len = x1 - x0, cx = (x0 + x1) / 2, zf = zb + 0.85;
    cbox(len, 2.25, 0.85, cx, 1.125, zb + 0.425, 0x24272a); col(len, 2.3, 1.0, cx, 1.15, zb + 0.5);
    for (let i = 0; i < 5; i++) { const y = 0.22 + i * 0.4; facing(len - 0.1, cx, y + 0.19, zf + 0.004, 0, set, 0.38); cbox(len - 0.1, 0.02, 0.06, cx, y - 0.01, zf + 0.03, 0xc8ccd0); }
    glow(len - 0.1, 0.05, cx, 2.12, zf + 0.01, set === 'frozen' ? 0xd8f0ff : 0xfff8ec, 1.6);
    const doors = Math.max(1, Math.round(len / 0.95)), dw = len / doors;
    for (let k = 0; k <= doors; k++) cbox(0.06, 2.05, 0.08, x0 + k * dw, 1.1, zf + 0.06, 0x3a3d40);
    for (let k = 0; k < doors; k++) cbox(0.03, 0.7, 0.04, x0 + k * dw + dw - 0.12, 1.25, zf + 0.13, 0xc8ccd0);
    cbox(len, 0.08, 0.1, cx, 2.12, zf + 0.06, 0x3a3d40); cbox(len, 0.12, 0.1, cx, 0.1, zf + 0.06, 0x3a3d40);
    mesh(new THREE.PlaneGeometry(len, 2.0), glassM, cx, 1.1, zf + 0.1, { shadow: false });
    if (set === 'frozen') mesh(new THREE.PlaneGeometry(len, 2.0), std(0xdff2ff, 0.3, { transparent: true, opacity: 0.12, depthWrite: false }), cx, 1.1, zf + 0.11, { shadow: false });
    cbox(len, 0.4, 0.3, cx, 2.45, zb + 0.75, 0x24272a); sign(title, Math.min(3, len * 0.6), cx, 2.45, zb + 0.91, 0, set === 'frozen' ? '#123a6a' : '#1d2a38', '#ffffff');
  };
  // an open-topped chest freezer with a glass lid
  const lidM = std(0xdff0ff, 0.15, { transparent: true, opacity: 0.12, depthWrite: false, envMapIntensity: 0.2 });
  const chestFreezer = (x, z, len = 2.2) => {
    cbox(len, 0.55, 0.9, x, 0.275, z, 0xeef0f2); col(len, 0.85, 0.9, x, 0.425, z);
    for (const sz of [-1, 1]) cbox(len, 0.3, 0.06, x, 0.69, z + sz * 0.42, 0xeef0f2); for (const sx of [-1, 1]) cbox(0.06, 0.3, 0.9, x + sx * (len / 2 - 0.03), 0.69, z, 0xeef0f2);
    const t = shelfTex('frozen', Math.floor(Math.random() * 3)), geo = new THREE.PlaneGeometry(len - 0.16, 0.74), uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (len - 0.16) / 4, uv.getY(k) * 1.85);
    mesh(geo, t, x, 0.58, z, { rx: -Math.PI / 2, shadow: false });
    for (const sz of [-1, 1]) cbox(len, 0.06, 0.06, x, 0.82, z + sz * 0.42, 0xc8ccd0); for (const sx of [-1, 1]) cbox(0.06, 0.06, 0.9, x + sx * (len / 2 - 0.03), 0.82, z, 0xc8ccd0);
    mesh(new THREE.PlaneGeometry(len - 0.1, 0.8), lidM, x, 0.84, z, { rx: -Math.PI / 2, shadow: false });
    cbox(len * 0.6, 0.12, 0.02, x, 0.6, z + 0.46, 0x2e6ac8);
  };
  // the cashier's back counter: a cupboard on the floor and a tobacco/lottery gantry on top of it
  const backCounter = (x, z, w = 2.2, set = 'cigs', title = 'TOBACCO · LOTTO', color = 0xc8102e, css = '#c8102e') => {
    cbox(w, 0.95, 0.5, x, 0.475, z, 0x5a4030, { collide: true }); cbox(w + 0.04, 0.04, 0.54, x, 0.97, z, 0x2b2b2b);
    cbox(w - 0.2, 1.15, 0.28, x, 1.565, z - 0.1, 0x2b2d30);
    for (let i = 0; i < 3; i++) { facing(w - 0.3, x, 1.18 + i * 0.36, z + 0.045, 0, set, 0.34); if (i) cbox(w - 0.25, 0.02, 0.1, x, 1.0 + i * 0.36, z + 0.03, 0x3a3d40); }
    cbox(w - 0.2, 0.25, 0.3, x, 2.27, z - 0.08, color); sign(title, w - 0.4, x, 2.27, z + 0.075, 0, css, '#ffffff');
  };
  const counter = (x, z, w, d = 0.8, color = 0x6a4a32, top = 0x2b2b2b) => { cbox(w, 1.0, d, x, 0.5, z, color, { collide: true }); cbox(w + 0.1, 0.06, d + 0.1, x, 1.03, z, top); };
  const register = (x, z) => { cbox(0.45, 0.25, 0.4, x, 1.18, z, 0x2b2b2b); cbox(0.35, 0.22, 0.04, x, 1.42, z - 0.1, 0x3a5a6a, { rx: -0.3 }); };
  const chair = (x, z, ry = 0, color = 0x5a3a22) => { cbox(0.45, 0.06, 0.45, x, 0.46, z, color, { ry }); const b = V(0, 0.75, -0.2).applyAxisAngle(V(0, 1, 0), ry); cbox(0.45, 0.5, 0.05, x + b.x, b.y, z + b.z, color, { ry }); for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) { const o = V(dx, 0, dz).applyAxisAngle(V(0, 1, 0), ry); cbox(0.04, 0.45, 0.04, x + o.x, 0.22, z + o.z, 0x2b2b2b); } };
  const table = (x, z, w = 0.9, d = 0.9, color = 0x8a6a4a, round = false) => { if (round) { ccyl(w / 2, 0.04, x, 0.76, z, color, 18); ccyl(0.05, 0.74, x, 0.37, z, 0x2b2b2b, 8); } else { cbox(w, 0.05, d, x, 0.76, z, color); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cbox(0.05, 0.74, 0.05, x + dx * (w / 2 - 0.06), 0.37, z + dz * (d / 2 - 0.06), 0x2b2b2b); } col(w, 0.8, d, x, 0.4, z); };
  const plant = (x, z, s = 1) => { ccyl(0.22 * s, 0.4 * s, x, 0.2 * s, z, 0x9a5a3a, 12); for (let i = 0; i < 5; i++) { const geo = new THREE.ConeGeometry(0.1 * s, 0.8 * s, 6); geo.rotateZ((Math.random() - 0.5) * 0.7); geo.rotateX((Math.random() - 0.5) * 0.7); geo.translate(x + (Math.random() - 0.5) * 0.15, 0.75 * s, z + (Math.random() - 0.5) * 0.15); geo.applyMatrix4(M); geo.deleteAttribute('uv'); const n = geo.attributes.position.count, cl = new Float32Array(n * 3); const c = new THREE.Color(0x3f6e2f); for (let k = 0; k < n; k++) { cl[k * 3] = c.r; cl[k * 3 + 1] = c.g; cl[k * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); city.trim.push(geo); } };
  const sofa = (x, z, w, ry = 0, color = 0x4a5a6a) => { const o = (dx, dz) => V(dx, 0, dz).applyAxisAngle(V(0, 1, 0), ry); cbox(w, 0.42, 0.9, x, 0.21, z, color, { ry, collide: true }); const b = o(0, -0.35); cbox(w, 0.8, 0.22, x + b.x, 0.4, z + b.z, color, { ry }); for (const s of [-1, 1]) { const a = o(s * (w / 2 - 0.1), 0); cbox(0.2, 0.6, 0.9, x + a.x, 0.3, z + a.z, color, { ry }); } };
  const products = { food: [0xd8344a, 0xf2c23a, 0x3aa86a, 0x2e6ac8, 0xe8e2d4, 0xd88a2a, 0x8a4a2a], games: [0x2e6ac8, 0xd8344a, 0x2b2b2b, 0x3aa86a, 0xffffff, 0x9a3ad8], tools: [0xd8b52a, 0x5a5f66, 0xc8402e, 0x2e5a8a, 0x8a8d90], cheap: [0xff6a1a, 0xf2e23a, 0x3ad8d8, 0xff4fd8, 0x7bd83a] };

  switch (kind) {
    case 'store': { // the till by the door with the back counter behind it; aisles of shelves; fridges (and freezers) along the back
      const set = opts.products || 'food';
      const tillX = doorU + 3.2;
      counter(tillX, -2.2, 3, 0.8); register(tillX - 0.6, -2.2);
      cbox(0.5, 0.35, 0.3, tillX + 0.9, 1.23, -2.2, 0xf2c23a); cbox(0.48, 0.3, 0.01, tillX + 0.9, 1.23, -2.04, 0xd8344a); // (scratchies)
      const bc = { food: ['cigs', 'TOBACCO · LOTTO', 0xc8102e, '#c8102e'], games: ['games', 'PRE-ORDERS', 0x2e6ac8, '#2e6ac8'], tools: ['tools', 'KEYS CUT HERE', 0xd87a1a, '#d87a1a'], cheap: ['cheap', '$2 · $2 · $2', 0xd83aa8, '#d83aa8'] }[set] || ['cigs', 'TOBACCO · LOTTO', 0xc8102e, '#c8102e'];
      backCounter(tillX, -3.65, 2.4, ...bc);
      worker(tillX, -3.0, 0, opts.lines || ["What can I get you?", "We're out of milk. Don't ask.", "You buying or just looking?"], 'clerk');
      const labels = { food: ['SNACKS · CHIPS', 'CEREAL · BREAKFAST', 'CANS · PASTA · RICE', 'HOUSEHOLD', 'SWEETS · BISCUITS'], games: ['NEW RELEASES', 'PRE-OWNED', 'CONSOLES', 'ACCESSORIES'], tools: ['PAINT', 'HAND TOOLS', 'POWER TOOLS', 'GARDEN', 'PLUMBING'], cheap: ['KITCHEN', 'PARTY', 'TOYS', 'EVERYTHING ELSE'] }[set] || [];
      const hasCool = opts.fridges !== false && set === 'food', backZ = -D + (hasCool ? 1.1 : 0.4);
      const aisles = [];
      let a = 0;
      for (let z = -5.6; z > backZ + 2.0; z -= 2.75) { gondola(-W / 2 + 2, W / 2 - 2.2, z, set, labels[a % labels.length]); aisles.push(z); a++; }
      if (!aisles.length) { gondola(-W / 2 + 2, W / 2 - 2.2, -5.3, set, labels[0]); aisles.push(-5.3); }
      if (hasCool) {
        const half = (W - 1.2) / 2;
        coolers(-W / 2 + 0.6, -W / 2 + 0.6 + half, -D, 'drinks', 'COLD DRINKS');
        coolers(-W / 2 + 0.6 + half, W / 2 - 0.6, -D, 'frozen', 'FROZEN');
        if (opts.chest !== false) chestFreezer(W / 2 - 2.6, -2.5, 2.0);
      } else { // wall shelving along the back instead
        const len = W - 1.4; col(len, 2.2, 0.5, 0, 1.1, -D + 0.25); cbox(len, 2.2, 0.06, 0, 1.1, -D + 0.03, 0xe4e4e0);
        for (let i = 0; i < 5; i++) { const y = 0.12 + i * 0.42; cbox(len, 0.025, 0.45, 0, y, -D + 0.25, 0xd4d4d0); facing(len - 0.1, 0, y + 0.21, -D + 0.38, 0, set); cbox(len, 0.04, 0.012, 0, y + 0.0, -D + 0.48, 0xf2ecc8); }
      }
      sign(opts.sign || 'OPEN 24 HRS', 2.4, 0, H - 0.45, -D + (hasCool ? 1.3 : 0.07), 0, '#1d2a38', '#7be08a');
      // where shoppers go: the aisle walkways, then the till
      g.shops = g.shops || [];
      const L = (x, z) => toW(x, 0.05, z), colX = -W / 2 + 1.05, walkZ = aisles.map(z => z + 1.37).concat(hasCool ? [-D + 1.85] : []);
      g.shops.push({ name: opts.name, outside: L(doorU, 1.8), till: L(tillX, -1.35), tillYaw: yaw + Math.PI, shelfYaw: yaw + Math.PI,
        route: () => { // outside → in → down the side → along an aisle → back → the till → out
          const wz = walkZ[Math.floor(Math.random() * walkZ.length)], bx = -W / 2 + 3 + Math.random() * (W - 6);
          const pts = [L(doorU, 1.8), L(doorU, -1.0), L(doorU, -4.25), L(colX, -4.25), L(colX, wz), L(bx, wz), L(colX, wz), L(colX, -4.25), L(doorU, -4.25), L(doorU, -1.35), L(tillX - 0.2, -1.35), L(doorU, -1.0), L(doorU, 2.2)];
          const stops = pts.map(() => null); stops[5] = 'browse'; stops[10] = 'till';
          return { pts, stops };
        } });
      break;
    }
    case 'gunstore': { // Halyard Arms: a long glass counter of pistols, racks of long guns on the wall, a target range sign
      counter(0, -3.4, W - 8, 0.9, 0x2b2d30, 0x1a1a1a); mesh(new THREE.BoxGeometry(W - 8, 0.12, 0.9), glassM, 0, 1.12, -3.4); register(W / 2 - 5.5, -3.4);
      for (let x = -W / 2 + 5; x < W / 2 - 6; x += 0.7) { cbox(0.32, 0.05, 0.18, x, 0.98, -3.4, 0x1a1a1c); cbox(0.06, 0.14, 0.1, x - 0.11, 0.93, -3.4, 0x1a1a1c); }
      worker(0, -4.6, 0, opts.lines || ["Looking to protect yourself? Smart.", "Background check? Sure. You look fine.", "Ammo's by the box. Don't be shy."], 'clerk');
      for (let x = -W / 2 + 3; x < W / 2 - 2; x += 0.55) { cbox(0.09, 1.1, 0.07, x, 1.75, -D + 0.16, [0x2a2a2a, 0x5a3a22, 0x3a3d40][Math.floor(Math.random() * 3)]); cbox(0.05, 0.3, 0.05, x, 1.2, -D + 0.16, 0x1a1a1a); }
      cbox(W - 4, 0.06, 0.3, 0, 1.15, -D + 0.25, 0x5a3a22); cbox(W - 4, 0.06, 0.3, 0, 2.35, -D + 0.25, 0x5a3a22);
      for (let x = -W / 2 + 2.5; x < -W / 2 + 7; x += 1.4) cbox(0.9, 0.75, 0.5, x, 0.375, -D + 2.4, 0x3a4a2a, { collide: true }); // (ammo crates)
      sign('HALYARD ARMS · EST. 1987', 5, 0, H - 0.6, -D + 0.07, 0, '#1a1410', '#e8c46a');
      sign('NO LOADED WEAPONS PAST THIS POINT', 4, -W / 2 + 0.3, 2.4, -D / 2, Math.PI / 2, '#8a1c1c', '#ffffff');
      break;
    }
    case 'pawn': { // glass counters, guitars, TVs, a safe
      for (const [x, z, w, ry] of [[0, -4, W - 6, 0], [-W / 2 + 3, -D / 2, D - 6, Math.PI / 2]]) { cbox(w, 0.9, 0.8, x, 0.45, z, 0x2b2d30, { ry, collide: true }); mesh(new THREE.BoxGeometry(w, 0.15, 0.8), glassM, x, 0.98, z, { ry }); for (let k = 0; k < w / 0.5; k++) { const o = V(-w / 2 + 0.3 + k * 0.5, 0, 0).applyAxisAngle(V(0, 1, 0), ry); cbox(0.15, 0.06, 0.2, x + o.x, 0.93, z + o.z, [0xd8b44a, 0xc0c4c8, 0x2b2b2b, 0x9a1c1c][k % 4], { ry }); } }
      register(1, -4); worker(0, -5.2, 0, ["Everything's got a price.", "No refunds. No questions.", "That one? Belonged to a cop. Allegedly."], 'clerk');
      for (let x = -W / 2 + 4; x < W / 2 - 1; x += 1.0) { cbox(0.35, 0.9, 0.06, x, 1.9, -D + 0.12, [0x8a4a1c, 0xc8402e, 0x2b2b2b][Math.floor(Math.random() * 3)]); cbox(0.08, 0.7, 0.04, x, 2.65, -D + 0.12, 0x2b2b2b); }
      for (let x = W / 2 - 2; x > W / 2 - 5; x -= 1.1) for (const y of [0.6, 1.4]) { cbox(0.9, 0.6, 0.5, x, y, -D + 1.6, 0x1a1a1a); glow(0.75, 0.45, x, y, -D + 1.86, 0x2a5a7a, 0.6); }
      cbox(1, 1.2, 0.9, W / 2 - 1.5, 0.6, -D + 0.8, 0x3a3d40, { collide: true });
      sign('WE BUY GOLD', 3, 0, H - 0.6, -D + 0.07, 0, '#2b1d12', '#e8c46a');
      break;
    }
    case 'cafe': { // a counter, an espresso machine, little tables; a stair up to the detective's office
      counter(W / 2 - 4, -3, 5, 0.8, 0x4a3226, 0x2b2b2b); worker(W / 2 - 4, -4.0, 0, ["Flat white? Long black? Something stronger?", "The guy upstairs? Pays his tab in cash. Always cash.", "We close when I say we close."], 'barista');
      cbox(0.6, 0.5, 0.45, W / 2 - 5.4, 1.3, -3, 0xc0c4c8); mesh(new THREE.BoxGeometry(1.4, 0.5, 0.6), glassM, W / 2 - 2.6, 1.3, -3);
      for (let k = 0; k < 4; k++) cbox(0.2, 0.15, 0.2, W / 2 - 3.1 + k * 0.33, 1.13, -3, [0xc88a4a, 0xe8c46a, 0x6a3a22, 0xe8e2d4][k]);
      sign('ESPRESSO · LATTE · DONUTS · TEA', 4.5, W / 2 - 4, 2.7, -D + 0.07, 0, '#1a1410', '#f1dfa8');
      for (let x = -W / 2 + 4.5; x < W / 2 - 8; x += 3) for (let z = -3; z > -D + 2.5; z -= 3) { table(x, z, 0.8, 0.8, 0x8a6a4a, true); chair(x - 0.7, z, Math.PI / 2); chair(x + 0.7, z, -Math.PI / 2); }
      if (room.floors > 1) office(); // (upstairs)
      break;
    }
    case 'diner': { // booths along the windows, a counter with stools, a kitchen pass, a jukebox
      const red = 0xb01a20;
      counter(0, -D + 3.2, W - 6, 0.8, 0xd8dade, 0xe8e2d6);
      for (let x = -W / 2 + 4; x < W / 2 - 3; x += 1.2) { ccyl(0.22, 0.08, x, 0.75, -D + 4.1, red, 14); ccyl(0.05, 0.72, x, 0.36, -D + 4.1, 0xc0c4c8, 8); }
      cbox(W - 6, 1.2, 0.3, 0, 1.6, -D + 0.9, 0x8a8d90); glow(W - 7, 0.5, 0, 2.4, -D + 1.06, 0xffe2b0, 0.9);
      for (let x = -W / 2 + 2; x < W / 2 - 2; x += 2.6) { if (Math.abs(x - doorU) < 2) continue; table(x, -1.4, 1.1, 0.8, 0xe8e2d6); for (const s of [-1, 1]) cbox(0.5, 0.9, 0.9, x + s * 0.95, 0.45, -1.3, red, { collide: true }); }
      cbox(0.9, 1.6, 0.6, W / 2 - 1.2, 0.8, -D + 2, 0xd8b44a, { collide: true }); glow(0.7, 0.5, W / 2 - 1.2, 1.2, -D + 2.31, 0xff7ab6, 1.2);
      worker(-2, -D + 2.2, 0, ["Coffee's bottomless. Pie's not.", "Sit anywhere, hon.", "Don't mind the cook. He's been like that since his divorce."], 'waitress');
      sign('PIE OF THE DAY: CHERRY', 3.5, 0, 3.2, -D + 0.75, 0, '#1a0606', '#ff6a6a');
      break;
    }
    case 'club': { // a lit dance floor, a bar, a DJ booth, speakers, booths
      const tiles = 8, ts = Math.min(1.6, (Math.min(W, D) - 6) / tiles);
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(ts * 0.96, 0.06, ts * 0.96), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.3 }), tiles * tiles);
      const mt = new THREE.Matrix4(), cx0 = -ts * tiles / 2 + ts / 2, cz0 = -D / 2 - ts * tiles / 2 + ts / 2;
      for (let i = 0; i < tiles; i++) for (let j = 0; j < tiles; j++) { mt.makeTranslation(cx0 + i * ts, 0.06, cz0 + j * ts); im.setMatrixAt(i * tiles + j, mt); im.setColorAt(i * tiles + j, new THREE.Color(0xff4fd8)); }
      im.userData.dynamic = true; grp.add(im); grp.userData.dynamic = false;
      const pal = [0xff4fd8, 0x4fd8ff, 0x9a4fff, 0xffd84f, 0x4fff9a].map(c => new THREE.Color(c));
      (g.animators = g.animators || []).push((t) => { const beat = Math.floor(t * 2.1); for (let i = 0; i < tiles * tiles; i++) im.setColorAt(i, pal[(i * 7 + beat + ((i % tiles) ^ beat)) % pal.length]); im.instanceColor.needsUpdate = true; });
      counter(-W / 2 + 4, -D + 2.5, 6, 0.8, 0x1a1a1e, 0x3a3a44); worker(-W / 2 + 4, -D + 1.5, 0, ["What are you drinking?", "Card's behind the bar. Don't ask whose.", "VIP's upstairs. You're not VIP."], 'bartender');
      for (let x = -W / 2 + 1.6; x < -W / 2 + 7; x += 0.25) cbox(0.08, 0.3, 0.08, x, 1.9 + (Math.floor(x * 4) % 2) * 0.4, -D + 0.25, [0x3aa86a, 0xd8b44a, 0x9a1c3a, 0xe8e2d4][Math.floor(Math.random() * 4)]);
      glow(6, 1.2, -W / 2 + 4, 2.1, -D + 0.08, 0x4fd8ff, 0.5);
      cbox(3, 1.1, 1.2, W / 2 - 3, 0.55, -D + 1.5, 0x111114, { collide: true }); cbox(1.4, 0.08, 0.5, W / 2 - 3, 1.14, -D + 1.5, 0x3a3a44); glow(2.6, 0.3, W / 2 - 3, 0.8, -D + 2.11, 0x9a4fff, 1.5);
      worker(W / 2 - 3, -D + 0.8, 0, ["*can't hear you*", "This next one's a banger.", "Request? No."], 'dj');
      for (const x of [W / 2 - 5.5, W / 2 - 0.6]) cbox(0.9, 2.2, 0.9, x, 1.1, -D + 1.2, 0x0c0c0e, { collide: true });
      for (const sx of [-1, 1]) sofa(sx * (W / 2 - 1.2), -D / 2 + 3, 3, sx * -Math.PI / 2, 0x3a1a3a);
      break;
    }
    case 'paul': { // Paul Badfella, attorney at law: a waiting room out front; his own office at the back, round, behind a curved wall
      const marble = 0xeeeae2, gold = 0xd8a92e, R = 4.6, cz = -D + 0.2;
      // ---- the waiting room: Cheryl, chairs, magazines, a water cooler, a ticket machine that only says 0
      counter(-W / 2 + 2.4, -2.2, 2.4, 0.8, marble, 0xd8d2c4); worker(-W / 2 + 2.4, -3.0, 0, ["Do you have an appointment? He doesn't do appointments. Take a number.", "The machine only does zero. Everyone's zero.", "I'm a paralegal. Allegedly.", "The columns are fibreglass. Don't lean on them.", "He'll see you. He sees everyone. That's the problem.", "We're only here till the Royce thing wraps. Then it's back to Albuquerque, thank God.", "This isn't the real office. The real office has a fountain. A small one. It leaks."], 'receptionist');
      for (let i = 0; i < 4; i++) chair(W / 2 - 0.7, -1.6 - i * 0.9, -Math.PI / 2, 0x7a1a1e);
      cbox(0.9, 0.42, 1.6, W / 2 - 2.0, 0.21, -2.95, 0x5a3422, { collide: true });
      for (let i = 0; i < 5; i++) cbox(0.28, 0.02, 0.36, W / 2 - 2.0 + (Math.random() - 0.5) * 0.4, 0.43 + i * 0.012, -2.95 + (Math.random() - 0.5) * 1.0, [0xd84a3a, 0x3a7ad8, 0xe8d84a, 0x6ac86a, 0xe8e2d4][i], { ry: Math.random() });
      cbox(0.4, 1.0, 0.4, -W / 2 + 0.45, 0.5, -5.4, 0xe8e8ec, { collide: true }); ccyl(0.16, 0.42, -W / 2 + 0.45, 1.22, -5.4, 0x7ab8e8, 14);
      cbox(0.34, 1.2, 0.3, 2.2, 0.6, -0.55, 0xb8202a, { collide: true }); sign('TAKE A NUMBER · NOW SERVING: 0', 0.9, 2.2, 1.45, -0.39, 0, '#111', '#ff5a3a');
      plant(-W / 2 + 1.0, -1.0); plant(W / 2 - 0.8, -6.2, 1.3);
      sign('NO WIN, NO FEE*', 2.6, W / 2 - 0.07, 2.6, -4.2, -Math.PI / 2, '#d8a92e', '#7a1a1e');
      sign('*FEE', 0.8, W / 2 - 0.07, 2.1, -4.2, -Math.PI / 2, '#d8a92e', '#7a1a1e');
      // ---- the curved wall round his office, a doorway in the middle (with a brass sign over it)
      for (let k = 0; k <= 28; k++) {
        const th = -Math.PI / 2 + (k / 28) * Math.PI; if (Math.abs(th) < 0.19) continue;
        const x = Math.sin(th) * R, z = cz + Math.cos(th) * R;
        cbox(R * (Math.PI / 28) * 1.12, H, 0.22, x, H / 2, z, 0xf2e6c8, { ry: th, collide: true });
        if (k % 2 === 0) cbox(0.06, H, 0.06, Math.sin(th) * (R + 0.12), H / 2, cz + Math.cos(th) * (R + 0.12), gold); // (gold pinstripes, outside)
      }
      { const lx = Math.sin(0.19) * R; cbox(lx * 2 + 0.2, H - 2.3, 0.24, 0, 2.3 + (H - 2.3) / 2, cz + R * Math.cos(0.19), 0xf2e6c8); }
      sign('PRIVATE · PAUL BADFELLA, ESQ.', 1.8, 0, 2.55, cz + R + 0.13, 0, '#2a1a0a', '#e8c46a');
      // ---- inside: the desk, chairs, the flag, the gold scales, diplomas, columns round the curve, a rug
      cbox(2.8, 0.08, 1.1, 0, 0.8, -D + 2.2, 0x3a2216, { collide: false }); cbox(2.7, 0.76, 1.0, 0, 0.38, -D + 2.2, 0x5a3422, { collide: true });
      cbox(0.5, 0.09, 0.08, 0.6, 0.88, -D + 2.75, gold); sign('PAUL BADFELLA, ESQ.', 0.5, 0.6, 0.88, -D + 2.8, 0, '#d8a92e', '#2a1a0a');
      chair(0, -D + 0.8, 0, 0x2a1a12); chair(-0.7, -D + 3.6, Math.PI, 0x7a1a1e); chair(0.7, -D + 3.6, Math.PI, 0x7a1a1e);
      { const t = canvasTex(256, 160, (c) => { for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#f2efe6' : '#b8202a'; c.fillRect(0, i * 160 / 9, 256, 160 / 9 + 1); } c.fillStyle = '#1d2f6a'; c.fillRect(0, 0, 110, 88); c.fillStyle = '#e8c46a'; c.font = 'bold 54px Georgia'; c.textAlign = 'center'; c.fillText('⚖', 55, 64); });
        mesh(new THREE.PlaneGeometry(3.4, 2.1), std(0xffffff, 0.8, { map: t }), 0, 2.2, -D + 0.06, { shadow: false }); }
      for (const th of [-1.25, -0.7, 0.7, 1.25]) { const x = Math.sin(th) * (R - 0.45), z = cz + Math.cos(th) * (R - 0.45); ccyl(0.22, H - 0.2, x, (H - 0.2) / 2, z, marble, 16); cbox(0.55, 0.16, 0.55, x, 0.08, z, 0xd8d2c4); }
      cbox(0.5, 1.0, 0.5, 3.1, 0.5, -D + 1.3, marble, { collide: true }); ccyl(0.04, 0.9, 3.1, 1.45, -D + 1.3, gold, 8); cbox(0.9, 0.04, 0.04, 3.1, 1.88, -D + 1.3, gold);
      for (const sx of [-1, 1]) ccyl(0.2, 0.03, 3.1 + sx * 0.42, 1.55, -D + 1.3, gold, 14);
      { const t = canvasTex(256, 192, (c) => { c.fillStyle = '#f4ecd2'; c.fillRect(0, 0, 256, 192); c.strokeStyle = '#b8902e'; c.lineWidth = 10; c.strokeRect(5, 5, 246, 182); c.fillStyle = '#2a1a0a'; c.textAlign = 'center'; c.font = 'bold 22px Georgia'; c.fillText('DIPLOMA', 128, 50); c.font = 'italic 15px Georgia'; c.fillText('Paul Badfella', 128, 86); c.fillText('is hereby a lawyer', 128, 108); c.font = '11px Georgia'; c.fillText('University of Online', 128, 150); });
        for (const x of [-2.4, -3.2, 2.2]) for (const y of [1.4, 2.0]) if (!(x > 0 && y < 1.6)) mesh(new THREE.PlaneGeometry(0.55, 0.42), std(0xffffff, 0.7, { map: t }), x, y, -D + 0.06, { shadow: false }); }
      ccyl(3.0, 0.02, 0, 0.02, -D + 2.6, 0x7a1a1e, 28);
      plant(-3.4, -D + 0.9, 1.1);
      g.paulOffice = { desk: toW(0, 0.04, -D + 1.3), deskYaw: yaw, client: toW(0, 0.04, -D + 4.3), clientYaw: yaw + Math.PI, guest: toW(-0.7, 0.04, -D + 3.9), guestYaw: yaw + Math.PI, wait: toW(W / 2 - 1.6, 0.04, -3.0), centre: toW(0, 0.04, cz), R, door: toW(doorU, 0.04, 1.8), doorYaw: yaw, inside: toW(doorU, 0.04, -1.5) };
      break;
    }
    case 'lobby': { // hospital, police, hotel, law firm, spa: a desk, seats, plants and the right signs
      const v = opts.variant;
      const deskC = { hospital: 0xe8e8e8, police: 0x3a4a6a, ritz: 0xd8b44a, law: 0x4a3226, spa: 0xd8cbb4 }[v];
      counter(0, -D + 3, Math.min(6, W - 4), 1.0, deskC, v === 'ritz' ? 0x2b2b2b : 0xd8d6d0);
      if (v === 'police') { mesh(new THREE.BoxGeometry(Math.min(6, W - 4), 1.2, 0.04), glassM, 0, 1.65, -D + 2.6); col(Math.min(6, W - 4), 1.2, 0.05, 0, 1.65, -D + 2.6); }
      const lines = { hospital: ["Take a number. Take a seat.", "The doctor will see you… eventually.", "If you're bleeding, that line. If you're dying, that line."], police: ["Here to report something? Fill this in.", "We're very busy. Since that blue stuff turned up, everyone's very busy.", "You look familiar. Have we met?"], ritz: ["Welcome to Putin's Ritz. Do you have a reservation?", "The penthouse is… occupied.", "Valet's out front. Tip generously."], law: ["Mr Badfella doesn't see walk-ins.", "How did you get past the fence?", "Leave your name. He'll… consider it."], spa: ["Breathe in. Breathe out. That'll be $90.", "Shoes off, please.", "The hot stones are extra."] }[v];
      worker(0, -D + 2.0, 0, lines, 'receptionist');
      const signText = { hospital: 'RECEPTION · EMERGENCY →', police: 'FRONT DESK · ALL VISITORS REPORT HERE', ritz: "PUTIN'S RITZ · EST. 1991", law: 'PAUL BADFELLA · ATTORNEY AT LAW', spa: 'SERENITY SPA' }[v];
      sign(signText, Math.min(6, W - 4), 0, H - 0.8, -D + 0.07, 0, v === 'ritz' ? '#1a1410' : v === 'police' ? '#1c3a7a' : '#f2f0ea', v === 'ritz' ? '#e8c46a' : v === 'police' ? '#ffffff' : '#2b3a4a');
      if (v === 'hospital' || v === 'police') for (let r2 = 0; r2 < 2; r2++) for (let x = -W / 2 + 2; x < -1.5; x += 0.65) chair(x, -2.5 - r2 * 1.6, Math.PI, v === 'hospital' ? 0x2e6ac8 : 0x5a5f66);
      if (v === 'hospital') { cbox(0.9, 1.9, 0.8, W / 2 - 1.5, 0.95, -2, 0xc8402e, { collide: true }); glow(0.7, 1.2, W / 2 - 1.5, 1.2, -1.58, 0xf2f6ff, 0.6); }
      if (v === 'police') { const bt = canvasTex(512, 256, (c) => { c.fillStyle = '#8a6a4a'; c.fillRect(0, 0, 512, 256); for (let i = 0; i < 6; i++) { c.fillStyle = '#f2f0ea'; c.fillRect(20 + i * 82, 30, 70, 90); c.fillStyle = '#2b2b2b'; c.font = 'bold 14px Arial'; c.fillText('WANTED', 26 + i * 82, 50); c.fillStyle = '#5a5f66'; c.fillRect(32 + i * 82, 58, 46, 50); } c.fillStyle = '#f2f0ea'; c.fillRect(20, 140, 240, 100); c.fillStyle = '#9a1c1c'; c.font = 'bold 20px Arial'; c.fillText('BLUE SUBSTANCE', 30, 175); c.fillStyle = '#2b2b2b'; c.font = '16px Arial'; c.fillText('Two hospitalised. Any info', 30, 200); c.fillText('to the front desk.', 30, 220); }); mesh(new THREE.PlaneGeometry(3, 1.5), std(0xffffff, 0.8, { map: bt }), -W / 2 + 0.3, 1.7, -D / 2, { ry: Math.PI / 2, shadow: false }); }
      if (v === 'ritz') { for (const sx of [-1, 1]) sofa(sx * (W / 4), -4.5, 2.6, sx > 0 ? -Math.PI / 2 : Math.PI / 2, 0x6a1a1e); const ch = mesh(new THREE.SphereGeometry(0.7, 16, 10), std(0xfff2cc, 0.2, { emissive: 0xffe2a0, emissiveIntensity: 1.2, metalness: 0.4 }), 0, H - 1.0, -D / 2); cbox(0.04, 0.6, 0.04, 0, H - 0.3, -D / 2, 0xd8b44a); const rug = mesh(new THREE.PlaneGeometry(2.4, D - 3), std(0x9a1c1c, 0.9), doorU, 0.045, -D / 2, { rx: -Math.PI / 2, shadow: false }); }
      if (v === 'law') { for (let x = -W / 2 + 1; x < W / 2 - 1; x += 1.6) { cbox(1.5, 2.6, 0.4, x, 1.3, -D + 0.3, 0x3a2a1e); for (let y = 0.4; y < 2.5; y += 0.5) for (let k = 0; k < 9; k++) cbox(0.06, 0.32, 0.25, x - 0.6 + k * 0.15, y + 0.17, -D + 0.42, [0x6a1a1e, 0x1a3a2a, 0x2a2a5a, 0x8a6a2a][k % 4]); } sofa(-W / 4, -3, 2.4, Math.PI / 2, 0x3a2418); }
      if (v === 'spa') { for (let k = 0; k < 2; k++) { cbox(0.8, 0.75, 2, W / 4 + k * 1.6 - 1, 0.375, -D / 2, 0xe8e2d6, { collide: true }); } for (let k = 0; k < 6; k++) ccyl(0.04, 0.1, -W / 2 + 1 + k * 0.3, 1.1, -D + 0.5, 0xf2efe6, 8); }
      plant(-W / 2 + 1.2, -1.2); plant(W / 2 - 1.2, -1.2);
      break;
    }
    case 'restaurant': { // fast food (or a wok bar): a counter, menu boards, tables
      const turkey = opts.variant === 'turkey';
      counter(0, -D + 3, W - 4, 0.9, turkey ? 0x9a2a1a : 0x2b1d1d, 0xe8e2d6);
      worker(-1, -D + 2.0, 0, turkey ? ["Welcome to ABT! Boiled turkey or turkey, boiled?", "The gravy's… regional.", "Drive-thru's faster. Just saying."] : ["Number 4? Number 4.", "Extra spicy costs extra.", "We don't do refunds, we do noodles."], 'cook');
      for (let k = -1; k <= 1; k++) sign(turkey ? ['TURKEY $6', 'TURKEY BURGER $8', 'GRAVY FRIES $4'][k + 1] : ['NOODLES $9', 'DUMPLINGS $7', 'FRIED RICE $8'][k + 1], 2.2, k * 2.4, 2.6, -D + 0.07, 0, turkey ? '#1a1a1a' : '#2b0a0a', turkey ? '#f2c23a' : '#ff6a6a');
      cbox(W - 4, 1.4, 0.6, 0, 0.7, -D + 0.6, 0x8a8d90);
      for (let x = -W / 2 + 2.2; x < W / 2 - 2; x += 3) for (let z = -2.5; z > -D + 5; z -= 2.6) { table(x, z, 1.2, 0.8, turkey ? 0xe8b52a : 0x6a1a1a); chair(x, z + 0.75, Math.PI, turkey ? 0x9a2a1a : 0x2b2b2b); chair(x, z - 0.75, 0, turkey ? 0x9a2a1a : 0x2b2b2b); }
      break;
    }
    case 'pool': pool(); break;
  }

  // the detective's office, upstairs over the café (a stair up from the back corner)
  function office() {
    const F1 = 4.2, H2 = H, run = 8, sx = -W / 2 + 1.5;
    // the floor between, with a hole for the stair
    const holeZ0 = -D + 1, holeZ1 = holeZ0 + run;
    cbox(W - 2 * T, 0.25, D - T - run - 1, 0, F1 - 0.125, -(D - run - 1) / 2 - T / 2 - (0), 0xcfc9be, { collide: true });
    cbox(W - 2 * T - 2.6, 0.25, run + 1, 1.3, F1 - 0.125, -D + (run + 1) / 2, 0xcfc9be, { collide: true });
    const wf = floorTex.wood(); wf.repeat.set(W / 2.5, D / 2.5);
    mesh(new THREE.PlaneGeometry(W - 2 * T, D - T - run - 1), std(0xffffff, 0.7, { map: wf }), 0, F1 + 0.005, -(D - run - 1) / 2 - T / 2, { rx: -Math.PI / 2, shadow: false });
    mesh(new THREE.PlaneGeometry(W - 2 * T - 2.6, run + 1), std(0xffffff, 0.7, { map: wf }), 1.3, F1 + 0.005, -D + (run + 1) / 2, { rx: -Math.PI / 2, shadow: false });
    mesh(new THREE.PlaneGeometry(W - 2 * T, D - T), std(0xf2efe8, 1), 0, F1 - 0.26, -D / 2 - T / 2, { rx: Math.PI / 2, shadow: false });
    // the stair: steps you see, a ramp you walk on (up along the left wall, from the front)
    const n = 20; for (let i = 0; i < n; i++) cbox(2.2, 0.05, run / n + 0.04, sx, (i + 1) * F1 / n - 0.025, holeZ1 - (i + 0.5) * run / n, 0x5a3a22);
    const ang = Math.atan2(F1, run), len = Math.hypot(F1, run);
    { const p = toW(sx, F1 / 2 - 0.05, (holeZ0 + holeZ1) / 2), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(ang, yaw, 0, 'YXZ')); /* (rising toward the back) */ world.createCollider(R.ColliderDesc.cuboid(1.1, 0.05, len / 2).setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })); }
    cbox(0.06, 1.0, run, sx + 1.2, F1 + 0.5, (holeZ0 + holeZ1) / 2, 0x2b2b2b, { collide: true });
    cbox(2.6, 0.25, 1 - T / 4, -W / 2 + T + 1.3, F1 - 0.125, -D + 0.5, 0xcfc9be, { collide: true }); // (a landing at the top)
    // the office itself
    cbox(2.0, 0.08, 1.0, 1.5, 0.78 + F1, -D + 3.5, 0x4a3226, { collide: true });
    for (const dx of [-0.9, 0.9]) cbox(0.08, 0.76, 0.9, 1.5 + dx, 0.38 + F1, -D + 3.5, 0x3a2418);
    chair(1.5, -D + 2.6, 0, 0x2b2b2b);
    for (let k = 0; k < 3; k++) cbox(0.5, 1.4, 0.6, W / 2 - 1 - k * 0.55, 0.7 + F1, -D + 0.6, 0x5a5f66, { collide: true });
    // the corkboard: photos, notes and red string
    const cork = canvasTex(512, 320, (c) => {
      c.fillStyle = '#b48a5a'; c.fillRect(0, 0, 512, 320);
      const pins = [];
      for (let i = 0; i < 9; i++) { const x = 30 + (i % 3) * 165 + Math.random() * 30, y = 25 + Math.floor(i / 3) * 100 + Math.random() * 15; c.fillStyle = '#f2f0ea'; c.fillRect(x, y, 80, 70); c.fillStyle = i % 2 ? '#5a5f66' : '#2b2b2b'; c.fillRect(x + 6, y + 6, 68, 44); c.fillStyle = '#2b2b2b'; c.font = '11px Courier'; c.fillText(['VIC?', 'PRATT', 'THE COURIER', 'MERIDIAN', 'SCOOPS?', '"C"', 'DOCKS 3AM', 'NAS HALYARD', 'WHO PAID?'][i], x + 6, y + 64); pins.push([x + 40, y + 4]); }
      c.strokeStyle = '#c8202a'; c.lineWidth = 2; c.beginPath(); for (const [a, b] of [[0, 4], [4, 5], [5, 3], [3, 7], [1, 4], [2, 6], [6, 3], [0, 8]]) { c.moveTo(...pins[a]); c.lineTo(...pins[b]); } c.stroke();
      for (const [x, y] of pins) { c.fillStyle = '#d8202a'; c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }
    });
    mesh(new THREE.PlaneGeometry(3.2, 2), std(0xffffff, 0.9, { map: cork }), W / 2 - T - 0.05, F1 + 1.7, -D / 2 - 1, { ry: -Math.PI / 2, shadow: false });
    cbox(0.25, 0.04, 0.3, 1.0, F1 + 0.84, -D + 3.4, 0xe8e2d6); cbox(0.07, 0.3, 0.07, 2.1, F1 + 0.97, -D + 3.3, 0x3a5a2a);
    sofa(-W / 2 + 4.5, -2.5, 2.2, 0, 0x3a2418);
    worker(1.5, -D + 2.0, 0, ["Door says private. Can't you read?", "You want to know who's buying up the pier? Get in line.", "I've seen your face before. On a wall. Mine.", "Somebody's paying a lot of money to keep things quiet in this town."], 'detective', F1 + 0.04);
    g.rooms.push({ kind: 'office', name: 'the Detective Office', ring: roomRec.ring, y0: F1 - 0.3, y1: H2 + 0.2, lights: [toW(0, H2 - 0.5, -D / 2)], tint: 0xffd8a0, power: 10 });
    roomRec.y1 = F1;
  }

  // the indoor pool: a raised deck round a pool you can swim in
  function pool() {
    const deck = 1.6, depth = 1.7, pw = Math.min(W - 6, 25), pd = Math.min(D - 6, 12.5), pz = -D / 2 - 0.5;
    // the deck: four slabs round the pool, a ramp up from the door
    const tileM = std(0xffffff, 0.3, { map: (() => { const t = canvasTex(128, 128, (c) => { c.fillStyle = '#e8f2f6'; c.fillRect(0, 0, 128, 128); c.strokeStyle = 'rgba(0,60,90,.18)'; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * 16, 0); c.lineTo(i * 16, 128); c.moveTo(0, i * 16); c.lineTo(128, i * 16); c.stroke(); } }); t.repeat.set(W / 2, D / 2); return t; })() });
    const slab = (x0, x1, z0, z1) => { const w = x1 - x0, d = z0 - z1; if (w < 0.1 || d < 0.1) return; mesh(new THREE.BoxGeometry(w, deck, d), tileM, (x0 + x1) / 2, deck / 2, (z0 + z1) / 2); col(w, deck, d, (x0 + x1) / 2, deck / 2, (z0 + z1) / 2); };
    const X0 = -W / 2 + T, X1 = W / 2 - T, Zf = -T - 3.2, Zb = -D + 0.05, px0 = -pw / 2, px1 = pw / 2, pz0 = pz + pd / 2, pz1 = pz - pd / 2;
    slab(X0, X1, Zf, pz0); slab(X0, X1, pz1, Zb); slab(X0, px0, pz0, pz1); slab(px1, X1, pz0, pz1);
    const ang = Math.atan2(deck, 3), len = Math.hypot(deck, 3);
    { const p = toW(0, deck / 2 - 0.05, -T - 1.6), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(ang, yaw, 0, 'YXZ')); world.createCollider(R.ColliderDesc.cuboid(W / 2 - T, 0.05, len / 2).setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })); mesh(new THREE.BoxGeometry(W - 2 * T, 0.1, len), tileM, 0, deck / 2 - 0.05, -T - 1.6, { rx: ang }); }
    // the pool: walls, a floor, the water (and lane lines)
    const poolM = std(0x5ab8d8, 0.4);
    mesh(new THREE.BoxGeometry(pw, 0.1, pd), poolM, 0, deck - depth - 0.05, pz); col(pw, 0.1, pd, 0, deck - depth - 0.05, pz);
    const waterM = new THREE.MeshPhysicalMaterial({ color: 0x3aa8d8, roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false });
    mesh(new THREE.PlaneGeometry(pw, pd), waterM, 0, deck - 0.15, pz, { rx: -Math.PI / 2, shadow: false });
    for (let k = 1; k < 5; k++) cbox(0.08, 0.02, pd, -pw / 2 + k * pw / 5, deck - depth + 0.01, pz, 0x1a4a8a);
    for (let k = 1; k < 5; k++) for (let z = -pd / 2; z < pd / 2; z += 0.4) ccyl(0.05, 0.08, -pw / 2 + k * pw / 5, deck - 0.15, pz + z, k % 2 ? 0xd8344a : 0xf2f2f2, 6);
    const c = toW(0, 0, pz), a = toW(-pw / 2, 0, pz0), b = toW(pw / 2, 0, pz1);
    (g.pools = g.pools || []).push({ ring: [toW(-pw / 2, 0, pz0), toW(pw / 2, 0, pz0), toW(pw / 2, 0, pz1), toW(-pw / 2, 0, pz1)].map(p => [p.x, p.z]), level: deck - 0.15 });
    worker(-W / 2 + 2, -T - 4.2, 0, ["No running. No diving. No bombing.", "Lifeguard's on break. Swim at your own risk.", "Towels are $5."], 'lifeguard');
    sign('NO DIVING · NO RUNNING · NO BOMBS', 4, 0, H - 1.2, -D + 0.07, 0, '#e8f2f6', '#1f6a9a');
  }

  return { workers, room: roomRec };
}
