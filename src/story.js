// The story. PHY2ICK is a prequel: before PHYSICK, before Wren is gone.
// It opens the morning after: you wake up in an ice bath with no memory of the night. Kit (Wren's younger
// brother) put you there, and then he lay down and didn't get up. Wren's on the stairs with the phone.
// Not missions: a few scenes, an objective line, and then the city. (The money, Pratt and Vic come later.)
//
// The scenes are lists of steps run one after another: a step can last a while (dur), wait for something
// (until), and do things as it starts, as it runs and as it ends. Enter, Space or Escape skips a scene.
import * as THREE from 'three';
import { randomLook } from './character.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = (k) => k * k * (3 - 2 * k);
const el = (id) => document.getElementById(id);

const SKINS = [0xf2d0b4, 0xe4b894, 0xd2a07a, 0xb98258, 0x96643e, 0x744a2c, 0x4e301e];
const HAIRS = [0x16100c, 0x2a1d14, 0x5a3a22, 0x8a5a30, 0xc8a060, 0x8a2e1a, 0x9a9a9a];
const STYLES = [['short', 'Short'], ['buzz', 'Buzzed'], ['curly', 'Curly'], ['afro', 'Afro'], ['long', 'Long'], ['ponytail', 'Ponytail'], ['bob', 'Bob'], ['bald', 'Bald']];
const WHO = { WREN: '#ffb27a', YOU: '#9ad0ff', 'CHANNEL 6': '#ff6a5a', KIT: '#7be08a' };

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
    if (!this.cur) { this.steps = null; this.cine = false; this.shot = null; document.body.classList.remove('cine'); el('letterbox').classList.remove('on'); this.sub(null); const done = this.onDone; this.onDone = null; done?.(); return; }
    this.cur.start?.();
    if (!this.cur.dur && !this.cur.until) this.next();
  }
  skip() {
    if (!this.steps) return;
    let guard = 0;
    while (this.steps && guard++ < 200) { this.cur?.update?.(1, 0); this.next(); }
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
    this.objective('Find <b>Wren</b> · she\'s on the stairs');
    this.waypoint(this.wren.script.pos.clone(), 'Wren');
  }

  // Wren: sat on the stairs, on the phone
  spawnWren() {
    const g = this.g, C = g.citizens, A = g.apt;
    const step = A.stairStep(14), seat = V(step.x + 0.6, step.y, step.z + 0.2);
    const n = C.spawn('Wren', { at: seat, look: { ...randomLook(), female: true, hairStyle: 'long', hair: 0x5a2416, skin: 0xe8b898, shirt: 0x4a5a3a, longSleeves: true, pants: 0x2a3040, shoes: 0x5a1d1d, height: 1.68, build: 0.95 } });
    n.body.setTranslation({ x: seat.x, y: seat.y + 1.2, z: seat.z }, true);
    n.storyNpc = true; n.mood = 60; n.mem.met = true; n.home = null;
    n.lines = ["I keep looking at my phone like he's going to text.", "Vic still isn't picking up.", 'Just drive. Please.', "Don't. I can't talk about it yet."];
    n.state = 'scripted'; n.script = { pos: V(seat.x, seat.y + 0.1 - 0.95 * (1.68 / 1.75), seat.z), yaw: 0, pose: { pose: 'stairsit', phone: true } };
    this.wren = n;
  }

  // the stairs: she's just been told
  stairs() {
    const g = this.g, pl = g.player, A = g.apt, W = this.wren, Ws = W.script;
    this.phase = 'stairs'; this.objective(null); this.waypoint(null);
    const up = A.stairStep(18), me = V(up.x - 0.45, up.y, up.z);
    pl.scripted = { pos: me, yaw: 0, pose: { pose: 'stand' } };
    W.human.root.updateMatrixWorld(true);
    const wHead = W.human.b.head.getWorldPosition(V()).add(V(0, 0.1, 0)), myHead = me.clone().add(V(0, 1.66, 0));
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
        const p = Ws.pos; W.body.setTranslation({ x: p.x, y: p.y + 1.0, z: p.z + 0.4 }, true); W.body.setNextKinematicTranslation({ x: p.x, y: p.y + 1.0, z: p.z + 0.4 });
        W.state = 'follow'; W.following = true; W.script = null; W.human.resetPose();
      }),
      this.fadeS(0, 0.6),
    ]);
    this.onDone = () => {
      this.phase = 'hospital';
      const H = g.places['the hospital'];
      this.objective('Drive <b>Wren</b> to the hospital · your car\'s out the front');
      if (H) this.waypoint(H.pos, 'the hospital');
    };
  }

  // at the hospital: she goes in alone
  arrive() {
    const g = this.g, W = this.wren, pl = g.player;
    this.phase = 'arrived'; this.objective(null); this.waypoint(null);
    this.play([
      this.call(() => { this.shot = null; }),
      this.line('WREN', 'Thanks.', 1.8),
      this.line('WREN', "I'll call you. When I know… when I know anything.", 3.4),
      this.fadeS(1, 1.0),
      this.call(() => {
        const car = g.cars.find(c => c.passenger === W); if (car) { car.passenger = null; car.unseat(W.human); }
        W.following = false; g.citizens.remove(W); this.wren = null;
        el('chapter').innerHTML = '<b>PHY2ICK</b><span>for Kit</span><small>The story continues soon. Halyard is yours in the meantime.</small>'; el('chapter').classList.add('on');
      }),
      this.wait(4.5),
      this.call(() => el('chapter').classList.remove('on')),
      this.fadeS(0, 1.0),
    ]);
    this.onDone = () => { this.phase = 'done'; };
  }

  // what moves the story on, outside the scenes
  phaseUpdate(dt) {
    const g = this.g, pl = g.player, A = g.apt;
    if (this.phase === 'dress' && !this.newsDone && pl.pos.distanceTo(A.room1E) < 4.2) {
      this.newsDone = true; A.tvDraw(true);
      this.sub('CHANNEL 6', '…a second person taken to hospital this week after taking an unidentified blue substance…', 5);
      setTimeout(() => { if (this.phase === 'dress' || this.phase === 'dressing' || this.phase === 'phoneWait') this.sub('CHANNEL 6', 'Police are asking anyone with information to come forward.', 4); }, 5200);
    }
    if (this.phase === 'phoneWait' && (this.phoneT -= dt) <= 0) this.openPhone();
    if (this.phase === 'wren' && this.wren && pl.pos.distanceTo(this.wren.script.pos) < 4.6 && !pl.car) this.stairs();
    if (this.phase === 'hospital' && this.wren) {
      const W = this.wren; if (W.state !== 'seated' && W.state !== 'dead') { W.following = true; if (W.state !== 'follow') W.state = 'follow'; }
      const H = g.places['the hospital'], at = pl.car ? pl.car.pos : pl.pos;
      if (H && at.distanceTo(H.pos) < 32 && (!pl.car || Math.abs(pl.car.speed) < 2) && (W.state === 'seated' || g.citizens.pos(W).distanceTo(pl.pos) < 8)) this.arrive();
    }
  }
}
