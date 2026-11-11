import { GANTRY_Y, GROUND_Y, SEA_Y, QUAY_X1, BOX_W, mulberry32 } from './config.js';
import { drawLoad } from './container.js';
import { label } from './ui.js';

// Feierabend-Weitwurf: die Laufkatze darf nur bis hierher, danach wird geworfen
export const TOSS_LINE = QUAY_X1 + 60;
const RING_R = 22;
const PARK_TIME = 1.2; // so lange bleibt ein Treffer auf dem Ponton-Lkw stehen

// Ziele im Hafenbecken: drei Rettungsringe, eine Boje ganz hinten und ein Ponton mit Lkw.
// Alles aus dem Seed gewürfelt, damit am selben Tag alle dieselben Ziele haben.
export class TossTargets {
  reset(seed) {
    const r = mulberry32(seed);
    const at = (a, b) => a + r() * (b - a);
    this.t = 0;
    this.rings = [[300, 370, 20], [600, 660, 30], [700, 760, 40]].map(([a, b, base]) => (
      { x0: at(a, b), x: 0, r: RING_R, base, phase: r() * 6 }
    ));
    this.buoy = { x: at(795, 825), r: 14, base: 60 };
    this.ponton = { x0: at(450, 530), x: 0, phase: r() * 6, base: 35, parked: null };
    this.update(0);
  }

  update(dt) {
    this.t += dt;
    for (const g of this.rings) g.x = g.x0 + Math.sin(this.t * 0.4 + g.phase) * 12;
    const p = this.ponton;
    p.x = p.x0 + Math.sin(this.t * 0.25 + p.phase) * 8;
    if (p.parked) {
      p.parked.t -= dt;
      if (p.parked.t <= 0) p.parked = null;
    }
  }

  // Mitte der Lkw-Ladefläche auf dem Ponton und ihre Oberkante
  bed(waveY) {
    const p = this.ponton;
    return { x: p.x - 13, y: waveY(p.x) - 20, half: 35 };
  }

  // Container taucht bei x ins Wasser: bestes getroffenes Ziel als { name, base, mult } oder null
  ringHit(x) {
    let best = null;
    for (const g of [...this.rings, this.buoy]) {
      const d = Math.abs(x - g.x);
      const mult = d < g.r * 0.35 ? 3 : d < g.r ? 2 : d < g.r + 20 ? 1 : 0;
      if (mult && (!best || g.base * mult > best.base * best.mult)) {
        best = { name: g === this.buoy ? 'Boje' : 'Ring', base: g.base, mult };
      }
    }
    return best;
  }

  // Landet der Container auf dem Ponton? Gibt { name, base, mult } zurück (mult 0: nur Deck) oder null
  landing(b, prevY, waveY) {
    const hh = b.h / 2;
    const bed = this.bed(waveY);
    const p = this.ponton;
    const onBed = Math.abs(b.x - bed.x) < bed.half;
    const top = onBed ? bed.y : waveY(p.x) - 6;
    if (!onBed && Math.abs(b.x - p.x) > 55 + BOX_W / 2 - 10) return null;
    if (b.y + hh < top || prevY + hh > top + 8) return null;
    p.parked = { cargo: b.cargo, extra: b.extra, dx: b.x - p.x, top: top - bed.y, h: b.h, t: PARK_TIME };
    if (!onBed) return { name: 'Ponton', base: 10, mult: 1, y: top };
    const off = Math.abs(b.x - bed.x);
    return { name: 'Lkw', base: p.base, mult: off < 10 ? 3 : off < 20 ? 2 : 1, y: top };
  }

  // Abwurflinie: Prellbock auf der Kranbrücke
  drawLine(ctx) {
    ctx.fillStyle = '#c0261b';
    ctx.fillRect(TOSS_LINE + 24, GANTRY_Y - 16, 8, 22);
    ctx.fillStyle = '#fff';
    ctx.fillRect(TOSS_LINE + 24, GANTRY_Y - 9, 8, 5);
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(QUAY_X1, GROUND_Y);
    ctx.lineTo(QUAY_X1, GANTRY_Y + 24);
    ctx.stroke();
    ctx.restore();
    label(ctx, '◀ Abwurflinie', TOSS_LINE + 38, GANTRY_Y + 18, { size: 11, color: '#ffd6a0' });
  }

  // Wird nach dem Wasser gezeichnet: Ringe und Boje schwimmen, der Ponton liegt obenauf
  draw(ctx, waveY) {
    for (const g of this.rings) this.drawRing(ctx, g, waveY(g.x));
    this.drawBuoy(ctx, waveY(this.buoy.x));
    this.drawPonton(ctx, waveY);
  }

  drawRing(ctx, g, y) {
    ctx.save();
    ctx.lineWidth = 6;
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = i % 2 ? '#fff' : '#e2302d';
      ctx.beginPath();
      ctx.ellipse(g.x, y, g.r, g.r * 0.32, 0, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    label(ctx, `${g.base}`, g.x, y - 14, { size: 12, color: '#ffd23f', align: 'center' });
  }

  drawBuoy(ctx, y) {
    const { x, base } = this.buoy;
    const bob = Math.sin(this.t * 2.4) * 2;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = '#e2302d';
    ctx.beginPath();
    ctx.moveTo(-11, 4);
    ctx.lineTo(-5, -30);
    ctx.lineTo(5, -30);
    ctx.lineTo(11, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-8, -16, 16, 6);
    ctx.fillStyle = '#333';
    ctx.fillRect(-1, -38, 2, 8);
    ctx.fillStyle = Math.floor(this.t * 1.5) % 2 ? '#ffe14d' : '#8a7a30';
    ctx.beginPath();
    ctx.arc(0, -40, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    label(ctx, `${base}`, x, y - 50, { size: 12, color: '#ffd23f', align: 'center' });
  }

  drawPonton(ctx, waveY) {
    const p = this.ponton;
    const y = waveY(p.x) - 6;
    const bed = this.bed(waveY);
    // Schwimmkörper
    ctx.fillStyle = '#59616b';
    ctx.fillRect(p.x - 55, y, 110, 12);
    ctx.fillStyle = '#f2c12e';
    ctx.fillRect(p.x - 55, y, 110, 3);
    // Lkw: Ladefläche links, Fahrerhaus rechts
    ctx.fillStyle = '#222';
    for (const wx of [p.x - 38, p.x - 14, p.x + 34]) {
      ctx.beginPath();
      ctx.arc(wx, y - 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#3d4a57';
    ctx.fillRect(bed.x - bed.half, bed.y, bed.half * 2, 8);
    ctx.fillStyle = '#2b7bd9';
    ctx.fillRect(p.x + 24, y - 32, 24, 26);
    ctx.fillStyle = '#bfe8ff';
    ctx.fillRect(p.x + 34, y - 28, 11, 9);
    if (p.parked) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.parked.t / 0.3);
      drawLoad(ctx, p.parked.cargo, p.parked.extra, p.x + p.parked.dx, bed.y + p.parked.top - p.parked.h / 2, 0);
      ctx.restore();
    }
    label(ctx, `${p.base}`, bed.x, Math.min(bed.y - 12, SEA_Y - 40), { size: 12, color: '#ffd23f', align: 'center' });
  }
}
