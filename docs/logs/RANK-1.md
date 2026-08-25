# RANK-1 — session log

**Time:** 2026-08-22, 03:40 → 07:0x IST (autonomous overnight run, single session)
**Plan:** `docs/plans/RANK-1.md`
**Worktree:** `/Users/hrishikesh/code/zugzwang/wt-rank1`, branch
`fix/rank-1-surviving-basis-ranking`, cut from `origin/main` `7fdaa99`

---

## What landed

**PR [#391](https://github.com/zugzwang-foundation/experiment/pull/391)** —
`fix(ranking): rank follows the money that stayed, not the money that came`.
⛔ **NOT MERGED** (fence F4). 50 files, +1978 / −112.

All three ranking rulers now key off `COALESCE(lots.surviving_basis, bets.stake)`
instead of the frozen `bets.stake`, closing a confirmed exploit: a fee-less CPMM
made a top slot buyable and then refundable for dust, permanently, on every post
in every market.

| Area | Files |
|---|---|
| Substrate contract | `src/lib/ranking.ts` (+2 required fields on each of `PostSubstrate` / `ReplySubstrate`; `tiebreak()` and `compareReply()` byte-unchanged as code) |
| Query sites (**five**, not the three the ruling named) | `src/server/debate-view/ranking-substrate.ts`, `debate-view/reply-substrate.ts`, `profile/arguments.ts`, `bookmarks/list.ts`, `scripts/verify-ranking-staging.ts` |
| Sixth site, found by the cascade | `src/server/discovery/hero.ts` — the `Đa → Đb` arrow re-paired onto the lot |
| Badges (R-B) | `components/debate/ArgProfile.tsx` (one component, five call sites), `components/profile/ArgumentList.tsx` |
| DTO plumbing | `debate-view/load-debate-view.ts`, `profile/arguments.ts`, `bookmarks/list.ts` |
| Docs | `docs/adr/0039` (R4 amended + new Patch record P1 + D-5), `docs/specs/RANKING.md` (§2, §3.3, §3.4, §3.6, §7, new §7.3, §8, header, change log) |
| Tests | 4 new files, 24 new tests; 2 shipped tests updated |

## Decisions made

1. **Required, not optional, substrate fields** (O-1). Cost 11 fixture updates
   and found two sites nobody had listed. Optional would have let a divergent
   site ship green — the exact failure R-F exists to prevent.
2. **The substitution lives at the query layer, not in the comparators.** One
   field feeds the ruler and the badge, so they cannot drift. That is R-B made
   structural rather than promised.
3. **A separate local database (`zz_rank1`)** rather than waiting on or colliding
   with another session's suite. pg_cron stripped exactly as `ci.yml` does;
   migrations restored byte-identical afterwards (F3 held).
4. **The bookmarks fixture was given a second lot rather than having its guard
   softened.** `staked !== stake` worked *because* one number was frozen — the
   distinction RANK-1 removes. In a one-lot holding they are now equal by
   definition, so the assertion would have passed while proving nothing. **This
   is the judgement call in this run most worth a second opinion.**
5. **The Discovery hero arrow was fixed, not just flagged.** My own S6 note
   caught only the missing strikethrough; the reviewer caught the worse half —
   `Đ 0 → Đ 500`, a phantom gain on a public panel. Both halves now read the same
   lot, which also retires the `min(betShares, heldQuantity)` approximation.
6. **The claim was scoped rather than the code widened.** The security pass found
   the count lanes are capturable, making *"if the money can leave, the rank it
   bought leaves with it"* untrue as written. RANKING.md §2 now says so.
7. **The fallback's stated justification was corrected.** ADR-0039 claimed it "is
   not invisible when it happens". It is entirely invisible (O-3).

## Open questions

| # | Question | Owner |
|---|---|---|
| **RANK-1-D1** | Should the COUNT lanes (`n`, `lop`, `n^b`) decay on exit? Filtering counts on survival means an argument someone made and exited stops being *counted as having been made* — a different claim from *stops carrying weight*, and R9 makes Sold permanent precisely because it happened. **Until ruled, `topOrder` #1 is buyable for dust via self-reply.** | founder |
| **RANK-1-D2** | A lot-less bet is now the one privileged un-decayable row class, silent and unremediable (R8 forbids back-fill). Reachable only during an ADR-0024 promote/rollback window. Build the detector `0025_lots.sql` describes in prose? | founder / ops |
| **RANK-1-D3** | `src/server/profile/tiles.ts` still sums frozen stake. Pre-dates this PR (LOTS-1 missed it). Should the per-user tiles decay? | founder |
| **RANK-1-D4** | The `.md` export labels surviving basis "Stake"; `market-meta.ts`'s total is still frozen, so they no longer reconcile, and `debate-export.md` §10.5 now states a superseded reason for the gap. | founder (published-artifact copy) |
| **RANK-1-D5** | Discovery hero: no `Sold` tag / strikethrough. Founder-ruled tile composition. | founder |
| **RANK-1-D6** | `ArgProfile`'s new props are optional while the substrate fields are required — a sixth call site could forget them and compile clean. | recorded |

## Next session starts at

**Read PR #391's body, then rule RANK-1-D1.** Merge is recommended and is
independent of that ruling — D1 is a pre-existing surface this PR makes legible,
not a regression it introduces. If merging: squash, then push `staging` **before**
any branch (O-10), and expect `migrations: "drift"` on `/api/health` until the
staging migrate lands (this PR adds no migration, so drift here would be
inherited, not new).

## Context to preserve

- **`zz_rank1` is a scratch database on the local Postgres** created by this run.
  Safe to drop: `DROP DATABASE zz_rank1;`. Nothing depends on it.
- ⚠ **The shared local `postgres` database is badly bloated** — `pg_class` at
  **281 MB** (should be ~1 MB) and Realtime's `cainophile_wszuhlky` slot pinning
  **3990 MB of WAL**. The full suite runs **~6 min on a fresh database and 20×+
  slower there**. This is the known bloat issue and it is getting worse; it is
  now the single biggest tax on every local gate.
- **ADR-0035's G-3 guard hard-codes `current_database() = "postgres"`**, so
  `tests/integration/staging-reset-mechanism.integration.test.ts` (3 assertions)
  refuses any isolation database. That is the guard working, not a defect — but
  it means a full suite can never run entirely off the default DB. Ran separately
  there: **49/49**.
- The reproduction test `tests/server/lots/rank-capture.test.ts` is the
  acceptance criterion and was **RED on `7fdaa99`**. If it ever goes red again,
  a ruler has reverted.
