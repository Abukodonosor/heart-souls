# Performance notes

Measured with `tools/bench.html` (real `requestAnimationFrame` frames, scripted dodger, fixed random seed, all 5 bosses x 450 frames).
To compare against an older revision, put its `engine/*.js` in `tools/before/engine/` and open `bench.html?engine=before`.

| | before | after |
|---|---|---|
| frames over 25 ms (all bosses, 2245 frames) | 39 (Hollow King alone: 31 = 7%) | 10 and 6 (two runs) |
| Hollow King p99 frame | 50 ms | 16.8 ms |
| update+draw CPU p99, per boss | 1.3-1.7 ms | 0.7-1.7 ms |

Game logic is ~0.02 ms per frame; drawing is the only thing worth optimising.

## What changed and why
- **No `shadowBlur` on hazards or bullets.** Its cost scales with shape size: the Hollow King's 1600 px "eclipse" ring made one frame cost hundreds of ms. Bullets use a pre-rendered radial glow sprite (one `drawImage` each); active zones use a cheap wide translucent stroke.
- **Hero light** is a cached sprite instead of a gradient created every frame.
- **Particles** are drawn in two passes (normal, then glowing with a single `lighter` blend switch) instead of `save/restore` + blend change per particle. Bullet discs are batched into one path.
- **No per-frame allocation:** `compact()` removes dead zones/bullets/particles in place instead of `Array.filter` (new array every frame); `availableBolts()` is cached until a boss is cleared.

## Pitfalls found while measuring
- A synchronous benchmark loop (no `requestAnimationFrame`) lets canvas commands pile up and then flush at once: it reports fake 300-900 ms spikes. Measure real frames.
- Noise is real: the same build shows 0-7 slow frames per boss between runs. Compare totals over several runs, not single numbers.
