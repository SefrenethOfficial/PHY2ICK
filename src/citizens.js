// Citizens: people who wander the park, sit on benches, and remember how you treated them.
import * as THREE from 'three';
import { Human, randomLook } from './character.js';
import { G_WORLD, G_PED, groups } from './world.js';

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
    for (let i = 0; i < n; i++) this.spawn(NAMES[i % NAMES.length]);
  }

  randomPoint() {
    const { x, z } = this.map.walk;
    for (let i = 0; i < 30; i++) {
      const p = V((Math.random() * 2 - 1) * x, 0, (Math.random() * 2 - 1) * z);
      if (Math.hypot(p.x, p.z) < 5.5) continue; // (the fountain)
      if (Math.abs(p.x - 30) < 4 && Math.abs(p.z - 20) < 3) continue; // (the café)
      return p;
    }
    return V(0, 0, 8);
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
      mood: Math.floor(Math.random() * 35), // −100 … 100
      brave: Math.random(),
      walkSpeed: 1.15 + Math.random() * 0.45,
      state: 'wander', target: this.randomPoint(), stateT: 0,
      yaw: Math.random() * 6.28, speed: 0, vel: V(),
      mem: { met: false, talks: 0, gifts: 0, insults: 0, compliments: 0, hitBy: 0 },
      following: false, bubbleT: 0, blockedT: 0, gossip: [...GOSSIP].sort(() => Math.random() - 0.5),
    };
    this.list.push(npc);
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
        case 'down':
          if (n.stateT <= 0) {
            if (n.brave > 0.6) { n.state = 'angry'; n.stateT = 8; this.say(n, 'You hit me with your CAR?!', 3); }
            else { n.state = 'flee'; n.stateT = 6; this.say(n, pick(['Somebody call the police!', 'Are you insane?!']), 3); }
          }
          break;
      }
      if (n.state === 'sit' || n.state === 'down') { n.speed = 0; n.vel.set(0, 0, 0); this.move(n, p, V(), h); continue; }
      // dodge a car coming at you
      for (const car of g.cars) {
        if (Math.abs(car.speed) < 6 || n.state === 'down') continue;
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
        if (n.blockedT > 1.5 && n.state === 'wander') { n.target = this.randomPoint(); n.blockedT = 0; }
      } else n.blockedT = Math.max(0, n.blockedT - h);
      n.vel.lerp(want, Math.min(1, h * 8));
      this.move(n, p, n.vel, h);
    }
  }

  move(n, p, vel, h) {
    const nx = p.x + vel.x * h, nz = p.z + vel.z * h;
    const gy = n.state === 'sit' ? p.y : this.groundAt(nx, nz, p.y + 1.2);
    const y = p.y + (gy - p.y) * Math.min(1, h * 15);
    n.body.setNextKinematicTranslation({ x: nx, y: y + CENTRE, z: nz });
    n.speed = Math.hypot(vel.x, vel.z);
  }

  wander(n) { n.state = n.following ? 'follow' : 'wander'; n.target = this.randomPoint(); n.stateT = 0; }

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
      const p = this.pos(n);
      H.root.position.copy(p);
      let face = null;
      if (n.speed > 0.3) face = Math.atan2(n.vel.x, n.vel.z);
      if (['talk', 'angry'].includes(n.state) || (g.wheel.open && g.wheel.target === n)) { const q = pl.pos; face = Math.atan2(q.x - p.x, q.z - p.z); }
      if (n.state === 'sit') face = n.yaw;
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
        pose: n.state === 'down' ? 'down' : n.state === 'sit' ? 'passenger' : 'stand',
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

  hitByCar(n, dir, force) {
    if (n.state === 'down' || n.state === 'seated') return;
    if (n.bench) { n.bench.taken = null; n.bench = null; }
    n.state = 'down'; n.stateT = 2.5 + Math.random(); n.following = false;
    n.mem.hitBy++; n.mood -= 60;
    const p = this.pos(n), to = p.clone().addScaledVector(dir.setY(0).normalize(), Math.min(force * 0.35, 5));
    const at = { x: to.x, y: this.groundAt(to.x, to.z) + CENTRE, z: to.z };
    n.body.setTranslation(at, true); n.body.setNextKinematicTranslation(at);
  }
}
