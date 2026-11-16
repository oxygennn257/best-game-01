// All canvas drawing: the night arena, the lantern's glow, every entity,
// the HUD, and the title / shop / pause / game-over screens. Nothing here
// changes game state; main.js owns the simulation.

import { ARENA, KINDS } from './entities.js';
import { SCREEN, UPGRADES, upgradeCost } from './state.js';
import { isBossWave } from './waves.js';

const W = 1280;
const H = 720;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, run, time) {
  ctx.fillStyle = '#0a0918';
  ctx.fillRect(0, 0, W, H);

  // Faint stars, fixed by index so they never twinkle-jump.
  ctx.fillStyle = 'rgba(200, 200, 255, 0.5)';
  for (let i = 0; i < 90; i++) {
    const x = (i * 173.3) % W;
    const y = (i * 97.7) % H;
    const tw = 0.25 + 0.25 * Math.sin(time * 1.3 + i);
    ctx.globalAlpha = Math.max(0.08, tw);
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Ground vignette: darker toward the edges, warm near the lantern.
  const g = ctx.createRadialGradient(ARENA.cx, ARENA.cy, 60, ARENA.cx, ARENA.cy, 620);
  g.addColorStop(0, 'rgba(255, 176, 66, 0.10)');
  g.addColorStop(0.45, 'rgba(30, 24, 64, 0.25)');
  g.addColorStop(1, 'rgba(4, 3, 12, 0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Old rune ring around the lantern's plinth.
  ctx.strokeStyle = 'rgba(255, 176, 66, 0.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ARENA.cx, ARENA.cy, 120, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 176, 66, 0.06)';
  ctx.beginPath();
  ctx.arc(ARENA.cx, ARENA.cy, 150, 0, Math.PI * 2);
  ctx.stroke();

  // Scattered floor rubble, fixed by index so it never jumps.
  ctx.fillStyle = 'rgba(141, 134, 184, 0.16)';
  for (let i = 0; i < 46; i++) {
    const x = (i * 211.7 + 60) % W;
    const y = (i * 131.3 + 90) % H;
    ctx.beginPath();
    ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  // Drifting dust motes, slow and faint.
  for (let i = 0; i < 22; i++) {
    const x = (i * 331.5 + Math.sin(time * 0.24 + i * 2.1) * 26 + W) % W;
    const y = (i * 197.9 + Math.cos(time * 0.19 + i * 1.3) * 18 + H) % H;
    ctx.globalAlpha = 0.12 + 0.1 * Math.sin(time * 0.8 + i);
    ctx.fillStyle = 'rgba(255, 210, 130, 0.35)';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Arena border: a broken ring of old stones.
  ctx.strokeStyle = 'rgba(141, 134, 184, 0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.strokeStyle = 'rgba(141, 134, 184, 0.12)';
  ctx.strokeRect(24, 24, W - 48, H - 48);
}

function drawLantern(ctx, run, time) {
  const { cx, cy, lanternR } = ARENA;
  // The flame never burns quite steady: two slow sines make it flicker,
  // and the glow breathes with it. A dying lantern flickers hardest.
  const flick = 0.86 + 0.14 * Math.sin(time * 9.7) * Math.sin(time * 5.3 + 1.7);
  const pulse = (1 + 0.05 * Math.sin(time * 2.4)) * (0.92 + 0.08 * flick);
  const lightFrac = Math.max(0, run.light) / 100;

  // Glow scales with remaining light: a dying lantern visibly dims.
  const glowR = (150 + 190 * lightFrac) * pulse;
  const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, glowR);
  glow.addColorStop(0, `rgba(255, 196, 90, ${0.55 * lightFrac + 0.08})`);
  glow.addColorStop(0.5, `rgba(255, 150, 50, ${0.22 * lightFrac + 0.03})`);
  glow.addColorStop(1, 'rgba(255, 150, 50, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Stone base + iron cage + flame.
  ctx.fillStyle = '#3a3458';
  ctx.beginPath();
  ctx.arc(cx, cy + 26, 30, 0, Math.PI);
  ctx.fill();
  ctx.fillRect(cx - 30, cy + 24, 60, 8);
  ctx.strokeStyle = '#241f3d';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, lanternR, 0, Math.PI * 2);
  ctx.stroke();
  const flameH = (26 + 8 * Math.sin(time * 5.1)) * (0.35 + 0.65 * lightFrac) * flick;
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 4, 13, flameH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 6, flameH * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rising ember sparks from the flame.
  for (let i = 0; i < 6; i++) {
    const rise = ((time * 34 + i * 47) % 90) / 90;
    const sx = cx + Math.sin(i * 2.4 + time * 1.2) * 10 * (1 - rise);
    const sy = cy - 8 - rise * 84;
    ctx.globalAlpha = (1 - rise) * 0.7 * lightFrac;
    ctx.fillStyle = '#ffb042';
    ctx.beginPath();
    ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Light bar under the lantern.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  roundRect(ctx, cx - 52, cy + 44, 104, 10, 5);
  ctx.fill();
  ctx.fillStyle = lightFrac > 0.3 ? '#ffb042' : '#ff5d73';
  roundRect(ctx, cx - 50, cy + 46, 100 * lightFrac, 6, 3);
  ctx.fill();
}

function drawPlayer(ctx, run, time) {
  const p = run.player;
  if (!p) return;
  ctx.save();
  if (p.invuln > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.35;

  // Aim line: long enough to read at a glance, with a ring at its tip.
  ctx.strokeStyle = 'rgba(94, 230, 168, 0.30)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.aim) * 96, p.y + Math.sin(p.aim) * 96);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(94, 230, 168, 0.45)';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.aim) * 96, p.y + Math.sin(p.aim) * 96, 5, 0, Math.PI * 2);
  ctx.stroke();

  // Wisp body: teal glow + bright core + little flame tail.
  const glow = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 34);
  glow.addColorStop(0, 'rgba(94, 230, 168, 0.5)');
  glow.addColorStop(1, 'rgba(94, 230, 168, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5ee6a8';
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#eafff3';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
  ctx.fill();
  // Eyes look toward the aim.
  ctx.fillStyle = '#06281a';
  const ex = Math.cos(p.aim) * 4;
  const ey = Math.sin(p.aim) * 4;
  ctx.beginPath();
  ctx.arc(p.x + ex - 4, p.y + ey - 2, 2.2, 0, Math.PI * 2);
  ctx.arc(p.x + ex + 4, p.y + ey - 2, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Hearts under the player.
  for (let i = 0; i < p.maxHp; i++) {
    const hx = p.x - 20 + i * 20;
    const hy = p.y + 26;
    ctx.fillStyle = i < p.hp ? '#ff5d73' : 'rgba(255, 93, 115, 0.2)';
    ctx.beginPath();
    ctx.arc(hx - 3, hy, 4, 0, Math.PI * 2);
    ctx.arc(hx + 3, hy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx - 6.5, hy + 1);
    ctx.lineTo(hx, hy + 8);
    ctx.lineTo(hx + 6.5, hy + 1);
    ctx.closePath();
    ctx.fill();
  }
}

function drawEnemy(ctx, e, time) {
  const def = KINDS[e.kind];
  const flash = e.flash > 0;
  ctx.save();
  // Shadow blob.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + e.r * 0.8, e.r * 0.9, e.r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = flash ? '#ffffff' : def.color;
  const core = flash ? '#ffffff' : def.core;
  const r = e.r;

  if (def.shape === 'dart') {
    // Skitter: an arrowhead darting at the lantern.
    const a = Math.atan2(ARENA.cy - e.y, ARENA.cx - e.x);
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(a);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(r + 6, 0);
    ctx.lineTo(-r * 0.7, -r * 0.75);
    ctx.lineTo(-r * 0.3, 0);
    ctx.lineTo(-r * 0.7, r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(r * 0.25, 0, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0b2e';
    ctx.beginPath();
    ctx.arc(r * 0.3, 0, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (def.shape === 'slab') {
    // Brute: an armoured hexagon with a crack and an inner plate.
    ctx.fillStyle = body;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6 + time * 0.15;
      const px = e.x + Math.cos(a) * r;
      const py = e.y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(e.x - r * 0.5, e.y - r * 0.4);
    ctx.lineTo(e.x - r * 0.1, e.y + r * 0.1);
    ctx.lineTo(e.x + r * 0.4, e.y - r * 0.2);
    ctx.stroke();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0b2e';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (def.shape === 'lobes') {
    // Splitter: two lobes joined in the middle, visibly about to burst apart.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(e.x - r * 0.42, e.y, r * 0.62, 0, Math.PI * 2);
    ctx.arc(e.x + r * 0.42, e.y, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(e.x - r * 0.42, e.y, r * 0.24, 0, Math.PI * 2);
    ctx.arc(e.x + r * 0.42, e.y, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0b2e';
    ctx.beginPath();
    ctx.arc(e.x - r * 0.42, e.y, r * 0.1, 0, Math.PI * 2);
    ctx.arc(e.x + r * 0.42, e.y, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (def.shape === 'maw') {
    // Spitter: a diamond whose mouth flares just before it spits.
    const flare = e.shootTimer < 0.6 ? 1 + (0.6 - e.shootTimer) * 1.4 : 1;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y - r - 4);
    ctx.lineTo(e.x + r + 4, e.y);
    ctx.lineTo(e.x, e.y + r + 4);
    ctx.lineTo(e.x - r - 4, e.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.42 * flare, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0b2e';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.2 * flare, 0, Math.PI * 2);
    ctx.fill();
  } else if (def.shape === 'crown') {
    // Warden: a heavy ring with a crown of points and orbiting spike orbs.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.72, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.42;
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(a - 0.16) * r * 0.8, e.y + Math.sin(a - 0.16) * r * 0.8);
      ctx.lineTo(e.x + Math.cos(a) * (r + 12), e.y + Math.sin(a) * (r + 12));
      ctx.lineTo(e.x + Math.cos(a + 0.16) * r * 0.8, e.y + Math.sin(a + 0.16) * r * 0.8);
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < 3; i++) {
      const a = time * 1.1 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(e.x + Math.cos(a) * (r + 16), e.y + Math.sin(a) * (r + 16), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0b2e';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Spike (shade): a jagged, uneven star.
    ctx.fillStyle = body;
    ctx.beginPath();
    const spikes = 7;
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 + time * 0.6;
      const uneven = 1 - (i % 3) * 0.1;
      const rr = i % 2 === 0 ? r * uneven : r * 0.72;
      const px = e.x + Math.cos(a) * rr;
      const py = e.y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0b2e';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  // HP bar for tough enemies.
  if (e.maxHp >= 8) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(e.x - 22, e.y - e.r - 12, 44, 5);
    ctx.fillStyle = '#ff5d73';
    ctx.fillRect(e.x - 21, e.y - e.r - 11, 42 * (e.hp / e.maxHp), 3);
  }
  ctx.restore();
}

function drawBullets(ctx, run) {
  for (const b of run.bullets) {
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8dd';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const b of run.enemyBullets) {
    ctx.fillStyle = '#ff5d73';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd0d6';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDrops(ctx, run, time) {
  for (const d of run.drops) {
    const bob = Math.sin(time * 4 + d.bob) * 3;
    if (d.kind === 'heart') {
      ctx.fillStyle = '#ff5d73';
      ctx.beginPath();
      ctx.arc(d.x - 3, d.y + bob, 4, 0, Math.PI * 2);
      ctx.arc(d.x + 3, d.y + bob, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(d.x - 6.5, d.y + bob + 1);
      ctx.lineTo(d.x, d.y + bob + 8);
      ctx.lineTo(d.x + 6.5, d.y + bob + 1);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#ffb042';
      ctx.save();
      ctx.translate(d.x, d.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
      ctx.fillStyle = '#ffe9a8';
      ctx.save();
      ctx.translate(d.x, d.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-2.5, -2.5, 5, 5);
      ctx.restore();
    }
  }
}

function drawParticles(ctx, run) {
  for (const p of run.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawRings(ctx, run) {
  for (const g of run.rings) {
    ctx.globalAlpha = Math.max(0, g.life / g.maxLife) * 0.9;
    ctx.strokeStyle = g.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawFloaters(ctx, run) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px "Trebuchet MS", sans-serif';
  for (const f of run.floaters) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, run) {
  ctx.textAlign = 'left';
  // Score block.
  ctx.fillStyle = 'rgba(6, 5, 16, 0.55)';
  roundRect(ctx, 24, 22, 250, 74, 10);
  ctx.fill();
  ctx.fillStyle = '#8d86b8';
  ctx.font = '12px "Trebuchet MS", sans-serif';
  ctx.fillText('SCORE', 40, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px "Trebuchet MS", sans-serif';
  ctx.fillText(String(run.score), 40, 76);
  ctx.fillStyle = '#ffb042';
  ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
  ctx.fillText(`⬢ ${run.embers}`, 196, 48);
  ctx.fillStyle = '#8d86b8';
  ctx.font = '12px "Trebuchet MS", sans-serif';
  ctx.fillText(`BEST ${run.best}`, 196, 70);

  // Wave + light block, top right.
  ctx.fillStyle = 'rgba(6, 5, 16, 0.55)';
  roundRect(ctx, W - 274, 22, 250, 74, 10);
  ctx.fill();
  ctx.fillStyle = '#8d86b8';
  ctx.font = '12px "Trebuchet MS", sans-serif';
  ctx.fillText(run.wave === 0 ? 'GET READY' : `WAVE ${run.wave}${isBossWave(run.wave) ? ' — WARDEN' : ''}`, W - 258, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
  ctx.fillText(`LANTERN ${Math.ceil(run.light)}%`, W - 258, 74);
  if (run.combo > 1) {
    ctx.fillStyle = '#5ee6a8';
    ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`COMBO x${run.combo}`, W / 2, 52);
    ctx.textAlign = 'left';
  }

  // Wave banner (fades in main.js via bannerTimer — drawn when set).
  if (run.bannerText && run.bannerTimer > 0) {
    ctx.globalAlpha = Math.min(1, run.bannerTimer * 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px "Trebuchet MS", sans-serif';
    ctx.fillText(run.bannerText, W / 2, 250);
    ctx.font = '18px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#ffb042';
    ctx.fillText(run.bannerSub || '', W / 2, 284);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

function centerText(ctx, text, y, font, color) {
  ctx.textAlign = 'center';
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, y);
  ctx.textAlign = 'left';
}

function drawTitle(ctx, run, time) {
  ctx.fillStyle = 'rgba(6, 5, 16, 0.62)';
  ctx.fillRect(0, 0, W, H);
  const bob = Math.sin(time * 1.8) * 8;
  centerText(ctx, 'LANTERNFALL', 210 + bob * 0.2, 'bold 84px "Trebuchet MS", sans-serif', '#ffd166');
  centerText(ctx, 'defend the last lantern', 258, 'italic 26px "Trebuchet MS", sans-serif', '#b7a8ff');
  centerText(ctx, 'The shades come for the light. Shoot them down, gather their embers,', 350, '20px "Trebuchet MS", sans-serif', '#cfc8ee');
  centerText(ctx, 'and spend embers between waves — every ember spent is score given up.', 380, '20px "Trebuchet MS", sans-serif', '#cfc8ee');
  centerText(ctx, 'WASD / arrows — move      Mouse — aim      Hold click / Space — shoot', 450, '19px "Trebuchet MS", sans-serif', '#8d86b8');
  centerText(ctx, run.best > 0 ? `BEST SCORE  ${run.best}` : 'NO KEEPER HAS FALLEN YET', 500, 'bold 20px "Trebuchet MS", sans-serif', '#ffb042');
  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.globalAlpha = pulse;
  centerText(ctx, '— CLICK OR PRESS ENTER TO BEGIN —', 580, 'bold 24px "Trebuchet MS", sans-serif', '#5ee6a8');
  ctx.globalAlpha = 1;
  centerText(ctx, 'M — mute sound', 660, '14px "Trebuchet MS", sans-serif', '#6f6896');
}

function drawShop(ctx, run, upgrades) {
  ctx.fillStyle = 'rgba(6, 5, 16, 0.86)';
  ctx.fillRect(0, 0, W, H);
  centerText(ctx, `WAVE ${run.wave} CLEARED`, 130, 'bold 46px "Trebuchet MS", sans-serif', '#ffd166');
  centerText(ctx, `You hold ${run.embers} embers — spend them, or keep them as score.`, 172, '20px "Trebuchet MS", sans-serif', '#cfc8ee');
  const cardW = 250;
  const gap = 24;
  const totalW = cardW * 4 + gap * 3;
  let x = (W - totalW) / 2;
  const y = 230;
  UPGRADES.forEach((def, i) => {
    const lvl = upgrades[def.id];
    const cost = upgradeCost(def, lvl);
    const afford = run.embers >= cost && lvl < def.max;
    const sel = run.shopSelection === i;
    ctx.fillStyle = sel ? 'rgba(255, 176, 66, 0.16)' : 'rgba(20, 18, 48, 0.9)';
    roundRect(ctx, x, y, cardW, 220, 12);
    ctx.fill();
    ctx.strokeStyle = sel ? '#ffb042' : 'rgba(141, 134, 184, 0.4)';
    ctx.lineWidth = sel ? 3 : 1;
    roundRect(ctx, x, y, cardW, 220, 12);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb042';
    ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
    ctx.fillText(`[${def.key}]`, x + cardW / 2, y + 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
    ctx.fillText(def.name, x + cardW / 2, y + 82);
    ctx.fillStyle = '#cfc8ee';
    ctx.font = '17px "Trebuchet MS", sans-serif';
    ctx.fillText(def.desc, x + cardW / 2, y + 116);
    ctx.fillStyle = '#8d86b8';
    ctx.font = '15px "Trebuchet MS", sans-serif';
    ctx.fillText(def.id === 'mend' ? 'Repeatable' : (lvl >= def.max ? 'MAXED OUT' : `Level ${lvl} → ${lvl + 1}`), x + cardW / 2, y + 148);
    ctx.fillStyle = afford ? '#5ee6a8' : '#ff5d73';
    ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
    ctx.fillText(lvl >= def.max ? '—' : `⬢ ${cost}`, x + cardW / 2, y + 186);
    ctx.textAlign = 'left';
    x += cardW + gap;
  });
  centerText(ctx, 'Press 1–4 or click a card to buy — ENTER or click CONTINUE for the next wave', 510, '19px "Trebuchet MS", sans-serif', '#8d86b8');
  ctx.fillStyle = '#5ee6a8';
  roundRect(ctx, W / 2 - 130, 550, 260, 56, 12);
  ctx.fill();
  centerText(ctx, 'NEXT WAVE  ➜', 586, 'bold 24px "Trebuchet MS", sans-serif', '#06281a');
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(6, 5, 16, 0.66)';
  ctx.fillRect(0, 0, W, H);
  centerText(ctx, 'PAUSED', 300, 'bold 64px "Trebuchet MS", sans-serif', '#ffffff');
  centerText(ctx, 'P or Esc — resume      R — restart the run', 360, '20px "Trebuchet MS", sans-serif', '#cfc8ee');
}

function drawOver(ctx, run) {
  ctx.fillStyle = 'rgba(6, 5, 16, 0.86)';
  ctx.fillRect(0, 0, W, H);
  centerText(ctx, 'THE LIGHT WENT OUT', 190, 'bold 62px "Trebuchet MS", sans-serif', '#ff5d73');
  centerText(ctx, `The lantern held through ${run.wave} wave${run.wave === 1 ? '' : 's'} — ${run.kills} shades banished.`, 250, '22px "Trebuchet MS", sans-serif', '#cfc8ee');
  centerText(ctx, `SCORE  ${run.score}`, 330, 'bold 44px "Trebuchet MS", sans-serif', '#ffd166');
  if (run.newBest) centerText(ctx, '★ NEW BEST SCORE ★', 388, 'bold 24px "Trebuchet MS", sans-serif', '#5ee6a8');
  else centerText(ctx, `BEST  ${run.best}`, 388, '20px "Trebuchet MS", sans-serif', '#8d86b8');
  centerText(ctx, `Embers gathered: ${run.stats.embersCollected}      Accuracy: ${run.shotsFired ? Math.round((run.kills / Math.max(1, run.shotsFired)) * 100) : 0}% of shots found a shade`, 440, '18px "Trebuchet MS", sans-serif', '#cfc8ee');
  const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 300);
  ctx.globalAlpha = pulse;
  centerText(ctx, '— PRESS R OR CLICK TO KEEP AGAIN —', 540, 'bold 24px "Trebuchet MS", sans-serif', '#5ee6a8');
  ctx.globalAlpha = 1;
}

export function render(ctx, run, upgrades, time) {
  ctx.save();
  if (run.shake > 0) {
    const s = run.shake;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawBackground(ctx, run, time);
  drawLantern(ctx, run, time);
  drawDrops(ctx, run, time);
  for (const e of run.enemies) drawEnemy(ctx, e, time);
  drawBullets(ctx, run);
  drawPlayer(ctx, run, time);
  drawParticles(ctx, run);
  drawRings(ctx, run);
  drawFloaters(ctx, run);
  ctx.restore();

  if (run.screen === SCREEN.PLAYING || run.screen === SCREEN.PAUSED) drawHud(ctx, run);
  if (run.screen === SCREEN.TITLE) drawTitle(ctx, run, time);
  if (run.screen === SCREEN.SHOP) drawShop(ctx, run, upgrades);
  if (run.screen === SCREEN.PAUSED) drawPaused(ctx);
  if (run.screen === SCREEN.OVER) drawOver(ctx, run);
}
