// The live burrow: a cross-section of the ground under XMR ROOTS.
//
// The tree on the surface is the coin. Its taproot runs into the fee vault,
// where the 2% creator fee splits and branches out as coloured roots to the
// three destinations (rewards 40%, liquidity 25% + 10%, buyback 25%).
// The mole walks a separate tunnel network along the tunnel centre lines
// (path following + shortest route). Holder burrows sit on levels below the
// stations; new tunnels and new levels are dug on demand, and the view scrolls
// down to follow the mole. app.js turns transactions into jobs and calls
// Burrow.enqueue(job).
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('scene');
  const W = 1200, H = 680, GROUND = 150;

  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, x, y, str, attrs) {
    const t = el('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-family': 'Inter, sans-serif' }, attrs), parent);
    t.textContent = str;
    return t;
  }
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- layout ----------
  const TX = 600; // the tree, and the vault right under it
  const CH = {
    vault:    { x: TX, y: 300, rx: 100, ry: 52 },
    pool:     { x: 230, y: 520, rx: 112, ry: 54 },
    treasury: { x: TX, y: 540, rx: 110, ry: 56 },
    furnace:  { x: 960, y: 520, rx: 104, ry: 58 },
  };
  const floorY = (c) => c.y + c.ry - 24;
  const SAFE = { x: TX + 4, y: 298 };
  const PILE = { x: 648, y: 578 };
  const STASH = { x: 896, y: 556 };
  const fireBase = { x: 1022, y: 562 };

  const N = {
    surf: { x: 200, y: GROUND - 24 },
    hole: { x: 200, y: GROUND + 34 },
    vault: { x: 528, y: floorY(CH.vault) },
    pool: { x: 152, y: floorY(CH.pool) },
    treasury: { x: 556, y: floorY(CH.treasury) },
    furnace: { x: 952, y: floorY(CH.furnace) },
  };

  // holder burrows: levels below the stations, reached by a shaft from the
  // rewards chamber; a new level is dug whenever the existing ones are full
  const SHAFT_X = TX;
  const LEVEL0_Y = 790, LEVEL_STEP = 150, MAX_LEVELS = 30;
  const ROOM_XS = [460, 740, 320, 880, 180, 1020]; // nearest to the shaft first
  const ROOM_PREV = { 460: 'h', 740: 'h', 320: 460, 880: 740, 180: 320, 1020: 880 };
  const levelY = (L) => LEVEL0_Y + L * LEVEL_STEP;

  // ---------- defs ----------
  const defs = el('defs', {}, svg);
  defs.innerHTML = `
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#08080a"/><stop offset="1" stop-color="#17161a"/></linearGradient>
    <linearGradient id="soilTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a2a1e"/><stop offset=".45" stop-color="#2b1f16"/><stop offset="1" stop-color="#20170f"/></linearGradient>
    <radialGradient id="chamberIn" cx=".5" cy=".65" r=".6"><stop offset="0" stop-color="#22160e"/><stop offset="1" stop-color="#110a06"/></radialGradient>
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a33" stop-opacity=".95"/><stop offset="1" stop-color="#7a2c02" stop-opacity=".95"/></linearGradient>
    <radialGradient id="lightHole" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000"/><stop offset=".55" stop-color="#000" stop-opacity=".7"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="warm" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff7a1a" stop-opacity=".45"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></radialGradient>
    <radialGradient id="moon" cx=".4" cy=".4" r=".6"><stop offset="0" stop-color="#fff6e6"/><stop offset="1" stop-color="#cfc4b0"/></radialGradient>
    <filter id="glow" filterUnits="userSpaceOnUse" x="-50" y="-50" width="1300" height="6000">
      <feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a4a4e"/><stop offset="1" stop-color="#1f1f22"/></linearGradient>
    <clipPath id="under"><rect id="underRect" x="0" y="${GROUND}" width="${W}" height="${H - GROUND}"/></clipPath>
    <clipPath id="poolClip"><ellipse cx="${CH.pool.x}" cy="${CH.pool.y}" rx="${CH.pool.rx - 3}" ry="${CH.pool.ry - 3}"/></clipPath>
    <mask id="darkMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <rect id="maskRect" x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
      <g id="lights"></g>
    </mask>`;
  const darkMask = defs.querySelector('#darkMask');

  // ---------- sky ----------
  el('rect', { x: 0, y: -400, width: W, height: GROUND + 400, fill: 'url(#sky)' }, svg);
  const starEls = [];
  for (let i = 0; i < 60; i++) {
    starEls.push(el('circle', { cx: (i * 263 + 40) % W, cy: 6 + ((i * 97) % (GROUND - 50)), r: i % 6 ? 0.9 : 1.6, fill: '#fff', opacity: 0.4 }, svg));
  }
  el('circle', { cx: 1110, cy: 46, r: 22, fill: 'url(#moon)', opacity: 0.9 }, svg);
  el('circle', { cx: 1118, cy: 40, r: 4, fill: '#d8cdb8', opacity: 0.6 }, svg);
  el('circle', { cx: 1102, cy: 54, r: 3, fill: '#d8cdb8', opacity: 0.5 }, svg);
  text(svg, 24, 28, 'SOLANA SURFACE  ·  PUBLIC  ·  EVERYONE IS WATCHING', { 'text-anchor': 'start', 'font-size': 12, fill: '#77777d', 'font-weight': 700, 'letter-spacing': 1.6 });

  // ---------- soil ----------
  const soilDeep = el('rect', { x: 0, y: GROUND, width: W, height: H - GROUND, fill: '#1d150e' }, svg);
  el('rect', { x: 0, y: GROUND, width: W, height: H - GROUND, fill: 'url(#soilTop)' }, svg);
  const strata = el('g', {}, svg);
  function soilBand(y0, y1, seed) {
    for (let y = y0 + 80; y < y1; y += 120) {
      el('path', { d: `M0 ${y} C200 ${y - 14} 420 ${y + 16} 640 ${y} S1000 ${y - 12} 1200 ${y + 6}`, stroke: '#000', 'stroke-opacity': 0.22, 'stroke-width': 2, fill: 'none' }, strata);
    }
    const n = Math.round((y1 - y0) / 4);
    for (let i = 0; i < n; i++) {
      const k = i + seed;
      const x = (k * 137.7) % W, y = y0 + 12 + ((k * 211.3) % (y1 - y0 - 12));
      el('ellipse', { cx: x, cy: y, rx: 1.5 + (k % 4), ry: 1 + (k % 3), fill: k % 9 ? '#46341f' : '#5c4630', opacity: 0.55 }, strata);
    }
    for (let i = 0; i < (y1 - y0) / 60; i++) {
      const k = i + seed;
      const x = 40 + ((k * 133) % 1120), y = y0 + 30 + ((k * 173) % Math.max(1, y1 - y0 - 50));
      el('path', { d: `M${x} ${y} q10 -9 22 -2 q8 6 -2 12 q-12 5 -20 -10 z`, fill: '#4b3a2c', opacity: 0.7 }, strata);
    }
  }
  soilBand(GROUND, H, 0);

  // ---------- tunnels ----------
  // walls are a wider, lighter stroke under the tunnel interior; chambers use
  // the same two layers so every joint is seamless
  const tunnelOuter = el('g', { fill: 'none', 'stroke-linecap': 'round', 'clip-path': 'url(#under)' }, svg);
  const tunnelInner = el('g', { fill: 'none', 'stroke-linecap': 'round', 'clip-path': 'url(#under)' }, svg);
  const edges = [];
  const adj = {};
  function setReveal(e, s) {
    for (const p of [e.outer, e.inner]) {
      // one dash that ends exactly where the mole has dug to
      p.setAttribute('stroke-dasharray', `${e.len + 60} ${e.len + 60}`);
      p.setAttribute('stroke-dashoffset', e.len + 60 - s);
    }
  }
  function addEdge(a, b, d, hidden) {
    const outer = el('path', { d, stroke: '#4a3424', 'stroke-width': 54 }, tunnelOuter);
    const inner = el('path', { d, stroke: '#140d08', 'stroke-width': 44 }, tunnelInner);
    const e = { a, b, outer, inner, len: inner.getTotalLength(), dug: !hidden };
    if (hidden) setReveal(e, 0);
    edges.push(e);
    (adj[a] = adj[a] || []).push(e);
    (adj[b] = adj[b] || []).push(e);
    return e;
  }
  function edgeBetween(a, b) { return edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a)); }
  function chamberShape(c, hidden) {
    const o = el('ellipse', { cx: c.x, cy: c.y, rx: c.rx + 5, ry: c.ry + 5, fill: '#4a3424', opacity: hidden ? 0 : 1 }, tunnelOuter);
    const i = el('ellipse', { cx: c.x, cy: c.y, rx: c.rx, ry: c.ry, fill: 'url(#chamberIn)', opacity: hidden ? 0 : 1 }, tunnelInner);
    return [o, i];
  }

  addEdge('surf', 'hole', `M200 ${N.surf.y} L200 ${N.hole.y}`);
  addEdge('hole', 'vault', `M200 ${N.hole.y} C200 290 380 ${N.vault.y} ${N.vault.x} ${N.vault.y}`);
  // tunnels run around the root fan (left edge and along the bottom) so no root is cut
  addEdge('hole', 'pool', `M200 ${N.hole.y} C150 300 110 450 ${N.pool.x} ${N.pool.y}`);
  addEdge('pool', 'treasury', `M${N.pool.x} ${N.pool.y} C260 650 440 640 ${N.treasury.x} ${N.treasury.y}`);
  addEdge('treasury', 'furnace', `M${N.treasury.x} ${N.treasury.y} C700 650 860 630 ${N.furnace.x} ${N.furnace.y}`);
  Object.values(CH).forEach((c) => chamberShape(c));
  el('ellipse', { cx: 200, cy: GROUND + 2, rx: 30, ry: 8, fill: '#0b0705' }, svg);

  const world = el('g', {}, svg);
  const rootsLayer = el('g', { fill: 'none', 'stroke-linecap': 'round' }, world);
  const props = el('g', {}, world);
  const labels = el('g', {}, svg);
  function label(x, y, title, sub, color) {
    text(labels, x, y, title, { 'font-size': 13, fill: '#f5f5f5', 'font-weight': 800, 'letter-spacing': 1.2 });
    if (sub) text(labels, x, y + 16, sub, { 'font-size': 11, fill: color || '#a29a92', 'font-weight': 700 });
  }

  // ---------- surface ----------
  const stall = el('g', { transform: `translate(64 ${GROUND})` }, props);
  el('rect', { x: 0, y: -62, width: 78, height: 62, rx: 3, fill: '#1d1d20', stroke: '#2e2e33' }, stall);
  el('path', { d: 'M-8 -60 L39 -88 L86 -60 Z', fill: '#e85d04' }, stall);
  for (let i = 0; i < 5; i++) el('rect', { x: -8 + i * 19, y: -62, width: 9.4, height: 10, fill: i % 2 ? '#e85d04' : '#f2eee6' }, stall);
  el('rect', { x: 12, y: -42, width: 54, height: 26, rx: 3, fill: '#0d0d0d', stroke: '#33333a' }, stall);
  text(stall, 39, -25, 'TRADES', { 'font-size': 11, fill: '#ff6600', 'font-weight': 800, 'letter-spacing': 1 });
  const chartLine = el('polyline', { points: '16,-30 24,-34 32,-31 40,-37 48,-35 58,-40', stroke: '#3ddc84', 'stroke-width': 1.4, fill: 'none', opacity: 0 }, stall);
  text(stall, 39, -96, 'pump.fun  ·  2% fee', { 'font-size': 11, fill: '#a29a92', 'font-weight': 600 });

  // the coin: a tree whose taproot feeds the fee vault
  const tree = el('g', {}, props);
  el('path', { d: `M${TX - 14} ${GROUND + 2} C${TX - 10} ${GROUND - 30} ${TX - 8} ${GROUND - 56} ${TX - 4} ${GROUND - 74} L${TX + 6} ${GROUND - 74} C${TX + 9} ${GROUND - 50} ${TX + 11} ${GROUND - 28} ${TX + 16} ${GROUND + 2} Z`, fill: '#5a3e2a' }, tree);
  el('path', { d: `M${TX - 2} ${GROUND - 60} C${TX - 18} ${GROUND - 74} ${TX - 30} ${GROUND - 76} ${TX - 40} ${GROUND - 86}`, stroke: '#5a3e2a', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, tree);
  el('path', { d: `M${TX + 4} ${GROUND - 64} C${TX + 18} ${GROUND - 78} ${TX + 30} ${GROUND - 82} ${TX + 42} ${GROUND - 92}`, stroke: '#5a3e2a', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, tree);
  [[-44, -92, 30], [44, -98, 32], [0, -112, 40], [-22, -128, 28], [26, -130, 26], [0, -86, 30]].forEach(([dx, dy, r], i) =>
    el('circle', { cx: TX + dx, cy: GROUND + dy, r, fill: i % 2 ? '#1f3318' : '#264020' }, tree));
  const leafGlow = el('circle', { cx: TX, cy: GROUND - 108, r: 80, fill: 'url(#warm)', opacity: 0 }, tree);
  const sparkles = el('g', {}, tree);
  text(tree, TX + 92, GROUND - 120, '$MOLERO', { 'font-size': 12, fill: '#ff7a1a', 'font-weight': 900, 'letter-spacing': 1 });

  const bush = el('g', { transform: `translate(1000 ${GROUND})` }, props);
  el('ellipse', { cx: -24, cy: -14, rx: 34, ry: 22, fill: '#1c2c15' }, bush);
  el('ellipse', { cx: 18, cy: -18, rx: 38, ry: 28, fill: '#223519' }, bush);
  el('ellipse', { cx: 50, cy: -10, rx: 24, ry: 16, fill: '#1c2c15' }, bush);
  const eyes = el('g', { transform: 'translate(8 -22)' }, bush);
  const eyeL = el('ellipse', { cx: -9, cy: 0, rx: 6, ry: 3.4, fill: '#8dffbe' }, eyes);
  const eyeR = el('ellipse', { cx: 9, cy: 0, rx: 6, ry: 3.4, fill: '#8dffbe' }, eyes);
  const pupL = el('circle', { cx: -9, cy: 0, r: 1.8, fill: '#0b2a18' }, eyes);
  const pupR = el('circle', { cx: 9, cy: 0, r: 1.8, fill: '#0b2a18' }, eyes);
  el('ellipse', { cx: 0, cy: 0, rx: 26, ry: 12, fill: '#8dffbe', opacity: 0.08 }, eyes);
  text(bush, 8, -56, 'glowies', { 'font-size': 11, fill: '#5d8c6e', 'font-weight': 700 });

  const grass = el('g', {}, props);
  el('rect', { x: 0, y: GROUND - 3, width: W, height: 7, fill: '#2c3d1f' }, grass);
  for (let x = 3; x < W; x += 9) {
    if (Math.abs(x - 200) < 30) continue;
    const h = 6 + ((x * 7) % 9);
    el('path', { d: `M${x} ${GROUND} q2 -${h} ${2 + (x % 3)} -${h} q1 ${h * 0.6} 3 ${h}`, fill: x % 4 ? '#3c5429' : '#4a6632' }, grass);
  }

  // ---------- roots: the fee split ----------
  // The taproot carries the fee from the tree into the vault's safe; under the
  // vault it splits into one root per destination. Each root is a tapered
  // organic shape (bark) with a coloured sap vein that says where it goes,
  // and its tip fans out into exactly what it funds.
  const SPLIT = { x: TX, y: CH.vault.y + CH.vault.ry + 4 };
  const BARK = '#6e4c34', BARK_DARK = '#3b281a';
  const taproot = { color: '#ff7a1a', w0: 24, w1: 13,
    d: `M${TX} ${GROUND - 2} C${TX - 6} 186 ${TX + 6} 214 ${TX + 1} ${CH.vault.y - CH.vault.ry + 6} S${SAFE.x - 1} ${SAFE.y - 42} ${SAFE.x} ${SAFE.y - 30}` };
  const feeder = { color: '#ff7a1a', w0: 14, w1: 17,
    d: `M${SAFE.x} ${SAFE.y + 30} C${SAFE.x} ${SAFE.y + 44} ${SPLIT.x} ${SPLIT.y - 16} ${SPLIT.x} ${SPLIT.y}` };
  const ROOTS = [
    { key: 'liq', pct: '25%', color: '#ff6a1a', w0: 13, w1: 3.6, tag: [0.52, 0, 22],
      d: `M${SPLIT.x - 3} ${SPLIT.y + 2} C560 402 430 404 350 438 S292 500 290 536` },
    { key: 'extra', pct: '10%', color: '#d39a74', w0: 8.5, w1: 2.6, tag: [0.4, 0, -16],
      d: `M${SPLIT.x - 7} ${SPLIT.y} C540 384 390 382 312 418 S252 496 250 536` },
    { key: 'rewards', pct: '40%', color: '#9b7cf0', w0: 17, w1: 4.5, tag: [0.42, 26, 0],
      d: `M${SPLIT.x + 1} ${SPLIT.y + 3} C604 424 642 470 ${PILE.x - 2} ${PILE.y - 12}` },
    { key: 'buyback', pct: '25%', color: '#e0b13a', w0: 13, w1: 3.6, tag: [0.42, 0, -18],
      d: `M${SPLIT.x + 6} ${SPLIT.y + 1} C664 384 820 392 868 440 S${STASH.x} 498 ${STASH.x} ${STASH.y - 24}` },
  ];

  // geometry helper: a hidden path used to sample any centre line
  const measure = el('path', { visibility: 'hidden' }, rootsLayer);
  function sample(d) {
    measure.setAttribute('d', d);
    const L = measure.getTotalLength();
    return { L, at: (s) => measure.getPointAtLength(clamp(s, 0, L)) };
  }
  // a closed outline around a centre line, w0 wide at the start, w1 at the tip
  function taperD(d, w0, w1, wobble, seed) {
    const m = sample(d);
    const n = Math.max(16, Math.round(m.L / 4));
    const left = [], right = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = m.at(t * m.L);
      const a = m.at(t * m.L - 1), b = m.at(t * m.L + 1);
      const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / tl, ny = (b.x - a.x) / tl;
      const w = (w0 + (w1 - w0) * Math.pow(t, 0.7)) / 2 * (1 + (wobble || 0) * Math.sin(t * 19 + seed) * Math.sin(t * 6.1 + seed * 1.7));
      left.push(`${(p.x + nx * w).toFixed(1)} ${(p.y + ny * w).toFixed(1)}`);
      right.push(`${(p.x - nx * w).toFixed(1)} ${(p.y - ny * w).toFixed(1)}`);
    }
    return 'M' + left.join(' L') + ' L' + right.reverse().join(' L') + ' Z';
  }

  const rootShadow = el('g', { opacity: 0.35, transform: 'translate(2 3)' }, rootsLayer);
  const rootHairs = el('g', {}, rootsLayer);
  const rootBodies = el('g', {}, rootsLayer);
  const rootPulses = el('g', { filter: 'url(#glow)' }, rootsLayer);

  // little drooping hairs and the fan of rootlets at the tip
  function hair(x, y, ang, len, w, color) {
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len + len * 0.45;
    const d = `M${x.toFixed(1)} ${y.toFixed(1)} Q${(x + Math.cos(ang) * len * 0.6).toFixed(1)} ${(y + Math.sin(ang) * len * 0.6).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    el('path', { d: taperD(d, w, 0.3, 0, 0), fill: color || BARK }, rootHairs);
  }

  function drawRoot(r, seed, opts) {
    opts = opts || {};
    const m = sample(r.d);
    r.len = m.L;
    el('path', { d: taperD(r.d, r.w0 + 3, r.w1 + 1, 0.1, seed), fill: '#000' }, rootShadow);
    r.bark = el('path', { d: taperD(r.d, r.w0, r.w1, 0.12, seed), fill: BARK, stroke: BARK_DARK, 'stroke-width': 0.9 }, rootBodies);
    // bark creases: short, irregular nicks along the edges, never across the whole root
    for (let k = 0, s = 14 + (seed % 9); s < m.L - 14; k++, s += 26 + ((seed * 5 + k * 11) % 23)) {
      const p = m.at(s), a = m.at(s - 1), b = m.at(s + 1);
      const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / tl, ny = (b.x - a.x) / tl;
      const w = (r.w0 + (r.w1 - r.w0) * Math.pow(s / m.L, 0.7)) * 0.48;
      const side = k % 2 ? 1 : -1, tx = (b.x - a.x) / tl, ty = (b.y - a.y) / tl;
      const x1 = p.x + nx * w * side, y1 = p.y + ny * w * side;
      const x2 = p.x + nx * w * side * 0.25 + tx * 3, y2 = p.y + ny * w * side * 0.25 + ty * 3;
      el('path', { d: `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${(x1 + tx * 3).toFixed(1)} ${(y1 + ty * 3).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`, stroke: BARK_DARK, 'stroke-width': 0.9, fill: 'none', opacity: 0.45, 'stroke-linecap': 'round' }, rootBodies);
    }
    r.vein = el('path', { d: taperD(r.d, r.w0 * 0.34, r.w1 * 0.3, 0, seed), fill: r.color, opacity: 0.9 }, rootBodies);
    el('path', { d: taperD(r.d, r.w0 * 0.14, 0.2, 0, seed), fill: '#fff', opacity: 0.16, transform: 'translate(-0.8 -1)' }, rootBodies);
    if (!opts.noHairs) {
      for (let k = 0, t = 0.24; t < 0.84; t += 0.17 + ((seed + k) % 3) * 0.04, k++) {
        const s = t * m.L, p = m.at(s), a = m.at(s - 1), b = m.at(s + 1);
        const ang = Math.atan2(b.y - a.y, b.x - a.x) + (k % 2 ? 1 : -1) * (0.8 + ((seed * 7 + k * 3) % 5) * 0.12);
        hair(p.x, p.y, ang, 12 + ((seed * 13 + k * 7) % 12), 1.3 + (1 - t) * 1.1);
      }
    }
    if (opts.fan) {
      const end = m.at(m.L), pre = m.at(m.L - 4);
      const base = Math.atan2(end.y - pre.y, end.x - pre.x);
      [-0.7, -0.25, 0.25, 0.7].forEach((o, i) => hair(end.x, end.y, base + o, 9 + (i % 2) * 5, 2.2, BARK));
    }
    r.pulse = el('path', { d: r.d, stroke: '#fff1d0', 'stroke-width': Math.max(3, r.w0 * 0.45), 'stroke-linecap': 'round', fill: 'none', opacity: 0, 'stroke-dasharray': `38 ${r.len + 80}` }, rootPulses);
  }

  // surface flare where the trunk meets the ground
  el('path', { d: taperD(`M${TX - 6} ${GROUND + 1} C${TX - 24} ${GROUND + 4} ${TX - 44} ${GROUND + 8} ${TX - 62} ${GROUND + 16}`, 8, 1, 0.1, 3), fill: BARK, stroke: BARK_DARK, 'stroke-width': 0.8 }, rootBodies);
  el('path', { d: taperD(`M${TX + 6} ${GROUND + 1} C${TX + 26} ${GROUND + 4} ${TX + 48} ${GROUND + 10} ${TX + 66} ${GROUND + 20}`, 8, 1, 0.1, 5), fill: BARK, stroke: BARK_DARK, 'stroke-width': 0.8 }, rootBodies);
  drawRoot(taproot, 2, { noHairs: false });
  drawRoot(feeder, 4, { noHairs: true });
  ROOTS.forEach((r, i) => drawRoot(r, 11 + i * 17, { fan: true }));
  // the knot where the fee splits
  el('ellipse', { cx: SPLIT.x, cy: SPLIT.y + 1, rx: 13, ry: 9, fill: BARK, stroke: BARK_DARK, 'stroke-width': 1 }, rootBodies);
  const knotCore = el('circle', { cx: SPLIT.x, cy: SPLIT.y + 1, r: 4, fill: '#ff7a1a' }, rootBodies);

  // small percentage tags next to each root
  ROOTS.forEach((r) => {
    const m = sample(r.d), [t, dx, dy] = r.tag, p = m.at(m.L * t);
    text(labels, p.x + dx, p.y + dy + 4, r.pct, { 'font-size': 13, 'font-weight': 900, fill: r.color, stroke: '#120c08', 'stroke-width': 4, 'paint-order': 'stroke' });
  });

  // ---------- stations ----------
  // fee vault: a round safe door, the taproot plugs into it
  const vault = el('g', { transform: `translate(${SAFE.x} ${SAFE.y})` }, props);
  el('circle', { cx: 0, cy: 0, r: 31, fill: 'url(#metal)', stroke: '#5a5a60', 'stroke-width': 3 }, vault);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; el('circle', { cx: Math.cos(a) * 25, cy: Math.sin(a) * 25, r: 2, fill: '#77777d' }, vault); }
  const wheel = el('g', {}, vault);
  el('circle', { cx: 0, cy: 0, r: 13, fill: 'none', stroke: '#8a8a90', 'stroke-width': 3 }, wheel);
  for (let i = 0; i < 3; i++) el('line', { x1: -13, y1: 0, x2: 13, y2: 0, stroke: '#8a8a90', 'stroke-width': 3, transform: `rotate(${i * 60})` }, wheel);
  el('circle', { cx: 0, cy: 0, r: 4, fill: '#ff6600' }, wheel);
  const vaultLight = el('circle', { cx: 24, cy: -26, r: 3.5, fill: '#5a2a08' }, vault);
  label(CH.vault.x + 196, CH.vault.y - 8, 'FEE VAULT', '2% of every trade splits here');

  // shared ROOTS/wXMR pool, both liquidity roots drink from it
  const poolBack = el('g', { 'clip-path': 'url(#poolClip)' }, props);
  let poolLevel = CH.pool.y + 12;
  const liquid = el('path', { fill: 'url(#liquid)' }, poolBack);
  const liquidShine = el('path', { fill: 'none', stroke: '#ffc27a', 'stroke-width': 1.5, opacity: 0.6 }, poolBack);
  const poolFront = el('g', { 'clip-path': 'url(#poolClip)' }, world);
  const liquidFront = el('path', { fill: 'url(#liquid)', opacity: 0.55 }, poolFront);
  label(CH.pool.x, CH.pool.y + CH.pool.ry + 24, 'ROOTS/wXMR POOL', '25% + 10% liquidity, new LP burned', '#ff8a4a');
  function drawLiquid(t) {
    // the left part of the chamber is a dry ledge where the mole stands
    const x0 = N.pool.x + 34, x1 = CH.pool.x + CH.pool.rx;
    let d = `M${x0 - 10} ${CH.pool.y + 80} C${x0 - 6} ${poolLevel + 20} ${x0 - 4} ${poolLevel + 2} ${x0} ${poolLevel}`;
    let s = '';
    for (let x = x0 + 8; x <= x1; x += 8) {
      const y = poolLevel + Math.sin(x / 14 + t * 2.4) * 1.8 + Math.sin(x / 7 - t * 3.1) * 0.8;
      d += ` L${x} ${y.toFixed(1)}`;
      s += (s ? ' L' : 'M') + `${x} ${(y + 1).toFixed(1)}`;
    }
    d += ` L${x1} ${CH.pool.y + 80} Z`;
    liquid.setAttribute('d', d);
    liquidFront.setAttribute('d', d);
    liquidShine.setAttribute('d', s);
  }

  // rewards: a pile of wXMR coins the rewards root feeds
  const pileG = el('g', {}, props);
  let pileCount = 9;
  function drawPile() {
    pileG.innerHTML = '';
    let n = 0;
    for (let row = 0; n < pileCount; row++) {
      const per = Math.max(1, 5 - row);
      for (let c = 0; c < per && n < pileCount; c++, n++) {
        const x = PILE.x - (per - 1) * 6.5 + c * 13 + ((n * 7) % 5 - 2), y = PILE.y - row * 6 + ((n * 3) % 3 - 1);
        el('ellipse', { cx: x, cy: y + 2, rx: 9, ry: 4.2, fill: '#a33f00' }, pileG);
        el('ellipse', { cx: x, cy: y, rx: 9, ry: 4.2, fill: '#ff7a1a', stroke: '#c94f02', 'stroke-width': 1 }, pileG);
        el('ellipse', { cx: x, cy: y, rx: 5, ry: 2.2, fill: 'none', stroke: '#ffb06a', 'stroke-width': 0.8 }, pileG);
      }
    }
  }
  drawPile();
  const snapFrame = el('g', { opacity: 0, stroke: '#f5f5f5', 'stroke-width': 3, fill: 'none' }, props);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const cx = CH.treasury.x + sx * (CH.treasury.rx - 14), cy = CH.treasury.y + sy * (CH.treasury.ry - 12);
    el('path', { d: `M${cx} ${cy - sy * 14} L${cx} ${cy} L${cx - sx * 14} ${cy}` }, snapFrame);
  });
  label(CH.treasury.x, CH.treasury.y + CH.treasury.ry + 24, 'REWARDS', '40% for holders, paid in wXMR', '#b39cf5');

  // burn pit: buyback budget lands in the crate, the mole burns it
  const furnace = el('g', {}, props);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    el('ellipse', { cx: fireBase.x + Math.cos(a) * 34, cy: fireBase.y + 6 + (i % 2) * 2, rx: 8, ry: 5.5, fill: i % 2 ? '#4b3a2c' : '#5c4630' }, furnace);
  }
  const fireGlow = el('ellipse', { cx: fireBase.x, cy: fireBase.y - 20, rx: 64, ry: 46, fill: 'url(#warm)' }, furnace);
  const FLAME = 'M-22 0 C-26 -18 -11 -25 -7 -46 C2 -31 17 -27 13 -11 C21 -19 24 -8 22 0 Z';
  const flames = [['#c94f02', 1.2], ['#ff6600', 0.96], ['#ffb347', 0.6], ['#fff0c2', 0.3]].map(([fill, s]) =>
    ({ p: el('path', { d: FLAME, fill }, furnace), s }));
  const stash = el('g', { transform: `translate(${STASH.x} ${STASH.y})` }, props);
  el('rect', { x: -15, y: -22, width: 30, height: 22, rx: 2, fill: '#5c3d22', stroke: '#8a5a2c' }, stash);
  el('line', { x1: -15, y1: -11, x2: 15, y2: -11, stroke: '#8a5a2c' }, stash);
  const stashCount = text(stash, 0, 14, '', { 'font-size': 10, fill: '#ffd36a', 'font-weight': 800 });
  label(CH.furnace.x, CH.furnace.y + CH.furnace.ry + 24, 'BURN PIT', '25% buys ROOTS and burns it', '#e2bb4c');
  let fireBoost = 0;

  // ---------- holder levels ----------
  const levelLabels = el('g', {}, labels);
  const levels = [];
  const roomEls = [];
  const roomDecor = el('g', {}, world);
  function addLevel() {
    const L = levels.length;
    const y = levelY(L), ny = y + 8;
    const h = 'h' + L;
    N[h] = { x: SHAFT_X, y: ny };
    if (L === 0) {
      addEdge('treasury', h, `M${N.treasury.x} ${N.treasury.y} C${N.treasury.x + 10} 640 ${SHAFT_X} 690 ${SHAFT_X} ${ny}`, true);
      text(levelLabels, 300, y - 72, 'HOLDER BURROWS', { 'font-size': 13, fill: '#f5f5f5', 'font-weight': 800, 'letter-spacing': 1.2 });
      text(levelLabels, 300, y - 56, 'one burrow for every wallet the mole pays', { 'font-size': 11, fill: '#b39cf5', 'font-weight': 700 });
    } else {
      addEdge('h' + (L - 1), h, `M${SHAFT_X} ${levelY(L - 1) + 8} L${SHAFT_X} ${ny}`, true);
    }
    text(levelLabels, SHAFT_X + 34, y - 36, 'LEVEL ' + (L + 1), { 'font-size': 10, fill: '#6b5a4c', 'font-weight': 800, 'letter-spacing': 1.5, 'text-anchor': 'start' });
    ROOM_XS.forEach((x) => {
      const node = `r${L}_${x}`;
      N[node] = { x, y: ny };
      const prev = ROOM_PREV[x] === 'h' ? h : `r${L}_${ROOM_PREV[x]}`;
      const px = N[prev].x;
      addEdge(prev, node, `M${px} ${ny} C${px + (x - px) * 0.35} ${ny + 8} ${px + (x - px) * 0.65} ${ny + 8} ${x} ${ny}`, true);
      const shape = chamberShape({ x, y, rx: 56, ry: 34 }, true);
      const g = el('g', { opacity: 0 }, roomDecor);
      const glow = el('ellipse', { cx: x, cy: y, rx: 76, ry: 50, fill: 'url(#warm)', opacity: 0 }, g);
      el('rect', { x: x - 40, y: y + 6, width: 26, height: 10, rx: 4, fill: '#3a2a1f' }, g);
      el('ellipse', { cx: x - 35, cy: y + 5, rx: 6, ry: 3.5, fill: '#6b4d36' }, g);
      const lamp = el('circle', { cx: x + 32, cy: y - 18, r: 3.5, fill: '#3a2a1f' }, g);
      const coins = el('g', {}, g);
      const plate = text(g, x, y + 52, '', { 'font-size': 11, fill: '#c8c0b8', 'font-family': 'JetBrains Mono, monospace', 'font-weight': 700 });
      const amt = text(g, x, y + 66, '', { 'font-size': 11, fill: '#ff7a1a', 'font-weight': 800 });
      const lightEl = light(x, y, 0);
      roomEls.push({ x, y, node, prev, shape, g, glow, lamp, coins, plate, amt, lightEl, owner: null, used: 0, coinsN: 0, open: false });
    });
    levels.push(L);
    soilBand(Math.max(H, y - LEVEL_STEP / 2), y + LEVEL_STEP / 2 + 40, 1000 + L * 97);
    setWorldHeight(y + 110);
  }

  // ---------- layers above the world ----------
  // darkness with light holes; mole, items and labels stay crisp above it
  const dark = el('rect', { x: 0, y: GROUND, width: W, height: H - GROUND, fill: '#000', opacity: 0.42, mask: 'url(#darkMask)', 'pointer-events': 'none' }, svg);
  // roots and the pool surface stay vivid above the darkness
  svg.appendChild(rootsLayer);
  svg.appendChild(poolFront);
  const moleLayer = el('g', {}, svg);
  const items = el('g', {}, svg);
  const fx = el('g', {}, svg);
  svg.appendChild(labels);
  const lights = defs.querySelector('#lights');
  function light(x, y, r) { return el('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.8, fill: 'url(#lightHole)' }, lights); }
  const moleLight = light(0, 0, 150);
  const fireLight = light(fireBase.x, fireBase.y - 20, 140);
  light(SAFE.x, SAFE.y, 120);
  light(PILE.x - 20, CH.treasury.y, 120);
  light(CH.pool.x + 30, CH.pool.y + 10, 120);
  const ui = el('g', {}, svg);
  const flash = el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff', opacity: 0, 'pointer-events': 'none' }, svg);
  const belowHint = el('g', { opacity: 0 }, ui);

  let worldH = H;
  function setWorldHeight(h) {
    worldH = Math.max(H, h);
    soilDeep.setAttribute('height', worldH - GROUND);
    dark.setAttribute('height', worldH - GROUND);
    defs.querySelector('#underRect').setAttribute('height', worldH - GROUND);
    darkMask.setAttribute('height', worldH);
    defs.querySelector('#maskRect').setAttribute('height', worldH);
  }

  // ---------- the mole ----------
  const mole = MoleRig.create(moleLayer, { scale: 1 });
  const M = mole.st;
  let at = 'vault';
  M.x = N.vault.x; M.y = N.vault.y;
  let speedMul = 1;
  let idleOffset = 0, idleTarget = 0;

  let carry = [];
  function itemShape(kind, parent) {
    const g = el('g', {}, parent);
    if (kind === 'bag') {
      el('path', { d: 'M-13 -4 C-16 10 -10 16 0 16 C10 16 16 10 13 -4 C9 -10 -9 -10 -13 -4 Z', fill: '#b5651d', stroke: '#7a3f0e', 'stroke-width': 1.5 }, g);
      el('path', { d: 'M-6 -9 L0 -15 L6 -9', fill: '#8a4a14' }, g);
      el('rect', { x: -7, y: -10, width: 14, height: 3, rx: 1.5, fill: '#ff7a1a' }, g);
      text(g, 0, 8, '2%', { 'font-size': 9, fill: '#fff3e6', 'font-weight': 900 });
    } else if (kind === 'coin') {
      el('circle', { cx: 0, cy: 0, r: 10, fill: '#ff7a1a', stroke: '#c94f02', 'stroke-width': 2 }, g);
      el('circle', { cx: 0, cy: 0, r: 6, fill: 'none', stroke: '#ffc58f', 'stroke-width': 1.2 }, g);
      el('path', { d: 'M-3.5 2.5 L-3.5 -2.5 L0 1 L3.5 -2.5 L3.5 2.5', stroke: '#fff3e6', 'stroke-width': 1.4, fill: 'none', 'stroke-linejoin': 'round' }, g);
    } else if (kind === 'roots') {
      el('circle', { cx: 0, cy: 0, r: 10, fill: '#3b3012', stroke: '#d4a52a', 'stroke-width': 2 }, g);
      el('path', { d: 'M0 -5 L0 5 M0 0 L-4 4 M0 1 L4 5 M0 -2 L-3 -5', stroke: '#f2d77a', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, g);
    } else if (kind === 'lp') {
      el('rect', { x: -11, y: -7, width: 22, height: 14, rx: 3, fill: '#f2eee6', stroke: '#a29a92' }, g);
      text(g, 0, 4, 'LP', { 'font-size': 9, fill: '#c94f02', 'font-weight': 900 });
    }
    return g;
  }
  const carryLabel = el('g', { style: 'display:none' }, ui);
  function setCarry(kinds, labelText) {
    carry.forEach((c) => c.g.remove());
    carry = (kinds || []).map((k) => ({ g: itemShape(k, items) }));
    carryLabel.style.display = kinds && kinds.length && labelText ? '' : 'none';
    if (labelText) setPill(carryLabel, labelText);
  }
  function setPill(g, str, color) {
    g.innerHTML = '';
    const rect = el('rect', { height: 22, rx: 11, fill: '#141414', stroke: color || '#ff6600', 'stroke-width': 1.5, opacity: 0.95 }, g);
    const t = text(g, 0, 15, str, { 'font-size': 12, fill: '#fff', 'font-weight': 800 });
    const w = t.getComputedTextLength() + 22;
    rect.setAttribute('x', -w / 2);
    rect.setAttribute('width', w);
    return g;
  }
  function popup(x, y, str, color) {
    const g = el('g', {}, ui);
    setPill(el('g', {}, g), str, color);
    g.animate([
      { transform: `translate(${x}px, ${y + 8}px)`, opacity: 0 },
      { transform: `translate(${x}px, ${y}px)`, opacity: 1, offset: 0.12 },
      { transform: `translate(${x}px, ${y - 8}px)`, opacity: 1, offset: 0.75 },
      { transform: `translate(${x}px, ${y - 22}px)`, opacity: 0 },
    ], { duration: 2800 / Math.sqrt(speedMul), easing: 'ease-out' }).onfinish = () => g.remove();
  }
  function fly(kind, from, to, ms, lift) {
    return new Promise((resolve) => {
      const g = itemShape(kind, items);
      const dur = (ms || 600) / speedMul, h = lift == null ? 60 : lift;
      const t0 = performance.now();
      function step(now) {
        const t = clamp((now - t0) / dur, 0, 1);
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * h;
        g.setAttribute('transform', `translate(${x} ${y}) rotate(${t * 360})`);
        if (t < 1) requestAnimationFrame(step); else { g.remove(); resolve(); }
      }
      requestAnimationFrame(step);
    });
  }

  const particles = [];
  function particle(x, y, vx, vy, r, color, life, gravity) {
    const c = el('circle', { cx: x, cy: y, r, fill: color }, fx);
    particles.push({ c, x, y, vx, vy, life, max: life, g: gravity == null ? 300 : gravity });
  }
  function dirt(x, y, dir) {
    for (let i = 0; i < 2; i++) particle(x, y, -dir * rand(40, 140), rand(-160, -40), rand(1.5, 3.5), Math.random() > 0.5 ? '#6b4d36' : '#4a3424', rand(0.5, 0.9));
  }
  function splash(x, y) {
    for (let i = 0; i < 14; i++) particle(x, y, rand(-90, 90), rand(-200, -80), rand(1.5, 3), i % 2 ? '#ff8a33' : '#ffc27a', rand(0.5, 0.9), 500);
    const ring = el('ellipse', { cx: x, cy: y, rx: 4, ry: 1.5, fill: 'none', stroke: '#ffc27a', 'stroke-width': 1.5 }, fx);
    ring.style.transformOrigin = `${x}px ${y}px`;
    ring.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(9)', opacity: 0 }], { duration: 900 }).onfinish = () => ring.remove();
  }
  function burst(x, y) {
    for (let i = 0; i < 26; i++) particle(x, y, rand(-140, 140), rand(-260, -60), rand(2, 4.5), ['#ff6600', '#ffb347', '#fff0c2'][i % 3], rand(0.5, 1.1), 260);
    fireBoost = 1;
  }

  // a glow travelling along a root; reverse runs from the tip back to the start
  function pulse(r, ms, reverse) {
    return new Promise((resolve) => {
      const from = reverse ? -r.len : 38, to = reverse ? 38 : -r.len;
      r.pulse.animate([
        { strokeDashoffset: from, opacity: 0 },
        { strokeDashoffset: from + (to - from) * 0.08, opacity: 0.95, offset: 0.08 },
        { strokeDashoffset: to - (to - from) * 0.04, opacity: 0.95, offset: 0.92 },
        { strokeDashoffset: to, opacity: 0 },
      ], { duration: ms / speedMul, easing: 'ease-in-out' }).onfinish = resolve;
      // the sap vein lights up while the pulse passes
      r.vein.animate([{ opacity: 0.9, fill: r.color }, { opacity: 1, fill: '#fff1d0', offset: 0.5 }, { opacity: 0.9, fill: r.color }], { duration: ms / speedMul });
    });
  }
  function treeGlow() {
    leafGlow.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 1600 });
    for (let i = 0; i < 12; i++) {
      const c = el('circle', { cx: TX + rand(-60, 60), cy: GROUND - 110 + rand(-40, 40), r: rand(1.5, 3), fill: '#ffd27a' }, sparkles);
      c.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 1200, delay: i * 60 }).onfinish = () => c.remove();
    }
  }

  // ---------- routing ----------
  function route(from, to) {
    const dist = { [from]: 0 }, prev = {}, todo = new Set(Object.keys(N));
    while (todo.size) {
      let u = null;
      for (const n of todo) if (dist[n] != null && (u == null || dist[n] < dist[u])) u = n;
      if (u == null || u === to) break;
      todo.delete(u);
      for (const e of adj[u] || []) {
        const v = e.a === u ? e.b : e.a;
        const w = dist[u] + e.len * (e.dug ? 1 : 2.5);
        if (dist[v] == null || w < dist[v]) { dist[v] = w; prev[v] = u; }
      }
    }
    const path = [];
    for (let n = to; n !== from; n = prev[n]) { if (n == null) return []; path.unshift(n); }
    return path;
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms / speedMul));
  let walking = null;

  async function goTo(node) {
    if (idleOffset) await settleIdle();
    const path = route(at, node);
    let cur = at;
    for (const nxt of path) {
      const e = edgeBetween(cur, nxt);
      await traverse(e, e.a === cur);
      cur = nxt;
      at = nxt;
    }
    M.moving = false;
  }

  function traverse(e, forward) {
    return new Promise((resolve) => {
      const digging = !e.dug;
      let s = 0, last = performance.now(), lastDirt = 0;
      walking = { e };
      M.moving = true;
      function step(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const v = (digging ? 80 : 240) * speedMul * (queue.length > 2 ? 1.8 : 1);
        M.speed = v;
        s = Math.min(e.len, s + v * dt);
        const pos = forward ? s : e.len - s;
        const p = e.inner.getPointAtLength(pos);
        const q = e.inner.getPointAtLength(clamp(pos + (forward ? 3 : -3), 0, e.len));
        const dx = q.x - p.x, dy = q.y - p.y;
        if (Math.abs(dx) > 0.4) M.dir = dx > 0 ? 1 : -1;
        M.tilt = clamp(Math.atan2(dy, Math.abs(dx) + 0.0001) * 180 / Math.PI, -78, 78);
        M.x = p.x; M.y = p.y;
        M.mode = digging ? 'dig' : carry.length ? 'carry' : 'walk';
        if (digging) {
          setReveal(e, forward ? s : e.len);
          if (now - lastDirt > 45) { const pw = mole.paws(); dirt(pw.x, pw.y, M.dir); lastDirt = now; }
        } else if (M.y > GROUND && now - lastDirt > 160) {
          particle(M.x - M.dir * 20, M.y + 20, -M.dir * rand(10, 40), rand(-30, -10), rand(1, 2), '#4a3424', 0.4);
          lastDirt = now;
        }
        if (s >= e.len) {
          if (digging) { e.dug = true; e.outer.removeAttribute('stroke-dasharray'); e.inner.removeAttribute('stroke-dasharray'); }
          walking = null;
          M.tilt = 0;
          return resolve();
        }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  function settleIdle() {
    idleTarget = 0;
    return new Promise((r) => { const chk = () => (Math.abs(idleOffset) < 1 ? (idleOffset = 0, r()) : setTimeout(chk, 30)); chk(); });
  }

  const say = (x, y, s, c) => popup(x, y, s, c);
  const handsPos = () => mole.hands();
  const R = Object.fromEntries(ROOTS.map((r) => [r.key, r]));
  let stashN = 0;
  let stirUntil = 0;

  // ---------- jobs ----------
  const JOBS = {
    async settle(j) {
      // collect the fees at the surface and bring them to the vault
      await goTo('surf');
      M.dir = -1;
      chartLine.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 1600 / speedMul });
      say(103, GROUND - 118, '+ ' + j.total + ' fees', '#3ddc84');
      for (let i = 0; i < 4; i++) { fly('coin', { x: 104, y: GROUND - 40 }, handsPos(), 450, 50); await wait(110); }
      await wait(380);
      setCarry(['bag'], j.total);
      pulse(taproot, 1400);
      await goTo('vault');
      M.dir = 1; M.toss = 1;
      setCarry([]);
      await fly('bag', handsPos(), SAFE, 420, 30);
      vaultLight.setAttribute('fill', '#ff6600');
      wheel.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(540deg)' }], { duration: 1100 / speedMul, easing: 'ease-in-out' });
      say(SAFE.x + 150, SAFE.y - 56, 'splitting the 2%', '#f5f5f5');
      await wait(700);
      vaultLight.setAttribute('fill', '#5a2a08');

      // out of the safe to the knot, then down every root at once
      await pulse(feeder, 500);
      knotCore.animate([{ r: 4, fill: '#ff7a1a' }, { r: 7, fill: '#fff1d0' }, { r: 4, fill: '#ff7a1a' }], { duration: 500 / speedMul });
      M.hop = 1;
      const ms = 1700;
      pulse(R.liq, ms); pulse(R.extra, ms);
      pulse(R.buyback, ms);
      await pulse(R.rewards, ms);
      setPile(j.after ? j.after.pile : pileCount + 3);
      say(PILE.x, CH.treasury.y - 64, '+ ' + j.rewards + ' rewards', '#9b7cf0');
      setStash(j.after ? j.after.stash : stashN + 1);
      say(STASH.x, STASH.y - 56, '+ ' + j.buyback + ' buyback', '#d4a52a');
      splash(CH.pool.x + 40, poolLevel);
      poolLevel = Math.max(CH.pool.y - 6, poolLevel - 1.5);
      say(CH.pool.x + 30, CH.pool.y - 72, '+ ' + j.liquidity + ' liquidity', '#ff6a1a');
      await wait(1200);
    },

    async epoch(j) {
      await goTo('treasury');
      M.dir = 1; M.hop = 1;
      await wait(300);
      flash.animate([{ opacity: 0 }, { opacity: 0.4 }, { opacity: 0 }], { duration: 360 });
      snapFrame.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 2200 / speedMul });
      roomEls.filter((r) => r.owner).forEach((r, k) => setTimeout(() => {
        r.glow.animate([{ opacity: 0 }, { opacity: 0.8 }, { opacity: 0 }], { duration: 500 });
      }, k * 80));
      say(CH.treasury.x, CH.treasury.y - 80, 'snapshot  ·  epoch #' + j.epoch, '#f5f5f5');
      await wait(1400);
    },

    async claim(j) {
      await goTo('treasury');
      M.dir = 1;
      await fly('coin', { x: PILE.x, y: PILE.y - 8 }, handsPos(), 380, 40);
      setPile(j.after ? j.after.pile : pileCount - 1);
      setCarry(['coin'], j.amount);
      const room = j.slot != null ? roomAt(j.slot, j.recipient) : roomFor(j.recipient);
      if (j.n) setRoomCoins(room, j.n - 1);
      openRoom(room);
      await goTo(room.node);
      M.dir = room.x > SHAFT_X ? 1 : -1; M.toss = 1;
      setCarry([]);
      await fly('coin', handsPos(), { x: room.x + 22, y: room.y + 16 - room.coinsN * 3 }, 380, 30);
      addRoomCoin(room);
      room.amt.textContent = '+' + j.amount;
      room.lamp.setAttribute('fill', '#ffd27a');
      room.lightEl.setAttribute('rx', 76); room.lightEl.setAttribute('ry', 60);
      room.glow.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0.25 }], { duration: 1400, fill: 'forwards' });
      M.hop = 1;
      say(room.x, room.y - 54, '+ ' + j.amount, '#9b7cf0');
      await wait(800);
    },

    async burn(j) {
      await goTo('furnace');
      M.dir = -1;
      setStash(j.after ? j.after.stash : stashN - 1);
      await fly('roots', { x: STASH.x, y: STASH.y - 14 }, handsPos(), 360, 30);
      setCarry(['roots'], j.amount);
      M.dir = 1;
      await wait(300);
      M.toss = 1;
      setCarry([]);
      await fly('roots', handsPos(), { x: fireBase.x, y: fireBase.y - 16 }, 480, 50);
      burst(fireBase.x, fireBase.y - 14);
      flash.animate([{ opacity: 0 }, { opacity: 0.12 }, { opacity: 0 }], { duration: 300 });
      say(fireBase.x - 20, CH.furnace.y - 70, 'burned  ' + j.amount, '#d4a52a');
      await wait(900);
    },

    async liquidity(j) {
      // the budget in the pool becomes ROOTS/wXMR liquidity; fresh LP gets burned
      await goTo('pool');
      M.dir = 1;
      stirUntil = performance.now() + 900 / speedMul;
      splash(CH.pool.x + 30, poolLevel);
      poolLevel = Math.max(CH.pool.y - 8, poolLevel - 2);
      await wait(400);
      const lpFrom = { x: CH.pool.x + 60, y: poolLevel };
      await fly('lp', lpFrom, { x: lpFrom.x + 16, y: lpFrom.y - 44 }, 500, 10);
      for (let i = 0; i < 10; i++) particle(lpFrom.x + 16, lpFrom.y - 44, rand(-60, 60), rand(-120, -30), rand(1.5, 3), i % 2 ? '#ff6600' : '#ffb347', rand(0.4, 0.8), 120);
      say(CH.pool.x + 40, CH.pool.y - 78, 'liquidity added  ' + j.amount + (j.lp ? '  ·  LP burned' : ''), '#ff6a1a');
      // deeper liquidity strengthens the coin: the glow climbs back up to the tree
      pulse(R.extra, 1500, true);
      await pulse(R.liq, 1500, true);
      await pulse(feeder, 400, true);
      await pulse(taproot, 900, true);
      treeGlow();
      await wait(600);
    },

    async other(j) {
      await goTo('vault');
      M.hop = 1;
      say(SAFE.x, SAFE.y - 70, j.label || 'job done', '#f5f5f5');
      await wait(900);
    },
  };

  // ---------- holder rooms ----------
  function roomFor(addr) {
    let r = roomEls.find((x) => x.owner === addr);
    if (!r) {
      r = roomEls.find((x) => !x.owner);
      if (!r && levels.length < MAX_LEVELS) { addLevel(); r = roomEls.find((x) => !x.owner); }
      if (!r) r = roomEls.slice().sort((a, b) => a.used - b.used)[0];
      r.owner = addr;
      r.plate.textContent = addr.length > 12 ? addr.slice(0, 4) + '…' + addr.slice(-4) : addr;
      r.amt.textContent = '';
      r.coins.innerHTML = ''; r.coinsN = 0;
    }
    r.used = Date.now();
    return r;
  }
  function openRoom(r) {
    if (r.open) return;
    r.open = true;
    // the room appears the moment the mole breaks into it
    whenDug(edgeBetween(r.prev, r.node), () => {
      r.shape.forEach((s) => s.setAttribute('opacity', 1));
      r.g.setAttribute('opacity', 1);
    });
  }
  function whenDug(e, fn) {
    if (e.dug) return fn();
    const t = setInterval(() => { if (e.dug) { clearInterval(t); fn(); } }, 40);
  }
  function addRoomCoin(r) {
    if (r.coinsN >= 6) return;
    const x = r.x + 22, y = r.y + 18 - r.coinsN * 3.2;
    el('ellipse', { cx: x, cy: y + 1.5, rx: 8, ry: 3.6, fill: '#a33f00' }, r.coins);
    el('ellipse', { cx: x, cy: y, rx: 8, ry: 3.6, fill: '#ff7a1a', stroke: '#c94f02', 'stroke-width': 1 }, r.coins);
    r.coinsN++;
  }
  function setRoomCoins(r, n) {
    r.coins.innerHTML = ''; r.coinsN = 0;
    for (let i = 0; i < Math.min(6, n); i++) addRoomCoin(r);
  }

  // Shared-timeline mode: the server gives every holder a fixed slot, so the
  // same wallet lives in the same burrow for every visitor.
  function roomAt(slot, addr) {
    while (roomEls.length <= slot && levels.length < MAX_LEVELS) addLevel();
    const r = roomEls[Math.min(slot, roomEls.length - 1)];
    if (r.owner !== addr) {
      r.owner = addr;
      r.plate.textContent = addr.length > 12 ? addr.slice(0, 4) + '…' + addr.slice(-4) : addr;
      r.amt.textContent = '';
      setRoomCoins(r, 0);
    }
    r.used = Date.now();
    return r;
  }
  function markDug(e) {
    if (!e || e.dug) return;
    e.dug = true;
    e.outer.removeAttribute('stroke-dasharray');
    e.inner.removeAttribute('stroke-dasharray');
  }
  // open a burrow at once (no digging animation): shaft down to its level, corridor to it
  function digInstant(r) {
    const L = +r.node.slice(1, r.node.indexOf('_'));
    markDug(edgeBetween('treasury', 'h0'));
    for (let k = 1; k <= L; k++) markDug(edgeBetween('h' + (k - 1), 'h' + k));
    for (let n = r; n; n = roomEls.find((x) => x.node === n.prev)) markDug(edgeBetween(n.prev, n.node));
    r.open = true;
    r.shape.forEach((s) => s.setAttribute('opacity', 1));
    r.g.setAttribute('opacity', 1);
  }
  function lightRoom(r) {
    r.lamp.setAttribute('fill', '#ffd27a');
    r.lightEl.setAttribute('rx', 76); r.lightEl.setAttribute('ry', 60);
  }
  function setPile(n) { pileCount = clamp(n, 3, 24); drawPile(); }
  function setStash(n) { stashN = Math.max(0, n); stashCount.textContent = stashN ? stashN + ' queued' : ''; }
  const END_NODE = { settle: 'vault', epoch: 'treasury', burn: 'furnace', liquidity: 'pool', other: 'vault' };

  // the result of a job without its animation, for events that already played
  function apply(j) {
    let node = END_NODE[j.kind] || 'vault';
    if (j.kind === 'claim' && j.recipient && j.slot != null) {
      const r = roomAt(j.slot, j.recipient);
      digInstant(r);
      setRoomCoins(r, j.n || r.coinsN + 1);
      r.amt.textContent = '+' + j.amount;
      lightRoom(r);
      node = r.node;
    }
    if (j.kind === 'settle') poolLevel = Math.max(CH.pool.y - 6, poolLevel - 1.5);
    if (j.after) { setPile(j.after.pile); setStash(j.after.stash); }
    at = node; idleOffset = 0; idleTarget = 0;
    M.x = N[at].x; M.y = N[at].y;
  }

  // ---------- camera ----------
  // the view is a window onto the world that scrolls down after the mole
  let camY = 0;
  function updateCamera(dt) {
    // stay on the stations (tree and roots in view) until the mole heads down to the burrows
    const target = M.y < H - 40 ? 0 : clamp(M.y - H * 0.45, 0, worldH - H);
    camY += (target - camY) * clamp(dt * 3.2, 0, 1);
    if (Math.abs(target - camY) < 0.3) camY = target;
    svg.setAttribute('viewBox', `0 ${camY.toFixed(1)} ${W} ${H}`);
    flash.setAttribute('y', camY);
    // how many paid burrows are out of view below
    const below = roomEls.filter((r) => r.owner && r.y > camY + H - 20).length;
    if (below !== updateCamera.below) {
      updateCamera.below = below;
      if (below) setPill(belowHint, below + (below === 1 ? ' holder burrow' : ' holder burrows') + ' further down', '#9b7cf0');
      belowHint.setAttribute('opacity', below ? 1 : 0);
    }
    belowHint.setAttribute('transform', `translate(${W / 2} ${camY + H - 34})`);
  }

  // ---------- frame loop ----------
  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const t = now / 1000;

    // idle strolls follow the shared clock, so every visitor sees the same wander
    if (!walking && !busy) {
      const tick = Math.floor(clock() / 3500);
      if (tick !== idleTick) {
        idleTick = tick;
        const room = /^r/.test(at) ? 24 : at === 'surf' ? 30 : 44;
        const h = Math.sin(tick * 12.9898 + at.length * 78.233) * 43758.5453;
        idleTarget = ((h - Math.floor(h)) * 2 - 1) * room;
      }
    }
    if (!walking) {
      const d = idleTarget - idleOffset;
      const step = clamp(d, -60 * dt, 60 * dt);
      idleOffset += step;
      const n = N[at];
      M.x = n.x + idleOffset; M.y = n.y;
      M.moving = Math.abs(step) > 0.01;
      if (M.moving) { M.dir = step > 0 ? 1 : -1; M.speed = 60; }
      M.mode = now < stirUntil ? 'dig' : carry.length ? 'carry' : 'idle';
      M.tilt = 0;
    }
    mole.update(dt);

    if (carry.length) {
      const h = mole.hands();
      carry.forEach((c, i) => c.g.setAttribute('transform', `translate(${h.x} ${h.y - i * 17}) rotate(${Math.sin(t * 3 + i) * 6})`));
      carryLabel.setAttribute('transform', `translate(${h.x} ${h.y - carry.length * 17 - 26})`);
    }

    const hp = mole.head();
    moleLight.setAttribute('cx', hp.x); moleLight.setAttribute('cy', hp.y);
    const fl = 140 + Math.sin(t * 9) * 6 + Math.sin(t * 23) * 3 + fireBoost * 60;
    fireLight.setAttribute('rx', fl); fireLight.setAttribute('ry', fl * 0.8);
    fireGlow.setAttribute('opacity', 0.7 + Math.sin(t * 11) * 0.1 + fireBoost * 0.3);

    fireBoost = Math.max(0, fireBoost - dt * 1.4);
    flames.forEach((f, i) => {
      const sx = f.s * (1 + Math.sin(t * 7 + i) * 0.06 + fireBoost * 0.35);
      const sy = f.s * (1 + Math.sin(t * 9.3 + i * 2) * 0.12 + fireBoost * 0.8);
      const sk = Math.sin(t * 5 + i) * 6;
      f.p.setAttribute('transform', `translate(${fireBase.x} ${fireBase.y}) skewX(${sk.toFixed(1)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`);
    });
    if (Math.random() < dt * (6 + fireBoost * 30)) {
      particle(fireBase.x + rand(-14, 14), fireBase.y - 20, rand(-15, 15), rand(-90, -40), rand(1, 2.2), Math.random() > 0.5 ? '#ffb347' : '#ff6600', rand(0.7, 1.4), -20);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { p.c.remove(); particles.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.c.setAttribute('cx', p.x.toFixed(1)); p.c.setAttribute('cy', p.y.toFixed(1));
      p.c.setAttribute('opacity', (p.life / p.max).toFixed(2));
    }

    drawLiquid(t);

    if (Math.random() < dt * 3) { const s = starEls[(Math.random() * starEls.length) | 0]; s.setAttribute('opacity', rand(0.15, 0.8).toFixed(2)); }
    const lookX = clamp((M.x - 1008) / 200, -1, 1) * 3, lookY = clamp((M.y - GROUND) / 200, -1, 1) * 1.2;
    pupL.setAttribute('cx', -9 + lookX); pupR.setAttribute('cx', 9 + lookX);
    pupL.setAttribute('cy', lookY); pupR.setAttribute('cy', lookY);
    const blink = (t % 5.3) < 0.12 ? 0.3 : 3.4;
    eyeL.setAttribute('ry', blink); eyeR.setAttribute('ry', blink);

    updateCamera(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- queue ----------
  const queue = [];
  let busy = false;
  const listeners = { start: [], end: [] };
  let baseSpeed = 1, deadline = 0;
  async function pump() {
    if (busy) return;
    busy = true;
    while (queue.length) {
      const job = queue.shift();
      listeners.start.forEach((f) => f(job));
      // a job on the shared timeline runs at its scheduled pace and must be
      // done by its deadline; if it falls behind, the mole hurries up
      deadline = job.deadline || 0;
      speedMul = baseSpeed * (job.speed || 1);
      try { await (JOBS[job.kind] || JOBS.other)(job); } catch (e) { console.error(e); }
      setCarry([]);
      deadline = 0;
      speedMul = baseSpeed;
      listeners.end.forEach((f) => f(job));
    }
    busy = false;
  }
  setInterval(() => {
    if (busy && deadline && performance.now() > deadline - 600) speedMul = Math.min(10, speedMul * 1.35);
  }, 150);

  let idleTick = -1;
  let clock = () => Date.now();

  window.Burrow = {
    enqueue(job) { queue.push(job); pump(); },
    apply(job) { apply(job); },
    on(evt, fn) { listeners[evt].push(fn); },
    get busy() { return busy || queue.length > 0; },
    setSpeed(m) { baseSpeed = m; if (!busy) speedMul = m; },
    setClock(fn) { clock = fn; },
  };
})();
