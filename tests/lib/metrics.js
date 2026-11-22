'use strict';
// Frame defect metrics shared by tools/metrics.js (report) and tests/sprites.js (limits).
//  new2x2  = 2x2 colour patterns that do not occur anywhere in the original drawing (tears and broken outlines create these)
//  exposed = opaque non-black pixels touching empty space (an outline that was cut away)
//  orphans = opaque pixels with no opaque neighbour (stray dots)      holes = enclosed empty regions (the original has its own)
function metrics(d, W, H, known) {
  const A = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
  const col = (x, y) => A(x, y) ? ((d[(y * W + x) * 4] << 16) | (d[(y * W + x) * 4 + 1] << 8) | d[(y * W + x) * 4 + 2]) + 1 : 0;
  const pats = new Set(); let exposed = 0, orphans = 0;
  for (let y = -1; y < H; y++) for (let x = -1; x < W; x++) pats.add(col(x, y) + '|' + col(x + 1, y) + '|' + col(x, y + 1) + '|' + col(x + 1, y + 1));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y)) {
    const c = col(x, y) - 1, black = c === 0, n = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    if (!black && n.some(([dx, dy]) => !A(x + dx, y + dy))) exposed++;
    if (![[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => A(x + dx, y + dy))) orphans++;
  }
  // holes: empty regions not connected to the border
  const seen = new Uint8Array(W * H), st = [];
  for (let x = 0; x < W; x++) st.push([x, 0], [x, H - 1]); for (let y = 0; y < H; y++) st.push([0, y], [W - 1, y]);
  while (st.length) { const [x, y] = st.pop(); if (x < 0 || y < 0 || x >= W || y >= H || seen[y * W + x] || A(x, y)) continue; seen[y * W + x] = 1; st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
  let holes = 0; const seen2 = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!A(x, y) && !seen[y * W + x] && !seen2[y * W + x]) { holes++; const s = [[x, y]]; while (s.length) { const [i, j] = s.pop(); if (i < 0 || j < 0 || i >= W || j >= H || seen2[j * W + i] || A(i, j) || seen[j * W + i]) continue; seen2[j * W + i] = 1; s.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]); } }
  let newPats = 0; if (known) for (const p of pats) if (!known.has(p)) newPats++;
  return { pats, new2x2: newPats, exposed, orphans, holes };
}

module.exports = { metrics };
