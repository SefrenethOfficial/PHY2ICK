// Rusty's Parking: a small parking lot on the east side ($5 an hour, says the sign). At the back, a garage with
// its shutter up. Drive a car in and Rusty will register it to you, respray it or put new plates on it, so the
// police stop recognising it. If they're after you and nobody saw you come in, a respray loses them too.
import * as THREE from 'three';
import { Car } from './car.js';
import { canvasTex } from './world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const el = (id) => document.getElementById(id);
const COLORS = [0x1c1c1e, 0xf2f2f0, 0x9b1c1c, 0x1c3a8a, 0x2a6a3a, 0xc8a020, 0x6a6e74, 0x5a2a6a, 0xd86a1a, 0x7ab8d8];
const PRICE = { register: 300, respray: 150, plates: 100 };

export class ChopShop {
  constructor(g) {
    this.g = g; this.open = false;
    if (g.chopLot) this.build(g.chopLot);
  }
  build(L) {
    const g = this.g, { world, R, scene } = g;
    const n = { '+x': V(1, 0, 0), '-x': V(-1, 0, 0), '+z': V(0, 0, 1), '-z': V(0, 0, -1) }[L.face] || V(0, 0, 1), t = V(-n.z, 0, n.x);
    const c = V((L.x0 + L.x1) / 2, 0, (L.z0 + L.z1) / 2), alongX = Math.abs(n.x) > 0.5;
    const hd = (alongX ? L.x1 - L.x0 : L.z1 - L.z0) / 2, hw = (alongX ? L.z1 - L.z0 : L.x1 - L.x0) / 2;
    const GW = Math.min(16, hw * 2 - 1), GD = Math.min(14, hd * 2 - 8), GH = 5;
    const P = (u, y, v) => c.clone().addScaledVector(t, u).addScaledVector(n, -hd + 0.6 + v).setY(y); // (u across, v out from the back wall)
    this.P = P; this.GW = GW; this.GD = GD; this.n = n; this.t = t;
    const std = (col, r = 0.85, x = {}) => new THREE.MeshStandardMaterial({ color: col, roughness: r, ...x });
    // an axis-aligned box given in the garage's own terms (width across, depth out)
    const box = (su, sy, sv, u, y, v, m, collide = true) => {
      const sx = alongX ? sv : su, sz = alongX ? su : sv, p = P(u, y, v);
      const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.copy(p); b.castShadow = b.receiveShadow = true; scene.add(b);
      if (collide) world.createCollider(R.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2).setTranslation(p.x, p.y, p.z));
      return b;
    };
    const metal = std(0x8a9096, 0.5, { metalness: 0.5 }), wall = std(0xb8b2a4, 0.9), dark = std(0x2a2c2e, 0.6), red = std(0xb02a1e, 0.5), wood = std(0x7a5a3a, 0.8);
    // the shell: back and side walls, the front with the shutter up, a roof
    box(GW, GH, 0.25, 0, GH / 2, 0, wall);
    for (const s of [-1, 1]) box(0.25, GH, GD, s * GW / 2, GH / 2, GD / 2, wall);
    const door = Math.min(6.4, GW - 2.4);
    for (const s of [-1, 1]) box((GW - door) / 2, GH, 0.25, s * (door / 2 + (GW - door) / 4), GH / 2, GD, wall);
    box(door, GH - 4.2, 0.25, 0, 4.2 + (GH - 4.2) / 2, GD, wall);
    box(door + 0.2, 0.35, 0.5, 0, 4.0, GD - 0.1, metal, false); // (the rolled-up shutter)
    box(GW + 0.6, 0.25, GD + 0.6, 0, GH + 0.12, GD / 2, std(0x5a5650, 0.9));
    const floorT = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#7a7872'; x.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(30,30,30,${Math.random() * 0.25})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 14, 0, 7); x.fill(); } }, [3, 3]);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? GD : GW, alongX ? GW : GD), std(0xffffff, 0.8, { map: floorT })); fl.rotation.x = -Math.PI / 2; fl.position.copy(P(0, 0.025, GD / 2)); fl.receiveShadow = true; scene.add(fl);
    // inside: a workbench and a tool wall, tyres, oil drums, a compressor, a paint booth with plastic sheets, a lift
    box(0.8, 0.95, 3.0, -GW / 2 + 0.55, 0.475, GD - 4.5, wood); box(0.06, 1.4, 3.0, -GW / 2 + 0.16, 1.9, GD - 4.5, std(0x9a8a6a, 0.9), false);
    for (let k = 0; k < 7; k++) box(0.04, 0.3, 0.06, -GW / 2 + 0.22, 1.95, GD - 5.8 + k * 0.42, dark, false);
    for (let i = 0; i < 4; i++) { const ty = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.13, 8, 18), dark); ty.rotation.x = Math.PI / 2; ty.position.copy(P(-GW / 2 + 0.6, 0.14 + i * 0.26, 2.6)); ty.castShadow = true; scene.add(ty); }
    for (let i = 0; i < 3; i++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 14), i === 1 ? red : std(0x2a5a8a, 0.5)); d.position.copy(P(GW / 2 - 0.45, 0.45, 2.4 + i * 0.65)); d.castShadow = true; scene.add(d); }
    box(0.5, 0.8, 0.7, GW / 2 - 0.4, 0.4, 0.6, red);
    const sheet = std(0xd8e8f0, 0.3, { transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    box(GW - 1, 0.05, 0.05, 0, 3.62, 1.4, std(0x3a3d40, 0.6), false); box(GW - 1, 3.5, 0.02, 0, 1.85, 1.42, sheet, false); // (a plastic sheet across the back: the paint booth)
    for (const s of [-1, 1]) box(0.25, 2.2, 0.25, s * (GW / 2 - 0.6), 1.1, GD * 0.55, std(0xd8a020, 0.5)); // (the lift posts)
    // a light or two (the room light follows you indoors)
    for (const v of [GD * 0.3, GD * 0.7]) { const lp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.25), std(0xffffff, 0.5, { emissive: 0xfff2d8, emissiveIntensity: 1.5 })); lp.position.copy(P(0, GH - 0.1, v)); if (alongX) lp.rotation.y = Math.PI / 2; scene.add(lp); }
    const ring = [P(-GW / 2, 0, 0), P(GW / 2, 0, 0), P(GW / 2, 0, GD), P(-GW / 2, 0, GD)].map(p => [p.x, p.z]);
    g.rooms = g.rooms || []; g.rooms.push({ kind: 'garage', name: "Rusty's", ring, y0: -1, y1: GH + 0.3, lights: [P(0, GH - 0.6, GD * 0.3), P(0, GH - 0.6, GD * 0.7)], tint: 0xfff0d8, power: 16 });
    // the signs: the lot's ($5/hr: the disguise) and the garage's
    const sign = (text, at, w, bg, fg) => { const tx = canvasTex(512, 128, (x, W, H) => { x.fillStyle = bg; x.fillRect(0, 0, W, H); x.fillStyle = fg; x.font = 'bold 64px "Arial Narrow", Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, W / 2, H / 2 + 4); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), std(0xffffff, 0.6, { map: tx, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.2, side: THREE.DoubleSide })); m.position.copy(at); m.lookAt(at.clone().add(n)); scene.add(m); return m; };
    sign("RUSTY'S PARKING · $5/HR", P(0, 5.6, GD + 0.2), 6, '#1a3a6a', '#ffffff');
    sign('STAFF ONLY · NO PUBLIC ENTRY', P(0, 4.55, GD + 0.15), 3.2, '#e8c020', '#1a1a1a');
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), metal); pole.position.copy(P(hw - 0.6, 1.6, hd * 2 - 1.5)); scene.add(pole);
    sign('P  $5/HR', P(hw - 0.6, 3.3, hd * 2 - 1.4), 1.8, '#1a3a6a', '#ffffff');
    // Rusty
    const at = P(GW / 2 - 1.0, 0.04, 2.0), face = Math.atan2(n.x, n.z);
    const rusty = g.citizens.addWorker({ pos: at, yaw: face, lines: ["Parking's five an hour. The garage is… by appointment.", "Bring it in, I'll make it a different car.", "I don't ask where it came from. You don't ask where it's going."], role: 'mechanic', shop: "Rusty's", kind: 'garage', name: 'Rusty' });
    rusty.mem.met = true;
    this.bay = { u0: -GW / 2 + 0.5, u1: GW / 2 - 0.5, v0: 0.8, v1: GD + 0.5 };
    g.places = g.places || {}; g.places["Rusty's"] = { pos: P(0, 0, GD + 4), name: "Rusty's" };
  }
  // is the car parked in the bay?
  inBay(car) {
    if (!this.bay || !car) return false;
    const c = this.P(0, 0, 0), d = car.pos.clone().sub(c), u = d.dot(this.t), v = d.dot(this.n), B = this.bay;
    return u > B.u0 && u < B.u1 && v > B.v0 && v < B.v1;
  }
  canUse() { const pl = this.g.player; return !!pl.car && this.inBay(pl.car) && Math.abs(pl.car.speed) < 1.2; }

  // ---- Rusty's menu (the mouse is free while it's open)
  show() {
    const g = this.g; if (!this.canUse()) return;
    this.open = true; this.picking = false; this.render(); el('garage').classList.add('on'); document.exitPointerLock?.();
  }
  close() { this.open = false; el('garage').classList.remove('on'); this.g.renderer.domElement.requestPointerLock?.(); }
  render() {
    const g = this.g, car = g.player.car; if (!car) { this.close(); return; }
    const heat = car.heat || 0, stars = g.police.stars;
    const opts = [
      { id: 'register', label: car.owned ? 'Registered to you' : `Register it as yours · $${PRICE.register}`, off: car.owned },
      { id: 'respray', label: `Respray · $${PRICE.respray}` },
      { id: 'plates', label: `New plates · $${PRICE.plates}` },
      { id: 'done', label: 'Done' },
    ];
    el('garage').innerHTML = `<h3>RUSTY'S</h3><div class="car">${car.name || 'Car'} · <b>${car.plate}</b>${car.owned ? ' · yours' : ''}</div>
      <div class="heat ${heat >= 2 ? 'hot' : heat ? 'warm' : ''}">${heat >= 2 ? 'The police know this car' : heat ? "The police have seen this car" : 'Clean: nobody knows this car'}${stars ? ` · <b>${stars}★</b> on you` : ''}</div>
      ${this.picking ? `<div class="swatches">${COLORS.map((c, i) => `<button data-c="${i}" style="background:#${new THREE.Color(c).getHexString()}"></button>`).join('')}</div><div class="hint">Pick a colour</div>` :
        opts.map((o, i) => `<button data-a="${o.id}" ${o.off ? 'disabled' : ''}><small>${i + 1}</small>${o.label}</button>`).join('')}
      <div class="hint"><kbd>Esc</kbd> done</div>`;
    el('garage').querySelectorAll('button[data-a]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this.act(b.dataset.a); }));
    el('garage').querySelectorAll('button[data-c]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this.respray(COLORS[+b.dataset.c]); }));
  }
  key(code) {
    if (code === 'Escape' || code === 'KeyE') { if (this.picking) { this.picking = false; this.render(); } else this.close(); return; }
    const m = /^Digit(\d)$/.exec(code); if (!m) return;
    if (this.picking) { const c = COLORS[(+m[1] + 9) % 10]; if (c != null) this.respray(c); return; }
    this.act(['register', 'respray', 'plates', 'done'][+m[1] - 1]);
  }
  pay(k) { const g = this.g; if (g.money < PRICE[k]) { g.hud.toast(`That's $${PRICE[k]}. You've got $${g.money}.`); return false; } g.money -= PRICE[k]; g.sfx?.cash(g.player.pos); return true; }
  act(id) {
    const g = this.g, car = g.player.car; if (!car) return;
    if (id === 'done') { this.close(); return; }
    if (id === 'register') { if (car.owned || !this.pay('register')) return; car.owned = true; car.locked = false; g.hud.toast(`Registered to you: ${car.plate}`, '#7be08a'); this.say(["Papers say it's yours. So it's yours.", 'Congratulations on your new car.']); }
    if (id === 'respray') { this.picking = true; this.render(); return; }
    if (id === 'plates') { if (!this.pay('plates')) return; this.work(() => { car.setPlate(Car.randomPlate()); car.heat = Math.max(0, (car.heat || 0) - 2); g.hud.toast(`New plates: ${car.plate}`, '#7be08a'); }); this.say(['Fresh plates. Never seen this car in my life.', 'Done. Different car.']); }
    this.render();
  }
  respray(color) {
    const g = this.g, car = g.player.car; this.picking = false;
    if (!car || !this.pay('respray')) { this.render(); return; }
    this.work(() => { car.respray(color); car.heat = Math.max(0, (car.heat || 0) - 2); g.hud.toast('Resprayed', '#7be08a'); });
    this.say(['Nice colour. Very… not the old colour.', "Paint's still wet. Don't lean on it."]);
    this.render();
  }
  // the work: a quick dip to black; if they're after you and nobody saw you come in, they lose you
  work(fn) {
    const g = this.g, P = g.police, seen = P.stars && P.copSees(g.player.car.pos);
    g.story?.blink(() => {
      fn();
      if ((P.stars || P.suspect) && !seen) { P.clear(); P.stars = 0; P.suspect = null; g.hud.toast("Rusty pulls the shutter down. The police lose you.", '#ffd23f'); }
      else if (P.stars) g.hud.toast("They saw you come in. Paint won't fix that.", '#ff6a5a');
    });
  }
  say(lines) { const r = this.g.citizens.list.find(n => n.shop === "Rusty's"); if (r) this.g.citizens.say(r, pick(lines), 2.8); }
  update() { if (this.open && !this.canUse()) this.close(); }
}
