# AUDIT-FIX-B2 — Ledger integrity: A2 money-mint fix + A20 TRUNCATE guard (PLAN, ratified)

> **Session context:** planned on **Fable 5 + ultracode by explicit operator override** (CC surfaced the Opus/no-ultracode kickoff precondition; operator confirmed proceed). Plan-only — no code, no migration written; plan mode not exited for execution. The execute session keeps the gated Opus-pinned cascade per CLAUDE.md §6.
> Live tree: `main` @ `912a244`. Migration head `0019` → next-free **0020**. ADRs through `0028` → next-free **0029**. At execute: commit this plan as `docs/plans/AUDIT-FIX-B2.md` before Phase 1 ends (§5.1).

## Context

**A2 (money-mint).** `dharma_ledger`'s latest-balance read (`src/server/dharma/persist.ts:32`) orders by `(created_at DESC, id DESC)`. `created_at` is tx-frozen `now()` — all rows one tx appends for a user tie — and `id` (userspace `uuidv7()`, `0000_uuidv7_function.sql`) has **random sub-millisecond bits**, so same-ms ids sort randomly. A later tx's read over a tie-group can return the logically-earlier row → stale `balance_after` becomes the next chain base → Dharma mint/burn. The per-row `CHECK (balance_after >= 0)` (INV-2) cannot see it.

**A20.** TRUNCATE fires no row-level triggers — it bypasses the entire 0003 append-only guard (INV-2/INV-4 storage ground truth) on all 12 protected tables.

## STEP 0 — INV-A20 probe (staging, read-only, 2026-07-04): **TRUE — A20 stays in scope**

- App role (Doppler `stg` `DATABASE_URL`) = **`postgres`**, which **owns** all 12 protected tables; `has_table_privilege(…, 'TRUNCATE') = t` on **all 12**.
- **Correction to the kickoff's "fix the grant":** TRUNCATE cannot be revoked from a table **owner** — owner privileges are implicit. Grant surgery is a no-op while the app connects as owner. The operative mitigation is **`BEFORE TRUNCATE … FOR EACH STATEMENT` reject triggers** (privilege-independent; one firing trigger aborts the whole statement pre-truncation). The durable fix — a dedicated non-owner runtime role — is Supabase role/connection/Vercel-env re-plumbing: **surfaced as an over-privileged-role finding, proposed as a parked hardening task** (OQ-2). Honest threat-model note: a full-SQL attacker connecting as owner can `ALTER TABLE … DISABLE TRIGGER` — the trigger guard (like all of 0003) raises the bar against accidental/blast-radius truncation and unsophisticated injection; only the role split closes it fully.
- Staging `dharma_ledger`: **3 rows** (smoke). Prod count: OQ-1.

## STEP 1 — A2 re-verified on the live tree (adversarial refutation FAILED — A2 STANDS)

- `persist.ts:32` unchanged post-A1/B1; its own doc-comment concedes `id` is not a chronological tie-break.
- **In-tx chaining is correct everywhere** (the `previousBalance` contract is fully discharged): `place.ts:169` chains off `accrual.balanceAfter`; `settle.ts:156`, `void.ts:160`, `correct.ts:246–311` thread multi-leg chains. The fork is **cross-tx only**: the *next* tx's `readBalance` (place.ts:102, settle/void/correct openers) or auto-read (`sell.ts:71`; `grant.ts:91` is first-row-only) over committed tied rows.
- Tie-group producers: `place()` daily_allowance+bet_stake pair (~4 statements apart — same-ms unlikely per event but runs once per active user per day × 50 days); `settle`/`void`/`correct` per-user multi-leg loops (**adjacent** inserts, 1 RTT apart — most plausible collision sites). `settle`-then-`correct` realizes a fork with zero user action. NTP backward steps of `clock_timestamp()` widen all windows. No lock/isolation blocks the wrong read (SSI covers concurrent txs; producer and consumer here are sequential).

## STEP 2 — Approaches

### (a) `seq BIGINT GENERATED ALWAYS AS IDENTITY` + `ORDER BY seq DESC` — **RATIFIED**
- Per-user write serialization is already the caller's obligation (persist.ts D-2, SSI) → per-user seq order ≡ insert order ≡ chain order. Cross-user interleaving irrelevant (read is per-user).
- **Append-only-safe:** `ADD COLUMN … IDENTITY` is DDL — fires **no** row triggers (Bucket-A guard untouched); existing rows get values during the table rewrite (ACCESS EXCLUSIVE; trivial at this size), assigned in heap-scan order — on a never-UPDATEd/DELETEd table this matches insertion order *in practice but not by documented guarantee* → mitigated by a **post-migration read-only chain audit** (walk each user in seq order; assert `balance_after` chains, uncollectable rule included) on staging (3 rows) + prod (confirmed 0 — see OQ-1 resolution). No app-level backfill; no UPDATE anywhere.
- Column is implicitly NOT NULL; `GENERATED ALWAYS` rejects app-supplied values; every existing INSERT (drizzle value-maps + all test raw INSERTs use explicit column lists — sweep-verified) is collision-free; drizzle-zod auto-omits generated-always from `createInsertSchema` (verified in node_modules, no manual omit).
- Stack support verified in node_modules: drizzle-orm 0.45.2 `bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity()` (mode "number" — avoids the ES2017 bigint-literal trap; app code never reads seq anyway); drizzle-kit 0.30.6 emits correct identity ALTER DDL.
- Add `uniqueIndex("dharma_ledger_user_seq_uq") on (userId, seq)` — serves the LIMIT-1 read path + belts per-user uniqueness. Keep existing indexes untouched.
- The `previousBalance` chaining contract **stays** (still the cheap in-tx path); seq makes cross-tx reads correct and demotes chaining from sole-correctness-mechanism to optimization. Code delta in src/: **one `orderBy` + doc-comment** in persist.ts.

### (b) Code-only implied-predecessor tie-break — **REJECTED (disqualified in principle, not just dispreferred)**
Walk the tie-group at max(`created_at`): true-latest = the row whose `balance_after` is no *other* tie-row's `implied_prev` (`balance_after − amount`; `uncollectable`: `balance_after`).
- **Fatal (proven):** net-zero tie-groups have **zero sinks** — no information in the data can order them. And the repo's own constants make that the *modal case*: `BET_MIN_STAKE_POST = DAILY_CREDIT_DHARMA = "10"` (`src/server/config/limits.ts:104,118`, verified) — **every first-bet-of-day at minimum post stake** writes `[+10 → B+10, −10 → B]`, candidates differing by exactly the stake. Also net-zero: exact-wash corrections (reverse+uncollectable+apply with apply = collectable). Once an ambiguous group commits, every subsequent read for that user hits it, and since place() must read before writing, the user is **permanently bricked** (append-only forbids repair) unless a full-ledger `SUM(amount)` fallback abandons recorded `balance_after` semantics (O(n), papers over corruption).
- Additional: `uncollectable` self-loop needs a non-obvious self-exclusion rule (naive build throws on every pure-loss correction); pre-existing forks inside a tie-group escalate a latent data bug into a hard availability failure at bet time (approach (a) degrades gracefully + audits catch it out-of-band); every external/raw-SQL consumer must reimplement an entry-type-coupled walk.
- Its honest strengths — zero DDL on a live Bucket-A money table, no migration sequencing, instantly reversible — do not survive the zero-sink proof.

## Fix specification (approach a)

1. **`src/db/schema/dharma.ts`** — add `seq` (bigint, mode "number", `.generatedAlwaysAsIdentity()`) + `dharma_ledger_user_seq_uq` unique index on (userId, seq).
2. **Migration 0020** (drizzle lane): `drizzle-kit generate --name dharma_ledger_seq` from the schema edit — dharma_ledger is drizzle-kit-tracked; hand-writing would desync the snapshot. Hand-check the emitted ALTER + index.
3. **`src/server/dharma/persist.ts`** — `readLatestBalance` orders by `desc(dharmaLedger.seq)` (LIMIT 1); rewrite the lines-13–23 doc comment: seq is the total-order contract; chaining stays for in-tx multi-row.
4. **Test-harness adopters (same PR):** `tests/scale/_harness/reconcile.ts:394` `sumLatestBalancesPerUser` DISTINCT ON → `ORDER BY user_id, seq DESC` (currently can report false conservation drift); `tests/scale/hot-row-contention.scale.test.ts:194` chain-walk → `orderBy(seq)` ASC (**latent flake today** — first-commented-bet tie can invert and fail a correct ledger).
5. **Consumers needing NO edit** (sweep of 384 hits, 50 classified): place/sell/accrual/grant/tos-accept/settle/void/correct (chain or delegate to persist.ts); `check_nightly_drift()` D2-A/D2-B (**order-free by design** — explicit column lists, no ORDER BY: ADD COLUMN is invisible to it; no detector change required); accrual cursor-reconstruction claim (date-granularity MAX); scripts/ (zero ledger consumers); no read-model/admin/export surface reads ledger history.

## A20 specification

1. **Migration 0021** (raw-SQL lane, 0003 style; journal via `drizzle-kit generate --custom`; drizzle-kit cannot see triggers — no snapshot impact; no pg_cron → CI strip unaffected):
   - New shared function `enforce_bucket_a_no_truncate()` — same bare-RAISE shape as 0003's pair, message "TRUNCATE not permitted" (reusing `enforce_bucket_a_no_delete` would work mechanically but lie in the message; Bucket-B's per-table OLD/NEW functions are NOT statement-safe — don't touch them).
   - **25 triggers**: `bucket_a_no_truncate` on 8 non-partitioned Bucket-A tables + the `events` family = parent **and all 13 partitions** (12 monthly `events_2026_05…2027_04` + `events_default`, per 0002 — PG17 statement triggers do **not** clone to partitions, and direct partition TRUNCATE skips the parent's trigger); `bucket_b_no_truncate` on identity_pool, image_uploads, system_state (mirrors `bucket_b_no_delete` reusing the shared function).
2. **Test-teardown collision (load-bearing, kickoff didn't anticipate):** integration/server teardowns TRUNCATE protected tables today (~40 test files list `dharma_ledger` alone; TRUNCATE is currently the *only* way to clear Bucket-A tables since DELETE is trigger-rejected). The guard breaks them. Fix: one shared fixture helper (`tests/db/_fixtures/` or `tests/_setup/`) `truncateTables(client, tables)` that, for protected tables, wraps `ALTER TABLE … DISABLE TRIGGER <truncate-guard>` → TRUNCATE → `ENABLE TRIGGER` (owner-privilege only — works on local :54322 and the CI postgres service; no superuser `session_replication_role` dependency, and **no escape-hatch GUC in the production DDL**). Mechanical adoption across affected teardowns. Exact file count fixed at execute by @test-writer's sweep.
3. **Guard tests:** new `tests/db/triggers/truncate-rejected.spec.ts` — asserts TRUNCATE rejection on all 12 tables + the events parent AND one direct partition; plus a positive control that the fixture helper still resets state.

## Test / detector strategy (kickoff DETECTOR LOOP)

- **(i) Pre-fix reproduction (RED):** integration test (extend `tests/integration/dharma-ledger.integration.test.ts`; keep its :185 chaining doc-test green unchanged) seeding a same-`created_at` tie with explicit ids crafted so uuid-DESC picks the chain-earlier row; asserts `readBalance` returns the chain-true balance → fails on live code, passes post-fix.
- **(ii) Fix eliminates:** same test green; plus the place()-level daily-credit-pair test asserting a subsequent tx's read returns the post-stake balance.
- **(iii) Detector + drain fire on a seeded fork:** **new** integration file (Sentry `vi.mock` is module-scoped — don't grow existing suites): seed fork `[+10→10, −3→7, FORK −5→5 (stale base 10)]` → `check_nightly_drift()` → assert one `cron_alarms` row (`dharma_chain_drift`, `derivation: "D2-A"` — walked: produced {10,7,5} vs implied_prev {0,10,10} → two sinks → fires; D2-B stays silent, link-set is satisfied) → `drainCronAlarms()` → assert `mockCaptureMessage("dharma_chain_drift", …tags)` + `processed_at` stamped. Reuse: seed helpers from `nightly-drift-resolution.integration.test.ts:31–78` (explicit `::dharma_entry_type` + created_at control), mock preamble from `alarms-drain.integration.test.ts:19–67`, `runDriftAndReadAlarms` from `positions.integration.test.ts:134–142`.
- **NEW FINDING — detector blind spot (pin it):** an A2 fork whose forked row is `uncollectable` (net-0 self-loop, stale base always an existing balance) evades **both** D2-A and D2-B; likewise balance-value-collision forks (fork multiset ≡ a legit linear chain — invisible to any order-free check, the 0015-documented residual class). Add a zero-alarms **blind-spot pin test** documenting the residual. With seq, a strict seq-ordered per-user walk (a "D2-C") would close the class — **parked as a fast-follow** (function-replace precedent 0007→0011→0015), OQ-3. The A2 fix itself stops production of new forks, so the residual matters only for pre-fix or non-app corruption.
- Full gates at execute: `ZUGZWANG_ENV=preview just verify` + `pnpm test:invariants` + `pnpm test:integration` + full `pnpm vitest run` (local :54322, direct vitest — not `just`) + `pnpm test:scale` (scale files are edited in this PR).

## DDL / ADR / deploy determination

- **Migrations: 0020** (seq, drizzle-generated) + **0021** (TRUNCATE guards, hand-written). Both additive/expand-only — no destructive alter, ADR-0024 compliant.
- **ADR-0029 — dharma_ledger total-order contract**: seq as the ordering contract; why (created_at, uuidv7) is insufficient (random sub-ms bits, ADR-0016 trade-off accepted there for ID generation, now needing an ordering column); chaining contract demoted to optimization. **ADR-0030 — TRUNCATE rejection on append-only tables**: extends the 0003 storage guard; records the owner-privilege probe result + the parked role-split. Same-commit: SPEC.2 §5/Appendix B (seq column) + §6 (TRUNCATE clause in the trigger contract); one-word CLAUDE.md §2 mechanism touch-up ("reject UPDATE/DELETE/TRUNCATE") + AGENTS.md §6 bucket lines, per the closing ritual.
- **Deploy (ADR-0024):** staging rehearsal first — `doppler run --config stg -- pnpm db:migrate:staging`, `/api/health` gate, then the post-migration chain-vs-seq audit query on staging's 3 rows; prod migrate-before-serve. `ADD COLUMN IDENTITY` takes a brief ACCESS EXCLUSIVE rewrite lock — trivial pre-launch.

## Execute cascade (unchanged from kickoff)

@test-writer (failing-first, never edits src/) → implement → @code-reviewer → @db-migration-reviewer (0020 + 0021) → @security-auditor. All Opus-pinned, gated plan→execute (no ultracode on execute — critical-path ledger + DDL). §5.10 pre-PR self-audit against this plan item-by-item. Session log per §5.9; this plan committed as `docs/plans/AUDIT-FIX-B2.md`.

---

## RATIFICATION ADDENDUM (execute kickoff, 2026-07-04 — operator, "best recoms")

- **Approach (a) RATIFIED**; (b) rejected.
- **OQ-1 → RESOLVED at execute Phase 0:** CC read-only probe ratified and run — **prod `dharma_ledger` = 0 rows** (2026-07-04, `doppler --config prd`, SELECT count only). Matches the ~0/smoke expectation → **prod migration unblocked**; no escalation. Staging = 3 rows (plan-time probe).
- **OQ-2 → PARKED** (app-as-owner role split; target before Sep 15) — NOT in B2 scope. B2 lands the TRUNCATE-reject triggers only; the role split + owner-privilege finding are recorded in ADR-0030 + `docs/parked.md`.
- **OQ-3 → PARKED** (D2-C seq-ordered walk detector) as fast-follow; the blind-spot zero-alarms PIN test lands in B2.
- **OQ-4 → TWO ADRs:** 0029 (ledger total-order contract) + 0030 (TRUNCATE guard + owner-privilege finding + parked role split).
- **OQ-5 → CLEARED at execute Phase 0:** only open PR is #146 (`feat/ui6-admin-fixes`, admin-UI pages + tests/server/admin) — zero `tests/scale/*` overlap; no scale-lane branch on the remote. The 2 scale-harness edits proceed in this PR.

## Execute-phase recon confirmations (tree `912a244`, 2026-07-04)

- `persist.ts:32`, `reconcile.ts:394`, `hot-row-contention.scale.test.ts:194` — exactly as planned.
- **0007/0011/0015 confirm no dynamic partition creation exists** (pg_cron jobs = identity-pool watermark + nightly drift only) → 0021's fixed 25-trigger set is complete coverage; any future partition-adding migration must add the trigger (note carried into 0021's header + ADR-0030).
- `cron_alarms` DDL (0007): `id bigserial PK, alarm_id text, payload jsonb, emitted_at, processed_at` — drain orders by `id`.
- **Both vitest configs run `fileParallelism: false`** (default + scale) → the fixture disable→TRUNCATE→re-enable dance is race-free across files.
- **Fixture-helper design (refinement within the plan's stated shape):** `truncateTables(client, tables)` issues ONE `.unsafe()` round-trip containing `ALTER TABLE … DISABLE TRIGGER <guard>` for **all 25 guarded tables** → `TRUNCATE <tables> CASCADE` → `ENABLE` for all 25. Single implicit transaction (simple-query protocol): any failure rolls back the whole statement batch → guards can never be left disabled. Full-set disable (not per-list) because `TRUNCATE … CASCADE` fires ON TRUNCATE triggers on **cascaded** tables too — short lists (`TRUNCATE markets CASCADE`, `TRUNCATE positions, markets, users CASCADE`) reach guarded tables outside their lists; per-call-site closure analysis would be fragile against FK drift. Test-only file `tests/db/_fixtures/truncate.ts`; unreachable from `src/` (auditor-checked).
- **Adoption inventory:** ~45 test files carry raw TRUNCATE statements (integration 12, server ~20, scale 8, db/triggers 11, db/identity-pool 2, invariants 9, unit 1). Pure-unguarded call sites (`TRUNCATE cron_alarms` alone) stay raw; every site whose list or CASCADE closure touches a guarded table adopts the helper. `freeze-under-load.scale.test.ts:91` comment ("no BEFORE TRUNCATE") becomes false at 0021 → updated with the adoption.
- **Session-model note:** execute session runs on **Fable 5** (kickoff fallback clause engaged): NO ultracode, gated cascade with the four Opus-pinned subagents (`.claude/agents/*` frontmatter `claude-opus-4-8`/`effort: max`), web merge-gate unchanged.
- **Pause protocol (doc riders):** at the commit point, PAUSE and request the web-authored text (ADR-0029, ADR-0030, SPEC.2 §5/Appendix B + §6 riders, CLAUDE.md §2 line, AGENTS.md §6 bucket lines) — CC does NOT draft them. B1 amend pattern for the gap: impl commit + paused-session log commit; on receipt `reset --soft` the log, amend riders into the impl commit, rebuild the log with the PR#, `gh pr create`, STOP with the full diff (operator merges after web review). SPEC §0 version/changelog stays sweep-deferred (existing `docs/parked.md` SYNC-sweep row gains the B2 line at the rider commit).
