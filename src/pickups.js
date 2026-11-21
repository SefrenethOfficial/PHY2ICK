// Things on the ground to pick up by walking over them: cash (a mugging, a dropped wallet) and guns (a cop's).
import * as THREE from 'three';
import { model, WEAPONS } from './weapons.js';

export class Pickups {
  constructor(g) { this.g = g; this.list = []; }

  add(obj, at, take) {
    obj.position.copy(at).setY(Math.max(at.y, 0) + 0.12); obj.userData.dynamic = true;
    obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.g.scene.add(obj);
    this.list.push({ obj, take, t: 0, y: obj.position.y });
  }
  cash(at, amount) {
    const g = new THREE.Group();
    const note = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.08), new THREE.MeshStandardMaterial({ color: 0x4a8a4a, roughness: 0.8 })); g.add(note);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.085), new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.8 })); g.add(band);
    this.add(g, at, () => { this.g.money += amount; this.g.sfx?.cash(at); this.g.hud.toast(`Picked up $${amount}`, '#7be08a'); return true; });
  }
  gun(id, at, rounds) {
    const m = model(id); m.rotation.set(0, 0, Math.PI / 2);
    const holder = new THREE.Group(); holder.add(m);
    this.add(holder, at, () => { const W = this.g.weapons, had = W.inv.has(id); W.give(id, rounds); this.g.hud.toast(had ? `+${rounds} ${WEAPONS[id].name} rounds` : `Picked up a ${WEAPONS[id].name} · right mouse to aim, click to fire`, '#ffd23f'); return true; });
  }

  update(dt) {
    const pl = this.g.player, p = pl.pos;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const k = this.list[i]; k.t += dt;
      k.obj.rotation.y += dt * 1.8; k.obj.position.y = k.y + Math.sin(k.t * 3) * 0.04;
      if (!pl.car && !pl.ragdoll && !pl.dead && Math.hypot(k.obj.position.x - p.x, k.obj.position.z - p.z) < 1.1 && Math.abs(k.obj.position.y - p.y) < 1.5) {
        if (k.take()) { k.obj.removeFromParent(); this.list.splice(i, 1); }
      } else if (k.t > 120) { k.obj.removeFromParent(); this.list.splice(i, 1); }
    }
  }
}
