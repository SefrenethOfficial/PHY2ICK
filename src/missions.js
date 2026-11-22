// The jobs after the first cook. Not a mission list: one thing at a time, on the objective line.
//   1 · Three More: cook three more batches. One cook a day: sleep in your bed (1E) and it's a new day.
//       (Out in the Dry the fumes go nowhere; anywhere else, someone smells it and calls the police.)
//   2 · Saltline: a crew at the Saltline Apartments, up by North Quay, have been leaning on Wren's buyers. Go and
//       see them. Talk them round (give them a cut, or buy them out), or tell them where to go and have it out.
// Also here: the day (and sleeping), and the rival crew's gunmen.
import * as THREE from 'three';
import { randomLook } from './character.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Missions {
  constructor(g) {
    this.g = g;
    this.id = null;          // 'cooks', 'rivals', 'done'
    this.day = 1; this.lastCookDay = 0;
    this.count = 0;          // (cooks, for the first job)
    this.cut = 0;            // (what the Saltline crew take of Wren's sales, if you agreed to it)
    this.crew = []; this.fight = false;
  }

  // ---- the day: one cook a day; sleep to start the next
  get cookedToday() { return this.lastCookDay === this.day; }
  canCook() {
    if (this.g.story?.phase !== 'free') return true; // (the first cook isn't counted against you)
    if (this.cookedToday) { this.g.hud.toast("You've cooked today. Get some sleep first: your bed at home, in 1E.", '#ffd23f'); return false; }
    return true;
  }
  canSleep() { const g = this.g; return g.story?.phase === 'free' && !g.police.stars && !g.drugs.cook && !g.player.car; }
  sleep() {
    const g = this.g, S = g.story, pl = g.player;
    if (!this.canSleep()) { g.hud.toast(g.police.stars ? "You can't sleep with the police after you." : "Not now."); return; }
    S.blink(() => {
      this.day++; pl.hp = 100;
      const ch = document.getElementById('chapter'); ch.innerHTML = `<span>Day ${this.day}</span><small>The next morning.</small>`; ch.classList.add('on');
      setTimeout(() => ch.classList.remove('on'), 2200);
      if (g.wren?.unlocked && Math.random() < 0.6) setTimeout(() => g.wren.text('Wren', pick(['you up? buyers are waiting', 'new day. new bags?', "we're running low. cook today", 'you cooking or what'])), 3500);
      g.saver?.save();
    });
  }

  // ---- the jobs
  start(id) {
    const g = this.g; this.id = id;
    if (id === 'cooks') { this.count = 0; g.story.objective(null); g.hud.toast('📱 Something new on your phone (P): RECOMMENDED · Three More', '#ffd23f'); } // (not forced: it sits on the phone)
    if (id === 'rivals') { this.spawnCrew(); this.objective(); }
    if (id === 'done') { g.story.objective(null); g.story.waypoint(null); }
  }
  objective() {
    const S = this.g.story;
    if (this.id === 'cooks') return; // (on the phone, as RECOMMENDED: see recommended())
    if (this.id === 'rivals') { S.objective(this.fight ? '<b>Saltline</b> · deal with the Saltline crew' : '<b>Saltline</b> · go and see the crew at the <b>Saltline Apartments</b> (North Quay, the far end of the Dry)'); if (!this.fight) S.waypoint(this.home.clone(), 'the Saltline Apartments'); }
  }
  // what shows at the top of your phone as RECOMMENDED (a suggestion, not an order)
  recommended() {
    if (this.id !== 'cooks') return null;
    return { title: 'Three More', text: `Cook three batches (${this.count}/3). One a day${this.cookedToday ? ': <i>done for today, sleep in 1E</i>' : ''}. Out in <b>the Dry</b>, or the police smell it.` };
  }
  // a batch came out of the van
  onCook() {
    const g = this.g;
    if (g.story?.phase === 'free') this.lastCookDay = this.day;
    if (this.id !== 'cooks') return;
    this.count++; if (this.count < 3) g.hud.toast(`Three More: ${this.count}/3`, '#ffd23f');
    if (this.count >= 3) {
      g.hud.toast('Job done: three more batches.', '#7be08a');
      setTimeout(() => this.rivalsCall(), 9000);
      this.id = 'between';
    }
  }
  // Wren rings: someone's been leaning on his buyers
  rivalsCall() {
    const g = this.g, S = g.story, W = g.wren;
    if (S.cine) { setTimeout(() => this.rivalsCall(), 4000); return; }
    const seq = [['WREN', "Chef. We've got a problem."], ['WREN', "Three guys at the pier. Saltline crew, from the flats out by the docks. They took two of my bags off a buyer and told him to tell me."], ['YOU', '<i>Tell you what?</i>'], ['WREN', "That the island's theirs. That we pay, or we stop. Their boss wants to see the cook. You."], ['WREN', "Royce. Saltline Apartments, at the end of the desert. Be careful. Or don't be. I don't know. Just come back."]];
    let t = 0; for (const [w, s] of seq) { setTimeout(() => S.sub(w, w === 'YOU' ? s : s, 3.6), t); t += 3800; }
    W?.text?.('Wren', 'saltline apartments. royce. be careful chef');
    setTimeout(() => this.start('rivals'), t);
  }

  // ---- the Saltline crew: Royce and three of his, out front of the apartments
  get home() { return V(630, 0.05, -2268); } // (out front of the Saltline Apartments)
  spawnCrew() {
    const g = this.g, C = g.citizens; if (this.crew.length) return;
    const h = this.home, jacket = 0x1f6a6a;
    const lines = ["Royce'll talk to you. Not me.", "Nice car. Is it yours?", "You're the cook? You look like a teacher."];
    const at = [[0, 0, 'Royce', true], [2.4, 1.5], [-2.4, 1.5], [1.2, 3.2]];
    for (const [dx, dz, name, boss] of at) {
      const p = h.clone().add(V(dx, 0, dz));
      const n = C.addWorker({ pos: p, yaw: 0, lines: boss ? ["You're the cook. Good. Let's talk about my island."] : lines, role: 'rival', name: name || pick(['Deshawn', 'Mick', 'Tavi', 'Jonah', 'Ray', 'Silas']),
        look: { ...randomLook(), female: false, shirt: boss ? 0x2a2a2a : jacket, longSleeves: true, pants: 0x22262a, hairStyle: boss ? 'buzz' : pick(['short', 'buzz', 'cap']) } });
      n.rival = true; n.boss = !!boss; n.hp = boss ? 140 : 110; n.brave = 1; n.mood = 0; if (boss) n.mem.met = true;
      g.weapons.giveModel(n.human, 'pistol');
      this.crew.push(n);
    }
  }
  options(n) {
    if (this.fight) return [{ id: 'talk', label: 'Talk' }];
    if (!n.boss || this.id !== 'rivals') return [{ id: 'talk', label: 'Talk' }];
    const g = this.g;
    return [
      { id: 'r:talk', label: 'What do you want?' },
      { id: 'r:cut', label: "Fine. A quarter of what Wren makes" },
      { id: 'r:buy', label: g.money >= 1500 ? 'Buy them off: $1,500' : 'Buy them off: $1,500 (you\'re short)' },
      { id: 'r:fight', label: 'Tell them where to go' },
    ];
  }
  act(n, id) {
    const g = this.g, C = g.citizens;
    if (!id.startsWith('r:')) return false;
    if (id === 'r:talk') { C.say(n, pick(["Pier, beach, the club. Kit worked them because I let him. Kit's dead. Now they're mine again.", "Your blue's good. Too good. My people are losing customers. So: you pay, or you stop.", "A quarter. Every bag she sells. Or one big number, and we forget your names."]), 5); return true; }
    if (id === 'r:cut') { this.cut = 0.25; C.say(n, "Smart. A quarter, every week. Don't make me count it twice.", 4); this.settle('cut'); return true; }
    if (id === 'r:buy') { if (g.money < 1500) { C.say(n, "Come back when you've got it. All of it.", 3); return true; } g.money -= 1500; g.sfx?.cash?.(g.player.pos); C.say(n, "…Huh. Okay. Pleasure doing business. Stay off my steps.", 4); this.settle('buy'); return true; }
    if (id === 'r:fight') { C.say(n, "Wrong answer.", 2); setTimeout(() => this.startFight(), 900); return true; }
    return false;
  }
  settle(how) {
    const g = this.g;
    g.hud.toast(how === 'cut' ? "Deal: the Saltline crew take a quarter of what Wren makes." : "Deal: paid off. The Saltline crew leave Wren alone.", '#7be08a');
    setTimeout(() => g.wren?.text('Wren', how === 'cut' ? "a QUARTER? ok. ok. it's fine. we're fine. i'll sell more" : "you just PAID them? with what. ok. ok. i love you. not like that. thank you"), 5000);
    for (const n of this.crew) { n.lines = ["We're good. Don't make it weird.", "Royce says you're alright.", "Stay off our steps."]; n.mood = 20; }
    this.finish(how);
  }
  // it's on: they all draw
  startFight() {
    const g = this.g; if (this.fight) return;
    this.fight = true; this.objective();
    for (const n of this.crew) { if (n.state === 'dead') continue; n.gunman = true; n.home = null; n.state = 'gunman'; n.shootT = 0.6 + Math.random() * 1.2; this.g.citizens.say(n, pick(['Light him up!', "Don't let him walk!", 'GET HIM!']), 2); }
    g.citizens.panic(this.home, null, 40);
    g.hud.toast('The Saltline crew are coming for you', '#ff5a5a');
  }
  // hit one, aim at one, shoot near them: it's a fight
  provoked(n) { if (this.id === 'rivals' && !this.fight && n?.rival) this.startFight(); }

  // a gunman's thinking: keep a distance, shoot when they can see you, close in when they can't
  think(n, p, h) {
    const g = this.g, pl = g.player, pp = pl.car ? pl.car.pos : pl.pos, d = Math.hypot(pp.x - p.x, pp.z - p.z);
    n.shootT = (n.shootT ?? 1) - h; n.aimAt = null;
    if (pl.dead) return { goal: null, spd: 0 };
    const tp = pp.clone().add(V(0, 1.2, 0)), from = p.clone().add(V(0, 1.45, 0));
    const see = d < 55 && g.police.los(from, tp, 60);
    if (see) {
      n.aimAt = tp;
      if (n.shootT <= 0) { n.shootT = 0.8 + Math.random() * 1.0; g.police.copShoot(n, from, tp, d); }
      if (n.prefD == null) { n.prefD = 7 + Math.random() * 9; n.flank = (Math.random() - 0.5) * 2; }
      const away = Math.atan2(p.x - pp.x, p.z - pp.z) + n.flank * 0.3, spot = pp.clone().add(V(Math.sin(away) * n.prefD, 0, Math.cos(away) * n.prefD));
      if (Math.abs(d - n.prefD) > 3 || spot.distanceTo(p) > 3) return { goal: spot, spd: 3.6, face: pp };
      return { goal: null, spd: 0, face: pp };
    }
    return { goal: pp.clone(), spd: 4.2 };
  }

  finish(how) {
    const g = this.g;
    this.id = 'done'; this.fight = false; this.outcome = how; g.story.objective(null); g.story.waypoint(null);
    setTimeout(() => g.hud.toast('Job done: Saltline. The story continues soon.', '#ffb27a'), 2500);
    g.saver?.save();
  }

  update(dt) {
    const g = this.g;
    if (this.id === 'rivals') {
      if (!this.crew.length && g.story?.phase === 'free') this.spawnCrew();
      if (this.fight) {
        const up = this.crew.filter(n => n.state !== 'dead' && g.citizens.list.includes(n) && !n.downed && n.hp > 0);
        for (const n of up) if (!n.human.ragdoll && n.state !== 'gunman' && n.state !== 'blind' && !(n.stunT > 0)) { n.state = 'gunman'; n.home = null; }
        if (!up.length) {
          g.hud.toast('The Saltline crew are done.', '#7be08a');
          setTimeout(() => g.wren?.text('Wren', "chef. CHEF. the whole island heard that. are you ok?? come home"), 4000);
          this.finish('fight');
        }
      } else if (!this.fight) {
        // pull a gun on them (or come at them) and it starts anyway
        const W = g.weapons, pp = g.player.pos;
        if (this.crew.some(n => n.state !== 'post' && n.state !== 'talk' && n.state !== 'idle' && n.state !== 'dead')) this.startFight();
        else if (W.aiming && W.W.gun && this.crew.some(n => g.citizens.pos(n).distanceTo(pp) < 25)) this.startFight();
      }
    }
  }

  // ---- saving
  state() { return { id: this.id, day: this.day, lastCookDay: this.lastCookDay, count: this.count, cut: this.cut, outcome: this.outcome || null }; }
  restore(s) {
    if (!s) return;
    Object.assign(this, { day: s.day || 1, lastCookDay: s.lastCookDay || 0, count: s.count || 0, cut: s.cut || 0, outcome: s.outcome });
    this.id = s.id === 'between' ? 'cooks' : s.id;
    if (s.id === 'between') this.count = 3;
    if (this.id === 'cooks' && this.count >= 3) { this.id = 'between'; setTimeout(() => this.rivalsCall(), 6000); }
    else if (this.id === 'rivals') this.start('rivals');
    else if (this.id === 'cooks') this.objective();
    if (this.id === 'done' && this.outcome !== 'fight') this.spawnCrew();
  }
}
