# DEBATE.8 — session log

**Stratum:** DEBATE.8 — read-time ranking model (`ranking.ts` + aggregate query) + drop the vestigial `comments.stake_at_post_time` column.
**State:** MERGED. Canonical SHA (squash on `main`) = **`193f1c2`** (PR #155). Plan ratified at Gate 2; OD-1..5 resolved by the founder before execution.

---

## What landed (files + PR#)

**PR #155** → squash `193f1c2` on `main`. Zero-diff verified against the reviewed branch tip `d90b3c3` (`git diff d90b3c3 origin/main` empty).

- **New lib (pure, no IO, no `server-only`):** `src/lib/ranking.ts` (Top order, latest interleave, lane-dominance badge, depth-1 reply ranking, profile order), `src/lib/ranking.config.ts` (placeholder constants), `src/lib/ranking-decimal.ts` (precision-50 `decimal.js` clone — OD-2).
- **New query:** `src/server/debate-view/ranking-substrate.ts` — read-time `bets → comments` aggregate (join via `bets.comment_id`; per-side `COUNT` + `SUM(bets.stake)`; `JOIN LATERAL` author stake).
- **Migration:** `drizzle/migrations/0017_drop_comments_stake_at_post_time.sql` = `ALTER TABLE "comments" DROP COLUMN "stake_at_post_time";` (only). `src/db/schema/comments.ts` (column + `numeric` import + doc comment removed). `comments_ranking_idx` **survives** (PRECURSOR.4 lock).
- **Bet path:** `src/server/bets/place.ts` (−1 line: the vestigial `stakeAtPostTime: "0"` write). `src/server/debate-view/list-comments.ts` (doc comment).
- **Tests:** 6 new RED-first suites `tests/unit/ranking/*` (40 tests); 13 existing test files reconciled to the column drop (incl. the deleted `reply.test.ts` Call-A case + the `I-ATOMICITY-001` assertion).
- **Specs (same commit):** `docs/specs/RANKING.md` §5.1/§5.2/§13 (OD-1(A)) + change-log; `docs/specs/SPEC.1.md` §9 F-DEBATE-1 + §17 acceptance rows.
- **Tooling:** `scripts/verify-ranking-staging.ts` (+ `verify:ranking:staging` in `package.json`).

## Decisions made

- **OD-1(A)** — the **badge lanes `{n, D, n^b}`** are distinct from the **Top-order lanes `{n, D, lop}`** on the balance axis **by design**; `badgeFor` computes over the badge lanes, highest-margin wins. RANKING.md §5.1(3) softened (no longer "consistent by construction" on the third axis); §13 P1 badge corrected **Most Debated → Contested**, order unchanged.
- **OD-2** — `ranking.ts` uses a dedicated non-`server-only` `RankingDecimal` (`CpmmDecimal` is `server-only`, unimportable from the pure lib / tsx).
- **OD-3** — standalone gravity-decayed filter modes + the §9 gravity term **deferred** (no v1 output consumes them); only the lane values `{n, D, lop, n^b}` + the five v1 outputs built.
- **OD-4** — placeholder constants `kLane=3`, `floorLane={n:5, D:200, lop:0.5, nPowB:3}`, `floorSplit=6`, `latestInterleaveInterval=10` (commented "pre-tuning — pins 2026-09-01"), matching the §13 worked example.
- **OD-5** — one PR.
- **Review fix (HIGH):** author-stake join hardened to `JOIN LATERAL … LIMIT 1` (fan-out-proof regardless of the single-write-path 1:1 assumption). Two LOWs fixed (`badgeFor` id-keying; SENTINEL floor-positivity note).
- **§13 pre-merge arithmetic check (founder-requested):** recomputed via the same precision-50 decimal — P1 `n^b`=27.66, **P2 `n^b`=3.0594 clears the floor (3)**, P3=1.55, P4≤2. **Two clearers ⇒ a REAL ratio 9.04× (≈9.0×), NOT SENTINEL.** The staging run's SENTINEL was a *different* fixture (P2/P3 lopsided, sub-floor). §13 confirmed consistent — no edit.

## Open questions

None blocking. (Parked items below are deferred by founder direction, not open.)

## Next session starts at

- **DEBATE.4** — the debate-view UI render that *consumes* `ranking.ts` (`buildTopList` + `badgeFor` + `rankReplies`/`twoSlot`) and the substrate query; builds the badge display + interleave render + the `tests/server/debate-view/{sort,replies}.test.ts` forward acceptance refs that SPEC.1 §9/§17 now point at. **No mode selector** (P3).
- **DEBATE.9** — drop `friendly_fire_events` (table + Bucket-B trigger + relations), the *other* specs-ahead artifact (parallel to this stratum's `stake_at_post_time` drop).

## Context to preserve

- **Migration tracking on the LOCAL test DB:** a reviewer dropped the column via raw `psql` (no drizzle tracking row). Re-added the column + ran `drizzle-kit migrate` so the 0017 tracking row recorded — `migration-drift.integration.test` requires tracking head == journal head (now both 0017). Any future local re-setup should `pnpm db:migrate`, not raw SQL.
- **Staging:** 0017 applied (head 0017, `db:check-drift` IN SYNC ✓). The live demo seeded a labelled `debate8-ranking-demo-*` market (INSERT-only, Bucket-A — not removable); reusing one existing user. P1 (big-and-even, sole `n^b` clearer → SENTINEL) earned **Contested** — that fixture's badge fires via SENTINEL, distinct from §13's real-ratio path.
- **OD-1(A) is the load-bearing model nuance:** Top order and the badge can name *different* lanes for the same post (order via traction, badge via contestation). Any DEBATE.4 render must surface the badge from `badgeFor`, not infer it from the order.

## Surprises caught + fixed in-session

- **1.** PR #154 was absent from the local `origin/main` cache (stale at `36d7806`); `git ls-remote` proved it merged at `bed52b8`. Fetched + branched from the real main — not the stale cache or the spec branch.
- **2.** The OD-1 spec self-contradiction (Top's `lop` lane vs the Contested `n^b` badge, opposite corners, yet §5.1(3) claimed "consistent by construction") — surfaced in plan mode, ratified as **OD-1(A)**, implemented + reconciled same-commit.
- **3.** `CpmmDecimal` is `server-only` → added `ranking-decimal.ts` (OD-2) so the pure model stays importable from tsx.
- **4.** `@code-reviewer` HIGH: the author-stake join was 1:1 only by the single write path (no schema unique) → `JOIN LATERAL … LIMIT 1`.
- **5.** `@db-migration-reviewer` SURPRISE: the migration `.sql` + `meta/0017_snapshot.json` were untracked while `_journal.json` was modified → staged all three together (a journal pointing at a missing migration would break `drizzle-kit migrate`).
- **6.** Local DB drift after the reviewer's raw-`psql` drop → re-add + `drizzle-kit migrate` to record 0017 (drift test green).

## Closing-ritual result — CLAUDE.md / AGENTS.md drift FOUND (flagged for next SYNC; NOT auto-fixed)

Per founder direction + CLAUDE.md §7 ("reconcile periodically at a SYNC sweep, not per-task") — reported, **not** edited this stratum (and #155 is already merged):

- **AGENTS.md:9** — "the built schema still carries … `friendly_fire_events` + `stake_at_post_time` still exist (code catch-up is DEBATE.9 + DEBATE.8)." → `stake_at_post_time` is now **dropped (DEBATE.8 done)**; reduce to `friendly_fire_events` / DEBATE.9 only.
- **AGENTS.md:157** — `comments.stake_at_post_time` listed as "vestigial … removed in DEBATE.8/9." → now **removed**; reduce the carry-forward to `friendly_fire_events` (DEBATE.9).
- **CLAUDE.md:205** (decision log) — "`RANKING.md` stale until DEBATE.8." → RANKING.md is now **authored + built**; update to reflect DEBATE.8 landed.
- **CLAUDE.md:20** — "pre-fold artifacts the spec removed … the DEBATE.8/9 task." → only `friendly_fire_events` remains; narrow to DEBATE.9.
- **NOT drift (correct, leave):** the `comments.bet_id` deliberately-nullable reframe (CLAUDE.md:59, AGENTS.md:156) — unchanged by this stratum.

## Parked for the next SYNC / tracker sweep (NOT this stratum)

- Fold into CLAUDE.md §5.7: the full-suite **`pnpm vitest run`** as the pre-PR gate (catches cross-suite floors the named list misses) + **`pnpm db:check-drift`** before any staging migrate.
- Pre-existing SPEC.2 §14.1 INV-3 canonical-test filename drift: spec says `I-SIDE-BIND-001.comment-side-frozen.spec.ts`; disk is `I-SIDE-BIND-001.comment-side-bound-at-post-time.spec.ts` (not introduced by DEBATE.8).

## Time

One execution session (plan ratified separately at Gate 2): RED-first tests → lib + query → migration + schema + bet-path + 13 test edits → spec reconciliation → 3 subagent gates → full local suite → staging apply + live verify → PR → §13 pre-merge check → squash-merge + close-out.
