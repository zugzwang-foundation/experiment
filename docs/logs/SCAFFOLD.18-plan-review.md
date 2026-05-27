# SCAFFOLD.18 — plan-mode review session log

## Session metadata

- **Date:** 2026-05-27
- **Branch:** `feat/scaffold-finish-bundle-2`
- **PR:** #54 (draft, unchanged this session)
- **Session mode:** `/plan` (ultrathink, max effort)
- **Wall-clock:** ~13 min CC + ~25 min web Claude review
- **Predecessor:** `docs/logs/SCAFFOLD-finish-bundle-2.md` (Bundle 2 attempt #1 execute session)
- **Successor:** SCAFFOLD.18 execute session (paired, opens next chat)

---

## Phase 0 — reads + greps

**7 file reads:**

1. `docs/logs/SCAFFOLD-finish-bundle-2.md` — predecessor close-out (77 lines)
2. `.github/workflows/ci.yml` — current MVP YAML (64 lines)
3. `package.json` — `packageManager: pnpm@10.33.2` pin confirmed
4. `docs/specs/SPEC.2.md` §0.1 — ADR-0006 (hosting), ADR-0008 (Drizzle), ADR-0016 (UUIDv7 + `supabase/postgres:17.6.1.107-x-6-x86` tag)
5. `tests/db/_fixtures/db.ts` — shared DB-connection fixture (reads `DATABASE_URL`, throws if unset)
6. `tests/_setup/env.ts` — vitest `setupFiles` env-default surface
7. `drizzle/migrations/0007_pg_cron_jobs.sql` — load-bearing migration for the image-choice decision

**7 project-state greps:**

1. DB-touching test file inventory (28+ files import `tests/db/_fixtures/db.ts` or use the testClient/testDb fixture)
2. Upstash references across `tests/` and `src/server/` (4 integration tests + 2 src files)
3. Env-var reads in tests (only `tests/_setup/env.ts` + `tests/db/_fixtures/db.ts`)
4. Drizzle config `DATABASE_URL` handling (`drizzle.config.ts` reads `process.env.DATABASE_URL!`)
5. pg_cron usage in `drizzle/migrations/0007_pg_cron_jobs.sql` (line 16 `CREATE EXTENSION`, line 78 `SELECT cron.schedule(...)`)
6. `vi.mock` factory inventory for Upstash (all 4 Upstash-touching tests mock at module boundary)
7. INV-tagged test file existence in `tests/invariants/` (one file: `I-APPEND-ONLY-001`)

**1 critical finding:** `drizzle/migrations/0007_pg_cron_jobs.sql` carries a non-portable `CREATE EXTENSION pg_cron WITH SCHEMA extensions;` plus `SELECT cron.schedule(...)`. Vanilla `postgres:17` Docker image does not ship `pg_cron`. `drizzle-kit migrate` would fail mid-stream against vanilla. This finding reshaped the entire service-container shape decision (§5.1 in the plan) from the default "vanilla postgres:17" toward Path A `supabase/postgres:17.6.1.107-x-6-x86` (production-faithful, ships `pg_cron` + correct `shared_preload_libraries`). Path B (vanilla + 0007 filter) documented as fallback in §8 Risk 1 + Open question Q1.

---

## Phase 1 — plan drafting

Drafted `docs/plans/SCAFFOLD.18-postgres-ci.md` (~330 lines initially, ~386 after web Claude's Option A addendum).

**Structure:**

- Context (problem statement)
- Approach (one paragraph)
- §1 Thesis invariants touched
- §2 Data model changes (None)
- §3 API surface (None)
- §4 Locked decisions (inherited from prior research + ADRs + close-out)
- §5 Decisions to ratify in this plan (the 6 substance items, 5.1–5.6)
- §6 Execute-phase plan (step-by-step for the next CC session)
- §7 Test plan (how execute knows it worked)
- §8 Risks + rollback
- §9 Out of scope (explicit)
- Open questions for web Claude review
- ADRs needed (None)
- Self-critique (5 items)
- References
- Phase 2 hand-off note

**6 substance items decided:**

| # | Item | Decision |
|---|---|---|
| 5.1 | Postgres service container shape | Path A — `supabase/postgres:17.6.1.107-x-6-x86`; healthcheck `pg_isready`; ports `5432:5432`; throwaway creds `postgres/postgres/postgres` |
| 5.2 | Migration apply step placement | Post-typecheck, pre-vitest; command `pnpm drizzle-kit migrate` (NOT `push`); fail-loud on non-zero exit |
| 5.3 | Redis provisioning | **NO** Redis container — evidence: all 4 Upstash-touching files mock `@/server/upstash/redis` and `@upstash/ratelimit` at the module boundary via `vi.mock` |
| 5.4 | Env var management | Job-level `DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres` only; no step-level overrides; no real-secret pulls |
| 5.5 | Timeout adjustment | `timeout-minutes: 15` → `25` (bump-if-it-bites posture, not 30 upfront) |
| 5.6 | Reviewer-cascade plan | `code-reviewer` then `security-auditor` invoked in execute chat AFTER CI green, BEFORE `gh pr ready 54`; fresh-context `general-purpose` Agent calls with `.claude/agents/<role>.md` briefing baked into prompt per CLAUDE.md §5.11 |

---

## Phase 2 — web Claude review + addendum

Web Claude reviewed the plan draft in parallel via project-knowledge chat. Ratified all 6 substance items and all 4 open questions.

**One pre-greenlight ask:** §Self-critique row 3 evidence-chain framing on the "four-INV-test" variance. Applied as **Option A** (inline addendum to the resolution column, one sentence added). Web Claude's draft sentence used verbatim:

> "The four-INV-test framing in the close-out is an artifact of test-tagging convention, not of test existence. CI gates one INV-tagged file plus thirteen trigger tests; these together are the storage-layer enforcement of all four invariants. Critical-path reclassification (close-out decision 5) holds on this corrected evidence."

No other plan edits. Final greenlight issued. Path A locked.

---

## Net state at session close

- **Plan file:** `docs/plans/SCAFFOLD.18-postgres-ci.md` drafted + ratified + **uncommitted** (deliberate, per Phase 2 hand-off discipline — execute chat bundles plan + YAML in first commit per CLAUDE.md §5.1).
- **Branch + PR:** unchanged from session open. `feat/scaffold-finish-bundle-2` HEAD = `db0bdd6` at session open; this wind-down adds the chore(logs) commit on top.
- **Session log:** this file.
- **Next:** paired execute chat (web Claude + CC ultrathink) commits plan + YAML in single first commit.

---

## Carry-forwards

**Inherited from Bundle 2 close-out (all 5 still carry; none resolved this session):**

1. ADR-0006 file missing (Bundle 1 pattern — queued maintenance).
2. `mise.toml` major-only pnpm pin (literal-patch discipline drift).
3. Corepack-shim PATH-race (PRECURSOR.4 candidate).
4. `pnpm-lock.yaml` `lockfileVersion: 9.0` (drift-visibility mechanism — by design).
5. AGENTS.md §10 broader-CI-stack reconciliation (post-ADR sweep).

**New carry-forwards from this session:**

6. **Reviewer-cascade discipline.** Fires AFTER CI green, BEFORE PR ready-for-review. Execute chat MUST NOT rationalize its way out of running `code-reviewer` + `security-auditor` even though `.github/workflows/` is outside CLAUDE.md §1's path-glob inventory — the function is critical-path per close-out log decision 5.
7. **Path B fallback documented** (§8 Risk 1 + Open question Q1) — if Path A `supabase/postgres:17.6.1.107-x-6-x86` fails GHA service-container compat on first CI run, execute chat pivots to vanilla `postgres:17` + CI-only migration filter skipping 0007. Same-commit close-out note documents the pivot.
8. **Q2 (extensions schema permission) observe-posture.** If Supabase image's `extensions` schema is owned by a non-`postgres` role, `CREATE EXTENSION ... WITH SCHEMA extensions` in migration 0007 may hit `permission denied`. Small <5 line in-scope fix available (`GRANT ALL ON SCHEMA extensions TO postgres;` as a pre-migration step). Not anticipatory; act only if it surfaces.
9. **CI will likely fire on this log-only push** even though the change touches no `src/` or `.github/` paths — the workflow trigger is `pull_request: branches: [main]` (base-branch filter, no path filter). Expected to fail the same way the predecessor run did (vitest timeout). Not a blocker; execute chat's first commit will fix.

---

## Time

CC plan-mode: ~13 min (Phase 0 reads + greps in 4 parallel tool-call batches, Phase 1 single Write, Phase 2 Option A Edit + ExitPlanMode).
Web Claude review: ~25 min (project-knowledge chat in parallel).
Total session wall-clock: ~38 min.
