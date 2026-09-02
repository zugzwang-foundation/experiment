# CHART-6 — session log

**Task:** CHART-6 · the labels travel with their dots; the window contains its data; the hero gets the Y scale
**Branch:** `feat/chart-6` · **PR:** #453 (MERGED) · **Base:** `44924a7` (run base `83054cf`)
**Canonical SHA:** `f50c6345544e7132c3df162fb4f7648734efc3b2` — the squash-merge on `main`
**Merged:** 2026-09-01T12:40:50Z · **Mode:** autonomous overnight run, no operator gates
**Plan:** `docs/plans/CHART-6.md` (committed with the work)

---

## ⚠ THIS LOG IS A RECONSTRUCTION, WRITTEN AFTER THE FACT

**It was not written from the session.** It was assembled at NIGHT-1 on 2026-09-02
from the merged PR body, the squash commit, `git show --stat`, and the
operator-staged run report `zz_CHART-6_run_2026-09-01T0947.md` — named rather than
linked, because it lives in `~/Downloads` and is **not resolvable from this tree**.
The contact sheet it repeatedly cites,
`zz_CHART-6_contact-sheet_2026-09-01T1152.html`, is in the same place under the
same caveat, and it is load-bearing: §7 of that file is where the one open founder
ruling is *rendered* rather than described.

**This task is the least damaged by reconstruction of the three**, because it left
a 41 KB run report with an ambiguity register, an own-errors section and an
unreviewed-fix list. What is still missing:

- **The plan is on disk (`docs/plans/CHART-6.md`) but the log that would say how
  far the execution diverged from it is not.** The run report records outcomes; it
  does not record where the plan stopped being followed.
- **Which of the six "brief premises that turned out wrong" were found before the
  work and which during it.** The report presents them as one list under a single
  heading; the ordering is exactly what a contemporaneous log preserves.
- **Working time, and the shape of the night.** Only commit and merge stamps
  survive.
- **Any SURPRISE that was resolved silently.** A reconstruction can only see what
  was written down.

---

## What landed

13 files, **+2473 / −400**:

| area | files |
|---|---|
Per-file figures below are `git diff --numstat` **added / removed**, not net and not
churn. ⚠ This table first stated `+381` and `+75` for the two modified files, which
are their added+removed *totals* read as insertion counts — the two new files were
given in the other convention in the same table.

| area | files |
|---|---|
| the chart | `MarketPriceChart.tsx` (**306 / 75**), `MarketPriceChartOverlay.tsx`, `chart/geometry.ts` |
| constants | `src/server/config/limits.ts` (**64 / 11** — the staging window and its expiry alarm) |
| tests | `chart-window.test.ts`, `alignment-chain.test.tsx`, `label-anchor.test.tsx` (new, **398 / 0**), `terminal-markers.test.tsx`, `y-scale.test.tsx` |
| docs | `docs/design/design-canon.md`, `docs/specs/SPEC.1.md`, `docs/plans/CHART-6.md` |
| instrument | `scripts/chart-6-contact-sheet.tsx` (new, **525 / 0**) |

**CI:** the PR gate is run **`33507124656`** — workflow `CI`, event `pull_request`,
on the branch head **`f37e8b3a`** — conclusion **success**, and it is what PR #453's
`statusCheckRollup` names as the `ci` check.

⚠ **This log first cited `33509278417`, which is a different workflow answering a
different question:** `Staging Migrate`, event `push`, branch `staging`, on the
squash `f50c6345`. It is green too, and citing it would have looked like a gate
receipt while certifying only that staging's migrations applied. The gate runs on
the PR head, never on the squash — the squash does not exist until after the merge.
The error was introduced by this reconstruction and not inherited: the run report it
was assembled from names `f37e8b3` and `33507124656` correctly, and contains no
occurrence of the wrong id.
**Suite at the time:** 441 files / 4290 passed / 1 skipped / 4 todo, green.
**Payload:** `/m/[slug]` **+76 B**; Discovery **+3 249 B**, of which +76 is the
label move and **+3 173 the hero Y scale the same brief ruled in**. Zero client JS.
**Round-trip pins unmoved** — debate warm 2 / cold 12; Discovery unchanged.

## Decisions made

1. **The staging chart window's start moved to `2026-08-17T00:00:00.000Z`,
   measured rather than chosen.** The earliest event of ANY type across the whole
   staging slate is `2026-08-17T20:55:20.712Z` — the eight backfilled
   `market.opened` rows — floored to its UTC day. Against the shipped window
   (`2026-08-21`), **eight points fell outside: the genesis point of every market,
   clipped silently.**

2. **The predicate is the lesson, not the date.** The floor is the earliest event
   the chart can RENDER — the earliest of `market.opened` · `bet.placed` ·
   `bet.sold`. CHART-3 measured only `bet.placed`, which was right for the series
   it could see and became wrong the moment CHART-4 backfilled `market.opened` four
   days earlier. **A measurement scoped to one of three event types is a
   measurement of the wrong quantity that looks exactly like the right one.**

3. **The hero takes the expanded treatment, because it was measured and is not
   small.** Its box is **624.62 × 418.75** at a pinned 1440 with build identity
   asserted in the same call — **taller than the 382.25 expanded overlay** it was
   being contrasted against. The "roughly 96 px" it had been compared to is
   `min-h-24`, a layout floor, read as a height.

4. **Labels sit `ring + 5 px` from their dot, by construction, on every surface.**
   Before: gaps of **515.15 px** (hero, 86.2 % of the plot), **251.63 px**
   (collapsed, 87.1 %) and **690.95 px** (expanded, 89.1 %). After: 8.48 px
   collapsed, 11.65 px hero, 14.12 px expanded — each exactly the pulse ring's own
   radius at that scale plus the air.

5. **HIGH-1 was DECLINED on its arithmetic**, and the decline still produced a
   behaviour change: `LABEL_FLIP_RESERVE_PCT` **12 → 14**, moving the flip from
   ~88.1 % to ~86.1 % of the window.

6. **Every guard was verified by reverting its fix and watching it red** (OVN-V2).

## Open questions

⛔ **ONE FOUNDER RULING IS OPEN, and it is a canon ruling, not a defect.**

Moving the labels into the plot box put them in the same rectangle as the SVG date
labels at `y = VIEWBOX_H − 8`. While the labels lived in a gutter beside the plot
the overlap was structurally impossible.

It needs **both** conditions at once — the series at the window end **and** an
extreme price (so clause 4's clamp pushes the label's y onto the axis strip):

```
collapsed · YES  4 % at window end   ⛔ overlap  4.56 ×  8.26 px
expanded  · YES  4 % at window end   ⛔ overlap 20.01 × 16.25 px
collapsed · YES 96 % at window end   ⛔ overlap  4.56 ×  8.26 px
expanded  · YES 96 % at window end   ⛔ overlap 20.01 × 16.25 px
collapsed/expanded · YES 50 %           clear
hero                                     no date axis on this mode
```

⚠ **Invisible today — no staging market is near the window end. It is what every
market looks like on 2026-11-05**, on the two surfaces where stake is read.

**NOT FIXED, deliberately.** Both elements are canon-ruled: `C-CHART-2` clause 4
says only labels may be displaced and the dots never move; the date labels are the
established treatment. Choosing which yields is a canon ruling, and doctrine §10
puts those outside a run's remit. **§7 of the contact sheet renders all nine cells**
so the ruling arrives with a rectangle rather than a description.

## Next session starts at

**Rule the endgame collision above**, from §7 of the contact sheet — then whichever
of the two elements yields becomes a small, well-scoped change in
`MarketPriceChart.tsx`.

⚠ **Read the unreviewed-fix list first.** Nine hunks were authored *after*
`@code-reviewer` finished and are reviewed by nobody (doctrine F-11). The one that
mattered at the time was `LABEL_FLIP_RESERVE_PCT`, moved **12 → 14** — the only
behaviour change in the list, made in response to a finding this run then declined
on its arithmetic.

⛔ **DO NOT GO LOOKING FOR `= 14`; IT IS NOT THERE ANY MORE.** `origin/main` at
`4c041633` reads `const LABEL_FLIP_RESERVE_PCT = 0` — CHART-7 (`d502b45`, #455) took
it to zero, and said so in a docblock above it. **The unreviewed hunk this line
points at has since been superseded by a reviewed one**, so the F-11 exposure it was
flagging is discharged for this constant and remains live for the other eight.

⚠ **This paragraph said `= 14` when the log was written on 2026-09-02**, a day after
CHART-7 landed — a next-action pointer is the one field in a §5.9 log that has to be
true when it is *read*, not when the task ran, and a reconstruction assembled from a
task's own artifacts inherits that task's present tense unless it re-measures. Every
other claim in this log was checked against `origin/main`; this one was not.

## Context to preserve

- **The expiry alarm in `limits.ts` is kept on purpose and is the load-bearing half
  of that docblock.** The failure mode is postponed, not repaired: past
  `MARKET_CHART_WINDOW_END`, `terminalX` exceeds `VIEWBOX_W`, the dots and pulses
  are clipped off the canvas, and the HTML labels keep rendering — two colour-coded
  words and two price figures naming marks that are not drawn. **Nothing errors.**
- **The eight backfilled `market.opened` rows carry their pool's `created_at`
  floored to the millisecond** (Δ −59 … −923 µs), because the backfill bound the
  value through a JS `Date`. A later reader comparing `events.created_at` to
  `pools.created_at` for equality will find them unequal; that is not a defect.
- **`I-GENESIS-001` was minted by this lane's family** and is the durable half of
  the discovery: every market in status `Open` must carry a `market.opened` event,
  or the chart renders nothing and looks like a market nobody bet on.

## Time

Commit authored 2026-09-01T18:10:49+05:30; PR #453 merged 2026-09-01T12:40:50Z.
Run report stamped `2026-09-01T0947` UTC. Working time is not recoverable from the
repository.
