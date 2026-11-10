import { C } from '../shared/palette.js';
import { fillEllipse, ring, line } from '../shared/draw.js';
import { sfx } from '../shared/audio.js';
import {
  bake, silhouette, walkFrames, DRAC_BODY, DRAC_LEGS, DRAC_MAP, BOSS, BOSS_MAP, BIKE, BIKE_MAP, DRONE, DRONE_MAP,
} from '../shared/sprites.js';
import { moveCircle } from './arena.js';
import { COLOR_OF } from './crew.js';
import { hurtPlayer } from './player.js';
import { spawnBullet } from './bullets.js';
import { spawnPickup } from './pickups.js';

const TYPES = {
  drac: { hp: 3, r: 4, speed: 26, score: 10 },
  shield: { hp: 4, r: 4, speed: 24, score: 15 },
  bike: { hp: 3, r: 5, speed: 0, score: 20 },
  drone: { hp: 2, r: 4, speed: 48, score: 25, fly: true },
  boss: { hp: 60, r: 7, speed: 18, score: 250 },
};
const COLORS = ['y', 'g', 'b', 'r'];
const KILL_WORDS = ['ZAP!', 'ZAP!', 'POW!', 'ZAP!'];

let S = null;
export function bakeEnemies() {
  const dracRows = [...DRAC_BODY, ...DRAC_LEGS[0]];
  S = {
    drac: walkFrames(DRAC_BODY, DRAC_LEGS, DRAC_MAP),
    dracFlash: silhouette(dracRows, C.pink),
    boss: { r: bake(BOSS, BOSS_MAP), l: bake(BOSS, BOSS_MAP, true) },
    bossFlash: silhouette(BOSS, C.pink),
    bike: { r: bake(BIKE, BIKE_MAP), l: bake(BIKE, BIKE_MAP, true) },
    bikeFlash: silhouette(BIKE, C.pink),
    drone: bake(DRONE, DRONE_MAP),
    droneFlash: silhouette(DRONE, C.pink),
  };
}

export function spawnEnemy(g, type, x, y) {
  const t = TYPES[type];
  const e = {
    type, x, y, r: t.r, hp: t.hp, maxhp: t.hp, speed: t.speed, score: t.score, fly: !!t.fly,
    flash: 0, shieldFlash: 0, shield: null, shoot: 1.2 + Math.random() * 1.6, t: Math.random() * 10,
    side: Math.random() < 0.5 ? 1 : -1, state: 'wait', stateT: 0.6 + Math.random() * 0.6,
    vx: 0, vy: 0, anim: Math.random(), face: 1, phase: Math.random() * Math.PI * 2,
  };
  if (type === 'shield') e.shield = COLORS[(Math.random() * 4) | 0];
  if (type === 'boss') {
    e.hp = e.maxhp = 45 + g.wave * 4;
    e.shield = COLORS[(Math.random() * 4) | 0];
    e.shieldT = 6; e.summon = 8; e.volley = 0;
  }
  g.enemies.push(e);
  return e;
}

export function damageEnemy(g, e, b) {
  if (e.shield && e.shield !== b.col) {
    e.shieldFlash = 0.15;
    g.hint = { col: e.shield, t: 2 };
    g.parts.burst(b.x, b.y, 4, C.paper, 50, 0.2);
    sfx.tink();
    return 'blocked';
  }
  e.hp -= b.dmg;
  e.flash = 0.08;
  const sp = Math.hypot(b.vx, b.vy) || 1;
  if (e.type !== 'boss') moveCircle(e, (b.vx / sp) * 2, (b.vy / sp) * 2, e.fly);
  g.parts.burst(b.x, b.y, 4, COLOR_OF[b.col], 50, 0.25);
  if (e.hp <= 0) killEnemy(g, e); else sfx.hit();
  return 'hit';
}

function killEnemy(g, e) {
  g.combo++; g.comboT = 2;
  const mult = comboMult(g);
  const pts = e.score * mult;
  g.score += pts;
  g.floats.add(e.x, e.y - 12, `+${pts}`, mult > 1 ? C.mustard : C.paper);
  g.parts.burst(e.x, e.y, e.type === 'boss' ? 40 : 14, C.white, 80, 0.5);
  g.parts.burst(e.x, e.y, 8, C.pink, 60, 0.4);
  if (e.type === 'boss') {
    g.bursts.add(e.x, e.y, 'BOOM', C.mustard, C.o, 3, 0.9);
    g.shake.add(5, 0.5);
    sfx.boom();
    spawnPickup(g, e.x, e.y + 8);
  } else {
    g.bursts.add(e.x, e.y - 4, KILL_WORDS[(Math.random() * KILL_WORDS.length) | 0]);
    g.shake.add(1, 0.08);
    sfx.kill();
    if (Math.random() < 0.1) spawnPickup(g, e.x, e.y);
  }
}

export const comboMult = (g) => Math.min(8, 1 + Math.floor(g.combo / 4));

function shootAt(g, e, spread, speed = 75, angleOffset = 0) {
  const a = Math.atan2(g.p.y - e.y, g.p.x - e.x) + (Math.random() - 0.5) * spread + angleOffset;
  spawnBullet(g, { owner: 'e', x: e.x, y: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 3, r: 2 });
}

export function updateEnemies(g, dt) {
  const p = g.p;
  const spread = g.marked ? 0.06 : 0.35;
  for (const e of g.enemies) {
    e.t += dt; e.flash -= dt; e.shieldFlash -= dt;
    const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    e.face = dx < 0 ? -1 : 1;

    if (e.type === 'drac' || e.type === 'shield' || e.type === 'boss') {
      const near = e.type === 'boss' ? 55 : 45, far = e.type === 'boss' ? 75 : 30;
      let vx = 0, vy = 0;
      if (dist > near) { vx = ux; vy = uy; }
      else if (dist < far) { vx = -ux; vy = -uy; }
      else { vx = -uy * e.side; vy = ux * e.side; }
      // Abstand zu anderen Gegnern halten
      for (const o of g.enemies) {
        if (o === e || o.fly) continue;
        const ox = e.x - o.x, oy = e.y - o.y, d2 = ox * ox + oy * oy;
        if (d2 < 144 && d2 > 0) { vx += ox / Math.sqrt(d2) * 0.8; vy += oy / Math.sqrt(d2) * 0.8; }
      }
      const vl = Math.hypot(vx, vy);
      if (vl) {
        if (moveCircle(e, (vx / vl) * e.speed * dt, (vy / vl) * e.speed * dt)) e.side *= -1;
        e.anim += dt;
      }
      e.shoot -= dt;
      if (e.type === 'boss') updateBoss(g, e, dt, spread);
      else if (e.shoot <= 0 && dist < 170) {
        shootAt(g, e, spread);
        sfx.enemyShot();
        e.shoot = Math.max(1.2, 2.6 - g.wave * 0.06) + Math.random() * 1.2;
      }
    } else if (e.type === 'bike') {
      updateBike(g, e, dt, ux, uy);
    } else if (e.type === 'drone') {
      const tx = p.x + Math.cos(e.t * 0.6 + e.phase) * 78, ty = p.y + Math.sin(e.t * 0.6 + e.phase) * 50;
      const ddx = tx - e.x, ddy = ty - e.y, dl = Math.hypot(ddx, ddy);
      if (dl > 2) moveCircle(e, (ddx / dl) * e.speed * dt, (ddy / dl) * e.speed * dt, true);
    }

    // Kontaktschaden
    const rr = e.r + p.r;
    if (!e.fly && dx * dx + dy * dy < rr * rr) hurtPlayer(g);
  }
  g.enemies = g.enemies.filter((e) => e.hp > 0);
}

function updateBike(g, e, dt, ux, uy) {
  e.stateT -= dt;
  if (e.state === 'wait') {
    if (e.stateT <= 0) {
      e.state = 'aim'; e.stateT = 0.75;
      e.tx = g.p.x; e.ty = g.p.y;
      sfx.telegraph();
    }
  } else if (e.state === 'aim') {
    if (e.stateT <= 0) {
      const ddx = e.tx - e.x, ddy = e.ty - e.y, dl = Math.hypot(ddx, ddy) || 1;
      e.vx = (ddx / dl) * 230; e.vy = (ddy / dl) * 230;
      e.face = e.vx < 0 ? -1 : 1;
      e.state = 'dash'; e.stateT = 1.1;
    }
  } else if (e.state === 'dash') {
    e.face = e.vx < 0 ? -1 : 1;
    const hit = moveCircle(e, e.vx * dt, e.vy * dt);
    g.parts.spawn(e.x - e.face * 7, e.y + 4, -e.vx * 0.1, 0, 0.3, C.paper, 2);
    if (hit || e.stateT <= 0) {
      if (hit) { g.parts.burst(e.x, e.y, 6, C.ochre, 40, 0.3); g.shake.add(1, 0.1); }
      e.state = 'wait'; e.stateT = 0.7 + Math.random() * 0.8;
    }
  }
}

function updateBoss(g, e, dt, spread) {
  const phase2 = e.hp < e.maxhp / 2;
  e.shieldT -= dt;
  if (e.shieldT <= 0) {
    const others = COLORS.filter((c) => c !== e.shield);
    e.shield = others[(Math.random() * 3) | 0];
    e.shieldT = phase2 ? 4 : 6;
    g.hint = { col: e.shield, t: 1.5 };
    sfx.swap();
  }
  if (e.shoot <= 0) {
    e.volley++;
    if (phase2 && e.volley % 2 === 0) {
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10 + e.t;
        spawnBullet(g, { owner: 'e', x: e.x, y: e.y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: 3, r: 2 });
      }
    } else {
      for (const off of [-0.2, 0, 0.2]) shootAt(g, e, spread * 0.5, 85, off);
    }
    sfx.enemyShot();
    e.shoot = phase2 ? 1.0 : 1.3;
  }
  if (phase2) {
    e.summon -= dt;
    if (e.summon <= 0) {
      e.summon = 9;
      g.queueSpawn('drac'); g.queueSpawn('drac');
    }
  }
}

export function drawEnemyShadow(ctx, e) {
  if (e.type === 'drone') fillEllipse(ctx, e.x, e.y + 11, 3, 1, C.shadow);
  else if (e.type === 'boss') fillEllipse(ctx, e.x, e.y + 7, 7, 1, C.shadow);
  else fillEllipse(ctx, e.x, e.y + (e.type === 'bike' ? 5 : 7), e.type === 'bike' ? 7 : 5, 1, C.shadow);
}

// Telegraph-Linien und Drohnen-Laser liegen unter den Figuren
export function drawEnemyLines(ctx, g) {
  for (const e of g.enemies) {
    if (e.type === 'bike' && e.state === 'aim' && Math.floor(e.t * 12) % 2) {
      const ddx = e.tx - e.x, ddy = e.ty - e.y, dl = Math.hypot(ddx, ddy) || 1;
      line(ctx, e.x, e.y, e.x + (ddx / dl) * 240, e.y + (ddy / dl) * 240, C.pink, 3);
    }
    if (e.type === 'drone' && Math.floor(e.t * 3) % 2) line(ctx, e.x, e.y, g.p.x, g.p.y, C.r, 2);
  }
}

export function drawEnemy(ctx, g, e) {
  const fl = e.flash > 0;
  if (e.type === 'drac' || e.type === 'shield') {
    const idx = [1, 0, 2, 0][Math.floor(e.anim * 8) % 4];
    const x = Math.round(e.x - 5), y = Math.round(e.y - 8);
    ctx.drawImage(fl ? S.dracFlash : S.drac[idx][e.face > 0 ? 'r' : 'l'], x, y);
    ctx.fillStyle = C.black;
    ctx.fillRect(e.face > 0 ? x + 9 : x - 3, y + 8, 4, 2);
  } else if (e.type === 'boss') {
    const x = Math.round(e.x - 7), y = Math.round(e.y - 10);
    ctx.drawImage(fl ? S.bossFlash : S.boss[e.face > 0 ? 'r' : 'l'], x, y);
  } else if (e.type === 'bike') {
    ctx.drawImage(fl ? S.bikeFlash : S.bike[e.face > 0 ? 'r' : 'l'], Math.round(e.x - 8), Math.round(e.y - 6));
  } else if (e.type === 'drone') {
    const bob = Math.round(Math.sin(e.t * 5) * 1.5);
    ctx.drawImage(fl ? S.droneFlash : S.drone, Math.round(e.x - 5), Math.round(e.y - 3 + bob));
  }
  if (e.shield) {
    const col = COLOR_OF[e.shield];
    const rad = e.type === 'boss' ? 13 : 9;
    const warn = e.type === 'boss' && e.shieldT < 0.6 && Math.floor(e.t * 16) % 2;
    if (!warn) {
      const step = e.shieldFlash > 0 ? 0.12 : 0.35;
      ring(ctx, e.x, e.y, rad, col, step, e.t * 2);
      ring(ctx, e.x, e.y, rad - 1, col, step, e.t * 2 + 0.17);
    }
  }
}
