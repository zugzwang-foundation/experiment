# CHART-5 — plan and decision record

**Task:** unblock PR #437, diagnose the terminal dots, add the Y scale.
**Mode:** autonomous overnight (`docs/overnight-run.md` — the copy in this tree is
**v1.2** after the slice-1 merge, not the v1.1 the brief named).
**Branch:** `feat/chart-3` (PR #437). **Base:** `origin/main` @ `b2da687`.

> Written during execution rather than before it, and said so plainly: slice 1 was
> a merge conflict whose shape could not be known until it was opened, and slices
> 2 and 3 were explicitly conditioned on a measurement the brief forbade
> pre-judging. This records what was decided and why, which is what the reviewers
> and Gate C need from it.

---

## Slices

| # | Slice | Exit condition | Reviewer-bearing |
|---|---|---|---|
| 1 | Resolve #437's `docs/specs/SPEC.1.md` conflict | `mergeable: MERGEABLE`, CI **fires and goes green** on the new head | no (doc + citations) |
| 2 | Measure the three dots; fix only if a defect | Every circle in the chess overlay attributed; candidates 1/2/3 ruled | no (no `src/` change) |
| 3 | The Y scale | Gridlines, marks, end values, collision threshold; full suite green | **yes** |
| 4 | Canon edits, contact sheet, cascade, PR | Sheet reads `FONT CHECK PASSED`; PR open and unmerged | — |

## File map

| File | Why |
|---|---|
| `docs/specs/SPEC.1.md` | Slice 1 — conflict resolution; CHART-3 row renumbered `1.0.42 → 1.0.48` |
| `src/components/debate/chart/geometry.ts` | `ChartMode`, `Gridline`, `gridlinesFor`, `yPctPx` — the per-mode sets, frozen at module load |
| `src/components/debate/chart/MarketPriceChart.tsx` | Gridline `<g>`, `YMarks` column, stacked end value, mode-aware half-box |
| `src/components/debate/PriceBar.tsx` | **untouched** — read only, to prove the percentages agree |
| `tests/unit/debate/render/y-scale.test.tsx` | New — 21 guards |
| `tests/unit/debate/render/terminal-markers.test.tsx` | One stale docblock corrected in place |
| `docs/design/design-canon.md` | EDIT A + EDIT B, applied verbatim |
| 7 citation sites | `SPEC.1 1.0.42 → 1.0.48` (see slice 1) |

## Baselines (measurement layer stated)

| Quantity | Layer | Before | After |
|---|---|---|---|
| Full suite | `pnpm vitest run`, whole tree | 439 files / 4220 tests | 440 / 4241 |
| Per-page chart payload | serialized `<g data-testid="chart-gridlines">` from `renderToStaticMarkup` of the **collapsed** chart — the only chart in the page's HTML (measured on staging: `/m/[slug]` server-renders exactly one chart svg) | 0 B | **376 B** |
| Client JS | markup scan for `on[A-Z]` / `<script>` in the added subtree | none | none |
| Round-trip pins | untouched — this task moves no read | — | — |

## Ambiguities resolved

| # | Ambiguity | Chose | Rejected | Why |
|---|---|---|---|---|
| 1 | Doctrine version — brief says v1.1, tree gains v1.2 on merge | **v1.2** | v1.1 | The brief's own words are "the copy in the repo governs", and slice 1 puts v1.2 in the tree. v1.2 adds `OVN-O8`, which changes how the cascade is launched. |
| 2 | Where the CHART-3 changelog row lands after REGISTER-1's renumber | Append as **`1.0.48`**, dates untouched | Renumber REGISTER-1; re-date CHART-3 | REGISTER-1 moved numbers and never dates. Following its own precedent exactly. The resulting date non-monotonicity is **flagged, not fixed** — it makes a `1.0.47` sentence false, and that is a spec sentence the web lane owns. |
| 3 | Which ramp step the gridlines use | **`--color-n2`** | `n1` (fainter), `n3` (heavier), a new token | It is the step the x-axis ticks already use. Two axes at two weights read as two systems. A new token would red the 11-token census, which is a correctness guard. |
| 4 | Dotted vs dashed | Dotted `1 3` | Dashed `5 4` (matching the x ticks) | The brief says dotted; and same colour + different rhythm keeps the two directions distinguishable without spending a second tone. |
| 5 | Where the numeric marks live | **Their own column between plot and label gutter** | Inside the label gutter | Inside forced the gutter from `relative` to `flex` and moved its width-sizer down a level, reddening two `alignment-chain` guards. Those guards are right. Sharing one column would also need a second collision rule, which the brief forbids. |
| 6 | Marks column width | In-flow invisible `100` sizer | `w-[22px]` | A hand-measured px width for text is the exact defect CHART-2 deleted for the label gutter. |
| 7 | How to render the two un-ruled variants for the founder | Sheet-side: CSS hide for the 100 line, a **sheet-built mock** for collapsed marks | A product prop | A prop existing only for a contact sheet is ratification scaffolding shipped into `src/`. |
| 8 | Two-line half-box value | Composed: `(10 + 2 + 16)/2 = 14` | A literal `14` | Composition is what makes the threshold move when the type does. Measured in the sheet: the label box renders **28px**, exactly the sum. |
| 9 | `ZUGZWANG_ENV` for the contact sheet | **`staging`** | unset (→ production) | The chess market's bets are August-dated; under the production window every point maps to a negative x and section 2 renders blank while captions still print numbers. |
| 10 | Whether to write a second terminal-dot guard | No — the existing one is better | Write one anyway to satisfy the brief's table | `price-chart.test.tsx` already asserts all four terminal marks' `cx` equal the line's last x, behind non-vacuity assertions. A second would duplicate a stronger guard. |

## Guards, and the mutation that proves each

Every one verified by reverting the fix and confirming a **named** test reds
(OVN-V2). Nine mutations, nine reds — full table in the run report.

## Not doing, with reasons

- **D10 / the production window start** — SPEC.1 §16.1 pins it by name and canon reversed a dismissal on the value; it needs a spec amendment the web lane owes.
- **Candidate 2's node divergence** — confirmed present and measured; docketed and deliberately accepted at CHART-1. Confirming it is the deliverable, not fixing it.
- **`@security-auditor`** — no read path, no cache, no key, no auth surface, no data change. Running a reviewer with nothing in scope trains the cascade to be ignored.
