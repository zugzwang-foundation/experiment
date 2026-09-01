# WARLI-2 — session log

**Task:** WARLI-2 · density, character and the legible debate
**Branch:** `feat/warli-2` · **PR:** #438 (OPEN, UNMERGED) · **Base:** `a95ef2b`
**Mode:** autonomous overnight run, no operator gates.

---

## What landed

Four commits on `a95ef2b` (which IS merged PR #433, verified rather than assumed):

| SHA | What |
|---|---|
| `8d19c18` | `docs/plans/WARLI-2.md` — the plan |
| `f9a283f` | Slice 2 · the wobble + three drawing verbs |
| `596bee2` | Slices 3–8 · ornament, faces, 31 motifs, border, ground, scene engine |
| `8a18830` | Reviewer fixes — 26 surviving mutants and two HIGH geometry findings |

⚠ **Canonical SHAs are the squash-merge SHA on `main`, which does not exist yet.**
These are branch SHAs and are ephemeral.

**New:** `primitives/{wobble.ts, stroke.tsx, ornament.tsx, face.tsx, bestiary.tsx,
scenery.tsx, border.tsx}`, `scene.ts`, `field-layer.tsx`,
`tests/unit/art/{wobble.test.ts, composition.test.tsx}`.
**Modified:** `figures/{body,index}.tsx`, `hero.tsx`, `ring.tsx`,
`primitives/{index,types,marks,field,props,figure-parts}`,
`scripts/warli-preview.tsx`, the three shipped art tests, `AGENTS.md`.

**Measured:** payload **12,994 B gzipped** (32.5 % of a 40 KB budget) · frame cost
**57.30 → 59.66 presented fps**, worst frame 251–267 ms → 51.7–69.1 ms, zero frames
over 100 ms · rotating/static split **14.0 % / 86.0 %** (was 100 % / 0 %) · suite
**408 files / 3,853 tests, exit 0** · CI **success** on `8a18830`.

---

## Decisions made

1. **Both members of each opposed pair moved onto the INNER ring**, four indices
   apart. Across two rings a "pair" shares a bearing rather than sitting at 180°,
   so the brief's own sentence was unwritable as a guard. This also frees the
   outer ring to be a crowd rather than a second team.
2. **The wobble perturbs the MIDDLE of a segment, never its endpoints.** Every
   chain anchor stays bit-identical, so the equal-reach guard survives a change
   that touches every mark in the drawing — by construction, not by care.
3. **Poses vary hand HEIGHT, never reach.** The equal-reach wall forbids moving an
   anchor; it bounds hand `x`, not `y`. A bowed head over two lowered hands reads
   as stooping without an arm shortening by a unit.
4. **Border depth 62 → 26** and the outer ring's outward fringe dropped, after
   measuring **58 units of overlap** between the border and the ring.
5. **`buildFieldScene()` is called by both the component and the guard.** The
   guard used to build its own scene, which made the whole static field optional.
6. **G4's "gradient not step" moved onto the meridian FUNCTION.** It cannot be
   demonstrated from placed marks: a smoothstep has zero slope at its ends and
   maximum slope in the middle, and the middle of this frame is the ring, so the
   transition is occluded by the artwork.

---

## Open questions

- **Why the denser composition is FASTER is NOT ESTABLISHED.** The rotating layer
  *grew* (497 → 655 drawn shapes) and frame cost improved anyway, reproducibly.
  No mechanism is claimed.
- **The mount is a resource decision, not three lines.** The chunk is 12,994 B of
  JS; the markup is **82 KB gzipped and ~35 ms server CPU**, built server-side and
  again at hydration. Harmless unmounted; an unauthenticated cost on `/sign-in`.
- `scorpion` is a weak read in isolation. Three placed instances; flagged.
- An **asymmetric border** (deeper at the sides, where the frame has room) is a
  real option rejected for simplicity.

---

## Next session starts at

**Reading `~/Downloads/zz_WARLI-2_preview_2026-08-29T2344.html`** and ruling on
whether the composition reads as a debate. Every guard here proves it is
STRUCTURED like one; none can prove it LOOKS like one. Then Gate C on the diff.

---

## Context to preserve

- **`tests/server/admin/moderation/act.test.ts` is order-fragile** — reads
  `mod_actions` unfiltered, truncates only in `afterEach`. Red once, green in
  isolation, green on re-run: rotated, so environmental. **Not fixed here**
  (critical-path file, art-layer task). Details in `claude-progress.md`.
- **A mutation-testing reviewer is a WRITER.** `@test-writer` edits `src/` as it
  works, so measurements taken during the cascade are contaminated. Detection
  rule worth keeping: **two renders identical within one process but differing
  across processes means the INPUT changed, not the code.** Fix: give the
  reviewer `isolation: "worktree"`, or measure before the cascade.
- **rAF is void as a frame-cost instrument.** It is vsync-locked and reported
  60 fps for a rotating feTurbulence group. Use `Page.screencastFrame` timestamps
  from a self-launched Chrome; the automation tab is `document.hidden`, which
  freezes rAF *and* the animation timeline.
- **26 of 72 reviewer mutants survived my own six-mutant reversal proof.** A
  reversal proof only tests the mutants you were imaginative enough to write.

---

## Surprises caught + fixed in-session

- **The wobble was never observed in the drawing.** `wobble.test.ts` proves the
  module; nothing connected the three drawing verbs to it, so all three could go
  machine-true with the suite green — the exact failure its own docblock names.
- **`admissible()` modelled a figure as a disc about its FEET** while it is drawn
  upward from them. Two field figures had ink inside the rotating crowd's
  annulus, three had crowns inside the border, all guards green because they
  measured the ANCHOR. §5.14 SC-1 transposed onto geometry.
- **The equal-reach guard was one-sided** — no upper bound anywhere in the suite.
  Adding one strengthens the guard the brief walls against weakening.
- **Five motifs read wrong on the plate**; the monkey was genuinely broken.
- **AGENTS.md said 76 `.test.tsx` files when there are 84** — I incremented a
  stale number instead of using a count I had already taken. O-2, in the file
  whose header promises it is descriptive.

---

## Time

Single overnight session, 2026-08-29 22:06 → 2026-08-30 ~00:00 UTC.
Full report: `~/Downloads/zz_WARLI-2_run_2026-08-29T2206.md`.
