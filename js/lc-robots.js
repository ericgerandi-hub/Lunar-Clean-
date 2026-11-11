'use strict';
/* =========================================================
   Lunar Clean – Putzroboter: fahren von allein zum nächsten
   Staub, saugen, bringen die Ladung zur Abgabe und kommen wieder.
   Man kann sie einpacken (E) und woanders absetzen (R).
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World, D = LC.Dust, B = LC.Base, V = LC.Vacuum;
  const RB = { list: [], CAP: 300, R: 1.5, RATE: 3.2, MAX: 4 };
  let scene = null, shadowTex = null, mats = null, geos = null;

  function build() {
    if (!mats) {
      mats = {
        body: new THREE.MeshStandardMaterial({ color: 0xd8d5cd, roughness: 0.45, metalness: 0.35 }),
        dark: new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.7, metalness: 0.2 }),
        acc: new THREE.MeshStandardMaterial({ color: 0xd4601a, roughness: 0.5 }),
        glass: new THREE.MeshStandardMaterial({ color: 0x0c1418, roughness: 0.1, metalness: 0.9 })
      };
      geos = {
        body: new THREE.CylinderGeometry(0.62, 0.68, 0.3, 28), top: new THREE.CylinderGeometry(0.4, 0.6, 0.14, 28), band: new THREE.CylinderGeometry(0.69, 0.69, 0.07, 28),
        dome: new THREE.SphereGeometry(0.2, 18, 10, 0, 6.283, 0, 1.571), skirt: new THREE.BoxGeometry(1.5, 0.12, 0.34), wheel: new THREE.CylinderGeometry(0.17, 0.17, 0.12, 14),
        mast: new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), lamp: new THREE.SphereGeometry(0.05, 10, 8), eye: new THREE.BoxGeometry(0.34, 0.07, 0.03)
      };
      geos.wheel.rotateZ(Math.PI / 2);
      shadowTex = U.glowTexture(64, [[0, 'rgba(0,0,0,0.9)'], [0.55, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]);
    }
    const g = new THREE.Group(), car = new THREE.Group(); g.add(car);
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = true; car.add(m); return m; };
    add(geos.body, mats.body, 0, 0.36, 0); add(geos.band, mats.acc, 0, 0.36, 0); add(geos.top, mats.body, 0, 0.58, 0);
    add(geos.dome, mats.glass, 0, 0.64, 0.05);
    add(geos.skirt, mats.dark, 0, 0.14, -0.62);
    const wheels = [[-0.5, 0.36], [0.5, 0.36], [-0.5, -0.3], [0.5, -0.3]].map(p => add(geos.wheel, mats.dark, p[0], 0.17, p[1]));
    add(geos.mast, mats.dark, -0.28, 0.9, 0.3);
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 3, 0.9) });
    add(geos.lamp, lampMat, -0.28, 1.17, 0.3);
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.4, 3.2) });
    add(geos.eye, eyeMat, 0, 0.42, -0.66);
    const sg = new THREE.PlaneGeometry(2.3, 2.3); sg.rotateX(-Math.PI / 2);
    const shadow = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    shadow.position.y = 0.05; shadow.renderOrder = 2; g.add(shadow);
    scene.add(g);
    return { g, car, wheels, lampMat, eyeMat };
  }

  RB.init = function (sc) { scene = sc; };
  function make(o) {
    const r = Object.assign({ sec: 1, x: 0, z: 0, h: 0, n: 0, g: 0, packed: false, state: 'seek', tx: 0, tz: 0, has: false, scanT: Math.random(), wait: 0, gain: 0, tries: 0, ban: [], prog: 0, progT: 0, avoid: 0, avT: 0, y: 0, tilt: 0, nx: 0, nz: 0, nh: 0, sellT: 0 }, o);
    r.ax = r.x; r.az = r.z; r.m = build(); RB.list.push(r); return r;
  }
  RB.clear = function () { RB.list.forEach(r => scene.remove(r.m.g)); RB.list.length = 0; };
  RB.add = function () { return RB.list.length < RB.MAX ? make({ packed: true }) : null; };
  RB.packed = () => RB.list.filter(r => r.packed);
  RB.serialize = () => RB.list.map(r => [r.sec, +r.x.toFixed(1), +r.z.toFixed(1), +r.n.toFixed(1), +r.g.toFixed(1), r.packed ? 1 : 0]);
  RB.load = function (arr, count) {
    RB.clear();
    (Array.isArray(arr) ? arr : []).slice(0, Math.min(count, RB.MAX)).forEach(a => make({ sec: +a[0] === 2 ? 2 : 1, x: +a[1] || 0, z: +a[2] || 0, n: Math.max(0, +a[3] || 0), g: Math.max(0, +a[4] || 0), packed: !!a[5] }));
    while (RB.list.length < Math.min(count, RB.MAX)) make({ packed: true });
  };
  RB.nearest = function (x, z, maxD, sec) {
    let best = null, bd = maxD;
    RB.list.forEach(r => { if (r.packed || r.sec !== sec) return; const d = Math.hypot(r.x - x, r.z - z); if (d < bd) { bd = d; best = r; } });
    return best;
  };
  RB.pack = function (r) { r.packed = true; r.has = false; };
  RB.place = function (r, x, z, h, sec) { r.packed = false; r.sec = sec; r.x = x; r.z = z; r.h = h; r.ax = x; r.az = z; r.state = r.n + r.g >= RB.CAP * 0.98 ? 'home' : 'seek'; r.has = false; r.scanT = 0.3; r.ban = []; r.y = B.groundAt(x, z); };

  // Mehrspieler: Gastgeber verschickt, Gäste zeigen nur an
  RB.net = () => RB.list.map(r => [r.sec, +r.x.toFixed(2), +r.z.toFixed(2), +r.h.toFixed(2), r.packed ? 1 : 0, r.state === 'home' || r.state === 'unload' ? 1 : r.state === 'idle' ? 2 : 0]);
  RB.netApply = function (arr) {
    while (RB.list.length > arr.length) { scene.remove(RB.list.pop().m.g); }
    arr.forEach((a, i) => {
      let r = RB.list[i]; if (!r) { r = make({}); r.x = a[1]; r.z = a[2]; r.h = a[3]; }
      if (r.sec !== a[0] || r.packed !== !!a[4] || Math.hypot(r.x - a[1], r.z - a[2]) > 10) { r.x = a[1]; r.z = a[2]; r.h = a[3]; }
      r.sec = a[0]; r.nx = a[1]; r.nz = a[2]; r.nh = a[3]; r.packed = !!a[4]; r.state = a[5] === 1 ? 'home' : a[5] === 2 ? 'idle' : 'work';
    });
  };

  function pickTarget(r, sec) {
    const now = performance.now();
    r.ban = r.ban.filter(b => b.until > now);
    // nicht dorthin, wo schon ein anderer Roboter hinfährt, und nicht zu Stellen, die sich als unerreichbar erwiesen haben
    const avoid = r.ban.slice();
    RB.list.forEach(o => { if (o !== r && !o.packed && o.sec === sec && o.has && o.state === 'seek') avoid.push({ x: o.tx, z: o.tz, r: 4.5 }); });
    // dieselbe Stelle wie eben und nichts geschafft? Dann kommt er nicht hin (z. B. unter einem Felsen)
    if (r.has && r.gain < 0.004) { if (++r.tries >= 3) { r.ban.push({ x: r.tx, z: r.tz, r: 1.6, until: now + 180000 }); avoid.push(r.ban[r.ban.length - 1]); r.tries = 0; } } else r.tries = 0;
    // Staub nahe am Absetzpunkt zuerst: so wächst eine runde saubere Fläche statt dünner Schlangenlinien
    let t = D.nearest(r.x, r.z, avoid, r.ax, r.az, 0.6);
    if (!t && avoid.length > r.ban.length) t = D.nearest(r.x, r.z, r.ban, r.ax, r.az, 0.6);
    if (!t) { r.has = false; return false; }
    r.tx = t.x; r.tz = t.z; r.has = true; r.gain = 0; return true;
  }

  function drive(r, dt, tx, tz, speed) {
    const dx = tx - r.x, dz = tz - r.z, dist = Math.hypot(dx, dz);
    let want = Math.atan2(-dx, -dz);
    // hängt er fest? dann eine Weile seitlich ausweichen
    r.progT += dt;
    if (r.progT > 2.5) { if (r.prog - dist < 0.6 && dist > 2 && r.avT <= 0) { r.avoid = Math.random() < 0.5 ? 1 : -1; r.avT = 2.2; } r.prog = dist; r.progT = 0; }
    if (r.avT > 0) { r.avT -= dt; want += r.avoid * 1.25; }
    let dh = want - r.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    r.h += U.clamp(dh, -2.6 * dt, 2.6 * dt);
    const v = speed * U.clamp(1 - Math.abs(dh) / 1.6, 0.15, 1) * Math.min(1, dist / 0.8 + 0.25);
    r.x -= Math.sin(r.h) * v * dt; r.z -= Math.cos(r.h) * v * dt;
    const cs = B.colliders;
    for (let k = 0; k < cs.length; k++) {
      const c = cs[k], ex = r.x - c.x, ez = r.z - c.z, rr = c.r + 0.75, d2 = ex * ex + ez * ez;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); r.x = c.x + ex / d * rr; r.z = c.z + ez / d * rr; }
    }
    const rad = Math.hypot(r.x, r.z); if (rad > W.LIMIT - 2) { r.x *= (W.LIMIT - 2) / rad; r.z *= (W.LIMIT - 2) / rad; }
    r.spd = v;
    return dist;
  }

  // o: { sec, sim, hub: {x, z}, onSell(n, g), time }
  RB.update = function (dt, o) {
    for (let i = 0; i < RB.list.length; i++) {
      const r = RB.list[i], m = r.m, here = !r.packed && r.sec === o.sec;
      m.g.visible = here;
      if (!here) continue;
      r.spd = 0;
      if (!o.sim) {
        // Gast: weich zur gemeldeten Stelle
        const k = Math.min(1, dt * 6), ox = r.x, oz = r.z;
        r.x += (r.nx - r.x) * k; r.z += (r.nz - r.z) * k; let dh = r.nh - r.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); r.h += dh * k;
        r.spd = Math.hypot(r.x - ox, r.z - oz) / Math.max(dt, 1e-4);
      } else {
        const full = r.n + r.g >= RB.CAP - 0.5;
        if (full && r.state !== 'unload') r.state = 'home';
        if (r.state === 'home') {
          if (drive(r, dt, o.hub.x, o.hub.z, 4.6) < 2.6) { r.state = 'unload'; r.sellT = 1.8; }
        } else if (r.state === 'unload') {
          r.sellT -= dt;
          if (r.sellT <= 0) { if (r.n + r.g > 0.05) o.onSell(r.n, r.g); r.n = r.g = 0; r.state = 'seek'; r.has = false; r.scanT = 0; }
        } else {
          r.scanT -= dt;
          const dist = r.has ? Math.hypot(r.tx - r.x, r.tz - r.z) : 1e9;
          if (r.scanT <= 0 && (!r.has || dist < 0.7 || r.state === 'idle')) {
            r.scanT = r.state === 'idle' ? 4 : 0.5;
            if (pickTarget(r, o.sec)) r.state = 'seek';
            else if (r.n + r.g > 0.5) r.state = 'home';
            else r.state = 'idle';
          }
          if (r.state === 'seek' && r.has) drive(r, dt, r.tx, r.tz, r.work > 0 ? 1.5 : 4.2);
          else if (r.state === 'idle') { const hd = Math.hypot(o.hub.x - r.x, o.hub.z - r.z); if (hd > 9 + i * 2.2) drive(r, dt, o.hub.x, o.hub.z, 3.5); }
          // saugen (10-mal pro Sekunde reicht)
          r.wait -= dt; r.work = Math.max(0, (r.work || 0) - dt);
          if (r.wait <= 0 && r.state !== 'idle') {
            r.wait = 0.1;
            const fx = r.x - Math.sin(r.h) * 0.45, fz = r.z - Math.cos(r.h) * 0.45;
            const res = D.suck(fx, fz, RB.R, RB.RATE, 0.1, RB.CAP - r.n - r.g), got = res.n + res.g;
            r.n += res.n; r.g += res.g; r.gain += got;
            if (got > 0.004) { r.work = 0.4; if (Math.random() < 0.5) V.kickDust(fx, r.y + 0.1, fz, 2, 0.45); }
          }
        }
      }
      // aufs Gelände setzen
      const gy = B.groundAt(r.x, r.z), sh = Math.sin(r.h), ch = Math.cos(r.h);
      r.y = gy;
      const pitch = Math.atan2(B.groundAt(r.x - sh * 0.6, r.z - ch * 0.6) - B.groundAt(r.x + sh * 0.6, r.z + ch * 0.6), 1.2);
      r.tilt += (pitch - r.tilt) * Math.min(1, dt * 8);
      m.g.position.set(r.x, gy, r.z); m.g.rotation.y = r.h; m.car.rotation.x = r.tilt;
      m.car.position.y = r.state === 'unload' ? Math.abs(Math.sin(o.time * 14)) * 0.02 : 0;
      for (let w = 0; w < 4; w++) m.wheels[w].rotation.x -= r.spd * dt / 0.17;
      const blink = (o.time * 1.6 + i * 0.37) % 1 < 0.5 ? 1 : 0.25;
      if (r.state === 'home' || r.state === 'unload') m.lampMat.color.setRGB(3.2 * blink, 1.6 * blink, 0.2 * blink);
      else if (r.state === 'idle') m.lampMat.color.setRGB(0.5, 0.9, 1.6);
      else m.lampMat.color.setRGB(0.4 * blink, 3 * blink, 0.9 * blink);
    }
  };

  LC.Robots = RB;
})(window.LC);
