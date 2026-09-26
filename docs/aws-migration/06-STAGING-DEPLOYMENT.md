# 06 — Staging Deployment Record (AWS-MIGRATION-2)

| | |
|---|---|
| **Date** | 2026-09-24 (UTC), sessions 18:54 → 20:25 |
| **Account / region** | `849076101704` · `ap-south-1` · identity `user/zugzwang-deploy` |
| **Scope** | STAGING ONLY. Production Supabase, production AWS, DNS/Cloudflare, production secrets and the EventBridge Scheduler were not touched. |
| **Status** | Staging is **running the application on AWS over HTTPS at `staging.zugzwangworld.com`** (the real staging hostname; `aws-staging` also serves) against a staging RDS holding a verified restore of the production backup. **Authenticated write path verified (§8); Scheduler + Monitoring deployed and verified (§9).** |
| **Branch** | `feat/aws-migration` (uncommitted at the time of writing — see §6) |

## 1. Resources created — with identifiers

| Stack | Resource | Identifier |
|---|---|---|
| CDKToolkit | bootstrap (S3 asset bucket, ECR asset repo, deploy roles) | stack `CDKToolkit`, version 32 |
| **Network** | VPC | `vpc-0602c7b3c1ddc94e7` (`10.20.0.0/16`, 2 AZs) |
| | Public subnets | `subnet-0536bd775010610d4` (10.20.0/24, 1a) · `subnet-0c9dfdac9b45611d3` (10.20.1/24, 1b) |
| | Database subnets (isolated, no default route) | `subnet-06bab3e100660626d` (10.20.2/24, 1a) · `subnet-085914642a657db23` (10.20.3/24, 1b) |
| | Private subnets (→ NAT) | `subnet-05950ed3898ebc29a` (10.20.4/24, 1a) · `subnet-0201a2838948f6283` (10.20.5/24, 1b) |
| | Internet gateway | `igw-0e47e06ae4a014e67` |
| | **NAT gateway** (added on approval after the egress probe) | `nat-06720eec44acc34bf`, EIP `13.207.106.107` |
| | Security groups | ALB `sg-09252f7ba3ed0c7b6` · Service `sg-074dda541437a9c63` · Database `sg-00a016b34d9e9f722` |
| **Database** | RDS PostgreSQL 17.6, `db.t4g.micro`, single-AZ, 20 GB gp3 encrypted, 1-day backups, not public | `zugzwang-staging-database-postgres9dc8bb04-69fo9sqgtcvo` · endpoint `…cpiuei4au2fa.ap-south-1.rds.amazonaws.com:5432` · db `zugzwang` |
| | Parameter group (`shared_preload_libraries=pg_stat_statements,pg_cron`, `cron.database_name=zugzwang`) | `zugzwang-staging-database-parameters6795e5b4-hhkwiwlhwuvg` |
| | Generated master credentials | Secrets Manager `zugzwang/staging/database` |
| **Security** | ECR repository | `zugzwang-staging` → `849076101704.dkr.ecr.ap-south-1.amazonaws.com/zugzwang-staging` (tags `staging-4b3efd7`, `staging-4b3efd7-migrate`) |
| | Log group | `/zugzwang/staging/app` (14-day retention) |
| | Roles | task execution role, task role (no AWS permissions) |
| **Compute** | ECS cluster | `zugzwang-staging` |
| | EC2 (ASG min 1 / max 2, `t3.small`, private subnets, no public IP) | `i-0ee255037045d2303` (current) · ASG `Zugzwang-staging-Compute-CapacityASG899CFB89-fpoJU2cWd0RW` |
| | Task definitions | `ZugzwangstagingComputeAppTaskDE7610D8:1` · `ZugzwangstagingComputeMigrationTask56B7D557:1` |
| | ALB (HTTP :80 listener only — no certificate yet) | `Zugzwa-Alb16-HmxvcNoTyCq8` → `Zugzwa-Alb16-HmxvcNoTyCq8-630272462.ap-south-1.elb.amazonaws.com` |
| **Secrets** (operator-managed, not CDK) | App runtime secret, 34 keys, `DATABASE_URL`/`DATABASE_URL_STAGING` → staging RDS with `sslmode=require` | `zugzwang/staging` (`…secret:zugzwang/staging-LLxPz1`) |
| **Quota** | EC2 on-demand Standard vCPU increase 5 → 16 | request `c47e2f67943343a4b9dfd2be5342db4bvnBZiJWf`, PENDING |
| Not deployed | Scheduler (by instruction) · Monitoring (imports Scheduler's rule exports; rolled back, `ROLLBACK_COMPLETE`) | — |

## 2. Billable resources

RDS instance + 20 GB storage + 1-day backups · EC2 `t3.small` (1, briefly 2 during rolling replacement) · NAT gateway + EIP (hourly + data) · ALB (hourly + LCU) · ECR storage (~0.35 GB) · CloudWatch logs · Secrets Manager (2 secrets) · CDKToolkit S3/ECR (negligible). Everything is tagged `Project=Zugzwang`, `Environment=staging`, `ManagedBy=CDK|operator`.

## 3. Tests performed

| # | Test | Result |
|---|---|---|
| T1 | `cdk synth` all staging stacks; `tsc`; Biome | ✅ |
| T2 | Network: SG rules by group reference only; DB subnets `local`-only routes; private subnets → NAT; public → IGW | ✅ verified live |
| T3 | RDS: available, not public, encrypted, parameter group in-sync with `pg_cron` | ✅ |
| T4 | Docker `migrate` and `runner` images build; runner serves `/api/health` locally with canary | ✅ |
| T5 | ECS task RUNNING/HEALTHY; ALB target healthy; `/api/health` `db: ok, migrations: ok, canary staging-4b3efd7, region ap-south-1` | ✅ |
| T6 | Migration task (in-VPC): all 32 migrations applied, journal matches (per-hash) | ✅ after three fixes (§4) |
| T7 | Egress probe from the private subnets (Sentry, Upstash, OpenAI, Cloudflare) | ✅ all reachable (❌ before the NAT) |
| T8 | Integration probe with staging credentials: Upstash `PONG` · OpenAI 200 · R2 `HeadBucket` · Sentry reachable · Resend valid sending-only key (`restricted_api_key`) | ✅ |
| T9 | Restore pre-flight 6/6 (target guard, SHA-256, tunnel, journal, seed census, replica-role permission) | ✅ |
| T10 | Restore: pause cron → truncate 29 tables → `pg_restore --data-only` (FK checks suspended on the connection) → resume cron; exit 0, 42.7 s, no warnings | ✅ |
| T11 | Post-restore verification: 21 checks — schema counts, all triggers re-enabled, `pg_cron` installed, 4 jobs active and executing, journal 32, **row counts exact vs the archive**, INV-2, I-LOT-SUM, I-GENESIS, sequences, **DELETE on `bets` rejected, UPDATE on `dharma_ledger` rejected** | ✅ 21/21 |
| T12 | Application on restored data: Discovery lists 6 markets · market page with prices and chart · profile page · `.md` export · quote route 401 without session | ✅ |

**Tests failed:** none outstanding. Transient failures during the run, each fixed and re-tested: the parameter-group description (non-ASCII), the app's missing `sslmode`, `drizzle-kit`'s single-transaction migrate (55P04 on a fresh DB), Corepack downloading `pnpm` at task start, `WITH SCHEMA extensions` / `pg_cron` schema on RDS, awsvpc-on-EC2 having no egress without a NAT, `--disable-triggers` on RDS. All are recorded in §4 so production does not rediscover them.

**Not tested:** a signed-in write path (place a bet) — requires Google OAuth against a real HTTPS origin matching `BETTER_AUTH_URL` (`https://staging.zugzwangworld.com` still resolves to Vercel). Blocked on §5 item 2.

## 7. HTTPS on staging — verified (2026-09-25 04:10–04:25 UTC)

| Item | Result |
|---|---|
| Certificate | ACM `6dd63977-00e2-4b16-82e4-e6e3264b8e09` for `aws-staging.zugzwangworld.com`, issuer *Amazon RSA 2048 M04*, valid 2026-09-25 → 2027-04-10, DNS-validated in ~30 s |
| ALB listeners | **443 HTTPS** (`ELBSecurityPolicy-TLS13-1-2-2021-06`, forwards to the app) · **80 HTTP → 301 → 443** |
| DNS | `aws-staging.zugzwangworld.com` CNAME → ALB (DNS-only) · `staging.zugzwangworld.com` **unchanged**, still Vercel (`server: Vercel`, 200) |
| `https://aws-staging.zugzwangworld.com/api/health` | 200 · chain trusted (`ssl_verify_result=0`) · `db: ok, migrations: ok, canary staging-4b3efd7` |
| Redirect | `http://…/api/health` → 301 → `https://…:443/api/health` → 200 |
| Pages over HTTPS | `/` 200 (6 markets) · `/m/bitcoin-price-50k` 200 |
| ALB DNS name directly | TLS name mismatch — correct: the certificate is for the hostname, not the ALB's own name |

**Two findings that shaped this, both recorded so production does not repeat them:**

1. **`staging.zugzwangworld.com` cannot receive an ACM certificate while it is a CNAME to Vercel.** CAA lookups follow the CNAME, and Vercel's zone publishes `issue` records for globalsign / letsencrypt / pki.goog / sectigo only — Amazon is excluded, so ACM fails with `CAA_ERROR`. Cloudflare cannot override it (a CNAME'd name holds no other records). The obstacle disappears the moment the name points at the ALB; a certificate for it can then be issued in minutes and added to the listener. Two failed requests (`4940b5b9…`, `4cafdfa4…`) were deleted.
2. **The CDK's two-construct listener model could not add a certificate to a live ALB.** CloudFormation created the redirect listener on :80 before deleting the HTTP listener on :80 → `A listener already exists on this port` → rollback (clean; no downtime). `infra/lib/compute-stack.ts` now declares one `:80` listener whose default action is *redirect* with a certificate and *forward* without, so the change is an in-place update. Production will get its certificate through the same path.

**Left for the OAuth/bet phase (by instruction):** the write path over real authentication. `BETTER_AUTH_URL`, trusted origins and the Google OAuth client all name `staging.zugzwangworld.com`, so that test needs either (a) the `staging` CNAME moved to the ALB followed by a certificate for it, or (b) a rebuilt image and a new Google redirect URI for `aws-staging`. (a) is the smaller change.

### 7.1 `staging.zugzwangworld.com` moved to the ALB (2026-09-25 04:32–04:36 UTC)

| Item | Result |
|---|---|
| DNS | operator changed the existing `staging` CNAME target from Vercel to the ALB (DNS only) — visible on the authoritative nameservers within ~7 min |
| Certificate | ACM `c166e9a8-7c6d-4763-a5d6-91fc743be239`, SANs `staging.zugzwangworld.com` + `aws-staging.zugzwangworld.com`, **issued 20 s after the CNAME moved** — the CAA block was the Vercel CNAME and nothing else |
| Listener | certificate swapped in place (Compute stack update, no listener recreation, no downtime); `describe-listener-certificates` shows `c166e9a8…` as default |
| `https://staging.zugzwangworld.com/api/health` | 200 · chain trusted · `db: ok, migrations: ok, canary staging-4b3efd7` |
| Redirect | `http://staging.…/` → 301 → `https://staging.…/` |
| Pages | `/` 200 (6 markets) · `/m/bitcoin-price-50k` 200 · `/sign-in` 200 with the Google button and Turnstile widget present |
| `aws-staging` | still serving, same certificate |
| Vercel project / production | untouched |

The single-name certificate `6dd63977…` (aws-staging only) is no longer attached and was deleted.

## 8. Authenticated workflow on AWS staging — verified (2026-09-25 04:38–04:40 UTC)

Performed by the operator in a browser at `https://staging.zugzwangworld.com` with the **existing** Google OAuth client — no Google Console change was needed. Verified read-only through the SSM tunnel (`default_transaction_read_only=on`) and over HTTPS.

| Step | Evidence |
|---|---|
| Google sign-in | `user.oauth_signed_in` event; new `sessions` row (+1) |
| Onboarding | new user `MagentaFerret000` (+1 `users`), `user.pseudonym_assigned`, `user.tos_accepted`, `dharma.granted` — ledger `initial_grant` +1000 |
| Daily credit | `dharma.credited` — ledger `daily_allowance` +10 → 1010 |
| Bet 1 (reply-bet) | `yc-w27-acceptance`, NO, Đ 50, 62.2823 shares @ 0.8028, body "testing" — `bet.placed` + `comment.placed` |
| Bet 2 (reply-bet) | same market, NO, Đ 50, 62.2763 shares @ 0.8029, body "test 1" |
| Write spine per bet | `bets` + `comments` + `lots` (surviving 62.28, basis 50) + `dharma_ledger` (`bet_stake` −50) + `bet_receipts` (`place`) + `events` ×2 + `positions` upsert + `pools` reserves updated |
| Ledger chain | 1000 → 1010 → 960 → 910; `balance_after = previous + amount` for every row |
| Position | NO 124.558633… = 62.2823 + 62.2763 exactly |
| Count deltas vs restore baseline | bets/comments/lots/receipts **+2 each**, ledger +4, positions +1, users +1, sessions +1, events +9 — nothing else moved |
| Invariants after the writes | INV-1 (every bet has its comment) ✓ · INV-2 (no negative balance) ✓ · I-LOT-SUM ✓ |
| Application over HTTPS | `/u/MagentaFerret000` 200 with the market linked · `/m/yc-w27-acceptance` 200 with both arguments and the author in the rendered data · `.md` export 200 containing the new argument and author · `/api/health` `db: ok, migrations: ok` |
| Integrations exercised for real | Upstash (rate limit + idempotency), OpenAI (moderation of two comments), Sentry (boot), Google OAuth, Turnstile — all through the NAT |

**Result: the complete authenticated write path works on AWS staging against the restored data, end to end, over HTTPS, with the production OAuth configuration unchanged.**

## 9. Scheduler + Monitoring — deployed and verified (2026-09-25 05:03–05:20 UTC)

Approved for staging only; deployed Scheduler first, then Monitoring. `cdk diff` on Network, Database, Security and Compute before and after: **no differences** — nothing existing was modified.

| Item | Result |
|---|---|
| Stacks | Scheduler `CREATE_COMPLETE` (13 resources) · Monitoring `CREATE_COMPLETE` (11) — all six staging stacks green |
| Rules | `closeduemarkets` rate(1 min) · `alarmsdrain` rate(5 min) · `r2orphansweep` rate(6 h) — all ENABLED |
| Connection | `zugzwang-staging-cron` **AUTHORIZED** (API-key auth, `Authorization` header from the app secret's `CRON_AUTH_HEADER`) |
| Header correctness | the header EventBridge sends is **byte-identical** to `Bearer <CRON_SECRET>` from Doppler `stg` (SHA-256 compared, 51 bytes) |
| Firing | in the first ~15 min: `close-due-markets` **7 invocations, 0 failed**; `alarms-drain` 1, 0 failed; `r2-orphan-sweep` 0 (6-hourly, first run due ~11:05 UTC) |
| Calls reach AWS staging | direct call with the same header → `GET /api/cron/close-due-markets` **200** `{"status":"ok","closed":0,"skipped":0}` and `/api/cron/alarms-drain` **200** `{"status":"ok","selected":0,…}`; without the header → **401**. ALB target group since go-live: 16× 2xx, 0× 5xx, 2× 4xx (one of them this unauthenticated control call); 0 ELB-generated 4xx |
| `close-due-markets` runs | yes — every minute; `closed: 0` is correct because the six restored markets' deadlines are in November. ⚠ The route logs only on failure by design (`cron_misconfigured`, lock errors), so a healthy cron leaves no application log line; the EventBridge `Invocations`/`FailedInvocations` metrics and the silence alarm are the observability, not the log |
| Alarms | all **9 in `OK`**: 5xx, p95 latency, unhealthy hosts, CPU, memory, 3× cron FailedInvocations, and **`CloseDueMarketsSilent`** (< 1 invocation in 15 min, missing data = breaching) — the last one is OK only because invocations are arriving |
| Dashboard | `zugzwang-staging` — 4 widgets: Requests and errors · Latency (p50/p95) · Task CPU/memory · Scheduled jobs |
| SNS topic | `zugzwang-staging-alarms` — **0 subscriptions**; alarms are console-only until an email is subscribed |
| Vercel / Supabase / production | untouched; Vercel's own staging crons still target Vercel's deployment and the Supabase staging database |

**Blocker list, updated:** rows 19 and 20 of the audit (Monitoring, Scheduler on AWS) are now PASS. Remaining before "production-ready": an alarm subscriber, Sentry values in Doppler `prd`, the EC2 vCPU quota (pending), and the branch being pushed/reviewed.

## 4. What was learned — changes that production must carry

| Finding | Fix (in the repo) |
|---|---|
| RDS rejects non-ASCII in a parameter-group description | `infra/lib/database-stack.ts` — ASCII description |
| `rds.force_ssl=1` refuses plaintext; the app URL had no `sslmode` | `sslmode=require` on the DB URLs in the app secret (`scripts/aws-migration/staging-secret.cjs`; production must do the same). Follow-up: `verify-full` with the RDS CA bundle in the image |
| `drizzle-kit migrate` applies everything in one transaction → 55P04 on an empty database | `scripts/migrate-staging.ts` now uses `scripts/apply-migrations-per-tx.ts` (the `migrate-prod.ts` applier, extracted) |
| Migration task exited before touching the DB: Corepack downloaded `pnpm` at first use, with no internet | `Dockerfile` migrate stage: `corepack prepare --activate` at build time, `COREPACK_ENABLE_NETWORK=0` |
| `CREATE EXTENSION pg_cron WITH SCHEMA extensions` — no `extensions` schema on RDS, and RDS's `pg_cron` pins `pg_catalog` | Target preparation in the applier: `CREATE SCHEMA IF NOT EXISTS extensions` + `CREATE EXTENSION IF NOT EXISTS pg_cron` before the migrations (no-ops on Supabase; committed migrations untouched) |
| **awsvpc tasks on EC2 have no public IP → no internet without a NAT**; the CDK's "no NAT for staging" assumption was Fargate-only | `infra/config/staging.ts` `natGateways: 1`; subnet groups reordered (`database` before `private`) so adding the NAT did not re-address the RDS subnets |
| Migration task lacked `DATABASE_URL_STAGING` / ref fragment | `infra/config/types.ts` `migrationSecretKeys`; `compute-stack.ts` injects them |
| `pg_restore --disable-triggers` is impossible on RDS; the archive's data is alphabetical | Restore runner: `DISABLE TRIGGER USER` + `session_replication_role=replica` on the restore connection (documented in `05-DATABASE-BACKUP-VERIFICATION.md` §8.1) |
| Monitoring imports the Scheduler stack's exports | Cannot deploy Monitoring before Scheduler; deploy them together when Scheduler is approved (or decouple the cron-silence alarms — a small CDK change) |

## 5. Remaining blockers (staging)

1. **Monitoring stack** — blocked on the Scheduler stack, which is withheld by instruction. Deploy both together once Scheduler is approved, or decouple.
2. **HTTPS + domain** — the ALB is HTTP-only. Needs an ACM certificate for `staging.zugzwangworld.com` (one Cloudflare CNAME to validate) and the DNS record pointed at the ALB. Until then Google sign-in and the write path cannot be exercised on AWS staging, and the Scheduler's API destinations would still call Vercel.
3. **Sentry `prd` values** — still missing in Doppler `prd` (staging's were resolved from the Sentry API using the token already in Doppler; `prd` needs the same, pointing at the `zugzwang-experiment` Sentry project).
4. **EC2 vCPU quota** — increase to 16 is PENDING; production needs it before its rolling deploys.
5. **`deploy-aws.yml`** — fetches build values from Doppler including the Sentry DSN; will work for `stg` now, not `prd` until item 3.
6. **Alert email** — SNS topic will have no subscriber until one is given.

## 6. Exact next step

**Commit the branch** (infra + scripts + Dockerfile + docs — all uncommitted), then, with your approval: request the ACM certificate for `staging.zugzwangworld.com`, add the validation CNAME in Cloudflare, redeploy Compute with `ZZ_STAGING_CERT_ARN`, point `staging.zugzwangworld.com` at the ALB, and run the signed-in write test (place one bet on staging). Scheduler + Monitoring follow once you approve the Scheduler.

**Not next:** anything production. The final sequence for production remains FINAL BACKUP → VERIFY → PAUSE WRITES → FINAL DATA MIGRATION → VALIDATE RDS → START/VERIFY APP → SWITCH TRAFFIC → MONITOR → KEEP ORIGINAL BACKUP, and the restore procedure it uses is §8 of `05-DATABASE-BACKUP-VERIFICATION.md`, not the earlier §5.

## 10. AWS-MIGRATION-3 — production-readiness changes, staged here first (2026-09-25)

Plan: `docs/plans/AWS-MIGRATION-3.md`. Driven by `08-STAGING-LOAD-TEST-RESULTS.md` §3–§5. **Every
number in that results document was measured on the PREVIOUS staging shape** — `t3.small`, task
`cpu 512 / 1024 MiB / 512 reservation`, Node's default ~560 MB heap. This section changes that shape;
any load run after it is a separate, production-sized confirmation test and must not be read against §08.

| Change | Where | Value |
|---|---|---|
| Staging mirrors the production task and host | `infra/config/staging.ts` | `t3.medium`, `cpu 1024`, `memoryMiB 3072`, `memoryReservationMiB 2048`; `desiredCount 1`, `maxCapacity 1` (unchanged, hard cap) |
| Bounded V8 heap | `compute-stack.ts` task env, `config/types.ts` | `NODE_OPTIONS=--max-old-space-size=2048` (staging + production values) |
| Keep-alive above the ALB idle timeout | task env + `scripts/docker/server-timeouts.cjs` (preloaded by the runner `CMD`) | `KEEP_ALIVE_TIMEOUT=65000`; `headersTimeout` = +5 s; ALB idle 60 s unchanged |
| `statement_timeout` (57014) answered 503 | `src/server/bets/errors.ts`, `transaction.ts` | `error_bet_timeout`, `Retry-After: 2`; not retried; Sentry `bet_statement_timeout` warning |
| Readiness gate | `src/app/api/ready/route.ts`, `src/server/health/ready.ts`; target-group health path; grace period | 503 until `/`, every Open market and one profile have rendered once through `127.0.0.1`; bounded 20 s/fetch, 90 s total; grace 180 s. `/api/health` unchanged (container check + deploy canary) |
| Write-pause | `proxy.ts`, `src/server/config/writes-paused.ts`, optional task env from config | `ZUGZWANG_WRITES_PAUSED=paused` (exact) → 503 + `Retry-After` on every write path incl. Server Actions and cron GETs; reads untouched |
| Production migrate script | `scripts/migrate-prod.ts` | delegates to `apply-migrations-per-tx.ts` (fresh-RDS prep) like staging; guards unchanged |
| Deploy workflow | `.github/workflows/deploy-aws.yml` | refuses to synth without the environment's cert ARN; passes `ZZ_*_CERT_ARN` / `ZZ_ALERT_EMAIL` from GitHub environment variables; adds the `/api/ready` gate |
| GitHub OIDC deploy roles | `infra/lib/deploy-stack.ts` (`Zugzwang-Deploy`, synth-only) | one provider, one role per environment, trust pinned to `repo:zugzwang-foundation/experiment:environment:<env>`; assumes only the CDK bootstrap roles + ECR push + ECS read |

Multi-task remains **out of scope**: one task, hard max one, until a fleet-wide cache/invalidation is decided separately (per-process `cacheComponents` + one-task `updateTag`, see `production.ts`).

### 10.1 Review round (2026-09-25, `@security-auditor` + `@code-reviewer`) — fixed in this lane

| Finding | Fix |
|---|---|
| H-1 · the OAuth callback (`GET /api/auth/callback/*`) writes (identity-pool consumption, users/accounts/sessions) and a method-based pause let it through | under `/api/auth/` every method is a write except `get-session` / `ok` |
| H-2 · the matcher was an allowlist; `/legal` owns a registered Server Action worker and was never matched | one catch-all matcher (everything except `_next/static`, `_next/image`, `favicon.ico`, files with an extension) — fails closed on the next route |
| H-4 · the pause flag is a synth-time input the workflow never carried, so a deploy during the window would silently unpause | `ZZ_STAGING_WRITES_PAUSED` / `ZZ_PROD_WRITES_PAUSED` passed from GitHub environment variables like the cert ARN; `/api/health` now reports `writesPaused` |
| M-1 · the client's `TRANSIENT_CODES` did not know `error_bet_timeout`, so the composer would have minted a fresh idempotency key after the 503 | registered as `p3_transient_retry` (key held; retry replays the durable receipt) |
| M-2 · the workflow's readiness gate could not fail (`ready` is always true) | gate requires `ready:true` **and** `failed:0`; `/api/ready` returns counts only |
| M-3 · `id-token: write` at workflow level | per job, only `build` and `deploy` |
| M-5 · `ecs:ListServices` under an unsupported condition key | split: `DescribeServices` conditioned on the cluster, `ListServices` unconditioned |
| LOWs | preload owned by root; keep-alive ceiling 600 s; `build.env` removed by `trap`; dead `x-zz-warmup` header dropped; `Zugzwang-Deploy` only instantiated under `-c deployStack=true` |

### 10.2 Open items surfaced by the same round — NOT fixed here, decisions owed

- **H-3 · CDK bootstrap roles are account-wide.** The GitHub deploy role assumes `cdk-hnb659fds-deploy-role`, whose execution role carries `AdministratorAccess` by default bootstrap — a staging credential can deploy production stacks. Options: re-bootstrap with `--cloudformation-execution-policies` below Administrator, or a permissions boundary on the execution role. Decide before the first GitHub-driven **production** deploy.
- **S-1 · `X-Forwarded-For` is attacker-controlled behind the ALB** (and behind Cloudflare). The admin-login per-IP limit (the only brute-force control on the admin password, no Turnstile by ruling), `betPerIp`, and the IP written into append-only audit rows all read the FIRST hop, which Vercel overwrote and an ALB appends to. Needs one shared helper (`CF-Connecting-IP` with the ALB restricted to Cloudflare ranges, or the trusted-hop count) and an ADR. **Launch blocker on the AWS topology; separate task.** ⇒ **2026-09-26: addressed in code, working tree only, pending operator review** — `src/server/middleware/client-ip.ts` + ADR-0061 (peer = the ALB's appended last hop, or Vercel's `x-real-ip`; `CF-Connecting-IP` believed only when that peer is a Cloudflare edge). Not deployed; staging still runs `staging-a9469d7-m3b`. ⛔ Still open and a LAUNCH BLOCKER: ADR-0061 F1 (authenticate Cloudflare as our origin puller — any Cloudflare tenant can otherwise reach the ALB and choose `CF-Connecting-IP`) and A6 (ALB handling of duplicate XFF lines, unmeasured).
- **M-4 · while paused, admin login and moderation are 503 too**, and the cron rules fire into 503s (the `FailedInvocations` alarms will trip for the window). Acceptable for a 10–20 min sync, but it is a decision to write into the cutover runbook, not an accident.
- **S-2 · third-party actions pinned by mutable tag** in jobs holding `DOPPLER_TOKEN` — SHA-pin in the separate task.
- **Percent-encoded paths** (`/api/%62ets/place`) — believed not to resolve to the handler; confirm with one `curl` during the staging write-pause rehearsal.

### 10.3 `@code-reviewer` round (same day) — fixed here

- HIGH: the warm fetched without checking status or draining the body (a 500 counted as warmed; with PPR the walk could finish before a single render) → `warmFetch` drains and throws on non-2xx; a warm with failures also reaches Sentry (`ready_warmup_incomplete`).
- HIGH: no same-commit ADR / SPEC.2 §15.4 rows for the two new wire codes → ADR-0060; SPEC.2 2.2.2 (catalogue 39 → 41).
- MEDIUM: workflow comment promised an alert-email guard it lacked → guarded like the certificate; `Zugzwang-Deploy` imports an existing GitHub OIDC provider via `ZZ_GITHUB_OIDC_PROVIDER_ARN` instead of colliding; `ZZ_GITHUB_REPOSITORY` is required (no default inside a trust policy); the applier docblock that still described the pre-fold `migrate-prod.ts` is corrected; the reservation → ASG-topology consequence is written into `production.ts` and the plan.
- LOW: 55P03/57014 nomenclature; the preload clamps an oversized keep-alive instead of silently skipping; the stray whitespace edit to `F-RESOLVE-3.md` reverted.
- Still owed (unchanged): H-3 bootstrap scope, S-1 forwarded-for, M-4 pause-window admin availability — §10.2.

### 10.4 First deploy attempt at `staging-a9469d7-m3` (12:04–12:18 UTC) — ROLLED BACK, two findings

The approved diff was deployed; the ASG rolling update terminated `i-0ee255037045d2303` (`t3.small`) at
12:04:58 and every replacement launch failed: **"The specified instance type is not eligible for Free
Tier"** (12:05, 12:06, 12:08, 12:12). The update was cancelled at 12:17:51 (`cancel-update-stack`) and
rolled back to the previous template — `t3.small`, image `staging-4b3efd7`. The images
`staging-a9469d7-m3` / `-migrate` stay in ECR, unused.

1. **The AWS account is on the Free Tier plan, which restricts EC2 instance types.** Eligible in
   `ap-south-1` (measured with `describe-instance-types --filters free-tier-eligible=true`): `t3.micro`,
   `t3.small`, `t4g.micro`, `t4g.small`, `t8i.micro`, `t8i.small`, `c7i-flex.large` (2 vCPU / 4 GiB),
   `m7i-flex.large` (2 vCPU / 8 GiB). `t3.medium` and `t3.large` are **not**. `production.ts` names
   `t3.medium` too, so the production Compute deploy would have failed identically — the rehearsal did
   its job. Options: `m7i-flex.large` (eligible, larger than `t3.medium`; two 3 GiB tasks fit on one host)
   or upgrade the account to a paid plan and keep `t3.medium`. ⚠ RDS may carry the same restriction —
   confirm `db.t4g.small` launches before the production Database stack; and check the plan's credit
   cap and expiry before launch.
2. **The ASG update policy drops to zero instances.** `UpdatePolicy.rollingUpdate()` defaults to
   `minInstancesInService: 0`, so an instance-type change terminates the only host before its
   replacement exists — staging served 503 for the whole window. Production must set
   `minInstancesInService: 1` (and `maxInstances ≥ 2`) before any launch-template change.

### 10.5 Second deploy at `staging-a9469d7-m3` on `m7i-flex.large` (12:52–12:55 UTC) — SUCCEEDED; verification

| Check | Result |
|---|---|
| Rollout | `UPDATE_COMPLETE` 12:55:19; `m7i-flex.large` launched beside the `t3.small` (`minInstancesInService: 1`), old task drained, no 503 window |
| Task | RUNNING/HEALTHY on `i-026c6e4c9336fa082` (`m7i-flex.large`, 8 GiB host); container 1024 CPU / 3072 hard / 2048 reservation; `NODE_OPTIONS=--max-old-space-size=2048`, `KEEP_ALIVE_TIMEOUT=65000` confirmed inside the process; `CMD = node --require ./server-timeouts.cjs server.js`, preload root-owned |
| `/api/ready` | 200 `{ready:true, warmed:9, failed:0}` (home + 7 Open markets + 1 profile); target group healthy on `/api/ready` |
| `/api/health` | canary `staging-a9469d7-m3`, db ok, migrations ok, `writesPaused` reported |
| Real bet | test participant → quote 200 → place **200 in 1.76 s**; replay under the same key returned the durable receipt (bets 0 → 1, spine 1/1/1/1); other markets unchanged (3 170) |
| Cron | `closeduemarkets` 15 invocations / 15 min, `alarmsdrain` 3, 0 failed; 11/11 alarms OK |
| Idle hour 12:57–13:57 | 297 requests, **0 ELB 5xx, 0 target 5xx** (before: 1–6 ELB 502 per idle window) |
| Load-test market | FK targets of `markets`: mod_actions, bets, positions, comments, payout_events, resolution_events, pools, market_media, bet_receipts, lots; `bucket_a_no_delete/update/truncate` armed on bets/comments/dharma_ledger/bet_receipts, `lots_no_delete` armed — so the row cannot be DELETEd; close + void (product path) or a fresh restore are the exits |
| Post images | 404 on staging by construction: rows restored from production reference objects in the **production** uploads bucket; staging holds staging bucket credentials. Not a migration defect — production keeps its own bucket. Market-media and PFP buckets are shared and resolve (200) |

**Write-pause rehearsal — FAILED, and the cause predates this lane.** With `ZUGZWANG_WRITES_PAUSED=paused`
deployed (task env; `/api/health` → `writesPaused: true`), writes still reached the handlers (401, not
503) and `GET /admin/markets` without a cookie returned 200: **the request proxy has never run on the
AWS build.** `proxy.ts` sat at the repository root while the app lives under `src/`; Next resolves the
proxy file relative to `src/`, and the built `.next/server/middleware.js` was a 223-byte stub with an
empty `middleware-manifest.json`. The admin-redirect layer it carried was therefore dead on every AWS
build (and, since the file was never under `src/`, presumably on Vercel too — the server-side
`assertAdminActor` layer is what has been guarding the admin pages). Fix: `git mv proxy.ts src/proxy.ts`
(+ the test import); rebuilt as `staging-a9469d7-m3b`; the middleware bundle inside that image is the
proof, then the pause matrix is re-run on staging.

### 10.6 Staging complete (2026-09-25 19:30 UTC) — proxy fix, write-pause proven, fixture market voided

**The request proxy was never built, and that is the finding of the day.** `proxy.ts` lived at the
repository root while the app lives under `src/`; Next resolves the proxy file relative to the app's
directory, so `.next/server/middleware.js` was a loader stub over no route and
`middleware-manifest.json` was empty on **every build this project has ever made**. The write-pause
was therefore deployed and inert — and so was the admin-redirect layer the file has carried since
SCAFFOLD (server-side `assertAdminActor` is what has actually been guarding `/admin`). Fix:
`git mv proxy.ts src/proxy.ts`. Image `staging-a9469d7-m3b`.

**Write-pause rehearsal — PASSED on `staging-a9469d7-m3b`.** With `ZUGZWANG_WRITES_PAUSED=paused` on
the task (and `/api/health` reporting `writesPaused: true`), every write answered
`503 + Retry-After: 300 + error_writes_paused`:

| Probe | Unpaused (control) | Paused |
|---|---|---|
| `POST /api/bets/place` · `/sell` | 401 `error_session_required` | **503** |
| `GET /api/auth/callback/google` (the H-1 write-bearing GET) | 302 | **503** |
| `POST /api/auth/sign-in/social` | 400 | **503** |
| `GET /api/cron/close-due-markets` | 401 | **503** |
| `POST /admin/markets/media/sign` | 401 | **503** |
| Server Action on `/m/<slug>` **and on `/legal`** (the H-2 unlisted page) | 404 | **503** |
| `GET /` · `/m/<slug>` · `/u/<p>` · `/api/auth/get-session` · `/api/ready` · `/api/health` | 200 | **200** |

Both security-audit bypasses are closed in practice, not only in source. The flag was then removed and
the task redeployed (`writesPaused: false`).

**The load-test fixture market is retired through the product.** `closeMarket` correctly REFUSED
(`MarketDeadlineNotReachedError` — deadline 2026-10-02), so `Open → Voided` was the only legal exit.
⚠ The void over the operator's SSM tunnel ran 9.7 minutes and died mid-transaction
(`write CONNECTION_CLOSED`) — and **rolled back completely**: 0 resolution_events, 0 payouts, 0
`void_refund` rows, market still `Open`, no idle-in-transaction session. Atomicity under a broken
client connection, demonstrated rather than assumed. It was then run **in-VPC as a one-off ECS task**
on the migration task definition (image `staging-a9469d7-m3c-migrate`, ECS injecting the DSN from
Secrets Manager — no credential through the operator's machine or SSM command history) and committed
in **3.2 s**: `betsRefunded 2937`, `poolUnwindAmount 201999.954657684666093635`, status `Voided`,
2 937 payout rows, 2 937 `void_refund` ledger rows. ⚠ The engine path mocks `next/cache`, so the
`discovery` tag was not invalidated on the live task; a `--force-new-deployment` restart cleared the
per-process cache and Discovery then listed **exactly the six intended markets** (0 occurrences of
"LOAD TEST MARKET"). `/api/ready` moved 9 → 8 warmed paths on its own, which is the readiness gate
tracking the Open set.

**Final staging state** — image `staging-a9469d7-m3b`, host `m7i-flex.large`, task 1 vCPU / 3 GiB /
2 GiB heap, `KEEP_ALIVE_TIMEOUT=65000`, TG health `/api/ready`, grace 180 s, 1 task hard-capped at 1,
pause off:

| Check | Result |
|---|---|
| `/api/health` | `canary staging-a9469d7-m3b`, db ok, migrations ok, `writesPaused false` |
| `/api/ready` | 200 `{ready:true, warmed:8, failed:0}`; target healthy on `/api/ready` |
| Markets | 6 `Open` (the intended set) + 1 `Voided` fixture; Discovery lists 6 |
| `staging-verify.cjs` | **20/21 PASS**; the one FAIL is "row counts match the ARCHIVE", expected — staging now also holds 200 test users and the voided fixture's rows |
| Invariants | INV-2 0 negative balances · oversell 0 · I-LOT-SUM 0 mismatches · I-GENESIS pass · live DELETE on `bets` and UPDATE on `dharma_ledger` both still REJECTED |
| pg_cron | extension installed, 4 jobs active, executing |
| EventBridge | `closeduemarkets` 15/15 min, `alarmsdrain` 3, **0 FailedInvocations** |
| Alarms | **11/11 OK** |
| ALB since restart | 36 requests, **0 ELB 5xx, 0 target 5xx**; the clean idle hour 12:57–13:57 was 297 requests / 0 5xx (the keep-alive fix — previously 1–6 ELB 502 per idle window) |
| Write path | Proven on `staging-a9469d7-m3` at 12:54 (place 200 in 1.76 s + durable replay + spine 1/1/1/1). ⚠ NOT re-committed on `m3b`: the bet path is byte-identical between the two images (the only delta is the proxy file's location), and a fresh bet would have to land on a founder-authored market now that the fixture is voided. Say the word and one Đ10 test bet will be placed and reported |

**Open, unchanged:** H-3 bootstrap execution-role scope · S-1 `X-Forwarded-For` trust behind the ALB
(launch blocker, separate task) · M-4 pause-window admin/moderation availability · S-2 action pinning
· post images 404 on staging (rows reference the production bucket; production keeps its own).
