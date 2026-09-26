# 09 — Production readiness: blockers, procedures, cutover

| | |
|---|---|
| **Status** | **NOT READY — production is NOT approved.** Nothing in this document has been executed against production. |
| **Measured** | 2026-09-26, against `main` = `0973588` (PR #575, squash of `feat/aws-migration`) |
| **Production today** | Vercel (`bom1`) + Supabase. `zugzwangworld.com` → `216.198.79.1`, `Server: Vercel`, `/api/health` canary **`4457354`** (an OLDER `main` commit — Vercel production does not auto-deploy `main`) |
| **AWS today** | Staging only: six `Zugzwang-staging-*` stacks + `CDKToolkit`, one staging RDS, secrets `zugzwang/staging*`, ECR `zugzwang-staging`. **No production resource exists.** |
| **Plan** | `docs/plans/AWS-MIGRATION-4.md` — scope, decisions D-1…D-12, files, guards, rollout gates (PROPOSED) |
| **Predecessors** | `06-STAGING-DEPLOYMENT.md` (staging, verified) · ADR-0059 (RDS) · ADR-0060 (production readiness) · ADR-0061 (client IP) |

This document is the go/no-go record. Every "verified" row names what was measured; every AWS,
Cloudflare, Doppler or GitHub change is listed as an **operator action needing approval** and has
NOT been performed. Sections §A–§J are the blockers; §K onwards are the procedures.

---

## Verified facts (2026-09-26)

| Fact | How measured |
|---|---|
| Account `849076101704` is on the AWS **FREE plan**, `ACTIVE`, **$154.48 credits left**, plan expires 2027-03-21 | `aws freetier get-account-plan-state` |
| EC2 On-Demand Standard vCPU quota **8**; increase to 16 requested, `CASE_OPENED` since 2026-09-25 | `service-quotas get-service-quota L-1216C47A`, change history |
| Free-plan-eligible EC2 types in ap-south-1 include `m7i-flex.large` (the configured type); `t3.medium` is NOT | `ec2 describe-instance-types --filters free-tier-eligible=true` |
| `db.t4g.small` / Postgres 17.6 is orderable in ap-south-1 with Multi-AZ | `rds describe-orderable-db-instance-options` — ⚠ this does **not** prove the Free plan will allow it (§H) |
| Staging RDS: `PubliclyAccessible=false`, encrypted, single-AZ, 1-day backups | `rds describe-db-instances` |
| CDK bootstrap: one qualifier `hnb659fds`, execution role = **`AdministratorAccess`** | `CDKToolkit` parameters, `iam list-attached-role-policies` |
| **No GitHub OIDC provider, no deploy role, no `Zugzwang-Deploy` stack** — every deploy so far ran as IAM user `zugzwang-deploy` (**`AdministratorAccess`, long-lived access key**) | `iam list-open-id-connect-providers`, `list-roles`, `list-attached-user-policies` |
| **Root account MFA is NOT enabled** (`AccountMFAEnabled: 0`) | `iam get-account-summary` |
| DNS is on Cloudflare (`kevin`/`joyce.ns.cloudflare.com`) but both hostnames are **DNS-only (grey cloud)** — no `cf-ray`; staging resolves straight to the ALB | `nslookup`, response headers |
| No WAF WebACL exists anywhere (staging `wafEnabled: false`) | `wafv2 list-web-acls` |
| Staging SNS topic `zugzwang-staging-alarms` has **0 subscriptions**; 11 alarms `OK` | `sns list-subscriptions-by-topic`, `cloudwatch describe-alarms` |
| Doppler `prd` (38 names) lacks **`BETTER_AUTH_TRUSTED_ORIGINS`** and **`NEXT_PUBLIC_SENTRY_DSN`** (both in `RUNTIME_SECRET_KEYS`) and the Sentry build tokens | `doppler secrets --only-names` (names only) |
| Vercel production (`4457354`) predates the `src/proxy.ts` move, so **the write-pause cannot run on Vercel today** | canary vs `git log` |

---

## §A — S-1 client IP: remaining launch requirements

**Done (merged, `main`):** one peer-anchored helper, all nine call sites, Better Auth stamp, guards (ADR-0061).

**Done locally (uncommitted, this pass):**
- **Fails closed.** `CF-Connecting-IP` is now believed only when `ZZ_CF_ORIGIN_SECRET` is set AND presented.
  With the zone DNS-only, the old "trust any Cloudflare peer when unset" let a WARP user or a Worker choose
  its own rate-limit key; that path is closed (`client-ip.ts`; two new rows, mutation-checked: both go red
  when the rule is reverted). ADR-0061 R1/F1/Context corrected in place.
- **F3.** ALB pinned to `xff_header_processing.mode=append` + `drop_invalid_header_fields=true`
  (`compute-stack.ts`, `tests/unit/infra/alb-client-ip.test.ts`; confirmed in the synthesized template).

**Remaining:**
| Item | Kind |
|---|---|
| **A6 — LAUNCH BLOCKER** — send a two-line `X-Forwarded-For` straight to the staging ALB and observe what the task receives. If the ALB appends into the FIRST line, a client can place a chosen last hop and — with the Cloudflare branch closed — it is returned directly, rotating `adminLoginPerIp` and writing a chosen IP into Bucket-A rows (security H1). If it does, block client-supplied `X-Forwarded-For` at the WAF/listener before cutover. | needs a staging debug route or log line + a staging deploy → **approval** |
| **F6** — a global (IP-independent) cap on admin-login attempts | **decision**: it removes brute force but lets anyone lock the operator out for the window. Recommend 30/hour global, checked after the per-IP limit. |
| **F4** — SPEC.2 §3.7 line 246 (names `proxy.ts` as the `ip` source; says `ip` is released in the dataset, contradicting Appendix B) | doc fix + SPEC.2 version entry; operator to rule |
| **F1** — only if the zone is ever orange-clouded: Transform Rule + `ZZ_CF_ORIGIN_SECRET` | not needed for a DNS-only cutover. ⚠ Orange-clouding WITHOUT it keys every user on a few edge addresses — 10 admin logins/hour per edge, checked before the password, so an attacker on the same edge locks the operator out (security M4). A detector (log once per window when a Cloudflare peer arrives with the secret unset) is a follow-up. |
| **Admin brute-force fails open on Redis failure** — `checkRateLimit` admits on any exception (ADR-0006 posture), so an Upstash/NAT outage leaves `ADMIN_PASSWORD` unbounded (security M7, pre-existing) | separate task; F6's global cap should be evaluated **fail-closed** |

## §B — H-3: CDK bootstrap / execution-role scope

**Verified:** one bootstrap (`hnb659fds`) whose execution role is `AdministratorAccess`; deploys run as an
admin IAM user with a long-lived key.

**Done locally:** every production stack now synthesizes with its own qualifier **`zzprod`**
(`DefaultStackSynthesizer`; all six production templates reference it, no staging template does, and
`cdk diff` shows staging's templates unaffected by the qualifier). `Zugzwang-Deploy` binds the staging role
to `cdk-hnb659fds-*` and the production role to `cdk-zzprod-*` only.

**Operator actions (AWS writes — approval required):**
1. **Enable MFA on the root user.** Not optional for an account that will hold production.
2. Create a scoped CloudFormation execution policy for production (the services the stacks use: EC2/VPC,
   ECS, ECR, ELBv2, RDS, Secrets Manager read, IAM roles *with a permissions boundary*, Logs, CloudWatch,
   SNS, Events/Scheduler, WAFv2, SSM params) — or, as the interim, AdministratorAccess **plus** a permissions
   boundary that denies `iam:*User*`, `organizations:*`, `account:*`.
3. `cdk bootstrap aws://849076101704/ap-south-1 --qualifier zzprod --toolkit-stack-name CDKToolkit-prod
   --cloudformation-execution-policies <policy-arn>`

   **Prepared (item 4, not run):** `infra/policies/production-cfn-execution-policy.json` (service-scoped
   for the 42 resource types production creates; IAM only on `role/Zugzwang-production-*` and only with
   the boundary attached; users, groups, keys, policy versions, OIDC/SAML, STS, Organizations and the
   bootstrap/GitHub deploy roles explicitly denied) and `production-permissions-boundary.json` (every
   production role: no `iam`/`sts`/`organizations`/`account`/`cloudformation`). The CDK app applies the
   boundary to every production stack; staging templates are byte-identical. Commands, in order:
   ```bash
   cd infra
   npx cdk synth "Zugzwang-production-*" -o cdk.out.prod -q
   npx tsx scripts/check-production-policies.ts cdk.out.prod        # must print PASS
   aws iam create-policy --policy-name zugzwang-production-boundary \
     --policy-document file://policies/production-permissions-boundary.json
   aws iam create-policy --policy-name zugzwang-production-cfn-exec \
     --policy-document file://policies/production-cfn-execution-policy.json
   npx cdk bootstrap aws://849076101704/ap-south-1 --qualifier zzprod \
     --toolkit-stack-name CDKToolkit-prod \
     --cloudformation-execution-policies arn:aws:iam::849076101704:policy/zugzwang-production-cfn-exec
   ```
   ⚠ The policy is checked statically, not yet by a deploy. The first production `cdk deploy` is its real
   test; an `AccessDenied` there is a missing action to add here, never a reason to fall back to
   `AdministratorAccess`.
4. Deny the staging bootstrap's **deploy role** CloudFormation on `stack/Zugzwang-production-*` **and
   `stack/Zugzwang-Deploy/*`** (inline policy on `cdk-hnb659fds-deploy-role-…`), plus `iam:*` on
   `role/zugzwang-production-*`. Without it, staging's deploy role can still act on any stack name —
   including `Zugzwang-Deploy`, whose PRODUCTION role it could rewrite (review HIGH-3). The qualifier
   split alone stops a staging token assuming production's bootstrap roles; it does not stop this.
   **Prepared (item 5, not run):** `infra/policies/staging-deploy-role-deny.json` — Deny-only: CloudFormation
   on `Zugzwang-production-*`, `Zugzwang-Deploy`, `CDKToolkit-prod`; S3 on `cdk-zzprod-*`; SSM on
   `/cdk-bootstrap/zzprod/*`; IAM + `sts:AssumeRole` on `cdk-zzprod-*`, `Zugzwang-production-*`,
   `zugzwang-production-*` roles and `zugzwang-production-*` policies. (Measured: the role's bootstrap policy
   allows CloudFormation, S3 and KMS on `*`.) `Zugzwang-Deploy` now synthesizes with
   `CliCredentialsStackSynthesizer`, so it is deployed with the operator's own credentials and needs no
   bootstrap deploy role; its resources are unchanged (only the `BootstrapVersion` check is dropped).
   Order: merge the synthesizer change → `cdk deploy Zugzwang-Deploy -c deployStack=true` once with operator
   credentials (confirms it no longer uses the deploy role) → then:
   ```bash
   aws iam put-role-policy --role-name cdk-hnb659fds-deploy-role-849076101704-ap-south-1 \
     --policy-name zugzwang-deny-production \
     --policy-document file://infra/policies/staging-deploy-role-deny.json
   ```
   Then push a no-op to `staging` and confirm the staging deploy stays green. ⚠ Re-check the inline policy
   still exists after any future `cdk bootstrap` of `hnb659fds`.
5. After GitHub OIDC works (§C), deactivate the `zugzwang-deploy` access key or reduce the user to read-only.

**Stronger alternative (recommended if the plan must change anyway, §H):** production in its own AWS
account under an Organization. Account separation is the only boundary that does not depend on getting
IAM right.

## §C — Production GitHub OIDC and deploy workflow

**Verified:** no OIDC provider and no deploy roles exist; `deploy-aws.yml` has never run.

**Done locally:**
- `build` refuses `environment=production` unless the ref is `refs/heads/main`.
- The migrate job no longer uses Doppler (§D); only `build` holds `DOPPLER_TOKEN`.
- `verify` pins requests to the environment's own ALB (`curl --resolve`), so it works before DNS moves (§J).
- Every third-party action is pinned to a commit SHA (§G).

**Why the file's guard is not the control (security H2).** `workflow_dispatch` runs the workflow
file *from the dispatched ref*, so a branch can delete the `guard` job; the OIDC `sub` claim carries
the **environment**, not the ref. What binds production to `main` is (a) the GitHub `production`
environment's deployment-branch policy and reviewer, and (b) binding the ref into the token's `sub`
via GitHub's OIDC subject-claim customization (`include_claim_keys: ["repo","context","ref"]` for this
repository) and matching it in the role's trust policy. ⚠ Whether AWS IAM can condition directly on
the `job_workflow_ref` claim is **not established** here — use the `sub` customization, which is.

**Operator actions (approval):**
1. `cdk deploy Zugzwang-Deploy -c deployStack=true` with `ZZ_GITHUB_REPOSITORY=zugzwang-foundation/experiment`
   (creates the OIDC provider + two roles). Outputs `DeployRoleArn-staging` / `-production`.
2. GitHub → Settings → Environments → `production`: **required reviewer = you**, deployment branches = `main`
   only; secrets `AWS_DEPLOY_ROLE_ARN`, `DOPPLER_TOKEN` (a `prd`-scoped service token); variables
   `ZZ_PROD_CERT_ARN`, `ZZ_ALERT_EMAIL`, `ZZ_PROD_WRITES_PAUSED` (empty), optionally `ZZ_PROD_WAF_MODE`.
   Same for `staging` with its values.
3. Customize the repository's OIDC `sub` claim to include `ref`, and tighten the production role's trust
   condition to `repo:zugzwang-foundation/experiment:environment:production:ref:refs/heads/main`
   (exact form per the customization) — **before** the role can deploy anything.
4. Rehearse the workflow on **staging** first (it has never run anywhere) — in **two dispatches**
   (§D): `skip_migrations: true, writes: open`, then a normal one.

⚠ **Open question:** `build` passes Doppler's `DATABASE_URL` into `next build`. If the build prerenders
against the database, a production build on a GitHub runner cannot reach the private RDS after cutover.
Confirm on the staging rehearsal (step 3).

## §D — Private RDS migrations

**Verified:** RDS is private; the old migrate job ran `db:migrate:prod` from a GitHub runner, which cannot
reach it. `migrate-prod.ts` requires `DATABASE_URL_PROD` to contain `PROD_PROJECT_REF_FRAGMENT`.

**Done locally:** migrations run as a one-off **ECS task inside the VPC** — the path the staging fixture
void already proved (06 §10.6). The migration task family is fixed (`zugzwang-<env>-migrate`) and runs a
stable `<env>-migrate` image tag that `build` re-points each run; the workflow reads subnets/SG/capacity
provider from new stack outputs, starts the task, waits (≤30 min) and fails unless it exits 0. The deploy
role may `RunTask` only that family on that cluster and `PassRole` only that environment's task roles.
No DSN passes through GitHub.

**Hardened after review:**
- The migrate container receives **only** `DATABASE_URL_<ENV>` + `<ENV>_PROJECT_REF_FRAGMENT` (measured: the
  migration scripts read nothing else). A RunTask can override the command, so every secret injected
  there was one override from exfiltration (security M1). ⚠ This retires the migrate task as a vehicle
  for ad-hoc engine runs needing app credentials (the 06 §10.6 void used it that way).
- `iam:PassRole` names the task roles by their **real ARNs**, passed from the Security stacks.
  Measured: staging's generated execution-role name is exactly 64 characters, so production's (3 chars
  longer stack name) is truncated and a prefix pattern would match nothing (review HIGH-4). ⚠ The first
  fix — explicit role names — was withdrawn before it ran (STAGING-PASSROLE): it would have REPLACED the
  live staging roles, whose ARNs Security exports to Compute, and CloudFormation refuses to change an
  export in use.
- `run-task`'s `failures[]` is printed when no task is placed (MEDIUM-6); a task still RUNNING after
  30 min fails the job with a "stop it by hand" instruction (there is no advisory lock — two migrators
  must never overlap).
- **Provenance:** the task runs the mutable `<env>-migrate` tag (it must — migrations precede the deploy
  that would teach the stack a new tag). The build records the digest it pushed and the migrate job
  fails unless the task's `imageDigest` equals it (MEDIUM-9). A rollback deploy does NOT move the tag.

**⛔ First run for an environment is TWO dispatches (review HIGH-2).** The migrate job reads four
outputs that only exist once this pass's Compute stack is deployed. Dispatch 1: `skip_migrations: true`
(deploys Compute, gains the outputs). Dispatch 2: normal. On a brand-new environment dispatch 1's
`verify` will FAIL — `/api/ready` reports `failed > 0` against an unmigrated database — and that
failure is expected; dispatch 2 is the real gate.

**`staging-migrate.yml` does not touch the RDS (review HIGH-1).** It migrates the Supabase staging
database the *Vercel* staging deployment uses. The AWS staging RDS is migrated only by this workflow.
The file's header now says so.

⚠ **Staging impact when next deployed:** the migration task definition is replaced (family, tag,
secrets); the task roles are unchanged; ALB gains the two attributes. The `staging-migrate` tag must exist first (the
workflow pushes it). Measured with `cdk diff --no-change-set`.
⚠ A hand-run `cdk diff`/`deploy` without `ZZ_STAGING_CERT_ARN` set shows the HTTPS listener being
**destroyed** — the synth-time hazard the workflow's refuse-to-synth guard exists for. Never hand-deploy
Compute without it.

**Operator actions:** in the production secret, `DATABASE_URL_PROD` → the production RDS and
`PROD_PROJECT_REF_FRAGMENT` → a fragment of that RDS hostname (as staging did).

## §E — Production Doppler / Secrets Manager

**Verified:** Doppler `prd` lacks `BETTER_AUTH_TRUSTED_ORIGINS` and `NEXT_PUBLIC_SENTRY_DSN`. ECS refuses to
start a task whose secret references a missing JSON key, so production would not boot.

**Required (approval — Doppler and AWS writes):**
1. Add `BETTER_AUTH_TRUSTED_ORIGINS` and `NEXT_PUBLIC_SENTRY_DSN` to `prd` (and `SENTRY_AUTH_TOKEN`/`ORG`/
   `PROJECT` if source maps are wanted).
2. **Tooling gap:** `staging-secret.cjs` refuses any target but staging. A reviewed `prod-secret.cjs` twin is
   needed to compose `zugzwang/production` from `prd` with `DATABASE_URL`/`DATABASE_URL_PROD` → production
   RDS (`sslmode=require`). Not written in this pass: it handles production credentials and should be
   written and reviewed as its own change.
3. `build.env` (the full `prd` config the workflow writes for `docker build --secret`) is now excluded by
   both `.dockerignore` and `.gitignore` (security M3) — it had been copied into the build stage's layer
   by `COPY . .`, one registry cache away from publishing every production secret.
4. Decide whether production keeps the **same Upstash** instance (recommended — idempotency keys and rate
   limits stay continuous across the cutover) and the same R2 buckets (yes — images live there).

## §F — SNS alerting

**Verified:** staging topic has 0 subscribers — alarms fire into nothing. The workflow already refuses to
synth without `ZZ_ALERT_EMAIL`, but a hand-run `cdk deploy` does not.

**Operator actions (approval):** set `ZZ_ALERT_EMAIL`; subscribe it on staging now and **click the
confirmation email** (a pending subscription receives nothing); test with
`aws cloudwatch set-alarm-state --state-value ALARM` on one staging alarm. Production gets it at creation.

## §G — GitHub Actions pinning

**Done locally:** every `uses:` across the four workflows pinned to the commit SHA its major tag resolved
to on 2026-09-26 (peeled via `git ls-remote`), tag kept as a comment. No unpinned reference remains —
`grep -nE 'uses: .*@v[0-9]' .github/workflows/` returns nothing (the command is the claim; a count
written here went stale inside the same pass).
Follow-up: let Dependabot's `github-actions` ecosystem propose SHA bumps.

## §H — Account plan, quota, RDS

**Verified:** FREE plan, $154.48 credits, expires 2027-03-21. When the credits are used up or the plan
ends, a Free-plan account is **closed** unless upgraded — a production outage by design.

Rough monthly run-rate of production **as configured** (estimates, not measured): NAT ≈ $33, Multi-AZ
`db.t4g.small` ≈ $50–60, `m7i-flex.large` ≈ $70, ALB ≈ $20, WAF ≈ $10, plus staging's own. The credits
would last roughly **one month**.

**Operator actions — BLOCKING:**
1. **Upgrade the account to a paid plan** (or move production to a new paid account, §B). Nothing else in
   this list matters if the account closes mid-experiment.
2. Confirm the vCPU increase (8 → 16) is granted; 8 fits staging + production only while no rolling update
   overlaps.
3. After the upgrade, re-check that Multi-AZ `db.t4g.small` launches (unproven under the Free plan).

## §I — WAF rehearsal

**Verified:** no WebACL exists; production would enable `AWSManagedRulesCommonRuleSet`, never run
against this app. Its XSS/body rules can 403 a participant's argument — a silent failure on the bet path.

**Done locally:** `wafMode: "count" | "block"`. Production starts in **count** (`ZZ_PROD_WAF_MODE=block`
enforces later without a code change); staging can attach the same rules with `ZZ_STAGING_WAF=count`,
off by default so staging's template is unchanged.

**Rehearsal (staging deploy — approval):** deploy staging with `ZZ_STAGING_WAF=count`; exercise sign-in,
OTP, onboarding, a bet with a long/markup-heavy argument, a reply, a sell, admin market create + media
sign, the cron routes; then read `wafv2 get-sampled-requests` for any `COUNT` match on a legitimate
request. Move production to `block` only when that list is empty or the matching rules are excluded.

## §J — Pre-cutover private smoke test

The production stack can be fully verified **before DNS moves**, because the ACM certificate and Host
header are satisfied by pinning the connection to the ALB:

```
ALB=$(aws cloudformation describe-stacks --stack-name Zugzwang-production-Compute \
  --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerDns'].OutputValue" --output text)
IP=$(node -e "require('dns').resolve4(process.argv[1],(e,a)=>{if(e)process.exit(1);console.log(a[0])})" "$ALB")
curl --resolve zugzwangworld.com:443:$IP https://zugzwangworld.com/api/health   # canary, db, migrations, writesPaused
curl --resolve zugzwangworld.com:443:$IP https://zugzwangworld.com/api/ready    # ready:true, failed:0
```

Checklist (the workflow's `verify` job automates the first two):
1. `/api/health`: canary = deployed tag, `db: ok`, `migrations: ok`, `writesPaused: true` during the window.
2. `/api/ready`: `ready: true`, `failed: 0`.
3. Home, one `/m/<slug>`, one `/u/<pseudonym>` render with the **restored** data (counts match the dump).
4. While paused: `POST /api/bets/place` → **503 `error_writes_paused`** (proves the pause, writes nothing).
5. Sign-in page renders; Google OAuth redirect URI is the unchanged domain.
6. `staging-verify.cjs`-equivalent invariants against the production RDS (INV-2 balances, oversell 0,
   I-LOT-SUM, I-GENESIS, append-only still rejecting).

Prerequisite: the ACM certificate for `zugzwangworld.com` is **issued** — its DNS-validation CNAME is a
Cloudflare record (**approval**; it does not move traffic).

---

## §K — Production migration sequence

Each step names who acts. No step runs without explicit approval of the whole sequence.

**Phase 0 — prerequisites (days before; no production traffic affected)**
1. §H account upgrade · root MFA · quota. 2. §B `zzprod` bootstrap. 3. §C OIDC + GitHub environments.
4. §E Doppler `prd` keys + `prod-secret.cjs` reviewed. 5. §F alert email confirmed. 6. §I WAF rehearsal.
7. **Promote a `main` build containing `src/proxy.ts` to Vercel production, write-pause OFF**, and prove
   the proxy runs there (`/admin/markets` without a cookie → redirect; `.next/server/middleware-manifest.json`
   non-empty). Without this the source cannot be frozen (see §L).
8. Lower the TTL of the `zugzwangworld.com` record to 60 s at least one old-TTL before cutover.
9. Request the ACM certificate; add its validation CNAME in Cloudflare.

**Phase 1 — build production, empty (no traffic)**
10. Deploy `Zugzwang-production-{Network,Security,Database}` (RDS Multi-AZ, deletion protection on).
11. Compose `zugzwang/production` (§E), `DATABASE_URL` → production RDS.
12. Deploy Compute/Scheduler/Monitoring with **`ZZ_PROD_WRITES_PAUSED=paused`** and the workflow input
    **`writes: paused`** — the deploy refuses unless the two agree, and `verify` fails unless
    `/api/health` reports `writesPaused: true` (security H3). The AWS task must not accept a write before
    the data arrives: from this step the ALB is publicly reachable on its own hostname with the
    production certificate, so the pause is the only thing keeping it write-closed until step 21. ⚠ Scheduler rules fire into 503s while paused (06 §10.2 M-4:
    the FailedInvocations alarms will trip — expected).
13. Run migrations in-VPC (§D) against the empty RDS — the second of the two first-run dispatches;
    §J checks 1–2.

**Phase 2 — cutover window (target 10–20 min of write-pause)**
14. **Pause writes on Vercel**: set `ZUGZWANG_WRITES_PAUSED=paused` in Vercel production env and redeploy
    (proxy answers every write 503). Verify with a `POST /api/bets/place` → 503.
15. Unschedule Supabase's `pg_cron` jobs (they write on their own — liquidity injector, drift).
16. Final backup: `doppler run --config prd -- node scripts/aws-migration/prod-backup.cjs --execute`; record
    the SHA-256.
16b. **Make Supabase physically write-closed** (security H4): `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
    ALL TABLES IN SCHEMA public FROM <app role>` and rotate that role's password. A pause flag is a
    procedure; a revoked grant is a mechanism.
17. Restore into production RDS (the production twin of `staging-restore.cjs`: truncate → `pg_restore
    --data-only` with `session_replication_role=replica` → re-arm cron), **in-VPC**.
18. Verify: row counts equal the dump; invariants (§J 6); `/api/health`, `/api/ready`; §J 3.
19. **Go / no-go.** No-go → §N rollback (nothing lost: Supabase untouched since step 14).

**Phase 3 — switch traffic**
20. Cloudflare: change `zugzwangworld.com` from the Vercel record to a CNAME → the ALB DNS name, **grey
    cloud** (ADR-0061: orange cloud requires F1 first).
21. Clear `ZZ_PROD_WRITES_PAUSED` and redeploy with `writes: open` → AWS accepts writes.
22. Watch §M for 60 minutes. Place one real bet end to end.
23. **Leave Vercel production paused permanently** and disable its crons (`vercel.json` still schedules
    them against Supabase). Keep the Supabase project, read-only (16b), until the dataset release
    (2026-11-06).
23b. Remove `DATABASE_URL` (and the other Supabase DSNs) from the Vercel production environment, so no
    redeploy there can reach the retired database (security H4).

## §L — Write-pause behaviour

- **Mechanism:** `src/proxy.ts`. `ZUGZWANG_WRITES_PAUSED=paused` (exact value) answers every write
  `503 + Retry-After: 300 + error_writes_paused` before any Redis reservation, idempotency sentinel or
  transaction starts. Reads, `/api/health` (reports `writesPaused`) and `/api/ready` pass.
- **What counts as a write:** every non-GET/HEAD/OPTIONS under `/api/bets/`, `/api/uploads/`,
  `/api/visits`, `/admin`; every request with a `Next-Action` header (all Server Actions, on any page); every
  `/api/auth/*` except `get-session` and `ok` (the OAuth callback GET writes); every `/api/cron/*`.
- **Proven on staging** (06 §10.6): bets, sell, OAuth callback, social sign-in, cron, admin media sign,
  Server Actions on `/m/<slug>` and `/legal` → 503; reads → 200.
- **Consequences:** sign-in and onboarding are unavailable while paused; admin login and moderation are
  503 too (M-4); the composer shows the pause as a transient failure and keeps its idempotency key.
- **The pause is a synth-time value** on AWS (task-definition environment): any spelling but exactly
  `paused` emits an unpaused task. The deploy workflow now refuses unless its `writes` input agrees
  with the environment variable, and `verify` checks `writesPaused`. A runtime switch (SSM parameter
  read per request) would remove the deploy from the loop — a follow-up (security H3 a).
- ⚠ **The proxy matcher skips any path containing a dot** (`.*\..*`), so pause and admin redirect
  do not run there. Not reachable today (slugs, pseudonyms and ids contain no dots); a separate task.
- ⛔ **Vercel production cannot pause today** — it runs `4457354`, whose proxy was never built. Phase 0
  step 7 is a hard prerequisite.

## §M — Monitoring and verification

- **Gates:** `/api/health` (canary, `db`, `migrations`, `writesPaused`) and `/api/ready` (`ready`, `failed`)
  — the deploy workflow's `verify` job, pinned to the ALB.
- **Alarms (11, SNS → email once §F is done):** target 5xx, p95 latency, unhealthy hosts, CPU, memory, three
  cron `FailedInvocations`, `CloseDueMarketsSilent`, ASG target tracking.
- **Dashboard:** `zugzwang-production` (requests/errors, p50/p95, task CPU/memory, scheduled jobs).
- **Post-cutover watch (60 min):** ALB 5xx = 0; `close-due-markets` invoking every minute; one bet placed
  and replayed (durable receipt); Sentry has no new `bet_statement_timeout`/`ready_warmup_incomplete`; WAF
  sampled requests show no `COUNT` on legitimate traffic.

## §N — Rollback

| When | Procedure | Data loss |
|---|---|---|
| Before step 14 | Nothing to undo; delete or keep the idle AWS stacks | none |
| Steps 14–19 (paused, DNS unchanged) | Clear `ZUGZWANG_WRITES_PAUSED` on Vercel and redeploy; re-schedule Supabase `pg_cron` | none — Supabase received no writes |
| After step 20, before step 21 (DNS moved, AWS still paused) | Point the record back to Vercel; unpause Vercel | none |
| After step 21 (AWS has taken writes) — ⚠ Supabase is write-revoked from 16b, so re-grant first | Pause AWS; dump production RDS; restore into Supabase (reverse of step 17 — a tool that does not exist yet); point DNS back; unpause Vercel | none if done carefully, but it is a second migration. **Decide go/no-go at step 19, not later.** |

## §O — DB backup / restore

- **Backup:** `prod-backup.cjs` — 8-point pre-flight (host `aws-1-ap-south-1.pooler.supabase.com`, db,
  port…), then `pg_dump --format=custom --no-owner` of `public` + `drizzle` to the local backup directory;
  credentials via a mode-0600 env file deleted on exit; never printed. Record the SHA-256.
- **Restore:** schema first (migrations, §D), then data only: truncate → `pg_restore --data-only` with
  `session_replication_role=replica` (RDS forbids `--disable-triggers`; `rds_superuser` may set the role) →
  re-enable → verify. Proven twice on staging (06). **Missing:** a production-targeted restore runner
  (`staging-restore.cjs` is staging-only by design) — and it should run in-VPC, not over an SSM tunnel
  (a tunnel void died after 9.7 min on staging and rolled back).
- **The dump is personal data** (security M5): it holds every column SPEC.2 Appendix B marks STRIP —
  `users.email`, `google_id`, `name`, `image`, ToS acceptance IP/UA — plus `metadata.ip` and
  `sessions.ip_address`. Encrypt it at rest (e.g. `age`/`gpg` immediately after `pg_dump`; the backup
  directory is protected only by the Windows profile ACL, `mode 0600` being a no-op there), and
  **destroy it on a named date** once production has run cleanly for the rollback window. The
  read-only Supabase project is a second full copy: a SPEC.1 `H2` pseudonym scrub on the live
  database reaches neither, so either destroy both before the next erasure window or apply scrubs to them.
- **Ongoing:** RDS automated backups, 7-day PITR, deletion protection (production config). Take a manual
  snapshot immediately after step 18 as the known-good cutover point.

---

## §P — Pre-cutover checklist (all must be ✅ before Phase 2)

- [ ] AWS account on a paid plan (or production in a paid account) — §H
- [ ] Root MFA enabled; `zugzwang-deploy` key retired after OIDC works — §B
- [ ] vCPU quota ≥ 16 granted — §H
- [ ] `zzprod` bootstrap with a scoped execution policy; staging deploy role denied production stacks — §B
- [ ] `Zugzwang-Deploy` deployed; GitHub `production` environment has reviewer + `main`-only + secrets/vars — §C
- [ ] `deploy-aws.yml` rehearsed end to end on staging (build, in-VPC migrate, deploy, pinned verify) — §C/§D
- [ ] Doppler `prd` complete; `zugzwang/production` composed by a reviewed `prod-secret.cjs` — §E
- [ ] Production restore runner written, reviewed, rehearsed on staging — §O
- [ ] Alert email subscribed and confirmed; a test alarm received — §F
- [ ] WAF rehearsal on staging read; production mode decided — §I
- [ ] A6 measured on staging (**blocker**); F6 ruled — §A
- [ ] Repository OIDC `sub` customized to carry `ref`; production role trust bound to `main` — §C
- [ ] Staging bootstrap deploy role denied `Zugzwang-production-*`, `Zugzwang-Deploy`, `zugzwang-production-*` roles — §B
- [ ] First-run two-dispatch sequence rehearsed on staging (roles replaced, migrate outputs present) — §D
- [ ] Cutover dump encryption + destruction date agreed — §O
- [ ] Vercel production promoted to a build with `src/proxy.ts`; pause proven there — §L
- [ ] ACM certificate issued; DNS TTL lowered — §K
- [ ] Production stacks up, migrated, paused; §J smoke 1–6 green — §K Phase 1
- [ ] Rollback owner and go/no-go time agreed — §N
- [ ] Supabase write grants revoked at 16b; Vercel production DSNs removed at 23b — §K

## §Q — Local, uncommitted changes this document describes

- **§A:** `src/server/middleware/client-ip.ts`, `tests/unit/middleware/client-ip.test.ts`,
  `tests/server/middleware/logging.test.ts`, `docs/adr/0061-…md`
- **§A F3, §D, §I:** `infra/lib/compute-stack.ts`, `tests/unit/infra/alb-client-ip.test.ts`
- **§B, §D, §I:** `infra/bin/zugzwang.ts`, `infra/config/{types,staging,production}.ts`,
  `infra/lib/{deploy,security}-stack.ts`, `tests/unit/infra/production-readiness.test.ts`
- **§C, §D, §G, §J:** the four `.github/workflows/*.yml`
- **§E:** `.gitignore`, `.dockerignore` (`build.env`)
- this file

**Reviews (2026-09-26):** `@code-reviewer` and `@security-auditor` ran against this working tree. No
CRITICAL. Every HIGH is either fixed in these files or written into the section it governs as an
operator action or blocker; the findings table is in the session report.

**Checks:** see the session report for the final numbers — tests, `tsc` (app + `infra`),
`biome check .`, `cdk synth` of all 12 environment stacks **and** `Zugzwang-Deploy`
(`-c deployStack=true`), and the workflow's `run:` blocks through `bash -n`.
