import { C } from '../shared/palette.js';
import { fillEllipse, ring } from '../shared/draw.js';
import { sfx } from '../shared/audio.js';
import { moveCircle } from './arena.js';
import { CREW, GLITCH, fire } from './crew.js';

export const MAX_HP = 5;
const SPEED = 78, DASH_SPEED = 230;
const SWITCH_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];

export function makePlayer() {
  return {
    x: 160, y: 118, r: 4, hp: 3, active: 0, cool: 0, swapCool: 0, glitch: 0,
    dash: 0, dashCool: 0, dvx: 0, dvy: 0, invuln: 0, charge: 0, anim: 0, moving: false, face: 1, aim: 0,
  };
}

export function updatePlayer(g, dt) {
  const p = g.p, inp = g.input;

  // Killjoy wechseln
  let want = SWITCH_KEYS.findIndex((k) => inp.hit(k));
  if (inp.hit('KeyQ')) want = (p.active + 3) % 4;
  if (inp.hit('KeyE')) want = (p.active + 1) % 4;
  if (inp.wheel) want = (p.active + inp.wheel + 4) % 4;
  if (want >= 0 && want !== p.active && p.swapCool <= 0) {
    p.active = want; p.swapCool = 0.2; p.glitch = 0.15; p.charge = 0; p.cool = Math.min(p.cool, 0.08);
    sfx.swap();
  }

  p.aim = Math.atan2(inp.mouse.y - (p.y + 1), inp.mouse.x - p.x);
  p.face = Math.cos(p.aim) < 0 ? -1 : 1;

  // Laufen + Dash
  let mx = (inp.down('KeyD') || inp.down('ArrowRight') ? 1 : 0) - (inp.down('KeyA') || inp.down('ArrowLeft') ? 1 : 0);
  let my = (inp.down('KeyS') || inp.down('ArrowDown') ? 1 : 0) - (inp.down('KeyW') || inp.down('ArrowUp') ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len) { mx /= len; my /= len; }

  if (inp.hit('Space') && p.dashCool <= 0) {
    const [dx, dy] = len ? [mx, my] : [Math.cos(p.aim), Math.sin(p.aim)];
    p.dash = 0.16; p.dashCool = 0.7; p.dvx = dx * DASH_SPEED; p.dvy = dy * DASH_SPEED;
    p.invuln = Math.max(p.invuln, 0.24);
    sfx.dash();
  }
  if (p.dash > 0) {
    p.dash -= dt;
    moveCircle(p, p.dvx * dt, p.dvy * dt);
    g.parts.spawn(p.x + (Math.random() - 0.5) * 6, p.y + 6, -p.dvx * 0.1, -2, 0.35, C.paper, 2);
  } else {
    moveCircle(p, mx * SPEED * dt, my * SPEED * dt);
  }
  p.moving = len > 0;
  if (p.moving) p.anim += dt;

  p.swapCool -= dt; p.glitch -= dt; p.dashCool -= dt; p.invuln -= dt; p.cool -= dt;

  // Schießen
  const c = CREW[p.active];
  if (c.key === 'r') {
    if (inp.mouse.down) p.charge = Math.min(1, p.charge + dt / 0.9);
    if (inp.mouse.released && p.cool <= 0) { fire(g, p, c, p.charge); p.cool = c.rate; }
    if (!inp.mouse.down) p.charge = 0;
  } else if (inp.mouse.down && p.cool <= 0) {
    fire(g, p, c);
    p.cool = c.rate;
  }
}

// Gibt true zurück, wenn der Treffer zählt (nicht während Unverwundbarkeit)
export function hurtPlayer(g) {
  const p = g.p;
  if (p.invuln > 0 || p.hp <= 0) return false;
  p.hp--; p.invuln = 1.1;
  g.combo = 0; g.comboT = 0;
  g.shake.add(3, 0.25);
  g.parts.burst(p.x, p.y, 14, C.pink, 70, 0.5);
  sfx.hurt();
  return true;
}

export function drawPlayerShadow(ctx, p) {
  fillEllipse(ctx, p.x, p.y + 7, 5, 1, C.shadow);
}

export function drawPlayer(ctx, g) {
  const p = g.p, c = CREW[p.active];
  if (p.invuln > 0 && p.dash <= 0 && Math.floor(g.time * 20) % 2) return;
  const idx = p.moving ? [1, 0, 2, 0][Math.floor(p.anim * 10) % 4] : 0;
  const spr = c.frames[idx][p.face > 0 ? 'r' : 'l'];
  const x = Math.round(p.x - 5), y = Math.round(p.y - 8);
  if (p.glitch > 0) {
    ctx.drawImage(GLITCH.pink, x - 2, y);
    ctx.drawImage(GLITCH.blue, x + 2, y);
  }
  ctx.drawImage(spr, x, y);

  // Waffe in Zielrichtung
  const ux = Math.cos(p.aim), uy = Math.sin(p.aim);
  const hx = p.x + p.face * 2, hy = p.y + 2;
  for (let i = 2; i <= 6; i++) {
    ctx.fillStyle = C.ink; ctx.fillRect(Math.round(hx + ux * i) - 1, Math.round(hy + uy * i) - 1, 3, 3);
  }
  for (let i = 2; i <= 6; i++) {
    ctx.fillStyle = c.color; ctx.fillRect(Math.round(hx + ux * i), Math.round(hy + uy * i), 1, 1);
  }

  if (p.charge > 0) {
    const full = p.charge >= 1;
    ring(ctx, p.x, p.y, 4 + p.charge * 7, full && Math.floor(g.time * 16) % 2 ? C.paper : C.r, 0.3, g.time * 4);
  }
}
