# AWS-MIGRATION-1 — Phase 1: the database stack, and proving the container

**Branch:** `feat/aws-migration` (= `origin/main` + the CDK commit `4b3efd7` replayed).
**Approved:** 2026-09-24 by the operator ("all approved"), against
`docs/reports/AWS-MIGRATION-REPORT.html`.
**Scope:** infrastructure-as-code and build tooling only. Nothing live is touched;
no `cdk deploy`, no database, no secret is read.

## 0. What was already done (commit `4b3efd7`) — verified on the new base

| Item | Evidence |
|---|---|
| `output: 'standalone'` gated on `BUILD_TARGET=docker` | `next.config.ts` |
| `/api/health` falls back to `APP_COMMIT_SHA` / `APP_REGION` | `src/app/api/health/route.ts`; `tests/server/health/region.test.ts` 8/8 |
| `Dockerfile` (`runner` + `migrate` targets), `.dockerignore` | on disk; `migrate` target build in progress as proof |
| Five CDK stacks per environment | `infra/lib/*`; `tsc` clean; `cdk synth --all` → 10 templates |
| `deploy-aws.yml`, manual-dispatch only | `.github/workflows/deploy-aws.yml` |

## 1. What this phase adds

### 1.1 A database stack — `infra/lib/database-stack.ts` (new)

RDS for PostgreSQL 17, one instance per environment, in **isolated** subnets.

| Property | Value | Why |
|---|---|---|
| Engine | PostgreSQL 17 (`VER_17_6`) | Same major as Supabase today; `pg_cron` available |
| Subnets | `PRIVATE_ISOLATED`, one per AZ — **new** in the network stack | No route to the internet at all, NAT or not |
| Security group | inbound 5432 **from the service SG only**; no CIDR rule | Report §08: every rule references a group |
| Parameter group | `shared_preload_libraries = pg_cron`, `cron.database_name = zugzwang` | The liquidity injector and drift check run *inside* the DB (migrations 0007/0011/0027) |
| Credentials | `Credentials.fromGeneratedSecret("zugzwang")` — a Secrets Manager secret CDK creates | The app still reads `DATABASE_URL` from the app secret, which the operator sets from this. No cross-stack reference into compute, so no cycle |
| Storage | gp3, 20 GB, autoscaling to 100 GB, encrypted | Dataset is 46 MB (measured 2026-09-25); autoscaling is a belt |
| Multi-AZ | production `true`, staging `false` | Config-driven |
| Backups | 7 days production / 1 day staging; PITR is implied by automated backups | Report §09 |
| Deletion protection | production `true` | An `rds:DeleteDBInstance` must be a two-step act |
| Removal policy | `SNAPSHOT` | A `cdk destroy` leaves a final snapshot, never nothing |
| Public access | `false` | |
| Logs | `postgresql` → CloudWatch, retention per config | |
| Outputs | endpoint address, port, secret ARN | What the operator needs to compose `DATABASE_URL` |

### 1.2 Network stack changes — `infra/lib/network-stack.ts`

- Add a `database` subnet group, `PRIVATE_ISOLATED`, `/24`, **unconditionally** (the
  staging VPC has no NAT and still needs isolated DB subnets).
- Add `databaseSecurityGroup` with one ingress rule: 5432 from `serviceSecurityGroup`.
  Both SGs live in this stack, so the rule is not a cross-stack edge.
- Export `databaseSubnets`.

### 1.3 Config — `infra/config/types.ts`, `staging.ts`, `production.ts`

New `database` block: `instanceClass`, `instanceSize`, `multiAz`, `allocatedStorageGb`,
`maxAllocatedStorageGb`, `backupRetentionDays`, `deletionProtection`.

### 1.4 Wiring — `infra/bin/zugzwang.ts`

`DatabaseStack` after `NetworkStack`, before `ComputeStack`; tagged like the rest.
Compute is **not** changed: it keeps reading `DATABASE_URL` from the app secret.

### 1.5 Migration guards — `scripts/migrate-staging.ts`, `scripts/migrate-prod.ts`

**No code change.** The guard is `DATABASE_URL_*` must contain the operator-set
`*_PROJECT_REF_FRAGMENT`. On RDS the fragment becomes a substring of the RDS endpoint
(e.g. `zugzwang-staging.…ap-south-1.rds.amazonaws.com`) — a Doppler value, set at
cutover. The earlier plan's "rewrite the guards" is downgraded to a runbook step; the
docblocks say "Supabase" and are left as-is (surgical-change rule).

### 1.5a `.dockerignore` — one glob instead of one filename

The runner build failed at type-check on the new base: `tests/unit/debate/
resolution-block-data.test.ts` now imports **both** `docs/data/staging-markets-snapshot.json`
and `docs/data/prod-markets-snapshot.json`, and the ignore file re-admitted only the first by
name. Changed to `!docs/data/*.json`, so the next snapshot is admitted by shape. The build is
green after the change (§3 item 5).

**Follow-up, not a blocker (recorded from the build's own lint output):** the Dockerfile
passes `SENTRY_AUTH_TOKEN` as an `ARG` copied into `ENV` in the *build* stage, which Docker
flags (`SecretsUsedInArgOrEnv`) because ARG values are recorded in that stage's history. The
runner stage copies files, not environment, so the token never reaches the shipped image —
but the cleaner shape is a `--mount=type=secret` for the token alongside the env file, the
same mechanism the build already uses for `DATABASE_URL`. Do it when the token actually
exists in Doppler (§3.1); today the ARG is empty.

### 1.6 Docs

- `infra/README.md`: database stack row; "before a first deploy" gains the two RDS steps
  (compose `DATABASE_URL` from the generated secret; set the ref fragment).
- ADR: RDS PostgreSQL replaces Supabase as the database host, scoped-superseding the
  Supabase-specific parts of ADR-0024 (pooler mode, `db.<ref>.supabase.co` guidance).

## 2. Out of scope, deliberately

- `cdk deploy` of anything — Phase 2, needs AWS credentials on this machine.
- RDS Proxy — decision D4 in the report; decided under rehearsal.
- VPC endpoints (report N1) — fast follow, not a blocker.
- Compute changes for a shared cache handler (`maxCapacity > 1`).
- The Doppler / Secrets Manager population — operator-side.

## 3. Verification (this phase)

1. `infra`: `pnpm typecheck` clean; `pnpm synth` → **12** templates (6 per env).
2. `cdk synth` output for `Zugzwang-production-Database` shows: `PubliclyAccessible: false`,
   `MultiAZ: true`, `DeletionProtection: true`, `StorageEncrypted: true`, a parameter
   group carrying `shared_preload_libraries: pg_cron`, and a DB subnet group whose
   subnets are the isolated ones.
3. Root: `pnpm tsc --noEmit` clean (no `src/` change expected).
4. `docker build --target migrate` succeeds (no secrets needed).
5. `docker build --target runner` — **requires a build env with a reachable database**;
   deferred to Phase 2 where Doppler `stg` is available. Recorded, not skipped silently.

## 3.1 Phase 2 blocker found during Phase 1 — the Sentry variables are not in Doppler

Measured 2026-09-24 against Doppler by name (`doppler secrets --only-names`, no values read):

| Variable | `stg` | `prd` | Who provides it today |
|---|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | **missing** | **missing** | Vercel's Sentry marketplace integration, injected into the Vercel project only |
| `SENTRY_ORG` | missing | missing | same |
| `SENTRY_PROJECT` | missing | missing | same |
| `SENTRY_AUTH_TOKEN` | missing | missing | same |

**Why it blocks:** `instrumentation.ts:43` throws at boot when `ZUGZWANG_ENV` is `staging`
or `prod` and the DSN is absent — observed live: `doppler run --config stg -- pnpm dev`
died on exactly that line. An ECS task with `ZUGZWANG_ENV=staging` and the Doppler-sourced
secret would therefore **crash-loop**, and `deploy-aws.yml`'s "Fetch build-time values from
Doppler" step would fail on the DSN before the image is even built. `RUNTIME_SECRET_KEYS`
in `infra/config/types.ts` already lists `NEXT_PUBLIC_SENTRY_DSN`, so the CDK expects it in
the app secret — the value just has nowhere to come from yet.

**What does not block:** the Docker *build*. Sentry's build plugin skips source-map upload
without a token (a warning, not a failure), so the runner image can be proven now.

**Action (operator, before Phase 2):** copy the four values from the Vercel project's
environment variables into Doppler `stg` and `prd`. Doppler then becomes their source of
truth on both platforms, which is what ADR-0024 D1 says it should be anyway.

## 4. Open questions for the operator

- OQ-1 Staging Multi-AZ: plan says `false`. Confirm.
- OQ-2 Backup retention production: plan says 7 days. Confirm.
- OQ-3 The RDS master username is `zugzwang`. Confirm or name it.
