// ASCII-Sprites: jedes Zeichen ist ein Palettenschlüssel, '.' ist transparent
import { C } from './palette.js';
import { makeCanvas } from './draw.js';

export function bake(rows, cmap, flip = false) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const [c, ctx] = makeCanvas(w, h);
  rows.forEach((row, j) => {
    let chars = [...row.padEnd(w, '.')];
    if (flip) chars = chars.reverse();
    chars.forEach((ch, i) => {
      if (ch !== '.' && cmap[ch]) { ctx.fillStyle = cmap[ch]; ctx.fillRect(i, j, 1, 1); }
    });
  });
  return c;
}

// Einfarbige Silhouette (für Treffer-Blitz und Glitch)
export function silhouette(rows, col, flip = false) {
  return bake(rows, new Proxy({}, { get: () => col }), flip);
}

// Baut Lauf-Frames aus Oberkörper + Beinvarianten, je Frame rechts- und linksblickend
export function walkFrames(body, legs, cmap) {
  return legs.map((l) => {
    const rows = [...body, ...l];
    return { r: bake(rows, cmap), l: bake(rows, cmap, true), rows };
  });
}

// ---------- Killjoy (Draufsicht, frontal) ----------
export const KJ_BODY = [
  '...kkkk...',
  '..khhhhk..',
  '.khhhhhhk.',
  '.khmmmmhk.',
  '.kssssssk.',
  '..kssssk..',
  '.kjjttjjk.',
  'kjjjttjjjk',
  'kjJjttjJjk',
  'ksjjttjjsk',
  '.kjjjjjjk.',
  '..kppppk..',
];
export const KJ_LEGS = [
  ['..kp..pk..', '..kp..pk..', '.kkk..kkk.'],
  ['..kp..pk..', '.kkk..pk..', '......kkk.'],
  ['..kp..pk..', '..kp..kkk.', '.kkk......'],
];
export function kjMap(hair, jacket, jdark, mask, gun) {
  return { k: C.ink, h: hair, m: mask, s: C.skin, j: jacket, J: jdark, t: C.paper, p: C.denim, g: gun };
}

// ---------- Killjoy (Seitenansicht, für Highway Shootout) ----------
export const KJ_SIDE = [
  '....kkkk....',
  '...khhhhhk..',
  '..khhhhhhhk.',
  '..kmmmmshhhk',
  '..kssssshhk.',
  '...ksssshk..',
  '....kjjjjk..',
  'kgggggkjjjk.',
  'kgggkskjtjk.',
  '.kk..kjjjjk.',
  '.....kjjjjk.',
  '....kppppk..',
  '...kpp.kpk..',
  '..kpk..kpk..',
  '..kkk..kkk..',
];

// ---------- Draculoid ----------
export const DRAC_BODY = [
  '...kkkk...',
  '..kwwwwk..',
  '.kwwwwwwk.',
  '.kwkwwkwk.',
  '.kwwwwwwk.',
  '..kwkkwk..',
  '.kwwwwwwk.',
  'kwwwkkwwwk',
  'kwGwkkwGwk',
  'kGwwkkwwGk',
  '.kwwwwwwk.',
  '..kGGGGk..',
];
export const DRAC_LEGS = [
  ['..kG..Gk..', '..kG..Gk..', '.kkk..kkk.'],
  ['..kG..Gk..', '.kkk..Gk..', '......kkk.'],
  ['..kG..Gk..', '..kG..kkk.', '.kkk......'],
];
export const DRAC_MAP = { k: C.ink, w: C.white, G: C.grey };

// ---------- Agent im schwarzen Anzug (Boss) ----------
export const BOSS = [
  '.....kkkk.....',
  '....kssssk....',
  '...kssssssk...',
  '...kkkkkkkk...',
  '...kssssssk...',
  '....kssssk....',
  '...kkwwwwkk...',
  '..kbbwrrwbbk..',
  '.kbbbbrrbbbbk.',
  'kbbbbbrrbbbbbk',
  'kbsbbbbbbbbsbk',
  'kskbbbbbbbbksk',
  '.k.kbbbbbbk.k.',
  '...kbbkkbbk...',
  '...kbbk.kbbk..',
  '...kbbk.kbbk..',
  '..kkkkk.kkkkk.',
];
export const BOSS_MAP = { k: C.ink, s: C.pale, w: C.white, r: C.r, b: C.suit };

// ---------- Drac-Motorrad ----------
export const BIKE = [
  '......kkkk......',
  '.....kwwwwk.....',
  '.....kwkwkk.....',
  '......kwwk...k..',
  '....kkwwwwkkkk..',
  '..kkbkwwwwkbbbk.',
  '.kbbbbbbbbbbbbbk',
  'kkkk.kbbbbk.kkkk',
  'kGGk..kkkk..kGGk',
  'kkkk........kkkk',
];
export const BIKE_MAP = { k: C.ink, w: C.white, b: C.black, G: C.grey };

// ---------- Überwachungsdrohne ----------
export const DRONE = [
  'kkk.....kkk',
  '..k.kkk.k..',
  '...kwwwk...',
  '..kwwrwwk..',
  '...kwwwk...',
  '....kkk....',
];
export const DRONE_MAP = { k: C.ink, w: C.white, r: C.r };

// ---------- Kleinkram ----------
export const CAN = ['.kkkk.', 'kGGGGk', 'krrrrk', 'krwwrk', 'krrrrk', 'kGGGGk', '.kkkk.'];
export const CAN_MAP = { k: C.ink, G: C.grey, r: C.r, w: C.paper };
export const HEART = ['.kk.kk.', 'kppkppk', 'kpppppk', '.kpppk.', '..kpk..', '...k...'];
export const SPIDER = ['k.k.k.k', '.kkkkk.', 'k.kkk.k', '.k.k.k.'];
