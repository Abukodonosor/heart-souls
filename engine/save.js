'use strict';
// Persistence (localStorage). Everything is optional: if storage is blocked the game still runs.
const SAVE = (() => {
  const KEY = 'darkheart.save.v1';
  const d = { cleared: [], best: {}, deaths: {}, mode: 'abyss', vol: 0.7, totalDeaths: 0 };
  try { Object.assign(d, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* corrupt save: keep defaults */ }
  const flush = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage blocked */ } };
  return {
    d, flush,
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
