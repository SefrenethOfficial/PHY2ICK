// Merge everything that never moves into a few big meshes (one per material), so the city costs
// a few hundred draw calls instead of thousands. Anything marked userData.dynamic is left alone.
// bakeStatic(root): merges the meshes under root, in root's own space (works for a car's body too).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// materials that look the same count as the same (lots of them are made separately)
const keyOf = new WeakMap();
function matKey(m) {
  if (keyOf.has(m)) return keyOf.get(m);
  const c = (x) => (x && x.isColor ? x.getHexString() : '');
  const k = [m.type, c(m.color), c(m.emissive), m.emissiveIntensity, m.roughness, m.metalness, m.map?.uuid, m.bumpMap?.uuid, m.normalMap?.uuid, m.emissiveMap?.uuid, m.transparent, m.opacity, m.side, m.vertexColors, m.flatShading, m.polygonOffset, m.clearcoat, m.depthWrite].join(',');
  keyOf.set(m, k); return k;
}

export function bakeStatic(root, skip = new Set()) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(), victims = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    for (let p = o; p && p !== root.parent; p = p.parent) if (p.userData.dynamic || skip.has(p)) return;
    if (o.material.transparent && o.material.depthWrite === false) return; // (glass and decals: order matters; leave them)
    const g = o.geometry;
    const sig = [matKey(o.material), o.castShadow, o.receiveShadow, !!g.index, Object.keys(g.attributes).filter(k => ['position', 'normal', 'uv', 'color'].includes(k)).sort().join(',')].join('|');
    if (!buckets.has(sig)) buckets.set(sig, []);
    buckets.get(sig).push(o);
  });
  let merged = 0;
  const M = new THREE.Matrix4();
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geos = list.map((o) => { const g = o.geometry.clone(); g.applyMatrix4(M.multiplyMatrices(inv, o.matrixWorld)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k); g.morphAttributes = {}; g.clearGroups(); return g; });
    let geo;
    try { geo = mergeGeometries(geos, false); } catch { geo = null; }
    if (!geo) continue;
    const m = new THREE.Mesh(geo, list[0].material);
    m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow;
    root.add(m);
    for (const o of list) victims.push(o);
    merged += list.length;
  }
  for (const o of victims) o.removeFromParent();
  return merged;
}
