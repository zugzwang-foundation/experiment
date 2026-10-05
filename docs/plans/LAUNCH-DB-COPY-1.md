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

**None of them touches:** staging's database (it is only read by pg_dump), any secret, DNS, infrastructure, Redis or the deploy pipeline. Pausing writes and deploying code stay **pipeline dispatches the operator performs**, with their approvals.

**Redis needs no tool.** Every cache family expires within 60 s (`SHARED_VIEW_EXPIRE_SEC` 60, `DISCOVERY_PRICE_EXPIRE_SEC` 30, `HEADER_PORTFOLIO_CACHE_TTL_SECONDS` 15), so keeping writes paused for **at least 2 minutes** after the restore expires every stale entry. A key-deleting tool would add risk for no gain.

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
| `market_media` | `key` (`m/<marketId>/…`) | `zugzwang-market-media` | **the same bucket** | Verify present only |

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

// scripts/aws-migration/launch-storage.cjs <staging-dump> [--execute]
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
```

## 5. The runbook (what the operator runs, in order, after approval)

| # | Step | Command / action |
|---|---|---|
| 1 | Freeze staging | Pipeline dispatch: `environment=staging`, `writes=paused` |
| 2 | Verify staging | Browse it; `node launch-dump.cjs staging <stg-ecs> --account=…` (check-only shows the counts) |
| 3a | Snapshot production | `aws rds create-db-snapshot --db-instance-identifier zugzwang-production-database-postgres9dc8bb04-rysnutic4cy5 --db-snapshot-identifier zugzwang-prod-pre-launch-<date>` |
| 3b | pg_dump production + counts | `node launch-dump.cjs prod <prod-ecs> --account=… --execute` → `zugzwang-prod-<ts>.dump` + manifest |
| 4 | Pause production writes | Pipeline dispatch: `environment=production`, `writes=paused`, `rollback_image_tag=<current production tag>` |
| 5 | Dump staging | `node launch-dump.cjs staging <stg-ecs> --account=… --execute` → `zugzwang-staging-<ts>.dump` + manifest |
| 6 | Restore (dry run) | `ZZ_LAUNCH_COPY_ACK=replace-production-with-staging node prod-restore.cjs <prod-ecs> <staging.dump> <sha> --account=… --source=staging --reload-nonempty` |
| 7 | Restore (execute) | The same command + `--execute`. One transaction: TRUNCATE, load, then clear the three session tables |
| 8 | Copy storage (dry run, then execute) | `node launch-storage.cjs <staging.dump>`, then `… --execute` |
| 9 | Let caches expire | Wait ≥ 2 minutes (writes still paused) |
| 10 | Deploy code | PR `staging` → `main`, merge, **reject** the automatic run; dispatch `environment=production`, `writes=paused`; approve |
| 11 | Verify | `node launch-verify.cjs <prod-ecs> <staging-manifest.json> --account=…` + the manual checklist (§6) |
| 12 | Open | Dispatch `environment=production`, `writes=open`, `rollback_image_tag=<new tag>` |
| 13 | Retire | Follow-up PR removes `--source=staging` (the expiry constant is the backstop) |

## 6. Verification

**Automated (`launch-verify.cjs`):**
- every table's **row count and content fingerprint** equal to the staging manifest, except: the 3 cleared tables must be **0**, and the 3 cron tables report drift as a warning;
- journal head equal;
- the invariants hold (§4);
- every referenced storage object is **present in the production bucket with the same size**;
- `/api/health` shows `env: prod`, `db: ok`, `migrations: ok` and the expected `writesPaused`;
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
| Verification fails | `prod-restore.cjs <prod-ecs> zugzwang-prod-<ts>.dump <sha> --account=… --reload-nonempty --execute` (the existing prod-dump mode, unchanged by this PR) |
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
