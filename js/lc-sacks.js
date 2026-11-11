'use strict';
/* =========================================================
   Lunar Clean – Staubsäcke: Tank in einen Sack füllen,
   hinwerfen, später aufheben und abgeben
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World, B = LC.Base;
  const SK = { list: [], MAX: 60, CARRY: 2 };
  let scene, geo, matN, matG, matTie, onLand = null;

  function sackTexture() {
    const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#8a7350'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < S; i += 4) {
      g.fillStyle = 'rgba(40,28,14,' + (0.10 + Math.random() * 0.14) + ')'; g.fillRect(i, 0, 2, S);
      g.fillStyle = 'rgba(255,240,200,' + (0.04 + Math.random() * 0.08) + ')'; g.fillRect(0, i, S, 2);
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
    return t;
  }

  SK.init = function (sc, landCb) {
    scene = sc; onLand = landCb;
    // Sackform: bauchig, oben zugebunden
    const prof = [[0, 0], [0.26, 0.0], [0.36, 0.08], [0.40, 0.22], [0.38, 0.38], [0.28, 0.52], [0.13, 0.60], [0.085, 0.64], [0.15, 0.72], [0.17, 0.76], [0, 0.74]]
      .map(p => new THREE.Vector2(p[0], p[1]));
    geo = new THREE.LatheGeometry(prof, 16); geo.computeVertexNormals();
    const tex = sackTexture();
    matN = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, color: 0x9a8a72 });
    matG = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, color: 0x8794c8, emissive: 0x0a2a55, emissiveIntensity: 0.9 });
    matN.envMapIntensity = matG.envMapIntensity = 0.2;
    matTie = new THREE.MeshStandardMaterial({ color: 0xd9a514, roughness: 0.6 });
  };

  function makeMesh(s) {
    const tot = s.n + s.g, sc = 0.55 + 0.75 * Math.pow(Math.min(1, tot / 400), 0.4);
    const grp = new THREE.Group();
    const m = new THREE.Mesh(geo, s.g > tot * 0.3 ? matG : matN); m.castShadow = true; m.receiveShadow = true; grp.add(m);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.02, 6, 14), matTie); tie.rotation.x = Math.PI / 2; tie.position.y = 0.64; grp.add(tie);
    grp.scale.set(sc, sc * (0.82 + Math.random() * 0.1), sc);
    grp.rotation.y = Math.random() * 6.28;
    s.r = sc * 0.4;
    return grp;
  }

  SK.seq = 0;                 // laufende Nummer (im Mehrspieler vergibt sie der Gastgeber)
  function add(s) {
    if (!s.id) s.id = ++SK.seq; else if (s.id > SK.seq) SK.seq = s.id;
    s.mesh = makeMesh(s);
    s.mesh.position.set(s.x, s.y, s.z);
    scene.add(s.mesh); SK.list.push(s);
    return s;
  }

  // Sack mit Inhalt (n, g in kg) von einer Stelle aus werfen
  SK.throwSack = function (from, dir, n, g, id) {
    if (SK.list.length >= SK.MAX && !id) return null;
    const s = add({ id, x: from.x, y: from.y, z: from.z, n, g, vx: dir.x * 3.4, vy: 1.7, vz: dir.z * 3.4, fly: true, spin: (Math.random() - 0.5) * 3 });
    return s;
  };

  SK.update = function (dt) {
    for (let i = 0; i < SK.list.length; i++) {
      const s = SK.list[i];
      if (!s.fly) continue;
      s.vy -= 2.6 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      // nicht in Hindernisse oder über den Kraterrand
      const r = Math.hypot(s.x, s.z); if (r > W.LIMIT - 1) { s.x *= (W.LIMIT - 1) / r; s.z *= (W.LIMIT - 1) / r; s.vx = s.vz = 0; }
      for (let k = 0; k < B.colliders.length; k++) {
        const c = B.colliders[k], dx = s.x - c.x, dz = s.z - c.z, rr = c.r + 0.35, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); s.x = c.x + dx / d * rr; s.z = c.z + dz / d * rr; s.vx *= 0.2; s.vz *= 0.2; }
      }
      s.mesh.rotation.x += s.spin * dt;
      const gy = B.groundAt(s.x, s.z);
      if (s.y <= gy) {
        s.y = gy; s.fly = false; s.mesh.rotation.x = 0; s.mesh.rotation.z = (Math.random() - 0.5) * 0.25;
        if (onLand) onLand(s);
      }
      s.mesh.position.set(s.x, s.y, s.z);
    }
  };

  SK.nearest = function (x, z, maxD) {
    let best = null, bd = maxD;
    for (let i = 0; i < SK.list.length; i++) {
      const s = SK.list[i]; if (s.fly) continue;
      const d = Math.hypot(s.x - x, s.z - z) - s.r;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  };

  SK.remove = function (s) {
    const i = SK.list.indexOf(s); if (i < 0) return;
    SK.list.splice(i, 1); scene.remove(s.mesh);
  };
  SK.clear = function () { SK.list.slice().forEach(SK.remove); };
  SK.byId = function (id) { for (let i = 0; i < SK.list.length; i++) if (SK.list[i].id === id) return SK.list[i]; return null; };
  // Mehrspieler: Liste mit Nummern verschicken und übernehmen
  SK.netList = function () { return SK.list.map(s => [s.id, +s.x.toFixed(2), +s.z.toFixed(2), +s.n.toFixed(2), +s.g.toFixed(2)]); };
  SK.netLoad = function (arr) {
    SK.clear();
    (arr || []).forEach(a => { const x = +a[1] || 0, z = +a[2] || 0; add({ id: +a[0], x, z, y: B.groundAt(x, z), n: Math.max(0, +a[3] || 0), g: Math.max(0, +a[4] || 0), fly: false }); });
  };

  SK.serialize = function () { return SK.list.map(s => [+s.x.toFixed(2), +s.z.toFixed(2), +s.n.toFixed(2), +s.g.toFixed(2)]); };
  SK.load = function (arr) {
    SK.clear();
    (arr || []).slice(0, SK.MAX).forEach(a => {
      const x = +a[0] || 0, z = +a[1] || 0, n = Math.max(0, +a[2] || 0), g = Math.max(0, +a[3] || 0);
      if (n + g > 0) add({ x, z, y: B.groundAt(x, z), n, g, fly: false });
    });
  };

  // Säcke bleiben in ihrem Sektor liegen
  SK.stash = {};
  SK.switchSector = function (from, to) { SK.stash[from] = SK.serialize(); SK.load(SK.stash[to] || []); delete SK.stash[to]; };
  SK.serializeAll = function (cur) {
    const out = SK.serialize().map(a => a.concat(cur));
    Object.keys(SK.stash).forEach(k => SK.stash[k].forEach(a => out.push(a.concat(+k))));
    return out;
  };
  // beim Laden: Säcke des aktiven Sektors hinlegen, die anderen ablegen
  SK.loadAll = function (arr, cur) {
    SK.stash = {}; const here = [];
    (arr || []).forEach(a => { const sec = +a[4] || 1; if (sec === cur) here.push(a); else (SK.stash[sec] = SK.stash[sec] || []).push(a.slice(0, 4)); });
    SK.load(here);
  };

  LC.Sacks = SK;
})(window.LC);
