// A car: Rapier's raycast vehicle (suspension, tyre grip and slip), a modelled body with a real cabin
// (seats, dashboard, working gauges, a steering wheel that turns, a rear-view mirror that works).
import * as THREE from 'three';
import { G_WORLD, G_CAR, G_PED, groups } from './world.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const GY = -0.71; // where the ground is in the car's own frame, at rest

// a flat quad through four points (for glass)
function quad(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.computeVertexNormals(); return g;
}
// a thin beam from p to q
function beam(p, q, w, d, mat) {
  const a = V(...p), b = V(...q), len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = true; return m;
}
function extrudeSide(points, depth, mat, bevel = 0.06) {
  const s = new THREE.Shape(); points.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
  g.rotateY(-Math.PI / 2); g.translate(depth / 2, 0, 0); // shape x → car z; extrusion → car x, centred
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
}
const arch = (c, r, yc, n = 10) => { const out = []; for (let i = 0; i <= n; i++) { const a = Math.PI - (i / n) * Math.PI; out.push([c + r * Math.cos(a), yc + r * Math.sin(a)]); } return out; };

export class Car {
  constructor(g, pos, yaw = 0, color = 0x9b1c1c, name = 'Sedan') {
    this.g = g; this.name = name;
    const { world, R } = g;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
    this.body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y - GY + 0.05, pos.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setLinearDamping(0.02).setAngularDamping(0.35).setCanSleep(false));
    const solver = groups(G_CAR, G_WORLD | G_CAR); // (cars don't shove people physically; hits are handled by hand)
    this.col = world.createCollider(R.ColliderDesc.cuboid(0.88, 0.27, 2.25).setTranslation(0, 0.04, 0)
      .setMassProperties(1350, { x: 0, y: -0.32, z: 0.05 }, { x: 2700, y: 3000, z: 760 }, { x: 0, y: 0, z: 0, w: 1 })
      .setFriction(0.5).setRestitution(0.1).setSolverGroups(solver), this.body);
    this.roofCol = world.createCollider(R.ColliderDesc.cuboid(0.72, 0.26, 0.85).setTranslation(0, 0.56, -0.4).setDensity(0).setSolverGroups(solver), this.body);

    // the raycast vehicle
    const vc = this.vc = world.createVehicleController(this.body);
    vc.indexUpAxis = 1; vc.setIndexForwardAxis = 2;
    this.wheelPos = [[0.8, 1.36], [-0.8, 1.36], [0.8, -1.34], [-0.8, -1.34]]; // FL, FR, RL, RR (x is the car's left)
    for (const [x, z] of this.wheelPos) {
      vc.addWheel({ x, y: -0.12, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, 0.32, 0.34); // (forward = up × axle = +Z)
    }
    for (let i = 0; i < 4; i++) {
      vc.setWheelSuspensionStiffness(i, 32);
      vc.setWheelSuspensionCompression(i, 3.0);
      vc.setWheelSuspensionRelaxation(i, 4.4);
      vc.setWheelMaxSuspensionTravel(i, 0.26);
      vc.setWheelMaxSuspensionForce(i, 60000);
      vc.setWheelFrictionSlip(i, i < 2 ? 1.8 : 2.0); // (a touch more grip at the back: stable, not twitchy)
      vc.setWheelSideFrictionStiffness(i, 1.0);
    }
    this.steer = 0; this.maxSteer = 0.55;
    this.throttle = 0; this.braking = false; this.handbrake = false;
    this.driver = null; this.passenger = null;
    this.gear = 1; this.rpm = 900;

    this.build(color);
    g.scene.add(this.group);
  }

  build(color) {
    const grp = this.group = new THREE.Group();
    const shell = this.shell = new THREE.Group(); shell.position.y = GY; grp.add(shell); // shell coords: y = height above the ground
    const paint = this.paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.6, metalness: 0.2 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.15, metalness: 1 });
    const inner = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.9 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x3b2d24, roughness: 0.7 });
    const glass = this.glassMat = new THREE.MeshPhysicalMaterial({ color: 0x1d2a34, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
    const add = (m, parent = shell) => { parent.add(m); return m; };

    // lower body: a tub (the cabin's open on top) plus door panels
    const front = arch(1.36, 0.43, 0.34), rear = arch(-1.34, 0.43, 0.34);
    const tub = [[2.22, 0.3], [2.32, 0.44], [2.3, 0.64], [2.12, 0.77], [1.5, 0.84], [0.95, 0.9], [0.9, 0.42], [-0.86, 0.42], [-0.86, 0.8], [-1.72, 0.8], [-1.78, 0.93], [-2.16, 0.9], [-2.32, 0.76], [-2.3, 0.42], [-2.16, 0.3],
      ...rear, ...front, [2.1, 0.3]];
    add(extrudeSide(tub, 1.68, paint));
    for (const s of [-1, 1]) {
      const door = extrudeSide([[0.95, 0.4], [0.95, 0.92], [-1.76, 0.93], [-1.76, 0.78], [-0.86, 0.78], [-0.86, 0.4]], 0.07, paint, 0.012);
      door.position.x = s * 0.865; add(door);
      // door cards and armrests, inside
      add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 1.7), inner)).position.set(s * 0.81, 0.68, -0.38);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.5), leather)).position.set(s * 0.77, 0.72, -0.2);
      // door seams and handles, outside
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.5, 0.01), trim); seam.position.set(s * 0.906, 0.66, -0.86); add(seam);
      const seam2 = seam.clone(); seam2.position.z = 0.93; add(seam2);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.18), chrome); handle.position.set(s * 0.91, 0.84, -0.6); add(handle);
      // side mirrors
      const sm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.08), paint); sm.position.set(s * 0.98, 0.98, 0.86); add(sm);
      const smg = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.08), chrome); smg.position.set(s * 0.98, 0.98, 0.815); smg.rotation.y = Math.PI; add(smg);
    }
    // the greenhouse: pillars, roof, glass
    const RY = 1.46, BZ = 0.95, TZ = 0.08, RZ = -1.16, CZ = -1.76;
    for (const s of [-1, 1]) {
      add(beam([s * 0.8, 0.9, BZ], [s * 0.71, RY, TZ], 0.07, 0.07, trim));
      add(beam([s * 0.82, 0.93, CZ + 0.08], [s * 0.72, RY, RZ], 0.08, 0.2, paint));
      add(beam([s * 0.8, 0.92, -0.86], [s * 0.725, RY, -0.86], 0.05, 0.08, trim));
      add(new THREE.Mesh(quad([s * 0.83, 0.92, BZ - 0.03], [s * 0.715, RY - 0.03, TZ], [s * 0.725, RY - 0.03, RZ], [s * 0.835, 0.92, CZ + 0.05]), glass));
    }
    add(new THREE.Mesh(quad([-0.8, 0.9, BZ], [0.8, 0.9, BZ], [0.7, RY, TZ], [-0.7, RY, TZ]), glass));
    add(new THREE.Mesh(quad([0.8, 0.93, CZ], [-0.8, 0.93, CZ], [-0.7, RY, RZ], [0.7, RY, RZ]), glass));
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, TZ - RZ + 0.12), paint); roof.position.set(0, RY + 0.015, (TZ + RZ) / 2); roof.castShadow = true; add(roof);
    const liner = new THREE.Mesh(new THREE.PlaneGeometry(1.42, TZ - RZ), new THREE.MeshStandardMaterial({ color: 0x8c877e, roughness: 1, side: THREE.DoubleSide }));
    liner.rotation.x = Math.PI / 2; liner.position.set(0, RY - 0.02, (TZ + RZ) / 2); add(liner);

    // lights, grille, bumpers, plates
    const headM = this.headM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dc, emissiveIntensity: 0.5, roughness: 0.1 });
    const tailM = this.tailM = new THREE.MeshStandardMaterial({ color: 0x6a0808, emissive: 0xff1a10, emissiveIntensity: 0.3, roughness: 0.3 });
    const revM = this.revM = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.3 });
    for (const s of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.06), headM); hl.position.set(s * 0.58, 0.68, 2.33); hl.rotation.x = -0.25; add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.13, 0.05), tailM); tl.position.set(s * 0.56, 0.74, -2.35); add(tl);
      const rv = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.05), revM); rv.position.set(s * 0.25, 0.74, -2.35); add(rv);
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.05), trim)).position.set(0, 0.55, 2.37);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.12, 0.16), trim)).position.set(0, 0.36, 2.32);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.12, 0.16), trim)).position.set(0, 0.38, -2.33);
    const plateT = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = 128; c.height = 40; const x = c.getContext('2d'); x.fillStyle = '#f4f2ea'; x.fillRect(0, 0, 128, 40); x.strokeStyle = '#223'; x.lineWidth = 3; x.strokeRect(2, 2, 124, 36); x.fillStyle = '#1b2a55'; x.font = 'bold 24px monospace'; x.textAlign = 'center'; x.fillText('PHY 2ICK', 64, 29); return c; })());
    plateT.colorSpace = THREE.SRGBColorSpace;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), new THREE.MeshStandardMaterial({ map: plateT })); plate.position.set(0, 0.52, -2.36); plate.rotation.y = Math.PI; add(plate);

    // the cabin: seats, dashboard, console, steering wheel, gauges, mirror
    for (const s of [-1, 1]) {
      const seat = new THREE.Group(); seat.position.set(s * 0.37, 0.4, -0.22); add(seat);
      const cush = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.52), leather); cush.position.y = 0.06; seat.add(cush);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.12), leather); back.position.set(0, 0.38, -0.27); back.rotation.x = -0.2; seat.add(back);
      const rest = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.1), leather); rest.position.set(0, 0.78, -0.36); rest.rotation.x = -0.2; seat.add(rest);
    }
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.55), leather); bench.position.set(0, 0.86, -1.32); add(bench);
    const benchB = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.48, 0.12), leather); benchB.position.set(0, 1.12, -1.62); benchB.rotation.x = -0.2; add(benchB);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.9), inner)).position.set(0, 0.52, 0.2);
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.22, 0.42), inner); dash.position.set(0, 0.8, 0.76); add(dash);
    const dashTop = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.04, 0.3), new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: 1 })); dashTop.position.set(0, 0.92, 0.82); dashTop.rotation.x = -0.12; add(dashTop);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.14), inner); hood.position.set(0.37, 0.98, 0.62); add(hood);
    // gauges (a canvas, redrawn as the needles move)
    this.gc = document.createElement('canvas'); this.gc.width = 256; this.gc.height = 96;
    this.gaugeT = new THREE.CanvasTexture(this.gc); this.gaugeT.colorSpace = THREE.SRGBColorSpace;
    const gauge = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.135), new THREE.MeshStandardMaterial({ map: this.gaugeT, emissive: 0xffffff, emissiveMap: this.gaugeT, emissiveIntensity: 0.7 }));
    gauge.position.set(0.37, 0.915, 0.555); gauge.rotation.set(-0.25, Math.PI, 0); add(gauge);
    this.drawGauges(0, 0);
    // centre screen: the radio
    const radioC = document.createElement('canvas'); radioC.width = 128; radioC.height = 64; const rx = radioC.getContext('2d');
    rx.fillStyle = '#0b1420'; rx.fillRect(0, 0, 128, 64); rx.fillStyle = '#5fd0ff'; rx.font = 'bold 15px monospace'; rx.fillText('HALYARD FM', 14, 26); rx.fillStyle = '#8aa'; rx.font = '12px monospace'; rx.fillText('98.4  ♪ —', 30, 48);
    const radioT = new THREE.CanvasTexture(radioC); radioT.colorSpace = THREE.SRGBColorSpace;
    const radio = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshStandardMaterial({ map: radioT, emissive: 0xffffff, emissiveMap: radioT, emissiveIntensity: 0.6 }));
    radio.position.set(0, 0.8, 0.548); radio.rotation.set(-0.2, Math.PI, 0); add(radio);
    // steering wheel (turns with the front wheels)
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.32, 8), inner); col.position.set(0.37, 0.86, 0.56); col.rotation.x = -1.1; add(col);
    const sw = this.wheelGrp = new THREE.Group(); sw.position.set(0.37, 0.9, 0.36); sw.rotation.x = 0.42; add(sw);
    const spin = this.wheelSpin = new THREE.Group(); sw.add(spin);
    spin.add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 10, 32), leather));
    for (const a of [0, Math.PI * 0.8, -Math.PI * 0.8]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.012), inner); sp.position.set(Math.sin(a) * 0.085, -Math.cos(a) * 0.085, 0); sp.rotation.z = a; spin.add(sp); }
    spin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), inner).rotateX(Math.PI / 2));
    // rear-view mirror (a second camera renders into it while you're in the driver's seat)
    this.mirrorRT = new THREE.WebGLRenderTarget(256, 96);
    const mt = this.mirrorRT.texture; mt.colorSpace = THREE.SRGBColorSpace; mt.wrapS = THREE.RepeatWrapping; mt.repeat.x = -1; mt.offset.x = 1;
    const mirrorBox = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.065, 0.03), trim); mirrorBox.position.set(0, RY - 0.1, 0.3); add(mirrorBox);
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.052), new THREE.MeshBasicMaterial({ map: mt })); mirror.position.set(0, RY - 0.1, 0.283); mirror.rotation.y = Math.PI; add(mirror);
    this.mirrorCam = new THREE.PerspectiveCamera(32, 256 / 96, 0.2, 400);

    // wheels
    const tyre = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
    const rimM = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.25, metalness: 0.9 });
    this.wheels = this.wheelPos.map(([x]) => {
      const w = new THREE.Group(); grp.add(w);
      const sp = new THREE.Group(); w.add(sp);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 28), tyre); t.rotation.z = Math.PI / 2; t.castShadow = true; sp.add(t);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 20), rimM); r.rotation.z = Math.PI / 2; sp.add(r);
      for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 0.05), rimM); s.position.x = Math.sign(x) * 0.13; s.rotation.x = (i / 5) * Math.PI; sp.add(s); }
      return { g: w, spin: sp };
    });
  }

  drawGauges(kmh, rpm) {
    const c = this.gc.getContext('2d'), W = 256, H = 96;
    c.fillStyle = '#07090c'; c.fillRect(0, 0, W, H);
    const dial = (cx, val, max, label, red) => {
      c.strokeStyle = '#3a4048'; c.lineWidth = 3; c.beginPath(); c.arc(cx, 52, 38, Math.PI * 0.75, Math.PI * 2.25); c.stroke();
      for (let i = 0; i <= 10; i++) { const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5; c.strokeStyle = red && i >= 8 ? '#ff4a3a' : '#cfd6de'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx + Math.cos(a) * 30, 52 + Math.sin(a) * 30); c.lineTo(cx + Math.cos(a) * 37, 52 + Math.sin(a) * 37); c.stroke(); }
      const a = Math.PI * 0.75 + Math.min(val / max, 1.02) * Math.PI * 1.5;
      c.strokeStyle = '#ff7a1a'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, 52); c.lineTo(cx + Math.cos(a) * 34, 52 + Math.sin(a) * 34); c.stroke();
      c.fillStyle = '#8b96a2'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText(label, cx, 80);
    };
    dial(58, kmh, 240, 'km/h'); dial(198, rpm, 8000, 'x1000 rpm', true);
    c.fillStyle = '#e9eef3'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText(String(Math.round(kmh)), 128, 50);
    c.fillStyle = '#7be08a'; c.font = 'bold 14px sans-serif'; c.fillText(this.speed < -0.5 ? 'R' : String(this.gear), 128, 72);
    this.gaugeT.needsUpdate = true;
  }

  get pos() { return this.group.position; }
  get forward() { return V(0, 0, 1).applyQuaternion(this.group.quaternion); }
  get yaw() { const f = this.forward; return Math.atan2(f.x, f.z); }
  get speed() { return this.vc.currentVehicleSpeed(); } // m/s, + forwards

  // a point beside the door, on the ground
  doorPoint(seat = 'driver', out = 1) {
    const x = (seat === 'driver' ? 1 : -1) * (0.95 + out);
    return V(x, GY + 0.05, -0.3).applyMatrix4(this.group.matrixWorld);
  }
  seatPerson(h, seat) {
    this.shell.add(h.root);
    h.root.position.set(seat === 'driver' ? 0.37 : -0.37, 0.49 - 0.95 * h.rig.scale.y, -0.2);
    h.root.rotation.set(0, 0, 0);
    if (seat === 'passenger') this.passengerH = h;
  }
  unseat(h) { h.root.removeFromParent(); if (this.passengerH === h) this.passengerH = null; }
  eyePoint() {
    const h = this.driver?.human; if (!h) return this.group.position.clone();
    const p = new THREE.Vector3(); h.b.head.getWorldPosition(p);
    return p.add(V(0, 0.115, 0.1).applyQuaternion(this.group.quaternion));
  }

  physics(h) {
    const g = this.g, k = g.keys, vc = this.vc;
    const drive = this.driver && !g.wheel.open;
    const spd = this.speed;
    let throttle = 0, brake = 0, steerIn = 0;
    this.handbrake = false;
    if (drive) {
      const fwd = k.has('KeyW') || k.has('ArrowUp'), back = k.has('KeyS') || k.has('ArrowDown');
      if (fwd) { if (spd < -1) brake = 1; else throttle = 1; }
      if (back) { if (spd > 1) brake = 1; else throttle = -0.6; }
      steerIn = (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) - (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0);
      this.handbrake = k.has('Space');
    } else brake = 0.25; // (parked: the brake's on)
    // steering: quicker to centre than to turn, and less lock at speed
    const lock = this.maxSteer / (1 + Math.abs(spd) * 0.045);
    const target = steerIn * lock;
    const rate = (Math.sign(target) !== Math.sign(this.steer) || target === 0 ? 4.2 : 2.4) * h;
    this.steer += THREE.MathUtils.clamp(target - this.steer, -rate, rate);
    vc.setWheelSteering(0, this.steer); vc.setWheelSteering(1, this.steer);
    // engine: rear-wheel drive, power falls away toward top speed
    const top = throttle > 0 ? 58 : 8;
    const fall = Math.max(0, 1 - Math.abs(spd) / top);
    const force = throttle * 5000 * (throttle > 0 ? 0.3 + 0.7 * fall : fall);
    vc.setWheelEngineForce(2, force); vc.setWheelEngineForce(3, force);
    for (let i = 0; i < 4; i++) vc.setWheelBrake(i, brake * (i < 2 ? 15 : 7)); // (front-biased, so it stops straight)
    if (this.handbrake) { vc.setWheelBrake(2, 40); vc.setWheelBrake(3, 40); }
    vc.setWheelFrictionSlip(2, this.handbrake ? 0.75 : 2.0); vc.setWheelFrictionSlip(3, this.handbrake ? 0.75 : 2.0);
    this.throttle = throttle; this.braking = brake > 0.5;
    // a little downforce, so it sits flat at speed
    this.body.resetForces(false); // (forces persist between steps: set it fresh each time)
    this.body.addForce(V(0, -1, 0).applyQuaternion(this.group.quaternion).multiplyScalar(spd * spd * 2.4), true);
    vc.updateVehicle(h);
  }

  frame(dt) {
    const t = this.body.translation(), r = this.body.rotation();
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);
    this.group.updateMatrixWorld();
    const vc = this.vc;
    for (let i = 0; i < 4; i++) {
      const [x, z] = this.wheelPos[i], w = this.wheels[i];
      const sl = vc.wheelSuspensionLength(i) ?? 0.32;
      w.g.position.set(x, -0.12 - sl, z);
      w.g.rotation.y = vc.wheelSteering(i) ?? 0;
      w.spin.rotation.x = vc.wheelRotation(i) ?? 0;
    }
    this.wheelSpin.rotation.z = -this.steer * 6.5; // (about 2.5 turns lock to lock)
    // a pretend gearbox for the gauges
    const kmh = Math.abs(this.speed) * 3.6;
    const bands = [0, 30, 60, 95, 135, 180];
    let gear = 1; for (let i = 1; i < bands.length; i++) if (kmh > bands[i]) gear = i + 1;
    this.gear = Math.min(gear, 6);
    const lo = bands[this.gear - 1], hi = bands[this.gear] ?? 260;
    const want = this.driver ? 900 + ((kmh - lo) / (hi - lo)) * 5200 + Math.abs(this.throttle) * 900 + (this.gear === 1 ? kmh * 30 : 1200) : 0;
    this.rpm += (want - this.rpm) * Math.min(1, dt * 6);
    if (this.driver && (Math.abs(kmh - (this.lastKmh ?? -9)) > 0.6 || Math.abs(this.rpm - (this.lastRpm ?? -999)) > 60)) { this.drawGauges(kmh, this.rpm); this.lastKmh = kmh; this.lastRpm = this.rpm; }
    this.tailM.emissiveIntensity = this.braking || this.handbrake ? 2.4 : this.driver ? 0.6 : 0.15;
    this.revM.emissiveIntensity = this.driver && this.speed < -0.3 ? 1.8 : 0;
    this.headM.emissiveIntensity = this.driver ? 1.2 : 0.3;
  }

  renderMirror(renderer, scene) {
    const m = this.mirrorCam;
    const p = V(0, GY + 1.34, 0.1).applyMatrix4(this.group.matrixWorld);
    m.position.copy(p);
    m.quaternion.copy(this.group.quaternion); // (a camera looks down -Z: the back of the car)
    m.rotateX(0.03); // (aim through the rear window)
    const vis = this.driver?.human.root.visible;
    if (this.driver) this.driver.human.root.visible = false;
    renderer.setRenderTarget(this.mirrorRT); renderer.render(scene, m); renderer.setRenderTarget(null);
    if (this.driver) this.driver.human.root.visible = vis;
  }
}
