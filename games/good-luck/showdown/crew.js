// Die vier Killjoys: je Farbe eine Figur und eine Waffe
import { C } from '../shared/palette.js';
import { KJ_BODY, KJ_LEGS, kjMap, walkFrames, silhouette } from '../shared/sprites.js';
import { sfx } from '../shared/audio.js';
import { spawnBullet } from './bullets.js';

export const CREW = [
  { key: 'y', name: 'NEON HAZARD', weapon: 'SPREAD', color: C.y, dark: C.yd, hair: C.r, mask: C.pink, rate: 0.26 },
  { key: 'g', name: 'SUGAR STATIC', weapon: 'BOUNCE', color: C.g, dark: C.cactusd, hair: C.ink, mask: C.y, rate: 0.2 },
  { key: 'b', name: 'ROCKET RATTLER', weapon: 'PIERCE', color: C.b, dark: C.bd, hair: C.mustard, mask: C.ink, rate: 0.42 },
  { key: 'r', name: 'VELVET VENOM', weapon: 'CHARGE', color: C.r, dark: C.rustd, hair: C.pink, mask: C.b, rate: 0.15 },
];

export const COLOR_OF = { y: C.y, g: C.g, b: C.b, r: C.r };
export const COLOR_NAME = { y: 'YELLOW', g: 'GREEN', b: 'BLUE', r: 'RED' };
export const KEY_OF = { y: 1, g: 2, b: 3, r: 4 };

export let GLITCH = null;

export function bakeCrew() {
  for (const c of CREW) c.frames = walkFrames(KJ_BODY, KJ_LEGS, kjMap(c.hair, c.color, c.dark, c.mask, c.color));
  const rows = [...KJ_BODY, ...KJ_LEGS[0]];
  GLITCH = { pink: silhouette(rows, C.pink), blue: silhouette(rows, C.b) };
}

export function fire(g, p, c, charge = 0) {
  const a = p.aim;
  const mx = p.x + Math.cos(a) * 8, my = p.y + 1 + Math.sin(a) * 8;
  const shot = (ang, o) => spawnBullet(g, {
    x: mx, y: my, vx: Math.cos(ang) * o.speed, vy: Math.sin(ang) * o.speed, col: c.key, ...o,
  });
  switch (c.key) {
    case 'y':
      for (const k of [-1, 0, 1]) shot(a + k * 0.22, { speed: 230, life: 0.34, dmg: 1 });
      sfx.zap(1.1);
      break;
    case 'g':
      shot(a + (Math.random() - 0.5) * 0.08, { speed: 190, life: 1.3, dmg: 1, bounces: 2 });
      sfx.zap(1.45);
      break;
    case 'b':
      shot(a, { speed: 300, life: 0.9, dmg: 2, pierce: true, len: 6 });
      sfx.zap(0.7);
      break;
    case 'r':
      shot(a, { speed: 170, life: 1.2, dmg: 1 + Math.round(5 * charge), r: 1.5 + 3 * charge, pierce: charge >= 1, big: true });
      sfx.heavy(charge);
      if (charge >= 1) g.shake.add(2, 0.12);
      break;
  }
  g.parts.burst(mx, my, 3, c.color, 40, 0.15);
}
