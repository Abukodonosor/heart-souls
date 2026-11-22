'use strict';
// Hero art loader. A native frame is 36x52 (feet on row 48). Frames come from, in priority order:
//   1. assets/darkheart.json  (saved by editor.html)    2. genHeroSet() in spritegen.js  (procedural defaults, 5 dirs + mirrors)
// DH.portrait is the original hero.png converted to real pixels (title screen, the Mirror boss).
const SPR = { W: 60, H: 94, FEET: 91 };      // frame canvas: the 48x87 drawing + padding for moving parts (see GEN in spritegen.js)
// hero.png is a clean 100x100 pixel-art grid, every art pixel = 12x12 image pixels (measured: 10000/10000 blocks uniform).
// The character fills cols 26..73, rows 9..95 of that grid = 48x87 art pixels, 2199 opaque, 13 colours. tools/validate.html re-checks all of this.
const PORT = { PX: 12, ox: 26, oy: 9, W: 48, H: 87 };
const DH = { frames: [], anims: {}, portrait: null, ready: false };
const dhCanvas = () => { const c = document.createElement('canvas'); c.width = SPR.W; c.height = SPR.H; return c; };

function dhLoadPortrait(prefix) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onerror = () => rej(new Error(prefix + 'hero.png failed to load'));
    im.onload = () => {
      const s = document.createElement('canvas'); s.width = im.width; s.height = im.height;
      const sx = s.getContext('2d'); sx.drawImage(im, 0, 0);
      const src = sx.getImageData(0, 0, im.width, im.height).data;
      const { W, H, PX, ox, oy } = PORT, px = new Uint8ClampedArray(W * H * 4);
      // The PNG's background is truly transparent. White pixels are real art (the glove, the mask slit), so only alpha decides.
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const k = (((oy + j) * PX + PX / 2) * im.width + ((ox + i) * PX + PX / 2)) * 4, o = (j * W + i) * 4;
        if (src[k + 3] >= 128) { px[o] = src[k]; px[o + 1] = src[k + 1]; px[o + 2] = src[k + 2]; px[o + 3] = 255; }
      }
      const o = document.createElement('canvas'); o.width = W; o.height = H; o.getContext('2d').putImageData(new ImageData(px, W, H), 0, 0); res(o);
    };
    im.src = prefix + 'hero.png';
  });
}
// Art saved by the editor. Rejected (with a console warning) when it does not match this build's frame size or shape,
// e.g. an old save from before the frame size changed: stale art must never break the game.
async function dhLoadSaved(prefix) {
  let j;
  try { const r = await fetch(prefix + 'assets/darkheart.json?' + Date.now()); if (!r.ok) return null; j = await r.json(); } catch (e) { return null; }
  if (!j || j.w !== SPR.W || j.h !== SPR.H || !Array.isArray(j.frames) || !j.anims || typeof j.anims !== 'object') { console.warn('Darkheart: saved art ignored (size or format does not match this build)'); return null; }
  try {
    const frames = await Promise.all(j.frames.map(u => new Promise((res, rej) => { const im = new Image(); im.onerror = () => rej(new Error('bad frame')); im.onload = () => { const c = dhCanvas(); c.getContext('2d').drawImage(im, 0, 0); res(c); }; im.src = u; })));
    const anims = {};
    for (const [n, a] of Object.entries(j.anims)) if (a && Array.isArray(a.frames) && a.frames.every(i => Number.isInteger(i) && i >= 0 && i < frames.length)) anims[n] = { frames: a.frames, fps: Number(a.fps) > 0 ? Number(a.fps) : 8, loop: a.loop !== false };
    return { frames, anims };
  } catch (e) { console.warn('Darkheart: saved art ignored (' + e.message + ')'); return null; }
}
async function dhInit(prefix = '') {
  DH.portrait = null; DH.frames = []; DH.anims = {};
  try { DH.portrait = await dhLoadPortrait(prefix); } catch (e) { console.error('Darkheart: ' + e.message); }
  if (DH.portrait) {
    const saved = await dhLoadSaved(prefix);
    if (saved) { DH.frames = saved.frames; DH.anims = saved.anims; }
    const gen = genHeroSet(DH.portrait);                          // fill in every animation the editor has not authored
    for (const n in gen.anims) {
      if (DH.anims[n] && DH.anims[n].frames.length) continue;
      const a = gen.anims[n];
      DH.anims[n] = { ...a, frames: a.frames.map(i => { DH.frames.push(gen.frames[i]); return DH.frames.length - 1; }) };
    }
  }
  DH.ready = true;                                                // even without art the game runs; drawing code skips a missing hero
}
function dhFrame(name, time) {
  const a = DH.anims[name]; if (!a || !a.frames || !a.frames.length) return null;
  const n = a.frames.length; let i = Math.floor(time * (a.fps || 8)); i = a.loop === false ? Math.min(i, n - 1) : i % n;
  return DH.frames[a.frames[i]] || null;
}
