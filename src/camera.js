// The camera: over the shoulder on foot; a chase camera or the driver's own eyes in a car.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class CameraRig {
  constructor(g) {
    this.g = g;
    this.yaw = Math.PI; this.pitch = 0.14; // (pitch > 0: the camera's above you, looking down)
    this.dist = 3.6;
    this.mode = 'chase'; // in a car: 'chase' | 'cockpit'
    this.lookYaw = 0; this.lookPitch = 0; // free look in a car
    this.freeT = 0;
    this.pos = V(); this.smoothTarget = null;
  }

  mouse(dx, dy) {
    const g = this.g;
    if (g.player.car) {
      this.lookYaw -= dx * 0.0025; this.lookPitch -= dy * 0.0025;
      this.lookYaw = THREE.MathUtils.clamp(this.lookYaw, -2.4, 2.4);
      this.lookPitch = THREE.MathUtils.clamp(this.lookPitch, -0.9, 0.7);
      this.freeT = 1.6;
    } else {
      this.yaw -= dx * 0.0025; this.pitch += dy * 0.0025;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -0.9, 1.2);
    }
  }

  // the camera stops short of walls
  clip(from, to, exclude) {
    const g = this.g, d = to.clone().sub(from), len = d.length();
    if (len < 0.01) return to;
    d.divideScalar(len);
    const ray = new g.R.Ray(from, d);
    const hit = g.world.castRay(ray, len, true, g.R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined, (c) => !exclude.includes(c.handle));
    if (hit) return from.clone().addScaledVector(d, Math.max(0.3, hit.timeOfImpact - 0.25));
    return to;
  }

  update(dt) {
    const g = this.g, cam = g.camera, p = g.player;
    if (p.car) {
      const car = p.car;
      this.freeT = Math.max(0, this.freeT - dt);
      if (this.freeT <= 0) { this.lookYaw *= Math.exp(-dt * 3); this.lookPitch *= Math.exp(-dt * 3); }
      if (this.mode === 'cockpit') {
        p.human.setHeadVisible(false);
        const eye = car.eyePoint();
        cam.position.copy(eye);
        const q = car.group.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(this.lookPitch - 0.06, this.lookYaw + Math.PI, 0, 'YXZ')));
        cam.quaternion.copy(q);
        cam.fov = 72; cam.updateProjectionMatrix();
        return;
      }
      p.human.setHeadVisible(true);
      // chase: swing round behind the car, a bit lazily
      const fwd = car.forward;
      const spd = car.speed;
      let heading = Math.atan2(fwd.x, fwd.z);
      if (spd < -1) heading += Math.PI; // (look ahead when reversing)
      this.chaseYaw = this.chaseYaw ?? heading;
      let d = heading - this.chaseYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.chaseYaw += d * Math.min(1, dt * 3.2);
      const yaw = this.chaseYaw + this.lookYaw;
      const dist = 6.4 + Math.min(Math.abs(spd), 40) * 0.035, height = 2.0 + this.lookPitch * -2;
      const target = car.group.position.clone().add(V(0, 1.15, 0));
      const want = target.clone().add(V(-Math.sin(yaw) * dist, height, -Math.cos(yaw) * dist));
      const at = this.clip(target, want, [car.col.handle]);
      cam.position.copy(at);
      cam.lookAt(target.clone().add(V(0, 0.3, 0)));
      cam.fov = 68 + Math.min(Math.abs(spd), 45) * 0.22; cam.updateProjectionMatrix();
      this.yaw = yaw + Math.PI; // (on getting out, the camera's where you left it)
      return;
    }
    this.chaseYaw = null;
    p.human.setHeadVisible(true);
    // over the shoulder
    const head = p.pos.add(V(0, 1.55, 0));
    this.smoothTarget = this.smoothTarget ? this.smoothTarget.lerp(head, 1 - Math.exp(-dt * 18)) : head;
    const t = this.smoothTarget;
    const dir = V(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    const right = V(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const aim = !!g.weapons?.aiming; this.aimK = (this.aimK || 0) + ((aim ? 1 : 0) - (this.aimK || 0)) * Math.min(1, dt * 10);
    const pivot = t.clone().addScaledVector(right, 0.45 + this.aimK * 0.35).add(V(0, -this.aimK * 0.08, 0)); // (over the right shoulder; closer in when aiming)
    const want = pivot.clone().addScaledVector(dir, this.dist - this.aimK * 1.9);
    const at = this.clip(pivot, want, [p.col.handle]);
    cam.position.copy(at);
    cam.lookAt(pivot.clone().addScaledVector(dir, -10));
    cam.fov = 70 - this.aimK * 16; cam.updateProjectionMatrix();
  }

  // which way "forward" is on foot (the way the camera faces, flattened)
  get forward() { return V(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
}
