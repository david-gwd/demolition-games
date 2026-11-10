# Plan: Four Color Showdown (Idee 2) + Vorrats-Plan Highway Shootout (Idee 3)

> Status: **Four Color Showdown ist gebaut (Meilensteine 1–5).** Highway Shootout ist noch offen.

## Context
Mini-Pixel-Webspiel im Danger-Days-Stil (Stil statt Plot: eigene Killjoys, Farben, Kostüme, Wüste, Dracs).
Gewählt: **Idee 2 – Four Color Showdown**, Top-Down-Arena-Shooter, bei dem das Vier-Farben-System die Kernmechanik ist.
Entscheidungen: **Vanilla JS + Canvas** (ES-Module, keine Dependencies), **nur Desktop** (WASD + Maus), **MVP = Endlos-Wellen** in einer Arena.
Idee 3 wird als Vorrats-Plan festgehalten und baut später auf denselben `shared/`-Modulen auf.

Referenzen im Repo:
- `DANGER_DAYS_BIBLE.md`: Paletten, CSS-Tokens (§7), Namensformel, Slang, Tonalität, Don'ts
- `mockups/mockup_four_color_showdown.png` = visuelles Zielbild, `mockups/mockup_highway_shootout.png` = Zielbild für Idee 3
- Mockup-Generator (Scratchpad, temporär, bereits nach `shared/` portiert): `/private/tmp/claude-501/-Users-davidgrunewald-Documents-Programmieren-good-luck/ce8676ff-b9fd-4be0-9a0d-7d1e04d8cc1f/scratchpad/mockups.py`. Daraus werden **portiert**: 3×5-Pixelfont `F`, Sprite-Maps `KJ_FRONT`, `DRAC`, `KJ_SIDE`, `kj_map()`, Bayer-Dither `BAYER`/`dither_fill`, `burst()`, `cactus()`, `badge()`, `heart()`, `spider()`, Palette `C`.

## Struktur
```
index.html            Startseite mit Link zu den Spielen
shared/               wiederverwendbar für Idee 2 und 3
  palette.js          Palette C aus mockups.py / Bible §4.2
  pixelfont.js        3x5-Font + drawText(ctx,x,y,str,col,scale,outline), textWidth()
  sprites.js          ASCII-Sprite-Maps + bake(rows,cmap) -> OffscreenCanvas, Palette-Swap pro Killjoy
  fx.js               burst(ZAP!/BOOM), Partikel, Hit-Flash, Screenshake, Grain+Vignette-Overlay (einmal vorberechnet)
  draw.js             Pixelgenaue Helfer: Rechteck, Bayer-Dither, Polygon, Ellipse, Ring, Linie, Seed-RNG
  input.js            Tasten-Set, Maus in Spielkoordinaten (Skalierung rausrechnen), Pointer-Lock-frei
  loop.js             Fixed Timestep 60 Hz + Render pro Frame
  audio.js            WebAudio-Synth-Blips (Zap, Treffer, Boom, Switch, Pickup), keine Asset-Dateien
  store.js            Highscore via localStorage (try/catch, funktioniert auch ohne)
showdown/
  index.html          Canvas 320x180, CSS image-rendering: pixelated, ganzzahlige Skalierung, schwarzer Rahmen
  main.js             Boot, State-Machine: title -> play <-> pause -> gameover
  arena.js            Hintergrund einmal auf Offscreen-Canvas (Sand-Textur, Diner, Parkplatz, Car, Kakteen, Steine), Kollisionsrechtecke
  crew.js             4 Killjoys + Waffen
  player.js           Bewegung, Dash, Zielen, Schießen, Wechsel
  enemies.js          Gegnertypen + simple Steering-KI
  bullets.js          Projektil-Pool (Spieler/Gegner), Abprallen, Durchschlag
  waves.js            Wellen-Budget, Spawns an Rändern, Boss alle 5 Wellen
  pickups.js          Power-Pup-Dose, Carbons
  hud.js              Badges, Herzen, Welle, Carbons, Waffenlabel, Schild-Hinweis, Radio-Ticker
  text.js             Radio-Zeilen (eigene, im Dr.-D-Ton), Game-Over-/Pause-Texte
```

## Gameplay-Spezifikation (MVP)
**Steuerung:** WASD laufen · Maus zielen · LMB halten = schießen · 1–4 / Mausrad = Killjoy wechseln (0,2 s Cooldown, Glitch-Effekt) · Space = Dash (kurz, Unverwundbarkeit) · Esc/P = Pause.

**Crew** (geteiltes Leben, 3 Herzen, max 5):
| Taste | Killjoy | Farbe | Waffe |
|---|---|---|---|
| 1 | Neon Hazard | Gelb | Streuschuss, 3 Kugeln, kurze Reichweite, 4/s |
| 2 | Sugar Static | Grün | Abpraller, 2 Bounces an Arena-Wänden/Objekten, 5/s |
| 3 | Rocket Rattler | Blau | Durchschlag, 2 Schaden, 2,5/s |
| 4 | Velvet Venom | Rot | Aufladen (halten bis 1 s), 1–6 Schaden, großer Schuss |

**Gegner:**
- *Drac:* läuft auf den Spieler zu, schießt langsame weiße Bolzen, 3 HP
- *Schild-Drac:* farbiger Ring, nur die passende Farbe verwundet, andere prallen ab ("TINK"-Partikel), HUD zeigt "BLUE SHIELD: PRESS 3"
- *Bike-Drac:* zieht Telegraph-Linie, dann schneller Dash quer durch die Arena
- *Überwachungsdrohne:* hält Abstand und markiert den Spieler, solange sie lebt zielen alle Dracs genauer
- *Boss (alle 5 Wellen):* Agent im schwarzen Anzug, 2 Phasen, Schildfarbe wechselt alle paar Sekunden und erzwingt Wechsel

**Wellen:** Budget = 4 + 2·Welle. Schild-Anteil und Drohnen steigen mit der Welle. Zwischen Wellen 3 s Pause mit Radio-Ticker ("WKIL 109 >> …").
**Score:** Carbons pro Kill × Combo (Combo verfällt nach 2 s ohne Treffer). Highscore lokal.
**Screens:** Title ("FOUR COLOR SHOWDOWN", Badges, "CLICK TO ZAP") · Pause als BL/ind-Screen (weiß, Smiley, "EVERYTHING IS PERFECT.") · Game Over "KILLJOYS NEVER DIE" + Score + "CLICK TO RISE AGAIN".
**Juice:** ZAP!/BOOM-Bursts bei Kills, Hit-Flash weiß, 2 px Screenshake, Staubpartikel beim Dash, Grain+Vignette-Overlay wie im Mockup.

## Meilensteine
1. **Gerüst:** `shared/` loop/input/palette/pixelfont/sprites, `showdown/index.html` mit Skalierung, Arena-Hintergrund, gelber Killjoy läuft und schießt
2. **Crew:** Wechsel 1–4, alle vier Waffen, Palette-Swap-Sprites, Badges im HUD
3. **Gegner & Wellen:** Drac + Schild-Drac, Kollision (Kreis gegen Kreis, Arena-Rechtecke), Schaden, Wellen-System
4. **Spielschleife:** Herzen, Game Over, Title, Pause, Highscore, HUD komplett
5. **Inhalt & Juice:** Bike-Drac, Drohne, Boss, Pickups, Combo, Bursts, Audio, Radio-Ticker
6. **Balancing & Polish:** Tempo, Spawn-Kurve, Lesbarkeit der Schildfarben, Performance (Objekt-Pools)

## Verifikation
- Debug: `showdown/?debug` macht `window.fcs.g` (Spielzustand) und `fcs.state` in der Konsole erreichbar, z. B. `fcs.g.wave = 4` für den Boss-Test
- `python3 -m http.server 8000` im Projektroot, dann `http://localhost:8000/showdown/` in Chrome öffnen (ES-Module brauchen HTTP, `file://` geht nicht)
- Per Claude in Chrome: Screenshot vergleichen mit `mockups/mockup_four_color_showdown.png`, Konsole auf Fehler prüfen
- Manuelle Checkliste je Meilenstein: alle Tasten, jede Waffe, Schild nur mit passender Farbe verwundbar, Boss nach Welle 5, Highscore übersteht Reload, keine FPS-Einbrüche bei ~40 Gegnern + Projektilen
- Stil-Check gegen Bible §7 (Checkliste & Don'ts)

---

## Vorrats-Plan: Highway Shootout (Idee 3)
Wird nicht jetzt gebaut. Später als `highway/` neben `showdown/`, mit **vollständiger Wiederverwendung von `shared/`** (Font, Palette, Sprites inkl. `KJ_SIDE`, FX, Input, Loop, Audio, Store).

**Konzept:** Seitenansicht, das Auto fährt automatisch durch die Zonen 6 → 1 Richtung Battery City. Fokus auf Zielen und Atmosphäre.
**Steuerung:** Maus zielen/schießen (Killjoy auf dem Dach) · W/S = Spurwechsel (3 Spuren, Ausweichen) · Space = ducken (Deckung, kein Schießen) · 1/2 = Schütze wechseln (Dach vs. Fenster, später alle 4 Farben wie in Idee 2).
**Gegner:** Drac-Bikes (fahren auf, schießen seitlich), BL/ind-Limousine (rammt, gepanzert, Schwachpunkte Reifen/Fahrer), Drohnen (Sturzflug), Straßenhindernisse (Barrikaden, Krähenfüße, Absperrband), Boss pro Zone (gepanzerter BL/ind-Truck, Mousekat-artiger Paradewagen, Hubschrauber-Drohne).
**Progression:** Distanz = Fortschritt ("MILE 042"). Am Zonenende Dead-Pegasus-Tankstelle als Shop (Carbons gegen Reparatur, Waffen-Upgrades, Jacken-Patches als Perks). Autoschaden statt Herzen.
**Rendering:** Parallax-Layer als gekachelte Offscreen-Canvases: Dither-Himmel (statisch) · Sonne · Wolken 0,05 · ferne Berge 0,1 · nahe Berge 0,2 · Masten/Schilder 0,6 · Straße 1,0 · Vordergrund 1,3. Tageszeit wandert pro Zone (Teal-Mittag → Rost-Sonnenuntergang → Nacht vor Battery City, die weiß leuchtet). Speedlines + Staub als Partikel.
**Neue Module:** `highway/parallax.js`, `highway/vehicles.js` (Auto-Physik/Spurwechsel, Gegnerfahrzeuge), `highway/spawner.js` (zeitgesteuerte Choreografie-Skripte statt Budget-Wellen), `highway/shop.js`, `highway/hud.js` (Radio-Ticker oben, Autoschaden, Meilen).
**Meilensteine:** Parallax + Auto → Zielen/Schießen + Bikes → Spurwechsel/Ducken + Hindernisse → Limousine/Drohnen + Boss → Shop + Zonen-Progression + Tageszeit → Polish.
**Aufwand:** etwa 1,5–2× Idee 2 (Parallax-Kunst, Fahrzeug-Choreografie, Shop).
**Brücke zu Idee 2 (optional):** Highway-Sequenzen als kurze Übergänge zwischen Arena-Wellen.
