// The story. PHY2ICK is a prequel: before PHYSICK, before Wren is gone.
// It opens the morning after: you wake up in an ice bath with no memory of the night. Kit (Wren's younger
// brother) put you there, and then he lay down and didn't get up. Wren's on the stairs with the phone.
// Not missions: a few scenes, an objective line, and then the city. (The money, Pratt and Vic come later.)
//
// The scenes are lists of steps run one after another: a step can last a while (dur), wait for something
// (until), and do things as it starts, as it runs and as it ends. Enter, Space or Escape skips a scene.
import * as THREE from 'three';
import { randomLook } from './character.js';
import { Car } from './car.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = (k) => k * k * (3 - 2 * k);
const el = (id) => document.getElementById(id);

const SKINS = [0xf2d0b4, 0xe4b894, 0xd2a07a, 0xb98258, 0x96643e, 0x744a2c, 0x4e301e];
const HAIRS = [0x16100c, 0x2a1d14, 0x5a3a22, 0x8a5a30, 0xc8a060, 0x8a2e1a, 0x9a9a9a];
const STYLES = [['short', 'Short'], ['buzz', 'Buzzed'], ['curly', 'Curly'], ['afro', 'Afro'], ['long', 'Long'], ['ponytail', 'Ponytail'], ['bob', 'Bob'], ['bald', 'Bald']];
const WHO = { WREN: '#ffb27a', YOU: '#9ad0ff', 'CHANNEL 6': '#ff6a5a', KIT: '#7be08a', VIC: '#ff8a9a' };

export class Story {
  constructor(g) {
    this.g = g;
    this.phase = null;            // creator, wake, dress, phone, wren, stairs, hospital, done
    this.locked = false;          // (no moving about: a scene, the look picker, the phone)
    this.cine = false;            // a scene is playing (letterbox, no HUD, the story's camera)
    this.steps = null; this.cur = null; this.t = 0;
    this.shot = null;             // the camera move: from → to, looking from → to, over dur
    this.fadeV = 0;
    this.subT = 0;
  }

  // ---- the run of a scene
  play(steps) {
    this.steps = steps; this.i = -1; this.cur = null; this.cine = true; this.locked = true;
    document.body.classList.add('cine'); el('letterbox').classList.add('on');
    this.next();
  }
  next() {
    this.cur?.end?.();
    this.cur = this.steps[++this.i] || null; this.t = 0;
    if (!this.cur) { this.steps = null; this.cine = false; this.locked = false; this.shot = null; document.body.classList.remove('cine'); el('letterbox').classList.remove('on'); this.sub(null); const done = this.onDone; this.onDone = null; done?.(); return; }
    this.cur.start?.();
    if (!this.cur.dur && !this.cur.until) this.next();
  }
  skip() {
    if (!this.steps) return;
    let guard = 0;
    // (one step going wrong mustn't leave the rest undone: carry on past it)
    while (this.steps && guard++ < 200) { try { this.cur?.update?.(1, 0); this.next(); } catch (e) { console.warn('[story] a step failed while skipping', e); try { this.next(); } catch { /* (and on) */ } } }
    this.fade(0);
  }
  update(dt) {
    const g = this.g;
    if (this.cur) {
      this.t += dt; const c = this.cur;
      c.update?.(c.dur ? Math.min(1, this.t / c.dur) : 0, dt);
      if ((c.dur && this.t >= c.dur) || (c.until && c.until())) this.next();
    }
    if (this.shot) this.shot.t += dt;
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.sub(null); }
    this.phaseUpdate(dt);
  }
  // the camera, when a scene has it (after the normal camera's had its turn)
  camera() {
    const S = this.shot, cam = this.g.camera; if (!S || !this.cine) return;
    const k = ease(Math.min(1, S.t / S.dur));
    cam.position.lerpVectors(S.a, S.b, k);
    cam.lookAt(this._lk.lerpVectors(S.la, S.lb, k));
    if (cam.fov !== S.fov) { cam.fov = S.fov; cam.updateProjectionMatrix(); }
  }
  _lk = V();

  // ---- the pieces of a scene
  shotS(a, b, la, lb, dur = 3, fov = 50) { return { start: () => { this.shot = { a, b: b || a, la, lb: lb || la, dur, t: 0, fov }; } }; }
  wait(dur, fn) { return { dur, start: fn }; }
  call(fn) { return { start: fn }; }
  line(who, text, dur) { return { dur: dur ?? Math.min(7, 1.6 + text.length * 0.055), start: () => this.sub(who, text), end: () => this.sub(null) }; }
  fadeS(to, dur = 0.6) { let from; return { dur, start: () => { from = this.fadeV; }, update: (k) => this.fade(from + (to - from) * k) }; }

  sub(who, text, secs) {
    const s = el('subs');
    if (!who) { s.classList.remove('on'); return; }
    s.innerHTML = (who === '…' ? '' : `<b style="color:${WHO[who] || '#fff'}">${who}</b> `) + text; s.classList.add('on');
    this.subT = secs || 0;
  }
  fade(v) { this.fadeV = v; el('fade').style.opacity = v; }
  // a quick dip to black and back (through a door): fn happens in the dark
  blink(fn) { const f = el('fade'); f.style.transition = 'opacity .25s'; f.style.opacity = 1; setTimeout(() => { fn(); f.style.opacity = this.fadeV; setTimeout(() => { f.style.transition = ''; }, 300); }, 260); }
  objective(text) { const o = el('objective'); o.innerHTML = text ? `<small>NOW</small>${text}` : ''; o.classList.toggle('on', !!text); }
  waypoint(pos, name) { const g = this.g; if (pos) g.setWaypoint({ pos, name }); else { g.waypoint = null; g.wpBeam.visible = false; } }

  // keys while the story has hold of things (true: the key's been dealt with)
  key(code) {
    if (this.cine && ['Enter', 'Space', 'Escape'].includes(code)) { this.skip(); return true; }
    if (this.phase === 'phone' && ['KeyE', 'Enter', 'Space', 'Escape'].includes(code)) { this.closePhone(); return true; }
    return this.cine || this.phase === 'creator' || this.phase === 'phone';
  }

  // ================= the opening =================
  begin() {
    const g = this.g, A = g.apt, pl = g.player;
    this.phase = 'creator';
    g.hud.helpEl?.classList.add('hide');
    A.mess.visible = true; A.clothesMesh.visible = true;
    // you, in the bath, in your boxers, out cold
    pl.body.setTranslation({ x: A.bath.out.x, y: A.bath.out.y + 1, z: A.bath.out.z }, true);
    pl.dress('bath'); pl.scripted = { pos: A.bath.pos.clone(), yaw: A.bath.yaw, pose: { pose: 'bath', shiver: false } };
    pl.human.setMood('ko');
    this.locked = true; this.cine = true; document.body.classList.add('cine');
    // (looking down the bath from over the taps, past your feet, to your face)
    const tub = A.bath.pos, a = V(tub.x + 1.05, tub.y + 1.35, tub.z + 0.55), la = V(tub.x - 0.25, tub.y + 0.45, tub.z);
    this.shot = { a, b: a, la, lb: la, dur: 1, t: 1, fov: 55 };
    this.fade(0);
    this.buildCreator();
  }

  // pick your look: skin tone, hair (what shows under the beanie), hair colour
  buildCreator() {
    const g = this.g, pl = g.player, L = pl.look, box = el('creator');
    const sw = (c) => '#' + new THREE.Color(c).getHexString();
    box.innerHTML = `<h2>Who are you?</h2>
      <label>Skin</label><div class="row" data-k="skin">${SKINS.map(c => `<button style="background:${sw(c)}" data-v="${c}"></button>`).join('')}</div>
      <label>Hair <small>(under the beanie)</small></label><div class="row words" data-k="under">${STYLES.map(([v, n]) => `<button data-v="${v}">${n}</button>`).join('')}</div>
      <label>Hair colour</label><div class="row" data-k="hair">${HAIRS.map(c => `<button style="background:${sw(c)}" data-v="${c}"></button>`).join('')}</div>
      <button class="go">Wake up</button>`;
    const mark = () => box.querySelectorAll('.row').forEach(r => r.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(L[r.dataset.k]) === b.dataset.v)));
    box.querySelectorAll('.row button').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation(); const k = b.parentElement.dataset.k;
      L[k] = k === 'under' ? b.dataset.v : +b.dataset.v;
      pl.dress('bath'); pl.human.setMood('ko'); mark();
    }));
    box.querySelector('.go').addEventListener('click', (e) => { e.stopPropagation(); box.classList.remove('on'); g.renderer.domElement.requestPointerLock?.(); this.wake(); });
    mark(); box.classList.add('on');
  }

  // waking up: eyes snap open, cold, where am I; sit up; then you're out of the bath
  wake() {
    const g = this.g, A = g.apt, pl = g.player, S = () => pl.scripted, H = () => pl.human;
    this.phase = 'wake'; el('creator').classList.remove('on');
    pl.human.root.updateMatrixWorld(true);
    const head = pl.human.b.head.getWorldPosition(V()).add(V(0, 0.1, 0)), tub = A.bath.pos;
    const close = head.clone().add(V(0.55, 0.32, 0.22)), close2 = head.clone().add(V(0.45, 0.26, 0.16));
    const side = V(tub.x + 1.2, tub.y + 1.45, tub.z + 0.75);
    this.play([
      this.fadeS(1, 0.5),
      this.shotS(close, close2, head, head, 3.5, 40),
      this.fadeS(0, 1.2),
      this.wait(1.4),
      this.call(() => { H().setMood('scared'); H().express('surprised', 1.6); S().pose = { pose: 'bath', shiver: true }; g.shake = 0.35; g.sfx?.thunk?.(pl.pos); }),
      this.wait(1.0),
      this.call(() => { S().look = -0.8; }), this.wait(1.1),
      this.call(() => { S().look = 0.8; }), this.wait(1.2),
      this.call(() => { S().look = 0; }),
      this.shotS(side, side.clone().add(V(0.05, 0.08, 0.1)), V(tub.x - 0.3, tub.y + 0.55, tub.z), null, 4, 60),
      this.call(() => { S().pose = { pose: 'situp', shiver: true }; }),
      this.line('…', '<i>Ice. Why am I in ice?</i>', 2.6),
      this.line('…', '<i>…Where is everyone?</i>', 2.2),
      this.fadeS(1, 0.7),
      this.call(() => {
        const o = A.bath.out; pl.scripted = null; pl.body.setTranslation({ x: o.x, y: o.y + 1.0, z: o.z }, true); pl.body.setNextKinematicTranslation({ x: o.x, y: o.y + 1.0, z: o.z });
        pl.yaw = Math.PI / 2; g.cam.yaw = pl.yaw + Math.PI; g.cam.pitch = 0.15; pl.shiverT = 45; H().setMood('sad');
      }),
      this.wait(0.4),
      this.fadeS(0, 0.8),
    ]);
    this.onDone = () => this.startDress();
  }

  startDress() {
    const A = this.g.apt;
    this.phase = 'dress'; this.locked = false;
    this.objective('Get dressed · your clothes are in your room, <b>1E</b>, at the other end of the corridor');
    this.waypoint(A.clothes, 'your room');
    // the clothes on your bed
    this.g.spots.push({ pos: A.clothes, r: 1.5, label: () => '<kbd>E</kbd> get dressed', act: () => this.getDressed(), when: () => this.phase === 'dress' });
  }

  getDressed() {
    const g = this.g, pl = g.player, A = g.apt;
    this.phase = 'dressing';
    this.play([
      this.fadeS(1, 0.5),
      this.call(() => { pl.dress('dressed'); pl.human.setMood('sad'); A.clothesMesh.visible = false; pl.shiverT = 0; }),
      this.wait(0.6),
      this.fadeS(0, 0.6),
    ]);
    this.onDone = () => { this.phase = 'phoneWait'; this.objective(null); this.waypoint(null); this.phoneT = 1.6; };
  }

  // your phone: what's left of last night
  openPhone() {
    this.phase = 'phone'; this.locked = true;
    const msg = (who, time, text) => `<div class="msg ${who === 'Wren' ? 'w' : 'k'}"><b>${who}</b><span>${text}</span><i>${time}</i></div>`;
    el('phone').innerHTML = `<div class="bar">9:12 AM <span>4 missed calls · Wren</span></div>
      ${msg('Kit', 'Fri 9:14 PM', 'bringing something special tonight')}
      ${msg('Kit', 'Fri 9:15 PM', 'its BLUE. trust me')}
      ${msg('Kit', 'Fri 11:52 PM', "where'd u go")}
      ${msg('Wren', 'Sat 6:10 AM', "the hospital won't tell me anything")}
      ${msg('Wren', 'Sat 8:42 AM', 'are you awake')}
      ${msg('Wren', 'Sat 9:05 AM', "i'm on your stairs. come out when you're up")}
      <div class="hint"><kbd>E</kbd> put it away</div>`;
    el('phone').classList.add('on');
    this.g.sfx?.thunk?.(this.g.player.pos);
  }
  closePhone() {
    el('phone').classList.remove('on');
    this.phase = 'wren'; this.locked = false;
    this.spawnWren();
    this.objective('Find <b>Wren</b> · he\'s on the stairs');
    this.waypoint(this.wren.script.pos.clone(), 'Wren');
  }

  // Wren: sat on the stairs, on the phone
  spawnWren() {
    const g = this.g, C = g.citizens, A = g.apt;
    const step = A.stairStep(14), seat = V(step.x + 0.6, step.y, step.z + 0.2);
    const n = C.spawn('Wren', { at: seat, look: { ...randomLook(), female: false, hairStyle: 'spiky', hair: 0x7a5a38, skin: 0xe8b898, shirt: 0x4a5a3a, longSleeves: true, pants: 0x2a3040, shoes: 0x5a1d1d, height: 1.76, build: 0.98 } });
    n.body.setTranslation({ x: seat.x, y: seat.y + 1.2, z: seat.z }, true);
    n.storyNpc = true; n.companion = true; n.mood = 60; n.mem.met = true; n.home = null;
    n.lines = ["I keep looking at my phone like he's going to text.", "Vic still isn't picking up.", 'Just drive. Please.', "Don't. I can't talk about it yet."];
    n.state = 'scripted'; n.script = { pos: V(seat.x, seat.y + 0.1 - 0.95 * (1.68 / 1.75), seat.z), yaw: 0, pose: { pose: 'stairsit', phone: true } };
    this.wren = n;
  }

  // the stairs: he's just been told
  stairs() {
    const g = this.g, pl = g.player, A = g.apt, W = this.wren, Ws = W.script;
    this.phase = 'stairs'; this.objective(null); this.waypoint(null);
    const up = A.stairStep(18), me = V(up.x - 0.45, up.y, up.z); this.stairMe = me;
    pl.scripted = { pos: me, yaw: 0, pose: { pose: 'stand' } };
    // (aimed from where he's sitting, not from his drawn head: he may not have been drawn yet)
    const wHead = Ws.pos.clone().add(V(0, 1.52, 0.16)), myHead = me.clone().add(V(0, 1.66, 0));
    const low = A.stairStep(8).add(V(-0.9, 1.0, 0)), front = wHead.clone().add(V(-0.3, -0.05, 1.1)), over = wHead.clone().add(V(0.45, 0.3, -0.45));
    const onW = () => this.shotS(front, front.clone().add(V(-0.05, 0, -0.12)), wHead, null, 5, 42), onMe = () => this.shotS(over, over.clone().add(V(0.05, 0.02, 0.05)), myHead, null, 5, 42);
    const wLook = (y) => this.call(() => { Ws.look = y; });
    this.play([
      this.shotS(low, low.clone().add(V(0.1, 0.15, -0.5)), wHead.clone().add(V(0, 0.2, -1.2)), wHead, 5, 50),
      this.line('WREN', '…Okay. Yeah. …Thank you.', 2.6),
      this.call(() => { Ws.pose = { pose: 'stairsit', phone: false }; }),
      this.wait(1.2),
      wLook(-0.6), onW(), this.wait(0.6),
      this.line('WREN', 'That was the hospital.'),
      this.line('WREN', "Kit's gone.", 2.6),
      onMe(), this.line('YOU', "What? No. He was… he was fine. He was here."),
      onW(), this.line('WREN', "He called me at four. Said you were burning up, said he'd sorted it."),
      this.line('WREN', 'When I got here you were in the ice, and he was on your floor. I thought he was asleep.'),
      this.line('WREN', 'The ambulance took him. They checked you. Said keep you cold, you\'d come round.'),
      this.call(() => W.human.express('sad', 6)),
      this.line('WREN', 'You came round.', 2.8),
      this.wait(0.8),
      this.line('WREN', 'What did you guys take?'),
      onMe(), this.line('YOU', "I don't… I don't remember anything."),
      onW(), this.line('WREN', "Course you don't.", 2.2),
      this.line('WREN', "…Sorry. Sorry. That's not… I just…", 2.8),
      this.line('WREN', 'I tried Vic. Six times. Straight to voicemail.'),
      this.line('WREN', "Can you drive me to the hospital? I can't… I can't drive right now."),
      this.fadeS(1, 0.6),
      this.call(() => {
        pl.scripted = null; pl.body.setTranslation({ x: me.x, y: me.y + 1.0, z: me.z }, true); pl.body.setNextKinematicTranslation({ x: me.x, y: me.y + 1.0, z: me.z }); pl.yaw = 0; g.cam.yaw = Math.PI; g.cam.pitch = 0.2;
        this.wrenUp(W);
      }),
      this.fadeS(0, 0.6),
    ]);
    this.onDone = () => this.startDrive();
  }
  // up off the step, and after you
  wrenUp(W) {
    const p = W.script.pos; W.body.setTranslation({ x: p.x, y: p.y + 1.0, z: p.z + 0.4 }, true); W.body.setNextKinematicTranslation({ x: p.x, y: p.y + 1.0, z: p.z + 0.4 });
    W.state = 'follow'; W.following = true; W.script = null; W.human.resetPose();
  }
  startDrive() {
    const H = this.g.places['the hospital'];
    this.phase = 'hospital'; this.ride = null; this.checkpoint = 'drive';
    this.objective('Drive <b>Wren</b> to the hospital · your car\'s out the front');
    if (H) this.waypoint(H.pos, 'the hospital');
  }

  // ---- when it goes wrong (the car blows up with him in it, Wren dies): back to the last checkpoint
  // (later, when Wren can die and live on, he'll be picked up from the hospital instead)
  fail(why) {
    this.phase = 'failed'; this.failWhy = why; this.objective(null); this.waypoint(null);
  }
  restart() {
    const g = this.g, A = g.apt, pl = g.player, C = g.citizens, cp = this.checkpoint || 'drive';
    this.phase = 'restarting';
    const msg = this.failWhy === 'car' ? "The car's gone." : "Wren didn't make it.";
    const where = { drive: 'Back to Fairview Heights.', toVan: 'Back to the hospital.', van: "Back to Kit's van." }[cp];
    this.play([
      this.call(() => { this.shot = null; }),
      this.fadeS(1, 0.8),
      this.call(() => { el('chapter').innerHTML = `<span>${msg}</span><small>${where} Try that again.</small>`; el('chapter').classList.add('on'); }),
      this.wait(2.6),
      this.call(() => { el('chapter').classList.remove('on'); this.resetTo(cp); }),
      this.wait(0.5),
      this.fadeS(0, 0.8),
    ]);
    this.onDone = () => ({ drive: () => this.startDrive(), toVan: () => this.startToVan(), van: () => this.startFirstCook() })[cp]();
  }
  // put everything back as it was at a checkpoint (after a failure, or loading a save)
  resetTo(cp) {
    const g = this.g, A = g.apt, pl = g.player, C = g.citizens;
    g.police.clear(); g.police.stars = 0;
    if (g.van?.inside) g.van.exit(true); if (g.van) g.van.leaning = null;
    if (g.drugs.cook) g.drugs.finish(true);
    // the old Wren goes (out of whatever car, alive or not); a new one's with you
    const W = this.wren;
    if (W) { const car = g.cars.find(c => c.passenger === W); if (car) { car.passenger = null; car.unseat(W.human); } if (C.list.includes(W)) C.remove(W); }
    this.spawnWren();
    if (cp === 'drive') {
      const me = this.stairMe || A.stairStep(18); pl.respawn(me, 0); g.cam.yaw = Math.PI; g.cam.pitch = 0.2; this.wrenUp(this.wren);
      this.carNear(V(A.door.x + 8, 0.03, A.door.z + 6.2), Math.PI / 2);
    } else if (cp === 'toVan') {
      this.keys();
      const at = this.afterVic || (g.hospitalSpawn || g.apt.door).clone().add(V(3.2, 0, 1.6)); this.afterVicYaw = this.afterVicYaw ?? 0; pl.respawn(at, this.afterVicYaw); this.wrenStand(at.clone().add(V(1.2, 0, 0.6)));
      this.carNear(at.clone().add(V(4, 0.03, 3)), this.afterVicYaw + Math.PI / 2);
    } else if (cp === 'van') {
      this.keys();
      const out = g.camper.trunkPoint(1.6); pl.respawn(out, g.camper.yaw + Math.PI); this.wrenStand(out.clone().add(V(0, 0, 0))); g.van.wrenLean(this.wren); this.wren.storyLean = true;
      if (g.drugs.solvent < 1) g.drugs.solvent = 1; if (g.drugs.salts < 1) g.drugs.salts = 1;
    }
  }
  // straight back in at a checkpoint (a loaded save): no failure card
  resume(cp) {
    this.phase = 'restarting';
    this.play([this.call(() => { this.shot = null; this.fade(1); this.resetTo(cp); }), this.wait(0.4), this.fadeS(0, 0.9)]);
    this.onDone = () => ({ drive: () => this.startDrive(), toVan: () => this.startToVan(), van: () => this.startFirstCook() })[cp]();
  }
  // a car that still runs, near here (one's put there if not)
  carNear(at, yaw) { const g = this.g; if (!g.cars.some(c => !c.wrecked && !c.inactive && !c.police && !c.driver && !c.camper && !c.tRec && c.pos.distanceTo(at) < 14)) g.cars.push(new Car(g, g.kerbSnap ? g.kerbSnap(at) : at, yaw, 0x9b1c1c)); }
  // Wren on his feet at a spot, following you
  wrenStand(at) { const W = this.wren; W.script = { pos: at.clone() }; this.wrenUp(W); W.body.setTranslation({ x: at.x, y: at.y + 1.0, z: at.z }, true); W.body.setNextKinematicTranslation({ x: at.x, y: at.y + 1.0, z: at.z }); }

  // ================= the hospital: Wren goes in; he comes out; Vic turns up =================
  arrive() {
    const g = this.g, W = this.wren, pl = g.player, C = g.citizens;
    this.phase = 'arrived'; this.objective(null); this.waypoint(null);
    // where it happens: out the front of the hospital
    const S0 = (g.hospitalSpawn || pl.pos).clone(), yaw = g.hospitalYaw ?? 0, f = V(Math.sin(yaw), 0, Math.cos(yaw)), r = V(f.z, 0, -f.x);
    const at = (a, b) => S0.clone().addScaledVector(f, a).addScaledVector(r, b);
    const wSpot = at(2.4, 0), meSpot = at(2.75, 0.6), door = at(-0.4, 0);
    const wYaw = yaw, meYaw = Math.atan2(wSpot.x - meSpot.x, wSpot.z - meSpot.z) + 0.35;
    // (a clear bit of kerb for Vic's car: no parked car, no real one)
    const free = (q) => !g.parkedCars?.nearest(q, 5) && !g.cars.some(c => !c.inactive && c.pos.distanceTo(q) < 5);
    let vicCarAt = at(11, -5);
    for (const [a, b] of [[11, -5], [11, -9], [11, -13], [11, 3], [11, 7], [13, -5], [13, -9], [13, 3], [9, -11], [9, 8]]) { const q = at(a, b); if (free(q)) { vicCarAt = q; break; } }
    vicCarAt.y = 0.03;
    const vicSpot = at(3.6, -1.9);
    this.afterVic = at(3.2, 1.6); this.afterVicYaw = yaw;
    let vic = null, vicCar = null;
    const place = (n, p, y) => { n.body.setTranslation({ x: p.x, y: p.y + 1.0, z: p.z }, true); n.body.setNextKinematicTranslation({ x: p.x, y: p.y + 1.0, z: p.z }); if (y != null) n.yaw = y; };
    const walkTo = (n, p, y) => { n.state = 'post'; n.home = p.clone(); n.homeYaw = y; n.following = false; };
    const mid = wSpot.clone().lerp(meSpot, 0.5).setY(S0.y + 1.45), two = at(5.4, -1.3).setY(S0.y + 1.6), wHeadish = wSpot.clone().setY(S0.y + 1.45);
    this.play([
      this.call(() => { this.shot = null; }),
      this.line('WREN', 'Wait for me? Please.', 2.2),
      this.fadeS(1, 0.8),
      this.call(() => {
        const car = g.cars.find(c => c.passenger === W); if (car) C.unboard(W, car);
        if (pl.car) pl.exitCar();
        W.human.resetPose(); place(W, door, yaw); walkTo(W, wSpot, wYaw); W.human.setMood('sad');
        pl.scripted = { pos: meSpot.clone(), yaw: meYaw + 0.9, pose: { pose: 'stand' } };
        el('chapter').innerHTML = '<span>An hour later.</span>'; el('chapter').classList.add('on');
      }),
      this.wait(2.0),
      this.call(() => el('chapter').classList.remove('on')),
      this.shotS(at(4.8, -2.6).setY(S0.y + 1.7), at(4.5, -2.3).setY(S0.y + 1.65), door.clone().setY(S0.y + 1.3), wHeadish, 5, 45),
      this.fadeS(0, 1.0),
      { dur: 6, until: () => C.pos(W).distanceTo(wSpot) < 0.5 },
      this.call(() => { W.human.express('sad', 30); }),
      this.shotS(two, two.clone().add(V(0, 0.02, 0)), mid, null, 8, 40),
      this.line('WREN', 'They let me see him.', 2.4),
      this.line('WREN', 'He looked like he was asleep. He always looked about twelve when he was asleep.'),
      this.call(() => { pl.scripted.yaw = meYaw; pl.scripted.pose = { pose: 'stand', comfort: true }; }),
      this.wait(1.4),
      this.line('WREN', 'They gave me his stuff. His phone. His keys.', 3),
      this.line('WREN', '…Thanks.', 2),
      this.wait(1.0),
      // Vic: the red convertible, the sunglasses
      this.call(() => {
        vicCar = new Car(g, vicCarAt, yaw + Math.PI / 2, 0xc81818, 'Convertible', { convertible: true }); vicCar.locked = true; g.cars.push(vicCar);
        const vs = vicCarAt.clone().addScaledVector(f, -1.6);
        vic = C.spawn('Vic', { at: vicCarAt, look: { ...randomLook(), female: false, hairStyle: 'side', hair: 0x6a5a4a, skin: 0xe8b898, shirt: 0xd84a2a, longSleeves: false, pants: 0xd8c8a0, shoes: 0xe8e8e8, height: 1.82, build: 1.18, shades: true } });
        vic.storyNpc = true; vic.mem.met = true; place(vic, vs, yaw + Math.PI); walkTo(vic, vicSpot, Math.atan2(wSpot.x - vicSpot.x, wSpot.z - vicSpot.z)); this.vic = vic;
      }),
      this.call(() => { this.shot = { a: at(5.2, 3.4).setY(S0.y + 1.8), b: at(5.2, 3.4).setY(S0.y + 1.8), la: vicCarAt.clone().lerp(vicSpot, 0.45).setY(S0.y + 1.0), lb: vicCarAt.clone().lerp(vicSpot, 0.45).setY(S0.y + 1.0), dur: 6, t: 0, fov: 50 }; }),
      this.line('VIC', 'Wren! Wrenny. I came as soon as I could.'),
      { dur: 5, until: () => C.pos(vic).distanceTo(vicSpot) < 0.6 },
      this.call(() => { W.yaw = Math.atan2(vicSpot.x - wSpot.x, vicSpot.z - wSpot.z); W.homeYaw = W.yaw; }),
      this.shotS(at(1.0, 2.2).setY(S0.y + 1.65), null, vicSpot.clone().setY(S0.y + 1.6), null, 6, 45),
      this.line('WREN', 'Six calls, Vic. Six.', 2.4),
      this.line('VIC', "I was at a retreat. Phones off, all weekend. It's a whole… it's a process."),
      this.line('WREN', "Kit's dead.", 2.2),
      this.wait(1.2),
      this.line('VIC', "I know. They called me too. I'm here, aren't I?"),
      this.shotS(at(5.0, -1.0).setY(S0.y + 1.6), null, wHeadish, null, 6, 42),
      this.line('WREN', 'The funeral. Are you going to help with the funeral?'),
      this.line('VIC', "Money's… complicated right now. I've made some commitments. The car. The course. I'm investing in myself, Wren."),
      this.line('WREN', 'Unbelievable.', 2),
      this.call(() => { pl.scripted.pose = { pose: 'stand' }; walkTo(W, at(4.5, 5.5), yaw); }),
      this.wait(1.4),
      this.call(() => { const v = C.pos(vic); pl.scripted.yaw = Math.atan2(v.x - meSpot.x, v.z - meSpot.z); vic.homeYaw = Math.atan2(meSpot.x - vicSpot.x, meSpot.z - vicSpot.z); }),
      this.shotS(meSpot.clone().addScaledVector(r, 0.6).addScaledVector(f, 0.9).setY(S0.y + 1.7), null, vicSpot.clone().setY(S0.y + 1.65), null, 9, 40),
      this.line('VIC', "He won't take a cent from me. Never has. It was always him and Kit against me."),
      this.line('VIC', "Help him. However you can. I mean it."),
      this.line('VIC', 'Kit had a van. An old camper, parked up on the beach. He thought I didn\'t know.'),
      this.line('VIC', "The hospital gave me his keys. That one's the van. I don't want it.", 3.6),
      this.call(() => { g.drugs.vanKeys = true; if (g.camper) g.camper.locked = false; g.sfx?.thunk?.(pl.pos); }),
      this.line('VIC', "And whatever he was doing in that thing… don't.", 3.2),
      this.fadeS(1, 0.8),
      this.call(() => {
        C.remove(vic); this.vic = null; // (gone in the convertible: it stays parked, locked)
        pl.scripted = null; place({ body: pl.body }, this.afterVic); pl.yaw = yaw; g.cam.yaw = yaw + Math.PI; g.cam.pitch = 0.15;
        this.wrenStand(this.afterVic.clone().add(V(1.2, 0, 0.6)));
        this.carNear(this.afterVic.clone().add(V(4, 0.03, 3)), yaw + Math.PI / 2);
      }),
      this.fadeS(0, 0.8),
    ]);
    this.onDone = () => { this.startToVan(); g.hud.toast("You've got Kit's keys", '#ffd23f'); };
  }
  startToVan() {
    const g = this.g;
    this.phase = 'toVan'; this.checkpoint = 'toVan'; this.ride = null;
    this.objective("Find <b>Kit's van</b> · on the beach · take Wren");
    if (g.camper) this.waypoint(g.camper.pos.clone(), "Kit's van");
  }

  // ================= the van: what Kit was doing; you cook, he sells =================
  vanScene() {
    const g = this.g, pl = g.player, W = this.wren, C = g.citizens, c = g.camper, van = g.van, D = g.drugs;
    this.phase = 'vanScene'; this.objective(null); this.waypoint(null);
    this.keys(); // (you've had Kit's keys since the hospital; make sure, whatever got skipped)
    const front = c.localPoint(2.6, 1.5, 4.2), mid = c.localPoint(0, 0.9, -0.6), back = c.trunkPoint(2.2);
    const o = van.o, IN = (x, y, z) => V(o.x + x, o.y + y, o.z + z);
    this.play([
      this.call(() => { const car = g.cars.find(k => k.passenger === W); if (car) C.unboard(W, car); if (pl.car) pl.exitCar(); }),
      this.shotS(front, front.clone().add(V(0, 0.1, 0)), mid, null, 7, 50),
      this.line('WREN', "That's his. He slept in it whenever he and Vic weren't talking."),
      this.line('WREN', 'Which was most of the time.', 2.4),
      this.fadeS(1, 0.6),
      this.call(() => {
        van.inside = true;
        pl.scripted = { pos: IN(-0.05, 0.05, 0.7), yaw: Math.PI * 0.85, pose: { pose: 'stand' } };
        W.state = 'scripted'; W.following = false; W.script = { pos: IN(-0.1, 0.69 - 0.95 * (1.68 / 1.75), -1.1), yaw: 0, pose: { pose: 'stairsit' } };
        pl.body.setTranslation({ x: van.entry.x, y: van.entry.y + 1.0, z: van.entry.z }, true); pl.body.setNextKinematicTranslation({ x: van.entry.x, y: van.entry.y + 1.0, z: van.entry.z });
        W.body.setTranslation({ x: o.x - 0.1, y: o.y + 1.0, z: o.z - 1.0 }, true);
        W.human.express('sad', 60);
      }),
      this.shotS(IN(0.6, 1.55, 1.6), IN(0.55, 1.5, 1.45), IN(-0.1, 0.9, -1.3), null, 8, 55),
      this.fadeS(0, 0.8),
      this.line('WREN', 'It smells like him in here.', 2.6),
      this.wait(0.8),
      this.shotS(IN(0.75, 1.45, 1.15), null, IN(0.78, 0.78, 0.3), null, 5, 40),
      this.line('YOU', 'Wren. Look at this.', 2.2),
      this.line('WREN', 'Meridian.', 1.8),
      this.line('WREN', 'He kept saying that word. I thought it was a band he liked.'),
      this.shotS(IN(0.8, 1.45, 0.1), null, IN(-0.1, 1.2, -1.1), null, 8, 42),
      this.line('WREN', 'Times. Temperatures. Prices. He was making it. The blue.'),
      this.line('WREN', 'He made what you two took.', 2.6),
      this.wait(0.9),
      this.line('WREN', 'He made what killed him.', 2.8),
      this.wait(0.8),
      this.call(() => { W.script.pose = { pose: 'stairsit', phone: true }; g.sfx?.thunk?.(pl.pos); }),
      this.line('WREN', "It's his phone. It hasn't stopped all day."),
      this.line('WREN', "'u got any more of the blue.' 'same spot?' 'kit where r u.'", 4),
      this.line('WREN', 'And the hospital wants paying. And the funeral. And a man called Pratt has left four voicemails about money Kit owed him.'),
      this.shotS(IN(-0.35, 1.3, -0.7), null, IN(-0.05, 1.65, 0.7), null, 5, 42),
      this.line('YOU', 'How much?', 1.8),
      this.shotS(IN(0.8, 1.45, 0.1), null, IN(-0.1, 1.2, -1.1), null, 4, 42),
      this.line('WREN', "More than I've got. More than I'll ever have."),
      this.wait(1.0),
      this.shotS(IN(-0.35, 1.3, -0.7), null, IN(-0.05, 1.65, 0.7), null, 9, 42),
      this.line('YOU', "He wasn't doing it right. Look at it. He was rushing it."),
      this.line('YOU', 'I could do it properly. So nobody ends up like him.'),
      this.call(() => { W.script.pose = { pose: 'stairsit' }; }),
      this.shotS(IN(0.8, 1.45, 0.1), null, IN(-0.1, 1.2, -1.1), null, 12, 42),
      this.line('WREN', "…You're serious.", 2.2),
      this.line('WREN', "I can't make it. I can't even look at that stove."),
      this.line('WREN', 'But I know who he sold to. They already text this number.'),
      this.line('WREN', 'You cook. I sell. And Vic never, ever finds out.', 3.6),
      this.fadeS(1, 0.6),
      this.call(() => {
        pl.scripted = null; const e = van.entry; pl.body.setTranslation({ x: e.x, y: e.y + 1.0, z: e.z }, true); pl.body.setNextKinematicTranslation({ x: e.x, y: e.y + 1.0, z: e.z }); pl.yaw = van.entryYaw; g.cam.yaw = pl.yaw + Math.PI; g.cam.pitch = 0.12;
        W.human.resetPose(); const lp = c.localPoint(-1.22, 0, -1.3); W.body.setTranslation({ x: lp.x, y: lp.y + 1.0, z: lp.z }, true); van.wrenLean(W); W.storyLean = true;
        D.solvent = Math.max(D.solvent, 1); D.salts = Math.max(D.salts, 1);
      }),
      this.fadeS(0, 0.6),
    ]);
    this.onDone = () => { this.startFirstCook(); g.hud.toast("Under the sink: a bottle of solvent and a bag of blue salts. Enough for one batch.", '#5fd0ff'); };
  }
  startFirstCook() {
    const g = this.g, W = this.wren;
    this.phase = 'firstCook'; this.checkpoint = 'van'; this.chatT = 6; this.fcIn = null; this.keys();
    if (W) { W.storyLean = false; if (!g.van.inside) g.van.release(); }
    if (!this.inDry()) setTimeout(() => { if (this.phase === 'firstCook' && !this.inDry()) this.sub('WREN', "Not here. People walk their dogs here. Kit always took it out to the Dry: north, over the causeway. Nobody out there.", 5.5); }, 2500);
  }
  keys() { const g = this.g; g.drugs.vanKeys = true; if (g.camper) g.camper.locked = false; }
  inDry() { const c = this.g.camper; return !!c && this.g.desert.inDesert(c.pos.x, c.pos.z); }
  // talking to Wren (and Vic): the story's own options
  options(n) {
    if (n !== this.wren) return [{ id: 'talk', label: 'Talk' }];
    if (this.phase === 'free' && this.g.wren?.unlocked) return this.g.wren.options(n);
    const o = [{ id: 'talk', label: 'Talk' }], D = this.g.drugs;
    if (['giveBags', 'free'].includes(this.phase)) {
      if (D.count) o.push({ id: 'wrengive', label: `Give him ${D.count} bag${D.count > 1 ? 's' : ''} to sell` });
      if (this.phase === 'free') o.push(n.following ? { id: 'wrenhome', label: 'Head home' } : { id: 'wrencome', label: 'Come with me' });
    }
    return o;
  }
  act(n, id) {
    const g = this.g, C = g.citizens, D = g.drugs;
    if (n === this.wren && this.phase === 'free' && g.wren?.unlocked) { g.wren.act(n, id); return true; }
    if (id === 'talk') {
      const lines = n === this.vic ? ["I'm trying, okay?"] : this.phase === 'free' ? (g.wren.stock.length ? [`I've got ${g.wren.stock.length} left. His people are… keen.`, "Pratt left another voicemail. I didn't listen to it.", 'Mrs. Okafor brought soup. I cried in front of her. It was fine.'] : ["I'm out. Cook me some more?", "Kit's people keep asking when there's more.", "Vic texted. Just a thumbs up. To a funeral."]) : n.lines;
      C.say(n, lines[Math.floor(Math.random() * lines.length)], 3.2); return true;
    }
    if (id === 'wrengive') {
      const k = D.count; g.wren.stock.push(...D.bags.splice(0)); g.wren.sellT = 20;
      C.say(n, k >= 8 ? `${k}? Kit never made more than five in a go.` : 'Leave it with me.', 3);
      if (this.phase === 'giveBags') this.moveIn();
      return true;
    }
    if (id === 'wrencome') { n.following = true; n.state = 'follow'; n.home = null; C.say(n, 'Yeah. Okay. Where are we going?', 2.6); return true; }
    if (id === 'wrenhome') { this.wrenHome(); C.say(n, "I'll see you at home.", 2.4); return true; }
    return true;
  }
  // after the first batch: he takes it, and he's staying at yours
  moveIn() {
    const g = this.g, W = this.wren;
    this.phase = 'movingIn'; this.objective(null);
    if (g.van.leaning === W) g.van.leaning = null;
    this.play([
      this.call(() => { this.shot = null; }),
      this.line('WREN', "I'll text his people tonight. Same spots he used. Same prices. No, better prices.", 3.8),
      this.line('WREN', "And I'm staying at yours. I'm not going back to his flat. I can't.", 3.6),
      this.line('WREN', "I'll bring you what I make. Come find me when you've got more.", 3.4),
    ]);
    this.onDone = () => {
      this.phase = 'free'; W.storyLean = false;
      g.apt.wrenBed.visible = true; this.wrenHome(true); g.wren.unlock();
      g.hud.toast("Wren's selling for you. Bring him more bags at home (1E), or take him along.", '#5fd0ff');
      setTimeout(() => g.missions?.start('cooks'), 4500);
    };
  }
  // Wren goes back to 1E (out of sight, he's just there)
  wrenHome(now) {
    const g = this.g, W = this.wren, h = g.apt.wrenSpot;
    W.following = false; W.script = null;
    const put = () => { W.human.resetPose(); W.body.setTranslation({ x: h.x, y: h.y + 1.0, z: h.z }, true); W.body.setNextKinematicTranslation({ x: h.x, y: h.y + 1.0, z: h.z }); W.state = 'post'; W.home = h.clone(); W.homeYaw = g.apt.wrenYaw; };
    if (now) { put(); return; }
    W.state = 'idle'; W.stateT = 99; // (he heads off; a few seconds later he's home)
    setTimeout(() => { if (!W.following && W.state !== 'dead') put(); }, 4000);
  }

  // what moves the story on, outside the scenes
  phaseUpdate(dt) {
    const g = this.g, pl = g.player, A = g.apt, W = this.wren, D = g.drugs;
    if (this.phase === 'dress' && !this.newsDone && pl.pos.distanceTo(A.room1E) < 4.2) {
      this.newsDone = true; A.tvDraw(true);
      this.sub('CHANNEL 6', '…a second person taken to hospital this week after taking an unidentified blue substance…', 5);
      setTimeout(() => { if (this.phase === 'dress' || this.phase === 'dressing' || this.phase === 'phoneWait') this.sub('CHANNEL 6', 'Police are asking anyone with information to come forward.', 4); }, 5200);
    }
    if (this.phase === 'failed' && !g.ending && !pl.dead && !this.cine) this.restart();
    if (this.phase === 'phoneWait' && (this.phoneT -= dt) <= 0) this.openPhone();
    if (this.phase === 'wren' && W && pl.pos.distanceTo(W.script.pos) < 4.6 && !pl.car) this.stairs();
    // Wren dying (or the car he's in going up) sends you back to the checkpoint
    if (['hospital', 'toVan', 'firstCook', 'giveBags'].includes(this.phase) && W) {
      if (pl.car) this.ride = pl.car; else if (W.state === 'seated') this.ride = g.cars.find(c => c.passenger === W) || this.ride;
      if (this.ride?.wrecked && (W.state === 'seated' || this.phase === 'hospital')) { this.fail('car'); return; }
      if (W.state === 'dead' || W.hp <= 0 || !g.citizens.list.includes(W)) { this.fail('wren'); return; }
      if (!W.storyLean && g.van?.leaning !== W && W.state !== 'seated' && W.state !== 'dead') { W.following = true; if (W.state !== 'follow') W.state = 'follow'; }
    }
    if (this.phase === 'hospital' && W) {
      const H = g.places['the hospital'], at = pl.car ? pl.car.pos : pl.pos;
      if (H && at.distanceTo(H.pos) < 32 && (!pl.car || Math.abs(pl.car.speed) < 2) && (W.state === 'seated' || g.citizens.pos(W).distanceTo(pl.pos) < 8)) this.arrive();
    }
    if (this.phase === 'toVan' && W && g.camper) {
      const near = pl.pos.distanceTo(g.camper.pos) < 9 && !pl.car && g.citizens.pos(W).distanceTo(pl.pos) < 10;
      if (near) this.vanScene();
    }
    // the first cook: Wren talks through the wall; if it goes wrong there's more under the sink
    if (this.phase === 'firstCook') {
      const inD = this.inDry();
      if (inD !== this.fcIn) {
        this.fcIn = inD;
        if (inD) { this.objective('Cook a batch at the <b>stove</b> (the back of the van) · Wren keeps watch'); this.waypoint(null); }
        else { this.objective('Drive the <b>van</b> out to <b>the Dry</b> with Wren (north, over the causeway) · cook in town and someone will smell it'); this.waypoint(V(130, 0, -900), 'the Dry'); }
      }
      if (D.cook && (this.chatT -= dt) <= 0) { this.chatT = 9 + Math.random() * 4; this.sub('WREN', ["(outside) You okay in there?", "(outside) It smells like a science class out here.", "(outside) Don't blow yourself up. I can't do two of these.", "(outside) Someone just walked past. Act normal. Wait, you can't see me."][Math.floor(Math.random() * 4)], 3.2); }
      if (!D.cook && D.count > 0) { this.phase = 'giveBags'; this.objective('Give <b>Wren</b> the bags · he\'s outside, by the van'); g.hud.toast('Hold E on Wren to give him the bags', '#5fd0ff'); }
      else if (!D.cook && D.solvent < 1 && D.salts < 1 && D.count === 0) { D.solvent = 1; D.salts = 1; g.hud.toast("There's one more lot under the sink. Try again.", '#5fd0ff'); }
    }
    if (this.phase === 'free' && W) {
      // (for now, if Wren dies he's patched up at the hospital and back at yours a minute later)
      if ((W.state === 'dead' || !g.citizens.list.includes(W)) && !this.wrenBackT) this.wrenBackT = 60;
      if (this.wrenBackT && (this.wrenBackT -= dt) <= 0) { this.wrenBackT = 0; if (g.citizens.list.includes(W)) g.citizens.remove(W); this.spawnWren(); this.wren.script = null; this.wrenHome(true); g.hud.toast("Wren's out of hospital. He's back at yours.", '#ffb27a'); }
    }
  }
}
