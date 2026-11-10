import { C } from './palette.js';
import { fillPoly, makeCanvas } from './draw.js';
import { drawText, textWidth } from './pixelfont.js';

export class Particles {
  constructor() { this.list = []; }
  spawn(x, y, vx, vy, life, col, size = 1) {
    this.list.push({ x, y, vx, vy, life, col, size });
  }
  burst(x, y, n, col, speed = 60, life = 0.4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.5 + Math.random() * 0.5), col, Math.random() < 0.3 ? 2 : 1);
    }
  }
  update(dt) {
    for (const p of this.list) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }
  draw(ctx) {
    for (const p of this.list) {
      ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }
}

// Comic-Explosion mit Text (ZAP!, BOOM …), einmal gebacken und gecacht
const burstCache = new Map();
export function bakeBurst(label, fill, inner, sc = 2) {
  const key = [label, fill, inner, sc].join('|');
  if (burstCache.has(key)) return burstCache.get(key);
  const tw = textWidth(label, sc);
  const r2 = Math.max(13, tw * 0.62), r1 = r2 * 0.55, n = 8;
  const w = Math.ceil(r2 * 2.5 + 4), h = Math.ceil(r2 * 2 + 4);
  const [c, ctx] = makeCanvas(w, h);
  const cx = w / 2, cy = h / 2;
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2, rr = i % 2 === 0 ? r2 : r1;
    pts.push([cx + rr * Math.cos(a) * 1.25, cy + rr * Math.sin(a)]);
  }
  const scale = (f) => pts.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f]);
  fillPoly(ctx, pts, C.ink);
  fillPoly(ctx, scale(0.82), fill);
  fillPoly(ctx, scale(0.5), inner);
  drawText(ctx, cx - tw / 2, cy - (5 * sc) / 2, label, C.paper, sc, C.ink);
  burstCache.set(key, c);
  return c;
}

export class Bursts {
  constructor() { this.list = []; }
  add(x, y, label, fill = C.y, inner = C.pink, sc = 2, life = 0.45) {
    this.list.push({ x, y, img: bakeBurst(label, fill, inner, sc), t: 0, life });
  }
  update(dt) {
    for (const b of this.list) b.t += dt;
    this.list = this.list.filter((b) => b.t < b.life);
  }
  draw(ctx) {
    for (const b of this.list) {
      const s = b.t < 0.05 ? 0.6 : 1;
      const w = Math.round(b.img.width * s), h = Math.round(b.img.height * s);
      ctx.drawImage(b.img, Math.round(b.x - w / 2), Math.round(b.y - h / 2), w, h);
    }
  }
}

// Aufsteigende kleine Texte (+10, +1 HP …)
export class Floaters {
  constructor() { this.list = []; }
  add(x, y, text, col = C.paper) { this.list.push({ x, y, text, col, t: 0 }); }
  update(dt) {
    for (const f of this.list) f.t += dt;
    this.list = this.list.filter((f) => f.t < 0.8);
  }
  draw(ctx) {
    for (const f of this.list) {
      drawText(ctx, f.x - textWidth(f.text) / 2, f.y - f.t * 16, f.text, f.col, 1, C.ink);
    }
  }
}

export class Shake {
  constructor() { this.t = 0; this.amt = 0; }
  add(amt, t) { this.amt = Math.max(this.amt, amt); this.t = Math.max(this.t, t); }
  update(dt) { this.t -= dt; if (this.t <= 0) { this.t = 0; this.amt = 0; } }
  offset() {
    if (this.t <= 0) return [0, 0];
    return [Math.round((Math.random() * 2 - 1) * this.amt), Math.round((Math.random() * 2 - 1) * this.amt)];
  }
}

// Filmkorn + Vignette (Polaroid-Look), 4 Frames zum Durchwechseln
export function makeOverlay(W, H) {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const [c, ctx] = makeCanvas(W, H);
    const id = ctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      if (Math.random() < 0.1) {
        const v = Math.random() < 0.5 ? 0 : 255;
        id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v;
        id.data[i * 4 + 3] = 16;
      }
    }
    ctx.putImageData(id, 0, 0);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
    g.addColorStop(0, 'rgba(27,25,24,0)');
    g.addColorStop(1, 'rgba(27,25,24,0.38)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    frames.push(c);
  }
  return frames;
}
