// Cars parked along the kerbs: drawn in bulk (one instanced copy of each part of the car, with the
// paint colour per car), with a plain box to bump into. Get in one and it turns into a real car.
import * as THREE from 'three';
import { Car } from './car.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
    // a parked car never moves a part: boil the template down to three meshes (paint, glass, and
    // everything else with its colour painted onto the vertices), so each batch is three draws
    const bucket = { paint: [], glass: [], rest: [] }; let glassM = null;
    tpl.group.traverse((m) => {
      if (!m.isMesh || !m.visible) return;
      const mat = m.material; if (Array.isArray(mat)) return;
      let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); geo.applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      if (mat === tpl.paint) bucket.paint.push(geo);
      else if (mat.transparent) { glassM = glassM || mat; bucket.glass.push(geo); }
      else { const c = (mat.color ? mat.color.clone() : new THREE.Color(0x888888)); if (mat.emissive && mat.emissiveIntensity > 0.3) c.add(mat.emissive.clone().multiplyScalar(0.6));
        const n = geo.attributes.position.count, cl = new Float32Array(n * 3); for (let k = 0; k < n; k++) { cl[k * 3] = c.r; cl[k * 3 + 1] = c.g; cl[k * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); bucket.rest.push(geo); }
    });
    const restM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 });
    const paintM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0.5 }); // (cheaper than the driven cars' clearcoat)
    if (glassM) glassM = new THREE.MeshStandardMaterial({ color: glassM.color, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
    const meshes = [[bucket.paint, paintM], [bucket.rest, restM], [bucket.glass, glassM]].filter(([l, m]) => l.length && m).map(([l, mat]) => { const mm = new THREE.Mesh(mergeGeometries(l, false), mat); mm.castShadow = mat !== glassM; return mm; });
    this.cars = spots.map(([x, z, yaw], i) => ({ x, z, yaw, color: PAINTS[i % PAINTS.length], gone: false, locked: Math.random() < 0.5 })); // (half of them locked: smash a window)
    // drawn in neighbourhood-sized batches, so the ones off screen (or out of the sun's shadow box) are skipped whole
    const carM = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), CELL = 110;
    const cells = new Map();
    this.cars.forEach((c) => { const k = Math.floor(c.x / CELL) + ',' + Math.floor(c.z / CELL); if (!cells.has(k)) cells.set(k, []); const cell = cells.get(k); c.cell = cell; c.idx = cell.length; cell.push(c); });
    for (const cell of cells.values()) {
      cell.parts = [];
      for (const m of meshes) {
        const im = new THREE.InstancedMesh(m.geometry, m.material, cell.length);
        im.castShadow = m.castShadow; im.receiveShadow = true;
        cell.forEach((c, i) => { carM.compose(new THREE.Vector3(c.x, GY, c.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw), one); im.setMatrixAt(i, carM.clone()); });
        if (m.material === paintM) cell.forEach((c, i) => im.setColorAt(i, new THREE.Color(c.color)));
        im.computeBoundingSphere(); im.userData.dynamic = true; g.scene.add(im); cell.parts.push(im);
      }
    }
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
    const g = this.g;
    c.gone = true;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const im of c.cell.parts) { im.setMatrixAt(c.idx, zero); im.instanceMatrix.needsUpdate = true; }
    g.world.removeCollider(c.col, true);
    const car = new Car(g, new THREE.Vector3(c.x, 0.03, c.z), c.yaw, c.color);
    car.locked = c.locked;
    g.cars.push(car);
    return car;
  }
}
