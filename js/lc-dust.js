'use strict';
/* =========================================================
   Lunar Clean – Staubkarte: wo liegt noch Staub, wo ist geputzt
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World;
  const D = {};
  const N = 1024, SIZE = W.DUST_SIZE, CELL = SIZE / N, CELL_AREA = CELL * CELL;
  const CLEAN_R = 74;          // bis hierhin kann geputzt werden
  const FLOOR = 46;            // darunter ist Staub im Bild nicht mehr zu sehen
  D.N = N; D.KG_PER_M2 = 1.0;  // 1 m² voller Staub = 1 kg

  D.data = new Uint8Array(N * N);
  D.glit = new Uint8Array(N * N);
  D.total = 0;      // Summe aller putzbaren Werte am Anfang
  D.current = 0;    // Summe jetzt
  let dirty = false;

  const toCell = v => (v / SIZE + 0.5) * N;

  D.init = function () {
    const d = D.data, g = D.glit;
    let total = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * CELL - SIZE / 2, z = (j + 0.5) * CELL - SIZE / 2, k = j * N + i;
      d[k] = 255;
      if (Math.hypot(x, z) < CLEAN_R) total += 255;
    }
    // Glitzerstaub in den tiefen Kratern
    W.glitterCraters.forEach(c => {
      const R = c.R * 0.82, i0 = Math.floor(toCell(c.x - R)), i1 = Math.ceil(toCell(c.x + R)), j0 = Math.floor(toCell(c.z - R)), j1 = Math.ceil(toCell(c.z + R));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = (i + 0.5) * CELL - SIZE / 2, z = (j + 0.5) * CELL - SIZE / 2;
        const dd = Math.hypot(x - c.x, z - c.z) / R + (U.fbm(x * 0.5, z * 0.5, 2, 61) - 0.5) * 0.35;
        if (dd < 1) g[j * N + i] = 255 * U.smoothstep(1, 0.8, dd);
      }
    });
    D.total = total;
    D.reset();

    D.tex = new THREE.DataTexture(d, N, N, THREE.LuminanceFormat);
    D.tex.magFilter = D.tex.minFilter = THREE.LinearFilter; D.tex.generateMipmaps = false; D.tex.needsUpdate = true;
    D.glitTex = new THREE.DataTexture(g, N, N, THREE.LuminanceFormat);
    D.glitTex.magFilter = D.glitTex.minFilter = THREE.LinearFilter; D.glitTex.generateMipmaps = false; D.glitTex.needsUpdate = true;
  };

  // Ausgangszustand: alles staubig, nur die Absturzstelle ist blank gescheuert
  D.reset = function () {
    const d = D.data;
    d.fill(255);
    const fur = W.furrow;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * CELL - SIZE / 2, z = (j + 0.5) * CELL - SIZE / 2;
      if (x > 14 || x < -66 || z > 14 || z < -32) continue;
      const f = W.furrowInfo(x, z);
      const n = (U.fbm(x * 0.6, z * 0.6, 3, 71) - 0.5) * 1.6;
      let keep = 1;
      // Furche
      const wdt = 1.2 + 2.0 * f.t;
      keep = Math.min(keep, U.smoothstep(wdt - 0.6, wdt + 1.3, f.d + n));
      // rund um das Wrack
      const ex = (x + 4) / 9.5, ez = (z + 1.5) / 6.0;
      keep = Math.min(keep, U.smoothstep(0.75, 1.15, Math.sqrt(ex * ex + ez * ez) + n * 0.22));
      if (keep < 1) d[j * N + i] = Math.round(255 * keep);
    }
    D.recount();
    dirty = true;
  };

  // Unsichtbare Reste entfernen (ältere Spielstände)
  D.normalize = function () {
    const d = D.data; let ch = false;
    for (let k = 0; k < d.length; k++) if (d[k] > 0 && d[k] < FLOOR) { d[k] = 0; ch = true; }
    if (ch) { D.recount(); dirty = true; }
  };
  // Fläche unter einem Bauwerk staubfrei machen. rot = Drehung des Rechtecks; hz = 0 → Kreis mit Radius hx
  D.clearArea = function (x, z, hx, hz, rot) {
    const d = D.data, R = Math.max(hx, hz || 0) * 1.5, c = Math.cos(rot || 0), s = Math.sin(rot || 0);
    const i0 = Math.max(0, Math.floor(toCell(x - R))), i1 = Math.min(N - 1, Math.ceil(toCell(x + R))), j0 = Math.max(0, Math.floor(toCell(z - R))), j1 = Math.min(N - 1, Math.ceil(toCell(z + R)));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = (i + 0.5) * CELL - SIZE / 2 - x, dz = (j + 0.5) * CELL - SIZE / 2 - z;
      const inside = hz ? (Math.abs(dx * c - dz * s) < hx && Math.abs(dx * s + dz * c) < hz) : dx * dx + dz * dz < hx * hx;
      if (inside) d[j * N + i] = 0;
    }
    D.recount(); dirty = true;
  };

  D.recount = function () {
    const d = D.data; let cur = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * CELL - SIZE / 2, z = (j + 0.5) * CELL - SIZE / 2;
      if (x * x + z * z < CLEAN_R * CLEAN_R) cur += d[j * N + i];
    }
    D.current = cur;
  };

  D.percentClean = function () { return D.total ? U.clamp(1 - D.current / D.total, 0, 1) : 0; };

  D.amountAt = function (x, z) {
    const i = Math.floor(toCell(x)), j = Math.floor(toCell(z));
    if (i < 0 || j < 0 || i >= N || j >= N) return 1;
    return D.data[j * N + i] / 255;
  };
  D.glitterAt = function (x, z) {
    const i = Math.floor(toCell(x)), j = Math.floor(toCell(z));
    if (i < 0 || j < 0 || i >= N || j >= N) return 0;
    return D.glit[j * N + i] / 255;
  };

  // Saugt Staub im Kreis ab. rate = wie schnell (1 = eine volle Schicht pro Sekunde).
  // room = wie viel kg noch in den Tank passen. Gibt {n, g} in kg zurück.
  const res = { n: 0, g: 0 };
  D.suck = function (x, z, radius, rate, dt, room) {
    res.n = 0; res.g = 0;
    if (room <= 0) return res;
    if (x * x + z * z > (CLEAN_R + radius) * (CLEAN_R + radius)) return res;
    const d = D.data, g = D.glit;
    const ci = toCell(x), cj = toCell(z), rc = radius / CELL;
    const i0 = Math.max(0, Math.floor(ci - rc)), i1 = Math.min(N - 1, Math.ceil(ci + rc));
    const j0 = Math.max(0, Math.floor(cj - rc)), j1 = Math.min(N - 1, Math.ceil(cj + rc));
    const base = rate * dt * 255, kgPer = CELL_AREA * D.KG_PER_M2 / 255;
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
        let take = base * f;
        take = Math.floor(take + Math.random());
        if (take <= 0) continue;
        if (take > v || v - take < FLOOR) take = v;      // kein unsichtbarer Rest bleibt liegen
        d[k] = v - take;
        const gl = g[k] / 255;
        sumG += take * gl; sumN += take * (1 - gl);
      }
    }
    if (sumN + sumG > 0) {
      D.current -= (sumN + sumG);
      dirty = true;
      res.n = sumN * kgPer; res.g = sumG * kgPer;
    }
    return res;
  };

  D.flush = function () { if (dirty) { D.tex.needsUpdate = true; dirty = false; } };

  // ---------- Speichern: Lauflängen-Kodierung ----------
  D.serialize = function () {
    const d = D.data, out = [];
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
  D.deserialize = function (b64) {
    try {
      const s = atob(b64), d = D.data; let k = 0;
      for (let i = 0; i + 2 < s.length; i += 3) {
        const v = s.charCodeAt(i), run = (s.charCodeAt(i + 1) << 8) | s.charCodeAt(i + 2);
        if (k + run > d.length) return false;
        d.fill(v, k, k + run); k += run;
      }
      if (k !== d.length) return false;
      D.recount(); dirty = true;
      return true;
    } catch (e) { return false; }
  };

  LC.Dust = D;
})(window.LC);
