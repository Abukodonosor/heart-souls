'use strict';
// DARKHEART core: game state, input, player, boss scheduler, hazards.
// Drawing lives in render.js, menus in ui.js, boss scripts in bosses.js.

const CFG = {
  W: 960, H: 540, A: { x: 100, y: 70, w: 760, h: 430 },
  speed: 215, dash: 640, dashT: 0.17, dashCd: 0.6, burstT: 6,
  stam: { max: 100, regen: 48, delay: 0.55, dash: 28, swing: 14 },
  flask: { heal: 2, time: 0.9 },
};
const MODES = {
  abyss: { id: 'abyss', name: 'ABYSS', hp: 1, stamina: false, flasks: 0, blurb: 'One hit kills. No stamina. No flasks.' },
  souls: { id: 'souls', name: 'SOULS', hp: 5, stamina: true, flasks: 3, blurb: '5 HP, stamina bar, 3 soul flasks (F).' },
};
// need = index of the boss whose defeat unlocks this bolt (-1 = always available)
const BOLTS = [
  { id: 'dark', name: 'DARK BOLT', need: -1, c: '#c6f', blurb: 'Plain and reliable.' },
  { id: 'vine', name: 'VINE BOLT', need: 0, c: '#6e6', blurb: 'Roots the boss, window lasts longer.' },
  { id: 'flame', name: 'SOUL FLAME', need: 1, c: '#f93', blurb: 'Pierces, then burns the boss.' },
  { id: 'thorn', name: 'BURNING THORNS', need: 2, c: '#fa5', blurb: 'Vines and flame combined.' },
];
const FRAGMENTS = ['LEFT EYE', 'RIGHT EYE', 'VOICE', 'NAME', 'FACE'];

const A = CFG.A, cv = document.getElementById('c'), ctx = cv.getContext('2d');
const keys = {}, just = {}, mouse = { x: 480, y: 270, l: 0, r: 0, jl: 0, jr: 0 };
let state = 'title', prevState = 'title', bi = 0, t = 0, tm = 0, sub = 0;
const zoneAlive = z => z.t < z.tel + z.act, bulletAlive = b => !b.dead;
let P = null, B = null, MODE = MODES.abyss, zones = [], bullets = [], clearInfo = null, dodgeCd = 0, boomCd = 0, clangCd = 0;

// ---------------------------------------------------------------- input
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  AUD.init();
  if (!e.repeat) just[e.code] = 1;
  keys[e.code] = 1;
});
addEventListener('keyup', e => { keys[e.code] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; if (state === 'play') pause(); });
cv.addEventListener('mousedown', e => {
  AUD.init();
  if (e.button === 0) { mouse.l = 1; mouse.jl = 1; }
  if (e.button === 2) { mouse.r = 1; mouse.jr = 1; }
  e.preventDefault();
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = 0; if (e.button === 2) mouse.r = 0; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('mousemove', e => {
  const r = cv.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * CFG.W / r.width; mouse.y = (e.clientY - r.top) * CFG.H / r.height;
});
const down = (...k) => k.some(c => keys[c]);
const pressed = (...k) => k.some(c => just[c]);

// ---------------------------------------------------------------- helpers for boss scripts
const zc = (x, y, r, tel, act = 0.3) => zones.push({ k: 'c', x, y, r, tel, act, t: 0 });                    // circle
const zb = (x, y, a, w, tel, act = 0.3, len = 1400) => zones.push({ k: 'b', x, y, a, w, tel, act, len, t: 0 }); // beam
const zr = (x, y, r0, r1, tel, act = 0.3) => zones.push({ k: 'r', x, y, r0, r1, tel, act, t: 0 });          // ring (donut)
const zx = (x, y, w, h, tel, act = 0.3) => zones.push({ k: 'x', x, y, w, h, tel, act, t: 0 });               // rectangle
const bl = (x, y, a, sp, r = 6) => bullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r });
const ring = (x, y, n, sp, off = 0) => { for (let i = 0; i < n; i++) bl(x, y, off + i * TAU / n, sp); };
const aimP = (x, y) => Math.atan2(P.y - y, P.x - x);
const lead = (s = 0.45) => [clamp(P.x + P.vx * s, A.x + 20, A.x + A.w - 20), clamp(P.y + P.vy * s, A.y + 20, A.y + A.h - 20)];
function* cast(name, T) { B.cast = { name, T, t: 0 }; AUD.sfx('cast'); yield T; B.cast = null; }
function* expose(T) {                       // weak point open + boss frozen: the player's damage window
  B.weak.open = true; B.stun = true; B.openT = T; AUD.sfx('open');
  yield () => B.openT <= 0;
  B.weak.open = false; B.stun = false;
}
function* goto(x, y, sp = 200) { B.tgt = { x, y, sp }; yield () => !B.tgt; }
function mk(o) {
  return Object.assign({ face: PI / 2, weak: { open: false, r: 15 }, stun: false, cast: null, tgt: null, wait: 1.6, cond: null,
    flash: 0, phases: 2, ks: [1, 0.8, 0.62], k: 1, openT: 0, slow: 0, burn: 0, bt: 0, phase: 0, epithet: '', theme: THEMES.violet }, o, { max: o.hp });
}
const weakPos = () => ({ x: B.x + Math.cos(B.face + PI) * B.r * 0.95, y: B.y + Math.sin(B.face + PI) * B.r * 0.95 });
function phaseOf() {
  const r = B.hp / B.max;
  return B.phases === 3 ? (r > 0.66 ? 0 : r > 0.33 ? 1 : 2) : (r > 0.5 ? 0 : 1);
}

// ---------------------------------------------------------------- flow
function newPlayer() {
  return { x: 480, y: 440, r: 8, hp: MODE.hp, maxhp: MODE.hp, stam: CFG.stam.max, stamWait: 0, vx: 0, vy: 0, dash: 0, dcd: 0, dx: 0, dy: 1,
    inv: 0, swing: 0, scd: 0, sa: 0, hb: 0, hw: 0, mana: 0, burst: 0, drink: 0, flasks: MODE.flasks, nm: 'idle', ts: 0, aim: 0, boltType: 0,
    bolt: { s: 'held', x: 0, y: 0, vx: 0, vy: 0, life: 0, hit: 0, type: 0 } };
}
function begin(i) {
  if (!BOSSES[i]) return;
  bi = i; MODE = MODES[SAVE.d.mode] || MODES.abyss;
  P = newPlayer(); B = BOSSES[i](); B.gen = B.script();
  zones = []; bullets = []; clearInfo = null; FX.clear();
  buildFloor(B.theme);
  state = 'intro'; sub = 2.6; tm = 0;
  AUD.startMusic(); AUD.setIntensity(0.2);
  FX.flash = 1; FX.flashC = '#000';
}
function pause() { if (state === 'play' || state === 'intro') { prevState = state; state = 'paused'; UI.mi = 0; } }
function resume() { if (state === 'paused') state = prevState; }
let boltCache = null, boltCacheKey = -1;                      // recomputed only when a boss is cleared, not every frame
function availableBolts() {
  const key = SAVE.d.cleared.length;
  if (key !== boltCacheKey) { boltCacheKey = key; boltCache = BOLTS.map((b, i) => i).filter(i => BOLTS[i].need < 0 || SAVE.isCleared(BOLTS[i].need)); }
  return boltCache;
}

function useStam(n) {
  if (!MODE.stamina) return true;
  if (P.stam < n) return false;
  P.stam -= n; P.stamWait = CFG.stam.delay; return true;
}
const addMana = n => { if (P.burst <= 0) P.mana = Math.min(100, P.mana + n); };

function hurt() {
  if (state !== 'play') return;
  if (P.dash > 0) {                          // dashing through a lethal thing = a "dodge": rewards mana
    if (dodgeCd <= 0) { dodgeCd = 0.5; addMana(7); FX.text(P.x, P.y - 26, 'DODGE', '#6cf'); AUD.sfx('graze'); }
    return;
  }
  if (P.inv > 0) return;
  P.hp--; P.drink = 0;
  FX.shake(MODE.hp > 1 ? 10 : 16); FX.stop(MODE.hp > 1 ? 0.12 : 0.2);
  FX.flash = 0.5; FX.flashC = '#f22'; AUD.sfx('hurt');
  FX.burst(P.x, P.y, 16, { c: '#c22', sp: 260 });
  if (P.hp <= 0) die(); else P.inv = 1.0;
}
function die() {
  state = 'dead'; sub = 0; SAVE.death(bi); AUD.sfx('death'); AUD.setIntensity(0);
  FX.burst(P.x, P.y, 40, { c: '#a11', sp: 320, life: 1.6 });
}
function dmg(n, silent) {
  if (state !== 'play') return;
  B.hp -= n; B.flash = 0.1;
  const w = weakPos();
  if (!silent) {
    FX.stop(n >= 3 ? 0.09 : 0.05); FX.shake(n >= 3 ? 9 : 5); AUD.sfx(n >= 3 ? 'crit' : 'hit');
    FX.burst(w.x, w.y, n >= 3 ? 20 : 10, { c: '#fd4', sp: 280 }); FX.text(w.x, w.y - 20, '' + n, '#fd4');
  } else FX.text(B.x, B.y - B.r - 10, '' + n, '#f93', 0.6);
  if (B.hp <= 0) kill();
}
function kill() {
  state = 'clear'; sub = 4.2; zones = []; bullets = []; B.cast = null; B.weak.open = false;
  SAVE.record(bi, tm);
  clearInfo = { frag: FRAGMENTS[bi], time: tm, best: SAVE.d.best[bi], bolt: BOLTS.find(b => b.need === bi), deaths: SAVE.d.deaths[bi] || 0 };
  FX.stop(0.5); FX.shake(24); FX.flash = 1; FX.flashC = '#fff'; AUD.sfx('felled'); AUD.setIntensity(0);
  for (let i = 0; i < 6; i++) FX.burst(B.x + rr(-B.r, B.r), B.y + rr(-B.r, B.r), 24, { c: i % 2 ? '#fd4' : B.theme.glow, sp: 420, life: 2 });
}
function onPhase() {                         // boss crossed an HP threshold: reset the pattern, announce, break the rhythm
  zones = []; bullets = [];
  B.cast = null; B.weak.open = false; B.stun = false; B.openT = 0; B.tgt = null; B.cond = null; B.wait = 1.3;
  B.gen = B.script();
  FX.shake(14); FX.flash = 0.6; FX.flashC = '#fff'; AUD.sfx('phase');
  FX.text(B.x, B.y - B.r - 24, 'ENRAGED', '#f80', 1.5);
  AUD.setIntensity(0.45 + 0.25 * B.phase);
}

// ---------------------------------------------------------------- player
function updP(dt) {
  const aim = Math.atan2(mouse.y - P.y, mouse.x - P.x); P.aim = aim;
  let mx = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
  let my = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
  const ml = Math.hypot(mx, my); if (ml) { mx /= ml; my /= ml; }
  P.dcd -= dt; P.inv -= dt; P.scd -= dt;
  if (MODE.stamina) { P.stamWait -= dt; if (P.stamWait <= 0) P.stam = Math.min(CFG.stam.max, P.stam + CFG.stam.regen * dt); }

  if (pressed('Space', 'ShiftLeft') && P.dcd <= 0 && P.dash <= 0 && useStam(CFG.stam.dash)) {
    P.dash = CFG.dashT; P.dcd = CFG.dashCd; P.drink = 0;
    P.dx = ml ? mx : Math.cos(aim); P.dy = ml ? my : Math.sin(aim);
    AUD.sfx('dash'); FX.puff(P.x, P.y + 8);
  }
  if (P.dash > 0) { P.dash -= dt; P.vx = P.dx * CFG.dash; P.vy = P.dy * CFG.dash; FX.trail(P.x, P.y, '#6a3a8a'); }
  else {
    const sp = CFG.speed * (P.drink > 0 ? 0.45 : 1) * (P.swing > 0 ? 0.8 : 1);
    P.vx = mx * sp; P.vy = my * sp;
  }
  P.x = clamp(P.x + P.vx * dt, A.x + P.r, A.x + A.w - P.r);
  P.y = clamp(P.y + P.vy * dt, A.y + P.r, A.y + A.h - P.r);
  const d = Math.hypot(P.x - B.x, P.y - B.y), m = B.r + P.r;      // the boss body is solid
  if (d < m && d > 0) { P.x = B.x + (P.x - B.x) / d * m; P.y = B.y + (P.y - B.y) / d * m; }

  // soul flask (souls mode): slow drink, a hit cancels it
  if (pressed('KeyF') && P.flasks > 0 && P.hp < P.maxhp && P.drink <= 0 && P.dash <= 0) { P.drink = CFG.flask.time; AUD.sfx('drink'); }
  if (P.drink > 0) {
    P.drink -= dt;
    if (P.drink <= 0) { P.flasks--; P.hp = Math.min(P.maxhp, P.hp + CFG.flask.heal); FX.text(P.x, P.y - 30, '+HP', '#f93'); FX.burst(P.x, P.y, 16, { c: '#f93', sp: 120 }); }
  }
  if (pressed('KeyQ') && P.mana >= 100 && P.burst <= 0) { P.burst = CFG.burstT; P.mana = 0; AUD.sfx('phase'); FX.flash = 0.35; FX.flashC = '#6af'; AUD.setIntensity(0.8); }
  if (P.burst > 0) { P.burst -= dt; if (P.burst <= 0) AUD.setIntensity(0.3 + 0.2 * B.phase); }

  // Abyssal Blade
  if (P.swing > 0) P.swing -= dt;
  if ((mouse.l || keys.KeyJ) && P.scd <= 0 && P.dash <= 0 && P.drink <= 0 && useStam(CFG.stam.swing)) {
    P.swing = 0.14; P.sa = aim; P.hb = 0; P.hw = 0; P.scd = P.burst > 0 ? 0.15 : 0.36; AUD.sfx('swing');
  }
  if (P.swing > 0) bladeHits();

  // bolt: one projectile - throw, then recall or walk over it
  const T = P.bolt, avail = availableBolts();
  if (pressed('Tab') && T.s === 'held') { P.boltType = avail[(avail.indexOf(P.boltType) + 1) % avail.length]; AUD.sfx('ui'); }
  for (let n = 0; n < 4; n++) if (pressed('Digit' + (n + 1)) && avail.includes(n) && T.s === 'held') { P.boltType = n; AUD.sfx('ui'); }
  if (pressed('KeyK') || mouse.jr) {
    if (T.s === 'held') { T.s = 'fly'; T.type = P.boltType; T.x = P.x; T.y = P.y; T.vx = Math.cos(aim) * 780; T.vy = Math.sin(aim) * 780; T.life = 0.65; T.hit = 0; AUD.sfx('throw'); }
    else if (T.s !== 'recall') { T.s = 'recall'; T.hit = 0; AUD.sfx('throw'); }
  }
  const bc = BOLTS[T.type].c;
  if (T.s === 'fly') {
    T.x += T.vx * dt; T.y += T.vy * dt; T.life -= dt; FX.trail(T.x, T.y, bc); boltHit();
    if (T.s === 'fly' && Math.hypot(T.x - B.x, T.y - B.y) < B.r) { T.s = 'ground'; FX.burst(T.x, T.y, 6, { c: bc, sp: 100 }); }
    if (T.x < A.x || T.x > A.x + A.w || T.y < A.y || T.y > A.y + A.h) { T.x = clamp(T.x, A.x, A.x + A.w); T.y = clamp(T.y, A.y, A.y + A.h); T.s = 'ground'; }
    if (T.life <= 0 && T.s === 'fly') T.s = 'ground';
  } else if (T.s === 'recall') {
    const dd = Math.hypot(P.x - T.x, P.y - T.y);
    if (dd < 14) { T.s = 'held'; AUD.sfx('catch'); }
    else { T.x += (P.x - T.x) / dd * 950 * dt; T.y += (P.y - T.y) / dd * 950 * dt; FX.trail(T.x, T.y, bc); boltHit(); }
  } else if (T.s === 'ground' && Math.hypot(P.x - T.x, P.y - T.y) < 16) { T.s = 'held'; AUD.sfx('catch'); }
}
function bladeHits() {
  const R = 62;
  for (const b of bullets) {
    if (Math.hypot(b.x - P.x, b.y - P.y) < R && Math.abs(norm(Math.atan2(b.y - P.y, b.x - P.x) - P.sa)) < 1.4) {
      b.dead = 1; FX.burst(b.x, b.y, 6, { c: '#c6f', sp: 160 }); addMana(3);
      if (clangCd <= 0) { AUD.sfx('clang'); clangCd = 0.08; }
    }
  }
  if (!P.hb && Math.hypot(B.x - P.x, B.y - P.y) < B.r + R && Math.abs(norm(Math.atan2(B.y - P.y, B.x - P.x) - P.sa)) < 1.5) {
    P.hb = 1; addMana(5); AUD.sfx('thud'); FX.shake(3);
  }
  if (B.weak.open && !P.hw) {
    const w = weakPos();
    if (Math.hypot(w.x - P.x, w.y - P.y) < R + B.weak.r && Math.abs(norm(Math.atan2(w.y - P.y, w.x - P.x) - P.sa)) < 1.5) {
      P.hw = 1; addMana(12); dmg(P.burst > 0 ? 2 : 1);
    }
  }
}
function boltHit() {
  const T = P.bolt;
  if (!B.weak.open || T.hit) return;
  const w = weakPos();
  if (Math.hypot(w.x - T.x, w.y - T.y) >= B.weak.r + 6) return;
  T.hit = 1; addMana(10);
  const id = BOLTS[T.type].id, flame = id === 'flame' || id === 'thorn', vine = id === 'vine' || id === 'thorn';
  if (vine) { B.openT += 0.8; B.slow = 3.5; }
  if (flame) B.burn = 3;
  if (T.s === 'fly' && !flame) T.s = 'ground';           // flame pierces, everything else sticks
  dmg((P.burst > 0 ? 2 : 1) * 3);
}

// ---------------------------------------------------------------- boss
function updBoss(dt) {
  B.flash -= dt;
  const ph = phaseOf(); if (ph !== B.phase) { B.phase = ph; onPhase(); }
  B.k = B.ks[B.phase] || 1;
  if (B.cast) B.cast.t += dt;
  if (B.slow > 0) B.slow -= dt;
  if (B.burn > 0) { B.burn -= dt; B.bt -= dt; if (B.bt <= 0) { B.bt = 0.6; dmg(1, true); if (state !== 'play') return; } }
  if (B.openT > 0) B.openT -= dt;
  if (B.onTick) B.onTick(dt);
  const sk = B.slow > 0 ? 0.5 : 1;
  if (!B.stun) { const d = norm(Math.atan2(P.y - B.y, P.x - B.x) - B.face), s = B.turn * sk * dt; B.face += Math.abs(d) < s ? d : Math.sign(d) * s; }
  if (B.tgt) {
    const dx = B.tgt.x - B.x, dy = B.tgt.y - B.y, d = Math.hypot(dx, dy), s = B.tgt.sp * sk * dt;
    if (d <= s) { B.x = B.tgt.x; B.y = B.tgt.y; B.tgt = null; } else { B.x += dx / d * s; B.y += dy / d * s; }
  }
  if (B.cond) { if (B.cond()) B.cond = null; else return; }
  B.wait -= dt * (B.slow > 0 ? 0.85 : 1);
  if (B.wait <= 0) {
    const r = B.gen.next(), v = r.value;
    if (typeof v === 'number') B.wait = v; else if (typeof v === 'function') B.cond = v; else B.wait = 0;
  }
}
function updZones(dt) {
  for (const z of zones) {
    z.t += dt;
    if (!z.fired && z.t >= z.tel) {
      z.fired = true;
      if (boomCd <= 0) { AUD.sfx('boom'); FX.shake(z.k === 'c' && z.r < 60 ? 3 : 6); boomCd = 0.12; }
    }
    if (z.t >= z.tel && z.t < z.tel + z.act) {
      const pr = P.r * 0.6; let h = false;
      if (z.k === 'c') h = Math.hypot(P.x - z.x, P.y - z.y) < z.r + pr;
      else if (z.k === 'b') {
        const ux = Math.cos(z.a), uy = Math.sin(z.a), px = P.x - z.x, py = P.y - z.y, s = clamp(px * ux + py * uy, 0, z.len);
        h = Math.hypot(px - ux * s, py - uy * s) < z.w / 2 + pr;
      } else if (z.k === 'r') { const d = Math.hypot(P.x - z.x, P.y - z.y); h = d > z.r0 - pr && d < z.r1 + pr; }
      else h = P.x > z.x - pr && P.x < z.x + z.w + pr && P.y > z.y - pr && P.y < z.y + z.h + pr;
      if (h) hurt();
    }
  }
  compact(zones, zoneAlive);
}
function updBullets(dt) {
  for (const b of bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (Math.hypot(b.x - P.x, b.y - P.y) < b.r + P.r * 0.6) hurt();
    if (b.x < A.x - 40 || b.x > A.x + A.w + 40 || b.y < A.y - 40 || b.y > A.y + A.h + 40) b.dead = 1;
  }
  compact(bullets, bulletAlive);
}

// ---------------------------------------------------------------- main update
function play(dt) {
  tm += dt;
  updP(dt); if (state !== 'play') return;
  updBoss(dt); if (state !== 'play') return;
  updZones(dt); updBullets(dt);
  if (Math.random() < dt * 6) FX.parts.push({ x: rr(A.x, A.x + A.w), y: A.y + A.h + 4, vx: rr(-8, 8), vy: -rr(15, 40), l: 4, m: 4, size: 2, c: B.theme.glow, drag: 0, glow: true });
}
function update(rdt) {
  t += rdt;
  let dt = rdt;
  if (FX.hs > 0) { FX.hs -= rdt; dt = rdt * 0.06; }      // hit-stop: near-freeze for a few frames
  dodgeCd -= dt; boomCd -= dt; clangCd -= dt;
  uiUpdate(rdt);
  if (state === 'intro') { sub -= dt; if (sub <= 0) { state = 'play'; AUD.setIntensity(0.35); } }
  else if (state === 'play') play(dt);
  else if (state === 'dead') {            // let the killing hazard finish and fade instead of freezing on screen
    sub += rdt; bullets = [];
    for (const z of zones) z.t += rdt;
    compact(zones, zoneAlive);
  }
  else if (state === 'clear') {
    sub -= dt;
    if (sub <= 0) { if (bi + 1 < BOSSES.length) begin(bi + 1); else { state = 'win'; UI.mi = 0; } }
  }
  if (state !== 'paused') FX.update(dt, rdt);
}
