// Paul Badfella, day to day: talk to him about anything (what he says moves with the story), ask him for a quick
// buck (real tips: every one of them works), have him make a call while you're wanted ($400 a star), compliment
// him, insult him. He never reports you. Hit him and he hits the panic button: two security guards with batons walk
// you out, and he won't talk to you for a few minutes. Sometimes he's with a client, on something deeply strange.
import * as THREE from 'three';
import { randomLook } from './character.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const STAR = 400;

const TIPS = [
  "Cars. Rusty's lot, round the back. Bring him something with four wheels and no questions. He pays by the car.",
  "The Pawn Shop buys anything. Wallets, watches, phones. Where you got them is between you and your conscience. Mine's on holiday.",
  "Pockets. People walk round with whole wallets in them. From behind, crouched, quietly. I'm not telling you to. I'm describing the weather.",
  "Your boys on the corners. Twig, Gopher, the jet-ski kid. Keep them stocked: they sell while you sleep. That's passive income. I love passive income.",
  "Purity, purity, purity. A cleaner batch sells for more. Measure twice, cook once. I don't know chemistry. I know money.",
  "Lucky pays way over street. Way over. I'm not saying it's worth it. I'm saying it's a lot.",
  "Wren sells it, Wren hands you your share. The more he trusts you, the better his cut works out for you. Be nice to Wren. Nobody's nice to Wren.",
  "Shops have tills. Tills have cash. I'm legally obliged to tell you that's a crime. There. I told you.",
  "Hold out for the good stuff: the Dry's quiet. Cook out there and nobody smells it. A quiet cook is a profitable cook.",
  "Sleep. A new day's a new cook. People forget to sleep. Then they forget to cook. Then they forget to pay their lawyer.",
];
const TOPICS = [
  ['me', 'You'], ['home', 'Albuquerque'], ['royce', 'The Royce case'], ['school', 'Law school'], ['boards', 'The billboards'], ['glass', 'Glass'], ['wren', 'Wren'], ['lucky', 'Lucky', (g) => g.lucky && g.lucky.stage !== 'none'], ['kit', 'Kit'], ['cheryl', 'Cheryl'],
];
const SAY = {
  me: ["I'm not from here. Albuquerque, born and raised. I came out for one case. One. That was eight months ago.", "I was going to be a magician. Same skills, honestly. Misdirection. A cape. Never explain the trick.", "People think I'm a bad lawyer. I'm a GREAT lawyer. I'm a bad person. Different departments."],
  home: ["Back home I've got a real office. Real marble. Some of it.", "Albuquerque. Sun, mountains, my face on every bus bench in the city. Here? One billboard and a tube man.", "This place? It's a pop-up. A rental. I got the columns from a party store. Back home they're at least fibreglass I OWN.", "Everybody in Albuquerque knows Paul. Cops, judges, crooks. Mostly the crooks. They tip better."],
  royce: ["The Royce family's been my client for years. Back home they're… a lot. They're a whole side of town.", "I came out to the island for the Royce case. The Saltline stuff. Then Royce went and— well. The case got complicated.", "Royce was my client. Is. Was. Legally it's a grey area. Medically too, from what I hear. I hear nothing. Moving on."],
  school: ["University of Online. Four years, part-time, mostly at night, mostly in a bath.", "I passed the bar on the fourth try. The first three, the bar passed me. That's a lawyer joke. You can laugh. It's free. Everything else costs."],
  boards: ["Never call Paul. It's reverse psychology. It works on everybody. You're here, aren't you.", "I designed it myself. Do you see the poker chips? That's subtext.", "The one by the police station's my favourite. They have to look at me every day. Every. Day."],
  glass: ["Glass? Never heard of him. Gold mask, horns, very handsome? Never heard of him.", "Everybody's talking about Glass. You know what nobody's talking about? Glass's lawyer. Keep it that way.", "If anyone asks, Glass is a man of average height and medium build. That's everyone. That's the point."],
  wren: ["Wren's a good kid. Nervous. Nervous is good. Nervous people check things twice.", "He asked me if I'm a real lawyer. I said 'define real'. He left."],
  lucky: ["Lucky. Lucky, Lucky, Lucky. I got him out on a technicality. The technicality was me crying in court.", "Don't mention his brother. Don't mention prison. Don't mention the colour orange. Long story.", "Lucky's not a bad guy. He's a guy who does bad things very enthusiastically."],
  kit: ["Kit… I did his traffic tickets. He always paid. Cash. Small bills. Huh. Now I think about it.", "He came in once asking about wills. Didn't sign anything. I should've asked why."],
  cheryl: ["Cheryl's been here longer than me. I'm not sure I hired her.", "She's not my secretary. She's very clear about that. I don't know what she is. I pay her though."],
};
// clients: Paul's lines, the client's, in turn
const CASES = [
  { who: 'Mr. Pell', look: { hairStyle: 'bald', shirt: 0x8a7a5a }, lines: [["PAUL", "So you want to sue… your reflection."], ["CLIENT", "He started it."], ["PAUL", "Mirrors are tough. They always have a counter-argument."], ["CLIENT", "He copies EVERYTHING I do."], ["PAUL", "That's not a crime. That's a vibe."]] },
  { who: 'Mrs. Odell', look: { female: true, hairStyle: 'bun', shirt: 0xb85a8a }, lines: [["CLIENT", "The parrot saw everything."], ["PAUL", "Will the parrot testify?"], ["CLIENT", "He only says 'pretty bird'."], ["PAUL", "Then we lead with that. Character witness."]] },
  { who: 'Gary', look: { hairStyle: 'short', shirt: 0x3a6a5a }, lines: [["CLIENT", "It's about custody of Mr. Buttons."], ["PAUL", "Your son?"], ["CLIENT", "My ventriloquist dummy. My ex says he loves her more."], ["PAUL", "Did he SAY that?"], ["CLIENT", "…I said it. In his voice."]] },
  { who: 'Mr. Vance', look: { hairStyle: 'side', shirt: 0x2a3a5a }, lines: [["CLIENT", "I bought a timeshare. On the moon."], ["PAUL", "Okay. Have you been?"], ["CLIENT", "No."], ["PAUL", "Then we've got a strong case. For the moon."]] },
  { who: 'Dot', look: { female: true, hairStyle: 'curly', shirt: 0xd8a84a }, lines: [["CLIENT", "The goose signed the contract."], ["PAUL", "Geese can't sign."], ["CLIENT", "He stepped in ink and then on the contract."], ["PAUL", "…That's a signature. I hate that that's a signature."]] },
  { who: 'Mr. Holt', look: { hairStyle: 'cap', shirt: 0x6a3a2a }, lines: [["CLIENT", "My neighbour's hedge is ten centimetres taller than mine."], ["PAUL", "And you want?"], ["CLIENT", "War."], ["PAUL", "I can do war. War's a retainer."]] },
  { who: 'Brenda', look: { female: true, hairStyle: 'long', shirt: 0x5a8ad8 }, lines: [["CLIENT", "I'm being haunted. I want to evict the ghost."], ["PAUL", "Does the ghost pay rent?"], ["CLIENT", "No."], ["PAUL", "Then he's a squatter. We'll have him out in thirty days. Thirty-one. Ghosts appeal."]] },
  { who: 'Mr. Finch', look: { hairStyle: 'buzz', shirt: 0x8ad87a }, lines: [["CLIENT", "I legally changed my name to 'Mr. Finch Esquire'. Now I want to be a lawyer."], ["PAUL", "…That's not how—"], ["CLIENT", "I have the paperwork."], ["PAUL", "Get out of my office. Leave the paperwork."]] },
];

export class PaulTalk {
  constructor(g) { this.g = g; this.menu = null; this.sulkT = 0; this.tip = Math.floor(Math.random() * TIPS.length); this.client = null; this.wasIn = false; this.cool = 0; }
  get n() { return this.g.never?.paulN?.(); }
  inside() { const o = this.g.paulOffice; return o && this.g.player.pos.distanceTo(o.centre) < o.R + 0.3; }

  options(n, extra) {
    const g = this.g, P = g.police;
    if (this.sulkT > 0) return [{ id: 'pt:sorry', label: 'Sorry' }, { id: 'pl:bye', label: 'Never mind' }];
    if (this.client) return [{ id: 'pt:busy', label: 'Paul?' }];
    if (this.menu === 'talk') return [...TOPICS.filter(t => !t[2] || t[2](g)).map(([k, l]) => ({ id: 'pt:t:' + k, label: l })), { id: 'pt:back', label: 'Back' }];
    const o = [...extra];
    o.push({ id: 'pt:talk', label: 'Talk' }, { id: 'pt:tip', label: 'Any quick money?' });
    if (P.stars) o.push({ id: 'pt:away', label: `Make it go away ($${STAR} a star)` });
    o.push({ id: 'pt:nice', label: 'Compliment' }, { id: 'pt:rude', label: 'Insult' }, { id: 'pl:bye', label: 'Never mind' });
    return o;
  }
  act(n, id) {
    if (!id.startsWith('pt:')) return false;
    const g = this.g, C = g.citizens, P = g.police;
    if (id === 'pt:busy') C.say(n, pick(["With a client! Two minutes!", "One second! This one's billing by the hour.", "Take a number! It's zero. It's always zero."]), 2.8);
    if (id === 'pt:sorry') C.say(n, this.sulkT > 60 ? "I'm billing you for that. Emotionally." : "…Fine. FINE. Give me a minute. My jaw's suing you.", 3.4);
    if (id === 'pt:talk') { this.menu = 'talk'; g.wheel.show(n); return true; }
    if (id === 'pt:back') { this.menu = null; g.wheel.show(n); return true; }
    if (id.startsWith('pt:t:')) { const k = id.slice(5); C.say(n, pick(SAY[k]), 5); this.menu = null; }
    if (id === 'pt:tip') { C.say(n, TIPS[this.tip], 6); this.tip = (this.tip + 1) % TIPS.length; }
    if (id === 'pt:away') {
      if (!P.stars) { C.say(n, "Away? From what? You're clean. Suspiciously clean. I love it.", 3); return true; }
      if (g.money < STAR) { C.say(n, `$${STAR}. I don't do favours. I do invoices.`, 3); return true; }
      g.money -= STAR; g.sfx?.cash?.(g.player.pos); n.human.express('happy', 3);
      P.stars = Math.max(0, P.stars - 1); if (!P.stars) P.clear?.();
      C.say(n, pick(["*on the phone* Officer! Paul Badfella. I'm calling about a misunderstanding. Huge misunderstanding. Yes. Thank you. …Done.", "*dials* Hi, it's me. That thing? It's not a thing. Okay? Okay. …You're welcome.", "One call. One call, and suddenly you're a model citizen. That's the magic of the law."]), 5);
      g.hud.toast(P.stars ? `Paul made a call: ${P.stars} star${P.stars > 1 ? 's' : ''} left` : 'Paul made a call: the heat\'s off', '#4fd8c8');
    }
    if (id === 'pt:nice') { n.human.express('happy', 3); C.say(n, pick(["I know. But thank you. I know.", "Flattery. Love it. Doesn't lower the fee.", "You're my favourite client. Don't tell my other favourite clients."]), 3); }
    if (id === 'pt:rude') { n.human.express('sad', 3); C.say(n, pick(["Wow. Okay. Billable.", "I'm writing that down. For the memoir.", "Words hurt. They also cost. That one was fifty bucks."]), 3); }
    return true;
  }

  // hit Paul and it's the panic button: two guards, batons, and you're out on the pavement
  hit() {
    const g = this.g, S = g.story, C = g.citizens, o = g.paulOffice, n = this.n; if (!o || !n || this.ejecting || S.cine) return;
    this.ejecting = true; this.sulkT = 180;
    C.say(n, pick(["SECURITY!", "Cheryl, the button! THE BUTTON!", "That's assault! On a LAWYER! SECURITY!"]), 2.6); n.human.express('scared', 4);
    const out = V(Math.sin(o.doorYaw), 0, Math.cos(o.doorYaw)), side = V(out.z, 0, -out.x), door = o.inside.clone();
    const guards = [-1, 1].map(s => { const at = door.clone().addScaledVector(side, s * 0.8); const m = C.spawn('Security', { at, look: { ...randomLook(), female: false, hairStyle: 'buzz', shirt: 0x1a1a1e, longSleeves: true, pants: 0x1a1a1e, build: 1.25 } }); g.weapons.giveModel(m.human, 'bat'); m.security = true; m.state = 'scripted'; m.script = { pos: at.clone(), yaw: yawTo(at, g.player.pos), pose: { pose: 'stand' } }; return m; });
    this.eject = { guards, t: 0, out };
  }
  ejectStep(dt) {
    const g = this.g, S = g.story, C = g.citizens, o = g.paulOffice, n = this.n, E = this.eject; if (!E) return;
    E.t += dt; const me = g.player.pos;
    for (const m of E.guards) { if (!C.list.includes(m)) continue; const p = m.script.pos, d = me.clone().sub(p).setY(0), L = d.length(); if (L > 1.1) p.addScaledVector(d.normalize(), Math.min(L - 1.1, 4.2 * dt)); m.script.yaw = yawTo(p, me); }
    if (!E.said && E.t > 1.2) { E.said = true; C.say(E.guards[0], pick(["Sir. Outside. Now.", "Time to go, pal.", "Let's take a walk."]), 2.4); }
    if (E.t > 3.2 && !S.cine) {
      this.eject = null;
      S.play([S.fadeS(1, 0.4), S.call(() => { if (g.player.car) g.player.exitCar?.(); g.player.respawn(o.door.clone().addScaledVector(E.out, 2.5), o.doorYaw); g.player.hp = Math.max(10, g.player.hp - 12); for (const m of E.guards) if (C.list.includes(m)) C.remove(m); if (n) { n.state = 'post'; n.home = o.desk.clone(); n.homeYaw = o.deskYaw; } }), S.fadeS(0, 0.5)]);
      S.onDone = () => { this.ejecting = false; g.hud.toast("Paul's security walked you out. He's not talking to you for a bit.", '#ff9f43'); };
    }
  }

  // a client, now and then, on something deeply strange
  startClient() {
    const g = this.g, C = g.citizens, o = g.paulOffice, n = this.n; if (!n || this.client) return;
    const c = pick(CASES), at = o.guest.clone();
    const m = C.spawn(c.who, { at, look: { ...randomLook(), female: false, ...c.look } }); m.state = 'scripted'; m.script = { pos: at.clone(), yaw: yawTo(at, o.desk), pose: { pose: 'stand' } }; m.client = true; m.mem.met = true;
    this.client = { m, c, i: 0, t: 2.2 };
  }
  endClient() {
    const g = this.g, C = g.citizens, K = this.client; if (!K) return; this.client = null;
    const m = K.m, o = g.paulOffice; C.say(m, pick(['Thank you, Mr. Badfella!', 'I feel heard.', 'See you in court! Wait, no.']), 2.4);
    m.script.pos.copy(o.inside); setTimeout(() => { if (C.list.includes(m)) C.remove(m); }, 6000);
  }

  update(dt) {
    const g = this.g, n = this.n; if (!n) return;
    if (this.sulkT > 0) this.sulkT -= dt;
    this.ejectStep(dt);
    // he never flees, never puts his hands up, never squares up, never wanders off: it's his office
    if (['flee', 'handsUp', 'angry', 'wander'].includes(n.state)) { n.state = 'post'; n.witness = null; n.home = g.paulOffice.desk.clone(); n.homeYaw = g.paulOffice.deskYaw; }
    const busy = g.story?.cine || g.never?.stage === 'officeTalk';
    const inNow = g.player.pos.distanceTo(g.paulOffice.centre) < 16;
    if (inNow && !this.wasIn && !busy && !this.client && Math.random() < 0.35) this.startClient();
    this.wasIn = inNow;
    const K = this.client;
    if (K) {
      if (!g.citizens.list.includes(K.m) || busy) { this.endClient(); return; }
      if ((K.t -= dt) <= 0) {
        if (K.i >= K.c.lines.length) { this.endClient(); return; }
        const [who, line] = K.c.lines[K.i++]; g.citizens.say(who === 'PAUL' ? n : K.m, line, 3.6); K.t = 3.8;
        if (who === 'PAUL') n.human.express(pick(['happy', 'surprised', 'neutral']), 3);
      }
    }
  }
}
