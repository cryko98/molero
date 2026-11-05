// $MOLERO site logic: watches the XMR ROOTS program on Solana and turns its
// event logs into jobs for the mole in scene.js.
//
// The XMR ROOTS program writes one structured log line per operation, e.g.
//   Program log: HR:settled mint=<coin> total=.. rewards=.. buyback=.. liquidity=..
//   Program log: HR:reward_epoch coin=<coin account> epoch=146 budget=..
//   Program log: HR:holder_claim mint=<coin> recipient=<wallet> quote=..
//   Program log: HR:roots_budget_burn source=<coin> burned=..
//   Program log: HR:liquidity source=<coin> quote=.. lp_burned=.. quote_mint=..
// Amounts are raw integers in the coin's pair asset (wXMR: 12 decimals, ROOTS: 6).

const CONFIG = {
  // Fill these in after launch. Until then the site watches every XMR ROOTS coin.
  TOKEN_MINT: '',
  // The coin's XMR ROOTS account (owner of its fee vault). Optional: learned
  // automatically from a fee settlement when the RPC allows reading transactions.
  COIN_ACCOUNT: '',
  PAIR: 'wXMR',
  // api.mainnet-beta.solana.com refuses browser requests, so the default is PublicNode.
  // A free Helius/Triton key is more reliable; set RPC_WS too for instant updates.
  RPC_HTTP: 'https://solana-rpc.publicnode.com',
  RPC_WS: '',
  BACKFILL: 8,
};

const PROGRAM = '9RSfkTWckTiuCQTae86bgqZWumcLcj4fzDLxi9qNoVeM';
const WXMR = 'WXMRyRZhsa19ety5erZhHg4N3xj3EVN92u94422teJp';
const ROOTS = '4PbxcLPioEQNQT8jCdTnvfM2CddTzHrDStnxniRypump';
const DECIMALS = { wXMR: 12, ROOTS: 6 };
const ROOTS_INITIAL_SUPPLY = 1_000_000_000;

// URL overrides make testing against an existing coin easy: ?mint=...&rpc=...
const qs = new URLSearchParams(location.search);
if (qs.get('mint')) CONFIG.TOKEN_MINT = qs.get('mint');
if (qs.get('coin')) CONFIG.COIN_ACCOUNT = qs.get('coin');
if (qs.get('pair')) CONFIG.PAIR = qs.get('pair');
if (qs.get('rpc')) CONFIG.RPC_HTTP = qs.get('rpc');
if (qs.get('ws')) CONFIG.RPC_WS = qs.get('ws');
else if (qs.get('rpc')) CONFIG.RPC_WS = qs.get('rpc').replace(/^http/, 'ws');

const $ = (id) => document.getElementById(id);
const short = (a) => (a ? a.slice(0, 4) + '…' + a.slice(-4) : '');

// ---------- small UI bits ----------
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 1800);
}

(function marquee() {
  const items = ['<b>HE DIGS</b> · YOU EARN · NOBODY SEES', '40% → HOLDERS IN <b>wXMR</b>', '25% → ROOTS <b>BURIED</b>',
    '35% → ROOTS/wXMR <b>LIQUIDITY</b>', 'LP TOKENS <b>BURNED</b>', 'MOLE + MONERO = <b>$MOLERO</b>', 'NO CLAIMING · THE MOLE <b>DELIVERS</b>'];
  const html = items.map((s) => `<span><i class="sep"></i>${s}</span>`).join('');
  $('marquee').innerHTML = html + html;
})();

// Line icons for the feed and the job cards (no emoji anywhere on the page).
const ico = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICONS = {
  settle: ico('<path d="M14 4c3 0 5.5 1.5 7 4-2.5-1-5-1.3-7-1"/><path d="M14 4c-3 0-5.5 1.5-7 4 2.5-1 5-1.3 7-1"/><path d="M14 7L5 20"/>'),
  epoch: ico('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  claim: ico('<circle cx="12" cy="12" r="8"/><path d="M8.5 14.5v-5l3.5 3.5 3.5-3.5v5"/>'),
  burn: ico('<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3.5 3-5.5 3.5-9 2 1.5 3 3.5 3 5.5 1-.8 1.6-2 1.8-3.3 2 1.8 4.7 4.2 4.7 6.8 0 3.4-2.5 6-6.5 6z"/><path d="M12 21c-1.6 0-2.7-1.1-2.7-2.6 0-1.6 1.4-2.6 2.7-4.4 1.3 1.8 2.7 2.8 2.7 4.4 0 1.5-1.1 2.6-2.7 2.6z"/>'),
  liquidity: ico('<path d="M12 21v-8"/><path d="M12 13c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 15c0-3-2.2-5-5.5-5 0 3 2.2 5 5.5 5z"/><path d="M8 21h8"/>'),
  other: ico('<ellipse cx="12" cy="14" rx="8" ry="5"/><ellipse cx="12" cy="14" rx="4" ry="2.2"/>'),
};
document.querySelectorAll('[data-icon]').forEach((n) => { n.innerHTML = ICONS[n.dataset.icon]; });

// Hero: the mascot climbs out of the molehill, breathes, ducks now and then
// and leans towards the cursor.
(function hero() {
  const rise = $('rise'), img = $('hero-mole'), clods = $('clods');
  if (!rise) return;
  function throwDirt(n) {
    for (let i = 0; i < n; i++) {
      const c = document.createElement('span');
      c.className = 'clod';
      const s = 5 + Math.random() * 9;
      c.style.width = s + 'px'; c.style.height = s * 0.8 + 'px';
      c.style.background = ['#5c4330', '#6b4d36', '#4a3424'][i % 3];
      clods.appendChild(c);
      const dx = (Math.random() - 0.5) * 360, up = 80 + Math.random() * 140;
      c.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx * 0.6}px, ${-up}px) rotate(${dx}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px, ${40 + Math.random() * 30}px) rotate(${dx * 2}deg)`, opacity: 0 },
      ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => c.remove();
    }
  }
  const start = () => {
    rise.classList.add('up');
    setTimeout(() => throwDirt(18), 120);
    rise.addEventListener('animationend', () => { rise.classList.remove('up'); rise.classList.add('idle'); }, { once: true });
  };
  if (img.complete) setTimeout(start, 250); else img.addEventListener('load', () => setTimeout(start, 150), { once: true });
  setInterval(() => {
    if (!rise.classList.contains('idle') || document.hidden) return;
    rise.classList.remove('idle');
    rise.classList.add('duck');
    setTimeout(() => throwDirt(8), 1050);
    rise.addEventListener('animationend', () => { rise.classList.remove('duck'); rise.classList.add('idle'); }, { once: true });
  }, 9000);
  window.addEventListener('pointermove', (e) => {
    const r = img.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
    img.style.setProperty('--tilt', (Math.max(-1, Math.min(1, dx * 2)) * 4).toFixed(2) + 'deg');
  }, { passive: true });
})();

(function contract() {
  if (CONFIG.TOKEN_MINT) {
    $('ca-value').textContent = CONFIG.TOKEN_MINT;
    const coinUrl = 'https://xmrroots.xyz/coin.html?mint=' + CONFIG.TOKEN_MINT;
    ['buy-top', 'buy-hero', 'buy-step', 'buy-bottom'].forEach((id) => { const a = $(id); if (a) a.href = coinUrl; });
  }
  $('ca-copy').addEventListener('click', async () => {
    if (!CONFIG.TOKEN_MINT) return toast('The mole is still digging. CA coming soon.');
    try { await navigator.clipboard.writeText(CONFIG.TOKEN_MINT); toast('CA copied'); } catch { toast('Copy failed'); }
  });
})();

(function calculator() {
  const usd = (n) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: n < 100 ? 2 : 0 });
  function update() {
    const v = Math.max(0, +$('vol').value || 0), fee = v * 0.02;
    $('c-total').textContent = usd(fee);
    $('c-hold').textContent = usd(fee * 0.4);
    $('c-liq').textContent = usd(fee * 0.35);
    $('c-burn').textContent = usd(fee * 0.25);
  }
  $('vol').addEventListener('input', update);
  document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => { $('vol').value = c.dataset.v; update(); }));
  update();
})();

// ---------- RPC ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let rpcId = 0;
async function rpc(method, params, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(CONFIG.RPC_HTTP, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
      });
      if (res.status === 429) { await sleep(1500 * (i + 1)); continue; }
      const j = await res.json();
      if (j.result !== undefined && j.result !== null) return j.result;
      if (j.error) throw new Error(j.error.message);
    } catch (e) {
      if (i === tries - 1) throw e;
    }
    await sleep(1000 * (i + 1));
  }
  return null;
}

// ---------- event parsing ----------
function parseHR(logs) {
  const out = [];
  for (const line of logs || []) {
    const m = line.match(/HR:(\w+)\s*(.*)$/);
    if (!m) continue;
    const f = {};
    for (const kv of m[2].split(/\s+/)) {
      const i = kv.indexOf('=');
      if (i > 0) f[kv.slice(0, i)] = kv.slice(i + 1);
    }
    out.push({ type: m[1], f });
  }
  return out;
}

// Pair asset per coin mint, so raw amounts can be shown with the right decimals.
const pairOf = {};
try { Object.assign(pairOf, JSON.parse(localStorage.getItem('molero-pairs') || '{}')); } catch {}
function rememberPair(mint, pair) {
  if (!mint || pairOf[mint] === pair) return;
  pairOf[mint] = pair;
  try { localStorage.setItem('molero-pairs', JSON.stringify(pairOf)); } catch {}
}
if (CONFIG.TOKEN_MINT) rememberPair(CONFIG.TOKEN_MINT, CONFIG.PAIR);

function learnFromTx(tx, events) {
  const bals = (tx.meta && tx.meta.postTokenBalances) || [];
  const pre = (tx.meta && tx.meta.preTokenBalances) || [];
  const mints = new Set(bals.map((b) => b.mint));
  for (const e of events) {
    const coin = e.f.mint || e.f.source;
    if (!coin) continue;
    if (e.type === 'settled') {
      // The only pair-asset account that grows in a settlement is the coin's vault.
      for (const b of bals) {
        if (b.mint !== WXMR && b.mint !== ROOTS) continue;
        const p = pre.find((x) => x.accountIndex === b.accountIndex);
        const grew = +b.uiTokenAmount.amount > +(p ? p.uiTokenAmount.amount : 0);
        if (grew) {
          rememberPair(coin, b.mint === WXMR ? 'wXMR' : 'ROOTS');
          if (coin === CONFIG.TOKEN_MINT && !CONFIG.COIN_ACCOUNT) CONFIG.COIN_ACCOUNT = b.owner;
        }
      }
    } else if (!pairOf[coin]) {
      if (mints.has(WXMR) && !mints.has(ROOTS)) rememberPair(coin, 'wXMR');
      if (mints.has(ROOTS) && !mints.has(WXMR)) rememberPair(coin, 'ROOTS');
    }
  }
}

function amount(raw, coin, forcePair) {
  const pair = forcePair || pairOf[coin];
  if (raw == null) return '';
  if (!pair) return Number(raw).toLocaleString('en-US') + ' units';
  const v = Number(raw) / 10 ** DECIMALS[pair];
  let s;
  if (v === 0) s = '0';
  else if (v >= 1000) s = v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  else if (v >= 1) s = v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  else s = v.toPrecision(3).replace(/0+$/, '');
  return s + ' ' + pair;
}

function matchesUs(e) {
  if (!CONFIG.TOKEN_MINT) return true;
  if (e.type === 'reward_epoch') return !!CONFIG.COIN_ACCOUNT && e.f.coin === CONFIG.COIN_ACCOUNT;
  return e.f.mint === CONFIG.TOKEN_MINT || e.f.source === CONFIG.TOKEN_MINT;
}

// Turn one HR event into a job for the mole and a line in the feed.
function toJob(e, sig, time) {
  const f = e.f, coin = f.mint || f.source;
  const base = { sig, time, coin, type: e.type };
  switch (e.type) {
    case 'settled':
      return Object.assign(base, {
        kind: 'settle', title: 'Fees collected & split',
        total: amount(f.total, coin), rewards: amount(f.rewards, coin),
        buyback: amount(f.buyback, coin), liquidity: amount(f.liquidity, coin),
        amt: amount(f.total, coin), raw: f.total,
      });
    case 'reward_epoch':
      return Object.assign(base, {
        kind: 'epoch', title: 'Holder snapshot #' + f.epoch, epoch: f.epoch,
        amt: f.budget ? 'budget ' + Number(f.budget).toLocaleString('en-US') + ' raw' : '', coin: f.coin,
      });
    case 'holder_claim':
    case 'creator_claim':
    case 'creator_payout':
      return Object.assign(base, {
        kind: 'claim', title: 'Reward delivered to ' + short(f.recipient),
        recipient: f.recipient || 'creator', amount: amount(f.quote || f.amount, coin), amt: amount(f.quote || f.amount, coin),
        raw: f.quote || f.amount,
      });
    case 'liquidity': {
      const pair = f.quote_mint === ROOTS ? 'ROOTS' : f.quote_mint === WXMR ? 'wXMR' : undefined;
      if (pair) rememberPair(coin, pair);
      return Object.assign(base, {
        kind: 'liquidity', title: 'Roots fed · LP burned', lp: f.lp_burned,
        amount: amount(f.quote, coin, pair), amt: amount(f.quote, coin, pair),
      });
    }
    default:
      if (/burn|buyback/.test(e.type)) {
        const raw = f.burned || f.roots || f.amount || f.quote;
        const isRoots = e.type === 'roots_budget_burn' || !!f.burned;
        if (e.type === 'roots_budget_burn') rememberPair(coin, 'ROOTS');
        return Object.assign(base, {
          kind: 'burn', title: 'ROOTS buried',
          amount: isRoots ? amount(raw, null, 'ROOTS') : amount(raw, coin), amt: isRoots ? amount(raw, null, 'ROOTS') : amount(raw, coin),
          raw, burnedRoots: isRoots ? Number(raw) / 1e6 : 0,
        });
      }
      return Object.assign(base, { kind: 'other', title: e.type.replace(/_/g, ' '), label: e.type.replace(/_/g, ' ') });
  }
}

// ---------- feed + stats ----------
const seen = new Set();
const stats = { jobs: 0, rewards: {}, holders: new Set(), burnedSession: 0 };
const feedEl = $('feed');

function addFeed(job, demo) {
  const empty = $('feed-empty');
  if (empty) empty.remove();
  const li = document.createElement('li');
  li.className = 'feed-item';
  const when = new Date((job.time || Date.now() / 1000) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const link = job.sig && !demo
    ? `<a href="https://solscan.io/tx/${job.sig}" target="_blank" rel="noopener">tx ${job.sig.slice(0, 6)}… ↗</a>` : '';
  const coin = !CONFIG.TOKEN_MINT && job.coin && !demo
    ? `<a href="https://xmrroots.xyz/coin.html?mint=${job.coin}" target="_blank" rel="noopener">coin ${short(job.coin)}</a>` : '';
  li.innerHTML = `<div class="feed-ico">${ICONS[job.kind] || ICONS.other}</div><div>
      <div class="feed-title"></div>
      <div class="feed-meta"><span>${when}</span>${demo ? '<span class="tag-demo">DEMO</span>' : ''}${coin}${link}</div></div>`;
  li.querySelector('.feed-title').innerHTML = escapeHtml(job.title) + (job.amt ? ' · <span class="feed-amt">' + escapeHtml(job.amt) + '</span>' : '');
  feedEl.prepend(li);
  while (feedEl.children.length > 60) feedEl.lastChild.remove();
  job.li = li;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function count(job, demo) {
  if (demo) return;
  stats.jobs++;
  if (job.kind === 'claim' && job.raw) {
    const pair = pairOf[job.coin];
    if (pair) stats.rewards[pair] = (stats.rewards[pair] || 0) + Number(job.raw) / 10 ** DECIMALS[pair];
    stats.holders.add(job.recipient);
  }
  if (job.burnedRoots) stats.burnedSession += job.burnedRoots;
  renderStats();
}
function renderStats() {
  $('st-jobs').textContent = stats.jobs;
  $('feed-count').textContent = stats.jobs;
  const parts = Object.entries(stats.rewards).map(([p, v]) => (v < 1 ? v.toPrecision(3) : v.toLocaleString('en-US', { maximumFractionDigits: 2 })) + ' ' + p);
  $('st-rewards').textContent = parts.length ? parts.join(' + ') : '0';
  $('st-holders').textContent = stats.holders.size;
  if (stats.burnedSession) $('st-burned-sub').textContent = '+' + stats.burnedSession.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ROOTS seen this visit';
}

async function refreshBurned() {
  try {
    // getAccountInfo on the mint works on RPCs that don't serve getTokenSupply.
    const a = await rpc('getAccountInfo', [ROOTS, { encoding: 'jsonParsed' }]);
    const info = a && a.value && a.value.data.parsed && a.value.data.parsed.info;
    if (!info) return;
    const supply = Number(info.supply) / 10 ** info.decimals;
    const burned = ROOTS_INITIAL_SUPPLY - supply;
    $('st-burned').textContent = (burned / 1e6).toFixed(1) + 'M';
    if (!stats.burnedSession) $('st-burned-sub').textContent = (burned / ROOTS_INITIAL_SUPPLY * 100).toFixed(2) + '% of ROOTS supply';
  } catch { /* keep the previous value */ }
}

// ---------- intake ----------
async function ingest(sig, logs, time, tx) {
  if (seen.has(sig)) return;
  seen.add(sig);
  const events = parseHR(logs).filter(matchesUs);
  if (!events.length) return;
  // Websocket logs carry no balances; read the transaction once to learn an unknown pair.
  const unknown = events.some((e) => { const c = e.f.mint || e.f.source; return c && !pairOf[c] && !e.f.quote_mint && e.type !== 'roots_budget_burn'; });
  if (!tx && unknown) {
    try { tx = await rpc('getTransaction', [sig, { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }], 2); } catch {}
  }
  if (tx) learnFromTx(tx, events);
  for (const e of events) {
    if (!matchesUs(e)) continue;
    const job = toJob(e, sig, time);
    addFeed(job);
    count(job);
    Burrow.enqueue(job);
  }
}

Burrow.on('start', (job) => {
  document.querySelectorAll('.feed-item.active').forEach((x) => x.classList.remove('active'));
  if (job.li) job.li.classList.add('active');
  $('now').innerHTML = 'Now: <b>' + escapeHtml(job.title) + '</b>' + (job.amt ? ' · ' + escapeHtml(job.amt) : '');
});
Burrow.on('end', (job) => {
  if (job.li) job.li.classList.remove('active');
  if (!Burrow.busy) $('now').textContent = 'The mole is sniffing around for the next job…';
});

// Fetch transactions one at a time: the public RPC punishes bursts.
const txQueue = [];
let txBusy = false;
async function drainTx() {
  if (txBusy) return;
  txBusy = true;
  while (txQueue.length) {
    const s = txQueue.shift();
    if (seen.has(s.signature)) continue;
    try {
      const tx = await rpc('getTransaction', [s.signature, { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]);
      if (tx && !tx.meta.err) ingest(s.signature, tx.meta.logMessages, tx.blockTime, tx);
    } catch { /* skip this one */ }
    await sleep(700);
  }
  txBusy = false;
}

let newestSig = null;
async function poll(limit) {
  try {
    const opts = { limit, commitment: 'confirmed' };
    if (newestSig) opts.until = newestSig;
    // A launched coin's own account sees far less traffic than the whole program.
    const addr = CONFIG.TOKEN_MINT ? (CONFIG.COIN_ACCOUNT || PROGRAM) : PROGRAM;
    const sigs = await rpc('getSignaturesForAddress', [addr, opts]);
    if (!sigs || !sigs.length) return;
    newestSig = sigs[0].signature;
    // oldest first, so the mole works through them in order
    sigs.filter((s) => !s.err).reverse().forEach((s) => txQueue.push(s));
    drainTx();
  } catch { setStatus('down', 'RPC unreachable, retrying…'); }
}

function setStatus(cls, msg) {
  $('status').className = 'status ' + cls;
  $('status-text').textContent = msg;
}
$('watching').innerHTML = CONFIG.TOKEN_MINT
  ? 'Watching <b>$MOLERO</b> · ' + short(CONFIG.TOKEN_MINT)
  : 'Pre-launch: watching <b>every XMR ROOTS coin</b>';

// Websocket for instant logs; HTTP polling keeps working whenever it drops.
let ws, wsOpen = false, wsRetry = 0;
function connectWs() {
  if (!CONFIG.RPC_WS) return setStatus('live', 'LIVE · Solana mainnet · checks every 15s');
  try { ws = new WebSocket(CONFIG.RPC_WS); } catch { return scheduleWs(); }
  ws.onopen = () => {
    ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'logsSubscribe', params: [{ mentions: [PROGRAM] }, { commitment: 'confirmed' }] }));
  };
  ws.onmessage = (m) => {
    let d; try { d = JSON.parse(m.data); } catch { return; }
    if (d.id === 1 && d.result !== undefined) { wsOpen = true; wsRetry = 0; setStatus('live', 'LIVE · Solana mainnet'); return; }
    const v = d.params && d.params.result && d.params.result.value;
    if (!v || v.err) return;
    newestSig = newestSig || v.signature;
    ingest(v.signature, v.logs, Date.now() / 1000, null);
  };
  ws.onclose = () => { wsOpen = false; scheduleWs(); };
  ws.onerror = () => { try { ws.close(); } catch {} };
}
function scheduleWs() {
  setStatus('poll', 'Polling Solana every 15s');
  wsRetry = Math.min(wsRetry + 1, 6);
  setTimeout(connectWs, 2000 * wsRetry);
}

// ---------- demo ----------
function demoCycle() {
  const now = Date.now() / 1000;
  const fake = () => Array.from({ length: 44 }, () => '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 57)]).join('');
  const jobs = [
    { kind: 'settle', title: 'Fees collected & split', total: '0.0125 wXMR', rewards: '0.005 wXMR', liquidity: '0.0044 wXMR', buyback: '0.0031 wXMR', amt: '0.0125 wXMR' },
    { kind: 'epoch', title: 'Holder snapshot #42', epoch: 42, amt: '' },
    ...[0.0021, 0.0016, 0.0009].map((a) => {
      const r = fake();
      return { kind: 'claim', title: 'Reward delivered to ' + short(r), recipient: r, amount: a + ' wXMR', amt: a + ' wXMR' };
    }),
    { kind: 'burn', title: 'ROOTS buried', amount: '18,400 ROOTS', amt: '18,400 ROOTS' },
    { kind: 'liquidity', title: 'Roots fed · LP burned', amount: '0.0044 wXMR', amt: '0.0044 wXMR', lp: 1 },
  ];
  jobs.forEach((j) => { j.time = now; addFeed(j, true); Burrow.enqueue(j); });
}
$('btn-demo').addEventListener('click', demoCycle);
const SPEEDS = [1, 2, 4];
let speedIdx = 0;
$('btn-speed').addEventListener('click', () => {
  speedIdx = (speedIdx + 1) % SPEEDS.length;
  Burrow.setSpeed(SPEEDS[speedIdx]);
  $('btn-speed').textContent = 'Speed ' + SPEEDS[speedIdx] + '×';
});

// ---------- start ----------
setStatus('', 'Connecting to Solana…');
connectWs();
poll(CONFIG.BACKFILL);
setInterval(() => { if (!wsOpen) poll(10); }, 15000);
refreshBurned();
setInterval(refreshBurned, 120000);
// If nothing real shows up soon, play one demo cycle so visitors see what the mole does.
setTimeout(() => { if (!stats.jobs && !Burrow.busy) demoCycle(); }, 12000);
