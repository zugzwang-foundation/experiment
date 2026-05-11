# SCAFFOLD.2 stratum 3.B — Drizzle schemas (wind-down log)

> Per-session log per CLAUDE.md §5.9. This is the canonical wind-down for
> stratum 3.B. An earlier in-flight checkpoint sits at
> `docs/logs/SCAFFOLD.2.md` lines 80–139 (written pre-merge of PR #25 and
> pre-existence of PR #26); this file is the complete post-merge record.

**Date:** 2026-05-11
**Branches:** `feat/scaffold-2-stratum-b` (PR #25), `chore/claude-md-workflow-rewrite` (PR #26)
**PRs merged to main:** #25 (`e6a136a`), #26 (`304681b`)
**Session length:** ~1 chat (plan → execute → workflow course-correction)

---

## 1. What landed

### PR #25 — `feat(scaffold-2): b — drizzle schemas (21 tables, 10 domains, 11 files)` (`e6a136a`)

- **10 new per-domain schema files** at `src/db/schema/<domain>.ts`:
  - `auth.ts` — 5 tables (users, sessions, accounts, verifications, admin_sessions); all Bucket C
  - `markets.ts` — 2 tables (markets, pools); both Bucket C
  - `bets.ts` — 2 tables (bets [Bucket A], positions [Bucket C]); declares shared `sideEnum`
  - `comments.ts` — 2 tables (comments [Bucket A], friendly_fire_events [Bucket B])
  - `dharma.ts` — 1 table (dharma_ledger [Bucket A])
  - `events.ts` — 3 tables (events [Bucket A, type-only], resolution_events [A], payout_events [A])
  - `identity.ts` — 1 table (identity_pool [Bucket B])
  - `image-uploads.ts` — 1 table (image_uploads [Bucket B])
  - `audit.ts` — 3 tables (mod_actions [A], admin_events [A], user_events [A])
  - `system.ts` — 1 table (system_state [Bucket B, text-PK carve-out])
- **21 tables total**, matching SPEC.2 §5.2 bucket totals (9 A + 4 B + 8 C)
- **`src/db/schema/index.ts`** — `export {};` placeholder replaced with 10 alphabetical re-export lines (Biome organize-imports order)
- **9 `pgEnum`s**: `marketStatusEnum`, `marketOutcomeEnum`, `sideEnum`, `ffDirectionEnum`, `dharmaEntryTypeEnum`, `resolutionEventKindEnum`, `payoutTypeEnum`, `imageTerminalStateEnum`, `modVerdictEnum`
- **4 open-extensible `text` event-type columns**: `events.event_type`, `events.aggregate_type`, `admin_events.event_type`, `user_events.event_type` (per SPEC.2 §7.1 line 686)
- **INV-1 schema half**: `bets.comment_id NOT NULL` lambda FK to `comments.id` with `onDelete: 'restrict'`
- **INV-2 storage-layer enforcement**: `dharma_ledger CHECK (balance_after >= 0)` — lone in-scope CHECK in 3.B
- **Two independent Bucket-B whitelisted columns** on `friendly_fire_events`: `cleared_at` + `frozen_at` (3.C trigger rejects both transitioning together)
- **All FKs indexed** per AGENTS.md §6; `relations()` per table
- **drizzle-zod insert/select schemas co-located** per table
- **Same-commit SPEC.2 amendments**: §5.1 row 10 + Appendix B.8 ratify `friendly_fire_events.cleared_at` as the second independent Bucket-B whitelisted transition

### PR #26 — `chore(claude-md): replace post-PR soak with pre-PR self-audit + subagent invocation policy` (`304681b`)

- **CLAUDE.md rewrite**:
  - §1: critical-path triggers now include `pre-PR self-audit + task-appropriate subagent review`
  - §2: INV-2 mechanism mentions `CHECK (balance_after >= 0)` (matches what 3.B shipped)
  - §5.1: plan-file path clarified — `docs/plans/<TASK-ID>.md`, not `.claude/plans/<scratch>.md`
  - §5.6: scope clarified — business logic only; type-only declarations exempt
  - §5.7: `just check` → `just verify` (matches actual recipe name in justfile)
  - §5.10 **NEW**: Pre-PR self-audit (PASS/FAIL/SURPRISE format; replaces the 24-hour soak)
  - §5.11 **NEW**: Subagent invocation policy (explicit primary, auto fallback)
  - §5.12: ADRs (was §5.11)
  - §6: subagent descriptions rewritten as `MUST BE USED` routing rules with inline tool scoping, model, effort
  - §8 + footer: soak language removed; revision footer updated
- **`.claude/agents/` — 4 new agent files**:
  - `code-reviewer.md` — MUST BE USED after `src/server/` changes; CRITICAL/HIGH/MEDIUM/LOW finding format
  - `db-migration-reviewer.md` — MUST BE USED after `src/db/schema/` or migrations changes; PASS/FAIL/SURPRISE per table
  - `security-auditor.md` — MUST BE USED after critical-path code-reviewer pass; exploitability ranking with mandatory SAFE section
  - `test-writer.md` — MUST BE USED at Phase 2 start for business-logic tasks; tests-first; forbidden from editing `src/`
- **SCAFFOLD.10 and FOUND.4 effectively closed** by this PR (tracker items for "subagent rewrite" + "soak rule binding" — both substantively superseded)

---

## 2. Decisions made

### Four SPEC.1 ↔ SPEC.2 contradictions resolved in Phase 1 (planning)

All resolved in favor of SPEC.1 / canonical inventory; SPEC.2 listings flagged as drift for PRECURSOR.5:

1. **`markets.status` enum** — adopted SPEC.1 §6.1's 7-state list (`Draft|Open|Closed|Resolving|Resolved|Voided|Frozen`). SPEC.2 B.2's 3-state listing flagged as drift.
2. **`dharma_ledger.entry_type` enum value** — adopted `bet_payout` per SPEC.2 B.7 (consistent with `payout_events.payout_type='bet_payout'`). SPEC.1's `bet_settle` deprecated.
3. **`identity_pool.number` range** — adopted SPEC.1 §13 + ADR-0011 absorption (smallint 0–999). SPEC.2 B.15's `1-9` flagged as drift.
4. **`mod_actions` + `friendly_fire_events` columns** — adopted SPEC.2 Appendix B minimal column sets (9 + 7 cols). SPEC.1's named adds derivable from Bucket-A append-only + jsonb.

### Better Auth 1.6.x users 4-column gap

`users` declared with 17 columns: SPEC.2 B.1's 13 plus Better Auth core `name`, `email_verified`, `image`, `updated_at`. `email` also flipped from NULL to NOT NULL to match Better Auth's contract. Reason: Better Auth's core code reads these columns directly — cannot be papered over via the `fields` rename map. SPEC.2 B.1 flagged as drift for PRECURSOR.5 sweep.

### Same-commit SPEC.2 amendments (per plan §"Same-commit SPEC.2 edits")

- §5.1 row 10: `friendly_fire_events.cleared_at` "schema decided by SCAFFOLD.2 per ADR-0009" → concrete ratification text (nullable timestamptz; second independent Bucket-B whitelisted transition; independent from `frozen_at`; 3.C trigger function permits either transitioning alone, rejects both transitioning together)
- Appendix B.8: mirror amendment on the notes column
- Verification: `grep -c "schema decided by SCAFFOLD.2 per ADR-0009" docs/specs/SPEC.2.md` returned 0 after edits

### Single in-scope CHECK constraint

`dharma_ledger CHECK (balance_after >= 0)` — INV-2 storage-layer enforcement adopted in 3.B (per user direction, deviating from "no CHECKs in 3.B" default). All other CHECK constraints deferred to HARDEN.* scope. Reason: INV-2 is too load-bearing to defer until application-layer-only enforcement.

### Workflow course-correction mid-session (PR #26)

Two structural gaps surfaced during 3.B's execute phase:
- The 24-hour post-PR soak rule wasn't binding under pressure
- Subagents (`@code-reviewer`, `@db-migration-reviewer`, etc.) weren't invoked despite being load-bearing for schema review

Resolution: PR #26 replaced the soak with a pre-PR self-audit (§5.10) and formalized subagent invocation as explicit-primary-plus-auto-fallback (§5.11). Subagent descriptions sharpened to `MUST BE USED` routing rules for reliable auto-invocation.

### Biome auto-fixes during verify (non-semantic)

- `src/db/schema/auth.ts` — import-sort merged the third-party + relative import blocks under Biome's single-block organize-imports rule
- `src/db/schema/comments.ts` — re-wrapped one `uniqueIndex().on(table.voterId, table.commentId)` call onto a single line
- Both: safe formatter fixes; committed in post-fix state

---

## 3. Open questions

None blocking 3.C. Carry-forward items for PRECURSOR.5 drift sweep:

- **SPEC.2 B.1 users column gap** — 4 Better Auth core columns absent from B.1 inventory + `email` nullability mismatch
- **SPEC.2 B.2 markets.status** — 3-state listing vs SPEC.1 §6.1 7-state canonical
- **SPEC.2 B.15 identity_pool.number** — `1-9` vs SPEC.1 §13 + ADR-0011 `0-999`
- **SPEC.2 B.7 `bet_settle` vs `bet_payout`** — SPEC.1's `bet_settle` deprecated, but appears in B.7 enum text
- **AGENTS.md §10 pnpm version + `pnpm-workspace.yaml` line** (carried forward from 3.A) — pnpm-workspace.yaml is now git-tracked; the "not used (single package)" line is technically inaccurate for build-approval purposes
- **`block-main-commits.sh` drift** — referenced in CLAUDE.md §6 but neither the script nor a `lefthook.yml` rule actually exists. Either ship the hook or remove the reference. (Discovered during this wind-down — log-only main commit proceeded without it.)

---

## 4. Next session starts at

**SCAFFOLD.2 stratum 3.C — Migrations + triggers + system_state seed.**

- Branch: `feat/scaffold-2-stratum-c` from `main` (after `/clear`)
- **Critical-path** (touches `drizzle/migrations/` per CLAUDE.md §1)
- `/plan` mandatory per §5.1; plan file at `docs/plans/SCAFFOLD.2-3C.md`
- `@db-migration-reviewer` invocation required per §5.11 (after pre-PR self-audit passes, before `gh pr create`)
- Pre-PR self-audit required per §5.10 (PASS/FAIL/SURPRISE on every migration's DDL, trigger SQL, partition setup, seed-row constraints)

**Scope — 5 migration files in absolute order:**

1. `0000_uuidv7_function.sql` — userspace `public.uuidv7()` PL/pgSQL function per ADR-0016. Must precede every `default(sql\`uuidv7()\`)`-using migration.
2. `0001_initial_schema.sql` — drizzle-kit generated from 3.B schemas. Verify: grep for `CREATE TABLE.*events` returns 0 (events excluded by `tablesFilter: ["!events"]`); CREATE TABLE count = 20.
3. `0002_events_partitioning.sql` — hand-written `CREATE TABLE events ... PARTITION BY RANGE (created_at)` per SPEC.2 §7 + ADR-0005. Drizzle 0.45 cannot express partitioning natively.
4. `0003_append_only_triggers.sql` — Bucket A strict (no UPDATE/DELETE) + Bucket B whitelisted (one NULL→timestamp column transition; `friendly_fire_events` permits either `frozen_at` or `cleared_at` alone, not both; `image_uploads` is two-column atomic on `terminal_state`+`terminal_at`; `system_state` permits `frozen_at` alone) per SPEC.2 §6.
5. `0004_seed_system_state.sql` — INSERT the single `id='system'` row.

**Same-commit SPEC ratification:** `system_state.id` text-`'system'` PK carve-out — SPEC.2 ratification text (deferred from 3.B per plan §"Confirmed framing" item 3).

**Out of scope for 3.C:** trigger tests (3.D), canonical invariant integration tests (3.D), Supabase RLS policies (3.E or HARDEN.*), seed data for `identity_pool` (SCAFFOLD.17).

---

## 5. Context to preserve (non-obvious)

### Schema patterns established in 3.B (3.C must respect)

- **Circular FK pair** `bets.comment_id ↔ comments.bet_id`: both declared with `references((): AnyPgColumn => …, { onDelete: 'restrict' })` lambda form. ESM lazy evaluation handles the import cycle. `bets.comment_id` is NOT NULL (INV-1); `comments.bet_id` is nullable.
- **Self-ref lambdas:** `comments.parent_comment_id`, `resolution_events.corrects_event_id` (both `onDelete: 'restrict'`).
- **`events.event_id`** is the PK column name, **not `id`** — per SPEC.2 §7.1 line 685. Any code defaulting to `<table>.id` must explicitly target `events.event_id`.
- **`events` pgTable is type-only in 3.B** — `drizzle.config.ts tablesFilter: ["!events"]` excludes it from drizzle-kit DDL generation. 3.C's `0002_events_partitioning.sql` is hand-written and is the actual DDL source.
- **`system_state.id` is `text PRIMARY KEY` literal `'system'`** — carve-out from universal UUIDv7 PK convention. Documented in `src/db/schema/system.ts` source comment. SPEC.2 ratification text lands in 3.C.
- **`actor_id` columns** in `mod_actions` and `admin_events` are `text NOT NULL` (not FKs to `users`) — admin has no `users` row per §8.7 pillar 1 / CLAUDE.md §3 refusal trigger.
- **Relation disambiguation:** `relationName: "comment_thread"` on `comments` parent ↔ children self-ref; `"resolution_corrections"` on `resolution_events` self-ref.
- **`dharma_ledger CHECK (balance_after >= 0)`** is the **only** in-scope CHECK in 3.B; all other CHECK constraints stay HARDEN.* scope.
- **`comments.image_uploads_id`** keeps the plural-target → `_id` naming per SPEC.2 B.6 line 2480. Intentional; do not singularize.

### 3.C trigger behavior 3.B's schema is counting on

- Bucket A tables (`events`, `dharma_ledger`, `bets`, `comments`, `resolution_events`, `payout_events`, `mod_actions`, `admin_events`, `user_events`): strict append-only — `BEFORE UPDATE` and `BEFORE DELETE` triggers reject all.
- Bucket B tables: one whitelisted NULL → timestamp transition per column, plus per-table guards:
  - `friendly_fire_events`: permits **either** `frozen_at` or `cleared_at` flipping NULL → timestamp alone; **rejects both flipping in same UPDATE**; rejects re-firing; rejects other column changes.
  - `image_uploads`: two-column atomic — `terminal_state` and `terminal_at` flip together (NULL → set, once). Trigger `enforce_image_uploads_terminal_atomic` rejects partial transitions.
  - `identity_pool`: `assigned_at` flips NULL → timestamp once.
  - `system_state`: `frozen_at` flips NULL → timestamp once (the 2026-11-05 23:59 UTC conclusion freeze).

### Workflow rules now in force (per CLAUDE.md post PR #26)

- **§5.10 pre-PR self-audit** (PASS/FAIL/SURPRISE) is required for every critical-path PR before `gh pr create`. The audit walks the plan's per-component inventory at write-time.
- **§5.11 subagent invocation**: schema/migration work requires `@db-migration-reviewer`; server work requires `@code-reviewer`; critical-path business logic requires `@security-auditor` after code-reviewer; new business-logic behavior requires `@test-writer` at Phase 2 start. Plan path **must** be passed in every invocation (`@docs/plans/<TASK-ID>.md`) — subagents start from zero context.
- **24-hour soak is no longer the rule.** Pre-PR audit at write-time replaces it.
- **Plan file location**: `docs/plans/<TASK-ID>.md` (in-repo, committed before Phase 1 ends). Not `.claude/plans/`.

### Build / verify state

- `pnpm drizzle-kit generate` NOT run yet (3.C scope) — `drizzle/migrations/` is empty.
- `just test-db` cannot run yet (no migrations).
- `just verify` is DB-free (typecheck + biome + build) and is the gate that 3.B passed.
- pnpm 11 strict-mode build approvals already configured (esbuild, lefthook, sharp).
- Lefthook: pre-commit runs biome-check-staged on `.{js,jsx,ts,tsx,json,jsonc,css}` only; pre-push runs typecheck + biome-check-all. `.md` is not in biome's pre-commit glob.

### Drift flagged this session

- `block-main-commits.sh` referenced in CLAUDE.md §6 but no actual file in `.claude/hooks/` and no rule in `lefthook.yml`. Log-only main commit (this commit) proceeded without obstacle. Either ship the hook or trim the reference in CLAUDE.md §6.

---

## 6. Time

~1 chat: Phase 1 plan (web Claude review) → Phase 2 execute (this Claude Code session for 3.B schemas) → workflow course-correction (PR #26) → wind-down. Plan-then-execute split via two Claude Code tabs.
