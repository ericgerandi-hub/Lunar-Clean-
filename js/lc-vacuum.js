'use strict';
/* =========================================================
   Lunar Clean – Handsauger (Modell in der Hand), Saugen,
   Staub-Partikel, Zielring
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World, B = LC.Base, D = LC.Dust, PL = LC.Player;
  const V = {};
  const GX = 0.30, GY = -0.27, GZ = -0.60, GS = 0.78, GRX = 0.10, GRY = 0.40;   // Lage des Saugers im Bild
  V.intensity = 0; V.load = 0; V.sputter = false; V.target = { hit: false, x: 0, y: 0, z: 0 };
  V.nozzleWorld = new THREE.Vector3();
  let vmScene, vmCam, gun, fillMesh, fillMat, led, ledMat, tapes = [], newBand, sparkLight, vmSun, ring, ringGeo, ringMat;
  let coughT = 2, coughLeft = 0, glitTick = 0, swayX = 0, swayY = 0, kick = 0;
  const tmp = new THREE.Vector3(), qInv = new THREE.Quaternion(), nozzleLocal = new THREE.Vector3();

  // ---------- Partikel ----------
  const PN = 700;
  const pp = new Float32Array(PN * 3), pv = new Float32Array(PN * 3), pt = new Float32Array(PN * 3);
  const pcol = new Float32Array(PN * 4), psize = new Float32Array(PN), plife = new Float32Array(PN), pmax = new Float32Array(PN), pmode = new Uint8Array(PN);
  let pnext = 0, points, pgeo;

  function spawn(x, y, z, vx, vy, vz, mode, life, size, r, g, b, a) {
    const i = pnext; pnext = (pnext + 1) % PN;
    pp[i * 3] = x; pp[i * 3 + 1] = y; pp[i * 3 + 2] = z;
    pv[i * 3] = vx; pv[i * 3 + 1] = vy; pv[i * 3 + 2] = vz;
    pmode[i] = mode; plife[i] = life; pmax[i] = life; psize[i] = size;
    pcol[i * 4] = r; pcol[i * 4 + 1] = g; pcol[i * 4 + 2] = b; pcol[i * 4 + 3] = a;
    return i;
  }
  V.spawn = spawn;

  // Staubwolke beim Landen / Laufen
  V.kickDust = function (x, y, z, n, power) {
    const gl = D.glitterAt(x, z), am = D.amountAt(x, z);
    if (am < 0.25) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = (0.3 + Math.random()) * power;
      const c = 0.45 + Math.random() * 0.25;
      spawn(x + Math.cos(a) * 0.15, y + 0.03, z + Math.sin(a) * 0.15, Math.cos(a) * sp, 0.3 + Math.random() * power * 0.9, Math.sin(a) * sp,
        0, 1.2 + Math.random() * 1.2, 0.05 + Math.random() * 0.08, gl > 0.5 ? c * 0.6 : c, gl > 0.5 ? c * 0.8 : c * 0.9, gl > 0.5 ? c * 1.6 : c * 0.8, 0.5);
    }
  };

  // Staubstrom zu einem Ziel (z. B. beim Entleeren ins Staublager)
  V.stream = function (from, to, glitter) {
    const i = spawn(from.x + (Math.random() - 0.5) * 0.15, from.y + (Math.random() - 0.5) * 0.15, from.z + (Math.random() - 0.5) * 0.15,
      (Math.random() - 0.5) * 1.5, 0.6 + Math.random() * 1.2, (Math.random() - 0.5) * 1.5, 2, 1.6, 0.05 + Math.random() * 0.05,
      glitter ? 0.5 : 0.62, glitter ? 1.4 : 0.56, glitter ? 2.2 : 0.48, glitter ? 0.1 : 0.7);
    pt[i * 3] = to.x; pt[i * 3 + 1] = to.y; pt[i * 3 + 2] = to.z;
  };

  function updateParticles(dt) {
    const nz = V.nozzleWorld;
    for (let i = 0; i < PN; i++) {
      if (plife[i] <= 0) continue;
      plife[i] -= dt;
      const k = i * 3, m = pmode[i];
      if (m === 0) {
        pv[k + 1] -= 2.6 * dt;
        const g = W.heightAt(pp[k], pp[k + 2]);
        if (pp[k + 1] < g + 0.01 && pv[k + 1] < 0) { plife[i] = 0; }
      } else {
        const tx = m === 1 ? nz.x : pt[k], ty = m === 1 ? nz.y : pt[k + 1], tz = m === 1 ? nz.z : pt[k + 2];
        const dx = tx - pp[k], dy = ty - pp[k + 1], dz = tz - pp[k + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-4;
        if (d < 0.22) { plife[i] = 0; continue; }
        const pull = (m === 1 ? 60 : 30) / d * dt * (0.4 + (pmax[i] - plife[i]) * 3);
        pv[k] += dx * pull; pv[k + 1] += dy * pull; pv[k + 2] += dz * pull;
        const damp = Math.max(0, 1 - dt * 5);
        pv[k] *= damp; pv[k + 1] *= damp; pv[k + 2] *= damp;
        // nicht vorbeischießen
        const sp = Math.sqrt(pv[k] * pv[k] + pv[k + 1] * pv[k + 1] + pv[k + 2] * pv[k + 2]);
        if (sp * dt > d) { plife[i] = 0; continue; }
      }
      pp[k] += pv[k] * dt; pp[k + 1] += pv[k + 1] * dt; pp[k + 2] += pv[k + 2] * dt;
    }
    const pa = pgeo.attributes.position.array, ca = pgeo.attributes.aCol.array, sa = pgeo.attributes.aSize.array;
    for (let i = 0; i < PN; i++) {
      const alive = plife[i] > 0, k = i * 3;
      if (!alive) { sa[i] = 0; continue; }
      pa[k] = pp[k]; pa[k + 1] = pp[k + 1]; pa[k + 2] = pp[k + 2];
      const f = pmode[i] === 0 ? Math.min(1, plife[i] / (pmax[i] * 0.6)) : Math.min(1, (pmax[i] - plife[i]) * 8 + 0.2);
      ca[i * 4] = pcol[i * 4] * f; ca[i * 4 + 1] = pcol[i * 4 + 1] * f; ca[i * 4 + 2] = pcol[i * 4 + 2] * f; ca[i * 4 + 3] = pcol[i * 4 + 3] * f;
      sa[i] = psize[i];
    }
    pgeo.attributes.position.needsUpdate = true; pgeo.attributes.aCol.needsUpdate = true; pgeo.attributes.aSize.needsUpdate = true;
  }

  function buildParticles(scene) {
    pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PN * 3), 3));
    pgeo.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(PN * 4), 4));
    pgeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(PN), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 800 } },
      vertexShader: 'attribute vec4 aCol; attribute float aSize; varying vec4 vC; uniform float uScale;\nvoid main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / max(0.1, -mv.z); }',
      fragmentShader: 'varying vec4 vC;\nvoid main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.35, d); gl_FragColor = vec4(vC.rgb * a, vC.a * a); }',
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      depthWrite: false, transparent: true
    });
    points = new THREE.Points(pgeo, mat); points.frustumCulled = false; points.renderOrder = 5;
    scene.add(points);
    V.pointsMat = mat;
  }

  // ---------- Modell in der Hand ----------
  function buildModel() {
    vmScene = new THREE.Scene();
    vmCam = new THREE.PerspectiveCamera(52, 1, 0.02, 10);
    vmSun = new THREE.DirectionalLight(0xfff3e2, 2.2); vmScene.add(vmSun); vmScene.add(vmSun.target);
    vmScene.add(new THREE.HemisphereLight(0x5a6c88, 0x3a302a, 0.75));
    sparkLight = new THREE.PointLight(0x9fd8ff, 0, 1.2, 2); vmScene.add(sparkLight);

    const mOrange = new THREE.MeshStandardMaterial({ color: 0xe0741c, roughness: 0.45, metalness: 0.2 });
    const mDark = new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.5, metalness: 0.5 });
    const mSteel = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.32, metalness: 0.85 });
    const mRubber = new THREE.MeshStandardMaterial({ color: 0x0e0e0f, roughness: 0.9 });
    const mSuit = new THREE.MeshStandardMaterial({ color: 0xd8d6d0, roughness: 0.85 });
    const mTape = new THREE.MeshStandardMaterial({ color: 0x8c8f93, roughness: 0.6, metalness: 0.3 });
    const mGlass = new THREE.MeshStandardMaterial({ color: 0xbfe6f2, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 0.25, side: THREE.DoubleSide });
    fillMat = new THREE.MeshStandardMaterial({ color: 0x4a3f36, roughness: 1, emissive: 0x000000 });
    ledMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x3dff7a, emissiveIntensity: 1.5 });

    gun = new THREE.Group();
    const zc = (r1, r2, len, seg) => { const g = new THREE.CylinderGeometry(r1, r2, len, seg || 20); g.rotateX(Math.PI / 2); return g; };
    const add = (geo, mat, x, y, z, rx, ry, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0); gun.add(m); return m; };

    // Motorgehäuse
    add(zc(0.074, 0.074, 0.26, 24), mOrange, 0, 0, 0.02);
    add(zc(0.08, 0.066, 0.07, 24), mDark, 0, 0, 0.185);
    add(zc(0.078, 0.078, 0.025, 24), mDark, 0, 0, -0.08);
    add(zc(0.078, 0.078, 0.025, 24), mDark, 0, 0, 0.11);
    for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(0.012, 0.006, 0.09), mDark, Math.sin(-0.6 + i * 0.3) * 0.075, Math.cos(-0.6 + i * 0.3) * 0.075, 0.03, 0, 0, 0.6 - i * 0.3);
    // Staubbehälter (durchsichtig) mit Füllstand
    { const gg = new THREE.CylinderGeometry(0.064, 0.064, 0.21, 24, 1, true); gg.rotateX(Math.PI / 2); add(gg, mGlass, 0, 0, -0.21).renderOrder = 3; }
    add(zc(0.07, 0.07, 0.016, 24), mSteel, 0, 0, -0.105);
    add(zc(0.07, 0.07, 0.016, 24), mSteel, 0, 0, -0.315);
    const fg = new THREE.CylinderGeometry(0.058, 0.058, 0.196, 20); fg.rotateX(Math.PI / 2);
    fillMesh = add(fg, fillMat, 0, 0, -0.21);
    for (let i = 0; i < 3; i++) { const a = 0.6 + i * 2.094; add(zc(0.004, 0.004, 0.21, 6), mSteel, Math.cos(a) * 0.066, Math.sin(a) * 0.066, -0.21); }
    // Saugrohr mit Düse
    const pipe = new THREE.Group(); pipe.position.set(0, 0, -0.32); pipe.rotation.x = -0.3; gun.add(pipe);
    const padd = (geo, mat, x, y, z, rx) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); if (rx) m.rotation.x = rx; pipe.add(m); return m; };
    padd(zc(0.04, 0.062, 0.07, 20), mDark, 0, 0, -0.03);
    padd(zc(0.03, 0.03, 0.34, 16), mSteel, 0, 0, -0.22);
    padd(zc(0.034, 0.034, 0.03, 16), mOrange, 0, 0, -0.12);
    padd(new THREE.BoxGeometry(0.2, 0.035, 0.09), mRubber, 0, -0.012, -0.41, 0.25);
    padd(new THREE.BoxGeometry(0.21, 0.012, 0.1), mRubber, 0, -0.034, -0.416, 0.25);
    nozzleLocal.set(0, -0.03, -0.44);
    V._pipe = pipe;
    // Griff + Handschuh + Arm
    add(new THREE.BoxGeometry(0.042, 0.13, 0.05), mDark, 0, -0.115, 0.07, 0.3);
    add(new THREE.BoxGeometry(0.085, 0.085, 0.105), mSuit, 0.004, -0.125, 0.078, 0.3);
    add(new THREE.BoxGeometry(0.03, 0.05, 0.1), mSuit, -0.04, -0.09, 0.05, 0.3);
    const arm = add(zc(0.05, 0.062, 0.5, 14), mSuit, 0.07, -0.26, 0.3, -0.75, 0.25, 0);
    add(zc(0.058, 0.058, 0.035, 14), mOrange, 0.035, -0.17, 0.165, -0.75, 0.25, 0);
    // Schlauch nach hinten
    const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0.21), new THREE.Vector3(-0.03, -0.02, 0.3), new THREE.Vector3(-0.1, -0.16, 0.36), new THREE.Vector3(-0.12, -0.45, 0.42)]);
    add(new THREE.TubeGeometry(hose, 14, 0.022, 8), mRubber, 0, 0, 0);
    // Anzeige-LED
    led = add(new THREE.SphereGeometry(0.007, 10, 8), ledMat, 0, 0.079, 0.07);
    add(new THREE.BoxGeometry(0.05, 0.012, 0.07), mDark, 0, 0.072, 0.07);
    // Klebeband (nur solange kaputt) / neuer Ring (wenn repariert)
    tapes.push(add(zc(0.0765, 0.0765, 0.035, 20), mTape, 0, 0, -0.02, 0, 0, 0));
    tapes.push(add(zc(0.034, 0.033, 0.05, 12), mTape, 0, -0.058, -0.5, -0.3, 0, 0));
    tapes.push(add(new THREE.BoxGeometry(0.06, 0.004, 0.05), mTape, 0.03, 0.068, -0.04, 0, 0.5, -0.4));
    newBand = add(zc(0.0755, 0.0755, 0.01, 24), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x4fe3ff, emissiveIntensity: 1.1 }), 0, 0, -0.02);
    newBand.visible = false;

    gun.scale.setScalar(GS);
    gun.position.set(GX, GY, GZ);
    gun.rotation.set(GRX, GRY, 0.02);
    vmScene.add(gun);
    V.gun = gun;
  }

  function buildRing(scene) {
    const SEG = 64;
    ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < SEG; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
    ringGeo.setIndex(idx);
    ringMat = new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    ring = new THREE.Mesh(ringGeo, ringMat); ring.frustumCulled = false; ring.renderOrder = 4;
    scene.add(ring);
    V._seg = SEG;
  }

  function updateRing(radius, t, full) {
    const tg = V.target;
    ring.visible = tg.hit;
    if (!tg.hit) return;
    const p = ringGeo.attributes.position.array, SEG = V._seg;
    const w = 0.03 + V.intensity * 0.02, r1 = radius * (1 - 0.04 * Math.sin(t * 14) * V.intensity);
    for (let i = 0; i <= SEG; i++) {
      const a = i / SEG * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const x0 = tg.x + c * (r1 - w), z0 = tg.z + s * (r1 - w), x1 = tg.x + c * r1, z1 = tg.z + s * r1;
      const k = i * 6;
      p[k] = x0; p[k + 1] = W.heightAt(x0, z0) + 0.05; p[k + 2] = z0;
      p[k + 3] = x1; p[k + 4] = W.heightAt(x1, z1) + 0.05; p[k + 5] = z1;
    }
    ringGeo.attributes.position.needsUpdate = true;
    ringMat.color.setHex(full ? 0xff5a3a : 0x66e6ff);
    ringMat.opacity = 0.22 + V.intensity * 0.5;
  }

  V.init = function (scene) {
    buildParticles(scene); buildModel(); buildRing(scene);
    V.scene = vmScene; V.camera = vmCam;
  };

  V.setRepaired = function (rep) {
    tapes.forEach(t => t.visible = !rep);
    newBand.visible = rep;
  };

  // Zielpunkt am Boden suchen
  function findTarget(cam, reach) {
    const tg = V.target; tg.hit = false;
    PL.forward(tmp);
    const ox = cam.position.x, oy = cam.position.y, oz = cam.position.z;
    let prev = 0;
    for (let d = 0.3; d <= reach + 0.001; d += 0.12) {
      const x = ox + tmp.x * d, y = oy + tmp.y * d, z = oz + tmp.z * d;
      const g = W.heightAt(x, z);
      if (y <= g) {
        // nachschärfen
        let a = prev, b = d;
        for (let i = 0; i < 5; i++) { const m = (a + b) / 2; if (oy + tmp.y * m <= W.heightAt(ox + tmp.x * m, oz + tmp.z * m)) b = m; else a = m; }
        tg.x = ox + tmp.x * b; tg.z = oz + tmp.z * b; tg.y = W.heightAt(tg.x, tg.z); tg.hit = true;
        return;
      }
      prev = d;
    }
  }

  // cfg: {radius, rate, reach, repaired, room, glitRatio, fill}
  V.update = function (dt, t, cam, fire, cfg, onSuck) {
    findTarget(cam, cfg.reach);
    const full = cfg.room <= 0.0001;

    // kaputter Motor hustet
    V.sputter = false;
    let eff = fire && !full ? 1 : 0;
    if (!cfg.repaired && fire && !full) {
      coughT -= dt;
      if (coughT <= 0) { coughLeft = 0.25 + Math.random() * 0.5; coughT = 1.1 + Math.random() * 2.2; LC.Audio.play('spark'); sparkLight.intensity = 3; }
      if (coughLeft > 0) { coughLeft -= dt; eff = 0.18 + Math.random() * 0.25; V.sputter = true; }
    }
    V.intensity += (eff - V.intensity) * Math.min(1, dt * (eff > V.intensity ? 7 : 5));
    sparkLight.intensity *= Math.max(0, 1 - dt * 12);

    // saugen
    V.load += (0 - V.load) * Math.min(1, dt * 6);
    if (V.intensity > 0.08 && V.target.hit && !full) {
      const tg = V.target;
      const res = D.suck(tg.x, tg.z, cfg.radius, cfg.rate * V.intensity, dt, cfg.room);
      const got = res.n + res.g;
      if (got > 0) {
        onSuck(res.n, res.g);
        V.load = Math.min(1, V.load + got * 2.5);
        const count = Math.min(18, Math.ceil(got * 40 + Math.random()));
        const gfrac = res.g / got;
        for (let i = 0; i < count; i++) {
          const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * cfg.radius * 0.95;
          const x = tg.x + Math.cos(a) * rr, z = tg.z + Math.sin(a) * rr, y = W.heightAt(x, z) + 0.03;
          const gl = Math.random() < gfrac, c = 0.5 + Math.random() * 0.3;
          spawn(x, y, z, (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 1.3, (Math.random() - 0.5) * 0.8, 1, 1.5,
            gl ? 0.025 + Math.random() * 0.025 : 0.022 + Math.random() * 0.045,
            gl ? 0.5 : c, gl ? 1.5 : c * 0.9, gl ? 2.4 : c * 0.78, gl ? 0.08 : 0.6);
        }
        if (res.g > 0) { glitTick -= res.g; if (glitTick <= 0) { glitTick = 0.6; LC.Audio.play('glit'); } }
      }
    }
    LC.Audio.setVac(V.intensity, V.load, V.sputter);

    // Modell bewegen
    swayX += (-PL.lookDX * 0.0009 - swayX) * Math.min(1, dt * 9);
    swayY += (PL.lookDY * 0.0009 - swayY) * Math.min(1, dt * 9);
    swayX = U.clamp(swayX, -0.06, 0.06); swayY = U.clamp(swayY, -0.05, 0.05);
    kick += ((fire && !full ? 1 : 0) - kick) * Math.min(1, dt * 8);
    const vib = V.intensity * 0.0022, air = PL.onGround ? 0 : U.clamp(PL.vel.y * 0.006, -0.03, 0.03);
    gun.position.set(
      GX + Math.cos(PL.bob) * 0.008 * PL.bobAmt + swayX * 0.4 + (Math.random() - 0.5) * vib,
      GY - Math.abs(Math.sin(PL.bob)) * 0.012 * PL.bobAmt - air + swayY * 0.4 + (Math.random() - 0.5) * vib - PL.dip * 0.25,
      GZ - kick * 0.03);
    gun.rotation.set(GRX + swayY * 1.2 - kick * 0.05 + air * 1.5, GRY + swayX * 1.4, 0.02 + swayX * 0.8);

    // Füllstand im Behälter
    const fl = U.clamp(cfg.fill, 0, 1), fh = 0.04 + 0.96 * fl;      // Staub liegt unten im Behälter und wächst nach oben
    fillMesh.scale.y = fh; fillMesh.position.y = -0.058 * (1 - fh);
    fillMesh.visible = cfg.fill > 0.002;
    fillMat.color.setRGB(U.lerp(0.10, 0.10, cfg.glitRatio), U.lerp(0.085, 0.22, cfg.glitRatio), U.lerp(0.07, 0.42, cfg.glitRatio));
    fillMat.emissive.setRGB(0.02 * cfg.glitRatio, 0.12 * cfg.glitRatio, 0.25 * cfg.glitRatio);
    // LED: grün = bereit, gelb flackernd = kaputt, rot blinkend = voll
    if (full) { ledMat.emissive.setHex(0xff2a1a); ledMat.emissiveIntensity = (t * 3 % 1) < 0.5 ? 2.5 : 0.2; }
    else if (!cfg.repaired) { ledMat.emissive.setHex(0xffb020); ledMat.emissiveIntensity = V.sputter ? 0.2 + Math.random() * 2.5 : 1.4; }
    else { ledMat.emissive.setHex(0x3dff7a); ledMat.emissiveIntensity = 1.2 + V.intensity * 1.6; }

    // Sonnenrichtung in Blickrichtung umrechnen
    qInv.copy(cam.quaternion).invert(); tmp.copy(W.SUN_DIR).applyQuaternion(qInv);
    vmSun.position.copy(tmp).multiplyScalar(5); vmSun.target.position.set(0, 0, 0);
    vmSun.intensity = 2.2 * cfg.sunlit;

    // Düsen-Position in der Welt (für die Partikel)
    vmScene.updateMatrixWorld();
    tmp.copy(nozzleLocal); V._pipe.localToWorld(tmp);
    const dist = tmp.length();
    tmp.project(vmCam); tmp.z = 0.5; tmp.unproject(cam);
    tmp.sub(cam.position).normalize().multiplyScalar(dist * 1.05).add(cam.position);
    V.nozzleWorld.copy(tmp);

    updateParticles(dt);
    updateRing(cfg.radius, t, full);
  };

  // nur Partikel weiterlaufen lassen (Menü, Werkstatt)
  V.idle = function (dt) { V.intensity = 0; LC.Audio.setVac(0, 0, false); updateParticles(dt); ring.visible = false; };

  V.resize = function (aspect, h) { vmCam.aspect = aspect; vmCam.updateProjectionMatrix(); V.pointsMat.uniforms.uScale.value = h * 0.9; };

  LC.Vacuum = V;
})(window.LC);
