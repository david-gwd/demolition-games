import { crnd } from './config.js';

const cpick = arr => arr[Math.floor(crnd() * arr.length)];

// weight: 1 = leicht, 2 = mittel, 3 = schwer
// fragile: geht bei unsauberer Landung kaputt · alive: mag nicht ewig am Haken hängen
const CARGO = [
  { name: '3 t Gummienten', weight: 2, ducks: true },
  { name: '1 Hamster (sehr nervös)', weight: 1, alive: true },
  { name: 'Ersatz-Möwen', weight: 1, alive: true },
  { name: 'Beton-Kuchen', weight: 3 },
  { name: 'Leere Container (für Container)', weight: 2 },
  { name: 'Socken, einzeln', weight: 1 },
  { name: '40.000 Kulis ohne Mine', weight: 1 },
  { name: 'Ein sehr großer Käse', weight: 3 },
  { name: 'Gartenzwerge (Sonderedition)', weight: 2 },
  { name: 'Frische Alpenluft', weight: 1 },
  { name: 'Bowlingkugeln, lose', weight: 3 },
  { name: 'Übrige Möbelhaus-Schrauben', weight: 1 },
  { name: 'Ein Klavier, verstimmt', weight: 3, fragile: true },
  { name: 'Nudeln, ungekocht', weight: 2 },
  { name: 'Nudeln, gekocht', weight: 2 },
  { name: 'Ananas mit Sonnenbrillen', weight: 2 },
  { name: 'Wackelpudding (wackelt)', weight: 2, fragile: true },
  { name: 'Bleigieß-Set XXL', weight: 3 },
  { name: 'Kaputte Fernbedienungen', weight: 1 },
  { name: 'Hüpfbälle (gefährlich)', weight: 1 },
  { name: 'Omas Briefmarkensammlung', weight: 1 },
  { name: 'Pullover für Pinguine', weight: 1 },
  { name: 'Kettensägen-Jonglierset', weight: 2 },
  { name: 'Klopapier (Panikvorrat)', weight: 1 },
  { name: 'Ein Anker. Ja, wirklich.', weight: 3 },
  { name: 'Geheime Fracht (nicht fragen)', weight: 2 },
  { name: 'Konfetti, lose geschüttet', weight: 1 },
  { name: 'Glühbirnen, sehr zerbrechlich', weight: 1, fragile: true },
  { name: 'Sand für die Wüste', weight: 3 },
  { name: 'Fischbrötchen, warm', weight: 2 },
];

// Zusatzfracht je Hafen
const EXTRA = {
  eis: [
    { name: 'Pinguine auf Klassenfahrt', weight: 1, alive: true },
    { name: 'Schneeschaufeln, gebraucht', weight: 1 },
    { name: 'Eiswürfel (Familienpackung)', weight: 2 },
    { name: 'Heizlüfter für Iglus', weight: 2 },
    { name: 'Ein Eisbär (schläft hoffentlich)', weight: 3, alive: true },
    { name: 'Schneekugeln, frisch geschüttelt', weight: 1, fragile: true },
    { name: 'Rentierfutter, extra knusprig', weight: 2 },
    { name: 'Gefrorene Gummistiefel', weight: 2 },
  ],
  tropen: [
    { name: 'Kokosnüsse, lose', weight: 2 },
    { name: 'Sonnencreme LSF 100', weight: 1 },
    { name: 'Hängematten (aufgerollt)', weight: 1 },
    { name: 'Ein Faultier (hat Zeit)', weight: 2, alive: true },
    { name: 'Bananen, noch grün', weight: 2 },
    { name: 'Ananas-Pizza (umstritten)', weight: 1 },
    { name: 'Muscheln für Sammler', weight: 1, fragile: true },
    { name: 'Surfbretter, gewachst', weight: 2 },
  ],
};

// Kühlcontainer: müssen an den Strom, sonst tauen sie auf
const REEFER = [
  { name: 'Tiefkühlpizza', weight: 2 },
  { name: 'Fischstäbchen (500.000)', weight: 2 },
  { name: 'Speiseeis (schmilzt!)', weight: 2 },
  { name: 'Gefrorene Erbsen', weight: 2 },
  { name: 'Mangos, gekühlt', weight: 2 },
];
export const REEFER_COLOR = '#e9eff3';
export const THAWED_COLOR = '#8a6a4a';
export const REEFER_TIME = { load: 35, unload: 15 };

// Seltene Fracht (1 %): eigene Sprüche, teils eigene Effekte
export const RARE = [
  { id: 'wal', name: 'Ein Wal (geliehen)', weight: 3, land: 'Ein Wal an Bord. Das gibt Ärger mit dem Zoo.', splash: 'Der Wal ist … nach Hause geschwommen.', bigSplash: true },
  { id: 'lohn', name: 'Karls Lohnzettel', weight: 1, land: 'Mein Lohnzettel?! Den wollte ich nicht verschiffen!', splash: 'Tja, Karl. Dann gibt\'s diesen Monat wohl nix.' },
  { id: 'gold', name: 'Goldbarren (echt!)', weight: 3, land: 'GOLD! Vorsichtig, Karl, ganz vorsichtig!', splash: 'Das Gold liegt jetzt bei den Fischen. Reiche Fische.', bonus: 200 },
  { id: 'post', name: 'Flaschenpost', weight: 1, land: 'Flaschenpost! „Lieber Finder, bitte Kran fahren lernen."', splash: 'Na ja, die war ja eh fürs Wasser.', bonus: 100 },
  { id: 'ufo', name: 'Ein UFO (Fundsache)', weight: 2, land: 'Ein UFO. Ganz normaler Dienstag.', splash: 'Es ist … abgetaucht. Unheimlich.', floaty: true },
  { id: 'oma', name: 'Omas Kaffeekränzchen (komplett)', weight: 2, alive: true, land: 'Die Damen lassen grüßen. Und wollen Kuchen.', splash: 'Keine Sorge, die können alle schwimmen!' },
  { id: 'chef', name: 'Der Schreibtisch vom Chef', weight: 3, land: 'Mein Schreibtisch! Gut gemacht, Karl.', splash: 'MEIN SCHREIBTISCH!!!', chefDesk: true },
];
export const RARE_COLOR = '#d4af37';

export const COLORS = ['#d9472b', '#2b7bd9', '#e8a33d', '#3fa34d', '#8a4fc7', '#1f9e9e', '#c23b6e', '#6b7280'];
// Grau fällt für den Ladeplan weg: sieht aus wie das Deck
export const PLAN_COLORS = COLORS.slice(0, 7);

export const WEIGHT_NAMES = ['', 'leicht', 'mittel', 'schwer'];

// palette: Farben des Ladeplans, die bevorzugt gezogen werden; weight: festes Gewicht (optional)
// opts.harbor: Zusatzfracht des Hafens · opts.reefers: Anteil Kühlcontainer · opts.mode: Timer-Länge
export function randomCargo(palette = null, weight = 0, { harbor = 'hafen', reefers = 0, mode = 'load' } = {}) {
  if (crnd() < 0.01) {
    const pool = weight ? RARE.filter(c => c.weight === weight) : RARE;
    if (pool.length) return { ...cpick(pool), rare: true, color: RARE_COLOR };
  }
  if (reefers && (!weight || weight === 2) && crnd() < reefers) {
    // beim Löschen läuft der Timer erst ab dem Greifen
    return { ...cpick(REEFER), reefer: true, cold: mode === 'load' ? REEFER_TIME.load : null, color: REEFER_COLOR };
  }
  const all = [...CARGO, ...(EXTRA[harbor] || [])];
  const pool = weight ? all.filter(c => c.weight === weight) : all;
  const color = palette && crnd() < 0.7 ? cpick(palette) : cpick(COLORS);
  return { ...cpick(pool), color };
}

export const LINES = {
  start: ['Moin! Das Schiff wartet nicht ewig.', 'Ladung muss rauf. Und zwar heil!', 'Auf geht\'s, Karl!'],
  startUnload: ['Alles runter vom Kahn, rauf auf den Lkw!', 'Heute wird gelöscht, Karl. Nicht das Licht!', 'Der Lkw-Fahrer hat Feierabend um vier.'],
  goal: ['Soll erfüllt! Jetzt die Kür.', 'Reicht eigentlich. Mach trotzdem weiter.'],
  plan: ['Genau nach Ladeplan!', 'Der Lademeister ist gerührt.', 'Farblich abgestimmt. Schick.'],
  beside: ['Der Lkw steht DA, Karl.', 'Jetzt muss wieder der Gabelstapler ran.', 'Knapp daneben ist auch auf dem Kai.'],
  back: ['Runter sollte das, nicht wieder rauf!'],
  boat: ['Achtung, Barkasse!', 'Da tuckert einer durch. Festhalten!'],
  boatHit: ['Das war die Hafenrundfahrt!', 'Die Touristen wollten nur gucken!'],
  gust: ['Böe! Festhalten!', 'Gleich pfeift\'s!'],
  fog: ['Ich seh die Hand vor Augen nicht.'],
  night: ['Nachtschicht. Zuschlag gibt\'s keinen.'],
  insured: ['Zahlt die Versicherung. Diesmal.'],
  perfect: ['Wie mit dem Lineal!', 'Ein Gedicht!', 'Ich weine vor Freude.', 'So macht man das!', 'Millimeterarbeit!'],
  ok: ['Geht so.', 'Passt schon.', 'Hätte schlimmer sein können.', 'Na ja, steht ja.'],
  splash: [
    'Da schwimmt sie hin, die Ladung „{cargo}"!',
    'Die Fische freuen sich über „{cargo}".',
    'Wer bezahlt mir jetzt „{cargo}"?!',
    'Platsch. Einfach nur Platsch.',
    'Das Meer ist kein Lager, Karl!',
  ],
  ducks: ['Das war die Sonderlieferung Gummienten!', 'Die Enten sind frei! FREI!'],
  gull: ['Lass die Möwe in Ruhe!', 'Die Möwe ist in der Gewerkschaft!', 'Tierschutz! TIERSCHUTZ!'],
  gullFriend: ['Die kommt wieder. Mit Freunden.', 'Jetzt sind\'s schon zwei!', 'Die Möwen-Gewerkschaft schickt Verstärkung!'],
  pub: ['Meine Stammkneipe!!', 'Das zahlst DU, Karl!', 'Hausverbot. Für uns alle.', 'Da war noch Bier drin!'],
  dock: ['Zurück an den Absender?', 'Das ist der Kai, nicht das Schiff.', 'Falsche Richtung, Karl!'],
  pier: ['Ist das meine Bierlieferung?', 'Der Wirt hat das nicht bestellt.'],
  heel: ['Schlagseite! Gleichmäßig beladen!', 'Das Schiff kippt, Karl!', 'Die andere Seite gibt\'s auch noch!'],
  slide: ['Und tschüss …', 'Rutschpartie!'],
  slippery: ['Glatt wie ein Aal heute!', 'Vorsicht, das Deck ist spiegelglatt!'],
  timeLow: ['Noch 10 Sekunden! Hopp hopp!', 'Der Kapitän hupt gleich!'],
  full: ['Voll beladen! Feierabend!'],
  depart: ['Tuuut! Das Schiff legt ab!'],
  win: ['Gut gemacht. Morgen das Doppelte.', 'Pünktlich! Ein Wunder!'],
  fired: ['DAS REICHT!'],
  fragile: ['Kaputt! Das war zerbrechlich!', 'Scherben bringen Glück. Angeblich.', 'Da hat was geklirrt …'],
  sick: ['„{cargo}" wird seekrank!', 'Nicht so lange baumeln lassen! Da lebt was drin!', 'Da drin wird\'s gerade grün im Gesicht.'],
  crush: ['Zerquetscht! Schwer gehört nach unten!', 'Das war mal „{cargo}".', 'Schwer auf leicht? KARL!'],
  thaw: ['Aufgetaut! Das riecht man bis hier.', 'Der Kühlcontainer braucht Strom, Karl!', 'Matsch. Alles Matsch.'],
  reefer: ['Kühlware! Ab an die Steckdose damit.', 'Kühlcontainer an den Stecker, sonst gibt\'s Matsch!'],
  inspectorCome: ['Achtung, der Inspektor kommt!', 'Inspektion! Jetzt nur saubere Landungen!'],
  inspectorGood: ['Der Inspektor nickt anerkennend.', 'Note eins!'],
  inspectorBad: ['Der Inspektor schreibt was auf …', 'Mangelhaft!', 'Das gibt eine Abmahnung.'],
  inspectorGone: ['Inspektor ist weg. Puh.'],
  tide: ['Ebbe und Flut, Karl. Das Schiff fährt Fahrstuhl.'],
  feederLeave: ['Frieda legt ab!', 'Tschüss, Frieda!'],
  feederFull: ['Frieda ist voll! Prämie!', 'Volle Ladung für Frieda!'],
  feederEmpty: ['Frieda fährt leer. Peinlich.'],
  feederArrive: ['Frieda ist wieder da!', 'Der Feeder legt an!'],
  iced: ['Auf Eis gelegt!', 'Die Scholle nimmt\'s mit.', 'Gute Reise, „{cargo}"!'],
  floes: ['Treibeis voraus!'],
  snowstorm: ['Schneesturm! Ich seh nur weiß.'],
  monsoon: ['Monsun! Alles nass, alles glatt.'],
  monkeyOn: ['Ein Affe am Seil!', 'Schüttel ihn ab, Karl!'],
  monkeyOff: ['Und tschüss, Affe!', 'Platsch-Affe!', 'Der kommt wieder. Die kommen immer wieder.'],
  monkeySteal: ['Der Affe hat ausgeräumt!', 'Alles weg. Nur noch Bananenschalen.'],
  spreader: ['Doppelgriff! Zwei auf einen Streich.'],
};

// Ein Satz aus LINES (oder den Hafen-Sprüchen), {cargo} wird ersetzt
export function lineFor(key, overrides = null, cargo = null) {
  const list = overrides?.[key] || LINES[key];
  const s = list[Math.floor(Math.random() * list.length)];
  return cargo ? s.replace('{cargo}', cargo.name) : s;
}
