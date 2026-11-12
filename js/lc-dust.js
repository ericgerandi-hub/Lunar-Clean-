'use strict';
/* =========================================================
   Lunar Clean – Staubkarten: wo liegt noch Staub, wo ist geputzt.
   Offene Welt: jeder Krater (Sektor) hat seine eigene Karte, beide
   sind immer da. Alle Funktionen nehmen Welt-Koordinaten.
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World;
  const D = {};
  const N = 1024;
  const FLOOR = 46;            // darunter ist Staub im Bild nicht mehr zu sehen
  D.N = N; D.KG_PER_M2 = 1.0;  // 1 m² voller Staub = 1 kg
  D.maps = {};

  function makeMap(n) {
    const c = W.SECTORS[n], m = { n, SIZE: c.SIZE, CELL: c.SIZE / N, CLEAN_R: c.CLEAN, cx: W.C[n].x, cz: W.C[n].z, data: new Uint8Array(N * N), glit: new Uint8Array(N * N), total: 0, current: 0, dirty: true };
    const CELL = m.CELL, SIZE = m.SIZE, g = m.glit, toCell = v => (v / SIZE + 0.5) * N;
    let total = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * CELL - SIZE / 2, z = (j + 0.5) * CELL - SIZE / 2;
      if (x * x + z * z < m.CLEAN_R * m.CLEAN_R) total += 255;
    }
    m.total = total;
    W.S[n].glitterCraters.forEach(k => {
      const R = k.R * 0.82, i0 = Math.max(0, Math.floor(toCell(k.x - R))), i1 = Math.min(N - 1, Math.ceil(toCell(k.x + R))), j0 = Math.max(0, Math.floor(toCell(k.z - R))), j1 = Math.min(N - 1, Math.ceil(toCell(k.z + R)));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = (i + 0.5) * CELL - SIZE / 2, z = (j + 0.5) * CELL - SIZE / 2;
        const dd = Math.hypot(x - k.x, z - k.z) / R + (U.fbm(x * 0.5, z * 0.5, 2, 61) - 0.5) * 0.35;
        if (dd < 1) g[j * N + i] = 255 * U.smoothstep(1, 0.8, dd);
      }
    });
    m.tex = new THREE.DataTexture(m.data, N, N, THREE.LuminanceFormat);
    m.tex.magFilter = m.tex.minFilter = THREE.LinearFilter; m.tex.generateMipmaps = false; m.tex.needsUpdate = true;
    m.glitTex = new THREE.DataTexture(g, N, N, THREE.LuminanceFormat);
    m.glitTex.magFilter = m.glitTex.minFilter = THREE.LinearFilter; m.glitTex.generateMipmaps = false; m.glitTex.needsUpdate = true;
    return m;
  }
  const mapAt = (x, z) => D.maps[W.secAt(x, z)];
  const cur = () => D.maps[W.sec];

  D.init = function () {
    D.maps[1] = makeMap(1); D.maps[2] = makeMap(2);
    D.reset();
    D.tex = { 1: D.maps[1].tex, 2: D.maps[2].tex }; D.glitTex = { 1: D.maps[1].glitTex, 2: D.maps[2].glitTex };
  };
  // Karte des Sektors, in dem der Spieler steht (für Karte und Tests)
  Object.defineProperty(D, 'data', { get: () => cur().data });
  Object.defineProperty(D, 'glit', { get: () => cur().glit });

  function recount(m) {
    const d = m.data, R2 = m.CLEAN_R * m.CLEAN_R; let c = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * m.CELL - m.SIZE / 2, z = (j + 0.5) * m.CELL - m.SIZE / 2;
      if (x * x + z * z < R2) c += d[j * N + i];
    }
    m.current = c; m.dirty = true;
  }
  D.recount = function (n) { if (n) recount(D.maps[n]); else { recount(D.maps[1]); recount(D.maps[2]); } };

  // Ausgangszustand: alles staubig, nur die Absturzstelle ist blank gescheuert (n weglassen = beide Sektoren)
  D.reset = function (n) {
    if (!n) { D.reset(1); D.reset(2); return; }
    const m = D.maps[n], d = m.data, CELL = m.CELL, SIZE = m.SIZE;
    d.fill(255);
    if (n === 1) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * CELL - SIZE / 2, z = (j + 0.5) * CELL - SIZE / 2;
      if (x > 14 || x < -66 || z > 14 || z < -32) continue;
      const f = W.furrowInfo(x, z);
      const nz = (U.fbm(x * 0.6, z * 0.6, 3, 71) - 0.5) * 1.6;
      let keep = 1;
      const wdt = 1.2 + 2.0 * f.t;                                         // Furche
      keep = Math.min(keep, U.smoothstep(wdt - 0.6, wdt + 1.3, f.d + nz));
      const ex = (x + 4) / 9.5, ez = (z + 1.5) / 6.0;                      // rund um das Wrack
      keep = Math.min(keep, U.smoothstep(0.75, 1.15, Math.sqrt(ex * ex + ez * ez) + nz * 0.22));
      if (keep < 1) d[j * N + i] = Math.round(255 * keep);
    }
    recount(m);
  };

  // Unsichtbare Reste entfernen (ältere Spielstände)
  D.normalize = function () {
    [1, 2].forEach(n => {
      const m = D.maps[n], d = m.data; let ch = false;
      for (let k = 0; k < d.length; k++) if (d[k] > 0 && d[k] < FLOOR) { d[k] = 0; ch = true; }
      if (ch) recount(m);
    });
  };
  // Fläche unter einem Bauwerk staubfrei machen (Welt-Koordinaten). rot = Drehung des Rechtecks; hz = 0 → Kreis mit Radius hx
  // strip = [x2, z2]: stattdessen ein Streifen von (x, z) nach (x2, z2) mit halber Breite hx
  D.clearArea = function (x, z, hx, hz, rot, strip) {
    [1, 2].forEach(n => {
      const m = D.maps[n], d = m.data, CELL = m.CELL, SIZE = m.SIZE, toCell = v => (v / SIZE + 0.5) * N;
      const lx = x - m.cx, lz = z - m.cz, R = Math.max(hx, hz || 0) * 1.5, c = Math.cos(rot || 0), s = Math.sin(rot || 0);
      let x0 = lx - R, x1 = lx + R, z0 = lz - R, z1 = lz + R, sx = 0, sz = 0, sl2 = 1;
      if (strip) { sx = strip[0] - x; sz = strip[1] - z; sl2 = sx * sx + sz * sz || 1; x0 = Math.min(lx, lx + sx) - hx; x1 = Math.max(lx, lx + sx) + hx; z0 = Math.min(lz, lz + sz) - hx; z1 = Math.max(lz, lz + sz) + hx; }
      if (x1 < -SIZE / 2 || x0 > SIZE / 2 || z1 < -SIZE / 2 || z0 > SIZE / 2) return;
      const i0 = Math.max(0, Math.floor(toCell(x0))), i1 = Math.min(N - 1, Math.ceil(toCell(x1))), j0 = Math.max(0, Math.floor(toCell(z0))), j1 = Math.min(N - 1, Math.ceil(toCell(z1)));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * CELL - SIZE / 2 - lx, dz = (j + 0.5) * CELL - SIZE / 2 - lz;
        let inside;
        if (strip) { const t = U.clamp((dx * sx + dz * sz) / sl2, 0, 1), ex = dx - sx * t, ez = dz - sz * t; inside = ex * ex + ez * ez < hx * hx; }
        else inside = hz ? (Math.abs(dx * c - dz * s) < hx && Math.abs(dx * s + dz * c) < hz) : dx * dx + dz * dz < hx * hx;
        if (inside) d[j * N + i] = 0;
      }
      recount(m);
    });
  };

  D.percentOf = function (n) { const m = D.maps[n]; return m.total > 0 ? 1 - m.current / m.total : 0; };
  D.percentClean = function () { return D.percentOf(W.sec); };

  // Letzte Staubreste in Sektor n (Vorgabe: der des Spielers): in 4-m-Feldern zusammengefasst, die nächsten zuerst
  D.rests = function (px, pz, max, n) {
    const m = D.maps[n || W.sec], SIZE = m.SIZE, CELL = m.CELL, BS = 4, nb = Math.ceil(SIZE / BS), sum = new Float32Array(nb * nb), sx = new Float32Array(nb * nb), sz = new Float32Array(nb * nb), d = m.data, R2 = m.CLEAN_R * m.CLEAN_R;
    for (let j = 0; j < N; j++) {
      const z = (j + 0.5) * CELL - SIZE / 2, bj = Math.min(nb - 1, Math.floor((z + SIZE / 2) / BS)) * nb, row = j * N;
      for (let i = 0; i < N; i++) {
        const v = d[row + i]; if (!v) continue;
        const x = (i + 0.5) * CELL - SIZE / 2; if (x * x + z * z >= R2) continue;
        const b = bj + Math.min(nb - 1, Math.floor((x + SIZE / 2) / BS));
        sum[b] += v; sx[b] += v * x; sz[b] += v * z;
      }
    }
    const all = [];
    for (let b = 0; b < sum.length; b++) if (sum[b] > 0) { const x = sx[b] / sum[b] + m.cx, z = sz[b] / sum[b] + m.cz; all.push({ x, z, d: Math.hypot(x - px, z - pz), kg: sum[b] / 255 * CELL * CELL * D.KG_PER_M2 }); }
    all.sort((a, b) => a.d - b.d);
    // Felder, die dicht beieinander liegen, sind ein Fleck
    const out = [];
    all.forEach(r => { for (let i = 0; i < out.length; i++) if (Math.hypot(out[i].x - r.x, out[i].z - r.z) < 6) { out[i].kg += r.kg; return; } out.push(r); });
    out.total = out.length;
    if (out.length > max) out.length = max;
    return out;
  };

  // nächste staubige Stelle zu (px, pz) im selben Sektor; avoid = [{x, z, r}] wird ausgelassen (für die Putzroboter).
  // ax, az, aw: Stellen nahe (ax, az) werden bevorzugt (aw = Gewicht)
  const near = { x: 0, z: 0 };
  // only = [[{x, z, r}, …], …]: die Stelle muss in jeder Gruppe in mindestens einem Kreis liegen (Lichtmast, Signalbake)
  D.nearest = function (wx, wz, avoid, wax, waz, aw, only) {
    aw = aw || 0; const no = only ? only.length : 0;
    const m = mapAt(wx, wz), SIZE = m.SIZE, CELL = m.CELL, px = wx - m.cx, pz = wz - m.cz, ax = (wax || 0) - m.cx, az = (waz || 0) - m.cz;
    const d = m.data, R2 = m.CLEAN_R * m.CLEAN_R, na = avoid ? avoid.length : 0; let best = 1e18, bx = 0, bz = 0;
    for (let j = 0; j < N; j++) {
      const z = (j + 0.5) * CELL - SIZE / 2, dz2 = (z - pz) * (z - pz) + aw * (z - az) * (z - az); if (dz2 >= best) continue;
      const row = j * N;
      for (let i = 0; i < N; i++) {
        if (!d[row + i]) continue;
        const x = (i + 0.5) * CELL - SIZE / 2, q = (x - px) * (x - px) + aw * (x - ax) * (x - ax) + dz2;
        if (q >= best || x * x + z * z >= R2) continue;
        let ok = true;
        for (let a = 0; a < na; a++) { const v = avoid[a], ex = x + m.cx - v.x, ez = z + m.cz - v.z; if (ex * ex + ez * ez < v.r * v.r) { ok = false; break; } }
        for (let o = 0; ok && o < no; o++) {
          const grp = only[o]; let hit = false;
          for (let c = 0; c < grp.length; c++) { const v = grp[c], ex = x + m.cx - v.x, ez = z + m.cz - v.z; if (ex * ex + ez * ez < v.r * v.r) { hit = true; break; } }
          ok = hit;
        }
        if (ok) { best = q; bx = x; bz = z; }
      }
    }
    if (best > 1e17) return null;
    near.x = bx + m.cx; near.z = bz + m.cz; return near;
  };

  // Wie viel Staub (0..1) bzw. Glitzerstaub liegt an einer Stelle?
  function cellAt(m, wx, wz) {
    const i = Math.floor(((wx - m.cx) / m.SIZE + 0.5) * N), j = Math.floor(((wz - m.cz) / m.SIZE + 0.5) * N);
    return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i;
  }
  D.amountAt = function (x, z) { const m = mapAt(x, z), k = cellAt(m, x, z); return k < 0 ? 1 : m.data[k] / 255; };
  D.glitterAt = function (x, z) { const m = mapAt(x, z), k = cellAt(m, x, z); return k < 0 ? 0 : m.glit[k] / 255; };

  // Staub im Umkreis wegnehmen. Gibt { n, g } in kg zurück (normaler Staub, Glitzerstaub)
  const res = { n: 0, g: 0 };
  D.suck = function (wx, wz, radius, rate, dt, room) {
    res.n = 0; res.g = 0;
    if (room <= 0) return res;
    const m = mapAt(wx, wz), SIZE = m.SIZE, CELL = m.CELL, CLEAN_R = m.CLEAN_R, x = wx - m.cx, z = wz - m.cz;
    if (x * x + z * z > (CLEAN_R + radius) * (CLEAN_R + radius)) return res;
    const d = m.data, g = m.glit;
    const ci = (x / SIZE + 0.5) * N, cj = (z / SIZE + 0.5) * N, rc = radius / CELL;
    const i0 = Math.max(0, Math.floor(ci - rc)), i1 = Math.min(N - 1, Math.ceil(ci + rc));
    const j0 = Math.max(0, Math.floor(cj - rc)), j1 = Math.min(N - 1, Math.ceil(cj + rc));
    const base = rate * dt * 255, kgPer = CELL * CELL * D.KG_PER_M2 / 255;
    let sumN = 0, sumG = 0;
    const lim2 = CLEAN_R * CLEAN_R;
    for (let j = j0; j <= j1; j++) {
      const z2 = (j + 0.5) * CELL - SIZE / 2;
      for (let i = i0; i <= i1; i++) {
        const k = j * N + i, v = d[k];
        if (v === 0) continue;
        const dx = (i + 0.5 - ci) / rc, dz = (j + 0.5 - cj) / rc, q = dx * dx + dz * dz;
        if (q >= 1) continue;
        const x2 = (i + 0.5) * CELL - SIZE / 2;
        if (x2 * x2 + z2 * z2 > lim2) continue;
        const f = 1 - q * q;
        let take = Math.floor(base * f + Math.random());
        if (take <= 0) continue;
        if (take > v || v - take < FLOOR) take = v;      // kein unsichtbarer Rest bleibt liegen
        d[k] = v - take;
        const gl = g[k] / 255;
        sumG += take * gl; sumN += take * (1 - gl);
      }
    }
    if (sumN + sumG > 0) {
      m.current -= (sumN + sumG); m.dirty = true;
      res.n = sumN * kgPer; res.g = sumG * kgPer;
    }
    return res;
  };

  D.flush = function () { for (let n = 1; n <= 2; n++) { const m = D.maps[n]; if (m.dirty) { m.tex.needsUpdate = true; m.dirty = false; } } };

  // ---------- Speichern: Lauflängen-Kodierung, je Sektor ----------
  D.serialize = function (n) {
    const d = D.maps[n].data, out = [];
    // grob runden, damit der Spielstand klein bleibt
    const qz = x => (x < 20 ? 0 : x > 235 ? 255 : (x & 0xF0) | 8);
    let v = qz(d[0]), run = 1;
    for (let k = 1; k < d.length; k++) {
      const c = qz(d[k]);
      if (c === v && run < 65535) run++;
      else { out.push(v, run >> 8, run & 255); v = c; run = 1; }
    }
    out.push(v, run >> 8, run & 255);
    let s = '';
    const CH = 8190;
    for (let i = 0; i < out.length; i += CH) s += String.fromCharCode.apply(null, out.slice(i, i + CH));
    return btoa(s);
  };
  D.deserialize = function (n, b64) {
    try {
      const s = atob(b64), m = D.maps[n], d = new Uint8Array(N * N); let k = 0;
      for (let i = 0; i + 2 < s.length; i += 3) {
        const v = s.charCodeAt(i), run = (s.charCodeAt(i + 1) << 8) | s.charCodeAt(i + 2);
        if (k + run > d.length) return false;
        d.fill(v, k, k + run); k += run;
      }
      if (k !== d.length) return false;
      m.data.set(d); recount(m);
      return true;
    } catch (e) { return false; }
  };

  LC.Dust = D;
})(window.LC);
