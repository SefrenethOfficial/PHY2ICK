// Melee weapons and the rack in your apartment: a hatchet, a butter knife and a plastic kiddie knife.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const std = (color, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

export const WEAPONS = {
  hatchet: { name: 'Hatchet', dmg: 60, reach: 1.75, swing: 0.55, force: 3.2, bleed: 40 },
  butter: { name: 'Butter Knife', dmg: 16, reach: 1.35, swing: 0.36, force: 1.2, bleed: 10 },
  kiddie: { name: 'Plastic Kiddie Knife', dmg: 0, reach: 1.3, swing: 0.34, force: 0.3, bleed: 0 },
};

// the models: built along +Y from the grip (the hand holds it at the origin)
function model(id) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; g.add(m); return m; };
  if (id === 'hatchet') {
    const wood = std(0x9a6a3c, 0.7), steel = std(0xaeb3b8, 0.3, { metalness: 0.85 });
    add(new THREE.CylinderGeometry(0.017, 0.021, 0.46, 10), wood, 0, 0.13, 0);
    const head = new THREE.Shape(); head.moveTo(-0.025, 0); head.lineTo(0.03, 0); head.lineTo(0.12, -0.035); head.quadraticCurveTo(0.14, 0.04, 0.12, 0.11); head.lineTo(0.03, 0.07); head.lineTo(-0.025, 0.07); head.closePath();
    const hg = new THREE.ExtrudeGeometry(head, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 1 }); hg.translate(0, 0, -0.009);
    add(hg, steel, 0, 0.3, 0, 0, 0);
  } else if (id === 'butter') {
    const steel = std(0xd6dade, 0.18, { metalness: 0.95 });
    add(new THREE.BoxGeometry(0.018, 0.1, 0.012), steel, 0, 0.0, 0);
    const blade = new THREE.Shape(); blade.moveTo(-0.011, 0); blade.lineTo(0.011, 0); blade.lineTo(0.011, 0.1); blade.quadraticCurveTo(0.011, 0.125, -0.004, 0.128); blade.lineTo(-0.011, 0.11); blade.closePath();
    add(new THREE.ExtrudeGeometry(blade, { depth: 0.003, bevelEnabled: false }), steel, 0, 0.05, -0.0015);
  } else {
    const pink = std(0xff7ab6, 0.45), blue = std(0x5ab8ff, 0.45);
    add(new THREE.CapsuleGeometry(0.014, 0.07, 4, 8), blue, 0, 0.0, 0);
    const blade = new THREE.Shape(); blade.moveTo(-0.012, 0); blade.lineTo(0.012, 0); blade.lineTo(0.012, 0.09); blade.quadraticCurveTo(0.012, 0.12, 0, 0.125); blade.quadraticCurveTo(-0.012, 0.12, -0.012, 0.09); blade.closePath();
    add(new THREE.ExtrudeGeometry(blade, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }), pink, 0, 0.05, -0.003);
  }
  return g;
}

export class Weapons {
  constructor(g) {
    this.g = g;
    this.held = null; this.heldId = null; this.model = null;
    this.slots = []; // the rack's pegs: { id, pos, model }
    this.swingT = -1; this.hitDone = false; this.cool = 0;
  }

  buildRack(at, ry) {
    const g = this.g, wood = std(0x5a3a22, 0.7), brass = std(0xc9a14a, 0.3, { metalness: 0.9 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.05), wood); board.position.copy(at); board.rotation.y = ry; board.castShadow = board.receiveShadow = true; g.scene.add(board);
    const plateT = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = 256; c.height = 40; const x = c.getContext('2d'); x.fillStyle = '#c9a14a'; x.fillRect(0, 0, 256, 40); x.fillStyle = '#3a2a10'; x.font = 'bold 22px Georgia'; x.textAlign = 'center'; x.fillText('FOR EMERGENCIES', 128, 28); return c; })());
    plateT.colorSpace = THREE.SRGBColorSpace;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.09), new THREE.MeshStandardMaterial({ map: plateT, metalness: 0.6, roughness: 0.3 }));
    plate.position.copy(at).add(V(0, -0.36, 0.03)); g.scene.add(plate);
    const ids = ['hatchet', 'butter', 'kiddie'];
    ids.forEach((id, i) => {
      const x = -0.5 + i * 0.5;
      for (const dy of [0.06, -0.12]) { const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 8), brass); peg.rotation.x = Math.PI / 2; peg.position.copy(at).add(V(x, dy, 0.06)); g.scene.add(peg); }
      const m = model(id); m.position.copy(at).add(V(x, id === 'hatchet' ? -0.22 : -0.08, 0.1)); m.rotation.z = 0; g.scene.add(m);
      this.slots.push({ id, pos: m.position.clone(), home: { pos: m.position.clone(), rot: m.rotation.clone() }, model: m, taken: false });
    });
    this.rackPos = at.clone();
  }

  // a weapon on the rack you're close to and facing
  candidate() {
    const g = this.g, pl = g.player;
    if (pl.car || pl.ragdoll || !this.slots.length) return null;
    const p = pl.pos.add(V(0, 1.2, 0)), f = g.cam.forward;
    let best = null, bd = 2.2;
    for (const s of this.slots) {
      const d = s.pos.distanceTo(p);
      const facing = ((s.pos.x - p.x) * f.x + (s.pos.z - p.z) * f.z) / Math.max(Math.hypot(s.pos.x - p.x, s.pos.z - p.z), 0.01);
      if (d < bd && facing > 0.2) { bd = d; best = s; }
    }
    return best;
  }

  take(slot) {
    const g = this.g;
    if (slot.taken) { // (that's the one you're holding: put it back)
      this.putAway(); return;
    }
    if (this.heldId) this.putAway(true);
    if (g.props.held) g.props.drop(false);
    slot.taken = true;
    slot.model.removeFromParent();
    this.held = WEAPONS[slot.id]; this.heldId = slot.id; this.model = slot.model; this.slot = slot;
    // in the right hand: the grip in the palm, the blade forward
    const wr = g.player.human.b.wristR;
    wr.add(this.model);
    this.model.position.set(0, -0.075, 0.02); this.model.rotation.set(Math.PI / 2 + 0.3, 0, 0);
    this.model.scale.setScalar(1 / g.player.human.rig.scale.x);
    g.hud.toast(`Took the ${this.held.name}` + (slot.id === 'kiddie' ? '. It is made of plastic.' : ''), '#ffd23f');
  }

  putAway(quiet = false) {
    const s = this.slot; if (!s) return;
    this.model.removeFromParent(); this.g.scene.add(this.model);
    this.model.position.copy(s.home.pos); this.model.rotation.copy(s.home.rot); this.model.scale.setScalar(1);
    s.taken = false;
    if (!quiet) this.g.hud.toast(`Put the ${this.held.name} back on the rack`);
    this.held = null; this.heldId = null; this.model = null; this.slot = null; this.swingT = -1;
  }

  attack() {
    const g = this.g, pl = g.player;
    if (!this.held || pl.car || pl.ragdoll || this.cool > 0 || g.wheel.open) return;
    this.swingT = 0; this.hitDone = false; this.cool = this.held.swing + 0.08;
  }

  get attackPhase() { return this.swingT >= 0 && this.held ? Math.min(1, this.swingT / this.held.swing) : null; }

  update(dt) {
    this.cool = Math.max(0, this.cool - dt);
    if (this.swingT < 0 || !this.held) return;
    this.swingT += dt;
    const a = this.swingT / this.held.swing;
    if (!this.hitDone && a > 0.5) { this.hitDone = true; this.strike(); }
    if (a >= 1) this.swingT = -1;
  }

  // the moment of impact: who's in front of you, in reach
  strike() {
    const g = this.g, pl = g.player, W = this.held;
    const p = pl.pos, fwd = V(Math.sin(pl.yaw), 0, Math.cos(pl.yaw));
    let hitSomeone = false;
    for (const n of g.citizens.list) {
      if (n.state === 'seated' || n.state === 'dead') continue;
      const q = n.ragdoll ? n.human.ragdoll.pelvis : g.citizens.pos(n);
      const d = V(q.x - p.x, 0, q.z - p.z), dist = d.length();
      if (dist > W.reach + 0.3 || dist < 0.01) continue;
      if (d.dot(fwd) / dist < 0.45) continue;
      g.citizens.struck(n, W, d.normalize());
      hitSomeone = true;
      break;
    }
    if (!hitSomeone) { // swat something loose
      for (const pr of g.props.list) {
        const t = pr.body.translation(), d = V(t.x - p.x, 0, t.z - p.z), dist = d.length();
        if (dist < W.reach + 0.2 && t.y - p.y < 2 && d.dot(fwd) / Math.max(dist, 0.01) > 0.5) {
          const m = pr.body.mass(); pr.body.applyImpulse({ x: fwd.x * W.force * 2 * Math.min(m, 3), y: 1 * Math.min(m, 3), z: fwd.z * W.force * 2 * Math.min(m, 3) }, true);
        }
      }
    }
  }
}
