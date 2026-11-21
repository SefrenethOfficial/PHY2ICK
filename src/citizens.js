// Citizens: people who wander the park, sit on benches, and remember how you treated them.
import * as THREE from 'three';
import { Human, randomLook } from './character.js';
import { G_WORLD, G_CAR, G_PED, G_PROP, groups } from './world.js';
import { Ragdoll } from './ragdoll.js';
import { RW, SW } from './city.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const HALF = 0.5, RAD = 0.28, CENTRE = HALF + RAD;
const NAMES = ['Dana', 'Marcus', 'Priya', 'Tomás', 'Hannah', 'Kofi', 'Lena', 'Jun', 'Rosa', 'Eli', 'Nadia', 'Owen', 'Ines', 'Theo', 'Mara', 'Sam', 'Yusuf', 'Clara', 'Dev', 'Ruth'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// what people talk about: the city's on edge after the lockdown
const GOSSIP = [
  "Did you see the news? They still haven't said who really blew up those flats in the Hollows.",
  'Army trucks went past the naval base again last night. Nobody will say why.',
  "My cousin works the docks. Says a ship came in with no flag. Next morning it was just… gone.",
  "Pratt's out on bail, they reckon. Money talks in this town.",
  "They lifted the lockdown, but it doesn't feel lifted, you know?",
  'Someone painted MERIDIAN on the underpass. Council had it scrubbed off by lunch.',
  "Hey… you look familiar. Were you on Channel 6?",
  "There's more police around than before the lockdown, not fewer. Funny, that.",
];
const SMALL = [
  'Nice day for it, at least.', "I'm just on my lunch break.", 'Have you tried the coffee at Café Noir? Burnt. Every time.',
  "I come here to get away from my phone. Doesn't work.", "Don't step on the grass, the council's got cameras now.",
];

export class Citizens {
  constructor(g, map, n = 16) {
    this.g = g; this.map = map;
    this.list = [];
    // one character controller moves everyone: they bump into walls, step up kerbs, keep to the ground
    this.cc = g.world.createCharacterController(0.03);
    this.cc.enableAutostep(0.45, 0.25, false); // (no snap-to-ground or pushing things about: gravity does the one, and the other costs a lot for forty people)
    this.cc.setMaxSlopeClimbAngle(50 * Math.PI / 180); this.cc.setApplyImpulsesToDynamicBodies(false);
    for (let i = 0; i < n; i++) this.spawn(NAMES[i % NAMES.length]);
  }

  // somewhere on a sidewalk: near home and the middle of town at first, then near wherever they are
  randomPoint(near = null) {
    const g = this.g, m = this.map;
    if (near) return m.sidewalkPoint(near, 55);
    const hubs = [g.apt.door, g.townSquare || g.apt.door, g.places['the coffee store']?.pos, g.places['palm tree beach']?.pos, g.places['the diner']?.pos].filter(Boolean);
    return m.sidewalkPoint(hubs[Math.floor(Math.random() * hubs.length)], 70);
  }

  spawn(name, opts = {}) {
    const g = this.g, { world, R } = g;
    const p = opts.at ? opts.at.clone() : this.randomPoint();
    const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, CENTRE + 0.1, p.z));
    const col = world.createCollider(R.ColliderDesc.capsule(HALF, RAD).setSolverGroups(groups(G_PED, G_WORLD | G_PED)).setCollisionGroups(groups(G_PED, 0xffff)), body);
    const human = new Human(opts.look || randomLook());
    g.scene.add(human.root);
    const npc = {
      name, human, body, col,
      hp: 100, mood: Math.floor(Math.random() * 35), // −100 … 100
      brave: Math.random(),
      walkSpeed: 1.15 + Math.random() * 0.45,
      state: 'wander', target: null, stateT: 0,
      yaw: Math.random() * 6.28, speed: 0, vel: V(),
      mem: { met: false, talks: 0, gifts: 0, insults: 0, compliments: 0, hitBy: 0 },
      following: false, bubbleT: 0, blockedT: 0, gossip: [...GOSSIP].sort(() => Math.random() - 0.5),
    };
    human.owner = npc;
    npc.target = this.randomPoint(p); npc.laneOff = RW / 2 + SW * (0.32 + Math.random() * 0.36); npc.eventT = 3 + Math.random() * 18;
    this.list.push(npc);
    if (opts.cop) { npc.cop = true; npc.state = 'cop'; npc.copMode = 'chase'; npc.hp = 120; npc.brave = 1; npc.mood = 0; return npc; }
    this.setLane(npc, p);
    return npc;
  }

  // someone who works somewhere: stands at their post, says their own lines
  addWorker(w) {
    const n = this.spawn(w.name || NAMES[Math.floor(Math.random() * NAMES.length)], { look: w.look });
    n.shop = w.shop; n.shopKind = w.kind; n.products = w.products;
    n.body.setTranslation({ x: w.pos.x, y: w.pos.y + CENTRE + 0.05, z: w.pos.z }, true);
    n.state = 'post'; n.home = w.pos.clone(); n.homeYaw = w.yaw; n.yaw = w.yaw; n.lines = w.lines; n.role = w.role; n.mood = 30; n.target = null;
    return n;
  }

  pos(n) { const t = n.body.translation(); return V(t.x, t.y - CENTRE, t.z); }

  groundAt(x, z, fromY = 3) {
    const g = this.g;
    const hit = g.world.castRay(new g.R.Ray({ x, y: fromY, z }, { x: 0, y: -1, z: 0 }), 8, true, g.R.QueryFilterFlags.ONLY_FIXED);
    return hit ? fromY - hit.timeOfImpact : 0;
  }

  // is something in the way, a little ahead?
  blocked(n, p, dir) {
    const g = this.g;
    const from = { x: p.x, y: p.y + 0.9, z: p.z };
    const hit = g.world.castRay(new g.R.Ray(from, { x: dir.x, y: 0, z: dir.z }), 1.1, true, undefined, undefined, undefined, undefined, (c) => c.handle !== n.col.handle);
    return !!hit;
  }

  // ---- getting about: people keep to the sidewalks, walking along beside a road; at a corner they turn
  // or cross; before crossing they stop at the kerb and look both ways, and wait for cars to pass
  lanePt(n, t) { const s = n.lane.s, o = n.laneOff * n.lane.sd; return V(s.a[0] + s.u[0] * t + s.n[0] * o, 0, s.a[1] + s.u[1] * t + s.n[1] * o); }
  walkable(q) { const m = this.map; return m.inLand(q.x, q.z) && !m.inRoad(q.x, q.z) && !m.built(q.x, q.z); }
  // the sidewalk nearest p (and which way along it is closest to `heading`)
  setLane(n, p, heading = null) {
    let best = null, bd = 14;
    for (const s of this.map.segs) {
      const dx = p.x - s.a[0], dz = p.z - s.a[1], t = dx * s.u[0] + dz * s.u[1]; if (t < -3 || t > s.L + 3) continue;
      const side = dx * s.n[0] + dz * s.n[1], sd = side >= 0 ? 1 : -1, d = Math.abs(Math.abs(side) - n.laneOff);
      if (d < bd) { bd = d; best = { s, sd, t }; }
    }
    if (!best) { n.lane = null; return false; }
    const h = heading ? heading.x * best.s.u[0] + heading.z * best.s.u[1] : 0;
    n.lane = { s: best.s, sd: best.sd, dir: Math.abs(h) > 0.2 ? Math.sign(h) : (Math.random() < 0.5 ? -1 : 1) };
    n.kerbT = 0.6; return true;
  }
  laneT(n, p) { const s = n.lane.s; return (p.x - s.a[0]) * s.u[0] + (p.z - s.a[1]) * s.u[1]; }
  // straight across the road ahead: where you'd step up onto the far kerb
  crossTo(p, dir) {
    let k = 0.5; for (; k < 4.5; k += 0.5) { const q = p.clone().addScaledVector(dir, k); if (this.map.inRoad(q.x, q.z)) break; } // (to the kerb…)
    if (k >= 4.5) return null; const k0 = k;
    for (; k < 34; k += 0.5) { const q = p.clone().addScaledVector(dir, k); if (!this.map.inRoad(q.x, q.z)) break; } // (…and across)
    if (k >= 33.5 || k - k0 < 3) return null;
    const q = p.clone().addScaledVector(dir, k + 1.3);
    return this.walkable(q) ? q : null;
  }
  // a turn at a corner: another road's sidewalk passing right here
  cornerLane(n, p) {
    const opts = [];
    for (const s of this.map.segs) {
      if (s === n.lane.s) continue;
      const dx = p.x - s.a[0], dz = p.z - s.a[1], t = dx * s.u[0] + dz * s.u[1]; if (t < -4 || t > s.L + 4) continue;
      const side = dx * s.n[0] + dz * s.n[1]; if (Math.abs(Math.abs(side) - n.laneOff) > 2.2) continue;
      const sd = side >= 0 ? 1 : -1;
      for (const dir of [-1, 1]) { const o = n.laneOff * sd, q = V(s.a[0] + s.u[0] * (t + dir * 5) + s.n[0] * o, 0, s.a[1] + s.u[1] * (t + dir * 5) + s.n[1] * o); if (this.walkable(q)) opts.push({ s, sd, dir }); }
    }
    return opts.length ? pick(opts) : null;
  }
  roadClear(p) { // no car coming: nothing moving within 30 m that's heading this way
    for (const c of this.g.cars) {
      if (Math.abs(c.speed) < 1.5) continue;
      const dx = p.x - c.pos.x, dz = p.z - c.pos.z, d = Math.hypot(dx, dz); if (d > 32) continue;
      const v = c.body.linvel(); if (v.x * dx + v.z * dz > 0 || d < 7) return false;
    }
    return true;
  }
  startCross(n, p, to, sideways = false) {
    n.cross = { to, sideways }; n.state = 'crossLook'; n.stateT = 1.9 + Math.random() * 0.8; n.crossYaw = Math.atan2(to.x - p.x, to.z - p.z); n.lookT = 0;
  }
  // a trip to the shops: in, along an aisle, pick something up, pay, out
  goShopping(n, shop) {
    const r = shop.route(); n.route = r.pts; n.stops = r.stops; n.routeI = 0; n.shop = shop; n.state = 'shop'; n.stuckT = 0;
  }

  physics(h0) {
    const g = this.g, pl = g.player, pp = pl.car ? pl.car.pos.clone() : pl.pos;
    this.stepN = (this.stepN || 0) + 1;
    for (let i = 0; i < this.list.length; i++) {
      const n = this.list[i];
      if (n.state === 'trunk') { const tp = n.trunkCar.trunkPoint(-0.6); n.body.setNextKinematicTranslation({ x: tp.x, y: tp.y + 0.6, z: tp.z }); continue; }
      if (n.state === 'seated' || n.hostage) continue;
      // far from you, people think (and move) a quarter as often: the same walk, a quarter of the work
      let h = h0;
      { const t = n.body.translation(), far = Math.hypot(pp.x - t.x, pp.z - t.z) > 55 && n.state !== 'follow' && !n.cop;
        n.acc = (n.acc || 0) + h0;
        if (far && ((this.stepN + i) & 3) !== 0) continue;
        h = n.acc; n.acc = 0; }
      if (n.state === 'dead') { n.deadT += h; if (n.deadT > 90) { this.remove(n); continue; } if (!n.human.ragdoll) continue; /* (the body stays a while; then someone new turns up) */ if (!n.pooled && n.deadT > 1.2 && n.human.ragdoll.speed < 0.3) { n.pooled = true; g.blood.pool(n.human.ragdoll.pelvis, 1.3 + Math.random() * 0.6); } continue; }
      if (n.human.ragdoll) {
        n.stateT -= h;
        if (n.downed) { n.moanT = (n.moanT ?? 2) - h; if (n.moanT <= 0) { n.moanT = 5 + Math.random() * 6; if (n.human.ragdoll.pelvis.distanceTo(pl.pos) < 25) this.say(n, pick(['Ugh… help…', 'Somebody… call an ambulance…', 'Please… no more…', 'Ow…']), 2.5); } }
        if (n.stateT <= 0 && n.human.ragdoll.speed < 0.6) { n.downed = false; this.getUp(n); }
        continue;
      }
      if (n.witness) { // on the phone to the police
        n.witness.t -= h;
        if (n.witness.t <= 0) { const w = n.witness; n.witness = null; g.police.reported(w.level, w.at, 'witness', n); }
      }
      if (n.punchT != null) { // a punch thrown at you lands halfway through
        n.punchT += h;
        if (n.punchHit && n.punchT > 0.17) { n.punchHit = false; const q = this.pos(n); if (!pl.car && !pl.ragdoll && pl.pos.distanceTo(q) < 1.7) { g.sfx.punch(pl.pos); pl.hurt(4 + Math.random() * 4, V(pl.pos.x - q.x, 0, pl.pos.z - q.z).normalize(), 'punch', (n.hits % 4) === 0); } }
        if (n.punchT > 0.45) n.punchT = null;
      }
      const p = this.pos(n);
      n.stateT -= h;
      let goal = null, spd = 0;
      const dP = Math.hypot(pp.x - p.x, pp.z - p.z);
      switch (n.state) {
        case 'wander': {
          spd = n.walkSpeed;
          if (!n.lane && !this.setLane(n, p)) { goal = n.target; if (Math.hypot(goal.x - p.x, goal.z - p.z) < 0.8) n.target = this.randomPoint(p); break; }
          const L = n.lane, t = this.laneT(n, p);
          goal = this.lanePt(n, t + L.dir * 3);
          { const lp = this.lanePt(n, t); if (Math.hypot(lp.x - p.x, lp.z - p.z) > 6) this.setLane(n, p, V(goal.x - p.x, 0, goal.z - p.z)); } // (well off the line: back to the nearest one)
          n.kerbT -= h; n.eventT -= h;
          if (n.kerbT <= 0) {
            n.kerbT = 0.3;
            const ahead = this.lanePt(n, t + L.dir * 2.2), fwd = V(L.s.u[0] * L.dir, 0, L.s.u[1] * L.dir);
            if (!this.walkable(ahead)) {
              const road = this.map.inRoad(ahead.x, ahead.z), corner = this.cornerLane(n, p), to = road ? this.crossTo(p, fwd) : null;
              if (corner && (!to || Math.random() < 0.4)) { n.lane = corner; n.kerbT = 2.5; }
              else if (to) this.startCross(n, p, to);
              else L.dir = -L.dir;
              break;
            }
            if (n.eventT <= 0) { // now and then: stop for a bit, sit down, go into a shop, or cross over
              n.eventT = 10 + Math.random() * 22;
              const shop = (g.shops || []).find(sh => sh.outside.distanceTo(p) < 35);
              const b = g.benches.find(b => !b.taken && b.pos.distanceTo(p) < 12);
              const r = Math.random();
              if (shop && r < 0.55) { this.goShopping(n, shop); break; }
              if (b && r < 0.3) { n.state = 'toBench'; n.bench = b; b.taken = n; break; }
              if (r < 0.75) { const to = this.crossTo(p, V(-L.s.n[0] * L.sd, 0, -L.s.n[1] * L.sd)); if (to) { this.startCross(n, p, to, true); break; } }
              if (r < 0.85) { n.state = 'idle'; n.stateT = 2 + Math.random() * 5; }
            }
          }
          break;
        }
        case 'crossLook': // at the kerb: left, right, left again, and wait until nothing's coming
          n.lookT += h;
          if (n.stateT <= 0 && this.roadClear(p)) { n.state = 'crossGo'; n.stateT = 14; }
          break;
        case 'crossGo':
          goal = n.cross.to; spd = n.walkSpeed * 1.2;
          if (Math.hypot(goal.x - p.x, goal.z - p.z) < 0.7 || n.stateT <= 0) { n.state = 'wander'; const dir = V(goal.x - p.x, 0, goal.z - p.z); this.setLane(n, p, n.cross.sideways ? V(Math.sin(n.yaw + (Math.random() < 0.5 ? 1.57 : -1.57)), 0, Math.cos(n.yaw + 1.57)) : V(Math.sin(n.crossYaw), 0, Math.cos(n.crossYaw))); n.kerbT = 2; }
          break;
        case 'shop': {
          const stop = n.stops[n.routeI];
          goal = n.route[n.routeI]; spd = n.walkSpeed * 0.85;
          if (n.waitT > 0) { n.waitT -= h; goal = null; if (n.waitT <= 0) n.routeI++; break; }
          const d = Math.hypot(goal.x - p.x, goal.z - p.z);
          n.stuckT = d < (n.lastD ?? 99) - 0.02 ? 0 : n.stuckT + h; n.lastD = d;
          if (d < 0.45 || n.stuckT > 3.5) {
            n.stuckT = 0; n.lastD = 99;
            if (stop === 'browse') { n.waitT = 2.5 + Math.random() * 4; n.faceYaw = n.shop.shelfYaw; n.pointT = 1.2; if (Math.random() < 0.3) this.say(n, pick(['Hmm…', 'Where do they keep the…', 'They moved everything again.', 'Ooh.']), 2); }
            else if (stop === 'till') {
              n.waitT = 3 + Math.random() * 2; n.faceYaw = n.shop.tillYaw;
              if (Math.random() < 0.6) this.say(n, pick(['Just this, thanks.', 'And a bag, please.', 'Card, thanks.', 'Keep the change.']), 2.4);
              const clerk = this.list.find(o => o.role === 'clerk' && o.home && o.home.distanceTo(n.shop.till) < 4);
              if (clerk && Math.random() < 0.7) setTimeout(() => this.say(clerk, pick(["That's $4.50.", 'Cash or card?', 'Have a good one.', 'Want a bag?', 'Next!']), 2.4), 900);
            }
            else n.routeI++;
            if (n.routeI >= n.route.length) { n.state = 'wander'; n.faceYaw = null; this.setLane(n, p); n.eventT = 30 + Math.random() * 30; }
          }
          break;
        }
        case 'toBench':
          goal = n.bench.pos; spd = n.walkSpeed;
          if (Math.hypot(goal.x - p.x, goal.z - p.z) < 0.5) { n.state = 'sit'; n.stateT = 12 + Math.random() * 20; n.yaw = n.bench.yaw; }
          break;
        case 'sit':
          if (n.stateT <= 0) { n.bench.taken = null; n.bench = null; this.wander(n); }
          break;
        case 'idle': case 'talk':
          if (n.stateT <= 0) this.wander(n);
          break;
        case 'post': // (at work: back to their spot if they've drifted)
          if (Math.hypot(n.home.x - p.x, n.home.z - p.z) > 0.5) { goal = n.home; spd = 1.2; }
          break;
        case 'follow':
          if (pl.car) { // get in with you
            const door = pl.car.doorPoint('passenger', 0.5);
            goal = door; spd = Math.hypot(door.x - p.x, door.z - p.z) > 4 ? 4.6 : 1.6;
            if (Math.hypot(door.x - p.x, door.z - p.z) < 0.9 && Math.abs(pl.car.speed) < 1.5 && !pl.car.passenger) { this.board(n, pl.car); continue; }
            if (Math.abs(pl.car.speed) > 4 && dP > 25) { n.following = false; this.say(n, "Hey! Wait for me!", 3); this.wander(n); }
          } else if (dP > 2.4) { goal = pp; spd = dP > 7 ? 4.8 : dP > 4 ? 2.6 : 1.6; }
          if (dP > 90) { n.following = false; this.wander(n); }
          break;
        case 'flee': {
          const away = V(p.x - pp.x, 0, p.z - pp.z).normalize();
          goal = p.clone().addScaledVector(away, 5); spd = 5.2;
          if (n.stateT <= 0) this.wander(n);
          break;
        }
        case 'angry': // fists up, and at you
          goal = pp; spd = dP > 3 ? 4.4 : 2.2;
          n.punchCool = (n.punchCool ?? 0.3) - h;
          if (dP < 1.3) goal = null;
          if (dP < 1.45 && !pl.car && !pl.ragdoll && !pl.dead && n.punchCool <= 0) {
            n.punchCool = 0.75 + Math.random() * 0.5; n.punchT = 0; n.punchHit = true; n.punchSide = !n.punchSide; n.hits = (n.hits || 0) + 1;
            if (n.hits >= 5 && Math.random() < 0.4) { this.say(n, pick(["That's for running your mouth.", 'Next time, keep walking.', "Not so funny now, is it?"]), 3.5); n.mood = Math.min(n.mood + 30, -10); n.hits = 0; n.state = 'idle'; n.stateT = 3; }
          }
          if (n.stateT <= 0 || pl.car || pl.dead) this.wander(n);
          break;
        case 'handsUp': // someone's pointing something at them
          goal = null; spd = 0;
          if (n.stateT <= 0) { n.state = 'flee'; n.stateT = 9; n.robT = 0; this.say(n, pick(['Psycho!', 'Help! Police!', 'Somebody help!']), 2.5); }
          break;
        case 'cop': { const r = g.police.copThink(n, p, h); goal = r.goal; spd = r.spd; n.faceAt = r.face || null; break; }
        case 'down': this.wander(n); break;
      }
      if (n.state === 'sit' || n.state === 'seated') { n.speed = 0; n.vel.set(0, 0, 0); if (n.state === 'sit') this.move(n, p, V(), h); continue; }
      if (n.flinchT > 0) { n.flinchT -= h; goal = p.clone().addScaledVector(n.flinchDir, 2); spd = 2.5; }
      // dodge a car coming at you
      for (const car of g.cars) {
        if (Math.abs(car.speed) < 6) continue;
        const loc = car.group.worldToLocal(p.clone().add(V(0, 0.9, 0)));
        const ahead = car.speed > 0 ? loc.z : -loc.z;
        if (ahead > 2 && ahead < 14 && Math.abs(loc.x) < 1.6) {
          const side = V(loc.x >= 0 ? 1 : -1, 0, 0).applyQuaternion(car.group.quaternion).setY(0).normalize();
          goal = p.clone().addScaledVector(side, 4); spd = 5.5;
          n.human.express('surprised', 1.5); if (!n.dodgeSaid) { n.dodgeSaid = true; this.say(n, pick(['Whoa!', 'Watch it!', 'Hey!']), 1.6); setTimeout(() => (n.dodgeSaid = false), 4000); }
        }
      }
      let want = V();
      if (goal) {
        const d = V(goal.x - p.x, 0, goal.z - p.z); const len = d.length();
        if (len > 0.05) want = d.multiplyScalar(Math.min(spd, len * 3) / len);
      }
      // keep a little apart from each other and from you
      for (const o of this.list) {
        if (o === n || o.state === 'seated') continue;
        const q = this.pos(o), dx = p.x - q.x, dz = p.z - q.z, dd = Math.hypot(dx, dz);
        if (dd < 0.9 && dd > 0.001) { want.x += (dx / dd) * 1.2; want.z += (dz / dd) * 1.2; }
      }
      n.blkT = (n.blkT || 0) - h;
      if (want.lengthSq() > 0.01 && n.blkT <= 0) { n.blk = this.blocked(n, p, want.clone().normalize()); n.blkT = n.blk ? 0 : 0.2; }
      if (want.lengthSq() > 0.01 && n.blk) {
        n.blockedT += h;
        want.applyAxisAngle(V(0, 1, 0), 1.1); // (step round it)
        if (n.blockedT > 1.5 && n.state === 'wander') { if (n.lane) n.lane.dir = -n.lane.dir; else n.target = this.randomPoint(p); n.blockedT = 0; }
      } else n.blockedT = Math.max(0, n.blockedT - h);
      n.vel.lerp(want, Math.min(1, h * 8));
      if (n.vy === 0 && want.lengthSq() < 0.0001 && n.vel.lengthSq() < 0.0004) { n.vel.set(0, 0, 0); n.speed = 0; continue; } // (standing still on the ground: nothing to compute)
      this.move(n, p, n.vel, h);
    }
  }

  move(n, p, vel, h) {
    if (n.state === 'sit') { n.body.setNextKinematicTranslation({ x: p.x + vel.x * h, y: p.y + CENTRE, z: p.z + vel.z * h }); n.speed = 0; return; }
    n.vy = (n.vy || 0) - 18 * h;
    this.cc.computeColliderMovement(n.col, { x: vel.x * h, y: n.vy * h, z: vel.z * h }, undefined, groups(G_PED, G_WORLD | G_CAR | G_PED | G_PROP));
    const m = this.cc.computedMovement();
    if (this.cc.computedGrounded()) n.vy = 0;
    const t = n.body.translation();
    if (t.y < -20) { const q = this.randomPoint(); n.body.setTranslation({ x: q.x, y: q.y + CENTRE + 0.1, z: q.z }, true); return; } // (fell out of the world)
    n.body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    n.speed = Math.hypot(m.x, m.z) / h;
  }

  wander(n) { if (n.home && !n.following) { n.state = 'post'; return; } n.state = n.following ? 'follow' : 'wander'; const p = this.pos(n); n.target = this.randomPoint(p); n.stateT = 0; n.faceYaw = null; if (n.state === 'wander') this.setLane(n, p, n.vel.lengthSq() > 0.1 ? n.vel : null); }

  board(n, car) {
    n.state = 'seated'; car.passenger = n; n.col.setEnabled(false);
    car.seatPerson(n.human, 'passenger');
    this.say(n, pick(["Where are we going?", "Nice car. Is it yours?", "Don't drive like a maniac, okay?"]), 3.5);
  }
  unboard(n, car) {
    car.passenger = null; car.unseat(n.human); this.g.scene.add(n.human.root);
    const out = car.doorPoint('passenger', 1.1);
    n.body.setTranslation({ x: out.x, y: out.y + CENTRE + 0.2, z: out.z }, true);
    n.body.setNextKinematicTranslation({ x: out.x, y: out.y + CENTRE + 0.2, z: out.z });
    n.col.setEnabled(true);
    n.state = 'follow';
  }

  frame(dt0) {
    const g = this.g, pl = g.player, cam = g.camera;
    cam.updateMatrixWorld(); this._pv = this._pv || new THREE.Matrix4(); this._fr = this._fr || new THREE.Frustum(); this._sp = this._sp || new THREE.Sphere(V(), 2.2);
    this._fr.setFromProjectionMatrix(this._pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    this.frameN = (this.frameN || 0) + 1;
    for (let i = 0; i < this.list.length; i++) {
      const n = this.list[i];
      n.bubbleT = Math.max(0, n.bubbleT - dt0);
      const H = n.human;
      if (n.state === 'trunk') { H.root.visible = false; if (n.trunkAlive && Math.random() < dt0 * 0.12 && n.trunkCar.pos.distanceTo(pl.pos) < 30) this.say(n, n.hostageBag ? pick(['Mmmph!', '*thump thump*']) : pick(['LET ME OUT!', 'Help! I\'m in the boot!', '*thump thump thump*']), 2); continue; }
      // only draw (and pose) people who are on screen and not too far off; far ones are posed every other frame
      if (n.state !== 'seated') {
        const t = H.ragdoll ? H.ragdoll.pelvis : n.body.translation(); this._sp.center.set(t.x, t.y, t.z);
        const dc = cam.position.distanceTo(this._sp.center), vis = dc < 170 && this._fr.intersectsSphere(this._sp);
        H.root.visible = vis; n.animAcc = (n.animAcc || 0) + dt0;
        if (!vis) continue;
        if (dc > 45 && ((this.frameN + i) & 1)) continue;
        if (!n.meshes) { n.meshes = []; H.root.traverse(o => o.isMesh && o.castShadow && n.meshes.push(o)); }
        const cs = dc < 60; if (n.castNow !== cs) { n.castNow = cs; for (const m of n.meshes) m.castShadow = cs; }
      } else n.animAcc = (n.animAcc || 0) + dt0;
      const dt = n.animAcc; n.animAcc = 0;
      H.setMood(n.state === 'angry' ? 'angry' : n.state === 'flee' ? 'scared' : n.mood < -40 ? 'annoyed' : n.mood < -15 ? 'sad' : n.mood > 45 ? 'happy' : 'neutral');
      if (n.state === 'seated') { if (n.kidnapped && Math.random() < dt * 0.15) this.say(n, n.hostageBag ? pick(['Mmmph!', 'MMMPH!', '…mmf…']) : pick(['Let me out!', 'Where are you taking me?!', 'Please! I won\'t tell anyone!']), 2); H.update(dt, { pose: 'passenger', struggle: n.kidnapped }); continue; }
      if (H.ragdoll) { H.update(dt, {}); continue; }
      const p = this.pos(n);
      H.root.position.copy(p);
      let face = null;
      if (n.speed > 0.3) face = Math.atan2(n.vel.x, n.vel.z);
      if (['talk', 'angry'].includes(n.state) || (g.wheel.open && g.wheel.target === n)) { const q = pl.pos; face = Math.atan2(q.x - p.x, q.z - p.z); }
      if (n.state === 'sit') face = n.yaw;
      if (n.state === 'post' && n.speed < 0.3 && !(g.wheel.open && g.wheel.target === n)) face = n.homeYaw;
      if (n.state === 'crossLook') face = n.crossYaw;
      if (n.state === 'handsUp') face = Math.atan2(pl.pos.x - p.x, pl.pos.z - p.z);
      if (n.cop && n.faceAt) face = Math.atan2(n.faceAt.x - p.x, n.faceAt.z - p.z);
      if (n.hostage) face = n.yaw;
      if (n.state === 'shop' && n.waitT > 0 && n.faceYaw != null) face = n.faceYaw;
      if (face !== null) { let d = face - n.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); n.yaw += d * Math.min(1, dt * 8); }
      H.root.rotation.y = n.yaw;
      if (n.state === 'sit') { H.root.position.y = p.y - 0.42 * H.rig.scale.y; H.root.position.addScaledVector(V(Math.sin(n.yaw), 0, Math.cos(n.yaw)), -0.05); }
      // look at you when you're close
      const dP = pl.pos.distanceTo(p);
      let ly = 0;
      if (dP < 6 && !pl.car) { const a = Math.atan2(pl.pos.x - p.x, pl.pos.z - p.z) - n.yaw; ly = THREE.MathUtils.clamp(Math.atan2(Math.sin(a), Math.cos(a)), -1, 1); }
      if (n.state === 'crossLook') { const lt = n.lookT || 0; ly = lt < 0.2 ? 0 : lt < 0.9 ? 1.05 : lt < 1.6 ? -1.05 : lt < 2.1 ? 0.9 : 0; } // (left, right, left)
      H.lookYaw += (ly - H.lookYaw) * Math.min(1, dt * 5);
      if (n.hostage && Math.random() < dt * 0.4) this.say(n, n.hostage.bag ? pick(['Mmmph!', 'MMMPH!', 'Mmf mmf!']) : pick(['Mmmph!', 'Mmmmh!']), 1.4);
      let aim = null;
      if (n.cop && n.aimAt) { const hd = p.clone().add(V(0, 1.45, 0)), dd = n.aimAt.clone().sub(hd); aim = { e: Math.atan2(dd.y, Math.hypot(dd.x, dd.z)), kind: 'pistol', recoil: Math.max(0, (n.shootT ?? 1) > 0.4 ? 0 : 0) }; }
      H.update(dt, {
        speed: n.speed, grounded: true, vy: 0,
        pose: n.state === 'sit' ? 'passenger' : 'stand',
        talking: n.bubbleT > 0 && n.speed < 0.3, point: n.pointT > 0, wave: n.waveT > 0,
        handsUp: n.state === 'handsUp' || n.robbing, guard: n.state === 'angry' && dP < 5 && n.punchT == null,
        punch: n.punchT != null ? { a: Math.min(1, n.punchT / 0.45), side: n.punchSide ? 'R' : 'L' } : null,
        aim, weapon: n.cop && !aim, struggle: !!n.hostage, phone: !!n.witness,
      });
      n.pointT = Math.max(0, (n.pointT || 0) - dt); n.waveT = Math.max(0, (n.waveT || 0) - dt);
    }
  }

  say(n, text, dur) { n.bubbleT = dur ?? Math.min(9, 2 + text.length * 0.06); this.g.hud.bubble(n, text, n.bubbleT); }

  // ---- the interaction wheel's actions
  options(n) {
    const g = this.g;
    const D = g.drugs;
    if (n.home && n.shop === 'Pawn Shop') return [
      { id: 'buy:pistol', label: 'Pistol $250' }, { id: 'buy:shotgun', label: 'Shotgun $600' }, { id: 'buy:ammo', label: 'Ammo $40' },
      { id: 'buy:sack', label: 'Sack $5' }, { id: 'buy:salts', label: 'Blue Salts $45' }, { id: 'sellall', label: D.count ? `Sell ${D.count} Physick` : 'Sell Physick' },
    ];
    if (n.tenant && g.tenants) return g.tenants.options(n);
    if (n.role === 'buyer') return [
      { id: 'talk', label: n.outed ? 'Talk (June says: cop!)' : 'Talk' }, { id: 'sell1', label: 'Sell 1 Physick' }, { id: 'sell5', label: 'Sell 5' }, { id: 'insult', label: 'Insult' },
    ];
    if (n.home && n.role === 'clerk' && n.products === 'tools') return [
      { id: 'talk', label: 'Talk' }, { id: 'buy:solvent', label: 'Solvent $30' }, { id: 'buy:sack', label: 'Sack $5' },
      { id: 'directions', label: 'Directions' }, { id: 'compliment', label: 'Compliment' }, { id: 'insult', label: 'Insult' },
    ];
    if (n.home && n.role === 'clerk') return [
      { id: 'talk', label: 'Talk' }, { id: 'buy:snack', label: 'Snack $3' }, { id: 'buy:sack', label: 'Sack $5' },
      { id: 'directions', label: 'Directions' }, { id: 'compliment', label: 'Compliment' }, { id: 'insult', label: 'Insult' },
    ];
    return [
      { id: 'talk', label: 'Talk' },
      { id: 'follow', label: n.following ? 'Stop following' : 'Follow me' },
      { id: 'money', label: 'Give $20' },
      { id: 'directions', label: 'Directions' },
      { id: 'compliment', label: 'Compliment' },
      { id: 'insult', label: 'Insult' },
    ];
  }

  act(n, id) {
    const g = this.g, m = n.mem, pl = g.player;
    if (n.state === 'sit' && id !== 'talk' && id !== 'insult' && id !== 'compliment') { n.bench.taken = null; n.bench = null; }
    const stay = () => { if (!n.following && n.state !== 'sit') { n.state = 'talk'; n.stateT = 5; } };
    pl.talkT = 1.4;
    const hostile = n.mood < -30, warm = n.mood >= 40;
    if (id.startsWith('buy:')) { this.buy(n, id.slice(4)); return; }
    if (id === 'sell1' || id === 'sell5') { g.drugs.sell(n, n, id === 'sell1' ? 1 : 5); return; }
    if (id === 'sellall') { g.drugs.sell(n, n, 999); return; }
    const mood0 = n.mood;
    if (n.tenant && g.tenants?.act(n, id)) { n.mood = THREE.MathUtils.clamp(n.mood, -100, 100); g.tenants.levelCheck(n, mood0); return; }
    switch (id) {
      case 'talk': {
        let line;
        if (hostile) line = pick(["I've got nothing to say to you.", 'Leave me alone.', 'Keep walking.']);
        else if (m.gifts > 0 && Math.random() < 0.4) line = "Hey, it's the twenty-dollar guy! What's up?";
        else if (m.insults > 0 && n.mood < 10) line = "Oh. It's you again. What now?";
        else if (m.talks >= 3 && Math.random() < 0.4) line = 'You again! People are going to talk.';
        else if (n.lines) line = (!m.met ? `I'm ${n.name}. ` : '') + pick(n.lines);
        else if (!m.met) line = `Hi. I'm ${n.name}. ` + (n.gossip.length ? n.gossip.pop() : pick(SMALL));
        else line = (n.gossip.length && Math.random() < 0.7) ? n.gossip.pop() : pick(SMALL);
        m.met = true; this.say(n, line); m.talks++; n.mood += hostile ? 0 : 3; stay();
        break;
      }
      case 'follow':
        if (n.following) { n.following = false; this.say(n, warm ? 'Catch you later!' : 'Right. Bye then.', 2.5); this.wander(n); break; }
        if (n.mood >= 20 || m.gifts > 0) { n.following = true; n.state = 'follow'; this.say(n, pick(["Sure, lead the way.", "Okay, I've got nothing better to do.", 'Where to?']), 3); n.waveT = 0.8; }
        else this.say(n, hostile ? 'Not a chance.' : "I don't even know you.", 3), stay();
        break;
      case 'money':
        if (g.money < 20) { g.hud.toast("You don't have $20"); break; }
        g.money -= 20; m.gifts++; n.mood = Math.min(100, n.mood + 25); n.human.express(hostile ? 'surprised' : 'happy', 3);
        this.say(n, m.gifts > 2 ? 'Seriously? You keep doing this. Thank you!' : hostile ? '…Fine. Thanks, I guess.' : pick(['Oh! Thank you!', 'Wow, really? Thanks!', "That's very kind."]), 3);
        stay();
        break;
      case 'directions': {
        const places = Object.values(g.map.places);
        const pl2 = places.filter(q => q.pos.distanceTo(this.pos(n)) > 15);
        const dest = pick(pl2.length ? pl2 : places);
        if (hostile) { this.say(n, 'Find it yourself.', 2.5); break; }
        g.setWaypoint(dest);
        const p = this.pos(n), a = Math.atan2(dest.pos.x - p.x, dest.pos.z - p.z);
        n.yaw = a; n.pointT = 2.4; n.state = 'idle'; n.stateT = 2.6;
        this.say(n, `${dest.name[0].toUpperCase() + dest.name.slice(1)}? That way. ${pick(['Can\'t miss it.', 'Five minutes on foot.', 'Follow the road.'])}`, 3.5);
        break;
      }
      case 'compliment':
        m.compliments++;
        if (m.insults > 0 && n.mood < 0) { this.say(n, "Oh, NOW you're being nice?", 3); n.mood += 5; n.human.express('annoyed', 3); }
        else { this.say(n, pick(['Ha! Thanks.', 'You\'re sweet.', 'Well, that made my day.', 'Smooth. Very smooth.']), 2.8); n.mood = Math.min(100, n.mood + 10); n.human.express('happy', 3); }
        stay();
        break;
      case 'insult':
        m.insults++; n.mood -= 35; n.human.express(n.brave > 0.45 ? 'angry' : 'sad', 3.5);
        if (n.mood < -40 && n.brave > 0.45) { n.state = 'angry'; n.stateT = 8; n.following = false; this.say(n, pick(['What did you just say to me?!', 'Say that again. I dare you.']), 3); }
        else if (n.mood < -40) { n.state = 'flee'; n.stateT = 5; n.following = false; this.say(n, pick(['Psycho!', 'Get away from me!']), 2.5); }
        else { this.say(n, pick(['Wow. Rude.', 'Excuse me?', 'Okay, that was uncalled for.']), 2.6); stay(); }
        break;
    }
    n.mood = THREE.MathUtils.clamp(n.mood, -100, 100);
    if (n.tenant) g.tenants?.levelCheck(n, mood0);
  }

  // buying things from a shopkeeper
  buy(n, what) {
    const g = this.g, W = g.weapons, price = { pistol: 250, shotgun: 600, ammo: 40, sack: 5, snack: 3, solvent: 30, salts: 45 }[what];
    if (g.money < price) { this.say(n, pick(["You can't afford it.", 'Come back with money.', 'Cash first.']), 2.5); return; }
    if (what === 'ammo' && !W.inv.has('pistol') && !W.inv.has('shotgun')) { this.say(n, 'Ammo for what? You don\'t have a gun.', 2.5); return; }
    g.money -= price; g.sfx?.cash(this.pos(n));
    if (what === 'pistol' || what === 'shotgun') { const fresh = !W.inv.has(what); W.give(what, what === 'pistol' ? 36 : 18); this.say(n, pick(["Pleasure doing business.", "I didn't sell you that.", 'Serial number? What serial number?']), 3); g.hud.toast(`${fresh ? 'Bought' : 'More rounds for'} the ${what === 'pistol' ? 'Pistol' : 'Pump Shotgun'} · 1–6 or the mouse wheel to switch · right mouse to aim`, '#ffd23f'); }
    else if (what === 'ammo') { if (W.inv.has('pistol')) W.ammo.pistol += 24; if (W.inv.has('shotgun')) W.ammo.shotgun += 12; this.say(n, 'Try not to use it all at once.', 2.5); g.hud.toast('Bought ammo', '#ffd23f'); }
    else if (what === 'solvent' || what === 'salts') { const D = g.drugs; if (what === 'solvent') D.solvent++; else D.salts++; this.say(n, what === 'solvent' ? pick(['Industrial solvent. For… cleaning?', 'Gloves are aisle three.']) : pick(["Blue Salts. Don't ask where I got them.", 'Bath salts. Sure.']), 2.8); g.hud.toast(`Bought ${what === 'solvent' ? 'Industrial Solvent' : 'Blue Salts'} · you have ${D.solvent} solvent, ${D.salts} salts`, '#5fd0ff'); }
    else if (what === 'sack') { g.player.sacks = (g.player.sacks || 0) + 1; this.say(n, pick(['A sack. Sure. For… potatoes.', "I don't want to know.", 'Here you go.']), 2.8); g.hud.toast(`Bought a sack (you have ${g.player.sacks}) · G behind someone to put it over their head`, '#ffd23f'); }
    else { g.player.hp = Math.min(100, g.player.hp + 15); this.say(n, pick(['Enjoy.', 'Good choice.', 'Bag? No? Okay.']), 2); g.hud.toast('A snack: +15 health', '#7be08a'); }
  }

  // ---- getting hurt
  knock(n, vel, spin = 4) {
    if (n.bench) { n.bench.taken = null; n.bench = null; }
    if (n.human.ragdoll) { n.human.ragdoll.push(vel); return; }
    n.col.setEnabled(false);
    if (n.state !== 'seated') { n.human.root.position.copy(this.pos(n)); n.human.root.rotation.y = n.yaw; } n.human.root.visible = true; n.human.root.updateMatrixWorld(true); // (it may not have been drawn lately: put it where they are)
    n.human.ragdoll = new Ragdoll(this.g, n.human, vel, spin);
    n.state = 'down'; n.stateT = 2.4 + Math.random(); n.following = false;
  }

  hitByCar(n, dir, force) {
    if (n.state === 'seated' || n.state === 'dead') return;
    n.mem.hitBy++; n.mood -= 60;
    const v = dir.clone().setY(0).normalize().multiplyScalar(Math.min(force, 18) * 0.85); v.y = Math.min(6, 1.2 + force * 0.3);
    this.knock(n, v, 3 + force * 0.4);
    n.hp -= force * 6.5;
    if (this.g.player.car && force > 2.5) this.crimeAt(n, n.hp <= 0);
    if (force > 6) { this.g.blood.spray(n.human.ragdoll.pelvis.add(new THREE.Vector3(0, 0.35, 0)), v.clone().normalize(), Math.min(60, force * 3), 3.5); for (let i = 0; i < Math.min(4, force / 4); i++) { const b = ['chest', 'head', 'hipL', 'shoulderR', 'kneeR'][Math.floor(Math.random() * 5)], w = new THREE.Vector3(); n.human.b[b].getWorldPosition(w); n.human.wound(w, 0.1, 0.8); } }
    if (n.hp <= 0) this.die(n);
    else { this.after(n, force > 10); if (n.hp < 35) this.downed(n); }
  }

  // hit with a weapon
  struck(n, W, dir) {
    const g = this.g;
    const chest = n.human.ragdoll ? n.human.ragdoll.pelvis.add(new THREE.Vector3(0, 0.35, 0)) : this.pos(n).add(new THREE.Vector3(0, 1.3, 0));
    if (W.dmg === 0) { // the plastic kiddie knife
      g.hud.toast('The plastic knife bends. Nothing happens.');
      if (!n.human.ragdoll) { n.mood -= 8; n.human.express('surprised', 2.5); n.state = 'talk'; n.stateT = 3; this.say(n, pick(['…Was that a plastic knife?', 'Did you just… poke me?', "Ha! Is that from a kids' meal?", 'Okay. Weird. Bye.']), 3); }
      return;
    }
    n.hp -= W.dmg; n.mood -= 80; n.mem.hitBy++; this.crimeAt(n, n.hp <= 0);
    if (n.human.ragdoll) { if (n.hp <= 0) this.die(n); else n.human.ragdoll.push(dir.clone().multiplyScalar(W.force * 0.5)); g.blood.spray(chest, dir.clone().setY(0.3).normalize(), W.bleed, 2.5); return; }
    g.blood.spray(chest, dir.clone().setY(0.3).normalize(), W.bleed, 2.5);
    if (W.bleed) n.human.wound(chest.clone().addScaledVector(dir, -0.12), W.dmg > 40 ? 0.11 : 0.06, 1);
    this.panic(this.pos(n), n);
    if (n.hp <= 0) { this.knock(n, dir.clone().multiplyScalar(W.force).setY(1), 3); this.die(n); return; }
    if (W.dmg >= 40 || n.hp < 35) { this.knock(n, dir.clone().multiplyScalar(W.force).setY(1.5), 3); if (n.hp < 40) this.downed(n); this.after(n, true); }
    else if (!n.human.ragdoll) { // a stab that doesn't drop them
      n.state = n.brave > 0.75 ? 'angry' : 'flee'; n.stateT = n.state === 'angry' ? 7 : 9; n.following = false;
      this.say(n, n.state === 'angry' ? pick(['You STABBED me?!', 'Oh, you are going to regret that.']) : pick(['Aaah! Help!', 'He stabbed me! Somebody help!', 'Get away from me!']), 3);
    }
  }

  after(n, bad) { n.afterBad = bad; }

  downed(n) { n.downed = true; n.stateT = 22 + Math.random() * 12; n.moanT = 1.5; this.say(n, pick(['Ugh…', 'Help… me…', 'I can\'t… get up…']), 2.5); }

  crimeAt(n, killed) { this.g.police?.crime(n.cop ? (killed ? 'copMurder' : 'copAssault') : (killed ? 'murder' : 'assault'), this.pos(n), n.cop); }

  // a punch from you
  punched(n, dmg, dir, heavy) {
    const g = this.g;
    if (n.state === 'dead' || n.state === 'seated') return;
    n.mem.hitBy++; n.mood -= 30; n.hp -= dmg;
    if (n.human.ragdoll) { n.human.ragdoll.push(dir.clone().multiplyScalar(1.6).setY(0.6)); if (n.hp <= 0) { this.die(n); this.crimeAt(n, true); } return; }
    n.human.express('hurt', 1.2);
    this.crimeAt(n, n.hp <= 0);
    if (n.hp <= 0) { this.knock(n, dir.clone().multiplyScalar(3).setY(1.2), 3); this.die(n); return; }
    if (heavy || n.hp < 35) { this.knock(n, dir.clone().multiplyScalar(heavy ? 3.4 : 2.2).setY(1.5), 3.5); if (n.hp < 35) this.downed(n); else n.stateT = 2.2; this.after(n, false); return; }
    n.flinchT = 0.22; n.flinchDir = dir.clone();
    if (n.cop) return;
    if (n.state === 'handsUp' || n.hostage) return;
    if (n.brave > 0.45 && n.state !== 'angry') { n.state = 'angry'; n.stateT = 14; n.following = false; this.say(n, pick(['Oh, you want to fight?', 'Big mistake.', 'Come on then!', 'You hit like my nan.']), 2.5); }
    else if (n.brave <= 0.45 && n.state !== 'flee') { n.state = 'flee'; n.stateT = 9; n.following = false; this.say(n, pick(['Ow! Stop!', 'Help!', 'Leave me alone!']), 2.5); }
    else if (n.state === 'angry') n.stateT = Math.max(n.stateT, 8);
  }

  // a bullet
  shot(n, dmg, dir, at, head) {
    const g = this.g;
    if (n.state === 'dead') return;
    if (n.state === 'seated' && n.car) { // (in a car: they tumble out)
      const car = n.car; car.unseat(n.human); g.scene.add(n.human.root); const o = car.doorPoint(n.seat, 0.6);
      n.body.setTranslation({ x: o.x, y: o.y + 1, z: o.z }, true); n.state = 'cop'; n.human.root.position.set(o.x, o.y, o.z); n.human.root.updateMatrixWorld(true);
    } else if (n.state === 'seated') return;
    if (n.hostage) g.player.releaseHostage(false);
    n.hp -= dmg; n.mood = -100; n.mem.hitBy++;
    g.blood.spray(at, dir.clone().setY(0.2).normalize(), head ? 34 : 16, 2.6);
    n.human.wound(at, head ? 0.1 : 0.09, 1); if (Math.random() < 0.6) g.blood.spray(at.clone().addScaledVector(dir, 0.25), dir, head ? 20 : 8, 4); // (the exit wound)
    const killed = n.hp <= 0;
    this.crimeAt(n, killed);
    const v = dir.clone().multiplyScalar(head ? 2.2 : 3).setY(0.6);
    if (killed) { this.knock(n, v, 4); this.die(n); return; }
    if (n.human.ragdoll) { n.human.ragdoll.push(v.multiplyScalar(0.4)); return; }
    if (n.hp < 45 || dmg > 30) { this.knock(n, v, 3); if (n.hp < 45 && !n.cop) this.downed(n); else n.stateT = 2.2; this.after(n, true); }
    if (!n.cop) this.panic(at, n);
  }

  // something pointed at them: hands up (and a wallet, after a moment)
  threaten(n, dt) {
    const g = this.g;
    if (n.cop || ['dead', 'seated'].includes(n.state) || n.human.ragdoll || n.hostage) return;
    if (n.state !== 'handsUp') { n.state = 'handsUp'; n.robT = 0; n.following = false; if (n.bench) { n.bench.taken = null; n.bench = null; } n.human.express('scared', 6); this.say(n, pick(['Whoa whoa whoa!', "Okay! Okay! Don't hurt me!", 'Please, I have kids!', 'Take it, take it!']), 2.5); g.police?.crime('threat', this.pos(n)); }
    n.stateT = Math.max(n.stateT, 1.8); n.robT += dt;
    if (n.robT > 2.0 && !n.mugged && !n.home) { n.mugged = true; const p = this.pos(n), amt = 10 + Math.floor(Math.random() * 70); g.pickups.cash(p.clone().add(V(Math.sin(n.yaw) * 0.7, 0, Math.cos(n.yaw) * 0.7)), amt); this.say(n, pick(["Here! It's all I've got!", 'Take it! Just go!', "That's everything, I swear!"]), 2.5); }
  }

  // everyone near something violent runs
  panic(at, except, R = 28) {
    for (const o of this.list) {
      if (o === except || ['dead', 'seated'].includes(o.state) || o.human.ragdoll) continue;
      const d = this.pos(o).distanceTo(at);
      if (o.cop || o.hostage || o.state === 'handsUp' || o.home && o.state === 'post' && d > 12) continue;
      if (d < R) { o.state = 'flee'; o.stateT = 8 + Math.random() * 6; o.following = false; if (o.bench) { o.bench.taken = null; o.bench = null; } if (d < 12 && Math.random() < 0.5) this.say(o, pick(['Oh my god!', 'Run!', 'Somebody call the police!', 'No no no no']), 2.5); }
    }
  }

  die(n) {
    if (n.cop && !n.dropped) { n.dropped = true; const q = n.human.ragdoll ? n.human.ragdoll.pelvis : this.pos(n); this.g.pickups?.gun('pistol', q.clone().setY(q.y - 0.5), 12); }
    if (n.hostage) this.g.player.releaseHostage(false);
    n.downed = false;
    n.human.dead = true; n.state = 'dead'; n.deadT = 0; n.pooled = false; n.following = false; n.bubbleT = 0;
    this.panic(n.human.ragdoll ? n.human.ragdoll.pelvis : this.pos(n), n);
  }

  getUp(n) {
    const p = n.human.ragdoll.pelvis, gy = this.groundAt(p.x, p.z, p.y + 0.5);
    n.human.ragdoll.dispose(); n.human.ragdoll = null; n.human.resetPose();
    const at = { x: p.x, y: gy + CENTRE + 0.05, z: p.z };
    n.body.setTranslation(at, true); n.body.setNextKinematicTranslation(at); n.col.setEnabled(true);
    n.vel.set(0, 0, 0);
    if (n.brave > 0.6 && !n.afterBad) { n.state = 'angry'; n.stateT = 8; this.say(n, n.mem.hitBy ? 'You hit me with your CAR?!' : 'Right. That does it.', 3); }
    else { n.state = 'flee'; n.stateT = 8; this.say(n, pick(['Somebody call the police!', 'Are you insane?!', 'Ow… my leg…']), 3); }
  }

  remove(n) {
    const g = this.g;
    if (n.human.ragdoll) { n.human.ragdoll.dispose(); n.human.ragdoll = null; }
    n.human.root.removeFromParent();
    g.world.removeRigidBody(n.body);
    this.list.splice(this.list.indexOf(n), 1);
    this.g.hud.bubbles.get(n)?.remove(); this.g.hud.bubbles.delete(n);
    if (!n.cop) this.spawn(NAMES[Math.floor(Math.random() * NAMES.length)]);
  }
}
