// Entities: the keeper, the shades, bolts, ember drops, particles and
// floating score text — their shapes and how they move, hit and die.
// Rendering lives in render.js; spawning lives in waves.js.

import { range, pick, chance } from './rng.js';

export const ARENA = { w: 1280, h: 720, cx: 640, cy: 360, lanternR: 46 };

export function makePlayer() {
  return {
    x: ARENA.cx, y: ARENA.cy + 170,
    r: 14, speed: 265, hp: 3, maxHp: 3,
    aim: -Math.PI / 2, fireTimer: 0, hurtTimer: 0,
    invuln: 0,
  };
}

// Enemy kinds. speed in px/s, hp in hits, ember drop count, score value.
// shape names the silhouette render.js draws: spike (jagged star), dart
// (fast arrowhead), slab (armoured hexagon), lobes (twin-lobed splitter),
// maw (diamond with a glowing mouth), crown (boss ring with orbiting spikes).
export const KINDS = {
  shade:   { r: 16, speed: 62,  hp: 2,  embers: 2, score: 10, color: '#b06ee8', core: '#e9d5ff', shape: 'spike' },
  skitter: { r: 11, speed: 128, hp: 1,  embers: 1, score: 15, color: '#ff7ad9', core: '#ffd6f2', shape: 'dart' },
  brute:   { r: 26, speed: 38,  hp: 8,  embers: 5, score: 30, color: '#8f7bff', core: '#d6ccff', shape: 'slab' },
  splitter:{ r: 18, speed: 55,  hp: 3,  embers: 2, score: 20, color: '#5ee6a8', core: '#d2ffe9', shape: 'lobes' },
  spitter: { r: 15, speed: 48,  hp: 3,  embers: 3, score: 25, color: '#ffb454', core: '#ffe9c4', shape: 'maw' },
  warden:  { r: 38, speed: 30,  hp: 34, embers: 14, score: 150, color: '#ff5d73', core: '#ffd0d6', shape: 'crown' },
};

export function makeEnemy(kind, x, y, rng) {
  const def = KINDS[kind];
  return {
    kind, x, y,
    r: def.r, hp: def.hp, maxHp: def.hp,
    speed: def.speed * range(rng, 0.9, 1.1),
    score: def.score, embers: def.embers,
    wobble: range(rng, 0, Math.PI * 2),
    shootTimer: range(rng, 1.2, 2.4),
    flash: 0,
    chewing: false,
  };
}

export function makeBullet(x, y, angle, speed = 640) {
  return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 5, life: 1.1 };
}

export function makeEnemyBullet(x, y, angle) {
  return { x, y, vx: Math.cos(angle) * 150, vy: Math.sin(angle) * 150, r: 6, life: 4 };
}

export function makeDrop(x, y, rng) {
  return {
    x: x + range(rng, -8, 8), y: y + range(rng, -8, 8),
    vx: range(rng, -40, 40), vy: range(rng, -40, 40),
    r: 7, life: 14, bob: range(rng, 0, Math.PI * 2),
  };
}

export function burst(particles, x, y, color, n, speed = 180, life = 0.5) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      r: 2 + Math.random() * 3.5, life: life * (0.6 + Math.random() * 0.7),
      maxLife: life, color,
    });
  }
}

export function floater(floaters, x, y, text, color = '#ffd166') {
  floaters.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
}

export function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
  }
}

export function updateFloaters(floaters, dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) floaters.splice(i, 1);
  }
}

// Steer an enemy toward the lantern, with a little sinusoidal wobble so the
// horde does not march in a straight line. Returns nothing; mutates e.
export function steerEnemy(e, dt, time) {
  const dx = ARENA.cx - e.x;
  const dy = ARENA.cy - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const wob = Math.sin(time * 2.2 + e.wobble) * 0.45;
  const px = -dy / d;
  const py = dx / d;
  e.x += (dx / d + px * wob) * e.speed * dt;
  e.y += (dy / d + py * wob) * e.speed * dt;
  e.chewing = d < ARENA.lanternR + e.r + 6;
}

// Circle an enemy around the lantern on a wide ellipse, never closing in.
// Used by the title screen's attract mode so the drifting shades ring the
// arena instead of marching across the title text. The ellipse (480x260)
// keeps them clear of the centred text: its bottom point sits above the
// "M — mute sound" line. Mutates e.
export function orbitEnemy(e, dt, rx = 480, ry = 260) {
  const dx = (e.x - ARENA.cx) / rx;
  const dy = (e.y - ARENA.cy) / ry;
  const a = Math.atan2(dy, dx);
  const breathe = 1 + 0.06 * Math.sin(a * 3 + e.wobble);
  // Angular speed: a full orbit in roughly a minute at the attract speed.
  const angular = e.speed / 300;
  const na = a + angular * dt * (e.wobble > Math.PI ? 1 : -1);
  e.x = ARENA.cx + Math.cos(na) * rx * breathe;
  e.y = ARENA.cy + Math.sin(na) * ry * breathe;
  e.chewing = false;
}

// Shockwave rings: a bright stroked circle that expands and fades after a
// kill (or a big one when the lantern dies). Rendered by render.js.
export function spawnRing(rings, x, y, color, maxR = 72, life = 0.45) {
  rings.push({ x, y, color, r: 6, maxR, life, maxLife: life });
}

export function updateRings(rings, dt) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const g = rings[i];
    g.life -= dt;
    if (g.life <= 0) { rings.splice(i, 1); continue; }
    const t = 1 - g.life / g.maxLife;
    g.r = 6 + (g.maxR - 6) * (1 - (1 - t) * (1 - t));
  }
}

export function randomSpawnPoint(rng) {
  const side = Math.floor(rng() * 4);
  const m = 26;
  if (side === 0) return { x: range(rng, 0, ARENA.w), y: -m };
  if (side === 1) return { x: ARENA.w + m, y: range(rng, 0, ARENA.h) };
  if (side === 2) return { x: range(rng, 0, ARENA.w), y: ARENA.h + m };
  return { x: -m, y: range(rng, 0, ARENA.h) };
}

export function splitEnemy(e, rng) {
  // A splitter bursts into two fast shades.
  const out = [];
  for (let i = 0; i < 2; i++) {
    const s = makeEnemy('shade', e.x + range(rng, -14, 14), e.y + range(rng, -14, 14), rng);
    s.speed *= 1.35;
    s.r = 12;
    s.score = 5;
    out.push(s);
  }
  return out;
}

export function pickDropKind(rng) {
  // 1 in 8 drops is a heart-ember: restores a hit point instead of score.
  return chance(rng, 0.125) ? 'heart' : 'ember';
}
