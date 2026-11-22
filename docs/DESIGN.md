# DARKHEART - design & roadmap

A pixel-art, top-down boss rush. Souls-like difficulty, Titan Souls single-weak-point combat,
Abyssal Blade style telegraphed raid mechanics. The hero is a man who does not know his own face;
each boss holds a fragment of it.

## Pillars
1. **Fair but brutal.** Every lethal thing is telegraphed (zone, cast bar, sound). Deaths are the player's fault.
2. **Readable at a glance.** Red = danger, gold = weak point, purple = yours.
3. **Fast retry.** Death -> back in the fight in under 2 seconds.
4. **Juice.** Hit-stop, shake, particles, procedural audio on every meaningful event.

## Combat
- Move (WASD), dash with i-frames (Space/Shift), Abyssal Blade (LMB/J): reflects bullets, builds mana.
- ONE bolt (RMB/K): throw, press again to recall, or walk over it. Only works on an open weak point (x3 dmg).
- Weak point sits on the boss's back and is only open during an `expose()` window after its attack chain.
- Mana fills from blade hits and dodges; Q = 6s burst (x2 damage, fast blade).
- Modes: ABYSS (1 HP, no stamina) and SOULS (5 HP, stamina, 3 flasks that heal 2).

## Progression
- 5 bosses, each drops a face fragment (left eye, right eye, voice, name, face).
- Clearing bosses 1-3 unlocks bolt types: Vine (root + longer window), Soul Flame (pierce + burn), Burning Thorns (both).
- Save (localStorage): cleared bosses, best times, deaths, mode, volume.

## Architecture (`engine/`)
- `util.js` math helpers - `sprite.js` hero frames/animation loader - `save.js` persistence
- `audio.js` WebAudio synth (sfx + music) - `fx.js` shake/hit-stop/particles/texts
- `core.js` state, input, player, boss scheduler, hazards - `ui.js` menus - `render.js` drawing
- `bosses.js` boss scripts (generators: `yield n` waits n seconds) - `main.js` loop
- `tools/server.py` dev server + editor save endpoint, `editor.html` sprite/animation editor
- `tests/smoke.js` headless simulation of every boss (`node tests/smoke.js`)

## Next run: TOWER DEFENCE
Reuse engine pieces (zones, bullets, FX, audio, save, editor). New: path/grid, tower placement, waves.
The hero becomes the commander unit; boss scripts become wave bosses.

## Backlog
Story/dialogue after each boss - boss editor (arena + script params) - gamepad - more bosses - Steam build (Electron/Tauri).
