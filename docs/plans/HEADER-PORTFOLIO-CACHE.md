# Cache the header PORTFOLIO figure (Latency Register row 3)

## Context

The Latency Register (2026-08-21) flags one real, still-open home-page cache gap: `getHeaderPortfolio` (`src/server/dharma/header-portfolio.ts`) sums `computeSell` over every open holding, live, on **every** render of every `(public)` route — including `/` — and re-fires every 15s per open tab via `DebatePoll`'s `router.refresh()`. Discovery's own caching (S-4 Phase C) is already done and out of scope here.

This is not a green-field decision — the layout already carries a prior, measured ruling on this exact cost (**R12**, landed 2026-08-03, `docs/plans/HEADER-PORTFOLIO.md`): "accept +3 statements × 4 routes, uncached... an order of magnitude below the feared N+1." R12 is correct on its own terms (per-render cost is cheap) but explicitly punts the *aggregate* cost — multiple tabs, multiple routes, 100k concurrent users — to a later sizing pass ("HARDEN.6... must count these two"). That pass is what ADR-0038 (100k-user scale target) now makes concrete. This task is that follow-through, not a reversal of R12.

**Goal:** cut redundant DB load from this read without weakening the two things R12/R6/R7 already protect: the byte-identity contract with `profile/positions.ts`, and the balance-first/cursor-second ordering against `header-balance.ts`.

## Why not Next.js `'use cache'` (the Discovery mechanism)

Checked first, since it's the established pattern (`getCachedDiscoveryMarketIds`, `getCachedMarketDiscoveryData`, `getCachedReserveWalk`, `getCachedDebateView`). Rejected: `getCachedDebateView` (`src/server/debate-view/cached-view.ts:65-72`) carries an explicit, deliberate prohibition — **"NOTHING VIEWER-SCOPED MAY ENTER THIS FUNCTION... a viewer-scoped input would leak one participant's balance/position/bookmarks to the next."** Every existing `'use cache'` function in this repo is keyed on market-scoped or global arguments only; none takes a `userId`. Portfolio is exactly the viewer-scoped, money-adjacent case that rule exists to keep out. Introducing the first `userId`-keyed `'use cache'` function would be going against a standing guardrail set by a previous security pass, for a display-only optimization — not worth the risk class.

**Chosen instead: Upstash Redis, cache-aside**, the same infra already backing rate-limit/idempotency/moderation locks in this repo, keyed via the existing `getRedisKey()` convention (env-scoped, so prod/staging/preview can never collide).

## Design

**Fully additive — `getHeaderPortfolio` itself is not touched.** Same posture S-4 took with `listOpenMarkets` ("UNCHANGED and untouched... this is a NEW, additive read"). This keeps the locked identity test (`tests/integration/header-portfolio.integration.test.ts`) exercising the exact same uncached function it always has — zero risk to it.

- **New function** `getHeaderPortfolioCached(client, userId)` in `src/server/dharma/header-portfolio.ts`:
  1. `redis.get(getRedisKey("cache", "header-portfolio", userId))` — on a hit, return the raw string directly (no JSON needed; the client's `automaticDeserialization: false` already returns raw strings, and the cached value here *is* a plain decimal string).
  2. On a miss (or any Redis read error — fail open, fall through), call the **untouched** `getHeaderPortfolio(client, userId)`.
  3. **Never cache a failure** — same rule R2-MEMO already established (`read-url-memo.ts`: "a throwing mint stores nothing"). Only `redis.set(..., { ex: TTL })` when the result is a non-`null` string. A `null` (the function's documented failure signal) is returned as-is, uncached, so the next call retries live rather than serving 15s of "Portfolio unavailable."
  4. Any Redis *write* error is swallowed (captured via `safeCaptureException`, not thrown) — a cache-write failure must never surface to the caller.
- **New constant** `HEADER_PORTFOLIO_CACHE_TTL_SECONDS = 15` in `src/server/config/limits.ts` — matches `POLL_INTERVAL_MS_DEBATE_VIEW`'s existing 15s cadence, which is already this product's accepted freshness bar.
- **One call-site change**: `src/app/(public)/layout.tsx` swaps `getHeaderPortfolio(db, session.user.id)` → `getHeaderPortfolioCached(db, session.user.id)` inside the existing `Promise.all`. Nothing else in the layout changes — `header-balance.ts` and the balance-first/cursor-second ordering are untouched.

## Explicit tradeoff — flagging, not hiding (R2-MEMO's "deliberately not done" convention)

**No bet-path invalidation hook.** The commit boundary for bets lives in the route handlers (`src/app/api/bets/{place,sell}/route.ts`), not inside `src/server/bets/` itself (confirmed: `place.ts`/`sell.ts` are transaction *callbacks*, not the transaction owner) — so a hook is technically possible there without touching `src/server/bets/`.

**Chose not to**, for three reasons: (1) the Latency Register's own row-3 verdict says "CACHE (per-request dedupe + short TTL)" — not "invalidate on bet," unlike rows 4/5 which explicitly say the latter; (2) `cached-series.ts` carries an explicit comment that bets deliberately fire no invalidation tag, by design, to avoid per-bet recomputation; (3) it keeps this change contained to one critical-path directory (`dharma/`) instead of two.

**Consequence:** after placing or selling, a viewer's own header portfolio figure can lag up to 15s before reflecting their own trade — bounded by the same TTL, self-healing on the next poll tick.

## Files touched

| File | Change |
|---|---|
| `src/server/dharma/header-portfolio.ts` | Add `getHeaderPortfolioCached` (additive; `getHeaderPortfolio` untouched) |
| `src/server/config/limits.ts` | Add `HEADER_PORTFOLIO_CACHE_TTL_SECONDS = 15` |
| `src/app/(public)/layout.tsx` | Swap the one call site inside the existing `Promise.all` |
| `tests/server/dharma/header-portfolio-cache.test.ts` (new) | Cache hit / miss / never-caches-`null` / per-user discrimination / Redis-error-fails-open — mirrors `read-url-memo.test.ts`'s positive-control shape and reuses `header-portfolio.test.ts`'s `recordingClient` idiom |

## Verification

1. `just verify` (typecheck → biome → build) with `ZUGZWANG_ENV=preview`.
2. New unit test file (8 tests), plus the existing locked `header-portfolio.test.ts` (16 tests) re-run unmodified to prove the identity contract survives.
3. `tests/integration/header-portfolio.integration.test.ts` — must still pass unmodified (not exercised here — no local Postgres; environmental, runs in CI).
4. Since this touches `src/server/dharma/` (CLAUDE.md critical path): `@code-reviewer` then `@security-auditor` on the diff — the security question worth asking explicitly: can `getHeaderPortfolioCached` ever return one user's cached figure to a different user (key-collision / env-scoping check).
5. Session log at `docs/logs/HEADER-PORTFOLIO-CACHE.md` rather than a new ADR number — extends an already-accepted pattern (cache-aside via Redis, R2-MEMO precedent) rather than introducing a new architectural category.
