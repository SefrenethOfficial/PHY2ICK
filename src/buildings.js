// Buildings: a solid core with a proper facade on it. Framed windows with sills and lintels,
// shopfronts with awnings and signs, floor ledges, cornices, balconies and rooftop clutter.
// All the small parts are merged into a few big meshes (vertex-coloured), so a street of
// buildings costs only a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const FLOOR = 3.3, GROUND = 4.2;
const SHOPS = ['CORNER DELI', 'PHARMACY', 'LAUNDROMAT', 'PAWN & GOLD', 'BOOKS', 'NOODLE BAR', 'HARDWARE', 'BAKERY', 'BARBER', 'LIQUOR', 'DINER', 'PHONE REPAIR', 'FLOWERS', 'PIZZA', 'TATTOO', 'GROCER'];

function tex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const speckle = (c, w, h, n, a, size = 2) => { for (let i = 0; i < n; i++) { const v = Math.random() < 0.5 ? 0 : 255; c.fillStyle = `rgba(${v},${v},${v},${Math.random() * a})`; c.fillRect(Math.random() * w, Math.random() * h, size, size); } };

// wall materials (one texture repeat = `scale` metres)
function wallMaterials() {
  const brick = (base, mortar) => {
    const draw = (c, w, h, bump) => {
      c.fillStyle = bump ? '#555' : mortar; c.fillRect(0, 0, w, h);
      const bw = 64, bh = 20;
      for (let r = 0; r < h / bh; r++) for (let x = -(r % 2) * bw / 2; x < w; x += bw) {
        if (bump) { c.fillStyle = `rgb(${190 + Math.random() * 40},${190 + Math.random() * 40},${190 + Math.random() * 40})`; }
        else { const col = new THREE.Color(base).offsetHSL((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.09); c.fillStyle = '#' + col.getHexString(); }
        c.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
      }
      if (!bump) speckle(c, w, h, 5000, 0.12);
    };
    const map = tex(512, 512, (c, w, h) => draw(c, w, h, false));
    const bumpMap = tex(512, 512, (c, w, h) => draw(c, w, h, true), false);
    return { m: new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 1.6, roughness: 0.92 }), scale: 4 };
  };
  const stucco = (base) => {
    const map = tex(256, 256, (c, w, h) => { c.fillStyle = base; c.fillRect(0, 0, w, h); speckle(c, w, h, 9000, 0.07); for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(80,70,60,.05)'; c.fillRect(Math.random() * w, 0, 20 + Math.random() * 40, h); } });
    const bumpMap = tex(256, 256, (c, w, h) => { c.fillStyle = '#888'; c.fillRect(0, 0, w, h); speckle(c, w, h, 14000, 0.35); }, false);
    return { m: new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 0.6, roughness: 0.95 }), scale: 3 };
  };
  const concrete = (base) => {
    const draw = (c, w, h, bump) => {
      c.fillStyle = bump ? '#999' : base; c.fillRect(0, 0, w, h);
      if (!bump) { speckle(c, w, h, 7000, 0.1); for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(40,40,40,.06)'; c.fillRect(Math.random() * w, Math.random() * h * 0.6, 3 + Math.random() * 5, 40 + Math.random() * 120); } }
      c.fillStyle = bump ? '#333' : 'rgba(0,0,0,.35)'; c.fillRect(0, 0, w, 4); c.fillRect(0, 0, 4, h); // panel joints
    };
    const map = tex(256, 256, (c, w, h) => draw(c, w, h, false));
    const bumpMap = tex(256, 256, (c, w, h) => draw(c, w, h, true), false);
    return { m: new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 1.2, roughness: 0.9 }), scale: 3.3 };
  };
  const glassTower = () => {
    const map = tex(256, 256, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3d5a73'); gr.addColorStop(1, '#22384c'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = '#9aa4ad'; c.fillRect(0, 0, w, 10); c.fillRect(0, 0, 6, h); c.fillRect(w / 2 - 2, 0, 4, h);
      c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(8, 12, w / 2 - 12, h - 14);
    });
    return { m: new THREE.MeshStandardMaterial({ map, metalness: 0.85, roughness: 0.12 }), scale: 3.3, glass: true };
  };
  return {
    brick: [brick('#8e3b2a', '#b9b0a2'), brick('#a8573c', '#c9c0b0'), brick('#6e4636', '#a99e8e'), brick('#b9a07a', '#d6cfc0')],
    stucco: [stucco('#d8c9a8'), stucco('#c9b7a0'), stucco('#b9c4c9'), stucco('#d9b8a2'), stucco('#e2ddd2'), stucco('#f4f3ef'), stucco('#2a2a30'), stucco('#d9884a')],
    concrete: [concrete('#9a9893'), concrete('#b3aea4'), concrete('#7f8285')],
    glass: [glassTower()],
  };
}

// UVs in metres, so one material fits any size of wall
function worldUV(geo, scale) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const u = ny > 0.5 ? p.getX(i) : nx > 0.5 ? p.getZ(i) : p.getX(i);
    const v = ny > 0.5 ? p.getZ(i) : p.getY(i);
    uv.setXY(i, u / scale, v / scale);
  }
  uv.needsUpdate = true;
}

// all the small shop signs share one big texture (one material, one draw call between them)
class SignAtlas {
  constructor(cols = 8, rows = 48) {
    this.cw = 256; this.ch = 48; this.cols = cols; this.rows = rows; this.n = 0;
    const c = this.canvas = document.createElement('canvas'); c.width = this.cw * cols; c.height = this.ch * rows;
    this.ctx = c.getContext('2d');
    this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
  }
  add(text, bg, fg) {
    const i = this.n++ % (this.cols * this.rows), cx = (i % this.cols) * this.cw, cy = Math.floor(i / this.cols) * this.ch, x = this.ctx;
    x.fillStyle = bg; x.fillRect(cx, cy, this.cw, this.ch);
    x.fillStyle = fg; x.font = 'bold 30px "Arial Narrow", Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const fw = x.measureText(text).width; if (fw > this.cw - 14) x.font = `bold ${Math.floor(30 * (this.cw - 14) / fw)}px "Arial Narrow", Arial`;
    x.fillText(text, cx + this.cw / 2, cy + this.ch / 2 + 1);
    const W = this.canvas.width, H = this.canvas.height;
    return [cx / W, 1 - (cy + this.ch) / H, (cx + this.cw) / W, 1 - cy / H];
  }
}

// cheap facades for the infill: the windows are painted on (one texture per look), no geometry
function cheapWalls() {
  const pal = [['#b9a48a', '#2c3b47'], ['#8f9aa1', '#26323c'], ['#c7b9a4', '#3a4652'], ['#a35a43', '#2d3a44'], ['#d7d2c8', '#2f4a5e'], ['#6f7478', '#1f2a33'], ['#c4a46a', '#33424d'], ['#9a4a3a', '#2a3440'], ['#d9cbb4', '#3a4a58'], ['#7a8a8a', '#253038']];
  return pal.map(([wall, glass], k) => {
    const draw = (c, w, h, bump) => {
      c.fillStyle = bump ? '#888' : wall; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1600; i++) { const v = Math.random() < 0.5 ? 0 : 255; c.fillStyle = `rgba(${v},${v},${v},${Math.random() * (bump ? 0.3 : 0.08)})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      if (k % 3 === 0 && !bump) for (let r = 0; r < h; r += 8) { c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(0, r, w, 1); } // (brick courses)
      // two windows a bay, with frames and sills
      for (const wx of [14, 70]) {
        c.fillStyle = bump ? '#333' : '#e8e2d6'; c.fillRect(wx - 3, 30, 50, 66);
        c.fillStyle = bump ? '#222' : glass; c.fillRect(wx, 33, 44, 60);
        if (!bump) { c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(wx, 33, 44, 8); if (Math.random() < 0.3) { c.fillStyle = 'rgba(255,214,150,.35)'; c.fillRect(wx, 33, 44, 60); } }
        c.fillStyle = bump ? '#eee' : '#d8d2c6'; c.fillRect(wx - 5, 93, 54, 6);
      }
      c.fillStyle = bump ? '#555' : 'rgba(0,0,0,.18)'; c.fillRect(0, h - 4, w, 4);
    };
    const mk = (bump) => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; draw(cv.getContext('2d'), 128, 128, bump); const t = new THREE.CanvasTexture(cv); if (!bump) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
    return new THREE.MeshStandardMaterial({ map: mk(false), bumpMap: mk(true), bumpScale: 0.8, roughness: 0.88 });
  });
}
// UVs for a painted facade: one texture across one bay (3.2 m) and one floor (3.3 m)
function facadeUV(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    if (ny > 0.5) uv.setXY(i, p.getX(i) / 10, p.getZ(i) / 10);
    else uv.setXY(i, (nx > 0.5 ? p.getZ(i) : p.getX(i)) / 3.2, (p.getY(i) - 0.9) / 3.3);
  }
  uv.needsUpdate = true;
}

export class CityBuilder {
  constructor(g) {
    this.g = g;
    this.walls = wallMaterials();
    this.trim = []; this.glass = []; this.roof = [];
    this.signs = [];
    this.atlas = new SignAtlas(); this.atlasQuads = [];
    this.cheap = cheapWalls();
    this.rand = Math.random;
  }

  // a coloured box into one of the merge buckets
  box(bucket, w, h, d, x, y, z, color, rx = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx) g.rotateX(rx);
    g.translate(x, y, z); g.deleteAttribute('uv');
    const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    bucket.push(g);
  }
  cyl(bucket, r, h, x, y, z, color, seg = 12) {
    const g = new THREE.CylinderGeometry(r, r, h, seg); g.translate(x, y, z); g.deleteAttribute('uv');
    const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    bucket.push(g);
  }

  // a box placed on a face: (u along the face, y up, out from the face) → world
  faceBox(bucket, F, u, y, out, w, h, d, color, rx = 0) {
    const [x, z] = [F.cx + F.ux * u + F.nx * out, F.cz + F.uz * u + F.nz * out];
    if (Math.abs(F.nx) > 0.5) this.box(bucket, d, h, w, x, y, z, color, 0);
    else this.box(bucket, w, h, d, x, y, z, color, rx * (F.nz > 0 ? 1 : -1));
    if (rx && Math.abs(F.nx) > 0.5) { // (an awning on an east/west face: tilt it about z instead)
      const g = bucket.pop(); g.translate(-x, -y, -z); g.rotateZ(-rx * F.nx); g.translate(x, y, z); bucket.push(g);
    }
  }

  // style: 'brick' | 'stucco' | 'concrete' | 'glass'; shopFaces: which faces get shopfronts ('+z', '-z', '+x', '-x')
  building({ x, z, w, d, floors, style, shopFaces = [], skipFloors = 0, solid = true, collider = true, entrance = null, wallIndex = null, openFloors = 0, sign = null, signColors = null, entranceSign = '14', room = null }) {
    const g = this.g, R = g.R, r = this.rand;
    const H = GROUND + (floors - 1) * FLOOR;
    const set = this.walls[style], W = set[wallIndex ?? Math.floor(r() * set.length)];
    this.lastWall = W;
    const block = (x0, z0, x1, z1, y0, y1) => { // a solid piece of the building
      const bw = x1 - x0, bd = z1 - z0, bh = y1 - y0; if (bw < 0.05 || bd < 0.05 || bh < 0.05) return;
      if (solid) { const geo = new THREE.BoxGeometry(bw, bh, bd); geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); worldUV(geo, W.scale); const m = new THREE.Mesh(geo, W.m); m.castShadow = m.receiveShadow = true; g.scene.add(m); }
      if (collider) g.world.createCollider(R.ColliderDesc.cuboid(bw / 2, bh / 2, bd / 2).setTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    };
    const X0 = x - w / 2, X1 = x + w / 2, Z0 = z - d / 2, Z1 = z + d / 2;
    if (room) { // a room behind the front wall: solid behind it and above it
      const D = room.depth, top = room.floors > 1 ? GROUND + (room.floors - 1) * FLOOR : GROUND;
      // the room's width along the face (centred; the rest of the ground floor is solid)
      const alongX = room.face === '+z' || room.face === '-z', faceLen = alongX ? w : d, RWd = Math.min(faceLen, room.width || faceLen), c = alongX ? x : z;
      const a0 = c - RWd / 2, a1 = c + RWd / 2;
      const rr = { '+z': [a0, Z1 - D, a1, Z1], '-z': [a0, Z0, a1, Z0 + D], '+x': [X1 - D, a0, X1, a1], '-x': [X0, a0, X0 + D, a1] }[room.face];
      const back = { '+z': [X0, Z0, X1, Z1 - D], '-z': [X0, Z0 + D, X1, Z1], '+x': [X0, Z0, X1 - D, Z1], '-x': [X0 + D, Z0, X1, Z1] }[room.face];
      block(...back, 0, H); block(...rr, top, H);
      if (RWd < faceLen - 0.1) { // the solid bits either side of the room
        if (alongX) { block(X0, rr[1], a0, rr[3], 0, H); block(a1, rr[1], X1, rr[3], 0, H); }
        else { block(rr[0], Z0, rr[2], a0, 0, H); block(rr[0], a1, rr[2], Z1, 0, H); }
      }
      room.rect = rr; room.top = top; room.wall = W;
    } else block(X0, Z0, X1, Z1, 0, H);
    const glassTower = style === 'glass';
    const trimC = { brick: [0xe9e4da, 0xd6cfc2, 0x2e2c2a], stucco: [0xf3efe6, 0x8a6a4a, 0x5c6a72], concrete: [0x55595d, 0xc8c4bc, 0x3a3d40], glass: [0x8a939b] }[style];
    const frameC = trimC[Math.floor(r() * trimC.length)];
    const faces = [
      { key: '+z', cx: x, cz: z + d / 2, nx: 0, nz: 1, ux: 1, uz: 0, len: w },
      { key: '-z', cx: x, cz: z - d / 2, nx: 0, nz: -1, ux: -1, uz: 0, len: w },
      { key: '+x', cx: x + w / 2, cz: z, nx: 1, nz: 0, ux: 0, uz: -1, len: d },
      { key: '-x', cx: x - w / 2, cz: z, nx: -1, nz: 0, ux: 0, uz: 1, len: d },
    ];
    const T = this.trim, G = this.glass;
    const litChance = 0.18;
    for (const F of faces) {
      const shop = shopFaces.includes(F.key) && !glassTower;
      const roomHere = room && room.face === F.key; // (that face's ground floor is real: interior.js builds it)
      const bays = Math.max(1, Math.floor((F.len - 1) / 3.1)), bayW = (F.len - 1) / bays;
      // ground floor
      if (shop && roomHere) {
        const sw = F.len - 1.6;
        const awnC = [0x7a2a24, 0x24506e, 0x2d5a3a, 0x6e5a24, 0x3a3a3a][Math.floor(r() * 5)];
        this.faceBox(T, F, 0, 3.55, 0.75, sw, 0.07, 1.5, awnC, 0.32);
        this.faceBox(T, F, 0, 3.27, 1.45, sw, 0.3, 0.04, awnC);
        this.signs.push({ F, u: 0, y: 3.4, out: 1.49, h: 0.62, w: Math.min(sw * 0.8, Math.max(4, (sign ?? 'SHOP NAME HERE').length * 0.36 + 1)), name: sign ?? SHOPS[Math.floor(r() * SHOPS.length)], colors: signColors }); // (on the front of the awning: clear of the roof, the windows and the awning itself)
      } else if (shop) {
        const sw = F.len - 1.6;
        this.faceBox(G, F, 0, 1.75, 0.03, sw, 2.7, 0.04, 0x5a6a74);
        this.faceBox(T, F, 0, 3.17, 0.06, sw + 0.2, 0.14, 0.12, 0x2b2b2b);
        this.faceBox(T, F, 0, 0.3, 0.06, sw + 0.2, 0.6, 0.12, 0x2b2b2b);
        for (let i = 0; i <= 3; i++) this.faceBox(T, F, -sw / 2 + (i / 3) * sw, 1.75, 0.07, 0.1, 2.7, 0.1, 0x2b2b2b);
        const doorU = -sw / 2 + sw * 0.18;
        this.faceBox(T, F, doorU, 1.2, 0.08, 1.1, 2.3, 0.06, 0x3a2a20);
        // awning
        const awnC = [0x7a2a24, 0x24506e, 0x2d5a3a, 0x6e5a24, 0x3a3a3a][Math.floor(r() * 5)];
        this.faceBox(T, F, 0, 3.55, 0.75, sw, 0.07, 1.5, awnC, 0.32);
        this.faceBox(T, F, 0, 3.27, 1.45, sw, 0.3, 0.04, awnC);
        // the sign
        this.signs.push({ F, u: 0, y: 3.4, out: 1.49, h: 0.62, w: Math.min(sw * 0.8, Math.max(4, (sign ?? 'SHOP NAME HERE').length * 0.36 + 1)), name: sign ?? SHOPS[Math.floor(r() * SHOPS.length)], colors: signColors }); // (on the front of the awning: clear of the roof, the windows and the awning itself)
      }
      if (entrance === F.key) { // a front door with a canopy and a number
        if (!roomHere) { this.faceBox(T, F, 0, 2.62, 0.06, 2.0, 0.16, 0.14, frameC); for (const sx of [-1, 1]) this.faceBox(T, F, sx * 0.92, 1.3, 0.06, 0.16, 2.6, 0.14, frameC); }
        this.faceBox(T, F, 0, 3.05, 0.7, 3.2, 0.12, 1.4, 0x2b2d30);
        this.signs.push({ F, u: entranceSign.length > 3 ? 0 : 1.9, y: entranceSign.length > 3 ? 3.4 : 2.3, w: entranceSign.length > 3 ? Math.min(F.len - 2, entranceSign.length * 0.45) : 0.7, name: entranceSign, plain: true });
      }
      if (glassTower) {
        // a lobby band of darker glass and a canopy
        this.faceBox(T, F, 0, GROUND - 0.15, 0.25, F.len, 0.3, 0.5, 0x3a3d40);
      }
      // upper floors (and the ground floor where there's no shop)
      for (let fl = (shop ? 1 : 0) + skipFloors * 0; fl < floors; fl++) {
        if (fl < skipFloors) continue;
        if (glassTower) continue;
        if (roomHere && fl < (room.floors || 1)) continue;
        const y0 = fl === 0 ? 0 : GROUND + (fl - 1) * FLOOR;
        const ww = style === 'concrete' ? bayW - 0.5 : 1.3, wh = fl === 0 ? 2.0 : 1.75;
        const sillY = y0 + (fl === 0 ? 1.0 : 0.95);
        for (let b = 0; b < bays; b++) {
          const u = -F.len / 2 + 0.5 + (b + 0.5) * bayW;
          if (entrance === F.key && fl === 0 && Math.abs(u) < 1.9) continue;
          this.windows?.push({ F, u, y0: sillY, w: ww, h: wh, fl });
          const lit = r() < litChance;
          if (!(entrance === F.key && fl < openFloors)) this.faceBox(G, F, u, sillY + wh / 2, 0.02, ww, wh, 0.03, lit ? 0x8c7650 : (r() < 0.5 ? 0x24323d : 0x2c3b47)); // (real openings get real glass)
          // frame, mullion, sill, lintel
          this.faceBox(T, F, u, sillY + wh / 2, 0.06, ww + 0.16, 0.08, 0.1, frameC);
          this.faceBox(T, F, u, sillY + wh + 0.04, 0.06, ww + 0.16, 0.08, 0.1, frameC);
          this.faceBox(T, F, u - ww / 2 - 0.04, sillY + wh / 2, 0.06, 0.08, wh + 0.08, 0.1, frameC);
          this.faceBox(T, F, u + ww / 2 + 0.04, sillY + wh / 2, 0.06, 0.08, wh + 0.08, 0.1, frameC);
          if (style !== 'concrete') this.faceBox(T, F, u, sillY + wh / 2, 0.05, 0.05, wh, 0.06, frameC);
          this.faceBox(T, F, u, sillY - 0.05, 0.12, ww + 0.3, 0.08, 0.24, style === 'brick' ? 0xd8d2c6 : frameC);
          if (style === 'brick') this.faceBox(T, F, u, sillY + wh + 0.2, 0.05, ww + 0.36, 0.22, 0.1, 0xcfc8ba);
          // balconies on stucco buildings, now and then
          if (style === 'stucco' && fl > 0 && r() < 0.28) {
            const bw = ww + 0.9;
            this.faceBox(T, F, u, sillY - 0.95, 0.55, bw, 0.12, 1.1, 0xd8d2c6);
            this.faceBox(T, F, u, sillY - 0.4, 1.08, bw, 0.05, 0.05, 0x2b2d30);
            for (let k = 0; k <= 6; k++) this.faceBox(T, F, u - bw / 2 + (k / 6) * bw, sillY - 0.65, 1.08, 0.03, 0.5, 0.03, 0x2b2d30);
          }
        }
      }
      // ledges at each floor line (brick and concrete)
      if (style !== 'stucco' && !glassTower) for (let fl = 1; fl < floors; fl++) this.faceBox(T, F, 0, GROUND + (fl - 1) * FLOOR - 0.05, 0.06, F.len + 0.12, 0.12, 0.12, style === 'brick' ? 0xcfc8ba : 0x6a6d70);
      // cornice
      this.faceBox(T, F, 0, H + 0.1, 0.18, F.len + 0.36, 0.3, 0.36, glassTower ? 0x5a6066 : style === 'brick' ? 0xcfc8ba : 0xbdb6aa);
      this.faceBox(T, F, 0, H + 0.45, 0.02, F.len + 0.04, 0.6, 0.2, glassTower ? 0x5a6066 : 0x8a8580);
    }
    // the roof: a parapet's inside, plus clutter
    this.box(this.roof, w - 0.2, 0.05, d - 0.2, x, H + 0.03, z, 0x4a4b4d);
    const ac = 1 + Math.floor(r() * 3);
    for (let i = 0; i < ac; i++) {
      const ax = x + (r() - 0.5) * (w - 4), az = z + (r() - 0.5) * (d - 4);
      this.box(this.roof, 1.4, 0.9, 1.0, ax, H + 0.5, az, 0xb8bcbf);
      this.cyl(this.roof, 0.35, 0.05, ax, H + 0.98, az, 0x3a3d40, 16);
    }
    if (r() < 0.45 && !glassTower) { // a water tank on legs
      const tx = x + (r() - 0.5) * (w - 6), tz = z + (r() - 0.5) * (d - 6);
      for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) this.box(this.roof, 0.12, 2, 0.12, tx + dx, H + 1, tz + dz, 0x3a3027);
      this.cyl(this.roof, 1.3, 2.4, tx, H + 3.2, tz, 0x6b5440, 14);
      const capG = new THREE.ConeGeometry(1.35, 0.6, 14); capG.translate(tx, H + 4.7, tz); capG.deleteAttribute('uv');
      const n = capG.attributes.position.count, col = new Float32Array(n * 3).fill(0.25); capG.setAttribute('color', new THREE.BufferAttribute(col, 3)); this.roof.push(capG);
    }
    if (r() < 0.5) this.box(this.roof, 2.6, 2.4, 2.4, x + (r() - 0.5) * (w - 5), H + 1.2, z + (r() - 0.5) * (d - 5), 0x9a958c); // stair housing
    return H;
  }

  // a quick building for filling in the city: painted windows, a cornice, a roof, maybe a shop
  infill({ x, z, w, d, floors, face = null, shop = null }) {
    const g = this.g, R = g.R, r = this.rand;
    const H = 4.2 + (floors - 1) * 3.3;
    const geo = new THREE.BoxGeometry(w, H, d); geo.translate(x, H / 2, z); facadeUV(geo);
    const mat = this.cheap[Math.floor(r() * this.cheap.length)];
    const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; g.scene.add(m);
    g.world.createCollider(R.ColliderDesc.cuboid(w / 2, H / 2, d / 2).setTranslation(x, H / 2, z));
    const T = this.trim, G = this.glass;
    const tc = [0xd8d2c6, 0x8a8580, 0x5a5d60, 0xcfc8ba][Math.floor(r() * 4)];
    this.box(T, w + 0.5, 0.45, d + 0.5, x, H + 0.05, z, tc);       // cornice
    this.box(this.roof, w - 0.2, 0.05, d - 0.2, x, H + 0.3, z, 0x4a4b4d);
    if (r() < 0.6) this.box(this.roof, 1.4, 0.9, 1.0, x + (r() - 0.5) * (w - 3), H + 0.75, z + (r() - 0.5) * (d - 3), 0xb8bcbf);
    if (r() < 0.25 && floors > 3) { const tx = x + (r() - 0.5) * (w - 4), tz = z + (r() - 0.5) * (d - 4); this.cyl(this.roof, 1.1, 2, tx, H + 2.3, tz, 0x6b5440, 12); for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) this.box(this.roof, 0.1, 1.6, 0.1, tx + dx, H + 1.1, tz + dz, 0x3a3027); }
    if (face) {
      const F = { '+z': { cx: x, cz: z + d / 2, nx: 0, nz: 1, ux: 1, uz: 0, len: w }, '-z': { cx: x, cz: z - d / 2, nx: 0, nz: -1, ux: -1, uz: 0, len: w }, '+x': { cx: x + w / 2, cz: z, nx: 1, nz: 0, ux: 0, uz: -1, len: d }, '-x': { cx: x - w / 2, cz: z, nx: -1, nz: 0, ux: 0, uz: 1, len: d } }[face];
      if (shop) {
        const sw = F.len - 1.4;
        this.faceBox(G, F, 0, 1.6, 0.03, sw, 2.6, 0.04, 0x5a6a74);
        this.faceBox(T, F, 0, 3.0, 0.06, sw + 0.2, 0.14, 0.12, 0x2b2b2b);
        this.faceBox(T, F, -sw * 0.32, 1.15, 0.08, 1.0, 2.2, 0.06, 0x3a2a20);
        const awnC = [0x7a2a24, 0x24506e, 0x2d5a3a, 0x6e5a24, 0x3a3a3a, 0x5a2a5a][Math.floor(r() * 6)];
        this.faceBox(T, F, 0, 3.4, 0.7, sw, 0.07, 1.4, awnC, 0.32);
        // the sign, from the atlas
        const bgs = ['#1d2a38', '#2b1d1d', '#f1ebe0', '#1f3324', '#3a2f1d', '#2a2a30'], bg = bgs[Math.floor(r() * bgs.length)];
        const uv = this.atlas.add(shop, bg, bg === '#f1ebe0' ? '#7a2a24' : '#f1dfa8');
        const sw2 = Math.min(sw * 0.75, 3.4), sh = sw2 * 48 / 256;
        const cx = F.cx + F.nx * 1.43, cz = F.cz + F.nz * 1.43, y = 3.3 + sh / 2 - 0.12; // (standing on the awning's front edge)
        const ux = F.ux, uz = F.uz;
        const pts = [[cx - ux * sw2 / 2, y - sh / 2, cz - uz * sw2 / 2], [cx + ux * sw2 / 2, y - sh / 2, cz + uz * sw2 / 2], [cx + ux * sw2 / 2, y + sh / 2, cz + uz * sw2 / 2], [cx - ux * sw2 / 2, y + sh / 2, cz - uz * sw2 / 2]];
        this.atlasQuads.push({ pts, uv });
      }
    }
    return H;
  }

  finish() {
    if (this.atlasQuads.length) { // every atlas sign in one mesh
      const pos = [], uvs = [], nor = [];
      for (const { pts, uv: [u0, v0, u1, v1] } of this.atlasQuads) {
        const [a, b, c, d] = pts, nrm = new THREE.Vector3().crossVectors(new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), new THREE.Vector3(...d).sub(new THREE.Vector3(...a))).normalize();
        for (const [p, t] of [[a, [u0, v0]], [b, [u1, v0]], [c, [u1, v1]], [a, [u0, v0]], [c, [u1, v1]], [d, [u0, v1]]]) { pos.push(...p); uvs.push(...t); nor.push(nrm.x, nrm.y, nrm.z); }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      this.atlas.tex.needsUpdate = true;
      this.g.scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this.atlas.tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: this.atlas.tex, emissiveIntensity: 0.12 })));
    }
    const g = this.g;
    const mk = (bucket, mat, shadow = true) => {
      if (!bucket.length) return;
      const geo = mergeGeometries(bucket, false);
      const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; g.scene.add(m);
    };
    mk(this.trim, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
    mk(this.roof, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    mk(this.glass, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.55, emissive: 0x151a1e }), false);
    // shop signs (each its own little texture)
    for (const s of this.signs) {
      const sh = s.h ?? s.w * 96 / 512, cw = Math.min(1024, Math.max(256, Math.round(96 * s.w / sh / 32) * 32));
      const t = tex(cw, 96, (c, w, h) => {
        const bgs = ['#1d2a38', '#2b1d1d', '#f1ebe0', '#1f3324', '#3a2f1d'], bg = s.colors?.[0] ?? (s.plain ? '#e9e4da' : bgs[Math.floor(Math.random() * bgs.length)]);
        c.fillStyle = bg; c.fillRect(0, 0, w, h);
        c.fillStyle = s.colors?.[1] ?? (bg === '#f1ebe0' || s.plain ? '#7a2a24' : '#f1dfa8'); c.font = 'bold 56px "Arial Narrow", Arial'; const fw = c.measureText(s.name).width; if (fw > w - 32) c.font = `bold ${Math.floor(56 * (w - 32) / fw)}px "Arial Narrow", Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s.name, w / 2, h / 2 + 3);
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, sh), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.15 }));
      const F = s.F;
      const out = s.out ?? 0.09; m.position.set(F.cx + F.ux * s.u + F.nx * out, s.y, F.cz + F.uz * s.u + F.nz * out);
      m.rotation.y = Math.atan2(F.nx, F.nz);
      g.scene.add(m);
    }
  }
}

export { FLOOR, GROUND, worldUV };
