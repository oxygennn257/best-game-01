// Seeded random numbers (mulberry32) so screenshot scenes and wave layouts
// can be reproduced exactly from a seed. Gameplay uses a time-based seed;
// ?shot= scenes pass their own.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function chance(rng, p) {
  return rng() < p;
}

// A random point on the edge of the arena, just outside the walls.
export function edgePoint(rng, w, h, margin = 30) {
  const side = Math.floor(rng() * 4);
  if (side === 0) return { x: range(rng, 0, w), y: -margin };
  if (side === 1) return { x: w + margin, y: range(rng, 0, h) };
  if (side === 2) return { x: range(rng, 0, w), y: h + margin };
  return { x: -margin, y: range(rng, 0, h) };
}
