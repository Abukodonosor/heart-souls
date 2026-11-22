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
// Abyssal Blade: a 3-wide pixel blade (gray / purple / white) from (x0,y0) at angle a (radians, y down), length len.
// The outline is the 8-neighbour dilation of the body, so it is closed at every angle (offsetting a line by +-2 leaves gaps on steep angles).
function drawBlade(img, x0, y0, a, len, roles) {
  const W = GEN.srcW, H = GEN.srcH, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, body = new Map();
  for (const [k, col] of [[-1, roles.gray], [1, roles.white], [0, roles.purple]])         // purple core last so it wins
    for (let i = -2; i <= len; i++) body.set(Math.round(x0 + ux * i + nx * k) + ',' + Math.round(y0 + uy * i + ny * k), col);
  const put = (x, y, col) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = at(x, y); img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2]; img[o + 3] = 255; };
  for (const key of body.keys()) { const [x, y] = key.split(',').map(Number); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!body.has((x + dx) + ',' + (y + dy))) put(x + dx, y + dy, roles.black); }
  for (const [key, col] of body) { const [x, y] = key.split(',').map(Number); put(x, y, col); }
}
// ---- how a frame is built (the rules that keep pixel art free of tears) -------------------------------------------
// 1. The whole figure moves only as ONE rigid block (body dx/dy). Never shear rows against each other: that cuts the
//    outline along the full width of the figure.
// 2. The hand block moves rigidly (movePart) and the blade is drawn UNDER the glove.
// 3. Cloak tails move by stretching from the inside: duplicate (or drop) interior pixels of a run, so the tip moves
//    while the root stays put and every local pixel pattern stays one that already exists in the drawing.
// tools/metrics.js counts the defects (new 2x2 patterns, exposed edges, holes); tests/sprites.js enforces limits.
const TAIL = { r0: 50, r1: 73, leftRoot: 21, rightRoot: r => r < 66 ? 36 : 41 };   // art coordinates of where the cloak tails hang free

function place(src, dx, dy) {                 // rigid placement of the drawing on the frame canvas
  const { padX, padY, srcW, srcH } = GEN, W = SPR.W, H = SPR.H, out = new Uint8ClampedArray(W * H * 4);
  for (let r = 0; r < srcH; r++) for (let c = 0; c < srcW; c++) {
    const k = at(c, r); if (!src[k + 3]) continue;
    const x = c + padX + dx, y = r + padY + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
    out.set(src.subarray(k, k + 4), (y * W + x) * 4);
  }
  return out;
}
// Resize the run of pixels [x0..x1] on one row to length+k, anchored at the end that touches the body. Ends keep their pixels.
function stretchRun(out, y, x0, x1, k, anchorRight) {
  const W = SPR.W, L = x1 - x0 + 1, n = L + k; if (k === 0 || n < 2 || L < 2) return;
  const row = []; for (let x = x0; x <= x1; x++) row.push(out.slice((y * W + x) * 4, (y * W + x) * 4 + 4));
  const start = anchorRight ? x1 - n + 1 : x0;
  for (let x = Math.min(x0, start); x <= Math.max(x1, start + n - 1); x++) if (x >= 0 && x < W) out.fill(0, (y * W + x) * 4, (y * W + x) * 4 + 4);
  for (let i = 0; i < n; i++) { const x = start + i; if (x < 0 || x >= W) continue; out.set(row[Math.round(i * (L - 1) / (n - 1))], (y * W + x) * 4); }
}
function stretchTails(out, bodyDx, bodyDy, kL, kR) {
  const { padX, padY } = GEN, W = SPR.W;
  for (let r = TAIL.r0; r <= TAIL.r1; r++) {
    const y = r + padY + bodyDy, a = kL(r), b = kR(r);
    if (a) {                                             // left tail: free end is the leftmost opaque pixel, anchored at leftRoot
      const root = TAIL.leftRoot + padX + bodyDx; let x0 = root; for (let x = 0; x <= root; x++) if (out[(y * W + x) * 4 + 3]) { x0 = x; break; }
      if (x0 < root) stretchRun(out, y, x0, root, a, true);
    }
    if (b) {                                             // right tail: free end is the rightmost opaque pixel, anchored at rightRoot
      const root = TAIL.rightRoot(r) + padX + bodyDx; let x1 = root; for (let x = W - 1; x >= root; x--) if (out[(y * W + x) * 4 + 3]) { x1 = x; break; }
      if (x1 > root) stretchRun(out, y, root, x1, b, false);
    }
  }
}
// Empty cells that are fully enclosed by the figure (not reachable from the border): gaps and holes.
function enclosed(img, W, H) {
  const seen = new Uint8Array(W * H), st = [], cells = [];
  for (let x = 0; x < W; x++) st.push([x, 0], [x, H - 1]);
  for (let y = 0; y < H; y++) st.push([0, y], [W - 1, y]);
  while (st.length) { const [x, y] = st.pop(); if (x < 0 || y < 0 || x >= W || y >= H || seen[y * W + x] || img[(y * W + x) * 4 + 3]) continue; seen[y * W + x] = 1; st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
  for (let i = 0; i < W * H; i++) if (!seen[i] && !img[i * 4 + 3]) cells.push(i);
  return cells;
}
const isCloth = (r, g, b) => (r > 50 && g < 60 && r > g * 2.5) || (r > 200 && g > 100 && g < 190 && b < 60);   // the cloak's reds and its orange lining; white, gray, yellow and purple are not cloth
// Repair what moving parts can leave behind, using the drawing's own rules:
//  1. a gap that is not one of the drawing's own holes is closed with the outline colour (a dark seam between parts);
//  2. cloth on the cloak tails never touches empty space bare: the drawing outlines every tail in black.
function repair(out, bd, ctx) {
  const { padX, padY } = GEN, W = SPR.W, H = SPR.H, K = ctx.roles.black, allow = new Set();
  for (const [c, r] of ctx.srcHoles) allow.add((r + padY + bd.dy) * W + c + padX + bd.dx);
  const paint = i => { out[i * 4] = K[0]; out[i * 4 + 1] = K[1]; out[i * 4 + 2] = K[2]; out[i * 4 + 3] = 255; };
  for (const i of enclosed(out, W, H)) if (!allow.has(i)) paint(i);
  for (let r = TAIL.r0; r <= TAIL.r1; r++) {
    const y = r + padY + bd.dy, lo = TAIL.leftRoot + padX + bd.dx, hi = TAIL.rightRoot(r) + padX + bd.dx;
    for (let x = 0; x < W; x++) {
      if (!(x <= lo || x >= hi)) continue;
      const k = (y * W + x) * 4; if (!out[k + 3] || !isCloth(out[k], out[k + 1], out[k + 2])) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx < 0 || ny < 0 || nx >= W || ny >= H || !out[(ny * W + nx) * 4 + 3]; })) paint(y * W + x);
    }
  }
}
function heroFrame(src, p, ctx) {
  const bd = p.body || { dx: 0, dy: 0 }, out = place(src, bd.dx, bd.dy);
  if (p.kL || p.kR) stretchTails(out, bd.dx, bd.dy, p.kL || none, p.kR || none);
  if (ctx) repair(out, bd, ctx);
  const c = document.createElement('canvas'); c.width = SPR.W; c.height = SPR.H;
  c.getContext('2d').putImageData(new ImageData(out, SPR.W, SPR.H), 0, 0);
  return c;
}
function mirrorFrame(c) {                      // exact 1:1 horizontal flip, no resampling
  const o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
  const g = o.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0);
  return o;
}

const none = () => 0, rad = d => d * PI / 180;
const env = r => Math.pow(Math.max(0, Math.min(1, (r - TAIL.r0) / (TAIL.r1 - TAIL.r0))), 1.3);
// cloak ripple: a wave travelling down the tail, measured against phase 0 so frame 0 of a loop is the untouched drawing
const wave = (A, p, side) => r => { const ph = (r - TAIL.r0) * 0.3 + side; return Math.round(A * env(r) * (Math.sin(p * TAU - ph) + Math.sin(ph))); };
const stream = (A, sign) => r => sign * Math.round(A * env(r));        // both tails blown backwards (dash): left shortens, right lengthens

// f(i) -> { body:{dx,dy} rigid move, kL(r)/kR(r) tail stretch, hand:{dx,dy}, blade:{a,len} }.  The drawing looks LEFT, so forward = -x.
const HANIMS = {
  idle:   { n: 8, fps: 8,  loop: true,  f: i => ({ kL: wave(1.7, i / 8, 0), kR: wave(1.7, i / 8, 1.3), hand: { dx: 0, dy: [0, 0, 1, 1, 1, 1, 0, 0][i] } }) },
  walk:   { n: 6, fps: 12, loop: true,  f: i => ({ body: { dx: 0, dy: [0, -1, 0, 0, -1, 0][i] }, kL: wave(2.6, i / 6, 0), kR: wave(2.6, i / 6, 1.3), hand: { dx: [1, 1, 0, -1, -1, 0][i], dy: [0, -1, 0, 0, -1, 0][i] } }) },
  dash:   { n: 3, fps: 18, loop: false, f: i => ({ body: { dx: -(2 + i * 2), dy: 0 }, kL: stream(2 + i * 1.5, -1), kR: stream(2 + i * 1.5, 1) }) },
  attack: { n: 6, fps: 30, loop: false, f: i => ({ body: { dx: -[0, 1, 2, 3, 2, 1][i], dy: 0 }, kL: wave(1.2, i / 6, 0), kR: wave(1.2, i / 6, 1.3),
    hand: [{ dx: 0, dy: 0 }, { dx: 3, dy: -9 }, { dx: -2, dy: -7 }, { dx: -8, dy: -2 }, { dx: -9, dy: 3 }, { dx: -3, dy: 1 }][i],        // windup up/back, strike forward, follow through
    blade: i === 0 ? null : { a: rad([0, -84, -140, 180, 145, 120][i]), len: i === 5 ? 9 : 19 } }) },   // windup angle keeps the blade (and its outline) inside the 48px drawing
  death:  { n: 4, fps: 8,  loop: false, f: i => ({ body: { dx: 0, dy: [0, 1, 2, 3][i] }, kL: stream(i, 1), kR: stream(i, -1) }) },     // slumps; the renderer lays it down with an exact 90-degree turn
};
function genHeroSet(portrait = DH.portrait) {
  const src = srcArray(portrait), roles = paletteRoles(src), frames = [], anims = {};
  const ctx = { roles, srcHoles: enclosed(src, GEN.srcW, GEN.srcH).map(i => [i % GEN.srcW, Math.floor(i / GEN.srcW)]) };
  for (const an of Object.keys(HANIMS)) {
    const def = HANIMS[an], left = [], right = [];
    for (let i = 0; i < def.n; i++) {
      const p = def.f(i), hd = p.hand && (p.hand.dx || p.hand.dy) ? p.hand : null; let img = src;
      const bladeOn = a => drawBlade(a, HAND.cx + (hd ? hd.dx : 0), HAND.cy + (hd ? hd.dy : 0), p.blade.a, p.blade.len, roles);
      if (hd) img = movePart(src, HAND, hd.dx, hd.dy, { under: p.blade ? bladeOn : null, edge: roles.black });
      else if (p.blade) { img = new Uint8ClampedArray(src); bladeOn(img); }
      left.push(heroFrame(img, p, ctx));
    }
    const idxL = left.map(f => frames.push(f) - 1), idxR = left.map(f => frames.push(mirrorFrame(f)) - 1);
    anims[an + '_L'] = { frames: idxL, fps: def.fps, loop: def.loop };
    anims[an + '_R'] = { frames: idxR, fps: def.fps, loop: def.loop };
  }
  return { frames, anims };
}
