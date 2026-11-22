'use strict';
// Frame defect metrics (node tools/metrics.js). For every animation frame it counts things that betray a visual error:
//  new2x2  = 2x2 colour patterns that do not occur anywhere in the original drawing (tears and broken outlines create these)
//  exposed = opaque non-black pixels touching empty space (an outline that was cut away); compared with the original's own count
//  orphans = opaque pixels with no opaque neighbour (stray dots)      holes = enclosed empty regions (the original has its own)
const vm = require('vm'), fs = require('fs'), path = require('path');
const { metrics } = require('../tests/lib/metrics');
const root = path.join(__dirname, '..');
require('../tests/lib/canvas-shim').install(root);
for (const f of ['util', 'sprite', 'spritegen']) vm.runInThisContext(fs.readFileSync(path.join(root, 'engine', f + '.js'), 'utf8'), { filename: f + '.js' });
const E = vm.runInThisContext('({ PORT, SPR, GEN, genHeroSet, dhLoadPortrait })');

(async () => {
  const portrait = await E.dhLoadPortrait(''), { PORT, SPR } = E;
  const P = portrait.getContext('2d').getImageData(0, 0, PORT.W, PORT.H).data, base = metrics(P, PORT.W, PORT.H, null);
  console.log(`original: exposed=${base.exposed} orphans=${base.orphans} holes=${base.holes} 2x2 patterns=${base.pats.size}`);
  const set = E.genHeroSet(portrait); let worst = 0;
  for (const an of Object.keys(set.anims).filter(a => a.endsWith('_L'))) {
    const row = set.anims[an].frames.map(fi => { const c = set.frames[fi], m = metrics(c.getContext('2d').getImageData(0, 0, c.width, c.height).data, c.width, c.height, base.pats); worst = Math.max(worst, m.new2x2); return `${m.new2x2}/${m.exposed - base.exposed >= 0 ? '+' : ''}${m.exposed - base.exposed}/${m.orphans}/${m.holes}`; });
    console.log(an.padEnd(9), '(new2x2 / exposed vs orig / orphans / holes)  ', row.join('  '));
  }
  console.log('worst new2x2:', worst);
})();
