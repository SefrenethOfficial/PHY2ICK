// PHY2ICK: the test area.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { buildWorld } from './world.js';
import { buildApartment } from './apartment.js';
import { Player } from './player.js';
import { Car } from './car.js';
import { Citizens } from './citizens.js';
import { Wheel } from './wheel.js';
import { Hud } from './hud.js';
import { CameraRig } from './camera.js';
import { Props } from './props.js';
import { Weapons } from './weapons.js';
import { Blood } from './blood.js';
import { bakeStatic } from './bake.js';
import { ParkedCars } from './parked.js';
import './style.css';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

class Game {
  async init() {
    await RAPIER.init();
    this.R = RAPIER;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.res = 1; r.setPixelRatio(Math.min(devicePixelRatio, 1)); r.setSize(innerWidth, innerHeight); // (one setting: fast. The resolution drops a little by itself if frames run slow)
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.62;
    document.getElementById('app').appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 2500);
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.keys = new Set();
    this.money = 500;
    this.timeScale = 1;
    this.waypoint = null;

    this.hud = new Hud(this);
    this.props = new Props(this);
    this.weapons = new Weapons(this);
    this.blood = new Blood(this);
    const T0 = performance.now();
    this.map = buildWorld(this);
    this.loadTimes = { world: performance.now() - T0 };
    this.apt = buildApartment(this);
    this.city.finish();
    for (const o of [this.fountainWater, this.sky]) if (o) o.userData.dynamic = true;
    for (const c of this.cones || []) c.m.userData.dynamic = true;
    for (const s of this.weapons.slots) s.model.userData.dynamic = true;
    this.loadTimes.beforeBake = performance.now() - T0;
    this.baked = bakeStatic(this.scene);
    this.loadTimes.bake = performance.now() - T0;
    this.cam = new CameraRig(this);
    this.wheel = new Wheel(this);
    this.player = new Player(this, this.apt.spawn);
    this.player.yaw = this.apt.spawnYaw; this.cam.yaw = this.apt.spawnYaw + Math.PI; this.cam.pitch = 0.18;
    // cars: the police station's, and some in the car parks
    const paints = [0x9b1c1c, 0x1f4f8a, 0x2b2d30, 0xd8d6d0, 0x3f6b3f, 0x8a6a2a, 0x5a5f66, 0x6a2a5a];
    const spots = this.map.parked.filter(p => p[4] === 'police'); // (only these are real cars from the start; the rest are parked copies until you take one)
    this.cars = spots.map((p, i) => new Car(this, V(p[0], 0.03, p[1]), p[2], p[3] ?? paints[i % paints.length]));
    { // one right outside your front door
      const d = this.apt.door; this.cars.push(new Car(this, V(d.x + 8, 0.03, d.z + 6.2), Math.PI / 2, 0x9b1c1c));
    }
    const lotCars = this.map.parked.filter(p => p[4] !== 'police').sort(() => Math.random() - 0.5).slice(0, 30);
    this.parkedCars = new ParkedCars(this, lotCars.concat(this.map.kerbside.sort(() => Math.random() - 0.5).slice(0, 70)));
    this.citizens = new Citizens(this, this.map, 40);
    for (const w of this.workers || []) this.citizens.addWorker(w);
    // two lights that follow you indoors (cheaper than a light in every room)
    this.roomLights = [0, 1].map(() => { const l = new THREE.PointLight(0xffe6c4, 0, 16, 1.5); this.scene.add(l); return l; });
    this.loadTimes.all = performance.now() - T0;
    this.wpBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
    this.wpBeam.visible = false; this.scene.add(this.wpBeam);

    this.bindInput();
    addEventListener('resize', () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); r.setSize(innerWidth, innerHeight); });
    this.clock = new THREE.Clock();
    this.started = false;
    r.setAnimationLoop(() => this.tick());
    document.getElementById('splash').classList.add('ready');
    window.game = this;
  }

  bindInput() {
    const canvas = this.renderer.domElement, splash = document.getElementById('splash');
    const lock = () => { canvas.requestPointerLock?.(); };
    splash.addEventListener('click', () => { if (!splash.classList.contains('ready')) return; lock(); this.started = true; splash.classList.add('playing'); });
    canvas.addEventListener('click', () => { if (!document.pointerLockElement) lock(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      splash.style.display = this.locked ? 'none' : 'flex';
      if (!this.locked) { this.keys.clear(); if (this.wheel.open) this.wheel.close(); }
    });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (this.wheel.open) { if (e.button === 0) this.wheel.choose(); return; }
      const pl = this.player;
      if (pl.car || pl.ragdoll) return;
      if (e.button === 0) { if (this.weapons.held && !this.props.held) this.weapons.attack(); else this.props.click(); }
      if (e.button === 2 && this.props.held) this.props.drop(true);
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      if (this.wheel.open) this.wheel.mouse(e.movementX, e.movementY);
      else this.cam.mouse(e.movementX, e.movementY);
    });
    addEventListener('keydown', (e) => {
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (!this.locked) return;
      const pl = this.player;
      if (this.wheel.open) {
        if (/^Digit[1-6]$/.test(e.code)) this.wheel.choose(+e.code.slice(5) - 1);
        if (e.code === 'Escape' || e.code === 'KeyQ') this.wheel.close();
        return;
      }
      if (e.code === 'KeyE') {
        const slot = this.weapons.candidate();
        if (slot) this.weapons.take(slot);
        else { const n = this.wheel.candidate(); if (n) this.wheel.show(n); }
      }
      if (e.code === 'KeyX') { if (this.props.held) this.props.drop(false); else if (this.weapons.held) this.weapons.putAway(); }
      if (e.code === 'Space' && !pl.car) pl.jumpQ = true;
      if (e.code === 'KeyF') this.toggleCar();
      if (e.code === 'KeyC' && pl.car) this.cam.mode = this.cam.mode === 'chase' ? 'cockpit' : 'chase';
      if (e.code === 'KeyR' && pl.car) this.resetCar(pl.car);
      if (e.code === 'KeyH') this.hud.helpEl.classList.toggle('hide');
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyE' && this.wheel.open && this.wheel.sel >= 0) this.wheel.choose();
    });
  }

  nearestCar() {
    const p = this.player.pos; let best = null, bd = 3.6;
    for (const c of this.cars) { const d = c.pos.distanceTo(p.clone().add(V(0, 0.8, 0))); if (d < bd && !c.driver) { bd = d; best = c; } }
    return best;
  }

  toggleCar() {
    const pl = this.player;
    if (pl.ragdoll) return;
    if (pl.car) {
      if (Math.abs(pl.car.speed) > 3) { this.hud.toast('Slow down to get out'); return; }
      const car = pl.car;
      pl.exitCar();
      if (car.passenger) this.citizens.unboard(car.passenger, car);
      this.cam.lookYaw = this.cam.lookPitch = 0;
      this.cam.yaw = car.yaw + Math.PI * 0.75; this.cam.pitch = 0.22; this.cam.smoothTarget = null; // (the camera swings out to your side, clear of the car)
      return;
    }
    let c = this.nearestCar();
    if (!c) { const pc = this.parkedCars.nearest(pl.pos); if (pc) c = this.parkedCars.take(pc); }
    if (c) { if (this.props.held) this.props.drop(false); pl.enterCar(c); }
  }

  resetCar(car) { // back on its wheels
    const t = car.body.translation(), f = car.forward;
    const yaw = Math.atan2(f.x, f.z), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
    car.body.setTranslation({ x: t.x, y: t.y + 1.2, z: t.z }, true);
    car.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    car.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  // which room (if any) a point is in
  roomAt(p) {
    for (const r of this.rooms || []) { if (p.y < r.y0 || p.y > r.y1) continue; const ring = r.ring; let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > p.z) !== (zj > p.z) && p.x < ((xj - xi) * (p.z - zi)) / (zj - zi) + xi) c = !c; } if (c) return r; }
    return null;
  }

  // the water level here, if there's water here (the sea, or a pool)
  waterAt(x, z) {
    for (const pool of this.pools || []) { const ring = pool.ring; let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } if (c) return pool.level; }
    return this.map.inLand(x, z) ? null : this.waterLevel;
  }

  setWaypoint(place) { this.waypoint = place; this.wpBeam.position.copy(place.pos).setY(30); this.wpBeam.visible = true; this.hud.toast('Waypoint: ' + place.name, '#ffd23f'); }
  clearWaypoint(arrived) { if (arrived && this.waypoint) this.hud.toast('You\'ve arrived at ' + this.waypoint.name, '#ffd23f'); this.waypoint = null; this.wpBeam.visible = false; }

  // cars hitting people (cars pass through standing people in the physics; this decides what happens)
  checkHits() {
    const peds = [];
    const pl = this.player;
    if (!pl.car && !pl.ragdoll && !pl.dead) peds.push({ p: pl.pos, hit: (d, f) => (f > 2.5 ? pl.knockDown(d, f) : (pl.knock = d.clone().setY(0).normalize().multiplyScalar(2.5))) });
    for (const n of this.citizens.list) if (!['seated', 'dead'].includes(n.state) && !n.human.ragdoll) peds.push({ p: this.citizens.pos(n), hit: (d, f) => (f > 2.5 ? this.citizens.hitByCar(n, d, f) : null) });
    for (const car of this.cars) {
      const v = car.body.linvel(), sp = Math.hypot(v.x, v.z);
      if (sp < 0.4) continue;
      for (const ped of peds) {
        const loc = car.group.worldToLocal(ped.p.clone().add(V(0, 0.9, 0)));
        if (Math.abs(loc.x) < 1.15 && Math.abs(loc.z) < 2.55 && Math.abs(loc.y) < 1.6) {
          const side = V(Math.sign(loc.x) || 1, 0, 0).applyQuaternion(car.group.quaternion);
          const dir = V(v.x, 0, v.z).normalize().multiplyScalar(0.8).add(side.multiplyScalar(0.35));
          ped.hit(dir, sp);
          if (sp > 2.5) car.body.applyImpulse({ x: -v.x * 35, y: 0, z: -v.z * 35 }, true);
        }
      }
    }
  }

  tick() {
    const rdt = Math.min(this.clock.getDelta(), 0.1);
    const dt = rdt * this.timeScale;
    const steps = Math.max(1, Math.ceil(dt / (1 / 60) - 0.01)), h = dt / steps;
    if (dt > 0) this.citizens.physics(dt); // (people think once a frame, not every physics step)
    if (dt > 0) for (let i = 0; i < steps; i++) {
      this.player.physics(h);
      this.props.physics(h);
      for (const c of this.cars) c.physics(h);
      this.world.timestep = h;
      this.world.step();
    }
    for (const c of this.cars) c.frame(dt);
    for (const c of this.cones || []) { const t = c.body.translation(), q = c.body.rotation(); c.m.position.set(t.x, t.y - 0.3, t.z); c.m.quaternion.set(q.x, q.y, q.z, q.w); }
    this.props.frame(dt);
    this.checkHits();
    this.weapons.update(dt);
    this.player.frame(dt);
    this.citizens.frame(dt);
    this.blood.update(dt);
    this.cam.update(rdt);
    // the prompt
    const pl = this.player;
    let prompt = '';
    if (this.wheel.open) prompt = 'Move the mouse to pick · release <kbd>E</kbd> (or click, or <kbd>1</kbd>–<kbd>6</kbd>) · <kbd>Q</kbd> cancel';
    else if (pl.car) prompt = `<kbd>F</kbd> get out · <kbd>C</kbd> ${this.cam.mode === 'chase' ? 'inside view' : 'chase camera'} · <kbd>Space</kbd> handbrake`;
    else if (!pl.ragdoll) {
      const slot = this.weapons.candidate(), n = !slot && this.wheel.candidate(), c = this.nearestCar() || this.parkedCars.nearest(pl.pos);
      if (this.props.held) prompt = `Carrying ${this.props.held.name} · <kbd>Click</kbd> drop · <kbd>Right-click</kbd> throw`;
      else if (slot) prompt = slot.taken ? `<kbd>E</kbd> put the ${this.weapons.held.name} back` : `<kbd>E</kbd> take the ${{ hatchet: 'Hatchet', butter: 'Butter Knife', kiddie: 'Plastic Kiddie Knife' }[slot.id]}`;
      else if (n) prompt = `Hold <kbd>E</kbd> interact with ${n.mem.met ? n.name : 'this person'}`;
      else if (c) prompt = '<kbd>F</kbd> get in the car';
      else { const p = this.weapons.held ? null : this.props.aimed(); if (p) prompt = `<kbd>Click</kbd> pick up ${p.name}`; else if (this.weapons.held) prompt = `<kbd>Click</kbd> swing the ${this.weapons.held.name} · <kbd>X</kbd> put it away`; }
    }
    this.hud.prompt(this.started ? prompt : '');
    document.getElementById('crosshair').style.display = !pl.car && this.locked ? 'block' : 'none';
    // the sun's shadows follow you
    const focus = pl.car ? pl.car.pos : pl.pos;
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 160); this.sun.target.position.copy(focus); this.sun.target.updateMatrixWorld();
    // indoors, the sky's light is mostly kept out: the room's own lights do the work
    const room = this.roomAt(pl.car ? pl.car.pos : pl.pos.add(V(0, 1, 0)));
    for (let i = 0; i < 2; i++) { const L = this.roomLights[i], pt = room?.lights[i] || room?.lights[0]; L.intensity = room && pt ? (room.power ?? 18) * (room.kind === 'club' ? 0.7 + 0.3 * Math.sin(performance.now() / 160 + i * 2) : 1) : 0; if (pt) { L.position.copy(pt); L.color.set(room.kind === 'club' ? [0xff4fd8, 0x4fd8ff][i] : room.tint); } }
    for (const a of this.animators || []) a(performance.now() / 1000);
    const inside = !!room;
    const envT = inside ? 0.3 : 0.75;
    this.scene.environmentIntensity += (envT - this.scene.environmentIntensity) * Math.min(1, rdt * 3);
    if (this.water) this.water.update(rdt, this.camera);
    if (this.fountainWater) this.fountainWater.position.y = 0.45 + Math.sin(performance.now() / 600) * 0.01;
    this.hud.frame(rdt);
    if (pl.car && this.cam.mode === 'cockpit') pl.car.renderMirror(this.renderer, this.scene);
    this.renderer.render(this.scene, this.camera);
    // keep it smooth: if frames run long, draw at a slightly lower resolution (and back up when there's room)
    this.ft = (this.ft ?? 16) * 0.95 + rdt * 1000 * 0.05; this.resT = (this.resT || 0) + rdt;
    if (this.resT > 1.5) { const nr = this.ft > 24 ? Math.max(0.6, this.res - 0.1) : this.ft < 15 ? Math.min(1, this.res + 0.1) : this.res; this.resT = 0;
      if (nr !== this.res) { this.res = nr; this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1) * nr); this.renderer.setSize(innerWidth, innerHeight); } }
  }
}

new Game().init();
