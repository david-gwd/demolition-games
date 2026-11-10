// Chef Grummelmann: Zettel vor jeder Schicht, Postkarten in neuen Häfen, Beförderungen
export const CHEF = 'Chef Grummelmann';

// Erste Schicht eines neuen Hafens ist eine Postkarte (postcard: true)
export const NOTES = {
  '1-1': ['Karl, das ist dein Kran. Sei nett zu ihm.', 'Container aufs Schiff. Nicht daneben. Nicht ins Wasser.', 'Ich bin in der Kantine. Fischbrötchen.'],
  '1-2': ['Heute andersrum: alles vom Schiff auf den Lkw.', 'Der Lkw-Fahrer heißt Udo. Udo hat keine Geduld.'],
  '1-3': ['Neu: ein Ladeplan! Farben auf die passenden Spalten.', 'Der Lademeister mag es ordentlich. Ich auch.'],
  '1-4': ['Nebel, Karl. Fahr nach Gefühl.', 'Ich hab gar kein Gefühl. Darum fährst du.'],
  '1-5': ['Gleichmäßig beladen, sonst kippt der Kahn.', 'Schwere Dinger in die Mitte. Steht so im Handbuch. Glaub ich.'],
  '1-6': ['Möwenschwarm angesagt. Kopf einziehen.', 'Die Gewerkschaft der Möwen ist sehr gut organisiert.'],
  '1-7': ['Nachtschicht. Ich geh schlafen.', 'Wenn was ist: nicht anrufen.'],
  '1-8': ['Die Barkasse der Hafenrundfahrt tuckert durch.', 'Touristen nicht treffen. Die schreiben Bewertungen.'],
  '1-9': ['Sturmflut. Das Schiff muss trotzdem raus.', 'Wenn du das schaffst, reden wir über eine Beförderung.', 'Vielleicht.'],

  '2-1': { postcard: true, lines: ['Liebe Grüße aus der Eiskante!', 'Hier ist alles glatt. Das Deck, die Straße, mein Chef.', 'Container rutschen gern. Sauber absetzen!'] },
  '2-2': ['Eisschollen treiben im Hafen.', 'Wer da drauf ablädt, schickt Fracht auf Weltreise.'],
  '2-3': ['Neue Regel: Schwer kommt nie auf leicht!', 'Sonst ist leicht danach sehr flach.'],
  '2-4': ['Ebbe und Flut. Das Schiff fährt heute Fahrstuhl.', 'Die Seillänge regelt sich zum Glück von allein.'],
  '2-5': ['Frieda kommt! Ein kleiner Feeder neben dem großen Pott.', 'Sie wartet nicht lange. Voll machen gibt Prämie.'],
  '2-6': ['Schneesturm. Ich sehe meine Hand nicht. Wo ist mein Fischbrötchen?'],
  '2-7': ['Polarnacht. Es wird nicht mehr hell. Für Monate.', 'Aber das Schiff fährt um sechs. Heute.'],
  '2-8': ['Treibeis UND Gezeiten. Das Meer hat heute schlechte Laune.', 'So wie ich.'],
  '2-9': ['Die letzte Schicht im Eis, Karl.', 'Schneesturm, Frieda, Stapelregel. Alles auf einmal.', 'Danach gibt\'s Urlaub. Vielleicht.'],

  '3-1': { postcard: true, lines: ['Grüße vom Palmenkai!', 'Sonne, Strand, Kühlcontainer. Die müssen an den Strom!', 'Ich lieg in der Hängematte. Du nicht.'] },
  '3-2': ['Hier gibt\'s Affen. Die klettern am Seil runter.', 'Schüttel sie ab, bevor sie ausräumen!'],
  '3-3': ['Viele Kühlcontainer heute. Und ein Ladeplan.', 'Wer die Kühlkette reißt, darf alles selber essen.'],
  '3-4': ['Der Hafeninspektor kommt. Ein strenger Mann mit Klemmbrett.', 'Wenn er guckt: nur perfekte Landungen!'],
  '3-5': ['Monsun! Alles nass, alles glatt.', 'Meine Frisur ist auch hin.'],
  '3-6': ['Frieda ist nachgereist. Mit Kühlware.', 'Zwei Schiffe, ein Karl. Das schaffst du.'],
  '3-7': ['Springflut und Affen. Die Affen surfen jetzt.'],
  '3-8': ['Tropennacht. Und der Inspektor macht Überstunden.', 'Er hat eine Taschenlampe.'],
  '3-9': ['Hurrikan Hildegard ist im Anmarsch.', 'Das ist die letzte große Schicht, Karl.', 'Ich zähl auf dich. Wirklich. Kein Witz.'],
};

export function noteFor(key) {
  const n = NOTES[key];
  if (!n) return null;
  return Array.isArray(n) ? { postcard: false, lines: n } : n;
}

export const PROMOTIONS = {
  1: {
    rank: 'Oberkranführer',
    lines: ['Karl, du hast den Heimathafen gerockt.', 'Ab sofort bist du Oberkranführer!', 'Und als Belohnung … versetze ich dich in die Eiskante.'],
    bonus: 200,
  },
  2: {
    rank: 'Hafenmeister-Anwärter',
    lines: ['Das Eis hat dich nicht kleingekriegt.', 'Neue Stelle: Palmenkai. Sonne! Strand!', 'Und Affen. Hab ich die Affen erwähnt?'],
    bonus: 300,
  },
  3: {
    rank: 'Hafenlegende',
    lines: ['Drei Häfen. Tausend Container. Ein Karl.', 'Du bist offiziell eine Hafenlegende.', 'Die Endlos-Schichten warten trotzdem. Ich auch. In der Kantine.'],
    bonus: 500,
  },
};
