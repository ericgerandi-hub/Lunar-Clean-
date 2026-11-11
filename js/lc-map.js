'use strict';
/* =========================================================
   Lunar Clean – Minimap (oben rechts) und große Karte (Taste M)
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World, D = LC.Dust, B = LC.Base;
  const M = { open: false };
  const N = 256;
  // Die Karte zeigt den Krater, in dem man gerade steht. OX/OZ = dessen Mittelpunkt in der Welt;
  // gezeichnet wird relativ dazu, alle Punkte (Spieler, Marken, Bauten) kommen in Welt-Koordinaten herein.
  let SIZE = W.DUST_SIZE, CLEAN_R = W.CLEAN, OX = 0, OZ = 0;      // ändern sich mit dem Sektor (M.reconfigure)
  M.home = { x: 0, z: 0 };                          // wohin der gelbe Pfeil der Minimap zeigt
  const MINI = 176, VIEW = 34;         // Größe der Minimap in Pixeln, sichtbarer Radius in Metern
  let img, ictx, idata, shade, mini, mctx, big, bctx, dpr = 1, buildT = 0, bigSize = 600;
  // Ansicht der großen Karte: Mitte (Welt), Pixel pro Meter; Markierungen
  let vx = 0, vz = 0, vs = 3, minS = 2, drag = null;
  M.marks = []; M.MAX_MARKS = 10; M.onMarks = null;
  const lim = () => W.RIM + 14;

  M.init = function () {
    img = document.createElement('canvas'); img.width = img.height = N;
    ictx = img.getContext('2d'); idata = ictx.createImageData(N, N);
    // Schattierung des Geländes (einmal berechnen): Krater und Hänge werden sichtbar
    shade = new Float32Array(N * N);
    M.reconfigure();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    mini = document.getElementById('mini'); mini.width = mini.height = Math.round(MINI * dpr); mctx = mini.getContext('2d');
    big = document.getElementById('bigmap-c'); bctx = big.getContext('2d');
    const toWorld = e => { const r = big.getBoundingClientRect(); return { x: OX + vx + (e.clientX - r.left - r.width / 2) / vs, z: OZ + vz + (e.clientY - r.top - r.height / 2) / vs }; };
    big.addEventListener('mousedown', e => { if (e.button === 0) drag = { x: e.clientX, y: e.clientY, moved: 0 }; e.preventDefault(); });
    window.addEventListener('mousemove', e => {
      if (!drag || !M.open) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      vx = U.clamp(vx - dx / vs, -lim(), lim()); vz = U.clamp(vz - dy / vs, -lim(), lim());
    });
    window.addEventListener('mouseup', e => {
      if (!drag || !M.open) { drag = null; return; }
      const click = drag.moved < 5; drag = null;
      if (!click || e.target !== big) return;
      const w = toWorld(e);
      const hit = M.marks.findIndex(m => Math.hypot(m.x - w.x, m.z - w.z) * vs < 14);
      if (hit >= 0) M.marks.splice(hit, 1);
      else if (!M.armed) return;
      else if (M.marks.length < M.MAX_MARKS) M.marks.push({ x: +w.x.toFixed(1), z: +w.z.toFixed(1) });
      else { M.marks.shift(); M.marks.push({ x: +w.x.toFixed(1), z: +w.z.toFixed(1) }); }
      M.setArmed(false);
      if (M.onMarks) M.onMarks();
    });
    document.getElementById('btn-mark').addEventListener('click', () => M.setArmed(!M.armed));
    document.getElementById('btn-markclr').addEventListener('click', () => { M.marks.length = 0; M.setArmed(false); if (M.onMarks) M.onMarks(); });
    big.addEventListener('wheel', e => {
      e.preventDefault();
      const w = toWorld(e), f = e.deltaY < 0 ? 1.2 : 1 / 1.2, ns = U.clamp(vs * f, minS, 22);
      // um den Mauszeiger herum zoomen
      const lx = w.x - OX, lz = w.z - OZ;
      vx = U.clamp(lx - (lx - vx) * vs / ns, -lim(), lim()); vz = U.clamp(lz - (lz - vz) * vs / ns, -lim(), lim()); vs = ns;
    }, { passive: false });
    big.addEventListener('contextmenu', e => e.preventDefault());
    M.rebuild();
  };

  // Schattierung des Geländes für den aktiven Sektor berechnen
  M.reconfigure = function () {
    SIZE = W.DUST_SIZE; CLEAN_R = W.CLEAN; OX = W.C[W.sec].x; OZ = W.C[W.sec].z;
    if (!shade) return;
    const c = SIZE / N, sx = W.SUN_DIR.x, sz = W.SUN_DIR.z;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = OX + (i + 0.5) * c - SIZE / 2, z = OZ + (j + 0.5) * c - SIZE / 2;
      const dx = W.heightAt(x + 0.6, z) - W.heightAt(x - 0.6, z), dz = W.heightAt(x, z + 0.6) - W.heightAt(x, z - 0.6);
      shade[j * N + i] = U.clamp(1 - (dx * sx + dz * sz) * 1.5, 0.45, 1.5);
    }
    if (ictx) M.rebuild();
  };

  // Kartenbild aus der Staubkarte neu zeichnen
  M.rebuild = function () {
    const d = idata.data, src = D.data, gl = D.glit, f = D.N / N, c = SIZE / N;
    const tintR = Math.min(1.5, W.cfg.tint[0]), tintG = W.cfg.tint[1], tintB = W.cfg.tint[2];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let sum = 0;
      const j0 = j * f, i0 = i * f;
      for (let b = 0; b < f; b += 2) for (let a = 0; a < f; a += 2) sum += src[(j0 + b) * D.N + i0 + a];
      const dust = sum / (f * f / 4) / 255, g = gl[(j0 + 2) * D.N + i0 + 2] / 255;
      const x = (i + 0.5) * c - SIZE / 2, z = (j + 0.5) * c - SIZE / 2, r = Math.sqrt(x * x + z * z);
      const sh = shade[j * N + i];
      let cr = 64 * tintR, cg = 55 * tintG, cb = 48 * tintB;           // Staub
      if (g > 0.3) { cr = U.lerp(cr, 96, g); cg = U.lerp(cg, 88, g); cb = U.lerp(cb, 205, g); }  // Glitzerstaub
      cr = U.lerp(214, cr, dust); cg = U.lerp(224, cg, dust); cb = U.lerp(232, cb, dust);        // geputzt = hell
      const edge = r > CLEAN_R ? 0.55 : 1;
      const k = (j * N + i) * 4;
      d[k] = Math.min(255, cr * sh * edge); d[k + 1] = Math.min(255, cg * sh * edge); d[k + 2] = Math.min(255, cb * sh * edge); d[k + 3] = 255;
    }
    ictx.putImageData(idata, 0, 0);
  };

  function icons(ctx, s, labels, rot) {
    // s = Pixel pro Meter; Ursprung = Weltmitte
    const dot = (x, z, col, r, txt, shape) => {
      ctx.save(); ctx.translate(x * s, z * s);
      ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 2;
      ctx.beginPath();
      if (shape === 'sq') ctx.rect(-r, -r, r * 2, r * 2); else ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      if (labels && txt) {
        ctx.rotate(-(rot || 0));
        ctx.font = '600 13px "Bahnschrift","Segoe UI",Arial,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(txt, r + 6, 0); ctx.fillStyle = '#fff'; ctx.fillText(txt, r + 6, 0);
      }
      ctx.restore();
    };
    ctx.save(); ctx.translate(-OX * s, -OZ * s);        // ab hier Welt-Koordinaten
    // der Pass zum anderen Krater
    ctx.strokeStyle = W.open ? 'rgba(200,160,255,.5)' : 'rgba(255,90,60,.4)'; ctx.lineWidth = Math.max(3, W.PASS.w * 1.6 * s); ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(W.PASS.a.x * s, W.PASS.a.z * s); ctx.lineTo(W.PASS.b.x * s, W.PASS.b.z * s); ctx.stroke();
    if (W.sec === 1) {
    // Wrack als Strich
    const f = W.furrow, cx = f.b.x - f.dir.x * 3.2, cz = f.b.z - f.dir.z * 3.2;
    ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = Math.max(3, 3.6 * s); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo((cx - f.dir.x * 5) * s, (cz - f.dir.z * 5) * s); ctx.lineTo((cx + f.dir.x * 5) * s, (cz + f.dir.z * 5) * s); ctx.stroke();
    ctx.strokeStyle = '#c9581a'; ctx.lineWidth = Math.max(1.5, 1.2 * s);
    ctx.beginPath(); ctx.moveTo((cx + f.dir.x * 1.5) * s, (cz + f.dir.z * 1.5) * s); ctx.lineTo((cx + f.dir.x * 3) * s, (cz + f.dir.z * 3) * s); ctx.stroke();
    // Landeplatz
    ctx.strokeStyle = '#e8b43a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(B.pad.x * s, B.pad.z * s, B.pad.r * s, 0, Math.PI * 2); ctx.stroke();
    if (labels) dot(B.pad.x, B.pad.z, '#e8b43a', 3, 'Landeplatz');
    dot(B.shop.x, B.shop.z, '#6fe6ff', labels ? 6 : 4.5, 'Werkstatt', 'sq');
    dot(B.silo.x, B.silo.z, '#ffbf5a', labels ? 7 : 5.5, 'Staublager');
    }
    const tp = B.portals[W.sec];
    dot(tp.x, tp.z, '#c8a0ff', labels ? 6 : 4.5, W.sec === 1 ? 'Pass nach Sektor 2' : 'Pass zur Basis', 'sq');
    const BGm = LC.Buggy, SKm = LC.Sacks;
    if (BGm) {
      ctx.strokeStyle = '#e0aa22'; ctx.lineWidth = 2; ctx.save(); const st = BGm.stations[W.sec];
      ctx.translate(st.x * s, st.z * s); ctx.rotate(-st.rot); ctx.strokeRect(-2.7 * s, -4 * s, 5.4 * s, 8 * s); ctx.restore();
      if (labels) dot(st.x, st.z, '#e0aa22', 3, W.sec === 1 ? 'Fahrzeug-Entladung' : 'Außenposten: Staub-Annahme');
      if (BGm.here()) dot(BGm.pos.x, BGm.pos.z, '#59f08f', labels ? 6 : 4.5, 'Buggy', 'sq');
    }
    if (SKm) SKm.list.forEach(k => dot(k.x, k.z, '#d8b98a', labels ? 3.5 : 2.6));
    if (LC.Robots) LC.Robots.list.forEach(r => {
      if (r.packed) return;
      ctx.save(); ctx.translate(r.x * s, r.z * s); ctx.rotate(-r.h);
      const q = labels ? 7 : 5;
      ctx.fillStyle = r.state === 'home' || r.state === 'unload' ? '#ffb040' : '#59f08f'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -q); ctx.lineTo(q * 0.8, q * 0.7); ctx.lineTo(-q * 0.8, q * 0.7); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
    });
    (M.rests || []).forEach(r => {
      ctx.save(); ctx.translate(r.x * s, r.z * s);
      const k = 0.5 + 0.5 * Math.sin(performance.now() / 180), rr = labels ? 9 : 6;
      ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, rr + k * 3, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = '#ff8a1e'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 0, rr + k * 3, 0, 6.283); ctx.stroke();
      ctx.fillStyle = '#ffb060'; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, 6.283); ctx.fill();
      ctx.restore();
    });
    if (LC.MP && LC.MP.active) LC.MP.each(p => dot(p.x, p.z, p.css, labels ? 6 : 4.5, p.name));
    if (labels) W.glitterCraters.forEach(c => dot(OX + c.x, OZ + c.z + c.R * 0.95, 'rgba(0,0,0,0)', 0, 'Glitzerstaub'));
    M.marks.forEach((m, i) => drawMark(ctx, s, labels, m, i));
    ctx.restore();
  }

  function arrow(ctx, size) {
    ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.72, size * 0.8); ctx.lineTo(0, size * 0.38); ctx.lineTo(-size * 0.72, size * 0.8); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
  }

  // Markier-Modus: nach dem Klick auf den Knopf setzt der nächste Klick auf die Karte eine Markierung
  M.armed = false;
  M.setArmed = function (on) {
    M.armed = on; const b = document.getElementById('btn-mark');
    b.classList.toggle('pri', on); b.textContent = on ? 'Jetzt auf die Karte klicken …' : '＋ Markierung setzen';
    big.style.cursor = on ? 'crosshair' : 'grab';
  };

  M.setOpen = function (on, px, pz) {
    M.open = on;
    document.getElementById('bigmap').classList.toggle('hidden', !on);
    if (on) {
      bigSize = Math.round(Math.min(window.innerHeight * 0.66, window.innerWidth * 0.8, 780));
      big.style.width = big.style.height = bigSize + 'px';
      big.width = big.height = Math.round(bigSize * dpr);
      minS = bigSize / ((W.RIM + 12) * 2.1); vs = bigSize / ((W.RIM - 10) * 2); vx = 0; vz = 0; drag = null;
      M.rebuild(); buildT = 0; M.setArmed(false);
    }
  };

  function drawMark(ctx, s, big2, m, i) {
    ctx.save(); ctx.translate(m.x * s, m.z * s);
    const r = big2 ? 8 : 5;
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
    ctx.fillStyle = '#6fe6ff'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
    if (big2) { ctx.font = '700 11px "Bahnschrift","Segoe UI",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#04121a'; ctx.fillText(String(i + 1), 0, 0.5); }
    ctx.restore();
  }

  // px, pz, yaw = Spieler; dt in Sekunden
  M.update = function (dt, wpx, wpz, yaw) {
    const px = wpx - OX, pz = wpz - OZ;       // Spieler relativ zur Kartenmitte
    buildT += dt;
    if (buildT > (M.open ? 0.25 : 0.5)) { buildT = 0; M.rebuild(); }

    // ---- Minimap: dreht sich mit, Blickrichtung ist oben ----
    let ctx = mctx; const c = MINI / 2, s = c / VIEW;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, MINI, MINI);
    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, c - 1, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#0b0a09'; ctx.fillRect(0, 0, MINI, MINI);
    ctx.translate(c, c); ctx.rotate(yaw); ctx.translate(-px * s, -pz * s);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, -SIZE / 2 * s, -SIZE / 2 * s, SIZE * s, SIZE * s);
    icons(ctx, s, false);
    ctx.restore();
    // Rand abdunkeln
    const gr = ctx.createRadialGradient(c, c, c * 0.72, c, c, c);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
    // Staublager außerhalb? Pfeil am Rand
    const dx = M.home.x - wpx, dz = M.home.z - wpz, dist = Math.hypot(dx, dz);
    if (dist > VIEW * 0.93) {
      const a = Math.atan2(dz, dx) + yaw;
      ctx.save(); ctx.translate(c + Math.cos(a) * (c - 12), c + Math.sin(a) * (c - 12)); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 5); ctx.lineTo(-6, 5); ctx.closePath();
      ctx.fillStyle = '#ffbf5a'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke(); ctx.restore();
    }
    // Norden
    ctx.font = '700 12px "Bahnschrift","Segoe UI",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6fe6ff'; ctx.fillText('N', c + Math.sin(yaw) * (c - 11), c - Math.cos(yaw) * (c - 11));
    ctx.save(); ctx.translate(c, c); arrow(ctx, 8); ctx.restore();

    // ---- große Karte: Norden oben, mit der Maus verschieben und zoomen ----
    if (!M.open) return;
    ctx = bctx; const S2 = bigSize;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0d0b09'; ctx.fillRect(0, 0, S2, S2);
    ctx.save();
    ctx.translate(S2 / 2 - vx * vs, S2 / 2 - vz * vs);
    // Kraterrand und Umland (noch nicht erschlossen)
    ctx.fillStyle = '#231e1a'; ctx.beginPath(); ctx.arc(0, 0, (W.RIM + 8) * vs, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, SIZE / 2 * vs, 0, Math.PI * 2); ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, -SIZE / 2 * vs, -SIZE / 2 * vs, SIZE * vs, SIZE * vs);
    ctx.restore();
    ctx.strokeStyle = 'rgba(111,230,255,.55)'; ctx.setLineDash([8, 7]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, CLEAN_R * vs, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    icons(ctx, vs, true, 0);
    ctx.translate(px * vs, pz * vs); ctx.rotate(-yaw); arrow(ctx, 11);
    ctx.restore();
  };

  // Kanten-Monitore im Buggy: Blick von oben auf die linke und rechte Saugkante
  const EN = 96, EVIEW = 5.2;
  let edge = null, edgeT = 0;
  M.edges = function (dt, bx, bz, heading, headDist, headR, sucking) {
    if (!edge) {
      edge = ['edge-l', 'edge-r'].map(id => { const c = document.getElementById(id); c.width = c.height = EN; const x = c.getContext('2d'); return { c, x, img: x.createImageData(EN, EN) }; });
    }
    edgeT -= dt; if (edgeT > 0) return; edgeT = 0.05;
    const sh = Math.sin(heading), ch = Math.cos(heading), fx = -sh, fz = -ch, rx = ch, rz = -sh;
    const dm = D.maps[W.secAt(bx, bz)], ESIZE = dm.SIZE;
    const hx = bx - dm.cx + fx * headDist, hz = bz - dm.cz + fz * headDist, src = dm.data, gl = dm.glit, DN = D.N, k = EVIEW / EN;
    for (let e = 0; e < 2; e++) {
      const sd = e ? 1 : -1, cx = hx + rx * headR * sd, cz = hz + rz * headR * sd, d = edge[e].img.data;
      for (let j = 0; j < EN; j++) {
        const lz = (EN / 2 - j - 0.5) * k + 0.6;                 // oben = vorn
        for (let i = 0; i < EN; i++) {
          const lx = (i + 0.5 - EN / 2) * k, wx = cx + rx * lx + fx * lz, wz = cz + rz * lx + fz * lz;
          const ii = Math.floor((wx / ESIZE + 0.5) * DN), jj = Math.floor((wz / ESIZE + 0.5) * DN);
          let dust = 1, g = 0;
          if (ii >= 0 && jj >= 0 && ii < DN && jj < DN) { dust = src[jj * DN + ii] / 255; g = gl[jj * DN + ii] / 255; }
          const n = 0.9 + ((ii * 7 + jj * 13) % 5) * 0.04;
          let cr = 70, cg = 60, cb = 52; if (g > 0.3) { cr = 100; cg = 92; cb = 210; }
          const q = (j * EN + i) * 4;
          d[q] = U.lerp(222, cr, dust) * n; d[q + 1] = U.lerp(230, cg, dust) * n; d[q + 2] = U.lerp(238, cb, dust) * n; d[q + 3] = 255;
        }
      }
      const x = edge[e].x; x.putImageData(edge[e].img, 0, 0);
      const px = EN / EVIEW, mid = EN / 2, zy = mid + 0.6 * px;          // Bildpunkt der Kante
      // Saugbereich (Kreis um den Saugkopf) und der Saugkopf selbst
      x.strokeStyle = sucking ? '#6fe6ff' : 'rgba(111,230,255,.5)'; x.lineWidth = 1.5;
      x.beginPath(); x.arc(mid - sd * headR * px, zy, headR * px, 0, Math.PI * 2); x.stroke();
      x.fillStyle = 'rgba(20,22,26,.92)'; x.fillRect(sd > 0 ? 0 : mid - 2.5, zy - 0.3 * px, mid + 2.5, 0.6 * px);
      x.fillStyle = '#ffbf5a'; x.fillRect(mid - 0.5, 0, 1, EN);          // Hilfslinie: genau hier endet die Spur
    }
  };

  LC.Map = M;
})(window.LC);
