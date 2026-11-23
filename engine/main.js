'use strict';
// Boot + frame loop. One bad frame must not kill the game, so errors are logged and the loop continues.
dhInit();
AUD.setVolume(SAVE.d.vol);
buildFloor(THEMES.violet);
fitCanvas(); addEventListener('resize', fitCanvas);
let lastT = performance.now();
(function loop(now) {
  requestAnimationFrame(loop);
  const rdt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
  try { update(rdt); draw(); } catch (e) { console.error(e); }
  for (const k in just) delete just[k];
  mouse.jl = 0; mouse.jr = 0;
})(lastT);
