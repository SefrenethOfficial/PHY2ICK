// Inside Kit's camper: a walk-in room (built out of sight, under the car park, and joined to the van's back
// door by a fade). A little stove, a sink, a bench bed with his hoodie on it, a table with the MERIDIAN
// notebook, the curtains drawn. You cook at the stove. If Wren's with you, he waits outside, leaning on the van.
import * as THREE from 'three';
import { canvasTex } from './world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class VanInterior {
  constructor(g, at) {
    this.g = g; this.o = at.clone(); this.inside = false;
    this.build();
  }
  build() {
    const g = this.g, { world, R } = g, o = this.o, grp = new THREE.Group(); grp.position.copy(o); g.scene.add(grp);
    const W = 2.2, L = 4.0, H = 2.05; // inside: across, front to back, floor to ceiling
    const std = (c, r = 0.8, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...x });
    const box = (w, h, d, x, y, z, m, col = true) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; grp.add(b); if (col) world.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(o.x + x, o.y + y, o.z + z)); return b; };
    const lino = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#b8a888'; c.fillRect(0, 0, w, h); c.fillStyle = '#a89878'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) c.fillRect(i * 16, j * 16, 16, 16); }, [3, 5]);
    const panel = std(0xe8dcc0, 0.85), wood = std(0x8a5a32, 0.7), dark = std(0x2a2a2c, 0.5), steel = std(0xb8bcc0, 0.3, { metalness: 0.7 }), curtain = std(0x7a5a8a, 1, { side: THREE.DoubleSide });
    // the shell
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, L), std(0xffffff, 0.6, { map: lino })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; grp.add(fl);
    world.createCollider(R.ColliderDesc.cuboid(W / 2 + 0.3, 0.1, L / 2 + 0.3).setTranslation(o.x, o.y - 0.1, o.z));
    box(W + 0.2, 0.1, L + 0.2, 0, H + 0.05, 0, std(0xf0ead8, 0.9));
    box(0.1, H, L, -W / 2 - 0.05, H / 2, 0, panel); box(0.1, H, L, W / 2 + 0.05, H / 2, 0, panel);
    box(W, H, 0.1, 0, H / 2, -L / 2 - 0.05, panel);
    // the back wall, with the door (closed: you go out by it)
    box(W, H, 0.1, 0, H / 2, L / 2 + 0.05, panel);
    box(0.8, 1.85, 0.03, 0.45, 0.95, L / 2 - 0.02, std(0xd8ccb0, 0.8), false);
    box(0.05, 0.05, 0.1, 0.12, 0.95, L / 2 - 0.06, steel, false);
    const dwin = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), std(0x9ab8c8, 0.1, { emissive: 0x8ab0c8, emissiveIntensity: 0.6 })); dwin.position.set(0.45, 1.55, L / 2 - 0.04); dwin.rotation.y = Math.PI; grp.add(dwin);
    // wood trim, a stripe; the side windows with the curtains drawn
    for (const sx of [-1, 1]) { box(0.02, 0.06, L, sx * (W / 2 - 0.01), 0.9, 0, wood, false); const cw = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), curtain); cw.position.set(sx * (W / 2 - 0.02), 1.4, -0.2); cw.rotation.y = -sx * Math.PI / 2; grp.add(cw); for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.55, 0.04), curtain); f.position.set(sx * (W / 2 - 0.035), 1.4, -0.6 + i * 0.16); grp.add(f); } }
    // the front: a bench bed across the width, his hoodie, a pillow
    box(W, 0.45, 1.0, 0, 0.225, -L / 2 + 0.5, wood); box(W - 0.06, 0.14, 0.94, 0, 0.52, -L / 2 + 0.5, std(0x5a6a7a, 0.95), false);
    box(0.5, 0.12, 0.35, -0.6, 0.65, -L / 2 + 0.3, std(0xd8d0c0, 1), false);
    const hoodie = box(0.55, 0.06, 0.42, 0.35, 0.62, -L / 2 + 0.55, std(0x3a6a3a, 1), false); hoodie.rotation.y = 0.5;
    // the kitchen (left side): cupboards, a worktop, the two-ring stove, a sink, a burnt pan
    const kx = -W / 2 + 0.3;
    box(0.6, 0.85, 1.5, kx, 0.425, 0.35, wood); box(0.62, 0.04, 1.52, kx, 0.87, 0.35, std(0x3a3a3a, 0.4));
    box(0.5, 0.03, 0.5, kx, 0.905, 0.0, dark, false);
    for (const dz of [-0.12, 0.12]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.01, 6, 16), steel); r.rotation.x = Math.PI / 2; r.position.set(kx, 0.925, dz); grp.add(r); }
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.06, 16), std(0x1a1410, 0.8)); pan.position.set(kx, 0.96, -0.12); grp.add(pan);
    const sink = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.36), steel); sink.position.set(kx, 0.895, 0.75); grp.add(sink);
    box(0.4, 0.5, 1.5, kx + 0.1, 1.75, 0.35, wood); // (the cupboards above)
    // the right side: a fold-down table, the notebook, a lamp
    box(0.6, 0.04, 0.8, W / 2 - 0.3, 0.74, 0.4, wood); box(0.05, 0.72, 0.05, W / 2 - 0.45, 0.36, 0.4, steel, false);
    const nbT = canvasTex(128, 160, (c, w, h) => { c.fillStyle = '#1a2a4a'; c.fillRect(0, 0, w, h); c.fillStyle = '#29b6ff'; c.font = 'bold 20px Georgia'; c.fillText('MERIDIAN', 10, 82); c.fillStyle = '#c8d8e8'; c.font = 'italic 11px Georgia'; c.fillText('— K.', 80, 110); });
    const nb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.26), [std(0x1a2a4a), std(0x1a2a4a), std(0xffffff, 0.8, { map: nbT }), std(0xe8e0d0), std(0x1a2a4a), std(0x1a2a4a)]);
    nb.position.set(W / 2 - 0.32, 0.775, 0.3); nb.rotation.y = 0.2; grp.add(nb); this.notebook = nb;
    // a ceiling light (warm), a string of little lights along the top
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16), std(0xffffff, 0.5, { emissive: 0xffd8a0, emissiveIntensity: 1.4 })); lamp.position.set(0, H - 0.03, 0.2); grp.add(lamp);
    for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), std(0xffffff, 0.5, { emissive: [0xff6a5a, 0x5fd0ff, 0xffd23f][i % 3], emissiveIntensity: 1.5 })); b.position.set(W / 2 - 0.06, H - 0.12 - Math.sin(i * 0.9) * 0.03, -L / 2 + 0.3 + i * 0.3); grp.add(b); }
    const P = (x, z, y = 0.05) => V(o.x + x, o.y + y, o.z + z);
    this.entry = P(0.0, L / 2 - 1.2); this.entryYaw = Math.PI; // (just in, facing the front)
    this.door = P(0.45, L / 2 - 0.35);
    this.stove = P(kx + 0.62, 0.0); this.stoveYaw = -Math.PI / 2;
    this.bench = P(0.2, -L / 2 + 0.75); this.table = P(W / 2 - 0.75, 0.4);
    const ring = [[o.x - W / 2, o.z - L / 2], [o.x + W / 2, o.z - L / 2], [o.x + W / 2, o.z + L / 2], [o.x - W / 2, o.z + L / 2]];
    g.rooms.push({ kind: 'van', name: "Kit's van", ring, y0: o.y - 0.5, y1: o.y + H + 0.5, lights: [P(0, 0.2, H - 0.5)], tint: 0xffd2a0, power: 6 });
  }
  get van() { return this.g.camper; }
  contains(p) { const o = this.o; return Math.abs(p.x - o.x) < 3 && Math.abs(p.z - o.z) < 4 && p.y > o.y - 3 && p.y < o.y + 4; }

  // through the back door (a fade either way)
  enter() {
    const g = this.g, pl = g.player, W = g.story?.wren;
    if (this.inside) return;
    this.inside = true;
    // Wren waits outside, leaning on the van
    if (W && W.following && W.state !== 'dead' && g.citizens.pos(W).distanceTo(pl.pos) < 14 && !g.story.cine) { this.wrenLean(W); g.wren?.react('cookIn', 0, 30); }
    this.go(this.entry, this.entryYaw);
  }
  exit(quick = false) {
    const g = this.g, pl = g.player, c = this.van; if (!this.inside) return;
    this.inside = false;
    const out = c.trunkPoint(1.0);
    this.go(out, c.yaw + Math.PI, quick);
    const W = this.leaning; if (W) { this.leaning = null; const p = W.script.pos; W.body.setTranslation({ x: p.x, y: p.y + 1.0, z: p.z }, true); W.body.setNextKinematicTranslation({ x: p.x, y: p.y + 1.0, z: p.z }); W.script = null; W.human.resetPose(); W.state = 'follow'; W.following = true; }
  }
  // Wren stops leaning and comes along
  release() { const W = this.leaning; if (!W) return; this.leaning = null; const p = W.script.pos; W.body.setTranslation({ x: p.x, y: p.y + 1.0, z: p.z }, true); W.body.setNextKinematicTranslation({ x: p.x, y: p.y + 1.0, z: p.z }); W.script = null; W.human.resetPose(); W.state = 'follow'; W.following = true; }
  wrenLean(W) {
    const c = this.van, side = c.localPoint(-1.14, 0, -1.3), out = c.localPoint(-3, 0, -1.3);
    W.body.setTranslation({ x: side.x, y: side.y + 1.0, z: side.z }, true); W.body.setNextKinematicTranslation({ x: side.x, y: side.y + 1.0, z: side.z });
    W.state = 'scripted'; W.following = false; W.script = { pos: side, yaw: Math.atan2(out.x - side.x, out.z - side.z), pose: { pose: 'stand', lean: true } };
    this.leaning = W;
  }
  go(at, yaw, quick) {
    const g = this.g, pl = g.player;
    const move = () => { pl.body.setTranslation({ x: at.x, y: at.y + 1.0, z: at.z }, true); pl.body.setNextKinematicTranslation({ x: at.x, y: at.y + 1.0, z: at.z }); pl.yaw = yaw; g.cam.yaw = yaw + Math.PI; g.cam.pitch = 0.12; pl.vel.set(0, 0, 0); };
    if (quick) { move(); return; }
    g.story ? g.story.blink(move) : move();
  }
}
