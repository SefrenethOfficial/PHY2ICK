// The police: wanted stars (five), crimes and witnesses, cop cars that find their way to you along the
// roads, cops on foot who arrest you (one star) or shoot (two and up), losing them, and getting BUSTED.
import * as THREE from 'three';
import { Car } from './car.js';
import { randomLook, SKIN, HAIR } from './character.js';
import { G_WORLD, groups } from './world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// how bad each thing is (the least it gets you), and whether it needs a witness
const CRIMES = {
  assault: 1, gunfire: 1, carjack: 1, ramCop: 1, explosion: 1, threat: 1,
  murder: 2, robbery: 2, kidnap: 2, copAssault: 3, copMurder: 4, drugs: 1,
};

// ---- the roads as a graph: every end and crossing is a node; A* finds the way
function buildGraph(segs) {
  const nodes = [], adj = [];
  const nodeAt = (x, z) => {
    for (let i = 0; i < nodes.length; i++) if (Math.hypot(nodes[i].x - x, nodes[i].z - z) < 5) return i;
    nodes.push(V(x, 0, z)); adj.push([]); return nodes.length - 1;
  };
  for (const s of segs) {
    const ts = [0, s.L];
    for (const o of segs) {
      if (o === s) continue;
      const den = s.u[0] * o.u[1] - s.u[1] * o.u[0]; if (Math.abs(den) < 1e-3) continue;
      const dx = o.a[0] - s.a[0], dz = o.a[1] - s.a[1];
      const t = (dx * o.u[1] - dz * o.u[0]) / den, t2 = (dx * s.u[1] - dz * s.u[0]) / den;
      if (t > -4 && t < s.L + 4 && t2 > -4 && t2 < o.L + 4) ts.push(Math.max(0, Math.min(s.L, t)));
    }
    ts.sort((a, b) => a - b);
    let prev = -1, lastT = -99;
    for (const t of ts) {
      if (t - lastT < 2) continue; lastT = t;
      const id = nodeAt(s.a[0] + s.u[0] * t, s.a[1] + s.u[1] * t);
      if (prev >= 0 && prev !== id) { const d = nodes[prev].distanceTo(nodes[id]); adj[prev].push([id, d]); adj[id].push([prev, d]); }
      prev = id;
    }
  }
  return { nodes, adj };
}
function nearest(G, p) { let b = 0, bd = Infinity; for (let i = 0; i < G.nodes.length; i++) { const d = (G.nodes[i].x - p.x) ** 2 + (G.nodes[i].z - p.z) ** 2; if (d < bd) { bd = d; b = i; } } return b; }
function astar(G, a, b) {
  const N = G.nodes.length, gS = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), open = new Set([a]), done = new Uint8Array(N);
  const h = (i) => G.nodes[i].distanceTo(G.nodes[b]);
  gS[a] = 0; const f = new Float64Array(N).fill(Infinity); f[a] = h(a);
  while (open.size) {
    let cur = -1, cf = Infinity; for (const i of open) if (f[i] < cf) { cf = f[i]; cur = i; }
    if (cur === b) break;
    open.delete(cur); done[cur] = 1;
    for (const [nb, d] of G.adj[cur]) { if (done[nb]) continue; const t = gS[cur] + d; if (t < gS[nb]) { gS[nb] = t; from[nb] = cur; f[nb] = t + h(nb); open.add(nb); } }
  }
  const path = []; for (let i = b; i >= 0; i = from[i]) { path.unshift(i); if (i === a) break; }
  return path[0] === a ? path : [a, b];
}

export class Police {
  constructor(g) {
    this.g = g;
    this.stars = 0; this.seen = false; this.searchT = 0; this.seenT = 0; this.lastKnown = null;
    this.cars = []; // cop cars in play: { car, crew: [npc], route, wpI, routeT, stuckT, revT }
    this.pool = [];
    this.spawnT = 0;
    this.graph = buildGraph(g.map.segs);
  }

  // ---- crimes: the police only come for you if a cop sees it, or a witness calls it in (and lives to)
  los(from, to, range) {
    const g = this.g, d = from.distanceTo(to); if (d > range) return false; if (d < 4) return true;
    const dir = to.clone().sub(from).normalize();
    return !g.world.castRay(new g.R.Ray(from, dir), d - 0.6, true, undefined, groups(0xffff, G_WORLD));
  }
  copSees(at) {
    const g = this.g, k = g.player.crouch ? 0.55 : 1, to = at.clone().add(V(0, 1.1, 0));
    for (const n of this.cops()) { if (n.state === 'seated' || n.state === 'dead' || n.human.ragdoll) continue; if (this.los(g.citizens.pos(n).add(V(0, 1.6, 0)), to, 55 * k)) return true; }
    for (const c of this.cars) { if (c.car.wrecked || c.car.inactive || !c.crew.some(n => n.state === 'seated' && n.car === c.car)) continue; if (this.los(c.car.pos.clone().add(V(0, 1.3, 0)), to, 65 * k)) return true; }
    return false;
  }
  // who saw it: people facing it (or close by, or it was loud), with a clear line to it
  witnessesOf(at, loud) {
    const g = this.g, C = g.citizens, crouch = g.player.crouch, R = loud ? 40 : crouch ? 13 : 30, to = at.clone().add(V(0, 1.1, 0)), out = [];
    for (const n of C.list) {
      if (n.cop || n.state === 'dead' || n.state === 'seated' || n.state === 'trunk' || n.human.ragdoll || n.hostage || n.undercover) continue;
      const q = C.pos(n), d = q.distanceTo(at); if (d > R || d < 0.3) continue;
      const f = V(Math.sin(n.yaw), 0, Math.cos(n.yaw)), dir = at.clone().sub(q).setY(0).normalize();
      if (!loud && d > 5 && f.dot(dir) < -0.25) continue; // (behind them, and quiet)
      if (!this.los(q.clone().add(V(0, 1.6, 0)), to, R)) continue;
      out.push([d, n]);
    }
    return out.sort((a, b) => a[0] - b[0]).map(a => a[1]);
  }
  crime(kind, at, always = false, known = false) {
    const g = this.g, base = CRIMES[kind] ?? 1, C = g.citizens;
    if (g.player.dead || g.busted) return;
    // a cop saw it (or they're already after you and watching): straight to stars
    if (known || (this.stars && this.seen) || this.copSees(at)) { this.escalate(base); return; }
    // an alarm, or the victim: a call that goes out on its own
    if (always) { this.calls = this.calls || []; this.calls.push({ level: base, at: at.clone(), t: 4 }); return; }
    // otherwise: witnesses, who'll call it in if you let them
    const loud = kind === 'gunfire' || kind === 'explosion';
    const ws = this.witnessesOf(at, loud).slice(0, 2);
    for (const n of ws) {
      if (n.witness) { n.witness.level = Math.max(n.witness.level, base); continue; }
      n.witness = { level: base, at: at.clone(), t: 3.5 + Math.random() * 3 };
      if (n.state !== 'handsUp' && !n.home) { n.state = 'flee'; n.stateT = 12; }
      C.say(n, pick(["I'm calling the police!", 'Police? Yes, I want to report…', '911! Someone just…', 'I saw that! I saw your face!']), 2.5);
    }
    if (ws.length) g.hud.toast(ws.length > 1 ? 'Witnesses are calling the police' : 'A witness is calling the police', '#ffb04a');
  }
  escalate(base) {
    const g = this.g, before = this.stars;
    let s = Math.max(this.stars, base);
    if (this.stars >= base && base >= 2) s = this.stars + 1; // (doing it again, when they're already after you)
    this.stars = Math.min(5, s); this.suspect = null;
    if (this.stars > before) { this.seen = true; this.searchT = 0; this.graceT = 18; /* (they know where you are for a while) */ this.lastKnown = (g.player.car ? g.player.car.pos : g.player.pos).clone(); if (before === 0) g.hud.toast(pick(['The police are after you.', "They know it was you.", 'You\'re wanted.']), '#ff5a5a'); }
  }
  // a call came in: they know what happened and roughly what you look like, not where you are.
  // A car comes to have a look; if a cop then sees you, that's you.
  reported(level, at, why = 'witness', who = null) {
    const g = this.g;
    if (g.player.dead || g.busted) return;
    if (this.stars) { this.escalate(level); return; }
    const was = this.suspect;
    this.suspect = { level: Math.max(level, was?.level || 0), at: at.clone(), t: 100 + level * 30 };
    if (!was) g.hud.toast({ witness: 'A witness has described you to the police. Stay out of sight.', fumes: 'The police are coming to check on the smell.', fire: 'The fire brigade and the police are on their way.', dealing: "Someone's tipped off the police about the dealing.", alarm: 'The alarm went off: the police are on their way.' }[why] || 'You\'ve been reported to the police.', '#ffb04a');
    if (!this.cars.some(c => c.investigate && !c.car.wrecked)) { const c = this.spawnCar(); if (c) { c.investigate = true; c.car.siren = false; } }
  }
  clear() {
    this.stars = 0; this.seen = false; this.suspect = null;
    for (const n of this.cops()) n.copMode = n.patrol ? 'patrol' : 'leave';
    for (const c of this.cars) { c.car.siren = false; c.leaving = true; }
  }

  cops() { return this.g.citizens.list.filter(n => n.cop && n.state !== 'dead'); }

  // ---- cop cars: a few made up front (hidden), so a chase never stalls while one's built
  getCar() {
    let c = this.pool.find(c => c.inactive && !c.wrecked);
    if (!c) { c = new Car(this.g, V(0, -200, 0), 0, 0x16181c, 'Police Cruiser', { police: true }); this.g.cars.push(c); this.park(c); }
    return c;
  }
  park(c) { c.inactive = true; c.group.visible = false; const k = this.pool.includes(c) ? this.pool.indexOf(c) : this.pool.length; c.body.setGravityScale(0, true); c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); c.body.setAngvel({ x: 0, y: 0, z: 0 }, true); c.body.setTranslation({ x: 3000 + k * 20, y: -400, z: 3000 }, true); // (kept out of the way, floating, until it's needed)
    c.siren = false; c.ai = null; if (!this.pool.includes(c)) this.pool.push(c); }
  warm(n = 3) { for (let i = 0; i < n; i++) { const c = new Car(this.g, V(0, -200, 0), 0, 0x16181c, 'Police Cruiser', { police: true }); this.g.cars.push(c); this.park(c); } }

  makeCop(at) {
    const look = randomLook(); Object.assign(look, { hairStyle: 'cap', shirt: 0x24324e, pants: 0x1b1d22, shoes: 0x111111, longSleeves: true });
    const n = this.g.citizens.spawn('Officer ' + pick(['Hale', 'Ortiz', 'Brandt', 'Novak', 'Price', 'Kowalski', 'Reyes', 'Dunn', 'Marsh', 'Okafor', 'Lund', 'Vega']), { at, look, cop: true });
    this.g.weapons.giveModel(n.human, 'pistol');
    return n;
  }

  spawnCar() {
    const g = this.g, G = this.graph, pp = g.player.car ? g.player.car.pos : g.player.pos;
    // a road node out of sight, 90–160 m away
    const cam = g.camera; cam.updateMatrixWorld(); const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const cands = [];
    for (let i = 0; i < G.nodes.length; i++) { const q = G.nodes[i], d = q.distanceTo(pp.clone().setY(0)); if (d > 90 && d < 170 && !fr.containsPoint(q.clone().setY(1)) && G.adj[i].length && !this.cars.some(c => c.car.pos.distanceTo(q) < 45)) cands.push(i); } // (not on top of another one)
    if (!cands.length) return;
    const i = pick(cands), q = G.nodes[i], nb = G.nodes[pick(G.adj[i])[0]];
    const yaw = Math.atan2(nb.x - q.x, nb.z - q.z);
    const car = this.getCar();
    const qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
    car.body.setGravityScale(1, true); car.body.setTranslation({ x: q.x, y: 0.75, z: q.z }, true); car.body.setRotation(qq, true);
    car.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    car.group.position.set(q.x, 0.75, q.z); car.group.quaternion.copy(qq); car.group.updateMatrixWorld(true); // (right away: it's checked before it's next drawn)
    car.inactive = false; car.group.visible = true; car.hp = 1000; car.burning = false; car.siren = true; car.lastV.set(0, 0, 0);
    car.ai = { throttle: 0, brake: 0, steer: 0 };
    const crew = [this.makeCop(q.clone()), this.makeCop(q.clone())];
    crew.forEach((n, k) => { n.state = 'seated'; n.col.setEnabled(false); n.car = car; n.seat = k ? 'passenger' : 'driver'; car.seatPerson(n.human, n.seat); n.human.root.visible = true; });
    car.crew = crew;
    const rec = { car, crew, route: null, wpI: 0, routeT: 0, stuckT: 0, revT: 0, leaving: false };
    this.cars.push(rec); return rec;
  }

  // cops get out (near you, or their car's done)
  disembark(c) {
    const g = this.g;
    for (const n of c.crew) {
      if (n.state !== 'seated' || n.car !== c.car) continue;
      c.car.unseat(n.human); g.scene.add(n.human.root); c.car.openDoor(n.seat, 0.9);
      const out = c.car.doorPoint(n.seat, 0.9);
      n.body.setTranslation({ x: out.x, y: out.y + 1.0, z: out.z }, true); n.body.setNextKinematicTranslation({ x: out.x, y: out.y + 1.0, z: out.z });
      n.col.setEnabled(true); n.state = 'cop'; n.copMode = this.stars ? 'chase' : 'leave'; n.vy = 0;
    }
    c.car.ai.throttle = 0; c.car.ai.brake = 1; c.car.siren = this.stars > 0;
  }
  embark(c, n) {
    n.state = 'seated'; n.col.setEnabled(false); n.car = c.car; c.car.seatPerson(n.human, n.seat); c.car.openDoor(n.seat, 0.7);
  }

  // ---- driving: along the roads to the target, straight at it when it's close
  drive(c, target, dt, { stopAt = 0, ram = false } = {}) {
    const g = this.g, car = c.car, ai = car.ai, G = this.graph;
    const pos = car.pos, spd = car.speed;
    c.routeT -= dt;
    if (!c.route || c.routeT <= 0) {
      c.routeT = 1.5; const a = nearest(G, pos), b = nearest(G, target); c.route = astar(G, a, b).map(i => G.nodes[i]); c.wpI = 0;
      // (don't turn back for a corner it's already past)
      if (c.route.length > 1) { const l0 = car.group.worldToLocal(c.route[0].clone().setY(pos.y)), d0 = Math.hypot(l0.x, l0.z); if (l0.z < 2 || d0 < 14) c.route.shift(); }
    }
    const dT = Math.hypot(target.x - pos.x, target.z - pos.z);
    let wp = target;
    if (dT > 40) {
      while (c.wpI < c.route.length - 1) { const w = c.route[c.wpI]; const loc = car.group.worldToLocal(w.clone().setY(pos.y)); const dw = Math.hypot(w.x - pos.x, w.z - pos.z); if (dw < 12 || (loc.z < 3 && dw < 25)) c.wpI++; else break; }
      wp = c.route[Math.min(c.wpI, c.route.length - 1)];
    }
    const loc = car.group.worldToLocal(V(wp.x, pos.y, wp.z));
    let ang = Math.atan2(loc.x, loc.z);
    // reversing out of being stuck
    if (c.revT > 0) { c.revT -= dt; ai.throttle = -0.8; ai.brake = 0; ai.steer = -Math.sign(ang) || 1; ai.handbrake = false; return; }
    let want = 26 * (1 - Math.min(0.75, Math.abs(ang) / 1.1));
    { const nx = c.route?.[c.wpI + 1]; if (nx && dT > 40) { const dw = Math.hypot(wp.x - pos.x, wp.z - pos.z); const a2 = Math.abs(Math.atan2(nx.x - wp.x, nx.z - wp.z) - Math.atan2(wp.x - pos.x, wp.z - pos.z)); const turn = Math.min(Math.PI, Math.min(a2, Math.PI * 2 - a2)); if (dw < 35) want = Math.min(want, 26 - turn * 9); } } // (slow for the corner coming up)
    if (stopAt) want = Math.min(want, Math.max(0, (dT - stopAt) * 0.9));
    if (!ram) want = Math.min(want, 5 + dT * 0.32); // (ease off as it gets close: no ploughing in)
    if (ram && dT < 30) want = Math.max(want, 22);
    if (Math.abs(ang) > 1.9 && dT < 25) { ai.throttle = -0.7; ai.steer = -Math.sign(ang); ai.brake = 0; return; } // (it's behind: back round)
    ai.steer = THREE.MathUtils.clamp(ang * (spd > 15 ? 1.4 : 2.2), -1, 1);
    // other cars in the way (not the one it's ramming): slow down, and steer round them
    const look = 5 + Math.max(0, spd) * 0.9;
    for (const o of g.cars) {
      if (o === car || o.inactive || (ram && o === g.player.car)) continue;
      const l = car.group.worldToLocal(o.pos.clone()); if (l.z < 0 || l.z > look || Math.abs(l.x) > 3.2) continue;
      const k = 1 - l.z / look;
      want = Math.min(want, Math.max(o === g.player.car ? 0 : 2, Math.abs(o.speed) * 0.8 + (l.z - 5) * 0.8));
      ai.steer = THREE.MathUtils.clamp(ai.steer - Math.sign(l.x || 1) * k * 0.9, -1, 1);
    }
    ai.throttle = spd < want - 1 ? 1 : 0; ai.brake = spd > want + 3 ? 1 : 0; ai.handbrake = false;
    if (ai.throttle > 0 && Math.abs(spd) < 1) { c.stuckT += dt; if (c.stuckT > 1.4) { c.stuckT = 0; c.revT = 1.1; } } else c.stuckT = 0;
  }

  // can a cop at `from` see you?
  sees(from, range) {
    const g = this.g, pl = g.player, tp = (pl.car ? pl.car.pos : pl.pos).clone().add(V(0, 1.2, 0));
    const d = from.distanceTo(tp); if (d > range) return false; if (d < 30) return true; // (close by, they'll find you round a corner)
    const dir = tp.clone().sub(from).normalize();
    const hit = g.world.castRay(new g.R.Ray(from, dir), d - 1, true, undefined, groups(0xffff, G_WORLD));
    return !hit;
  }

  // ---- a cop on foot (called from the citizens' update): where to go and how fast
  copThink(n, p, h) {
    const g = this.g, pl = g.player, pp = pl.car ? pl.car.pos : pl.pos, d = Math.hypot(pp.x - p.x, pp.z - p.z);
    n.shootT = (n.shootT ?? 1) - h; n.aimAt = null;
    if (!this.stars && !pl.dead && ['patrol', 'investigate', 'frisk'].includes(n.copMode)) return this.beat(n, p, h, d);
    if (!this.stars && !pl.dead && n.copMode !== 'leave' && this.suspect && n.car) { n.copMode = 'investigate'; return this.beat(n, p, h, d); }
    if (n.copMode === 'leave' || !this.stars || pl.dead) {
      n.copMode = 'leave';
      const c = this.cars.find(c => c.car === n.car && !c.car.wrecked && !c.car.inactive);
      if (c && n.car.pos.distanceTo(p) < 40) { if (n.car.pos.distanceTo(p) < 2.8) { this.embark(c, n); return { goal: null, spd: 0 }; } return { goal: n.car.doorPoint(n.seat, 0.6), spd: 2.4 }; }
      n.leaveT = (n.leaveT || 0) + h;
      return { goal: p.clone().add(V(Math.sin(n.yaw) * 5, 0, Math.cos(n.yaw) * 5)), spd: 1.4 };
    }
    // back in the car if you've driven off
    const c = this.cars.find(c => c.car === n.car && !c.car.wrecked && !c.car.inactive);
    if (pl.car && Math.abs(pl.car.speed) > 6 && d > 22 && c && n.car.pos.distanceTo(p) < 30) {
      if (n.car.pos.distanceTo(p) < 2.8) { this.embark(c, n); return { goal: null, spd: 0 }; }
      return { goal: n.car.doorPoint(n.seat, 0.6), spd: 5 };
    }
    const tp = pp.clone().add(V(0, 1.2, 0)), from = p.clone().add(V(0, 1.45, 0));
    const see = this.sees(from, 75);
    // arrest: one star, or you've given up, or you're on the floor
    if ((this.stars <= 1 || pl.surrender || (pl.ragdoll && this.stars <= 2)) && !pl.car) {
      if (d < 1.6 && (pl.surrender || pl.ragdoll || pl.speed < 1.2)) {
        n.arrestT = (n.arrestT || 0) + h; n.cuffing = true;
        if (n.arrestT > 1.3) g.endScreen('busted');
        return { goal: null, spd: 0, face: pp };
      }
      n.arrestT = 0; n.cuffing = false;
      if (d < 18 && Math.random() < h * 0.25) g.citizens.say(n, pick(['Stop! Police!', "Don't move!", 'Hands where I can see them!', 'On the ground!']), 2);
      return { goal: pp, spd: d > 4 ? 5.2 : 2.6 };
    }
    n.cuffing = false; n.arrestT = 0;
    // shooting: keep some distance, fire when they can see you
    if (see && d < 45) {
      n.aimAt = tp;
      if (n.shootT <= 0) { n.shootT = 0.9 + Math.random() * 0.9 - this.stars * 0.06; this.copShoot(n, from, tp, d); }
      // each keeps their own distance and angle, so they spread round you instead of bunching up
      if (n.prefD == null) { n.prefD = 8 + Math.random() * 8; n.flank = (Math.random() - 0.5) * 1.6; }
      const away = Math.atan2(p.x - pp.x, p.z - pp.z), want = away + n.flank * 0.25;
      const spot = pp.clone().add(V(Math.sin(want) * n.prefD, 0, Math.cos(want) * n.prefD));
      if (d < n.prefD - 3 || d > n.prefD + 4 || spot.distanceTo(p) > 3) return { goal: spot, spd: d > n.prefD + 6 ? 4 : 2.2, face: pp };
      return { goal: null, spd: 0, face: pp };
    }
    const lk = this.lastKnown || pp;
    return { goal: see ? pp : lk, spd: 5.4 };
  }

  // ---- on the beat (no stars): walking about; looking for whoever was reported; stopping and searching people
  illegalOnYou() {
    const g = this.g, W = g.weapons;
    return ['pistol', 'shotgun', 'hatchet'].filter(id => W.inv.has(id)).map(id => ({ pistol: 'a pistol', shotgun: 'a shotgun', hatchet: 'a hatchet' })[id]).concat(g.drugs.count ? [`${g.drugs.count} bag${g.drugs.count > 1 ? 's' : ''} of Physick`] : []);
  }
  beat(n, p, h, d) {
    const g = this.g, pl = g.player, C = g.citizens, pp = pl.pos;
    n.friskCool = (n.friskCool || 0) - h; n.warnT = n.warnT ?? 0;
    const near = d < 18 && !pl.car && this.los(p.clone().add(V(0, 1.6, 0)), pp.clone().add(V(0, 1.1, 0)), 18 * (pl.crouch ? 0.55 : 1));
    if (near) {
      // they recognise you from the description
      if (this.suspect) { C.say(n, pick(["That's them! That's the one from the call!", 'Hey! You match the description!', 'Stop right there!']), 2.5); this.escalate(this.suspect.level); return { goal: pp, spd: 5 }; }
      // a weapon out, in plain sight
      const W = g.weapons, out = (W.aiming && W.cur !== 'fists') || ['pistol', 'shotgun', 'hatchet'].includes(W.cur);
      if (out) {
        if (W.aiming && g.aimedAt === n) { C.say(n, "He's pointing a weapon at me!", 2); this.escalate(2); return { goal: pp, spd: 5 }; }
        if (n.warnT <= 0) { n.warnT = 3.2; C.say(n, pick(['Drop the weapon!', 'Put it away! Now!', 'Whoa. Weapon down!']), 2.5); }
        n.warnT -= h; if (n.warnT <= 0.05) { this.escalate(1); return { goal: pp, spd: 5 }; }
        return { goal: null, spd: 0, face: pp };
      }
      n.warnT = 0;
      // a stop-and-search: now and then, or if you're running about near them
      if (n.copMode !== 'frisk' && n.friskCool <= 0 && d < 12 && (pl.speed > 4.5 || Math.random() < h * 0.06)) {
        n.copMode = 'frisk'; n.friskT = 0; n.friskCool = 120; C.say(n, pick(['Hey, you. Hold it right there.', 'Stop. Random search. Hands where I can see them.', 'You. Over here. Now.']), 3);
        g.hud.toast('A cop wants to search you · stand still and let them (or run)', '#9ad0ff');
      }
    }
    if (n.copMode === 'frisk') {
      if (pl.car || d > 9) { C.say(n, 'Hey! Stop!', 2); n.copMode = n.patrol ? 'patrol' : 'investigate'; this.escalate(1); return { goal: pp, spd: 5 }; }
      if (d > 1.3) return { goal: pp, spd: 2.6 };
      if (pl.speed < 0.8) n.friskT += h;
      n.frisking = true;
      if (n.friskT > 2.6) {
        n.frisking = false; n.copMode = n.patrol ? 'patrol' : 'investigate';
        const found = this.illegalOnYou();
        if (found.length) { C.say(n, `Well, well. ${found[0][0].toUpperCase() + found[0].slice(1)}. You're under arrest.`, 3); g.hud.toast(`They found ${found.join(', ')}`, '#ff5a5a'); this.escalate(1); }
        else C.say(n, pick(["You're clean. Move along.", 'Alright. Off you go.', 'Nothing. Have a nice day.']), 2.5);
      }
      return { goal: null, spd: 0, face: pp };
    }
    n.frisking = false;
    // investigating a call: wander round where it happened
    if (n.copMode === 'investigate' && this.suspect) {
      if (!n.searchPt || n.searchPt.distanceTo(p) < 1.5 || (n.searchT = (n.searchT || 0) - h) <= 0) { n.searchT = 6; const a = Math.random() * 6.28, r = 4 + Math.random() * 22; n.searchPt = this.suspect.at.clone().add(V(Math.sin(a) * r, 0, Math.cos(a) * r)); n.searchPt.y = p.y; }
      return { goal: n.searchPt, spd: 1.8 };
    }
    if (n.copMode === 'investigate') { n.copMode = 'leave'; return { goal: null, spd: 0 }; }
    // a patrol: along the sidewalks
    if (!n.target || n.target.distanceTo(p) < 1.5) n.target = C.randomPoint(p);
    return { goal: n.target, spd: 1.35 };
  }

  copShoot(n, from, tp, d) {
    const g = this.g, pl = g.player;
    const hand = new THREE.Vector3(); n.human.b.wristR.getWorldPosition(hand);
    const dir = tp.clone().sub(hand).normalize();
    const muzzle = hand.clone().addScaledVector(dir, 0.25);
    g.fx.muzzle(muzzle, dir); g.sfx.shot(muzzle);
    const moving = pl.car ? Math.abs(pl.car.speed) : pl.speed;
    const chance = THREE.MathUtils.clamp(0.5 - d * 0.011 - moving * 0.04 + (this.stars - 2) * 0.05, 0.06, 0.6);
    let end;
    if (Math.random() < chance) {
      end = tp.clone().add(V((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.3));
      if (pl.car) { pl.car.damage(18, end, 'shot'); g.fx.sparks(end, dir.clone().negate(), 6, 3); if (Math.random() < 0.25) pl.hurt(5 + Math.random() * 5, dir, 'shot'); }
      else pl.hurt(4 + Math.random() * 5, dir, 'shot');
    } else {
      const miss = tp.clone().add(V((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 2.5));
      const md = miss.clone().sub(muzzle).normalize();
      const hit = g.world.castRay(new g.R.Ray(muzzle, md), 80, true, undefined, groups(0xffff, G_WORLD));
      end = hit ? muzzle.clone().addScaledVector(md, hit.timeOfImpact) : muzzle.clone().addScaledVector(md, 60);
      if (hit) g.fx.sparks(end, md.clone().negate(), 5, 2);
    }
    g.fx.tracer(muzzle, end);
  }

  // ---- every frame
  update(dt) {
    const g = this.g, pl = g.player, pp = pl.car ? pl.car.pos : pl.pos;
    g.sfx.musicOn = this.stars > 0 && !pl.dead;
    // can any of them see you?
    this.seeT = (this.seeT || 0) - dt;
    if (this.stars && this.seeT <= 0) {
      this.seeT = 0.3;
      let seen = false;
      for (const n of this.cops()) { if (n.state === 'seated') continue; if (this.sees(g.citizens.pos(n).add(V(0, 1.5, 0)), 70)) { seen = true; break; } }
      if (!seen) for (const c of this.cars) { if (c.car.wrecked || c.car.inactive || !c.crew.some(n => n.state === 'seated' && n.car === c.car)) continue; if (this.sees(c.car.pos.clone().add(V(0, 1.3, 0)), 95)) { seen = true; break; } }
      if (this.graceT > 0) seen = true;
      this.seen = seen;
      if (seen) { this.lastKnown = pp.clone(); this.searchT = 0; }
    }
    if (this.graceT > 0) this.graceT -= dt;
    // calls coming in (alarms, victims)
    if (this.calls) for (let i = this.calls.length - 1; i >= 0; i--) { const c = this.calls[i]; c.t -= dt; if (c.t <= 0) { this.calls.splice(i, 1); this.reported(c.level, c.at, 'alarm'); } }
    // a description out: it runs out after a while
    if (this.suspect && !this.stars) { this.suspect.t -= dt; if (this.suspect.t <= 0) { this.suspect = null; for (const c of this.cars) if (c.investigate) { c.leaving = true; } for (const n of this.cops()) if (n.copMode === 'investigate') n.copMode = 'leave'; g.hud.toast('The police have stopped looking for you.', '#7be08a'); } }
    // the beat: a few cops on foot about town
    this.patrolT = (this.patrolT || 0) - dt;
    if (this.patrolT <= 0) {
      this.patrolT = 5;
      const pats = this.cops().filter(n => n.patrol);
      for (const n of pats) if (g.citizens.pos(n).distanceTo(pp) > 260) this.removeCop(n);
      if (pats.length < 4) { const at = g.citizens.randomPoint(pp.clone().add(V((Math.random() - 0.5) * 300, 0, (Math.random() - 0.5) * 300))); if (at.distanceTo(pp) > 60) { const n = this.makeCop(at); n.patrol = true; n.copMode = this.stars ? 'chase' : 'patrol'; } }
    }
    if (this.stars) {
      if (!this.seen) {
        // they're searching: it only really counts once you're out of the area they last saw you in
        const zone = 70 + this.stars * 25, out = !this.lastKnown || pp.distanceTo(this.lastKnown) > zone;
        this.searchT += dt * (out ? 1 : 0.3);
        this.outOfZone = out;
        if (this.searchT > 22 + this.stars * 9) { g.hud.toast(pick(['You lost them.', 'The heat dies down.', 'They\'ve lost you.']), '#7be08a'); this.clear(); }
      }
      // keep the right number of cars coming
      const want = this.stars, have = this.cars.filter(c => !c.car.wrecked && !c.leaving).length;
      this.spawnT -= dt;
      if (have < want && this.spawnT <= 0) { this.spawnT = 3.5; this.spawnCar(); }
    }
    // drive the cars
    const active = this.cars.filter(c => !c.car.wrecked && !c.car.inactive && !c.leaving).sort((a, b) => a.car.pos.distanceTo(pp) - b.car.pos.distanceTo(pp));
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i], car = c.car;
      const aboard = c.crew.filter(n => n.state === 'seated' && n.car === car);
      const gone = c.crew.every(n => n.state === 'dead' || n.removed);
      const far = car.pos.distanceTo(pp) > 110;
      if (car.wrecked || gone || (c.leaving && far && aboard.length === c.crew.filter(n => n.state !== 'dead').length) || car.pos.distanceTo(pp) > 320) {
        if (!car.wrecked && (far || gone)) { for (const n of c.crew) if (n.state !== 'dead') this.removeCop(n); if (!car.wrecked) this.park(car); this.cars.splice(i, 1); continue; }
        if (car.wrecked) { car.ai = null; c.crew.forEach(n => { if (n.state === 'seated' && n.car === car) { car.unseat(n.human); g.scene.add(n.human.root); n.state = 'dead'; n.human.dead = true; n.deadT = 60; n.col.setEnabled(false); n.human.root.visible = false; } }); this.cars.splice(i, 1); continue; }
      }
      if (!car.ai) continue;
      if (!aboard.length || !aboard.some(n => n.seat === 'driver')) { car.ai.throttle = 0; car.ai.brake = 1; car.ai.steer = 0; continue; }
      if (c.investigate && !this.stars && this.suspect && !c.leaving) {
        car.siren = false;
        const d = car.pos.distanceTo(this.suspect.at);
        if (d < 16) { this.disembark(c); for (const n of c.crew) if (n.state === 'cop') n.copMode = 'investigate'; continue; }
        this.drive(c, this.suspect.at, dt, { stopAt: 10 }); continue;
      }
      if (c.leaving || !this.stars) { car.siren = false; const away = c.away || (c.away = this.graph.nodes[Math.floor(Math.random() * this.graph.nodes.length)]); this.drive(c, away, dt); continue; }
      car.siren = true;
      const target = this.seen ? pp : (this.lastKnown || pp), d = car.pos.distanceTo(target);
      const rank = active.indexOf(c); // (how close it is, of all of them: only the nearest two go in hard)
      if (!pl.car) {
        // on foot: each car pulls up at its own spot round you (not all in a heap), and out they get
        if (!c.slot || c.slotT <= 0) { const a0 = Math.atan2(car.pos.x - target.x, car.pos.z - target.z) + (rank % 2 ? 0.7 : -0.7) * Math.ceil(rank / 2); c.slot = a0; c.slotT = 6; }
        c.slotT -= dt;
        const r = 11 + rank * 2.5, spot = target.clone().add(V(Math.sin(c.slot) * r, 0, Math.cos(c.slot) * r));
        const sd = car.pos.distanceTo(spot);
        if ((this.seen && (sd < 5 || (d < 18 && Math.abs(car.speed) < 3))) || (!this.seen && d < 14)) { this.disembark(c); continue; }
        this.drive(c, d < 45 ? spot : target, dt, { stopAt: d < 45 ? 2 : 0 });
      } else {
        // in a car: the nearest two chase and ram; the rest follow a little back
        const v = pl.car.body.linvel(), lead = target.clone().addScaledVector(V(v.x, 0, v.z), 0.4);
        if (!this.seen) { if (d < 14) { this.disembark(c); continue; } this.drive(c, target, dt); }
        else if (rank < 2) this.drive(c, lead, dt, { ram: this.stars >= 2 });
        else this.drive(c, lead.clone().addScaledVector(pl.car.forward, -12 - rank * 6), dt);
      }
    }
    // cops who've walked off once it's over
    for (const n of this.cops()) if (n.copMode === 'leave' && n.state !== 'seated' && (n.leaveT || 0) > 6 && g.citizens.pos(n).distanceTo(pp) > 45) this.removeCop(n);
  }

  removeCop(n) {
    const g = this.g; n.removed = true;
    if (n.state === 'seated' && n.car) n.car.unseat(n.human);
    g.citizens.remove(n);
  }

  // you got caught
  busted() {
    const g = this.g;
    this.clear();
    for (const c of [...this.cars]) { for (const n of c.crew) if (n.state !== 'dead') this.removeCop(n); if (!c.car.wrecked) this.park(c.car); }
    this.cars = [];
    for (const n of this.cops()) this.removeCop(n);
  }
}
