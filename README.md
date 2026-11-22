# DARKHEART

Pixel-art, top-down, souls-like boss rush. See `docs/DESIGN.md` for the design and roadmap.

## Run
    python3 tools/server.py          # http://localhost:8000
    open /arena.html (game) or /editor.html (sprite + animation editor)

## Test
    node tests/smoke.js              # plays every boss headlessly, checks all core flows

## Controls
WASD move - Space/Shift dash (i-frames) - LMB/J blade - RMB/K throw/recall bolt - Tab/1-4 switch bolt
Q burst - F flask (souls mode) - Esc pause - M mute

## Layout
`engine/` game code - `assets/` editor output (`darkheart.json`) - `archive/` early prototypes (3D, platformer) - `tests/` - `tools/`
