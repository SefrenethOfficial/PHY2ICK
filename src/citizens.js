// Citizens: people who wander the park, sit on benches, and remember how you treated them.
import * as THREE from 'three';
import { Human, randomLook } from './character.js';
import { G_WORLD, G_CAR, G_PED, G_PROP, groups } from './world.js';
import { Ragdoll } from './ragdoll.js';

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
    this.cc.enableAutostep(0.45, 0.25, true); this.cc.enableSnapToGround(0.5);
    this.cc.setMaxSlopeClimbAngle(50 * Math.PI / 180); this.cc.setApplyImpulsesToDynamicBodies(true);
    for (let i = 0; i < n; i++) this.spawn(NAMES[i % NAMES.length]);
  }

  // somewhere on a sidewalk: near home and the middle of town at first, then near wherever they are
  randomPoint(near = null) {
    const g = this.g, m = this.map;
    if (near) return m.sidewalkPoint(near, 55);
    const hubs = [g.apt.door, g.townSquare || g.apt.door, g.places['the coffee store']?.pos, g.places['palm tree beach']?.pos, g.places['the diner']?.pos].filter(Boolean);
    return m.sidewalkPoint(hubs[Math.floor(Math.random() * hubs.length)], 70);
  }

  spawn(name) {
    const g = this.g, { world, R } = g;
    const p = this.randomPoint();
    const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, CENTRE + 0.1, p.z));
    const col = world.createCollider(R.ColliderDesc.capsule(HALF, RAD).setSolverGroups(groups(G_PED, G_WORLD | G_PED)).setCollisionGroups(groups(G_PED, 0xffff)), body);
    const human = new Human(randomLook());
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
    npc.target = this.randomPoint(p);
    this.list.push(npc);
  }

  // someone who works somewhere: stands at their post, says their own lines
  addWorker(w) {
    this.spawn(NAMES[Math.floor(Math.random() * NAMES.length)]);
    const n = this.list[this.list.length - 1];
    n.body.setTranslation({ x: w.pos.x, y: w.pos.y + CENTRE + 0.05, z: w.pos.z }, true);
    n.state = 'post'; n.home = w.pos.clone(); n.homeYaw = w.yaw; n.yaw = w.yaw; n.lines = w.lines; n.role = w.role; n.mood = 30; n.target = null;
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

  physics(h) {
    const g = this.g, pl = g.player, pp = pl.car ? pl.car.pos.clone() : pl.pos;
    for (const n of this.list) {
      if (n.state === 'seated') continue;
      if (n.state === 'dead') { n.deadT += h; if (n.deadT > 90) { this.remove(n); continue; } /* (the body stays a while; then someone new turns up) */ if (!n.pooled && n.deadT > 1.2 && n.human.ragdoll.speed < 0.3) { n.pooled = true; g.blood.pool(n.human.ragdoll.pelvis, 1.3 + Math.random() * 0.6); } continue; }
      if (n.human.ragdoll) { n.stateT -= h; if (n.stateT <= 0 && n.human.ragdoll.speed < 0.6) this.getUp(n); continue; }
      const p = this.pos(n);
      n.stateT -= h;
      let goal = null, spd = 0;
      const dP = Math.hypot(pp.x - p.x, pp.z - p.z);
      switch (n.state) {
        case 'wander':
          goal = n.target; spd = n.walkSpeed;
          if (Math.hypot(goal.x - p.x, goal.z - p.z) < 0.8) {
            const b = g.benches.find(b => !b.taken && b.pos.distanceTo(p) < 12);
            if (b && Math.random() < 0.35) { n.state = 'toBench'; n.bench = b; b.taken = n; }
            else { n.state = 'idle'; n.stateT = 3 + Math.random() * 7; }
          }
          break;
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
        case 'angry':
          goal = pp; spd = 4.4;
          if (dP < 1.25 && !pl.car) { // a shove
            pl.knockDown(V(pp.x - p.x, 0, pp.z - p.z), 4);
            this.say(n, pick(["That's for running your mouth.", 'Next time, keep walking.', "Not so funny now, is it?"]), 3.5);
            n.mood = Math.min(n.mood + 30, -10);
            n.state = 'idle'; n.stateT = 3;
          }
          if (n.stateT <= 0 || pl.car) this.wander(n);
          break;
        case 'down': this.wander(n); break;
      }
      if (n.state === 'sit') { n.speed = 0; n.vel.set(0, 0, 0); this.move(n, p, V(), h); continue; }
      // dodge a car coming at you
      for (const car of g.cars) {
        if (Math.abs(car.speed) < 6) continue;
        const loc = car.group.worldToLocal(p.clone().add(V(0, 0.9, 0)));
        const ahead = car.speed > 0 ? loc.z : -loc.z;
        if (ahead > 2 && ahead < 14 && Math.abs(loc.x) < 1.6) {
          const side = V(loc.x >= 0 ? 1 : -1, 0, 0).applyQuaternion(car.group.quaternion).setY(0).normalize();
          goal = p.clone().addScaledVector(side, 4); spd = 5.5;
          if (!n.dodgeSaid) { n.dodgeSaid = true; this.say(n, pick(['Whoa!', 'Watch it!', 'Hey!']), 1.6); setTimeout(() => (n.dodgeSaid = false), 4000); }
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
      if (want.lengthSq() > 0.01 && this.blocked(n, p, want.clone().normalize())) {
        n.blockedT += h;
        want.applyAxisAngle(V(0, 1, 0), 1.1); // (step round it)
        if (n.blockedT > 1.5 && n.state === 'wander') { n.target = this.randomPoint(p); n.blockedT = 0; }
      } else n.blockedT = Math.max(0, n.blockedT - h);
      n.vel.lerp(want, Math.min(1, h * 8));
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

  wander(n) { if (n.home && !n.following) { n.state = 'post'; return; } n.state = n.following ? 'follow' : 'wander'; n.target = this.randomPoint(this.pos(n)); n.stateT = 0; }

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

  frame(dt) {
    const g = this.g, pl = g.player;
    for (const n of this.list) {
      n.bubbleT = Math.max(0, n.bubbleT - dt);
      const H = n.human;
      if (n.state === 'seated') { H.update(dt, { pose: 'passenger' }); continue; }
      if (H.ragdoll) { H.update(dt, {}); continue; }
      const p = this.pos(n);
      H.root.position.copy(p);
      let face = null;
      if (n.speed > 0.3) face = Math.atan2(n.vel.x, n.vel.z);
      if (['talk', 'angry'].includes(n.state) || (g.wheel.open && g.wheel.target === n)) { const q = pl.pos; face = Math.atan2(q.x - p.x, q.z - p.z); }
      if (n.state === 'sit') face = n.yaw;
      if (n.state === 'post' && n.speed < 0.3 && !(g.wheel.open && g.wheel.target === n)) face = n.homeYaw;
      if (face !== null) { let d = face - n.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); n.yaw += d * Math.min(1, dt * 8); }
      H.root.rotation.y = n.yaw;
      if (n.state === 'sit') { H.root.position.y = p.y - 0.42 * H.rig.scale.y; H.root.position.addScaledVector(V(Math.sin(n.yaw), 0, Math.cos(n.yaw)), -0.05); }
      // look at you when you're close
      const dP = pl.pos.distanceTo(p);
      let ly = 0;
      if (dP < 6 && !pl.car) { const a = Math.atan2(pl.pos.x - p.x, pl.pos.z - p.z) - n.yaw; ly = THREE.MathUtils.clamp(Math.atan2(Math.sin(a), Math.cos(a)), -1, 1); }
      H.lookYaw += (ly - H.lookYaw) * Math.min(1, dt * 5);
      H.update(dt, {
        speed: n.speed, grounded: true, vy: 0,
        pose: n.state === 'sit' ? 'passenger' : 'stand',
        talking: n.bubbleT > 0 && n.speed < 0.3, point: n.pointT > 0, wave: n.waveT > 0,
      });
      n.pointT = Math.max(0, (n.pointT || 0) - dt); n.waveT = Math.max(0, (n.waveT || 0) - dt);
    }
  }

  say(n, text, dur) { n.bubbleT = dur ?? Math.min(9, 2 + text.length * 0.06); this.g.hud.bubble(n, text, n.bubbleT); }

  // ---- the interaction wheel's actions
  options(n) {
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
        g.money -= 20; m.gifts++; n.mood = Math.min(100, n.mood + 25);
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
        if (m.insults > 0 && n.mood < 0) { this.say(n, "Oh, NOW you're being nice?", 3); n.mood += 5; }
        else { this.say(n, pick(['Ha! Thanks.', 'You\'re sweet.', 'Well, that made my day.', 'Smooth. Very smooth.']), 2.8); n.mood = Math.min(100, n.mood + 10); }
        stay();
        break;
      case 'insult':
        m.insults++; n.mood -= 35;
        if (n.mood < -40 && n.brave > 0.45) { n.state = 'angry'; n.stateT = 8; n.following = false; this.say(n, pick(['What did you just say to me?!', 'Say that again. I dare you.']), 3); }
        else if (n.mood < -40) { n.state = 'flee'; n.stateT = 5; n.following = false; this.say(n, pick(['Psycho!', 'Get away from me!']), 2.5); }
        else { this.say(n, pick(['Wow. Rude.', 'Excuse me?', 'Okay, that was uncalled for.']), 2.6); stay(); }
        break;
    }
    n.mood = THREE.MathUtils.clamp(n.mood, -100, 100);
  }

  // ---- getting hurt
  knock(n, vel, spin = 4) {
    if (n.bench) { n.bench.taken = null; n.bench = null; }
    if (n.human.ragdoll) { n.human.ragdoll.push(vel); return; }
    n.col.setEnabled(false);
    n.human.ragdoll = new Ragdoll(this.g, n.human, vel, spin);
    n.state = 'down'; n.stateT = 2.4 + Math.random(); n.following = false;
  }

  hitByCar(n, dir, force) {
    if (n.state === 'seated' || n.state === 'dead') return;
    n.mem.hitBy++; n.mood -= 60;
    const v = dir.clone().setY(0).normalize().multiplyScalar(Math.min(force, 18) * 0.85); v.y = Math.min(6, 1.2 + force * 0.3);
    this.knock(n, v, 3 + force * 0.4);
    n.hp -= force * 6.5;
    if (force > 6) this.g.blood.spray(n.human.ragdoll.pelvis.add(new THREE.Vector3(0, 0.35, 0)), v.clone().normalize(), Math.min(60, force * 3), 3.5);
    if (n.hp <= 0) this.die(n);
    else this.after(n, force > 10);
  }

  // hit with a weapon
  struck(n, W, dir) {
    const g = this.g;
    const chest = n.human.ragdoll ? n.human.ragdoll.pelvis.add(new THREE.Vector3(0, 0.35, 0)) : this.pos(n).add(new THREE.Vector3(0, 1.3, 0));
    if (W.dmg === 0) { // the plastic kiddie knife
      g.hud.toast('The plastic knife bends. Nothing happens.');
      if (!n.human.ragdoll) { n.mood -= 8; n.state = 'talk'; n.stateT = 3; this.say(n, pick(['…Was that a plastic knife?', 'Did you just… poke me?', "Ha! Is that from a kids' meal?", 'Okay. Weird. Bye.']), 3); }
      return;
    }
    n.hp -= W.dmg; n.mood -= 80; n.mem.hitBy++;
    g.blood.spray(chest, dir.clone().setY(0.3).normalize(), W.bleed, 2.5);
    this.panic(this.pos(n), n);
    if (n.hp <= 0) { this.knock(n, dir.clone().multiplyScalar(W.force).setY(1), 3); this.die(n); return; }
    if (W.dmg >= 40) { this.knock(n, dir.clone().multiplyScalar(W.force).setY(1.5), 3); this.after(n, true); }
    else if (!n.human.ragdoll) { // a stab that doesn't drop them
      n.state = n.brave > 0.75 ? 'angry' : 'flee'; n.stateT = n.state === 'angry' ? 7 : 9; n.following = false;
      this.say(n, n.state === 'angry' ? pick(['You STABBED me?!', 'Oh, you are going to regret that.']) : pick(['Aaah! Help!', 'He stabbed me! Somebody help!', 'Get away from me!']), 3);
    }
  }

  after(n, bad) { n.afterBad = bad; }

  // everyone near something violent runs
  panic(at, except) {
    for (const o of this.list) {
      if (o === except || ['dead', 'seated'].includes(o.state) || o.human.ragdoll) continue;
      const d = this.pos(o).distanceTo(at);
      if (d < 28) { o.state = 'flee'; o.stateT = 8 + Math.random() * 6; o.following = false; if (o.bench) { o.bench.taken = null; o.bench = null; } if (d < 12 && Math.random() < 0.5) this.say(o, pick(['Oh my god!', 'Run!', 'Somebody call the police!', 'No no no no']), 2.5); }
    }
  }

  die(n) {
    n.state = 'dead'; n.deadT = 0; n.pooled = false; n.following = false; n.bubbleT = 0;
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
    this.spawn(NAMES[Math.floor(Math.random() * NAMES.length)]);
  }
}
