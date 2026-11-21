// MARCOS: the burger chain from Verian (as in Physick), with a branch out in the Dry by the junction where the
// east road leaves the highway: the last feed before the desert. Red brick and big windows under a red
// mansard roof, a tall pole sign you can see down the highway, a patio with umbrellas, a drive-thru lane round
// the side and a car park behind. Inside: the counter and its glowing menu boards, the kitchen, booths along
// the windows and a ball pit with a slide. Order at the counter (or the drive-thru window, in a car) with E.
import * as THREE from 'three';
import { canvasTex } from './world.js';
import { MARCOS_LOT } from './desert.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const MENU = [['Marco Burger', 6, 30], ['Big Marco', 9, 50], ['Chicken Bites', 5, 25], ['Fries', 3, 12], ['Choc Shake', 4, 15], ['Meal Deal', 12, 100]];
const el = (id) => document.getElementById(id);

// the logo: a burger in a yellow ring on red, the name underneath
export function marcosLogo(w = 512, h = 512) {
  return canvasTex(w, h, (c) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#c8102e'; c.beginPath(); c.arc(w / 2, h * 0.42, w * 0.38, 0, 7); c.fill();
    c.lineWidth = w * 0.035; c.strokeStyle = '#ffc72c'; c.beginPath(); c.arc(w / 2, h * 0.42, w * 0.34, 0, 7); c.stroke();
    const cx = w / 2, cy = h * 0.42, bw = w * 0.36;
    c.fillStyle = '#ffb347'; c.beginPath(); c.ellipse(cx, cy - h * 0.05, bw / 2, h * 0.1, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#fff3c4'; for (let i = 0; i < 7; i++) { c.beginPath(); c.ellipse(cx - bw * 0.3 + i * bw * 0.1, cy - h * 0.1, 5, 3, 0.4, 0, 7); c.fill(); }
    c.fillStyle = '#5fbf3f'; c.beginPath(); for (let i = 0; i <= 10; i++) { const x = cx - bw / 2 + (i * bw) / 10; c.lineTo(x, cy - h * 0.035 + (i % 2 ? 8 : 0)); } c.lineTo(cx + bw / 2, cy - h * 0.01); c.lineTo(cx - bw / 2, cy - h * 0.01); c.fill();
    c.fillStyle = '#6b3a1e'; c.fillRect(cx - bw / 2, cy - h * 0.01, bw, h * 0.055);
    c.fillStyle = '#ffc72c'; c.beginPath(); c.moveTo(cx - bw / 2, cy + h * 0.045); c.lineTo(cx + bw / 2, cy + h * 0.045); c.lineTo(cx + bw * 0.3, cy + h * 0.075); c.lineTo(cx - bw * 0.2, cy + h * 0.07); c.fill();
    c.fillStyle = '#ffb347'; c.beginPath(); c.ellipse(cx, cy + h * 0.075, bw / 2, h * 0.04, 0, 0, Math.PI); c.fill();
    c.fillRect(cx - bw / 2, cy + h * 0.06, bw, h * 0.018);
    c.font = `900 ${Math.round(h * 0.15)}px "Arial Black", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = h * 0.03; c.strokeStyle = '#c8102e'; c.strokeText('MARCOS', w / 2, h * 0.9);
    c.fillStyle = '#ffc72c'; c.fillText('MARCOS', w / 2, h * 0.9);
  });
}

export class Marcos {
  constructor(g) {
    this.g = g; this.open = false; this.closedT = 0; this.staff = [];
    const L = MARCOS_LOT;
    this.Y = g.desert.groundY((L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2) + 0.02;
    // the building's own frame: 24 × 16, the front (local −z) facing the highway (world +x)
    this.root = new THREE.Group(); this.root.position.set(L.bx, this.Y, L.bz); this.root.rotation.y = -Math.PI / 2; g.scene.add(this.root); this.root.updateMatrixWorld(true);
    this.build();
    this.hire();
  }
  // local → world
  W(x, y, z) { return V(x, y, z).applyMatrix4(this.root.matrixWorld); }

  build() {
    const g = this.g, { world, R } = g, G = this.root, q = this.root.quaternion;
    const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });
    const box = (w, h, d, x, y, z, mat, collide = true, rx = 0, ry = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); m.rotation.set(rx, ry, 0, 'YXZ'); m.castShadow = true; m.receiveShadow = true; G.add(m);
      if (collide) { const c = this.W(x, y + h / 2, z), qq = q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ'))); world.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(c.x, c.y, c.z).setRotation(qq)); }
      return m;
    };
    const flat = (w, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; G.add(m); return m; };
    const lit = (c, k = 0.3) => std({ color: c, emissive: c, emissiveIntensity: k });
    const red = std({ color: 0xc8102e, roughness: 0.6 }), yellow = lit(0xffc72c, 0.35);
    const brick = std({ map: canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#9a3a2a'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) { c.fillStyle = 'rgba(230,220,200,.5)'; c.fillRect(0, y, w, 1); for (let x = (y / 8) % 2 ? 0 : 8; x < w; x += 16) c.fillRect(x, y, 1, 8); } }, [3, 1.5]), roughness: 0.9 });
    const glass = std({ color: 0x9ec5e8, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.3, depthWrite: false });
    const steel = std({ color: 0xb8bcc2, metalness: 0.7, roughness: 0.3 }), dark = std({ color: 0x2a2c30, metalness: 0.4 });
    const tileT = canvasTex(64, 64, (c) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#e8e2d4' : '#c8102e'; c.fillRect(i * 16, j * 16, 16, 16); } }, [8, 6]);
    const x0 = -12, x1 = 12, z0 = -8, z1 = 8, H = 4.6, cx = 0, T = 0.3;
    // the lot: asphalt all round, the floor tiled
    const asph = std({ color: 0x45484c, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    flat(46, 58, -1, 0.01, 1, asph);
    flat(x1 - x0, z1 - z0, cx, 0.03, 0, std({ map: tileT, emissive: 0xffffff, emissiveMap: tileT, emissiveIntensity: 0.12 }));
    // walls: brick to the sill, glass above, on three sides; the kitchen wall at the back is solid
    const glazed = (len, x, z, along) => {
      box(along ? len : T, 1.0, along ? T : len, x, 0, z, brick);
      const gm = new THREE.Mesh(new THREE.BoxGeometry(along ? len : 0.06, 2.4, along ? 0.06 : len), glass); gm.position.set(x, 2.2, z); G.add(gm);
      const c = this.W(x, 2.2, z); world.createCollider(R.ColliderDesc.cuboid(along ? len / 2 : 0.1, 1.2, along ? 0.1 : len / 2).setTranslation(c.x, c.y, c.z).setRotation(q));
      box(along ? len : T, H - 3.4, along ? T : len, x, 3.4, z, brick);
      const n = Math.round(len / 3); for (let k = 0; k <= n; k++) box(0.12, 2.4, 0.12, along ? x - len / 2 + (k * len) / n : x, 1, along ? z : z - len / 2 + (k * len) / n, dark, false);
    };
    glazed((cx - 1.5) - x0, (x0 + cx - 1.5) / 2, z0, true);
    glazed(x1 - (cx + 1.5), (cx + 1.5 + x1) / 2, z0, true);
    box(3, H - 2.8, T, cx, 2.8, z0, brick);
    glazed(z1 - z0 - 6, x0, (z0 + z1 - 6) / 2, false); // (the patio side)
    box(T, H, 6, x0, 0, z1 - 3, brick);
    glazed(10, x1, z0 + 5, false);
    box(T, H, 6, x1, 0, z0 + 13, brick); // (the drive-thru side, with its window)
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 1.6), glass); hatch.position.set(x1 + 0.05, 1.6, z0 + 13); G.add(hatch);
    box(0.5, 0.08, 1.8, x1 + 0.35, 1.0, z0 + 13, steel, false);
    box(x1 - x0, H, T, cx, 0, z1, brick);
    // the roof: flat, a red mansard round it, a yellow fascia with the name
    box(x1 - x0 + 0.6, 0.35, z1 - z0 + 0.6, cx, H, 0, std({ color: 0x5f6266 }));
    const mansard = (len, x, z, rx, ry) => box(len, 0.2, 2.4, x, H + 0.9, z, red, false, rx, ry);
    mansard(x1 - x0 + 2, cx, z0 - 0.6, 0.9, 0); mansard(x1 - x0 + 2, cx, z1 + 0.6, -0.9, 0);
    mansard(z1 - z0 + 2, x0 - 0.6, 0, -0.9, Math.PI / 2); mansard(z1 - z0 + 2, x1 + 0.6, 0, 0.9, Math.PI / 2);
    box(x1 - x0 + 1.6, 0.5, 0.2, cx, H - 0.2, z0 - 0.75, yellow, false);
    const word = canvasTex(1024, 192, (c, w, h) => { c.fillStyle = '#c8102e'; c.fillRect(0, 0, w, h); c.font = '900 140px "Arial Black", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffc72c'; c.fillText('MARCOS', w / 2, h / 2 + 6); });
    const fasc = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7), new THREE.MeshStandardMaterial({ map: word, emissive: 0xffffff, emissiveMap: word, emissiveIntensity: 0.55 })); fasc.position.set(cx, H + 1.0, z0 - 1.45); fasc.rotation.set(-0.5, Math.PI, 0); G.add(fasc);
    fasc.rotation.set(0.0, Math.PI, 0); fasc.rotation.x = 0; fasc.lookAt(this.W(cx, H + 1.0, z0 - 10)); // (facing out the front)
    box(6, 0.2, 2.2, cx, 3.1, z0 - 1.1, red, false); // (a canopy over the doors)
    // inside: the counter, the kitchen behind it, the menu boards over it
    const counterZ = z1 - 5.5;
    box(12, 1.05, 0.9, cx + 2, 0, counterZ, red);
    box(12.1, 0.06, 1.0, cx + 2, 1.05, counterZ, lit(0xe8e2d4, 0.2), false);
    for (const dx of [-2.5, 1.5, 5.5]) box(0.45, 0.35, 0.35, cx + dx, 1.1, counterZ, dark, false);
    this.counter = this.W(cx + 1.5, 0, counterZ - 1.3);
    const menuTex = canvasTex(1024, 256, (c, w, h) => {
      c.fillStyle = '#1a1414'; c.fillRect(0, 0, w, h);
      MENU.forEach(([n, p], i) => { const x = 20 + (i % 3) * 340, y = 30 + Math.floor(i / 3) * 110; c.fillStyle = '#c8102e'; c.fillRect(x, y, 320, 90); c.fillStyle = '#ffc72c'; c.font = 'bold 34px Arial'; c.fillText(n, x + 14, y + 40); c.fillStyle = '#fff'; c.font = 'bold 30px Arial'; c.fillText('$' + p, x + 14, y + 78); });
    });
    const menu = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: menuTex })); menu.position.set(cx + 2, 3.2, z1 - 0.2); menu.rotation.y = Math.PI; G.add(menu);
    box(3, 0.95, 0.8, cx - 2, 0, z1 - 1.2, steel); box(2.6, 0.95, 0.8, cx + 2, 0, z1 - 1.2, dark); box(2.6, 1.8, 0.6, cx + 6, 0, z1 - 1, steel);
    // booths along the front windows, tables in the middle, the play corner
    const seat = std({ color: 0xffc72c, roughness: 0.6 }), table = lit(0xe8e2d4, 0.15);
    for (const x of [x0 + 3, x0 + 8, x1 - 8, x1 - 3]) { box(1.6, 0.75, 1.0, x, 0, z0 + 2.4, table); for (const s of [-1, 1]) { box(1.6, 0.45, 0.6, x, 0, z0 + 2.4 + s * 1.0, seat); box(1.6, 1.1, 0.15, x, 0, z0 + 2.4 + s * 1.35, red, false); } }
    for (const x of [cx - 4, cx, cx + 4]) { box(1.1, 0.75, 1.1, x, 0, z0 + 7, table); for (const s of [-1, 1]) box(0.45, 0.45, 0.45, x + s * 0.9, 0, z0 + 7, red, false); }
    box(3, 0.6, 3, x0 + 2.2, 0, z1 - 5, std({ color: 0x2f7fd8 }), false);
    for (let k = 0; k < 40; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), lit([0xc8102e, 0xffc72c, 0x2f7fd8, 0x3aa760][k % 4], 0.3)); b.position.set(x0 + 1 + Math.random() * 2.4, 0.62, z1 - 6.2 + Math.random() * 2.4); G.add(b); }
    box(0.9, 0.1, 3.4, x0 + 4.5, 1.0, z1 - 5, red, false, -0.5, 0);
    for (let x = x0 + 3; x < x1; x += 5) for (const z of [z0 + 3, z0 + 8, z1 - 3]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 12), new THREE.MeshBasicMaterial({ color: 0xfff6e0 })); l.position.set(x, H - 0.05, z); G.add(l); }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), lit(0xf4ece0, 0.3)); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H - 0.02, 0); G.add(ceil);
    // outside: the patio (umbrellas), the pole sign by the highway, the drive-thru lane, the car park
    for (const [x, z] of [[x0 - 4.5, z0 + 3], [x0 - 4.5, z0 + 9], [x0 - 9.5, z0 + 6]]) {
      box(1.2, 0.75, 1.2, x, 0, z, std({ color: 0xe8e2d4 }));
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), std({ color: 0xe8e2d4 })); pole.position.set(x, 1.2, z); G.add(pole);
      const um = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 8), std({ color: 0xc8102e })); um.position.set(x, 2.5, z); G.add(um);
    }
    const logo = marcosLogo();
    const px = x0 - 6, pz = z0 - 9; // (the corner nearest the highway, north of the doors)
    box(0.6, 14, 0.6, px, 0, pz, std({ color: 0xc8102e, metalness: 0.3 }));
    for (const r of [0, Math.PI]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshStandardMaterial({ map: logo, transparent: true, emissive: 0xffffff, emissiveMap: logo, emissiveIntensity: 0.5, side: THREE.FrontSide })); d.position.set(px + Math.sin(r + Math.PI / 2) * 0.35, 15.5, pz + Math.cos(r + Math.PI / 2) * 0.35); d.rotation.y = r + Math.PI / 2; G.add(d); }
    const openT = canvasTex(512, 96, (c, w, h) => { c.fillStyle = '#ffc72c'; c.fillRect(0, 0, w, h); c.fillStyle = '#c8102e'; c.font = 'bold 46px Arial'; c.textAlign = 'center'; c.fillText('OPEN 24 HOURS · DRIVE-THRU', w / 2, 64); });
    for (const r of [0, Math.PI]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.9), new THREE.MeshStandardMaterial({ map: openT, emissive: 0xffffff, emissiveMap: openT, emissiveIntensity: 0.4 })); s.position.set(px + Math.sin(r + Math.PI / 2) * 0.35, 11.4, pz + Math.cos(r + Math.PI / 2) * 0.35); s.rotation.y = r + Math.PI / 2; G.add(s); }
    // drive-thru: a lane down the side past the window, a menu board on it
    flat(6, 30, x1 + 4.5, 0.025, 2, std({ color: 0x3c3f43, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    for (let z = -10; z < 16; z += 5) { const a = flat(0.5, 2, x1 + 4.5, 0.035, z, new THREE.MeshBasicMaterial({ color: 0xf2f2ee })); a.material.polygonOffset = true; a.material.polygonOffsetFactor = -4; }
    box(0.3, 2.2, 2.6, x1 + 8.2, 0, z0 + 20, dark);
    const mb = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshBasicMaterial({ map: menuTex })); mb.position.set(x1 + 8.0, 1.6, z0 + 20); mb.rotation.y = -Math.PI / 2; G.add(mb);
    this.window = this.W(x1 + 3, 0, z0 + 13);
    // car park bays behind
    for (let x = x0 - 2; x <= x1 + 2; x += 3) { const s = flat(0.15, 5, x, 0.03, z1 + 9, new THREE.MeshBasicMaterial({ color: 0xf2f2ee })); s.material.polygonOffset = true; s.material.polygonOffsetFactor = -4; }
    this.door = this.W(cx, 0, z0 - 2);
    // (for the minimap, and for "are you inside")
    const a = this.W(x0, 0, z0), b = this.W(x1, 0, z1);
    this.foot = [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)];
    const ring = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => { const p = this.W(x, 0, z); return [p.x, p.z]; });
    g.rooms = g.rooms || []; g.rooms.push({ kind: 'diner', name: 'MARCOS', ring, y0: this.Y - 1, y1: this.Y + H, lights: [this.W(-5, H - 0.6, 0), this.W(5, H - 0.6, 0)], tint: 0xfff0d8, power: 14 });
  }

  // the crew: red shirts, black trousers, yellow caps; a couple of people eating
  hire() {
    const C = this.g.citizens, lines = ['Welcome to MARCOS! What can I get you?', "We don't get many people out here. Except truckers. And… you.", "Sorry, the ice cream machine's broken. It's always broken."];
    const crew = (dx, dz, yaw, skin) => { const p = this.W(dx, 0, dz), n = C.addWorker({ pos: p, yaw: yaw - Math.PI / 2, lines, role: 'crew', name: ['Dee', 'Tomas', 'Luz', 'Benny'][this.staff.length % 4], look: { shirt: 0xc8102e, pants: 0x1d1f22, shoes: 0x111111, hairStyle: 'cap', skin } }); n.marcos = true; this.staff.push(n); return n; };
    crew(1.5, 8 - 5.5 + 1.0, Math.PI, 0x7a4f35);
    crew(-2.5, 8 - 5.5 + 1.0, Math.PI, 0xf1c9a5);
    crew(-2, 8 - 2.2, 0, 0xa8724f);
  }

  // shooting (or worse) near here: the crew run, and it's shut for a while
  onCrime(kind, at) {
    if (!['gunfire', 'murder', 'robbery', 'explosion', 'copMurder'].includes(kind) || at.distanceTo(this.door) > 45) return;
    this.closedT = 120; if (this.open) this.close();
    for (const n of this.staff) if (n.state !== 'dead') { n.state = 'flee'; n.stateT = 15; }
  }
  get working() { return this.closedT <= 0 && this.staff.some(n => n.state === 'post' && n.body.translation().y > this.Y - 2); }

  // where you can order: at the counter on foot, or at the window in a car
  canOrder() {
    const pl = this.g.player;
    if (pl.car) return Math.hypot(pl.car.pos.x - this.window.x, pl.car.pos.z - this.window.z) < 4.5;
    return pl.pos.distanceTo(this.counter) < 2.4;
  }
  label() { return this.working ? `<kbd>E</kbd> order at MARCOS` : this.closedT > 0 ? "MARCOS is shut. Somebody's been shooting." : 'Nobody at the counter'; }

  show() {
    if (!this.working) { this.g.hud.toast(this.closedT > 0 ? "They've shut. Somebody's been shooting." : 'Nobody to serve you.'); return; }
    this.open = true; this.render(); el('marcos').classList.add('on'); document.exitPointerLock?.();
  }
  close() { this.open = false; el('marcos').classList.remove('on'); this.g.renderer.domElement.requestPointerLock?.(); }
  render() {
    const g = this.g, e = el('marcos');
    e.innerHTML = `<h3>MARCOS</h3><div class="lede">"Welcome to MARCOS! What can I get you?"</div>
      ${MENU.map(([n, p, hp], i) => `<button data-i="${i}" ${g.money >= p ? '' : 'disabled'}><span>${n}</span><b>$${p}</b><i>+${hp} health</i></button>`).join('')}
      <button data-i="x" class="done">That's all · <kbd>E</kbd></button>`;
    e.querySelectorAll('button[data-i]').forEach(b => b.addEventListener('click', (ev) => { ev.stopPropagation(); if (b.dataset.i === 'x') { this.close(); return; } this.buy(+b.dataset.i); }));
  }
  buy(i) {
    const g = this.g, [n, p, hp] = MENU[i], pl = g.player;
    if (g.money < p) return;
    g.money -= p; pl.hp = Math.min(100, pl.hp + hp); g.sfx?.cash?.(pl.pos);
    g.hud.toast(`${n}. ${['Delicious.', 'Still hot.', 'Extra pickles, nice.', 'That hit the spot.'][Math.floor(Math.random() * 4)]} +${hp} health`, '#7be08a');
    this.render();
  }
  key(code) { if (code === 'Escape' || code === 'KeyE') this.close(); }
  update(dt) {
    if (this.closedT > 0) this.closedT -= dt;
    if (this.open && !this.canOrder()) this.close();
  }
}
