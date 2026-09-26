# AWS migration operational runners (AWS-MIGRATION-2)

Operator tools used for the staging rehearsal and required again for the production
cutover. **None of them contains a credential**: every secret is read at run time from
Doppler (`doppler run --config <stg|prd> -- node …`) or AWS Secrets Manager, handed to a
Docker `postgres:17-alpine` client through a mode-0600 env file in `%TEMP%` that is
deleted on exit, and never printed. Each runner has a pre-flight that must pass before
it writes anything, and an `--execute` (or `--deep`) flag that is off by default.

⚠ Written for the operator's Windows machine: they hard-code the AWS CLI path, the
Session Manager plugin path and the backup directory `C:\Users\Lenovo\zugzwang-backups`.
Move those to arguments before anyone else runs them.

| Runner | What it does | Writes to |
|---|---|---|
| `prod-backup.cjs` | 8-point pre-flight, then `pg_dump --format=custom` of production `public` + `drizzle` | the local backup directory only |
| `staging-secret.cjs` | composes `zugzwang/staging` in Secrets Manager from Doppler `stg`, with `DATABASE_URL` → staging RDS (`sslmode=require`) | Secrets Manager (staging) |
| `staging-restore.cjs` | 6-point pre-flight (incl. the replica-role permission), then pause cron → truncate → `pg_restore --data-only` with `session_replication_role=replica` → resume cron, through an SSM tunnel | staging RDS |
| `staging-verify.cjs` | 21 read-only checks: schema, extensions, cron, journal, row counts vs the archive, invariants, and a *behavioural* append-only test | nothing (one rolled-back DELETE) |
| `staging-bet-check.cjs` | read-only: count deltas and the full write spine of the newest bet; `--deep` adds events, ledger chain, onboarding | nothing |
| `integration-probe.js` | runs inside a one-off ECS task: Upstash, OpenAI, R2, Sentry, Resend with the injected staging credentials | nothing |

Findings these encode (all measured, see `docs/aws-migration/05-*.md` §8.1 and `06-*.md` §4):
RDS forbids `--disable-triggers` (system FK triggers), the schema-scoped archive's data
is alphabetical, `rds_superuser` may set `session_replication_role`, and `ALTER … DISABLE
TRIGGER USER` is the truncate-time form.
