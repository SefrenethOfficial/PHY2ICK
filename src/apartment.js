// Your building, in Fairview Heights: a lobby, a stair, and a first floor of flats off a corridor:
// four neighbours (each flat furnished for who lives there) and your own small room, with real windows,
// things to pick up and the weapon rack. (Laid out at x = 0, front at z = −60,
// then moved, whole, to where g.homeAt says.)
import * as THREE from 'three';
import { worldUV, GROUND, FLOOR } from './buildings.js';
import { canvasTex } from './world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const X0 = -11, X1 = 11, ZF = -60, ZB = -76, T = 0.3; // the footprint; wall thickness
const Y1 = GROUND, Y2 = GROUND + FLOOR;             // floor 1 (the apartment), and its ceiling

export function buildApartment(g) {
  const { world, R, city } = g;
  const DX = g.homeAt.x, DZ = g.homeAt.zf - ZF;
  const scene = new THREE.Group(); scene.position.set(DX, 0, DZ); g.scene.add(scene);
  const add = (m, shadow = true) => { m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m; };
  const col = (hx, hy, hz, x, y, z, rx = 0, ry = 0) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0));
    return world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x + DX, y, z + DZ).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
  };
  const boxM = (w, h, d, x, y, z, mat, { collide = true, shadow = true, rx = 0, ry = 0 } = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); add(m, shadow);
    if (collide) col(w / 2, h / 2, d / 2, x, y, z, rx, ry);
    return m;
  };
  const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

  // the facade (windows, door, cornice) comes from the city builder; the walls are ours, with real holes
  city.windows = [];
  city.building({ x: (X0 + X1) / 2 + DX, z: (ZF + ZB) / 2 + DZ, w: X1 - X0, d: ZF - ZB, floors: 4, style: 'brick', wallIndex: 1, solid: false, collider: false, entrance: '+z', openFloors: 2, entranceSign: 'FAIRVIEW HEIGHTS' });
  const wins = city.windows.map(w => ({ ...w, u: w.u })); city.windows = null; // (u runs along the face: unchanged by the move)
  const brick = city.lastWall;
  const plaster = std(0xe6e0d4, 0.95), lobbyWall = std(0xcfc6b4, 0.9);

  // a wall along x (at z) or along z (at x) with rectangular holes; one box per solid piece
  const wall = (axis, at, from, to, y0, y1, holes, mat, thick, uvScale) => {
    const pieces = [];
    // holes stacked in the same column (a window on each floor) are handled together
    const cols = [];
    for (const h of holes.filter(h => h.y1 > y0 && h.y0 < y1)) {
      let c = cols.find(c => Math.abs(c.a0 - h.a0) < 0.01 && Math.abs(c.a1 - h.a1) < 0.01);
      if (!c) cols.push(c = { a0: h.a0, a1: h.a1, hs: [] });
      c.hs.push(h);
    }
    cols.sort((p, q) => p.a0 - q.a0);
    let a = from;
    for (const c of cols) {
      if (c.a0 > a) pieces.push([a, c.a0, y0, y1]);
      let y = y0;
      for (const h of c.hs.sort((p, q) => p.y0 - q.y0)) { if (h.y0 > y) pieces.push([c.a0, c.a1, y, Math.min(h.y0, y1)]); y = Math.max(y, h.y1); }
      if (y < y1) pieces.push([c.a0, c.a1, y, y1]);
      a = c.a1;
    }
    if (a < to) pieces.push([a, to, y0, y1]);
    for (const [a0, a1, b0, b1] of pieces) {
      const len = a1 - a0, hgt = b1 - b0; if (len < 0.01 || hgt < 0.01) continue;
      const geo = axis === 'x' ? new THREE.BoxGeometry(len, hgt, thick) : new THREE.BoxGeometry(thick, hgt, len);
      const cx = (a0 + a1) / 2, cy = (b0 + b1) / 2;
      geo.translate(axis === 'x' ? cx : at, cy, axis === 'x' ? at : cx);
      if (uvScale) worldUV(geo, uvScale);
      add(new THREE.Mesh(geo, mat));
      if (axis === 'x') col(len / 2, hgt / 2, thick / 2, cx, cy, at); else col(thick / 2, hgt / 2, len / 2, at, cy, cx);
    }
  };
  // holes in the front wall: the windows on floors 0 and 1, and the door
  const frontHoles = wins.filter(w => w.F.key === '+z' && w.fl <= 1).map(w => ({ a0: w.u - w.w / 2, a1: w.u + w.w / 2, y0: w.y0, y1: w.y0 + w.h }));
  frontHoles.push({ a0: -0.85, a1: 0.85, y0: 0, y1: 2.55 });
  wall('x', ZF - T / 2, X0, X1, 0, Y2, frontHoles, brick.m, T, brick.scale);
  wall('x', ZB + T / 2, X0, X1, 0, Y2, [], brick.m, T, brick.scale);
  wall('z', X0 + T / 2, ZB, ZF, 0, Y2, [], brick.m, T, brick.scale);
  wall('z', X1 - T / 2, ZB, ZF, 0, Y2, [], brick.m, T, brick.scale);
  // inside linings: plaster upstairs, a warmer paint in the lobby
  const lin = 0.04;
  for (const [y0, y1, m] of [[0, Y1, lobbyWall], [Y1, Y2, plaster]]) {
    wall('x', ZF - T - lin / 2, X0 + T, X1 - T, y0, y1, frontHoles, m, lin);
    wall('x', ZB + T + lin / 2, X0 + T, X1 - T, y0, y1, [], m, lin);
    wall('z', X0 + T + lin / 2, ZB + T, ZF - T, y0, y1, [], m, lin);
    wall('z', X1 - T - lin / 2, ZB + T, ZF - T, y0, y1, [], m, lin);
  }
  // window reveals and glass you can see through from inside
  const glassIn = new THREE.MeshPhysicalMaterial({ color: 0x9fb4c2, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  for (const h of frontHoles.slice(0, -1)) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(h.a1 - h.a0, h.y1 - h.y0), glassIn); gl.position.set((h.a0 + h.a1) / 2, (h.y0 + h.y1) / 2, ZF - 0.08); scene.add(gl);
    col((h.a1 - h.a0) / 2, (h.y1 - h.y0) / 2, 0.02, (h.a0 + h.a1) / 2, (h.y0 + h.y1) / 2, ZF - 0.08);
    boxM(h.a1 - h.a0 + 0.1, 0.05, 0.36, (h.a0 + h.a1) / 2, h.y0 - 0.02, ZF - T - 0.08, std(0xf2eee6, 0.6), { collide: false });
  }
  // the upper floors: solid
  const upH = 2 * FLOOR + 0.0;
  const upG = new THREE.BoxGeometry(X1 - X0, upH, ZF - ZB); upG.translate((X0 + X1) / 2, Y2 + upH / 2, (ZF + ZB) / 2); worldUV(upG, brick.scale);
  add(new THREE.Mesh(upG, brick.m)); col((X1 - X0) / 2, upH / 2, (ZF - ZB) / 2, (X0 + X1) / 2, Y2 + upH / 2, (ZF + ZB) / 2);
  const ceilM = std(0xf4f1ea, 1);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 - 2 * T, ZF - ZB - 2 * T), ceilM); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, Y2 - 0.005, (ZF + ZB) / 2); scene.add(ceil);

  // floors: lobby tiles, the slab between, the apartment's wooden floor (with a hole for the stair)
  const tileT = canvasTex(256, 256, (c, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? '#2a2c30' : '#d9d4c8'; c.fillRect(i * 32, j * 32, 32, 32); } c.strokeStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32, h); c.moveTo(0, i * 32); c.lineTo(w, i * 32); c.stroke(); } }, [(X1 - X0) / 4, (ZF - ZB) / 4]);
  const lobbyF = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 - 2 * T, ZF - ZB - 2 * T), std(0xffffff, 0.35, { map: tileT })); lobbyF.rotation.x = -Math.PI / 2; lobbyF.position.set(0, 0.035, (ZF + ZB) / 2); lobbyF.receiveShadow = true; scene.add(lobbyF);
  col((X1 - X0) / 2, 0.02, (ZF - ZB) / 2, 0, 0.015, (ZF + ZB) / 2);
  const woodT = canvasTex(512, 512, (c, w, h) => {
    const pw = 64;
    for (let x = 0; x < w; x += pw) for (let y = -Math.random() * 300; y < h; y += 300) {
      const tone = 120 + Math.random() * 40; c.fillStyle = `rgb(${tone + 40},${tone},${tone * 0.6})`; c.fillRect(x, y, pw, 300);
      for (let k = 0; k < 30; k++) { c.strokeStyle = `rgba(60,35,15,${Math.random() * 0.15})`; c.beginPath(); c.moveTo(x + Math.random() * pw, y); c.lineTo(x + Math.random() * pw, y + 300); c.stroke(); }
      c.fillStyle = 'rgba(30,18,8,.6)'; c.fillRect(x, y, 2, 300); c.fillRect(x, y, pw, 2);
    }
  }, [5, 4]);
  const woodM = std(0xffffff, 0.55, { map: woodT });
  const SX0 = 7.2, SX1 = X1 - T, SZ0 = -62, SZ1 = -73.6; // the stair hole
  const slab = (x0, x1, z0, z1) => {
    const w = x1 - x0, d = z0 - z1;
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), std(0xcfc9be, 0.9)); s.position.set((x0 + x1) / 2, Y1 - 0.125, (z0 + z1) / 2); add(s);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), woodM); f.rotation.x = -Math.PI / 2; f.position.set((x0 + x1) / 2, Y1 + 0.004, (z0 + z1) / 2); f.receiveShadow = true; scene.add(f);
    col(w / 2, 0.125, d / 2, (x0 + x1) / 2, Y1 - 0.125, (z0 + z1) / 2);
  };
  slab(X0 + T, SX0, ZF - T, ZB + T);
  slab(SX0, SX1, ZF - T, SZ0);
  slab(SX0, SX1, SZ1, ZB + T);
  // the stair: steps you see, a ramp you walk on
  const run = SZ0 - SZ1, rise = Y1, n = 24, stepM = std(0x7a5a3c, 0.6), stringer = std(0x3a3d40, 0.5);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(SX1 - SX0 - 0.1, 0.05, run / n + 0.04), stepM);
    s.position.set((SX0 + SX1) / 2, (i + 1) * rise / n - 0.025, SZ0 - (i + 0.5) * run / n); add(s);
    const r = new THREE.Mesh(new THREE.BoxGeometry(SX1 - SX0 - 0.1, rise / n, 0.03), stringer);
    r.position.set((SX0 + SX1) / 2, (i + 0.5) * rise / n, SZ0 - i * run / n); add(r, false);
  }
  const ang = Math.atan2(rise, run), len = Math.hypot(rise, run);
  col((SX1 - SX0) / 2, 0.05, len / 2, (SX0 + SX1) / 2, rise / 2 - 0.03, (SZ0 + SZ1) / 2, ang);
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, len), stringer); side.position.set(SX0 + 0.03, rise / 2 - 0.1, (SZ0 + SZ1) / 2); side.rotation.x = ang; add(side);
  // railings round the hole upstairs, and up the stair
  const railM = std(0x2b2d30, 0.4, { metalness: 0.6 });
  const rail = (x0, z0, x1, z1, y0, y1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), mid = V((x0 + x1) / 2, 0, (z0 + z1) / 2), ry = Math.atan2(x1 - x0, z1 - z0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, Math.hypot(len, y1 - y0)), railM);
    top.position.set(mid.x, (y0 + y1) / 2 + 1.0, mid.z); top.rotation.set(-Math.atan2(y1 - y0, len), ry, 0, 'YXZ'); add(top, false);
    const posts = Math.ceil(len / 0.9);
    for (let i = 0; i <= posts; i++) { const t = i / posts; const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.0, 0.03), railM); p.position.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 0.5, z0 + (z1 - z0) * t); add(p, false); }
    if (y0 === y1) col(Math.abs(x1 - x0) / 2 + 0.03, 0.55, Math.abs(z1 - z0) / 2 + 0.03, mid.x, y0 + 0.55, mid.z);
  };
  rail(SX0, -67.4, SX0, SZ1, Y1, Y1);
  rail(SX0, SZ0, SX1, SZ0, Y1, Y1);
  rail(SX0, SZ0, SX0, SZ1, 0, Y1 - 0.02);
  // the forecourt outside the door
  const fc = new THREE.Mesh(new THREE.BoxGeometry(5, 0.14, 1.6), std(0xb4ada2, 0.9)); fc.position.set(0, 0.07, ZF + 0.8); add(fc); col(2.5, 0.07, 0.8, 0, 0.07, ZF + 0.8);

  // --- the lobby: mailboxes, a plant, a light
  const mail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 0.3), std(0x8a7a5a, 0.4, { metalness: 0.7 })); mail.position.set(-6, 1.4, ZF - T - 0.2); add(mail);
  for (let i = 0; i < 12; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.02), std(0x5a4c34, 0.3, { metalness: 0.8 })); d.position.set(-6.85 + (i % 6) * 0.34, 1.65 - Math.floor(i / 6) * 0.42, ZF - T - 0.36); scene.add(d); }

  // --- the first floor: a corridor, four tenants' flats and yours (small, at the front by the stair)
  //   front row (windows on the street): 1A Mrs. Okafor, 1B Dez, 1E you
  //   back row: 1C Marco, 1D June
  const F = Y1, WT = 0.12, DH = 2.1;
  const fabric = std(0x4a5a6a, 0.95), fabric2 = std(0x8a3b2e, 0.95), darkWood = std(0x3b2a1e, 0.6), lightWood = std(0xa5845e, 0.6), white = std(0xeeeae2, 0.5), steel = std(0xbfc3c7, 0.3, { metalness: 0.8 }), black = std(0x1a1a1c, 0.4);
  const green = std(0x3f6e2f, 0.9), terracotta = std(0x9a5a3a, 0.8), cream = std(0xe8dcc0, 0.9), mustard = std(0xc89a2a, 0.9), red = std(0xb8281e, 0.5);
  const ZC0 = -67.4, ZC1 = -69.6, XB = 5.0;              // the corridor (z), and the passage up from the stair (x)
  const doors = [];                                     // [x0, x1, wall z, room side (+1 front, −1 back), label]
  const door = (x0, x1, z, sd, label) => { doors.push([x0, x1, z, sd, label]); return { a0: x0, a1: x1, y0: F - 0.1, y1: F + DH }; };
  const dA = door(-5.0, -4.05, ZC0, 1, '1A'), dB = door(1.75, 2.7, ZC0, 1, '1B'), dE = door(6.1, 7.05, ZC0, 1, '1E');
  const dC = door(-4.4, -3.45, ZC1, -1, '1C'), dD = door(3.85, 4.8, ZC1, -1, '1D');
  wall('x', ZC0, X0 + T, SX0, F, Y2, [dA, dB, dE], plaster, WT);
  wall('x', ZC1, X0 + T, XB, F, Y2, [dC, dD], plaster, WT);
  const XW = -8.6; // the shared bathroom, at the end of the corridor
  wall('z', XW, ZC1, ZC0, F, Y2, [{ a0: -68.95, a1: -68.05, y0: F - 0.1, y1: F + DH }], plaster, WT);
  wall('z', XB, ZB + T, ZC1, F, Y2, [], plaster, WT);                 // 1D | the passage
  wall('z', SX0, ZC0, ZF - T, F, Y2, [], plaster, WT);                // 1E | the stairwell
  wall('z', -3.5, ZC0, ZF - T, F, Y2, [], plaster, WT);               // 1A | 1B
  wall('z', 3.5, ZC0, ZF - T, F, Y2, [], plaster, WT);                // 1B | 1E
  wall('z', -2.9, ZB + T, ZC1, F, Y2, [], plaster, WT);               // 1C | 1D
  // doors (standing open), frames and number plates
  const doorM = std(0x6a4a30, 0.6), frameM = std(0xf2eee6, 0.6);
  for (const [x0, x1, z, sd, label] of doors) {
    const leaf = boxM(0.04, DH - 0.05, x1 - x0 - 0.04, x0 + 0.04, F + (DH - 0.05) / 2, z + sd * (x1 - x0) / 2, doorM);
    for (const x of [x0 - 0.03, x1 + 0.03]) boxM(0.06, DH + 0.03, WT + 0.04, x, F + DH / 2, z, frameM, { collide: false });
    boxM(x1 - x0 + 0.12, 0.06, WT + 0.04, (x0 + x1) / 2, F + DH + 0.02, z, frameM, { collide: false });
    const tex = canvasTex(64, 32, (c, w, h) => { c.fillStyle = '#c9a14a'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a1e0a'; c.font = 'bold 22px Georgia'; c.textAlign = 'center'; c.fillText(label, w / 2, 24); });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11), new THREE.MeshStandardMaterial({ map: tex, metalness: 0.5, roughness: 0.35 }));
    plate.position.set(x1 + 0.22, F + 1.55, z - sd * (WT / 2 + 0.006)); plate.rotation.y = sd > 0 ? Math.PI : 0; scene.add(plate);
  }
  // the bathroom: white tiles, a bath, a toilet, a basin and a mirror (and its door, open)
  { const tile = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#e8ecea'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b8c0c0'; c.lineWidth = 2; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32, h); c.moveTo(0, i * 32); c.lineTo(w, i * 32); c.stroke(); } }, [3, 3]);
    const bf = new THREE.Mesh(new THREE.PlaneGeometry(XW - X0 - T, ZC0 - ZC1), std(0xffffff, 0.3, { map: tile })); bf.rotation.x = -Math.PI / 2; bf.position.set((X0 + T + XW) / 2, F + 0.009, (ZC0 + ZC1) / 2); bf.receiveShadow = true; scene.add(bf);
    const porc = std(0xf4f4f0, 0.15), tw = 0.07, bx0 = X0 + T + 0.04, bx1 = bx0 + 1.65, bz0 = ZC1 + WT / 2 + 0.02, bz1 = bz0 + 0.78, bh = 0.56, bxc = (bx0 + bx1) / 2, bzc = (bz0 + bz1) / 2;
    boxM(bx1 - bx0, 0.06, bz1 - bz0, bxc, F + 0.03, bzc, porc);
    boxM(bx1 - bx0, bh, tw, bxc, F + bh / 2, bz0 + tw / 2, porc); boxM(bx1 - bx0, bh, tw, bxc, F + bh / 2, bz1 - tw / 2, porc);
    boxM(tw, bh, bz1 - bz0, bx0 + tw / 2, F + bh / 2, bzc, porc); boxM(tw, bh, bz1 - bz0, bx1 - tw / 2, F + bh / 2, bzc, porc);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(bx1 - bx0 - 2 * tw, bz1 - bz0 - 2 * tw), new THREE.MeshPhysicalMaterial({ color: 0x9fd8e8, roughness: 0.05, transparent: true, opacity: 0.45, depthWrite: false }));
    water.rotation.x = -Math.PI / 2; water.position.set(bxc, F + bh - 0.12, bzc); scene.add(water);
    const ice = std(0xf2fbff, 0.1, { transparent: true, opacity: 0.8 });
    for (let i = 0; i < 26; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.07), ice); c.position.set(bx0 + tw + 0.05 + Math.random() * (bx1 - bx0 - 2 * tw - 0.1), F + bh - 0.12, bz0 + tw + 0.05 + Math.random() * (bz1 - bz0 - 2 * tw - 0.1)); c.rotation.set(Math.random(), Math.random() * 3, Math.random()); scene.add(c); }
    boxM(0.06, 0.25, 0.06, bx1 - 0.2, F + bh + 0.12, bz0 + 0.03, steel, { collide: false }); // (the tap)
    boxM(0.4, 0.42, 0.55, X0 + T + 0.3, F + 0.21, ZC0 - 0.45, porc); boxM(0.18, 0.45, 0.5, X0 + T + 0.12, F + 0.6, ZC0 - 0.45, porc); // (the toilet)
    boxM(0.55, 0.12, 0.42, -9.35, F + 0.85, ZC0 - 0.27, porc); boxM(0.12, 0.8, 0.12, -9.35, F + 0.4, ZC0 - 0.2, porc, { collide: false });
    { const mir = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshStandardMaterial({ color: 0xc8d8e0, roughness: 0.02, metalness: 1 })); mir.position.set(-9.35, F + 1.5, ZC0 - WT / 2 - 0.006); mir.rotation.y = Math.PI; scene.add(mir); }
    { const dl = boxM(XW - (XW - 0.88), DH - 0.05, 0.04, XW - 0.46, F + (DH - 0.05) / 2, -68.09, doorM); }
  }
  // a runner down the corridor
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(SX0 - XW - 0.6, 1.1), std(0x6a2424, 1)); runner.rotation.x = -Math.PI / 2; runner.position.set((XW + SX0) / 2, F + 0.008, (ZC0 + ZC1) / 2); runner.receiveShadow = true; scene.add(runner);
  const rugAt = (w, d, x, z, c1, c2) => { const t = canvasTex(128, 128, (c, W, H) => { c.fillStyle = c1; c.fillRect(0, 0, W, H); c.strokeStyle = c2; c.lineWidth = 6; c.strokeRect(10, 10, W - 20, H - 20); }); const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std(0xffffff, 1, { map: t })); r.rotation.x = -Math.PI / 2; r.position.set(x, F + 0.01, z); r.receiveShadow = true; scene.add(r); };
  const plant = (x, z, h = 0.9) => { boxM(0.36, 0.4, 0.36, x, F + 0.2, z, terracotta); for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.1, h, 6), green); l.position.set(x + (Math.random() - 0.5) * 0.16, F + 0.35 + h / 2, z + (Math.random() - 0.5) * 0.16); l.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6); add(l); } };
  const bed = (x, z, w, d, sheet, alongX = false) => { const W = alongX ? d : w, D = alongX ? w : d; boxM(W, 0.36, D, x, F + 0.18, z, darkWood); boxM(W - 0.08, 0.16, D - 0.08, x, F + 0.44, z, white); const du = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.07, D * 0.65), sheet); du.position.set(x, F + 0.55, z + D * 0.17); add(du); };
  const armchair = (x, z, ry, m) => { const g2 = new THREE.Group(); const p = (w, h, d, px, py, pz) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(px, py, pz); b.castShadow = b.receiveShadow = true; g2.add(b); }; p(0.8, 0.42, 0.8, 0, 0.21, 0); p(0.8, 0.5, 0.18, 0, 0.67, -0.31); p(0.16, 0.25, 0.8, -0.32, 0.55, 0); p(0.16, 0.25, 0.8, 0.32, 0.55, 0); g2.position.set(x, F, z); g2.rotation.y = ry; scene.add(g2); col(0.4, 0.4, 0.4, x, F + 0.4, z, 0, ry); };
  const poster = (x, z, ry, w, h, draw) => { const t = canvasTex(128, Math.round(128 * h / w), draw); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })); m.position.set(x, F + 1.55, z); m.rotation.y = ry; scene.add(m); };
  const lamp = (x, z) => { const fx = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2b8, emissiveIntensity: 1.4 })); fx.position.set(x, Y2 - 0.06, z); scene.add(fx); };

  // 1A: Mrs. Okafor (a retired teacher): books, a good armchair, a table always laid for guests
  bed(-9.9, -65.9, 1.4, 2.0, std(0x6a3a7a, 0.95));
  boxM(0.35, 2.0, 1.4, -10.45, F + 1.0, -62.9, darkWood);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 9; k++) boxM(0.22, 0.26 + Math.random() * 0.08, 0.1, -10.38, F + 0.32 + i * 0.45, -63.5 + k * 0.14, std([0x8a2d2d, 0x2f4f7f, 0xd8b45a, 0x3f6b3f, 0x5a3a6a][(i + k) % 5], 0.8), { collide: false });
  armchair(-8.7, -61.2, Math.PI * 0.85, fabric2);
  boxM(1.0, 0.05, 1.0, -6.4, F + 0.76, -64.4, lightWood); boxM(1.08, 0.02, 1.08, -6.4, F + 0.79, -64.4, cream, { collide: false }); col(0.5, 0.4, 0.5, -6.4, F + 0.4, -64.4);
  boxM(0.08, 0.74, 0.08, -6.4, F + 0.37, -64.4, darkWood, { collide: false });
  plant(-4.0, -61.0, 1.1); plant(-10.3, -61.0);
  rugAt(2.6, 2.0, -7.6, -63.2, '#8a5a2a', '#e8c890');
  lamp(-7, -64);
  // 1B: Dez (a musician, a night owl): a mattress on the floor, a guitar, speakers, posters
  boxM(1.5, 0.22, 2.0, -2.6, F + 0.11, -61.6, white); { const du = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.06, 1.2), std(0x2a2a3a, 0.95)); du.position.set(-2.6, F + 0.25, -61.3); add(du); }
  for (const x of [-0.6, 2.9]) boxM(0.45, 0.9, 0.4, x, F + 0.45, -60.75, black);
  { const gt = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 18), std(0xb8501e, 0.4)); body.rotation.x = Math.PI / 2; body.position.y = 0.3; gt.add(body); const body2 = body.clone(); body2.scale.set(0.8, 1, 0.8); body2.position.y = 0.55; gt.add(body2); const neck = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.03), darkWood); neck.position.y = 0.95; gt.add(neck); gt.position.set(1.2, F, -60.65); gt.rotation.x = -0.15; gt.traverse(m => m.castShadow = true); scene.add(gt); }
  boxM(1.1, 0.06, 0.32, 0.6, F + 0.8, -66.6, black); boxM(0.06, 0.78, 0.06, 0.2, F + 0.39, -66.6, steel, { collide: false }); boxM(0.06, 0.78, 0.06, 1.0, F + 0.39, -66.6, steel, { collide: false });
  { const keys = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.012, 0.12), white); keys.position.set(0.6, F + 0.836, -66.52); scene.add(keys); }
  { const bb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), mustard); bb.scale.y = 0.6; bb.position.set(-1.0, F + 0.25, -64.6); add(bb); col(0.38, 0.25, 0.38, -1.0, F + 0.25, -64.6); }
  poster(-3.43, -63.5, Math.PI / 2, 0.8, 1.1, (c, w, h) => { c.fillStyle = '#1a1030'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff3a7a'; c.font = 'bold 22px Arial'; c.fillText('DEZ', 40, 50); c.fillStyle = '#4ad8ff'; c.font = 'bold 13px Arial'; c.fillText('LIVE AT THE', 20, 80); c.fillText('NIGHTCLUB', 25, 98); c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(64, 140, 24, 0, 7); c.fill(); });
  poster(3.43, -64.0, -Math.PI / 2, 0.9, 0.6, (c, w, h) => { c.fillStyle = '#e8e0c8'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; c.font = 'bold 18px Georgia'; c.fillText('HALYARD', 14, 40); c.font = '11px Georgia'; c.fillText('summer tour', 30, 62); });
  lamp(0, -63.5);
  // 1C: Marco (a mechanic): a workbench, tyres, a red toolbox, an old sofa, the game on
  boxM(2.4, 0.9, 0.7, -7.8, F + 0.45, ZB + T + 0.38, std(0x6a5a48, 0.8)); boxM(2.4, 0.05, 0.72, -7.8, F + 0.92, ZB + T + 0.38, steel);
  boxM(2.4, 0.9, 0.04, -7.8, F + 1.6, ZB + T + 0.04, std(0x8a8070, 0.9), { collide: false }); // (a pegboard)
  for (let i = 0; i < 3; i++) { const ty = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 8, 18), black); ty.rotation.x = Math.PI / 2; ty.position.set(-10.1, F + 0.12 + i * 0.24, -74.9); add(ty); }
  col(0.42, 0.36, 0.42, -10.1, F + 0.36, -74.9);
  boxM(0.7, 0.55, 0.4, -5.9, F + 0.275, -75.3, red);
  boxM(0.9, 0.42, 2.2, -10.1, F + 0.21, -71.6, std(0x5a4a3a, 0.95)); boxM(0.25, 0.85, 2.2, -10.45, F + 0.42, -71.6, std(0x5a4a3a, 0.95));
  boxM(0.45, 0.5, 1.4, -4.0, F + 0.25, -71.8, darkWood); boxM(0.06, 0.7, 1.2, -4.0, F + 0.85, -71.8, black);
  { const t = canvasTex(256, 144, (c, w, h) => { c.fillStyle = '#2a6a2a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(10, 10, w - 20, h - 20); c.beginPath(); c.moveTo(w / 2, 10); c.lineTo(w / 2, h - 10); c.stroke(); c.fillStyle = '#000a'; c.fillRect(0, 0, 110, 22); c.fillStyle = '#fff'; c.font = 'bold 14px Arial'; c.fillText('HAL 2 - 1 PHY', 6, 16); }); const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.62), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.8 })); sc.position.set(-4.04, F + 0.85, -71.8); sc.rotation.y = -Math.PI / 2; scene.add(sc); }
  rugAt(2.0, 2.4, -7.6, -71.8, '#3a4a5a', '#8a9aaa');
  lamp(-7, -72.5);
  // 1D: June (knows everyone's business): an armchair facing the door, knitting, plants, the cat
  bed(-1.9, -71.4, 1.4, 2.0, std(0x9ab8d8, 0.95));
  armchair(1.6, -74.6, 0, std(0x7a8a5a, 0.95));
  boxM(0.5, 0.55, 0.5, 2.6, F + 0.275, -74.9, lightWood);
  { const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), std(0xd84a8a, 1)); ball.position.set(2.55, F + 0.63, -74.9); scene.add(ball); }
  boxM(1.6, 0.9, 0.45, 0.0, F + 0.45, ZB + T + 0.25, darkWood);
  for (let i = 0; i < 4; i++) boxM(0.18, 0.24, 0.03, -0.55 + i * 0.36, F + 1.02, ZB + T + 0.3, std(0xc9a14a, 0.4, { metalness: 0.6 }), { collide: false });
  plant(4.6, -75.3, 1.2); plant(-2.5, -75.3); plant(4.6, -73.0, 0.7);
  { const cat = new THREE.Group(), fur = std(0xd8823a, 0.9); const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), fur); b.scale.set(1.4, 0.7, 1); cat.add(b); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), fur); hd.position.set(0.22, 0.02, 0.05); cat.add(hd); for (const z of [0, 0.1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), fur); ear.position.set(0.24, 0.1, z); cat.add(ear); } const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), fur); tail.rotation.set(0, 0, 1.3); tail.position.set(-0.22, -0.05, 0.12); cat.add(tail); cat.position.set(-1.9, F + 0.68, -71.9); cat.rotation.y = 0.6; cat.traverse(m => m.castShadow = true); scene.add(cat); }
  rugAt(2.2, 1.8, 1.0, -72.6, '#a84a3a', '#f2d8a8');
  lamp(1, -72.5);
  // 1E: yours. Small: a single bed under the window, a desk, a wardrobe, a mini fridge, the rack
  bed(6.65, -61.4, 0.95, 2.0, fabric2);
  boxM(0.45, 0.5, 0.4, 6.75, F + 0.25, -62.75, lightWood);
  boxM(0.6, 0.05, 1.2, 3.9, F + 0.75, -62.0, lightWood); for (const dz of [-0.55, 0.55]) boxM(0.56, 0.73, 0.04, 3.9, F + 0.365, -62.0 + dz, lightWood, { collide: false }); col(0.3, 0.38, 0.6, 3.9, F + 0.38, -62.0);
  let tvScreen = null;
  const tvC = document.createElement('canvas'); tvC.width = 256; tvC.height = 160;
  const tvTex = new THREE.CanvasTexture(tvC); tvTex.colorSpace = THREE.SRGBColorSpace;
  const tvDraw = (news) => { const c = tvC.getContext('2d'), w = tvC.width, h = tvC.height; const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, news ? '#3a1d1d' : '#1d3b5a'); gr.addColorStop(1, '#0b1520'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    if (news) { c.fillStyle = '#29b6ff'; c.beginPath(); c.arc(70, 66, 30, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 18px Arial'; c.fillText('BREAKING', 120, 50); c.font = '13px Arial'; c.fillText('Blue substance:', 120, 72); c.fillText('second overdose', 120, 90); }
    c.fillStyle = '#d8312b'; c.fillRect(0, h - 28, w, 28); c.fillStyle = '#fff'; c.font = 'bold 15px Arial'; c.fillText(news ? 'CHANNEL 6 · POLICE APPEAL FOR INFORMATION' : 'CHANNEL 6 · HALYARD', 6, h - 9); tvTex.needsUpdate = true; };
  tvDraw(false);
  boxM(0.04, 0.4, 0.62, 3.65, F + 1.0, -62.0, black); { const t = tvTex; const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.36), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9 })); sc.position.set(3.675, F + 1.0, -62.0); sc.rotation.y = Math.PI / 2; sc.userData.dynamic = true; scene.add(sc); tvScreen = sc; }
  boxM(0.6, 2.0, 1.0, 3.85, F + 1.0, -64.4, darkWood);
  boxM(0.55, 0.85, 0.55, 3.85, F + 0.425, -65.6, steel);
  rugAt(1.6, 2.2, 5.3, -64.2, '#7a3b2e', '#d9c39a');
  lamp(5.3, -64);
  // last night: cups, bottles, a pizza box, a lamp knocked over (shown by the story); your clothes on the bed
  const mess = new THREE.Group(); mess.visible = false; scene.add(mess);
  { const cupM = std(0xc8202a, 0.5), bottleM = std(0x2d6a3a, 0.15, { transparent: true, opacity: 0.85 }), boxC = std(0xd8c8a0, 0.9);
    const put = (m, x, y, z, rx = 0, rz = 0) => { m.position.set(x, F + y, z); m.rotation.set(rx, Math.random() * 6, rz); m.castShadow = true; mess.add(m); };
    for (const [x, z, down] of [[4.4, -63.0, 1], [5.6, -65.4, 0], [6.1, -64.0, 1], [4.2, -61.4, 0], [5.0, -62.2, 1], [6.5, -65.9, 0]]) put(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.11, 10), cupM), x, down ? 0.045 : 0.055 + (x < 4.3 ? 0.73 : 0), z, down ? Math.PI / 2 : 0);
    for (const [x, z, down] of [[4.8, -64.8, 1], [6.8, -62.8, 0], [3.95, -61.7, 0]]) put(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.28, 10), bottleM), x, down ? 0.04 : 0.14 + (x > 6.7 ? 0.5 : x < 4 ? 0.73 : 0), z, down ? Math.PI / 2 : 0);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), boxC), 5.4, 0.02, -63.4);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.3), std(0xc8b020, 0.6)), 4.9, 0.01, -61.9);
    { const shadeM = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.26, 14, 1, true), std(0xf2e6c8, 0.8, { side: THREE.DoubleSide })); put(shadeM, 6.0, 0.13, -66.4, 0, Math.PI / 2); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 6), black); put(pole, 6.5, 0.03, -65.8, 0, Math.PI / 2); pole.rotation.y = 0.4; } }
  // Wren's mattress on your floor (once he's moved in)
  const wrenBed = new THREE.Group(); wrenBed.visible = false; scene.add(wrenBed);
  { const m = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.16, 1.9), white); m.position.set(5.15, F + 0.08, -61.45); m.castShadow = m.receiveShadow = true; wrenBed.add(m);
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.05, 1.2), std(0x6a7a4a, 0.95)); d.position.set(5.15, F + 0.18, -61.2); wrenBed.add(d);
    const pw = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.3), std(0xe8e0d0, 1)); pw.position.set(5.15, F + 0.21, -62.2); wrenBed.add(pw); }
  const clothes = new THREE.Group(); clothes.visible = false; scene.add(clothes);
  { const hoodie = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.45), std(0x2b2f36, 1)); hoodie.position.set(6.6, F + 0.62, -61.9); hoodie.rotation.y = 0.3; clothes.add(hoodie);
    const jeans = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.7), std(0x3a4a5e, 1)); jeans.position.set(6.7, F + 0.6, -61.2); jeans.rotation.y = -0.2; clothes.add(jeans);
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0x2c3036, 1)); hat.position.set(6.45, F + 0.66, -61.55); clothes.add(hat);
    for (const dx of [-0.08, 0.08]) { const sh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.26), black); sh.position.set(6.0 + dx, F + 0.04, -61.3); clothes.add(sh); } }
  // the corridor (and the bathroom)
  lamp(-9.6, (ZC0 + ZC1) / 2); lamp(-6, (ZC0 + ZC1) / 2); lamp(1, (ZC0 + ZC1) / 2); lamp(6, -73.5);

  // (the room lights that follow you indoors: one record per flat, the corridor, the lobby)
  const wp = (x, y, z) => V(x + DX, y, z + DZ), ring = [[X0 + DX, ZF + DZ], [X1 + DX, ZF + DZ], [X1 + DX, ZB + DZ], [X0 + DX, ZB + DZ]];
  const rect = (x0, z0, x1, z1) => [[x0 + DX, z0 + DZ], [x1 + DX, z0 + DZ], [x1 + DX, z1 + DZ], [x0 + DX, z1 + DZ]];
  g.rooms = g.rooms || [];
  const flat = (name, x0, z0, x1, z1, lx, lz) => g.rooms.push({ kind: 'home', name, ring: rect(x0, z0, x1, z1), y0: Y1 - 0.3, y1: Y2 + 0.2, lights: [wp(lx, Y2 - 0.6, lz)], tint: 0xffd7a8, power: 9 });
  flat('your room', 3.5, ZF, SX0, ZC0, 5.3, -64);
  flat('the bathroom', X0, ZC0, XW, ZC1, -9.6, (ZC0 + ZC1) / 2);
  flat("Mrs. Okafor's", X0, ZF, -3.5, ZC0, -7, -64);
  flat("Dez's", -3.5, ZF, 3.5, ZC0, 0, -63.5);
  flat("Marco's", X0, ZC1, -2.9, ZB, -7, -72.5);
  flat("June's", -2.9, ZC1, XB, ZB, 1, -72.5);
  g.rooms.push({ kind: 'home', name: 'the corridor', ring: [[X0 + DX, ZC0 + DZ], [X1 + DX, ZC0 + DZ], [X1 + DX, ZB + DZ], [XB + DX, ZB + DZ], [XB + DX, ZC1 + DZ], [X0 + DX, ZC1 + DZ]], y0: Y1 - 0.3, y1: Y2 + 0.2, lights: [wp(-3, Y2 - 0.6, (ZC0 + ZC1) / 2), wp(6.5, Y2 - 0.6, -73)], tint: 0xffe0b8, power: 10 });
  g.rooms.push({ kind: 'home', name: 'the lobby', ring, y0: -1, y1: Y1 - 0.3, lights: [wp(0, Y1 - 0.8, -64), wp(0, Y1 - 0.8, -71)], tint: 0xffe0b8, power: 12 });

  // --- things you can pick up (in your room)
  const P = g.props;
  const prop = (mesh, desc, x, y, z, name, ry = 0) => P.add(mesh, desc, V(x + DX, y, z + DZ), name, ry);
  prop(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 14), std(0x2f4f7f, 0.4)), R.ColliderDesc.cylinder(0.05, 0.045).setDensity(700), 3.95, F + 0.83, -61.6, 'a mug');
  for (let i = 0; i < 3; i++) prop(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.23), std([0x8a2d2d, 0x2f4f7f, 0xd8b45a][i], 0.8)), R.ColliderDesc.cuboid(0.08, 0.0175, 0.115).setDensity(600), 4.0, F + 0.8 + i * 0.04, -62.45, 'a book', i * 0.3);
  for (let i = 0; i < 2; i++) prop(new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 12), std([0xc8202a, 0x2a6ac8][i], 0.3, { metalness: 0.7 })), R.ColliderDesc.cylinder(0.06, 0.033).setDensity(800), 3.8 + i * 0.12, F + 0.92, -65.6, 'a can');
  prop(new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), std(0xd8682a, 0.7)), R.ColliderDesc.ball(0.12).setDensity(80).setRestitution(0.75), 5.6, F + 0.2, -63.2, 'a basketball');
  prop(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.35), std(0xd8c4a0, 1)), R.ColliderDesc.cuboid(0.25, 0.07, 0.175).setDensity(60), 6.65, F + 0.65, -60.7, 'a pillow', 0.1);
  P.addCone(V(6.7 + DX, F, -63.6 + DZ)); // (don't ask)
  const cardT = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#b48a5a'; c.fillRect(0, 0, w, h); c.fillStyle = '#d9c8a0'; c.fillRect(0, h / 2 - 8, w, 16); c.fillStyle = '#5a3a1e'; c.font = 'bold 14px Arial'; c.fillText('STUFF', 38, 40); });
  for (const [x, y, z, s] of [[4.0, 0.22, -66.75, 0.44], [4.0, 0.62, -66.75, 0.36]]) prop(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), std(0xffffff, 0.9, { map: cardT })), R.ColliderDesc.cuboid(s / 2, s / 2, s / 2).setDensity(120), x, F + y, z, 'a box');

  // --- a small dresser against your room's back wall (the top drawer: a butter knife, all you've got)
  g.weapons.buildDrawer(V(5.4 + DX, F, ZC0 + WT / 2 + 0.25 + DZ), 0);

  g.places = g.places || {};
  return {
    spawn: V(5.1 + DX, F + 0.05, -65.9 + DZ), spawnYaw: Math.PI, // (in your room, facing the dresser)
    door: V(DX, 0, ZF + 1.2 + DZ),
    // the story's places: the bath (where you wake up), the clothes on your bed, the TV, a step on the stair
    bath: { pos: V(X0 + T + 0.75 + DX, F + 0.06, ZC1 + WT / 2 + 0.41 + DZ), yaw: Math.PI / 2, out: V(-9.2 + DX, F + 0.05, -68.4 + DZ) },
    clothes: V(6.4 + DX, F + 0.05, -62.0 + DZ), clothesMesh: clothes, wrenBed, wrenSpot: V(5.0 + DX, F + 0.05, -63.6 + DZ), wrenYaw: 0, mess, tvDraw, tvC, tvTex, get tvScreen() { return tvScreen; }, room1E: V(5.3 + DX, F + 0.05, -64 + DZ),
    stairStep: (i) => V((SX0 + SX1) / 2 + DX, (i + 1) * Y1 / 24, SZ0 - (i + 0.5) * (SZ0 - SZ1) / 24 + DZ),
    // the neighbours: where each of them stands in their flat, and which way they face
    tenants: [
      { id: 'okafor', pos: V(-7.0 + DX, F + 0.05, -62.6 + DZ), yaw: Math.PI },
      { id: 'dez', pos: V(0.4 + DX, F + 0.05, -63.8 + DZ), yaw: Math.PI },
      { id: 'marco', pos: V(-6.6 + DX, F + 0.05, -72.6 + DZ), yaw: 0 },
      { id: 'june', pos: V(1.4 + DX, F + 0.05, -73.2 + DZ), yaw: 0 },
    ],
    inside: (p) => p.x - DX > X0 && p.x - DX < X1 && p.z - DZ < ZF && p.z - DZ > ZB && p.y < Y2,
  };
}
