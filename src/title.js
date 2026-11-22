// The title screen: a timelapse on the beach by Kit's van. The day runs by in seconds. Wren sits on the sand in
// a hazmat suit; you come out of the back and hand him the bags; he walks off along the beach to the dealers,
// sells, and comes back and sits down again. Now and then a police car pulls up by the dealers, a cop gets out
// and asks a few questions, and they suddenly find their phones, the sea and a nice tune very interesting.
// The title theme plays over it.
import * as THREE from 'three';
import { Car } from './car.js';
import { randomLook } from './character.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const SUIT = 0xe2c21a;
const ease = (k) => k * k * (3 - 2 * k);

export class Title {
  constructor(g) {
    this.g = g; this.t = 0; this.active = false;
    this.music = new Audio(import.meta.env.BASE_URL + 'audio/title.mp3'); this.music.loop = true; this.music.volume = 0.75;
  }

  start() {
    const g = this.g, C = g.citizens, c = g.camper; if (!c || this.active) return;
    this.active = true; document.body.classList.add('title');
    this.sun0 = { dir: g.sunDir.clone(), i: g.sun.intensity, col: g.sun.color.clone(), hemi: g.hemi?.intensity, fog: g.scene.fog.color.clone(), env: g.scene.environmentIntensity };
    const pl = g.player; pl.human.root.visible = false; pl.scripted = { pos: c.localPoint(-30, 0, 0), yaw: 0, pose: { pose: 'stand' } };
    // laid out along the beach: A runs along it (the way the van faces), N inland (away from the sea)
    const O = c.localPoint(0, 0, 0), A = c.localPoint(0, 0, 1).sub(O).setY(0).normalize(), N = V(0, 0, -1); // (the sea's to the south)
    const W2 = (a, n, y = 0) => O.clone().addScaledVector(A, a).addScaledVector(N, n).setY(O.y + y);
    this.sitAt = W2(-1.6, 1.35, 0.02); this.door = c.trunkPoint(0.55); this.giveAt = W2(-2.6, 2.1);
    this.dealAt = W2(9, 4.2); this.sellAt = W2(7.4, 4.6);
    const M = W2(4.2, 2.2); this.cam0 = M.clone().addScaledVector(N, 13).setY(O.y + 2.3); this.look0 = M.clone().addScaledVector(N, -1).setY(O.y + 1.1);
    // Wren, in the suit (no hood, no mask)
    const W = this.wren = C.spawn('Wren', { at: this.sitAt, look: { ...randomLook(), female: false, hairStyle: 'swept', hair: 0x5a2416, shirt: SUIT, pants: SUIT, shoes: 0x2a2a2a, longSleeves: true, skin: 0xe8b898, height: 1.76, build: 1.0 } });
    W.storyNpc = true; this.sit(W);
    // you
    const me = this.me = C.spawn('You', { at: this.door, look: g.player.outfit('dressed') });
    me.storyNpc = true; this.hide(me);
    // three dealers, standing about
    this.dealers = [0, 1, 2].map((i) => {
      const a = i * 2.1 + 0.4, p = this.dealAt.clone().add(V(Math.sin(a) * 1.3, 0, Math.cos(a) * 1.3));
      const n = C.spawn('Dealer', { at: p }); n.storyNpc = true; n.state = 'scripted';
      n.script = { pos: p, yaw: Math.atan2(this.dealAt.x - p.x, this.dealAt.z - p.z), pose: { pose: 'stand' } }; this.place(n, p); n.innocent = i; return n;
    });
    // the police car (and the cop in it)
    this.copPath = { from: W2(50, 0.4), stop: W2(12.2, 0.4), out: [W2(7.5, 6.8), W2(0, 9.2), W2(-40, 10.5)] };
    this.copStand = W2(10.4, 2.5);
    const pc = this.cop = new Car(g, this.copPath.from.clone().setY(-60), 0, 0x111418, 'Police', { police: true }); g.cars.push(pc);
    pc.body.setGravityScale(0, true); pc.lightsOnly = false;
    pc.group.updateMatrixWorld(true); this.copY = this.dealAt.y + (pc.body.translation().y - pc.localPoint(0, 0, 0).y);
    this.copHide();
    // the running order
    this.step = 'sit'; this.stepT = 5; this.copT = 22;
    this.t = 0;
    const play = () => this.music.play().catch(() => {});
    this.music.play().catch(() => { // (browsers want a click or a key before music: the first one starts it)
      const go = () => { if (this.active) play(); removeEventListener('pointerdown', go); removeEventListener('keydown', go); };
      addEventListener('pointerdown', go); addEventListener('keydown', go);
    });
  }
  place(n, p) { n.body.setTranslation({ x: p.x, y: p.y + 1.0, z: p.z }, true); n.body.setNextKinematicTranslation({ x: p.x, y: p.y + 1.0, z: p.z }); }
  hide(n) { n.state = 'scripted'; n.script = { pos: this.door.clone(), yaw: 0, hidden: true }; this.place(n, this.door.clone().setY(-60)); }
  sit(W) { W.state = 'scripted'; W.script = { pos: this.sitAt.clone(), yaw: Math.atan2(this.cam0.x - this.sitAt.x, this.cam0.z - this.sitAt.z) + 0.3, pose: { pose: 'groundsit' } }; this.place(W, this.sitAt); }
  walk(n, to, yaw) { if (n.state === 'scripted') { const p = n.script?.pos; if (p && !n.script.hidden) this.place(n, p); n.human.resetPose(); } n.script = null; n.state = 'post'; n.home = to.clone(); n.homeYaw = yaw ?? n.yaw; }
  at(n, p, d = 0.5) { return this.g.citizens.pos(n).distanceTo(p) < d; }
  copHide() { const pc = this.cop, p = this.copPath.from; pc.body.setTranslation({ x: p.x, y: -60, z: p.z }, true); pc.body.setLinvel({ x: 0, y: 0, z: 0 }, true); pc.body.setAngvel({ x: 0, y: 0, z: 0 }, true); }
  copAt(p, yaw, spd) {
    const pc = this.cop;
    pc.body.setTranslation({ x: p.x, y: this.copY, z: p.z }, true); pc.body.setRotation(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), true);
    pc.body.setLinvel({ x: Math.sin(yaw) * spd, y: 0, z: Math.cos(yaw) * spd }, true); pc.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  update(dt) {
    if (!this.active) return;
    const g = this.g, C = g.citizens, W = this.wren, me = this.me;
    this.t += dt;
    // the timelapse: the sun across the sky in about forty seconds; dusk, a short night, dawn
    const ph = (this.t / 42 + 0.12) % 1, el = Math.sin(ph * Math.PI * 2) * 62 - 6, az = 80 + ph * 200;
    g.sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - el), THREE.MathUtils.degToRad(az));
    g.sky?.material.uniforms.sunPosition.value.copy(g.sunDir);
    const day = THREE.MathUtils.smoothstep(el, -6, 14), warm = 1 - THREE.MathUtils.smoothstep(el, 4, 30);
    g.sun.intensity = 3.4 * day + 0.45 * (1 - day); // (at night: the moon)
    g.sun.color.setRGB(1, 0.93 - warm * 0.3, 0.87 - warm * 0.5).lerp(new THREE.Color(0.55, 0.65, 1), 1 - day);
    if (g.hemi) g.hemi.intensity = 0.2 + 0.15 * day;
    g.scene.environmentIntensity = 0.3 + 0.45 * day;
    g.scene.fog.color.setRGB(0.12 + 0.6 * day, 0.14 + 0.64 * day, 0.2 + 0.62 * day);
    this.cop.lightsOnly = day < 0.35 && this.copT < 0;

    // you and Wren: out with the bags, he takes them, off along the beach to sell, back, sits down again
    this.stepT -= dt;
    const meYaw = Math.atan2(this.sitAt.x - this.giveAt.x, this.sitAt.z - this.giveAt.z);
    switch (this.step) {
      case 'sit': if (this.stepT <= 0 && this.copT > 6) { this.place(me, this.door); this.walk(me, this.giveAt, meYaw); this.step = 'out'; this.stepT = 9; } break;
      case 'out': if (this.at(me, this.giveAt) || this.stepT <= 0) { this.walk(W, this.sitAt.clone().add(V(0, 0, 0)), meYaw + Math.PI); W.human.resetPose(); this.step = 'give'; this.stepT = 2.2; C.say(W, pick(['How many?', 'Same as last time?', 'Okay. Okay.']), 1.8); } break;
      case 'give': me.giving = this.stepT < 1.7 && this.stepT > 0.6; W.giving = this.stepT < 1.3 && this.stepT > 0.6;
        if (this.stepT <= 0) { me.giving = W.giving = false; this.walk(me, this.door, g.camper.yaw + Math.PI); this.walk(W, this.sellAt, Math.atan2(this.dealAt.x - this.sellAt.x, this.dealAt.z - this.sellAt.z)); this.step = 'away'; this.stepT = 14; } break;
      case 'away':
        if (me.state === 'post' && this.at(me, this.door, 0.6)) this.hide(me);
        if (this.at(W, this.sellAt, 0.6) || this.stepT <= 0) { this.step = 'deal'; this.stepT = 3.2; this.dealers[0].script.pose = { pose: 'stand', comfort: true }; C.say(this.dealers[0], pick(['Ooh. The blue.', "Kit's stuff?", 'Pleasure.']), 2.2); W.giving = true; }
        break;
      case 'deal': if (this.stepT <= 0) { if (me.state === 'post') this.hide(me); W.giving = false; this.dealers[0].script.pose = { pose: 'stand' }; this.walk(W, this.sitAt, 0); this.step = 'back'; this.stepT = 14; } break;
      case 'back': if (this.at(W, this.sitAt, 0.5) || this.stepT <= 0) { this.sit(W); this.step = 'sit'; this.stepT = 9 + Math.random() * 5; } break;
    }
    // (the give: an arm out, like a hand on a shoulder)
    for (const n of [me, W]) if (n.state === 'post' && n.giving) { n.waveT = 0; n.pointT = 0.2; }

    // the police: pull up by the dealers; a cop gets out, asks around; back in; off inland
    this.copT -= dt;
    const P = this.copPath, k = -this.copT;
    if (this.copT > 0) this.copHide();
    else if (k < 7) { const e = 1 - Math.pow(1 - k / 7, 2), p = P.from.clone().lerp(P.stop, e); this.copAt(p, Math.atan2(P.stop.x - P.from.x, P.stop.z - P.from.z), (1 - e) * 9); }
    else if (k < 23) {
      this.copAt(P.stop, Math.atan2(P.stop.x - P.from.x, P.stop.z - P.from.z), 0);
      if (!this.cp) { const n = this.cp = C.spawn('Officer', { at: P.stop, look: { ...randomLook(), hairStyle: 'cap', shirt: 0x24324e, pants: 0x1b1d22, shoes: 0x111111, longSleeves: true } }); n.storyNpc = true; this.cop.openDoor('driver', 1.2); const d = this.cop.doorPoint('driver', 1.0); this.place(n, d); this.walk(n, this.copStand, Math.atan2(this.dealAt.x - this.copStand.x, this.dealAt.z - this.copStand.z)); this.copSaid = 0; }
      const n = this.cp;
      if (this.copSaid === 0 && this.at(n, this.copStand, 0.7)) { this.copSaid = 1; this.copTalkT = 0; C.say(n, pick(['Evening, lads. Anything going on?', 'Gentlemen. Seen anything blue round here?', "What's all this, then?"]), 3); }
      if (this.copSaid === 1 && (this.copTalkT += dt) > 3.2) { this.copSaid = 2; C.say(this.dealers[1], pick(['Just enjoying the view, officer.', 'Lovely evening for it.', 'Nothing, officer. Nothing at all.']), 3); }
      if (this.copSaid === 2 && (this.copTalkT += dt) > 7) { this.copSaid = 3; C.say(n, 'Mm-hm.', 2); this.walk(n, this.cop.doorPoint('driver', 1.0), 0); }
      if (this.copSaid === 3 && (this.at(n, this.cop.doorPoint('driver', 1.0), 0.8) || k > 22)) { this.cop.openDoor('driver', 0.8); C.remove(n); this.cp = null; this.copSaid = 4; }
    } else if (k < 33) {
      if (this.cp) { C.remove(this.cp); this.cp = null; }
      const pts = [P.stop, ...P.out], u = THREE.MathUtils.clamp((k - 23) / 10, 0, 1), e = u * u, segs = pts.length - 1, f = e * segs, i = Math.min(segs - 1, Math.floor(f)), a = pts[i], b = pts[i + 1];
      const p = a.clone().lerp(b, f - i), yaw = Math.atan2(b.x - a.x, b.z - a.z); this.copAt(p, yaw, 2 + u * 10);
    } else { this.copT = 30 + Math.random() * 15; this.copHide(); }
    // the dealers: chatting, until the police are about; then, suddenly, nothing to see here
    const heat = this.copT < 0 && k < 30;
    for (const n of this.dealers) {
      const S = n.script, p = S.pos;
      if (heat) {
        if (n.innocent === 0) S.pose = { pose: 'stand', phone: true };
        if (n.innocent === 1) { S.look = 0.9; if (Math.random() < dt * 0.3) C.say(n, pick(['♪ ♫ ♪', '♪ hm hm hmm ♪']), 1.6); }
        if (n.innocent === 2) { S.yaw = Math.atan2(p.x - this.cop.pos.x, p.z - this.cop.pos.z); S.pose = { pose: 'stand', lean: true }; }
      } else {
        S.yaw = Math.atan2(this.dealAt.x - p.x, this.dealAt.z - p.z); S.look = 0; if (!S.pose.comfort) S.pose = { pose: 'stand' };
        if (Math.random() < dt * 0.08) C.say(n, pick(['Same spot tomorrow.', 'You hear about the blue?', 'Nah, man.', 'Ha!']), 2.2);
      }
    }
  }
  camera() {
    if (!this.active) return;
    const g = this.g, cam = g.camera, k = Math.sin(this.t * 0.05);
    cam.position.copy(this.cam0).add(V(k * 0.6, Math.sin(this.t * 0.09) * 0.12, k * 0.3));
    cam.lookAt(this.look0);
    if (cam.fov !== 55) { cam.fov = 55; cam.updateProjectionMatrix(); }
  }

  // Play: the title's people go, the sun goes back, the music fades
  end() {
    if (!this.active) return;
    const g = this.g, C = g.citizens, s = this.sun0;
    this.active = false; document.body.classList.remove('title');
    for (const n of [this.wren, this.me, this.cp, ...this.dealers]) if (n && C.list.includes(n)) C.remove(n);
    const pc = this.cop; g.scene.remove(pc.group); g.world.removeVehicleController(pc.vc); g.world.removeRigidBody(pc.body); g.cars.splice(g.cars.indexOf(pc), 1);
    g.sunDir.copy(s.dir); g.sky?.material.uniforms.sunPosition.value.copy(s.dir); g.sun.intensity = s.i; g.sun.color.copy(s.col); if (g.hemi) g.hemi.intensity = s.hemi; g.scene.fog.color.copy(s.fog); g.scene.environmentIntensity = s.env;
    g.player.human.root.visible = true; g.player.scripted = null;
    const m = this.music, v0 = m.volume; let i = 0;
    const fade = setInterval(() => { i++; m.volume = Math.max(0, v0 * (1 - i / 20)); if (i >= 20) { clearInterval(fade); m.pause(); } }, 75);
  }
}
