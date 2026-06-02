# ADR-0008 — Drizzle ORM on the Experiment Stack

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-05-06 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | SPEC.9 |
| **Frame document** | SPEC.2 §1.4 #5 (delegation), §5, §6, §7, §23 (ADR Index), Appendix A (file map) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

ADR-0005 ratified Postgres + event sourcing (Pattern A) as the persistence layer. ADR-0004 ratified Better Auth as the participant authentication library, consuming a "Drizzle adapter" that this ADR ratifies. ADR-0006 ratified Supabase Postgres 17 as the hosting target. ADR-0007 ratified that Sentry alarm #1 fires on Postgres `RAISE EXCEPTION` from the append-only triggers ADR-0005 mints. Across these four prior ADRs, "Drizzle" appears as a named consumer dependency without a ratifying decision of its own. SPEC.2 §1.4 #5 explicitly delegates "ORM choice + migration tooling" to this ADR. SPEC.2 §5 (Data Model — Table Inventory), §6 (Append-Only Enforcement Contract), and §7 (Event Model) are stubs at v0.1-outline that consume this ADR for the migration tooling and per-domain schema split convention.

The persistence layer per ADR-0005 has an unusual property: the load-bearing primitives (append-only triggers, monthly partitioning, pg_cron jobs, the events insert helper, the SERIALIZABLE bet transaction) are not first-class in any TypeScript ORM and ship as raw SQL. The ORM choice therefore optimises for the surrounding surface — table definitions, ordinary schema migrations, typed reads, table-row validation at the API boundary, and the Better Auth adapter chain — while staying out of the way of the raw-SQL primitives. This ADR ratifies Drizzle for that surface and pins the usage discipline that keeps Drizzle and raw SQL coherent in one migration set.

This ADR does **not** decide:

- Specific table column shapes (per-domain) → SCAFFOLD.2 (the events table shape is locked in ADR-0005)
- Migration ordering for SCAFFOLD.2 deliverables → SCAFFOLD.2
- Drizzle version pin → `package.json` (per SPEC.2 §1.4 #9)
- Decimal-arithmetic library for Dharma balances (decimal.js vs dnum vs js-big-decimal) → SCAFFOLD.2 / ENGINE.5
- Type-generation cadence (pre-commit vs CI vs on-demand) → SCAFFOLD.2 operational choice
- Schema introspection workflow (one-shot generate vs iterative) → SCAFFOLD.2
- Concurrency / transaction shape (Postgres SERIALIZABLE + `SELECT FOR UPDATE` + retry) → ADR-0013 (SPEC.14)
- Append-only trigger contents → ADR-0005 (already accepted; this ADR ratifies the migration tooling that ships them)
- Monthly partition DDL → ADR-0005
- `pg_cron` job definitions → ADR-0006
- Better Auth's Drizzle adapter configuration shape → ADR-0004
- ID schema (UUIDv7) → ADR-0016 (SPEC.17)

## Decision Drivers

1. **TypeScript-first schema-as-code with low impedance to raw SQL.** The persistence layer per ADR-0005 ships triggers, partitioning DDL, and `pg_cron` jobs as hand-written raw SQL in the same migration set as ordinary table changes. The ORM must be a thin layer over SQL, not a layer that fights to remain authoritative when raw SQL is needed.

2. **Solo-developer velocity across ~5 months of frequent schema iteration.** Build runs May → November 2026 with table shapes, indexes, and FK constraints evolving across SCAFFOLD.2, ENGINE.*, and DEBATE.* tasks. Auto-emitted migrations from a schema diff (vs hand-writing every ALTER TABLE) compound across the build window.

3. **Better Auth Drizzle-adapter compatibility (ADR-0004).** ADR-0004 ratified `better-auth/adapters/drizzle` on the `1.x` stable line. The chosen ORM must be Drizzle for ADR-0004 to hold without a same-commit supersession.

4. **drizzle-zod table-row validation at the API boundary.** Every state-mutating Server Action validates inputs at the API boundary; a free Zod-from-table mirror eliminates ~20 hand-rolled-and-kept-in-sync schemas. Throwaway-codebase economics favour dependencies that replace boilerplate over dependencies that add it.

5. **Postgres-17 feature parity.** Drizzle's Postgres dialect supports the column types and DDL primitives this build needs at table-definition level: `numeric` with explicit precision + scale (per SPEC.1 §16.1 NUMERIC(38,18) for Dharma balances), `jsonb`, `uuid`, generated columns, and FK / index DDL. Features Drizzle does not cover at first-class level (triggers, partitioning, materialized views, pg_cron) ship as raw SQL per the migration-set discipline (point 1 above).

6. **Permissive licensing.** Drizzle ORM is Apache-2.0; drizzle-kit is Apache-2.0; drizzle-zod is Apache-2.0. No obligations imposed on Zugzwang's AGPL-3.0 redistribution per ADR-0001.

7. **Solo-developer + Claude Code workflow ergonomics.** Drizzle's documentation and code patterns are well-represented in current agent training data. Schema-as-code in TypeScript matches the rest of the codebase's idiom (typed throughout, no separate DSL or codegen step).

## Considered Options

1. **Drizzle ORM + drizzle-kit + drizzle-zod** ← chosen
2. Prisma + `prisma migrate` + Zod hand-rolled
3. Kysely + third-party migration tool + Zod hand-rolled
4. `postgres.js` + raw SQL throughout + Zod hand-rolled (no ORM)
5. MikroORM / TypeORM (treated jointly — heavyweight ORMs)

## Decision Outcome

**Chosen: Option 1 — Drizzle ORM + drizzle-kit + drizzle-zod.**

This ADR ratifies five primitives and three usage disciplines that downstream code consumes.

### 1. Drizzle ORM as the persistence-layer ORM

`drizzle-orm` for table definitions, query building, and the transaction primitive. The Drizzle client is instantiated once at `src/db/index.ts` with `import 'server-only'` at the top of the file; all server-side code imports `db` from this module. Schema files are pure data definitions and do **not** import `'server-only'` — they remain importable from migration tooling, tests, and any pure-validation context. The version pin lives in `package.json` per SPEC.2 §1.4 #9.

### 2. drizzle-kit as primary migration tooling

`drizzle-kit generate` produces SQL migrations from schema diffs; `drizzle-kit migrate` applies them. Configuration lives at the repo root in `drizzle.config.ts`. The `out` folder is `drizzle/migrations/` per ADR-0005's file map; the `schema` folder is `src/db/schema/`.

### 3. Single migration set, mixed origin

`drizzle/migrations/` is the **one** migration directory. drizzle-kit-generated `.sql` files and hand-written raw SQL files (append-only triggers per ADR-0005, events partitioning per ADR-0005, `pg_cron` jobs per ADR-0006, any future raw-SQL primitive) coexist there. The migration runner applies files in numerical `<NNNN>` order regardless of origin. There is **no** separate "raw migrations" directory. Hand-written files are committed to `drizzle/migrations/` and incremented in the same `<NNNN>` sequence.

Migration filenames follow `<NNNN>_<kebab-case>.sql`. drizzle-kit-generated files achieve this via the `--name <kebab-case>` flag on every `drizzle-kit generate` invocation; hand-written files are kebab-case by author discipline. Convention enforcement (CI lint that rejects merges with non-conforming filenames) is a HARDEN.* concern; this ADR ratifies the convention, not the lint.

### 4. Per-domain schema split with barrel import

Per-domain table definitions live at `src/db/schema/<domain>.ts` (e.g., `src/db/schema/users.ts`, `src/db/schema/markets.ts`, `src/db/schema/events.ts`). All domain files are barrel-imported via `src/db/schema/index.ts`. drizzle-kit's `schema` config points at the barrel. Specific domain boundaries (which tables sit in which file) are owned by SCAFFOLD.2; the convention is ratified here.

### 5. drizzle-zod co-located in the same file as the table definition

Each `src/db/schema/<domain>.ts` exports both the Drizzle table objects and the drizzle-zod-derived schemas (`createInsertSchema`, `createSelectSchema`) for those tables. One file, one source of truth for table-row shape. **drizzle-zod schemas are for table-row validation at the API boundary only; they are NOT used to validate `events.payload` JSONB content** — events have a per-event-type payload Zod schema hand-written at `src/server/events/schemas.ts` per ADR-0005, because the table-row schema would type `payload` as "any JSON" which is wrong for typed event payloads.

### 6. Drizzle-usage disciplines (load-bearing)

Three usage rules apply across the codebase:

**6.1 Default to explicit joins; reserve `relations()` for nested-eager-load.** The Drizzle `relations()` API is a second declaration of FK shape (the FK is already declared in the table definition). Maintaining both is overhead. The default is explicit `.leftJoin(...)` / `.innerJoin(...)` in the query builder. `relations()` is added per-domain only when nested-eager-load ergonomics (`.findMany({ with: {...} })`) earn it for a specific read path. SCAFFOLD.2 owns the case-by-case calls.

**6.2 The events insert helper uses the `sql\`...\`` template, not the query builder.** The canonical events insertion path at `src/server/events/insert.ts` (per ADR-0005's file map) uses `db.execute(sql\`INSERT INTO events ... ON CONFLICT (event_id) DO NOTHING\`)`. The query builder also supports `ON CONFLICT`, but the canonical helper uses the `sql\`...\`` template for clarity at the call site and to keep the helper's shape stable across Drizzle minor versions.

**6.3 Hot-path raw queries use `sql<T>\`...\`` typed templates, not the query builder.** Reserved for measured perf wins; SCAFFOLD.2 / ENGINE.* surface them as needed. This ADR ratifies the pattern, not specific instances.

### 7. Type inference from schema (no codegen step)

Drizzle's TypeScript types are inferred directly from schema definitions: `typeof users.$inferSelect` for read shape, `typeof users.$inferInsert` for write shape. There is no separate codegen step (no `prisma generate`-equivalent). Imports flow as `import { users } from '@/db/schema'`; types flow via `$infer` accessors on the imported table objects.

### 8. NUMERIC(38,18) for Dharma balances at the DB layer

Dharma-balance columns use Drizzle's `numeric` column type with explicit `{ precision: 38, scale: 18 }` per SPEC.1 §16.1 operational floor. Application-side arithmetic uses a decimal library; the library choice (decimal.js vs dnum vs js-big-decimal) is deferred to SCAFFOLD.2 / ENGINE.5.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| drizzle-kit configuration (out folder, schema folder, dialect, casing, credentials env-var name) | `drizzle.config.ts` (repo root) |
| Drizzle client instance (`db = drizzle(...)`), with `import 'server-only'` at top | `src/db/index.ts` |
| Per-domain schema barrel | `src/db/schema/index.ts` |
| Per-domain table definitions + drizzle-zod schemas | `src/db/schema/<domain>.ts` |
| Migration set (drizzle-kit-generated + hand-written raw SQL, mixed) | `drizzle/migrations/<NNNN>_<kebab-case>.sql` |

The per-domain split (`src/db/schema/<domain>.ts`) and the barrel (`src/db/schema/index.ts`) are conventions ratified here. Specific files (`events.ts`, `auth.ts`, etc.) are owned by ADR-0005 / ADR-0004 / SCAFFOLD.2 respectively.

## Consequences

### Positive

- **One migration set, numerical ordering preserved.** Triggers, partitioning, and `pg_cron` migrations interleave with table-shape migrations in the order they were committed. No "which directory does this go in" ambiguity at PR review.
- **Schema-as-code is the only source of truth for table shape.** drizzle-zod is a derivation; `$inferSelect` / `$inferInsert` are derivations; the table file is the input. One thing to change when a column is added.
- **Better Auth adapter chain works as ratified in ADR-0004.** No supersession needed; ADR-0008 is the consumer-side ratification.
- **No codegen step in the dev loop.** Type changes propagate at TypeScript compile time, not at the next `prisma generate` invocation. One fewer failure mode in the iteration cycle.
- **drizzle-zod replaces ~20 hand-rolled API-boundary Zod schemas with one-liners.** Maintenance cost across the build window is near zero.
- **Solo-developer cognitive surface stays small.** TypeScript schema files; explicit joins; one transaction primitive (`db.transaction(...)`); one events insert helper; raw SQL only where Postgres demands it (triggers, partitioning, cron).

### Negative

- **drizzle-kit's default migration filenames are random word pairs** (e.g., `0001_curvy_lockheed.sql`). The `<NNNN>_<kebab-case>.sql` convention requires the `--name` flag on every `drizzle-kit generate` invocation. *Mitigated by:* author discipline + a HARDEN.* CI lint deferred from this ADR. Acceptable because the cost is one CLI flag per generation; the CI lint catches the rest.
- **Drizzle's `relations()` API is partially used (per discipline 6.1) — half-applied conventions can confuse new readers.** *Mitigated by:* the discipline is named explicitly here and in SCAFFOLD.2; new readers see "explicit joins by default; `relations()` only where named in the schema file" as a positive rule, not a vibe.
- **drizzle-zod cannot type JSONB content** — `events.payload` is typed as "any JSON" by the table-row schema, which is wrong for typed event payloads. *Mitigated by:* discipline 5 names the boundary explicitly; per-event-type Zod schemas live at `src/server/events/schemas.ts` per ADR-0005.
- **Drizzle's TypeScript types under heavy generic load can produce slow IDE feedback** on very wide schema barrels. *Acceptable because:* the experiment-phase schema is ~20 tables; this surfaces only at much larger scales.
- **Hand-written raw SQL files bypass Drizzle's diff-against-schema check.** A trigger that references a column the table definition doesn't have will fail at apply-time, not at `drizzle-kit generate` time. *Acceptable because:* triggers and partitioning are reviewed by hand at SCAFFOLD.2; the failure mode is loud (migration apply fails on staging before prod).

### Neutral

- **Apache-2.0 licensing across drizzle-orm, drizzle-kit, and drizzle-zod** imposes no obligations on Zugzwang's AGPL-3.0 redistribution per ADR-0001.
- **Drizzle version pin** lives in `package.json` per SPEC.2 §1.4 #9; this ADR ratifies "Drizzle" as the ORM family, not a specific version.

## Pros and Cons of the Options

### Option 1 — Drizzle ORM + drizzle-kit + drizzle-zod (chosen)

**Pros**

- Schema-as-code in TypeScript; types inferred without a codegen step.
- drizzle-kit emits SQL migrations from schema diffs; raw-SQL migrations interleave in the same directory.
- drizzle-zod produces Zod schemas from table definitions; one file per domain.
- Better Auth's Drizzle adapter chain (ADR-0004) is first-class.
- Apache-2.0 throughout; no AGPL friction.
- Strong agent-training-data alignment.

**Cons**

- `--name` flag required on every `drizzle-kit generate` for kebab-case filenames.
- `relations()` API is a second source of truth for FK shape — discipline 6.1 mitigates by deferring its use.
- Heavy generic types can slow IDE feedback on very wide schemas (not a concern at experiment-phase scale).

### Option 2 — Prisma + `prisma migrate` + Zod hand-rolled

**Pros**

- Mature ecosystem; widest documentation footprint among TypeScript ORMs.
- `prisma.schema` DSL is concise.
- `prisma migrate dev` produces migration files automatically.

**Cons**

- **The `prisma.schema` DSL is its own learning surface and cannot express triggers, partitioning, or `pg_cron`.** Every primitive ADR-0005 / ADR-0006 ships as raw SQL would land as a `prisma migrate diff --script` escape hatch — at which point Prisma's value-add is reduced to table-shape diffs the codebase could get from drizzle-kit without the DSL.
- **Prisma's runtime engine is a separate binary** that ships with the application. Cold-start cost on Vercel functions is non-trivial; one more thing to keep in sync at deploy.
- **`prisma generate` is a codegen step** that must run after every schema change. One more failure mode in the dev loop and the CI pipeline.
- **Zod schemas are hand-rolled** (no first-party Prisma-to-Zod mirror); the ~20 hand-written-and-kept-in-sync schemas re-emerge.
- No first-party Better Auth adapter on the same maintainer chain as Drizzle's; ADR-0004 would need a same-commit update.

**Verdict:** Rejected. The DSL + codegen step + runtime engine triple-tax doesn't pay back at experiment-phase scope; Prisma's strengths (mature ecosystem, opinionated workflow) are weakest exactly where this codebase needs flexibility (raw SQL, mixed migration set).

### Option 3 — Kysely + third-party migration tool + Zod hand-rolled

**Pros**

- Pure query builder; no schema-as-code DSL to learn.
- Lightweight runtime; types-only at compile time.
- Apache-2.0.

**Cons**

- **No schema-as-code.** Table types are hand-written TypeScript interfaces that must be kept in sync with the actual DB shape. The schema-diff loop drizzle-kit automates is hand-written instead.
- **Migration tooling is third-party** (`kysely-migrator`, `kysely-codegen`, etc.) — multiple choices, none first-party, none on the same maintainer chain.
- **No first-party Zod-from-schema mirror.** drizzle-zod's value-add is hand-rolled.
- ADR-0004's Better Auth adapter chain would need a same-commit update (Better Auth has a Kysely adapter, but switching costs are real).

**Verdict:** Rejected. Kysely is excellent when raw SQL ergonomics dominate; this codebase has those needs at the migration layer (where Drizzle stays out of the way) but type-from-schema and Zod-from-schema dominate at the application layer (where Drizzle pays back).

### Option 4 — `postgres.js` + raw SQL throughout (no ORM)

**Pros**

- Minimum dependency surface — `postgres` is the only DB library.
- Maximum control; nothing between the application and SQL.
- Apache-2.0 (postgres.js) / MIT.

**Cons**

- **All migrations are hand-written.** drizzle-kit's auto-emit is forfeited.
- **All types are hand-written.** Every query's read shape is a hand-maintained interface.
- **All Zod schemas are hand-written.** drizzle-zod's value-add is forfeited.
- **ADR-0004 invalidated.** Better Auth requires an adapter; "no adapter" is not a Better Auth configuration.
- **Boilerplate cost compounds across ~5 months** with frequent schema iteration. The throwaway-codebase argument cuts the wrong way: throwaway codebases benefit most from boilerplate-eliminating tools, because the boilerplate cost is paid up-front and the codebase is archived before the hand-written-types maintenance benefit accrues.

**Verdict:** Rejected. Minimum-dependency wins only if dependencies are net-negative; Drizzle is net-positive at the surface this codebase exercises.

### Option 5 — MikroORM / TypeORM

**Pros**

- Mature; data-mapper / unit-of-work patterns; decorators-based.

**Cons**

- **Decorator-heavy, active-record-leaning patterns** are an impedance mismatch with the event-sourced + Pattern A architecture (ADR-0005).
- **TypeORM is essentially unmaintained** — major releases trail Postgres feature support.
- **MikroORM is healthier but heavier** than this codebase needs; its strengths (entity manager, identity map, change tracking) are anti-features in an event-sourced codebase where every state mutation must explicitly write an `events` row.
- ADR-0004's Better Auth adapter chain would need a same-commit update.

**Verdict:** Rejected. Architectural pattern mismatch; weight-to-payoff ratio is wrong for this codebase.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.2 §1.4 #5 | Delegated decision | ORM choice + migration tooling — ratified by this ADR |
| SPEC.2 §5 (stub) | Table inventory | Consumes: per-domain schema split convention (`src/db/schema/<domain>.ts` + barrel `src/db/schema/index.ts`); specific domain file boundaries deferred to SCAFFOLD.2. Back-pressure: §5 absorbs the convention reference + `src/db/schema/*.ts` file path on the next §5 drafting pass. |
| SPEC.2 §6 (stub) | Append-only contract | Consumes: ADR-0005's trigger SQL files ship in the same `drizzle/migrations/` set as drizzle-kit-generated migrations. Mints: the **single migration set, mixed origin** discipline (no separate "raw migrations" directory). Back-pressure: §6 absorbs the discipline on the next §6 drafting pass. |
| SPEC.2 §7 (stub) | Event model | Consumes: events insert helper at `src/server/events/insert.ts` uses Drizzle's `sql\`...\`` template per ADR-0005 + discipline 6.2. Mints: the **drizzle-zod-is-NOT-events-payload-validator** boundary — table-row shape Zod (drizzle-zod) is distinct from per-event-type payload Zod (`src/server/events/schemas.ts`). Back-pressure: §7 absorbs the boundary on the next §7 drafting pass. |
| SPEC.2 §23 | ADR Index | Status of ADR-0008 flips from `provisional` to `accepted` on this commit. |
| SPEC.2 Appendix A | File map | Mints: `drizzle.config.ts` (drizzle-kit config), `src/db/index.ts` (Drizzle client), `src/db/schema/index.ts` (barrel), `src/db/schema/<domain>.ts` (per-domain table defs + drizzle-zod), `drizzle/migrations/<NNNN>_<kebab-case>.sql` (mixed migration set). Back-pressure: Appendix A absorbs these rows on the next Appendix A drafting pass. |
| SPEC.1 §16.1 | Operational floor — Dharma precision | Consumes: NUMERIC(38,18) precision for Dharma-balance columns, expressed via Drizzle's `numeric('...', { precision: 38, scale: 18 })` column type. Application-side decimal library deferred to SCAFFOLD.2 / ENGINE.5. |
| ADR-0001 | License compatibility | Consumes: drizzle-orm / drizzle-kit / drizzle-zod are Apache-2.0; impose no obligations on Zugzwang's AGPL-3.0 redistribution. |
| ADR-0003 | Server Action runtime | Consumes: Drizzle client imports run on Vercel Node.js runtime per ADR-0003's Node-only constraint on `src/server/{bets,comments,dharma,resolution}/`. The `import 'server-only'` at the top of `src/db/index.ts` is the boundary marker. |
| ADR-0004 | Better Auth Drizzle adapter | Consumes: ADR-0004's `better-auth/adapters/drizzle` import path is enabled by this ADR's ratification of Drizzle as the ORM. No supersession; ADR-0008 is the consumer-side ratification of the dependency ADR-0004 named. |
| ADR-0005 | Pattern A + file map | Consumes: file paths pinned in ADR-0005 (`drizzle/migrations/<NNNN>_append_only_triggers.sql`, `drizzle/migrations/<NNNN>_events_partitions.sql`, `src/db/schema/events.ts`, `src/db/schema/*.ts`, `src/server/events/insert.ts`). Mints: the migration tooling (drizzle-kit) that produces the migration set those file paths sit in, and the hand-written-raw-SQL-coexists discipline. |
| ADR-0006 | `pg_cron` migrations | Consumes: ADR-0006's `drizzle/migrations/<NNNN>_pg_cron_jobs.sql` ships in the same migration set as drizzle-kit-generated files. |
| ADR-0007 | Append-only-trigger alarm | Consumes: ADR-0007's alarm #1 fires on `RAISE EXCEPTION` from triggers shipped via this ADR's migration tooling. |
| ADR-0013 (gating) | Bet transaction shape | Consumes Drizzle's `db.transaction(...)` primitive; the SERIALIZABLE isolation level + `SELECT FOR UPDATE` lock + retry shape are ratified there, expressed via Drizzle transaction options + `sql\`...\`` template. |
| ADR-0016 (gating) | UUIDv7 | Consumes Drizzle's `uuid` column type with `sql\`...\`` default expression for UUIDv7 generation (Postgres-native vs userspace function ratified at ADR-0016). |
| Tracker | SCAFFOLD.2, every state-mutating ENGINE.* / DEBATE.* / UI.* / HARDEN.* task | All depend on this ADR being `accepted` |

## More Information

- Drizzle ORM documentation: <https://orm.drizzle.team>
- drizzle-kit migrations documentation: <https://orm.drizzle.team/docs/migrations>
- drizzle-zod documentation: <https://orm.drizzle.team/docs/zod>
- Drizzle `relations()` API (used selectively per discipline 6.1): <https://orm.drizzle.team/docs/rqb>
- Drizzle transactions: <https://orm.drizzle.team/docs/transactions>
- Better Auth Drizzle adapter (consumed via ADR-0004): <https://better-auth.com/docs/adapters/drizzle>
- Postgres 17 release notes (target version per ADR-0006): <https://www.postgresql.org/docs/17/release-17.html>
- **Adjacent prior art:** Manifold migrated to Supabase Postgres + Drizzle for its persistence layer; the Drizzle-on-Supabase pattern is well-trodden and is cited here as descriptive precedent (not as canonical authority — Manifold's product invariants differ from Zugzwang's per ADR-0005's Pattern A vs Manifold's Firestore-hybrid heritage).
- ADR-0001 (license) — confirms Apache-2.0 ↔ AGPL-3.0 compatibility for the Drizzle dependency stack
- ADR-0003 (Next.js 16) — pins the Node.js runtime that Drizzle imports require
- ADR-0004 (Better Auth) — pins the Drizzle adapter consumer chain that this ADR ratifies
- ADR-0005 (Postgres + event sourcing) — pins the file paths and Pattern A handler shape this ADR's migration tooling delivers
- ADR-0006 (hosting) — pins Postgres 17 on Supabase Pro and the `pg_cron` migrations that ship in this ADR's migration set
- ADR-0007 (observability) — pins the alarm catalogue that fires on triggers shipped via this ADR's migration tooling

---

*ADR-0008 ratifies Drizzle ORM + drizzle-kit + drizzle-zod for the Zugzwang experiment phase, with the per-domain schema split convention (`src/db/schema/<domain>.ts` + barrel), the single-migration-set discipline (drizzle-kit-generated and hand-written raw SQL coexist in `drizzle/migrations/<NNNN>_<kebab-case>.sql` ordered numerically), the kebab-case migration filename convention via the `--name` flag, drizzle-zod co-located with table definitions for table-row API-boundary validation only (NOT for `events.payload` content), the explicit-joins-by-default discipline with `relations()` reserved for nested-eager-load, the `sql\`...\`` template for the events insert helper and hot-path raw queries, NUMERIC(38,18) for Dharma-balance columns at the DB layer with the decimal-library choice deferred to SCAFFOLD.2 / ENGINE.5, and the Drizzle client at `src/db/index.ts` with `import 'server-only'`. The decision body and the disciplines minted in §"Decision Outcome" 6.1, 6.2, and 6.3 are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
