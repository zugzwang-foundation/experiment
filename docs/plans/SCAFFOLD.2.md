# SCAFFOLD.2 — Postgres + Drizzle + event-sourced schema

> Plan document. Read in full at the start of every Claude Code session that touches this task. Each stratum is one Claude Code session, one branch, one PR. Do not skip ahead. Do not bundle.

---

## Header

| Field | Value |
|---|---|
| Tracker ID | SCAFFOLD.2 |
| Phase | 2 — Core Scaffolding |
| Critical-path | **Yes** (touches `src/db/schema/`, `drizzle/migrations/`) |
| Triggers | Writer/reviewer ritual, invariant test gate, same-commit ADR scan |
| Estimate | 4–5 days (revised from tracker's 3d at sub-part 1 scope-confirm) |
| Deps satisfied | ADR-0005, ADR-0006, ADR-0008, ADR-0009, ADR-0013, ADR-0016 (all locked) |
| Branch convention | `feat/scaffold-2-stratum-<a|b|c|d|e>` per stratum |

## Source-of-truth gates

When writing schema, migration, or test code, these documents win over Claude Code's priors:

- **SPEC.2** — §3 (data flows), §5 (table inventory), §6 (append-only contract), §7 (event model), §9 (concurrency), Appendix A (file map)
- **ADR-0005** — Pattern A; Bucket A/B/C; events column shape; partitioning; storage idempotency
- **ADR-0008** — Drizzle ORM; per-domain schema split; mixed-origin migration set; drizzle-zod boundary
- **ADR-0009** — `comments.stake_at_post_time` column; `friendly_fire_events.cleared_at` schema decision (lands here); two flagged indexes
- **ADR-0013** — bet transaction wrapper (consumer of this schema; not implemented here)
- **ADR-0016** — UUIDv7 PL/pgSQL function + `default(sql\`uuidv7()\`)` discipline + Better Auth column-type override + URL-exposure rule
- **CLAUDE.md** — invariants (§2), refusal triggers (§3), workflow rules (§5)
- **AGENTS.md** — stack patterns (§6 DB, §8 testing, §10 boundaries)

If any of these conflict with what Claude Code "knows" — they win. If two of these conflict with each other — stop and surface to Hrishikesh.

## Out of scope (refusal-grade)

These belong to other tasks. Adding any of them to a SCAFFOLD.2 PR is `REFUSAL:`-grade scope creep:

- Server Actions, Route Handlers, request handlers of any kind → ENGINE.7+, DEBATE.2+
- Auth wiring (Better Auth instance config, session-deferral hook) → SCAFFOLD.3
- The bet transaction wrapper at `src/server/bets/transaction.ts` → ENGINE.7
- The events insert helper at `src/server/events/insert.ts` → ENGINE.6
- The per-event-type Zod schemas at `src/server/events/schemas.ts` → ENGINE.6
- The pseudonym pool consumer at `src/server/identity/assign.ts` → SCAFFOLD.3
- Any decimal-arithmetic library (decimal.js / dnum / js-big-decimal) → ENGINE.5
- Identity-pool data load (50K rows) → SCAFFOLD.17
- R2 object storage wrappers → SCAFFOLD.15
- Sentry/PostHog/Axiom imports anywhere → SCAFFOLD.5/6/7
- CI workflow file edits → SCAFFOLD.18
- `pg_cron` Path-A freeze job, alarm-meta-query → HARDEN.10
- BREAK_GLASS.md, runbooks → HARDEN.10

When in doubt: this task is **schema + migrations + their test contract + the empty F-\* skeletons for downstream tasks**. Nothing else.

## Pre-flight (human, before stratum 3.A starts)

1. **Docker Desktop running.** Supabase CLI uses Docker for the local Postgres stack. Verify with `docker ps`.
2. **No in-flight branches.** `git branch -vv` shows only `main` (or `main` + the SCAFFOLD.2 branch you're about to create). Stale branches confuse Claude Code's context.
3. **Repo at `~/code/zugzwang/experiment`.** Per memory #15. Not `~/Desktop/`.

## Exit criteria (full-task)

- [ ] All 21 tables in 11 schema files declare with UUIDv7 PKs per ADR-0016 D3
- [ ] All 5 migrations apply cleanly to a fresh Postgres 17 DB in numerical order, zero errors
- [ ] All 13 trigger test files pass; ≥35 cases total per SPEC.2 §6.6 floor
- [ ] INV-4 canonical integration test (`I-APPEND-ONLY-001`) passes
- [ ] 41 F-\* skeleton files exist with the 6-section template
- [ ] `just verify` passes (typecheck + biome + build, no DB needed)
- [ ] `just test-db` passes (with Supabase local stack running)
- [ ] `git log` shows 5 PRs (one per stratum) merged into `main`
- [ ] `docs/logs/SCAFFOLD.2.md` close-out summary committed

---

# Stratum 3.A — Setup + F-\* skeletons

**Goal:** repo is ready for schema work. Drizzle, drizzle-kit, drizzle-zod, postgres driver, vitest, supabase CLI all installed and configured. F-\* skeletons exist so downstream tasks have stable file paths from day 1.

**Branch:** `feat/scaffold-2-stratum-a`
**PR title:** `feat(scaffold-2): a — drizzle + supabase + flow skeletons`

## Claude Code session prompt

```
ultrathink. SCAFFOLD.2 stratum 3.A. Read docs/plans/SCAFFOLD.2.md
in full. Execute stratum 3.A only. Open a draft PR when complete.
Stop on any uncertainty about scope, file shape, or version pin.
```

## Files to create

| Path | Purpose |
|---|---|
| `drizzle.config.ts` | drizzle-kit configuration |
| `src/db/index.ts` | Drizzle client instance with `import 'server-only'` |
| `.env.example` | local-dev `DATABASE_URL` template, comments referencing SCAFFOLD.13 |
| `docs/specs/flows/README.md` | names §13 contract authority |
| `docs/specs/flows/F-*.md` × 40 | empty 6-section skeletons (see template below) |

## Files to edit

| Path | Edit |
|---|---|
| `package.json` | add 7 dependencies (see version pins below) |
| `mise.toml` | add `supabase` tool pin |
| `justfile` | add 4 db recipes (see below) |

## Dependency version pins

Add to `package.json`. **Do not bump majors during install** — pin to these floors and accept patch updates only:

```jsonc
{
  "dependencies": {
    "drizzle-orm": "^0.45.0",
    "drizzle-zod": "^0.7.0",
    "postgres": "^3.4.5",
    "uuid": "^11.0.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.0",
    "vitest": "^3.0.0",
    "@types/uuid": "^10.0.0"
  }
}
```

Run `pnpm install` after. Expect: lockfile updates, ~30 packages added, no warnings beyond the pnpm 10 build-script ignored notice (already addressed in pre-flight per `lefthook` + `sharp` approval).

**Lockfile verification:** the diff to `pnpm-lock.yaml` should show only the 7 new packages plus their transitive deps. If the diff shows churn in unrelated packages, stop and surface — that's a pnpm version mismatch or a stale lockfile.

## `mise.toml` addition

Append to existing `[tools]` section:

```toml
supabase = "latest"
```

Run `mise install` after. Verify with `supabase --version`.

(Reasoning: pinning `latest` rather than a specific version is acceptable here because the Supabase CLI is local-dev only — production never sees it. If reproducibility bites, pin to current at HARDEN.10.)

## `justfile` recipe additions

Append to existing `justfile`. Maintain kebab-case naming consistent with existing recipes:

```just
# Generate a Drizzle migration from schema diff
db-generate name:
    pnpm drizzle-kit generate --name {{name}}

# Apply pending migrations to the configured DATABASE_URL
db-migrate:
    pnpm drizzle-kit migrate

# Reset local Supabase DB. Destroys local data.
db-reset:
    supabase db reset

# Run trigger + invariant tests against local Postgres
test-db:
    pnpm vitest run tests/db/ tests/invariants/
```

**Do not modify `verify`.** It stays at `typecheck check build` — DB-free, always-runnable. Pre-PR ritual for schema-changing work is `just verify && just test-db` with `supabase start` running.

## `drizzle.config.ts` shape

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // events table is hand-written (PARTITION BY RANGE) per ADR-0005 §5.
  // Excluded from drizzle-kit auto-generation; ships in 0002_events_partitioning.sql.
  tablesFilter: ["!events"],
  casing: "snake_case",
  strict: true,
  verbose: true,
});
```

## `src/db/index.ts` shape

```typescript
import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, {
  // Single connection for now; pool config lands at HARDEN.* if needed.
  max: 10,
});

export const db = drizzle(client, { schema });
export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
```

The `DbTransaction` type alias is non-trivial; downstream tasks (ENGINE.7's `bets/transaction.ts`) consume it.

## `.env.example` shape

```
# Local-dev database URL. Points at the Supabase CLI local stack.
# Run `supabase start` once; copy the printed "DB URL" line to .env.local.
# Production / staging URLs land via SCAFFOLD.13 (Vercel env vars + Doppler).
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

## F-\* skeleton template

Every file at `docs/specs/flows/F-*.md` uses this template verbatim, with `<F-XXX-N>` and `<title placeholder>` substituted:

```markdown
# F-XXX-N — <title placeholder>

> **Status:** skeleton (substance pending per SPEC.2 §13.4 gating cadence).

## Pre

<placeholder>

## System

<placeholder>

## Response

<placeholder>

## Errors

<placeholder>

## Invariants

<placeholder>

## Acceptance

<placeholder>
```

## F-\* file enumeration

**Before generating skeletons,** Claude Code MUST:

1. Read SPEC.1 §7–§15 (per-flow contracts) and SPEC.2 §4 (API surface catalogue).
2. Enumerate every distinct `F-<family>-<n>` identifier referenced.
3. Confirm count = 40 per SPEC.2 §13.4. If count ≠ 40, **stop and surface to Hrishikesh.** Do not generate fewer or more.
4. Group by family for the skeleton-creation loop:

| Family | Expected count (from prior chat-3 derivation) | SPEC.1 anchor |
|---|---|---|
| F-AUTH | 6 | §13 |
| F-BET | 9 | §7 |
| F-COMMENT | 8 | §8 |
| F-RESOLVE | 3 | §11 |
| F-MOD | 4 | §14 |
| F-DEBATE | 3 | §9 |
| F-ADMIN | 4 | §15 |
| **Total prior estimate** | **37** | — |
| **Spec-mandated** | **40** | SPEC.2 §13.4 |

The 3-file gap is real and must be resolved before generation. Likely candidates: F-MOD has more variants than I tracked, or F-COMMENT-9 exists for image-uploads, or F-AUTH includes a re-entry case I missed.

## `docs/specs/flows/README.md`

```markdown
# Per-flow contract files

This directory holds the 40 per-flow contract files in v1, one per `F-<family>-<n>` identifier referenced in SPEC.1 §7–§15 and SPEC.2 §4.

**Authority:** SPEC.2 §13 names the six-field contract template (Pre / System / Response / Errors / Invariants / Acceptance). Substance fills per the gating-task cadence in SPEC.2 §13.4 — do not write substance ahead of the gating task.

**Skeletons** were minted in SCAFFOLD.2 stratum 3.A. The empty 6-section files are placeholders; the gating task for each family fills the substance.
```

## Verification (3.A)

Before opening the PR, Claude Code runs:

```bash
just verify              # typecheck + biome + build all green
ls -la docs/specs/flows/ | wc -l    # expect 41 entries (40 files + 1 README + . + ..)
cat package.json | grep -E "drizzle|postgres|uuid|vitest" | wc -l   # expect 7+
mise current             # expect node, pnpm, just, supabase
```

## Commit message

```
feat(scaffold-2): a — drizzle + supabase + flow skeletons

- Add drizzle-orm + drizzle-zod + drizzle-kit + postgres driver
- Add vitest + uuid + types
- Add supabase CLI via mise
- Add 4 db recipes to justfile (db-generate, db-migrate, db-reset, test-db)
- Mint drizzle.config.ts excluding events table from auto-generation
- Mint src/db/index.ts with server-only Drizzle client
- Mint .env.example with local-dev DATABASE_URL template
- Mint 40 empty F-*.md flow skeletons + README at docs/specs/flows/

Schema, migrations, triggers, tests in subsequent strata.

Refs: SCAFFOLD.2, ADR-0008, ADR-0016, SPEC.2 §13.4
```

## Manual review gate (Hrishikesh + Claude in chat)

- All 7 deps land at the right version pins
- `drizzle.config.ts` has `tablesFilter: ["!events"]`
- `src/db/index.ts` has `import "server-only"` as the **first** statement
- 40 F-\* files exist, named consistently, each with the 6-section template
- `mise current` shows supabase
- `just verify` green

After merge: `/clear`. Move to 3.B.

---

# Stratum 3.B — Schema (Drizzle TypeScript)

**Goal:** all 21 tables declared in 11 per-domain schema files. Type inference works (`typeof users.$inferSelect`). drizzle-zod schemas co-located. The `events` table is declared (for type inference) even though its DDL ships hand-written in 3.C.

**Branch:** `feat/scaffold-2-stratum-b`
**PR title:** `feat(scaffold-2): b — drizzle schemas (21 tables, 9 domains)`

## Claude Code session prompt

```
ultrathink. SCAFFOLD.2 stratum 3.B. Read docs/plans/SCAFFOLD.2.md
in full. Execute stratum 3.B only. Open a draft PR when complete.
Each schema file: declare table per SPEC + ADRs, co-locate drizzle-zod
schemas per ADR-0008 §5, verify type inference. Stop on any
uncertainty about column shape, FK target, or whitelisted-transition
column for Bucket B.
```

## Universal column conventions (apply to every table)

```typescript
import { sql } from "drizzle-orm";
import { pgTable, uuid, timestamp, numeric, text } from "drizzle-orm/pg-core";

// Universal PK pattern (ADR-0016 D3):
id: uuid("id").primaryKey().default(sql`uuidv7()`),

// Universal createdAt (SPEC.2 §5.3):
createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

// Dharma columns (ADR-0008 §8 + SPEC.1 §16.1):
balance: numeric("balance", { precision: 38, scale: 18 }).notNull(),
```

**No `serial`. No `gen_random_uuid()`. No `crypto.randomUUID()`.** Every PK uses the UUIDv7 default expression. CI lint catches drift later (HARDEN.\* territory); for now, discipline.

## drizzle-zod co-location pattern (ADR-0008 §5)

Every table file ends with:

```typescript
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const insertUsersSchema = createInsertSchema(users);
export const selectUsersSchema = createSelectSchema(users);
// ... one pair per table in this file
```

**Exception:** `events.payload` is JSONB. drizzle-zod types it as "any JSON" which is wrong — but the per-event-type schemas are ENGINE.6's responsibility, not SCAFFOLD.2's. Generate the drizzle-zod schemas for `events` anyway; ENGINE.6 layers its hand-written schemas on top.

## Per-file table inventory

Each row: which file, which tables, which bucket, which ADRs/SPECs to consult for column shape.

### `src/db/schema/auth.ts` — 5 tables, Bucket C

| Table | SoT for column shape |
|---|---|
| `users` | ADR-0004 (Better Auth `user` shape) + ADR-0011 (pseudonym + colour/animal/number) + ADR-0016 D4 (uuid id override) + SPEC.1 §13 F-AUTH-3/4 (ToS evidence cols) + SPEC.1 §15 (last_allowance_accrued_at) + §14 (banned_at) + §16.5 H2 (erased_at + PII-stripped fields) |
| `sessions` | ADR-0004 (Better Auth `session` shape) + ADR-0016 D4 (uuid id override; session.token untouched) |
| `accounts` | ADR-0004 (Better Auth `account` shape — OAuth provider linkage) + ADR-0016 D4 |
| `verifications` | ADR-0004 (Better Auth Email-OTP storage; replaces dropped `otp_codes`) + ADR-0016 D4 |
| `admin_sessions` | ADR-0010 (3-column hand-rolled: session_id, issued_at, last_seen_at) + ADR-0016 D5 |

**Critical:** `bets.comment_id` FK target is `comments.id`. Comments must be declarable before bets at the type level OR use Drizzle's `relations()` deferred references. Per ADR-0008 §6.1, **explicit `.references(() => comments.id)` lambda form** — handles circular references cleanly.

### `src/db/schema/markets.ts` — 2 tables, Bucket C

| Table | SoT |
|---|---|
| `markets` | ADR-0005 §3 (Bucket C; whitelisted-Bucket-C status update during W-3) + SPEC.1 §6 (state machine: Draft, Open, Closed, Resolving, Resolved, Voided, Frozen) |
| `pools` | ADR-0005 + ADR-0013 (locked first in W-1 lock-order chain via FOR NO KEY UPDATE) + SPEC.1 §6.1 / §10 (yes_reserves, no_reserves, k constant, pool_seed) |

### `src/db/schema/bets.ts` — 2 tables

| Table | Bucket | SoT |
|---|---|---|
| `bets` | A | ADR-0005 + ADR-0013; `comment_id NOT NULL FK → comments.id` per CLAUDE.md §2 INV-1 |
| `positions` | C | ADR-0005 + ADR-0009 (per-user-per-market position cache, updated synchronously in bet transaction) |

### `src/db/schema/comments.ts` — 2 tables

| Table | Bucket | SoT |
|---|---|---|
| `comments` | A | ADR-0005 + ADR-0009 (carries `stake_at_post_time NUMERIC(38,18) NOT NULL` frozen on insert) + SPEC.1 §8 INV-3 (side_at_post_time immutable) |
| `friendly_fire_events` | B | ADR-0005 (whitelisted: `frozen_at` NULL → timestamp) + ADR-0009 (`cleared_at` schema decided here — see decision below) + SPEC.1 §8 F-COMMENT-6/7/8 |

**ADR-0009-deferred decision: `friendly_fire_events.cleared_at` shape.** Per ADR-0009, SCAFFOLD.2 picks. **Decision: nullable timestamp.** Same shape as `frozen_at`. Two reasons:
1. Symmetry — both flags read identically (`WHERE frozen_at IS NULL AND cleared_at IS NULL`).
2. Bucket B trigger pattern in §6.3 generalises cleanly to a second whitelisted column with the same NULL-to-timestamp semantics.

This pushes `friendly_fire_events` from "single whitelisted transition" to "two independent whitelisted transitions" — both `frozen_at` and `cleared_at` NULL → timestamp, independently. The Bucket B trigger function for this table needs to permit either column transitioning while rejecting both transitioning together (they're independent events) and rejecting any other column changes.

**Document this in a same-commit ADR amendment to ADR-0009** (one-line update to the "schema deferred to SCAFFOLD.2" clause: "SCAFFOLD.2 ratified `cleared_at` as nullable timestamp with independent NULL → timestamp transition discipline"). Append-only to ADR-0009; new line at the bottom of "Decision Outcome."

### `src/db/schema/dharma.ts` — 1 table, Bucket A

`dharma_ledger`. Per ADR-0005 + SPEC.1 INV-2. Columns include the flow-tag enum (`bet_stake`, `bet_settle`, `daily_allowance`, `pool_seed`, `pool_unwind`, `correction_reverse`, `correction_apply`, `void_refund`). NUMERIC(38,18) for amount.

**The flow-tag column is a `pgEnum` per AGENTS.md §6.** Define alongside the table.

### `src/db/schema/events.ts` — 3 tables

| Table | Bucket | SoT |
|---|---|---|
| `events` | A | ADR-0005 §5 (8-column shape) + ADR-0016 (event_id is uuid PK with uuidv7 default) |
| `resolution_events` | A | ADR-0005 + SPEC.1 §11 INV-4 (`corrects_event_id` references prior `resolution_events.id`) |
| `payout_events` | A | ADR-0005 + §3.6 (one row per bet settlement; F-RESOLVE-2 writes paired correction_reverse + correction_apply rows) |

**Critical:** the `events` Drizzle declaration is for type inference + drizzle-zod only. The actual DDL ships in 3.C's `0002_events_partitioning.sql`. The `tablesFilter: ["!events"]` in `drizzle.config.ts` handles this.

### `src/db/schema/identity.ts` — 1 table, Bucket B

`identity_pool`. Per ADR-0011 (50K-row shape: colour text, animal text, number text/integer, pfp_filename text) + ADR-0005 (assigned_at NULL → timestamp whitelisted) + ADR-0016 D5 (synthetic UUIDv7 PK + UNIQUE(colour, animal, number)).

### `src/db/schema/image-uploads.ts` — 1 table, Bucket B

`image_uploads`. Per ADR-0014 + SPEC.2 §12 (`terminal_state` + `terminal_at` two-column atomic transition). Columns include `r2_object_key`, `user_id` FK, `terminal_state` enum (`committed | orphan | blocked`), `terminal_at` nullable timestamp.

### `src/db/schema/audit.ts` — 3 tables, Bucket A

| Table | SoT |
|---|---|
| `mod_actions` | ADR-0014 (action, reason, AI category, confidence, override history; image_r2_key linkage) |
| `admin_events` | ADR-0010 (admin-actor encoding: metadata.user_id NULL, actor_id 'admin-singleton') |
| `user_events` | ADR-0005 (user lifecycle: ToS acceptance, pseudonym assignment, daily-allowance accrual; replaces dropped daily_allowance_events) |

### `src/db/schema/system.ts` — 1 table, Bucket B

`system_state`. Per SPEC.2 §20.2 (single-row keyed by id='system', frozen_at NULL → timestamp).

## Index requirements (from ADR-0009 + ADR-0005)

These are flagged in the schema files explicitly via Drizzle's index API (second arg to `pgTable`):

```typescript
// In events.ts — ADR-0005 §5:
(events) => ({
  aggregateLookupIdx: index("events_aggregate_lookup_idx")
    .on(events.aggregateType, events.aggregateId, events.createdAt),
})
```

Note: this index is declared in the schema for type-level documentation, but the actual `CREATE INDEX` ships in `0002_events_partitioning.sql` since the events table itself is hand-written.

```typescript
// In comments.ts — ADR-0009 (debate-view ranking aggregations):
(comments) => ({
  parentSideIdx: index("comments_parent_side_idx")
    .on(comments.parentCommentId, comments.sideAtPostTime),
})

// In comments.ts (friendly_fire_events) — ADR-0009:
(friendlyFireEvents) => ({
  rankingAggregationIdx: index("friendly_fire_ranking_idx")
    .on(friendlyFireEvents.commentId, friendlyFireEvents.frozenAt, friendlyFireEvents.clearedAt),
})
```

**FK indexes are mandatory per AGENTS.md §6** — every column with a `.references(...)` declaration gets an index. Drizzle does not auto-create these; declare them in the schema.

## Verification (3.B)

```bash
just verify              # typecheck must pass; type inference works for every table

# Spot-check inference on one table:
# In a scratch file, write:
#   const u: typeof users.$inferSelect = ... ;
#   const i: typeof users.$inferInsert = ... ;
# Compile error iff schema is malformed.
```

## Commit message

```
feat(scaffold-2): b — drizzle schemas (21 tables, 9 domains)

- 11 schema files at src/db/schema/<domain>.ts per ADR-0008 §4
- All PKs uuid().primaryKey().default(sql`uuidv7()`) per ADR-0016 D3
- drizzle-zod insert/select schemas co-located per ADR-0008 §5
- ADR-0009 ratification: friendly_fire_events.cleared_at = nullable timestamp
- Indexes per ADR-0005 §5 + ADR-0009 (FK indexes mandatory per AGENTS.md §6)
- events table declared for type inference; DDL ships in 3.C migration

Migrations + triggers + tests in subsequent strata.

Refs: SCAFFOLD.2, ADR-0005, ADR-0008, ADR-0009, ADR-0016, SPEC.2 §5
```

## Manual review gate

- 11 schema files exist; 21 tables across them
- Every PK declaration matches `uuid("id").primaryKey().default(sql\`uuidv7()\`)`
- Every Bucket B table's whitelisted column is the right one
- `bets.comment_id` is `NOT NULL` with FK to `comments.id`
- ADR-0009 has the new ratification line appended (same commit)
- `just verify` green
- No imports from `src/server/`, no Server Actions, no handler code

After merge: `/clear`. Move to 3.C.

---

# Stratum 3.C — Migrations (5 SQL files)

**Goal:** every table created, partitioned, and triggered. Migrations apply cleanly in order against a fresh Postgres 17 DB. The events table partitions exist. The 13 protected tables have BEFORE UPDATE + BEFORE DELETE triggers.

**Branch:** `feat/scaffold-2-stratum-c`
**PR title:** `feat(scaffold-2): c — migrations (uuidv7 + schema + partitioning + triggers + seed)`

## Claude Code session prompt

```
ultrathink. SCAFFOLD.2 stratum 3.C. Read docs/plans/SCAFFOLD.2.md
in full. Execute stratum 3.C only. The 5 migrations must apply
cleanly in numerical order against a fresh DB. Open a draft PR
when complete. Stop on any uncertainty about trigger SQL,
partition DDL, or migration ordering.
```

## Pre-stratum checks

- Stratum 3.B merged (schema files exist).
- `supabase start` running locally; `.env.local` populated.
- `supabase db reset` runs cleanly against the empty schema.

## Migration order (ABSOLUTE — do not reorder)

| # | File | Source | Why this order |
|---|---|---|---|
| 0000 | `0000_uuidv7_function.sql` | hand-written | Must exist before any `DEFAULT uuidv7()` resolves |
| 0001 | `0001_initial_schema.sql` | drizzle-kit | Creates 20 tables (all except `events`) using uuidv7 default |
| 0002 | `0002_events_partitioning.sql` | hand-written | Creates partitioned `events` table — Drizzle can't express PARTITION BY |
| 0003 | `0003_append_only_triggers.sql` | hand-written | Triggers reference all 13 protected tables; tables must exist first |
| 0004 | `0004_seed_system_state.sql` | hand-written | Inserts the singleton `system_state` row |

## Migration 0000 — `0000_uuidv7_function.sql`

**Source:** kjmph gist's pure-SQL variant per ADR-0016 §1. Adapted from `gist.github.com/kjmph/5bd772b2c2df145aa645b837da7eca74`.

**Required header comment:**

```sql
-- public.uuidv7() — RFC 9562 UUIDv7 generator
-- Copyright (C) The Zugzwang Authors. AGPL-3.0-or-later.
-- Adapted from a community gist; original author Fabio Lima.
-- When Postgres 18 native uuidv7() ships on Supabase, drop this function
-- with `DROP FUNCTION public.uuidv7()` and pg_catalog.uuidv7() takes over
-- with no schema changes required (per ADR-0016 §2).

CREATE OR REPLACE FUNCTION public.uuidv7()
RETURNS uuid
LANGUAGE sql
VOLATILE
AS $$
  -- ... pure-SQL body from the kjmph gist's pure-SQL variant ...
$$;
```

**Critical:** `LANGUAGE sql` not plpgsql; `VOLATILE` not STABLE/IMMUTABLE; uses `clock_timestamp()` not `now()`. All three per ADR-0016 §1.

**Down migration:** corresponding `down.sql` (if Drizzle's migration framework requires it) is `DROP FUNCTION IF EXISTS public.uuidv7();`. Per ADR-0008 §6 append-only discipline, no down-migrations are run in production; this is documentation only.

## Migration 0001 — `0001_initial_schema.sql`

**Source:** drizzle-kit-generated. Run:

```bash
pnpm drizzle-kit generate --name initial-schema
```

The `tablesFilter: ["!events"]` in `drizzle.config.ts` excludes `events`. Output should include 20 `CREATE TABLE` statements + indexes + FK constraints + enum types.

**Verification before commit:**

```bash
# Verify uuidv7 default emits correctly:
grep -c "DEFAULT uuidv7()" drizzle/migrations/0001_initial_schema.sql
# Expect: ~20 (one per non-events table)

# Verify events is NOT in this migration:
grep -c "CREATE TABLE.*events" drizzle/migrations/0001_initial_schema.sql
# Expect: 0 (events ships in 0002)

# Verify FK constraints land:
grep -c "REFERENCES" drizzle/migrations/0001_initial_schema.sql
# Expect: at minimum the bets.comment_id FK + every other declared .references()
```

If any check fails, the schema files have drift; fix in a 3.B-erratum PR before continuing.

## Migration 0002 — `0002_events_partitioning.sql`

**Hand-written.** Creates the `events` table with `PARTITION BY RANGE (created_at)`, then 12 monthly partitions, then DEFAULT partition, then the lookup index.

**Required structure:**

```sql
-- events — canonical audit ledger per ADR-0005 §5 + SPEC.2 §7
-- Hand-written because Drizzle's table builder cannot express PARTITION BY RANGE.
-- Type inference is provided by src/db/schema/events.ts via drizzle-zod;
-- this DDL is the storage-layer truth.

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

-- 12 monthly partitions covering the experiment window + tail (2026-05 to 2027-04).
CREATE TABLE events_2026_05 PARTITION OF events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE events_2026_06 PARTITION OF events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
-- ... (continue for 2026-07 through 2027-04) ...
CREATE TABLE events_2027_04 PARTITION OF events
  FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');

-- DEFAULT partition catches out-of-range writes (operational error condition).
-- Sentry alarm 2 (per SPEC.2 §17) fires on any insert here.
CREATE TABLE events_default PARTITION OF events DEFAULT;

-- Per-aggregate event-stream lookup index per ADR-0005 §5.
CREATE INDEX events_aggregate_lookup_idx
  ON events (aggregate_type, aggregate_id, created_at);
```

## Migration 0003 — `0003_append_only_triggers.sql`

**Hand-written.** Per SPEC.2 §6.2 (Bucket A pattern) + §6.3 (Bucket B per-table functions).

**Structure:**

1. Two shared functions for Bucket A (`enforce_bucket_a_no_update`, `enforce_bucket_a_no_delete`) — per SPEC.2 §6.2.
2. Two triggers per Bucket A table × 9 tables = 18 trigger declarations.
3. Four per-table functions for Bucket B — per SPEC.2 §6.3:
   - `enforce_friendly_fire_events_transitions` (TWO independent whitelisted columns: `frozen_at`, `cleared_at` — per the SCAFFOLD.2 ratification of ADR-0009)
   - `enforce_identity_pool_assigned_at`
   - `enforce_image_uploads_terminal_atomic` (two-column atomic transition per SPEC.2 §6.3 example)
   - `enforce_system_state_frozen_at`
4. Two triggers per Bucket B table × 4 tables = 8 trigger declarations (BEFORE UPDATE calling the per-table function + BEFORE DELETE raising unconditionally).

**Total:** 6 functions + 26 trigger declarations.

**Reference source:** SPEC.2 §6.2 has the literal Bucket A function bodies. SPEC.2 §6.3 has the `image_uploads` function as an example; the other three Bucket B functions follow the same pattern parameterised on the whitelisted column(s).

**Critical:** the `friendly_fire_events` function permits **either** `frozen_at` **or** `cleared_at` transitioning, but **not both in the same UPDATE**. They are independent events. Test cases for this in 3.D verify the discipline.

## Migration 0004 — `0004_seed_system_state.sql`

```sql
-- system_state singleton row mint per SPEC.2 §20.2.
-- The row exists from day 1 of the experiment with frozen_at = NULL;
-- the conclusion-event freeze is the single UPDATE that flips frozen_at to a timestamp.

INSERT INTO system_state (id, frozen_at) VALUES ('system', NULL);
```

If `system_state.id` is a uuid PK, this fails — the id must be a text/varchar `'system'` per SPEC.2 §20.2 ("single-row keyed by id = 'system'"). **Schema in 3.B's `system.ts` must use text id, not uuid id, for this single table.** ADR-0016 D6 doesn't preclude this; the URL-exposure rule applies to participant routes, and `system_state` is admin-internal.

**This is a SCAFFOLD.2 carve-out from the universal UUIDv7 PK rule.** Document with a `-- carve-out:` comment in `system.ts`. Add same-commit ADR-0016 amendment one-liner: "SCAFFOLD.2 carve-out: `system_state.id` is text `'system'` per SPEC.2 §20.2 single-row sentinel discipline. Universal UUIDv7 rule applies to all other tables."

## Verification (3.C)

```bash
# Reset DB:
just db-reset

# Apply migrations:
just db-migrate

# Verify all 21 tables exist:
psql "$DATABASE_URL" -c "\dt" | grep -cE "^public\."
# Expect: 21 (or 33 if including events partitions)

# Verify uuidv7() function exists:
psql "$DATABASE_URL" -c "SELECT uuidv7();"
# Expect: a single uuid value

# Verify events partitioning:
psql "$DATABASE_URL" -c "\d+ events" | grep -c "Partitions:"
# Expect: 1 (with 13 partition lines below it: 12 monthly + 1 default)

# Verify trigger count on protected tables:
psql "$DATABASE_URL" -c "
  SELECT count(*) FROM pg_trigger
  WHERE tgrelid IN (SELECT oid FROM pg_class WHERE relname IN
    ('events', 'dharma_ledger', 'bets', 'comments', 'resolution_events',
     'payout_events', 'mod_actions', 'admin_events', 'user_events',
     'friendly_fire_events', 'identity_pool', 'image_uploads', 'system_state'))
  AND NOT tgisinternal;
"
# Expect: 26 (13 protected tables × 2 triggers)

# Verify system_state row:
psql "$DATABASE_URL" -c "SELECT * FROM system_state;"
# Expect: id='system', frozen_at=NULL, created_at=<recent>
```

## Commit message

```
feat(scaffold-2): c — migrations (5 SQL files, ordered)

- 0000: uuidv7() PL/pgSQL function (kjmph gist pure-SQL variant)
- 0001: initial schema (drizzle-kit generated; 20 tables; events excluded)
- 0002: events table with PARTITION BY RANGE (12 monthly + DEFAULT)
- 0003: append-only triggers (13 protected tables, 26 trigger declarations,
        6 functions); friendly_fire_events permits two independent
        whitelisted transitions per ADR-0009 ratification
- 0004: system_state singleton row mint (id='system', frozen_at NULL)

ADR amendments (same commit):
- ADR-0009: cleared_at = nullable timestamp; independent transition
- ADR-0016: system_state.id text carve-out (single-row sentinel)

Tests in 3.D.

Refs: SCAFFOLD.2, ADR-0005, ADR-0008, ADR-0009, ADR-0016, SPEC.2 §6, §7
```

## Manual review gate

- 5 migration files exist, ordered 0000–0004
- 0000 has the AGPL header comment + RFC 9562 attribution
- 0001 is drizzle-kit-generated (no manual edits)
- 0002 has 12 monthly partitions + DEFAULT + the index
- 0003 has 6 functions + 26 trigger declarations
- 0003 `friendly_fire_events` function handles two independent transitions
- 0004 has the singleton INSERT
- ADR-0009 + ADR-0016 amendments are in the same commit
- All verification queries pass

After merge: `/clear`. Move to 3.D.

---

# Stratum 3.D — Tests

**Goal:** the storage-layer enforcement contract is verified by automated tests. 13 trigger test files cover all protected tables. The INV-4 canonical integration test passes. ≥35 cases total.

**Branch:** `feat/scaffold-2-stratum-d`
**PR title:** `feat(scaffold-2): d — trigger tests (13 files, 35+ cases) + INV-4 canonical`

## Claude Code session prompt

```
ultrathink. SCAFFOLD.2 stratum 3.D. Read docs/plans/SCAFFOLD.2.md
in full. Execute stratum 3.D only. Each test file: bypass app
layer per SPEC.2 §6.6, raw Drizzle insert/update/delete, expect
trigger errors with specific SQLSTATE matches. Open a draft PR
when complete. Tests run in transactions that roll back per
AGENTS.md §8.
```

## Files

| Path | Purpose |
|---|---|
| `vitest.config.ts` (root) | minimal vitest config; test envs; per-test timeout |
| `tests/db/_fixtures/db.ts` | test DB connection helper (raw Drizzle, bypasses app layer) |
| `tests/db/triggers/*-append-only.spec.ts` × 13 | per-table trigger tests |
| `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts` | INV-4 canonical |

## `vitest.config.ts` shape

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,           // explicit imports only per AGENTS.md §4
    testTimeout: 10_000,      // 10s per test; trigger tests are fast (< 100ms each)
    hookTimeout: 10_000,
    isolate: true,            // each file gets its own Vitest context
    pool: "forks",            // process-isolation; matches integration-test orthodoxy
    coverage: {
      enabled: false,         // coverage is HARDEN.* territory
    },
    include: ["tests/**/*.{test,spec}.ts"],
  },
});
```

## `tests/db/_fixtures/db.ts` shape

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

// Tests bypass the app-layer client at src/db/index.ts because that file
// has `import 'server-only'`. Tests run in Node, not "server", and need
// a separate connection. Per SPEC.2 §6.6.

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL not set; tests cannot connect");
}

export const testClient = postgres(connectionString, { max: 1 });
export const testDb = drizzle(testClient, { schema });
export type TestDb = typeof testDb;
```

## Per-table test floor

Per SPEC.2 §6.6 — minimum cases per bucket. Test files exceeding the floor are fine; below it is under-tested.

### Bucket A tests (9 files × 2 cases = 18)

Each file pattern:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sql } from "drizzle-orm";
import { testDb, testClient } from "../_fixtures/db";
import { events } from "@/db/schema";   // example for events.spec

describe("events — append-only trigger", () => {
  beforeEach(async () => {
    await testClient.begin();   // Per AGENTS.md §8 — wrap in transaction
  });
  afterEach(async () => {
    await testClient.savepoint("rollback").rollback();
  });

  it("rejects UPDATE with append-only-violation error", async () => {
    // Insert a row.
    const inserted = await testDb.insert(events).values({ ... }).returning();

    // Attempt UPDATE — must throw.
    await expect(
      testDb.update(events).set({ payload: {} }).where(sql`event_id = ${inserted[0].eventId}`)
    ).rejects.toThrow(/append-only violation/);
  });

  it("rejects DELETE with append-only-violation error", async () => {
    // similar shape, but DELETE
  });
});
```

### Bucket B tests (4 files × ≥4 cases = 16+)

Each Bucket B file covers:
1. Whitelisted transition **accepted** (NULL → timestamp)
2. Non-whitelisted column update **rejected**
3. Re-firing the transition (already non-NULL) **rejected**
4. DELETE **rejected**

`image_uploads` adds:
5. Partial transition (only one of `terminal_state` / `terminal_at`) **rejected**
6. Reverse partial (only the other one) **rejected**

`friendly_fire_events` adds (per ADR-0009 ratification):
5. `frozen_at` transition alone **accepted**
6. `cleared_at` transition alone **accepted**
7. Both transitioning together **rejected**

### INV-4 canonical (1 file)

`tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts`

Per Appendix A. Verifies the four invariant from a higher level than the trigger tests:
1. `resolution_events` UPDATE rejected
2. `payout_events` UPDATE rejected
3. After insert, neither table accepts mutation
4. Replay-safety: storage idempotency on `event_id` PK works

(2-3 cases sufficient — the invariant is name-bound, not a comprehensive sweep. The trigger tests carry the per-table coverage.)

## Per-test transaction discipline (AGENTS.md §8)

Every test runs in a transaction that rolls back. Tests do not pollute each other. The trigger fires on the test's UPDATE/DELETE; the rollback after-hook returns the DB to a clean state.

**Critical:** the trigger fires inside the transaction. Rolling back the transaction does NOT prevent the trigger from firing — it just rolls back the side effects of whatever ran before the trigger raised.

## Fixture data discipline

Tests insert their own rows in `beforeEach` setup OR within the test body. **No shared fixtures, no seed data, no test ordering dependencies.** Each test is independent.

For tables with NOT NULL FK constraints (`bets.comment_id`, `payout_events.bet_id`, etc.), the test must insert the parent row first. This is just SQL plumbing; not a special pattern.

## Verification (3.D)

```bash
# All tests green:
just test-db
# Expect: 35+ tests passed, 0 failed, 0 skipped

# Specific count check:
pnpm vitest run tests/db/triggers/ --reporter=verbose | grep -c "✓"
# Expect: at least 33 (the SPEC.2 §6.6 floor)
```

## Commit message

```
feat(scaffold-2): d — trigger tests (13 files, 35+ cases) + INV-4

- 13 trigger test files at tests/db/triggers/<table>-append-only.spec.ts
- 1 invariant test at tests/invariants/I-APPEND-ONLY-001.*.spec.ts
- Test fixtures helper at tests/db/_fixtures/db.ts (bypasses app layer per §6.6)
- vitest.config.ts at repo root (minimal; coverage off)

Bucket A: 9 tables × 2 cases (UPDATE + DELETE) = 18
Bucket B: 4 tables × ≥4 cases = 16+
  - friendly_fire_events: +3 cases for two independent transitions
  - image_uploads: +2 cases for partial-transition rejection
INV-4: 3 cases (resolution_events + payout_events + storage idempotency)

Total: 35+ cases, ≥SPEC.2 §6.6 floor

Refs: SCAFFOLD.2, SPEC.2 §6.6, §14, AGENTS.md §8
```

## Manual review gate

- 13 trigger files + 1 invariant file + vitest.config.ts + fixture helper
- Each test runs in a rollback transaction
- No shared state across tests
- All tests green via `just test-db`
- Total case count ≥35

After merge: `/clear`. Move to 3.E.

---

# Stratum 3.E — Verify (no new files)

**Goal:** end-to-end confirmation that SCAFFOLD.2 is complete. Fresh DB → apply migrations → run all tests → green. Close-out summary committed.

**Branch:** `chore/scaffold-2-close`
**PR title:** `chore(scaffold-2): e — close-out + log`

## Claude Code session prompt

```
ultrathink. SCAFFOLD.2 stratum 3.E. Read docs/plans/SCAFFOLD.2.md
in full. Execute the full E2E verification chain. Write the
close-out log at docs/logs/SCAFFOLD.2.md. Open a draft PR.
```

## Verification chain

```bash
# 1. Reset DB (destructive — confirms migrations apply against truly-empty DB)
just db-reset

# 2. Apply all migrations:
just db-migrate
# Expect: 5 migrations applied, no errors

# 3. Verify table count:
psql "$DATABASE_URL" -c "
  SELECT count(*) FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE';
"
# Expect: 21 base tables (events partitions are children, not base tables)

# 4. Verify all 21 tables have uuid id (with system_state carve-out):
psql "$DATABASE_URL" -c "
  SELECT table_name, data_type FROM information_schema.columns
  WHERE column_name = 'id' AND table_schema = 'public'
  ORDER BY table_name;
"
# Expect: 20 rows showing uuid + 1 row showing text (system_state)

# 5. Verify trigger count:
psql "$DATABASE_URL" -c "
  SELECT count(*) FROM pg_trigger
  WHERE NOT tgisinternal AND tgrelid::regclass::text IN
    ('events', 'dharma_ledger', 'bets', 'comments', 'resolution_events',
     'payout_events', 'mod_actions', 'admin_events', 'user_events',
     'friendly_fire_events', 'identity_pool', 'image_uploads', 'system_state');
"
# Expect: 26

# 6. Verify events partitioning:
psql "$DATABASE_URL" -c "
  SELECT count(*) FROM pg_inherits
  WHERE inhparent = 'events'::regclass;
"
# Expect: 13 (12 monthly + 1 default)

# 7. Run full test suite:
just verify          # typecheck + biome + build
just test-db         # 35+ trigger + invariant cases

# 8. Run an end-to-end uuidv7 sanity check:
psql "$DATABASE_URL" -c "SELECT uuidv7(), uuidv7();"
# Expect: two distinct uuid values, both starting with the same time-prefix bytes
```

## Close-out log: `docs/logs/SCAFFOLD.2.md`

```markdown
# SCAFFOLD.2 close-out

> Closed: <YYYY-MM-DD>
> PRs: #N (3.A), #N+1 (3.B), #N+2 (3.C), #N+3 (3.D), #N+4 (3.E)
> Branch convention: `feat/scaffold-2-stratum-<a|b|c|d>` + `chore/scaffold-2-close`

## What landed

- 11 Drizzle schema files; 21 tables across 9 domains per SPEC.2 §5
- 5 migrations (uuidv7 function, initial schema, events partitioning, append-only triggers, system_state seed)
- 13 trigger test files + 1 INV-4 canonical = 35+ cases per SPEC.2 §6.6
- 41 F-* skeleton files (40 contract files + README) per SPEC.2 §13.4
- vitest.config.ts + tests/db/_fixtures/db.ts test infra
- 4 db recipes added to justfile
- 7 npm deps added (drizzle-orm, drizzle-zod, drizzle-kit, postgres, uuid, vitest, @types/uuid)
- supabase CLI pinned in mise.toml

## ADR amendments (same-commit, in 3.C)

- ADR-0009 §Decision Outcome: `friendly_fire_events.cleared_at` ratified as nullable timestamp; two independent whitelisted transitions
- ADR-0016 §Decision Outcome: `system_state.id` text carve-out for single-row sentinel discipline

## Carve-outs from universal patterns

- `system_state.id` is text `'system'`, not uuid (single-row sentinel per SPEC.2 §20.2)
- `events` table DDL is hand-written in 0002 (Drizzle can't express PARTITION BY); type inference comes from `src/db/schema/events.ts` via drizzle-zod

## Verification

- ✓ `just verify` green (typecheck + biome + build)
- ✓ `just test-db` green (35+ cases)
- ✓ All 5 migrations apply cleanly to fresh DB
- ✓ 21 tables; 26 triggers; 13 events partitions
- ✓ INV-4 canonical integration test passes

## What's NOT in this task (deferred to other tasks)

- Decimal arithmetic library choice → ENGINE.5
- Better Auth wiring (config, session-deferral hook) → SCAFFOLD.3
- Bet transaction wrapper → ENGINE.7
- Events insert helper + per-event-type Zod schemas → ENGINE.6
- Pseudonym pool consumer → SCAFFOLD.3
- Identity-pool data load → SCAFFOLD.17
- F-* substance fills → per SPEC.2 §13.4 gating cadence

## Project knowledge update table

| File | Current state | Action | Reason |
|---|---|---|---|
| SPEC_2.md | locked anchor v0.3-draft | Keep | unchanged |
| SCAFFOLD_2.md (this plan) | new | Add | task plan, archival reference |
| SCAFFOLD_2_log.md | new | Add | task close-out (Tier 2 rolling) |
| 0009-ranking-function.md | amended | Verify currency | re-upload after amendment |
| 0016-id-schema-uuidv7.md | amended | Verify currency | re-upload after amendment |
| zugzwang_experiment_tracker_v6.html | tracker | Keep (stale) | Hrishikesh updates separately |

## Next task

SCAFFOLD.3 — Auth wiring (Better Auth + Google OAuth + email-OTP + admin path).
```

## PR title for 3.E

```
chore(scaffold-2): e — close-out log + verification
```

## Manual review gate (final task close)

- All E2E verification checks pass
- `docs/logs/SCAFFOLD.2.md` exists and is committed
- All 5 stratum branches merged, no orphan branches
- Project knowledge update table reviewed by Hrishikesh

After merge: SCAFFOLD.2 is closed. `/clear`. Next task chat is SCAFFOLD.3.

---

# Appendix — Anti-pattern checklist

If Claude Code finds itself doing any of the following during any stratum, **stop and surface to Hrishikesh:**

- Writing application logic outside `src/db/`
- Importing from `src/server/` (doesn't exist yet)
- Using `gen_random_uuid()` or `crypto.randomUUID()` anywhere
- Writing a "send dharma" or user-to-user transfer function
- Writing handler-layer pre-validation that duplicates the trigger logic
- Adding a `users.role` column or `is_admin` boolean
- Skipping a Bucket A trigger because "it's just a single-column write"
- Naming a recipe `db:generate` (colon-separator) instead of `db-generate`
- Editing a committed migration after a successful apply
- Adding `vitest` coverage config (HARDEN.* territory)
- Adding a Sentry / PostHog / Axiom import
- Adding a CI workflow file
- Inventing a market question, resolution criterion, or any product copy

Each of these is `REFUSAL:` per CLAUDE.md §3.

---

*Plan last revised by SCAFFOLD.2 sub-part 3 (chat of 2026-05-10) against SPEC.1 v1.8.0 + SPEC.2 v0.3-draft + ADRs 0003–0016.*
