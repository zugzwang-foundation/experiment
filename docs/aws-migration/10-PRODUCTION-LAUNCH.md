# 10 — Production launch checklist (practical path)

| | |
|---|---|
| **Purpose** | The ordered, minimum procedure to put production on AWS. Supersedes the *execution order* of `09-PRODUCTION-READINESS.md` §K; 09 stays the background record. |
| **Principle** | Keep only the safeguards that prevent a user-facing failure: data loss, downtime, duplicate jobs, broken sign-in, or a cutover that cannot be undone. |
| **Written** | 2026-09-27, against `main` = `ac5d854`. |

⛔ **Needs explicit approval, each time:** the AWS plan upgrade, every AWS write below, any Vercel or Cloudflare change, the production database migration (C4–C6), and the DNS switch (C8).

---

## Done (verified 2026-09-27)

- P1 (`zugzwang-production-cfn-exec` and `zugzwang-production-boundary` at v2) and P2 (`zugzwang-deny-staging` on `cdk-zzprod-deploy-role`) active; staging unchanged.
- `CDKToolkit-prod` (qualifier `zzprod`) bootstrapped; first real deploy through it succeeded.
- ACM certificate for `zugzwangworld.com` ISSUED (apex only), committed as `PRODUCTION_CERTIFICATE_ARN`.
- `Zugzwang-production-Security` (ECR `zugzwang-production`, log group, two bounded task roles) and `Zugzwang-production-Deploy` (role `zugzwang-production-github-deploy`, trusts only `environment:aws-production`) CREATE_COMPLETE.
- GitHub environment `aws-production`: reviewer `Zugzwang-world`, `main` only, admin bypass off.
- Doppler `prd` holds all 31 runtime key names.
- Supabase production is at `main`'s schema head: `4457354` (live on Vercel) and `main` carry identical migration files, and production `/api/health` reports `migrations: ok`.
- Decision: production RDS is PostgreSQL **Multi-AZ**. The Free plan is not a reason to change that.

## Phase A — now, on the Free plan (no AWS cost)

| # | Step | Who | Why it matters to users |
|---|---|---|---|
| A1 | `aws-production` secrets: `AWS_DEPLOY_ROLE_ARN` = `arn:aws:iam::849076101704:role/zugzwang-production-github-deploy`; `DOPPLER_TOKEN` = a service token scoped to `prd` | you | the deploy cannot run without them |
| A2 | Choose the alert e-mail (`ZZ_ALERT_EMAIL`) | you | an outage nobody hears about lasts longer |
| A3 | **Promote a current `main` build to Vercel production, write-pause OFF.** Check: `/api/health` canary = the promoted SHA; `/admin/markets` without a cookie redirects (the proxy runs) | you (approval) | without `src/proxy.ts` on Vercel, writes cannot be paused during the copy, so bets placed mid-copy would be lost |
| A4 | Confirm Doppler `prd` `BETTER_AUTH_URL` is exactly `https://zugzwangworld.com` (and `BETTER_AUTH_TRUSTED_ORIGINS` includes it) | you | a wrong value breaks sign-in on the new platform |
| A5 | Follow up EC2 vCPU case `179027487300068` (8 → 16) | you | 8 fits staging + production only with no rolling-update headroom |

## Phase B — after the paid-plan upgrade: build production empty, no traffic

Run from `infra/` on an up-to-date `main`. Costs start at B1 (NAT) and B2 (RDS). Staging is untouched throughout.

| # | Step | Command / action | Check |
|---|---|---|---|
| B1 | Network | `npx cdk deploy Zugzwang-production-Network --exclusively --toolkit-stack-name CDKToolkit-prod` | CREATE_COMPLETE; VPC `10.10.0.0/16` |
| B2 | Database (Multi-AZ, ~15 min) | `npx cdk deploy Zugzwang-production-Database --exclusively --toolkit-stack-name CDKToolkit-prod` | CREATE_COMPLETE; outputs `Endpoint`, `Port`, `CredentialsSecretArn` |
| B3 | App secret | `doppler run --project zugzwang-experiment --config prd -- node scripts/aws-migration/prod-secret.cjs <CredentialsSecretArn> <Endpoint> <Port> zugzwang`, read the dry run, then again with `--execute` | `zugzwang/production` exists with all keys (names only) |
| B4 | Deploy dispatch 1 | Actions → *Deploy to AWS* → `production`, `writes: paused`, `skip_migrations: true`; approve in `aws-production` | Compute (ECS + ALB) up. `verify` is **expected to fail** here: the database is empty and unmigrated |
| B5 | Deploy dispatch 2 | same, `writes: paused`, `skip_migrations: false` | migrations exit 0 in-VPC; `verify` green (`/api/health` db/migrations ok, `writesPaused: true`; `/api/ready` ready) |
| B6 | Smoke through the ALB (DNS unchanged) | `curl --resolve zugzwangworld.com:443:<ALB IP> https://zugzwangworld.com/api/health` and `/api/ready`; load `/` the same way | pages render against the empty database |

⚠ **Do not deploy Scheduler or Monitoring in Phase B.** Scheduler's rules call `https://zugzwangworld.com/api/cron/*`, which is still Vercel, so they would run every cron a second time against the live database. Monitoring depends on Scheduler. Both go in at C10.

⚠ **Order matters:** B3 before B4. The workflow deploys Compute without checking the secret exists; tasks that cannot read it fail to start and the stack rolls back.

## Phase C — cutover (explicit approval; target 20–30 min without writes)

| # | Step | Check |
|---|---|---|
| C1 | ≥ 1 day before: lower the Cloudflare TTL on `zugzwangworld.com` to 60 s | TTL 60 |
| C2 | Pause Vercel writes: `ZUGZWANG_WRITES_PAUSED=paused` on Vercel production, redeploy | `POST /api/bets/place` → 503 `error_writes_paused`; pages still load |
| C3 | Stop every job that writes to Supabase: unschedule Supabase `pg_cron` jobs; disable the three Vercel crons in `vercel.json` (`close-due-markets` every minute, `alarms-drain` every 5 min, `r2-orphan-sweep` every 6 h) | no Supabase cron job active; no Vercel cron invocations |
| C4 | Backup: `doppler run --project zugzwang-experiment --config prd -- node scripts/aws-migration/prod-backup.cjs` (checks), then with `--execute`; `sha256sum <dump>` | dump written, hash recorded |
| C5 | Restore into RDS: `node scripts/aws-migration/prod-restore.cjs <production ECS instance id> <dump> <sha256> --account=849076101704` (checks), then with `--execute` | one transaction; a dropped tunnel rolls back cleanly, so simply re-run |
| C6 | Verify: the restore's row census equals the dump; `/api/health`, `/api/ready` through the ALB; open a market, a profile and the sign-in page through the ALB | all match; sign-in page renders |
| C7 | **Go / no-go.** No-go → unpause Vercel, re-enable Supabase `pg_cron` and the Vercel crons. Nothing lost | — |
| C8 | DNS: Cloudflare `zugzwangworld.com` → CNAME to the ALB DNS name, **DNS-only (grey cloud)** | resolves to the ALB |
| C9 | Open AWS writes: dispatch `production`, `writes: open`, `skip_migrations: true` | `/api/health` `writesPaused: false` |
| C10 | Jobs and alerts: `npx cdk deploy Zugzwang-production-Scheduler --exclusively --toolkit-stack-name CDKToolkit-prod`, then `ZZ_ALERT_EMAIL=<address> npx cdk deploy Zugzwang-production-Monitoring --exclusively --toolkit-stack-name CDKToolkit-prod`; confirm the SNS e-mail | `close-due-markets` runs every minute; alarms OK; subscription confirmed |
| C11 | Place one real bet, sign in once, watch 60 min | bet lands; no 5xx; no duplicate cron effects |
| C12 | Leave Vercel paused with its crons disabled; keep the Supabase project, unused, until the dataset release | — |

**Rollback after C9** (AWS has taken writes) means moving data back to Supabase, which is a second migration. Decide at C7, not later.

## Deliberately not required for launch

Dropped because none prevents a user-facing failure: encrypting the cutover dump (delete it after the rollback window instead), rewriting the restore to run in-VPC (it is one transaction and the database is small), the A6 `X-Forwarded-For` measurement, the WAF rehearsal (production WAF starts in count mode and blocks nothing), revoking Supabase write grants (C2 + C3 stop all writers), and carrying `ref` in the OIDC `sub` (the `aws-production` branch policy already binds deploys to `main`).
