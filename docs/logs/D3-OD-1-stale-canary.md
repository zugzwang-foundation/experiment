# D3 OD-1 — stale-canary verification-tooling chore — session log

**Stratum:** D3 follow-up (OD-1 deferral) · **Branch:** `chore/fix-stale-canary-smoke` · **State:** MERGED — #173 squash-merged to `main` @ `48ac08c` · **Base:** `main` @ `fc1870c` (#172) · **Date:** 2026-06-27

> Filename note: deploy-stratum logs use a `D<n>` prefix (`D1.md`, `D2.md`, `D2-env-audit-descope.md`, `D3.md`); chose `D3-OD-1-stale-canary.md` to match that convention *and* tie to the D3 OD-1 lineage (a bare `OD-1-…` would be the only deploy log without the `D` prefix). This log PR is a separate `chore/d3-od1-canary-log` branch.

## What landed (files + PR#)
**PR #173** → `main`; canonical SHA = **`48ac08c`** (the squash-merge on `main`). Single signed commit (`1783192` on the branch), no Co-Authored-By. Content proof: `git diff 1783192 48ac08c` empty (correct tree landed). Scripts/docs only; prod-inert; CI green (2m53s).

- **`scripts/smoke-staging.ts`** — shared `assertCanarySha` helper (validate full 40-char git SHA; optional `EXPECTED_SHA` exact-match). `health-staging` (`:185`) and `health-preview` (`:202`) canary-prefix checks → `assertCanarySha`. `health-preview` env assertion (`:199`) `"preview" → "staging"` (preview is `stg`-sourced post-D1; kept as a fail-closed binding-revert tripwire). Header `--config staging → stg` (×2); item-5 doc → "bare commit SHA".
- **`scripts/migrate-staging.ts`** — `--config staging → stg` at `:8` (header) **and** `:42` (operator-facing runtime error message).
- **`docs/runbooks/staging-provisioning.md:157`** — dropped `ZUGZWANG_ENV_CANARY=staging-...`; noted the route reads `VERCEL_GIT_COMMIT_SHA` (ADR-0024 item 7).
- **`docs/runbooks/deploy-pipeline.md §4`** — three entries marked ✅ RESOLVED; `seed-staging.ts:8/:48` recorded ⏳ OPEN (SYNC sweep).
- **This log** ships in its own commit on `chore/d3-od1-canary-log` (docs-only follow-up PR).

## Decisions made
Recon → checkpoint → operator rulings (relay model; no in-CLI AskUserQuestion). All three rulings + three additions applied and proven:
- **Ruling 1 (SHA validation):** ACCEPTED — format-check always + optional `EXPECTED_SHA` exact-match. `EXPECTED_SHA` MUST be the **full 40-char** SHA (every log cites the short `41311bc`; the short form would false-fail) — stated in the helper comment and the bonus-proof invocation. ✓
- **Ruling 2 (the `:199` SURPRISE):** APPROVED — `env "preview" → "staging"`; `env === "staging"` retained as a deliberate fail-closed tripwire for Preview silently reverting to the prod config. ✓
- **Ruling 3 (`--config staging` cleanup):** SCOPE **(ii)** — fix only in files already touched (`migrate-staging.ts:8`+`:42`, `smoke-staging.ts:6/7/14`). `seed-staging.ts:8/:48` **deferred to the combined SYNC sweep** (file otherwise untouched; doc/string reconciliation is periodic, not per-task — `docs/maintenance.md`). ✓
- **Addition 1 (confirm-before-apply):** verified `:185 / :199 / :202` are the ONLY broken assertions — route returns 5 fields (`status, env, canary, db, migrations`), no region/db-name/URL echo to shift; script reads only `env/canary/db`. Cause map: `:185`←bare-SHA canary; `:199`←preview→stg re-sourcing; `:202`←bare-SHA canary. Clean → proceeded. ✓
- **Addition 2 (prove the preview side):** done — exercised `health-preview` against the PR's own stg-sourced preview deploy. ✓
- **Addition 3 (keep §4 honest + re-stage):** §4 registry updated to resolved/open; `deploy-pipeline.md` re-staged md5-verified to `~/Downloads` (post-edit `f7dd70fd…`, superseding the pre-edit `0b7cbc2e…`). ✓

## Proof table
| Check | Result |
|---|---|
| `just verify` (typecheck + biome + build) | All checks passed |
| `health-staging` (format-only) | **PASS** — `env=staging, canary=41311bc9…(40-char), db=ok` |
| `health-staging` exact-match (`EXPECTED_SHA`=full staging SHA) | **PASS** |
| `health-staging` negative control (`EXPECTED_SHA`=`000…0`) | **FAIL** as designed — gate fires (`canary != EXPECTED_SHA`) |
| `health-preview` (PR's own stg-sourced preview, canary=`1783192…`) | **PASS** — `env=staging` (old `env==="preview"` + `startsWith("preview-")` would BOTH have failed) |
| CI (#173) | **GREEN** — Biome, tsc, drizzle journal, migrate, drift, unit+integration |

Staging deployed SHA re-confirmed at apply-time = `41311bc9ceac494d01abd9b2458774f856e46cd6` (full 40-char). The preview's canary was this chore's own commit `17831925e67dc6aaf439c23cc94b1fbbafdd82b8` — i.e. we merged a change watched passing on both the staging and preview paths.

## Open questions
- **r2-scope item 11 — SURFACED-OPEN, NOT resolved here.** `smoke:staging` item 11 (`r2-scope`, OQ-13) FAILs, independent of this chore (item untouched): `staging-uploads-token → zugzwang-uploads` = HTTP **404** (authenticated ⇒ `verify-r2-scope.ts` counts it a cross-env isolation failure). **Asymmetric** — the other 3 probes deny (403), incl. `staging-pfp-token → zugzwang-pfp`. Per `staging-provisioning.md:156`, staging's own `R2_BUCKET_UPLOADS` is also `zugzwang-uploads`, so it's either a **stale test premise** (staging↔prod share the bucket) or a **real uploads-token mis-scope** to the prod bucket — undisambiguable without the CF console / write-only staging R2 secrets. Security-relevant. → **forthcoming `@security-auditor` recon as a separate task; not fixed in #173.**

## Next session starts at (exact next action)
1. **`@security-auditor` recon on the r2-scope finding** — determine stale-test-premise vs real cross-env token mis-scope (inspect CF R2 bucket/token scopes + the actual staging `R2_BUCKET_*` values). Pass this log + PR #173. Until resolved, `smoke:staging` exits non-zero on a healthy staging — gate on the per-item `[PASS] health-staging` line, not the overall exit code.
2. **SYNC sweep** — fold `seed-staging.ts:8/:48` `--config staging → stg` (the last of the Appendix-D trio).

## Context to preserve
- `/api/health` `canary` = `VERCEL_GIT_COMMIT_SHA` (bare 40-char SHA), `env` = `ZUGZWANG_ENV` (ADR-0024 item 7). No `staging-`/`preview-` prefix; no `ZUGZWANG_ENV_CANARY`.
- **Post-D1, Preview is `stg`-sourced** ⇒ a preview reports `env:"staging"` + bare-SHA canary; staging-vs-preview is told apart by **which URL is curled** (`STAGING_URL` vs `PREVIEW_URL`), not by env/canary. Preview `/api/health` is publicly reachable (HTTP 200 — no Deployment Protection blocking).
- `smoke:staging` is once again a valid staging gate (the `deploy-pipeline.md §4` "use direct curl, not smoke" warning is removed) — modulo the open r2-scope item.
- `EXPECTED_SHA` exact-match is opt-in (full 40-char only); the no-arg run is format-only. Doppler config is `stg` (project `zugzwang-experiment`); run via `doppler run --config stg -- pnpm smoke:staging`.
- Untouched by design: prod, D5, `/api/health` route, `migration-drift.ts`, schema/migrations/workflows, ADRs. `seed-staging.ts` left for SYNC.
- D3 confirmed fully closed before this chore: plan #170, log #171 (`9ccdcde`), prod-promote #172 (`fc1870c`).

## Time
- Single session, 2026-06-27 (recon + checkpoint + execute + proof; this log a docs-only follow-up). Logged 2026-06-27 ~05:19 UTC.
