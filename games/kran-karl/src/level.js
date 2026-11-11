import { mulberry32 } from './config.js';

// mode: 'load' = Schiff beladen, 'unload' = Schiff löschen (auf den Lkw am Kai), 'toss' = Feierabend-Weitwurf
// events: fog | night | swarm | boat | storm | tide | inspector | floes | snowstorm | monsoon | monkeys | zone
// stackRule: schwer nicht auf leicht · reefers: Anteil Kühlcontainer · feeder: zweites, kleines Schiff
// slippery: glattes Deck (im Eishafen immer, beim Monsun automatisch)
const L = (name, mode, time, goal, wave, wind, gulls, opts = {}) => ({
  name, mode, time, goal, wave, wind, gulls,
  heel: false, plan: false, events: [], stackRule: false, reefers: 0, feeder: false, slippery: false, ...opts,
});

export const CHAPTERS = [
  {
    harbor: 'hafen',
    name: 'Heimathafen',
    events: ['fog', 'swarm', 'night', 'boat', 'storm', 'tide', 'inspector', 'zone'],
    levels: [
      L('Ententeich', 'load', 100, 5, 2, 0, 1),
      L('Retourenwelle', 'unload', 100, 5, 2, 0, 1),
      L('Leichter Seegang', 'load', 105, 7, 4, 0, 2, { plan: true }),
      L('Nebelbank', 'unload', 105, 6, 4, 40, 1, { events: ['fog'] }),
      L('Schlagseite', 'load', 115, 9, 6, 60, 2, { heel: true, plan: true }),
      L('Möwen-Alarm', 'unload', 115, 8, 6, 80, 2, { heel: true, events: ['swarm', 'zone'] }),
      L('Nachtschicht', 'load', 125, 11, 7, 100, 2, { heel: true, plan: true, events: ['night'] }),
      L('Querverkehr', 'unload', 125, 10, 8, 120, 3, { heel: true, events: ['boat'] }),
      L('Sturmflut', 'load', 135, 13, 10, 140, 3, { heel: true, plan: true, events: ['storm'] }),
    ],
  },
  {
    harbor: 'eis',
    name: 'Eiskante',
    events: ['floes', 'snowstorm', 'night', 'tide', 'inspector', 'swarm', 'fog', 'zone'],
    base: { slippery: true, heel: true },
    levels: [
      L('Frostbeulen', 'load', 105, 7, 3, 30, 1),
      L('Eisbrecher', 'unload', 105, 7, 4, 40, 1, { events: ['floes'] }),
      L('Schwer auf leicht', 'load', 115, 9, 5, 60, 2, { plan: true, stackRule: true }),
      L('Ebbe & Flut', 'unload', 115, 8, 5, 70, 2, { events: ['tide'] }),
      L('Feeder Frieda', 'load', 120, 12, 6, 80, 2, { feeder: true }),
      L('Schneesturm', 'unload', 120, 9, 7, 100, 2, { events: ['snowstorm'] }),
      L('Polarnacht', 'load', 130, 13, 7, 110, 2, { plan: true, stackRule: true, feeder: true, events: ['night', 'zone'] }),
      L('Treibeis', 'unload', 130, 11, 8, 120, 3, { events: ['floes', 'tide'] }),
      L('Eiszeit', 'load', 140, 15, 10, 140, 3, { plan: true, stackRule: true, feeder: true, events: ['snowstorm'] }),
    ],
  },
  {
    harbor: 'tropen',
    name: 'Palmenkai',
    events: ['monkeys', 'monsoon', 'night', 'tide', 'inspector', 'boat', 'swarm', 'zone'],
    base: { heel: true },
    levels: [
      L('Kokosnuss-Express', 'load', 105, 8, 3, 30, 1, { reefers: 0.25 }),
      L('Affentheater', 'unload', 110, 8, 4, 40, 1, { events: ['monkeys'] }),
      L('Kühlkette', 'load', 115, 10, 5, 60, 2, { plan: true, reefers: 0.3 }),
      L('Der Inspektor', 'unload', 115, 9, 6, 70, 2, { events: ['inspector'] }),
      L('Monsun', 'load', 125, 11, 7, 100, 2, { plan: true, events: ['monsoon'] }),
      L('Doppelt hält besser', 'load', 125, 13, 7, 100, 2, { feeder: true, reefers: 0.25, events: ['zone'] }),
      L('Springflut', 'unload', 130, 11, 8, 120, 3, { events: ['tide', 'monkeys'] }),
      L('Tropennacht', 'load', 130, 13, 8, 120, 3, { plan: true, reefers: 0.25, events: ['night', 'inspector'] }),
      L('Hurrikan Hildegard', 'load', 140, 15, 11, 150, 3, { plan: true, stackRule: true, reefers: 0.2, events: ['monsoon', 'boat'] }),
    ],
  },
];

export const CHAPTER_COUNT = CHAPTERS.length;
export const LEVELS_PER_CHAPTER = 9;

// Höchstens ein Wetter- und ein Wasser-Event gleichzeitig; Feeder braucht die Wasserlücke für sich
const SKY = ['fog', 'night', 'storm', 'snowstorm', 'monsoon'];
const WATER = ['boat', 'floes'];
const compatible = (list, e) => !list.includes(e)
  && !(SKY.includes(e) && list.some(x => SKY.includes(x)))
  && !(WATER.includes(e) && list.some(x => WATER.includes(x)));

// Zieht n verträgliche Events aus pool
export function pickEvents(pool, n, r) {
  const out = [];
  for (let tries = 0; out.length < n && tries < 40; tries++) {
    const e = pool[Math.floor(r() * pool.length)];
    if (compatible(out, e)) out.push(e);
  }
  return out;
}

// Schlüssel: "2-5" = Kapitel 2, Schicht 5 · "2-E3" = Kapitel 2, Endlos-Stufe 3 · "daily-20261110"
export function parseKey(key) {
  const m = /^(\d+)-(E?)(\d+)$/.exec(key);
  if (!m) return null;
  return { chapter: Number(m[1]), endless: m[2] === 'E', i: Number(m[3]) };
}

export const levelKey = (chapter, i) => `${chapter}-${i}`;
export const endlessKey = (chapter, depth) => `${chapter}-E${depth}`;

// Kapitel-Vorgaben (z. B. glattes Deck im Eishafen) gelten, wenn die Schicht sie nicht selbst setzt
function finish(lv, chapter, key) {
  const ch = CHAPTERS[chapter - 1];
  const out = { ...lv, key, chapter, harbor: ch.harbor };
  for (const [k, v] of Object.entries(ch.base || {})) out[k] = lv[k] || v;
  if (out.events.includes('monsoon')) out.slippery = true;
  // Feeder nur beim Laden und nicht zusammen mit Barkasse/Eisschollen
  if (out.mode !== 'load' || out.events.some(e => WATER.includes(e))) out.feeder = false;
  return out;
}

function endless(chapter, depth) {
  const ch = CHAPTERS[chapter - 1];
  const r = mulberry32(chapter * 1000 + depth);
  const unload = depth % 2 === 1;
  const events = pickEvents(ch.events, depth >= 2 ? 2 : 1, r);
  return finish({
    ...L(`${ch.name} +${depth}`, unload ? 'unload' : 'load', 140,
      // beim Löschen passen höchstens 24 Container aufs Schiff (Ziel + 3)
      unload ? Math.min(16, 10 + depth) : Math.min(17, 13 + depth),
      Math.min(14, 10 + depth), Math.min(190, 140 + 10 * depth), 3, {
        heel: true,
        plan: !unload,
        stackRule: chapter >= 2 && depth >= 2,
        reefers: chapter === 3 && !unload ? 0.2 : 0,
        feeder: chapter >= 2 && !unload && depth % 4 === 2,
        events,
      }),
    n: depth,
    endless: true,
  }, chapter, endlessKey(chapter, depth));
}

// Tagesschicht: aus dem Datum gewürfelt, für alle gleich (darum unabhängig vom Spielstand)
export function dailyLevel(date) {
  const seed = dailySeed(date);
  const r = mulberry32(seed);
  const chapter = 1 + Math.floor(r() * CHAPTER_COUNT);
  const ch = CHAPTERS[chapter - 1];
  const unload = r() < 0.45;
  const events = pickEvents(ch.events, r() < 0.5 ? 2 : 1, r);
  const goal = unload ? 9 + Math.floor(r() * 4) : 11 + Math.floor(r() * 4);
  return finish({
    ...L(`Tagesschicht ${date.slice(6, 8)}.${date.slice(4, 6)}.`, unload ? 'unload' : 'load', 130, goal,
      5 + Math.floor(r() * 5), 60 + Math.floor(r() * 80), 2 + Math.floor(r() * 2), {
        heel: true,
        plan: !unload && r() < 0.6,
        stackRule: chapter >= 2 && r() < 0.5,
        reefers: chapter === 3 && !unload ? 0.2 : 0,
        feeder: !unload && r() < 0.35,
        events,
      }),
    daily: true,
    seed,
  }, chapter, `daily-${date}`);
}

export const dailySeed = date => Number(date);

export const TOSS_THROWS = 10;

// Feierabend-Weitwurf: zehn Container, kein Schiff, kein Zeitlimit; Wind, Ziele und Fracht aus dem Datum
export function tossLevel(date) {
  const seed = Number(date) * 3 + 1;
  const r = mulberry32(seed);
  return finish({
    ...L('Feierabend-Weitwurf', 'toss', 0, TOSS_THROWS, 3 + Math.floor(r() * 4), 40 + Math.floor(r() * 90), 1 + Math.floor(r() * 2)),
    toss: true,
    seed,
  }, 1, `toss-${date}`);
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function getLevel(key) {
  if (key.startsWith('daily-')) return dailyLevel(key.slice(6));
  if (key.startsWith('toss-')) return tossLevel(key.slice(5));
  const p = parseKey(key);
  if (!p) return getLevel('1-1');
  if (p.endless) return endless(p.chapter, p.i);
  const ch = CHAPTERS[p.chapter - 1];
  return finish({ ...ch.levels[p.i - 1], n: p.i }, p.chapter, key);
}
