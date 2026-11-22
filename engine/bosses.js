'use strict';
// Five bosses. Each is a looping script: `yield n` waits n seconds, `yield fn` waits until fn() is true.
// Pattern for every attack: spawn telegraphed zones, then `yield* cast(name, T)` so the cast bar matches the telegraph.
// The weak point only works inside `expose()`. B.phase / B.k make later phases faster and meaner.

const THEMES = {
  violet: { floor: '#150b1f', line: 'rgba(150,80,200,.13)', accent: '#7a2a9a', glow: '#a0f', seed: 7 },
  teal:   { floor: '#0a191e', line: 'rgba(80,180,200,.12)', accent: '#2a8a9a', glow: '#4cf', seed: 11 },
  blood:  { floor: '#1f0a10', line: 'rgba(220,70,90,.12)',  accent: '#a02a3a', glow: '#f46', seed: 23 },
  glass:  { floor: '#12151b', line: 'rgba(200,210,230,.12)', accent: '#8a9ab0', glow: '#dfe', seed: 31 },
  void:   { floor: '#0a0a12', line: 'rgba(255,220,120,.10)', accent: '#c9a227', glow: '#fd6', seed: 43 },
};
const BOSS_INFO = [
  { name: 'THE WARDEN', epithet: 'Keeper of the first gate' },
  { name: 'THE WRAITH', epithet: 'What remains of a grieving thing' },
  { name: 'THE HEART EATER', epithet: 'It remembers every beat it stole' },
  { name: 'THE FACELESS MIRROR', epithet: 'It shows you what you are missing' },
  { name: 'THE HOLLOW KING', epithet: 'Wears the crown of an empty head' },
];
const cx = A.x + A.w / 2, cy = A.y + A.h / 2;
const ex = T => T * (0.6 + 0.4 * (B ? B.k : 1));           // exposure windows shrink in later phases
const randIn = (m = 40) => [rr(A.x + m, A.x + A.w - m), rr(A.y + m, A.y + A.h - m)];

// ------------------------------------------------------------ visuals (drawn around the boss centre; B.face = facing)
function eyePair(g, dx, dy, r, c) { g.fillStyle = c; for (const s of [-1, 1]) { g.beginPath(); g.arc(dx, dy * s, r, 0, TAU); g.fill(); } }
function drawWarden(g, k) {
  const r = B.r, hot = B.phase > 0;
  g.save(); g.rotate(B.face);
  g.fillStyle = k ? '#fff' : '#17101f'; g.strokeStyle = k ? '#fff' : '#6a3a8a'; g.lineWidth = 4; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + TAU / 16; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = k ? '#fff' : (hot ? '#f80' : '#a0f'); g.lineWidth = 5;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0, 0, r + 9, i * PI / 2 + t * 0.6, i * PI / 2 + t * 0.6 + 0.9); g.stroke(); }
  g.fillStyle = k ? '#fff' : (hot ? '#fb4' : '#e33');
  g.fillRect(r * 0.3, -r * 0.42, r * 0.34, r * 0.14); g.fillRect(r * 0.3, r * 0.28, r * 0.34, r * 0.14);
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-r * 0.2, -r * 0.5); g.lineTo(-r * 0.4, 0); g.lineTo(-r * 0.2, r * 0.5); g.stroke();
  g.restore();
}
function drawWraith(g, k) {
  const r = B.r; g.save(); g.rotate(B.face); g.globalAlpha = B.stun ? 1 : 0.88;
  for (let i = 0; i < 5; i++) {                        // trailing tatters
    const o = (i - 2) * 0.45; g.strokeStyle = k ? '#fff' : '#12404a'; g.lineWidth = 9 - Math.abs(i - 2) * 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-r * 0.4, Math.sin(o) * r * 0.8);
    for (let s = 1; s <= 6; s++) g.lineTo(-r * 0.4 - s * 9, Math.sin(o) * r * 0.8 + Math.sin(t * 5 + s * 0.8 + i) * 5 * (s / 3));
    g.stroke();
  }
  g.fillStyle = k ? '#fff' : '#0d2a33'; g.strokeStyle = k ? '#fff' : '#4cf'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.stroke();
  eyePair(g, r * 0.42, r * 0.3, 4.5, k ? '#000' : '#8ef');
  g.restore();
}
function drawHeartEater(g, k) {
  const r = B.r * (1 + 0.06 * Math.sin(t * (B.phase ? 9 : 6))); g.save(); g.rotate(B.face);
  g.fillStyle = k ? '#fff' : '#3a0810'; g.strokeStyle = k ? '#fff' : '#f46'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.stroke();
  g.strokeStyle = k ? '#fff' : 'rgba(255,70,100,.55)'; g.lineWidth = 3;
  for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + 0.3; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2); g.quadraticCurveTo(Math.cos(a + 0.5) * r * 0.6, Math.sin(a + 0.5) * r * 0.6, Math.cos(a + 0.2) * r * 0.95, Math.sin(a + 0.2) * r * 0.95); g.stroke(); }
  eyePair(g, r * 0.35, r * 0.32, 6, k ? '#000' : '#fd4');
  g.fillStyle = '#12020a'; g.beginPath(); g.arc(r * 0.35, 0, r * 0.3, -1.1, 1.1); g.closePath(); g.fill();   // maw
  g.fillStyle = k ? '#000' : '#eee'; for (let i = -2; i <= 2; i++) { const a = i * 0.4; g.beginPath(); g.moveTo(r * 0.35 + Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); g.lineTo(r * 0.35 + Math.cos(a) * r * 0.14, Math.sin(a) * r * 0.14 + 3); g.lineTo(r * 0.35 + Math.cos(a + 0.2) * r * 0.3, Math.sin(a + 0.2) * r * 0.3); g.fill(); }
  g.restore();
}
let mirrorCv = null;
function mirrorSprite() {                                   // the hero's own sprite, drained to a pale ghost
  if (mirrorCv || !DH.ready || !DH.portrait) return mirrorCv;
  const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = DH.portrait.width; c.height = DH.portrait.height; g.drawImage(DH.portrait, 0, 0);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(215,225,250,.86)'; g.fillRect(0, 0, c.width, c.height);
  return (mirrorCv = c);
}
function drawMirror(g, k) {
  const im = mirrorSprite(); g.save();
  g.strokeStyle = k ? '#fff' : 'rgba(220,235,255,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, B.r, 0, TAU); g.stroke();
  if (im) {
    g.imageSmoothingEnabled = false; if (Math.cos(B.face) > 0) g.scale(-1, 1);
    const n = 9, top = -Math.round(im.height * 0.55);                  // 1:1 scale, whole-pixel slices: a fractional scale would tear the sprite
    for (let i = 0; i < n; i++) {                                      // glitchy horizontal slices
      const y0 = Math.floor(i * im.height / n), y1 = Math.floor((i + 1) * im.height / n), off = Math.round(Math.sin(t * 9 + i * 1.7) * (B.stun ? 0.5 : 2.2));
      g.drawImage(im, 0, y0, im.width, y1 - y0, -Math.round(im.width / 2) + off, top + y0, im.width, y1 - y0);
    }
  }
  g.restore();
}
function drawKing(g, k) {
  const r = B.r; g.save(); g.rotate(B.face);
  g.fillStyle = k ? '#fff' : '#1a1408'; g.strokeStyle = k ? '#fff' : '#c9a227'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = k ? '#fff' : '#c9a227';
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + t * 0.25, l = i % 2 ? r * 0.28 : r * 0.5; g.beginPath(); g.moveTo(Math.cos(a - 0.12) * r, Math.sin(a - 0.12) * r); g.lineTo(Math.cos(a) * (r + l), Math.sin(a) * (r + l)); g.lineTo(Math.cos(a + 0.12) * r, Math.sin(a + 0.12) * r); g.fill(); }
  g.fillStyle = '#000'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(r * 0.38, s * r * 0.3, r * 0.17, r * 0.22, 0, 0, TAU); g.fill(); }
  g.fillStyle = k ? '#000' : (B.phase > 1 ? '#f64' : '#fd6'); for (const s of [-1, 1]) { g.beginPath(); g.arc(r * 0.4, s * r * 0.3, 3.5, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(255,210,90,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-r * 0.1, -r * 0.6); g.lineTo(-r * 0.3, -r * 0.1); g.lineTo(-r * 0.1, r * 0.3); g.lineTo(-r * 0.35, r * 0.6); g.stroke();
  g.restore();
}

// ------------------------------------------------------------ the bosses
const BOSSES = [
  // 1. THE WARDEN - teaches: telegraphs, dodging, getting behind a turning boss
  () => mk({ ...BOSS_INFO[0], r: 38, hp: 10, turn: 1.5, x: cx, y: A.y + 120, theme: THEMES.violet, draw: drawWarden, script: function* () {
    while (true) {
      for (let i = 0; i < 3 + B.phase; i++) { const [x, y] = lead(); const T = 0.85 * B.k; zc(x, y, 72, T); yield* cast('CRUSH', T); }
      { const a = aimP(B.x, B.y), T = 1.05 * B.k; for (const o of (B.phase ? [-0.9, -0.45, 0, 0.45, 0.9] : [-0.6, 0, 0.6])) zb(B.x, B.y, a + o, 36, T); yield* cast('EDGE BREAKER', T); }
      yield 0.25;
      { const T = 0.8 * B.k; yield* cast('SHOCKWAVE', T); ring(B.x, B.y, 14, 170); if (B.phase) { yield 0.45; ring(B.x, B.y, 14, 170, 0.22); } }
      if (B.phase) { const a = aimP(B.x, B.y); for (let i = 1; i <= 5; i++) zc(B.x + Math.cos(a) * i * 90, B.y + Math.sin(a) * i * 90, 55, 0.6 + i * 0.18 * B.k); yield* cast('CHAIN SLAM', 1.5 * B.k); }
      yield* expose(ex(2.6));
      yield* goto(rr(A.x + 150, A.x + A.w - 150), rr(A.y + 90, A.y + 220), 220);
    }
  } }),

  // 2. THE WRAITH - teaches: bullets, crossing beams, reading a blink
  () => mk({ ...BOSS_INFO[1], r: 30, hp: 13, turn: 2.4, x: cx, y: A.y + 100, theme: THEMES.teal, draw: drawWraith, script: function* () {
    while (true) {
      { const T = 1.7 * B.k; for (let i = 0; i < 8 + B.phase * 3; i++) { const [x, y] = randIn(); zc(x, y, 58, 1 + i * 0.09); } yield* cast('DARK RAIN', T); }
      { const T = 1 * B.k; zb(A.x, P.y, 0, 34, T, 0.3, A.w); zb(P.x, A.y, PI / 2, 34, T, 0.3, A.h);
        if (B.phase) { zb(A.x, P.y + 100, 0, 34, T + 0.25, 0.3, A.w); zb(P.x - 110, A.y, PI / 2, 34, T + 0.25, 0.3, A.h); } yield* cast('SCYTHE', T); }
      for (let n = 0; n < 1 + B.phase; n++) {
        const [dx, dy] = randIn(80), T = 0.7 * B.k; zc(dx, dy, 44, T); yield* cast('BLINK', T);
        B.x = dx; B.y = dy; FX.burst(dx, dy, 18, { c: '#4cf', sp: 220 });
        for (let i = 0; i < 18; i++) { bl(B.x, B.y, i * 0.38 + n, 185 + B.phase * 30); yield 0.08 * B.k; }
      }
      yield* expose(ex(2.2));
    }
  } }),

  // 3. THE HEART EATER - teaches: gaps in expanding rings, rotating beams, bullet spirals
  () => mk({ ...BOSS_INFO[2], r: 50, hp: 16, turn: 1.15, x: cx, y: cy - 50, theme: THEMES.blood, draw: drawHeartEater, script: function* () {
    yield* goto(cx, cy - 60, 150);
    while (true) {
      { const T = 0.8 * B.k; zc(B.x, B.y, 130, T); yield* cast('HEARTBEAT', T); zr(B.x, B.y, 160, 270, T); yield* cast('HEARTBEAT', T); zr(B.x, B.y, 300, 460, T); yield* cast('HEARTBEAT', T); }
      { const T = 1.05 * B.k, b0 = rr(0, PI); for (let i = 0; i < 4; i++) zb(B.x, B.y, b0 + i * PI / 2, 40, T); yield* cast('CROSS', T);
        for (let i = 0; i < 4; i++) zb(B.x, B.y, b0 + PI / 4 + i * PI / 2, 40, T); if (B.phase) ring(B.x, B.y, 10, 150); yield* cast('CROSS', T); }
      { B.cast = { name: 'DEVOUR', T: 1.6, t: 0 }; for (let i = 0; i < 40; i++) { for (let a = 0; a < 3; a++) bl(B.x, B.y, i * 0.3 + a * 2.094, 170); B.cast.t = i / 40 * 1.6; yield 0.06 * B.k; } B.cast = null; }
      for (let i = 0; i < 2 + B.phase; i++) { const [x, y] = lead(0.3), T = 0.9 * B.k; zc(x, y, 115, T); yield* cast('MAW', T); }
      yield* expose(ex(2.4));
    }
  } }),

  // 4. THE FACELESS MIRROR - teaches: never stand still (it punishes where you WERE), safe columns
  () => mk({ ...BOSS_INFO[3], r: 34, hp: 18, turn: 2.0, x: cx, y: A.y + 110, theme: THEMES.glass, draw: drawMirror,
    onTick(dt) { this.rec = (this.rec || 0) - dt; if (this.rec <= 0) { this.rec = 0.1; (this.path = this.path || []).push({ x: P.x, y: P.y }); if (this.path.length > 40) this.path.shift(); } },
    script: function* () {
      while (true) {
        { const T = 1.1 * B.k, n = B.path ? B.path.length : 0;                       // ECHO: hits where you stood 2 seconds ago
          for (const j of [20, 14, 8, 2]) { const p = B.path && B.path[n - 1 - j]; if (p) zc(p.x, p.y, 62, T + (20 - j) * 0.02); } yield* cast('ECHO', T); }
        { const mxp = clamp(2 * cx - P.x, A.x + 60, A.x + A.w - 60), myp = clamp(2 * cy - P.y, A.y + 60, A.y + A.h - 60), T = 0.7 * B.k;
          zc(mxp, myp, 46, T); yield* cast('REFLECTION', T); B.x = mxp; B.y = myp; FX.burst(mxp, myp, 18, { c: '#dfe', sp: 220 });
          const a = aimP(B.x, B.y), n = 7 + B.phase * 4; for (let i = 0; i < n; i++) bl(B.x, B.y, a + (i - (n - 1) / 2) * 0.2, 260); yield 0.5; }
        { const T = 1.2 * B.k, par = (Math.random() * 2) | 0;                          // SHATTER: stand in the safe stripes
          const horiz = B.phase > 0 && Math.random() < 0.5;
          for (let i = 0; i < (horiz ? 5 : 8); i++) if ((i + par) % 2) { if (horiz) zx(A.x, A.y + i * 86, A.w, 86, T); else zx(A.x + i * 95, A.y, 95, A.h, T); }
          yield* cast('SHATTER', T); yield 0.1;
          for (let i = 0; i < (horiz ? 5 : 8); i++) if (!((i + par) % 2)) { if (horiz) zx(A.x, A.y + i * 86, A.w, 86, T * 0.85); else zx(A.x + i * 95, A.y, 95, A.h, T * 0.85); }
          yield* cast('SHATTER', T * 0.85); }
        yield* expose(ex(2.3));
        yield* goto(rr(A.x + 120, A.x + A.w - 120), rr(A.y + 80, A.y + 200), 260);
      }
    } }),

  // 5. THE HOLLOW KING - teaches nothing: it asks for everything. Three phases.
  () => mk({ ...BOSS_INFO[4], r: 46, hp: 24, turn: 1.1, phases: 3, x: cx, y: cy - 70, theme: THEMES.void, draw: drawKing, script: function* () {
    while (true) {
      { const par = (Math.random() * 2) | 0, swaps = 1 + B.phase;                    // COURT: checkerboard that flips
        for (let s = 0; s < swaps + 1; s++) { const T = (s ? 0.95 : 1.3) * B.k;
          for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) if ((r + c + par + s) % 2) zx(A.x + c * 95, A.y + r * 86, 95, 86, T);
          yield* cast('COURT', T); } }
      { const T = 1.1 * B.k, b0 = rr(0, PI);
        for (let i = 0; i < 8; i++) zb(B.x, B.y, b0 + i * PI / 4, 34, T); yield* cast('CROWN', T);
        for (let i = 0; i < 8; i++) zb(B.x, B.y, b0 + PI / 8 + i * PI / 4, 34, T); if (B.phase > 1) ring(B.x, B.y, 16, 150); yield* cast('CROWN', T); }
      if (B.phase > 0) { const [sx, sy] = randIn(110), T = 1.4 * B.k; zr(sx, sy, 78, 1600, T, 0.35); yield* cast('ECLIPSE', T); }   // only the circle is safe
      { B.cast = { name: 'HOLLOW BLOOM', T: 2.2, t: 0 }; const arms = 3 + B.phase; for (let i = 0; i < 36; i++) { for (let a = 0; a < arms; a++) bl(B.x, B.y, i * 0.33 + a * TAU / arms, 175); B.cast.t = i / 36 * 2.2; yield 0.06 * B.k; } B.cast = null; }
      if (B.phase > 1) { const [x, y] = lead(0.3), T = 0.8 * B.k; zc(x, y, 120, T); zb(B.x, B.y, aimP(B.x, B.y), 60, T); yield* cast('REGICIDE', T); }
      yield* expose(ex(2.2));
      yield* goto(rr(A.x + 160, A.x + A.w - 160), rr(A.y + 90, A.y + 220), 240);
    }
  } }),
];
