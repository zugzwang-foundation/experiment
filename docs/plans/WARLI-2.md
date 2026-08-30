# WARLI-2 — density, character and the legible debate

**Task:** WARLI-2 · **Branch:** `feat/warli-2` · **Base:** `a95ef2b` (PR #433, WARLI-1)
**Mode:** autonomous overnight. No operator gates. Ambiguity is logged, not halted on.

---

## 0 · The core idea, in prose

WARLI-1 shipped a working ring engine and a vocabulary of thirty marks, and then
drew almost nothing with them. At 1440 × 1000 the piece reads as **two thin
circles with specks on them** — sixteen 58-unit figures on a 1000-unit field,
with the entire rest of the frame empty. It is a diagram of an idea rather than a
picture of one.

WARLI-2 fills the frame, and the filling is not decoration: it is where the
argument becomes legible. Three populations, each meaning something different.

- **Eight FACED figures on the inner ring** — the positions that have an
  argument, in four opposed pairs sitting at 180° from each other. They are the
  only faces in the piece, and being the only faces is what makes them read as
  the ones speaking.
- **Twelve faceless figures on the outer ring, counter-rotating** — the crowd,
  continuously passing between the named positions. Nobody arrives, nobody wins.
- **Twenty-eight faceless figures in a STATIC field** — the world being argued
  about, absorbed in its own work, broadly oriented inward.

Plus a **density meridian**: one half of the frame worked dense, the other more
open, as a gradient. Not a line — a visible seam turns a painting into a diagram,
which is the thing this task exists to stop being.

**Palette is one colour.** `--color-ink` on `--color-ground`. Depth comes from
LINE DENSITY, never from value, because value would reintroduce a grey scale the
brand does not have and would read as two materials rather than as loud and quiet.

---

## 1 · Ground, measured

- `origin/main` = `a95ef2bc79e576ff34c4a7c166b2d915bbf5bdeb`; PR #433 **MERGED**,
  and its merge commit **IS** that SHA. Branching from `main` is correct.
- Suite baseline: **406 files / 3,808 tests, exit 0**, 187.95 s.
- Node census of the shipped hero: **922 elements, 497 drawn shapes, 422 `<g>`** —
  and **918 of the 922 are inside a rotating group**. Nothing is painted once.
- **R2 ruling:** `<pattern>` fills inside a rotating `<g>` show **no** measurable
  per-frame cost, proven against a positive control that only separates at
  n ≥ 2000 and is decisive at n = 5000. Patterns are permitted anywhere.
- **R1/B2 instrument:** `Page.screencastFrame` timestamps from a self-launched
  headless Chrome. rAF is **void** as a cost instrument — vsync-locked, and it
  failed its own positive control.

---

## 2 · The wall that shapes the design

> Skeletons stay uniform. The ring engine chains figures by their hand-link
> anchors and varying those breaks the chain. Character comes from ORNAMENT DRAWN
> ON TOP, never from geometry.

Two consequences that decide the whole build:

1. **Wobble perturbs the MIDDLE of a segment, never its endpoints.** A line
   becomes `M x1 y1 Q cx cy x2 y2` where only `cx,cy` carries the noise. Every
   hand, every joint, every anchor lands exactly where it did before. This is
   also what real bamboo-stick line does — it wanders between two places the
   painter meant, it does not miss them.
2. **Ornament is reserved OUT of solid fills in ground colour**, not stroked on
   top. `--color-ground` is a legitimate token and is not a pole token.

---

## 3 · The roster

**INNER RING — 8, FACED, 1.2× scale, rotating.** Ordered so that index `i` and
`i+4` sit at exactly 180°:

| i | figure | prop | opposite (i+4) |
|---|---|---|---|
| 0 | scholar | book | labourer |
| 1 | soldier | spear | student |
| 2 | priest | vessel | scientist |
| 3 | merchant | scales | farmer |
| 4 | labourer | adze | scholar |
| 5 | student | slate | soldier |
| 6 | scientist | lens | priest |
| 7 | farmer | sickle | merchant |

⚠ **This RE-HOMES the four named pairs.** In WARLI-1 each pair straddled the two
rings; here both members stand on the SAME ring, four apart. That is what makes
"at 180° across the ring" true and G1 checkable, and it is why several shipped
composition assertions must be rewritten rather than kept.

**OUTER RING — 12, faceless, counter-rotating.** speaker · elder · weaver ·
musician · listener · child · builder · dancer · carrier · herder · potter ·
drummer.

**STATIC FIELD — 28, faceless, does not rotate.** Generated from a seeded table:
people farming, building, carrying, teaching, drawing water, dancing, mourning.

**Total characters: 8 + 12 + 28 = 48**, inside G3's 45–55 band, with exactly 8 faced.

---

## 4 · Slices

| # | Slice | Exit condition |
|---|---|---|
| 1 | Recon + baselines | Plan committed; R1–R6 recorded; suite green |
| 2 | **Wobble** | Every primitive bows; determinism guard still green |
| 3 | **Ornament variation** | ≥16 distinguishable combinations; skeleton untouched |
| 4 | **Faces** | 8 faced variants at 1.2×; faced count exactly 8 |
| 5 | **Motif library 9 → ~30** | Animals, scenery, objects; mirrors + scale variants |
| 6 | **Border stack** | Four edges; the corners are eaten |
| 7 | **Worked ground** | Nothing empty; meridian carried |
| 8 | **Scene engine** | ~28 static figures + ~100 motifs, seeded, non-colliding |
| 9 | **Assembly, preview, plate, guards** | Preview HTML + plate READ line by line |

Slices 2–8 are each independently visible. Commit separately. A death at any
point still leaves the piece better than it was.

---

## 5 · Guards (§5 of the brief), each proven by reversal

- **G1** — each faced figure's opposite sits within 1° of 180° across the ring.
- **G2** — every static-field figure faces the centre.
  ⚠ **Stated limit:** figures stand UPRIGHT, so "facing" is the horizontal mirror
  plus a small lean, not a full bearing. The guard asserts
  `mirror · (CENTRE_X − x) > 0` and `sign(lean) = sign(CENTRE_X − x)`. It catches a
  figure on the left facing left, which is the actual defect; it does not and
  cannot constrain a figure standing directly above the centre.
- **G3** — faced count is exactly 8; total character count within 45–55.
- **G4** — ink coverage per half-frame differs by a ratio inside a stated band,
  AND falls monotonically across four vertical quarters with no single step
  taking more than half the total range — the gradient, not merely the imbalance.

Carried forward, all still green: pole-token scan, raster scan, import seal,
unmounted assertion, **equal-reach**, ring determinism.

⚠ **THE HONEST LIMIT, restated where it will be read:** none of G1–G4 prove the
picture LOOKS like a debate. They prove it is STRUCTURED like one. Only the
preview answers the first question, and the operator answers it.

---

## 6 · Baselines

- **B1** payload, gzipped, from the BUILT chunk. Budget 40 KB. Probe route must
  **not** be `_`-prefixed; `just clean` after removing it.
- **B2** frame cost before/after, **same instrument** (screencast), same duration.
- **B3** suite green before/after, unpiped, exit captured inside the log, delta
  reconciling exactly to this task's new test files.
- **B4** every guard proven by reversal, with the mutation asserted to have
  APPLIED before its result is believed.

---

## 7 · File map

**New**
`primitives/wobble.ts` · `primitives/ornament.tsx` · `primitives/face.tsx` ·
`primitives/bestiary.tsx` · `primitives/scenery.tsx` · `primitives/border.tsx` ·
`scene.ts` · `field.tsx` (the static layer)

**Modified**
`figures/body.tsx` (ornament + face dials) · `figures/index.tsx` (roster) ·
`hero.tsx` (composition) · `ring.tsx` · `primitives/index.ts` (specs) ·
`scripts/warli-preview.tsx` (plate) · the three test files · `AGENTS.md`

**Never touched:** `src/app/(auth)/**`, anything under `/sign-in` or
`/onboarding`, `src/app/globals.css`, `src/server/**`, `drizzle/**`, `src/db/**`.

---

## 8 · Reviewer cascade

1. `@test-writer` — slices 2, 8, G1–G4. Hunt the shape of a guard that compares a
   thing to itself. Mutate the composition; report which mutants survive.
2. `@code-reviewer` — whole diff against the token contract.
3. `@security-auditor` — narrow: pattern defs, generated ids, every interpolation
   reaching an SVG attribute or a `url(#…)`.

A finding fixed after its reviewer ran is re-reviewed scoped to the fix (F-11).
