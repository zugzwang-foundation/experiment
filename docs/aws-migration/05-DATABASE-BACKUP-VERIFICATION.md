# 05 — Production Database Backup Verification

| | |
|---|---|
| **Status** | Backup taken, inspected, **restored into staging RDS and verified row-for-row** (2026-09-24 20:19–20:23 UTC). Production untouched throughout. |
| **Backup taken (UTC)** | 2026-09-24 18:49:51 → 18:50:01 (10.7 s) |
| **Approved by** | Operator, in session ("approve backup"), after the 8-point pre-flight passed in check-only mode |
| **Source** | Supabase production project, via the Supavisor **session pooler** `aws-1-ap-south-1.pooler.supabase.com:5432`, database `postgres`, role `postgres.<project-ref>` (credentials from Doppler `prd` → `DATABASE_URL_PROD`; never printed, never written to the repository) |
| **PostgreSQL version** | Server **17.6** (aarch64) · client `pg_dump` **17.11** (`postgres:17-alpine` Docker image) |
| **Method** | `pg_dump --format=custom --no-owner --no-acl --verbose --schema=public --schema=drizzle --lock-wait-timeout=30000` — single repeatable-read snapshot; `ACCESS SHARE` locks only |
| **Backup file** | `C:\Users\Lenovo\zugzwang-backups\prod\zugzwang-prod-2026-09-24T18-49-51Z.dump` — **outside the git repository**, not committed, not uploaded anywhere |
| **Size** | **3,763,725 bytes (3.59 MB)** — from a 46 MB (48,409,747-byte) database; custom format is gzip-compressed |
| **SHA-256** | `FB41A75646D34A45EE23FB8B7921051710AA20DD29534E96A4701E32C33CEE30` (sidecar: `…dump.sha256`) |
| **pg_dump exit code** | **0** |
| **pg_restore --list** | **exit 0** · 392 TOC entries · header: `Format: CUSTOM · Compression: gzip · Dump Version: 1.16-0 · Dumped from database version: 17.6` (saved as `…dump.toc`) |
| **Warnings / errors** | **None.** 93-line verbose log scanned for `warn|error|fatal|fail|permission|denied` — zero matches (saved as `…dump.pg_dump.log`) |

## 1. Pre-flight — 8 / 8 PASS, re-verified immediately before `pg_dump`

| # | Check | Result |
|---|---|---|
| 1 | Resolved host = expected production Supabase session pooler `aws-1-ap-south-1.pooler.supabase.com:5432` | PASS |
| 2 | `PROD_PROJECT_REF_FRAGMENT` set, contained in `DATABASE_URL_PROD`, and the role name ends with the ref (the same guard `scripts/migrate-prod.ts` applies) | PASS |
| 3 | Database = `postgres` | PASS |
| 4 | Server is PostgreSQL 17.x — live read-only `SELECT current_setting('server_version')` → `17.6` | PASS |
| 5 | Database size — `pg_database_size()` → 46 MB | PASS |
| 6 | Backup path is `C:\Users\Lenovo\zugzwang-backups\prod`, exists, local (not UNC), not inside any git work tree | PASS |
| 7 | Target file name (UTC-timestamped) does not already exist | PASS |
| 8 | Command is `pg_dump` only — static argv scanned for `pg_restore`, `psql`, `migrate`, `DROP`, `ALTER`, `TRUNCATE`, `DELETE`, `UPDATE`, `INSERT`, `VACUUM`, `--command`, `$`, `;` — none | PASS |

Secrets handling: `PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSWORD` were written by the pre-flight script to a `%TEMP%` env file (mode 0600), passed to Docker with `--env-file`, and deleted on exit — confirmed absent afterwards. Any URL-shaped string in `pg_dump` output is masked before display or saving.

## 2. Archive contents (`pg_restore --list` census) — reconciled against the live catalog

| Object type | In archive | Live catalog (read-only discovery) | Reconciliation |
|---|---|---|---|
| **Schemas** | **2** — `public`, `drizzle` | `public`, `drizzle` (+ Supabase-managed `auth/storage/realtime/vault/graphql/extensions/cron`, deliberately excluded) | ✅ |
| **Tables** | **42** (41 `public` + 1 `drizzle.__drizzle_migrations`) + 13 `TABLE ATTACH` (the `events` partitions re-attached to their parent) | 41 relations in `public`, 13 `events` partitions | ✅ |
| **Table data** | **41** `TABLE DATA` sections (one per `public` table; the partitioned parent carries no rows of its own) | 41 tables dumped in the verbose log | ✅ |
| **Indexes** | **87** `INDEX` + **26** `INDEX ATTACH` = 113, plus the PK/UNIQUE indexes carried as `CONSTRAINT` entries | 133 in `pg_indexes` | ✅ (133 = 113 + PK/UNIQUE constraints, which `pg_dump` emits as constraints) |
| **Sequences** | **4** `SEQUENCE` + 4 `SEQUENCE SET` (current values) + 3 `SEQUENCE OWNED BY` | 4 in `pg_sequences` (`public` + `drizzle`) | ✅ |
| **Constraints** | **47** `CONSTRAINT` (PK, UNIQUE, CHECK — incl. `dharma_ledger_balance_non_negative`, `positions_quantity_non_negative`, the seven `lots` CHECKs) | — | ✅ |
| **Foreign keys** | **35** `FK CONSTRAINT` | 35 in `pg_constraint` where `contype = 'f'` | ✅ exact |
| **Triggers** | **56** `TRIGGER` | 82 in `pg_trigger` (non-internal) | ✅ (82 = 56 + 26 inherited copies on the 13 `events` partitions, which `pg_dump` does not duplicate — Postgres re-propagates them on attach) |
| **Functions** | **13** `FUNCTION` (incl. `uuidv7()`, `enforce_bucket_a_no_update/no_delete`, the Bucket-B functions, `zz_add_liquidity`, `run_liquidity_injection`, `check_liquidity_alarms`, the drift routine) | 13 in `pg_proc` for `public` | ✅ exact |
| **Types** | **9** `TYPE` (the pgEnums: `side`, `market_status`, `dharma_entry_type`, `mod_reason`, …) | — | ✅ |
| **Defaults** | 3 `DEFAULT` · 1 `COMMENT` | — | ✅ |
| **Extensions** | **0** — *expected*: a schema-scoped dump never emits `CREATE EXTENSION` | `pg_cron 1.6.4`, `pg_stat_statements`, `pgcrypto`, `uuid-ossp`, `plpgsql`, `supabase_vault` | ⚠ see §4 |
| **`pg_cron` job registrations** | **0** — *expected*: they live in the `cron` schema, which is Supabase/pg_cron-owned and not restorable | 4 jobs: `liquidity-injector`, `liquidity-alarms`, `identity-pool-watermark`, `nightly-drift` | ⚠ see §4 |

## 3. Production integrity — confirmed

- **Production was not modified.** The only statements issued to production in this task were read-only `SELECT`s on `pg_catalog` / `pg_stat` (discovery + pre-flight) and `pg_dump`'s own reads (`SELECT`, `COPY … TO STDOUT` inside one `REPEATABLE READ` transaction). No `INSERT/UPDATE/DELETE/ALTER/DROP/TRUNCATE/VACUUM`, no migration.
- **No restore or migration was performed against production.** `pg_restore` ran only in `--list` mode against the local archive file; it opened no database connection.
- **No production configuration, DNS, Cloudflare, secret or infrastructure was changed.** Supabase production is untouched and remains the live database.
- **The backup was not deleted, committed or uploaded.**

## 4. Known gaps in a schema-scoped archive (by design — not defects)

| Gap | Why | How the target gets it |
|---|---|---|
| No `CREATE EXTENSION` | `--schema` dumps never carry extension DDL | `pg_cron` from the RDS parameter group + migration `0007`; `pgcrypto`/`uuid-ossp` are available on RDS and created by the migrations if referenced |
| No `cron.schedule()` registrations | They live in the `cron` schema | Re-registered by migrations `0007`/`0011`/`0027` when applied to RDS, **or** by hand — and verified by check 5 of the cutover gate (jobs registered *and firing*) |
| Supabase `auth`/`storage`/`vault` schemas | Not used by the application (Better Auth lives in `public`; files on R2; RLS out of scope) | Not needed on RDS |

## 5. Restore procedure — STAGING RDS ONLY (never production)

Preconditions: the staging RDS exists (Phase 2 staging deploy), the 32 migrations have been applied to it by the migration task (so triggers, partitions, extensions and `pg_cron` jobs exist), and a network path exists (SSM port-forward through the ECS instance, or a one-off ECS task in the VPC — the DB has no public route by design).

```bash
# 1. Verify the checksum before trusting the file
Get-FileHash "C:\Users\Lenovo\zugzwang-backups\prod\zugzwang-prod-2026-09-24T18-49-51Z.dump" -Algorithm SHA256
#    must equal FB41A75646D34A45EE23FB8B7921051710AA20DD29534E96A4701E32C33CEE30

# 2. Target guard — refuse anything that is not the staging RDS
#    PGHOST must match  *.ap-south-1.rds.amazonaws.com  AND contain "staging"
#    PGHOST must NOT contain  supabase  or  production

# 3. Restore DATA ONLY into the migrated schema (the schema, triggers and partitions
#    already come from the migrations, so the archive's DDL is not replayed)
docker run --rm --env-file <STAGING_ENV_FILE> \
  -v "C:\Users\Lenovo\zugzwang-backups\prod:/backup" postgres:17-alpine \
  pg_restore --data-only --disable-triggers --no-owner --no-acl \
             --schema=public --schema=drizzle --verbose --exit-on-error \
             --dbname=zugzwang "/backup/zugzwang-prod-2026-09-24T18-49-51Z.dump"
#    ⚠ --disable-triggers needs table ownership on RDS; run as the role that ran the
#    migrations. Afterwards, check 3 below is BEHAVIOURAL for exactly this reason.

# 4. Validation (all must pass before staging is declared restored)
#    a. row counts per table == the source counts recorded at dump time
#    b. SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal  → 82 (56 + 26 partition copies)
#    c. a test DELETE FROM bets … is REJECTED ("append-only violation")  ← proves triggers are ARMED
#    d. 13 events partitions present; 35 FKs; 13 functions; 4 sequences with correct current values
#    e. SELECT extname FROM pg_extension → pg_cron present; SELECT jobname FROM cron.job → 4 jobs
#    f. Σ dharma_ledger balances and Σ positions.quantity match the source
#    g. pnpm test:invariants (13 specs) against staging RDS
#    h. the app's critical reads: Discovery, one market page, one profile — served from staging RDS
```

## 6. Remaining risks

- **The archive has not yet been restored anywhere.** Until §5 runs on staging, "the backup is valid" rests on `pg_restore --list` and the census above — necessary, not sufficient.
- **A fresh backup is mandatory before the final cutover.** This archive is a rehearsal artefact; production keeps accepting writes. The final sequence is: FINAL BACKUP → VERIFY → PAUSE WRITES → FINAL DATA MIGRATION → VALIDATE RDS → START/VERIFY APP → SWITCH TRAFFIC → MONITOR → KEEP ORIGINAL BACKUP.
- **`--disable-triggers` on restore can leave the append-only guards off** if re-enabling is not verified — §5 check (c) is behavioural for that reason.
- **The dataset figure in earlier documents was wrong** ("~12,000 rows, under 1 MB"); corrected to 46 MB / ~87,000 rows in the report, ADR-0059 and the plan on 2026-09-25. The DynamoDB verdict is unaffected.

## 8. Staging restore — performed and verified (2026-09-24, UTC 20:19–20:23)

**Target:** `zugzwang-staging-database-postgres9dc8bb04-69fo9sqgtcvo.cpiuei4au2fa.ap-south-1.rds.amazonaws.com` (PostgreSQL 17.6, staging only — the runner refuses any host that is not a `*staging*.ap-south-1.rds.amazonaws.com` endpoint). **Path:** SSM port-forward through the staging ECS instance; no public route to the database was created.

**Procedure actually run** (approved in session; pre-flight re-verified 6/6 immediately before):

1. `UPDATE cron.job SET active = false` — the 4 `pg_cron` jobs paused
2. `ALTER TABLE … DISABLE TRIGGER USER` on every `public`/`drizzle` table → `TRUNCATE … CASCADE` (29 tables; only migration seed rows and 29 cron heartbeat rows existed) → `ENABLE TRIGGER USER`
3. `pg_restore --data-only --no-owner --no-acl --exit-on-error --schema=public --schema=drizzle` with **`session_replication_role = replica` on the restore connection** — exit 0, 42.7 s, 46 log lines, zero errors or warnings
4. `UPDATE cron.job SET active = true`

### 8.1 Two RDS facts that changed §5 — read before the production cutover

| What §5 said | What is true on RDS | What the runner does instead |
|---|---|---|
| `pg_restore --disable-triggers` | **Impossible.** It emits `ALTER TABLE … DISABLE TRIGGER ALL`, which also covers the system FK triggers, and only a true superuser may touch those — `rds_superuser` gets `permission denied: "RI_ConstraintTrigger_…" is a system trigger`. Measured on the first execute attempt (nothing was truncated; cron was paused and later resumed). | `DISABLE TRIGGER USER` for the truncate (our append-only / Bucket-B / TRUNCATE guards are user triggers), and **no** `--disable-triggers` on the restore |
| Load order handled by `pg_restore` | **Not for this schema.** The `comments ↔ bets` FK cycle makes `pg_dump` abandon dependency ordering; the archive's data section is **alphabetical** (`bet_receipts` before `bets` before `comments` …), so FK checks would reject the load at once. | `PGOPTIONS=-c session_replication_role=replica` on the restore connection, which suspends FK checking for the load. RDS grants this to `rds_superuser` (pre-flight check 6 proves it before anything runs). The archive is one consistent snapshot from a database whose FKs were enforced, so integrity is preserved; the post-restore checks below confirm it. |

No user trigger fires on INSERT/COPY (they guard UPDATE, DELETE and TRUNCATE), so nothing about the append-only contract is bypassed by the load, and every trigger is re-enabled afterwards — verified, not assumed (§8.3).

### 8.2 Row counts — staging vs the archive itself (exact), 2026-09-24

| Table | In archive (`pg_restore --data-only --table` row count) | In staging after restore | Match |
|---|---|---|---|
| `bets` · `comments` · `lots` · `bet_receipts` | **3168** each | 3168 each | ✅ exact — and mutually equal, which is INV-1 |
| `dharma_ledger` | 4412 | 4412 | ✅ |
| `positions` | 1134 | 1134 | ✅ |
| `users` | 621 | 621 | ✅ |
| `markets` / `pools` | 6 / 6 | 6 / 6 | ✅ |
| `identity_pool` | 19904 | 19904 | ✅ |
| `events_2026_09` | 10074 | 10074 | ✅ |

⚠ §2's "approx live rows" column (from `pg_stat` at discovery) read 3173 for the four bet tables; the archive holds 3168. That column was an estimate and is superseded by this table.

### 8.3 Validation (21 checks, all pass against the archive)

| Area | Checks | Result |
|---|---|---|
| Schema | 41 relations in `public` · 13 `events` partitions · 82 user triggers (56 + 26 partition copies) · **all triggers ENABLED after the restore** · 13 functions · 35 FKs · 133 indexes · 4 sequences | ✅ |
| Extensions | `pg_cron@1.6` installed (from the parameter group + migration 0007 via the target-preparation step) | ✅ |
| Cron | 4 jobs registered **and active**: `identity-pool-watermark`, `liquidity-alarms`, `liquidity-injector`, `nightly-drift` · has executed (`cron.job_run_details` last run 20:22 UTC) · `cron.database_name = zugzwang` | ✅ |
| Journal | 32 migrations in `drizzle.__drizzle_migrations`; `/api/health` reports `migrations: ok` (per-hash) | ✅ |
| Data | row counts exact (§8.2) · `system_state.frozen_at` preserved (`null`) · INV-2 no negative `balance_after` · I-LOT-SUM Σ `surviving_shares` = `positions.quantity` · I-GENESIS every Open market has `market.opened` · `dharma_ledger.seq` sequence ≥ max row | ✅ |
| **Behavioural** | a `DELETE` on `bets` → **rejected** `append-only violation on table public.bets: DELETE not permitted` · an `UPDATE` on `dharma_ledger` → **rejected** | ✅ armed, not merely present |
| Application | `/api/health` `db: ok, migrations: ok, canary staging-4b3efd7` · Discovery lists the 6 markets · `/m/bitcoin-price-50k` renders with prices and chart · `/u/MagentaSwan000` profile 200 · `.md` export 200 · quote route 401 without a session (correct) | ✅ |

**Result: the backup is proven restorable.** The production archive `zugzwang-prod-2026-09-24T18-49-51Z.dump` (SHA `FB41A756…`) restores cleanly into a migrated PostgreSQL 17.6 target with every row, constraint, trigger, function, partition, sequence and cron registration intact.

## 7. Files (all outside the repository, none committed)

```
C:\Users\Lenovo\zugzwang-backups\prod\
  zugzwang-prod-2026-09-24T18-49-51Z.dump              3,763,725 B   the archive
  zugzwang-prod-2026-09-24T18-49-51Z.dump.sha256                     checksum sidecar
  zugzwang-prod-2026-09-24T18-49-51Z.dump.toc                        pg_restore --list output (392 entries)
  zugzwang-prod-2026-09-24T18-49-51Z.dump.pg_dump.log                verbose pg_dump log, URLs masked
```
