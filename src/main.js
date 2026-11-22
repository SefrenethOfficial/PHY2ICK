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
import { RW } from './city.js';
import { Traffic } from './traffic.js';
import { Save } from './save.js';
import { Blood } from './blood.js';
import { bakeStatic } from './bake.js';
import { ParkedCars } from './parked.js';
import { Fx } from './fx.js';
import { Sfx } from './sfx.js';
import { Police } from './police.js';
import { Pickups } from './pickups.js';
import { Drugs } from './drugs.js';
import { Tenants } from './tenants.js';
import { Story } from './story.js';
import { VanInterior } from './van.js';
import { Title } from './title.js';
import { WrenLife } from './wren.js';
import { Shops } from './shops.js';
import { ChopShop } from './chopshop.js';
import { Marcos } from './marcos.js';
import { Missions } from './missions.js';
import { Bikes } from './bikes.js';
import { Inventory } from './inventory.js';
import { BigMap } from './bigmap.js';
import { Mask } from './mask.js';
import { Crew } from './crew.js';
import { dressPaul, paulTick } from './paul.js';
import { Never } from './never.js';
import { Lucky } from './lucky.js';
import { Food } from './food.js';
import { Icons } from './icons.js';
import { Dealers } from './dealers.js';
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
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 4400);
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.keys = new Set();
    this.money = 500;
    this.timeScale = 1;
    this.waypoint = null;

    this.hud = new Hud(this);
    this.props = new Props(this);
    this.weapons = new Weapons(this);
    this.inv = new Inventory(this);
    this.bigmap = new BigMap(this);
    this.mask = new Mask(this);
    this.crew = new Crew(this);
    this.never = new Never(this);
    this.lucky = new Lucky(this);
    this.icons = new Icons(); this.food = new Food(this);
    this.blood = new Blood(this);
    this.fx = new Fx(this); this.sfx = new Sfx(this); this.pickups = new Pickups(this);
    const T0 = performance.now();
    this.map = buildWorld(this);
    this.loadTimes = { world: performance.now() - T0 };
    this.apt = buildApartment(this);
    this.city.finish();
    try { this.world.step(); dressPaul(this); } catch (e) { console.warn('[paul] the office dressing failed', e); }
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
    this.cars = spots.map((p, i) => new Car(this, V(p[0], 0.03, p[1]), p[2], p[3] ?? paints[i % paints.length], 'Police Cruiser', { police: true }));
    { // one right outside your front door
      const d = this.apt.door; this.cars.push(new Car(this, this.kerbSnap(V(d.x + 8, 0.03, d.z + 6.2)), Math.PI / 2, 0x9b1c1c));
    }
    const lotCars = this.map.parked.filter(p => p[4] !== 'police').sort(() => Math.random() - 0.5).slice(0, 30);
    this.parkedCars = new ParkedCars(this, lotCars.concat(this.map.kerbside.sort(() => Math.random() - 0.5).slice(0, 70)));
    this.citizens = new Citizens(this, this.map, 40);
    for (const w of this.workers || []) this.citizens.addWorker(w);
    this.police = new Police(this); this.police.warm(3);
    this.traffic = new Traffic(this);
    this.bikes = new Bikes(this);
    this.saver = new Save(this);
    this.drugs = new Drugs(this);
    this.setupDrugs();
    this.tenants = new Tenants(this, this.apt.tenants);
    this.story = new Story(this);
    this.title = new Title(this);
    this.wren = new WrenLife(this);
    this.shopping = new Shops(this);
    this.chop = new ChopShop(this);
    this.marcos = new Marcos(this);
    this.missions = new Missions(this);
    this.dealers = new Dealers(this);
    // traffic cones about the place: roadworks by the construction site, the dock, the desert road
    for (const [x, z] of [[-8, 101.6], [-4, 101.6], [0, 101.6], [4, 101.6], [8, 101.6], [12, 101.6], [130, -2262], [134, -2262], [138, -2262], [200, -2255], [124, -1000], [124, -1010], [124, -1020]]) { const y = this.desert?.inDesert(x, z) ? this.desert.groundY(x, z) + 0.05 : this.map.inRoad(x, z) ? 0.03 : 0.16; this.props.addCone(V(x, y, z), Math.random()); }
    this.spots.push({ pos: this.apt.clothes, r: 1.6, label: () => this.missions.canSleep() ? `<kbd>E</kbd> sleep till morning (it's day ${this.missions.day}${this.missions.cookedToday ? ', and you\'ve cooked' : ''})` : 'Your bed', act: () => this.missions.sleep(), when: () => this.story?.phase === 'free' });
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
    if (Save.has()) document.querySelector('#splash .modes').innerHTML = '<button data-mode="continue">Continue</button><button data-mode="story" class="alt">New game</button>';
    document.getElementById('splash').classList.add('ready');
    this.title.start();
    window.game = this;
  }

  bindInput() {
    const canvas = this.renderer.domElement, splash = document.getElementById('splash');
    const lock = () => { canvas.requestPointerLock?.(); };
    // the title: Story (the opening, from the ice bath) or Free roam (straight into the city); after that, a click resumes
    splash.addEventListener('click', (e) => {
      if (!splash.classList.contains('ready')) return;
      if (!this.started) {
        const mode = e.target.closest('[data-mode]')?.dataset.mode; if (!mode) return;
        this.started = true; splash.classList.add('playing'); this.sfx.unlock();
        if (mode === 'story') { Save.wipe(); splash.style.display = 'none'; this.title.end(); this.story.begin(); return; }
        if (mode === 'continue') { splash.style.display = 'none'; this.title.end(); if (!this.saver.load()) this.story.begin(); lock(); return; }
      }
      lock();
    });
    canvas.addEventListener('click', () => { if (!document.pointerLockElement && this.started && this.story?.phase !== 'creator') lock(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      splash.style.display = this.locked || this.story?.phase === 'creator' || this.wren?.phoneOpen || this.chop?.open || this.marcos?.open || this.inv?.open || this.food?.open || this.dealers?.open || this.bigmap?.open ? 'none' : 'flex';
      if (!this.locked) { this.keys.clear(); if (this.wheel.open) this.wheel.close(); }
    });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousedown', (e) => {
      if (!this.locked || this.player.bike) return;
      if (this.wheel.open) { if (e.button === 0) this.wheel.choose(); return; }
      const pl = this.player;
      if (pl.car || pl.ragdoll) return;
      if (e.button === 2) this.mouseR = true;
      if (e.button === 0) this.mouseL = true;
      if (e.button === 0) {
        if (this.inv.holdingFood && !this.props.held) { this.inv.eatHeld(); return; }
        if (this.props.held) this.props.click();
        else if (this.weapons.cur === 'fists' && !this.weapons.aiming && this.props.aimed() && !pl.hostage) this.props.click();
        else this.weapons.attack();
        this.mouseL = true;
      }
      if (e.button === 2 && this.props.held) this.props.drop(true);
    });
    addEventListener('mouseup', (e) => { if (e.button === 2) this.mouseR = false; if (e.button === 0) this.mouseL = false; });
    addEventListener('wheel', (e) => { if (!this.locked || this.wheel.open || this.player.car) return; this.inv.cycle(e.deltaY > 0 ? 1 : -1); }, { passive: true });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      if (this.wheel.open) this.wheel.mouse(e.movementX, e.movementY);
      else this.cam.mouse(e.movementX, e.movementY);
    });
    addEventListener('keydown', (e) => {
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.bigmap?.open) { this.bigmap.key(e.code); this.keys.delete(e.code); return; }
      if (this.chop?.open) { this.chop.key(e.code); this.keys.delete(e.code); return; }
      if (this.marcos?.open) { this.marcos.key(e.code); this.keys.delete(e.code); return; }
      if (this.inv?.open) { this.inv.key(e.code); this.keys.delete(e.code); return; }
      if (this.food?.open) { this.food.key(e.code); this.keys.delete(e.code); return; }
      if (this.dealers?.open) { this.dealers.key(e.code); this.keys.delete(e.code); return; }
      if (this.wren?.phoneOpen) { this.wren.phoneKey(e.code); this.keys.delete(e.code); return; }
      if (e.code === 'KeyM' && this.started && !this.story?.cine && this.story?.phase !== 'creator' && !this.drugs?.cook) { this.bigmap.show(); this.keys.delete(e.code); return; }
      if (e.code === 'KeyP' && this.started && !this.story?.cine && this.story?.phase !== 'creator') { this.wren.openPhone(); this.keys.delete(e.code); return; }
      if (this.story?.key(e.code)) { if (['Enter', 'Space', 'Escape', 'KeyE'].includes(e.code)) this.keys.delete(e.code); return; } // (a key held through a scene still counts once it's over)
      if (!this.locked) return;
      const pl = this.player;
      if (this.wheel.open) {
        if (/^Digit[1-6]$/.test(e.code)) this.wheel.choose(+e.code.slice(5) - 1);
        if (e.code === 'Escape' || e.code === 'KeyQ') this.wheel.close();
        return;
      }
      if (this.drugs.cook) { this.drugs.key(e.code); return; }
      if (e.code === 'KeyE') { const sp = this.spotNear(); if (sp) { sp.act(); return; } }
      if ((e.code === 'KeyC' || e.code === 'ControlLeft') && !pl.car) { pl.crouch = !pl.crouch; }
      if (e.code === 'KeyE') {
        const slot = this.weapons.candidate();
        if (slot) this.weapons.take(slot);
        else { const n = this.wheel.candidate(); if (n) this.wheel.show(n); }
      }
      if (e.code === 'KeyK') this.mask.toggle();
      if (e.code === 'KeyV' && !pl.car) this.inv.store();
      if ((e.code === 'Tab' || e.code === 'KeyI') && !pl.car && !pl.bike) { this.inv.show(); return; }
      if (e.code === 'KeyE' && pl.car && this.chop.canUse()) { this.chop.show(); return; }
      if (e.code === 'KeyE' && this.marcos?.canOrder() && !this.wheel.open) { this.marcos.show(); return; }
      if (e.code === 'KeyX') { if (this.props.held) this.props.drop(false); else if (this.inv.holdingFood) this.inv.sel = 0; else if (this.weapons.held) this.weapons.putAway(); }
      if (/^Digit[1-6]$/.test(e.code) && !pl.car) this.inv.select(+e.code.slice(5) - 1);
      if (e.code === 'KeyG' && !pl.car && !pl.hostage) { const tc = this.trunkCar(); if (tc) { if (tc.trunk.length) this.outOfTrunk(tc); else { const b = this.bodyNear(); if (b) this.intoTrunk(tc, b); else { tc.openLid(1.2); this.hud.toast('The boot is empty'); } } return; } }
      if (e.code === 'KeyG') { if (pl.car) { if (pl.car.passenger?.kidnapped) pl.freeKidnapped(pl.car); } else { const k = this.kidnapCar(); if (k && !pl.hostage) pl.freeKidnapped(k); else pl.grab(); } }
      if (e.code === 'KeyQ' && !pl.car && !pl.bike) { if (!pl.takedown()) pl.finishOff(); }
      if (e.code === 'KeyY') pl.toggleSurrender();
      if (e.code === 'KeyR' && !pl.car) this.weapons.reload();
      if (e.code === 'Space' && !pl.car) pl.jumpQ = true;
      if (e.code === 'KeyF') this.toggleCar();
      if (e.code === 'KeyC' && pl.car) this.cam.mode = this.cam.mode === 'chase' ? 'cockpit' : 'chase';
      if (e.code === 'KeyR' && pl.car) this.resetCar(pl.car);
      if (e.code === 'KeyT' && e.shiftKey && this.debug) this.police.crime('murder', pl.pos, true);
      if (e.code === 'KeyH') this.hud.helpEl.classList.toggle('hide');
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyE' && this.wheel.open && this.wheel.sel >= 0) this.wheel.choose();
    });
  }

  // Kit's van, back on Wren's drive (after a reload, or a while after it's been wrecked): the same plate, the same paint
  parkVanAtWren() {
    const h = this.wrenHouse; if (!h) return;
    let c = this.camper; const old = c && c.wrecked ? c : null;
    const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), h.driveYaw);
    if (!c || old) {
      c = new Car(this, h.drive.clone().setY(0.75), h.driveYaw, 0xe6dcc0, 'Camper', { camper: true }); this.cars.push(c); this.camper = c;
      if (old) { if (old.plate) c.setPlate?.(old.plate); c.owned = old.owned; this.scene.remove(old.group); this.world.removeVehicleController(old.vc); this.world.removeRigidBody(old.body); this.cars.splice(this.cars.indexOf(old), 1); if (old.kitchen) this.wren?.paintVan(); }
    } else {
      if (this.player.car === c) return;
      const p = h.drive; c.body.setTranslation({ x: p.x, y: 0.75, z: p.z }, true); c.body.setRotation(q, true); c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); c.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      c.group.position.set(p.x, 0.75, p.z); c.group.quaternion.copy(q); c.group.updateMatrixWorld(true);
    }
    c.locked = !this.drugs.vanKeys;
  }
  // a wrecked van comes back on Wren's drive (once the story's let it go, and you're not looking)
  vanWatch(dt) {
    const c = this.camper; if (!c || !c.wrecked || this.story?.phase !== 'free' || !this.wrenHouse) { this.vanBackT = 0; return; }
    if (!this.vanBackT) this.vanBackT = 25;
    if ((this.vanBackT -= dt) > 0) return;
    const d = this.wrenHouse.drive, cam = this.camera.position;
    const seen = (p) => cam.distanceTo(p) < 90 && this.citizens._fr?.containsPoint(p.clone().setY(1));
    if (seen(c.pos) || seen(d)) { this.vanBackT = 3; return; }
    this.vanBackT = 0; this.parkVanAtWren(); this.hud.toast("Kit's van is back on Wren's drive, in Willow Bank", '#5fd0ff');
  }

  // a point pulled in to the kerb of the nearest road (so a parked car's out of the traffic)
  kerbSnap(p) {
    let best = null, bd = 12;
    for (const s of this.map.segs) { const dx = p.x - s.a[0], dz = p.z - s.a[1], t = dx * s.u[0] + dz * s.u[1]; if (t < 0 || t > s.L) continue; const side = dx * s.n[0] + dz * s.n[1]; if (Math.abs(side) < bd) { bd = Math.abs(side); best = { s, t, sd: side >= 0 ? 1 : -1 }; } }
    if (!best) return p;
    const { s, t, sd } = best, off = RW / 2 - 1.25;
    return V(s.a[0] + s.u[0] * t + s.n[0] * sd * off, p.y, s.a[1] + s.u[1] * t + s.n[1] * sd * off);
  }

  nearestCar() {
    const p = this.player.pos; let best = null, bd = 3.6;
    for (const c of this.cars) { const d = c.pos.distanceTo(p.clone().add(V(0, 0.8, 0))); if (d < bd && !c.driver) { bd = d; best = c; } }
    return best;
  }

  toggleCar() {
    const pl = this.player;
    if (pl.ragdoll) return;
    if (pl.bike) { this.bikes.dismount(); return; }
    if (pl.car && pl.seat === 'passenger') { const car = pl.car; if (car.tRec) this.traffic.shove(car); else pl.slideOver(); return; } // (in their passenger seat: shove them out, take the wheel)
    if (pl.car) {
      const car = pl.car, fast = Math.abs(car.speed) > 3;
      if (fast) pl.bailOut(); else pl.exitCar(); // (at speed you tumble out; the car rolls on without you)
      if (car.passenger && !car.passenger.kidnapped) this.citizens.unboard(car.passenger, car);
      this.cam.lookYaw = this.cam.lookPitch = 0;
      this.cam.yaw = car.yaw + Math.PI * 0.75; this.cam.pitch = 0.22; this.cam.smoothTarget = null; // (the camera swings out to your side, clear of the car)
      return;
    }
    // holding someone at the back of a car: into the boot with them
    if (pl.hostage) { const tc = this.trunkCar(); if (tc) { this.intoTrunk(tc, pl.hostage); return; } }
    if (pl.smashT > 0) return;
    let c = this.nearestCar();
    // a bike's nearer than any car: on you get (knocking them off it first, if someone's riding it)
    { const bk = this.bikes.nearest(pl.pos); if (bk && (!c || Math.hypot(bk.pos.x - pl.pos.x, bk.pos.z - pl.pos.z) < c.pos.distanceTo(pl.pos) - 1.2)) { this.bikes.mount(bk); return; } }
    // someone's driving it: their door (drag them out, if you can) or the passenger's (get in, then shove them out)
    if (c && c.tRec?.driver && !pl.hostage) {
      const dD = c.doorPoint('driver', 0.4).distanceTo(pl.pos), dP = c.doorPoint('passenger', 0.4).distanceTo(pl.pos);
      if (dP < dD) { if (this.props.held) this.props.drop(false); this.traffic.intoPassenger(c); return; }
      if (!this.traffic.overpower(c)) return;
    }
    if (!c) { const pc = this.parkedCars.nearest(pl.pos); if (pc) c = this.parkedCars.take(pc); }
    if (c) {
      if (c.locked && !c.smashed.driver && !c.wrecked) { if (this.props.held) this.props.drop(false); if (this.weapons.cur !== 'fists') this.weapons.equip('fists', true); this.hud.toast("It's locked. You put your elbow through the window."); pl.smashIn(c); return; }
      if (c.wrecked) { this.hud.toast("It's a burnt-out wreck"); return; }
      if (this.props.held) this.props.drop(false);
      if (pl.hostage) { if (c.passenger) { this.hud.toast('The passenger seat is taken'); return; } pl.bundle(c); c.openDoor('passenger', 1.0); }
      if (this.weapons.cur !== 'fists') { const m = this.weapons.models[this.weapons.cur]; if (m) m.visible = false; }
      if (c.police) this.police.crime('carjack', pl.pos);
      if (c.tRec) this.traffic.carjack(c);
      pl.enterCar(c);
    }
  }

  // ---- PHYSICK: where it's cooked, who buys it
  setupDrugs() {
    const C = this.citizens, D = this.drugs, P = (name) => { const k = name in this.places ? name : Object.keys(this.places).find(k => k.startsWith(name.toLowerCase())); return k ? this.places[k] : null; };
    this.spots = [];
    const spot = (pos, r, label, act, when = () => true) => this.spots.push({ pos, r, label, act, when });
    // Kit's camper, parked up on the beach (locked)
    const bp = P('beach');
    if (bp) {
      const q = bp.pos.clone().add(V(12, 0, 9)); this.camper = new Car(this, V(q.x, 0.03, q.z), Math.PI / 2, 0xe6dcc0, 'Camper', { camper: true }); this.camper.locked = true; this.cars.push(this.camper);
      // inside it (a room of its own, out of sight under the sand)
      const van = this.van = new VanInterior(this, V(q.x, -40, q.z));
      spot(van.stove, 0.9, () => '<kbd>E</kbd> cook Physick', () => { this.player.yaw = van.stoveYaw; D.start('van', this.camper); }, () => van.inside);
      spot(van.door, 0.8, () => '<kbd>E</kbd> get out', () => van.exit(), () => van.inside && !D.cook);
    }
    // buyers
    const buyerSpots = [['the skatepark', 'skatepark'], ['the park', 'bushes'], ['the beach washrooms', 'washrooms'], ['the nightclub', 'nightclub']];
    const lines = ['You holding?', "I'm not a cop. Why would you ask that?", 'Got any of the blue?', 'Physick? You got Physick?', 'Keep it down, man.'];
    for (const [name, id] of buyerSpots) {
      const pl = P(name); if (!pl) continue;
      for (let k = 0; k < (id === 'nightclub' ? 2 : 1 + (Math.random() < 0.5 ? 1 : 0)); k++) {
        const a = Math.random() * 6.28, at = pl.pos.clone().add(V(Math.sin(a) * (2 + k * 2), 0, Math.cos(a) * (2 + k * 2)));
        const n = C.addWorker({ pos: at, yaw: Math.random() * 6.28, lines, role: 'buyer' });
        n.spot = id; n.undercover = Math.random() < 0.15;
      }
    }
  }
  spotNear() {
    const p = this.player.pos; if (this.player.car) return null;
    for (const s of this.spots || []) if (s.pos.distanceTo(p) < s.r && s.when()) return s;
    // the back of the camper
    const c = this.camper; if (c && !c.wrecked && !c.driver && Math.abs(c.speed) < 0.5 && c.trunkPoint(0.2).distanceTo(p) < 1.6 && !this.story?.cine) return this.drugs.vanKeys ? { label: () => '<kbd>E</kbd> get in the van', act: () => this.story?.vanDoor?.() || this.van.enter() } : { label: () => "The back of the van's locked", act: () => this.hud.toast("It's locked. Whose van is this?") };
    return null;
  }
  teleport(at, yaw) {
    const pl = this.player; this.hud.blackout(true);
    setTimeout(() => { pl.body.setTranslation({ x: at.x, y: at.y + 1.0, z: at.z }, true); pl.body.setNextKinematicTranslation({ x: at.x, y: at.y + 1.0, z: at.z }); if (yaw != null) { pl.yaw = yaw; this.cam.yaw = yaw + Math.PI; } this.hud.blackout(false); }, 350);
  }
  // the boot: a car whose back end you're standing at
  trunkCar() { const p = this.player.pos; let best = null, bd = 1.9; for (const c of this.cars) { if (c.inactive || c.wrecked || c.camper) continue; const d = c.trunkPoint(0.3).distanceTo(p); if (d < bd) { bd = d; best = c; } } return best; }
  intoTrunk(car, n) {
    const pl = this.player, C = this.citizens;
    if (car.trunk.length >= 2) { this.hud.toast('The boot is full'); return; }
    if (pl.hostage === n) { pl.hostage = null; n.hostage = null; }
    if (n.human.ragdoll) { n.human.ragdoll.dispose(); n.human.ragdoll = null; }
    const alive = n.state !== 'dead';
    n.state = 'trunk'; n.trunkCar = car; n.trunkAlive = alive; n.downed = false; n.kidnapped = alive; n.col.setEnabled(false); n.human.root.visible = false;
    car.trunk.push(n); car.openLid(1.0); this.sfx.thunk(car.pos);
    this.hud.toast(alive ? 'Into the boot they go · G at the boot to let them out' : 'You heave the body into the boot', '#ff9a5a');
    this.police.crime(alive ? 'kidnap' : 'murder', pl.pos);
  }
  outOfTrunk(car) {
    const C = this.citizens, at = car.trunkPoint(0.7);
    car.openLid(1.4);
    for (const n of car.trunk.splice(0)) {
      n.trunkCar = null; n.kidnapped = false; n.human.root.visible = true;
      n.body.setTranslation({ x: at.x, y: at.y + 1.0, z: at.z }, true); n.body.setNextKinematicTranslation({ x: at.x, y: at.y + 1.0, z: at.z });
      n.human.root.position.copy(at); n.human.root.updateMatrixWorld(true);
      if (n.trunkAlive) { n.state = 'flee'; n.stateT = 12; n.col.setEnabled(true); C.say(n, ['Oh thank god!', 'HELP! HELP!', "I'm calling the cops!"][Math.floor(Math.random() * 3)], 2.5); if (n.hostageBag) setTimeout(() => n.human.removeBag(), 2000); n.hostageBag = false; }
      else { n.state = 'down'; C.knock(n, V(0, 0.5, 0), 1); C.die(n); }
    }
  }
  // someone lying on the ground near you (downed or dead)
  bodyNear() { const p = this.player.pos; let best = null, bd = 2.6; for (const n of this.citizens.list) { const r = n.human.ragdoll; if (!r || (!n.downed && n.state !== 'dead') || n.trunkCar || n.companion) continue; const d = r.pelvis.distanceTo(p.clone().setY(r.pelvis.y)); if (d < bd) { bd = d; best = n; } } return best; }

  // a car near you with someone tied up in it
  kidnapCar() { const p = this.player.pos; return this.cars.find(c => c.passenger?.kidnapped && c.pos.distanceTo(p) < 3.5); }

  // whose is this collider (a person, a car, a thing)?
  ownerOf(h) {
    for (const n of this.citizens.list) {
      if (n.col.handle === h) return { npc: n };
      const r = n.human.ragdoll; if (r) for (const k in r.parts) if (r.parts[k].col?.handle === h) return { npc: n };
    }
    for (const c of this.cars) if (c.col.handle === h || c.roofCol.handle === h) return { car: c };
    const pr = this.props.byCollider?.get(h); if (pr) return { prop: pr };
    return null;
  }

  // an explosion: everyone and everything nearby
  blast(at, R, src) {
    const pl = this.player;
    for (const n of this.citizens.list) {
      if (n.state === 'dead') continue;
      const q = n.human.ragdoll ? n.human.ragdoll.pelvis : this.citizens.pos(n), d = q.distanceTo(at); if (d > R) continue;
      const k = 1 - d / R, dir = q.clone().sub(at).setY(0).normalize();
      if (n.state === 'seated') { if (n.car === src) { n.hp = 0; n.human.dead = true; } continue; }
      if (n.hostage) pl.releaseHostage(false);
      const v = dir.multiplyScalar(4 + k * 10); v.y = 3 + k * 6;
      n.hp -= 30 + k * 140;
      if (k > 0.4) n.human.char(0.75 - k * 0.3);
      this.citizens.knock(n, v, 8);
      if (n.hp <= 0) this.citizens.die(n); else { this.citizens.downed(n); }
    }
    if (pl.car === src) pl.hurt(999, V(0, 1, 0), 'explosion');
    else if (!pl.car) { const d = pl.pos.distanceTo(at); if (d < R) { const k = 1 - d / R; const dir = pl.pos.sub(at).setY(0).normalize(); if (k > 0.55) pl.hurt(999, dir, 'explosion'); else { pl.knockDown(dir, 6 + k * 10, 20 + k * 80); } } }
    else { const d = pl.car.pos.distanceTo(at); if (d < R) pl.car.damage((1 - d / R) * 500); }
    for (const c of this.cars) { if (c === src || c.inactive) continue; const d = c.pos.distanceTo(at); if (d < R) { const k = 1 - d / R; c.damage(k * 700); const dir = c.pos.clone().sub(at).normalize(); c.body.applyImpulse({ x: dir.x * k * 6000, y: k * 5000, z: dir.z * k * 6000 }, true); } }
    for (const pr of this.props.list) { const t = pr.body.translation(), d = Math.hypot(t.x - at.x, t.y - at.y, t.z - at.z); if (d < R) { const m = pr.body.mass(), k = 1 - d / R; pr.body.applyImpulse({ x: (t.x - at.x) / d * k * 8 * m, y: k * 8 * m, z: (t.z - at.z) / d * k * 8 * m }, true); } }
    if (src?.lastHitBy === 'player' || pl.pos.distanceTo(at) < 40) this.police.crime('explosion', at);
    // the camera shakes
    this.shake = Math.max(this.shake || 0, Math.max(0, 1 - this.camera.position.distanceTo(at) / 60));
  }

  // a car hit something hard
  onCarCrash(car, mag, at) {
    const pl = this.player;
    if (car === pl.car) {
      car.lastHitBy = 'player';
      if (mag > 9) pl.hurt((mag - 9) * 2.5, V(0, 1, 0), 'crash');
      if (mag > 11 && car.passenger && car.passenger === this.wren?.n) this.wren.react('crash', mag > 18 ? -3 : -1, 10);
      this.shake = Math.max(this.shake || 0, Math.min(1, mag / 20));
      // a big head-on stop: out through the windscreen
      const loc = car.group.worldToLocal(at.clone());
      if (mag > 19 && loc.z > 1.2 && !pl.dead) { pl.bailOut(true); this.hud.toast('You went through the windscreen!', '#ff9a5a'); }
      // rammed a police car
      for (const c of this.cars) if (c !== car && c.police && c.crew?.length && c.pos.distanceTo(at) < 4) this.police.crime('ramCop', at, true);
    }
  }

  // WASTED / BUSTED: slow motion, grey, the words; then you wake up somewhere
  endScreen(kind) {
    if (this.ending) return;
    const pl = this.player;
    this.ending = kind;
    if (kind === 'busted') { this.busted = true; pl.surrender = true; if (pl.hostage) pl.releaseHostage(false); }
    const why = kind === 'busted' ? (this.police.why || (this.police.stars ? 'evading the police' : null)) : null;
    this.hud.endText(kind, why);
    this.timeScale = 0.3;
    this.sfx.musicOn = false;
    setTimeout(() => this.hud.blackout(true), 4200);
    setTimeout(() => {
      const fine = kind === 'busted' ? Math.min(this.money, 100 + this.police.stars * 150) : Math.min(this.money, 100);
      this.money -= fine;
      this.police.busted();
      let tookBags = 0; if (kind === 'busted') { tookBags = this.drugs.count; this.drugs.bags = []; this.weapons.confiscate(); const ps = this.places['the police station']?.pos || this.apt.spawn; pl.respawn(ps.clone().setY(0.05), null); }
      else { const s = this.hospitalSpawn || this.apt.spawn; pl.respawn(s, this.hospitalYaw); }
      this.timeScale = 1; this.hud.endText(null); this.ending = null; this.busted = false;
      this.hud.blackout(false);
      this.hud.toast(kind === 'busted' ? `You're released from the Police Station${why ? ` (arrested for ${why})` : ''}. The fine: $${fine}. They kept your guns${tookBags ? ` and ${tookBags} bag${tookBags > 1 ? 's' : ''} of Physick` : ''}.` : `You wake up outside the Hospital, aching. The bill: $${fine}`);
    }, 5400);
  }

  // pointing a weapon at someone: shopkeepers empty the till, anyone else hands over their wallet
  aimedPerson(range) {
    const { o, d } = this.weapons.aimRay(), pl = this.player.pos;
    let best = null, bs = Infinity;
    for (const n of this.citizens.list) {
      if (['dead', 'seated'].includes(n.state) || n.human.ragdoll || n.hostage) continue;
      const q = this.citizens.pos(n).add(V(0, 1.1, 0)), dd = q.distanceTo(pl); if (dd > range) continue;
      const to = q.clone().sub(o), along = to.dot(d); if (along < 0) continue;
      const off = to.addScaledVector(d, -along).length() / Math.max(1, along);
      if (off < 0.13 + (dd < 3 ? 0.25 : 0) && off < bs) { bs = off; best = n; }
    }
    return best;
  }
  robbery(dt) {
    const W = this.weapons, pl = this.player;
    this.aimedAt = null;
    let robbing = null;
    if (W.aiming && !pl.car) {
      const n = this.aimedPerson(W.W.gun ? 18 : 3.2);
      this.aimedAt = n;
      if (n && W.W.threat >= 1) {
        if (n.home && n.role === 'clerk') {
          robbing = n;
          const now = performance.now() / 1000;
          if (n.robbedAt && now - n.robbedAt < 180) { if (!n.emptySaid) { n.emptySaid = true; this.citizens.say(n, "The till's empty! You already took it all!", 3); } }
          else {
            if (!n.robbing) { n.robbing = true; n.robT = 0; n.human.express('scared', 8); this.citizens.say(n, ['Okay okay! Don\'t shoot!', 'Please! Take whatever you want!', "It's not my money anyway!"][Math.floor(Math.random() * 3)], 3); this.police.crime('threat', pl.pos, true); }
            n.robT += dt; this.hud.rob(Math.min(1, n.robT / 4));
            if (n.robT >= 4) { const amt = 150 + Math.floor(Math.random() * 300); this.money += amt; this.sfx.cash(pl.pos); this.hud.toast(`You emptied the till: $${amt}`, '#7be08a'); this.citizens.say(n, 'Take it! Just go!', 3); n.robbedAt = now; n.emptySaid = false; n.robbing = false; this.police.crime('robbery', pl.pos, true); }
          }
        } else if (!n.home) this.citizens.threaten(n, dt);
        else if (n.companion) this.citizens.threaten(n, dt); // (Wren: he has his own words for it)
        else if (n.home) { n.state !== 'handsUp' && this.citizens.say(n, 'Whoa! Easy!', 2); n.state = 'handsUp'; n.stateT = 2; }
      }
    }
    for (const n of this.citizens.list) if (n.robbing && n !== robbing) { n.robbing = false; }
    if (!robbing || !robbing.robbing) this.hud.rob(null);
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
    for (const n of this.citizens.list) if (!['seated', 'dead'].includes(n.state) && !n.human.ragdoll) peds.push({ p: this.citizens.pos(n), hit: (d, f, car) => (f > 2.5 ? this.citizens.hitByCar(n, d, f, car) : null) });
    for (const car of this.cars) {
      const v = car.body.linvel(), sp = Math.hypot(v.x, v.z);
      if (sp < 0.4) continue;
      for (const ped of peds) {
        const loc = car.group.worldToLocal(ped.p.clone().add(V(0, 0.9, 0)));
        if (Math.abs(loc.x) < 1.15 && Math.abs(loc.z) < 2.55 && Math.abs(loc.y) < 1.6) {
          const side = V(Math.sign(loc.x) || 1, 0, 0).applyQuaternion(car.group.quaternion);
          const dir = V(v.x, 0, v.z).normalize().multiplyScalar(0.8).add(side.multiplyScalar(0.35));
          ped.hit(dir, sp, car);
          if (sp > 2.5) car.body.applyImpulse({ x: -v.x * 35, y: 0, z: -v.z * 35 }, true);
        }
      }
    }
  }

  tick() {
    const rdt = Math.min(this.clock.getDelta(), 0.1);
    const dt = this.bigmap?.open ? 0 : rdt * this.timeScale; // (the map's open: everything holds still)
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
    this.police.update(dt);
    this.traffic.update(dt);
    this.bikes.update(dt);
    if (this.started) this.saver.update(rdt);
    this.pickups.update(dt);
    this.fx.update(dt);
    this.sfx.update(rdt);
    this.robbery(dt);
    this.drugs.update(dt);
    this.tenants?.update(dt);
    this.story?.update(rdt);
    this.wren?.update(rdt);
    this.shopping?.update(rdt);
    this.chop?.update(rdt);
    this.marcos?.update(rdt);
    this.missions?.update(rdt);
    this.dealers?.update(rdt);
    this.inv?.update();
    this.bigmap?.update(rdt);
    this.vanWatch?.(rdt);
    this.mask?.update(dt > 0 ? rdt : 0);
    if (dt > 0) this.crew?.update(rdt);
    paulTick(this, rdt);
    if (dt > 0) this.never?.update(rdt);
    if (dt > 0) this.lucky?.update(rdt);
    this.title?.update(rdt);
    this.sfx.horn(this.player.car?.pos, !!(this.player.car && this.player.dead));
    this.player.frame(dt);
    this.citizens.frame(dt);
    this.blood.update(dt);
    this.cam.update(rdt);
    this.story?.camera();
    this.title?.camera();
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - rdt * 1.5); const k = this.shake * 0.12; this.camera.position.add(V((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k)); }
    // the prompt
    const pl = this.player;
    let prompt = '';
    if (this.wheel.open) prompt = 'Move the mouse to pick · release <kbd>E</kbd> (or click, or <kbd>1</kbd>–<kbd>6</kbd>) · <kbd>Q</kbd> cancel';
    else if (this.marcos?.canOrder() && !pl.ragdoll) prompt = this.marcos.label() + (pl.car ? ' · <kbd>F</kbd> get out' : '');
    else if (pl.car && this.chop?.canUse()) prompt = `<kbd>E</kbd> Rusty's: register, respray, new plates · <kbd>F</kbd> get out`;
    else if (pl.bike) prompt = '<kbd>W</kbd> pedal · <kbd>Shift</kbd> faster · <kbd>S</kbd> brake · <kbd>A</kbd>/<kbd>D</kbd> steer · <kbd>F</kbd> get off';
    else if (pl.car && pl.seat === 'passenger') prompt = pl.car.tRec ? '<kbd>F</kbd> shove the driver out and take the wheel' : '<kbd>F</kbd> slide over to the wheel';
    else if (pl.car) prompt = (pl.car.passenger?.kidnapped ? '<kbd>G</kbd> let them go · ' : '') + `<kbd>F</kbd> get out · <kbd>C</kbd> ${this.cam.mode === 'chase' ? 'inside view' : 'chase camera'} · <kbd>Space</kbd> handbrake`;
    else if (!pl.ragdoll) {
      const slot = this.weapons.candidate(), n = !slot && this.wheel.candidate(), c = this.nearestCar() || this.parkedCars.nearest(pl.pos), bkN = this.bikes.nearest(pl.pos);
      const fin = pl.finishTarget(), td = pl.takedownTarget(), kc = this.kidnapCar(), sp = this.spotNear();
      if (this.drugs.cook) prompt = 'Cooking · hold <kbd>Space</kbd> heat · <kbd>E</kbd> stir · <kbd>Q</kbd> give up';
      else if (pl.surrender) prompt = 'Hands up · <kbd>Y</kbd> change your mind';
      else if (sp) prompt = sp.label();
      else if (pl.hostage) prompt = `Holding ${pl.hostage.mem.met ? pl.hostage.name : 'someone'} · <kbd>F</kbd> by a car door (or the boot) to put them in · <kbd>G</kbd> let go`;
      else if (td) prompt = `<kbd>Q</kbd> finisher: <b>${Player.finName(this.weapons.W, this.weapons.cur)}</b>`;
      else if (fin) prompt = `<kbd>Q</kbd> finish ${fin.mem.met ? fin.name : 'them'} off`;
      else if (kc) prompt = '<kbd>G</kbd> let them out of the car';
      else if (this.trunkCar()) { const tc = this.trunkCar(); prompt = tc.trunk.length ? `<kbd>G</kbd> open the boot (${tc.trunk.length} inside)` : this.bodyNear() ? '<kbd>G</kbd> throw them in the boot' : '<kbd>G</kbd> open the boot'; }
      else if (this.props.held) { const h = this.props.held; prompt = `Carrying ${h.name}${h.shop && !h.paid ? ` ($${h.price}, not paid for)` : ''} · <kbd>Click</kbd> drop · <kbd>Right-click</kbd> throw · <kbd>V</kbd> pocket it`; }
      else if (slot && slot.drawer) prompt = !this.weapons.drawer.open ? '<kbd>E</kbd> open the drawer' : !slot.taken ? '<kbd>E</kbd> take the Butter Knife' : this.weapons.inv.has('butter') ? '<kbd>E</kbd> put the Butter Knife back' : '<kbd>E</kbd> close the drawer';
      else if (slot) prompt = slot.taken ? `<kbd>E</kbd> put the ${this.weapons.held.name} back` : `<kbd>E</kbd> take the ${{ hatchet: 'Hatchet', butter: 'Butter Knife', kiddie: 'Plastic Kiddie Knife' }[slot.id]}`;
      else if (n) prompt = `Hold <kbd>E</kbd> interact with ${n.mem.met ? n.name : 'this person'}`;
      else if (bkN) prompt = bkN.rider ? '<kbd>F</kbd> knock them off the bike and take it' : '<kbd>F</kbd> get on the bike';
      else if (c) prompt = c.tRec?.driver ? (c.doorPoint('passenger', 0.4).distanceTo(pl.pos) < c.doorPoint('driver', 0.4).distanceTo(pl.pos) ? '<kbd>F</kbd> get in the passenger side' : c.tRec.held ? "They're holding the door shut · try the passenger side" : '<kbd>F</kbd> drag the driver out') : '<kbd>F</kbd> get in the car';
      else { const p = this.weapons.held ? null : this.props.aimed(); if (p) prompt = `<kbd>Click</kbd> pick up ${p.name}`; else if (this.weapons.W.gun) prompt = `<kbd>Right mouse</kbd> aim · <kbd>Click</kbd> fire · <kbd>R</kbd> reload`; else if (this.weapons.held) prompt = `<kbd>Click</kbd> swing the ${this.weapons.held.name} · <kbd>X</kbd> fists`; else if (this.police.stars) prompt = '<kbd>Y</kbd> give yourself up'; }
    }
    this.hud.prompt(this.started && !this.story?.locked ? prompt : '');
    document.getElementById('crosshair').style.display = !pl.car && this.locked && !(this.weapons.aiming && this.weapons.W.gun) ? 'block' : 'none';
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
    // under the water: everything goes murky green-blue, close in
    { const c = this.camera.position, wl = this.waterAt(c.x, c.z), under = wl != null && c.y < wl - 0.05 && !this.van?.contains(c), f = this.scene.fog;
      if (under !== !!this.underwater) {
        this.underwater = under;
        if (under) { this._fog = [f.color.getHex(), f.near, f.far]; f.color.set(0x1d5866); f.near = 0.5; f.far = 24; }
        else if (this._fog) { f.color.set(this._fog[0]); f.near = this._fog[1]; f.far = this._fog[2]; }
      } }
    if (this.sky) this.sky.position.copy(this.camera.position); // (the sky goes where you go: out at the docks too)
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
