// Power-Pup-Dosen: +1 Herz, bei vollem Leben Bonus-Carbons
import { C } from '../shared/palette.js';
import { bake, CAN, CAN_MAP } from '../shared/sprites.js';
import { fillEllipse } from '../shared/draw.js';
import { sfx } from '../shared/audio.js';
import { MAX_HP } from './player.js';

let CAN_IMG = null;
export function bakePickups() { CAN_IMG = bake(CAN, CAN_MAP); }

export function spawnPickup(g, x, y) {
  g.pickups.push({ x, y, life: 8, t: 0 });
}

export function updatePickups(g, dt) {
  const p = g.p;
  for (const k of g.pickups) {
    k.life -= dt; k.t += dt;
    if (Math.hypot(p.x - k.x, p.y - k.y) < 9) {
      k.life = 0;
      if (p.hp < MAX_HP) { p.hp++; g.floats.add(k.x, k.y - 8, '+1 HP', C.pink); }
      else { g.score += 50; g.floats.add(k.x, k.y - 8, '+50', C.mustard); }
      g.parts.burst(k.x, k.y, 10, C.y, 50, 0.4);
      sfx.pickup();
    }
  }
  g.pickups = g.pickups.filter((k) => k.life > 0);
}

export function drawPickups(ctx, g) {
  for (const k of g.pickups) {
    if (k.life < 2 && Math.floor(k.t * 10) % 2) continue;
    const bob = Math.round(Math.sin(k.t * 4) * 1.5);
    fillEllipse(ctx, k.x, k.y + 5, 3, 1, C.shadow);
    ctx.drawImage(CAN_IMG, Math.round(k.x - 3), Math.round(k.y - 5 + bob));
  }
}
