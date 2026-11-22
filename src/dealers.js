// Street dealers: men in hoodies in the back streets who sell what Halyard Arms won't. Round the back of the
// Nightclub, under the abandoned car park, by the Skatepark, and behind the North Quay warehouse out in the Dry.
// "Psst." Hold E: What've you got? They won't deal with the police about (or you wanted). Start something with
// one and he pulls a gun.
import * as THREE from 'three';
import { WEAPONS } from './weapons.js';
import { randomLook } from './character.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const el = (id) => document.getElementById(id);
const STOCK = ['knuckles', 'switchblade', 'bat', 'machete', 'revolver', 'sawnoff', 'smg'];
const SPOTS = [['nightclub', 'Nightclub', 'Ghost'], ['abandoned', 'the abandoned car park', 'Lefty'], ['skate', 'Skatepark', 'Dodge'], ['quay', null, 'Sully']];

export class Dealers {
  constructor(g) {
    this.g = g; this.list = []; this.open = false;
    for (const [key, place, name] of SPOTS) {
      let at;
      if (key === 'quay') at = V(498, 0.05, -2300);
      else { const P = g.places[place] || g.places[Object.keys(g.places).find(k => k.toLowerCase().includes(place.toLowerCase()))]; if (!P) continue; at = g.map.sidewalkPoint(P.pos, 30); }
      const n = g.citizens.addWorker({ pos: at, yaw: Math.random() * 6.28, role: 'armsdealer', name,
        lines: ["Psst. You buying or sightseeing?", "Keep your voice down.", "I don't know you. Good. Keep it that way."],
        look: { ...randomLook(), female: false, shirt: pick([0x1a1c20, 0x2a2e36, 0x3a2a22]), longSleeves: true, hairStyle: 'beanie', beanie: pick([0x1a1a1a, 0x3a2a2a, 0x2a3a2a]), under: 'short', pants: 0x22262a } });
      n.dealer = true; n.mem.met = true; n.hp = 120; n.brave = 1;
      this.list.push(n);
    }
  }
  // the talk wheel on a dealer
  options(n) {
    if (n.gunman) return [{ id: 'talk', label: 'Talk' }];
    return [{ id: 'deal:shop', label: "What've you got?" }, { id: 'talk', label: 'Talk' }, { id: 'compliment', label: 'Compliment' }, { id: 'insult', label: 'Insult' }];
  }
  act(n, id) {
    if (id !== 'deal:shop') return false;
    const g = this.g, C = g.citizens;
    if (g.police.stars) { C.say(n, pick(["You're hot. Walk away.", 'Not with the cops on you. Go.']), 2.5); return true; }
    if (g.police.cops().some(c => C.pos(c).distanceTo(C.pos(n)) < 28)) { C.say(n, pick(['Not now. Walk.', "There's a cop right there, genius."]), 2.5); return true; }
    this.show(n); return true;
  }
  show(n) { this.n = n; this.open = true; this.render(); el('menu').classList.add('on'); document.exitPointerLock?.(); }
  close() { this.open = false; el('menu').classList.remove('on'); this.g.renderer.domElement.requestPointerLock?.(); }
  key(code) { if (code === 'Escape' || code === 'KeyE') this.close(); }
  render() {
    const g = this.g, W = g.weapons, I = g.icons, e = el('menu');
    e.className = 'on dealer';
    const row = (id) => { const w = WEAPONS[id], own = W.inv.has(id); return `<button data-b="${id}" ${g.money >= w.price && !own ? '' : 'disabled'}><img src="${I?.weapon(id) || ''}"><span>${w.name}</span><b>$${w.price}</b><i>${own ? 'got it' : w.gun ? `+${w.ammoPack} rounds` : ({ knuckles: 'punch harder', switchblade: 'quick, sharp', bat: 'knocks them flying', machete: 'long, heavy' })[id]}</i></button>`; };
    const ammo = Object.keys(WEAPONS).filter(id => WEAPONS[id].gun && W.inv.has(id)).map(id => `<button data-a="${id}" ${g.money >= WEAPONS[id].ammoPrice ? '' : 'disabled'}><img src="${I?.weapon(id) || ''}"><span>Rounds: ${WEAPONS[id].name}</span><b>$${WEAPONS[id].ammoPrice}</b><i>+${WEAPONS[id].ammoPack}</i></button>`).join('');
    e.innerHTML = `<h3>${this.n?.name?.toUpperCase() || 'THE MAN'}</h3><div class="lede">"${pick(["Cash. No names. No refunds.", "It's all clean. Ish.", "You didn't get it from me."])}"</div>${STOCK.map(row).join('')}${ammo}<button data-b="x" class="done">Walk away · <kbd>E</kbd></button><div class="note">Carrying any of these is a crime if you're searched.</div>`;
    e.querySelectorAll('button[data-b]').forEach(b => b.addEventListener('click', (ev) => { ev.stopPropagation(); if (b.dataset.b === 'x') { this.close(); return; } this.buy(b.dataset.b); }));
    e.querySelectorAll('button[data-a]').forEach(b => b.addEventListener('click', (ev) => { ev.stopPropagation(); this.ammo(b.dataset.a); }));
  }
  buy(id) {
    const g = this.g, w = WEAPONS[id]; if (g.money < w.price || g.weapons.inv.has(id)) return;
    g.money -= w.price; g.sfx?.cash?.(g.player.pos); g.weapons.give(id, w.gun ? w.ammoPack : 0); g.inv?.reconcile();
    if (this.n) g.citizens.say(this.n, pick(['Pleasure.', "Don't wave it about.", 'Serial number? Never heard of her.', 'Enjoy. Responsibly. Ha.']), 2.4);
    g.hud.toast(`${w.name}: on your hotbar`, '#ffd23f'); this.render();
  }
  ammo(id) {
    const g = this.g, w = WEAPONS[id]; if (g.money < w.ammoPrice) return;
    g.money -= w.ammoPrice; g.weapons.ammo[id] += w.ammoPack; g.sfx?.cash?.(g.player.pos); this.render();
  }
  update(dt) {
    const g = this.g, pl = g.player, C = g.citizens;
    if (this.open && (!this.n || C.pos(this.n).distanceTo(pl.pos) > 4)) this.close();
    for (const n of this.list) {
      if (n.state === 'dead') continue;
      // start something and he's armed
      if (!n.gunman && !['post', 'talk', 'idle'].includes(n.state) && !n.human.ragdoll && n.state !== 'blind' && !(n.stunT > 0)) {
        n.gunman = true; n.home = null; n.state = 'gunman'; n.shootT = 0.8; g.weapons.giveModel(n.human, 'revolver'); C.say(n, pick(['Bad idea.', 'You picked the wrong guy.', 'OKAY. Okay.']), 2);
        if (this.open && this.n === n) this.close();
      }
      if (n.gunman && !n.human.ragdoll && n.state !== 'gunman' && n.state !== 'blind' && !(n.stunT > 0) && !n.downed) n.state = 'gunman';
      // "Psst."
      n.psstT = (n.psstT || 0) - dt;
      if (!n.gunman && n.state === 'post' && n.psstT <= 0 && !pl.car && C.pos(n).distanceTo(pl.pos) < 7) { n.psstT = 45; C.say(n, pick(['Psst.', 'Psst. Over here.', 'You look like you need something.', 'Psst. Not here. Here.']), 2.2); }
    }
  }
}
