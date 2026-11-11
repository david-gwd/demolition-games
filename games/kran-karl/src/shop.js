const DAMPING_STEPS = [0.2, 0.35, 0.5, 0.7];

export const UPGRADES = [
  { id: 'damper', name: 'Pendeldämpfer', desc: 'Haken und Ladung pendeln schneller aus.', costs: [60, 120, 200] },
  { id: 'trolley', name: 'Turbo-Laufkatze', desc: 'Laufkatze fährt 12 % schneller pro Stufe.', costs: [80, 160] },
  { id: 'magnet', name: 'Magnetgreifer', desc: 'Greift auch aus größerem Abstand.', costs: [50, 100] },
  { id: 'insurance', name: 'Kneipenversicherung', desc: 'Kneipentreffer kosten keine Punkte.', costs: [90] },
  { id: 'spreader', name: 'Doppel-Spreader', desc: 'Taste E: zwei Container auf einmal greifen.', costs: [250] },
  { id: 'lights', name: 'Nachtscheinwerfer', desc: 'Mehr Licht bei Nacht, weniger Nebel/Schnee.', costs: [90, 170] },
  { id: 'anemometer', name: 'Windmesser', desc: 'Böen, Schwärme und Boote früher ansagen.', costs: [110] },
  { id: 'ropebrake', name: 'Seilbremse', desc: 'Seil einholen schaukelt weniger auf.', costs: [100, 180] },
  { id: 'aim', name: 'Wurfvisier', desc: 'Zeigt den Anfang der Flugbahn beim Werfen.', costs: [120, 220] },
];
const AIM_STEPS = [0, 0.3, 0.55]; // Sekunden Flugbahn, die das Visier vorausrechnet

// Spielwerte, die sich aus den gekauften Upgrades (und dem Einsteigermodus) ergeben
export function getMods(upgrades = {}, easy = false) {
  return {
    damping: DAMPING_STEPS[upgrades.damper || 0] + (easy ? 0.25 : 0),
    speed: 1 + 0.12 * (upgrades.trolley || 0),
    grabBonus: 12 * (upgrades.magnet || 0) + (easy ? 12 : 0),
    insured: !!upgrades.insurance,
    spreader: !!upgrades.spreader,
    lights: [1, 1.3, 1.6][upgrades.lights || 0],
    clearSight: 0.125 * (upgrades.lights || 0),
    earlyWarn: upgrades.anemometer ? 1.5 : 0,
    anemometer: !!upgrades.anemometer,
    ropeBrake: upgrades.ropebrake || 0,
    aim: AIM_STEPS[upgrades.aim || 0],
    moodMul: easy ? 0.5 : 1,
  };
}

export function nextCost(progress, up) {
  const lvl = progress.upgrades[up.id] || 0;
  return lvl < up.costs.length ? up.costs[lvl] : null;
}

export function buy(progress, up) {
  const cost = nextCost(progress, up);
  if (cost === null || !progress.spend(cost)) return false;
  progress.upgrades[up.id] = (progress.upgrades[up.id] || 0) + 1;
  progress.save();
  return true;
}

// Kosmetik: Kranlack, Karls Hut, Kneipen-Deko
export const SLOTS = [
  { id: 'crane', name: 'Kranlack' },
  { id: 'hat', name: 'Karls Hut' },
  { id: 'deco', name: 'Kneipen-Deko' },
];

export const COSMETICS = [
  { id: 'crane:classic', slot: 'crane', name: 'Klassik-Orange', cost: 0, paint: { beam: '#e8672f', leg: '#d9542b', line: '#a83c1c', trolley: '#f2b134' } },
  { id: 'crane:blue', slot: 'crane', name: 'Hafenblau', cost: 120, paint: { beam: '#3478c0', leg: '#2b67a8', line: '#1b4170', trolley: '#6aaee8' } },
  { id: 'crane:flamingo', slot: 'crane', name: 'Flamingo', cost: 150, paint: { beam: '#f06ba8', leg: '#dd5893', line: '#a83a6b', trolley: '#ffa8d2' } },
  { id: 'crane:camo', slot: 'crane', name: 'Tarnmuster', cost: 180, paint: { beam: '#66733f', leg: '#55612f', line: '#2f381c', trolley: '#8d9c5d', camo: '#3d4626' } },
  { id: 'crane:gold', slot: 'crane', name: 'Gold', cost: 400, paint: { beam: '#d4af37', leg: '#bf9b2c', line: '#7d6518', trolley: '#f2d16b' } },
  { id: 'hat:none', slot: 'hat', name: 'Ohne Hut', cost: 0 },
  { id: 'hat:captain', slot: 'hat', name: 'Kapitänsmütze', cost: 80 },
  { id: 'hat:beanie', slot: 'hat', name: 'Pudelmütze', cost: 80 },
  { id: 'hat:straw', slot: 'hat', name: 'Strohhut', cost: 100 },
  { id: 'hat:antenna', slot: 'hat', name: 'Antennenhelm', cost: 150 },
  { id: 'hat:crown', slot: 'hat', name: 'Krone', cost: 350 },
  { id: 'deco:none', slot: 'deco', name: 'Keine Deko', cost: 0 },
  { id: 'deco:lights', slot: 'deco', name: 'Lichterkette', cost: 100 },
  { id: 'deco:flowers', slot: 'deco', name: 'Blumenkasten', cost: 90 },
  { id: 'deco:neon', slot: 'deco', name: 'Neon-Schild', cost: 160 },
];

export const cosmetic = id => COSMETICS.find(c => c.id === id);

// Angelegtes Aussehen: { paint, hat, deco }
export function getLook(progress) {
  const eq = progress.data.cosmetics.equipped;
  return {
    paint: (cosmetic(eq.crane) || COSMETICS[0]).paint,
    hat: (eq.hat || 'hat:none').slice(4),
    deco: (eq.deco || 'deco:none').slice(5),
  };
}

// Kaufen (falls nötig) und anlegen; gibt 'equip' | 'buy' | false zurück
export function useCosmetic(progress, item) {
  const c = progress.data.cosmetics;
  if (!c.owned.includes(item.id)) {
    if (!progress.spend(item.cost)) return false;
    c.owned.push(item.id);
    c.equipped[item.slot] = item.id;
    progress.save();
    return 'buy';
  }
  c.equipped[item.slot] = item.id;
  progress.save();
  return 'equip';
}
