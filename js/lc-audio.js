'use strict';
/* =========================================================
   Lunar Clean – Ton: alles wird live erzeugt (keine Dateien)
   ========================================================= */
(function (LC) {
  const A = { ctx: null, vol: 0.7, music: true };
  let master, noiseBuf, vacNoise, vacBP, vacNoiseG, vacOsc, vacOsc2, vacOscG, vacLP, jetG, jetLP, musicG, musicTimer = 0, delay;

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = A.ctx = new AC();
    master = c.createGain(); master.gain.value = A.vol; master.connect(c.destination);

    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noiseSrc = () => { const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(); return s; };

    // Sauger: Rauschen + brummender Motor
    vacNoise = noiseSrc();
    vacBP = c.createBiquadFilter(); vacBP.type = 'bandpass'; vacBP.frequency.value = 600; vacBP.Q.value = 0.7;
    vacNoiseG = c.createGain(); vacNoiseG.gain.value = 0;
    vacNoise.connect(vacBP); vacBP.connect(vacNoiseG); vacNoiseG.connect(master);
    vacOsc = c.createOscillator(); vacOsc.type = 'sawtooth'; vacOsc.frequency.value = 60;
    vacOsc2 = c.createOscillator(); vacOsc2.type = 'square'; vacOsc2.frequency.value = 121;
    vacLP = c.createBiquadFilter(); vacLP.type = 'lowpass'; vacLP.frequency.value = 500;
    vacOscG = c.createGain(); vacOscG.gain.value = 0;
    vacOsc.connect(vacLP); vacOsc2.connect(vacLP); vacLP.connect(vacOscG); vacOscG.connect(master);
    vacOsc.start(); vacOsc2.start();

    // Jetpack
    const jn = noiseSrc();
    jetLP = c.createBiquadFilter(); jetLP.type = 'lowpass'; jetLP.frequency.value = 500;
    jetG = c.createGain(); jetG.gain.value = 0;
    jn.connect(jetLP); jetLP.connect(jetG); jetG.connect(master);

    // leises Anzug-Rauschen
    const an = noiseSrc(), alp = c.createBiquadFilter(); alp.type = 'lowpass'; alp.frequency.value = 220;
    const ag = c.createGain(); ag.gain.value = 0.035;
    an.connect(alp); alp.connect(ag); ag.connect(master);

    // Musik: weiche Flächen mit Echo
    musicG = c.createGain(); musicG.gain.value = A.music ? 1 : 0;
    delay = c.createDelay(1.5); delay.delayTime.value = 0.62;
    const fb = c.createGain(); fb.gain.value = 0.48;
    const mlp = c.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 1500;
    musicG.connect(mlp); mlp.connect(master); mlp.connect(delay); delay.connect(fb); fb.connect(mlp);
  };

  A.setVolume = function (v) { A.vol = v; if (master) master.gain.setTargetAtTime(v, A.ctx.currentTime, 0.05); };
  A.setMusic = function (on) { A.music = on; if (musicG) musicG.gain.setTargetAtTime(on ? 1 : 0, A.ctx.currentTime, 0.4); };

  // intensity 0..1, sputter = Motor stottert
  A.setVac = function (intensity, load, sputter) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime, j = sputter ? (Math.random() - 0.5) * 30 : 0;
    vacNoiseG.gain.setTargetAtTime(intensity * (0.10 + load * 0.10), t, 0.05);
    vacBP.frequency.setTargetAtTime(450 + intensity * 900 + load * 700, t, 0.08);
    vacOscG.gain.setTargetAtTime(intensity * 0.075, t, 0.05);
    vacOsc.frequency.setTargetAtTime(48 + intensity * 62 + j, t, 0.06);
    vacOsc2.frequency.setTargetAtTime(97 + intensity * 125 + j * 2, t, 0.06);
    vacLP.frequency.setTargetAtTime(250 + intensity * 500, t, 0.08);
  };

  let bugOsc, bugG, bugLP;
  A.setBuggy = function (on, speed) {
    if (!A.ctx) return;
    const c = A.ctx, t = c.currentTime;
    if (!bugOsc) {
      bugOsc = c.createOscillator(); bugOsc.type = 'sawtooth'; bugLP = c.createBiquadFilter(); bugLP.type = 'lowpass'; bugLP.frequency.value = 300;
      bugG = c.createGain(); bugG.gain.value = 0; bugOsc.connect(bugLP); bugLP.connect(bugG); bugG.connect(master); bugOsc.start();
    }
    bugG.gain.setTargetAtTime(on ? 0.05 + Math.min(0.06, speed * 0.006) : 0, t, 0.08);
    bugOsc.frequency.setTargetAtTime(38 + speed * 9, t, 0.08);
    bugLP.frequency.setTargetAtTime(220 + speed * 60, t, 0.1);
  };

  A.setJet = function (v) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    jetG.gain.setTargetAtTime(v * 0.22, t, 0.04);
    jetLP.frequency.setTargetAtTime(300 + v * 900, t, 0.05);
  };

  function tone(freq, dur, type, vol, when, slideTo) {
    const c = A.ctx, t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  A.play = function (name, p) {
    if (!A.ctx) return;
    switch (name) {
      case 'step': tone(70 + Math.random() * 20, 0.12, 'sine', 0.10, 0, 38); break;
      case 'land': tone(95, 0.3, 'sine', Math.min(0.4, 0.12 + (p || 0) * 0.04), 0, 32); break;
      case 'jump': tone(120, 0.16, 'sine', 0.08, 0, 190); break;
      case 'coin': tone(880 + (p || 0) * 40, 0.09, 'triangle', 0.07); tone(1320 + (p || 0) * 40, 0.12, 'triangle', 0.05, 0.03); break;
      case 'sold': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.09, i * 0.08)); break;
      case 'buy': [392, 494, 587, 784].forEach((f, i) => tone(f, 0.5, 'sine', 0.10, i * 0.06)); tone(196, 0.7, 'sawtooth', 0.04); break;
      case 'deny': tone(180, 0.16, 'square', 0.05); tone(140, 0.22, 'square', 0.05, 0.12); break;
      case 'full': tone(660, 0.12, 'square', 0.045); tone(660, 0.12, 'square', 0.045, 0.2); break;
      case 'scoop': {
        const c = A.ctx, t = c.currentTime, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(260, t + 0.2); f.Q.value = 0.9;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(p ? 0.16 : 0.06, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random()); src.stop(t + 0.3);
        break;
      }
      case 'alarm': tone(880, 0.16, 'square', 0.06); tone(660, 0.16, 'square', 0.06, 0.2); break;
      case 'boom': {
        const c = A.ctx, t = c.currentTime, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        src.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(60, t + 1.6);
        g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + 2.3);
        tone(70, 1.4, 'sine', 0.6, 0, 24);
        break;
      }
      case 'thump': tone(110, 0.22, 'sine', 0.2, 0, 45); break;
      case 'engine': break;
      case 'click': tone(1200, 0.04, 'square', 0.03); break;
      case 'glit': tone(1800 + Math.random() * 1400, 0.25, 'sine', 0.035); break;
      case 'spark': tone(2400 + Math.random() * 900, 0.05, 'sawtooth', 0.03, 0, 300); break;
      case 'goal': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.9, 'triangle', 0.08, i * 0.11)); break;
    }
  };

  // Musik: alle paar Sekunden ein paar lange Töne
  const SCALE = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0, 523.25];
  function padNote(freq, vol) {
    const c = A.ctx, t = c.currentTime;
    [0, 4].forEach(det => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = det ? 'triangle' : 'sine'; o.frequency.value = freq; o.detune.value = det ? 7 : -5;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * (det ? 0.5 : 1), t + 2.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 9);
      o.connect(g); g.connect(musicG); o.start(t); o.stop(t + 9.2);
    });
  }
  A.update = function (dt) {
    if (!A.ctx || !A.music) return;
    musicTimer -= dt;
    if (musicTimer <= 0) {
      musicTimer = 5 + Math.random() * 5;
      const root = Math.floor(Math.random() * 5);
      padNote(SCALE[root] / 2, 0.05);
      padNote(SCALE[root + 2 + Math.floor(Math.random() * 2)], 0.035);
      if (Math.random() < 0.6) padNote(SCALE[Math.min(9, root + 4 + Math.floor(Math.random() * 2))], 0.022);
    }
  };

  LC.Audio = A;
})(window.LC);
