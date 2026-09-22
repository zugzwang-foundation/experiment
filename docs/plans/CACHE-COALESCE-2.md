# CACHE-COALESCE-2 — the Discovery blocks join the fleet-wide single-flight

**Status:** APPROVED 2026-09-23 (founder: "ok do"). Executing tests-first.
**Parent:** `docs/plans/CACHE-COALESCE-1.md` (#570, merged 2026-09-22 as `f392d35`), ADR-0051 P1.
**Trigger:** load-test R-16 / issue I-19 (`loadtest/zugzwang-loadtest-report.csv`).

## 1 · What R-16 measured

The burst repeat (0 → 5,000 readers in 30 s, prod, canary `f392d35`) against the R-12 baseline:

| | R-12 (before #570) | R-16 (after #570) |
|---|---|---|
| debate page p95 | 11.7 s | **5.9 s** |
| home p95 | 29.6 s | 25.5 s |
| failures | 10.7 % | 18.8 % |
| DB backends / active at peak | 49 / 46 | 49 / 40 |

Cache counters over the run (Upstash deltas, all six markets):

| counter | delta | meaning |
|---|---|---|
| `debate-view:misses` | 2,995 | per-instance L1 misses |
| **`debate-view-render:misses`** | **56** | renders the DATABASE paid — the single-flight collapsed 98 % |
| `reserve-walk:misses` | 4,226 | every one a `replayReserveSeries` events scan against Postgres |
| `market-data:misses` | 1,674 | every one `getMarketTotals` + hero ranking + media against Postgres |

#570 did what it scoped. The burst still saturates because the **home page** reads two more
`'use cache'` blocks per market — `getCachedReserveWalk` (price series; 60 s window) and
`getCachedMarketDiscoveryData` (totals, hero, media; 15 s window) — and each is still
deduped per instance only. A burst cold-starts every instance, and each instance's first
home render derives 6 markets × 2 blocks against the database. That is I-17's other half.

## 2 · Decision

Apply the CACHE-COALESCE-1 mechanism, unchanged, to both blocks: one Upstash entry per
(block, market), one `SET NX PX` lock in front of the derivation, stale-serve for losers with
an entry, bounded wall-clock wait for losers without one, fail-open on every Redis error,
oversize flag, and the removal marker for the block that carries bodies.

- **`getCachedReserveWalk`** — entry is `WireReservePoint[]`, no bodies, no viewer scope.
  Window `MARKET_SERIES_MIN_WINDOW_MS` (60 s), TTL the block's own `EXPIRE_SEC`. No removal
  marker needed (nothing masked lives in a reserve walk). This is the heavier of the two: the
  events replay is the query R-16's sampler ranked first.
- **`getCachedMarketDiscoveryData`** — entry carries the hero post (title/teaser/author), so
  it is SC-1 territory exactly like the debate view: `moderateComment`'s remove path stamps
  the same `removed` marker and deletes this entry too. Window `SHARED_VIEW_MIN_WINDOW_MS`,
  TTL `SHARED_VIEW_EXPIRE_SEC`. The hero's `currentValue` stays computed outside the cache
  (ADR-0051 rider 1) — unchanged.

`getCachedDiscoveryPricing` (5 s window, one batched query, no tag) is **out of scope**: it
is one round trip for all six markets and did not appear in the sampler.

## 3 · Shape

Generalise `shared-view-store.ts` into a store keyed by `(block, marketId)` rather than
minting two copies: `coalesce<T>({ block, marketId, summary, windowMs, expireMs, render })`.
The debate-view call site becomes the first consumer of the generic form; behaviour and tests
for it are unchanged (the 21 existing store tests stay green as the regression gate). Two new
consumers, two new call-site tests, one contract-scan extension so the viewer-scope scan
covers the new store surface.

Constants: reuse the existing windows/expires; no new SPEC.1 §16.1 rows unless a per-block
lock or wait bound is needed (default: the same `SHARED_VIEW_LOCK_MS` / `SHARED_VIEW_WAIT_MS`).

> **Gate C amendment (2026-09-23).** The wait is NOT reused for the Discovery blocks: it is a
> bound per block and the home page reads sixteen blocks in series, so both pass `waitMs: 0`.
> ADR-0051 P2 riders (5)–(9) carry the rest of what review changed.

## 4 · Files

- `src/server/debate-view/shared-view-store.ts` → generic `(block, marketId)` store (rename
  considered: `src/server/cache/shared-block-store.ts`; decide at plan sign-off).
- `src/server/discovery/cached-series.ts` — wrap `replayReserveSeries` in the coalescer.
- `src/server/discovery/list.ts` — wrap the `getCachedMarketDiscoveryData` body.
- `src/server/admin/moderation/act.ts` — removal also marks the market-data block. *(Shipped as `markMarketTextRemoved` in the cache module, iterating `TEXT_CARRYING_BLOCKS` with `Promise.allSettled`; `act.ts` calls that instead of the debate-view helper.)*
- Tests first: store generalisation (existing 21 + block-key isolation), two call-site tests,
  `cached-view-contract.test.ts` scan extension.
- ADR-0051 Patch record P2 (same commit); SPEC.1 §16.1 only if a constant is added.

## 5 · Expected effect and how it is measured

Re-run R-16 (burst) and R-13 (ramp). Success = `reserve-walk` and `market-data` DB derivations
collapse the way `debate-view-render` did (tens per run, not thousands), DB backends stay
under the 45 pool at the burst peak, and home p95 falls under the 1 s threshold at 5,000.

## 6 · Risks

- Upstash round trips on the home path: 6 markets × 2 blocks × 1 read per instance-miss. Each
  is ~1–3 ms from `bom1`; the L1 still absorbs steady-state hits, so this is paid on instance
  cold start only.
- The reserve-walk entry can be large on a busy market (one point per bet). Same 900 KB guard
  and oversize flag as CC-1; over the bound the block renders locally as today.
- Not a fix for I-18 (render cost scaling with comment count): it bounds HOW OFTEN the
  ranking query runs, not how expensive one run is. I-18's own fix (ranked-set limit /
  precompute) stays queued.
