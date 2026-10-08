# Zugzwang infrastructure (AWS CDK)

Infrastructure-as-code for running Zugzwang on AWS ECS, backed by EC2 instances you own.

⚠ **Deployed.** Staging and production both run on these stacks (since late September 2026).
The pipeline deploys only the `Compute` stack — `.github/workflows/deploy-aws.yml`, which
`deploy-production.yml` calls for production — and any other stack is deployed by hand, outside the pipeline. The
original design audit is `docs/reports/AWS-CDK-DESIGN.md`. *(Re-measured 2026-10-08 at DOCS-1.)*

```bash
pnpm install          # inside infra/
pnpm typecheck        # tsc --noEmit
pnpm synth            # synthesizes the 12 environment stacks (6 each), no AWS credentials needed;
                      # the two deploy-role stacks only with -c deployStack=true
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
2. **The certificate ARN is committed** — production's in `infra/config/production.ts`, as is
   staging's in `infra/config/staging.ts` — and a `Compute` synth refuses without one, so no
   environment gets an HTTP-only listener (`infra/lib/compute-stack.ts`).
   `ZZ_PROD_CERT_ARN` / `ZZ_STAGING_CERT_ARN` still override it for a hand-run deploy.
3. **Set `ZZ_ALERT_EMAIL`** so alarms reach a human.
3a. **After the `Database` stack is up, compose `DATABASE_URL`** from its outputs
   (`Endpoint`, `Port`, `DatabaseName`) and the generated secret
   (`zugzwang/<env>/database` → username + password), and put it in the app
   secret. Then set `STAGING_PROJECT_REF_FRAGMENT` / `PROD_PROJECT_REF_FRAGMENT`
   to a substring of the RDS endpoint — the migration guards refuse any URL that
   does not contain it. In production the in-VPC migrate job reads both values
   from Secrets Manager (`infra/config/production.ts`, `migrationSecretKeys`),
   where `scripts/aws-migration/prod-secret.cjs` writes the fragment as the RDS
   host; that job has passed on every production deploy since the cutover
   (checked 2026-10-08). The stored values themselves were not read. Nothing else
   about the migration scripts changes.
4. **Application changes this design needed** (all made since):
   - `output: 'standalone'` in `next.config.ts`;
   - `/api/health` falling back to `APP_COMMIT_SHA` / `APP_REGION`, or the
     deploy gate cannot verify which build is live;
   - the client IP from `src/server/middleware/client-ip.ts` — peer-anchored, trusting
     `CF-Connecting-IP` only from Cloudflare's ranges with `ZZ_CF_ORIGIN_SECRET` set (ADR-0061);
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
6. Verify GET /api/health → status ok, db ok, migrations ok, canary == <env>-<sha7> (the image tag)
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
- **Region pinned to `ap-south-1`.** The database is there — the RDS in the same
  VPC (`infra/lib/database-stack.ts`); compute in another region would undo the
  PERF-1 latency fix.
