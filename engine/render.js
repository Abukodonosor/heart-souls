'use strict';
// DARKHEART rendering. Reads game state and draws it; the only thing it writes is UI.rects (menu hit boxes).

let floorCv = null, vigCv = null;

// Pre-rendered glow sprites: one drawImage per bullet / for the hero's light, instead of shadowBlur or a gradient built every frame.
function radialSprite(size, stops) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, col] of stops) r.addColorStop(at, col);
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  return c;
}
const GLOW = radialSprite(32, [[0, 'rgba(255,130,90,.85)'], [0.4, 'rgba(255,70,40,.32)'], [1, 'rgba(255,40,20,0)']]);
const LIGHT = radialSprite(340, [[0, 'rgba(170,90,255,.17)'], [1, 'rgba(0,0,0,0)']]);

// ---------------------------------------------------------------- cached layers
function buildFloor(th) {
  const c = document.createElement('canvas'); c.width = A.w; c.height = A.h;
  const g = c.getContext('2d');
  g.fillStyle = th.floor; g.fillRect(0, 0, A.w, A.h);
  let s = th.seed || 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;   // seeded: same floor every run
  for (let i = 0; i < 600; i++) { g.fillStyle = 'rgba(255,255,255,' + (rnd() * 0.035) + ')'; g.fillRect(rnd() * A.w | 0, rnd() * A.h | 0, 2, 2); }
  g.strokeStyle = th.line; g.lineWidth = 1; g.beginPath();           // 95 x 86 px tiles = 8 x 5 grid (bosses use it)
  for (let x = 0; x <= A.w; x += 95) { g.moveTo(x, 0); g.lineTo(x, A.h); }
  for (let y = 0; y <= A.h; y += 86) { g.moveTo(0, y); g.lineTo(A.w, y); }
  g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.4)';
  for (let i = 0; i < 26; i++) {
    g.beginPath(); let x = rnd() * A.w, y = rnd() * A.h; g.moveTo(x, y);
    for (let j = 0; j < 6; j++) { x += rnd() * 44 - 22; y += rnd() * 44 - 22; g.lineTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = th.accent; g.globalAlpha = 0.28; g.lineWidth = 2;       // central sigil
  const cx = A.w / 2, cy = A.h / 2;
  for (const r of [150, 100]) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); }
  g.beginPath(); for (let i = 0; i < 5; i++) { const a = -PI / 2 + i * 2 * TAU / 5; g.lineTo(cx + Math.cos(a) * 150, cy + Math.sin(a) * 150); } g.closePath(); g.stroke();
  g.globalAlpha = 1;
  floorCv = c;
}
function vignette() {
  if (vigCv) return vigCv;
  const c = document.createElement('canvas'); c.width = CFG.W; c.height = CFG.H;
  const g = c.getContext('2d'), r = g.createRadialGradient(480, 270, 200, 480, 270, 620);
  r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,.78)');
  g.fillStyle = r; g.fillRect(0, 0, CFG.W, CFG.H);
  return (vigCv = c);
}

// ---------------------------------------------------------------- small shapes
function heart(x, y, s, c) {
  ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y + s * 0.6);
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.1, x - s * 0.6, y - s * 0.9, x, y - s * 0.3);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 0.9, x + s * 1.1, y - s * 0.1, x, y + s * 0.6); ctx.fill();
}
function bar(x, y, w, h, v, c, bg = '#1a1a22') {
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c; ctx.fillRect(x, y, w * clamp(v, 0, 1), h);
}
function text(s, x, y, size, c, align = 'center', bold = true) {
  ctx.font = (bold ? 'bold ' : '') + size + 'px monospace'; ctx.textAlign = align; ctx.fillStyle = c; ctx.fillText(s, x, y);
}
// the face the hero is rebuilding: one part lights up per boss felled
function faceIcon(x, y, w, h, lit) {
  const on = i => lit(i), col = i => on(i) ? '#d8d8e0' : '#2c2c38';
  ctx.save(); ctx.translate(x + w / 2, y + h / 2);
  ctx.lineWidth = Math.max(2, w * 0.06); ctx.strokeStyle = col(4); ctx.beginPath(); ctx.ellipse(0, 0, w * 0.42, h * 0.46, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = col(0); ctx.beginPath(); ctx.ellipse(-w * 0.17, -h * 0.08, w * 0.07, h * 0.05, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col(1); ctx.beginPath(); ctx.ellipse(w * 0.17, -h * 0.08, w * 0.07, h * 0.05, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = col(3); ctx.lineWidth = Math.max(1.5, w * 0.04); ctx.beginPath(); ctx.moveTo(0, -h * 0.02); ctx.lineTo(-w * 0.05, h * 0.12); ctx.lineTo(w * 0.05, h * 0.12); ctx.stroke();
  ctx.strokeStyle = col(2); ctx.beginPath(); ctx.arc(0, h * 0.2, w * 0.14, 0.2, PI - 0.2); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- hazards
function zonePath(z, k) {
  ctx.beginPath();
  if (z.k === 'c') ctx.arc(z.x, z.y, z.r * k, 0, TAU);
  else if (z.k === 'b') {
    const ux = Math.cos(z.a), uy = Math.sin(z.a), nx = -uy * z.w / 2 * k, ny = ux * z.w / 2 * k, ex = z.x + ux * z.len, ey = z.y + uy * z.len;
    ctx.moveTo(z.x + nx, z.y + ny); ctx.lineTo(ex + nx, ey + ny); ctx.lineTo(ex - nx, ey - ny); ctx.lineTo(z.x - nx, z.y - ny); ctx.closePath();
  } else if (z.k === 'r') {
    ctx.arc(z.x, z.y, z.r0 + (z.r1 - z.r0) * k, 0, TAU); ctx.moveTo(z.x + z.r0, z.y); ctx.arc(z.x, z.y, z.r0, 0, TAU);
  } else { const w = z.w * k, h = z.h * k; ctx.rect(z.x + (z.w - w) / 2, z.y + (z.h - h) / 2, w, h); }
}
function drawZone(z) {
  const tel = z.t < z.tel, p = Math.min(1, z.t / z.tel);
  ctx.save();
  if (tel) {
    ctx.setLineDash([12, 8]); ctx.lineDashOffset = -t * 50; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,70,80,.9)';
    ctx.fillStyle = 'rgba(255,40,60,' + (0.16 + 0.05 * Math.sin(t * 16)) + ')'; zonePath(z, 1); ctx.fill('evenodd'); ctx.stroke();
    // circles fill from the centre outward; beams, rings and rectangles ramp up in opacity - either way it reads as a countdown
    ctx.fillStyle = 'rgba(255,40,60,' + (z.k === 'c' ? 0.3 : 0.32 * p) + ')'; zonePath(z, z.k === 'c' ? p : 1); ctx.fill('evenodd');
  } else {
    const a = 1 - (z.t - z.tel) / z.act;
    ctx.fillStyle = 'rgba(255,' + (130 + 100 * a | 0) + ',' + (130 + 100 * a | 0) + ',' + ((z.k === 'x' || z.k === 'r' ? 0.38 : 0.5) + 0.45 * a) + ')';
    zonePath(z, 1); ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255,90,90,' + (0.5 * a) + ')'; ctx.lineWidth = 7; ctx.stroke();   // cheap glow: shadowBlur cost grows with shape size (a 1600px ring cost 600 ms)
  }
  ctx.restore();
}

// ---------------------------------------------------------------- actors
function drawBoss() {
  const k = B.flash > 0;
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(B.x, B.y + B.r * 0.85, B.r * 1.05, B.r * 0.34, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(B.x, B.y); ctx.shadowColor = B.theme.glow; ctx.shadowBlur = 22;
  if (B.draw) B.draw(ctx, k); else { ctx.fillStyle = k ? '#fff' : '#120819'; ctx.beginPath(); ctx.arc(0, 0, B.r, 0, TAU); ctx.fill(); }
  ctx.restore();
  const w = weakPos();
  if (B.weak.open) {
    const g = 10 + 4 * Math.sin(t * 14);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,210,60,.35)'; ctx.beginPath(); ctx.arc(w.x, w.y, B.weak.r + g, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fd4'; ctx.beginPath(); ctx.arc(w.x, w.y, B.weak.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w.x, w.y, B.weak.r + 4 + Math.sin(t * 10) * 2, 0, TAU); ctx.stroke();
  } else { ctx.fillStyle = '#2a2a33'; ctx.beginPath(); ctx.arc(w.x, w.y, B.weak.r * 0.45, 0, TAU); ctx.fill(); }
}
function drawPlayer() {
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(P.x, P.y + 10, 12, 5, 0, 0, TAU); ctx.fill();
  if (!DH.ready) return;
  const nm = state === 'dead' ? 'death' : P.dash > 0 ? 'dash' : P.swing > 0 ? 'attack' : (P.vx || P.vy) ? 'walk' : 'idle';
  if (P.nm !== nm) { P.nm = nm; P.ts = t; }
  if (nm !== 'death') {                                     // facing: attacks and dashes follow their direction, walking follows movement, standing follows the aim
    P.faceR = nm === 'attack' ? Math.cos(P.sa) > 0 : nm === 'dash' ? P.dx > 0 : P.vx !== 0 ? P.vx > 0 : Math.cos(P.aim) > 0;
  }
  const im = dhFrame(nm + (P.faceR ? '_R' : '_L'), t - P.ts) || DH.frames[0]; if (!im) return;
  let al = 1; if (nm === 'dash') al = 0.65;
  if (nm === 'death') al = Math.max(0, 1 - Math.max(0, t - P.ts - 0.6) * 0.8);
  if (P.inv > 0 && state === 'play' && Math.floor(t * 20) % 2) al *= 0.35;                     // post-hit blink
  const S = 0.8;
  ctx.save(); ctx.globalAlpha = al; ctx.translate(P.x, P.y + 10); ctx.imageSmoothingEnabled = false;
  if (P.burst > 0) { ctx.shadowColor = '#6af'; ctx.shadowBlur = 20; } else if (P.drink > 0) { ctx.shadowColor = '#f93'; ctx.shadowBlur = 18; }
  ctx.drawImage(im, -im.width / 2 * S, -SPR.FEET * S, im.width * S, im.height * S);
  ctx.restore();
  if (P.swing > 0 && state !== 'dead') {
    const a = clamp(P.swing / 0.14, 0, 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(190,120,255,' + a + ')'; ctx.lineWidth = 10 * a + 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(P.x, P.y - 8, 52, P.sa - 1.3, P.sa + 1.3); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(P.x, P.y - 8, 52, P.sa - 1.2, P.sa + 1.2); ctx.stroke(); ctx.restore();
  }
}
function drawBolt() {
  const T = P.bolt; if (T.s === 'held') return;
  const c = BOLTS[T.type].c;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = c; ctx.shadowBlur = 16; ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(T.x, T.y, T.s === 'ground' ? 5 + Math.sin(t * 8) * 1.5 : 6, 0, TAU); ctx.fill();
  if (T.s === 'ground') { ctx.strokeStyle = c; ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(T.x, T.y, 12 + Math.sin(t * 5) * 3, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- HUD
function hud() {
  text(B.name, 480, 19, 16, '#fff');
  const bx = 280, by = 27, bw = 400;
  bar(bx, by, bw, 10, B.hp / B.max, B.phase > 0 ? '#f80' : '#d22', '#3a0b0b');
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  if (B.phases === 3) { ctx.fillRect(bx + bw * 0.33, by, 1, 10); ctx.fillRect(bx + bw * 0.66, by, 1, 10); } else ctx.fillRect(bx + bw * 0.5, by, 1, 10);
  if (B.cast) {
    text(B.cast.name, 480, 56, 13, '#fff'); bar(330, 61, 300, 7, B.cast.t / B.cast.T, '#fff', '#2a2a33');
  }
  if (B.weak.open) text('WEAK POINT OPEN', 480, 82, 12, '#fd4');

  text(tm.toFixed(1) + 's', 14, 20, 14, '#aaa', 'left', false);
  text(MODE.name, 14, 36, 11, '#c6f', 'left');
  for (let i = 0; i < P.maxhp; i++) heart(24 + i * 22, 56, 8, i < P.hp ? '#e33' : '#3a1a22');
  if (MODE.stamina) bar(14, 72, 130, 7, P.stam / CFG.stam.max, P.stamWait > 0 ? '#7a7' : '#6d6', '#1c2a1c');
  if (MODE.flasks) {
    for (let i = 0; i < MODE.flasks; i++) {
      const fx = 20 + i * 18, full = i < P.flasks;
      ctx.fillStyle = full ? '#f93' : '#3a2a1a'; ctx.fillRect(fx - 4, 90, 8, 10); ctx.fillRect(fx - 2, 86, 4, 5);
    }
    text(P.drink > 0 ? 'DRINKING...' : 'F: flask', 90, 98, 10, '#a86', 'left', false);
  }
  const lit = i => SAVE.isCleared(i);
  faceIcon(CFG.W - 54, 8, 40, 48, lit);

  text('MANA', 14, 516, 12, '#8bf', 'left');
  bar(60, 508, 200, 9, P.burst > 0 ? P.burst / CFG.burstT : P.mana / 100, P.burst > 0 || P.mana >= 100 ? '#6cf' : '#38c', '#102030');
  if (P.burst > 0) text('BURST', 270, 516, 12, '#6cf', 'left'); else if (P.mana >= 100) text('Q: BURST', 270, 516, 12, '#6cf', 'left');
  const bt = BOLTS[P.boltType], T = P.bolt;
  const st = { held: 'READY', fly: 'AWAY', ground: 'ON THE FLOOR', recall: 'RETURNING' }[T.s];
  ctx.fillStyle = T.s === 'held' ? bt.c : '#666'; ctx.beginPath(); ctx.arc(560, 512, 6, 0, TAU); ctx.fill();
  text(bt.name + '  ' + st, 574, 516, 12, T.s === 'held' ? bt.c : '#777', 'left');
  if (availableBolts().length > 1 && T.s === 'held') text('TAB: switch', 800, 516, 11, '#777', 'left', false);
}

// ---------------------------------------------------------------- overlays
function letterbox(h) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, CFG.W, h); ctx.fillRect(0, CFG.H - h, CFG.W, h); }
function spaced(on) { try { ctx.letterSpacing = on ? '6px' : '0px'; } catch (e) { /* older browsers */ } }
function overlayIntro() {
  const p = 2.6 - sub, a = Math.min(1, p / 0.5) * Math.min(1, sub / 0.45);
  letterbox(60 * Math.min(1, p / 0.4));
  ctx.globalAlpha = a; spaced(true);
  text(B.name, 480, 262, 44, '#fff'); spaced(false);
  text(B.epithet, 480, 296, 16, B.theme.glow, 'center', false);
  text('BOSS ' + (bi + 1) + ' / ' + BOSSES.length, 480, 226, 13, '#888', 'center', false);
  ctx.globalAlpha = 1;
}
function overlayDead() {
  const a = clamp(sub / 1.1, 0, 1);
  const g = ctx.createRadialGradient(480, 270, 60, 480, 270, 560); g.addColorStop(0, 'rgba(60,0,0,' + a * 0.55 + ')'); g.addColorStop(1, 'rgba(0,0,0,' + a * 0.9 + ')');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CFG.W, CFG.H);
  ctx.globalAlpha = a; spaced(true); text('YOU DIED', 480, 285, 72 + a * 8, '#a01010'); spaced(false); ctx.globalAlpha = 1;
  if (sub > 0.7) { text('ENTER  retry       ESC  menu', 480, 340, 15, '#999', 'center', false); text('deaths: ' + (SAVE.d.deaths[bi] || 0), 480, 362, 12, '#666', 'center', false); }
}
function overlayClear() {
  const p = 4.2 - sub;
  letterbox(Math.min(70, p * 140));
  const a = clamp(p / 0.6, 0, 1); ctx.globalAlpha = a; spaced(true);
  text('BOSS FELLED', 480, 250, 52, '#e8c14a'); spaced(false);
  if (p > 1.4) {
    ctx.globalAlpha = clamp((p - 1.4) / 0.6, 0, 1);
    text('FRAGMENT RECOVERED:  ' + clearInfo.frag, 480, 300, 20, '#fff');
    text('time ' + clearInfo.time.toFixed(1) + 's   best ' + clearInfo.best.toFixed(1) + 's   deaths ' + clearInfo.deaths, 480, 326, 13, '#aaa', 'center', false);
    if (clearInfo.bolt) text('NEW BOLT:  ' + clearInfo.bolt.name + '  -  ' + clearInfo.bolt.blurb, 480, 352, 14, clearInfo.bolt.c);
    faceIcon(730, 212, 56, 68, SAVE.isCleared.bind(SAVE));
  }
  ctx.globalAlpha = 1;
}
function drawMenu(items, x, y, gap, left = false) {      // left: table-style rows (boss select) instead of centred
  UI.rects = [];
  items.forEach((it, i) => {
    const sel = i === UI.mi, dis = it.disabled && it.disabled();
    const s = it.adj ? it.text() : (sel ? '> ' : '  ') + it.text() + (sel ? ' <' : '  ');   // adjustable rows already show < >
    ctx.font = (sel ? 'bold ' : '') + '20px monospace'; ctx.textAlign = left ? 'left' : 'center';
    ctx.fillStyle = dis ? '#4a4a55' : sel ? '#fff' : '#9a8aaa';
    if (left) { ctx.fillText(it.text(), x, y + i * gap); if (sel) ctx.fillText('>', x - 28, y + i * gap); }
    else ctx.fillText(s, x, y + i * gap);
    const w = ctx.measureText(left ? it.text() : s).width; UI.rects.push({ x: left ? x - 30 : x - w / 2, y: y + i * gap - 20, w: w + (left ? 30 : 0), h: 28 });
  });
  const cur = items[UI.mi];
  if (cur && cur.sub) text(cur.sub(), x, y + items.length * gap + 8, 13, '#c6f', 'center', false);
}
function floorBackdrop() {
  ctx.drawImage(floorCv, A.x, A.y);
  ctx.strokeStyle = '#7a2a9a'; ctx.lineWidth = 3; ctx.strokeRect(A.x, A.y, A.w, A.h);
  for (const p of FX.parts) { ctx.fillStyle = p.c; ctx.globalAlpha = clamp(p.l / p.m, 0, 1); ctx.fillRect(p.x - 1, p.y - 1, 2, 2); } ctx.globalAlpha = 1;
}
function drawTitle() {
  ctx.fillStyle = '#050308'; ctx.fillRect(0, 0, CFG.W, CFG.H);
  floorBackdrop();
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(A.x, A.y, A.w, A.h);
  if (Math.random() < 0.3) FX.parts.push({ x: rr(A.x, A.x + A.w), y: A.y + A.h, vx: rr(-6, 6), vy: -rr(20, 60), l: 5, m: 5, size: 2, c: '#a0f', drag: 0 });
  if (DH.ready && DH.portrait) {                               // the hero, large, breathing
    const im = DH.portrait, S = 2.7, bob = Math.sin(t * 2) * 3;
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.shadowColor = '#a0f'; ctx.shadowBlur = 24;
    ctx.drawImage(im, 150, 120 + bob, im.width * S, im.height * S); ctx.restore();
  }
  spaced(true); ctx.shadowColor = '#a0f'; ctx.shadowBlur = 24;
  text('DARKHEART', 600, 150, 60, '#d03030'); ctx.shadowBlur = 0; spaced(false);
  text('a boss rush for a man with no face', 600, 178, 14, '#9a8aaa', 'center', false);
  if (state === 'title') drawMenu(menuItems(), 600, 250, 36);
  text('WASD move   SPACE dash   LMB/J blade   RMB/K bolt (again = recall)', 600, 440, 11, '#777', 'center', false);
  text('TAB switch bolt   Q burst   F flask   ESC pause   M mute', 600, 456, 11, '#777', 'center', false);
  text('hit the glowing weak point on the boss\'s back - only while it is open', 600, 476, 11, '#a86', 'center', false);
}
function drawSelect() {
  ctx.fillStyle = '#050308'; ctx.fillRect(0, 0, CFG.W, CFG.H); floorBackdrop();
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(A.x, A.y, A.w, A.h);
  text('BOSS SELECT', 480, 130, 30, '#fff');
  drawMenu(menuItems(), 290, 200, 40, true);
  faceIcon(CFG.W - 120, 90, 60, 72, SAVE.isCleared.bind(SAVE));
}
function overlayWin() {
  ctx.fillStyle = 'rgba(0,0,0,.82)'; ctx.fillRect(0, 0, CFG.W, CFG.H);
  faceIcon(420, 90, 120, 144, () => true);
  spaced(true); text('THE FACE IS WHOLE', 480, 290, 40, '#e8c14a'); spaced(false);
  text('...but whose face is it?', 480, 322, 15, '#aaa', 'center', false);
  text('deaths: ' + SAVE.d.totalDeaths, 480, 352, 13, '#777', 'center', false);
  drawMenu(menuItems(), 480, 410, 34);
}
function overlayPause() {
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 0, CFG.W, CFG.H);
  text('PAUSED', 480, 170, 40, '#fff'); drawMenu(menuItems(), 480, 250, 38);
}

// ---------------------------------------------------------------- frame
function drawWorld() {
  ctx.save();
  if (FX.sk > 0) ctx.translate(rr(-1, 1) * FX.sk, rr(-1, 1) * FX.sk);
  ctx.drawImage(floorCv, A.x, A.y);
  ctx.save(); ctx.shadowColor = B.theme.glow; ctx.shadowBlur = 14; ctx.strokeStyle = B.theme.accent; ctx.lineWidth = 3; ctx.strokeRect(A.x, A.y, A.w, A.h); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(A.x, A.y, A.w, A.h); ctx.clip();
  for (const z of zones) drawZone(z);
  if (!(state === 'clear' && sub < 2.6)) drawBoss();
  drawBolt();
  if (bullets.length) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const b of bullets) { const s = b.r * 3.4; ctx.drawImage(GLOW, b.x - s, b.y - s, s * 2, s * 2); }
    ctx.restore();
    ctx.fillStyle = '#f64'; ctx.beginPath(); for (const b of bullets) { ctx.moveTo(b.x + b.r, b.y); ctx.arc(b.x, b.y, b.r, 0, TAU); } ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); for (const b of bullets) { ctx.moveTo(b.x + b.r * 0.4, b.y); ctx.arc(b.x, b.y, b.r * 0.4, 0, TAU); } ctx.fill();
  }
  ctx.restore();
  // soft light around the hero
  if (state !== 'dead') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(LIGHT, P.x - 170, P.y - 170); ctx.restore();
  }
  drawPlayer();
  for (const p of FX.parts) if (!p.glow) { ctx.globalAlpha = clamp(p.l / p.m, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';            // all glowing particles in one blend-mode pass
  for (const p of FX.parts) if (p.glow) { ctx.globalAlpha = clamp(p.l / p.m, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  ctx.restore(); ctx.globalAlpha = 1;
  for (const x of FX.texts) { ctx.globalAlpha = clamp(x.l / x.m * 1.5, 0, 1); text(x.s, x.x, x.y, 16, x.c); } ctx.globalAlpha = 1;
  ctx.restore();
  ctx.drawImage(vignette(), 0, 0);
}
function draw() {
  UI.rects = [];
  ctx.fillStyle = '#050308'; ctx.fillRect(0, 0, CFG.W, CFG.H);
  if (state === 'title') drawTitle();
  else if (state === 'select') drawSelect();
  else {
    drawWorld(); hud();
    if (state === 'intro') overlayIntro();
    else if (state === 'dead') overlayDead();
    else if (state === 'clear') overlayClear();
    else if (state === 'win') overlayWin();
    else if (state === 'paused') overlayPause();
  }
  if (FX.flash > 0) { ctx.globalAlpha = clamp(FX.flash, 0, 1) * 0.55; ctx.fillStyle = FX.flashC; ctx.fillRect(0, 0, CFG.W, CFG.H); ctx.globalAlpha = 1; }
}
