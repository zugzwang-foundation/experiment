# SCAFFOLD.2 — close-out

> Task-level close-out per CLAUDE.md §5.9. Supersedes the per-session in-flight
> checkpoint that previously sat at this path. Per-stratum logs at
> `docs/logs/SCAFFOLD.2-3A.md`, `…-3B.md`, `…-3C.md`, `…-3D.md`.

- **Task:** SCAFFOLD.2 — Postgres + Drizzle + event-sourced schema foundation
- **Closed:** 2026-05-12
- **PRs:** #22 (3.A), #25 (3.B), #28 (3.C), #30 (3.D), TBD (3.E this PR)
- **Adjacent workflow PR:** #26 (`chore(claude-md): replace post-PR soak with pre-PR self-audit + subagent invocation policy`) — landed mid-3.B; not a stratum PR but in-task
- **Per-stratum log PRs:** #24 (3.A), #27 (3.B), #29 (3.C); 3.D log is included in #30; 3.E log is this PR
- **Branch convention:** `feat/scaffold-2-stratum-<a|b|c|d>` (PRs #22 / #25 / #28 / #30) + `chore/scaffold-2-close` (this PR)
- **Master plan:** `docs/plans/SCAFFOLD.2.md` (canonical contract, all 5 strata)

---

## What landed

- **12 Drizzle schema files** at `src/db/schema/` — 10 per-domain (`auth.ts`, `markets.ts`, `bets.ts`, `comments.ts`, `dharma.ts`, `events.ts`, `identity.ts`, `image-uploads.ts`, `audit.ts`, `system.ts`) + `_enums.ts` (extracted in 3.C to break the `bets↔comments` `sideEnum` TDZ cycle) + `index.ts` re-export aggregator.
- **21 application tables** across 10 domains per SPEC.2 §5.2 (9 Bucket A + 4 Bucket B + 8 Bucket C). Bucket totals match canonical inventory.
- **9 `pgEnum`s**: `marketStatusEnum`, `marketOutcomeEnum`, `sideEnum`, `ffDirectionEnum`, `dharmaEntryTypeEnum`, `resolutionEventKindEnum`, `payoutTypeEnum`, `imageTerminalStateEnum`, `modVerdictEnum`.
- **5 SQL migrations** at `drizzle/migrations/`, applied in absolute order:
  1. `0000_uuidv7_function.sql` — hand-written `public.uuidv7()` PL/pgSQL per ADR-0016 (kjmph gist pure-SQL variant; AGPL header).
  2. `0001_initial_schema.sql` — drizzle-kit generated, then hand-edited to delete the 12 events-related lines (3.A `tablesFilter` no-op drift); 20 `CREATE TABLE`, 9 `CREATE TYPE`, FKs + indexes, `dharma_ledger.balance_after >= 0` CHECK (the lone in-scope CHECK from 3.B; INV-2 storage-layer enforcement).
  3. `0002_events_partitioning.sql` — hand-written; `events` table with composite PK `(event_id, created_at)`; 12 monthly RANGE partitions (`2026_05` → `2027_04`) + `events_default`.
  4. `0003_append_only_triggers.sql` — 6 trigger functions (2 shared Bucket A + 4 per-table Bucket B) + 26 trigger declarations across 13 protected tables; `friendly_fire_events` permits two independent NULL→timestamp transitions (universal Q1 3-rule formulation).
  5. `0004_seed_system_state.sql` — singleton `INSERT ('system', NULL) ON CONFLICT (id) DO NOTHING`.
- **14 test files** under `tests/`:
  - 13 trigger spec files at `tests/db/triggers/<table>-append-only.spec.ts` (one per protected table) — 18 Bucket A cases + 30 Bucket B cases = 48 trigger cases.
  - 1 INV-4 canonical at `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts` — 3 cases covering mechanism (ii) + SPEC.2 §7.3 storage idempotency.
  - **51 cases total** (SPEC.2 §6.6 floor 33 met with margin of 18).
- **Test infrastructure:** `vitest.config.ts` (root) with `vite-tsconfig-paths` plugin, `pool: 'forks'`, `fileParallelism: false`, `testTimeout: 10_000`; `tests/db/_fixtures/db.ts` with two-client split (`testClient` raw `postgres-js`, `testDb` Drizzle 0.45 wrapper) + `createdAtFromUuidV7()` helper.
- **41 F-* skeletons** at `docs/specs/flows/` (40 active + 1 README per SPEC.2 §13.3 inventory; 38 active flows + 2 struck audit traces for F-COMMENT-4/5 per SPEC.1 §8).
- **`system_state` singleton seeded** on every fresh DB (`id='system'`, `frozen_at=NULL`).
- **4 `db-*` recipes** added to `justfile`: `db-generate <name>`, `db-migrate`, `db-reset`, `test-db`.
- **Dependencies:** 8 runtime/dev deps added across 3.A — `drizzle-orm ^0.45.0`, `drizzle-zod ^0.7.0`, `postgres ^3.4.5`, `uuid ^11.0.0`, `server-only ^0.0.1` (deps); `drizzle-kit ^0.30.0`, `vitest ^3.0.0`, `@types/uuid ^10.0.0` (devDeps). 3.D added `vite-tsconfig-paths ^6.1.1` (devDep, one-line).
- **pnpm 11 strict-mode build approvals:** `pnpm.onlyBuiltDependencies` = `[esbuild, lefthook, sharp]` in `package.json`; `pnpm-workspace.yaml` newly git-tracked carrying matching `allowBuilds`.
- **Tooling pins:** `supabase = "latest"` in `mise.toml` (resolved 2.98.2 at task close); `vite-tsconfig-paths ^6.1.1`.
- **`drizzle.config.ts`** declared with `tablesFilter: ["!events"]` (intent per ADR-0005 §5; documented as no-op for `generate` in 3.C — the events DDL is hand-written in `0002`).
- **`src/db/index.ts`** declared with `import "server-only"` first-statement discipline per ADR-0008 §1; exports `DbClient` and `DbTransaction` type aliases for ENGINE.7's bet wrapper.

---

## SPEC.2 amendments (same-commit per stratum)

Per 3.C log §3: ADR files 0003–0016 are ghost references in this repo; substance is canonical via SPEC.2 absorption. All "ADR amendments" in plans translated to SPEC.2 amendments.

**3.B (PR #25, commit `e903c72`):**
- **§5.1 row 10 + Appendix B.8** — `friendly_fire_events.cleared_at` ratified as nullable `timestamptz`; second independent Bucket-B whitelisted transition (independent from `frozen_at`); 3.C trigger permits either column transitioning alone, rejects both transitioning together. `grep -c "schema decided by SCAFFOLD.2 per ADR-0009" docs/specs/SPEC.2.md` → 0 post-edit.

**3.C (PR #28, commit `1143d52`):**
- **§6.3 paragraph 1** — `friendly_fire_events` updated from "single transition on frozen_at" to "two independent NULL→timestamp transitions" per 3.B ratification absorption. `image_uploads` example aligned to universal 3-rule formulation (drop unconditional re-fire RAISE; `IS DISTINCT FROM` pattern).
- **§7.1** — `event_id` PK annotation updated to composite PK with `created_at`; added rationale paragraph naming the Postgres partition-key constraint.
- **§7.3** — `ON CONFLICT (event_id, created_at) DO NOTHING` replaces `ON CONFLICT (event_id) DO NOTHING`. Added insertEvent helper note that `created_at` is supplied deterministically from UUIDv7's millisecond prefix so retries reuse the same value (storage idempotency stands).
- **§3.7 / §5.1 / §7.7** — consistency sweep for the composite PK change.

No SPEC.2 amendments in 3.A or 3.D.

---

## Carve-outs from universal patterns

- **`system_state.id` is text `'system'`**, not uuid. Single-row sentinel discipline per SPEC.2 §20.2; documented inline in `src/db/schema/system.ts` and ratified in 3.C SPEC.2 amendment scope. The lone non-uuid PK in the repo.
- **`events` DDL is hand-written** in `drizzle/migrations/0002_events_partitioning.sql` (Drizzle 0.45 cannot express `PARTITION BY RANGE`). Type inference comes from `src/db/schema/events.ts` via drizzle-zod; the schema file's declaration deliberately omits the partition clause and the composite PK shape — see PRECURSOR.5 backlog.
- **`events.event_id`** is the PK column name (per SPEC.2 §7.1 line 685), not `id`. Composite PK is `(event_id, created_at)` post-3.C amendment.
- **`admin_sessions.session_id`** is the PK column name (Better Auth 1.6.x convention), not `id`. The second named-PK carve-out alongside `events.event_id`.
- **`actor_id` columns** in `mod_actions` and `admin_events` are `text NOT NULL` (not FKs to `users`) — admin has no `users` row per SPEC.2 §8.7 pillar 1 / CLAUDE.md §3 refusal trigger.
- **Universal Bucket B 3-rule** across all four Bucket B tables (`friendly_fire_events`, `identity_pool`, `image_uploads`, `system_state`) — `image_uploads` aligned in 3.C to the friendly_fire / identity_pool / system_state semantics; permit no-op UPDATEs on terminal rows; asymmetry rejected as permanent cognitive tax.

---

## Verification

All 8 verification-chain steps from master plan §3.E ran clean against a fresh local Supabase Postgres 17.6 on `chore/scaffold-2-close`:

| Step | Check | Expected | Actual | Status |
|---|---|---|---|---|
| 1 | `just db-reset` | clean recreation | recreated, no errors | PASS |
| 2 | `just db-migrate` (inline `DATABASE_URL` workaround) | 5 migrations applied | 5 applied, no errors | PASS |
| 3 | base table count in `public` | 21 application | 34 raw / 21 application (after excluding 13 events partition children) | PASS¹ |
| 4 | `id` column inventory | 20 uuid + 1 text | 18 uuid + 1 text = 19 rows (events.event_id + admin_sessions.session_id are the two named-PK carve-outs documented above) | PASS² |
| 5 | trigger count on protected tables | 26 | 26 | PASS |
| 6 | events partition count | 13 (12 monthly + 1 default) | 13 | PASS |
| 7a | `just verify` (tsc + biome + build) | green | green | PASS |
| 7b | trigger + invariant tests (inline `DATABASE_URL` workaround) | 51+ cases | 14 files / 51 cases / 0 fail / 0 skip / 5.30s | PASS |
| 8 | `SELECT uuidv7(), uuidv7()` | two distinct, same time-prefix | `019e1c9f-934f-78ca-…` + `019e1c9f-934f-79a3-…` (millisecond prefix matches) | PASS |

¹ Master plan §3.E line 1001 parenthetical "(events partitions are children, not base tables)" is technically inaccurate against Postgres `information_schema.tables`, which reports partition children with `relkind='r'` as `BASE TABLE`. The accurate count is 21 application tables + 13 partition children = 34. Storage-layer state matches SPEC.2 §5.2 inventory exactly.

² Master plan §3.E line 1009 expected "20 uuid + 1 text". Actual is 18 uuid + 1 text = 19 rows because `events.event_id` (per SPEC.2 §7.1) and `admin_sessions.session_id` (per Better Auth schema) do not use the universal `id` column name. Both are documented carve-outs.

The two master-plan imprecisions are captured as PRECURSOR.5 backlog items below ("master plan §3.E verification expectations").

---

## What's NOT in this task (deferred)

- **Decimal arithmetic library choice** → ENGINE.5 (pre-condition for Dharma accounting + CPMM pricing math).
- **Better Auth wiring** (config, session-deferral hook, admin static-password path) → SCAFFOLD.3.
- **Bet transaction wrapper** at `src/server/bets/transaction.ts` → ENGINE.7.
- **Events insert helper** + per-event-type Zod schemas → ENGINE.6 (`(event_id, created_at)` deterministic from UUIDv7 prefix per SPEC.2 §3.7 + §7.3).
- **Pseudonym pool consumer** (assigns identity_pool rows to users on first action) → SCAFFOLD.3.
- **`identity_pool` data load** (the 1,000 pseudonym × number pairs) → SCAFFOLD.17.
- **F-* substance fills** → per SPEC.2 §13.4 gating cadence (each F-* fills in its parent task; skeletons here are scaffold only).
- **Other Bucket B / Bucket C CHECK constraints** beyond `dharma_ledger.balance_after >= 0` → HARDEN.* scope.
- **Supabase RLS policies** → HARDEN.* (or SCAFFOLD.3 if auth path needs them earlier).
- **Sentry alarm 2 wiring** for DEFAULT-partition writes → HARDEN.*.
- **INV-1 / INV-2 / INV-3 canonical integration tests** → ENGINE.7 (INV-1 + INV-3 bet/comment atomicity + side-binding); ENGINE.6/ENGINE.7 (INV-2 dharma overdraft via application-layer invariant). INV-4 canonical landed in 3.D.

---

## Project knowledge update table

| File | Current state | Action | Reason |
|---|---|---|---|
| `docs/specs/SPEC.2.md` | amended in 3.B + 3.C (§5.1 row 10, B.8, §3.7, §5.1, §6.3, §7.1, §7.3, §7.7) | Verify currency in web Claude context | SPEC.2 absorbs ADR-0009 + ADR-0016 substance per 3.C precedent |
| `docs/plans/SCAFFOLD.2.md` | new (master plan, all 5 strata) | Add | task plan, archival reference |
| `docs/logs/SCAFFOLD.2.md` (this file) | rewritten as task-level close-out | Add | task close-out (Tier 2 rolling) |
| `docs/logs/SCAFFOLD.2-3A.md`, `…-3B.md`, `…-3C.md`, `…-3D.md` | per-stratum logs | Keep | per-session log series per CLAUDE.md §5.9; 3.A extracted from in-flight `SCAFFOLD.2.md` in the same commit as this close-out |
| `docs/adr/0003-0016` | still ghost references (not present in repo) | Verify approach with Hrishikesh | substance absorbed into SPEC.2 (3.C precedent); decide whether to land the files or trim the references — see PRECURSOR.5 backlog |
| `zugzwang_experiment_tracker_v6.html` | tracker | Keep (stale) | Hrishikesh updates separately |

---

## PRECURSOR.5 backlog

Aggregated from all 4 stratum session logs + 3.E verification chain. 12 items.

**Spec/inventory drifts (4) — flagged in 3.B:**

- **From 3.B log §3 (carry-forward):** SPEC.2 Appendix B.1 users column gap — 4 Better Auth core columns (`name`, `email_verified`, `image`, `updated_at`) absent from B.1 inventory; `email` nullability mismatch (Better Auth requires NOT NULL; B.1 lists nullable).
- **From 3.B log §3 (carry-forward):** SPEC.2 Appendix B.2 `markets.status` 3-state listing vs SPEC.1 §6.1's canonical 7-state list (`Draft|Open|Closed|Resolving|Resolved|Voided|Frozen`). 3.B adopted the 7-state SPEC.1 list.
- **From 3.B log §3 (carry-forward):** SPEC.2 Appendix B.15 `identity_pool.number` range listed as `1-9` vs SPEC.1 §13 + ADR-0011 absorption `0-999` (smallint). 3.B adopted the SPEC.1 range.
- **From 3.B log §3 (carry-forward):** SPEC.2 Appendix B.7 `dharma_ledger.entry_type` enum text still mentions `bet_settle`; SPEC.1's `bet_settle` is deprecated and 3.B + 3.C use `bet_payout` (consistent with `payout_events.payout_type='bet_payout'`).

**Tooling/workflow drifts (5):**

- **From 3.A log + 3.B log §3:** AGENTS.md §10 line "`pnpm-workspace.yaml` not used (single package)" is now technically inaccurate — the file is git-tracked since 3.A (pnpm 11 strict-mode `allowBuilds`). Also AGENTS.md says pnpm 10 baseline; corepack-resolved pnpm is 11.0.9 (mise installs 10.33.2 but corepack overrides). Bundle both into a single AGENTS.md §10 amendment.
- **From 3.B log §3:** `block-main-commits.sh` referenced in CLAUDE.md §6 but neither the script nor a `lefthook.yml` rule actually exists. Either ship the hook or trim the reference.
- **From 3.C log §4 + 3.D log §4 + 3.E verification chain:** `just db-migrate` and `just test-db` don't source `.env.local` — workaround used in every stratum is `DATABASE_URL='postgresql://postgres:postgres@localhost:54322/postgres' <cmd>`. Justfile recipes need `set dotenv-load := true` or per-recipe env-source.
- **From 3.C log §4:** `supabase/` runtime state directory at repo root is not in `.gitignore` (currently surfaces as untracked).
- **From 3.D log §4:** `.claude/agents/*.md` files (4 agent definitions added in PR #26) are not discoverable by the runtime `Agent` tool — only built-in types (`claude-code-guide | Explore | general-purpose | Plan | statusline-setup`) are exposed. CLAUDE.md §5.11 + §6 + commit `304681b` document `@code-reviewer` / `@db-migration-reviewer` / `@security-auditor` / `@test-writer` as invocable; runtime returns `Agent type '<name>' not found`. Worked around in 3.D by invoking `general-purpose` with role + plan baked in. Will hit every critical-path stratum starting with SCAFFOLD.3 / ENGINE.* until the harness/`.claude/settings.json` wiring lands.

**Code-shape drifts (1):**

- **From 3.C log §4 + 3.D log §4:** `src/db/schema/events.ts` declaration not aligned to the composite PK `(event_id, created_at)`. Storage-layer DDL in `0002_events_partitioning.sql` is the truth; the Drizzle type-inference layer is currently misaligned. INV-4 case 3 worked around via raw `testClient.unsafe(...)` for `ON CONFLICT (event_id, created_at) DO NOTHING`. Type-only fix in 3.B scope.

**Spec-canonicalization (1):**

- **From 3.C log §4:** ADR files 0003–0016 remain ghost references in CLAUDE.md / AGENTS.md / SPECs / plans / log files. No files at `docs/adr/0003-*.md` through `0016-*.md`. 3.C precedent absorbed all ADR amendments into SPEC.2 §-level edits. Decision: either land the ADR files from project knowledge into `docs/adr/`, or update every reference to point to SPEC.2 absorptions consistently. Both approaches valid; needs one consistent call.

**Verification-chain documentation (1, new in 3.E):**

- **From 3.E (this stratum):** Master plan §3.E verification chain expectations are imprecise on two steps: Step 3's "21 base tables (events partitions are children, not base tables)" is wrong against Postgres `information_schema.tables` (children show `relkind='r'`/`BASE TABLE`); Step 4's "20 uuid + 1 text" misses two named-PK carve-outs (events.event_id, admin_sessions.session_id) → actual 18 uuid + 1 text. Either tighten the queries (filter `table_name NOT LIKE 'events\_%'`; cover `event_id`/`session_id`) or annotate the expected counts in the master plan. The actual storage-layer state matches SPEC.2 inventory exactly; only the expected-value text is imprecise.

---

## Next task

**SCAFFOLD.3 — Auth wiring.** Better Auth participant path (Google OAuth + Email-OTP) + admin hand-rolled static-password path. Per ADR-0004 + ADR-0010 + AGENTS.md §1. New session, new web Claude chat, `/clear` between.

Strong candidate to precede SCAFFOLD.3 if Hrishikesh prefers a tooling reset first:
**PRECURSOR.5 cleanup pass** bundling the 12 backlog items above (or a subset) into one focused PR. The Agent-discovery issue in particular will pay friction on every critical-path stratum from SCAFFOLD.3 forward — worth fixing early.
