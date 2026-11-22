'use strict';
// Game-feel layer: screen shake, hit-stop, particles, floating text, screen flash.
const FX = {
  sk: 0,            // current shake amplitude (px)
  hs: 0,            // remaining hit-stop (s): the game runs ~15x slower while > 0
  flash: 0, flashC: '#fff',
  parts: [], texts: [],
  shake(n) { this.sk = Math.max(this.sk, n); },
  stop(s) { this.hs = Math.max(this.hs, s); },
  clear() { this.sk = 0; this.hs = 0; this.flash = 0; this.parts.length = 0; this.texts.length = 0; },
  burst(x, y, n, o = {}) {
    const sp = o.sp || 200;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = Math.random() * sp, l = rr(0.25, 0.7) * (o.life || 1);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l, m: l, size: o.size || rr(2, 4), c: o.c || '#fc4', drag: 2.5, glow: o.glow !== false });
    }
  },
  puff(x, y, c = '#999') { this.burst(x, y, 5, { c, sp: 60, size: 3, life: 0.8, glow: false }); },
  trail(x, y, c) { this.parts.push({ x, y, vx: 0, vy: 0, l: 0.25, m: 0.25, size: 3, c, drag: 0, glow: true }); },
  text(x, y, s, c = '#fff', life = 0.8) { this.texts.push({ x, y, s, c, l: life, m: life }); },
  update(dt, rdt) {
    this.sk *= Math.pow(0.0005, rdt);
    if (this.sk < 0.2) this.sk = 0;
    this.flash = Math.max(0, this.flash - rdt * 2.2);
    for (const p of this.parts) { p.l -= dt; p.x += p.vx * dt; p.y += p.vy * dt; const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
    this.parts = this.parts.filter(p => p.l > 0);
    for (const x of this.texts) { x.l -= dt; x.y -= 28 * dt; }
    this.texts = this.texts.filter(x => x.l > 0);
  },
};
