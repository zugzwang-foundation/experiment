# S-5-CACHE-PERFORMANCE-PLAN — every cache layer, and what is unmeasured

> **Status:** AUDIT + MEASUREMENT PLAN · planning only · **no cache is added, removed, re-keyed
> or re-TTL'd here**
> **Date:** 2026-08-30 · **Base:** `origin/main` = `44c9f99` · **Governing record:** ADR-0041
>
> ⛔ **This plan does NOT recommend adding Redis.** The application already has Upstash and
> already uses it where a shared, cross-instance, short-TTL value is needed. Every
> recommendation below is a **measurement**, not a cache.

---

## 1 · The layers, as they actually are

```
Browser cache            Next defaults; no service worker; no explicit Cache-Control in app code
      ↓
Vercel CDN               region bom1; public pages carry `instant = false` (Cache Components opt-out
                         from instant-navigation validation), so they are dynamic-rendered
      ↓
Next Data Cache          ONE consumer: readStarCount → fetch(..., next: { revalidate: 900 })
      ↓
Next "use cache"         FOUR blocks, cacheComponents: true (ADR-0041)
      ↓
React.cache()            getRequestSession — per-REQUEST memo, collapses layout+page session reads
      ↓
Upstash Redis            idem:* · ratelimit:* · mod-reserve:* · cron-lock:* · visits · header-portfolio
      ↓
Postgres                 no application-level query cache
```

---

## 2 · Per-resource inventory

### 2.1 The four `"use cache"` blocks

| # | Function | Key | Tags | Life | Invalidated by |
|---|---|---|---|---|---|
| C1 | `getCachedDiscoveryMarketIds` (`discovery/list.ts`) | **none** (no args) | `discovery` | `"minutes"` | `openMarket`, `closeMarket`, `voidMarketAction` → `revalidateTag("discovery",{expire:0})` |
| C2 | `getCachedMarketDiscoveryData` (`discovery/list.ts`) | **`(marketId, reserves)`** | `discovery`, `market:{id}` | `"minutes"` | ⛔ **every bet** (reserves move) + tag busts |
| C3 | `getCachedDebateView` (`debate-view/cached-view.ts`) | **`(market, reserves)`** | `market:{id}` | `"minutes"` | ⛔ **every bet** + `updateTag` on moderation removal |
| C4 | `getCachedReserveWalk` (`discovery/cached-series.ts`) | **`marketId` alone** | `market:{id}` | `stale/revalidate = WINDOW_SEC`, `expire = EXPIRE_SEC` | time floor (`MARKET_SERIES_MIN_WINDOW_MS` = 60 s) + tag busts |

**`"minutes"` = Next's own named profile: `stale: 300, revalidate: 60, expire: 3600`.**
ADR-0041 is explicit that these are the framework's defaults, *"not a project choice"* — so
**tuning them is a decision nobody has made**, not a knob to turn.

### 2.2 The other cached resources

| Resource | Key | TTL | Invalidation | Failure behaviour |
|---|---|---|---|---|
| **GitHub star count** | fetch URL | **900 s** (Data Cache) | time only | ⛔ resolves to `null`, header renders label-only — **silent**. ⚠ 4/hr against a **60/hr per-IP** budget, **region-shared IP** |
| **Header portfolio** | `{env}:...:userId` | **15 s** (`HEADER_PORTFOLIO_CACHE_TTL_SECONDS`) | time only | deliberately matched to `POLL_INTERVAL_MS_DEBATE_VIEW` — *"adds no staleness beyond what a viewer already experiences"* |
| **Header balance** | — | **uncached** | — | live read every layout render |
| Idempotency (`idem:*`) | `{U,K}` (user-scoped, ADR-0044) | completed 24 h; pending **30 s** | — | ⛔ **fails CLOSED** (ADR-0015) |
| Moderation reservation (`mod-reserve:*`) | `{U,M,K}` | **10 s** | `DEL` in a bare `finally` | fails closed |
| Rate limit (`ratelimit:*`) | XFF[0] or email | sliding window | — | ⛔ **fails OPEN** |
| Cron locks | — | 55 s / 240 s / 600 s | lease expiry | — |
| Visits counter | one integer key | none | never | ⛔ **1 `INCR` per real load + 1 `GET` per render** |
| `getRequestSession` | per request | request | — | React `cache()`, **not** cross-request |

---

## 3 · Where caching is effective / missing / mis-scoped / unmeasured / dangerous

### 3.1 ✅ Effective — measured, single-user

S-4's **exact statement counts**: `/m/[slug]` 23–29 → **2** anon, **10** signed-in; Discovery
97 (`1 + 12N`) → **12 cached + N live**. Prices byte-identical to 18 dp across cold and warm.
⚠ **These are one-user counts.** They say nothing about hit rate under concurrency.

### 3.2 ⚠ Mis-scoped by consequence, not by mistake — the `reserves` key

C2 and C3 key on `reserves`. **That is a deliberate, reviewed correctness decision** (ADR-0041
D-2, verified from the compiled build: Next keys on the *entire* received argument list, so a
`void reserves` parameter still keys). It buys a guarantee stronger than a TTL: a hit is
possible only when reserves provably equal a previously observed value.

⛔ **The cost is that hit rate is inversely coupled to write activity.** One bet on a hot
market busts C2 and C3 **for every reader of that market**, and C3's miss path runs
`loadDebateView` — which contains an **unbounded** `listMarketComments`.

⚠ **The codebase already names this failure and already solved it once.** `cached-view.ts`'s
own docblock: *"invalidation coupled to activity performs worst when load is highest… fifty
bets in thirty seconds cost one derivation instead of fifty. That is why this series is keyed
on market identity alone."* **C4 got that treatment. The comment read did not.**

⇒ **This is the single highest-value cache measurement S-5 can take**, and it is invisible to
any single-user test. **Not a fix here** — HARDEN.6's, on evidence.

### 3.3 ⛔ Open correctness question — ADR-0041 OQ-1

Key equality is **strictly weaker** than "unchanged since the entry". This repo's CPMM is
**fee-less**, so buy → sell-back of the same shares restores the exact 18-dp reserve pair and
the key matches an entry generated **before both bets existed**. Price and `currentValue` stay
correct (pure functions of the matched reserves). **`totals` and `topPosts` membership/order
do not** — every bet rides a comment (INV-1), and none of that is in the key.

**OPEN. Two candidate fixes named in ADR-0041. Owner: OQ-1. Not S-5's.** S-5's contribution
is a hit-rate and staleness measurement that tells OQ-1 which candidate is worth its cost.

### 3.4 ⛔ Dangerous — two silent failures

| | Failure | Why it is silent |
|---|---|---|
| **Star count** | Data Cache stops holding ⇒ 60/hr per-IP budget burns within minutes ⇒ header renders with **no count, permanently** | fail-safe returns `null`; **nothing goes red**; the file's own docblock documents it |
| **Presigned-URL TTL vs cache expire** | A TTL equal to `cacheLife("minutes").expire` (3600 s) let an entry served at the edge of its lifetime carry **already-expired image URLs — silently, with no error and no failing test** | fixed at ADR-0041 D-6 (3600 → **7200**, 2× headroom). ⚠ **The class is not closed — it re-opens the moment any TTL or cache profile moves**, which is why neither may move before measurement |

### 3.5 🔴 Unmeasured — the whole of it

**Nothing in this repository counts a cache hit.** Not the Data Cache, not `"use cache"`, not
the Upstash cache-asides. Everything in §3.1 is a *statement count*, which is a different
quantity: it tells you what a warm render costs, never how often a render is warm.

### 3.6 Missing caches — candidates, none recommended yet

| Candidate | Argument for | ⛔ Argument against acting now |
|---|---|---|
| Bound/keyset `listMarketComments` | removes the unbounded scan from C3's miss path | **HARDEN.6 owns it**; and it is a *query* fix, not a cache |
| Market-id-keyed inner cache for comments (the C4 shape) | decouples comment cost from write rate | ⛔ changes a read over `comments.body` ⇒ **CLAUDE.md §5.14 SC-1 fires**; masking must be re-proven at body level |
| Cache `getHeaderBalance` | one uncached read per layout render | ⚠ **it is spendable-today Đ** — SPEC.1 distinguishes it from the wallet figure precisely because a stale value tells a participant they are dead-ended under the Đ 50 reply floor. **Caching it is a product decision** |
| CDN/`Cache-Control` on public pages | offloads the anon read path entirely | ⚠ every public page is dynamic (`instant = false`) and the layout reads `cookies()`; a shared cache here is a **leak surface**, not a tuning knob |
| Parallelise Discovery's 8-market loop | 8 sequential round-trips → 1 depth | **not a cache** — see `S-5-BOTTLENECK-REGISTER.md` BR-11 |

---

## 4 · Cache measurement plan

**Every row is a measurement. No row is a change.**

| # | Measure | How | Where | Positive control |
|---|---|---|---|---|
| **CM-1** | C1–C4 hit/miss counts | per-block counter emitted with the run's provenance | Stage 3 | force a miss by placing a bet; the C3 entry must miss |
| **CM-2** | ⛔ **Hit rate segmented by market write-rate** | the ratified **90 % audience / 10 % bettor** mixed profile, with a designated hot market | **Stage 4 — the headline** | zero-write market must hold a high hit rate in the same run |
| **CM-3** | C3 miss cost vs comment count | statement latency across markets of differing comment volume | Stage 3, volume-realistic fixture | — |
| **CM-4** | C4's 60 s floor actually coalescing | derivations per minute vs bets per minute | Stage 4 | 50 bets in 30 s must produce **one** derivation |
| **CM-5** | Star-count Data Cache holding | assert count **present** in the rendered header **and** GitHub calls ≤4/hr | Stage 3 | ⛔ **positive assertion — the failure is silent** |
| **CM-6** | Presigned URLs valid at the **edge** of cache lifetime | request an entry aged near `expire`; assert the image resolves | Stage 3 | a deliberately short TTL must break it |
| **CM-7** | Upstash command volume + latency | vendor dashboard + rig correlation | Stage 3/4 | drive `/api/visits` |
| **CM-8** | Cache stampede | N concurrent misses on one key at t=0 | Stage 7 | — |
| **CM-9** | Cold-cache first-render cost | first request after a measured idle window | Stage 1 | compare to `parked.md` COLD-START (~1.75 s Discovery after 606 s idle) |
| **CM-10** | Invalidation latency | time from `updateTag` to first evicted serve | Stage 4 | ⛔ **this is the SC-1 safety property** — ADR-0041's CRITICAL was an invalidation that *did not evict* |

---

## 5 · Fences — what must not move before measurement

⛔ **`cacheLife` profiles** (they are Next's defaults; changing them is an unmade decision) ·
**cache keys** (C2/C3's `reserves` is a ratified correctness guarantee) · **`READ_URL_TTL_SECONDS`**
(7200 exists to clear `expire` 3600 by 2×; moving either re-opens the silent-expiry class) ·
**`HEADER_PORTFOLIO_CACHE_TTL_SECONDS`** (15 s is deliberately pinned to the poll interval) ·
**the invalidation forms** — ADR-0041 D-4: *"the literal string `"max"` — or any named
`cacheLife` profile — is never a legal second argument to a removal- or set-change-invalidating
`revalidateTag`/`updateTag` call in this codebase from this ADR forward."*

⚠ **And any change to a read over `comments.body` fires CLAUDE.md §5.14 SC-1**, whose test
obligation is to assert the **body's absence**, not the row's.

---

*Audit and measurement plan only. No cache layer was added, removed, re-keyed, re-TTL'd or
invalidated.*
