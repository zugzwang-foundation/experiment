# SCAFFOLD.2-3C — Session log

- **Task ID:** SCAFFOLD.2 stratum 3.C
- **Date:** 2026-05-12
- **Branch:** `feat/scaffold-2-stratum-c` (merged + deleted)
- **PR:** [#28](https://github.com/zugzwang-foundation/experiment/pull/28)
- **Merge commit:** `7552d15` (squashed from `5d328a6` plan + `1143d52` implementation)
- **Plan:** `docs/plans/SCAFFOLD.2-3C.md` (721 lines, includes four absorbed-drift addendums)
- **Author:** Hrishikesh + Claude Code Opus 4.7 (Phase 1 tab + Phase 2 tab) + web Claude Opus 4.7
- **Duration:** ~6 hours wall-clock (planned 2.5–4 hours; +50–100% overrun on drift absorption)

---

## 1. Goal and exit criterion

**Goal.** Land five SQL migrations applied in absolute order against a fresh Postgres 17 DB: `0000_uuidv7_function.sql`, `0001_initial_schema.sql`, `0002_events_partitioning.sql`, `0003_append_only_triggers.sql`, `0004_seed_system_state.sql`. Reify the storage-layer enforcement contract from SPEC.2 §6 + §7 + §20.

**Exit criterion.** Migrations apply cleanly to a fresh local Supabase Postgres 17.6. 21 base tables + 13 events partitions + 26 triggers + 6 trigger functions + system_state singleton seed verifiable via psql. `@db-migration-reviewer` returns PASS/FAIL/SURPRISE clean. PR merged to main.

**Met.** All exit criteria satisfied. PR #28 merged 2026-05-12.

---

## 2. What shipped

### Migrations (5 files, applied in order)

| File | Source | Function |
|---|---|---|
| `drizzle/migrations/0000_uuidv7_function.sql` | hand-written (`--custom`) | `public.uuidv7()` PL/pgSQL function; AGPL header; kjmph gist pure-SQL variant; `LANGUAGE sql VOLATILE`; `clock_timestamp()` |
| `drizzle/migrations/0001_initial_schema.sql` | drizzle-kit generated, then hand-edited | 20 CREATE TABLE (events removed via 3.A drift hand-edit); 9 CREATE TYPE; FKs + indexes; `dharma_ledger.balance_after >= 0` CHECK from 3.B |
| `drizzle/migrations/0002_events_partitioning.sql` | hand-written (`--custom`) | `events` table with composite PRIMARY KEY `(event_id, created_at)`; 12 monthly RANGE partitions (2026-05 → 2027-04); DEFAULT partition; `events_aggregate_idx` |
| `drizzle/migrations/0003_append_only_triggers.sql` | hand-written (`--custom`) | 2 shared Bucket-A functions; 4 per-table Bucket-B functions; 26 trigger declarations across 13 protected tables; `friendly_fire_events` permits two independent NULL→timestamp transitions (Q1 3-rule formulation) |
| `drizzle/migrations/0004_seed_system_state.sql` | hand-written (`--custom`) | Singleton INSERT `('system', NULL)` with `ON CONFLICT (id) DO NOTHING` for idempotency |

### Same-commit SPEC.2 amendments (48 lines net)

- **§6.3 paragraph 1** — `friendly_fire_events` updated from "single transition on frozen_at" to "two independent NULL→timestamp transitions" per 3.B's §5.1 row 10 + B.8 ratification absorption. Image_uploads example also amended to match Q1's universal 3-rule formulation (drop unconditional re-fire RAISE; use IS DISTINCT FROM pattern).
- **§7.1** — `event_id` PK annotation updated to indicate composite PK with `created_at`; added rationale paragraph naming the Postgres partition-key constraint.
- **§7.3** — `ON CONFLICT (event_id, created_at) DO NOTHING` replaces `ON CONFLICT (event_id) DO NOTHING`. Added insertEvent helper note that `created_at` is supplied deterministically from UUIDv7's millisecond prefix so retries reuse the same value.
- **§3.7 / §5.1 / §7.7** — Consistency sweep for the composite PK change. Helper signature in §3.7 reflects the new ON CONFLICT shape.

### Other repo changes

- `src/db/schema/_enums.ts` — new file. Extracted `sideEnum` from `bets.ts` to break the bets↔comments TDZ cycle (3.B drift).
- `src/db/schema/bets.ts` + `comments.ts` + `index.ts` — imports updated to pull `sideEnum` from `_enums.ts`.
- `biome.json` — `"!drizzle/migrations/meta/**"` added to files.includes to resolve Biome vs drizzle-kit JSON formatting conflict (3.A drift).
- `drizzle/migrations/meta/_journal.json` + 5 per-migration snapshot.json files — drizzle-kit auto-generated, staged in commit.
- `docs/plans/SCAFFOLD.2-3C.md` — 820 lines net; four absorbed-drift subsections appended.

---

## 3. Decisions made

### At plan time

- **5-file split locked.** 0000 / 0001 / 0002 / 0003 / 0004 in absolute order. Not collapsed into fewer files; not split into more. Matches SPEC.2 §6.1 clause 4 + §7.2 + §20.2.
- **12 monthly partitions + DEFAULT.** 2026-05 → 2027-04 window covers full experiment + 5-month tail.
- **6 functions + 26 trigger declarations.** 2 shared Bucket A + 4 per-table Bucket B + 18 Bucket A declarations + 8 Bucket B declarations.
- **Universal 3-rule across all four Bucket B tables.** Image_uploads aligned to friendly_fire / identity_pool / system_state semantics; permit no-op UPDATEs on terminal rows. Asymmetry rejected as permanent cognitive tax.
- **`pnpm drizzle-kit generate --custom --name <slug>`** for all four hand-written migrations to keep `_meta/_journal.json` in sync.
- **`ON CONFLICT (id) DO NOTHING`** on 0004 seed for idempotency (db-migration-reviewer agent requirement, line 51 of the agent spec).
- **No ADR amendments.** ADR files 0003–0016 are ghost references; substance is canonical via SPEC.2 absorption. All ADR amendments in plan translated to SPEC.2 amendments. Same precedent as 3.B's PR #25.

### Mid-execute (during Phase 2)

- **3.B sideEnum TDZ cycle (drift #2).** Surgical fix: extract `sideEnum` to `_enums.ts`. Bundled into 3.C as in-PR erratum; not as separate `fix/scaffold-2-3b-tdz` PR. ~3-line touch across 3 files. Documented in PR body's "Spec/tooling drift absorbed" section. CC's stop-and-ask surfaced this correctly before proceeding.
- **3.A tablesFilter no-op (drift #1).** Per official Drizzle docs, `tablesFilter` applies to `push`/`pull` only, not `generate`. The 3.A predecessor log line 148 assumption is incorrect. Resolution: hand-edit 0001 to delete the 12 events-related lines (CREATE TABLE events + CREATE INDEX events_aggregate_idx). No FK constraints reference events; surgery is clean. 0001 is generated once at project start, never regenerated, so hand-edit persists.
- **3.B events PK + partition contradiction (drift #3).** Postgres requires the partition column be part of any PK/UNIQUE constraint on a partitioned table. PK on `event_id` alone is incompatible with `PARTITION BY RANGE (created_at)`. Resolution: composite PK `(event_id, created_at)`. SPEC.2 §7.1 + §7.3 amended same-commit. ENGINE.6's insertEvent helper must supply `created_at` deterministically from UUIDv7's millisecond prefix so retries reuse the same value (storage idempotency stands). `src/db/schema/events.ts` declaration alignment deferred to PRECURSOR.5 (3.B scope; read-only in 3.C).
- **3.A Biome vs drizzle-kit JSON formatting (drift #4).** Biome's `indentStyle: "tab"` rejects drizzle-kit's 2-space-indented `meta/*.json` files. Resolution: add `"!drizzle/migrations/meta/**"` to `biome.json` files.includes (Biome 2.x syntax). One-line change. Drizzle-kit owns its journal/snapshot formatting; Biome doesn't police generated JSON.

### At self-audit time

- **Pre-PR self-audit (CLAUDE.md §5.10) returned all PASS.** Per-migration inventory walked item-by-item. 6 functions + 26 triggers verified. SPEC.2 amendments verified via grep. ON CONFLICT verified. friendly_fire two-independent-transition semantics verified.
- **`@db-migration-reviewer` subagent returned CLEAN.** All 10 checks PASS. No SURPRISE. Column enumeration in each Bucket B function matches Drizzle schema in `src/db/schema/*.ts`. No silent pass-through hazards. No dead code in trigger enumerations.

---

## 4. Drifts absorbed (4 in-PR) and inherited drift (3 flagged for PRECURSOR.5)

### Absorbed in 3.C

| # | Drift | Surface | Resolution |
|---|---|---|---|
| 1 | 3.A `tablesFilter` is no-op for `drizzle-kit generate` | drizzle-kit emitted `events` table in 0001 despite filter | Hand-edit 0001 (12 lines removed) |
| 2 | 3.B `sideEnum` eager use → TDZ in bets↔comments cycle | `drizzle-kit generate` failed at runtime evaluation | Extracted `sideEnum` to `src/db/schema/_enums.ts` |
| 3 | 3.B events PK on `event_id` + partition by `created_at` incompatible | 0002 apply failed with "unique constraint on partitioned table must include all partitioning columns" | Composite PK `(event_id, created_at)` + SPEC.2 §7.1 + §7.3 amendments + insertEvent helper contract clarification |
| 4 | 3.A Biome vs drizzle-kit JSON formatting | `biome check` fails on auto-generated meta/*.json | Added `!drizzle/migrations/meta/**` to biome.json ignore |

### Not fixed (flagged in PR body for PRECURSOR.5)

- **`just db-migrate` doesn't source `.env.local`** — workaround used in session (manual `export DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d'=' -f2)` before invoke). Justfile recipe needs `set dotenv-load := true` or equivalent.
- **`supabase/` runtime state dir not in `.gitignore`** — currently surfaces as untracked. Add to `.gitignore` in PRECURSOR.5 cleanup.
- **ADR files 0003–0016 still ghost references** in CLAUDE.md / AGENTS.md / SPECs / plans. PRECURSOR.5 backlog item: either land the ADR files from project knowledge into `docs/adr/`, or update the references to point to SPEC.2 absorptions consistently.

---

## 5. Verifications

### Apply-time (all PASS)

```
1. uuidv7() function exists and produces version-7 UUIDs.       PASS
2. 21 base tables exist (system_state has text PK).             PASS (21)
3. 13 events partitions inherit from parent.                    PASS (13)
4. 26 triggers on protected parent tables.                      PASS (26)
4b. 26 propagated child triggers on events_2026_*/2027_* +      PASS (26)
    events_default partitions.
5. 6 trigger functions exist.                                   PASS (6)
6. system_state seed row present, frozen_at=NULL.               PASS
7. dharma_ledger_balance_non_negative CHECK present.            PASS
8. (smoke test on dharma_ledger — empty table, no-op)           PASS (n/a)
9. just verify (tsc + biome + build).                           PASS green
```

Pre-PR self-audit walked. All items PASS. No FAIL. No SURPRISE.

### `@db-migration-reviewer` subagent

```
All 10 checks PASS. No SURPRISE.
- Trigger SQL matches SPEC.2 §6.2 + §6.3
- Bucket B column enumeration matches Drizzle schemas exactly
- Partition DDL matches §7.2 (12 monthly + DEFAULT)
- Hand-written SQL aligned with 3.B schemas
- 0004 ON CONFLICT (id) DO NOTHING present
- SPEC.2 amendments correctly translate from non-existent ADRs
```

---

## 6. What's next

### Immediate next stratum

**SCAFFOLD.2 stratum 3.D — Tests.** Per master plan §3.D + CLAUDE.md §5.6. Trigger contract from 3.C is the storage-layer ground truth; 3.D writes the Vitest test files that verify it.

Scope: `tests/db/triggers/<table>-append-only.spec.ts` × 13 protected tables + `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts`. ≥35 cases. `@test-writer` subagent invocation per CLAUDE.md §5.11.

Adjusted estimate per drift-pattern observed: **5–7 hours**, not the originally-quoted 4-6.

### PRECURSOR.5 backlog items added by 3.C

- `just db-migrate` `.env.local` source missing
- `supabase/` runtime state dir `.gitignore` exclusion
- ADR files 0003–0016 still ghost references (CLAUDE.md / AGENTS.md / SPECs / plans)
- `src/db/schema/events.ts` declaration alignment to composite PK (Drizzle type-inference layer; storage DDL is the truth)
- Sentry alarm 2 wiring for DEFAULT-partition writes (deferred, HARDEN.*)

### Risk on horizon

- 3.D test fixture pattern is the first place the trigger contract gets exercised at scale. Composite PK on events means INSERT helper fixtures must supply `created_at` explicitly. Friendly_fire two-independent-transition discipline means test cases are non-trivially structured.
- Subagent invocation pattern matured here. 3.D's `@test-writer` invocation should follow same form: plan path explicit, surface scope, table count.

---

## 7. Lessons

1. **Three Postgres/Drizzle physical-constraint surfaces hit at apply-time** that the spec layer didn't catch (tablesFilter scope, TDZ cycle, partition-PK constraint). PRECURSOR.5 needs a "spec + tooling sanity sweep against live PG 17.6 + Biome 2.x + drizzle-kit 0.30.x" pass before further strata land. Half-day of upfront work would save several hours of mid-stratum context-switching.

2. **`pnpm drizzle-kit generate --custom --name <slug>` works as documented.** Plan's P3 push-back (use `--custom` for hand-written migrations to keep `_meta/_journal.json` in sync) was correct. Verified empirically.

3. **CC's stop-and-ask discipline (CLAUDE.md §5.4 + §5.11) caught every drift** before silent absorption. Three SURPRISE surfacings in this session. Each cost ~20–30 min of round-trip but prevented silent corruption that would have surfaced in 3.D or later. The pattern is working as designed.

4. **Pre-PR self-audit (CLAUDE.md §5.10) PASSED clean on the first run.** All drift was caught at apply-time, not at audit-time. This is the desired pattern: surface during execute, resolve in-session, audit confirms clean.

5. **Universal Bucket B 3-rule (Q1 universal interpretation) was the right call.** Asymmetry across Bucket B trigger functions would have been a permanent cognitive tax. Same-commit SPEC.2 §6.3 example amendment to image_uploads is one paragraph; cost of asymmetry would have been recurring code-review friction forever.

6. **Plan estimate overshot by 2-3×.** Original 2.5-4 hour estimate did not weight drift-absorption rounds correctly. Revised SCAFFOLD.2 total: 12-16 hours over 3-5 calendar days. Sep 15 launch still on track; slack tightened from "comfortable" to "tracking."

---

## 8. References

- **Plan:** `docs/plans/SCAFFOLD.2-3C.md` (820 lines, four absorbed-drift addendums)
- **Predecessor log:** `docs/logs/SCAFFOLD.2-3B.md`
- **Master plan:** `docs/plans/SCAFFOLD.2.md` §3.C
- **CLAUDE.md:** §1 (critical paths), §5.4 (scope freeze), §5.6 (tests-first), §5.9 (session log), §5.10 (pre-PR self-audit), §5.11 (subagent invocation)
- **AGENTS.md:** §1 (Postgres 17.6 baseline), §6 (DB conventions, append-only triggers, migrations append-only)
- **SPEC.2:** §5 (table inventory), §6 (append-only enforcement), §7 (event model + partitioning), §14 (invariant contract), §20 (conclusion freeze), Appendix B (per-column shapes)
- **SPEC.1:** §6.1 (markets state machine), §12 (timeline), G3 (K_eff derivation from public dataset)
- **PR:** [#28 — feat/scaffold 2 stratum c](https://github.com/zugzwang-foundation/experiment/pull/28)
- **Merge commit:** `7552d15`

---

*Log committed to main per CLAUDE.md §5.9 closing ritual step 1 of 4.*
