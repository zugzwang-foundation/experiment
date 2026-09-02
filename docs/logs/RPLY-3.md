# RPLY-3 — the composer's structure restored; the reply card made a post card

**Status:** PR open, UNMERGED, target `origin/staging`
**Branch:** `feat/rply-3-composer-structure`
**Base:** `origin/staging` @ `4ed4875` (RPLY-2, PR #418)
**Predecessor:** RPLY-2 (`~/Downloads/zz_RPLY-2_run_2026-08-26T1142.md`; no `docs/logs/RPLY-2.md` on disk)
**Mode:** attended — plan in-session, one reviewer pass, PR. No `docs/plans/RPLY-3.md`.

---

## What landed (CLAUDE.md §5.9 field 1)

Two commits on `feat/rply-3-composer-structure`. No `src/server/`, no schema, no
migration, no wire — the diff is four view files, six guard files and this log.

| File | State | Notes |
|---|---|---|
| `src/components/debate/composer/BetComposer.tsx` | Modified | R1 — money footblock back into `.compright`; `overflow-y-auto` moved off the argument region onto a new `.fieldscroll` wrapper; direct `dimmed` removed from the footblock |
| `src/components/debate/composer/ImageAttach.tsx` | Modified | R1 — `min-h-48` on the panel: the floor, and the thing that releases the grid item's automatic minimum |
| `src/components/debate/ReplyCard.tsx` | Modified | R2 — image cell moved below the body row |
| `src/components/debate/DebateColumn.tsx` | Modified | Comment only — the "second scroller" amendment re-pointed at `.fieldscroll` |
| `tests/unit/design/composer-fit.test.ts` | Modified | G1 rewritten, G2 + G4 added, two brittle character-window helpers replaced |
| `tests/unit/composer/render/composer-grid.test.tsx` | Modified | RPLY-2's `right.contains(stake) === false` reversed; `parentElement` assertion added |
| `tests/unit/composer/render/notice-slot.test.tsx` | Modified | Baseline child count 3 → 2; G3 shape guard added |
| `tests/unit/debate/render/reply-card-absorber.test.tsx` | Modified | G5 (order) + G6 positive control added |
| `tests/unit/design/debate-height-chain.test.ts` | Modified | Docblock only — V3's question answered in place |
| `docs/logs/RPLY-3.md` | This file | Written before `gh pr create` per §5.9 |

**Not committed, deleted before the PR:** `tests/unit/debate/render/_rply3-harness-dump.test.tsx`,
the throwaway jsdom markup dumper for the V1 browser harness (RPLY-2 did the same
with its own copy). The harness pages, the measurement driver and the mutation
runner live in the session scratchpad and never entered the repo.

---

## Decisions made (field 2)

1. **The scroll moved instead of the money row.** R1 rules the footblock back
   inside the right column and also rules that it is "never pushed off-screen".
   Those two are in tension: the column is exactly the thing that runs out of
   room. Rather than defend the submit with a height budget, the
   `overflow-y-auto` came off the argument region and went onto a new wrapper
   around the title/body pair alone, making the footblock that scroll box's
   `shrink-0` sibling. **This is an addition beyond R1's literal bullet list** and
   is the reason every cell in the V1 table is green; without it the measured
   shortfall at 650px on the post arm was 8.6px.

2. **The floor sits on the `<fieldset>`, not on the artwork.** Both jobs come
   from one declaration: an explicit `min-height` is what replaces a grid item's
   content-based automatic minimum, and it is also the floor. Flooring the
   `<svg>` instead lets the panel keep shrinking underneath it, so the drawing
   spills past the panel's own border — and `overflow-hidden` to stop the spill
   is the crop the task forbids.

3. **192px, chosen so it does not bind in the tested range.** 650px lands the
   panel near 224px, so the floor only catches the fall below the matrix.

4. **The footblock's direct `dimmed` class was removed** — a correctness fix, not
   a tidy-up. Back under the dimmed ancestor, a second copy composites
   0.5 × 0.5 = 0.25 and would have halved the notice slot's measured 5.08:1
   contrast, on a token the WALLS forbid touching.

5. **R2 is a reorder and nothing else.** The image cell's size is unchanged
   (360.01px before and after, measured): it was already the card's only
   `flex-1` and already took the space a post spends on its split bar. Reported
   rather than dressed up as an enlargement.

---

## Open questions (field 3)

- **The floor's band is below the tested matrix and is now stated rather than
  promised.** At 1280 wide the panel floor first binds at 600px (post) / 580px
  (market); below that the surplus becomes visible overflow that `column-scroll`
  takes, so `Đ BET` stays reachable but stops being reachable *without*
  scrolling. Founder ruling owed on whether that band matters.
- **Narrow viewports.** Below ~860px wide the amount block hits its own
  min-content width and the money row overflows its column; `Đ BET` is clipped
  from ~800px. **Not a regression** — the money row's contents and the grid track
  are byte-identical to pre-RPLY-2, so this is restored behaviour, and the brief
  fences mobile breakpoints out of scope. Flagged, not fixed.
- **`ImageAttach`'s `max-h-[308px]` calibration comment** is still stale (RPLY-2
  carried it; this task's fences said it is not RPLY-3's). Untouched.
- **`KnowMore` mount parity.** `PostCard` overlays it in a reserved gutter,
  `ReplyCard` uses a flex sibling. Recorded in `ReplyCard.tsx`; porting it is a
  real change with a real measurement behind it, not a tidy-up.

---

## Next session starts at (field 4)

Read the founder's disposition on the two bands above. If both are accepted,
this PR merges into `staging` as-is; if the 600/580 band is not accepted, the
next lever is the title textarea's `min-h-8` floor — which this task deliberately
did **not** reach for, because R1 pre-ruled "shrink the image cell, not the
textarea".

---

## Context to preserve (field 5)

- **The V1 harness is not in the repo and has to be rebuilt each time.** jsdom
  markup dump → wrapped in the root-layout class strings + `next build`'s real
  compiled CSS + the real emitted Geist woff2 → served over `localhost` → driven
  from a fixed-size same-origin iframe. Two traps that cost time: a CDP-driven
  tab is `document.hidden`, so `requestAnimationFrame` never fires (the first
  driver hung the renderer for 45s); and the compiled CSS references
  `url(../media/…)`, so the harness has to mirror `.next/static/`'s directory
  shape or the real font never loads and every height is wrong.
- **The harness reproduced RPLY-2's numbers exactly** (452.77 / 266.45) before
  any change was made, which is what licensed the before/after table.
- **Three guard helpers in this diff previously fenced by character distance**
  and all three broke on prose added in the same commit. They now bound by
  symbol. If a fourth appears, it is the same bug.

---

## Time (field 6)

Single attended session, 2026-08-26. Recon → in-session plan → build → V1/V2/V3
→ one `@code-reviewer` pass → 15 dispositions → V5 → PR.
