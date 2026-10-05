# ADR-0065 — One-Time Launch Data Copy (Staging → Production)

| | |
|---|---|
| **Status** | proposed |
| **Date** | 2026-10-05 |
| **Deciders** | Hrishikesh (operator) |
| **Tracker task** | LAUNCH-DB-COPY-1 (`docs/plans/LAUNCH-DB-COPY-1.md`; investigation `docs/plans/PROD-LAUNCH-DB-COPY.md`) |
| **Frame document** | ADR-0024 (deploy pipeline, migrate-before-serve), ADR-0035 (guarded staging reset) |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | — |
| **Amended-by** | — |

---

## Context and Problem Statement

For the initial public launch the operator has ruled that **staging is the source of truth**: production must start as a copy of the verified staging database (users, accounts, markets, posts, bets and every other application table), with every referenced storage object present, and production's current data (disposable) backed up first. After launch the opposite rule holds for good: production data is real and nothing from staging may ever overwrite it.

The two environments share an AWS account but nothing else that matters here: separate RDS instances and VPCs, **different uploads and PFP buckets** (with no objects in common), a shared market-media bucket, different auth secrets, and one Upstash instance separated only by key prefix. An admin cookie is a bare session id checked by a database lookup.

## Decision Drivers

- Production's instance, endpoint, Multi-AZ, backups and CDK ownership must survive the copy.
- The replacement must be all-or-nothing.
- No restored row may point at a missing object.
- Staging's sessions — above all `admin_sessions` — must not become production sessions.
- The capability must be impossible to use by accident, and must stop existing after launch.

## Considered Options

1. **Logical dump of staging, data-only restore into the existing production instance, one transaction** (chosen).
2. RDS snapshot of staging restored as a new production instance.
3. Re-seeding production with markets only.

## Decision Outcome

**Option 1**, implemented as five operator-run tools beside the existing `prod-restore.cjs`, each check-only by default:

| Tool | Writes to |
|---|---|
| `launch-dump.cjs <prod\|staging>` | a local file: pg_dump + a manifest of per-table row count and order-independent content fingerprint, refused if the source changed during the dump |
| `prod-restore.cjs --source=staging` | production: TRUNCATE + load + `DELETE FROM sessions / verifications / admin_sessions` + null the OAuth tokens in `accounts`, **one transaction** |
| `launch-storage.cjs` | production buckets: copy-only (`IfNoneMatch: "*"`), keys read from the staging dump |
| `launch-cache.cjs` | production Redis: SCAN + DEL of `prod:cache:*`, `prod:cache-metric:*`, `prod:idem:*` only |
| `launch-cron.cjs` | `cron.job.active` only: pauses an environment's active pg_cron jobs (recording them) and resumes exactly those |
| `launch-verify.cjs` | nothing (read-only session) |

**Guards on the launch mode:** `--source=staging` accepts only a `zugzwang-staging-<stamp>.dump` whose manifest names the staging RDS and matches the SHA-256; requires `ZZ_LAUNCH_COPY_ACK=replace-production-with-staging`; refuses after **`LAUNCH_COPY_EXPIRES_AT` = 2026-10-25T23:59:59Z**; and still passes every existing check (production target, account, migration-head equality, `--reload-nonempty` for a non-empty target). The guards sit **after** the source branch, so the prod-dump rollback path never needs the acknowledgement and never expires. The same acknowledgement and expiry gate `--execute` on `launch-storage`, `launch-cache` and `launch-cron pause`.

**Sessions are cleared unless proven.** On the prod-dump path the session tables and tokens are kept only when the dump's manifest proves it came from the production RDS with that SHA-256; an archive without one is treated as possibly staging's. A needless clear costs a re-login; a wrong keep would be a production admin session.

**Identity pool:** copied with the data, not rebuilt. Each copied user's pseudonym came from that pool, and its `assigned_at` marks are what keep a new sign-up from receiving a taken pseudonym. `launch-storage.cjs` copies the PFP file of every pool row; `launch-verify.cjs` reports unassigned headroom and checks for duplicate pseudonyms.

**pg_cron:** it runs inside the database, so a write pause does not stop it. Staging's jobs are paused around the dump (the liquidity injector would otherwise move `pools` mid-dump). The restore leaves production's jobs paused after a launch load and records them; they are resumed only after writes are open, because the copied `liquidity_policy` is staging's and its injector is enabled.

**Writes and deploys stay pipeline actions** (dispatch with `writes=paused`, three approvals for production).

## Consequences

### Positive

- One reviewed path, with automatic rollback on any load failure, a fingerprint-level comparison instead of row counts, and no broken images.
- Staging's admin sessions cannot survive into production.
- The capability is time-boxed and slated for removal.

### Negative

- New production-writing code that must be removed after launch (follow-up PR; the expiry is the backstop).
- When production's pg_cron jobs resume, the liquidity injector runs on **staging's** policy. Changing that before launch is an operator decision.
- Production's own uploaded objects remain in the bucket, unreferenced, until cleaned up separately.

### Neutral

- `prod-backup.cjs` (Supabase-specific, cutover-era) is untouched; `launch-dump.cjs prod` is the RDS-era backup.

## Pros and Cons of the Options

### Option 1 — dump + one-transaction restore (chosen)

- Good: keeps the production instance and everything configured on it; proven by the 27 Sep cutover (70,627 rows, 0 differences).
- Bad: needs the tooling in this ADR.

### Option 2 — snapshot restored as a new instance

- Bad: a new endpoint, staging's master password, outside the CDK stack (drift), secrets to repoint. Rejected.

### Option 3 — markets only

- Bad: not what the operator asked for; loses staging's users and activity. Rejected by the operator.
