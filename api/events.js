// GET /api/events
//
// Indexes the XMR ROOTS program on Solana and serves one shared timeline, so
// every visitor sees the mole do the same job at the same moment:
//  - each event gets a play time (playAt) and a duration on a common clock
//  - each holder wallet gets a fixed burrow slot (first payment order)
//  - budget counters (coin pile, burn crate) are carried on every event
// The response is cached at the edge for a few seconds, so the RPC is hit about
// once per cache window no matter how many people are watching.
//
// Environment (Vercel project settings):
//   HELIUS_API_KEY        required, kept server side
//   MOLERO_MINT           the $MOLERO mint; empty = watch every XMR ROOTS coin
//   MOLERO_PAIR           wXMR (default) or ROOTS
//   BLOB_READ_WRITE_TOKEN optional; set automatically when a Vercel Blob store
//                         is connected, keeps the index across cold starts
//   SOLANA_RPC_URL        optional RPC override (testing / other providers)
//   INDEX_FROM            optional ISO date the index starts at (e.g. the launch day);
//                         default: midnight UTC of the previous day
//   MAX_BACKFILL          optional cap on transactions read on a first build (5000)

const PROGRAM = '9RSfkTWckTiuCQTae86bgqZWumcLcj4fzDLxi9qNoVeM';
const WXMR = 'WXMRyRZhsa19ety5erZhHg4N3xj3EVN92u94422teJp';
const ROOTS = '4PbxcLPioEQNQT8jCdTnvfM2CddTzHrDStnxniRypump';

const STATE_VERSION = 2;
const BLOB_PATH = 'molero/state.json';
const KEEP_EVENTS = 400;      // events kept in state
const SEND_EVENTS = 160;      // events sent to the browser
const SLOTS = 240;            // holder burrows (40 levels of 6)
const DELAY = 8000;           // ms between the block time and playback, so every cache window has it
const PERSIST_EVERY = 10 * 60 * 1000;
const BUDGET_MS = 30000;      // indexing time per request, well inside maxDuration
// how long each job takes at normal pace; the scene fits its animation into this
const BASE_MS = { settle: 20000, epoch: 5000, claim: 9000, claimNew: 12500, burn: 7500, liquidity: 9000, other: 3000 };

export const config = { maxDuration: 60 };

const env = (k, d = '') => (process.env[k] || d).trim();
const MINT = env('MOLERO_MINT');
const PAIR = env('MOLERO_PAIR', 'wXMR') === 'ROOTS' ? 'ROOTS' : 'wXMR';
const RPC = env('SOLANA_RPC_URL') || (env('HELIUS_API_KEY') ? `https://mainnet.helius-rpc.com/?api-key=${env('HELIUS_API_KEY')}` : '');
const MAX_BACKFILL = +env('MAX_BACKFILL', '5000') || 5000;
// every instance starts the index at the same moment, so all of them agree
// on burrow order and timing even before a shared Blob state exists
const INDEX_FROM = Date.parse(env('INDEX_FROM')) || (Math.floor(Date.now() / 86400000) - 1) * 86400000;

// ---------- RPC ----------
// Paced to stay under the provider's request rate (Helius free plan: ~10/s);
// a JSON-RPC batch of n calls counts as n requests.
const RPS = +env('RPC_RPS', '8') || 8;
let nextSlot = 0;
async function pace(n) {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + (n * 1000) / RPS;
  if (at > now) await sleep(at - now);
}
let rpcId = 0;
async function post(body, n) {
  for (let i = 0; i < 4; i++) {
    await pace(n);
    const res = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 429) { await sleep(1000 * (i + 1)); continue; }
    if (!res.ok) throw new Error('rpc http ' + res.status);
    return res.json();
  }
  throw new Error('rate limited');
}
async function rpc(method, params) {
  const j = await post({ jsonrpc: '2.0', id: ++rpcId, method, params }, 1);
  if (j.error) throw new Error(method + ': ' + j.error.message);
  return j.result;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch transactions in small paced batches; single calls if batching is refused.
const TX_PARAMS = { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' };
let batching = true;
async function getTransactions(sigs) {
  const out = new Map();
  if (batching) {
    try {
      const arr = await post(sigs.map((s, k) => ({ jsonrpc: '2.0', id: k, method: 'getTransaction', params: [s, TX_PARAMS] })), sigs.length);
      if (Array.isArray(arr)) { for (const r of arr) if (r && r.result) out.set(sigs[r.id], r.result); }
      else batching = false;
    } catch (e) { if (!/rate limited/.test(e.message)) batching = false; else throw e; }
  }
  for (const s of sigs) {
    if (out.has(s)) continue;
    try { const t = await rpc('getTransaction', [s, TX_PARAMS]); if (t) out.set(s, t); } catch {}
  }
  return out;
}

// New signatures of the program since `until`, oldest first.
async function newSignatures(until, max, fromMs) {
  const all = [];
  let before;
  while (all.length < max) {
    const opts = { limit: 1000, commitment: 'confirmed' };
    if (until) opts.until = until;
    if (before) opts.before = before;
    const page = await rpc('getSignaturesForAddress', [PROGRAM, opts]);
    if (!page || !page.length) break;
    all.push(...page);
    if (page.length < 1000) break;
    if (fromMs && page[page.length - 1].blockTime * 1000 < fromMs) break;
    before = page[page.length - 1].signature;
  }
  return all.slice(0, max).filter((s) => !s.err && (!fromMs || s.blockTime * 1000 >= fromMs)).reverse();
}

// ---------- parsing ----------
function parseHR(logs) {
  const out = [];
  for (const line of logs || []) {
    const m = line.match(/HR:(\w+)\s*(.*)$/);
    if (!m) continue;
    const f = {};
    for (const kv of m[2].split(/\s+/)) { const i = kv.indexOf('='); if (i > 0) f[kv.slice(0, i)] = kv.slice(i + 1); }
    out.push({ type: m[1], f });
  }
  return out;
}

function kindOf(type) {
  if (type === 'settled') return 'settle';
  if (type === 'reward_epoch') return 'epoch';
  if (/claim|payout/.test(type)) return 'claim';
  if (type === 'liquidity') return 'liquidity';
  if (/burn|buyback/.test(type)) return 'burn';
  return 'other';
}

// ---------- state ----------
function freshState() {
  return {
    v: STATE_VERSION, mint: MINT, cursor: null, backlog: [], from: INDEX_FROM, seq: 0, events: [],
    slots: [], holders: {}, nextHolder: 0, pairs: {}, coinAccount: '',
    counters: { pile: 9, stash: 0 }, totals: { jobs: 0, rewards: {}, holders: 0 }, lastEnd: 0,
  };
}

function learn(st, tx, events) {
  const post = tx.meta.postTokenBalances || [], pre = tx.meta.preTokenBalances || [];
  const mints = new Set(post.map((b) => b.mint));
  for (const e of events) {
    const coin = e.f.mint || e.f.source;
    if (!coin) continue;
    if (e.f.quote_mint) st.pairs[coin] = e.f.quote_mint === ROOTS ? 'ROOTS' : 'wXMR';
    if (e.type === 'roots_budget_burn') st.pairs[coin] = st.pairs[coin] || 'ROOTS';
    if (e.type === 'settled') {
      // the pair-asset account that grows in a settlement is the coin's vault
      for (const b of post) {
        if (b.mint !== WXMR && b.mint !== ROOTS) continue;
        const p = pre.find((x) => x.accountIndex === b.accountIndex);
        if (+b.uiTokenAmount.amount > +(p ? p.uiTokenAmount.amount : 0)) {
          st.pairs[coin] = b.mint === WXMR ? 'wXMR' : 'ROOTS';
          if (coin === st.mint && !st.coinAccount) st.coinAccount = b.owner;
        }
      }
    } else if (!st.pairs[coin]) {
      if (mints.has(WXMR) && !mints.has(ROOTS)) st.pairs[coin] = 'wXMR';
      if (mints.has(ROOTS) && !mints.has(WXMR)) st.pairs[coin] = 'ROOTS';
    }
  }
}

function ours(st, e) {
  if (!st.mint) return true;
  if (e.type === 'reward_epoch') return !!st.coinAccount && e.f.coin === st.coinAccount;
  return e.f.mint === st.mint || e.f.source === st.mint;
}

// a holder keeps its burrow until a newer holder takes over that slot
function slotFor(st, addr) {
  const h = st.holders[addr];
  if (h && st.slots[h.slot] && st.slots[h.slot].a === addr) return { slot: h.slot, isNew: false };
  const slot = st.nextHolder % SLOTS;
  st.nextHolder++;
  if (st.slots[slot]) delete st.holders[st.slots[slot].a];
  st.slots[slot] = { a: addr, n: 0, last: '0' };
  st.holders[addr] = { slot };
  st.totals.holders++;
  return { slot, isNew: true };
}

function addEvent(st, sig, time, e, k) {
  const coin = e.f.mint || e.f.source || e.f.coin || '';
  const kind = kindOf(e.type);
  const ev = { id: sig + ':' + k, seq: ++st.seq, sig, time, type: e.type, f: e.f, coin, pair: st.mint ? PAIR : (st.pairs[coin] || null) };
  let base = BASE_MS[kind] || BASE_MS.other;

  if (kind === 'settle') {
    st.counters.pile = Math.min(24, st.counters.pile + 3);
    st.counters.stash++;
  } else if (kind === 'claim' && e.f.recipient) {
    const { slot, isNew } = slotFor(st, e.f.recipient);
    const s = st.slots[slot];
    s.n++; s.last = e.f.quote || e.f.amount || '0'; s.p = ev.pair;
    ev.slot = slot; ev.n = s.n; ev.isNew = isNew;
    if (isNew) base = BASE_MS.claimNew;
    st.counters.pile = Math.max(3, st.counters.pile - 1);
    if (ev.pair) st.totals.rewards[ev.pair] = (st.totals.rewards[ev.pair] || 0) + Number(s.last);
  } else if (kind === 'burn') {
    st.counters.stash = Math.max(0, st.counters.stash - 1);
  }
  ev.after = { pile: st.counters.pile, stash: st.counters.stash };

  // shared schedule: play after the block time, never overlapping the previous job;
  // a backlog speeds the mole up so the timeline catches up with the chain
  // block time, but never later than when we saw it: a skewed clock can't push playback out
  const due = Math.min(time * 1000, Date.now()) + DELAY;
  const start = Math.max(due, st.lastEnd);
  const lag = start - due;
  const speed = Math.min(6, 1 + lag / 20000);
  ev.playAt = start;
  ev.dur = Math.round(base / speed);
  ev.speed = +speed.toFixed(2);
  st.lastEnd = start + ev.dur;
  st.totals.jobs++;
  st.events.push(ev);
}

// Index in steps: new signatures join a backlog that is worked off oldest first
// within a time budget, so no request runs into the function timeout and a long
// first build simply continues on the next requests.
async function update(st, budgetMs) {
  const until = Date.now() + budgetMs;
  const fresh = await newSignatures(st.cursor, st.cursor ? 5000 : MAX_BACKFILL, st.cursor ? 0 : st.from);
  if (fresh.length) {
    st.cursor = fresh[fresh.length - 1].signature;
    for (const s of fresh) st.backlog.push([s.signature, s.blockTime]);
  }
  let changed = fresh.length > 0;
  while (st.backlog.length && Date.now() < until) {
    const chunk = st.backlog.slice(0, 8);
    const txs = await getTransactions(chunk.map((c) => c[0]));
    for (const [sig, bt] of chunk) {
      const tx = txs.get(sig);
      if (!tx || tx.meta.err) continue;
      const evs = parseHR(tx.meta.logMessages);
      if (!evs.length) continue;
      learn(st, tx, evs);
      evs.forEach((e, k) => { if (ours(st, e)) addEvent(st, sig, tx.blockTime || bt, e, k); });
    }
    st.backlog.splice(0, chunk.length);
    changed = true;
  }
  if (st.events.length > KEEP_EVENTS) st.events = st.events.slice(-KEEP_EVENTS);
  return changed;
}

// ---------- persistence (optional Vercel Blob) ----------
async function blob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try { return await import('@vercel/blob'); } catch { return null; }
}
async function loadState() {
  const b = await blob();
  if (!b) return null;
  try {
    const meta = await b.head(BLOB_PATH);
    const r = await fetch(meta.url + '?t=' + Date.now(), { cache: 'no-store' });
    const st = await r.json();
    return st && st.v === STATE_VERSION && st.mint === MINT && (!env('INDEX_FROM') || st.from === INDEX_FROM) ? st : null;
  } catch { return null; }
}
async function saveState(st) {
  const b = await blob();
  if (!b) return;
  try {
    await b.put(BLOB_PATH, JSON.stringify(st), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 });
  } catch (e) { console.error('blob save failed', e.message); }
}

// warm instances keep the index in memory between requests
let memo = null, savedAt = 0, inflight = null;
async function current() {
  if (!memo) memo = (await loadState()) || freshState();
  const wasBuilding = memo.backlog.length > 0;
  const changed = await update(memo, BUDGET_MS);
  // save often while the first build is under way, then every few minutes
  const interval = wasBuilding ? 0 : PERSIST_EVERY;
  if (changed && Date.now() - savedAt > interval) { savedAt = Date.now(); await saveState(memo); }
  return memo;
}

export default async function handler(req, res) {
  if (!RPC) {
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ error: 'HELIUS_API_KEY is not set' }));
  }
  try {
    inflight = inflight || current().finally(() => { inflight = null; });
    const st = await inflight;
    const body = {
      now: Date.now(), mint: st.mint, pair: PAIR, head: st.seq,
      events: st.events.slice(-SEND_EVENTS),
      slots: st.slots.map((s, i) => (s ? [i, s.a, s.n, s.last, s.p || null] : null)).filter(Boolean),
      counters: st.counters, totals: st.totals, pairs: st.pairs, indexing: st.backlog.length,
    };
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    // one RPC round per cache window, whatever the traffic
    res.setHeader('cache-control', 'public, s-maxage=4, stale-while-revalidate=20');
    res.end(JSON.stringify(body));
  } catch (e) {
    console.error(e);
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'indexer failed' }));
  }
}
