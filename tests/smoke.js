'use strict';
// Headless smoke test: loads the real engine files with stubbed browser APIs, then plays every boss
// with a scripted dodger for 90 simulated seconds. Catches script exceptions, dead weak points, broken flow.
// Run: node tests/smoke.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'engine');
const noop = () => {};
const ctxStub = new Proxy({}, { get: (o, k) => k in o ? o[k] : (/^create(Radial|Linear)Gradient$/.test(k) ? () => ({ addColorStop: noop }) : k === 'measureText' ? () => ({ width: 10 }) : noop), set: (o, k, v) => { o[k] = v; return true; } });
const canvasStub = { width: 40, height: 72, getContext: () => ctxStub, addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }) };
Object.assign(global, {
  window: global, addEventListener: noop, requestAnimationFrame: noop, setInterval: noop, clearInterval: noop,
  document: { getElementById: () => canvasStub, createElement: () => ({ ...canvasStub }) },
  localStorage: { getItem: () => null, setItem: noop }, Image: class { set src(v) {} },
  fetch: () => Promise.reject(new Error('offline')),
});
for (const f of ['util', 'spritegen', 'sprite', 'save', 'audio', 'fx', 'core', 'ui', 'render', 'bosses', 'main'])
  vm.runInThisContext(fs.readFileSync(path.join(root, f + '.js'), 'utf8'), { filename: f + '.js' });

const test = `
(function () {
  let failed = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failed++; };
  DH.ready = true; DH.portrait = { width: 40, height: 72 }; DH.frames = [{ width: 48, height: 76 }];
  for (const mode of ['abyss', 'souls']) {
    SAVE.d.mode = mode;
    for (let i = 0; i < BOSSES.length; i++) {
      begin(i); state = 'play'; P.hp = P.maxhp = 9999;                       // god mode: we test the boss, not the dodger
      let opened = 0, zonesSeen = 0, bulletsSeen = 0, phases = new Set();
      for (let f = 0; f < 60 * 90; f++) {
        const s = f / 60;
        keys.KeyD = Math.sin(s * 0.7) > 0; keys.KeyA = !keys.KeyD; keys.KeyW = Math.sin(s * 0.5) > 0.3; keys.KeyS = !keys.KeyW;
        mouse.x = B.x; mouse.y = B.y; if (f % 50 === 0) just.Space = 1; if (f % 7 === 0) mouse.l = 1; else mouse.l = 0;
        if (B.weak.open && f % 20 === 0) { B.hp -= 0; }
        update(1 / 60);
        if (f % 30 === 0) draw();
        if (B.weak.open) opened++; zonesSeen = Math.max(zonesSeen, zones.length); bulletsSeen = Math.max(bulletsSeen, bullets.length); phases.add(B.phase);
        for (const k in just) delete just[k];
        if (state !== 'play') break;
      }
      ok(opened > 0, mode + ' boss ' + (i + 1) + ' ' + B.name + ': weak point opened (' + opened + ' frames)');
      ok(zonesSeen > 0, mode + ' boss ' + (i + 1) + ': spawned hazard zones (max ' + zonesSeen + ')');
    }
  }
  // phase flow: dropping HP below thresholds must advance phases without breaking the script
  begin(4); state = 'play'; P.hp = P.maxhp = 9999;
  B.hp = B.max * 0.5; for (let f = 0; f < 120; f++) update(1 / 60); ok(B.phase === 1, 'king reaches phase 2');
  B.hp = B.max * 0.2; for (let f = 0; f < 120; f++) update(1 / 60); ok(B.phase === 2, 'king reaches phase 3');
  // kill flow: record, fragment, win after last boss
  begin(0); state = 'play'; dmg(B.hp + 1); ok(state === 'clear' && SAVE.isCleared(0), 'killing boss clears it and saves');
  ok(clearInfo.bolt && clearInfo.bolt.id === 'vine', 'boss 1 unlocks vine bolt');
  for (let f = 0; f < 60 * 5; f++) update(1 / 60); ok(state === 'intro' && bi === 1, 'clear flows into boss 2');
  // death flow, abyss: one hit
  SAVE.d.mode = 'abyss'; begin(0); state = 'play'; P.inv = 0; hurt(); ok(state === 'dead', 'abyss: one hit kills');
  // souls: survives hits, i-frames, flask
  SAVE.d.mode = 'souls'; begin(0); state = 'play'; P.inv = 0; hurt(); ok(state === 'play' && P.hp === 4, 'souls: survives a hit'); hurt(); ok(P.hp === 4, 'souls: i-frames block a second hit');
  P.drink = 0; just.KeyF = 1; update(1 / 60); for (let f = 0; f < 80; f++) update(1 / 60); ok(P.hp === 5 && P.flasks === 2, 'souls: flask heals');
  // dash i-frames
  begin(0); state = 'play'; P.inv = 0; P.dash = 0.1; hurt(); ok(P.hp === P.maxhp, 'dash is invulnerable');
  // bolt: throw, ground, pickup
  begin(0); state = 'play'; just.KeyK = 1; update(1 / 60); delete just.KeyK; ok(P.bolt.s === 'fly', 'bolt throws');
  for (let f = 0; f < 120; f++) update(1 / 60); ok(P.bolt.s === 'ground', 'bolt lands'); P.x = P.bolt.x; P.y = P.bolt.y; update(1 / 60); ok(P.bolt.s === 'held', 'walking over the bolt picks it up');
  console.log(failed ? '\\nFAILED: ' + failed : '\\nALL PASSED'); return failed;
})()`;
const failed = vm.runInThisContext(test, { filename: 'smoke-test' });
process.exit(failed ? 1 : 0);
