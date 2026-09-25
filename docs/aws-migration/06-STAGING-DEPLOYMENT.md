# 06 — Staging Deployment Record (AWS-MIGRATION-2)

| | |
|---|---|
| **Date** | 2026-09-24 (UTC), sessions 18:54 → 20:25 |
| **Account / region** | `849076101704` · `ap-south-1` · identity `user/zugzwang-deploy` |
| **Scope** | STAGING ONLY. Production Supabase, production AWS, DNS/Cloudflare, production secrets and the EventBridge Scheduler were not touched. |
| **Status** | Staging is **running the application on AWS over HTTPS at `staging.zugzwangworld.com`** (the real staging hostname; `aws-staging` also serves) against a staging RDS holding a verified restore of the production backup. **Authenticated write path verified (§8).** Monitoring stack outstanding (needs Scheduler). |
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
