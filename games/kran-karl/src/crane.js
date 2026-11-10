import { GANTRY_Y, TROLLEY_MIN, TROLLEY_MAX, BOX_W, BOX_H, GRAVITY, clamp } from './config.js';
import { drawLoad } from './container.js';

const ACCEL = 700;
const MAX_SPEED = 240;
const BRAKE = 600;
const ROPE_SPEED = 130;
const ROPE_MIN = 40;
const ROPE_MAX = 330;
const DAMPING = 0.2;
const TOP = GANTRY_Y + 10; // Aufhängepunkt des Seils
export const DEFAULT_PAINT = { beam: '#e8672f', leg: '#d9542b', line: '#a83c1c', trolley: '#f2b134' };

export class Crane {
  constructor() { this.reset(); }

  // mods: Werkstatt-Upgrades (Dämpfung, Tempo, Seilbremse); look: Kosmetik
  reset(mods = {}, look = null) {
    this.damping = mods.damping ?? DAMPING;
    this.speedMul = mods.speed ?? 1;
    this.ropeBrake = mods.ropeBrake ?? 0;
    this.look = look || { paint: DEFAULT_PAINT, hat: 'none' };
    this.x = 300;
    this.v = 0;
    this.len = 120;
    this.theta = 0;
    this.omega = 0;
    this.cargo = null;
    this.extra = null; // oberer Container beim Doppelgriff
    this.double = false; // Doppelgriff eingeschaltet
  }

  get hookX() { return this.x + Math.sin(this.theta) * this.len; }
  get hookY() { return TOP + Math.cos(this.theta) * this.len; }
  get loadH() { return this.extra ? BOX_H * 2 : BOX_H; }
  get weight() { return (this.cargo?.weight || 0) + (this.extra?.weight || 0); }

  hookVelocity() {
    return {
      vx: this.v + Math.cos(this.theta) * this.omega * this.len,
      vy: -Math.sin(this.theta) * this.omega * this.len,
    };
  }

  // Mittelpunkt der hängenden Ladung (bei Doppel: Mitte beider Container)
  cargoCenter() {
    const off = this.loadH / 2 + 4;
    return {
      x: this.hookX + Math.sin(this.theta) * off,
      y: this.hookY + Math.cos(this.theta) * off,
    };
  }

  // Gibt true zurück, wenn die Laufkatze mit Schwung an den Anschlag knallt
  update(dt, input, wind, floorAt) {
    const weight = this.weight;
    const accel = ACCEL / (1 + 0.3 * weight);
    const maxSpeed = MAX_SPEED * this.speedMul / (1 + 0.12 * weight);

    const oldV = this.v;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) {
      this.v += dir * accel * dt;
    } else {
      const b = BRAKE * dt;
      this.v = Math.abs(this.v) <= b ? 0 : this.v - Math.sign(this.v) * b;
    }
    this.v = clamp(this.v, -maxSpeed, maxSpeed);
    this.x += this.v * dt;

    let clang = false;
    if (this.x < TROLLEY_MIN || this.x > TROLLEY_MAX) {
      clang = Math.abs(this.v) > 80;
      this.x = clamp(this.x, TROLLEY_MIN, TROLLEY_MAX);
      this.v = 0;
    }
    const a = (this.v - oldV) / dt;

    // Seil: beim Einholen/Ausfahren bleibt der Drehimpuls grob erhalten – die Seilbremse schluckt einen Teil
    const rope = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const oldLen = this.len;
    if (rope) this.len += rope * ROPE_SPEED * dt;
    const reach = this.cargo ? this.loadH + 6 : 3;
    const floor = floorAt(this.hookX, this.cargo ? BOX_W / 2 : 6);
    const maxLen = (floor - reach - TOP) / Math.max(0.3, Math.cos(this.theta));
    this.len = clamp(this.len, ROPE_MIN, Math.max(ROPE_MIN, Math.min(ROPE_MAX, maxLen)));
    if (rope && this.len !== oldLen) this.omega *= (oldLen / this.len) ** (1 - 0.4 * this.ropeBrake);

    // Pendel mit beschleunigtem Aufhängepunkt; leichte Fracht nimmt der Wind stärker mit
    const L = this.len;
    const windAcc = wind * (this.cargo ? 1.6 / (0.6 + weight) : 0.5);
    const alpha = (-GRAVITY * Math.sin(this.theta) - a * Math.cos(this.theta) + windAcc * Math.cos(this.theta)) / L
      - this.damping * this.omega;
    this.omega += alpha * dt;
    this.theta += this.omega * dt;
    if (Math.abs(this.theta) > 1.25) {
      this.theta = Math.sign(this.theta) * 1.25;
      this.omega *= -0.3;
    }
    return clang;
  }

  draw(ctx) {
    const hx = this.hookX, hy = this.hookY;

    ctx.strokeStyle = '#1d1d1d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x - 3, TOP);
    ctx.lineTo(hx - 3, hy);
    ctx.moveTo(this.x + 3, TOP);
    ctx.lineTo(hx + 3, hy);
    ctx.stroke();

    drawTrolley(ctx, this.x, GANTRY_Y, this.look);

    // Haken bzw. Spreader
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(-this.theta);
    ctx.fillStyle = '#2b2b2b';
    if (this.cargo) {
      ctx.fillRect(-BOX_W / 2 + 2, -2, BOX_W - 4, 5);
    } else {
      ctx.fillRect(-9, -4, 18, 7);
      ctx.strokeStyle = this.double ? '#ffd23f' : '#2b2b2b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.lineTo(0, 9);
      ctx.arc(-4, 9, 4, 0, Math.PI);
      ctx.stroke();
      if (this.double) {
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(-9, -4, 18, 2);
      }
    }
    ctx.restore();

    if (this.cargo) {
      const c = this.cargoCenter();
      drawLoad(ctx, this.cargo, this.extra, c.x, c.y, -this.theta);
    }
  }
}

// Laufkatze mit Kabine und Karl darin (auch für die Vorschau in der Werkstatt)
export function drawTrolley(ctx, x, y, look) {
  const paint = look.paint || DEFAULT_PAINT;
  ctx.fillStyle = paint.trolley;
  ctx.fillRect(x - 22, y - 14, 44, 22);
  ctx.fillStyle = '#9fd8f5';
  ctx.fillRect(x - 16, y - 10, 14, 10);
  // Karl
  ctx.fillStyle = '#f2c48d';
  ctx.beginPath();
  ctx.arc(x - 9, y - 3, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff7a1a';
  ctx.fillRect(x - 12, y - 1, 6, 1);
  drawHat(ctx, look.hat, x - 9, y - 6, 1);
  ctx.fillStyle = '#7a5a12';
  ctx.fillRect(x + 4, y - 9, 12, 4);
  ctx.fillStyle = '#333';
  for (const dx of [-14, 14]) {
    ctx.beginPath();
    ctx.arc(x + dx, y - 14, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Hut auf einem Kopf, dessen Oberkante bei (x, y) liegt; s = Maßstab
export function drawHat(ctx, hat, x, y, s = 1) {
  if (!hat || hat === 'none') return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (hat === 'captain') {
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(-4.5, -3.5, 9, 3.5);
    ctx.fillStyle = '#1d2a44';
    ctx.fillRect(-5.5, -0.5, 11, 1.8);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-1, -2.6, 2, 1.6);
  } else if (hat === 'beanie') {
    ctx.fillStyle = '#d9472b';
    ctx.beginPath();
    ctx.arc(0, 0.5, 4.2, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-4.4, -0.2, 8.8, 1.8);
    ctx.beginPath();
    ctx.arc(0, -4.4, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (hat === 'straw') {
    ctx.fillStyle = '#e6c46a';
    ctx.fillRect(-7, -0.6, 14, 1.8);
    ctx.fillRect(-3.6, -3.8, 7.2, 3.4);
    ctx.fillStyle = '#c0261b';
    ctx.fillRect(-3.6, -1.6, 7.2, 1);
  } else if (hat === 'antenna') {
    ctx.fillStyle = '#ffd21f';
    ctx.beginPath();
    ctx.arc(0, 0.8, 4.6, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -3.6);
    ctx.lineTo(1.5, -8);
    ctx.stroke();
    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.arc(1.5, -8.4, 1.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (hat === 'crown') {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(-4.5, 1);
    ctx.lineTo(-4.5, -4);
    ctx.lineTo(-2.2, -1.6);
    ctx.lineTo(0, -5);
    ctx.lineTo(2.2, -1.6);
    ctx.lineTo(4.5, -4);
    ctx.lineTo(4.5, 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d9472b';
    ctx.fillRect(-0.8, -1, 1.6, 1.6);
  }
  ctx.restore();
}
