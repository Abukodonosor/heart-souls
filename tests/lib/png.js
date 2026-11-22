'use strict';
// Minimal PNG reader (8-bit RGBA, non-interlaced) so tests can read hero.png without a browser or any dependency.
const zlib = require('zlib'), fs = require('fs');
function decodePNG(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(file + ' is not a PNG');
  let i = 8, w = 0, h = 0; const idat = [];
  while (i < b.length) {
    const n = b.readUInt32BE(i), type = b.toString('ascii', i + 4, i + 8), d = b.subarray(i + 8, i + 8 + n);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 8 || d[9] !== 6 || d[12] !== 0) throw new Error('only 8-bit RGBA, non-interlaced PNG is supported'); }
    else if (type === 'IDAT') idat.push(d);
    i += 12 + n;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp, out = new Uint8ClampedArray(w * h * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, up = prev[x], c = x >= bpp ? prev[x - bpp] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? up : c); }
      cur[x] = v & 255;
    }
    out.set(cur, y * stride); prev = cur;
  }
  return { width: w, height: h, data: out };
}
module.exports = { decodePNG };
