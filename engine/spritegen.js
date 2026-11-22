'use strict';
// Hero animation built from the ORIGINAL art (hero.png). Nothing is redrawn or resampled: each frame is made by moving
// whole pixel rows of the 40x72 source, so idle frame 0 is pixel-identical to the drawing and every later frame is
// still "the same drawing", just moving. tools/validate.html checks that automatically.
// The source art looks LEFT; the engine mirrors it when the hero aims right.
// srcW/srcH are read lazily from PORT (sprite.js) so script load order does not matter.
const GEN = { padX: 6, padY: 4, get srcW() { return PORT.W; }, get srcH() { return PORT.H; } };

// dx(r) / dy(r): offset in art pixels for source row r (see ROW below for what each band of rows contains).
function heroRows(portrait, dx, dy) {
  const { padX, padY, srcW, srcH } = GEN, W = SPR.W, H = SPR.H;
  const src = portrait.getContext('2d').getImageData(0, 0, srcW, srcH).data;
  const out = new Uint8ClampedArray(W * H * 4), rowHas = new Uint8Array(H);
  for (let r = 0; r < srcH; r++) {
    const ty = r + padY + dy(r), ox = dx(r);
    if (ty < 0 || ty >= H) continue;
    for (let c = 0; c < srcW; c++) {
      const k = (r * srcW + c) * 4; if (!src[k + 3]) continue;
      const tx = c + padX + ox; if (tx < 0 || tx >= W) continue;
      const o = (ty * W + tx) * 4; out[o] = src[k]; out[o + 1] = src[k + 1]; out[o + 2] = src[k + 2]; out[o + 3] = 255; rowHas[ty] = 1;
    }
  }
  // a band that moved away (head lifting off the shoulders) leaves an empty row: repeat the row BELOW it (dark neck/shoulders)
  for (let y = 1; y < H - 1; y++) if (!rowHas[y] && rowHas[y - 1] && rowHas[y + 1]) out.copyWithin(y * W * 4, (y + 1) * W * 4, (y + 2) * W * 4);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d').putImageData(new ImageData(out, W, H), 0, 0);
  return c;
}
// Anatomy of the drawing, in art-pixel rows (measured with tools/grid.html on the 48x87 character):
const ROW = { head: 21, tail0: 47, boots: 74 };   // hood+mask 0-21, torso 22-46, coat tails + legs 47-73, leg wrap + boots 74-86
// cloak tails ripple: a travelling wave that grows toward the hem; boots stay planted.
// (the wave is measured relative to phase 0, so frame 0 of every loop is the untouched drawing)
const tail = (r, p, A) => { if (r < ROW.tail0 || r >= ROW.boots) return 0; const ph = (r - ROW.tail0) * 0.22; return Math.round(A * (Math.sin(p * TAU - ph) + Math.sin(ph)) * Math.min(1, (r - ROW.tail0) / 9)); };
const lean = (r, k) => -Math.round((ROW.boots - Math.min(r, ROW.boots)) / ROW.boots * k);   // forward = left in source space; the head leans most

const HANIMS = {
  idle:   { n: 8, fps: 8,  loop: true,  f: i => { const p = i / 8, up = Math.sin(p * TAU) > 0.4; return { dy: r => (up && r <= ROW.head) ? -1 : 0, dx: r => tail(r, p, 1.5) }; } },
  walk:   { n: 6, fps: 12, loop: true,  f: i => { const p = i / 6; return { dy: r => (r < ROW.boots && (i === 1 || i === 4)) ? -1 : 0, dx: r => tail(r, p, 2.4) + lean(r, 2.4) + (r >= ROW.boots ? [-1, 0, 1, 1, 0, -1][i] : 0) }; } },
  dash:   { n: 3, fps: 18, loop: false, f: i => ({ dy: () => 0, dx: r => lean(r, 3.6 + i * 1.8) + (r >= ROW.tail0 && r < ROW.boots ? 2 + i : 0) }) },
  attack: { n: 5, fps: 24, loop: false, f: i => ({ dy: () => 0, dx: r => lean(r, [0, 1.8, 4.8, 4.8, 1.8][i]) + tail(r, i / 5, 1) }) },
  death:  { n: 6, fps: 8,  loop: false, f: i => { const k = i / 5; return { dy: r => r < ROW.boots ? Math.round(k * 0.5 * (ROW.boots - r)) : 0, dx: r => lean(r, k * 12) }; } },
};
function genHeroSet(portrait = DH.portrait) {
  const frames = [], anims = {};
  for (const an of Object.keys(HANIMS)) {
    const def = HANIMS[an], idx = [];
    for (let i = 0; i < def.n; i++) { const p = def.f(i); idx.push(frames.length); frames.push(heroRows(portrait, p.dx, p.dy)); }
    anims[an] = { frames: idx, fps: def.fps, loop: def.loop };
  }
  return { frames, anims };
}
