// Your building, in Fairview Heights: a lobby, a stair, and a loft apartment on the first floor with
// real windows, furniture, things to pick up and a weapon rack. (Laid out at x = 0, front at z = −60,
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
  rail(SX0, SZ0, SX0, SZ1, Y1, Y1);
  rail(SX0, SZ0, SX1, SZ0, Y1, Y1);
  rail(SX0, SZ0, SX0, SZ1, 0, Y1 - 0.02);
  // the forecourt outside the door
  const fc = new THREE.Mesh(new THREE.BoxGeometry(5, 0.14, 1.6), std(0xb4ada2, 0.9)); fc.position.set(0, 0.07, ZF + 0.8); add(fc); col(2.5, 0.07, 0.8, 0, 0.07, ZF + 0.8);

  // --- the lobby: mailboxes, a plant, a light
  const mail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 0.3), std(0x8a7a5a, 0.4, { metalness: 0.7 })); mail.position.set(-6, 1.4, ZF - T - 0.2); add(mail);
  for (let i = 0; i < 12; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.02), std(0x5a4c34, 0.3, { metalness: 0.8 })); d.position.set(-6.85 + (i % 6) * 0.34, 1.65 - Math.floor(i / 6) * 0.42, ZF - T - 0.36); scene.add(d); }

  // --- the apartment
  const F = Y1;
  const fabric = std(0x4a5a6a, 0.95), fabric2 = std(0x8a3b2e, 0.95), darkWood = std(0x3b2a1e, 0.6), lightWood = std(0xa5845e, 0.6), white = std(0xeeeae2, 0.5), steel = std(0xbfc3c7, 0.3, { metalness: 0.8 }), black = std(0x1a1a1c, 0.4);
  // living room (front left)
  const rugT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#7a3b2e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d9c39a'; c.lineWidth = 8; c.strokeRect(14, 14, w - 28, h - 28); c.lineWidth = 3; c.strokeRect(34, 34, w - 68, h - 68); for (let i = 0; i < 2000; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), std(0xffffff, 1, { map: rugT })); rug.rotation.x = -Math.PI / 2; rug.position.set(-6, F + 0.01, -64.5); rug.receiveShadow = true; scene.add(rug);
  // sofa (facing the TV on the west wall)
  boxM(0.9, 0.42, 2.4, -3.3, F + 0.21, -64.5, fabric);
  boxM(0.25, 0.85, 2.4, -2.95, F + 0.42, -64.5, fabric);
  for (const dz of [-1.3, 1.3]) boxM(0.9, 0.62, 0.2, -3.3, F + 0.31, -64.5 + dz, fabric);
  boxM(0.7, 0.4, 1.3, -5.6, F + 0.2, -64.5, lightWood); // coffee table
  // TV unit and TV
  boxM(0.45, 0.5, 2.0, X0 + T + 0.3, F + 0.25, -64.5, darkWood);
  const tv = boxM(0.06, 0.75, 1.3, X0 + T + 0.3, F + 0.98, -64.5, black);
  const screenT = canvasTex(256, 144, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1d3b5a'); gr.addColorStop(1, '#0b1520'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#d8312b'; c.fillRect(0, h - 30, w, 30); c.fillStyle = '#fff'; c.font = 'bold 15px Arial'; c.fillText('CHANNEL 6  ·  HALYARD: LOCKDOWN LIFTED, QUESTIONS REMAIN', 6, h - 10); c.font = 'bold 26px Arial'; c.fillText('BREAKING', 14, 44); });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.68), new THREE.MeshStandardMaterial({ map: screenT, emissive: 0xffffff, emissiveMap: screenT, emissiveIntensity: 0.9 }));
  screen.position.set(X0 + T + 0.34, F + 0.98, -64.5); screen.rotation.y = Math.PI / 2; scene.add(screen);
  // bookshelf (west wall, by the window)
  boxM(0.35, 2.0, 1.6, X0 + T + 0.22, F + 1.0, -61.7, darkWood);
  // a floor lamp and a plant
  boxM(0.04, 1.6, 0.04, -2.7, F + 0.8, -62.9, black, { collide: false });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.3, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xf2e6c8, emissive: 0xffd8a0, emissiveIntensity: 0.6, side: THREE.DoubleSide })); shade.position.set(-2.7, F + 1.65, -62.9); scene.add(shade);
  const pot = boxM(0.4, 0.45, 0.4, -9.8, F + 0.225, -67.6, std(0x9a5a3a, 0.8));
  for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 6), std(0x3f6e2f, 0.9)); l.position.set(-9.8 + (Math.random() - 0.5) * 0.2, F + 0.85, -67.6 + (Math.random() - 0.5) * 0.2); l.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6); add(l); }
  // kitchen along the back wall (left)
  boxM(6.0, 0.9, 0.65, -7.3, F + 0.45, ZB + T + 0.35, white);
  boxM(6.0, 0.05, 0.7, -7.3, F + 0.925, ZB + T + 0.35, std(0x2b2b2b, 0.3));
  boxM(6.0, 0.7, 0.4, -7.3, F + 2.0, ZB + T + 0.22, white);
  boxM(0.85, 1.9, 0.75, -3.75, F + 0.95, ZB + T + 0.4, steel); // fridge
  boxM(0.6, 0.03, 0.5, -6.0, F + 0.96, ZB + T + 0.35, black, { collide: false }); // hob
  for (const [dx, dz] of [[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.12], [0.14, 0.12]]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 16), steel); r.rotation.x = Math.PI / 2; r.position.set(-6.0 + dx, F + 0.98, ZB + T + 0.35 + dz); scene.add(r); }
  const sink = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.42), steel); sink.position.set(-8.6, F + 0.955, ZB + T + 0.35); scene.add(sink);
  // dining table
  boxM(1.4, 0.05, 0.9, -6, F + 0.76, -70.2, lightWood);
  for (const [dx, dz] of [[-0.6, -0.38], [0.6, -0.38], [-0.6, 0.38], [0.6, 0.38]]) boxM(0.05, 0.74, 0.05, -6 + dx, F + 0.37, -70.2 + dz, darkWood, { collide: false });
  col(0.7, 0.4, 0.45, -6, F + 0.4, -70.2);
  // bedroom corner (front right): bed, nightstand, wardrobe
  boxM(1.7, 0.4, 2.2, 3.4, F + 0.2, -63.8, darkWood);
  boxM(1.6, 0.18, 2.1, 3.4, F + 0.49, -63.8, white);
  boxM(1.7, 0.9, 0.1, 3.4, F + 0.45, -62.65, darkWood);
  const duvet = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.08, 1.4), fabric2); duvet.position.set(3.4, F + 0.61, -64.3); add(duvet);
  boxM(0.5, 0.55, 0.45, 1.9, F + 0.275, -62.95, lightWood);
  boxM(0.6, 2.1, 1.8, 6.6, F + 1.05, -66.3, lightWood);
  // a partition between the bedroom and the rest, half-height glass blocks
  boxM(4.0, 1.1, 0.15, 3.0, F + 0.55, -66.1, std(0xd8e2e6, 0.2, { transparent: true, opacity: 0.6 }));
  // ceiling lights (warm), fixtures
  for (const [x, z] of [[-5.5, -65], [-5.5, -71.5], [3, -70]]) {
    const fx = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2b8, emissiveIntensity: 1.4 })); fx.position.set(x, Y2 - 0.06, z); scene.add(fx);
  }
  // (the room lights that follow you indoors light these two rooms too)
  const wp = (x, y, z) => V(x + DX, y, z + DZ), ring = [[X0 + DX, ZF + DZ], [X1 + DX, ZF + DZ], [X1 + DX, ZB + DZ], [X0 + DX, ZB + DZ]];
  g.rooms = g.rooms || [];
  g.rooms.push({ kind: 'home', name: 'your apartment', ring, y0: Y1 - 0.3, y1: Y2 + 0.2, lights: [wp(-5.5, Y2 - 0.6, -67), wp(3, Y2 - 0.6, -70)], tint: 0xffd7a8, power: 16 });
  g.rooms.push({ kind: 'home', name: 'the lobby', ring, y0: -1, y1: Y1 - 0.3, lights: [wp(0, Y1 - 0.8, -64), wp(0, Y1 - 0.8, -71)], tint: 0xffe0b8, power: 12 });

  // --- things you can pick up
  const P = g.props;
  const prop = (mesh, desc, x, y, z, name, ry = 0) => P.add(mesh, desc, V(x + DX, y, z + DZ), name, ry);
  const mug = (x, z, c) => prop(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 14), std(c, 0.4)), R.ColliderDesc.cylinder(0.05, 0.045).setDensity(700), x, F + 0.84, z, 'a mug');
  mug(-6.3, -70.0, 0xd8d2c4); mug(-5.7, -70.4, 0x2f4f7f);
  prop(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.3, 12), std(0x2d6a3a, 0.15, { transparent: true, opacity: 0.85 })), R.ColliderDesc.cylinder(0.15, 0.04).setDensity(500), -5.8, F + 0.94, -69.95, 'a bottle');
  for (let i = 0; i < 4; i++) prop(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.23), std([0x8a2d2d, 0x2f4f7f, 0xd8b45a, 0x3f6b3f][i], 0.8)), R.ColliderDesc.cuboid(0.08, 0.0175, 0.115).setDensity(600), -5.6, F + 0.42 + i * 0.04, -64.4 + (i % 2) * 0.05, 'a book', i * 0.3);
  prop(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.07), std(0xe8b23a, 0.7)), R.ColliderDesc.cuboid(0.1, 0.15, 0.035).setDensity(300), -7.9, F + 1.1, ZB + T + 0.4, 'a cereal box');
  for (let i = 0; i < 3; i++) prop(new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 12), std([0xc8202a, 0x2a6ac8, 0xd8d8d8][i], 0.3, { metalness: 0.7 })), R.ColliderDesc.cylinder(0.06, 0.033).setDensity(800), -9 + i * 0.12, F + 1.02, ZB + T + 0.4, 'a can');
  // apples in a bowl
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std(0xd8d2c4, 0.5, { side: THREE.DoubleSide })); bowl.position.set(-6.4, F + 0.94, -70.4); scene.add(bowl);
  for (let i = 0; i < 3; i++) prop(new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), std(0xb82a1e, 0.5)), R.ColliderDesc.ball(0.04).setDensity(800), -6.45 + i * 0.05, F + 0.9 + i * 0.05, -70.4, 'an apple');
  // moving boxes by the stair, a chair, a pillow, a ball, a pan, a cone (don't ask)
  const cardT = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#b48a5a'; c.fillRect(0, 0, w, h); c.fillStyle = '#d9c8a0'; c.fillRect(0, h / 2 - 8, w, 16); c.fillStyle = '#5a3a1e'; c.font = 'bold 14px Arial'; c.fillText('KITCHEN', 30, 40); });
  const cardM = std(0xffffff, 0.9, { map: cardT });
  for (const [x, y, z, s] of [[5.6, 0.25, -72.8, 0.5], [5.6, 0.75, -72.8, 0.45], [4.9, 0.2, -73.0, 0.4], [5.1, 0.6, -73.1, 0.32]]) prop(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), cardM), R.ColliderDesc.cuboid(s / 2, s / 2, s / 2).setDensity(120), x, F + y, z, 'a box');
  {
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.45), lightWood); seat.position.y = 0; chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.05), lightWood); back.position.set(0, 0.27, -0.2); chair.add(back);
    for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), darkWood); l.position.set(dx, -0.24, dz); chair.add(l); }
    chair.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    const d = R.ColliderDesc.cuboid(0.225, 0.24, 0.225).setTranslation(0, -0.03, 0).setDensity(160);
    prop(chair, d, -6, F + 0.5, -71.1, 'a chair', 0);
    const chair2 = chair.clone(); prop(chair2, R.ColliderDesc.cuboid(0.225, 0.24, 0.225).setTranslation(0, -0.03, 0).setDensity(160), -6, F + 0.5, -69.3, 'a chair', Math.PI);
  }
  prop(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.35), std(0xd8c4a0, 1)), R.ColliderDesc.cuboid(0.25, 0.07, 0.175).setDensity(60), -3.3, F + 0.5, -63.8, 'a cushion', 0.3);
  prop(new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), std(0xd8682a, 0.7)), R.ColliderDesc.ball(0.12).setDensity(80).setRestitution(0.75), -4.5, F + 0.2, -67.5, 'a basketball');
  prop(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 18), black), R.ColliderDesc.cylinder(0.025, 0.12).setDensity(1500), -6.0, F + 1.0, ZB + T + 0.35, 'a pan');
  {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 14), std(0xff6a1a, 0.6)); cone.geometry.translate(0, 0, 0);
    prop(cone, R.ColliderDesc.cone(0.25, 0.16).setDensity(200), 1.2, F + 0.26, -72.5, 'a traffic cone');
  }

  // --- the weapon rack (on the back wall, by the top of the stair)
  g.weapons.buildRack(V(3.4 + DX, F + 1.45, ZB + T + 0.06 + DZ), 0);

  g.places = g.places || {};
  return {
    spawn: V(3.4 + DX, F + 0.05, -72.6 + DZ), spawnYaw: Math.PI, // facing the rack
    door: V(DX, 0, ZF + 1.2 + DZ),
    inside: (p) => p.x - DX > X0 && p.x - DX < X1 && p.z - DZ < ZF && p.z - DZ > ZB && p.y < Y2,
  };
}
