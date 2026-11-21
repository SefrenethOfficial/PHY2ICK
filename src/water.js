// The sea: a big sheet that follows the camera, with gentle rolling waves, two layers of ripples
// sliding across each other, and the sky reflected in it (more at a glancing angle, like real water).
import * as THREE from 'three';

export function makeWater(g, level) {
  // a ripple normal map, drawn once
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N);
  const h = (i, j) => { let v = 0; for (const [fx, fy, a, ph] of [[3, 2, 1, 0.3], [5, -4, 0.6, 1.1], [-7, 6, 0.4, 2.3], [11, 9, 0.25, 0.7], [-13, -15, 0.18, 1.9], [17, -6, 0.12, 2.8]]) v += a * Math.sin((i * fx + j * fy) * Math.PI * 2 / N + ph); return v; };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const dx = h(i + 1, j) - h(i - 1, j), dy = h(i, j + 1) - h(i, j - 1), k = (j * N + i) * 4; img.data[k] = 128 - dx * 70; img.data[k + 1] = 128 - dy * 70; img.data[k + 2] = 255; img.data[k + 3] = 255; }
  x.putImageData(img, 0, 0);
  const norm = new THREE.CanvasTexture(c); norm.wrapS = norm.wrapT = THREE.RepeatWrapping;
  const time = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({ color: 0x0f5068, roughness: 0.07, metalness: 0.0, transparent: true, opacity: 0.93, envMapIntensity: 0.65, side: THREE.DoubleSide }); // (two-sided: it's the ceiling when you're under it)
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time; sh.uniforms.uNorm = { value: norm };
    sh.vertexShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp0 = modelMatrix * vec4(transformed, 1.0);
      transformed.y += sin(wp0.x * 0.08 + uTime * 1.1) * 0.1 + sin(wp0.z * 0.11 + uTime * 0.8) * 0.08 + sin((wp0.x + wp0.z) * 0.21 + uTime * 1.7) * 0.04;
      vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = 'uniform float uTime;\nuniform sampler2D uNorm;\nvarying vec3 vWPos;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `
      vec2 wp = vWPos.xz;
      vec3 na = texture2D(uNorm, wp * 0.045 + vec2(uTime * 0.021, uTime * 0.013)).xyz * 2.0 - 1.0;
      vec3 nb = texture2D(uNorm, wp * 0.012 - vec2(uTime * 0.008, -uTime * 0.011)).xyz * 2.0 - 1.0;
      float sx = cos(wp.x * 0.08 + uTime * 1.1) * 0.008 + cos((wp.x + wp.y) * 0.21 + uTime * 1.7) * 0.0084;
      float sz = cos(wp.y * 0.11 + uTime * 0.8) * 0.0088 + cos((wp.x + wp.y) * 0.21 + uTime * 1.7) * 0.0084;
      vec3 nW = normalize(vec3(-(na.x * 0.6 + nb.x) * 0.32 - sx * 5.0, 1.0, -(na.y * 0.6 + nb.y) * 0.32 - sz * 5.0));
      normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);`);
  };
  const geo = new THREE.PlaneGeometry(1200, 1200, 100, 100); geo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geo, mat);
  water.position.y = level; water.receiveShadow = true; water.userData.dynamic = true; water.frustumCulled = false;
  g.scene.add(water);
  // beyond it, out to the horizon: flat
  const far = new THREE.Mesh(new THREE.RingGeometry(590, 6000, 48, 1), new THREE.MeshStandardMaterial({ color: 0x1a6680, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.92, side: THREE.DoubleSide }));
  far.rotation.x = -Math.PI / 2; far.position.y = level - 0.02; far.userData.dynamic = true; g.scene.add(far);
  return {
    mesh: water,
    update(dt, cam) {
      time.value += dt;
      water.position.x = Math.round(cam.position.x / 12) * 12; water.position.z = Math.round(cam.position.z / 12) * 12; // (snapped to the grid, so the waves stay put)
      far.position.x = water.position.x; far.position.z = water.position.z;
    },
  };
}
