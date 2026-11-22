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
      g.crew?.onNewDay();
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
    const nv = this.g.never?.recommended(); if (nv) return nv;
    const cr = this.g.crew?.recommended(); if (cr) return cr;
    if (this.id === 'mask') return { title: 'The Face', text: 'Lou at the <b>Pawn Shop</b> has something for you. $250.' };
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
      { id: 'r:glass', label: "You don't know who you're talking to." },
    ];
  }
  act(n, id) {
    const g = this.g, C = g.citizens;
    if (!id.startsWith('r:')) return false;
    if (id === 'r:talk') { C.say(n, pick(["Pier, beach, the club. Kit worked them because I let him. Kit's dead. Now they're mine again.", "Your blue's good. Too good. My people are losing customers. So: you pay, or you stop.", "A quarter. Every bag he sells. Or one big number, and we forget your names."]), 5); return true; }
    // (whatever you offer, Royce wants more: it always ends in the shootout, and it always ends with him going down)
    if (id === 'r:cut') { C.say(n, "A quarter? Of what that kid makes? …No. I've changed my mind. I want all of it. And you.", 4); setTimeout(() => this.startFight(), 2600); return true; }
    if (id === 'r:buy') { C.say(n, g.money < 1500 ? "You can't even afford the insult." : "Fifteen hundred. Cute. Keep it. You'll need it for the funeral.", 3.6); setTimeout(() => this.startFight(), 2400); return true; }
    if (id === 'r:glass') { this.glass(n); return true; }
    if (id === 'r:fight') { C.say(n, "Wrong answer.", 2); setTimeout(() => this.startFight(), 900); return true; }
    return false;
  }
  // Glass: the first time he comes out. A bluff: it usually works; sometimes Royce calls it
  glass(n) {
    const g = this.g, S = g.story, C = g.citizens, pl = g.player;
    const q = C.pos(n), me = pl.pos, mid = q.clone().lerp(me, 0.5), side = V(me.z - q.z, 0, q.x - me.x).normalize();
    const cam = mid.clone().addScaledVector(side, 3.2).setY(me.y + 1.7), look = mid.clone().setY(me.y + 1.5);
    const toR = V(q.x - me.x, 0, q.z - me.z).normalize(), toMe = toR.clone().negate();
    const works = false; // (Royce never buys it)
    S.play([
      S.shotS(cam, cam.clone().addScaledVector(side, -0.8), look, look, 9, 42),
      S.line('YOU', "<i>You don't know who you're talking to.</i>", 2.4),
      S.line('ROYCE', 'Enlighten me.', 1.8),
      S.shotS(me.clone().addScaledVector(toR, 1.6).addScaledVector(side, 0.5).setY(me.y + 1.65), null, me.clone().setY(me.y + 1.6), null, 8, 36),
      S.line('YOU', "<i>Every bag of glass on this island came out of my hands. Ask around who makes it. Then come back and tell me what you're taking.</i>", 5),
      S.shotS(q.clone().addScaledVector(toMe, 1.8).setY(q.y + 1.6), null, q.clone().setY(q.y + 1.55), null, 4, 36),
      S.line('ROYCE', "…And who's that supposed to be?", 2.4),
      S.shotS(me.clone().addScaledVector(toR, 1.1).setY(me.y + 1.62), null, me.clone().setY(me.y + 1.6), null, 3, 30),
      S.line('YOU', '<i>Glass.</i>', 2.2),
      S.wait(0.8),
      S.line('ROYCE', works ? "…Okay. Okay, Glass. The island's big. Keep your people off my steps and we're square." : "Glass. GLASS? Ha! Light him up.", works ? 4 : 2.4),
    ]);
    S.onDone = () => {
      g.wren?.add?.(-6);
      if (!works) { this.startFight(); setTimeout(() => g.wren?.text('Wren', "who's GLASS?? what did you SAY to them"), 6000); return; }
      // (never happens now: kept so old saves that got the bluff still make sense)
      g.hud.toast('Royce backs down. No cut, no fee. They know the name now: Glass.', '#7be08a');
      for (const r of this.crew) { r.lines = ["Glass. Right.", "Royce says leave you be.", "Don't look at him."]; r.mood = 0; }
      setTimeout(() => g.wren?.text('Wren', 'royce called me. said "tell glass we\'re square". who is glass. what did you do'), 5000);
      this.finish('glass');
    };
  }
  settle(how) {
    const g = this.g;
    g.hud.toast(how === 'cut' ? "Deal: the Saltline crew take a quarter of what Wren makes." : "Deal: paid off. The Saltline crew leave Wren alone.", '#7be08a');
    setTimeout(() => g.wren?.text('Wren', how === 'cut' ? "a QUARTER? ok. ok. it's fine. we're fine. i'll sell more" : "you just PAID them? with what. ok. ok. fine. good. don't expect me to say thanks"), 5000);
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
  isDown(n) { return !n || !this.g.citizens.list.includes(n) || n.state === 'dead' || n.state === 'down' || n.downed || n.hp <= 0; }
  // Royce goes down. He doesn't get up. His crew run. (Everyone thinks he's dead. He isn't: later, a wheelchair, a bell.)
  royceDown(boss) {
    const g = this.g, S = g.story, C = g.citizens; this.royceGone = true;
    const rest = this.crew.filter(n => n !== boss && !this.isDown(n));
    for (const n of rest) { n.gunman = false; n.rival = false; n.state = 'flee'; n.stateT = 12; n.target = null; C.say(n, pick(['ROYCE! …He\'s not moving. GO, GO!', "He killed Royce! RUN!", "Royce? ROYCE?"]), 2.6); }
    setTimeout(() => { for (const n of rest) if (C.list.includes(n)) C.remove(n); }, 14000);
    const at = boss ? (boss.human.ragdoll ? V(boss.human.ragdoll.pelvis.x, 0, boss.human.ragdoll.pelvis.z) : C.pos(boss)) : this.home, cam = at.clone().add(V(2.6, 1.8, 2.6));
    if (!S.cine) {
      S.play([
        S.call(() => { g.timeScale = 0.35; }),
        S.shotS(cam, cam.clone().add(V(-0.6, -0.3, -0.4)), at.clone().setY(at.y + 0.4), null, 3.2, 40),
        S.call(() => { g.timeScale = 1; }),
        S.line('…', '<i>Royce doesn\'t get up.</i>', 2.4),
      ]);
      S.onDone = () => { g.timeScale = 1; };
    }
    g.hud.toast('Royce is down. The Saltline crew scatter.', '#ff9f43');
    setTimeout(() => g.wren?.text('Wren', "you killed royce. the whole island knows. who ARE you"), 5000);
    setTimeout(() => g.wren?.text('Wren', "come home. please. just come home"), 11000);
    this.finish('fight');
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
    setTimeout(() => g.hud.toast('Job done: Saltline.', '#ffb27a'), 2500);
    setTimeout(() => this.maskCall(), 20000);
    g.saver?.save();
  }

  // the pawnbroker texts: he's got something for the guy everyone's talking about
  maskCall() {
    const g = this.g; if (g.mask?.owned || this.id === 'mask') return;
    if (g.story?.cine || g.police.stars) { setTimeout(() => this.maskCall(), 8000); return; }
    this.id = 'mask';
    g.wren?.text('Unknown', "this is lou. pawn shop. word is you're the guy everyone's talking about. come see me. i've got something for you. something you'll want");
    g.hud.toast('📱 Something new on your phone (P): RECOMMENDED · The Face', '#ffd23f');
    g.saver?.save();
  }
  // at the counter: he brings it out from the back, and you put it on
  maskScene(n) {
    const g = this.g, S = g.story, C = g.citizens, pl = g.player;
    if (g.money < 250) { C.say(n, "Two-fifty. Come back when you've got it.", 3); return; }
    g.money -= 250; g.sfx?.cash?.(pl.pos);
    const q = C.pos(n), me = pl.pos, f = V(q.x - me.x, 0, q.z - me.z).normalize(), side = V(f.z, 0, -f.x);
    S.play([
      S.shotS(me.clone().addScaledVector(side, 1.6).addScaledVector(f, 0.4).setY(me.y + 1.6), null, q.clone().setY(q.y + 1.3), null, 6, 40),
      S.line('LOU', "Came in a year ago. Guy never came back for it. I don't ask.", 3.2),
      S.line('LOU', "Gold on the face. Plated. The horns, too. Nobody wanted it. Too much.", 3.4),
      S.line('LOU', "Then I heard about you. Figured: that's who it's for.", 3),
      S.call(() => { g.mask.owned = true; g.mask.on = true; g.mask.attach(pl.human); }),
      S.shotS(me.clone().addScaledVector(f, 1.5).setY(me.y + 1.62), me.clone().addScaledVector(f, 1.05).setY(me.y + 1.64), me.clone().setY(me.y + 1.62), null, 4.5, 34),
      S.wait(1.4),
      S.line('LOU', "…Yeah. Yeah, that's Glass.", 2.4),
      S.line('LOU', "Do me a favour. Don't wear it in here again.", 2.6),
    ]);
    S.onDone = () => {
      this.id = 'done'; g.crew?.arm(); g.hud.toast("The gold mask: K to put it on or take it off. Cops who see it will open fire. The dealers will know who you are.", '#ffd23f');
      g.saver?.save();
    };
  }

  update(dt) {
    const g = this.g;
    if (this.id === 'rivals') {
      if (!this.crew.length && g.story?.phase === 'free') this.spawnCrew();
      if (this.fight) {
        const up = this.crew.filter(n => !this.isDown(n));
        for (const n of up) if (!n.human.ragdoll && n.state !== 'gunman' && n.state !== 'blind' && !(n.stunT > 0)) { n.state = 'gunman'; n.home = null; }
        const boss = this.crew.find(n => n.boss);
        if (boss && this.isDown(boss) && !this.royceGone) this.royceDown(boss);
        else if (!up.length && !this.royceGone) this.royceDown(boss);
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
    if (this.id === 'mask' || (this.id === 'done' && this.outcome && !this.g.mask?.owned)) { this.id = 'done'; setTimeout(() => this.maskCall(), 8000); }
  }
}
