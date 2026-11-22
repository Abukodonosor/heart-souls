'use strict';
// Small math helpers shared by every engine file.
const PI = Math.PI, TAU = PI * 2;
const norm = a => ((a + PI) % TAU + TAU) % TAU - PI;   // wrap angle to [-PI, PI]
const rr = (a, b) => a + Math.random() * (b - a);       // random float in [a, b)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
