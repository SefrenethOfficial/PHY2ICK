// The HUD: money, health, prompts, toasts, speech bubbles, a waypoint marker, the speedo.
import * as THREE from 'three';

export class Hud {
  constructor(g) {
    this.g = g;
    const $ = (id) => document.getElementById(id);
    this.moneyEl = $('money'); this.hpEl = $('hpfill'); this.promptEl = $('prompt'); this.toastsEl = $('toasts');
    this.bubblesEl = $('bubbles'); this.speedEl = $('speedo'); this.wpEl = $('waypoint'); this.fpsEl = $('fps'); this.helpEl = $('help');
    this.bubbles = new Map();
    this.mini = document.getElementById('minimap'); this.miniX = this.mini.getContext('2d');
    this.fpsT = 0; this.frames = 0;
  }

  toast(text, color = '#fff') {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = text; t.style.setProperty('--c', color);
    this.toastsEl.prepend(t);
    while (this.toastsEl.children.length > 4) this.toastsEl.lastChild.remove();
    const ms = Math.min(11000, Math.max(3500, 1500 + text.length * 66)); // (long enough to read)
    setTimeout(() => t.classList.add('out'), ms); setTimeout(() => t.remove(), ms + 500);
  }

  bubble(n, text, dur) {
    let b = this.bubbles.get(n);
    if (!b) { b = document.createElement('div'); b.className = 'bubble'; this.bubblesEl.appendChild(b); this.bubbles.set(n, b); }
    b.innerHTML = `<b>${n.mem.met ? n.name : 'Stranger'}</b>${text}`;
    b.style.display = 'block';
    n.bubbleT = dur;
  }

  blackout(on) {
    const el = document.getElementById('blackout');
    el.classList.toggle('on', on);
  }

  prompt(text) {
    if (this.lastPrompt === text) return;
    this.lastPrompt = text;
    this.promptEl.innerHTML = text || ''; this.promptEl.style.display = text ? 'block' : 'none';
  }

  // the minimap: the whole island drawn once (2 px a metre), then the bit round you, every frame
  buildMap() {
    const m = this.g.map, PX = 2, X0 = -560, Z0 = -620, W = 1300, H = 960;
    const c = document.createElement('canvas'); c.width = W * PX / 2; c.height = H * PX / 2; // (1 px per metre)
    const x = c.getContext('2d'), k = c.width / W;
    const tx = (X) => (X - X0) * k, tz = (Z) => (Z - Z0) * k;
    x.fillStyle = '#244a63'; x.fillRect(0, 0, c.width, c.height);
    const poly = (ring, fill) => { x.beginPath(); ring.forEach(([X, Z], i) => (i ? x.lineTo(tx(X), tz(Z)) : x.moveTo(tx(X), tz(Z)))); x.closePath(); x.fillStyle = fill; x.fill('evenodd'); };
    for (const p of m.landMP) { x.beginPath(); for (const ring of p) ring.forEach(([X, Z], i) => (i ? x.lineTo(tx(X), tz(Z)) : x.moveTo(tx(X), tz(Z)))); x.fillStyle = '#5d6b55'; x.fill('evenodd'); }
    for (const f of m.footprints) poly(f, '#8d8a84');
    x.strokeStyle = '#d8d4cc'; x.lineCap = 'round';
    for (const s of m.segs) { x.lineWidth = 11 * k; x.beginPath(); x.moveTo(tx(s.a[0]), tz(s.a[1])); x.lineTo(tx(s.b[0]), tz(s.b[1])); x.stroke(); }
    this.mapC = c; this.mapK = k; this.mapO = [X0, Z0];
  }

  drawMini() {
    if (!this.mapC) this.buildMap();
    const g = this.g, ctx = this.miniX, S = this.mini.width, k = this.mapK, zoom = 1.6; // (screen px per map px)
    const p = g.player.car ? g.player.car.pos : g.player.pos;
    const yaw = g.cam.yaw; // (the map turns with the camera)
    ctx.save(); ctx.clearRect(0, 0, S, S);
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, 7); ctx.clip();
    ctx.fillStyle = '#244a63'; ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2); ctx.rotate(yaw); ctx.scale(zoom, zoom);
    ctx.drawImage(this.mapC, -(p.x - this.mapO[0]) * k, -(p.z - this.mapO[1]) * k);
    if (g.waypoint) { const w = g.waypoint.pos; ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc((w.x - p.x) * k, (w.z - p.z) * k, 4 / zoom * 1.6, 0, 7); ctx.fill(); }
    ctx.restore();
    // you: an arrow pointing the way you face (relative to the camera)
    const face = (g.player.car ? g.player.car.yaw : g.player.yaw) - yaw - Math.PI;
    ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(-face);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1.5, 0, 7); ctx.stroke();
  }

  frame(dt) {
    this.drawMini();
    const g = this.g, cam = g.camera, W = innerWidth, H = innerHeight;
    this.moneyEl.textContent = '$' + g.money.toLocaleString();
    this.hpEl.style.width = g.player.hp + '%';
    // speech bubbles follow heads
    for (const [n, b] of this.bubbles) {
      if (n.bubbleT <= 0) { b.style.display = 'none'; continue; }
      const p = new THREE.Vector3(); n.human.b.head.getWorldPosition(p); p.y += 0.42;
      const d = p.distanceTo(cam.position);
      p.project(cam);
      if (p.z > 1 || d > 30) { b.style.display = 'none'; continue; }
      b.style.display = 'block';
      b.style.left = ((p.x + 1) / 2 * W) + 'px'; b.style.top = ((1 - p.y) / 2 * H) + 'px';
      b.style.opacity = Math.min(1, n.bubbleT * 2) * (d > 20 ? 1 - (d - 20) / 10 : 1);
    }
    // the speedo
    const car = g.player.car;
    if (car) { this.speedEl.style.display = 'block'; this.speedEl.innerHTML = `<b>${Math.round(Math.abs(car.speed) * 3.6)}</b> km/h<span>${car.speed < -0.5 ? 'R' : car.gear}</span>`; }
    else this.speedEl.style.display = 'none';
    // waypoint
    const wp = g.waypoint;
    if (wp) {
      const from = car ? car.pos : g.player.pos;
      const dist = Math.hypot(wp.pos.x - from.x, wp.pos.z - from.z);
      if (dist < 6) { g.clearWaypoint(true); }
      else {
        const p = wp.pos.clone().setY(2.2).project(cam);
        let x = (p.x + 1) / 2 * W, y = (1 - p.y) / 2 * H;
        const behind = p.z > 1;
        if (behind) { x = W - x; y = H - 40; }
        x = Math.min(W - 40, Math.max(40, x)); y = Math.min(H - 40, Math.max(40, y));
        this.wpEl.style.display = 'block'; this.wpEl.style.left = x + 'px'; this.wpEl.style.top = y + 'px';
        this.wpEl.innerHTML = `<i></i>${wp.name}<br><small>${Math.round(dist)} m</small>`;
      }
    } else this.wpEl.style.display = 'none';
    // fps
    this.frames++; this.fpsT += dt;
    if (this.fpsT > 0.5) { this.fpsEl.textContent = Math.round(this.frames / this.fpsT) + ' fps'; this.frames = 0; this.fpsT = 0; }
  }
}
