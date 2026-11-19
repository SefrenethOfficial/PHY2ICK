// You: a kinematic capsule moved by Rapier's character controller, wearing a Human.
import * as THREE from 'three';
import { Human } from './character.js';
import { G_WORLD, G_PED, groups } from './world.js';

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

  get pos() { const t = this.body.translation(); return new THREE.Vector3(t.x, t.y - CENTRE, t.z); }
  get headPos() { return this.pos.add(new THREE.Vector3(0, 1.62, 0)); }

  physics(h) {
    if (this.car) return;
    const g = this.g, k = g.keys;
    const want = new THREE.Vector3();
    const busy = this.downT > 0 || g.wheel.open;
    if (!busy) {
      if (k.has('KeyW')) want.z -= 1; if (k.has('KeyS')) want.z += 1;
      if (k.has('KeyA')) want.x -= 1; if (k.has('KeyD')) want.x += 1;
    }
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    if (want.lengthSq() > 0) want.normalize().multiplyScalar(run ? 6.2 : 1.9).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.cam.yaw);
    // ease toward the wanted velocity (a little weight to it)
    const acc = this.grounded ? (want.lengthSq() > 0 ? 9 : 12) : 2;
    this.vel.x += (want.x - this.vel.x) * Math.min(1, acc * h);
    this.vel.z += (want.z - this.vel.z) * Math.min(1, acc * h);
    if (this.grounded && !busy && this.jumpQ) { this.vy = 5.2; this.grounded = false; }
    this.jumpQ = false;
    this.vy -= 18 * h;
    if (this.knock) { this.vel.add(this.knock); this.knock = null; }
    const desired = { x: this.vel.x * h, y: this.vy * h, z: this.vel.z * h };
    this.cc.computeColliderMovement(this.col, desired);
    const m = this.cc.computedMovement();
    this.grounded = this.cc.computedGrounded();
    if (this.grounded && this.vy < 0) this.vy = -1;
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    this.speed = Math.hypot(m.x, m.z) / h;
    if (t.y < -20) this.body.setNextKinematicTranslation({ x: 0, y: 2, z: 8 }); // (fell out of the world)
  }

  frame(dt) {
    const H = this.human;
    if (this.car) {
      H.update(dt, { pose: 'drive', steer: this.car.steer / this.car.maxSteer });
      return;
    }
    this.downT = Math.max(0, this.downT - dt);
    const p = this.pos;
    H.root.position.copy(p);
    // face where you're going (or where you're talking)
    let face = null;
    if (this.speed > 0.4 && this.downT <= 0) face = Math.atan2(this.vel.x, this.vel.z);
    if (this.g.wheel.open && this.g.wheel.target) { const q = this.g.citizens.pos(this.g.wheel.target); face = Math.atan2(q.x - p.x, q.z - p.z); }
    if (face !== null) {
      let d = face - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 10);
    }
    H.root.rotation.y = this.yaw;
    H.update(dt, { speed: this.downT > 0 ? 0 : this.speed, grounded: this.grounded, vy: this.vy, pose: this.downT > 0 ? 'down' : 'stand', talking: this.talkT > 0 });
    this.talkT = Math.max(0, (this.talkT || 0) - dt);
  }

  // hit by a car (or shoved)
  knockDown(dir, force) {
    if (this.car || this.downT > 0) return;
    this.downT = 2.2;
    this.knock = dir.clone().setY(0).normalize().multiplyScalar(Math.min(force, 9));
    this.vy = Math.min(6, force * 0.4);
    this.hp = Math.max(1, this.hp - force * 3);
    this.g.hud.toast(force > 6 ? 'You got hit by a car!' : 'You got knocked down');
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
