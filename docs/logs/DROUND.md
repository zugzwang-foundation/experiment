# DROUND — session log

**Task:** Đ display rounding — round every Đ value rendered to a user to 0 dp,
ROUND_HALF_UP, product-wide. View-layer only. Combined plan + execute + two
pre-merge remediation passes at the web gate.

## What landed (files + PR#)

**DRAFT PR [#268](https://github.com/zugzwang-foundation/experiment/pull/268)** —
base `main`, head `feat/dround-display-rounding`, base commit `78b2952` (SPEC.1
1.0.22). Branch commits, in order:

1. `62e9701` — feat: the 0-dp rounding formatter + rename + the four render fixes.
2. `b633503` — chore: plan + this log.
3. `5035183` — fix (Gate C remediation): un-alias serialize, the reply split-bar
   displayed total, the §10.8 multiplier clause.
4. this commit — §10.8/§20 reconciled to *two* displayed-space identities, the
   `displaySplitTotal` rounding-mode pin, and this log corrected to final state.

Production files:
- `src/components/debate/format.ts` — trim-only `formatDharma` renamed →
  `formatDharmaExact`; new rounding `formatDharma` (dedicated `DisplayDecimal`
  clone, `ROUND_HALF_UP` passed explicitly, `isZero()` −0 guard, malformed→exact
  fallback); new `displayNetProfitLoss` (§23 Net P/L tile identity).
- `src/server/debate-export/serialize.ts` — plain `formatDharmaExact` import +
  both call sites renamed (see the reversal below); the `.md` export keeps full
  precision.
- `src/components/debate/composer/split-bar.ts` — new `displaySplitTotal`
  (`round0(support) + round0(counter)`, mode pinned `ROUND_HALF_UP`);
  `computeSplitBar` unchanged (its `totalDharma` stays the EXACT sum).
- `src/components/debate/composer/ReplySplitBar.tsx` — renders the displayed
  split total; destructures only `supportPct` from `computeSplitBar`.
- `src/components/debate/composer/SellModule.tsx` — seed → `formatDharmaExact` +
  `dround-allow` marker.
- `src/components/profile/ProfileTiles.tsx` — Net P/L via `displayNetProfitLoss`.
- `src/app/(admin)/admin/moderation/_components/ReviewFeed.tsx` — raw render wrapped.
- `docs/specs/SPEC.1.md` — §0 → 1.0.23; §10.8 the 0-dp rule (0-dp/HALF_UP, `-0`
  forbidden, full precision through ledger/engine/DTOs/export/dataset, rounded
  values terminal with **displayed-space aggregate identities** as the sole
  exception — the §23 Net P/L tile and the reply split-bar total, plus the
  multiplier-clause carve-out); §20 change-log row (edited in place, 1.0.23 is
  unmerged).

Tests: `tests/unit/debate/format.test.ts`, `.../sell-seed-identity.test.ts`,
`tests/unit/profile/tile-identity.test.ts`,
`tests/unit/design/no-raw-dharma-render.test.ts`, plus the 3 `displaySplitTotal`
cases in `tests/unit/composer/split-bar.test.ts`.

Gates: `tsc` clean · `biome check .` clean (1 pre-existing unrelated warning) ·
`next build` clean (placeholder env locally; real build green in Vercel CI) ·
full suite **275 files / 1970 tests green**. Commits signed (ED25519).

## Decisions made

- **serialize R3 — the alias was tried, then REVERSED.** `62e9701` re-pointed
  serialize via an aliased import (`formatDharmaExact as formatDharma`, body
  untouched) — the literal reading of "re-point to Exact" + "change ONLY the
  import." At the gate this was reversed (`5035183`): the alias re-created the
  exact ambiguity the rename existed to remove (a reader sees `formatDharma(...)`
  in serialize but it silently resolves to the *exact* formatter). serialize now
  imports `formatDharmaExact` **plainly**, both call sites are renamed to
  `formatDharmaExact(...)`, and the stale file-doc line was corrected to state
  that the `.md` export uses the exact formatter deliberately (full precision,
  SPEC.1 §10.8) while the view layer's `formatDharma` rounds. `serialize.test.ts`
  (unit + integration) stays green — full precision preserved.
- **Reply split-bar — a second displayed-space identity, found at the gate.**
  `ReplySplitBar` rendered Support / Total / Counter where Total was the EXACT
  sum, so independent rounding could show `138 / 275 / 138` (137.7 + 137.7). The
  R2 tile-identity treatment was applied to this second surface: new pure
  `displaySplitTotal(support, counter) = round0(support) + round0(counter)` (in
  `split-bar.ts`, not inlined), rendered via `formatDharmaGrouped`, so the row is
  `138 / 276 / 138`. `computeSplitBar.totalDharma` is deliberately kept as the
  EXACT sum — it is a pinned money-law contract in `split-bar.test.ts` (18-dp
  cases) and the bar-fill proportion stays on that exact basis (a proportion is
  not a Đ value). The mode is pinned `ROUND_HALF_UP` at the `toFixed` call so
  `ComposerDecimal`'s inherited `ROUND_HALF_EVEN` default can never apply. Three
  new tests cover it.
- **§10.8 / §20 reconciled (this commit).** After the split-bar landed, the rider
  and change-log still said "the §23 tile identity as the sole exception" — now
  inaccurate. Reworded (web-authored, verbatim) to "**displayed-space aggregate
  identity**" naming both surfaces; version stays 1.0.23, no new change-log row
  (the row was edited in place since 1.0.23 is unmerged).
- **Guard = two checks.** Check B: raw JSX-child money render
  (`(?<!=)\{ member.chain.IDENT \}`, member-only so wrapped `formatX(…)` never
  matches; `(?<!=)` excludes attribute values / prop pass-throughs). Check A:
  `formatDharmaExact(` used in a component (excludes the definition module
  `format.ts`; window-allowlisted by the `dround-allow:` marker; asserts exactly
  one marker). Verified to catch the raw ReviewFeed (revert→red→restore).
- `DisplayDecimal = Decimal.clone({precision:50})` (mirrors `CpmmDecimal`);
  rounding mode passed **explicitly** at every call site (never a clone default).
- Branch left **behind** origin/main — the concurrent lane merged #266/#267
  (`docs/plans/UI.19.md`, docs-only, non-overlapping); no rebase per guardrail 12;
  squash-merge will be clean (zero file overlap).

## Open questions (for the web-review gate)

- **`computeSplitBar.totalDharma` has NO remaining production consumer.**
  `ReplySplitBar` now destructures only `supportPct`; `totalDharma` is exercised
  only by `split-bar.test.ts` (the exact-sum money-law contract). Kept as-is this
  run (removing it would break that pinned contract and exceed surgical scope).
  Decision for the gate: keep the tested exact-sum contract, or retire
  `totalDharma` from `computeSplitBar` and fold the exact-sum test into a
  standalone assertion?
- Guard is identifier-coupled: a Đ value under a non-canonical identifier
  (`toWin`, `shares`, `receive`, `unit`) would not be caught. Acknowledged in the
  guard header; the tree is clean (`shares` is a share quantity, not Đ).
- `serialize.ts` (server) imports the formatter from `components/debate/format.ts`
  — pre-existing; `format.ts` is isomorphic (no `server-only`). A `src/lib/` home
  would be cleaner but is out of DROUND's surgical scope.

*(RESOLVED, was open at commit 1: the per-Đ1 multiplier strip is codified as
excluded — §10.8 multiplier clause, `5035183`. The stale serialize file-doc line
is corrected — the R3 reversal, `5035183`.)*

## Next session starts at

Web-review gate on PR #268. On approval: mark ready → confirm CI (`ci` + Vercel
build) green → squash-merge. No further code. Then `git worktree remove
../wt-dround` and record the squash-merge SHA on `main` as canonical.

## Context to preserve

- Worktree: `/Users/hrishikesh/code/zugzwang/wt-dround` (own `node_modules`,
  `--frozen-lockfile`; no `.env.local` — build runs on placeholder env; real
  build is green in Vercel CI).
- The one `formatDharmaExact` allowlisted call = the SellModule seed (`dround-allow`).
- Two displayed-space aggregate identities now exist: the §23 Net P/L tile and
  the reply split-bar total.

## Surprises caught + fixed in-session

1. **Worktree has no `.env.local`** (gitignored) → `next build` failed on
   `DATABASE_URL is not set` in the unrelated `alarms-drain` route. Not a code
   regression — proved via placeholder env; real build is green in Vercel CI.
2. **origin/main advanced mid-session** (#266/#267, `UI.19.md`) → spurious
   `UI.19.md` "deletion" in two-dot `git diff origin/main`. Confirmed NOT in the
   PR (three-dot diff clean; file not in HEAD).
3. **ReviewFeed whitespace mangle** while wrapping the render — caught by
   re-reading; fixed to preserve the exact rendered footer text.
4. **serialize alias ambiguity** — the commit-1 alias re-created the ambiguity the
   rename removed; reversed to a plain `formatDharmaExact` import at the gate.
5. **Split-bar inconsistency** — the STAKED total could render `138 / 275 / 138`;
   fixed with the second displayed-space identity, and the §10.8 "sole exception"
   wording reconciled to name both.

## Time

Unattended session, 2026-07-23. Hard stop at the DRAFT PR across all passes.
