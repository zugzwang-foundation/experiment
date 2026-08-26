# ADR-0041 — Cache Components, Reserves-Keyed Participant Caching, and Immediate-Expiration Invalidation

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-08-26 |
| **Deciders** | Hrishikesh (founder) |
| **Tracker task** | S-4 (read-path collapse, Phases A–F) |
| **Frame document** | SPEC.2 §4.3 (this ADR's same-commit rider, 1.0.26) · CLAUDE.md §5.14 SC-1 (masking is a property of every read over `comments.body`) · CLAUDE.md §3 (no live in-product K_eff surface — unaffected, noted for completeness) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

S-4 enabled Next.js Cache Components (`cacheComponents: true`, Next bumped 16.2.4 → 16.3.2) and put `"use cache"` on both participant-facing read paths — `src/server/discovery/list.ts` (`getCachedDiscoveryMarketIds`, `getCachedMarketDiscoveryData`) and `src/server/debate-view/cached-view.ts` (`getCachedDebateView`) — collapsing the debate view's per-tick cost from twelve-to-fourteen sequential database round-trips to two (signed-out) or ten (signed-in). None of this had a durable decision record: it shipped across six session logs (`docs/logs/S4-PHASE-*.md`) and a scale-target ADR (ADR-0038) that doesn't mention caching, with the architecture's own author flagging in a source comment that R3 compliance was "Awaiting the Gate C ruling."

Gate C (this repo's pre-merge review gate, CLAUDE.md §5.10 for critical-path work, exercised here via `@code-reviewer` + `@security-auditor` run independently against the diff) found the unrecorded state was not merely undocumented — one part of it was wrong. `src/server/admin/moderation/act.ts`'s removal path called `revalidateTag(tag, "max")`, which does not evict a cache entry: measured directly against the installed `next@16.3.2` cache handler, a `"max"`-profiled call marks the tag stale with a 365-day expiry and the handler keeps serving the pre-invalidation entry. A moderator clicking Remove on illegal or abusive content did not stop that content's body, teaser, author pseudonym, or presigned image URL from being served by `getCachedDebateView`/`getCachedMarketDiscoveryData` — the exact failure mode CLAUDE.md §5.14 SC-1 exists to catch, undetected because the regression test asserting the invalidation call's shape (`tests/server/debate-view/cached-view-contract.test.ts`) required the literal `"max"` string on a false premise (that omitting a cache profile throws a runtime error under Cache Components; it does not — Next emits a deprecation warning and proceeds with the correct immediate expiration).

This ADR records, as one decision, both halves: the architecture that was already shipping unrecorded, and the invalidation-strength fix Gate C required before it could ship correctly. Both `@code-reviewer` and `@security-auditor`, run independently, verified the architecture's core safety property directly rather than from its docstrings: neither cached function's transitive call graph (54 files, walked mechanically by the security audit) reads a session, `headers()`, `cookies()`, or any per-viewer field — the two caches genuinely share nothing viewer-scoped.

This ADR does **not** decide:

- **The masking mechanism itself** — pre-commit gating (ADR-0014), reactive removal and `content_removed` decoupling (ADR-0021). Masking behaviour is *consumed* here; this ADR fixes how fast an invalidation of it takes effect, not what it decides.
- **Viewer-scoped debate reads' placement** (ADR-0034). `loadViewerMarketContext` stays outside both cached functions by construction; this ADR relies on that guarantee, does not restate it.
- **The debate `.md` export's caching posture** (ADR-0025). The export calls `loadDebateView` directly, uncached, and this ADR changes nothing about that boundary.
- **The specific `cacheLife` durations** (`stale: 300, revalidate: 60, expire: 3600` for the `"minutes"` profile) — these are Next's own named-profile defaults, not a project choice; this ADR consumes them as given.
- **Whether `_lib/session.ts`'s placement outside `src/server/` should become a standing exception to AGENTS.md §3, or a one-off** — recorded here as what shipped and why, with the scheduling reason stated; a future ADR may generalise or reverse it.

## Decision Drivers

1. **A cache-invalidation call that doesn't evict is a masking-control failure, not a performance nit.** CLAUDE.md §5.14 SC-1 treats every read over `comments.body` as safety-critical; an invalidation mechanism for that read inherits the same weight.
2. **Structural verification over docstring trust.** Both reviewer passes traced the actual call graph and the actual compiled/runtime cache-key and invalidation code rather than accepting comments' claims — the CRITICAL finding exists precisely because a comment's claim ("must not keep serving a removed post") and the code's behavior had diverged silently.
3. **R3 v2's staleness guarantee must be provable from the artifact, not asserted in prose.** `getCachedDebateView(market, reserves)` and `getCachedMarketDiscoveryData(marketId, reserves)` both discard or partially discard `reserves` in their bodies (`void reserves` in the debate-view case) — the guarantee that a cache hit can only occur when reserves are unchanged rests entirely on Next's `"use cache"` mechanism including the full received argument list in its key, which this ADR verifies from the compiled build and Next's own runtime source rather than from the function's docstring.
4. **Invalidation strength must be legal from every calling context, not just today's caller.** `updateTag` throws outside a Server Action; `closeMarket`/`openMarket`/`voidMarket`'s engine functions are `server-only`, not themselves Server Actions, and `closeDueMarkets` is called directly from a Route Handler (`api/cron/close-due-markets`) — a mechanism that happens to work because of who calls it today is a landmine for whoever adds the next caller.
5. **Cost matters and is measured, not felt.** S-4's whole premise is that the debate view's per-tick cost was too high; this ADR's tag vocabulary and cache-key design are what make the collapse safe, so they're pinned alongside the cost figures they justify.
6. **The scheduling conflict that put `_lib/session.ts` outside `src/server/` is real and should be recorded as a reason, not left to be re-derived.** S-3 was concurrently live in `src/server/auth/` during S-4; the dedup helper imports `auth` but does not modify it, and living beside its call sites in `(public)/` avoided a diff collision with a stratum on the same schedule.

## Considered Options

**For the invalidation mechanism specifically** (the part Gate C's finding forced a decision on):

1. **`updateTag` where legal (Server Actions), `revalidateTag(tag, { expire: 0 })` everywhere else, never a named profile string for a removal-class invalidation** ← chosen
2. Keep `revalidateTag(tag, "max")` — the pre-Gate-C state
3. `revalidateTag(tag)` with no profile everywhere, including from Route Handlers
4. A custom cache handler with its own immediate-eviction API

## Decision Outcome

**Chosen: Option 1 — Cache Components is ratified as-shipped for its architecture (cache-key design, tag vocabulary, session-dedup placement), with the invalidation-strength defect corrected as part of the same decision.**

### D-1 · `cacheComponents` and `"use cache"` are ratified on both participant read surfaces

`next.config.ts`'s `cacheComponents: true` and the `"use cache"` directive on `getCachedDiscoveryMarketIds`, `getCachedMarketDiscoveryData` (`src/server/discovery/list.ts`), and `getCachedDebateView` (`src/server/debate-view/cached-view.ts`) are the shipped, ratified mechanism for the participant read-path cost reduction S-4 set out to achieve. `loadDebateView` and `listOpenMarkets`'s non-cached forms are unaffected in signature; the `.md` export (ADR-0025) continues to call `loadDebateView` directly and uncached, by design — a `'use cache'` directive was deliberately never placed on `loadDebateView` itself, exactly so the export could not silently inherit a cache it is contractually forbidden from having.

### D-2 · `reserves` as cache key — R3 v2, ratified

**Price and pool reserves are never served at a value the pool does not currently hold.** Both cached functions take `reserves` as an explicit parameter and key on it: `getCachedDebateView(market, reserves)` and `getCachedMarketDiscoveryData(marketId, reserves)`. A cache hit is possible only when the live reserves are **provably equal to a previously observed value** — the one that generated the entry — which is a stronger guarantee than a TTL, because it keys on the value that actually determines price rather than on elapsed time. **This is compliance with R3 v2, not an exception to it.**

⚠ **"Provably equal to a previously observed value" is strictly weaker than "the pool has not moved since the entry was generated", and this section asserted the latter until the re-audit that added this paragraph.** The stronger claim does not follow from key equality. This repo's CPMM is **fee-less** (`src/server/cpmm/`, lifted from Manifold; single-MM, no fee term), so a buy followed by a sell-back of the same shares returns the pool to the *exact* prior 18-dp reserve pair — call it A → B → A. The key then matches an entry generated before those two bets existed. **Price and `currentValue` stay correct under that path**, because both are pure functions of `reserves` and `reserves` is what matched. **The rest of the cached block does not:** every bet rides a comment (INV-1), so an A → B → A round trip mints comment rows, moves ranking, and moves totals — all of which the matched entry predates and none of which are in the key. Tracked as **OQ-1** below. **Not fixed in this ADR**, and deliberately so: the fix is a separate ruled task, and recording the true strength of the guarantee is a prerequisite for choosing between its candidate forms rather than a substitute for doing so.

Verified from the compiled build, not the docstring: `just clean && ZUGZWANG_ENV=preview just build`, then reading the generated `"use cache"` wrapper directly out of `.next/server/chunks/ssr/` for both functions, showed both call `Array.prototype.slice.call(arguments, 0, 2)` — capturing both arguments regardless of whether the function body reads the second one — and traced that array into Next's `cache()` runtime (`node_modules/next/.../use-cache/use-cache-wrapper.js:1094`, `:1494-1504`): `cacheKeyParts = [buildId, id, args]`, the *entire* received argument array, serialized via React's `encodeReply` into the key unconditionally. Next's `"use cache"` mechanism has no concept of an unused argument — it keys on the full received list. `getCachedDebateView`'s `reserves` parameter is discarded in its body (`void reserves`, the value exists purely to key the cache); `getCachedMarketDiscoveryData`'s is read (`selectHeroTopPosts`'s `currentValue`). Both are correctly keyed regardless.

`/m/[slug]/page.tsx` additionally overrides `model.market.pricing`/`unitToWin` with a live read (`getMarketPricingAndReserves`) taken from the *same* `reserves` value used to key the cache, immediately after the cached call — on a hit the two are mathematically identical (same pure function, same reserves, guaranteed by the key match); the override exists so that identity is an explicit assignment at the call site rather than an implicit property of the cache key nobody reading the page can see (Gate C HIGH finding, fixed same-commit as this ADR).

### D-3 · The tag vocabulary

Two tags, both market-scoped or listing-scoped, never per-viewer:

| Tag | Set by | Busted by | Scope |
|---|---|---|---|
| `discovery` | `getCachedDiscoveryMarketIds` | `openMarket`, `closeMarket`, `voidMarket` | The Open-market listing set |
| `market:<id>` | `getCachedDebateView`, `getCachedMarketDiscoveryData` | `moderateComment` (remove only) | One market's content |

A lifecycle transition (`Open`/`Closed`/`Resolved`/`Voided`) additionally auto-misses `getCachedDebateView` because `market.status` rides its cache key directly — no tag needed for that case. `market:<id>` exists specifically for the one mutation that changes neither reserves nor status: a moderator removing content.

### D-4 · Invalidation is immediate-expiration, never a named profile — the corrected half

**Gate C CRITICAL, fixed as part of this decision.** `revalidateTag(tag, "max")` does not evict — Next's `"max"` profile resolves to `{ expire: 31536000 }` (365 days); the shipped default cache handler's `updateTags` sets `stale: now, expired: now + 31536000_000` from that, and `areTagsExpired` (which gates eviction) requires `expiredAt <= now` — a year in the future never satisfies that, so the handler serves the stale entry and only schedules a background revalidation. Verified empirically against the installed `next@16.3.2` handler: a `"max"`-profiled `updateTags` call, followed by a read, returned the pre-invalidation body.

Two forms are ratified, chosen per calling context rather than uniformly:

- **`updateTag(tag)`** — no profile argument, immediate expiration by construction — where the call site **is itself a Server Action** (`"use server"` at the top of the file, the exported function IS the action). `moderateComment` in `src/server/admin/moderation/act.ts` qualifies; its removal path uses `updateTag(\`market:${comment.marketId}\`)`.
- **`revalidateTag(tag, { expire: 0 })`** — an explicit zero-second expire, which the cache handler treats as immediate eviction with no `durations` ambiguity — where the call site is a **shared, `server-only` engine function that is not itself a Server Action** and cannot assume its calling context. `closeMarket`/`closeDueMarkets` (`src/server/markets/close.ts`) is called both from a Server Action (`closeMarketAction`) and directly from a Route Handler (`api/cron/close-due-markets/route.ts`); `updateTag` throws outside a Server Action (`workStore.page.endsWith('/route')` check in Next's own `updateTag` implementation), so `close.ts` cannot use it. `openMarket` (`src/server/markets/open.ts`) has only one production caller today (`seedPoolAction`, itself a Server Action) but is architecturally the same class of function as `close.ts` — `server-only`, not `"use server"` — so it takes the same form rather than relying on today's one caller staying its only one. `voidMarket`'s admin wrapper (`voidMarketAction` in `src/server/admin/markets/void.ts`, added same-commit as this ADR — see D-6) matches the same form for consistency across all three Open-set-changing transitions, even though `voidMarketAction` is itself a Server Action and could legally use `updateTag`.

**The literal string `"max"` — or any named `cacheLife` profile — is never a legal second argument to a removal- or set-change-invalidating `revalidateTag`/`updateTag` call in this codebase from this ADR forward.** A named profile is for *setting* a cache's lifetime going forward (as `cacheLife("minutes")` already does inside the two `"use cache"` functions themselves); it is never the right tool for *invalidating* one now.

### D-5 · `_lib/session.ts` — placed outside `src/server/`, by schedule not by architecture

`src/app/(public)/_lib/session.ts` exports `getRequestSession`, a `React.cache()`-memoized wrapper around `auth.api.getSession` that collapses the layout's and each page's separate session reads into one per request — the mechanism behind D-2's cost figures on the signed-in path. It imports `auth` from `@/server/auth` but does not modify it, and it lives beside its three call sites (`(public)/layout.tsx`, `m/[slug]/page.tsx`, `u/[pseudonym]/page.tsx`) rather than under `src/server/` (AGENTS.md §3's stated home for server-side logic), because `src/server/auth/` was concurrently live under the S-3 stratum on the same build schedule, and a diff there would have collided with work in flight. This is recorded as the actual reason — a scheduling one — not an architectural ruling that server-side session logic belongs outside `src/server/` going forward. A future ADR may fold it in or ratify the split permanently; this ADR does neither.

### D-6 · What ships same-commit with this ADR

The Gate C CRITICAL and its adjacent findings are fixed in the same commit that mints this ADR, not deferred:

- `src/server/admin/moderation/act.ts` — `revalidateTag(tag, "max")` → `updateTag(tag)` (D-4).
- `src/server/markets/close.ts`, `src/server/markets/open.ts` — `revalidateTag("discovery", "max")` → `revalidateTag("discovery", { expire: 0 })` (D-4).
- `src/server/admin/markets/void.ts` — new `revalidateTag("discovery", { expire: 0 })` after `voidMarket` succeeds. `voidMarket` itself (`src/server/resolution/void.ts`, a CLAUDE.md §1 critical-path file) is **not** touched — `Open → Voided` is a legal direct transition that never passes through `closeMarket`'s existing bust, and the fix is placed in the non-critical-path admin action wrapper alongside its two existing `revalidatePath` calls, which already establish that this wrapper owns "notify the UI of state change," not the engine function.
- `src/app/(public)/m/[slug]/page.tsx` — the `priced.pricing`/`priced.unitToWin` override onto the cached model (D-2), and its docblock corrected to state the actual mechanism rather than its pre-fix claim.
- `src/server/debate-view/market-pricing.ts` — `getMarketPricingAndReserves` extended to also return `unitToWin` (same pool read, one more derived field, no new round-trip), so the page override above needs no second query.
- `src/server/discovery/media.ts`, `src/server/discovery/hero.ts`, `src/server/debate-view/load-debate-view.ts` — `READ_URL_TTL_SECONDS` 3600 → 7200. A presigned-URL TTL equal to `cacheLife("minutes").expire` (3600 s) let an entry served at the edge of its cache lifetime carry already-expired image URLs, silently, with no error and no failing test. 7200 s (2×) covers the full worst-case serve age plus render/fetch latency while keeping the TTL short relative to a day/week, holding D9's original short-TTL intent.
- `tests/server/debate-view/cached-view-contract.test.ts` — the test that pinned the defect (requiring the literal `"max"` on the false premise that omitting a profile throws under Cache Components) rewritten to assert the D-4 immediate-expiration forms instead, never deleted.
- `docs/specs/SPEC.2.md` §4.3 — same-commit rider (1.0.26) correcting the 1.0.22 row's `force-dynamic`/twelve-to-fourteen-round-trip claims to `instant = false`/the D-2-collapsed cost.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| The Discovery-surface cache boundary | `src/server/discovery/list.ts` |
| The debate-view cache boundary | `src/server/debate-view/cached-view.ts` |
| The tag vocabulary (D-3) | Both files above; consumers never mint a new tag string, they cite these two |
| Immediate-expiration invalidation (D-4) | `src/server/admin/moderation/act.ts` (`updateTag` form), `src/server/markets/close.ts` (`revalidateTag(tag,{expire:0})` form) |
| The request-scoped session dedup | `src/app/(public)/_lib/session.ts` |
| The R3 v2 cache-key proof | This ADR, D-2 — re-derive from the compiled build if the mechanism is ever doubted; do not trust a docstring restating it |

## Consequences

### Positive

- **A silent content-safety failure is closed, not just documented.** The removal path now demonstrably evicts — the same class of proof (running the shipped handler directly) that found the defect is what confirms the fix.
- **R3 v2's guarantee is now provable from the artifact.** Any future doubt about whether `reserves` actually keys the cache has a re-derivation path (D-2) rather than a docstring to trust.
- **The invalidation form is chosen per calling context, not copied uniformly** — `close.ts`/`open.ts`'s shared-function status is respected rather than assumed away by "it happens to work today."
- **The debate view's cost collapse (twelve-to-fourteen → two/ten round-trips) is finally load-bearing on a decision record**, not six session logs and a source comment awaiting a ruling that hadn't happened.
- **`voidMarket`'s critical-path status is respected, not routed around** — the fix landed in the wrapper that already owns UI-notification responsibility, with zero diff to `src/server/resolution/`.
- **A presigned-URL silent-breakage class (TTL == cache expire) is closed** alongside the invalidation fix, in the same pass that was already auditing every cache-adjacent constant.

### Negative

- **Two invalidation forms instead of one, and a future call site must know which applies.** *Mitigated by:* D-4's explicit rule (Server Action → `updateTag`; shared engine function → `revalidateTag(tag, {expire:0})`) and the file map above.
- **`_lib/session.ts`'s placement outside `src/server/` is a real deviation from AGENTS.md §3, recorded but not resolved.** *Mitigated by:* D-5 stating the reason is scheduling, not architecture, so a future pass can fold it in without re-deriving why it happened.
- **The `"use cache"` internal computation inside `loadDebateView` (pricing/`unitToWin` via `getMarketPricingAndUnitToWin`) is now partially redundant with the page-level override** — two code paths compute the same value, one of which is always discarded on `/m/[slug]`. *Acceptable because:* removing the internal computation would touch the cached function's return shape, which the price chart's terminal stamp and other consumers depend on; the override is the cheap fix, not the invasive one.
- **This ADR ratifies architecture that shipped six phases before it was written**, which is a governance-order cost regardless of the content being correct. *Mitigated by:* nothing about the shipped architecture is being changed by this ADR except D-4 — it is being recorded, and the one part that needed changing is fixed same-commit rather than deferred further.

### Neutral

- The `discovery` tag's own invalidation (D-3/D-4) covers the listing set only — an individual market's content changes ride `market:<id>` exclusively, by design (D-3); this ADR does not merge the two tags and does not create a "bust everything" path.
- `cacheLife("minutes")`'s specific durations (`stale: 300, revalidate: 60, expire: 3600`) are Next's own named-profile values, consumed as-is; this ADR does not tune them.

## Pros and Cons of the Options

### Option 1 — `updateTag` where legal, `revalidateTag(tag, {expire:0})` elsewhere, never a named profile (chosen)

**Pros**

- Matches Next's own documented guidance (`updateTag`'s error message names `revalidateTag` as the Route-Handler-safe alternative).
- `{ expire: 0 }` is unambiguous — no `durations` branch, no profile-name indirection to get wrong a second time.
- Chosen per actual calling context (D-4), not per convenience.

**Cons**

- Two forms to remember instead of one.

### Option 2 — Keep `revalidateTag(tag, "max")` (the pre-Gate-C state)

**Pros**

- No code change.

**Cons**

- Does not evict. This is the defect itself, not a real option — kept here only because the template requires showing what was rejected and why.

**Verdict:** Rejected. Proven non-functional against the shipped handler.

### Option 3 — `revalidateTag(tag)` with no profile, uniformly, including from Route Handlers

**Pros**

- One form everywhere, no branching on caller type.

**Cons**

- `updateTag` is the framework-preferred form specifically for Server Actions (it also marks `pathWasRevalidated`, giving read-your-own-writes, which a bare `revalidateTag` does not); using `revalidateTag` uniformly gives up that property where it's free to have.
- Does not resolve the `close.ts`/Route-Handler legality question — a bare `revalidateTag(tag)` with no profile does correctly evict, but the uniform-everywhere framing was rejected in favor of using the strongest correct tool at each site.

**Verdict:** Rejected. Correct on eviction, but discards a free correctness property (`pathWasRevalidated`) at the one call site (`act.ts`) that is genuinely a Server Action.

### Option 4 — A custom cache handler with its own immediate-eviction API

**Pros**

- Full control over eviction semantics, independent of Next's profile-string API entirely.

**Cons**

- A new piece of infrastructure to build, test, and operate, to solve a problem Next's own public API (`updateTag` / `revalidateTag(tag, {expire:0})`) already solves correctly.
- No `cacheHandlers` entry exists in `next.config.ts` today (checked); introducing one is a materially larger change than this ADR's scope.

**Verdict:** Rejected. Solves a problem that doesn't require new infrastructure.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| CLAUDE.md §5.14 SC-1 | masking is a property of every `comments.body` read | **Consumes** — D-4 makes the removal-path invalidation actually take effect, closing the gap between the masking gate (sound at generation time) and cache serving (unsound before this ADR). |
| ADR-0021 / ADR-0014 | `content_removed` reactive masking | **Consumes** — masking decisions themselves are unchanged; this ADR governs only how fast a cache reflects one. |
| ADR-0025 | `.md` export bound to `loadDebateView`'s uncached signature | **Consumes** — D-1 explicitly preserves the boundary; `getCachedDebateView` is a separate wrapper file for exactly this reason. |
| ADR-0034 | viewer-scoped debate reads live outside `DebateViewModel` | **Consumes** — both cached functions' viewer-independence (D-1) relies on ADR-0034's guarantee holding; this ADR does not restate or re-verify ADR-0034's own proof, only confirms neither new cached function violates it (verified independently by both reviewer passes). |
| AGENTS.md §3 | server-side logic lives under `src/server/` | **Shapes (deviation recorded)** — D-5 documents `_lib/session.ts`'s placement as a scheduling exception, not a new rule. |
| SPEC.2 §4.3 | `/m/[slug]` dynamism and per-tick cost | **Mints (same-commit rider, 1.0.26)** — corrects the 1.0.22 row's `force-dynamic`/twelve-to-fourteen claims to `instant = false`/the D-2 cost figures. |
| SPEC.1 INV-1 | mandatory commentary / bet↔comment atomicity | **Shapes (preserves)** — no cache boundary touches the bet or comment write transaction; caching is read-side only. |
| SPEC.1 INV-2 | Dharma non-transferable | **Shapes (preserves)** — no `dharma_ledger` write in any file this ADR covers. |
| SPEC.1 INV-3 | side frozen at post-time | **Shapes (preserves)** — `comments.side_at_post_time` is read fresh at cache-generation time, never derived from `reserves` or any cached value. |
| SPEC.1 INV-4 | resolutions append-only | **Shapes (preserves)** — no `resolution_events`/`payout_events` contact from any cache or invalidation call site. |
| Tracker | S-4 (Phases A–F), Gate C close-out | All depend on this ADR being `accepted` before the PR carrying it merges. |

## Open questions

### OQ-1 · ABA — a fee-less CPMM can return the cache key to a previously observed value

**Status: OPEN. Named here, deliberately not fixed in this ADR.**

**The finding.** D-2's guarantee is *key equality*, which proves the live reserves are **equal to a previously observed value** — not that no bet has intervened. On a fee-less CPMM those are different statements. A buy of *n* shares followed by a sell-back of the same *n* shares returns both reserves to their exact prior `NUMERIC(38,18)` values, so the round trip is **invisible to the key**. The entry that matches was generated before either bet existed.

**What is and is not affected.** Everything in the cached block that is a pure function of `reserves` is unaffected and stays correct: `pricing` (`getPrices`), `unitToWin` (`deriveUnitToWin`), and `topPosts[].currentValue` (`computeSell`). Everything else in the block is affected, because it is keyed only *indirectly* — via the assumption that reserves move whenever content does:

| Cached datum | Affected by ABA? | Why |
|---|---|---|
| `pricing`, `unitToWin` | No | Pure functions of the matched `reserves` |
| `topPosts[].currentValue` | No | `computeSell(reserves, …)`, same |
| Comments / replies | **Yes** | Every bet rides a comment (INV-1) — the round trip mints two rows the matched entry predates |
| Ranking order | **Yes** | Ranking reads the comment set and stake distribution, both moved by the round trip |
| Totals | **Yes** | Volume/participant counts moved by the round trip |

**Severity is bounded but not zero.** The window is one `cacheLife("minutes")` lifetime (`expire: 3600`), it requires a same-market round trip that exactly restores both reserves, and content removal still busts `market:<id>` independently (D-3/D-4), so this is **not** a masking or content-safety hole — a removed body does not become reachable through it. It is a freshness hole: a reader can miss two just-posted arguments.

**Two candidate fixes, neither chosen here:**

1. **A monotonic key discriminator.** Add a strictly-increasing per-market value to the cache key alongside `reserves` — a comment/bet sequence number, a `max(created_at)`, or a per-market counter — so that any write advances the key even when reserves return. Keeps the reserves-keying design intact and makes it monotone; costs one more read (or one more column on an existing read) at the live-read site.
2. **Bust `market:<id>` on every bet and sell.** Treat a pool-moving write like a content-moving one and fire the D-4 immediate-expiration invalidation from the bet/sell path, rather than relying on the key to notice. Simpler to reason about and reuses the invalidation vocabulary this ADR already ratifies; costs an invalidation on the hot write path, and the call sites (`src/server/bets/`) are CLAUDE.md §1 critical path, so it carries the full ritual.

**Ruling needed on:** which of the two, and whether the freshness window is acceptable in the interim. **Not to be attempted as part of the PR carrying this ADR** — it is a separately ruled task.

## More Information

- **Ground:** `Ritam` @ `94d1897e0a236140ef765084181859a9f9a1562e` (PR #405), verified against `origin/main` @ `c49138d218c4a30ab12f1a5a9ef98a76b77d519b`. ADR ceiling verified at mint: highest file `0040`; `0002` and `0012` unused; next free is **0041**, confirmed via `ls docs/adr/` on the live tree, not from memory or SPEC.2's banner (which reads a stale `0039` at time of writing — O-2 applies to reading this ADR's own citations too, not only to writing them).
- **Gate C record:** `@code-reviewer` and `@security-auditor`, run independently against `git diff origin/main...Ritam -- src/ next.config.ts`, both found the `revalidateTag(tag, "max")` defect (D-4) without shared context; `@security-auditor` additionally answered, as a separately-stated mandated point, that no viewer-scoped data enters either cached segment — traced via a 54-file mechanical import-closure walk, not asserted from either function's docstring.
- **Code at ground (pre-fix, for the defect this ADR corrects):** `src/server/admin/moderation/act.ts:137` · `src/server/markets/close.ts:100` · `src/server/markets/open.ts:138` · `tests/server/debate-view/cached-view-contract.test.ts:289-304`.
- **Code at ground (architecture this ADR ratifies):** `src/server/discovery/list.ts:120-133`, `:170-215` · `src/server/debate-view/cached-view.ts` · `src/app/(public)/_lib/session.ts` · `next.config.ts` (`cacheComponents: true`).
- **Related plans/logs:** `docs/logs/S4-PHASE-B.md`, `S4-PHASE-C.md`, `S4-PHASE-D.md`, `S4-PHASE-E.md`, `S4-PHASE-E-warm-path.md`, `S4-CLOSE-OUT.md`, `S4-SESSION-SUMMARY.md` — the session-log record this ADR promotes into a durable decision.
- **Vendor reference:** Next.js `"use cache"` / `cacheLife` / `cacheTag` / `revalidateTag` / `updateTag` — <https://nextjs.org/docs/app/api-reference/functions/updateTag>, <https://nextjs.org/docs/app/api-reference/functions/revalidateTag>. Behavior in this ADR is verified against the installed `next@16.3.2` package source directly (`node_modules/next/dist/server/...`), not the docs, per O-2's "verify against the live repo" discipline extended to vendored code.

---

*ADR-0041 ratifies Cache Components and `"use cache"` on the Discovery and debate-view participant read surfaces, with reserves-keyed cache entries proving R3 v2's staleness guarantee from the compiled artifact rather than from prose, a two-tag invalidation vocabulary (`discovery`, `market:<id>`), and immediate-expiration invalidation (`updateTag` from Server Actions, `revalidateTag(tag, { expire: 0 })` from shared engine functions) as the only legal forms — replacing the non-evicting `revalidateTag(tag, "max")` this ADR's own Gate C review found and fixed same-commit. The decision body and the constraints minted in D-1 … D-6 are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
