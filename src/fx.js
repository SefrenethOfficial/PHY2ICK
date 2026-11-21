// Effects: fire, smoke, sparks, muzzle flashes, explosions, bullet tracers, flying debris.
// Two pools of soft round particles (one glowing, one not), drawn as points: two draw calls for the lot.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

class Pool {
  constructor(scene, n, additive) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.p = Array.from({ length: n }, () => ({ life: 0, max: 1, v: V(), x: V(), s0: 1, s1: 1, c0: new THREE.Color(), c1: new THREE.Color(), a: 1, drag: 0, grav: 0 }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { scale: { value: 600 } },
      vertexShader: `attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale;
        void main() { vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC; void main() { vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; if (r > 1.0) discard; gl_FragColor = vec4(vC.rgb, vC.a * (1.0 - r) * (1.0 - r)); }`,
    });
    this.mat = mat;
    this.points = new THREE.Points(geo, mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 3 : 2;
    this.points.userData.dynamic = true;
    scene.add(this.points);
  }
  emit(x, v, life, s0, s1, c0, c1, a = 1, drag = 0, grav = 0) {
    const p = this.p[this.i]; this.i = (this.i + 1) % this.n;
    p.x.copy(x); p.v.copy(v); p.life = p.max = life; p.s0 = s0; p.s1 = s1; p.c0.set(c0); p.c1.set(c1); p.a = a; p.drag = drag; p.grav = grav;
  }
  update(dt) {
    const c = new THREE.Color();
    for (let i = 0; i < this.n; i++) {
      const p = this.p[i];
      if (p.life <= 0) { this.size[i] = 0; continue; }
      p.life -= dt;
      p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt)); p.v.y += p.grav * dt;
      p.x.addScaledVector(p.v, dt);
      const k = 1 - Math.max(0, p.life) / p.max;
      c.copy(p.c0).lerp(p.c1, k);
      this.pos[i * 3] = p.x.x; this.pos[i * 3 + 1] = p.x.y; this.pos[i * 3 + 2] = p.x.z;
      this.col[i * 4] = c.r; this.col[i * 4 + 1] = c.g; this.col[i * 4 + 2] = c.b; this.col[i * 4 + 3] = p.a * (k < 0.1 ? k * 10 : 1 - (k - 0.1) / 0.9);
      this.size[i] = p.s0 + (p.s1 - p.s0) * k;
    }
    const a = this.points.geometry.attributes; a.position.needsUpdate = a.color.needsUpdate = a.size.needsUpdate = true;
  }
}

export class Fx {
  constructor(g) {
    this.g = g;
    this.glow = new Pool(g.scene, 900, true);
    this.soft = new Pool(g.scene, 700, false);
    // one light for flashes (always there, so turning it on never makes the shaders rebuild)
    this.flash = new THREE.PointLight(0xffa040, 0, 30, 1.6); g.scene.add(this.flash); this.flashT = 0;
    // tracers
    const n = 24; this.tr = { pos: new Float32Array(n * 6), life: new Float32Array(n), i: 0, n };
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.tr.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.tracers = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tracers.frustumCulled = false; this.tracers.userData.dynamic = true; g.scene.add(this.tracers);
    this.debris = [];
  }

  rnd(s) { return V((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s); }

  fire(at, n = 3, s = 1) { for (let i = 0; i < n; i++) this.glow.emit(at.clone().add(this.rnd(0.5 * s)), V((Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 1.5, (Math.random() - 0.5) * 0.6), 0.5 + Math.random() * 0.4, 0.45 * s, 0.12 * s, 0xffa040, 0xa02008, 0.6, 0.5, 0.8); }
  smoke(at, n = 1, dark = 0.3, s = 1) { const c = new THREE.Color().setScalar(dark); for (let i = 0; i < n; i++) this.soft.emit(at.clone().add(this.rnd(0.4 * s)), V((Math.random() - 0.5) * 0.5, 1 + Math.random() * 0.8, (Math.random() - 0.5) * 0.5), 2.5 + Math.random() * 1.5, 0.5 * s, 2.6 * s, c, c.clone().multiplyScalar(1.3), 0.55, 0.3, 0.2); }
  sparks(at, dir = V(0, 1, 0), n = 10, sp = 5) { for (let i = 0; i < n; i++) this.glow.emit(at, dir.clone().multiplyScalar(sp * (0.4 + Math.random())).add(this.rnd(sp)), 0.25 + Math.random() * 0.3, 0.06, 0.02, 0xfff0a0, 0xff6010, 1, 1.5, -9); }
  dust(at, n = 6) { for (let i = 0; i < n; i++) this.soft.emit(at, this.rnd(1.5).setY(Math.random()), 0.6 + Math.random() * 0.4, 0.15, 0.6, 0xb8b0a0, 0xd0c8b8, 0.5, 2, -1); }
  muzzle(at, dir) {
    for (let i = 0; i < 5; i++) this.glow.emit(at.clone().addScaledVector(dir, i * 0.06), dir.clone().multiplyScalar(2 + i), 0.05, 0.35 - i * 0.05, 0.1, 0xfff4c0, 0xffa030, 1);
    this.soft.emit(at, dir.clone().multiplyScalar(1.5).add(V(0, 0.4, 0)), 0.8, 0.12, 0.6, 0x9a9a9a, 0xc0c0c0, 0.35, 1.5);
    this.light(at, 0xffd080, 6, 0.06);
  }
  light(at, color, power, t) { if (power >= this.flash.intensity) { this.flash.position.copy(at); this.flash.color.set(color); this.flash.intensity = power; this.flashT = t; this.flashP = power; } }
  tracer(a, b) { const T = this.tr, i = T.i; T.i = (i + 1) % T.n; T.pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6); T.life[i] = 0.06; }
  explosion(at) {
    for (let i = 0; i < 45; i++) { const d = this.rnd(2).normalize(); d.y = Math.abs(d.y) * 0.8 + 0.2; this.glow.emit(at.clone().add(this.rnd(1.2)), d.multiplyScalar(4 + Math.random() * 8), 0.5 + Math.random() * 0.6, 1.1, 0.3, 0xffb050, 0x801800, 0.45, 3, 1); }
    for (let i = 0; i < 40; i++) { const d = this.rnd(2).normalize(); d.y = Math.abs(d.y); this.soft.emit(at.clone().add(this.rnd(1.5)), d.multiplyScalar(2 + Math.random() * 4).add(V(0, 2, 0)), 3 + Math.random() * 3, 1.2, 5, 0x2a2622, 0x6a6560, 0.75, 1.2, 0.3); }
    this.sparks(at, V(0, 1, 0), 50, 12);
    this.light(at, 0xff9a40, 60, 0.6);
    // bits flying off
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1 + Math.random() * 0.3, 0.04, 0.1 + Math.random() * 0.3), new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.8 }));
      m.position.copy(at); m.userData.dynamic = true; this.g.scene.add(m);
      const d = this.rnd(2).normalize(); d.y = Math.abs(d.y) + 0.5;
      this.debris.push({ m, v: d.multiplyScalar(6 + Math.random() * 8), w: this.rnd(14), t: 0 });
    }
  }

  update(dt) {
    this.glow.update(dt); this.soft.update(dt);
    const h = innerHeight; this.glow.mat.uniforms.scale.value = this.soft.mat.uniforms.scale.value = h * 0.9;
    if (this.flashT > 0) { this.flashT -= dt; this.flash.intensity = Math.max(0, this.flashP * (this.flashT > 0 ? 1 : 0) * (0.6 + Math.random() * 0.4)); } else this.flash.intensity = 0;
    const T = this.tr; let any = false;
    for (let i = 0; i < T.n; i++) { if (T.life[i] > 0) { T.life[i] -= dt; any = true; if (T.life[i] <= 0) T.pos.fill(0, i * 6, i * 6 + 6); } }
    if (any || this.trWas) this.tracers.geometry.attributes.position.needsUpdate = true; this.trWas = any;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]; d.t += dt;
      if (d.m.position.y > 0.03) { d.v.y -= 9.8 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += d.w.x * dt; d.m.rotation.z += d.w.z * dt; if (d.m.position.y < 0.03) { d.m.position.y = 0.03; d.v.set(0, 0, 0); } }
      if (d.t > 40) { d.m.removeFromParent(); d.m.geometry.dispose(); this.debris.splice(i, 1); }
    }
  }
}
