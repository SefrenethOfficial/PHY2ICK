// People: stylised but believable humans (no noses or ears), built on a bone-like rig so the
// pose can be animated procedurally now and swapped for skinned models later.
import * as THREE from 'three';

const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

// a capsule hanging down from its joint (the top end sits on the joint)
function limb(r, len, mat) {
  const g = new THREE.CapsuleGeometry(r, len, 4, 12);
  g.translate(0, -len / 2 - r * 0.35, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}
const joint = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };

export const SKIN = [0xf1c9a5, 0xe0ac86, 0xc68c62, 0x9c6a45, 0x6e4a32, 0x4a3122];
export const HAIR = [0x1c1612, 0x3b2a1e, 0x6b4a2b, 0xa7793f, 0xd8b56a, 0x8c8c8c, 0x7a2d1c];
export const CLOTH = [0x2f4f7f, 0x8a2d2d, 0x3f6b3f, 0xd8d2c4, 0x23262b, 0x6f5a8a, 0xc98a2e, 0x4c7d8c, 0x9a9a9a, 0xb04a6a];
const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];

export function randomLook(r = Math.random) {
  const female = r() < 0.5;
  return {
    female,
    skin: pick(SKIN, r), hair: pick(HAIR, r),
    hairStyle: female ? pick(['long', 'bob', 'bun', 'short'], r) : pick(['short', 'short', 'buzz', 'bald', 'swept'], r),
    shirt: pick(CLOTH, r), pants: pick([0x22303f, 0x2b2b2b, 0x4a3c2c, 0x5a6470, 0x1d2a44, 0x6b5b45], r),
    shoes: pick([0x151515, 0x3a2a1c, 0xe8e8e8, 0x5a1d1d], r),
    longSleeves: r() < 0.4,
    height: (female ? 1.62 : 1.74) + (r() - 0.5) * 0.14,
    build: 0.9 + r() * 0.25,
  };
}

export class Human {
  constructor(look = randomLook()) {
    this.look = look;
    const L = look, f = L.female;
    const skin = std(L.skin, 0.65), shirt = std(L.shirt, 0.85), pants = std(L.pants, 0.9), shoes = std(L.shoes, 0.6), hair = std(L.hair, 0.9);
    this.mats = { skin, shirt, pants, shoes, hair };
    const root = this.root = new THREE.Group();
    const rig = this.rig = new THREE.Group(); // (scaled to the person's height)
    root.add(rig);
    rig.scale.setScalar(L.height / 1.75);
    const B = this.b = {};
    const w = L.build;

    // hips → spine → chest → neck → head
    B.hips = joint(rig, 0, 0.95, 0);
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), pants);
    pelvis.scale.set((f ? 0.165 : 0.155) * w, 0.11, 0.105 * w); pelvis.castShadow = true; B.hips.add(pelvis);
    B.spine = joint(B.hips, 0, 0.06, 0);
    // the torso: a lathed body, flattened front to back
    const prof = f
      ? [[0.001, -0.06], [0.14, -0.05], [0.145, 0.04], [0.12, 0.17], [0.15, 0.3], [0.165, 0.37], [0.15, 0.44], [0.07, 0.49], [0.001, 0.49]]
      : [[0.001, -0.06], [0.145, -0.05], [0.15, 0.05], [0.15, 0.17], [0.175, 0.3], [0.19, 0.39], [0.17, 0.45], [0.08, 0.5], [0.001, 0.5]];
    const torsoG = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x * w, y)), 20);
    const torso = new THREE.Mesh(torsoG, shirt); torso.scale.z = 0.66; torso.castShadow = true; B.spine.add(torso);
    B.chest = joint(B.spine, 0, 0.25, 0);
    B.neck = joint(B.chest, 0, 0.23, 0);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.12, 10), skin); neck.position.y = 0.04; neck.castShadow = true; B.neck.add(neck);
    B.head = joint(B.neck, 0, 0.09, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), skin);
    head.scale.set(0.95, 1.16, 1.04); head.position.y = 0.1; head.castShadow = true; B.head.add(head);
    this.headMeshes = [head];
    // the face: eyes and brows only (no nose, no ears)
    const white = std(0xf4f1ea, 0.3), iris = std(0x2a1d14, 0.25);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 12, 10), white); eye.scale.set(1.15, 0.72, 0.3); eye.position.set(s * 0.036, 0.113, 0.0985); B.head.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0082, 10, 8), iris); pupil.position.set(s * 0.036, 0.113, 0.1015); pupil.scale.z = 0.35; B.head.add(pupil);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.0075, 0.012), hair); brow.position.set(s * 0.037, 0.137, 0.098); brow.rotation.z = s * -0.08; B.head.add(brow);
      this.headMeshes.push(eye, pupil, brow);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.005, 0.006), std(0x6a3a32, 0.6)); mouth.position.set(0, 0.053, 0.1045); B.head.add(mouth); this.mouth = mouth; this.headMeshes.push(mouth);
    this.addHair(L.hairStyle, hair);

    // arms
    for (const s of [-1, 1]) {
      const k = s < 0 ? 'R' : 'L'; // (the person faces +Z: their left is +X)
      const sh = B['shoulder' + k] = joint(B.chest, s * (f ? 0.165 : 0.19) * w, 0.17, 0);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.052 * w, 12, 10), shirt); cap.position.x = -s * 0.012; cap.castShadow = true; sh.add(cap);
      sh.add(limb(0.05 * w, 0.2, shirt));
      const el = B['elbow' + k] = joint(sh, 0, -0.29, 0);
      el.add(limb(0.042, 0.19, L.longSleeves ? shirt : skin));
      const wr = B['wrist' + k] = joint(el, 0, -0.27, 0);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), skin); hand.scale.set(0.7, 1.25, 0.5); hand.position.y = -0.055; hand.castShadow = true; wr.add(hand);
    }
    // legs
    for (const s of [-1, 1]) {
      const k = s < 0 ? 'R' : 'L';
      const hip = B['hip' + k] = joint(B.hips, s * (f ? 0.095 : 0.09) * w, -0.02, 0);
      hip.add(limb(0.083 * w, 0.32, pants));
      const kn = B['knee' + k] = joint(hip, 0, -0.44, 0);
      kn.add(limb(0.064, 0.33, pants));
      const an = B['ankle' + k] = joint(kn, 0, -0.43, 0);
      const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.17, 4, 10), shoes);
      shoe.rotation.x = Math.PI / 2; shoe.scale.set(1.05, 1, 0.75); shoe.position.set(0, -0.045, 0.055); shoe.castShadow = true; an.add(shoe);
    }
    B.shoulderL.rotation.z = 0.07; B.shoulderR.rotation.z = -0.07;

    // the animation state
    this.phase = Math.random() * 6;
    this.t = Math.random() * 10;
    this.cur = {}; // smoothed joint rotations
    this.talkT = 0;
    this.lookYaw = 0;
  }

  addHair(style, mat) {
    const B = this.b;
    const cap = (thetaLen, s = 1.08) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.105 * s, 20, 14, 0, Math.PI * 2, 0, thetaLen), mat);
      m.scale.set(0.95, 1.16, 1.04); m.position.set(0, 0.1, -0.006); m.rotation.x = -0.5; m.castShadow = true; B.head.add(m); this.headMeshes.push(m); return m;
    };
    if (style === 'bald') return;
    if (style === 'buzz') { cap(Math.PI * 0.5, 1.03); return; }
    cap(Math.PI * (style === 'swept' ? 0.5 : 0.53), style === 'swept' ? 1.1 : 1.06);
    if (style === 'long' || style === 'bob') {
      const len = style === 'long' ? 0.26 : 0.12;
      const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, len, 4, 12), mat);
      back.scale.set(1.05, 1, 0.55); back.position.set(0, 0.08 - len / 2, -0.055); back.castShadow = true; this.b.head.add(back); this.headMeshes.push(back);
    }
    if (style === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), mat); bun.position.set(0, 0.2, -0.09); this.b.head.add(bun); this.headMeshes.push(bun);
    }
  }

  setHeadVisible(v) { for (const m of this.headMeshes) m.visible = v; }

  // s: { speed (m/s), grounded, vy, pose: 'stand' | 'drive' | 'passenger' | 'down', steer, talking, wave }
  update(dt, s) {
    this.t += dt;
    const B = this.b, T = {}; // T: target rotations, [x, y, z] per joint
    const set = (k, x = 0, y = 0, z = 0) => { T[k] = [x, y, z]; };
    const spd = s.speed || 0;
    let hipsY = 0.95, hipsZ = 0, rootTilt = 0;
    if (s.pose === 'drive' || s.pose === 'passenger') {
      hipsY = 0.95; // the seat sets the height
      set('hips'); set('spine', -0.2); set('chest'); set('neck', 0.12); set('head', 0.04, this.lookYaw * 0.6);
      for (const k of ['L', 'R']) { set('hip' + k, -1.5, 0, k === 'L' ? 0.05 : -0.05); set('knee' + k, 1.4); set('ankle' + k, 0.1); }
      if (s.pose === 'drive') {
        const st = s.steer || 0;
        // hands at ten to two on the wheel; they follow it round as it turns
        set('shoulderL', -1.12 - st * 0.22, 0, -0.1 + st * 0.08); set('elbowL', -0.62 + st * 0.15, 0, 0); set('wristL', 0.3);
        set('shoulderR', -1.12 + st * 0.22, 0, 0.1 + st * 0.08); set('elbowR', -0.62 - st * 0.15, 0, 0); set('wristR', 0.3);
      } else {
        set('shoulderL', -0.35, 0, 0.12); set('elbowL', -1.1); set('wristL');
        set('shoulderR', -0.35, 0, -0.12); set('elbowR', -1.1); set('wristR');
      }
    } else if (s.pose === 'down') {
      rootTilt = -Math.PI / 2 + 0.1; hipsY = 0.22;
      set('hips'); set('spine', 0.1); set('chest'); set('neck', -0.2); set('head', 0, 0.3);
      set('hipL', -0.3, 0, 0.15); set('kneeL', 0.4); set('ankleL'); set('hipR', 0.1, 0, -0.2); set('kneeR', 0.2); set('ankleR');
      set('shoulderL', -0.3, 0, 1.2); set('elbowL', -0.3); set('wristL'); set('shoulderR', 0.2, 0, -1.4); set('elbowR', -0.5); set('wristR');
    } else if (!s.grounded) {
      const up = s.vy > 0 ? 1 : 0;
      set('hips'); set('spine', 0.1); set('chest'); set('neck'); set('head', -0.1);
      set('hipL', -0.7 - up * 0.2); set('kneeL', 1.0); set('ankleL', 0.2); set('hipR', -0.15); set('kneeR', 0.5 + up * 0.3); set('ankleR', 0.1);
      set('shoulderL', -0.4, 0, 0.55); set('elbowL', -0.6); set('wristL'); set('shoulderR', 0.3, 0, -0.55); set('elbowR', -0.5); set('wristR');
    } else {
      // walking / running: a gait driven by speed
      const walk = Math.min(spd / 1.5, 1), run = THREE.MathUtils.clamp((spd - 2) / 3.5, 0, 1);
      if (spd > 0.15) this.phase += dt * (4.4 + 1.3 * spd);
      else this.phase += dt * 0.5 * Math.sign(Math.sin(this.phase) || 1) * 0; // (feet settle)
      const p = this.phase, amp = walk * 0.42 + run * 0.5;
      const sinP = Math.sin(p), cosP = Math.cos(p);
      hipsY = 0.95 - walk * 0.012 - run * 0.04 + Math.cos(2 * p) * (0.012 * walk + 0.025 * run);
      const breathe = Math.sin(this.t * 1.7) * 0.015 * (1 - walk);
      set('hips', 0, sinP * 0.08 * amp, 0);
      set('spine', 0.04 + run * 0.18 + breathe, -sinP * 0.14 * amp, 0);
      set('chest', breathe * 0.5, 0, 0);
      set('neck', -run * 0.1); set('head', -run * 0.08, this.lookYaw, 0);
      for (const [k, sg] of [['L', -1], ['R', 1]]) {
        const th = sg * sinP * amp;                                      // thigh swing (- is forward)
        const swing = Math.max(0, -sg * cosP);                          // this leg is swinging forward
        const kn = 0.06 + swing * (0.55 * walk + 0.9 * run) + run * 0.25;
        set('hip' + k, th - run * 0.08, 0, (k === 'L' ? 1 : -1) * 0.02);
        set('knee' + k, kn);
        set('ankle' + k, -(th + kn) * 0.45 + 0.05);
      }
      // arms counter-swing; elbows bend more when running
      const idleSway = Math.sin(this.t * 0.9) * 0.03 * (1 - walk);
      set('shoulderL', sinP * amp * 0.75 + idleSway, 0, 0.08 + run * 0.1);
      set('shoulderR', -sinP * amp * 0.75 - idleSway, 0, -0.08 - run * 0.1);
      set('elbowL', -0.12 - run * 1.25 - walk * 0.15); set('elbowR', -0.12 - run * 1.25 - walk * 0.15);
      set('wristL'); set('wristR');
      // talking hands, and a wave
      if (s.talking && spd < 0.3) {
        const g1 = Math.sin(this.t * 3.1) * 0.5 + 0.5, g2 = Math.sin(this.t * 2.3 + 1) * 0.5 + 0.5;
        set('shoulderR', -0.35 - g1 * 0.25, 0, -0.15); set('elbowR', -0.9 - g2 * 0.4, 0.3);
        set('shoulderL', -0.1 - g2 * 0.15, 0, 0.12); set('elbowL', -0.5 - g1 * 0.3);
      }
      if (s.wave) { set('shoulderR', -0.3, 0, -2.5); set('elbowR', -0.3 + Math.sin(this.t * 9) * 0.4, 0, 0); }
      if (s.point) { set('shoulderR', -1.45, 0, -0.05); set('elbowR', -0.05); }
    }
    // talking: the mouth moves
    this.mouth.scale.y = s.talking ? 1 + (Math.sin(this.t * 17) * 0.5 + 0.5) * 2.4 : 1;

    // ease every joint toward its target
    const k = 1 - Math.exp(-dt * 14);
    for (const name in T) {
      const tg = T[name], c = this.cur[name] || (this.cur[name] = [0, 0, 0]);
      for (let i = 0; i < 3; i++) c[i] += (tg[i] - c[i]) * k;
      const bone = B[name];
      bone.rotation.set(c[0], c[1], c[2]);
    }
    // the shoulders keep their resting spread
    B.shoulderL.rotation.z += 0.0; B.shoulderR.rotation.z += 0.0;
    this.cur.hipsY = (this.cur.hipsY ?? hipsY) + (hipsY - (this.cur.hipsY ?? hipsY)) * k;
    B.hips.position.y = this.cur.hipsY;
    B.hips.position.z = hipsZ;
    this.cur.tilt = (this.cur.tilt ?? 0) + (rootTilt - (this.cur.tilt ?? 0)) * (1 - Math.exp(-dt * 8));
    this.rig.rotation.x = this.cur.tilt;
  }
}
