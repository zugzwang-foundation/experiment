# SCAFFOLD.2 — Postgres + Drizzle + event-sourced schema

> Per-session log per CLAUDE.md §5.9. One section per session (one per stratum).
> Plan at `docs/plans/SCAFFOLD.2.md`. Five strata: 3.A → 3.B → 3.C → 3.D → 3.E.

---

## Stratum 3.A — Setup + F-\* skeletons

**Date:** 2026-05-11
**Branch:** `feat/scaffold-2-stratum-a`
**PR:** #22 (merged at 97d3cdb)
**Session length:** ~1 chat

### What landed

- `package.json`: 8 new deps (drizzle-orm ^0.45.0, drizzle-zod ^0.7.0, postgres ^3.4.5, uuid ^11.0.0, server-only ^0.0.1 in deps; drizzle-kit ^0.30.0, vitest ^3.0.0, @types/uuid ^10.0.0 in devDeps) + `pnpm.onlyBuiltDependencies`
- `pnpm-workspace.yaml`: newly git-tracked; `allowBuilds: { esbuild: true, lefthook: true, sharp: true }`
- `pnpm-lock.yaml`: regenerated cleanly (no churn beyond new deps + transitive)
- `mise.toml`: `supabase = "latest"` (resolved 2.98.2)
- `justfile`: `db-generate`, `db-migrate`, `db-reset`, `test-db` recipes; `verify` unchanged
- `drizzle.config.ts` (new) — `tablesFilter: ["!events"]` per ADR-0005 §5
- `src/db/index.ts` (new) — `import "server-only"` first; `DbClient` + `DbTransaction` type aliases for ENGINE.7
- `src/db/schema/index.ts` (new) — empty `export {};` re-export aggregator; 3.B fills
- `.env.example` (new) — local Supabase URL template
- `docs/specs/flows/` — README + 40 F-\*.md skeletons (38 active + 2 struck audit-trace for F-COMMENT-4/5)

### Decisions made

**Plan-doc variances (3, all captured in PR #22 body):**

1. **`server-only` added as 8th dep.** Plan listed 7; required by `src/db/index.ts` `import "server-only"` first-statement discipline per ADR-0008 §1. Pinned `^0.0.1` — only published version on npm and matches what Next.js 16.2.4 bundles transitively.

2. **`pnpm-workspace.yaml` now git-tracked.** Plan's pre-flight note "(already addressed in pre-flight per `lefthook` + `sharp` approval)" referenced the pnpm 10 era mechanism (`pnpm exec lefthook install` direct). pnpm 11 strict mode requires explicit `pnpm approve-builds`, which writes `allowBuilds:` to `pnpm-workspace.yaml`. Pre-flight catchup done in this commit. AGENTS.md §10 line "`pnpm-workspace.yaml` not used (single package)" is now technically inaccurate for build-approval purposes — **fix deferred to PRECURSOR.5 sweep per user instruction.**

3. **`src/db/schema/index.ts` placeholder added.** Not in plan's file list. Required for `import * as schema from "./schema"` in `src/db/index.ts` to resolve under bundler module resolution before 3.B's per-domain files land. One-line `export {};` stub; 3.B replaces with real `export * from './<domain>'` re-exports.

**Judgment call (one, surfaced via AskUserQuestion):**

- F-COMMENT-4 / F-COMMENT-5 (struck flows per SPEC.2 §13.3) Status line **overridden** to `STRUCK from v1 per SPEC.1 §8 — no gating task; preserved as audit trace per SPEC.2 §13.3` instead of the plan's verbatim "skeleton (substance pending per SPEC.2 §13.4 gating cadence)" template. User selected the override (deliberate divergence from "verbatim") because the cadence is inapplicable for flows that will never receive substance. Active 38 use verbatim template Status.

**F-\* enumeration audit (per plan's pre-generation gate):**

- SPEC.2 §13.3 inventory authoritative: 40 rows across 7 prefix families
- Prior estimate gap of 3 filled by F-MOD-5 (manual mod queue review), F-DEBATE-4 (debate view poll), F-ADMIN-5 (audit-log search)
- F-ADMIN-6 (raw-grep hit) is **deleted** per SPEC.1 2026-05-03 change-log — not in scope
- F-DATASET-1 (raw-grep hit) is gated to SCAFFOLD.18 — not in scope at 3.A

### Open questions

None blocking 3.B. Carry-forward items:

- AGENTS.md §10 line correction queued for PRECURSOR.5 sweep (declined here per user)
- pnpm version mismatch: AGENTS.md §10 says pnpm 10; corepack-resolved pnpm is 11.0.9 (mise installs 10.33.2 but corepack overrides). Not blocking; flag for the same sweep.

### Next session starts at

**Stratum 3.B — Drizzle schemas (21 tables, 9 domains).**

- Branch `feat/scaffold-2-stratum-b` from `main` (after `/clear`)
- Read `docs/plans/SCAFFOLD.2.md` stratum 3.B section in full FIRST
- 11 schema files at `src/db/schema/<domain>.ts` per SPEC.2 §5 inventory + ADR-0008 §4
- All PKs declare `uuid("id").primaryKey().default(sql\`uuidv7()\`)` per ADR-0016 D3
- drizzle-zod insert/select schemas co-located per ADR-0008 §5
- ADR-0009 ratification (`friendly_fire_events.cleared_at` = nullable timestamp; two independent whitelisted transitions) lands as same-commit ADR amendment per plan's stratum 3.B "Manual review gate"
- `src/db/schema/index.ts` placeholder gets real re-exports

### Context to preserve (non-obvious)

- `src/db/schema/index.ts` currently `export {};` — placeholder for compile; 3.B replaces
- `bets.comment_id` FK target is `comments.id`. Per ADR-0008 §6.1, use lambda form `.references(() => comments.id)` to handle the circular reference
- `system_state.id` is **text `'system'`** carve-out from universal UUIDv7 rule per SPEC.2 §20.2 single-row sentinel discipline; ADR-0016 amendment in 3.C, not 3.B
- The 13 protected tables (9 Bucket A + 4 Bucket B per SPEC.2 §5.1) only become "protected" once 3.C's append-only triggers land; 3.B is type-only
- `events` table is declared in `src/db/schema/events.ts` for type inference + drizzle-zod ONLY — actual DDL is hand-written in 3.C's `0002_events_partitioning.sql` because Drizzle can't express PARTITION BY RANGE. `drizzle.config.ts` already excludes it via `tablesFilter: ["!events"]`
- pnpm 11 strict mode: any new dep with a postinstall script will require `pnpm approve-builds <name>` + a commit to `pnpm-workspace.yaml`. Watch for this in 3.C/3.D if test deps grow
- supabase CLI invoked via `mise exec -- supabase ...` (shell activation not configured on this machine)
- `just verify` is DB-free (typecheck + biome + build only). DB-touching verification is `just test-db` and requires `supabase start` running
- Lefthook hooks installed (`approve-builds` triggered `lefthook postinstall: sync hooks: ✔️ (pre-commit, pre-push)`); pre-push runs typecheck + biome

---

## Stratum 3.B — Drizzle schemas (21 tables, 10 domains)

**Date:** 2026-05-11
**Branch:** `feat/scaffold-2-stratum-b`
**PR:** TBD (draft)
**Session length:** ~1 chat (plan + execute split across two tabs)

### What landed

- 10 new per-domain schema files at `src/db/schema/<domain>.ts`: `auth.ts` (5 tables), `markets.ts` (2), `bets.ts` (2), `comments.ts` (2), `dharma.ts` (1), `events.ts` (3), `identity.ts` (1), `image-uploads.ts` (1), `audit.ts` (3), `system.ts` (1) — 21 tables, 9 Bucket A + 4 Bucket B + 8 Bucket C per SPEC.2 §5.2
- `src/db/schema/index.ts`: `export {};` placeholder replaced with 10 alphabetical re-export lines
- 9 pgEnums: `marketStatusEnum`, `marketOutcomeEnum`, `sideEnum`, `ffDirectionEnum`, `dharmaEntryTypeEnum`, `resolutionEventKindEnum`, `payoutTypeEnum`, `imageTerminalStateEnum`, `modVerdictEnum`
- `events.event_type` / `aggregate_type` / `admin_events.event_type` / `user_events.event_type` remain `text` (open-extensible per SPEC.2 §7.1 line 686)
- `bets.comment_id` NOT NULL lambda FK to `comments.id` — INV-1 schema half
- `dharma_ledger` lone in-scope CHECK `balance_after >= 0` — INV-2 storage-layer enforcement
- `friendly_fire_events`: two independent Bucket-B whitelisted columns (`cleared_at` + `frozen_at`)
- All FKs indexed per AGENTS.md §6; `relations()` per table for typed query builder
- `docs/specs/SPEC.2.md` §5.1 row 10 + Appendix B.8 — `cleared_at` ratification (same commit as schemas)
- Commit: `e903c72` (`feat(scaffold-2): b — drizzle schemas (21 tables, 10 domains, 11 files)`)

### Decisions made

**Plan-faithful (no scope variances).** All confirmed-framing items honored: ADR substrate dormant (cited SPEC.1/SPEC.2 by section, never `per ADR-N`); `cleared_at` SPEC.2 amendment same-commit; `system_state.id` text-`'system'` carve-out documented in source (SPEC ratification text deferred to 3.C); §5.6 tests-before-implementation dormant for 3.B.

**Better Auth 1.6.x users 4-column gap.** `users` is 17 columns — SPEC.2 B.1's 13 plus Better Auth core `name`, `email_verified`, `image`, `updated_at`. `email` also flips to NOT NULL to match Better Auth's contract. SPEC.2 B.1 flagged for PRECURSOR.5 drift sweep alongside `markets.status` 3-vs-7 (B.2), `identity_pool.number` 1-9-vs-0-999 (B.15), `bet_settle`-vs-`bet_payout` enum (B.7).

**Biome auto-fixes applied** during verify: import-sort on `auth.ts` (Biome merged the third-party + relative import blocks under its single-block organize-imports rule) and one-line `uniqueIndex().on()` formatting in `comments.ts`. No semantic changes.

### Open questions

None blocking 3.C. Carry-forward (PRECURSOR.5 drift sweep): SPEC.2 B.1 4-col gap, B.2 markets.status 3-vs-7, B.15 identity_pool.number 1-9-vs-0-999, B.7 `bet_settle`/`bet_payout`.

### Next session starts at

**Stratum 3.C — Migrations + triggers.**

- Branch `feat/scaffold-2-stratum-c` from `main` (after PR merges + `/clear`)
- 4 migrations: `0001_initial_schema.sql` (drizzle-kit generated), `0002_events_partitioning.sql` (hand-written `PARTITION BY RANGE` per SPEC.2 §7 + ADR-0005), `0003_append_only_triggers.sql` (Bucket A strict + Bucket B whitelisted per SPEC.2 §6), `0004_seed_system_state.sql` (single `id='system'` row)
- Verification: `pnpm drizzle-kit generate`; grep generated SQL for `CREATE TABLE.*events` must return 0; CREATE TABLE count must be 20 (events excluded)
- Same-commit SPEC ratification: `system_state.id` text-PK SPEC text (deferred from 3.B per plan §"Confirmed framing" item 3)

### Context to preserve (non-obvious)

- Circular FK pair `bets.comment_id ↔ comments.bet_id`: both use `references((): AnyPgColumn => …, { onDelete: 'restrict' })` lambda form. ESM lazy evaluation handles the import cycle
- Self-ref lambdas: `comments.parent_comment_id`, `resolution_events.corrects_event_id` (both `onDelete: 'restrict'`)
- `events.event_id` (NOT `id`) per SPEC.2 §7.1 line 685 — code defaulting to `<table>.id` must explicitly target `events.event_id`
- `events` pgTable is type-only in 3.B; `drizzle.config.ts tablesFilter: ["!events"]` excludes it from DDL gen; 3.C's `0002_events_partitioning.sql` is hand-written
- `system_state.id` text-PK carve-out documented in `src/db/schema/system.ts` source comment; SPEC.2 ratification text deferred to 3.C
- `actor_id` columns in `mod_actions` / `admin_events` are `text NOT NULL` (not FKs) — admin has no `users` row (§8.7 pillar 1)
- Relation disambiguation: `relationName: "comment_thread"` on `comments` self-ref; `"resolution_corrections"` on `resolution_events` self-ref
- `dharma_ledger CHECK (balance_after >= 0)` is the only in-scope CHECK in 3.B; all others deferred to HARDEN.*
- `comments.image_uploads_id` keeps plural-target → `_id` naming per SPEC.2 B.6 line 2480 — intentional, do not singularize
- `pnpm drizzle-kit generate` NOT run yet (3.C scope); `just test-db` NOT run (no migrations yet)
- Biome's organize-imports merged the third-party + relative import blocks in `auth.ts` — adopting separate blocks back would force a re-fix on every save

### Time

~1 chat (plan-then-execute via two-tab handoff)
