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
  const aimAt = (x, y) => { mouse.x = VIEW.x + VIEW.w / 2 + (x - CAM.x) * CAM.z; mouse.y = VIEW.y + VIEW.h / 2 + (y - CAM.y) * CAM.z; };   // aim at a WORLD point through the camera
  DH.ready = true; DH.portrait = { width: 40, height: 72 }; DH.frames = [{ width: 48, height: 76 }];
  for (const mode of ['abyss', 'souls']) {
    SAVE.d.mode = mode;
    for (let i = 0; i < BOSSES.length; i++) {
      begin(i); state = 'play'; P.hp = P.maxhp = 9999;                       // god mode: we test the boss, not the dodger
      let opened = 0, zonesSeen = 0, bulletsSeen = 0, phases = new Set();
      for (let f = 0; f < 60 * 90; f++) {
        const s = f / 60;
        keys.KeyD = Math.sin(s * 0.7) > 0; keys.KeyA = !keys.KeyD; keys.KeyW = Math.sin(s * 0.5) > 0.3; keys.KeyS = !keys.KeyW;
        aimAt(B.x, B.y); if (f % 50 === 0) just.Space = 1; if (f % 7 === 0) mouse.l = 1; else mouse.l = 0;
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
  // camera: 1:1 when close, pulls back with distance, always keeps hero and boss in frame, never leaves the map
  begin(0); state = 'play';
  const settle = () => { for (let f = 0; f < 400; f++) updCamera(1 / 60); };
  B.x = 600; B.y = 300; P.x = 650; P.y = 340; settle(); ok(CAM.z === 1, 'camera is exactly 1:1 when the hero is next to the boss');
  P.x = A.x + 40; P.y = A.y + A.h - 40; B.x = A.x + A.w - 100; B.y = A.y + 100; settle(); ok(Math.abs(CAM.z - ZMIN) < 0.01, 'camera shows the whole map when far apart (zoom ' + CAM.z.toFixed(3) + ')');
  { let bad = 0, outZoom = 0, offMap = 0;
    for (let i = 0; i < 300; i++) {
      P.x = rr(A.x + 10, A.x + A.w - 10); P.y = rr(A.y + 10, A.y + A.h - 10); B.x = rr(A.x + 60, A.x + A.w - 60); B.y = rr(A.y + 60, A.y + A.h - 60); settle();
      const hw = VIEW.w / 2 / CAM.z, hh = VIEW.h / 2 / CAM.z, inView = o => Math.abs(o.x - CAM.x) <= hw && Math.abs(o.y - CAM.y) <= hh;
      if (!inView(P) || !inView(B)) bad++;
      if (CAM.z < ZMIN - 1e-9 || CAM.z > 1 + 1e-9) outZoom++;
      if (hw * 2 < A.w && (CAM.x - hw < A.x - 1e-6 || CAM.x + hw > A.x + A.w + 1e-6)) offMap++;
    }
    ok(bad === 0, 'hero and boss are always inside the view (300 random positions, ' + bad + ' violations)');
    ok(outZoom === 0, 'zoom stays within [' + ZMIN + ', 1]');
    ok(offMap === 0, 'the camera never shows past the edge of the map when zoomed in'); }
  CAM.x = 500; CAM.y = 300; CAM.z = 0.8; mouse.x = VIEW.x + VIEW.w / 2 + 80; mouse.y = VIEW.y + VIEW.h / 2 - 40; mouseWorld();
  ok(Math.abs(mouse.wx - 600) < 1e-9 && Math.abs(mouse.wy - 250) < 1e-9, 'mouse position converts to world coordinates through the camera (zoom 0.8)');
  // the canvas follows the window shape so the map fills the whole screen
  const fit = (w, h) => { window.innerWidth = w; window.innerHeight = h; fitCanvas(); };
  fit(1920, 891); ok(Math.abs(CFG.W - 540 * 1920 / 891) <= 1 && VIEW.w === CFG.W && cv.width === CFG.W, 'canvas width follows the window shape (1920x891 -> ' + CFG.W + 'x540)');
  fit(5000, 500); ok(CFG.W === 1260, 'ultra-wide windows are clamped to 21:9'); fit(400, 900); ok(CFG.W === 720, 'tall windows are clamped to 4:3');
  fit(1920, 891);
  { let bad = 0;
    for (let i = 0; i < 100; i++) {
      P.x = rr(A.x + 10, A.x + A.w - 10); P.y = rr(A.y + 10, A.y + A.h - 10); B.x = rr(A.x + 60, A.x + A.w - 60); B.y = rr(A.y + 60, A.y + A.h - 60); settle();
      const hw = VIEW.w / 2 / CAM.z, hh = VIEW.h / 2 / CAM.z; if (Math.abs(P.x - CAM.x) > hw || Math.abs(P.y - CAM.y) > hh || Math.abs(B.x - CAM.x) > hw || Math.abs(B.y - CAM.y) > hh) bad++;
    }
    ok(bad === 0, 'on a wide window hero and boss stay in frame too (' + bad + ' violations)'); }
  P.x = A.x + 20; P.y = A.y + A.h - 20; B.x = A.x + A.w - 20; B.y = A.y + 20; settle();
  ok(VIEW.w / 2 / CAM.z * 2 >= A.w - 1 && VIEW.h / 2 / CAM.z * 2 >= A.h - 1, 'at maximum distance the whole map is visible on a wide window (zoom ' + CAM.z.toFixed(3) + ')');
  draw(); ok(true, 'drawing works at the wide canvas size');
  fit(960, 540); ok(CFG.W === 960, 'back to 16:9');
  // a save that lists cleared bosses but has no times must not break the menus
  { const keep = JSON.stringify(SAVE.d); SAVE.d.cleared = [0, 1]; SAVE.d.best = {}; const st = state; state = 'select';
    let threw = false; try { menuItems().forEach(it => it.text()); draw(); } catch (e) { threw = true; }
    ok(!threw, 'boss select works for cleared bosses without recorded times'); state = st; Object.assign(SAVE.d, JSON.parse(keep)); }
  // corrupt / hand-edited save data must be sanitised, never trusted
  ok(JSON.stringify(SAVE.clean({ cleared: 'x', mode: 'evil', vol: 9, best: { a: 1, '2': -5, '1': 12.5 }, deaths: { '0': 3 }, totalDeaths: -1 })) === JSON.stringify({ cleared: [], best: { '1': 12.5 }, deaths: { '0': 3 }, mode: 'abyss', vol: 1, totalDeaths: 0 }), 'corrupt save data is sanitised');
  ok(SAVE.clean(null).mode === 'abyss' && SAVE.clean('junk').cleared.length === 0 && SAVE.clean({ cleared: [2, 2, 0, -1, 1.5, 'z'] }).cleared.join() === '0,2', 'save: junk input and duplicate/invalid clears are handled');
  { const st = state; begin(99); ok(state === st, 'begin() ignores a boss index that does not exist'); }
  // bolt: throw, ground, pickup
  begin(0); state = 'play'; just.KeyK = 1; update(1 / 60); delete just.KeyK; ok(P.bolt.s === 'fly', 'bolt throws');
  for (let f = 0; f < 120; f++) update(1 / 60); ok(P.bolt.s === 'ground', 'bolt lands'); P.x = P.bolt.x; P.y = P.bolt.y; update(1 / 60); ok(P.bolt.s === 'held', 'walking over the bolt picks it up');
  console.log(failed ? '\\nFAILED: ' + failed : '\\nALL PASSED'); return failed;
})()`;
const failed = vm.runInThisContext(test, { filename: 'smoke-test' });
process.exit(failed ? 1 : 0);
