'use strict';
/* =========================================================
   Lunar Clean – Welt: Krater-Gelände, Himmel, Erde, Sonne, Felsen
   ========================================================= */
(function (LC) {
  const U = LC.U;
  const W = {};

  // Jeder Sektor ist ein eigener Krater. Größen in Metern.
  W.SECTORS = {
    1: { name: 'Sektor 1', CR: 72, RIM: 96, RIM_H: 15, LIMIT: 78, SIZE: 160, CLEAN: 74, seed: 20261111, nCr: 36, off: 0, tint: [1, 1, 1] },
    2: { name: 'Sektor 2', CR: 112, RIM: 140, RIM_H: 19, LIMIT: 118, SIZE: 256, CLEAN: 114, seed: 424242, nCr: 66, off: 913, tint: [1.55, 0.78, 0.55], peak: true }
  };
  // Offene Welt: beide Krater liegen in EINEM Gelände. Mittelpunkte in Welt-Koordinaten,
  // dazwischen führt ein Pass durch die Kraterränder (kein Tunnel, kein Umschalten).
  W.C = { 1: { x: 0, z: 0 }, 2: { x: 60, z: -260 } };
  W.PASS = { a: { x: 30.6, z: -51.6 }, b: { x: 60, z: -160 }, w: 7.5 };
  W.open = false;                   // Pass frei (Upgrade „tunnel“)?
  const CL = Math.hypot(W.C[2].x, W.C[2].z), CNX = W.C[2].x / CL, CNZ = W.C[2].z / CL, CUT = 111.5;
  W.cut = { nx: CNX, nz: CNZ, d: CUT };
  // > 0: gehört zu Sektor 2, < 0: zu Sektor 1 (Abstand zur Trennlinie in Metern)
  W.side = (x, z) => x * CNX + z * CNZ - CUT;
  W.secAt = (x, z) => (x * CNX + z * CNZ > CUT ? 2 : 1);
  const PA = W.PASS.a, PB = W.PASS.b, PDX = PB.x - PA.x, PDZ = PB.z - PA.z, PL2 = PDX * PDX + PDZ * PDZ;
  const passOut = { t: 0, d: 0, x: 0, z: 0 };
  function passInfo(x, z) {
    const t = U.clamp(((x - PA.x) * PDX + (z - PA.z) * PDZ) / PL2, 0, 1), px = PA.x + PDX * t, pz = PA.z + PDZ * t;
    passOut.t = t; passOut.x = px; passOut.z = pz; passOut.d = Math.hypot(x - px, z - pz); return passOut;
  }
  W.passInfo = passInfo;
  // Darf man hier sein? m = Abstand, der zum Rand bleiben soll
  W.inside = function (x, z, m) {
    m = m || 0;
    if (x * x + z * z < (W.SECTORS[1].LIMIT - m) * (W.SECTORS[1].LIMIT - m)) return true;
    if (!W.open) return false;
    const dx = x - W.C[2].x, dz = z - W.C[2].z, l2 = W.SECTORS[2].LIMIT - m;
    if (dx * dx + dz * dz < l2 * l2) return true;
    return passInfo(x, z).d < W.PASS.w - m;
  };
  // Punkt zurück ins erlaubte Gebiet schieben; true, wenn er draußen war
  W.clamp = function (p, m) {
    m = m || 0;
    if (W.inside(p.x, p.z, m)) return false;
    let bx, bz, bd = 1e9;
    const disc = (cx, cz, R) => { const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz) || 1, e = d - R; if (e < bd) { bd = e; bx = cx + dx / d * R; bz = cz + dz / d * R; } };
    disc(0, 0, W.SECTORS[1].LIMIT - m - 0.01);
    if (W.open) {
      disc(W.C[2].x, W.C[2].z, W.SECTORS[2].LIMIT - m - 0.01);
      const q = passInfo(p.x, p.z), R = W.PASS.w - m - 0.01, e = q.d - R;
      if (e < bd) { bd = e; const d = q.d || 1; bx = q.x + (p.x - q.x) / d * R; bz = q.z + (p.z - q.z) / d * R; }
    }
    p.x = bx; p.z = bz; return true;
  };
  W.sec = 1; W.cfg = W.SECTORS[1];
  W.CR = 72;        // Radius des Kraterbodens
  W.RIM = 96;       // Kamm des Kraterrands
  W.RIM_H = 15;     // Höhe des Kraterrands
  W.LIMIT = 78;     // so weit kommt man
  W.DUST_SIZE = 160; // Kantenlänge der Staubkarte in Metern
  W.CLEAN = 74;     // bis hierhin kann geputzt werden
  W.SUN_DIR = new THREE.Vector3(0.75, 0.47, 0.45).normalize();
  W.EARTH_DIR = new THREE.Vector3(-0.30, 0.46, -0.84).normalize();

  // ---------- Absturz-Furche ----------
  const FA = { x: -58, z: -21 }, FB = { x: -2, z: -1 };
  const FDX = FB.x - FA.x, FDZ = FB.z - FA.z, FLEN2 = FDX * FDX + FDZ * FDZ, FLEN = Math.sqrt(FLEN2);
  W.furrow = { a: FA, b: FB, dir: { x: FDX / FLEN, z: FDZ / FLEN } };
  function furrowInfo(x, z) {
    let t = ((x - FA.x) * FDX + (z - FA.z) * FDZ) / FLEN2;
    const tc = U.clamp(t, 0, 1);
    const px = FA.x + FDX * tc, pz = FA.z + FDZ * tc;
    return { t: tc, d: Math.hypot(x - px, z - pz) };
  }
  W.furrowInfo = furrowInfo;

  // ---------- Krater ----------
  // Drei tiefe Krater mit seltenem Glitzerstaub
  // (Koordinaten der Krater, Flächen und Felsen sind je Sektor relativ zu dessen Mittelpunkt)
  W.S = { 1: { n: 1, cfg: W.SECTORS[1], craters: [], glitterCraters: [], flats: [] }, 2: { n: 2, cfg: W.SECTORS[2], craters: [], glitterCraters: [], flats: [] } };
  function genCraters(n) {
    const S = W.S[n], c = S.cfg, rnd = U.rng(c.seed);
    if (n === 1) S.glitterCraters = [{ x: -40, z: 31, R: 8.5, d: 3.3 }, { x: 47, z: -25, R: 7.5, d: 2.9 }, { x: 15, z: -53, R: 9.5, d: 3.7 }];
    else S.glitterCraters = [{ x: -62, z: 38, R: 11, d: 4.2 }, { x: 70, z: 22, R: 9, d: 3.5 }, { x: 34, z: -78, R: 12, d: 4.6 }, { x: -48, z: -66, R: 8.5, d: 3.3 }, { x: -86, z: -14, R: 9.5, d: 3.6 }, { x: 78, z: -44, R: 8, d: 3.1 }];
    S.craters = S.glitterCraters.slice();
    let tries = 0;
    while (S.craters.length < c.nCr && tries < 9000) {
      tries++;
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (c.CR - 5);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const R = 1.6 + Math.pow(rnd(), 2.4) * (n === 1 ? 7.5 : 10);
      const d = R * (0.15 + rnd() * 0.11);
      if (n === 1) {
        if (Math.hypot(x, z) < 26 + R) continue;                // Basis frei lassen
        if (furrowInfo(x, z).d < R + 7) continue;                // Furche frei lassen
        if (passInfo(x, z).d < R + 9) continue;                  // Zufahrt zum Pass
      } else {
        if (Math.hypot(x, z) < 44 + R) continue;                // Zentralberg
        if (Math.hypot(x + 8, z - 100) < 30 + R) continue;      // Außenposten und Pass-Ausfahrt frei lassen
      }
      if (S.craters.some(k => Math.hypot(k.x - x, k.z - z) < (k.R + R) * 1.3)) continue;
      S.craters.push({ x, z, R, d });
    }
  }
  genCraters(1); genCraters(2);
  // „aktueller Sektor“ = der, in dem der Spieler gerade steht (für Anzeige, Karte, Schatten)
  W.setSector = function (n) {
    const c = W.SECTORS[n]; W.sec = n; W.cfg = c;
    W.CR = c.CR; W.RIM = c.RIM; W.RIM_H = c.RIM_H; W.LIMIT = c.LIMIT; W.DUST_SIZE = c.SIZE; W.CLEAN = c.CLEAN;
    W.craters = W.S[n].craters; W.glitterCraters = W.S[n].glitterCraters;
    if (W.sun) fitShadow();
  };
  W.craters = W.S[1].craters; W.glitterCraters = W.S[1].glitterCraters;

  // ebene Fläche in Sektor n (Koordinaten relativ zum Sektor); muss vor W.build aufgerufen werden
  W.addFlat = function (x, z, r, drop, n) { const S = W.S[n || 1]; S.flats.push({ x, z, r, h: secH(S, x, z) - (drop || 0) }); };

  // ---------- Höhe des Geländes ----------
  // Höhe eines einzelnen Kraters samt Umland (x, z relativ zu seinem Mittelpunkt)
  function secH(S, x, z) {
    const cfg = S.cfg, CR = cfg.CR, RIM = cfg.RIM, RIM_H = cfg.RIM_H, craters = S.craters, flats = S.flats;
    const r = Math.hypot(x, z), nx = x + cfg.off, nz = z - cfg.off * 0.6;
    let h = (U.fbm(nx * 0.028 + 11.3, nz * 0.028 - 4.1, 3, 5) - 0.5) * 2.4;
    h += (U.fbm(nx * 0.21 + 3.7, nz * 0.21 + 9.2, 3, 9) - 0.5) * 0.34;

    const wallStart = CR - 12;
    if (r > wallStart) {
      const ang = Math.atan2(z, x);
      const rimVar = 0.72 + 0.6 * U.fbm(Math.cos(ang) * 2.3 + 7 + cfg.off, Math.sin(ang) * 2.3 + 3, 3, 21);
      const top = RIM_H * rimVar;
      if (r < RIM) {
        const s = U.smooth((r - wallStart) / (RIM - wallStart));
        h += top * Math.pow(s, 1.5);
      } else {
        const s2 = U.smoothstep(RIM, RIM + 150, r);
        h += top * (1 - s2) + 5 * s2;
        // raue Hänge außen
        h += (U.fbm(nx * 0.05, nz * 0.05, 4, 33) - 0.5) * 7 * U.smoothstep(RIM, RIM + 60, r);
        if (r > RIM + 144) {
          // ferne Berge am Horizont
          const m = U.smoothstep(RIM + 144, RIM + 604, r);
          const n = U.fbm(nx * 0.0035 + 40, nz * 0.0035 - 17, 5, 51);
          const ridge = 1 - Math.abs(n * 2 - 1);
          h += m * (ridge * ridge * 210 + n * 60 - 40);
        }
      }
    }

    if (r < CR + 6) {
      for (let i = 0; i < craters.length; i++) {
        const c = craters[i];
        const dx = x - c.x, dz = z - c.z, lim = c.R * 1.9;
        if (dx > lim || dx < -lim || dz > lim || dz < -lim) continue;
        const d = Math.sqrt(dx * dx + dz * dz) / c.R;
        if (d < 1) { const q = 1 - d * d; h -= c.d * q * q; }
        if (d < 1.9) { const e = (d - 1.05) / 0.26; h += c.d * 0.2 * Math.exp(-e * e); }
      }
      if (S.n === 1) {
        // Furche vom Absturz + aufgeschobener Wall
        const f = furrowInfo(x, z);
        if (f.d < 9) {
          const depth = 1.25 * Math.pow(f.t, 0.6);
          const g = f.d / 2.3, b = (f.d - 3.7) / 1.25;
          h += -depth * Math.exp(-g * g) + depth * 0.32 * Math.exp(-b * b);
        }
        const mx = x - 2.6, mz = z - 0.7, md = (mx * mx + mz * mz) / 10;
        if (md < 6) h += 1.15 * Math.exp(-md);
      }
      if (cfg.peak && r < 46) {
        // Zentralberg: zu steil zum Putzen, man fährt außen herum
        const q = r / 18;
        h += 15 * Math.exp(-q * q) * (0.8 + 0.4 * U.fbm(nx * 0.12, nz * 0.12, 3, 77));
      }
      // eingeebnete Flächen (Landeplatz, Entladestation): das Gelände ragt dort nicht durch den Boden
      for (let i = 0; i < flats.length; i++) {
        const f = flats[i], dx = x - f.x, dz = z - f.z, d2 = dx * dx + dz * dz, ro = f.r + 2.5;
        if (d2 < ro * ro) h = U.lerp(h, f.h, U.smoothstep(ro, f.r, Math.sqrt(d2)));
      }
    }
    return h;
  }
  let passH = null;
  W.heightAt = function (x, z) {
    const sd = x * CNX + z * CNZ - CUT; let h;
    if (sd < -25) h = secH(W.S[1], x, z);
    else if (sd > 25) h = secH(W.S[2], x - W.C[2].x, z - W.C[2].z);
    else h = U.lerp(secH(W.S[1], x, z), secH(W.S[2], x - W.C[2].x, z - W.C[2].z), U.smoothstep(-25, 25, sd));
    // der Pass: eine Schlucht mit ebenem Boden von Krater zu Krater
    const q = passInfo(x, z);
    if (q.d < 19) {
      if (!passH) passH = [secH(W.S[1], PA.x, PA.z), secH(W.S[2], PB.x - W.C[2].x, PB.z - W.C[2].z)];
      const t = q.t, e = t * t * (3 - 2 * t);
      const floor = U.lerp(passH[0], passH[1], e) + Math.sin(t * Math.PI) * 2.2 + (U.fbm(x * 0.16, z * 0.16, 2, 131) - 0.5) * 0.3;
      h = U.lerp(floor, h, U.smoothstep(W.PASS.w - 1.5, 18, q.d));
    }
    return h;
  };

  W.normalAt = function (x, z, out) {
    const e = 0.35;
    const hx = W.heightAt(x + e, z) - W.heightAt(x - e, z);
    const hz = W.heightAt(x, z + e) - W.heightAt(x, z - e);
    out.set(-hx, 2 * e, -hz).normalize();
    return out;
  };

  // ---------- Texturen ----------
  function makeNoiseTexture() {
    const N = 256, data = new Uint8Array(N * N * 4);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = i / N, v = j / N, k = (j * N + i) * 4;
      data[k] = U.fbm(u * 8, v * 8, 4, 101, 8) * 255;
      data[k + 1] = U.fbm(u * 16, v * 16, 4, 202, 16) * 255;
      data[k + 2] = U.fbm(u * 32, v * 32, 3, 303, 32) * 255;
      data[k + 3] = 255;
    }
    const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.needsUpdate = true;
    return t;
  }

  function makeNormalTexture() {
    const N = 512, hgt = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = i / N, v = j / N;
      hgt[j * N + i] = U.fbm(u * 6, v * 6, 5, 77, 6) * 1.0 + U.fbm(u * 48, v * 48, 2, 88, 48) * 0.12;
    }
    // kleine Einschlaglöcher und Steinchen
    const rnd = U.rng(4242);
    for (let p = 0; p < 150; p++) {
      const cx = rnd() * N, cy = rnd() * N, R = 3 + Math.pow(rnd(), 2) * 16, up = rnd() < 0.35;
      const amp = (up ? 0.09 : -0.11) * (0.5 + rnd());
      const r0 = Math.ceil(R * 1.5);
      for (let dy = -r0; dy <= r0; dy++) for (let dx = -r0; dx <= r0; dx++) {
        const d = Math.hypot(dx, dy) / R; if (d > 1.5) continue;
        const x = ((Math.round(cx) + dx) % N + N) % N, y = ((Math.round(cy) + dy) % N + N) % N;
        let v = 0;
        if (d < 1) { const q = 1 - d * d; v = amp * q * q; }
        if (!up) { const e = (d - 1.05) / 0.2; v += -amp * 0.3 * Math.exp(-e * e); }
        hgt[y * N + x] += v;
      }
    }
    const data = new Uint8Array(N * N * 4), S = 26;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const l = hgt[j * N + (i + N - 1) % N], r = hgt[j * N + (i + 1) % N];
      const d = hgt[((j + N - 1) % N) * N + i], u2 = hgt[((j + 1) % N) * N + i];
      let nx = (l - r) * S, ny = (d - u2) * S, nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz); nx /= len; ny /= len; nz /= len;
      const k = (j * N + i) * 4;
      data[k] = (nx * 0.5 + 0.5) * 255; data[k + 1] = (ny * 0.5 + 0.5) * 255; data[k + 2] = (nz * 0.5 + 0.5) * 255; data[k + 3] = 255;
    }
    const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true;
    return t;
  }

  // ---------- Gelände-Gitter ----------
  function buildAxis(n) {
    const half = W.SECTORS[n].RIM + 34, step = half / 220, inner = [];
    for (let i = 0; i <= 440; i++) inner.push(-half + i * step);
    const outer = []; let s = step * 1.2, v = half;
    for (let i = 0; i < 40; i++) { v += s; outer.push(v); s *= 1.17; }
    return outer.map(o => -o).reverse().concat(inner, outer);
  }

  // Gelände-Punkte (neu) berechnen – auch beim Wechsel des Sektors
  function fillTerrain(geo, sn) {
    const ax = buildAxis(sn), n = ax.length, ox = W.C[sn].x, oz = W.C[sn].z;
    const pos = geo.attributes.position.array, nor = geo.attributes.normal.array, uv = geo.attributes.uv.array;
    const hs = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) hs[j * n + i] = W.heightAt(ox + ax[i], oz + ax[j]);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      pos[k * 3] = ax[i]; pos[k * 3 + 1] = hs[k]; pos[k * 3 + 2] = ax[j];
      uv[k * 2] = (ox + ax[i]) / 3.4; uv[k * 2 + 1] = (oz + ax[j]) / 3.4;
      const i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, n - 1), j0 = Math.max(j - 1, 0), j1 = Math.min(j + 1, n - 1);
      const dhx = (hs[j * n + i1] - hs[j * n + i0]) / (ax[i1] - ax[i0]);
      const dhz = (hs[j1 * n + i] - hs[j0 * n + i]) / (ax[j1] - ax[j0]);
      const l = Math.sqrt(dhx * dhx + 1 + dhz * dhz);
      nor[k * 3] = -dhx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = -dhz / l;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true; geo.attributes.uv.needsUpdate = true;
    geo.computeBoundingSphere();
  }

  function buildTerrain(sn, dustTex, glitTex) {
    const n = buildAxis(sn).length, cfg = W.SECTORS[sn];
    const pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2);
    const idx = new Uint32Array((n - 1) * (n - 1) * 6); let q = 0;
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    fillTerrain(geo, sn);

    if (!W.noiseTex) { W.noiseTex = makeNoiseTexture(); W.normalTex = makeNormalTexture(); }
    const noiseTex = W.noiseTex;
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 0,
      normalMap: W.normalTex, normalScale: new THREE.Vector2(1.15, 1.15)
    });
    mat.envMapIntensity = 0;
    const uni = {
      dustMap: { value: dustTex }, glitMap: { value: glitTex }, noiseTex: { value: noiseTex },
      uTime: { value: 0 }, uDustSize: { value: cfg.SIZE }, uHint: { value: 0 }, uThick: { value: 0.24 }, uClean: { value: cfg.CLEAN }, uTint: { value: new THREE.Vector3(cfg.tint[0], cfg.tint[1], cfg.tint[2]) },
      uCenter: { value: new THREE.Vector2(W.C[sn].x, W.C[sn].z) }, uCut: { value: new THREE.Vector4(CNX, CNZ, CUT, sn === 1 ? -1 : 1) }
    };
    W.tu[sn] = uni;
    mat.onBeforeCompile = function (sh) {
      Object.assign(sh.uniforms, uni);
      // Staub ist eine Schicht: wo er liegt, wird der Boden ein Stück angehoben
      sh.vertexShader = 'varying vec3 vWPos; uniform sampler2D dustMap; uniform float uDustSize; uniform float uThick;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n transformed.y += smoothstep(0.22, 0.62, texture2D(dustMap, position.xz / uDustSize + 0.5).r) * uThick;\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = [
        'uniform sampler2D dustMap; uniform sampler2D glitMap; uniform sampler2D noiseTex;',
        'uniform float uTime; uniform float uDustSize; uniform float uHint; uniform float uClean; uniform vec3 uTint; uniform vec2 uCenter; uniform vec4 uCut; varying vec3 vWPos;'
      ].join('\n') + '\n' + sh.fragmentShader
        .replace('#include <map_fragment>', [
          // jedes der beiden Gelände-Gitter zeichnet nur seine Seite der Trennlinie (mit etwas Überlappung)
          'if ((dot(vWPos.xz, uCut.xy) - uCut.z) * uCut.w < -0.7) discard;',
          'vec2 lcP = vWPos.xz - uCenter;',
          'vec2 dUv = lcP / uDustSize + 0.5;',
          'float dRaw = texture2D(dustMap, dUv).r;',
          'vec4 nzA = texture2D(noiseTex, vWPos.xz * 0.045);',
          'vec4 nzB = texture2D(noiseTex, vWPos.xz * 0.37 + 0.31);',
          'vec4 nzC = texture2D(noiseTex, vWPos.xz * 1.9 + 0.77);',
          'float nEdge = nzB.r * 0.6 + nzC.g * 0.4;',
          'float lcDust = smoothstep(0.30, 0.60, dRaw + (nEdge - 0.5) * 0.6);',
          'float lcGlit = texture2D(glitMap, dUv).r;',
          'float lcCamD = distance(vWPos, cameraPosition);',
          'vec3 cleanCol = vec3(0.47, 0.48, 0.51) * (0.84 + 0.32 * nzC.b) * (0.88 + 0.24 * nzB.g) * (0.88 + 0.24 * nzA.r);',
          'vec3 dustCol = vec3(0.050, 0.043, 0.037) * (0.90 + 0.20 * nzC.r) * (0.92 + 0.16 * nzB.b) * (0.80 + 0.40 * nzA.g);',
          'vec3 glitCol = vec3(0.050, 0.050, 0.13) * (0.7 + 0.6 * nzC.r);',
          'dustCol *= uTint;',
          'dustCol = mix(dustCol, glitCol, lcGlit);',
          // dünner Staubschleier am Rand geputzter Flächen
          'float lcVeil = smoothstep(0.0, 0.30, dRaw) * (1.0 - lcDust) * 0.35;',
          'diffuseColor.rgb = mix(mix(cleanCol, dustCol * 2.2, lcVeil), dustCol, lcDust);',
          // Kante der Staubschicht: dunkle Fuge unten, heller Grat oben
          'float lcRim = lcDust * (1.0 - lcDust) * 4.0, lcNearE = 1.0 - smoothstep(30.0, 90.0, lcCamD);',
          'diffuseColor.rgb *= 1.0 - 0.62 * lcRim * (1.0 - lcDust) * lcNearE;',
          'diffuseColor.rgb += dustCol * 1.6 * smoothstep(0.55, 0.95, lcDust) * (1.0 - smoothstep(0.95, 1.0, lcDust)) * lcNearE;'
        ].join('\n'))
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.58, 1.0, lcDust);')
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n reflectedLight.directSpecular *= mix(1.0, 0.08, lcDust);')
        .replace('#include <normal_fragment_maps>', [
          'vec3 mapN = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;',
          'vec3 mapN2 = texture2D(normalMap, vUv * 0.19 + vec2(0.37, 0.11)).xyz * 2.0 - 1.0;',
          'float lcNF = 1.0 - smoothstep(60.0, 220.0, lcCamD);',
          'mapN.xy = (mapN.xy * 0.62 * lcNF + mapN2.xy * 0.34) * normalScale * (0.6 + 0.4 * lcDust);',
          'mapN = normalize(mapN);',
          'normal = perturbNormal2Arb(-vViewPosition, normal, mapN, faceDirection);'
        ].join('\n'))
        .replace('#include <emissivemap_fragment>', [
          'vec2 lcCell = floor(vWPos.xz * 24.0);',
          'float lcH = fract(sin(dot(lcCell, vec2(127.1, 311.7))) * 43758.5453);',
          'vec3 lcV = normalize(cameraPosition - vWPos);',
          'float lcTw = pow(max(0.0, sin(lcH * 90.0 + dot(lcV, vec3(31.0, 17.0, 23.0)) * 7.0 + uTime * 0.7)), 20.0);',
          'float lcNear = 1.0 - smoothstep(14.0, 38.0, lcCamD);',
          'totalEmissiveRadiance += vec3(0.45, 0.95, 1.7) * step(0.90, lcH) * lcTw * lcNear * lcGlit * lcDust * 4.0;',
          'totalEmissiveRadiance += vec3(0.012, 0.02, 0.05) * lcGlit * lcDust;',
          'totalEmissiveRadiance += vec3(1.0, 0.98, 0.95) * step(0.972, lcH) * lcTw * lcNear * (1.0 - lcDust) * 1.3;',
          // Staub-Scanner: zeigt die letzten Reste, wenn fast alles sauber ist
          'totalEmissiveRadiance += vec3(1.0, 0.42, 0.10) * lcDust * uHint * (0.55 + 0.45 * sin(uTime * 4.0)) * step(length(lcP), uClean);'
        ].join('\n'));
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(W.C[sn].x, 0, W.C[sn].z);
    mesh.receiveShadow = true; mesh.castShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  // ---------- Himmel ----------
  function buildStars() {
    const rnd = U.rng(777), N = 5200;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
    const band = new THREE.Vector3(0.35, 0.6, 0.72).normalize();   // Achse der Milchstraße
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      for (let tries = 0; tries < 20; tries++) {
        const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
        v.set(s * Math.cos(a), u, s * Math.sin(a));
        if (i < N * 0.45) break;
        if (Math.abs(v.dot(band)) < 0.05 + rnd() * 0.22) break;     // Milchstraßen-Band dichter
      }
      pos[i * 3] = v.x * 5000; pos[i * 3 + 1] = v.y * 5000; pos[i * 3 + 2] = v.z * 5000;
      const mag = Math.pow(rnd(), 5.5);
      size[i] = 1.1 + mag * 3.4;
      const b = 0.45 + mag * 2.6 + rnd() * 0.3, tint = rnd();
      col[i * 3] = b * (tint < 0.2 ? 1.0 : tint < 0.45 ? 0.82 : 0.95);
      col[i * 3 + 1] = b * (tint < 0.2 ? 0.86 : 0.92);
      col[i * 3 + 2] = b * (tint < 0.2 ? 0.72 : tint < 0.45 ? 1.0 : 0.95);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: 1 } },
      vertexShader: 'attribute float aSize; attribute vec3 color; varying vec3 vC; uniform float uPx;\nvoid main(){ vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uPx; }',
      fragmentShader: 'varying vec3 vC;\nvoid main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.1, d); gl_FragColor = vec4(vC * a, 1.0); }',
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false; pts.renderOrder = -5;
    return pts;
  }

  function makeEarthTexture() {
    const Wd = 512, Hd = 256;
    const c = document.createElement('canvas'); c.width = Wd; c.height = Hd;
    const g = c.getContext('2d'), img = g.createImageData(Wd, Hd), d = img.data;
    for (let j = 0; j < Hd; j++) for (let i = 0; i < Wd; i++) {
      const u = i / Wd, v = j / Hd, lat = Math.abs(v - 0.5) * 2;
      const land = U.fbm(u * 6, v * 3 + 5, 5, 901, 6) + (0.5 - Math.abs(lat - 0.35)) * 0.08;
      const det = U.fbm(u * 24, v * 12, 3, 902, 24);
      let r, gg, b;
      if (land > 0.535) {
        const dry = U.smoothstep(0.25, 0.0, Math.abs(lat - 0.28)) * 0.8 + det * 0.3;
        r = U.lerp(0.10, 0.50, dry); gg = U.lerp(0.26, 0.40, dry); b = U.lerp(0.09, 0.22, dry);
        const hi = U.smoothstep(0.60, 0.70, land); r = U.lerp(r, 0.36, hi); gg = U.lerp(gg, 0.31, hi); b = U.lerp(b, 0.24, hi);
      } else {
        const deep = U.smoothstep(0.535, 0.40, land);
        r = U.lerp(0.05, 0.012, deep); gg = U.lerp(0.26, 0.09, deep); b = U.lerp(0.48, 0.30, deep);
      }
      const ice = U.smoothstep(0.80, 0.92, lat + det * 0.12);
      r = U.lerp(r, 0.92, ice); gg = U.lerp(gg, 0.95, ice); b = U.lerp(b, 0.98, ice);
      let cl = U.fbm(u * 10 + 3, v * 7 + 1, 5, 903, 10);
      cl = U.smoothstep(0.50, 0.72, cl + (U.fbm(u * 4, v * 3, 2, 904, 4) - 0.5) * 0.35) * 0.92;
      r = U.lerp(r, 1, cl); gg = U.lerp(gg, 1, cl); b = U.lerp(b, 1, cl);
      const k = (j * Wd + i) * 4;
      d[k] = Math.pow(r, 1 / 2.2) * 255; d[k + 1] = Math.pow(gg, 1 / 2.2) * 255; d[k + 2] = Math.pow(b, 1 / 2.2) * 255; d[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.wrapS = THREE.RepeatWrapping;
    return t;
  }

  function buildEarth() {
    const grp = new THREE.Group();
    const R = 470;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: makeEarthTexture() }, sunDir: { value: W.SUN_DIR } },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vP;\nvoid main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: [
        'uniform sampler2D map; uniform vec3 sunDir; varying vec2 vUv; varying vec3 vN; varying vec3 vP;',
        'void main(){',
        ' vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vP);',
        ' vec3 tex = texture2D(map, vUv).rgb; tex = pow(tex, vec3(2.2));',
        ' float l = dot(n, sunDir); float day = smoothstep(-0.08, 0.35, l);',
        ' float fr = pow(1.0 - max(dot(n, v), 0.0), 2.5);',
        ' vec3 col = tex * day * 1.05;',
        ' col += vec3(0.25, 0.5, 1.0) * fr * (0.1 + day) * 0.55;',
        ' col += vec3(0.004, 0.007, 0.016) * (1.0 - day);',
        ' gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 40), mat);
    earth.rotation.set(0.35, 2.2, 0.41);
    grp.add(earth);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.09, 48, 32), new THREE.ShaderMaterial({
      uniforms: { sunDir: { value: W.SUN_DIR } },
      vertexShader: 'varying vec3 vN; varying vec3 vP;\nvoid main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: 'uniform vec3 sunDir; varying vec3 vN; varying vec3 vP;\nvoid main(){ vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vP); float rim = pow(smoothstep(0.0, 0.42, -dot(n, v)), 2.2); float lit = smoothstep(-0.45, 0.35, dot(n, sunDir)); gl_FragColor = vec4(vec3(0.25, 0.55, 1.0) * rim * lit * 0.9, 1.0); }',
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
    }));
    grp.add(halo);
    grp.userData.spin = earth;
    return grp;
  }

  function makeSunTexture() {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    let gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.018, 'rgba(255,255,255,1)');
    gr.addColorStop(0.03, 'rgba(255,250,240,0.42)'); gr.addColorStop(0.06, 'rgba(255,244,228,0.10)');
    gr.addColorStop(0.14, 'rgba(255,240,220,0.028)'); gr.addColorStop(0.32, 'rgba(255,236,214,0.007)'); gr.addColorStop(0.6, 'rgba(255,230,210,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    // Strahlen
    g.globalCompositeOperation = 'lighter';
    g.translate(S / 2, S / 2);
    const rnd = U.rng(31);
    for (let i = 0; i < 14; i++) {
      const ang = i * Math.PI / 7 + rnd() * 0.2, len = S * (0.10 + rnd() * 0.13), wdt = 0.9 + rnd() * 1.2;
      g.save(); g.rotate(ang);
      const lg = g.createLinearGradient(0, 0, len, 0);
      lg.addColorStop(0, 'rgba(255,250,240,0.32)'); lg.addColorStop(1, 'rgba(255,240,220,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(0, -wdt); g.lineTo(len, 0); g.lineTo(0, wdt); g.closePath(); g.fill();
      g.restore();
    }
    return new THREE.CanvasTexture(c);
  }

  // ---------- Felsen ----------
  function rockGeometry(seed) {
    const geo = new THREE.SphereGeometry(1, 12, 9), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n1 = U.fbm(x * 1.3 + y * 0.9 + seed, z * 1.3 - y * 0.7 + seed * 2, 3, seed) - 0.5;
      const n2 = U.fbm(x * 3.1 - y * 1.7 + seed, z * 3.1 + y * 2.3, 2, seed + 5) - 0.5;
      const s = 1 + n1 * 0.85 + n2 * 0.25;
      p.setXYZ(i, x * s * 1.15, y * s * 0.72, z * s);
    }
    geo.computeVertexNormals();
    return geo;
  }

  W.boulders = [];
  const ROCK_MAX = 110;
  let rockMeshes = { 1: [], 2: [] };
  function buildRocks(scene) {
    const geos = [rockGeometry(1), rockGeometry(2), rockGeometry(3)];
    [1, 2].forEach(sn => {
      const t = W.SECTORS[sn].tint;
      const mat = new THREE.MeshStandardMaterial({ color: 0x241f1b, roughness: 0.95, metalness: 0, normalMap: W.normalTex, normalScale: new THREE.Vector2(0.8, 0.8) });
      mat.envMapIntensity = 0; mat.color.setRGB(0.0185 * t[0], 0.0137 * t[1], 0.0109 * t[2]);
      geos.forEach(g => {
        const im = new THREE.InstancedMesh(g, mat, ROCK_MAX);
        im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
        scene.add(im); rockMeshes[sn].push(im);
      });
      fillRocks(sn);
    });
  }
  function fillRocks(sn) {
    const rnd = U.rng(99123 + sn * 7), S = W.S[sn], LIMIT = S.cfg.LIMIT, ox = W.C[sn].x, oz = W.C[sn].z;
    const lists = [[], [], []];
    const tryPlace = (minS, maxS, big) => {
      for (let t = 0; t < 40; t++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (LIMIT + 10);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (sn === 1) {
          if (Math.hypot(x, z) < (big ? 30 : 15)) continue;
          if (Math.hypot(x - 22, z + 8) < 9) continue;
          if (Math.hypot(x - 20, z - 11.5) < 8) continue;
          if (furrowInfo(x, z).d < (big ? 9 : 4.5)) continue;
        } else {
          if (Math.hypot(x, z) < 40) continue;
          if (Math.hypot(x + 8, z - 100) < (big ? 30 : 20)) continue;
        }
        if (passInfo(ox + x, oz + z).d < (big ? 14 : 9)) continue;            // der Pass bleibt frei
        if (big && S.craters.some(c => Math.hypot(c.x - x, c.z - z) < c.R * 1.4)) continue;
        const s = minS + Math.pow(rnd(), 2.0) * (maxS - minS);
        return { x: ox + x, z: oz + z, s, rot: rnd() * 6.28, tilt: (rnd() - 0.5) * 0.5, k: Math.floor(rnd() * 3) };
      }
      return null;
    };
    const nSmall = sn === 1 ? 170 : 260, nBig = sn === 1 ? 9 : 16;
    for (let i = 0; i < nSmall; i++) { const p = tryPlace(0.12, 0.75, false); if (p && lists[p.k].length < ROCK_MAX) lists[p.k].push(p); }
    for (let i = 0; i < nBig; i++) {
      const p = tryPlace(1.3, 2.6, true);
      if (p && lists[p.k].length < ROCK_MAX) { lists[p.k].push(p); W.boulders.push({ x: p.x, z: p.z, r: p.s * 0.95 }); }
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    lists.forEach((list, k) => {
      const im = rockMeshes[sn][k];
      list.forEach((p, i) => {
        e.set(p.tilt, p.rot, p.tilt * 0.6); q.setFromEuler(e);
        sc.set(p.s, p.s, p.s); ps.set(p.x, W.heightAt(p.x, p.z) + p.s * 0.22, p.z);
        m.compose(ps, q, sc); im.setMatrixAt(i, m);
      });
      im.count = list.length; im.instanceMatrix.needsUpdate = true;
    });
  }

  // Schatten der Sonne auf den Krater einstellen, in dem der Spieler ist (samt Pass)
  function fitShadow() {
    const sc = W.sun.shadow.camera, e = W.RIM + 34, c = W.C[W.sec];
    sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 150; sc.far = 800;
    sc.updateProjectionMatrix();
    W.sun.position.copy(W.SUN_DIR).multiplyScalar(440); W.sun.position.x += c.x; W.sun.position.z += c.z;
    W.sun.target.position.set(c.x, 0, c.z); W.sun.target.updateMatrixWorld(); W.sun.updateMatrixWorld();
  }

  // ---------- Aufbau ----------  // ---------- Aufbau ----------
  W.build = function (scene, dustTex, glitTex) {
    // dustTex/glitTex: { 1: Textur, 2: Textur }
    W.tu = {}; W.terrains = {};
    [1, 2].forEach(sn => { W.terrains[sn] = buildTerrain(sn, dustTex[sn], glitTex[sn]); scene.add(W.terrains[sn]); });
    W.terrain = W.terrains[1];
    buildRocks(scene);

    W.sky = new THREE.Group();
    W.stars = buildStars(); W.sky.add(W.stars);
    W.earth = buildEarth(); W.earth.position.copy(W.EARTH_DIR).multiplyScalar(4700); W.sky.add(W.earth);
    // Sonne: Scheibe mit Strahlenkranz, wird immer zur Kamera gedreht
    W.sunSprite = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vP;\nvoid main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'varying vec2 vP;',
        'void main(){ float r = length(vP); float a = atan(vP.y, vP.x);',
        ' float core = smoothstep(0.030, 0.020, r) * 14.0;',
        ' float glow = 0.0011 / (r * r + 0.0007) * (1.0 - smoothstep(0.35, 1.0, r));',
        ' float rays = (pow(abs(cos(a * 3.0 + 0.4)), 60.0) * 0.9 + pow(abs(cos(a * 7.0 + 1.3)), 90.0) * 0.45 + pow(abs(cos(a * 11.0 + 2.1)), 140.0) * 0.25) * exp(-r * 13.0) * 1.6;',
        ' vec3 c = vec3(1.0, 0.97, 0.91) * (core + glow + rays);',
        ' gl_FragColor = vec4(c, 1.0); }'
      ].join('\n'),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
    }));
    W.sunSprite.position.copy(W.SUN_DIR).multiplyScalar(4800); W.sunSprite.scale.set(1300, 1300, 1);
    W.sunSprite.frustumCulled = false;
    W.sky.add(W.sunSprite);
    scene.add(W.sky);

    // Sonne: hartes Licht, lange Schatten
    const sun = new THREE.DirectionalLight(0xfff3e2, 2.9);
    sun.position.copy(W.SUN_DIR).multiplyScalar(440);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.16; sun.shadow.radius = 1.6;
    scene.add(sun); scene.add(sun.target);
    W.sun = sun; fitShadow();
    // Aufhellung: Erdschein von oben, Rückstrahlung vom Boden
    W.hemi = new THREE.HemisphereLight(0x7f95b8, 0x6b5d50, 0.85);
    scene.add(W.hemi);
  };

  W.update = function (t, camera, pxRatio) {
    W.sky.position.copy(camera.position);
    W.sunSprite.quaternion.copy(camera.quaternion);
    W.tu[1].uTime.value = t; W.tu[2].uTime.value = t;
    W.stars.material.uniforms.uPx.value = pxRatio;
    W.earth.userData.spin.rotation.y = 2.2 + t * 0.004;
  };

  LC.World = W;
})(window.LC);
