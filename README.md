# $MOLERO

One-page site for $MOLERO on XMR ROOTS, with a live burrow where the mole acts
out the coin's on-chain fee splits, holder payouts, burns and liquidity.

## Deploy on Vercel

1. Import this repository in Vercel (no build step, framework preset "Other").
2. Project → Settings → Environment Variables:
   - `HELIUS_API_KEY`: your Helius key. It is only used by the server function and never reaches the browser.
   - `MOLERO_MINT`: the $MOLERO mint address. While it is empty the site is in pre-launch mode: no RPC calls at all, the burrow shows "Launching soon", and open pages switch to live mode by themselves within ~5 minutes of it being set (plus a redeploy).
   - `MOLERO_PAIR`: `wXMR` (default) or `ROOTS`; must match the pair the coin was launched with (rewards are paid in it).
   - `INDEX_FROM`: the launch day as an ISO date, e.g. `2026-11-10T00:00:00Z`. Every server instance starts the index there, so all visitors get the same burrows.
   - Optional: `CACHE_SECONDS` (default 20) and `PERSIST_MINUTES` (default 60). Usage is about one RPC round per cache window while anyone is watching; lower `CACHE_SECONDS` after launch for snappier updates.
3. Optional but recommended: Storage → create a Blob store and connect it to the project.
   This keeps the index (burrow order, counters) across cold starts. Vercel adds `BLOB_READ_WRITE_TOKEN` automatically.
4. Redeploy after changing variables.

`/api/events` indexes the XMR ROOTS program and gives every visitor the same
timeline: each event has a shared play time and each wallet a fixed burrow.
Responses are cached at the edge for `CACHE_SECONDS`, so Helius usage does not
grow with traffic, and nothing runs while nobody has the page open.

Without the function (any static host), the page reads the chain directly from
the browser and each visitor sees their own copy of the burrow.
