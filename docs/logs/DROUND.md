# DROUND — session log

**Task:** Đ display rounding — round every Đ value rendered to a user to 0 dp,
ROUND_HALF_UP, product-wide. View-layer only. Combined plan + execute, unattended.

## What landed (files + PR#)

**DRAFT PR [#268](https://github.com/zugzwang-foundation/experiment/pull/268)** —
base `main`, head `feat/dround-display-rounding`, base commit `78b2952` (SPEC.1
1.0.22). Implementation commit `62e9701` (+ this docs commit).

- `src/components/debate/format.ts` — `formatDharma` renamed → `formatDharmaExact`
  (trim-only, unchanged body); new rounding `formatDharma` (dedicated
  `DisplayDecimal` clone, `ROUND_HALF_UP`, `isZero()` −0 guard, malformed→exact
  fallback); new `displayNetProfitLoss` (§23 tile identity).
- `src/server/debate-export/serialize.ts` — import `formatDharmaExact as formatDharma`.
- `src/components/debate/composer/SellModule.tsx` — seed → `formatDharmaExact` + `dround-allow` marker.
- `src/components/profile/ProfileTiles.tsx` — Net P/L via `displayNetProfitLoss`.
- `src/app/(admin)/admin/moderation/_components/ReviewFeed.tsx` — raw render wrapped.
- `docs/specs/SPEC.1.md` — §0 → 1.0.23; §10.8 0-dp rule; §20 change-log.
- Tests: `tests/unit/debate/format.test.ts`, `tests/unit/debate/sell-seed-identity.test.ts`,
  `tests/unit/profile/tile-identity.test.ts`, `tests/unit/design/no-raw-dharma-render.test.ts`.

Gates: `tsc` clean · `biome check .` clean · `next build` clean (placeholder env) ·
full suite **275 files / 1967 tests green** (+43). `@code-reviewer`: clean, no
CRITICAL/HIGH/MEDIUM. Commit signed (ED25519).

## Decisions made

- **R3 via aliased import** (`formatDharmaExact as formatDharma`) — the only reading
  that reconciles step 3d ("re-point serialize → formatDharmaExact") with step 4
  ("change ONLY the import; nothing else in that file"). Body untouched; export
  precision preserved (serialize unit + integration green).
- **Guard = two checks.** Check B: raw JSX-child money render (`(?<!=)\{ member.chain.IDENT \}`,
  member-only so wrapped `formatX(…)` never matches; `(?<!=)` excludes attribute
  values / prop pass-throughs). Check A: `formatDharmaExact(` used in a component
  (excludes the definition module `format.ts`; window-allowlisted by the
  `dround-allow:` marker; asserts exactly one marker). Empirically verified to catch
  the raw ReviewFeed (revert→red→restore) and allowlist only the one seed line.
- `DisplayDecimal = Decimal.clone({precision:50})` (mirrors `CpmmDecimal`); rounding
  mode passed **explicitly** at each call site (never a clone default).
- `displayNetProfitLoss` lives in `format.ts` (isomorphic display module; issuance
  recovered exactly, then round0 of the displayed operands).
- Branch left **1 commit behind** origin/main — the concurrent lane merged #266
  (`docs/plans/UI.19.md`, docs-only, non-overlapping) mid-session; no rebase per
  guardrail 12; squash-merge will be clean (zero file overlap).

## Open questions (for the web-review gate)

- `@code-reviewer` LOW: confirm the per-**Đ1 multiplier** strip (`formatMultiplier`,
  "Đ1 → Đ2.63x" in PositionStrip/SlotHeader) is intentionally excluded — the rider
  says "odds multipliers … are not Đ values", and the absolute-Đ TO-WIN / position
  values on those strips DO round via `formatDharmaGrouped`. Believed intended.
- Guard is identifier-coupled: a Đ value surfaced under a non-canonical identifier
  (`toWin`, `shares`, `receive`, `unit`) would not be caught. Acknowledged in the
  guard header; the current tree is clean. (`shares` is a share quantity, not Đ.)
- `serialize.ts` (server) imports the formatter from `components/debate/format.ts` —
  pre-existing; `format.ts` is isomorphic (no `server-only`). A `src/lib/` home would
  be cleaner but is out of DROUND's surgical scope.
- The `serialize.ts` file-doc line ("the live UI's `formatDharma` (ungrouped) is left
  untouched") is now stale after the alias, but was left untouched per step 4's
  "nothing else in that file."

## Next session starts at

Web-review gate on PR #268. On approval: mark ready → confirm CI (`ci`) green →
squash-merge. No further code. Then `git worktree remove ../wt-dround` and record the
squash-merge SHA on `main` as the canonical reference.

## Context to preserve

- Worktree: `/Users/hrishikesh/code/zugzwang/wt-dround` (has its own `node_modules`,
  installed `--frozen-lockfile`; no `.env.local` — build ran on placeholder env).
- The one `formatDharmaExact` allowlisted call = the SellModule seed (`dround-allow`).
- 33-site inventory unchanged since recon baseline `903e185`; no new Đ render sites.

## Surprises caught + fixed in-session

1. **Worktree has no `.env.local`** (gitignored) → `next build` failed on
   `DATABASE_URL is not set` in the unrelated `alarms-drain` route. Not a code
   regression — proved the build compiles via the test-suite's placeholder env
   (forbidden to read/copy the real `.env*`).
2. **origin/main advanced mid-session** (#266, `UI.19.md`) → appeared as a spurious
   `UI.19.md` "deletion" in two-dot `git diff origin/main`. Confirmed NOT in the PR
   (three-dot diff clean, `git status` clean, file not in HEAD).
3. **ReviewFeed whitespace mangle** while wrapping the render (a stray duplicate
   "prior") — caught by re-reading; fixed to preserve the exact rendered footer text
   (no test covers that string), verified via the origin/main diff.
4. **Recon-count reconciliation:** BookmarkCard's 4 Đ sites looked "new" but were
   present at recon baseline `903e185` (part of the 33) → not a >3-new HALT.

## Time

Unattended overnight session, 2026-07-23. Hard stop at the DRAFT PR (as instructed).
