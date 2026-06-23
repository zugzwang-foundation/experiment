# DEBATE.8 — Implementation Plan (Step 5, plan half)

**Task:** Build the read-time ranking model — `src/lib/ranking.ts` + `src/lib/ranking.config.ts` + the per-side aggregate query — and reconcile the schema/code to the ratified model by dropping the vestigial `comments.stake_at_post_time` column (migration 0017 + `place.ts` + ~13 test files), landing the deferred §17 acceptance rows.

**Status:** PLAN ONLY — for founder + web-orchestrator review (Gate 2). No code, no files, no migration, no commits this session. Execution is a separate fresh chat after ratification.

**Canonical anchors (read in full from disk this session):** `docs/specs/RANKING.md` v1.0.0-draft · `docs/adr/0017-…md` (Decision Outcome + P1/P2/P3) · SPEC.2 §5.4 / §5.1 row 4 / §14.1 · SPEC.1 §9 / §17.

> **Copy-to-repo note (§5.1):** at execution start, copy this file to `docs/plans/DEBATE.8.md` and commit it before Phase 1 ends (Phase 2 references it via `@docs/plans/DEBATE.8.md`). The `~/.claude/plans/` copy is the durable planning artifact; the repo copy is the committed one.

---

## Context

DEBATE.8 is the **backend** half of the debate-view ranking stratum. PR #154 (merged main `bed52b8`) authored `RANKING.md` and reconciled the specs/ADR to the ADR-0017 model. This task makes that model **executable**: a pure `ranking.ts` that turns the per-post substrate into the Top order + latest interleave + lane-dominance badge + reply order + profile order, and the SQL that computes the four per-side aggregates that feed it. It also closes the **specs-ahead-of-code** drift the specs already record: `comments.stake_at_post_time` (an ADR-0009 ranking input the new model does not use — value is aggregated from reply-bets at read time) is dropped from schema, write path, and tests. The debate-view **UI** is DEBATE.4 (out of scope). "Done" = migration applied to **staging** + the aggregates compute and a Top order + badges are produced against staging data — not merely CI green.

**Ground-truth verification (confirmed on disk, not assumed):**

- On branch `chore/debate-8-ranking-spec`@`42b24a6`. **PR #154 is merged** on remote main at `bed52b8` (`git ls-remote origin refs/heads/main` ⇒ `bed52b8…`); local `origin/main` is a **stale unfetched cache** at `36d7806` (#153). The anchor files exist on disk because they were authored in this branch's commit — content == the merged tree. **→ Execution must `git fetch` and branch `feat/debate-8-ranking` from the updated `origin/main` (bed52b8), not from this stale branch.**
- Migration head = `0016_mod_actions_reason.sql` ⇒ new migration is **0017**.
- `src/lib/ranking.ts` / `ranking.config.ts` do **not** exist (greenfield). `src/server/debate-view/` exists (DEBATE.5's `list-comments.ts` only).
- `comments.stake_at_post_time` exists (`comments.ts:55-58`, `numeric(38,18) NOT NULL`); `comments_ranking_idx` on `(parent_comment_id, side_at_post_time)` (`:71-74`); `comments.bet_id` nullable + `comments_bet_id_idx` (`:59-76`); `bets.comment_id` NOT NULL + `bets_comment_id_idx` (`bets.ts:49-61`).
- `place.ts:134` writes `stakeAtPostTime: "0"` (brief said "~136").
- 13 test files reference the column (full list in §6).
- Bucket-A append-only triggers are `BEFORE UPDATE/DELETE FOR EACH ROW` (DML) — `ALTER … DROP COLUMN` is DDL → **not blocked**.
- `CpmmDecimal` imports `server-only` (`decimal.ts:10`) → not importable into the pure `src/lib/ranking.ts`.

---

## ⚠️ Open decisions for Gate 2 (surface to founder + web; do NOT resolve in-session)

Per the relay model, these flow web → Hrishikesh → CC; they are **not** AskUserQuestion items. **OD-1 is a blocker** for the badge implementation; OD-2..5 have recommended defaults that execution can proceed on unless overridden.

### OD-1 (BLOCKER) — The third Top lane vs. the third badge contradict each other

`RANKING.md` (and ADR-0017) define **two different third signals** and then claim they coincide:

- **Top's third lane** (§3.1; ADR-0017 §184; the §13 worked example) = **dominance-split**, ranks `lop = 1 − b`, gated by `n ≥ floor_split`. Maximal on a **blowout** (one side decisively won; `b → 0`).
- **The third badge / third lens** (§5.2; §6 Contested; ADR-0017 §211 + P3 §79) = **Contested**, `n ^ b`. Maximal on an **even split** (`b ≈ 1`).
- `lop` and `n^b` are **opposite corners** of the balance axis. Yet **§5.1(2)** says a badge is awarded from "its best `qualified_margin` (§3.3)" — and §3.3's lanes are `{n, D, lop}` — while **§5.1(3)** claims the badge is "the same lane that earns the post its Top position, **consistent by construction**." That is true for `n` and `D`; it is **false for the third axis** (Top ranks `lop`, the badge names `n^b`). §5.2 even labels the row "dominance/split lens (n^b)", conflating the two.

**Impact:** `badgeFor()` cannot be implemented unambiguously. A post that tops Top via `lop` (blowout) has a *low* `n^b`, so under the "badge = §6 lens" reading it earns **no** Contested badge — directly contradicting "consistent by construction." The `ranking::lane-dominance-badge-*` tests assert one specific behaviour and need the answer first.

**Two coherent readings:**
- **(A) Badges read the §6 lenses `{n, D, n^b}` (Contested = even-split).** Top order keeps `{n, D, lop}`. Consequence: the badge set and the Top order **diverge on the third axis by design**; §5.1(3)'s "consistent by construction" must be softened to "consistent for the traction and stake lanes; the split lane and the Contested badge are distinct signals." This is a **wording patch** to RANKING.md §5.1–§5.2 (no shape change to Top).
- **(B) The third badge tracks the Top lane `lop`** (rename badge to e.g. "Decisive"/"Lopsided"), and `n^b` Contested stays a computed-but-unbadged lens. This **changes the badge vocabulary** (§5.2) and the §13/§5 narrative — a **shape/design-intent change**, which per RANKING.md §0 requires a new ADR + same-commit SPEC update.

**Recommendation:** **(A)** — it preserves the immutable Top shape and the "Contested" badge name the specs lean on (§5.2/§5.3/§6 + ADR P3 all describe `n^b`), and is a wording-only RANKING.md patch. Execution would then: compute badge margins over `{n, D, n^b}`, Top order over `{n, D, lop}`, and land a same-commit RANKING.md §5.1(3) clarification. **But this still alters RANKING.md and the badge semantics, so it needs explicit founder/web ratification before execution.**

### OD-2 — Decimal posture for `ranking.ts`
`CpmmDecimal` is `server-only`, so the pure `src/lib/ranking.ts` can't use it. RANKING.md §10 demands **bit-exact reproducibility** from the public dataset, and CLAUDE.md §2 forbids JS floats for monetary math (`D` is a sum of `NUMERIC(38,18)`). JS `Math.pow` is libm-dependent (not guaranteed bit-identical cross-platform). **Recommendation:** add `src/lib/ranking-decimal.ts` exporting a non-`server-only` `Decimal.clone({ precision: 50 })` (mirrors `CpmmDecimal`'s precision, decimal.js 10.6.0 already pinned), and do all score arithmetic (ratios, `n^b`, gravity if built) through it. Keeps `ranking.ts` pure + importable from `src/lib`, server, and tsx scripts; honours §10 + §2. (Counts stay integers; Dharma sums arrive pre-summed as exact strings from SQL.)

### OD-3 — Scope of the computed-but-unexposed filter modes + gravity
P3 removes the v1 mode selector. The v1 **outputs** (kickoff scope item 1) are Top + interleave + badge + reply + profile. The standalone gravity-decayed mode orderings (§6 Most Debated / Highest Stakes / Newest as selectable orders) and the §9 gravity term are **not used by any v1 output** (Top is gravity-exempt §3.5; badges use raw lane values §5.1(1); interleave is positional; reply is by stake; profile is by D/stake). Only the **lane values** `{n, D, lop, n^b}` are needed (the last for the Contested badge under OD-1(A)). **Recommendation:** build the lane-value computation + the five v1 outputs now; **defer** standalone gravity-decayed mode orderings to the testnet+ re-exposure (CLAUDE.md §5.2 simplicity; kickoff's explicit output list). The §17 `ranking::mode-*` / `ranking::gravity-decay-*` rows stay as catalogue entries pointing at RANKING.md §6/§9 (computed-but-unexposed), backed when modes are re-exposed. Flag so the founder can opt to build the full §6/§9 now instead.

### OD-4 — Pre-tuning placeholder constant values
Per RANKING.md §0/§12 the constants pin at 2026-09-01; for the demo to produce a real order they need placeholder values now. **Proposed (each commented "pre-tuning placeholder — NOT final; pins 2026-09-01"):** `k_lane = 3` (uniform across lanes); `floor_lane = { n: 5, D: 200, lop: 0.5 }`; `floor_split = 6`; `LATEST_INTERLEAVE_INTERVAL = 10`; (only if OD-3 includes gravity) `c = 2, g = 1.8` (HN lineage). The `{n:5, D:200, k_lane:3, floor_split:6}` values are exactly the §13 worked-example illustrative constants, so the worked-example test reproduces §13's order. **These are not the Sept-1 values.**

### OD-5 — One PR or two
The column-drop unit (schema + `place.ts` + 13 test edits + migration 0017) and the ranking unit (`ranking.ts` + config + query + ranking tests + §17 rows) are technically **independent** (the aggregate query reads `bets.stake`, never `stake_at_post_time`). **Recommendation:** **one PR** (one ratified stratum = one squash-merge), with clear internal phases and all four subagent reviews. Note it can split into two smaller PRs (drop-column / ranking-lib) if the founder prefers smaller diffs; that doubles the PR + review overhead for tightly-related work.

---

## Scope — file-by-file (the 8 kickoff items)

### 1. `src/lib/ranking.ts` (NEW — pure TS, no IO)

Config is **injected as a parameter** (not imported as a global) so the model is tuning-independent and tests pin explicit constants. Surface:

- `type PostSubstrate = { id; parentSide: "YES"|"NO"; supportCount; counterCount; supportDharma; counterDharma; createdAt; authorStake }` (counts: number; dharma/stake: decimal strings; createdAt: Date or ISO).
- Derived: `n`, `D`, `lop = 1 − min/max`, `nPowB = n^b` (with the §6.1 guard: `n === 0 ⇒ contested = 0`), `a = authorStake`. All via the OD-2 decimal.
- `qualifiedMargin(post, lane, allPosts, cfg)` → real ratio | `BELOW_FLOOR` | `SENTINEL_MAX`, per §3.3 (floor-kill; second-place among floor-clearers; SENTINEL when no qualifying #2; split lane additionally gated `n ≥ floor_split`). Sort order `BELOW_FLOOR < 1 < real < SENTINEL_MAX` encoded as a **rank class**, not a magic number (§3.3 note).
- `topScore(post, allPosts, cfg)` = max qualified margin over `{n, D, lop}`.
- `compareTop` = `topScore` desc, then **author stake `a`** desc, then **earlier-wins** (`createdAt` asc, then UUIDv7 `id` asc) — §3.4. Uniform tiebreak across the whole model.
- `buildTopList(posts, cfg)` — §4.2: sort by `compareTop`, then interleave one newest-unshown post after every `LATEST_INTERLEAVE_INTERVAL` ranked posts; exactly one per cadence; no duplication; Top-only.
- `badgeFor(post, allPosts, cfg)` → `"Most Debated" | "Highest Stakes" | "Contested" | null` — §5: highest-margin lens, `k_lane`-gated + `floor_lane`-cleared, one badge. **Lens set pending OD-1** (recommend `{n, D, n^b}`).
- `rankReplies(replies, parentSide, cfg)` — §7: partition Support/Counter (reply side vs parent side), stake desc, earlier-wins; `twoSlot()` selects best-of-each-side with the §7.1 edges (one side empty → two from the other; one reply → it, no expand; zero → none).
- `profileOrder(posts, replies)` — §3.6: posts by `D` desc, replies by own stake desc, **posts above replies**, **no interleave**.

Edge handling baked in: zero-reply Contested guard (§6.1), no-competitor SENTINEL (§3.3), all-sub-floor cold-start → §3.4 chain orders by `a` (§3.3/§8), two-slot empty-side (§7.1).

### 2. `src/lib/ranking.config.ts` (NEW)
The named constants of §12 as a `RankingConfig` object with the OD-4 placeholder values, each line commented "pre-tuning placeholder — NOT final; pins 2026-09-01". Exports the default config; `ranking.ts` takes a config arg defaulting to it. (Plus `src/lib/ranking-decimal.ts` per OD-2.)

### 3. The read-time aggregate query — `src/server/debate-view/ranking-substrate.ts` (NEW)
Lives beside `list-comments.ts`. Per ADR-0008 §11.4, the hot-path lane aggregation uses a **typed `sql<T>` template** (cleaner than the builder for a self-join + per-side conditional sums); maps to a DTO (never expose Drizzle rows). Shape, per top-level post in a market:

- Reply join: `bets → comments` via **`bets.comment_id = comments.id`** (never `comments.bet_id`, always NULL). Reply comments = `comments.parent_comment_id = <post.id>`.
- Group by `(comments.parent_comment_id, comments.side_at_post_time)` (served by `comments_ranking_idx`); `COUNT(*)` and `SUM(bets.stake)` per side (the stake reached via `bets.comment_id`, served by `bets_comment_id_idx`).
- Support vs Counter resolved in the projection by comparing reply `side_at_post_time` to the **parent's** `side_at_post_time`.
- Author stake `a`: the post's **own** entry bet — `bets.stake WHERE bets.comment_id = post.id`.
- `createdAt` from `comments.created_at`; `now` is a parameter (frozen to resolution timestamp for resolved markets — INV-4).
- **Decoder caveat (memory):** bare `sql<T>` fragments have no runtime decoder — `numeric` returns strings (wanted for decimal), `count` returns string (parse to number), `timestamptz` returns a wire string (map to Date or pass through). Apply `.mapWith()` / explicit decoders.
- Indexes are **load-bearing, not dropped**: `comments_ranking_idx` (PRECURSOR.4 lock) + `bets_comment_id_idx`. The §11.3 covering index is a profiling call, **not** provisioned here.

### 4. Migration 0017 + schema edit
- **Schema (`src/db/schema/comments.ts`):** remove the `stakeAtPostTime` column (lines 55-58) **and** the stale ADR-0009 reference in the file's doc comment (lines 26-28). `comments_ranking_idx` and every other column/index unchanged. `createInsertSchema`/`createSelectSchema` lose the field automatically.
- **Generate:** `just db-generate drop_comments_stake_at_post_time` (`comments` is **not** in `tablesFilter` — only `events` is — so drizzle-kit emits the diff). Expected sole statement: `ALTER TABLE "comments" DROP COLUMN "stake_at_post_time";`.
- **Audit the generated file (must verify):** contains **only** the DROP COLUMN — **no** `comments_ranking_idx` drop, no other DDL. If drizzle-kit emits anything else, stop and reconcile.
- DDL is **not** blocked by Bucket-A triggers (row-level DML triggers don't fire on metadata-only DROP COLUMN).

### 5. `place.ts` edit (bet write path)
Delete `place.ts:134` (`stakeAtPostTime: "0", // vestigial…`). The comment insert (`:126-138`) otherwise unchanged; `betId: null` (the deliberately-nullable circular pair) **stays**. This is the only `src/server/bets/` line touched → **@security-auditor required**.

### 6. The ~13 test-file edits (stay green after the drop)
These are **regression-preserving edits**, not RED-first. Taxonomy:

- **(a) Remove the fixture line** — raw `insert(comments).values({… stakeAtPostTime …})`; after the drop the field is a tsc error: `tests/integration/dharma-ledger.integration.test.ts` (+ doc comment :27-29) · `tests/invariants/I-APPEND-ONLY-001…` · `tests/invariants/I-SIDE-BIND-001…` · `tests/server/comments/media.test.ts` (+ comment :446-448) · `tests/server/resolution/pro-rata.test.ts` · `tests/server/debate-view/marker.test.ts` (4 inserts) · `tests/db/triggers/{bets,friendly-fire-events,comments,payout-events}-append-only.spec.ts`.
- **(b) Remove the assertion + the line** — `tests/invariants/I-ATOMICITY-001.bet-comment-atomic.spec.ts`: drop the `stakeAtPostTime` select (`:329`) + `expect(…).toBe("10.0…")` (`:336`) + the fixture lines (`:255,401,498`) + update the "S3 trap / BOTH side_at_post_time AND stake_at_post_time" comments (`:39-41,210-212,246-247,324`) to the side-only reality. The atomicity assertions (full spine commits/rolls back) **survive** unchanged.
- **(c) Delete the obsolete test case** — `tests/server/comments/reply.test.ts`: the entire `::call-a-stake-at-post-time-literal-zero` `it(...)` block (`:450-489`) + its describe-comment (`:27-29`); its subject (the literal-"0" write) no longer exists.
- **(d) Comment-only** — `tests/server/comments/direct.test.ts:14-16` (doc comment referencing the "0" placeholder) → update to drop the stake_at_post_time mention.
- **Minor orphan (my change creates it):** `src/server/debate-view/list-comments.ts:19` doc comment says "`stakeAtPostTime` … vestigial (dropped DEBATE.8/9)" → update to reflect it is now dropped (only `betId` remains deliberately-nullable). Comment-only.

These edits land in the **same commit** as the schema+migration+`place.ts` change (the suite won't compile/pass otherwise).

### 7. RED-first tests for `ranking.ts` (NEW — `tests/unit/ranking/`, pure, no DB)
**Written and failing before `ranking.ts` exists** — `@test-writer` at Phase 2 start. One subject per file (AGENTS.md §9):
- `top-order.test.ts` — the §13 worked example (order P1,P2,P3,P4; only P1 badged Most Debated); no-competitor **SENTINEL_MAX**; all-sub-floor **cold-start** (orders by `a`); author-stake-then-earlier-wins ties.
- `interleave.test.ts` — every-`N` injection; no-duplication; Top-only (not profile).
- `badges.test.ts` — highest-margin selection; `k_lane` gate (narrow-win → no badge); three-lane vocab. **(Pending OD-1.)**
- `replies.test.ts` — stake-desc within side; earlier-wins ties; two-slot edges (empty side / single / zero).
- `profile.test.ts` — §3.6 (posts by D, replies by stake, posts above replies, no interleave).
- `contested.test.ts` — `n^b`; **zero-reply guard** (`n=0 ⇒ 0`); fully one-sided (`b=0 ⇒ n^0=1`). (Or fold into `badges.test.ts`.)

### 8. §17 acceptance-row edits (SPEC.1 + SPEC.2), landing with their test files
- **SPEC.1 §17 catalogue (~line 1087):** replace the stale `debate-view::mode-selector-switches-order` row; **add** `ranking::lane-dominance-badge-highest-margin`, `ranking::lane-dominance-badge-k-lane-gated`, `ranking::latest-interleave-every-N`, `ranking::latest-interleave-no-duplication`, `ranking::contested-zero-reply-guard`, `ranking::top-sentinel-no-competitor`, `ranking::profile-ordering-posts-above-replies` (each backed by a §7 test).
- **SPEC.1 §9 F-DEBATE-1 acceptance (line 425) + "active mode echoed" (line 424):** drop the `mode-selector-switches-order` ref and "active mode echoed" wording (no selector in v1); the badge/interleave **render** tests stay forward DEBATE.4 refs (`tests/server/debate-view/*`).
- These are a **same-commit SPEC patch** with the new test files (the "acceptance rows reference tests that exist" discipline). Existing `ranking::top-*` / `ranking::replies-*` / `ranking::author-stake-*` rows are backed by the §7 tests too.

---

## Execution sequencing

1. Fetch + branch `feat/debate-8-ranking` from updated `origin/main` (`bed52b8`).
2. **@test-writer** → the §7 RED-first ranking tests (failing).
3. Implement `ranking-decimal.ts` → `ranking.config.ts` → `ranking.ts` until §7 green.
4. Implement `ranking-substrate.ts` (the aggregate query).
5. Schema edit → `just db-generate` 0017 → audit the generated SQL.
6. `place.ts:134` removal.
7. The §6 test edits (same commit as 5+6).
8. The §8 SPEC §17/§9 edits.
9. `ZUGZWANG_ENV=preview just verify` → `pnpm vitest run` (full suite — the cross-suite floor, per memory) → `pnpm test:invariants` + `pnpm test:integration` (critical-path, local Postgres `:54322`).
10. Pre-PR self-audit (§5.10) → subagent reviews → staging apply + verify → PR.

## Subagent review checkpoints (§5.11 — pass `@docs/plans/DEBATE.8.md`)
- **@test-writer** — Phase 2 start, the RED-first ranking tests (never edits `src/`).
- **@db-migration-reviewer** — after 0017 (schema vs SPEC.2 §5; Bucket-A; the DROP-COLUMN-only assertion; `comments_ranking_idx` survives).
- **@code-reviewer** — after `ranking.ts` + `ranking-substrate.ts` land under `src/server/` / `src/lib/`.
- **@security-auditor** — after code-reviewer, on the `place.ts` bet-path edit (INV-1 intact: `bets.comment_id` NOT NULL + W-1 atomicity unchanged; no new write path).
- **Model caveat (memory):** the four agents pin `claude-fable-5`. If the execution session is on **Opus**, pass `model:"opus"` on each Agent call or they die with 0 tool-uses; if on Fable 5 (the canonical CC model), they run natively.

## Staging apply + live verification (the "Done" bar)
1. `pnpm db:check-drift` (pre-apply), then `doppler run --config stg -- pnpm db:migrate:staging` applies 0017 to staging (`rwfdoqzsghqhhdapxafg`, project-ref-fragment guard). **Doppler config is `stg`, not `staging`** (CLAUDE.md gotcha — the script's doc comment says `staging`).
2. Verify the column is gone on staging and `comments_ranking_idx` survives.
3. **Live ranking verification:** a small `scripts/verify-ranking-staging.ts` (tsx, **inline `postgres()` client** — must not touch the `@/db` → `server-only` chain; smoke-staging precedent) that (a) runs the aggregate SQL against staging, (b) imports the pure `ranking.ts` (non-server-only → importable from tsx), (c) logs the four aggregates + the Top order + badges. If staging lacks posts-with-two-sided-reply-bets, seed a minimal fixture first (so ≥1 lane dominates and a badge fires).
4. Confirm: four aggregates compute, Top order + badges produced. (UI is DEBATE.4 — not verified here.)

## Pre-PR self-audit (§5.10)
- **Schema/migration:** 0017 is DROP COLUMN only; no index drop; idempotent; Bucket classification unchanged; same-commit SPEC sync.
- **Server:** `place.ts` leaves INV-1 intact; aggregate query joins via `bets.comment_id` (not `comments.bet_id`); no Drizzle rows in DTOs.
- **Lib:** `ranking.ts` pure/no-IO; decimal (not float); config injected; every §7 edge asserted.
- **Tests:** all 13 drop-column edits green; reply.test.ts obsolete case deleted; full suite + invariants + integration green.

## Out of scope / observations (do NOT absorb)
- `friendly_fire_events` + its trigger/relations — **DEBATE.9**.
- Standalone gravity-decayed filter modes + §9 gravity — deferred per OD-3 (founder may reopen).
- DEBATE.4 debate-view UI / route group / badge rendering.
- **Pre-existing drift (note only, don't fix):** SPEC.2 §14.1 (line 1440) names INV-3's canonical test `I-SIDE-BIND-001.comment-side-frozen.spec.ts`; the file on disk is `I-SIDE-BIND-001.comment-side-bound-at-post-time.spec.ts`. Not introduced by DEBATE.8.
