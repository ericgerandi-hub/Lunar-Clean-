'use strict';
/* =========================================================
   Lunar Clean – Hauptprogramm: Spielstand, Regeln, Schleife
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World, D = LC.Dust, B = LC.Base, PL = LC.Player, V = LC.Vacuum, P = LC.Post, A = LC.Audio, UI = LC.UI, SK = LC.Sacks, BG = LC.Buggy, AV = LC.Avatar, GL = LC.Globe, CS = LC.Cutscene, MP = LC.MP, RB = LC.Robots, GD = LC.Glider, BD = LC.Build;
  const VERSION = '0.14.0';                 // nach jeder Änderung hochzählen
  const SAVE_KEY = 'lunarclean_save_v1', SET_KEY = 'lunarclean_settings_v1';
  const DONE_AT = 0.9995;                  // Sektor gilt erst als fertig, wenn die Anzeige 100 % zeigt
  const PRICE_N = 2, PRICE_G = 15;         // ¢ pro kg: normaler Staub / Glitzerstaub
  const TEST = /[?&]test/.test(location.search);

  // ---------- Upgrades ----------
  const UP = {
    shovel: { help: ["Taste 2 oder das Mausrad wählt die Schaufel, Taste 1 den Löffel.", "Linke Maustaste halten: ein Schwung nach dem anderen.", "Sie schafft pro Schwung etwa dreimal so viel wie der Löffel."],
      name: 'Schaufel', max: 1, costs: [30],
      desc: 'Schluss mit dem Löffel: Eine Schaufel schafft pro Schwung dreimal so viel.' },
    vac: { help: ["Taste 3 wählt den Handsauger.", "Linke Maustaste halten und über den Staub fahren. Der blaue Ring zeigt, wo er saugt.", "Er stottert noch – eine Reparatur macht ihn deutlich stärker.", "Ab jetzt kannst du Düse und Motor einzeln ausbauen."],
      name: 'Handsauger (gebraucht)', max: 1, costs: [120], needs: 'shovel',
      desc: 'Saugt, solange du die Maustaste hältst. Stammt aus dem Wrack und stottert leider ziemlich.' },
    repair: { help: ["Der Motor läuft wieder rund: kein Stottern mehr und rund 60 % mehr Saugkraft.", "Das Lämpchen am Sauger leuchtet jetzt grün."],
      name: 'Sauger reparieren', max: 1, costs: [150], needs: 'vac',
      desc: 'Schluss mit dem Stottern: Der Motor läuft wieder rund und saugt deutlich stärker.' },
    width: { name: 'Breitere Düse', max: 4, costs: [120, 350, 900, 2200], vals: [0.62, 0.85, 1.15, 1.55, 2.05], needs: 'vac',
      desc: 'Der Sauger nimmt eine größere Fläche auf einmal.', fmt: v => UI.n1(v * 2) + ' m breit' },
    power: { name: 'Stärkerer Motor', max: 3, costs: [150, 500, 1400], vals: [1, 1.5, 2.2, 3.2], needs: 'vac',
      desc: 'Der Sauger saugt schneller und reicht weiter.', fmt: v => Math.round(v * 100) + ' % Saugkraft' },
    tank: { help: ["Dein Staubbehälter fasst jetzt mehr.", "Ist er voll: zum Staublager laufen – oder mit G in einen Sack umfüllen und hinwerfen.", "Säcke hebst du mit E wieder auf (bis zu 2 gleichzeitig). Später lädt der Buggy sie im Vorbeifahren ein.", "In einen Sack passt immer genau ein voller Behälter."],
      name: 'Größerer Staubbehälter', max: 4, costs: [40, 150, 500, 1500], vals: [12, 30, 70, 160, 400],
      desc: 'Mehr Staub pro Tour. So viel passt auch in einen Sack.', fmt: v => UI.n0(v) + ' kg' },
    xl: { help: ["Taste 4 wählt den Industriesauger XL.", "Er saugt 60 % breiter und 70 % schneller als der Handsauger.", "Deine Upgrades für Düse und Motor wirken auch auf ihn."],
      name: 'Industriesauger XL', max: 1, costs: [2500], needs: 'repair',
      desc: 'Das große Gerät: saugt viel breiter und noch mal schneller. Düse und Motor zählen weiter mit.' },
    jet: { help: ["In der Luft die Leertaste gedrückt halten: Du steigst.", "C gedrückt halten: Du sinkst schneller, statt auf die Schwerkraft zu warten.", "Der Treibstoff lädt sich am Boden von allein wieder auf. Die Anzeige ist unten links."],
      name: 'Jetpack', max: 1, costs: [750],
      desc: 'Leertaste in der Luft gedrückt halten und abheben.' },
    fuel: { name: 'Jetpack-Treibstoff', max: 2, costs: [400, 1200], vals: [3.2, 5.5, 9], needs: 'jet',
      desc: 'Länger in der Luft bleiben.', fmt: v => UI.n1(v) + ' s Schub' },
    buggy: { help: ["Der Buggy steht neben der Basis. Mit E steigst du ein und wieder aus – du sitzt in einer geschlossenen Druckkabine.", "Fahren: W und S für Gas und Bremse, A und D zum Lenken, mit der Maus umsehen. Er fährt bis 18 m/s; bei hohem Tempo lenkt er ruhiger.", "Mit V schaltest du auf Außenansicht um und siehst den Buggy von hinten.", "Saugen: Linke Maustaste halten. Der Saugkopf vorn putzt eine über 4 m breite Spur direkt in den Laderaum (1.500 kg).", "Die zwei Bildschirme links und rechts zeigen die Saugkante. Die orange Linie ist das Ende deiner Spur – so fährst du Bahn an Bahn.", "Schlauch: Arbeitest du zu Fuß mit dem Sauger näher als 16 m am Buggy, geht der Staub direkt in den Buggy statt in deinen kleinen Behälter. Unten links steht dann „Buggy-Laderaum“.", "Säcke lädt der Buggy im Vorbeifahren von allein ein.", "Entladen: auf die gelb markierte Fahrzeug-Entladung neben dem Staublager fahren und E drücken."],
      name: 'Mondbuggy', max: 1, costs: [6000], needs: 'repair',
      desc: 'Fahren statt laufen: breiter Saugkopf vorn, 1.500 kg Laderaum, lädt Säcke ein. Mit Schlauch für deinen Handsauger. Entladen an der Fahrzeug-Station.' }
  };
  UP.bcap = { name: 'Buggy-Laderaum', max: 2, costs: [4000, 9000], vals: [1500, 3000, 6000], needs: 'buggy',
    desc: 'Mehr Staub pro Fahrt, bevor du entladen musst.', fmt: v => UI.n0(v) + ' kg' };
  UP.bhead = { name: 'Buggy-Saugkopf', max: 2, costs: [5000, 12000], vals: [2.2, 3.0, 3.8], needs: 'buggy',
    desc: 'Der Buggy putzt eine breitere Spur.', fmt: v => UI.n1(v * 2) + ' m breit' };
  UP.tunnel = { name: 'Pass nach Sektor 2', max: 1, costs: [12000], needs: 'buggy',
    help: ['Das Tor am Kraterrand im Norden ist jetzt offen – grünes Licht, die Schranken sind weg. Auf der Karte ist der Pass ein lila Streifen.', 'Fahr oder lauf einfach durch die Schlucht. Es gibt kein Umschalten mehr: beide Krater sind eine zusammenhängende Welt.', 'Sektor 2 ist mehr als doppelt so groß, mit rotem Roststaub, einem Berg in der Mitte und sechs Glitzerfeldern.', 'Gleich hinter dem Pass steht der Außenposten: Stell dich oder den Buggy auf die markierte Fläche und drück E, dann wird dein Staub dort gekauft.'],
    desc: 'Öffnet das Tor am Pass im Norden. Dahinter liegt ein viel größerer Krater mit rotem Roststaub und sechs Glitzerfeldern – ohne Ladepause einfach hinfahren.' };
  UP.robot = { name: 'Putzroboter', max: 4, costs: [4000, 9000, 20000, 45000], vals: [0, 1, 2, 3, 4], cond: 'sectorDone', condTxt: 'Erst Sektor 1 blitzblank putzen',
    help: ['Der Roboter steckt nach dem Kauf in deinem Gepäck. Geh dorthin, wo er putzen soll, und drück R – dann setzt du ihn ab.', 'Er fährt von allein zum nächsten Staub, saugt ihn auf (bis 300 kg) und bringt die Ladung selbst zum Staublager oder zum Außenposten. Das Geld landet direkt in deiner Kasse.', 'Mitnehmen: Stell dich neben ihn und drück E, dann ist er wieder im Gepäck – so kommt er auch mit durch den Tunnel.', 'Auf der Karte ist er ein grünes Dreieck. Grünes Licht: er putzt. Oranges Licht: er bringt Staub weg. Blaues Licht: kein Staub mehr da. Rotes Licht: es ist Nacht und er steht nicht im Kreis eines Lichtmasts – dann wartet er bis zum Morgen.', 'Mit dem Bau-Hammer lenkst du ihn: im gelben Kreis eines Lichtmasts arbeitet er auch nachts, im blauen Kreis einer Signalbake putzt er nur dort.', 'Jede weitere Stufe ist ein Roboter mehr (bis zu 4).'],
    desc: 'Putzt ganz von allein: fährt zum Staub, saugt und bringt die Ladung selbst zur Abgabe. Jede Stufe ist ein Roboter mehr.', fmt: v => v + (v === 1 ? ' Roboter' : ' Roboter') };
  UP.hammer = { name: 'Bau-Hammer', max: 1, costs: [4000], needs: 'vac',
    help: ['Mit B öffnest du das Bau-Menü. Mit den Zahlentasten wählst du, was du bauen willst – manches musst du dort erst einmal freischalten.', 'Dann zeigst du auf den Boden vor dir: Blau heißt „hier geht es“, Rot heißt „hier nicht“. Linke Maustaste baut, B oder die rechte Maustaste hört auf.', 'Glasröhre mit Einwurf: Stell den Einwurf dorthin, wo du gerade putzt. Die Röhre führt von selbst zum Staublager (in Sektor 2 zum Außenposten). Am Einwurf drückst du E – dein Staub wandert sichtbar durch das Glas und wird am Ende automatisch verkauft. Das geht auch mit dem Buggy.', 'Lichtmast: Putzroboter arbeiten im Dunkeln nicht. Setzt du sie im gelben Kreis eines Lichtmasts ab, putzen sie auch nachts – aber nur im Licht.', 'Signalbake: Roboter, die du in ihrem blauen Kreis absetzt, putzen nur innerhalb dieses Kreises. So schickst du sie genau dorthin, wo du sie haben willst.', 'Staubpresse: Gib mit E Staub hinein (auch die Buggy-Ladung). Sie presst ihn zu Ballen, etwa 9 kg pro Sekunde. Die Presse verkauft nichts: Hol die Ballen mit E ab (zu Fuß zwei auf einmal, mit dem Buggy alle) und bring sie selbst zum Staublager oder kipp sie in den Einwurf einer Glasröhre. Ballen sind 50 % mehr wert als loser Staub.', 'Die Kreise am Boden und auf der Karte zeigen immer, wie weit Lichtmast und Bake reichen.', 'Abreißen (im Bau-Menü): Du bekommst den halben Preis zurück.'],
    desc: 'Bau deine eigene Basis: Glasröhren, die deinen Staub von überall zum Verkauf leiten, Lichtmasten für die Nacht und Signalbaken.' };
  UP.glider = { name: 'Schwebegleiter', max: 1, costs: [30000], needs: 'tunnel',
    help: ['Der Gleiter steht auf dem Landeplatz neben der Basis. Mit E steigst du ein.', 'Fliegen: Leertaste hebt ab und steigt, C sinkt. W und S geben Schub, A und D drehen, mit der Maus siehst du dich um.', 'Er fliegt über beide Krater und den Pass – so bist du in Sekunden drüben. Aussteigen geht nur gelandet (mit C ganz runter, dann E).', 'Putzen aus der Luft: Unter dem Bauch hängt ein Saugrüssel. Flieg tiefer als 9 m und halte die linke Maustaste – je tiefer, desto stärker saugt er. Alles landet im Laderaum (2.500 kg).', 'Zu zweit: Fliegt dein Freund, drückst du am Gleiter E und fliegst mit. Dann bedienst du den großen Saugrüssel und zielst mit der Maus – viel breiter als der Pilot allein.', 'Entladen: auf dem Landeplatz oder einer Fahrzeug-Station landen und E drücken.', 'Mit V schaltest du auf Außenansicht um und siehst den Gleiter von hinten.'],
    desc: 'Fliegen statt fahren: schwebt über beide Krater, hat einen Saugrüssel zum Putzen aus der Luft und 2.500 kg Laderaum. Platz für Mitflieger.' };
  const UP_ORDER = ['shovel', 'vac', 'repair', 'width', 'power', 'tank', 'xl', 'jet', 'fuel', 'buggy', 'bcap', 'bhead', 'tunnel', 'hammer', 'glider', 'robot'];
  const inVeh = () => BG.driving || GD.driving;

  // Werkzeuge für die Hand (Tasten 1 bis 4)
  const TOOLS = [
    { id: 'spoon', name: 'Löffel', has: () => true },
    { id: 'shovel', name: 'Schaufel', has: () => G.up.shovel > 0 },
    { id: 'vac', name: 'Handsauger', has: () => G.up.vac > 0 },
    { id: 'xl', name: 'Sauger XL', has: () => G.up.xl > 0 }
  ];
  function bestTool() { let b = 'spoon'; TOOLS.forEach(t => { if (t.has()) b = t.id; }); return b; }
  function setTool(id, quiet) {
    const t = TOOLS.filter(x => x.id === id)[0];
    if (!t || !t.has()) return;
    G.tool = id; V.setTool(id);
    if (!quiet) A.play('click');
  }
  function cycleTool(dir) {
    const own = TOOLS.filter(t => t.has()); if (own.length < 2) return;
    let i = own.findIndex(t => t.id === G.tool); i = (i + dir + own.length) % own.length;
    setTool(own[i].id);
  }

  // ---------- Spielstand ----------
  const G = LC.G = {};
  function freshState() {
    G.money = 0; G.shown = 0;
    G.up = {}; UP_ORDER.forEach(k => { G.up[k] = 0; });
    G.tank = { n: 0, g: 0 };
    G.carry = [];              // getragene Säcke: [{n, g}]
    G.sec = 1;                 // in welchem Sektor man gerade ist
    G.bunlock = {};            // im Bau-Menü freigeschaltet
    G.clock = 0.17; G.day = 1; G.stormNext = 380 + Math.random() * 300; G.stormLeft = 0;      // Tageszeit (0..1), Tag-Zähler, Mondsturm
    G.marks = [];              // Markierungen auf der Karte (Welt-Koordinaten): [{x, z}]
    G.tool = 'spoon';
    G.stats = { kg: 0, earned: 0, time: 0, sold: 0, sectorDone: false, sector2Done: false, sec2Seen: false, intro: false, mapSeen: false, emoted: false };
    G.stage = 0;
  }
  const S = { sens: 1, vol: 0.7, music: true, gfx: 'mittel', full: true, name: '', slot: 1 };
  // mehrere Spielstände: Platz 1 benutzt den alten Schlüssel, damit vorhandene Spielstände bleiben
  const SLOTS = 3, slotKey = n => (n === 1 ? SAVE_KEY : SAVE_KEY + '_s' + n);
  const val = id => UP[id].vals[G.up[id]];
  const cap = () => val('tank');
  const tankTotal = () => G.tank.n + G.tank.g;
  const carryN = () => G.carry.reduce((a, c) => a + c.n, 0), carryG = () => G.carry.reduce((a, c) => a + c.g, 0);
  const tankWorth = () => (G.tank.n + carryN()) * PRICE_N + (G.tank.g + carryG()) * PRICE_G;
  const buggyWorth = () => BG.load.n * PRICE_N + BG.load.g * PRICE_G;

  function save() {
    if (MP.guest || MP.wasGuest) return;        // als Gast bleibt der eigene Spielstand unberührt
    try {
      let px = PL.pos.x, pz = PL.pos.z;
      if (BG.driving) { BG.exitPoint(tmpV); px = tmpV.x; pz = tmpV.z; }
      if (GD.driving || riding === 'glider') { GD.exitPoint(tmpV); px = tmpV.x; pz = tmpV.z; }
      localStorage.setItem(slotKey(S.slot), JSON.stringify({
        meta: { t: Date.now(), pc1: D.percentOf(1), pc2: D.percentOf(2) },
        v: 1, gv: 3, clock: G.clock, day: G.day, stormNext: G.stormNext, builds: BD.save(), bunlock: G.bunlock, marks: G.marks, money: G.money, up: G.up, tank: G.tank, stats: G.stats, stage: G.stage, tool: G.tool, carry: G.carry,
        sacks: SK.serialize(), buggy: BG.owned ? BG.serialize() : null, glider: GD.owned ? GD.serialize() : null, robots: RB.serialize(),
        pos: [px, pz, PL.yaw], dust: D.serialize(1), dust2: D.serialize(2)
      }));
    } catch (e) { /* Speicher voll oder gesperrt: Spiel läuft trotzdem weiter */ }
  }
  function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(S)); } catch (e) {} }
  function hasSave(n) { try { return !!localStorage.getItem(slotKey(n || S.slot)); } catch (e) { return false; } }
  const anySave = () => { for (let n = 1; n <= SLOTS; n++) if (hasSave(n)) return true; return false; };
  function load() {
    try {
      const raw = localStorage.getItem(slotKey(S.slot)); if (!raw) return false;
      const o = JSON.parse(raw); if (!o || o.v !== 1) return false;
      freshState();
      // Spielstände vor 0.9 (gv < 3): Sektor 2 hatte eigene Koordinaten – in die offene Welt verschieben
      const oldW = o.gv !== 3, C2 = W.C[2], sh = (x, z, sec) => (oldW && +sec === 2 ? [x + C2.x, z + C2.z] : [x, z]);
      G.money = +o.money || 0;
      if (o.clock != null) { G.clock = U.clamp(+o.clock || 0, 0, 1); G.day = Math.max(1, Math.floor(+o.day) || 1); G.stormNext = Math.max(60, +o.stormNext || 400); } G.shown = G.money;
      const old = !o.up || o.up.shovel === undefined;      // Spielstand von vor Version 0.3
      Object.keys(G.up).forEach(k => { G.up[k] = U.clamp(Math.floor(+(o.up || {})[k] || 0), 0, UP[k].max); });
      Object.assign(G.stats, o.stats || {}); G.stage = +o.stage || 0;
      if (old) { G.up.shovel = 1; G.up.vac = 1; G.stage = G.up.repair ? 6 : 5; }
      if (o.gv !== 2 && o.gv !== 3) { G.stage += 2; G.stats.intro = true; G.stats.mapSeen = true; G.stats.emoted = true; }   // vor Version 0.4: zwei neue Ziele am Anfang
      const mk = a => (Array.isArray(a) ? a : []).slice(0, 10).map(m => ({ x: +m.x || 0, z: +m.z || 0 }));
      G.marks = oldW && o.marksAll ? mk(o.marksAll[1]).concat(mk(o.marksAll[2]).map(m => ({ x: m.x + C2.x, z: m.z + C2.z }))).slice(0, 10) : mk(o.marks);
      W.open = G.up.tunnel > 0;
      const oldSec = oldW && o.sec === 2 && G.up.tunnel ? 2 : 1;
      G.tank.n = Math.max(0, +(o.tank || {}).n || 0); G.tank.g = Math.max(0, +(o.tank || {}).g || 0);
      const over = tankTotal() / cap(); if (over > 1) { G.tank.n /= over; G.tank.g /= over; }
      G.carry = (Array.isArray(o.carry) ? o.carry : []).slice(0, SK.CARRY).map(c => ({ n: Math.max(0, +c.n || 0), g: Math.max(0, +c.g || 0) }));
      G.tool = o.tool || bestTool();
      if (!o.dust || !D.deserialize(1, o.dust)) D.reset(1);
      if (!o.dust2 || !D.deserialize(2, o.dust2)) D.reset(2);
      SK.load((o.sacks || []).map(a => { const q = sh(+a[0] || 0, +a[1] || 0, a[4]); return [q[0], q[1], a[2], a[3]]; }));
      if (o.pos) { const q = sh(+o.pos[0] || 0, +o.pos[1] || 0, oldSec); PL.reset(q[0], q[1], +o.pos[2] || 0); } else PL.reset(B.spawn.x, B.spawn.z, B.spawn.yaw);
      if (!W.inside(PL.pos.x, PL.pos.z, 0)) PL.reset(B.spawn.x, B.spawn.z, B.spawn.yaw);
      BG.load.n = BG.load.g = 0;
      if (G.up.buggy && Array.isArray(o.buggy)) { const q = sh(+o.buggy[0] || BG.park.x, +o.buggy[1] || BG.park.z, o.buggy[5]); BG.setOwned(true); BG.place(q[0], q[1], +o.buggy[2] || 0); BG.load.n = Math.max(0, +o.buggy[3] || 0); BG.load.g = Math.max(0, +o.buggy[4] || 0); }
      else if (G.up.buggy) { BG.setOwned(true); BG.place(BG.park.x, BG.park.z, BG.park.heading); }
      else BG.setOwned(false);
      GD.setOwned(G.up.glider > 0); GD.load.n = GD.load.g = 0;
      if (GD.owned) { const gl = Array.isArray(o.glider) ? o.glider : [GD.park.x, GD.park.z, GD.park.heading, 0, 0]; GD.place(+gl[0] || GD.park.x, +gl[1] || GD.park.z, +gl[2] || 0); GD.load.n = Math.max(0, +gl[3] || 0); GD.load.g = Math.max(0, +gl[4] || 0); }
      G.bunlock = o.bunlock && typeof o.bunlock === 'object' ? { tube: !!o.bunlock.tube, press: !!o.bunlock.press } : {};
      BD.load(o.builds);
      RB.load((o.robots || []).map(a => { const q = sh(+a[1] || 0, +a[2] || 0, a[0]); return [a[0], q[0], q[1], a[3], a[4], a[5]]; }), G.up.robot);
      setSec(W.secAt(PL.pos.x, PL.pos.z), true);
      return true;
    } catch (e) { if (window.console) console.warn('Spielstand konnte nicht geladen werden:', e); return false; }
  }
  function newGame() {
    freshState(); W.open = false; D.reset(); PL.reset(B.spawn.x, B.spawn.z, B.spawn.yaw); setSec(1, true);
    SK.clear(); RB.clear(); BD.clear(); setBuild(null); BG.setOwned(false); BG.load.n = BG.load.g = 0; GD.setOwned(false); GD.driving = false; GD.load.n = GD.load.g = 0; selling = null;
    applyState();
    try { localStorage.removeItem(slotKey(S.slot)); } catch (e) {}
  }
  // ---------- Offene Welt ----------
  // ebene Flächen unter den Bauten (vor dem Aufbau des Geländes setzen; Angaben relativ zum jeweiligen Krater)
  function addFlats() {
    const s1 = BG.stations[1], s2 = BG.stations[2], C2 = W.C[2];
    W.addFlat(B.pad.x, B.pad.z, B.pad.r + 0.8, 0.05, 1); W.addFlat(s1.x, s1.z, 5.0, 0.05, 1);
    W.addFlat(s2.x - C2.x, s2.z - C2.z, 5.0, 0.05, 2);
  }
  // unter den Bauten und auf dem Pass liegt kein Staub; unsichtbare Reste zählen nicht
  function clearStatic() {
    D.clearArea(B.pad.x, B.pad.z, B.pad.r + 0.4);
    [1, 2].forEach(n => { const st = BG.stations[n]; D.clearArea(st.x, st.z, 2.8, 4.1, st.rot); });
    D.clearArea(W.PASS.a.x, W.PASS.a.z, W.PASS.w + 2.5, 0, 0, [W.PASS.b.x, W.PASS.b.z]);
    D.normalize();
  }
  // In welchem Krater steht der Spieler? Danach richten sich Anzeige, Karte, Wegweiser und Schatten.
  function setSec(n, force) {
    if (!force && W.sec === n && G.sec === n) return;
    W.setSector(n); G.sec = n;
    LC.Map.reconfigure(); LC.Map.home = n === 1 ? B.silo : BG.stations[2];
    shadowFrames = 3;
  }
  let travelFade = 0;
  function openPass(on) { W.open = !!on; B.setGate(W.open); }

  // ---------- Mehrspieler: was lc-mp von hier braucht ----------
  const mpctx = {
    version: VERSION,
    upName: id => UP[id] ? UP[id].name : id,
    shadow: () => { shadowFrames = 2; },
    // eigener Zustand für die Mitspieler: [x, y, z, Blick, Neigung, Merker, Werkzeug, Emote, Emote-Zeit]
    pstate: () => [+PL.pos.x.toFixed(2), +PL.pos.y.toFixed(2), +PL.pos.z.toFixed(2), +PL.yaw.toFixed(3), +PL.pitch.toFixed(2),
      (state === 'play' && !inVeh() && V.intensity > 0.2 ? 1 : 0) | (PL.jetting ? 2 : 0) | (PL.crouch ? 4 : 0) | (BG.driving ? 8 : 0) | (riding === 'buggy' ? 16 : 0) | (GD.driving ? 32 : 0) | (riding === 'glider' ? 64 : 0),
      MP.TOOL_IDS.indexOf(G.tool), emote ? AV.EMOTES.findIndex(e => e.id === emote.id) : -1, emote ? +emote.t.toFixed(2) : 0],
    snapshot: () => ({ sec: G.sec, dust: D.serialize(1) + '|' + D.serialize(2), sacks: SK.netList() }),
    // Gastgeber kauft im Auftrag eines Gastes
    buildFor: m => { const ok = buildDo(m); if (ok) save(); return ok; },
    buyFor: id => { const u = UP[id]; if (!u) return false; const lv = G.up[id]; if (lv >= u.max || G.money < u.costs[lv] || (u.needs && !G.up[u.needs]) || (u.cond && !G.stats[u.cond])) return false; buyCore(id); if (state === 'shop') renderShop(); save(); return true; },
    // Gast: Welt vom Gastgeber übernehmen
    applySnap: (kind, sec, dust, sacks, eco) => {
      const dd = String(dust).split('|');
      if (kind === 'sync') { D.deserialize(1, dd[0]); D.deserialize(2, dd[1] || ''); return; }
      if (BG.driving) { BG.driving = false; BG.speed = 0; BG.suck = 0; A.setBuggy(false, 0); }
      selling = null; BG.unloading = false; riding = false;
      MP.wasGuest = true; RB.clear(); BD.clear(); freshState(); G.stats.intro = G.stats.mapSeen = G.stats.emoted = true; BG.setOwned(false); BG.load.n = BG.load.g = 0;
      if (!D.deserialize(1, dd[0])) D.reset(1);
      if (!D.deserialize(2, dd[1] || '')) D.reset(2);
      SK.netLoad(sacks);
      mpctx.applyEco(eco); G.tool = bestTool(); applyState();
      const k = MP.myColor || 1;
      PL.reset(B.spawn.x + Math.cos(k * 2.1) * 2.2, B.spawn.z + Math.sin(k * 2.1) * 2.2, B.spawn.yaw); setSec(1, true);
      shadowFrames = 3;
    },
    // Gast: Geld-Stand, Upgrades und Ziele kommen vom Gastgeber
    applyEco: e => {
      let ch = false;
      UP_ORDER.forEach(k => {
        const v = U.clamp(Math.floor(+e.up[k] || 0), 0, UP[k].max); if (v === G.up[k]) return;
        G.up[k] = v; ch = true;
        if (k === 'repair') V.setRepaired(v > 0);
        if (k === 'tunnel') openPass(v > 0);
        if (k === 'buggy') BG.setOwned(v > 0);
        if (k === 'glider') GD.setOwned(v > 0);
      });
      if (e.bu) { G.bunlock = e.bu; } if (Array.isArray(e.bl)) { if (BD.sync(e.bl)) shadowFrames = 2; }
      if (e.ph != null) { G.clock = +e.ph || 0; G.day = e.day || 1; G.stormLeft = e.st ? 30 : 0; }
      ['sectorDone', 'sector2Done', 'sec2Seen', 'bonusPaid', 'bonus2Paid'].forEach(k => { G.stats[k] = !!e.stats[k]; });
      G.stage = +e.stage || 0;
      if (ch) { BG.CAP = val('bcap'); BG.headR = val('bhead'); const t = TOOLS.filter(x => x.id === G.tool)[0]; if (!t || !t.has()) setTool(bestTool(), true); }
      if (state === 'shop') { if (ch || Math.floor(e.money) !== lastShopMoney) { lastShopMoney = Math.floor(e.money); renderShop(); } }
    },
    event: m => {
      if (m.k === 'buy') {
        if (m.by === MP.id) { A.play('buy'); if (m.id === 'shovel' || m.id === 'vac' || m.id === 'xl') setTool(m.id, true); if (UP[m.id].help && G.up[m.id] === 1) showHelp(m.id, true); }
        else UI.toast(MP.nameOf(m.by) + ' hat gekauft: ' + UP[m.id].name, 'gold', 4);
        if (m.id === 'buggy') UI.toast('Der Mondbuggy steht neben der Basis bereit!', 'gold', 5);
      } else if (m.k === 'done') {
        A.play('goal'); UI.toast('SEKTOR ' + (m.sec || G.sec) + ' IST BLITZBLANK!', 'big', 6);
        if (m.bonus) UI.toast('Sektor-Bonus: + ' + UI.n0(m.bonus) + ' ¢', 'gold', 6);
      }
    },
    gotSack: (n, g, bg) => {
      if (bg) { BG.load.n += n; BG.load.g += g; A.play('thump'); UI.toast('Sack eingeladen', '', 1.5); }
      else if (G.carry.length < SK.CARRY) { G.carry.push({ n, g }); A.play('click'); }
      else throwSack(n, g);
    },
    enterGlider: () => { if (state === 'play' && !inVeh() && !selling && !emote) enterGlider(); else MP.leftGlider(); },
    exitGlider: () => { if (GD.driving) { GD.driving = false; GD.suck = 0; A.setBuggy(false, 0); GD.exitPoint(tmpV); PL.reset(tmpV.x, tmpV.z, GD.heading); } },
    enterBuggy: () => { if (state === 'play' && !inVeh() && !selling && !emote) enterBuggy(); else MP.leftBuggy(); },
    exitBuggy: () => { if (BG.driving) { selling = null; BG.unloading = false; BG.driving = false; BG.speed = 0; BG.suck = 0; A.setBuggy(false, 0); BG.exitPoint(tmpV); PL.reset(tmpV.x, tmpV.z, BG.heading); } }
  };
  let lastShopMoney = -1;

  function applyState() {
    clearStatic();
    // wurde Sektor 1 in einer älteren Version zu früh als fertig gemeldet? Dann geht es weiter
    if (G.stats.sectorDone && D.percentOf(1) < DONE_AT) { G.stats.sectorDone = false; G.stats.bonusPaid = true; G.stage = Math.min(G.stage, GOALS.findIndex(g => g.k === 's1')); }
    LC.Map.marks = G.marks;
    BG.CAP = val('bcap'); BG.headR = val('bhead');
    openPass(G.up.tunnel > 0); BG.refresh();
    V.setRepaired(G.up.repair > 0);
    const t = TOOLS.filter(x => x.id === G.tool)[0];
    if (!t || !t.has()) G.tool = bestTool();
    V.setTool(G.tool);
  }

  // ---------- Aufbau ----------
  let renderer, scene, camera, lamp, lampOn = true, state = 'load', time = 0, lastT = 0, fire = false;
  let sunlit = 1, sunlitT = 0, saveT = 0, selling = null, coinT = 0, limitT = 0, fullBeep = false, hintT = 0;
  let fpsAcc = 0, fpsN = 0, pxRatio = 1, shadowFrames = 4, keysT = 0;
  const hintShown = {};
  let perfT = 0, perfN = 0, perfDone = false;
  const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();

  function pixelRatio() {
    const d = window.devicePixelRatio || 1;
    return S.gfx === 'niedrig' ? Math.min(d, 1) * 0.75 : S.gfx === 'hoch' ? Math.min(d, 2) : Math.min(d, 1.25);
  }

  function buildEnv() {
    const es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, uniforms: { sun: { value: W.SUN_DIR }, earth: { value: W.EARTH_DIR } },
      vertexShader: 'varying vec3 vD;\nvoid main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform vec3 sun; uniform vec3 earth; varying vec3 vD;',
        'void main(){ vec3 d = normalize(vD); float s = max(dot(d, sun), 0.0);',
        ' vec3 c = vec3(0.006, 0.008, 0.012);',
        ' c += vec3(1.0, 0.95, 0.85) * (pow(s, 300.0) * 9.0 + pow(s, 24.0) * 0.25);',
        ' c += vec3(0.2, 0.42, 0.9) * pow(max(dot(d, earth), 0.0), 120.0) * 2.5;',
        ' float g = smoothstep(0.06, -0.12, d.y);',
        ' c = mix(c, vec3(0.20, 0.185, 0.17) * (0.55 + 0.6 * max(dot(normalize(vec3(d.x, 0.0, d.z) + vec3(1e-4, 0.0, 0.0)), normalize(vec3(-sun.x, 0.0, -sun.z))), 0.0)), g);',
        ' gl_FragColor = vec4(c, 1.0);',
        ' #include <encodings_fragment>',
        '}'
      ].join('\n')
    })));
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(es, 0.03);
    pm.dispose();
    return rt.texture;
  }

  function init() {
    const canvas = document.getElementById('c');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
    renderer.setClearColor(0x000000, 1);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(74, 1, 0.08, 9000);
    scene.add(camera);

    try { Object.assign(S, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) {}
    if (['niedrig', 'mittel', 'hoch'].indexOf(S.gfx) < 0) S.gfx = 'mittel';

    addFlats();
    D.init();
    W.build(scene, D.tex, D.glitTex);
    if (S.gfx === 'niedrig') W.sun.shadow.mapSize.set(2048, 2048);
    B.build(scene);
    V.init(scene);
    avatar = AV.build(); avatar.root.visible = false; scene.add(avatar.root);
    SK.init(scene, s => { shadowFrames = 2; A.play('thump'); V.kickDust(s.x, s.y, s.z, 12, 0.9); });
    BG.init(scene); GD.init(scene); BD.init(scene);
    B.buildOutpost(scene); B.finish(); LC.Map.home = B.silo;
    const env = buildEnv();
    scene.environment = env; V.scene.environment = env;

    // Helmlampe
    lamp = new THREE.SpotLight(0xdfeaff, 1.25, 32, 0.72, 0.8, 1.2);
    lamp.position.set(0.15, 0.1, 0); lamp.target.position.set(0, -0.12, -1);
    camera.add(lamp); camera.add(lamp.target);

    pxRatio = pixelRatio();
    renderer.setPixelRatio(pxRatio);
    resize(true);
    window.addEventListener('resize', () => resize(false));

    LC.Map.init();
    RB.init(scene);
    MP.init(mpctx, scene);
    freshState();
    if (!load()) { freshState(); W.open = false; D.reset(); SK.clear(); BG.setOwned(false); PL.reset(B.spawn.x, B.spawn.z, B.spawn.yaw); setSec(1, true); }
    applyState();
    A.vol = S.vol; A.music = S.music; PL.sens = S.sens;

    bindInput();
    bindUI();
    UI.el.ver.textContent = 'Version ' + VERSION;
    try { if (window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches) document.getElementById('touch').classList.remove('hidden'); } catch (e) {}
    S.slot = U.clamp(Math.floor(+S.slot) || 1, 1, SLOTS);
    UI.el['btn-play'].textContent = anySave() ? 'Weiterspielen' : 'Spielen';
    UI.show('btn-new', hasSave());
    setState('menu');
    // Start-Animation zu Ende laufen lassen (Klick überspringt sie)
    const ld = UI.el.loading, done = () => { ld.classList.add('out'); setTimeout(() => ld.classList.add('hidden'), 850); };
    if (TEST) ld.classList.add('hidden');
    else { const tm = setTimeout(done, Math.max(300, 3700 - performance.now())); ld.addEventListener('click', () => { clearTimeout(tm); done(); }); }
    lastT = performance.now();
    requestAnimationFrame(frame);
  }

  function resize(first) {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const bw = Math.floor(w * pxRatio), bh = Math.floor(h * pxRatio);
    if (first) P.init(renderer, bw, bh, S.gfx); else P.setSize(renderer, bw, bh, S.gfx);
    V.resize(w / h, bh);
  }

  // ---------- Zustände ----------
  const $ = id => document.getElementById(id);
  const showEl = (id, on) => $(id).classList.toggle('hidden', !on);
  function setState(s) {
    state = s;
    UI.show('menu', s === 'menu'); UI.show('ver', s === 'menu');
    UI.show('pause', s === 'pause'); UI.show('shop', s === 'shop');
    UI.show('hud', s === 'play' || s === 'shop' || s === 'pause' || s === 'wait' || s === 'map');
    showEl('globe-ui', s === 'globe'); showEl('cine', s === 'cut'); if (s !== 'shop') showEl('info', false);
    if (s !== 'play') { fire = false; PL.keys = {}; PL.mdx = PL.mdy = 0; A.setJet(0); endEmote(); setEmoteMenu(false); }
    if (s !== 'cut') { $('black').style.opacity = 0; $('flash').style.opacity = 0; }
    showEl('keys', s !== 'map');
    if (s === 'pause') { renderStats(); showEl('row-wipe', !MP.active); $('pause-sub').textContent = MP.guest ? 'Mehrspieler · Raum ' + MP.code + ' · Die Welt gehört ' + (MP.hostName || 'dem Gastgeber') + ' und wird dort gespeichert.' : MP.host ? 'Mehrspieler · Raum ' + MP.code + ' · Das Spiel läuft für die anderen weiter.' : 'Dein Fortschritt wird automatisch gespeichert.'; }
    if (s === 'shop') renderShop();
    if (s === 'play') { keysT = keysT || time + 16; }
    if (s !== 'map' && LC.Map.open) LC.Map.setOpen(false);
    document.body.style.cursor = s === 'play' || s === 'cut' ? 'none' : 'default';
  }
  // nach dem Klick auf „Spielen“: erst das Intro (bei neuem Spiel), dann los
  let pendingIntro = false;
  const cctx = {
    sub: (txt, cls) => { const e = $('cine-sub'); e.textContent = txt; e.className = cls || ''; },
    fade: v => { $('black').style.opacity = 1 - U.clamp(v, 0, 1); },
    flash: v => { $('flash').style.opacity = U.clamp(v, 0, 1); },
    done: () => { G.stats.intro = true; if (state === 'cut') { setState('play'); UI.toast('Ziel: Verdiene dir die Rakete nach Hause.', 'big', 5); } }
  };
  function enterGame() {
    if (pendingIntro) { pendingIntro = false; cctx.scene = scene; cctx.camera = camera; setState('cut'); CS.start(cctx); }
    else setState('play');
  }
  function lock() {
    if (TEST) { enterGame(); return; }
    const c = renderer.domElement;
    try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  // Vollbild: blendet Adressleiste und Tabs aus
  function goFull() {
    if (TEST || !S.full || document.fullscreenElement) return;
    const el = document.documentElement, fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn) return;
    try { const p = fn.call(el); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  function setFull(on) {
    S.full = on; saveSettings();
    UI.el['btn-full'].textContent = 'Vollbild: ' + (on ? 'An' : 'Aus'); UI.el['set-full'].checked = on;
    if (!on && document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) {} }
  }
  function startPlay(intro) {
    pendingIntro = !!intro && (!TEST || /[?&]intro/.test(location.search));
    A.init(); A.setVolume(S.vol); A.setMusic(S.music); goFull(); lock();
  }

  // ---------- Karte (M) und Mond-Ansicht (noch mal M) ----------
  function openMap() {
    if (emote || selling) return;
    setState('map'); LC.Map.setOpen(true); A.play('click');
    if (!TEST && document.pointerLockElement) document.exitPointerLock();
  }
  function openGlobe() {
    GL.open(G.sec, G.up.tunnel > 0); G.stats.mapSeen = true;
    $('globe-pin').firstChild.innerHTML = G.sec === 2 ? 'SEKTOR 2<b>Roststaub-Krater · du bist hier</b>' : 'SEKTOR 1<b>Absturzstelle · du bist hier</b>'; setState('globe'); A.play('click');
    const moonArea = 3.793e13, cleaned = cleanedArea();
    $('globe-pc').textContent = (cleaned / moonArea * 100).toFixed(10).replace('.', ',') + ' %';
    $('globe-sec').textContent = 'Sektor 1: ' + UI.n1(D.percentOf(1) * 100) + ' % sauber' + (G.up.tunnel ? ' · Sektor 2: ' + UI.n1(D.percentOf(2) * 100) + ' %' : '');
  }
  function closeMap() {
    A.play('click');
    if (TEST) { setState('play'); return; }
    setState('wait'); goFull(); lock();
    setTimeout(() => { if (state === 'wait') setState('pause'); }, 700);
  }

  // ---------- Emotes (X, dann Zahl) ----------
  let emote = null, emoteMenu = false, emoteMenuT = 0, avatar = null;
  function setEmoteMenu(on) {
    emoteMenu = on; emoteMenuT = 6;
    const e = $('emotes'); if (!e) return;
    e.classList.toggle('hidden', !on);
    if (on && !e.firstChild) AV.EMOTES.forEach((m, i) => { const d = document.createElement('span'); const k = document.createElement('kbd'); k.textContent = i + 1; d.appendChild(k); d.appendChild(document.createTextNode(m.name)); e.appendChild(d); });
  }
  function startEmote(i) {
    const m = AV.EMOTES[i];
    if (!m || BG.driving || !PL.onGround || selling) return;
    emote = { id: m.id, t: 0, dur: m.dur }; setEmoteMenu(false);
    G.stats.emoted = true; PL.vel.set(0, 0, 0); PL.sprint = false; PL.crouch = false; fire = false; A.play('click');
  }
  function endEmote() { emote = null; if (avatar) avatar.root.visible = false; }

  function bindInput() {
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === renderer.domElement;
      if (locked) enterGame();
      else if (state === 'play') { setState('pause'); save(); }
      else if (state === 'cut') { setState('pause'); CS.skip(true); }
    });
    document.addEventListener('pointerlockerror', () => { if (state === 'wait') setState('pause'); });
    document.addEventListener('mousemove', e => {
      if (state === 'globe') { if (e.buttons & 1) GL.drag(e.movementX || 0, e.movementY || 0); return; }
      if (state !== 'play') return;
      if (TEST && !(e.buttons & 2)) return;
      PL.mdx += e.movementX || 0; PL.mdy += e.movementY || 0;
    });
    document.addEventListener('mousedown', e => {
      if (state === 'play' && buildSel && e.button === 0) buildClick();
      else if (state === 'play' && buildSel && e.button === 2) setBuild(null);
      else if (state === 'play' && e.button === 0) fire = true;
      else if (state === 'cut') CS.skip();
    });
    document.addEventListener('mouseup', e => { if (e.button === 0) fire = false; });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('wheel', e => {
      if (state === 'play' && !inVeh()) cycleTool(e.deltaY > 0 ? 1 : -1);
      else if (state === 'globe') GL.zoom(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });
    // Musik schon im Menü: der Browser erlaubt Ton erst nach dem ersten Klick oder Tastendruck
    const firstTouch = () => { A.init(); A.setVolume(S.vol); A.setMusic(S.music); document.removeEventListener('pointerdown', firstTouch); document.removeEventListener('keydown', firstTouch); };
    document.addEventListener('pointerdown', firstTouch); document.addEventListener('keydown', firstTouch);
    document.addEventListener('keydown', e => {
      if (state === 'play') {
        if (buildMenu && /^Digit[1-5]$/.test(e.code)) { if (!e.repeat) buildPick(+e.code.slice(5) - 1); e.preventDefault(); return; }
        if (emoteMenu && /^Digit[1-6]$/.test(e.code)) { if (!e.repeat) startEmote(+e.code.slice(5) - 1); e.preventDefault(); return; }
        PL.keys[e.code] = true;
        if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].indexOf(e.code) >= 0) e.preventDefault();
        if (e.repeat) return;
        if (emote && e.code !== 'KeyX') return;
        switch (e.code) {
          case 'KeyE': interact(); break;
          case 'KeyG': sackKey(); break;
          case 'KeyR': placeRobot(); break;
          case 'KeyV': toggleView(); break;
          case 'KeyB': if (G.up.hammer && !inVeh() && !riding) { if (buildSel || buildMenu) { setBuild(null); setBuildMenu(false); } else setBuildMenu(true); } break;
          case 'KeyF': lampOn = !lampOn; A.play('click'); break;
          case 'KeyM': openMap(); break;
          case 'KeyX': if (emote) endEmote(); else if (!inVeh()) setEmoteMenu(!emoteMenu); break;
          case 'ShiftLeft': case 'ShiftRight': if (!inVeh()) { PL.sprint = !PL.sprint; if (PL.sprint) PL.crouch = false; } break;
          case 'KeyC': if (!inVeh() && PL.onGround) { PL.crouch = !PL.crouch; if (PL.crouch) PL.sprint = false; } break;
          case 'Escape': if (TEST) setState('pause'); break;
          default:
            if (/^Digit[1-4]$/.test(e.code) && !inVeh()) { const t = TOOLS[+e.code.slice(5) - 1]; if (t.has()) setTool(t.id); else { A.play('deny'); UI.toast(t.name + ' hast du noch nicht – gibt es in der Werkstatt.', '', 2.2); } }
        }
      } else if (state === 'shop') {
        if (!$('info').classList.contains('hidden')) { if (!e.repeat && (e.code === 'Enter' || e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Space')) hideHelp(); }
        else if ((e.code === 'KeyE' || e.code === 'Escape') && !e.repeat) closeShop();
      } else if (state === 'map') {
        if (e.code === 'KeyM' && !e.repeat) openGlobe(); else if (e.code === 'Escape') closeMap();
      } else if (state === 'globe') {
        if ((e.code === 'KeyM' || e.code === 'Escape') && !e.repeat) closeMap();
      } else if (state === 'cut') {
        if (e.code === 'Space' || e.code === 'Enter') { CS.skip(); e.preventDefault(); }
      }
    });
    document.addEventListener('keyup', e => { PL.keys[e.code] = false; });
    window.addEventListener('blur', () => { PL.keys = {}; fire = false; });
    window.addEventListener('beforeunload', () => { if (state !== 'menu' || G.stats.time > 0) save(); if (MP.active) LC.Net.close(); });
  }

  function bindUI() {
    const e = UI.el;
    e['btn-play'].addEventListener('click', () => {
      if (MP.guest || MP.host || !anySave()) startPlay(!MP.guest && !G.stats.intro && G.stats.time < 1);
      else openSlots();
    });
    $('slots-back').addEventListener('click', () => showEl('slots', false));
    e['btn-new'].addEventListener('click', () => { if (MP.active) MP.leave(); newGame(); shadowFrames = 3; startPlay(true); });
    e['btn-resume'].addEventListener('click', () => startPlay());
    e['btn-tomenu'].addEventListener('click', () => {
      if (MP.guest || mpLost) { location.reload(); return; }       // zurück zum eigenen Spielstand
      if (BG.driving) exitBuggy();
      save(); if (MP.active) { MP.leave(); UI.toast('Mehrspieler-Raum geschlossen.', '', 3); }
      UI.el['btn-play'].textContent = 'Weiterspielen'; UI.show('btn-new', true); setState('menu');
    });
    bindMP();
    e['btn-shopclose'].addEventListener('click', closeShop);
    $('btn-info').addEventListener('click', hideHelp);
    let wipeArmed = 0;
    e['btn-wipe'].addEventListener('click', () => {
      if (performance.now() - wipeArmed < 4000) { newGame(); e['btn-wipe'].textContent = 'Löschen und neu anfangen'; wipeArmed = 0; shadowFrames = 3; startPlay(true); }
      else { wipeArmed = performance.now(); e['btn-wipe'].textContent = 'Wirklich löschen? Nochmal klicken'; setTimeout(() => { e['btn-wipe'].textContent = 'Löschen und neu anfangen'; }, 4000); }
    });
    e['set-sens'].value = S.sens; e['set-vol'].value = S.vol; e['set-music'].checked = S.music; e['set-gfx'].value = S.gfx;
    e['set-sens'].addEventListener('input', () => { S.sens = +e['set-sens'].value; PL.sens = S.sens; saveSettings(); });
    e['set-vol'].addEventListener('input', () => { S.vol = +e['set-vol'].value; A.setVolume(S.vol); saveSettings(); });
    setFull(S.full !== false);
    e['btn-full'].addEventListener('click', () => { setFull(!S.full); if (S.full) goFull(); });
    e['set-full'].addEventListener('change', () => { setFull(e['set-full'].checked); if (S.full) goFull(); });
    e['set-music'].addEventListener('change', () => { S.music = e['set-music'].checked; A.setMusic(S.music); saveSettings(); });
    e['set-gfx'].addEventListener('change', () => {
      S.gfx = e['set-gfx'].value; saveSettings(); perfDone = true;
      pxRatio = pixelRatio(); renderer.setPixelRatio(pxRatio); resize(false);
    });
  }

  // ---------- Rest-Finder: die letzten Staubflecken ----------
  const REST_AT = 0.98, REST_N = 6;
  let restT = 0, rests = [], restBeams = null, restEls = null, restSec = 0;
  function updateRests(dt, pc, open) {
    const on = open && pc >= REST_AT;
    if (!restBeams) {
      restBeams = []; restEls = [];
      const geo = new THREE.CylinderGeometry(0.07, 0.2, 34, 8, 1, true); geo.translate(0, 17, 0);
      for (let i = 0; i < REST_N; i++) {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.25, 0.25), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        m.visible = false; m.renderOrder = 4; scene.add(m); restBeams.push(m);
      }
      const box = $('rests');
      for (let i = 0; i < 3; i++) { const e = document.createElement('div'); e.className = 'rest hidden'; e.innerHTML = '<i></i><span></span>'; box.appendChild(e); restEls.push(e); }
    }
    if (!on) {
      if (rests.length) { rests = []; LC.Map.rests = rests; restBeams.forEach(m => { m.visible = false; }); restEls.forEach(e => e.classList.add('hidden')); showEl('rest-n', false); }
      restT = 0; return;
    }
    restT -= dt;
    if (restT <= 0 || restSec !== G.sec) {
      restT = 0.6; restSec = G.sec;
      const px = BG.driving ? BG.pos.x : PL.pos.x, pz = BG.driving ? BG.pos.z : PL.pos.z;
      rests = D.rests(px, pz, REST_N); LC.Map.rests = rests;
      for (let i = 0; i < REST_N; i++) { const m = restBeams[i], r = rests[i]; m.visible = !!r; if (r) m.position.set(r.x, W.heightAt(r.x, r.z), r.z); }
      showEl('rest-n', rests.total > 0);
      $('rest-n').textContent = rests.total === 1 ? 'Noch 1 Staubrest – folge dem Pfeil' : 'Noch ' + rests.total + ' Staubreste – folge den Pfeilen';
      if (!restShown[G.sec] && rests.total) { restShown[G.sec] = true; UI.toast('Fast geschafft! Pfeile und Lichtsäulen zeigen dir die letzten Staubreste.', 'gold', 7); }
    }
    const pulse = 0.38 + 0.2 * Math.sin(time * 4);
    restBeams.forEach(m => { m.material.opacity = pulse; });
    const cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < 3; i++) {
      const e = restEls[i], r = rests[i];
      if (!r) { e.classList.add('hidden'); continue; }
      const dist = Math.hypot(r.x - cx, r.z - cz);
      toScreen(r.x, W.heightAt(r.x, r.z) + (dist < 6 ? 0.4 : 2.2), r.z);
      e.classList.remove('hidden'); e.classList.toggle('near', i === 0);
      // am Bildrand: Pfeil zeigt in die Richtung, sonst nach unten auf die Stelle
      const ex = scr.x - window.innerWidth / 2, ey = scr.y - window.innerHeight / 2;
      const edge = Math.abs(ex) > window.innerWidth * 0.455 || Math.abs(ey) > window.innerHeight * 0.425;
      e.style.transform = 'translate(' + scr.x.toFixed(0) + 'px,' + scr.y.toFixed(0) + 'px) translate(-50%,-50%)';
      e.firstChild.style.transform = 'rotate(' + (edge ? Math.atan2(ey, ex) - Math.PI / 2 : 0).toFixed(2) + 'rad)';
      e.lastChild.textContent = dist < 1.5 ? 'HIER' : Math.round(dist) + ' m';
    }
  }
  const restShown = {};

  // ---------- Spielstände ----------
  function openSlots() {
    const box = $('slot-list'); box.innerHTML = '';
    const fmtT = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? h + ' h ' + m + ' min' : m + ' min'; };
    for (let n = 1; n <= SLOTS; n++) {
      let o = null; try { o = JSON.parse(localStorage.getItem(slotKey(n)) || 'null'); } catch (e) {}
      const row = document.createElement('div'); row.className = 'slot' + (n === S.slot ? ' cur' : '');
      const info = document.createElement('div'); info.className = 'si';
      const h = document.createElement('b'); h.textContent = 'SPIELSTAND ' + n + (n === S.slot && o ? ' · zuletzt gespielt' : ''); info.appendChild(h);
      const d = document.createElement('span');
      if (o) {
        const mt = o.meta || {}, p1 = mt.pc1 != null ? UI.n1(Math.floor(mt.pc1 * 1000) / 10) + ' %' : '?', p2 = mt.pc2 != null && o.up && o.up.tunnel ? ' · Sektor 2: ' + UI.n1(Math.floor(mt.pc2 * 1000) / 10) + ' %' : '';
        d.textContent = UI.n0(Math.floor(+o.money || 0)) + ' ¢ · Sektor 1: ' + p1 + p2 + ' · ' + fmtT(o.stats && +o.stats.time || 0) + (mt.t ? ' · ' + new Date(mt.t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
      } else d.textContent = 'Leer – hier kannst du ein neues Spiel anfangen.';
      info.appendChild(d); row.appendChild(info);
      const go = document.createElement('button'); go.className = 'pri small'; go.textContent = o ? 'Spielen' : 'Neues Spiel';
      go.addEventListener('click', () => {
        if (state !== 'menu') return;
        const sw = n !== S.slot;
        if (sw && (G.stats.time > 0 || hasSave())) save();          // den bisherigen Stand sichern, bevor gewechselt wird
        S.slot = n; saveSettings();
        if (!o) { newGame(); shadowFrames = 3; showEl('slots', false); startPlay(true); return; }
        if (sw) { if (!load()) newGame(); shadowFrames = 3; }
        showEl('slots', false); startPlay(!G.stats.intro && G.stats.time < 1);
      });
      row.appendChild(go);
      if (o) {
        const del = document.createElement('button'); del.className = 'small'; del.textContent = 'Löschen'; let armed = 0;
        del.addEventListener('click', () => {
          if (performance.now() - armed > 4000) { armed = performance.now(); del.textContent = 'Wirklich? Nochmal klicken'; setTimeout(() => { del.textContent = 'Löschen'; }, 4000); return; }
          try { localStorage.removeItem(slotKey(n)); } catch (e) {}
          if (n === S.slot) { const k = S.slot; newGame(); S.slot = k; shadowFrames = 3; }
          UI.el['btn-play'].textContent = anySave() ? 'Weiterspielen' : 'Spielen';
          openSlots();
        });
        row.appendChild(del);
      }
      box.appendChild(row);
    }
    showEl('slots', true);
  }

  // ---------- Mehrspieler-Fenster ----------
  let mpLost = false;
  function bindMP() {
    const msg = t => { $('mp-msg').textContent = t || ''; };
    const busy = on => { ['mp-host', 'mp-join', 'mp-back'].forEach(id => { $(id).disabled = on; }); };
    const name = () => { const n = ($('mp-name').value || '').trim().slice(0, 14) || 'Astronaut'; S.name = n; saveSettings(); return n; };
    const view = v => { showEl('mp-a', v === 'a'); showEl('mp-b', v === 'b'); showEl('mp-namerow', v === 'a'); };
    const list = () => { const l = [MP.name + ' (du)']; if (MP.guest && MP.hostName) l.push(MP.hostName + ' (Gastgeber)'); for (const k in MP.players) if (!(MP.guest && k === 'H')) l.push(MP.players[k].name); $('mp-list').textContent = MP.active ? 'Dabei: ' + l.join(' · ') : ''; };
    const why = { notfound: 'Kein Spiel mit diesem Code gefunden. Stimmt der Code, und hat dein Freund das Spiel schon eröffnet?', network: 'Keine Verbindung. Prüfe dein Internet und versuch es noch einmal.', version: 'Ihr habt verschiedene Spielversionen. Bitte beide die Seite mit Strg+F5 neu laden.', full: 'Das Spiel ist schon voll (höchstens 4 Spieler).', taken: 'Der Code ist gerade vergeben. Versuch es noch einmal.' };
    mpctx.onRoster = list;
    MP.onFail = k => { busy(false); msg(why[k] || why.network); };
    MP.onReady = () => {
      busy(false); msg(''); view('b'); $('mp-back').textContent = 'Verlassen';
      $('mp-bt').textContent = 'VERBUNDEN MIT RAUM'; $('mp-big').textContent = MP.code;
      $('mp-bp').textContent = 'Du spielst in der Welt von ' + (MP.hostName || 'deinem Freund') + '. Geld und Upgrades gehören euch zusammen. Dein eigener Spielstand bleibt, wie er ist.';
      list(); UI.show('btn-new', false); UI.el['btn-play'].textContent = 'Los geht\'s';
    };
    MP.onLost = () => {
      mpLost = true;
      if (!TEST && document.pointerLockElement) document.exitPointerLock();
      if (state !== 'menu') setState('pause');
      showEl('mp', true); view(''); msg('Die Verbindung zum Gastgeber ist weg. Er hat das Spiel beendet oder sein Internet ist ausgefallen.'); $('mp-back').textContent = 'Zum Hauptmenü'; busy(false);
    };
    $('mp-name').value = S.name || '';
    $('btn-mp').addEventListener('click', () => {
      showEl('mp', true); msg('');
      LC.Net.load().then(ok => { if (!ok) msg('Der Mehrspieler konnte nicht geladen werden. Prüfe dein Internet und öffne das Fenster noch einmal.'); });
      if (MP.active) { view('b'); list(); } else view('a');
    });
    $('mp-back').addEventListener('click', () => {
      if (MP.guest || mpLost) { location.reload(); return; }
      showEl('mp', false);
    });
    $('mp-host').addEventListener('click', () => {
      if (!LC.Net.available()) { msg('Einen Moment – der Mehrspieler lädt noch …'); return; }
      busy(true); msg('Raum wird eröffnet …'); A.init();
      const code = (/[?&]room=([A-Za-z0-9]{4})/.exec(location.search) || [])[1];
      (code ? MP.openAs(name(), code.toUpperCase()) : MP.open(name())).then(c => {
        busy(false); msg(''); view('b');
        $('mp-bt').textContent = 'DEIN CODE'; $('mp-big').textContent = c;
        $('mp-bp').textContent = 'Sag deinen Freunden diesen Code. Sie klicken im Hauptmenü auf „Mehrspieler“ und dann auf „Beitreten“. Du kannst schon losspielen – sie können jederzeit dazukommen. Der Code steht im Spiel oben rechts.';
        list();
      }, e => { busy(false); msg(why[e && e.code] || why.network); });
    });
    $('mp-code').addEventListener('keydown', e => { if (e.code === 'Enter') $('mp-join').click(); e.stopPropagation(); });
    $('mp-name').addEventListener('keydown', e => e.stopPropagation());
    $('mp-join').addEventListener('click', () => {
      if (!LC.Net.available()) { msg('Einen Moment – der Mehrspieler lädt noch …'); return; }
      const code = ($('mp-code').value || '').trim().toUpperCase();
      if (code.length !== 4) { msg('Der Code hat 4 Zeichen.'); return; }
      busy(true); msg('Verbinde …'); A.init();
      MP.join(code, name()).then(() => { msg('Verbunden – Welt wird geladen …'); setTimeout(() => { if (MP.guest && !MP.ready) { MP.leave(); busy(false); msg(why.network); } }, 15000); },
        e => { MP.leave(); busy(false); msg(why[e && e.code] || why.network); });
    });
    $('mp-go').addEventListener('click', () => { showEl('mp', false); startPlay(MP.host && !G.stats.intro && G.stats.time < 1); });
  }

  // ---------- Werkstatt ----------
  function shopItems() {
    const items = UP_ORDER.map(id => {
      const u = UP[id], lv = G.up[id];
      const it = { id, name: u.name, desc: u.desc, level: lv, max: u.max, cost: u.costs[lv], help: !!u.help };
      if (u.vals) { it.nowTxt = u.fmt(u.vals[lv]); if (lv < u.max) it.nextTxt = u.fmt(u.vals[lv + 1]); }
      if (u.needs && !G.up[u.needs]) { it.locked = true; it.lockTxt = 'Erst ' + UP[u.needs].name + ' kaufen'; }
      if (u.cond && !G.stats[u.cond]) { it.locked = true; it.lockTxt = u.condTxt + ' (du bist bei ' + UI.n1(Math.floor(D.percentOf(1) * 1000) / 10) + ' %)'; }
      return it;
    });
    items.push({ id: 'rocket', name: 'Rakete nach Hause', desc: 'Der Grund, warum du das alles machst. Ein Ticket zurück zur Erde.', nowTxt: 'So bekommst du sie: Sektor 1 und Sektor 2 blitzblank putzen und 1.000.000 ¢ ansparen (du hast ' + UI.n0(Math.floor(G.money)) + ' ¢).', teaser: 'Noch nicht im Spiel · kommt in einem späteren Update', max: 1, level: 0, goal: true });
    return items;
  }
  function renderShop() { UI.shopRender(shopItems(), G.money, buy, showHelp); }
  // kleine Anleitung zu einem freigeschalteten Teil
  function showHelp(id, fresh) {
    const u = UP[id]; if (!u || !u.help) return;
    $('info-k').textContent = fresh ? 'NEU FREIGESCHALTET' : 'ANLEITUNG';
    $('info-t').textContent = u.name;
    const ul = $('info-l'); ul.innerHTML = '';
    u.help.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
    showEl('info', true);
  }
  function hideHelp() { showEl('info', false); }
  // Kauf ausführen (ohne Fenster und Ton) – auch für Käufe der Mitspieler
  function buyCore(id) {
    const u = UP[id], lv = G.up[id];
    G.money -= u.costs[lv]; G.shown = G.money; G.up[id] = lv + 1;
    if (id === 'repair') V.setRepaired(true);
    if (id === 'tunnel') { openPass(true); UI.toast('Der Pass nach Sektor 2 ist offen!', 'gold', 6); }
    if (id === 'buggy') { BG.setOwned(true); BG.place(BG.park.x, BG.park.z, BG.park.heading); UI.toast('Der Mondbuggy steht neben der Basis bereit!', 'gold', 5); }
    BG.CAP = val('bcap'); BG.headR = val('bhead');
    if (id === 'glider') { GD.setOwned(true); GD.load.n = GD.load.g = 0; GD.place(GD.park.x, GD.park.z, GD.park.heading); UI.toast('Der Schwebegleiter steht auf dem Landeplatz!', 'gold', 6); }
    if (id === 'robot') { RB.add(); UI.toast('Putzroboter im Gepäck – mit R setzt du ihn ab.', 'gold', 6); }
  }
  function buy(id) {
    const u = UP[id], lv = G.up[id];
    if (!u || lv >= u.max) return;
    const cost = u.costs[lv];
    if (G.money < cost || (u.needs && !G.up[u.needs]) || (u.cond && !G.stats[u.cond])) { A.play('deny'); return; }
    if (MP.guest) { MP.buy(id); return; }      // der Gastgeber führt den Kauf aus
    buyCore(id);
    A.play('buy');
    if (id === 'shovel' || id === 'vac' || id === 'xl') setTool(id, true);
    renderShop(); UI.money(G.money, true); save();
    if (MP.host) { MP.pushWorld(); MP.event({ k: 'buy', id, by: 'H' }); }
    if (u.help && (lv === 0)) showHelp(id, true);
  }
  function openShop() { setState('shop'); A.play('click'); if (!TEST && document.pointerLockElement) document.exitPointerLock(); }
  function closeShop() {
    if (state !== 'shop') return;
    A.play('click');
    if (TEST) { setState('play'); return; }
    setState('wait'); lock();
    setTimeout(() => { if (state === 'wait') setState('pause'); }, 700);
  }

  const cleanedArea = () => D.percentOf(1) * Math.PI * 74 * 74 + D.percentOf(2) * Math.PI * 114 * 114;
  function renderStats() {
    const moonArea = 3.793e13, cleaned = cleanedArea();
    UI.stats([
      ['Sektor 1 sauber', UI.n1(D.percentOf(1) * 100) + ' %'],
      ['Sektor 2 sauber', G.up.tunnel ? UI.n1(D.percentOf(2) * 100) + ' %' : 'noch gesperrt'],
      ['Mond gesamt sauber', (cleaned / moonArea * 100).toFixed(10).replace('.', ',') + ' %'],
      ['Staub gesammelt', UI.n0(G.stats.kg) + ' kg'],
      ['Geld verdient', UI.n0(G.stats.earned) + ' ¢'],
      ['Spielzeit', Math.floor(G.stats.time / 60) + ' min']
    ]);
  }

  // ---------- Benutzen (E), Säcke (G), Buggy ----------
  let nearPoint = null, nearBuggy = false, nearSack = null, driveHint = false, sackHint = false;
  let nearRobot = null, nearGlider = false;
  const gcb = { onSuck: (n, g) => { const room = GD.room(), tot = n + g, k = tot > room ? room / tot : 1; GD.load.n += n * k; GD.load.g += g * k; G.stats.kg += tot * k; } };
  const ginp = { f: 0, s: 0, up: 0, fire: false, mdx: 0, mdy: 0, sens: 1 };
  const gliderWorth = () => GD.load.n * PRICE_N + GD.load.g * PRICE_G;
  function enterGlider() {
    GD.driving = true; GD.lookYaw = 0; GD.lookPitch = -0.1; fire = false; PL.sprint = PL.crouch = false; A.play('click');
    if (!flyHint) { flyHint = true; UI.toast('Leertaste: abheben und steigen · C: sinken · W/S Schub · A/D drehen · Linke Maustaste: Saugrüssel (unter 9 m) · E: aussteigen (nur gelandet)', '', 10); }
  }
  let flyHint = false;
  function exitGlider() {
    if (!GD.canExit()) { A.play('deny'); UI.toast(GD.landed() ? 'Hier kannst du nicht aussteigen – lande im Krater.' : 'Erst landen: C gedrückt halten, bis der Gleiter aufsetzt.', '', 3); return; }
    GD.driving = false; GD.suck = 0; A.setBuggy(false, 0); A.play('click');
    GD.exitPoint(tmpV); PL.reset(tmpV.x, tmpV.z, GD.heading);
    MP.leftGlider();
  }
  function findNear() {
    nearPoint = null; nearBuggy = false; nearSack = null; nearGlider = false; let best = 1e9;
    if (inVeh()) return;
    if (GD.owned && Math.hypot(PL.pos.x - GD.pos.x, PL.pos.z - GD.pos.z) < 4.2 && Math.abs(PL.pos.y - GD.pos.y) < 3) nearGlider = true;
    for (let i = 0; i < B.points.length; i++) {
      const p = B.points[i], d = Math.hypot(PL.pos.x - p.x, PL.pos.z - p.z);
      if (d < p.r && d < best && Math.abs(PL.pos.y - (p.y - 1.2)) < 3) { best = d; nearPoint = p; }
    }
    if (BG.here() && Math.hypot(PL.pos.x - BG.pos.x, PL.pos.z - BG.pos.z) < 3.7 && Math.abs(PL.pos.y - BG.pos.y) < 2.5) nearBuggy = true;
    nearSack = SK.nearest(PL.pos.x, PL.pos.z, 1.5);
    nearRobot = MP.guest ? null : RB.nearest(PL.pos.x, PL.pos.z, 2.1);
  }
  // Roboter aus dem Gepäck vor sich absetzen
  function placeRobot() {
    if (MP.guest || BG.driving || selling || emote) return;
    const r = RB.packed()[0]; if (!r) return;
    const x = PL.pos.x - Math.sin(PL.yaw) * 2.2, z = PL.pos.z - Math.cos(PL.yaw) * 2.2;
    if (!W.inside(x, z, 2)) { A.play('deny'); return; }
    RB.place(r, x, z, PL.yaw); A.play('thump'); V.kickDust(x, B.groundAt(x, z) + 0.1, z, 10, 1);
    UI.toast(D.percentClean() >= DONE_AT ? 'Hier ist alles sauber – der Roboter hat nichts zu tun. Nimm ihn mit E wieder mit.' : 'Putzroboter abgesetzt. Er legt gleich los.', '', 4); save();
  }
  function robotSold(n, g) {
    const v = Math.round(n * PRICE_N + g * PRICE_G); if (v <= 0) return;
    G.money += v; G.stats.earned += v; G.stats.robotKg = (G.stats.robotKg || 0) + n + g;
    UI.toast('Putzroboter liefert ' + UI.n0(n + g) + ' kg ab: + ' + UI.n0(v) + ' ¢', 'gold', 2.5);
    if (MP.host) MP.pushWorld();
  }
  const robotCtx = { sec: 1, sim: true, hub: null, onSell: robotSold, time: 0, night: false, lamps: [], beacons: [] };
  let darkWarned = false;
  function updateRobots(dt) {
    if (!RB.list.length) return;
    robotCtx.night = W.sunK < 0.3;
    robotCtx.lamps = BD.list.filter(b => b.t === 'lamp').map(b => ({ x: b.x, z: b.z, r: BD.LAMP_R }));
    robotCtx.beacons = BD.list.filter(b => b.t === 'beacon').map(b => ({ x: b.x, z: b.z, r: BD.BEACON_R }));
    if (!robotCtx.night) darkWarned = false;
    else if (!darkWarned && !MP.guest && RB.list.some(r => !r.packed && r.dark)) {
      darkWarned = true; A.play('deny');
      UI.toast('Deine Putzroboter stehen still: Im Dunkeln arbeiten sie nicht.', 'gold', 7);
      UI.toast('Bau einen Lichtmast (B) und setz die Roboter in den gelben Kreis – dann putzen sie auch nachts.', '', 9);
    }
    RB.list.forEach(r => { if (r.zoneDone && !r.zoneSaid && !r.packed) { r.zoneSaid = true; UI.toast('Rund um die Signalbake ist alles sauber – der Roboter wartet. Nimm ihn mit E mit oder versetz die Bake.', '', 7); } else if (!r.zoneDone) r.zoneSaid = false; });
    robotCtx.sim = !MP.guest; robotCtx.time = time; robotCtx.hubs = robotCtx.hubs || { 1: B.points.find(p => p.id === 'silo'), 2: B.points.find(p => p.id === 'post') };
    RB.update(dt, robotCtx);
  }
  // Mehrspieler: mitfahren und den Bordsauger bedienen, während ein anderer fährt
  let riding = false;           // false | 'buggy' | 'glider'
  function startRide(veh) {
    riding = veh || 'buggy'; fire = false; PL.sprint = PL.crouch = false; V.setTool('vac'); A.play('click');
    UI.toast(riding === 'glider' ? 'Du fliegst mit. Linke Maustaste: der große Saugrüssel – ziel mit der Maus auf den Boden. Je tiefer ihr fliegt, desto stärker. E: aussteigen (nur gelandet).' : 'Du fährst mit. Linke Maustaste: Bordsauger – er saugt weit und direkt in den Laderaum. E: aussteigen.', '', 8);
  }
  function stopRide(quiet) {
    if (!riding) return;
    if (riding === 'glider') {
      if (!quiet && !GD.canExit()) { A.play('deny'); UI.toast('Aussteigen geht nur, wenn der Gleiter gelandet ist.', '', 3); return; }
      riding = false; V.setTool(G.tool); GD.exitPoint(tmpV); PL.reset(tmpV.x + 1.2, tmpV.z + 1.2, PL.yaw); W.clamp(PL.pos, 0);
      if (!quiet) A.play('click');
      return;
    }
    riding = false; V.setTool(G.tool);
    if (BG.here()) { const ch = Math.cos(BG.heading), sh = Math.sin(BG.heading); PL.reset(BG.pos.x + ch * 2.3, BG.pos.z - sh * 2.3, PL.yaw); }
    if (!quiet) A.play('click');
  }
  function enterBuggy() {
    BG.driving = true; BG.lookYaw = 0; BG.lookPitch = -0.08; fire = false; A.play('click');
    if (!driveHint) { driveHint = true; UI.toast('W/S Gas und Bremse · A/D lenken · Linke Maustaste saugen · E aussteigen', '', 7); }
  }
  function exitBuggy() {
    BG.driving = false; BG.speed = 0; BG.suck = 0; A.setBuggy(false, 0); A.play('click');
    BG.exitPoint(tmpV); PL.reset(tmpV.x, tmpV.z, BG.heading);
    MP.leftBuggy();
  }
  function throwSack(n, g) {
    PL.forward(tmpV2);
    const dir = { x: -Math.sin(PL.yaw), z: -Math.cos(PL.yaw) };
    tmpV.set(camera.position.x + dir.x * 0.5, camera.position.y - 0.55, camera.position.z + dir.z * 0.5);
    if (MP.guest) { if (SK.list.length >= SK.MAX) return null; MP.sackThrow(tmpV, dir, n, g); return true; }
    const s = SK.throwSack(tmpV, dir, n, g);
    if (s) MP.sackAdded(s, tmpV, dir);
    return s;
  }
  function sackKey() {
    if (BG.driving || selling) return;
    if (G.tank.n + G.tank.g >= 0.5) {
      if (!throwSack(G.tank.n, G.tank.g)) { A.play('deny'); UI.toast('Es liegen schon zu viele Säcke herum. Bring erst welche weg.'); return; }
      G.tank.n = 0; G.tank.g = 0; fullBeep = false;
      if (!sackHint) { sackHint = true; UI.toast('Sack abgestellt. Mit E hebst du ihn später wieder auf (bis zu 2 tragbar).', '', 6); }
    } else if (G.carry.length) {
      const c = G.carry.pop(); if (!throwSack(c.n, c.g)) G.carry.push(c);
    } else { A.play('deny'); UI.toast('Dein Behälter ist leer – nichts zum Einsacken.', '', 2.2); }
  }
  const sellTo = new THREE.Vector3();
  // steht man (zu Fuß oder im Buggy) vor dem geschlossenen Tor am Pass?
  function atTunnel() {
    if (W.open) return false;
    const pt = B.portals[1];
    return Math.hypot(PL.pos.x - pt.x, PL.pos.z - pt.z) < (BG.driving ? 13 : 10);
  }
  function useTunnel() { A.play('deny'); UI.toast('Der Pass nach Sektor 2 ist noch gesperrt. Freischalten in der Werkstatt (12.000 ¢).', '', 4); }
  function interact() {
    if (selling) return;
    if (riding) { stopRide(); return; }
    const tb = BG.driving ? BD.nearest(BG.pos.x, BG.pos.z, 6) : null;
    if (BG.driving && tb && tb.t === 'press' && !atTunnel()) {
      // Buggy an der Presse: fertige Ballen einladen, sonst losen Staub hineinkippen (Ballen im Laderaum werden nicht noch einmal gepresst)
      if (BD.ready(tb) >= 0.5 && BG.room() > 1) { const r = bTake(tb, BG.room() / BD.PRESS_BONUS); BG.load.n += r.n * BD.PRESS_BONUS; BG.load.g += r.g * BD.PRESS_BONUS; G.buggyBales = true; A.play('thump'); UI.toast('Ballen in den Buggy geladen. Verkauf sie an der Entladestation oder kipp sie in eine Glasröhre.', '', 5); return; }
      if (BG.total() > 0.05 && !G.buggyBales) { bDeposit(tb, BG.load.n, BG.load.g); BG.load.n = BG.load.g = 0; A.play('thump'); UI.toast('Buggy-Ladung in die Presse gekippt. Hol die Ballen ab, wenn sie fertig sind.', '', 4); return; }
      if (G.buggyBales && BG.total() > 0.05) { A.play('deny'); UI.toast('Im Laderaum liegen schon Ballen – erst verkaufen.', '', 3); return; }
    }
    if (BG.total() < 0.05) G.buggyBales = false;
    if (BG.driving && tb && tb.t === 'tube' && BG.total() > 0.05 && !atTunnel()) { bDeposit(tb, BG.load.n, BG.load.g); BG.load.n = BG.load.g = 0; G.buggyBales = false; A.play('thump'); UI.toast('Buggy-Ladung in die Röhre gekippt.', '', 2.5); return; }
    if (GD.driving) {
      if (GD.atDock() && GD.total() > 0.05) selling = { src: 'glider', n: GD.load.n, g: GD.load.g, t: 0, dur: 1.2 + Math.min(3.2, GD.total() / 350), paid: 0, total: Math.round(gliderWorth()) };
      else exitGlider();
      return;
    }
    if (BG.driving) {
      if (atTunnel()) useTunnel();
      else if (BG.atStation() && BG.total() > 0.05) {
        selling = { src: 'buggy', n: BG.load.n, g: BG.load.g, t: 0, dur: 1.2 + Math.min(3.2, BG.total() / 350), paid: 0, total: Math.round(buggyWorth()) };
        BG.unloading = true; BG.speed = 0;
      } else exitBuggy();
      return;
    }
    if (nearPoint && nearPoint.id === 'shop') openShop();
    else if (nearPoint && nearPoint.id === 'press') {
      // Presse: losen Staub hineingeben; fertige Ballen mitnehmen (verkauft wird am Staublager oder über eine Glasröhre)
      const pb = nearPoint.b, loose = G.carry.filter(c => !c.bale), ln = loose.reduce((a, c) => a + c.n, 0), lg = loose.reduce((a, c) => a + c.g, 0);
      if (tankTotal() + ln + lg >= 0.05) {
        bDeposit(pb, G.tank.n + ln, G.tank.g + lg); G.tank.n = G.tank.g = 0; G.carry = G.carry.filter(c => c.bale); fullBeep = false; A.play('thump');
        UI.toast('Die Presse arbeitet. Hol die Ballen ab, wenn sie fertig sind.', '', 4);
      } else if (BD.ready(pb) >= 0.5) {
        if (G.carry.length >= SK.CARRY) { A.play('deny'); UI.toast('Mehr als ' + SK.CARRY + ' Ballen oder Säcke kannst du nicht tragen.', '', 3); return; }
        const r = bTake(pb, BD.BALE);
        G.carry.push({ n: r.n * BD.PRESS_BONUS, g: r.g * BD.PRESS_BONUS, bale: true }); A.play('click');
        UI.toast('Ballen aufgenommen. Verkauf ihn am Staublager oder wirf ihn in den Einwurf einer Glasröhre.', '', 5);
      } else { A.play('deny'); UI.toast(pb.queue.n + pb.queue.g > 0.5 ? 'Die Presse arbeitet noch – gleich ist ein Ballen fertig.' : 'Die Presse ist leer. Bring Staub mit.', '', 3); }
    }
    else if (nearPoint && nearPoint.id === 'intake') {
      const tot = tankTotal() + carryN() + carryG();
      if (tot < 0.05) { A.play('deny'); UI.toast('Du hast keinen Staub dabei. Erst sammeln!'); return; }
      bDeposit(nearPoint.b, G.tank.n + carryN(), G.tank.g + carryG()); G.tank.n = G.tank.g = 0; G.carry = []; G.stats.sold++; fullBeep = false; A.play('thump');
    }
    else if (nearPoint && (nearPoint.id === 'silo' || nearPoint.id === 'post')) {
      const tot = tankTotal() + carryN() + carryG();
      if (tot < 0.05) { A.play('deny'); UI.toast('Du hast keinen Staub dabei. Erst sammeln!'); return; }
      selling = { src: 'tank', tn: G.tank.n, tg: G.tank.g, n: G.tank.n + carryN(), g: G.tank.g + carryG(), t: 0, dur: 0.9 + Math.min(1.8, tot / 160), paid: 0, total: Math.round(tankWorth()) };
      G.carry = [];
      if (nearPoint.id === 'post') sellTo.set(nearPoint.x, nearPoint.y - 1.0, nearPoint.z); else sellTo.copy(B.siloNozzle);
    }
    else if (atTunnel()) useTunnel();
    else if (nearBuggy) { if (MP.active && MP.drv && MP.drv !== MP.id) startRide('buggy'); else if (MP.tryDrive()) enterBuggy(); }
    else if (nearGlider) { if (MP.active && MP.gdrv && MP.gdrv !== MP.id) startRide('glider'); else if (MP.tryFly()) enterGlider(); }
    else if (nearRobot && !nearSack) { RB.pack(nearRobot); A.play('click'); UI.toast('Putzroboter eingepackt' + (nearRobot.n + nearRobot.g > 1 ? ' (mit ' + UI.n0(nearRobot.n + nearRobot.g) + ' kg Staub an Bord)' : '') + ' – R setzt ihn wieder ab.', '', 4); save(); }
    else if (nearSack) {
      if (G.carry.length >= SK.CARRY) { A.play('deny'); UI.toast('Mehr als ' + SK.CARRY + ' Säcke kannst du nicht tragen.', '', 2.5); return; }
      if (MP.guest) { MP.sackTake(nearSack, false); return; }
      G.carry.push({ n: nearSack.n, g: nearSack.g }); SK.remove(nearSack); MP.sackTaken(nearSack); shadowFrames = 2; A.play('click');
    }
  }
  function updateSelling(dt) {
    if (!selling) return;
    const s = selling; s.t += dt;
    const k = U.clamp(s.t / s.dur, 0, 1), rest = 1 - k, gfrac = s.g / (s.n + s.g + 1e-6);
    const paidNow = Math.round(s.total * k);
    if (paidNow > s.paid) { G.money += paidNow - s.paid; s.paid = paidNow; }
    coinT -= dt;
    if (coinT <= 0) { coinT = 0.07; A.play('coin', k * 6); }
    const n = Math.ceil(dt * (s.src === 'buggy' ? 260 : 150));
    if (s.src === 'glider') { GD.load.n = s.n * rest; GD.load.g = s.g * rest; }
    else if (s.src === 'buggy') {
      BG.load.n = s.n * rest; BG.load.g = s.g * rest;
      tmpV.set(BG.pos.x, BG.pos.y + 0.1, BG.pos.z);
      for (let i = 0; i < n; i++) { tmpV2.copy(BG.hopperWorld); tmpV2.x += (Math.random() - 0.5) * 1.4; tmpV2.z += (Math.random() - 0.5) * 1.0; V.stream(tmpV2, tmpV, Math.random() < gfrac); }
    } else {
      G.tank.n = s.tn * rest; G.tank.g = s.tg * rest;
      for (let i = 0; i < n; i++) V.stream(V.nozzleWorld, sellTo, Math.random() < gfrac);
    }
    if (k >= 1) {
      if (s.src === 'glider') { GD.load.n = 0; GD.load.g = 0; } else if (s.src === 'buggy') { BG.load.n = 0; BG.load.g = 0; BG.unloading = false; } else { G.tank.n = 0; G.tank.g = 0; }
      G.stats.earned += s.total; G.stats.sold++;
      A.play('sold'); UI.toast('+ ' + UI.n0(s.total) + ' ¢', 'gold');
      UI.money(G.money, true);
      selling = null; fullBeep = false; save();
    }
  }

  // ---------- Ziele ----------
  const GOALS = [
    { txt: 'Sieh dich um: M öffnet die Karte, noch mal M zeigt den ganzen Mond, noch mal M schließt sie.', done: () => G.stats.mapSeen },
    { txt: 'Drück X und dann eine Zahl für ein Emote. Praktisch, wenn später Freunde mitspielen.', done: () => G.stats.emoted },
    { txt: 'Du hast nur einen Löffel. Halte die linke Maustaste gedrückt und kratz Staub vom Boden.', done: () => G.stats.kg >= 1.5 },
    { txt: 'Mach deinen Behälter voll (12 kg). Tipp: Mit G füllst du ihn in einen Sack um und wirfst ihn hin.', done: () => tankTotal() >= cap() - 0.01 || G.stats.sold > 0 || SK.list.length > 0 },
    { txt: 'Bring den Staub zum Staublager an der Basis und drücke E am gelben Trichter.', done: () => G.stats.sold > 0 },
    { txt: 'Kauf dir in der Werkstatt neben dem Wrack eine Schaufel (30 ¢).', done: () => G.up.shovel > 0 },
    { txt: 'Spar auf den Handsauger (120 ¢). Ein größerer Behälter (40 ¢) spart Wege.', done: () => G.up.vac > 0 },
    { txt: 'Der Sauger stottert. Lass ihn in der Werkstatt reparieren (150 ¢).', done: () => G.up.repair > 0 },
    { txt: 'Verdiene Geld für Upgrades – bis zum Mondbuggy. Tipp: In den tiefen Kratern liegt Glitzerstaub.', done: () => G.up.buggy > 0 || G.stats.sectorDone },
    { k: 's1', txt: 'Steig mit E in den Buggy und putze ganz Sektor 1 sauber. Entladen an der Fahrzeug-Station.', done: () => G.stats.sectorDone },
    { txt: 'Sektor 1 ist blitzblank! Kauf in der Werkstatt den Tunnel nach Sektor 2 (12.000 ¢).', done: () => G.up.tunnel > 0 },
    { txt: 'Fahr mit dem Buggy zum Tunnel am Kraterrand (lila Quadrat auf der Karte) und drücke E.', done: () => G.stats.sec2Seen },
    { txt: 'Putze Sektor 2. Staub gibst du am Außenposten ab – zu Fuß oder mit dem Buggy.', done: () => G.stats.sector2Done },
    { txt: 'Auch Sektor 2 ist sauber! Als Nächstes kommen Maschinen, Basis-Bau und die Rakete.', done: () => false }
  ];
  function updateGoals() {
    if (!MP.guest) while (G.stage < GOALS.length - 1 && GOALS[G.stage].done()) { G.stage++; if (state === 'play') A.play('click'); }
    G.stage = U.clamp(G.stage, 0, GOALS.length - 1);
    UI.goal(GOALS[G.stage].txt);
  }

  // Weltpunkt auf den Bildschirm rechnen (am Rand festgehalten). Ergebnis in scr
  const scr = { x: 0, y: 0 };
  let lastStance = '', lastDrive = null, lastSec = 0;
  function toScreen(x, y, z) {
    tmpV.set(x, y, z).project(camera);
    let sx = tmpV.x, sy = tmpV.y;
    if (tmpV.z > 1) { sx = -sx; sy = -1; }
    const m = Math.max(Math.abs(sx) / 0.92, Math.abs(sy) / 0.86, 1);
    scr.x = (sx / m * 0.5 + 0.5) * window.innerWidth; scr.y = (-sy / m * 0.5 + 0.5) * window.innerHeight;
    return true;
  }

  // steht der Spieler in der Sonne? (für das Licht auf dem Sauger)
  function checkSun() {
    if (W.sunK < 0.04) return 0;            // Nacht
    const s = W.SUN_DIR, ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
    for (let d = 1.5; d < 85; d += 2.2) {
      const x = ox + s.x * d, y = oy + s.y * d, z = oz + s.z * d;
      if (y < W.heightAt(x, z)) return 0.1;
    }
    return (0.25 + 0.75 * W.sunK) * (1 - stormK * 0.6);
  }

  // ---------- Bauen (Bau-Hammer, Taste B) ----------
  let buildMenu = false, buildSel = null;            // buildSel: 'tube' | 'lamp' | 'beacon' | 'del' | null
  function setBuildMenu(on) {
    buildMenu = on; const e = $('build'); e.classList.toggle('hidden', !on); if (!on) return;
    e.innerHTML = '';
    BD.ORDER.forEach((id, i) => {
      const t = BD.TYPES[id], locked = t.unlock > 0 && !G.bunlock[id], d = document.createElement('div');
      d.innerHTML = '<kbd>' + (i + 1) + '</kbd><b></b><span></span>'; d.children[1].textContent = t.name;
      d.children[2].textContent = (locked ? 'freischalten: ' + UI.n0(t.unlock) + ' ¢' : UI.n0(t.cost) + ' ¢' + (t.perM ? ' + ' + t.perM + ' ¢ je Meter' : '')) + ' · ' + t.txt;
      if (locked) d.className = 'lock'; e.appendChild(d);
    });
    const d = document.createElement('div'); d.innerHTML = '<kbd>' + (BD.ORDER.length + 1) + '</kbd><b>Abreißen</b><span>halber Preis zurück</span>'; e.appendChild(d);
    const h = document.createElement('div'); h.className = 'hint'; h.textContent = 'Zahl drücken · B schließt'; e.appendChild(h);
  }
  function setBuild(sel) { buildSel = sel; if (!sel) BD.ghostOff(); fire = false; }
  function buildPick(i) {
    if (i === BD.ORDER.length) { setBuildMenu(false); setBuild('del'); return; }
    const id = BD.ORDER[i], t = BD.TYPES[id]; if (!t) return;
    if (t.unlock > 0 && !G.bunlock[id]) {
      if (G.money < t.unlock) { A.play('deny'); UI.toast('Dafür brauchst du ' + UI.n0(t.unlock) + ' ¢.', '', 3); return; }
      if (MP.guest) { MP.build({ a: 'unlock', ty: id }); A.play('buy'); setBuildMenu(false); return; }
      G.money -= t.unlock; G.bunlock[id] = true; A.play('buy'); UI.toast(t.name + ' freigeschaltet!', 'gold', 4); save(); MP.pushWorld(); setBuildMenu(true); return;
    }
    setBuildMenu(false); setBuild(id);
  }
  // Gastgeber/Einzelspieler: bauen oder abreißen ausführen (auch im Auftrag eines Gastes); gibt true zurück, wenn es geklappt hat
  function buildDo(m) {
    if (m.a === 'unlock') { const t = BD.TYPES[m.ty]; if (!t || G.bunlock[m.ty] || G.money < t.unlock) return false; G.money -= t.unlock; G.bunlock[m.ty] = true; return true; }
    if (m.a === 'add') {
      const t = BD.TYPES[m.ty]; if (!t || (t.unlock > 0 && !G.bunlock[m.ty]) || !W.inside(m.x, m.z, 1) || BD.list.length >= BD.MAX) return false;
      const cost = BD.price(m.ty, m.x, m.z); if (G.money < cost) return false;
      G.money -= cost; BD.add(m.ty, m.x, m.z); D.clearArea(m.x, m.z, m.ty === 'tube' ? 1.2 : m.ty === 'press' ? 2.2 : 0.4); shadowFrames = 2; return true;
    }
    if (m.a === 'dep') { const b = BD.byId(m.id); if (!b || !b.queue) return false; BD.deposit(b, Math.max(0, +m.n || 0), Math.max(0, +m.g || 0)); return true; }
    if (m.a === 'take') { const b = BD.byId(m.id); if (!b || !b.out) return false; BD.takeBales(b, Math.max(0, +m.kg || 0)); return true; }
    if (m.a === 'del') { const b = BD.byId(m.id); if (!b) return false; G.money += Math.round(BD.price(b.t, b.x, b.z) / 2); BD.remove(b); shadowFrames = 2; return true; }
    return false;
  }
  function buildClick() {
    if (buildSel === 'del') {
      const a = BD.aim(camera, null), b = a.x || a.z ? BD.nearest(a.x, a.z, 2.2) : null;
      if (!b) { A.play('deny'); return; }
      if (MP.guest) MP.build({ a: 'del', id: b.id }); else { buildDo({ a: 'del', id: b.id }); save(); MP.pushWorld(); }
      A.play('thump'); return;
    }
    const a = BD.aim(camera, buildSel);
    if (!a.ok) { A.play('deny'); UI.toast(a.why, '', 2.5); return; }
    const cost = BD.price(buildSel, a.x, a.z);
    if (G.money < cost) { A.play('deny'); UI.toast('Das kostet ' + UI.n0(cost) + ' ¢ – so viel hast du nicht.', '', 3); return; }
    if (MP.guest) MP.build({ a: 'add', ty: buildSel, x: +a.x.toFixed(2), z: +a.z.toFixed(2) });
    else { buildDo({ a: 'add', ty: buildSel, x: a.x, z: a.z }); save(); MP.pushWorld(); }
    A.play('thump'); V.kickDust(a.x, a.y + 0.1, a.z, 14, 1.2);
    if (buildSel === 'tube') { setBuild(null); UI.toast('Röhre steht! Am Einwurf E drücken – dein Staub wandert zum Verkauf.', 'gold', 6); }
    else if (buildSel === 'press') { setBuild(null); UI.toast('Presse steht! Mit E Staub hineingeben, später die Ballen abholen und selbst verkaufen – sie sind 50 % mehr wert.', 'gold', 7); }
    else if (buildSel === 'lamp') UI.toast('Putzroboter, die du im gelben Kreis absetzt, arbeiten auch nachts.', '', 5);
    else if (buildSel === 'beacon') UI.toast('Putzroboter, die du im blauen Kreis absetzt, putzen nur dort.', '', 5);
  }
  // Presse/Roehre: der Gastgeber besitzt den Inhalt, Gaeste schicken nur Anfragen
  function bDeposit(b, n, g) { if (MP.guest) MP.build({ a: 'dep', id: b.id, n: +n.toFixed(2), g: +g.toFixed(2) }); else BD.deposit(b, n, g); }
  function bTake(b, kg) { const r = BD.takeBales(b, kg); if (MP.guest) MP.build({ a: 'take', id: b.id, kg: +kg.toFixed(2) }); return r; }
  // Aussenansicht (Taste V): Kamera hinter Fahrzeug oder Figur
  let outView = false, walkPh = 0;
  function toggleView() {
    outView = !outView;
    if (!outView) { avatar.root.visible = false; camera.up.set(0, 1, 0); }
    A.play('click');
    UI.toast(outView ? 'Außenansicht – <kbd>V</kbd> zurück in die Innenansicht' : 'Innenansicht', '', 2.2);
  }
  LC.debug_view = () => outView;
  function tubeArrive(n, g) { if (MP.guest) { tubeT = 1.2; return; } const v = Math.round(n * PRICE_N + g * PRICE_G); if (v > 0) { G.money += v; G.stats.earned += v; tubePaid += v; tubeT = 1.2; } }
  let tubePaid = 0, tubeT = 0;
  function updateBuild(dt) {
    if (buildSel && (inVeh() || riding || state !== 'play')) setBuild(null);
    if (buildSel) {
      const a = BD.aim(camera, buildSel === 'del' ? null : buildSel);
      if (buildSel === 'del') { const b = a.x || a.z ? BD.nearest(a.x, a.z, 2.2) : null; if (b) BD.ghost('del', { ok: true, x: b.x, y: b.y, z: b.z }); else BD.ghostOff(); }
      else BD.ghost(buildSel, a);
    }
    BD.update(dt, time, (1 - W.sunK) * (1 - stormK * 0.5) + stormK * 0.3, tubeArrive);
    if (tubeT > 0) { tubeT -= dt; if (tubeT <= 0 && tubePaid > 0) { A.play('sold'); UI.toast('Röhre: + ' + UI.n0(tubePaid) + ' ¢', 'gold', 2.5); tubePaid = 0; if (!MP.guest) save(); } }
  }

  // ---------- Tag, Nacht und Mondsturm ----------
  const DAY_LEN = 960;            // Sekunden für einen ganzen Tag (rund 10 min hell, 6 min dunkel)
  let stormK = 0, wasNight = false, clockShown = '';
  function updateSky(dt, run) {
    if (run && !MP.guest) {
      G.clock += dt / DAY_LEN; if (G.clock >= 1) { G.clock -= 1; }
      if (G.stormLeft > 0) { G.stormLeft -= dt; if (G.stormLeft <= 0) { G.stormLeft = 0; G.stormNext = 420 + Math.random() * 420; UI.toast('Der Mondsturm hat sich gelegt.', '', 4); } }
      else { G.stormNext -= dt; if (G.stormNext <= 0) { G.stormLeft = 55 + Math.random() * 35; UI.toast('MONDSTURM!', 'big', 4); UI.toast('Die Sicht wird schlecht – auf der Karte (M) findest du dich zurecht.', '', 6); A.play('deny'); } }
    } else if (run && G.stormLeft > 0 && G.stormLeft < 29) G.stormLeft = 0;      // Gast: der Gastgeber meldet den Sturm immer wieder neu
    if (W.setTime(G.clock)) shadowFrames = Math.max(shadowFrames, 1);
    const tgt = G.stormLeft > 0 ? 1 : 0; stormK += U.clamp(tgt - stormK, -dt / 7, dt / 5);
    W.setStorm(stormK, time);
    const night = W.sunK < 0.3;
    if (run && night !== wasNight) {
      wasNight = night;
      if (night) UI.toast('Die Sonne geht unter. F schaltet die Helmlampe ein.', '', 6); else { if (!MP.guest) G.day++; UI.toast('Sonnenaufgang – Tag ' + G.day, 'gold', 5); }
    }
    // Staubfahnen im Sturm
    if (run && stormK > 0.05) {
      const n = Math.floor(dt * 140 * stormK + Math.random()), c = camera.position, b = 0.3 + 0.7 * W.sunK;
      for (let i = 0; i < n; i++) V.spawn(c.x + (Math.random() - 0.5) * 44 - 14, c.y - 1.5 + Math.random() * 7, c.z + (Math.random() - 0.5) * 44, 16 + Math.random() * 10, (Math.random() - 0.5) * 1.5, 3 + Math.random() * 4, 0, 1.6 + Math.random(), 0.1 + Math.random() * 0.14, 0.55 * b, 0.42 * b, 0.3 * b, 0.5);
    }
    const hh = (G.clock * 24 + 6) % 24, txt = 'TAG ' + G.day + ' · ' + String(Math.floor(hh)).padStart(2, '0') + ':' + String(Math.floor(hh % 1 * 6) * 10).padStart(2, '0') + (G.stormLeft > 0 ? ' · STURM' : night ? ' · NACHT' : '');
    if (txt !== clockShown) { clockShown = txt; $('clock').textContent = txt; }
  }

  // ---------- Schleife ----------
  const evs = {
    jump: () => { A.play('jump'); V.kickDust(PL.pos.x, PL.pos.y, PL.pos.z, 6, 1.0); },
    land: v => { A.play('land', v); V.kickDust(PL.pos.x, PL.pos.y, PL.pos.z, Math.min(26, 6 + v * 4), 0.6 + v * 0.25); },
    step: side => {
      A.play('step');
      const ox = Math.cos(PL.yaw) * (side ? 0.18 : -0.18), oz = -Math.sin(PL.yaw) * (side ? 0.18 : -0.18);
      V.kickDust(PL.pos.x + ox, PL.pos.y, PL.pos.z + oz, PL.speed > 5 ? 5 : 3, 0.55);
    }
  };
  const vcfg = { kind: 'scoop', radius: 0.3, rate: 0.95, period: 0.42, reach: 3.2, repaired: false, room: 0, fill: 0, glitRatio: 0, sunlit: 1, hidden: false };
  const binp = { f: 0, s: 0, fire: false, mdx: 0, mdy: 0, sens: 1 };
  const bcb = {
    onSuck: (n, g) => { const room = BG.room(), tot = n + g, k = tot > room ? room / tot : 1; BG.load.n += n * k; BG.load.g += g * k; G.stats.kg += tot * k; },
    spawnStream: (from, to, gl) => V.stream(from, to, gl)
  };
  const hoseP = new THREE.Vector3();
  let hoseOn = false;
  const pcfg = { jet: false, fuelTime: 3.2 };
  function onSuck(n, g) {
    const room = cap() - tankTotal(), tot = n + g, k = tot > room ? room / tot : 1;
    G.tank.n += n * k; G.tank.g += g * k; G.stats.kg += tot * k;
  }

  // Film-Modus für Trailer-Aufnahmen (nur mit ?test=1): feste Zeitschritte, freie Kamera
  const film = { on: false, cam: null, hands: true };
  function filmStep(dt) {
    update(dt);
    if (film.cam) { film.cam(camera, time, avatar); camera.updateMatrixWorld(); }
    if (shadowFrames > 0) { shadowFrames--; renderer.shadowMap.needsUpdate = true; }
    P.render(renderer, scene, camera, film.cam || !film.hands || emote ? null : V.scene, V.camera, time);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (film.on) { lastT = now; return; }          // Film-Modus (Trailer): Bilder werden einzeln über LC.debug.step gerechnet
    let dt = (now - lastT) / 1000; lastT = now;
    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 1) { UI.fps(Math.round(fpsN / fpsAcc) + ' FPS'); fpsAcc = 0; fpsN = 0; }
    // läuft es zu langsam? Dann einmalig automatisch auf niedrige Grafik stellen
    if (state === 'play' && !perfDone && !TEST) {
      perfT += dt; perfN++;
      if (perfT > 6) {
        perfDone = true;
        if (perfN / perfT < 27 && S.gfx !== 'niedrig') {
          S.gfx = 'niedrig'; UI.el['set-gfx'].value = 'niedrig'; saveSettings();
          pxRatio = pixelRatio(); renderer.setPixelRatio(pxRatio); resize(false);
          UI.toast('Grafik auf „Niedrig“ gestellt, damit es flüssiger läuft (in der Pause änderbar).', '', 7);
        }
      }
    }
    if (dt > 0.05) dt = 0.05; if (dt <= 0) dt = 0.001;
    update(dt);
    if (shadowFrames > 0) { shadowFrames--; renderer.shadowMap.needsUpdate = true; }
    if (state === 'globe' || (state === 'cut' && CS.view === 'globe')) P.render(renderer, GL.scene, GL.camera, null, null, time);
    else P.render(renderer, scene, camera, state === 'menu' || state === 'cut' || emote || outView ? null : V.scene, V.camera, time);
  }

  function update(dt) {
    time += dt;

    if (state === 'play') {
      G.stats.time += dt;
      const driving = BG.driving, flying = GD.driving;
      if (flying) {
        const k = PL.keys;
        ginp.f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0); ginp.s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
        ginp.up = (k.Space ? 1 : 0) - (k.KeyC ? 1 : 0);
        if (selling) { ginp.f = ginp.s = 0; ginp.up = Math.min(0, ginp.up); }
        ginp.fire = fire && !selling; ginp.mdx = PL.mdx; ginp.mdy = PL.mdy; ginp.sens = PL.sens; PL.mdx = PL.mdy = 0; PL.lookDX = PL.lookDY = 0;
        GD.drive(dt, ginp, gcb);
        GD.update(dt, time); GD.applyCamera(camera, outView); camera.updateMatrixWorld(); if (avatar.root.visible) avatar.root.visible = false;
        PL.pos.copy(GD.pos); PL.vel.set(0, 0, 0); PL.onGround = true; PL.jetting = false; PL.atLimit = GD.atLimit; PL.yaw = GD.heading;
        A.setJet(0); A.setBuggy(true, 2 + GD.speed * 0.45);
      } else if (driving) {
        const k = PL.keys;
        binp.f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0); binp.s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
        if (selling) { binp.f = 0; binp.s = 0; }
        binp.fire = fire && !selling; binp.mdx = PL.mdx; binp.mdy = PL.mdy; binp.sens = PL.sens; PL.mdx = PL.mdy = 0; PL.lookDX = PL.lookDY = 0;
        BG.drive(dt, binp, bcb);
        BG.applyCamera(camera, outView); camera.updateMatrixWorld(); if (avatar.root.visible) avatar.root.visible = false;
        PL.pos.copy(BG.pos); PL.vel.set(0, 0, 0); PL.onGround = true; PL.jetting = false; PL.atLimit = BG.atLimit; PL.yaw = BG.heading;
        A.setJet(0); A.setBuggy(true, Math.abs(BG.speed));
        LC.Map.edges(dt, BG.pos.x, BG.pos.z, BG.heading, 2.35, BG.headR, BG.suck > 0.2);
        // Säcke im Vorbeifahren einladen
        const sk = SK.nearest(BG.pos.x, BG.pos.z, 2.4);
        if (sk && sk.n + sk.g <= BG.room()) {
          if (MP.guest) MP.sackTake(sk, true);
          else { BG.load.n += sk.n; BG.load.g += sk.g; SK.remove(sk); MP.sackTaken(sk); shadowFrames = 2; A.play('thump'); UI.toast('Sack eingeladen', '', 1.5); }
        }
        if (Math.abs(BG.speed) > 2.5 && Math.random() < dt * 14) {
          const sd = Math.random() < 0.5 ? 1 : -1, ch = Math.cos(BG.heading), sh = Math.sin(BG.heading);
          V.kickDust(BG.pos.x + ch * sd * 1.05 + sh * 1.2, BG.pos.y, BG.pos.z - sh * sd * 1.05 + ch * 1.2, 3, 0.8);
        }
      } else {
        if (emote) {
          emote.t += dt;
          const k = PL.keys;
          if (emote.t > 0.3 && (k.KeyW || k.KeyA || k.KeyS || k.KeyD || k.Space)) emote.t = emote.dur;
          if (emote.t >= emote.dur) endEmote();
        }
        if (emoteMenu) { emoteMenuT -= dt; if (emoteMenuT <= 0) setEmoteMenu(false); }
        pcfg.jet = G.up.jet > 0; pcfg.fuelTime = val('fuel');
        if (emote) { PL.mdx = PL.mdy = 0; PL.lookDX = PL.lookDY = 0; } else PL.update(dt, pcfg, evs);
        if (riding === 'glider') {
          if (!GD.owned) stopRide(true);
          else { GD.seat(1, PL.pos); PL.pos.y -= 0.72; PL.vel.set(0, 0, 0); PL.onGround = true; PL.jetting = false; }
        } else if (riding) {
          if (!BG.here()) stopRide(true);
          else {      // sitzt rechts neben dem Fahrer und fährt mit
            const ch = Math.cos(BG.heading), sh = Math.sin(BG.heading);
            PL.pos.set(BG.pos.x + ch * 0.38 + sh * 0.12, BG.pos.y + 0.32, BG.pos.z - sh * 0.38 + ch * 0.12); PL.vel.set(0, 0, 0); PL.onGround = true; PL.jetting = false;
          }
        } else if (BG.here()) {     // nicht durch den geparkten Buggy laufen
          const dx = PL.pos.x - BG.pos.x, dz = PL.pos.z - BG.pos.z, d2 = dx * dx + dz * dz, rr = 1.95;
          if (d2 < rr * rr && d2 > 1e-6 && PL.pos.y - BG.pos.y < 2.3) { const d = Math.sqrt(d2); PL.pos.x = BG.pos.x + dx / d * rr; PL.pos.z = BG.pos.z + dz / d * rr; }
        }
        if (emote) {
          // Kamera geht kurz nach außen, damit man die Figur sieht
          avatar.root.visible = true; avatar.root.position.copy(PL.pos); avatar.root.rotation.y = PL.yaw;
          AV.pose(avatar, emote.id, emote.t, emote.dur);
          const a = PL.yaw + 0.45 + emote.t * 0.16, cx = PL.pos.x - Math.sin(a) * 3.6, cz = PL.pos.z - Math.cos(a) * 3.6;
          camera.position.set(cx, Math.max(B.groundAt(cx, cz) + 0.5, PL.pos.y + 1.55), cz);
          camera.rotation.set(0, 0, 0); camera.lookAt(PL.pos.x, PL.pos.y + 1.15, PL.pos.z);
        } else if (outView && !riding) {
          // Aussenansicht zu Fuss: eigene Figur zeigen
          const sp = Math.hypot(PL.vel.x, PL.vel.z);
          walkPh += dt * (3 + sp * 1.2);
          avatar.root.visible = true; avatar.root.position.copy(PL.pos); avatar.root.rotation.y = PL.yaw;
          AV.walk(avatar, walkPh, PL.onGround ? Math.min(1, sp / 4) : 0.15);
          LC.chase(camera, PL.pos, PL.yaw, PL.pitch, 4.6, 1.3);
        } else { if (!outView && avatar.root.visible && !emote) avatar.root.visible = false; PL.applyCamera(camera); }
        camera.updateMatrixWorld();
        A.setJet(PL.jetting ? 1 : 0);
        if (PL.jetting && Math.random() < dt * 40) V.spawn(PL.pos.x + (Math.random() - 0.5) * 0.3, PL.pos.y + 0.9, PL.pos.z + (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 1.5, -3 - Math.random() * 2, (Math.random() - 0.5) * 1.5, 0, 0.5, 0.07, 2.2, 1.4, 0.6, 0.05);
      }

      sunlitT -= dt;
      if (sunlitT <= 0) {
        sunlitT = 0.12;
        // im Schlagschatten oder auf einem Hang, den die Sonne nur streift?
        const ndl = W.normalAt(PL.pos.x, PL.pos.z, tmpV).dot(W.SUN_DIR);
        vcfg._sun = Math.min(checkSun(), 0.1 + 0.9 * U.smoothstep(0.03, 0.28, ndl));
      }
      sunlit += ((vcfg._sun === undefined ? 1 : vcfg._sun) - sunlit) * Math.min(1, dt * 6);

      // Werkzeug in der Hand
      const isVac = G.tool === 'vac' || G.tool === 'xl';
      hoseOn = BG.here() && !driving && !flying && riding !== 'glider' && (isVac || riding) && BG.room() > 0.01 && Math.hypot(PL.pos.x - BG.pos.x, PL.pos.z - BG.pos.z) < BG.HOSE_RANGE;
      if (G.tool === 'spoon') { vcfg.kind = 'scoop'; vcfg.radius = 0.3; vcfg.rate = 0.95; vcfg.period = 0.42; vcfg.reach = 4.4; }
      else if (G.tool === 'shovel') { vcfg.kind = 'scoop'; vcfg.radius = 0.52; vcfg.rate = 0.95; vcfg.period = 0.6; vcfg.reach = 4.7; }
      else {
        const xl = G.tool === 'xl';
        vcfg.kind = 'vac'; vcfg.radius = val('width') * (xl ? 1.6 : 1); vcfg.rate = (G.up.repair ? 4.2 : 2.6) * val('power') * (xl ? 1.7 : 1);
        vcfg.reach = 6.2 + G.up.power * 0.6 + (xl ? 1.2 : 0);
      }
      if (riding === 'glider') { vcfg.kind = 'vac'; vcfg.radius = 3.0; vcfg.rate = 9 * GD.pull(); vcfg.reach = 24; }             // großer Saugrüssel
      else if (riding) { vcfg.kind = 'vac'; vcfg.radius = 1.9 + G.up.bhead * 0.4; vcfg.rate = 7; vcfg.reach = 15; }      // Bordsauger
      vcfg.repaired = G.up.repair > 0 || !!riding; vcfg.hidden = driving || flying || !!emote || !!buildSel;
      vcfg.room = riding === 'glider' ? (GD.pull() > 0.02 ? GD.room() : 0) : hoseOn ? BG.room() : cap() - tankTotal(); vcfg.fill = tankTotal() / cap();
      vcfg.glitRatio = tankTotal() > 0 ? G.tank.g / tankTotal() : 0; vcfg.sunlit = sunlit;
      V.update(dt, time, camera, fire && !selling && !emote && !buildSel, vcfg, riding === 'glider' ? gcb.onSuck : hoseOn ? bcb.onSuck : onSuck);
      if (driving) A.setVac(BG.suck * 0.9, 0.6, false);
      SK.update(dt); updateRobots(dt); updateBuild(dt);
      if (hoseOn) { hoseP.set(0.36, -0.72, 0.1).applyAxisAngle(tmpV.set(0, 1, 0), PL.yaw).add(camera.position); }
      BG.update(dt, time, 1 - sunlit, hoseOn ? hoseP : null); if (!flying) GD.update(dt, time);
      updateSelling(dt);

      // voll?
      const full = driving ? BG.room() <= 0.01 : (!hoseOn && tankTotal() >= cap() - 0.01);
      if (full && !fullBeep) { fullBeep = true; A.play('full'); }
      if (!full) fullBeep = false;
      UI.warn(full && fire ? (driving ? 'Laderaum voll – ab zur ' + (G.sec === 1 ? 'Fahrzeug-Entladung' : 'Staub-Annahme am Außenposten') : 'Behälter voll – abgeben oder mit G in einen Sack füllen')
        : PL.atLimit ? 'Kraterrand zu steil – hier geht es noch nicht weiter' : null);
      UI.cross(driving ? (BG.suck > 0.2 ? 'on' : '') : !V.target.hit ? 'no' : V.intensity > 0.2 ? 'on' : '');

      // Benutzen-Hinweis
      findNear();
      if (selling) UI.prompt(null);
      else if (flying) UI.prompt(GD.atDock() && GD.total() > 0.05 ? '<kbd>E</kbd>Gleiter entladen<em>+ ' + UI.n0(Math.round(gliderWorth())) + ' ¢</em>' : GD.canExit() ? '<kbd>E</kbd>Aussteigen' : null);
      else if (driving) {
        if (atTunnel()) UI.prompt('Pass nach Sektor 2 – noch gesperrt (Werkstatt)');
        else if (BD.nearest(BG.pos.x, BG.pos.z, 6) && BD.nearest(BG.pos.x, BG.pos.z, 6).t === 'press') { const pb = BD.nearest(BG.pos.x, BG.pos.z, 6); UI.prompt(BD.ready(pb) >= 0.5 ? '<kbd>E</kbd>Ballen einladen<em>' + UI.n0(BD.ready(pb)) + ' kg gepresst</em>' : BG.total() > 0.05 && !G.buggyBales ? '<kbd>E</kbd>Ladung in die Presse kippen' : 'Staubpresse' + (pb.queue.n + pb.queue.g > 1 ? ' – presst noch ' + UI.n0(pb.queue.n + pb.queue.g) + ' kg' : '')); }
        else if (BG.total() > 0.05 && BD.nearest(BG.pos.x, BG.pos.z, 6) && BD.nearest(BG.pos.x, BG.pos.z, 6).t === 'tube') UI.prompt('<kbd>E</kbd>Ladung in die Röhre kippen<em>+ ' + UI.n0(Math.round(buggyWorth())) + ' ¢</em>');
        else if (BG.atStation() && BG.total() > 0.05) UI.prompt('<kbd>E</kbd>Buggy entladen<em>+ ' + UI.n0(Math.round(buggyWorth())) + ' ¢</em>');
        else if (Math.abs(BG.speed) < 0.6) UI.prompt('<kbd>E</kbd>Aussteigen');
        else UI.prompt(null);
      }
      else if (buildSel) {
        if (buildSel === 'del') UI.prompt('<kbd>Maus</kbd>Abreißen (halber Preis zurück) · <kbd>B</kbd>fertig');
        else { const a = BD.aim(camera, buildSel); UI.prompt(a.ok ? '<kbd>Maus</kbd>' + BD.TYPES[buildSel].name + ' bauen<em>' + UI.n0(BD.price(buildSel, a.x, a.z)) + ' ¢</em> · <kbd>B</kbd>fertig' : a.why + ' · <kbd>B</kbd>fertig'); }
      }
      else if (nearPoint && nearPoint.id === 'shop') UI.prompt('<kbd>E</kbd>Werkstatt öffnen');
      else if (nearPoint && nearPoint.id === 'press') { const pb = nearPoint.b, hasLoose = tankTotal() + G.carry.filter(c => !c.bale).length >= 0.05, work = pb.queue.n + pb.queue.g;
        UI.prompt(hasLoose ? '<kbd>E</kbd>Staub pressen lassen<em>Ballen sind 50 % mehr wert</em>' : BD.ready(pb) >= 0.5 ? '<kbd>E</kbd>Ballen mitnehmen<em>' + UI.n0(BD.ready(pb)) + ' kg fertig' + (work > 1 ? ', ' + UI.n0(work) + ' kg in Arbeit' : '') + '</em>' : work > 1 ? 'Staubpresse – presst noch ' + UI.n0(work) + ' kg' : 'Staubpresse – bring Staub mit'); }
      else if (nearPoint && nearPoint.id === 'intake') UI.prompt(tankTotal() + G.carry.length >= 0.05 ? '<kbd>E</kbd>Staub in die Röhre kippen<em>+ ' + UI.n0(Math.round(tankWorth())) + ' ¢</em>' : 'Einwurf der Glasröhre – bring Staub mit');
      else if ((!nearPoint || nearPoint.id === 'tunnel') && atTunnel()) UI.prompt('Pass nach Sektor 2 – noch gesperrt (Werkstatt)');
      else if (nearPoint && nearPoint.id !== 'tunnel') UI.prompt(tankTotal() + G.carry.length >= 0.05 ? '<kbd>E</kbd>Staub ' + (nearPoint.id === 'post' ? 'am Außenposten abgeben' : 'ins Staublager geben') + '<em>+ ' + UI.n0(Math.round(tankWorth())) + ' ¢</em>' : (nearPoint.id === 'post' ? 'Außenposten' : 'Staublager') + ' – du hast noch keinen Staub dabei');
      else if (riding) UI.prompt(riding === 'glider' && !GD.canExit() ? null : '<kbd>E</kbd>Aussteigen');
      else if (nearGlider) UI.prompt(MP.active && MP.gdrv && MP.gdrv !== MP.id ? '<kbd>E</kbd>Mitfliegen und den Saugrüssel bedienen' : '<kbd>E</kbd>In den Gleiter steigen');
      else if (nearBuggy) UI.prompt(MP.active && MP.drv && MP.drv !== MP.id ? '<kbd>E</kbd>Mitfahren und den Bordsauger bedienen' : '<kbd>E</kbd>In den Buggy steigen');
      else if (nearSack) UI.prompt('<kbd>E</kbd>Sack aufheben<em>' + UI.n0(nearSack.n + nearSack.g) + ' kg</em>');
      else if (nearRobot) UI.prompt('<kbd>E</kbd>Putzroboter einpacken<em>' + UI.n0(nearRobot.n + nearRobot.g) + ' / ' + RB.CAP + ' kg</em>');
      else if (!inVeh() && !MP.guest && RB.packed().length) UI.prompt('<kbd>R</kbd>Putzroboter absetzen' + (RB.packed().length > 1 ? '<em>' + RB.packed().length + ' im Gepäck</em>' : ''));
      else UI.prompt(null);

      // In welchem Krater bin ich? (Trennlinie mit etwas Spiel, damit es am Pass nicht flackert)
      const sdv = W.side(PL.pos.x, PL.pos.z);
      if (sdv > 3 && G.sec !== 2) { setSec(2); UI.toast('SEKTOR 2', 'big', 4); if (!G.stats.sec2Seen) { G.stats.sec2Seen = true; UI.toast('Roststaub, soweit das Auge reicht. Abgeben am Außenposten.', '', 6); } }
      else if (sdv < -3 && G.sec !== 1) { setSec(1); UI.toast('SEKTOR 1', 'big', 4); }

      // Sektor fertig?
      const pc = D.percentClean(), dk = G.sec === 1 ? 'sectorDone' : 'sector2Done';
      for (let sn = 1; sn <= 2; sn++) {
        const k = sn === 1 ? 'sectorDone' : 'sector2Done', bk = sn === 1 ? 'bonusPaid' : 'bonus2Paid', bonus = sn === 1 ? 2500 : 8000, p2 = D.percentOf(sn);
        if (!MP.guest && !G.stats[k] && p2 >= DONE_AT) {
          G.stats[k] = true;
          A.play('goal'); UI.toast('SEKTOR ' + sn + ' IST BLITZBLANK!', 'big', 6);
          const pay = !G.stats[bk];
          if (pay) { G.stats[bk] = true; G.money += bonus; G.stats.earned += bonus; UI.toast('Sektor-Bonus: + ' + UI.n0(bonus) + ' ¢', 'gold', 6); }
          save(); MP.pushWorld(); MP.event({ k: 'done', sec: sn, bonus: pay ? bonus : 0 });
        }
        W.tu[sn].uHint.value = (!G.stats[k] && p2 > 0.9) ? U.smoothstep(0.9, 0.95, p2) * 0.9 : 0;
      }
      if (pc > 0.9 && !G.stats[dk] && !hintShown[G.sec]) { hintShown[G.sec] = true; UI.toast('Staub-Scanner an: Die letzten Reste leuchten orange.', '', 6); }

      // Fast fertig: Pfeile und Lichtsäulen zeigen die letzten Staubreste
      updateRests(dt, pc, !G.stats[dk]);

      // Wegweiser zur Basis und zu den eigenen Markierungen
      const hm = LC.Map.home, bd = Math.hypot(PL.pos.x - hm.x, PL.pos.z - hm.z);
      if (bd > 24 && toScreen(hm.x, W.heightAt(hm.x, hm.z) + 7.5, hm.z)) UI.way(true, scr.x, scr.y, bd, G.sec === 1 ? 'BASIS' : 'AUSSENPOSTEN'); else UI.way(false);
      BG.CAP = val('bcap'); BG.headR = val('bhead');
      if (travelFade > 0) { travelFade -= dt; $('black').style.opacity = U.clamp(travelFade / 0.8, 0, 1); }
      if (lastSec !== G.sec) { lastSec = G.sec; $('sec-l').textContent = W.cfg.name; $('map-l').textContent = 'Karte · ' + W.cfg.name; }
      const mk = $('marks');
      while (mk.children.length < G.marks.length) { const d = document.createElement('div'); d.className = 'mark'; d.appendChild(document.createElement('i')); d.appendChild(document.createElement('span')); mk.appendChild(d); }
      for (let i = 0; i < mk.children.length; i++) {
        const el = mk.children[i], m = G.marks[i];
        const md = m ? Math.hypot(PL.pos.x - m.x, PL.pos.z - m.z) : 0;
        if (!m || md < 3 || !toScreen(m.x, W.heightAt(m.x, m.z) + 2.2, m.z)) { el.style.display = 'none'; continue; }
        el.style.display = ''; el.style.transform = 'translate(' + scr.x.toFixed(0) + 'px,' + scr.y.toFixed(0) + 'px) translate(-50%,-50%)';
        const txt = (i + 1) + ' · ' + Math.round(md) + ' m'; if (el.lastChild.textContent !== txt) el.lastChild.textContent = txt;
      }
      if (BG.driving !== lastDrive) { lastDrive = BG.driving; showEl('edges', BG.driving); if (BG.driving) { UI.el.keys.classList.add('fade'); keysT = 0; } }
      const st = GD.driving || riding === 'glider' ? 'HÖHE ' + Math.round(GD.alt) + ' m' + (GD.alt < GD.SUCK_ALT * 1.15 ? ' · RÜSSEL ' + Math.round(GD.pull() * 100) + ' %' : '') : BG.driving ? '' : PL.sprint ? 'SPRINT' : PL.crouch ? 'HOCKE' : PL.descending ? 'SINKFLUG' : '';
      if (st !== lastStance) { lastStance = st; const e = $('stance'); e.textContent = st; e.classList.toggle('hidden', !st); }
      LC.Map.update(dt, PL.pos.x, PL.pos.z, GD.driving ? GD.heading + GD.lookYaw : BG.driving ? BG.heading + BG.lookYaw : PL.yaw);
      if (LC.Map.open) document.getElementById('map-pc').textContent = UI.n1(D.percentClean() * 100) + ' % sauber';

      if (keysT && time > keysT) { UI.el.keys.classList.add('fade'); keysT = 0; }
      saveT += dt; if (saveT > 20) { saveT = 0; save(); }
    } else {
      if (state === 'menu') {
        const a = time * 0.025 + 0.5, R = 27, hm = G.sec === 1 ? { x: -3, z: 2 } : { x: BG.stations[2].x + 4, z: BG.stations[2].z };
        camera.position.set(hm.x + Math.sin(a) * R, 0, hm.z + Math.cos(a) * R);
        camera.position.y = Math.max(W.heightAt(camera.position.x, camera.position.z) + 2.2, 5.5 + Math.sin(time * 0.05) * 1.2);
        tmpV2.set(hm.x + 1, W.heightAt(hm.x, hm.z) + 3.2, hm.z - 0.5); camera.lookAt(tmpV2); camera.updateMatrixWorld();
      }
      if (state === 'map') LC.Map.update(dt, PL.pos.x, PL.pos.z, GD.driving ? GD.heading + GD.lookYaw : BG.driving ? BG.heading + BG.lookYaw : PL.yaw);
      else if (state === 'globe') {
        const gp = GL.update(dt, time, camera.aspect, scr), pin = $('globe-pin');
        pin.style.display = gp ? '' : 'none';
        if (gp) pin.style.transform = 'translate(' + ((gp.x * 0.5 + 0.5) * window.innerWidth).toFixed(0) + 'px,' + ((-gp.y * 0.5 + 0.5) * window.innerHeight).toFixed(0) + 'px)';
      }
      else if (state === 'cut') CS.update(dt, camera.aspect);
      V.idle(dt); A.setBuggy(false, 0);
      UI.prompt(null); UI.warn(null);
      if (MP.active) { SK.update(dt); updateRobots(dt); updateBuild(dt); BG.update(dt, time, 1 - sunlit, null); GD.update(dt, time); if (travelFade > 0 && state !== 'cut') { travelFade -= dt; $('black').style.opacity = U.clamp(travelFade / 0.8, 0, 1); } }
    }
    MP.update(dt, time);
    updateSky(dt, state === 'play' || (MP.active && state !== 'menu' && state !== 'cut'));

    // Geld-Anzeige zählt hoch
    if (G.shown !== G.money) {
      const diff = G.money - G.shown;
      G.shown = Math.abs(diff) < 1 ? G.money : G.shown + diff * Math.min(1, dt * 10);
    }
    if (state !== 'menu') {
      UI.money(G.shown); UI.sector(D.percentClean());
      if (GD.driving || riding === 'glider') UI.tank('Gleiter-Laderaum', GD.load.n, GD.load.g, GD.CAP, gliderWorth(), null);
      else if (BG.driving) UI.tank('Buggy-Laderaum', BG.load.n, BG.load.g, BG.CAP, buggyWorth(), null);
      else if (hoseOn && state === 'play') UI.tank('Buggy-Laderaum', BG.load.n, BG.load.g, BG.CAP, buggyWorth(), 'Schlauch angeschlossen – saugt direkt in den Buggy');
      else UI.tank('Staubbehälter', G.tank.n, G.tank.g, cap(), tankWorth(),
        G.carry.length ? G.carry.length + (G.carry.length > 1 ? ' Säcke' : ' Sack') + ' dabei (' + UI.n0(carryN() + carryG()) + ' kg)' : null);
      UI.jet(G.up.jet > 0 && !inVeh(), PL.fuel); updateGoals();
      UI.tools(inVeh() ? [] : TOOLS.map((t, i) => ({ key: i + 1, name: t.name, has: t.has(), on: t.id === G.tool })));
    }

    // Helmlampe: hell im Schatten, fast aus in der Sonne
    lamp.intensity = lampOn && state !== 'menu' && state !== 'cut' ? 0.1 + 2.6 * (1 - sunlit) : 0;
    B.update(time); W.update(time, camera, pxRatio); D.flush(); A.update(dt);
  }

  // Für Tests und zum Ausprobieren in der Konsole
  LC.debug = {
    get state() { return state; }, setState, save, newGame,
    tp: (x, z, yaw, pitch) => { PL.reset(x, z, yaw || 0); if (pitch != null) PL.pitch = pitch; },
    fire: v => { fire = v; }, money: v => { G.money += v; }, interact, buy,
    sim: (sec, fn) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { if (fn) fn(i / 60); update(1 / 60); } },
    film, step: filmStep, clock: ph => { G.clock = ph; }, storm: sec => { G.stormLeft = sec; }, AV, RB, THREE_camera: () => camera, THREE_scene: () => scene,
    PL, G, V, D, SK, BG, GD, CS, GL, MP, W, setSec, setTool, sackKey, applyState, openMap, openGlobe, closeMap, startEmote, startPlay,
    info: () => ({ state, pc: D.percentClean(), tank: tankTotal(), money: G.money, pos: PL.pos.toArray(), post: P.enabled, target: V.target })
  };

  window.addEventListener('load', () => setTimeout(init, 30));
})(window.LC);
