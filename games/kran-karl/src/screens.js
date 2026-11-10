import { W, H, clamp } from './config.js';
import { label, star } from './ui.js';
import { getLevel, parseKey, levelKey, endlessKey, today, CHAPTERS, CHAPTER_COUNT, LEVELS_PER_CHAPTER } from './level.js';
import { UPGRADES, nextCost, buy, COSMETICS, SLOTS, useCosmetic } from './shop.js';
import { ACHIEVEMENTS } from './achievements.js';
import { RARE } from './content.js';
import { EVENT_NAMES } from './events.js';
import { drawHat, drawTrolley } from './crane.js';
import { settings, saveSettings, resetKeys, keyLabel, KEY_NAMES } from './settings.js';
import { sfx, setVolume } from './audio.js';

const FONT = '"Trebuchet MS", system-ui, sans-serif';
const COLS = 5;
const TILES = LEVELS_PER_CHAPTER + 1; // letzte Kachel = Endlos-Schichten
const TILE = { w: 164, h: 118, gap: 12, y0: 112 };
const TILE_X0 = (W - COLS * TILE.w - (COLS - 1) * TILE.gap) / 2;
const SEL_BTNS = [
  { x: 130, y: 380, w: 220, h: 46, label: 'Werkstatt', type: 'shop' },
  { x: 370, y: 380, w: 220, h: 46, label: 'Abzeichen', type: 'achievements' },
  { x: 610, y: 380, w: 220, h: 46, label: 'Tagesschicht', type: 'daily' },
];
const PAGE_L = { x: 4, y: 180, w: 40, h: 90 };
const PAGE_R = { x: W - 44, y: 180, w: 40, h: 90 };
const BACK_BTN = { x: W / 2 - 120, y: 456, w: 240, h: 40 };

const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const center = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const tileRect = i => ({
  x: TILE_X0 + (i % COLS) * (TILE.w + TILE.gap),
  y: TILE.y0 + Math.floor(i / COLS) * (TILE.h + TILE.gap),
  w: TILE.w,
  h: TILE.h,
});

// Räumliche Menü-Navigation: nächstes Feld in Pfeilrichtung (oder -1, wenn keins)
function spatial(rects, i, dir) {
  const c = center(rects[i]);
  let best = -1, bestD = Infinity;
  rects.forEach((r, j) => {
    if (j === i || !r) return;
    const p = center(r);
    const dx = p.x - c.x, dy = p.y - c.y;
    const main = { left: -dx, right: dx, up: -dy, down: dy }[dir];
    const side = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (main <= 4) return;
    const d = main + side * 2.5;
    if (d < bestD) { bestD = d; best = j; }
  });
  return best;
}

// Gemeinsame Bedienung aller Menüs: Pfeile bewegen den Cursor, Aktion/Tipp löst aus.
// Gibt den ausgelösten Index zurück (oder null). onSide(dir) fängt links/rechts ab, wenn nichts mehr kommt.
function navigate(st, rects, presses, action, tap, onSide = null) {
  for (const k of presses) {
    if (!['left', 'right', 'up', 'down'].includes(k)) continue;
    const j = spatial(rects, st.cursor, k);
    if (j >= 0) {
      st.cursor = j;
      sfx.move();
    } else if (onSide && (k === 'left' || k === 'right')) onSide(k);
  }
  if (tap) {
    const j = rects.findIndex(r => r && inside(tap, r));
    if (j < 0) return null;
    st.cursor = j;
    return j;
  }
  return action ? st.cursor : null;
}

function panel(ctx, r, { fill, focus = false, radius = 12 }) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.fill();
  if (focus) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffd23f';
    ctx.stroke();
  }
}

function button(ctx, r, text, focus, size = 20) {
  panel(ctx, r, { fill: '#f2b134', focus, radius: 14 });
  label(ctx, text, r.x + r.w / 2, r.y + r.h / 2 + size * 0.36, { size, color: '#3a2200', align: 'center', outline: null });
}

function header(ctx, title, progress) {
  ctx.fillStyle = 'rgba(8, 20, 35, 0.88)';
  ctx.fillRect(0, 0, W, H);
  label(ctx, title, 48, 62, { size: 36, color: '#ffd23f', outline: 'rgba(0,0,0,0.8)' });
  if (progress) label(ctx, `Lohn: ${progress.coins} €`, W - 48, 62, { size: 22, color: '#7ee081', align: 'right' });
}

function hint(ctx, t, text, y = 516) {
  if (Math.floor(t * 2) % 2 === 0) label(ctx, text, W / 2, y, { size: 15, color: '#ffd23f', align: 'center' });
}

// Schichtplan, Werkstatt, Abzeichen, Optionen, Pause
export class Screens {
  constructor(progress, input) {
    this.progress = progress;
    this.input = input;
    this.page = 1; // Kapitel
    this.sel = { cursor: 0 }; // 0..9 Kacheln, 10..12 Knöpfe
    this.shop = { cursor: 0, tab: 'up' };
    this.ach = { cursor: 0 };
    this.opt = { cursor: 0, waiting: null };
    this.pause = { cursor: 0 };
  }

  // ---------- Schichtplan ----------

  tileKey(i) {
    const c = this.page;
    if (i < LEVELS_PER_CHAPTER) return levelKey(c, i + 1);
    return endlessKey(c, Math.max(1, this.progress.endlessIn(c)));
  }

  selRects() { return [...Array.from({ length: TILES }, (_, i) => tileRect(i)), ...SEL_BTNS]; }

  focusLevel(key) {
    const p = parseKey(key);
    if (!p) return;
    this.page = p.chapter;
    this.sel.cursor = p.endless ? TILES - 1 : clamp(p.i - 1, 0, TILES - 1);
  }

  // nach einem Sieg: Cursor auf die nächste Schicht (bzw. ins nächste Kapitel)
  focusNext(level) {
    if (level.daily) return;
    if (!level.endless && level.n === LEVELS_PER_CHAPTER && level.chapter < CHAPTER_COUNT) this.focusLevel(levelKey(level.chapter + 1, 1));
    else if (level.endless) this.focusLevel(endlessKey(level.chapter, level.n + 1));
    else this.focusLevel(levelKey(level.chapter, level.n + 1));
  }

  flip(dir) {
    const next = clamp(this.page + (dir === 'left' ? -1 : 1), 1, CHAPTER_COUNT);
    if (next === this.page) return;
    this.page = next;
    this.sel.cursor = dir === 'left' ? COLS - 1 : 0;
    sfx.page();
  }

  // Gibt {type:'start', key} | {type:'shop'|'achievements'|'daily'} | null zurück
  updateSelect(presses, action, tap) {
    if (tap && inside(tap, PAGE_L)) { this.flip('left'); return null; }
    if (tap && inside(tap, PAGE_R)) { this.flip('right'); return null; }
    const hit = navigate(this.sel, this.selRects(), presses, action, tap, d => this.flip(d));
    if (hit === null) return null;
    if (hit >= TILES) return { type: SEL_BTNS[hit - TILES].type };
    const key = this.tileKey(hit);
    if (!this.progress.isUnlocked(key)) {
      sfx.nope();
      return null;
    }
    return { type: 'start', key };
  }

  drawSelect(ctx, t) {
    const p = this.progress;
    const ch = CHAPTERS[this.page - 1];
    header(ctx, 'Schichtplan', p);
    star(ctx, W / 2 - 34, 52, 13, true);
    label(ctx, `${p.totalStars()}`, W / 2 - 14, 60, { size: 22 });
    label(ctx, `Kapitel ${this.page} · ${ch.name}`, W / 2, 96, { size: 20, color: '#bfe8ff', align: 'center' });
    for (let c = 1; c <= CHAPTER_COUNT; c++) {
      ctx.fillStyle = c === this.page ? '#ffd23f' : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(W / 2 + (c - 2) * 16, 106, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const open = p.chapterOpen(this.page);

    for (let i = 0; i < TILES; i++) {
      const r = tileRect(i);
      const key = this.tileKey(i);
      const lv = getLevel(key);
      const locked = !p.isUnlocked(key);
      const unload = lv.mode === 'unload';
      panel(ctx, r, {
        fill: locked ? 'rgba(60, 70, 82, 0.55)' : unload ? 'rgba(31, 94, 110, 0.9)' : 'rgba(35, 57, 91, 0.92)',
        focus: this.sel.cursor === i,
      });
      const cx = r.x + r.w / 2;
      const dim = locked ? '#7f8a96' : '#fff';
      label(ctx, i < LEVELS_PER_CHAPTER ? `${i + 1}` : '∞', r.x + 14, r.y + 32, { size: 26, color: locked ? '#7f8a96' : '#ffd23f' });
      label(ctx, unload ? 'Löschen' : 'Laden', r.x + r.w - 12, r.y + 20, { size: 12, color: dim, align: 'right', outline: null });
      const tags = [...lv.events.map(e => EVENT_NAMES[e])];
      if (lv.feeder) tags.push('Feeder');
      if (lv.reefers) tags.push('Kühlware');
      if (lv.stackRule) tags.push('Stapelregel');
      label(ctx, tags.slice(0, 2).join(' · '), r.x + r.w - 12, r.y + 35, { size: 10, color: locked ? '#7f8a96' : '#bfe8ff', align: 'right', outline: null });
      label(ctx, lv.name, cx, r.y + 62, { size: 14, color: dim, align: 'center', outline: null });
      if (locked) {
        label(ctx, 'gesperrt', cx, r.y + 92, { size: 13, color: '#7f8a96', align: 'center', outline: null });
      } else {
        const got = p.starsFor(key);
        for (let s = 0; s < 3; s++) star(ctx, cx + (s - 1) * 26, r.y + 84, 10, s < got);
        const best = p.bestFor(key);
        if (best) label(ctx, `Rekord ${best}`, cx, r.y + 110, { size: 11, color: '#c9d4de', align: 'center', outline: null });
      }
    }
    if (!open) {
      panel(ctx, { x: 200, y: 200, w: 560, h: 60 }, { fill: 'rgba(15, 25, 38, 0.95)' });
      label(ctx, `Gewinne Schicht 9 in Kapitel ${this.page - 1}, dann geht's hierher.`, W / 2, 237, { size: 18, align: 'center', outline: null });
    }

    // Umblättern
    const arrow = (r, text, on) => {
      if (!on) return;
      panel(ctx, r, { fill: 'rgba(255,255,255,0.12)', radius: 10 });
      label(ctx, text, r.x + r.w / 2, r.y + r.h / 2 + 9, { size: 26, color: '#ffd23f', align: 'center', outline: null });
    };
    arrow(PAGE_L, '◀', this.page > 1);
    arrow(PAGE_R, '▶', this.page < CHAPTER_COUNT);

    SEL_BTNS.forEach((b, i) => {
      let text = b.label;
      if (b.type === 'daily') {
        const d = p.data.daily;
        text = d.date === `daily-${today()}` ? `Tagesschicht · ${d.best}` : 'Tagesschicht ★ neu';
      }
      if (b.type === 'achievements') text = `Abzeichen ${Object.keys(p.data.achievements).length}/${ACHIEVEMENTS.length}`;
      button(ctx, b, text, this.sel.cursor === TILES + i, 18);
    });
    hint(ctx, t, 'Pfeiltasten: wählen (am Rand blättern)   ·   Leertaste: los   ·   Esc: Titel', 470);
  }

  // ---------- Werkstatt ----------

  shopRects() {
    const tabs = [{ x: W / 2 - 210, y: 82, w: 200, h: 36 }, { x: W / 2 + 10, y: 82, w: 200, h: 36 }];
    const items = this.shop.tab === 'up'
      ? UPGRADES.map((_, i) => ({ x: 130 + (i % 2) * 355, y: 130 + Math.floor(i / 2) * 78, w: 345, h: 68 }))
      : COSMETICS.map(c => {
        const row = SLOTS.findIndex(s => s.id === c.slot);
        const idx = COSMETICS.filter(x => x.slot === c.slot).indexOf(c);
        return { x: 95 + idx * 130, y: 146 + row * 98, w: 120, h: 70 };
      });
    return [...tabs, ...items, BACK_BTN];
  }

  // Gibt true zurück, wenn die Werkstatt verlassen wird
  updateShop(presses, action, tap) {
    const rects = this.shopRects();
    const hit = navigate(this.shop, rects, presses, action, tap);
    if (hit === null) return false;
    if (hit === rects.length - 1) return true;
    if (hit < 2) {
      const tab = hit === 0 ? 'up' : 'cos';
      if (tab !== this.shop.tab) {
        this.shop.tab = tab;
        sfx.page();
      }
      return false;
    }
    if (this.shop.tab === 'up') {
      if (buy(this.progress, UPGRADES[hit - 2])) sfx.buy();
      else sfx.nope();
    } else {
      const r = useCosmetic(this.progress, COSMETICS[hit - 2]);
      if (r === 'buy') sfx.buy();
      else if (r === 'equip') sfx.move();
      else sfx.nope();
    }
    return false;
  }

  drawShop(ctx, t) {
    const p = this.progress;
    header(ctx, 'Werkstatt', p);
    const rects = this.shopRects();
    const cur = this.shop.cursor;
    ['Upgrades', 'Kosmetik'].forEach((name, i) => {
      const active = (i === 0) === (this.shop.tab === 'up');
      panel(ctx, rects[i], { fill: active ? '#f2b134' : 'rgba(255,255,255,0.12)', focus: cur === i, radius: 10 });
      label(ctx, name, rects[i].x + rects[i].w / 2, rects[i].y + 24, { size: 17, color: active ? '#3a2200' : '#fff', align: 'center', outline: null });
    });

    if (this.shop.tab === 'up') {
      UPGRADES.forEach((up, i) => {
        const r = rects[i + 2];
        const lvl = p.upgrades[up.id] || 0;
        const cost = nextCost(p, up);
        const affordable = cost !== null && cost <= p.coins;
        panel(ctx, r, { fill: 'rgba(35, 57, 91, 0.92)', focus: cur === i + 2 });
        label(ctx, up.name, r.x + 14, r.y + 27, { size: 17, outline: null });
        label(ctx, up.desc, r.x + 14, r.y + 50, { size: 12, color: '#c9d4de', outline: null });
        ctx.font = `bold 17px ${FONT}`;
        const px = r.x + 26 + ctx.measureText(up.name).width;
        up.costs.forEach((_, s) => {
          ctx.fillStyle = s < lvl ? '#ffd23f' : 'rgba(255,255,255,0.2)';
          ctx.beginPath();
          ctx.arc(px + s * 14, r.y + 21, 4.5, 0, Math.PI * 2);
          ctx.fill();
        });
        if (cost === null) label(ctx, 'MAX', r.x + r.w - 14, r.y + 27, { size: 17, color: '#7ee081', align: 'right', outline: null });
        else label(ctx, `${cost} €`, r.x + r.w - 14, r.y + 27, { size: 17, color: affordable ? '#ffd23f' : '#8792a0', align: 'right', outline: null });
      });
    } else {
      const c = p.data.cosmetics;
      SLOTS.forEach((slot, row) => label(ctx, slot.name, 95, 140 + row * 98, { size: 14, color: '#bfe8ff', outline: null }));
      COSMETICS.forEach((item, i) => {
        const r = rects[i + 2];
        const owned = c.owned.includes(item.id);
        const worn = c.equipped[item.slot] === item.id;
        panel(ctx, r, { fill: worn ? 'rgba(63, 163, 77, 0.55)' : 'rgba(35, 57, 91, 0.92)', focus: cur === i + 2, radius: 10 });
        this.drawPreview(ctx, item, r.x + r.w / 2, r.y + 30);
        label(ctx, item.name, r.x + r.w / 2, r.y + 52, { size: 11, align: 'center', outline: null });
        const status = worn ? 'angelegt' : owned ? 'anlegen' : `${item.cost} €`;
        const color = worn ? '#7ee081' : owned ? '#fff' : item.cost <= p.coins ? '#ffd23f' : '#8792a0';
        label(ctx, status, r.x + r.w / 2, r.y + 66, { size: 11, color, align: 'center', outline: null });
      });
    }
    button(ctx, BACK_BTN, 'Zurück', cur === rects.length - 1);
    hint(ctx, t, 'Pfeiltasten: wählen   ·   Leertaste: kaufen / anlegen   ·   Esc: zurück');
  }

  drawPreview(ctx, item, x, y) {
    if (item.slot === 'crane') {
      ctx.fillStyle = item.paint.beam;
      ctx.fillRect(x - 40, y - 14, 80, 7);
      drawTrolley(ctx, x, y + 2, { paint: item.paint, hat: 'none' });
    } else if (item.slot === 'hat') {
      ctx.fillStyle = '#f2c48d';
      ctx.beginPath();
      ctx.arc(x, y + 2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.fillRect(x - 4, y, 2, 2);
      ctx.fillRect(x + 2, y, 2, 2);
      drawHat(ctx, item.id.slice(4), x, y - 6, 2.2);
    } else {
      const deco = item.id.slice(5);
      if (deco === 'lights') {
        ['#ff4d4d', '#ffd23f', '#4dd2ff', '#7ee081', '#ff4d4d'].forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(x - 24 + i * 12, y - 4 + Math.abs(i - 2) * 3, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (deco === 'flowers') {
        ctx.fillStyle = '#7a4a22';
        ctx.fillRect(x - 20, y, 40, 8);
        ['#ff5d8f', '#ffd23f', '#ff7a1a', '#c77dff'].forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(x - 14 + i * 9.5, y - 3, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (deco === 'neon') {
        ctx.save();
        ctx.shadowColor = '#ff4dd2';
        ctx.shadowBlur = 8;
        label(ctx, 'OFFEN', x, y + 5, { size: 14, color: '#ffb3f0', align: 'center', outline: null });
        ctx.restore();
      } else {
        label(ctx, '–', x, y + 5, { size: 18, color: '#8792a0', align: 'center', outline: null });
      }
    }
  }

  // ---------- Abzeichen ----------

  achRects() {
    const list = ACHIEVEMENTS.map((_, i) => ({ x: 48 + (i % 5) * 176, y: 84 + Math.floor(i / 5) * 62, w: 168, h: 54 }));
    return [...list, BACK_BTN];
  }

  updateAchievements(presses, action, tap) {
    const rects = this.achRects();
    const hit = navigate(this.ach, rects, presses, action, tap);
    return hit === rects.length - 1;
  }

  drawAchievements(ctx, t) {
    const p = this.progress;
    header(ctx, 'Abzeichen', p);
    const rects = this.achRects();
    const got = p.data.achievements;
    ACHIEVEMENTS.forEach((a, i) => {
      const r = rects[i];
      const has = !!got[a.id];
      panel(ctx, r, { fill: has ? 'rgba(122, 90, 18, 0.85)' : 'rgba(45, 55, 68, 0.8)', focus: this.ach.cursor === i, radius: 10 });
      star(ctx, r.x + 18, r.y + 27, 10, has);
      label(ctx, a.name, r.x + 34, r.y + 24, { size: 13, color: has ? '#ffe9a8' : '#9aa6b2', outline: null });
      label(ctx, a.coins ? `+${a.coins} €` : 'Ehre', r.x + 34, r.y + 42, { size: 11, color: has ? '#7ee081' : '#7f8a96', outline: null });
    });
    const sel = ACHIEVEMENTS[this.ach.cursor];
    if (sel) label(ctx, `${sel.name}: ${sel.desc}`, W / 2, 404, { size: 16, align: 'center' });

    // Sammlung seltener Fracht
    const seen = p.data.rareSeen;
    label(ctx, 'Seltene Fracht:', 48, 434, { size: 13, color: '#bfe8ff', outline: null });
    let x = 160;
    for (const r of RARE) {
      const known = !!seen[r.id];
      const text = known ? r.name : '???';
      ctx.font = `bold 12px ${FONT}`;
      const w = ctx.measureText(text).width;
      if (x + w > W - 40) break;
      label(ctx, text, x, 434, { size: 12, color: known ? '#ffd23f' : '#6b7682', outline: null });
      x += w + 18;
    }
    button(ctx, BACK_BTN, 'Zurück', this.ach.cursor === rects.length - 1);
    hint(ctx, t, 'Pfeiltasten: ansehen   ·   Esc: zurück');
  }

  // ---------- Optionen ----------

  optRows() {
    const left = ['volume', 'easy', 'ghost', 'resetKeys', 'back'];
    const right = Object.keys(KEY_NAMES);
    return [
      ...left.map((id, i) => ({ id, rect: { x: 90, y: 110 + i * 56, w: 370, h: 46 } })),
      ...right.map((id, i) => ({ id: `key:${id}`, rect: { x: 500, y: 110 + i * 50, w: 370, h: 42 } })),
    ];
  }

  // Gibt true zurück, wenn die Optionen verlassen werden
  updateOptions(presses, action, tap) {
    if (this.opt.waiting) return false;
    const rows = this.optRows();
    const cur = rows[this.opt.cursor];
    // Lautstärke mit links/rechts ändern statt die Spalte zu wechseln
    if (cur?.id === 'volume') {
      for (const k of presses) {
        if (k !== 'left' && k !== 'right') continue;
        settings.volume = clamp(Math.round((settings.volume + (k === 'left' ? -0.1 : 0.1)) * 10) / 10, 0, 1);
        setVolume(settings.volume);
        saveSettings();
        sfx.move();
      }
      presses = presses.filter(k => k !== 'left' && k !== 'right');
    }
    const hit = navigate(this.opt, rows.map(r => r.rect), presses, action, tap);
    if (hit === null) return false;
    const id = rows[hit].id;
    if (id === 'back') return true;
    if (id === 'volume' && tap) {
      const r = rows[hit].rect;
      settings.volume = clamp(Math.round(((tap.x - r.x - 150) / 200) * 10) / 10, 0, 1);
      setVolume(settings.volume);
    } else if (id === 'easy') settings.easy = !settings.easy;
    else if (id === 'ghost') settings.ghost = !settings.ghost;
    else if (id === 'resetKeys') resetKeys();
    else if (id.startsWith('key:')) {
      const action = id.slice(4);
      this.opt.waiting = action;
      this.input.captureNext(code => {
        this.opt.waiting = null;
        if (code === 'Escape') return;
        // Taste von anderen Aktionen lösen, dann als erste Taste belegen
        for (const codes of Object.values(settings.keys)) {
          const j = codes.indexOf(code);
          if (j >= 0) codes.splice(j, 1);
        }
        settings.keys[action] = [code, ...settings.keys[action].filter(c => c !== code)].slice(0, 2);
        saveSettings();
        sfx.buy();
      });
      return false;
    }
    saveSettings();
    sfx.move();
    return false;
  }

  drawOptions(ctx, t) {
    header(ctx, 'Optionen', null);
    const rows = this.optRows();
    rows.forEach((row, i) => {
      const r = row.rect;
      const focus = this.opt.cursor === i;
      if (row.id === 'back') { button(ctx, r, 'Zurück', focus); return; }
      panel(ctx, r, { fill: 'rgba(35, 57, 91, 0.92)', focus, radius: 10 });
      const y = r.y + r.h / 2 + 6;
      if (row.id === 'volume') {
        label(ctx, 'Lautstärke', r.x + 14, y, { size: 16, outline: null });
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(r.x + 150, r.y + r.h / 2 - 5, 200, 10);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(r.x + 150, r.y + r.h / 2 - 5, 200 * settings.volume, 10);
        label(ctx, `${Math.round(settings.volume * 100)} %`, r.x + 250, r.y + r.h / 2 - 9, { size: 11, color: '#c9d4de', align: 'center', outline: null });
      } else if (row.id === 'easy') {
        label(ctx, 'Einsteigermodus', r.x + 14, y, { size: 16, outline: null });
        label(ctx, settings.easy ? 'AN' : 'aus', r.x + r.w - 14, y, { size: 16, color: settings.easy ? '#7ee081' : '#9aa6b2', align: 'right', outline: null });
      } else if (row.id === 'ghost') {
        label(ctx, 'Rekord-Geist zeigen', r.x + 14, y, { size: 16, outline: null });
        label(ctx, settings.ghost ? 'AN' : 'aus', r.x + r.w - 14, y, { size: 16, color: settings.ghost ? '#7ee081' : '#9aa6b2', align: 'right', outline: null });
      } else if (row.id === 'resetKeys') {
        label(ctx, 'Standard-Tasten wiederherstellen', r.x + 14, y, { size: 16, outline: null });
      } else {
        const action = row.id.slice(4);
        label(ctx, KEY_NAMES[action], r.x + 14, y, { size: 15, outline: null });
        const text = this.opt.waiting === action ? 'Taste drücken …' : settings.keys[action].map(keyLabel).join(' / ');
        label(ctx, text, r.x + r.w - 14, y, { size: 15, color: this.opt.waiting === action ? '#ffd23f' : '#bfe8ff', align: 'right', outline: null });
      }
    });
    label(ctx, 'Einsteigermodus: mehr Dämpfung, größere Greifweite, der Chef ärgert sich nur halb so doll.', W / 2, 488, { size: 13, color: '#c9d4de', align: 'center', outline: null });
    hint(ctx, t, this.opt.waiting ? 'Neue Taste drücken   ·   Esc: abbrechen' : 'Pfeiltasten: wählen   ·   ◀ ▶: Lautstärke   ·   Leertaste: ändern   ·   Esc: zurück');
  }

  // ---------- Pause ----------

  pauseRects() {
    return ['Weiter', 'Neustart', 'Optionen', 'Schicht abbrechen'].map((text, i) => ({ x: W / 2 - 140, y: 190 + i * 62, w: 280, h: 50, text }));
  }

  // Gibt 'resume' | 'restart' | 'options' | 'quit' | null zurück
  updatePause(presses, action, tap) {
    const hit = navigate(this.pause, this.pauseRects(), presses, action, tap);
    return hit === null ? null : ['resume', 'restart', 'options', 'quit'][hit];
  }

  drawPause(ctx, t) {
    ctx.fillStyle = 'rgba(8, 20, 35, 0.72)';
    ctx.fillRect(0, 0, W, H);
    label(ctx, 'Pause', W / 2, 150, { size: 48, color: '#ffd23f', align: 'center', outline: 'rgba(0,0,0,0.8)' });
    this.pauseRects().forEach((r, i) => button(ctx, r, r.text, this.pause.cursor === i));
    hint(ctx, t, 'Esc / P: weiter');
  }
}
