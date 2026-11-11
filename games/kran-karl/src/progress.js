import { parseKey, LEVELS_PER_CHAPTER, CHAPTER_COUNT } from './level.js';

const KEY = 'kran-karl-progress';
const VERSION = 2;

const fresh = () => ({
  version: VERSION,
  unlocked: { 1: 1 }, // höchste freigeschaltete Schicht je Kapitel
  endless: {}, // höchste freigeschaltete Endlos-Stufe je Kapitel
  promoted: {}, // Kapitel, deren Beförderung schon gefeiert wurde
  stars: {},
  best: {},
  coins: 0,
  upgrades: {},
  cosmetics: { owned: ['crane:classic', 'hat:none', 'deco:none'], equipped: { crane: 'crane:classic', hat: 'hat:none', deco: 'deco:none' } },
  achievements: {},
  stats: {},
  pubClean: {}, // je Kapitel: Schichten, die ohne Kneipentreffer gewonnen wurden
  rareSeen: {},
  notes: {}, // gelesene Zettel vom Chef
  daily: { date: '', best: 0 },
  toss: { date: '', best: 0, allTime: 0 }, // Feierabend-Weitwurf: Bestwert heute und für immer
});

// Spielstand der ersten Version: Schichten 1..9, darüber Endlos-Schichten
function migrate(old) {
  const d = fresh();
  d.coins = old.coins || 0;
  d.upgrades = old.upgrades || {};
  const u = old.unlocked || 1;
  d.unlocked[1] = Math.min(u, LEVELS_PER_CHAPTER);
  if (u > LEVELS_PER_CHAPTER) {
    d.endless[1] = u - LEVELS_PER_CHAPTER;
    // Kapitel 1 war schon geschafft: die Beförderung wird beim nächsten Schichtplan nachgeholt
    d.unlocked[2] = 1;
  }
  const key = n => (n <= LEVELS_PER_CHAPTER ? `1-${n}` : `1-E${n - LEVELS_PER_CHAPTER}`);
  for (const [n, v] of Object.entries(old.stars || {})) d.stars[key(Number(n))] = v;
  for (const [n, v] of Object.entries(old.best || {})) d.best[key(Number(n))] = v;
  return d;
}

// Dauerhafter Fortschritt: Sterne, Bestwerte, Lohn, Werkstatt, Kosmetik, Abzeichen
export class Progress {
  constructor() {
    this.data = fresh();
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && typeof raw === 'object') {
        this.data = raw.version === VERSION ? { ...fresh(), ...raw } : migrate(raw);
        this.save();
      }
    } catch { /* egal */ }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* egal */ }
  }

  get coins() { return this.data.coins; }
  get upgrades() { return this.data.upgrades; }
  get stats() { return this.data.stats; }

  unlockedIn(chapter) { return this.data.unlocked[chapter] || 0; }
  endlessIn(chapter) { return this.data.endless[chapter] || 0; }
  chapterOpen(chapter) { return this.unlockedIn(chapter) > 0; }
  openChapters() {
    let n = 0;
    for (let c = 1; c <= CHAPTER_COUNT; c++) if (this.chapterOpen(c)) n = c;
    return n;
  }

  isUnlocked(key) {
    if (key.startsWith('daily-')) return true;
    const p = parseKey(key);
    if (!p) return false;
    return p.endless ? p.i <= this.endlessIn(p.chapter) : p.i <= this.unlockedIn(p.chapter);
  }

  starsFor(key) { return this.data.stars[key] || 0; }
  bestFor(key) { return this.data.best[key] || 0; }
  totalStars() { return Object.values(this.data.stars).reduce((a, b) => a + b, 0); }

  addCoins(n) {
    this.data.coins += n;
    this.save();
  }

  // Trägt das Ergebnis einer Schicht ein.
  // Gibt { newRecord, promoted } zurück; promoted = Kapitelnummer, wenn das Kapitel gerade erstmals geschafft wurde
  record(level, { won, stars, score, coins }) {
    const d = this.data;
    const key = level.key;
    let promoted = null;
    if (level.daily) {
      const first = d.daily.date !== key;
      if (first) {
        d.daily = { date: key, best: 0 };
        d.stats.dailies = (d.stats.dailies || 0) + 1;
      }
      // Lohn ×1,5 beim ersten Mal am Tag
      d.coins += first ? Math.round(coins * 1.5) : coins;
      const newRecord = score > d.daily.best;
      if (newRecord) d.daily.best = score;
      this.save();
      return { newRecord, promoted, first };
    }

    d.coins += coins;
    const count = stars.filter(Boolean).length;
    if (count > this.starsFor(key)) d.stars[key] = count;
    if (won) {
      const { chapter, endless, i } = parseKey(key);
      if (endless) {
        d.endless[chapter] = Math.max(this.endlessIn(chapter), i + 1);
      } else {
        d.unlocked[chapter] = Math.max(this.unlockedIn(chapter), Math.min(LEVELS_PER_CHAPTER, i + 1));
        if (i === LEVELS_PER_CHAPTER) {
          d.endless[chapter] = Math.max(1, this.endlessIn(chapter));
          if (chapter < CHAPTER_COUNT) d.unlocked[chapter + 1] = Math.max(1, this.unlockedIn(chapter + 1));
          if (!d.promoted[chapter]) {
            d.promoted[chapter] = true;
            promoted = chapter;
          }
        }
      }
    }
    const newRecord = score > this.bestFor(key);
    if (newRecord) d.best[key] = score;
    this.save();
    return { newRecord, promoted };
  }

  // Feierabend-Weitwurf: kein Lohn, nur Rekorde. Gibt { newRecord, allTime } zurück.
  recordToss(level, score, longest) {
    const t = this.data.toss;
    if (t.date !== level.key) Object.assign(t, { date: level.key, best: 0 });
    const newRecord = score > t.best;
    if (newRecord) t.best = score;
    const allTime = score > t.allTime;
    if (allTime) t.allTime = score;
    const s = this.data.stats;
    s.longestThrow = Math.max(s.longestThrow || 0, longest);
    this.save();
    return { newRecord, allTime };
  }

  // Lebenszeit-Statistik aus den Zählern einer Schicht
  addStats(shift, won) {
    const s = this.data.stats;
    for (const [k, v] of Object.entries(shift)) {
      if (k === 'maxCombo' || k === 'longestThrow') s[k] = Math.max(s[k] || 0, v);
      else if (typeof v === 'number') s[k] = (s[k] || 0) + v;
    }
    s.shifts = (s.shifts || 0) + 1;
    if (won) s.wins = (s.wins || 0) + 1;
    s.animalStreak = won && !shift.gullHits ? (s.animalStreak || 0) + 1 : 0;
    this.save();
  }

  // Kapitel, das geschafft, aber noch nicht gefeiert wurde (z. B. nach der Migration)
  pendingPromotion() {
    for (let c = 1; c < CHAPTER_COUNT; c++) {
      if (this.chapterOpen(c + 1) && !this.data.promoted[c]) return c;
    }
    return null;
  }

  markPromoted(c) {
    this.data.promoted[c] = true;
    this.save();
  }

  spend(amount) {
    if (amount > this.data.coins) return false;
    this.data.coins -= amount;
    this.save();
    return true;
  }
}
