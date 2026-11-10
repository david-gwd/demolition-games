import { GANTRY_Y, BOX_W, BOX_H } from './config.js';

const KEY = 'kran-karl-ghosts';
export const GHOST_EVERY = 8; // ein Bild pro 8 Fixed-Steps (15 Hz)
const FIELDS = 4; // Laufkatze x, Haken x, Haken y, Fracht (0/1/2)
const TOP = GANTRY_Y + 10;

function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

const encode = arr => {
  const bytes = new Uint8Array(Int16Array.from(arr).buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 4096) s += String.fromCharCode(...bytes.subarray(i, i + 4096));
  return btoa(s);
};

const decode = str => {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer);
};

// Zeichnet die Kranbewegung einer Schicht auf
export class GhostRecorder {
  constructor() {
    this.data = [];
    this.steps = 0;
  }

  step(crane) {
    if (this.steps++ % GHOST_EVERY) return;
    this.data.push(Math.round(crane.x), Math.round(crane.hookX), Math.round(crane.hookY), crane.cargo ? (crane.extra ? 2 : 1) : 0);
  }

  // Bestleistung speichern; von Tagesschichten bleibt nur die neueste
  save(key) {
    const all = loadAll();
    if (key.startsWith('daily-')) for (const k of Object.keys(all)) if (k.startsWith('daily-')) delete all[k];
    all[key] = encode(this.data);
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* Speicher voll: dann eben ohne Geist */ }
  }
}

// Spielt die gespeicherte Bestleistung halbtransparent ab
export class GhostPlayer {
  static load(key) {
    const s = loadAll()[key];
    if (!s) return null;
    try { return new GhostPlayer(decode(s)); } catch { return null; }
  }

  constructor(data) {
    this.data = data;
    this.frames = Math.floor(data.length / FIELDS);
  }

  sample(steps) {
    const f = steps / GHOST_EVERY;
    const i = Math.floor(f);
    if (i >= this.frames - 1) return null;
    const k = f - i;
    const d = this.data, a = i * FIELDS, b = a + FIELDS;
    const lerp = j => d[a + j] + (d[b + j] - d[a + j]) * k;
    return { x: lerp(0), hx: lerp(1), hy: lerp(2), load: d[a + 3] };
  }

  draw(ctx, steps) {
    const p = this.sample(steps);
    if (!p) return;
    ctx.save();
    ctx.globalAlpha = 0.33;
    ctx.strokeStyle = '#e8f4ff';
    ctx.fillStyle = '#e8f4ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, TOP);
    ctx.lineTo(p.hx, p.hy);
    ctx.stroke();
    ctx.fillRect(p.x - 22, GANTRY_Y - 14, 44, 22);
    const theta = Math.atan2(p.hx - p.x, p.hy - TOP);
    ctx.translate(p.hx, p.hy);
    ctx.rotate(-theta);
    if (p.load) {
      const h = BOX_H * p.load;
      ctx.strokeRect(-BOX_W / 2, 4, BOX_W, h);
    } else {
      ctx.fillRect(-9, -4, 18, 7);
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.font = 'bold 10px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillStyle = '#e8f4ff';
    ctx.textAlign = 'center';
    ctx.fillText('Rekord-Geist', p.x, GANTRY_Y - 18);
    ctx.restore();
  }
}
