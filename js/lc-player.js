'use strict';
/* =========================================================
   Lunar Clean – Spieler: laufen, springen, Jetpack, Blick
   ========================================================= */
(function (LC) {
  const U = LC.U, W = LC.World, B = LC.Base;
  const P = {};
  const G = 2.6;            // Mondschwerkraft (leicht angehoben, damit es sich gut steuert)
  const JUMP = 3.7, WALK = 4.1, RUN = 6.4, EYE = 1.7, RADIUS = 0.45;

  P.pos = new THREE.Vector3(); P.vel = new THREE.Vector3();
  P.yaw = 0; P.pitch = 0; P.onGround = true;
  P.fuel = 1; P.jetting = false; P.airTime = 0;
  P.bob = 0; P.bobAmt = 0; P.dip = 0; P.speed = 0;
  P.sprint = false; P.crouch = false; P.eye = EYE; P.descending = false;
  let idleT = 0;
  P.keys = {}; P.mdx = 0; P.mdy = 0; P.sens = 1; P.lookDX = 0; P.lookDY = 0;
  P.atLimit = false;
  let spaceWasUp = true, stepSide = 0;

  P.reset = function (x, z, yaw) {
    P.pos.set(x, B.groundAt(x, z), z); P.vel.set(0, 0, 0);
    P.yaw = yaw || 0; P.pitch = -0.04; P.onGround = true; P.fuel = 1; P.sprint = false; P.crouch = false; P.eye = EYE;
  };

  P.forward = function (out) {
    const cp = Math.cos(P.pitch);
    return out.set(-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp);
  };

  // cfg: {jet: bool, fuelTime: Sekunden}; ev: Rückrufe für Ton/Staub
  P.update = function (dt, cfg, ev) {
    // Blick
    P.lookDX = P.mdx; P.lookDY = P.mdy;
    P.yaw -= P.mdx * 0.0022 * P.sens; P.pitch -= P.mdy * 0.0022 * P.sens;
    P.pitch = U.clamp(P.pitch, -1.5, 1.5);
    P.mdx = 0; P.mdy = 0;

    const k = P.keys;
    const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    let wx = -sy * f + cy * s, wz = -cy * f - sy * s;
    const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    // Sprint und Hocke werden per Tastendruck umgeschaltet (Shift / C)
    if (wl === 0) { idleT += dt; if (idleT > 0.35) P.sprint = false; } else idleT = 0;
    if (P.crouch) P.sprint = false;
    const run = P.sprint;
    const top = P.crouch ? 2.0 : run ? RUN : WALK;
    const space = !!k.Space;

    if (P.onGround) {
      const a = Math.min(1, 8.5 * dt);
      P.vel.x += (wx * top - P.vel.x) * a; P.vel.z += (wz * top - P.vel.z) * a;
      P.fuel = Math.min(1, P.fuel + dt / 2.2);
      if (space && spaceWasUp) {
        P.vel.y = JUMP; P.onGround = false; P.airTime = 0; P.crouch = false;
        ev.jump && ev.jump();
      }
    } else {
      const acc = P.jetting ? 9 : 3.2;
      P.vel.x += wx * acc * dt; P.vel.z += wz * acc * dt;
      const hs = Math.hypot(P.vel.x, P.vel.z), cap = P.jetting ? 9.5 : Math.max(top, 6.6);
      if (hs > cap) { const q = Math.pow(cap / hs, Math.min(1, dt * 4)); P.vel.x *= q; P.vel.z *= q; }
      P.airTime += dt;
    }
    spaceWasUp = !space;

    // Jetpack: Leertaste in der Luft gedrückt halten
    P.jetting = false;
    if (cfg.jet && !P.onGround && space && P.airTime > 0.16 && P.fuel > 0) {
      P.jetting = true;
      P.vel.y += 7.2 * dt; if (P.vel.y > 7) P.vel.y = 7;
      P.fuel = Math.max(0, P.fuel - dt / cfg.fuelTime);
    }

    // Jetpack: C in der Luft gedrückt halten = schneller nach unten
    P.descending = false;
    if (cfg.jet && !P.onGround && k.KeyC && !space) { P.descending = true; P.vel.y -= 9 * dt; if (P.vel.y < -11) P.vel.y = -11; }

    P.vel.y -= G * dt;
    P.eye += ((P.crouch ? 1.02 : EYE) - P.eye) * Math.min(1, dt * 9);
    P.pos.x += P.vel.x * dt; P.pos.y += P.vel.y * dt; P.pos.z += P.vel.z * dt;

    // Hindernisse
    const cols = B.colliders;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i], dx = P.pos.x - c.x, dz = P.pos.z - c.z, rr = c.r + RADIUS;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        if (P.pos.y - W.heightAt(c.x, c.z) > (c.h || 3.2)) continue;   // drüber geflogen
        const d = Math.sqrt(d2), push = (rr - d) / d;
        P.pos.x += dx * push; P.pos.z += dz * push;
        const nx = dx / d, nz = dz / d, vn = P.vel.x * nx + P.vel.z * nz;
        if (vn < 0) { P.vel.x -= nx * vn; P.vel.z -= nz * vn; }
      }
    }
    // Kraterrand: weiter geht es (noch) nicht
    const r = Math.hypot(P.pos.x, P.pos.z);
    P.atLimit = false;
    if (r > W.LIMIT) {
      const nx = P.pos.x / r, nz = P.pos.z / r;
      P.pos.x = nx * W.LIMIT; P.pos.z = nz * W.LIMIT;
      const vn = P.vel.x * nx + P.vel.z * nz;
      if (vn > 0) { P.vel.x -= nx * vn; P.vel.z -= nz * vn; }
      P.atLimit = true;
    }

    // Boden
    const g = B.groundAt(P.pos.x, P.pos.z);
    if (P.pos.y <= g) {
      if (!P.onGround) {
        const impact = -P.vel.y;
        if (impact > 1.2) { P.dip = Math.min(0.32, impact * 0.045); ev.land && ev.land(impact); }
      }
      P.pos.y = g; P.vel.y = 0; P.onGround = true;
    } else if (P.onGround && P.pos.y - g < 0.4 && P.vel.y <= 0) {
      P.pos.y = g; P.vel.y = 0;
    } else {
      P.onGround = false;
    }

    // Schritt-Wippen
    P.speed = Math.hypot(P.vel.x, P.vel.z);
    const moving = P.onGround && P.speed > 0.6;
    P.bobAmt += ((moving ? 1 : 0) - P.bobAmt) * Math.min(1, dt * 6);
    if (moving) {
      const before = Math.floor(P.bob / Math.PI);
      P.bob += P.speed * dt * 1.05;
      if (Math.floor(P.bob / Math.PI) !== before) { stepSide = 1 - stepSide; ev.step && ev.step(stepSide); }
    }
    P.dip += (0 - P.dip) * Math.min(1, dt * 5);
  };

  P.applyCamera = function (cam) {
    const bobY = Math.abs(Math.sin(P.bob)) * 0.055 * P.bobAmt;
    const bobX = Math.cos(P.bob) * 0.02 * P.bobAmt;
    cam.position.set(P.pos.x + Math.cos(P.yaw) * bobX, P.pos.y + P.eye + bobY - P.dip, P.pos.z - Math.sin(P.yaw) * bobX);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(P.pitch, P.yaw, 0);
  };

  LC.Player = P;
})(window.LC);
