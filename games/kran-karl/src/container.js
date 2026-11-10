import { BOX_W, BOX_H } from './config.js';
import { THAWED_COLOR } from './content.js';

// Ein freier Container (oder ein Doppel vom Spreader): fällt, kippt, versinkt oder treibt auf einer Scholle
export class Box {
  constructor(cargo, x, y, extra = null) {
    this.cargo = cargo;
    this.extra = extra; // oberer Container beim Doppelgriff
    this.h = extra ? BOX_H * 2 : BOX_H;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.spin = 0;
    this.state = 'falling'; // falling | tipping | sinking | floating
    this.t = 0;
    this.hitGulls = new Set();
    this.hitPub = false;
    this.ignoreCol = -1;
    this.ignoreT = 0;
    this.dead = false;
  }

  get cargos() { return this.extra ? [this.cargo, this.extra] : [this.cargo]; }
}

// Einzelner Container oder Doppel um den gemeinsamen Mittelpunkt (x, y)
export function drawLoad(ctx, cargo, extra, x, y, angle = 0) {
  if (!extra) {
    drawBox(ctx, cargo, x, y, angle);
    return;
  }
  const dx = -Math.sin(angle) * BOX_H / 2, dy = Math.cos(angle) * BOX_H / 2;
  drawBox(ctx, cargo, x + dx, y + dy, angle);
  drawBox(ctx, extra, x - dx, y - dy, angle);
}

export function drawBox(ctx, cargo, x, y, angle = 0) {
  const w = BOX_W, h = BOX_H;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = cargo.thawed ? THAWED_COLOR : cargo.color;
  ctx.fillRect(-w / 2, -h / 2, w, h);

  // Wellblech
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = -w / 2 + 5; i < w / 2 - 10; i += 5) {
    ctx.moveTo(i, -h / 2 + 3);
    ctx.lineTo(i, h / 2 - 3);
  }
  ctx.stroke();

  // Türgriffe
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(w / 2 - 9, -h / 2 + 4, 2, h - 8);
  ctx.fillRect(w / 2 - 5, -h / 2 + 4, 2, h - 8);

  // Gewichtspunkte
  ctx.fillStyle = cargo.reefer && !cargo.thawed ? 'rgba(30,60,90,0.8)' : 'rgba(255,255,255,0.9)';
  for (let i = 0; i < cargo.weight; i++) ctx.fillRect(-w / 2 + 5 + i * 6, -h / 2 + 4, 4, 4);

  drawMarks(ctx, cargo, w, h);

  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
  ctx.restore();
}

// Kleine Symbole: Glas (zerbrechlich), Luftlöcher (lebend), Schneeflocke (Kühlung), Glanz (selten)
function drawMarks(ctx, cargo, w, h) {
  const mx = 4, my = 3;
  if (cargo.fragile) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx - 4, my - 5);
    ctx.lineTo(mx - 3, my);
    ctx.quadraticCurveTo(mx, my + 3, mx + 3, my);
    ctx.lineTo(mx + 4, my - 5);
    ctx.moveTo(mx, my + 2);
    ctx.lineTo(mx, my + 7);
    ctx.moveTo(mx - 3, my + 7);
    ctx.lineTo(mx + 3, my + 7);
    ctx.stroke();
  }
  if (cargo.broken) {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-12, -h / 2 + 2);
    ctx.lineTo(-6, -2);
    ctx.lineTo(-10, 4);
    ctx.lineTo(-4, h / 2 - 2);
    ctx.stroke();
  }
  if (cargo.alive) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-8 + i * 7, h / 2 - 6, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (cargo.reefer && !cargo.thawed) {
    ctx.strokeStyle = '#2b7bd9';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.moveTo(mx + Math.cos(a) * 6, my + Math.sin(a) * 6);
      ctx.lineTo(mx - Math.cos(a) * 6, my - Math.sin(a) * 6);
    }
    ctx.stroke();
  }
  if (cargo.thawed) {
    ctx.fillStyle = 'rgba(70, 45, 25, 0.8)';
    for (const dx of [-14, 2, 14]) {
      ctx.beginPath();
      ctx.ellipse(dx, h / 2 + 1, 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (cargo.rare) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 14, -h / 2 + 2);
    ctx.lineTo(-w / 2 + 22, -h / 2 + 2);
    ctx.lineTo(-w / 2 + 8, h / 2 - 2);
    ctx.lineTo(-w / 2 + 3, h / 2 - 2);
    ctx.fill();
  }
  if (cargo.empty) {
    ctx.fillStyle = '#ffd400';
    ctx.beginPath();
    ctx.ellipse(mx, my, 6, 2.5, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}
