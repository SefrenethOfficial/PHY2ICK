// Cars parked along the kerbs: drawn in bulk (one instanced copy of each part of the car, with the
// paint colour per car), with a plain box to bump into. Get in one and it turns into a real car.
import * as THREE from 'three';
import { Car } from './car.js';

const PAINTS = [0x9b1c1c, 0x1f4f8a, 0x2b2d30, 0xd8d6d0, 0x3f6b3f, 0x8a6a2a, 0x5a5f66, 0x6a2a5a, 0xc8b89a, 0x1a3a3a, 0xb04a2a, 0xe8e2d4];
const GY = 0.71; // (the car's centre above the ground)

export class ParkedCars {
  constructor(g, spots) {
    this.g = g;
    const tpl = Object.create(Car.prototype);
    tpl.g = g; tpl.wheelPos = [[0.8, 1.36], [-0.8, 1.36], [0.8, -1.34], [-0.8, -1.34]];
    tpl.build(0xffffff);
    tpl.wheels.forEach((w, i) => w.g.position.set(tpl.wheelPos[i][0], -0.12 - 0.26, tpl.wheelPos[i][1]));
    tpl.group.updateMatrixWorld(true);
    this.cars = spots.map(([x, z, yaw], i) => ({ x, z, yaw, color: PAINTS[i % PAINTS.length], gone: false }));
    const N = this.cars.length, carM = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    this.parts = [];
    tpl.group.traverse((m) => {
      if (!m.isMesh) return;
      const im = new THREE.InstancedMesh(m.geometry, m.material, N);
      im.castShadow = m.castShadow; im.receiveShadow = true; im.frustumCulled = false;
      const local = m.matrixWorld.clone();
      this.cars.forEach((c, i) => { carM.compose(new THREE.Vector3(c.x, GY, c.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw), one); im.setMatrixAt(i, carM.clone().multiply(local)); });
      if (m.material === tpl.paint) { this.cars.forEach((c, i) => im.setColorAt(i, new THREE.Color(c.color))); }
      im.userData.dynamic = true; g.scene.add(im); this.parts.push(im);
    });
    // something solid to bump into
    for (const c of this.cars) {
      const qq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw);
      c.col = g.world.createCollider(g.R.ColliderDesc.cuboid(0.9, 0.62, 2.3).setTranslation(c.x, GY + 0.05, c.z).setRotation({ x: qq.x, y: qq.y, z: qq.z, w: qq.w }));
    }
  }

  nearest(p, maxD = 3.6) {
    let best = null, bd = maxD;
    for (const c of this.cars) { if (c.gone) continue; const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  // take it: the parked copy goes, a real one appears in its place
  take(c) {
    const g = this.g, i = this.cars.indexOf(c);
    c.gone = true;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const im of this.parts) { im.setMatrixAt(i, zero); im.instanceMatrix.needsUpdate = true; }
    g.world.removeCollider(c.col, true);
    const car = new Car(g, new THREE.Vector3(c.x, 0.03, c.z), c.yaw, c.color);
    g.cars.push(car);
    return car;
  }
}
