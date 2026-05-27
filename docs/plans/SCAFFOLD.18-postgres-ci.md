# SCAFFOLD.18 — Postgres-CI expansion

> **Status:** drafted (awaiting web Claude ratification)
> **Date:** 2026-05-27
> **Author:** Hrishikesh + Claude Code (Phase 1 plan-mode tab)
> **Critical-path?** **yes** — reclassified per close-out log decision 5; the CI workflow's function is to gate the four hard-locked invariant tests per CLAUDE.md §2, even though `.github/workflows/` does not match CLAUDE.md §1 path globs.
> **Plan PR / commit:** not yet committed; execute chat commits this file alongside the YAML changes (per CLAUDE.md §5.1 + kickoff §Phase 2 hand-off discipline).

---

## Context

Branch `feat/scaffold-finish-bundle-2` carries commit `40db580` — a 45-line MVP `.github/workflows/ci.yml` plus a `packageManager: pnpm@10.33.2` pin in `package.json` — open as draft PR #54. The CI run against that commit passes steps 1–3 (install, biome, tsc) and hangs at step 4 (vitest) until the 15-minute `timeout-minutes` ceiling kills the job. Root cause: the runner has no Postgres, and 30+ test files connect to a database via the shared `tests/db/_fixtures/db.ts` fixture (reads `DATABASE_URL`, spins up two `postgres-js` clients, throws if unset).

Excluding the DB-touching tests from CI was refused per CLAUDE.md §2 invariant-refusal discipline — the failing-test category includes `tests/invariants/I-APPEND-ONLY-001` (the storage-layer foundation for INV-4) and the trigger tests that make INV-1/INV-3/INV-4 enforceable at the storage layer. A CI gate that does not exercise the four invariants is not a gate.

The fix is to add a Postgres service container + a migration-apply step to the existing `ci.yml` so the full `vitest run` invocation completes. Bundle 2 is critical-path **by function** (gating INV tests) even though the YAML path is outside CLAUDE.md §1's path-glob inventory; the execute chat owes the reviewer-cascade (`code-reviewer` + `security-auditor`) per CLAUDE.md §5.11.

Intended outcome: PR #54's CI run goes green from install through full `vitest run`, all 30+ DB-dependent tests + the INV test actually execute (not skipped, not excluded), and the workflow becomes the protected check the operator wires up via Branch Protection settings post-merge.

---

## Approach (one paragraph)

Add a Postgres 17 service container to the existing `ci` job, surface a `DATABASE_URL` env var that points at it, slot a `pnpm drizzle-kit migrate` step between install and lint/typecheck, and bump `timeout-minutes` to absorb the container-init + migration-apply wall-clock. The chosen image is `supabase/postgres:17.6.1.107-x-6-x86` (production-faithful per ADR-0016) which bundles `pg_cron` and resolves the `0007_pg_cron_jobs.sql` migration's non-portable extension call without touching the committed migration file. No Redis service container is provisioned — all four Upstash-touching tests mock at the module boundary via `vi.mock`. No application-code changes, no test-organization changes, no migration-file changes; the entire delta is additive on `.github/workflows/ci.yml`.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| INV-1 Bet ↔ comment atomicity | indirectly (CI gates the storage-layer foundation) | CI runs `tests/db/triggers/{bets,comments}-append-only.spec.ts` against real Postgres | `tests/db/triggers/bets-append-only.spec.ts` + `tests/db/triggers/comments-append-only.spec.ts` |
| INV-2 Dharma non-transferable; no overdraft | indirectly | CI runs `tests/db/triggers/dharma-ledger-append-only.spec.ts` | `tests/db/triggers/dharma-ledger-append-only.spec.ts` |
| INV-3 Comments side-bound at post-time | indirectly | CI runs `tests/db/triggers/comments-append-only.spec.ts` (the trigger that immutabilizes `side_at_post_time` post-INSERT) | `tests/db/triggers/comments-append-only.spec.ts` |
| INV-4 Resolutions append-only | directly | CI runs `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts` + `tests/db/triggers/{resolution-events,payout-events}-append-only.spec.ts` | `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts` |

**Critical-path failure mode if this plan is wrong:** if `drizzle-kit migrate` runs against an image that lacks `pg_cron`, every DB-touching test (including the INV file) is skipped/errored at fixture-init, and CI ships a green-by-omission gate. The operator's branch-protection guard then attaches to a workflow that does not actually test the four invariants — the worst possible failure mode for the CI surface. This plan's load-bearing decision is the service-container image choice (§4.1).

---

## 2. Data model changes

**None.** This is a CI-infrastructure change. No new tables, no new migrations, no schema delta, no edits to `drizzle/migrations/*` (forbidden by AGENTS.md §6 file-level append-only discipline anyway).

The plan **consumes** the existing migration set (`drizzle/migrations/0000`–`0007`) by adding a CI step that applies it. The `meta/_journal.json` already tracks all eight migrations; `drizzle-kit migrate` will apply them in order against a fresh DB.

---

## 3. API surface

**None.** No new endpoints, no Server Action changes, no Route Handler changes.

---

## 4. Decisions (locked from prior research + ADRs + close-out)

Do not relitigate during execute:

- `actions/checkout@v5`, `pnpm/action-setup@v4` (omit-version pattern — reads `packageManager` from `package.json`), `actions/setup-node@v4` with `cache: pnpm` + `node-version-file: .nvmrc` (Node 24 LTS).
- Single sequential job named `ci`.
- `concurrency: group: workflow-ref, cancel-in-progress: true`.
- `permissions: contents: read`.
- `pnpm biome check . --reporter=github`.
- `pnpm tsc --noEmit`.
- `pnpm vitest run` (no flags — vitest auto-detects `GITHUB_ACTIONS=true` and emits the github-actions reporter alongside default).
- `packageManager: pnpm@10.33.2` pin already committed in `40db580`.
- Postgres major: 17 per ADR-0006.
- Migration apply: `pnpm drizzle-kit migrate` per ADR-0008 single-migration-set discipline (NOT `pnpm drizzle-kit push` — push is dev-iteration sync and would not apply raw SQL files like `0000_uuidv7_function.sql`, `0003_append_only_triggers.sql`, `0007_pg_cron_jobs.sql`).

---

## 5. Decisions to ratify in this plan (the 6 substance items)

### 5.1 Postgres service container shape

**Recommended image:** `supabase/postgres:17.6.1.107-x-6-x86` (the exact production tag named in SPEC.2 §0.1 ADR-0016 entry, 29 Apr 2026 release).

**Rationale:**
- Production-faithful. Same Postgres binary, same extension set, same `shared_preload_libraries='pg_cron,...'` config as Supabase production. CI exercises the same substrate the app talks to in prod.
- Resolves the `0007_pg_cron_jobs.sql` non-portable assumption (`CREATE EXTENSION pg_cron` + `SELECT cron.schedule(...)`) without touching the committed migration. Migrations stay append-only per AGENTS.md §6.
- The image is what `supabase start` (local dev) already pulls. CI matches local-dev substrate exactly.

**Risks + mitigations:**
- **Image size (~1.5 GB).** GHA caches Docker images per-runner for the duration of a job. First-pull adds 30–60s to the job; subsequent steps reuse the cached layer. Acceptable given the timeout bump in §4.5.
- **Custom entrypoint compatibility with GHA service-container conventions.** Supabase's image extends the standard `postgres` entrypoint with role-bootstrap scripts (creates `anon`, `authenticated`, `service_role` roles). It accepts the standard `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` env vars and exposes port 5432. The service-container model should work, but execute chat must verify on first CI run.

**Service-block shape:**

```yaml
services:
  postgres:
    image: supabase/postgres:17.6.1.107-x-6-x86
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    ports:
      - 5432:5432
    options: >-
      --health-cmd "pg_isready -U postgres"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 10
```

- **Healthcheck:** `pg_isready` is the standard postgres-protocol probe. 10 retries × 10s interval = 100s ceiling on container init (Supabase image takes longer than vanilla to bootstrap roles).
- **Port mapping:** `5432:5432` makes the DB reachable at `localhost:5432` from job steps (VM runner pattern — GHA does not auto-resolve service hostnames on `ubuntu-latest`).
- **Credentials:** hardcoded `postgres/postgres/postgres`. No Doppler injection; ephemeral throwaway DB. CLAUDE.md §11 forbids reading `.env*` files in CI anyway.

### 5.2 Migration apply step placement

**Position:** between "Install dependencies" (step 4 currently) and "Lint and format check" (step 5 currently). Reason: typecheck reads `drizzle.config.ts` which references `process.env.DATABASE_URL!` — failing fast on migration errors before lint/typecheck means the YAML reads top-to-bottom in dependency order.

Actually — reconsidering — typecheck does NOT require a live DB. The `process.env.DATABASE_URL!` non-null assertion in `drizzle.config.ts` is a runtime guard; type-check passes without it. Therefore migration apply can go AFTER typecheck and immediately BEFORE vitest, minimizing the wall-clock window where a DB-init failure aborts the run. **Revised position: after typecheck, immediately before vitest.**

**Command:** `pnpm drizzle-kit migrate`.

**Env var:** `DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres` (set at the job env level, not at the step env level — vitest needs it too).

**Failure handling:** drizzle-kit exits non-zero on migration failure; GHA's default step-level error handling propagates this, the job fails, and the operator sees the migration error inline in the logs. No `continue-on-error` flag, no try/catch shim. Loud failure is the contract.

### 5.3 Redis provisioning decision

**Decision: NO Redis service container needed.**

**Evidence (Phase 0 grep):** all four Upstash-touching test files mock the Upstash client at the module boundary via `vi.mock("@/server/upstash/redis", () => ({ redis: mockRedis }))`:
- `tests/integration/upstash-lock.integration.test.ts`
- `tests/integration/idempotency-cache.integration.test.ts`
- `tests/integration/rate-limit.integration.test.ts` (also mocks `@upstash/ratelimit`)
- `tests/integration/precommit-moderate.integration.test.ts`

No other test files reference Upstash. The placeholder `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` values seeded by `tests/_setup/env.ts` (via vitest's `setupFiles`) satisfy module-load env validation in `src/server/upstash/redis.ts`; the `vi.mock` factories replace the IO surfaces before any real HTTP fires.

### 5.4 Env var management

**Job-level `env:` block:**

```yaml
env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
```

That is the **only** CI-side env var required. All other env vars (`BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `UPSTASH_REDIS_REST_URL`, etc.) are defaulted via `??=` in `tests/_setup/env.ts` and never reach a real third party (mocks own the IO).

Confirmed via Phase 0 grep — only two files read env vars directly in tests:
- `tests/_setup/env.ts` (the setup file itself)
- `tests/db/_fixtures/db.ts` (reads `DATABASE_URL` only)

**No Doppler integration. No real-secret pulls. CI's DB is a throwaway container with hardcoded `postgres/postgres` creds.**

### 5.5 Timeout adjustment

**Current:** `timeout-minutes: 15` (3× safety margin over the 3–5 min real-pipeline target the MVP authored).

**Recommended:** `timeout-minutes: 25`.

**Rationale:**
- Supabase image pull: ~30–60s first time, ~5–10s cached.
- Postgres container init + role bootstrap: 30–90s (slower than vanilla because Supabase init scripts create extension schemas and bootstrap auth roles).
- `pnpm drizzle-kit migrate` against fresh DB: 5–15s for 8 migrations.
- `pnpm vitest run` against fresh DB: load-bearing unknown. Tests are sequential (`fileParallelism: false`), each file's `afterEach` runs `TRUNCATE … CASCADE`, and there are ~30 DB-touching files. Conservative estimate: 5–10 min wall-clock.
- Headroom for the existing biome/tsc steps: ~1 min combined.
- Total estimate: 10–18 min. Setting `timeout-minutes: 25` gives ~40% safety margin without ballooning the failure-mode wall-clock.

**Not yet:** workflow split into fast + slow lanes, matrix testing, build-step inclusion, e2e — all Bundle 3+ territory per AGENTS.md §10 broader-CI-stack carry-forward.

### 5.6 Reviewer-cascade plan for execute chat

Per CLAUDE.md §5.11 + the close-out log decision 5 (critical-path reclassification), the execute chat owes two reviewer calls **after** the commit lands and CI is green, but **before** PR #54 is marked ready-for-review:

| Phase | Role briefing | Trigger | Scope |
|---|---|---|---|
| Phase 2 post-audit | `.claude/agents/code-reviewer.md` | After execute commits the YAML changes AND the pre-PR self-audit (§5.10) returns clean. | Reads diff against `.github/workflows/ci.yml`. Checks for refusal-trigger crossings (none expected — no `src/server/` touch). Flags any CRITICAL/HIGH findings. |
| After code-reviewer passes | `.claude/agents/security-auditor.md` | After code-reviewer's findings (if any) are fixed in-session. | Reads the same diff. Checks for `GITHUB_TOKEN` scope creep (`permissions:` should stay `contents: read`), service-container credential exposure in logs (postgres creds are hardcoded throwaway — acceptable), and any path that would let the CI surface ship a green-by-omission gate. |

**Invocation discipline (per CLAUDE.md §5.11):**
- Each reviewer call is a fresh-context `general-purpose` Agent invocation with the role briefing path baked into the prompt + the plan path (`@docs/plans/SCAFFOLD.18-postgres-ci.md`) + the new commits' SHA range + explicit tool-scope constraints (Read, Grep, Glob, Bash — no Edit/Write).
- FAIL findings within scope → fix in-session before PR is marked ready-for-review.
- SURPRISE findings outside scope → write to `claude-progress.md` and stop (per CLAUDE.md §5.11).

The plan states the cascade **explicitly** here so the execute chat cannot rationalize its way out of running them ("the YAML doesn't match the §1 path globs, so reviewer calls are optional") — they are owed.

`db-migration-reviewer` is **NOT** owed (no `src/db/schema/` or `drizzle/migrations/` changes in this stratum). `test-writer` is **NOT** owed (no new business-logic behavior — pure CI infra).

---

## 6. Execute-phase plan (what the next CC session does)

Step-by-step ordered list for the next execute chat:

### Step 1 — Commit the plan file

The plan file at `docs/plans/SCAFFOLD.18-postgres-ci.md` lands in the first execute-chat commit, paired with the YAML changes (per CLAUDE.md §5.1 "plan is the contract Phase 2 references" + kickoff §Phase 2 hand-off discipline).

### Step 2 — Edit `.github/workflows/ci.yml`

**File:** `/Users/hrishikesh/code/zugzwang/experiment/.github/workflows/ci.yml`.

**Additions (no deletions):**

| Line range (current) | Block added | LOC delta |
|---|---|---|
| After line 28 (`timeout-minutes: 15`) | Change `timeout-minutes: 15` → `timeout-minutes: 25` | 0 net (in-place edit) |
| After line 28 (job `env:` + `services:` blocks) | Add job-level `env: DATABASE_URL: ...` (3 lines) + `services: postgres: image: supabase/postgres:... ports: env: options: --health-cmd ...` (~12 lines) | +15 |
| After line 58 (after typecheck, before vitest step at line 62) | New step: `- name: Apply database migrations\n  run: pnpm drizzle-kit migrate` (with comment block per existing comment-density style: 3 lines comment + 2 lines step) | +5 |

**Estimated total LOC delta: ~20 additions, 1 in-place edit. No deletions.**

### Step 3 — Verify locally (sanity floor, not a substitute for CI)

`pnpm drizzle-kit migrate` against a local `supabase start`-spun DB should already pass (it's how dev exercises the migrations today). The execute chat does **not** need to re-verify locally — the CI run is the source of truth.

### Step 4 — Commit

Single commit on `feat/scaffold-finish-bundle-2`. Convention per AGENTS.md §10:

```
feat(ci): provision postgres service container for full vitest gate (SCAFFOLD.18)
```

Co-author footer per `.claude/skills/git-commit-with-coauthor/` discipline.

### Step 5 — Pre-PR self-audit (CLAUDE.md §5.10)

Execute chat runs the audit BEFORE pushing the commit. Item-by-item against this plan:

- PASS: `timeout-minutes: 25` set.
- PASS: `env: DATABASE_URL` set at job level (not step level).
- PASS: `services: postgres` block uses `supabase/postgres:17.6.1.107-x-6-x86`.
- PASS: healthcheck via `pg_isready -U postgres`.
- PASS: `ports: 5432:5432`.
- PASS: `pnpm drizzle-kit migrate` step slotted after typecheck, before vitest.
- PASS: existing steps unchanged (checkout, pnpm setup, node setup, install, biome, tsc, vitest).
- PASS: no Redis service container.
- PASS: no new env vars beyond `DATABASE_URL`.
- PASS: `permissions: contents: read` unchanged.
- PASS: `concurrency:` block unchanged.

Any FAIL → fix in-session, re-audit. Any SURPRISE → surface to Hrishikesh.

### Step 6 — Push commit + invoke reviewer cascade

After audit passes:

1. `git push origin feat/scaffold-finish-bundle-2`.
2. CI auto-fires on the new commit. Wait for CI result.
3. If CI green → invoke `code-reviewer` (per §5.6 above).
4. If `code-reviewer` clean → invoke `security-auditor` (per §5.6 above).
5. If both clean → `gh pr ready 54` (mark out of draft).

If CI red → diagnose, fix in-session (timeout bump? container env tweak? image-tag pin update?), re-commit, re-cascade. The reviewer-cascade only fires on a green CI.

### Step 7 — Operator hand-off (post-merge, not in execute scope)

Operator wires up Branch Protection (Settings → Branches → require `ci` check) **after** PR #54 merges. Configuring it pre-merge would block PR #54 itself (the protected check wouldn't yet exist as a success signal). Document in close-out.

---

## 7. Test plan — how execute knows it worked

| Layer | Scenario | Pass criterion |
|---|---|---|
| GHA workflow log | Service container init | `Postgres is up - executing command` (pg_isready success) within 100s |
| GHA workflow log | Migration apply | `pnpm drizzle-kit migrate` exits 0; 8 migrations reported applied (0000–0007) |
| GHA workflow log | Vitest run | All test files execute; INV-APPEND-ONLY-001 passes; all 13 trigger tests pass; both identity-pool tests pass; all *-event tests pass |
| GHA workflow log | Wall-clock | Total job duration < 25 min (timeout ceiling). Steady-state target after image cache warm: 10–15 min. |
| GHA workflow log | Reproducibility | Cancel + rerun the same SHA → green on second run too. No flakiness. |

**Anti-criteria (the plan fails if):**
- Any DB-dependent test is skipped (vitest reports `0 skipped` or matches the file count from Phase 0).
- Migration apply step is skipped or short-circuits.
- Job times out at the new 25-min ceiling (timeout bump insufficient; deeper investigation needed).
- Wall-clock variance >50% between consecutive runs (non-determinism in the migration apply or test fixture).

---

## 8. Risks + rollback

### Risk 1: Supabase image GHA-service-container compatibility

`supabase/postgres` extends the standard postgres entrypoint with role-bootstrap scripts. Risk that the bootstrap fails inside the GHA service-container model (no shared volume mount, no `docker exec` from host).

**Mitigation:** if the image fails to come up in CI, fall back to Path B (vanilla `postgres:17` + CI-only migration filter skipping 0007). Path B is documented in the Open questions section for web Claude ratification.

### Risk 2: Migration wall-clock exceeds 25-min timeout

If the cumulative `vitest run` + container init + migration apply exceeds 25 min, the job hits the ceiling.

**Mitigation:** bump `timeout-minutes` to 30 in a follow-up commit. The asymmetry (writing 25 first, bumping if it bites) gives early signal on whether the workflow needs split-lane infrastructure (Bundle 3+ territory).

### Risk 3: Image pull rate-limit

Docker Hub rate-limits unauthenticated pulls (100 pulls / 6 hours per IP). GHA's shared runner pool may share IPs across customers; high-traffic moments could rate-limit.

**Mitigation:** if rate-limit surfaces, switch to GitHub Container Registry pull or wire up Docker Hub authentication (out of scope for this stratum — defer until it bites). Probability low for a single-PR project.

### Rollback path

If the new commit breaks CI in a way that's worse than the current state (e.g., container won't init at all, no diagnostic logs), revert just the new commit. The existing `40db580` (MVP shell + `packageManager` pin) + `db0bdd6` (chore(logs)) commits remain — the branch returns to its pre-plan-execute state. PR #54 stays draft regardless.

---

## 9. Out of scope (explicit)

- Playwright e2e (HARDEN.* territory per AGENTS.md §10).
- `next build` step (CI doesn't build per AGENTS.md §2 "Do not run `pnpm build` during agent sessions" extension to CI).
- gitleaks / CodeQL / dependency audit / coverage / matrix testing (AGENTS.md §10 broader-CI-stack carry-forward, post-ADR sweep).
- Workflow split (fast + slow lanes, parallel jobs) — Bundle 3+.
- Any change to test organization (where INV tests live, how db-test fixtures bootstrap) — individual test-PR territory.
- Tracker amendments (v11 sweep absorbs).
- `mise.toml` literal-patch alignment (close-out carry-forward #2).
- Corepack PATH-race resolution (PRECURSOR.4 candidate, close-out carry-forward #3).
- `pnpm-lock.yaml` `lockfileVersion: 9.0` reconciliation (close-out carry-forward #4, drift-visibility mechanism by design).
- ADR-0006 file backfill (queued maintenance, Bundle 1 pattern).
- Operator-side branch protection setup (Step 7 hand-off, not execute scope).
- Real Doppler/Vercel secret pulls in CI (no real third-party IO from CI; mocks + throwaway DB own the surface).
- `biome --colors=off` fallback for the ANSI-escape annotation bug (close-out open question 2; watch on next CI run, follow-up commit if it surfaces).

---

## Open questions

**Q1 — pg_cron portability resolution: Path A (supabase/postgres image) vs Path B (vanilla postgres:17 + 0007 filter)?**

**Candidate:** Path A — `supabase/postgres:17.6.1.107-x-6-x86`. Production-faithful, no migration filter, no CI-vs-prod drift surface. Risk: GHA service-container compatibility unverified until first CI run.

**Resolve with:** web Claude ratification before execute chat opens. If A turns out to fail in CI on first run, the execute chat may pivot to B (with a same-commit close-out note documenting the pivot) or surface back to web Claude for a re-plan.

**Q2 — drizzle-kit migrate behavior on the Supabase image's pre-existing extensions schemas.**

The Supabase image bootstraps `extensions` schema at container init. Migration 0007's `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;` references that schema. If the image creates `extensions` with a different owner than `postgres`, the migration may fail on `permission denied`. Probability: low (Supabase image's init scripts run as `postgres` user; the schema should be owned by `postgres`). Verification: first CI run will show.

**Resolve with:** observe first CI run. If permission errors surface, the fix is to either (a) GRANT the extensions schema to the `postgres` role in a pre-migration step or (b) precede `drizzle-kit migrate` with `psql -c "GRANT ALL ON SCHEMA extensions TO postgres;"`. Either fix is small and in-scope for the execute chat.

**Q3 — Should the timeout bump be 25 (recommended) or 30?**

**Candidate:** 25. Conservative estimate is 10–18 min steady-state; 25 gives 40% margin. Bumping to 30 unnecessarily ballooning the failure-mode wall-clock.

**Resolve with:** observe first 2–3 CI runs. If any run pushes past 20 min, bump to 30 in a follow-up commit. If steady-state lands at 12–15 min, leave at 25.

---

## Phase 2 hand-off (per kickoff §Phase 2 discipline)

This plan file does **NOT** get committed in plan-mode. The execute chat commits it in its first commit alongside the YAML changes. PR #54 stays draft. No reviewer calls are invoked in plan-mode; the cascade in §5.6 fires in the execute chat after CI green.

**Q4 — Should the migration step have an explicit env-var override or rely on the job-level env?**

**Candidate:** rely on job-level env. Setting `env:` at step-level too is redundant and adds a place for the values to drift.

**Resolve with:** decided here. The execute chat sets `DATABASE_URL` at the job level only.

---

## ADRs needed

**None.** This plan consumes existing ADRs (ADR-0006 hosting, ADR-0008 Drizzle, ADR-0016 UUIDv7 / Supabase image tag) without minting new architectural decisions. The CI-infrastructure choices (image tag, healthcheck shape, timeout ceiling) are operational defaults, not architectural commitments.

If the execute chat surfaces a finding that **does** warrant an ADR (e.g., a CI-vs-production substrate divergence pattern that other infra streams will copy), it surfaces back to web Claude rather than minting unilaterally.

---

## Self-critique

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | Plan recommends `supabase/postgres:17.6.1.107-x-6-x86` without verified GHA service-container compatibility. First CI run is the actual proof. | Accepted as known risk; mitigation = fallback to Path B if A fails. Surfaced in §7 Risk 1 + §8 Q1. |
| 2 | low | Plan assumes vitest steady-state wall-clock of 5–10 min; this is an unverified estimate based on file count + sequential-fork model. Could be 15+ min in practice. | Accepted; mitigation = timeout headroom + observation pattern in §8 Q3. |
| 3 | low | Minor variance with close-out log claim of "four INV tests" — only one exists today. Variance does not change plan substance. | Documented in Phase 0 confirmation block (above the plan body); execute chat doesn't need to act on it. The four-INV-test framing in the close-out is an artifact of test-tagging convention, not of test existence. CI gates one INV-tagged file plus thirteen trigger tests; these together are the storage-layer enforcement of all four invariants. Critical-path reclassification (close-out decision 5) holds on this corrected evidence. |
| 4 | medium | Reviewer-cascade fires only after CI green. If reviewer-cascade surfaces a FAIL after CI green, that's wasted CI cycles. Counter-position: running reviewer-cascade before CI risks reviewing code that doesn't even pass typecheck. | Accepted; the green-CI-first ordering matches the per-stratum reviewer-call discipline in CLAUDE.md §5.11 (reviewer calls run "after pre-PR self-audit passes, before `gh pr create`"). |
| 5 | low | `drizzle-kit migrate` against a fresh Supabase image will likely run all 8 migrations because the `meta/_journal.json` tracking is empty in the container. If the image image pre-populates anything in `public.users` or other tables, migrations could conflict. | Probability: very low (Supabase image's pre-population is in `extensions`, `auth`, `storage` schemas — not `public`). If it surfaces, the fix is a pre-migration `DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;` — but that's heavy-handed and reserved for an observed failure, not an anticipatory step. |

---

## References

- `CLAUDE.md` §§1, 2, 5.1, 5.10, 5.11 — critical paths, invariants, plan-mode threshold, pre-PR self-audit, reviewer-call discipline
- `AGENTS.md` §§6, 9, 10 — Drizzle migration discipline, test conventions, broader-CI-stack carry-forward
- `docs/specs/SPEC.2.md` §0.1 — ADR-0006 entry (hosting topology, Postgres 17), ADR-0008 entry (Drizzle + single migration set), ADR-0016 entry (Supabase production image tag)
- `docs/logs/SCAFFOLD-finish-bundle-2.md` — close-out log: 6 substance items, 5 carry-forwards, critical-path reclassification (decision 5)
- `.github/workflows/ci.yml` — current MVP YAML being extended
- `tests/db/_fixtures/db.ts` — the shared DB-connection fixture every DB-touching test imports
- `tests/_setup/env.ts` — vitest `setupFiles` env-default surface (loaded by `vitest.config.ts`)
- `drizzle/migrations/0007_pg_cron_jobs.sql` — the load-bearing reason for the Supabase image choice (not vanilla `postgres:17`)
- PR #54 (draft) — `feat(ci): add github actions ci workflow (SCAFFOLD.18)` on `feat/scaffold-finish-bundle-2`
