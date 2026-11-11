'use strict';
/* =========================================================
   Lunar Clean – Hilfsfunktionen: Zufall, Rauschen, Texturen
   ========================================================= */
window.LC = window.LC || {};
(function (LC) {
  const U = {};

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = t => t * t * (3 - 2 * t);
  U.smoothstep = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // Fester Zufall (immer dieselbe Welt)
  U.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  function hash2(ix, iz, seed) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  U.hash2 = hash2;

  // Wert-Rauschen, optional kachelbar (period > 0)
  function vnoise(x, z, seed, period) {
    let ix = Math.floor(x), iz = Math.floor(z);
    const fx = U.smooth(x - ix), fz = U.smooth(z - iz);
    let ix1 = ix + 1, iz1 = iz + 1;
    if (period) {
      ix = ((ix % period) + period) % period; iz = ((iz % period) + period) % period;
      ix1 = ((ix1 % period) + period) % period; iz1 = ((iz1 % period) + period) % period;
    }
    const a = hash2(ix, iz, seed), b = hash2(ix1, iz, seed), c = hash2(ix, iz1, seed), d = hash2(ix1, iz1, seed);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }
  U.vnoise = vnoise;

  U.fbm = function (x, z, oct, seed, period) {
    let s = 0, a = 0.5, n = 0, f = 1;
    for (let i = 0; i < oct; i++) {
      s += a * vnoise(x * f, z * f, seed + i * 17, period ? period * f : 0);
      n += a; a *= 0.5; f *= 2;
    }
    return s / n;
  };

  // Text auf eine Textur schreiben (Schilder, Bildschirme)
  U.textTexture = function (lines, opt) {
    opt = opt || {};
    const w = opt.w || 512, h = opt.h || 256;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = opt.bg || '#06131a'; g.fillRect(0, 0, w, h);
    if (opt.border) { g.strokeStyle = opt.border; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((ln, i) => {
      const size = ln.size || 48;
      g.font = (ln.bold === false ? '' : 'bold ') + size + 'px "Bahnschrift","DIN Alternate","Segoe UI",Arial,sans-serif';
      g.fillStyle = ln.color || '#7fe9ff';
      g.fillText(ln.text, w / 2, ln.y != null ? ln.y : h * (i + 1) / (n + 1));
    });
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    return t;
  };

  // Weicher runder Punkt (für Partikel, Sonne, Leuchten)
  U.glowTexture = function (size, stops) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(s => gr.addColorStop(s[0], s[1]));
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c);
    return t;
  };

  LC.U = U;
})(window.LC);
