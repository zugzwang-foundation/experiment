# POLISH.3 · PR 2 — session log

**Sessions:** 2026-08-15 (unattended, halted at C2) + 2026-08-16 (unattended, resumed C3→C12)
**Branch:** `polish/3-pr2-cards` (pushed; **no PR, no merge**) · **Branch point:** `origin/main` = `ea1795e`
**Plan:** `docs/plans/POLISH-3-PR-2.md` v1.4

> ⛔ **This log does NOT restate `docs/logs/POLISH-3-PR-2-HALT.md`.** That record carries the halt, the evidence, `R-3`, the reviewer's findings and the resumed run's outcome (its §0 and §12). Duplicating it here would create two artifacts that can drift — the defect this surface keeps minting rules against (`O-5`).

---

## What landed (files + PR#)

**No PR opened.** `C0…C12` complete. **`C13` did not run — attended-only.**

| SHA | Commit |
|---|---|
| `4d9ba0f` | **C0** — the ratified plan, verbatim (committed blob md5 = the source's) |
| `13fcf48` | **C1** — eight greenfield guards, **all eight RED on first run** |
| `53f503f` | **C2** — T3 split bar + the `R-3` census entry, **amended** so both halves land in one diff |
| `188b71f` | the halt record |
| `873360c` | post-halt remediation — `@code-reviewer` HIGH-1 + MEDIUM-3 |
| `4f1dddc` | **C3** — T1 `RESOLUTION` overline + hairline container |
| `c2c5e2d` | **C4** — T2, the `--imgmax` bound moves to the height axis |
| `8dd84c4` | **C5** — pop-up geometry 720px/90vh + the image height bound (rows 14, 9) |
| `da2d5a2` | **C6** — pop-up omissions, stake, `SideBadge` + census re-key 8→9 (rows 10-12) |
| `df1629d` | **C7** — the side-aware reply expansion (row 13) |
| `d187dc2` | **C8** — the two disabled card controls removed (rows 1, 2) |
| `f9094e6` | **C9** — `Read more` + the CD-A token port (row 3) |
| `e6ba033` | **C10** — spaced `Đ` sites 2-3; sites 4-5 **VERIFIED**, not edited (rows 4, 5) |
| `2998ff0` | **C11** — the `Download` trigger removed + the `O-5` prose sweep (row 7) |
| `a133c47` | **C12** — the expanded chart's accessible summary + `R-3` on `pct-round-render` (row 8) |

## Decisions made

1. **Halted at C2 rather than absorbing a design-guard red** — confirmed correct by `@code-reviewer` and by the founder (`R-3`).
2. **C2 was AMENDED, not followed by a census commit**, so `R-3` condition (3) is satisfied by the diff itself.
3. **`R-3` condition (1) is checked, never assumed.** At C12 the guard was run with the new code and the OLD count; the failure landed on the census assertion with the offender predicate passing on the line above. Had offenders been non-empty, C12 would have been a second halt.
4. **Reused `computeSplitBar` / `displaySplitTotal`** (read-only import from the deny-listed `composer/**`) rather than writing a second split-bar implementation.
5. **Fixed HIGH-1 and MEDIUM-3 in-session** (§5.10 FAIL → fix before continuing; same-commit doctrine).
6. **Did NOT amend the committed plan** for `GC-12`'s five-row correction, though `O-5` asks for it: the file is the ratified v1.4 *verbatim* and its md5 is stamped in C0's body. Routed to the next plan revision.
7. **`role="group"` → labelled `<ul>/<li>`** at C7 after Biome's `useSemanticElements` rejected it. The rule was right; disabling it would have been an AGENTS.md §11 ask-first.
8. **Discarded C11's first suite run** — another session's runner was live. Waited ~705 s, re-measured clean, committed on that.

## The final local gate — full `pnpm vitest run` (§14)

```
Test Files  1 failed | 335 passed | 1 skipped (337)
     Tests  2 failed | 2981 passed | 1 skipped | 4 todo (2988)
  FULL_EXIT=1
```

**The ONE failing file is `tests/unit/debate/render/reply-split-bar.test.tsx`, with exactly its two NO-post pole assertions** — `RR-3`, which is **C13, attended-only and not run**. Every other suite in the repository is green, which is the check that matters for a PR touching shared components (`BookmarkToggle` / `CardActions`, `ArgProfile`, `ReplyCard`, and the `SideBadge` census that Profile and Bookmarks also feed). **No cross-suite regression.**

⚠ `FULL_EXIT` is read from the log, not from the shell's reported status: the run was `pnpm vitest run > log; echo FULL_EXIT=$? >> log`, and the harness reports the **trailing `echo`'s** exit, which is always 0. Gate commands never let another command own the exit (§14).

## Open questions

- **LOW-5 (`@code-reviewer`)** — does **T3** owe `d5`-exact typography, or consistency with the shipped `ReplySplitBar` it currently mirrors? Three divergences named in the halt record §10.
- **C5's one unruled parameter** — the pop-up image's `max-h-[60vh]`. The plan rules that a height bound must exist; it names no value. Chosen so the image renders whole inside the 90vh dialog without pushing the body out of view.
- **`O-5` on the committed plan** — §7 `:310` and §12 `:564` still say four rows for `post-popup`; `GC-12` ruled five.
- **`ProfileGraphOverlay`** has no accessible summary either (same root cause as `PD-3-04`) — recorded at C12, out of fence, POLISH.5's.

## Next session starts at

**`C13` (`RR-3`, `composer/ReplySplitBar.tsx:64,67`) — ATTENDED ONLY**, with `@code-reviewer` **and** `@security-auditor` (§15). It is a live pole inversion adjacent to commentary, a `CLAUDE.md` §1 critical path.
`tests/unit/debate/render/reply-split-bar.test.tsx` is **RED by design** until then — 2 of its 4 assertions fail, and they are exactly the NO-post pole pair. That red is the standing proof the work is outstanding.

## Context to preserve

- **Worktree:** `/Users/hrishikesh/code/zugzwang/wt-p3-pr2b`. No `.env.local`; `ZUGZWANG_ENV=preview` plus the `tests/_setup/env.ts` placeholder set is required or `next build` fails on `"unknown"`. ⛔ Never read or copy a real `.env*`.
- **The §20 step-7 pair set is FIVE, not three** — `(C2,C8) · (C2,C9) · (C8,C9) · (C5,C6) · (C2,C10)`. The before-C8 checkpoint was **load-bearing**: the plan's row-1 fence had drifted to span two different buttons.
- **A sixth writer relationship** the plan's own rule covers: the remediation commit also writes `AggregateFooter.tsx` and `dharma-spacing.test.tsx`, so the before-C10 re-key accounts for two earlier writers.
- **`GC-12` is applied in code but not in the plan** — `post-popup.test.tsx` covers rows 9, 10, 11, 12, 14.
- **`R-3` widened exactly two design guards** — `side-pole-binding.test.ts` (index 0) and `pct-round-render.test.ts` (3 → **5**, not 4). Any *other* design-guard reddening is still a HALT.
- Diff deliverables: `~/Downloads/POLISH-3-PR-2-DIFF.md` (halted run) and `~/Downloads/POLISH-3-PR-2-DIFF-2.md` (this run).

## Time

Two unattended sessions, 2026-08-15 and 2026-08-16. **No wall-clock projection is offered** (§14.2) — the suite has measured 320 s → 3054 s → 185 s on this machine and a projection from the trend was made once and withdrawn. One measured datum only: the wait for another session's runner to clear was ~705 s.
