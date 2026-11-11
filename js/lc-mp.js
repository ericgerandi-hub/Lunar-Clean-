'use strict';
/* =========================================================
   Lunar Clean – Mehrspieler (2 bis 4 Spieler)
   Der Gastgeber rechnet die Welt: Staubkarte, Geld, Upgrades,
   Säcke, Buggy, Sektor. Gäste bewegen nur sich selbst und
   melden, was sie tun. Geld und Upgrades gehören allen.
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World, D = LC.Dust, B = LC.Base, PL = LC.Player, V = LC.Vacuum, SK = LC.Sacks, BG = LC.Buggy, AV = LC.Avatar, N = LC.Net, UI = LC.UI;
  const MP = { active: false, host: false, guest: false, ready: false, id: null, name: 'Astronaut', code: '', drv: null, players: {}, MAX_GUESTS: 3 };
  const COLORS = [0xd4601a, 0x2f8fe6, 0x46b85a, 0xb060e0], CSS = ['#ff9550', '#6cb8ff', '#7fe08f', '#d09cff'];
  const TOOL_IDS = ['spoon', 'shovel', 'vac', 'xl'];
  let ctx = null, scene = null, G = null, timer = null, tickN = 0, syncT = 0;
  let ops = [], applying = false, myOps = [];
  // Gast: eigene Änderungen an Geld und Buggy-Ladung, die der Gastgeber noch nicht bestätigt hat
  let seq = 0, pend = [], acc = { m: 0, ln: 0, lg: 0, kg: 0, sold: 0 }, prev = { m: 0, ln: 0, lg: 0, kg: 0, sold: 0 };
  let wantDrive = 0, snap = null, wel = null, lastAck = {}, ownedSeen = false, lastRx = 0;

  // ---------- Staub: jede Putz-Bewegung mitschreiben ----------
  const suck0 = D.suck;
  D.suck = function (x, z, radius, rate, dt, room) {
    const r = suck0(x, z, radius, rate, dt, room);
    if (MP.active && !applying && room > 0) {
      const a = +(rate * dt).toFixed(4);
      ops.push(+x.toFixed(2), +z.toFixed(2), +radius.toFixed(2), a);
      if (MP.guest) myOps.push(performance.now(), x, z, radius, a);
    }
    return r;
  };
  function applyOps(o, fx) {
    applying = true;
    for (let i = 0; i + 3 < o.length; i += 4) {
      suck0(o[i], o[i + 1], o[i + 2], o[i + 3], 1, 1e9);
      if (fx && Math.random() < 0.25) V.kickDust(o[i], W.heightAt(o[i], o[i + 1]), o[i + 1], 2, 0.5);
    }
    applying = false;
  }

  // ---------- Mitspieler als Figuren ----------
  function nameSprite(name, css) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 34px "Bahnschrift","Segoe UI",Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = Math.min(244, g.measureText(name).width + 34);
    g.fillStyle = 'rgba(4,12,18,.72)'; g.fillRect(128 - w / 2, 8, w, 48);
    g.fillStyle = css; g.fillRect(128 - w / 2, 52, w, 4);
    g.fillStyle = '#fff'; g.fillText(name, 128, 33, 230);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
    s.scale.set(1.5, 0.375, 1); s.position.y = 2.2; s.renderOrder = 5;
    return s;
  }
  let shadowTex = null;
  function addPlayer(id, name, ci) {
    if (MP.players[id]) removePlayer(id);
    const av = AV.build(COLORS[ci % 4]);
    // Werkzeug in der rechten Hand
    const mTool = new THREE.MeshStandardMaterial({ color: 0x70767c, roughness: 0.4, metalness: 0.7 });
    const tool = new THREE.Group(); tool.position.set(0, -0.36, 0);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.62, 8), mTool); tube.position.y = -0.3; tool.add(tube);
    const noz = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.1), new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.6 })); noz.position.y = -0.63; tool.add(noz);
    av.aR.fore.add(tool); av.tool = tool;
    const tag = nameSprite(name, CSS[ci % 4]); av.root.add(tag);
    if (!shadowTex) shadowTex = U.glowTexture(64, [[0, 'rgba(0,0,0,0.85)'], [0.5, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]);
    const sg = new THREE.PlaneGeometry(1.5, 1.5); sg.rotateX(-Math.PI / 2);
    const shadow = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    shadow.renderOrder = 2;
    av.root.visible = false; shadow.visible = false;
    scene.add(av.root); scene.add(shadow);
    MP.players[id] = { id, name, ci, css: CSS[ci % 4], av, tag, shadow, has: false, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, tx: 0, ty: 0, tz: 0, tyaw: 0, flags: 0, tool: 0, emote: -1, et: 0, phase: 0, spd: 0, b: null };
  }
  function removePlayer(id) {
    const p = MP.players[id]; if (!p) return;
    scene.remove(p.av.root); scene.remove(p.shadow);
    p.av.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    p.tag.material.map.dispose(); p.tag.material.dispose();
    delete MP.players[id];
  }
  MP.each = function (fn) { for (const k in MP.players) { const p = MP.players[k]; if (p.has) fn(p); } };
  MP.count = () => Object.keys(MP.players).length + 1;
  MP.nameOf = id => id === MP.id ? MP.name : MP.players[id] ? MP.players[id].name : 'Mitspieler';

  function setPState(id, s, b) {
    const p = MP.players[id]; if (!p || !s) return;
    p.tx = +s[0] || 0; p.ty = +s[1] || 0; p.tz = +s[2] || 0; p.tyaw = +s[3] || 0; p.pitch = +s[4] || 0; p.flags = s[5] | 0; p.tool = s[6] | 0;
    const em = s[7] == null ? -1 : s[7] | 0;
    if (em !== p.emote) { p.emote = em; p.et = +s[8] || 0; }
    if (!p.has || Math.hypot(p.tx - p.x, p.tz - p.z) > 15) { p.x = p.tx; p.y = p.ty; p.z = p.tz; p.yaw = p.tyaw; }
    p.has = true; p.b = b || null;
  }

  function updatePlayers(dt, time) {
    const k = Math.min(1, dt * 11);
    for (const id in MP.players) {
      const p = MP.players[id], av = p.av;
      if (!p.has) { av.root.visible = false; p.shadow.visible = false; continue; }
      const ox = p.x, oz = p.z;
      p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.z += (p.tz - p.z) * k;
      let dy = p.tyaw - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.yaw += dy * k;
      const v = Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, 1e-4);
      p.spd += (v - p.spd) * Math.min(1, dt * 8);
      av.root.visible = true; av.tool.visible = false;
      const driving = (p.flags & 8) && MP.drv === id && BG.here();
      if (driving) {
        // sitzt im Buggy
        const sh = Math.sin(BG.heading), ch = Math.cos(BG.heading);
        av.root.position.set(BG.pos.x + sh * 0.12, BG.pos.y + 0.78, BG.pos.z + ch * 0.12); av.root.rotation.y = BG.heading;
        AV.pose(av, 'sit', 1, 10); av.body.rotation.x = 0;
        av.aL.g.rotation.set(1.15, 0, 0.12); av.aR.g.rotation.set(1.15, 0, -0.12); av.aL.fore.rotation.x = 0.35; av.aR.fore.rotation.x = 0.35;
        p.x = BG.pos.x; p.z = BG.pos.z; p.shadow.visible = false;
        continue;
      }
      if ((p.flags & 16) && BG.here()) {
        // fährt mit: sitzt rechts und richtet den Bordsauger aus
        const sh = Math.sin(BG.heading), ch = Math.cos(BG.heading);
        av.root.position.set(BG.pos.x + ch * 0.62 + sh * 0.25, BG.pos.y + 0.78, BG.pos.z - sh * 0.62 + ch * 0.25); av.root.rotation.y = p.yaw;
        AV.pose(av, 'sit', 1, 10); av.body.rotation.x = 0; av.tool.visible = true;
        av.aR.g.rotation.set(1.0, 0, 0.1); av.aR.fore.rotation.set(0.3, 0, 0); av.head.rotation.x = U.clamp(p.pitch, -0.9, 0.9) * 0.7;
        p.x = BG.pos.x; p.z = BG.pos.z; p.shadow.visible = false;
        continue;
      }
      av.root.position.set(p.x, p.y, p.z); av.root.rotation.y = p.yaw;
      const gy = B.groundAt(p.x, p.z), air = p.y - gy;
      if (p.emote >= 0 && AV.EMOTES[p.emote]) {
        const e = AV.EMOTES[p.emote]; p.et = Math.min(e.dur, p.et + dt);
        AV.pose(av, e.id, p.et, e.dur);
      } else {
        p.phase += p.spd * dt * 2.3;
        if (air > 0.35) {
          // in der Luft: Beine leicht angezogen, Arme etwas ausgebreitet
          AV.rest(av); av.lL.g.rotation.x = 0.35; av.lR.g.rotation.x = 0.2; av.lL.shin.rotation.x = -0.6; av.lR.shin.rotation.x = -0.45;
          av.aL.g.rotation.z = -0.55; av.aR.g.rotation.z = 0.55;
          if ((p.flags & 2) && Math.random() < dt * 30) V.spawn(p.x + (Math.random() - 0.5) * 0.3, p.y + 0.9, p.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1.5, -3 - Math.random() * 2, (Math.random() - 0.5) * 1.5, 0, 0.5, 0.07, 2.2, 1.4, 0.6, 0.05);
        } else AV.walk(av, p.phase, U.clamp(p.spd / 3.2, 0, 1));
        if (p.flags & 4) { av.body.position.y -= 0.34; av.lL.g.rotation.x += 0.95; av.lR.g.rotation.x += 0.95; av.lL.shin.rotation.x -= 1.7; av.lR.shin.rotation.x -= 1.7; av.body.rotation.x = 0.18; }
        av.head.rotation.x = U.clamp(p.pitch, -0.9, 0.9) * 0.7;
        av.tool.visible = true;
        // Werkzeug: beim Putzen nach vorn unten gerichtet
        if (p.flags & 1) {
          const w = Math.sin(time * 9 + p.ci) * (p.tool < 2 ? 0.22 : 0.04);
          av.aR.g.rotation.set(0.75 + w, 0, 0.1); av.aR.fore.rotation.set(0.35 + w * 0.5, 0, 0);
        } else { av.aR.g.rotation.x += 0.25; av.aR.fore.rotation.x = 0.55; }
      }
      const s = U.clamp(1 - air / 9, 0.25, 1);
      p.shadow.visible = true; p.shadow.scale.set(s, 1, s); p.shadow.material.opacity = s * 0.9;
      p.shadow.position.set(p.x - W.SUN_DIR.x * (0.5 + air * 0.6), gy + 0.04, p.z - W.SUN_DIR.z * (0.5 + air * 0.6));
    }
  }

  // ---------- Verbindung ----------
  const send = d => { if (MP.host) N.toGuest(null, d); else N.toHost(d); };
  const eco = () => ({ money: G.money, up: G.up, stats: G.stats, stage: G.stage });
  const bgState = () => [+BG.pos.x.toFixed(2), +BG.pos.z.toFixed(2), +BG.heading.toFixed(3), +BG.load.n.toFixed(2), +BG.load.g.toFixed(2), BG.sec, MP.drv];
  const roster = () => [['H', MP.name, 0]].concat(Object.keys(MP.players).map(k => [k, MP.players[k].name, MP.players[k].ci]));
  function pushWorld(to) {
    if (!MP.host) return;
    const e = eco(), b = bgState();
    const r = LC.Robots.net();
    (to ? [to] : N.guests()).forEach(id => N.toGuest(id, { t: 'w', ack: lastAck[id] || 0, e, b, r }));
  }
  MP.pushWorld = pushWorld;
  MP.resync = () => { if (MP.host) sendSnap('sync'); };
  function sendSnap(kind, to) {
    const s = ctx.snapshot(), CH = 12000, n = Math.max(1, Math.ceil(s.dust.length / CH));
    N.toGuest(to || null, { t: 'snap', k: kind, sec: s.sec, sacks: kind === 'sync' ? null : s.sacks, n });
    for (let i = 0; i < n; i++) N.toGuest(to || null, { t: 'sn', i, s: s.dust.substr(i * CH, CH) });
  }
  function hud() {
    const el = document.getElementById('mp-hud'); if (!el) return;
    el.classList.toggle('hidden', !MP.active);
    if (!MP.active) return;
    el.innerHTML = '';
    const h = document.createElement('div'); h.className = 'c'; h.textContent = 'RAUM '; const b = document.createElement('b'); b.textContent = MP.code; h.appendChild(b); el.appendChild(h);
    const row = (name, css, me) => { const d = document.createElement('div'); const i = document.createElement('i'); i.style.background = css; d.appendChild(i); d.appendChild(document.createTextNode(name + (me ? ' (du)' : ''))); el.appendChild(d); };
    row(MP.name, CSS[MP.myColor || 0], true);
    for (const k in MP.players) row(MP.players[k].name, MP.players[k].css, false);
    if (ctx && ctx.onRoster) ctx.onRoster();
  }

  // ----- Gastgeber: Nachricht von einem Gast -----
  function hostMsg(id, m) {
    if (!m || typeof m !== 'object') return;
    const p = MP.players[id];
    if (p) p.rx = performance.now();
    if (m.t === 'hi') {
      if (p) return;
      if (m.v !== ctx.version) { N.toGuest(id, { t: 'no', why: 'version', v: ctx.version }); return; }
      if (Object.keys(MP.players).length >= MP.MAX_GUESTS) { N.toGuest(id, { t: 'no', why: 'full' }); return; }
      const used = {}; for (const k in MP.players) used[MP.players[k].ci] = 1;
      let ci = 1; while (used[ci]) ci++;
      const name = String(m.name || 'Astronaut').slice(0, 14);
      addPlayer(id, name, ci); lastAck[id] = 0;
      N.toGuest(id, { t: 'wel', id, ci, host: MP.name, e: eco(), b: bgState() });
      sendSnap('join', id);
      N.toGuest(null, { t: 'ros', l: roster() });
      pushWorld(id); hud();
      UI.toast(name + ' ist beigetreten', 'gold', 4); LC.Audio.play('goal');
      return;
    }
    if (!p) return;
    switch (m.t) {
      case 'p':
        setPState(id, m.s, m.b);
        N.toGuest(null, { t: 'p', id, s: m.s, b: m.b }, id);
        break;
      case 'o':
        if (!Array.isArray(m.o)) break;
        applyOps(m.o, true);
        N.toGuest(null, { t: 'o', c: m.c, o: m.o }, id);
        break;
      case 'd': {
        const dm = +m.m || 0;
        G.money = Math.max(0, G.money + dm); if (dm > 0) G.stats.earned += dm;
        G.stats.kg += Math.max(0, +m.kg || 0); G.stats.sold += Math.max(0, m.sold | 0);
        BG.load.n = U.clamp(BG.load.n + (+m.ln || 0), 0, BG.CAP); BG.load.g = U.clamp(BG.load.g + (+m.lg || 0), 0, BG.CAP - BG.load.n);
        lastAck[id] = m.q | 0; pushWorld();
        break;
      }
      case 'buy':
        if (ctx.buyFor(m.id)) { pushWorld(); N.toGuest(null, { t: 'ev', k: 'buy', id: m.id, by: id }); UI.toast(p.name + ' hat gekauft: ' + ctx.upName(m.id), 'gold', 4); }
        else pushWorld(id);
        break;
      case 'sk+': {
        if (!Array.isArray(m.p) || !Array.isArray(m.d)) break;
        const s = SK.throwSack({ x: +m.p[0], y: +m.p[1], z: +m.p[2] }, { x: +m.d[0], z: +m.d[1] }, Math.max(0, +m.n || 0), Math.max(0, +m.g || 0), ++SK.seq);
        N.toGuest(null, { t: 'sk+', id: s.id, p: m.p, d: m.d, n: s.n, g: s.g });
        break;
      }
      case 'sk-': {
        const s = SK.byId(m.id); if (!s || s.fly) break;
        SK.remove(s); ctx.shadow();
        N.toGuest(null, { t: 'sk-', id: s.id, to: id, bg: !!m.bg, n: s.n, g: s.g });
        break;
      }
      case 'bin': if (!MP.drv && BG.owned) { MP.drv = id; } pushWorld(); break;
      case 'bout':
        if (MP.drv === id) { MP.drv = null; if (Array.isArray(m.b) && BG.here()) BG.place(+m.b[0] || 0, +m.b[1] || 0, +m.b[2] || 0); BG.busy = false; ctx.shadow(); pushWorld(); }
        break;
    }
  }

  // ----- Gast: Nachricht vom Gastgeber -----
  function guestMsg(from, m) {
    if (!m || typeof m !== 'object') return;
    lastRx = performance.now();
    if (m.t === 'no') { const cb = MP.onFail; MP.leave(true); if (cb) cb(m.why); return; }
    if (m.t === 'wel') { MP.id = m.id; MP.myColor = m.ci; MP.hostName = m.host; wel = m; return; }
    if (m.t === 'snap') { snap = { k: m.k, sec: m.sec, sacks: m.sacks, n: m.n, parts: [] }; return; }
    if (m.t === 'sn') {
      if (!snap) return;
      snap.parts[m.i] = m.s;
      if (snap.parts.filter(x => x != null).length < snap.n) return;
      const s = snap; snap = null;
      if (s.k === 'join') {
        ctx.applySnap('join', s.sec, s.parts.join(''), s.sacks, wel.e);
        prev.m = G.money; prev.ln = BG.load.n; prev.lg = BG.load.g; prev.kg = G.stats.kg; prev.sold = G.stats.sold;
        MP.ready = true; applyWorld({ ack: 0, e: wel.e, b: wel.b });
        if (MP.onReady) MP.onReady();
      } else if (MP.ready) {
        ctx.applySnap(s.k, s.sec, s.parts.join(''), s.sacks);
        if (s.k === 'sync') {
          // eigene Putz-Bewegungen der letzten Sekunden noch einmal anwenden (waren evtl. unterwegs)
          const t0 = performance.now() - 2500, o = [];
          for (let i = 0; i < myOps.length; i += 5) if (myOps[i] > t0) o.push(myOps[i + 1], myOps[i + 2], myOps[i + 3], myOps[i + 4]);
          applyOps(o, false);
        } else { ops = []; myOps = []; }
      }
      return;
    }
    if (m.t === 'ros') {
      const seen = {};
      m.l.forEach(r => { if (r[0] === MP.id) return; seen[r[0]] = 1; if (!MP.players[r[0]]) { addPlayer(r[0], r[1], r[2]); if (MP.ready) UI.toast(r[1] + ' ist beigetreten', 'gold', 4); } });
      for (const k in MP.players) if (!seen[k]) { UI.toast(MP.players[k].name + ' hat das Spiel verlassen', '', 4); removePlayer(k); }
      hud(); return;
    }
    if (!MP.ready) return;
    switch (m.t) {
      case 'p': setPState(m.id, m.s, m.b); break;
      case 'o': if (Array.isArray(m.o)) applyOps(m.o, true); break;
      case 'w': applyWorld(m); break;
      case 'ev': ctx.event(m); break;
      case 'sk+': if (!SK.byId(m.id)) { SK.throwSack({ x: m.p[0], y: m.p[1], z: m.p[2] }, { x: m.d[0], z: m.d[1] }, m.n, m.g, m.id); } break;
      case 'sk-': {
        const s = SK.byId(m.id); if (s) { SK.remove(s); ctx.shadow(); }
        if (m.to === MP.id) ctx.gotSack(m.n, m.g, m.bg);
        break;
      }
    }
  }
  function applyWorld(m) {
    while (pend.length && pend[0].q <= m.ack) pend.shift();
    let pm = acc.m, pn = acc.ln, pg = acc.lg;
    pend.forEach(d => { pm += d.m; pn += d.ln; pg += d.lg; });
    G.money = Math.max(0, m.e.money + pm); prev.m = G.money;
    ctx.applyEco(m.e);
    if (Array.isArray(m.r)) LC.Robots.netApply(m.r);
    const b = m.b; MP.drv = b[6] || null;
    const secCh = BG.sec !== b[5]; BG.sec = b[5];
    BG.load.n = Math.max(0, b[3] + pn); BG.load.g = Math.max(0, b[4] + pg); prev.ln = BG.load.n; prev.lg = BG.load.g;
    if (BG.owned) {
      const mine = MP.drv === MP.id;
      if (wantDrive && mine && !BG.driving) { ctx.enterBuggy(); }
      else if (wantDrive && MP.drv && !mine) { wantDrive = 0; UI.toast('Der Buggy ist gerade besetzt (' + MP.nameOf(MP.drv) + ').', '', 3); }
      else if (BG.driving && !mine && !wantDrive) ctx.exitBuggy(true);
      if (!MP.drv && !BG.driving && !wantDrive && (secCh || !ownedSeen || Math.hypot(BG.pos.x - b[0], BG.pos.z - b[1]) > 0.05 || Math.abs(BG.heading - b[2]) > 0.01)) { BG.place(b[0], b[1], b[2]); ctx.shadow(); }
      else if (secCh) BG.refresh();
      ownedSeen = true;
    }
  }

  // ---------- Schnittstelle für lc-main ----------
  MP.init = function (c, sc) {
    ctx = c; scene = sc; G = LC.G;
    N.handlers({
      msg: (from, m) => { try { if (MP.host) hostMsg(from, m); else if (MP.guest) guestMsg(from, m); } catch (e) { if (window.console) console.warn('Mehrspieler:', e); } },
      join: () => {},
      leave: dropGuest,
      lost: lost
    });
  };
  function dropGuest(id) {
    const p = MP.players[id]; if (!p) return;
    UI.toast(p.name + ' hat das Spiel verlassen', '', 4);
    if (MP.drv === id) { MP.drv = null; BG.busy = false; }
    removePlayer(id); delete lastAck[id];
    N.toGuest(null, { t: 'ros', l: roster() }); pushWorld(); hud();
  }
  function lost() {
    if (!MP.guest || !MP.active) return;
    const cb = MP.onLost; MP.leave(); if (cb) cb();
  }
  function start(role, code, name) {
    MP.active = true; MP.host = role === 'host'; MP.guest = !MP.host; MP.code = code; MP.name = name; MP.ready = MP.host;
    MP.id = MP.host ? 'H' : null; MP.myColor = 0; MP.drv = BG.driving ? 'H' : null;
    lastRx = 0; ops = []; myOps = []; pend = []; seq = 0; acc = { m: 0, ln: 0, lg: 0, kg: 0, sold: 0 }; wantDrive = 0; syncT = 0; ownedSeen = false;
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 80);
    hud();
  }
  MP.open = function (name) {
    const tryOpen = n => {
      const code = N.makeCode();
      return N.host(code).then(() => { start('host', code, name); return code; }, e => { N.close(); if (e.code === 'taken' && n > 0) return tryOpen(n - 1); throw e; });
    };
    return tryOpen(3);
  };
  MP.openAs = function (name, code) { return N.host(code).then(() => { start('host', code, name); return code; }); };
  MP.join = function (code, name) {
    return N.join(code).then(() => { start('guest', code, name); N.toHost({ t: 'hi', name, v: ctx.version }); });
  };
  MP.leave = function (quiet) {
    if (timer) { clearInterval(timer); timer = null; }
    N.close();
    Object.keys(MP.players).forEach(removePlayer);
    MP.active = MP.host = MP.guest = MP.ready = false; MP.drv = null; BG.busy = false; MP.code = '';
    hud();
  };

  // Buggy: darf ich einsteigen? (Gast: fragt an, Antwort kommt gleich)
  MP.tryDrive = function () {
    if (!MP.active) return true;
    if (MP.drv && MP.drv !== MP.id) { UI.toast('Der Buggy ist gerade besetzt (' + MP.nameOf(MP.drv) + ').', '', 3); return false; }
    if (MP.host) { MP.drv = 'H'; pushWorld(); return true; }
    wantDrive = performance.now(); N.toHost({ t: 'bin' }); return false;
  };
  MP.entered = function () { /* Gast sitzt jetzt am Steuer */ };
  MP.leftBuggy = function () {
    if (!MP.active) return;
    wantDrive = 0;
    if (MP.host) { if (MP.drv === 'H') MP.drv = null; pushWorld(); }
    else N.toHost({ t: 'bout', b: [BG.pos.x, BG.pos.z, BG.heading] });
  };
  MP.gdrv = null;
  MP.tryFly = function () { return true; };
  MP.leftGlider = function () {};
  // Säcke
  MP.sackThrow = function (from, dir, n, g) { N.toHost({ t: 'sk+', p: [+from.x.toFixed(2), +from.y.toFixed(2), +from.z.toFixed(2)], d: [dir.x, dir.z], n, g }); };
  MP.sackAdded = function (s, from, dir) { if (MP.host) N.toGuest(null, { t: 'sk+', id: s.id, p: [from.x, from.y, from.z], d: [dir.x, dir.z], n: s.n, g: s.g }); };
  MP.sackTake = function (s, bg) { const t = performance.now(); if (s.req && t - s.req < 1200) return; s.req = t; N.toHost({ t: 'sk-', id: s.id, bg: !!bg }); };
  MP.sackTaken = function (s) { if (MP.host) N.toGuest(null, { t: 'sk-', id: s.id, to: 'H', n: s.n, g: s.g }); };
  MP.buy = function (id) { N.toHost({ t: 'buy', id }); };
  MP.event = function (m) { if (MP.host) { m.t = 'ev'; N.toGuest(null, m); } };
  // Gastgeber ist durch den Tunnel gefahren: alle kommen mit
  MP.traveled = function () {
    if (!MP.host) return;
    if (MP.drv && MP.drv !== 'H') { MP.drv = null; BG.busy = false; }
    sendSnap('travel'); pushWorld();
  };

  // ---------- Takt (unabhängig vom Bild, damit es auch im Hintergrund weiterläuft) ----------
  function tick() {
    if (!MP.active || !N.open || !MP.ready) return;
    tickN++;
    const st = ctx.pstate(), m = { t: 'p', s: st };
    if (BG.driving && MP.drv === MP.id) m.b = [+BG.pos.x.toFixed(2), +BG.pos.z.toFixed(2), +BG.heading.toFixed(3), +BG.speed.toFixed(2), +BG.suck.toFixed(2)];
    if (MP.host) { m.id = 'H'; N.toGuest(null, m); } else N.toHost(m);
    if (ops.length) { send({ t: 'o', c: W.sec, o: ops }); ops = []; }
    if (MP.guest && myOps.length > 1500) myOps.splice(0, myOps.length - 1000);
    if (tickN % 3) return;
    const now = performance.now();
    if (MP.host) {
      // Gast seit 25 s stumm (Tab zu, Internet weg)? Dann ist er raus
      for (const k in MP.players) if (MP.players[k].rx && now - MP.players[k].rx > 25000) dropGuest(k);
      pushWorld();
      syncT += 0.24; if (syncT > 50 && N.guests().length) { syncT = 0; sendSnap('sync'); }
    } else {
      if (lastRx && now - lastRx > 15000) { lost(); return; }
      if (wantDrive && performance.now() - wantDrive > 2500 && !BG.driving) wantDrive = 0;
      if (Math.abs(acc.m) > 0.5 || Math.abs(acc.ln) + Math.abs(acc.lg) > 0.005 || acc.kg > 0.5 || acc.sold) {
        const d = { t: 'd', q: ++seq, m: Math.round(acc.m), ln: +acc.ln.toFixed(3), lg: +acc.lg.toFixed(3), kg: +acc.kg.toFixed(2), sold: acc.sold };
        pend.push({ q: d.q, m: d.m, ln: d.ln, lg: d.lg });
        acc.m -= d.m; acc.ln -= d.ln; acc.lg -= d.lg; acc.kg = 0; acc.sold = 0;
        N.toHost(d);
      }
    }
  }

  // jedes Bild: Figuren bewegen, eigene Änderungen sammeln
  MP.update = function (dt, time) {
    if (!MP.active) return;
    if (MP.guest && MP.ready) {
      acc.m += G.money - prev.m; prev.m = G.money;
      acc.ln += BG.load.n - prev.ln; prev.ln = BG.load.n; acc.lg += BG.load.g - prev.lg; prev.lg = BG.load.g;
      acc.kg += Math.max(0, G.stats.kg - prev.kg); prev.kg = G.stats.kg; acc.sold += Math.max(0, G.stats.sold - prev.sold); prev.sold = G.stats.sold;
    }
    const d = MP.drv, rp = d && d !== MP.id ? MP.players[d] : null;
    if (rp && rp.b && BG.here() && !BG.driving) { BG.busy = true; BG.remote(dt, rp.b[0], rp.b[1], rp.b[2], rp.b[3], rp.b[4]); }
    else if (BG.busy) { BG.busy = false; BG.speed = 0; BG.suck = 0; }
    updatePlayers(dt, time);
  };
  MP.TOOL_IDS = TOOL_IDS;

  LC.MP = MP;
})(window.LC);
