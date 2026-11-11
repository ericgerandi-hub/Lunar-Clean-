'use strict';
/* =========================================================
   Lunar Clean – Mondbuggy: fahren, vorn saugen, großer
   Laderaum, Schlauch für den Handsauger, Entladestation
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World, B = LC.Base, D = LC.Dust;
  const BG = { owned: false, driving: false, heading: 0, speed: 0, CAP: 1500, lookYaw: 0, lookPitch: -0.08, suck: 0 };
  BG.pos = new THREE.Vector3();
  BG.load = { n: 0, g: 0 };
  // Entladestationen je Sektor; BG.station ist die im aktiven Sektor
  BG.stations = { 1: { x: 20, z: 11.5, r: 3.2, rot: 0.5 }, 2: { x: -18, z: 96, r: 3.2, rot: -0.35 } };
  BG.station = BG.stations[1];
  BG.sec = 1;                  // in welchem Sektor der Buggy steht
  BG.headR = 2.2;              // Radius der Saugfläche
  BG.park = { x: 14.5, z: 17, heading: 2.5 };
  BG.HOSE_RANGE = 16;
  const HEAD_DIST = 2.35, RADIUS = 1.5;
  let scene, car, wheels = [], fill, shadow, headL, hose, hoseMat, pitch = 0, roll = 0;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), q1 = new THREE.Quaternion(), e1 = new THREE.Euler(0, 0, 0, 'YXZ');
  BG.headWorld = new THREE.Vector3(); BG.hopperWorld = new THREE.Vector3();

  const total = () => BG.load.n + BG.load.g;
  BG.total = total;
  BG.room = () => BG.CAP - total();

  function build() {
    const mk = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const mDark = mk(0x1c1e22, 0.55, 0.55), mSteel = mk(0x80868c, 0.36, 0.8), mWhite = mk(0x8f8c85, 0.72, 0.15), mOrange = mk(0xb8500f, 0.5, 0.25),
      mYellow = mk(0x8a6608, 0.6, 0.25), mRubber = mk(0x0d0d0e, 0.92, 0), mSeat = mk(0x2a2d33, 0.8, 0.1);
    car = new THREE.Group(); car.rotation.order = 'YXZ';
    const add = (geo, mat, x, y, z, rx, ry, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0); car.add(m); return m; };
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const tube = (len, r) => new THREE.CylinderGeometry(r || 0.04, r || 0.04, len, 8);
    // Fahrgestell
    add(box(1.6, 0.26, 3.1), mDark, 0, 0.78, 0);
    add(box(1.5, 0.24, 1.05), mWhite, 0, 0.95, -1.15);                 // Haube
    add(box(1.52, 0.05, 0.2), mOrange, 0, 1.075, -1.0);
    add(box(1.9, 0.16, 0.22), mOrange, 0, 0.72, -1.66);               // Stoßstange
    // Räder
    [[-1.05, -1.05], [1.05, -1.05], [-1.05, 1.1], [1.05, 1.1]].forEach(p => {
      const w = new THREE.Group(); w.position.set(p[0], 0.54, p[1]);
      const tg = new THREE.CylinderGeometry(0.54, 0.54, 0.44, 20); tg.rotateZ(Math.PI / 2);
      w.add(new THREE.Mesh(tg, mRubber));
      const hg = new THREE.CylinderGeometry(0.26, 0.26, 0.46, 10); hg.rotateZ(Math.PI / 2);
      w.add(new THREE.Mesh(hg, mSteel));
      for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283, t = new THREE.Mesh(box(0.46, 0.07, 0.1), mRubber); t.position.set(0, Math.cos(a) * 0.55, Math.sin(a) * 0.55); t.rotation.x = a; w.add(t); }
      car.add(w); wheels.push(w);
      add(box(0.5, 0.05, 1.2), mWhite, p[0], 1.14, p[1]);            // Schutzblech
      add(box(0.12, 0.3, 0.12), mDark, p[0] * 0.78, 0.7, p[1]);
    });
    // Sitz, Lenkrad, Armaturen
    add(box(0.62, 0.14, 0.6), mSeat, 0, 1.02, 0.1);
    add(box(0.62, 0.7, 0.14), mSeat, 0, 1.36, 0.42, -0.12);
    add(box(1.3, 0.34, 0.22), mDark, 0, 1.22, -0.66);
    add(new THREE.TorusGeometry(0.19, 0.022, 8, 20), mRubber, 0, 1.42, -0.48, -0.5);
    add(tube(0.3, 0.02), mSteel, 0, 1.36, -0.56, 1.05);
    add(box(0.2, 0.09, 0.02), new THREE.MeshStandardMaterial({ color: 0, emissive: 0x4fe3ff, emissiveIntensity: 0.7 }), -0.4, 1.34, -0.545, -0.25);
    // Überrollkäfig
    [[-0.78, -0.62], [0.78, -0.62], [-0.78, 0.7], [0.78, 0.7]].forEach(p => add(tube(1.75), mSteel, p[0], 1.76, p[1]));
    add(tube(1.56), mSteel, 0, 2.62, -0.62, 0, 0, Math.PI / 2); add(tube(1.56), mSteel, 0, 2.62, 0.7, 0, 0, Math.PI / 2);
    add(tube(1.32), mSteel, -0.78, 2.62, 0.04, Math.PI / 2); add(tube(1.32), mSteel, 0.78, 2.62, 0.04, Math.PI / 2);
    // Laderaum hinten
    add(box(1.7, 0.08, 1.3), mYellow, 0, 0.95, 1.3);
    add(box(0.08, 0.95, 1.3), mYellow, -0.85, 1.42, 1.3); add(box(0.08, 0.95, 1.3), mYellow, 0.85, 1.42, 1.3);
    add(box(1.7, 0.95, 0.08), mYellow, 0, 1.42, 0.66); add(box(1.7, 0.95, 0.08), mYellow, 0, 1.42, 1.94);
    add(box(1.78, 0.07, 0.07), mDark, 0, 1.9, 1.94); add(box(1.78, 0.07, 0.07), mDark, 0, 1.9, 0.66);
    const fg = box(1.62, 0.86, 1.2); fg.translate(0, 0.43, 0);
    fill = add(fg, new THREE.MeshStandardMaterial({ color: 0x2a231d, roughness: 1 }), 0, 0.99, 1.3); fill.scale.y = 0.001;
    // Saugkopf vorn mit Schläuchen
    add(box(2.7, 0.2, 0.55), mDark, 0, 0.22, -HEAD_DIST);
    add(box(2.8, 0.05, 0.62), mRubber, 0, 0.1, -HEAD_DIST);
    add(box(2.72, 0.06, 0.1), mOrange, 0, 0.34, -HEAD_DIST + 0.2);
    [-0.7, 0.7].forEach(x => {
      add(box(0.09, 0.09, 0.9), mSteel, x, 0.45, -1.95, 0.5);
      const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0.3, -HEAD_DIST + 0.1), new THREE.Vector3(x * 1.25, 0.75, -1.5), new THREE.Vector3(x * 1.45, 1.05, 0), new THREE.Vector3(x * 1.2, 1.5, 0.9), new THREE.Vector3(x * 0.9, 1.75, 1.2)]);
      add(new THREE.TubeGeometry(c, 20, 0.085, 8), mRubber, 0, 0, 0);
    });
    // Scheinwerfer + Rundumlicht
    const mLamp = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xfff2d0, emissiveIntensity: 2.5 });
    [-0.55, 0.55].forEach(x => add(new THREE.SphereGeometry(0.1, 12, 8), mLamp, x, 1.02, -1.69).scale.z = 0.5);
    headL = new THREE.SpotLight(0xfff0d8, 0, 34, 0.7, 0.7, 1.2); headL.position.set(0, 1.3, -1.6); headL.target.position.set(0, 0.2, -9);
    car.add(headL); car.add(headL.target);
    BG.beaconMat = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffa020, emissiveIntensity: 2 });
    add(new THREE.SphereGeometry(0.07, 10, 8), BG.beaconMat, 0.78, 2.72, 0.7);
    car.traverse(o => { if (o.isMesh) { o.receiveShadow = true; } });
    car.visible = false;
    scene.add(car);

    // weicher Schatten unter dem Buggy (die Schattenkarte der Sonne steht still)
    const sg = new THREE.PlaneGeometry(4.6, 6.2); sg.rotateX(-Math.PI / 2);
    shadow = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({
      map: U.glowTexture(128, [[0, 'rgba(0,0,0,0.9)'], [0.55, 'rgba(0,0,0,0.75)'], [1, 'rgba(0,0,0,0)']]),
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    }));
    shadow.visible = false; shadow.renderOrder = 2; scene.add(shadow);

    hoseMat = mRubber;
    hose = new THREE.Mesh(new THREE.BufferGeometry(), hoseMat); hose.visible = false; hose.frustumCulled = false; scene.add(hose);
  }

  // parent = Gruppe des Sektors; pipeTo = {x, z} oder null
  BG.buildStation = function (parent, st, pipeTo, title) {
    const y = W.heightAt(st.x, st.z);
    const g = new THREE.Group(); g.position.set(st.x, y, st.z); g.rotation.y = st.rot;
    let stationGrate;
    const c = document.createElement('canvas'); c.width = 256; c.height = 384;
    const x = c.getContext('2d');
    x.fillStyle = '#24262a'; x.fillRect(0, 0, 256, 384);
    x.save(); x.beginPath(); x.rect(0, 0, 256, 384); x.rect(22, 22, 212, 340); x.clip('evenodd');
    for (let i = -400; i < 700; i += 44) { x.fillStyle = '#e0aa22'; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 22, 0); x.lineTo(i + 22 - 384, 384); x.lineTo(i - 384, 384); x.fill(); }
    x.restore();
    x.strokeStyle = '#8a8f96'; x.lineWidth = 2;
    for (let i = 60; i < 330; i += 14) { x.beginPath(); x.moveTo(70, i); x.lineTo(186, i); x.stroke(); }
    x.strokeStyle = '#e0aa22'; x.lineWidth = 5; x.strokeRect(62, 52, 132, 284);
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
    const mDark = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.6, metalness: 0.5 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.2, 8.0), [mDark, mDark, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.3 }), mDark, mDark, mDark]);
    slab.position.y = -0.5; slab.receiveShadow = true; slab.castShadow = true; g.add(slab);
    stationGrate = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5.6), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    stationGrate.rotation.x = -Math.PI / 2; stationGrate.position.y = 0.115; g.add(stationGrate);
    st.grate = stationGrate;
    const mSteel = new THREE.MeshStandardMaterial({ color: 0x80868c, roughness: 0.36, metalness: 0.8 });
    [[-2.9, -4.2], [2.9, -4.2], [-2.9, 4.2], [2.9, 4.2]].forEach((p, i) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.3, 8), mSteel); post.position.set(p[0], 0.65, p[1]); post.castShadow = true; g.add(post);
      const mat = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffa020, emissiveIntensity: 3 });
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat); l.position.set(p[0], 1.36, p[1]); g.add(l);
      B.blinkers.push({ mat, light: null, period: 1.8, phase: i * 0.25, base: 0 });
    });
    // Schild
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 8), mSteel); sp.position.set(-3.4, 1.3, 0); sp.castShadow = true; g.add(sp);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), new THREE.MeshStandardMaterial({
      color: 0, emissive: 0xffffff, emissiveIntensity: 1.0, side: THREE.DoubleSide,
      emissiveMap: U.textTexture([
        { text: title || 'FAHRZEUG-ENTLADUNG', size: 44, color: '#ffc45a', y: 74 },
        { text: 'Drauffahren und E drücken', size: 30, color: '#e8dcc4', y: 140, bold: false }
      ], { w: 560, h: 216, bg: '#140d04', border: '#ffb040' })
    }));
    sign.material.side = THREE.FrontSide;
    sign.position.set(-3.38, 2.75, 0); sign.rotation.y = Math.PI / 2; g.add(sign);
    const sign2 = sign.clone(); sign2.position.x = -3.42; sign2.rotation.y = -Math.PI / 2; g.add(sign2);
    // Rohr zum Staublager
    if (pipeTo) {
      const a = new THREE.Vector3(st.x - 2.2, 0, st.z - 2.8), b = new THREE.Vector3(pipeTo.x, 0, pipeTo.z);
      const pts = []; for (let i = 0; i <= 6; i++) { const p = a.clone().lerp(b, i / 6); p.y = W.heightAt(p.x, p.z) + 0.16; pts.push(p); }
      const pipe = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.16, 8), mSteel); pipe.castShadow = true; parent.add(pipe);
    }
    parent.add(g);
    B.colliders.push({ x: st.x - 3.4 * Math.cos(st.rot), z: st.z + 3.4 * Math.sin(st.rot), r: 0.3, h: 3 });
  };

  BG.init = function (sc) { scene = sc; build(); BG.buildStation(B.root1, BG.stations[1], { x: B.silo.x + 1.2, z: B.silo.z + 0.6 }); };
  // sichtbar nur, wenn man im selben Sektor ist
  BG.refresh = function () { const v = BG.owned && BG.sec === W.sec; car.visible = shadow.visible = v; if (!v) hose.visible = false; BG.station = BG.stations[W.sec]; };
  BG.here = () => BG.owned && BG.sec === W.sec;

  function settle(dt, snap) {
    const sh = Math.sin(BG.heading), ch = Math.cos(BG.heading);
    const fx = -sh, fz = -ch, rx = ch, rz = -sh, p = BG.pos;
    const hf = B.groundAt(p.x + fx * 1.1, p.z + fz * 1.1), hb = B.groundAt(p.x - fx * 1.1, p.z - fz * 1.1);
    const hl = B.groundAt(p.x - rx * 1.05, p.z - rz * 1.05), hr = B.groundAt(p.x + rx * 1.05, p.z + rz * 1.05);
    const ty = (hf + hb + hl + hr) / 4, tp = Math.atan2(hf - hb, 2.2), tr = Math.atan2(hr - hl, 2.1);
    const k = snap ? 1 : Math.min(1, dt * 9);
    p.y += (ty - p.y) * (snap ? 1 : Math.min(1, dt * 14)); pitch += (tp - pitch) * k; roll += (tr - roll) * k;
    car.position.copy(p); car.rotation.set(pitch, BG.heading, roll);
    car.updateMatrixWorld();
    shadow.position.set(p.x - W.SUN_DIR.x * 0.9, p.y + 0.05, p.z - W.SUN_DIR.z * 0.9); shadow.rotation.set(pitch, BG.heading, roll, 'YXZ');
    BG.headWorld.set(0, 0.25, -HEAD_DIST).applyMatrix4(car.matrixWorld);
    BG.hopperWorld.set(0, 1.9, 1.3).applyMatrix4(car.matrixWorld);
  }

  BG.place = function (x, z, heading) {
    BG.pos.set(x, B.groundAt(x, z), z); BG.heading = heading; BG.speed = 0; pitch = roll = 0;
    BG.refresh();
    if (BG.owned) settle(0, true);
  };
  BG.setOwned = function (on) { BG.owned = on; if (!on) { BG.driving = false; BG.sec = 1; } BG.refresh(); };

  // inp: {f, s, fire, mdx, mdy, sens}; cb: {onSuck(n, g), spawnStream(from, to, glit)}
  BG.drive = function (dt, inp, cb) {
    BG.lookYaw = U.clamp(BG.lookYaw - inp.mdx * 0.0022 * inp.sens, -2.5, 2.5);
    BG.lookPitch = U.clamp(BG.lookPitch - inp.mdy * 0.0022 * inp.sens, -1.1, 1.2);
    // Gas, Bremse, Lenkung
    if (inp.f > 0) BG.speed += (BG.speed < 0 ? 14 : 6.5) * dt;
    else if (inp.f < 0) BG.speed -= (BG.speed > 0 ? 14 : 4.5) * dt;
    else BG.speed -= BG.speed * Math.min(1, dt * 1.6);
    BG.speed = U.clamp(BG.speed, -4, 10.5);
    const grip = U.clamp(BG.speed / 3.5, -1, 1);
    BG.heading -= inp.s * 1.55 * grip * dt;
    const sh = Math.sin(BG.heading), ch = Math.cos(BG.heading), p = BG.pos;
    p.x += -sh * BG.speed * dt; p.z += -ch * BG.speed * dt;
    // Hindernisse
    for (let i = 0; i < B.colliders.length; i++) {
      const c = B.colliders[i], dx = p.x - c.x, dz = p.z - c.z, rr = c.r + RADIUS, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); p.x = c.x + dx / d * rr; p.z = c.z + dz / d * rr; BG.speed *= Math.max(0, 1 - dt * 6); }
    }
    const r = Math.hypot(p.x, p.z); BG.atLimit = false;
    if (r > W.LIMIT - 1.5) { p.x *= (W.LIMIT - 1.5) / r; p.z *= (W.LIMIT - 1.5) / r; BG.speed *= Math.max(0, 1 - dt * 5); BG.atLimit = true; }
    settle(dt, false);
    for (let i = 0; i < 4; i++) wheels[i].rotation.x -= BG.speed * dt / 0.54;
    // Saugkopf
    BG.suck += ((inp.fire && BG.room() > 0.01 ? 1 : 0) - BG.suck) * Math.min(1, dt * 6);
    if (BG.suck > 0.1 && BG.room() > 0.01) {
      const res = D.suck(BG.headWorld.x, BG.headWorld.z, BG.headR, 5.5 * BG.suck, dt, BG.room());
      const got = res.n + res.g;
      if (got > 0) {
        cb.onSuck(res.n, res.g);
        const n = Math.min(10, Math.ceil(got * 8));
        for (let i = 0; i < n; i++) {
          const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * BG.headR;
          tmp.set(BG.headWorld.x + Math.cos(a) * rr, 0, BG.headWorld.z + Math.sin(a) * rr); tmp.y = W.heightAt(tmp.x, tmp.z) + 0.05;
          cb.spawnStream(tmp, BG.headWorld, Math.random() < res.g / got);
        }
      }
    }
  };

  BG.applyCamera = function (cam) {
    tmp.set(0, 2.02, -0.02).applyMatrix4(car.matrixWorld); cam.position.copy(tmp);
    e1.set(BG.lookPitch, BG.lookYaw, 0); q1.setFromEuler(e1);
    cam.quaternion.copy(car.quaternion).multiply(q1);
  };

  // Füllstand, Licht, Schlauch. hoseFrom = Punkt beim Spieler oder null
  BG.update = function (dt, t, dark, hoseFrom) {
    if (!BG.owned) return;
    fill.scale.y = Math.max(0.001, total() / BG.CAP); fill.visible = total() > 1;
    const gr = total() > 0 ? BG.load.g / total() : 0;
    fill.material.color.setRGB(0.10, U.lerp(0.085, 0.2, gr), U.lerp(0.07, 0.4, gr));
    headL.intensity = BG.driving ? 0.5 + 2.2 * dark : 0;
    BG.beaconMat.emissiveIntensity = BG.driving ? ((t * 1.4) % 1 < 0.5 ? 3 : 0.2) : 0.2;
    const gr8 = BG.station.grate;
    if (gr8) gr8.material.opacity += ((BG.unloading ? 0.5 + 0.3 * Math.sin(t * 20) : 0) - gr8.material.opacity) * Math.min(1, dt * 8);
    if (hoseFrom) {
      // Schlauch: hängt vom Laderaum auf den Boden und läuft zum Spieler
      tmp.set(0.95, 1.5, 1.3).applyMatrix4(car.matrixWorld);
      const pts = [tmp.clone()];
      tmp2.set(1.5, 0, 1.3).applyMatrix4(car.matrixWorld); tmp2.y = W.heightAt(tmp2.x, tmp2.z) + 0.07; pts.push(tmp2.clone());
      for (let i = 1; i <= 3; i++) { const p = tmp2.clone().lerp(hoseFrom, i / 4); p.y = W.heightAt(p.x, p.z) + 0.07; pts.push(p); }
      pts.push(hoseFrom.clone());
      hose.geometry.dispose();
      hose.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 28, 0.045, 6);
      hose.visible = true;
    } else hose.visible = false;
  };

  BG.atStation = function () { return Math.hypot(BG.pos.x - BG.station.x, BG.pos.z - BG.station.z) < BG.station.r; };
  BG.exitPoint = function (out) {
    const ch = Math.cos(BG.heading), sh = Math.sin(BG.heading);
    return out.set(BG.pos.x - ch * 2.3, 0, BG.pos.z + sh * 2.3);
  };
  BG.serialize = function () { return [+BG.pos.x.toFixed(2), +BG.pos.z.toFixed(2), +BG.heading.toFixed(3), +BG.load.n.toFixed(1), +BG.load.g.toFixed(1), BG.sec]; };

  LC.Buggy = BG;
})(window.LC);
