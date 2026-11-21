// Sound: the chase theme (when the police are after you), and everything else made on the fly with
// Web Audio (no files): gunshots, punches, crashes, explosions, fire, the siren, sirens getting closer.
import * as THREE from 'three';

export class Sfx {
  constructor(g) {
    this.g = g;
    this.ctx = null;
    this.music = new Audio(import.meta.env.BASE_URL + 'audio/chase.mp3');
    this.music.loop = true; this.music.volume = 0; this.music.preload = 'auto';
    this.musicOn = false; this.musicVol = 0;
  }

  // the browser only allows sound after a click: the game's first click calls this
  unlock() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.out = ctx.createGain(); this.out.gain.value = 0.8; this.out.connect(ctx.destination);
    const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // the siren: a wailing tone, its loudness set every frame by the nearest siren
    const o = this.sirenOsc = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 700;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    const gn = this.sirenGain = ctx.createGain(); gn.gain.value = 0;
    o.connect(f); f.connect(gn); gn.connect(this.out); o.start();
    // fire: a crackling bed, loudness by the nearest fire
    const fs = ctx.createBufferSource(); fs.buffer = buf; fs.loop = true;
    const ff = ctx.createBiquadFilter(); ff.type = 'bandpass'; ff.frequency.value = 900; ff.Q.value = 0.6;
    const fg = this.fireGain = ctx.createGain(); fg.gain.value = 0;
    fs.connect(ff); ff.connect(fg); fg.connect(this.out); fs.start();
  }

  // how loud something is from here (and nothing at all far away)
  vol(at, range = 120) {
    if (!at) return 1;
    const d = this.g.camera.position.distanceTo(at);
    return Math.max(0, 1 - d / range) ** 1.6;
  }

  burst({ at, range = 120, vol = 1, dur = 0.25, freq = 1200, q = 0.7, type = 'lowpass', thump = 0, thumpF = 90, sweep = 0 }) {
    const ctx = this.ctx; if (!ctx) return;
    const v = vol * this.vol(at, range); if (v < 0.01) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * sweep), t + dur);
    const gn = ctx.createGain(); gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(gn); gn.connect(this.out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    if (thump) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(thumpF * 2, t); o.frequency.exponentialRampToValueAtTime(thumpF * 0.5, t + dur * 0.8);
      const og = ctx.createGain(); og.gain.setValueAtTime(v * thump, t); og.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.9);
      o.connect(og); og.connect(this.out); o.start(t); o.stop(t + dur);
    }
  }

  shot(at, heavy = false) { this.burst({ at, range: 220, vol: heavy ? 1.0 : 0.8, dur: heavy ? 0.45 : 0.28, freq: heavy ? 1400 : 2400, sweep: 0.15, thump: heavy ? 1.2 : 0.7, thumpF: heavy ? 70 : 110 }); }
  punch(at) { this.burst({ at, range: 30, vol: 0.7, dur: 0.12, freq: 500, sweep: 0.4, thump: 1.1, thumpF: 70 }); }
  whoosh(at) { this.burst({ at, range: 20, vol: 0.25, dur: 0.18, freq: 900, type: 'bandpass', q: 1.2, sweep: 2 }); }
  crash(at, k = 1) { this.burst({ at, range: 140, vol: Math.min(1, 0.3 + k * 0.5), dur: 0.35 + k * 0.25, freq: 2600, type: 'bandpass', q: 0.9, sweep: 0.3, thump: 0.8 * k, thumpF: 55 }); }
  explosion(at) { this.burst({ at, range: 400, vol: 1.4, dur: 2.2, freq: 1600, sweep: 0.05, thump: 2.0, thumpF: 40 }); this.burst({ at, range: 400, vol: 0.6, dur: 0.6, freq: 4000, type: 'highpass', sweep: 0.3 }); }
  glass(at) { this.burst({ at, range: 50, vol: 0.9, dur: 0.5, freq: 5200, type: 'highpass', sweep: 0.6 }); for (let i = 1; i < 5; i++) setTimeout(() => this.burst({ at, range: 30, vol: 0.3, dur: 0.08, freq: 6000 + Math.random() * 2000, type: 'bandpass', q: 4 }), 60 + i * 70 + Math.random() * 60); }
  thunk(at) { this.burst({ at, range: 25, vol: 0.45, dur: 0.12, freq: 380, sweep: 0.5, thump: 0.6, thumpF: 80 }); }
  horn(at, on) { // a horn held down (someone slumped on the wheel)
    const ctx = this.ctx; if (!ctx) return;
    if (on && !this.hornO) { const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = o2.type = 'square'; o1.frequency.value = 415; o2.frequency.value = 520; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600; const gn = ctx.createGain(); gn.gain.value = 0; o1.connect(f); o2.connect(f); f.connect(gn); gn.connect(this.out); o1.start(); o2.start(); this.hornO = { o1, o2, gn }; }
    if (this.hornO) { this.hornO.gn.gain.setTargetAtTime(on ? 0.12 * this.vol(at, 120) : 0, ctx.currentTime, 0.05); if (!on) { const h = this.hornO; this.hornO = null; setTimeout(() => { h.o1.stop(); h.o2.stop(); }, 300); } }
  }
  click(at) { this.burst({ at, range: 12, vol: 0.4, dur: 0.05, freq: 3500, type: 'highpass' }); }
  reload(at) { this.click(at); setTimeout(() => this.click(at), 260); setTimeout(() => this.burst({ at, range: 12, vol: 0.5, dur: 0.08, freq: 2000, type: 'bandpass', q: 3 }), 600); }
  cash(at) { const ctx = this.ctx; if (!ctx) return; const t = ctx.currentTime; for (const [k, f] of [[0, 1318], [0.09, 1760]]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const gn = ctx.createGain(); gn.gain.setValueAtTime(0.25 * this.vol(at, 30), t + k); gn.gain.exponentialRampToValueAtTime(0.001, t + k + 0.25); o.connect(gn); gn.connect(this.out); o.start(t + k); o.stop(t + k + 0.3); } }

  // every frame: the siren, the fire, the chase theme fading in and out
  update(dt) {
    const g = this.g, ctx = this.ctx;
    // the theme (an <audio>, so it streams)
    const want = this.musicOn ? 0.5 : 0;
    this.musicVol += (want - this.musicVol) * Math.min(1, dt * (this.musicOn ? 1.5 : 0.35));
    if (this.musicOn && this.music.paused && ctx) this.music.play().catch(() => {});
    this.music.volume = Math.max(0, Math.min(1, this.musicVol));
    if (!this.musicOn && this.musicVol < 0.01 && !this.music.paused) { this.music.pause(); this.music.currentTime = 0; }
    if (!ctx) return;
    // sirens: the nearest one, wailing
    let sv = 0;
    for (const c of g.cars) if (c.siren && !c.wrecked) sv = Math.max(sv, this.vol(c.pos, 160) * 0.16);
    const t = ctx.currentTime;
    this.sirenOsc.frequency.setTargetAtTime(650 + (Math.sin(t * 2.2) * 0.5 + 0.5) * 650, t, 0.03);
    this.sirenGain.gain.setTargetAtTime(sv, t, 0.1);
    let fv = 0;
    for (const c of g.cars) if (c.burning || c.wreckFireT > 0) fv = Math.max(fv, this.vol(c.pos, 60) * 0.35);
    this.fireGain.gain.setTargetAtTime(fv * (0.7 + Math.random() * 0.3), t, 0.05);
  }
}
