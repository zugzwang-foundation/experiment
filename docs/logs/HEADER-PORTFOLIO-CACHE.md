# HEADER-PORTFOLIO-CACHE — Session log

**Task:** Cache the header PORTFOLIO figure (Latency Register row 3), the last open home-page cache gap after S-4 Phase C (Discovery) and R2-MEMO (PR #424).
**Branch:** `Ritam-finalS` · **State:** uncommitted, verified

---

## What landed

| File | Change |
|---|---|
| `src/server/dharma/header-portfolio.ts` | New, additive `getHeaderPortfolioCached(client, userId)` — Redis cache-aside in front of the untouched `getHeaderPortfolio`. Fully insulated (no throw escapes), never caches a `null`/failure result, fails open on any Redis error. |
| `src/server/config/limits.ts` | New `HEADER_PORTFOLIO_CACHE_TTL_SECONDS = 15`, tied explicitly to `POLL_INTERVAL_MS_DEBATE_VIEW`. |
| `src/app/(public)/layout.tsx` | One call-site swap inside the existing `Promise.all` (`getHeaderPortfolio` → `getHeaderPortfolioCached`); docblock reference updated to match. |
| `tests/server/dharma/header-portfolio-cache.test.ts` | New, 8 tests — cache hit/miss, never-caches-failure vs. real-zero contrast, per-user discrimination, Redis-read/write-failure fail-open. |
| `docs/plans/HEADER-PORTFOLIO-CACHE.md` | The approved plan (this repo's `docs/plans/<TASK-ID>.md` convention), including the "why not `'use cache'`" decision and the explicit no-bet-path-invalidation tradeoff. |

No PR opened yet — not requested this session.

---

## Decisions made

1. **Redis cache-aside, not Next.js `'use cache'`.** Every existing `'use cache'` function in this repo is keyed on market-scoped or global arguments; `getCachedDebateView`'s own docblock explicitly forbids viewer-scoped input entering that mechanism ("would leak one participant's balance/position/bookmarks to the next"). `userId` is exactly that case. Chose Redis, the same infra already backing rate-limit/idempotency/moderation locks, to sidestep the risk class entirely rather than become its first exception.
2. **Fully additive.** `getHeaderPortfolio` is byte-for-byte untouched — confirmed by both subagent reviews and by the locked test suite (`header-portfolio.test.ts`, `header-portfolio.integration.test.ts`) passing unmodified. Zero risk to the FI-2 byte-identity contract with `profile/positions.ts`.
3. **No bet-path invalidation hook**, by design — see the plan's "explicit tradeoff" section. Accepted consequence: up to 15s of staleness on a viewer's own portfolio figure after their own bet, self-healing on the next poll tick.
4. **Mid-session fix from the security-auditor pass**: `getRedisKey()`'s call was originally outside any try/catch, the one throw path in the function not insulated from the rest. Restructured so key construction itself is wrapped, with a `cacheKey === null` fallback that skips caching but still returns the live value — restoring `getHeaderPortfolio`'s own "any error degrades, never crashes" guarantee for this wrapper too. Fixed same-session per CLAUDE.md's same-commit doctrine, not deferred.
5. **Session log instead of a new ADR number.** This extends an already-accepted architectural pattern (cache-aside via Redis, established by R2-MEMO) rather than introducing a new category — flagged in the plan for a reviewer to override if they disagree.

---

## Verification

- `pnpm tsc --noEmit` — clean, `ZUGZWANG_ENV=preview`.
- `biome check` on all four touched files — clean (two pre-existing, unrelated warnings elsewhere in the repo were left untouched, per CLAUDE.md §5.3 surgical-changes).
- `next build` — green, twice (before and after the security-auditor fix).
- New unit suite: 8/8 passing. Existing locked `header-portfolio.test.ts`: 16/16 passing, unmodified.
- `tests/integration/header-portfolio.integration.test.ts` — not run locally (no local Postgres, environmental; same limitation R2-MEMO recorded). Exercises only the untouched `getHeaderPortfolio`, so it is not expected to be affected.
- `@code-reviewer` pass: zero findings at any severity.
- `@security-auditor` pass: zero CRITICAL/HIGH/MEDIUM; one LOW (the uninsulated `getRedisKey` call), fixed same-session, re-verified green after the fix. Explicitly ruled out cross-user leakage, key collision, env-scoping bleed, cache-aside race conditions, and DoS/cost-amplification — all with stated reasoning, not just "not found."

---

## Open questions

- Whether an ADR is actually warranted for "Redis cache-aside as the pattern for viewer-scoped data, explicitly instead of `'use cache'`" — flagged for reviewer judgment, not resolved here.
- No PR opened; CI hasn't run against this diff.

## Next session starts at

Open a PR (branch `Ritam-finalS` has no upstream tracking branch yet — needs a first push), or fold this into whatever larger PR the branch accumulates next. Nothing else is pending on this task.

## Context to preserve

- The header-portfolio caching gap was the *only* remaining home-page item from the Latency Register once S-4 (Discovery) and R2-MEMO (image URLs) were confirmed already shipped — this task is scoped narrowly and deliberately, not a broader "cache everything" pass.
- The real 100k-user blocker remains the production Postgres pooler (ADR-0038, Row 7 of the Latency Register) — unrelated to and unmoved by this task, deliberately out of scope, gated on a load test that hasn't run yet.

## Time

2026-08-27.
