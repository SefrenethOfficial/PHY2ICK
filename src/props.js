// Loose things: real physics bodies you can pick up (left click), carry, drop (left click) or throw (right click).
import * as THREE from 'three';
import { G_WORLD, G_CAR, G_PROP, G_RAG, G_HELD, groups } from './world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Props {
  constructor(g) {
    this.g = g;
    this.list = [];
    this.byCollider = new Map();
    this.held = null;
  }

  add(mesh, desc, pos, name, ry = 0) {
    const { world, R, scene } = this.g;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setLinearDamping(0.15).setAngularDamping(0.3).setCcdEnabled(true));
    const col = world.createCollider(desc.setFriction(0.7).setCollisionGroups(groups(G_PROP, 0xffff)), body);
    mesh.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    mesh.userData.dynamic = true; scene.add(mesh);
    const bb = new THREE.Box3().setFromObject(mesh), sz = bb.getSize(new THREE.Vector3());
    const p = { mesh, body, col, name, size: sz };
    this.list.push(p); this.byCollider.set(col.handle, p);
    this.sync(p);
    return p;
  }

  sync(p) { const t = p.body.translation(), r = p.body.rotation(); p.mesh.position.set(t.x, t.y, t.z); p.mesh.quaternion.set(r.x, r.y, r.z, r.w); }

  // what you're looking at, within reach
  aimed() {
    const g = this.g, cam = g.camera, pl = g.player;
    if (pl.car || pl.ragdoll) return null;
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const from = cam.position.clone();
    const ray = new g.R.Ray(from, dir);
    const hit = g.world.castRay(ray, 9, true, undefined, undefined, undefined, undefined, (c) => c.handle !== pl.col.handle);
    let p = hit && this.byCollider.get(hit.collider.handle);
    if (p) { const at = from.clone().addScaledVector(dir, hit.timeOfImpact); if (at.distanceTo(pl.pos.add(V(0, 1, 0))) > 2.4) p = null; }
    if (!p) { // (or the nearest thing right in front of you, low down)
      const f = g.cam.forward, base = pl.pos;
      let best = null, bd = 1.6;
      for (const q of this.list) {
        const t = q.body.translation(), d = Math.hypot(t.x - base.x, t.z - base.z);
        if (d < bd && Math.abs(t.y - base.y - 0.6) < 1.2 && ((t.x - base.x) * f.x + (t.z - base.z) * f.z) / Math.max(d, 0.01) > 0.5) { bd = d; best = q; }
      }
      p = best;
    }
    return p;
  }

  grab(p) {
    this.held = p;
    p.col.setCollisionGroups(groups(G_HELD, G_WORLD | G_CAR | G_PROP | G_RAG)); // (you don't trip over what you're carrying)
    p.body.setGravityScale(0, true);
    this.g.hud.toast('Picked up ' + p.name);
  }
  drop(throwIt = false) {
    const p = this.held; if (!p) return;
    this.held = null;
    p.col.setCollisionGroups(groups(G_PROP, 0xffff));
    p.body.setGravityScale(1, true);
    if (throwIt) {
      const dir = new THREE.Vector3(); this.g.camera.getWorldDirection(dir); dir.y += 0.15; dir.normalize();
      const m = p.body.mass(), speed = THREE.MathUtils.clamp(14 / Math.sqrt(Math.max(m, 0.2)), 4, 16);
      p.body.setLinvel({ x: dir.x * speed, y: dir.y * speed, z: dir.z * speed }, true);
      p.body.setAngvel({ x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 8, z: (Math.random() - 0.5) * 8 }, true);
      p.thrownT = 1.5;
    }
  }

  click() { if (this.held) this.drop(false); else { const p = this.aimed(); if (p) this.grab(p); } }

  physics(h) {
    const p = this.held; if (!p) return;
    const g = this.g, pl = g.player;
    if (pl.car || pl.ragdoll) { this.drop(false); return; }
    // carry it in front of you, a little to the right
    const dir = new THREE.Vector3(); g.camera.getWorldDirection(dir);
    const flat = V(dir.x, 0, dir.z).normalize();
    const r = Math.min(0.35, Math.max(p.size.x, p.size.z) / 2), small = this.small = Math.max(p.size.x, p.size.y, p.size.z) < 0.3;
    const sc = pl.human.rig.scale.y, right = V(-flat.z, 0, flat.x);
    const target = small // (small things in the right hand; big ones against the chest, between both hands)
      ? pl.pos.add(V(0, 1.13 * sc, 0)).addScaledVector(flat, 0.48 * sc).addScaledVector(right, 0.18 * sc)
      : pl.pos.add(V(0, 1.12 * sc + THREE.MathUtils.clamp(dir.y, -0.6, 0.6) * 0.12, 0)).addScaledVector(flat, 0.3 + r);
    const t = p.body.translation();
    const dv = target.sub(V(t.x, t.y, t.z));
    if (dv.length() > 2.5) { this.drop(false); return; } // (snagged on something)
    p.body.setLinvel({ x: dv.x * 14, y: dv.y * 14, z: dv.z * 14 }, true);
    const w = p.body.angvel(); p.body.setAngvel({ x: w.x * 0.8, y: w.y * 0.8, z: w.z * 0.8 }, true);
  }

  frame(dt) {
    for (const p of this.list) { this.sync(p); if (p.thrownT) p.thrownT = Math.max(0, p.thrownT - dt); }
  }
}
