'use strict';
/* =========================================================
   Lunar Clean – Intro: Anflug, Absturz, Blackout, Aufwachen
   (überspringbar mit Leertaste, Enter oder Mausklick)
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World, B = LC.Base, PL = LC.Player, V = LC.Vacuum, A = LC.Audio, GL = LC.Globe;
  const CS = { active: false, t: 0, view: 'globe' };
  const T1 = 8.2, T2 = 13.6, T3 = 17.4, T4 = 24.6;      // Anflug | Absturz | schwarz | Aufwachen
  const LINES = [
    { t: 0.6, end: 4.2, txt: 'Logbuch LC-01. Auftrag: Mondstaub einsammeln und zur Erde bringen.' },
    { t: 4.5, end: 8.0, txt: 'Reine Routine. Hinfliegen, einladen, zum Abendessen wieder daheim.' },
    { t: 8.5, end: 10.6, txt: 'WARNUNG · TRIEBWERK 2 AUSGEFALLEN', cls: 'alert' },
    { t: 10.8, end: 13.4, txt: 'Nein, nein, nein – nicht jetzt! Festhalten!' },
    { t: 14.6, end: 15.6, txt: '…' },
    { t: 15.8, end: 17.2, txt: 'Au. Mein Kopf.' },
    { t: 18.0, end: 21.0, txt: 'Okay … Schiff Schrott, Funk tot. Hier holt mich keiner ab.' },
    { t: 21.3, end: 24.4, txt: 'Dann verdiene ich mir die Rakete nach Hause eben selbst. Mit … einem Löffel.' }
  ];
  let ctx = null, clone = null, lastLine = -2, alarmT = 0, boomed = false, scene = null;
  const start = new THREE.Vector3(), end = new THREE.Vector3(), tmp = new THREE.Vector3(), camP = new THREE.Vector3();

  // c: {scene, camera, sub(text, cls), fade(0..1), flash(0..1), done()}
  CS.start = function (c) {
    ctx = c; scene = c.scene; CS.active = true; CS.t = 0; CS.view = 'globe'; lastLine = -2; alarmT = 0; boomed = false;
    GL.build();
    const f = W.furrow;
    end.copy(B.ship.position);
    start.set(end.x - f.dir.x * 190, end.y + 78, end.z - f.dir.z * 190);
    clone = B.ship.clone(true); clone.visible = false; scene.add(clone);
    camP.set(end.x + 16, W.heightAt(end.x + 16, end.z + 30) + 5.5, end.z + 30);
    ctx.fade(0); ctx.flash(0); ctx.sub('', '');
  };

  function cleanup() {
    if (clone) { scene.remove(clone); clone = null; }
    B.ship.visible = true;
    A.setJet(0);
  }
  CS.skip = function () { if (CS.active && CS.t > 0.6) finish(); };
  function finish() {
    if (!CS.active) return;
    CS.active = false; cleanup();
    ctx.fade(1); ctx.flash(0); ctx.sub('', '');
    ctx.done();
  }

  CS.update = function (dt, aspect) {
    if (!CS.active) return;
    CS.t += dt; const t = CS.t;
    // Untertitel
    let li = -1;
    for (let i = 0; i < LINES.length; i++) if (t >= LINES[i].t && t < LINES[i].end) li = i;
    if (li !== lastLine) { lastLine = li; if (li >= 0) ctx.sub(LINES[li].txt, LINES[li].cls || ''); else ctx.sub('', ''); }

    if (t < T1) {
      // 1) Anflug auf den Mond
      CS.view = 'globe';
      GL.intro(t / T1, t, aspect);
      ctx.fade(Math.min(1, t / 1.2) * Math.min(1, (T1 - t) / 0.5));
      A.setJet(0.12);
    } else if (t < T2) {
      // 2) Absturz in den Krater
      CS.view = 'world';
      const u = (t - T1) / (T2 - T1 - 0.25), k = Math.min(1, u);
      B.ship.visible = k >= 1;
      if (k < 1) {
        clone.visible = true;
        const e = Math.pow(k, 1.15);
        clone.position.copy(start).lerp(end, e);
        clone.rotation.copy(B.ship.rotation);
        clone.rotation.z = U.lerp(-0.5, B.ship.rotation.z, Math.pow(k, 3)); clone.rotation.x = B.ship.rotation.x + Math.sin(t * 9) * 0.12 * (1 - k);
        const f = W.furrow;
        for (let i = 0; i < 7; i++) {
          V.spawn(clone.position.x - f.dir.x * 5.5 + (Math.random() - 0.5), clone.position.y + 0.8 + (Math.random() - 0.5), clone.position.z - f.dir.z * 5.5 + (Math.random() - 0.5),
            -f.dir.x * 6 + (Math.random() - 0.5) * 5, 2 + Math.random() * 4, -f.dir.z * 6 + (Math.random() - 0.5) * 5, 0, 0.9 + Math.random() * 0.8, 0.22 + Math.random() * 0.3,
            3.2, 1.5 + Math.random(), 0.3, 0.06);
        }
        alarmT -= dt; if (alarmT <= 0) { alarmT = 0.55; A.play('alarm'); }
        A.setJet(0.5 + k * 0.5);
      } else {
        clone.visible = false;
        if (!boomed) {
          boomed = true; A.play('boom'); A.setJet(0);
          for (let i = 0; i < 160; i++) {
            const a = Math.random() * 6.283, sp = 2 + Math.random() * 9, c = 0.3 + Math.random() * 0.4;
            V.spawn(end.x + Math.cos(a) * 2, end.y, end.z + Math.sin(a) * 2, Math.cos(a) * sp, 2 + Math.random() * 8, Math.sin(a) * sp, 0, 2 + Math.random() * 2, 0.15 + Math.random() * 0.35, c, c * 0.9, c * 0.8, 0.6);
          }
        }
      }
      const sh = k >= 1 ? 0.5 : k * 0.06;
      ctx.camera.position.set(camP.x + (Math.random() - 0.5) * sh, camP.y + (Math.random() - 0.5) * sh, camP.z + (Math.random() - 0.5) * sh);
      tmp.copy(k < 1 ? clone.position : end); tmp.y += 1;
      ctx.camera.lookAt(tmp); ctx.camera.updateMatrixWorld();
      ctx.fade(k < 1 ? Math.min(1, (t - T1) / 0.4) : Math.max(0, 1 - (t - (T2 - 0.25)) / 0.25));
      ctx.flash(k >= 1 ? Math.max(0, 1 - (t - (T2 - 0.25)) / 0.2) : 0);
    } else if (t < T3) {
      // 3) Blackout
      CS.view = 'world'; cleanup(); ctx.fade(0); ctx.flash(0);
    } else if (t < T4) {
      // 4) Aufwachen: blinzeln, Kopf heben
      CS.view = 'world';
      const u = (t - T3) / (T4 - T3), w = U.smoothstep(0, 0.55, u);
      const save = PL.pitch;
      PL.pitch = U.lerp(-1.25, -0.04, w);
      PL.applyCamera(ctx.camera);
      ctx.camera.position.y -= (1 - w) * 0.95;
      ctx.camera.rotation.z = (1 - w) * 0.55;
      ctx.camera.updateMatrixWorld();
      PL.pitch = save;
      const tt = t - T3;
      const blink = tt < 0.5 ? tt / 0.5 * 0.7 : tt < 0.9 ? 0.7 - (tt - 0.5) / 0.4 * 0.6 : tt < 1.6 ? 0.1 + (tt - 0.9) / 0.7 * 0.9 : 1;
      ctx.fade(blink);
    } else finish();
  };

  LC.Cutscene = CS;
})(window.LC);
