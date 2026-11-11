# Lunar Clean – Arbeitsweise

Deutsches First-Person-Browserspiel (three.js r128, ohne Build-Schritt). Live: https://ericgerandi-hub.github.io/Lunar-Clean-/
Spielplan (alle Entscheidungen des Nutzers): https://claude.ai/artifact/FeVhH9CZQZ79H8XFbVctzt

## Dateien
- `index.html` – Seite, komplettes CSS, HUD und Menüs (HTML).
- `lib/three.min.js` – three.js r128 (global `THREE`).
- `js/` – alles hängt am globalen `LC`. Ladereihenfolge steht unten in `index.html`.
  - `lc-util.js` Zufall, Rauschen, Text-Texturen
  - `lc-world.js` Gelände (`heightAt`), Krater, Boden-Shader (Staub/sauber/Glitzer), Himmel, Erde, Sonne, Felsen, Licht
  - `lc-dust.js` Staubkarte 1024² über 160 m (`suck`, `percentClean`, Speichern als Lauflängen-Kodierung)
  - `lc-base.js` Wrack, Staublager, Werkstatt, Landeplatz, Lampen; `colliders`, `points` (Benutzen mit E)
  - `lc-player.js` Laufen, Springen, Jetpack, Kollision
  - `lc-vacuum.js` Handwerkzeuge (Löffel, Schaufel, Sauger, XL) als Modelle in eigener Szene, Schaufeln/Saugen, Partikel, Zielring
  - `lc-sacks.js` Staubsäcke (Taste G füllen und werfen, E aufheben, max. 2 tragen)
  - `lc-buggy.js` Mondbuggy (fahren, Saugkopf, 1.500 kg Laderaum, Schlauch für den Handsauger) und Fahrzeug-Entladestation
  - `lc-post.js` HDR, Bloom, Filmkurve (fällt ohne Float-Texturen auf direktes Zeichnen zurück)
  - `lc-audio.js` alle Töne und Musik live erzeugt (keine Audiodateien)
  - `lc-map.js` Minimap (dreht mit), große Karte (Taste M; Maus: verschieben, zoomen, Markierungen), Kanten-Monitore im Buggy
  - `lc-avatar.js` Astronauten-Figur und Emotes (X, dann Zahl); auch für Mitspieler gedacht
  - `lc-globe.js` ganzer Mond als Kugel (zweimal M) und Weltraum-Szene fürs Intro
  - `lc-cutscene.js` Intro (Anflug, Absturz, Blackout, Aufwachen), überspringbar
  - `lc-ui.js` HUD, Werkstatt-Fenster
  - `lc-main.js` Spielstand, Upgrades (`UP`), Preise, Ziele (`GOALS`), Hauptschleife, Speichern

## Nach JEDER Änderung
1. In `js/lc-main.js` `VERSION` hochzählen und in `index.html` bei allen `?v=` dieselbe Nummer eintragen (Browser-Cache).
2. Commit und Push auf `main`. GitHub Pages veröffentlicht automatisch (Branch `main`, Ordner `/`).
3. Dem Nutzer am Ende die neue Version (steht im Hauptmenü unten rechts) und den Spiel-Link mitschicken:
   https://ericgerandi-hub.github.io/Lunar-Clean-/ – und sagen: Seite mit Strg+F5 neu laden.

## Hinweise
- Alles, was der Nutzer sieht, auf Deutsch. Keine ZIP-Dateien schicken, außer er fragt danach.
- Der Nutzer will „richtig gute Grafik“: Änderungen immer mit echten Bildern prüfen.
- Testen: `python3 -m http.server` im Repo, Seite mit `?test=1` öffnen (keine Zeiger-Sperre nötig).
  `LC.debug` hilft: `tp(x, z, yaw, pitch)`, `fire(true)`, `sim(sekunden, fn)`, `money(n)`, `interact()`, `buy(id)`, `info()`.
  Chromium mit `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` macht echte Bilder (langsam, aber korrekt).
- Farben im Boden-Shader sind linear; Helligkeit regeln über `P.exposure` (lc-post.js) und die Sonne (lc-world.js).
- Gelände ändern = `heightAt` ändern; Gitter, Spieler, Zielring und Felsen lesen alle daraus.
- Mehrspieler ist geplant (2–3 Spieler, PeerJS wie bei Orbitalbrigade `ob-net.js`/`ob-mp.js`, Host rechnet die Welt).
  Deshalb: Spielzustand in `LC.G` und Staubänderungen nur über `LC.Dust.suck` halten.
- Wunsch des Nutzers: viele verschiedene Putz-Werkzeuge, die man nacheinander kauft (nicht nur einen Sauger upgraden);
  große Fahrzeuge kommen spät und haben eine eigene Entladestation. Werkzeug-Daten: `TOOLS` und `UP` in `lc-main.js`.
- Die Schattenkarte der Sonne steht still (`shadowMap.autoUpdate = false`); bewegte Dinge brauchen `shadowFrames = 2` oder einen eigenen weichen Schatten (Buggy).
- Zustände in `lc-main.js`: menu, cut (Intro), play, map, globe, shop, pause, wait. Tasten: Shift und C schalten um (Sprint/Hocke),
  C in der Luft mit Jetpack = sinken. Neue Ziele am Anfang verschieben `G.stage`: beim Laden über `gv` anpassen.
- Nächster großer Schritt, den der Nutzer bald will: Mehrspieler.
- Noch nicht gebaut (siehe Spielplan): Gleiter, Raumschiff, Putzroboter, Luftkanäle, Staubpresse, Drohnen,
  Händler mit schwankenden Preisen, Hangar/Garage/Solarpark, Rakete als Spielziel, Handy-Steuerung.
