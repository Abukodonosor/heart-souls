'use strict';
// Procedural 8-direction pixel sprites for Darkheart, in the palette of the original art (hero.png).
// Five directions are authored (E, SE, S, NE, N); W, SW, NW are mirrors, flipped at draw time.
// Frame = 36x52, feet at (18, 48). Shapes are drawn with canvas paths, then alpha-thresholded, palette-snapped and outlined
// so the result is crisp pixel art. Everything here can be overridden by frames drawn in the editor.

const HP = {
  out: '#0a0508', coat: '#951414', coatD: '#5c0a0a', coatL: '#c02626', hood: '#7a1010', hoodD: '#4a0707', trim: '#a52fc8',
  mask: '#a8a8b2', maskD: '#6c6c76', white: '#f4f4f8', black: '#0c0c10', pants: '#2b322d', pantsD: '#1b201d', boot: '#454945', bootD: '#2a2d2a',
  glove: '#ececf0', gold: '#ffd23a', orange: '#ff9a10', blade: '#5a22a0', bladeL: '#dcb0ff',
};
const HDIRS = { E: [1, 0], SE: [0.72, 0.72], S: [0, 1], NE: [0.72, -0.72], N: [0, -1] };
const HW = 36, HH = 52;

function hline(g, x0, y0, x1, y1, w, c) { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
function hpoly(g, pts, c) { g.fillStyle = c; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); }
function hell(g, x, y, rx, ry, c) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
const lerp = (a, b, k) => a + (b - a) * k;

// pose: bob (px up), ph (walk phase 0..1 or null), stride, sway (coat), tail (extra coat tail), lean (px toward facing), atk (0..1), k (death 0..1)
function drawHeroPose(g, dn, pose) {
  const [vx, vy] = HDIRS[dn], ax = Math.abs(vx), ay = Math.abs(vy);
  const cx = 18, feet = 48, bob = pose.bob || 0, lean = pose.lean || 0, sway = pose.sway || 0, tailX = pose.tail || 0;
  const hw = 3.8 + 4.2 * ay;
  const shY = feet - 28 - bob, hipY = feet - 16, hemY = feet - 8, headY = feet - 35 - bob;
  const ux = cx + vx * lean, ph = pose.ph, stride = pose.stride || 4;
  g.save();
  if (pose.k != null) {                                           // death: topple over about the feet
    const s = vx > 0.3 ? -1 : 1, k = pose.k;
    g.translate(-s * k * 17, 0); g.translate(cx, feet); g.rotate(s * k * PI / 2 * 0.96); g.translate(-cx, -feet + k * 4);
  }
  const leg = i => {
    const p = ph == null ? 0 : ph + i * 0.5, f = ph == null ? 0 : Math.sin(p * TAU), lift = ph == null ? 0 : Math.max(0, Math.cos(p * TAU)) * 2.4;
    const side = i ? 1 : -1, hx = cx + side * (0.8 + 2.4 * ay);
    return { f, side, hx, fx: hx + vx * f * stride, fy: feet + vy * f * stride * 0.45 - lift };
  };
  const arm = i => {
    const side = i ? 1 : -1, sx = ux + side * (hw * ay * 0.95 + 0.9), sy = shY + 2.5, L = leg(i ? 0 : 1), sw = ph == null ? 0 : -L.f * 3.2;
    return { sx, sy, hx: sx + side * 0.6 + vx * sw, hy: sy + 10.5 + vy * sw * 0.45 };
  };
  // 1. coat tail streaming behind (side / diagonal views)
  if (ax > 0.3) {
    const tl = (4 + tailX + sway * 0.6) * ax;
    hpoly(g, [[ux - vx * (hw - 1), shY + 3], [ux - vx * (hw + tl), hemY + 1], [ux - vx * (hw + tl * 0.4), hemY + 4], [ux - vx * 0.5, hipY + 1]], HP.coatD);
  }
  // 2. legs + boots
  for (const i of [0, 1]) {
    const L = leg(i);
    hline(g, L.hx, hipY, L.fx, L.fy - 1.5, 3.8, i ? HP.pants : HP.pantsD);
    hell(g, L.fx + vx * 1.3, L.fy, 2.9, 1.9, i ? HP.boot : HP.bootD);
  }
  // 3. far arm (behind the coat)
  const A0 = arm(0);
  hline(g, A0.sx, A0.sy, A0.hx, A0.hy, 3.2, HP.coatD); hell(g, A0.hx, A0.hy, 1.5, 1.5, HP.mask);
  // 4. coat
  const hemL = cx - hw - 2.8 + sway * ay, hemR = cx + hw + 2.8 + sway * ay;
  hpoly(g, [[ux - hw + 0.4, shY], [ux + hw - 0.4, shY], [ux + hw + 0.4, shY + 2], [ux + hw - 0.8 + sway * 0.4, hipY], [hemR, hemY], [cx + sway * 0.6, hemY - 1.8], [hemL, hemY], [ux - hw + 0.8 + sway * 0.4, hipY], [ux - hw - 0.4, shY + 2]], HP.coat);
  if (ay > 0.3) {
    g.globalAlpha = 0.75; hpoly(g, [[ux + hw * 0.25, shY], [ux + hw - 0.4, shY], [ux + hw - 0.8 + sway * 0.4, hipY], [hemR, hemY], [cx + hw * 0.3 + sway * 0.6, hemY - 1.4]], HP.coatD); g.globalAlpha = 1;
    hline(g, ux - hw + 1.4, shY + 1.5, hemL + 1.4, hemY - 1, 1.3, HP.coatL);
  } else hline(g, ux + vx * (hw - 1), shY + 1.5, ux + vx * (hw - 0.6), hipY, 1.3, HP.coatL);
  if (vy > 0.3) {                                                  // front: black shirt strip, orange lining, gold brooch
    const o = vx * hw * 0.5;
    hpoly(g, [[ux - 1.8 * ay + o, shY], [ux + 1.8 * ay + o, shY], [cx + 2.6 * ay + o * 0.6 + sway * 0.6, hemY - 1], [cx - 2.6 * ay + o * 0.6 + sway * 0.6, hemY - 1]], HP.black);
    hline(g, cx - 3.2 * ay + o * 0.6 + sway * 0.6, hemY - 6, cx - 3.9 * ay + o * 0.6 + sway, hemY - 0.5, 1.5, HP.orange);
    hpoly(g, [[ux - hw * 0.75 + vx * 2, shY + 1.4], [ux - hw * 0.75 + vx * 2 + 1.4, shY + 3], [ux - hw * 0.75 + vx * 2, shY + 4.6], [ux - hw * 0.75 + vx * 2 - 1.4, shY + 3]], HP.gold);
  } else if (vy < -0.3) hline(g, ux + sway * 0.2, shY + 5, cx + sway * 0.8, hemY - 2, 1, HP.coatD);   // back seam
  // 5. head
  const hx0 = ux + vx * 1.4, hy0 = headY;
  hell(g, hx0 - vx * 0.5, hy0 + 6, 3.4, 2.2, HP.black);
  hpoly(g, [[hx0 - 5.4, hy0 - 2], [hx0 - vx * 5 - 0.5, hy0 - 12.5], [hx0 + 5.4, hy0 - 2]], HP.hoodD);
  hell(g, hx0, hy0, 6.5, 6.7, HP.hoodD);
  hell(g, hx0 - 1.1, hy0 - 0.8, 5.4, 5.7, HP.hood);
  if (vy > -0.3) {
    const ox = hx0 + vx * 2.6, oy = hy0 + 0.6 + vy * 1.4, rx = 3.7 - 1.7 * ax, ry = 4.7;
    hell(g, ox, oy, rx + 1.2, ry + 1.2, HP.trim); hell(g, ox, oy, rx, ry, HP.black);
    hell(g, ox + vx * 0.5, oy + 0.4, Math.max(1.2, rx - 0.9), ry - 1, HP.mask);
    hell(g, ox + vx * 0.5 + rx * 0.25, oy + 1.2, Math.max(0.8, rx * 0.4), ry - 2.4, HP.maskD);
    hline(g, ox - 0.4 + vx * 0.5, oy - 2.4, ox - 0.9 + vx * 0.5, oy + 1.8, 1.2, HP.white);
  } else {
    hline(g, hx0, hy0 - 7, hx0, hy0 + 4.5, 1, HP.hoodD);
    hline(g, hx0 - 4.8, hy0 + 5, hx0 + 4.8, hy0 + 5, 1.3, HP.trim);
  }
  // 6. near arm + Abyssal Blade
  const A1 = arm(1);
  if (pose.atk != null) {
    const k = pose.atk, a0 = Math.atan2(vy * 0.8, vx);
    const wind = k < 0.25 ? lerp(0, -1.5, k / 0.25) : k < 0.6 ? lerp(-1.5, 1.3, (k - 0.25) / 0.35) : 1.3;
    const a = a0 + wind, len = k < 0.7 ? 15 : 10;
    A1.hx = A1.sx + Math.cos(a) * 8.5; A1.hy = A1.sy + 2 + Math.sin(a) * 5;
    const tx = A1.hx + Math.cos(a) * len, ty = A1.hy + Math.sin(a) * len * 0.62;
    g.globalAlpha = 0.35; hline(g, A1.hx, A1.hy, tx, ty, 5.4, HP.bladeL); g.globalAlpha = 1;
    hline(g, A1.hx, A1.hy, tx, ty, 2.8, HP.blade); hline(g, A1.hx, A1.hy, tx, ty, 1, HP.bladeL);
  }
  hline(g, A1.sx, A1.sy, A1.hx, A1.hy, 3.4, HP.coat); hell(g, A1.hx, A1.hy, 1.7, 1.7, HP.glove);
  g.restore();
}

// ---- pixel finishing: threshold alpha, snap to palette, 1px outline
const HPAL = Object.values(HP).map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
function hfinish(c) {
  const g = c.getContext('2d'), W = c.width, H = c.height, d = g.getImageData(0, 0, W, H), px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 110) { px[i + 3] = 0; continue; }
    px[i + 3] = 255; let best = 0, bd = 1e9;
    for (let p = 0; p < HPAL.length; p++) { const q = HPAL[p], e = (q[0] - px[i]) ** 2 + (q[1] - px[i + 1]) ** 2 + (q[2] - px[i + 2]) ** 2; if (e < bd) { bd = e; best = p; } }
    px[i] = HPAL[best][0]; px[i + 1] = HPAL[best][1]; px[i + 2] = HPAL[best][2];
  }
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && px[(y * W + x) * 4 + 3] > 0, out = new Uint8ClampedArray(px);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) {
    const k = (y * W + x) * 4; out[k] = 10; out[k + 1] = 5; out[k + 2] = 8; out[k + 3] = 255;
  }
  g.putImageData(new ImageData(out, W, H), 0, 0);
  return c;
}
function heroFrame(dn, pose) { const c = document.createElement('canvas'); c.width = HW; c.height = HH; drawHeroPose(c.getContext('2d'), dn, pose); return hfinish(c); }

const HANIMS = {
  idle:   { n: 4, fps: 4,  loop: true,  pose: i => ({ bob: 0.6 + Math.sin(i / 4 * TAU) * 0.7, sway: Math.sin(i / 4 * TAU) * 1 }) },
  walk:   { n: 6, fps: 11, loop: true,  pose: i => ({ ph: i / 6, bob: Math.abs(Math.sin(i / 6 * TAU)) * 1.4, sway: Math.sin(i / 6 * TAU + 1) * 1.8, stride: 4.2 }) },
  dash:   { n: 3, fps: 18, loop: false, pose: i => ({ ph: 0.2 + i * 0.08, stride: 6.5, lean: 2.6, bob: -0.5, sway: -4, tail: 5 }) },
  attack: { n: 5, fps: 24, loop: false, pose: i => ({ atk: i / 4, lean: i > 1 && i < 4 ? 1.8 : 0, bob: 0.4, sway: i > 1 ? -2 : 1 }) },
  death:  { n: 6, fps: 8,  loop: false, pose: i => ({ k: i / 5, bob: 0, sway: 0 }) },
};
const HDIR_LIST = ['E', 'SE', 'S', 'NE', 'N'];
function genHeroSet() {
  const frames = [], anims = {};
  for (const an of Object.keys(HANIMS)) for (const dn of HDIR_LIST) {
    const def = HANIMS[an], idx = [];
    for (let i = 0; i < def.n; i++) { idx.push(frames.length); frames.push(heroFrame(dn, def.pose(i))); }
    anims[an + '_' + dn] = { frames: idx, fps: def.fps, loop: def.loop };
  }
  return { frames, anims };
}
