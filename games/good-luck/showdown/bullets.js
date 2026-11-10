import { C } from '../shared/palette.js';
import { fillEllipse } from '../shared/draw.js';
import { sfx } from '../shared/audio.js';
import { FIELD, inObstacle } from './arena.js';
import { damageEnemy } from './enemies.js';
import { hurtPlayer } from './player.js';

const COLOR = { y: C.y, g: C.g, b: C.b, r: C.r };

export function spawnBullet(g, o) {
  g.bullets.push({
    x: 0, y: 0, vx: 0, vy: 0, life: 1, dmg: 1, col: 'y', r: 1.5, len: 3,
    bounces: 0, pierce: false, owner: 'p', hit: null, ...o,
  });
}

export function updateBullets(g, dt) {
  for (const b of g.bullets) {
    const px = b.x, py = b.y;
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;

    let wall = false, flipX = false, flipY = false;
    if (b.x < FIELD.x0 || b.x > FIELD.x1) { wall = true; flipX = true; }
    if (b.y < FIELD.y0 || b.y > FIELD.y1) { wall = true; flipY = true; }
    const o = !wall && inObstacle(b.x, b.y);
    if (o) {
      wall = true;
      if (px >= o.x && px <= o.x + o.w) flipY = true; else flipX = true;
    }
    if (wall) {
      if (b.bounces > 0) {
        b.bounces--; b.x = px; b.y = py;
        if (flipX) b.vx *= -1;
        if (flipY) b.vy *= -1;
        b.hit = null;
        sfx.bounce();
        g.parts.burst(b.x, b.y, 3, C.lime, 30, 0.2);
      } else {
        b.life = 0;
        g.parts.burst(px, py, 3, b.owner === 'p' ? COLOR[b.col] : C.paper, 30, 0.2);
      }
      continue;
    }

    if (b.owner === 'p') {
      for (const e of g.enemies) {
        if (e.hp <= 0 || (b.hit && b.hit.has(e))) continue;
        const dx = e.x - b.x, dy = e.y - b.y, rr = e.r + b.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        const res = damageEnemy(g, e, b);
        if (res === 'blocked' || !b.pierce) { b.life = 0; break; }
        (b.hit ||= new Set()).add(e);
      }
    } else {
      const p = g.p, dx = p.x - b.x, dy = p.y - b.y, rr = p.r + b.r;
      if (dx * dx + dy * dy <= rr * rr && hurtPlayer(g)) b.life = 0;
    }
  }
  g.bullets = g.bullets.filter((b) => b.life > 0);
}

export function drawBullets(ctx, g) {
  for (const b of g.bullets) {
    if (b.owner === 'e') {
      ctx.fillStyle = C.ink; ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4);
      ctx.fillStyle = C.white; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2);
      continue;
    }
    const col = COLOR[b.col];
    if (b.big) {
      const r = Math.round(b.r);
      fillEllipse(ctx, b.x, b.y, r + 1, r + 1, C.ink);
      fillEllipse(ctx, b.x, b.y, r, r, col);
      if (r >= 3) fillEllipse(ctx, b.x - 1, b.y - 1, 1, 1, C.paper);
      continue;
    }
    const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
    for (let i = 0; i < b.len; i++) {
      ctx.fillStyle = i === 0 ? C.paper : col;
      ctx.fillRect(Math.round(b.x - ux * i), Math.round(b.y - uy * i), 2, 2);
    }
  }
}
