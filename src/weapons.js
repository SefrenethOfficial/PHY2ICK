// Weapons: your fists, the three on the rack in your apartment (a hatchet, a butter knife, a plastic kiddie
// knife), and guns (a pistol and a pump shotgun, from the Pawn Shop, or dropped by a cop).
// You carry what you've picked up and switch with the number keys or the mouse wheel.
// Right mouse aims (over the shoulder, closer in); left mouse punches, swings or fires.
import * as THREE from 'three';
import { G_WORLD, G_CAR, G_PED, G_RAG, G_PROP, groups } from './world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const std = (color, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

export const WEAPONS = {
  fists: { name: 'Fists', melee: true, dmg: 9, reach: 1.25, swing: 0.34, force: 1.3, bleed: 0, threat: 0 },
  kiddie: { name: 'Plastic Kiddie Knife', melee: true, dmg: 0, reach: 1.3, swing: 0.34, force: 0.3, bleed: 0, threat: 0 },
  butter: { name: 'Butter Knife', melee: true, dmg: 16, reach: 1.35, swing: 0.36, force: 1.2, bleed: 10, threat: 1 },
  hatchet: { name: 'Hatchet', melee: true, dmg: 60, reach: 1.75, swing: 0.55, force: 3.2, bleed: 40, threat: 2 },
  pistol: { name: 'Pistol', gun: true, dmg: 34, range: 90, rate: 0.26, mag: 12, spread: 0.01, reload: 1.3, pellets: 1, threat: 3, price: 250, ammoPrice: 40, ammoPack: 24 },
  shotgun: { name: 'Pump Shotgun', gun: true, dmg: 15, range: 38, rate: 0.95, mag: 6, spread: 0.065, reload: 2.2, pellets: 8, threat: 4, price: 600, ammoPrice: 60, ammoPack: 12 },
};
export const ORDER = ['fists', 'kiddie', 'butter', 'hatchet', 'pistol', 'shotgun'];

// the models: built along +Y from the grip (the hand holds it at the origin)
export function model(id) {
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
  } else if (id === 'kiddie') {
    const pink = std(0xff7ab6, 0.45), blue = std(0x5ab8ff, 0.45);
    add(new THREE.CapsuleGeometry(0.014, 0.07, 4, 8), blue, 0, 0.0, 0);
    const blade = new THREE.Shape(); blade.moveTo(-0.012, 0); blade.lineTo(0.012, 0); blade.lineTo(0.012, 0.09); blade.quadraticCurveTo(0.012, 0.12, 0, 0.125); blade.quadraticCurveTo(-0.012, 0.12, -0.012, 0.09); blade.closePath();
    add(new THREE.ExtrudeGeometry(blade, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }), pink, 0, 0.05, -0.003);
  } else if (id === 'pistol') { // the grip along +Y; the barrel points along +Z
    const black = std(0x1a1b1d, 0.45, { metalness: 0.6 }), grip = std(0x2a2522, 0.8);
    add(new THREE.BoxGeometry(0.03, 0.1, 0.045), grip, 0, 0.0, -0.01, -0.25);
    add(new THREE.BoxGeometry(0.032, 0.04, 0.19), black, 0, 0.065, 0.05);
    add(new THREE.BoxGeometry(0.026, 0.02, 0.05), black, 0, 0.03, 0.02);
    g.userData.muzzle = V(0, 0.065, 0.15);
  } else if (id === 'shotgun') {
    const black = std(0x1c1d1f, 0.4, { metalness: 0.7 }), wood = std(0x6a4426, 0.65);
    add(new THREE.BoxGeometry(0.035, 0.09, 0.05), wood, 0, -0.02, -0.02, -0.3); // (pistol grip)
    add(new THREE.BoxGeometry(0.04, 0.07, 0.32), wood, 0, 0.0, -0.24); // stock
    add(new THREE.BoxGeometry(0.045, 0.06, 0.22), black, 0, 0.04, 0.08); // receiver
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 8), black, 0, 0.055, 0.48, Math.PI / 2); // barrel
    add(new THREE.CylinderGeometry(0.011, 0.011, 0.45, 8), black, 0, 0.03, 0.42, Math.PI / 2); // magazine tube
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 10), wood, 0, 0.03, 0.42, Math.PI / 2); // the pump
    g.userData.muzzle = V(0, 0.055, 0.78);
  }
  return g;
}

export class Weapons {
  constructor(g) {
    this.g = g;
    this.inv = new Set(['fists']); this.ammo = { pistol: 0, shotgun: 0 }; this.clip = { pistol: 0, shotgun: 0 };
    this.cur = 'fists'; this.models = {};
    this.slots = []; // the rack's pegs: { id, pos, model }
    this.swingT = -1; this.hitDone = false; this.cool = 0; this.combo = 0; this.comboT = 0;
    this.aiming = false; this.reloadT = 0; this.guardT = 0;
  }
  get held() { return this.cur === 'fists' ? null : WEAPONS[this.cur]; }
  get heldId() { return this.cur === 'fists' ? null : this.cur; }
  get W() { return WEAPONS[this.cur]; }

  buildRack(at, ry) {
    const g = this.g, wood = std(0x5a3a22, 0.7), brass = std(0xc9a14a, 0.3, { metalness: 0.9 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.05), wood); board.position.copy(at); board.rotation.y = ry; board.castShadow = board.receiveShadow = true; g.scene.add(board);
    const plateT = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = 256; c.height = 40; const x = c.getContext('2d'); x.fillStyle = '#c9a14a'; x.fillRect(0, 0, 256, 40); x.fillStyle = '#3a2a10'; x.font = 'bold 22px Georgia'; x.textAlign = 'center'; x.fillText('IN CASE OF EMERGENCY', 128, 27); return c; })());
    plateT.colorSpace = THREE.SRGBColorSpace;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.09), new THREE.MeshStandardMaterial({ map: plateT, metalness: 0.6, roughness: 0.3 }));
    plate.position.copy(at).add(V(0, -0.36, 0.03)); g.scene.add(plate);
    ['hatchet', 'butter', 'kiddie'].forEach((id, i) => {
      const x = -0.5 + i * 0.5;
      for (const dy of [0.06, -0.12]) { const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 8), brass); peg.rotation.x = Math.PI / 2; peg.position.copy(at).add(V(x, dy, 0.06)); g.scene.add(peg); }
      const m = model(id); m.position.copy(at).add(V(x, id === 'hatchet' ? -0.22 : -0.08, 0.1)); g.scene.add(m);
      this.slots.push({ id, pos: m.position.clone(), home: { pos: m.position.clone(), rot: m.rotation.clone() }, model: m, taken: false });
      this.models[id] = m;
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

  // the rack: take one (it's yours now, and in your hand), or hang it back up
  take(slot) {
    const g = this.g;
    if (slot.taken) {
      if (this.cur === slot.id) this.equip('fists', true);
      slot.taken = false; this.inv.delete(slot.id);
      const m = slot.model; m.removeFromParent(); g.scene.add(m); m.position.copy(slot.home.pos); m.rotation.copy(slot.home.rot); m.scale.setScalar(1); m.visible = true;
      g.hud.toast(`Put the ${WEAPONS[slot.id].name} back on the rack`);
      return;
    }
    if (g.props.held) g.props.drop(false);
    slot.taken = true; this.inv.add(slot.id);
    this.equip(slot.id, true);
    g.hud.toast(`Took the ${WEAPONS[slot.id].name}` + (slot.id === 'kiddie' ? '. It is made of plastic.' : '') + ' · switch with 1–6 or the mouse wheel', '#ffd23f');
  }

  // into your hand (whatever was there goes away)
  equip(id, quiet = false) {
    const g = this.g, pl = g.player;
    if (!this.inv.has(id) || pl.car) return;
    const old = this.models[this.cur]; if (old && this.cur !== 'fists') { old.removeFromParent(); old.visible = false; }
    this.cur = id; this.swingT = -1; this.reloadT = 0;
    if (id !== 'fists') {
      const m = this.models[id] || (this.models[id] = model(id));
      this.mount(pl.human, m, id); m.visible = true;
      if (WEAPONS[id].gun && this.clip[id] === 0 && this.ammo[id] > 0) this.reload();
    }
    if (!quiet) g.hud.toast(WEAPONS[id].name + (WEAPONS[id].gun ? ` · ${this.clip[id]} / ${this.ammo[id]}` : ''));
  }
  mount(human, m, id) {
    human.b.wristR.add(m);
    if (WEAPONS[id].gun) { m.position.set(0, -0.065, 0.0); m.rotation.set(Math.PI / 2, 0, 0); } // (the grip in the palm, the barrel on along the arm: level when the arm's held out)
    else { m.position.set(0, -0.075, 0.02); m.rotation.set(Math.PI / 2 + 0.3, 0, 0); }
    m.scale.setScalar(1 / human.rig.scale.x);
  }
  // a gun in someone else's hand (cops)
  giveModel(human, id) { const m = model(id); this.mount(human, m, id); return m; }

  cycle(dir) {
    const owned = ORDER.filter(id => this.inv.has(id));
    const i = owned.indexOf(this.cur);
    this.equip(owned[(i + dir + owned.length) % owned.length]);
  }
  select(k) { const id = ORDER[k]; if (id && this.inv.has(id)) this.equip(id); }

  // picking up a gun (or more bullets for it)
  give(id, rounds = 0) {
    const fresh = !this.inv.has(id);
    this.inv.add(id); if (WEAPONS[id].gun) this.ammo[id] += rounds;
    if (fresh) this.equip(id, true);
    else if (this.cur === id && this.clip[id] === 0) this.reload();
  }
  // busted: they keep the guns
  confiscate() {
    for (const id of ['pistol', 'shotgun']) { if (!this.inv.has(id)) continue; if (this.cur === id) this.equip('fists', true); this.inv.delete(id); this.ammo[id] = 0; this.clip[id] = 0; }
  }
  putAway() { if (this.cur !== 'fists') { this.equip('fists', true); this.g.hud.toast('Fists'); } }

  reload() {
    const W = this.W; if (!W.gun || this.reloadT > 0) return;
    const need = W.mag - this.clip[this.cur]; if (need <= 0 || this.ammo[this.cur] <= 0) return;
    this.reloadT = W.reload; this.g.sfx?.reload(this.g.player.pos);
  }

  attack() {
    const g = this.g, pl = g.player;
    if (pl.car || pl.ragdoll || pl.dead || this.cool > 0 || g.wheel.open || pl.hostage || pl.surrender) return;
    const W = this.W;
    if (W.gun) return this.fire();
    this.swingT = 0; this.hitDone = false; this.cool = W.swing + 0.06;
    if (this.cur === 'fists') { this.combo = this.comboT > 0 ? (this.combo + 1) % 3 : 0; this.comboT = 0.9; this.guardT = 2.5; }
    g.sfx?.whoosh(pl.pos);
  }

  get attackPhase() { return this.swingT >= 0 && this.cur !== 'fists' && !this.W.gun ? Math.min(1, this.swingT / this.W.swing) : null; }
  get punchPhase() { return this.swingT >= 0 && this.cur === 'fists' ? Math.min(1, this.swingT / this.W.swing) : null; }

  update(dt) {
    const g = this.g, pl = g.player;
    this.cool = Math.max(0, this.cool - dt); this.comboT -= dt; this.guardT -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { const id = this.cur, take = Math.min(WEAPONS[id].mag - this.clip[id], this.ammo[id]); this.clip[id] += take; this.ammo[id] -= take; }
    }
    // aiming (right mouse held): your gun or blade pointed where you look
    this.aiming = !!(g.mouseR && !pl.car && !pl.ragdoll && !pl.dead && !g.props.held && !pl.hostage && !pl.surrender);
    if (this.swingT >= 0) {
      this.swingT += dt;
      const a = this.swingT / this.W.swing;
      if (!this.hitDone && a > (this.cur === 'fists' ? 0.42 : 0.5)) { this.hitDone = true; this.strike(); }
      if (a >= 1) this.swingT = -1;
    }
    this.recoil = Math.max(0, (this.recoil || 0) - dt * 6);
  }

  // where the crosshair is pointing: a ray from the camera
  aimRay() {
    const cam = this.g.camera, d = V(0, 0, -1).applyQuaternion(cam.quaternion);
    return { o: cam.position.clone(), d };
  }
  // what a ray hits, and whose it is
  cast(o, d, range, exclude) {
    const g = this.g;
    const hit = g.world.castRayAndGetNormal(new g.R.Ray(o, d), range, true, undefined, groups(0xffff, G_WORLD | G_CAR | G_PED | G_RAG | G_PROP), undefined, undefined, (c) => !exclude.includes(c.handle));
    if (!hit) return null;
    const at = o.clone().addScaledVector(d, hit.timeOfImpact), h = hit.collider.handle;
    return { at, normal: V(hit.normal.x, hit.normal.y, hit.normal.z), handle: h, who: g.ownerOf(h) };
  }

  fire() {
    const g = this.g, pl = g.player, id = this.cur, W = this.W;
    if (this.reloadT > 0) return;
    if (this.clip[id] <= 0) { if (this.ammo[id] > 0) this.reload(); else { g.sfx?.click(pl.pos); g.hud.toast('Out of ammo'); this.cool = 0.3; } return; }
    this.clip[id]--; this.cool = W.rate; this.recoil = 1;
    const m = this.models[id]; m.updateMatrixWorld(true);
    const muzzle = (m.userData.muzzle || V()).clone().applyMatrix4(m.matrixWorld);
    // aim from the camera (what's under the crosshair), then shoot from the muzzle at that
    const { o, d } = this.aimRay();
    const ex = [pl.col.handle];
    const first = this.cast(o.clone().addScaledVector(d, 1.0), d, W.range, ex);
    const target = first ? first.at : o.clone().addScaledVector(d, W.range);
    const shotDir = target.clone().sub(muzzle).normalize();
    g.fx.muzzle(muzzle, shotDir); g.sfx.shot(muzzle, id === 'shotgun');
    const spread = W.spread * (this.aiming ? 1 : 2.2) * (pl.speed > 2 ? 1.6 : 1);
    for (let k = 0; k < W.pellets; k++) {
      const dir = shotDir.clone().add(V((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).multiplyScalar(spread)).normalize();
      const hit = this.cast(muzzle, dir, W.range, ex);
      const end = hit ? hit.at : muzzle.clone().addScaledVector(dir, W.range);
      if (k < 3) g.fx.tracer(muzzle, end);
      if (hit) this.impact(hit, dir, W);
    }
    g.police?.crime('gunfire', pl.pos);
    g.citizens.panic(pl.pos, null, 40);
    if (this.clip[id] === 0 && this.ammo[id] > 0) setTimeout(() => this.reload(), 250);
  }

  // a bullet arriving
  impact(hit, dir, W) {
    const g = this.g, who = hit.who;
    if (who?.npc) {
      const n = who.npc, feet = g.citizens.pos(n), sc = n.human.rig.scale.y;
      const head = !n.human.ragdoll && hit.at.y - feet.y > 1.42 * sc;
      g.citizens.shot(n, W.dmg * (head ? 3 : 1), dir, hit.at, head);
    } else if (who?.car) { who.car.damage(W.dmg * 0.9, hit.at, 'shot'); g.fx.sparks(hit.at, hit.normal, 8, 3); if (who.car.crew) for (const n of who.car.crew) if (n.state === 'seated' && n.car === who.car && Math.random() < 0.12) g.citizens.shot(n, W.dmg, dir, hit.at, false); }
    else if (who?.prop) { const b = who.prop.body; b.applyImpulseAtPoint({ x: dir.x * 1.5, y: dir.y * 1.5 + 0.3, z: dir.z * 1.5 }, hit.at, true); }
    else { g.fx.sparks(hit.at, hit.normal, 5, 2); g.fx.dust(hit.at, 4); }
  }

  // the moment a punch or swing lands: who's in front of you, in reach
  strike() {
    const g = this.g, pl = g.player, W = this.W;
    const p = pl.pos, fwd = V(Math.sin(pl.yaw), 0, Math.cos(pl.yaw));
    let hitSomeone = false;
    for (const n of g.citizens.list) {
      if (n.state === 'seated' || n.state === 'dead' || n.hostage) continue;
      const q = n.human.ragdoll ? n.human.ragdoll.pelvis : g.citizens.pos(n);
      const d = V(q.x - p.x, 0, q.z - p.z), dist = d.length();
      if (dist > W.reach + 0.3 || dist < 0.01) continue;
      if (d.dot(fwd) / dist < 0.45) continue;
      if (this.cur === 'fists') { g.citizens.punched(n, W.dmg * (this.combo === 2 ? 1.6 : 1), d.normalize(), this.combo === 2); g.sfx?.punch(q); }
      else g.citizens.struck(n, W, d.normalize());
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
      // a punch on a car
      if (this.cur === 'fists') for (const c of g.cars) { if (!c.inactive && c.pos.distanceTo(p.clone().addScaledVector(fwd, 1)) < 2.4) { g.sfx?.punch(p); c.damage(2); break; } }
    }
  }
}
