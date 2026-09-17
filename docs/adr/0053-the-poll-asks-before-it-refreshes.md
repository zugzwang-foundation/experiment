# ADR-0053 — The Poll Asks Before It Refreshes

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-09-17 |
| **Deciders** | Hrishikesh (founder) |
| **Tracker task** | R2-CHEAP-POLL (the load programme's highest-leverage open item) |
| **Frame document** | SPEC.1 §9 F-DEBATE-4 (the polled-on-view refresh) · SPEC.2 §4.3 (Route Handlers catalogue) · ADR-0034 D-1/D-2/D-4 · ADR-0051 |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | SPEC.1 §9 F-DEBATE-4 and SPEC.2 §4.3 — the poll may now consult ONE content-free endpoint before re-invoking the page read. The read path it re-invokes on a change is unchanged. |
| **Amended-by** | — |

---

## Context and Problem Statement

Production broke on launch day and again under test on 2026-09-16, both times for the same reason, and the measurement is unambiguous: **the site runs out of database connections while the database itself is idle.**

Measured on production, 2026-09-16, market page `/m/chess-fide-tiebreak-response`:

| Offered | Success | p95 | Connections | Postgres active |
|---|---|---|---|---|
| 25 req/s | 99.75% | 478 ms | — | — |
| 50 req/s | 94.21% | 9,772 ms | pinned at 53 of 60 | **1-3 queries** |

The pool tops out at 53 of `max_connections` 60 and never grows. When it is full, requests queue for a slot and give up; 79 got no answer at all. Postgres was running one to three queries throughout. **Connection supply is the ceiling, not database work.**

What consumes that supply is people who are doing nothing. `DebatePoll` called `router.refresh()` every 30 seconds per open tab, unconditionally, which re-invokes the whole `/m/[slug]` read path: roughly five uncached queries and ~250 ms of CPU, holding a pooled connection for the duration. At 3,000 concurrent viewers that is ~100 renders/s and ~500 queries/s **before a single person loads a page or places a bet**. The page's own measured ceiling is 25 renders/s.

So the poll was spending the exact resource the site ran out of, on readers for whom nothing had changed.

⚠ **The 30-second interval and the idle cutoff were already tuned and are not the problem.** POLL-IDLE (SPEC.1 2.0.4) stops the poll for an absent reader; this ADR is about the reader who is present and watching a market where nothing is happening, which is the overwhelmingly common case.

This ADR does **not** decide:

- The connection ceiling itself. Supabase Micro caps `max_connections` at 60; lifting it is a tier decision, not an engineering one, and it stacks with this change rather than competing.
- `src/db/index.ts`'s `max: 4` per instance (ADR-0038 decision 2 — measurement first).
- Anything about page LOADS, which still render server-side and still take a connection. This ADR removes the idle-viewer load only.
- Whether the market page can be made fully CDN-cacheable by moving viewer-scoped reads to the client. That is a larger change and is not attempted here.

## Decision Drivers

1. **Remove demand, do not just add supply.** A tier bump roughly doubles connections; this removes most of the demand for them. The cheaper lever should land first.
2. **Removal masking must not fork.** SPEC.1 F-DEBATE-4 and ADR-0034 D-4 forbid a second read endpoint precisely because masking is keyed inside `loadDebateView`, and two implementations are two places for it to diverge.
3. **A removed comment must still disappear from an open tab.** Whatever detects change must see moderation, not only money.
4. **No freshness hole the unconditional refresh did not have.**
5. **The suspension, idle and stop rules must survive untouched.** They are ratified behaviour with their own acceptance rows.

## Considered Options

1. **Consult a content-free version endpoint, refresh only on change** ← chosen
2. Lengthen the interval
3. Server-Sent Events or WebSockets
4. Cache the page read itself more aggressively
5. Do nothing; buy a bigger database tier

## Decision Outcome

**Chosen: Option 1 — the poll asks whether anything changed, and re-invokes the existing page read only when the answer differs from what it last rendered.**

**D-1 · One new Route Handler, `GET /m/[slug]/version`, returning `{ v: <opaque token> }` and nothing else.** No comment bodies, no prices, no viewer-scoped anything. ⚠ **This is what keeps SPEC.1's masking argument intact.** That constraint exists because a second *content* endpoint would re-implement `loadRemovedSet`; an endpoint that returns a single hash re-implements nothing, and the refresh it triggers goes through the same composed `loadDebateView` path with masking and viewer-scoping unchanged.

**D-2 · The token is the market's reserve pair, status, and moderation count.** Reserves carry almost all of it for free: every comment rides a bet (INV-1) and every bet moves the CPMM pool, so posts, replies, sells and trades all move the reserves. ⛔ **Moderation is the one thing reserves cannot see, and omitting it would have been a content-safety regression** — removing a comment moves no money, so a reserves-only token would leave removed content on every open tab until an unrelated bet landed, where the old unconditional refresh cleared it within one tick (CLAUDE.md §5.14 SC-1). `status` rides along because a market can leave `Open` without a bet.

**D-3 · Cached at the edge for 5 seconds, not in the application.** `s-maxage=5, stale-while-revalidate=25` means the origin answers roughly once per market per five seconds no matter how many tabs are watching. At 3,000 viewers the database sees ~0.2 queries/s in place of ~500.

**D-4 · The baseline is taken at mount, never at the first tick.** A tab that recorded its baseline on the first tick would miss anything that landed between the server render and that tick — a freshness hole the old behaviour did not have. The mount read costs one edge-cached request per page view and closes it. ⛔ It **records and never refreshes**, so React's development double-mount cannot make a tab refresh against its own first answer.

**D-5 · A failed check is a non-answer, never an event.** A transient error leaves the last-known version untouched and the next tick asks again. Refreshing on failure would restore the old behaviour exactly when the site is least able to serve it.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Whether a market changed | `src/app/(public)/m/[slug]/version/route.ts` |
| When a tab may refresh, and on what | `src/components/debate/DebatePoll.tsx` |

## Consequences

### Positive

- **Idle viewers stop consuming connections**, which is the resource production actually ran out of. At 3,000 viewers the poll's database cost falls from ~500 queries/s to ~0.2.
- **Most polls never reach a server**, answered by the CDN.
- **Every ratified rule survives unchanged**: 30 s cadence, phase offset, suspension while hidden or composing, idle stop, permanent stop when the market leaves `Open`, and the two-refresh budget after a successful bet. 1,412 tests pass, including all 84 debate and composer suites.
- **Masking is not forked.** A change still re-invokes `loadDebateView`.

### Negative

- **Up to ~5 seconds staler**, on top of a 30 s poll, because the edge answer may be that old. *Acceptable because:* it is invisible beside the interval it rides on.
- **One extra request per page view** for the mount baseline. *Mitigated by:* it is edge-cached and content-free.
- **A new endpoint exists where the catalogue said none would.** *Mitigated by:* D-1's content-free constraint, and the same-commit amendment to SPEC.1 §9 and SPEC.2 §4.3 rather than a silent divergence.
- **The moderation count costs a join** through `comments`, since `mod_actions` is comment-scoped. *Acceptable because:* the route is edge-cached, so it runs about once per market per five seconds regardless of load.

### Neutral

- **This does not make the market page CDN-cacheable.** Page loads still render per request and still take a connection. The ceiling for loads is unchanged until the tier moves.

## Pros and Cons of the Options

### Option 1 — content-free version endpoint (chosen)

**Pros**

- Removes the dominant load rather than resizing around it.
- Leaves the read path, and therefore masking, exactly as ADR-0034 pins it.
- Edge-cacheable, so it scales with viewers at near-zero marginal cost.

**Cons**

- Adds an endpoint the spec said would not exist, requiring a same-commit amendment.

### Option 2 — lengthen the interval

**Pros** Trivial; one constant.

**Cons** Trades freshness linearly for load and buys about 2x where 100x is needed. **Verdict:** Rejected.

### Option 3 — SSE or WebSockets

**Pros** No polling at all.

**Cons** SPEC.1 F-DEBATE-4 rules them out for v1 and ADR-0006 defers them to testnet; a held connection per viewer is a worse fit for serverless than a cached request. **Verdict:** Rejected.

### Option 4 — cache the page read harder

**Pros** No client change.

**Cons** ADR-0051 already windowed the shared block; what remains uncached is viewer-scoped and live pricing, which is uncached deliberately. It also would not stop the render, which is what holds the connection. **Verdict:** Rejected.

### Option 5 — tier bump alone

**Pros** No code.

**Cons** Roughly doubles supply against demand that grows with every viewer. It is a necessary second step, not a substitute. **Verdict:** Rejected as a sole measure; retained as the companion fix.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.1 §9 F-DEBATE-4 | "not a fetch against a separate read endpoint" | **Amends** — narrowed to content-bearing endpoints; a content-free version token is admitted, and the refresh still re-invokes the composed page read. |
| SPEC.2 §4.3 | "the catalogue above is closed" | **Amends** — one row added, with the same narrowing. |
| ADR-0034 D-4 | masking keyed inside `loadDebateView` | **Consumes** — untouched; the new route reads no comment body. |
| CLAUDE.md §5.14 SC-1 | masking is a property of every read path | **Consumes** — the route reads no body at all, and D-2 keeps removals visible to the change check. |
| SPEC.1 §9 POLL-IDLE | idle suspension | **Consumes** — unchanged. |
| INV-1 | every comment rides a bet | **Consumes** — this is what lets reserves stand in for content change. |
| ADR-0038 | `max: 4` per instance | **Shapes** — reduces the demand that value bounds; the value itself is untouched. |

## More Information

- Measurements: `~/Downloads/zz_PROD-THRESHOLD_2026-09-17/` (per-run k6 summaries; Postgres, Redis and health sampled every 5 s).
- The 2026-09-16 handoff recommending this change as §7's biggest lever.
- ADR-0051 — the windowed shared read cache this sits above.

---

*ADR-0053 ratifies that the debate view's poll consults a content-free version token and re-invokes its page read only when that token changes. The decision body and D-1…D-5 are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
