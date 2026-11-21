// Your hotbar and your bag.
//   The hotbar: six slots along the bottom of the screen (fists always in the first). 1–6 or the mouse wheel
//   picks one, and you can see which. Weapons you get go in the first free slot (or the bag, if it's full).
//   The bag (Tab): twelve slots for whatever else you're carrying: weapons you're not using, and things you've
//   picked up (V puts what you're holding in it: shop things go in your pockets, as before; a traffic cone
//   becomes a weapon). Click a thing, then click where it should go; or hold it, or drop it.
//   Underneath: what's in your pockets (Physick, supplies, sacks, stolen things), which you don't move about.
import * as THREE from 'three';
import { WEAPONS } from './weapons.js';
import { FOOD, foodMesh } from './food.js';
import { lootKind } from './icons.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const el = (id) => document.getElementById(id);

export class Inventory {
  constructor(g) {
    this.g = g;
    this.hot = ['fists', null, null, null, null, null];
    this.bag = new Array(12).fill(null);
    this.sel = 0; this.open = false; this.pick = null; // (pick: { where: 'hot'|'bag', i })
  }
  label(it) { return typeof it === 'string' ? WEAPONS[it].name : it?.prop ? it.prop.name.replace(/^an? /, '') : it?.food ? FOOD[it.food].name : ''; }
  // a picture of it (drawn from its own 3D model)
  icon(it) {
    const I = this.g.icons; if (!it || !I) return '';
    const src = typeof it === 'string' ? I.weapon(it) : it.prop ? I.prop(it.prop) : it.food ? I.food(it.food) : '';
    return src ? `<img src="${src}" alt="">` : '';
  }
  count(it) { return it?.food && it.n > 1 ? `<em>×${it.n}</em>` : ''; }
  // something to eat: onto the stack of the same thing, or the first free hotbar slot, or the bag
  addFood(id) {
    for (const arr of [this.hot, this.bag]) for (const it of arr) if (it?.food === id && it.n < 5) { it.n++; return true; }
    let i = this.free(this.hot, 1); if (i >= 0) { this.hot[i] = { food: id, n: 1 }; return true; }
    i = this.free(this.bag); if (i >= 0) { this.bag[i] = { food: id, n: 1 }; return true; }
    return false;
  }
  anyFood() { const h = this.hot[this.sel]; if (h?.food) return h; for (const arr of [this.hot, this.bag]) for (const it of arr) if (it?.food) return it; return null; }
  useUp(it) { it.n--; if (it.n > 0) return; for (const arr of [this.hot, this.bag]) { const i = arr.indexOf(it); if (i >= 0) arr[i] = null; } }
  get holdingFood() { const h = this.hot[this.sel], pl = this.g.player; return h?.food && !pl.car && !pl.bike && !pl.ragdoll ? h : null; }
  // click with food in your hand: eat it
  eatHeld() {
    const it = this.holdingFood; if (!it || this.eatT > 0) return false;
    this.eatT = 1.1; const id = it.food; this.useUp(it); this.g.food.eat(id);
    if (!this.hot.includes(it)) this.sel = 0;
    return true;
  }
  // share some with Wren
  shareWith() { const it = this.anyFood(); if (!it) return; const id = it.food; this.useUp(it); if (!this.hot.includes(this.hot[this.sel])) this.sel = 0; this.g.food.share(id); }
  // the food in your hand, shown (it goes when you put it away, get in a car, or it's eaten)
  hand(dt) {
    const it = this.holdingFood, H = this.g.player.human;
    this.eatT = Math.max(0, (this.eatT || 0) - dt);
    const want = it ? it.food : null;
    if (this.handId !== want || (this.handM && this.handM.parent !== H.b.wristR)) {
      this.handM?.removeFromParent(); this.handM = null; this.handId = want;
      if (want) { const f = FOOD[want]; this.handM = foodMesh(f.mesh, f.color); this.handM.position.set(0, -0.09, 0.03); this.handM.scale.setScalar(1 / H.rig.scale.x); H.b.wristR.add(this.handM); }
    }
    if (this.handM) { const k = this.eatT > 0 ? 0.35 + 0.65 * Math.abs(Math.cos(this.eatT * 9)) : 1; this.handM.scale.setScalar(k / H.rig.scale.x); }
  }
  has(id) { return this.hot.includes(id) || this.bag.includes(id); }
  free(arr, from = 0) { for (let i = from; i < arr.length; i++) if (!arr[i]) return i; return -1; }

  // keep the slots in step with the weapons you actually own (bought, found, confiscated, put back in the drawer…)
  reconcile() {
    const W = this.g.weapons;
    for (const arr of [this.hot, this.bag]) for (let i = 0; i < arr.length; i++) { const it = arr[i]; if (typeof it === 'string' && it !== 'fists' && !W.inv.has(it)) arr[i] = null; }
    for (const id of W.inv) {
      if (id === 'fists' || this.has(id)) continue;
      let i = this.free(this.hot, 1); if (i >= 0) { this.hot[i] = id; continue; }
      i = this.free(this.bag); if (i >= 0) this.bag[i] = id; else this.bag.push(id);
    }
    // whatever's in your hand has to be on the hotbar
    if (W.cur !== 'fists') {
      const i = this.hot.indexOf(W.cur);
      if (i < 0) { W.equip('fists', true); this.sel = 0; } else this.sel = i;
    } else if ((typeof this.hot[this.sel] === 'string' && this.hot[this.sel] !== 'fists') || !this.hot[this.sel]) this.sel = 0;
  }

  // ---- the hotbar
  select(i) {
    const g = this.g, pl = g.player, it = this.hot[i];
    if (pl.car || pl.bike || !it) return;
    if (typeof it === 'string') { if (g.props.held) g.props.drop(false); g.weapons.equip(it); this.sel = i; }
    else if (it.food) { if (g.props.held) g.props.drop(false); if (g.weapons.cur !== 'fists') g.weapons.equip('fists', true); this.sel = i; g.hud.toast(`${FOOD[it.food].name} · click to eat${g.story?.wren ? ' · hold E on Wren to share' : ''}`); }
    else if (it.prop) { this.hot[i] = null; this.takeOut(it); }
  }
  cycle(dir) {
    const n = this.hot.length; let i = this.sel;
    for (let k = 0; k < n; k++) { i = (i + dir + n) % n; if (typeof this.hot[i] === 'string' || this.hot[i]?.food) { this.select(i); return; } }
  }

  // ---- V: put away what you're holding
  store() {
    const g = this.g, P = g.props, p = P.held; if (!p) return false;
    if (p.shop) return g.shopping.pocket(); // (shop things: your pockets, and the clerk may be watching)
    if (p.cone) { // a cone goes in as a weapon
      P.drop(false); this.remove(p);
      g.weapons.inv.add('cone'); this.reconcile();
      g.hud.toast('Traffic cone: in your ' + (this.hot.includes('cone') ? 'hotbar' : 'bag') + '. Equip it like any weapon.', '#ffd23f');
      return true;
    }
    if (Math.max(p.size.x, p.size.y, p.size.z) > 0.6) { g.hud.toast("That won't fit in your bag."); return true; }
    const i = this.free(this.bag); if (i < 0) { g.hud.toast('Your bag is full'); return true; }
    P.drop(false); p.stored = true; p.body.setEnabled(false); p.mesh.visible = false;
    this.bag[i] = { prop: p };
    g.hud.toast(`Put ${p.name} in your bag (Tab)`, '#ffd23f');
    return true;
  }
  remove(p) { const P = this.g.props; P.list.splice(P.list.indexOf(p), 1); P.byCollider.delete(p.col.handle); this.g.world.removeRigidBody(p.body); p.mesh.removeFromParent(); }
  // out of the bag into your hands (or onto the ground)
  takeOut(it, drop = false) {
    const g = this.g, P = g.props, pl = g.player, p = it.prop;
    if (P.held) P.drop(false);
    const f = g.cam.forward, at = pl.pos.add(V(f.x * 0.8, drop ? 0.4 : 1.1, f.z * 0.8));
    p.body.setEnabled(true); p.body.setTranslation({ x: at.x, y: at.y, z: at.z }, true); p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    p.mesh.visible = true; p.stored = false;
    if (!drop) { if (g.weapons.cur !== 'fists') g.weapons.equip('fists', true); this.sel = 0; P.grab(p); }
  }
  // a weapon on the floor: only the cone (the rest you keep)
  dropWeapon(id) {
    const g = this.g, W = g.weapons; if (id !== 'cone') return;
    if (W.cur === 'cone') W.equip('fists', true);
    W.inv.delete('cone'); this.reconcile();
    const f = g.cam.forward, at = g.player.pos.add(V(f.x * 0.9, 0, f.z * 0.9)); g.props.addCone(at);
  }

  // ---- the bag window (the mouse is free while it's open)
  show() { const pl = this.g.player; if (pl.car || pl.bike || pl.ragdoll) return; this.open = true; this.pick = null; this.render(); el('bag').classList.add('on'); document.exitPointerLock?.(); }
  close() { this.open = false; this.pick = null; el('bag').classList.remove('on'); this.g.renderer.domElement.requestPointerLock?.(); }
  key(code) { if (code === 'Tab' || code === 'Escape' || code === 'KeyI') this.close(); }
  slot(where, i) { return where === 'hot' ? this.hot[i] : this.bag[i]; }
  set(where, i, v) { if (where === 'hot') this.hot[i] = v; else this.bag[i] = v; }
  click(where, i) {
    const it = this.slot(where, i);
    if (!this.pick) { if (it && !(where === 'hot' && i === 0)) this.pick = { where, i }; this.render(); return; }
    const { where: w0, i: i0 } = this.pick; this.pick = null;
    if (where === 'hot' && i === 0) { this.render(); return; } // (fists stay put)
    const a = this.slot(w0, i0); this.set(w0, i0, it); this.set(where, i, a);
    if (where === 'bag' && typeof a === 'string' && this.g.weapons.cur === a) { this.g.weapons.equip('fists', true); this.sel = 0; }
    if (w0 === 'bag' && typeof it === 'string' && this.g.weapons.cur === it) { this.g.weapons.equip('fists', true); this.sel = 0; }
    this.render();
  }
  use() {
    const pk = this.pick; if (!pk) return; const it = this.slot(pk.where, pk.i); this.pick = null;
    if (typeof it === 'string') { // a weapon: onto the hotbar (if it isn't) and into your hand
      let i = this.hot.indexOf(it);
      if (i < 0) { i = this.free(this.hot, 1); if (i < 0) { this.g.hud.toast('Your hotbar is full: move something into the bag first'); this.render(); return; } this.hot[i] = it; this.set(pk.where, pk.i, null); }
      this.select(i); this.close(); return;
    }
    if (it?.prop) { this.set(pk.where, pk.i, null); this.close(); this.takeOut(it); }
    if (it?.food) { let i = this.hot.indexOf(it); if (i < 0) { i = this.free(this.hot, 1); if (i < 0) { this.g.hud.toast('Your hotbar is full'); this.render(); return; } this.hot[i] = it; this.set(pk.where, pk.i, null); } this.close(); this.select(i); }
  }
  eat() { const pk = this.pick; if (!pk) return; const it = this.slot(pk.where, pk.i); this.pick = null; if (it?.food) { const id = it.food; this.useUp(it); this.g.food.eat(id); } this.render(); }
  drop() {
    const pk = this.pick; if (!pk) return; const it = this.slot(pk.where, pk.i); this.pick = null;
    if (typeof it === 'string') { if (it !== 'cone') { this.g.hud.toast('You hang on to that.'); this.render(); return; } this.set(pk.where, pk.i, null); this.dropWeapon(it); }
    else if (it?.prop) { this.set(pk.where, pk.i, null); this.takeOut(it, true); }
    else if (it?.food) { this.set(pk.where, pk.i, null); this.g.hud.toast(`Binned the ${FOOD[it.food].name}`); }
    this.render();
  }
  render() {
    const g = this.g, W = g.weapons, D = g.drugs, pl = g.player, loot = g.shopping?.loot || [];
    const tile = (where, i, it) => { const pk = this.pick && this.pick.where === where && this.pick.i === i, cur = where === 'hot' && i === this.sel;
      const ammo = typeof it === 'string' && WEAPONS[it].gun ? `<i>${W.clip[it]}/${W.ammo[it]}</i>` : '';
      return `<button class="t${pk ? ' pk' : ''}${cur ? ' cur' : ''}${it ? '' : ' empty'}" data-w="${where}" data-i="${i}">${where === 'hot' ? `<u>${i + 1}</u>` : ''}<b>${this.icon(it)}</b><span>${this.label(it)}</span>${ammo}${this.count(it)}</button>`; };
    const I = g.icons, ic = (k) => I ? `<img src="${I.pocket(k)}">` : '';
    const pocket = [D.count && `${ic('physick')}Physick ×${D.count}`, D.solvent && `${ic('solvent')}Solvent ×${D.solvent}`, D.salts && `${ic('salts')}Blue Salts ×${D.salts}`, pl.sacks && `${ic('sack')}Sacks ×${pl.sacks}`, ...loot.map(l => `${ic(lootKind(l.name))}${l.name.replace(/^an? /, '')}${l.paid ? '' : ' <em>(stolen)</em>'}`)].filter(Boolean);
    const pk = this.pick && this.slot(this.pick.where, this.pick.i);
    el('bag').innerHTML = `<h3>BAG</h3>
      <div class="lbl">Hotbar <small>(1–6, mouse wheel)</small></div><div class="row">${this.hot.map((it, i) => tile('hot', i, it)).join('')}</div>
      <div class="lbl">Bag</div><div class="grid">${this.bag.map((it, i) => tile('bag', i, it)).join('')}</div>
      <div class="acts">${pk ? `<button data-a="use">${typeof pk === 'string' ? 'Equip' : 'Hold it'}</button>${pk.food ? '<button data-a="eat">Eat</button>' : ''}<button data-a="drop" ${typeof pk === 'string' && pk !== 'cone' ? 'disabled' : ''}>${pk.food ? 'Bin it' : 'Drop'}</button><span>…or click a slot to move it there</span>` : '<span>Click something to move it, hold it or drop it</span>'}</div>
      <div class="lbl">Pockets</div><div class="pockets">${pocket.length ? pocket.map(p => `<span>${p}</span>`).join('') : '<span class="none">Nothing</span>'}</div>
      <div class="foot"><kbd>V</kbd> put what you're holding in the bag · <kbd>Tab</kbd> close</div>`;
    el('bag').querySelectorAll('button[data-w]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this.click(b.dataset.w, +b.dataset.i); }));
    el('bag').querySelectorAll('button[data-a]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this[b.dataset.a](); }));
  }

  // the hotbar on screen
  update() {
    this.reconcile();
    const g = this.g, pl = g.player, W = g.weapons;
    this.hand(1 / 60);
    const key = this.hot.map(h => typeof h === 'string' ? h : h?.prop ? h.prop.name : h?.food ? h.food + h.n : '').join('|') + this.sel + (pl.car || pl.bike ? 'x' : '') + (W.W.gun ? W.clip[W.cur] + '/' + W.ammo[W.cur] : '');
    if (key === this.lastKey) return; this.lastKey = key;
    const e = el('hotbar'); e.classList.toggle('dim', !!(pl.car || pl.bike));
    e.innerHTML = this.hot.map((it, i) => `<div class="hs${i === this.sel ? ' cur' : ''}${it ? '' : ' empty'}"><u>${i + 1}</u><b>${this.icon(it)}</b>${typeof it === 'string' && WEAPONS[it].gun ? `<i>${W.clip[it]}/${W.ammo[it]}</i>` : ''}${this.count(it)}</div>`).join('');
    const h = this.hot[this.sel]; el('weapon').dataset.food = h?.food ? FOOD[h.food].name : '';
  }

  // saving: where your weapons sit
  state() { const keep = (h) => typeof h === 'string' ? h : h?.food ? { food: h.food, n: h.n } : null; return { hot: this.hot.map(keep), bag: this.bag.map(keep) }; }
  restore(s) { if (!s) return; this.hot = s.hot.map((h, i) => i === 0 ? 'fists' : h); this.bag = s.bag.slice(0, 12); while (this.bag.length < 12) this.bag.push(null); this.reconcile(); }
}
