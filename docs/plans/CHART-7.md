# CHART-7 — marks left, one-line label, calendar anchors, right reserve

**Task:** `CHART-7` · autonomous overnight run · brief `zz_CHART-7_overnight-brief_v1_0.md`
(331 lines · md5 `2057acde42b10ba0fcdb985706d12252`, verified before any other tool call).
**Method:** `docs/overnight-run.md` — **§0 header says `v1.2`** (amended 2026-08-30 from
WARLI-CLOSE-2); **its own footer says `v1.1`**. Trusting §0 as instructed; both reported.
**Ground:** `origin/main` = `47c3f86a4f711df1ba7f78f6c2c3cef6640ad9f6` (BLOCK-4, #454,
2026-09-01 18:26 IST). Fresh worktree `~/code/zugzwang/chart-7`, branch `feat/chart-7`.
All four `.claude/agents/*` pins confirmed `claude-opus-5` / `effort: max`.

**Nothing here is a fix on a broken surface.** The chart renders correctly on all eight
staging markets. Every item is legibility, and every slice is independently revertible.

---

## 0 · GROUND — measured before any edit

Instrument: `scripts/chart-7-ground-probe.tsx` — `renderToStaticMarkup(<MarketPriceChart/>)`
at the product's real boxes, with **this branch's compiled Tailwind and the shipped Geist
face inlined**, measured in a real browser over `127.0.0.1`. Banner read
**`FONT CHECK PASSED`** before any width figure was taken. Boxes carried from
`chart-6-contact-sheet.tsx` (`collapsed 316×193.8`, `expanded 848×auto`, `hero 624.62×418.75`).

| # | Question (brief §2) | Measured answer |
|---|---|---|
| 1 | where the numeric marks sit | **RIGHT of the plot**, expanded + hero only; **none on collapsed**. Column **24.00 px** (`pl-[6px]` + a `100` sizer at 22.09 px), right-aligned, 10 px |
| 2 | where the axis date labels come from | **collapsed:** `CollapsedAxis` — 2 interior ticks at ⅓/⅔ of the **window**, floored to UTC midnight ("Sep 12", "Oct 9" on staging) + an end label `fmtUtcDay(windowEnd)` = "Nov 5". **No start label.** **expanded:** `fmtUtcDay(WINDOW_START)` "Aug 17" + `fmtUtcDay(WINDOW_END)` "Nov 5". **hero:** none |
| 3 | current right-gutter width | **24.00 px** on expanded/hero (the marks column *is* the right gutter); **0 px on collapsed** |
| 4 | current label composition | name **over** value, two `block` spans. Box **33.56 × 28.00 px** (expanded/hero); **22.15 × 10.00 px** `YES` / 17.10 × 10.00 `NO` (collapsed, name alone) |
| 5 | current collapsed gridline set | `[25, 50, 75, 100]` — **no 0**, and no marks column |

### ⭐ The two measurements that decide the shape

**⭐ A — what sizes the right reserve.** All three quantities measured, none guessed:

| quantity | measured |
|---|---|
| widest label `YES 100%`, one line, shipped face | **69.88 px** (at a 4 px inline gap) |
| — same, gap 0 / 2 / 6 px | 65.88 / 67.88 / 71.88 px |
| `NO 100%` (the control on "widest") | **64.84 px** — `YES 100%` is indeed the wider |
| pulse ring max extent, horizontal | collapsed **3.48** · hero **6.64** · expanded **9.12 px** |
| the gap (`LABEL_AIR_PX`) | **5 px**, carried |
| Geist space advance at 16 px / 10 px | 4.39 / 3.74 px |

**⭐ B — the collapsed date labels' current rendered px.** Declared **10 px**;
**rendered bbox 7.70 px**; declared × `scaleY` = **5.99 px**. Both figures are reported
because canon §C-CHART-2 clause 3 records that the two measure different things.
⚠ On the **expanded** overlay the same declaration renders at a **16.00 px** bbox
(10 × 1.2666). **One declaration, 7.70 px on one surface and 16.00 px on another** — the
date labels are the only text left inside the stretched viewBox, and they are the reason
`hasEndValue`'s siblings all left it.

### Two findings the ground pass turned up

- ⛔ **RF-1's ⭐ "each mark within 1px of its gridline" does not hold today at `0` and `100`
  — they are 5.00 px off, by design.** `markTop`'s edge clamp holds a boundary mark half a
  box inside the plot so it does not escape a gutter that does not clip. CHART-5's cited
  `mark50 ↔ line50 Δ = 0px` is an **interior** mark. Guarded as: interior marks within 1 px,
  boundary marks exactly at the clamp. Reported, not silently widened.
- The CHART-6 date-row overlap reproduces: **expanded `19.99 × 16.00 px`** (CHART-6 said
  20.01 × 16.25 against a 382.25 px frame; mine is measured against the aspect-locked
  407.30 px frame), and **collapsed `4.54 × 7.70 px`**. Hero has no axis to collide with — yet.

---

## 1 · Slices

| # | Slice | Exit condition | Reviewer-bearing |
|---|---|---|---|
| 1 | Prescriptive docs — EDITs A–F verbatim | the six edits land; F-1/F-2/F-3 closed | no |
| 2 | Marks to the LEFT; both gutters re-sized (RF-1) | marks render left on all three modes; before/after widths reported | yes |
| 3 | End label to ONE line (RF-2) | `NO 52%` side by side; collision band re-measured | yes |
| 4 | Collapsed left scale + larger dates (RF-3) | `0/25/50/75/100` + marks on collapsed; dates in HTML at a measured size | yes |
| 5 | Calendar anchors (RF-4) | `MARKET_CHART_AXIS_ANCHORS`; no window-endpoint label survives | yes |
| 6 | Right reserve + date-row clearance (RF-5) | reserve cell; `lowerTop` carries the band | yes |
| 7 | Guards + contact sheet | every guard reverted-to-red; sheet emitted | yes |

Full suite green at the end of every slice.

## 2 · File map

| File | Why |
|---|---|
| `docs/design/design-canon.md` | EDITs A, B, C |
| `docs/specs/SPEC.1.md` | EDITs D, E, F |
| `src/server/config/limits.ts` | `MARKET_CHART_AXIS_ANCHORS` (RF-4) |
| `src/components/debate/chart/geometry.ts` | collapsed set gains `0`; `hasFullYScale`→`hasEndValue`; `axisAnchorsFor` |
| `src/components/debate/chart/MarketPriceChart.tsx` | marks left; reserve cell; one-line label; HTML date row; anchors; the band |
| `tests/unit/debate/render/y-scale.test.tsx` | marks side + set + the value predicate |
| `tests/unit/debate/render/price-chart.test.tsx` | the axis is anchors, not endpoints |
| `tests/unit/debate/render/terminal-markers.test.tsx` | one-line box, half-box constant |
| `tests/unit/debate/chart/label-anchor.test.tsx` | flip threshold under a reserve |
| `tests/unit/debate/chart/alignment-chain.test.tsx` | the reserve must not grow |
| `tests/unit/debate/chart/axis-anchors.test.tsx` | **new** — RF-4's guard |
| `tests/unit/debate/chart/gutters.test.tsx` | **new** — RF-1/RF-5's guards |
| `scripts/chart-7-contact-sheet.tsx` | the artifact |

## 3 · Ambiguities resolved (full register, with the rejected alternative, in the run report)

1. **Does the hero gain the X axis?** → **YES.** RF-4's table names `expanded` **and** `hero`,
   and EDIT A's canon text — which I apply verbatim — says "plus `Oct 1` on the wider modes".
   *Rejected:* reading the table as vacuous for a mode that draws no axis.
2. **Does the collapsed label gain the value line?** → **NO.** RF-3 enumerates exactly what
   collapsed gains (gridlines, marks, larger dates) and does not name the value; RF-2 amends
   the label's *composition*, not its mode gating. *Rejected:* giving every mode the value.
3. **Do the collapsed tick LINES survive?** → **YES, at strictly-interior anchors only**, and
   on the collapsed card alone. Each mode keeps its shipped treatment and only the *input*
   changes. *Rejected:* deleting them (EDIT A's text names only labels); drawing them on
   expanded too (canon calls interior ticks there "canon-owned and unbuilt").
4. **"Increase the type" on a label inside a stretched viewBox** → **move the date labels to
   HTML**, at one declared size, using CHART-6's own `labelLeftPct`. A declared size cannot be
   right on more than one surface — that is clause 2's founding argument, and the date row is
   the last text still inside the viewBox. *Rejected:* raising the declared SVG size (7.70 px
   on collapsed and 16.00 px on expanded move together, so no value serves both).
5. **The ring in the reserve's size.** Included as an explicit `RESERVE_RING_PX`, per EDIT C,
   even though measurement shows the dot's maximum x is 98.61 % of the plot and the ring's
   own clearance is 1.11 % — the two sum to 99.72 %, so the ring is already inside. Canon is
   applied as written; the measurement is reported.
6. **`LABEL_FLIP_RESERVE_PCT` under a reserve** → **0**. The flip's arithmetic is a scope
   fence; only its input moves. It stays reachable for the one case the reserve cannot
   cover — a series past the window end, live on staging.

## 4 · Baseline / predicted

| quantity | before | predicted after |
|---|---|---|
| left gutter | 0 px (no left cell) | ~24 px, all three modes |
| right gutter | 24 px (marks) / 0 px collapsed | reserve: ~85 px full-scale, ~37 px collapsed |
| collapsed plot width | 314.00 px | ~253 px |
| collision band (expanded) | ~46.4–53.6 % | ~48 % ± (re-measured, not carried) |
| date label rendered px (collapsed) | 7.70 px bbox | ≥ 10 px, measured |
| payload | measured at slice 7 | ≤ +600 B/page |
