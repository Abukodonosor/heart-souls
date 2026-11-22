'use strict';
// Hero animation built from the ORIGINAL art (hero.png). Nothing is redrawn freehand or resampled: each frame is made by
// moving whole rows and the hand block of the 48x87 source, so idle frame 0 is pixel-identical to the drawing and every
// later frame is still "the same drawing", moving. The only new pixels are the Abyssal Blade, drawn in the drawing's own
// colours. tools/validate.html checks all of this automatically.
// The drawing looks LEFT. Frames named *_L are that orientation; *_R are exact pixel mirrors of them.

// srcW/srcH are read lazily from PORT (sprite.js) so script load order does not matter.
const GEN = { padX: 6, padY: 4, get srcW() { return PORT.W; }, get srcH() { return PORT.H; } };
// Anatomy of the drawing, in art-pixel rows (measured with tools/grid.html on the 48x87 character):
const ROW = { head: 21, tail0: 47, boots: 74 };   // hood+mask 0-21, torso 22-46, coat tails + legs 47-73, leg wrap + boots 74-86
// The hand block: dark cuff + white glove of the arm on the right of the drawing. fillC = last column that is still "body"
// (cells the hand vacates up to there are filled with sleeve colour; beyond it they become empty air again).
const HAND = { c0: 35, r0: 38, c1: 44, r1: 50, fillC: 37, cx: 38, cy: 45 };   // c0=35: the glove has a white pixel at (35,42)

const at = (c, r) => (r * GEN.srcW + c) * 4;
function srcArray(portrait) { return new Uint8ClampedArray(portrait.getContext('2d').getImageData(0, 0, GEN.srcW, GEN.srcH).data); }

// Move the pixels inside rect R by (dx,dy). Returns a new array; the source is untouched.
// opt.under(out): draw something BEFORE the moved pixels are pasted (the blade goes under the glove, so the hand grips it).
// opt.edge: colour for a 1px outline closing the sleeve where the hand left it.
function movePart(src, R, dx, dy, opt = {}) {
  const W = GEN.srcW, H = GEN.srcH, out = new Uint8ClampedArray(src), moved = [], filled = new Set();
  for (let r = R.r0; r <= R.r1; r++) for (let c = R.c0; c <= R.c1; c++) {
    const k = at(c, r); if (!src[k + 3]) continue;
    moved.push([c, r, src[k], src[k + 1], src[k + 2]]); out[k + 3] = 0;
  }
  for (const [c, r] of moved) if (c <= R.fillC) {                    // vacated body cells: continue the sleeve with the nearest non-outline colour to the left
    for (let cc = R.c0 - 1; cc >= R.c0 - 4; cc--) {
      const k = at(cc, r);
      if (src[k + 3] && src[k] + src[k + 1] + src[k + 2] > 30) { const o = at(c, r); out[o] = src[k]; out[o + 1] = src[k + 1]; out[o + 2] = src[k + 2]; out[o + 3] = 255; filled.add(r); break; }
    }
  }
  if (opt.under) opt.under(out);
  for (const [c, r, R_, G, B] of moved) {
    const nc = c + dx, nr = r + dy; if (nc < 0 || nr < 0 || nc >= W || nr >= H) continue;
    const o = at(nc, nr); out[o] = R_; out[o + 1] = G; out[o + 2] = B; out[o + 3] = 255;
  }
  if (opt.edge) for (const r of filled) { const o = at(R.fillC + 1, r); if (!out[o + 3]) { out[o] = opt.edge[0]; out[o + 1] = opt.edge[1]; out[o + 2] = opt.edge[2]; out[o + 3] = 255; } }
  return out;
}
// the drawing's own colours by role, so the blade needs no new palette entries
function paletteRoles(src) {
  const roles = {};
  for (let i = 0; i < src.length; i += 4) {
    if (!src[i + 3]) continue;
    const r = src[i], g = src[i + 1], b = src[i + 2], col = [r, g, b];
    if (r > 235 && g > 235 && b > 235) roles.white = roles.white || col;
    else if (r + g + b < 30) roles.black = roles.black || col;
    else if (r > 120 && b > 150 && g < 90) roles.purple = roles.purple || col;
    else if (Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r > 140 && r < 200) roles.gray = roles.gray || col;
  }
  return roles;
}
// Abyssal Blade: a 3-wide pixel blade (gray / purple / white) with a black outline, from (x0,y0) at angle a (radians, y down).
function drawBlade(img, x0, y0, a, len, roles) {
  const W = GEN.srcW, H = GEN.srcH, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
  const put = (x, y, col) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const o = at(x, y); img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2]; img[o + 3] = 255; };
  const layers = [[-2, roles.black], [2, roles.black], [-1, roles.gray], [1, roles.white], [0, roles.purple]];   // outline first, bright core last
  for (const [k, col] of layers) for (let i = -2; i <= len; i++) put(x0 + ux * i + nx * k, y0 + uy * i + ny * k, col);
  put(x0 + ux * (len + 1), y0 + uy * (len + 1), roles.black); put(x0 + ux * (len + 2), y0 + uy * (len + 2), roles.black);   // tip
}
// Build one frame: rows shift by dx(r)/dy(r). A band that moved away (head lifting) leaves an empty row: repeat the row below.
function heroRows(src, dx, dy) {
  const { padX, padY, srcW, srcH } = GEN, W = SPR.W, H = SPR.H;
  const out = new Uint8ClampedArray(W * H * 4), rowHas = new Uint8Array(H);
  for (let r = 0; r < srcH; r++) {
    const ty = r + padY + dy(r), ox = dx(r);
    if (ty < 0 || ty >= H) continue;
    for (let c = 0; c < srcW; c++) {
      const k = at(c, r); if (!src[k + 3]) continue;
      const tx = c + padX + ox; if (tx < 0 || tx >= W) continue;
      const o = (ty * W + tx) * 4; out[o] = src[k]; out[o + 1] = src[k + 1]; out[o + 2] = src[k + 2]; out[o + 3] = 255; rowHas[ty] = 1;
    }
  }
  for (let y = 1; y < H - 1; y++) if (!rowHas[y] && rowHas[y - 1] && rowHas[y + 1]) out.copyWithin(y * W * 4, (y + 1) * W * 4, (y + 2) * W * 4);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d').putImageData(new ImageData(out, W, H), 0, 0);
  return c;
}
function mirrorFrame(c) {                      // exact 1:1 horizontal flip, no resampling
  const o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
  const g = o.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0);
  return o;
}

// cloak tails ripple: a travelling wave that grows toward the hem; boots stay planted.
// (the wave is measured relative to phase 0, so frame 0 of every loop is the untouched drawing)
const tail = (r, p, A) => { if (r < ROW.tail0 || r >= ROW.boots) return 0; const ph = (r - ROW.tail0) * 0.22; return Math.round(A * (Math.sin(p * TAU - ph) + Math.sin(ph)) * Math.min(1, (r - ROW.tail0) / 9)); };
const lean = (r, k) => -Math.round((ROW.boots - Math.min(r, ROW.boots)) / ROW.boots * k);   // forward = left in source space; the head leans most
const rad = d => d * PI / 180, none = () => 0;

// f(i) -> { dx(r), dy(r) row shifts, hand: {dx,dy} arm offset, blade: {a,len} }
const HANIMS = {
  idle:   { n: 8, fps: 8,  loop: true,  f: i => { const p = i / 8, up = Math.sin(p * TAU) > 0.4; return { dy: r => (up && r <= ROW.head) ? -1 : 0, dx: r => tail(r, p, 1.5), hand: { dx: 0, dy: [0, 0, 1, 1, 1, 1, 0, 0][i] } }; } },
  walk:   { n: 6, fps: 12, loop: true,  f: i => { const p = i / 6; return { dy: r => (r < ROW.boots && (i === 1 || i === 4)) ? -1 : 0, dx: r => tail(r, p, 2.4) + lean(r, 2.4) + (r >= ROW.boots ? [-1, 0, 1, 1, 0, -1][i] : 0), hand: { dx: [2, 1, -1, -3, -1, 1][i], dy: [0, -1, 0, 1, -1, 0][i] } }; } },
  dash:   { n: 3, fps: 18, loop: false, f: i => ({ dy: none, dx: r => lean(r, 3.6 + i * 1.8) + (r >= ROW.tail0 && r < ROW.boots ? 2 + i : 0), hand: { dx: 3 + i, dy: -1 } }) },
  attack: { n: 6, fps: 30, loop: false, f: i => ({ dy: none, dx: r => lean(r, [0, 1.8, 3.5, 4.8, 3, 1][i]),
    hand: [{ dx: 0, dy: 0 }, { dx: 3, dy: -9 }, { dx: -2, dy: -7 }, { dx: -8, dy: -2 }, { dx: -9, dy: 3 }, { dx: -3, dy: 1 }][i],       // windup up/back, strike forward, follow through
    blade: i === 0 ? null : { a: rad([0, -70, -140, 180, 145, 120][i]), len: i === 5 ? 9 : 19 } }) },
  death:  { n: 6, fps: 8,  loop: false, f: i => { const k = i / 5; return { dy: r => r < ROW.boots ? Math.round(k * 0.5 * (ROW.boots - r)) : 0, dx: r => lean(r, k * 12) }; } },
};
function genHeroSet(portrait = DH.portrait) {
  const src = srcArray(portrait), roles = paletteRoles(src), frames = [], anims = {};
  for (const an of Object.keys(HANIMS)) {
    const def = HANIMS[an], left = [], right = [];
    for (let i = 0; i < def.n; i++) {
      const p = def.f(i), hd = p.hand && (p.hand.dx || p.hand.dy) ? p.hand : null; let img = src;
      const bladeOn = a => drawBlade(a, HAND.cx + (hd ? hd.dx : 0), HAND.cy + (hd ? hd.dy : 0), p.blade.a, p.blade.len, roles);
      if (hd) img = movePart(src, HAND, hd.dx, hd.dy, { under: p.blade ? bladeOn : null, edge: roles.black });
      else if (p.blade) { img = new Uint8ClampedArray(src); bladeOn(img); }
      left.push(heroRows(img, p.dx, p.dy));
    }
    const idxL = left.map(f => frames.push(f) - 1), idxR = left.map(f => frames.push(mirrorFrame(f)) - 1);
    anims[an + '_L'] = { frames: idxL, fps: def.fps, loop: def.loop };
    anims[an + '_R'] = { frames: idxR, fps: def.fps, loop: def.loop };
  }
  return { frames, anims };
}
