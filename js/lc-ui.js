'use strict';
/* =========================================================
   Lunar Clean – Anzeige (HUD), Menüs, Werkstatt-Fenster
   ========================================================= */
(function (LC) {
  const UI = {};
  const $ = id => document.getElementById(id);
  const el = {};
  ['hud', 'money', 'money-v', 'goal', 'goal-t', 'sec-v', 'sec-b', 'hud-bl', 'tank-v', 'tank-l', 'tools', 'tank-n', 'tank-g', 'tank-s', 'tank-m', 'jet', 'jet-b', 'jet-v',
    'cross', 'prompt', 'warn', 'toasts', 'way', 'way-d', 'keys', 'fps', 'menu', 'pause', 'shop', 'cards', 'shop-money', 'stats', 'loading', 'ver',
    'btn-play', 'btn-new', 'btn-resume', 'btn-tomenu', 'btn-wipe', 'btn-shopclose', 'btn-full', 'set-full', 'set-sens', 'set-vol', 'set-music', 'set-gfx'].forEach(id => el[id] = $(id));
  UI.el = el;

  const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  UI.n0 = v => nf0.format(v); UI.n1 = v => nf1.format(v);

  const last = {};
  function setText(id, txt) { if (last[id] !== txt) { last[id] = txt; el[id].textContent = txt; } }
  function setHTML(id, txt) { if (last[id] !== txt) { last[id] = txt; el[id].innerHTML = txt; } }
  function setW(id, frac) { const w = (Math.max(0, Math.min(1, frac)) * 100).toFixed(1) + '%'; if (last[id + 'w'] !== w) { last[id + 'w'] = w; el[id].style.width = w; } }
  function show(id, on) { if (last[id + 's'] !== on) { last[id + 's'] = on; el[id].classList.toggle('hidden', !on); } }
  UI.show = show;

  UI.money = function (v, pop) {
    setText('money-v', nf0.format(Math.floor(v)));
    if (pop) { el.money.classList.remove('pop'); void el.money.offsetWidth; el.money.classList.add('pop'); }
  };
  UI.goal = function (txt) {
    if (last.goalTxt === txt) return;
    const first = last.goalTxt === undefined;
    last.goalTxt = txt; el['goal-t'].textContent = txt;
    if (!first) { el.goal.classList.remove('flash'); void el.goal.offsetWidth; el.goal.classList.add('flash'); }
  };
  UI.sector = function (frac) {
    setText('sec-v', (frac >= 0.9995 ? '100' : nf1.format(Math.min(99.9, frac * 100))) + ' % sauber');
    setW('sec-b', frac);
  };
  UI.tank = function (label, n, g, cap, worth, status) {
    const tot = n + g, full = tot >= cap - 0.001;
    setText('tank-l', label);
    setText('tank-v', (tot >= 100 ? nf0.format(tot) : nf1.format(tot)) + ' / ' + nf0.format(cap) + ' kg');
    setW('tank-n', n / cap); setW('tank-g', g / cap);
    setText('tank-m', nf0.format(Math.round(worth)) + ' ¢');
    setText('tank-s', status || (full ? 'VOLL' : g > 0.05 ? 'mit ' + nf1.format(g) + ' kg Glitzerstaub' : tot < 0.05 ? 'Leer' : 'Staub an Bord'));
    if (last.full !== full) { last.full = full; el['hud-bl'].classList.toggle('full', full); }
  };
  UI.tools = function (list) {
    const own = list.filter(t => t.has);
    const key = own.map(t => t.key + t.name + (t.on ? '*' : '')).join('|');
    if (last.tools === key) return;
    last.tools = key;
    el.tools.classList.toggle('hidden', own.length < 2);
    el.tools.innerHTML = '';
    own.forEach(t => { const d = document.createElement('div'); d.className = 'tool' + (t.on ? ' on' : ''); const k = document.createElement('b'); k.textContent = t.key; d.appendChild(k); d.appendChild(document.createTextNode(t.name)); el.tools.appendChild(d); });
  };
  UI.jet = function (visible, frac) {
    show('jet', visible);
    if (visible) { setW('jet-b', frac); setText('jet-v', Math.round(frac * 100) + ' %'); }
  };
  UI.cross = function (mode) { if (last.cross !== mode) { last.cross = mode; el.cross.className = mode; } };
  UI.prompt = function (html) { show('prompt', !!html); if (html) setHTML('prompt', html); };
  UI.warn = function (txt) { show('warn', !!txt); if (txt) setText('warn', txt); };
  UI.toast = function (txt, cls, life) {
    const d = document.createElement('div');
    d.className = 'toast panel ' + (cls || ''); d.textContent = txt;
    const l = life || 3.2; d.style.setProperty('--life', l + 's');
    el.toasts.appendChild(d);
    while (el.toasts.children.length > 4) el.toasts.removeChild(el.toasts.firstChild);
    setTimeout(() => d.remove(), (l + 0.6) * 1000);
  };
  UI.way = function (visible, x, y, dist) {
    show('way', visible);
    if (!visible) return;
    el.way.style.transform = 'translate(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px) translate(-50%,-50%)';
    setText('way-d', 'BASIS ' + Math.round(dist) + ' m');
  };
  UI.fps = function (v) { setText('fps', v); };

  // ---------- Werkstatt ----------
  // items: [{id, name, desc, level, max, cost, nowTxt, nextTxt, locked, lockTxt, teaser}]
  UI.shopRender = function (items, money, onBuy, onHelp) {
    el['shop-money'].textContent = nf0.format(Math.floor(money)) + ' ¢';
    const c = el.cards; c.innerHTML = '';
    items.forEach(it => {
      const d = document.createElement('div');
      const isMax = !it.teaser && it.level >= it.max;
      d.className = 'card' + (isMax ? ' max' : '') + (it.locked || it.teaser ? ' locked' : '') + (it.goal ? ' goal' : '');
      const h = document.createElement('h3'); h.textContent = it.name;
      if (it.max > 1 && !it.teaser) { const s = document.createElement('small'); s.textContent = 'STUFE ' + it.level + ' / ' + it.max; h.appendChild(s); }
      d.appendChild(h);
      const p = document.createElement('p'); p.textContent = it.desc; d.appendChild(p);
      if (it.max > 1 && !it.teaser) {
        const pp = document.createElement('div'); pp.className = 'pips';
        for (let i = 0; i < it.max; i++) { const x = document.createElement('i'); if (i < it.level) x.className = 'on'; pp.appendChild(x); }
        d.appendChild(pp);
      }
      if (it.nowTxt) {
        const n = document.createElement('div'); n.className = 'next';
        n.innerHTML = '';
        n.appendChild(document.createTextNode(it.nowTxt));
        if (it.nextTxt && !isMax) { n.appendChild(document.createTextNode('  →  ')); const b = document.createElement('b'); b.textContent = it.nextTxt; n.appendChild(b); }
        d.appendChild(n);
      }
      const b = document.createElement('button');
      if (it.teaser) { b.textContent = it.teaser; b.disabled = true; }
      else if (isMax) { b.textContent = it.max > 1 ? 'Maximal ausgebaut' : 'Erledigt'; b.disabled = true; }
      else if (it.locked) { b.textContent = it.lockTxt || 'Gesperrt'; b.disabled = true; }
      else {
        b.textContent = 'Kaufen · ' + nf0.format(it.cost) + ' ¢';
        if (money >= it.cost) b.className = 'pri';
        else { b.disabled = true; b.textContent = nf0.format(it.cost) + ' ¢ · es fehlen ' + nf0.format(Math.ceil(it.cost - money)) + ' ¢'; }
        b.addEventListener('click', () => onBuy(it.id));
      }
      d.appendChild(b);
      if (it.help && it.level > 0 && onHelp) { const h = document.createElement('a'); h.className = 'helpl'; h.textContent = 'Wie funktioniert das?'; h.addEventListener('click', () => onHelp(it.id)); d.appendChild(h); }
      c.appendChild(d);
    });
  };

  UI.stats = function (rows) {
    el.stats.innerHTML = '';
    rows.forEach(r => { const a = document.createElement('span'); a.textContent = r[0]; const b = document.createElement('b'); b.textContent = r[1]; el.stats.appendChild(a); el.stats.appendChild(b); });
  };

  LC.UI = UI;
})(window.LC);
