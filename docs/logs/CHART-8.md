# CHART-8 — session log

**Date:** 2026-09-08 · **Branch:** `fix/chart-8-axis-date-row-below-plot` · **Base:** `origin/main` = `5052ae80`
**Landed:** **PR #501** · squash `90a1532d` (branch commit `aaeb01fa`)
**Follow-on:** `CHART-8.A` — canon amendment + this log, `docs/chart-8-canon`
**Plan:** none — a founder-briefed one-shot presentational fix. Charts are named as
**ordinary work** in CLAUDE.md §1's seven-area table ("surfaces, discovery, profile,
**charts**, admin read views, tooling, observability"), so no critical-path ritual,
no invariant gate, no reviewer cascade — `just verify` plus the chart's own unit
tests are the gate, which is what the kickoff scoped.

**ID:** `CHART-8` was confirmed unused before anything was written — `docs/logs/`
carried no `CHART-*` log, `docs/plans/` carried `CHART-5.md` only, `grep -rl
'CHART-8' docs/` was empty, and the highest token anywhere under `docs/` was
`CHART-7`.

---

## What landed

| file | change |
|---|---|
| `src/components/debate/chart/MarketPriceChart.tsx` | the date row moves from an `absolute inset-0` overlay **inside** the plot to an `absolute inset-x-0 top-full` **16px strip beneath** it; the frame reserves the room with one conditional `paddingBottom`; `axisDatesFor` hoisted to one call feeding both; `AxisDates` takes the computed list instead of re-deriving it; `TerminalLabels` loses its `bandPx` prop; `lowerTop` loses its third term |
| `tests/unit/debate/chart/label-anchor.test.tsx` | the two band cases **rewritten** — the clamp now carries the plot's edges only (both ceilings read off the markup and asserted EQUAL), plus a new structural case pinning `top-full` / not `inset-0` / `inset-x-0` and the identity *frame `padding-bottom` == strip height == type + offset*; "no band where no row" becomes "no ROOM where no row" |
| `tests/unit/debate/chart/collision-band.test.tsx` | the `band > 0` inversion bound **rewritten** to pin the removal, with the restored `4·half` = 32px threshold asserted against the shortest plot the product renders |
| `tests/unit/debate/chart/axis-row.test.tsx` | one comment corrected — the `leading-none` case explained itself by a clamp term that no longer exists. **No assertion changed.** |
| `docs/design/design-canon.md` *(CHART-8.A)* | `C-CHART-1` clause 1's `10px, expanded mode only` corrected in place to `12px, on every mode`; two new amendment blocks — one under clause 1 (the move + its cost), one under `C-CHART-2` clause 3 (the band discharged + the second overlap) |
| `docs/logs/CHART-8.md` *(CHART-8.A)* | this file |

⛔ **Nothing else was touched.** No `src/` file outside the chart component, no
SPEC, no ADR, no `AGENTS.md`, no `CLAUDE.md`, no new token, no dependency, no
charting runtime, no `PriceBar`, no series/replay/downsample/price maths, and
`MARKET_CHART_WINDOW_START` / `_END` untouched.

---

## Decisions made

**1 · The strip hangs off the plot; the FRAME pays for it.** Three things had to
survive the move: the aspect lock is declared on `market-price-chart-plot`'s inline
`aspectRatio` and its guard reads that element; the marks column must stay exactly
as tall as the plot, because `markTop`'s `top: 34.7%` resolves against the column's
own height; and the horizontal anchoring must not move at all, because
`labelLeftPct` resolves against the plot's width and that is what puts a date on
the tick it names. Taking the room on the flex **container** satisfies all three at
once — `items-stretch` sizes every cell to the container's content box, so one
`padding-bottom` shortens the plot, the marks column and the right reserve in a
single layout pass, with nothing to keep in step by hand — and the plot element
comes out byte-identical.

**2 · Two alternatives were tried against the guards and rejected, and which ones
is the useful part.** *(a)* Making the plot cell a column (plot above, strip below)
grows that cell by the band while the marks column stretches to the taller line, so
every numeric mark drifts off its own gridline by up to 16px — the exact failure
`alignment-chain.test.tsx` link 1 exists to catch — and it moves
`market-price-chart-plot` to an inner element, which the aspect-lock test reads.
*(b)* Adding the strip as a fourth in-flow cell puts it in a flex **row**, where it
takes WIDTH from the plot rather than height beneath it, and it reds
`alignment-chain`'s exact `frame.children` equality.

**3 · A third option met the exit criterion and was still rejected.** Leaving the
strip out of flow with **no** frame padding puts every label below the baseline and
changes no outer box on any mode — priority 3 satisfied everywhere. It also renders
the dates outside the frame: over the collapsed card's 12px bottom padding, and
**outside the hero's `[border:var(--hairline)]` box** onto the element below. An
axis that escapes its own container reads as an overflow bug, so the room is
reserved and the cost is booked.

**4 · Priority 3 could not hold on the expanded overlay, and the reason is
structural.** That mode has no declared height anywhere in the tree — the aspect
lock **is** its height, derived from a width the panel fixes — so a strip beneath
the plot can only be new height unless the plot's aspect gives way, which is
priority 2 and ranks above it. Measured delta **+16.00px**, exactly the band. The
panel re-centres (overlay plot top 228.20 → 220.21 at a 777 viewport) and nothing
clips. Collapsed and hero are `h-full` inside a rail and a carousel panel, so there
the 16px comes out of the plot and the outer box does not move.

**5 · The clamp's band term is removed, not zeroed.** `C-CHART-2` clause 3's rule —
*"one clamp, one more measured input, never a second rule"* — was right; what
changed is that the input is zero for every render, because the collision surface
is gone. A `- 0px` left in the string would leave the component asserting an
overlap it can no longer have, and the next reader would reason about a term that
guards nothing. `AXIS_DATE_BAND_PX` survives, still composed from
`AXIS_DATE_PX + AXIS_DATE_BOTTOM_PX`; only its consumer moved, from the clamp to
the room the frame reserves, so the strip and the space made for it stay one
constant rather than two that agree today.

**6 · `AXIS_DATE_PX` stays 12 against a kickoff that said 10 — surfaced, not
silently resolved.** The brief said to keep "the `n5` token, **10px**, and the
existing anchoring"; the shipped row is **12px**, raised at CHART-7 / RF-3 on a
founder ruling, argued in `AXIS_DATE_PX`'s own docblock ("Ten would make them
identical to the numeric marks — and identical is the one relation that DOES
fight"), and guarded as the RELATION `rowPx > markPx` rather than as a number.
Since the same sentence says *"keeping the existing…"*, keeping 12 is the only
reading that satisfies both halves. **The founder then ruled it at CHART-8.A: the
`10px` was canon's own error**, corrected in place in `C-CHART-1` clause 1 —
which is the interesting part of this row. **A stale number in a governing
document came back as an instruction**, and what stopped a ruled value being
reverted was a docblock and a relation-guard, not the document.

---

## Verification

`ZUGZWANG_ENV=preview just verify` (typecheck → `biome check` → `next build`) —
**exit 0**, read from `$?` rather than from a piped tail.
`tests/unit/debate/chart/` — **124 / 124**, 9 files, with
`container-viewbox-lock.test.tsx` passing **UNCHANGED**, which is priority 2's
whole content.
`tests/unit/debate/ tests/unit/discovery/ tests/unit/design/` — **1109 / 1109**,
87 files. Run beyond the kickoff's scope because this one component renders on
three surfaces. The full suite was **not** run, per the brief.
GitHub Actions `ci` on #501, run `34160519255` — **completed / success**, read from
`gh run view`, which does not lag the way `gh pr checks` does. ⚠ Checked rather
than leaned on: there is no branch protection on this repository, so `ci` is not a
required check.

### Mutation checks — both halves, against the COMMITTED work

A fix whose test cannot fail is half a fix, so each half of the change was undone
on the committed tree and the **named** reds recorded.

| mutation | named test that reds | result |
|---|---|---|
| the row's `top-full` → `inset-0` (back inside the plot) | `label-anchor` › *the date row hangs BELOW the plot, and the frame leaves it exactly its own height* | **1 failed / 124** |
| the band term restored in `lowerTop` | `collision-band` › *the lower clamp carries the plot's own edges and NOTHING else* **and** `label-anchor` › *the lower label's clamp carries the plot's edges ONLY* | **2 failed / 124** |

Tree restored after each; `git status` clean; 124 / 124 green again. Every
rewritten case carries a positive control that splices the removed term back into
that run's own shipped string and asserts the matcher fires, so `not.toMatch` means
*absent* rather than *a regex that matches nothing*.

### Browser measurement — a pinned 1440 in a real Chrome

A local **production** build served against the **live staging database** — `.next`
served from a scratch directory with no `.env.local`, under `doppler run --config
stg`, because `@next/env` loads from the process CWD and a `.env.local` there
silently beats the injected environment. No preview deployment: the Vercel Ignored
Build Step is a literal branch-name allowlist (`main` / `staging` / `verify` /
`feat/*`), and renaming a `fix/` branch to `feat/` to buy one would be bending a
convention for an infra reason.

Five controls, each of which turns a silent wrong answer into a thrown one: the
frame is pinned **in-page** (a same-origin iframe at `position:fixed;
width:1440px; max-width:none`, throwing unless `innerWidth === 1440 && innerHeight
=== 777`, because a CDP metrics override makes the OS window lie); Suspense
boundaries completed by hand with `stillHidden === 0` and a non-zero box asserted
on the element measured; `document.fonts.ready` awaited with `fonts.status` and
`fonts.check('12px Geist')` recorded; animation and transition killed before
reading; and **build identity asserted in the same call as the geometry** — the
date row's own class string is read out with the numbers.

`D` = the date label's box TOP edge minus the plot's bottom edge (the 0 gridline).
**Negative = inside the plot. The exit criterion is D ≥ 0.**

| mode | | plot box | plot bottom Y | 0-gridline Y | marks col bottom | label box | **D** |
|---|---|---|--:|--:|--:|---|--:|
| **collapsed** | before | 254.86 × 164.01 | 253.25 | 253.25 | 253.25 | 12.00 @ 237.26 | **−15.99** |
| | **after** | 254.86 × **148.02** | **237.26** | **237.26** | **237.26** | 12.00 @ **241.25** | **+3.99** |
| **expanded** | before | 739.12 × 364.43 | 592.64 | 592.64 | 592.64 | 12.00 @ 576.64 | **−16.00** |
| | **after** | 739.12 × 364.43 | **584.64** | **584.64** | **584.64** | 12.00 @ **588.63** | **+3.99** |
| **hero** | before | 517.24 × 298.74 | 456.22 | 456.22 | 456.22 | 12.00 @ 440.22 | **−16.00** |
| | **after** | 517.24 × **282.74** | **440.22** | **440.22** | **440.22** | 12.00 @ **444.22** | **+4.00** |

The strip after the change measures **16.00px tall on every mode**, its top edge
exactly on the plot's bottom edge and its width exactly the plot's. The marks
column's bottom edge equals the plot's bottom edge on all three, so the Y scale
still resolves against a box exactly as tall as the plot.

**Outer chart box:**

| mode | before | after | delta |
|---|--:|--:|--:|
| collapsed | 316.02 × 164.01 | 316.02 × **164.01** | **0.00** |
| hero | 627.37 × 299.99 | 627.37 × **299.99** | **0.00** |
| **expanded** | 848.01 × 364.43 | 848.01 × **380.43** | **+16.00** |

**Horizontal anchoring, measured identical to 0.01px** — the DO-NOT the brief
cared most about, because on staging the calendar anchors fall *inside* the plot
rather than on its edges (the staging window is deliberately wider than the
experiment), so an anchor that shifted would have looked like a fix:

| mode | `Sep 15` left / width | `Oct 1` left / width | `Nov 5` left / width |
|---|---|---|---|
| collapsed | 1178.49 / 39.00 | — | 1327.31 / 32.01 |
| expanded | 561.48 / 39.00 | 709.90 / 30.14 | 1016.86 / 32.01 |
| hero | 594.07 / 39.00 | 699.27 / 30.14 | 908.98 / 32.01 |

Every figure identical before and after.

### The paint, which is the arbiter

Captured at the same pin, collapsed card, same market, both builds. **Before:**
`Sep 15` sits level with the `0` mark **and overlaps the `YES` end label
outright**. **After:** `YES` sits inside the plot at its own price and the two
dates sit in a clean strip beneath the baseline, inside the card.

⇒ **The move fixes an overlap the clamp could not**, and that is the argument for
the shape of the ruling: the clamp was managing a shared box, and the two elements
did not need to share one. This second overlap is at an **ordinary** price on the
card's own geometry — every market opens at 10 % YES, so it is the default view of
all eight, not an edge — and nobody had filed it.

---

## Read-only diagnostic — the chart window (kickoff item e)

**`MARKET_CHART_WINDOW_START` / `_END` are neither Doppler-scoped nor a single
checked-in constant: they are two checked-in constant pairs selected at BUILD TIME
by `ZUGZWANG_ENV`.** The variable is environment-scoped; the dates are not.

| | file:line *(at `5052ae80`)* | value |
|---|---|---|
| production | `src/server/config/limits.ts:319-322` | `2026-09-15T00:00:00.000Z` → `2026-11-05T23:45:00.000Z` |
| staging *(and `preview`)* | `src/server/config/limits.ts:399-402` | `2026-08-17T00:00:00.000Z` → `2026-11-05T23:45:00.000Z` |
| the branch | `:439` | `env === "staging" \|\| env === "preview" ? STAGING : PRODUCTION` |
| resolved once | `:468`, exported `:473` / `:478` | from `process.env.ZUGZWANG_ENV` |

⇒ **No manual edit is needed before 15 September** — production already resolves to
the experiment window itself. Changing either is a code edit plus a redeploy, not a
dashboard change: `next.config.ts` puts `ZUGZWANG_ENV` in its `env:` block, so it
is inlined at compile time on every target. A Vercel **Preview** reports
`env: "staging"`, so the deployed preview lane takes the staging window through the
`staging` arm; the `preview` arm covers a local build and nothing else today.
**Nothing was changed.**

---

## Open questions

**OQ-1 · AGENTS.md §9's Suspense-reveal recipe does not work on this build, and the
correction is measured.** The documented remedy is to perform `$RC`'s DOM
operation; measured here, **`$RC` returns in 0.0 ms and changes nothing**. React
streams the content, calls `$RC` itself, and **buffers the reveal in
`window.$RB`**; the shipped tail then runs `$RV($RB)` behind rAF / `setTimeout`,
which a `document.hidden` CDP tab never reaches. The marker is `$~` — *completed,
awaiting reveal* — not `$?`. **`w.$RV(w.$RB)` is the operation**: 1.6 ms, hidden
1 → 0, and the Discovery hero went from `0 × 0` to a real box in the same call.
Not written into `AGENTS.md` — outside CHART-8's file fence and outside
CHART-8.A's (docs-only, canon + this log). **Owed as a separate docket row.**

**OQ-2 · CLAUDE.md §2's `I-GENESIS-001` staging note looks out of date.** It
records that all eight staging markets reached `Open` outside the product and
therefore carry no `market.opened` event. Measured on staging on 2026-09-08:
**22 `market.opened` events against 23 markets**, and the Discovery hero draws a
21-point series. ⚠ The first probe of this session reported empty series on **all
eight** hero panels — which is exactly what the `I-GENESIS-001` condition looks
like — and it was a **stale `'use cache'` entry in the local build**, not the data.
Clearing `.next/cache` and restarting produced the 21-point series. Recorded
because the artifact and the genuine condition are indistinguishable from the
surface, and the wrong one was one sentence away from being written down.

**OQ-3 · The commit-trailer convention has two committed sources against live
practice.** #501 carries **no `Co-authored-by`**, per the kickoff's explicit
instruction and AGENTS.md §10 ("No `Co-authored-by` trailer"). The last thirty
commits on `main` all carry one, after the `Instructions for AI` block. Two
committed sources agree with the kickoff and only the history disagrees, so the
instruction was followed and the divergence flagged rather than reconciled by
guess. `Claude-Session:` is kept. **Worth one ruling so the next session does not
re-derive it.**

**OQ-4 · The date row is still guarded structurally, not geometrically.** jsdom
performs no layout, so "the label's top edge is at or below the 0 gridline" cannot
be a unit test; what CI holds is the mechanism (`top-full`, not `inset-0`, and
`frame padding == strip height == type + offset`). The geometric claim lives in
this log and in #501's body. That is the same standing gap the three
`tests/unit/design/` height chains have, and no worse — but it is a gap, and a
future change to the frame's box model could satisfy every assertion while moving
the dates back over the plot.

---

## Next session starts at

**Nothing is owed on CHART-8 itself.** #501 is merged and CHART-8.A closes the
documentation. The next actions, if the founder wants them, are OQ-1 (the
`$RV($RB)` correction into `AGENTS.md` §9), OQ-2 (the `I-GENESIS-001` staging
sentence in `CLAUDE.md` §2), and OQ-3 (one trailer ruling) — all three are
document edits in files both CHART-8 and CHART-8.A were fenced out of.

## Context to preserve

- **The plot element is the load-bearing identity.** `market-price-chart-plot`
  carries the aspect lock, is the labels' containing block in **both** axes, and is
  what `container-viewbox-lock.test.tsx` reads. Any future change that moves that
  testid, or wraps the plot in a new box, breaks three guarantees at once.
- **`items-stretch` on the frame is why one padding is enough.** It is also why a
  column inside the plot cell is not: the marks column stretches to the row's line,
  not to the plot.
- **The window is wider on staging on purpose.** `Sep 15` is interior there, so the
  collapsed card draws a dashed tick for it and the labels are not at the plot's
  edges. On production both anchors are the edges and the card draws no tick. Two
  environments differing there is the ruling working, not a defect.
- **Local production build + staging DB is the measurement rig**, and its one trap
  is the `'use cache'` entry: clear `.next/cache` in the serve directory or
  Discovery will answer with whatever the build-time database said.

## Time

Execute (CHART-8): ~2h 45m wall — recon and canon read, three-mode before
measurement, the change, three test rewrites, two mutation checks, three-mode after
measurement, PR, CI green. Follow-on (CHART-8.A): canon amendment + this log.
