# DARKHEART

Pixel-art, top-down, souls-like boss rush. One hit can kill you; every lethal thing is telegraphed.
Design and roadmap: [docs/DESIGN.md](docs/DESIGN.md) - performance notes: [docs/PERF.md](docs/PERF.md).

## Run
    npm start                 # python3 tools/server.py -> http://localhost:8000
    /arena.html   the game
    /editor.html  pixel + animation editor (Save writes assets/darkheart.json)

## Test
    npm test                  # smoke.js: every boss, combat and save flows; sprites.js: the hero art pipeline
Both run headless in a terminal, no dependencies (Node >= 18).

## Controls
WASD move - Space/Shift dash (i-frames) - LMB/J Abyssal Blade - RMB/K throw / recall the bolt
Tab or 1-4 switch bolt - Q burst - F flask (souls mode) - Esc pause - M mute

## The hero art (important)
`hero.png` is the source of truth: a clean 100x100 pixel grid, each art pixel = 12x12 image pixels; the character is 48x87 art pixels, 13 colours.
All animation is built *from that drawing* (`engine/spritegen.js`): rows and the hand block are moved, nothing is redrawn or resampled, so
idle frame 0 is pixel-identical to the PNG. Only the Abyssal Blade is new, drawn in the drawing's own colours. Frames are named `idle_L`, `walk_R`, ...
(`_R` = exact pixel mirror of `_L`). Frames saved from the editor override the generated ones; a save with the wrong frame size is ignored.

Checks: `node tests/sprites.js` (terminal) or `/tools/validate.html` (browser, with a visual diff). Look at frames: `/tools/sheet.html?anims=attack_L,walk_L&scale=4`.
`/tools/grid.html` shows the drawing with row/column numbers (used to pick animation regions).

## Layout
    engine/   game code: util, sprite + spritegen (hero art), save, audio, fx, core (state/combat), ui (menus), render, bosses, main
    tests/    smoke.js, sprites.js, lib/ (PNG reader + canvas shim for headless runs)
    tools/    server.py (dev server + editor save), bench.html (frame benchmark), validate/sheet/grid.html (sprite tooling)
    docs/     DESIGN.md, PERF.md
    assets/   editor output (darkheart.json)      archive/   early prototypes (3D, platformer)
