// Traffic: people driving about the city. Each car keeps to the right-hand lane of the road graph (the same
// one the police use), picks a way at each junction (never straight back), slows for corners, gives way at
// junctions, brakes for the car in front and for people in the road, honks at you if you stand there, and
// floors it when there's shooting. Cars too far from you come back round somewhere out of sight. Pull the
// driver out (F) and it's yours: that's a carjacking.
import * as THREE from 'three';
import { Car } from './car.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LANE = 1.85; // (metres right of the centre line: clear of the cars parked at the kerb)
const PAINTS = [0x9b1c1c, 0x1f4f8a, 0x2b2d30, 0xd8d6d0, 0x3f6b3f, 0x8a6a2a, 0x5a5f66, 0x6a2a5a, 0xc8b89a, 0x1a3a3a, 0xb04a2a, 0xe8e2d4, 0x2a4a7a, 0x7a1a2a];
const BRANDS = [
  { name: 'SWIFTLY', sub: 'PARCELS · SAME DAY', bg: '#f4f2ec', fg: '#1f4f8a' },
  { name: 'FRESHCO', sub: 'FRUIT & VEG', bg: '#2f6b3a', fg: '#ffe9a8' },
  { name: 'DRIPFIX', sub: 'PLUMBING 24/7', bg: '#e8e4da', fg: '#c8202a' },
  { name: 'BAYSIDE', sub: 'LAUNDRY SERVICE', bg: '#8ab8d8', fg: '#16305e' },
];
// what's on the road, and how often
const KINDS = [
  { w: 6, make: () => ({ name: 'Sedan', color: pick(PAINTS), opts: {} }), cruise: 12 },
  { w: 2, make: () => ({ name: 'Taxi', color: 0xf2c21c, opts: { taxi: true } }), cruise: 13 },
  { w: 2, make: () => { const b = pick(BRANDS); return { name: 'Delivery Van', color: new THREE.Color(b.bg).getHex(), opts: { box: b } }; }, cruise: 10 },
  { w: 1, make: () => ({ name: 'Convertible', color: pick([0xc8202a, 0xe8e2d4, 0x1a3a6a, 0xf2a01c]), opts: { convertible: true } }), cruise: 14 },
];
const HONK = ["Move it!", "Get out of the road!", "Hey! I'm driving here!", "Are you lost?!", "MOVE!"];
const JACKED = ["Hey! That's my car!", "No no no, not again!", "Take it! Just take it!", "I just had it cleaned!", "Somebody stop him!"];

export class Traffic {
  constructor(g, n = 11) {
    this.g = g; this.n = n; this.list = []; this.pool = []; this.spawnT = 0;
    this.G = g.police.graph;
    this._fr = new THREE.Frustum(); this._pv = new THREE.Matrix4();
  }

  get enabled() { const g = this.g; return !g.title?.active && g.story?.phase !== 'creator'; }

  // ---- the cars (kept and reused: a car that's driven out of reach comes back somewhere else)
  makeCar() {
    let tot = 0; for (const k of KINDS) tot += k.w;
    let r = Math.random() * tot, K = KINDS[0]; for (const k of KINDS) { if ((r -= k.w) < 0) { K = k; break; } }
    const m = K.make(), g = this.g;
    const car = new Car(g, V(0, -300, 0), 0, m.color, m.name, m.opts);
    car.cruise = K.cruise * (0.85 + Math.random() * 0.3); car.isTraffic = true; car.tid = (this.ids = (this.ids || 0) + 1);
    g.cars.push(car);
    return car;
  }
  park(car) {
    car.inactive = true; car.group.visible = false; car.ai = null; car.tRec = null;
    car.body.setGravityScale(0, true); car.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    const k = this.pool.length; car.body.setTranslation({ x: -3000 - k * 20, y: -400, z: 3000 }, true);
    this.pool.push(car);
  }
  frustum() {
    const cam = this.g.camera; cam.updateMatrixWorld();
    return this._fr.setFromProjectionMatrix(this._pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  }
  // a lane point: along the edge a→b, t metres from a, on the right
  lanePt(a, b, t, out = V()) {
    const A = this.G.nodes[a], B = this.G.nodes[b], L = Math.max(0.01, A.distanceTo(B)), dx = (B.x - A.x) / L, dz = (B.z - A.z) / L;
    return out.set(A.x + dx * t - dz * LANE, 0, A.z + dz * t + dx * LANE);
  }
  nextNode(a, b) {
    let nb = this.G.adj[b].map(e => e[0]).filter(i => i !== a);
    if (!nb.length) return a; // (a dead end: turn round)
    const through = nb.filter(i => this.G.adj[i].length > 1); if (through.length) nb = through; // (not down a dead end, if there's a choice)
    // (mostly carry on fairly straight; sometimes turn)
    const A = this.G.nodes[a], B = this.G.nodes[b], h0 = Math.atan2(B.x - A.x, B.z - A.z);
    const w = nb.map(i => { const C = this.G.nodes[i]; let d = Math.abs(Math.atan2(C.x - B.x, C.z - B.z) - h0); d = Math.min(d, Math.PI * 2 - d); return d < 0.5 ? 2.5 : 1; });
    let r = Math.random() * w.reduce((s, x) => s + x, 0); for (let k = 0; k < nb.length; k++) if ((r -= w[k]) < 0) return nb[k];
    return nb[0];
  }

  // somewhere to appear: a road out of sight, a fair way off (but not on top of another car)
  spawn(first) {
    const g = this.g, G = this.G, pl = g.player, pp = pl.car ? pl.car.pos : pl.pos, fr = this.frustum();
    const lo = first ? 35 : 110, hi = first ? 190 : 200;
    for (let tries = 0; tries < 30; tries++) {
      const a = Math.floor(Math.random() * G.nodes.length); if (!G.adj[a].length) continue;
      const b = pick(G.adj[a])[0], L = G.nodes[a].distanceTo(G.nodes[b]); if (L < 14 || G.adj[b].length < 2) continue;
      const t = 5 + Math.random() * (L - 10), p = this.lanePt(a, b, t);
      const d = Math.hypot(p.x - pp.x, p.z - pp.z); if (d < lo || d > hi) continue;
      if (d < 160 && fr.containsPoint(V(p.x, 1, p.z))) continue;
      if (g.cars.some(c => !c.inactive && c.pos.distanceTo(p) < 12)) continue;
      if (!g.map.inRoad(p.x, p.z)) continue;
      const car = this.pool.pop() || this.makeCar();
      const A = G.nodes[a], B = G.nodes[b], yaw = Math.atan2(B.x - A.x, B.z - A.z), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
      car.body.setGravityScale(1, true); car.body.setTranslation({ x: p.x, y: 0.78, z: p.z }, true); car.body.setRotation(q, true);
      const v0 = first ? 0 : 6; car.body.setLinvel({ x: Math.sin(yaw) * v0, y: 0, z: Math.cos(yaw) * v0 }, true); car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      car.group.position.set(p.x, 0.78, p.z); car.group.quaternion.copy(q); car.group.updateMatrixWorld(true);
      car.inactive = false; car.group.visible = true; car.hp = 1000; car.burning = false; car.wrecked = false; car.lastV.set(0, 0, 0);
      car.ai = { throttle: 0, brake: 0, steer: 0, handbrake: false };
      const rec = { car, a, b, c: this.nextNode(a, b), stuckT: 0, revT: 0, waitT: 0, honkT: 0, panicT: 0, hp: car.hp, driver: null };
      // the driver
      let n = car.tDriver;
      if (!n || n.state !== 'seated' || n.tcar !== car) { n = g.citizens.spawn(pick(['Dana', 'Marcus', 'Priya', 'Tomás', 'Hannah', 'Kofi', 'Lena', 'Jun', 'Rosa', 'Eli', 'Nadia', 'Owen'])); n.state = 'seated'; n.col.setEnabled(false); n.tcar = car; n.seat = 'driver'; car.seatPerson(n.human, 'driver'); car.tDriver = n; n.strength = Math.random(); }
      rec.held = false; rec.hostage = false;
      n.human.root.visible = true; rec.driver = n;
      car.tRec = rec; this.list.push(rec);
      return rec;
    }
    return null;
  }

  // shots fired / someone screaming nearby: everyone near puts their foot down
  panic(at, R = 45) { for (const r of this.list) if (r.car.pos.distanceTo(at) < R) r.panicT = 8 + Math.random() * 4; }

  // the driver's out (pulled out, or bailed out of a wreck): the car's just a car now
  detach(rec, why = 'bail') {
    const g = this.g, car = rec.car, n = rec.driver;
    this.list.splice(this.list.indexOf(rec), 1);
    car.ai = null; car.tRec = null; car.tDriver = null; car.loose = true;
    if (n && n.state === 'seated' && n.tcar === car) {
      car.unseat(n.human); g.scene.add(n.human.root);
      const out = car.doorPoint('driver', 1.0);
      n.body.setTranslation({ x: out.x, y: out.y + 0.88, z: out.z }, true); n.body.setNextKinematicTranslation({ x: out.x, y: out.y + 0.88, z: out.z });
      n.col.setEnabled(true); n.tcar = null; n.vel.set(0, 0, 0);
      n.state = 'flee'; n.stateT = 10 + Math.random() * 5; n.mood = Math.min(n.mood, -50);
      g.citizens.say(n, why === 'jack' ? pick(JACKED) : pick(['My car!', 'Oh my god, oh my god…', 'Somebody call someone!']), 3);
    }
  }
  // at the driver's door: try to drag them out. Strong ones (or a car going too fast) shove you off: the
  // passenger door's still open, though. A gun in your hand helps a lot; a weapon helps a bit.
  overpower(car) {
    const g = this.g, rec = car.tRec, n = rec?.driver, pl = g.player, C = g.citizens; if (!rec || !n) return true;
    const s = Math.abs(car.speed), W = g.weapons.W;
    if (s > 9) { g.hud.toast("It's going too fast to grab"); return false; }
    if (rec.held) { C.say(n, pick(["I'm holding it shut!", 'Not today!', 'GO AWAY!']), 2); g.hud.toast("They're holding the door shut. Try the passenger side.", '#ffd23f'); return false; }
    const chance = (W.gun ? 1.2 : W.melee ? 0.95 : 0.8) - (n.strength ?? 0.5) * 0.75 - s * 0.035;
    if (Math.random() < chance) {
      this.detach(rec, 'jack');
      if (s > 1.5) { const f = car.forward; C.knock(n, V(f.x * s * 0.8 + Math.cos(car.yaw) * 2, 1.5, f.z * s * 0.8 - Math.sin(car.yaw) * 2), 3); } // (out onto the road, tumbling)
      g.police.crime('carjack', pl.pos);
      return true;
    }
    rec.held = true;
    C.say(n, pick(['Get OFF me!', 'Not my car, pal!', 'Back off!', 'HELP! HE\'S TRYING TO TAKE MY CAR!']), 2.5);
    const away = pl.pos.clone().sub(car.pos).setY(0).normalize();
    if (s > 2) pl.knockDown(away.add(car.forward.clone().multiplyScalar(0.5)), 3 + s * 0.4); else pl.knock = away.multiplyScalar(3.5);
    if (s > 1.5) rec.panicT = 6; else { rec.waitT = 1.5; setTimeout(() => { rec.panicT = 6; }, 1500); }
    g.hud.toast("Too strong. They shoved you off. (Try the passenger door.)", '#ffd23f');
    g.police.crime('assault', pl.pos);
    return false;
  }
  // in through the passenger door: they stop dead (and start shouting)
  intoPassenger(car) {
    const g = this.g, rec = car.tRec, n = rec?.driver, pl = g.player;
    if (Math.abs(car.speed) > 4) { g.hud.toast("It's moving too fast"); return; }
    if (car.passenger) { g.hud.toast('Someone\'s in the passenger seat'); return; }
    pl.enterCar(car, 'passenger');
    if (rec) { rec.hostage = true; rec.waitT = 999; }
    if (n) g.citizens.say(n, pick(['What are you DOING?!', 'Get out of my car!', 'Who are you?! GET OUT!', "I'm calling the police!"]), 3);
    g.hud.toast('F: shove them out and take the wheel', '#ffd23f');
  }
  // from the passenger seat: out of the driver's door they go, and you slide across
  shove(car) {
    const g = this.g, rec = car.tRec, pl = g.player;
    if (rec) { this.detach(rec, 'jack'); g.police.crime('carjack', pl.pos); }
    pl.slideOver();
  }
  // you're taking it: the driver comes out, protesting
  carjack(car) {
    const rec = car.tRec; if (!rec) return;
    this.detach(rec, 'jack');
    this.g.police.crime('carjack', this.g.player.pos);
  }

  update(dt) {
    const g = this.g; if (!this.enabled || !g.player) return;
    const pl = g.player, pp = pl.car ? pl.car.pos : pl.pos;
    // keep the roads busy
    this.spawnT -= dt;
    if (this.list.length < this.n && this.spawnT <= 0) { this.spawnT = this.first ? 0.6 : 0.05; this.spawn(!this.first && this.list.length < this.n); if (this.list.length >= this.n) this.first = true; }
    const fr = this.frustum();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const r = this.list[i], car = r.car;
      // out of reach and out of sight: round again, somewhere nearer
      const d = Math.hypot(car.pos.x - pp.x, car.pos.z - pp.z);
      if (d > 230 && !fr.containsPoint(car.pos)) { this.list.splice(i, 1); this.park(car); continue; }
      // a wreck, or on fire, or the driver's gone: they're out
      const n = r.driver;
      if (!n || n.state !== 'seated' || n.tcar !== car) { this.detach(r); continue; }
      if (car.wrecked || car.burning || car.hp < 300) { this.detach(r); continue; }
      // bumped: a honk and a shout
      if (car.hp < r.hp - 40) { r.hp = car.hp; if (pl.car && pl.car.pos.distanceTo(car.pos) < 9) { this.honk(r, pick(['Hey! Watch it!', 'Are you blind?!', "That's coming out of your insurance!"])); r.waitT = 1.5; } }
      if (g.police.stars && d < 30) r.panicT = Math.max(r.panicT, 3);
      this.drive(r, dt, d);
    }
    // cars you've left lying about: tidied away once you're far off (unless they're yours)
    if (Math.random() < dt) for (const c of g.cars) if (c.loose && !c.inactive && !c.owned && c !== pl.car && c !== g.camper && !c.driver && !c.wrecked && c.pos.distanceTo(pp) > 260 && !fr.containsPoint(c.pos)) { c.loose = false; this.park(c); }
  }

  lim(r, want, why, v) { if (v < want) { r.why = why; return v; } return want; }
  honk(r, line) {
    const g = this.g, car = r.car; if (r.honkT > 0) return; r.honkT = 4;
    if (car.pos.distanceTo(g.player.pos) < 60) { g.sfx?.horn(car.pos, true); setTimeout(() => g.sfx?.horn(car.pos, false), 450); }
    if (line && r.driver) g.citizens.say(r.driver, line, 2.5);
  }

  drive(r, dt, dPlayer, depth = 0) {
    const g = this.g, car = r.car, ai = car.ai, G = this.G, pos = car.pos, spd = car.speed;
    r.honkT -= dt; r.panicT -= dt; r.waitT -= dt; r.passT = (r.passT || 0) - dt;
    const A = G.nodes[r.a], B = G.nodes[r.b], L = Math.max(0.01, A.distanceTo(B));
    const dx = (B.x - A.x) / L, dz = (B.z - A.z) / L;
    const t = (pos.x - A.x) * dx + (pos.z - A.z) * dz; // (how far along this road)
    // the turn: where this lane meets the next one (for a right-hand lane, past the middle on a left turn,
    // tight on a right); once past it, on to the next road
    const C = G.nodes[r.c], L2 = Math.max(0.01, B.distanceTo(C)), ex = (C.x - B.x) / L2, ez = (C.z - B.z) / L2;
    const straight = dx * ex + dz * ez > 0.7;
    const P = straight ? V(B.x - dz * LANE, 0, B.z + dx * LANE) : V(B.x + (-dz - ez) * LANE, 0, B.z + (dx + ex) * LANE);
    const tP = (P.x - A.x) * dx + (P.z - A.z) * dz;
    if (r.c === r.a && tP - t < 30 && dPlayer > 60 && !this._fr.containsPoint(pos)) { this.list.splice(this.list.indexOf(r), 1); this.park(car); return; } // (a dead end, nobody looking: it's gone)
    if (t > tP - 0.6 && depth < 3) { r.a = r.b; r.b = r.c; r.c = this.nextNode(r.a, r.b); return this.drive(r, 0, dPlayer, depth + 1); }
    // aim a little up the lane (and round the corner, if it's close)
    const look = 5 + Math.max(0, spd) * 0.5, tl = t + look;
    let aim;
    const off = r.passT > 0 ? -LANE : LANE; // (out round something stopped in the lane)
    if (tl < tP) aim = V(A.x + dx * tl - dz * off, 0, A.z + dz * tl + dx * off);
    else { const o = Math.min(tl - tP, L2); aim = V(P.x + ex * o, 0, P.z + ez * o); }
    const loc = car.group.worldToLocal(V(aim.x, pos.y, aim.z)), ang = Math.atan2(loc.x, loc.z);
    if (r.revT > 0) { r.revT -= dt; ai.throttle = -0.7; ai.brake = 0; ai.steer = -Math.sign(ang) || 1; ai.handbrake = false; return; }
    const panic = r.panicT > 0;
    let want = panic ? 21 : car.cruise; r.why = '';
    // the corner ahead: slow for it (how much depends how sharp)
    const dB = Math.max(0, tP - t);
    { let turn = Math.abs(Math.atan2(C.x - B.x, C.z - B.z) - Math.atan2(dx, dz)); turn = Math.min(turn, Math.PI * 2 - turn); if (turn > 0.35 && dB < 30) want = this.lim(r, want, 'corner', Math.max(turn > 2.5 ? 3 : 5.5, 5.5 + (dB - 5) * 0.55) + (panic ? 3 : 0)); }
    // give way at a junction: someone else nearer it, and moving, goes first
    if (!panic && dB < 22 && dB > 6 && G.adj[r.b].length > 2) {
      for (const o of g.cars) {
        if (o === car || o.inactive) continue;
        const od = Math.hypot(o.pos.x - B.x, o.pos.z - B.z); if (od > 11 || od > dB) continue;
        const ol = car.group.worldToLocal(o.pos.clone()); if (Math.abs(ol.x) < 2.4 && ol.z > 0) continue; // (that's just the car in front)
        if (Math.abs(o.speed) > 1 || o === g.player.car) { want = this.lim(r, want, 'giveway', Math.max(0, (dB - 9) * 0.7)); break; }
      }
    }
    // anyone about to cross our path (looking a second or so ahead): one of the two gives way
    const myV = car.body.linvel();
    for (const o of g.cars) {
      if (o === car || o.inactive) continue;
      const rx = o.pos.x - pos.x, rz = o.pos.z - pos.z; if (rx * rx + rz * rz > 400) continue;
      const ov = o.body.linvel(); let hit = false;
      for (const k of [0.5, 1.0, 1.6]) { const ex = rx + (ov.x - myV.x) * k, ez = rz + (ov.z - myV.z) * k; if (ex * ex + ez * ez < 3.6 * 3.6) { hit = true; break; } }
      if (!hit) continue;
      const l = car.group.worldToLocal(o.pos.clone()); if (l.z < -1) continue; // (it's behind us: its problem)
      if (Math.abs(l.x) < 2.3) continue; // (straight ahead: handled below, as the car in front)
      if (Math.abs(o.speed) < 1 && o !== g.player.car) continue; // (stopped: if it's in the way, it's the car in front)
      const theyGo = o === g.player.car || !o.tRec || (o.tid || 0) < car.tid || Math.abs(o.speed) > Math.abs(spd) + 3;
      if (theyGo && !panic) { want = this.lim(r, want, 'crossing', Math.max(0, (Math.hypot(rx, rz) - 6) * 0.5)); }
    }
    // the car in front, and people in the road
    const ahead = 6 + Math.max(0, spd) * 1.1;
    let blockedBy = null;
    for (const o of g.cars) {
      if (o === car || o.inactive) continue;
      if (Math.abs(o.pos.x - pos.x) > ahead + 4 || Math.abs(o.pos.z - pos.z) > ahead + 4) continue;
      const l = car.group.worldToLocal(o.pos.clone()); if (l.z < 0 || l.z > ahead || Math.abs(l.x) > (r.passT > 0 && Math.abs(o.speed) < 1 ? 1.2 : 2.3)) continue;
      r.blk = o; want = this.lim(r, want, 'car ahead', Math.max(0, Math.max(0, o.speed) * 0.9 + (l.z - 6.5) * 0.8));
      if (o === g.player.car) blockedBy = 'you';
    }
    if (!panic || dPlayer < 15) {
      const peds = []; const pl = g.player;
      if (!pl.car && !pl.dead && dPlayer < ahead + 4) peds.push([pl.pos, 'you']);
      for (const n of g.citizens.list) { if (n.state === 'seated' || n.state === 'dead' || n.state === 'trunk' || n.state === 'cycling') continue; const t2 = n.body.translation(); if (Math.abs(t2.x - pos.x) > ahead + 3 || Math.abs(t2.z - pos.z) > ahead + 3) continue; peds.push([V(t2.x, t2.y, t2.z), n]); }
      for (const [p, who] of peds) {
        const l = car.group.worldToLocal(p.clone().setY(pos.y)); if (l.z < 1 || l.z > ahead || Math.abs(l.x) > 1.7) continue;
        want = this.lim(r, want, who === 'you' ? 'you' : 'person', Math.max(0, (l.z - 4.5) * 0.8));
        if (who === 'you') blockedBy = 'you';
      }
    }
    if (r.waitT > 0) want = 0;
    // stuck behind something that isn't going anywhere (a parked car, a wreck): round it, when the other side's clear
    if (r.why === 'car ahead' && r.blk && Math.abs(spd) < 0.6 && Math.abs(r.blk.speed) < 0.4 && (!r.blk.tRec || r.blk.tRec.why === '' || r.blk.tRec.why === 'corner')) {
      r.blockT = (r.blockT || 0) + dt;
      if (r.blockT > 2.5) { const clear = !g.cars.some(o => o !== car && o !== r.blk && !o.inactive && o.pos.distanceTo(pos) < 30 && Math.abs(o.speed) > 1 && car.group.worldToLocal(o.pos.clone()).x < -1); if (clear) { r.passT = 4.5; r.blockT = 0; } }
    } else r.blockT = 0;
    // stood in front of a car (or parked across the road): it honks
    if (blockedBy === 'you' && Math.abs(spd) < 1) { r.youT = (r.youT || 0) + dt; if (r.youT > 2) this.honk(r, pick(HONK)); } else r.youT = 0;
    ai.steer = THREE.MathUtils.clamp(ang * (spd > 12 ? 1.5 : 2.3), -1, 1);
    ai.throttle = spd < want - 0.8 ? (panic ? 1 : 0.65) : spd < want ? 0.25 : 0;
    ai.brake = spd > want + 1.5 ? Math.min(1, (spd - want) * 0.3) : (want < 0.5 && spd < 1.5 ? 1 : 0);
    ai.handbrake = false;
    // stuck (against a wall, a parked car…): back off and try again
    if (want > 2 && Math.abs(spd) < 0.6) { r.stuckT += dt; if (r.stuckT > 2.5) { r.stuckT = 0; r.revT = 1.2; r.stuckN = (r.stuckN || 0) + 1; } } else if (spd > 3) { r.stuckT = 0; r.stuckN = 0; }
    // really stuck (on its roof, wedged): gone, once you're not looking
    if (r.stuckN > 4 && dPlayer > 40 && !this._fr.containsPoint(pos)) { this.list.splice(this.list.indexOf(r), 1); this.park(car); }
    else if (car.group.matrixWorld.elements[5] < 0.2) { r.flipT = (r.flipT || 0) + dt; if (r.flipT > 4) this.detach(r); }
  }
}
