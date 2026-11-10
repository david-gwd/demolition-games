# demolition-games

Statische Website (kein Build, kein Framework, keine npm-Abhängigkeiten), die kleine Browser-Spiele
als anklickbare Banner-Karten zeigt. Deployment später über Cloudflare Pages / Netlify aus diesem
Git-Repo (Build-Befehl leer, Ausgabeordner `/`). Der Nutzer pusht selbst.

## Aufbau

```
index.html              Startseite: Kopf + eine <a class="card card--<slug>"> pro Spiel
site.css                Tokens (:root), Hintergrund-Ebenen (.bg__*), Karten, Mobil (<600px)
assets/covers/          ein Cover pro Spiel
assets/bg/              streaks.jpg (mit numpy vorgerendert), filaments.svg, dust.svg, grain.svg
games/kran-karl/        Kran-Karl (früher ../container), Canvas 960x540, ES-Module in src/
games/good-luck/        Danger-Days-Projekt; das Spiel liegt in showdown/ (Canvas 320x180, Pixel-Art)
                        hat eigene CLAUDE.md + DANGER_DAYS_BIBLE.md: bei Arbeit daran beachten
tools/shot.py           headless-Chrome-Screenshots mit Tasten/Klicks (Cover + Checks)
mockups/                Entwürfe A–C; Referenzbilder (background_*, website_*) nur lokal, per .gitignore
                        ausgeschlossen (fremde Bilder, nicht veröffentlichen). Gilt auch für
                        games/good-luck/inspiration/
```

`../container` und `../good-luck` sind Symlinks auf `games/…`. Die echten Dateien liegen nur hier.

## Design („A · Glut“, vom Nutzer gewählt)

- Startseite bewusst eigenständig und düster: Pflaume/Magenta, schräge Schlieren, feine leuchtende
  Kratzer, Goldstaub, Korn, heller Glutkern (Creme→Orange) am rechten Rand. Inspiriert von
  `mockups/background_1.jpeg`, aber komplett selbst generiert. Das Foto nie einbinden.
- Layout nach `mockups/website_1.jpeg` (neal.fun): zentrierter Stencil-Titel, darunter eine Spalte
  breiter Banner (max. 760px, Höhe 250px, mobil 150px).
- Jedes Banner = Gameplay-Szene des Spiels + Titel im **eigenen Stil des Spiels**. Die Spiele sollen
  sich stark vom Seitenrahmen abheben.
- Schriften (Google Fonts): Big Shoulders Stencil Display (Logo), IBM Plex Mono (Text),
  Lilita One (Kran-Karl-Titel), Silkscreen (Showdown-Titel).
- Der Nutzer mag keine generischen „sauberen“ Layouts (weiß/grau, Standard-Raster). Neue Ideen
  sollen Charakter haben und sich an seinen Referenzbildern orientieren.

## Neues Spiel hinzufügen

1. **Ordner:** Spiel nach `games/<slug>/`, Einstieg `games/<slug>/index.html` (oder Unterordner, wie
   `good-luck/showdown/`). Nur **relative Pfade** (kein führendes `/`), weil alles unter einer Domain
   in Unterordnern läuft. localStorage-Keys mit dem Slug präfixen, damit sie nicht kollidieren.
   Belegt sind `kran-karl-progress`, `kran-karl-settings`, `kran-karl-ghosts` und
   `four-color-showdown-high`.
2. **Cover:** Server starten (`python3 -m http.server 8765`), mit `tools/shot.py` eine Gameplay-Szene
   aufnehmen (Beispiele im Docstring). Den Viewport so wählen, dass der Canvas pixelgenau groß
   rendert. Danach mit PIL zuschneiden: HUD/Labels entfernen, Ziel ca. 1600×830 → `assets/covers/<slug>.jpg`.
   Pixel-Art per NEAREST auf Originalauflösung herunterrechnen und als PNG speichern, im CSS dann
   `image-rendering: pixelated`.
3. **Karte in `index.html`** vor `.card--soon` einfügen:
   ```html
   <a class="card card--<slug>" href="games/<slug>/">
     <img src="assets/covers/<slug>.jpg" alt="" width="…" height="…">
     <span class="card__title">Titel</span>
     <span class="card__badge">Maus + Tastatur</span>   <!-- optional, z. B. wenn kein Touch -->
     <span class="card__tag">Ein Satz zum Spiel.</span> <!-- erscheint beim Hover -->
   </a>
   ```
4. **Stil in `site.css`** (Abschnitt „Karten“): `.card--<slug> img { object-position: … }` für den
   Bildausschnitt, `.card--<slug> .card__title { … }` für Schrift, Farbe und Kontur wie im Spiel.
   Den Mobil-Wert im `@media (max-width: 600px)`-Block ergänzen. Ist das Bild unruhig, ein dunkles Band
   per `::before` legen (siehe `.card--showdown::before`, `z-index: 1`; Titel/Badge/Tag haben `z-index: 2`).
5. Die Nummer in `.card--soon` („Nr. 03“) hochzählen.
6. **Prüfen** (siehe unten).

## Spiel ändern

- Direkt in `games/<slug>/` arbeiten. Die Seite braucht keine Anpassung, solange der Einstiegspfad
  gleich bleibt.
- Hat sich das Aussehen deutlich geändert, das Cover neu aufnehmen (Schritt 2 oben).
- Neuer Pfad oder Slug: `href` in `index.html` anpassen. Ändert sich ein localStorage-Key, gehen
  Spielstände verloren. Vorher den Nutzer fragen.
- Spiel entfernen: Ordner, Cover, Karte und CSS-Block löschen.

## Prüfen

```sh
python3 -m http.server 8765 &
python3 tools/shot.py http://localhost:8765/ /tmp/d.png --size 1440x900
python3 tools/shot.py http://localhost:8765/ /tmp/m.png --size 390x844 --mobile
python3 tools/shot.py http://localhost:8765/games/<slug>/ /tmp/g.png --size 1600x900 --do "key:Space,wait:2"
```

Screenshots ansehen. `fehlgeschlagene Requests` darf nur `favicon.ico` enthalten (die Spielseiten
haben kein eigenes Favicon, das ist harmlos).

## Bekannte Stolperfallen

- Hintergrund-Ebenen sind `position: fixed; z-index: -1`. Deshalb darf `body` **keinen**
  Hintergrund haben (sonst verdeckt er sie). Die Grundfarbe sitzt auf `html`.
- Große gedrehte SVG-feTurbulence-Flächen zeigten in Chrome Nähte. Darum ist die Schlieren-Textur
  ein vorgerendertes JPEG (Schwarz + `mix-blend-mode: screen`).
- Headless Chrome mit `--window-size` liefert einen kleineren Viewport. `tools/shot.py` setzt ihn
  deshalb per `Emulation.setDeviceMetricsOverride`.
