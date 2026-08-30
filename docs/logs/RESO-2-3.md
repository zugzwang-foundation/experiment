# RESO-2 + RESO-3 — session log

**Task** RESO-2 (CHANGE 1 · 4 · 5) then RESO-3 (CHANGE 6 · 7) — the resolution block row
**Mode** fast · **Session** 2026-08-27 · **Branch** `feat/reso-2-block-row-width` · **PR** [#428](https://github.com/zugzwang-foundation/experiment/pull/428) — **OPEN, UNMERGED**
**Preview** `https://experiment-cdp54tetv-zugzwang-worlds-projects.vercel.app` — canary `319a50e` = HEAD, verified

---

## 1 · What landed

| SHA | What |
|---|---|
| `a5f6d4b` | CHANGE 1 — the rail's width is reserved when the rail is absent |
| `6458e22` | CHANGE 4 + 5 — shorter block, label reads first |
| `319a50e` | CHANGE 6 + 7 — criterion disclosure unrendered; block internals horizontal |

**Files:** `ResolverCards.tsx` · `HeadZone.tsx` · `DebateView.tsx` ·
`tests/unit/debate/render/{resolver-cards,criterion-disclosure}.test.tsx` ·
`tests/unit/design/debate-height-chain.test.ts`.

**Not touched:** `src/server/**` (**zero files**) · schema / migrations (head unmoved) · the chart
component · the read path · staging · the label strings · the `headzone-stack` zero-overflow guard ·
`CriterionDisclosure.tsx` itself (retained, unrendered, still exported).

**Gates:** `tsc` 0 · `biome` 0 · `next build` 0 · `tests/unit/debate` + `tests/unit/design`
**45 files / 442 tests, exit 0**.

## 2 · Measurements (1440×777, pinned in-page iframe, canary asserted in the same call)

| | before `6458e22` | after `319a50e` |
|---|---|---|
| arena height | 436.47 | **482.97** (+46.50) |
| `headzone-stack` overflow | 0 | **0** |
| row | 673.73 × 95.99 | 673.73 × 95.99 |
| block | 162.43 × 95.99 | 162.43 × 95.99 |
| glyph | 30 × 30 | **77.99 × 77.99** |
| label box | 138.43, unclipped | **50.44, CLIPPED** |
| disclosure | 34.5px box, closed | absent |

The +46.50 is exactly the disclosure's cost — 34.5px box plus the container's 12px `gap-3` —
which is the figure CRIT-1 recorded, refunded to the arena and nowhere else.

## 3 · Open questions

1. ⚠ **THE ONE THING THAT NEEDS A FOUNDER CALL. All four labels truncate at the shipped width,
   and the two rulings producing it are mutually exclusive.** Text column 50.44px against labels
   needing 54 / 61 / 68 / 75px. At 252.43px block width the column is 140.44px and all four fit —
   measured live by hiding CHANGE 1's spacer in the DOM. 4 × 252.43 + 3 gaps **is** the full-bleed
   row, so *"~252px per block"* and *"the blocks must not take the chart rail's space"* cannot both
   hold at 1440. Not decided here: CHANGE 7 says width may not move, and width is CHANGE 1's
   territory. Recorded in `ResolverCards.tsx` at the site.
2. **The brief said "branch from `origin/main`" and that was not possible as written.** RESO-3
   describes CHANGE 3/5 as already shipped and tells me not to re-edit label strings — true only on
   this branch. `origin/main` still carried `Closes`/`Context`. Branching there would have
   discarded CHANGE 1/4/5 and forced exactly the re-edit the brief forbade, so RESO-3 was stacked
   onto the open PR instead. `origin/main` was merged in (`c5976c0`, Ritam-r2 #424 — server/storage
   only, zero overlap).
3. **The brief's "~38px" square matches neither build** — 30px shipped at RESO-2, 44px before it.

## 4 · Next session starts at

**Founder ruling on §3.1**, then whatever it implies: either drop the `HeadZone.tsx` spacer (blocks
→ 252.43, labels fit) or accept clipped labels and re-open the internals.

## 5 · Context to preserve

- **A `python3` splice anchored with `.index()` on a closing-tag string duplicated a whole
  function** — the first match was an earlier function's close, so `s[:start] + new + s[end:]` with
  `end < start` re-appended the region between them. `tsc` caught it as a duplicate implementation;
  nothing else would have. **Use `.rindex()` for a trailing anchor, and assert `start < end`.**
- **A fresh worktree has no `.env.local`, so `just verify` fails at page-data collection while the
  compile is clean.** Not a regression. Rebuild with the `tests/_setup/env.ts` placeholders
  extracted from the file itself; never read a real `.env*`.
- **Inverting a guard beats deleting it.** CHANGE 6's removal is now held by the same three receipts
  that used to hold the mount. Deleting them would have left a one-line re-add unopposed — and the
  component is deliberately still in the repo, which makes that re-add trivial.
- **Revert-to-red, both changes, tree restored clean after each:** re-mounting the disclosure reds
  4; putting `w-[30px]` back on the glyph reds 1.

## 6 · Time

One session, 2026-08-27, fast mode, three operator turns (CHANGE 1 · CHANGE 4+5 · CHANGE 6+7).

---

**Closing ritual.** *Should `CLAUDE.md` / `AGENTS.md` / the workflow / the tracker change?* —
**`AGENTS.md` §3 yes**, and this is the second run to flag it: its `debate/` component inventory
still does not list `CriterionDisclosure`, which is now in the repo *and* unrendered — a state the
inventory has no way to express and the exact thing a reader would misread as dead code. Flagged,
not edited; this run is UI-scoped. `CLAUDE.md` needs no change.
