// PHYSICK (code name: MERIDIAN). A made-up drug, made up properly: the cook is a game, not chemistry.
// Supplies (Industrial Solvent from Home Improvements, Blue Salts from the Pawn Shop) are cooked at a
// lab: your kitchen stove, the back of a camper van, or the superlab under Albuquerque Boiled Turkey.
// The cook: keep the heat in the green, stir when it asks, don't let it boil over. Purity is your score.
// Sell it to buyers at the skatepark, the bushes, the beach washrooms and outside the nightclub,
// or in bulk at the Pawn Shop. Some buyers are cops.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export const LAB = {
  kitchen: { name: 'your kitchen', batch: 4, fumes: true, time: 22, bonus: 0 },
  van: { name: 'the camper', batch: 8, fumes: false, time: 24, bonus: 0.03 },
  superlab: { name: 'the superlab', batch: 16, fumes: false, time: 26, bonus: 0.08 },
};

export class Drugs {
  constructor(g) {
    this.g = g;
    this.solvent = 0; this.salts = 0;
    this.bags = []; // purities, 0–1
    this.cook = null;
    this.labOwned = false; this.cookHired = false; this.labStock = []; this.labT = 0;
    this.spotHeat = {};
    this.el = document.getElementById('cook');
    this.cv = this.el.querySelector('canvas'); this.cx = this.cv.getContext('2d');
  }
  get count() { return this.bags.length; }
  get purity() { return this.bags.length ? this.bags.reduce((a, b) => a + b, 0) / this.bags.length : 0; }
  get illegal() { return this.bags.length > 0; }

  // ---- the cook
  start(kind, where) {
    const g = this.g;
    if (this.cook) return;
    if (this.solvent < 1 || this.salts < 1) { g.hud.toast(`You need Industrial Solvent (Home Improvements) and Blue Salts (the Pawn Shop) · you have ${this.solvent} and ${this.salts}`, '#ffd23f'); return; }
    this.solvent--; this.salts--;
    const L = LAB[kind];
    this.cook = { kind, L, where, t: 0, heat: 0.2, zone: 0.45, zoneV: 0.05, good: 0, total: 0, stirAt: 3 + Math.random() * 2, stirWin: 0, stirMiss: 0, stirs: 0, fumes: 0, boil: 0, done: false, color: 0 };
    this.el.style.display = 'block';
    g.hud.toast(`Cooking at ${L.name} · hold Space for heat, keep it in the green · E when it says STIR · Q to give up`, '#5fd0ff');
  }
  key(code) {
    const c = this.cook; if (!c) return false;
    if (code === 'KeyE') { if (c.stirWin > 0) { c.stirWin = 0; c.stirs++; this.g.sfx?.thunk(this.g.player.pos); } else c.stirMiss += 0.5; return true; }
    if (code === 'KeyQ' || code === 'Escape') { this.finish(true); return true; }
    return code === 'Space';
  }
  update(dt) {
    const g = this.g;
    this.labTick(dt);
    const c = this.cook; if (!c) return;
    c.t += dt;
    const hold = g.keys.has('Space') || g.mouseL;
    c.heat = THREE.MathUtils.clamp(c.heat + (hold ? 0.32 : -0.22) * dt, 0, 1);
    // the green zone drifts about
    c.zone += c.zoneV * dt; if (c.zone < 0.25 || c.zone > 0.72) c.zoneV *= -1; if (Math.random() < dt * 0.4) c.zoneV = (Math.random() - 0.5) * 0.16;
    const W = 0.16, inZone = c.heat > c.zone && c.heat < c.zone + W;
    c.total += dt; if (inZone) c.good += dt;
    // stirring
    c.stirAt -= dt; if (c.stirAt <= 0) { c.stirWin = 1.3; c.stirAt = 3.5 + Math.random() * 2.5; }
    if (c.stirWin > 0) { c.stirWin -= dt; if (c.stirWin <= 0) c.stirMiss++; }
    // boiling over
    c.boil = c.heat > 0.93 ? c.boil + dt : Math.max(0, c.boil - dt);
    if (c.boil > 1.4) { this.fire(); return; }
    // fumes (in a flat, the neighbours notice)
    if (c.L.fumes) { c.fumes += dt * (0.03 + c.heat * 0.03); if (c.fumes >= 1 && !c.reported) { c.reported = true; g.hud.toast('A neighbour smells the fumes and calls it in…', '#ff5a5a'); g.police.reported(1, g.player.pos.clone(), 'fumes'); } }
    if (c.kind === 'van' && c.where && Math.random() < dt * 3) g.fx.smoke(c.where.pos.clone().add(V(0, 0.5, 0)).add(new THREE.Vector3(0, 1.55, -1.4).applyQuaternion(c.where.group.quaternion)), 1, 0.85, 0.5);
    if (c.kind === 'kitchen' && Math.random() < dt * 2) g.fx.smoke(g.player.pos.clone().add(V(Math.sin(g.player.yaw) * 0.6, 1.1, Math.cos(g.player.yaw) * 0.6)), 1, 0.8, 0.35);
    c.color = THREE.MathUtils.clamp(c.good / Math.max(1, c.total) - c.stirMiss * 0.06, 0, 1);
    this.draw();
    if (c.t >= c.L.time) this.finish(false);
  }
  purityNow() { const c = this.cook; return THREE.MathUtils.clamp(0.35 + (c.good / Math.max(1, c.total)) * 0.62 - c.stirMiss * 0.06 + c.L.bonus, 0.2, 0.99); }
  finish(quit) {
    const g = this.g, c = this.cook; if (!c) return;
    const p = this.purityNow();
    this.cook = null; this.el.style.display = 'none';
    if (quit) { g.hud.toast('You gave up on the batch. The supplies are wasted.'); return; }
    const n = Math.max(1, Math.round(c.L.batch * (0.6 + p * 0.4)));
    for (let i = 0; i < n; i++) this.bags.push(THREE.MathUtils.clamp(p + (Math.random() - 0.5) * 0.02, 0.2, 0.99));
    g.hud.toast(`${n} bags of Physick, ${Math.round(p * 100)}% pure${p > 0.9 ? '. Beautiful. Blue as the sea.' : p > 0.75 ? '. Good stuff.' : p > 0.55 ? '. It\'ll do.' : '. Cloudy. Nobody will pay much.'}`, '#5fd0ff');
  }
  fire() {
    const g = this.g, c = this.cook; this.cook = null; this.el.style.display = 'none';
    const at = c.kind === 'van' && c.where ? c.where.pos.clone() : g.player.pos.clone().add(V(Math.sin(g.player.yaw) * 0.7, 1, Math.cos(g.player.yaw) * 0.7));
    g.fx.explosion(at); g.sfx.explosion(at);
    g.player.hurt(28, V(-Math.sin(g.player.yaw), 0, -Math.cos(g.player.yaw)), 'explosion', true);
    if (c.kind === 'van' && c.where) c.where.damage(400);
    g.hud.toast('It boiled over and went up. Batch ruined.', '#ff5a5a');
    if (c.kind === 'kitchen') g.police.reported(1, g.player.pos.clone(), 'fire');
  }
  draw() {
    const c = this.cook, x = this.cx, W = this.cv.width, H = this.cv.height;
    x.clearRect(0, 0, W, H);
    // the flask (its colour is how well it's going: murky to Physick blue)
    const col = new THREE.Color().lerpColors(new THREE.Color(0x6a6a50), new THREE.Color(0x29b6ff), c.color);
    x.fillStyle = 'rgba(10,14,20,.85)'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#' + col.getHexString(); x.beginPath(); x.arc(70, 92, 44, 0, 7); x.fill();
    x.strokeStyle = '#cfe8ff'; x.lineWidth = 3; x.beginPath(); x.arc(70, 92, 46, 0, 7); x.stroke(); x.strokeRect(58, 18, 24, 32);
    for (let i = 0; i < 4 + c.heat * 10; i++) { x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.arc(40 + Math.random() * 60, 70 + Math.random() * 50, 1 + Math.random() * 3, 0, 7); x.fill(); }
    // the heat gauge
    const gx = 150, gw = 30, gh = 140, gy = 12;
    x.fillStyle = '#1a2230'; x.fillRect(gx, gy, gw, gh);
    x.fillStyle = 'rgba(80,220,110,.55)'; x.fillRect(gx, gy + gh * (1 - c.zone - 0.16), gw, gh * 0.16);
    x.fillStyle = 'rgba(255,60,40,.5)'; x.fillRect(gx, gy, gw, gh * 0.07);
    x.fillStyle = '#ffd23f'; x.fillRect(gx - 6, gy + gh * (1 - c.heat) - 2, gw + 12, 4);
    x.fillStyle = '#cfd8e2'; x.font = 'bold 12px Arial'; x.fillText('HEAT', gx - 2, gy + gh + 16);
    // the rest
    x.fillStyle = '#fff'; x.font = 'bold 16px Arial'; x.fillText('PHYSICK', 210, 30);
    x.font = '13px Arial'; x.fillStyle = '#9fb4c8'; x.fillText('MERIDIAN · batch ' + (c.L.batch), 210, 48);
    x.fillStyle = '#fff'; x.font = 'bold 14px Arial'; x.fillText('Purity ' + Math.round(this.purityNow() * 100) + '%', 210, 74);
    x.fillStyle = '#9fb4c8'; x.font = '13px Arial'; x.fillText('Time ' + Math.max(0, Math.ceil(c.L.time - c.t)) + 's', 210, 94);
    if (c.L.fumes) { x.fillText('Fumes', 210, 116); x.fillStyle = '#1a2230'; x.fillRect(260, 106, 110, 10); x.fillStyle = c.fumes > 0.75 ? '#ff5a3a' : '#c8b46a'; x.fillRect(260, 106, 110 * Math.min(1, c.fumes), 10); }
    if (c.stirWin > 0) { x.fillStyle = Math.floor(c.stirWin * 8) % 2 ? '#ffd23f' : '#fff'; x.font = 'bold 26px Arial'; x.fillText('STIR! [E]', 210, 150); }
    else if (c.boil > 0) { x.fillStyle = '#ff5a3a'; x.font = 'bold 20px Arial'; x.fillText('BOILING OVER!', 210, 150); }
    else { x.fillStyle = '#6a7a8a'; x.font = '12px Arial'; x.fillText('Space: heat · E: stir · Q: quit', 210, 150); }
  }

  // ---- the superlab: a hired cook makes it while you're away (one bag every 40 s, up to 30)
  labTick(dt) {
    if (!this.cookHired) return;
    this.labT += dt;
    if (this.labT > 40 && this.labStock.length < 30) { this.labT = 0; this.labStock.push(0.86 + Math.random() * 0.08); }
  }

  // ---- selling
  price(p, base) { return Math.round(base * (0.45 + p * 0.9)); }
  sell(n, who, howMany = 1) {
    const g = this.g, C = g.citizens;
    if (!this.bags.length) { C.say(who, pick(["You've got nothing.", 'Come back when you have something.', 'Empty pockets, huh?']), 2.5); return; }
    // an undercover cop
    if (who.undercover) {
      C.say(who, 'Police! You\'re under arrest!', 3); who.cop = true; who.copMode = 'chase'; who.state = 'cop'; who.role = null; who.home = null;
      g.police.crime('drugs', g.player.pos, true, true);
      g.hud.toast('It was an undercover cop!', '#ff5a5a');
      return;
    }
    const spot = who.spot || 'pawn', base = { nightclub: 95, skatepark: 70, bushes: 60, washrooms: 65, pawn: 38 }[spot] ?? 60;
    let sold = 0, cash = 0;
    this.bags.sort((a, b) => b - a);
    for (let i = 0; i < howMany && this.bags.length; i++) { const p = this.bags.shift(); cash += this.price(p, base); sold++; }
    if (spot === 'nightclub') cash = Math.round(cash * 0.8); // (the bouncer's cut)
    g.money += cash; g.sfx?.cash(g.player.pos);
    this.spotHeat[spot] = (this.spotHeat[spot] || 0) + sold;
    C.say(who, pick(['Nice doing business.', 'Ooh, that\'s the blue stuff.', 'Physick! Hell yeah.', 'Pleasure.', 'Same time tomorrow?']), 2.5);
    g.hud.toast(`Sold ${sold} bag${sold > 1 ? 's' : ''} of Physick for $${cash}${spot === 'nightclub' ? ' (after the bouncer\'s cut)' : ''}`, '#7be08a');
    // dealing in one place too often draws attention
    if (this.spotHeat[spot] > 8 && Math.random() < 0.35) { g.police.reported(1, g.player.pos.clone(), 'dealing'); this.spotHeat[spot] = 3; }
  }
}
