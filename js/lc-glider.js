'use strict';
/* =========================================================
   Lunar Clean – Schwebegleiter: fliegen (W/S Schub, A/D drehen,
   Leertaste hoch, C runter), Saugrüssel für das Putzen aus der Luft,
   eigener Laderaum. Im Mehrspieler: einer fliegt, andere fliegen mit.
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World, B = LC.Base, D = LC.Dust, V = LC.Vacuum;
  const GD = { owned: false, driving: false, busy: false, heading: 0, speed: 0, suck: 0, alt: 0, lookYaw: 0, lookPitch: -0.1, CAP: 2500, SUCK_ALT: 9, load: { n: 0, g: 0 } };
  GD.pos = new THREE.Vector3(); GD.vel = new THREE.Vector3();
  let scene, root, craft, shadow, fans = [], pads = [], trunkMat, fill, tilt = 0, roll = 0, bob = 0, lastYawRate = 0;
  const tmp = new THREE.Vector3(), e1 = new THREE.Euler(0, 0, 0, 'YXZ'), q1 = new THREE.Quaternion();
  const total = () => GD.load.n + GD.load.g;
  GD.total = total; GD.room = () => Math.max(0, GD.CAP - total());

  // Flugraum: über beiden Kratern und über dem Pass (etwas weiter als zu Fuß)
  function clampAir(p) {
    const C2 = W.C[2], d1 = Math.hypot(p.x, p.z), d2 = Math.hypot(p.x - C2.x, p.z - C2.z), q = W.passInfo(p.x, p.z);
    if (d1 < 108 || d2 < 150 || q.d < 46) return false;
    const e1 = d1 - 108, e2 = d2 - 150, e3 = q.d - 46;
    if (e1 <= e2 && e1 <= e3) { p.x *= 108 / d1; p.z *= 108 / d1; }
    else if (e2 <= e3) { p.x = C2.x + (p.x - C2.x) * 150 / d2; p.z = C2.z + (p.z - C2.z) * 150 / d2; }
    else { p.x = q.x + (p.x - q.x) * 46 / q.d; p.z = q.z + (p.z - q.z) * 46 / q.d; }
    return true;
  }

  function build() {
    root = new THREE.Group(); craft = new THREE.Group(); root.add(craft);
    const mHull = new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.4, metalness: 0.45 });
    const mDark = new THREE.MeshStandardMaterial({ color: 0x1f2227, roughness: 0.65, metalness: 0.3 });
    const mAcc = new THREE.MeshStandardMaterial({ color: 0xd4601a, roughness: 0.5, metalness: 0.2 });
    const mGlass = new THREE.MeshStandardMaterial({ color: 0x0a1a22, roughness: 0.06, metalness: 0.9, transparent: true, opacity: 0.55 });
    const mGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.4, 3.4) });
    const add = (geo, mat, x, y, z, rx, ry, rz, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); m.castShadow = false; m.receiveShadow = true; (parent || craft).add(m); return m; };
    // Rumpf: flache, lange Linse (Bug zeigt nach -z)
    const hull = add(new THREE.SphereGeometry(1, 28, 16), mHull, 0, 0.95, 0); hull.scale.set(1.25, 0.5, 2.6);
    const belly = add(new THREE.SphereGeometry(1, 24, 12), mDark, 0, 0.78, 0.1); belly.scale.set(1.12, 0.36, 2.3);
    const stripe = add(new THREE.TorusGeometry(1.0, 0.05, 8, 40), mAcc, 0, 0.98, 0.9, Math.PI / 2); stripe.scale.set(1.2, 1.0, 1);
    add(new THREE.BoxGeometry(0.5, 0.06, 2.4), mAcc, 0, 1.44, 0.2);
    // Kanzel
    const can = add(new THREE.SphereGeometry(1, 24, 14, 0, 6.283, 0, 1.75), mGlass, 0, 1.1, -0.75); can.scale.set(0.82, 0.72, 1.35);
    add(new THREE.BoxGeometry(1.1, 0.1, 1.5), mDark, 0, 1.0, -0.7);                       // Kabinenboden
    [-0.36, 0.36].forEach(x => { add(new THREE.BoxGeometry(0.46, 0.12, 0.46), mDark, x, 1.12, -0.55); add(new THREE.BoxGeometry(0.46, 0.5, 0.1), mDark, x, 1.38, -0.3); });
    add(new THREE.TorusGeometry(0.15, 0.022, 6, 16, Math.PI), mDark, -0.36, 1.42, -1.1, -0.5);   // Steuerhorn
    // zwei Mantelpropeller hinten außen
    [-1, 1].forEach(sd => {
      add(new THREE.BoxGeometry(1.0, 0.1, 0.5), mHull, sd * 1.45, 1.0, 1.25);
      add(new THREE.TorusGeometry(0.62, 0.11, 10, 28), mDark, sd * 2.1, 1.05, 1.3);
      add(new THREE.TorusGeometry(0.62, 0.035, 6, 28), mAcc, sd * 2.1, 1.05, 1.19);
      const fan = new THREE.Group(); fan.position.set(sd * 2.1, 1.05, 1.3); craft.add(fan);
      for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.14, 0.02), mDark); b.rotation.z = k * Math.PI / 4; fan.add(b); }
      fans.push(fan);
      add(new THREE.CircleGeometry(0.5, 20), mGlow, sd * 2.1, 1.05, 1.42).material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.2, 1.9), transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    });
    // Leitwerk
    add(new THREE.BoxGeometry(0.07, 0.9, 0.9), mHull, 0, 1.75, 2.0, 0.35); add(new THREE.BoxGeometry(2.2, 0.06, 0.55), mHull, 0, 2.1, 2.25);
    add(new THREE.BoxGeometry(0.075, 0.2, 0.92), mAcc, 0, 2.02, 2.1, 0.35);
    // Schwebe-Düsen unten (leuchten) und Kufen
    [[-0.85, -1.3], [0.85, -1.3], [-0.95, 1.0], [0.95, 1.0]].forEach(p => {
      add(new THREE.CylinderGeometry(0.3, 0.36, 0.16, 16), mDark, p[0], 0.6, p[1]);
      const g = add(new THREE.CircleGeometry(0.26, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.4, 3.4) }), p[0], 0.515, p[1], Math.PI / 2); pads.push(g);
    });
    [-0.8, 0.8].forEach(x => { add(new THREE.BoxGeometry(0.08, 0.08, 3.0), mDark, x, 0.06, 0); [-1.0, 1.0].forEach(z => add(new THREE.BoxGeometry(0.06, 0.55, 0.06), mDark, x, 0.33, z)); });
    // Saugrüssel unter dem Bauch
    add(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 14), mDark, 0, 0.42, 0.2);
    trunkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.9, 1.3) });
    add(new THREE.TorusGeometry(0.3, 0.045, 8, 22), trunkMat, 0, 0.17, 0.2, Math.PI / 2);
    // Laderaum-Anzeige (Staub hinter Glas am Heck)
    add(new THREE.BoxGeometry(0.9, 0.34, 0.5), mGlass, 0, 1.25, 1.55);
    fill = add(new THREE.BoxGeometry(0.84, 0.3, 0.44), new THREE.MeshStandardMaterial({ color: 0x4a3d30, roughness: 1 }), 0, 1.11, 1.55); fill.geometry.translate(0, 0.15, 0);
    // Positionslichter
    add(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.2) }), -1.26, 0.98, 0);
    add(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 3, 0.5) }), 1.26, 0.98, 0);
    const sg = new THREE.PlaneGeometry(7.5, 7.5); sg.rotateX(-Math.PI / 2);
    shadow = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: U.glowTexture(64, [[0, 'rgba(0,0,0,0.9)'], [0.5, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    shadow.renderOrder = 2;
    scene.add(root); scene.add(shadow);
  }

  GD.init = function (sc) { scene = sc; build(); GD.setOwned(false); };
  GD.setOwned = function (v) { GD.owned = !!v; root.visible = shadow.visible = GD.owned; };
  GD.place = function (x, z, heading) { GD.pos.set(x, B.groundAt(x, z), z); GD.heading = heading; GD.vel.set(0, 0, 0); GD.speed = 0; GD.alt = 0; GD.suck = 0; sync(0); };
  GD.park = { x: B.pad.x, z: B.pad.z, heading: 0.6 };
  GD.landed = () => GD.alt < 0.35 && GD.vel.lengthSq() < 2.5;
  GD.canExit = () => GD.landed() && W.inside(GD.pos.x, GD.pos.z, 1);
  GD.exitPoint = function (out) { const ch = Math.cos(GD.heading), sh = Math.sin(GD.heading); out.set(GD.pos.x - ch * 2.4, 0, GD.pos.z + sh * 2.4); W.clamp(out, 0.5); return out; };
  GD.serialize = () => [+GD.pos.x.toFixed(2), +GD.pos.z.toFixed(2), +GD.heading.toFixed(3), +GD.load.n.toFixed(2), +GD.load.g.toFixed(2)];
  // wie stark der Saugrüssel in dieser Höhe zieht (0..1)
  GD.pull = () => U.clamp(1.15 - GD.alt / GD.SUCK_ALT, 0, 1);
  // steht er auf dem Landeplatz oder einer Fahrzeug-Station? (dort wird entladen)
  GD.atDock = function () {
    if (!GD.landed()) return false;
    if (Math.hypot(GD.pos.x - B.pad.x, GD.pos.z - B.pad.z) < B.pad.r + 1) return true;
    const st = LC.Buggy.stations;
    return Math.hypot(GD.pos.x - st[1].x, GD.pos.z - st[1].z) < 6 || Math.hypot(GD.pos.x - st[2].x, GD.pos.z - st[2].z) < 6;
  };

  function sync(dt) {
    root.position.copy(GD.pos); root.rotation.y = GD.heading;
    craft.rotation.x = tilt; craft.rotation.z = roll; craft.position.y = bob;
    const gy = B.groundAt(GD.pos.x, GD.pos.z), k = U.clamp(1 - GD.alt / 45, 0.2, 1);
    shadow.position.set(GD.pos.x - W.SUN_DIR.x * GD.alt * 0.9, gy + 0.06, GD.pos.z - W.SUN_DIR.z * GD.alt * 0.9);
    shadow.scale.set(0.7 + (1 - k) * 0.9, 1, 0.7 + (1 - k) * 0.9); shadow.material.opacity = 0.2 + 0.7 * k;
  }

  // inp: { f, s, up, fire, mdx, mdy, sens }   cb.onSuck(n, g)
  GD.drive = function (dt, inp, cb) {
    GD.lookYaw = U.clamp(GD.lookYaw - inp.mdx * 0.0022 * inp.sens, -2.4, 2.4);
    GD.lookPitch = U.clamp(GD.lookPitch - inp.mdy * 0.0022 * inp.sens, -1.3, 0.9);
    const airborne = GD.alt > 0.3;
    const yr = -inp.s * (airborne ? 1.35 : 0.5); lastYawRate += (yr - lastYawRate) * Math.min(1, dt * 4); GD.heading += lastYawRate * dt;
    const sh = Math.sin(GD.heading), ch = Math.cos(GD.heading), v = GD.vel, p = GD.pos;
    // Schub nach vorn/hinten nur in der Luft; am Boden rutscht er nicht
    if (airborne) { const a = inp.f * (inp.f > 0 ? 11 : 6); v.x += -sh * a * dt; v.z += -ch * a * dt; }
    const drag = airborne ? 0.75 : 6; v.x -= v.x * drag * dt; v.z -= v.z * drag * dt;
    const hs = Math.hypot(v.x, v.z), MAXS = 24; if (hs > MAXS) { v.x *= MAXS / hs; v.z *= MAXS / hs; }
    v.y += ((inp.up * 6.5) - v.y) * Math.min(1, dt * 3.2);
    p.x += v.x * dt; p.z += v.z * dt; p.y += v.y * dt;
    GD.atLimit = clampAir(p); if (GD.atLimit) { v.x *= Math.max(0, 1 - dt * 4); v.z *= Math.max(0, 1 - dt * 4); }
    let gy = B.groundAt(p.x, p.z);
    // tief unten nicht durch Bauten fliegen
    for (let i = 0; i < B.colliders.length; i++) {
      const c = B.colliders[i]; if (p.y - gy > (c.h || 2.5)) continue;
      const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + 2.0, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); p.x = c.x + dx / d * rr; p.z = c.z + dz / d * rr; v.x *= 0.5; v.z *= 0.5; }
    }
    gy = B.groundAt(p.x, p.z);
    // der Querbalken des Tors am Pass (in 7 bis 8,3 m Höhe): drunter durch oder drüber weg, nicht mittendurch
    if (B.gatePos) {
      const gx = p.x - B.gatePos.x, gz = p.z - B.gatePos.z, pd = W.PASS, pl = Math.hypot(pd.b.x - pd.a.x, pd.b.z - pd.a.z), ux = (pd.b.x - pd.a.x) / pl, uz = (pd.b.z - pd.a.z) / pl;
      const along = gx * ux + gz * uz, side = Math.abs(gx * uz - gz * ux), gh = B.groundAt(B.gatePos.x, B.gatePos.z);
      if (Math.abs(along) < 3.6 && side < 9.5) {
        const lo = gh + 4.6, hi = gh + 9.4;          // Gleiter ist rund 2,2 m hoch
        if (p.y > lo && p.y < hi) { if (p.y - lo < hi - p.y) { p.y = lo; if (v.y > 0) v.y = 0; } else { p.y = hi; if (v.y < 0) v.y = 0; } }
      }
    }
    // vorausschauen: steigt das Gelände vor ihm an, hebt er sich mit
    const ahead = Math.max(gy, B.groundAt(p.x + v.x * 0.5, p.z + v.z * 0.5));
    const keep = airborne && inp.up >= 0 ? 0.5 : 0;         // beim Sinken (C) setzt er ganz auf
    if (p.y < ahead + keep) { p.y += (ahead + keep - p.y) * Math.min(1, dt * 9); if (v.y < 0 && keep) v.y = 0; }
    if (p.y < gy) { p.y = gy; if (v.y < 0) v.y = 0; }
    if (p.y > 95) { p.y = 95; if (v.y > 0) v.y = 0; }
    GD.alt = p.y - gy; GD.speed = Math.hypot(v.x, v.z);
    // Saugrüssel: der Pilot saugt den Streifen direkt unter sich
    const want = inp.fire && GD.alt < GD.SUCK_ALT * 1.15 && GD.room() > 0.01 ? 1 : 0;
    GD.suck += (want - GD.suck) * Math.min(1, dt * 6);
    if (GD.suck > 0.2) {
      const res = D.suck(p.x, p.z, 2.1, 10 * GD.suck * GD.pull(), dt, GD.room());
      if (res.n + res.g > 0) { cb.onSuck(res.n, res.g); if (Math.random() < dt * 40) { tmp.set(p.x + (Math.random() - 0.5) * 3, gy + 0.1, p.z + (Math.random() - 0.5) * 3); V.stream(tmp, GD.pos, Math.random() < res.g / (res.n + res.g)); } }
    }
    const fwd = -(v.x * sh + v.z * ch);
    tilt += ((airborne ? -fwd * 0.012 - inp.f * 0.06 : 0) - tilt) * Math.min(1, dt * 4);
    roll += ((airborne ? lastYawRate * 0.22 : 0) - roll) * Math.min(1, dt * 4);
  };

  // Mehrspieler: ein Mitspieler fliegt
  GD.remote = function (dt, x, y, z, heading, suck) {
    const p = GD.pos, k = Math.min(1, dt * 9);
    if (Math.hypot(x - p.x, z - p.z) > 25) { p.set(x, y, z); GD.heading = heading; }
    const ox = p.x, oz = p.z;
    p.x += (x - p.x) * k; p.y += (y - p.y) * k; p.z += (z - p.z) * k;
    let dh = heading - GD.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); GD.heading += dh * k;
    GD.speed = Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, 1e-4); GD.suck = suck;
    GD.alt = p.y - B.groundAt(p.x, p.z);
    tilt += ((GD.alt > 0.3 ? -GD.speed * 0.012 : 0) - tilt) * Math.min(1, dt * 4); roll += (dh * 1.5 - roll) * Math.min(1, dt * 4);
  };

  GD.applyCamera = function (cam) {
    root.updateMatrixWorld(true);
    tmp.set(-0.36, 1.78, -0.62).applyMatrix4(craft.matrixWorld); cam.position.copy(tmp);
    e1.set(GD.lookPitch, GD.lookYaw, 0); q1.setFromEuler(e1);
    cam.quaternion.copy(root.quaternion).multiply(q1);
  };
  // Sitzplatz in der Welt (0 = Pilot, 1.. = Mitflieger)
  GD.seat = function (i, out) { root.updateMatrixWorld(true); return out.set(i === 0 ? -0.36 : 0.36, 0.72, i < 2 ? -0.5 : 0.55).applyMatrix4(craft.matrixWorld); };

  GD.update = function (dt, t) {
    if (!GD.owned) return;
    const on = GD.driving || GD.busy, air = GD.alt > 0.3;
    bob = air ? Math.sin(t * 1.7) * 0.06 : 0;
    const spin = on ? 18 + GD.speed * 1.2 : 0;
    fans[0].rotation.z += spin * dt; fans[1].rotation.z -= spin * dt;
    const glow = on ? (air ? 1 : 0.45) + Math.sin(t * 9) * 0.06 : 0.08;
    pads.forEach(g => g.material.color.setRGB(0.5 * glow * 2, 2.4 * glow, 3.4 * glow));
    trunkMat.color.setRGB(0.2 + GD.suck * 1.2, 0.9 + GD.suck * 1.6, 1.3 + GD.suck * 2.2);
    fill.scale.y = Math.max(0.001, total() / GD.CAP); fill.visible = total() > 1;
    // Abwind wirbelt Staub auf, wenn er tief fliegt
    if (on && air && GD.alt < 5 && Math.random() < dt * 14) { const a = Math.random() * 6.283, r = 1.5 + Math.random() * 2.5; V.kickDust(GD.pos.x + Math.cos(a) * r, GD.pos.y - GD.alt, GD.pos.z + Math.sin(a) * r, 2, 0.9); }
    sync(dt);
  };

  LC.Glider = GD;
})(window.LC);
