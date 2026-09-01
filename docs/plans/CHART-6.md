# CHART-6 — labels travel with the dots; windows contain their data; hero gets the Y scale

**Task:** CHART-6 · autonomous overnight run
**Brief:** `zz_CHART-6_overnight-brief_v1_0.md` (344 lines, md5 `37b17ddfbed6df237396575be2dbac15`)
**Doctrine:** `docs/overnight-run.md` **v1.2**
**Base:** `origin/main` = `83054cf86db72674ca13425469fbfec3c7981fe3` (CHART-3, PR #437)
**Branch:** `feat/chart-6` · fresh worktree `~/code/zugzwang/chart-6`
**Baseline suite:** 440 files / 4249 passed / 1 skipped / 4 todo — green, 248.61 s

---

## 0 · The core idea, in prose

The chart has one defect wearing two faces. **The label's x is a constant and the dot's x is
derived from the data**, and the two agree only when the series happens to run to the axis end.
On staging every series ends 14 % of the way across the window, so the labels sit at the far right
naming dots that are far left — a gap of 515 px on the hero, measured. That the series ends early
at all is the second half: the staging axis begins 21 August, but the genesis point of all eight
markets is 17 August, so the opening price of every market is clipped off the left edge, silently.

CHART-6 fixes both. The label is positioned **from its own dot's computed x**, as a percentage of
the plot — the exact mirror of the mechanism CHART-2 already uses for the vertical axis, where the
label's centre lands on the dot's `cy` by construction rather than by a number that happens to
agree at one size. The staging window starts where the data starts. And the Discovery hero, whose
box was believed to be 96 px and is measured at **418.75 px — taller than the expanded overlay** —
gets the Y scale the overlay has.

---

## 1 · Slices, ordered, with exit conditions

| # | Slice | Exit condition | Reviewer-bearing |
|---|---|---|---|
| 0 | GROUND — G-1 data range, G-2 label binding, hero box | measured, in the report | — |
| 1 | Prescriptive docs — §5 EDIT A–E verbatim | applied; divergences logged | no |
| 2 | **The windows (RF-3)** | staging start `2026-08-17T00:00:00.000Z`; suite green | no |
| 3 | Labels travel with the dots + flip + gutter removal (RF-1, RF-2) | rendered label anchored to its dot on all 3 modes; suite green | **yes** |
| 4 | Hero Y scale (RF-4) | hero carries 11 gridlines + 11 marks + value line; suite green | **yes** |
| 5 | Guards + contact sheet (RF-5, §6) | every guard verified by revert-to-red; sheet rendered | **yes** |

**Slice 2 is deliberately first.** It is a constant, it takes minutes, and it alone makes staging
look right. If everything after it fails, the founder still gets that.

**Full suite green at the end of every slice** — the full suite, not the touched tests.

---

## 2 · G-2 — the current label binding, by file and line

| | today | file:line |
|---|---|---|
| **end label's x** | **A CONSTANT.** `left-[5px]` inside `terminal-label-gutter`, itself a `shrink-0` flex cell pinned to the right of the plot | `MarketPriceChart.tsx:718` (NO), `:740` (YES), gutter `:679` |
| **terminal dot's x** | **DERIVED** — `xPx(series[last].at, startMs, endMs)` | `MarketPriceChart.tsx:180-183`, spent at `:504` → `TerminalMarkers` `cx` `:547` |

Those two are the defect. One is a layout position, the other is a data position; nothing in the
component ever compares them.

---

## 3 · File map

| file | why |
|---|---|
| `src/server/config/limits.ts` | S2 — `STAGING_CHART_WINDOW.start`; production docblock gains its seed-day condition |
| `src/components/debate/chart/geometry.ts` | S3 — `labelLeftPct`, `TERMINAL_PULSE_MAX_R`; S4 — the hero gridline set |
| `src/components/debate/chart/MarketPriceChart.tsx` | S3 — `TerminalLabels` takes `terminalX`, moves into the plot box, flips; S4 — hero marks + value line |
| `docs/design-canon.md` | S1 — EDIT A, B, C |
| `docs/specs/SPEC.1.md` | S1 — EDIT D (§16.1), EDIT E (§17 rows) |
| `tests/unit/config/chart-window.test.ts` | S2 + S5 — the new start; RF-5 containment against the real constants |
| `tests/unit/debate/chart/label-anchor.test.tsx` | S3/S5 — **NEW**: the anchor sweep, the flip, the ring clearance, `labelLeftPct`'s divisor |
| `tests/unit/debate/chart/alignment-chain.test.tsx` | S3 — clause-2/3 structural chain follows the label out of the gutter |
| `tests/unit/debate/render/y-scale.test.tsx` | S4/S5 — hero joins the scale; the CSS-space collision band; the payload split |
| `tests/unit/debate/render/terminal-markers.test.tsx` | S3 — positional `style` regexes; prose that named the deleted gutter |

**Three rows in the first draft of this map were never executed, and are struck
rather than quietly dropped** (`@test-writer`, L-9). `tests/unit/debate/chart/
geometry.test.ts` and `tests/unit/debate/render/price-chart.test.tsx` were listed
for the anchor/flip work; that work went to a new file of its own,
`label-anchor.test.tsx`, because it is a new property with its own subject and
folding it into an existing file would have buried the sweep. `labelLeftPct`'s
`SVG_W` divisor is behaviourally pinned there rather than unit-tested in
`geometry.test.ts`. `tests/unit/discovery/render/hero-panels.test.tsx` was listed
for S4 and needed no edit — it already pins `data-mode === "hero"`, and what
CHART-6 changes is what that mode renders, which `y-scale.test.tsx` owns.
**Coverage is not lost; the plan was.**

---

## 4 · Ambiguities resolved, with the alternative rejected

**#1 — How the flip decides it would cross the right edge.**
*Chose:* decide in the component from `terminalX`, against **`LABEL_FLIP_RESERVE_PCT = 14`**, a
percentage of the plot. Over-reserving flips early, which is benign; under-reserving overflows,
which is not.
*Re-measured at the `@code-reviewer` cascade, and the number moved.* The reviewer filed the reserve
as under-sized, deriving the hero's box at 1024 as 421.95 px from a pure `1fr 1.9fr 1fr` reading of
`HeroPanels`' grid. **Measured across the whole range, the hero's chart frame has a FLOOR of
496.49 px** — 768, 900, 1024 and 1045 all give the same figure, because the `md:` grid's centre
track resolves to a content minimum of 530.99 px and stops shrinking; below 768 the panel is
single-column and the hero gets *wider*. So the derivation is wrong (it reproduces 1440 exactly,
which is what made it convincing) and **the finding is DECLINED on its arithmetic**. Its concern was
right, though: the true requirement is 10.31 % plus 1.06 pp for the 5 px of air the threshold cannot
express = **11.37 %**, which `12` cleared by 0.63 pp. Raised to **14** for 2.6 pp of margin;
`label-anchor.test.tsx` caps it at 20 from the other side.
*Rejected:* (a) CSS anchor positioning `position-try-fallbacks: flip-inline` — the exact feature,
but not assertable in jsdom, so its guard could only assert a string; (b) a pure CSS `min()` clamp
— width-free and exact, but it *slides* the label onto its own dot rather than flipping, which
contradicts the founder's ruling; (c) a `useLayoutEffect` measurement — adds client JS, which RF-6
forbids.
*Why it is not CHART-1's deleted `26`:* that was a guess about a font nobody could measure,
guarding a clip nothing asserted. This is measured in the shipped face on the shipped surfaces, it
is used only as a **clamp** so an imprecise value costs an early flip rather than a clip, and it is
guarded at three series-end positions in a real browser.

**#2 — The gap between dot and label.**
*Chose:* express it in the same currency as everything else — `TERMINAL_PULSE_MAX_R`
(= `TERMINAL_DOT_R × TERMINAL_PULSE_PEAK_SCALE` = 7.2 user units) converted by `labelLeftPct`, plus
the `5px` of air already shipped as `pl-[5px]`/`left-[5px]`. The clearance is then the ring's
maximum extent **by construction** at every mode and viewport, because both scale with the plot.
*Rejected:* a CSS-pixel gap — right at one scale factor and wrong at the other two, which is the
`TERMINAL_LABEL_MIN_GAP` defect CHART-2 spent a cascade correcting.

**#3 — What RF-2 actually asks for.**
The brief says the gutter should be "re-sized to the marks' actual width". *Measured, the marks
already have their own column* (`chart-y-marks`, 24 px) — CHART-5 gave it one deliberately, and its
docblock says so. So the label gutter is not shared with the marks; it becomes **empty**.
*Chose:* delete the gutter cell entirely and return its width to the plot. *Rejected:* keeping a
zero-width cell, which would leave a flex child that means nothing.

**#4 — `terminal-label-gutter` testid.**
*Chose:* rename to `terminal-label-layer`, updating every selector. *Rejected:* keeping a name that
describes a box that no longer exists, which is what §6.2 of the doctrine tells runs not to do.

---

## 5 · Baselines, with the measurement layer

| quantity | layer | why that layer | before |
|---|---|---|---|
| suite | `pnpm vitest run`, whole repo | cross-suite floors the named gates miss | 440 files / 4249 tests, 248.61 s |
| markup bytes per mode | `renderToStaticMarkup` of `MarketPriceChart` on a fixed series | this IS the payload the server streams; a call-site count would measure the shape of the code | measured at S3 start |
| round-trip pins | drizzle `logger.logQuery`, statements actually sent | a `.select()` count scores a `JOIN LATERAL` as a round trip | debate warm 2 / cold 12; §7 of the guard |
| label gutter width | rendered box in a pinned 1440 iframe, real Geist | the sizer's own output, in the shipped face | 27.15 px (collapsed, hero) · 48.73 px (expanded) |
| hero chart box | same | jsdom performs no layout | 624.62 × 418.75 |

**Predicted post-build:** gutter 27.15/48.73 → **0** (the cell is deleted); plot widens by the same
amount on all three surfaces. Round-trip pins **unmoved** — this task issues no read. Markup bytes
**up on the hero** at S4, because a Y scale is 22 new elements; reported split by slice so the
label move and the hero scale are not confused for one number.

---

## 6 · Reviewer cascade

1. `@test-writer`, **`isolation: "worktree"`** (OVN-O8) — the guards. Briefed that the anchor guard
   must sweep series-end positions and must derive both sides from the SERIES rather than from
   `terminalX`, and that the window guard must use the shipped constants.
2. `@code-reviewer` — the label positioning, the flip, the gutter deletion, the hero, and every
   docblock this makes false. Briefed that the failure mode is **a coordinate correct only because
   two independent quantities currently coincide**.

`@security-auditor` **not run** — no read path, no cache, no auth, no data change. Revisited if a
slice touches a read.

**Every measurement is taken BEFORE the cascade**, per OVN-O8, and the writer runs in its own
worktree — both mitigations, not one.
