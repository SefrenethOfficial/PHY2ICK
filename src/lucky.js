// Lucky Royce: Royce's little brother, just out of prison (Paul was his lawyer; Paul is scared of him). Buzz cut,
// sunglasses at all hours, a tank top, a gold chain, an energy drink in his hand. Loud, warm, and then not.
// Part one, Scrapyard: Paul begs you to meet him at Rusty's lot. Bring at least four bags. Lucky loves the blue,
// tells you his brother "got sloppy" (you're the nobody who shot him), slams a scrap car door into his own guy for
// calling it "pretty good", buys the lot at well over street price, and decides you're family now.
import * as THREE from 'three';
import { randomLook } from './character.js';
import { foodMesh } from './food.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const g_money = (g) => g.money;
const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const MIN = 4;
export const LUCKY_LOOK = { female: false, height: 1.78, build: 1.12, skin: 0xd8a888, hair: 0x2a1a10, hairStyle: 'buzz', shirt: 0xf2f2f2, longSleeves: false, pants: 0x7a1a2a, shoes: 0xf2f2f2, shades: true, chain: true };

export class Lucky {
  constructor(g) { this.g = g; this.stage = 'none'; this.crew = []; this.pops = []; this.plan = null; }

  recommended() {
    if (this.stage === 'ears') return { title: 'Ears Open', text: `Lucky won't leave you alone. (${this.pops.length}/3)` };
    if (this.stage === 'planWait') return { title: 'Ears Open', text: 'Wren wants a plan. Go to <b>his house</b>.' };
    if (this.stage === 'plan') return { title: 'Ears Open', text: { gun: 'The gun: buy a <b>revolver</b> from a street dealer.', parole: 'The parole: pay <b>Paul</b> $1,000 to make a call.', vanish: 'Disappear: drive <b>Kit\'s van</b> out into the Dry.' }[this.plan] || 'Pick a plan with Wren (hold E on him).' };
    if (this.stage === 'meet') return { title: 'Scrapyard', text: `Meet <b>Lucky Royce</b> at <b>Rusty's lot</b>. Bring at least ${MIN} bags. (Paul says please. Paul says it twice.)` };
    return null;
  }
  lot() { const L = this.g.chopLot; return L ? V((L.x0 + L.x1) / 2, 0.05, (L.z0 + L.z1) / 2) : this.g.places["rusty's"]?.pos.clone() || V(); }

  call() {
    const g = this.g; this.stage = 'meet';
    g.wren?.text('Paul', "ok. don't panic. a client of mine just got out. LUCKY ROYCE. royce's little brother. he wants to meet 'the blue guy'. i said i don't know you. he didn't believe me. he's at rusty's lot. bring product. please go. PLEASE go");
    setTimeout(() => g.wren?.text('Paul', 'and do NOT mention his brother'), 2500);
    g.hud.toast('📱 Something new on your phone (P): RECOMMENDED · Scrapyard', '#ffd23f');
    this.spawn(); g.story.waypoint(this.lot()); g.saver?.save();
  }
  // Lucky and his two, out on the lot, by a heap of scrap (and a loose car door)
  spawn() {
    const g = this.g, C = g.citizens; this.despawn();
    const c = this.lot(), at = (dx, dz) => c.clone().add(V(dx, 0, dz));
    const L = this.lucky = C.addWorker({ pos: at(0, 0), yaw: 0, name: 'Lucky', role: 'lucky', look: { ...LUCKY_LOOK }, lines: ["Blue guy! Where's the blue guy?", "You see my chain? Real. Probably.", "I been inside two years. Two YEARS. Everything's so loud out here. I love it.", "Paul? Paul's the family lawyer. Back home in Albuquerque everybody's got Paul. Paul's like a cold. Everybody's got one."] });
    L.human.hold(foodMesh('can', 0x3ad86a));
    const guy = (dx, dz, name, shirt) => { const n = C.addWorker({ pos: at(dx, dz), yaw: 0, name, role: 'lucky', look: { ...randomLook(), female: false, shirt, longSleeves: true, pants: 0x22262a, hairStyle: pick(['short', 'cap', 'buzz']) }, lines: ["Lucky's busy.", "Don't touch the chain.", "…"] }); g.weapons.giveModel(n.human, 'pistol'); return n; };
    this.spud = guy(-2.2, -1.2, 'Spud', 0x3a4a5a); this.wes = guy(2.4, -1.0, 'Wes', 0x4a3a3a);
    this.crew = [L, this.spud, this.wes];
    for (const n of this.crew) { n.luckyCrew = true; n.mood = 10; }
    // the scrap: a heap, and a car door leaning on it
    const G = this.props = new THREE.Group(); G.position.copy(at(-3.2, -3.4)); g.scene.add(G);
    const rust = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 1 });
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1 + Math.random(), 0.5 + Math.random() * 0.6, 1 + Math.random()), rust); b.position.set((Math.random() - 0.5) * 2, 0.3 + i * 0.25, (Math.random() - 0.5) * 1.5); b.rotation.set(Math.random() * 0.4, Math.random() * 3, Math.random() * 0.4); G.add(b); }
    const door = this.door = new THREE.Group(); door.position.set(1.4, 0, 1.6); G.add(door);
    { const paint = new THREE.MeshStandardMaterial({ color: 0x2a5a8a, roughness: 0.5, metalness: 0.3 }), glass = new THREE.MeshStandardMaterial({ color: 0x2a3a44, roughness: 0.1, metalness: 0.5 });
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.07), paint); p.position.set(0.55, 0.45, 0); door.add(p);
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.4, 0.03), glass); w.position.set(0.55, 0.93, 0); door.add(w); }
    door.rotation.y = 0.3;
    G.traverse(o => { o.userData.dynamic = true; if (o.isMesh) o.castShadow = true; });
  }
  despawn() { const C = this.g.citizens; for (const n of this.crew) if (C.list.includes(n)) C.remove(n); this.crew = []; this.props?.removeFromParent(); this.props = null; }

  // the meeting
  scene() {
    const g = this.g, S = g.story, C = g.citizens, pl = g.player, D = g.drugs, L = this.lucky, spud = this.spud, wes = this.wes;
    this.stage = 'scene'; S.waypoint(null);
    if (pl.car) pl.exitCar?.();
    if (g.mask?.on) g.mask.toggle();
    const put = (n, at, yaw, pose = { pose: 'stand' }) => { n.human.resetPose(); n.state = 'scripted'; n.script = { pos: at.clone(), yaw, pose }; };
    const c = this.lot(), lp = c.clone(), me = c.clone().add(V(0.4, 0, 2.6)), sp = c.clone().add(V(-1.7, 0, -0.6)), wp = c.clone().add(V(2.0, 0, -0.8));
    pl.respawn(me, yawTo(me, lp)); pl.scripted = { pos: me.clone(), yaw: yawTo(me, lp), pose: { pose: 'stand' } };
    put(L, lp, yawTo(lp, me)); put(spud, sp, yawTo(sp, me)); put(wes, wp, yawTo(wp, me));
    // (a wide shot from wherever there's a clear view: not from inside a wall)
    const clear = (from, to) => { const d = from.clone().sub(to), len = d.length(); d.normalize(); const h = g.world.castRay(new g.R.Ray({ x: to.x, y: to.y, z: to.z }, { x: d.x, y: d.y, z: d.z }), len, true, g.R.QueryFilterFlags.ONLY_FIXED); return !h; };
    const look0 = lp.clone().setY(lp.y + 1.3), cands = [[4.5, 2.2, 6.5], [-4.5, 2.2, 6.5], [6.5, 2.2, -2], [-6.5, 2.2, -2], [3, 2.4, -6.5], [-3, 2.4, -6.5], [0, 3, 7]].map(o => c.clone().add(V(...o)));
    const wide = cands.find(p => clear(p, look0)) || cands[0];
    const side = V(1, 0, 0), onL = [me.clone().add(V(-0.5, 1.68, -0.6)), lp.clone().setY(lp.y + 1.55)], onMe = [lp.clone().add(V(0.5, 1.7, 0.5)), me.clone().setY(me.y + 1.6)], onSpud = [sp.clone().add(V(1.8, 1.6, 2.2)), sp.clone().setY(sp.y + 1.3)];
    const bags = Math.min(D.count, 10), price = Math.round(bags * 85 * 1.6);
    const doorAt = this.props.localToWorld(this.door.position.clone());
    S.play([
      S.fadeS(1, 0.3), S.call(() => S.fade(1)),
      S.shotS(wide, wide.clone().add(V(-1, 0, -0.5)), lp.clone().setY(1.3), null, 7, 46),
      S.fadeS(0, 0.6),
      S.call(() => { L.human.express('happy', 6); }),
      S.line('LUCKY', "THERE he is! The blue guy! Come here. Come HERE. Look at you. You look like a substitute teacher.", 4.4),
      S.line('LUCKY', "Two years inside. Two YEARS. And the whole time, guys are coming in, 'Lucky, there's this blue, it's like glass, it's like art'.", 5.4),
      S.shotS(onL[0], null, onL[1], null, 9, 38),
      S.line('LUCKY', "You heard about my brother? Royce? Saltline guys say he got sloppy. Took a bullet off some nobody.", 4.4),
      S.call(() => L.human.express('sad', 3)),
      S.line('LUCKY', '…Tragic.', 1.6),
      S.call(() => L.human.express('happy', 5)),
      S.line('LUCKY', "Anyway! Show me.", 1.8),
      S.shotS(onMe[0], null, onMe[1], null, 2.6, 38),
      S.line('…', `<i>(You hand him a bag. He holds it up to the light, like a jeweller.)</i>`, 3.2),
      S.shotS(onL[0], null, onL[1], null, 6, 34),
      S.line('LUCKY', "…Ohhh. Oh, look at that. Look at the COLOUR. That's not a drug, that's a stained-glass window.", 4.4),
      S.shotS(onSpud[0], null, onSpud[1], null, 3, 40),
      S.line('SPUD', "It's pretty good.", 1.8),
      S.shotS(onL[0], null, onL[1], null, 2.4, 34),
      S.call(() => L.human.express('neutral', 4)),
      S.line('LUCKY', '…', 1.4),
      S.line('LUCKY', '"Pretty good"?', 1.8),
      S.shotS(wide, null, sp.clone().setY(1.1), null, 4, 46),
      S.call(() => { L.human.express('angry', 4); L.script.pos.copy(doorAt.clone().setY(lp.y)); L.script.yaw = yawTo(doorAt, sp); this.door.rotation.y = -1.4; }),
      S.wait(0.35),
      S.call(() => { this.door.rotation.y = 0.9; g.sfx?.burst?.({ at: sp, vol: 1, dur: 0.3, freq: 300, thump: 1 }); g.citizens.knock(spud, V(-3, 2, -2), 6); }),
      S.line('LUCKY', '"PRETTY GOOD"?! It\'s PERFECT! It\'s the best thing I ever SAW! Say PERFECT!', 3.4),
      S.line('SPUD', '…perfect…', 1.6),
      S.call(() => { L.script.pos.copy(lp); L.script.yaw = yawTo(lp, me); L.human.express('happy', 8); }),
      S.shotS(onL[0], null, onL[1], null, 9, 38),
      S.line('LUCKY', "Sorry. Sorry! Where were we. I'll take the lot. Here. That's way more than street, 'cause I'm generous and 'cause you're FAMILY now.", 5.4),
      S.line('LUCKY', "Next week: double. You and me, blue guy. You and me.", 3.4),
      S.shotS(onMe[0], null, onMe[1], null, 2.4, 38),
      S.line('YOU', '<i>…Family.</i>', 1.8),
      S.fadeS(1, 0.5),
    ]);
    S.onDone = () => {
      D.bags.splice(0, bags); D.onChange?.(); g.money += price; g.sfx?.cash?.(pl.pos);
      pl.scripted = null; S.fade(0); this.stage = 'done1';
      for (const n of [L, wes]) { n.state = 'post'; n.script = null; }
      setTimeout(() => { if (this.stage === 'done1') this.despawn(); }, 40000);
      g.hud.toast(`Lucky took ${bags} bags: +$${price.toLocaleString()}. Job done: Scrapyard.`, '#ffb27a');
      setTimeout(() => g.wren?.text('Wren', "paul just told me. you sold to LUCKY ROYCE? royce's BROTHER? the brother of the guy you— oh my god. oh my GOD"), 5000);
      setTimeout(() => g.wren?.text('Wren', "he's going to find out. you know that right. he's going to find out"), 11000);
      setTimeout(() => g.wren?.text('Lucky', 'BLUE GUY!!! 🔥🔥🔥 same time next week. DOUBLE. love u'), 20000);
      g.saver?.save();
    };
  }

  // ================= Ears Open =================
  earsStart() {
    const g = this.g; this.stage = 'ears'; this.pops = []; this.popT = 60; this.textT = 20;
    g.wren?.text('Lucky', 'blue guy!! where u at');
    setTimeout(() => g.wren?.text('Lucky', 'u up'), 4000); setTimeout(() => g.wren?.text('Lucky', '🔥🔥🔥'), 7000);
    g.hud.toast('📱 RECOMMENDED · Ears Open', '#ffd23f'); g.saver?.save();
  }
  // Lucky, somewhere he shouldn't be, for a short scene; then gone
  pop(kind) {
    const g = this.g, S = g.story, C = g.citizens, pl = g.player;
    if (pl.car) return false;
    const put = (n, at, yaw, pose = { pose: 'stand' }) => { n.human.resetPose(); n.state = 'scripted'; n.script = { pos: at.clone(), yaw, pose }; };
    const me = pl.pos.clone(), f = new THREE.Vector3(Math.sin(pl.yaw), 0, Math.cos(pl.yaw));
    let lp, lines, myAt = me, myYaw = pl.yaw, pose = { pose: 'stand' };
    const W = S.wren;
    if (kind === 'street') { lp = me.clone().addScaledVector(f, -1.6); lines = [["LUCKY", "BLUE GUY! Small world!"], ['LUCKY', "It's not. I followed you. Since the coffee place. You walk like a dad."], ['LUCKY', "Okay bye! Love you! Text me back!"]]; }
    if (kind === 'wren') { const h = g.wrenHouse, out = new THREE.Vector3(Math.sin(h.doorYaw), 0, Math.cos(h.doorYaw)); lp = h.door.clone().addScaledVector(out, 1.4); myAt = h.door.clone().addScaledVector(out, 5); myYaw = yawTo(myAt, lp);
      if (W) put(W, h.door.clone().addScaledVector(out, 0.2).add(V(1.2, 0, 0)), yawTo(h.door, lp));
      lines = [['LUCKY', "Ayyy, there he is! I was just talking to your partner. He's cute. Nervous. I like nervous."], ['WREN', "…He's been here an hour."], ['LUCKY', "An hour and a HALF. He made me a sandwich. He didn't, I made it. Your partner's got good bread."], ['LUCKY', "See you soon, family!"]]; }
    if (kind === 'flat') { lp = g.apt.room1E.clone().add(V(1.2, 0, 0.6)); pose = { pose: 'stairsit' }; lp.y -= 0.45; myAt = g.apt.room1E.clone().add(V(-1.0, 0, -0.4)); myYaw = yawTo(myAt, lp);
      lines = [['LUCKY', "Hey! Don't freak out. Your door was locked. I fixed it."], ['LUCKY', "You got nothing in your fridge. A lemon. One lemon. Who lives like that?"], ['LUCKY', "Anyway, I'm gonna go. I just wanted to see where you sleep. 'Cause we're family. Bye!"]]; }
    if (!lp) return false;
    const L = C.addWorker({ pos: lp.clone(), yaw: yawTo(lp, myAt), name: 'Lucky', role: 'lucky', look: { ...LUCKY_LOOK }, lines: [] }); L.luckyCrew = true; L.human.hold(foodMesh('can', 0x3ad86a));
    put(L, lp, yawTo(lp, myAt), pose); L.human.express('happy', 20);
    pl.respawn(myAt, myYaw); pl.scripted = { pos: myAt.clone(), yaw: myYaw, pose: { pose: 'stand' } };
    const mid = myAt.clone().lerp(lp, 0.5), side = new THREE.Vector3(lp.z - myAt.z, 0, myAt.x - lp.x).normalize(), cam = mid.clone().addScaledVector(side, Math.max(2.6, myAt.distanceTo(lp) * 1.15)).setY(mid.y + 1.75);
    S.play([
      S.shotS(cam, cam.clone().addScaledVector(side, -0.4), mid.clone().setY(mid.y + 1.3), null, 12, 44),
      ...lines.map(([w, t]) => S.line(w, t)),
      S.fadeS(1, 0.4),
    ]);
    S.onDone = () => { if (C.list.includes(L)) C.remove(L); pl.scripted = null; if (W && kind === 'wren') { W.script = null; S.wrenHome(true); } S.fade(0); this.pops.push(kind); this.popT = 70; this.afterPop(); g.saver?.save(); };
    return true;
  }
  afterPop() {
    const g = this.g; if (this.pops.length < 3) { g.hud.toast(`Ears Open: Lucky ${this.pops.length}/3`, '#ffd23f'); return; }
    this.stage = 'planWait';
    setTimeout(() => g.wren?.text('Wren', "he was in your FLAT?? come to mine. NOW. we need a plan"), 2500);
    setTimeout(() => { if (this.stage === 'planWait') g.story.waypoint(g.wrenHouse.door); }, 2600);
  }
  // at Wren's: trying to plan, with Lucky ringing every thirty seconds
  planScene() {
    const g = this.g, S = g.story, pl = g.player, W = S.wren, h = g.wrenHouse; if (!W) return;
    this.stage = 'planning'; S.waypoint(null);
    const out = new THREE.Vector3(Math.sin(h.doorYaw), 0, Math.cos(h.doorYaw)), side = new THREE.Vector3(out.z, 0, -out.x);
    const wp = h.door.clone().addScaledVector(out, 1.8), me = wp.clone().addScaledVector(out, 1.6).addScaledVector(side, 0.6);
    W.human.resetPose(); W.state = 'scripted'; W.script = { pos: wp.clone(), yaw: yawTo(wp, me), pose: { pose: 'stand' } };
    pl.respawn(me, yawTo(me, wp)); pl.scripted = { pos: me.clone(), yaw: yawTo(me, wp), pose: { pose: 'stand' } };
    const cam = wp.clone().lerp(me, 0.5).addScaledVector(side, 2.8).setY(me.y + 1.7), look = wp.clone().lerp(me, 0.5).setY(me.y + 1.35);
    const ring = () => S.call(() => { for (let i = 0; i < 4; i++) setTimeout(() => g.sfx?.burst?.({ at: pl.pos, vol: 0.3, dur: 0.12, freq: 1500, q: 8, type: 'bandpass' }), i * 260); pl.scripted.pose = { pose: 'stand', phone: true }; });
    const hang = () => S.call(() => { pl.scripted.pose = { pose: 'stand' }; });
    S.play([
      S.shotS(cam, cam.clone().addScaledVector(side, -0.5), look, null, 30, 44),
      S.line('WREN', "Okay. Okay. We need him gone. Not gone gone. Just… elsewhere. Option one—", 3.6),
      ring(), S.line('LUCKY (PHONE)', "Blue guy! Whatchu doing? Sounds like planning. You planning a party? Invite me!", 3.8), hang(),
      S.line('WREN', "…Option one. We get you a gun. A real one. Just in case.", 3.2),
      ring(), S.line('LUCKY (PHONE)', "Me again! Quick one. What's your favourite colour? It's blue. I know it's blue.", 3.6), hang(),
      S.line('WREN', "Option two: Paul. He's on parole. Paul makes one call, he's back inside by Friday.", 3.6),
      ring(), S.line('LUCKY (PHONE)', "Hey is Wren there? Tell him I said hi. HI WREN.", 2.8), hang(),
      S.line('WREN', "…Option three. We take the van out to the Dry and we just… disappear. For a while.", 3.6),
      S.line('WREN', 'Pick one. Before he calls again.', 2.2),
    ]);
    S.onDone = () => { pl.scripted = null; this.stage = 'pick'; setTimeout(() => g.wheel?.show(W), 300); };
  }
  wrenOptions() {
    if (this.stage !== 'pick') return null;
    return [{ id: 'lk:gun', label: 'The gun' }, { id: 'lk:parole', label: 'Paul: the parole call ($1,000)' }, { id: 'lk:vanish', label: 'Disappear into the Dry' }];
  }
  wrenAct(n, id) {
    if (!id.startsWith('lk:')) return false;
    const g = this.g, S = g.story, W = S.wren; this.plan = id.slice(3); this.stage = 'plan';
    if (W) { W.script = null; S.wrenHome(true); }
    g.citizens.say(W, { gun: "A gun. Okay. Don't make me regret it. The dealers have them.", parole: "Paul. Okay. Pay him, he makes the call. God help us.", vanish: "The Dry. Okay. Go get the van. I'll pack." }[this.plan], 3.6);
    if (this.plan === 'vanish') S.waypoint(g.camper?.pos?.clone());
    if (this.plan === 'parole') S.waypoint(g.paulOffice?.door);
    g.saver?.save(); return true;
  }
  paulOptions() { return this.stage === 'plan' && this.plan === 'parole' ? [{ id: 'pl:parole', label: g_money(this.g) >= 1000 ? 'The parole call ($1,000)' : 'The parole call ($1,000, you\'re short)' }] : []; }
  paulAct(n, id) {
    if (id !== 'pl:parole') return false;
    const g = this.g, C = g.citizens;
    if (g.money < 1000) { C.say(n, "A thousand. For me? Nine hundred. No. A thousand.", 3); return true; }
    g.money -= 1000; g.sfx?.cash?.(g.player.pos); C.say(n, "Consider it called. His parole officer LOVES me. She hates me. It'll work. Probably by Friday.", 4.4);
    this.planDone(); return true;
  }
  planDone() {
    const g = this.g; if (this.stage !== 'plan') return;
    this.stage = 'shackNext'; g.story.waypoint(null);
    g.hud.toast('Job done: Ears Open.', '#ffb27a');
    setTimeout(() => g.wren?.text('Lucky', 'change of plans blue guy. outside. NOW 🙂'), 4000);
    g.saver?.save();
  }

  update(dt) {
    const g = this.g, S = g.story; if (!S || S.phase !== 'free') return;
    if (this.stage === 'done1' && !this.earsDay) { this.earsDay = g.missions?.day ?? 1; this.earsT = 180; }
    if (this.stage === 'done1' && !S.cine && !g.police.stars && (((this.earsT -= dt) <= 0) || (g.missions?.day ?? 1) > this.earsDay)) this.earsStart();
    if (this.stage === 'ears' && !S.cine && !g.police.stars && !g.drugs.cook) {
      if ((this.textT -= dt) <= 0) { this.textT = 45 + Math.random() * 40; g.wren?.text('Lucky', pick(['whatchu doing', 'blue guy', 'u eat yet?? i ate', 'miss u', 'where u at', '🔥', 'call me back', 'is that u in the van? WAVE'])); }
      const near = (p, r) => p && g.player.pos.distanceTo(p) < r;
      if (!this.pops.includes('wren') && g.wrenHouse && near(g.wrenHouse.door, 12) && S.wren && !S.wren.following) this.pop('wren');
      else if (!this.pops.includes('flat') && near(g.apt.room1E, 4)) this.pop('flat');
      else if (!this.pops.includes('street') && (this.popT -= dt) <= 0 && g.player.grounded && !g.van?.inside) { if (!this.pop('street')) this.popT = 5; }
    }
    if (this.stage === 'planWait' && !S.cine && !g.police.stars && g.wrenHouse && g.player.pos.distanceTo(g.wrenHouse.door) < 12 && S.wren && !S.wren.following && !g.player.car) this.planScene();
    if (this.stage === 'plan' && !S.cine) {
      if (this.plan === 'gun' && g.weapons.inv.has('revolver')) this.planDone();
      if (this.plan === 'vanish' && g.player.car === g.camper && g.desert?.inDesert?.(g.camper.pos.x, g.camper.pos.z)) this.planDone();
    }
    if (this.stage === 'none' && g.never?.stage === 'done') { this.stage = 'waiting'; this.waitT = 180; this.day0 = g.missions?.day ?? 1; }
    if (this.stage === 'waiting' && !S.cine && !g.police.stars && (((this.waitT -= dt) <= 0) || (g.missions?.day ?? 1) > this.day0)) this.call();
    if (this.stage === 'blown' && (g.missions?.day ?? 1) > (this.blownDay ?? 99)) { this.despawn(); this.stage = 'meet'; this.spawn(); g.story.waypoint(this.lot()); g.wren?.text('Paul', "lucky says he forgives you. he says that a lot. please go back to rusty's. please"); }
    if (this.stage === 'meet') {
      if (!this.crew.length || !g.citizens.list.includes(this.lucky)) this.spawn();
      const d = g.player.pos.distanceTo(this.lot());
      if (d < 14 && !S.cine && !g.police.stars) {
        if (g.drugs.count < MIN) { if (!this.nag || (this.nag -= dt) <= 0) { this.nag = 12; g.citizens.say(this.lucky, `Four bags minimum, blue guy! FOUR! Go cook!`, 3); } }
        else this.scene();
      }
      // start something with them and it's a fight (and the job's off)
      if (this.crew.some(n => n.state === 'dead' || n.state === 'down' || n.state === 'flee')) { this.stage = 'blown'; this.blownDay = g.missions?.day ?? 1; g.story.waypoint(null); for (const n of this.crew) if (g.citizens.list.includes(n) && n.state !== 'dead') { n.gunman = true; n.state = 'gunman'; n.home = null; } g.hud.toast("Lucky's not your friend any more.", '#ff5a5a'); }
    }
  }
  // (his guys shoot like the Saltline crew)
  state() { return { stage: { scene: 'meet', planning: 'planWait', pick: 'planWait' }[this.stage] || this.stage, pops: this.pops, plan: this.plan }; }
  restore(s) { if (!s) return; this.stage = s.stage || 'none'; this.pops = s.pops || []; this.plan = s.plan || null; this.popT = 40; this.textT = 30;
    if (this.stage === 'planWait') this.g.story.waypoint(this.g.wrenHouse?.door); if (this.stage === 'waiting') { this.waitT = 60; this.day0 = this.g.missions?.day ?? 1; } if (this.stage === 'meet') { this.spawn(); this.g.story.waypoint(this.lot()); } }
}
