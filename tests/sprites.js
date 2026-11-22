'use strict';
// Headless sprite pipeline test (same guarantees as tools/validate.html, but runs in the terminal / CI): node tests/sprites.js
// It reads hero.png with its own PNG decoder, independent of the engine's loader, and checks the engine's output against it.
const vm = require('vm'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
require('./lib/canvas-shim').install(root);
const { decodePNG } = require('./lib/png');
const { metrics } = require('./lib/metrics');
for (const f of ['util', 'sprite', 'spritegen']) vm.runInThisContext(fs.readFileSync(path.join(root, 'engine', f + '.js'), 'utf8'), { filename: f + '.js' });
const E = vm.runInThisContext('({ PORT, SPR, GEN, DH, genHeroSet, dhInit, dhLoadPortrait, dhFrame })');

let failed = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failed++; };

(async () => {
  const { PORT, SPR, GEN } = E, raw = decodePNG(path.join(root, 'hero.png')), PX = PORT.PX, N = raw.width / PX;
  // ---- the drawing itself
  ok(raw.width % PX === 0 && raw.width === raw.height, `hero.png is ${raw.width}px = ${N}x${N} art pixels of ${PX}px`);
  let nonUniform = 0, minC = 999, maxC = 0, minR = 999, maxR = 0, rawOpaque = 0, rawWhite = 0; const rawColors = new Set();
  const cell = (q, r, dx, dy) => ((r * PX + dy) * raw.width + q * PX + dx) * 4;
  for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
    const k = cell(q, r, 6, 6);
    for (const [dx, dy] of [[1, 1], [10, 1], [1, 10], [10, 10]]) { const k2 = cell(q, r, dx, dy); for (let t = 0; t < 4; t++) if (raw.data[k + t] !== raw.data[k2 + t]) { nonUniform++; break; } }
    if (raw.data[k + 3] >= 128) {
      rawOpaque++; minC = Math.min(minC, q); maxC = Math.max(maxC, q); minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      rawColors.add(raw.data[k] + ',' + raw.data[k + 1] + ',' + raw.data[k + 2]);
      if (raw.data[k] > 235 && raw.data[k + 1] > 235 && raw.data[k + 2] > 235) rawWhite++;
    }
  }
  ok(nonUniform === 0, `every art pixel is a uniform ${PX}x${PX} block (${nonUniform} are not)`);
  ok(minC === PORT.ox && minR === PORT.oy && maxC - minC + 1 === PORT.W && maxR - minR + 1 === PORT.H, `bounding box matches PORT: ${maxC - minC + 1}x${maxR - minR + 1} at ${minC},${minR}`);

  // ---- engine loader vs independent read
  const portrait = await E.dhLoadPortrait('');
  const P = portrait.getContext('2d').getImageData(0, 0, PORT.W, PORT.H).data;
  let opaque = 0, white = 0, mism = 0; const palette = new Set();
  for (let j = 0; j < PORT.H; j++) for (let i = 0; i < PORT.W; i++) {
    const a = (j * PORT.W + i) * 4, k = cell(PORT.ox + i, PORT.oy + j, 6, 6), rawOp = raw.data[k + 3] >= 128;
    if (!!P[a + 3] !== rawOp) mism++;
    if (P[a + 3]) { opaque++; palette.add(P[a] + ',' + P[a + 1] + ',' + P[a + 2]); if (P[a] > 235 && P[a + 1] > 235 && P[a + 2] > 235) white++; for (let t = 0; t < 3; t++) if (P[a + t] !== raw.data[k + t]) { mism++; break; } }
  }
  ok(mism === 0, `portrait equals the PNG pixel for pixel (${mism} differences)`);
  ok(opaque === rawOpaque, `all ${rawOpaque} opaque pixels kept (got ${opaque})`);
  ok(white === rawWhite && white > 20, `white art survives: glove + mask slit (${white} of ${rawWhite})`);
  ok(palette.size === rawColors.size, `palette identical: ${palette.size} colours`);

  // ---- generated animation
  const t0 = Date.now(), set = E.genHeroSet(portrait), ms = Date.now() - t0;
  ok(ms < 3000, `generated ${set.frames.length} frames in ${ms} ms`);
  ok(set.frames.every(f => f.width === SPR.W && f.height === SPR.H), `every frame is ${SPR.W}x${SPR.H}`);
  const px = c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const F0 = px(set.frames[set.anims.idle_L.frames[0]]); let diff = 0;
  for (let y = 0; y < GEN.srcH; y++) for (let x = 0; x < GEN.srcW; x++) { const a = (y * GEN.srcW + x) * 4, b = ((y + GEN.padY) * SPR.W + x + GEN.padX) * 4; for (let k = 0; k < 4; k++) if (P[a + k] !== F0[b + k]) { diff++; break; } }
  ok(diff === 0, `idle frame 0 is pixel-identical to the drawing (${diff} differences)`);
  let foreign = 0, edge = 0, minPx = 1e9, maxPx = 0, n = 0;
  for (const an in set.anims) for (const fi of set.anims[an].frames) {
    n++; const d = px(set.frames[fi]); let cnt = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { cnt++; if (!palette.has(d[i] + ',' + d[i + 1] + ',' + d[i + 2])) foreign++; }
    for (let x = 0; x < SPR.W; x++) for (const y of [0, SPR.H - 1]) if (d[(y * SPR.W + x) * 4 + 3]) edge++;
    for (let y = 0; y < SPR.H; y++) for (const x of [0, SPR.W - 1]) if (d[(y * SPR.W + x) * 4 + 3]) edge++;
    if (!an.startsWith('death')) { minPx = Math.min(minPx, cnt); maxPx = Math.max(maxPx, cnt); }
  }
  ok(foreign === 0, `all ${n} frames use only the drawing's colours (${foreign} foreign pixels)`);
  ok(edge === 0, `no frame touches the canvas edge (${edge} pixels)`);
  ok(minPx > opaque * 0.9 && maxPx < opaque * 1.1, `pixel count within 10% of the drawing, death excluded (${minPx}..${maxPx} vs ${opaque})`);
  // white art (glove, mask slit) must stay in the same number of connected pieces: a pixel left behind when the hand moves splits it
  const whitePieces = (d, W, H) => {
    const seen = new Uint8Array(W * H), isW = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] && d[(y * W + x) * 4] > 235 && d[(y * W + x) * 4 + 1] > 235 && d[(y * W + x) * 4 + 2] > 235;
    let pieces = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isW(x, y) && !seen[y * W + x]) {
      pieces++; const st = [[x, y]];
      while (st.length) { const [i, j] = st.pop(); if (!isW(i, j) || seen[j * W + i]) continue; seen[j * W + i] = 1; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) st.push([i + dx, j + dy]); }
    }
    return pieces;
  };
  const piecesSrc = whitePieces(P, PORT.W, PORT.H); let splitFrames = [];
  for (const an in set.anims) { if (an.startsWith('attack') || an.startsWith('death')) continue; set.anims[an].frames.forEach((fi, k) => { const c = whitePieces(px(set.frames[fi]), SPR.W, SPR.H); if (c !== piecesSrc) splitFrames.push(`${an}[${k}]=${c}`); }); }
  ok(splitFrames.length === 0, `white art stays in ${piecesSrc} connected pieces in every frame` + (splitFrames.length ? ' (broken: ' + splitFrames.slice(0, 4).join(', ') + ')' : ''));
  // every animation moves; right-facing frames are exact mirrors; the blade appears in the attack
  for (const an in set.anims) {
    const f = set.anims[an].frames.map(i => px(set.frames[i])); let moved = false;
    for (let k = 1; k < f.length && !moved; k++) for (let i = 0; i < f[0].length; i++) if (f[k][i] !== f[0][i]) { moved = true; break; }
    if (!moved) ok(false, `${an} animation does not change between frames`);
  }
  let mirrorBad = 0, mirrorN = 0;
  for (const an in set.anims) {
    if (!an.endsWith('_L')) continue; const L = set.anims[an].frames, R = set.anims[an.slice(0, -1) + 'R'].frames;
    if (L.length !== R.length) { ok(false, `${an}: _L and _R frame counts differ`); continue; }
    L.forEach((li, k) => { const a = px(set.frames[li]), b = px(set.frames[R[k]]); mirrorN++; let bad = false;
      for (let y = 0; y < SPR.H && !bad; y++) for (let x = 0; x < SPR.W && !bad; x++) { const i = (y * SPR.W + x) * 4, j = (y * SPR.W + (SPR.W - 1 - x)) * 4; for (let t = 0; t < 4; t++) if (a[i + t] !== b[j + t]) { bad = true; break; } }
      if (bad) mirrorBad++; });
  }
  ok(mirrorBad === 0, `all ${mirrorN} right-facing frames are exact mirrors (${mirrorBad} differ)`);
  const purple = d => { let c = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] && d[i] === 156 && d[i + 1] === 39 && d[i + 2] === 176) c++; return c; };
  const bl = set.anims.attack_L.frames.map(i => purple(px(set.frames[i])));
  ok(bl[1] > bl[0] && bl[2] > bl[0] && bl[3] > bl[0], `attack frames show the blade (purple pixels: ${bl.join(', ')})`);

  // ---- visual defects: counted, with limits (see tests/lib/metrics.js). The original drawing is the baseline.
  const base = metrics(P, PORT.W, PORT.H, null);
  const LIMITS = { idle: [24, 3], walk: [28, 3], dash: [24, 3], death: [24, 3], attack: [60, 5] };      // [new 2x2 patterns, extra exposed edge pixels]; the blade adds patterns by definition
  const worst = {}, failedBefore = failed;
  for (const an in set.anims) {
    if (!an.endsWith('_L')) continue;                    // _R frames are proven exact mirrors of _L below, so measuring _L covers both
    const kind = an.slice(0, an.indexOf('_')), [maxNew, maxExp] = LIMITS[kind];
    set.anims[an].frames.forEach((fi, k) => {
      const c = set.frames[fi], m = metrics(px(c), c.width, c.height, base.pats), where = `${an}[${k}]`;
      const w = worst[kind] = worst[kind] || { n: 0, e: 0, at: '' };
      if (m.new2x2 > w.n) { w.n = m.new2x2; w.at = where; } w.e = Math.max(w.e, m.exposed - base.exposed);
      if (m.new2x2 > maxNew) ok(false, `${where}: ${m.new2x2} new 2x2 patterns (limit ${maxNew}) - torn or broken pixels`);
      if (m.exposed - base.exposed > maxExp) ok(false, `${where}: ${m.exposed - base.exposed} extra exposed edge pixels (limit ${maxExp}) - a cut outline`);
      if (m.orphans !== 0) ok(false, `${where}: ${m.orphans} stray pixel(s)`);
      if (m.holes !== base.holes) ok(false, `${where}: ${m.holes} enclosed gaps (the drawing has ${base.holes})`);
    });
  }
  ok(failed === failedBefore, 'no frame has torn pixels, cut outlines, stray dots or new gaps  [worst per animation: ' + Object.entries(worst).map(([k, w]) => `${k} ${w.n}px-patterns/+${w.e}edge`).join(', ') + ']');

  // ---- loader fallbacks: no saved art -> generated set; the engine must end up ready with every animation present
  await E.dhInit('');
  ok(E.DH.ready && Object.keys(E.DH.anims).length === 10 && E.DH.frames.length === set.frames.length, `dhInit without saved art is ready with ${Object.keys(E.DH.anims).length} animations`);
  ok(E.dhFrame('walk_R', 0.3) !== null && E.dhFrame('nope', 0) === null, 'dhFrame resolves known names and returns null for unknown ones');

  // stale saved art (wrong frame size) must be ignored, not break the game
  global.fetch = () => Promise.resolve({ ok: true, json: async () => ({ w: 36, h: 52, frames: [], anims: { idle: { frames: [0], fps: 8 } } }) });
  await E.dhInit('');
  ok(E.DH.ready && Object.keys(E.DH.anims).length === 10 && E.DH.frames.length === set.frames.length, 'saved art with the wrong frame size is ignored (generated set used)');
  // hero.png missing: the game must still come up (ready, no art, no throw)
  { const err = console.error; console.error = () => {}; global.fetch = () => Promise.reject(new Error('offline')); await E.dhInit('missing-dir/'); console.error = err; }
  ok(E.DH.ready && E.DH.portrait === null && E.DH.frames.length === 0, 'missing hero.png: engine is ready without art instead of hanging or throwing');
  console.log(failed ? `\nFAILED: ${failed}` : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
