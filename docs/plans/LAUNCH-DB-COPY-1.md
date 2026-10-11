# LAUNCH-DB-COPY-1: one-time copy of verified staging into production

| | |
|---|---|
| Status | **PLAN + TOOLING PR.** Building the tools executes nothing. Running them needs a separate, explicit approval. |
| Background investigation | `docs/plans/PROD-LAUNCH-DB-COPY.md` (architecture, buckets, every destructive command) |
| Operator ruling (2026-10-05) | Staging is the source of truth for the initial launch; production's current data is disposable, but must still be backed up (snapshot + pg_dump + row counts) |
| Critical path | Production data writes. Full ritual: tests first, `@code-reviewer`, `@security-auditor`, same-commit ADR (**ADR-0065**; re-read the ceiling before minting), pre-PR self-audit |
| Base | `origin/staging` @ `0c9b678d`. Staging was reset to six empty markets at 10/90 on 2026-10-04 (#640). |

## 1. What the tools do (and do not do)

| Tool | Writes to | Default |
|---|---|---|
| `launch-dump.cjs` | **A local file only.** pg_dump of staging or production + a manifest (row count and content fingerprint per table) | Check-only |
| `prod-restore.cjs --source=staging` (extends the existing tool) | **Production database**: one transaction of TRUNCATE + load + clear the three session tables | Check-only |
| `launch-storage.cjs` | **Production R2 buckets: copy-only.** Never deletes, never overwrites | Check-only |
| `launch-verify.cjs` | Nothing (read-only database, R2 HEAD and HTTP GET) | Read-only |
| `launch-cache.cjs` | **Production Redis**: deletes only keys under `prod:cache:`, `prod:cache-metric:` and `prod:idem:`, while writes are paused | Check-only |

**None of them touches:** staging's database (it is only read by pg_dump), any secret, DNS, infrastructure or the deploy pipeline. Only `launch-cache.cjs` touches Redis, and only the three production key families above. Pausing writes and deploying code stay **pipeline dispatches the operator performs**, with their approvals.

**Redis (operator ruling 2026-10-05: clear it).** Every cache family expires within 60 s anyway, but the operator chose an explicit clear. `launch-cache.cjs` SCANs and deletes **only** `prod:cache:*` (shared views, header portfolio), `prod:cache-metric:*` and `prod:idem:*` (idempotency entries, keyed `prod:idem:<userId>:<key>`, so stale ones belong to users who no longer exist). It never deletes `staging:*`, rate limits, cron locks or the visitor counter, and it never uses FLUSHDB, FLUSHALL or KEYS. The Upstash instance is **shared with staging**, which is exactly why it is an allowlist and not a flush.

**Identity pool.** `identity_pool` is **copied with the dump**, not rebuilt. Each copied user's pseudonym was drawn from that exact pool, and the pool's `assigned_at` marks are what stop a new sign-up from receiving a pseudonym a copied user already holds (`users.pseudonym` is UNIQUE). Rebuilding or reseeding the pool after the copy would hand out duplicates and break sign-ups. What the tools add: `launch-storage.cjs` copies the PFP file for **every** pool row (assigned or not), so post-launch sign-ups get real avatars; and `launch-verify.cjs` reports the unassigned headroom and checks for duplicate pseudonyms.

## 2. Tables copied

Everything in `public` + `drizzle`, data only (the schema already exists in production at the same migration head, `0031`):

`users, accounts, sessions*, verifications*, admin_sessions*, identity_pool, markets, pools, market_media, comments, bets, bet_receipts, positions, lots, dharma_ledger, events (+ partitions), resolution_events, payout_events, mod_actions, admin_events, user_events, image_uploads, bookmarks, system_state, liquidity_policy, liquidity_heartbeat†, watermark_state†, cron_alarms†, drizzle.__drizzle_migrations`

- `*` **Cleared inside the same transaction** after the load. Staging's sessions must not become production sessions: an admin cookie is a bare session ID checked only by a database lookup.
- `†` Written by pg_cron every few minutes, so verification compares their counts but tolerates content drift (reported, not failed).
- **Not copied:** the `cron` schema (production keeps its own jobs), Redis, secrets.

## 3. Storage objects copied (derived from the staging DUMP, not from a live query)

| Referenced by | Column | Source bucket (staging) | Target bucket (production) | Action |
|---|---|---|---|---|
| `image_uploads` | `r2_object_key` (`u/<userId>/<id>.<ext>`) | `zugzwang-staging-uploads` | `zugzwang-uploads` | Copy if missing in the target |
| `users`, `identity_pool` | `pfp_filename` (the key is the file name) | `zugzwang-staging-pfp` | `zugzwang-pfp` | Copy if missing in the target |
| `market_media` | `r2_object_key` (`m/<marketId>/…`) | `zugzwang-market-media` | **the same bucket** | Verify present only |

Rules: same key in the target; content type preserved; a conditional put (`If-None-Match: *`) so nothing existing is ever overwritten; an object present in the target with the **same size** counts as done; a referenced key **missing from the source** is a failure listed by row.

## 4. Module contract (tests are written against this first)

```js
// scripts/aws-migration/lib/launch-common.cjs — pure helpers, no I/O at require time
REGION = "ap-south-1"; DB_NAME = "zugzwang";
ENVS = { staging: { secret: "zugzwang/staging" }, prod: { secret: "zugzwang/production" } };
assertEnvTarget(env, databaseUrl)        // throws unless the host is that env's RDS: prod → contains "production",
                                         // not "staging"/"supabase"; staging → contains "staging", not "production";
                                         // the path must be "/zugzwang"; returns the URL
dumpFileName(env, date)                  // "zugzwang-<prod|staging>-<YYYY-MM-DDTHH-MM-SSZ>.dump"
parseDumpFileName(base)                  // → { env, stamp } or null
redact(text)                             // removes any postgres:// URL

// scripts/aws-migration/lib/fingerprint.cjs — pure
TABLE_LIST_SQL                           // public+drizzle base tables, events_% partitions excluded (counted via the parent)
countAndFingerprintSql(qualifiedTable)   // one statement → "count|md5" where the md5 is over the rows' text
                                         // form ordered by that text, i.e. independent of physical order
CLEARED_TABLES = ["public.sessions","public.verifications","public.admin_sessions"]
VOLATILE_TABLES = ["public.liquidity_heartbeat","public.watermark_state","public.cron_alarms"]
compareManifests(expected, actual)       // → { pass, rows: [{ table, status: "match"|"mismatch"|"cleared-ok"|
                                         //   "cleared-not-empty"|"volatile"|"missing"|"extra", expected, actual }] }
                                         // pass iff no mismatch/missing/extra/cleared-not-empty

// scripts/aws-migration/launch-dump.cjs <prod|staging> <ecs-instance-id> --account=<12> [--execute]
parseArgs(argv); assertArgs(args)        // env ∈ {prod,staging}; instance "i-…"; account 12 digits
dumpCommand(base)                        // ["pg_dump","--format=custom","--no-owner","--no-acl",
                                         //  "--schema=public","--schema=drizzle","-f","/backup/<base>"]
stableVerdict(before, after)             // the manifest taken before and after pg_dump must be equal
                                         // (VOLATILE_TABLES excepted); unequal → refuse (the source was written mid-dump)

// scripts/aws-migration/prod-restore.cjs — EXTENDED, existing behaviour unchanged for prod dumps
parseArgs → + source: "prod" (default) | "staging" (from --source=staging)
assertArgs: source=staging requires a zugzwang-staging-<stamp>.dump AND
            process.env.ZZ_LAUNCH_COPY_ACK === "replace-production-with-staging"
            AND now <= LAUNCH_COPY_EXPIRES_AT (constant "2026-10-25T23:59:59Z"; after it the mode refuses)
postSql(source)                          // staging → "DELETE FROM public.sessions; DELETE FROM public.verifications;
                                         //   DELETE FROM public.admin_sessions;"   prod → ""
loadCommand(dumpBase)                    // UNCHANGED shape plus: psql … -c "$ZZ_PRE_SQL" -f /tmp/data.sql -c "$ZZ_POST_SQL"
                                         // inside the same --single-transaction

// scripts/aws-migration/launch-storage.cjs <staging-dump> --account=<12> [--execute]
extractCopyRows(sqlText, table)          // parse a pg_restore COPY block → array of {column: value}; \N → null
referencedObjects({ imageUploads, users, identityPool, marketMedia })
                                         // → { uploads: [keys], pfp: [filenames], marketMedia: [keys] },
                                         //   de-duplicated, sorted, nulls dropped
assertSafeKey(key)                       // rejects "..", leading "/", backslashes, empty
copyDecision({ inTarget, targetSize, inSource, sourceSize })
                                         // → "skip-present" | "copy" | "fail-missing-in-source" | "fail-size-conflict"

// scripts/aws-migration/launch-verify.cjs <prod-ecs-instance-id> <staging-manifest.json> --account=<12>
INVARIANT_SQL                            // each returns 0 when the invariant holds: negative balance_after,
                                         // negative positions, two held sides, lot sum ≠ position,
                                         // an Open market without a market.opened event, frozen_at not null
httpChecks(baseUrl, slugs)               // → list of {url, expect} for /api/health, /api/ready, /, /m/<slug>…
IDENTITY_POOL_SQL                        // read-only: unassigned headroom (assigned_at IS NULL)
// INVARIANT_SQL also includes: duplicate users.pseudonym = 0, system_state row count ≠ 1,
//   no liquidity_policy row
// Both sessions (dump and verify) pin timezone, datestyle, intervalstyle,
//   extra_float_digits and bytea_output, and the fingerprint orders by collate "C",
//   so a row renders to the same text on both instances.

// scripts/aws-migration/launch-cron.cjs <pause|resume> <prod|staging> <ecs> <state.json> --account=<12> [--execute]
// pause:  records the active job ids in <state.json> (refuses if it exists), then deactivates them
// resume: re-activates exactly the ids in <state.json>
// prod-restore.cjs --source=staging leaves production's jobs paused and writes <dump>.cron-jobs.json

// scripts/aws-migration/launch-cache.cjs --account=<12> [--execute]
SECRET = "zugzwang/production"
CLEAR_PATTERNS = ["prod:cache:*", "prod:cache-metric:*", "prod:idem:*"]
isClearableKey(key)                      // true ONLY for those three prefixes
assertProductionRedisConfig(secretJson)  // Upstash URL and token present
// SCAN + DEL only; never FLUSHDB / FLUSHALL / KEYS
```

## 5. The runbook (what the operator runs, in order, after approval)

All tools live in `scripts/aws-migration/`, run from the repo root, and are check-only unless `--execute` is given. Every launch WRITE (the restore's `--source=staging`, `launch-storage`, `launch-cache`, `launch-cron pause`) refuses without `ZZ_LAUNCH_COPY_ACK=replace-production-with-staging` and after 2026-10-25T23:59:59Z, so set it once in the shell for the session: `export ZZ_LAUNCH_COPY_ACK=replace-production-with-staging`. `launch-cron resume` is not gated: re-enabling jobs is the safe direction. `<acct>` is `849076101704`; `<stg-ecs>` / `<prod-ecs>` are the SSM targets the existing restore runbook uses. Expected total: **about 45–90 minutes** with writes paused, most of it the code deploy (step 12).

| # | Step | Command / action | Time |
|---|---|---|---|
| 0 | **Journals match** (before anything is paused) | `node scripts/aws-migration/launch-dump.cjs prod <prod-ecs> --account=<acct>` and `… staging <stg-ecs> --account=<acct>` — both check-only; the `migration journal N` figures must be equal. If not, stop: production's schema is promoted first, through the pipeline. | 2 min |
| 1 | Freeze staging | Pipeline dispatch `environment=staging`, `writes=paused`; then `node scripts/aws-migration/launch-cron.cjs pause staging <stg-ecs> ~/zugzwang-backups/launch/staging-cron.json --account=<acct>` (check), then `… --execute`. pg_cron runs inside the database, so the write pause alone does not stop the liquidity injector. | 5 min |
| 2 | Verify staging | Browse it; re-run the staging check-only census twice a minute apart — the counts must not move | 5 min |
| 3a | Snapshot production | `aws rds create-db-snapshot --db-instance-identifier zugzwang-production-database-postgres9dc8bb04-rysnutic4cy5 --db-snapshot-identifier zugzwang-prod-pre-launch-<yyyymmdd>`; wait for `available` | 5–15 min |
| 3b | pg_dump production + manifest | `node scripts/aws-migration/launch-dump.cjs prod <prod-ecs> --account=<acct> --execute` → `zugzwang-prod-<ts>.dump` + `.sha256` + `.manifest.json` | 2 min |
| 4 | Pause production writes | Pipeline dispatch `environment=production`, `writes=paused`, `rollback_image_tag=<current production tag>` | 10 min |
| 5 | Dump staging | `node scripts/aws-migration/launch-dump.cjs staging <stg-ecs> --account=<acct> --execute` → `zugzwang-staging-<ts>.dump` + manifest | 2 min |
| 6 | Restore (dry run) | `ZZ_LAUNCH_COPY_ACK=replace-production-with-staging node scripts/aws-migration/prod-restore.cjs <prod-ecs> <staging.dump> <sha> --account=<acct> --source=staging --reload-nonempty` | 2 min |
| 7 | Restore (execute) | The same command + `--execute`. One transaction: TRUNCATE, load, clear the three session tables. **Production's pg_cron jobs stay paused** and their ids are written to `<staging.dump>.cron-jobs.json`. | 2–5 min |
| 8 | Copy storage | `node scripts/aws-migration/launch-storage.cjs <staging.dump> --account=<acct>`, then `… --execute` → `<staging.dump>.storage.json` | 2–10 min |
| 9 | Clear production cache | `node scripts/aws-migration/launch-cache.cjs --account=<acct>` (lists counts per family), then `… --execute` | 1 min |
| 10 | Resume staging cron | `node scripts/aws-migration/launch-cron.cjs resume staging <stg-ecs> ~/zugzwang-backups/launch/staging-cron.json --account=<acct> --execute`; staging writes may reopen | 1 min |
| 11 | — | (reserved) | |
| 12 | Deploy code | PR `staging` → `main`, merge, **reject** the automatic run; dispatch `environment=production`, `writes=paused`; approve | 20–40 min |
| 13 | Verify | `node scripts/aws-migration/launch-verify.cjs <prod-ecs> <staging.manifest.json> --account=<acct>` + the manual checklist (§6) | 10 min |
| 14 | Open | Dispatch `environment=production`, `writes=open`, `rollback_image_tag=<new tag>` | 10 min |
| 15 | Resume production cron | `node scripts/aws-migration/launch-cron.cjs resume prod <prod-ecs> <staging.dump>.cron-jobs.json --account=<acct>` (check), then `… --execute` | 1 min |
| 16 | Retire | Follow-up PR removes `--source=staging` (the expiry constant is the backstop) | |

⚠ **Step 15 turns production's liquidity injector on with STAGING's policy**, because `liquidity_policy` is copied with the data and staging's row is `enabled = true`. From that minute it adds liquidity to production's open pools on staging's schedule and coefficients. If that is not wanted at launch, the policy is changed before step 15 — a new `liquidity_policy` row (the table is append-only), through whatever path the operator uses for policy today. **This is an operator decision, not one this tool makes.**

## 6. Verification

**Automated (`launch-verify.cjs`):**
- every table's **row count and content fingerprint** equal to the staging manifest, except: the 3 cleared tables must be **0**, and the 3 cron tables report drift as a warning;
- journal head equal;
- the invariants hold (§4), including exactly one `system_state` row, at least one `liquidity_policy` row, **no disabled trigger** in `public`/`drizzle` (the catalog proof that the append-only guards came back), no bet whose comment is missing, no OAuth token left in `accounts`, and the ledger identity at or above every copied `seq`;
- `public.accounts` matches on row COUNT only, because its token columns were nulled by design;
- the storage report says the copy was **executed**, not only checked;
- every storage object that **production's restored rows** reference is present in the production bucket — the key list is read from the database, not from the storage tool's report (the copy step already refused size conflicts, and refused any table whose parsed rows differ from the manifest's count);
- `/api/health` shows `env: prod`, `db: ok`, `migrations: ok` and `writesPaused: true` (verification runs before writes open);
- `/`, `/api/ready` and every market page return 200.

**Manual (with writes open on a test account, then reverted if needed):**
1. Google sign-in.
2. Email OTP sign-in.
3. Admin login with the **production** password.
4. Each market page.
5. A post, a reply, an image upload.
6. A bet and a sell.
7. Profile, portfolio, export.

## 7. Rollback

| Failure | Action |
|---|---|
| Restore fails | Automatic: the transaction rolls back; production unchanged |
| Verification fails | `prod-restore.cjs <prod-ecs> zugzwang-prod-<ts>.dump <sha> --account=… --reload-nonempty --execute` (the existing prod-dump mode, unchanged by this PR), then `launch-cron.cjs resume prod <prod-ecs> <staging.dump>.cron-jobs.json --account=<acct> --execute` — the jobs were left paused by the launch load, so the rollback restore finds none active to re-arm |
| The dump is unusable | Restore the snapshot or PITR into a new instance; re-point the secret; redeploy |
| Code is bad | Pipeline `rollback_image_tag=<previous production tag>` |
| Copied R2 objects | Left in place: copy-only, harmless |

## 8. Tests (written first by `@test-writer`)

`tests/unit/scripts/launch-common.test.ts`, `fingerprint.test.ts`, `launch-dump.test.ts`, `launch-storage.test.ts`, `launch-verify.test.ts`, plus additions to `prod-restore.test.ts` for `--source=staging`:
- the acknowledgement and expiry guards;
- the post-SQL inside the one transaction;
- prod-dump mode unchanged;
- refusing a staging dump without the flag, and the flag without a staging dump.

## 9. Retirement (after launch)

- **On launch day:** a follow-up PR deletes `--source=staging`, `postSql` and `launch-dump.cjs staging` mode.
- **Backstops until then:** `LAUNCH_COPY_EXPIRES_AT`, the acknowledgement variable, and check-only defaults.
- **The prod-dump restore mode stays,** as the rollback and disaster-recovery path.
