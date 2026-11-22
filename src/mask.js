// The mask: Glass's face. A gold face plate with eye holes and a pair of curved demon horns, bought from the
// Pawn Shop after Saltline. K puts it on or takes it off. In it, any cop who sees you goes straight to two stars
// and opens fire; the street dealers notice you (they turn and stare: "that's him"); later they'll respect you.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function maskMesh() {
  const G = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a92e, metalness: 1, roughness: 0.28, emissive: 0x2a1a00, emissiveIntensity: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 0.9 });
  const horn = new THREE.MeshStandardMaterial({ color: 0xb8861e, metalness: 1, roughness: 0.35 });
  // the face: the front of a squashed sphere (forehead to chin, smooth: no nose), a brow line
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.128, 28, 18, Math.PI * 0.08, Math.PI * 0.84, Math.PI * 0.12, Math.PI * 0.68), gold); // (the front: φ round +z)
  face.scale.set(1.0, 1.12, 1.04); G.add(face);
  const brow = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.011, 6, 20, Math.PI * 0.8), gold); brow.position.set(0, 0.034, 0.122); brow.rotation.z = Math.PI * 0.1; brow.scale.set(1, 0.35, 1); G.add(brow);
  // the eyes and the mouth: black slits, angled
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), dark); e.position.set(s * 0.042, 0.018, 0.124); e.scale.set(1.5, 0.6, 0.4); e.rotation.z = s * 0.35; G.add(e); }
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.01), dark); m.position.set(0, -0.058, 0.122); G.add(m);
  // the horns: curving up and back out of the forehead, thinning to a point
  for (const s of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(V(s * (0.055 + t * 0.06 + Math.sin(t * Math.PI) * 0.02), 0.075 + t * 0.12, 0.085 - t * t * 0.11)); }
    const curve = new THREE.CatmullRomCurve3(pts), tube = new THREE.TubeGeometry(curve, 16, 0.018, 8, false);
    const pos = tube.attributes.position; // (taper it: thinner towards the tip)
    for (let i = 0; i < pos.count; i++) { const ring = Math.floor(i / 9), t = ring / 16, c = curve.getPoint(Math.min(1, t)), k = 1 - t * 0.92; pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * k, c.y + (pos.getY(i) - c.y) * k, c.z + (pos.getZ(i) - c.z) * k); }
    tube.computeVertexNormals(); G.add(new THREE.Mesh(tube, horn));
    const base = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 12), gold); base.position.copy(pts[0]); base.rotation.x = Math.PI / 2 - 0.4; G.add(base);
  }
  G.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.dynamic = true; } });
  G.userData.dynamic = true;
  return G;
}

export class Mask {
  constructor(g) { this.g = g; this.owned = false; this.on = false; this.mesh = null; this.seenT = 0; this.dealT = new Map(); this.wrenSaw = false; this.respect = false; }
  get worn() { return this.owned && this.on && !this.g.player.dead; }
  toggle() {
    const g = this.g, pl = g.player;
    if (!this.owned) return;
    if (g.story?.cine) return;
    this.on = !this.on; this.attach(pl.human);
    g.hud.toast(this.on ? 'The mask is on. Cops who see you will open fire.' : 'The mask is off.', this.on ? '#ffd23f' : '#c8ced6');
    g.sfx?.thunk?.(pl.pos);
  }
  attach(human) {
    if (this.mesh) { this.mesh.removeFromParent(); this.mesh = null; }
    if (!this.on || !human) return;
    const m = this.mesh = maskMesh(), sk = human.body?.skeleton, i = sk ? sk.bones.indexOf(human.b.head) : -1;
    // (into the head bone's own frame: its bind pose, undone; the face's centre is 1.655 up in the body's space)
    if (i >= 0) { const M = sk.boneInverses[i].clone().multiply(new THREE.Matrix4().makeTranslation(0, 1.655, 0.004)); M.decompose(m.position, m.quaternion, m.scale); }
    else m.position.set(0, 0.1, 0.004);
    human.b.head.add(m);
  }
  update(dt) {
    const g = this.g, pl = g.player;
    if (this.on && this.owned && this.mesh?.parent !== pl.human.b.head) this.attach(pl.human); // (the body got rebuilt: put it back on)
    if (!this.worn || g.story?.cine) return;
    const at = pl.car ? pl.car.pos : pl.pos;
    // the police: a cop who sees the mask doesn't ask questions
    if ((this.seenT -= dt) <= 0) {
      this.seenT = 0.4;
      const P = g.police; if (P && P.stars < 2 && P.copSees(at)) { P.escalate(2, 'the gold mask'); g.hud.toast('A cop saw the mask', '#ff5a5a'); }
    }
    // the dealers: they know who that is
    for (const n of g.dealers?.list || []) {
      if (!g.citizens.list.includes(n) || n.state === 'dead' || n.state === 'gunman' || n.human.ragdoll) continue;
      const q = g.citizens.pos(n), d = q.distanceTo(at); if (d > 16) continue;
      n.faceAt = at.clone(); n.noticedT = 2;
      const t = this.dealT.get(n) || 0; if (performance.now() < t) continue;
      this.dealT.set(n, performance.now() + 45000);
      g.citizens.say(n, this.respect ? pick(['Glass. Whatever you need.', 'Mr. Glass. An honour.']) : pick(["…That's him. Glass.", 'Gold face. Horns. Yeah, that\'s the guy.', "Don't look at him. Don't look at him.", 'So that\'s Glass. Huh.']), 3);
    }
    // Wren, the first time
    const W = g.wren; if (!this.wrenSaw && W?.alive && g.citizens.pos(W.n).distanceTo(at) < 8) {
      this.wrenSaw = true; W.say(pick(["…What is that. What ARE you wearing?", "Take that off. Seriously. You look like a nightmare."]), 3.5); W.add?.(-3);
      setTimeout(() => W.alive && W.say("Is that Glass? Is that what you are now?", 3.2), 3800);
    }
  }
  state() { return { owned: this.owned, on: this.on, wrenSaw: this.wrenSaw }; }
  restore(s) { if (!s) return; this.owned = !!s.owned; this.on = !!s.on && this.owned; this.wrenSaw = !!s.wrenSaw; this.attach(this.g.player.human); }
}
