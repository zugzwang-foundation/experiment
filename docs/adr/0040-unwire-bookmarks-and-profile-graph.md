# ADR-0040 — Unwire the bookmark module and the Profile Dharma graph

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-08-22 |
| **Deciders** | Hrishikesh (founder) |
| **Tracker task** | AMEND-1 (records the UNWIRE-1 build decision) |
| **Frame document** | ADR-0038 (scale target: 100,000 signups, 2–5M page loads, 3,000-concurrent ceiling — the cost pressure this decision responds to) · ADR-0032 (superseded in full) · ADR-0034 (amended — the two viewer-scoped bookmark fields removed) · ADR-0039 D-5 (amended — the aggregate read-site list). |
| **Supersedes** | ADR-0032 |
| **Superseded-by** | — |

## Context

ADR-0038 sets the experiment's scale target: 100,000 signups, 2–5M page loads,
and a 3,000-concurrent survival ceiling. A front-end cost inventory run against
the participant surfaces established that the front end had been built without
regard to what each rendered element costs at that concurrency, and identified
two features as disproportionate.

The Profile Dharma graph was the only unbounded cost term in the product.
`loadProfileGraphSeries` called `replayReserveSeries` once per market the profile
subject had ever traded in, in a sequential `for` loop with no batching and no
`LIMIT` — three statements per market, on every render of `/u/[pseudonym]` and
again on `/bookmarks`. Every other cost in the participant surfaces is bounded by
a constant; this one grew with participation.

The bookmark module cost two statements on the debate page — which polls every
fifteen seconds, making it the only surface whose cost is paid repeatedly by an
idle reader — thirteen on Profile's signed-in-visitor arm, and thirty-three to
fifty-one on its own route.

Neither feature is thesis-bearing. ADR-0032 D-8 already excluded bookmarks from
the Nov 6 public dataset, so removing them costs the experiment's output nothing.
The graph plotted figures the six Profile tiles already carry. Both were also
among the least-tested and most visually intricate elements in the product, and
POLISH carried nine surfaces of which none had yet had a founder eye pass — the
binding constraint on this experiment being founder-serial capacity rather than
calendar.

## Decision

1. **The bookmark module is unwired product-wide.** The `/bookmarks` route, all
   eight components under `src/components/bookmarks/`, all four server modules
   under `src/server/bookmarks/`, the debate-page bookmark icon and its two
   viewer-scoped reads (`ViewerMarketContext.bookmarkedCommentIds` and
   `.ownCommentIds`), and three Profile-page touchpoints: the visitor-arm
   `loadBookmarks` call, the `CardActions` import on the argument cards, and the
   identity band's bookmark-mode-switch control.

2. **The Profile Dharma graph is unwired product-wide.** Both lines, the
   per-market value segments, the authored-argument node markers, the expand
   overlay, the market filter, and `loadProfileGraphSeries`.

3. **The `bookmarks` table is retained.** No DDL was run and none is owed.
   `src/db/schema/bookmarks.ts` stands. An unread table costs nothing at any
   concurrency, and dropping it is irreversible; re-wiring is cheap while it
   stands and will not stay cheap.

4. **The download stub is preserved.** `CardActions` bundled a permanently
   disabled download control with the bookmark trigger, and Profile's argument
   cards rendered both. Removing the bookmark module would have removed an
   affordance nobody ruled on, so the stub is extracted to
   `src/components/profile/DownloadStub.tsx` — same variant, size, disabled
   pair, icon and accessible name.

5. **Profile's six account tiles are retained.** Wallet, positions value, net
   P/L, arguments, support received, counter received. Participants keep every
   figure; they lose the curve over time.

6. **The Profile headzone's blank second cell is ratified as-is.** The grid still
   declares two columns and now holds one child. The planned Profile design
   refinement owns that layout; no stopgap is applied here.

## Consequences

Statement counts, full tick including the shared layout: `/m/[slug]` falls from
25–26 to 23–24 for a signed-in viewer and from 28–29 to 26–27 for one holding a
position. `/u/[pseudonym]` falls by eight statements for a subject who has traded
in one market and by twenty-nine for one who has traded in eight. `/bookmarks` is
eliminated. 5,989 lines were deleted across 83 files.

The debate-page saving is modest — roughly two statements on the polled path. The
decision was taken for the unbounded term, the deleted surface area, and the
POLISH surface it removes, not for the polled-path arithmetic.

Participants lose cross-session saving of arguments and the visualisation of net
worth over time. The second is the more real loss: the curve was plausibly the
most motivating element on Profile for someone deciding whether to keep
participating across the experiment's fifty-one days, and sustained participation
is `n` in K·n > C. The judgement is that the tiles carry enough of it.

## Supersedes and amends

- **ADR-0032** — superseded in full. It describes a deleted feature.
- **ADR-0034** — amended: the two viewer-scoped bookmark fields it registers by
  name no longer exist. Its viewer-scoping principle stands unchanged.
- **ADR-0039 D-5** — amended: the aggregate read-site list drops
  `bookmarks/list.ts`.
- **SPEC.1 §23**, **SPEC.2 §4.2**, **RANKING.md §7**, and **design-canon**'s graph
  and bookmark entries are amended in the same commit as this ADR.
