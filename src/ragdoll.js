// Ragdolls: when someone's knocked flat (or killed), their skeleton hands over to physics.
// Eleven bodies (pelvis, torso, head, upper/lower arms, thighs, shins) joined at the bones'
// own joints; knees and elbows only bend the way they should. Each frame the bodies pose the bones.
import * as THREE from 'three';
import { G_WORLD, G_CAR, G_PROP, G_RAG, groups } from './world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// bone → [shape, size…, centre offset in the bone's frame], and the parent part it hangs from
const PARTS = [
  { bone: 'hips', shape: 'box', size: [0.15, 0.1, 0.1], off: [0, -0.02, 0] },
  { bone: 'spine', parent: 'hips', shape: 'capsule', size: [0.14, 0.13], off: [0, 0.25, 0] },
  { bone: 'head', parent: 'spine', shape: 'ball', size: [0.12], off: [0, 0.1, 0] },
  { bone: 'shoulderL', parent: 'spine', shape: 'capsule', size: [0.1, 0.05], off: [0, -0.14, 0] },
  { bone: 'shoulderR', parent: 'spine', shape: 'capsule', size: [0.1, 0.05], off: [0, -0.14, 0] },
  { bone: 'elbowL', parent: 'shoulderL', shape: 'capsule', size: [0.12, 0.045], off: [0, -0.17, 0], hinge: [-2.5, 0] },
  { bone: 'elbowR', parent: 'shoulderR', shape: 'capsule', size: [0.12, 0.045], off: [0, -0.17, 0], hinge: [-2.5, 0] },
  { bone: 'hipL', parent: 'hips', shape: 'capsule', size: [0.15, 0.08], off: [0, -0.22, 0] },
  { bone: 'hipR', parent: 'hips', shape: 'capsule', size: [0.15, 0.08], off: [0, -0.22, 0] },
  { bone: 'kneeL', parent: 'hipL', shape: 'capsule', size: [0.16, 0.06], off: [0, -0.24, 0], hinge: [0, 2.5] },
  { bone: 'kneeR', parent: 'hipR', shape: 'capsule', size: [0.16, 0.06], off: [0, -0.24, 0], hinge: [0, 2.5] },
];

export class Ragdoll {
  constructor(g, human, vel = V(), spin = 3) {
    this.g = g; this.h = human;
    const { world, R } = g;
    const B = human.b;
    human.root.updateMatrixWorld(true);
    const s = human.rig.scale.x;
    this.parts = {};
    const pos = V(), quat = new THREE.Quaternion(), scl = V();
    for (const P of PARTS) {
      const bone = B[P.bone];
      bone.matrixWorld.decompose(pos, quat, scl);
      const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
        .setLinearDamping(0.25).setAngularDamping(1.6).setCcdEnabled(true));
      const [ox, oy, oz] = P.off.map(v => v * s);
      let desc;
      if (P.shape === 'box') desc = R.ColliderDesc.cuboid(P.size[0] * s, P.size[1] * s, P.size[2] * s);
      else if (P.shape === 'ball') desc = R.ColliderDesc.ball(P.size[0] * s);
      else desc = R.ColliderDesc.capsule(P.size[0] * s, P.size[1] * s);
      desc.setTranslation(ox, oy, oz).setDensity(1000).setFriction(0.9).setRestitution(0.05)
        .setCollisionGroups(groups(G_RAG, G_WORLD | G_CAR | G_PROP)).setSolverGroups(groups(G_RAG, G_WORLD | G_CAR | G_PROP));
      world.createCollider(desc, body);
      body.setLinvel({ x: vel.x, y: vel.y, z: vel.z }, true);
      body.setAngvel({ x: (Math.random() - 0.5) * spin, y: (Math.random() - 0.5) * spin, z: (Math.random() - 0.5) * spin }, true);
      this.parts[P.bone] = { body, P };
    }
    // joints at each child bone's origin
    this.joints = [];
    for (const P of PARTS) {
      if (!P.parent) continue;
      const child = this.parts[P.bone].body, parent = this.parts[P.parent].body;
      const at = V(); B[P.bone].getWorldPosition(at);
      const pt = parent.translation(), pr = parent.rotation();
      const a1 = at.clone().sub(V(pt.x, pt.y, pt.z)).applyQuaternion(new THREE.Quaternion(pr.x, pr.y, pr.z, pr.w).invert());
      let data;
      if (P.hinge) {
        data = R.JointData.revolute({ x: a1.x, y: a1.y, z: a1.z }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
        data.limitsEnabled = true; data.limits = P.hinge;
      } else data = R.JointData.spherical({ x: a1.x, y: a1.y, z: a1.z }, { x: 0, y: 0, z: 0 });
      const j = world.createImpulseJoint(data, parent, child, true);
      j.setContactsEnabled?.(false);
      if (P.hinge && j.setLimits) j.setLimits(P.hinge[0], P.hinge[1]);
      this.joints.push(j);
    }
    this.t = 0;
  }

  get pelvis() { const t = this.parts.hips.body.translation(); return V(t.x, t.y, t.z); }
  get speed() { const v = this.parts.hips.body.linvel(); return Math.hypot(v.x, v.y, v.z); }
  get faceUp() { const r = this.parts.spine.body.rotation(); return V(0, 0, 1).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).y > 0; }

  push(v) { for (const k in this.parts) { const b = this.parts[k].body; const l = b.linvel(); b.setLinvel({ x: l.x + v.x, y: l.y + v.y, z: l.z + v.z }, true); } }

  // pose the bones from the bodies (parents first)
  frame(dt) {
    this.t += dt;
    const B = this.h.b, s = this.h.rig.scale.x;
    const M = new THREE.Matrix4(), inv = new THREE.Matrix4(), pos = V(), q = new THREE.Quaternion(), sc = V(s, s, s);
    for (const P of PARTS) {
      const bone = B[P.bone], b = this.parts[P.bone].body;
      const t = b.translation(), r = b.rotation();
      M.compose(pos.set(t.x, t.y, t.z), q.set(r.x, r.y, r.z, r.w), sc);
      bone.parent.updateWorldMatrix(true, false);
      inv.copy(bone.parent.matrixWorld).invert();
      M.premultiply(inv);
      M.decompose(bone.position, bone.quaternion, bone.scale);
      bone.updateMatrixWorld(true);
    }
  }

  dispose() {
    const w = this.g.world;
    for (const j of this.joints) w.removeImpulseJoint(j, true);
    for (const k in this.parts) w.removeRigidBody(this.parts[k].body);
    this.parts = {}; this.joints = [];
  }
}
