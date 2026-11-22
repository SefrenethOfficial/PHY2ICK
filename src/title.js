// The title screen: Kit's camper parked alone out in the Dry, a mesa behind it, fumes pouring out of the roof
// vent and the cracked windows while the day runs by in seconds (dusk, a short night, dawn). Nobody about.
// The title theme plays over it. The van goes back where it was when you press Play.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// where it's parked: a flat bit of the Dry, the big mesa off its nose
const SPOT = V(318, 0, -1012), MESA = V(430, 0, -1130);

export class Title {
  constructor(g) {
    this.g = g; this.t = 0; this.active = false;
    this.music = new Audio(import.meta.env.BASE_URL + 'audio/title.mp3'); this.music.loop = true; this.music.volume = 0.75;
  }

  start() {
    const g = this.g, c = g.camper; if (!c || this.active || !g.desert) return;
    this.active = true; document.body.classList.add('title');
    this.sun0 = { dir: g.sunDir.clone(), i: g.sun.intensity, col: g.sun.color.clone(), hemi: g.hemi?.intensity, fog: g.scene.fog.color.clone(), env: g.scene.environmentIntensity };
    // the van: out of its spot on the beach (put back after)
    const t = c.body.translation(), r = c.body.rotation(); this.van0 = { p: { x: t.x, y: t.y, z: t.z }, q: { x: r.x, y: r.y, z: r.z, w: r.w } };
    const D = MESA.clone().sub(SPOT).setY(0).normalize(), yaw = Math.atan2(D.x, D.z) - 1.15; // (side-on to the camera, nose towards the mesa)
    const y = g.desert.groundY(SPOT.x, SPOT.z);
    this.vanQ = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
    this.vanAt = { x: SPOT.x, y: y + 1.0, z: SPOT.z };
    this.park(); this.settle = 1.5;
    // you: out of shot (the camera's the only one here)
    const pl = g.player; pl.human.root.visible = false; pl.scripted = { pos: SPOT.clone().setY(y).add(V(-40, 0, 0)), yaw: 0, pose: { pose: 'stand' } };
    // the camera: low, off the van's back quarter, looking past it to the mesa
    const side = V(D.z, 0, -D.x);
    this.cam0 = SPOT.clone().addScaledVector(D, -12).addScaledVector(side, 5.5).setY(y + 1.7);
    this.look0 = SPOT.clone().addScaledVector(D, 4).setY(y + 2.4);
    this.t = 0; this.fumeT = 0;
    const play = () => this.music.play().catch(() => {});
    this.music.play().catch(() => { // (browsers want a click or a key before music: the first one starts it)
      const go = () => { if (this.active) play(); removeEventListener('pointerdown', go); removeEventListener('keydown', go); };
      addEventListener('pointerdown', go); addEventListener('keydown', go);
    });
  }
  park() { const b = this.g.camper.body; b.setTranslation(this.vanAt, true); b.setRotation(this.vanQ, true); b.setLinvel({ x: 0, y: 0, z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true); }

  update(dt) {
    if (!this.active) return;
    const g = this.g, c = g.camper;
    this.t += dt;
    // (hold it still while it settles onto the sand, then leave it be)
    if (this.settle > 0) { this.settle -= dt; const b = c.body; const v = b.linvel(); b.setLinvel({ x: 0, y: Math.min(0, v.y), z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true); }
    // the timelapse: the sun across the sky in about forty seconds; dusk, a short night, dawn
    const ph = (this.t / 42 + 0.12) % 1, el = Math.sin(ph * Math.PI * 2) * 62 - 6, az = 80 + ph * 200;
    g.sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - el), THREE.MathUtils.degToRad(az));
    g.sky?.material.uniforms.sunPosition.value.copy(g.sunDir);
    const day = THREE.MathUtils.smoothstep(el, -6, 14), warm = 1 - THREE.MathUtils.smoothstep(el, 4, 30);
    g.sun.intensity = 3.4 * day + 0.45 * (1 - day); // (at night: the moon)
    g.sun.color.setRGB(1, 0.93 - warm * 0.3, 0.87 - warm * 0.5).lerp(new THREE.Color(0.55, 0.65, 1), 1 - day);
    if (g.hemi) g.hemi.intensity = 0.2 + 0.15 * day;
    g.scene.environmentIntensity = 0.3 + 0.45 * day;
    g.scene.fog.color.setRGB(0.12 + 0.6 * day, 0.14 + 0.64 * day, 0.2 + 0.62 * day);
    // the fumes: a thick pale plume out of the roof vent, wisps out of the cracked side windows
    if (g.fx && (this.fumeT -= dt) <= 0) {
      this.fumeT = 0.07;
      const q = c.group.quaternion, at = (x, y, z) => c.pos.clone().add(new THREE.Vector3(x, y, z).applyQuaternion(q));
      g.fx.smoke(at(0, 2.15, -1.4), 2, 0.66 + Math.random() * 0.12, 1.4 + Math.random() * 0.6); // (greyish-white, so it shows against a pale sky)
      if (Math.random() < 0.45) g.fx.smoke(at(Math.random() < 0.5 ? -1.15 : 1.15, 1.55, -0.9 - Math.random() * 1.2), 1, 0.78, 0.45);
    }
  }
  camera() {
    if (!this.active) return;
    const g = this.g, cam = g.camera, k = Math.sin(this.t * 0.05);
    cam.position.copy(this.cam0).add(V(k * 0.8, Math.sin(this.t * 0.09) * 0.12, k * 0.4));
    cam.lookAt(this.look0);
    if (cam.fov !== 50) { cam.fov = 50; cam.updateProjectionMatrix(); }
  }

  // Play: the van goes back to the beach, the sun goes back, the music fades
  end() {
    if (!this.active) return;
    const g = this.g, s = this.sun0, b = g.camper.body, v = this.van0;
    this.active = false; document.body.classList.remove('title');
    b.setTranslation(v.p, true); b.setRotation(v.q, true); b.setLinvel({ x: 0, y: 0, z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    g.sunDir.copy(s.dir); g.sky?.material.uniforms.sunPosition.value.copy(s.dir); g.sun.intensity = s.i; g.sun.color.copy(s.col); if (g.hemi) g.hemi.intensity = s.hemi; g.scene.fog.color.copy(s.fog); g.scene.environmentIntensity = s.env;
    g.player.human.root.visible = true; g.player.scripted = null;
    const m = this.music, v0 = m.volume; let i = 0;
    const fade = setInterval(() => { i++; m.volume = Math.max(0, v0 * (1 - i / 20)); if (i >= 20) { clearInterval(fade); m.pause(); } }, 75);
  }
}
