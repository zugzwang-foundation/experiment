# ADR-0051 — Windowed Shared Read Caches, and the Poster Bypass That Replaces an Accident

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-09-12 |
| **Deciders** | Hrishikesh (founder) |
| **Tracker task** | CACHE-KEY-1 (the load-testing programme's highest-value unfixed finding) |
| **Frame document** | SPEC.1 §9 *Refresh — floored history, live edge* · SPEC.1 §16.1 + Appendix B (the window constant) · CLAUDE.md §5.14 SC-1 (masking is a property of every read over `comments.body`) |
| **Supersedes** | ADR-0041 (partial — **D-2 only**, the reserves-keyed cache key on the two participant read blocks. D-1, D-3, D-4 and D-5 stand unchanged) |
| **Superseded-by** | — |
| **Amends** | — |
| **Patch records** | P1 (CACHE-COALESCE-1, 2026-09-22) — the window was written for one cache; the fleet has one per instance |
| **Amended-by** | ADR-0055 — rider (1) only: the hero's `currentValue` and Discovery's other priced figures are no longer computed from a LIVE pool read on every render. Discovery's pool read now rides a 5 s window (`DISCOVERY_PRICE_MIN_WINDOW_MS`). ⚠ **The rule that justified rider (1) — "money on a public surface may not lag a window" — was measured and found to govern composition ORDER rather than freshness:** `/m/[slug]`, the surface that actually takes a bet, is prerendered and was serving a thirteen-hour-old price, so Discovery was paying a database connection per visitor to be stricter than the page taking the money. **Everything else in this ADR stands and is what ADR-0055 relies on** — the identity keying, the poster bypass, the `after()` instrumentation, and `HeroTopPostsBase` omitting `currentValue` (whose reason changes from "must be live" to "must stay off the cache KEY", the half of this ADR that is untouched). |

---

## Patch record

### P1 — One render per market per window, fleet-wide (CACHE-COALESCE-1, 2026-09-22)

In-place Patch record (CLAUDE.md §5.12), not a supersession: D-1's window, D-3's poster bypass, D-4's no-invalidation-from-bets and D-5's `after()` instrumentation all stand. What this record corrects is an assumption D-1 never stated: that there is **one** cache. On Vercel Fluid there is one per runtime instance, and `'use cache'` dedupes an in-flight render only inside its own instance.

**Measured.** Staging at 100 readers (~1–3 instances): debate-view renders at the window rate, 2–3.5/min/market — D-1 works as written. Production at 5,000 readers (~100+ instances): **~3,800 renders/min** against a window that costs 4/min/market, i.e. *instances × markets × 4/min*; with ~500 comments per market the same ramp filled the Postgres pool (50/45) and put the page at p95 3.5 s; a 30-second burst to 5,000 cold-started every instance at once (49/45 backends, 10.7% timeouts). Load-test report I-07, I-17, I-18; runs 8602449, 8604614, 8604548, 8608236.

**Decision.** `getCachedDebateView` keeps its `'use cache'` as the per-instance layer and, on a miss, renders through `coalesceDebateView` (`src/server/debate-view/shared-view-store.ts`): the shared entry lives in Upstash under `cache:debate-view:<marketId>` with `SHARED_VIEW_EXPIRE_SEC` as TTL; when the entry is older than `SHARED_VIEW_MIN_WINDOW_MS` (or carries another `market.status`), one instance takes a `SET NX PX SHARED_VIEW_LOCK_MS` lock and renders while every other serves the previous entry, or — with no entry at all — waits up to `SHARED_VIEW_WAIT_MS` for the holder's before rendering itself. A stale window now costs **one render across the fleet**; a burst costs one per market.

**Riders.** (1) **Fail open, always** — any Redis failure degrades to the pre-patch local render; the cache is never why a page fails. (2) **SC-1** — the entry holds bodies, so `moderateComment`'s `remove` now `DEL`s it beside the `updateTag` it already fires; the store test asserts the removed BODY is unreachable, not merely a row. (3) The `.md` export, the poster bypass and `loadDebateView` are untouched; nothing viewer-scoped enters the store. (4) `debate-view-render` is a new miss counter that counts what the DATABASE paid; `debate-view` misses were per instance and stopped meaning that once there was more than one.

**Not decided here.** The per-render cost's dependence on comment count (I-18's other half) — limiting the ranked set and precomputing per-market aggregates — is a separate task.

---

## Context and Problem Statement

A load-testing programme run 2026-09-01 → 2026-09-12 against staging found that the product's logic never produced a wrong answer under any pressure tested — money and Dharma accounting were verified independently against the database under 500 simultaneous bets and 150 simultaneous signups, with zero errors. What limits the site is capacity. Its single largest unfixed cause was this:

**Two `'use cache'` blocks were keyed on `reserves`, and a `'use cache'` key is its serialised argument list.** `getCachedDebateView` took `(market, reserves)` and `getCachedMarketDiscoveryData` took `(marketId, reserves)`. Every bet moves the CPMM pool, so every bet changed the key and forced a full miss for **every reader of that market**. The caches worked on quiet markets and stopped working entirely on the market everyone was betting on — invalidation coupled to *activity*, which SPEC.1 §9 *Refresh* names by hand as performing **worst exactly when load is highest**.

The codebase already contained the answer and said so. `getCachedReserveWalk` (`src/server/discovery/cached-series.ts`, CHART-1) keys on `marketId` alone with a `MARKET_SERIES_MIN_WINDOW_MS` window, and its docblock names these two blocks as the counter-example: *"Keying on market identity alone is what lets the window COALESCE — fifty bets in thirty seconds cost one derivation instead of fifty."* This ADR makes the two consistent with the one that was already right. It is not a new design; it is the removal of an inconsistency that had a written explanation and no scheduled fix.

**ADR-0041 D-2 ratified the reserves key, and its reasoning was sound.** A hit proved the live reserves were *provably equal to a previously observed value*, so any pure function of them — `pricing`, `unitToWin`, `topPosts[].currentValue` — could not be stale. What that guarantee cost was never priced: it bought non-staleness for three derived figures by making the cache miss on every write. ADR-0041's own **OQ-1** had already recorded that the guarantee was weaker than it looked (a fee-less CPMM permits an A → B → A round trip that restores the exact 18-dp pair, so the key can match an entry predating two bets and the comments they minted) and left the fix to a separately ruled task. **This is that task, and it closes OQ-1 by dissolving it** rather than by choosing either candidate fix OQ-1 named.

This ADR does **not** decide:

- Whether `cacheComponents` and `"use cache"` are the right primitives (ADR-0041 D-1, unchanged).
- The tag vocabulary, or that invalidation is immediate-expiration rather than a named profile (ADR-0041 D-3 / D-4, unchanged).
- That the `.md` export route stays uncached (ADR-0025, unchanged and re-asserted).
- Anything about the bet write path. `src/server/bets/` is untouched by this ADR, deliberately — see D-4.
- Re-siting the events↔`pools` drift check CHART-1 removed (still owed; `src/server/discovery/list.ts` carries the note).

## Decision Drivers

1. **A cache must help most when load is highest.** The property SPEC.1 §9 *Refresh* asks for is coalescing, not staleness tolerance. Any key that a write can move fails this by construction.
2. **A rendered Đ figure must never be computed from stale reserves.** This is what ADR-0041 D-2's "R3 v2" actually protected, and it must survive the key's removal by some other means.
3. **The poster must see their own argument.** This was true before, but only as a side effect of the key, and nothing recorded that.
4. **Nothing viewer-scoped may enter a cached function.** ADR-0041 and ADR-0034 both rest on this; any poster fix that weakens it is disqualified regardless of its other merits.
5. **A card must be found in the read model, never reconstructed client-side.** `src/components/debate/find-posted.ts` establishes this and gives three fields a reconstruction gets wrong.
6. **Freshness for other readers is a product call, not an implementation detail.** How long a debate may feel stale to someone who did not write the post is the founder's to set.

## Considered Options

1. **Key on market identity plus a short window; handle the poster with a page-level bypass** ← chosen
2. OQ-1's candidate 1 — keep `reserves` in the key and add a monotonic per-market discriminator
3. OQ-1's candidate 2 — bust `market:<id>` from the bet and sell path
4. Key on identity plus a window, and let the poster wait one window
5. Key on identity plus a window, and render the poster's card optimistically from the `place()` receipt

## Decision Outcome

**Chosen: Option 1.** Five primitives are ratified together.

### D-1 · Both shared read blocks are keyed on market identity, windowed by one constant

`getCachedDebateView(market)` and `getCachedMarketDiscoveryData(marketId)` lose their `reserves` parameter. `market` is a `MarketSummary` — six stable columns, carrying `status`, so a lifecycle transition still changes the key and auto-misses. `cacheTag(\`market:${id}\`)` is retained on both, unchanged, so ADR-0041 D-3/D-4's removal invalidation still reaches them.

The window is **`SHARED_VIEW_MIN_WINDOW_MS = 15000`**, a new constant in `src/server/config/limits.ts`, registered in SPEC.1 §16.1 and Appendix B by the same commit. It is **equal to** `POLL_INTERVAL_MS_DEBATE_VIEW` and **not derived from it** — two independent tunables that happen to agree, the `HEADER_PORTFOLIO_CACHE_TTL_SECONDS` precedent. The stale-serving ceiling is `SHARED_VIEW_EXPIRE_SEC`, pinned to `MARKET_SERIES_MIN_WINDOW_MS / 1000` (60 s) rather than to `cached-series.ts`'s `window × 60` ratio: that ratio is right for a price *history* and would give a 15 s window a 900 s ceiling, letting a debate feed serve fifteen minutes stale in a low-traffic lull.

⚠ **15 s is shorter than the 60 s window on the history it nests**, deliberately. A picture of the past does not need re-drawing four times a minute; an argument somebody just posted does.

### D-2 · `topPosts[].currentValue` is computed outside the cache, and the type enforces it

`currentValue` is `computeSell(reserves, …)` — money, rendered on the most public surface in the product. It was the one thing in either block that could not simply move behind a window.

`selectHeroTopPosts(client, marketId)` therefore returns `{ posts: HeroTopPostsBase, shares: HeroPostShares }`, where **`HeroPostBase = Omit<HeroPost, "currentValue">`**, and `valueHeroPosts` (`src/server/discovery/hero-value.ts`) applies the live pool at `(public)/page.tsx` — from the batched read the page already performs for `card.pricing`, at **zero additional queries**.

⛔ **The `Omit` is the mechanism, not documentation.** A `HeroPostBase` cannot satisfy `DiscoveryMarketView.topPosts`, so a composition that skips the step is a **compile error**. Emitting `currentValue: null` from the cached block would have type-checked perfectly and silently deleted a founder-ruled figure (OD-1 Option B) from the hero panels.

⚠ `heroShares` is a **server-local sibling** of `topPosts`, never a field on a hero post — the rule `DiscoveryListing` already applies to `reserves`, for the same reason: a hero post crosses into `DiscoveryCarousel` (`"use client"`), and a raw `lots`/`positions` share quantity is an internal row value (AGENTS.md §6).

### D-3 · The poster reads uncached for one window — a page-level bypass, never a cache input

Because every comment rides a bet (**INV-1**), the `reserves` key was making a poster's own comment come back on their own `router.refresh()`. **That was an accident of the key and was written down nowhere**, and it does not degrade gracefully when the key goes: `DebateView`'s `landed` still fires (a cache hit deserialises a fresh payload object), `findPostedNode` then searches a model lacking the comment, returns `null`, and the author gets **no card and no error** — the silent branch designed for a comment *removed* between submit and refresh, reached by an ordinary successful post.

`src/server/debate-view/viewer-freshness.ts` answers one question — when did this viewer last post in this market — in one indexed statement reading `created_at` and nothing else. `/m/[slug]` and `/m/[slug]/export/image` read **uncached** (`loadDebateView` directly, with the cached walk passed through) when that answer is inside the window.

⛔ **This does not weaken "nothing viewer-scoped may enter a cached function".** The cached function's signature *shrank* to one market argument. The page chooses which function to call, outside the boundary, exactly where `loadViewerMarketContext` already sits. A viewer is never passed *into* a cache.

⚠ **The bound is a clock, not a content comparison,** and that is load-bearing. Comparing the viewer's newest comment against the cached model's would be the precise test and the wrong one: a comment removed seconds after posting is absent from the cached model *and* from an uncached re-read, so a content comparison would pin the bypass on for that viewer forever. A clock cannot.

⛔ **The image-export route takes the same branch**, because the download affordance lives on a post's card. Without it, an author who can *see* their card gets a 404 downloading it: `resolvePostParam` resolves the ordinal from the database, then `composePostExport` fails to find the id in a cached model minted before the post existed.

### D-4 · The bet path fires no invalidation, and that constraint now guards three windows

"Fire a tag when a bet commits" is the obvious-looking fix and it achieves nothing: every comment rides a bet, so it would invalidate **exactly as often as the `reserves` key did** — same miss rate, more code — and reusing `market:${id}` would break `getCachedReserveWalk`'s coalescing too. This is OQ-1's candidate 2, and it is rejected on its own terms rather than on scope.

`tests/server/discovery/cached-series-contract.test.ts` already asserts, with a positive control, that `bets/place.ts` and `bets/sell.ts` contain no `revalidateTag`/`updateTag`. That tripwire is unchanged and now protects three windows instead of one.

### D-5 · Cache instrumentation runs after the response, never in the render

Found while establishing this task's baseline, fixed here because it falsifies the same claim this ADR makes. The RELAY C2 counters were `await`ed Upstash REST round trips **on the render path** — `DiscoveryContent` calls `recordCacheAttempt` once per market inside its loop, so **nine serial network hops per Discovery render** at `DISCOVERY_GRID_SIZE = 8`, plus one per debate-view poll tick per open tab. Measured 2026-09-12: **~135 ms per round trip**, i.e. ~1.2 s added to a surface whose whole post-PERF-1 p50 is 0.692 s.

They were **fail-open** but they were not **non-blocking**, and those are different properties. An instrument that costs more than the effect it measures reports its own latency rather than the system's.

Every counter now runs under `next/server`'s `after()`, and the functions return **`void` rather than `Promise<void>` so a caller cannot `await` one by reflex** — the old signature made `await` the natural thing to type and nothing objected, which is how seven call sites acquired one. `after()` throws without a request scope, which a `'use cache'` body genuinely lacks during a background revalidation, so a fire-and-forget fallback catches that case.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| The shared-block window and its stale ceiling | `src/server/config/limits.ts` |
| The debate view's cached block | `src/server/debate-view/cached-view.ts` |
| Discovery's per-market cached block | `src/server/discovery/list.ts` |
| "Has this viewer just posted here?" | `src/server/debate-view/viewer-freshness.ts` |
| The hero's live Đ valuation | `src/server/discovery/hero-value.ts` |
| Cache hit/miss instrumentation | `src/server/observability/cache-metrics.ts` |

## Consequences

### Positive

- The cache stops being invalidated by activity. Fifty bets in thirty seconds cost one derivation of each shared block instead of fifty, and the per-bet cost of a busy market stops scaling with how busy it is.
- ADR-0041 OQ-1 is **closed**, not inherited. With no `reserves` in the key there is no key equality to be weaker than anything; the window bounds staleness directly, for every cause at once — including the A → B → A path that key equality could not see.
- The rendered price guarantee gets **stronger and more legible**. It rests entirely on the explicit override at each call site (ADR-0041 D-2/D-6's own foresight), not on cache-key reasoning a reader of the page cannot see.
- The poster path is now a **decision with a record**, where it was previously a side effect of a cache key that nothing documented and no test covered.
- ~1.2 s of blocking instrumentation comes off the Discovery render (D-5), and `tests/server/discovery/page-wiring.test.ts` stops doing real network IO.

### Negative

- **A reader can be up to one window behind on someone else's argument** (and up to `SHARED_VIEW_EXPIRE_SEC` in a low-traffic lull, under stale-while-revalidate). *Acceptable because:* the debate page already re-renders every `POLL_INTERVAL_MS_DEBATE_VIEW`, so 15 s is at most one tick of lag on a cadence the product already ships.
- **One extra indexed read per signed-in render of `/m/[slug]`.** *Mitigated by:* signed-out readers skip it entirely; it is bounded to one user's rows in one market on `comments_user_id_idx`; and it replaces a full uncached re-derivation that every reader used to pay on every bet.
- **A poster reads uncached for up to one window**, on both the page and the image route. *Acceptable because:* it is bounded by a clock, scoped to one viewer, and is strictly cheaper than the previous behaviour, where *every* reader read uncached after *any* bet.
- **`HeroPost` now has two type shapes in the codebase.** *Mitigated by:* the `Omit` is what makes the composition non-skippable, so the second shape is the enforcement mechanism rather than incidental churn.
- **Counter writes can be lost** when `after()` is unavailable and the runtime freezes before the fallback lands. *Acceptable because:* this is diagnostic infrastructure; a lost count is cheaper than a blocked render, which is the trade the previous shape got backwards.

### Neutral

- The uncached statement budgets do not move. Dropping a parameter removes no read; `2 + 10N` on Discovery and `12` on the debate view are unchanged, and both are re-confirmed rather than re-pinned.
- `getCachedDiscoveryMarketIds` keeps `cacheLife("minutes")`. It holds *which* markets are open, is invalidated by the `discovery` tag on open/close/void, and nothing about it decays on a clock.

## Pros and Cons of the Options

### Option 1 — identity + window, with a page-level poster bypass (chosen)

**Pros**

- Matches the one block in this codebase that already got it right, so there is one caching idiom rather than two.
- Bounds staleness by a clock, which is cause-independent — it covers the ABA path, the removal path and every future write path at once.
- Leaves the cached functions' viewer-independence *stronger* than it was, by shrinking their argument surface to a market.

**Cons**

- Needs the `currentValue` split, which is the fiddliest part of the change and touches a public DTO's type.
- Adds a read to the signed-in debate render.

### Option 2 — a monotonic key discriminator (OQ-1 candidate 1)

**Pros**

- Preserves D-2's non-staleness guarantee exactly, and makes it monotone.
- No poster problem: any write advances the key, so a poster's own comment comes back for free — the same accident, made deliberate.

**Cons**

- **It is the defect, made rigorous.** A key that advances on every write misses on every write. It fixes ABA and keeps the cost profile that made ABA worth caring about.
- Costs a read or a column at the live-read site, on every render.

**Verdict:** Rejected. It optimises the guarantee this ADR is deliberately trading away, and pays for it with the miss rate this ADR exists to remove.

### Option 3 — bust `market:<id>` from the bet/sell path (OQ-1 candidate 2)

**Pros**

- Reuses the invalidation vocabulary ADR-0041 D-3/D-4 already ratifies.
- Conceptually simple: a pool-moving write is treated like a content-moving one.

**Cons**

- Invalidates exactly as often as the `reserves` key did, because every bet rides a comment. **Same miss rate, more code.**
- Reusing the `market:${id}` tag would also stop `getCachedReserveWalk` coalescing — collateral damage on a window that was already correct.
- `src/server/bets/` is CLAUDE.md §1 critical path, so it carries the full ritual for a change that buys nothing.

**Verdict:** Rejected on its merits, not on cost. See D-4.

### Option 4 — window only; the poster waits

**Pros**

- Much the smallest change; no new module, no new read, no type split for the poster half.

**Cons**

- The author gets **silence**, not lateness: `findPostedNode` returns `null`, so there is no card, no jump and no error for up to a window after a successful post.
- It would make the most noticeable interaction in the product worse in order to make an invisible one better.

**Verdict:** Rejected.

### Option 5 — optimistic render from the `place()` receipt

**Pros**

- No server cost at all, and the fastest possible feedback.

**Cons**

- **The codebase has already rejected it in writing.** `find-posted.ts` names three fields the receipt cannot supply: `ordinal` (a read-time rank over every top-level comment), `badge` (a full ADR-0017 ranking pass), and `entryPrice` (`price_at_bet`, the price *paid*; the receipt carries `newPrice`, the price *after*).
- **No jsdom test in this repo could catch any of the three being wrong**, so the defect would ship green and a confirmation showing a wrong ordinal teaches the author to distrust the surface.
- Forks a second card-construction path, and with it the masking guarantee `findPostedNode`'s return type currently enforces by construction (SC-1).

**Verdict:** Rejected. It is the option a reader reaches for first, which is why it is recorded at length.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.1 §9 *Refresh* | floored history, live edge | **Consumes** — extends the §9 mechanism from the price series to the two shared read blocks; the live-edge composition at each page is unchanged. |
| SPEC.1 §16.1 + Appendix B | `SHARED_VIEW_MIN_WINDOW_MS` | **Mints** — a new pinned design constant, registered same-commit, read from the constant at every call site and never inlined. |
| SPEC.1 INV-1 | bet ↔ comment atomicity | **Consumes** — INV-1 is *why* the reserves key accidentally carried a poster's comment back, and why a bet-path tag would invalidate on every comment. The invariant is untouched; `src/server/bets/` is not edited. |
| SPEC.1 INV-3 | side frozen at post-time | **Shapes (preserves)** — `side_at_post_time` is read fresh at derivation time and never derived from `reserves`, on either the cached or the bypassed path. |
| SPEC.1 INV-4 | resolutions append-only | **Shapes (preserves)** — no contact with `resolution_events` / `payout_events`. `withLiveTail` still leaves a non-`Open` series untouched on both callers. |
| CLAUDE.md §5.14 SC-1 | masking is a property of every body read | **Consumes** — `viewer-freshness.ts` reads `created_at` and no body, so there is nothing to mask; the bypass reaches `loadDebateView`, which applies `loadRemovedSet` inside itself, upstream of every DTO. Pinned by `cached-view-contract.test.ts`. |
| ADR-0025 | the `.md` export stays uncached | **Consumes** — unchanged and re-asserted; the export route still calls `loadDebateView` directly. |
| ADR-0041 D-2 | reserves as cache key | **Supersedes** — replaced by D-1/D-2 above. D-1, D-3, D-4, D-5 of that ADR stand. |
| ADR-0041 OQ-1 | the fee-less-CPMM ABA gap | **Closes** — dissolved rather than fixed: with no key equality there is nothing for ABA to defeat. |
| Tracker | CACHE-KEY-1 | Depends on this ADR being `accepted` before the PR carrying it merges. |

## More Information

- `src/server/discovery/cached-series.ts` — the sibling that was already correct, and whose docblock named this defect before it was fixed.
- `src/components/debate/find-posted.ts` — why a posted card is found and never reconstructed.
- ADR-0041 §OQ-1 — the open question this ADR closes, and the two candidate fixes it declines.

---

*ADR-0051 ratifies keying the two participant shared read blocks on market identity plus a `SHARED_VIEW_MIN_WINDOW_MS` window, moving the hero's Đ valuation outside the cache under a type that makes the step non-skippable, replacing the poster's accidental cache-key visibility with a bounded page-level bypass, and deferring cache instrumentation off the render path. The decision body and any constraints minted in §Decision Outcome are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
