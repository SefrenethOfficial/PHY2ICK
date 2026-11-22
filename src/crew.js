// Low Profile: Glass lays low, and Wren brings in his friends to sell. Twig (tall, a beanie, says nothing; plays
// classical piano, secretly), Gopher (big, a beard, never stops talking; has a whole sci-fi show in his head) and
// Dice (the youngest; curly hair, a loud shirt, far too excited). They meet you in Wren's front yard, then each
// takes a corner: the Skatepark, the Pier, the Nightclub. Hand them bags; they sell one a minute or so, and you
// get about half. The job: three clean days (a day with no stars). Then the next one starts (Better Call Paul).
import * as THREE from 'three';
import { randomLook } from './character.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const CREW = {
  twig: {
    name: 'Twig', corner: 'the skatepark', off: [4, 0, -3],
    look: { female: false, height: 1.93, build: 0.82, hairStyle: 'beanie', beanie: 0x2a2e36, under: 'short', shirt: 0x3a4048, longSleeves: true, pants: 0x2a2c30, skin: 0xe0b896, hair: 0x2a1c12 },
    hi: ['Yo.', '…Sup.', 'Mm.'],
    biz: ["Steady. Skaters are good customers. They don't remember you.", 'Moving. Slow. Slow is fine.', "It's fine. It's all fine. Don't make it a thing."],
    none: ["Out. Got nothing. Just standing here, looking like a guy.", "Empty. Bring more."],
    quiet: ['Always am.', '…', "Quiet's my whole deal."],
    chat: ["I played Chopin at my nan's funeral. Nobody believes me. That's okay.", "Rachmaninoff had huge hands. That's why his stuff's hard. Not 'cause I'm bad.", 'I had a scholarship once. Long story. Not a long story. I quit.'],
  },
  gopher: {
    name: 'Gopher', corner: 'pier', off: [-4, 0, 2],
    look: { female: false, height: 1.8, build: 1.3, hairStyle: 'short', shirt: 0x5a6a3a, longSleeves: false, pants: 0x3a3a44, skin: 0xd8a888, hair: 0x5a3a22, beard: true },
    hi: ['Chef! My guy!', 'Ayyy, the man himself.', 'Yo yo yo.'],
    biz: ["Tourists, bro. Tourists love me. I give 'em a fact about the pier with every bag. Fake facts.", 'Booming. BOOMING. Okay, steady. But booming in my heart.', "Business is good. You know what else is good? Star Voyage. Season two. Let me tell you—"],
    none: ["Dry as a bone, Chef. Hook me up.", "I'm out, man. I've just been telling people about Star Voyage for free."],
    quiet: ["Quiet as a mouse. A big mouse. A loud mouse. But quiet.", 'Lips: sealed. Mostly.'],
    chat: ["Okay so Star Voyage: Captain Dax, right, gets beamed into a planet that's all one giant clam—", 'Star Voyage episode nine. The ship is sad. Like, the computer. It gets depressed. Emmy, bro.', "The ending of Star Voyage is the whole crew finds out they were the asteroid. Don't tell anyone. That's IP."],
  },
  dice: {
    name: 'Dice', corner: 'the nightclub', off: [-3, 0, -2.5],
    look: { female: false, height: 1.7, build: 0.92, hairStyle: 'curly', shirt: 0xe0622a, longSleeves: false, pants: 0x2a3a5a, skin: 0xb07850, hair: 0x1a120c },
    hi: ['GLASS. I mean. Chef. Hi.', "Yooo it's him!", 'Boss!'],
    biz: ["Club crowd's wild, bro. I sold one to a DJ. A DJ!", 'Selling like crazy. Okay, like, normal. But it feels crazy.', "Doing good! I'm doing good, right? Tell Wren I'm doing good."],
    none: ["I'm out! Out out. Can I get more? Please?", "Nothing left, boss. I'm just vibing."],
    quiet: ["Quiet! Totally. I haven't told ANYONE. Okay one guy. He's cool.", 'Shh. Yeah. Shh.'],
    chat: ['Is it true you wore a mask with HORNS? That is so sick.', 'When this blows up I\'m getting a jet ski. Two jet skis.', "My mum thinks I work at a phone shop. I DO have a phone."],
  },
};

export class Crew {
  constructor(g) {
    this.g = g; this.stage = 'none'; this.clean = 0; this.hot = false; this.callT = 0; this.sold = 0; this.cash = 0;
    this.members = {}; // key → { n, stock: [], sellT, downDay }
    this.maskDay = null;
  }

  // ---- the job, from the outside
  recommended() {
    if (this.stage === 'meet') return { title: 'Low Profile', text: 'Wren wants you at <b>his house</b> in Willow Bank. No mask.' };
    if (this.stage !== 'running') return null;
    const st = Object.entries(this.members).map(([k, m]) => `${CREW[k].name} ${m.stock.length}`).join(' · ');
    return { title: 'Low Profile', text: `Lay low: <b>clean days ${this.clean}/3</b> (no stars all day). Keep the crew stocked: ${st}.` };
  }
  // called when the mask's bought: a day later (or a while later), Wren calls
  arm() { if (this.stage === 'none') { this.stage = 'waiting'; this.maskDay = this.g.missions?.day ?? 1; this.callT = 120; } }
  call() {
    const g = this.g; this.stage = 'meet';
    g.wren?.text('Wren', "come to mine. NO mask. i've got people you need to meet");
    g.hud.toast('📱 Something new on your phone (P): RECOMMENDED · Low Profile', '#ffd23f');
    g.saver?.save();
  }

  // ---- the meeting, in Wren's front yard
  meet() {
    const g = this.g, S = g.story, C = g.citizens, h = g.wrenHouse, pl = g.player, W = S.wren;
    this.stage = 'meeting';
    const out = V(Math.sin(h.doorYaw), 0, Math.cos(h.doorYaw)), side = V(out.z, 0, -out.x);
    const yard = h.door.clone().addScaledVector(out, 3.2);
    // the three of them, on the lawn, facing you as you come up the path
    const spots = { twig: yard.clone().addScaledVector(side, -2.2), gopher: yard.clone().addScaledVector(side, 0.2).addScaledVector(out, -0.6), dice: yard.clone().addScaledVector(side, 2.3) };
    for (const k of Object.keys(CREW)) { this.spawn(k, spots[k], h.doorYaw); }
    const me = yard.clone().addScaledVector(out, 4.5);
    pl.respawn(me, h.doorYaw + Math.PI);
    if (W) { W.state = 'scripted'; W.script = { pos: h.door.clone().addScaledVector(out, 1.0).addScaledVector(side, -0.6), yaw: h.doorYaw, pose: { pose: 'stand' } }; }
    const camA = me.clone().addScaledVector(out, 3).addScaledVector(side, 3.2).setY(me.y + 2.2), look = yard.clone().setY(yard.y + 1.4);
    const T = this.members.twig.n, Gp = this.members.gopher.n, D = this.members.dice.n;
    const close = (n, d = 2.2) => { const p = C.pos(n); return [p.clone().addScaledVector(out, d).addScaledVector(side, 0.4).setY(p.y + 1.65), p.clone().setY(p.y + 1.6)]; };
    const [cT, lT] = close(T), [cG, lG] = close(Gp), [cD, lD] = close(D);
    S.play([
      S.shotS(camA, camA.clone().addScaledVector(side, -1.2), look, look, 7, 44),
      S.line('WREN', "I can't move all of it on my own. Not anymore. So.", 3.2),
      S.line('WREN', "These are my guys. I've known them since school. They're idiots. They're <i>my</i> idiots.", 4),
      S.shotS(cT, null, lT, null, 4, 36),
      S.line('WREN', 'Twig.', 1.2),
      S.line('TWIG', '…Sup.', 1.6),
      S.shotS(cG, null, lG, null, 6, 36),
      S.line('WREN', 'Gopher.', 1.2),
      S.line('GOPHER', "Chef! Big fan. Huge. Quick question, have you ever heard of a show called Star Voyage? Because it doesn't exist yet. I'm writing it.", 5),
      S.shotS(cD, null, lD, null, 4.5, 36),
      S.line('WREN', 'And Dice.', 1.2),
      S.line('DICE', 'Is it true about the mask? With the HORNS? Bro. BRO.', 3.2),
      S.shotS(camA, null, look, null, 9, 44),
      S.line('WREN', "Here's how it works. They sell. I run them. You cook. You stay off the street.", 4.2),
      S.line('WREN', "No mask. Not for a while. You're Glass, fine. You're not stupid.", 3.6),
      S.line('WREN', 'Twig takes the Skatepark. Gopher, the Pier. Dice, outside the club.', 3.6),
      S.line('GOPHER', 'The Pier! Tourists! I love tourists.', 2.4),
      S.line('WREN', 'Bring them bags. Three clean days and I start believing this works.', 3.6),
    ]);
    S.onDone = () => this.afterMeet();
  }
  // (also if the scene got cut short by anything: the crew still go to work)
  afterMeet() {
    const g = this.g, S = g.story, W = S.wren; if (this.stage !== 'meeting') return;
    this.stage = 'running'; this.clean = 0; this.hot = !!g.police.stars;
    try { if (W && W.state === 'scripted') { W.script = null; S.wrenHome(true); } } catch (e) { console.warn(e); }
    for (const k of Object.keys(CREW)) this.post(k);
    g.hud.toast('Low Profile: keep the crew stocked (hold E on them) and stay clean: three days without a star. They\'re on the map (M).', '#ffd23f');
    g.saver?.save();
  }

  // ---- the crew themselves
  spawn(k, at, yaw) {
    const g = this.g, c = CREW[k];
    const old = this.members[k]?.n; if (old && g.citizens.list.includes(old)) g.citizens.remove(old);
    const n = g.citizens.addWorker({ pos: at.clone().setY(0.05), yaw, name: c.name, role: 'crew', look: { ...randomLook(), ...c.look }, lines: c.chat });
    n.crewKey = k; n.dealer = false; n.mood = 40;
    this.members[k] = { ...(this.members[k] || { stock: [], sellT: 40 + Math.random() * 30 }), n };
    return n;
  }
  corner(k) { const c = CREW[k], P = this.g.places[c.corner]; return P ? P.pos.clone().add(V(...c.off)).setY(0.05) : this.g.player.pos.clone(); }
  post(k) {
    const g = this.g, m = this.members[k], at = this.corner(k);
    if (m?.jailed) return; // (in a cell, for now)
    let n = m?.n; if (!n || !g.citizens.list.includes(n) || n.state === 'dead') n = this.spawn(k, at, Math.random() * 6.28);
    n.human.resetPose(); n.script = null; n.state = 'post'; n.home = at.clone(); n.homeYaw = Math.random() * 6.28;
    n.body.setTranslation({ x: at.x, y: at.y + 1.0, z: at.z }, true); n.body.setNextKinematicTranslation({ x: at.x, y: at.y + 1.0, z: at.z });
  }
  alive(k) { if (this.members[k]?.jailed) return false; const n = this.members[k]?.n; return n && this.g.citizens.list.includes(n) && n.state !== 'dead' && !n.downed; }

  options(n) {
    const g = this.g, k = n.crewKey, m = this.members[k], have = g.drugs.count;
    if (this.stage === 'meeting' && !g.story?.cine) this.afterMeet();
    if (this.stage !== 'running' && this.stage !== 'done') return [{ id: 'crew:hi', label: 'Hey' }];
    return [
      { id: 'crew:give', label: have ? `Here, take ${Math.min(3, have)}` : 'Here, take some (you have none)' },
      { id: 'crew:biz', label: `How's business? (${m.stock.length} on him)` },
      { id: 'crew:quiet', label: 'Keep it quiet' },
      { id: 'crew:chat', label: 'Anything else?' },
    ];
  }
  act(n, id) {
    if (!id.startsWith('crew:')) return false;
    const g = this.g, C = g.citizens, k = n.crewKey, c = CREW[k], m = this.members[k], D = g.drugs;
    if (id === 'crew:hi') C.say(n, pick(c.hi), 2.4);
    if (id === 'crew:give') {
      if (!D.count) { C.say(n, "…You don't have any, boss.", 2.6); return true; }
      const take = Math.min(3, D.count); for (let i = 0; i < take; i++) m.stock.push(D.bags.shift());
      D.onChange?.(); g.hud.toast(`${c.name} takes ${take} bag${take > 1 ? 's' : ''}`, '#5fd0ff');
      C.say(n, k === 'gopher' ? "Ohhh yeah. Daddy's home. I mean. Thank you." : k === 'dice' ? 'LET\'S GO. I mean. Cool. Thanks.' : 'Mm. Cool.', 2.8);
      g.saver?.save();
    }
    if (id === 'crew:biz') C.say(n, pick(m.stock.length ? c.biz : c.none), 4);
    if (id === 'crew:quiet') C.say(n, pick(c.quiet), 3);
    if (id === 'crew:chat') C.say(n, pick(c.chat), 4.5);
    return true;
  }

  // ---- the days
  onNewDay() {
    if (this.stage !== 'running') return;
    const g = this.g;
    if (!this.hot) { this.clean++; g.hud.toast(`A clean day. Low Profile: ${this.clean}/3`, '#7be08a'); }
    else g.hud.toast('Yesterday had heat. It doesn\'t count.', '#ff9f43');
    this.hot = !!g.police.stars;
    for (const k of Object.keys(CREW)) if (!this.alive(k)) this.post(k); // (back on their corner, patched up)
    if (this.clean >= 3) this.done();
  }
  done() {
    const g = this.g; this.stage = 'done';
    setTimeout(() => g.wren?.text('Wren', `three days. no heat. the guys moved ${this.sold} bags. $${this.cash} for you. …this might actually work`), 3000);
    setTimeout(() => g.hud.toast('Job done: Low Profile.', '#ffb27a'), 1200);
    g.saver?.save();
  }

  update(dt) {
    const g = this.g;
    if (this.stage === 'waiting') { if (g.story?.phase === 'free' && !g.story.cine && !g.police.stars && (((this.callT -= dt) <= 0) || (g.missions?.day ?? 1) > this.maskDay)) this.call(); return; }
    if (this.stage === 'meet') {
      const h = g.wrenHouse, W = g.story?.wren;
      if (h && !g.story.cine && !g.player.car && !g.police.stars && W && !W.following && g.player.pos.distanceTo(h.door) < 14) {
        if (g.mask?.worn) { if (!this.maskNag) { this.maskNag = true; g.citizens.say(W, 'Take. That. Off. I said NO mask.', 3); } }
        else this.meet();
      }
      return;
    }
    if (this.stage === 'meeting') { if (!g.story?.cine) this.afterMeet(); return; }
    if (this.stage !== 'running' && this.stage !== 'done') return;
    if (g.police.stars && this.stage === 'running') this.hot = true;
    // selling: a bag each, now and then (not while the island's crawling with cops looking for you)
    for (const [k, m] of Object.entries(this.members)) {
      if (!m.stock.length || !this.alive(k)) continue;
      if ((m.sellT -= dt * (g.police.stars ? 0.3 : 1)) > 0) continue;
      m.sellT = 55 + Math.random() * 35;
      const p = m.stock.shift(), cash = Math.round(85 * (0.45 + p * 0.9) * 0.5 * (1 - (g.missions?.cut || 0)));
      g.money += cash; this.sold++; this.cash += cash;
      g.hud.toast(`${CREW[k].name} sold a bag (+$${cash})${m.stock.length ? '' : ` · he's out`}`, '#5fd0ff');
    }
    // one of them got hurt: Wren hears about it
    for (const k of Object.keys(CREW)) {
      const m = this.members[k]; if (!m?.n || m.jailed) continue;
      const bad = !this.alive(k);
      if (bad && !m.hurt) { m.hurt = true; setTimeout(() => g.wren?.text('Wren', pick([`what happened to ${CREW[k].name.toLowerCase()}?? he's my FRIEND. if that was you`, `${CREW[k].name.toLowerCase()} is hurt. who did this. tell me it wasn't you`])), 4000); g.wren?.add?.(-4); }
      if (!bad) { m.hurt = false; if (m.n.state === 'wander' || m.n.state === 'idle') { m.n.state = 'post'; m.n.home = this.corner(k); } } // (back to the corner once the fuss dies down)
    }
  }

  // locked up (Dice, in Never Call Paul) and let go again
  jail(k) { const m = this.members[k]; if (!m) return; m.jailed = true; if (m.n && this.g.citizens.list.includes(m.n)) this.g.citizens.remove(m.n); }
  free(k) { const m = this.members[k]; if (!m) return; m.jailed = false; this.post(k); }
  // the map: where they are
  pois() { if (this.stage !== 'running' && this.stage !== 'done') return []; return Object.keys(CREW).filter(k => this.alive(k)).map(k => ({ name: `${CREW[k].name} · crew (${this.members[k].stock.length})`, pos: this.g.citizens.pos(this.members[k].n) })); }

  state() { return { stage: this.stage === 'meeting' ? 'meet' : this.stage, clean: this.clean, hot: this.hot, sold: this.sold, cash: this.cash, maskDay: this.maskDay, stock: Object.fromEntries(Object.entries(this.members).map(([k, m]) => [k, m.stock])), jailed: Object.keys(this.members).filter(k => this.members[k].jailed) }; }
  restore(s) {
    if (!s) return;
    Object.assign(this, { stage: s.stage || 'none', clean: s.clean || 0, hot: !!s.hot, sold: s.sold || 0, cash: s.cash || 0, maskDay: s.maskDay ?? null });
    if (this.stage === 'waiting') this.callT = 30;
    if (this.stage === 'running' || this.stage === 'done') for (const k of Object.keys(CREW)) { this.members[k] = { stock: s.stock?.[k] || [], sellT: 40 + Math.random() * 30, jailed: (s.jailed || []).includes(k) }; this.post(k); }
  }
}
