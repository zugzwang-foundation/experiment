# Incident — 2026-07-02 — prod migration drift (`0019_market_media` unapplied; auto-serve gate had drifted ON)

**Severity:** low blast-radius (dormant for participants), high latent risk. **Status: RESOLVED.**
**Verification base:** `main` @ `a61859a` (`a61859ae92362d20fab27174bf8c842b555505bb`) — the SHA prod was serving throughout.
**Log branch:** `chore/prod-drift-incident-log`, off `main` @ `a61859a`.
**Prod DB:** production Supabase (`zbvprdcyxhlguxbostdj`), session pooler `aws-1-ap-south-1.pooler.supabase.com:5432`.
**Handling:** diagnosis was strictly read-only; the two prod writes (migrate, Vercel toggle) were operator-gated and each verified via the authoritative `/api/health` gauge, not exit codes.

---

## WHAT HAPPENED

- Migration **`0019_market_media`** (MEDIA.1, PR **#184**) merged to `main` on **2026-06-30**, **after** the last production migrate + gated promote (**D5/D6, 2026-06-28**). It was **never applied to prod**.
- Meanwhile Vercel **`autoAssignCustomDomains` was ENABLED** — drifted from its intended **OFF** state (it had silently reverted once before, between D3 and D5). With auto-serve ON, **every `main` merge since D6 auto-served to prod** with no migrate-before-serve gate.
- Result: prod served **HEAD code (canary `a61859a`)** that expects `0019`'s schema against a **prod DB that lacked it**. `GET /api/health` → **`migrations:"drift"`**.
- **Symptom:** the admin market-detail page (`/admin/markets/[marketId]`), which does a bare `db.select().from(markets)` (all columns), **500'd** on the missing `markets.media_video_url` column.
- **DORMANT for participants.** No participant path touches the drifted schema — every participant `markets` read uses an explicit narrow column list (`getMarketBySlug` → `{id,slug,title,description,status}`; bet placement → `{status}`; debate export → `{outcome,resolvedAt}`; close-due cron → `{id}`), none referencing `media_video_url`, and there are **zero `db.query.*` calls** (nothing auto-selects all columns). The fault only bit admin market management (detail view, create-with-media, media upload).

---

## DIAGNOSIS (read-only, incident-safe)

- `GET https://zugzwangworld.com/api/health` → `{status:ok, env:prod, canary:a61859a…, db:ok, migrations:"drift"}` — `canary` = `main` HEAD.
- Read-only prod SQL (Supabase SQL editor) confirmed:
  - `drizzle.__drizzle_migrations`: **`applied_count = 19`** (repo journal has **20**); last applied = **`0018`** (hash `873c049…`, applied **2026-06-23**); **`0019` absent**.
  - `information_schema`: **`market_media` table absent**; **`markets.media_video_url` column absent**.
- Root cause traced to **`autoAssignCustomDomains = true`** (confirmed via Vercel API GET on the project).
- **`0019` is additive-only** (verified from `drizzle/migrations/0019_market_media.sql`): `CREATE TABLE market_media` (+FK +2 indexes) + `ALTER TABLE markets ADD COLUMN media_video_url text` (nullable, no default). No DROP, no data migration, no non-nullable add → safe to apply after the fact.

---

## THE FIX (migrate-before-serve, applied after the fact + gate re-armed)

**1. Applied `0019` to prod via the gated path.**
```
doppler run --config prd -- pnpm db:migrate:prod
```
Per-migration-transaction applier (`scripts/migrate-prod.ts`), guarded by `DATABASE_URL_PROD` + `PROD_PROJECT_REF_FRAGMENT`, session pooler. **Only `0019` applied** (the applier skipped already-committed `0017`/`0018` by `folderMillis`). Verified via the **real gate** — not the migrate exit code (drizzle-orm #5769):
- `/api/health` flipped **`drift → ok`**.
- Read-only re-check: `market_media` table + `markets.media_video_url` column now **present**; `drizzle.__drizzle_migrations` **`applied_count = 20`**, `0019` row present (hash `5343c5a6f9e0`, `created_at = 1782832985700`); `db:check-drift` → **IN SYNC ✓**.

**2. Turned `autoAssignCustomDomains` OFF** (Vercel → Production → Branch Tracking). Confirmed it **STUCK** via API GET: `autoAssignCustomDomains: false` with a **real-user attribution** (`autoAssignCustomDomainsUpdatedBy` = a user id, **not `"system"`** — the prior silent revert had `system` attribution). The live alias served unchanged across the flip (`canary a61859a`, `migrations:ok`) — disabling auto-serve affects only *future* pushes, per runbook §2.4.

**3. DP.0b — provisioned the four `R2_*_MARKET_MEDIA` creds** (one shared bucket-scoped token, bucket `zugzwang-market-media`) in Doppler **`prd` + `stg`**. Verified read-only (no upload, no PUT/GET): **4/4 names present per config**; the market-media `S3Client` **constructs without throwing** (mirroring `resolveBucketEnv("market-media")` + `getClient`, network-free) under both `stg` and `prd`; prod `/api/health` still green.

---

## THE LESSON

This is the concrete case for **migrate-before-serve** *and* the **review-before-merge posture (Option A, ratified this cycle)**: a merge reached prod ahead of its migration because a deploy gate had silently drifted. The durable fix is **not** just applying `0019` — it is:
- the toggle being **OFF** (future merges *stage*, not auto-serve), **plus**
- the merge discipline (Option A gates code before it can reach `main`).

`autoAssignCustomDomains` has now **reverted twice historically**. Treat its state as something to **re-verify before any migration-bearing merge** — it is a **DP.1 precondition**. The load-bearing gauge is the boolean via a fresh Vercel API GET (the MCP `get_project` / `vercel project inspect` omit the field), not the attribution.

---

## DOC-DRIFT FIXES (folded into this doc-only PR — related)

- **`docs/runbooks/deploy-pipeline.md` §0** said *"head currently `0018`"* → corrected to **`0019`** (now the applied prod head).
- **The "no session log written" gap** flagged during the work is closed by **this incident log**.

---

## PRECONDITION STATUS (for the tracker)

| Precondition | State |
|---|---|
| **DP.0a** — `autoAssignCustomDomains` OFF | **DONE** + confirmed stuck (real-user attribution) |
| **DP.0b** — `R2_*_MARKET_MEDIA` creds in `prd` + `stg` | **DONE** + verified (4/4 per config; client constructs) |
| **DP.1** — staging→prod sync + gated promote | **UNBLOCKED** — runs through the armed gate as its own task. **Re-verify `autoAssignCustomDomains` OFF as a DP.1 precondition** (revert history). |

---

## PK-REFRESH

- `docs/logs/INCIDENT-2026-07-02-prod-migration-drift.md` (this log) + the `docs/runbooks/deploy-pipeline.md` §0 one-line fix.
- Staged into `~/Desktop/zz-pk-refresh-incident/`, md5-verified from `origin/main` after this PR squash-merges (canonical SHA = the squash SHA on `main`).

---

## Next session starts at

**DP.1** — staging→prod sync + gated promote, opened as its own task; re-verify `autoAssignCustomDomains` OFF first.
