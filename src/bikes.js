// Bicycles: people riding about the island, near the kerb on the right, pedalling. Knock one off (F) and the
// bike's yours: W pedal (Shift to stand on the pedals), S brake, A/D steer, F to get off. Ride into a wall or a car
// fast enough and you go over the bars. A car that hits someone on a bike knocks them off it.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LANE = 3.15; // (right of the centre line: between the traffic's lane and the parked cars)
const FRAMES = [0x1f5fbf, 0xc8202a, 0x2a2c30, 0xe8e2d4, 0x3a8a4a, 0xe0a020, 0x8a3ab0, 0x20a0a0];

// a bicycle, built along +z: wheels, a diamond frame, a saddle, bars, cranks
function bikeModel(color) {
  const g = new THREE.Group(), frame = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 }), black = new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.7 }), steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.8 });
  const tube = (a, b, r, m) => { const d = b.clone().sub(a), L = d.length(), t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), m); t.position.copy(a).add(b).multiplyScalar(0.5); t.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); t.castShadow = true; g.add(t); return t; };
  const R = 0.34, wf = V(0, R, 0.53), wr = V(0, R, -0.5), bb = V(0, 0.3, -0.02), seat = V(0, 0.86, -0.2), head = V(0, 0.84, 0.38);
  const wheels = [];
  for (const c of [wf, wr]) {
    const w = new THREE.Group(); w.position.copy(c); g.add(w);
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(R - 0.02, 0.025, 6, 24), black); tyre.rotation.y = Math.PI / 2; w.add(tyre);
    for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.008, 2 * (R - 0.04), 0.008), steel); s.rotation.x = (i / 8) * Math.PI; w.add(s); }
    wheels.push(w);
  }
  tube(bb, seat, 0.022, frame); tube(bb, head.clone().add(V(0, -0.1, 0)), 0.025, frame); tube(seat.clone().add(V(0, -0.06, 0)), head, 0.022, frame);
  tube(bb, wr, 0.016, frame); tube(seat.clone().add(V(0, -0.06, 0)), wr, 0.014, frame);
  tube(head, wf, 0.018, frame); // (the fork)
  tube(seat, seat.clone().add(V(0, 0.1, 0)), 0.012, steel);
  const sad = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.26), black); sad.position.copy(seat).add(V(0, 0.12, 0)); g.add(sad);
  const stem = head.clone().add(V(0, 0.16, 0.02)); tube(head, stem, 0.014, steel);
  tube(stem.clone().add(V(-0.3, 0, 0)), stem.clone().add(V(0.3, 0, 0)), 0.013, steel);
  for (const s of [-1, 1]) { const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 8), black); grip.rotation.z = Math.PI / 2; grip.position.copy(stem).add(V(s * 0.27, 0, 0)); g.add(grip); }
  const crank = new THREE.Group(); crank.position.copy(bb); g.add(crank);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 16), steel); ring.rotation.y = Math.PI / 2; crank.add(ring);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.17, 0.03), steel); arm.position.set(s * 0.07, s * 0.08, 0); crank.add(arm); const ped = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.06), black); ped.position.set(s * 0.12, s * 0.17, 0); crank.add(ped); }
  return { g, wheels, crank };
}

export class Bikes {
  constructor(g, n = 7) {
    this.g = g; this.n = n; this.list = []; this.spawnT = 0;
    this._fr = new THREE.Frustum(); this._pv = new THREE.Matrix4();
  }
  get G() { return this.g.police.graph; }
  frustum() { const cam = this.g.camera; cam.updateMatrixWorld(); return this._fr.setFromProjectionMatrix(this._pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); }

  make() {
    const m = bikeModel(pick(FRAMES));
    this.g.scene.add(m.g);
    const b = { ...m, pos: V(), yaw: 0, speed: 0, steer: 0, lean: 0, fall: 0, phase: 0, rider: null, cruise: 4 + Math.random() * 2.2, a: 0, b: 0, c: 0 };
    this.list.push(b); return b;
  }
  nextNode(a, b) {
    const G = this.G; let nb = G.adj[b].map(e => e[0]).filter(i => i !== a);
    if (!nb.length) return a;
    const th = nb.filter(i => G.adj[i].length > 1); if (th.length) nb = th;
    return pick(nb);
  }
  ground(x, z, from) {
    const g = this.g, hit = g.world.castRay(new g.R.Ray({ x, y: from + 1.2, z }, { x: 0, y: -1, z: 0 }), 4, true, g.R.QueryFilterFlags.ONLY_FIXED);
    return hit ? from + 1.2 - hit.timeOfImpact : from;
  }

  // ---- someone new, riding along a road out of sight
  spawn(first) {
    const g = this.g, G = this.G, pl = g.player, pp = pl.car ? pl.car.pos : pl.pos, fr = this.frustum();
    const lo = first ? 30 : 80, hi = first ? 140 : 160;
    for (let t = 0; t < 30; t++) {
      const a = Math.floor(Math.random() * G.nodes.length); if (!G.adj[a].length) continue;
      const b = pick(G.adj[a])[0], A = G.nodes[a], B = G.nodes[b], L = A.distanceTo(B); if (L < 20 || G.adj[b].length < 2) continue;
      const dx = (B.x - A.x) / L, dz = (B.z - A.z) / L, s = 5 + Math.random() * (L - 10);
      const x = A.x + dx * s - dz * LANE, z = A.z + dz * s + dx * LANE, d = Math.hypot(x - pp.x, z - pp.z);
      if (d < lo || d > hi || (d < 120 && fr.containsPoint(V(x, 1, z))) || !g.map.inRoad(x, z) || g.desert?.inDesert(x, z)) continue;
      const bk = this.list.find(k => k.free) || this.make(); bk.free = false;
      bk.pos.set(x, this.ground(x, z, 0.3), z); bk.yaw = Math.atan2(dx, dz); bk.speed = first ? 0 : bk.cruise; bk.fall = 0; bk.a = a; bk.b = b; bk.c = this.nextNode(a, b); bk.g.visible = true; bk.waitT = 0; bk.panicT = 0;
      const n = g.citizens.spawn(pick(['Ava', 'Lou', 'Kai', 'Bea', 'Remy', 'Ola', 'Finn', 'Ines', 'Tobi', 'Mae']), { at: bk.pos.clone() });
      n.state = 'cycling'; n.col.setEnabled(false); n.bike = bk; bk.rider = n;
      return bk;
    }
    return null;
  }

  // ---- getting on (and knocking someone off first)
  nearest(p, r = 2.2) { let best = null, bd = r; for (const b of this.list) { if (b.free || b.rider === 'you') continue; const d = Math.hypot(b.pos.x - p.x, b.pos.z - p.z); if (d < bd) { bd = d; best = b; } } return best; }
  mount(b) {
    const g = this.g, pl = g.player, C = g.citizens;
    if (b.rider && b.rider !== 'you') {
      const n = b.rider; this.dropRider(b);
      const side = V(Math.cos(b.yaw), 0, -Math.sin(b.yaw)).multiplyScalar(Math.random() < 0.5 ? 2.5 : -2.5);
      C.knock(n, V(side.x + Math.sin(b.yaw) * b.speed, 1.6, side.z + Math.cos(b.yaw) * b.speed), 3);
      n.mood = Math.min(n.mood, -60); n.mem.hitBy = (n.mem.hitBy || 0) + 1;
      C.say(n, pick(['MY BIKE!', 'Hey! Get off my bike!', 'Are you serious?!', 'That bike was a gift!']), 3);
      g.police.crime('theft', pl.pos);
    }
    if (g.props.held) g.props.drop(false);
    if (g.weapons.cur !== 'fists') g.weapons.equip('fists', true);
    b.rider = 'you'; b.fall = 0; pl.bike = b; b.speed = Math.min(b.speed, 3);
    g.hud.toast('W pedal (Shift: faster) · S brake · A/D steer · F get off', '#ffd23f');
  }
  dropRider(b) { const n = b.rider; if (n && n !== 'you') { n.bike = null; if (n.state === 'cycling') { n.state = 'wander'; n.col.setEnabled(true); } } b.rider = null; }
  dismount(bail = false) {
    const g = this.g, pl = g.player, b = pl.bike; if (!b) return;
    pl.bike = null; b.rider = null;
    const side = V(Math.cos(b.yaw), 0, -Math.sin(b.yaw)), at = b.pos.clone().addScaledVector(side, -0.6);
    pl.body.setTranslation({ x: at.x, y: at.y + 0.85, z: at.z }, true); pl.body.setNextKinematicTranslation({ x: at.x, y: at.y + 0.85, z: at.z });
    pl.vel.set(0, 0, 0); pl.yaw = b.yaw;
    if (bail || Math.abs(b.speed) > 4.5) { const s = b.speed; b.fall = 0.01; b.speed = 0; pl.knockDown(V(Math.sin(b.yaw), 0, Math.cos(b.yaw)), Math.abs(s) * 0.9); }
    else { b.speed = 0; b.fall = 0; }
  }
  panic(at, R) { for (const b of this.list) if (b.rider && b.rider !== 'you' && b.pos.distanceTo(at) < R) b.panicT = 6; }

  update(dt) {
    const g = this.g, pl = g.player; if (!pl || g.title?.active) return;
    const pp = pl.car ? pl.car.pos : pl.pos, fr = this.frustum();
    const riders = this.list.filter(b => b.rider && b.rider !== 'you').length;
    if ((this.spawnT -= dt) <= 0 && riders < this.n && g.story?.phase !== 'creator') { this.spawnT = this.filled ? 1.5 : 0.1; this.spawn(!this.filled); if (riders + 1 >= this.n) this.filled = true; }
    for (const b of this.list) {
      if (b.free) continue;
      const d = Math.hypot(b.pos.x - pp.x, b.pos.z - pp.z);
      if (b.rider === 'you') this.ride(b, dt);
      else if (b.rider) {
        const n = b.rider;
        if (n.state !== 'cycling' || n.human.ragdoll || !g.citizens.list.includes(n)) { this.dropRider(b); b.fall = 0.01; b.speed *= 0.5; } // (knocked off)
        else if (d > 200 && !fr.containsPoint(b.pos)) { g.citizens.remove(n); b.rider = null; b.free = true; b.g.visible = false; continue; }
        else this.drive(b, dt);
      } else {
        // nobody on it: it rolls to a stop and lies there (or stands, if you got off gently)
        b.speed *= Math.max(0, 1 - dt * 3);
        if (d > 200 && !fr.containsPoint(b.pos)) { b.free = true; b.g.visible = false; continue; }
      }
      if (b.fall > 0) b.fall = Math.min(1, b.fall + dt * 3);
      this.place(b, dt);
    }
  }

  // the AI: along its road, round corners, waiting for whatever's in front
  drive(b, dt) {
    const g = this.g, G = this.G, A = G.nodes[b.a], B = G.nodes[b.b], C = G.nodes[b.c], pl = g.player;
    const L = Math.max(0.01, A.distanceTo(B)), dx = (B.x - A.x) / L, dz = (B.z - A.z) / L, L2 = Math.max(0.01, B.distanceTo(C)), ex = (C.x - B.x) / L2, ez = (C.z - B.z) / L2;
    const t = (b.pos.x - A.x) * dx + (b.pos.z - A.z) * dz;
    const straight = dx * ex + dz * ez > 0.7;
    const P = straight ? V(B.x - dz * LANE, 0, B.z + dx * LANE) : V(B.x + (-dz - ez) * LANE, 0, B.z + (dx + ex) * LANE), tP = (P.x - A.x) * dx + (P.z - A.z) * dz;
    if (t > tP - 0.5) { b.a = b.b; b.b = b.c; b.c = this.nextNode(b.a, b.b); return; }
    const look = 3 + b.speed * 0.6, tl = t + look;
    const aim = tl < tP ? V(A.x + dx * tl - dz * LANE, 0, A.z + dz * tl + dx * LANE) : P.clone().addScaledVector(V(ex, 0, ez), Math.min(tl - tP, L2));
    let want = b.panicT > 0 ? 8 : b.cruise; b.panicT -= dt;
    if (!straight && tP - t < 12) want = Math.min(want, 3.2);
    // anything in front: a car, a person, you
    const f = V(Math.sin(b.yaw), 0, Math.cos(b.yaw)), r = V(f.z, 0, -f.x), ahead = (q, w = 0.9) => { const vx = q.x - b.pos.x, vz = q.z - b.pos.z, fz = vx * f.x + vz * f.z, fx = vx * r.x + vz * r.z; return fz > 0.3 && fz < 5 + b.speed && Math.abs(fx) < w ? fz : null; };
    let block = null;
    for (const c of g.cars) { if (c.inactive) continue; const z = ahead(c.pos, 1.6); if (z != null) block = Math.min(block ?? 99, z - 2.5); }
    for (const n of g.citizens.list) { if (n.state === 'cycling' || n.state === 'seated' || n.state === 'dead' || n.state === 'trunk') continue; const z = ahead(g.citizens.pos(n)); if (z != null) block = Math.min(block ?? 99, z); }
    if (!pl.car && !pl.bike) { const z = ahead(pl.pos); if (z != null) { block = Math.min(block ?? 99, z); if (z < 4 && b.speed < 0.5 && (b.bellT = (b.bellT || 0) - dt) <= 0) { b.bellT = 5; g.citizens.say(b.rider, pick(['*ding ding*', 'Excuse me!', 'Bike coming through!', '*ding*']), 2); } } }
    for (const o of this.list) { if (o === b || o.free) continue; const z = ahead(o.pos, 0.7); if (z != null) block = Math.min(block ?? 99, z - 0.8); }
    if (block != null) want = Math.min(want, Math.max(0, (block - 1.2) * 1.2));
    b.speed += THREE.MathUtils.clamp(want - b.speed, -6 * dt, 2 * dt);
    let ang = Math.atan2(aim.x - b.pos.x, aim.z - b.pos.z) - b.yaw; ang = Math.atan2(Math.sin(ang), Math.cos(ang));
    b.steer = THREE.MathUtils.clamp(ang * 1.5, -1, 1);
    b.yaw += b.steer * Math.min(1.8, b.speed * 0.45) * dt;
    b.pos.x += Math.sin(b.yaw) * b.speed * dt; b.pos.z += Math.cos(b.yaw) * b.speed * dt;
  }

  // you, riding
  ride(b, dt) {
    const g = this.g, k = g.keys, pl = g.player;
    if (pl.ragdoll || pl.dead) { pl.bike = null; b.rider = null; b.fall = 0.01; return; }
    const stuck = !!g.wheel?.open || !!g.story?.locked || !!g.wren?.phoneOpen;
    const fwd = !stuck && (k.has('KeyW') || k.has('ArrowUp')), back = !stuck && (k.has('KeyS') || k.has('ArrowDown')), run = k.has('ShiftLeft') || k.has('ShiftRight');
    const max = run ? 10 : 7;
    if (fwd) b.speed += (run ? 3.6 : 2.6) * dt * (b.speed < max ? 1 : 0);
    if (back) b.speed -= (b.speed > 0.3 ? 7 : 1.2) * dt;
    b.speed = THREE.MathUtils.clamp(b.speed - b.speed * (fwd ? 0.1 : 0.35) * dt, -1.5, max + 0.5);
    const st = stuck ? 0 : (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) - (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0);
    b.steer += (st - b.steer) * Math.min(1, dt * 6);
    b.yaw += b.steer * Math.min(2.2, Math.abs(b.speed) * 0.55 + 0.4) * dt * Math.sign(b.speed || 1);
    // walls and cars: stop dead (and over the bars if you were going fast)
    const f = V(Math.sin(b.yaw), 0, Math.cos(b.yaw)), step = b.speed * dt;
    const hit = g.world.castRay(new g.R.Ray({ x: b.pos.x, y: b.pos.y + 0.55, z: b.pos.z }, { x: f.x * Math.sign(step || 1), y: 0, z: f.z * Math.sign(step || 1) }), Math.abs(step) + 0.85, true, g.R.QueryFilterFlags.ONLY_FIXED);
    let carHit = null; for (const c of g.cars) { if (c.inactive) continue; const l = c.group.worldToLocal(b.pos.clone().addScaledVector(f, 0.9).setY(c.pos.y)); if (Math.abs(l.x) < 1.0 && Math.abs(l.z) < 2.4) { carHit = c; break; } }
    if (hit || carHit) { if (Math.abs(b.speed) > 5.5) { g.sfx?.thunk?.(b.pos); this.dismount(true); return; } b.speed = 0; }
    else { b.pos.x += f.x * step; b.pos.z += f.z * step; }
    // the player's body goes with the bike
    const y = b.pos.y;
    pl.body.setNextKinematicTranslation({ x: b.pos.x, y: y + 0.88, z: b.pos.z }); pl.vel.set(f.x * b.speed, 0, f.z * b.speed); pl.speed = Math.abs(b.speed); pl.yaw = b.yaw;
    // into deep water: off you get
    if (g.citizens.wet(b.pos.x, b.pos.z)) this.dismount(true);
  }

  // the bike in the world (and whoever's on it, posed)
  place(b, dt) {
    const g = this.g, cam = g.camera;
    b.pos.y += (this.ground(b.pos.x, b.pos.z, b.pos.y) - b.pos.y) * Math.min(1, dt * 12);
    const lean = b.fall > 0 ? -b.fall * 1.4 : -b.steer * Math.min(1, Math.abs(b.speed) / 5) * 0.3;
    b.lean += (lean - b.lean) * Math.min(1, dt * 6);
    const far = cam.position.distanceTo(b.pos) > 160;
    b.g.visible = !far; if (far && b.rider !== 'you') return;
    b.g.position.copy(b.pos); b.g.rotation.set(0, b.yaw, b.lean, 'YXZ');
    for (const w of b.wheels) w.rotation.x += b.speed * dt / 0.34;
    if (b.rider && (Math.abs(b.speed) > 0.3)) b.phase += b.speed * dt * 1.9;
    b.crank.rotation.x = b.phase;
    const H = b.rider === 'you' ? g.player.human : b.rider?.human;
    if (H) {
      const seat = V(0, 0.02, -0.17).applyEuler(b.g.rotation).add(b.pos);
      H.root.position.copy(seat); H.root.rotation.set(0, b.yaw, b.lean, 'YXZ'); H.root.visible = true;
      H.update(dt, { pose: 'bike', pedal: b.phase, steer: b.steer, speed: 0, grounded: true, talking: b.rider !== 'you' && b.rider.bubbleT > 0 });
      if (b.rider !== 'you') { const n = b.rider; n.body.setNextKinematicTranslation({ x: b.pos.x, y: b.pos.y + 0.78, z: b.pos.z }); n.yaw = b.yaw; }
    }
  }
}
