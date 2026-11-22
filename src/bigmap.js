// The full map (M): the whole island, the causeway and the Dry, north up. Scroll to zoom, drag or WASD to move.
// Places of interest drawn as little icons by kind (food, shops, services, places, yours, people, the job);
// click one to put a waypoint on it (click it again to clear it). The legend down the side hides a kind.
// The same icons, smaller, show on the minimap round you. The game holds still while the map's open.
import { DOCK } from './desert.js';

const el = (id) => document.getElementById(id);

export const KINDS = {
  food:    { name: 'Food & drink', col: '#ff9f43' },
  shop:    { name: 'Shops',        col: '#5fd0ff' },
  service: { name: 'Services',     col: '#7be08a' },
  place:   { name: 'Places',       col: '#c9a0ff' },
  you:     { name: 'Yours',        col: '#ffd23f' },
  people:  { name: 'People',       col: '#ff6a9a' },
  job:     { name: 'The job',      col: '#ff5a3a' },
};
// what each of the city's places is (by its key in g.places); anything not here isn't shown
const PLACE_KIND = {
  'city wok': 'food', 'shitty wok': 'food', 'the coffee store': 'food', 'the diner': 'food', 'albuquerque boiled turkey': 'food',
  'game shop': 'shop', 'home improvements': 'shop', 'home improvements 2': 'shop', 'triangle and co.': 'shop', "grace's flowers": 'shop', 'a rival mini mart': 'shop',
  'the shops': 'shop', 'mini mart': 'shop', 'pawn shop': 'shop', 'grocery': 'shop', 'convenience store': 'shop', 'halyard arms': 'shop',
  'the hospital': 'service', 'the police station': 'service', "rusty's": 'service', 'spa': 'service', 'the indoor pool': 'service', 'beach reception': 'service',
  'paul badfella, the law firm': 'service', "putin's ritz": 'service',
  'the skatepark': 'place', 'the park': 'place', 'the playground': 'place', 'the fountain': 'place', 'the nightclub': 'place', 'the bourke office high rise': 'place',
  'the little park': 'place', 'town square': 'place', 'the construction site': 'place', 'the abandoned car park': 'place', 'the beach washrooms': 'place',
  'beach': 'place', 'pier': 'place', 'willow bank': 'place', 'the sewer entrance': 'place', 'the vegetable plot': 'place', 'cheap house': 'place',
};
const title = (s) => s.replace(/(^|\s)([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/^The /, 'The ');

// a small icon: a coloured disc with a white glyph (drawn, so it looks the same everywhere)
export function drawIcon(x, kind, glyph, px, py, r, hot) {
  const k = KINDS[kind];
  x.save(); x.translate(px, py);
  x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.arc(0, r * 0.15, r * 1.08, 0, 7); x.fill();
  x.fillStyle = k.col; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill();
  x.lineWidth = Math.max(1, r * 0.16); x.strokeStyle = hot ? '#fff' : 'rgba(0,0,0,.55)'; x.stroke();
  x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineWidth = Math.max(1, r * 0.14); x.lineCap = 'round'; x.lineJoin = 'round';
  const s = r * 0.55;
  x.beginPath();
  switch (glyph) {
    case 'food': x.arc(0, -s * 0.1, s * 0.75, Math.PI, 0); x.closePath(); x.fill(); x.fillRect(-s * 0.75, s * 0.15, s * 1.5, s * 0.22); x.fillRect(-s * 0.7, s * 0.5, s * 1.4, s * 0.3); break; // (a burger)
    case 'shop': x.fillRect(-s * 0.7, -s * 0.25, s * 1.4, s * 1.05); x.beginPath(); x.arc(0, -s * 0.25, s * 0.38, Math.PI, 0); x.stroke(); break; // (a bag)
    case 'service': x.fillRect(-s * 0.22, -s * 0.8, s * 0.44, s * 1.6); x.fillRect(-s * 0.8, -s * 0.22, s * 1.6, s * 0.44); break; // (a cross)
    case 'place': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? s * 0.38 : s * 0.9; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); x.fill(); break; // (a star)
    case 'home': x.moveTo(0, -s * 0.85); x.lineTo(s * 0.85, -s * 0.05); x.lineTo(s * 0.6, -s * 0.05); x.lineTo(s * 0.6, s * 0.75); x.lineTo(-s * 0.6, s * 0.75); x.lineTo(-s * 0.6, -s * 0.05); x.lineTo(-s * 0.85, -s * 0.05); x.closePath(); x.fill(); break;
    case 'van': x.fillRect(-s * 0.85, -s * 0.45, s * 1.1, s * 0.85); x.fillRect(s * 0.25, -s * 0.05, s * 0.6, s * 0.45); x.fillStyle = k.col; x.beginPath(); x.arc(-s * 0.45, s * 0.45, s * 0.2, 0, 7); x.arc(s * 0.5, s * 0.45, s * 0.2, 0, 7); x.fill(); break;
    default: x.font = `bold ${Math.round(r * 1.15)}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(glyph, 0, r * 0.06); // (a letter: W, $, !)
  }
  x.restore();
}

export class BigMap {
  constructor(g) {
    this.g = g; this.open = false; this.hide = new Set();
    this.cx = 0; this.cz = 0; this.s = 0.5; // (centre, in world metres; screen px per metre)
    this.held = new Set(); this.drag = null; this.hot = null;
    this.c = el('bigmapC'); this.x = this.c.getContext('2d');
    this.c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
    this.c.addEventListener('mousedown', (e) => { this.drag = { x: e.clientX, y: e.clientY, cx: this.cx, cz: this.cz, moved: false }; });
    addEventListener('mousemove', (e) => {
      if (!this.open) return;
      if (this.drag) { const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; if (Math.hypot(dx, dy) > 4) this.drag.moved = true; this.cx = this.drag.cx - dx / this.s; this.cz = this.drag.cz - dy / this.s; this.clamp(); }
      const r = this.c.getBoundingClientRect(); this.mouse = [e.clientX - r.left, e.clientY - r.top];
    });
    addEventListener('mouseup', (e) => { if (!this.open || !this.drag) return; const d = this.drag; this.drag = null; if (!d.moved && e.target === this.c) this.click(); });
    addEventListener('keyup', (e) => this.held.delete(e.code));
  }

  // ---- what's on it
  pois() {
    const g = this.g, out = [], add = (kind, glyph, name, pos, extra = {}) => { if (pos) out.push({ kind, glyph, name, x: pos.x, z: pos.z, ...extra }); };
    for (const [k, p] of Object.entries(g.places || {})) { const kind = PLACE_KIND[k]; if (kind) add(kind, kind, title(p.name), p.pos); }
    if (g.marcos?.door) add('food', 'food', 'MARCOS', g.marcos.door);
    add('place', 'place', 'North Quay', { x: (DOCK.x0 + DOCK.x1) / 2 - 80, z: (DOCK.z0 + DOCK.z1) / 2 });
    if (g.missions) add('place', 'place', 'Saltline Apartments', g.missions.home);
    const home = g.places?.['fairview heights']; if (home) add('you', 'home', 'Home · Fairview Heights 1E', home.pos, { always: true });
    if (g.wrenHouse) add('people', 'home', "Wren's house", g.wrenHouse.door, { always: true });
    if (g.camper && !g.camper.wrecked) add('you', 'van', "Kit's van", g.camper.pos, { always: true });
    const W = g.wren; if (W?.alive && W.n && !W.n.following && W.n.state !== 'seated') add('people', 'W', 'Wren', g.citizens.pos(W.n), { always: true });
    for (const n of g.dealers?.list || []) if (g.citizens.list.includes(n) && n.state !== 'dead') add('people', '$', `${n.name} · dealer`, g.citizens.pos(n));
    if (g.missions?.id === 'rivals') add('job', '!', 'Saltline: see Royce', g.missions.home, { always: true });
    if (g.waypoint) add('job', '!', 'Waypoint: ' + g.waypoint.name, g.waypoint.pos, { always: true, wp: true });
    return out;
  }

  // ---- open / close
  show() {
    const g = this.g; if (this.open) return;
    if (!g.hud.mapC) g.hud.buildMap();
    const p = g.player.car ? g.player.car.pos : g.van?.inside && g.camper ? g.camper.pos : g.player.pos;
    this.cx = p.x; this.cz = p.z; this.s = 0.55; this.open = true; this.held.clear(); this.drag = null;
    el('bigmap').classList.add('on'); document.exitPointerLock?.(); this.legend(); this.draw();
  }
  close() { this.open = false; this.drag = null; el('bigmap').classList.remove('on'); this.g.renderer.domElement.requestPointerLock?.(); }
  key(code) {
    if (code === 'KeyM' || code === 'Escape') { this.close(); return; }
    if (code === 'Equal' || code === 'NumpadAdd') this.zoomAt(this.c.width / 2, this.c.height / 2, 1.25);
    if (code === 'Minus' || code === 'NumpadSubtract') this.zoomAt(this.c.width / 2, this.c.height / 2, 0.8);
    if (code === 'Space') { const p = this.g.player.car ? this.g.player.car.pos : this.g.player.pos; this.cx = p.x; this.cz = p.z; }
    this.held.add(code);
  }
  legend() {
    const L = el('bigmapL');
    L.innerHTML = `<h3>Map</h3>` + Object.entries(KINDS).map(([k, v]) => `<label><input type="checkbox" data-k="${k}" ${this.hide.has(k) ? '' : 'checked'}><i style="background:${v.col}"></i>${v.name}</label>`).join('') +
      `<p>Scroll or <kbd>+</kbd><kbd>−</kbd> zoom · drag or <kbd>WASD</kbd> move · <kbd>Space</kbd> back to you<br>Click a place to set a waypoint<br><kbd>M</kbd> or <kbd>Esc</kbd> close</p>`;
    L.querySelectorAll('input').forEach(i => i.addEventListener('change', () => { i.checked ? this.hide.delete(i.dataset.k) : this.hide.add(i.dataset.k); }));
  }
  zoomAt(px, py, f) {
    const W = this.c.width, H = this.c.height, wx = this.cx + (px - W / 2) / this.s, wz = this.cz + (py - H / 2) / this.s;
    this.s = Math.min(4, Math.max(0.18, this.s * f));
    this.cx = wx - (px - W / 2) / this.s; this.cz = wz - (py - H / 2) / this.s; this.clamp();
  }
  clamp() { this.cx = Math.min(1300, Math.max(-1000, this.cx)); this.cz = Math.min(340, Math.max(-2400, this.cz)); }
  click() {
    const h = this.hot, g = this.g; if (!h) return;
    if (h.wp || (g.waypoint && Math.hypot(g.waypoint.pos.x - h.x, g.waypoint.pos.z - h.z) < 3)) { g.clearWaypoint(false); return; }
    const p = h.pos || this.g.player.pos.clone().set(h.x, 0, h.z);
    g.setWaypoint({ pos: p, name: h.name.replace(/ · .*/, '') });
  }

  update(dt) {
    if (!this.open) return;
    const v = 600 / this.s * dt * 0.6, k = this.held;
    if (k.has('KeyW') || k.has('ArrowUp')) this.cz -= v; if (k.has('KeyS') || k.has('ArrowDown')) this.cz += v;
    if (k.has('KeyA') || k.has('ArrowLeft')) this.cx -= v; if (k.has('KeyD') || k.has('ArrowRight')) this.cx += v;
    this.clamp(); this.draw();
  }

  draw() {
    const g = this.g, c = this.c, x = this.x, hud = g.hud;
    const W = c.clientWidth, H = c.clientHeight; if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const s = this.s, sx = (X) => W / 2 + (X - this.cx) * s, sz = (Z) => H / 2 + (Z - this.cz) * s;
    x.fillStyle = '#244a63'; x.fillRect(0, 0, W, H);
    const k = hud.mapK, [X0, Z0] = hud.mapO; x.imageSmoothingEnabled = s < 1.5;
    x.drawImage(hud.mapC, sx(X0), sz(Z0), hud.mapC.width / k * s, hud.mapC.height / k * s);
    // area names
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const [t, X, Z] of [['THE DRY', 160, -1300], ['HALYARD', 150, 60], ['WILLOW BANK', -540, 0]]) { x.font = `800 ${Math.round(14 + s * 14)}px system-ui, sans-serif`; x.fillStyle = 'rgba(255,255,255,.22)'; x.fillText(t, sx(X), sz(Z)); }
    // the police: the search area, their cars
    const Pz = g.police;
    if (Pz?.stars && !Pz.seen && Pz.lastKnown) { const lk = Pz.lastKnown; x.fillStyle = Math.floor(performance.now() / 400) % 2 ? 'rgba(220,40,40,.28)' : 'rgba(40,80,230,.28)'; x.beginPath(); x.arc(sx(lk.x), sz(lk.z), (70 + Pz.stars * 25) * s, 0, 7); x.fill(); }
    if (Pz) for (const pc of Pz.cars) { if (pc.car.inactive || pc.car.wrecked) continue; x.fillStyle = Math.floor(performance.now() / 250) % 2 ? '#ff3a3a' : '#3a6aff'; x.beginPath(); x.arc(sx(pc.car.pos.x), sz(pc.car.pos.z), 4, 0, 7); x.fill(); }
    // the places
    const list = this.pois().filter(p => !this.hide.has(p.kind)), r = Math.max(7, Math.min(13, 6 + s * 5));
    const m = this.mouse; this.hot = null;
    if (m && !this.drag) { let bd = r + 3; for (const p of list) { const d = Math.hypot(sx(p.x) - m[0], sz(p.z) - m[1]); if (d < bd) { bd = d; this.hot = p; } } }
    const order = ['place', 'shop', 'service', 'food', 'people', 'you', 'job'];
    list.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    for (const p of list) { const px = sx(p.x), pz = sz(p.z); if (px < -20 || pz < -20 || px > W + 20 || pz > H + 20) continue; drawIcon(x, p.kind, p.glyph, px, pz, p === this.hot ? r * 1.25 : r, p === this.hot); }
    // labels: when you're zoomed in, for yours and the job always, and whatever's under the mouse
    x.font = `600 ${Math.round(Math.max(11, Math.min(14, 9 + s * 3)))}px system-ui, sans-serif`; x.textAlign = 'left'; x.textBaseline = 'middle';
    for (const p of list) {
      if (!(p === this.hot || p.always || s >= 1.1)) continue;
      const px = sx(p.x) + r + 4, pz = sz(p.z), t = p.name, w = x.measureText(t).width;
      x.fillStyle = 'rgba(10,14,20,.72)'; x.fillRect(px - 3, pz - 9, w + 6, 18); x.fillStyle = p === this.hot ? '#fff' : '#e8ecf0'; x.fillText(t, px, pz);
    }
    // you
    const pl = g.player, pp = pl.car ? pl.car.pos : g.van?.inside && g.camper ? g.camper.pos : pl.pos, face = pl.car ? pl.car.yaw : pl.yaw;
    x.save(); x.translate(sx(pp.x), sz(pp.z)); x.rotate(-face + Math.PI);
    x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -11); x.lineTo(8, 8); x.lineTo(0, 4); x.lineTo(-8, 8); x.closePath(); x.fill(); x.stroke();
    x.restore();
    c.style.cursor = this.drag?.moved ? 'grabbing' : this.hot ? 'pointer' : 'grab';
    // the north arrow, the scale
    x.fillStyle = 'rgba(10,14,20,.7)'; x.beginPath(); x.arc(36, 36, 20, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = '800 14px system-ui'; x.textAlign = 'center'; x.fillText('N', 36, 42); x.beginPath(); x.moveTo(36, 18); x.lineTo(41, 27); x.lineTo(31, 27); x.closePath(); x.fill();
    const m100 = [50, 100, 200, 500, 1000].find(v => v * s > 60) || 1000, bw = m100 * s;
    x.fillStyle = 'rgba(10,14,20,.7)'; x.fillRect(16, H - 40, bw + 20, 26); x.fillStyle = '#fff'; x.fillRect(26, H - 24, bw, 3); x.font = '600 11px system-ui'; x.textAlign = 'left'; x.fillText(m100 >= 1000 ? '1 km' : m100 + ' m', 26, H - 32);
  }
}
