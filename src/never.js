// Never Call Paul. After Low Profile: Wren calls (E to answer). It cuts to you on the phone in 1E: Dice got
// arrested last night; behind you, the TV's playing Paul Badfella's advert. Then what happened to Dice (a
// flashback, outside the Nightclub). At Paul's office on Town Square you go in as Dice's "dad"; Paul won't take
// the money. So that night you and Wren grab him (a sack over his head, nobody hurts him) and drive him out to the
// Dry, where he works out who you are and switches sides: they want Glass, so give them a Glass. Pay his fee, buy
// a knock-off mask from Lou, and watch from Kit's van as Ernie, in the knock-off, eats a sandwich on the Pier
// bench and gets arrested as Glass. Dice walks. Paul stays in his office: your lawyer now.
import * as THREE from 'three';
import { PAUL_LOOK, drawPaulAd } from './paul.js';
import { randomLook } from './character.js';
import { knockoffMask, wearMask } from './mask.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const FEE = 2500, KNOCK = 40;
const flat = (a, b) => V(b.x - a.x, 0, b.z - a.z).normalize();
const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const chapter = (big, small) => { const ch = document.getElementById('chapter'); ch.innerHTML = `<span>${big}</span><small>${small}</small>`; ch.classList.add('on'); setTimeout(() => ch.classList.remove('on'), 2600); };

export class Never {
  constructor(g) { this.g = g; this.stage = 'none'; this.t = 0; this.paid = false; this.knock = false; this.extras = []; this.tvOn = false; this.tvT = 0; this.tvAcc = 0; this.eWas = false; }

  // ---- what's on the phone
  recommended() {
    const s = this.stage;
    if (s === 'office') return { title: 'Never Call Paul', text: "Dice needs a lawyer. <b>Paul Badfella</b>, Town Square. You're his dad, apparently." };
    if (s === 'grabWait') return { title: 'Never Call Paul', text: "Wren wants to talk to Paul. Properly. Meet him at <b>his house</b>, and bring the mask." };
    if (s === 'pay') return { title: 'Never Call Paul', text: `${this.paid ? '<s>' : ''}Pay Paul his fee ($${FEE.toLocaleString()}) at his office${this.paid ? '</s>' : ''} · ${this.knock ? '<s>' : ''}a cheap gold mask with horns from Lou (Pawn Shop)${this.knock ? '</s>' : ''}` };
    if (s === 'bench') return { title: 'Never Call Paul', text: 'Noon, the <b>Pier</b>. Watch from Kit\'s van with Wren.' };
    return null;
  }

  // ---- Paul himself, at his desk (always: he's open 24/7)
  paulN() {
    const g = this.g, o = g.paulOffice; if (!o) return null;
    if (this.paul && g.citizens.list.includes(this.paul) && this.paul.state !== 'dead') return this.paul;
    const n = this.paul = g.citizens.addWorker({ pos: o.desk.clone(), yaw: o.deskYaw, name: 'Paul Badfella', role: 'lawyer', look: { ...PAUL_LOOK },
      lines: ["Paul Badfella! Attorney at law. Sit, sit.", "You look like a man with a legal problem. Or a man about to have one.", "Never call Paul! But do. Call Paul.", "I'm on the phone. Nobody's on the other end. It's a power move."] });
    n.paul = true; n.mood = 50; return n;
  }
  options(n) {
    const g = this.g, s = this.stage, o = [];
    if (s === 'office') o.push({ id: 'pl:dad', label: "I'm here about my son." });
    if (s === 'officeTalk') o.push({ id: 'pl:bribe', label: 'Make it go away. ($5,000, for the officer)' }, { id: 'pl:advice', label: 'What do you suggest?' });
    if (s === 'pay' && !this.paid) o.push({ id: 'pl:pay', label: g.money >= FEE ? `Here's your fee ($${FEE.toLocaleString()})` : `Your fee: $${FEE.toLocaleString()} (you're short)` });
    if (s === 'done') o.push({ id: 'pl:ernie', label: "How's Ernie?" }, { id: 'pl:clean', label: 'About that money of mine…' });
    o.push(...(g.lucky?.paulOptions() || []));
    o.push({ id: 'pl:chat', label: 'What do you do?' }, { id: 'pl:bye', label: 'Never mind' });
    return o;
  }
  act(n, id) {
    if (!id.startsWith('pl:')) return false;
    const g = this.g, C = g.citizens;
    if (g.lucky?.paulAct(n, id)) return true;
    if (id === 'pl:dad') this.dadScene();
    if (id === 'pl:bribe' || id === 'pl:advice') this.refuseScene(id === 'pl:bribe');
    if (id === 'pl:pay') { if (g.money < FEE) { C.say(n, "Love the enthusiasm. Hate the balance. Come back with the money.", 3.4); return true; } g.money -= FEE; g.sfx?.cash?.(g.player.pos); this.paid = true; C.say(n, pick(["Pleasure doing business! Ernie thanks you. Ernie's mother thanks you.", "Cash! The language of justice."]), 3.4); this.checkReady(); g.saver?.save(); }
    if (id === 'pl:ernie') C.say(n, pick(["Ernie's great. Three meals a day, a gym, a book club. Better life than mine.", "Ernie says hi. Ernie doesn't know your name, which is the beauty of Ernie."]), 4);
    if (id === 'pl:clean') C.say(n, "Your money, a little cleaner? Not today. Soon. I'll call you. Never call me.", 4);
    if (id === 'pl:chat') C.say(n, pick(["Criminal law, civil law, family law, maritime law, a little bit of space law. Whatever pays.", "I make problems go away. Not like that. Mostly not like that.", "I went to law school. Online. It counts."]), 4);
    if (id === 'pl:bye') C.say(n, "Never call Paul! But do.", 2.4);
    return true;
  }
  // Lou's knock-off
  lou() { return this.stage === 'pay' && !this.knock; }
  buyKnock(n) {
    const g = this.g, C = g.citizens;
    if (g.money < KNOCK) { C.say(n, `Forty bucks. Even the fake one's forty.`, 3); return; }
    g.money -= KNOCK; this.knock = true; g.sfx?.cash?.(g.player.pos);
    C.say(n, "I KNEW you'd be back. Plastic. Spray-painted. The horns are off a viking hat. Don't tell anyone where you got it.", 5);
    g.hud.toast('A cheap gold mask with horns (for Ernie)', '#ffd23f'); this.checkReady(); g.saver?.save();
  }
  checkReady() {
    const g = this.g; if (this.stage !== 'pay' || !this.paid || !this.knock) return;
    this.stage = 'bench';
    setTimeout(() => g.wren?.text('Paul', "ernie's in. noon, the pier, the bench by the railings. dice wears a wire, ernie sits down, the cops do the rest. bring popcorn. NOT to the bench"), 2500);
    g.story.objective('<b>Never Call Paul</b> · the <b>Pier</b>: watch from Kit\'s van with Wren'); g.story.waypoint(this.vantage());
  }

  // ---- the call
  ring() {
    const g = this.g; this.stage = 'ringing'; this.ringT = 0;
    g.hud.toast('📞 Wren is calling. Press E to answer', '#5fd0ff');
  }
  answer() {
    const g = this.g, S = g.story, pl = g.player, A = g.apt;
    this.stage = 'room';
    if (pl.car) pl.exitCar?.();
    S.fade(1);
    const tv = new THREE.Vector3(); A.tvScreen?.getWorldPosition(tv);
    const P = A.room1E.clone(), away = flat(tv, P), yaw = Math.atan2(away.x, away.z);
    pl.respawn(P, yaw); pl.scripted = { pos: P.clone(), yaw, pose: { pose: 'stand', phone: true } };
    this.tvOn = true; this.tvT = 0; this.jingle();
    const side = V(away.z, 0, -away.x);
    const cam = P.clone().addScaledVector(away, 1.5).addScaledVector(side, 0.55).setY(P.y + 1.62), look = P.clone().lerp(tv, 0.55).setY(P.y + 1.25);
    const tvN = V(1, 0, 0); // (the screen faces +x)
    const tvCam = tv.clone().addScaledVector(tvN, 0.95).add(V(0, 0.08, 0.12));
    S.play([
      S.fadeS(0, 0.5),
      S.shotS(cam, cam.clone().addScaledVector(away, 0.25), look, look, 12, 46),
      S.line('WREN', "Dice got picked up. Last night. Outside the club.", 3),
      S.line('YOU', '<i>Picked up.</i>', 1.6),
      S.line('WREN', "ARRESTED. He sold to a cop. The guy asked if he was a cop, Dice said 'you have to tell me if you are', and the guy said no.", 5),
      S.line('WREN', "They've got him at the station. They're asking him about Glass.", 3.4),
      S.shotS(tvCam, tvCam.clone().add(V(-0.25, 0, 0)), tv, tv, 9, 30),
      S.line('PAUL (TV)', "Arrested? Accused? Accidentally did a crime?", 2.8),
      S.line('PAUL (TV)', "NEVER call Paul Badfella!*", 2.2),
      S.line('PAUL (TV)', "*Okay, do call Paul. He's really good. 505-PAUL-BADFELLA! Don't gamble your freedom!", 4.2),
      S.shotS(cam, null, look, null, 4, 46),
      S.line('WREN', "…Are you watching TV right now?", 2.2),
      S.line('YOU', "<i>I'm on my way.</i>", 1.8),
      S.fadeS(1, 0.6),
    ]);
    S.onDone = () => { pl.scripted = null; this.flashback(); };
  }
  // what happened: last night, outside the Nightclub
  flashback() {
    const g = this.g, S = g.story, C = g.citizens, P = g.places['the nightclub']?.pos || g.player.pos;
    this.stage = 'flash';
    const d = P.clone().add(V(-3, 0, -2.5)).setY(0.05), dice = g.crew.spawn('dice', d, 0);
    const buyerAt = d.clone().add(V(1.3, 0, 0.6)), buyer = C.spawn('Buyer', { at: buyerAt, look: { ...randomLook(), female: false, hairStyle: 'cap', shirt: 0x4a4a52, longSleeves: true } });
    this.extras = [buyer];
    const put = (n, at, yaw, pose = { pose: 'stand' }) => { n.human.resetPose(); n.state = 'scripted'; n.script = { pos: at.clone(), yaw, pose }; };
    put(dice, d, yawTo(d, buyerAt)); put(buyer, buyerAt, yawTo(buyerAt, d));
    const c1 = d.clone().add(V(-7, 0, 5)), c2 = d.clone().add(V(6, 0, 6));
    const cops = [g.police.makeCop(c1), g.police.makeCop(c2)]; this.extras.push(...cops);
    cops.forEach((n, i) => put(n, i ? c2 : c1, yawTo(i ? c2 : c1, d)));
    const mid = d.clone().lerp(buyerAt, 0.5), side = V(0.6, 0, -0.8).normalize();
    const cam = mid.clone().addScaledVector(side, 3.6).setY(1.7), wide = mid.clone().add(V(4, 3, 9));
    S.play([
      S.call(() => chapter('Last night', 'Outside the Nightclub')),
      S.shotS(cam, cam.clone().addScaledVector(side, -0.4), mid.clone().setY(1.4), null, 10, 42),
      S.fadeS(0, 0.8),
      S.line('DICE', "Okay. Okay okay. Quick question. You're not a cop, right?", 3),
      S.line('DICE', "'Cause you have to tell me if you're a cop. That's the law. I looked it up.", 3.4),
      S.line('BUYER', "I'm not a cop.", 1.8),
      S.line('DICE', "Sick. Okay. Forty.", 1.8),
      S.call(() => { buyer.human.express('angry', 4); }),
      S.line('BUYER', "Halyard PD. You're under arrest.", 2.2),
      S.call(() => { put(dice, d, yawTo(d, buyerAt), { pose: 'stand', handsUp: true }); dice.human.express('surprised', 5); cops.forEach((n, i) => put(n, d.clone().add(V(i ? 1.1 : -1.1, 0, 1.0)), yawTo(d.clone().add(V(i ? 1.1 : -1.1, 0, 1.0)), d))); }),
      S.shotS(wide, null, d.clone().setY(1.2), null, 6, 50),
      S.line('DICE', "You SAID! You said you weren't! Is that even legal??", 3.2),
      S.line('BUYER', 'Yes.', 1.2),
      S.line('DICE', "…Is this about the jet skis?", 2.4),
      S.fadeS(1, 0.8),
    ]);
    S.onDone = () => {
      for (const n of this.extras) if (C.list.includes(n)) C.remove(n); this.extras = [];
      g.crew.jail('dice');
      this.stage = 'office'; this.paulN();
      S.fade(0); pl_free(g);
      S.objective("<b>Never Call Paul</b> · Dice needs a lawyer: <b>Paul Badfella</b>, on Town Square"); S.waypoint(g.paulOffice.door);
      g.hud.toast('📱 RECOMMENDED · Never Call Paul', '#ffd23f'); g.saver?.save();
    };
  }

  // ---- in his office, as Dice's "dad"
  officeShots() {
    const g = this.g, o = g.paulOffice, pl = g.player, n = this.paulN();
    const me = o.client.clone(), pp = o.desk.clone(), f = flat(me, pp), side = V(f.z, 0, -f.x);
    pl.respawn(me, o.clientYaw); pl.scripted = { pos: me.clone(), yaw: o.clientYaw, pose: { pose: 'stand' } };
    n.human.resetPose(); n.state = 'scripted'; n.script = { pos: pp.clone(), yaw: o.deskYaw, pose: { pose: 'stand' } };
    return {
      n, me, pp,
      onPaul: [me.clone().addScaledVector(f, -0.6).addScaledVector(side, 0.55).setY(me.y + 1.7), pp.clone().setY(pp.y + 1.55)],
      onMe: [pp.clone().addScaledVector(f, 0.5).addScaledVector(side, -0.5).setY(pp.y + 1.7), me.clone().setY(me.y + 1.6)],
      wide: [me.clone().addScaledVector(side, 3).addScaledVector(f, 1.2).setY(me.y + 2.1), me.clone().lerp(pp, 0.5).setY(1.3)],
    };
  }
  dadScene() {
    const g = this.g, S = g.story, sh = this.officeShots(), n = sh.n;
    if (g.mask?.on) g.mask.toggle();
    const point = (on) => S.call(() => { n.script.pose = on ? { pose: 'stand', point: { up: 0.05 } } : { pose: 'stand' }; n.human.pointer(on); });
    S.play([
      S.shotS(sh.wide[0], null, sh.wide[1], null, 6, 46),
      S.line('PAUL', "Paul Badfella! Sit, sit. What are we looking at? Murder? Fraud? A light murder?", 3.8),
      S.shotS(sh.onMe[0], null, sh.onMe[1], null, 3, 38),
      S.line('YOU', '<i>My son. Dice. They picked him up last night.</i>', 2.8),
      S.shotS(sh.onPaul[0], null, sh.onPaul[1], null, 9, 38),
      S.call(() => n.human.express('surprised', 3)),
      S.line('PAUL', '…Your son.', 1.8),
      S.line('PAUL', "You're like five years older than him.", 2.4),
      S.shotS(sh.onMe[0], null, sh.onMe[1], null, 2.4, 38),
      S.line('YOU', '<i>I moisturise.</i>', 1.8),
      S.shotS(sh.onPaul[0], null, sh.onPaul[1], null, 12, 38),
      point(true),
      S.line('PAUL', "Love that. LOVE that. Okay, Dad. Intent to supply, outside a nightclub, to a cop who said he wasn't a cop.", 5),
      point(false),
      S.line('PAUL', "Bad news: that's legal. Good news: they don't want him. They want his supplier. Some guy called… Glass?", 5),
    ]);
    S.onDone = () => { this.stage = 'officeTalk'; g.player.scripted = null; n.state = 'post'; n.script = null; setTimeout(() => g.wheel?.show(n), 300); };
  }
  refuseScene(bribe) {
    const g = this.g, S = g.story, sh = this.officeShots(), n = sh.n;
    S.play([
      S.shotS(sh.onPaul[0], null, sh.onPaul[1], null, 10, 38),
      ...(bribe ? [
        S.call(() => n.human.express('surprised', 4)),
        S.line('PAUL', 'Whoa. Whoa whoa whoa. Is that money? For a police officer?', 3.2),
        S.line('PAUL', "Put that away. I'm an officer of the court, Dad. I have principles. Several.", 4),
      ] : [S.line('PAUL', "Honestly? Easiest case I'll have all week.", 2.6)]),
      S.line('PAUL', "Here's my advice, and it's free, because you're not paying me: Dice gives them Glass. Dice goes home.", 5),
      S.shotS(sh.onMe[0], null, sh.onMe[1], null, 3, 38),
      S.line('YOU', "<i>He can't do that.</i>", 2),
      S.shotS(sh.wide[0], null, sh.wide[1], null, 6, 46),
      S.line('PAUL', "Then Dice does five years and gets VERY good at basketball. Cheryl! Show Dad out.", 4),
      S.line('CHERYL', "I'm not your secretary.", 2),
      S.fadeS(1, 0.5),
    ]);
    S.onDone = () => {
      const o = g.paulOffice; g.player.scripted = null; n.state = 'post'; n.script = null; n.home = o.desk.clone(); n.homeYaw = o.deskYaw;
      g.player.respawn(o.door.clone().add(V(2, 0, 0)), o.doorYaw); S.fade(0);
      this.stage = 'grabWait'; S.objective(null); S.waypoint(null);
      setTimeout(() => g.wren?.text('Wren', "he said WHAT. dice can't give them glass. dice knows where i LIVE. come to mine. bring the mask. we're going to talk to paul. properly"), 3500);
      setTimeout(() => { if (this.stage === 'grabWait') { S.objective('<b>Never Call Paul</b> · meet Wren at <b>his house</b> (bring the mask)'); S.waypoint(g.wrenHouse.door); } }, 4000);
      g.saver?.save();
    };
  }

  // ---- that night: the grab, and the Dry
  grab() {
    const g = this.g, S = g.story, C = g.citizens, pl = g.player, W = S.wren, o = g.paulOffice, n = this.paulN(), c = g.camper;
    this.stage = 'grab'; S.objective(null); S.waypoint(null);
    if (pl.car) pl.exitCar?.();
    const put = (m, at, yaw, pose = { pose: 'stand' }) => { m.human.resetPose(); m.state = 'scripted'; m.script = { pos: at.clone(), yaw, pose }; };
    // outside his office: him on the phone, walking out; the van at the kerb; you and Wren
    const door = o.door.clone(), out = V(Math.sin(o.doorYaw), 0, Math.cos(o.doorYaw)), side = V(out.z, 0, -out.x);
    const kerb = door.clone().addScaledVector(out, 5.2).addScaledVector(side, 6);
    const vanYaw = Math.atan2(side.x, side.z) + Math.PI;
    const parkVan = (at, yaw) => { if (!c || c.wrecked) return; const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw); c.body.setTranslation({ x: at.x, y: 0.8, z: at.z }, true); c.body.setRotation(q, true); c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); c.body.setAngvel({ x: 0, y: 0, z: 0 }, true); };
    const pStart = door.clone().addScaledVector(out, 0.6), pEnd = door.clone().addScaledVector(out, 3.2).addScaledVector(side, 2.2);
    const me = pEnd.clone().addScaledVector(side, 1.4).addScaledVector(out, 0.6), wr = pEnd.clone().addScaledVector(side, -1.2).addScaledVector(out, -0.3);
    const cam1 = door.clone().addScaledVector(out, 9).addScaledVector(side, -4).setY(2.4), look1 = pEnd.clone().setY(1.3);
    // the Dry: off the highway, a hole, a mound, a shovel
    const dry = V(64, 0, -1290); dry.y = g.desert.groundY(dry.x, dry.z);
    const hole = new THREE.Group(); hole.position.copy(dry).add(V(2.4, 0.02, -1.2)); g.scene.add(hole); hole.userData.dynamic = true;
    { const pit = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 2.0), new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 1 })); hole.add(pit);
      const mound = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xa8643a, roughness: 1 })); mound.scale.set(1, 0.45, 1.3); mound.position.set(1.3, 0, 0); hole.add(mound);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x8a6a42 })); shaft.position.set(1.1, 0.7, 0.9); shaft.rotation.z = 0.25; hole.add(shaft);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.02), new THREE.MeshStandardMaterial({ color: 0x6a6e74, metalness: 0.7 })); blade.position.set(1.25, 0.12, 0.9); hole.add(blade);
      hole.traverse(m => { m.userData.dynamic = true; }); }
    this.hole = hole;
    const dP = dry.clone(), dMe = dry.clone().add(V(-0.4, 0, 2.6)), dWr = dry.clone().add(V(2.6, 0, 0.4));
    const dCam = dry.clone().add(V(-3.6, 1.6, 4.2)), dCamP = dMe.clone().add(V(0.3, 1.66, -0.9)), dCamMe = dP.clone().add(V(0.2, 1.66, 1.0));
    const wasMask = g.mask?.on;
    S.play([
      S.fadeS(1, 0.5),
      S.call(() => {
        chapter('That night', 'Town Square');
        S.fade(1);
        parkVan(kerb, vanYaw);
        put(n, pStart, o.doorYaw, { pose: 'stand', phone: true });
        if (W) put(W, wr, yawTo(wr, pEnd));
        if (g.mask?.owned && !g.mask.on) g.mask.toggle();
        pl.respawn(me, yawTo(me, pEnd)); pl.scripted = { pos: me.clone(), yaw: yawTo(me, pEnd), pose: { pose: 'stand' } };
      }),
      S.shotS(cam1, cam1.clone().addScaledVector(side, 0.8), look1, null, 9, 44),
      S.fadeS(0, 0.6),
      S.call(() => { n.script.pos.copy(pEnd); n.script.yaw = yawTo(pStart, pEnd); }),
      S.line('PAUL', "No, YOU hold. I'm Paul Badfella. I don't hold. I make people hold.", 3.4),
      S.line('WREN', 'Now.', 0.9),
      S.call(() => { n.human.addBag(); n.script.pose = { pose: 'stand', handsUp: true }; }),
      S.line('PAUL', "Hey! HEY! Is this a carjacking? I don't have a car with me! I validate parking!", 3.4),
      S.fadeS(1, 0.6),
      S.call(() => {
        chapter('The Dry', 'An hour later');
        parkVan(dry.clone().add(V(-4, 0, -3)), 0.4);
        n.script.pos.copy(dP); n.script.yaw = yawTo(dP, dMe); n.script.pose = { pose: 'stand' };
        if (W) { W.script.pos.copy(dWr); W.script.yaw = yawTo(dWr, dP); }
        pl.respawn(dMe, yawTo(dMe, dP)); pl.scripted = { pos: dMe.clone(), yaw: yawTo(dMe, dP), pose: { pose: 'stand' } };
      }),
      S.shotS(dCam, dCam.clone().add(V(0.5, 0, 0)), dP.clone().setY(dP.y + 1.2), null, 8, 44),
      S.fadeS(0, 0.8),
      S.call(() => { n.human.removeBag(); n.human.express('scared', 6); }),
      S.line('PAUL', "Okay! Okay. Whoever you are, great news: I'm a lawyer, and I am VERY good at not seeing faces.", 4.2),
      S.line('PAUL', "…Is that a hole? Why is there a hole? That's a very rectangular hole.", 3.4),
      S.line('WREN', "It's for a cactus.", 1.8),
      S.line('PAUL', "It's NOT for a cactus!", 2),
      S.shotS(dCamMe, null, dMe.clone().setY(dMe.y + 1.6), null, 4, 36),
      S.line('YOU', "<i>Dice. You're going to make it go away.</i>", 2.6),
      S.shotS(dCamP, null, dP.clone().setY(dP.y + 1.55), null, 12, 36),
      S.line('PAUL', "I TOLD Dad, I don't bribe— wait.", 2.4),
      S.call(() => n.human.express('surprised', 6)),
      S.line('PAUL', "Gold face. Horns. …Oh. Oh, you're GLASS.", 3),
      S.line('PAUL', "Okay. This is a different conversation. This is a CLIENT conversation. I love a client conversation.", 4.4),
      S.call(() => { n.script.pose = { pose: 'stand', pitch: true }; n.human.express('happy', 8); }),
      S.line('PAUL', "Here's the thing. I don't bribe cops. I'm not an animal. But they don't want Dice. They want Glass. So… we give them a Glass.", 5.4),
      S.shotS(dCamMe, null, dMe.clone().setY(dMe.y + 1.6), null, 3, 36),
      S.line('YOU', '<i>Excuse me?</i>', 1.6),
      S.shotS(dCam, null, dP.clone().setY(dP.y + 1.2), null, 14, 44),
      S.line('PAUL', "Not YOU. A Glass. I've got a guy. Ernie. Ernie will do eighteen months for anything with a dental plan.", 4.6),
      S.line('PAUL', "He needs a gold mask with horns, a park bench and my fee. Twenty-five hundred. Special price for kidnappers.", 4.6),
      S.line('WREN', "We're paying HIM? We KIDNAPPED him.", 2.4),
      S.line('PAUL', "And I'm choosing to see this as a consultation. Office, tomorrow, bring cash. Can somebody drive me home? It's a school night.", 5),
      S.fadeS(1, 0.6),
    ]);
    S.onDone = () => {
      this.hole?.removeFromParent(); this.hole = null;
      pl.scripted = null; if (g.mask?.on && !wasMask) g.mask.toggle();
      n.state = 'post'; n.script = null; n.home = o.desk.clone(); n.homeYaw = o.deskYaw; n.human.resetPose(); n.body.setTranslation({ x: o.desk.x, y: o.desk.y + 1, z: o.desk.z }, true);
      if (W) { W.script = null; S.wrenHome(true); }
      g.parkVanAtWren?.(); pl.respawn(g.wrenHouse.door.clone().add(V(0, 0, 0)).addScaledVector(V(Math.sin(g.wrenHouse.doorYaw), 0, Math.cos(g.wrenHouse.doorYaw)), 4), g.wrenHouse.doorYaw);
      S.fade(0); this.stage = 'pay';
      S.objective(`<b>Never Call Paul</b> · pay Paul his fee ($${FEE.toLocaleString()}), and get a cheap gold mask with horns from Lou (Pawn Shop)`); S.waypoint(o.door);
      g.saver?.save();
    };
  }

  // ---- noon, the Pier: Ernie and his sandwich
  vantage() { const P = this.g.places.pier?.pos || V(); return P.clone().add(V(-18, 0, -14)).setY(0.05); }
  bench() {
    const g = this.g, S = g.story, C = g.citizens, pl = g.player, W = S.wren, c = g.camper, P = g.places.pier.pos;
    this.stage = 'benchScene'; S.objective(null); S.waypoint(null);
    if (pl.car) pl.exitCar?.();
    const put = (m, at, yaw, pose = { pose: 'stand' }) => { m.human.resetPose(); m.state = 'scripted'; m.script = { pos: at.clone(), yaw, pose }; };
    const bench = P.clone().add(V(3, 0, -2)).setY(0.05), v = this.vantage();
    const toB = flat(v, bench), side = V(toB.z, 0, -toB.x);
    const benchY = yawTo(bench, v); // (the bench faces the van, more or less)
    // the van, with you and Wren in it (you're seen through the windscreen... or just beside it)
    if (c && !c.wrecked) { const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.atan2(toB.x, toB.z)); c.body.setTranslation({ x: v.x, y: 0.8, z: v.z }, true); c.body.setRotation(q, true); c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
    const me = v.clone().addScaledVector(side, 1.8).addScaledVector(toB, 1.5), wr = v.clone().addScaledVector(side, 2.6).addScaledVector(toB, 0.6);
    pl.respawn(me, yawTo(me, bench)); pl.scripted = { pos: me.clone(), yaw: yawTo(me, bench), pose: { pose: 'stand' } };
    if (W) put(W, wr, yawTo(wr, bench));
    // Dice on the bench (wired), two plain-clothes cops pretending to fish, one in uniform round the corner; Ernie, coming
    g.crew.members.dice = g.crew.members.dice || { stock: [], sellT: 60 };
    // a bench (wood slats, iron legs), facing the van
    const bq = new THREE.Group(); bq.position.copy(bench); bq.rotation.y = benchY; g.scene.add(bq); this.benchMesh = bq;
    { const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.9 }), iron = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.5 });
      for (let i = 0; i < 3; i++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.13), wood); sl.position.set(0, 0.45, -0.18 + i * 0.16); bq.add(sl); }
      for (let i = 0; i < 2; i++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.04), wood); sl.position.set(0, 0.65 + i * 0.16, -0.3); sl.rotation.x = -0.15; bq.add(sl); }
      for (const x of [-0.95, 0.95]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.5), iron); lg.position.set(x, 0.225, -0.05); bq.add(lg); }
      bq.traverse(m => { m.userData.dynamic = true; if (m.isMesh) m.castShadow = true; }); }
    const seat = (u) => bench.clone().addScaledVector(side, u).add(V(0, -0.5, 0)); // (sat: the root goes down so the hips are on the slats)
    const dice = g.crew.spawn('dice', bench.clone().addScaledVector(side, -0.5), benchY); g.crew.members.dice.jailed = true;
    put(dice, seat(-0.55), benchY, { pose: 'stairsit' });
    const eStart = bench.clone().addScaledVector(side, 14), eAt = bench.clone().addScaledVector(side, 0.55);
    const ernie = C.spawn('Ernie', { at: eStart, look: { ...randomLook(), female: false, build: 1.2, hairStyle: 'bald', shirt: 0x6a7a3a, pants: 0x4a3b2a } });
    wearMask(ernie.human, knockoffMask()); this.sandwich(ernie.human);
    put(ernie, eStart, yawTo(eStart, eAt));
    const f1 = bench.clone().addScaledVector(toB, 6).addScaledVector(side, -4), f2 = bench.clone().addScaledVector(toB, 5).addScaledVector(side, 5);
    const cop1 = C.spawn('Fisherman', { at: f1, look: { ...randomLook(), female: false, hairStyle: 'cap', shirt: 0x3a5a7a } }), cop2 = C.spawn('Jogger', { at: f2, look: { ...randomLook(), female: false, shirt: 0xd8d8d8 } });
    const cop3 = g.police.makeCop(bench.clone().addScaledVector(side, -12));
    put(cop1, f1, yawTo(f1, bench) + 1.2); put(cop2, f2, yawTo(f2, bench) - 1.4); put(cop3, bench.clone().addScaledVector(side, -12), yawTo(bench.clone().addScaledVector(side, -12), bench));
    this.extras = [ernie, cop1, cop2, cop3];
    const camVan = v.clone().addScaledVector(toB, 2.4).addScaledVector(side, 1.0).setY(1.9), lookB = bench.clone().setY(1.0);
    const camB = bench.clone().addScaledVector(toB, -2.8).addScaledVector(side, 1.2).setY(1.25), camWide = bench.clone().addScaledVector(toB, -7).addScaledVector(side, -4).setY(3);
    const camUs = me.clone().lerp(wr, 0.5).addScaledVector(toB, 2.6).setY(1.7);
    S.play([
      S.fadeS(1, 0.4),
      S.call(() => { chapter('Noon', 'The Pier'); S.fade(1); }),
      S.shotS(camVan, camVan.clone().addScaledVector(toB, 0.6), lookB, null, 8, 34),
      S.fadeS(0, 0.8),
      S.line('WREN', "There. Dice. On the bench. He looks like he's going to throw up.", 3.2),
      S.shotS(camB, null, bench.clone().setY(0.85), null, 5, 40),
      S.line('DICE', "Testing. Testing. Is this on? Hi guys. Hi. Hello.", 3),
      S.call(() => { ernie.script.pos.copy(seat(0.55)); ernie.script.yaw = benchY; ernie.script.pose = { pose: 'stairsit' }; }),
      S.shotS(camWide, null, bench.clone().setY(1.0), null, 7, 46),
      S.line('DICE', "…That's him. That's Glass. The gold face. That's definitely him.", 3.4),
      S.line('COP (RADIO)', 'Wait for the exchange.', 2),
      S.shotS(camB, null, eAt.clone().setY(0.85), null, 6, 38),
      S.line('ERNIE', '…', 1.6),
      S.line('…', '<i>(Ernie unwraps a sandwich. He takes a bite. He chews. He takes another bite.)</i>', 4),
      S.line('DICE', "He's eating a sandwich. Can you grab him now? Guys? He's just eating.", 3.4),
      S.line('COP (RADIO)', 'Let him finish his sandwich.', 2.2),
      S.line('ERNIE', 'This is a really good sandwich.', 2.4),
      S.shotS(camWide, null, bench.clone().setY(1.0), null, 8, 46),
      S.call(() => { put(cop1, eAt.clone().addScaledVector(toB, 1.1), yawTo(eAt.clone().addScaledVector(toB, 1.1), eAt)); put(cop2, eAt.clone().addScaledVector(side, 1.2), yawTo(eAt.clone().addScaledVector(side, 1.2), eAt)); put(cop3, eAt.clone().addScaledVector(toB, -1.2), yawTo(eAt.clone().addScaledVector(toB, -1.2), eAt)); }),
      S.line('COP', 'Halyard PD! Hands where we can see them!', 2.4),
      S.call(() => { ernie.script.pos.copy(eAt); ernie.script.pose = { pose: 'stand', handsUp: true }; dice.script.pos.copy(bench.clone().addScaledVector(side, -1.4)); dice.script.pose = { pose: 'stand' }; }),
      S.line('ERNIE', "Glass! That's me! I'm Glass! Big fan of myself!", 3.2),
      S.line('DICE', "…Can I go? Am I going? I'm going.", 2.4),
      S.shotS(camUs, null, me.clone().lerp(wr, 0.5).setY(1.55), null, 9, 40),
      S.line('WREN', '…We paid a man to go to prison as you.', 2.8),
      S.line('YOU', '<i>We paid a lawyer.</i>', 1.8),
      S.line('WREN', "That's worse.", 1.6),
      S.fadeS(1, 0.6),
    ]);
    S.onDone = () => this.finish();
  }
  finish() {
    const g = this.g, S = g.story, C = g.citizens, pl = g.player, W = S.wren;
    this.benchMesh?.removeFromParent(); this.benchMesh = null;
    for (const n of this.extras) if (C.list.includes(n)) C.remove(n); this.extras = [];
    pl.scripted = null; if (W) { W.script = null; S.wrenHome(true); }
    g.crew.free('dice'); g.parkVanAtWren?.();
    S.fade(0); this.stage = 'done'; S.objective(null); S.waypoint(null);
    setTimeout(() => g.hud.toast('Job done: Never Call Paul. Dice is back on his corner.', '#ffb27a'), 1000);
    setTimeout(() => g.wren?.text('Paul', "ernie says hi. well, he doesn't, he's in a cell. pleasure doing business. p.s. if your money ever needs to look a little cleaner, you know where i am. NEVER call paul"), 6000);
    g.saver?.save();
  }

  // a sandwich in someone's right hand (it hangs from the wrist bone, in its bind frame)
  sandwich(h) {
    const sk = h.body?.skeleton, i = sk ? sk.bones.indexOf(h.b.wristR) : -1, x = -(h.shX || 0.2), G = new THREE.Group();
    const bread = new THREE.MeshStandardMaterial({ color: 0xe0b878, roughness: 0.9 }), fill = new THREE.MeshStandardMaterial({ color: 0x6aa83a, roughness: 0.8 }), meat = new THREE.MeshStandardMaterial({ color: 0xc8605a, roughness: 0.8 });
    for (const [y, m, t] of [[0, bread, 0.03], [0.026, fill, 0.012], [0.04, meat, 0.016], [0.06, bread, 0.03]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.13, t, 0.11), m); b.position.y = y; G.add(b); }
    G.rotation.z = Math.PI / 2; G.position.set(0, -0.06, 0.04);
    const holder = new THREE.Group(); holder.add(G);
    if (i >= 0) sk.boneInverses[i].clone().multiply(new THREE.Matrix4().makeTranslation(x, 0.79, 0.02)).decompose(holder.position, holder.quaternion, holder.scale);
    h.b.wristR.add(holder);
  }
  // ---- the cheesy jingle (four bars on a square wave) and the TV
  jingle() {
    const ctx = this.g.sfx?.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + 0.05, notes = [523, 659, 784, 1047, 988, 784, 659, 784, 523, 659, 784, 1175, 1047];
    notes.forEach((f, i) => { const o = ctx.createOscillator(), gn = ctx.createGain(); o.type = 'square'; o.frequency.value = f; const t = t0 + i * 0.16 + (i > 7 ? 0.3 : 0); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.05, t + 0.02); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.15); o.connect(gn); gn.connect(this.g.sfx.out || ctx.destination); o.start(t); o.stop(t + 0.2); });
  }

  update(dt) {
    const g = this.g;
    // the TV in 1E plays his advert, once the call's come
    if (this.tvOn && g.apt?.tvC) { this.tvT += dt; if ((this.tvAcc += dt) > 1 / 15) { this.tvAcc = 0; drawPaulAd(g.apt.tvC.getContext('2d'), g.apt.tvC.width, g.apt.tvC.height, this.tvT); g.apt.tvTex.needsUpdate = true; } }
    if (g.paulOffice && (!this.pt || (this.pt -= dt) <= 0)) { this.pt = 5; this.paulN(); }
    const S = g.story; if (!S || S.phase !== 'free') return;
    if (this.stage === 'none' && g.crew?.stage === 'done') { this.stage = 'waiting'; this.waitT = 150; this.day0 = g.missions?.day ?? 1; }
    if (this.stage === 'waiting' && !S.cine && !g.police.stars && !g.drugs.cook && (((this.waitT -= dt) <= 0) || (g.missions?.day ?? 1) > this.day0)) this.ring();
    if (this.stage === 'ringing') {
      this.ringT = (this.ringT || 0) + dt;
      if (Math.floor(this.ringT * 2) !== Math.floor((this.ringT - dt) * 2) && Math.floor(this.ringT * 2) % 3 !== 2) g.sfx?.burst?.({ at: g.player.pos, vol: 0.25, dur: 0.12, freq: 1500, q: 8, type: 'bandpass' });
      const e = g.keys.has('KeyE'); if (e && !this.eWas && !S.cine && !g.police.stars) this.answer(); this.eWas = e;
      if (this.ringT > 25) { this.stage = 'waiting'; this.waitT = 60; g.hud.toast('Missed call: Wren', '#ff9f43'); }
    }
    if (this.stage === 'grabWait' && !S.cine && !g.police.stars && g.wrenHouse && g.player.pos.distanceTo(g.wrenHouse.door) < 14 && S.wren && !S.wren.following) {
      if (!g.mask?.owned) return; this.grab();
    }
    if (this.stage === 'bench' && !S.cine && !g.police.stars && g.player.pos.distanceTo(this.vantage()) < 30) this.bench();
  }

  state() {
    const map = { ringing: 'waiting', room: 'waiting', flash: 'waiting', officeTalk: 'office', grab: 'grabWait', benchScene: 'bench' };
    return { stage: map[this.stage] || this.stage, paid: this.paid, knock: this.knock, tv: this.tvOn };
  }
  restore(s) {
    if (!s) return; const g = this.g, S = g.story;
    this.stage = s.stage || 'none'; this.paid = !!s.paid; this.knock = !!s.knock; this.tvOn = !!s.tv;
    if (this.stage === 'waiting') { this.waitT = 40; this.day0 = g.missions?.day ?? 1; }
    if (this.stage === 'office') { g.crew?.jail('dice'); S.objective("<b>Never Call Paul</b> · Dice needs a lawyer: <b>Paul Badfella</b>, on Town Square"); S.waypoint(g.paulOffice.door); }
    if (this.stage === 'grabWait') { g.crew?.jail('dice'); S.objective('<b>Never Call Paul</b> · meet Wren at <b>his house</b> (bring the mask)'); S.waypoint(g.wrenHouse.door); }
    if (this.stage === 'pay') { g.crew?.jail('dice'); S.objective(`<b>Never Call Paul</b> · pay Paul his fee ($${FEE.toLocaleString()}), and get a cheap gold mask with horns from Lou (Pawn Shop)`); S.waypoint(g.paulOffice.door); }
    if (this.stage === 'bench') { g.crew?.jail('dice'); this.stage = 'pay'; this.checkReady(); }
  }
}
// (the player, out of any scripted pose)
function pl_free(g) { g.player.scripted = null; }
