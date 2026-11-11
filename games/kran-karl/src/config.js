// Logische Spielfeldgröße und Weltkonstanten (alles in Pixeln bzw. px/s²)
export const W = 960;
export const H = 540;
export const GRAVITY = 900;

export const SEA_Y = 430;
export const GROUND_Y = 380;
export const BOX_W = 60;
export const BOX_H = 28;

export const GANTRY_Y = 62;
export const TROLLEY_MIN = 45;
export const TROLLEY_MAX = 915;

export const QUAY_X1 = 190;
export const STACK_X = 100;
export const PIER_X0 = 840;
export const PUB = { x0: 852, x1: 930, y0: 300, y1: GROUND_Y };

export const SHIP_DECK_LEFT = 430;
export const SHIP_DECK_Y = 404;

// Sterne: Anteil der Restzeit beim Erreichen des Solls bzw. Anteil perfekter Landungen
export const STAR_TIME = 0.25;
export const STAR_PERFECT = 0.4;

// Würfe: ein Container (60 px) ist gut 12 m lang. Ab THROW_MIN_M zählt ein Wurf als Weitwurf.
export const PX_PER_M = 5;
export const THROW_MIN_M = 30;
export const throwMeters = (b, x) => (b.thrown ? Math.abs(x - b.fromX) / PX_PER_M : 0);

// Zufall mit Seed (für die Tagesschicht). Zwei getrennte Ströme, damit die Fracht-Reihenfolge
// nicht davon abhängt, wie oft das Spiel sonst gewürfelt hat.
export function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let mainRng = Math.random;
let cargoRng = Math.random;

// n = null: wieder echter Zufall
export function setSeed(n) {
  mainRng = n == null ? Math.random : mulberry32(n);
  cargoRng = n == null ? Math.random : mulberry32(n * 7 + 13);
}

export const rnd = () => mainRng();
export const crnd = () => cargoRng();

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rand = (a, b) => a + rnd() * (b - a);
export const pick = arr => arr[Math.floor(rnd() * arr.length)];
// nur für Optik und Sprüche – verbraucht keinen Seed-Zufall
export const frand = (a, b) => a + Math.random() * (b - a);
export const fpick = arr => arr[Math.floor(Math.random() * arr.length)];
