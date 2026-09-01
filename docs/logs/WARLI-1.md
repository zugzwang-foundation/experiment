# WARLI-1 — session log

**Stratum:** single autonomous overnight run (recon → plan → execute → review → PR).
**Branch:** `feat/warli-1` · **Base:** `origin/main` @ `acb71cb`
**Date:** 2026-08-28 · **Mode:** no operator gates; every decision logged rather than parked.

---

## What landed

| Commit | What |
|---|---|
| `5587453` | `docs/plans/WARLI-1.md` — the plan, with the geometry derived from the auth card |
| `5542579` | 30 primitives (`src/components/art/warli/primitives/`) |
| `8975cbe` | 16 figures — one shared body, `figures/{body,index}.tsx` |
| `42f3db0` | ring engine `geometry.ts` + `ring.tsx`, and the hand-computed geometry guard |
| `bf46e07` | `hero.tsx` (counter-rotation, reduced-motion, pointer) + `scripts/warli-preview.tsx` |
| `11d5722` | `tests/unit/art/art-layer-guards.test.ts` — raster / pole / hex / seal / unmounted |
| `250545f` | acting on `@test-writer`: the thesis assertion proved nothing; DOM-reading tests |
| *(this PR's last code commit)* | acting on `@code-reviewer`: the child's double-scaled hands, and eight smaller findings |

**PR:** opened against `main`, left **unmerged**. **Nothing is mounted.**

**Deliverable:** `~/Downloads/zz_WARLI-1_preview_<UTC>.html` — self-contained, no
network. Carries the hero at 1440×1000 with a real-sized auth-card placeholder,
toggles for `prefers-reduced-motion` and geometry guides, and a **plate** of all
sixteen figures drawn large so they can actually be judged.

---

## Decisions made

1. **Every number comes from one measurement.** The auth column is `max-w-md`
   less `px-4` ⇒ a 416×480 card ⇒ half-diagonal 317.6. `R_INNER = 330` exists to
   exceed that, and `R_OUTER`, the figure height and the gap all fall out of it.
   The card therefore CLEARS the artwork rather than sitting on it.
2. **One colour, depth from density.** Everything is `currentColor` resolved once
   from `--color-ink`. The dense/spare split is hatch, filled heads, dotted ground
   and a drawn baseline — never a second grey, because two greys would reintroduce
   a value scale the brand does not have.
3. **Identity is carried by the held object, not the body.** All sixteen are the
   same drawing. That is the argument, not a limitation of the form.
4. **Keyframes are authored locally.** `animate-spin` is not in this app's built
   CSS — measured. The obvious utility would have shipped rings that never turned.
5. **The reduced-motion state is designed, not degraded.** The rings rest at the
   phase where all eight pairs already share a radius, so halting lands on the
   moment of maximum meaning.
6. **`nudgeFor` and `currentRotationDeg` are exported** purely so they can be
   tested; jsdom runs no animation, so the interesting half of the interaction is
   otherwise unreachable from any test that drives the component.

---

## Open questions — for the founder / web lane, not resolved here

1. **`hero.tsx` establishes a stack pattern this repo has never used**: a
   component that embeds its own `<style>` and authors `@keyframes`. The
   measurement behind it is sound and recorded, and AGENTS.md now describes it —
   but whether it is *permitted as a pattern* is a ruling, and the next person
   will copy it. **A short ADR may be owed.** Prescriptive docs are web-authored,
   so this run flagged it rather than writing one.
2. **B2 (frame cost) is OWED.** `requestAnimationFrame` does not fire in an
   automation tab (measured: a 90-frame sample timed out at 45 s), so no trace was
   obtainable. The docblock in `hero.tsx` was corrected to stop claiming compositor
   promotion it never measured.
3. **Responsive behaviour below 1440 is out of scope and untouched.** The viewBox
   has ~220 units of empty margin either side, so `xMidYMid meet` shrinks the
   artwork hard on a narrow viewport.
4. **When it is mounted**, the auth card will be a sibling over the centre, so
   moving the pointer onto the card fires `pointerleave` and resumes the rings.
   That may be desirable or not; it is a design call.

---

## Next session starts at

**Read the run report** (`~/Downloads/zz_WARLI-1_run_<UTC>.md`) §2 for the two
brief premises that turned out wrong, then **open the standalone HTML and judge
the composition** — that is the only thing this run could not decide for itself.

If the composition is accepted, the mount is three lines and is in the PR body.
It touches `src/app/(auth)/**`, which was under another session's lock during this
run — **check the lock is released before mounting.**

---

## Context to preserve

- **The art layer is sealed and unmounted, and both are asserted by tests.** The
  unmounted assertion is the one to delete when mounting — deliberately, because
  deleting a test is visible in a way that adding an import is not.
- **`--color-ground` and `--color-yes` are the same value** (`#181818`), as are
  `--color-ink` and `--color-no` (`#fafafa`). A decorative reach for a pole token
  renders pixel-identical, so no visual review can catch it. The text scan in
  `art-layer-guards.test.ts` is the only instrument that can.
- **Guards were proven by reversal, twice over** — 8 mutants in the first round,
  8 more after `@test-writer`, 3 more after `@code-reviewer`. Two "GREEN" results
  along the way were false negatives where the mutation never applied; the harness
  now asserts the pattern matched before believing the result.
- **`just verify` is RED on a fresh worktree** with `DATABASE_URL is not set`.
  Environmental, not a regression: use a placeholder env shim kept OUTSIDE the repo.

---

## Time

One overnight run. Recon and baselines ≈ 1 h (the full suite alone is 9 min); the
build ≈ 3 h; the reviewer cascade and acting on it ≈ 2 h, which found the single
worst defect of the run and one real rendering bug.
