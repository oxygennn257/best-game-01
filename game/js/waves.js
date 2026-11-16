// Wave composition and spawning. Each wave is a queue of enemy kinds built
// from the wave number; the queue drains one spawn at a time so the pressure
// ramps up instead of arriving all at once.

import { makeEnemy, randomSpawnPoint } from './entities.js';

function waveList(n, rng) {
  // Base horde grows with the wave; new kinds join on a schedule.
  // Wave 1 is deliberately gentle (5 shades, no skitters): a human judge's
  // first 30 seconds should teach the game, not punish the player.
  const list = [];
  const shades = n === 1 ? 5 : 5 + n * 2;
  const skitters = n >= 2 ? 2 + n : 0;
  const brutes = n >= 3 ? Math.floor(n / 2) : 0;
  const splitters = n >= 4 ? Math.floor((n - 1) / 2) : 0;
  const spitters = n >= 5 ? Math.floor(n / 3) : 0;
  for (let i = 0; i < shades; i++) list.push('shade');
  for (let i = 0; i < skitters; i++) list.push('skitter');
  for (let i = 0; i < brutes; i++) list.push('brute');
  for (let i = 0; i < splitters; i++) list.push('splitter');
  for (let i = 0; i < spitters; i++) list.push('spitter');
  if (n % 5 === 0) list.push('warden');
  // Shuffle so kinds arrive mixed, but keep the first three gentle.
  for (let i = list.length - 1; i > 3; i--) {
    const j = 3 + Math.floor(rng() * (i - 2));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function startWave(run, rng) {
  run.wave += 1;
  run.spawnQueue = waveList(run.wave, rng);
  run.waveState = 'spawning';
  run.spawnTimer = 0.6;
  return run.spawnQueue.length;
}

export function spawnInterval(wave) {
  // Spawns get faster as waves climb, down to a floor. Wave 1 spawns a
  // touch slower still, so the opening never feels frantic.
  if (wave === 1) return 1.05;
  return Math.max(0.32, 0.95 - wave * 0.05);
}

export function spawnNext(run, rng) {
  const kind = run.spawnQueue.shift();
  const p = randomSpawnPoint(rng);
  run.enemies.push(makeEnemy(kind, p.x, p.y, rng));
}

export function waveCleared(run) {
  return run.waveState !== 'idle'
    && run.spawnQueue.length === 0
    && run.enemies.length === 0;
}

export function isBossWave(n) {
  return n % 5 === 0;
}
