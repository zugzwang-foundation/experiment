# MIGRATE-DRIFT — Prod migrate path + schema-drift guard

> **Status:** drafted (sign-off deferred to the morning PR gate — unattended overnight run)
> **Date:** 2026-06-20
> **Author:** Claude Code (overnight autonomous prep tab)
> **Critical-path?** no — operational tooling + a read-only `/api/health` field; touches no §1 sensitive dir, no schema/migration file, no invariant path
> **Plan PR / commit:** committed on `feat/migrate-on-deploy-drift-guard`

Design rationale + options analysis live in **ADR-0022** (`docs/adr/0022-prod-migration-strategy-and-drift-guard.md`). This plan covers scope, test plan, and boundaries.

## Tracker context

Staging-provisioning prep, work item #2 (2026-06-20). Root issue: prod silently sat 11 migrations behind because `vercel.json` runs `next build` only and the sole migrate script was staging-scoped; `drizzle-kit migrate` on the multi-pending case hits 55P04 (enum-add 0009 → use 0013 in one tx). No dependency on item #1.

## Approach (one paragraph)

Add a prod migrate path that applies each migration in its own transaction (sidesteps 55P04), a read-only drift checker for CI / post-promote assertion, and a status-only `/api/health.migrations` field, all backed by one tested helper. See ADR-0022 for why per-migration-tx and why not migrate-on-deploy.

## 1. Thesis invariants touched

| Invariant | Touched? | How preserved | Test assertion |
|---|---|---|---|
| 2.1–2.4 | no | Operational tooling + read-only health field; no bet/comment/dharma/resolution/schema path | n/a |

## 2. Data model changes

None. No schema, no new migration. (`migrate-prod.ts` *applies* existing migrations; it adds none.)

## 3. API surface

- `GET /api/health` gains a `migrations: "ok" | "drift" | "error"` field (public; status string only — no heads/secrets). Computed via `migrationDriftStatus(db)`, only when the DB read (`SELECT 1`) succeeds.
- New scripts (not HTTP): `pnpm db:migrate:prod` (`scripts/migrate-prod.ts`), `pnpm db:check-drift` (`scripts/check-migration-drift.ts`).

## 4. UI / user flow

None — backend/ops only.

## 5. Failure modes

- DB unreachable → health `migrations: "error"` (not "drift"); `migrationDriftStatus` catches and returns "error".
- `migrate-prod` against wrong DB → refused by the `PROD_PROJECT_REF_FRAGMENT` guard before connecting.
- `migrate-prod` fails mid-run → the failing migration's tx rolls back; earlier migrations stay committed; fix forward + re-run (journal resumes from last committed).
- Code deployed ahead of schema → caught by the health field (monitor), `db:check-drift` (CI gate), and the post-promote runbook assertion.

## 6. Edge cases

- No migrations applied at all → drift (DB head null ≠ journal head).
- DB head equals journal head as a bigint string vs number → normalized via `Number()` (unit-tested both forms).
- No-breakpoint multi-statement migration (0004) + PL/pgSQL bodies (0003/0011) → applied via postgres-js parameterless `unsafe` (simple protocol).
- CI strips pg_cron (changes file hashes) → drift compares `created_at`/count, not hash, so no CI false-positive.

## 7. Test plan

| Layer | Scenarios | Invariants |
|---|---|---|
| Unit (`tests/server/health/migration-drift.test.ts`) | `journalHead` returns newest entry (vs the imported journal); `dbMigrationHeadMillis` coerces bigint-string + number, null on empty; `migrationDriftStatus` → ok (string + number head), drift (behind / none applied), error (query throws). | n/a |
| Integration (`tests/integration/migration-drift.integration.test.ts`) | Against the real test Postgres at journal head: `migrationDriftStatus(testDb) === "ok"`; `dbMigrationHeadMillis(testDb) === journalHead().when`. | n/a |
| Script smoke (manual, this session) | `db:check-drift` vs local DB → IN SYNC, exit 0; `db:migrate:prod` guard refuses with no `DATABASE_URL_PROD` and on fragment mismatch (before connecting). | n/a |

## 8. Out of scope

- Not wiring migrate-on-deploy into the Vercel build (ADR-0022 rejects it).
- Not migrating prod tonight (no prod touch — that's the operator's gated runbook step).
- Not changing `migrate-staging.ts` (its `--config staging` comment drift is noted in the runbook; not fixed here).
- Not reconciling schema↔spec (DEBATE.8/9).
- Not adding a per-migration-hash comparison to the drift guard (head/count is the operative signal; hash would false-positive under CI pg_cron stripping).

## Open questions

- **Q:** Should `db:check-drift` run in CI as a required gate now?
- **Candidate:** Yes — add it to `ci.yml` after migrate. Left as a runbook recommendation for the morning gate rather than editing CI in this PR (keeps the PR's blast radius to tooling + the health field; CI YAML edits warrant their own review per the "verify skips workflow YAML" lesson).
- **Resolve with:** morning gate / a follow-up CI PR.

## ADRs needed

ADR-0022 (this PR, same commit) — proposed.

## Self-critique

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | Bespoke applier duplicates drizzle bookkeeping → could drift from drizzle's shape on upgrade. | Accepted + mitigated: uses drizzle's `readMigrationFiles`; mirrors exact DDL/insert; ADR-0022 flags the coupling for same-commit update on a drizzle bookkeeping change. |
| 2 | low | Integration test assumes the test DB is at head. | Accepted: CI migrates to head before vitest; a "drift" there would be a true signal, not a flake. |
| 3 | low | `db:check-drift` exits the process (0/1) — fine for CLI/CI, not importable as a function. | Accepted: the importable, testable logic lives in `src/server/health/migration-drift.ts`; the script is a thin CLI wrapper. |

## References

- ADR-0022 — design + options
- AGENTS.md §6 (migrations), §7 (tsx script discipline), §9 (testing)
- CLAUDE.md §5.13 Gotchas (drizzle-kit / pg_cron / Doppler `stg`/`prd`)
- `scripts/migrate-staging.ts` — the precedent mirrored
- Work item #2, staging-provisioning prep kickoff, 2026-06-20
