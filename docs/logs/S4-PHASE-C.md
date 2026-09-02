# S-4 Phase C — Session log

**Task:** S-4 Phase C — cache Discovery. Take `/` from 97 uncached trips to a cached render,
keeping price/pool-reserves-derived figures live (R3).

---

## What landed (uncommitted — no PR opened yet this session)

**`src/server/discovery/list.ts`** — two new, additive exports (existing `listOpenMarkets`
untouched, byte-for-byte):
- `getCachedDiscoveryMarketIds()` — `'use cache'`, `cacheLife("minutes")`,
  `cacheTag("discovery")`. Just the Open-markets SELECT, no pricing/totals/media.
- `getCachedMarketDiscoveryData(marketId, reserves)` — `'use cache'`, same `cacheLife`,
  `cacheTag("discovery")` + `cacheTag(\`market:${id}\`)`. Wraps totals + media + price series
  (chart geometry) + `selectHeroTopPosts(db, marketId, reserves)` — **that call is
  byte-identical to how `listOpenMarkets` already calls it; `hero.ts`'s signature was not
  touched.**

**`src/app/(public)/page.tsx`** — `DiscoveryContent` restructured: calls
`getCachedDiscoveryMarketIds()` (cached), then per market a **live** call to
`getMarketPricingAndReserves` (never cached, every render), then
`getCachedMarketDiscoveryData(id, reserves)` keyed on the just-fetched reserves value.
`card.pricing` is assigned directly from the live read.

**`src/server/admin/moderation/act.ts`, `markets/open.ts`, `markets/close.ts`** —
`revalidateTag` wired post-commit: content removal busts `market:${id}`; market
open/close busts `discovery` (the Open-set changed). Bans don't invalidate (ban removes
voice, not content — ADR-0021).

**`tests/server/discovery/round-trip-budget.test.ts`** — rewritten. The DB-backed
statement-count tests now replicate the composition inline (can't call the two new `'use
cache'` functions with a counting Drizzle client — a DB client isn't a valid cache-key
argument), still asserting `1 + 12N`, unchanged. Added 4 new static source-scan contract
tests (no DB): `card.pricing` never sourced from the cached result; `getCachedMarketDiscoveryData`
never fetches its own reserves; both cached functions carry explicit `cacheLife("minutes")`;
`hero.ts`'s signature is unchanged (canary).

## The real design decision this session: Design B over the original plan

**Original plan (approved, then revised mid-execution):** restructure `selectHeroTopPosts` to
drop `reserves`/`currentValue`, compute `currentValue` live in the caller. Discovered mid-trace
that this function has a 900+ line DB-backed test suite explicitly marked SAFETY-CRITICAL
(masking logic), and `listOpenMarkets` has its own dedicated suite too — neither runnable in
this environment (no local Postgres). Rewriting either signature meant editing safety-critical,
unverifiable-here test coverage blind.

**Design B, chosen instead (user ruling):** leave `selectHeroTopPosts` and `listOpenMarkets`
completely untouched. Cache the per-market block **keyed on `reserves`** — fetched live every
render, passed in as an argument. Since the cache key IS the exact reserves value observed, a
hit can only occur when reserves are provably unchanged since the last write; a bet changes the
key and forces a miss. This means `HeroPost.currentValue` (the Đb execution-value figure,
`computeSell(reserves, ...)`) is **never stale**, by construction — a stronger guarantee than a
time-based staleness window — but it does mean the value passes through a `'use cache'`
boundary, which is a **disclosed departure from R3's literal wording** ("price and pool
reserves are never cached"), not full literal compliance. Flagged explicitly for Gate C.

`card.pricing` (the visible `<PriceBar>` figure) is unaffected by this question either way —
it's fetched live and never touches any cache boundary in any form, in both designs.

## Verified this session

- Typecheck clean, Biome clean (same 5 pre-existing warnings, none in touched files)
- `next build` green — 26/26 routes, `/` now reports `Revalidate 1m / Expire 1h` (confirms the
  `cacheLife("minutes")` directive registered)
- **Real, measured cache-hit proof** — something Vitest structurally cannot provide (`'use
  cache'` only caches inside the Next.js runtime) but a live `next start` + `curl` can:
  - Request 1 (cold): `5.14s`
  - Request 2 (warm): `0.71s`
  - Request 3 (warm): `0.71s`
  - **7.2× faster, consistent across two warm hits** — this is the strongest evidence available
    in this environment that the caching mechanism is actually functioning, not just
    architecturally present.
- Correctness: all 8 markets' `pricing` values byte-identical between the cold and warm
  responses (expected — no bet occurred between requests; a live read against an unmoved pool
  should return the same value both times). Response byte-size identical (63,363 bytes) between
  cold and warm; the only diff was non-deterministic `<script>` chunk ordering in the head, not
  content.
- The 4 new static contract tests pass (`vitest run ... -t "cache boundary"`)
- DB-backed suites (`hero.test.ts`, `list.test.ts`, the two DB-backed tests in
  `round-trip-budget.test.ts`) still could not run — local Postgres still not set up in this
  environment. Not touched, so not newly at risk, but not freshly confirmed passing either.

## Open questions / known gaps

- **The R3-literal-compliance question (Design B)** needs an explicit Gate C ruling — is
  "provably never stale via reserves-keying" an acceptable reading of "never cached," or does
  R3 need to be read as barring the cache boundary itself regardless of staleness guarantees?
  This governs whether Phase D can reuse the same pattern for `/m/[slug]`'s equivalent figures,
  or whether it must do the literal restructuring Design A would have required.
- **Local Postgres still not set up.** Same gap as Phase B. `hero.test.ts` / `list.test.ts`
  weren't touched, so they're not freshly at risk, but they also haven't been re-confirmed
  passing against this session's Next.js 16.3.2 bump.
- **`revalidateTag`'s actual firing was not verified live** — no admin moderation action or
  market open/close was exercised against the running server this session (would require
  admin auth setup). The wiring is code-reviewed but not runtime-proven.

## Next session starts at

1. Get Gate C's ruling on the Design B / R3 question above before Phase D reuses the pattern.
2. Set up local Postgres so `hero.test.ts`, `list.test.ts`, and the two DB-backed
   round-trip-budget tests can actually run — still the standing gap from Phase B.
3. If time allows: a live test of `revalidateTag` firing (moderate a comment on staging or a
   local seeded market, confirm the Discovery cache entry actually busts).
4. Commit Phase B + Phase C together (or separately, if the operator prefers granular
   history), open the PR, run `@code-reviewer` / `@security-auditor` (CLAUDE.md §5.11).

## Time

2026-08-21, continuation of the same day's Phase A → Phase B → Phase C session. Phase C:
trace Discovery's actual code → find the `currentValue` R3 subtlety the pack's high-level
design didn't surface → plan → discover the hero.ts/list.ts test-risk mid-execution → pivot to
Design B → implement → verify (typecheck/Biome/build/live cache-hit proof).
