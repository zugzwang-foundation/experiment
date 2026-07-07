# DP.1 — session log (staging ← main sync + 0020–0023 migration proof)

**Task:** DP.1 — sync `staging` → `main` and prove migrations **0020–0023** on real Supabase.
Deploy action on the **resettable sandbox only** (ADR-0024 / `docs/runbooks/deploy-pipeline.md`
§2); **prod untouched**. Hard-gated sequence: read-only pre-flight → operator "go" →
fast-forward push → GHA migrate watch → `/api/health` gate → seed → smoke → this log. No code
changes; one doc-drift rider (below).

## What landed

- **Deploy action (not a commit):** `origin/staging` fast-forwarded
  **`7d2bd75` → `f0be3803c2a3afd511f84ab07cf8cdbfb7817cb0`** (= the `origin/main` tip, the
  SYNC-SHA) via the operator-ratified pinned-SHA push. Migrations 0020–0023 applied to the
  staging Supabase by `staging-migrate.yml` and proven via the per-hash health gate + the
  smoke journal count (both below).
- **This log PR** (`chore/dp1-log`): `docs/logs/DP-1.md` + a one-line **AGENTS.md §3 drift
  rider** — the `api/` tree's cron list gains `alarms-drain` (route landed at AUDIT-FIX-B1
  #199; tree never updated; `vercel.json` carries all three crons). Closing-ritual same-PR
  doctrine, precedent #212. Flagged as a rider in the PR body (kickoff enumerated the log
  only).

## DP.0a re-verify (incident-log mandate)

- `autoAssignCustomDomains` = **false** ✓ — read via
  `vercel api /v9/projects/experiment?teamId=zugzwang-worlds-projects` (project
  `prj_5krm0VEQQ9TleA2rjUBIL3oLJpiI`). `autoAssignCustomDomainsUpdatedBy` =
  `mJ8hdOXmxzga7YvpbzhfHPF0` (an opaque user id this time, not `system`) — per the standing
  rule the **boolean is the gate**, the attribution field is not load-bearing. No remediation
  needed; prod stayed out of the auto-serve path throughout.

## Pre-flight facts (as reported before "go")

- `origin/staging` = `7d2bd751885475e880931485e9304e76fedc3107` (matched the expected
  `7d2bd75`) and was a **strict ancestor** of `origin/main` =
  `f0be3803c2a3afd511f84ab07cf8cdbfb7817cb0` → pure fast-forward. Working tree clean.
- `staging-migrate.yml` present on `main`, **zero diff** vs the copy staging last ran (last
  touched `b724094`).
- **Staging env sanity (CLI-visible — no dashboard glance needed):** the project has a Vercel
  **custom environment** slug `staging` (branch matcher `equals staging`, id
  `env_vJr9cWebQUS9h2bo1WzIyMAp7Btz`) carrying the full stg-synced var set — `DATABASE_URL`,
  `BETTER_AUTH_URL`/`_SECRET`, `ZUGZWANG_ENV` + `_CANARY`, `DATABASE_URL_STAGING`,
  `STAGING_PROJECT_REF_FRAGMENT`, `CRON_SECRET`, `DOPPLER_*`, all three R2 arms
  (uploads/pfp/market-media), Sentry/PostHog/Upstash/Turnstile/Resend/Google/OpenAI,
  `ADMIN_PASSWORD`. Read via `vercel api /v10/projects/<id>/env` — **names/targets only**,
  values write-only as always.

## The push (operator-ratified command deviation)

- Local `main` was **stale at `1258147`** (pre-B8-merge) — the kickoff's literal
  `git push origin main:staging` would have synced the wrong SHA (staging would still
  fast-forward, but the canary could never equal the SYNC-SHA). Surfaced at pre-flight;
  operator GO ratified the pinned form and mandated **local `main` NOT be fast-forwarded**
  (local checkout kept out of the deploy path):

  ```
  git push origin f0be3803c2a3afd511f84ab07cf8cdbfb7817cb0:refs/heads/staging
  ```

- Result: `7d2bd75..f0be380` fast-forward, no force.

## GHA migrate run

- **Run id `28858303643`** (`staging-migrate.yml`, triggered by the push, head
  `f0be3803…`) — **GREEN in 32s**, "Migrate staging DB" step ✓. Exit code is NOT the gate
  (drizzle-orm #5769) — the health gate below is.
- Annotation (warning only, no action taken): Node.js 20 deprecation on `actions/setup-node@v4`,
  `dopplerhq/cli-action@v3`, `pnpm/action-setup@v4` — runner forces Node 24; parked-class
  maintenance for a future chore.

## Health gate (verbatim JSON)

- **Pre-push:**

  ```json
  {"status":"ok","env":"staging","canary":"7d2bd751885475e880931485e9304e76fedc3107","db":"ok","migrations":"ok"}
  ```

- **Post-push — converged on poll 1** (~3 min after push; the Vercel build had already
  promoted the staging alias by the time the GHA watch finished):

  ```json
  {"status":"ok","env":"staging","canary":"f0be3803c2a3afd511f84ab07cf8cdbfb7817cb0","db":"ok","migrations":"ok"}
  ```

- Gate fields: `env="staging"` ✓ · `db="ok"` ✓ · `migrations="ok"` ✓ (per-hash drift check —
  the f0be380 code expects the 0020–0023 hashes, so "ok" **proves** they applied on real
  Supabase) · `canary == SYNC-SHA` ✓.

## Seed

- `doppler run --config stg -- pnpm db:seed:staging` → **0 new rows, 200 already present**
  (idempotent no-op against the previously-seeded `identity_pool`; target
  `aws-1-ap-south-1.pooler.supabase.com:5432`).

## Smoke (per-item — `doppler run --config stg -- pnpm smoke:staging`)

| # | Item | Result | Note |
|---|---|---|---|
| 1 | dns | PASS | `b2cddc96cb109c21.vercel-dns-017.com.` → 216.150.16.129 / 216.150.1.129 |
| 2 | https | PASS | 200 |
| 3 | app-loads | PASS | 200 |
| 4 | health-staging | PASS | env=staging, canary=`f0be3803…`, db=ok |
| 5 | health-preview | SKIP | `PREVIEW_URL` not set (expected) |
| 6 | migrations-applied | PASS | **24 migrations, matches `_journal.json`** — independent 0020–0023 proof |
| 7 | identity-pool-seeded | PASS | 200 pool rows |
| 8 | sentry-routing | SKIP | `SENTRY_API_TOKEN`/`SENTRY_ORG` not in shell — the kickoff-expected skip |
| 9 | r2-scope | FAIL | **standing since #173, exact same signature** — `staging-uploads-token → zugzwang-uploads` reached (HTTP 404 = authn'd); other 3 cross-probes deny 403. **NOT a regression**; triage still parked. |

- Summary line: `6 passed, 1 failed, 2 skipped (of 9)`. Kickoff numbering drift (harmless):
  it cited "item 9" for sentry and "item 11" for r2-scope; the suite has 9 items with sentry
  at 8 and r2-scope at 9 — the expected skip and the standing FAIL are exactly the ones
  observed, nothing else skipped or failed.

## Sandbox cron playbook (kickoff step 9)

The three `vercel.json` crons do **NOT** fire on staging (Vercel crons run against the
production deployment only). On the sandbox they are triggered manually:

```
curl -H "Authorization: Bearer $CRON_SECRET" https://staging.zugzwangworld.com/api/cron/close-due-markets
curl -H "Authorization: Bearer $CRON_SECRET" https://staging.zugzwangworld.com/api/cron/r2-orphan-sweep
curl -H "Authorization: Bearer $CRON_SECRET" https://staging.zugzwangworld.com/api/cron/alarms-drain
```

Production schedules for reference (`vercel.json`): `r2-orphan-sweep` `0 */6 * * *` ·
`close-due-markets` `* * * * *` · `alarms-drain` `*/5 * * * *`.

## Decisions made

- **Pinned-SHA push** over the literal `main:staging` (stale local `main`) — operator-ratified
  at GO; local `main` deliberately left un-fast-forwarded.
- **AGENTS.md §3 cron-tree rider** rides this log PR (same-PR doctrine; surfaced as a
  deviation, not silently added).
- DP.0a attribution field ignored per the standing incident rule — boolean-only gate.

## Open questions

- **r2-scope standing FAIL** (#173): stale-premise vs real token mis-scope still untriaged —
  unchanged by DP.1, still parked.
- GHA Node-20 deprecation annotations on three actions in `staging-migrate.yml` — cosmetic
  today; a future chore bumps the action majors.

## Next session starts at

- Operator merges this PR after web skim (PK table below). Staging is now proven at
  `f0be3803…` with 0020–0023 applied — the next tracker step is the prod leg per
  `docs/runbooks/deploy-pipeline.md` §3 (expand/contract + migrate-before-serve + scoped
  promote), whenever the tracker sequences it.

## Context to preserve

- **Staging tip == main tip `f0be3803…`** as of 2026-07-07. The health canary flips on
  **serve**, not on migrate — expect `migrations:"drift"` only in the window between DB
  migrate and code serve (none observed here; gate converged on poll 1).
- **Vercel env listing IS CLI-visible** via `vercel api /v10/projects/<id>/env` (names +
  targets + custom-env ids; values write-only). The staging custom environment is
  `env_vJr9cWebQUS9h2bo1WzIyMAp7Btz`, branch matcher `equals staging`.
- Repo is NOT `vercel link`ed locally (no `.vercel/project.json`) — scope every `vercel api`
  call with `?teamId=zugzwang-worlds-projects`.
- **PK staging:** `~/Desktop/zz-pk-refresh-DP.1/` — 2 files, md5-verified (table below).

## PK update table

| File | State | Keep/Verify/Add/Remove | Reason |
|---|---|---|---|
| `DP-1-log.md` | `chore/dp1-log` (this PR, `docs/logs/DP-1.md`) | Add | this log — `-log` suffix |
| `AGENTS.md` | `chore/dp1-log` (this PR) | Verify (replace stale PK copy) | §3 cron tree + `alarms-drain` |

## Time

2026-07-07, one session: pre-flight (DP.0a + git + env) ≈10 min · GO → push + GHA watch +
health gate ≈5 min · seed + smoke ≈5 min · log + AGENTS.md rider + PR + PK staging ≈15 min.
