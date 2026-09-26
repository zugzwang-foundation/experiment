# ADR-0055 — Discovery's Prices Ride a Five-Second Window

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-09-17 |
| **Deciders** | Hrishikesh M. H. |
| **Tracker task** | HARDEN — production load-test remediation, fix 5 |
| **Frame document** | SPEC.1 §9 *Refresh* + §16.1; SPEC.2 §9 |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | ADR-0051 — rider (1), "the hero's `currentValue` is computed OUTSIDE the cache from the live pool", and with it SPEC.1 §9's *"Nothing priced rides the window"*. The rest of ADR-0051 — the identity keying, the poster bypass, the `after()` instrumentation — stands unamended and is what this ADR relies on |
| **Amended-by** | — |

## Patch record

**P1 (2026-09-26, STAGING-DISCOVERY-DB).** In-place Patch record per CLAUDE.md §5.12 —
consumer-surface scoping, **not** supersession. **The decision is unchanged**: Discovery's pool
read still rides the five-second window, the per-market block its own window, and money stays
fresher than the content beside it. **Withdrawn:** the consequence *"the surface can prerender
and be CDN-served"*. On AWS the build and the running task read DIFFERENT databases
(`next build` gets Doppler's `DATABASE_URL` — Supabase — while ECS serves RDS), and a
prerendered Discovery baked the build's market ids into the page: every card then looked up
pricing and media under ids the runtime database does not hold, and showed `IMG` /
"Pricing unavailable" (staging, measured 2026-09-26: all six ids differed from `/m/[slug]`'s).
The runtime never repaired it, because the prerender also read the clock (`nowIso`) and failed
every re-prerender with "unstable value `Date.now()`". `DiscoveryContent` now opens with
`await connection()`, so it renders per request. **What the window buys changes, not whether
it is needed:** it no longer licenses a prerender; it keeps each request's render off the
database. `x-nextjs-prerender` on `/` is therefore no longer this ADR's check.

---

## Context and Problem Statement

Discovery (`/`) is the product's front page and its highest-traffic surface. Two of its
three reads were already cached; the third — the per-market pool read behind every card's
price, the hero chart's live tail and the hero's `Đ now` figure — was deliberately live on
every render. ADR-0051 ratified exactly that, on a rule SPEC.1 §9 states flatly:

> ⚠ **Nothing priced rides the window.** … A Đ amount on a public surface is never served
> from a window.

**That one uncached await was the whole cost.** Because every sibling read was cached, it
alone kept Discovery out of the prerender: the surface re-rendered, and took a database
connection, for every arrival. That matters here more than it would elsewhere — the
production load-test campaign established that **connection supply, not database work, is
the ceiling** (at 50 req/s on the market page: pool pinned at 53 of 60 while Postgres ran
1–3 queries).

### What the measurement actually showed, which is not what was expected

Measured on production at canary `d2af66cd`, 2026-09-17:

1. **`/` looked cached and was not.** `x-vercel-cache: HIT` with a climbing `age` suggested
   the page was CDN-served. It is the **PPR shell** that is cached. Two full responses three
   seconds apart differed in **exactly forty characters — every one of them a render-clock
   timestamp** from `withLiveTail`, with byte-identical prices on either side. The content
   re-renders per request; the live read was buying a figure that had not moved.
2. **⛔ `/m/[slug]` — the page where a bet is actually placed — already serves a cached
   price.** It returns `x-nextjs-prerender: 1` with `age: 47169`: **a thirteen-hour-old
   prerendered price**, corrected only by the client poll.

Point 2 is what decides this ADR. **The rule was not delivering what it appeared to
promise.** It governed *composition order* — the figure is computed outside the cached
block — and said nothing about the **page** being cached, which on `/m/[slug]` it is. So
the surface that takes money had a thirteen-hour price, while Discovery, where nobody can
bet, paid a live database read per visitor to be stricter. **The asymmetry, not the
freshness, was the defect.**

This ADR does **not** decide:

- ADR-0051's identity keying or poster bypass — untouched, and this change depends on them.
- `/m/[slug]`'s prerender-plus-poll freshness posture — pre-existing, unchanged, and now the
  benchmark Discovery is measured against rather than an oversight this ADR discovered.
- The bet path's own reads, which are transactional and never cached.
- Whether Discovery should gain a poll like `/m/[slug]`'s (it has none; deferred).

## Decision Drivers

1. **Connection supply is the measured ceiling.** A per-visitor read on the highest-traffic
   surface is the most expensive place to spend one.
2. **A freshness rule must be judged by what a reader actually receives**, not by where in
   the code the figure is composed.
3. **Discovery must not be less fresh than the surface it links to.** A price on the front
   page that is older than the same price one click away is a real defect — and is the one
   this change must not create while fixing the other.
4. **No visible change.** No layout shift, no flash, no figure that arrives late.
5. **Money stays exact.** Decimal strings end to end; a cache may not become a place where a
   `Decimal` silently becomes a float.

## Considered Options

1. **Window the pool read at 5 s** ← chosen
2. **Drop prices from the server render and fetch them client-side** — the other option the
   founder offered. Rejected on measurement rather than taste: it gives **every** visitor a
   request to the origin (worse than a windowed read that coalesces), needs a new read
   endpoint, and puts a flash-then-fill on the product's first impression. It buys freshness
   that `/m/[slug]` does not itself offer.
3. **Reuse `SHARED_VIEW_MIN_WINDOW_MS` (15 s)** — one fewer constant, and wrong: it is the
   *content* window, and matching it would make the price exactly as stale as the arguments
   beside it, discarding driver 3's ordering for tidiness.
4. **Leave it live and buy capacity instead** (Supabase tier bump). Rejected as the sole
   answer: it pays indefinitely for work the measurement shows is not needed, and the read
   was returning an unchanged figure.

## Decision Outcome

**Chosen: Option 1.** `getCachedDiscoveryPricing` (`src/server/discovery/cached-pricing.ts`)
wraps the existing batched pool read in `'use cache'` with
`cacheLife({ stale: 5, revalidate: 5, expire: DISCOVERY_PRICE_EXPIRE_SEC })`.

1. **`DISCOVERY_PRICE_MIN_WINDOW_MS = 5000`** — **not a performance dial.** It is the largest
   lag that keeps Discovery strictly fresher than `SHARED_VIEW_MIN_WINDOW_MS` (15 s), the
   content window beside it, and it is a rounding error against the thirteen hours the
   betting page serves. A guard pins the ordering, so a later retune that inverts it reddens
   a test rather than the front page.
2. **`DISCOVERY_PRICE_EXPIRE_SEC = 30`** — the stale-serving ceiling, deliberately *not*
   `SHARED_VIEW_EXPIRE_SEC` (60) and not `cached-series.ts`'s `window × 60` ratio, which
   would hand a 5 s window a 300 s ceiling. This entry holds a price, so its ceiling is the
   number that bounds how wrong the front page can be.
3. **No `cacheTag`.** A tag exists to be busted, and the only event that moves a price is a
   bet — so tagging this would fire `revalidateTag` from the bet path, invalidating on
   exactly the traffic that makes the cache worth having. **That is the CACHE-KEY-1 defect
   reintroduced one layer down**, and refusing it is the point. The window coalesces and
   expires on its own.
4. **No database client in the signature.** A `'use cache'` key *is* the argument list, so a
   client parameter would put a connection object in a cache key. The uncached
   `getMarketPricingAndReservesBatch` keeps its client for `/m/[slug]`, which reads inside a
   transaction; the wrapper binds module-level `db` precisely because it must not.
5. **Returns an array of pairs, not a `Map`.** The value crosses a serialisation boundary;
   pairs of plain decimal strings are obviously safe across one, where relying on `Map`
   support would make correctness a property of the framework's serialiser. The page rebuilds
   the `Map`.
6. **`HeroTopPostsBase` keeps omitting `currentValue`.** ADR-0051's type-level enforcement
   stands — its *reason* changes. It is no longer "this figure must be live"; it is that
   `currentValue` must stay off the cache **key**, which is the half of ADR-0051 that is
   entirely unaffected.

## Consequences

**Good.** Every read on Discovery is now cached, so the surface can prerender and be
CDN-served like `/m/[slug]`. The per-visitor connection on the busiest page goes away —
directly against the measured ceiling. No visible change: no layout shift, no late figure.

**Bad, and accepted.** A price on Discovery may be up to 5 s old, and up to 30 s during a
revalidation. SPEC.1 §9's flat "never" becomes a bounded "not more than", which is a real
weakening of a stated guarantee even though it leaves Discovery far fresher than the page it
links to.

**Neutral.** One more cached entry, keyed on the market-id list, expiring on its own.

## Verification

- `tests/server/discovery/round-trip-budget.test.ts` — two new cases, and the mutants they
  kill were **run, not asserted** (three applied, three killed, zero survivors):

| Mutant | Effect | Killed by |
|---|---|---|
| page reverts to `getMarketPricingAndReservesBatch` | per-visitor read restored | `the page no longer performs the uncached pool read` |
| `"use cache"` removed from the wrapper | the whole change becomes a rename | `the pool read is windowed…` |
| `DISCOVERY_PRICE_MIN_WINDOW_MS` raised to 20 s | front page staler than the betting page | `the pool read is windowed…` (ordering assertion) |

- **Guards INVERTED, not deleted.** R3's boundary test was literally named *"price/reserves
  never cached"*. It is re-scoped to what it still protects — `pricing` comes from the pool
  read and never from `getCachedMarketDiscoveryData`, which carries no price and would be
  wrong at any freshness — rather than retired.
- `live-tail-wiring.test.ts` moves from a shared-prefix match to a **per-surface** name. The
  looser match was the wrong repair: this guard already shipped red once, when T-03 batched
  Discovery while the line still pinned the singular form, and was unavailable for that whole
  branch.
- Discovery suites return to **exactly** the pre-change baseline (29 failures, all
  ECONNREFUSED without a local Postgres — measured by stashing, both before and after).

⚠ **NOT VERIFIED LOCALLY, and this is the honest gap:** that `/` actually becomes
CDN-served. `next build` cannot prerender it without a database, which is the same reason
the local build already failed on this route before this change. **The check is a production
header read after deploy** — `x-nextjs-prerender: 1` on `/`, as `/m/[slug]` already returns —
and until that is done, this ADR's central claim is argued rather than measured (`O-13`).

## Links

- ADR-0051 — CACHE-KEY-1, amended in rider (1) only.
- SPEC.1 §9 *Refresh* + §16.1 — amended in this commit.

---

*ADR-0055 puts Discovery's pool read behind a five-second window, on the finding that the page
which actually takes bets was already serving a thirteen-hour-old prerendered price while the
front page paid a live database read per visitor to be stricter. The decision body and any
constraints minted in §Decision Outcome are immutable; superseding requires a new ADR with a
same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
