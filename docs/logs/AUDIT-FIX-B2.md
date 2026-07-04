# AUDIT-FIX-B2 — session log (execute + doc-rider close-out)

## What landed (files + PR#)

**PR #201** — https://github.com/zugzwang-foundation/experiment/pull/201 (open; operator merges after web diff review; squash SHA on `main` becomes canonical). Branch `fix/audit-fix-b2`, three commits:

- `94ddc04` — `chore(docs): plan — AUDIT-FIX-B2` (`docs/plans/AUDIT-FIX-B2.md`, ratified plan + addendum).
- `e5842f9` — `fix(dharma): AUDIT-FIX-B2 — ledger total order (A2 seq) + TRUNCATE guard (A20)` — the implementation **+ the web-authored same-commit doc riders** (amended in at the doc-rider gate; pre-amend SHA was `2241baa`):
  - `src/db/schema/dharma.ts` — `seq` bigint GENERATED ALWAYS AS IDENTITY + `dharma_ledger_user_seq_uq` (userId, seq).
  - `src/server/dharma/persist.ts` — `readLatestBalance` → `ORDER BY seq DESC LIMIT 1`; doc-contract rewritten (seq = total order; chaining = in-tx optimization).
  - `drizzle/migrations/0020_dharma_ledger_seq.sql` (drizzle-generated, hand-checked: 2 statements, expand-only) + `0021_truncate_guards.sql` (hand-written: shared bare-RAISE fn + **25** BEFORE TRUNCATE FOR EACH STATEMENT triggers = 8 Bucket-A + events parent + **all 13 partitions** + 3 Bucket-B) + snapshots/journal.
  - `tests/db/_fixtures/truncate.ts` — TEST-ONLY `truncateTables()` (disable all 25 guards → TRUNCATE CASCADE → re-enable, ONE implicit tx).
  - Teardown adoption: **110 call sites / 76 test files** converted; 4 kept-raw (verified guard-free: `cron_alarms`, `positions`, `admin_sessions` ×2); 5 stale "TRUNCATE bypasses triggers" comments corrected.
  - Scale harness: `reconcile.ts` `sumLatestBalancesPerUser` → `ORDER BY user_id, seq DESC`; `hot-row-contention` chain-walk → `orderBy(seq)`.
  - Tests (@test-writer): T1 deterministic A2 RED reproduction (crafted-uuid tie; observed RED "expected 90, received 100" pre-fix → green post-fix); T2 place() daily-credit-pair fix-validation; T3 `dharma-chain-drift-drain.integration.test.ts` (detector→drain loop closure); T4 two zero-alarm blind-spot pins; T5 `truncate-rejected.spec.ts` (16 guard tests).
  - `docs/parked.md` — OQ-2 (role split) + OQ-3 (D2-C) entries; sweep-debt entry extended to B2 (§0 bump incl. B2 rider rows, §22 two new ADR rows + count-prose → 29 ADRs `0003–0030`, both footers → `0003–0030`).
  - **Doc riders (web-authored, applied verbatim from `~/Downloads/AUDIT-FIX-B2_ADRs-and-riders_web-authored.md`):** `docs/adr/0029-dharma-ledger-total-order-contract.md` + `docs/adr/0030-truncate-rejection-append-only.md` (both **byte-identical** to the source, python-verified); SPEC.2 §5.1 row-2 seq clause + Appendix B.7 seq row + §6 intro + §6.1 clauses 1&2 + §6.2 addendum + §6.5 owner-privilege reconciliation; CLAUDE.md §2 one-clause mechanism note (§2 did not enumerate ops → the rider's add-a-clause branch); AGENTS.md §6 Bucket A/B lines. All content anchors matched exactly on first grep; SPEC.2 §0 (v1.0.15) + §22 verified untouched (zero diff hunks).
- (this log commit — rebuilt with the PR# per the B1 amend recipe)

## Decisions made

- **OQ-1 RESOLVED:** prod `dharma_ledger` = **0 rows** (read-only `doppler --config prd` probe, 2026-07-04) → prod migration unblocked, no escalation. Staging = 3 rows (audit at deploy).
- **OQ-5 CLEARED:** only open PR is #146 (admin UI) — zero `tests/scale/*` overlap; no scale branch on the remote.
- **Fixture design:** disable the FULL 25-guard set (not per-list) in one parameterless `.unsafe()` round-trip = one implicit tx (simple-query protocol, migrate-prod.ts precedent). Rationale: `TRUNCATE … CASCADE` fires ON TRUNCATE triggers on **cascaded** tables too, so short lists (`TRUNCATE markets CASCADE`) reach guarded tables outside themselves; per-site FK-closure analysis would rot. Race-free: both vitest configs run `fileParallelism: false`. Failure ⇒ rollback ⇒ guards can never be left disabled.
- **Session model:** executed on Fable 5 (kickoff fallback clause) — NO ultracode; all four cascade subagents ran Opus-pinned per `.claude/agents/*` frontmatter.

## Surprises caught + fixed in-session

1. **Adoption-script truncation incident (caught + fully recovered pre-commit).** The first sweep's `ensure_import` returned `text[:insert_at] + imp` without re-appending the tail — every import-receiving file was truncated at its import block (~74 files). Caught immediately via Biome unused-import diagnostics; recovered via `git checkout` (97 tracked files) + a second @test-writer pass re-authoring T1–T4 from spec (T5 + `reconcile.ts` untouched by the bug); script fixed (`+ text[insert_at:]`), re-applied, verified by line-count deltas + parse + the full suite. Zero residual — all three reviewers confirmed adoption fidelity afterwards. Lesson: verify script-rewritten files by parse/line-count BEFORE formatting or running anything (extends the "verify Write-authored file tails" memory to scripted rewrites).
2. **T2 is not flaky pre-fix (test-writer SURPRISE, verified).** The place() daily-credit pair passes 11/11 even on live code: the userspace `uuidv7()` uses `clock_timestamp()`, whose ms-prefix advances across the pair's ~4-statement gap, so uuid-DESC resolves the (real) created_at tie correctly at typical spacing — the defect needs a same-millisecond landing or NTP backstep. Consistent with plan STEP 1 (adjacent settle/void/correct loops are the plausible collision sites). T1 (crafted ids) is the deterministic RED driver; T2 kept as fix-validation.
3. **Adoption scope:** 110 sites / 76 files vs the plan's "~40 files list dharma_ledger alone" (that slice was accurate; the full inventory is larger — every list + CASCADE-closure containing any guarded table).

## Cascade verdicts (all Opus-pinned)

- **@test-writer** (2 passes — original + post-incident re-author): T1 RED observed pre-fix; T3/T4 GREEN; T5 collection-RED → all green post-implementation.
- **@code-reviewer:** CLEAN, zero blocking. 1 LOW (stale provenance comment in T3 header) — fixed in-session. Confirmed: no missed old-order consumers (src/tests/scripts sweep), no floats, fixture atomicity sound, kept-raw closures verified, refusal-trigger scan clean.
- **@db-migration-reviewer:** PASS on every item, zero FAIL. Empirically proved statement-trigger non-cloning on the live DB (`tgparentid=0` on all 25 vs cloned 0003 row-triggers); partition names cross-checked one-for-one vs 0002; drizzle-zod generated-always omission verified in node_modules; snapshots/journal consistent.
- **@security-auditor:** CLEAN — zero findings at any level; no MUST-FIX. All 8 mandated checks proven, incl. **fixture unreachable from any src/ production path** (import-graph proof), seq injection triple-blocked (GENERATED ALWAYS + drizzle type omission + drizzle-zod), per-user serialization verified across all 8 producers, owner-privilege residual honestly bounded (nothing worsens it).

## Gates (§5.7)

- `pnpm vitest run` (full default suite): **175 files / 1213 tests passed, 0 failed** (includes `tests/invariants/` + `tests/integration/` — the named subset scripts run these same files/config).
- `pnpm test:scale`: **8/8 files** (edited harness + adopted teardowns under collision storms).
- `ZUGZWANG_ENV=preview just verify`: **All checks passed** (tsc → biome → next build).
- `drizzle-kit check`: clean. Local DB verified: `seq` is_identity=YES; exactly **25** guard triggers; `dharma_ledger_user_seq_uq` present. Chain-vs-seq audit query syntax-validated locally.

## Open questions

- None. The doc-rider gate is closed: riders received, byte-verified, amended into `e5842f9`; gates re-run green after the rider edits (`ZUGZWANG_ENV=preview just verify` + full `pnpm vitest run` 1213/0 again).

## Next session starts at (exact next action)

1. **Operator merges PR #201** after web diff review (squash; the squash SHA on `main` becomes the canonical reference). CI (`ci.yml`) runs on the PR — biome → tsc → drizzle-kit check → migrate (pg_cron-strip unaffected; 0020/0021 apply) → db:check-drift → vitest.
2. **Post-merge deploy (operator-gated, ADR-0024):** staging rehearsal — `doppler run --config stg -- pnpm db:migrate:staging` → `/api/health` gate → chain-vs-seq audit on staging's 3 rows (SQL below; expect `broken_links = 0`, else STOP/escalate) → prod `doppler run --config prd -- pnpm db:migrate:prod` **before** promote (migrate-before-serve; new code requires `seq`). OQ-1 already confirmed prod = 0 rows.
3. Post-merge hygiene: verify the squash tree per the post-merge proof memory; delete the remote branch if auto-delete didn't fire; `/clear` before the next task.

## Context to preserve

- **Chain-vs-seq audit SQL** (read-only; run post-migrate on staging, then prod):
  ```sql
  SELECT count(*) AS broken_links FROM (
    SELECT user_id, seq, entry_type, amount, balance_after,
           LAG(balance_after) OVER (PARTITION BY user_id ORDER BY seq) AS prev_ba
    FROM dharma_ledger) w
  WHERE CASE WHEN entry_type = 'uncollectable'
             THEN balance_after IS DISTINCT FROM COALESCE(prev_ba, balance_after)
             ELSE balance_after IS DISTINCT FROM (COALESCE(prev_ba, 0) + amount) END;
  -- Expected 0. >0 ⇒ heap-order backfill mismatch ⇒ STOP, escalate.
  ```
- 0021 forward obligation: any future partition-adding migration MUST attach `bucket_a_no_truncate` to the new partition (0021 header + ADR-0030 record it; no dynamic partition creation exists today).
- Kept-raw teardown sites (4, guard-free closures verified): `alarms-drain` `cron_alarms`; `positions.integration` `positions`; `markets-media-sign{,-log-request}` `admin_sessions`.
- Fixture guard list mirrors 0021 (25 entries) — keep in sync if the protected set ever changes; the T5 positive control pins re-enablement.
- D2-C fast-follow (parked OQ-3): promote the audit SQL above into a third `check_nightly_drift()` derivation via the 0007→0011→0015 function-replace precedent; landing it flips the two T4 pin tests consciously.

## Time

~3h wall: recon+preflight 45m · tests-first 20m · implementation 30m · incident recovery + re-author 45m · gates 15m · cascade 30m · close-out 15m.
