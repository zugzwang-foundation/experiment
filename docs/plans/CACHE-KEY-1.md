# CACHE-KEY-1 — stop the shared read caches being busted by activity

**Date:** 2026-09-12 · **Branch:** `load_testing_ultra` → `main` · **ADR:** 0051
**Origin:** the load-testing programme's highest-value unfixed finding (2026-09-01 → 2026-09-12).

---

## 1. The problem

Two `'use cache'` blocks keyed on `reserves`. A cached function's key is its serialised argument
list, so **every bet changed the key and forced a full miss for every reader of that market**. The
caches worked on quiet markets and stopped working entirely on the market everyone was betting on —
SPEC.1 §9 *Refresh*'s named failure: invalidation coupled to activity performs worst exactly when
load is highest.

`getCachedReserveWalk` (`src/server/discovery/cached-series.ts`) already keyed on `marketId` alone
with a window, and its docblock named these two blocks as the counter-example. This task makes the
two consistent with the one that was already right. It is not a new design.

| Function | Was | Is |
|---|---|---|
| `getCachedDebateView` | `(market, reserves)`, `cacheLife("minutes")` | `(market)`, windowed |
| `getCachedMarketDiscoveryData` | `(marketId, reserves)`, `cacheLife("minutes")` | `(marketId)`, windowed |
| `getCachedReserveWalk` | `marketId`, windowed | unchanged — the model |

## 2. Founder rulings taken this session

1. **Window = 15 s**, minted as its own constant (`SHARED_VIEW_MIN_WINDOW_MS`).
2. **Poster visibility = a page-level freshness bypass**, not the client-side optimistic render the
   task brief ranked first — `src/components/debate/find-posted.ts` is an entire file arguing that a
   card must be *found*, never reconstructed (`ordinal`, `badge` and `entryPrice` are all wrong from
   the receipt, and no jsdom test here could catch it).
3. **`currentValue` is computed live at the page**, not cached and not dropped.
4. **The blocking cache instrumentation is fixed with `after()`** — found while establishing the
   baseline, see §5.

## 3. What was built

- **`limits.ts`** — `SHARED_VIEW_MIN_WINDOW_MS = 15000` and the derived `SHARED_VIEW_EXPIRE_SEC`
  (60 s, pinned to `MARKET_SERIES_MIN_WINDOW_MS`, deliberately not the sibling's `window × 60`).
- **`cached-view.ts` / `list.ts`** — `reserves` dropped from both signatures and keys;
  `cacheTag(\`market:${id}\`)` retained on both.
- **`hero.ts` → `hero-value.ts`** — `selectHeroTopPosts(client, marketId)` returns
  `{ posts: HeroTopPostsBase, shares }`, where `HeroPostBase = Omit<HeroPost, "currentValue">`;
  `(public)/page.tsx` composes the figure from the live batched reserves it already holds. The
  `Omit` is the enforcement: skipping the step is a compile error, where a `currentValue: null`
  passthrough would have silently deleted a founder-ruled figure.
- **`viewer-freshness.ts`** — one indexed `created_at` read; `/m/[slug]` **and**
  `/m/[slug]/export/image` read uncached for a viewer who posted inside the window.
- **`cache-metrics.ts`** — every counter runs under `next/server`'s `after()` and returns `void`.

## 4. Corrections to the task brief, measured

- Repo is `/Users/adityagour/Documents/experiment`; `~/zugzwang/experiment` does not exist. The
  remote is `origin`, not `company`.
- ⛔ **A local Postgres WAS available** (127.0.0.1:54322). The brief's "the previous session could
  not run the DB-backed suites" was an environment claim that no longer held; the gap was four
  unapplied migrations, closed with the CI `pg_cron` strip applied to a `/tmp` copy (the committed
  migrations were never edited).
- ⚠ **The ADR ceiling read `0048` on this branch and `0050` on `origin/main`** — the branch was 21
  commits behind. Read from the merged head (O-2). Next free was **0051**.
- The brief named **two** callers of `getCachedDebateView`. There are **three**: `main` had landed
  `m/[slug]/export/image/route.ts` (ADR-0050) in the interval.

## 5. Findings, and what was done about each

**F-1 · The instrumentation was blocking, and it falsified this PR's own claim.** `recordCacheAttempt`
was an `await`ed Upstash round trip on the render path, once per market inside `DiscoveryContent`'s
loop — **nine serial network hops per Discovery render** at `DISCOVERY_GRID_SIZE = 8`, plus one per
poll tick per open tab. Measured: **~135 ms per round trip**, ~1.2 s against a p50 of 0.692 s.
Fail-open, but not non-blocking. → Fixed with `after()`; signatures returned to `void` so a caller
cannot `await` one by reflex (**O-1**).

**F-2 · Two guards were red on the branch before this task touched anything**, both from the same
unfinished T-03 batching change, both passing on `origin/main`:
- `live-tail-wiring.test.ts` pinned `getMarketPricingAndReserves(db,` after the page had moved to
  the batched form — so the guard proving the chart's terminal comes from a *live* read was
  unavailable for the whole of that work.
- `round-trip-budget.test.ts` moved its assertion `1+11N → 2+10N` but left the singular per-market
  read in its own replication, measuring 23 against an expected 22. A replication that had stopped
  replicating. → Both repaired.

**F-3 · `page-wiring.test.ts` timed out** at 10 s — real network IO via F-1's counters. → Mocked at
the module boundary; it stays mocked regardless, because a read-model wiring suite must not depend
on a third party being reachable.

**F-4 · The image-export route needed the bypass too.** Without it an author who can *see* their
card (page bypassed) gets a 404 downloading it: `resolvePostParam` resolves from the database, then
`composePostExport` fails to find the id in a cached model minted before the post existed.

## 6. Guards — re-pinned, never bypassed

| File | What moved |
|---|---|
| `cached-view-contract.test.ts` | signature, `cacheLife`, page call shape; **+6 new** for the bypass and the SC-1 no-body property |
| `discovery/round-trip-budget.test.ts` | `cacheLife` split (listing keeps `"minutes"`, per-market is windowed), hero canary inverted, `composeDiscovery` batch; `2 + 10N` **unchanged** |
| `debate-view/round-trip-budget.test.ts` | prose only — the 12 / 9 / 3 counts do not move |
| `reserves-server-only.test.ts` | call shape; **+1 new** holding `heroShares` off the client boundary |
| `page-states.test.tsx` | the `(id, reserves)` call assertions → `(id)`; the absence *is* the assertion |
| `cached-series-contract.test.ts` | prose; the bet-path no-tag tripwire **already existed** and now guards three windows |
| `hero.test.ts` | one test-local adapter composing both halves — **not one assertion moved**, which is what a masking-critical suite is owed |
| `cache-metrics.test.ts` | rewritten for `void` + `after()`; **+3 new**, incl. the no-request-scope fallback |

## 7. Verification

`ZUGZWANG_ENV=preview just verify` green. Full `vitest run` green apart from one pre-existing
failure that also fails on `origin/main` — see §8.

⚠ **`'use cache'` is inert under a bare `vitest run`**, so no test here observes a real hit. Every
cache assertion is structural; the hit-rate claim rests on the by-hand check and on the branch's own
`recordCacheAttempt` / `recordCacheMiss` counters, which are retained.

## 8. Out of scope — raised, not absorbed (§5.4)

- **`tests/db/liquidity-k-named-door.spec.ts` fails on `origin/main` too** — a path-normalisation
  issue (`SRC` replacement leaves a leading `/`), environment-dependent, unrelated to this change.
  Not fixed here.
- Re-siting the events↔`pools` drift check CHART-1 removed (`list.ts` carries the note).
- The branch's two commit subjects are the literal string `latest`, carrying no `Instructions for
  AI` block (§5.13.1). Under squash-merge the landing message is composed at merge time, so this is
  raised rather than fixed by rewriting history.
- P1 (connection bottleneck), P2.2 (per-IP write ceiling), P5 (soak) — named in the PR as open.
