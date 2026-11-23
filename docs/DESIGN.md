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
- `util.js` math helpers - `save.js` persistence (validated, never trusted) - `audio.js` WebAudio synth (sfx + music) - `fx.js` shake/hit-stop/particles/texts
- `sprite.js` hero art loader (portrait, saved art, generated set) - `spritegen.js` builds every animation from `hero.png`
- `core.js` state, input, player, boss scheduler, hazards - `ui.js` menus - `render.js` drawing - `bosses.js` boss scripts (generators: `yield n` waits n seconds) - `main.js` loop
- `tools/` dev server + editor save endpoint, benchmark, sprite tooling - `tests/` headless smoke + sprite tests (`npm test`)

## Camera and screen
World 1440 x 860 (15 x 10 tiles of 96 x 86). The canvas is 540 high and as wide as the window allows (4:3 .. 21:9), the camera view is the whole canvas,
HUD / banners / menus are drawn in a centred 960px safe area with soft dark bands under the HUD text. Zoom = 1 (exact, so pixel art stays crisp) within 350px
of the boss, easing to ZMIN (whole map, depends on the window shape) at 900px. Two guards: fit (hero and boss never leave the frame) and clamp (never show past
the map edge). Pixel art is smoothed only while zoom < 1. Balance note: the world is much bigger than the original 760 x 430 arena, so patterns that scale with area
(DARK RAIN) were increased; re-tune difficulty after real playtests.
Tests (`tests/smoke.js`): 1:1 when close, whole map when far, random positions all in frame (16:9 and wide), zoom range, edge clamp, mouse -> world, canvas follows window shape.

## Hero art pipeline
The drawing (`hero.png`, 48x87 art pixels on a 12px grid) is the single source of truth. Frames are built by moving the figure as one rigid block, the hand block (arm swing) and stretching the cloak tails from the inside - never by shearing rows or redrawing -
so the character always looks exactly like the original (rules and defect limits: README, `tests/sprites.js`). The Abyssal Blade is the only drawn addition.
Directions: the drawing faces left; `_R` frames are exact mirrors. Views from behind / the side would be new art and must come from the artist.

## Next run: TOWER DEFENCE
Reuse engine pieces (zones, bullets, FX, audio, save, editor). New: path/grid, tower placement, waves.
The hero becomes the commander unit; boss scripts become wave bosses.

## Backlog
Story/dialogue after each boss - boss editor (arena + script params) - gamepad - more bosses - Steam build (Electron/Tauri).
