# RANK-3 — close the SC-1 differential and count people, not replies

| | |
|---|---|
| **Task** | RANK-3 (continues PR #394) |
| **Date** | 2026-08-22 |
| **Branch** | `fix/rank-2-self-reply-attraction` |
| **Base for this delta** | `a3cf3f6` (the RANK-2 head) |
| **Governing ADR** | ADR-0039 — **new patch record P3**, ruling web-authored |
| **Governing spec** | `docs/specs/RANKING.md` §2, §3.4, §3.6, §5.2, §11 |

## Also in scope: one docket correction (instructed by the kickoff)

`docs/parked.md` D-7 (`X-Forwarded-For`) gained a `⛔ READ THIS BEFORE
RE-RAISING IT` status block. ⚠ **The kickoff asked for the measurement to be
written in; it was already there** — the six spoofed addresses, the `2 + 58 = 60`
arithmetic and the conclusion have been on disk since CLOSE-1. The row has been
re-raised as open by **four** security passes anyway, most recently RANK-2's,
whose auditor said *"I could not verify Vercel's header handling from this repo"*.
That is the real defect: the measurement is not reachable from where an auditor
looks — **no** call site references it. The block states the verdict up front and
names the fix that would end the recurrence (a one-line pointer at each of the
eight sites), which is deliberately **not** done here: those sites belong to the
`AUDIT-FIX-B7b` HARDEN sweep, and folding them in would make two changes one
unreviewable one.

## What RANK-2 left, and what this closes

RANK-2 excluded self-authored replies from the attracted aggregates. It did not
exclude them from the reply LANE, which is unfiltered and includes removed stubs.
**Their difference is the self-reply count** — and both numbers print in the same
public, signed-out `.md` export. On a post carrying a removed reply, subtracting
attributes that removal to a named pseudonym. RANK-2's own security pass found
it; this closes it.

Separately, `n` counted **replies typed** rather than **people arguing**, so one
account's five replies cleared `floorLane.n` alone.

## The ruling (verbatim — ADR-0039 patch record P3)

> **R-1 · THE DISPLAYED COUNT AND THE RANKING INPUT ARE TWO NUMBERS.**
> Displayed: totalReplyCount — self-inclusive AND removed-inclusive… Ranking
> input: the self-exclusive count, never rendered anywhere, on any surface, in
> any DTO that reaches a client. …What must never split is a number and its own
> meaning.
>
> **R-2 · TRACTION COUNTS PEOPLE, NOT REPLIES.** …`COUNT(DISTINCT rc.user_id)`…
> One person posting five times is n = 1. This is a correction to a definition,
> not a mitigation.
>
> **R-3 · RESIDUAL, PRICED HONESTLY.** R-2 raises the floor from one account to
> five. It does NOT close sybil economics… That is signup cost and belongs to
> RATE-GUARD-PUBLIC.

*(The full text is in the ADR; it is reproduced there unedited.)*

## Implementation

Four numbers per side instead of two, at **three** sites
(`debate-view/ranking-substrate.ts`, `profile/arguments.ts`,
`scripts/verify-ranking-staging.ts` — `bookmarks/list.ts` was removed at
ADR-0040, verified absent):

| Field | Meaning | Reaches a client? |
|---|---|---|
| `support_count_total` / `counter_count_total` | display — every reply, self- and removed-inclusive | **yes, only these** |
| `support_count` / `counter_count` | ranking — `COUNT(DISTINCT rc.user_id)`, self-excluded | **never** |

⚠ **The self-exclusion moved from the JOIN into the aggregate FILTERs**, and had
to: a JOIN predicate removes the row, so the display total could not come from
the same query. A FILTER keeps the row and declines to count it — preserving the
property the JOIN form was chosen for (a post whose only replies are its own
still appears, counts at zero, rather than vanishing).

**The leak sweep found a second live instance**: `discovery/hero.ts` fed the
ranking count into `HeroPost.replyCount`, rendered as `Replies · N` on the public
Discovery hero. Fixing only the export would have left the most public surface
still differing.

## Tests

| File | Proves |
|---|---|
| `tests/server/lots/count-differential.test.ts` | **acceptance** — (a) the differential on the real, signed-out export route; (b) one sybil's five replies. Both RED on `a3cf3f6`. |
| `tests/unit/ranking/substrate-site-parity.test.ts` | the people-form and the display total at every site, the pre-RANK-3 shape absent, the JOIN form absent — plus a control proving the negative regex can match |

⚠ **(b) taught something the brief did not say:** five replies at the reply floor
are Đ250, which clears `floorLane.D = 200` on its own — so while the sybil still
*holds*, the post ranks on the stake lane and ranks there **legitimately**. The
count axis is only reachable once the money leaves, so the test now exits every
reply through the shipped sell before asserting.

## Fences

F1 production forbidden — the prod ref appears in no command. F2 no staging push
or reset. F3 no migration — `git diff` over `drizzle/` and `src/db/` is empty.
F4 halt on red. F5 fresh worktree, `main` re-fetched before each gate.

---

## Open for ruling

**`RANK-3-D1` — the M2 staging-fixture badge calibration is stale.** R-2 counts
people, and M2-P2 draws 5 replies from 3 people while M2-P4 draws 4 from 3, so M2
now fires **one** badge where `tests/staging/_lib/coverage.ts` and
`docs/polish/staging-coverage.json` claim three. **Expectations were updated to the
measured truth rather than the fixture data re-shaped**, because restoring three
badges needs new repliers and therefore a staging rebuild — forbidden by F2, and
`staging:rebuild` has no restore path. The lost coverage is real: the badge lane
is now exercised by one fixture instead of three.

**`RANK-3-D2` — the residual is three accounts, not five, and closing that is a
ranking-semantics ruling.** R-3 prices the post-R-2 floor at five distinct
accounts. `n` is `supportCount + counterCount`, and those are two **separate
per-side DISTINCT aggregates**, so one `user_id` reaching both sides of a post is
counted once in each. Reaching both sides is ratified behaviour, not a hole:
`place` rejects only a **held** opposite side (`getHeldPosition` is
`quantity > 0`), so selling a lot to zero re-opens the other side, and INV-3 then
freezes each reply on the side it was posted from. **One account buys two
people-units.**

Measured — `count-differential.test.ts` case (c) — three accounts ×
(reply YES → sell to zero → reply NO) give `n = 6`, clear `floorLane.n = 5` as the
sole clearer, and take **#1 outright**; the sold YES halves leave `D = Đ150`,
below `floorLane.D = 200`, so the capture is bought purely on the count axis.
*Contested* costs **two** accounts (`n = 4`, `b = 1`, `n^b = 4 ≥ 3`).

⇒ **R-2's direction holds; its magnitude does not.** R-3's conclusion is
unaffected — still signup cost, still RATE-GUARD-PUBLIC's lane. The figure was
corrected in the surrounding prose at both operative sites (ADR-0039 P3,
RANKING.md §2) per O-5; **the quoted ruling was left exactly as written**, because
a decision record is not the place to edit one. Taking `COUNT(DISTINCT
rc.user_id)` **once across both sides** and apportioning it would close the
doubling — and would change what `lop`'s denominator means, which is a ruling.

## Surfaced, not fixed — the differential's remaining public channels

The security pass was asked by name whether any count differential survives.
The one R-1 names is closed at all four DTO sites. **Three others are not**, and
none is caused by this delta:

1. ⛔ **`/u/[pseudonym]` publishes removed-reply authorship outright** — the stub
   renders under the profile owner's avatar and pseudonym and stamps the raw
   comment UUID into `data-testid`, so a reader joins it to the debate page's
   removed stub with no arithmetic at all. `ArgumentList.tsx` states the position
   deliberately (*"the identity of a removed argument's author is not the thing
   that was removed"*) and `debate-export/serialize.ts` states the opposite
   (*"argument text, author, and stake withheld"*). **Two ratified positions
   contradict; this delta hardens the strict one.** Founder ruling on which is
   policy.
2. **`participants` minus the printed pseudonym set** (`market-meta.ts`,
   removed-inclusive per §10.5) tells a reader whether the removed author is among
   the visible names. Exact, signed-out, export-only.
3. **`totals.dharmaStaked` minus the visible frozen stakes** yields a removed
   node's exact withheld stake, unconfounded by sells.

**The Đ channel, priced.** `supportDharma` stays self-exclusive beside per-reply
attributed stakes, so `supportDharma − Σ(visible non-author stakes)` is the
removed replies' surviving basis: `> 0` proves the removal was **not** the post
author's and reveals its exact stake; `= 0` means self-reply **or** fully-exited
lot, with the base rate readable from the same page. **A real stake leak, a
partial deanonymisation** — and moot while (1) stands. The cheap fix is the shape
this task already built: make the dharma aggregates self-inclusive too and leave
only the ranking pair exclusive.

**Priced consequence of R-1, not a defect.** The displayed count is now
self-inclusive by ruling, so a post author can pad `Replies · N` on the Discovery
hero with their own replies for refundable Dharma. Ranking is untouched (`n = 0`).
Suppressing self-replies from display would re-open the differential R-1 exists to
close, so this is the ruled trade, named rather than second-guessed.
