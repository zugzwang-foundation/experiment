# Zugzwang on AWS — CDK Infrastructure Design

**Audited against:** `main` @ `40f77c5`, working branch `feat/aws-cdk-migration` · 18 September 2026 (re-verified against the 15 commits that landed after the first audit)
**Status:** design + implementation under `infra/`. **Nothing deployed. No application code changed.**

---

## 1. Audit findings (verified in the repository, not assumed)

| # | Finding | Evidence | Consequence for AWS |
|---|---|---|---|
| A1 | **`@vercel/functions` is a runtime dependency** | `package.json`; `src/server/middleware/logging.ts:3` uses `ipAddress(request)` | Off Vercel it reads headers that ALB does not set (`x-real-ip`). The `ip` log field becomes `null`. **App-code fix needed later**, out of scope here. |
| A2 | **`/api/health` reads `VERCEL_GIT_COMMIT_SHA` and `VERCEL_REGION`** | `src/app/api/health/route.ts:41,61` | `canary` becomes `null` on AWS, and the deploy gate ("canary equals the pushed SHA") silently stops working. Design passes `APP_COMMIT_SHA`/`APP_REGION`; a one-line app change makes the route read them. |
| A3 | **`next.config.ts` already computes `BUILD_GIT_SHA`** via `git rev-parse` | `next.config.ts:5-11` | In a Docker build there is no `.git`, so it resolves to `"unknown"` unless passed as a build arg. |
| A4 | **`ZUGZWANG_ENV` is inlined into the bundle at build time** | `next.config.ts` `env:` block | Images are environment-specific; a staging image can never be promoted to production. |
| A5 | **`NEXT_PUBLIC_SENTRY_DSN` is required when `ZUGZWANG_ENV` is `staging`/`prod`** | `instrumentation.ts:44` — throws at boot | Missing value = container crash-loops. Must be present at **build** and at **runtime**. |
| A6 | **`BETTER_AUTH_URL` fails at build time** | `CLAUDE.md` §Gotchas, confirmed by `src/server/auth/index.ts` usage | The domain must exist before the image is built. |
| A7 | **Three cron routes, already Bearer-authenticated** | `vercel.json`; `src/app/api/cron/*/route.ts` — constant-time compare against `CRON_SECRET` | EventBridge can call them directly with an `Authorization` header. No app change needed. |
| A8 | **`close-due-markets` runs every minute** | `vercel.json` | Nothing else closes markets. Highest-priority cron. |
| A9 | **`cacheComponents: true`** (PPR + `'use cache'`), with `revalidateTag` from moderation/market actions | `next.config.ts:26`; `src/server/admin/moderation/act.ts` | Next's cache is per process. Multiple tasks ⇒ an invalidation on task A does not reach task B. **Production runs 1 task** until a shared cache handler exists. |
| A10 | **No filesystem writes anywhere in `src/`** | `grep writeFileSync/createWriteStream/mkdirSync src/` → none | Truly stateless; no EFS, no volumes. |
| A11 | **`output: 'standalone'` is NOT set** | `next.config.ts` | One-line app change required before containerising (not made here). |
| A12 | **Postgres client pins pool `max: 4`, `idle_timeout: 20`, `max_lifetime: 600`, `prepare: false`, session pooler only** | `src/db/index.ts` | Keep session pooler (IPv4, port 5432). `DB_POOLER_MODE=transaction` is refused in prod by code. |
| A13 | **Redis uses `Redis.fromEnv()`** | `src/server/upstash/redis.ts` | Requires `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` at runtime. |
| A14 | **Three R2 buckets, each with its own credentials** | `src/server/storage/r2.ts`; env `R2_*_{UPLOADS,PFP,MARKET_MEDIA}` | Stays on Cloudflare. AWS needs outbound HTTPS only. |
| A15 | **Migrations run outside the app**, one transaction per migration, with a production ref guard | `scripts/migrate-prod.ts`, `.github/workflows/staging-migrate.yml` | Migration step stays in CI; AWS only needs the ordering guarantee. |
| A16 | **`proxy.ts` matcher `/admin/:path*`** redirects unauthenticated admin requests | `proxy.ts` | Next middleware runs inside the container; no ALB rule needed. |
| A17 | **`next/image` is used on 3 admin/onboarding pages** | grep | The optimiser runs in-process and needs `sharp` in the image. |
| A18 | **`after()` from `next/server`** is used for cache counters | `src/server/observability/cache-metrics.ts` | Works self-hosted; it just needs the process to stay alive briefly after the response — so **stop timeout ≥ 30 s**. |
| A19 | **Static asset caching header for `/art/warli-field.*.svg`** | `next.config.ts` `headers()` | Served by the app; CloudFront/Cloudflare can cache it. |
| A20 | **Health endpoint also reports migration drift** by hashing `drizzle/migrations/**` | `outputFileTracingIncludes` + `src/server/health/migration-drift.ts` | Migration files must be inside the image. `output: standalone` + explicit copy. |

### What stays external (verified)
Supabase Postgres, Upstash Redis, Cloudflare R2, OpenAI, Resend, Sentry, PostHog — **all reached over outbound HTTPS**. None of them should be recreated in AWS. Supabase `pg_cron` jobs (liquidity injector, drift checks) live in the database and are unaffected.

---

## 2. Vercel → AWS mapping

| Vercel today | AWS replacement | Where in CDK |
|---|---|---|
| Serverless functions (`bom1`) | ECS service on EC2 instances, `ap-south-1` | `compute-stack` |
| Vercel edge/CDN | CloudFront (optional) or existing Cloudflare | `compute-stack` (flag) |
| Automatic TLS | ACM certificate on the ALB | `compute-stack` |
| `vercel.json` crons (3) | EventBridge Rules → API Destination → ALB, with `Authorization: Bearer` from Secrets Manager | `scheduler-stack` |
| `VERCEL_GIT_COMMIT_SHA` | `APP_COMMIT_SHA` container env, set from the image tag | `compute-stack` |
| `VERCEL_REGION` | `APP_REGION` container env | `compute-stack` |
| Vercel env vars (Doppler-synced) | Secrets Manager secret per environment + plain env for non-secrets | `security-stack` |
| Vercel runtime logs | CloudWatch Logs (one group per environment) | `compute-stack` / `monitoring-stack` |
| Vercel deploy + promote | GitHub Actions: build → push ECR → migrate → `ecs deploy` → health gate | docs + `README.md` |
| Vercel instant rollback | ECS deployment circuit breaker + redeploy of the previous image tag | `compute-stack` |
| Preview deployments | Out of scope (keep Vercel previews, or add later) | — |

---

## 3. Target architecture

```
Route 53 (or Cloudflare DNS)
        │
        ├─ (optional) CloudFront — caches /_next/static/*, passes the rest
        │
        ▼
Application Load Balancer  (public subnets, HTTPS via ACM, HTTP→HTTPS redirect)
        │  health check: GET /api/health  (200, 15 s interval)
        ▼
ECS service on EC2  (1 task in production until a shared cache handler exists)
  • EC2 auto scaling group, ECS-optimised AMI, t3.medium (t3.small on staging)
  • awsvpc network mode, so the task keeps its own security group
  • Next.js standalone, Node 24, port 3000
  • stopTimeout 30 s (lets `after()` finish), ALB deregistration delay 30 s
  • env from config, secrets from Secrets Manager
        │
        └── outbound HTTPS ──► Supabase · Upstash · R2 · OpenAI · Resend · Sentry · PostHog

EventBridge Rules (rate 1 min / 5 min / 6 h)
        └─► API Destination (Connection: Authorization: Bearer <CRON_SECRET>)
                └─► https://<host>/api/cron/{close-due-markets,alarms-drain,r2-orphan-sweep}
```

**Egress:** configurable. `natGateways: 0` places tasks in public subnets with a public IP and no inbound rules (cheapest, staging default). `natGateways: 1` places tasks in private subnets behind NAT (production default, ~$32/month).

---

## 4. CDK stack structure

```
infra/
├── bin/zugzwang.ts            instantiates one set of stacks per environment
├── lib/
│   ├── network-stack.ts       VPC, subnets, security groups, optional NAT
│   ├── security-stack.ts      Secrets Manager reference, IAM roles, ECR repo
│   ├── compute-stack.ts       cluster, task definitions (app + migration), ALB, TLS, autoscaling
│   ├── scheduler-stack.ts     EventBridge connection, API destination, 3 rules
│   └── monitoring-stack.ts    log group, SNS topic, alarms, dashboard
├── config/
│   ├── types.ts               the environment contract
│   ├── staging.ts             staging values
│   └── production.ts          production values
├── cdk.json · package.json · tsconfig.json · README.md
```

Dependency order: `network → security → compute → {scheduler, monitoring}`. Cross-stack values are passed as typed props, never read back with lookups, so `cdk synth` works with no AWS credentials.

---

## 5. Required AWS resources

| Resource | Purpose | Notes |
|---|---|---|
| VPC, 2 AZs | isolation | public + (optional) private-with-egress subnets |
| Security group (ALB) | inbound 80/443 from the internet | |
| Security group (tasks) | inbound 3000 **from the ALB SG only** | least privilege |
| ALB + target group + listeners | HTTPS termination, health checks | HTTP redirects to HTTPS |
| ACM certificate | TLS | imported by ARN, or created when a Route 53 zone is given |
| ECR repository | container images | lifecycle rule keeps the last 20 |
| ECS cluster + EC2 service | runs the app | capacity provider with managed scaling and draining; circuit breaker with rollback |
| Auto Scaling Group + launch template | the EC2 capacity | ECS-optimised AMI, IMDSv2 required, min 1 / max 2 |
| Instance role | joins the cluster, SSM Session Manager | created beside the cluster; no SSH key, no port 22 |
| Task execution role | pull image, write logs, read secrets | AWS-managed policy + explicit secret read |
| Task role | the app's own AWS identity | **no AWS permissions** — the app calls only external HTTPS APIs |
| Migration task definition | runs migrations as a one-off task | optional; CI can run them instead |
| Secrets Manager secret | one JSON secret per environment | created/populated outside CDK; referenced by name |
| CloudWatch log group | container logs | retention per environment |
| EventBridge connection + API destination + 3 rules | the crons | secret header stored by EventBridge |
| SNS topic + email subscription | alerts | |
| CloudWatch alarms | 5xx, latency, unhealthy hosts, CPU, memory, failed cron invocations | |
| CloudFront (optional) | static asset caching | off by default when Cloudflare is in front |
| WAF WebACL (optional) | common rule set | off by default |

---

## 6. Environment variables and secrets

**Build-time (baked into the image — the image is environment-specific):**
`ZUGZWANG_ENV`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `BETTER_AUTH_URL`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (source maps), `APP_COMMIT_SHA`.

**Runtime plain env (from config, non-secret):**
`ZUGZWANG_ENV`, `NODE_ENV`, `PORT`, `HOSTNAME=0.0.0.0`, `APP_COMMIT_SHA`, `APP_REGION`, `DB_POOLER_MODE=session`, `NEXT_PUBLIC_*` (also at runtime for server-rendered pages).

**Runtime secrets (Secrets Manager → container `secrets:`):**
`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TURNSTILE_SECRET_KEY`, `ADMIN_PASSWORD`, `CRON_SECRET`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and the nine R2 values (`R2_{ENDPOINT,BUCKET,ACCESS_KEY_ID,SECRET_ACCESS_KEY}_{UPLOADS,PFP,MARKET_MEDIA}`, `R2_PUBLIC_URL_PFP`).

**No secret values appear in CDK.** The secret is created and populated out of band (Doppler remains the source of truth); CDK references it by name and grants read access.

---

## 7. Deployment flow (ordering is the point)

```
1. CI builds the image with build args for this environment      (per-env image)
2. Push to ECR as <env>-<git-sha>  and also <env>-latest
3. RUN MIGRATIONS FIRST — `pnpm db:migrate:prod` in CI (Doppler),
   or `aws ecs run-task` with the migration task definition
   → fail the pipeline here and the old code keeps serving
4. Update the ECS service to the new image tag
5. Wait for services-stable (circuit breaker rolls back automatically on failure)
6. VERIFY: GET /api/health  → status ok · db ok · migrations ok · canary == git sha
7. Keep the previous tag; rollback = redeploy it (no rebuild)
```

This preserves ADR-0024's **migrate-before-serve** and the runbook's rule that the health gauge, not an exit code, decides success.

---

## 8. Cron migration plan

| Job | Vercel schedule | AWS | Why it matters |
|---|---|---|---|
| `close-due-markets` | `* * * * *` | EventBridge rule `rate(1 minute)` | markets stop closing without it |
| `alarms-drain` | `*/5 * * * *` | `rate(5 minutes)` | liquidity alarms |
| `r2-orphan-sweep` | `0 */6 * * *` | `rate(6 hours)` | orphaned uploads |

Each rule targets an **API Destination** whose Connection holds `Authorization: Bearer <CRON_SECRET>`; the routes already verify it with a constant-time compare, so no app change is needed. Failed invocations raise a CloudWatch alarm, and the destination is rate-limited so a retry storm cannot hammer the app.

---

## 9. Health check and deployment verification

- **ALB target group:** `GET /api/health`, 200 only, 15 s interval, 5 s timeout, healthy 2 / unhealthy 3, deregistration delay 30 s.
- **Container health check:** a `node -e fetch('http://127.0.0.1:3000/api/health')` probe, so a wedged process is replaced even if the ALB is satisfied.
- **Pipeline gate:** `canary` must equal the deployed commit — requires A2's small app change (`VERCEL_GIT_COMMIT_SHA ?? APP_COMMIT_SHA`). Until that lands, the gate must compare `db`/`migrations` only, and the README says so.

---

## 10. Networking and security

- Tasks accept traffic **only** from the ALB security group; the ALB is the only internet-facing resource.
- No inbound access to tasks, no SSH, no bastion. Debugging uses ECS Exec (off by default, flag).
- Task role holds **no AWS permissions**; the execution role reads exactly one secret.
- Secrets never enter the image, the task definition or CDK source — only ARNs and key names do.
- Egress is either NAT (production) or public-subnet direct (staging), both outbound-only.
- Optional WAF with the AWS common rule set; optional CloudFront for `/_next/static/*`.

---

## 11. Risks, blockers and assumptions

**Blockers — application changes required before a real deploy (not made here):**
1. `output: 'standalone'` in `next.config.ts` (A11).
2. `/api/health` should fall back to `APP_COMMIT_SHA`/`APP_REGION` (A2), or the deploy gate is blind.
3. `ipAddress()` from `@vercel/functions` should fall back to `x-forwarded-for` (A1), or the `ip` log column is always null.
4. A `Dockerfile` — the design assumes multi-stage Node 24 Alpine with `sharp`, the standalone output, `drizzle/migrations/**` and `public/**` copied in.

**Risks**
- **Cache divergence** with >1 task (A9) — production is pinned to 1 task; autoscaling max is a config value with a written warning.
- **Cron silence** — a misconfigured secret fails quietly; the FailedInvocations alarm is mandatory, not optional.
- **Freeze window** — the experiment freezes 5 Nov 2026; cutover should happen well before, or after.
- **Single AZ task** — one task means a brief gap if an AZ fails; ECS reschedules automatically, typically under a minute.

**Assumptions needing confirmation**
1. AWS account and region: `ap-south-1` (same as Supabase).
2. DNS stays on Cloudflare (so CloudFront and Route 53 records default to off), and the ACM certificate ARN is supplied.
3. Secrets Manager secret names: `zugzwang/staging` and `zugzwang/production`.
4. Alert email address for SNS.
5. Production NAT is acceptable (~$32/month); staging runs without it.
6. Migrations keep running from GitHub Actions (the ECS migration task is provided as an alternative, and needs an image that includes dev dependencies).
