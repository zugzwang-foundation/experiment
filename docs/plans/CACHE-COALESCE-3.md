# CACHE-COALESCE-3 — the version poll stops needing a database connection

**Status:** APPROVED 2026-09-23 (founder: "ok do 1"). Executed tests-first.
**Parent:** CACHE-COALESCE-1 (#570, ADR-0051 P1) and CACHE-COALESCE-2 (#571, P2).
**Trigger:** load-test R-18 / issue I-20 (`loadtest/zugzwang-loadtest-report.csv`).
**Area:** ordinary work — a read-only public route and the shared cache store. No §1 area is
touched: no write path, no moderation code, no schema. `@code-reviewer` still runs.

## 1 · What was measured

R-18 (burst 0 → 5,000 readers in 30 s, prod, canary `b3bed60`) failed 10.7 % of requests, all
`GET /m/[slug]/version` → 500. The Vercel log export for the burst (1,000 rows, 18:22:04–18:22:17
UTC) carries one cause on every row:

```
(EMAXCONN) max client connections reached, limit: 200
```

That is Supavisor refusing a new CLIENT connection, not Postgres: the database had 27 backends
and 9 active at the peak. The cap is the Micro compute tier's 200 pooler clients; the burst
spawned more than ~100 function instances at `max: 2` connections each.

Three things follow from the log, and they shape the fix:

1. **The version route is its own Vercel function** (Observability lists `/m/[slug]/version`
   separately), so its instances hold pooler slots of their own and compete with the page's
   instances for the same 200.
2. **It is the highest-volume route** — ~19,000 calls in 12 h against six markets, every open tab
   polling every 30 s — and every edge MISS runs two queries (slug lookup, then pool + moderation
   count). All 1,000 logged failures were edge MISSes.
3. **A version 500 costs the reader one skipped refresh** (`DebatePoll` treats `!res.ok` as "no
   change"). The larger harm is the page: it runs the same slug query uncached, and a query that
   throws inside a streamed page renders `error.tsx` under a status already sent as 200. So the
   page fails the same way and no status code shows it. **10.7 % is a floor, not the rate.**

## 2 · Decision

Serve the version token from the fleet-wide store, so a version poll opens a Postgres connection
only when it is the one instance fleet-wide that re-derives a market's token for the window.

- **Slug → market id.** A new store block `market-id` keyed by slug, holding
  `{ id }` only. The mapping is immutable (slug unique, id fixed, a market never returns to
  Draft), so its window is long (`MARKET_SERIES_MIN_WINDOW_MS`, 60 s; TTL one hour). Only a
  POSITIVE result is written — an unknown slug is never cached, so a request parameter cannot
  mint entries. The key is validated against the slug shape the schema allows, alongside the
  existing UUID check for id-keyed blocks.
- **Market id → token.** A new store block `version-token` keyed by market id, holding the opaque
  token. The render callback is today's derivation unchanged — status, reserves, moderation
  count, FNV hash — so the token means exactly what it means now. Window
  `VERSION_MIN_WINDOW_MS` = **2 s** (new, SPEC.1 §16.1), below the edge's own `s-maxage=5`, so no
  staleness is added that the CDN does not already add. At six markets that is at most three
  database reads a second fleet-wide, however many viewers there are.
- **Fail open, and honestly.** If the render throws and the store holds any previous token for
  the market, return it with 200 and a short `s-maxage` — the poll misses at most one change and
  catches it next tick. If there is no token at all, return **503** with `Cache-Control: no-store`
  and `Retry-After: 5`, never 500. `DebatePoll` already treats both as "no change".
- **Moderation is not touched.** The moderation count is read inside the token render, so a
  removal changes the token within one 2 s window plus the edge's 5 s — the same order the route
  gives today. `markMarketTextRemoved` gains nothing; the token carries no text.

The `/m/[slug]` page, the export routes and the quote route keep calling `getMarketBySlug`
directly. Out of scope on purpose — see §5.

## 3 · Shape

- `src/server/cache/shared-block-store.ts` — `SharedBlock` gains `"market-id"` and
  `"version-token"`; the key guard becomes per block (UUID for id-keyed blocks, slug shape for
  `market-id`). A `readLastSharedBlock` helper returns the entry regardless of age for the
  fail-open path. No change to `coalesceSharedBlock`'s behaviour.
- `src/server/markets/version-token.ts` (new) — `getVersionToken(slug)`: the two coalesced
  lookups, the unchanged token derivation inside the render callback, and the fail-open result
  type `{ kind: "token", token } | { kind: "not-found" } | { kind: "unavailable", lastToken? }`.
- `src/app/(public)/m/[slug]/version/route.ts` — maps the three results to 200 / 404 / 200-stale
  or 503. Response shape `{ v }` unchanged, so no client change.
- `src/server/config/limits.ts` + SPEC.1 §16.1 — `VERSION_MIN_WINDOW_MS`.

## 4 · Tests first

- `tests/server/cache/shared-block-store.test.ts` — slug-keyed block accepts a real slug and
  rejects `../x`, uppercase and over-long input; the UUID guard is unchanged for id-keyed blocks;
  `readLastSharedBlock` returns an entry older than its window.
- `tests/server/markets/version-token.test.ts` (new, Redis faked, DB faked) — token equals
  today's hash for the same inputs; one DB read per market per window under 20 concurrent calls;
  unknown slug → not-found and nothing written; DB error with a previous token → that token;
  DB error with none → unavailable; Redis down → falls back to the direct derivation.
- `tests/server/markets/version-route.test.ts` (new) — the four HTTP outcomes, headers included
  (503 carries `no-store` and `Retry-After`; stale 200 carries the short `s-maxage`).
- `tests/integration/market-version.integration.test.ts` stays green unchanged (CI) — it is the
  guard that the token still moves on a bet, a status change and a removal.

## 5 · What this does NOT fix, stated so the next measurement is read correctly

The page still opens a connection per instance: its live price read and the viewer's session read
are uncached **by ruling** (ADR-0051 rider 1: money on a public surface may not lag a window).
This plan removes the version function's instances from the pooler — the largest request
stream — which frees their slots for the page, but it does not bound the page's own demand. If
the re-run still shows `EMAXCONN` on the page, the next levers are the compute tier (400 clients
on Small) or `max: 1` per instance, both separate decisions.

## 6 · Measurement

The k6 script gains a body check on the page for `data-testid="debate-error"`, counted as a
failure, so the hidden page failures become visible in the next run (the script only; it lives
outside the repo). Re-run R-18 when the Grafana quota allows. Success: zero version 500s, zero
page error bodies, no `EMAXCONN` in the Vercel log for the window.

## 7 · Same commit

ADR-0051 Patch record P3; SPEC.1 §16.1 `VERSION_MIN_WINDOW_MS`; the version route's docblock
updated where it describes its caching layers (O-5 — it currently says two layers).

## 8 · As built (deviations from §3)

- No `readLastSharedBlock` helper: `readSharedBlock` already returns an entry regardless of its
  window (it filters only on expiry and the removal marker), so the fail-open path reuses it.
- Both blocks pass `waitMs: 0`. The first cut kept the default wait; Gate C (H-1) measured
  that a waiter cannot see its holder FAIL, so every 404 and every outage held a request for
  2 s and ~43 Redis commands. The collapse comes from the entry, which exists after the first
  render and serves every caller for its window.
- `market-id` is served for its whole hour (window = TTL), since the mapping is immutable.
- `tests/integration/market-version.integration.test.ts` mocks the store unreachable (Gate C
  H-2), so it exercises the database path deterministically on every runner.
- Instrumentation: `version-token` attempts, `version-token-render` and `market-id-render`
  misses, so the next burst reports a hit rate rather than a bare miss count.
- The token render reads status from `markets` joined to `pools` by id, one statement, instead of
  taking status from the slug lookup — so a lifecycle transition reaches the token within one
  2 s window even though the slug → id mapping is cached for an hour.

