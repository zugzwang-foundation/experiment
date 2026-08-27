# RESO-1 — session log

**Task** RESO-1 · Market Detail resolution block, geometry pass
**Mode** autonomous overnight (no operator gates) · **Session** 2026-08-27, 07:37Z → close
**Branch** `feat/reso-1-resolution-geometry` · **PR** [#426](https://github.com/zugzwang-foundation/experiment/pull/426) — **OPEN, UNMERGED**
**Base** `83cf6fb` → merged `origin/main` `9d2a920` mid-run · **HEAD** `f2989e1`
**Full run report** `~/Downloads/zz_RESO-1_run_2026-08-27T0740.md` (uploaded separately; not committed)

---

## 1 · What landed

Four commits on `feat/reso-1-resolution-geometry`, PR #426 open:

| SHA | What |
|---|---|
| `c2547c2` | `docs/plans/RESO-1.md` — the plan, committed before slice 1 |
| `38213de` | R-1 · R-2 · R-3 · R-4 · R-5 · R-6 · R-7 · R-8 · R-12 — the geometry pass |
| `5b48120` | the empty-rail fix (gate the rail on the series, not on the object) |
| `b3d8295` | the content-floor fix + nine `@code-reviewer` findings |
| `f2989e1` | merge `origin/main` (CHART-1 #425); R-6 discharged by it |

**Files:** `src/components/debate/MarketHeader.tsx` · `ResolverCards.tsx` ·
`chart/MarketPriceChartHost.tsx` · `chart/MarketPriceChartCard.tsx` (comments only) ·
three guard files under `tests/unit/debate/render/` · `docs/plans/RESO-1.md`.

**Not touched:** any schema, any migration (head unmoved), `src/server/**`, auth, ledger,
money path, any surface but Market Detail, any `markets` row on any environment.

**Gates:** `biome` 0 · `tsc` 0 · `next build` 0 · full suite **391 files / 3624 tests, exit 0** ·
**CI `33055952223` on `f2989e1` = success**.

## 2 · Decisions made

- **R-5 needed no code.** The chart is `flex-1 min-h-0`, so it already absorbs whatever the
  rail leaves. Pinned by guard; reported as "no change needed" rather than edited (OVN-O4).
- **R-4 required making the rail conditional** — moving the bar out would otherwise leave an
  empty 340px column (`PD-3-09`). That is the orphan the move creates, fixed in the same commit.
- **The rail's condition is `hasRenderableSeries`, exported from the chart host**, not a
  hand-copy of its emptiness test. Two components must not answer "is there a chart?" differently.
- **The block row grows (`flex-1`) rather than carrying a tuned height**, with a **measured**
  content floor of `min-h-[97px]` (intrinsic 96.25px) so overflow scrolls instead of clipping.
- **R-6 deleted in favour of CHART-1's `TerminalMarkers`** — same row, arrived at independently,
  better (adds a terminal dot, factors collision into `geometry.ts`, cites ratified `C-CHART-2`).
- **`ResolverCards` deliberately NOT renamed** despite the name now being narrow — a rename
  would make `AGENTS.md` §3 and `docs/parked.md` stale in a run fenced against doc edits.
- **Block value lines ship EMPTY.** Three of the four fields are foreclosed, not missing: no
  resolver column exists and a closing date is market content (CLAUDE.md §3).

## 3 · Open questions — for the founder

1. **The resolution criterion now has no on-page presence on `/m/[slug]`.** Measured: it
   rendered in exactly one place and R-2 removes it; it survives only in the ADR-0025 `.md`
   export. Ruled measure-and-report by the brief, so it is reported and not resolved.
   `markets.description` is the pre-registered criterion the 6 November dataset derives from.
2. **`docs/parked.md`'s `HTML-FINISH-MD-PLACEHOLDERS` is stale and operationally load-bearing** —
   it names four placeholders on this surface; there are now six of three kinds, and it is the
   pre-DP.2-promote strip list.
3. **Block label copy.** The four fixture strings are PROVISIONAL and explicitly not canon.

## 4 · Next session starts at

**Gate C: a founder diff-read of PR #426 against the preview at
`https://experiment-evcyxrc2e-zugzwang-worlds-projects.vercel.app` (canary `f2989e1` — check it
before trusting the page; four RESO-1 previews exist).** Then rule open question 1. Nothing in
this branch is merged and nothing should be merged before that read.

## 5 · Context to preserve

- **The empty rail shipped for one commit and the unit guard was green throughout**, because it
  rendered `priceChart={null}` — a shape the read model never produces (it returns a truthy
  `{ series: [], nodes: [] }`). Found only by measuring the deployed build. Recorded to memory.
- **No market on staging renders a chart at all** — fixtures are raw-INSERT, so the reserve walk
  is empty on all eight. Any work assuming a visible chart on staging is assuming wrong.
- **CI on this repo queues ~25 minutes before starting**, and a separate run
  (`32984139773`, `feat/pfp-ui-1`) has been stuck `queued` ~18 h. Actions is available and
  green, not billing-blocked — the brief's premise 4 is out of date.
- **Measured dimensions the content pass needs:** block **252.43 × 111.99** at 1440×777, label
  line **14.25px**, value line **11px**, 1:1 placeholder **44 × 44**, block row floor **97px**.
- **CLS is not measurable through the CDP browser tools** — a hidden tab never paints, so
  `layout-shift` records nothing and returns a clean-looking zero. Recorded to memory.

## 6 · Time

One session, ~07:37Z → close, 2026-08-27. Recon → plan → four slices → guards → reviewer
cascade → merge → deploy → report, uninterrupted, no operator input.

---

**Closing ritual.** *Should `CLAUDE.md` / `AGENTS.md` / the workflow / the tracker change as a
result of this session?* — **`AGENTS.md` §3 yes** (its `debate/` inventory describes
`ResolverCards` as the resolver + X-official card pair; it now renders four blocks) and
**`docs/parked.md` yes** (the placeholder count). Both are FLAGGED and deliberately NOT edited:
this run is fenced against prescriptive doc edits, so authoring them is the doc lane's.
`CLAUDE.md` needs no change. The brief itself needs two corrections — premise 4 (Actions is
available) and the addition of a "check whether `main` moved mid-run" step — noted for whoever
maintains `docs/overnight-run.md`.
