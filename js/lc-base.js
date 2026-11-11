'use strict';
/* =========================================================
   Lunar Clean – Die Basis: Raumschiffwrack, Staublager,
   Werkstatt, Landeplatz, Lampen, Kabel
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World;
  const B = {};
  B.colliders = [];      // {x, z, r}
  B.points = [];         // Stellen zum Benutzen: {id, x, y, z, r}
  B.blinkers = [];       // blinkende Lichter
  B.pad = { x: 22, z: -8, r: 6.2, top: 0 };
  B.silo = { x: 8, z: 7 };
  B.shop = { x: -8.3, z: 2.6 };
  B.spawn = { x: 3.5, z: 15.5, yaw: 0.16 };

  let M = {};
  function mats() {
    const hullTex = makeHullTexture();
    M.hull = new THREE.MeshStandardMaterial({ map: hullTex, roughness: 0.52, metalness: 0.35 });
    M.white = new THREE.MeshStandardMaterial({ color: 0xb4b1a9, roughness: 0.55, metalness: 0.3 });
    M.dark = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.55, metalness: 0.55 });
    M.steel = new THREE.MeshStandardMaterial({ color: 0x7d8288, roughness: 0.38, metalness: 0.8 });
    M.orange = new THREE.MeshStandardMaterial({ color: 0xb8500f, roughness: 0.5, metalness: 0.25 });
    M.yellow = new THREE.MeshStandardMaterial({ color: 0xb98a0c, roughness: 0.5, metalness: 0.25 });
    M.foil = new THREE.MeshStandardMaterial({ color: 0xc79a3a, roughness: 0.32, metalness: 0.95 });
    M.glass = new THREE.MeshStandardMaterial({ color: 0x0a1218, roughness: 0.08, metalness: 0.9, emissive: 0x0b2a3a, emissiveIntensity: 0.4 });
    M.rubber = new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: 0.9, metalness: 0.0 });
    M.burnt = new THREE.MeshStandardMaterial({ color: 0x17130f, roughness: 0.9, metalness: 0.3 });
    M.warm = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffa860, emissiveIntensity: 3.2 });
    M.cyan = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x4fe3ff, emissiveIntensity: 2.4 });
    M.panel = new THREE.MeshStandardMaterial({ map: makeSolarTexture(), roughness: 0.22, metalness: 0.75 });
  }

  function makeHullTexture() {
    const Wd = 1024, Hd = 512, c = document.createElement('canvas'); c.width = Wd; c.height = Hd;
    const g = c.getContext('2d'), rnd = U.rng(555);
    g.fillStyle = '#bcb8af'; g.fillRect(0, 0, Wd, Hd);
    // Platten
    for (let y = 0; y < Hd; y += 64) for (let x = 0; x < Wd; x += 128) {
      const off = (y / 64) % 2 ? 64 : 0, v = 178 + Math.floor(rnd() * 24);
      g.fillStyle = 'rgb(' + v + ',' + (v - 3) + ',' + (v - 10) + ')';
      g.fillRect(x + off - 128, y, 126, 62); g.fillRect(x + off, y, 126, 62);
    }
    g.strokeStyle = 'rgba(40,40,45,0.55)'; g.lineWidth = 2;
    for (let y = 0; y <= Hd; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(Wd, y); g.stroke(); }
    for (let y = 0; y < Hd; y += 64) for (let x = 0; x <= Wd; x += 128) {
      const off = (y / 64) % 2 ? 64 : 0;
      g.beginPath(); g.moveTo(x + off, y); g.lineTo(x + off, y + 64); g.stroke();
      g.fillStyle = 'rgba(30,30,30,0.5)';
      for (let k = 8; k < 128; k += 24) { g.fillRect(x + off + k, y + 5, 2, 2); g.fillRect(x + off + k, y + 57, 2, 2); }
    }
    // orangener Streifen
    g.fillStyle = '#c9581a'; g.fillRect(0, 196, Wd, 30);
    g.fillStyle = '#26272b'; g.fillRect(0, 230, Wd, 6);
    // Ruß und Kratzer vom Absturz
    for (let i = 0; i < 90; i++) {
      const x = rnd() * Wd, y = rnd() * Hd, w = 40 + rnd() * 220, h = 6 + rnd() * 40;
      const gr = g.createRadialGradient(x, y, 0, x, y, w / 2);
      const a = 0.12 + rnd() * 0.35;
      gr.addColorStop(0, 'rgba(20,14,10,' + a + ')'); gr.addColorStop(1, 'rgba(20,14,10,0)');
      g.save(); g.translate(x, y); g.scale(1, h / w); g.translate(-x, -y);
      g.fillStyle = gr; g.fillRect(x - w / 2, y - w / 2, w, w); g.restore();
    }
    const burn = g.createLinearGradient(0, 0, 0, Hd);
    burn.addColorStop(0, 'rgba(15,10,8,0.0)'); burn.addColorStop(0.72, 'rgba(15,10,8,0.15)'); burn.addColorStop(1, 'rgba(15,10,8,0.85)');
    g.fillStyle = burn; g.fillRect(0, 0, Wd, Hd);
    g.strokeStyle = 'rgba(90,90,95,0.5)'; g.lineWidth = 1;
    for (let i = 0; i < 160; i++) { const x = rnd() * Wd, y = rnd() * Hd; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 16, y + 20 + rnd() * 70); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  }

  function makeSolarTexture() {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#0b1535'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 32) {
      const gr = g.createLinearGradient(x, y, x + 32, y + 32);
      gr.addColorStop(0, '#16296a'); gr.addColorStop(1, '#0a1436');
      g.fillStyle = gr; g.fillRect(x + 1.5, y + 1.5, 29, 29);
    }
    g.strokeStyle = 'rgba(190,200,220,0.6)'; g.lineWidth = 1;
    for (let x = 0; x <= S; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(S, x); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  }

  function add(parent, geo, mat, x, y, z, rx, ry, rz) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, seg, open) => new THREE.CylinderGeometry(rt, rb, h, seg || 20, 1, !!open);

  function beacon(parent, x, y, z, color, period, phase, range) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: 3 });
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat); m.position.set(x, y, z); parent.add(m);
    let light = null;
    if (range) { light = new THREE.PointLight(color, 0, range, 2); light.position.set(x, y, z); parent.add(light); }
    B.blinkers.push({ mat, light, period, phase: phase || 0, base: range ? 1.1 : 0 });
    return m;
  }

  // ---------- Raumschiffwrack ----------
  function buildShip(scene) {
    const ship = new THREE.Group();
    // Rumpf (Drehkörper, Achse = x)
    const prof = [[0.0, -5.6], [1.15, -5.6], [1.55, -5.1], [1.9, -4.0], [2.0, -2.6], [2.0, 1.4], [1.82, 2.6], [1.45, 3.7], [0.95, 4.6], [0.45, 5.15], [0.0, 5.3]]
      .map(p => new THREE.Vector2(p[0], p[1]));
    const hullGeo = new THREE.LatheGeometry(prof, 40); hullGeo.rotateZ(-Math.PI / 2); hullGeo.computeVertexNormals();
    add(ship, hullGeo, M.hull, 0, 0, 0);
    // Cockpitscheibe
    const canopy = add(ship, new THREE.SphereGeometry(1, 28, 18), M.glass, 2.75, 1.02, 0);
    canopy.scale.set(1.55, 0.72, 1.12);
    add(ship, new THREE.TorusGeometry(1.0, 0.06, 8, 36), M.dark, 2.75, 1.05, 0, Math.PI / 2, 0, 0).scale.set(1.55, 1.12, 1.0);
    // Triebwerke
    [[0, 0.75], [-0.85, -0.45], [0.85, -0.45]].forEach((p, i) => {
      add(ship, cyl(0.5, 0.78, 1.5, 22, true), M.burnt, -6.1, p[1], p[0], 0, 0, Math.PI / 2).material.side = THREE.DoubleSide;
      add(ship, cyl(0.62, 0.62, 0.5, 22), M.steel, -5.55, p[1], p[0], 0, 0, Math.PI / 2);
    });
    add(ship, cyl(1.5, 1.2, 0.5, 30), M.dark, -5.4, 0, 0, 0, 0, Math.PI / 2);
    // Flügel: links heil, rechts abgebrochen
    const ws = new THREE.Shape(); ws.moveTo(1.6, 0); ws.lineTo(-3.4, 0); ws.lineTo(-4.3, 4.6); ws.lineTo(-2.9, 4.6); ws.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(ws, { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 });
    const wl = wingGeo.clone(); wl.rotateX(Math.PI / 2);
    add(ship, wl, M.white, 0, -0.35, 1.7, 0.08, 0, 0);
    add(ship, box(1.4, 0.2, 0.18), M.orange, -3.55, -0.62, 6.2, 0.08, 0.19, 0);
    const ws2 = new THREE.Shape(); ws2.moveTo(1.6, 0); ws2.lineTo(-3.4, 0); ws2.lineTo(-3.75, 1.5); ws2.lineTo(-2.6, 1.9); ws2.lineTo(-1.4, 1.3); ws2.lineTo(0.2, 1.75); ws2.closePath();
    const wr = new THREE.ExtrudeGeometry(ws2, { depth: 0.16, bevelEnabled: false }); wr.rotateX(-Math.PI / 2);
    add(ship, wr, M.white, 0, -0.5, -1.7, -0.1, 0, 0);
    // Heckflosse
    const fs = new THREE.Shape(); fs.moveTo(0.8, 0); fs.lineTo(-2.4, 0); fs.lineTo(-3.3, 2.5); fs.lineTo(-2.3, 2.5); fs.closePath();
    const fin = new THREE.ExtrudeGeometry(fs, { depth: 0.14, bevelEnabled: false }); fin.translate(0, 0, -0.07);
    add(ship, fin, M.white, -2.6, 1.85, 0);
    add(ship, box(0.9, 0.5, 0.16), M.orange, -5.1, 3.9, 0, 0, 0, 0.35);
    // Luke (linke Seite) mit warmem Licht von innen
    add(ship, box(1.5, 1.9, 0.14), M.dark, -0.9, 0.25, 1.96);
    add(ship, box(1.2, 1.6, 0.1), M.warm, -0.9, 0.25, 1.93);
    add(ship, box(1.7, 0.12, 0.5), M.dark, -0.9, 1.3, 2.1);
    // offene Lukentür als Rampe
    add(ship, box(1.3, 0.1, 2.5), M.white, -0.9, -1.05, 3.05, 0.42, 0, 0);
    add(ship, box(1.3, 0.04, 2.3), M.rubber, -0.9, -0.99, 3.07, 0.42, 0, 0);
    const hatchLight = new THREE.PointLight(0xffa860, 0.55, 11, 2); hatchLight.position.set(-0.9, 0.9, 3.0); ship.add(hatchLight);
    // Antenne + Notlicht
    add(ship, cyl(0.03, 0.03, 2.4, 6), M.steel, 0.4, 2.9, -0.3, 0, 0, -0.12);
    add(ship, cyl(0.42, 0.05, 0.22, 16, true), M.steel, 1.1, 2.25, 0.6, 0.5, 0, 0.3).material.side = THREE.DoubleSide;
    beacon(ship, 0.55, 4.1, -0.3, 0xff2a1a, 1.6, 0, 16);
    // Goldfolie-Flicken und loses Kabel
    add(ship, box(1.1, 0.02, 0.9), M.foil, 0.8, 1.94, -0.55, 0.28, 0.2, 0.0);
    const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(-3.2, 1.3, -1.45), new THREE.Vector3(-3.5, 0.3, -2.3), new THREE.Vector3(-3.1, -0.7, -2.6), new THREE.Vector3(-3.6, -1.1, -3.3)]);
    add(ship, new THREE.TubeGeometry(cable, 16, 0.04, 6), M.rubber, 0, 0, 0);

    const f = W.furrow, cx = f.b.x - f.dir.x * 3.2, cz = f.b.z - f.dir.z * 3.2;
    ship.rotation.order = 'YZX';
    ship.rotation.set(0.13, Math.atan2(-f.dir.z, f.dir.x), -0.115);
    ship.position.set(cx, W.heightAt(cx, cz) + 1.25, cz);
    scene.add(ship);
    for (let s = -5.2; s <= 4.6; s += 1.6) B.colliders.push({ x: cx + f.dir.x * s, z: cz + f.dir.z * s, r: s > 3 ? 1.5 : 2.25, h: 5 });
    // linker Flügel als Hindernis
    const nx = -f.dir.z, nz = f.dir.x;
    B.colliders.push({ x: cx - f.dir.x * 2.6 + nx * 3.6, z: cz - f.dir.z * 2.6 + nz * 3.6, r: 1.5 });
    B.colliders.push({ x: cx - f.dir.x * 3.3 + nx * 5.4, z: cz - f.dir.z * 3.3 + nz * 5.4, r: 1.0 });
    B.ship = ship;

    // abgebrochenes Flügelstück, weiter hinten in der Furche liegen geblieben
    const ps = new THREE.Shape(); ps.moveTo(0, 0); ps.lineTo(1.5, -0.5); ps.lineTo(2.3, 2.9); ps.lineTo(0.9, 3.0); ps.lineTo(-0.5, 1.2); ps.closePath();
    const piece = new THREE.ExtrudeGeometry(ps, { depth: 0.16, bevelEnabled: false }); piece.rotateX(-Math.PI / 2);
    const px = -24, pz = -15.5;
    add(scene, piece, M.white, px, W.heightAt(px, pz) + 0.35, pz, 0.32, 0.9, 0.12);
    // verstreute Trümmer
    const rnd = U.rng(31337);
    for (let i = 0; i < 14; i++) {
      const t = 0.25 + rnd() * 0.7, side = (rnd() - 0.5) * 9;
      const x = f.a.x + (f.b.x - f.a.x) * t + nx * side, z = f.a.z + (f.b.z - f.a.z) * t + nz * side;
      const s = 0.15 + rnd() * 0.4;
      add(scene, box(s * (1 + rnd()), s * 0.25, s * (0.6 + rnd())), rnd() < 0.5 ? M.white : M.burnt, x, W.heightAt(x, z) + s * 0.1, z, rnd() * 0.6, rnd() * 6, rnd() * 0.6);
    }
  }

  // ---------- Staublager (Verkaufen) ----------
  function buildSilo(scene) {
    const g = new THREE.Group(), x = B.silo.x, z = B.silo.z, y = W.heightAt(x, z);
    g.position.set(x, y - 0.15, z);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4, lx = Math.cos(a) * 1.35, lz = Math.sin(a) * 1.35;
      add(g, cyl(0.09, 0.11, 2.3, 8), M.steel, lx, 1.05, lz, Math.sin(a) * -0.12, 0, Math.cos(a) * 0.12);
      add(g, cyl(0.28, 0.32, 0.1, 12), M.dark, lx * 1.1, 0.05, lz * 1.1);
    }
    add(g, cyl(1.6, 0.35, 1.3, 28), M.white, 0, 2.2, 0);                 // Trichter unten
    add(g, cyl(0.35, 0.35, 0.5, 14), M.dark, 0, 1.4, 0);
    add(g, cyl(1.6, 1.6, 3.0, 28), M.hull, 0, 4.35, 0);                  // Tank
    add(g, new THREE.SphereGeometry(1.6, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.white, 0, 5.85, 0).scale.y = 0.45;
    add(g, new THREE.TorusGeometry(1.62, 0.07, 8, 40), M.orange, 0, 3.0, 0, Math.PI / 2);
    add(g, new THREE.TorusGeometry(1.62, 0.07, 8, 40), M.orange, 0, 5.7, 0, Math.PI / 2);
    // Füllstands-Fenster
    B.siloFill = add(g, box(0.16, 2.2, 0.06), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb040, emissiveIntensity: 2.6 }), 0, 4.3, 1.6);
    add(g, box(0.3, 2.5, 0.05), M.dark, 0, 4.3, 1.585);
    // Einfüllstutzen mit Schlauch (zeigt zum Spieler-Startpunkt)
    const ang = Math.atan2(B.spawn.x - x, B.spawn.z - z);
    const arm = new THREE.Group(); arm.rotation.y = ang; g.add(arm);
    // Einfülltrichter: oben offen, Rohr führt unten in den Tank
    const pipe = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.86, 2.6), new THREE.Vector3(0, 0.55, 2.45), new THREE.Vector3(0, 0.5, 1.7), new THREE.Vector3(0, 0.95, 0.75), new THREE.Vector3(0, 1.35, 0.25)]);
    add(arm, new THREE.TubeGeometry(pipe, 24, 0.13, 12), M.rubber, 0, 0, 0);
    add(arm, cyl(0.52, 0.15, 0.5, 24, true), M.yellow, 0, 1.1, 2.6).material.side = THREE.DoubleSide;
    add(arm, new THREE.TorusGeometry(0.52, 0.035, 8, 28), M.dark, 0, 1.35, 2.6, Math.PI / 2);
    add(arm, cyl(0.16, 0.16, 0.1, 16), M.dark, 0, 0.86, 2.6);
    [-0.33, 0.33].forEach(o => add(arm, cyl(0.035, 0.035, 1.0, 6), M.steel, o, 0.5, 2.6));
    // Schild + Preisanzeige
    const sign = add(arm, new THREE.PlaneGeometry(2.3, 0.62), new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.15,
      emissiveMap: U.textTexture([{ text: 'STAUBLAGER', size: 74, color: '#ffc45a' }], { w: 512, h: 138, bg: '#140d04', border: '#ffb040' })
    }), 0, 3.75, 1.66);
    sign.castShadow = false;
    const price = add(arm, new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.0,
      emissiveMap: U.textTexture([
        { text: 'ANKAUF', size: 40, color: '#8fb8c4', y: 44 },
        { text: 'Staub  2 ¢ / kg', size: 46, color: '#ffe2a8', y: 118 },
        { text: 'Glitzer  15 ¢ / kg', size: 46, color: '#7fe9ff', y: 188 }
      ], { w: 512, h: 256, bg: '#06131a', border: '#2b7f93' })
    }), 1.25, 1.75, 2.35, 0, -0.5, 0);
    price.castShadow = false;
    add(arm, cyl(0.04, 0.04, 1.6, 6), M.steel, 1.25, 0.7, 2.33);
    beacon(g, 0, 6.65, 0, 0x3dff7a, 2.4, 0.3, 0);
    add(g, cyl(0.03, 0.03, 0.2, 6), M.steel, 0, 6.6, 0);
    const lamp = new THREE.PointLight(0xffc27a, 1.2, 12, 2); lamp.position.set(Math.sin(ang) * 2.6, 2.6, Math.cos(ang) * 2.6); g.add(lamp);
    scene.add(g);
    B.colliders.push({ x, z, r: 2.0, h: 7.5 });
    B.points.push({ id: 'silo', x: x + Math.sin(ang) * 2.6, y: y + 1.1, z: z + Math.cos(ang) * 2.6, r: 3.0 });
    B.siloNozzle = new THREE.Vector3(x + Math.sin(ang) * 2.6, y + 1.0, z + Math.cos(ang) * 2.6);
    B.colliders.push({ x: x + Math.sin(ang) * 2.6, z: z + Math.cos(ang) * 2.6, r: 0.25, h: 1.5 });
  }

  // ---------- Werkstatt ----------
  function buildShop(scene) {
    const g = new THREE.Group(), x = B.shop.x, z = B.shop.z, y = W.heightAt(x, z);
    const face = Math.atan2(B.spawn.x - x, B.spawn.z - z) - 0.25;
    g.position.set(x, y - 0.05, z); g.rotation.y = face;
    // Werkbank
    add(g, box(2.6, 0.1, 1.1), M.steel, 0, 0.95, 0);
    [[-1.2, -0.45], [1.2, -0.45], [-1.2, 0.45], [1.2, 0.45]].forEach(p => add(g, box(0.09, 0.95, 0.09), M.dark, p[0], 0.475, p[1]));
    add(g, box(2.4, 0.06, 0.9), M.dark, 0, 0.35, 0);
    // Konsole mit Bildschirm
    add(g, box(1.5, 1.0, 0.16), M.dark, -0.35, 1.62, -0.42, -0.14, 0, 0);
    const scr = add(g, new THREE.PlaneGeometry(1.36, 0.86), new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.25,
      emissiveMap: U.textTexture([
        { text: 'WERKSTATT', size: 74, color: '#7fe9ff', y: 86 },
        { text: 'Upgrades & Reparatur', size: 36, color: '#c9f4ff', y: 160, bold: false },
        { text: '▮▮▮▯▯  SYSTEM: NOTBETRIEB', size: 26, color: '#ffb040', y: 216, bold: false }
      ], { w: 512, h: 324, bg: '#04141b', border: '#2b9db8' })
    }), -0.35, 1.63, -0.325, -0.14, 0, 0);
    scr.castShadow = false;
    // Werkzeug, Kisten
    add(g, box(0.5, 0.28, 0.3), M.orange, 0.85, 1.14, 0.1, 0, 0.3, 0);
    add(g, box(0.5, 0.04, 0.3), M.dark, 0.85, 1.3, 0.1, 0, 0.3, 0);
    add(g, cyl(0.035, 0.035, 0.5, 8), M.steel, 0.2, 1.03, 0.25, 0, 0.6, Math.PI / 2);
    add(g, box(0.12, 0.06, 0.16), M.yellow, 0.42, 1.03, 0.32, 0, 0.6, 0);
    add(g, box(0.7, 0.7, 0.7), M.orange, 1.9, 0.33, 0.3, 0, 0.4, 0);
    add(g, box(0.72, 0.08, 0.72), M.dark, 1.9, 0.7, 0.3, 0, 0.4, 0);
    add(g, box(0.55, 0.5, 0.55), M.white, 2.05, 0.95, 0.25, 0, -0.2, 0);
    add(g, box(0.8, 0.5, 0.6), M.white, -1.95, 0.22, 0.5, 0, -0.3, 0);
    // Arbeitslampe
    add(g, cyl(0.045, 0.06, 3.2, 8), M.steel, 1.35, 1.6, -0.5);
    add(g, box(0.5, 0.1, 0.22), M.dark, 1.15, 3.2, -0.42, 0, 0, 0.1);
    add(g, box(0.42, 0.03, 0.16), M.warm, 1.15, 3.14, -0.42, 0, 0, 0.1).castShadow = false;
    const lamp = new THREE.PointLight(0xffc58a, 1.7, 15, 2); lamp.position.set(1.0, 2.9, 0.1); g.add(lamp);
    // Funkmast
    add(g, cyl(0.03, 0.04, 4.2, 6), M.steel, -1.6, 2.1, -0.6);
    beacon(g, -1.6, 4.25, -0.6, 0x4fe3ff, 3.1, 1.2, 0);
    scene.add(g);
    B.colliders.push({ x, z, r: 1.5, h: 4.6 });
    B.points.push({ id: 'shop', x: x + Math.sin(face) * 1.4, y: y + 1.3, z: z + Math.cos(face) * 1.4, r: 3.2 });
  }

  // ---------- Händler-Landeplatz (wird später wichtig) ----------
  function buildPad(scene) {
    const p = B.pad, y = W.heightAt(p.x, p.z) + 0.2;
    p.top = y;
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#26282c'; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = '#e8b43a'; g.lineWidth = 14; g.beginPath(); g.arc(256, 256, 200, 0, Math.PI * 2); g.stroke();
    g.setLineDash([26, 20]); g.lineWidth = 8; g.strokeStyle = '#c8c8c8'; g.beginPath(); g.arc(256, 256, 120, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]); g.fillStyle = '#e8b43a'; g.font = 'bold 150px "Bahnschrift","Segoe UI",Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 256, 264);
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
    const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.3 });
    const pad = new THREE.Mesh(cyl(p.r, p.r + 0.4, 1.6, 8), [M.dark, top, M.dark]);
    pad.position.set(p.x, y - 0.8, p.z); pad.rotation.y = Math.PI / 8; pad.castShadow = true; pad.receiveShadow = true;
    scene.add(pad);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + Math.PI / 8;
      beacon(scene, p.x + Math.cos(a) * (p.r - 0.35), y + 0.08, p.z + Math.sin(a) * (p.r - 0.35), 0x3aa8ff, 2.0, i * 0.25, 0);
    }
    // Schild
    const sx = p.x - 7.2, sz = p.z + 3.2, sy = W.heightAt(sx, sz);
    add(scene, cyl(0.04, 0.05, 1.7, 6), M.steel, sx, sy + 0.85, sz);
    const sign = add(scene, new THREE.PlaneGeometry(1.9, 0.8), new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveIntensity: 0.95, side: THREE.DoubleSide,
      emissiveMap: U.textTexture([
        { text: 'HÄNDLER-LANDEPLATZ', size: 42, color: '#8fd0ff', y: 80 },
        { text: 'Nächster Frachter: unbekannt', size: 28, color: '#c8d8e4', y: 150, bold: false }
      ], { w: 512, h: 216, bg: '#05101a', border: '#2b6f9f' })
    }), sx, sy + 1.75, sz, 0, Math.atan2(B.spawn.x - sx, B.spawn.z - sz), 0);
    sign.castShadow = false;
  }

  // ---------- Solarzellen, Lampen, Kabel, Kisten ----------
  function buildProps(scene) {
    // Solarzellen
    [[-14.5, 8.5, 0.5], [-17.5, 5.2, 0.75]].forEach(s => {
      const g = new THREE.Group(), y = W.heightAt(s[0], s[1]);
      g.position.set(s[0], y, s[1]);
      const sunYaw = Math.atan2(W.SUN_DIR.x, W.SUN_DIR.z);
      g.rotation.y = sunYaw;
      add(g, cyl(0.06, 0.08, 1.5, 8), M.steel, 0, 0.75, 0);
      for (let i = 0; i < 3; i++) { const a = i * 2.094; add(g, cyl(0.03, 0.03, 1.0, 6), M.steel, Math.cos(a) * 0.35, 0.3, Math.sin(a) * 0.35, Math.sin(a) * 0.75, 0, -Math.cos(a) * 0.75); }
      const pn = add(g, box(3.2, 0.06, 1.7), M.panel, 0, 1.6, 0, -1.05, 0, 0);
      pn.material.map.repeat.set(2, 1);
      add(g, box(3.3, 0.04, 1.8), M.steel, 0, 1.585, -0.02, -1.05, 0, 0);
      scene.add(g);
      B.colliders.push({ x: s[0], z: s[1], r: 0.9 });
    });
    // Lichtmasten
    [[1.5, 9.5], [-12.5, -9.5]].forEach((s, i) => {
      const y = W.heightAt(s[0], s[1]);
      add(scene, cyl(0.05, 0.08, 4.4, 8), M.steel, s[0], y + 2.2, s[1]);
      add(scene, cyl(0.2, 0.26, 0.12, 12), M.dark, s[0], y + 0.06, s[1]);
      add(scene, box(0.55, 0.12, 0.28), M.dark, s[0], y + 4.42, s[1]);
      add(scene, box(0.46, 0.03, 0.2), M.warm, s[0], y + 4.35, s[1]).castShadow = false;
      const l = new THREE.PointLight(0xffc890, 1.5, 20, 2); l.position.set(s[0], y + 4.2, s[1]); scene.add(l);
      B.colliders.push({ x: s[0], z: s[1], r: 0.3, h: 4.8 });
    });
    // Kabel am Boden
    const lay = (pts) => {
      const v = pts.map(p => new THREE.Vector3(p[0], W.heightAt(p[0], p[1]) + 0.045, p[1]));
      const curve = new THREE.CatmullRomCurve3(v);
      const m = add(scene, new THREE.TubeGeometry(curve, pts.length * 10, 0.04, 6), M.rubber, 0, 0, 0);
      m.castShadow = false;
    };
    lay([[-3.6, 1.6], [-1, 4.5], [2.5, 6.2], [5.5, 5.8], [7.0, 6.2]]);
    lay([[-4.2, 1.8], [-6, 3.5], [-7.4, 2.6]]);
    lay([[-7.9, 1.7], [-11, 4.2], [-13.5, 7.6], [-14.3, 8.3]]);
    lay([[-13, 6.5], [-15.5, 5.6], [-17.2, 5.2]]);
    // Kisten bei der Luke
    [[-2.6, 5.4, 0.8, 0.3, M.orange], [-1.5, 6.1, 0.6, 1.1, M.white], [-2.3, 5.6, 0.5, 0.7, M.yellow]].forEach((k, i) => {
      const s = k[2], yy = W.heightAt(k[0], k[1]) + s / 2 - 0.03 + (i === 2 ? 0.8 : 0);
      add(scene, box(s, s, s), k[4], k[0], yy, k[1], 0, k[3], 0);
      add(scene, box(s * 1.03, s * 0.12, s * 1.03), M.dark, k[0], yy + s * 0.2, k[1], 0, k[3], 0);
    });
    B.colliders.push({ x: -2.3, z: 5.6, r: 0.9 });
  }

  // Tunnel-Portal am Kraterrand (in beiden Sektoren). Öffnung zeigt zur Kratermitte.
  B.portals = { 1: { x: 38, z: -64 }, 2: { x: 0, z: 113 } };
  B.arrive = { 1: { x: 33.5, z: -56.5 }, 2: { x: 0, z: 103 } };     // hier kommt man nach der Fahrt an
  function buildPortal(parent, pt, line1, line2) {
    const g = new THREE.Group(), y = W.heightAt(pt.x, pt.z);
    g.position.set(pt.x, y, pt.z); g.rotation.y = Math.atan2(-pt.x, -pt.z);
    const mCon = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.85, metalness: 0.1 });
    const mRock = new THREE.MeshStandardMaterial({ color: 0x1c1815, roughness: 1 }); mRock.envMapIntensity = 0;
    add(g, box(1.3, 5.6, 2.2), mCon, -3.6, 2.6, 0); add(g, box(1.3, 5.6, 2.2), mCon, 3.6, 2.6, 0);
    add(g, box(8.5, 1.3, 2.2), mCon, 0, 5.9, 0);
    [-3.6, 3.6].forEach(x => { add(g, box(1.34, 0.5, 2.24), M.yellow, x, 1.0, 0); add(g, box(1.34, 0.5, 2.24), M.yellow, x, 3.4, 0); });
    const hole = add(g, new THREE.PlaneGeometry(5.9, 5.3), new THREE.MeshBasicMaterial({ color: 0x010101 }), 0, 2.65, 0.6); hole.castShadow = false;
    const hill = add(g, new THREE.SphereGeometry(1, 20, 14), mRock, 0, 1.5, -9.2); hill.scale.set(9, 6.8, 8);
    [-2.2, 0, 2.2].forEach(x => add(g, box(0.5, 0.05, 2.6), M.warm, x, 0.04, 2.4).castShadow = false);
    const sign = add(g, new THREE.PlaneGeometry(6.2, 1.5), new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.1,
      emissiveMap: U.textTexture([{ text: line1, size: 66, color: '#7fe9ff', y: 74 }, { text: line2, size: 36, color: '#c9f4ff', y: 150, bold: false }], { w: 860, h: 208, bg: '#04141b', border: '#2b9db8' })
    }), 0, 5.9, 1.12);
    sign.castShadow = false;
    const lm = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2a1a, emissiveIntensity: 3 });
    add(g, new THREE.SphereGeometry(0.16, 12, 8), lm, -3.6, 5.75, 1.15); add(g, new THREE.SphereGeometry(0.16, 12, 8), lm, 3.6, 5.75, 1.15);
    const lamp = new THREE.PointLight(0xffc890, 1.3, 22, 2); lamp.position.set(0, 4.6, 3.5); g.add(lamp);
    parent.add(g);
    const c = Math.cos(g.rotation.y), s2 = Math.sin(g.rotation.y);
    [-3.6, 3.6].forEach(x => B.colliders.push({ x: pt.x + c * x, z: pt.z - s2 * x, r: 1.3, h: 7 }));
    const fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y);
    B.colliders.push({ x: pt.x - fx * 8, z: pt.z - fz * 8, r: 7, h: 9 });
    B.colliders.push({ x: pt.x - fx * 1.5, z: pt.z - fz * 1.5, r: 2.6, h: 7 });
    B.points.push({ id: 'tunnel', x: pt.x + fx * 3.5, y: y + 1.2, z: pt.z + fz * 3.5, r: 5.5 });
    return lm;
  }

  B.cols = { 1: [], 2: [] }; B.pts = { 1: [], 2: [] };
  B.build = function (scene) {
    mats();
    const root = B.root1 = new THREE.Group(); scene.add(root);
    buildShip(root); buildSilo(root); buildShop(root); buildPad(root); buildProps(root);
    B.portalLight = buildPortal(root, B.portals[1], 'TUNNEL · SEKTOR 2', 'Grünes Licht = offen · E zum Durchfahren');
  };
  // nach dem Bauen: Hindernisse und Benutzen-Punkte des Sektors merken
  B.capture = function (n) { B.cols[n] = B.colliders.slice(); B.pts[n] = B.points.slice(); };
  B.setSector = function (n) {
    B.colliders = B.cols[n].concat(W.boulders); B.points = B.pts[n];
    if (B.root1) B.root1.visible = n === 1;
    if (B.root2) B.root2.visible = n === 2;
  };
  // Außenposten in Sektor 2 (wird beim ersten Besuch gebaut; W muss schon auf Sektor 2 stehen)
  B.buildOutpost = function (scene) {
    if (B.root2) return;
    const root = B.root2 = new THREE.Group(); scene.add(root);
    B.colliders = []; B.points = [];
    buildPortal(root, B.portals[2], 'TUNNEL · SEKTOR 1', 'Zurück zur Basis').emissive.setHex(0x3dff7a);
    const st = LC.Buggy.stations[2];
    LC.Buggy.buildStation(root, st, null, 'STAUB-ANNAHME');
    B.points.push({ id: 'post', x: st.x, y: W.heightAt(st.x, st.z) + 1.1, z: st.z, r: 4.6 });
    // Funkmast und Lampen, damit man den Außenposten von weitem findet
    const mx = st.x - 8, mz = st.z + 6, my = W.heightAt(mx, mz);
    add(root, cyl(0.07, 0.12, 12, 8), M.steel, mx, my + 6, mz);
    add(root, cyl(0.5, 0.06, 0.3, 14, true), M.steel, mx, my + 10.5, mz + 0.4, 0.6);
    beacon(root, mx, my + 12.1, mz, 0xff2a1a, 1.6, 0, 26);
    B.colliders.push({ x: mx, z: mz, r: 0.4, h: 13 });
    [[st.x + 6, st.z - 6], [st.x - 2, st.z + 9], [8, 104]].forEach(p => {
      const y = W.heightAt(p[0], p[1]);
      add(root, cyl(0.05, 0.08, 4.4, 8), M.steel, p[0], y + 2.2, p[1]);
      add(root, box(0.55, 0.12, 0.28), M.dark, p[0], y + 4.42, p[1]);
      add(root, box(0.46, 0.03, 0.2), M.warm, p[0], y + 4.35, p[1]).castShadow = false;
      const l = new THREE.PointLight(0xffc890, 1.4, 20, 2); l.position.set(p[0], y + 4.2, p[1]); root.add(l);
      B.colliders.push({ x: p[0], z: p[1], r: 0.3, h: 4.8 });
    });
    const sx = st.x + 5.5, sz = st.z + 5, sy = W.heightAt(sx, sz);
    add(root, cyl(0.04, 0.05, 2.0, 6), M.steel, sx, sy + 1.0, sz);
    const sg = add(root, new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.0, side: THREE.DoubleSide,
      emissiveMap: U.textTexture([{ text: 'AUSSENPOSTEN SEKTOR 2', size: 40, color: '#ffc45a', y: 70 }, { text: 'Staub abgeben: auf die Fläche stellen, E', size: 24, color: '#e8dcc4', y: 130, bold: false }], { w: 560, h: 190, bg: '#140d04', border: '#ffb040' })
    }), sx, sy + 2.2, sz, 0, Math.atan2(-sx, 108 - sz) , 0);
    sg.castShadow = false;
    B.capture(2);
  };

  // Boden inkl. Landeplatz
  B.groundAt = function (x, z) {
    let h = W.heightAt(x, z);
    if (W.sec !== 1) return h;
    const p = B.pad, dx = x - p.x, dz = z - p.z;
    if (dx * dx + dz * dz < p.r * p.r * 0.92 && p.top > h) h = p.top;
    return h;
  };

  B.update = function (t) {
    for (let i = 0; i < B.blinkers.length; i++) {
      const b = B.blinkers[i];
      const ph = ((t / b.period + b.phase) % 1 + 1) % 1;
      const on = ph < 0.12 ? 1 : ph < 0.2 ? 0.25 : ph > 0.26 && ph < 0.34 ? 0.8 : 0.03;
      b.mat.emissiveIntensity = 0.15 + on * 5;
      if (b.light) b.light.intensity = on * b.base;
    }
  };

  LC.Base = B;
})(window.LC);
