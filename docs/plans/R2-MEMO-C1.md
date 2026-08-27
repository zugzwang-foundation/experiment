# R2-MEMO · C-1 — the hold must leave room for the cache that outlives it

**Task:** PR #424 Gate C finding C-1 · **Branch:** `Ritam_2_S4` · **ADR:** 0042
**Status:** executed 2026-08-27, against rulings R1–R6 below.

---

## The finding

`read-url-memo.ts` held each presigned URL for `ttl × 5/6`. The three render call sites sit inside `"use cache"` blocks whose entries keep serving an embedded URL for `expire + stale` afterwards, so the windows add: `6000 + 3900 = 9900` against a 7200 s signature — dead for the last 2700 s, silently, because the mint succeeded and no test passed 7200.

ADR-0041 D-6 raised that TTL to 7200 specifically to close this class and recorded it closed at §126. The memo re-opened it by removing D-6's stated premise — *"a URL minted AT generation time is embedded in that entry."*

**The invariant a fix must satisfy:** `hold + max_downstream_cache_age < signature_ttl`.

## Rulings executed

| | ruling |
|---|---|
| **R1** | `hold = max(0, floor((ttl − downstream) × 5/6))`; `downstream` REQUIRED; key built inside the module. Rationale preserved in the docblock: the ceiling is not merely movable, it is *scheduled* to move (`MARKET_SERIES_MIN_WINDOW_MS`, HARDEN.6). |
| **R2** | Drop the memo from the OpenAI/precommit path entirely — no browser there, so removing beats tuning. |
| **R3** | The two-test pair. Source scan MUST strip comments; MUST carry a positive control. |
| **R4** | Merge, not rebase — a rebase would re-sign another contributor's commits with the operator's key. |
| **R5** | The memo stays. Its value is **across invalidations**, not within entries: every bet busts the reserves-keyed blocks, so without it one bet costs every open tab a full re-download. Do not gate shipping on a measurement. |
| **R6** | `R2-MEMO-SUMMARY.md:151` names the wrong blocker (branch protection, which does not exist). |

**Not doing:** no merge · no ceiling or `cacheLife` changes · no rebase · no `LIMIT` on `listMarketComments` · no `Cache-Control` work · never weaken a test to make anything pass.

## Items

| # | item | file | state |
|---|---|---|---|
| 1 | Downstream ceilings + boundary registry + shipped budget table | `src/server/storage/read-url-memo.ts` | ✅ |
| 2 | `holdWindowMs(ttl, downstream)` — usable window, zero-floor | same | ✅ |
| 3 | `memoizedReadUrl(bucket, key, ttl, downstream, mint)` — key built internally | same | ✅ |
| 4 | Export `R2Bucket` so the bucket can be typed rather than string-prefixed | `src/server/storage/r2.ts` | ✅ |
| 5 | `signRead` takes downstream; new `signReadSingleUse` for the un-memoised hop | `src/server/storage/sign-read.ts` | ✅ |
| 6 | `signReadMarketMedia` takes downstream | `src/server/discovery/media.ts` | ✅ |
| 7 | Four call sites declare their ceiling; precommit switched to `signReadSingleUse` | `load-debate-view`, `hero`, `media`, `review-feed`, `precommit` | ✅ |
| 8 | Arithmetic budget test — RED first, quoted in the log | `tests/unit/storage/read-url-hold-budget.test.ts` | ✅ |
| 9 | Cache-boundary parity test — stripper + positive control + live-trap negative control | `tests/server/storage/cache-boundary-parity.test.ts` | ✅ |
| 10 | Existing memo suite adapted to the new signature, every discriminating pair preserved | `tests/unit/storage/read-url-memo.test.ts` | ✅ |
| 11 | `sign-read.integration.test.ts` — third argument, memo reset, two stale comments corrected | that file | ✅ |
| 12 | ADR-0042, same commit | `docs/adr/0042-…md` | ✅ |
| 13 | R6 doc correction | `docs/logs/R2-MEMO-SUMMARY.md` | ✅ |

## Test plan (§5.6 — tests first)

**RED, before any implementation** — `holdWindowMs` ignoring downstream:

```
× 'src/server/debate-view/load-debate-vi…' — hold + downstream stays inside the signature
× 'src/server/discovery/hero.ts'          — hold + downstream stays inside the signature
× 'src/server/discovery/media.ts'         — hold + downstream stays inside the signature
     AssertionError: expected 9900 to be less than 7200
× 'src/server/admin/moderation/review-fe…' — hold + downstream stays inside the signature
     AssertionError: expected 80 to be less than 60
× passes 7200 through the memo    → expected 6000 to be 2750
× refuses to hold at all …        → expected 50000 to be +0
 Test Files  1 failed (1)
      Tests  7 failed | 4 passed (11)
```

**GREEN, after** — 3 files / 34 tests in the storage surface.

## Surprise found during execution (§5.10)

**`downstream` had to enter the memo KEY, which the proposal did not call for.** An entry stores the hold computed when it *missed*. Two call sites sharing `(bucket, key, ttl)` behind different caches would share that entry, so the one behind the longer cache could be handed a URL held as if nothing were caching — C-1 again, one level down. Not reachable in the shipped table (every triple carries exactly one downstream), which is why it survived the proposal. Closed by keying on it, with a paired control in the memo suite.

## Deviation from the proposal

The proposal's row 5 zeroed the precommit hold by passing `downstream = ttl`. **R2 asked for removal, so it is a separate function (`signReadSingleUse`) rather than an argument value** — the arithmetic is identical, the rule is stronger: a number can be edited back, a missing import cannot be edited back by accident.
