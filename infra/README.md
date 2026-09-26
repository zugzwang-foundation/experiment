# Zugzwang infrastructure (AWS CDK)

Infrastructure-as-code for running Zugzwang on AWS ECS, backed by EC2 instances you own.

⚠ **Design stage. Nothing here has been deployed, and no application code was
changed to accommodate it.** The audit behind these stacks, including the
findings that block a real deploy, is `docs/reports/AWS-CDK-DESIGN.md`.

```bash
pnpm install          # inside infra/
pnpm typecheck        # tsc --noEmit
pnpm synth            # synthesizes all 10 stacks, no AWS credentials needed
```

## What it builds

Per environment (`staging`, `production`), six stacks:

| Stack | Contains |
|---|---|
| `Network` | VPC across 2 AZs, ALB / task / database security groups, isolated DB subnets, optional NAT |
| `Database` | RDS for PostgreSQL 17 in the isolated subnets, a parameter group that preloads `pg_cron`, generated credentials in Secrets Manager, backups that outlive the instance (ADR-0059) |
| `Security` | ECR repository, the Secrets Manager reference, the CloudWatch log group, execution role, task role |
| `Compute` | ECS cluster on **EC2** (auto scaling group, launch template, capacity provider, instance role), app task, migration task, ALB + listeners, optional WAF / CloudFront / Route 53 |
| `Scheduler` | EventBridge connection, three API destinations, three rules — the `vercel.json` crons |
| `Monitoring` | SNS topic, alarms (5xx, p95 latency, unhealthy hosts, CPU, memory, cron failures, cron silence), dashboard |

Stack order is derived by CDK from real references. There are no `fromLookup`
calls anywhere, which is what lets `cdk synth` run in CI with no credentials.

## Before a first deploy

1. **Create and populate the secret** (`zugzwang/staging`, `zugzwang/production`)
   as JSON. Doppler stays the source of truth; CDK only reads the name. The keys
   are listed in `config/types.ts` → `RUNTIME_SECRET_KEYS`, plus
   `CRON_AUTH_HEADER`, whose value is the complete header — `Bearer <CRON_SECRET>`.
2. **Set the certificate ARN** (`ZZ_STAGING_CERT_ARN` / `ZZ_PROD_CERT_ARN`).
   Without one the ALB gets an HTTP-only listener so the stack still synthesizes.
3. **Set `ZZ_ALERT_EMAIL`** so alarms reach a human.
3a. **After the `Database` stack is up, compose `DATABASE_URL`** from its outputs
   (`Endpoint`, `Port`, `DatabaseName`) and the generated secret
   (`zugzwang/<env>/database` → username + password), and put it in the app
   secret. Then set `STAGING_PROJECT_REF_FRAGMENT` / `PROD_PROJECT_REF_FRAGMENT`
   in Doppler to a substring of the RDS endpoint — the migration guards refuse
   any URL that does not contain it, and today they are set to the Supabase
   refs. Nothing else about the migration scripts changes.
4. **Application changes that this design assumes** (none of them made yet):
   - `output: 'standalone'` in `next.config.ts`;
   - `/api/health` falling back to `APP_COMMIT_SHA` / `APP_REGION`, or the
     deploy gate cannot verify which build is live;
   - `ipAddress()` from `@vercel/functions` falling back to `x-forwarded-for`;
   - a `Dockerfile` (multi-stage, Node 24, `sharp`, `drizzle/migrations/**` and
     `public/**` copied in).

## Deploy flow

```
1. Build a per-environment image (ZUGZWANG_ENV, NEXT_PUBLIC_*, BETTER_AUTH_URL
   are baked in at build time — an image belongs to ONE environment)
2. Push to ECR as <env>-<git-sha>
3. MIGRATE FIRST (CI, or the migration task definition)
4. cdk deploy 'Zugzwang-<env>-*' -c imageTag=<env>-<git-sha>
5. Wait for services-stable — the circuit breaker rolls back a failing deploy
6. Verify GET /api/health → status ok, db ok, migrations ok, canary == <git-sha>
7. Rollback = redeploy the previous tag. No rebuild.
```

## Things encoded here on purpose

- **`maxCapacity: 1`.** Not a cost decision. `cacheComponents` keeps Next's
  cache per process, so a second task would not see a `revalidateTag` raised by
  a moderation removal on the first. Raising it needs a shared cache handler.
- **The task role has no AWS permissions.** The app's dependencies are Upstash,
  R2, OpenAI, Resend, Sentry and PostHog — none of them AWS APIs — and RDS is
  reached over TCP inside the VPC, not through an AWS API.
- **Compute never references the database stack.** The app reads `DATABASE_URL`
  from the app secret, so replacing the RDS instance (restore, resize) is never
  a compute redeploy, and the cutover is one value changed in the vault.
- **`stopTimeout` 30 s and a 30 s deregistration delay**, because `after()` work
  (the cache counters) runs once the response is already out.
- **A cron-silence alarm**, not only a failure alarm: `close-due-markets` runs
  every minute, and a scheduler that simply stops produces no error anywhere —
  markets just never close.
- **Region pinned to `ap-south-1`.** The database is there — Supabase today,
  RDS in the same VPC after cutover; compute in another region would undo the
  PERF-1 latency fix.
