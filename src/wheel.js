// The interaction wheel: hold E near someone, move the mouse toward an option, let go of E.
// (Or press 1–6. Time slows right down while it's open.)
export class Wheel {
  constructor(g) {
    this.g = g;
    this.open = false; this.target = null; this.sel = -1;
    this.el = document.getElementById('wheel');
    this.sx = 0; this.sy = 0;
  }

  // the person you'd talk to: close, and roughly in front of you
  candidate() {
    const g = this.g, pl = g.player;
    if (pl.car || pl.downT > 0) return null;
    const p = pl.pos, f = g.cam.forward;
    let best = null, bestS = Infinity;
    for (const n of g.citizens.list) {
      if (['seated', 'down', 'flee', 'angry'].includes(n.state)) continue;
      const q = g.citizens.pos(n), d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d > 3.2) continue;
      const dot = ((q.x - p.x) * f.x + (q.z - p.z) * f.z) / Math.max(d, 0.01);
      const score = d - dot * 1.5;
      if (dot > -0.2 || d < 1.6) if (score < bestS) { bestS = score; best = n; }
    }
    return best;
  }

  show(n) {
    const g = this.g;
    this.open = true; this.target = n; this.sel = -1; this.sx = this.sy = 0;
    this.opts = g.citizens.options(n);
    g.timeScale = 0.2;
    const mood = n.mood < -30 ? ['Hostile', '#ff6a5a'] : n.mood < 10 ? ['Wary', '#ffd166'] : n.mood < 40 ? ['Friendly', '#c8e6a0'] : ['Likes you', '#7be08a'];
    const N = this.opts.length, R = 118;
    let html = `<div class="wh-centre"><b>${n.mem.met ? n.name : 'Stranger'}</b><span style="color:${mood[1]}">${mood[0]}</span></div>`;
    this.opts.forEach((o, i) => {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      html += `<div class="wh-opt" data-i="${i}" style="left:${Math.cos(a) * R}px;top:${Math.sin(a) * R}px"><small>${i + 1}</small>${o.label}</div>`;
    });
    this.el.innerHTML = `<div class="wh-ring"></div>${html}`;
    this.el.style.display = 'block';
    this.el.querySelectorAll('.wh-opt').forEach(d => d.addEventListener('mouseenter', () => this.highlight(+d.dataset.i)));
  }

  highlight(i) {
    this.sel = i;
    this.el.querySelectorAll('.wh-opt').forEach((d, k) => d.classList.toggle('on', k === i));
  }

  mouse(dx, dy) {
    this.sx += dx; this.sy += dy;
    const len = Math.hypot(this.sx, this.sy);
    if (len > 140) { this.sx *= 140 / len; this.sy *= 140 / len; }
    if (len > 28) {
      const N = this.opts.length;
      let a = Math.atan2(this.sy, this.sx) + Math.PI / 2; if (a < 0) a += Math.PI * 2;
      this.highlight(Math.round(a / (Math.PI * 2 / N)) % N);
    }
  }

  choose(i = this.sel) {
    if (!this.open) return;
    const n = this.target, o = this.opts[i];
    this.close();
    if (o) this.g.citizens.act(n, o.id);
  }

  close() {
    this.open = false; this.el.style.display = 'none'; this.g.timeScale = 1;
  }
}
