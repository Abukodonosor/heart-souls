'use strict';
// Procedural audio. No asset files: every sound is synthesised with WebAudio, so the game ships tiny.
const AUD = (() => {
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let vol = 0.7, muted = false, intensity = 0.2, musicOn = false, timer = null, nextT = 0, step = 0, droneF = null;
  const ROOTS = [55, 55, 65.41, 49];                // A1 A1 C2 G1: slow minor loop
  const SCALE = [0, 3, 5, 7, 10, 12, 15];           // minor pentatonic steps for the high pings
  const hz = (root, semis) => root * Math.pow(2, semis / 12);

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : vol; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
    // cheap reverb: filtered feedback delay on the music bus
    const d = ctx.createDelay(); d.delayTime.value = 0.3;
    const fb = ctx.createGain(); fb.gain.value = 0.4;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
    musicBus.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }

  // one oscillator voice with an exponential decay envelope
  function tone(f, dur, type = 'sine', v = 0.3, o = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.at || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + (o.atk || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
  function noise(dur, v = 0.3, o = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.at || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f0 || 1000, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t0 + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  const SFX = {
    swing: () => noise(0.13, 0.25, { f0: 600, f1: 3200, q: 1.5 }),
    thud: () => { tone(110, 0.12, 'sine', 0.35, { to: 60 }); noise(0.06, 0.2, { f0: 800 }); },
    hit: () => { tone(260, 0.12, 'square', 0.18, { to: 120 }); noise(0.08, 0.25, { f0: 1500 }); },
    crit: () => { tone(180, 0.25, 'sawtooth', 0.28, { to: 50 }); tone(900, 0.1, 'triangle', 0.2, { to: 300 }); noise(0.18, 0.35, { f0: 2500, f1: 300 }); },
    clang: () => { tone(1100, 0.18, 'triangle', 0.22, { to: 700 }); tone(1650, 0.12, 'sine', 0.1); },
    dash: () => noise(0.16, 0.2, { type: 'highpass', f0: 800, f1: 3500 }),
    graze: () => { tone(700, 0.08, 'sine', 0.15, { to: 1400 }); },
    throw: () => { tone(700, 0.15, 'sine', 0.2, { to: 280 }); },
    catch: () => { tone(380, 0.12, 'sine', 0.2, { to: 760 }); },
    open: () => { tone(520, 0.3, 'sine', 0.18, { to: 1040, atk: 0.05 }); tone(780, 0.3, 'sine', 0.1, { to: 1560, atk: 0.05 }); },
    cast: () => { tone(220, 0.2, 'sine', 0.1, { to: 330 }); },
    boom: () => { tone(90, 0.35, 'sine', 0.4, { to: 28 }); noise(0.25, 0.3, { type: 'lowpass', f0: 900, f1: 80 }); },
    hurt: () => { tone(160, 0.4, 'sawtooth', 0.35, { to: 38 }); noise(0.3, 0.35, { f0: 700, f1: 100 }); },
    death: () => { tone(120, 1.6, 'sawtooth', 0.3, { to: 25 }); tone(60, 1.8, 'sine', 0.4, { to: 20 }); noise(1.2, 0.2, { type: 'lowpass', f0: 600, f1: 50 }); },
    drink: () => { for (let i = 0; i < 4; i++) tone(300 + i * 90, 0.12, 'sine', 0.12, { at: i * 0.1 }); },
    phase: () => { tone(70, 1, 'sawtooth', 0.35, { to: 140 }); noise(0.8, 0.3, { f0: 200, f1: 3000 }); },
    felled: () => { [0, 4, 7, 12].forEach((s, i) => tone(hz(220, s), 1.4, 'triangle', 0.22, { at: i * 0.18, atk: 0.02 })); tone(55, 2, 'sine', 0.4, { to: 40 }); },
    ui: () => tone(540, 0.05, 'square', 0.07),
    ok: () => { tone(440, 0.08, 'square', 0.09); tone(660, 0.1, 'square', 0.09, { at: 0.07 }); },
  };

  // --- music: slow bass line, a drone, sparse pings; intensity speeds it up and opens the filter
  function scheduleStep(at) {
    const bar = Math.floor(step / 8) % ROOTS.length, root = ROOTS[bar], s = step % 8;
    if (s === 0) tone(root, 2.2, 'sawtooth', 0.12, { at: at - ctx.currentTime, bus: musicBus, atk: 0.05 });
    if (s === 0 || (intensity > 0.45 && s === 4)) tone(52, 0.25, 'sine', 0.35, { at: at - ctx.currentTime, to: 30, bus: musicBus });
    if (intensity > 0.3 && s % 2 === 1) noise(0.04, 0.05 + intensity * 0.05, { at: at - ctx.currentTime, type: 'highpass', f0: 6000, bus: musicBus });
    if (Math.random() < 0.22 + intensity * 0.2) tone(hz(root * 4, SCALE[(Math.random() * SCALE.length) | 0]), 1.2, 'triangle', 0.05, { at: at - ctx.currentTime, bus: musicBus, atk: 0.02 });
    step++;
  }
  function tick() {
    if (!ctx || !musicOn) return;
    const eighth = 60 / (68 + intensity * 50) / 2;
    while (nextT < ctx.currentTime + 0.35) { scheduleStep(nextT); nextT += eighth; }
    if (droneF) droneF.frequency.setTargetAtTime(200 + intensity * 900, ctx.currentTime, 0.5);
  }
  function startMusic() {
    if (!ctx || musicOn) return;
    musicOn = true; nextT = ctx.currentTime + 0.1; step = 0;
    for (const m of [1, 1.006]) {                       // two detuned saws = dark pad
      const o = ctx.createOscillator(), g = ctx.createGain();
      droneF = droneF || ctx.createBiquadFilter(); droneF.type = 'lowpass'; droneF.frequency.value = 220;
      o.type = 'sawtooth'; o.frequency.value = 55 * m; g.gain.value = 0.035;
      o.connect(g); g.connect(droneF); droneF.connect(musicBus); o.start();
    }
    timer = setInterval(tick, 100);
  }
  function stopMusic() { musicOn = false; clearInterval(timer); }

  return {
    init, startMusic, stopMusic,
    sfx(n) { try { if (SFX[n]) SFX[n](); } catch (e) { /* audio must never break the game */ } },
    setIntensity(v) { intensity = clamp(v, 0, 1); },
    getVolume: () => vol,
    setVolume(v) { vol = clamp(v, 0, 1); if (master) master.gain.value = muted ? 0 : vol; },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : vol; return muted; },
  };
})();
