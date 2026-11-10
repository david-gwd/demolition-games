import { RARE } from './content.js';
import { LEVELS_PER_CHAPTER } from './level.js';

// s = Zähler der laufenden Schicht, life = Lebenszeit-Statistik, x = { won, level, result, progress }
// live: kann schon während der Schicht freigeschaltet werden (nur Schicht-Zähler)
export const ACHIEVEMENTS = [
  { id: 'combo5', name: 'Taktgefühl', desc: '5er-Combo in einer Schicht', coins: 30, live: true, test: s => s.maxCombo >= 5 },
  { id: 'combo10', name: 'Kranflüsterer', desc: '10er-Combo in einer Schicht', coins: 80, live: true, test: s => s.maxCombo >= 10 },
  { id: 'dry', name: 'Trockendock', desc: 'Schicht gewonnen, nichts im Wasser', coins: 40, test: (s, l, x) => x.won && !s.splashes && !s.iced },
  { id: 'clean', name: 'Saubere Arbeit', desc: 'Gewonnen ohne Platsch, Tier und Kneipe', coins: 60, test: (s, l, x) => x.won && !s.splashes && !s.gullHits && !s.pubHits && !s.iced },
  { id: 'stars3', name: 'Musterschüler', desc: 'Alle 3 Sterne in einer Schicht', coins: 50, test: (s, l, x) => x.result.stars.every(Boolean) },
  { id: 'ducks1', name: 'Quietscheentchen', desc: 'Die ersten Gummienten befreit', coins: 10, live: true, test: s => s.ducks > 0 },
  { id: 'ducks100', name: 'Entenbefreier', desc: '100 Gummienten befreit (insgesamt)', coins: 80, test: (s, l) => (l.ducks || 0) >= 100 },
  { id: 'animals', name: 'Tierfreund', desc: '5 Siege in Folge ohne Tiertreffer', coins: 60, test: (s, l) => (l.animalStreak || 0) >= 5 },
  { id: 'pubHit', name: 'Hausverbot', desc: 'Die Kneipe getroffen. Herzlichen Glückwunsch.', coins: 5, live: true, test: s => s.pubHits > 0 },
  { id: 'regular', name: 'Stammgast', desc: 'Alle 9 Schichten eines Hafens ohne Kneipentreffer', coins: 100, test: (s, l, x) => Object.values(x.progress.data.pubClean).some(v => v.length >= LEVELS_PER_CHAPTER) },
  { id: 'cold', name: 'Kühlkette', desc: 'Kühlcontainer-Schicht gewonnen, nichts aufgetaut', coins: 60, test: (s, l, x) => x.won && s.reefersOk > 0 && !s.thawed },
  { id: 'monkeys', name: 'Affenflüsterer', desc: '10 Affen abgeschüttelt (insgesamt)', coins: 60, test: (s, l) => (l.monkeysShaken || 0) >= 10 },
  { id: 'doubles', name: 'Doppelpack', desc: '10 Doppelgriffe in einer Schicht', coins: 60, live: true, test: s => s.doubles >= 10 },
  { id: 'gentle', name: 'Feingefühl', desc: 'Stapelregel-Schicht gewonnen, nichts zerquetscht', coins: 50, test: (s, l, x) => x.won && x.level.stackRule && !s.crushes },
  { id: 'feeder', name: 'Frieda-Fan', desc: 'Den Feeder randvoll beladen', coins: 40, live: true, test: s => s.feederFull > 0 },
  { id: 'inspector', name: 'Vorzeigekranführer', desc: '5 perfekte Landungen unter Aufsicht', coins: 50, live: true, test: s => s.inspectorPerfect >= 5 },
  { id: 'iced', name: 'Eiskunstlauf', desc: 'Einen Container auf Eis gelegt', coins: 5, live: true, test: s => s.iced > 0 },
  { id: 'rare1', name: 'Glückspilz', desc: 'Seltene Fracht entdeckt', coins: 20, live: true, test: s => s.rare > 0 },
  { id: 'rareAll', name: 'Sammler', desc: 'Alle seltenen Frachten entdeckt', coins: 150, test: (s, l, x) => RARE.every(r => x.progress.data.rareSeen[r.id]) },
  { id: 'ch1', name: 'Oberkranführer', desc: 'Kapitel 1 geschafft', coins: 0, test: (s, l, x) => !!x.progress.data.promoted[1] },
  { id: 'ch2', name: 'Eisheiliger', desc: 'Kapitel 2 geschafft', coins: 0, test: (s, l, x) => !!x.progress.data.promoted[2] },
  { id: 'ch3', name: 'Hafenlegende', desc: 'Kapitel 3 geschafft', coins: 0, test: (s, l, x) => !!x.progress.data.promoted[3] },
  { id: 'endless5', name: 'Unermüdlich', desc: 'Eine Endlos-Schicht +5 gewonnen', coins: 100, test: (s, l, x) => x.won && x.level.endless && x.level.n >= 5 },
  { id: 'daily7', name: 'Stammbelegschaft', desc: '7 Tagesschichten gespielt', coins: 80, test: (s, l) => (l.dailies || 0) >= 7 },
  { id: 'veteran', name: 'Hafenurgestein', desc: '500 Container bewegt (insgesamt)', coins: 120, test: (s, l) => (l.landed || 0) >= 500 },
];

export const freshShiftStats = () => ({
  maxCombo: 0, splashes: 0, gullHits: 0, pubHits: 0, ducks: 0, crushes: 0, broken: 0, thawed: 0,
  reefersOk: 0, monkeysShaken: 0, monkeysStole: 0, iced: 0, doubles: 0, rare: 0, feederFull: 0,
  perfects: 0, inspectorPerfect: 0, landed: 0,
});

// Prüft Abzeichen, schaltet neue frei und zahlt die Prämie aus. Gibt die neuen zurück.
export function checkAchievements(progress, s, x = null) {
  const got = progress.data.achievements;
  const life = progress.stats;
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (got[a.id] || (!x && !a.live)) continue;
    let ok = false;
    try { ok = a.test(s, life, x); } catch { ok = false; }
    if (!ok) continue;
    got[a.id] = true;
    progress.data.coins += a.coins;
    fresh.push(a);
  }
  if (fresh.length) progress.save();
  return fresh;
}
