// People, in the style of the first game: built from blocks (a pelvis, a belly, a chest, upper
// arms, forearms, hands, thighs, shins, shoes, round joints between them) on a round head with
// just eyes and eyebrows: no nose, no ears, no mouth. The eyes and brows have their own little
// bones, so faces change: happy, angry, sad, surprised, scared, blinking. Proper hairstyles.
// The whole person is one skinned mesh (one draw call), posed by the same skeleton as before,
// so the walk, the run, the gestures and the ragdolls all carry over.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const bone = (parent, x, y, z) => { const o = new THREE.Bone(); o.position.set(x, y, z); parent.add(o); return o; };

export const SKIN = [0xf1c9a5, 0xe0ac86, 0xc68c62, 0x9c6a45, 0x6e4a32, 0x4a3122];
export const HAIR = [0x1c1612, 0x2a1d14, 0x3b2a1e, 0x6b4a2b, 0xa7793f, 0xd8b56a, 0x8c8c8c, 0x7a2d1c];
export const CLOTH = [0xd9483b, 0x2f7fd8, 0x3aa760, 0xe0a52b, 0x8a54c9, 0x1f9aa3, 0xe06a9b, 0x6b7380, 0x2f4f7f, 0x8a2d2d, 0xd8d2c4, 0x23262b, 0xf2f0ea];
const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];

export function randomLook(r = Math.random) {
  const female = r() < 0.5;
  return {
    female,
    skin: pick(SKIN, r), hair: pick(HAIR, r),
    hairStyle: female ? pick(['long', 'long', 'bob', 'bun', 'ponytail', 'curly', 'short'], r) : pick(['short', 'short', 'swept', 'buzz', 'bald', 'curly', 'afro', 'side'], r),
    shirt: pick(CLOTH, r), pants: pick([0x2c3440, 0x4a3b2a, 0x34495e, 0x5b5b5b, 0x2d4a2d, 0x1d2a44, 0x6b5b45], r),
    shoes: pick([0x151515, 0x3a2a1c, 0xe8e8e8, 0x5a1d1d], r),
    longSleeves: r() < 0.4,
    height: (female ? 1.64 : 1.76) + (r() - 0.5) * 0.14,
    build: 0.9 + r() * 0.25,
  };
}

// faces: [brow lift, brow tilt (+ = inner ends down), eye height, eye width]
const FACES = {
  neutral: [0, 0, 1, 1], happy: [0.005, -0.12, 0.5, 1.05], angry: [-0.008, 0.42, 0.72, 1], annoyed: [-0.004, 0.22, 0.85, 1],
  sad: [0.003, -0.38, 0.85, 1], surprised: [0.017, 0, 1.35, 1.15], scared: [0.013, -0.3, 1.3, 1.1], hurt: [-0.002, -0.3, 0.4, 1], ko: [-0.003, 0, 0.1, 1.05],
};

export class Human {
  constructor(look = randomLook()) {
    this.look = look;
    const L = look, f = L.female;
    const root = this.root = new THREE.Group();
    const rig = this.rig = new THREE.Group(); // (scaled to the person's height, after binding)
    root.add(rig);
    const B = this.b = {};
    const w = L.build, lw = Math.sqrt(w);

    // the skeleton (bind pose: standing straight, arms down), the same as before
    const holder = new THREE.Object3D();
    B.hips = bone(holder, 0, 0.95, 0);
    B.spine = bone(B.hips, 0, 0.06, 0);
    B.chest = bone(B.spine, 0, 0.25, 0);
    B.neck = bone(B.chest, 0, 0.23, 0);
    B.head = bone(B.neck, 0, 0.065, 0);
    const shX = (f ? 0.17 : 0.195) * w, hipX = (f ? 0.095 : 0.09) * w;
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
    // the face's own bones (on the head, at each eye and brow): not part of the ragdoll
    const HY = 1.555, HR = 0.118, HC = 0.1; // head bone height; head radius; head centre above the bone
    const F = this.face = {};
    for (const s of [-1, 1]) {
      const k = s < 0 ? 'R' : 'L';
      F['eye' + k] = bone(B.head, s * 0.043, HC + 0.008, 0.104);
      F['brow' + k] = bone(B.head, s * 0.044, HC + 0.043, 0.1);
    }
    this.faceBind = Object.fromEntries(Object.entries(F).map(([k, b]) => [k, b.position.clone()]));
    const order = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulderL', 'elbowL', 'wristL', 'shoulderR', 'elbowR', 'wristR', 'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR', 'eyeL', 'eyeR', 'browL', 'browR'];
    const I = Object.fromEntries(order.map((n, i) => [n, i]));
    this.order = order;

    // the parts: geometry in bind-pose space, a colour, and the one bone it rides on
    const geos = [];
    const add = (bn, geo, color, x, y, z, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) => {
      let g = geo.index ? geo.toNonIndexed() : geo;
      if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz))); g.scale(sx, sy, sz); // (turn, then squash: a hair cap stays the head's shape)
      g.translate(x, y, z);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
      const n = g.attributes.position.count, c = new THREE.Color(color), col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; si[i * 4] = I[bn]; sw[i * 4] = 1; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      geos.push(g);
    };
    const box = (W, H, D, r = 0.02) => new RoundedBoxGeometry(W, H, D, 1, Math.min(r, W / 2.2, H / 2.2, D / 2.2));
    const ball = (r, ws = 10, hs = 8) => new THREE.SphereGeometry(r, ws, hs);
    const sk = L.skin, sh = L.shirt, pa = L.pants;

    // torso: pelvis, belly, chest (a little V for men, a waist and hips for women)
    add('hips', box((f ? 0.33 : 0.31) * w, 0.17, 0.2 * lw, 0.035), pa, 0, 0.955, 0);
    add('spine', box((f ? 0.265 : 0.3) * w, 0.25, 0.19 * lw, 0.04), sh, 0, 1.15, 0.002);
    add('chest', box((f ? 0.32 : 0.385) * w, 0.24, 0.21 * lw, 0.045), sh, 0, 1.37, 0.004);
    add('hips', box((f ? 0.335 : 0.315) * w, 0.03, 0.205 * lw, 0.01), L.shorts ? new THREE.Color(pa).multiplyScalar(0.8).getHex() : 0x1d1a18, 0, 1.03, 0); // (a belt; on boxers, the waistband)
    // neck and head
    add('neck', new THREE.CylinderGeometry(0.046, 0.05, 0.11, 10), sk, 0, 1.51, 0.004);
    add('head', ball(HR, 22, 16), sk, 0, HY + HC, 0, { sx: 0.96, sy: 1.08, sz: 1 });
    // arms: a round shoulder, upper arm, a round elbow, forearm, hand with a thumb
    for (const s of [-1, 1]) {
      const k = s < 0 ? 'R' : 'L', x = s * shX;
      add('shoulder' + k, ball(0.066 * lw), sh, x, 1.43, 0);
      add('shoulder' + k, box(0.104 * lw, 0.28, 0.112 * lw, 0.03), L.longSleeves ? sh : sk, x, 1.285, 0);
      if (!L.longSleeves) add('shoulder' + k, box(0.12 * lw, 0.14, 0.128 * lw, 0.03), sh, x, 1.37, 0);
      add('elbow' + k, ball(0.05 * lw), L.longSleeves ? sh : sk, x, 1.14, 0);
      add('elbow' + k, box(0.088 * lw, 0.25, 0.096 * lw, 0.028), L.longSleeves ? sh : sk, x, 1.015, 0);
      if (L.longSleeves) add('elbow' + k, box(0.096 * lw, 0.035, 0.104 * lw, 0.012), sh, x, 0.9, 0); // (the cuff)
      add('wrist' + k, box(0.036, 0.1, 0.085, 0.016), sk, x, 0.82, 0.004);
      add('wrist' + k, box(0.026, 0.055, 0.026, 0.011), sk, x - s * 0.006, 0.845, 0.05, { rx: 0.35 });
    }
    // legs: thigh, a round knee, shin, a shoe on a sole
    for (const s of [-1, 1]) {
      const k = s < 0 ? 'R' : 'L', x = s * hipX;
      add('hip' + k, box(0.155 * lw * (f ? 1.04 : 1), 0.43, 0.165 * lw, 0.04), pa, x, 0.71, 0);
      add('knee' + k, ball(0.07 * lw), L.shorts ? sk : pa, x, 0.49, 0);
      add('knee' + k, box(0.125 * lw, 0.41, 0.135 * lw, 0.035), L.shorts ? sk : pa, x, 0.28, 0);
      add('ankle' + k, box(0.11, 0.085, 0.25, 0.03), L.shoes, x, 0.052, 0.045);
      add('ankle' + k, box(0.116, 0.024, 0.262, 0.01), L.shoes === 0xe8e8e8 ? 0xd8d4cc : 0x26221f, x, 0.012, 0.045);
    }
    // the face: eyes (a dark dot with a glint) and eyebrows, on their own bones
    for (const s of [-1, 1]) {
      const k = s < 0 ? 'R' : 'L', e = F['eye' + k].position, b = F['brow' + k].position;
      add('eye' + k, ball(0.022, 12, 10), 0x141414, e.x, HY + e.y, e.z, { sx: 0.85, sy: 1.12, sz: 0.4 });
      add('eye' + k, ball(0.0062, 6, 5), 0xffffff, e.x + 0.006, HY + e.y + 0.009, e.z + 0.008);
      add('brow' + k, box(0.052, 0.014, 0.016, 0.006), new THREE.Color(L.hair).multiplyScalar(0.55), b.x, HY + b.y, b.z, { rz: s * -0.06, ry: s * 0.25 });
    }
    // a hazmat suit's hood (open at the face) and a gas mask: a lens over the eyes, a snout, two filters
    if (L.hazmat) {
      add('head', new THREE.SphereGeometry(HR * 1.22, 20, 14, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.68), L.shirt, 0, HY + HC + 0.005, -0.01);
      add('neck', new THREE.CylinderGeometry(0.075, 0.09, 0.08, 14), L.shirt, 0, 1.49, 0);
      const mk = 0x1c1e20;
      add('head', box(0.17, 0.075, 0.05, 0.02), 0x2a2e30, 0, HY + HC + 0.012, 0.108);
      add('head', box(0.15, 0.052, 0.012, 0.012), 0x6a8a98, 0, HY + HC + 0.012, 0.133);
      add('head', box(0.1, 0.085, 0.07, 0.025), mk, 0, HY + HC - 0.06, 0.112);
      for (const sx of [-1, 1]) add('head', new THREE.CylinderGeometry(0.038, 0.038, 0.045, 14), 0x3a3e40, sx * 0.07, HY + HC - 0.075, 0.12, { rz: Math.PI / 2, ry: sx * 0.5 });
    }
    // sunglasses (Vic)
    if (L.shades) { const dark = 0x0b0c0e; for (const sx of [-1, 1]) add('head', box(0.07, 0.042, 0.02, 0.008), dark, sx * 0.044, HY + HC + 0.006, 0.113); add('head', box(0.03, 0.012, 0.012, 0.004), dark, 0, HY + HC + 0.016, 0.118); for (const sx of [-1, 1]) add('head', box(0.008, 0.012, 0.11, 0.003), dark, sx * 0.083, HY + HC + 0.014, 0.06); }
    // hair
    this.buildHair(L.hairStyle, L.hair, add, HY + HC, HR);

    const geo = mergeGeometries(geos, false);
    const mat = this.bodyM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
    const skinned = this.body = new THREE.SkinnedMesh(geo, mat);
    skinned.castShadow = true; skinned.receiveShadow = true; skinned.frustumCulled = false;
    skinned.add(B.hips);
    skinned.updateMatrixWorld(true);
    skinned.bind(new THREE.Skeleton(order.map(n => B[n] || F[n])));
    rig.add(skinned);
    rig.scale.setScalar(L.height / 1.75);

    // the animation state
    this.phase = Math.random() * 6;
    this.t = Math.random() * 10;
    this.cur = {}; // smoothed joint rotations
    this.talkT = 0;
    this.lookYaw = 0;
    // the face's state
    this.expr = 'neutral'; this.exprT = 0; this.base = 'neutral';
    this.fcur = [...FACES.neutral]; this.blinkT = 1 + Math.random() * 4;
  }

  // hairstyles, from a few simple shapes, all on the head bone (cy: the head's centre; r: its radius)
  buildHair(style, col, add, cy, r) {
    if (style === 'bald') return;
    const cap = (s, theta, tilt, dy = 0, dz = -0.004) => add('head', new THREE.SphereGeometry(r * s, 24, 14, 0, Math.PI * 2, 0, theta), col, 0, cy + dy, dz, { rx: tilt - 0.24, sx: 0.96, sy: 1.08 }); // (tipped back: the hairline sits above the brows)
    const rb = (W, H, D, x, y, z, o = {}) => add('head', new RoundedBoxGeometry(W, H, D, 1, Math.min(W, H, D) / 2.3), col, x, cy + y, z, o);
    const blob = (rad, x, y, z, o = {}) => add('head', new THREE.SphereGeometry(rad, 10, 8), col, x, cy + y, z, o);
    switch (style) {
      case 'buzz': cap(1.045, Math.PI * 0.52, -0.5); break;
      case 'short': cap(1.07, Math.PI * 0.56, -0.55); rb(0.16, 0.035, 0.05, 0, 0.1, 0.068, { rx: 0.5 }); break;
      case 'side': cap(1.07, Math.PI * 0.56, -0.55); rb(0.18, 0.04, 0.06, 0.02, 0.1, 0.066, { rx: 0.5, rz: -0.22 }); rb(0.04, 0.09, 0.09, -0.112, 0.03, 0.01); rb(0.04, 0.09, 0.09, 0.112, 0.03, 0.01); break;
      case 'swept': cap(1.07, Math.PI * 0.56, -0.55); rb(0.16, 0.06, 0.13, 0, 0.115, 0.045, { rx: -0.3 }); break;
      case 'sweptShort': cap(1.06, Math.PI * 0.555, -0.55); rb(0.155, 0.04, 0.11, 0, 0.11, 0.045, { rx: -0.3 }); break; // (swept, trimmed: Wren)
      case 'curly': cap(1.08, Math.PI * 0.55, -0.55); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, ring = i % 2 ? 0.075 : 0.105, y = i % 2 ? 0.115 : 0.075; const z = Math.cos(a) * ring - 0.015; if (z > 0.06 && y < 0.1) continue; blob(0.038, Math.sin(a) * ring, y, z); } blob(0.045, 0, 0.13, -0.01); break;
      case 'afro': { // a big round cloud of curls
        cap(1.1, Math.PI * 0.56, -0.55);
        for (let i = 0; i < 26; i++) { const u = (i + 0.5) / 26, el = Math.acos(1 - u * 1.25), az = i * 2.39996; const x = Math.sin(el) * Math.sin(az) * 0.13, y = Math.cos(el) * 0.13 + 0.05, z = Math.sin(el) * Math.cos(az) * 0.13 - 0.03; if (z > 0.05 && y < 0.11) continue; blob(0.058, x, y, z); }
        break; }
      case 'long': cap(1.08, Math.PI * 0.56, -0.55); rb(0.235, 0.33, 0.075, 0, -0.06, -0.1); rb(0.045, 0.24, 0.09, -0.112, -0.03, -0.015); rb(0.045, 0.24, 0.09, 0.112, -0.03, -0.015); rb(0.16, 0.035, 0.05, 0, 0.1, 0.068, { rx: 0.5 }); break;
      case 'bob': cap(1.09, Math.PI * 0.56, -0.55); rb(0.26, 0.15, 0.17, 0, 0.0, -0.035); rb(0.17, 0.04, 0.05, 0, 0.1, 0.07, { rx: 0.5 }); break;
      case 'bun': cap(1.06, Math.PI * 0.56, -0.5); blob(0.05, 0, 0.1, -0.1); break;
      case 'ponytail': cap(1.06, Math.PI * 0.56, -0.5); blob(0.024, 0, 0.05, -0.118); add('head', new THREE.CapsuleGeometry(0.034, 0.16, 4, 10), col, 0, cy - 0.06, -0.14, { rx: 0.22 }); break;
      case 'beanie': { // a knitted beanie, pulled down, a turned-up cuff, hair showing at the sides and back
        const knit = this.look.beanie ?? 0x2c3036, rib = new THREE.Color(knit).multiplyScalar(0.8).getHex();
        add('head', new THREE.SphereGeometry(r * 1.1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), knit, 0, cy + 0.008, -0.006, { rx: -0.3, sx: 0.96, sy: 1.12 });
        add('head', new THREE.CylinderGeometry(r * 1.115, r * 1.125, 0.05, 24, 1, true), rib, 0, cy + 0.04, -0.01, { rx: -0.3, sx: 0.97 });
        add('head', new THREE.CylinderGeometry(r * 1.13, r * 1.13, 0.012, 24, 1, true), knit, 0, cy + 0.066, -0.005, { rx: -0.3, sx: 0.97 });
        // the hair that shows underneath (look.under: the style you'd see with the beanie off)
        switch (this.look.under || 'short') {
          case 'bald': case 'buzz': break;
          case 'long': for (const sx of [-1, 1]) rb(0.04, 0.22, 0.09, sx * 0.11, -0.07, -0.02); rb(0.22, 0.3, 0.07, 0, -0.12, -0.1); break;
          case 'curly': for (let i = 0; i < 9; i++) { const a = Math.PI * 0.42 + (i / 8) * Math.PI * 1.16; blob(0.034, Math.sin(a) * 0.112, -0.01 - (i % 2) * 0.02, Math.cos(a) * 0.1 - 0.02); } break;
          case 'afro': for (let i = 0; i < 11; i++) { const a = Math.PI * 0.4 + (i / 10) * Math.PI * 1.2; blob(0.05, Math.sin(a) * 0.125, -0.02 - (i % 2) * 0.03, Math.cos(a) * 0.115 - 0.025); } break;
          case 'ponytail': for (const sx of [-1, 1]) rb(0.03, 0.06, 0.07, sx * 0.105, 0.0, -0.02); rb(0.17, 0.06, 0.04, 0, -0.03, -0.1); add('head', new THREE.CapsuleGeometry(0.032, 0.15, 4, 10), col, 0, cy - 0.1, -0.135, { rx: 0.18 }); break;
          case 'bob': rb(0.25, 0.12, 0.16, 0, -0.05, -0.04); break;
          default: for (const sx of [-1, 1]) rb(0.03, 0.06, 0.07, sx * 0.105, 0.0, -0.02); rb(0.17, 0.06, 0.04, 0, -0.03, -0.1); // (short: a little at the sides and back)
        }
        break; }
      case 'cap': { // a police cap: crown, band, peak, badge
        const navy = 0x1b2438; cap(1.05, Math.PI * 0.5, -0.5);
        add('head', new THREE.CylinderGeometry(r * 1.1, r * 1.04, 0.07, 18), navy, 0, cy + 0.075, -0.005, { rx: -0.12 });
        add('head', new THREE.CylinderGeometry(r * 1.16, r * 1.1, 0.035, 18), navy, 0, cy + 0.125, -0.012, { rx: -0.12 });
        add('head', new THREE.BoxGeometry(0.17, 0.012, 0.075), 0x0e1220, 0, cy + 0.052, r * 0.98, { rx: 0.25 });
        add('head', new THREE.BoxGeometry(0.026, 0.03, 0.01), 0xd8b44a, 0, cy + 0.095, r * 1.06, { rx: -0.15 });
        break; }
      default: cap(1.07, Math.PI * 0.56, -0.55);
    }
  }

  // a face for a while (then back to their usual one): neutral, happy, angry, annoyed, sad, surprised, scared, hurt, ko
  express(name, secs = 2.5) { this.expr = name; this.exprT = secs; }
  setMood(name) { this.base = name; }

  setHeadVisible(v) { this.headHidden = !v; }

  // ---- gore: blood soaks into the body where it's hurt (painted onto the vertex colours, around the wound)
  wound(at, r = 0.07, k = 1) {
    const mesh = this.body, geo = mesh.geometry, pos = geo.attributes.position, col = geo.attributes.color, si = geo.attributes.skinIndex;
    if (!pos || !col) return;
    mesh.updateMatrixWorld(true);
    const bones = mesh.skeleton.bones, inv = mesh.skeleton.boneInverses;
    // the nearest bone to the wound, and the wound in that bone's bind pose
    let bi = 0, bd = Infinity; const w = new THREE.Vector3();
    for (let i = 0; i < bones.length; i++) { bones[i].getWorldPosition(w); const d = w.distanceToSquared(at); if (d < bd) { bd = d; bi = i; } }
    const m = new THREE.Matrix4().multiplyMatrices(bones[bi].matrixWorld, inv[bi]).invert();
    const pb = at.clone().applyMatrix4(m); // (back to the body's bind pose: the skin follows bone × inverse-bind)
    const sc = this.rig.scale.x, rr = r / sc, red = [0.36, 0.015, 0.02];
    let n = 0;
    for (let i = 0; i < pos.count; i++) {
      const dx = pos.getX(i) - pb.x, dy = pos.getY(i) - pb.y, dz = pos.getZ(i) - pb.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > rr * 1.6) continue;
      const f = Math.min(1, k * (1 - d / (rr * 1.6)) * 1.4) * (0.75 + 0.25 * Math.sin(i * 12.9898));
      col.setXYZ(i, col.getX(i) + (red[0] - col.getX(i)) * f, col.getY(i) + (red[1] - col.getY(i)) * f, col.getZ(i) + (red[2] - col.getZ(i)) * f); n++;
    }
    if (n) col.needsUpdate = true;
  }
  // burnt (an explosion): everything darker
  char(k = 0.55) { const col = this.body.geometry.attributes.color; for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * k, col.getY(i) * k * 0.92, col.getZ(i) * k * 0.88); col.needsUpdate = true; }

  // a sack over the head (kidnapping)
  addBag() {
    if (this.bag) return;
    if (!Human.bagMat) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      x.fillStyle = '#9a7a4e'; x.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 128; i += 4) { x.fillStyle = i % 8 ? '#8a6c44' : '#a88a5a'; x.fillRect(i, 0, 2, 128); x.fillRect(0, i, 128, 1); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
      Human.bagMat = new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
    }
    const g = new THREE.Group();
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 10), Human.bagMat); sack.scale.set(1, 1.18, 1.05); sack.position.y = 0.11; g.add(sack);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.08, 8), Human.bagMat); top.position.set(0.02, 0.29, -0.01); top.rotation.z = -0.4; g.add(top);
    const cord = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.009, 6, 16), new THREE.MeshStandardMaterial({ color: 0x5a4a30, roughness: 1 })); cord.rotation.x = Math.PI / 2; cord.position.y = -0.03; g.add(cord);
    g.traverse(o => { o.castShadow = true; });
    this.b.head.add(g); this.bag = g;
  }
  removeBag() { if (this.bag) { this.bag.removeFromParent(); this.bag = null; } }

  // back from a ragdoll: the bones go back to their own lengths, the animation takes over again
  resetPose() {
    for (const k in this.b) { const b = this.b[k]; b.position.copy(this.bindPos[k]); b.quaternion.identity(); b.scale.set(1, 1, 1); }
    this.cur = {};
  }

  // the eyes and brows ease toward the face they're making; a blink every few seconds
  updateFace(dt, talking) {
    this.exprT -= dt;
    const want = this.ragdoll ? (this.dead ? 'ko' : 'hurt') : this.exprT > 0 ? this.expr : this.base;
    const tg = FACES[want] || FACES.neutral, c = this.fcur, k = 1 - Math.exp(-dt * 10);
    for (let i = 0; i < 4; i++) c[i] += (tg[i] - c[i]) * k;
    this.blinkT -= dt; if (this.blinkT < -0.13) this.blinkT = 1.5 + Math.random() * 4;
    const blink = this.blinkT < 0 ? 0.12 : 1, bob = talking ? Math.sin(this.t * 7.3) * 0.0035 + Math.sin(this.t * 3.1) * 0.002 : 0;
    const F = this.face, FB = this.faceBind;
    for (const [k, s] of [['L', 1], ['R', -1]]) {
      const e = F['eye' + k], b = F['brow' + k];
      e.scale.set(c[3], Math.max(0.08, c[2] * blink), 1);
      b.position.set(FB['brow' + k].x, FB['brow' + k].y + c[0] + bob, FB['brow' + k].z);
      b.rotation.z = s * c[1];
    }
    this.b.head.scale.setScalar(this.headHidden ? 0.001 : 1);
  }

  // s: { speed (m/s), grounded, vy, pose: 'stand' | 'drive' | 'passenger' | 'down', steer, talking, wave }
  update(dt, s) {
    this.t += dt;
    this.updateFace(dt, s.talking);
    if (this.ragdoll) { this.ragdoll.frame(dt); return; }
    const B = this.b, T = {}; // T: target rotations, [x, y, z] per joint
    const set = (k, x = 0, y = 0, z = 0) => { T[k] = [x, y, z]; };
    const spd = s.speed || 0;
    let hipsY = 0.95, hipsZ = 0, rootTilt = 0;
    if (s.pose === 'slump') { // dead at the wheel
      hipsY = 0.95;
      set('hips'); set('spine', 0.5); set('chest', 0.25); set('neck', 0.45); set('head', 0.35, 0.3, 0.2);
      for (const k of ['L', 'R']) { set('hip' + k, -1.48, 0, k === 'L' ? 0.12 : -0.12); set('knee' + k, 0.3); set('ankle' + k, 0.9); }
      set('shoulderL', -0.55, 0, -0.05); set('elbowL', -0.5); set('wristL', 0.3); set('shoulderR', -0.6, 0, 0.1); set('elbowR', -0.3); set('wristR', 0.4);
    } else if (s.pose === 'bath') { // lying back in a bath, knees up a little, arms in the water
      rootTilt = -1.05; hipsY = 0.2;
      set('hips'); set('spine', 0.08); set('chest', 0.06); set('neck', 0.45); set('head', 0.3, this.lookYaw, 0);
      for (const k of ['L', 'R']) { set('hip' + k, -0.8, 0, k === 'L' ? 0.1 : -0.1); set('knee' + k, 0.9); set('ankle' + k, 0.3); }
      set('shoulderL', 0.1, 0, 0.22); set('elbowL', -0.3); set('wristL'); set('shoulderR', 0.1, 0, -0.22); set('elbowR', -0.3); set('wristR');
    } else if (s.pose === 'situp') { // sat up in it, gripping the sides
      rootTilt = -0.12; hipsY = 0.2;
      set('hips'); set('spine', 0.25); set('chest', 0.1); set('neck', 0.1); set('head', 0.05, this.lookYaw, 0);
      for (const k of ['L', 'R']) { set('hip' + k, -1.35, 0, k === 'L' ? 0.12 : -0.12); set('knee' + k, 1.1); set('ankle' + k, 0.3); }
      set('shoulderL', -0.35, 0, 0.55); set('elbowL', -0.5); set('wristL', 0, 0, -0.4); set('shoulderR', -0.35, 0, -0.55); set('elbowR', -0.5); set('wristR', 0, 0, 0.4);
    } else if (s.pose === 'stairsit') { // sat on a step, feet two steps down, elbows on knees (maybe on the phone)
      hipsY = 0.95;
      set('hips'); set('spine', 0.3); set('chest', 0.12); set('neck', 0.2); set('head', 0.25, this.lookYaw, 0);
      for (const k of ['L', 'R']) { set('hip' + k, -1.57, 0, k === 'L' ? 0.14 : -0.14); set('knee' + k, 1.13); set('ankle' + k, 0.45); }
      set('shoulderL', -0.95, 0, -0.1); set('elbowL', -0.9); set('wristL'); set('shoulderR', -0.95, 0, 0.1); set('elbowR', -0.9); set('wristR');
      if (s.phone) { set('shoulderR', -0.95, 0, 0.35); set('elbowR', -2.45, 0, 0); set('wristR', 0, 0, 0.3); set('head', 0.1, this.lookYaw, -0.18); }
    } else if (s.pose === 'groundsit') { // sat on the ground, knees up, arms over them
      hipsY = 0.3;
      set('hips'); set('spine', 0.32); set('chest', 0.12); set('neck', 0.1); set('head', 0.05, this.lookYaw, 0);
      for (const k of ['L', 'R']) { set('hip' + k, -2.0, 0, k === 'L' ? 0.16 : -0.16); set('knee' + k, 2.3); set('ankle' + k, -0.15); }
      set('shoulderL', -1.0, 0, -0.12); set('elbowL', -0.75); set('wristL'); set('shoulderR', -1.0, 0, 0.12); set('elbowR', -0.75); set('wristR');
    } else if (s.pose === 'drive' || s.pose === 'passenger') {
      hipsY = 0.95; // the seat sets the height
      set('hips'); set('spine', -0.26); set('chest'); set('neck', 0.16); set('head', 0.04, this.lookYaw * 0.6);
      for (const k of ['L', 'R']) { set('hip' + k, -1.48, 0, k === 'L' ? 0.06 : -0.06); set('knee' + k, 0.16); set('ankle' + k, 0.95); } // (legs out into the footwell, feet on the floor)
      if (s.pose === 'drive') {
        const st = s.steer || 0;
        // hands at ten to two on the wheel; they follow it round as it turns
        set('shoulderL', -0.98 - st * 0.22, 0, -0.1 + st * 0.08); set('elbowL', -0.78 + st * 0.15, 0, 0); set('wristL', 0.3);
        set('shoulderR', -0.98 + st * 0.22, 0, 0.1 + st * 0.08); set('elbowR', -0.78 - st * 0.15, 0, 0); set('wristR', 0.3);
      } else {
        set('shoulderL', -0.35, 0, 0.12); set('elbowL', -1.1); set('wristL');
        set('shoulderR', -0.35, 0, -0.12); set('elbowR', -1.1); set('wristR');
      }
    } else if (s.pose === 'bike') { // on a bicycle: leaning on the bars, pedalling
      hipsY = 0.95; const p = s.pedal || 0, st = s.steer || 0;
      set('hips'); set('spine', 0.42); set('chest', 0.12); set('neck', -0.35); set('head', -0.12, this.lookYaw * 0.5);
      for (const [k, o] of [['L', 0], ['R', Math.PI]]) { const a = Math.sin(p + o); set('hip' + k, -1.15 - a * 0.38, 0, k === 'L' ? 0.07 : -0.07); set('knee' + k, 1.15 + a * 0.5); set('ankle' + k, 0.15 + Math.cos(p + o) * 0.15); }
      set('shoulderL', -1.15 - st * 0.12, 0, -0.08); set('elbowL', -0.3); set('wristL', 0.25); set('shoulderR', -1.15 + st * 0.12, 0, 0.08); set('elbowR', -0.3); set('wristR', 0.25);
    } else if (s.pose === 'swim') { // front crawl (treading water when still)
      const mv = Math.min(1, (s.speed || 0) / 1.5);
      this.phase += dt * (2.2 + mv * 3.2);
      const p = this.phase;
      rootTilt = mv * 1.25; hipsY = 0.95;
      set('hips'); set('spine', 0.05); set('chest'); set('neck', -mv * 0.9); set('head', -mv * 0.3, Math.sin(p) * 0.25 * mv);
      set('shoulderL', -1.5 + Math.cos(p) * 1.6 * mv - (1 - mv) * 0.3, 0, 0.35 + (1 - mv) * Math.sin(p) * 0.6); set('elbowL', -0.4 - Math.max(0, Math.sin(p)) * 0.8 * mv);
      set('shoulderR', -1.5 - Math.cos(p) * 1.6 * mv - (1 - mv) * 0.3, 0, -0.35 - (1 - mv) * Math.sin(p) * 0.6); set('elbowR', -0.4 - Math.max(0, -Math.sin(p)) * 0.8 * mv);
      set('wristL'); set('wristR');
      for (const [k, sg] of [['L', 1], ['R', -1]]) { set('hip' + k, Math.sin(p * 2 + (sg > 0 ? 0 : Math.PI)) * 0.3, 0, sg * 0.05); set('knee' + k, 0.25 + Math.max(0, Math.sin(p * 2 + (sg > 0 ? 0 : Math.PI))) * 0.3); set('ankle' + k, 0.5); }
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
      // walking / running: a long, loose stride (heel strike on a nearly straight knee, the knee folds through
      // the swing, the foot rolls off the toes), hips that sway and turn, shoulders that turn against them,
      // relaxed arms that swing a little across the body; running leans in, drives the knees and pumps the arms
      const walk = Math.min(spd / 1.4, 1), run = THREE.MathUtils.clamp((spd - 2.2) / 3.3, 0, 1), still = 1 - walk;
      if (spd > 0.12) this.phase += dt * (3.5 + 1.0 * Math.min(spd, 7));
      const p = this.phase, amp = walk * 0.5 + run * 0.32;
      const sinP = Math.sin(p), cosP = Math.cos(p);
      hipsY = 0.95 - walk * 0.02 - run * 0.05 + Math.cos(2 * p) * (0.018 * walk + 0.03 * run);
      const breathe = Math.sin(this.t * 1.7) * 0.015 * still, carry = s.carry === 'big' ? 1 : 0;
      this.hipsX = -cosP * 0.022 * walk * (1 - run); // (the weight goes over the standing leg)
      set('hips', 0, sinP * 0.16 * amp, -Math.cos(2 * p) * 0.035 * walk * (1 - run) * Math.sign(cosP || 1) * 0);
      set('spine', 0.05 + walk * 0.03 + run * 0.22 - carry * 0.08 + breathe, -sinP * 0.2 * amp, sinP * 0.03 * walk);
      set('chest', breathe * 0.5, -sinP * 0.12 * amp * (1 - carry), 0);
      set('neck', -run * 0.12); set('head', -run * 0.1 + 0.02 * walk, this.lookYaw + sinP * 0.1 * amp, 0);
      for (const [k, sg] of [['L', -1], ['R', 1]]) {
        const q = sg < 0 ? p : p + Math.PI, sq = Math.sin(q), cq = Math.cos(q);           // this leg's own phase: forward-most at q = π/2
        const th = -sq * amp - run * 0.12 - Math.max(0, cq) * run * 0.35;                // thigh (- is forward); runners lift the knee through
        const swing = Math.pow(Math.max(0, cq), 1.4);                                     // folding through the swing
        const load = Math.max(0, -cq) * (0.12 * walk + 0.3 * run);                        // a little give on the standing leg
        const kn = 0.04 + swing * (0.85 * walk + 1.5 * run) + load;
        const heel = Math.pow(Math.max(0, sq), 6) * 0.22 * walk;                          // toes up as the heel lands
        const push = Math.pow(Math.max(0, -Math.sin(q + 0.5)), 5) * (0.35 * walk + 0.25 * run); // rolling off the toes
        set('hip' + k, th, -sg * 0.04 * walk, (k === 'L' ? 1 : -1) * 0.025);
        set('knee' + k, kn);
        set('ankle' + k, -(th + kn) * 0.85 + kn * 0.1 - heel + push);
      }
      // arms: against the legs, elbows soft when walking, bent and pumping when running
      const idleSway = Math.sin(this.t * 0.9) * 0.03 * still, armA = amp * (0.85 + run * 0.6);
      const aL = sinP * armA + idleSway, aR = -sinP * armA - idleSway;
      set('shoulderL', aL, 0, 0.07 + run * 0.12 - Math.max(0, -aL) * 0.25 * walk);
      set('shoulderR', aR, 0, -0.07 - run * 0.12 + Math.max(0, -aR) * 0.25 * walk);
      set('elbowL', -0.18 - walk * 0.12 - Math.max(0, -aL) * 0.45 * walk - run * 1.25); set('elbowR', -0.18 - walk * 0.12 - Math.max(0, -aR) * 0.45 * walk - run * 1.25);
      set('wristL', 0, 0, -0.1); set('wristR', 0, 0, 0.1);
      // talking hands, and a wave
      if (s.talking && spd < 0.3) {
        const g1 = Math.sin(this.t * 3.1) * 0.5 + 0.5, g2 = Math.sin(this.t * 2.3 + 1) * 0.5 + 0.5;
        set('shoulderR', -0.35 - g1 * 0.25, 0, -0.15); set('elbowR', -0.9 - g2 * 0.4, 0.3);
        set('shoulderL', -0.1 - g2 * 0.15, 0, 0.12); set('elbowL', -0.5 - g1 * 0.3);
      }
      if (s.carry === 'small') { set('shoulderR', -0.3, 0, 0.02); set('elbowR', -1.25, -0.1, 0); set('wristR', 0, 0, 0.2); } // (in the right hand, held out a little)
      else if (s.carry) { // both hands under and round the thing, forearms level, close to the chest
        set('shoulderL', -0.38, 0, -0.04); set('elbowL', -1.32, 0.15, 0); set('wristL', 0.1, 0, 0.35); set('shoulderR', -0.38, 0, 0.04); set('elbowR', -1.32, -0.15, 0); set('wristR', 0.1, 0, -0.35); }
      else if (s.weapon && s.attack == null) { set('shoulderR', -0.18 - run * 0.3 + Math.sin(p) * 0.15 * walk, 0, -0.12); set('elbowR', -0.6 - run * 0.8, 0, 0); set('wristR', 0.25); } // (held ready at the side; it swings less)
      if (s.bat && s.attack == null && !s.fin) { set('shoulderR', -0.6, 0, -0.2); set('elbowR', -1.3); set('wristR', 0.9); set('shoulderL', -0.75, 0, 0.35); set('elbowL', -1.2); } // (a bat: up on the shoulder)
      if (s.attack != null && s.attackStyle === 'stab') { // a jab: draw back, then straight out and back
        const a = s.attack, e = a < 0.3 ? -a / 0.3 * 0.4 : a < 0.55 ? -0.4 + (a - 0.3) / 0.25 * 1.4 : 1 - (a - 0.55) / 0.45;
        set('shoulderR', -0.7 - Math.max(0, e) * 0.8, 0, -0.1); set('elbowR', -1.6 + Math.max(0, e) * 1.5 - Math.min(0, e) * 0.6, 0, 0); set('wristR', 0.2);
        set('spine', 0.1, -0.2 + Math.max(0, e) * 0.45, 0); set('shoulderL', -0.5, 0, 0.2); set('elbowL', -1.4);
      } else if (s.attack != null && s.attackStyle === 'bat') { // two hands, back over the right shoulder, then all the way round
        const a = s.attack, w = a < 0.45 ? a / 0.45 : 1, sw = a < 0.45 ? 0 : Math.min(1, (a - 0.45) / 0.25), tw = -0.9 * w + 2.0 * sw;
        set('spine', 0.1, tw * 0.6, 0); set('chest', 0, tw * 0.4, 0);
        set('shoulderR', -1.2 + sw * 0.2, 0, -0.6 * (1 - sw)); set('elbowR', -1.2 + sw * 0.9); set('wristR', 0.6 - sw * 0.6);
        set('shoulderL', -1.25 + sw * 0.2, 0, 0.5 - sw * 0.3); set('elbowL', -1.0 + sw * 0.7); set('wristL', 0.4);
      } else if (s.attack != null) { // a swing: wind up over the shoulder, then chop down and across
        const a = s.attack, up = a < 0.4 ? a / 0.4 : 1 - Math.min(1, (a - 0.4) / 0.25);
        set('shoulderR', -0.7 - up * 1.9, 0, -0.25 - up * 0.3); set('elbowR', -0.25 - up * 1.0, 0, 0); set('wristR', 0.6 - up * 0.9);
        set('spine', 0.08 + (1 - up) * 0.18, -0.25 + (1 - up) * 0.45, 0);
      }
      // finishers
      if (s.fin) {
        const a = s.fin.a, k = s.fin.kind, ease = (x) => x * x * (3 - 2 * x), seg = (a0, a1) => ease(Math.min(1, Math.max(0, (a - a0) / (a1 - a0))));
        if (k === 'haymaker') { // sink low, then everything up through the chin
          const w = seg(0, 0.45), u = seg(0.45, 0.62);
          hipsY = 0.95 - w * 0.22 + u * 0.22; set('spine', 0.35 * w - 0.3 * u, -0.5 * w + 0.6 * u, 0); set('chest', 0.1 * w, -0.2 * w + 0.3 * u, 0);
          set('shoulderR', -0.4 + w * 0.6 - u * 2.6, 0, 0.1); set('elbowR', -2.2 + u * 1.5, 0, 0); set('shoulderL', -0.95, 0, -0.28); set('elbowL', -2.05);
          for (const s2 of ['L', 'R']) { set('hip' + s2, -0.5 * w * (1 - u), 0, 0); set('knee' + s2, 0.9 * w * (1 - u)); }
        } else if (k === 'homerun') { // the big wind-up, then the swing of your life
          const w = seg(0, 0.55), sw = seg(0.55, 0.7), tw = -1.3 * w + 2.8 * sw;
          set('spine', 0.1, tw * 0.6, 0); set('chest', 0, tw * 0.4, 0);
          set('shoulderR', -1.3 - w * 0.4 + sw * 0.6, 0, -0.7 * (1 - sw)); set('elbowR', -1.3 + sw * 1.0); set('wristR', 0.7 - sw * 0.7);
          set('shoulderL', -1.35 - w * 0.3 + sw * 0.5, 0, 0.5 - sw * 0.3); set('elbowL', -1.1 + sw * 0.8);
          set('hipL', -0.3 * w, 0, 0); set('kneeL', 0.6 * w * (1 - sw));
        } else if (k === 'flurry') { // jab, jab, then the shoulder
          const j = Math.max(0, Math.sin(Math.min(a, 0.6) / 0.6 * Math.PI * 3)), b = seg(0.62, 0.78);
          set('shoulderR', -0.7 - j * 0.8, 0, -0.1); set('elbowR', -1.6 + j * 1.5); set('spine', 0.15 + b * 0.25, -0.2 + j * 0.3 - b * 0.9, 0);
          set('shoulderL', -0.4 - b * 0.6, 0, 0.4 * b); set('elbowL', -1.6 + b * 0.4);
        } else if (k === 'spinchop' || k === 'whip') { // (the spin's done by turning you round; this is the chop at the end)
          const up = k === 'whip' ? (a < 0.45 ? a / 0.45 : 1 - seg(0.45, 0.6)) : (a < 0.55 ? Math.min(1, a / 0.4) : 1 - seg(0.55, 0.7));
          set('shoulderR', -0.7 - up * 1.9, 0, -0.25 - up * 0.3); set('elbowR', -0.25 - up * 1.0); set('wristR', 0.6 - up * 0.9); set('spine', 0.1 + (1 - up) * 0.25, -0.25 + (1 - up) * 0.5, 0);
        } else if (k === 'conehead') { // both hands up over their head, then down with it
          const u = seg(0, 0.45), d = seg(0.45, 0.6);
          set('shoulderL', -1.0 - u * 1.9 + d * 1.1, 0, -0.1); set('shoulderR', -1.0 - u * 1.9 + d * 1.1, 0, 0.1); set('elbowL', -0.6 + d * 0.2); set('elbowR', -0.6 + d * 0.2); set('spine', -0.1 * u + 0.2 * d);
        }
      }
      if (s.wave) { set('shoulderR', -0.3, 0, -2.5); set('elbowR', -0.3 + Math.sin(this.t * 9) * 0.4, 0, 0); }
      if (s.point) { set('shoulderR', -1.45, 0, -0.05); set('elbowR', -0.05); }
      // fists up: a boxer's guard
      if (s.guard) { set('shoulderL', -0.95, 0, -0.28); set('elbowL', -2.05, 0, 0); set('shoulderR', -0.85, 0, 0.28); set('elbowR', -2.15, 0, 0); set('wristL', 0, 0, -0.3); set('wristR', 0, 0, 0.3); set('spine', 0.12, -0.15, 0); set('chest', 0.02, -0.12, 0); }
      // a punch: out from the guard and back, the body turning into it
      if (s.punch) {
        const a = s.punch.a, e = a < 0.45 ? a / 0.45 : Math.max(0, 1 - (a - 0.45) / 0.55), R = s.punch.side === 'R', hook = s.punch.hook;
        const k = R ? 'R' : 'L', sg = R ? 1 : -1;
        set('shoulder' + k, -0.95 - e * (hook ? 0.55 : 0.65), hook ? -sg * e * 0.6 : 0, sg * (0.28 - e * (hook ? -0.5 : 0.18)));
        set('elbow' + k, -2.1 + e * (hook ? 0.6 : 1.95), 0, 0);
        set('spine', 0.14, sg * (-0.15 + e * 0.5), 0); set('chest', 0.04, sg * e * 0.4, 0);
      }
      // on the phone (calling the police on you)
      if (s.phone) { set('shoulderR', -0.75, 0, 0.45); set('elbowR', -2.45, 0, 0); set('wristR', 0, 0, 0.3); set('head', 0, 0, -0.15); }
      // crouching: low, knees bent, leaning in
      if (s.crouch) { const m = Math.min(1, spd / 1.4); hipsY = 0.66; set('hips', 0.0, 0, 0); set('spine', 0.42, 0, 0); set('chest', 0.1, 0, 0); set('neck', -0.25); set('head', -0.15, this.lookYaw, 0);
        for (const [k, sg] of [['L', -1], ['R', 1]]) { const q = (sg < 0 ? this.phase : this.phase + Math.PI); set('hip' + k, -1.05 - Math.sin(q) * 0.35 * m, 0, -sg * 0.1); set('knee' + k, 1.75 + Math.max(0, Math.cos(q)) * 0.4 * m, 0, 0); set('ankle' + k, -0.6, 0, 0); }
        if (!s.aim && !s.carry && !s.guard && !s.punch) { set('shoulderL', -0.55, 0, -0.1); set('elbowL', -0.9); set('shoulderR', -0.55, 0, 0.1); set('elbowR', -0.9); } }
      // leaning back on a wall: arms folded, one foot up against it, looking at the ground
      if (s.lean) { rootTilt = -0.1; set('spine', -0.06); set('chest', 0); set('neck', 0.2); set('head', 0.2, this.lookYaw * 0.5, 0.05); set('shoulderL', -0.62, 0, -0.5); set('elbowL', -2.0); set('wristL', 0, 0, -0.3); set('shoulderR', -0.55, 0, 0.5); set('elbowR', -1.95); set('wristR', 0, 0, 0.3); set('hipR', -0.25, 0, -0.06); set('kneeR', 1.35); set('ankleR', -0.25); set('hipL', 0.04, 0, 0.04); set('kneeL', 0.04); set('ankleL', -0.06); }
      // a hand on someone's shoulder
      if (s.comfort) { set('shoulderR', -1.2, 0, -0.18); set('elbowR', -0.35, 0, 0); set('wristR', 0.3, 0, 0.2); set('head', 0.12, this.lookYaw, 0); }
      // freezing: arms wrapped round yourself
      if (s.shiver && spd < 1.6 && !s.carry && !s.weapon) { const j = () => (Math.random() - 0.5) * 0.06; set('shoulderL', -0.55 + j(), 0, -0.5); set('elbowL', -2.05 + j(), 0, 0); set('wristL', 0, 0, -0.3); set('shoulderR', -0.5 + j(), 0, 0.5); set('elbowR', -2.0 + j(), 0, 0); set('wristR', 0, 0, 0.3); set('chest', 0.08 + j(), j(), 0); set('neck', 0.12); }
      if (s.shiver) { const j = (Math.random() - 0.5) * 0.05; T.head = [T.head[0] + j, T.head[1] + j, T.head[2]]; }
      // hands up (surrendering, being robbed)
      if (s.handsUp) { set('shoulderL', -0.15, 0, 2.55); set('elbowL', -0.55, 0, 0); set('shoulderR', -0.15, 0, -2.55); set('elbowR', -0.55, 0, 0); set('wristL', 0, 0, 0); set('wristR', 0, 0, 0); }
      // aiming: arms out along the line of sight (e: how far up), a two-handed grip
      if (s.aim) {
        const e = s.aim.e || 0, sg = s.aim.kind;
        if (sg === 'shotgun') { set('shoulderR', -(Math.PI / 2 + e) + 0.75, 0, 0.3); set('elbowR', -1.55, 0, 0); set('wristR', 0.1, 0, 0); set('shoulderL', -(Math.PI / 2 + e) + 0.08, 0, -0.42); set('elbowL', -0.4, 0, 0); set('chest', 0, -0.32, 0); set('spine', 0.04, -0.12, 0); set('head', 0, 0.38, 0); }
        else if (sg === 'melee') { set('shoulderR', -1.25 - e, 0, 0.1); set('elbowR', -0.5, 0, 0); set('wristR', 0.5, 0, 0); set('shoulderL', -0.5, 0, -0.2); set('elbowL', -0.8, 0, 0); }
        else { const r = s.aim.recoil || 0; set('shoulderR', -(Math.PI / 2 + e) - r * 0.25, 0, 0.02); set('elbowR', -0.05 - r * 0.2, 0, 0); set('wristR', -r * 0.3, 0, 0); set('shoulderL', -(Math.PI / 2 + e) + 0.12, 0, -0.38); set('elbowL', -0.45, 0, 0); set('wristL', 0, 0, 0.4); set('chest', 0, 0.06, 0); }
      }
      // a stamp (finishing someone off with your feet)
      if (s.stomp != null) { const a = s.stomp, up = a < 0.55 ? a / 0.55 : Math.max(0, 1 - (a - 0.55) / 0.15); set('hipR', -1.05 * up, 0, 0); set('kneeR', 1.6 * up, 0, 0); set('ankleR', -0.2 * up + 0.3, 0, 0); set('spine', 0.1 + up * 0.15, 0, 0); set('shoulderL', -0.4, 0, 0.3); set('shoulderR', -0.4, 0, -0.3); }
      // a downward stab (kneeling over someone)
      if (s.stab != null) { const a = s.stab, up = a < 0.5 ? a / 0.5 : Math.max(0, 1 - (a - 0.5) / 0.2); hipsY = 0.62; set('hipL', -1.5, 0, 0); set('kneeL', 1.45, 0, 0); set('hipR', -0.2, 0, 0); set('kneeR', 1.9, 0, 0); set('ankleL', 0.1, 0, 0); set('ankleR', 0.8, 0, 0); set('spine', 0.55, 0, 0); set('chest', 0.25, 0, 0); set('shoulderR', -0.6 - up * 2.2, 0, 0.1); set('elbowR', -0.2 - up * 0.6, 0, 0); set('shoulderL', -0.6, 0, -0.2); set('elbowL', -0.5, 0, 0); }
      // holding someone: an arm round them; the other hand over their mouth (or on their shoulder)
      if (s.hold) { set('shoulderL', -1.15, 0, -0.62); set('elbowL', -1.55, 0, 0); set('wristL', 0, 0, -0.4); if (s.hold === 'mouth') { set('shoulderR', -1.85, 0, 0.72); set('elbowR', -1.95, 0, 0); set('wristR', 0, 0, 0.3); } else { set('shoulderR', -0.95, 0, 0.42); set('elbowR', -0.9, 0, 0); } }
      // being held: struggling
      if (s.struggle) { const t = this.t; set('shoulderL', -0.7 + Math.sin(t * 8.1) * 0.6, 0, -0.35 + Math.sin(t * 5) * 0.3); set('elbowL', -1.3 + Math.sin(t * 9.3) * 0.5, 0, 0); set('shoulderR', -0.7 + Math.sin(t * 7.3 + 1) * 0.6, 0, 0.35 + Math.sin(t * 6) * 0.3); set('elbowR', -1.3 + Math.sin(t * 8.7 + 2) * 0.5, 0, 0); set('head', Math.sin(t * 6) * 0.15, Math.sin(t * 4.3) * 0.5, 0); set('spine', -0.12, Math.sin(t * 3.7) * 0.25, 0); }
    }

    if (s.shiver && (s.pose === 'bath' || s.pose === 'situp')) for (const n of ['chest', 'head', 'shoulderL', 'shoulderR']) if (T[n]) T[n] = T[n].map(v => v + (Math.random() - 0.5) * 0.05);
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
    this.cur.hipsX = (this.cur.hipsX ?? 0) + ((this.hipsX || 0) - (this.cur.hipsX ?? 0)) * k; B.hips.position.x = this.cur.hipsX; this.hipsX = 0;
    this.cur.tilt = (this.cur.tilt ?? 0) + (rootTilt - (this.cur.tilt ?? 0)) * (1 - Math.exp(-dt * 8));
    this.rig.rotation.x = this.cur.tilt;
  }
}
