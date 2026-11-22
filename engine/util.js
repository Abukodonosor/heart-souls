'use strict';
// Small math helpers shared by every engine file.
const PI = Math.PI, TAU = PI * 2;
const norm = a => ((a + PI) % TAU + TAU) % TAU - PI;   // wrap angle to [-PI, PI]
const rr = (a, b) => a + Math.random() * (b - a);       // random float in [a, b)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Remove items in place (no new array each frame, so no GC churn from filter()).
function compact(a, keep) { let j = 0; for (let i = 0; i < a.length; i++) { const v = a[i]; if (keep(v)) a[j++] = v; } a.length = j; }
