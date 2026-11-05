// The live burrow: a cross-section of the ground under XMR ROOTS.
// Chambers are joined by a fixed tunnel network; the mole walks along the
// tunnel centre lines (path following + shortest route), digs new tunnels to
// holder burrows the first time they are paid, and acts out each on-chain job.
// app.js turns transactions into jobs and calls Burrow.enqueue(job).
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
  const CH = {
    vault:    { x: 262, y: 330, rx: 96, ry: 56 },
    pool:     { x: 600, y: 300, rx: 104, ry: 54 },
    treasury: { x: 420, y: 540, rx: 108, ry: 58 },
    furnace:  { x: 762, y: 556, rx: 98, ry: 60 },
  };
  const floorY = (c) => c.y + c.ry - 24;
  const ROOM_Y = [262, 378, 494, 610];
  const ROOM_X = [1004, 1130];
  const SHAFT_X = 900;

  const N = {
    surf: { x: 200, y: GROUND - 24 },
    hole: { x: 200, y: GROUND + 34 },
    vault: { x: 236, y: floorY(CH.vault) },
    pool: { x: 540, y: floorY(CH.pool) },
    treasury: { x: 380, y: floorY(CH.treasury) },
    furnace: { x: CH.furnace.x - 22, y: floorY(CH.furnace) },
  };
  ROOM_Y.forEach((y, i) => {
    N['s' + i] = { x: SHAFT_X, y: y + 8 };
    N['a' + i] = { x: ROOM_X[0], y: y + 8 };
    N['b' + i] = { x: ROOM_X[1], y: y + 8 };
  });

  const EDGES = [
    ['surf', 'hole', `M200 ${N.surf.y} L200 ${N.hole.y}`],
    ['hole', 'vault', `M200 ${N.hole.y} C200 260 196 ${N.vault.y} ${N.vault.x} ${N.vault.y}`],
    ['vault', 'pool', `M${N.vault.x} ${N.vault.y} C380 ${N.vault.y + 8} 430 ${N.pool.y} ${N.pool.x} ${N.pool.y}`],
    ['vault', 'treasury', `M${N.vault.x} ${N.vault.y} C250 470 290 ${N.treasury.y} ${N.treasury.x} ${N.treasury.y}`],
    ['treasury', 'furnace', `M${N.treasury.x} ${N.treasury.y} C520 ${N.treasury.y + 34} 610 ${N.furnace.y + 6} ${N.furnace.x} ${N.furnace.y}`],
    // leaves the pit along the floor below the fire, then climbs to the bottom of the shaft
    ['furnace', 's3', `M${N.furnace.x} ${N.furnace.y} C${N.furnace.x + 30} ${N.furnace.y + 58} 860 ${N.s3.y + 30} ${N.s3.x} ${N.s3.y}`],
    ['s3', 's2', `M${SHAFT_X} ${N.s3.y} L${SHAFT_X} ${N.s2.y}`],
    ['s2', 's1', `M${SHAFT_X} ${N.s2.y} L${SHAFT_X} ${N.s1.y}`],
    ['s1', 's0', `M${SHAFT_X} ${N.s1.y} L${SHAFT_X} ${N.s0.y}`],
  ];
  ROOM_Y.forEach((y, i) => {
    const yy = y + 8;
    EDGES.push(['s' + i, 'a' + i, `M${SHAFT_X} ${yy} C930 ${yy + 6} 970 ${yy + 6} ${ROOM_X[0]} ${yy}`, true]);
    EDGES.push(['a' + i, 'b' + i, `M${ROOM_X[0]} ${yy} C1050 ${yy - 6} 1090 ${yy - 6} ${ROOM_X[1]} ${yy}`, true]);
  });

  // ---------- defs ----------
  const defs = el('defs', {}, svg);
  defs.innerHTML = `
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#08080a"/><stop offset="1" stop-color="#17161a"/></linearGradient>
    <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a2a1e"/><stop offset=".3" stop-color="#2b1f16"/><stop offset=".7" stop-color="#1e1610"/><stop offset="1" stop-color="#130e0a"/></linearGradient>
    <linearGradient id="tunnelIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0805"/><stop offset="1" stop-color="#1a110b"/></linearGradient>
    <radialGradient id="chamberIn" cx=".5" cy=".65" r=".6"><stop offset="0" stop-color="#22160e"/><stop offset="1" stop-color="#110a06"/></radialGradient>
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a33" stop-opacity=".95"/><stop offset="1" stop-color="#7a2c02" stop-opacity=".95"/></linearGradient>
    <radialGradient id="lightHole" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000"/><stop offset=".55" stop-color="#000" stop-opacity=".7"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="warm" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff7a1a" stop-opacity=".45"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></radialGradient>
    <radialGradient id="moon" cx=".4" cy=".4" r=".6"><stop offset="0" stop-color="#fff6e6"/><stop offset="1" stop-color="#cfc4b0"/></radialGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a4a4e"/><stop offset="1" stop-color="#1f1f22"/></linearGradient>
    <clipPath id="under"><rect x="0" y="${GROUND}" width="${W}" height="${H - GROUND}"/></clipPath>
    <clipPath id="poolClip"><ellipse cx="${CH.pool.x}" cy="${CH.pool.y}" rx="${CH.pool.rx - 3}" ry="${CH.pool.ry - 3}"/></clipPath>
    <mask id="darkMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
      <g id="lights"></g>
    </mask>`;

  // ---------- sky + surface ----------
  el('rect', { x: 0, y: 0, width: W, height: GROUND, fill: 'url(#sky)' }, svg);
  const stars = el('g', {}, svg);
  const starEls = [];
  for (let i = 0; i < 60; i++) {
    starEls.push(el('circle', { cx: (i * 263 + 40) % W, cy: 6 + ((i * 97) % (GROUND - 50)), r: i % 6 ? 0.9 : 1.6, fill: '#fff', opacity: 0.4 }, stars));
  }
  el('circle', { cx: 1110, cy: 46, r: 22, fill: 'url(#moon)', opacity: 0.9 }, svg);
  el('circle', { cx: 1118, cy: 40, r: 4, fill: '#d8cdb8', opacity: 0.6 }, svg);
  el('circle', { cx: 1102, cy: 54, r: 3, fill: '#d8cdb8', opacity: 0.5 }, svg);
  text(svg, 24, 28, 'SOLANA SURFACE  ·  PUBLIC  ·  EVERYONE IS WATCHING', { 'text-anchor': 'start', 'font-size': 12, fill: '#77777d', 'font-weight': 700, 'letter-spacing': 1.6 });

  // underground soil with strata and stones
  el('rect', { x: 0, y: GROUND, width: W, height: H - GROUND, fill: 'url(#soil)' }, svg);
  for (let i = 0; i < 4; i++) {
    const y = 230 + i * 120;
    el('path', { d: `M0 ${y} C200 ${y - 14} 420 ${y + 16} 640 ${y} S1000 ${y - 12} 1200 ${y + 6}`, stroke: '#000', 'stroke-opacity': 0.22, 'stroke-width': 2, fill: 'none' }, svg);
  }
  for (let i = 0; i < 140; i++) {
    const x = (i * 137.7) % W, y = GROUND + 16 + ((i * 211.3) % (H - GROUND - 16));
    el('ellipse', { cx: x, cy: y, rx: 1.5 + (i % 4), ry: 1 + (i % 3), fill: i % 9 ? '#46341f' : '#5c4630', opacity: 0.55 }, svg);
  }
  for (let i = 0; i < 9; i++) {
    const x = 60 + i * 133, y = GROUND + 60 + ((i * 173) % 440);
    el('path', { d: `M${x} ${y} q10 -9 22 -2 q8 6 -2 12 q-12 5 -20 -10 z`, fill: '#4b3a2c', opacity: 0.7 }, svg);
  }

  // ---------- tunnels ----------
  // the tunnel walls are a wider, lighter stroke under the tunnel interior;
  // chambers use the same two layers so every joint is seamless
  const tunnelOuter = el('g', { fill: 'none', 'stroke-linecap': 'round', 'clip-path': 'url(#under)' }, svg);
  const tunnelInner = el('g', { fill: 'none', 'stroke-linecap': 'round', 'clip-path': 'url(#under)' }, svg);
  const edges = EDGES.map(([a, b, d, hidden]) => {
    const outer = el('path', { d, stroke: '#4a3424', 'stroke-width': 54 }, tunnelOuter);
    const inner = el('path', { d, stroke: '#140d08', 'stroke-width': 44 }, tunnelInner);
    const len = inner.getTotalLength();
    const e = { a, b, d, outer, inner, len, dug: !hidden };
    if (hidden) setReveal(e, 0);
    return e;
  });
  function setReveal(e, s) {
    for (const p of [e.outer, e.inner]) {
      // one dash that ends exactly where the mole has dug to
      p.setAttribute('stroke-dasharray', `${e.len + 60} ${e.len + 60}`);
      p.setAttribute('stroke-dashoffset', e.len + 60 - s);
    }
  }
  function edgeBetween(a, b) { return edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a)); }

  function chamberShape(c) {
    el('ellipse', { cx: c.x, cy: c.y, rx: c.rx + 5, ry: c.ry + 5, fill: '#4a3424' }, tunnelOuter);
    el('ellipse', { cx: c.x, cy: c.y, rx: c.rx, ry: c.ry, fill: 'url(#chamberIn)' }, tunnelInner);
  }
  Object.values(CH).forEach(chamberShape);
  const rooms = [];
  ROOM_Y.forEach((y) => ROOM_X.forEach((x) => rooms.push({ x, y, rx: 54, ry: 34 })));
  // rooms are hidden until their tunnel is dug
  const roomShapes = rooms.map((r) => {
    const o = el('ellipse', { cx: r.x, cy: r.y, rx: r.rx + 5, ry: r.ry + 5, fill: '#4a3424', opacity: 0 }, tunnelOuter);
    const i = el('ellipse', { cx: r.x, cy: r.y, rx: r.rx, ry: r.ry, fill: 'url(#chamberIn)', opacity: 0 }, tunnelInner);
    return [o, i];
  });
  // the shaft entrance hole on the surface
  el('ellipse', { cx: 200, cy: GROUND + 2, rx: 30, ry: 8, fill: '#0b0705' }, svg);

  const world = el('g', {}, svg);
  const labels = el('g', {}, svg);
  function label(x, y, title, sub) {
    text(labels, x, y, title, { 'font-size': 13, fill: '#f5f5f5', 'font-weight': 800, 'letter-spacing': 1.2 });
    if (sub) text(labels, x, y + 16, sub, { 'font-size': 11, fill: '#a29a92', 'font-weight': 600 });
  }

  // ---------- surface props ----------
  // trading stall where fees appear
  const stall = el('g', { transform: `translate(64 ${GROUND})` }, world);
  el('rect', { x: 0, y: -62, width: 78, height: 62, rx: 3, fill: '#1d1d20', stroke: '#2e2e33' }, stall);
  el('path', { d: 'M-8 -60 L39 -88 L86 -60 Z', fill: '#e85d04' }, stall);
  for (let i = 0; i < 5; i++) el('rect', { x: -8 + i * 19, y: -62, width: 9.4, height: 10, fill: i % 2 ? '#e85d04' : '#f2eee6' }, stall);
  el('rect', { x: 12, y: -42, width: 54, height: 26, rx: 3, fill: '#0d0d0d', stroke: '#33333a' }, stall);
  text(stall, 39, -25, 'TRADES', { 'font-size': 11, fill: '#ff6600', 'font-weight': 800, 'letter-spacing': 1 });
  const chartLine = el('polyline', { points: '16,-30 24,-34 32,-31 40,-37 48,-35 58,-40', stroke: '#3ddc84', 'stroke-width': 1.4, fill: 'none', opacity: 0.0 }, stall);
  text(stall, 39, -96, 'pump.fun  ·  2% fee', { 'font-size': 11, fill: '#a29a92', 'font-weight': 600 });

  // the tree whose roots drink from the shared ROOTS/wXMR pool
  const TX = CH.pool.x;
  const tree = el('g', {}, world);
  el('path', { d: `M${TX - 14} ${GROUND + 2} C${TX - 10} ${GROUND - 30} ${TX - 8} ${GROUND - 56} ${TX - 4} ${GROUND - 74} L${TX + 6} ${GROUND - 74} C${TX + 9} ${GROUND - 50} ${TX + 11} ${GROUND - 28} ${TX + 16} ${GROUND + 2} Z`, fill: '#4a3424' }, tree);
  el('path', { d: `M${TX - 2} ${GROUND - 60} C${TX - 18} ${GROUND - 74} ${TX - 30} ${GROUND - 76} ${TX - 40} ${GROUND - 86}`, stroke: '#4a3424', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, tree);
  el('path', { d: `M${TX + 4} ${GROUND - 64} C${TX + 18} ${GROUND - 78} ${TX + 30} ${GROUND - 82} ${TX + 42} ${GROUND - 92}`, stroke: '#4a3424', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, tree);
  const canopy = el('g', {}, tree);
  [[-44, -92, 30], [44, -98, 32], [0, -112, 40], [-22, -128, 28], [26, -130, 26], [0, -86, 30]].forEach(([dx, dy, r], i) =>
    el('circle', { cx: TX + dx, cy: GROUND + dy, r, fill: i % 2 ? '#1f3318' : '#264020' }, canopy));
  const leafGlow = el('circle', { cx: TX, cy: GROUND - 108, r: 80, fill: 'url(#warm)', opacity: 0 }, tree);
  const sparkles = el('g', {}, tree);

  // bush with glowing eyes that follow the mole
  const bush = el('g', { transform: `translate(1010 ${GROUND})` }, world);
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

  // grass
  const grass = el('g', {}, world);
  el('rect', { x: 0, y: GROUND - 3, width: W, height: 7, fill: '#2c3d1f' }, grass);
  const blades = [];
  for (let x = 3; x < W; x += 9) {
    if (Math.abs(x - 200) < 30) continue;
    const h = 6 + ((x * 7) % 9);
    blades.push(el('path', { d: `M${x} ${GROUND} q2 -${h} ${2 + (x % 3)} -${h} q1 ${h * 0.6} 3 ${h}`, fill: x % 4 ? '#3c5429' : '#4a6632', 'data-x': x }, grass));
  }

  // ---------- underground stations ----------
  // fee vault: a round safe door with a spinning wheel
  const vault = el('g', { transform: `translate(${CH.vault.x + 38} ${CH.vault.y - 8})` }, world);
  el('circle', { cx: 0, cy: 0, r: 33, fill: 'url(#metal)', stroke: '#5a5a60', 'stroke-width': 3 }, vault);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; el('circle', { cx: Math.cos(a) * 27, cy: Math.sin(a) * 27, r: 2, fill: '#77777d' }, vault); }
  const wheel = el('g', {}, vault);
  el('circle', { cx: 0, cy: 0, r: 14, fill: 'none', stroke: '#8a8a90', 'stroke-width': 3 }, wheel);
  for (let i = 0; i < 3; i++) el('line', { x1: -14, y1: 0, x2: 14, y2: 0, stroke: '#8a8a90', 'stroke-width': 3, transform: `rotate(${i * 60})` }, wheel);
  el('circle', { cx: 0, cy: 0, r: 4, fill: '#ff6600' }, wheel);
  const vaultLight = el('circle', { cx: 0, cy: -40, r: 3.5, fill: '#5a2a08' }, vault);
  label(CH.vault.x, CH.vault.y + CH.vault.ry + 24, 'FEE VAULT', 'program-owned, 2% of every trade');

  // shared liquidity pool, the roots drink from it
  const poolG = el('g', { 'clip-path': 'url(#poolClip)' }, world);
  let poolLevel = CH.pool.y + 14;
  const liquid = el('path', { fill: 'url(#liquid)' }, poolG);
  const liquidShine = el('path', { fill: 'none', stroke: '#ffc27a', 'stroke-width': 1.5, opacity: 0.6 }, poolG);
  label(CH.pool.x, CH.pool.y + CH.pool.ry + 24, 'ROOTS/wXMR POOL', '35% liquidity, LP tokens burned');

  // roots: from the trunk base down into the pool liquid
  const rootsG = el('g', { fill: 'none', 'stroke-linecap': 'round' }, world);
  const ROOT_DEFS = [
    { d: `M${TX - 8} ${GROUND + 2} C${TX - 14} 190 ${TX - 30} 230 ${TX - 22} 322`, w: 7 },
    { d: `M${TX - 2} ${GROUND + 2} C${TX + 2} 196 ${TX + 10} 240 ${TX + 12} 324`, w: 8 },
    { d: `M${TX + 6} ${GROUND + 2} C${TX + 26} 188 ${TX + 48} 222 ${TX + 46} 322`, w: 6.5 },
    { d: `M${TX + 12} ${GROUND + 2} C${TX + 46} 172 ${TX + 80} 210 ${TX + 78} 320`, w: 5.5 },
  ];
  const DECOR_ROOTS = [
    `M${TX - 12} ${GROUND + 4} C${TX - 40} 166 ${TX - 80} 170 ${TX - 120} 196`,
    `M${TX + 14} ${GROUND + 4} C${TX + 50} 162 ${TX + 100} 166 ${TX + 140} 190`,
    `M${TX - 60} 172 C${TX - 70} 186 ${TX - 82} 194 ${TX - 92} 214`,
    `M${TX + 90} 172 C${TX + 104} 184 ${TX + 112} 196 ${TX + 116} 214`,
  ];
  DECOR_ROOTS.forEach((d) => el('path', { d, stroke: '#5c4330', 'stroke-width': 3.5 }, rootsG));
  const roots = ROOT_DEFS.map((r) => {
    const base = el('path', { d: r.d, stroke: '#6b4d36', 'stroke-width': r.w }, rootsG);
    const hi = el('path', { d: r.d, stroke: '#8a6a4e', 'stroke-width': r.w * 0.35, opacity: 0.6, transform: 'translate(-1 0)' }, rootsG);
    const pulse = el('path', { d: r.d, stroke: '#ffb347', 'stroke-width': r.w + 3, opacity: 0 }, rootsG);
    return { base, hi, pulse, w: r.w, len: base.getTotalLength() };
  });
  // tips under the liquid surface: draw the liquid over the root ends
  const poolFront = el('g', { 'clip-path': 'url(#poolClip)' }, world);
  const liquidFront = el('path', { fill: 'url(#liquid)', opacity: 0.55 }, poolFront);
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

  // rewards treasury: a pile of wXMR coins
  const treasury = el('g', {}, world);
  const PILE = { x: CH.treasury.x + 44, y: CH.treasury.y + 34 };
  let pileCount = 9;
  function drawPile() {
    treasury.innerHTML = '';
    let n = 0;
    for (let row = 0; n < pileCount; row++) {
      const per = Math.max(1, 5 - row);
      for (let c = 0; c < per && n < pileCount; c++, n++) {
        const x = PILE.x - (per - 1) * 6.5 + c * 13 + ((n * 7) % 5 - 2), y = PILE.y - row * 6 + ((n * 3) % 3 - 1);
        el('ellipse', { cx: x, cy: y + 2, rx: 9, ry: 4.2, fill: '#a33f00' }, treasury);
        el('ellipse', { cx: x, cy: y, rx: 9, ry: 4.2, fill: '#ff7a1a', stroke: '#c94f02', 'stroke-width': 1 }, treasury);
        el('ellipse', { cx: x, cy: y, rx: 5, ry: 2.2, fill: 'none', stroke: '#ffb06a', 'stroke-width': 0.8 }, treasury);
      }
    }
  }
  drawPile();
  const snapFrame = el('g', { opacity: 0, stroke: '#f5f5f5', 'stroke-width': 3, fill: 'none' }, world);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const cx = CH.treasury.x + sx * (CH.treasury.rx - 14), cy = CH.treasury.y + sy * (CH.treasury.ry - 12);
    el('path', { d: `M${cx} ${cy - sy * 14} L${cx} ${cy} L${cx - sx * 14} ${cy}` }, snapFrame);
  });
  label(CH.treasury.x, CH.treasury.y + CH.treasury.ry + 24, 'REWARDS', '40% for holders, paid in wXMR');

  // burn pit: animated fire and a stash of buyback budget
  const fireBase = { x: CH.furnace.x + 46, y: CH.furnace.y + 40 };
  const furnace = el('g', {}, world);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    el('ellipse', { cx: fireBase.x + Math.cos(a) * 38, cy: fireBase.y + 6 + Math.sin(a) * -2 + (i % 2) * 2, rx: 9, ry: 6, fill: i % 2 ? '#4b3a2c' : '#5c4630' }, furnace);
  }
  const fireGlow = el('ellipse', { cx: fireBase.x, cy: fireBase.y - 20, rx: 70, ry: 50, fill: 'url(#warm)' }, furnace);
  const FLAME = 'M-24 0 C-28 -18 -12 -26 -8 -48 C2 -32 18 -28 14 -12 C22 -20 26 -8 24 0 Z';
  const flames = [['#c94f02', 1.25], ['#ff6600', 1], ['#ffb347', 0.62], ['#fff0c2', 0.3]].map(([fill, s]) =>
    ({ p: el('path', { d: FLAME, fill }, furnace), s }));
  const embers = el('g', {}, furnace);
  const STASH = { x: CH.furnace.x - 72, y: CH.furnace.y + 32 };
  const stash = el('g', { transform: `translate(${STASH.x} ${STASH.y})` }, world);
  el('rect', { x: -14, y: -20, width: 28, height: 20, rx: 2, fill: '#5c3d22', stroke: '#8a5a2c' }, stash);
  el('line', { x1: -14, y1: -10, x2: 14, y2: -10, stroke: '#8a5a2c' }, stash);
  const stashCount = text(stash, 0, -26, '', { 'font-size': 10, fill: '#ffb347', 'font-weight': 800 });
  label(CH.furnace.x, CH.furnace.y + CH.furnace.ry + 24, 'BURN PIT', '25% buys ROOTS and burns it');
  let fireBoost = 0;

  // holder burrows: dug on demand
  text(labels, (ROOM_X[0] + ROOM_X[1]) / 2, ROOM_Y[0] - 64, 'HOLDER BURROWS', { 'font-size': 13, fill: '#f5f5f5', 'font-weight': 800, 'letter-spacing': 1.2 });
  text(labels, (ROOM_X[0] + ROOM_X[1]) / 2, ROOM_Y[0] - 48, 'a new tunnel for every wallet paid', { 'font-size': 11, fill: '#a29a92', 'font-weight': 600 });
  const roomEls = rooms.map((r, i) => {
    const g = el('g', { opacity: 0 }, world);
    const glow = el('ellipse', { cx: r.x, cy: r.y, rx: r.rx + 20, ry: r.ry + 16, fill: 'url(#warm)', opacity: 0 }, g);
    el('rect', { x: r.x - 38, y: r.y + 6, width: 26, height: 10, rx: 4, fill: '#3a2a1f' }, g);
    el('ellipse', { cx: r.x - 33, cy: r.y + 5, rx: 6, ry: 3.5, fill: '#6b4d36' }, g);
    const lamp = el('circle', { cx: r.x + 30, cy: r.y - 18, r: 3.5, fill: '#3a2a1f' }, g);
    const coins = el('g', {}, g);
    const plate = text(g, r.x, r.y + r.ry + 18, '', { 'font-size': 11, fill: '#c8c0b8', 'font-family': 'JetBrains Mono, monospace', 'font-weight': 700 });
    const amt = text(g, r.x, r.y + r.ry + 32, '', { 'font-size': 11, fill: '#ff7a1a', 'font-weight': 800 });
    return { g, glow, lamp, coins, plate, amt, owner: null, used: 0, coinsN: 0, node: (i % 2 ? 'b' : 'a') + Math.floor(i / 2), i };
  });

  // ---------- layers above the world ----------
  // darkness with light holes (mole, fire, stations); the mole, items and labels stay crisp above it
  el('rect', { x: 0, y: GROUND, width: W, height: H - GROUND, fill: '#000', opacity: 0.5, mask: 'url(#darkMask)', 'pointer-events': 'none' }, svg);
  const moleLayer = el('g', {}, svg);
  const items = el('g', {}, svg);
  const fx = el('g', {}, svg);
  svg.appendChild(labels);
  const lights = defs.querySelector('#lights');
  function light(x, y, r) { return el('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.8, fill: 'url(#lightHole)' }, lights); }
  const moleLight = light(0, 0, 150);
  const fireLight = light(fireBase.x, fireBase.y - 20, 150);
  light(CH.vault.x + 30, CH.vault.y, 110);
  light(CH.treasury.x + 30, CH.treasury.y, 120);
  light(CH.pool.x + 20, CH.pool.y + 10, 120);
  const roomLights = rooms.map((r) => { const l = light(r.x, r.y, 0); return l; });
  const ui = el('g', {}, svg);
  const flash = el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff', opacity: 0, 'pointer-events': 'none' }, svg);

  // ---------- the mole ----------
  const mole = MoleRig.create(moleLayer, { scale: 1 });
  const M = mole.st;
  let at = 'vault';
  M.x = N.vault.x; M.y = N.vault.y;
  let speedMul = 1;
  let idleOffset = 0, idleTarget = 0;

  // carried items, drawn at the mole's hands
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
      el('circle', { cx: 0, cy: 0, r: 10, fill: '#2f4a22', stroke: '#9be37a', 'stroke-width': 2 }, g);
      el('path', { d: 'M0 -5 L0 5 M0 0 L-4 4 M0 1 L4 5 M0 -2 L-3 -5', stroke: '#c9f5b0', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, g);
    } else if (kind === 'drop') {
      el('path', { d: 'M0 -12 C6 -4 10 0 10 5 C10 11 5 14 0 14 C-5 14 -10 11 -10 5 C-10 0 -6 -4 0 -12 Z', fill: '#ff8a33', stroke: '#c94f02', 'stroke-width': 1.5 }, g);
      el('path', { d: 'M-4 4 C-4 8 -1 10 2 10', stroke: '#ffd2a1', 'stroke-width': 1.5, fill: 'none' }, g);
    } else if (kind === 'lp') {
      el('rect', { x: -11, y: -7, width: 22, height: 14, rx: 3, fill: '#f2eee6', stroke: '#a29a92' }, g);
      text(g, 0, 4, 'LP', { 'font-size': 9, fill: '#c94f02', 'font-weight': 900 });
    }
    return g;
  }
  function setCarry(kinds, labelText) {
    carry.forEach((c) => c.g.remove());
    carry = (kinds || []).map((k) => ({ g: itemShape(k, items) }));
    carryLabel.style.display = kinds && kinds.length && labelText ? '' : 'none';
    if (labelText) setPill(carryLabel, labelText);
  }
  const carryLabel = el('g', { style: 'display:none' }, ui);
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
    g.setAttribute('transform', `translate(${x} ${y})`);
    g.animate([
      { transform: `translate(${x}px, ${y + 8}px)`, opacity: 0 },
      { transform: `translate(${x}px, ${y}px)`, opacity: 1, offset: 0.12 },
      { transform: `translate(${x}px, ${y - 8}px)`, opacity: 1, offset: 0.75 },
      { transform: `translate(${x}px, ${y - 22}px)`, opacity: 0 },
    ], { duration: 2800 / Math.sqrt(speedMul), easing: 'ease-out' }).onfinish = () => g.remove();
  }

  // an item flying in an arc between two points
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
    ring.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(9)', opacity: 0 }], { duration: 900 }).onfinish = () => ring.remove();
    ring.style.transformOrigin = `${x}px ${y}px`;
  }
  function burst(x, y) {
    for (let i = 0; i < 26; i++) particle(x, y, rand(-140, 140), rand(-260, -60), rand(2, 4.5), ['#ff6600', '#ffb347', '#fff0c2'][i % 3], rand(0.5, 1.1), 260);
    fireBoost = 1;
  }

  // ---------- routing ----------
  const adj = {};
  edges.forEach((e) => { (adj[e.a] = adj[e.a] || []).push(e); (adj[e.b] = adj[e.b] || []).push(e); });
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

  // walk along the tunnel network to a node, digging where there is no tunnel yet
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
        const base = digging ? 70 : 230;
        const v = base * speedMul * (queue.length > 2 ? 1.8 : 1);
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

  // small strolls inside a chamber while idle
  function settleIdle() {
    idleTarget = 0;
    return new Promise((r) => { const chk = () => (Math.abs(idleOffset) < 1 ? (idleOffset = 0, r()) : setTimeout(chk, 30)); chk(); });
  }

  const say = (x, y, s, c) => popup(x, y, s, c);
  const handsPos = () => mole.hands();

  // ---------- jobs ----------
  const JOBS = {
    async settle(j) {
      await goTo('surf');
      M.dir = -1;
      chartLine.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 1600 / speedMul });
      say(103, GROUND - 118, '+ ' + j.total + ' fees', '#3ddc84');
      for (let i = 0; i < 4; i++) { fly('coin', { x: 104, y: GROUND - 40 }, handsPos(), 450, 50); await wait(110); }
      await wait(380);
      setCarry(['bag'], j.total);
      await goTo('vault');
      M.dir = 1;
      M.toss = 1;
      setCarry([]);
      await fly('bag', handsPos(), { x: CH.vault.x + 38, y: CH.vault.y - 8 }, 420, 30);
      vaultLight.setAttribute('fill', '#ff6600');
      wheel.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(540deg)' }], { duration: 1100 / speedMul, easing: 'ease-in-out' });
      say(CH.vault.x + 38, CH.vault.y - 56, 'split 40 / 35 / 25', '#f5f5f5');
      await wait(1150);
      fly('coin', { x: CH.vault.x + 38, y: CH.vault.y - 8 }, handsPos(), 380, 40);
      await wait(120);
      fly('drop', { x: CH.vault.x + 38, y: CH.vault.y - 8 }, handsPos(), 380, 40);
      await wait(120);
      await fly('roots', { x: CH.vault.x + 38, y: CH.vault.y - 8 }, handsPos(), 380, 40);
      vaultLight.setAttribute('fill', '#5a2a08');
      setCarry(['roots', 'drop', 'coin'], 'budgets');

      await goTo('treasury');
      M.dir = 1; M.toss = 1;
      setCarry(['roots', 'drop'], 'budgets');
      await fly('coin', handsPos(), { x: PILE.x, y: PILE.y - pileCount / 2 }, 450, 40);
      pileCount = Math.min(24, pileCount + 3); drawPile();
      say(PILE.x, CH.treasury.y - 50, '+ ' + j.rewards + ' rewards');

      await goTo('furnace');
      M.dir = -1; M.toss = 1;
      setCarry(['drop'], 'liquidity');
      await fly('roots', handsPos(), { x: STASH.x, y: STASH.y - 12 }, 420, 40);
      stashN++; stashCount.textContent = stashN + ' queued';
      say(STASH.x, STASH.y - 60, '+ ' + j.buyback + ' burn budget', '#ffb347');

      await goTo('pool');
      M.dir = 1; M.toss = 1;
      setCarry([]);
      await fly('drop', handsPos(), { x: CH.pool.x + 30, y: poolLevel }, 450, 40);
      splash(CH.pool.x + 30, poolLevel);
      poolLevel = Math.max(CH.pool.y - 6, poolLevel - 1.5);
      say(CH.pool.x + 30, CH.pool.y - 72, '+ ' + j.liquidity + ' LP budget', '#9be37a');
      await wait(600);
    },

    async epoch(j) {
      await goTo('treasury');
      M.dir = 1;
      M.hop = 1;
      await wait(300);
      flash.animate([{ opacity: 0 }, { opacity: 0.4 }, { opacity: 0 }], { duration: 360 });
      snapFrame.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 2200 / speedMul });
      // every known burrow gets counted in the snapshot
      roomEls.filter((r) => r.owner).forEach((r, k) => setTimeout(() => {
        r.glow.animate([{ opacity: 0 }, { opacity: 0.8 }, { opacity: 0 }], { duration: 500 });
      }, k * 120));
      say(CH.treasury.x, CH.treasury.y - 74, 'snapshot  ·  epoch #' + j.epoch, '#f5f5f5');
      await wait(1400);
    },

    async claim(j) {
      await goTo('treasury');
      M.dir = 1;
      await fly('coin', { x: PILE.x, y: PILE.y - pileCount / 2 }, handsPos(), 380, 40);
      pileCount = Math.max(3, pileCount - 1); drawPile();
      setCarry(['coin'], j.amount);
      const room = roomFor(j.recipient);
      if (!roomOpen(room)) openRoom(room);
      await goTo(room.node);
      M.dir = 1; M.toss = 1;
      setCarry([]);
      const r = rooms[room.i];
      await fly('coin', handsPos(), { x: r.x + 20, y: r.y + 16 - room.coinsN * 3 }, 380, 30);
      addRoomCoin(room);
      room.amt.textContent = '+' + j.amount;
      room.lamp.setAttribute('fill', '#ffd27a');
      roomLights[room.i].setAttribute('rx', 70); roomLights[room.i].setAttribute('ry', 56);
      room.glow.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0.25 }], { duration: 1400, fill: 'forwards' });
      M.hop = 1;
      say(r.x, r.y - 52, '+ ' + j.amount);
      await wait(800);
    },

    async burn(j) {
      await goTo('furnace');
      M.dir = -1;
      if (stashN > 0) { stashN--; stashCount.textContent = stashN ? stashN + ' queued' : ''; }
      await fly('roots', { x: STASH.x, y: STASH.y - 12 }, handsPos(), 360, 30);
      setCarry(['roots'], j.amount);
      M.dir = 1;
      await wait(300);
      M.toss = 1;
      setCarry([]);
      await fly('roots', handsPos(), { x: fireBase.x, y: fireBase.y - 16 }, 480, 50);
      burst(fireBase.x, fireBase.y - 14);
      flash.animate([{ opacity: 0 }, { opacity: 0.12 }, { opacity: 0 }], { duration: 300 });
      say(fireBase.x, CH.furnace.y - 64, 'burned  ' + j.amount, '#ffb347');
      await wait(900);
    },

    async liquidity(j) {
      await goTo('vault');
      M.dir = 1;
      await fly('drop', { x: CH.vault.x + 38, y: CH.vault.y - 8 }, handsPos(), 360, 30);
      setCarry(['drop'], j.amount);
      await goTo('pool');
      M.dir = 1; M.toss = 1;
      setCarry([]);
      await fly('drop', handsPos(), { x: CH.pool.x + 24, y: poolLevel }, 450, 40);
      splash(CH.pool.x + 24, poolLevel);
      poolLevel = Math.max(CH.pool.y - 8, poolLevel - 2);
      await wait(250);
      pulseRoots();
      // the new LP tokens rise out of the pool and burn up
      const lpFrom = { x: CH.pool.x + 50, y: poolLevel };
      await fly('lp', lpFrom, { x: lpFrom.x + 20, y: lpFrom.y - 40 }, 500, 10);
      for (let i = 0; i < 10; i++) particle(lpFrom.x + 20, lpFrom.y - 40, rand(-60, 60), rand(-120, -30), rand(1.5, 3), i % 2 ? '#ff6600' : '#ffb347', rand(0.4, 0.8), 120);
      say(CH.pool.x, CH.pool.y - 78, 'roots fed  ' + j.amount + (j.lp ? '  ·  LP burned' : ''), '#9be37a');
      await wait(1000);
    },

    async other(j) {
      await goTo('vault');
      M.hop = 1;
      say(CH.vault.x, CH.vault.y - 70, j.label || 'job done', '#f5f5f5');
      await wait(900);
    },
  };
  let stashN = 0;

  function pulseRoots() {
    roots.forEach((r, i) => {
      r.pulse.setAttribute('stroke-dasharray', `40 ${r.len + 40}`);
      r.pulse.animate([
        { strokeDashoffset: -r.len, opacity: 0 },
        { strokeDashoffset: -r.len * 0.8, opacity: 1, offset: 0.1 },
        { strokeDashoffset: 40, opacity: 1, offset: 0.95 },
        { strokeDashoffset: 40, opacity: 0 },
      ], { duration: (1400 + i * 120) / speedMul, easing: 'ease-in' });
      r.w = Math.min(r.w + 0.4, 13);
      r.base.setAttribute('stroke-width', r.w);
      r.hi.setAttribute('stroke-width', r.w * 0.35);
    });
    setTimeout(() => {
      leafGlow.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 1600 });
      for (let i = 0; i < 12; i++) {
        const sx = TX + rand(-60, 60), sy = GROUND - 110 + rand(-40, 40);
        const c = el('circle', { cx: sx, cy: sy, r: rand(1.5, 3), fill: '#ffd27a' }, sparkles);
        c.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 1200, delay: i * 60 }).onfinish = () => c.remove();
      }
    }, 1300 / speedMul);
  }

  // ---------- holder rooms ----------
  function roomFor(addr) {
    let r = roomEls.find((x) => x.owner === addr);
    if (!r) {
      // fill the near column first, then the far one, then reuse the least recently paid room
      const free = roomEls.filter((x) => !x.owner).sort((a, b) => a.node.localeCompare(b.node));
      r = free[0] || roomEls.slice().sort((a, b) => a.used - b.used)[0];
      r.owner = addr;
      r.plate.textContent = addr.length > 12 ? addr.slice(0, 4) + '…' + addr.slice(-4) : addr;
      r.amt.textContent = '';
      r.coins.innerHTML = ''; r.coinsN = 0;
    }
    r.used = Date.now();
    return r;
  }
  function roomOpen(r) { return r.g.getAttribute('opacity') === '1'; }
  function openRoom(r) {
    // the room becomes visible as the mole digs into it
    const row = r.node.slice(1);
    const showShape = (idx) => roomShapes[idx].forEach((s) => s.setAttribute('opacity', 1));
    // a far room is reached through the near one, so that one's chamber appears too
    if (r.node[0] === 'b') whenDug(edgeBetween('s' + row, 'a' + row), () => showShape(r.i - 1));
    const prev = r.node[0] === 'a' ? 's' + row : 'a' + row;
    whenDug(edgeBetween(prev, r.node), () => { showShape(r.i); r.g.setAttribute('opacity', 1); });
  }
  function whenDug(e, fn) {
    if (e.dug) return fn();
    const t = setInterval(() => { if (e.dug) { clearInterval(t); fn(); } }, 40);
  }
  function addRoomCoin(r) {
    if (r.coinsN >= 6) return;
    const R = rooms[r.i];
    const x = R.x + 20, y = R.y + 18 - r.coinsN * 3.2;
    el('ellipse', { cx: x, cy: y + 1.5, rx: 8, ry: 3.6, fill: '#a33f00' }, r.coins);
    el('ellipse', { cx: x, cy: y, rx: 8, ry: 3.6, fill: '#ff7a1a', stroke: '#c94f02', 'stroke-width': 1 }, r.coins);
    r.coinsN++;
  }

  // ---------- frame loop ----------
  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const t = now / 1000;

    // idle strolls inside the current chamber
    if (!walking && !busy) {
      if (Math.abs(idleOffset - idleTarget) < 0.5 && Math.random() < dt * 0.35) {
        const room = /^[ab]/.test(at) ? 26 : at === 'surf' ? 30 : 46;
        idleTarget = rand(-room, room);
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
      M.mode = carry.length ? 'carry' : 'idle';
      M.tilt = 0;
    }
    mole.update(dt);

    // carried stack
    if (carry.length) {
      const h = mole.hands();
      carry.forEach((c, i) => c.g.setAttribute('transform', `translate(${h.x} ${h.y - i * 17}) rotate(${Math.sin(t * 3 + i) * 6})`));
      carryLabel.setAttribute('transform', `translate(${h.x} ${h.y - carry.length * 17 - 26})`);
    }

    // lights
    const hp = mole.head();
    moleLight.setAttribute('cx', hp.x); moleLight.setAttribute('cy', hp.y);
    const fl = 150 + Math.sin(t * 9) * 6 + Math.sin(t * 23) * 3 + fireBoost * 60;
    fireLight.setAttribute('rx', fl); fireLight.setAttribute('ry', fl * 0.8);
    fireGlow.setAttribute('opacity', 0.7 + Math.sin(t * 11) * 0.1 + fireBoost * 0.3);

    // fire
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

    // particles
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

    // surface life
    if (Math.random() < dt * 3) { const s = starEls[(Math.random() * starEls.length) | 0]; s.setAttribute('opacity', rand(0.15, 0.8).toFixed(2)); }
    const lookX = clamp((M.x - 1018) / 200, -1, 1) * 3, lookY = clamp((M.y - GROUND) / 200, -1, 1) * 1.2;
    pupL.setAttribute('cx', -9 + lookX); pupR.setAttribute('cx', 9 + lookX);
    pupL.setAttribute('cy', lookY); pupR.setAttribute('cy', lookY);
    const blink = (t % 5.3) < 0.12 ? 0.3 : 3.4;
    eyeL.setAttribute('ry', blink); eyeR.setAttribute('ry', blink);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- queue ----------
  const queue = [];
  let busy = false;
  const listeners = { start: [], end: [] };
  async function pump() {
    if (busy) return;
    busy = true;
    while (queue.length) {
      const job = queue.shift();
      listeners.start.forEach((f) => f(job));
      try { await (JOBS[job.kind] || JOBS.other)(job); } catch (e) { console.error(e); }
      setCarry([]);
      listeners.end.forEach((f) => f(job));
    }
    busy = false;
  }

  window.Burrow = {
    enqueue(job) { queue.push(job); pump(); },
    on(evt, fn) { listeners[evt].push(fn); },
    get busy() { return busy || queue.length > 0; },
    setSpeed(m) { speedMul = m; },
  };
})();
