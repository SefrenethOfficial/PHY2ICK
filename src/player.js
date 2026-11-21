// You: a kinematic capsule moved by Rapier's character controller, wearing a Human.
import * as THREE from 'three';
import { Human } from './character.js';
import { G_WORLD, G_CAR, G_PED, G_PROP, groups } from './world.js';
import { Ragdoll } from './ragdoll.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

const HALF = 0.55, RAD = 0.3, CENTRE = HALF + RAD; // capsule: feet to centre

export class Player {
  constructor(g, pos) {
    this.g = g;
    const { world, R } = g;
    this.body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y + CENTRE, pos.z));
    this.col = world.createCollider(R.ColliderDesc.capsule(HALF, RAD).setSolverGroups(groups(G_PED, G_WORLD | G_PED)).setCollisionGroups(groups(G_PED, 0xffff)), this.body);
    this.cc = world.createCharacterController(0.03);
    this.cc.enableAutostep(0.45, 0.25, true);
    this.cc.enableSnapToGround(0.45);
    this.cc.setMaxSlopeClimbAngle(50 * Math.PI / 180);
    this.cc.setApplyImpulsesToDynamicBodies(true);
    this.cc.setCharacterMass(80);
    this.look = { female: false, skin: 0xd2a07a, hair: 0x2a1d14, under: 'short', beanie: 0x2c3036, height: 1.78, build: 1.05 };
    this.human = new Human(this.outfit('dressed'));
    g.scene.add(this.human.root);
    this.vel = new THREE.Vector3();
    this.vy = 0; this.grounded = true;
    this.yaw = 0;
    this.car = null; this.seat = null;
    this.downT = 0; // knocked over
    this.hp = 100;
    this.speed = 0;
  }

  // what you're wearing over the look you picked: dressed (the beanie, the hoodie, jeans), or just boxers
  outfit(kind) {
    const L = this.look;
    if (kind === 'bath') return { ...L, hairStyle: L.under === 'short' ? 'short' : L.under, shirt: L.skin, longSleeves: false, pants: 0x34477a, shorts: true, shoes: L.skin };
    return { ...L, hairStyle: 'beanie', shirt: 0x2b2f36, pants: 0x3a4a5e, shoes: 0x1a1a1a, longSleeves: true };
  }
  // put a new body on (a new look, or a change of clothes): the old one goes, the held weapon moves over
  dress(kind) {
    const g = this.g, old = this.human, H = new Human(this.outfit(kind));
    H.root.position.copy(old.root.position); H.root.rotation.copy(old.root.rotation);
    g.scene.remove(old.root); old.body.geometry.dispose(); g.scene.add(H.root);
    this.human = H; this.wearing = kind;
    const W = g.weapons, m = W.models?.[W.cur]; if (m && W.cur !== 'fists' && m.visible) W.mount(H, m, W.cur);
  }

  get pos() {
    if (this.ragdoll) { const p = this.ragdoll.pelvis; return p.setY(p.y - 0.75); }
    const t = this.body.translation(); return new THREE.Vector3(t.x, t.y - CENTRE, t.z);
  }
  get headPos() { return this.pos.add(new THREE.Vector3(0, 1.62, 0)); }

  physics(h) {
    if (this.car || this.scripted) return;
    if (this.ragdoll) {
      this.downT -= h;
      if (this.dead) return;
      if (this.downT <= 0 && this.ragdoll.speed < 0.8) this.getUp();
      return;
    }
    const g = this.g, k = g.keys;
    const want = new THREE.Vector3();
    const busy = g.wheel.open;
    if (this.smashT > 0) {
      this.smashT -= h; const c = this.smashCar;
      if (c && !c.smashed.driver && this.smashT < 0.4) { c.smash('driver'); g.police.crime('carjack', this.pos); }
      if (this.smashT <= 0 && c) { this.smashCar = null; if (!c.driver && c.pos.distanceTo(this.pos) < 4) this.enterCar(c); }
    }
    if (this.swimming || this.car) this.crouch = false;
    const stuck = busy || !!g.drugs?.cook || !!g.story?.locked || this.surrender || this.finishT > 0 || this.dead || g.ending || this.smashT > 0;
    if (!stuck) {
      if (k.has('KeyW')) want.z -= 1; if (k.has('KeyS')) want.z += 1;
      if (k.has('KeyA')) want.x -= 1; if (k.has('KeyD')) want.x += 1;
    }
    const run = (k.has('ShiftLeft') || k.has('ShiftRight')) && !this.hostage && !g.weapons.aiming;
    const t0 = this.body.translation(), feet = t0.y - CENTRE, wl = g.waterAt?.(t0.x, t0.z) ?? -99; this.wl = wl;
    this.swimming = feet < wl - 1.05;
    if (want.lengthSq() > 0) want.normalize().multiplyScalar(this.swimming ? (run ? 3.4 : 2.2) : this.crouch ? (run ? 2.8 : 1.25) : run ? 6.2 : this.hostage ? 1.5 : 1.9).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.cam.yaw);
    // ease toward the wanted velocity (a little weight to it)
    const acc = this.grounded ? (want.lengthSq() > 0 ? 9 : 12) : 2;
    this.vel.x += (want.x - this.vel.x) * Math.min(1, acc * h);
    this.vel.z += (want.z - this.vel.z) * Math.min(1, acc * h);
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    if (this.swimming) {
      // float with your head out; Space pulls you out where the edge is low enough
      this.vy += ((wl - 1.3 - feet) * 10 - this.vy * 4) * h;
      if (this.jumpQ && !busy) this.climbOut(fwd, wl);
    } else {
      if (this.grounded && !stuck && !this.hostage && this.jumpQ) {
        const v = this.vaultHeight(fwd, feet);
        if (v) { this.vy = Math.sqrt(2 * 18 * (v + 0.45)); this.vaultT = 0.55; } else this.vy = 5.2;
        this.grounded = false;
      }
      this.vy -= 18 * h;
    }
    this.jumpQ = false;
    if (this.vaultT > 0) { this.vaultT -= h; this.vel.x = fwd.x * 3.6; this.vel.z = fwd.z * 3.6; } // (over it)
    if (this.knock) { this.vel.add(this.knock); this.knock = null; }
    const desired = { x: this.vel.x * h, y: this.vy * h, z: this.vel.z * h };
    this.cc.computeColliderMovement(this.col, desired, undefined, groups(G_PED, G_WORLD | G_CAR | G_PED | G_PROP)); // (not the thing you're carrying, not ragdolls)
    const m = this.cc.computedMovement();
    this.grounded = this.cc.computedGrounded();
    if (this.grounded && this.vy < 0) this.vy = -1;
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    this.speed = Math.hypot(m.x, m.z) / h;
    if (t.y < -20 && !this.g.van?.contains(t)) this.body.setNextKinematicTranslation({ x: 0, y: 2, z: 8 }); // (fell out of the world: not in the van, which is down there)
    this.lastSafe = this.lastSafe || new THREE.Vector3(); if (this.grounded) this.lastSafe.set(t.x, t.y - CENTRE, t.z);
    // a hostage walks where you walk, just in front of you
    if (this.hostage) {
      const n = this.hostage, f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const at = { x: t.x + m.x + f.x * 0.5, y: t.y + m.y + 0.02, z: t.z + m.z + f.z * 0.5 };
      n.body.setNextKinematicTranslation(at); n.yaw = this.yaw; n.speed = this.speed; n.vel.set(this.vel.x, 0, this.vel.z);
    }
    // finishing someone off
    if (this.finishT > 0) {
      this.finishT -= h;
      const F = this.finish;
      if (!F.done && this.finishT < F.dur * 0.45) {
        F.done = true; const n = F.n, c = g.citizens, q = n.human.ragdoll ? n.human.ragdoll.pelvis : c.pos(n);
        if (F.kind === 'shoot') { const W = g.weapons; W.clip[W.cur] = Math.max(0, W.clip[W.cur] - 1); const m = W.models[W.cur]; m.updateMatrixWorld(true); const mz = (m.userData.muzzle || new THREE.Vector3()).clone().applyMatrix4(m.matrixWorld); g.fx.muzzle(mz, q.clone().sub(mz).normalize()); g.sfx.shot(mz, W.cur === 'shotgun'); g.fx.tracer(mz, q); }
        else g.sfx.punch(q);
        g.blood.spray(q.clone().add(new THREE.Vector3(0, 0.2, 0)), new THREE.Vector3(0, 1, 0), 26, 2.5); g.blood.pool(q, 1.4);
        { const w = new THREE.Vector3(); n.human.b[F.kind === 'stomp' ? 'head' : 'chest'].getWorldPosition(w); n.human.wound(w, 0.13, 1); }
        if (n.human.ragdoll) n.human.ragdoll.push(new THREE.Vector3(0, -2, 0));
        n.hp = 0; c.die(n); c.crimeAt(n, true);
      }
      if (this.finishT <= 0) this.finish = null;
    }
  }

  // ---- hurt, shot, punched
  hurt(dmg, dir, cause = 'hit', knock = false) {
    const g = this.g;
    if (this.dead || g.ending) return;
    this.hp = Math.max(0, this.hp - dmg);
    g.hud.hurt();
    if (cause === 'shot') { const at = this.pos.add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 1.0 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3)); if (!this.car) g.blood.spray(at, dir.clone().setY(0.2).normalize(), 10, 2); this.human.wound(at, 0.06, 0.9); }
    if (this.hp <= 0) {
      if (!this.car && !this.ragdoll) { const v = dir.clone().setY(0).normalize().multiplyScalar(cause === 'explosion' ? 9 : 2.5); v.y = cause === 'explosion' ? 6 : 1; this.ragdoll = this.human.ragdoll = new Ragdoll(g, this.human, v, 4); this.col.setEnabled(false); }
      this.die(cause); return;
    }
    if (knock && !this.car) this.knockDown(dir, 3.5, 0);
  }

  // ---- give up (when the police are after you): hands up, stand still
  toggleSurrender() {
    const g = this.g;
    if (this.car || this.ragdoll || this.dead) return;
    if (!this.surrender && !g.police.stars) return;
    this.surrender = !this.surrender;
    if (this.surrender) { if (this.hostage) this.releaseHostage(true); if (this.g.props.held) this.g.props.drop(false); g.hud.toast('You put your hands up. The police will come and arrest you.', '#9ad0ff'); }
  }

  // ---- grab someone: a sack over their head if you have one, a hand over their mouth if not
  grab() {
    const g = this.g;
    if (this.car || this.ragdoll || this.dead || this.surrender) return;
    if (this.hostage) { this.releaseHostage(true); return; }
    const p = this.pos, f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), cf = g.cam.forward;
    let best = null, bd = 1.9;
    for (const n of g.citizens.list) {
      if (['dead', 'seated'].includes(n.state) || n.human.ragdoll || n.cop) continue;
      const q = g.citizens.pos(n), d = q.distanceTo(p); if (d > bd) continue;
      const dir = q.clone().sub(p).setY(0).normalize(); if (dir.dot(cf) < 0.2 && dir.dot(f) < 0.2) continue;
      bd = d; best = n;
    }
    if (!best) { g.hud.toast('Nobody close enough to grab'); return; }
    const n = best, bag = (this.sacks || 0) > 0;
    if (bag) { this.sacks--; n.human.addBag(); }
    if (g.weapons.cur !== 'fists') g.weapons.equip('fists', true);
    if (g.props.held) g.props.drop(false);
    n.hostage = { bag }; n.hostageBag = bag; n.state = 'held'; n.following = false; n.col.setEnabled(false);
    if (n.bench) { n.bench.taken = null; n.bench = null; }
    this.hostage = n;
    n.human.express('scared', 999);
    g.hud.toast(bag ? `You pulled a sack over ${n.mem.met ? n.name : 'their'}${n.mem.met ? "'s" : ''} head · F by a car to bundle them in · G to let go` : 'You grabbed them, hand over their mouth · F by a car to bundle them in · G to let go', '#ff9a5a');
    g.police.crime('kidnap', p);
  }
  releaseHostage(push = true) {
    const g = this.g, n = this.hostage; if (!n) return;
    this.hostage = null; n.hostage = null; n.col.setEnabled(true);
    const p = g.citizens.pos(n); n.body.setTranslation({ x: p.x, y: p.y + CENTRE + 0.05, z: p.z }, true);
    n.human.express('scared', 4);
    if (n.state !== 'dead') { n.state = 'flee'; n.stateT = 12; if (push) g.citizens.say(n, n.hostageBag ? pick(['Get this thing off me!', 'Help! Somebody!']) : pick(['Psycho!', 'HELP!', 'Get away from me!']), 2.5); }
    if (n.hostageBag) setTimeout(() => n.human.removeBag(), 2500);
    n.hostageBag = false;
  }
  // into the car with them (they go in the passenger seat, and stay there)
  bundle(car) {
    const g = this.g, n = this.hostage; if (!n) return false;
    this.hostage = null; n.hostage = null; n.kidnapped = true;
    n.state = 'seated'; car.passenger = n; n.car = car; car.seatPerson(n.human, 'passenger');
    g.citizens.say(n, n.hostageBag ? 'Mmmph!!' : pick(['Where are you taking me?!', 'Let me go!']), 2);
    return true;
  }
  // let them out of the car
  freeKidnapped(car) {
    const g = this.g, n = car.passenger; if (!n || !n.kidnapped) return;
    n.kidnapped = false; g.citizens.unboard(n, car); n.car = null; car.openDoor('passenger', 0.8);
    n.state = 'flee'; n.stateT = 12; g.citizens.say(n, pick(['Thank god!', 'HELP!', "I'm calling the police!"]), 2.5);
    if (n.hostageBag) setTimeout(() => n.human.removeBag(), 2000); n.hostageBag = false;
    g.police.crime('kidnap', g.citizens.pos(n), true);
  }

  // ---- finish off someone who's down: a stamp, a stab, or a shot
  finishTarget() {
    const g = this.g; if (this.car || this.ragdoll || this.hostage || this.finishT > 0) return null;
    const p = this.pos;
    let best = null, bd = 2.4;
    for (const n of g.citizens.list) { if (!n.downed || n.state === 'dead' || !n.human.ragdoll) continue; const d = n.human.ragdoll.pelvis.distanceTo(p.clone().setY(n.human.ragdoll.pelvis.y)); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  finishOff() {
    const n = this.finishTarget(); if (!n) return;
    const W = this.g.weapons, gun = W.W.gun && W.clip[W.cur] > 0, blade = !W.W.gun && W.cur !== 'fists' && W.cur !== 'kiddie';
    const kind = gun ? 'shoot' : blade ? 'stab' : 'stomp', dur = kind === 'shoot' ? 0.7 : kind === 'stab' ? 1.1 : 0.9;
    this.finish = { n, kind, dur, done: false }; this.finishT = dur;
    const q = n.human.ragdoll.pelvis, p = this.pos; this.yaw = Math.atan2(q.x - p.x, q.z - p.z);
  }

  frame(dt) {
    const H = this.human;
    if (this.car) {
      const bk = this.car.boarding?.h === H ? this.car.boardingK : 1;
      H.update(dt, bk < 0.42 ? { pose: 'stand', speed: 0, grounded: true } : { pose: this.dead ? 'slump' : 'drive', steer: this.car.steer / this.car.maxSteer });
      return;
    }
    if (this.ragdoll) { H.update(dt, {}); return; }
    if (this.scripted) { const S = this.scripted; H.root.position.copy(S.pos); H.root.rotation.y = S.yaw; H.lookYaw += ((S.look || 0) - H.lookYaw) * Math.min(1, dt * 4); H.update(dt, { speed: 0, grounded: true, ...S.pose }); return; }
    this.shiverT = Math.max(0, (this.shiverT || 0) - dt);
    const p = this.pos;
    H.root.position.copy(p);
    // face where you're going (or where you're talking)
    let face = null;
    if (this.speed > 0.4) face = Math.atan2(this.vel.x, this.vel.z);
    const Wp = this.g.weapons;
    if (Wp.attackPhase != null || Wp.punchPhase != null || Wp.aiming || (Wp.W.gun && Wp.cool > 0)) face = this.g.cam.yaw + Math.PI; // (swing, punch and shoot where you're looking)
    if (this.finish) { const q = this.finish.n.human.ragdoll?.pelvis; if (q) face = Math.atan2(q.x - p.x, q.z - p.z); }
    if (this.g.wheel.open && this.g.wheel.target) { const q = this.g.citizens.pos(this.g.wheel.target); face = Math.atan2(q.x - p.x, q.z - p.z); }
    if (face !== null) {
      let d = face - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 10);
    }
    H.root.rotation.y = this.yaw;
    const W = this.g.weapons;
    if (this.swimming) { // (lie along the surface when swimming; upright when treading water)
      const mv = Math.min(1, this.speed / 1.5), wl = this.wl;
      H.root.position.y = wl - 1.45 + mv * 1.05;
      H.root.position.x -= Math.sin(this.yaw) * mv * 0.9; H.root.position.z -= Math.cos(this.yaw) * mv * 0.9;
    }
    const cd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.g.camera.quaternion), e = Math.asin(THREE.MathUtils.clamp(cd.y, -1, 1));
    const F = this.finish, fa = F ? 1 - this.finishT / F.dur : 0;
    const gunOut = W.W.gun && (W.aiming || W.cool > 0 || (F && F.kind === 'shoot'));
    H.update(dt, { speed: this.speed, grounded: this.grounded || this.swimming, vy: this.vy, pose: this.swimming ? 'swim' : 'stand', talking: this.talkT > 0,
      weapon: !!W.held && !gunOut, attack: W.attackPhase, carry: this.g.props.held ? (this.g.props.small ? 'small' : 'big') : null,
      guard: W.cur === 'fists' && (W.aiming || W.guardT > 0) && W.punchPhase == null && !this.hostage && !this.surrender,
      punch: this.smashT > 0 ? { a: 1 - this.smashT / 0.75, side: 'R' } : W.punchPhase != null ? { a: W.punchPhase, side: W.combo % 2 ? 'L' : 'R', hook: W.combo === 2 } : null,
      aim: F && F.kind === 'shoot' ? { e: -0.9, kind: W.cur } : gunOut ? { e, kind: W.cur, recoil: W.recoil } : (W.aiming && W.cur !== 'fists' ? { e, kind: 'melee' } : null),
      handsUp: this.surrender || !!this.g.police.cops().find(n => n.frisking), crouch: this.crouch && !this.swimming, shiver: this.shiverT > 0 && !this.swimming, hold: this.hostage ? (this.hostage.hostage?.bag ? 'bag' : 'mouth') : null,
      stomp: F && F.kind === 'stomp' ? fa : null, stab: F && F.kind === 'stab' ? fa : null });
    this.talkT = Math.max(0, (this.talkT || 0) - dt);
  }

  // something low in front you could vault (a fence, a wall, a bench)? its height above your feet
  vaultHeight(fwd, feet) {
    const g = this.g, t = this.body.translation(), ex = (c) => c.handle !== this.col.handle && !c.isSensor();
    const knee = g.world.castRay(new g.R.Ray({ x: t.x, y: feet + 0.5, z: t.z }, { x: fwd.x, y: 0, z: fwd.z }), 1.0, true, g.R.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, undefined, undefined, ex);
    if (!knee) return 0;
    const head = g.world.castRay(new g.R.Ray({ x: t.x, y: feet + 1.75, z: t.z }, { x: fwd.x, y: 0, z: fwd.z }), 1.3, true, g.R.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, undefined, undefined, ex);
    if (head) return 0; // (too tall)
    const d = knee.timeOfImpact + 0.04, down = g.world.castRay(new g.R.Ray({ x: t.x + fwd.x * d, y: feet + 1.7, z: t.z + fwd.z * d }, { x: 0, y: -1, z: 0 }), 1.7, true, g.R.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, undefined, undefined, ex);
    const top = down ? feet + 1.7 - down.timeOfImpact : feet + 1.5;
    const hgt = top - feet;
    return hgt > 0.45 && hgt < 1.6 ? hgt : 0;
  }

  // pull yourself out of the water onto a ledge in front
  climbOut(fwd, wl) {
    const g = this.g, t = this.body.translation();
    for (const d of [0.9, 1.4]) {
      const x = t.x + fwd.x * d, z = t.z + fwd.z * d;
      const hit = g.world.castRay(new g.R.Ray({ x, y: wl + 2.5, z }, { x: 0, y: -1, z: 0 }), 3.5, true, g.R.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, undefined, undefined, (c) => c.handle !== this.col.handle);
      if (!hit) continue;
      const top = wl + 2.5 - hit.timeOfImpact;
      if (top > wl - 0.2 && top < wl + 1.9) {
        const at = { x: x + fwd.x * 0.3, y: top + CENTRE + 0.08, z: z + fwd.z * 0.3 };
        this.body.setTranslation(at, true); this.body.setNextKinematicTranslation(at); this.vy = 0; this.climbT = 0.4;
        return true;
      }
    }
    return false;
  }

  // hit by a car (or shoved): you go limp, and get up when you've stopped rolling
  knockDown(dir, force, dmg = force * 4) {
    if (this.car || this.ragdoll || this.dead) return;
    const g = this.g;
    if (g.props.held) g.props.drop(false);
    const v = dir.clone().setY(0).normalize().multiplyScalar(Math.min(force, 16) * 0.75); v.y = Math.min(5, 1 + force * 0.25);
    this.ragdoll = this.human.ragdoll = new Ragdoll(g, this.human, v, 2 + force * 0.3);
    this.col.setEnabled(false);
    this.downT = 2.4;
    this.hp = Math.max(0, this.hp - dmg);
    if (force > 7) g.blood.spray(this.ragdoll.pelvis.add(new THREE.Vector3(0, 0.3, 0)), v.clone().normalize(), 26, 3);
    if (this.hp <= 0) this.die();
    else g.hud.toast(force > 6 ? 'You got hit by a car!' : 'You got knocked down');
  }

  getUp() {
    const p = this.ragdoll.pelvis;
    const hit = this.g.world.castRay(new this.g.R.Ray({ x: p.x, y: p.y + 0.5, z: p.z }, { x: 0, y: -1, z: 0 }), 4, true, this.g.R.QueryFilterFlags.ONLY_FIXED);
    const y = hit ? p.y + 0.5 - hit.timeOfImpact : p.y - 0.15;
    this.ragdoll.dispose(); this.ragdoll = this.human.ragdoll = null;
    this.human.resetPose();
    const at = { x: p.x, y: y + CENTRE + 0.05, z: p.z };
    this.body.setTranslation(at, true); this.body.setNextKinematicTranslation(at);
    this.col.setEnabled(true);
    this.vel.set(0, 0, 0); this.vy = 0;
  }

  die(cause = 'hit') {
    const g = this.g;
    if (this.dead) return;
    this.dead = true;
    if (this.hostage) this.releaseHostage(false);
    g.endScreen('wasted');
  }

  // back on your feet somewhere (after WASTED or BUSTED)
  respawn(at, yaw) {
    const g = this.g;
    if (this.car) this.exitCar();
    if (this.ragdoll) { this.ragdoll.dispose(); this.ragdoll = this.human.ragdoll = null; }
    this.human.resetPose(); this.human.dead = false;
    if (yaw != null) { this.yaw = yaw; g.cam.yaw = yaw + Math.PI; }
    this.body.setTranslation({ x: at.x, y: at.y + CENTRE + 0.1, z: at.z }, true); this.body.setNextKinematicTranslation({ x: at.x, y: at.y + CENTRE + 0.1, z: at.z });
    this.col.setEnabled(true); this.dead = false; this.surrender = false; this.hp = 100; this.vel.set(0, 0, 0); this.vy = 0; this.finish = null; this.finishT = 0;
  }

  enterCar(car, seat = 'driver') {
    this.car = car; this.seat = seat;
    this.col.setEnabled(false);
    this.vel.set(0, 0, 0);
    car.seatPerson(this.human, seat);
    car.driver = this;
    car.board(this.human, seat);
  }

  // a locked car: an elbow through the window first
  smashIn(car) {
    const g = this.g; if (this.smashT > 0) return;
    const p = car.doorPoint('driver', 0.55); this.body.setTranslation({ x: p.x, y: p.y + CENTRE + 0.1, z: p.z }, true); this.body.setNextKinematicTranslation({ x: p.x, y: p.y + CENTRE + 0.1, z: p.z });
    this.yaw = car.yaw - Math.PI / 2; this.smashT = 0.75; this.smashCar = car;
  }

  // getting out at speed: you throw the door open and go, and the road does the rest
  bailOut(through = false) {
    const car = this.car; if (!car) return;
    const g = this.g, lv = car.body.linvel(), spd = Math.hypot(lv.x, lv.z);
    this.exitCar();
    const p = this.pos, side = new THREE.Vector3(p.x - car.pos.x, 0, p.z - car.pos.z).normalize();
    const H = this.human;
    H.resetPose(); H.root.position.copy(p); H.root.rotation.set(0, this.yaw, 0);
    H.update(1 / 60, { speed: 0, grounded: false, vy: -1, pose: 'stand' }); H.root.updateMatrixWorld(true);
    if (through) { const f = car.forward, at = car.pos.clone().addScaledVector(f, 2.7).add(new THREE.Vector3(0, 0.6, 0)); H.root.position.copy(at); H.root.updateMatrixWorld(true); }
    const v = through ? new THREE.Vector3(lv.x * 1.05, 2.6, lv.z * 1.05).addScaledVector(car.forward, 2) : new THREE.Vector3(lv.x * 0.92 + side.x * 2.4, 1.6, lv.z * 0.92 + side.z * 2.4);
    this.ragdoll = H.ragdoll = new Ragdoll(g, H, v, 3 + spd * 0.35);
    this.col.setEnabled(false);
    this.downT = 1.8 + Math.min(2.5, spd * 0.08);
    const dmg = Math.max(0, spd - 7) * (through ? 2.8 : 2.2);
    this.hp = Math.max(0, this.hp - dmg);
    if (spd > 9) g.blood.spray(this.ragdoll.pelvis.add(new THREE.Vector3(0, 0.3, 0)), v.clone().normalize(), 14, 2);
    if (this.hp <= 0) this.die();
    else if (!through) g.hud.toast(spd > 14 ? 'You threw yourself out of a moving car. Bold.' : 'You bailed out!');
  }

  exitCar() {
    const car = this.car; if (!car) return;
    const out = car.doorPoint('driver', 1.1);
    this.car = null;
    car.unseat(this.human); car.driver = null; car.boarding = null; car.openDoor('driver', 0.55);
    this.g.scene.add(this.human.root);
    this.body.setTranslation({ x: out.x, y: out.y + CENTRE + 0.2, z: out.z }, true);
    this.body.setNextKinematicTranslation({ x: out.x, y: out.y + CENTRE + 0.2, z: out.z });
    this.col.setEnabled(true);
    this.yaw = car.yaw + Math.PI / 2;
    this.vy = 0;
  }
}
