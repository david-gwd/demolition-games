# Demolition Games

Statische Website mit kleinen Browser-Spielen. Kein Build, keine Abhängigkeiten.

```
index.html            Startseite (Karten)
site.css              Layout + Hintergrund
assets/covers/        Cover pro Spiel
assets/bg/            Hintergrund-Texturen (Schlieren, Kratzer, Staub, Korn)
games/<slug>/         je ein Spiel, unverändert lauffähig
mockups/              Design-Referenzen (nicht nötig fürs Deployment)
```

`../container` und `../good-luck` sind Symlinks auf `games/kran-karl` und `games/good-luck`.
Die alten Pfade funktionieren also weiter, die echten Dateien liegen hier im Repo.

## Lokal starten

```sh
python3 -m http.server 8000
# http://localhost:8000
```

## Neues Spiel hinzufügen

1. Spielordner nach `games/<slug>/` legen. Nur relative Pfade verwenden. Den
   localStorage-Key mit dem Slug präfixen (alle Spiele teilen sich eine Domain).
2. Cover nach `assets/covers/<slug>.jpg` (ca. 1600×830, Gameplay ohne HUD;
   Pixel-Art lieber als PNG in Originalauflösung).
3. In `index.html` eine Karte vor der „in der Werkstatt“-Karte einfügen:

   ```html
   <a class="card card--<slug>" href="games/<slug>/">
     <img src="assets/covers/<slug>.jpg" alt="" width="1600" height="830">
     <span class="card__title">Titel</span>
     <span class="card__tag">Ein Satz zum Spiel.</span>
   </a>
   ```

4. In `site.css` einen Block `.card--<slug> .card__title { … }` anlegen. Der
   Titel soll so aussehen wie im Spiel (Schrift, Farbe, Kontur).

## Deployment

Cloudflare Pages oder Netlify mit dem GitHub-Repo verbinden. Build-Befehl leer
lassen, Ausgabeordner `/`. Jeder Push geht automatisch live, eine eigene Domain
lässt sich im Dashboard eintragen.
