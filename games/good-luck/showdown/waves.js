// Endlos-Wellen: Punktebudget pro Welle, Boss alle 5 Wellen
import { C } from '../shared/palette.js';
import { ring, line } from '../shared/draw.js';
import { sfx } from '../shared/audio.js';
import { blocked } from './arena.js';
import { spawnEnemy } from './enemies.js';
import { CLEAR, BOSS, pick } from './text.js';

const COST = { drac: 1, shield: 2, bike: 3, drone: 3 };
const TELEGRAPH = 0.7;

function weights(n, drones) {
  const w = { drac: 5 };
  if (n >= 2) w.shield = 2 + n * 0.4;
  if (n >= 3) w.bike = 2;
  if (n >= 4 && drones < 1 + Math.floor(n / 6)) w.drone = 1.5;
  return w;
}

function choose(w, budget) {
  const opts = Object.entries(w).filter(([t]) => COST[t] <= budget);
  let r = Math.random() * opts.reduce((s, [, v]) => s + v, 0);
  for (const [t, v] of opts) { r -= v; if (r <= 0) return t; }
  return opts[0][0];
}

export function startWave(g) {
  g.wave++;
  const n = g.wave;
  g.queue = [];
  g.waveState = 'spawning';
  g.waveT = 0;
  if (n % 5 === 0) {
    g.queue.push('boss');
    for (let i = 0; i < Math.floor(n / 5) + 1; i++) g.queue.push('drac');
    g.say(pick(BOSS));
    sfx.alarm();
  } else {
    let budget = 4 + 2 * n, drones = 0;
    while (budget > 0) {
      const t = choose(weights(n, drones), budget);
      if (t === 'drone') drones++;
      g.queue.push(t);
      budget -= COST[t];
    }
    sfx.wave();
  }
  g.spawnTimer = 0.4;
}

function spawnPoint(g) {
  for (let i = 0; i < 20; i++) {
    let x, y;
    const side = (Math.random() * 4) | 0;
    if (side === 0) { x = 12; y = 70 + Math.random() * 90; }
    else if (side === 1) { x = 308; y = 20 + Math.random() * 140; }
    else if (side === 2) { x = 20 + Math.random() * 280; y = 160; }
    else { x = Math.random() < 0.5 ? 10 + Math.random() * 60 : 250 + Math.random() * 60; y = 20; }
    if (!blocked(x, y, 7) && Math.hypot(x - g.p.x, y - g.p.y) > 60) return [x, y];
  }
  return [160, 160];
}

export function queueSpawn(g, type) {
  const [x, y] = spawnPoint(g);
  g.spawns.push({ type, x, y, t: TELEGRAPH });
}

export function updateWaves(g, dt) {
  g.waveT += dt;
  for (const s of g.spawns) {
    s.t -= dt;
    if (s.t <= 0) spawnEnemy(g, s.type, s.x, s.y);
  }
  g.spawns = g.spawns.filter((s) => s.t > 0);

  if (g.waveState === 'spawning') {
    g.spawnTimer -= dt;
    if (g.spawnTimer <= 0 && g.queue.length) {
      queueSpawn(g, g.queue.shift());
      g.spawnTimer = Math.max(0.35, 0.9 - g.wave * 0.03);
    }
    if (!g.queue.length && !g.spawns.length && !g.enemies.length) {
      g.waveState = 'clear';
      g.interT = 3.2;
      if (g.wave > 0) { g.say(pick(CLEAR)); sfx.pickup(); }
    }
  } else if (g.waveState === 'clear') {
    g.interT -= dt;
    if (g.interT <= 0) startWave(g);
  }
}

export function drawSpawns(ctx, g) {
  for (const s of g.spawns) {
    if (Math.floor(s.t * 14) % 2) continue;
    const col = s.type === 'boss' ? C.r : C.white;
    ring(ctx, s.x, s.y + 4, 3 + (TELEGRAPH - s.t) * 8, col, 0.4);
    line(ctx, s.x - 2, s.y + 2, s.x + 2, s.y + 6, col);
    line(ctx, s.x + 2, s.y + 2, s.x - 2, s.y + 6, col);
  }
}
