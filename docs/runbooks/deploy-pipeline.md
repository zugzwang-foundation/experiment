# Deploy Pipeline Runbook

> **Governed by [ADR-0024](../adr/0024-deploy-pipeline-migration-sequencing.md)** (staging-as-prod-replica; built around ADR-0022's prod-apply primitives). This runbook is the *operational how*; ADR-0024 is the *decided what*. On any conflict, the ADR wins — fix this file, don't fork the decision.
>
> **Scope.** Two standing Supabase projects, one committed Drizzle migration set, no Supabase branching. Staging is a **resettable git-auto-deploy sandbox**; Production is **strictly migrate-before-serve** behind a single deliberate human gate. This runbook sits **beside** `staging-provisioning.md` (which covers one-time per-environment provisioning); it does **not** replace it.
>
> **Sibling docs.** `staging-provisioning.md` = per-env Doppler/Vercel/Supabase/Sentry provisioning. `BREAK_GLASS.md` = the conclusion-freeze recovery path. This file = the steady-state deploy/promote pipeline.

---

## 0. Topology at a glance

| Environment | Git trigger | DB | Vercel domain | Migrate path |
|---|---|---|---|---|
| **Preview** | any feature branch | **staging** Supabase | per-deploy `*.vercel.app` | none (schema correctness via CI's ephemeral Postgres) |
| **Staging** | push to **`staging`** branch | **staging** Supabase (`rwfdoqzsghqhhdapxafg`) | `staging.zugzwangworld.com` | **auto** — `staging-migrate.yml` (GHA) on push to `staging` |
| **Production** | merge to **`main`** | **production** Supabase (`zbvprdcyxhlguxbostdj`) | `zugzwangworld.com` | **manual gate** — `db:migrate:prod` then promote (see §3, finalized at D5) |

Both DBs run the **same committed** `drizzle/migrations/` set (head currently `0018`). Migrations **never** run in the Vercel `buildCommand` — `buildCommand` stays plain `next build`.

---

## 1. The `/api/health` verification surface

Every environment exposes `GET /api/health` (`src/app/api/health/route.ts`, public, uncached, Node runtime). It is the **authoritative** deploy/migrate signal — curl it; do not trust migrate exit codes (drizzle-orm #5769).

```json
{ "status": "ok", "env": "staging", "canary": "<git-commit-sha>", "db": "ok", "migrations": "ok" }
```

- **`env`** — `ZUGZWANG_ENV` (`prod` / `staging` / `preview`). Proves *which environment config* the deployment booted with.
- **`canary`** — `VERCEL_GIT_COMMIT_SHA`, the **bare commit SHA** the deployment is serving (ADR-0024 item 7). This is how you confirm "which SHA is live". *(It is the bare SHA — **not** a `staging-…`/`preview-…` prefixed string. Any tooling that asserts a prefix is stale; see §4.)*
- **`db`** — `"ok"` iff `SELECT 1` succeeds.
- **`migrations`** — the **per-hash** drift verdict (`src/server/health/migration-drift.ts`, ADR-0024 item 6): `"ok"` iff the applied-migration-hash multiset equals the journal-hash multiset; `"drift"` if they diverge; `"error"` if the DB is unreachable. Per-hash lives **only** on this surface (deployed envs have pg_cron → unstripped); CI's `db:check-drift` stays timestamp+count (CI strips pg_cron). `migrations:"drift"` on **prod** is *expected* until D5 (prod DB lags the journal by design).

```bash
curl -s https://staging.zugzwangworld.com/api/health | jq
curl -s https://zugzwangworld.com/api/health        | jq
```

---

## 2. Staging — the resettable auto-deploy sandbox  *(CC-authored)*

### 2.1 What a push to `staging` does

A single `push` to the **`staging`** branch triggers two independent reactions:

1. **`staging-migrate.yml` (GitHub Actions)** — `on: push: branches:[staging]`. Checks out → installs pnpm/node (`.nvmrc`) → installs the Doppler CLI → runs `doppler run --config stg -- pnpm db:migrate:staging` (token `DOPPLER_TOKEN_STG`). The `migrate-staging.ts` ref-fragment guard (`DATABASE_URL_STAGING` + `STAGING_PROJECT_REF_FRAGMENT`) is satisfied by Doppler-injected vars. **No pg_cron strip** — the staging Supabase project *has* the `pg_cron` extension (unlike CI's vanilla `postgres:17` substrate, where `ci.yml` strips `cron.schedule()`/`CREATE EXTENSION pg_cron` from `*pg_cron*.sql`). Migrations run **in GHA, never in the Vercel build**.
2. **Vercel auto-deploy** — the staging custom env's `branchMatcher equals staging` matches the push and Vercel builds + auto-deploys to `staging.zugzwangworld.com`.

Staging **tolerates a migrate/deploy race** by design — it is a resettable sandbox, not a guarded prod. If the deploy briefly serves against an un-migrated schema, the next `/api/health` poll converges once the GHA migrate finishes.

### 2.2 Verify a staging deploy

```bash
# 1. Watch the migrate job → GREEN
gh run list --workflow=staging-migrate.yml --limit 1
gh run watch <run-id>

# 2. PRIMARY GATE — health (env + db + per-hash migrations + canary == the pushed SHA)
curl -s https://staging.zugzwangworld.com/api/health | jq
#    expect: env:"staging", db:"ok", migrations:"ok", canary == <pushed SHA>
```

### 2.3 Seed / reset the sandbox

Staging data = **seed scripts** (no prod clone). Seeding is idempotent (`ON CONFLICT DO NOTHING` against `identity_pool_tuple_idx`):

```bash
doppler run --config stg -- pnpm db:seed:staging
#    re-run on a seeded DB → "[seed-staging] Done — 0 new rows, 200 already present"
```

Full reset (only if the sandbox is wedged): drop the staging schema → re-run `db:migrate:staging` → re-run `db:seed:staging`. The DB is disposable; never break-glass a sandbox.

> **Doppler config is `stg` (never `staging`).** Some script headers still say `--config staging` — that string is **stale** (tracked chore; see §4). Always use `stg`.

### 2.4 Operator toggle navigation  *(Vercel UI, web-confirmed 2026-06-26)*

- **Repoint the staging branch (one-time, D3):** Vercel → **Settings → Environments → [Staging custom env] → Branch Tracking** → change the match from `main` to `staging`. (It is a match *rule*; the `staging` branch need not exist yet when you set it.)
- **Disable Production auto-serve (one-time, D3):** Vercel → **Settings → Environments → Production → Branch Tracking** → toggle **OFF** "Auto-assign Custom Production Domains". Per Vercel's docs this affects only **future** pushes; it does **not** unassign the currently-live deployment's domain. **Do not trust the docs for this — prove it with an R2 before/after `/api/health` curl** (canary unchanged across the toggle; domain still serving).

---

## 3. Production — migrate-before-serve

> **STATUS: DRAFT — finalize at D5.** This sequence is **not yet exercised**. As of D3, production is *gated* (auto-assign-domains OFF — Vercel shows *"Production deployments will need to be manually promoted"*), but the first real prod migrate + promote happens at **D5**. The staging-auto-deploy mechanics in §2 are live; this prod path is the deliberate, single human checkpoint that reaches production. **Governed by [ADR-0024](../adr/0024-deploy-pipeline-migration-sequencing.md) item 5 (inheriting [ADR-0022](../adr/0022-prod-migration-strategy-and-drift-guard.md)'s apply path); do not weaken.**

### Why this exists (the load-bearing reason — read before executing)

The ledger is append-only and frozen-at-resolution. Production must **never** serve new code against an un-migrated database — there is no acceptable window where the app writes the ledger through a schema the DB hasn't applied. So production is **migrate-before-serve**: the database is migrated and *objectively verified* **before** the new build is allowed to take the `zugzwangworld.com` alias. The `drizzle-kit migrate` exit code is **not trusted** (drizzle-orm #5769 — a silent high-water-mark skip can exit `0` with a migration unapplied); the **per-hash `/api/health` result on the staged build is the only promote authority**. No `migrations:"ok"`, no promote.

### Preconditions (one-time D5 pre-flight — verify before the first promote)

- **Auto-assign OFF.** Production → Branch Tracking → "Auto-assign Custom Production Domains" = **Disabled** (set in D3; confirm still off).
- **Prod env vars populated** in Doppler `prd` (→ synced to Vercel Production): `DATABASE_URL_PROD`, `PROD_PROJECT_REF_FRAGMENT`. *(D1 flagged both as not-yet-verified — confirm present before D5; the migrate guard refuses without them.)*
- **`Doppler prd → Vercel Production` sync = In Sync** (1 active).
- **Every pending schema change is expand/contract** (additive-then-cleanup). During a promote the old and new builds briefly coexist (a Vercel alias swap is not atomic across running function instances), so the currently-serving code must tolerate the new schema. No destructive rewrite a live build can't survive.
- **Config name is `prd`, never `production`.** Migrations run over the session pooler `:5432`.

### The promote sequence (the single execution-time human checkpoint)

1. **Merge to `main`.** With auto-assign OFF, this creates a **staged** production build that does **not** serve `zugzwangworld.com`. Record the merged SHA («PROMOTE-SHA»).
2. **Wait for the staged build to reach Ready** in Vercel. Note its unique deployment URL (`<staged-url>`). The live alias is still serving the *previous* deployment — untouched.
3. **Gated-manual prod migrate** (ADR-0022 apply path — *not re-specified here; see ADR-0022*):
```
   doppler run --config prd -- pnpm db:migrate:prod
```
   Runs `scripts/migrate-prod.ts`: per-migration-transaction (avoids the enum-add→use 55P04 case), guarded by `DATABASE_URL_PROD` + `PROD_PROJECT_REF_FRAGMENT`, session pooler `:5432`. **The exit code is NOT the gate** (#5769) — step 4 is.
4. **THE GATE — verify on the STAGED BUILD, not the live alias yet:**
```
   curl https://<staged-url>/api/health
```
   **Require ALL of:**
   - `migrations:"ok"` — per-hash: the applied-hash multiset equals the journal-hash multiset, against the **now-migrated prod DB**.
   - `canary == «PROMOTE-SHA»` — proves the staged build is the commit you just merged (canary is `VERCEL_GIT_COMMIT_SHA`).
   - `db:"ok"`, `status:"ok"`.
   **If `migrations` is anything but `"ok"` → STOP. Do not promote.** A failed or forgotten migrate cannot reach users; the live alias keeps serving the prior build. Investigate, fix, re-run from step 3.
5. **Promote the staged build to production** (manual alias swap — instant, byte-identical, no rebuild):
   - **[VERIFY THE EXACT CONTROL AT D5 EXECUTION — Vercel UI shifts.]** Mechanism is one of: the **"Promote to Production"** action on the staged deployment in the Vercel dashboard, or `vercel promote <staged-url>` via CLI. Confirm the current path against Vercel docs at D5 rather than trusting this line.
6. **Verify live:**
```
   curl https://zugzwangworld.com/api/health
```
   Require `migrations:"ok"`, `canary == «PROMOTE-SHA»`, serving `200`. The live alias now points at the migrated build.
7. **Promotion note (the log — ADR-0024 item 10).** Record: «PROMOTE-SHA» · who · when (UTC) · the per-hash `/api/health` result. GitHub deployment history is the rest of the log. Native Doppler↔Vercel sync is the documented escalation only — not built.

### Rollback

- **Migrate failed / health not `ok` (pre-promote):** do **not** promote. The prior deployment keeps serving, untouched. Fix the migrate; re-run from step 3. Nothing reached users.
- **Regression discovered after promote (post-serve):** re-promote the prior known-good deployment (instant alias swap, no rebuild). **Caveat:** a schema rolled *forward* is **not** auto-rolled-back — expand/contract is precisely what lets the prior code tolerate the already-applied schema. A destructive schema change is *not* safely reversible by alias swap, which is why every migration is additive-then-cleanup.

### NOT part of this path

- No reviewer-gated GHA migrate job — the prod write is a deliberate manual action by design (solo operator; a reviewer gate would be self-approval theatre — ADR-0024 driver 3).
- No migrate inside the Vercel `buildCommand` (stays plain `next build`; builds run repeatedly and can't gate prod).
- No Supabase branching; no auto-promote on merge.

---

## 4. Known stale references

The deploy tooling predated ADR-0024 item 7's bare-SHA canary and carried stale assertions/comments. The focused post-D3 canary chore fixed the load-bearing ones; **`pnpm smoke:staging` is once again a valid staging gate.**

- **✅ RESOLVED — `scripts/smoke-staging.ts` (was SURPRISE-1, load-bearing):** the canary assertions (`:185` staging, `:202` preview) now validate a bare 40-char git SHA via `assertCanarySha`, with an optional `EXPECTED_SHA` exact-match (the "canary == pushed SHA" gate; full 40-char SHA only). The `health-preview` `env` assertion (`:199`) was also corrected `"preview" → "staging"` — Preview is `stg`-sourced post-D1, so staging-vs-preview is told apart by which URL is curled, not by env/canary.
- **✅ RESOLVED — `scripts/migrate-staging.ts:8` / `:42`** `--config staging` → `stg` (header comment + the runtime error message).
- **✅ RESOLVED — `docs/runbooks/staging-provisioning.md:157`** Appendix A: dropped `ZUGZWANG_ENV_CANARY=staging-...`; the route reads `VERCEL_GIT_COMMIT_SHA` for the canary.
- **⏳ OPEN (tracked for the next SYNC sweep) — `scripts/seed-staging.ts:8` / `:48`** still carry `--config staging` (the same stale string). Deliberately left out of the canary chore: the file was otherwise untouched, and doc/string reconciliation is periodic, not per-task (`docs/maintenance.md`). Use `stg`.

---

*Created at D3 (2026-06-26) per ADR-0024 item 2/3/7 (staging sandbox + canary) — §2 + §4 CC-authored from the live repo. §3 (prod-promote) is a web-authored DRAFT finalized at D5. Maintained per `docs/maintenance.md`.*
