'use strict';
/* =========================================================
   Lunar Clean – Hauptprogramm: Spielstand, Regeln, Schleife
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World, D = LC.Dust, B = LC.Base, PL = LC.Player, V = LC.Vacuum, P = LC.Post, A = LC.Audio, UI = LC.UI, SK = LC.Sacks, BG = LC.Buggy, AV = LC.Avatar, GL = LC.Globe, CS = LC.Cutscene;
  const VERSION = '0.4.1';                 // nach jeder Änderung hochzählen
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
    buggy: { help: ["Der Buggy steht neben der Basis. Mit E steigst du ein und wieder aus.", "Fahren: W und S für Gas und Bremse, A und D zum Lenken, mit der Maus umsehen.", "Saugen: Linke Maustaste halten. Der Saugkopf vorn putzt eine über 4 m breite Spur direkt in den Laderaum (1.500 kg).", "Die zwei Bildschirme links und rechts zeigen die Saugkante. Die orange Linie ist das Ende deiner Spur – so fährst du Bahn an Bahn.", "Schlauch: Arbeitest du zu Fuß mit dem Sauger näher als 16 m am Buggy, geht der Staub direkt in den Buggy statt in deinen kleinen Behälter. Unten links steht dann „Buggy-Laderaum“.", "Säcke lädt der Buggy im Vorbeifahren von allein ein.", "Entladen: auf die gelb markierte Fahrzeug-Entladung neben dem Staublager fahren und E drücken."],
      name: 'Mondbuggy', max: 1, costs: [6000], needs: 'repair',
      desc: 'Fahren statt laufen: breiter Saugkopf vorn, 1.500 kg Laderaum, lädt Säcke ein. Mit Schlauch für deinen Handsauger. Entladen an der Fahrzeug-Station.' }
  };
  const UP_ORDER = ['shovel', 'vac', 'repair', 'width', 'power', 'tank', 'xl', 'jet', 'fuel', 'buggy'];

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
    G.marks = [];              // Markierungen auf der Karte: [{x, z}]
    G.tool = 'spoon';
    G.stats = { kg: 0, earned: 0, time: 0, sold: 0, sectorDone: false, intro: false, mapSeen: false, emoted: false };
    G.stage = 0;
  }
  const S = { sens: 1, vol: 0.7, music: true, gfx: 'mittel', full: true };
  const val = id => UP[id].vals[G.up[id]];
  const cap = () => val('tank');
  const tankTotal = () => G.tank.n + G.tank.g;
  const carryN = () => G.carry.reduce((a, c) => a + c.n, 0), carryG = () => G.carry.reduce((a, c) => a + c.g, 0);
  const tankWorth = () => (G.tank.n + carryN()) * PRICE_N + (G.tank.g + carryG()) * PRICE_G;
  const buggyWorth = () => BG.load.n * PRICE_N + BG.load.g * PRICE_G;

  function save() {
    try {
      let px = PL.pos.x, pz = PL.pos.z;
      if (BG.driving) { BG.exitPoint(tmpV); px = tmpV.x; pz = tmpV.z; }
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1, gv: 2, marks: G.marks, money: G.money, up: G.up, tank: G.tank, stats: G.stats, stage: G.stage, tool: G.tool, carry: G.carry,
        sacks: SK.serialize(), buggy: BG.owned ? BG.serialize() : null,
        pos: [px, pz, PL.yaw], dust: D.serialize()
      }));
    } catch (e) { /* Speicher voll oder gesperrt: Spiel läuft trotzdem weiter */ }
  }
  function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(S)); } catch (e) {} }
  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
      const o = JSON.parse(raw); if (!o || o.v !== 1) return false;
      freshState();
      G.money = +o.money || 0; G.shown = G.money;
      const old = !o.up || o.up.shovel === undefined;      // Spielstand von vor Version 0.3
      Object.keys(G.up).forEach(k => { G.up[k] = U.clamp(Math.floor(+(o.up || {})[k] || 0), 0, UP[k].max); });
      Object.assign(G.stats, o.stats || {}); G.stage = +o.stage || 0;
      if (old) { G.up.shovel = 1; G.up.vac = 1; G.stage = G.up.repair ? 6 : 5; }
      if (o.gv !== 2) { G.stage += 2; G.stats.intro = true; G.stats.mapSeen = true; G.stats.emoted = true; }   // vor Version 0.4: zwei neue Ziele am Anfang
      G.marks = (Array.isArray(o.marks) ? o.marks : []).slice(0, 10).map(m => ({ x: +m.x || 0, z: +m.z || 0 }));
      G.tank.n = Math.max(0, +(o.tank || {}).n || 0); G.tank.g = Math.max(0, +(o.tank || {}).g || 0);
      const over = tankTotal() / cap(); if (over > 1) { G.tank.n /= over; G.tank.g /= over; }
      G.carry = (Array.isArray(o.carry) ? o.carry : []).slice(0, SK.CARRY).map(c => ({ n: Math.max(0, +c.n || 0), g: Math.max(0, +c.g || 0) }));
      G.tool = o.tool || bestTool();
      if (!o.dust || !D.deserialize(o.dust)) D.reset();
      if (o.pos) PL.reset(+o.pos[0] || 0, +o.pos[1] || 0, +o.pos[2] || 0); else PL.reset(B.spawn.x, B.spawn.z, B.spawn.yaw);
      SK.load(o.sacks);
      BG.load.n = BG.load.g = 0;
      if (G.up.buggy && Array.isArray(o.buggy)) { BG.setOwned(true); BG.place(+o.buggy[0] || BG.park.x, +o.buggy[1] || BG.park.z, +o.buggy[2] || 0); BG.load.n = Math.max(0, +o.buggy[3] || 0); BG.load.g = Math.max(0, +o.buggy[4] || 0); }
      else if (G.up.buggy) { BG.setOwned(true); BG.place(BG.park.x, BG.park.z, BG.park.heading); }
      else BG.setOwned(false);
      return true;
    } catch (e) { return false; }
  }
  function newGame() {
    freshState(); D.reset(); PL.reset(B.spawn.x, B.spawn.z, B.spawn.yaw);
    SK.clear(); BG.setOwned(false); BG.load.n = BG.load.g = 0; selling = null;
    applyState();
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }
  function applyState() {
    // unter Landeplatz und Entladestation liegt kein Staub; unsichtbare Reste zählen nicht
    D.clearArea(B.pad.x, B.pad.z, B.pad.r + 0.4); D.clearArea(BG.station.x, BG.station.z, 2.8, 4.1, 0.5); D.normalize();
    // wurde der Sektor in einer älteren Version zu früh als fertig gemeldet? Dann geht es weiter
    if (G.stats.sectorDone && D.percentClean() < DONE_AT) { G.stats.sectorDone = false; G.stats.bonusPaid = true; G.stage = Math.min(G.stage, GOALS.length - 2); }
    LC.Map.marks = G.marks;
    V.setRepaired(G.up.repair > 0);
    const t = TOOLS.filter(x => x.id === G.tool)[0];
    if (!t || !t.has()) G.tool = bestTool();
    V.setTool(G.tool);
  }

  // ---------- Aufbau ----------
  let renderer, scene, camera, lamp, lampOn = true, state = 'load', time = 0, lastT = 0, fire = false;
  let sunlit = 1, sunlitT = 0, saveT = 0, selling = null, coinT = 0, limitT = 0, fullBeep = false, hintT = 0;
  let fpsAcc = 0, fpsN = 0, pxRatio = 1, shadowFrames = 4, keysT = 0, hintShown = false;
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

    D.init();
    W.addFlat(B.pad.x, B.pad.z, B.pad.r + 0.8, 0.05); W.addFlat(BG.station.x, BG.station.z, 5.0, 0.05);
    W.build(scene, D.tex, D.glitTex);
    if (S.gfx === 'niedrig') W.sun.shadow.mapSize.set(2048, 2048);
    B.build(scene);
    V.init(scene);
    avatar = AV.build(); avatar.root.visible = false; scene.add(avatar.root);
    SK.init(scene, s => { shadowFrames = 2; A.play('thump'); V.kickDust(s.x, s.y, s.z, 12, 0.9); });
    BG.init(scene);
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

    freshState();
    if (!load()) { freshState(); D.reset(); PL.reset(B.spawn.x, B.spawn.z, B.spawn.yaw); }
    applyState();
    A.vol = S.vol; A.music = S.music; PL.sens = S.sens;

    bindInput();
    LC.Map.init();
    bindUI();
    UI.el.ver.textContent = 'Version ' + VERSION;
    try { if (window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches) document.getElementById('touch').classList.remove('hidden'); } catch (e) {}
    UI.el['btn-play'].textContent = hasSave() ? 'Weiterspielen' : 'Spielen';
    UI.show('btn-new', hasSave());
    setState('menu');
    UI.el.loading.classList.add('hidden');
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
    if (s === 'pause') renderStats();
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
    GL.open(); G.stats.mapSeen = true; setState('globe'); A.play('click');
    const moonArea = 3.793e13, cleaned = D.percentClean() * Math.PI * 74 * 74;
    $('globe-pc').textContent = (cleaned / moonArea * 100).toFixed(10).replace('.', ',') + ' %';
    $('globe-sec').textContent = 'Sektor 1: ' + UI.n1(D.percentClean() * 100) + ' % sauber';
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
      if (state === 'play' && e.button === 0) fire = true;
      else if (state === 'cut') CS.skip();
    });
    document.addEventListener('mouseup', e => { if (e.button === 0) fire = false; });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('wheel', e => {
      if (state === 'play' && !BG.driving) cycleTool(e.deltaY > 0 ? 1 : -1);
      else if (state === 'globe') GL.zoom(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });
    // Musik schon im Menü: der Browser erlaubt Ton erst nach dem ersten Klick oder Tastendruck
    const firstTouch = () => { A.init(); A.setVolume(S.vol); A.setMusic(S.music); document.removeEventListener('pointerdown', firstTouch); document.removeEventListener('keydown', firstTouch); };
    document.addEventListener('pointerdown', firstTouch); document.addEventListener('keydown', firstTouch);
    document.addEventListener('keydown', e => {
      if (state === 'play') {
        if (emoteMenu && /^Digit[1-6]$/.test(e.code)) { if (!e.repeat) startEmote(+e.code.slice(5) - 1); e.preventDefault(); return; }
        PL.keys[e.code] = true;
        if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].indexOf(e.code) >= 0) e.preventDefault();
        if (e.repeat) return;
        if (emote && e.code !== 'KeyX') return;
        switch (e.code) {
          case 'KeyE': interact(); break;
          case 'KeyG': sackKey(); break;
          case 'KeyF': lampOn = !lampOn; A.play('click'); break;
          case 'KeyM': openMap(); break;
          case 'KeyX': if (emote) endEmote(); else if (!BG.driving) setEmoteMenu(!emoteMenu); break;
          case 'ShiftLeft': case 'ShiftRight': if (!BG.driving) { PL.sprint = !PL.sprint; if (PL.sprint) PL.crouch = false; } break;
          case 'KeyC': if (!BG.driving && PL.onGround) { PL.crouch = !PL.crouch; if (PL.crouch) PL.sprint = false; } break;
          case 'Escape': if (TEST) setState('pause'); break;
          default:
            if (/^Digit[1-4]$/.test(e.code) && !BG.driving) { const t = TOOLS[+e.code.slice(5) - 1]; if (t.has()) setTool(t.id); else { A.play('deny'); UI.toast(t.name + ' hast du noch nicht – gibt es in der Werkstatt.', '', 2.2); } }
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
    window.addEventListener('beforeunload', () => { if (state !== 'menu' || G.stats.time > 0) save(); });
  }

  function bindUI() {
    const e = UI.el;
    e['btn-play'].addEventListener('click', () => startPlay(!G.stats.intro && G.stats.time < 1));
    e['btn-new'].addEventListener('click', () => { newGame(); shadowFrames = 3; startPlay(true); });
    e['btn-resume'].addEventListener('click', () => startPlay());
    e['btn-tomenu'].addEventListener('click', () => { save(); UI.el['btn-play'].textContent = 'Weiterspielen'; UI.show('btn-new', true); setState('menu'); });
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

  // ---------- Werkstatt ----------
  function shopItems() {
    const items = UP_ORDER.map(id => {
      const u = UP[id], lv = G.up[id];
      const it = { id, name: u.name, desc: u.desc, level: lv, max: u.max, cost: u.costs[lv], help: !!u.help };
      if (u.vals) { it.nowTxt = u.fmt(u.vals[lv]); if (lv < u.max) it.nextTxt = u.fmt(u.vals[lv + 1]); }
      if (u.needs && !G.up[u.needs]) { it.locked = true; it.lockTxt = 'Erst ' + UP[u.needs].name + ' kaufen'; }
      return it;
    });
    items.push({ id: 'robot', name: 'Putzroboter', desc: 'Saugt ganz von allein rund um die Basis – der erste Schritt zur Automatisierung.', teaser: 'Kommt bald', max: 1, level: 0 });
    items.push({ id: 'rocket', name: 'Rakete nach Hause', desc: 'Der Grund, warum du das alles machst. Ein Ticket zurück zur Erde.', teaser: '1.000.000 ¢ · noch ein weiter Weg', max: 1, level: 0, goal: true });
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
  function buy(id) {
    const u = UP[id], lv = G.up[id];
    if (!u || lv >= u.max) return;
    const cost = u.costs[lv];
    if (G.money < cost || (u.needs && !G.up[u.needs])) { A.play('deny'); return; }
    G.money -= cost; G.shown = G.money; G.up[id] = lv + 1;
    A.play('buy');
    if (id === 'repair') V.setRepaired(true);
    if (id === 'shovel' || id === 'vac' || id === 'xl') setTool(id, true);
    if (id === 'buggy') { BG.setOwned(true); BG.place(BG.park.x, BG.park.z, BG.park.heading); UI.toast('Dein Mondbuggy steht neben der Basis bereit!', 'gold', 5); }
    renderShop(); UI.money(G.money, true); save();
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

  function renderStats() {
    const moonArea = 3.793e13, cleaned = D.percentClean() * Math.PI * 74 * 74;
    UI.stats([
      ['Sektor 1 sauber', UI.n1(D.percentClean() * 100) + ' %'],
      ['Mond gesamt sauber', (cleaned / moonArea * 100).toFixed(10).replace('.', ',') + ' %'],
      ['Staub gesammelt', UI.n0(G.stats.kg) + ' kg'],
      ['Geld verdient', UI.n0(G.stats.earned) + ' ¢'],
      ['Spielzeit', Math.floor(G.stats.time / 60) + ' min']
    ]);
  }

  // ---------- Benutzen (E), Säcke (G), Buggy ----------
  let nearPoint = null, nearBuggy = false, nearSack = null, driveHint = false, sackHint = false;
  function findNear() {
    nearPoint = null; nearBuggy = false; nearSack = null; let best = 1e9;
    if (BG.driving) return;
    for (let i = 0; i < B.points.length; i++) {
      const p = B.points[i], d = Math.hypot(PL.pos.x - p.x, PL.pos.z - p.z);
      if (d < p.r && d < best && Math.abs(PL.pos.y - (p.y - 1.2)) < 3) { best = d; nearPoint = p; }
    }
    if (BG.owned && Math.hypot(PL.pos.x - BG.pos.x, PL.pos.z - BG.pos.z) < 3.7 && Math.abs(PL.pos.y - BG.pos.y) < 2.5) nearBuggy = true;
    nearSack = SK.nearest(PL.pos.x, PL.pos.z, 1.5);
  }
  function enterBuggy() {
    BG.driving = true; BG.lookYaw = 0; BG.lookPitch = -0.08; fire = false; A.play('click');
    if (!driveHint) { driveHint = true; UI.toast('W/S Gas und Bremse · A/D lenken · Linke Maustaste saugen · E aussteigen', '', 7); }
  }
  function exitBuggy() {
    BG.driving = false; BG.speed = 0; BG.suck = 0; A.setBuggy(false, 0); A.play('click');
    BG.exitPoint(tmpV); PL.reset(tmpV.x, tmpV.z, BG.heading);
  }
  function throwSack(n, g) {
    PL.forward(tmpV2);
    const dir = { x: -Math.sin(PL.yaw), z: -Math.cos(PL.yaw) };
    tmpV.set(camera.position.x + dir.x * 0.5, camera.position.y - 0.55, camera.position.z + dir.z * 0.5);
    return SK.throwSack(tmpV, dir, n, g);
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
  function interact() {
    if (selling) return;
    if (BG.driving) {
      if (BG.atStation() && BG.total() > 0.05) {
        selling = { src: 'buggy', n: BG.load.n, g: BG.load.g, t: 0, dur: 1.2 + Math.min(3.2, BG.total() / 350), paid: 0, total: Math.round(buggyWorth()) };
        BG.unloading = true; BG.speed = 0;
      } else exitBuggy();
      return;
    }
    if (nearPoint && nearPoint.id === 'shop') openShop();
    else if (nearPoint && nearPoint.id === 'silo') {
      const tot = tankTotal() + carryN() + carryG();
      if (tot < 0.05) { A.play('deny'); UI.toast('Du hast keinen Staub dabei. Erst sammeln!'); return; }
      selling = { src: 'tank', tn: G.tank.n, tg: G.tank.g, n: G.tank.n + carryN(), g: G.tank.g + carryG(), t: 0, dur: 0.9 + Math.min(1.8, tot / 160), paid: 0, total: Math.round(tankWorth()) };
      G.carry = [];
    }
    else if (nearBuggy) enterBuggy();
    else if (nearSack) {
      if (G.carry.length >= SK.CARRY) { A.play('deny'); UI.toast('Mehr als ' + SK.CARRY + ' Säcke kannst du nicht tragen.', '', 2.5); return; }
      G.carry.push({ n: nearSack.n, g: nearSack.g }); SK.remove(nearSack); shadowFrames = 2; A.play('click');
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
    if (s.src === 'buggy') {
      BG.load.n = s.n * rest; BG.load.g = s.g * rest;
      tmpV.set(BG.pos.x, BG.pos.y + 0.1, BG.pos.z);
      for (let i = 0; i < n; i++) { tmpV2.copy(BG.hopperWorld); tmpV2.x += (Math.random() - 0.5) * 1.4; tmpV2.z += (Math.random() - 0.5) * 1.0; V.stream(tmpV2, tmpV, Math.random() < gfrac); }
    } else {
      G.tank.n = s.tn * rest; G.tank.g = s.tg * rest;
      for (let i = 0; i < n; i++) V.stream(V.nozzleWorld, B.siloNozzle, Math.random() < gfrac);
    }
    if (k >= 1) {
      if (s.src === 'buggy') { BG.load.n = 0; BG.load.g = 0; BG.unloading = false; } else { G.tank.n = 0; G.tank.g = 0; }
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
    { txt: 'Steig mit E in den Buggy und putze ganz Sektor 1 sauber. Entladen an der Fahrzeug-Station.', done: () => G.stats.sectorDone },
    { txt: 'Sektor 1 ist blitzblank! Putzroboter und neue Sektoren kommen bald.', done: () => false }
  ];
  function updateGoals() {
    while (G.stage < GOALS.length - 1 && GOALS[G.stage].done()) { G.stage++; if (state === 'play') A.play('click'); }
    UI.goal(GOALS[G.stage].txt);
  }

  // Weltpunkt auf den Bildschirm rechnen (am Rand festgehalten). Ergebnis in scr
  const scr = { x: 0, y: 0 };
  let lastStance = '', lastDrive = null;
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
    const s = W.SUN_DIR, ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
    for (let d = 1.5; d < 85; d += 2.2) {
      const x = ox + s.x * d, y = oy + s.y * d, z = oz + s.z * d;
      if (y < W.heightAt(x, z)) return 0.1;
    }
    return 1;
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

  function frame(now) {
    requestAnimationFrame(frame);
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
    else P.render(renderer, scene, camera, state === 'menu' || state === 'cut' || emote ? null : V.scene, V.camera, time);
  }

  function update(dt) {
    time += dt;

    if (state === 'play') {
      G.stats.time += dt;
      const driving = BG.driving;
      if (driving) {
        const k = PL.keys;
        binp.f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0); binp.s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
        if (selling) { binp.f = 0; binp.s = 0; }
        binp.fire = fire && !selling; binp.mdx = PL.mdx; binp.mdy = PL.mdy; binp.sens = PL.sens; PL.mdx = PL.mdy = 0; PL.lookDX = PL.lookDY = 0;
        BG.drive(dt, binp, bcb);
        BG.applyCamera(camera); camera.updateMatrixWorld();
        PL.pos.copy(BG.pos); PL.vel.set(0, 0, 0); PL.onGround = true; PL.jetting = false; PL.atLimit = BG.atLimit; PL.yaw = BG.heading;
        A.setJet(0); A.setBuggy(true, Math.abs(BG.speed));
        LC.Map.edges(dt, BG.pos.x, BG.pos.z, BG.heading, 2.35, 2.2, BG.suck > 0.2);
        // Säcke im Vorbeifahren einladen
        const sk = SK.nearest(BG.pos.x, BG.pos.z, 2.4);
        if (sk && sk.n + sk.g <= BG.room()) { BG.load.n += sk.n; BG.load.g += sk.g; SK.remove(sk); shadowFrames = 2; A.play('thump'); UI.toast('Sack eingeladen', '', 1.5); }
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
        if (BG.owned) {     // nicht durch den geparkten Buggy laufen
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
        } else PL.applyCamera(camera);
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
      hoseOn = BG.owned && !driving && isVac && BG.room() > 0.01 && Math.hypot(PL.pos.x - BG.pos.x, PL.pos.z - BG.pos.z) < BG.HOSE_RANGE;
      if (G.tool === 'spoon') { vcfg.kind = 'scoop'; vcfg.radius = 0.3; vcfg.rate = 0.95; vcfg.period = 0.42; vcfg.reach = 4.4; }
      else if (G.tool === 'shovel') { vcfg.kind = 'scoop'; vcfg.radius = 0.52; vcfg.rate = 0.95; vcfg.period = 0.6; vcfg.reach = 4.7; }
      else {
        const xl = G.tool === 'xl';
        vcfg.kind = 'vac'; vcfg.radius = val('width') * (xl ? 1.6 : 1); vcfg.rate = (G.up.repair ? 4.2 : 2.6) * val('power') * (xl ? 1.7 : 1);
        vcfg.reach = 6.2 + G.up.power * 0.6 + (xl ? 1.2 : 0);
      }
      vcfg.repaired = G.up.repair > 0; vcfg.hidden = driving || !!emote;
      vcfg.room = hoseOn ? BG.room() : cap() - tankTotal(); vcfg.fill = tankTotal() / cap();
      vcfg.glitRatio = tankTotal() > 0 ? G.tank.g / tankTotal() : 0; vcfg.sunlit = sunlit;
      V.update(dt, time, camera, fire && !selling && !emote, vcfg, hoseOn ? bcb.onSuck : onSuck);
      if (driving) A.setVac(BG.suck * 0.9, 0.6, false);
      SK.update(dt);
      if (hoseOn) { hoseP.set(0.36, -0.72, 0.1).applyAxisAngle(tmpV.set(0, 1, 0), PL.yaw).add(camera.position); }
      BG.update(dt, time, 1 - sunlit, hoseOn ? hoseP : null);
      updateSelling(dt);

      // voll?
      const full = driving ? BG.room() <= 0.01 : (!hoseOn && tankTotal() >= cap() - 0.01);
      if (full && !fullBeep) { fullBeep = true; A.play('full'); }
      if (!full) fullBeep = false;
      UI.warn(full && fire ? (driving ? 'Laderaum voll – ab zur Fahrzeug-Entladung' : 'Behälter voll – zum Staublager oder mit G in einen Sack füllen')
        : PL.atLimit ? 'Kraterrand zu steil – hier geht es noch nicht weiter' : null);
      UI.cross(driving ? (BG.suck > 0.2 ? 'on' : '') : !V.target.hit ? 'no' : V.intensity > 0.2 ? 'on' : '');

      // Benutzen-Hinweis
      findNear();
      if (selling) UI.prompt(null);
      else if (driving) {
        if (BG.atStation() && BG.total() > 0.05) UI.prompt('<kbd>E</kbd>Buggy entladen<em>+ ' + UI.n0(Math.round(buggyWorth())) + ' ¢</em>');
        else if (Math.abs(BG.speed) < 0.6) UI.prompt('<kbd>E</kbd>Aussteigen');
        else UI.prompt(null);
      }
      else if (nearPoint && nearPoint.id === 'shop') UI.prompt('<kbd>E</kbd>Werkstatt öffnen');
      else if (nearPoint) UI.prompt(tankTotal() + G.carry.length >= 0.05 ? '<kbd>E</kbd>Staub ins Staublager geben<em>+ ' + UI.n0(Math.round(tankWorth())) + ' ¢</em>' : 'Staublager – du hast noch keinen Staub dabei');
      else if (nearBuggy) UI.prompt('<kbd>E</kbd>In den Buggy steigen');
      else if (nearSack) UI.prompt('<kbd>E</kbd>Sack aufheben<em>' + UI.n0(nearSack.n + nearSack.g) + ' kg</em>');
      else UI.prompt(null);

      // Sektor fertig?
      const pc = D.percentClean();
      if (!G.stats.sectorDone && pc >= DONE_AT) {
        G.stats.sectorDone = true;
        A.play('goal'); UI.toast('SEKTOR 1 IST BLITZBLANK!', 'big', 6);
        if (!G.stats.bonusPaid) { G.stats.bonusPaid = true; G.money += 2500; G.stats.earned += 2500; UI.toast('Sektor-Bonus: + 2.500 ¢', 'gold', 6); }
        save();
      }
      W.terrainUniforms.uHint.value = (!G.stats.sectorDone && pc > 0.9) ? U.smoothstep(0.9, 0.95, pc) * 0.9 : 0;
      if (pc > 0.9 && !G.stats.sectorDone && !hintShown) { hintShown = true; UI.toast('Staub-Scanner an: Die letzten Reste leuchten orange.', '', 6); }

      // Wegweiser zur Basis und zu den eigenen Markierungen
      const bd = Math.hypot(PL.pos.x - B.silo.x, PL.pos.z - B.silo.z);
      if (bd > 24 && toScreen(B.silo.x, W.heightAt(B.silo.x, B.silo.z) + 7.5, B.silo.z)) UI.way(true, scr.x, scr.y, bd); else UI.way(false);
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
      const st = BG.driving ? '' : PL.sprint ? 'SPRINT' : PL.crouch ? 'HOCKE' : PL.descending ? 'SINKFLUG' : '';
      if (st !== lastStance) { lastStance = st; const e = $('stance'); e.textContent = st; e.classList.toggle('hidden', !st); }
      LC.Map.update(dt, PL.pos.x, PL.pos.z, BG.driving ? BG.heading + BG.lookYaw : PL.yaw);
      if (LC.Map.open) document.getElementById('map-pc').textContent = UI.n1(D.percentClean() * 100) + ' % sauber';

      if (keysT && time > keysT) { UI.el.keys.classList.add('fade'); keysT = 0; }
      saveT += dt; if (saveT > 20) { saveT = 0; save(); }
    } else {
      if (state === 'menu') {
        const a = time * 0.025 + 0.5, R = 27;
        camera.position.set(-3 + Math.sin(a) * R, 0, 2 + Math.cos(a) * R);
        camera.position.y = Math.max(W.heightAt(camera.position.x, camera.position.z) + 2.2, 5.5 + Math.sin(time * 0.05) * 1.2);
        tmpV2.set(-2, 3.4, 1.5); camera.lookAt(tmpV2); camera.updateMatrixWorld();
      }
      if (state === 'map') LC.Map.update(dt, PL.pos.x, PL.pos.z, BG.driving ? BG.heading + BG.lookYaw : PL.yaw);
      else if (state === 'globe') {
        const gp = GL.update(dt, time, camera.aspect, scr), pin = $('globe-pin');
        pin.style.display = gp ? '' : 'none';
        if (gp) pin.style.transform = 'translate(' + ((gp.x * 0.5 + 0.5) * window.innerWidth).toFixed(0) + 'px,' + ((-gp.y * 0.5 + 0.5) * window.innerHeight).toFixed(0) + 'px)';
      }
      else if (state === 'cut') CS.update(dt, camera.aspect);
      V.idle(dt); A.setBuggy(false, 0);
      UI.prompt(null); UI.warn(null);
    }

    // Geld-Anzeige zählt hoch
    if (G.shown !== G.money) {
      const diff = G.money - G.shown;
      G.shown = Math.abs(diff) < 1 ? G.money : G.shown + diff * Math.min(1, dt * 10);
    }
    if (state !== 'menu') {
      UI.money(G.shown); UI.sector(D.percentClean());
      if (BG.driving) UI.tank('Buggy-Laderaum', BG.load.n, BG.load.g, BG.CAP, buggyWorth(), null);
      else if (hoseOn && state === 'play') UI.tank('Buggy-Laderaum', BG.load.n, BG.load.g, BG.CAP, buggyWorth(), 'Schlauch angeschlossen – saugt direkt in den Buggy');
      else UI.tank('Staubbehälter', G.tank.n, G.tank.g, cap(), tankWorth(),
        G.carry.length ? G.carry.length + (G.carry.length > 1 ? ' Säcke' : ' Sack') + ' dabei (' + UI.n0(carryN() + carryG()) + ' kg)' : null);
      UI.jet(G.up.jet > 0 && !BG.driving, PL.fuel); updateGoals();
      UI.tools(BG.driving ? [] : TOOLS.map((t, i) => ({ key: i + 1, name: t.name, has: t.has(), on: t.id === G.tool })));
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
    PL, G, V, D, SK, BG, CS, GL, setTool, sackKey, applyState, openMap, openGlobe, closeMap, startEmote, startPlay,
    info: () => ({ state, pc: D.percentClean(), tank: tankTotal(), money: G.money, pos: PL.pos.toArray(), post: P.enabled, target: V.target })
  };

  window.addEventListener('load', () => setTimeout(init, 30));
})(window.LC);
