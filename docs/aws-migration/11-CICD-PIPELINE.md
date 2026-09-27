# 11 — CI/CD pipeline (staging and production on AWS)

| | |
|---|---|
| **Workflows** | `.github/workflows/deploy-aws.yml` (the pipeline) · `deploy-production.yml` (production trigger) · `ci.yml` (the gate, also run on every PR) |
| **Account / region** | `849076101704` · `ap-south-1` |
| **Written** | 2026-09-27, after the production cutover to AWS |

## The two pipelines

Both run the same jobs, in this order: **guard → ci → build → migrate → deploy → verify**.

| | Staging | Production |
|---|---|---|
| Trigger | push to `staging` | merge to `main` (`deploy-production.yml`; documentation-only merges skipped) · or manual `workflow_dispatch` from `main` |
| GitHub environment | `staging` | **`aws-production`**: branch policy `main` only, required reviewer, admin bypass **off** |
| Approval | none | **required before `build`, again before `migrate`, again before `deploy`** (each job that uses the environment asks) |
| AWS identity (OIDC, no stored keys) | `zugzwang-staging-github-deploy` (trusts `environment:staging`) | `zugzwang-production-github-deploy` (trusts `environment:aws-production`) |
| CDK bootstrap | `CDKToolkit` / `hnb659fds` | `CDKToolkit-prod` / `zzprod` |
| ECR | `zugzwang-staging` | `zugzwang-production` |
| ECS | cluster `zugzwang-staging` | cluster `zugzwang-production` |
| Verified at | `https://staging.zugzwangworld.com` (pinned to the ALB) | `https://zugzwangworld.com` (pinned to the ALB) |

**What each job does**
- `guard`: refuses production from any ref but `main`, and a push unless it is staging-from-`staging` or production-from-`main`.
- `ci`: `ci.yml`, the same gate every PR runs: Biome, `tsc`, `drizzle-kit check`, migrations on a throwaway Postgres, the drift check, all tests.
- `build`: Docker image `<env>-<sha>` and `<env>-<sha>-migrate` pushed to that environment's ECR; build-time values from Doppler (`stg` / `prd`). The build does not need a database (verified 2026-09-27 with the database unreachable).
- `migrate`: refuses destructive migrations (below), then runs the migration image as a one-off ECS task **inside the VPC** and requires exit 0 from the exact image the build pushed.
- `deploy`: `cdk deploy Zugzwang-<env>-Compute -c imageTag=<env>-<sha>`, then waits for the ECS service to be stable.
- `verify`: `/api/health` must report the new canary, `db: ok`, `migrations: ok` and the expected `writesPaused`; `/api/ready` must report `ready: true, failed: 0`.

**Isolation** (IAM simulator, 2026-09-27): the staging role cannot assume any `zzprod` role, push to production ECR, run the production migration task, touch a production stack or read a production secret, and the staging bootstrap deploy role is explicitly denied production stacks. The production role is the mirror image, and P2 explicitly denies the `zzprod` deploy role every staging stack.

## Secrets (GitHub environment secrets; names only)

| Environment | Secret | Value |
|---|---|---|
| `staging` | `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::849076101704:role/zugzwang-staging-github-deploy` (set; staging deploys run) |
| `staging` | `DOPPLER_TOKEN` | Doppler service token, config `stg`, read-only (set) |
| `aws-production` | `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::849076101704:role/zugzwang-production-github-deploy` |
| `aws-production` | `DOPPLER_TOKEN` | Doppler service token, config `prd`, read-only |

No GitHub **variables** are read (PROD-DEPLOY-NO-VARS). Runtime secrets are never in GitHub: ECS injects them from Secrets Manager (`zugzwang/<env>`).

## Database migrations

- Forward-only drizzle migrations, applied by the `migrate` job **before** the new image serves (a failed migration leaves the old version running).
- **Destructive migrations are never applied automatically.** `scripts/aws-migration/check-destructive-migrations.cjs` lists migrations new since the commit the environment is running (its deployed image tag) and fails the run on any `DROP TABLE/SCHEMA`, `DROP COLUMN`, `TRUNCATE`, `DELETE FROM`, column `TYPE` change or `RENAME`. It fails closed when the deployed commit cannot be read.
- To apply one deliberately: take an RDS snapshot first, then `workflow_dispatch` from `main` with `allow_destructive_migrations: true`. Prefer expand/contract so the old and new images both work against the schema in between.
- `skip_migrations: true` only when nothing changed under `drizzle/`, since the check reads the deployed tag, not the database.

## Rollback of one production deployment

The ECS deployment circuit breaker is on (`rollback: true`), so a deploy whose new tasks never turn healthy **rolls itself back** to the previous task definition; the run fails and nothing else is needed.

To roll back a deploy that went healthy but is wrong, **use the pipeline** (OIDC, approval-gated, no stored keys):

1. Find the previous image tag: the last green production run's `build` job prints it, or
   `aws ecr describe-images --region ap-south-1 --repository-name zugzwang-production --query 'sort_by(imageDetails,&imagePushedAt)[].imageTags' --output text`
   (use a `production-<sha>` tag, not a `-migrate` one).
2. GitHub → Actions → **Deploy to AWS** → **Run workflow** from `main`: `environment: production`, `writes: open`, **`rollback_image_tag: production-<previous sha>`**.
3. Approve the `build` and `deploy` jobs. The run skips CI, the image build and migrations; it checks that the tag belongs to production and exists in its ECR, redeploys it through CDK (a new task-definition revision, so CloudFormation stays in step), waits for ECS, and `verify` requires `/api/health` to report that tag. About 5 minutes.
4. **Schema:** migrations are never rolled back. A rollback is safe when the previous image works against the current schema, which expand/contract guarantees.

⚠ Pointing the service back at an older **task-definition revision** does not work here: CDK replaces the task definition on every deploy and deregisters the previous revision, so it is `INACTIVE` and ECS will not run it (checked 2026-09-27: only the current revision is `ACTIVE`). Redeploy the image instead, as above.

**Break-glass** (GitHub unavailable), from `infra/` with operator credentials:
```bash
npx cdk deploy Zugzwang-production-Compute --exclusively --toolkit-stack-name CDKToolkit-prod \
  -c imageTag=production-<previous sha>
```

**Images are kept:** the ECR lifecycle expires only beyond the newest 20 images (about 10 deploys, since each deploy pushes an app and a migrate image). Do not delete the image a rollback may need. The first pipeline-built production image will follow `production-dd81159a`, the image deployed by hand at cutover.

## Branch protection (recommended; the repository is public, so it is available)

Settings → Branches (or Rules): protect `main` and `staging`: require a pull request and the `ci` status check, block force-pushes and deletions. Until then these are conventions only (CLAUDE.md §5.13).
