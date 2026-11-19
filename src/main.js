// PHY2ICK: the test area.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Car } from './car.js';
import { Citizens } from './citizens.js';
import { Wheel } from './wheel.js';
import { Hud } from './hud.js';
import { CameraRig } from './camera.js';
import './style.css';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

class Game {
  async init() {
    await RAPIER.init();
    this.R = RAPIER;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(innerWidth, innerHeight);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95;
    document.getElementById('app').appendChild(r.domElement);
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 2000);
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.keys = new Set();
    this.money = 500;
    this.timeScale = 1;
    this.waypoint = null;

    this.hud = new Hud(this);
    this.map = buildWorld(this);
    this.cam = new CameraRig(this);
    this.wheel = new Wheel(this);
    this.player = new Player(this, V(-4, 0.2, 14));
    this.cars = [
      new Car(this, V(-67.6, 0.02, 30), Math.PI, 0x9b1c1c),
      new Car(this, V(-67.6, 0.02, 20), Math.PI, 0x1f4f8a),
      new Car(this, V(150, 0.02, -3), Math.PI / 2, 0xd8d6d0),
    ];
    this.citizens = new Citizens(this, this.map, 16);
    this.wpBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
    this.wpBeam.visible = false; this.scene.add(this.wpBeam);

    this.bindInput();
    addEventListener('resize', () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); r.setSize(innerWidth, innerHeight); });
    this.clock = new THREE.Clock();
    this.started = false;
    r.setAnimationLoop(() => this.tick());
    window.game = this;
  }

  bindInput() {
    const canvas = this.renderer.domElement, splash = document.getElementById('splash');
    const lock = () => { canvas.requestPointerLock?.(); };
    splash.addEventListener('click', () => { lock(); this.started = true; splash.classList.add('playing'); });
    canvas.addEventListener('click', () => { if (!document.pointerLockElement) lock(); else if (this.wheel.open) this.wheel.choose(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      splash.style.display = this.locked ? 'none' : 'flex';
      if (!this.locked) { this.keys.clear(); if (this.wheel.open) this.wheel.close(); }
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
      if (e.code === 'KeyE') { const n = this.wheel.candidate(); if (n) this.wheel.show(n); }
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
    if (pl.car) {
      if (Math.abs(pl.car.speed) > 3) { this.hud.toast('Slow down to get out'); return; }
      const car = pl.car;
      pl.exitCar();
      if (car.passenger) this.citizens.unboard(car.passenger, car);
      this.cam.lookYaw = this.cam.lookPitch = 0;
      this.cam.yaw = car.yaw + Math.PI * 0.75; this.cam.pitch = 0.22; this.cam.smoothTarget = null; // (the camera swings out to your side, clear of the car)
      return;
    }
    const c = this.nearestCar();
    if (c) pl.enterCar(c);
  }

  resetCar(car) { // back on its wheels
    const t = car.body.translation(), f = car.forward;
    const yaw = Math.atan2(f.x, f.z), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
    car.body.setTranslation({ x: t.x, y: t.y + 1.2, z: t.z }, true);
    car.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    car.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  setWaypoint(place) { this.waypoint = place; this.wpBeam.position.copy(place.pos).setY(30); this.wpBeam.visible = true; this.hud.toast('Waypoint: ' + place.name, '#ffd23f'); }
  clearWaypoint(arrived) { if (arrived && this.waypoint) this.hud.toast('You\'ve arrived at ' + this.waypoint.name, '#ffd23f'); this.waypoint = null; this.wpBeam.visible = false; }

  // cars hitting people (cars pass through people in the physics; this decides what happens)
  checkHits() {
    const peds = [];
    if (!this.player.car) peds.push({ p: this.player.pos, hit: (d, f) => (f > 2.5 ? this.player.knockDown(d, f) : (this.player.knock = d.clone().setY(0).normalize().multiplyScalar(2.5))) });
    for (const n of this.citizens.list) if (!['seated', 'down'].includes(n.state)) peds.push({ p: this.citizens.pos(n), hit: (d, f) => (f > 2.5 ? this.citizens.hitByCar(n, d, f) : null) });
    for (const car of this.cars) {
      const v = car.body.linvel(), sp = Math.hypot(v.x, v.z);
      if (sp < 0.4) continue;
      for (const ped of peds) {
        const loc = car.group.worldToLocal(ped.p.clone().add(V(0, 0.9, 0)));
        if (Math.abs(loc.x) < 1.15 && Math.abs(loc.z) < 2.55 && Math.abs(loc.y) < 1.6) {
          const side = V(Math.sign(loc.x) || 1, 0, 0).applyQuaternion(car.group.quaternion);
          const dir = V(v.x, 0, v.z).normalize().multiplyScalar(0.7).add(side.multiplyScalar(0.5));
          ped.hit(dir, sp);
          if (sp > 2.5) car.body.applyImpulse({ x: -v.x * 40, y: 0, z: -v.z * 40 }, true);
        }
      }
    }
  }

  tick() {
    const rdt = Math.min(this.clock.getDelta(), 0.1);
    const dt = rdt * this.timeScale;
    const steps = Math.max(1, Math.ceil(dt / (1 / 60) - 0.01)), h = dt / steps;
    if (dt > 0) for (let i = 0; i < steps; i++) {
      this.player.physics(h);
      this.citizens.physics(h);
      for (const c of this.cars) c.physics(h);
      this.world.timestep = h;
      this.world.step();
    }
    for (const c of this.cars) c.frame(dt);
    for (const c of this.cones || []) { const t = c.body.translation(), q = c.body.rotation(); c.m.position.set(t.x, t.y - 0.3, t.z); c.m.quaternion.set(q.x, q.y, q.z, q.w); }
    this.checkHits();
    this.player.frame(dt);
    this.citizens.frame(dt);
    this.cam.update(rdt);
    // the prompt
    const pl = this.player;
    if (this.wheel.open) this.hud.prompt('Move the mouse to pick · release <kbd>E</kbd> (or click, or <kbd>1</kbd>–<kbd>6</kbd>) · <kbd>Q</kbd> cancel');
    else if (pl.car) this.hud.prompt(this.started ? `<kbd>F</kbd> get out · <kbd>C</kbd> ${this.cam.mode === 'chase' ? 'inside view' : 'chase camera'} · <kbd>Space</kbd> handbrake` : '');
    else {
      const n = this.wheel.candidate(), c = this.nearestCar();
      this.hud.prompt(n ? `Hold <kbd>E</kbd> interact with ${n.mem.met ? n.name : 'this person'}` : c ? '<kbd>F</kbd> get in the car' : '');
    }
    // the sun's shadows follow you
    const focus = pl.car ? pl.car.pos : pl.pos;
    this.sun.position.set(focus.x + 60, 90, focus.z + 40); this.sun.target.position.copy(focus); this.sun.target.updateMatrixWorld();
    this.sky.position.copy(this.camera.position);
    if (this.fountainWater) this.fountainWater.position.y = 0.45 + Math.sin(performance.now() / 600) * 0.01;
    this.hud.frame(rdt);
    if (pl.car && this.cam.mode === 'cockpit') pl.car.renderMirror(this.renderer, this.scene);
    this.renderer.render(this.scene, this.camera);
  }
}

new Game().init();
