// Saving: what you've got and how far you are, kept in the browser (localStorage). It saves itself every so
// often (and when you close the tab), but only at a steady point in the story: driving Wren to the hospital, on
// the way to the van, the first cook, or any time after he's moved in. Continue on the title picks it up.
import * as THREE from 'three';
import { Car } from './car.js';

const KEY = 'phy2ick.save.v1';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const arr = (v) => v ? [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)] : null;
const vec = (a) => a ? V(a[0], a[1], a[2]) : null;
// which phases are a steady place to save, and which checkpoint they go back to
const STEADY = { hospital: 'drive', toVan: 'toVan', firstCook: 'van', giveBags: 'van', free: 'free' };

export class Save {
  constructor(g) { this.g = g; this.t = 30; addEventListener('beforeunload', () => this.save()); }

  static has() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return !!(s && STEADY[s.phase]); } catch { return false; } }
  static wipe() { try { localStorage.removeItem(KEY); } catch { /* (no storage: nothing to wipe) */ } }

  update(dt) {
    this.t -= dt; if (this.t > 0) return; this.t = 45;
    this.save();
  }

  // ---- what's kept
  snapshot() {
    const g = this.g, S = g.story, pl = g.player, W = g.wren, D = g.drugs, Wp = g.weapons;
    const cp = STEADY[S?.phase]; if (!cp || S.cine || S.locked || pl.dead || g.ending || D.cook) return null;
    // where you are (on foot, or beside the car you're in; out of the van if you're inside it)
    let at = pl.car ? pl.car.doorPoint('driver', 1.2) : pl.pos.clone(), yaw = pl.yaw;
    if (g.van?.inside && g.camper) { at = g.camper.trunkPoint(1.6); yaw = g.camper.yaw + Math.PI; }
    const wl = {};
    if (W) for (const k of ['unlocked', 'trust', 'cooks', 'shifted', 'shiftPending', 'stock', 'batchCash', 'batchSold', 'mood', 'recent', 'inbox', 'unread']) wl[k] = W[k];
    if (W) wl.ideas = { done: [...W.ideas.done], price: W.ideas.price };
    const cars = g.cars.filter(c => c.owned && !c.wrecked && c !== g.camper).map(c => ({ name: c.name, color: c.color ?? c.paint?.color?.getHex(), plate: c.plate, pos: arr(c.pos), yaw: c.yaw, opts: { police: c.police, convertible: c.convertible, taxi: c.taxi, box: c.box } }));
    return {
      v: 1, when: Date.now(), phase: S.phase, cp, money: g.money, hp: pl.hp, look: pl.look,
      at: arr(at), yaw,
      story: { checkpoint: S.checkpoint, stairMe: arr(S.stairMe), afterVic: arr(S.afterVic), afterVicYaw: S.afterVicYaw },
      weapons: { inv: [...Wp.inv], ammo: Wp.ammo, clip: Wp.clip, cur: Wp.cur },
      drugs: { solvent: D.solvent, salts: D.salts, bags: D.bags, vanKeys: !!D.vanKeys, big: !!D.big },
      wren: wl,
      tenants: (g.tenants?.list || []).map(n => ({ id: n.tenant.id, mood: n.mood, met: n.mem.met, talks: n.mem.talks })),
      camper: g.camper && !g.camper.wrecked ? { pos: arr(g.camper.pos), yaw: g.camper.yaw, kitchen: !!g.camper.kitchen, plate: g.camper.plate, owned: !!g.camper.owned } : null,
      cars, loot: g.shopping?.loot || [], missions: g.missions?.state(), inv: g.inv?.state(),
    };
  }
  save() {
    const s = this.snapshot(); if (!s) return false;
    try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
  }

  // ---- back to where you were
  load() {
    let s; try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
    if (!s || !STEADY[s.phase]) return false;
    const g = this.g, S = g.story, A = g.apt, pl = g.player, D = g.drugs, Wp = g.weapons;
    const quiet = g.hud.toast; g.hud.toast = () => {}; // (no announcements for things that already happened)
    try {
      g.money = s.money ?? g.money;
      // you
      if (s.look) pl.look = { ...pl.look, ...s.look };
      pl.dress('dressed'); pl.human.setMood('neutral'); pl.shiverT = 0;
      A.clothesMesh.visible = false; A.mess.visible = true;
      g.hud.helpEl?.classList.add('hide');
      // your things
      Wp.inv = new Set(s.weapons?.inv || ['fists']); Object.assign(Wp.ammo, s.weapons?.ammo || {}); Object.assign(Wp.clip, s.weapons?.clip || {});
      for (const sl of Wp.slots) sl.taken = Wp.inv.has(sl.id);
      g.inv?.restore(s.inv);
      Object.assign(D, { solvent: s.drugs?.solvent || 0, salts: s.drugs?.salts || 0, bags: s.drugs?.bags || [], vanKeys: !!s.drugs?.vanKeys, big: !!s.drugs?.big });
      if (g.shopping) g.shopping.loot = s.loot || [];
      // the van
      const C = g.camper;
      if (C && s.camper) {
        const p = vec(s.camper.pos), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s.camper.yaw, 0));
        C.body.setTranslation({ x: p.x, y: p.y + 0.1, z: p.z }, true); C.body.setRotation(q, true); C.body.setLinvel({ x: 0, y: 0, z: 0 }, true); C.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        C.group.position.set(p.x, p.y + 0.1, p.z); C.group.quaternion.copy(q); C.group.updateMatrixWorld(true);
        if (s.camper.plate) C.setPlate?.(s.camper.plate); C.owned = s.camper.owned;
        if (s.camper.kitchen) g.wren?.paintVan();
      }
      if (C) C.locked = !D.vanKeys;
      // cars you've registered
      for (const c of s.cars || []) {
        const p = vec(c.pos); if (!p) continue;
        const car = new Car(g, V(p.x, 0.75, p.z), c.yaw, c.color, c.name, c.opts || {});
        car.owned = true; car.locked = false; if (c.plate) car.setPlate?.(c.plate); g.cars.push(car);
      }
      // the neighbours
      for (const t of s.tenants || []) { const n = g.tenants?.list.find(n => n.tenant.id === t.id); if (n) { n.mood = t.mood; n.mem.met = t.met; n.mem.talks = t.talks || 0; } }
      // the story
      S.checkpoint = s.story?.checkpoint; S.stairMe = vec(s.story?.stairMe); S.afterVic = vec(s.story?.afterVic); S.afterVicYaw = s.story?.afterVicYaw;
      if (s.cp === 'free') { this.loadFree(s); g.missions?.restore(s.missions); }
      else S.resume(s.cp);
      pl.hp = Math.max(30, s.hp ?? 100);
      Wp.equip('fists', true);
    } finally { g.hud.toast = quiet; }
    g.hud.toast('Welcome back.', '#ffd23f');
    return true;
  }

  loadFree(s) {
    const g = this.g, S = g.story, pl = g.player, W = g.wren;
    S.phase = 'free'; S.locked = false; S.cine = false; document.body.classList.remove('cine');
    for (const n of g.citizens.list.filter(n => n.name === 'Wren' && n.storyNpc)) g.citizens.remove(n); // (never two of him)
    S.spawnWren(); S.wren.script = null; S.wrenHome(true);
    const w = s.wren || {};
    W.unlock();
    for (const k of Object.keys(w)) if (k !== 'ideas') W[k] = w[k];
    if (w.ideas) { W.ideas.done = new Set(w.ideas.done || []); W.ideas.price = !!w.ideas.price; if (W.ideas.done.has('site')) W.siteBuyer(); }
    W.where = 'home';
    g.parkVanAtWren?.(); // (Kit's van: always back on Wren's drive)
    const at = vec(s.at) || g.apt.spawn;
    pl.respawn(at, s.yaw ?? 0); g.cam.pitch = 0.15;
  }
}
