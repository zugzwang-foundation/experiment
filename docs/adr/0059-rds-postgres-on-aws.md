# ADR-0059 — RDS for PostgreSQL Replaces Supabase as the Database Host

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-09-24 |
| **Deciders** | Hrishikesh (operator) · client (infrastructure owner) · Claude Code (author) |
| **Tracker task** | AWS-MIGRATION-1 (`docs/plans/AWS-MIGRATION-1.md`) |
| **Frame document** | ADR-0006 (Hosting Topology — parent; vendor for the database changes); ADR-0024 (Deploy Pipeline — the two-project split and pooler mode change host); SPEC.2 §6 (migration set / append-only), §21 (Operational Runbook Pointers), §22 (ADR Index); `docs/reports/AWS-MIGRATION-REPORT.html` (the client-facing evaluation this ratifies) |
| **Supersedes** | ADR-0006 (partial — the database vendor only: Supabase → RDS for PostgreSQL in `ap-south-1`; the single-region ruling and every other vendor are unchanged). ADR-0024 (partial — Decision Outcome #1's "two standing Supabase projects" becomes two RDS instances, one per environment, and #8's Supavisor pooler modes no longer describe the estate; the deploy flow, migrate-before-serve, the per-hash `/api/health` drift gate and staging-as-prod-replica are **inherited unchanged**) |
| **Superseded-by** | — |
| **Amends** | — |
| **Amended-by** | — |

---

## Context and Problem Statement

The application is moving from Vercel to a long-lived container on ECS in `ap-south-1` (the CDK under `infra/`, commit `4b3efd7`). The database question was opened by the client, who proposed DynamoDB in place of a relational host. `docs/reports/AWS-MIGRATION-REPORT.html` §06 evaluated that proposal against the code as it is and declined it on five checkable blockers — the nine-table SERIALIZABLE bet transaction under a held row lock, settlement's unbounded atomic fan-out against DynamoDB's 100-item transaction cap, the eleven storage-layer append-only triggers, the relational read models (`LATERAL` joins and `COUNT(DISTINCT) FILTER` aggregates), and the PL/pgSQL scheduler on `pg_cron`. The client accepted that recommendation on 2026-09-24. What remained undecided was *where* PostgreSQL runs once compute is on AWS.

Supabase is a managed Postgres reached over the public internet through the Supavisor pooler. The application has been engineered around that pooler's ceilings — `src/db/index.ts` carries a per-instance pool of **2**, `prepare: false`, and a docblock of measurements about stranded sockets on suspended Vercel instances — none of which applies to a single long-lived process inside a VPC. Keeping Supabase would keep the database outside the network that everything else is moving into, and keep the pooler hop on every query.

This ADR does **not** decide:

- Whether the database engine is PostgreSQL (it is; the report's §06 and the four invariants of SPEC.1 §5 settle that, and this ADR only sites it).
- The cutover procedure — `docs/reports/DATABASE-MIGRATION-PLAN.html` and `AWS-MIGRATION-REPORT.html` §09 own it; SPEC.2 §21 points there.
- RDS Proxy — deferred to the staging rehearsal (report decision D4). Nothing here precludes it.
- The compute topology, the ALB, the scheduler or the alarms (the CDK commit; a future ADR if the client asks for one).
- RLS (ADR-0019, still out of scope).

## Decision Drivers

1. **Zero change to the application's SQL, schema or guarantees.** The eleven Bucket-A triggers, the thirteen event partitions, `uuidv7()`, and the three `pg_cron`-registered PL/pgSQL jobs must arrive intact — a database without them is not the same database (report §09, verification checks 2–5).
2. **`pg_cron` must load.** Migrations 0007, 0011 and 0027 run `CREATE EXTENSION pg_cron` and `cron.schedule(...)`; on RDS the extension loads only if `shared_preload_libraries` names it before boot, and jobs fire only in the database `cron.database_name` names.
3. **No public route to the database.** The report's §08 promise — every firewall rule references a security group, the database has no public IP and no route out — must hold in the CDK, not only in prose.
4. **A deleted or half-written database is the one unrepairable outcome.** Backups must outlive the instance; deletion must be a two-step act in production.
5. **The cutover must stay "one value changed in the vault."** Nothing in compute may depend on the database stack, or a database replacement becomes a compute redeploy.
6. **Dataset size.** 46 MB, ~87,000 rows across 41 `public` relations (measured read-only against production 2026-09-25; the earlier plan's "~12,000 rows, under 1 MB" was stale), for a fixed seven-week window. Sizing is decided by correctness properties, not throughput.

## Considered Options

1. **RDS for PostgreSQL 17, one instance per environment, in isolated subnets of the application VPC** ← chosen
2. Keep Supabase; only compute moves
3. Aurora PostgreSQL
4. DynamoDB (evaluated in the report; recorded here so the index carries the rejection)

## Decision Outcome

**Chosen: Option 1 — RDS for PostgreSQL 17 in the application VPC.**

1. **One RDS instance per environment**, `Zugzwang-<env>-Database` (`infra/lib/database-stack.ts`), PostgreSQL **17**, in **`PRIVATE_ISOLATED`** subnets that the network stack now creates **unconditionally** — staging has no NAT and still gets subnets with no internet route. *[minted]*
2. **Ingress to the database is one rule:** TCP 5432 from the service security group, by group reference. No CIDR rule, no outbound rule, `publiclyAccessible: false`. *[minted — consumes report §08]*
3. **A custom parameter group** carries `shared_preload_libraries = pg_stat_statements,pg_cron` and `cron.database_name = zugzwang`; the database is named `zugzwang`. The two are one constant in code because they must agree or jobs register and never fire. *[minted]*
4. **Credentials are generated by RDS** into a Secrets Manager secret (`zugzwang/<env>/database`), never configured. The application keeps reading `DATABASE_URL` from the app secret (`zugzwang/<env>`), which the operator composes from the stack outputs at cutover. **Compute does not reference the database stack.** *[minted]*
5. **Durability posture:** gp3, encrypted, storage autoscaling; automated backups that **outlive the instance** (`deleteAutomatedBackups: false`), `RemovalPolicy.SNAPSHOT`; production is **Multi-AZ**, **7-day** retention, **deletion protection on**; staging is single-AZ, 1 day, no protection — it is a resettable sandbox (ADR-0035). *[minted]*
6. **Pooler mode is retired as a concept on this host.** `DB_POOLER_MODE` stays `session` in the task definition because `src/db/index.ts` still reads it and `prepare: false` is harmless on a direct connection; whether an RDS Proxy is placed in front is decided under rehearsal and, if it is, this ADR gains a Patch record rather than a successor. *[shapes ADR-0024 #8]*
7. **The migration guards need no code change.** `scripts/migrate-{staging,prod}.ts` require `DATABASE_URL_*` to contain an operator-set `*_PROJECT_REF_FRAGMENT`; on RDS the fragment becomes a substring of the RDS endpoint, set in Doppler at cutover. The earlier plan's "rewrite the guards" becomes a runbook line. *[consumes ADR-0022]*
8. **Sizing:** production `db.t4g.small`, staging `db.t4g.micro`. Performance Insights is **off** — unsupported on these classes, and leaving it on fails the deploy. *[minted]*

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| The RDS instance, parameter group, credentials secret, outputs | `infra/lib/database-stack.ts` |
| Isolated DB subnets and the database security group | `infra/lib/network-stack.ts` |
| Per-environment sizing, Multi-AZ, retention, deletion protection | `infra/config/{staging,production}.ts` → `database` |
| The database name ≡ `cron.database_name` | `infra/lib/database-stack.ts` → `DATABASE_NAME` |

## Consequences

### Positive

- The database moves inside the network everything else is moving into; the pooler hop and the public-internet leg leave every query.
- Every storage-layer guarantee travels: same engine, same migrations, same triggers, same `pg_cron` jobs — the report's nine-check gate runs unchanged.
- The cutover stays a change of address. Compute never learns the database's identity except through the app secret.
- A `cdk destroy` cannot lose data: final snapshot, and automated backups that survive the instance.
- The parameter group turns the one silent `pg_cron` failure mode (wrong `cron.database_name`) into a constant that cannot drift from the database name.

### Negative

- **Two databases to keep in step during the watching week.** Supabase stays alive read-only as the rollback; a write reaching it is unrepairable. *Mitigated by:* writes stop before the dump and resume only after the nine checks pass (report §09).
- **`pg_cron` registrations do not travel with a dump.** *Mitigated by:* a named cutover step, verification check 5, and the cron-silence CloudWatch alarm.
- **`pg_restore --disable-triggers` can leave the append-only guards off.** *Mitigated by:* verification check 3 is behavioural — a `DELETE` on `bets` must be *rejected* — and runs as the application role (report §09).
- **`src/db/index.ts` still carries Supavisor-era pool settings (`max: 2`).** Correct but conservative on a direct connection. *Acceptable because:* raising it is a measurement-first change (ADR-0038 decision 2) and belongs to the rehearsal, not to this ADR.
- **Staging is single-AZ.** *Acceptable because:* it is rebuilt from fixtures, not restored.

### Neutral

- The Supabase project identifiers named in ADR-0024 #1 become history once each environment cuts over; the ADR is left in place as the record of the estate it described.
- `docs/runbooks/deploy-pipeline.md` §3 and SPEC.2 §21 continue to point at the migrate-before-serve flow; the host name inside it changes, the sequence does not.

## Pros and Cons of the Options

### Option 1 — RDS for PostgreSQL 17 in the VPC (chosen)

**Pros**

- Same engine and extensions; zero application change.
- Private subnet, group-referenced ingress, no public IP.
- Managed backups, PITR, Multi-AZ, patching.

**Cons**

- A parameter group must be right before the first migration runs (driver 2).
- A second database to babysit for the watching week.

### Option 2 — Keep Supabase

**Pros**

- No database work in the migration at all.

**Cons**

- Keeps the pooler ceilings the app was engineered around, and the public-internet leg on every query.
- Leaves the one stateful component outside the VPC that holds everything else.

**Verdict:** Rejected. It would make the migration smaller by leaving its main latency and connection-limit cause in place.

### Option 3 — Aurora PostgreSQL

**Pros**

- PostgreSQL-compatible; `pg_cron` supported; fast clones and read replicas.

**Cons**

- Its strengths — storage to 128 TB, reader fleets — address problems a 46 MB, single-writer database does not have, at the cost of more moving parts.

**Verdict:** Rejected. Not wrong; not needed. Revisit if the dataset or read fan-out ever grows into it.

### Option 4 — DynamoDB

**Pros**

- No servers, no connection pool, effectively unlimited scale.

**Cons**

- 100-item transaction cap against unbounded atomic settlement; no locks against a read-modify-write on the pool; no triggers against eleven append-only tables; no joins or aggregates against six of fifteen read patterns; no `pg_cron`.

**Verdict:** Rejected in `docs/reports/AWS-MIGRATION-REPORT.html` §06 and accepted by the client. Recorded here so the ADR index carries it.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.1 §5 INV-1…INV-4 | the four invariants | **Consumes.** All four are enforced by the schema and triggers that travel unchanged; this ADR moves the host and touches none of them. |
| SPEC.2 §6 | append-only triggers, migration set | **Consumes.** The same committed migration set is applied to RDS by the existing per-migration-transaction applier; verification checks 2–4 prove the guards and partitions arrived. |
| ADR-0006 | hosting topology | **Shapes.** Database vendor Supabase → RDS; region `ap-south-1` and every other vendor unchanged. |
| ADR-0022 | prod migrate applier + ref-fragment guard | **Consumes.** Unchanged; the fragment value moves to the RDS endpoint. |
| ADR-0024 #1, #8 | two Supabase projects; pooler mode | **Supersedes (partial).** Two RDS instances; pooler modes no longer describe the host. #2–#7, #9 inherited. |
| ADR-0035 | staging is a resettable sandbox | **Consumes.** Justifies staging's single-AZ / 1-day posture. |
| ADR-0038 decision 2 | size from measurement, never estimate | **Consumes.** Pool settings are left alone until the rehearsal measures them. |
| Migrations 0007, 0011, 0027 | `pg_cron` registrations | **Consumes.** Require the parameter group in Decision Outcome #3. |
| Tracker | AWS-MIGRATION-1, -2 (staging deploy), -3 (rehearsal), -4 (production) | All depend on this ADR being `accepted`. |

## More Information

- `docs/reports/AWS-MIGRATION-REPORT.html` — the client-facing evaluation, §06 (DynamoDB) and §09 (how the database moves).
- `docs/reports/DATABASE-MIGRATION-PLAN.html` — the cutover runbook.
- `docs/plans/AWS-MIGRATION-1.md` — this phase's plan and verification list.
- AWS RDS for PostgreSQL — `pg_cron` requires `shared_preload_libraries` in a custom parameter group and runs in the database named by `cron.database_name`.

---

*ADR-0059 ratifies RDS for PostgreSQL 17 in the application VPC as the database host for the Experiment, replacing Supabase: one instance per environment in isolated subnets, ingress from the service security group only, a parameter group that preloads `pg_cron` for the named database, generated credentials the application never references directly, and a durability posture in which backups outlive the instance. It partially supersedes ADR-0006 (vendor) and ADR-0024 (#1 two Supabase projects, #8 pooler mode) and inherits everything else in both. The primitives in §Decision Outcome are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
