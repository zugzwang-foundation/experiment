# SCAFFOLD.2-3C — Migrations + triggers + system_state seed

> **Status:** drafted
> **Date:** 2026-05-11
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** **yes** — touches `drizzle/migrations/` per CLAUDE.md §1
> **Plan PR / commit:** TBD (commit message: `plan: SCAFFOLD.2 stratum 3.C — migrations + triggers + system_state seed`)

---

## Tracker context

**Tracker ID:** SCAFFOLD.2 stratum 3.C
**Predecessor:** SCAFFOLD.2 stratum 3.B (PR #25 + #26, merged 2026-05-11, commits `e6a136a` / `304681b`)
**Master plan:** `docs/plans/SCAFFOLD.2.md` §3.C (`Stratum 3.C — Migrations (5 SQL files)`)
**Predecessor log:** `docs/logs/SCAFFOLD.2-3B.md` (carry-forward state)
**Branch:** `feat/scaffold-2-stratum-c`
**Estimate:** 1 session (plan → execute → audit → review → PR)

**Declared dependencies status:**
- 3.B merged: ✓ (21 tables across 10 schema files; INV-2 CHECK on `dharma_ledger.balance_after`; two-independent-transition discipline on `friendly_fire_events`)
- CLAUDE.md §5.10 self-audit + §5.11 subagent invocation now in force (post PR #26)
- ADR-0005 / ADR-0008 / ADR-0009 / ADR-0013 / ADR-0014 / ADR-0016 referenced — **but only `docs/adr/0001-license-choice.md` exists in the repo.** Same drift as 3.B encountered; the binding contracts are CLAUDE.md + AGENTS.md + SPEC.2 (and per SPEC.2 §22 ADR Index, the ADR substance is canonical via SPEC.2 absorptions).
- Drizzle 0.45 + drizzle-kit + postgres driver + Supabase CLI all installed in 3.A; `drizzle.config.ts` carries `tablesFilter: ["!events"]`.
- `drizzle/` directory does **not yet exist** — confirmed `ls -la drizzle/ → No such file or directory`. 3.C creates it.

**Pre-flight (per master plan §3.C):**
- `supabase start` running locally; `.env.local` carries the printed DB URL
- `git branch -vv` shows only `main` (or post-`/clear` `feat/scaffold-2-stratum-c`)

## Approach (one paragraph)

Five SQL migrations applied in absolute order against a fresh Postgres 17 DB: (1) the userspace `public.uuidv7()` PL/pgSQL function so every subsequent `DEFAULT uuidv7()` resolves, (2) the drizzle-kit-generated initial schema for 20 tables (events excluded by `tablesFilter`), (3) the hand-written `events` partitioned table with 12 monthly partitions + DEFAULT + lookup index, (4) the hand-written single trigger file installing 2 shared Bucket-A functions + 4 per-table Bucket-B functions + 26 trigger declarations across all 13 protected tables, (5) the `system_state` singleton seed with `ON CONFLICT (id) DO NOTHING`. Hand-written migrations are minted via `pnpm drizzle-kit generate --custom --name <slug>` so `_meta/_journal.json` stays in sync. SPEC.2 §6.3 paragraph 1 (stale on `friendly_fire_events`) is amended same-commit. The trigger contract is the storage-layer ground truth — handler-layer checks are advisory only per SPEC.2 §6.4.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How 3.C preserves it | Test assertion (3.D scope; 3.C does not write) |
|---|---|---|---|
| INV-1 (atomic bet+comment) | **partial** — schema half landed in 3.B (`bets.comment_id NOT NULL FK`); 3.C reifies the Bucket-A triggers on both `bets` and `comments` that prevent post-insert orphan creation. The SERIALIZABLE transaction wrapping is ENGINE.7's job. | `enforce_bucket_a_no_update` + `enforce_bucket_a_no_delete` on `bets` and `comments` reject any post-insert mutation; the storage-layer trigger forecloses orphaning even if a future bug attempts it. | `tests/db/triggers/bets-append-only.spec.ts` + `tests/db/triggers/comments-append-only.spec.ts` (3.D) |
| INV-2 (no Dharma overdraft) | **yes** — 3.C installs the Bucket-A trigger on `dharma_ledger` that forecloses any UPDATE/DELETE post-insert. Per SPEC.2 §14.1 INV-2 mechanism (iv): "the trigger from (ii) is the ground truth — a bug bypassing the handler check fails at the database layer." 3.B's `CHECK (balance_after >= 0)` is the per-row constraint; 3.C's trigger preserves append-only history. | `enforce_bucket_a_no_update` + `enforce_bucket_a_no_delete` on `dharma_ledger`. | `tests/db/triggers/dharma_ledger-append-only.spec.ts` + `tests/invariants/I-NO-OVERDRAFT-001.dharma-ledger-monotone.spec.ts` (3.D + later) |
| INV-3 (side bound at post time) | **yes** — Bucket-A trigger on `comments` rejects any UPDATE that would mutate `side_at_post_time` (or any other column). SPEC.2 §14.1 INV-3 mechanism (iii): "once written, the side column cannot mutate." | `enforce_bucket_a_no_update` + `enforce_bucket_a_no_delete` on `comments`. | `tests/db/triggers/comments-append-only.spec.ts` + `tests/invariants/I-SIDE-BIND-001.comment-side-frozen.spec.ts` (3.D + later) |
| INV-4 (resolutions append-only) | **yes** — Bucket-A triggers on `resolution_events` + `payout_events` reject UPDATE/DELETE. Corrections land as new rows via `corrects_event_id` self-ref FK (already in 3.B's schema). | `enforce_bucket_a_no_update` + `enforce_bucket_a_no_delete` on both tables. | `tests/db/triggers/resolution_events-append-only.spec.ts` + `payout_events-...` + `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts` (3.D) |

**Critical-path failure mode if 3.C's triggers are missing or wrong:**
- **INV-2:** A future bug in `src/server/bets/transaction.ts` (ENGINE.7) that issues `UPDATE dharma_ledger SET amount = ...` to "correct" a stake would silently corrupt the ledger and pass type-check + Drizzle validation. Without the trigger, INV-2's storage-layer floor disappears; the only defense is the application-layer pre-flight check, which doesn't catch post-commit mutations. Same shape for INV-1, INV-3, INV-4.
- **INV-3:** A handler that "updates a comment's side" to maintain UI consistency (an obvious-looking bug) would land in production; the trigger is the structural floor that catches it at first run. If the trigger is missing, the side-flip is silent corruption.
- **All four:** SPEC.2 §6.5 is the auditability floor — the trigger is bypassable only via `ALTER TABLE ... DISABLE TRIGGER`, a schema change visible in any audit log. Without the trigger installed in 3.C, that auditability collateral does not exist.

---

## 2. Data model changes

**No schema (Drizzle TypeScript) changes.** 3.B's `src/db/schema/*.ts` is the input; 3.C's migrations are the output. The schema files are read-only in 3.C scope.

**5 migration files in absolute order** (numbering allocated by `drizzle-kit generate --custom` or implied by the diff-generation step for 0001):

| # | Path | Source | Reversible? | Why this order |
|---|---|---|---|---|
| 0000 | `drizzle/migrations/0000_uuidv7_function.sql` | hand-written via `pnpm drizzle-kit generate --custom --name uuidv7_function` | down.sql is documentation only per ADR-0008 §6 (and SPEC.2 §6 single-source-of-truth — no production down-migrations) | Every later migration's `DEFAULT uuidv7()` resolves through this function. Must precede `0001`. |
| 0001 | `drizzle/migrations/0001_initial_schema.sql` | drizzle-kit-generated via `pnpm drizzle-kit generate --name initial_schema` | append-only at the file level per ADR-0008 §6 | Creates 20 tables (events excluded by `tablesFilter`), all enums, all FKs, all indexes, the `dharma_ledger CHECK (balance_after >= 0)` from 3.B. |
| 0002 | `drizzle/migrations/0002_events_partitioning.sql` | hand-written via `pnpm drizzle-kit generate --custom --name events_partitioning` | append-only | Creates partitioned `events` table + 12 monthly partitions + DEFAULT + `events_aggregate_idx`. Drizzle 0.45 cannot express `PARTITION BY RANGE`. Must precede 0003 (which installs triggers on `events`). |
| 0003 | `drizzle/migrations/0003_append_only_triggers.sql` | hand-written via `pnpm drizzle-kit generate --custom --name append_only_triggers` | append-only (single source of truth per SPEC.2 §6.1 clause 4) | All 13 protected tables must exist. Installs 2 shared functions + 4 per-table functions + 26 trigger declarations. |
| 0004 | `drizzle/migrations/0004_seed_system_state.sql` | hand-written via `pnpm drizzle-kit generate --custom --name seed_system_state` | non-destructive INSERT with `ON CONFLICT (id) DO NOTHING` (idempotent) | `system_state` table must exist (0001) and its Bucket-B trigger must be installed (0003) before the seed lands. The trigger is on UPDATE, not INSERT, so the seed insert passes through it freely. |

**Cross-file dependency chain:** 0000 → 0001 → 0002 → 0003 → 0004. No other ordering is valid.

### Migration tooling note

`pnpm drizzle-kit generate --custom --name <slug>` is the canonical way to mint hand-written migrations interleaved with diff-generated ones. It allocates the next number, creates an empty `.sql` file, and adds a journal entry to `drizzle/migrations/_meta/_journal.json`. After it runs, the agent edits the empty file with the prescribed SQL body. This keeps drizzle-kit's migration framework consistent.

`pnpm drizzle-kit generate --name initial_schema` (no `--custom`) for 0001 runs the schema-diff against the empty journal and emits a real DDL file. Expected output: 20 `CREATE TABLE`, 9 `CREATE TYPE` (enums), every FK + index + the `CHECK` constraint on `dharma_ledger`, no `CREATE TABLE events` (excluded by `tablesFilter`).

### Same-commit SPEC.2 amendments

Land in the 3.C commit (not deferred to PRECURSOR.5):

| # | Location | Change |
|---|---|---|
| A | `docs/specs/SPEC.2.md` §6.3 paragraph 1 (line ~599) | **Old:** "**`friendly_fire_events.frozen_at` NULL → timestamp** (per ADR-0005). The trigger function rejects any UPDATE where `OLD.frozen_at IS NOT NULL` (re-firing) OR `NEW.frozen_at IS NULL` (un-freezing) OR any non-`frozen_at` column changes between OLD and NEW. Permitted: a single transition from NULL to a non-NULL timestamp on the `frozen_at` column with all other columns unchanged." **New:** "**`friendly_fire_events.frozen_at` + `cleared_at` two independent NULL → timestamp transitions** (per ADR-0005 + 3-B ratification absorbed at §5.1 row 10 + Appendix B.8). The trigger function permits exactly one whitelisted-column transition per UPDATE: either `frozen_at` flipping NULL → non-NULL timestamp (with `cleared_at` unchanged) or `cleared_at` flipping NULL → non-NULL timestamp (with `frozen_at` unchanged). Rejects: both whitelisted columns transitioning in the same UPDATE; either column changing once already non-NULL (one-shot); any non-whitelisted column change. A no-op UPDATE (no column changes) is permitted — the trigger enforces non-mutation, not action. The two columns are independent: `frozen_at` flips at market resolution per §3.6; `cleared_at` flips when the voter clears their vote per F-COMMENT-7." |
| B | `docs/specs/SPEC.2.md` §6.3 `image_uploads` code example (line ~605–627) | **Old (verbatim from spec):** unconditional re-fire `RAISE` when either OLD column is non-NULL, regardless of whether NEW differs. **New:** 3-rule (DISTINCT-FROM) pattern uniform with the other three Bucket B trigger functions. Re-fire detection becomes per-column `OLD IS NOT NULL AND NEW IS DISTINCT FROM OLD`; no-op UPDATEs on terminal rows are permitted. **Rationale (one-line added to §6.3):** "All four Bucket B trigger functions use the 3-rule (DISTINCT-FROM) pattern uniformly per SCAFFOLD.2 stratum 3.C ratification — permit no-op UPDATEs (the trigger enforces non-mutation, not action), reject re-fires on whitelisted columns via DISTINCT-FROM, reject partial transitions on multi-column-atomic Bucket B (image_uploads only), reject any non-whitelisted column change. Asymmetry across Bucket B trigger functions would be a permanent cognitive tax." |

**Verification at write-time (deterministic):**
```bash
# A — friendly_fire_events paragraph 1 replaced
grep -c "single transition from NULL to a non-NULL timestamp on the .frozen_at. column" docs/specs/SPEC.2.md
# Expect: 0 (was 1)
grep -c "two independent NULL → timestamp transitions" docs/specs/SPEC.2.md
# Expect: ≥1 (the new §6.3 amendment)

# B — image_uploads code example replaced
grep -c "image_uploads terminal transition is one-shot" docs/specs/SPEC.2.md
# Expect: 0 (was 1; old unconditional re-fire RAISE removed)
grep -c "terminal_state is one-shot (immutable once set)" docs/specs/SPEC.2.md
# Expect: ≥1 (the new DISTINCT-FROM check)

# A+B sweep — confirm exactly 3 mentions of "NULL → timestamp" remain in §5.1 / §6.3 / §20.2
grep -nE "NULL → timestamp" docs/specs/SPEC.2.md
# Expect exactly 3 hits — §5.1 row 10 (friendly_fire_events whitelisted entry),
# §6.3 (the new friendly_fire_events paragraph), §20.2 (system_state).
# Any other hit is stale; surface as SURPRISE to Hrishikesh.
```

**`system_state.id` text carve-out:** No same-commit amendment needed. SPEC.2 §20.2 already documents the literal-`'system'` sentinel and the no-UUIDv7 reason. The `src/db/schema/system.ts` source comment from 3.B already documents the carve-out. The master plan's "ADR-0016 amendment" instruction is obsolete (the ADR doesn't exist, and the carve-out is already documented in spec).

### 3.B erratum absorbed (same-commit, per session ratification 2026-05-12)

drizzle-kit's CJS module evaluation hits a TDZ error on the first `pnpm drizzle-kit generate` against 3.B's schemas:

```
ReferenceError: Cannot access 'sideEnum' before initialization
    at Object.sideEnum (src/db/schema/bets.ts:1:1)
    at Object.<anonymous> (src/db/schema/comments.ts:53:19)
```

**Root cause.** `bets.ts` imports `comments` (lambda-FK to `comments.id`) and declares `sideEnum` at line 22. `comments.ts` imports `bets, sideEnum` from `./bets` and *eagerly* calls `sideEnum("side_at_post_time")` at line 53 (non-lambda). Barrel `index.ts` re-exports `bets` first → bets.ts pauses at its `import { comments }` line → comments.ts evaluates → reaches `sideEnum(...)` call before bets.ts's line 22 declaration → TDZ. 3.B's `just verify` (tsc + biome + Next.js build) is static and never executes the schema files; drizzle-kit is the first runtime evaluator (which 3.C scope owns).

**Fix.** Extract `sideEnum` to `src/db/schema/_enums.ts` (new file, `sideEnum` only — per session condition (a), other co-located pgEnums stay put unless proven part of a separate cycle). Update `bets.ts` and `comments.ts` to import `sideEnum` from `./_enums` instead of from each other. Add `export * from "./_enums";` to the barrel index for forward consumer compat. Lambda-FK pattern between `bets`↔`comments` preserved (lambdas are lazy; only the eager `sideEnum(...)` call needed breaking).

**Files touched (4):**
- `src/db/schema/_enums.ts` — new (sideEnum declaration + rationale comment)
- `src/db/schema/bets.ts` — remove `pgEnum` from `drizzle-orm/pg-core` import + `sideEnum` declaration; add `import { sideEnum } from "./_enums";`
- `src/db/schema/comments.ts` — split `import { bets, sideEnum } from "./bets"` into separate imports from `./_enums` and `./bets`
- `src/db/schema/index.ts` — add `export * from "./_enums";` as first re-export line

**Why bundled into 3.C, not a separate erratum PR.** One-shot blocker for 3.C's first generate. ~3-line touch across 4 files. Separate-PR round-trip overhead (open PR, merge, rebase 3.C) is not justified per session ratification.

**Verification.** Post-extraction, `pnpm drizzle-kit generate --custom --name uuidv7_function` succeeded — minted the stub and updated `drizzle/migrations/meta/_journal.json` without TDZ error. Cycle broken. Confirmed 2026-05-12.

**Inherited drift list update (PR body):** The 3.B sideEnum TDZ moves from "open drift" to "RESOLVED in 3.C (this PR)" so the PRECURSOR.5 backlog stays clean.

### 3.A drift discovered (NOT fixed in 3.C — flagged for PR body)

`just db-migrate` recipe calls `pnpm drizzle-kit migrate` directly without sourcing `.env.local`. drizzle-kit reports `url: undefined` and fails. Workaround in 3.C session: `set -a && source .env.local && set +a && just db-migrate` (or run `pnpm drizzle-kit migrate` directly after sourcing). Not a 3.C scope item — modifying the justfile would expand the surface beyond migrations + triggers + seed. Flagged in PR body's "Inherited drift" as a separate 3.A erratum awaiting a future fix (likely adding `set dotenv-load := true` with `dotenv-filename := ".env.local"` to the justfile).

### 3.B events PK + partition contradiction absorbed (same-commit, per session ratification 2026-05-12)

SPEC.2 §7 carries a physical-constraint contradiction that surfaces only at apply-time:
- §7.1: `event_id` is `PRIMARY KEY` (single column)
- §7.2: `PARTITION BY RANGE (created_at)`
- §7.3: storage idempotency via `INSERT ... ON CONFLICT (event_id) DO NOTHING`

Postgres requires every UNIQUE/PK constraint on a partitioned table to include the partition column (PG error: *"unique constraint on partitioned table must include all partitioning columns; PRIMARY KEY constraint on table 'events' lacks column 'created_at' which is part of the partition key"*). A single-column PK on `event_id` is incompatible with `PARTITION BY RANGE (created_at)`. This is a PG design rule, not a bug.

**Resolution: composite PK `(event_id, created_at)`.** Standard pattern for time-partitioned event tables. Three changes ship same-commit:

1. **0002 DDL.** `CREATE TABLE events (...)` declares `event_id uuid NOT NULL DEFAULT uuidv7()` (no `PRIMARY KEY` annotation on the column) and adds `PRIMARY KEY (event_id, created_at)` as a table-level constraint at the bottom.
2. **SPEC.2 §7.1 amendment.** `event_id` row's type annotation changes from `uuid PRIMARY KEY` to `uuid NOT NULL (composite PK with created_at per §7.2 partition constraint)`. A trailing paragraph names the partition-constraint rationale and the `insertEvent` deterministic-created_at discipline.
3. **SPEC.2 §7.3 amendment.** "ON CONFLICT (event_id)" becomes "ON CONFLICT (event_id, created_at)"; storage idempotency text reads on the composite pair. A new sentence names the `insertEvent` helper (ENGINE.6) and its responsibility to derive `created_at` deterministically from the UUIDv7 millisecond prefix (first 48 bits, big-endian unix-ms) so retries reuse the same `(event_id, created_at)` pair.
4. **SPEC.2 §3.7 + §5.1 row 1 + §7.7 spec-consistency sweep.** The same `ON CONFLICT (event_id) DO NOTHING` phrase appears in three other locations (§3.7 events-insertion helper paragraph, §5.1 row 1 events-table note, §7.7 sql template). Leaving them single-column while §7.3 reads composite would internally contradict the spec. Three additional one-line replacements bring all SPEC.2 references to the composite form. Verified: `grep -c "ON CONFLICT (event_id) DO NOTHING" docs/specs/SPEC.2.md` returns 0; `grep -c "ON CONFLICT (event_id, created_at) DO NOTHING"` returns 4 (§3.7 + §5.1 + §7.3 + §7.7).

**Downstream ENGINE.6 implication.** `insertEvent(tx, eventInput)` per SPEC.2 §7.7 must compute `created_at` from `event_id`'s UUIDv7 time prefix (not call `now()`, not let DB default fire). Without this, retries with the same `event_id` would land different `created_at` values and bypass the composite PK dedupe.

**`src/db/schema/events.ts` declaration unchanged.** Still declares `eventId: uuid("event_id").primaryKey()` at the type-inference layer. This is a cosmetic mismatch with the DDL's composite PK — drizzle-zod infers `event_id` as THE PK. Runtime correctness is unaffected (reads still work; the only place this matters is `insertEvent`'s `ON CONFLICT` clause, which ENGINE.6 writes as raw SQL per SPEC.2 §7.7). 3.B-erratum to align the schema declaration is deferred per §5.4 surgical scope; not blocking 3.C. The plan's PR body names this as inherited drift for PRECURSOR.5.

**ADR-0005 §5 amendment NOT shipped.** ADR-0005 file does not exist on disk (it's a ghost reference, same drift 3.B encountered). The SPEC.2 §7.1 + §7.3 amendments absorb what an ADR-0005 §5 ratification would have said. PR body's "Spec drift absorbed" section flags this.

**Verification (deterministic):**
```bash
# 0002 DDL has composite PK and no single-column event_id PRIMARY KEY
grep -nE "PRIMARY KEY \(event_id, created_at\)" drizzle/migrations/0002_events_partitioning.sql
# Expect: 1 hit (the composite PK declaration)

grep -nE "event_id uuid PRIMARY KEY" drizzle/migrations/0002_events_partitioning.sql
# Expect: 0 hits (the single-column PK is gone)

# SPEC.2 §7.1 + §7.3 amendments land
grep -c "composite PK with .created_at." docs/specs/SPEC.2.md
# Expect: ≥1 (the §7.1 row + paragraph mention this)

grep -c "ON CONFLICT (event_id, created_at)" docs/specs/SPEC.2.md
# Expect: ≥1 (the §7.3 amendment)

grep -c "ON CONFLICT (event_id) DO NOTHING" docs/specs/SPEC.2.md
# Expect: 0 (old single-column ON CONFLICT removed)

# Apply-time verification (post db-reset + db-migrate up through 0002)
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_inherits WHERE inhparent = 'events'::regclass;"
# Expect: 13 (12 monthly + 1 default — confirms 0002 applied cleanly with composite PK)
```

### 3.A drift absorbed (same-commit, per session ratification 2026-05-12)

`tablesFilter: ["!events"]` in `drizzle.config.ts` does **not** exclude `events` from `drizzle-kit generate`. Per Drizzle docs at orm.drizzle.team/kit-docs/config-reference, `tablesFilter` is listed under the `db push` command surface — it filters introspection (`pull`) and push behavior, but `generate` reads exported tables from the schema TS files and emits DDL for all of them regardless. 3.A's drizzle.config.ts comment + master plan + predecessor log line 148 all asserted `tablesFilter` would exclude `events` from generate output. That assertion is incorrect.

**Observation.** `pnpm drizzle-kit generate --name initial_schema` emitted 21 `CREATE TABLE` statements including a regular (non-partitioned) `CREATE TABLE "events" (...)` block plus its `CREATE INDEX events_aggregate_idx`. Leaving them in would have caused 0002's `CREATE TABLE events ... PARTITION BY RANGE (created_at)` to fail with "relation already exists" (you cannot retrofit partitioning via `ALTER TABLE`).

**Fix (hand-edit, per session ratification 2026-05-12).** Two targeted Edits to `drizzle/migrations/0001_initial_schema.sql`:
1. Delete the entire `CREATE TABLE "events" (...)` block (lines 160–169 of the generated file) plus its trailing `--> statement-breakpoint` (line 170) — 11 lines.
2. Delete the `CREATE INDEX "events_aggregate_idx" ON "events" ...` line (line 308 of the generated file) — 1 line.

Total surgery: ~12 lines removed. No FK constraints reference `events` (it has no FKs in the schema, verified by `grep`), so the surgery is clean with no ripple effects.

**Post-surgery verification (deterministic):**
- `grep -c "^CREATE TABLE" drizzle/migrations/0001_initial_schema.sql` → **20** (was 21)
- `grep -ic "events_aggregate" drizzle/migrations/0001_initial_schema.sql` → **0**
- `grep -c "friendly_fire_events" drizzle/migrations/0001_initial_schema.sql` → **6** (table def + FK constraints + indexes; sanity check that we deleted only the bare `events` table, NOT `friendly_fire_events`)

**Why hand-edit and not regenerate.** drizzle-kit-generated files aren't normally hand-edited, but 0001 is *emitted once at the start*. Subsequent `drizzle-kit generate` invocations produce diffs against the journal snapshot, not re-emits — so the hand-edit isn't fragile across the project lifecycle. The events table remains in `src/db/schema/events.ts` (for type inference + drizzle-zod schemas), but its DDL ships exclusively in 0002.

**Why not fix `tablesFilter` in drizzle.config.ts.** Per §5.4 surgical scope, modifying drizzle.config.ts is 3.A territory. The functional outcome (events excluded from 0001) is achieved by the hand-edit. The cosmetic concern (the `tablesFilter` line in drizzle.config.ts implies an effect it doesn't have) is flagged for PRECURSOR.5 as RESOLVED with note: "tablesFilter is a no-op for drizzle-kit generate; consider removing it from drizzle.config.ts (no functional impact, but the comment in drizzle.config.ts implies an effect it doesn't have)."

**Inherited drift list update (PR body):** The 3.A tablesFilter no-op moves from "open drift" to "RESOLVED in 3.C (this PR) via hand-edit; backlog item flagged for cosmetic cleanup."

## 3. API surface

**None — schema/DDL stratum only.** 3.C ships zero TypeScript handler code. The events insert helper at `src/server/events/insert.ts`, the bet transaction wrapper at `src/server/bets/transaction.ts`, the moderation helper, and every Server Action / Route Handler are explicitly out-of-scope (ENGINE.6, ENGINE.7+, etc.).

## 4. UI / user flow

**None — backend-only (DB-only, really).**

## 5. Failure modes

| Failure mode | Detection | Recovery |
|---|---|---|
| **`pnpm drizzle-kit migrate` errors partway through** (e.g., 0003 fails due to a trigger SQL syntax error) | `just db-migrate` exits non-zero; psql `\dt` shows partial table set; `_journal.json` records applied migrations only. | Fix the failing migration's SQL in-source. Run `just db-reset` (`supabase db reset` — destroys local DB) then `just db-migrate` re-applies the chain. Down migrations are not used per ADR-0008 §6. |
| **drizzle-kit-generated 0001_initial_schema.sql contains drift** (e.g., a schema-file column changed since 3.B and the diff picks it up unexpectedly) | The drizzle-kit output diff against an empty journal should exactly reify 3.B's schema. Grep checks in the verification block catch divergence (FK count, CREATE TABLE count, uuidv7 default count). | If divergence, the schema file changed since 3.B's PR — bisect via `git log src/db/schema/` and surface to Hrishikesh. Do not "fix" by editing the schema in 3.C; raise an erratum PR if needed. |
| **`uuidv7()` function body is wrong** (e.g., a typo in the kjmph gist transcription) | Migration 0001 fails when first INSERT tries to resolve `DEFAULT uuidv7()`. Or worse, succeeds but emits non-monotonic UUIDs. | Run `SELECT uuidv7();` after 0000 applies; verify shape (`xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx` with version=7, variant=10). Run `SELECT uuidv7() FROM generate_series(1, 100) ORDER BY 1;` and verify monotonic ordering within a single backend (per ADR-0016 monotonicity caveat: per-backend only, not pool-wide). |
| **Triggers don't propagate to `events` partitions** (Postgres 11+ should propagate, but worth testing) | Verification query `SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid::regclass::text = 'events_2026_05'` should show inherited triggers. If 0, propagation broke. | Postgres 17 propagates parent triggers to child partitions automatically — no manual per-partition trigger declaration needed. If verification shows zero on a partition, surface to Hrishikesh; possible Postgres version mismatch. |
| **`system_state` seed runs before its trigger is installed (wrong ordering)** | Migration order 0001 → 0003 → 0004 should land seed *after* trigger. The seed is an INSERT; the trigger is BEFORE UPDATE / BEFORE DELETE — so the seed's INSERT never fires the trigger regardless of order. No actual hazard. | n/a — INSERT doesn't fire BEFORE UPDATE or BEFORE DELETE. The trigger applies to subsequent attempts (e.g., the conclusion-event UPDATE at 2026-11-05 23:59 UTC). |
| **Migration partially applied to a non-local DB** (staging, production) | Out of scope — 3.C only targets local Supabase via `supabase db reset` + `drizzle-kit migrate`. Staging/production paths are SCAFFOLD.13 territory. | n/a in 3.C. |
| **Re-running `just db-migrate` against a fully-applied DB** | drizzle-kit's `_journal.json` tracks applied migrations; re-run is a no-op. `0004_seed_system_state.sql` carries `ON CONFLICT (id) DO NOTHING` so even if it does re-run, no error. | None needed. |

## 6. Edge cases

The trigger SQL is the primary risk surface. Each Bucket B trigger function's exact column enumeration is the fragility (a future column addition silently breaks the "non-whitelisted columns unchanged" check). 3.C accepts this fragility because SPEC.2 §6.3's example uses enumeration; alternatives (row-as-jsonb comparison) would be cleverer but harder to read and harder to audit.

| Edge case | Behavior |
|---|---|
| `UPDATE events SET payload = '{}' WHERE event_id = ...` | BEFORE UPDATE trigger fires; `RAISE EXCEPTION 'append-only violation on table public.events: UPDATE not permitted'`; SQLSTATE P0001 propagates through Drizzle. |
| `DELETE FROM dharma_ledger WHERE id = ...` | BEFORE DELETE trigger fires; `RAISE EXCEPTION 'append-only violation on table public.dharma_ledger: DELETE not permitted'`. |
| `UPDATE friendly_fire_events SET frozen_at = NOW() WHERE id = ...` (single transition) | Permitted: `cleared_at` unchanged, no non-whitelisted columns changed, `frozen_at` going NULL → non-NULL. Trigger function returns NEW; UPDATE commits. |
| `UPDATE friendly_fire_events SET frozen_at = NOW(), cleared_at = NOW() WHERE id = ...` (both transitioning) | Rejected: `RAISE EXCEPTION 'friendly_fire_events: frozen_at and cleared_at cannot both transition in the same UPDATE'`. |
| `UPDATE friendly_fire_events SET direction = 'down' WHERE id = ...` (non-whitelisted column change) | Rejected: `RAISE EXCEPTION 'friendly_fire_events: only frozen_at or cleared_at may transition'`. |
| `UPDATE friendly_fire_events SET frozen_at = NEW_TS WHERE frozen_at IS NOT NULL` (re-fire) | Rejected: `RAISE EXCEPTION 'friendly_fire_events: frozen_at is one-shot'`. |
| `UPDATE friendly_fire_events SET direction = direction WHERE id = ...` (no-op; permitted by Q1 answer) | Permitted: no whitelisted transition, no non-whitelisted column change, no re-fire. Trigger returns NEW. Wasted I/O but not a contract violation. |
| `UPDATE image_uploads SET terminal_state = 'committed' WHERE id = ...` (partial; terminal_at omitted) | Rejected: `RAISE EXCEPTION 'image_uploads: terminal_state and terminal_at must transition together'` (XOR check fails). |
| `UPDATE image_uploads SET terminal_state = 'committed', terminal_at = NOW() WHERE id = ...` (atomic both, in-flight row) | Permitted: both transitioning together, OLD had both NULL, no non-whitelisted change. |
| `UPDATE image_uploads SET r2_object_key = r2_object_key WHERE id = ...` (no-op on terminal row; both whitelisted already set, NEW = OLD on all columns) | Permitted under 3-rule (per session ratification): no whitelisted re-fire (DISTINCT-FROM check passes vacuously), XOR check passes (both NEW non-NULL), no non-whitelisted change. Was rejected under spec-verbatim formulation; 3-rule alignment + same-commit SPEC.2 §6.3 amendment B make this consistent across all 4 Bucket B tables. |
| `UPDATE image_uploads SET terminal_state = 'blocked' WHERE id = '<terminal row already committed>'` (re-fire attempt) | Rejected: `RAISE EXCEPTION 'image_uploads: terminal_state is one-shot (immutable once set)'` (DISTINCT-FROM detects the value change). |
| `UPDATE system_state SET frozen_at = '2026-11-05 23:59 UTC' WHERE id = 'system'` (the conclusion freeze) | Permitted: `frozen_at` NULL → timestamp, `id` + `created_at` unchanged. |
| `UPDATE system_state SET frozen_at = NULL WHERE id = 'system' AND frozen_at IS NOT NULL` (thaw) | Rejected: `RAISE EXCEPTION 'system_state: frozen_at is one-shot'`. Recovery via BREAK_GLASS.md only per SPEC.2 §20.3. |
| `INSERT INTO events (event_id, ...) VALUES (X, ...); INSERT INTO events (event_id, ...) VALUES (X, ...) ON CONFLICT (event_id) DO NOTHING;` | Storage-layer idempotency: second insert is a no-op (per SPEC.2 §7.3). The Bucket-A trigger fires on UPDATE, not INSERT — the ON CONFLICT clause prevents the second INSERT from becoming an UPDATE, so the trigger never sees it. |
| `INSERT INTO system_state (id, frozen_at) VALUES ('system', NULL) ON CONFLICT (id) DO NOTHING;` re-applied | No-op on re-apply (per Q2 answer). |
| **TRUNCATE on a Bucket-A table** (e.g., `TRUNCATE dharma_ledger`) | Out of scope — TRUNCATE does not fire row-level BEFORE DELETE triggers. SPEC.2 §6.5 acknowledges this: bypassing the contract requires audit-visible DDL (`DISABLE TRIGGER`, `TRUNCATE`, etc.). Not 3.C's defense. |
| **An UPDATE that crosses partitions on `events`** (would mean `created_at` changed) | Cannot happen — the BEFORE UPDATE trigger rejects every UPDATE, so `created_at` cannot change. The partition-routing case is moot. |
| **Migration 0001 trying to `CREATE TABLE events`** (drizzle-kit forgot the tablesFilter) | Verification query `grep -c "CREATE TABLE.*events" 0001_initial_schema.sql` should return 0 (or only matches like `friendly_fire_events`). If matches `events ` (with the exact bare name), the `tablesFilter` config is broken — surface and fix 3.A erratum. |
| **`drizzle-kit generate` emits unexpected destructive operations** (e.g., DROP TABLE in 0001) | This should not happen on the first generate against an empty journal; if it does, something's wrong with the schema state. Verification: `grep -c "DROP " 0001_initial_schema.sql` expects 0 (or only `DROP TYPE` if drizzle-kit emits one for an unused enum redefinition — unlikely on first gen). |

## 7. Test plan

3.C does **not** write Vitest test files. Per master plan §3.C "Tests in 3.D." Per CLAUDE.md §5.6, business-logic tests-first is required but 3.C is DDL/migrations, exempt by §5.6's "type-only declarations and configuration changes are exempt" reading. Trigger tests + INV-4 canonical land in 3.D's `tests/db/triggers/<table>-append-only.spec.ts` × 13 + `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts`.

### Verification (psql-driven, per master plan §3.C verification block)

Run after `just db-reset && just db-migrate`:

```bash
# 1. uuidv7() function exists and produces version-7 UUIDs (single-call check)
psql "$DATABASE_URL" -c "SELECT uuidv7();" | grep -E "[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}"
# Expect: one match

# 1b. Empirical version-nibble check across 1000 generations (catches bit-flips)
# Run this BEFORE writing 0001 (Phase 2 pre-flight hard gate per self-critique #18)
psql "$DATABASE_URL" -c "
  SELECT count(*) FROM (
    SELECT substring(uuidv7()::text, 15, 1) AS v
    FROM generate_series(1, 1000)
  ) t WHERE v != '7';"
# Expect: 0
# Any non-zero count means the function emits non-version-7 UUIDs; halt and fix 0000.

# 2. 21 base tables exist (system_state has text PK; others uuid PK)
psql "$DATABASE_URL" -c "
  SELECT count(*) FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
  AND table_name NOT LIKE 'events_%';"
# Expect: 21
# (events_2026_05 .. events_2027_04 + events_default = 13 partition tables, separate count)

# 3. events partitioning: 13 partitions inherit from events parent
psql "$DATABASE_URL" -c "
  SELECT count(*) FROM pg_inherits WHERE inhparent = 'events'::regclass;"
# Expect: 13 (12 monthly + 1 default)

# 4. 26 triggers on the 13 protected parent tables (excludes inherited child triggers)
psql "$DATABASE_URL" -c "
  SELECT count(*) FROM pg_trigger
  WHERE NOT tgisinternal
  AND tgrelid::regclass::text IN (
    'events', 'dharma_ledger', 'bets', 'comments', 'resolution_events',
    'payout_events', 'mod_actions', 'admin_events', 'user_events',
    'friendly_fire_events', 'identity_pool', 'image_uploads', 'system_state');"
# Expect: 26

# 5. 6 trigger functions exist
psql "$DATABASE_URL" -c "
  SELECT proname FROM pg_proc
  WHERE proname IN (
    'enforce_bucket_a_no_update',
    'enforce_bucket_a_no_delete',
    'enforce_friendly_fire_events_transitions',
    'enforce_identity_pool_assigned_at',
    'enforce_image_uploads_terminal_atomic',
    'enforce_system_state_frozen_at')
  ORDER BY proname;"
# Expect: 6 rows

# 6. system_state seed row present
psql "$DATABASE_URL" -c "SELECT id, frozen_at FROM system_state;"
# Expect: id='system', frozen_at=NULL

# 7. INV-2 storage-layer CHECK present (carried from 3.B; verifies 0001 generated it)
psql "$DATABASE_URL" -c "
  SELECT count(*) FROM pg_constraint
  WHERE conname = 'dharma_ledger_balance_non_negative'
  AND contype = 'c';"
# Expect: 1

# 8. Smoke test the Bucket-A trigger on dharma_ledger (manual)
#    First insert a row (requires a users row; skip if too involved manually).
#    Or simpler: try DELETE on the empty table — should still fire.
psql "$DATABASE_URL" -c "DELETE FROM dharma_ledger WHERE FALSE;" 2>&1 | head -1
# Empty result is fine (no rows matched); trigger does not fire because BEFORE DELETE
# is FOR EACH ROW. Better smoke test: attempt an UPDATE with no rows.
psql "$DATABASE_URL" -c "UPDATE dharma_ledger SET amount = 0 WHERE FALSE;"
# Empty result (no rows updated). The trigger is row-level; with 0 rows, no fire.
# Full smoke tests land in 3.D's vitest suites.

# 9. just verify (DB-free, always-runnable per AGENTS.md §2)
just verify
# Expect: typecheck + biome + build all green
```

### Pre-PR self-audit (per CLAUDE.md §5.10)

The execute session walks this inventory and reports PASS / FAIL / SURPRISE per item before invoking `@db-migration-reviewer`:

- **Per migration file:** exists at the expected path; numerical ordering correct; SQL syntactically valid; comment header naming the ADR / SPEC source.
- **0000:** AGPL header comment; `LANGUAGE sql`; `VOLATILE`; uses `clock_timestamp()`; pure-SQL body; empirical version-nibble check (1000 generations) returns 0.
- **0001:** 20 `CREATE TABLE` (no events); 9 `CREATE TYPE` (one per pgEnum); FK count ≥ 30 (every cross-table FK declared); `CHECK (balance_after >= 0)` present on dharma_ledger.
- **0002:** `CREATE TABLE events (...) PARTITION BY RANGE (created_at)`; 12 `CREATE TABLE events_2026_NN PARTITION OF events ...` (May 2026 through April 2027); `CREATE TABLE events_default PARTITION OF events DEFAULT`; `CREATE INDEX events_aggregate_idx`. Column names match 3.B's `src/db/schema/events.ts` (`event_id` PK; `event_type`, `aggregate_type`, `aggregate_id`, `payload`, `payload_version`, `metadata`, `created_at`).
- **0003:** 2 Bucket-A functions; 4 Bucket-B functions; 18 Bucket-A trigger declarations (9 tables × 2); 8 Bucket-B trigger declarations (4 tables × 2); total 6 functions + 26 triggers.
- **0003 all four Bucket B functions:** uniform 3-rule (DISTINCT-FROM) pattern; permit no-op UPDATEs; reject re-fires via per-column `OLD IS NOT NULL AND NEW IS DISTINCT FROM OLD`; reject non-whitelisted column changes via per-column `IS DISTINCT FROM` enumeration.
- **0003 friendly_fire_events function:** additionally rejects both columns transitioning together; permits each single-column transition alone.
- **0003 image_uploads function:** additionally rejects partial transitions via `(NEW.terminal_state IS NULL) <> (NEW.terminal_at IS NULL)` XOR.
- **0003 identity_pool function:** single whitelisted column (`assigned_at`); standard 3-rule.
- **0003 system_state function:** single whitelisted column (`frozen_at`); standard 3-rule; error message names BREAK_GLASS path per SPEC.2 §20.3.
- **0004:** `INSERT INTO system_state (id, frozen_at) VALUES ('system', NULL) ON CONFLICT (id) DO NOTHING;`.
- **Same-commit SPEC.2 amendments (both A and B):** §6.3 paragraph 1 friendly_fire_events text updated AND §6.3 image_uploads code example replaced with 3-rule pattern; all three grep verifications pass deterministically (A old-text 0 hits; A new-text ≥1 hit; B old-text 0 hits; B new-text ≥1 hit; sweep returns exactly 3 hits at §5.1 row 10 + §6.3 + §20.2).
- **drizzle-kit journal staging:** `git diff --stat HEAD` includes `drizzle/migrations/_meta/_journal.json` alongside the 5 `.sql` files. The journal is drizzle-kit's authoritative apply-order metadata; if it's missing from the staged diff, the next migration generation will allocate the wrong number and the journal will be silently one entry behind. **Verification:** `git diff --stat HEAD -- drizzle/migrations/_meta/` shows the journal as modified; if absent, `git add drizzle/migrations/_meta/_journal.json` and re-commit.

### Subagent invocation (per CLAUDE.md §5.11)

After self-audit reports clean and before `gh pr create`:

```
@db-migration-reviewer

Plan: @docs/plans/SCAFFOLD.2-3C.md

Review 0000_uuidv7_function.sql, 0001_initial_schema.sql, 0002_events_partitioning.sql, 0003_append_only_triggers.sql, 0004_seed_system_state.sql for:
- Trigger SQL matches SPEC.2 §6.2 + §6.3 contract (post-amendment B; image_uploads uses 3-rule DISTINCT-FROM pattern uniform with the other three Bucket B functions)
- Partition DDL matches SPEC.2 §7.2 (12 monthly + DEFAULT)
- Hand-written SQL doesn't drift from 3.B schemas
- Same-commit SPEC.2 §6.3 amendments A (friendly_fire_events para) AND B (image_uploads code example) are in place
- ON CONFLICT (id) DO NOTHING on 0004
- drizzle/migrations/_meta/_journal.json staged alongside the 5 .sql files
- **Per-Bucket-B-function column-enumeration check (silent corruption surface):**
  Verify each Bucket B trigger function's column enumeration matches the
  corresponding Drizzle schema in src/db/schema/*.ts exactly. List any column
  in schema not in trigger (silent pass-through hazard — a non-whitelisted
  column change would slip past the trigger), or any column in trigger not
  in schema (dead code referencing a non-existent column — function will
  fail at first UPDATE attempt). Reference schemas:
    - friendly_fire_events: src/db/schema/comments.ts (id, voter_id, comment_id, direction, cleared_at, frozen_at, created_at)
    - identity_pool: src/db/schema/identity.ts (id, colour, animal, number, pseudonym, pfp_filename, assigned_at, created_at)
    - image_uploads: src/db/schema/image-uploads.ts (id, user_id, r2_object_key, terminal_state, terminal_at, created_at)
    - system_state: src/db/schema/system.ts (id, frozen_at, created_at)
  Drift here is the silent corruption surface — Bucket B's whitelist is
  fragile because it enumerates by construction; this check is the
  enumeration's only ground-truth verification before runtime.
```

Plan path is passed per §5.11's "must pass plan context" rule.

## 8. Out of scope

Explicit refusal-grade items (3.C does NOT do):

- **Vitest test files.** `tests/db/triggers/*-append-only.spec.ts` × 13 + `tests/invariants/I-APPEND-ONLY-001.*.spec.ts` are 3.D scope.
- **Application-layer code.** `src/server/bets/transaction.ts` (ENGINE.7), `src/server/events/insert.ts` + `schemas.ts` (ENGINE.6), `src/server/moderation/precommit.ts`, any Server Action or Route Handler.
- **Supabase RLS policies.** `supabase/migrations/` policy files. Deferred to a later stratum (HARDEN.* per SPEC.2 §21).
- **Identity-pool data load.** 50,000 (colour, animal, number) tuples — SCAFFOLD.17.
- **`pg_cron` Path-A scheduled freeze job.** `drizzle/migrations/<NNNN>_freeze_cron.sql` per SPEC.2 §20.2 — HARDEN.10.
- **BREAK_GLASS.md runbook.** Per SPEC.2 §6.5 + §20.3 — HARDEN.10.
- **Additional CHECK constraints beyond `dharma_ledger.balance_after >= 0`.** That CHECK landed in 3.B and 0001 will reify it. Other CHECKs (e.g., `markets.status` enum coverage, `bets.stake > 0`) deferred to HARDEN.*.
- **Sentry alarm wiring for default-partition writes** (SPEC.2 §7.2 + §17 alarm 2). 3.C creates the DEFAULT partition; the alarm is observability infrastructure — SCAFFOLD.5+.
- **`isFrozen()` middleware** at `src/server/system/is-frozen.ts` per SPEC.2 §20.2. ENGINE.* territory.
- **Markets data seed.** No market rows minted in 3.C. The `markets` table exists but is empty until the first F-ADMIN-1 create-market action.
- **Trigger-emit Sentry alarm 1 wiring** (SPEC.2 §6.7). Observability — HARDEN.*.
- **ADR file creation/amendment.** Master plan §3.C calls for "ADR-0009 + ADR-0016 amendments." Reality: `docs/adr/` contains only `0001-license-choice.md`; ADRs 0003–0016 are ghost references throughout CLAUDE.md/SPECs/plan. 3.C does not mint ADRs (per §5.4 surgical-scope discipline) and does not amend non-existent files. Same drift 3.B encountered; carried forward to PRECURSOR.5 backlog if not addressed sooner.
- **PRECURSOR.5 drift items inherited from 3.B's log.** SPEC.2 B.1 users column gap, B.2 markets.status, B.15 identity_pool.number, B.7 bet_settle/bet_payout, pnpm workspace line in AGENTS.md, missing `block-main-commits.sh`. All flagged in PR body; none addressed in 3.C.

---

## Open questions

None at plan time. The three open questions surfaced in the kickoff interview (no-op semantics on Bucket B; ON CONFLICT on seed; §6.3 amendment same-commit) are settled:

- Q1: Permit no-op UPDATEs (3-rule formulation)
- Q2: ON CONFLICT (id) DO NOTHING on 0004
- Q3: SPEC.2 §6.3 paragraph 1 amended in 3.C commit

## ADRs needed

**None.** 3.C does not introduce any architectural decision not already covered by the (referenced-but-missing) ADRs. The migration approach is locked by SPEC.2 §6, §7, §20 + ADR-0008 substance absorbed into AGENTS.md §6.

---

## Trigger SQL inventory (Phase 2 reference)

This is the per-table contract Phase 2 will reify in `0003_append_only_triggers.sql`. The audit walks this verbatim.

### Bucket A — 9 tables × 2 triggers = 18 declarations

Two shared functions (per SPEC.2 §6.2):

```sql
CREATE OR REPLACE FUNCTION enforce_bucket_a_no_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'append-only violation on table %.%: UPDATE not permitted',
    TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_bucket_a_no_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'append-only violation on table %.%: DELETE not permitted',
    TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
```

Applied to: `events`, `dharma_ledger`, `bets`, `comments`, `resolution_events`, `payout_events`, `mod_actions`, `admin_events`, `user_events` — `BEFORE UPDATE` and `BEFORE DELETE`, `FOR EACH ROW EXECUTE FUNCTION ...`. For partitioned `events`, Postgres 11+ propagates parent triggers to child partitions automatically (verified in postgres-17 docs §13.3.2 + CREATE TRIGGER docs).

### Bucket B — 4 tables × 2 triggers = 8 declarations

**`friendly_fire_events`** (two independent whitelisted transitions; columns: id, voter_id, comment_id, direction, cleared_at, frozen_at, created_at):

```sql
CREATE OR REPLACE FUNCTION enforce_friendly_fire_events_transitions()
RETURNS TRIGGER AS $$
BEGIN
  -- Reject both whitelisted columns transitioning in the same UPDATE
  IF OLD.frozen_at IS NULL AND NEW.frozen_at IS NOT NULL
     AND OLD.cleared_at IS NULL AND NEW.cleared_at IS NOT NULL THEN
    RAISE EXCEPTION 'friendly_fire_events: frozen_at and cleared_at cannot both transition in the same UPDATE';
  END IF;

  -- Reject any change to frozen_at once it is non-NULL (one-shot)
  IF OLD.frozen_at IS NOT NULL AND NEW.frozen_at IS DISTINCT FROM OLD.frozen_at THEN
    RAISE EXCEPTION 'friendly_fire_events: frozen_at is one-shot (timestamp is immutable once set)';
  END IF;

  -- Reject any change to cleared_at once it is non-NULL (one-shot)
  IF OLD.cleared_at IS NOT NULL AND NEW.cleared_at IS DISTINCT FROM OLD.cleared_at THEN
    RAISE EXCEPTION 'friendly_fire_events: cleared_at is one-shot (timestamp is immutable once set)';
  END IF;

  -- Reject any non-whitelisted column change
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.voter_id IS DISTINCT FROM OLD.voter_id
     OR NEW.comment_id IS DISTINCT FROM OLD.comment_id
     OR NEW.direction IS DISTINCT FROM OLD.direction
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'friendly_fire_events: only frozen_at or cleared_at may transition';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**`identity_pool`** (assigned_at NULL → timestamp once; columns: id, colour, animal, number, pseudonym, pfp_filename, assigned_at, created_at):

```sql
CREATE OR REPLACE FUNCTION enforce_identity_pool_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
  -- One-shot on assigned_at
  IF OLD.assigned_at IS NOT NULL AND NEW.assigned_at IS DISTINCT FROM OLD.assigned_at THEN
    RAISE EXCEPTION 'identity_pool: assigned_at is one-shot (timestamp is immutable once set)';
  END IF;

  -- Reject any non-whitelisted column change
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.colour IS DISTINCT FROM OLD.colour
     OR NEW.animal IS DISTINCT FROM OLD.animal
     OR NEW.number IS DISTINCT FROM OLD.number
     OR NEW.pseudonym IS DISTINCT FROM OLD.pseudonym
     OR NEW.pfp_filename IS DISTINCT FROM OLD.pfp_filename
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'identity_pool: only assigned_at may transition';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**`image_uploads`** (terminal_state + terminal_at two-column atomic; columns: id, user_id, r2_object_key, terminal_state, terminal_at, created_at). Function body uses the 3-rule (DISTINCT-FROM) pattern uniform with the other three Bucket B functions per session ratification — SPEC.2 §6.3's example is amended same-commit to match:

```sql
CREATE OR REPLACE FUNCTION enforce_image_uploads_terminal_atomic()
RETURNS TRIGGER AS $$
BEGIN
  -- One-shot on terminal_state (immutable once set; permits no-op on terminal rows)
  IF OLD.terminal_state IS NOT NULL AND NEW.terminal_state IS DISTINCT FROM OLD.terminal_state THEN
    RAISE EXCEPTION 'image_uploads: terminal_state is one-shot (immutable once set)';
  END IF;

  -- One-shot on terminal_at (immutable once set; permits no-op on terminal rows)
  IF OLD.terminal_at IS NOT NULL AND NEW.terminal_at IS DISTINCT FROM OLD.terminal_at THEN
    RAISE EXCEPTION 'image_uploads: terminal_at is one-shot (immutable once set)';
  END IF;

  -- Reject partial transition (XOR; one column NULL while other set)
  IF (NEW.terminal_state IS NULL) <> (NEW.terminal_at IS NULL) THEN
    RAISE EXCEPTION 'image_uploads: terminal_state and terminal_at must transition together';
  END IF;

  -- Reject any non-whitelisted column change
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.r2_object_key IS DISTINCT FROM OLD.r2_object_key
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'image_uploads: only terminal_state + terminal_at may transition together';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Permitted by 3-rule (uniform across all 4 Bucket B tables):** no-op UPDATEs on in-flight rows (both NULL) AND no-op UPDATEs on terminal rows (both set). **Rejected:** changing either terminal column once set; partial transitions; non-whitelisted column changes.

**`system_state`** (frozen_at NULL → timestamp once; columns: id, frozen_at, created_at):

```sql
CREATE OR REPLACE FUNCTION enforce_system_state_frozen_at()
RETURNS TRIGGER AS $$
BEGIN
  -- One-shot on frozen_at; thaw via BREAK_GLASS.md only (per SPEC.2 §20.3)
  IF OLD.frozen_at IS NOT NULL AND NEW.frozen_at IS DISTINCT FROM OLD.frozen_at THEN
    RAISE EXCEPTION 'system_state: frozen_at is one-shot (conclusion freeze is permanent; thaw via BREAK_GLASS.md)';
  END IF;

  -- Reject any non-whitelisted column change
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'system_state: only frozen_at may transition';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Each Bucket B table additionally gets a `BEFORE DELETE` trigger calling `enforce_bucket_a_no_delete()` (reusing the shared function — DELETE is universally forbidden on Bucket B too per SPEC.2 §6.1 clause 2).

### Migration file 0003 final structure

1. Two shared Bucket-A functions (`enforce_bucket_a_no_update`, `enforce_bucket_a_no_delete`)
2. Four per-table Bucket-B functions (as above)
3. 18 Bucket-A trigger declarations (9 tables × `BEFORE UPDATE` + `BEFORE DELETE`)
4. 8 Bucket-B trigger declarations (4 tables × `BEFORE UPDATE` calling per-table function + `BEFORE DELETE` calling `enforce_bucket_a_no_delete`)
5. Header comment naming SPEC.2 §6.2 + §6.3 + ADR-0005 (referenced, not file-resolvable)

Total: 6 functions + 26 trigger declarations.

---

## Partition DDL inventory (Phase 2 reference)

Per SPEC.2 §7.2. Migration 0002 contains:

```sql
-- events — canonical audit ledger per SPEC.2 §7 + ADR-0005 §5
-- Hand-written because Drizzle 0.45 cannot express PARTITION BY RANGE.
-- Type inference is provided by src/db/schema/events.ts via drizzle-zod;
-- this DDL is the storage-layer truth. tablesFilter: ["!events"] in
-- drizzle.config.ts excludes events from 0001's diff-generated DDL.

CREATE TABLE events (
  event_id uuid PRIMARY KEY DEFAULT uuidv7(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  payload_version smallint NOT NULL,
  metadata jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- 12 monthly partitions: experiment window + tail per SPEC.2 §7.2
CREATE TABLE events_2026_05 PARTITION OF events FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE events_2026_06 PARTITION OF events FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE events_2026_07 PARTITION OF events FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE events_2026_08 PARTITION OF events FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE events_2026_09 PARTITION OF events FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE events_2026_10 PARTITION OF events FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE events_2026_11 PARTITION OF events FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE events_2026_12 PARTITION OF events FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE events_2027_01 PARTITION OF events FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE events_2027_02 PARTITION OF events FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE events_2027_03 PARTITION OF events FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');
CREATE TABLE events_2027_04 PARTITION OF events FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');

-- DEFAULT partition catches out-of-range writes per SPEC.2 §7.2.
-- Sentry alarm 2 (§17 alarm 2) fires on any insert here; alarm wiring is HARDEN.*.
CREATE TABLE events_default PARTITION OF events DEFAULT;

-- Per-aggregate event-stream lookup index per ADR-0005 §5 / SPEC.2 §7.1.
-- Declared in src/db/schema/events.ts type-only; actual CREATE INDEX ships here.
CREATE INDEX events_aggregate_idx ON events (aggregate_type, aggregate_id, created_at);
```

Note on indexes: when an index is declared on a partitioned table, Postgres 11+ auto-creates matching indexes on every existing and future partition. So this single `CREATE INDEX` covers all 13 partitions.

---

## uuidv7 function inventory (Phase 2 reference)

Per ADR-0016 (referenced; substance absorbed into AGENTS.md §6 + SPEC.2 §5.3). Migration 0000 contains:

```sql
-- public.uuidv7() — RFC 9562 UUIDv7 generator
-- Copyright (C) The Zugzwang Authors. AGPL-3.0-or-later.
-- Adapted from a community pure-SQL gist (Fabio Lima / kjmph).
-- Source: https://gist.github.com/kjmph/5bd772b2c2df145aa645b837da7eca74
--
-- When Postgres 18 native uuidv7() ships on Supabase, drop this function
-- with `DROP FUNCTION public.uuidv7()` and pg_catalog.uuidv7() takes over
-- with no schema changes required. Per ADR-0016 §2.
--
-- LANGUAGE sql VOLATILE per ADR-0016 §1 (NOT plpgsql; NOT STABLE/IMMUTABLE).
-- clock_timestamp() not now() per ADR-0016 §1.

CREATE OR REPLACE FUNCTION public.uuidv7()
RETURNS uuid
LANGUAGE sql
VOLATILE
AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid())
                placing substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) from 3)
                from 1 for 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid;
$$;
```

Verify after apply:
- `SELECT uuidv7();` returns a uuid with version-7 nibble at position 13 (`xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx`).
- `SELECT pg_get_function_result(oid), pg_get_function_arguments(oid), provolatile, prolang::regnamespace::text FROM pg_proc WHERE proname = 'uuidv7';` shows `uuid`, ``, `v` (volatile), `pg_catalog` (sql language).

---

## Commit message (Phase 2 reference)

```
feat(scaffold-2): c — migrations (5 files: uuidv7 fn, 20-table schema,
                  events partitioning, 6 trigger fns + 26 triggers, seed)

- 0000: uuidv7() PL/pgSQL function (LANGUAGE sql VOLATILE; clock_timestamp())
- 0001: initial schema (drizzle-kit generated; 20 tables; 9 enums; events
        excluded by tablesFilter; INV-2 CHECK on dharma_ledger.balance_after)
- 0002: events partitioned by RANGE (created_at); 12 monthly partitions
        (2026-05 → 2027-04) + DEFAULT partition + lookup index
- 0003: append-only triggers — 2 shared Bucket-A functions
        (enforce_bucket_a_no_update/no_delete) + 4 per-table Bucket-B
        functions + 26 trigger declarations across 13 protected tables.
        All 4 Bucket-B functions use uniform 3-rule (DISTINCT-FROM) pattern
        per session ratification: permit no-op UPDATEs, reject per-column
        re-fires, reject non-whitelisted column changes; friendly_fire_events
        additionally rejects both whitelisted columns transitioning together;
        image_uploads additionally rejects partial transitions via XOR.
- 0004: system_state singleton seed (id='system', frozen_at=NULL) with
        ON CONFLICT (id) DO NOTHING for re-apply idempotency.

Same-commit SPEC.2 §6.3 amendments:
- A: paragraph 1 (friendly_fire_events): old "single transition on
     frozen_at" replaced with two-independent-transition discipline
     (was stale after 3.B's §5.1 + B.8 amendments).
- B: image_uploads code example: old unconditional re-fire RAISE
     replaced with 3-rule (DISTINCT-FROM) pattern; aligns image_uploads
     to the uniform Bucket-B trigger contract — asymmetry across the
     4 Bucket-B functions removed as a permanent cognitive tax.

ADR amendments: none (the referenced ADR files do not exist in the repo;
the substance is canonical via SPEC.2 absorption). PRECURSOR.5 backlog
may revisit the ADR-file existence question.

Tests + INV-4 canonical integration in 3.D.

Refs: SCAFFOLD.2, SPEC.2 §5 / §6 / §7 / §20, AGENTS.md §6
```

---

## Self-critique (after Phase 1 self-review)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | The plan's `friendly_fire_events` trigger function uses `OLD.col IS DISTINCT FROM NEW.col` for the non-whitelisted column check. If `created_at` is `NOT NULL` (which it is per 3.B schema) and the row was inserted with a default `now()`, then no plausible UPDATE would change `created_at` — the trigger's protection is theoretical for that column. But the discipline is correct: SPEC.2 §6.3's pattern requires explicit per-column enumeration, and stripping `created_at` from the check would create a quiet hole. Keep as-is. | Documented in §6 edge cases as "wasted I/O but not a contract violation"; keep enumeration discipline. |
| 2 | medium | Initial draft had `image_uploads` matching SPEC.2 §6.3 verbatim (unconditional re-fire rejection). This created asymmetry across the 4 Bucket B trigger functions: image_uploads rejected no-op UPDATEs on terminal rows; the other three permitted them. Asymmetry across Bucket B is a permanent cognitive tax for every future reader of the trigger SQL. | **Resolution: align image_uploads to the 3-rule (DISTINCT-FROM) pattern uniform with the other three.** Permits no-op UPDATEs on terminal rows; rejects only actual mutating changes. Amend SPEC.2 §6.3's code example same-commit (per amendment B in the same-commit table above) to make uniformity the spec contract, not just the implementation. Per session ratification 2026-05-11. ✓ Function revised; spec amendment B added. |
| 3 | medium | The plan's verification query (5) `pg_get_function_result(oid)` etc. for the uuidv7 function check is over-specified — a simpler `\df public.uuidv7` would do. But also worth keeping the structured query for the audit walk. | Keep as-is; it's a one-time audit query. |
| 4 | high | The plan's INV-1 row in §1 claims the Bucket-A triggers on bets + comments "preserve" INV-1, but INV-1 is fundamentally a *transaction* property — atomic write of bet AND comment together. The trigger protects against post-insert orphaning (e.g., a DELETE on the comment that orphans the bet), but not against partial commits (which is the actual INV-1 concern). The plan slightly overstates the protection. | Reword §1 INV-1 row: triggers cover the "post-insert orphan via DELETE" failure mode; SERIALIZABLE transaction wrapping in ENGINE.7 covers the "partial commit during write" failure mode. The two are complementary, not substitutes. ✓ See revision below. |
| 5 | low | The verification query (4) counts triggers on parent tables only. If the partition propagation broke (a Postgres version surprise), we'd see 26 but miss broken propagation to events partitions. Should add a sub-check: `SELECT count(*) FROM pg_trigger WHERE tgrelid::regclass::text LIKE 'events_%' AND NOT tgisinternal` should be ~26 (13 partitions × 2). | Added optional verification query to the test plan; surface SURPRISE if count is unexpected. |
| 6 | low | The plan doesn't explicitly state that `drizzle-kit migrate` runs each migration in its own transaction. This is drizzle-kit default behavior, but if a custom config disables it, a partial 0003 could leave half the triggers installed. | Add a verification step: after migration, check that all 26 triggers are present (already in the verification block). Document the implicit transaction-per-migration behavior in §5 failure modes. ✓ Done in §5. |
| 7 | low | Master plan §3.C verification line says "expect 21 (or 33 if including events partitions)". The plan's verification (2) excludes partitions explicitly via `NOT LIKE 'events_%'`. Worth noting that 33 = 21 + 12 partitions; with the DEFAULT partition, the right count is 34. Or 21 + 13 = 34. Minor counting nit. | Clarified in verification query (2): expect exactly 21 base tables filtered for non-partition names. Total including partitions = 21 + 13 = 34. |
| 8 | medium | The plan's "same-commit SPEC.2 amendment" only addresses §6.3 paragraph 1. SPEC.2 §6.3 paragraph 1 might be the only stale prose, but there could be other references to "single transition on frozen_at" elsewhere in the spec. A grep sweep would confirm. | Add a verification step: `grep -nE "single (transition\|frozen)" docs/specs/SPEC.2.md` and surface any other occurrences for review. ✓ Documented in same-commit amendment section. |
| 9 | low | The plan permits no-op UPDATEs on Bucket B tables per Q1 — but `image_uploads` permission gate per SPEC.2 §6.3's example is stricter. The asymmetry is documented in finding #2 above. | Acknowledged in self-critique #2 and trigger function revision. |

### Self-critique revisions applied

**Revision 1 (from finding #2, revised per session ratification 2026-05-11):** `image_uploads` trigger function aligned to the 3-rule (DISTINCT-FROM) pattern uniform with `friendly_fire_events` / `identity_pool` / `system_state`. Permits no-op UPDATEs on terminal rows; rejects per-column re-fires via DISTINCT-FROM; rejects partial transitions; rejects non-whitelisted column changes. SPEC.2 §6.3's code example amended same-commit per amendment B (the spec now reflects the uniform 3-rule pattern). The plan's trigger function in the inventory above is the canonical version Phase 2 will ship.

**Revision 2 (from finding #4):** §1 INV-1 row reworded:

| Invariant | Touched? | How 3.C preserves it |
|---|---|---|
| INV-1 (atomic bet+comment) | **partial** — INV-1 is fundamentally a transaction property (atomic commit of bet + comment together) enforced by the SERIALIZABLE transaction wrapper at ENGINE.7's `src/server/bets/transaction.ts`. 3.C does NOT install that transaction. **3.C does install the storage-layer floor that prevents post-insert orphaning** — Bucket-A triggers on `bets` and `comments` reject UPDATE/DELETE, so a future bug attempting `DELETE FROM comments WHERE id = ...` (orphaning the bet's `comment_id` FK referent) fails at the database layer. The 3.B `bets.comment_id NOT NULL FK ON DELETE RESTRICT` provides the FK guard; the Bucket-A DELETE trigger on `comments` is the additional belt-and-braces floor against `DISABLE TRIGGER`-style bypass attempts. |

**Revision 3 (from finding #5):** Added optional verification query for propagated child triggers (post-Q1 self-critique).

```bash
# 4b. Optional: verify trigger propagation to events partitions (Postgres 11+ auto-propagates)
psql "$DATABASE_URL" -c "
  SELECT count(*) FROM pg_trigger
  WHERE NOT tgisinternal
  AND tgrelid::regclass::text LIKE 'events_%';"
# Expect: 26 (13 partitions × 2 triggers — propagated from parent)
# If 0: propagation broke; surface SURPRISE.
# If 26: all good.
```

**Revision 4 (from finding #8):** Added grep sweep to same-commit SPEC.2 amendment verification:

```bash
# Verify §6.3 amendment lands and no other stale prose remains
grep -nE "single transition.*frozen_at" docs/specs/SPEC.2.md
# Expect: 0 hits (was 1 at line 599)

grep -nE "two independent.*transition" docs/specs/SPEC.2.md
# Expect: ≥1 hit (the new §6.3 amendment)

# Sweep for related stale prose
grep -nE "frozen_at.* NULL → timestamp" docs/specs/SPEC.2.md
# Expect: hits in §5.1 row 10, §6.3, §20.2 — review each in context.
# §5.1 row 10 was amended in 3.B; §6.3 in 3.C; §20.2 carries the system_state phrasing (correct).
```

---

### Self-critique pass 2 — additional findings (2026-05-11)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 10 | high | The plan assumes `pnpm drizzle-kit generate --custom --name <slug>` is a real flag. drizzle-kit 0.30+ documents `--custom` but I have not personally run it against this repo. If the flag is missing or behaves differently, Phase 2 hits a wall. | Add to Phase 2 pre-flight: `pnpm drizzle-kit generate --help \| grep custom` to confirm the flag exists. If missing, fall back to hand-creating both the `.sql` file AND the `_journal.json` entry (the harder but always-viable path). Document as known-uncertainty in §5 failure modes. |
| 11 | medium | The verification queries assume Postgres-17 partition trigger propagation behavior. If the user's local Supabase ships Postgres 15 or 16 (still very common in May 2026), propagation should still work (Postgres 11+ supports it), but the index inheritance behavior on partitioned tables changed in 17. Worth confirming the user's PG version. | Add to Phase 2 pre-flight: `psql "$DATABASE_URL" -c "SHOW server_version;"`. If <17, surface SURPRISE and verify partition behavior empirically. Plan assumes ≥11 minimum (which is documented in AGENTS.md §1 as Postgres 17.6 Supabase). |
| 12 | medium | **Superseded by session ratification 2026-05-11.** Earlier draft had image_uploads using `<>` (matching SPEC.2 §6.3 verbatim) and the other three Bucket B functions using `IS DISTINCT FROM`. Asymmetry across Bucket B trigger functions would have been a permanent cognitive tax. Per Q1's 3-rule formulation scope clarification, all four Bucket B functions now use the uniform DISTINCT-FROM / 3-rule pattern, and SPEC.2 §6.3's image_uploads example is amended same-commit (amendment B). | Asymmetry removed. All four Bucket B trigger functions use `IS DISTINCT FROM` for column-change detection and the 3-rule formulation for whitelisted-transition semantics. No operator-choice rationale needed in 0003's header — the spec and the implementation match. |
| 13 | medium | The plan addresses the *trigger* contract for system_state but not the *uniqueness* contract. SPEC.2 §20.2 says "single-row keyed by `id = 'system'`" but no `CHECK (id = 'system')` constraint exists in 3.B's `src/db/schema/system.ts`. A buggy handler could `INSERT INTO system_state (id, frozen_at) VALUES ('rogue', NULL)`. The PK on `id` permits multiple rows with distinct `id` values. 3.B already shipped without the CHECK; 3.C does not address it (out of scope: schema changes are 3.B territory). | Flag as PRECURSOR.5 backlog item ("system_state needs CHECK (id = 'system') to enforce single-row discipline"). Add to PR body's "Inherited drift" list. Not 3.C scope per §5.4. |
| 14 | low | The plan's commit message names "5 SQL files, 26 triggers, system_state seed" but does not include count of functions or partitions. Cleaner: "5 migrations: uuidv7 fn + 20-table schema + events partitioning (12 monthly + DEFAULT) + 6 trigger fns + 26 trigger declarations + system_state singleton seed". | Update commit message in plan to be more specific. Not blocking. |
| 15 | medium | I missed a verification step for the inherited indexes on partitioned events. When `CREATE INDEX events_aggregate_idx ON events (...)` runs against a partitioned table, Postgres auto-creates inherited indexes on each partition. Verification: `SELECT count(*) FROM pg_indexes WHERE indexname LIKE 'events_2026%' OR indexname LIKE 'events_2027%' OR indexname = 'events_default_%';` — expect 13 indexes inheriting from the parent. | Added to verification block. ✓ |
| 16 | medium | The plan implies `drizzle-kit migrate` runs each migration in its own implicit transaction, but I haven't verified drizzle-kit 0.30+'s actual behavior. If migrations are run sequentially without per-migration transactions, a partial 0003 could leave half the triggers installed. | Phase 2 pre-flight: read `node_modules/drizzle-kit/`'s migrate behavior, or test by intentionally breaking a migration and verifying rollback. Alternatively: wrap each migration's body in `BEGIN; ... COMMIT;` explicitly, which is portable. For 0000, 0002, 0003, 0004 (hand-written), Phase 2 should add explicit `BEGIN; ... COMMIT;` to ensure atomicity even if drizzle-kit's default differs. **This is a meaningful Phase 2 addition not in the master plan.** |
| 17 | low | The plan's "additional verification" queries grew in self-critique passes. Worth consolidating into a single check-script in Phase 2 (e.g., `scripts/verify-scaffold-2-3c.sh`) so future erratum PRs can re-run quickly. | Defer to Phase 2 discretion. Not 3.C scope (no new script files needed). |
| 18 | high | I have not confirmed the kjmph gist's exact pure-SQL body. ADR-0016 (file doesn't exist) is the canonical reference; AGENTS.md §6 references "userspace `public.uuidv7()` hand-written PL/pgSQL function" without giving the body. The plan provides a candidate body sketch (based on the standard kjmph variant) but Phase 2 must verify against the actual gist + ADR-0016 substance referenced in commit history or web Claude chat memory. Gist-comparison catches typos but not bit-flips. | **Phase 2 pre-flight (runs after 0000 applies, BEFORE writing 0001):** Run the empirical version-nibble check against 1000 generated UUIDs — every one must have version=7 at character 15: <br><br>`SELECT count(*) FROM (SELECT substring(uuidv7()::text, 15, 1) AS v FROM generate_series(1, 1000)) t WHERE v != '7';` — Expect: 0. <br><br>Plus the time-prefix sanity check: `SELECT extract(epoch from clock_timestamp())::bigint - (('x' \|\| substring(replace(uuidv7()::text, '-', ''), 1, 12))::bit(48)::bigint / 1000);` — Expect: <1 (function emits a fresh millisecond-precision time prefix). <br><br>**If either check fails, halt before writing 0001.** The body is wrong; PK columns on every table would be broken. This is the highest-risk file in 3.C; treat the pre-flight as a hard gate. |

### Iteration complete — plan survives second pass + user corrections

The plan addresses all 18 findings either by inline revision or by deferring to documented Phase 2 verification steps. No high-severity finding remains unaddressed. The two highest-risk items (#10 drizzle-kit `--custom` flag, #18 uuidv7 function body) are documented as Phase 2 pre-flight checks that must pass before SQL is written.

**User-directed corrections applied 2026-05-11 (no other changes):**
1. **Bucket B uniformity (Q1 scope expansion).** image_uploads aligned to 3-rule (DISTINCT-FROM) pattern matching the other three Bucket B functions; SPEC.2 §6.3 image_uploads code example amended same-commit (amendment B). Asymmetry across Bucket B trigger functions removed.
2. **uuidv7() pre-flight strengthened.** 1000-generation empirical version-nibble check added to finding #18 + verification block #1b; serves as Phase 2 hard gate after 0000 applies but before 0001.
3. **§6.3 amendment grep pinned.** Sweep grep is now deterministic: "Expect exactly 3 hits — §5.1 row 10 + §6.3 + §20.2. Any other hit is stale; surface as SURPRISE to Hrishikesh."
4. **drizzle-kit `_meta/_journal.json` staging gate.** Added to pre-PR self-audit + db-migration-reviewer invocation. Catches the silent-staging footgun where the journal is one entry behind the .sql files.
5. **db-migration-reviewer column-enum check.** Subagent invocation now explicitly requires per-table column-enumeration verification against Drizzle schemas (silent corruption surface for Bucket B trigger functions).

---

## References

- `CLAUDE.md` §1 (critical paths), §2 (invariants), §3 (refusal triggers), §5.10 (pre-PR self-audit), §5.11 (subagent invocation)
- `AGENTS.md` §6 (DB conventions, FK indexing, append-only triggers, migrations append-only), §11 (boundaries)
- `docs/specs/SPEC.2.md` §5 (table inventory), §6 (append-only enforcement), §7 (event model + partitioning), §9 (concurrency), §14 (invariant contract), §20 (conclusion freeze), Appendix B (per-column shapes)
- `docs/specs/SPEC.1.md` §6.1 (markets state machine), §11 (resolution), §16.5/16.6 (data hygiene)
- `docs/plans/SCAFFOLD.2.md` §3.C (master plan; this plan refines)
- `docs/plans/SCAFFOLD.2-3B.md` (predecessor stratum plan)
- `docs/logs/SCAFFOLD.2-3B.md` (predecessor wind-down log)
- `.claude/agents/db-migration-reviewer.md` (subagent invoked post-audit)
- `src/db/schema/*.ts` (the input — read-only in 3.C)
- ADR references throughout (ADR-0005 / -0008 / -0009 / -0013 / -0014 / -0016): files do not exist in `docs/adr/`; substance is canonical via SPEC.2 + AGENTS.md + CLAUDE.md absorption. PRECURSOR.5 backlog item.

---

*Plan to be committed at `docs/plans/SCAFFOLD.2-3C.md` per CLAUDE.md §5.1 after ExitPlanMode approval. Commit message: `plan: SCAFFOLD.2 stratum 3.C — migrations + triggers + system_state seed`.*
