'use strict';
// Hero art loader. A native frame is 36x52 (feet on row 48). Frames come from, in priority order:
//   1. assets/darkheart.json  (saved by editor.html)    2. genHeroSet() in spritegen.js  (procedural defaults, 5 dirs + mirrors)
// DH.portrait is the original hero.png converted to real pixels (title screen, the Mirror boss).
const SPR = { W: 36, H: 52, FEET: 48 };
const PORT = { W: 40, H: 72, PX: 15, ox: 315, oy: 105 };       // geometry of the source art: 15px blocks
const DH = { frames: [], anims: {}, portrait: null, ready: false };
const dhCanvas = () => { const c = document.createElement('canvas'); c.width = SPR.W; c.height = SPR.H; return c; };

function dhLoadPortrait(prefix) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const s = document.createElement('canvas'); s.width = im.width; s.height = im.height;
      const sx = s.getContext('2d'); sx.drawImage(im, 0, 0);
      const src = sx.getImageData(0, 0, im.width, im.height).data;
      const { W, H, PX, ox, oy } = PORT, px = new Uint8ClampedArray(W * H * 4), bg = new Uint8Array(W * H);
      const get = (i, j) => { const k = ((oy + j * PX + 7) * im.width + (ox + i * PX + 7)) * 4; return [src[k], src[k + 1], src[k + 2], src[k + 3]]; };
      const white = (i, j) => { const p = get(i, j); return p[3] < 128 || (p[0] > 235 && p[1] > 235 && p[2] > 235); };
      const st = [];                                            // flood-fill the white background from the border only,
      for (let i = 0; i < W; i++) st.push([i, 0], [i, H - 1]);   // so the white glove and mask slit survive
      for (let j = 0; j < H; j++) st.push([0, j], [W - 1, j]);
      while (st.length) { const [i, j] = st.pop(); if (i < 0 || j < 0 || i >= W || j >= H || bg[j * W + i] || !white(i, j)) continue; bg[j * W + i] = 1; st.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]); }
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const p = get(i, j), k = (j * W + i) * 4; px[k] = p[0]; px[k + 1] = p[1]; px[k + 2] = p[2]; px[k + 3] = bg[j * W + i] ? 0 : 255; }
      const o = document.createElement('canvas'); o.width = W; o.height = H; o.getContext('2d').putImageData(new ImageData(px, W, H), 0, 0); res(o);
    };
    im.src = prefix + 'hero.png';
  });
}
async function dhInit(prefix = '') {
  DH.portrait = await dhLoadPortrait(prefix); DH.frames = []; DH.anims = {};
  try {
    const r = await fetch(prefix + 'assets/darkheart.json?' + Date.now());
    if (r.ok) {
      const j = await r.json();
      DH.frames = await Promise.all(j.frames.map(u => new Promise(res => { const im = new Image(); im.onload = () => { const c = dhCanvas(); c.getContext('2d').drawImage(im, 0, 0); res(c); }; im.src = u; })));
      DH.anims = j.anims || {};
    }
  } catch (e) { /* no saved art yet: use the generated set */ }
  const gen = genHeroSet();                                     // fill in every animation the editor has not authored
  for (const n in gen.anims) {
    if (DH.anims[n] && DH.anims[n].frames.length) continue;
    const a = gen.anims[n];
    DH.anims[n] = { ...a, frames: a.frames.map(i => { DH.frames.push(gen.frames[i]); return DH.frames.length - 1; }) };
  }
  DH.ready = true;
}
function dhFrame(name, time) {
  const a = DH.anims[name]; if (!a || !a.frames || !a.frames.length) return null;
  const n = a.frames.length; let i = Math.floor(time * (a.fps || 8)); i = a.loop === false ? Math.min(i, n - 1) : i % n;
  return DH.frames[a.frames[i]] || null;
}
