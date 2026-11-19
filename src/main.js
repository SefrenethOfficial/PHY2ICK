// PHY2ICK: the test area.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
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
import './style.css';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

class Game {
  async init() {
    await RAPIER.init();
    this.R = RAPIER;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5)); r.setSize(innerWidth, innerHeight);
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
    this.map = buildWorld(this);
    this.apt = buildApartment(this);
    this.city.finish();
    this.cam = new CameraRig(this);
    this.wheel = new Wheel(this);
    this.player = new Player(this, this.apt.spawn);
    this.player.yaw = this.apt.spawnYaw; this.cam.yaw = this.apt.spawnYaw + Math.PI; this.cam.pitch = 0.18;
    this.cars = [
      new Car(this, V(-67.6, 0.02, 30), Math.PI, 0x9b1c1c),
      new Car(this, V(-67.6, 0.02, 20), Math.PI, 0x1f4f8a),
      new Car(this, V(-30, 0.02, -52.4), -Math.PI / 2, 0x2b2d30),
      new Car(this, V(150, 0.02, -3), Math.PI / 2, 0xd8d6d0),
    ];
    this.citizens = new Citizens(this, this.map, 16);
    this.wpBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
    this.wpBeam.visible = false; this.scene.add(this.wpBeam);

    // post-processing: ambient occlusion (contact shadows in every corner)
    const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
    const comp = this.composer = new EffectComposer(r, rt);
    comp.setPixelRatio(r.getPixelRatio());
    comp.addPass(new RenderPass(this.scene, this.camera));
    this.ao = new GTAOPass(this.scene, this.camera, innerWidth, innerHeight);
    this.ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.2, scale: 1, samples: 12 });
    this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    this.ao.blendIntensity = 0.85;
    comp.addPass(this.ao);
    comp.addPass(new OutputPass());
    this.post = !/[?&]lowgfx/.test(location.search);

    this.bindInput();
    addEventListener('resize', () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); r.setSize(innerWidth, innerHeight); comp.setSize(innerWidth, innerHeight); });
    this.clock = new THREE.Clock();
    this.started = false;
    r.setAnimationLoop(() => this.tick());
    window.game = this;
  }

  bindInput() {
    const canvas = this.renderer.domElement, splash = document.getElementById('splash');
    const lock = () => { canvas.requestPointerLock?.(); };
    splash.addEventListener('click', () => { lock(); this.started = true; splash.classList.add('playing'); });
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
      if (e.code === 'KeyP') { this.post = !this.post; this.hud.toast(this.post ? 'Graphics: high (ambient occlusion)' : 'Graphics: fast'); }
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
    const c = this.nearestCar();
    if (c) { if (this.props.held) this.props.drop(false); pl.enterCar(c); }
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
    if (dt > 0) for (let i = 0; i < steps; i++) {
      this.player.physics(h);
      this.citizens.physics(h);
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
      const slot = this.weapons.candidate(), n = !slot && this.wheel.candidate(), c = this.nearestCar();
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
    // indoors, the sky's light is mostly kept out: let the room's own lamps do the work
    const inside = !pl.car && this.apt.inside(pl.pos.add(V(0, 1, 0)));
    const envT = inside ? 0.3 : 0.75;
    this.scene.environmentIntensity += (envT - this.scene.environmentIntensity) * Math.min(1, rdt * 3);
    if (this.fountainWater) this.fountainWater.position.y = 0.45 + Math.sin(performance.now() / 600) * 0.01;
    this.hud.frame(rdt);
    if (pl.car && this.cam.mode === 'cockpit') pl.car.renderMirror(this.renderer, this.scene);
    if (this.post) this.composer.render(rdt); else this.renderer.render(this.scene, this.camera);
  }
}

new Game().init();
