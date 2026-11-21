// The title screen: a timelapse outside Kit's van. The day runs by in seconds; Wren sits on the ground in a
// hazmat suit and gas mask; now and then you climb out of the back and stand with her for a bit; and every so
// often a police car comes round, slowly circling a couple of dealers, who suddenly find their phones very
// interesting. The title theme plays over it.
import * as THREE from 'three';
import { Car } from './car.js';
import { randomLook } from './character.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const SUIT = 0xe2c21a;

export class Title {
  constructor(g) {
    this.g = g; this.t = 0; this.active = false;
    this.music = new Audio(import.meta.env.BASE_URL + 'audio/title.mp3'); this.music.loop = true; this.music.volume = 0.75;
  }

  start() {
    const g = this.g, C = g.citizens, c = g.camper; if (!c || this.active) return;
    this.active = true; document.body.classList.add('title');
    this.sun0 = { dir: g.sunDir.clone(), i: g.sun.intensity, col: g.sun.color.clone(), hemi: g.hemi?.intensity, fog: g.scene.fog.color.clone(), env: g.scene.environmentIntensity };
    // (the real you waits out of the way, unseen)
    const pl = g.player; pl.human.root.visible = false; pl.scripted = { pos: c.localPoint(-8, 0, 6), yaw: 0, pose: { pose: 'stand' } };
    // the shot: across the back of the van, Wren on the ground by its side, the car park behind
    this.wrenAt = c.localPoint(-1.25, 0.02, -2.05); this.door = c.trunkPoint(0.55); this.nextTo = c.localPoint(-1.25, 0, -2.85);
    this.cam0 = c.localPoint(-5.8, 1.55, -6.4); this.look0 = c.localPoint(-0.9, 0.85, -1.6);
    const away = this.look0.clone().sub(this.cam0).setY(0).normalize(), side = V(away.z, 0, -away.x);
    this.dealAt = this.look0.clone().addScaledVector(away, 15).addScaledVector(side, -7); this.dealAt.y = 0.05;
    // Wren, in the suit and the mask
    const W = this.wren = C.spawn('Wren', { at: this.wrenAt, look: { ...randomLook(), female: true, hairStyle: 'bald', hazmat: true, shirt: SUIT, pants: SUIT, shoes: 0x2a2a2a, longSleeves: true, skin: 0xe8b898, hair: 0x5a2416, height: 1.68, build: 0.98 } });
    W.state = 'scripted'; W.storyNpc = true; W.script = { pos: this.wrenAt.clone(), yaw: Math.atan2(away.x, away.z) + Math.PI + 0.5, pose: { pose: 'groundsit' } };
    this.place(W, this.wrenAt);
    // you (in and out of the van)
    const me = this.me = C.spawn('You', { at: this.door, look: g.player.outfit('dressed') });
    me.storyNpc = true; me.state = 'scripted'; me.script = { pos: this.door.clone(), yaw: 0, hidden: true }; this.place(me, this.door.clone().setY(-60)); this.meT = 4;
    // three dealers, standing about
    this.dealers = [0, 1, 2].map((i) => {
      const a = i * 2.1 + 0.4, p = this.dealAt.clone().add(V(Math.sin(a) * 1.3, 0, Math.cos(a) * 1.3));
      const n = C.spawn('Dealer', { at: p }); n.storyNpc = true; n.state = 'scripted';
      n.script = { pos: p, yaw: Math.atan2(this.dealAt.x - p.x, this.dealAt.z - p.z), pose: { pose: 'stand' } }; this.place(n, p); n.innocent = i; return n;
    });
    // the police car that comes round now and then
    const pc = this.cop = new Car(g, this.dealAt.clone().add(V(0, -60, 0)), 0, 0x111418, 'Police', { police: true }); g.cars.push(pc);
    pc.body.setGravityScale(0, true); pc.lightsOnly = true; this.copT = 7; this.copA = 0;
    pc.group.updateMatrixWorld(true); this.copY = (this.dealAt.y - 0.02) + (pc.body.translation().y - pc.localPoint(0, 0, 0).y) + 0.02; // (the body's height over the road)
    this.t = 0;
    const play = () => this.music.play().catch(() => {});
    this.music.play().catch(() => { // (browsers want a click or a key before music: the first one starts it)
      const go = () => { if (this.active) play(); removeEventListener('pointerdown', go); removeEventListener('keydown', go); };
      addEventListener('pointerdown', go); addEventListener('keydown', go);
    });
  }
  place(n, p) { n.body.setTranslation({ x: p.x, y: p.y + 1.0, z: p.z }, true); n.body.setNextKinematicTranslation({ x: p.x, y: p.y + 1.0, z: p.z }); }

  update(dt) {
    if (!this.active) return;
    const g = this.g, C = g.citizens;
    this.t += dt;
    // the timelapse: the sun across the sky in about forty seconds; dusk, a short night, dawn
    const ph = (this.t / 42 + 0.12) % 1, el = Math.sin(ph * Math.PI * 2) * 62 - 6, az = 80 + ph * 200;
    g.sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - el), THREE.MathUtils.degToRad(az));
    g.sky?.material.uniforms.sunPosition.value.copy(g.sunDir);
    const day = THREE.MathUtils.smoothstep(el, -6, 14), warm = 1 - THREE.MathUtils.smoothstep(el, 4, 30);
    g.sun.intensity = 3.4 * day; g.sun.color.setRGB(1, 0.93 - warm * 0.3, 0.87 - warm * 0.5);
    if (g.hemi) g.hemi.intensity = 0.1 + 0.25 * day;
    g.scene.environmentIntensity = 0.18 + 0.57 * day;
    g.scene.fog.color.setRGB(0.12 + 0.6 * day, 0.14 + 0.64 * day, 0.2 + 0.62 * day);
    // you: out of the back, over to Wren, a while there, back in
    const me = this.me; this.meT -= dt;
    if (this.meT <= 0) {
      if (me.state === 'scripted' && me.script.hidden) { this.place(me, this.door); me.script = null; me.state = 'post'; me.home = this.nextTo.clone(); me.homeYaw = this.wren.script.yaw; me.meStage = 'out'; this.meT = 13; }
      else if (me.meStage === 'out') { me.home = this.door.clone(); me.homeYaw = this.g.camper.yaw + Math.PI; me.meStage = 'in'; this.meT = 7; if (Math.random() < 0.5) C.say(this.wren, pick(['Mmf.', '(through the mask) Five more minutes.', '…']), 2); }
      else { me.state = 'scripted'; me.script = { pos: this.door.clone(), yaw: 0, hidden: true }; this.place(me, this.door.clone().setY(-60)); me.meStage = null; this.meT = 8 + Math.random() * 8; }
    }
    if (me.meStage === 'in' && C.pos(me).distanceTo(this.door) < 0.5) this.meT = Math.min(this.meT, 0.2);
    // the police car: comes round, circles the dealers slowly, goes again
    const pc = this.cop; this.copT -= dt;
    const R = 7, w = 3.6 / R, lap = 15;
    if (this.copT <= 0 && this.copT > -lap) {
      const k = -this.copT, a = this.copA + k * w, p = this.dealAt.clone().add(V(Math.sin(a) * R, 0, Math.cos(a) * R)), yaw = Math.atan2(Math.cos(a), -Math.sin(a));
      pc.body.setTranslation({ x: p.x, y: this.copY, z: p.z }, true); pc.body.setRotation(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), true);
      pc.body.setLinvel({ x: Math.sin(yaw) * 3.6, y: 0, z: Math.cos(yaw) * 3.6 }, true); pc.body.setAngvel({ x: 0, y: w, z: 0 }, true);
    } else if (this.copT <= -lap) { this.copT = 14 + Math.random() * 10; this.copA = Math.random() * 6.28; pc.body.setTranslation({ x: this.dealAt.x, y: -60, z: this.dealAt.z }, true); pc.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
    else { pc.body.setTranslation({ x: this.dealAt.x, y: -60, z: this.dealAt.z }, true); pc.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
    // the dealers: chatting, until the police come round; then, suddenly, nothing to see here
    const near = this.copT <= 0 && this.copT > -lap && pc.pos.distanceTo(this.dealAt) < 14;
    for (const n of this.dealers) {
      const S = n.script, p = S.pos;
      if (near) {
        const away = Math.atan2(p.x - pc.pos.x, p.z - pc.pos.z);
        if (n.innocent === 0) S.pose = { pose: 'stand', phone: true };
        if (n.innocent === 1) { S.look = 0.9; if (Math.random() < dt * 0.4) C.say(n, pick(['♪ ♫ ♪', '♪ hm hm hmm ♪']), 1.6); }
        if (n.innocent === 2) { S.yaw = away; S.pose = { pose: 'stand', lean: true }; }
      } else {
        S.yaw = Math.atan2(this.dealAt.x - p.x, this.dealAt.z - p.z); S.look = 0; S.pose = { pose: 'stand' };
        if (Math.random() < dt * 0.12) C.say(n, pick(['Same spot tomorrow.', 'You hear about the blue?', 'Nah, man.', 'Ha!', "Who's got the time?"]), 2.2);
      }
    }
  }
  camera() {
    if (!this.active) return;
    const g = this.g, cam = g.camera, k = Math.sin(this.t * 0.06);
    cam.position.copy(this.cam0).add(V(k * 0.8, Math.sin(this.t * 0.11) * 0.15, k * 0.4));
    cam.lookAt(this.look0);
    if (cam.fov !== 52) { cam.fov = 52; cam.updateProjectionMatrix(); }
  }

  // Play: the title's people go, the sun goes back, the music fades
  end() {
    if (!this.active) return;
    const g = this.g, C = g.citizens, s = this.sun0;
    this.active = false; document.body.classList.remove('title');
    for (const n of [this.wren, this.me, ...this.dealers]) if (C.list.includes(n)) C.remove(n);
    const pc = this.cop; g.scene.remove(pc.group); g.world.removeVehicleController(pc.vc); g.world.removeRigidBody(pc.body); g.cars.splice(g.cars.indexOf(pc), 1);
    g.sunDir.copy(s.dir); g.sky?.material.uniforms.sunPosition.value.copy(s.dir); g.sun.intensity = s.i; g.sun.color.copy(s.col); if (g.hemi) g.hemi.intensity = s.hemi; g.scene.fog.color.copy(s.fog); g.scene.environmentIntensity = s.env;
    g.player.human.root.visible = true; g.player.scripted = null;
    const m = this.music, v0 = m.volume; let i = 0;
    const fade = setInterval(() => { i++; m.volume = Math.max(0, v0 * (1 - i / 20)); if (i >= 20) { clearInterval(fade); m.pause(); } }, 75);
  }
}
