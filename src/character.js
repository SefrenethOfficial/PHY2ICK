// People: stylised but believable humans (no noses or ears), built on a bone-like rig so the
// pose can be animated procedurally now and swapped for skinned models later.
import * as THREE from 'three';

const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const bone = (parent, x, y, z) => { const o = new THREE.Bone(); o.position.set(x, y, z); parent.add(o); return o; };
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// One smooth body, skinned to the bones: tubes of horizontal rings (every limb hangs straight down
// in the bind pose), each ring with a colour and up to two bone weights, so knees, elbows, the waist
// and the shoulders bend like skin instead of showing seams.
class BodyBuilder {
  constructor(seg = 14) { this.seg = seg; this.pos = []; this.col = []; this.si = []; this.sw = []; this.idx = []; }
  vert(x, y, z, c, w) {
    this.pos.push(x, y, z); this.col.push(c.r, c.g, c.b);
    const ws = [...w, [0, 0], [0, 0], [0, 0]].slice(0, 4);
    this.si.push(...ws.map(q => q[0])); this.sw.push(...ws.map(q => q[1]));
    return this.pos.length / 3 - 1;
  }
  // rings: [{ y, rx, rz, c (THREE.Color), w: [[bone, weight], …], x?, z? }], top to bottom
  tube(cx, cz, rings, capTop = true, capBottom = true) {
    const n = this.seg, starts = [];
    for (const r of rings) {
      starts.push(this.pos.length / 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.vert(cx + (r.x || 0) + Math.sin(a) * r.rx, r.y, cz + (r.z || 0) + Math.cos(a) * r.rz, r.c, r.w);
      }
    }
    for (let k = 0; k < rings.length - 1; k++) {
      const a0 = starts[k], b0 = starts[k + 1];
      for (let i = 0; i < n; i++) {
        const i1 = (i + 1) % n;
        this.idx.push(a0 + i, b0 + i, a0 + i1, a0 + i1, b0 + i, b0 + i1);
      }
    }
    const cap = (k, up) => {
      const r = rings[k], c = this.vert(cx + (r.x || 0), r.y + (up ? 0.012 : -0.012), cz + (r.z || 0), r.c, r.w), a0 = starts[k];
      for (let i = 0; i < n; i++) { const i1 = (i + 1) % n; up ? this.idx.push(c, a0 + i, a0 + i1) : this.idx.push(c, a0 + i1, a0 + i); }
    };
    if (capTop) cap(0, true);
    if (capBottom) cap(rings.length - 1, false);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx); g.computeVertexNormals();
    return g;
  }
}

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
    const skinM = std(L.skin, 0.65), shoes = std(L.shoes, 0.6), hair = std(L.hair, 0.9);
    const root = this.root = new THREE.Group();
    const rig = this.rig = new THREE.Group(); // (scaled to the person's height, after binding)
    root.add(rig);
    const B = this.b = {};
    const w = L.build, lw = Math.sqrt(w); // (build: the torso widens fully, the limbs a little)

    // the skeleton (bind pose: standing straight, arms down)
    const holder = new THREE.Object3D();
    B.hips = bone(holder, 0, 0.95, 0);
    B.spine = bone(B.hips, 0, 0.06, 0);
    B.chest = bone(B.spine, 0, 0.25, 0);
    B.neck = bone(B.chest, 0, 0.23, 0);
    B.head = bone(B.neck, 0, 0.065, 0);
    const shX = (f ? 0.168 : 0.19) * w, hipX = (f ? 0.095 : 0.09) * w;
    for (const s of [-1, 1]) {
      const k = s < 0 ? 'R' : 'L'; // (the person faces +Z: their left is +X)
      B['shoulder' + k] = bone(B.chest, s * shX, 0.17, 0);
      B['elbow' + k] = bone(B['shoulder' + k], 0, -0.29, 0);
      B['wrist' + k] = bone(B['elbow' + k], 0, -0.27, 0);
      B['hip' + k] = bone(B.hips, s * hipX, -0.02, 0);
      B['knee' + k] = bone(B['hip' + k], 0, -0.44, 0);
      B['ankle' + k] = bone(B['knee' + k], 0, -0.43, 0);
    }
    this.bindPos = Object.fromEntries(Object.entries(B).map(([k, b]) => [k, b.position.clone()]));
    const order = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulderL', 'elbowL', 'wristL', 'shoulderR', 'elbowR', 'wristR', 'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR'];
    const I = Object.fromEntries(order.map((n, i) => [n, i]));
    const C = (hex) => new THREE.Color(hex);
    const cSkin = C(L.skin), cShirt = C(L.shirt), cPants = C(L.pants);
    const bl = (a, b, t) => (t <= 0 ? [[I[a], 1]] : t >= 1 ? [[I[b], 1]] : [[I[a], 1 - t], [I[b], t]]);
    const body = new BodyBuilder(16);

    // torso: pelvis → waist → chest → shoulders → neck (one piece)
    const tors = f
      ? [[1.62, .05, .05], [1.55, .054, .053], [1.5, .066, .06], [1.47, .11, .075], [1.43, .16, .092], [1.36, .165, .1], [1.28, .158, .118], [1.2, .142, .1], [1.1, .125, .088], [1.02, .14, .095], [1.0, .14, .095], [0.95, .168, .108], [0.9, .163, .104], [0.87, .13, .088]]
      : [[1.62, .056, .055], [1.55, .06, .058], [1.5, .074, .066], [1.47, .125, .08], [1.43, .182, .098], [1.36, .185, .108], [1.28, .175, .112], [1.2, .158, .104], [1.1, .148, .098], [1.02, .15, .098], [1.0, .15, .098], [0.95, .158, .104], [0.9, .154, .1], [0.87, .12, .082]];
    const shirtTop = 1.495, belt = 1.01;
    const tRings = [];
    for (const [y, rx, rz] of tors) {
      const wt = y >= 1.5 ? bl('chest', 'neck', smooth(1.49, 1.54, y)) : y >= 1.2 ? bl('spine', 'chest', smooth(1.2, 1.32, y)) : bl('hips', 'spine', smooth(0.97, 1.08, y));
      const c = y > shirtTop ? cSkin : y >= belt ? cShirt : cPants;
      const ring = { y, rx: rx * (y < 1.5 ? w : 1), rz: rz * (y < 1.5 ? Math.sqrt(w) : 1), c, w: wt, z: y > 1.46 ? -0.008 : 0 };
      tRings.push(ring);
      if (y === 1.5) tRings.push({ ...ring, y: 1.497, c: cShirt, rx: ring.rx + 0.004, rz: ring.rz + 0.004 }); // (the collar: a crisp line)
      if (y === 1.02) tRings.push({ ...ring, y: 1.012, c: cShirt }); // (a crisp belt line: shirt down to here, trousers below)
    }
    body.tube(0, 0, tRings, true, true);

    // legs: hip → knee → ankle, one tube each, bending at the knee
    const legP = [[1.0, .088], [0.92, .09], [0.8, .082], [0.68, .07], [0.58, .06], [0.52, .055], [0.47, .056], [0.4, .061], [0.32, .057], [0.22, .046], [0.13, .039], [0.07, .038]];
    for (const s of [-1, 1]) {
      const k = s < 0 ? 'R' : 'L';
      const rings = legP.map(([y, r]) => {
        const wt = y > 0.86 ? bl('hips', 'hip' + k, smooth(1.0, 0.86, y) ) : y > 0.48 ? bl('hip' + k, 'knee' + k, smooth(0.58, 0.47, y)) : bl('knee' + k, 'ankle' + k, smooth(0.12, 0.06, y));
        const xin = y > 0.85 ? -s * 0.012 * (y - 0.85) / 0.15 : 0; // (thighs meet the pelvis)
        return { y, rx: r * lw * (f && y > 0.7 ? 1.06 : 1), rz: r * lw * 0.97, c: cPants, w: wt, x: s * hipX + xin };
      });
      body.tube(0, 0, rings, true, true);
    }
    // arms: shoulder → elbow → wrist, bending at the elbow
    const armP = [[1.475, .045], [1.45, .057], [1.4, .058], [1.32, .052], [1.24, .046], [1.17, .042], [1.13, .041], [1.08, .043], [1.0, .039], [0.93, .033], [0.885, .029]];
    const sleeveEnd = L.longSleeves ? 0.9 : 1.27;
    for (const s of [-1, 1]) {
      const k = s < 0 ? 'R' : 'L';
      const rings = [];
      for (const [y, r] of armP) {
        const wt = y > 1.4 ? bl('chest', 'shoulder' + k, smooth(1.475, 1.41, y)) : y > 1.1 ? bl('shoulder' + k, 'elbow' + k, smooth(1.18, 1.11, y)) : bl('elbow' + k, 'wrist' + k, smooth(0.9, 0.87, y));
        const ring = { y, rx: r * lw * 0.95, rz: r * lw, c: y > sleeveEnd ? cShirt : cSkin, w: wt, x: s * shX - s * (y > 1.43 ? (y - 1.43) * 0.6 : 0) };
        rings.push(ring);
        if (!L.longSleeves && y === 1.32) rings.push({ ...ring, y: 1.27, rx: ring.rx * 0.96 + 0.003, rz: ring.rz * 0.96 + 0.003, c: cShirt }, { ...ring, y: 1.268, rx: ring.rx * 0.93, rz: ring.rz * 0.93, c: cSkin });
      }
      body.tube(0, 0, rings, true, true);
    }
    const bodyM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
    const skinned = this.body = new THREE.SkinnedMesh(body.geometry(), bodyM);
    skinned.castShadow = true; skinned.receiveShadow = true; skinned.frustumCulled = false;
    skinned.add(B.hips);
    skinned.updateMatrixWorld(true);
    skinned.bind(new THREE.Skeleton(order.map(n => B[n])));
    rig.add(skinned);
    rig.scale.setScalar(L.height / 1.75);

    // head (rigid, on the head bone)
    const skin = skinM;
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

    // hands: a palm with fingers together, and a thumb
    for (const s of [-1, 1]) {
      const wr = B['wrist' + (s < 0 ? 'R' : 'L')];
      const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.06, 4, 10), skin);
      palm.scale.set(1.25, 1, 0.62); palm.position.set(0, -0.06, 0.004); palm.castShadow = true; wr.add(palm);
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.035, 3, 8), skin);
      thumb.position.set(-s * 0.012, -0.045, 0.026); thumb.rotation.set(0.5, 0, -s * 0.35); wr.add(thumb);
    }
    // shoes: a rounded upper on a sole
    const sole = std(0x2a2522, 0.9);
    for (const s of [-1, 1]) {
      const an = B['ankle' + (s < 0 ? 'R' : 'L')];
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.15, 4, 12), shoes);
      upper.rotation.x = Math.PI / 2; upper.scale.set(1.08, 1, 0.82); upper.position.set(0, -0.022, 0.05); upper.castShadow = true; an.add(upper);
      const so = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.27), sole); so.position.set(0, -0.058, 0.05); an.add(so);
    }
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

  // back from a ragdoll: the bones go back to their own lengths, the animation takes over again
  resetPose() {
    for (const k in this.b) { const b = this.b[k]; b.position.copy(this.bindPos[k]); b.quaternion.identity(); b.scale.set(1, 1, 1); }
    this.cur = {};
  }

  // s: { speed (m/s), grounded, vy, pose: 'stand' | 'drive' | 'passenger' | 'down', steer, talking, wave }
  update(dt, s) {
    this.t += dt;
    if (this.ragdoll) { this.ragdoll.frame(dt); return; }
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
      if (s.carry) { set('shoulderL', -1.0, 0, -0.25); set('elbowL', -0.7); set('shoulderR', -1.0, 0, 0.25); set('elbowR', -0.7); }
      else if (s.weapon && s.attack == null) { set('elbowR', -0.55 - run * 0.9, 0, 0); set('wristR', 0.2); }
      if (s.attack != null) { // a swing: wind up over the shoulder, then chop down and across
        const a = s.attack, up = a < 0.4 ? a / 0.4 : 1 - Math.min(1, (a - 0.4) / 0.25);
        set('shoulderR', -0.7 - up * 1.9, 0, -0.25 - up * 0.3); set('elbowR', -0.25 - up * 1.0, 0, 0); set('wristR', 0.6 - up * 0.9);
        set('spine', 0.08 + (1 - up) * 0.18, -0.25 + (1 - up) * 0.45, 0);
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
