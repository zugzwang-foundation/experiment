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

## 3. Production — migrate-before-serve  *(PLACEHOLDER — web-authored, to be finalized at D5)*

> ⚠️ **STUB — NOT YET OPERATIONAL. Do not promote to production from this section.** The prescriptive prod-promote sequence (the exact operator steps, the per-hash go/no-go wording, the rollback) is **authored by web-Claude and finalized at D5**. It is intentionally left as a pointer here so this runbook does not fabricate an irreversible-action procedure ahead of its ratification.

The **decided** shape (ADR-0024 **item 5**, inheriting ADR-0022's apply path) is:

> merge → staged build (auto-serve **disabled**, so `main` does not auto-promote) → **gated-manual** `doppler run --config prd -- pnpm db:migrate:prod` (ADR-0022: per-migration-transaction, `DATABASE_URL_PROD` + `PROD_PROJECT_REF_FRAGMENT` guard) → verify the **staged build's** `/api/health` reports `migrations:"ok"` against the now-migrated prod DB → **promote**.

The prod migrate + promote is the **single execution-time human checkpoint** (ADR-0024 driver 3 — no reviewer-gated GHA self-approval). Migrate exit codes are **not** trusted (#5769); the per-hash `/api/health` result is the promote authority — **no promote without per-hash `ok`**. Every promote records SHA / who / when / the per-hash result (ADR-0024 item 10).

**Until D5 finalizes this section, see [ADR-0024 item 5](../adr/0024-deploy-pipeline-migration-sequencing.md) and [ADR-0022](../adr/0022-prod-migration-strategy-and-drift-guard.md) as the source of truth.**

---

## 4. Known stale references (tracked chore — not yet fixed)

The deploy tooling predates ADR-0024 item 7's bare-SHA canary and carries stale assertions/comments. **A focused chore (post-D3) fixes these; until then, verify staging by direct `/api/health` curl, not `pnpm smoke:staging`:**

- **`scripts/smoke-staging.ts` (SURPRISE-1, load-bearing):** asserts `canary.startsWith("staging-")` (`:185`) / `"preview-"` (`:202`) — **false-fails a healthy post-D1 staging** because the canary is now the bare SHA. Do **not** use `pnpm smoke:staging` as a deploy gate until this is corrected.
- **`scripts/migrate-staging.ts:8`** header comment says `--config staging` (stale → `stg`).
- **`docs/runbooks/staging-provisioning.md:157`** Appendix A lists `ZUGZWANG_ENV_CANARY=staging-...` — the route no longer reads `ZUGZWANG_ENV_CANARY` (canary is `VERCEL_GIT_COMMIT_SHA`).

---

*Created at D3 (2026-06-26) per ADR-0024 item 2/3/7 (staging sandbox + canary) — §2 + §4 CC-authored from the live repo. §3 (prod-promote) is a web-authored placeholder finalized at D5. Maintained per `docs/maintenance.md`.*
