# CRIT-1 — session log

**Task** CRIT-1 · the resolution criterion returns to `/m/[slug]`, collapsed
**Mode** autonomous overnight (no operator gates) · **Session** 2026-08-27, 10:20Z → close
**Branch** `feat/crit-1-criterion-disclosure` · **PR** [#427](https://github.com/zugzwang-foundation/experiment/pull/427) — **OPEN, UNMERGED**
**Base** `origin/main` `d9128e2` (PR #426 / RESO-1, verified merged) · **HEAD** — read it from the branch
**Full run report** `~/Downloads/zz_CRIT-1_run_2026-08-27T1037.md` (uploaded separately; not committed)

---

## 1 · What landed

| SHA | What |
|---|---|
| `38b5818` | `docs/plans/CRIT-1.md` — the plan, committed before slice 1 |
| `4cf4f6a` | C-1 · C-2 · C-3 · C-4(outcome) · C-6 · C-7 · C-8 — the disclosure + its guards |
| `3b6ac49` | `@code-reviewer` fixes — the false-receipt placement guard, the prose-matching negative, paired leading, element-bound crush guard |
| `5103e32` | three `MarketHeader.tsx` docblocks this change falsified, corrected in place |
| `afeca63` | the placement guard again — depth, not order (the first repair was also insufficient) |

**Files:** `src/components/debate/CriterionDisclosure.tsx` (new) · `DebateView.tsx` (one mount) ·
`MarketHeader.tsx` (docblocks only) · `tests/unit/debate/render/criterion-disclosure.test.tsx`
(new) · `tests/unit/design/debate-height-chain.test.ts` (extended) · `docs/plans/CRIT-1.md`.

**Not touched:** `src/server/**` (**zero files**), any schema or migration (head unmoved), the
four RESO-1 blocks, `HeadZone.tsx`, the `.md` export route, `docs/parked.md`, any other surface.

**Gates:** `biome` 0 · `tsc` 0 · `next build` 0 · full suite **392 files / 3640 tests, exit 0**.

## 2 · Decisions made

- **The brief's C-4 mechanism is not shipped, because it was measured to break C-1.**
  `hidden="until-found"` is not cleared when a `<details>` opens: the body stays
  `content-visibility: hidden` and the element's own box goes 24px → 24px instead of 24px → 312px.
  A user clicking would see nothing, and it would look correct in every screenshot.
- **It is also unnecessary.** A closed `<details>` hides content via `::details-content`, whose
  computed signature is byte-identical to a bare `hidden="until-found"` element. Verified
  end-to-end with a scroll-to-text fragment: the collapsed disclosure auto-opened.
- **C-5's fallback is moot and not implemented** — with plain `<details>` the content is never
  unfindable, and force-expanding in older browsers would violate C-3 there.
- **Mounted after the market↔post ternary**, so one authoring site serves BOTH arms. Verified by
  rendering both. Mounting inside the market arm would silently drop the criterion from post
  focus — the one failure the placement exists to prevent.
- **`whitespace-pre-wrap` applied on a measurement:** 8 of 8 seeded descriptions carry structural
  newlines.
- **The open body is bounded (`max-h-[30dvh] overflow-y-auto`)** because the container is a fixed
  one screen with `overflow-hidden` — unbounded content there is clipped, not tall.

## 3 · Open questions / corrections owed to the brief

1. **§0c's "competes for nothing below the band" is not accurate.** `PageContainer` is a fixed
   `h-[calc(100dvh-60px-2px)]` with `overflow-hidden` and the arena is its only `flex-1`, so the
   disclosure's height comes out of the **arena** (−46.50px closed at 1440×777). The band and
   header stack are untouched, which is what the wall protects — but the zero-sum is real.
2. **The longest seeded description is 799 chars, not ~7,481** (GIT-01 is seeded at 794). The
   ruling is unaffected; the design was verified against both.
3. **The brief's baseline figure (3,624 tests) was RESO-1's interim count**; its final was 3,626.

## 4 · Next session starts at

**Gate C: a founder diff-read of PR #427 against its preview.** Find the preview via the run
report's §1 and verify its `/api/health` canary equals the branch HEAD before trusting the page —
several CRIT-1 previews exist, including a base-SHA build used for the BEFORE measurement.

## 5 · Context to preserve

- **A guard protecting this task's central decision was a false receipt, and my first repair of it
  was also a false receipt.** Positional proxies (index windows, "after both headers") kept
  looking sufficient because they kept being checked against the one defect they happened to
  exclude. What actually discriminates is **mount depth**, and what actually proves the property
  is a **render test that mounts both arms**. Recorded to memory.
- **`content-visibility: hidden` distorts your own instrumentation.** A collapsed `<details>`
  reports 160.5px of body height and `content-visibility: visible` on the child, because Chrome
  hides it on the `::details-content` pseudo-element which is not in the `parentElement` chain.
  **Measure the `<details>`'s own box.** It caught my first probe.
- **Scroll-to-text-fragment (`#:~:text=`) is a scriptable proxy for find-in-page** — same
  activation path, and unlike Ctrl-F it can be driven from a test harness. It is how the one
  inferred claim in this task became a measured one.
- **The local suite rotated reds all session** — four runs, four different failure sets, one
  clean, all in DB/integration files untouched by this diff, all passing in isolation. PG's
  catalog is healthy (8 MB, 0 dead tuples, no slots), `fileParallelism` is already `false`. The
  proximate cause was almost certainly a full-suite run I killed at a 10-minute timeout. **A clean
  run on the same tree is what settles it** — a regression cannot produce one.
- **Never mount `DebateView` in a test without fake timers.** It starts poll and auto-advance
  intervals that outlive the file; mine passed in 72ms and stopped the suite from finishing.

## 6 · Time

One session, ~10:20Z → close, 2026-08-27. Recon → plan → S1–S4 → guards → cascade → deploy →
report, uninterrupted, no operator input.

---

**Closing ritual.** *Should `CLAUDE.md` / `AGENTS.md` / the workflow / the tracker change?* —
**`AGENTS.md` §3 yes**, its `debate/` component inventory does not list `CriterionDisclosure`, and
`<details>`/`<summary>` is a new pattern for this repo (there was none before). Flagged, not
edited: this run is fenced against prescriptive doc edits. `CLAUDE.md` needs no change. The brief
needs the three corrections at §3 above, for whoever maintains it.
