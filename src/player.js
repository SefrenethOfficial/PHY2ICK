// You: a kinematic capsule moved by Rapier's character controller, wearing a Human.
import * as THREE from 'three';
import { Human } from './character.js';
import { G_WORLD, G_CAR, G_PED, G_PROP, groups } from './world.js';
import { Ragdoll } from './ragdoll.js';

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
    this.human = new Human({
      female: false, skin: 0xd2a07a, hair: 0x2a1d14, hairStyle: 'swept', shirt: 0x2b2f36, pants: 0x3a4a5e, shoes: 0x1a1a1a,
      longSleeves: true, height: 1.78, build: 1.05,
    });
    g.scene.add(this.human.root);
    this.vel = new THREE.Vector3();
    this.vy = 0; this.grounded = true;
    this.yaw = 0;
    this.car = null; this.seat = null;
    this.downT = 0; // knocked over
    this.hp = 100;
    this.speed = 0;
  }

  get pos() {
    if (this.ragdoll) { const p = this.ragdoll.pelvis; return p.setY(p.y - 0.75); }
    const t = this.body.translation(); return new THREE.Vector3(t.x, t.y - CENTRE, t.z);
  }
  get headPos() { return this.pos.add(new THREE.Vector3(0, 1.62, 0)); }

  physics(h) {
    if (this.car) return;
    if (this.ragdoll) {
      this.downT -= h;
      if (this.dead) return;
      if (this.downT <= 0 && this.ragdoll.speed < 0.8) this.getUp();
      return;
    }
    const g = this.g, k = g.keys;
    const want = new THREE.Vector3();
    const busy = g.wheel.open;
    if (!busy) {
      if (k.has('KeyW')) want.z -= 1; if (k.has('KeyS')) want.z += 1;
      if (k.has('KeyA')) want.x -= 1; if (k.has('KeyD')) want.x += 1;
    }
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const t0 = this.body.translation(), feet = t0.y - CENTRE, wl = g.waterLevel ?? -99;
    this.swimming = feet < wl - 1.05;
    if (want.lengthSq() > 0) want.normalize().multiplyScalar(this.swimming ? (run ? 3.4 : 2.2) : run ? 6.2 : 1.9).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.cam.yaw);
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
      if (this.grounded && !busy && this.jumpQ) {
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
    if (t.y < -20) this.body.setNextKinematicTranslation({ x: 0, y: 2, z: 8 }); // (fell out of the world)
    this.lastSafe = this.lastSafe || new THREE.Vector3(); if (this.grounded) this.lastSafe.set(t.x, t.y - CENTRE, t.z);
  }

  frame(dt) {
    const H = this.human;
    if (this.car) {
      H.update(dt, { pose: 'drive', steer: this.car.steer / this.car.maxSteer });
      return;
    }
    if (this.ragdoll) { H.update(dt, {}); return; }
    const p = this.pos;
    H.root.position.copy(p);
    // face where you're going (or where you're talking)
    let face = null;
    if (this.speed > 0.4) face = Math.atan2(this.vel.x, this.vel.z);
    if (this.g.weapons.attackPhase != null) face = this.g.cam.yaw + Math.PI; // (swing where you're looking)
    if (this.g.wheel.open && this.g.wheel.target) { const q = this.g.citizens.pos(this.g.wheel.target); face = Math.atan2(q.x - p.x, q.z - p.z); }
    if (face !== null) {
      let d = face - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 10);
    }
    H.root.rotation.y = this.yaw;
    const W = this.g.weapons;
    if (this.swimming) { // (lie along the surface when swimming; upright when treading water)
      const mv = Math.min(1, this.speed / 1.5), wl = this.g.waterLevel;
      H.root.position.y = wl - 1.45 + mv * 1.05;
      H.root.position.x -= Math.sin(this.yaw) * mv * 0.9; H.root.position.z -= Math.cos(this.yaw) * mv * 0.9;
    }
    H.update(dt, { speed: this.speed, grounded: this.grounded || this.swimming, vy: this.vy, pose: this.swimming ? 'swim' : 'stand', talking: this.talkT > 0, weapon: !!W.held, attack: W.attackPhase, carry: !!this.g.props.held });
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

  die() {
    const g = this.g;
    this.dead = true;
    g.hud.blackout(true);
    if (g.weapons.held) g.weapons.putAway(true);
    setTimeout(() => { // you come round at the Hospital
      if (this.ragdoll) { this.ragdoll.dispose(); this.ragdoll = this.human.ragdoll = null; }
      this.human.resetPose();
      const s = g.hospitalSpawn || g.apt.spawn; if (g.hospitalYaw != null) { this.yaw = g.hospitalYaw; g.cam.yaw = g.hospitalYaw + Math.PI; }
      this.body.setTranslation({ x: s.x, y: s.y + CENTRE + 0.1, z: s.z }, true); this.body.setNextKinematicTranslation({ x: s.x, y: s.y + CENTRE + 0.1, z: s.z });
      this.col.setEnabled(true); this.dead = false; this.hp = 100; this.vel.set(0, 0, 0); this.vy = 0;
      g.money = Math.max(0, g.money - 100);
      g.hud.blackout(false);
      g.hud.toast('You wake up outside the Hospital, aching. The bill: $100');
    }, 5000);
  }

  enterCar(car, seat = 'driver') {
    this.car = car; this.seat = seat;
    this.col.setEnabled(false);
    this.vel.set(0, 0, 0);
    car.seatPerson(this.human, seat);
    car.driver = this;
  }

  exitCar() {
    const car = this.car; if (!car) return;
    const out = car.doorPoint('driver', 1.1);
    this.car = null;
    car.unseat(this.human); car.driver = null;
    this.g.scene.add(this.human.root);
    this.body.setTranslation({ x: out.x, y: out.y + CENTRE + 0.2, z: out.z }, true);
    this.body.setNextKinematicTranslation({ x: out.x, y: out.y + CENTRE + 0.2, z: out.z });
    this.col.setEnabled(true);
    this.yaw = car.yaw + Math.PI / 2;
    this.vy = 0;
  }
}
