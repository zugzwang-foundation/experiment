# MEDIA-SECOND-ROW

The market-detail media panel currently renders the same `market_media` row
as the Discovery tile (the `is_default` row). This task makes the panel
render a **different** row: the lowest-`display_order` non-default row,
falling back to the `is_default` row when a market carries only one row
(every market today). The Discovery tile is unaffected.

Full research, measurements, and the plan-mode report this file distills
live at `~/Downloads/zz_MEDIA-SECOND-ROW_plan_2026-08-21T1222.md` (not
committed — an O-11 relay artifact, operator-side). This file is the
in-repo, subagent-readable summary of that plan plus the operator's
rulings on the questions it raised.

## Rulings (operator-ratified, do not re-open)

- **R1 · ADR-0034.** D-1 governs viewer-scoped state only. This change
  carries none (market-scoped row selection, no session/user_id). The
  `load-debate-view.ts:211` edit is an ordinary read-model diff, not a
  violation of D-1's viewer-independence guarantee.
- **R2 · data step.** Option A — raw INSERT of the 8 second-media rows,
  staging-only. `market_media` is Bucket C (mutable, no append-only
  trigger); `market_media_one_default_per_market_uq` holds the
  exactly-one-default invariant independently of how a row arrives. NOT
  part of Slice 1.
- **R3 · bitcoin source.** Regenerated (see Slice 3). NOT part of Slice 1.
- **R4 · SPEC.1 §9.** Narrowing amendment, same commit as Slice 1: the
  header renders a single image (this task's selection rule), not an
  auto-advancing carousel. The carousel is deferred and named, not
  dropped.

## The seam (plan item 1)

`getDefaultMarketMediaUrl` (`src/server/discovery/media.ts:40-63`) has
exactly two call sites: `discovery/list.ts:82` (Discovery tile — keeps
calling this function, unmodified, forever) and
`debate-view/load-debate-view.ts:211` (the panel — moves to the new
function below).

**New sibling function, not a parameter**: `getSecondaryMarketMediaUrl`,
same file, beside the existing function. One query:
```sql
SELECT r2_object_key FROM market_media
 WHERE market_id = $1
 ORDER BY is_default ASC, display_order ASC
 LIMIT 1
```
`is_default ASC` sorts `false` before `true`, so a non-default row (any
`display_order`) always outranks the default row when one exists. A
market with only its `is_default` row (every market today) returns that
row — the fallback (item 3) is the `ORDER BY`'s natural result, not a
branch.

## Query cost (plan item 4)

ADR-0026 Driver 8 (`docs/adr/0026-market-media.md:68`): *"the media set,
which row `is_default`, and `media_video_url` load with the market header
[...] no extra round-trip [...] zero round-trips."* The one-query design
above satisfies this exactly: 1 `SELECT` before this slice
(`getDefaultMarketMediaUrl`), 1 `SELECT` after (`getSecondaryMarketMediaUrl`)
— same count, not two independently-queried functions.

## SPEC.1 §9 divergence (plan item 9)

SPEC.1 §9 "Market media — participant display" specifies an
**auto-advancing carousel of the market's images in `display_order`**
(`docs/specs/SPEC.1.md:478`). This slice's behaviour (one fixed image, no
cycling) narrows that — R4 above. Amendment lands same-commit with this
slice's code.

## Blast radius, found at execute (not fully caught in plan mode)

`market.mediaImageUrl` feeds **two** render sites, not one:
`MarketHeader.tsx:150` → `MarketMediaPanel` (market-arm header) **and**
`PostFocusHeader.tsx:90` → `FocusMarketCard` (post-arm exit rail) — the
same field, both consuming whatever `getSecondaryMarketMediaUrl` resolves.
This was already documented in `load-debate-view.ts`'s own docblock at the
call site (missed in the plan-mode report, caught re-reading the file
before editing it). Both surfaces move together; there is no way to give
one the second row while the other keeps the default under the current
single-field design, and this slice does not attempt to thread them apart.

## Test plan (plan item 5) — this slice's scope

New file `tests/integration/market-media-selection.integration.test.ts`:
1. `tile (getDefaultMarketMediaUrl) is unchanged when a second row exists`
2. `panel (getSecondaryMarketMediaUrl) picks the lowest-display_order
   non-default row`
3. `panel falls back to the is_default row when only one row exists`
4. `neither surface 500s on a market with zero market_media rows`
5. `exactly-one-is_default invariant still holds` (existing storage-layer
   backstop, re-run not re-written)

## Explicitly NOT this slice

- The 8-row data insert (R2, Option A) — a separate operational step.
- The 8-image asset re-encode/upload (Slice 3), including the corrected
  `Bitcoin final.png` source.
- Any admin-form change (none needed — `create-market-form.tsx` already
  produces the row shape this slice reads; see plan item 8).
