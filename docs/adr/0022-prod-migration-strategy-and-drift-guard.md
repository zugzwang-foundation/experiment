# ADR-0022 — Production Migration Application Strategy and Schema-Drift Guard

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-06-20 |
| **Deciders** | Hrishikesh (operator) + web Claude (gate) — proposed by Claude Code overnight prep |
| **Tracker task** | Staging-provisioning prep, work item #2 (2026-06-20) |
| **Frame document** | AGENTS.md §6 (Migrations), CLAUDE.md §5.13 Gotchas (drizzle-kit / pg_cron / migrations) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

Production silently sat 11 migrations behind the deployed code: `vercel.json` runs `next build` only, and the sole migration script was staging-scoped (`db:migrate:staging`). There was no prod-apply path and no guard that detects "code ahead of schema," so new code reading a column the DB lacked would 500 in production with no early warning.

Two coupled problems must be solved:

1. **How prod migrations are applied.** Applying many pending migrations at once with `drizzle-kit migrate` fails: drizzle's pg dialect wraps *all* pending migrations in a single transaction (`drizzle-orm/pg-core` dialect `migrate()` → `session.transaction(... for migration of migrations ...)`). Migration `0009` runs `ALTER TYPE "dharma_entry_type" ADD VALUE 'initial_grant'` and `0013` *uses* that value in a partial-index predicate (`WHERE entry_type = 'initial_grant'`). In one transaction this is Postgres **55P04** ("unsafe use of new value of enum type" — an ALTER-added enum value cannot be used until the adding transaction commits). This is the same failure hit on staging.
2. **How drift is detected.** Nothing compared the deployed code's migration journal head against the connected DB's applied head, so the 11-behind state was invisible until a 500.

This ADR does **not** decide:

- The schema/migration content itself (each migration owns its DDL; reconciliation is DEBATE.8/9, CLAUDE.md §1).
- Automatic migrate-on-deploy wired into the Vercel build (rejected below — kept as a gated operator step, not build-coupled).
- RLS or any data-access policy (ADR-0019).

## Decision Drivers

1. **Correctness over convenience** — the apply path must never hit 55P04 regardless of how many migrations are pending.
2. **Fail-safe for prod** — a prod-apply must be impossible to fire against the wrong database by accident (env-confusion guard), mirroring the staging script's ref-fragment guard.
3. **Catch drift before it 500s** — "code ahead of/behind schema" must surface cheaply on a public, monitorable signal and as a CI/release gate.
4. **No secret leakage** — the drift signal must not expose connection strings or migration internals on a public endpoint.
5. **Faithful bookkeeping** — the custom applier must leave `drizzle.__drizzle_migrations` in a state a later `drizzle-kit migrate` accepts.
6. **tsx script discipline** (AGENTS.md §7) — operational scripts inline their own client and avoid the `@/db` → `server-only` chain.

## Considered Options

1. **Per-migration-transaction bespoke applier (`db:migrate:prod`) + read-only drift checker (`db:check-drift`) + a status-only `/api/health` field** ← chosen
2. **`drizzle-kit migrate` as-is for prod** — rejected: hits 55P04 on the multi-pending case (the exact prod scenario).
3. **Automatic migrate-on-deploy in the Vercel build command** — rejected: couples schema mutation to every deploy, runs DDL with build-time credentials, and removes the human gate on irreversible prod DDL.
4. **Squash/rewrite migrations so no enum-add→use pair crosses files** — rejected: edits committed migrations (AGENTS.md append-only), and does not solve the general N-behind apply or drift detection.

## Decision Outcome

**Chosen: Option 1.** Three primitives are ratified:

1. **`scripts/migrate-prod.ts` (`pnpm db:migrate:prod`)** — applies each pending migration in its **own transaction** (commit between migrations), so an ALTER-added enum value (0009) is committed before a later migration uses it (0013). Migration files are read with drizzle-orm's `readMigrationFiles` (identical hashing/ordering to drizzle-kit); statements run via postgres-js parameterless `unsafe` (simple protocol — handles the no-breakpoint multi-statement files like 0004 and PL/pgSQL bodies). Bookkeeping mirrors drizzle's dialect exactly (`drizzle.__drizzle_migrations`, `hash` = sha256 of the file, `created_at` = journal `when`). Guarded by `DATABASE_URL_PROD` + `PROD_PROJECT_REF_FRAGMENT` (refuses if the URL lacks the fragment). All current migrations are transaction-safe (no `CREATE INDEX CONCURRENTLY`), so per-migration tx is valid for every file. Unlike CI (which strips pg_cron because its Postgres lacks the extension), prod applies migrations verbatim (Supabase has pg_cron).
2. **`scripts/check-migration-drift.ts` (`pnpm db:check-drift`)** — a read-only check comparing the journal head (`drizzle/migrations/meta/_journal.json`) against `drizzle.__drizzle_migrations` (head `created_at` + count). Exits 0 in sync, 1 on drift. Used as the gated post-promote release-runbook assertion and as a CI step.
3. **`/api/health` `migrations` field** — `"ok" | "drift" | "error"` via `migrationDriftStatus(db)` (`src/server/health/migration-drift.ts`), checked only when the DB is reachable. Status string only — no heads or secrets exposed.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Drift comparison logic (journal head vs DB head) | `src/server/health/migration-drift.ts` |
| Prod migration application (per-migration tx + guard) | `scripts/migrate-prod.ts` |
| Read-only drift assertion (CLI / CI / runbook) | `scripts/check-migration-drift.ts` |
| Release procedure (when to migrate + assert) | `docs/runbooks/staging-provisioning.md` (+ a future prod-release runbook) |

## Consequences

### Positive

- The N-behind apply case (the prod reality) no longer hits 55P04.
- "Code ahead of schema" is catchable three ways: a public health field (uptime monitor), a CI gate, and a release-runbook assertion.
- The prod-apply path cannot fire against the wrong DB without the explicit ref-fragment match.
- The drift field leaks nothing (status string only); the health route still reads only its two named env vars.

### Negative

- The bespoke applier duplicates a slice of drizzle's dialect bookkeeping. *Mitigated by:* using drizzle's own `readMigrationFiles` for reading/hashing and mirroring the exact bookkeeping DDL + insert, so a later `drizzle-kit migrate` stays consistent. A future drizzle change to the bookkeeping shape would require a same-commit update here.
- Migration apply remains a manual operator step, not automatic on deploy. *Acceptable because:* prod DDL is irreversible and deserves a human gate; the runbook makes the step explicit and the drift guard catches a forgotten apply.
- The drift guard compares the head timestamp (and, in the CLI, the count), not every migration hash. *Acceptable because:* the head/count mismatch is the operative "behind/ahead" signal; CI's pg_cron stripping changes file hashes but not `created_at`, so a hash comparison would false-positive in CI.

### Neutral

- `db:check-drift` reads the standard `DATABASE_URL`, so it targets whatever env is pointed at it (prod via `doppler --config prd`, staging via `stg`, or CI directly).

## Pros and Cons of the Options

### Option 1 — per-migration-tx applier + drift checker + health field (chosen)

**Pros**
- Solves 55P04 generally; faithful bookkeeping; cheap multi-surface drift detection; env-confusion guard.

**Cons**
- Maintains a small bespoke applier coupled to drizzle's bookkeeping shape.

### Option 2 — `drizzle-kit migrate` as-is

**Pros** — zero new code.
**Cons** — 55P04 on the multi-pending case.
**Verdict:** Rejected — fails the exact prod scenario this work exists to fix.

### Option 3 — migrate-on-deploy in the build

**Pros** — fully automatic; no forgotten applies.
**Cons** — DDL with build credentials, no human gate on irreversible prod changes, couples deploy to migration.
**Verdict:** Rejected — removes the gate on irreversible prod DDL.

### Option 4 — rewrite migrations to avoid cross-file enum-add→use

**Pros** — `drizzle-kit migrate` would work in one tx.
**Cons** — edits committed migrations (append-only violation); doesn't address drift detection.
**Verdict:** Rejected — violates AGENTS.md migration append-only discipline.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| AGENTS.md §6 | Migrations append-only; events excluded; pg_cron stripped in CI | Consumes — applier reads via `readMigrationFiles`, applies verbatim to prod (no stripping), never edits committed migrations |
| CLAUDE.md §5.13 | Doppler configs are `stg`/`prd` | Consumes — prod-apply documented as `doppler run --config prd` |
| SPEC.1 §5 INV-1..4 | Thesis invariants | Neither minted nor touched — this is operational tooling + a read-only health field; no bet/comment/dharma/resolution path |
| Tracker | Staging-provisioning item #2 | Depends on this ADR being `accepted` |

## More Information

- `drizzle-orm/pg-core` dialect `migrate()` (single-transaction batch — the 55P04 root cause)
- `drizzle-orm/migrator` `readMigrationFiles` (file reading + sha256 hashing)
- Postgres error 55P04 (`unsafe use of new value of enum type`)
- `scripts/migrate-staging.ts` (the staging precedent this mirrors)

---

*ADR-0022 ratifies the per-migration-transaction prod apply path, a read-only drift checker, and a status-only health drift field. Proposed pending the morning gate; once accepted, the primitives in §Decision Outcome are load-bearing and superseding requires a new ADR.*
