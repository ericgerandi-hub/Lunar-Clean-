'use strict';
/* =========================================================
   Lunar Clean – Astronauten-Figur und Emotes
   (wird auch für Mitspieler im Mehrspieler gebraucht)
   ========================================================= */
(function (LC) {
  const AV = {};
  AV.EMOTES = [
    { id: 'wave', name: 'Winken', dur: 2.8 },
    { id: 'cheer', name: 'Jubeln', dur: 2.8 },
    { id: 'dance', name: 'Tanzen', dur: 4.6 },
    { id: 'thumb', name: 'Daumen hoch', dur: 2.4 },
    { id: 'sit', name: 'Hinsetzen', dur: 4.0 },
    { id: 'flip', name: 'Salto', dur: 2.6 }
  ];

  // Figur bauen. Blickrichtung = -z (wie die Kamera)
  AV.build = function (color) {
    const mSuit = new THREE.MeshStandardMaterial({ color: 0xcfccc5, roughness: 0.8 });
    const mGrey = new THREE.MeshStandardMaterial({ color: 0x6f747a, roughness: 0.6, metalness: 0.3 });
    const mAcc = new THREE.MeshStandardMaterial({ color: color || 0xd4601a, roughness: 0.55 });
    const mVisor = new THREE.MeshStandardMaterial({ color: 0x3a2a08, roughness: 0.08, metalness: 1.0, emissive: 0x2a1c04, emissiveIntensity: 0.5 });
    const mBoot = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.8 });
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const mesh = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || body).add(m); return m; };
    // Rumpf, Tornister, Helm
    mesh(new THREE.BoxGeometry(0.52, 0.62, 0.34), mSuit, 0, 1.15, 0);
    mesh(new THREE.BoxGeometry(0.54, 0.08, 0.36), mAcc, 0, 0.88, 0);
    mesh(new THREE.BoxGeometry(0.2, 0.16, 0.04), mGrey, 0, 1.22, -0.18);
    mesh(new THREE.BoxGeometry(0.44, 0.66, 0.22), mGrey, 0, 1.2, 0.27);
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), mAcc, 0.14, 1.62, 0.3);
    const head = new THREE.Group(); head.position.set(0, 1.5, 0); body.add(head);
    mesh(new THREE.SphereGeometry(0.25, 20, 14), mSuit, 0, 0.2, 0, head);
    const vis = mesh(new THREE.SphereGeometry(0.2, 20, 12), mVisor, 0, 0.2, -0.085, head); vis.scale.set(1, 0.82, 1);
    mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.07, 16), mGrey, 0, 0.0, 0, head);
    // Arme (Drehpunkt an der Schulter)
    const arm = side => {
      const g = new THREE.Group(); g.position.set(side * 0.34, 1.4, 0); body.add(g);
      const up = mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.34, 10), mSuit, 0, -0.17, 0, g);
      const fore = new THREE.Group(); fore.position.set(0, -0.34, 0); g.add(fore);
      mesh(new THREE.CylinderGeometry(0.072, 0.066, 0.3, 10), mSuit, 0, -0.15, 0, fore);
      mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 10), mAcc, 0, -0.27, 0, fore);
      mesh(new THREE.SphereGeometry(0.075, 10, 8), mGrey, 0, -0.35, 0, fore);
      return { g, fore };
    };
    const leg = side => {
      const g = new THREE.Group(); g.position.set(side * 0.14, 0.86, 0); body.add(g);
      mesh(new THREE.CylinderGeometry(0.105, 0.095, 0.42, 10), mSuit, 0, -0.21, 0, g);
      const shin = new THREE.Group(); shin.position.set(0, -0.42, 0); g.add(shin);
      mesh(new THREE.CylinderGeometry(0.09, 0.085, 0.34, 10), mSuit, 0, -0.17, 0, shin);
      mesh(new THREE.BoxGeometry(0.17, 0.12, 0.3), mBoot, 0, -0.38, -0.05, shin);
      return { g, shin };
    };
    const av = { root, body, head, aL: arm(-1), aR: arm(1), lL: leg(-1), lR: leg(1) };
    root.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    return av;
  };

  function rest(av) {
    av.body.position.set(0, 0, 0); av.body.rotation.set(0, 0, 0); av.head.rotation.set(0, 0, 0);
    [av.aL, av.aR].forEach((a, i) => { a.g.rotation.set(0, 0, i ? 0.12 : -0.12); a.fore.rotation.set(-0.15, 0, 0); });
    [av.lL, av.lR].forEach(l => { l.g.rotation.set(0, 0, 0); l.shin.rotation.set(0, 0, 0); });
  }
  AV.rest = rest;

  // Laufen (für Mitspieler): phase läuft mit der Strecke
  AV.walk = function (av, phase, amt) {
    rest(av);
    const s = Math.sin(phase) * 0.6 * amt;
    av.lL.g.rotation.x = s; av.lR.g.rotation.x = -s;
    av.lL.shin.rotation.x = Math.max(0, -s) * 0.9; av.lR.shin.rotation.x = Math.max(0, s) * 0.9;
    av.aL.g.rotation.x = -s * 0.7; av.aR.g.rotation.x = s * 0.7;
    av.body.position.y = Math.abs(Math.cos(phase)) * 0.05 * amt;
  };

  // Emote zum Zeitpunkt t (Sekunden) einstellen. k = Ein-/Ausblenden 0..1
  AV.pose = function (av, id, t, dur) {
    rest(av);
    const k = Math.min(1, t / 0.3, (dur - t) / 0.3), s = Math.sin, PI = Math.PI;
    if (id === 'wave') {
      av.aR.g.rotation.set(0, 0, (2.55 + s(t * 9) * 0.28) * k + 0.12 * (1 - k));
      av.aR.fore.rotation.set(0, 0, s(t * 9 + 0.6) * 0.5 * k);
      av.head.rotation.z = -0.12 * k; av.body.rotation.z = -0.05 * k;
    } else if (id === 'cheer') {
      const j = Math.max(0, s(t * 4.2)) * k;
      av.body.position.y = j * 0.45;
      av.aL.g.rotation.set(0, 0, -(2.7 + s(t * 12) * 0.15) * k); av.aR.g.rotation.set(0, 0, (2.7 + s(t * 12 + 1) * 0.15) * k);
      av.lL.g.rotation.x = -j * 0.35; av.lR.g.rotation.x = -j * 0.35; av.lL.shin.rotation.x = j * 0.7; av.lR.shin.rotation.x = j * 0.7;
      av.head.rotation.x = -0.25 * k;
    } else if (id === 'dance') {
      const b = t * 5.2;
      av.body.position.y = Math.abs(s(b)) * 0.1 * k; av.body.rotation.y = s(b * 0.5) * 0.5 * k; av.body.rotation.z = s(b) * 0.1 * k;
      av.aL.g.rotation.set(-(1.2 + s(b) * 0.6) * k, 0, -0.5 * k); av.aR.g.rotation.set(-(1.2 - s(b) * 0.6) * k, 0, 0.5 * k);
      av.aL.fore.rotation.x = -(0.9 + s(b + 1) * 0.4) * k; av.aR.fore.rotation.x = -(0.9 - s(b + 1) * 0.4) * k;
      av.lL.g.rotation.x = Math.max(0, s(b)) * -0.5 * k; av.lL.shin.rotation.x = Math.max(0, s(b)) * 0.9 * k;
      av.lR.g.rotation.x = Math.max(0, -s(b)) * -0.5 * k; av.lR.shin.rotation.x = Math.max(0, -s(b)) * 0.9 * k;
      av.head.rotation.y = s(b * 0.5 + 1) * 0.3 * k;
    } else if (id === 'thumb') {
      av.aR.g.rotation.set(-1.45 * k, 0, 0.15); av.aR.fore.rotation.set(-0.5 * k + s(t * 7) * 0.08 * k, 0, 0);
      av.head.rotation.x = s(t * 6) * 0.08 * k; av.body.rotation.x = -0.05 * k;
    } else if (id === 'sit') {
      av.body.position.y = -0.52 * k; av.body.rotation.x = 0.12 * k;
      av.lL.g.rotation.x = -1.5 * k; av.lR.g.rotation.x = -1.5 * k; av.lL.g.rotation.z = -0.15 * k; av.lR.g.rotation.z = 0.15 * k;
      av.lL.shin.rotation.x = 0.5 * k; av.lR.shin.rotation.x = 0.5 * k;
      av.aL.g.rotation.set(0.5 * k, 0, -0.35 * k); av.aR.g.rotation.set(0.5 * k, 0, 0.35 * k);
      av.head.rotation.x = -0.3 * k + s(t * 0.9) * 0.05;
    } else if (id === 'flip') {
      const u = Math.min(1, Math.max(0, (t - 0.3) / (dur - 0.7)));
      av.body.position.y = 4 * u * (1 - u) * 1.9;
      const body = av.body; body.rotation.x = u * PI * 2;
      // um die Körpermitte drehen statt um die Füße
      const c = 1.1; body.position.y += c - Math.cos(u * PI * 2) * c; body.position.z = -Math.sin(u * PI * 2) * c;
      const tuck = Math.sin(u * PI);
      av.lL.g.rotation.x = -1.3 * tuck; av.lR.g.rotation.x = -1.3 * tuck; av.lL.shin.rotation.x = 1.6 * tuck; av.lR.shin.rotation.x = 1.6 * tuck;
      av.aL.g.rotation.x = -0.9 * tuck; av.aR.g.rotation.x = -0.9 * tuck;
    }
  };

  LC.Avatar = AV;
})(window.LC);
