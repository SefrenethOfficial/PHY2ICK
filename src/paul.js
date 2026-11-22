import * as THREE from 'three';
// Paul Badfella, attorney at law (the island's lawyer: "Got a problem? PAUL BADFELLA."). A loud teal suit, a pink
// shirt, a gold tie, a gold pocket square, a side-parted comb-over and a grin. Not in the story yet.
export const PAUL_LOOK = {
  female: false, height: 1.72, build: 1.06,
  skin: 0xe6b694, hair: 0x6a4428, hairStyle: 'side',
  shirt: 0x1f8a8c, longSleeves: true, pants: 0x1f8a8c, shoes: 0x3a2618,
  suit: { shirt: 0xf3a6b8, tie: 0xe2b232, square: 0xe2b232 },
};

// ---------------------------------------------------------------------------------------------------------
// His office (on Town Square), dressed up as cheaply and loudly as possible; his billboards round the island;
// the inflatable tube men; his TV advert (drawn on any canvas, frame by frame).
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const std = (color, roughness = 0.6, o = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...o });
const dyn = (m) => { m.userData.dynamic = true; m.traverse?.(o => { o.userData.dynamic = true; }); return m; };

let boardTex = null;
export function billboardTex() {
  if (boardTex) return boardTex;
  const t = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'paul-billboard.jpg'); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (boardTex = t);
}
const canvasT = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

// a billboard: 2:1, on two steel legs (from y0), facing yaw; lit from below at night
export function billboard(g, x, y0, z, yaw, width = 12, legs = 5) {
  const { scene, world, R } = g, h = width / 2, G = new THREE.Group(); G.position.set(x, y0, z); G.rotation.y = yaw; scene.add(G);
  const steel = std(0x3a3e44, 0.5, { metalness: 0.7 });
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, legs + h / 2, 0.35), steel); leg.position.set(s * width * 0.3, (legs + h / 2) / 2, -0.25); leg.castShadow = true; G.add(leg); }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, h + 0.4, 0.3), steel); frame.position.set(0, legs + h / 2, -0.2); frame.castShadow = true; G.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, h), new THREE.MeshStandardMaterial({ map: billboardTex(), roughness: 0.7, emissive: 0xffffff, emissiveMap: billboardTex(), emissiveIntensity: 0.18 }));
  face.position.set(0, legs + h / 2, -0.04); G.add(face);
  const walk = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.8), steel); walk.position.set(0, legs - 0.1, 0.25); G.add(walk);
  for (const s of [-0.33, 0, 0.33]) { const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), std(0xfff2cc, 0.3, { emissive: 0xfff2cc, emissiveIntensity: 0.8 })); lamp.position.set(s * width, legs - 0.05, 0.7); G.add(lamp); }
  G.updateMatrixWorld(true);
  for (const s of [-1, 1]) { const p = V(s * width * 0.3, 0, -0.25).applyMatrix4(G.matrixWorld); world.createCollider(R.ColliderDesc.cuboid(0.2, (legs + h) / 2, 0.2).setTranslation(p.x, y0 + (legs + h) / 2, p.z)); }
  return G;
}

// the office's front: columns, a marquee with bulbs, OPEN 24/7, a banner, bunting, tube men; billboards round the island
export function dressPaul(g) {
  const o = g.paulOffice, lot = g.paulLot; if (!o || !lot) return;
  const { scene } = g, [ox0, oz0, ox1, oz1] = lot, fx = ox1, cz = (oz0 + oz1) / 2, out = V(1, 0, 0);
  const white = std(0xf6f2e8, 0.5), gold = std(0xd8a92e, 0.3, { metalness: 0.8 });
  // fake columns either side of the door
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 4.0, 18), white); c.position.set(fx + 0.6, 2.0, cz + s * 2.0); c.castShadow = true; scene.add(c);
    for (const y of [0.1, 3.95]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.9), white); b.position.set(fx + 0.6, y, cz + s * 2.0); scene.add(b); }
  }
  const ped = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 5.4), white); ped.position.set(fx + 0.6, 4.2, cz); scene.add(ped);
  // the marquee: gold letters on red, bulbs all round (they chase)
  const mq = canvasT(1024, 256, (c, w, h) => { c.fillStyle = '#b8202a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e8c46a'; c.lineWidth = 14; c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#ffe08a'; c.textAlign = 'center'; c.font = 'bold 110px Georgia'; c.fillText('PAUL BADFELLA', w / 2, 128); c.font = 'italic bold 52px Georgia'; c.fillStyle = '#fff'; c.fillText('Attorney at Law · Se Habla Lawyer', w / 2, 205); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshStandardMaterial({ map: mq, emissive: 0xffffff, emissiveMap: mq, emissiveIntensity: 0.45 }));
  sign.position.set(fx + 0.32, 5.6, cz); sign.rotation.y = Math.PI / 2; scene.add(sign);
  const bulbs = []; const bm = () => new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffd060, emissiveIntensity: 1.5 });
  for (let i = 0; i < 40; i++) { const t = i / 40, per = 2 * (9 + 2.25), d = t * per; let zz, yy; if (d < 9) { zz = -4.5 + d; yy = 6.8; } else if (d < 11.25) { zz = 4.5; yy = 6.8 - (d - 9); } else if (d < 20.25) { zz = 4.5 - (d - 11.25); yy = 4.4; } else { zz = -4.5; yy = 4.4 + (d - 20.25); }
    const b = dyn(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bm())); b.position.set(fx + 0.4, yy, cz + zz); scene.add(b); bulbs.push(b); }
  // OPEN 24/7 in red neon (it flickers), a banner, a sandwich board
  const neonT = canvasT(512, 160, (c, w, h) => { c.fillStyle = '#120406'; c.fillRect(0, 0, w, h); c.shadowColor = '#ff2a3a'; c.shadowBlur = 24; c.strokeStyle = '#ff5a6a'; c.lineWidth = 5; c.font = 'bold 92px Arial'; c.textAlign = 'center'; c.strokeText('OPEN 24/7', w / 2, 112); });
  const neon = dyn(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshStandardMaterial({ map: neonT, emissive: 0xffffff, emissiveMap: neonT, emissiveIntensity: 1.2 })));
  neon.position.set(fx + 0.33, 2.4, cz - 4.6); neon.rotation.y = Math.PI / 2; scene.add(neon);
  const banT = canvasT(1024, 192, (c, w, h) => { c.fillStyle = '#ffe14a'; c.fillRect(0, 0, w, h); c.fillStyle = '#b8202a'; c.font = 'bold 96px Impact, Arial Black, sans-serif'; c.textAlign = 'center'; c.fillText('FREE CONSULTATION*', w / 2, 120); c.font = 'bold 30px Arial'; c.fillStyle = '#2a1a0a'; c.fillText('*CONSULTATION NOT FREE', w / 2, 170); });
  const ban = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), new THREE.MeshStandardMaterial({ map: banT, side: THREE.DoubleSide })); ban.position.set(fx + 0.34, 3.1, cz + 5.6); ban.rotation.y = Math.PI / 2; scene.add(ban);
  { const sbT = canvasT(256, 384, (c, w, h) => { c.fillStyle = '#1a1a1a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 30px Comic Sans MS, Arial'; ['ARRESTED?', 'ACCUSED?', 'ACCIDENTALLY', 'DID A CRIME?', '', 'COME IN!!', 'walk-ins', 'welcome'].forEach((l, i) => c.fillText(l, w / 2, 50 + i * 42)); });
    for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), new THREE.MeshStandardMaterial({ map: sbT, side: THREE.DoubleSide })); b.position.set(fx + 3.6 + s * 0.22, 0.6, cz + 3.2); b.rotation.set(0, Math.PI / 2, s * 0.18); b.rotation.order = 'YZX'; scene.add(b); } }
  // bunting, from the marquee out to two poles
  { const cols = [0xb8202a, 0xf2efe6, 0x1d4fa8, 0xffd23f]; for (const s of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 5, 8), white); pole.position.set(fx + 4.5, 2.5, cz + s * 7); scene.add(pole);
      const a = V(fx + 0.4, 6.8, cz + s * 4.5), b = V(fx + 4.5, 5, cz + s * 7);
      for (let i = 0; i <= 12; i++) { const t = i / 12, p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.6; const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 3), std(cols[i % 4], 0.8)); f.position.copy(p); f.position.y -= 0.18; f.rotation.z = Math.PI; scene.add(f); } } }
  // two inflatable tube men, flailing
  const tubes = [];
  for (const [s, c1, c2] of [[-1, 0xff3a2a, 0xffd23f], [1, 0x2ad06a, 0xff4fd8]]) {
    const root = dyn(new THREE.Group()); root.position.set(fx + 3.2, 0, cz + s * 5.4); scene.add(root);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.5, 14), std(0x2a2a2a)); base.position.y = 0.25; root.add(base);
    let parent = root, y = 0.5; const segs = [];
    for (let i = 0; i < 6; i++) { const seg = new THREE.Group(); seg.position.y = i ? 0.75 : y; parent.add(seg); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.8, 10), std(i % 2 ? c2 : c1, 0.7)); m.position.y = 0.4; seg.add(m); segs.push(seg); parent = seg; }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), std(c1, 0.7)); head.position.y = 0.95; parent.add(head);
    for (const e of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std(0xffffff, 0.4)); eye.position.set(e * 0.1, 1.0, 0.25); parent.add(eye); const pu = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), std(0x111111)); pu.position.set(e * 0.1, 1.0, 0.3); parent.add(pu); }
    const arms = []; for (const e of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(e * 0.28, 0.7, 0); segs[4].add(arm); const am = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.2, 8), std(c2, 0.7)); am.position.y = 0.6; arm.add(am); arm.rotation.z = -e * 1.2; arms.push(arm); }
    root.traverse(o => { o.userData.dynamic = true; if (o.isMesh) o.castShadow = true; });
    tubes.push({ segs, arms, ph: Math.random() * 6, s });
  }
  // billboards: the roof, the causeway into the Dry, facing the Police Station, on the way into Willow Bank
  const top = (x, z) => { const h = g.world.castRay(new g.R.Ray({ x, y: 80, z }, { x: 0, y: -1, z: 0 }), 100, true, g.R.QueryFilterFlags.ONLY_FIXED); return h ? 80 - (h.timeOfImpact ?? h.toi) : 0; };
  billboard(g, fx - 6, 4.45, cz, Math.PI / 2, 11, 1.2); // (on his own roof: one storey)
  const place = (x, z, yaw, w = 12, legs = 5) => { if (g.map?.inRoad?.(x, z)) return; billboard(g, x, top(x, z), z, yaw, w, legs); };
  place(152, -520, 0); // (on the way into the Dry: drivers heading north see it)
  place(167, -22, Math.PI, 12, 2.5); // (across the avenue from the Police Station, facing it: on whatever's there)
  place(-690, 20, Math.PI / 2, 10); // (Willow Bank's west end, facing back up the streets)
  g.paulDress = { bulbs, neon, tubes, t: 0 };
}
// a frame of the office's moving parts
export function paulTick(g, dt) {
  const D = g.paulDress; if (!D) return;
  D.t += dt; const t = D.t;
  D.bulbs.forEach((b, i) => { b.material.emissiveIntensity = ((i + Math.floor(t * 8)) % 4 === 0) ? 2.4 : 0.35; });
  D.neon.material.emissiveIntensity = Math.random() < 0.03 ? 0.15 : 1.2;
  for (const T of D.tubes) { const p = t * 5 + T.ph; T.segs.forEach((s, i) => { s.rotation.z = Math.sin(p - i * 0.7) * 0.28 * (i ? 1 : 0.4); s.rotation.x = Math.cos(p * 0.7 - i * 0.6) * 0.18; }); T.arms.forEach((a, k) => { a.rotation.z = (k ? 1 : -1) * (0.6 + Math.sin(p * 1.6 + k) * 0.9); }); }
}

// ---- the TV advert: Paul, a starburst, flashing text; drawn into any 2D canvas at time t (seconds)
let adImg = null;
export function drawPaulAd(c, w, h, t) {
  if (!adImg) { adImg = new Image(); adImg.src = import.meta.env.BASE_URL + 'paul-billboard.jpg'; }
  const beat = Math.floor(t * 2), scene = Math.floor(t / 4) % 4;
  // the background: a spinning starburst in clashing colours
  c.save(); c.fillStyle = beat % 2 ? '#ffe14a' : '#ff3a2a'; c.fillRect(0, 0, w, h); c.translate(w / 2, h / 2); c.rotate(t * 1.3);
  for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? (beat % 2 ? '#ff3a2a' : '#ffe14a') : (scene % 2 ? '#2a6aff' : '#ff8a2a'); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, w, i * Math.PI / 8, (i + 1) * Math.PI / 8); c.fill(); }
  c.restore();
  if (adImg.complete && adImg.naturalWidth) {
    if (scene === 0 || scene === 2) { // Paul himself, bouncing (the left of the billboard: him and his burst)
      const bob = Math.abs(Math.sin(t * 6)) * h * 0.06, sw = adImg.naturalWidth * 0.42, sh = adImg.naturalHeight * 0.62;
      c.drawImage(adImg, 0, adImg.naturalHeight * 0.38, sw, sh, w * 0.02, h * 0.3 - bob, w * 0.42, h * 0.72);
    } else c.drawImage(adImg, 0, 0, adImg.naturalWidth, adImg.naturalHeight, w * 0.04, h * 0.08, w * 0.92, h * 0.84); // (the whole billboard)
  }
  // the words, by scene, with a cheap drop shadow and a wobble
  const say = (txt, y, size, col, wob = 0.05) => { c.save(); c.translate(w * 0.66, y); c.rotate(Math.sin(t * 7) * wob); c.font = `bold ${size}px Impact, "Arial Black", sans-serif`; c.textAlign = 'center'; c.fillStyle = '#000'; c.fillText(txt, 3, 3); c.fillStyle = col; c.fillText(txt, 0, 0); c.restore(); };
  const S = h / 160;
  if (scene === 0) { say('ARRESTED?', h * 0.25, 30 * S, '#fff'); if (t % 4 > 1.2) say('ACCUSED?', h * 0.48, 26 * S, '#fff'); if (t % 4 > 2.4) say('ACCIDENTALLY', h * 0.68, 20 * S, '#ffe14a'), say('DID A CRIME?', h * 0.84, 20 * S, '#ffe14a'); }
  if (scene === 2) { say('NEVER', h * 0.3, 34 * S, '#5a8ac8', 0.12); say('CALL PAUL!*', h * 0.55, 30 * S, '#5a8ac8', 0.12); if (t % 4 > 2) say('*ok do call paul', h * 0.82, 13 * S, '#000', 0); }
  if (scene === 3) { c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(0, h * 0.62, w, h * 0.38); c.font = `bold ${22 * S}px Impact, "Arial Black", sans-serif`; c.textAlign = 'center'; c.fillStyle = beat % 2 ? '#ffe14a' : '#fff'; c.fillText('505-PAUL-BADFELLA', w / 2, h * 0.8); c.font = `${10 * S}px Arial`; c.fillStyle = '#fff'; c.fillText('Town Square · Open 24/7 · Se Habla Lawyer', w / 2, h * 0.93); }
  // sparkles, a corner logo, scan lines (it's a cheap channel)
  for (let i = 0; i < 6; i++) { const a = t * 3 + i, x = (Math.sin(a * 1.7 + i) * 0.5 + 0.5) * w, y = (Math.cos(a * 1.3 + i * 2) * 0.5 + 0.5) * h, r = (Math.sin(t * 9 + i) * 0.5 + 0.5) * 6 * S; c.fillStyle = '#fff'; c.fillRect(x - r, y - 0.6, r * 2, 1.2); c.fillRect(x - 0.6, y - r, 1.2, r * 2); }
  c.fillStyle = 'rgba(255,255,255,.85)'; c.font = `bold ${9 * S}px Arial`; c.textAlign = 'left'; c.fillText('AS SEEN ON TV', 6 * S, 12 * S);
  c.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
}
