'use strict';
// Persistence (localStorage). Everything is optional: if storage is blocked the game still runs.
const SAVE = (() => {
  const KEY = 'darkheart.save.v1';
  const defaults = () => ({ cleared: [], best: {}, deaths: {}, mode: 'abyss', vol: 0.7, totalDeaths: 0 });
  // Never trust stored data: it may be from an older version, hand-edited or corrupt. Anything invalid falls back to the default.
  function clean(raw) {
    const d = defaults(); if (!raw || typeof raw !== 'object') return d;
    if (Array.isArray(raw.cleared)) d.cleared = [...new Set(raw.cleared.filter(i => Number.isInteger(i) && i >= 0 && i < 64))].sort((a, b) => a - b);
    for (const k of ['best', 'deaths']) if (raw[k] && typeof raw[k] === 'object') for (const [i, v] of Object.entries(raw[k])) if (Number.isInteger(+i) && +i >= 0 && Number.isFinite(v) && v >= 0) d[k][i] = v;
    if (raw.mode === 'abyss' || raw.mode === 'souls') d.mode = raw.mode;
    if (Number.isFinite(raw.vol)) d.vol = Math.min(1, Math.max(0, raw.vol));
    if (Number.isInteger(raw.totalDeaths) && raw.totalDeaths >= 0) d.totalDeaths = raw.totalDeaths;
    return d;
  }
  const d = defaults();
  try { Object.assign(d, clean(JSON.parse(localStorage.getItem(KEY) || '{}'))); } catch (e) { /* corrupt save: keep defaults */ }
  const flush = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage blocked */ } };
  return {
    d, flush, clean,
    isCleared: i => d.cleared.includes(i),
    canPlay: i => i === 0 || d.cleared.includes(i - 1),
    record(i, time) {
      if (!d.cleared.includes(i)) d.cleared.push(i);
      if (!(d.best[i] <= time)) d.best[i] = time;
      flush();
    },
    death(i) { d.deaths[i] = (d.deaths[i] || 0) + 1; d.totalDeaths++; flush(); },
    nextBoss(n) { for (let i = 0; i < n; i++) if (!d.cleared.includes(i)) return i; return 0; },
  };
})();
