'use strict';
// Menus: title, boss select, pause, win. Logic only; render.js draws the items and fills UI.rects for mouse hit-testing.
const UI = { mi: 0, rects: [], mx: 480, my: 270 };   // start equal to the default mouse so the first frame is not read as a hover

function toTitle() { state = 'title'; UI.mi = 0; AUD.stopMusic(); FX.clear(); }
function cycleMode() { SAVE.d.mode = SAVE.d.mode === 'abyss' ? 'souls' : 'abyss'; SAVE.flush(); AUD.sfx('ui'); }
function addVol(d) { AUD.setVolume(Math.round((AUD.getVolume() + d * 0.1) * 10) / 10); SAVE.d.vol = AUD.getVolume(); SAVE.flush(); AUD.sfx('ui'); }
const volItem = () => ({ text: () => 'VOLUME  < ' + Math.round(AUD.getVolume() * 100) + '% >', adj: addVol });

function menuItems() {
  if (state === 'title') return [
    { text: () => SAVE.d.cleared.length ? 'CONTINUE' : 'BEGIN', act: () => { AUD.sfx('ok'); begin(SAVE.nextBoss(BOSSES.length)); } },
    { text: () => 'BOSS SELECT', act: () => { AUD.sfx('ok'); state = 'select'; UI.mi = SAVE.nextBoss(BOSSES.length); } },
    { text: () => 'MODE  < ' + MODES[SAVE.d.mode].name + ' >', act: cycleMode, adj: cycleMode, sub: () => MODES[SAVE.d.mode].blurb },
    volItem(),
  ];
  if (state === 'select') return BOSS_INFO.map((b, i) => ({
    text: () => (i + 1) + '  ' + (SAVE.canPlay(i) ? b.name.padEnd(22) + (SAVE.isCleared(i) ? 'FELLED ' + SAVE.d.best[i].toFixed(1) + 's' : '') : '???'.padEnd(22) + 'LOCKED'),
    sub: () => SAVE.canPlay(i) ? b.epithet + '   deaths: ' + (SAVE.d.deaths[i] || 0) : 'Defeat the previous boss.',
    disabled: () => !SAVE.canPlay(i),
    act: () => { if (SAVE.canPlay(i)) { AUD.sfx('ok'); begin(i); } },
  })).concat([{ text: () => 'BACK', act: toTitle }]);
  if (state === 'paused') return [
    { text: () => 'RESUME', act: resume },
    { text: () => 'RESTART FIGHT', act: () => begin(bi) },
    volItem(),
    { text: () => 'QUIT TO TITLE', act: toTitle },
  ];
  if (state === 'win') return [{ text: () => 'RETURN TO TITLE', act: toTitle }];
  return [];
}

function uiUpdate() {
  if (pressed('KeyM')) AUD.toggleMute();
  if ((state === 'play' || state === 'intro') && pressed('Escape', 'KeyP')) pause();
  const items = menuItems();
  const moved = mouse.x !== UI.mx || mouse.y !== UI.my; UI.mx = mouse.x; UI.my = mouse.y;
  let click = -1;
  UI.rects.forEach((r, i) => {
    if (mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) {
      if (moved && UI.mi !== i) { UI.mi = i; AUD.sfx('ui'); }
      if (mouse.jl) click = i;
    }
  });
  if (items.length) {
    if (pressed('KeyW', 'ArrowUp')) { UI.mi = (UI.mi + items.length - 1) % items.length; AUD.sfx('ui'); }
    if (pressed('KeyS', 'ArrowDown')) { UI.mi = (UI.mi + 1) % items.length; AUD.sfx('ui'); }
    UI.mi = clamp(UI.mi, 0, items.length - 1);
    const it = items[UI.mi];
    if (it.adj) { if (pressed('KeyA', 'ArrowLeft')) it.adj(-1); if (pressed('KeyD', 'ArrowRight')) it.adj(1); }
    if (click >= 0) { UI.mi = click; const c = items[click]; (c.act || c.adj)(1); }
    else if (pressed('Enter', 'Space')) (it.act || it.adj)(1);
    if (pressed('Escape')) { if (state === 'select') toTitle(); else if (state === 'paused') resume(); }
  }
  if (state === 'dead') {
    if (sub > 0.7 && (pressed('Enter', 'Space', 'KeyR') || mouse.jl)) begin(bi);
    else if (pressed('Escape')) toTitle();
  }
  if (state === 'clear' && sub < 2.8 && pressed('Enter', 'Space')) sub = 0;
}
