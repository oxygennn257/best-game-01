// LANTERNFALL bootstrap and game loop: a fixed 1/60 s simulation step, the
// screen state machine, shooting, collisions, waves and the shop. Rendering
// lives in render.js; sound in audio.js; input in input.js.

import { render } from './render.js';
import { attachInput, keys, mouse, endFrame } from './input.js';
import { sfx, unlockAudio, toggleMute, startDrone } from './audio.js';
import { newRun, SCREEN, UPGRADES, newUpgrades, saveBest, upgradeCost } from './state.js';
import {
  ARENA, makePlayer, makeBullet, makeEnemyBullet, makeDrop,
  burst, floater, updateParticles, updateFloaters, steerEnemy, orbitEnemy,
  spawnRing, updateRings,
  splitEnemy, pickDropKind,
} from './entities.js';
import { startWave, spawnNext, spawnInterval, waveCleared, isBossWave } from './waves.js';
import { makeRng, range } from './rng.js';
import { buildShotScene, shotParams } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let run = newRun();
let upgrades = newUpgrades();
let rng = makeRng((Date.now() % 2147483647) >>> 0);
let time = 0;
let last = performance.now();
let pausedFromShop = false;

function resetRun() {
  run = newRun();
  upgrades = newUpgrades();
  rng = makeRng((Date.now() % 2147483647) >>> 0);
  run.player = makePlayer();
  run.screen = SCREEN.PLAYING;
  run.waveState = 'idle';
  run.betweenTimer = 1.2;
  run.bannerText = 'DEFEND THE LANTERN';
  run.bannerSub = 'the shades are coming';
  run.bannerTimer = 2.0;
  sfx.wave();
}

function startGame() {
  unlockAudio();
  startDrone();
  resetRun();
}

function gameOver() {
  run.screen = SCREEN.OVER;
  sfx.over();
  if (run.score > run.best) {
    run.best = run.score;
    run.newBest = true;
    saveBest(run.score);
  }
}

function openShop() {
  run.screen = SCREEN.SHOP;
  run.shopSelection = 0;
  sfx.win();
}

function buyUpgrade(i) {
  const def = UPGRADES[i];
  if (!def) return;
  const lvl = upgrades[def.id];
  if (lvl >= def.max) { sfx.denied(); return; }
  const cost = upgradeCost(def, lvl);
  if (run.embers < cost) { sfx.denied(); return; }
  run.embers -= cost;
  upgrades[def.id] = lvl + 1;
  if (def.id === 'mend') {
    run.light = Math.min(100, run.light + 35);
    floater(run.floaters, ARENA.cx, ARENA.cy - 70, '+35 LIGHT', '#5ee6a8');
  }
  sfx.buy();
}

function nextWave() {
  run.screen = SCREEN.PLAYING;
  const total = startWave(run, rng);
  run.bannerText = `WAVE ${run.wave}${isBossWave(run.wave) ? ' — WARDEN' : ''}`;
  run.bannerSub = `${total} shades approach`;
  run.bannerTimer = 2.0;
  sfx.wave();
}

function fireBullet() {
  const p = run.player;
  const spreadN = 1 + upgrades.spread;
  const base = p.aim;
  for (let i = 0; i < spreadN; i++) {
    const off = (i - (spreadN - 1) / 2) * 0.14;
    run.bullets.push(makeBullet(p.x + Math.cos(base) * 20, p.y + Math.sin(base) * 20, base + off));
  }
  run.shotsFired++;
  sfx.shoot();
}

function killEnemy(idx, awardScore) {
  const e = run.enemies[idx];
  run.enemies.splice(idx, 1);
  run.kills++;
  run.combo++;
  run.comboTimer = 2.5;
  const mult = Math.min(5, 1 + Math.floor(run.combo / 4));
  const gained = e.score * mult;
  if (awardScore) {
    run.score += gained;
    floater(run.floaters, e.x, e.y - 10, `+${gained}`, '#ffd166');
  }
  burst(run.particles, e.x, e.y, e.kind === 'warden' ? '#ff5d73' : '#b06ee8', e.kind === 'warden' ? 44 : 18, 240, 0.7);
  spawnRing(run.rings, e.x, e.y, e.kind === 'warden' ? '#ff5d73' : '#e9d5ff', e.kind === 'warden' ? 150 : 72);
  sfx.boom();
  run.shake = Math.min(14, run.shake + (e.kind === 'warden' ? 10 : 3));
  // Ember drops.
  for (let i = 0; i < e.embers; i++) {
    const d = makeDrop(e.x, e.y, rng);
    d.kind = pickDropKind(rng);
    run.drops.push(d);
  }
  // Splitters burst into two shades.
  if (e.kind === 'splitter') {
    for (const s of splitEnemy(e, rng)) run.enemies.push(s);
  }
}

function damagePlayer() {
  const p = run.player;
  if (p.invuln > 0) return;
  p.hp--;
  p.invuln = 1.2;
  p.hurtTimer = 0.25;
  run.shake = 12;
  sfx.hurt();
  burst(run.particles, p.x, p.y, '#ff5d73', 16, 200, 0.6);
  if (p.hp <= 0) gameOver();
}

function updatePlaying(dt) {
  const p = run.player;
  run.timePlayed += dt;

  // Combo decay.
  if (run.comboTimer > 0) {
    run.comboTimer -= dt;
    if (run.comboTimer <= 0) run.combo = 0;
  }
  if (run.bannerTimer > 0) run.bannerTimer -= dt;
  if (run.shake > 0) run.shake = Math.max(0, run.shake - dt * 30);
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
  if (p.invuln > 0) p.invuln -= dt;

  // Movement.
  let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  const mag = Math.hypot(mx, my);
  if (mag > 0) { mx /= mag; my /= mag; }
  const speed = p.speed * (1 + upgrades.boots * 0.18);
  p.x = Math.max(30, Math.min(ARENA.w - 30, p.x + mx * speed * dt));
  p.y = Math.max(30, Math.min(ARENA.h - 30, p.y + my * speed * dt));
  p.aim = Math.atan2(mouse.y - p.y, mouse.x - p.x);

  // Firing.
  p.fireTimer -= dt;
  const firing = mouse.down || keys.shoot;
  const fireInterval = 0.22 / (1 + upgrades.rapid * 0.25);
  if (firing && p.fireTimer <= 0) {
    fireBullet();
    p.fireTimer = fireInterval;
  }

  // Wave flow.
  if (run.waveState === 'idle') {
    run.betweenTimer -= dt;
    if (run.betweenTimer <= 0) nextWave();
  } else if (run.waveState === 'spawning') {
    run.spawnTimer -= dt;
    if (run.spawnTimer <= 0) {
      if (run.spawnQueue.length > 0) {
        spawnNext(run, rng);
        run.spawnTimer = spawnInterval(run.wave);
      } else {
        run.waveState = 'fighting';
      }
    }
  } else if (run.waveState === 'fighting' && waveCleared(run)) {
    run.waveState = 'done';
    run.stats.wavesCleared++;
    run.score += 50 + run.wave * 10;
    floater(run.floaters, ARENA.cx, ARENA.cy - 90, `WAVE BONUS +${50 + run.wave * 10}`, '#5ee6a8');
    openShop();
    return;
  }

  // Enemies: steer, chew the lantern, shoot (spitters).
  for (let i = run.enemies.length - 1; i >= 0; i--) {
    const e = run.enemies[i];
    if (e.flash > 0) e.flash -= dt;
    steerEnemy(e, dt, time);
    if (e.chewing) {
      run.light -= (e.kind === 'brute' ? 6 : e.kind === 'warden' ? 10 : 3) * dt;
      if (Math.random() < dt * 6) burst(run.particles, ARENA.cx, ARENA.cy, '#ffb042', 2, 60, 0.4);
      if (run.light <= 0) {
        run.light = 0;
        burst(run.particles, ARENA.cx, ARENA.cy, '#ffb042', 40, 260, 1);
        spawnRing(run.rings, ARENA.cx, ARENA.cy, '#ffb042', 320, 0.9);
        gameOver();
        return;
      }
    }
    if (e.kind === 'spitter') {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = range(rng, 2.0, 3.2);
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        run.enemyBullets.push(makeEnemyBullet(e.x, e.y, a));
      }
    }
    // Touch damage.
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < p.r + e.r - 2) {
      damagePlayer();
      // Knock the shade back so it cannot drain the player in one frame.
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      e.x += Math.cos(a) * 26;
      e.y += Math.sin(a) * 26;
      if (run.screen !== SCREEN.PLAYING) return;
    }
  }

  // Player bullets.
  for (let i = run.bullets.length - 1; i >= 0; i--) {
    const b = run.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0 || b.x < -20 || b.x > ARENA.w + 20 || b.y < -20 || b.y > ARENA.h + 20;
    if (!dead) {
      for (let j = run.enemies.length - 1; j >= 0; j--) {
        const e = run.enemies[j];
        if (Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r) {
          e.hp--;
          e.flash = 0.08;
          sfx.hit();
          burst(run.particles, b.x, b.y, '#ffe9a8', 4, 120, 0.3);
          if (e.hp <= 0) killEnemy(j, true);
          dead = true;
          break;
        }
      }
    }
    if (dead) run.bullets.splice(i, 1);
  }

  // Enemy bullets.
  for (let i = run.enemyBullets.length - 1; i >= 0; i--) {
    const b = run.enemyBullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0 || b.x < -20 || b.x > ARENA.w + 20 || b.y < -20 || b.y > ARENA.h + 20;
    if (!dead && Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r) {
      damagePlayer();
      dead = true;
      if (run.screen !== SCREEN.PLAYING) return;
    }
    if (dead) run.enemyBullets.splice(i, 1);
  }

  // Ember drops: drift, magnet toward the player when close, collect.
  for (let i = run.drops.length - 1; i >= 0; i--) {
    const d = run.drops[i];
    d.life -= dt;
    if (d.life <= 0) { run.drops.splice(i, 1); continue; }
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vx *= 0.92;
    d.vy *= 0.92;
    const dist = Math.hypot(p.x - d.x, p.y - d.y);
    if (dist < 110) {
      d.x += ((p.x - d.x) / dist) * 260 * dt;
      d.y += ((p.y - d.y) / dist) * 260 * dt;
    }
    if (dist < p.r + d.r + 4) {
      run.drops.splice(i, 1);
      run.stats.embersCollected++;
      if (d.kind === 'heart') {
        if (p.hp < p.maxHp) {
          p.hp++;
          floater(run.floaters, p.x, p.y - 24, '+1 ❤', '#ff5d73');
        } else {
          run.score += 25;
          floater(run.floaters, p.x, p.y - 24, '+25', '#ff5d73');
        }
      } else {
        run.embers++;
        run.score += 5;
        run.light = Math.min(100, run.light + 0.8);
      }
      sfx.pickup();
      burst(run.particles, d.x, d.y, '#ffb042', 5, 90, 0.35);
    }
  }

  updateParticles(run.particles, dt);
  updateRings(run.rings, dt);
  updateFloaters(run.floaters, dt);
}

function update(dt) {
  time += dt;

  if (keys.mute) {
    keys.mute = false;
    toggleMute();
  }

  switch (run.screen) {
    case SCREEN.TITLE: {
      // Attract mode: shades circle the lantern on a wide ellipse behind
      // the title, never crossing the text.
      if (run.enemies.length === 0) {
        run.player = makePlayer();
        for (let i = 0; i < 5; i++) {
          const a = rng() * Math.PI * 2;
          run.enemies.push({ kind: 'shade', x: ARENA.cx + Math.cos(a) * 480, y: ARENA.cy + Math.sin(a) * 260, r: 16, hp: 2, maxHp: 2, speed: 30, score: 0, embers: 0, wobble: rng() * 6, shootTimer: 0, flash: 0, chewing: false });
        }
      }
      for (const e of run.enemies) orbitEnemy(e, dt);
      updateParticles(run.particles, dt);
      updateRings(run.rings, dt);
      if (mouse.clicked || keys.confirm || keys.shoot) startGame();
      break;
    }
    case SCREEN.PLAYING: {
      updatePlaying(dt);
      if (keys.pause) {
        keys.pause = false;
        run.prevScreen = SCREEN.PLAYING;
        run.screen = SCREEN.PAUSED;
      }
      break;
    }
    case SCREEN.SHOP: {
      if (keys.buy1) { keys.buy1 = false; buyUpgrade(0); }
      if (keys.buy2) { keys.buy2 = false; buyUpgrade(1); }
      if (keys.buy3) { keys.buy3 = false; buyUpgrade(2); }
      if (keys.buy4) { keys.buy4 = false; buyUpgrade(3); }
      if (mouse.clicked) {
        // Click a shop card (same geometry as render.js draws).
        const cardW = 250;
        const gap = 24;
        const totalW = cardW * 4 + gap * 3;
        let x = (1280 - totalW) / 2;
        const y = 230;
        for (let i = 0; i < 4; i++) {
          if (mouse.x >= x && mouse.x <= x + cardW && mouse.y >= y && mouse.y <= y + 220) buyUpgrade(i);
          x += cardW + gap;
        }
        // Continue button.
        if (mouse.x >= 510 && mouse.x <= 770 && mouse.y >= 550 && mouse.y <= 606) nextWave();
      }
      if (keys.confirm) {
        keys.confirm = false;
        nextWave();
      }
      updateParticles(run.particles, dt);
      updateRings(run.rings, dt);
      updateFloaters(run.floaters, dt);
      break;
    }
    case SCREEN.PAUSED: {
      if (keys.pause) {
        keys.pause = false;
        run.screen = run.prevScreen;
      }
      if (keys.restart) {
        keys.restart = false;
        startGame();
      }
      break;
    }
    case SCREEN.OVER: {
      updateParticles(run.particles, dt);
      updateRings(run.rings, dt);
      updateFloaters(run.floaters, dt);
      if (keys.restart || mouse.clicked) startGame();
      break;
    }
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render(ctx, run, upgrades, time);
  endFrame();
  requestAnimationFrame(frame);
}

function autotest() {
  // Headless self-test: scripted play (circle-strafe + hold fire) through
  // the real update loop, then report the run's numbers in the title.
  // Run: chromium --headless --dump-dom "http://localhost:8091/?autotest=1"
  try {
    startGame();
    for (let i = 0; i < 3600; i++) {
      // A decent bot: aim at the nearest enemy, close to 220 px, strafe.
      const p = run.player;
      let nearest = null;
      let nd = Infinity;
      for (const e of run.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < nd) { nd = d; nearest = e; }
      }
      if (nearest) {
        mouse.x = nearest.x;
        mouse.y = nearest.y;
        const a = Math.atan2(p.y - nearest.y, p.x - nearest.x);
        const want = nd > 240 ? 0 : 1; // approach or strafe
        const mx = want === 0 ? -Math.cos(a) : -Math.sin(a) * (i % 120 < 60 ? 1 : -1);
        const my = want === 0 ? -Math.sin(a) : Math.cos(a) * (i % 120 < 60 ? 1 : -1);
        keys.right = mx > 0.3;
        keys.left = mx < -0.3;
        keys.down = my > 0.3;
        keys.up = my < -0.3;
      } else {
        // No enemies: drift back toward the lantern, keep firing nowhere.
        mouse.x = 640;
        mouse.y = 200;
        const a = Math.atan2(360 - p.y, 640 - p.x);
        keys.right = Math.cos(a) > 0.3;
        keys.left = Math.cos(a) < -0.3;
        keys.down = Math.sin(a) > 0.3;
        keys.up = Math.sin(a) < -0.3;
      }
      mouse.down = true;
      if (run.screen === SCREEN.SHOP) {
        if (run.embers >= 12) buyUpgrade(0);
        nextWave();
      }
      if (run.screen === SCREEN.OVER) break;
      update(1 / 60);
    }
    const result = {
      screen: run.screen, wave: run.wave, score: run.score,
      kills: run.kills, embers: run.embers, light: Math.round(run.light),
      enemies: run.enemies.length, hp: run.player ? run.player.hp : null,
      time: Math.round(run.timePlayed),
    };
    window.__testResult = JSON.stringify(result);
    document.title = `AUTOTEST ${window.__testResult}`;
  } catch (e) {
    window.__testResult = JSON.stringify({ error: String((e && e.message) || e) });
    document.title = `AUTOTEST ${window.__testResult}`;
  }
}

function boot() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('autotest') === '1') {
    attachInput(canvas, () => { unlockAudio(); startDrone(); });
    autotest();
    return;
  }
  const shot = shotParams();
  if (shot) {
    // Deterministic screenshot scene: build, render once, signal readiness.
    const built = buildShotScene(shot.shot, shot.seed);
    run = built.run;
    upgrades = built.upgrades;
    render(ctx, run, upgrades, 1.6);
    window.__shotReady = true;
    return;
  }
  attachInput(canvas, () => { unlockAudio(); startDrone(); });
  run.player = makePlayer();
  requestAnimationFrame(frame);
}

boot();
