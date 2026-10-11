# PROD-LAUNCH-DB-COPY: make production a copy of verified staging (initial launch only)

| | |
|---|---|
| Status | **INVESTIGATION + PLAN ONLY.** Nothing has been executed. Every command below is shown for review, not run. |
| Investigated | 2026-10-05, read-only, against AWS account 849076101704 (ap-south-1) and `origin/main` / `origin/staging` |
| Approval | Execution needs a separate, explicit approval per stage |

---

## 0. Read this first: three things that change the plan

1. **⚠ Is production's data really dummy? Unverified.** At the 27 Sep cutover, production was loaded from the **real Supabase production database** (621 users, 3,170 bets, 70,627 rows, compared with 0 differences), and real sign-ups happened afterwards (one was observed on 27 Sep at 17:26 IST). This investigation did **not** query production. **Before any approval, the operator must confirm that nothing in production needs keeping.** §3 Stage 0 gives a read-only check for this.
2. **Copying only the database breaks post images.** Staging and production use **different** uploads buckets, and the staging images exist only in the staging bucket (§5). Those objects must be copied too.
3. **Staging must not carry test or seeded data into production.** The seeding tool created synthetic participants (`…@seed.staging.invalid`) and placeholder posts on staging. If staging is copied as it is, those become production users and posts. Stage 1 must remove them.

---

## A. CURRENT ARCHITECTURE

### A.1 The two databases (measured with `aws rds describe-db-instances`)

| | Staging | Production |
|---|---|---|
| RDS instance | `zugzwang-staging-database-postgres9dc8bb04-69fo9sqgtcvo` | `zugzwang-production-database-postgres9dc8bb04-rysnutic4cy5` |
| Endpoint | `…69fo9sqgtcvo.cpiuei4au2fa.ap-south-1.rds.amazonaws.com:5432` | `…rysnutic4cy5.cpiuei4au2fa.ap-south-1.rds.amazonaws.com:5432` |
| Database name / master user | `zugzwang` / `zugzwang` | `zugzwang` / `zugzwang` |
| Engine / class | PostgreSQL 17.6, db.t4g.micro, Single-AZ | PostgreSQL 17.6, db.t4g.small, **Multi-AZ** |
| Backups / deletion protection | 1 day / **off** | 7 days PITR / **on** |
| VPC | `vpc-0602c7b3c1ddc94e7` (10.20.0.0/16) | `vpc-0e55abbc8518fef0b` (10.10.0.0/16) |
| Security group | `sg-00a016b34d9e9f722` | `sg-0f2282d61f8ef4b40` |
| Credentials secret | `zugzwang/staging/database` | `zugzwang/production/database` |
| App secret (contains `DATABASE_URL`) | `zugzwang/staging` → staging host | `zugzwang/production` → production host |
| CDK stack | `Zugzwang-staging-Database` | `Zugzwang-production-Database` |
| Public access | none (private subnets; SSM port-forward via the ECS host) | none (same) |

**Completely separate:** different instances, VPCs, security groups, credentials and secrets. There is no replication, link or copy job between them. (Both use the account's default RDS KMS key, which does not connect them.)

### A.2 How the schema is managed

| Piece | What |
|---|---|
| Tool | **drizzle-kit**, migrations in `drizzle/migrations/` (head `0031_comments_friendly_fire` on **both** `main` and `staging`) |
| Commands | `pnpm db:migrate:prod` (`scripts/migrate-prod.ts`), `pnpm db:migrate:staging` |
| In the pipeline | `deploy-aws.yml` → `migrate` job runs the image's migrate target as a one-off ECS task inside the VPC, after `check-destructive-migrations.cjs` refuses DROP/TRUNCATE/DELETE/RENAME/TYPE changes unless `allow_destructive_migrations=true` |
| Production trigger | `deploy-production.yml`: merge to `main` → pipeline with `writes: open`, and **3 approvals** (`aws-production` reviewer) |
| Data tooling (operator-run, check-only by default) | `scripts/aws-migration/prod-backup.cjs` (pg_dump; **hard-wired to the old Supabase host**), `prod-restore.cjs` (one-transaction TRUNCATE + data-only load into production; **only accepts `zugzwang-prod-*.dump` files**), `staging-restore.cjs`, `staging-verify.cjs` (21 read-only checks) |
| Write-pause | `ZUGZWANG_WRITES_PAUSED=paused` (`src/proxy.ts`) returns 503 for bets, uploads, auth writes, Server Actions, `/admin`, **and `/api/cron/*`**, while reads continue |

### A.3 External resources (from the two app secrets; credentials compared, never printed)

| Resource | Staging | Production | Same? |
|---|---|---|---|
| **Uploads bucket** (post images) | `zugzwang-staging-uploads` (27 objects) | `zugzwang-uploads` (232 objects) | **Different, no objects in common** |
| **PFP bucket** (avatars) | `zugzwang-staging-pfp` (3,237 objects) | `zugzwang-pfp` (1,079 objects) | Different. All 1,079 production files also exist in staging; staging has 2,158 more (older `v1-pre-pfp2/…` sets) |
| PFP public URL | `pub-…r2.dev` | `pfp.zugzwangworld.com` | Different |
| **Market-media bucket** | `zugzwang-market-media` | `zugzwang-market-media` | **Same bucket** (46 objects each) |
| Auth URL | `https://staging.zugzwangworld.com` | `https://zugzwangworld.com` | Different |
| `BETTER_AUTH_SECRET` | | | **Different** |
| Google OAuth client | same client ID and secret | | **Same** (a Google account maps to the same `accounts.account_id` in both) |
| `ADMIN_PASSWORD`, cron secrets, Turnstile, Sentry DSN | | | Different |
| Upstash Redis | same instance and token | | **Same**; keys are separated by an env prefix (`staging:` / `prod:`) |
| OpenAI, Resend, PostHog | | | Same |
| **Payments (Stripe etc.)** | none | none | **No payment system exists** in the code |

---

## What a full staging dump would carry (answers question 7)

`pg_dump --format=custom --schema=public --schema=drizzle` (the tooling's form) copies **every application table**:

`users, accounts, sessions, verifications, admin_sessions, identity_pool, markets, pools, market_media, comments, bets, bet_receipts, positions, lots, dharma_ledger, events (+ partitions), resolution_events, payout_events, mod_actions, admin_events, user_events, image_uploads, bookmarks, system_state, liquidity_policy, liquidity_heartbeat, watermark_state, cron_alarms`, plus the `drizzle` migration journal and sequence values.

| You asked about | Carried? |
|---|---|
| users, markets, posts/comments, bets | **Yes** (posts are rows in `comments`; replies too) |
| subscriptions | **Does not exist** in this project |
| image_uploads | **Rows yes; image files NO** (see §5) |
| Not carried | the `cron` schema (production keeps its own pg_cron jobs, which is correct), and anything in R2 or Redis |

---

## B. WHAT WILL HAPPEN TO PRODUCTION'S CURRENT DATA

- **In the live database:** every application table is emptied and refilled with staging's rows, inside **one transaction** (`prod-restore.cjs` design). After commit, today's production rows are **no longer in the live database**.
- **They are not destroyed:** Stage 3 takes a **manual RDS snapshot** and a **pg_dump** first, and the 7-day point-in-time restore window also still holds the old state.
- **Production's 232 uploaded images** stay in `zugzwang-uploads` but are no longer referenced by any row. They can be deleted later or kept; nothing breaks.
- **Production's pg_cron jobs, users' Redis keys and secrets** are unaffected by the data swap.

---

## C. RECOMMENDED INITIAL LAUNCH MIGRATION

### Options compared

| | A. pg_dump + restore into the existing production instance (**recommended**) | B. RDS snapshot of staging → restore as a new instance | C. Existing project scripts as they are |
|---|---|---|---|
| Keeps the production instance, endpoint, Multi-AZ, backups, deletion protection, CDK ownership | **Yes** | **No.** A snapshot restores only into a **new** instance: new endpoint, staging's master password, outside the CDK stack (drift), must be re-pointed and re-secured | Yes |
| Atomic, with automatic rollback on failure | **Yes**: TRUNCATE + load in one transaction | n/a | Yes |
| Proven here | Yes: the same mechanism moved 70,627 rows at cutover with 0 differences | No | Yes |
| Works today without change | **No**: needs a staging-source dump runner and a restore that accepts a staging dump (see §D) | Yes, with large follow-up work | **No**: `prod-backup.cjs` targets Supabase; `prod-restore.cjs` only accepts `zugzwang-prod-*.dump` |

**Recommendation: A, implemented as a small, reviewed extension of the project's own tooling (C).** That means a `staging-dump.cjs` (a copy of `prod-backup.cjs` pointed at the staging RDS) and a `--source=staging` mode on `prod-restore.cjs`, each with tests, behind the same check-only default, pre-flights and account guard. B is rejected because it replaces the production instance itself.

### The stages

**Stage 0: decide (read-only).**
- Confirm production holds nothing that must survive (§0.1). Read-only counts of users, bets and comments created after 2026-09-27, through the existing tunnel.
- Confirm the launch data list: which markets, and whether any users or posts should exist at launch.

**Stage 1: clean and prepare staging.**
1. `pnpm staging:reset` (guarded TRUNCATE of staging, which refuses while content markets exist unless acknowledged; ADR-0035), then `pnpm run db:seed:staging` refills the identity pool.
2. Recreate the launch markets through the engine: `scripts/seed-content-markets.ts --env staging --create`, then `--open --price … --tank …`, then `--media` (their market-media objects are in the **shared** bucket, so they will resolve in production).
3. Add **only** launch data. **No** seeding-tool test data and **no** test accounts, unless intended for launch.
4. Run `pnpm staging:gates` and `staging-verify.cjs` (read-only).

**Stage 2: verify staging.**
- Browse every market.
- Make sure no `@seed.staging.invalid` users exist (unless intended), and that `system_state.frozen_at` is NULL.
- List the R2 objects staging rows reference: `image_uploads.r2_object_key`, and `users.pfp_filename` and `identity_pool.pfp_filename` against the production PFP bucket.
- **Freeze staging** (no writes) from here to Stage 4. The dump must equal what was verified.

**Stage 3: back up production (nothing changed yet).**
1. Manual RDS snapshot `zugzwang-prod-pre-launch-<date>` (fast; the full instance).
2. pg_dump of production `public` + `drizzle` to the backup directory, with its sha256.
3. Record the row counts per table, for the comparison.

**Stage 4: replace production's data with staging's.**
1. **Pause production writes:** redeploy the current image with `writes=paused` (pipeline dispatch with `rollback_image_tag=production-7314ab4`, so nothing is rebuilt). This also stops the cron calls.
2. Dump staging (`staging-dump.cjs --execute`), with its sha256.
3. Restore into production (`prod-restore.cjs --source=staging … --reload-nonempty --execute`). The tool pauses pg_cron, runs TRUNCATE + load in **one transaction**, then resumes pg_cron. Any failure rolls back fully.
4. **Clean up after the restore, inside the same transaction or immediately after:** `DELETE FROM sessions; DELETE FROM verifications; DELETE FROM admin_sessions;`
   - **Why:** an admin cookie is just a session ID checked by a database lookup, so staging's admin sessions would otherwise become **valid production admin sessions**.
   - Participant sessions would fail anyway (a different `BETTER_AUTH_SECRET`), but they're cleared for hygiene.
5. **Copy R2 objects:**
   - every `image_uploads.r2_object_key` from `zugzwang-staging-uploads` to `zugzwang-uploads` (same keys);
   - any staging-referenced PFP file missing from `zugzwang-pfp`.

   This is copy-only and never deletes.
6. Clear production's cached views in Redis (`prod:cache:*`), or keep writes paused for at least 2 minutes so the 15–60 s windows expire.

**Stage 5: deploy the production application.**
1. PR `staging` → `main` and merge it. **Reject** the automatic production run: it deploys with `writes: open`.
2. Dispatch **Deploy to AWS** from `main`: `environment=production`, **`writes=paused`**, then approve build, migrate (a no-op: same head, `0031`) and deploy.

**Stage 6: verify production.**
1. `/api/health` shows the new canary, `db: ok`, `migrations: ok` and `writesPaused: true`.
2. Compare row counts, production against the staging dump (every table equal).
3. Browse every market; images and avatars load; admin login works with the **production** password; there are no seed-test users.
4. Run the invariant checks read-only (the `staging-verify.cjs` style checks, pointed at production).
5. **Open writes:** dispatch with `rollback_image_tag=<the new production tag>`, `writes=open`. Then a test sign-up and a small bet.

---

## D. EXACT COMMANDS THAT WOULD BE USED LATER (shown, NOT executed)

> `<…>` are placeholders. Items marked **NEW** need a small reviewed code change first; they do not exist today.

```bash
# ── Stage 0 (read-only) ────────────────────────────────────────────────────
#   Through the existing SSM tunnel, as a read-only session:
#   SELECT count(*) FROM users WHERE created_at > '2026-09-27';
#   SELECT count(*) FROM bets  WHERE created_at > '2026-09-27';

# ── Stage 1 (STAGING only) ─────────────────────────────────────────────────
pnpm staging:reset            # guarded TRUNCATE of STAGING; refuses on content markets unless acknowledged
pnpm exec tsx scripts/seed-content-markets.ts --env staging --create
pnpm exec tsx scripts/seed-content-markets.ts --env staging --open --price <p> --tank <T>
pnpm exec tsx scripts/seed-content-markets.ts --env staging --media
pnpm staging:gates

# ── Stage 3: production backups ────────────────────────────────────────────
aws rds create-db-snapshot --region ap-south-1 \
  --db-instance-identifier zugzwang-production-database-postgres9dc8bb04-rysnutic4cy5 \
  --db-snapshot-identifier zugzwang-prod-pre-launch-<yyyymmdd>
aws rds wait db-snapshot-available --region ap-south-1 --db-snapshot-identifier zugzwang-prod-pre-launch-<yyyymmdd>
node scripts/aws-migration/prod-rds-backup.cjs <instance-id> --execute     # NEW: prod-backup.cjs pointed at the production RDS

# ── Stage 4: replace data ──────────────────────────────────────────────────
#   4.1 pause writes: GitHub → Actions → Deploy to AWS → Run workflow (from main)
#       environment=production, writes=paused, rollback_image_tag=production-7314ab4
node scripts/aws-migration/staging-dump.cjs <staging-instance-id> --execute    # NEW (copy of prod-backup.cjs, staging source)
node scripts/aws-migration/prod-restore.cjs <prod-ecs-instance-id> zugzwang-staging-<ts>.dump <sha256> \
  --account=849076101704 --source=staging --reload-nonempty                    # CHECK-ONLY first (NEW flag --source)
node scripts/aws-migration/prod-restore.cjs <prod-ecs-instance-id> zugzwang-staging-<ts>.dump <sha256> \
  --account=849076101704 --source=staging --reload-nonempty --execute          # the actual replacement
#   post-restore SQL (in the same transaction, or immediately after):
#   DELETE FROM sessions; DELETE FROM verifications; DELETE FROM admin_sessions;
#   R2 copy, staging → production, COPY ONLY (e.g. rclone copy with an explicit key list):
rclone copy r2:zugzwang-staging-uploads r2:zugzwang-uploads --files-from <keys-referenced-by-staging.txt> --immutable

# ── Stage 5: deploy ────────────────────────────────────────────────────────
#   PR staging → main, merge, REJECT the automatic production run, then dispatch:
#   environment=production, writes=paused  → approve build, migrate, deploy

# ── Stage 6: open writes after verification ────────────────────────────────
#   dispatch: environment=production, writes=open, rollback_image_tag=production-<new sha>
```

### Every command or code path that can destroy or overwrite data (question 10)

| Command / path | What it does | Guard today |
|---|---|---|
| `prod-restore.cjs … --execute` | **TRUNCATE every production table + load a dump** | Check-only by default; refuses a non-production host; refuses a non-empty target unless `--reload-nonempty`; `--account` must match; one transaction |
| `staging-restore.cjs … --execute` | TRUNCATE + load into **staging** | Staging host guard |
| `pnpm staging:reset` / `staging:rebuild` (`tests/staging/reset.staging.test.ts`) | TRUNCATE **staging** tables | Five-guard contract incl. intent token `ZUGZWANG_STAGING_RESET_ACK`, refuses content markets unless acknowledged |
| `scripts/lots-1-staging-wipe.ts` | Deletes `lots` rows on **staging** | Staging-only script |
| `just db-reset` → `supabase db reset` | Resets a **local** Supabase database | Local only; Supabase CLI |
| drizzle migrations `0017` (DROP COLUMN), `0018` (DROP TABLE) | Already applied history | `check-destructive-migrations.cjs` blocks new ones unless `allow_destructive_migrations=true` |
| Pipeline input `allow_destructive_migrations=true` | Lets a destructive migration run | Manual dispatch + 3 approvals |
| `aws rds delete-db-instance` / `restore-db-instance-*` / `cdk destroy` | Delete or replace an instance | Production deletion protection on; production exec policy (P1) and deny policies |
| `pg_restore --clean` / `dropdb` (not used by any project tool) | Drop objects or the database | Not in the repo; never use |
| `src/server/storage/sweep-orphans.ts` (cron every 6 h) | Deletes **unattached** upload objects from `zugzwang-uploads` | Only uploads with no attaching comment past the TTL. ⚠ Relevant: copied staging images whose rows are restored correctly are attached, so they are safe |
| `deleteObject()` in `src/server/storage/r2.ts` | Deletes one R2 object | Called only by the sweep |

---

## E. ROLLBACK PLAN

| Failure point | What happens | Action |
|---|---|---|
| Restore fails mid-load | The **single transaction rolls back**; production is exactly as before | Fix the cause; re-run. Writes are still paused. |
| Restore committed, but verification fails (Stage 6) | Production holds staging's data | **Data rollback:** `prod-restore.cjs` with the Stage 3 **production pg_dump** (`--reload-nonempty`): one transaction, same tool, minutes. Then clear sessions as in Stage 4. |
| The pg_dump is unusable | | **Point-in-time restore** (7 days) or the **manual snapshot** to a **new** instance, then re-point `zugzwang/production` with `prod-secret.cjs` and redeploy. Slower; causes CDK drift to fix afterwards. |
| The new code is wrong (Stage 5) | | Pipeline rollback: `rollback_image_tag=production-7314ab4` (the image live today). |
| Copied R2 objects | Copy-only, nothing deleted | Leave them; they're harmless if the data is rolled back. |

Writes stay **paused** until Stage 6 passes, so no new real data can be written into a state that might be rolled back.

---

## F. POST-LAUNCH SAFE DEPLOYMENT PROCESS

After launch, **production data is the source of truth, and data only ever flows from users into production.**

1. **Code goes up; data never does.** `staging` → `main` → the production pipeline (3 approvals). Only migrations change production's database, and they are expand/contract, with destructive ones blocked by default.
2. **Retire the copy path the day launch completes:**
   - remove `--source=staging` and the staging-dump runner, or make `prod-restore.cjs` refuse whenever any `users` row is newer than the launch date;
   - remove `--reload-nonempty`.
3. **Branch protection on `main`** (the repo is public, so rulesets are free): a PR plus the `ci` check, no force-push.
4. **Seeding stays staging-only** (two runtime variables, and production's task definition carries no flag).
5. **Production backups:** keep 7-day PITR, and take a manual snapshot before any release that contains a migration.
6. **Staging after launch** is a rehearsal environment with its own data: reset it freely. It never feeds production again.

---

## What happens to staging after the migration (question 13)

**Nothing.** The dump is a read-only `pg_dump`. Staging keeps its data and keeps working; from then on it diverges from production, and can be reset or reseeded at will without any effect on production.

---

## Uncertainties (stated, not guessed)

1. **Whether production's current data is disposable** (§0.1). It came from real Supabase production data at cutover. This decides everything.
2. Whether every `users.pfp_filename` / `identity_pool.pfp_filename` in staging exists in `zugzwang-pfp`. Staging has 2,158 extra PFP files, so a read-only check is needed in Stage 2.
3. Whether the `events` partitions are identical in both databases (both built by the same migrations, but a data-only load fails if a row's partition is missing; the restore pre-flight should check).
4. The two runners (`staging-dump.cjs`, `--source=staging`) **do not exist yet.** They are small, but they are code changes on a production write path and need review before use.
5. Whether staging should carry **any** users into launch. If not, Stage 1 should leave only markets (plus the identity pool), and the launch begins with zero participants.
