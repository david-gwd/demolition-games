// Arena vor dem Diner: einmal vorgerendert, plus Kollisionsrechtecke
import { C } from '../shared/palette.js';
import { makeCanvas, rect, ditherRect, fillEllipse, line, rng } from '../shared/draw.js';
import { drawText, textWidth } from '../shared/pixelfont.js';
import { bake, SPIDER } from '../shared/sprites.js';

export const W = 320, H = 180;
export const FIELD = { x0: 4, y0: 13, x1: 316, y1: 167 };

const CACTI = [[18, 140, 22], [296, 118, 26], [276, 160, 16], [40, 104, 14]];
const ROCKS = [[110, 158], [230, 140], [300, 70], [12, 88]];

export const OBSTACLES = [
  { x: 80, y: 12, w: 161, h: 47 },  // Diner
  { x: 20, y: 60, w: 33, h: 17 },   // geparktes Auto
  ...CACTI.map(([x, y, h]) => ({ x: x - 1, y: y - h, w: 6, h: h + 1 })),
];

export function blocked(x, y, r) {
  if (x - r < FIELD.x0 || x + r > FIELD.x1 || y - r < FIELD.y0 || y + r > FIELD.y1) return true;
  return OBSTACLES.some((o) => x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h);
}

export function inObstacle(x, y) {
  return OBSTACLES.find((o) => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h);
}

// Achsenweise bewegen, damit man an Wänden entlanggleitet. Gibt true zurück, wenn etwas blockiert hat.
export function moveCircle(e, dx, dy, fly = false) {
  const test = fly
    ? (x, y, r) => x - r < FIELD.x0 || x + r > FIELD.x1 || y - r < FIELD.y0 || y + r > FIELD.y1
    : blocked;
  let hit = false;
  if (!test(e.x + dx, e.y, e.r)) e.x += dx; else hit = true;
  if (!test(e.x, e.y + dy, e.r)) e.y += dy; else hit = true;
  return hit;
}

function cactus(ctx, x, y, h) {
  rect(ctx, x, y - h, x + 3, y, C.cactus, C.ink);
  rect(ctx, x - 5, y - h + 6, x - 2, y - h + 12, C.cactus, C.ink);
  rect(ctx, x - 5, y - h + 11, x, y - h + 14, C.cactus, C.ink);
  rect(ctx, x + 5, y - h + 3, x + 8, y - h + 9, C.cactus, C.ink);
  rect(ctx, x + 3, y - h + 8, x + 8, y - h + 11, C.cactus, C.ink);
  line(ctx, x + 1, y - h + 2, x + 1, y - 1, C.cactusd);
}

export function buildArena() {
  const [c, ctx] = makeCanvas(W, H);
  const rand = rng(3);
  rect(ctx, 0, 0, W - 1, H - 1, C.sand);
  const specks = [C.ochre, C.ochre, C.paper, C.rust];
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = specks[(rand() * 4) | 0];
    ctx.fillRect((rand() * W) | 0, 12 + ((rand() * (H - 12)) | 0), 1, 1);
  }
  // Parkplatz
  ditherRect(ctx, 60, 58, 260, 82, C.asphalt, C.asphaltl, 0.25);
  for (let x = 72; x < 250; x += 22) line(ctx, x, 60, x, 70, C.paper);
  // Diner
  rect(ctx, 80, 22, 240, 58, C.mint, C.ink);
  rect(ctx, 80, 22, 240, 27, C.paper, C.ink);
  for (let x = 92; x < 230; x += 22) {
    if (x > 140 && x < 170) continue;
    rect(ctx, x, 34, x + 14, 46, C.skyf, C.ink);
    line(ctx, x + 2, 36, x + 5, 36, C.skyl);
  }
  rect(ctx, 152, 36, 168, 58, C.rustd, C.ink);
  rect(ctx, 80, 48, 151, 50, C.pink);
  rect(ctx, 169, 48, 240, 50, C.pink);
  rect(ctx, 128, 13, 192, 22, C.ink);
  drawText(ctx, 160 - textWidth('DINER') / 2, 15, 'DINER', C.pink);
  // Auto mit Spinne
  rect(ctx, 20, 60, 52, 76, C.white, C.ink);
  rect(ctx, 30, 62, 40, 74, C.skyf, C.ink);
  rect(ctx, 21, 67, 51, 68, C.r);
  ctx.drawImage(bake(SPIDER, { k: C.ink }), 43, 66);
  // Kakteen, Steine
  for (const [x, y, h] of CACTI) cactus(ctx, x, y, h);
  for (const [x, y] of ROCKS) {
    fillEllipse(ctx, x + 4, y + 2, 5, 3, C.ink);
    fillEllipse(ctx, x + 4, y + 2, 4, 2, C.rust);
  }
  return c;
}

// Lauflicht unter dem Diner-Schild
export function drawSignLights(ctx, t) {
  const phase = Math.floor(t * 6) % 3;
  for (let i = 0, x = 131; x < 190; x += 4, i++) {
    ctx.fillStyle = i % 3 === phase ? C.paper : C.y;
    ctx.fillRect(x, 21, 1, 1);
  }
}
