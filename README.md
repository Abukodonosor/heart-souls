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
All animation is built *from that drawing* (`engine/spritegen.js`), so idle frame 0 is pixel-identical to the PNG. Only the Abyssal Blade is new, drawn in the
drawing's own colours. Frames are named `idle_L`, `walk_R`, ... (`_R` = exact pixel mirror of `_L`). Frames saved from the editor override the generated ones;
a save with the wrong frame size is ignored.

Rules that keep it free of visual errors (pixel art tears easily):
1. The figure moves only as one rigid block; rows are never sheared against each other.
2. The hand block moves rigidly; the blade is drawn under the glove.
3. Cloak tails move by stretching from the inside (duplicating interior pixels), never by sliding rows.
4. Anything a move leaves behind is repaired with the drawing's own rules (gaps -> outline colour, bare cloth edge on a tail -> outline).
5. Drawn at an exact 1:1 scale on whole pixels (a fractional scale drops rows and tears the outline). Death uses an exact 90-degree turn.

`node tests/sprites.js` enforces this: it reads the PNG independently and counts defects per frame (new 2x2 patterns, cut outlines, stray dots, new gaps) against limits.
`node tools/metrics.js` prints the same numbers for every frame. `/tools/sheet.html?anims=attack_L,walk_L&scale=6&debug=1` shows frames with defects in colour
(magenta = enclosed gap, cyan = bare edge). `/tools/validate.html` is the browser version with a visual diff; `/tools/grid.html` shows row/column numbers.

## Layout
    engine/   game code: util, sprite + spritegen (hero art), save, audio, fx, core (state/combat), ui (menus), render, bosses, main
    tests/    smoke.js, sprites.js, lib/ (PNG reader + canvas shim for headless runs)
    tools/    server.py (dev server + editor save), bench.html (frame benchmark), validate/sheet/grid.html (sprite tooling)
    docs/     DESIGN.md, PERF.md
    assets/   editor output (darkheart.json)      archive/   early prototypes (3D, platformer)
