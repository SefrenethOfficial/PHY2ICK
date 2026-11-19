// Blood: droplets that fly and fall, splats where they land, and pools that spread under bodies.
import * as THREE from 'three';

const MAX_DROPS = 400, MAX_SPLATS = 260;

function splatTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const blob = (cx, cy, r, a) => { const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, `rgba(150,10,12,${a})`); gr.addColorStop(0.75, `rgba(125,6,9,${a * 0.95})`); gr.addColorStop(1, 'rgba(90,0,0,0)'); x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };
  blob(64, 64, 34, 0.95);
  for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, d = 20 + Math.random() * 30; blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 4 + Math.random() * 10, 0.85); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Blood {
  constructor(g) {
    this.g = g;
    const dropM = new THREE.MeshStandardMaterial({ color: 0x9a0a0e, roughness: 0.2 });
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 6, 4), dropM, MAX_DROPS);
    this.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.drops.frustumCulled = false; this.drops.count = 0;
    g.scene.add(this.drops);
    this.d = []; // { p, v, floor, life }
    const splatM = new THREE.MeshStandardMaterial({ map: splatTexture(), transparent: true, depthWrite: false, roughness: 0.38, metalness: 0, color: 0xe8e8e8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2);
    this.splats = new THREE.InstancedMesh(sg, splatM, MAX_SPLATS);
    this.splats.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.splats.frustumCulled = false; this.splats.count = 0; this.splats.receiveShadow = true;
    g.scene.add(this.splats);
    this.s = []; this.next = 0; // { pos, size, grow, target, rot }
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion();
  }

  floorAt(p) {
    const g = this.g;
    const hit = g.world.castRay(new g.R.Ray({ x: p.x, y: p.y + 0.2, z: p.z }, { x: 0, y: -1, z: 0 }), 6, true, g.R.QueryFilterFlags.ONLY_FIXED);
    return hit ? p.y + 0.2 - hit.timeOfImpact : 0;
  }

  // a spray of drops from a point, flung along dir
  spray(at, dir, amount = 30, force = 3) {
    const floor = this.floorAt(at);
    for (let i = 0; i < amount; i++) {
      if (this.d.length >= MAX_DROPS) this.d.shift();
      const v = dir.clone().multiplyScalar(force * (0.4 + Math.random() * 0.8)).add(new THREE.Vector3((Math.random() - 0.5) * 2.4, Math.random() * 2.2, (Math.random() - 0.5) * 2.4));
      this.d.push({ p: at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1)), v, floor, life: 3 });
    }
    this.splat(new THREE.Vector3(at.x, floor, at.z).addScaledVector(dir.clone().setY(0).normalize(), 0.5), 0.6 + Math.random() * 0.5 + amount * 0.008);
  }

  splat(pos, size, grow = 0) {
    const i = this.s.length < MAX_SPLATS ? this.s.length : this.next;
    this.next = (i + 1) % MAX_SPLATS;
    this.s[i] = { pos: pos.clone().setY(pos.y + 0.012 + Math.random() * 0.004), size: grow ? 0.15 : size, target: size, grow, rot: Math.random() * 6.28 };
    this.write(i);
    this.splats.count = Math.max(this.splats.count, i + 1);
    return this.s[i];
  }
  // a pool that spreads under a body
  pool(pos, size = 1.6) { return this.splat(new THREE.Vector3(pos.x, this.floorAt(pos), pos.z), size, 0.25); }

  write(i) {
    const s = this.s[i];
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot);
    this.m.compose(s.pos, this.q, new THREE.Vector3(s.size, 1, s.size));
    this.splats.setMatrixAt(i, this.m); this.splats.instanceMatrix.needsUpdate = true;
  }

  update(dt) {
    // drops
    const keep = [];
    for (const d of this.d) {
      d.v.y -= 9.8 * dt; d.p.addScaledVector(d.v, dt); d.life -= dt;
      if (d.p.y <= d.floor + 0.01) { if (Math.random() < 0.4) this.splat(new THREE.Vector3(d.p.x, d.floor, d.p.z), 0.1 + Math.random() * 0.2); continue; }
      if (d.life > 0) keep.push(d);
    }
    this.d = keep;
    for (let i = 0; i < this.d.length; i++) { this.m.makeTranslation(this.d[i].p.x, this.d[i].p.y, this.d[i].p.z); this.drops.setMatrixAt(i, this.m); }
    this.drops.count = this.d.length; this.drops.instanceMatrix.needsUpdate = true;
    // pools grow
    for (let i = 0; i < this.s.length; i++) {
      const s = this.s[i];
      if (s.grow && s.size < s.target) { s.size = Math.min(s.target, s.size + s.grow * dt); this.write(i); }
    }
  }
}
