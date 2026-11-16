// Deterministic screenshot scenes: ?shot=title|play|shop|over&seed=<n> builds
// a fixed scene from a seeded RNG, simulates a few seconds of play where
// needed, renders once and sets window.__shotReady so a headless browser
// knows the frame is ready to capture. No wall clock, no user input.

import { makeRng, range } from './rng.js';
import { newRun, SCREEN, newUpgrades } from './state.js';
import { makePlayer, makeEnemy, makeDrop, burst, ARENA } from './entities.js';
import { startWave, spawnNext } from './waves.js';

function placePlayer(run) {
  run.player = makePlayer();
  run.player.x = ARENA.cx;
  run.player.y = ARENA.cy + 170;
  run.player.aim = -Math.PI / 2;
}

function scatterEnemies(run, rng, kinds) {
  for (const kind of kinds) {
    const a = rng() * Math.PI * 2;
    const d = range(rng, 130, 320);
    const x = ARENA.cx + Math.cos(a) * d;
    const y = ARENA.cy + Math.sin(a) * d * 0.75;
    run.enemies.push(makeEnemy(kind, x, y, rng));
  }
}

function scatterDrops(run, rng, n) {
  for (let i = 0; i < n; i++) {
    const d = makeDrop(ARENA.cx + range(rng, -220, 220), ARENA.cy + range(rng, -140, 140), rng);
    d.kind = 'ember';
    run.drops.push(d);
  }
}

export function buildShotScene(scene, seed) {
  const rng = makeRng(seed);
  const run = newRun();
  const upgrades = newUpgrades();

  if (scene === 'title') {
    run.screen = SCREEN.TITLE;
    // Keeper waits at the lower-left corner; the horde waits at the left
    // and right margins, clear of the centred title text (angles near
    // 0°/180° keep every enemy outside the text block, x 280–1000).
    run.player = makePlayer();
    run.player.x = 180;
    run.player.y = 600;
    run.player.aim = -Math.PI / 4;
    const sideAngles = [10, -8, 168, -170, 4, 186];
    const titleKinds = ['shade', 'shade', 'skitter', 'brute', 'splitter', 'spitter'];
    for (let i = 0; i < titleKinds.length; i++) {
      const a = (sideAngles[i] * Math.PI) / 180;
      const d = range(rng, 400, 440);
      const x = ARENA.cx + Math.cos(a) * d;
      const y = ARENA.cy + Math.sin(a) * d * 0.7;
      run.enemies.push(makeEnemy(titleKinds[i], x, y, rng));
    }
    run.light = 82;
    run.best = 1240;
    burst(run.particles, ARENA.cx - 120, ARENA.cy - 60, '#ffb042', 14, 120, 0.9);
    burst(run.particles, ARENA.cx + 140, ARENA.cy + 40, '#b06ee8', 10, 100, 0.9);
    return { run, upgrades };
  }

  if (scene === 'shop') {
    run.screen = SCREEN.SHOP;
    run.wave = 3;
    run.score = 860;
    run.embers = 47;
    run.kills = 41;
    run.best = 1240;
    run.light = 64;
    run.player = makePlayer();
    run.player.x = 180;
    run.player.y = 640;
    run.player.aim = -Math.PI / 4;
    run.shopSelection = 1;
    return { run, upgrades };
  }

  if (scene === 'over') {
    run.screen = SCREEN.OVER;
    run.wave = 6;
    run.score = 1730;
    run.kills = 88;
    run.shotsFired = 240;
    run.best = 1730;
    run.newBest = true;
    run.light = 0;
    run.stats.embersCollected = 96;
    run.stats.wavesCleared = 5;
    run.player = makePlayer();
    run.player.x = 180;
    run.player.y = 620;
    run.player.aim = -Math.PI / 4;
    return { run, upgrades };
  }

  // Default: 'play' — a busy mid-wave frame with bolts and particles.
  run.screen = SCREEN.PLAYING;
  run.wave = 4;
  run.score = 1240;
  run.embers = 23;
  run.kills = 57;
  run.best = 1240;
  run.light = 71;
  run.combo = 5;
  placePlayer(run);
  run.player.aim = -0.9;
  scatterEnemies(run, rng, ['shade', 'shade', 'shade', 'skitter', 'skitter', 'brute', 'splitter', 'spitter', 'shade']);
  scatterDrops(run, rng, 6);
  run.bullets.push(
    { x: 640, y: 420, vx: 300, vy: -560, r: 5, life: 1 },
    { x: 610, y: 440, vx: 120, vy: -620, r: 5, life: 1 },
    { x: 672, y: 430, vx: 460, vy: -420, r: 5, life: 1 },
  );
  burst(run.particles, 520, 300, '#b06ee8', 16, 200, 0.7);
  burst(run.particles, 760, 250, '#ff7ad9', 12, 180, 0.7);
  burst(run.particles, 640, 360, '#ffb042', 10, 120, 0.8);
  run.bannerText = 'WAVE 4';
  run.bannerSub = 'the horde grows bolder';
  run.bannerTimer = 1.4;
  return { run, upgrades };
}

export function shotParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  const seed = Number(q.get('seed') || 1337) >>> 0;
  return { shot, seed };
}
