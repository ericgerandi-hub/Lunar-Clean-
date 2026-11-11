'use strict';
/* =========================================================
   Lunar Clean – Der ganze Mond als Kugel (zweimal M) und
   die Weltraum-Szene für das Intro
   ========================================================= */
(function (LC) {
  const U = LC.U;
  const GL = { ready: false, yaw: 0, pitch: 0.25, dist: 3.4 };
  const LAT = 0.33, LON = -0.5;         // wo Sektor 1 auf dem Mond liegt
  let scene, cam, moon, marker, ring, grid, ship, shipGlow, earth, tmp = new THREE.Vector3();
  GL.markerDir = new THREE.Vector3(Math.cos(LAT) * Math.sin(LON), Math.sin(LAT), Math.cos(LAT) * Math.cos(LON));

  function moonTexture() {
    const Wd = 1024, Hd = 512, c = document.createElement('canvas'); c.width = Wd; c.height = Hd;
    const g = c.getContext('2d'), img = g.createImageData(Wd, Hd), d = img.data;
    for (let j = 0; j < Hd; j++) for (let i = 0; i < Wd; i++) {
      const u = i / Wd, v = j / Hd;
      const big = U.fbm(u * 6, v * 3, 4, 411, 6), fine = U.fbm(u * 48, v * 24, 3, 412, 48);
      const mare = U.smoothstep(0.46, 0.62, U.fbm(u * 4 + 2, v * 2 + 1, 3, 413, 4));
      let b = 0.30 + big * 0.22 + fine * 0.12 - mare * 0.13;
      const k = (j * Wd + i) * 4;
      d[k] = 255 * b * 1.06; d[k + 1] = 255 * b * 0.94; d[k + 2] = 255 * b * 0.82; d[k + 3] = 255;   // staubig-braun
    }
    g.putImageData(img, 0, 0);
    const rnd = U.rng(606);
    for (let n = 0; n < 520; n++) {
      const x = rnd() * Wd, y = Hd * (0.08 + rnd() * 0.84), r = 1.5 + Math.pow(rnd(), 3.2) * 26, sx = 1 / Math.max(0.3, Math.sin(Math.PI * y / Hd));
      for (const ox of [-Wd, 0, Wd]) {
        g.save(); g.translate(x + ox, y); g.scale(sx, 1);
        g.fillStyle = 'rgba(20,14,10,' + (0.25 + rnd() * 0.2) + ')'; g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.fill();
        g.strokeStyle = 'rgba(235,215,190,' + (0.25 + rnd() * 0.25) + ')'; g.lineWidth = Math.max(0.8, r * 0.16); g.beginPath(); g.arc(0, 0, r, 3.6, 5.9); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(0, 0, r, 0.5, 2.7); g.stroke();
        g.restore();
      }
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  }

  GL.build = function () {
    if (GL.ready) return;
    GL.ready = true;
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
    const tex = moonTexture();
    moon = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.012, roughness: 1, metalness: 0 }));
    moon.material.envMapIntensity = 0;
    scene.add(moon);
    // SphereGeometry: u=0 liegt bei -x; Markierung über lat/lon direkt als Richtung
    const sun = new THREE.DirectionalLight(0xfff3e2, 3.0); sun.position.set(2.2, 1.1, 2.6); scene.add(sun);
    scene.add(new THREE.AmbientLight(0x8898b8, 0.22));
    // Sektor-Gitter
    const pts = [];
    for (let la = -75; la <= 75; la += 15) { const y = Math.sin(la * Math.PI / 180), r = Math.cos(la * Math.PI / 180); for (let i = 0; i < 96; i++) { const a = i / 96 * 6.283, b = (i + 1) / 96 * 6.283; pts.push(r * Math.cos(a), y, r * Math.sin(a), r * Math.cos(b), y, r * Math.sin(b)); } }
    for (let lo = 0; lo < 360; lo += 15) { const a = lo * Math.PI / 180; for (let i = 0; i < 48; i++) { const p = -Math.PI / 2 + i / 48 * Math.PI, q = -Math.PI / 2 + (i + 1) / 48 * Math.PI; pts.push(Math.cos(p) * Math.cos(a), Math.sin(p), Math.cos(p) * Math.sin(a), Math.cos(q) * Math.cos(a), Math.sin(q), Math.cos(q) * Math.sin(a)); } }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x6fe6ff, transparent: true, opacity: 0.13, depthWrite: false }));
    grid.scale.setScalar(1.003); scene.add(grid);
    // Sektor 1: heller, geputzter Fleck + pulsierender Ring
    marker = new THREE.Group(); marker.position.copy(GL.markerDir).multiplyScalar(1.004); marker.lookAt(GL.markerDir.clone().multiplyScalar(3));
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.7, 3.0) })); marker.add(spot);
    GL.spot = spot;
    ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.036, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 2.2, 2.6), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    marker.add(ring); scene.add(marker);
    // Sterne
    const rnd = U.rng(909), sp = new Float32Array(2400 * 3);
    for (let i = 0; i < 2400; i++) { const u = rnd() * 2 - 1, a = rnd() * 6.283, s = Math.sqrt(1 - u * u); sp[i * 3] = s * Math.cos(a) * 150; sp[i * 3 + 1] = u * 150; sp[i * 3 + 2] = s * Math.sin(a) * 150; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false })));
    // Erde in der Ferne (für das Intro)
    earth = new THREE.Mesh(new THREE.SphereGeometry(2.2, 40, 28), new THREE.MeshStandardMaterial({ color: 0x2a62c8, roughness: 0.7, emissive: 0x0a1c44, emissiveIntensity: 0.6 }));
    earth.material.envMapIntensity = 0; earth.position.set(-26, 6, -34); scene.add(earth);
    const cl = new THREE.Mesh(new THREE.SphereGeometry(2.24, 40, 28), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.35 })); cl.material.envMapIntensity = 0; earth.add(cl);
    // kleines Schiff (nur im Intro sichtbar)
    ship = new THREE.Group();
    const mW = new THREE.MeshStandardMaterial({ color: 0xc8c5bd, roughness: 0.5, metalness: 0.3 }), mO = new THREE.MeshStandardMaterial({ color: 0xc9581a, roughness: 0.5 });
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 1.0, 16), mW); hull.rotation.x = Math.PI / 2; ship.add(hull);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 16), mW); nose.rotation.x = -Math.PI / 2; nose.position.z = -0.75; ship.add(nose);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.12, 16), mO); band.rotation.x = Math.PI / 2; band.position.z = -0.3; ship.add(band);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.4), mW); wing.position.z = 0.25; ship.add(wing);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.3), mW); fin.position.set(0, 0.22, 0.35); ship.add(fin);
    shipGlow = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 5, 9) })); shipGlow.position.z = 0.56; shipGlow.scale.z = 2.2; ship.add(shipGlow);
    ship.visible = false; scene.add(ship);
    GL.scene = scene; GL.camera = cam;
  };

  GL.open = function () {
    GL.build();
    GL.yaw = LON + 0.35; GL.pitch = LAT + 0.1; GL.dist = 3.4; ship.visible = false;
  };
  GL.drag = function (dx, dy) { GL.yaw -= dx * 0.006; GL.pitch = U.clamp(GL.pitch + dy * 0.006, -1.45, 1.45); };
  GL.zoom = function (dir) { GL.dist = U.clamp(GL.dist * (dir > 0 ? 1.12 : 1 / 1.12), 1.35, 7); };

  // gibt die Bildschirm-Position der Sektor-Markierung zurück (oder null, wenn auf der Rückseite)
  GL.update = function (dt, t, aspect, out) {
    cam.aspect = aspect; cam.updateProjectionMatrix();
    const cp = Math.cos(GL.pitch);
    cam.position.set(Math.sin(GL.yaw) * cp * GL.dist, Math.sin(GL.pitch) * GL.dist, Math.cos(GL.yaw) * cp * GL.dist);
    cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
    const p = 1 + (t * 0.9 % 1) * 1.6; ring.scale.setScalar(p); ring.material.opacity = 0.95 * (1 - (t * 0.9 % 1));
    const facing = tmp.copy(cam.position).normalize().dot(GL.markerDir);
    if (facing < 0.12) return null;
    tmp.copy(GL.markerDir).project(cam);
    out.x = tmp.x; out.y = tmp.y;
    return out;
  };

  // Intro: Schiff fliegt auf den Mond zu. u = 0..1
  GL.intro = function (u, t, aspect) {
    GL.build();
    cam.aspect = aspect; cam.updateProjectionMatrix();
    ship.visible = true;
    const e = u * u * (3 - 2 * u);
    cam.position.set(0.6 + e * 0.5, 0.9 - e * 0.2, 6.2 - e * 1.2); cam.lookAt(0.2, 0.25, 0); cam.updateMatrixWorld();
    const from = tmp.set(1.9, 0.95, 5.4), to = GL.markerDir.clone().multiplyScalar(1.25);
    ship.position.copy(from).lerp(to, Math.pow(u, 1.25));
    ship.lookAt(to); ship.rotateY(Math.PI);          // Nase (-z) zeigt zum Ziel
    ship.rotateZ(Math.sin(t * 1.3) * 0.08);
    ship.scale.setScalar(0.34 - u * 0.2);
    shipGlow.scale.set(1 + Math.random() * 0.25, 1 + Math.random() * 0.25, 2 + Math.random() * 0.8);
    ring.scale.setScalar(1); ring.material.opacity = 0;
  };

  LC.Globe = GL;
})(window.LC);
