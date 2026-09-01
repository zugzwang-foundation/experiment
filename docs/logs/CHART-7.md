# CHART-7 — session log

**Mode:** autonomous overnight (`docs/overnight-run.md` — **§0 says v1.2, the footer
still says v1.1**; trusted §0, both reported).
**Base:** `origin/main` = `47c3f86` (BLOCK-4, #454). Worktree `~/code/zugzwang/chart-7`,
branch `feat/chart-7`. All four `.claude/agents/*` pins confirmed `claude-opus-5` /
`effort: max`.
**Run report:** `~/Downloads/zz_CHART-7_run_2026-09-01T1258.md` (671 lines).
**Contact sheet:** `~/Downloads/zz_CHART-7_contact-sheet_2026-09-01T1518.html`, rendered
from `b7c064e`.

---

## What landed

**PR #455**, open against `main`, **unmerged**. Eleven commits.

| slice | commit | what |
|---|---|---|
| plan | `93c3ccf` | `docs/plans/CHART-7.md` |
| 1 | `a01ef10` | canon `C-CHART-1` c1 / `C-CHART-2` c2, c3; SPEC.1 §16.1, §17 ×5, §20 — **F-1, F-2, F-3 closed** |
| 2 | `b0759b7` | RF-1 — marks to the left, on every mode; `hasFullYScale` → `hasEndValue` |
| 3 | `1f2fd06` | RF-2 — the end label to one line; the collision floor 14 → 8 |
| 4 | `feb6a67` | RF-3 — the card gains `0`; the date row leaves the viewBox for HTML at 12px |
| 5 | `2ff8efa`, `518e598` | RF-4 — `MARKET_CHART_AXIS_ANCHORS`; testids keyed to the anchor, not the position |
| 6 | `c26bfa2` | RF-5 — the right reserve; `LABEL_FLIP_RESERVE_PCT` 14 → 0; the date-row band |
| 7 | `c6499e1` | the contact sheet + the before-capture generator |
| cascade | `ec0ab58`, `fe821f0`, `b7c064e` | the guard gaps, and **one real defect** |

Full suite **4375 passed / 448 files** at the tip. `tsc` 0, `biome` clean, `build` 0,
token census 8/8.

## Decisions made

Eleven ambiguities, all logged with the rejected alternative (run report §7). The four
that matter:

1. **The hero gains an X axis.** RF-4's table names it and EDIT A's canon text says "the
   wider modes". The most reversible reading in the task — one arm of `drawsTimeAxis` —
   so it is pinned by a named test rather than buried.
2. **The date row moved to HTML.** "Increase the type" has no answer inside a viewBox
   stretched differently per surface: one declaration rendered 7.70px on the card and
   16.00px on the overlay. 12px chosen by rendering 10/11/12/13 side by side and looking.
3. **RF-1's "each mark within 1px" is guarded as two claims** — interior within 1px
   (measured ≤ 0.008px), boundary marks exactly at `markTop`'s clamp (5.00px, and 5.00px
   before this branch too). Widening a founder-stated tolerance to make a test pass would
   have been the alternative.
4. **`LABEL_FLIP_RESERVE_PCT` = 0**, with the arithmetic at the constant: the dot's
   maximum in-window x is 98.61% and the ring's clearance 1.11%, so an in-window label
   always fits the reserve. The flip stays reachable past the window end.

## Open questions — a founder ruling is owed

1. ⛔ **The payload budget is exceeded and the overrun IS the ruling.** `/m/[slug]`
   **+1157 B**, `/` **+942 B**, against the brief's 600 B. Accept, or drop one of the
   collapsed card's additions.
2. **The card loses its dashed ticks on the production window** — both its anchors are
   the plot's own edges. Correct per RF-4, and a visible change.
3. **The boundary marks sit 5.00px off their gridlines** by the clamp. Ruling owed only
   if they are meant to sit on the edge with half their box outside the plot.
4. **The hero's new axis** — see decision 1.

Eleven items are owed to the **web lane** (run report §11): three false SPEC.1 §9
sentences, canon `C-CHART-1` clause 1's title/opening/`10px`, a dangling sentence EDIT A
created, and — the one with teeth — **EDIT C's verbatim text drops CHART-2's ring-sizing
correction**, so a maintainer following canon would size `TERMINAL_DOT_ALLOWANCE` to 4
and re-open a shipped visual defect.

## Next session starts at

**Gate C on PR #455.** Read the **unreviewed-fix list** (run report §9) first: the two
behaviour changes authored after `@code-reviewer` are `YMarks`' `right-[6px]` and
`bandPx`'s predicate. Then the founder rulings above. Do **not** merge before Gate C —
the marker is in the PR body, not the title (§5.13.2).

## Context to preserve

- **The defect worth remembering.** `pr-[6px]` deleted the marks' 6px of air rather than
  moving it, because an absolutely positioned box resolves `right` against its
  ancestor's **padding box** — whose right edge is the *outer* edge of the padding. The
  old arrangement worked only because padding-side and alignment-side were on opposite
  sides. Third instance of CHART-3's register entry, in the two-character diff whose
  docblock defended it, certified by a guard that asserted the padding alone.
- **`.chart7-before/` is gitignored and outside `.next`** because `pnpm build` cleans
  `.next` and destroyed the first capture. `chart-7-contact-sheet.tsx` REFUSES without
  it; the recipe to re-create it is in `chart-7-ground-probe.tsx`'s docblock. Use
  `git checkout HEAD -- <path>`, never `git checkout -- <path>`, to restore.
- **The full suite rotates.** Run 1 reddened one test of 4335; runs 2–4 were clean on
  identical trees. Environmental (OVN-V8), and the identity was lost to a truncated log.
- Contact-sheet recipe: `pnpm build && ZUGZWANG_ENV=staging pnpm tsx
  scripts/chart-7-contact-sheet.tsx <out.html>`. It spawns itself under the opposite env
  to put both windows in section 4.

## Time

Single session, 2026-09-01, ~12:58Z → ~15:30Z.
