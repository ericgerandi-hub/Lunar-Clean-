# Lunar Clean – Arbeitsweise

Deutsches First-Person-Browserspiel (three.js r128, ohne Build-Schritt). Live: https://ericgerandi-hub.github.io/Lunar-Clean-/
Spielplan (alle Entscheidungen des Nutzers): https://claude.ai/artifact/FeVhH9CZQZ79H8XFbVctzt

## Dateien
- `index.html` – Seite, komplettes CSS, HUD und Menüs (HTML).
- `lib/three.min.js` – three.js r128 (global `THREE`).
- `js/` – alles hängt am globalen `LC`. Ladereihenfolge steht unten in `index.html`.
  - `lc-util.js` Zufall, Rauschen, Text-Texturen
  - `lc-world.js` Gelände (`heightAt`), Krater, Boden-Shader (Staub/sauber/Glitzer), Himmel, Erde, Sonne, Felsen, Licht
  - `lc-dust.js` Staubkarten je Krater, 1024² (`suck`, `percentOf`, Speichern als Lauflängen-Kodierung)
  - `lc-base.js` Wrack, Staublager, Werkstatt, Landeplatz, Lampen; `colliders`, `points` (Benutzen mit E)
  - `lc-player.js` Laufen, Springen, Jetpack, Kollision
  - `lc-vacuum.js` Handwerkzeuge (Löffel, Schaufel, Sauger, XL) als Modelle in eigener Szene, Schaufeln/Saugen, Partikel, Zielring
  - `lc-sacks.js` Staubsäcke (Taste G füllen und werfen, E aufheben, max. 2 tragen)
  - `lc-buggy.js` Mondbuggy (fahren, Saugkopf, 1.500 kg Laderaum, Schlauch für den Handsauger) und Fahrzeug-Entladestation
  - `lc-robots.js` Putzroboter (`UP.robot`, bis 4): suchen den nächsten Staub (`D.nearest`), saugen, liefern selbst ab; E einpacken, R absetzen
  - `lc-glider.js` Schwebegleiter (fliegen, Saugrüssel, Laderaum, Mitflieger)
  - `lc-post.js` HDR, Bloom, Filmkurve (fällt ohne Float-Texturen auf direktes Zeichnen zurück)
  - `lc-audio.js` alle Töne und Musik live erzeugt (keine Audiodateien)
  - `lc-map.js` Minimap (dreht mit), große Karte (Taste M; Maus: verschieben, zoomen, Markierungen), Kanten-Monitore im Buggy
  - `lc-avatar.js` Astronauten-Figur und Emotes (X, dann Zahl); auch für Mitspieler gedacht
  - `lc-globe.js` ganzer Mond als Kugel (zweimal M) und Weltraum-Szene fürs Intro
  - `lc-cutscene.js` Intro (Anflug, Absturz, Blackout, Aufwachen), überspringbar
  - `lc-ui.js` HUD, Werkstatt-Fenster
  - `lc-net.js` Verbindung zwischen den Browsern (PeerJS 1.5.4 von unpkg, Stern-Form; `?net=bc` = BroadcastChannel zum Testen ohne Internet)
  - `lc-mp.js` Mehrspieler: Protokoll, Mitspieler-Figuren, gemeinsamer Buggy, Säcke, Kasse
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
- Mehrspieler (seit 0.6.0, bis 4 Spieler, Raum-Code): der Gastgeber besitzt Staubkarte, Geld, Upgrades, Säcke, Buggy und Sektor (gemeinsame Kasse).
  Gäste melden Putz-Bewegungen (`D.suck` ist in lc-mp.js umhüllt), Geld/Ladung als Differenzen (`d`), Käufe/Säcke/Buggy als Anfragen; der Gastgeber schickt 4-mal pro Sekunde `w` (Kasse, Buggy)
  und alle 50 s die ganze Staubkarte. Gäste speichern nie (`MP.guest`/`MP.wasGuest`), nur der Gastgeber fährt durch den Tunnel (alle kommen mit).
  Neues im Spiel deshalb immer so bauen: Zustand in `LC.G`, Staub nur über `LC.Dust.suck`, und in `mpctx` (lc-main.js) bzw. lc-mp.js mit abgleichen.
  Test mit zwei Seiten: Skript `mp.js` (Playwright, `?test=1&net=bc&room=TEST`, `LC.debug.MP.openAs/join`). Echte PeerJS-Verbindung geht in der Sandbox nicht.
- Wunsch des Nutzers: viele verschiedene Putz-Werkzeuge, die man nacheinander kauft (nicht nur einen Sauger upgraden);
  große Fahrzeuge kommen spät und haben eine eigene Entladestation. Werkzeug-Daten: `TOOLS` und `UP` in `lc-main.js`.
- Die Schattenkarte der Sonne steht still (`shadowMap.autoUpdate = false`); bewegte Dinge brauchen `shadowFrames = 2` oder einen eigenen weichen Schatten (Buggy).
- Zustände in `lc-main.js`: menu, cut (Intro), play, map, globe, shop, pause, wait. Tasten: Shift und C schalten um (Sprint/Hocke),
  C in der Luft mit Jetpack = sinken. Neue Ziele am Anfang verschieben `G.stage`: beim Laden über `gv` anpassen.
- Jedes freigeschaltete Teil bekommt eine kleine Anleitung: `help: [...]` am Eintrag in `UP` (Fenster nach dem Kauf, später über „Wie funktioniert das?“).
- Sektor gilt erst ab `DONE_AT` (Anzeige 100 %) als fertig; bis dahin leuchten Reste orange (`uHint`). Unter Bauten liegt kein Staub (`D.clearArea`), der Boden ist dort eben (`W.addFlat`).
- Rest-Finder: ab 98 % (`REST_AT`) zeigen Pfeile, Lichtsäulen und Ringe auf der Karte die letzten Staubflecken (`D.rests`, `updateRests` in lc-main.js, `LC.Map.rests`).
- OFFENE WELT (seit 0.9.0): beide Krater liegen in EINEM Gelände, alles in Welt-Koordinaten. Mittelpunkte `W.C[1] = (0,0)`, `W.C[2] = (60,-260)`;
  dazwischen der Pass `W.PASS` (Schlucht, `a` → `b`, halbe Breite `w`). `W.heightAt` mischt die zwei Krater (`secH`) und schneidet den Pass ein.
  `W.secAt(x,z)` / `W.side(x,z)`: Trennlinie zwischen den Kratern. `W.inside` / `W.clamp(p, rand)`: erlaubtes Gebiet (Krater 1, und wenn `W.open`: Pass + Krater 2).
  Zwei Gelände-Gitter (`W.terrains[n]`, Uniforms `W.tu[n]`), jedes zeichnet nur seine Seite der Trennlinie (discard im Shader). Zwei Staubkarten `D.maps[n]`
  (immer beide aktiv; `D.suck/clearArea/nearest/rests` nehmen Welt-Koordinaten, `D.serialize(n)`, `D.deserialize(n, str)`, `D.percentOf(n)`).
  „Aktueller Sektor“ (`W.sec`, `G.sec`) = der Krater, in dem der Spieler steht (`setSec` in lc-main.js; steuert Anzeige, Karte, Wegweiser, Sonnenschatten).
  Die Karte zeigt den aktuellen Krater (lc-map.js: `OX/OZ`). Das Upgrade `tunnel` heißt jetzt „Pass nach Sektor 2“ und öffnet das Tor (`B.setGate`, `openPass`).
  Alte Spielstände (`gv` < 3) werden beim Laden verschoben (Sektor-2-Koordinaten + `W.C[2]`). Krater-Listen, Flächen (`W.addFlat(…, n)`) sind relativ zum Krater.
- Putzroboter (seit 0.7.0): frei ab Sektor 1 blitzblank (`cond: 'sectorDone'`), arbeiten überall (Abgabe am Lager des Kraters, in dem sie stehen); im Mehrspieler rechnet sie der Gastgeber (`RB.net/netApply` in `w`), nur er packt sie ein.
- Staub ist eine sichtbare Schicht: der Boden-Shader hebt staubige Stellen um `uThick` (0,24 m) an. Start-Animation: `#loading` in index.html (reines CSS).
- Mitfahren im Buggy (Mehrspieler): `riding` in lc-main.js, Merker 16 im Spieler-Zustand; der Beifahrer hat den Bordsauger (saugt in den Laderaum).
- Schwebegleiter (seit 0.10.0, `lc-glider.js`, `UP.glider`): Leertaste/C hoch/runter, Saugrüssel unter `SUCK_ALT` (Stärke `GD.pull()`), Laderaum, Entladen auf Landeplatz/Station. Mitflieger: `riding === 'glider'`.
  Mehrspieler wie beim Buggy: `MP.gdrv`, Nachrichten `gin`/`gout`, Lage im Feld `g` der Spieler- und `w`-Nachricht, Merker 32 (fliegt) / 64 (fliegt mit).
- Spielstände (seit 0.11.0): 3 Plätze, `slotKey(n)` (Platz 1 = alter Schlüssel), aktiver Platz in `S.slot`, Auswahl-Fenster `#slots` (`openSlots`), `meta` im Spielstand für die Übersicht.
- Als Nächstes vom Nutzer gewünscht (12.11.): Trailer-Video, Tag/Nacht und Mondstürme, Bau-Hammer mit Bau-Menü (u. a. Glasröhren, die Staub sichtbar zum Verkauf leiten).
- Reihenfolge, die der Nutzer will: (Mehrspieler und Putzroboter sind fertig,) Automatisierung (Luftkanäle, Staubpresse, Drohnen), Rakete als echtes Ziel, eigene Gebäude an der Basis bauen.
- Noch nicht gebaut (siehe Spielplan): Gleiter, Raumschiff, Luftkanäle, Staubpresse, Drohnen,
  Händler mit schwankenden Preisen, Hangar/Garage/Solarpark, Rakete als Spielziel, Handy-Steuerung.
