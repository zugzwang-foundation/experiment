# FF-1 · CLOSE-1 — plan

**Task.** (A) S0-fix + owed docs on `feat/ff-1` (PR #568) · (B) UI round 2 on `feat/ff-1-ui` (PR #569).
**Mode.** Single attended-style session; the kickoff prompt (`~/Downloads/FF-1_CLOSE-1_execute.md`) IS the
ratified plan — founder rulings 2026-09-22 ~11:40 IST on the FF-1 run report and screenshots, web-lane
authored. This file is that prompt's slice list, file map and exit conditions, written at Phase 1 and
committed on `feat/ff-1-ui`. Ground: `~/Downloads/zz_FF-1_run_2026-09-21T2143.md` §4, §6, §11.
**Harness mode.** Effort `max` (session-scoped); `ultrathink` on the kickoff; no `ultracode` / dynamic
workflows (none forbidden by area either — this task touches no CLAUDE.md §1 area in code).

## Walls (absolute)

- Never merge; never push `staging` or `main`; never `vercel promote`; never `doppler run --config stg|prd`.
- Local Postgres only (`:54322`).
- No friendly-fire COUNT, BADGE, or card element, on any tier (D-51 R5).
- No prescriptive sentence of the session's own: `docs/specs/*`, `docs/design/design-language.md`,
  `docs/adr/*`, `docs/decisions/*`, `docs/overnight-run.md` change ONLY by the brief's verbatim blocks;
  every anchor must match exactly once (bare-substring semantics); on 0 or ≥ 2 matches the block is
  STOPPED and reported with file + count + 200 bytes of context.
- Part B touches no `src/server`, `src/db`, `drizzle/`, `scripts/`.

## Part A — `feat/ff-1` (docs only, one commit)

| Slice | File | Mode |
|---|---|---|
| A1 | `docs/adr/0017-ranking-modes-and-top-composite.md` | INSERT BEFORE the metadata `## Patch record` heading (two-line anchor) — the CARRIED B5.2 callout |
| A2 | `docs/specs/RANKING.md` | exactly one blank line before `**"Friendly fire" is not a badge either**` |
| A3 | `docs/design/design-language.md` | MOVE the v0.9 lineage line above the topmost `> **[PK lineage]` line |
| A4.1–A4.6 | `docs/overnight-run.md` | v1.3 — version line, `Changed in v1.3`, OVN-O9/O10, F-15/F-16, the two §10 bullets, END line |
| A5.1–A5.3 | `docs/specs/debate-export.md` | Status row, the 7d template line (position MEASURED against `serialize.ts`), the Sources sentence |
| A6 | `docs/parked.md` | descriptive rows, own authorship in the file's row shape: SPEC.2 Server-Actions drift; the two OWED-later auditor items (check for duplicates first) |

**Exit.** `git diff --stat` docs only · spec-literal guards green (`substrate-site-parity` + any test that pins
`docs/` text) · commit `docs: FF-1 CLOSE-1 A — ADR-0017 callout, doctrine v1.3, export rider, dockets (D-51)` ·
push `feat/ff-1` · `ci` on #568 green · NOT merged.

## Part B — `feat/ff-1-ui` (rebase, UI round 2, docs, tests, screenshots)

**Rulings.** R-A12: the switch moves INTO the composer's header row — after the statement, at the row's right
end, before the close control. R-A15: hover glosses on the switch label and the tag, via the markers' own
`InfoTip`, ≥ 640px only (D-4 vi); verbatim copy in the brief. R-INV: `BetComposer.tsx` stays in the side-pole
inventory. Everything else on PR-B stands as built.

| Slice | Files | What |
|---|---|---|
| B0 | — | `git rebase feat/ff-1` onto Part A's head (docs-only ⇒ clean) |
| B1 | `src/components/debate/composer/BetComposer.tsx` | switch relocated into the header row (`data-testid="composer-header"`), same element/testid/role/label/pole/reset rules; statement truncates; phone: switch wraps to a right-aligned second line; helper line stays beneath the header row, both tiers, only while the switch renders |
| B2 | `BetComposer.tsx` · `src/components/debate/badges.tsx` · `src/components/debate/composer/copy.ts` · `src/lib/copy/glossary.ts` | `InfoTip` glosses on the switch label and the tag; copy verbatim; `aria-label`s unchanged |
| B3 | `docs/design/design-language.md` | three verbatim REPLACE blocks (B3.1–B3.3) |
| B4 | `tests/unit/composer/render/friendly-fire-switch.test.tsx` · `tests/unit/debate/render/friendly-fire-tag.test.tsx` · `tests/unit/debate/phone/friendly-fire.test.tsx` | placement (descendant of the header row, not of the argument region, precedes the close control), helper-only-while-switch, glosses ≥ 640 with verbatim copy / none < 640 with a Flipped-marker positive control; all prior cases hold; revert-to-red with the src diff stashed |
| B5 | `~/Downloads/zz_FF-1_shots_CLOSE-1_<UTC>/` | re-capture with the run's own driver: desktop + phone × 5 composer/tag shots, desktop-only two gloss-open shots; switch box INSIDE the header row's box asserted on every composer shot; fixture removed after |
| B6 | — | full suite, tsc, biome, `next build`; two commits (`feat(debate-view): …` / `docs(design): …`); push; PR #569 body updated; `ci` green; NOT merged |

**Exit.** Every guard green, revert-to-red proven for the placement and gloss cases, screenshots on disk with
bytes listed, `git status` clean after the fixture is removed, PR #569 body current, `ci` green, unmerged.

## Report

`~/Downloads/zz_FF-1_close1_<UTC>.md`, written incrementally (O-11); final chat reply ≤ 10 lines with
FILE / LINES / MD5 / STATUS / HEADLINE / UPLOAD: REQUIRED; LINES and MD5 measured as the last action.
