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
  BG.stations = { 1: { x: 20, z: 11.5, r: 3.2, rot: 0.5 }, 2: { x: W.C[2].x - 18, z: W.C[2].z + 96, r: 3.2, rot: -0.35 } };
  BG.station = BG.stations[1];
  BG.sec = 1;                  // in welchem Sektor der Buggy steht
  BG.headR = 2.2;              // Radius der Saugfläche
  BG.TOP = 18;                 // Höchstgeschwindigkeit (m/s)
  BG.park = { x: 14.5, z: 17, heading: 2.5 };
  BG.HOSE_RANGE = 16;
  const HEAD_DIST = 2.35, RADIUS = 1.5;
  let scene, car, wheels = [], fill, shadow, headL, cabinL, hose, hoseMat, pitch = 0, roll = 0;   // cabinL = Material der Deckenleiste
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
    // ---- Druckkabine: geschlossener Raum mit zwei Plaetzen, Fenstern und Armaturen ----
    const mGlass = new THREE.MeshStandardMaterial({ color: 0xbfe2f5, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.FrontSide });
    const mHull = mk(0xb4b0a7, 0.5, 0.25), mIn = mk(0x34373d, 0.85, 0.08);
    mIn.emissive = new THREE.Color(0x20262e); mIn.emissiveIntensity = 1;   // Innenraum bleibt nachts lesbar
    const Z0 = -1.08, Z1 = 0.56, HW = 0.86, FY = 0.95, RY = 2.36, CZ = (Z0 + Z1) / 2, CD = Z1 - Z0;
    add(box(HW * 2, 0.07, CD), mIn, 0, FY + 0.035, CZ);                              // Kabinenboden
    // Rueckwand mit kleinem Fenster zum Laderaum
    add(box(HW * 2, 0.9, 0.09), mHull, 0, FY + 0.45, Z1);
    add(box(HW * 2 - 0.16, 0.46, 0.05), mGlass, 0, FY + 1.13, Z1);
    add(box(HW * 2, 0.07, 0.1), mOrange, 0, FY + 0.92, Z1);
    [-1, 1].forEach(sg => {
      add(box(0.08, 0.62, CD), mHull, sg * HW, FY + 0.31, CZ);                       // Tuerblech unten
      add(box(0.05, 0.8, CD - 0.3), mGlass, sg * HW, FY + 1.05, CZ + 0.04);          // Seitenfenster
      add(box(0.1, 0.07, CD), mOrange, sg * HW, FY + 0.65, CZ);                      // Zierstreifen
      add(box(0.03, 1.34, 0.04), mDark, sg * (HW + 0.03), FY + 0.74, -0.14);         // Tuerfugen
      add(box(0.03, 1.34, 0.04), mDark, sg * (HW + 0.03), FY + 0.74, 0.44);
      add(box(0.07, 0.06, 0.3), mSteel, sg * (HW + 0.05), FY + 0.52, 0.2);           // Tuergriff
      add(tube(1.4, 0.055), mSteel, sg * (HW - 0.01), 1.68, -0.93, 0.2);             // A-Saeule
      add(tube(1.4, 0.05), mSteel, sg * (HW - 0.01), FY + 0.7, Z1 - 0.04);           // B-Saeule
    });
    add(box(HW * 2 - 0.1, 1.42, 0.05), mGlass, 0, 1.68, -0.93, 0.2);                 // Frontscheibe
    add(box(HW * 2 + 0.06, 0.09, CD + 0.26), mHull, 0, RY, CZ - 0.06);               // Dach
    add(box(HW * 2 + 0.1, 0.05, 0.16), mOrange, 0, RY + 0.07, Z0 + 0.06);
    add(box(0.5, 0.05, 0.9), mDark, 0, RY + 0.07, CZ + 0.2);                         // Dachluke
    // zwei Sitze nebeneinander: links der Fahrer, rechts der Beifahrer am Bordsauger
    [-0.38, 0.38].forEach(x => {
      add(box(0.56, 0.14, 0.6), mSeat, x, 1.07, 0.1);
      add(box(0.5, 0.03, 0.5), mOrange, x, 1.145, 0.1);
      add(box(0.56, 0.74, 0.14), mSeat, x, 1.46, 0.42, -0.12);
      add(box(0.3, 0.16, 0.1), mSeat, x, 1.88, 0.46, -0.12);                         // Kopfstuetze
      [-0.26, 0.26].forEach(b => add(box(0.08, 0.26, 0.52), mSeat, x + b, 1.2, 0.12));// Seitenwangen
      add(tube(0.56, 0.03), mOrange, x - 0.16, 1.4, 0.3, 0, 0, 0.5);                 // Gurt
    });
    add(box(0.26, 0.26, 0.56), mIn, 0, 1.12, 0.14);                                  // Mittelkonsole
    add(box(0.16, 0.1, 0.2), mSteel, 0, 1.3, -0.08);                                 // Schalthebel
    // Armaturenbrett mit Bildschirmen
    add(box(HW * 2 - 0.1, 0.34, 0.34), mIn, 0, 1.3, -0.94);
    add(box(HW * 2 - 0.16, 0.06, 0.3), mDark, 0, 1.49, -0.93);
    const mScr = new THREE.MeshStandardMaterial({ color: 0, emissive: 0x4fe3ff, emissiveIntensity: 0.8 });
    add(box(0.42, 0.2, 0.02), mScr, -0.38, 1.36, -0.775, -0.3);
    add(box(0.34, 0.16, 0.02), mScr, 0.4, 1.34, -0.775, -0.3);
    add(new THREE.TorusGeometry(0.19, 0.024, 8, 20), mRubber, -0.38, 1.46, -0.66, -0.45);  // Lenkrad
    add(tube(0.3, 0.02), mSteel, -0.38, 1.4, -0.74, 1.1);
    // Bordsauger: Steuerknueppel innen beim Beifahrer, Arm aussen an der rechten Flanke
    add(new THREE.CylinderGeometry(0.07, 0.09, 0.16, 10), mDark, 0.6, 1.2, -0.2);
    add(tube(0.3, 0.025), mSteel, 0.6, 1.36, -0.2, 0.25);
    add(new THREE.SphereGeometry(0.06, 10, 8), mOrange, 0.63, 1.5, -0.24);
    add(new THREE.CylinderGeometry(0.12, 0.15, 0.3, 12), mDark, HW + 0.12, 1.3, -0.3);
    add(new THREE.SphereGeometry(0.14, 14, 10), mOrange, HW + 0.12, 1.5, -0.3);
    add(new THREE.CylinderGeometry(0.075, 0.095, 1.1, 12), mSteel, HW + 0.12, 1.42, -0.95, 0.45);
    add(new THREE.CylinderGeometry(0.16, 0.1, 0.2, 14), mDark, HW + 0.12, 1.15, -1.46, 0.45);
    add(new THREE.TorusGeometry(0.16, 0.025, 8, 18), new THREE.MeshStandardMaterial({ color: 0, emissive: 0x4fe3ff, emissiveIntensity: 1.4 }), HW + 0.12, 1.11, -1.53, 1.1);
    { const hc = new THREE.CatmullRomCurve3([new THREE.Vector3(HW + 0.12, 1.5, -0.28), new THREE.Vector3(HW + 0.2, 1.95, 0.1), new THREE.Vector3(HW + 0.1, 2.15, 0.7), new THREE.Vector3(0.74, 1.95, 1.1), new THREE.Vector3(0.6, 1.75, 1.25)]);
      add(new THREE.TubeGeometry(hc, 24, 0.05, 8), mRubber, 0, 0, 0); }
    // Innenlicht: leuchtende Deckenleiste (kostet keine zusaetzliche Lichtquelle)
    cabinL = new THREE.MeshStandardMaterial({ color: 0x14161a, emissive: 0xdce8ff, emissiveIntensity: 0.5 });
    add(box(0.62, 0.05, 0.2), cabinL, 0, RY - 0.08, CZ);
    add(box(0.14, 0.04, 0.5), cabinL, -0.62, RY - 0.08, CZ + 0.1);
    add(box(0.14, 0.04, 0.5), cabinL, 0.62, RY - 0.08, CZ + 0.1);
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
    add(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 8), mSteel, 0.6, 2.47, 0.2);     // Sockel auf dem Dach
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 12), BG.beaconMat, 0.6, 2.61, 0.2);
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
  // offene Welt: der Buggy ist immer da; die Entladestation ist die des Kraters, in dem er steht
  BG.refresh = function () { const v = BG.owned; car.visible = shadow.visible = v; if (!v) hose.visible = false; BG.station = BG.stations[W.secAt(BG.pos.x, BG.pos.z)]; };
  BG.here = () => BG.owned;

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
    if (inp.f > 0) BG.speed += (BG.speed < 0 ? 20 : 9.5) * dt;
    else if (inp.f < 0) BG.speed -= (BG.speed > 0 ? 20 : 6) * dt;
    else BG.speed -= BG.speed * Math.min(1, dt * 1.4);
    BG.speed = U.clamp(BG.speed, -6, BG.TOP);
    // bei hohem Tempo weniger Lenkeinschlag, damit er nicht ausbricht
    const grip = U.clamp(BG.speed / 3.5, -1, 1) * (1 - 0.42 * U.clamp((Math.abs(BG.speed) - 7) / 11, 0, 1));
    BG.heading -= inp.s * 1.55 * grip * dt;
    const sh = Math.sin(BG.heading), ch = Math.cos(BG.heading), p = BG.pos;
    p.x += -sh * BG.speed * dt; p.z += -ch * BG.speed * dt;
    // Hindernisse
    for (let i = 0; i < B.colliders.length; i++) {
      const c = B.colliders[i], dx = p.x - c.x, dz = p.z - c.z, rr = c.r + RADIUS, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); p.x = c.x + dx / d * rr; p.z = c.z + dz / d * rr; BG.speed *= Math.max(0, 1 - dt * 6); }
    }
    const r = Math.hypot(p.x, p.z); BG.atLimit = false;
    if (W.clamp(p, 1.5)) { BG.speed *= Math.max(0, 1 - dt * 5); BG.atLimit = true; }
    BG.station = BG.stations[W.secAt(p.x, p.z)];
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

  // Mehrspieler: ein Mitspieler fährt – Buggy weich an dessen gemeldete Stelle ziehen
  BG.busy = false;
  BG.remote = function (dt, x, z, heading, speed, suck) {
    const p = BG.pos, k = Math.min(1, dt * 10);
    if (Math.hypot(x - p.x, z - p.z) > 12) { p.x = x; p.z = z; BG.heading = heading; }
    p.x += (x - p.x) * k; p.z += (z - p.z) * k;
    let dh = heading - BG.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); BG.heading += dh * k;
    BG.speed = speed; BG.suck = suck;
    settle(dt, false);
    for (let i = 0; i < 4; i++) wheels[i].rotation.x -= speed * dt / 0.54;
  };

  BG.applyCamera = function (cam, outside) {
    if (outside) { LC.chase(cam, BG.pos, BG.heading + BG.lookYaw, BG.lookPitch, 7.6, 1.6); return; }
    tmp.set(-0.38, 2.02, -0.02).applyMatrix4(car.matrixWorld); cam.position.copy(tmp);
    e1.set(BG.lookPitch, BG.lookYaw, 0); q1.setFromEuler(e1);
    cam.quaternion.copy(car.quaternion).multiply(q1);
  };

  // Füllstand, Licht, Schlauch. hoseFrom = Punkt beim Spieler oder null
  BG.update = function (dt, t, dark, hoseFrom) {
    if (!BG.owned) return;
    fill.scale.y = Math.max(0.001, total() / BG.CAP); fill.visible = total() > 1;
    const gr = total() > 0 ? BG.load.g / total() : 0;
    fill.material.color.setRGB(0.10, U.lerp(0.085, 0.2, gr), U.lerp(0.07, 0.4, gr));
    const on = BG.driving || BG.busy;
    headL.intensity = on ? 0.5 + 2.2 * dark : 0;
    if (cabinL) cabinL.emissiveIntensity = on ? 1.4 + 1.6 * dark : 0.35;
    BG.beaconMat.emissiveIntensity = on ? ((t * 1.4) % 1 < 0.5 ? 3 : 0.2) : 0.2;
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
