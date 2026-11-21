// Wren, once she's moved in: how much she trusts you, what she says, her phone, her selling, her texts,
// her moods, and (after the third cook) the new voice and her ideas. The lines live in wrenlines.js.
import * as THREE from 'three';
import { LEVELS, TOPICS, ASK, TOPIC_MIN, BEFORE, AFTER, HANG, SMALL, REACT, TEXTS, QUICK, CALL, SHIFT, IDEAS, IDEA_NO, IDEA_SULK } from './wrenlines.js';
import { canvasTex } from './world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const el = (id) => document.getElementById(id);
const SPOTS = { home: 'at home', pier: 'at the pier', club: 'outside the nightclub', beach: 'on the beach, by the van' };

export class WrenLife {
  constructor(g) {
    this.g = g;
    this.unlocked = false;      // (after the first cook: the phone, the full wheel, all of this)
    this.trust = 35; this.dropT = 0;
    this.cooks = 0; this.shifted = false; this.shiftPending = false;
    this.stock = []; this.sellT = 30; this.batchCash = 0; this.batchSold = 0;
    this.where = 'home'; this.whereT = 150;
    this.mood = 'flat'; this.moodT = 600;
    this.recent = []; this.topicT = {}; this.hangT = 0; this.callT = 0; this.reactT = {};
    this.inbox = []; this.unread = 0; this.textT = 140; this.ignoreT = 0;
    this.menu = null; this.phoneOpen = false; this.fetch = null; this.bringing = 0;
    this.ideas = { done: new Set(), no: 0, clubT: 0, price: false, rideT: 0, current: null };
    this.lastStars = 0; this.fastT = 0; this.hospT = 0;
  }
  get n() { return this.g.story?.wren; }
  get alive() { const n = this.n; return !!n && this.g.citizens.list.includes(n) && n.state !== 'dead' && !n.human.ragdoll; }
  get lv() { let i = 0; LEVELS.forEach(([, min], k) => { if (this.trust >= min) i = k; }); return i; }
  get v() { return this.shifted ? 1 : 0; }
  levelInfo() { const [name, , col] = LEVELS[this.lv]; return [name, col]; }
  near(d = 20) { const n = this.n; if (!this.alive) return false; const p = this.g.player, q = this.g.citizens.pos(n); return n.state === 'seated' ? !!p.car && p.car.passenger === n : (n.script?.pos || q).distanceTo(p.pos) < d; }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    const k = (t, time) => this.inbox.push({ from: 'Kit', text: t, time });
    k('bringing something special tonight', 'Fri 9:14 PM'); k('its BLUE. trust me', 'Fri 9:15 PM'); k("where'd u go", 'Fri 11:52 PM');
    this.inbox.push({ from: 'Wren', text: "i'm on your stairs. come out when you're up", time: 'Sat 9:05 AM' });
    this.g.hud.toast('Your phone: press P to text or call Wren', '#5fd0ff');
  }

  add(d, why) {
    const before = this.lv;
    this.trust = THREE.MathUtils.clamp(this.trust + d, 0, 100);
    if (d < 0) { this.dropT = 240; this.dropAmt = (this.dropAmt || 0) - d; }
    const after = this.lv;
    if (after !== before && this.unlocked) this.g.hud.toast(`Wren: ${LEVELS[after][0]}`, after > before ? '#7be08a' : '#ff6a5a');
  }
  // a line she hasn't said lately, from what her trust allows
  line(list) {
    const ok = list.filter(([lv]) => lv <= this.lv).map(([, t]) => t);
    const fresh = ok.filter(t => !this.recent.includes(t));
    const t = pick(fresh.length ? fresh : ok.length ? ok : list.map(([, t]) => t));
    this.recent.push(t); if (this.recent.length > 16) this.recent.shift();
    return t;
  }
  say(t, dur) { if (this.alive) this.g.citizens.say(this.n, t, dur ?? Math.min(6, 2 + t.length * 0.05)); }
  pv(pair) { return pick(pair[this.v] && pair[this.v].length ? pair[this.v] : pair[0]); }

  // ---- her wheel
  options(n) {
    const D = this.g.drugs;
    if (this.menu === 'talk') return TOPICS.filter(([k]) => (TOPIC_MIN[k] || 0) <= this.lv).map(([k, label]) => ({ id: 't:' + k, label }));
    if (this.menu === 'idea') return [{ id: 'idea:yes', label: 'Do it' }, { id: 'idea:no', label: 'No' }];
    const o = [{ id: 'talk', label: 'Talk' }];
    if (this.lv >= 2) o.push({ id: 'hang', label: 'Hang out' });
    if (D.count) o.push({ id: 'give', label: `Give her ${D.count} bag${D.count > 1 ? 's' : ''}` });
    o.push(n.following ? { id: 'home', label: 'Head home' } : { id: 'come', label: 'Come with me' });
    if (this.shifted) o.push({ id: 'ideas', label: 'Hear her ideas' });
    o.push(this.dropT > 0 ? { id: 'sorry', label: 'Say sorry' } : { id: 'thanks', label: 'Thank her' });
    o.push({ id: 'snap', label: 'Snap at her' });
    return o;
  }
  act(n, id) {
    const g = this.g, S = g.story;
    if (id === 'talk') { this.menu = 'talk'; g.wheel.show(n); return; }
    if (id.startsWith('t:')) {
      this.menu = null; const k = id.slice(2);
      S.sub('YOU', `<i>${ASK[k]}</i>`, 1.8);
      const pool = this.shifted ? (k === 'holding' && this.mood === 'wrecked' ? AFTER.holdingWrecked : AFTER[k]) : BEFORE[k];
      const t = this.line(pool);
      setTimeout(() => this.say(t), 900);
      const fresh = (this.topicT[k] || 0) < performance.now(); this.topicT[k] = performance.now() + 300000;
      this.add(fresh ? 3 : 1);
      return;
    }
    if (id === 'hang') {
      if (this.hangT > 0) { this.say(this.shifted ? 'Later, Chef. I\'m on the clock.' : "Not right now. Later?"); return; }
      this.hangT = 480;
      S.blink(() => { g.hud.toast(pick(HANG), '#ffd7a8'); });
      this.add(this.mood === 'wrecked' ? 10 : 6);
      return;
    }
    if (id === 'give') { this.handover(this.bringing > 0 ? 'bring' : 'hand'); return; }
    if (id === 'come') { n.following = true; n.state = 'follow'; n.home = null; this.say(this.shifted ? "Shotgun, Chef!" : 'Yeah. Okay. Where are we going?'); return; }
    if (id === 'home') { this.say(this.shifted ? 'Back to work. Later, Chef.' : "I'll see you at home."); this.away(); return; }
    if (id === 'thanks') { this.say(pick(this.shifted ? SMALL.thanksAfter : SMALL.thanks)); this.add(1); return; }
    if (id === 'sorry') { this.say(pick(this.lv >= 3 ? SMALL.sorryClose : SMALL.sorry)); this.add(Math.min(6, Math.ceil((this.dropAmt || 0) / 2))); this.dropT = 0; this.dropAmt = 0; return; }
    if (id === 'snap') { this.say(pick(SMALL.snap)); this.add(-6); n.human.express('annoyed', 4); return; }
    if (id === 'ideas') {
      const next = IDEAS.find(i => !this.ideas.done.has(i.id));
      if (!next) { this.say("I'm out of ideas, Chef. For now. Give me a week."); return; }
      this.ideas.current = next; this.say(next.pitch, 3.5); g.hud.toast(next.sum, '#ffd23f');
      this.menu = 'idea'; setTimeout(() => { if (this.menu === 'idea') g.wheel.show(n); }, 700);
      return;
    }
    if (id === 'idea:yes' || id === 'idea:no') { this.menu = null; this.decide(id === 'idea:yes'); return; }
  }

  // ---- the bags: handed over in person, or she comes and gets them
  handover(how) {
    const g = this.g, D = g.drugs, k = D.count; if (!k) return;
    this.stock.push(...D.bags.splice(0)); if (this.sellT > 40) this.sellT = 25;
    if (this.shiftPending) { this.shiftScene(); return; }
    const say = how === 'fetch' ? (this.lv >= 3 && Math.random() < 0.5 ? SMALL.fetchClose : SMALL.fetch) : how === 'bring' ? (this.lv >= 3 && Math.random() < 0.5 ? SMALL.bringClose : SMALL.bring) : (this.shifted ? SMALL.takeAfter : SMALL.take);
    this.say(k >= 8 && !this.shifted && how === 'hand' ? `${k}? Kit never made more than five in a go.` : pick(say));
    this.add(how === 'bring' ? 3 : 1); this.bringing = 0; if (g.waypoint?.name === 'Wren') { g.waypoint = null; g.wpBeam.visible = false; }
    g.hud.toast(`Wren's got ${this.stock.length} bag${this.stock.length > 1 ? 's' : ''} to sell`, '#5fd0ff');
  }
  shiftScene() {
    const S = this.g.story; this.shiftPending = false; this.shifted = true;
    S.play(SHIFT.map(([who, t]) => S.line(who, who === 'YOU' ? `<i>${t}</i>` : t, who === 'YOU' ? 1.8 : undefined)).concat([S.call(() => { this.n?.human.express('happy', 4); })]));
    S.onDone = () => this.g.hud.toast("Wren's got a new energy. And a new name for you. (Hold E on her: Hear her ideas)", '#ffb27a');
  }

  // ---- where she is (when she's not with you): home, or out selling
  spot(w) {
    const g = this.g, P = g.places;
    if (w === 'pier' && P.pier) return P.pier.pos.clone().add(V(3, 0, -2)).setY(0.05);
    if (w === 'club' && P['the nightclub']) return P['the nightclub'].pos.clone().add(V(2.5, 0, 1.5)).setY(0.05);
    if (w === 'beach' && g.camper && !g.camper.wrecked) return g.camper.trunkPoint(3.2).setY(0.05);
    return g.apt.wrenSpot.clone();
  }
  placeAt(w) {
    const n = this.n, p = this.spot(w); this.where = w;
    n.human.resetPose(); n.script = null; n.following = false;
    n.body.setTranslation({ x: p.x, y: p.y + 1.0, z: p.z }, true); n.body.setNextKinematicTranslation({ x: p.x, y: p.y + 1.0, z: p.z });
    n.state = 'post'; n.home = p.clone(); n.homeYaw = w === 'home' ? this.g.apt.wrenYaw : Math.random() * 6.28;
  }
  seen() { const n = this.n, g = this.g, q = g.citizens.pos(n); return g.camera.position.distanceTo(q) < 50 && g.citizens._fr?.containsPoint(q.clone().add(V(0, 1, 0))); }
  away() { // off to wherever she's working (or home): out of sight, she's just there
    const n = this.n; n.following = false; n.state = 'idle'; n.stateT = 99;
    const w = this.stock.length ? this.where : 'home';
    const go = () => { if (!this.alive || n.following) return; if (this.seen() && this.awayTries++ < 6) { setTimeout(go, 2500); return; } this.placeAt(w); };
    this.awayTries = 0; setTimeout(go, 3000);
  }

  // ---- the phone
  text(from, t) {
    const now = new Date(), time = `${(now.getHours() % 12) || 12}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.inbox.push({ from, text: t, time }); if (this.inbox.length > 40) this.inbox.shift();
    if (from === 'Wren') { if (this.phoneOpen) this.render(); else { this.unread++; this.g.hud.toast(`📱 Wren: ${t}`, '#ffb27a'); this.g.sfx?.thunk?.(this.g.player.pos); } }
    else if (this.phoneOpen) this.render();
  }
  reply(t, delay = 1400) { setTimeout(() => this.text('Wren', t), delay); }
  togglePhone() { this.phoneOpen ? this.closePhone() : this.openPhone(); }
  openPhone() {
    const g = this.g;
    if (!this.unlocked) { g.hud.toast('Nothing on your phone yet.'); return; }
    if (g.player.car && Math.abs(g.player.car.speed) > 3) { g.hud.toast("Not while you're driving."); return; }
    this.phoneOpen = true; this.unread = 0; this.ignoreT = 0; this.render(); el('phone').classList.add('on'); el('phone').classList.add('live');
    document.exitPointerLock?.();
  }
  closePhone() { this.phoneOpen = false; el('phone').classList.remove('on'); el('phone').classList.remove('live'); this.g.renderer.domElement.requestPointerLock?.(); }
  actions() {
    const D = this.g.drugs, lv = this.lv, a = [];
    a.push({ id: 'come', label: `Come get them${D.count ? ` (${D.count})` : ''}`, off: !D.count });
    a.push({ id: 'bring', label: "I'll bring them to you", off: !D.count });
    for (const [id, label, , , min] of QUICK) if ((min || 0) <= lv) a.push({ id: 'q:' + id, label: `"${label}"` });
    a.push({ id: 'call', label: 'Call Wren' });
    return a;
  }
  render() {
    const [lvName, col] = this.levelInfo();
    const msg = (m) => `<div class="msg ${m.from === 'You' ? 'me' : m.from === 'Wren' ? 'w' : 'k'}"><b>${m.from}</b><span>${m.text}</span><i>${m.time}</i></div>`;
    el('phone').innerHTML = `<div class="bar">Wren <span style="color:${col}">${lvName}</span></div><div class="thread">${this.inbox.slice(-8).map(msg).join('')}</div>
      <div class="acts">${this.actions().map((o, i) => `<button data-a="${o.id}" ${o.off ? 'disabled' : ''}><small>${i + 1}</small>${o.label}</button>`).join('')}</div><div class="hint"><kbd>P</kbd> or <kbd>Esc</kbd> put it away</div>`;
    el('phone').querySelectorAll('button[data-a]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this.phoneAct(b.dataset.a); }));
    const th = el('phone').querySelector('.thread'); if (th) th.scrollTop = th.scrollHeight;
  }
  phoneKey(code) {
    if (code === 'KeyP' || code === 'Escape') { this.closePhone(); return; }
    const m = /^Digit([1-9])$/.exec(code); if (m) { const o = this.actions()[+m[1] - 1]; if (o && !o.off) this.phoneAct(o.id); }
  }
  phoneAct(id) {
    const g = this.g, D = g.drugs, n = this.n, v = this.v;
    if (!this.alive) { this.text('You', '…'); this.reply("(not delivered)"); return; }
    if (id === 'come') {
      if (!D.count) return;
      this.text('You', 'got some. come get them?');
      if (n.following || g.citizens.pos(n).distanceTo(g.player.pos) < 15) { this.reply(this.shifted ? "chef i'm literally right here" : "i'm right next to you"); return; }
      if (this.stock.length && Math.random() < 0.25 && this.where !== 'home') { this.reply(this.pv(TEXTS.busy) + SPOTS[this.where].replace(/^at |^on |^outside /, '')); return; }
      this.reply(this.lv >= 3 && Math.random() < 0.4 ? this.pv(TEXTS.comeClose) : this.pv(TEXTS.come));
      this.fetch = { t: 8 + Math.random() * 6 }; return;
    }
    if (id === 'bring') {
      if (!D.count) return;
      this.text('You', "i'll bring them to you");
      if (n.following) { this.reply(this.shifted ? 'chef. turn around.' : "i'm right behind you"); return; }
      const w = this.stock.length ? this.where : 'home';
      if (!this.seen() || g.citizens.pos(n).distanceTo(this.spot(w)) > 8) this.placeAt(w);
      this.reply(pick(TEXTS.where[w]));
      this.bringing = 600; setTimeout(() => g.setWaypoint({ pos: this.spot(w), name: 'Wren' }), 1500); return;
    }
    if (id.startsWith('q:')) {
      const k = id.slice(2), q = QUICK.find(x => x[0] === k); this.text('You', q[1]);
      let t;
      if (k === 'where') t = n.following ? 'next to you??' : this.lv <= 1 ? "don't worry about it" : pick(TEXTS.where[this.where]);
      else if (k === 'how') t = this.stock.length ? `${this.stock.length} left` : this.batchSold ? 'sold out' : 'slow';
      else t = this.lv >= 3 && q[3] ? this.pv(q[3]) : this.pv(q[2]);
      this.reply(t);
      if (k === 'kit' && (this.topicT.textKit || 0) < performance.now()) { this.topicT.textKit = performance.now() + 600000; this.add(2); }
      else if ((this.topicT.text || 0) < performance.now()) { this.topicT.text = performance.now() + 120000; this.add(1); }
      return;
    }
    if (id === 'call') {
      this.closePhone();
      const S = g.story, rare = this.callT < -900;
      const open = this.lv >= 3 ? this.pv(CALL.openClose) : rare ? this.pv(CALL.openRare) : this.pv(CALL.open);
      const k = pick(['holding', 'business', 'vic', 'pratt', 'chat']), pool = this.shifted ? AFTER[k] : BEFORE[k];
      const bye = this.lv >= 4 ? this.pv(CALL.byeFamily) : this.pv(CALL.bye);
      const seq = [['WREN', open], ['YOU', `<i>${ASK[k]}</i>`], ['WREN', this.line(pool)], ['WREN', bye]]; let t = 0;
      seq.forEach(([w, s]) => { setTimeout(() => S.sub(w, s, 2.8), t); t += 3000; });
      if (this.callT <= 0) this.add(1); this.callT = 240;
      return;
    }
  }

  // ---- her ideas (after the shift)
  decide(yes) {
    const g = this.g, I = this.ideas, idea = I.current; if (!idea) return;
    if (!yes) { I.no++; this.say(pick(IDEA_NO)); if (I.no >= 3) { I.no = 0; setTimeout(() => this.say(IDEA_SULK), 2500); this.add(-2); } return; }
    I.no = 0; I.done.add(idea.id); this.say(idea.yes); this.add(2);
    if (idea.id === 'club') { I.clubT = 240; this.where = 'club'; }
    if (idea.id === 'site') this.siteBuyer();
    if (idea.id === 'big') { g.drugs.big = true; g.hud.toast('Bigger batches: each cook now uses 2 solvent and 2 salts (when you have them) for twice the bags', '#5fd0ff'); }
    if (idea.id === 'price') I.price = true;
    if (idea.id === 'van') this.paintVan();
    if (idea.id === 'ride') { I.rideT = 600; this.n.following = true; this.n.state = 'follow'; }
  }
  siteBuyer() {
    const g = this.g, P = g.places['the construction site']; if (!P) return;
    const at = P.pos.clone().add(V(-2, 0, 2)).setY(0.05);
    const b = g.citizens.addWorker({ pos: at, yaw: 0, lines: ['Wren sent you? Cool cool cool.', "Double. That's what she said. Double.", "I'm not a cop. Why does everyone ask that."], role: 'buyer' });
    b.spot = 'site'; b.undercover = Math.random() < 0.25;
    g.hud.toast('A new buyer at the construction site pays double', '#5fd0ff');
  }
  paintVan() {
    const c = this.g.camper; if (!c || c.kitchen) return; c.kitchen = true;
    const t = canvasTex(512, 128, (x, w, h) => { x.clearRect(0, 0, w, h); x.font = 'bold 64px "Arial Black", Arial'; x.textAlign = 'center'; x.fillStyle = '#1a6ad8'; x.fillText("KIT'S KITCHEN", w / 2 + 3, 86); x.fillStyle = '#ffd23f'; x.fillText("KIT'S KITCHEN", w / 2, 83); });
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6 });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.39), m); p.position.set(s * 0.94, 1.82, -1.56); p.rotation.y = s * Math.PI / 2; c.shell.add(p); }
    this.g.hud.toast("KIT'S KITCHEN, on both sides of the van", '#ffd23f');
  }

  // ---- what she says when things happen (if she's there to see them)
  react(key, d = 0, cool = 8) {
    if (!this.unlocked || !this.alive || (this.reactT[key] || 0) > performance.now()) return false;
    if (!this.near(key === 'cookIn' || key === 'clean' || key === 'cloudy' || key === 'boil' ? 26 : 20)) return false;
    this.reactT[key] = performance.now() + cool * 1000;
    this.say(this.pv(REACT[key])); if (d) this.add(d);
    return true;
  }
  onCrime(kind, at) {
    const map = { assault: ['punch', -2], copAssault: ['punch', -3], gunfire: ['gun', -3], robbery: ['gun', -3], threat: ['gun', -1], murder: ['kill', -15], copMurder: ['kill', -15], carjack: ['steal', -1], kidnap: ['punch', -6] }[kind];
    if (!map) return;
    if (this.react(map[0], map[1], map[0] === 'kill' ? 1 : 8) && map[0] === 'kill') { this.n.human.express('sad', 8); setTimeout(() => { if (this.alive) this.away(); }, 2500); }
  }
  hurtBy(kind) { // you hurt her
    if (!this.unlocked) return;
    const d = { punch: -8, struck: -15, shot: -25, car: -10, bump: -1 }[kind] ?? -5;
    const now = performance.now(); this.reactT.punch = this.reactT.gun = this.reactT.kill = now + 4000; // (she's the one hurt: that's what she talks about)
    this.say(this.pv(REACT[kind === 'bump' ? 'bumped' : 'hurt'])); this.add(d);
  }
  onCook(p, bags) {
    this.cooks++;
    if (this.cooks >= 3 && !this.shifted) this.shiftPending = true;
    if (p > 0.85) this.react('clean', this.shifted ? 3 : 2, 1); else if (p < 0.5) this.react('cloudy', -2, 1);
  }

  update(dt) {
    const g = this.g, n = this.n, D = g.drugs, I = this.ideas;
    this.hangT -= dt; this.callT -= dt; this.dropT -= dt; this.bringing = Math.max(0, this.bringing - dt);
    if (!this.unlocked || !n || !g.citizens.list.includes(n)) return;
    if (this.phoneOpen && !el('phone').classList.contains('on')) this.phoneOpen = false;
    // moods (every ten minutes or so)
    if ((this.moodT -= dt) <= 0) { this.moodT = 540 + Math.random() * 180; const r = Math.random(); this.mood = r < 0.4 ? 'buzzing' : r < 0.8 ? 'flat' : 'wrecked'; if (this.shifted && this.mood !== 'flat' && Math.random() < 0.5) this.text('Wren', this.mood === 'buzzing' ? TEXTS.mood[1][0] : TEXTS.mood[1][1]); }
    if (!this.alive) return;
    // where she's working: moves round every few minutes while she's got stock
    if (!n.following && !this.fetch && n.state !== 'scripted' && n.state !== 'seated' && !this.bringing) {
      if ((this.whereT -= dt) <= 0) {
        this.whereT = 150 + Math.random() * 90;
        const w = I.clubT > 0 ? 'club' : this.stock.length ? pick(['home', 'pier', 'club', 'beach', 'pier']) : 'home';
        if (w !== this.where && !this.seen() && g.citizens.pos(n).distanceTo(g.player.pos) > 40) this.placeAt(w); else this.where = w;
      }
    }
    // selling, a bag at a time, when she's not out with you
    I.clubT = Math.max(0, I.clubT - dt);
    if (this.stock.length && !n.following && !this.fetch && n.state !== 'seated') {
      const mul = (this.mood === 'buzzing' ? 1.25 : this.mood === 'wrecked' ? 0.7 : 1) * (I.clubT > 0 ? 2 : 1) / (I.price ? 1.35 : 1);
      if ((this.sellT -= dt * mul) <= 0) {
        this.sellT = 40 + Math.random() * 20;
        const p = this.stock.shift(), cash = Math.round(85 * (0.45 + p * 0.9) * (this.lv >= 4 ? 1.25 : this.lv >= 3 ? 1.1 : 1) * (I.price ? 1.2 : 1));
        const keep = Math.round(cash * (1 - (g.missions?.cut || 0))); // (the Saltline crew's quarter, if you agreed to it)
        g.money += keep; this.batchCash += keep; this.batchSold++;
        if (I.clubT > 0 && Math.random() < 0.2 && !I.clubReported) { I.clubReported = true; g.police.reported(1, this.spot('club'), 'tip'); this.text('Wren', 'cops at the club. someone talked. i got out the back. dont come here for a bit'); }
        if (!this.stock.length) { this.text('Wren', this.pv(TEXTS.sold) + this.batchCash); setTimeout(() => { if (!this.stock.length) this.text('Wren', this.pv(TEXTS.out)); }, 90000); this.batchCash = 0; this.batchSold = 0; I.clubReported = false; }
        else if (this.batchSold % 3 === 0) this.text('Wren', `${pick(TEXTS.some[this.v])}${this.batchSold}. $${this.batchCash}`);
      }
    }
    // she comes and gets them
    if (this.fetch) {
      const F = this.fetch;
      if (!F.coming && (F.t -= dt) <= 0) {
        const T = g.citizens.trail || [], back = T[Math.max(0, T.length - 30)] || g.player.pos.clone().add(V(18, 0, 0));
        if (g.player.car) { F.t = 3; } else { n.human.resetPose(); n.script = null; n.body.setTranslation({ x: back.x, y: back.y + 1.0, z: back.z }, true); n.body.setNextKinematicTranslation({ x: back.x, y: back.y + 1.0, z: back.z }); n.state = 'follow'; n.following = true; F.coming = true; F.giveUp = 90; }
      }
      if (F.coming) {
        F.giveUp -= dt;
        if (!D.count || F.giveUp <= 0) { this.fetch = null; this.away(); }
        else if (!g.player.car && g.citizens.pos(n).distanceTo(g.player.pos) < 2.8) { this.fetch = null; this.handover('fetch'); n.following = false; n.state = 'idle'; n.stateT = 99; setTimeout(() => { if (this.alive) this.away(); }, 2600); }
      }
    }
    // a ride-along day
    if (I.rideT > 0 && (I.rideT -= dt) <= 0) { this.say(this.shifted ? "Okay, Chef, I'm clocking off. Later!" : "I'm heading back."); this.away(); }
    // texts, now and then; and if you never read them…
    if ((this.textT -= dt) <= 0) {
      this.textT = 150 + Math.random() * 150;
      const cat = pick(['checkin', 'worry', 'pratt', 'vic', this.shifted ? 'ideas' : 'checkin']);
      const t = cat === 'checkin' && this.lv >= 3 && Math.random() < 0.3 ? this.pv(TEXTS.checkinClose) : this.pv(TEXTS[cat]);
      if (t && !n.following) this.text('Wren', t);
    }
    if (this.unread >= 3) { this.ignoreT += dt; if (this.ignoreT > 360) { this.ignoreT = 0; this.text('Wren', TEXTS.ignored[0]); setTimeout(() => this.text('Wren', TEXTS.ignored[1]), 20000); this.add(-3); } }
    // the police, the driving, the hospital: if she's with you
    const st = g.police.stars;
    if (st > 0 && this.lastStars === 0) this.react('chase', -3, 20);
    if (st === 0 && this.lastStars > 0) this.react('lost', 1, 20);
    this.lastStars = st;
    const car = g.player.car;
    if (car && car.passenger === n) {
      if (Math.abs(car.speed) > 24 && (this.fastT -= dt) <= 0) { this.fastT = 25; this.say(this.lv >= 3 && Math.random() < 0.4 ? this.pv(REACT.fastClose) : this.pv(REACT.fast)); }
      const H = g.places['the hospital']; if (H && car.pos.distanceTo(H.pos) < 45 && (this.hospT -= dt) <= 0) { this.hospT = 600; this.say(this.pv(REACT.hospital)); }
    }
  }
}
