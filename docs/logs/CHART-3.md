# CHART-3 — session log

**Task:** the chart without a genesis event, and the fixed experiment window
**Mode:** autonomous overnight (`docs/overnight-run.md` v1.1) · unattended
**Branch:** `feat/chart-3` · **Base:** `origin/main` `44c9f99`, merged to `a95ef2b` at `d8f79de`
**PR:** #437 — **OPEN, UNMERGED**
**Full run report:** `~/Downloads/zz_CHART-3_run_2026-08-29T2146.md` (the record; this is the index)

---

## What landed

| # | Commit | What |
|---|---|---|
| 1 | `5a11a4c` | `docs/plans/CHART-3.md` — the plan, and G-1's answer |
| 2 | `6eab9ab` | SPEC.1 §0/§9/§16.1/§17/§20 → **1.0.42**; `design-canon` `C-CHART-1` |
| 3 | `218d05b` | `tests/invariants/I-GENESIS-001.open-implies-market-opened-event.spec.ts` |
| 4 | `e17122a` | the fixed experiment window — `limits.ts`, `MarketPriceChart.tsx`, `geometry.ts`, `ChartSummary.tsx` |
| 5 | `273b7c5` | `@test-writer` — seven holes in the guard set |
| 6 | `f5fd1f3` | `@code-reviewer` dispositions |
| 7 | `6fc0dda` | `@security-auditor` dispositions |
| 8 | `d8f79de` | merge `origin/main` (`a95ef2b`, WARLI-1) |
| 9 | `7726df2` | O-13 close: a Vercel preview reports `env: "staging"`, not `"preview"` |

**Not landed: Slice 2, the genesis fallback.** Abandoned on measurement — see below.

---

## Decisions made

1. ⭐ **`k` is NOT invariant — the fallback is abandoned.** `cpmm.md` §11 numbers the true
   property **INV-C2, "k non-decreasing"**; §10.3's directional flooring sends dust to the pool
   permanently. Spec and implementation agree. The derived seed diverges after **two**
   operations, and **five of five** bet-carrying staging markets already carry a non-integral
   `√(yes·no)`. RF-1's own test ("exact or it is not used") returns the same answer.
2. **EDIT B and EDIT E withheld.** Both assert the invariance, verbatim, inside text to be
   committed to SPEC.1. Precedent: **1.0.41** — *"a verbatim edit block authored on a premise
   the session then falsifies does not self-correct — it hardens."* Quoted in the report for
   the web lane.
3. **The axis is fixed on all three modes** (collapsed, expanded, hero) — one component, one
   domain. §22 amendment owed.
4. **`xPx` is not clamped, in either direction.** Clamping draws a price at an instant it did
   not happen; the viewBox clip is the honest rendering.
5. **The §20 row was composed** (restricted to what shipped) rather than withheld — a spec that
   changes with no changelog row is a defect. **The one place this run wrote prose beyond
   selecting web-authored text.**
6. **§17's `INV-4` tag deviated to `—`** — flagged by both reviewers; recorded in the cell.

---

## Open questions — OWED, ranked

1. **EDIT B / EDIT E** need re-authoring without the invariance claim.
2. **The sparse full-width flat line** — a non-`Open`, never-bet market paints a price across
   the whole window past its own freeze. ⚠ Overturned my own ambiguity #4.
3. **`C-CHART-2` clause 2** — "immediately right of each terminal dot" is now false; the labels
   cannot follow without reintroducing the 4.28px distortion CHART-2 removed.
4. **The production window START** clips every market's genesis point (staging's start is
   *measured*; production's was *chosen* — the asymmetry was never noted).
5. **Staging's window ends 2026-09-10** — now carries an expiry alarm rather than prose.
6. §22 amendment · §9 *Accessibility* wording · the §17 tag ratification · a live-DB run of the
   genesis predicate (it would **fail** on today's staging, correctly).

---

## Next session starts at

**Gate C on PR #437, reading the run report's §8 UNREVIEWED-FIX LIST first** — twelve entries,
of which **#1 is the only one that changes what renders** (tick instants floored to UTC
midnight). Then the six OWED rulings above, in order. **Do not merge before reading §8.**

---

## Context to preserve

- ⚠ **The founder's stated outcome was not reached.** Staging's charts stay blank. The invariant
  and the axis shipped; the fallback could not.
- The measured error would have been **invisible** — the two replays are byte-identical (contact
  sheet §4). Abandonment rests on RF-1's rule plus two structural costs `@security-auditor`
  supplied: the F-1 drift detector would fire forever, and it re-introduces an assumption this
  codebase has retired **twice**.
- ⭐ **A hard-coded coordinate that is right by coincidence is invisible until the coincidence
  ends.** `TerminalMarkers`' `cx = VIEWBOX_W` and `xPx`'s one-sided reasoning are the same
  defect twice; the whole suite passed through both.
- The contact sheet is `~/Downloads/zz_CHART-3_contact-sheet_2026-08-29T2327.html` —
  `FONT CHECK PASSED`, verified in a browser.

---

## Time

2026-08-29T21:46Z → 2026-08-29T23:4xZ (≈ 2 h). Baseline suite 403/3766; final **408/3836**,
green. Both round-trip pins **Δ = 0**. `tsc` and `next build` exit 0.
