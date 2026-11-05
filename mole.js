// MOLERO character rig, matching the logo: charcoal fur, orange beanie with the
// white M band, grey knit balaclava and turtleneck, long digging claws.
// Built from separate SVG parts that are posed procedurally every frame.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;

  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // One digging paw with long claws, drawn pointing down from the shoulder (0,0).
  function arm(parent, x, y, far) {
    const g = el('g', { transform: `translate(${x} ${y})` }, parent);
    const inner = el('g', {}, g);
    el('path', { d: 'M-5 -3 C-6 6 -4 12 -1 14 L5 13 C7 8 6 1 5 -3 Z', fill: far ? '#202022' : '#38383c' }, inner);
    el('ellipse', { cx: 2, cy: 16, rx: 9, ry: 6.5, fill: far ? '#9c766c' : '#c3988b' }, inner);
    el('path', { d: 'M-5 14 C-1 12 5 12 9 14', stroke: far ? '#83615a' : '#a67d72', 'stroke-width': 1, fill: 'none' }, inner);
    const claws = el('g', { 'stroke-linecap': 'round', fill: 'none' }, inner);
    [[-6, 18, -10, 29], [-2, 20, -3, 32], [2, 21, 3, 33], [6, 20, 9, 31], [9, 17, 14, 27]].forEach(([x1, y1, x2, y2]) => {
      el('path', { d: `M${x1} ${y1} Q${(x1 + x2) / 2 + 2} ${(y1 + y2) / 2} ${x2} ${y2}`, stroke: far ? '#a8917c' : '#dcc6ad', 'stroke-width': 2.8 }, claws);
      el('circle', { cx: x2, cy: y2, r: 1.1, fill: far ? '#5e4b3e' : '#7d6452' }, claws);
    });
    return { g, inner };
  }

  function create(parent, opts) {
    opts = opts || {};
    const id = 'mole' + (++uid);
    const scale = opts.scale || 1;

    const root = el('g', {}, parent);
    const defs = el('defs', {}, root);
    defs.innerHTML = `
      <radialGradient id="${id}-fur" cx=".42" cy=".3" r=".8">
        <stop offset="0" stop-color="#55555a"/><stop offset=".55" stop-color="#2d2d30"/><stop offset="1" stop-color="#161618"/></radialGradient>
      <radialGradient id="${id}-knit" cx=".4" cy=".3" r=".85">
        <stop offset="0" stop-color="#5c5c60"/><stop offset="1" stop-color="#2f2f32"/></radialGradient>
      <linearGradient id="${id}-hat" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ff8a33"/><stop offset=".6" stop-color="#f25f05"/><stop offset="1" stop-color="#c94f02"/></linearGradient>
      <radialGradient id="${id}-nose" cx=".7" cy=".4" r=".8">
        <stop offset="0" stop-color="#d8a19a"/><stop offset="1" stop-color="#a8706c"/></radialGradient>`;

    const shadow = el('ellipse', { cx: 0, cy: 25, rx: 32, ry: 5, fill: '#000', opacity: 0.35 }, root);
    const flip = el('g', {}, root);
    const tilt = el('g', {}, flip);
    const body = el('g', {}, tilt);

    const farArm = arm(body, 14, 7, true);
    const farFoot = el('ellipse', { cx: -16, cy: 19, rx: 7, ry: 4, fill: '#9c766c' }, body);
    el('path', { d: 'M-34 6 C-43 8 -48 3 -49 -3', stroke: '#1c1c1e', 'stroke-width': 4.5, fill: 'none', 'stroke-linecap': 'round' }, body);
    el('ellipse', { cx: -2, cy: 2, rx: 37, ry: 23, fill: `url(#${id}-fur)` }, body);
    const fur = el('g', { stroke: '#68686e', 'stroke-width': 1.2, 'stroke-linecap': 'round', opacity: 0.5 }, body);
    [[-24, -9, -20, -15], [-14, -15, -10, -20], [-4, -18, 0, -22], [-30, 0, -27, -6], [-19, -3, -15, -9], [-8, -8, -4, -13]].forEach(([x1, y1, x2, y2]) =>
      el('line', { x1, y1, x2, y2 }, fur));
    const nearFoot = el('ellipse', { cx: -24, cy: 20, rx: 8, ry: 4.5, fill: '#c3988b' }, body);

    // turtleneck between body and head, ribs clipped to its outline
    el('clipPath', { id: `${id}-neck` }, defs).appendChild(el('ellipse', { cx: 17, cy: 4, rx: 12, ry: 13 }));
    el('ellipse', { cx: 17, cy: 4, rx: 12, ry: 13, fill: `url(#${id}-knit)` }, body);
    const ribs = el('g', { stroke: '#232326', 'stroke-width': 1, opacity: 0.5, 'clip-path': `url(#${id}-neck)` }, body);
    for (let i = -3; i <= 3; i++) el('line', { x1: 17 + i * 3.4, y1: -10, x2: 17 + i * 3.7, y2: 18 }, ribs);

    // head in a knit balaclava
    const head = el('g', { transform: 'translate(26 -10)' }, body);
    const headInner = el('g', {}, head);
    el('circle', { cx: 0, cy: 0, r: 20, fill: `url(#${id}-knit)` }, headInner);
    const knit = el('g', { stroke: '#29292c', 'stroke-width': 0.9, opacity: 0.5, fill: 'none' }, headInner);
    for (let i = 0; i < 5; i++) el('path', { d: `M${-14 + i * 6} 14 C${-15 + i * 6} 6 ${-15 + i * 6} 0 ${-13 + i * 6} -6` }, knit);
    // face opening with the mole's face peeking out
    el('ellipse', { cx: 10, cy: 1, rx: 9.5, ry: 6.5, fill: '#19191b', stroke: '#3c3c40', 'stroke-width': 1.6 }, headInner);
    const eye = el('ellipse', { cx: 9.5, cy: -0.5, rx: 2, ry: 2, fill: '#050505' }, headInner);
    el('circle', { cx: 10.2, cy: -1.2, r: 0.7, fill: '#fff', opacity: 0.8 }, headInner);
    const snout = el('g', { transform: 'translate(15 3)' }, headInner);
    const snoutInner = el('g', {}, snout);
    el('path', { d: 'M0 -3 C5 -5 11 -4 14 -1 C11 3 5 4 0 3 Z', fill: `url(#${id}-nose)` }, snoutInner);
    el('ellipse', { cx: 14, cy: -1, rx: 2.6, ry: 2.3, fill: '#94585a' }, snoutInner);
    const whiskers = el('g', { stroke: '#d7d2cc', 'stroke-width': 0.7, 'stroke-linecap': 'round', opacity: 0.7 }, snoutInner);
    [[9, -1, 22, -6], [9, 0, 23, 0], [9, 1, 21, 6]].forEach(([x1, y1, x2, y2]) => el('line', { x1, y1, x2, y2 }, whiskers));
    // beanie with the white M band
    el('path', { d: 'M-20 -5 C-21 -22 -9 -31 1 -31 C13 -31 22 -23 21 -6 C14 -9 -12 -9 -20 -5 Z', fill: `url(#${id}-hat)` }, headInner);
    const hatKnit = el('g', { stroke: '#c94f02', 'stroke-width': 0.8, opacity: 0.6, fill: 'none' }, headInner);
    for (let i = 0; i < 6; i++) el('path', { d: `M${-15 + i * 6} -9 C${-15 + i * 6} -16 ${-13 + i * 5} -24 ${-10 + i * 4} -28` }, hatKnit);
    // the M: grey knit inside, outlined by the white band, like the logo
    el('path', { d: 'M-7 -7.5 L-5 -17 L1 -10 L7 -17 L9 -7.5 Z', fill: '#3a3a3d' }, headInner);
    el('path', { d: 'M-20 -9 L-8.5 -11 L-6 -21.5 L1 -14.5 L8 -21.5 L11 -11 L21 -10 L21 -6.5 L8.5 -8 L7 -16.5 L1 -10 L-5 -16.5 L-6 -8 L-20 -5.5 Z', fill: '#f2eee6' }, headInner);

    const nearArm = arm(body, 20, 10, false);

    const st = {
      x: 0, y: 0, dir: 1, curDir: 1, tilt: 0, curTilt: 0,
      mode: 'idle', moving: false, speed: 0, phase: 0, t: 0, look: 0, curLook: 0,
      hop: 0, toss: 0, sniff: 0, nextSniff: 2, blink: 0, nextBlink: 3,
    };

    function pose(a, angle) { a.inner.setAttribute('transform', `rotate(${angle})`); }

    function update(dt) {
      st.t += dt;
      st.curDir = lerp(st.curDir, st.dir, clamp(dt * 9, 0, 1));
      st.curTilt = lerp(st.curTilt, st.tilt, clamp(dt * 8, 0, 1));
      st.curLook = lerp(st.curLook, st.look, clamp(dt * 4, 0, 1));
      const m = st.mode;
      const rate = m === 'dig' ? 24 : st.moving ? 9 + st.speed / 40 : 2;
      st.phase += dt * rate;
      const p = st.phase;

      let bob = 0, squash = 1, nearA = 0, farA = 0, nearFootX = 0, farFootX = 0, headRot = 0;
      if (m === 'dig') {
        nearA = -72 + Math.sin(p) * 48;
        farA = -72 + Math.sin(p + Math.PI) * 48;
        bob = Math.sin(p * 2) * 1.2;
        squash = 1 + Math.sin(p * 2) * 0.03;
        headRot = -5 + Math.sin(p) * 3;
      } else if (st.moving) {
        // carried loads ride on the back, so carrying walks like walking
        nearA = -25 + Math.sin(p) * 32;
        farA = -25 + Math.sin(p + Math.PI) * 32;
        nearFootX = Math.sin(p + Math.PI) * 7; farFootX = Math.sin(p) * 7;
        bob = Math.abs(Math.sin(p)) * -3.2;
        squash = 1 + Math.sin(p * 2) * 0.035;
        headRot = Math.sin(p) * 2;
      } else {
        // idle: breathing, looking around, the odd sniff
        squash = 1 + Math.sin(st.t * 2.2) * 0.02;
        nearA = 8 + Math.sin(st.t * 1.3) * 4;
        farA = 4 + Math.sin(st.t * 1.3 + 1) * 4;
        headRot = st.curLook + Math.sin(st.t * 0.7) * 5;
      }
      if (st.toss > 0) {
        st.toss = Math.max(0, st.toss - dt * 3.2);
        const k = Math.sin(st.toss * Math.PI);
        nearA = lerp(nearA, -120, k);
        farA = lerp(farA, -110, k);
      }
      if (st.hop > 0) {
        st.hop = Math.max(0, st.hop - dt * 2.2);
        bob += -Math.sin(st.hop * Math.PI) * 16;
        squash *= 1 + Math.sin(st.hop * Math.PI * 2) * 0.06;
      }
      st.nextSniff -= dt;
      if (st.nextSniff <= 0) { st.sniff = 1; st.nextSniff = 1.5 + Math.random() * 3; }
      st.sniff = Math.max(0, st.sniff - dt * 2.5);
      const sn = Math.sin(st.sniff * Math.PI * 6) * st.sniff;
      st.nextBlink -= dt;
      if (st.nextBlink <= 0) { st.blink = 1; st.nextBlink = 2.5 + Math.random() * 4; }
      st.blink = Math.max(0, st.blink - dt * 7);

      root.setAttribute('transform', `translate(${st.x.toFixed(2)} ${st.y.toFixed(2)}) scale(${scale})`);
      flip.setAttribute('transform', `scale(${st.curDir.toFixed(3)} 1)`);
      tilt.setAttribute('transform', `rotate(${st.curTilt.toFixed(2)}) translate(0 ${bob.toFixed(2)})`);
      body.setAttribute('transform', `scale(${(2 - squash).toFixed(3)} ${squash.toFixed(3)})`);
      shadow.setAttribute('rx', 32 - Math.min(10, -bob));
      shadow.setAttribute('opacity', st.shadow === false ? 0 : 0.35);
      pose(nearArm, nearA);
      pose(farArm, farA);
      nearFoot.setAttribute('cx', -24 + nearFootX);
      farFoot.setAttribute('cx', -16 + farFootX);
      headInner.setAttribute('transform', `rotate(${headRot.toFixed(2)})`);
      snoutInner.setAttribute('transform', `scale(${1 + sn * 0.12} ${1 - sn * 0.06})`);
      eye.setAttribute('ry', st.blink > 0 ? 2 * (1 - Math.sin(st.blink * Math.PI)) + 0.2 : 2);
    }

    // world position of a point given in the mole's local (unflipped) frame
    function toWorld(lx, ly) {
      const a = st.curTilt * Math.PI / 180;
      const rx = lx * Math.cos(a) - ly * Math.sin(a);
      const ry = lx * Math.sin(a) + ly * Math.cos(a);
      return { x: st.x + rx * st.curDir * scale, y: st.y + ry * scale };
    }

    update(0);
    return {
      root, st, update,
      // where carried loads sit: on the mole's back
      hands: () => toWorld(-8, -33),
      paws: () => toWorld(46, 12),
      head: () => toWorld(30, -12),
    };
  }

  window.MoleRig = { create };
})();
