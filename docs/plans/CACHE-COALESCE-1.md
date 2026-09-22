# CACHE-COALESCE-1 — one debate-view render per market per window, fleet-wide

> **Status:** PLAN, awaiting sign-off. No code written.
> **Date:** 2026-09-22 · **Base:** `origin/main` = `22b3998`
> **Closes:** load-test issues I-07 (cache misses), I-17 (burst saturates Postgres), and the
> instance-multiplied half of I-18 (render cost × content). Report: `../loadtest/zugzwang-loadtest-report.csv`.
> **Not critical path** (area: `src/server/debate-view/` read model), but it touches the removal
> masking path, so SC-1 (CLAUDE.md §5.14) applies and the reviewer must check it.

## 1 · What was measured

| Run | Load | Debate-view renders | DB |
|---|---|---|---|
| staging 8608236 | 100 VUs, 5 min, ~1–3 instances | **2–3.5/min per market** (= the 15 s window rate) | 5 backends |
| prod 8602449 | 5,000 VUs ramped, ~100+ instances | **~3,800/min** (≈ 160× the window rate) | 15 backends, page p95 545 ms |
| prod 8604614 | same, with ~500 comments/market | ~3,800/min, each render ~4× dearer | **50/45 backends**, page p95 3.5 s |
| prod 8604548 | 5,000 in 30 s (burst) | all instances cold at once | **49/45**, 46 active, 10.7% timeouts |

`getCachedDebateView` (`src/server/debate-view/cached-view.ts`) is `'use cache'` with
`cacheLife({ stale: 15, revalidate: 15, expire: 60 })`. Next dedupes in-flight renders **within
one instance only**. So the fleet-wide render rate is *instances × markets × 4/min*, and a
burst is *instances × markets* renders in the same second. The cache is working exactly as
written; the design assumed one cache, and Vercel Fluid gives one per instance.

(`recordCacheAttempt` samples 1-in-10 and adds 10, so the counters' *misses > attempts*
anomaly is sampling noise, not a second defect.)

## 2 · Decision to make

Make the render rate independent of the instance count. Two layers:

**L2 — shared entry in Upstash.** `debate-view:<marketId>` holds the serialized
`DebateViewModel` + `renderedAt`. TTL = `SHARED_VIEW_EXPIRE_SEC` (60 s). Fresh if
`now − renderedAt < SHARED_VIEW_MIN_WINDOW_MS` (15 s).

**Single-flight.** When the entry is stale or absent, `SET NX PX 10000` on
`debate-view:lock:<marketId>`. The winner renders (`loadDebateView`) and writes the entry; every
other instance serves the stale entry if one exists, or waits ≤ 2 s polling the entry, or (last
resort, no entry at all) renders itself. Result: **one render per market per 15 s across the
fleet**, and a cold burst costs one render per market, not one per instance.

**L1 stays.** The existing `'use cache'` wrapper remains as the per-instance in-memory layer in
front of L2, so a hot instance never pays the Upstash read on every request.

**Invalidation.** `cacheTag('market:<id>')` already fires from `admin/moderation/act.ts`; the
same call site also clears the L2 entry. Lifecycle transitions change `market.status`, which is
part of the entry (compared on read: a mismatched status is treated as stale). ⚠ SC-1: a removed
comment must disappear from the shared entry within one window; the `DEL` is what guarantees it,
and the test asserts the BODY's absence from the entry after removal.

> **Gate C amendment (2026-09-22, `@code-reviewer`).** The `DEL` alone left two races open — an
> instance re-reading L2 between the `DEL` and the tag, and a render already in flight when the
> removal committed writing the body back. Shipped instead: a `removed` marker stamped **before**
> the `DEL`, which readers and writers both compare against `renderedAt` / render-start; the
> comparison on read is the whole `MarketSummary` JSON, not `status`; the lock is token-owned
> with a compare-and-delete release; the wait is a wall-clock deadline; and `SHARED_VIEW_MAX_BYTES`
> raises an `oversize` flag so an entry Upstash would reject never turns the wait into a tax.
> ADR-0051 P1 riders (2)–(4) carry the reasoning; this plan is left as written above it.

**Not changed:** `SHARED_VIEW_MIN_WINDOW_MS` (15 s, SPEC.1 §16.1 pinned), the `.md` export (still
uncached, ADR-0025), the poster bypass (`readsUncached`, ADR-0051 rider 2), `loadDebateView`
itself (ADR-0034-guarded), the reserve walk (its own cache).

## 3 · Alternatives considered

- **Raise `revalidate` to 60 s.** 4× fewer renders, still ∝ instances; a burst still cold-starts
  every instance. Cheap but does not remove the failure mode. Rejected as the fix, kept as a
  possible follow-on tune.
- **Limit the ranked set / precompute aggregates (I-18).** Makes each render cheaper; does not
  change how many renders happen. Separate task after this one.
- **Supabase tier up.** A buffer, not a fix. Recommended in parallel by the operator.

## 4 · Files

- `src/server/debate-view/cached-view.ts` — L2 read/lock/write around `loadDebateView` (new
  helper `src/server/debate-view/shared-view-store.ts`, so the `'use cache'` wrapper stays small).
- `src/server/admin/moderation/act.ts` — `DEL` beside the existing `cacheTag` fire.
- `src/server/config/limits.ts` — `SHARED_VIEW_LOCK_MS = 10_000`, `SHARED_VIEW_WAIT_MS = 2_000`
  (registered in SPEC.1 §16.1 by the same commit).
- Tests first (`@test-writer`): `tests/server/debate-view/shared-view-store.test.ts` — fresh
  hit, stale serve + single renderer under N concurrent calls (Redis mocked, lock semantics
  real), no-entry wait, removal DEL, status mismatch; SC-1 body-absence assertion.
- ADR-0051 Patch record (same commit): "one cache" assumption corrected; single-flight added.

## 5 · Risks

- Entry size: `DebateViewModel` with ~500 comments is large; measure in phase 1 (expected
  0.3–1 MB JSON). Upstash paid limit is fine; free-tier 1 MB is a hard edge — if over, store
  compressed or cap the ranked set first (I-18).
- Lock holder dies: `PX 10000` expires the lock; losers already serve stale. Bounded.
- Upstash outage: fail open to the current behaviour (render locally), never fail the page.

## 6 · Verification

`just verify`, the new tests, then on staging: re-run 8608236's profile (renders/min must stay
≤ 4/min/market) and a burst (0 → 2,000 in 30 s) with the staging DB sampler; then prod burst
(R-12 repeat) and the 5k ramp (R-13 repeat). Pass = DB backends < 20 at 5,000 readers, 0
timeouts in the burst.
