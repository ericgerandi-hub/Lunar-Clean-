'use strict';
/* =========================================================
   Lunar Clean – Bauen mit dem Bau-Hammer (Taste B):
   Glasröhre mit Einwurf (Staub wandert sichtbar zum Verkauf),
   Lichtmast, Signalbake. Abreißen gibt den halben Preis zurück.
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World, B = LC.Base;
  const BD = { list: [], seq: 0, MAX: 40, TUBE_MAX: 240 };
  BD.TYPES = {
    tube: { name: 'Glasröhre mit Einwurf', unlock: 3000, cost: 600, perM: 12, txt: 'Staub einwerfen – er wandert durch die Röhre zum Verkauf' },
    lamp: { name: 'Lichtmast', unlock: 0, cost: 250, perM: 0, txt: 'macht nachts den Boden hell' },
    beacon: { name: 'Signalbake', unlock: 0, cost: 100, perM: 0, txt: 'blinkt weithin sichtbar, steht auf der Karte' }
  };
  BD.ORDER = ['tube', 'lamp', 'beacon'];
  let scene, mats, ghost = null, ghostType = null, glowTex;
  const tmp = new THREE.Vector3(), dir = new THREE.Vector3();

  function init(sc) {
    scene = sc;
    mats = {
      steel: new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.45, metalness: 0.7 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.7, metalness: 0.2 }),
      acc: new THREE.MeshStandardMaterial({ color: 0xd4601a, roughness: 0.5 }),
      glass: new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide, emissive: 0x2a6f88, emissiveIntensity: 0.55 }),
      dust: new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 }),
      glit: new THREE.MeshStandardMaterial({ color: 0x5a66c8, roughness: 0.6, emissive: 0x1a2a88, emissiveIntensity: 1.2 }),
      lampOn: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.7, 1.8) }),
      ghostOk: new THREE.MeshBasicMaterial({ color: 0x58d6ff, transparent: true, opacity: 0.45, depthWrite: false }),
      ghostNo: new THREE.MeshBasicMaterial({ color: 0xff5040, transparent: true, opacity: 0.45, depthWrite: false })
    };
    glowTex = U.glowTexture(128, [[0, 'rgba(255,225,170,0.9)'], [0.35, 'rgba(255,205,140,0.4)'], [1, 'rgba(255,190,120,0)']]);
  }
  BD.init = init;
  const mesh = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = true; parent.add(m); return m; };

  // Wohin führt eine Röhre von hier? Zum Verkaufspunkt des Kraters, in dem sie steht.
  BD.hubFor = function (x, z) {
    if (W.secAt(x, z) === 1) return { x: B.siloNozzle.x, y: B.siloNozzle.y + 0.4, z: B.siloNozzle.z };
    const p = B.points.find(q => q.id === 'post'); return { x: p.x, y: p.y + 0.6, z: p.z };
  };
  BD.tubeLen = function (x, z) { const h = BD.hubFor(x, z); return Math.hypot(h.x - x, h.z - z); };
  BD.price = function (type, x, z) { const t = BD.TYPES[type]; return Math.round(t.cost + (t.perM ? t.perM * BD.tubeLen(x, z) : 0)); };

  function buildModel(b) {
    const g = new THREE.Group(), y = B.groundAt(b.x, b.z); g.position.set(b.x, y, b.z); b.y = y;
    if (b.t === 'lamp') {
      mesh(new THREE.CylinderGeometry(0.06, 0.09, 4.2, 8), mats.steel, 0, 2.1, 0, g); mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.12, 12), mats.dark, 0, 0.06, 0, g);
      mesh(new THREE.BoxGeometry(0.7, 0.1, 0.3), mats.dark, 0, 4.25, 0, g); mesh(new THREE.BoxGeometry(0.6, 0.05, 0.22), mats.lampOn, 0, 4.18, 0, g);
      const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2);
      b.pool = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      b.pool.scale.set(22, 1, 22); b.pool.position.y = 0.3; b.pool.renderOrder = 3; g.add(b.pool);
    } else if (b.t === 'beacon') {
      mesh(new THREE.CylinderGeometry(0.04, 0.07, 6.5, 8), mats.steel, 0, 3.25, 0, g); mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.12, 12), mats.acc, 0, 0.06, 0, g);
      b.lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.6, 3.4) });
      mesh(new THREE.SphereGeometry(0.16, 12, 8), b.lightMat, 0, 6.6, 0, g);
    } else if (b.t === 'tube') {
      // Einwurf: Trichter auf einem Sockel
      mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.5, 20), mats.dark, 0, 0.25, 0, g); mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.08, 20), mats.acc, 0, 0.5, 0, g);
      mesh(new THREE.CylinderGeometry(0.75, 0.3, 0.8, 20, 1, true), mats.steel, 0, 1.05, 0, g).material.side = THREE.DoubleSide;
      mesh(new THREE.TorusGeometry(0.75, 0.05, 8, 24), mats.acc, 0, 1.45, 0, g).rotation.x = Math.PI / 2;
      // Röhre: folgt dem Gelände auf Stützen bis zum Verkaufspunkt
      const h = BD.hubFor(b.x, b.z), len = Math.hypot(h.x - b.x, h.z - b.z), n = Math.max(2, Math.round(len / 4)), pts = [new THREE.Vector3(0, 0.75, 0), new THREE.Vector3(0, 2.3, 0)];
      const dx = (h.x - b.x) / len, dz = (h.z - b.z) / len;
      for (let i = 1; i < n; i++) { const d = i / n * len, px = b.x + dx * d, pz = b.z + dz * d; pts.push(new THREE.Vector3(dx * d, Math.max(B.groundAt(px, pz) + 2.6, y + 2.3 + (h.y - y - 2.3) * (i / n) * 0) - y, dz * d)); }
      pts.push(new THREE.Vector3(h.x - b.x, h.y - y, h.z - b.z));
      // Höhen glätten, damit die Röhre nicht zackt
      for (let k = 0; k < 2; k++) for (let i = 2; i < pts.length - 1; i++) pts[i].y = (pts[i - 1].y + pts[i].y * 2 + pts[i + 1].y) / 4;
      b.curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4); b.len = b.curve.getLength();
      const tube = mesh(new THREE.TubeGeometry(b.curve, Math.max(12, Math.round(b.len * 1.4)), 0.3, 12, false), mats.glass, 0, 0, 0, g); tube.renderOrder = 4;
      for (let d = 6; d < b.len - 3; d += 8) {
        const p = b.curve.getPointAt(d / b.len), tg = b.curve.getTangentAt(d / b.len), gy = B.groundAt(b.x + p.x, b.z + p.z) - y;
        const ring = mesh(new THREE.TorusGeometry(0.33, 0.045, 6, 16), mats.acc, p.x, p.y, p.z, g); ring.lookAt(p.x + tg.x + g.position.x * 0, p.y + tg.y, p.z + tg.z); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg);
        if (p.y - gy > 0.6) mesh(new THREE.CylinderGeometry(0.035, 0.05, p.y - gy - 0.24, 6), mats.steel, p.x, (p.y - 0.24 + gy) / 2, p.z, g);
      }
      b.blobs = []; b.queue = { n: 0, g: 0 }; b.emitT = 0; b.pool3 = [];
      for (let i = 0; i < 26; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mats.dust); s.visible = false; g.add(s); b.pool3.push(s); }
    }
    scene.add(g); b.g = g;
  }

  BD.add = function (type, x, z, id) {
    if (!BD.TYPES[type] || BD.list.length >= BD.MAX) return null;
    const b = { t: type, x, z, id: id || ++BD.seq }; if (b.id > BD.seq) BD.seq = b.id;
    buildModel(b);
    b.col = { x, z, r: type === 'tube' ? 1.0 : 0.3, h: type === 'tube' ? 1.6 : 6 }; B.colliders.push(b.col);
    if (type === 'tube') { b.pt = { id: 'intake', x, y: b.y + 1.2, z, r: 2.6, b }; B.points.push(b.pt); }
    BD.list.push(b); return b;
  };
  BD.remove = function (b) {
    const i = BD.list.indexOf(b); if (i < 0) return;
    BD.list.splice(i, 1); scene.remove(b.g);
    b.g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    let k = B.colliders.indexOf(b.col); if (k >= 0) B.colliders.splice(k, 1);
    if (b.pt) { k = B.points.indexOf(b.pt); if (k >= 0) B.points.splice(k, 1); }
  };
  BD.clear = function () { BD.list.slice().forEach(BD.remove); };
  BD.byId = id => BD.list.find(b => b.id === id) || null;
  BD.nearest = function (x, z, maxD) { let best = null, bd = maxD; BD.list.forEach(b => { const d = Math.hypot(b.x - x, b.z - z); if (d < bd) { bd = d; best = b; } }); return best; };
  BD.serialize = () => BD.list.map(b => [b.id, b.t, +b.x.toFixed(2), +b.z.toFixed(2)]);
  BD.load = function (arr) {
    BD.clear();
    (Array.isArray(arr) ? arr : []).slice(0, BD.MAX).forEach(a => { if (BD.TYPES[a[1]] && W.inside(+a[2] || 0, +a[3] || 0, 0)) BD.add(a[1], +a[2] || 0, +a[3] || 0, +a[0] || 0); });
  };
  // Liste vom Gastgeber übernehmen (nur Unterschiede umbauen)
  BD.sync = function (arr) {
    const want = {}; arr.forEach(a => { want[a[0]] = a; });
    BD.list.slice().forEach(b => { if (!want[b.id]) BD.remove(b); });
    arr.forEach(a => { if (!BD.byId(a[0])) BD.add(a[1], a[2], a[3], a[0]); });
  };

  // Staub in eine Röhre kippen
  BD.deposit = function (b, n, g) { if (b && b.queue) { b.queue.n += n; b.queue.g += g; } };

  // Worauf zeigt der Spieler? (Boden bis 16 m vor der Kamera)
  const aim = { ok: false, x: 0, y: 0, z: 0, why: '' };
  BD.aim = function (camera, type) {
    camera.getWorldDirection(dir); aim.ok = false; aim.why = 'Ziel auf den Boden vor dir.';
    for (let d = 2; d <= 16; d += 0.25) {
      tmp.copy(camera.position).addScaledVector(dir, d);
      const gy = B.groundAt(tmp.x, tmp.z);
      if (tmp.y <= gy) {
        aim.x = tmp.x; aim.z = tmp.z; aim.y = gy;
        if (!W.inside(tmp.x, tmp.z, 1.5)) { aim.why = 'Zu nah am Kraterrand.'; return aim; }
        for (let i = 0; i < B.colliders.length; i++) { const c = B.colliders[i]; if (Math.hypot(c.x - tmp.x, c.z - tmp.z) < c.r + 1.2) { aim.why = 'Hier steht schon etwas.'; return aim; } }
        if (type === 'tube') { const l = BD.tubeLen(tmp.x, tmp.z); if (l > BD.TUBE_MAX) { aim.why = 'Zu weit vom Verkaufspunkt (höchstens ' + BD.TUBE_MAX + ' m).'; return aim; } if (l < 8) { aim.why = 'Zu nah am Verkaufspunkt.'; return aim; } }
        if (BD.list.length >= BD.MAX) { aim.why = 'Mehr als ' + BD.MAX + ' Bauten gehen nicht.'; return aim; }
        aim.ok = true; aim.why = ''; return aim;
      }
    }
    return aim;
  };
  // Vorschau beim Bauen (type = null: aus)
  BD.ghost = function (type, a) {
    if (!type) { if (ghost) ghost.visible = false; return; }
    if (!ghost || ghostType !== type) {
      if (ghost) scene.remove(ghost);
      ghost = new THREE.Group(); ghostType = type;
      if (type === 'tube') { ghost.add(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 1.5, 20), mats.ghostOk)); ghost.children[0].position.y = 0.75; ghost.line = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 8), mats.ghostOk); ghost.line.geometry.rotateX(Math.PI / 2); ghost.line.geometry.translate(0, 0, 0.5); scene.add(ghost.line); }
      else if (type === 'del') { const r = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.08, 8, 28), mats.ghostNo); r.rotation.x = Math.PI / 2; r.position.y = 0.2; ghost.add(r); }
      else { const hgt = type === 'lamp' ? 4.2 : 6.5; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, hgt, 8), mats.ghostOk); p.position.y = hgt / 2; ghost.add(p); }
      scene.add(ghost);
    }
    ghost.visible = true; ghost.position.set(a.x, a.y, a.z);
    if (type !== 'del') ghost.traverse(o => { if (o.isMesh) o.material = a.ok ? mats.ghostOk : mats.ghostNo; });
    if (ghost.line) {
      ghost.line.visible = type === 'tube';
      if (type === 'tube') { const h = BD.hubFor(a.x, a.z); ghost.line.material = a.ok ? mats.ghostOk : mats.ghostNo; ghost.line.position.set(a.x, a.y + 2.3, a.z); ghost.line.lookAt(h.x, h.y, h.z); ghost.line.scale.set(1, 1, Math.hypot(h.x - a.x, h.y - a.y - 2.3, h.z - a.z)); }
    }
  };
  BD.ghostOff = function () { if (ghost) ghost.visible = false; if (ghost && ghost.line) ghost.line.visible = false; };

  // night = 0..1 (wie dunkel es ist); onArrive(n, g): Staub ist am Verkaufspunkt angekommen
  BD.update = function (dt, t, night, onArrive) {
    for (let i = 0; i < BD.list.length; i++) {
      const b = BD.list[i];
      if (b.pool) b.pool.material.opacity = 0.75 * night;
      else if (b.lightMat) { const k = (t * 0.9 + b.id * 0.37) % 1 < 0.18 ? 1 : 0.06; b.lightMat.color.setRGB(0.3 * k, 2.6 * k, 3.4 * k); }
      else if (b.blobs) {
        const q = b.queue;
        b.emitT -= dt;
        if (q.n + q.g > 0.01 && b.emitT <= 0 && b.blobs.length < b.pool3.length) {
          b.emitT = 0.16; const tot = q.n + q.g, take = Math.min(tot, Math.max(12, tot * 0.12)), k = take / tot;
          b.blobs.push({ u: 0, n: q.n * k, g: q.g * k }); q.n -= q.n * k; q.g -= q.g * k;
        }
        const sp = 15 / b.len;
        for (let j = b.blobs.length - 1; j >= 0; j--) { const bl = b.blobs[j]; bl.u += sp * dt; if (bl.u >= 1) { onArrive(bl.n, bl.g); b.blobs.splice(j, 1); } }
        for (let j = 0; j < b.pool3.length; j++) {
          const s = b.pool3[j], bl = b.blobs[j];
          if (!bl) { s.visible = false; continue; }
          b.curve.getPointAt(bl.u, s.position); s.visible = true; s.material = bl.g > bl.n * 0.5 ? mats.glit : mats.dust;
          const sc = 0.7 + Math.min(0.5, (bl.n + bl.g) / 80); s.scale.set(sc, sc, sc * 1.3);
        }
      }
    }
  };
  // wie viel Staub ist gerade in Röhren unterwegs? (für die Anzeige)
  BD.inTransit = function () { let s = 0; BD.list.forEach(b => { if (b.blobs) { s += b.queue.n + b.queue.g; b.blobs.forEach(q => { s += q.n + q.g; }); } }); return s; };

  LC.Build = BD;
})(window.LC);
