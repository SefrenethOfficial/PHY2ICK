// Food: everything you buy to eat (MARCOS, the Diner, the Coffee Store, City Wok, Shitty Wok, Albuquerque Boiled
// Turkey, the nightclub bar, the snacks at the shop tills) comes in a bag or a box or a cup and goes on your
// hotbar (or in your bag). Pick it on the hotbar and it's in your hand: click to eat it (health back). Or hold E
// on Wren and share it with him.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const el = (id) => document.getElementById(id);
const std = (color, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

// id: name, price, health, what it looks like (and its colour)
export const FOOD = {
  marco:     { name: 'Marco Burger', price: 6, hp: 30, mesh: 'burger' },
  bigmarco:  { name: 'Big Marco', price: 9, hp: 50, mesh: 'bigburger' },
  bites:     { name: 'Chicken Bites', price: 5, hp: 25, mesh: 'box', color: 0xc8102e },
  fries:     { name: 'Fries', price: 3, hp: 12, mesh: 'fries', color: 0xc8102e },
  shake:     { name: 'Choc Shake', price: 4, hp: 15, mesh: 'cup', color: 0x6a3a22 },
  meal:      { name: 'Meal Deal', price: 12, hp: 100, mesh: 'bag', color: 0xc8102e },
  pie:       { name: 'Cherry Pie', price: 4, hp: 15, mesh: 'slice' },
  pancakes:  { name: 'Pancakes', price: 6, hp: 25, mesh: 'stack' },
  dinerburger: { name: 'Diner Burger', price: 8, hp: 35, mesh: 'burger' },
  milkshake: { name: 'Strawberry Shake', price: 4, hp: 15, mesh: 'cup', color: 0xf28ab0 },
  joe:       { name: 'Diner Coffee', price: 2, hp: 5, mesh: 'cup', color: 0xe8e2d4 },
  flatwhite: { name: 'Flat White', price: 4, hp: 6, mesh: 'cup', color: 0xe8e2d4 },
  longblack: { name: 'Long Black', price: 3, hp: 5, mesh: 'cup', color: 0x2a2a2a },
  muffin:    { name: 'Blueberry Muffin', price: 3, hp: 10, mesh: 'muffin' },
  croissant: { name: 'Croissant', price: 3, hp: 10, mesh: 'croissant' },
  noodles:   { name: 'Noodles', price: 9, hp: 35, mesh: 'noodlebox', color: 0xd8302a },
  dumplings: { name: 'Dumplings', price: 7, hp: 25, mesh: 'dumplings' },
  rice:      { name: 'Fried Rice', price: 8, hp: 30, mesh: 'noodlebox', color: 0xe8b830 },
  mystery:   { name: 'Mystery Noodles', price: 2, hp: 10, mesh: 'noodlebox', color: 0x6a8a3a, risky: true },
  sdumplings:{ name: '"Dumplings"', price: 3, hp: 12, mesh: 'dumplings', risky: true },
  turkey:    { name: 'Boiled Turkey', price: 6, hp: 25, mesh: 'leg' },
  turkeyburger: { name: 'Turkey Burger', price: 8, hp: 35, mesh: 'burger' },
  gravyfries:{ name: 'Gravy Fries', price: 4, hp: 15, mesh: 'fries', color: 0x9a2a1a },
  energy:    { name: 'Energy Drink', price: 5, hp: 8, mesh: 'can', color: 0x3ad86a },
  soda:      { name: 'Soda', price: 3, hp: 5, mesh: 'can', color: 0xd8344a },
  snack:     { name: 'Chips', price: 3, hp: 15, mesh: 'chips', color: 0xf2c23a },
};
// who sells what (by shop name, or the kind of worker)
const MENUS = [
  { test: (n) => n.marcos, title: 'MARCOS', lede: '"Welcome to MARCOS! What can I get you?"', items: ['marco', 'bigmarco', 'bites', 'fries', 'shake', 'meal'], theme: 'marcos' },
  { test: (n) => n.role === 'waitress', title: 'THE DINER', lede: '"What\'ll it be, hon?"', items: ['pie', 'pancakes', 'dinerburger', 'milkshake', 'joe'] },
  { test: (n) => n.role === 'barista', title: 'COFFEE STORE', lede: '"Flat white? Long black? Something stronger?"', items: ['flatwhite', 'longblack', 'muffin', 'croissant'] },
  { test: (n) => n.role === 'cook' && /shitty/i.test(n.shop || ''), title: 'SHITTY WOK', lede: '"You eat, you don\'t ask."', items: ['mystery', 'sdumplings'] },
  { test: (n) => n.role === 'cook' && /wok/i.test(n.shop || ''), title: 'CITY WOK', lede: '"Number 4? Number 4."', items: ['noodles', 'dumplings', 'rice'] },
  { test: (n) => n.role === 'cook', title: 'ALBUQUERQUE BOILED TURKEY', lede: '"Boiled turkey or turkey, boiled?"', items: ['turkey', 'turkeyburger', 'gravyfries'] },
  { test: (n) => n.role === 'bartender' || (n.shopKind === 'nightclub' || /nightclub/i.test(n.shop || '')), title: 'THE BAR', lede: '"What are you drinking? (Nothing strong. You\'re driving. Probably.)"', items: ['energy', 'soda'] },
];

// ---- what it looks like: built small, sat on y = 0
export function foodMesh(type, color = 0xc8102e) {
  const g = new THREE.Group(), add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; };
  const bun = std(0xd8963a, 0.6), patty = std(0x5a3220, 0.8), lettuce = std(0x5fbf3f, 0.7), cheese = std(0xffc72c, 0.5), paper = std(0xf4efe4, 0.8);
  if (type === 'burger' || type === 'bigburger') {
    const big = type === 'bigburger' ? 1.25 : 1, r = 0.055 * big;
    add(new THREE.CylinderGeometry(r, r, 0.018, 18), bun, 0, 0.009);
    add(new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.016, 18), patty, 0, 0.026);
    add(new THREE.CylinderGeometry(r * 1.06, r * 1.06, 0.004, 4), cheese, 0, 0.036, 0, 0, Math.PI / 4);
    if (big) { add(new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.016, 18), patty, 0, 0.046); }
    add(new THREE.CylinderGeometry(r * 1.08, r * 1.08, 0.006, 12), lettuce, 0, type === 'bigburger' ? 0.058 : 0.042);
    const top = add(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), bun, 0, type === 'bigburger' ? 0.062 : 0.046); top.scale.y = 0.7;
    for (let i = 0; i < 6; i++) add(new THREE.SphereGeometry(0.004, 6, 4), std(0xfff3c4), Math.cos(i) * r * 0.5, (type === 'bigburger' ? 0.062 : 0.046) + r * 0.6, Math.sin(i * 1.7) * r * 0.5);
  } else if (type === 'fries') {
    const box = add(new THREE.CylinderGeometry(0.05, 0.035, 0.09, 4, 1, true), std(color, 0.6, { side: THREE.DoubleSide }), 0, 0.045, 0, 0, Math.PI / 4);
    const fry = std(0xf2c23a, 0.6); for (let i = 0; i < 12; i++) add(new THREE.BoxGeometry(0.008, 0.08, 0.008), fry, (Math.random() - 0.5) * 0.05, 0.085 + Math.random() * 0.02, (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3);
    box.scale.set(1, 1, 0.6);
  } else if (type === 'cup') {
    add(new THREE.CylinderGeometry(0.04, 0.03, 0.12, 18), std(color === 0x2a2a2a || color === 0xe8e2d4 ? 0xf4efe4 : color, 0.5), 0, 0.06);
    add(new THREE.CylinderGeometry(0.042, 0.042, 0.012, 18), std(color === 0xe8e2d4 || color === 0x2a2a2a ? 0x2a2a2a : 0xf4f4f4, 0.4), 0, 0.125);
    if (color === 0xe8e2d4 || color === 0x2a2a2a) add(new THREE.CylinderGeometry(0.041, 0.035, 0.035, 18), std(0x8a5a3a, 0.8), 0, 0.06); // (a cardboard sleeve)
    else add(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6), std(0xd8302a, 0.4), 0.01, 0.16, 0, 0, 0, 0.2); // (a straw)
  } else if (type === 'box') {
    add(new THREE.BoxGeometry(0.1, 0.06, 0.07), std(color, 0.6), 0, 0.03);
    add(new THREE.BoxGeometry(0.104, 0.012, 0.074), std(0xffc72c, 0.5), 0, 0.045);
    const nug = std(0xc8862a, 0.8); for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(0.014, 8, 6), nug, -0.03 + i * 0.02, 0.066, (i % 2) * 0.01);
  } else if (type === 'bag') {
    add(new THREE.BoxGeometry(0.12, 0.16, 0.07), std(0xb8925a, 0.9), 0, 0.08);
    add(new THREE.BoxGeometry(0.122, 0.03, 0.072), std(0xa8824a, 0.9), 0, 0.15, 0);
    const lg = new THREE.Mesh(new THREE.CircleGeometry(0.03, 18), std(color, 0.5)); lg.position.set(0, 0.08, 0.0355); g.add(lg);
    const y = new THREE.Mesh(new THREE.RingGeometry(0.024, 0.029, 18), std(0xffc72c, 0.5)); y.position.set(0, 0.08, 0.036); g.add(y);
  } else if (type === 'slice') {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.1, -0.035); sh.lineTo(0.1, 0.035); sh.closePath();
    const pie = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: false }), std(0xd8963a, 0.7)); pie.rotation.x = -Math.PI / 2; pie.position.x = -0.05; g.add(pie);
    add(new THREE.BoxGeometry(0.02, 0.006, 0.07), std(0x9a1a2a, 0.4), 0.045, 0.036, 0);
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.006, 20), std(0xf4f4f4, 0.4), 0, -0.003);
  } else if (type === 'stack') {
    add(new THREE.CylinderGeometry(0.08, 0.08, 0.006, 20), std(0xf4f4f4, 0.4), 0, 0.003);
    for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.055, 0.057, 0.014, 18), std(0xd8a050, 0.7), 0, 0.013 + i * 0.015);
    add(new THREE.BoxGeometry(0.02, 0.012, 0.02), std(0xfff0a0, 0.4), 0, 0.075, 0);
    add(new THREE.CylinderGeometry(0.045, 0.05, 0.004, 18), std(0x8a4a1a, 0.2), 0, 0.071);
  } else if (type === 'muffin') {
    add(new THREE.CylinderGeometry(0.035, 0.028, 0.045, 14), std(0x5a8ad8, 0.8), 0, 0.022);
    const t = add(new THREE.SphereGeometry(0.042, 14, 10), std(0xc8863a, 0.8), 0, 0.05); t.scale.y = 0.7;
    for (let i = 0; i < 5; i++) add(new THREE.SphereGeometry(0.007, 6, 4), std(0x3a2a6a, 0.5), Math.cos(i * 1.3) * 0.025, 0.07, Math.sin(i * 1.3) * 0.025);
  } else if (type === 'croissant') {
    for (let i = -2; i <= 2; i++) { const s = add(new THREE.SphereGeometry(0.022 - Math.abs(i) * 0.004, 10, 8), std(0xd89a3a, 0.6), i * 0.022, 0.02, Math.abs(i) * 0.012); s.scale.set(1.2, 0.9, 1); }
  } else if (type === 'noodlebox') {
    add(new THREE.CylinderGeometry(0.05, 0.038, 0.09, 4, 1), std(0xf4f4f0, 0.6), 0, 0.045, 0, 0, Math.PI / 4);
    add(new THREE.BoxGeometry(0.06, 0.006, 0.06), std(color, 0.5), 0, 0.06, 0.0005).scale.set(1, 1, 0.02); // (a red pagoda on the side)
    const lg = new THREE.Mesh(new THREE.CircleGeometry(0.018, 8), std(color, 0.5)); lg.position.set(0, 0.05, 0.0335); g.add(lg);
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.003, 0.003, 0.16, 6), std(0xd8b880, 0.6), s * 0.006, 0.11, 0, 0.25, 0, s * 0.05);
  } else if (type === 'dumplings') {
    add(new THREE.CylinderGeometry(0.065, 0.06, 0.035, 18, 1, true), std(0xa8824a, 0.9, { side: THREE.DoubleSide }), 0, 0.018);
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.004, 18), std(0xa8824a, 0.9), 0, 0.004);
    for (let i = 0; i < 5; i++) { const d = add(new THREE.SphereGeometry(0.018, 10, 8), std(0xf2e8d0, 0.6), Math.cos(i * 1.26) * 0.03, 0.03, Math.sin(i * 1.26) * 0.03); d.scale.set(1.2, 0.8, 1); }
  } else if (type === 'leg') {
    const m = add(new THREE.SphereGeometry(0.04, 14, 10), std(0xe8d8b8, 0.7), 0, 0.04, 0); m.scale.set(1, 0.85, 1.5);
    add(new THREE.CylinderGeometry(0.008, 0.01, 0.07, 8), std(0xf4f0e8, 0.5), 0, 0.04, 0.08, Math.PI / 2);
    add(new THREE.SphereGeometry(0.012, 8, 6), std(0xf4f0e8, 0.5), 0, 0.04, 0.115);
  } else if (type === 'can') {
    add(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 18), std(color, 0.3, { metalness: 0.6 }), 0, 0.06);
    add(new THREE.CylinderGeometry(0.029, 0.033, 0.008, 18), std(0xc0c4c8, 0.3, { metalness: 0.8 }), 0, 0.124);
    add(new THREE.BoxGeometry(0.0665, 0.03, 0.0665), std(0xf4f4f4, 0.4), 0, 0.06).scale.set(1, 1, 1); // (a stripe)
  } else if (type === 'chips') {
    const b = add(new THREE.BoxGeometry(0.1, 0.14, 0.035), std(color, 0.5), 0, 0.07); b.scale.set(1, 1, 1);
    add(new THREE.BoxGeometry(0.102, 0.015, 0.02), std(0xd8344a, 0.5), 0, 0.14);
    add(new THREE.CircleGeometry(0.025, 14), std(0xd8344a, 0.5), 0, 0.07, 0.0181);
  }
  return g;
}

export class Food {
  constructor(g) { this.g = g; this.open = false; this.menu = null; }
  venue(n) { if (!n.home || n.state === 'dead') return null; return MENUS.find(m => m.test(n)) || null; }
  // the talk wheel on someone who sells food
  options(n) { return [{ id: 'food:order', label: 'Order food' }, { id: 'talk', label: 'Talk' }, { id: 'compliment', label: 'Compliment' }, { id: 'insult', label: 'Insult' }]; }
  act(n, id) { if (id !== 'food:order') return false; this.show(this.venue(n), n); return true; }

  show(menu, n = null) {
    if (!menu) return;
    this.menu = menu; this.server = n; this.open = true; this.render(); el('menu').classList.add('on'); document.exitPointerLock?.();
  }
  close() { this.open = false; el('menu').classList.remove('on'); this.g.renderer.domElement.requestPointerLock?.(); }
  key(code) { if (code === 'Escape' || code === 'KeyE') this.close(); }
  render() {
    const g = this.g, m = this.menu, e = el('menu'), I = g.icons;
    e.className = 'on' + (m.theme ? ' ' + m.theme : '');
    e.innerHTML = `<h3>${m.title}</h3><div class="lede">${m.lede}</div>
      ${m.items.map(id => { const f = FOOD[id]; return `<button data-f="${id}" ${g.money >= f.price ? '' : 'disabled'}><img src="${I?.food(id) || ''}"><span>${f.name}</span><b>$${f.price}</b><i>+${f.hp >= 100 ? 'full' : f.hp} health</i></button>`; }).join('')}
      <button data-f="x" class="done">That's all · <kbd>E</kbd></button><div class="note">It's yours to carry: pick it on the hotbar and click to eat, or share it with Wren.</div>`;
    e.querySelectorAll('button[data-f]').forEach(b => b.addEventListener('click', (ev) => { ev.stopPropagation(); if (b.dataset.f === 'x') { this.close(); return; } this.buy(b.dataset.f); }));
  }
  buy(id) {
    const g = this.g, f = FOOD[id]; if (g.money < f.price) return;
    if (!g.inv.addFood(id)) { g.hud.toast("You can't carry any more. Eat something."); return; }
    g.money -= f.price; g.sfx?.cash?.(g.player.pos);
    if (this.server) g.citizens.say(this.server, pick(['Enjoy.', 'Here you go.', "Don't eat it in the car.", 'Next!']), 2);
    g.hud.toast(`${f.name}: on your hotbar · pick it and click to eat`, '#7be08a');
    this.render();
  }
  // bought straight off a till (the snacks)
  give(id) { return this.g.inv.addFood(id); }

  // ---- eating what's in your hand
  eat(id) {
    const g = this.g, pl = g.player, f = FOOD[id];
    if (f.risky && Math.random() < 0.3) { pl.hp = Math.max(5, pl.hp - 10); g.hud.toast(`${f.name}. That was a mistake. −10 health`, '#ff6a5a'); g.player.human.express('sad', 3); }
    else { pl.hp = Math.min(100, pl.hp + f.hp); g.hud.toast(`${f.name}. ${pick(['Delicious.', 'Still warm.', 'That hit the spot.', 'Better than expected.', 'Mm.'])} +${f.hp >= 100 ? 'full' : f.hp} health`, '#7be08a'); g.player.human.express('happy', 2.5); }
    g.sfx?.thunk?.(pl.pos);
    const W = g.story?.wren; if (W && g.citizens.pos(W).distanceTo(pl.pos) < 6 && Math.random() < 0.5) g.citizens.say(W, pick(["Oh, you're just going to eat that in front of me.", 'Is there one for me?', 'Chef. Share.', 'Smells good. Not that I asked.']), 2.6);
  }
  // ---- sharing with Wren
  share(id) {
    const g = this.g, f = FOOD[id], W = g.story?.wren, L = g.wren; if (!W) return;
    const line = {
      burger: ["MARCOS? You beautiful idiot.", 'Oh my god. Yes. Thank you.'], bigburger: ['A BIG Marco. For me? I could cry.', "This is the nicest thing anyone's done all week."],
      cup: ['Coffee. You get me.', "Okay, you're forgiven. For whatever it was."], noodlebox: ['Noodles! Kit used to get these every Friday.', 'Mm. Spicy. Good.'],
      dumplings: ["Dumplings. You're my favourite person today.", 'Ooh. Fight me for the last one.'], leg: ["Boiled turkey. Chef. Why.", "…It's grey. Thank you, though."],
      slice: ['Pie! Diner pie! Okay, okay.', "Cherry. Kit's favourite."], stack: ['Pancakes at this time? Yes.', 'Breakfast for dinner. Respect.'],
    }[f.mesh] || ['Oh, thanks!', "You didn't have to. I'm glad you did.", 'Sharing. Look at us.'];
    g.citizens.say(W, pick(line), 3.2); W.human.express('happy', 4);
    if (L) { const fresh = (L.fedT || 0) < performance.now(); L.fedT = performance.now() + 120000; L.add?.(fresh ? 3 : 1); }
    // he holds it a while, and then it's gone
    const m = foodMesh(f.mesh, f.color); W.human.b.wristR.add(m); m.position.set(0, -0.09, 0.03); m.scale.setScalar(1 / W.human.rig.scale.x);
    setTimeout(() => m.removeFromParent(), 5000);
  }
}
