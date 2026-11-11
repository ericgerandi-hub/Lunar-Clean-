'use strict';
/* =========================================================
   Lunar Clean – Hauptprogramm: Spielstand, Regeln, Schleife
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World, D = LC.Dust, B = LC.Base, PL = LC.Player, V = LC.Vacuum, P = LC.Post, A = LC.Audio, UI = LC.UI;
  const VERSION = '0.1.0';                 // nach jeder Änderung hochzählen
  const SAVE_KEY = 'lunarclean_save_v1', SET_KEY = 'lunarclean_settings_v1';
  const PRICE_N = 2, PRICE_G = 15;         // ¢ pro kg: normaler Staub / Glitzerstaub
  const TEST = /[?&]test/.test(location.search);

  // ---------- Upgrades ----------
  const UP = {
    repair: { name: 'Sauger reparieren', max: 1, costs: [60],
      desc: 'Schluss mit dem Stottern: Der Motor läuft wieder rund und saugt deutlich stärker.' },
    width: { name: 'Breitere Düse', max: 4, costs: [120, 350, 900, 2200], vals: [0.62, 0.85, 1.15, 1.55, 2.05],
      desc: 'Saugt eine größere Fläche auf einmal.', fmt: v => UI.n1(v * 2) + ' m breit' },
    power: { name: 'Stärkerer Motor', max: 3, costs: [150, 500, 1400], vals: [1, 1.5, 2.2, 3.2],
      desc: 'Saugt schneller und reicht weiter.', fmt: v => Math.round(v * 100) + ' % Saugkraft' },
    tank: { name: 'Größerer Tank', max: 4, costs: [100, 300, 800, 2000], vals: [40, 90, 200, 450, 1000],
      desc: 'Mehr Staub pro Tour – seltener zum Staublager laufen.', fmt: v => UI.n0(v) + ' kg' },
    jet: { name: 'Jetpack', max: 1, costs: [750],
      desc: 'Leertaste in der Luft gedrückt halten und abheben. Dein erstes Fortbewegungsmittel!' },
    fuel: { name: 'Jetpack-Treibstoff', max: 2, costs: [400, 1200], vals: [3.2, 5.5, 9], needs: 'jet',
      desc: 'Länger in der Luft bleiben.', fmt: v => UI.n1(v) + ' s Schub' }
  };
  const UP_ORDER = ['repair', 'width', 'power', 'tank', 'jet', 'fuel'];

  // ---------- Spielstand ----------
  const G = LC.G = {};
  function freshState() {
    G.money = 0; G.shown = 0;
    G.up = { repair: 0, width: 0, power: 0, tank: 0, jet: 0, fuel: 0 };
    G.tank = { n: 0, g: 0 };
    G.stats = { kg: 0, earned: 0, time: 0, sold: 0, sectorDone: false };
    G.stage = 0;
  }
  const S = { sens: 1, vol: 0.7, music: true, gfx: 'mittel' };
  const val = id => UP[id].vals[G.up[id]];
  const cap = () => val('tank');
  const tankTotal = () => G.tank.n + G.tank.g;
  const tankWorth = () => G.tank.n * PRICE_N + G.tank.g * PRICE_G;

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1, money: G.money, up: G.up, tank: G.tank, stats: G.stats, stage: G.stage,
        pos: [PL.pos.x, PL.pos.z, PL.yaw], dust: D.serialize()
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
      Object.keys(G.up).forEach(k => { G.up[k] = U.clamp(Math.floor(+(o.up || {})[k] || 0), 0, UP[k].max); });
      G.tank.n = +(o.tank || {}).n || 0; G.tank.g = +(o.tank || {}).g || 0;
      Object.assign(G.stats, o.stats || {}); G.stage = +o.stage || 0;
      if (!o.dust || !D.deserialize(o.dust)) D.reset();
      if (o.pos) PL.reset(+o.pos[0] || 0, +o.pos[1] || 0, +o.pos[2] || 0); else PL.reset(B.spawn.x, B.spawn.z, B.spawn.yaw);
      return true;
    } catch (e) { return false; }
  }
  function newGame() {
    freshState(); D.reset(); PL.reset(B.spawn.x, B.spawn.z, B.spawn.yaw);
    V.setRepaired(false);
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
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
    W.build(scene, D.tex, D.glitTex);
    if (S.gfx === 'niedrig') W.sun.shadow.mapSize.set(2048, 2048);
    B.build(scene);
    V.init(scene);
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
    V.setRepaired(G.up.repair > 0);
    A.vol = S.vol; A.music = S.music; PL.sens = S.sens;

    bindInput();
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
  function setState(s) {
    state = s;
    UI.show('menu', s === 'menu'); UI.show('ver', s === 'menu');
    UI.show('pause', s === 'pause'); UI.show('shop', s === 'shop');
    UI.show('hud', s === 'play' || s === 'shop' || s === 'pause' || s === 'wait');
    if (s !== 'play') { fire = false; PL.keys = {}; PL.mdx = PL.mdy = 0; A.setJet(0); }
    if (s === 'pause') renderStats();
    if (s === 'shop') renderShop();
    if (s === 'play') { keysT = keysT || time + 14; }
    document.body.style.cursor = s === 'play' ? 'none' : 'default';
  }
  function lock() {
    if (TEST) { setState('play'); return; }
    const c = renderer.domElement;
    try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  function startPlay() { A.init(); A.setVolume(S.vol); A.setMusic(S.music); lock(); }

  function bindInput() {
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === renderer.domElement;
      if (locked) setState('play');
      else if (state === 'play') { setState('pause'); save(); }
    });
    document.addEventListener('pointerlockerror', () => { if (state === 'wait') setState('pause'); });
    document.addEventListener('mousemove', e => {
      if (state !== 'play') return;
      if (TEST && !(e.buttons & 2)) return;
      PL.mdx += e.movementX || 0; PL.mdy += e.movementY || 0;
    });
    document.addEventListener('mousedown', e => { if (state === 'play' && e.button === 0) fire = true; });
    document.addEventListener('mouseup', e => { if (e.button === 0) fire = false; });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
      if (state === 'play') {
        PL.keys[e.code] = true;
        if (e.code === 'KeyE' && !e.repeat) interact();
        if (e.code === 'KeyF' && !e.repeat) { lampOn = !lampOn; A.play('click'); }
        if (e.code === 'KeyM' && !e.repeat) { S.music = !S.music; A.setMusic(S.music); saveSettings(); UI.toast(S.music ? 'Musik an' : 'Musik aus'); }
        if (TEST && e.code === 'Escape') setState('pause');
        if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].indexOf(e.code) >= 0) e.preventDefault();
      } else if (state === 'shop') {
        if ((e.code === 'KeyE' || e.code === 'Escape') && !e.repeat) closeShop();
      }
    });
    document.addEventListener('keyup', e => { PL.keys[e.code] = false; });
    window.addEventListener('blur', () => { PL.keys = {}; fire = false; });
    window.addEventListener('beforeunload', () => { if (state !== 'menu' || G.stats.time > 0) save(); });
  }

  function bindUI() {
    const e = UI.el;
    e['btn-play'].addEventListener('click', () => startPlay());
    e['btn-new'].addEventListener('click', () => { newGame(); startPlay(); });
    e['btn-resume'].addEventListener('click', () => startPlay());
    e['btn-tomenu'].addEventListener('click', () => { save(); UI.el['btn-play'].textContent = 'Weiterspielen'; UI.show('btn-new', true); setState('menu'); });
    e['btn-shopclose'].addEventListener('click', closeShop);
    let wipeArmed = 0;
    e['btn-wipe'].addEventListener('click', () => {
      if (performance.now() - wipeArmed < 4000) { newGame(); e['btn-wipe'].textContent = 'Löschen und neu anfangen'; wipeArmed = 0; shadowFrames = 3; startPlay(); }
      else { wipeArmed = performance.now(); e['btn-wipe'].textContent = 'Wirklich löschen? Nochmal klicken'; setTimeout(() => { e['btn-wipe'].textContent = 'Löschen und neu anfangen'; }, 4000); }
    });
    e['set-sens'].value = S.sens; e['set-vol'].value = S.vol; e['set-music'].checked = S.music; e['set-gfx'].value = S.gfx;
    e['set-sens'].addEventListener('input', () => { S.sens = +e['set-sens'].value; PL.sens = S.sens; saveSettings(); });
    e['set-vol'].addEventListener('input', () => { S.vol = +e['set-vol'].value; A.setVolume(S.vol); saveSettings(); });
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
      const it = { id, name: u.name, desc: u.desc, level: lv, max: u.max, cost: u.costs[lv] };
      if (u.vals) { it.nowTxt = u.fmt(u.vals[lv]); if (lv < u.max) it.nextTxt = u.fmt(u.vals[lv + 1]); }
      if (u.needs && !G.up[u.needs]) { it.locked = true; it.lockTxt = 'Erst ' + UP[u.needs].name + ' kaufen'; }
      return it;
    });
    items.push({ id: 'buggy', name: 'Mondbuggy', desc: 'Vier Räder, großer Staubanhänger. Damit geht es über den Kraterrand hinaus.', teaser: 'Kommt bald', max: 1, level: 0 });
    items.push({ id: 'robot', name: 'Putzroboter', desc: 'Saugt ganz von allein rund um die Basis – der erste Schritt zur Automatisierung.', teaser: 'Kommt bald', max: 1, level: 0 });
    items.push({ id: 'rocket', name: 'Rakete nach Hause', desc: 'Der Grund, warum du das alles machst. Ein Ticket zurück zur Erde.', teaser: '1.000.000 ¢ · noch ein weiter Weg', max: 1, level: 0, goal: true });
    return items;
  }
  function renderShop() { UI.shopRender(shopItems(), G.money, buy); }
  function buy(id) {
    const u = UP[id], lv = G.up[id];
    if (!u || lv >= u.max) return;
    const cost = u.costs[lv];
    if (G.money < cost || (u.needs && !G.up[u.needs])) { A.play('deny'); return; }
    G.money -= cost; G.shown = G.money; G.up[id] = lv + 1;
    A.play('buy');
    if (id === 'repair') V.setRepaired(true);
    renderShop(); UI.money(G.money, true); save();
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

  // ---------- Benutzen (E) ----------
  let nearPoint = null;
  function findNear() {
    nearPoint = null; let best = 1e9;
    for (let i = 0; i < B.points.length; i++) {
      const p = B.points[i], d = Math.hypot(PL.pos.x - p.x, PL.pos.z - p.z);
      if (d < p.r && d < best && Math.abs(PL.pos.y - (p.y - 1.2)) < 3) { best = d; nearPoint = p; }
    }
  }
  function interact() {
    if (!nearPoint) return;
    if (nearPoint.id === 'shop') openShop();
    else if (nearPoint.id === 'silo') {
      if (selling) return;
      if (tankTotal() < 0.05) { A.play('deny'); UI.toast('Dein Tank ist leer. Erst Staub saugen!'); return; }
      selling = { n: G.tank.n, g: G.tank.g, t: 0, dur: 0.9 + Math.min(1.8, tankTotal() / 160), paid: 0, total: Math.round(tankWorth()) };
    }
  }
  function updateSelling(dt) {
    if (!selling) return;
    const s = selling; s.t += dt;
    const k = U.clamp(s.t / s.dur, 0, 1), rest = 1 - k;
    G.tank.n = s.n * rest; G.tank.g = s.g * rest;
    const paidNow = Math.round(s.total * k);
    if (paidNow > s.paid) { G.money += paidNow - s.paid; s.paid = paidNow; }
    coinT -= dt;
    if (coinT <= 0) { coinT = 0.07; A.play('coin', k * 6); }
    const n = Math.ceil(dt * 150);
    for (let i = 0; i < n; i++) V.stream(V.nozzleWorld, B.siloNozzle, Math.random() < s.g / (s.n + s.g + 1e-6));
    if (k >= 1) {
      G.tank.n = 0; G.tank.g = 0;
      G.stats.earned += s.total; G.stats.sold++;
      A.play('sold'); UI.toast('+ ' + UI.n0(s.total) + ' ¢', 'gold');
      UI.money(G.money, true);
      selling = null; fullBeep = false; save();
    }
  }

  // ---------- Ziele ----------
  const GOALS = [
    { txt: 'Halte die linke Maustaste gedrückt und sauge Staub vom Boden.', done: () => G.stats.kg >= 4 },
    { txt: 'Sauge weiter, bis dein Tank voll ist.', done: () => tankTotal() >= cap() - 0.01 || G.stats.sold > 0 },
    { txt: 'Bring den Staub zum Staublager an der Basis und drücke E am gelben Trichter.', done: () => G.stats.sold > 0 },
    { txt: 'Geh zur Werkstatt neben dem Wrack und repariere deinen Sauger (60 ¢).', done: () => G.up.repair > 0 },
    { txt: 'Verdiene Geld für Upgrades. Tipp: In den tiefen Kratern liegt wertvoller Glitzerstaub.', done: () => G.up.jet > 0 },
    { txt: 'Jetpack! Halte die Leertaste in der Luft gedrückt. Putze jetzt ganz Sektor 1 sauber.', done: () => G.stats.sectorDone },
    { txt: 'Sektor 1 ist blitzblank! Buggy, Putzroboter und neue Sektoren kommen bald.', done: () => false }
  ];
  function updateGoals() {
    while (G.stage < GOALS.length - 1 && GOALS[G.stage].done()) { G.stage++; if (state === 'play') A.play('click'); }
    UI.goal(GOALS[G.stage].txt);
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
  const vcfg = { radius: 0.55, rate: 2, reach: 3.6, repaired: false, room: 0, fill: 0, glitRatio: 0, sunlit: 1 };
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
    P.render(renderer, scene, camera, state === 'menu' ? null : V.scene, V.camera, time);
  }

  function update(dt) {
    time += dt;

    if (state === 'play') {
      G.stats.time += dt;
      pcfg.jet = G.up.jet > 0; pcfg.fuelTime = val('fuel');
      PL.update(dt, pcfg, evs);
      PL.applyCamera(camera); camera.updateMatrixWorld();
      A.setJet(PL.jetting ? 1 : 0);
      if (PL.jetting && Math.random() < dt * 40) V.spawn(PL.pos.x + (Math.random() - 0.5) * 0.3, PL.pos.y + 0.9, PL.pos.z + (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 1.5, -3 - Math.random() * 2, (Math.random() - 0.5) * 1.5, 0, 0.5, 0.07, 2.2, 1.4, 0.6, 0.05);

      sunlitT -= dt;
      if (sunlitT <= 0) {
        sunlitT = 0.12;
        // im Schlagschatten oder auf einem Hang, den die Sonne nur streift?
        const ndl = W.normalAt(PL.pos.x, PL.pos.z, tmpV).dot(W.SUN_DIR);
        vcfg._sun = Math.min(checkSun(), 0.1 + 0.9 * U.smoothstep(0.03, 0.28, ndl));
      }
      sunlit += ((vcfg._sun === undefined ? 1 : vcfg._sun) - sunlit) * Math.min(1, dt * 6);

      vcfg.radius = val('width'); vcfg.rate = (G.up.repair ? 4.2 : 2.6) * val('power'); vcfg.reach = 5.2 + G.up.power * 0.6;
      vcfg.repaired = G.up.repair > 0; vcfg.room = cap() - tankTotal(); vcfg.fill = tankTotal() / cap();
      vcfg.glitRatio = tankTotal() > 0 ? G.tank.g / tankTotal() : 0; vcfg.sunlit = sunlit;
      V.update(dt, time, camera, fire && !selling, vcfg, onSuck);
      updateSelling(dt);

      // voller Tank
      const full = tankTotal() >= cap() - 0.01;
      if (full && !fullBeep) { fullBeep = true; A.play('full'); }
      if (!full) fullBeep = false;
      UI.warn(full && fire ? 'Tank voll – zurück zum Staublager' : PL.atLimit ? 'Kraterrand zu steil – dafür brauchst du später ein Fahrzeug' : null);
      UI.cross(!V.target.hit ? 'no' : V.intensity > 0.2 ? 'on' : '');

      // Benutzen-Hinweis
      findNear();
      if (nearPoint && !selling) {
        if (nearPoint.id === 'shop') UI.prompt('<kbd>E</kbd>Werkstatt öffnen');
        else UI.prompt(tankTotal() >= 0.05 ? '<kbd>E</kbd>Tank ins Staublager leeren<em>+ ' + UI.n0(Math.round(tankWorth())) + ' ¢</em>' : 'Staublager – dein Tank ist noch leer');
      } else UI.prompt(null);

      // Sektor fertig?
      const pc = D.percentClean();
      if (!G.stats.sectorDone && pc >= 0.995) {
        G.stats.sectorDone = true; G.money += 2500; G.stats.earned += 2500;
        A.play('goal'); UI.toast('SEKTOR 1 IST BLITZBLANK!', 'big', 6); UI.toast('Sektor-Bonus: + 2.500 ¢', 'gold', 6); save();
      }
      W.terrainUniforms.uHint.value = (!G.stats.sectorDone && pc > 0.9) ? U.smoothstep(0.9, 0.95, pc) * 0.9 : 0;
      if (pc > 0.9 && !G.stats.sectorDone && !hintShown) { hintShown = true; UI.toast('Staub-Scanner an: Die letzten Reste leuchten orange.', '', 6); }

      // Wegweiser zur Basis
      const bd = Math.hypot(PL.pos.x - B.silo.x, PL.pos.z - B.silo.z);
      if (bd > 24) {
        tmpV.set(B.silo.x, W.heightAt(B.silo.x, B.silo.z) + 7.5, B.silo.z).project(camera);
        let sx = tmpV.x, sy = tmpV.y;
        if (tmpV.z > 1) { sx = -sx; sy = -1; }
        const m = Math.max(Math.abs(sx) / 0.92, Math.abs(sy) / 0.86, 1);
        sx /= m; sy /= m;
        UI.way(true, (sx * 0.5 + 0.5) * window.innerWidth, (-sy * 0.5 + 0.5) * window.innerHeight, bd);
      } else UI.way(false);

      if (keysT && time > keysT) { UI.el.keys.classList.add('fade'); keysT = 0; }
      saveT += dt; if (saveT > 20) { saveT = 0; save(); }
    } else {
      if (state === 'menu') {
        const a = time * 0.025 + 0.5, R = 27;
        camera.position.set(-3 + Math.sin(a) * R, 0, 2 + Math.cos(a) * R);
        camera.position.y = Math.max(W.heightAt(camera.position.x, camera.position.z) + 2.2, 5.5 + Math.sin(time * 0.05) * 1.2);
        tmpV2.set(-2, 3.4, 1.5); camera.lookAt(tmpV2); camera.updateMatrixWorld();
      }
      V.idle(dt);
      UI.prompt(null); UI.warn(null);
    }

    // Geld-Anzeige zählt hoch
    if (G.shown !== G.money) {
      const diff = G.money - G.shown;
      G.shown = Math.abs(diff) < 1 ? G.money : G.shown + diff * Math.min(1, dt * 10);
    }
    if (state !== 'menu') {
      UI.money(G.shown); UI.tank(G.tank.n, G.tank.g, cap(), tankWorth()); UI.sector(D.percentClean());
      UI.jet(G.up.jet > 0, PL.fuel); updateGoals();
    }

    // Helmlampe: hell im Schatten, fast aus in der Sonne
    lamp.intensity = lampOn && state !== 'menu' ? 0.1 + 2.6 * (1 - sunlit) : 0;
    B.update(time); W.update(time, camera, pxRatio); D.flush(); A.update(dt);
  }

  // Für Tests und zum Ausprobieren in der Konsole
  LC.debug = {
    get state() { return state; }, setState, save, newGame,
    tp: (x, z, yaw, pitch) => { PL.reset(x, z, yaw || 0); if (pitch != null) PL.pitch = pitch; },
    fire: v => { fire = v; }, money: v => { G.money += v; }, interact, buy,
    sim: (sec, fn) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { if (fn) fn(i / 60); update(1 / 60); } },
    PL, G, V, D,
    info: () => ({ state, pc: D.percentClean(), tank: tankTotal(), money: G.money, pos: PL.pos.toArray(), post: P.enabled, target: V.target })
  };

  window.addEventListener('load', () => setTimeout(init, 30));
})(window.LC);
