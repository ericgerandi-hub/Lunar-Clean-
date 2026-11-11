'use strict';
/* =========================================================
   Lunar Clean – Netz: direkte Verbindung zwischen den Browsern
   (WebRTC über PeerJS, wie bei Orbitalbrigade). Stern-Form:
   alle Gäste sind mit dem Gastgeber verbunden, er leitet weiter.
   Zum Testen ohne Internet: ?net=bc nutzt einen BroadcastChannel.
   ========================================================= */
(function (LC) {
  const PREFIX = 'lunarclean-v1-';
  const N = { role: null, id: null, open: false, code: '' };
  const TEST_BC = /[?&]net=bc/.test(location.search);
  let peer = null, conns = {}, hostConn = null, bc = null, onMsg = () => {}, onJoin = () => {}, onLeave = () => {}, onLost = () => {};

  N.handlers = function (h) { onMsg = h.msg || onMsg; onJoin = h.join || onJoin; onLeave = h.leave || onLeave; onLost = h.lost || onLost; };
  N.available = () => TEST_BC || !!window.Peer;
  // PeerJS erst laden, wenn jemand den Mehrspieler öffnet (hält den Spielstart schnell)
  let loading = null;
  N.load = function () {
    if (N.available()) return Promise.resolve(true);
    if (!loading) loading = new Promise(resolve => {
      const s = document.createElement('script'); s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
      s.onload = () => resolve(!!window.Peer); s.onerror = () => { loading = null; resolve(false); };
      document.head.appendChild(s);
    });
    return loading;
  };
  N.makeCode = function () { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };

  // ---------- Testweg: BroadcastChannel im selben Browser ----------
  function bcOpen(code, role) {
    return new Promise((resolve, reject) => {
      bc = new BroadcastChannel(PREFIX + code);
      N.id = role === 'host' ? 'H' : 'G' + Math.random().toString(36).slice(2, 7);
      let ok = role === 'host';
      bc.onmessage = e => {
        const m = e.data; if (!m || m.to && m.to !== N.id) return;
        if (role === 'host') {
          if (m.t === '_join') { conns[m.from] = true; bc.postMessage({ t: '_ok', to: m.from, from: 'H' }); onJoin(m.from); }
          else if (m.t === '_bye') { if (conns[m.from]) { delete conns[m.from]; onLeave(m.from); } }
          else if (m.to === 'H') onMsg(m.from, m.d);
        } else {
          if (m.t === '_ok') { ok = true; resolve(); }
          else if (m.t === '_bye' && m.from === 'H') onLost();
          else if (m.from === 'H') onMsg('H', m.d);
        }
      };
      if (role === 'host') resolve();
      else { bc.postMessage({ t: '_join', from: N.id }); setTimeout(() => { if (!ok) reject({ code: 'notfound' }); }, 20000); }
      window.addEventListener('beforeunload', () => { try { bc.postMessage({ t: '_bye', from: N.id }); } catch (e) {} });
    });
  }

  // ---------- Gastgeber ----------
  N.host = function (code) {
    N.role = 'host'; N.code = code; conns = {};
    if (TEST_BC) return bcOpen(code, 'host').then(() => { N.open = true; });
    return new Promise((resolve, reject) => {
      let settled = false;
      peer = new window.Peer(PREFIX + code);
      peer.on('open', id => { N.id = 'H'; N.open = true; settled = true; resolve(); });
      peer.on('connection', c => {
        c.on('open', () => { conns[c.peer] = c; onJoin(c.peer); });
        c.on('data', d => onMsg(c.peer, d));
        c.on('close', () => { if (conns[c.peer]) { delete conns[c.peer]; onLeave(c.peer); } });
        c.on('error', () => {});
      });
      peer.on('error', e => { if (!settled) { settled = true; reject({ code: e.type === 'unavailable-id' ? 'taken' : 'network' }); } });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
    });
  };

  // ---------- Gast ----------
  N.join = function (code) {
    N.role = 'guest'; N.code = code;
    if (TEST_BC) return bcOpen(code, 'guest').then(() => { N.open = true; });
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = c => { if (!settled) { settled = true; try { peer.destroy(); } catch (e) {} reject({ code: c }); } };
      peer = new window.Peer();
      peer.on('open', id => {
        N.id = id;
        hostConn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        hostConn.on('open', () => { if (!settled) { settled = true; N.open = true; resolve(); } });
        hostConn.on('data', d => onMsg('H', d));
        hostConn.on('close', () => { if (N.open) { N.open = false; onLost(); } });
        hostConn.on('error', () => {});
        setTimeout(() => fail('notfound'), 12000);
      });
      peer.on('error', e => fail(e.type === 'peer-unavailable' ? 'notfound' : 'network'));
    });
  };

  // Gast → Gastgeber
  N.toHost = function (d) {
    if (!N.open) return;
    if (TEST_BC) bc.postMessage({ to: 'H', from: N.id, d });
    else if (hostConn && hostConn.open) { try { hostConn.send(d); } catch (e) {} }
  };
  // Gastgeber → ein Gast (id) oder alle (id = null), optional außer einem
  N.toGuest = function (id, d, except) {
    if (!N.open) return;
    const ids = id ? [id] : Object.keys(conns);
    ids.forEach(k => {
      if (k === except) return;
      if (TEST_BC) bc.postMessage({ to: k, from: 'H', d });
      else { const c = conns[k]; if (c && c.open) { try { c.send(d); } catch (e) {} } }
    });
  };
  N.guests = () => Object.keys(conns);
  N.close = function () {
    N.open = false;
    try { if (bc) { bc.postMessage({ t: '_bye', from: N.id }); bc.close(); } } catch (e) {}
    try { if (peer) peer.destroy(); } catch (e) {}
    peer = null; hostConn = null; conns = {}; bc = null; N.role = null;
  };

  LC.Net = N;
})(window.LC);
