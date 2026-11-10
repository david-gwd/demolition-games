import { BOX_W, BOX_H, SHIP_DECK_LEFT, SHIP_DECK_Y, clamp, rnd, pick } from './config.js';
import { drawBox } from './container.js';
import { randomCargo, PLAN_COLORS } from './content.js';

const HEEL_FACTOR = 7000;
export const HEEL_WARN = 0.1;
export const HEEL_SLIDE = 0.16;
export const SLIPPERY_SLIDE = 0.1;
const EDGE_SLACK = 12;
// Reihenfolge beim Vorbeladen: spiegelbildliche Spaltenpaare von der Mitte nach außen
const PAIRS = [[2, 3], [1, 4], [0, 5]];
export const FEEDER_TIME = 40;

// Das Schiff rechnet in einem lokalen Koordinatensystem: Ursprung = Deckmitte, Deck bei y = 0.
// Hauptschiff: 6 Spalten × 4 Lagen. Feeder: 3 × 2, legt zwischendurch ab und kommt leer zurück.
export class Ship {
  constructor({ cols = 6, layers = 4, deckLeft = SHIP_DECK_LEFT, deckY = SHIP_DECK_Y, name = 'MS WACKELPUDDING', small = false } = {}) {
    this.colCount = cols;
    this.layers = layers;
    this.width = cols * BOX_W;
    this.deckLeft = deckLeft;
    this.deckY = deckY;
    this.name = name;
    this.small = small;
    this.tide = 0;
    this.reset({ wave: 0, heel: false });
  }

  // opts: { harbor, reefers } für die Vorbeladung
  reset(level, opts = {}) {
    this.cols = Array.from({ length: this.colCount }, () => []);
    this.plan = null;
    this.planColors = null;
    this.plugs = new Set();
    this.boost = 1;
    const main = !this.small;
    if (main && level.plan) this.makePlan();
    if (main && level.reefers && level.mode === 'load') pick(PAIRS).forEach(c => this.plugs.add(c));
    if (main && level.mode === 'unload') this.preload(level.goal + 3, { ...opts, mode: 'unload' });
    this.wave = level.wave;
    this.heelOn = main && level.heel;
    this.t = 0;
    this.bob = 0;
    this.roll = 0;
    this.heel = 0;
    this.angle = 0;
    this.offsetX = 0;
    this.departing = false;
    this.departSpeed = 0;
    this.dock = { phase: 'docked', timer: FEEDER_TIME, p: 0, wait: 0 };
  }

  // Ladeplan: drei Farben, je zwei Spalten
  makePlan() {
    const colors = [...PLAN_COLORS].sort(() => rnd() - 0.5).slice(0, 3);
    this.planColors = colors;
    this.plan = [0, 0, 1, 1, 2, 2].map(i => colors[i]).sort(() => rnd() - 0.5);
  }

  // Schiff zum Löschen vorbeladen – paarweise gleich schwer, damit es gerade liegt
  preload(n, opts) {
    n = Math.min(n, this.colCount * this.layers);
    for (let k = 0; n > 0; k++) {
      const [a, b] = PAIRS[k % PAIRS.length];
      const first = randomCargo(null, 0, opts);
      this.addBox(a, first, 0);
      if (--n > 0) { this.addBox(b, randomCargo(null, first.weight, opts), 0); n--; }
    }
  }

  get docked() { return this.dock.phase === 'docked'; }
  get pivotX() { return this.deckLeft + this.width / 2 + this.offsetX; }
  get pivotY() { return this.deckY + this.bob + this.tide - this.dock.p * 30; }

  colX(i) { return -this.width / 2 + BOX_W * (i + 0.5); }
  count() { return this.cols.reduce((n, c) => n + c.length, 0); }
  isFull() { return this.cols.every(c => c.length >= this.layers); }

  imbalance() {
    let s = 0;
    this.cols.forEach((col, i) => col.forEach(b => { s += b.cargo.weight * this.colX(i); }));
    return s;
  }

  update(dt) {
    this.t += dt;
    this.bob = Math.sin(this.t * 1.4 + (this.small ? 2 : 0)) * this.wave * (this.small ? 0.7 : 0.5) * this.boost;
    this.roll = Math.sin(this.t * 1.1 + 1) * this.wave * (this.small ? 0.006 : 0.004) * this.boost;
    const target = this.heelOn ? clamp(this.imbalance() / HEEL_FACTOR, -0.22, 0.22) : 0;
    this.heel += (target - this.heel) * Math.min(1, dt * 1.5);
    this.angle = this.roll + this.heel;
    for (const col of this.cols) for (const b of col) b.wobble *= Math.exp(-dt * 3);
    if (this.departing) {
      this.departSpeed += dt * 50;
      this.offsetX += this.departSpeed * dt;
    }
    if (this.small) this.offsetX = 380 * this.dock.p;
  }

  toLocal(x, y) {
    const dx = x - this.pivotX, dy = y - this.pivotY;
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    return { x: dx * c + dy * s, y: -dx * s + dy * c };
  }

  toWorld(lx, ly) {
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    return { x: this.pivotX + lx * c - ly * s, y: this.pivotY + lx * s + ly * c };
  }

  addBox(col, cargo, wobble) {
    this.cols[col].push({ cargo, wobble });
  }

  // Stellt einen Container ab; mit Stapelregel zerquetscht schwer auf leicht den unteren. Gibt den zerquetschten zurück.
  place(col, cargo, wobble, stackRule) {
    const below = this.cols[col][this.cols[col].length - 1];
    let crushed = null;
    if (stackRule && below && below.cargo.weight < cargo.weight) {
      crushed = this.cols[col].pop().cargo;
    }
    this.addBox(col, cargo, wobble);
    return crushed;
  }

  removeTop(col) { return this.cols[col].pop(); }

  // Weltposition der Oberkante einer Spalte
  topOf(i) { return this.toWorld(this.colX(i), -BOX_H * this.cols[i].length); }

  // Oberster greifbarer Container bei Welt-x: innerhalb von `reach` gewinnt der höchste Stapel, sonst der nächste
  topAt(x, reach) {
    let best = null;
    for (let i = 0; i < this.colCount; i++) {
      if (!this.cols[i].length) continue;
      const p = this.topOf(i);
      const dist = Math.abs(p.x - x);
      const higher = best && dist <= reach && best.dist <= reach
        ? p.y < best.y - 1 || (Math.abs(p.y - best.y) <= 1 && dist < best.dist)
        : !best || dist < best.dist;
      if (higher) best = { col: i, x: p.x, y: p.y, dist };
    }
    return best;
  }

  // Höchste Oberkante (Deck oder Stapel) unter einem Objekt der halben Breite halfW – daneben: Infinity
  floorAt(x, halfW) {
    let y = Infinity;
    for (let i = 0; i < this.colCount; i++) {
      const p = this.topOf(i);
      if (Math.abs(x - p.x) < BOX_W / 2 + halfW) y = Math.min(y, p.y);
    }
    return y;
  }

  lanternPos() { return this.toWorld(-this.width / 2 - 14, -46); }

  // Prüft einen fallenden Container (lokale Koordinaten, halbe Höhe hh, n Container hoch) gegen Deck und Stapel.
  // Ergebnis: null | {type:'land', col, offset, dir} | {type:'tip', dir, top} | {type:'push', dir, x}
  collide(local, prevLocal, skipCol = -1, hh = BOX_H / 2, n = 1) {
    const half = BOX_W / 2;
    const bottom = local.y + hh;
    const prevBottom = prevLocal.y + hh;

    // höchster Stapel unter dem Container
    let best = -1, bestTop = Infinity, bestDist = Infinity;
    for (let i = 0; i < this.colCount; i++) {
      if (i === skipCol) continue;
      const dist = Math.abs(local.x - this.colX(i));
      // wer einen Nachbarstapel nur knapp streift, rutscht daran ab statt zu kippen
      if (dist >= BOX_W - EDGE_SLACK) continue;
      const top = -this.cols[i].length * BOX_H;
      if (top < bestTop - 0.5 || (Math.abs(top - bestTop) < 0.5 && dist < bestDist)) {
        best = i; bestTop = top; bestDist = dist;
      }
    }
    if (best < 0) return null;

    if (bottom >= bestTop && prevBottom <= bestTop + 6) {
      const dir = Math.sign(local.x - this.colX(best)) || (rnd() < 0.5 ? -1 : 1);
      // weniger als 50 % Auflage oder kein Platz mehr -> kippt
      if (this.cols[best].length + n > this.layers || bestDist > half) return { type: 'tip', dir, top: bestTop };
      return { type: 'land', col: best, offset: bestDist, dir };
    }

    // seitlich gegen einen Stapel geflogen
    for (let i = 0; i < this.colCount; i++) {
      const h = this.cols[i].length;
      if (!h || i === skipCol) continue;
      const cx = this.colX(i);
      if (Math.abs(local.x - cx) < BOX_W && bottom > -h * BOX_H + 6 && local.y - hh < 0) {
        const dir = Math.sign(local.x - cx) || 1;
        return { type: 'push', dir, x: cx + dir * (BOX_W + 1) };
      }
    }
    return null;
  }

  draw(ctx) {
    if (this.dock.phase === 'away') return;
    const hw = this.width / 2;
    ctx.save();
    ctx.translate(this.pivotX, this.pivotY);
    if (this.small && this.dock.p > 0) {
      // Feeder fährt Richtung Horizont
      const s = 1 - 0.5 * this.dock.p;
      ctx.scale(s, s);
      ctx.globalAlpha = 1 - 0.4 * this.dock.p;
    }
    ctx.rotate(this.angle);

    // Rumpf
    const depth = this.small ? 40 : 52;
    ctx.beginPath();
    ctx.moveTo(-hw - 24, 0);
    ctx.lineTo(hw + 4, 0);
    ctx.lineTo(hw + 46, -12);
    ctx.lineTo(hw + 18, depth);
    ctx.lineTo(-hw - 8, depth);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = this.small ? '#2f6b4f' : '#23395b';
    ctx.fillRect(-hw - 30, -20, this.width + 90, 80);
    ctx.fillStyle = this.small ? '#e8a33d' : '#b8322a';
    ctx.fillRect(-hw - 30, depth - 20, this.width + 90, 30);
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(-hw - 30, 6, this.width + 90, 3);
    ctx.restore();

    ctx.fillStyle = '#f4f4f4';
    ctx.font = `bold ${this.small ? 10 : 12}px "Trebuchet MS", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(this.name, -hw + 8, this.small ? 21 : 24);
    ctx.fillStyle = '#d8e6f2';
    for (let x = this.small ? 20 : 60; x < hw; x += 26) {
      ctx.beginPath();
      ctx.arc(x, 20, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Deck mit Zielmarken
    ctx.fillStyle = '#6d7a88';
    ctx.fillRect(-hw - 4, 0, this.width + 8, 5);
    if (this.plan) {
      // Ladeplan: farbige Deckstreifen, bleiben auch unter Stapeln sichtbar
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < this.colCount; i++) {
        ctx.fillStyle = this.plan[i];
        ctx.fillRect(this.colX(i) - 24, 0, 48, 7);
        ctx.strokeRect(this.colX(i) - 24, 0, 48, 7);
      }
    }
    for (const i of this.plugs) this.drawPlug(ctx, this.colX(i));
    for (let i = 0; i < this.colCount; i++) {
      if (this.cols[i].length) continue;
      const x = this.colX(i);
      ctx.fillStyle = this.plan ? this.plan[i] : 'rgba(255, 210, 63, 0.9)';
      ctx.beginPath();
      ctx.moveTo(x - 5, -1);
      ctx.lineTo(x + 5, -1);
      ctx.lineTo(x, -7);
      ctx.closePath();
      ctx.fill();
    }

    // Mast mit Fahne am Heck
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-hw - 14, 0);
    ctx.lineTo(-hw - 14, this.small ? -34 : -46);
    ctx.stroke();
    ctx.fillStyle = this.small ? '#3fa34d' : '#e8472b';
    ctx.fillRect(-hw - 30, this.small ? -34 : -46, 15, 10);

    for (let i = 0; i < this.colCount; i++) {
      this.cols[i].forEach((b, j) => {
        drawBox(ctx, b.cargo, this.colX(i), -BOX_H * (j + 0.5), b.wobble * Math.sin(this.t * 22));
      });
    }
    ctx.restore();
  }

  // Stromanschluss für Kühlcontainer: gelbe Blitz-Marke im Deckstreifen, bleibt unter Stapeln sichtbar
  drawPlug(ctx, x) {
    ctx.fillStyle = '#1d2a3a';
    ctx.fillRect(x - 9, 0, 18, 9);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(x + 2, 0.5);
    ctx.lineTo(x - 4, 5);
    ctx.lineTo(x - 0.5, 5);
    ctx.lineTo(x - 2, 8.5);
    ctx.lineTo(x + 4, 3.5);
    ctx.lineTo(x + 0.5, 3.5);
    ctx.closePath();
    ctx.fill();
  }
}
