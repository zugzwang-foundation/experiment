# WARLI-1 — an interactive Warli-inspired hero for the auth surface

**Task:** WARLI-1 · **Branch:** `feat/warli-1` · **Base:** `origin/main` @ `acb71cb`
**Mode:** autonomous overnight (recon → plan → execute → report). No operator gates.
**Plan written:** 2026-08-28, after recon R1–R6 and baselines B3. Committed before slice 1.

---

## 0 · The core idea, in prose

Two concentric rings of figures turn in opposite directions around a still centre.
Each figure on the inner ring has a partner on the outer ring — its social
opposite — and at rest every one of the eight pairs stands on the same radius,
head to head across the gap between the rings. Then the rings turn, the pairs
drift apart, and because the rings counter-rotate at equal speed they come back
into full confrontation on a fixed period, and drift apart again. Nothing
resolves; the argument simply keeps circling.

That is the whole visual thesis, and it is why the piece is a **ring** rather than
a row: a row has ends, and an argument with ends is one somebody won.

The register is **one colour** — `var(--color-ink)` line on `var(--color-ground)`.
Depth is line **density**, never value: the inner ring is drawn dense (hatch, dot
grounds, comb borders), the outer ring spare and single-weight. This is not a
restriction worked around. Traditional Warli-inspired geometric figuration is
white rice-paste line on a dark earth ground, so the monochrome constraint and
the authentic register are the same constraint, which is the reason the piece
will not look like anything else.

---

## 1 · Ground

| | |
|---|---|
| `origin/main` at cut | `acb71cb21264238ea92919488b3028c0f53f6601` |
| Worktree | `~/code/zugzwang/warli-1` (fresh, `git worktree add … origin/main`) |
| Branch | `feat/warli-1` |
| Node / pnpm | per `mise.toml` / `packageManager` (install `--frozen-lockfile`, exit 0) |

**Subagent pins.** The worktree is cut at `origin/main`, so `.claude/agents/*.md`
load the current `claude-opus-5` / `effort: max` pins (CLAUDE.md §6 — agent
definitions load from the session's working directory at launch).

---

## 2 · Recon results that shape the build

**R1 — the hex guard reaches my directory, and no list edit is needed.**
`tests/unit/design/no-raw-hex-view-layer.test.ts:20` sets
`SCAN_DIRS = ["src/components", "src/app/(public)"]` and walks them
`recursive: true`. `src/components/art/warli/` is therefore **auto-enrolled**.
Proven by reversal, not by reading: a `#c0ffee` probe at
`src/components/art/warli/_scratch_probe.tsx` took the guard to `EXIT=1` with
`"src/components/art/warli/_scratch_probe.tsx → #c0ffee"` in the offender list;
removing it returned `EXIT=0`, 2 passed.

**R2 — `var(--color-ink)` is the safe path; `animate-spin` is NOT available.**
Measured against the built chunk `.next/static/chunks/082rzgokk2ntf.css`:
`--color-ink:#fafafa`, `--color-ground:#181818`, `--color-n5`, `--color-n2` are all
emitted as `:root` custom properties, so a bare `var(--color-ink)` in an SVG
`stroke`/`fill` attribute resolves. `.fill-n5` and `.fill-no` are present, which
proves Tailwind v4 does mint `fill-*` from `@theme` colour tokens on demand —
`.fill-ink` / `.stroke-ink` are absent only because nothing in the tree uses them
yet. ⚠ **`.animate-spin` is absent and the only `@keyframes` in the built CSS are
`enter`, `exit`, `pulse`.** Assuming `animate-spin` would have produced rings that
silently never turned. **Decision: author `@keyframes` in a component-local
`<style>` block under a `warli-` prefix.**

**R3 — what the two token guards actually constrain.**
`tokens-monochrome.test.ts` reads **only** `src/app/globals.css` (`:17-20`); its
11-token census regex (`:61`) matches line-leading `--color-…: #hex;`
**declarations**. It cannot see my files, and a `var(--color-ink)` *reference* is
not a declaration. `side-pole-binding.test.ts` **does** walk all of `src/`, and
imposes three live constraints on new code: (a) `sourceFiles.length >= 262` — I
only add files; (b) `sideKeyedColour.length >= 6` — unaffected; (c) the
**closed inventory asserted by exact set equality** (`:415-420`). ⇒ **No file I
write may contain an identifier whose last dotted segment ends in `side` compared
`=== "YES"` / `=== "NO"` and feeding a ternary that resolves to a colour**, or the
inventory gains a ninth entry and the suite reddens. The artwork has no side
concept at all, so this is satisfied by construction — and stated here so it stays
satisfied deliberately rather than accidentally.

**R4/B3 — baselines.** See §5.

**R5 — CI dispatches.** Eight runs listed, most recent `2026-08-28T05:53:48Z`
concluding `success`. The brief's `$0 budget` premise does not hold. CI is
`pull_request`-gated, so it fires when the PR opens.

**R6 — the hourglass mark is a static file, not inline SVG.**
`public/brand/zugzwang-mark.svg` — a 682-byte, 1024×1024 SVG of four
`<polygon>`s (`frame-top`, `sand-top`, `frame-bottom`, `sand-bottom`) forming the
hourglass, `fill="#FFFFFF"`. It is consumed as an image `src` at
`src/components/shell/BrandCluster.tsx:64` and `onboarding/figures.tsx:401`, never
inlined. Its raw hex sits in `public/` and is outside every guard's scan set
(`.ts`/`.tsx` under `src/` only). **I compose around it and do not redraw it**: the
hero leaves the centre empty, the auth card sits there, and the card already
carries the mark via `BrandCluster`.

---

## 3 · Geometry — derived, not picked

Everything below follows from one measured constraint: the auth column is
`PageContainer` preset `auth` = `"mx-auto w-full max-w-md px-4 py-8"`
(`src/components/shell/PageContainer.tsx:39`). `max-w-md` = 28rem = **448px**,
less `px-4` either side ⇒ a **416px** card, and a sign-in card of that width runs
about **480px** tall. Half-diagonal = `√(208² + 240²)` = **317.6px**. That number
sets the inner radius, and every other number falls out of it.

| Quantity | Value | Where it comes from |
|---|---|---|
| viewBox | `0 0 1440 1000` | 1440 is the brief's width; 1000 is the smallest height that never clips the outer ring at any rotation phase |
| centre | `(720, 500)` | viewBox centre |
| `R_INNER` | **330** | ≥ 317.6 card half-diagonal, +12.4px clearance — the card clears the inner ring instead of occluding it |
| `R_OUTER` | **470** | `500 − 470 = 30`px top margin; 30px bottom. No clip at any phase |
| figure height | **58** | `(470 − 330 − GAP) / 2` |
| `GAP` (head ring to head ring) | **24** | the remainder; the band where the confrontation happens |
| figures per ring | **8** | the eight ratified pairs |
| angular step | **45°** | `360 / 8` |
| resting phase | **22.5°** | half a step, so no figure sits at an exact vertical or horizontal extreme at rest |

Inner figures stand on `r=330` and grow **outward** to `r=388`. Outer figures stand
on `r=470` and grow **inward** to `r=412`. So the two rings' heads face each other
across the 24px gap, which is the literal reading of "every figure faces its social
opposite across the gap".

**Consequence worth stating:** at rest the composition is *fully aligned* — all
eight pairs on their shared radii. That is the designed still state, which means
the `prefers-reduced-motion` composition is not a degraded frame caught at random;
it is the moment of maximum meaning, and it comes for free.

---

## 4 · File map

Everything lives under `src/components/art/warli/` and is imported by nothing.

| File | Why it exists |
|---|---|
| `primitives/types.ts` | `PrimitiveSpec` — stable id, declared `box`, declared `origin`. The contract every primitive satisfies |
| `primitives/figure-parts.tsx` | `Head` `TorsoUpper` `TorsoLower` `Torso` `Limb` `HandLink` (6) |
| `primitives/marks.tsx` | `Dot` `DotField` `HatchFill` `CombBorderSegment` `Chauk` `Spiral` `WaterLine` `Sun` (8) |
| `primitives/field.tsx` | `Tree` `Deer` `Bird` `Hut` (4) |
| `primitives/props.tsx` | `Book` `Adze` `Spear` `Slate` `Vessel` `Lens` `Scales` `Sickle` `Staff` `Loom` `Post` `Tarpa` (12) |
| `primitives/index.ts` | barrel + `PRIMITIVE_SPECS` registry |
| `figures/body.tsx` | the ONE shared body — landed here rather than in `figures.tsx`, because what the sixteen share turned out to be the whole file |
| `figures/index.tsx` | the 16 specs, `OPPOSED_PAIRS`, `ALL_FIGURES`, `Figure` (`.tsx`, not `.ts` — it renders) |
| `geometry.ts` | pure ring math — no JSX, independently testable |
| `ring.tsx` | the parametric ring renderer |
| `hero.tsx` | `WarliHero` — two rings, CSS animation, pointer interaction |
| `index.ts` | the single public export surface |

**30 primitives**, inside the brief's 24–36.

Guards, under `tests/unit/art/` — **three files, not four.** `ring-geometry.test.ts`
· `warli-render.test.tsx` · `art-layer-guards.test.ts`, the last consolidating what
this plan listed as `no-raster-imports` and `pole-token-abstinence` plus the raw-hex,
seal and unmounted checks. Every guard the plan named is present; they share a file
because they share a file-reading harness and a comment-stripping decision, and
splitting them would have meant maintaining that decision in four places — which is
how two of them drift apart.

---

## 5 · Baselines

| | Layer | Value at base |
|---|---|---|
| **B3a** full suite | `pnpm vitest run`, unpiped, `EXIT=` appended inside the log | **400 files passed / 1 skipped (401)**, **3712 passed / 1 skipped / 4 todo (3717)**, `EXIT=0`, 541.33s |
| **B3b** `just verify` | `. warli-1-buildenv.sh && just verify` | `REAL_EXIT=0`, "All checks passed." |
| **B1** payload | `gzip -c <built chunk> | wc -c` on the chunk carrying the art | measured after slice 4 — budget **40 KB gzipped** |
| **B2** frame cost | headless Chrome trace, 10s at 1440 | measured after slice 4 — target zero dropped frames |

⚠ **`just verify` is RED on a clean fresh worktree** and this is environmental, not
a regression: `next build` dies collecting page data for
`/admin/markets/media/sign` with `DATABASE_URL is not set (DB_POOLER_MODE=session)`
at `src/db/index.ts:71`, because a fresh worktree has no `.env.local`. Fixed by
sourcing `~/code/zugzwang/warli-1-buildenv.sh` — placeholder values transcribed
from `tests/_setup/env.ts`, living **outside the repo** so it cannot be committed.
No real `.env*` is read or written (CLAUDE.md §11).

⚠ **Build env must never be exported into a `vitest` shell** — the suite's
`tests/_setup/env.ts` uses `??=`, so an exported `ZUGZWANG_ENV` displaces its
defaults and reddens untouched files. Every build command in this run sources the
shim in its own subshell; every suite run gets a clean one.

---

## 6 · Slices, in order, each with its exit condition

| # | Slice | Exit condition |
|---|---|---|
| **S1** | 30 primitives + `types.ts` + registry | typecheck green; every spec has `id`/`box`/`origin`; hex guard green |
| **S2** | 16 figures, `dense` + `spare` variants, bbox + hand anchors exported | typecheck green; figures reference primitives only |
| **S3** | `geometry.ts` + `ring.tsx`, pure and deterministic | `ring-geometry.test.ts` green **including an independently hand-computed expectation**, not only a self-comparison |
| **S4** | `hero.tsx` — counter-rotation, reduced-motion still state, pointer interaction | renders in jsdom; no `requestAnimationFrame`; `motion-reduce` path present |
| **S5** | standalone self-contained HTML → `~/Downloads/` | opens with no network; renders at 1440; reduced-motion toggle works |
| **S6** | the four guards + unmounted export | every guard proven by reversal (B4) |
| **S7** | full suite, reviewer cascade, fixes, PR | suite ≥ baseline; PR open and unmerged |

Slices commit separately. If the run dies at S3, S1–S2 are still worth having.

---

## 7 · Ambiguities resolved in advance, with the rejected alternative

| # | Ambiguity | Chose | Rejected | Why |
|---|---|---|---|---|
| A-1 | "a `<g>` with a stable id" — a literal `id` attribute repeats hundreds of times in one document | spec carries `id`; the `<g>` carries `data-warli-id` | literal `id=` | duplicate DOM ids are invalid markup and break `getElementById` / `url(#…)`. The id stays stable and addressable; only the attribute name changes |
| A-2 | which direction figures face | inner ring faces **outward**, outer ring faces **inward** (head to head) | both upright, feet to centre | the brief's own sentence — "every figure faces its social opposite **across the gap**" — is only literally true head-to-head. The sparer option loses the thesis |
| A-3 | both hands link, so no hand is free for the prop | prop hangs from the right arm on a short stem | break the chain so one hand is free | an unbroken chain is the tarpa-dance form and the reason `HandLink` is a required primitive; breaking it to hold a book trades the stronger idea for the easier one |
| A-4 | "pointer-move **slows** both rings" — a CSS-only duration swap is not a slow | `animation-play-state: paused` + an eased nudge that reads as deceleration | swapping `animation-duration` | changing duration re-times the whole animation: at 90s elapsed, 180s→540s jumps the ring by `90×360×(1/180 − 1/540)` = **120°**. A true CSS slow needs a JS loop, which slice 4 forbids |
| A-5 | aligning the nearest pair needs the ring's current phase, which CSS cannot read | read computed transform **once on `pointerenter`**, cache it | read it on every `pointermove` | the constraint is "must not run layout **on move**". Enter is not move, and one read per enter is free |

---

## 8 · What this task is NOT doing, and why the why is the point

- **Not mounting the component.** Not because mounting is hard — it is three lines
  — but because the mount point is `src/app/(auth)/**`, which another session holds
  a live lock on for the signup-deadlock fix. A collision there costs a full
  plan→execute→cascade→Gate C cycle and puts a go-live gate at risk. The recipe
  ships in the PR body so the mount is a decision somebody makes deliberately.
- **Not touching `globals.css`.** Every colour resolves through `var(--color-ink)`
  / `var(--color-ground)`, which R2 proved are already emitted to `:root`. Nothing
  the artwork needs requires a new token, so minting one would be spending the
  brand-drift guard's budget for nothing.
- **Not using `--color-yes` / `--color-no`, or `#181818` / `#fafafa` as figure or
  field colours.** Those two tokens encode bet SIDE (INV-3). `--color-ground` is
  *numerically* `#181818` — the same value as `--color-yes` — which is exactly why
  the rule is about the **token**, not the value: reaching for `bg-yes` because it
  "looks right" would bind decoration to a thesis invariant and the render would
  be pixel-identical, so nothing would ever catch it. A guard for this ships in S6.
- **Not shipping a raster.** No addressable parts means no animation, and the
  payload is wrong for a route sized for 100k signups.
- **Not using an image model or any reference image.** Warli Painting is
  GI-registered (Adivasi Yuva Seva Sangh, 2014) and the available reference
  material is by named living artists. This repo is AGPL-3.0 and is publicly
  archived on 8 Nov. Every path is authored from circle, triangle, line and dot.
- **Not writing the phrase "Warli Painting" as a description of what this is.**
  The GI protects the designation as applied to goods. The code says
  "Warli-inspired geometric figuration".
