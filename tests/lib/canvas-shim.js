'use strict';
// Just enough of the browser canvas for the sprite pipeline: pixel buffers, get/putImageData, 1:1 drawImage, horizontal flip.
const path = require('path'), { decodePNG } = require('./png');
class Ctx {
  constructor(c) { this.c = c; this.tx = 0; this.sx = 1; }
  translate(x) { this.tx += x * this.sx; }
  scale(x) { this.sx *= x; }
  drawImage(src, dx, dy) {
    const { width: sw, height: sh, data: sd } = src, c = this.c;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const k = (y * sw + x) * 4; if (!sd[k + 3]) continue;
      const X = this.sx > 0 ? this.tx + dx + x : this.tx - (dx + x) - 1, Y = dy + y;
      if (X < 0 || Y < 0 || X >= c.width || Y >= c.height) continue;
      const o = (Y * c.width + X) * 4; c.data[o] = sd[k]; c.data[o + 1] = sd[k + 1]; c.data[o + 2] = sd[k + 2]; c.data[o + 3] = sd[k + 3];
    }
  }
  getImageData(x, y, w, h) {
    const out = new Uint8ClampedArray(w * h * 4), c = this.c;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const s = ((y + j) * c.width + x + i) * 4, d = (j * w + i) * 4; out.set(c.data.subarray(s, s + 4), d); }
    return { data: out, width: w, height: h };
  }
  putImageData(img, x, y) {
    const c = this.c;
    for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) { const s = (j * img.width + i) * 4, d = ((y + j) * c.width + x + i) * 4; c.data.set(img.data.subarray(s, s + 4), d); }
  }
}
class Canvas {
  constructor() { this._w = 300; this._h = 150; this._alloc(); }
  _alloc() { this.data = new Uint8ClampedArray(this._w * this._h * 4); }
  get width() { return this._w; } set width(v) { this._w = v; this._alloc(); }
  get height() { return this._h; } set height(v) { this._h = v; this._alloc(); }
  getContext() { return this._ctx || (this._ctx = new Ctx(this)); }
}
class ImageData { constructor(data, w, h) { this.data = data; this.width = w; this.height = h; } }
function install(root) {
  global.document = { createElement: () => new Canvas() };
  global.ImageData = ImageData;
  global.Image = class {
    set src(v) {
      setImmediate(() => {
        try { const png = decodePNG(path.join(root, v.replace(/^(\.\.\/)+/, ''))); this.width = png.width; this.height = png.height; this.data = png.data; if (this.onload) this.onload(); }
        catch (e) { if (this.onerror) this.onerror(e); }
      });
    }
  };
  global.fetch = () => Promise.reject(new Error('offline'));
}
module.exports = { install };
