# HTML-FINISH · MARKET DETAIL (`/m/[slug]`) — SESSION LOG

Branch `htmlfinish/market-detail`, cut from `origin/main` = `fd4b357`.
Plan: `@docs/plans/HTML-FINISH-MD.md` (committed verbatim at C0, md5
`079df6560c1d6fa668ee6eb97e3028f2`, 770 lines).
Run report (out of tree, operator-held): `~/Downloads/HTML-FINISH-MD-RUN.md`.

---

## PHASE 1 · FRAME — complete

### What landed

| # | Commit | SHA | Rows |
|---|---|---|---|
| C0 | `docs(plans): commit the ratified HTML-FINISH · MARKET DETAIL plan` | `3b8de11` | — |
| C1 | `feat(debate): the headzone becomes a two-column, arm-scoped frame` | `1279064` | 1 |
| C2 | `test(debate): pin the headzone arm split` | `9efd18a` | 1 (guard) |
| C3 | `feat(debate): the left column reorders to question → attrs → criterion` | `8ab395a` | 6 |
| C4 | `feat(debate): the price chart moves into the header's right rail` | `c4b465a` | 4 |
| C6 | `feat(debate): the detail price bar collapses to one row` | `eef4cde` | 7 + rail placement |
| C6b | `revert(debate): row 7 backs out — the one-row bar needs an out-of-fence guard` | `157804f` | ✗ 7 |
| C8 | `feat(debate): the focused post's image moves into the header rail` | `0c447bd` | 11 |
| C9 | `feat(debate): the focused post's split bar pins to the stack foot` | `09b3231` | 16 |

**Files:** `+src/components/debate/HeadZone.tsx` · `MarketHeader.tsx` ·
`PostFocusHeader.tsx` · `DebateView.tsx` · `DebateColumn.tsx` · `PriceBar.tsx`
(reverted) · `+tests/unit/design/debate-height-chain.test.ts` ·
`+tests/unit/debate/render/head-zone.test.tsx` · `market-header.test.tsx` ·
`price-percent-pair.test.tsx` · `comment-image.test.tsx`.

**Rows landed: 1, 4, 6, 11, 16** (+ the rail placement half of 7).
**Rows halted: 5, 7, 8.** PR# — not yet opened at the time of writing.

### Decisions made

1. **The rail is a FRACTION (`lg:w-1/4`), never d5's `flex:0 0 340px`.** A fixed
   track is exactly the defect `shell/page-container.test.ts` records for the
   profile ("two 356px columns at 1440 — IDENTICAL to its 768 rendering"), and
   the mockup declares no breakpoint at all.
2. **The rail is not rendered when it has nothing to hold** (`right={null}`),
   rather than rendered empty — PD-3-09 / OD-6, the ruling that deleted the
   deferred-work placeholder box from `MarketHeader`.
3. **Each ternary arm is a FRAGMENT, not a wrapper div**, so the headzone and
   arena bands are sibling children of the container. Otherwise the arena's
   `flex-1 min-h-0` resolves against a wrapper and the height chain breaks
   invisibly. Cost: the post arm's band gap moves from `gap-4` to the
   container's `gap-5`.
4. **The debate height chain is NOT the profile's.** `(public)/layout.tsx` rules
   `min-h-*`, never `h-*`; `/m/[slug]` carries no founder ruling making it a
   one-screen design, so no definite height is added and the new guard forbids
   `h-full` / `h-screen` / `h-[…]` on its band nodes.
5. **`CommentImage` is untouched by row 11.** `.hpimg`'s `aspect-ratio:16/9` +
   `overflow:hidden` CROP, against T2 (§17 H-T2) and canon §107's "shown whole ·
   any orientation". d5 agrees — `:955` marks that rule "flag 1 paused".
6. **C1B (the `wide` container swap) did NOT land.** See Open questions.

### Surprises caught + fixed in-session

- **The C4 comment went stale one commit later.** C6 moved the price bar into
  the rail, which falsified C4's in-code note ("and so no rail at all"). It was
  corrected AT THE SITE rather than annotated below — an amendment a reader
  reaches second is not an amendment (**O-4**).
- **A guard the plan did not know about.** `tests/unit/discovery/render/
  price-bar-presets.test.tsx` byte-pins the `detail` render; §8's guard map
  lists none of it. Rows 7 and 8 were built, verified green, and then **backed
  out** rather than editing an out-of-fence file. See Open questions.

### Open questions — all three need a founder ruling

- **OQ-MD-1 · Row 5 is blocked at SPEC.1 §9.** The collapsed chart is pinned
  "lines only, no axis, no nodes" at `SPEC.1.md:490` and `:515`, with a §17
  acceptance row at `:1260` and F-DEBATE-5's cite at `:517`. `:492` scopes the
  canon-owned escape hatch to EXPANDED mode only. The 1.0.30 Discovery
  precedent does not reach it: that one turns on the sparkline being
  DECORATIVE, and §9 says this chart is explicitly not `aria-hidden`.
  ⇒ Needs a **web-authored** §9 amendment at four sites, or the row is struck.
  ⚠ The natural implementation would have gone GREEN past the existing test
  (d5 puts its ticks outside the `<svg>`, so different testids) — the block is
  on the SPEC, deliberately, not on the guard.
- **OQ-MD-2 · Rows 7 + 8 need one line of allow-list.**
  `tests/unit/discovery/render/price-bar-presets.test.tsx` must re-capture
  `DETAIL_BASELINE`, which is that guard's own documented mechanism (its
  docblock records the POLISH.3 re-capture in terms) — so this is **not** a
  predicate relaxation and not H3-c. It is an edit §11 does not authorise.
  Its second assertion, `detail-carries-no-data-size-attribute`, justifies
  itself as *"a surface this task is not opening"* — a ground this task spends.
  ⇒ Rule the allow-list line and both rows land as already built.
- **OQ-MD-3 · C1B is UNMEASURED, so it did not land.** The plan's trigger is a
  browser measurement at 1440 and 768 against the compiled CSS. It could not be
  taken: the local database holds **zero markets and zero comments**, so
  `/m/[slug]` cannot be served, and seeding it means driving the engine
  (users → identity pool → TOS → market → open → bets-with-comments), which is
  out of this task's fence.
  ⚠ **What CAN be said: the named trigger cannot fire by construction.** It
  detects a FIXED track ("same width at 1440 as at 768"). Both the rail
  (`lg:w-1/4`) and the arena columns (`flex-1`) are PROPORTIONAL, so they track
  the container, and the container tracks the viewport up to `max-w-5xl`.
  ⚠ **What remains genuinely open** is the separate question the trigger was a
  proxy for: whether 1024px is too narrow for a two-column header ABOVE a
  two-column arena. At the cap the rail is ~244px and each arena column ~480px.
  That is a design judgement, and the plan was explicit that it would not be
  asserted without a browser. ⇒ Founder's call, or re-run the measurement once
  staging carries data.

### Next session starts at

**Phase 2, C11** — `feat(debate-view): market media + outbound video reach the
header`, the first of the three fenced `src/server/**` files. ⛔ Read plan §7
(the +1 statement budget) and §11 (the three-file fence) before the first edit;
a fourth `src/server/**` file is **H2-a** and halts phase 2 whole.

### Context to preserve

- **Build env.** This worktree has no `.env.local`. `next build` runs with the
  `tests/_setup/env.ts` placeholder values plus `ZUGZWANG_ENV=preview`. No
  `.env*` file is read or written.
- **`just` is not on a bash subshell's PATH** — it lives on the mise shims path,
  which only the interactive zsh has.
- ⚠ **Never pipe a gate command to `tail`.** The first verify attempt reported
  `EXIT=0` while failing on `exec: just: not found`; any trailing command owns
  the compound exit.
- **`pnpm vitest run` directly**, never via `just` (which points at the cloud DB).
- **H1-e is DISCHARGED** — measured, not assumed. Row 8's `onPick` was fully
  wired and `next build` compiled with both Discovery `PriceBar` sites intact.
  `MarketHeader`'s only consumer is `DebateView`, which is `"use client"`. If
  OQ-MD-2 is ruled, row 8 needs no re-measurement.

### Time

Phase 1: 2026-08-15 23:58 UTC → 2026-08-16 ~06:00 UTC.
