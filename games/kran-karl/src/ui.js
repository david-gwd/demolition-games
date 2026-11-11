import { W, H, STAR_TIME } from './config.js';
import { HEEL_WARN } from './ship.js';
import { CHEF } from './story.js';

const FONT = '"Trebuchet MS", system-ui, sans-serif';

export function label(ctx, text, x, y, { size = 14, color = '#fff', align = 'left', outline = 'rgba(0,0,0,0.6)' } = {}) {
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (outline) {
    ctx.lineWidth = Math.max(3, size / 5);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = outline;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// Kleines Namensschild mit dunklem Hintergrund, bleibt im Bild
export function tag(ctx, text, x, y) {
  ctx.font = `bold 11px ${FONT}`;
  const w = ctx.measureText(text).width + 12;
  const cx = Math.min(W - 4 - w / 2, Math.max(4 + w / 2, x));
  ctx.fillStyle = 'rgba(15, 29, 43, 0.8)';
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y - 12, w, 17, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, y + 1);
}

// Fünfzackiger Stern, gefüllt (erreicht) oder nur als Umriss
export function star(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd23f' : 'rgba(255,255,255,0.12)';
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r / 9);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = filled ? '#a86f12' : 'rgba(255,255,255,0.35)';
  ctx.stroke();
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function mix(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}

export const TITLE_BTNS = [
  { x: W / 2 - 230, y: 400, w: 220, h: 50, label: 'Schichtplan' },
  { x: W / 2 + 10, y: 400, w: 220, h: 50, label: 'Optionen' },
];

const fmtTime = s => {
  const t = Math.ceil(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export class UI {
  constructor() {
    this.floaters = [];
    this.bubble = null;
    this.banner = null;
    this.toasts = []; // Abzeichen-Meldungen, überleben den Schichtwechsel
    this.best = 0; // Bestwert der laufenden Schicht
    this.muted = false;
    this.t = 0;
  }

  reset() {
    this.floaters = [];
    this.bubble = null;
    this.banner = null;
  }

  say(text, dur = 3) { this.bubble = { text, t: dur }; }
  float(text, x, y, color = '#fff', big = false) { this.floaters.push({ text, x, y, color, big, t: 0 }); }
  showBanner(title, sub) { this.banner = { title, sub, t: 2.8 }; }
  toast(text) { this.toasts.push({ text, t: 3.5 }); }

  update(dt) {
    this.t += dt;
    for (const f of this.floaters) { f.t += dt; f.y -= 30 * dt; }
    this.floaters = this.floaters.filter(f => f.t < 1.4);
    if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
  }

  // Läuft auch in Menüs weiter (dort steht die Spielwelt nicht still, aber die Pause schon)
  updateToasts(dt) {
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter(t => t.t > 0);
  }

  drawToasts(ctx) {
    this.toasts.slice(0, 3).forEach((t, i) => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, t.t / 0.4, (3.5 - t.t) / 0.25);
      ctx.font = `bold 16px ${FONT}`;
      const w = ctx.measureText(t.text).width + 56;
      const x = W - 10 - w, y = 44 + i * 38;
      ctx.fillStyle = 'rgba(20, 32, 48, 0.94)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, 32, 16);
      ctx.fill();
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.stroke();
      star(ctx, x + 20, y + 16, 9, true);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.text, x + 36, y + 17);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    });
  }

  drawFloaters(ctx) {
    for (const f of this.floaters) {
      ctx.save();
      ctx.globalAlpha = 1 - Math.max(0, f.t - 0.9) / 0.5;
      const pop = f.big ? 1 + Math.max(0, 0.25 - f.t) * 2 : 1;
      label(ctx, f.text, f.x, f.y, { size: (f.big ? 22 : 14) * pop, color: f.color, align: 'center' });
      ctx.restore();
    }
    if (this.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.banner.t / 0.5);
      label(ctx, this.banner.title, W / 2, 190, { size: 34, color: '#ffd23f', align: 'center' });
      label(ctx, this.banner.sub, W / 2, 222, { size: 17, align: 'center' });
      ctx.restore();
    }
  }

  pill(ctx, text, x, y, { color = '#fff', bg = 'rgba(15, 29, 43, 0.75)', align = 'left' } = {}) {
    ctx.font = `bold 15px ${FONT}`;
    const w = ctx.measureText(text).width + 22;
    const left = align === 'right' ? x - w : x;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(left, y, w, 26, 13);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, left + 11, y + 14);
    ctx.textBaseline = 'alphabetic';
    return w;
  }

  drawHud(ctx, g) {
    const lowTime = g.timeLeft <= 10 && g.phase === 'play';
    const blink = Math.floor(this.t * 4) % 2 === 0;
    let x = 10;
    const lv = g.level;
    if (lv.toss) {
      this.drawTossHud(ctx, g);
      return;
    }
    const name = lv.daily ? 'Tagesschicht' : lv.endless ? `Kap. ${lv.chapter} · ∞+${lv.n}` : `Schicht ${lv.chapter}-${lv.n}`;
    x += this.pill(ctx, name, x, 8) + 8;
    x += this.pill(ctx, `Punkte ${g.score}`, x, 8) + 8;
    x += this.pill(ctx, `Zeit ${fmtTime(g.timeLeft)}`, x, 8, {
      color: lowTime && blink ? '#ff6b5b' : '#fff',
    }) + 8;
    const count = g.progress();
    x += this.pill(ctx, `${g.mode === 'unload' ? 'Gelöscht' : 'Ladung'} ${count}/${g.level.goal}`, x, 8, {
      color: count >= g.level.goal ? '#7ee081' : '#fff',
    }) + 8;
    if (g.combo > 1) this.pill(ctx, `Combo x${g.combo}`, x, 8, { color: '#ffe14d' });

    let rx = W - 10;
    rx -= this.pill(ctx, `Rekord ${this.best}`, rx, 8, { align: 'right' }) + 8;
    if (this.muted) rx -= this.pill(ctx, 'Ton aus', rx, 8, { align: 'right', color: '#aaa' }) + 8;
    if (Math.abs(g.wind) > 5) {
      const arrows = (g.wind > 0 ? '→' : '←').repeat(Math.min(3, 1 + Math.floor(Math.abs(g.wind) / 60)));
      // Windmesser: genaue Stärke
      const exact = g.mods.anemometer ? ` ${Math.round(Math.abs(g.wind))}` : '';
      this.pill(ctx, `Wind ${arrows}${exact}`, rx, 8, { align: 'right', color: '#bfe8ff' });
    }

    // zweite Zeile: Feeder, Inspektor, Gezeiten, Doppelgriff
    const ev = g.events;
    let x2 = 10;
    if (g.feeder) {
      const d = g.feeder.dock;
      const text = d.phase === 'docked' ? `Frieda ${fmtTime(d.timer)} · ${g.feeder.count()}/6` : 'Frieda unterwegs';
      x2 += this.pill(ctx, text, x2, 40, { color: d.phase === 'docked' && d.timer < 8 && blink ? '#ff9d5c' : '#bdf5c4' }) + 8;
    }
    if (ev.inspecting) x2 += this.pill(ctx, `Inspektor schaut zu: ${Math.ceil(ev.inspect)} s`, x2, 40, { color: '#ffd23f' }) + 8;
    if (ev.zone > 0) x2 += this.pill(ctx, `Baustelle: ${Math.ceil(ev.zone)} s`, x2, 40, { color: '#f2c12e' }) + 8;
    if (ev.has('tide')) {
      const rising = Math.cos((ev.t / 70) * Math.PI * 2) > 0;
      x2 += this.pill(ctx, rising ? 'Flut ↑' : 'Ebbe ↓', x2, 40, { color: '#bfe8ff' }) + 8;
    }
    if (g.crane.double) x2 += this.pill(ctx, 'Doppelgriff', x2, 40, { color: '#ffd23f' }) + 8;

    if (g.ship.heelOn && Math.abs(g.ship.heel) > HEEL_WARN && blink) {
      label(ctx, '⚠ SCHLAGSEITE!', W / 2 + 120, 112, { size: 20, color: '#ff8a3d', align: 'center' });
    }
  }

  // Feierabend-Weitwurf: Würfe statt Zeit, weitester Wurf statt Combo
  drawTossHud(ctx, g) {
    let x = 10;
    x += this.pill(ctx, 'Feierabend-Weitwurf', x, 8, { color: '#ffd23f' }) + 8;
    x += this.pill(ctx, `Wurf ${Math.min(g.tossed, g.level.goal)}/${g.level.goal}`, x, 8) + 8;
    x += this.pill(ctx, `Punkte ${g.score}`, x, 8) + 8;
    if (g.stats.longestThrow) this.pill(ctx, `Weitester ${g.stats.longestThrow} m`, x, 8, { color: '#7fd3ff' });
    let rx = W - 10;
    rx -= this.pill(ctx, `Rekord heute ${this.best}`, rx, 8, { align: 'right' }) + 8;
    if (this.muted) rx -= this.pill(ctx, 'Ton aus', rx, 8, { align: 'right', color: '#aaa' }) + 8;
    if (Math.abs(g.wind) > 5) {
      const arrows = (g.wind > 0 ? '→' : '←').repeat(Math.min(3, 1 + Math.floor(Math.abs(g.wind) / 60)));
      const exact = g.mods.anemometer ? ` ${Math.round(Math.abs(g.wind))}` : '';
      this.pill(ctx, `Wind ${arrows}${exact}`, rx, 8, { align: 'right', color: '#bfe8ff' });
    }
  }

  // outfit: helmet (Heimathafen) | fur (Eis) | shades (Tropen)
  drawChef(ctx, mood, outfit = 'helmet') {
    const x = 50, y = 478;
    const anger = 1 - mood / 100;
    const shake = mood < 25 ? Math.sin(this.t * 40) * 1.5 : 0;
    ctx.save();
    ctx.translate(x + shake, y);

    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.ellipse(0, 56, 38, 32, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-32, 40, 64, 4);

    ctx.fillStyle = mix('#f2c48d', '#e2463a', anger * anger);
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();

    if (outfit === 'fur') {
      // Fellmütze mit Ohrenklappen
      ctx.fillStyle = '#7a4f2a';
      ctx.beginPath();
      ctx.arc(0, -8, 26, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#d8c3a5';
      ctx.fillRect(-28, -12, 56, 8);
      ctx.beginPath();
      ctx.ellipse(-24, 4, 6, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(24, 4, 6, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#ffd21f';
      ctx.beginPath();
      ctx.arc(0, -8, 25, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-30, -10, 60, 5);
    }

    ctx.fillStyle = '#222';
    for (const ex of [-8, 8]) {
      ctx.beginPath();
      ctx.arc(ex, 2, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    const tilt = anger * 5;
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-13, -4 - tilt * 0.3); ctx.lineTo(-4, -4 + tilt);
    ctx.moveTo(13, -4 - tilt * 0.3); ctx.lineTo(4, -4 + tilt);
    ctx.stroke();

    ctx.fillStyle = '#5a3b22';
    ctx.beginPath();
    ctx.ellipse(-6, 10, 7, 3.5, 0.2, 0, Math.PI * 2);
    ctx.ellipse(6, 10, 7, 3.5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    if (outfit === 'shades') {
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.roundRect(-14, -3, 12, 8, 3);
      ctx.roundRect(2, -3, 12, 8, 3);
      ctx.fill();
      ctx.fillRect(-2, -1, 4, 2);
    }

    const curve = ((mood - 50) / 50) * 6;
    ctx.strokeStyle = '#3a1a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-7, 17);
    ctx.quadraticCurveTo(0, 17 + curve, 7, 17);
    ctx.stroke();

    if (mood < 30) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 2; i++) {
        const p = (this.t * 40 + i * 15) % 30;
        for (const sx of [-22, 22]) {
          ctx.beginPath();
          ctx.arc(sx + sx * p * 0.02, -26 - p, 3 + p * 0.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // Laune-Balken
    ctx.fillStyle = 'rgba(15, 29, 43, 0.75)';
    ctx.beginPath();
    ctx.roundRect(98, 512, 86, 18, 9);
    ctx.fill();
    ctx.fillStyle = mix('#e2463a', '#5fd068', mood / 100);
    ctx.beginPath();
    ctx.roundRect(100, 514, Math.max(6, 82 * mood / 100), 14, 7);
    ctx.fill();
    label(ctx, 'Laune', 141, 525, { size: 10, align: 'center', outline: 'rgba(0,0,0,0.5)' });

    this.drawBubble(ctx);
  }

  drawBubble(ctx) {
    if (!this.bubble) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.bubble.t / 0.3);
    ctx.font = `bold 14px ${FONT}`;
    const lines = wrap(ctx, this.bubble.text, 250);
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 22;
    const h = lines.length * 18 + 12;
    const bx = 88, by = 452 - h;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(bx, by, w, h, 10);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + 8, by + h - 2);
    ctx.lineTo(bx - 14, by + h + 14);
    ctx.lineTo(bx + 26, by + h - 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'left';
    lines.forEach((l, i) => ctx.fillText(l, bx + 11, by + 20 + i * 18));
    ctx.restore();
  }

  screen(ctx, title, lines, footer, titleColor = '#ffd23f', top = 210) {
    ctx.fillStyle = 'rgba(8, 20, 35, 0.74)';
    ctx.fillRect(0, 0, W, H);
    label(ctx, title, W / 2, 150, { size: 54, color: titleColor, align: 'center', outline: 'rgba(0,0,0,0.8)' });
    lines.forEach((l, i) => label(ctx, l, W / 2, top + i * 32, { size: 19, align: 'center' }));
    if (Math.floor(this.t * 2) % 2 === 0) label(ctx, footer, W / 2, 480, { size: 20, color: '#ffd23f', align: 'center' });
  }

  drawTitle(ctx, cursor = 0) {
    ctx.fillStyle = 'rgba(8, 20, 35, 0.74)';
    ctx.fillRect(0, 0, W, H);
    label(ctx, 'KRAN-KARL', W / 2, 130, { size: 54, color: '#ffd23f', align: 'center', outline: 'rgba(0,0,0,0.8)' });
    [
      'Der Containerkran-Simulator, den niemand bestellt hat.',
      '',
      '← →  Laufkatze fahren      ↑ ↓  Seil hoch / runter',
      'LEERTASTE  Greifen / Loslassen      E  Doppelgriff',
      'P  Pause      M  Ton an / aus      Gamepad geht auch',
      'Nicht ins Wasser. Nicht auf die Möwen. Und bitte NICHT auf die Kneipe.',
    ].forEach((l, i) => label(ctx, l, W / 2, 180 + i * 32, { size: 19, align: 'center' }));
    TITLE_BTNS.forEach((b, i) => {
      ctx.fillStyle = '#f2b134';
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 14);
      ctx.fill();
      if (cursor === i) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
      label(ctx, b.label, b.x + b.w / 2, b.y + 33, { size: 22, color: '#3a2200', align: 'center', outline: null });
    });
  }

  // Zettel oder Postkarte vom Chef vor der ersten Schicht
  drawNote(ctx, note, level, harborName, t) {
    ctx.fillStyle = 'rgba(8, 20, 35, 0.78)';
    ctx.fillRect(0, 0, W, H);
    const w = 560, h = 300, x = (W - w) / 2, y = 100;
    ctx.save();
    ctx.translate(W / 2, y + h / 2);
    ctx.rotate(note.postcard ? -0.03 : 0.02);
    ctx.translate(-W / 2, -(y + h / 2));
    ctx.fillStyle = note.postcard ? '#fff6dc' : '#fdfbf2';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.strokeRect(x, y, w, h);
    if (note.postcard) {
      // Briefmarke
      ctx.fillStyle = '#5fb4e8';
      ctx.fillRect(x + w - 74, y + 16, 56, 64);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(x + w - 46, y + 40, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3e8dbf';
      ctx.fillRect(x + w - 74, y + 60, 56, 20);
    } else {
      ctx.strokeStyle = 'rgba(80, 120, 200, 0.25)';
      ctx.beginPath();
      for (let ly = y + 70; ly < y + h - 20; ly += 30) { ctx.moveTo(x + 20, ly); ctx.lineTo(x + w - 20, ly); }
      ctx.stroke();
    }
    ctx.fillStyle = '#2b2b2b';
    ctx.font = `bold 22px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(note.postcard ? `Postkarte aus: ${harborName}` : `Zettel vom Chef · Schicht ${level.chapter}-${level.n}`, x + 26, y + 46);
    ctx.font = `17px ${FONT}`;
    let ly = y + 92;
    for (const line of note.lines) {
      for (const l of wrap(ctx, line, w - (note.postcard ? 130 : 60))) {
        ctx.fillText(l, x + 26, ly);
        ly += 28;
      }
    }
    ctx.font = `italic bold 17px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`– ${CHEF}`, x + w - 26, y + h - 24);
    ctx.restore();
    if (Math.floor(t * 2) % 2 === 0) label(ctx, 'Leertaste: Schicht beginnen', W / 2, 470, { size: 20, color: '#ffd23f', align: 'center' });
  }

  // Beförderung am Ende eines Kapitels
  drawPromotion(ctx, promo, next, t) {
    ctx.fillStyle = 'rgba(8, 20, 35, 0.86)';
    ctx.fillRect(0, 0, W, H);
    const pop = 1 + Math.max(0, 0.3 - t) * 2;
    label(ctx, 'BEFÖRDERUNG!', W / 2, 120, { size: 54 * pop, color: '#ffd23f', align: 'center', outline: 'rgba(0,0,0,0.8)' });
    label(ctx, `Karl ist jetzt: ${promo.rank}`, W / 2, 172, { size: 26, color: '#7ee081', align: 'center' });
    for (let i = 0; i < 5; i++) star(ctx, W / 2 + (i - 2) * 46, 214, 16, t > 0.3 + i * 0.15);
    promo.lines.forEach((l, i) => label(ctx, l, W / 2, 274 + i * 32, { size: 19, align: 'center' }));
    label(ctx, `Prämie: +${promo.bonus} €${next ? `   ·   Neuer Hafen: ${next}` : ''}`, W / 2, 392, { size: 19, color: '#ffd23f', align: 'center' });
    label(ctx, `– ${CHEF}`, W / 2 + 220, 430, { size: 16, color: '#c9d4de', align: 'right' });
    if (Math.floor(t * 2) % 2 === 0 && t > 0.6) label(ctx, 'Leertaste: Weiter', W / 2, 486, { size: 20, color: '#ffd23f', align: 'center' });
  }

  // res: Ergebnis aus Game.result(); t: Sekunden seit Erscheinen (Sterne ploppen nacheinander auf)
  drawLevelEnd(ctx, g, res, newRecord, t) {
    const verb = g.mode === 'unload' ? 'gelöscht' : 'an Bord';
    const lines = [
      `${g.progress()} von ${g.level.goal} Containern ${verb}`,
      g.bonus ? `Punkte: ${g.score}  (Zeitbonus +${g.bonus})` : `Punkte: ${g.score}`,
    ];
    if (newRecord) lines[1] += '  – neuer Rekord!';
    lines.push(g.level.daily && res.dailyFirst ? `Lohn: +${Math.round(res.coins * 1.5)} € (Tagesbonus ×1,5)` : `Lohn: +${res.coins} €`);
    if (g.stats.throws) lines.push(`Weitester Wurf: ${g.stats.longestThrow} m`);
    this.screen(ctx, 'Schiff ist raus!', lines, 'Leertaste: Weiter', '#7ee081', 330);

    const quarter = Math.round(STAR_TIME * 100);
    const names = ['Soll erfüllt', `${quarter} % Zeit übrig`, `${g.perfectsNeeded()}× perfekt`];
    res.stars.forEach((got, i) => {
      const x = W / 2 + (i - 1) * 150;
      const shown = got && t > 0.3 + i * 0.35;
      const pop = shown ? 1 + Math.max(0, 0.2 - (t - 0.3 - i * 0.35)) * 2 : 1;
      star(ctx, x, 222, 30 * pop, shown);
      label(ctx, names[i], x, 280, { size: 14, align: 'center', color: got ? '#fff' : '#9aa6b2' });
    });
  }

  drawGameOver(ctx, g, res, newRecord) {
    this.screen(ctx, 'Du bist gefeuert!', [
      g.loseReason,
      `Punkte: ${g.score}${newRecord ? '  (neuer Rekord!)' : ''}`,
      `Trostpflaster: +${res.coins} € Lohn`,
      g.stats.throws ? `Weitester Wurf: ${g.stats.longestThrow} m` : '',
      'Morgen um 6 wieder hier.',
    ], 'Leertaste: Zum Schichtplan', '#ff6b5b');
  }

  // rec: { newRecord, allTime } aus Progress.recordToss; best: Tagesrekord, allTime: Bestwert für immer
  drawTossEnd(ctx, g, rec, best, allTime) {
    const hits = g.tossLog.filter(e => e.hit && e.hit.name !== 'Ponton');
    const bulls = hits.filter(e => e.hit.mult === 3).length;
    let first = `Punkte: ${g.score}`;
    if (rec.allTime) first += '  – Bestwert!';
    else if (rec.newRecord) first += '  – Tagesrekord!';
    this.screen(ctx, 'Feierabend!', [
      first,
      `Weitester Wurf: ${g.stats.longestThrow} m`,
      `Treffer: ${hits.length} von ${g.level.goal}${bulls ? `  (davon ${bulls}× Volltreffer)` : ''}`,
      `Rekord heute: ${best}   ·   Bestwert: ${allTime}`,
      '',
      'Morgen gibt\'s neue Ziele.',
    ], 'Leertaste: Zum Schichtplan', '#7fd3ff');
  }
}
