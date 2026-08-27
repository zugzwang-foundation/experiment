# ADR-0042 — A presigned URL's hold is budgeted against the cache that outlives it

- **Status:** Accepted
- **Date:** 2026-08-27
- **Amends:** ADR-0041 D-6 (does not supersede it — the 7200 s TTL stands, on a premise this ADR restores)
- **Task:** R2-MEMO / PR #424, Gate C finding C-1

---

## Context

`read-url-memo.ts` holds a minted presigned R2 URL and re-serves it instead of signing a new one, because a new signature means a new URL, and a browser keying its cache on the URL re-downloads bytes it already has.

The hold was `ttl × 5/6`. That is correct if a URL is consumed as soon as it is produced. **It is not, and the three render call sites are precisely where it is not.** All three sit inside `"use cache"` blocks:

| caller | boundary | profile |
|---|---|---|
| `debate-view/load-debate-view.ts` | `debate-view/cached-view.ts` | `cacheLife("minutes")` |
| `discovery/hero.ts` | `discovery/list.ts` | `cacheLife("minutes")` |
| `discovery/media.ts` | `discovery/list.ts` | `cacheLife("minutes")` |

A `"use cache"` entry embeds the URL in its return value and keeps serving it until `timestamp + expire`. The two windows therefore **add**:

```
hold (6000) + expire (3600) + stale (300) = 9900 s     against a 7200 s signature
                                                        ⇒ dead for the last 2700 s
```

**ADR-0041 D-6 raised this TTL from 3600 to 7200 to close exactly this class**, and recorded it closed at §126. Its reasoning, in `load-debate-view.ts`, names the premise: *"a URL minted AT generation time is embedded in that entry."* Holding the URL removes that premise — under the memo the URL can already be 6000 s old when the entry is generated. **The class was re-opened by a change that never read the file whose constant it invalidated.**

The failure is silent by construction: the mint succeeded, so nothing throws, nothing reaches Sentry, and no test covered 7200 — the memo's own suite exercised `[60, 300, 3600, 86400]`, of which only 60 ships.

Two facts made a simpler fix unattractive:

1. **A fourth boundary landed mid-review.** CHART-1 added `discovery/cached-series.ts` with a **custom** profile, the first in the codebase not to use a named one.
2. **Its ceiling is derived from a constant that is scheduled to move.** `MARKET_SERIES_MIN_WINDOW_MS`'s own docblock says *"Read from this constant at every call site and never inlined, so the HARDEN.6 tune stays a one-line change."*

So the downstream ceiling is not one number, not all literal, and not stable.

## Decision

**D-1 · The hold is computed from the window that remains after the caller's own cache has finished serving.**

```
hold = max(0, floor((ttl − downstream) × 5/6))
```

The invariant `hold + downstream < ttl` is then a **theorem**, not a tuning. For any `ttl > downstream`:

```
hold + downstream = (ttl − downstream)·5/6 + downstream = ttl − (ttl − downstream)/6 < ttl   ∎
```

No pair of values breaks it. A hold ratio chosen against today's `expire = 3600` would have to be re-verified by hand every time a profile moved; this does not.

**D-2 · `downstreamMaxAgeSeconds` is a REQUIRED parameter with no default.** A default would be a guess about someone else's cache, made silently. Omission is a compile error instead — the only form of this rule that survives a call site added by someone who has never read the module. It is the worst case over *every* caller of that site, not the nearest one: `loadDebateView` is reached both through the cached wrapper and directly from the uncached export route.

**D-3 · A cached ceiling counts `expire + stale`, not `expire` alone.** The server stops storing the entry at `expire`; the client router can still be showing a response it already received. `DOWNSTREAM_CACHED_MINUTES = 3900`.

**D-4 · The memo builds its own key, from `(bucket, key, ttl, downstream)`.** Previously the caller passed a key string whose bucket prefix had to agree with the bucket passed to `mintReadUrl` — two literals, no check, with the ADR-0026 arm separation resting on them matching. `downstream` is in the key because an entry stores the hold computed when it *missed*; two callers sharing an object behind different caches would otherwise share an entry, and the one behind the longer cache would inherit a hold computed as if nothing were caching. Not reachable today; in the key so that stops being a fact somebody has to re-check.

**D-5 · The OpenAI moderation hop is not memoised at all** — `signReadSingleUse`, a separate function. Its consumer is OpenAI's fetcher; there is no browser, so there is no cache to key and nothing to gain, while the hold spent 50 of the 60 seconds `limits.ts` sized for *"OpenAI's 3s call + 1 retry + slack"* on a gate that fails **closed** and therefore refuses a participant's bet when it goes wrong. Zeroing the hold arithmetically would have been equivalent and a worse rule — it leaves the path one edited argument from being held again.

**D-6 · Two tests, because a cached boundary cannot be executed here.** `"use cache"` throws under a bare `vitest run` and `cacheLife()` requires the `cacheComponents` config, so no test can put a value through a real boundary. Instead:

- `tests/unit/storage/read-url-hold-budget.test.ts` asserts the invariant over `SHIPPED_HOLD_BUDGET`, a table derived from the constants the call sites read.
- `tests/server/storage/cache-boundary-parity.test.ts` asserts that the `"use cache"` functions **on disk** are exactly those with a declared ceiling — so a fifth boundary cannot be added without stating how long it serves. It strips comments before matching, because `sign-read.ts` carries the sentence "NOT `'use cache'`" and a raw scan would read it as a boundary.

## The shipped budget

| call site | ttl | downstream | hold | Σ | < ttl |
|---|---|---|---|---|---|
| `debate-view/load-debate-view.ts` | 7200 | 3900 | 2750 | 6650 | ✓ |
| `discovery/hero.ts` | 7200 | 3900 | 2750 | 6650 | ✓ |
| `discovery/media.ts` | 7200 | 3900 | 2750 | 6650 | ✓ |
| `admin/moderation/review-feed.ts` | 60 | 30 | 25 | 55 | ✓ |
| `moderation/precommit.ts` | 60 | — | — | — | not memoised (D-5) |

## Consequences

- **The class ADR-0041 D-6 closed is closed again, and this time by an assertion rather than by a constant chosen to be large enough.** D-6's 7200 is untouched and its reasoning is restored: it only ever had to survive the cache window, and now the hold is required to leave room for it.
- **A HARDEN.6 tune of `MARKET_SERIES_MIN_WINDOW_MS` propagates by itself.** `DOWNSTREAM_CACHED_SERIES` derives from it, so the budget test re-checks the invariant against the new number instead of silently going wrong.
- **The memo is smaller in effect than it was**, deliberately: 2750 s instead of 6000 s on the render paths, and gone entirely from the moderation hop. What it buys is unchanged in kind — those blocks key on pool reserves, so every bet busts every reader's entry, and without the memo one bet costs every open tab a full re-download of an image nobody touched. The value is across invalidations, not within an entry.
- **Cost: one more argument at four call sites, and a table that must be kept in parity with the tree.** The parity test is what makes that upkeep a RED rather than a review comment.
- **Not addressed here:** `review-feed.ts` and `precommit.ts` still share one `READ_URL_TTL_SECONDS_MODERATION`. An admin's browser and OpenAI's fetcher have no business sharing a number; splitting it is a separate task and needs its own ratification.

## Alternatives considered

1. **Tighten `HOLD_FRACTION` for everyone** — rejected. A single ratio must be safe against the worst ceiling anywhere in the codebase, coupling the 60 s moderation hop to the render path's cache profile for no reason; nothing connects the ratio to any `cacheLife`, so no test can fail when a profile changes; and it re-creates the very hazard the module's docblock says the ratio exists to remove. CHART-1 made this concrete rather than theoretical.
2. **Do not memoise inside `"use cache"` at all** — rejected as primary, kept as the fallback. It is the smallest diff and the safest story, and it costs less than it looks (within one cache entry the URL is already stable). But it leaves the invariant unstated: the next caller to wrap something in `"use cache"` re-introduces C-1 with nothing to stop them.
3. **Have the memo read the caller's cache profile itself** — not possible. `cacheLife` is not introspectable from inside the cached scope, and the memo has no reference to its caller.
