import { C, mix } from '../shared/palette.js';
import { rect, fillEllipse, ring, line } from '../shared/draw.js';
import { drawText, drawTextCentered, textWidth } from '../shared/pixelfont.js';
import { bake, HEART } from '../shared/sprites.js';
import { isMuted } from '../shared/audio.js';
import { W, H } from './arena.js';
import { CREW, COLOR_OF, COLOR_NAME, KEY_OF } from './crew.js';
import { comboMult } from './enemies.js';

let HEART_FULL = null, HEART_EMPTY = null;
export function bakeHUD() {
  HEART_FULL = bake(HEART, { k: C.ink, p: C.pink });
  HEART_EMPTY = bake(HEART, { k: C.dgrey, p: C.ink });
}

const pad = (n, l) => String(n).padStart(l, '0');

function badge(ctx, cx, cy, c, i, active) {
  if (active) {
    fillEllipse(ctx, cx, cy, 7, 7, C.paper);
    fillEllipse(ctx, cx, cy, 6, 6, c.color);
    drawText(ctx, cx - 1, cy - 2, i + 1, C.ink);
  } else {
    fillEllipse(ctx, cx, cy, 4, 4, mix(c.key, 'ink', 0.55));
    drawText(ctx, cx - 1, cy - 2, i + 1, C.dgrey);
  }
}

function shieldHint(g) {
  const active = CREW[g.p.active].key;
  if (g.hint && g.hint.t > 0 && g.hint.col !== active) return g.hint.col;
  let best = null, bd = Infinity;
  for (const e of g.enemies) {
    if (!e.shield || e.shield === active) continue;
    const d = Math.hypot(e.x - g.p.x, e.y - g.p.y);
    if (d < bd) { bd = d; best = e.shield; }
  }
  return best;
}

export function drawCrosshair(ctx, g) {
  const { x, y } = g.input.mouse;
  ring(ctx, x, y, 4, C.ink, 0.3);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) line(ctx, x + dx * 3, y + dy * 3, x + dx * 6, y + dy * 6, C.ink);
  ctx.fillStyle = CREW[g.p.active].color;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

export function drawHUD(ctx, g) {
  const p = g.p;

  // Leiste oben
  rect(ctx, 0, 0, W - 1, 10, C.ink);
  CREW.forEach((c, i) => { if (i !== p.active) badge(ctx, 9 + i * 15, 5, c, i, false); });
  badge(ctx, 9 + p.active * 15, 5, CREW[p.active], p.active, true);
  for (let i = 0; i < Math.max(3, p.hp); i++) ctx.drawImage(i < p.hp ? HEART_FULL : HEART_EMPTY, 70 + i * 9, 3);
  if (isMuted()) drawText(ctx, 120, 4, 'MUTE', C.dgrey);
  drawTextCentered(ctx, W / 2, 4, `WAVE ${pad(g.wave, 2)}`, C.paper);
  const carb = `CARBONS ${pad(g.score, 5)}`;
  drawText(ctx, W - textWidth(carb) - 4, 4, carb, C.mustard);

  // Radio-Ticker
  let below = 14;
  if (g.radioT > 0) {
    rect(ctx, 0, 11, W - 1, 20, C.ink);
    ctx.save();
    ctx.beginPath(); ctx.rect(48, 11, W - 48, 10); ctx.clip();
    const x = W - (g.radioMax - g.radioT) * 40;
    drawText(ctx, x, 14, `>> ${g.radio}`, C.mustard);
    ctx.restore();
    rect(ctx, 0, 11, 45, 20, C.r);
    drawText(ctx, 3, 14, 'WKIL 109', C.paper);
    below = 24;
  }
  const mult = comboMult(g);
  if (mult > 1) {
    const s = `COMBO X${mult}`;
    drawText(ctx, W - textWidth(s) - 5, below, s, C.mustard, 1, C.ink);
  }

  // Leiste unten links: aktiver Killjoy + Waffe
  const c = CREW[p.active];
  const label = `${c.name} - ${c.weapon}`;
  const lw = textWidth(label) + 8;
  rect(ctx, 0, H - 11, lw, H - 1, C.ink);
  for (let i = 0; i < 8; i++) rect(ctx, lw + 1, H - 11 + i + 3, lw + 1 + Math.floor(i * 0.9), H - 11 + i + 3, C.ink);
  drawText(ctx, 4, H - 8, c.name, c.color);
  drawText(ctx, 4 + textWidth(`${c.name} `) + 1, H - 8, `- ${c.weapon}`, C.paper);
  if (c.key === 'r' && p.charge > 0) {
    rect(ctx, 4, H - 14, 4 + 40, H - 12, C.ink);
    rect(ctx, 5, H - 13, 5 + Math.round(38 * p.charge), H - 13, p.charge >= 1 ? C.paper : C.r);
  }

  // Leiste unten rechts: Schild-Hinweis
  const col = shieldHint(g);
  if (col) {
    const a = `${COLOR_NAME[col]} SHIELD:`, b = ` PRESS ${KEY_OF[col]}`;
    const w = textWidth(a + b) + 8;
    rect(ctx, W - w, H - 11, W - 1, H - 1, C.ink);
    drawText(ctx, W - w + 4, H - 8, a, COLOR_OF[col]);
    drawText(ctx, W - w + 4 + textWidth(a), H - 8, b, C.paper);
  }

  // Boss-Leiste
  const boss = g.enemies.find((e) => e.type === 'boss');
  if (boss) {
    const x0 = 112, x1 = 208;
    rect(ctx, x0, H - 11, x1, H - 1, C.ink);
    drawText(ctx, x0 + 3, H - 8, 'AGENT', C.paper);
    const bx = x0 + 26, bw = x1 - 3 - bx;
    rect(ctx, bx, H - 8, x1 - 3, H - 4, C.dgrey);
    rect(ctx, bx, H - 8, bx + Math.max(0, Math.round(bw * boss.hp / boss.maxhp)), H - 4, COLOR_OF[boss.shield]);
  }

  // Wellen-Banner
  if (g.waveState === 'spawning' && g.waveT < 1.4) {
    const isBoss = g.wave % 5 === 0;
    drawTextCentered(ctx, W / 2, 66, isBoss ? 'AGENT INCOMING!' : `WAVE ${pad(g.wave, 2)}`, isBoss ? C.r : C.paper, 3, C.ink);
  } else if (g.waveState === 'clear' && g.wave > 0 && g.interT > 1.2) {
    drawTextCentered(ctx, W / 2, 70, 'WAVE CLEAR', C.mustard, 2, C.ink);
  }
}
