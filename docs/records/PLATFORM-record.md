# PLATFORM — record

**Generated** 2026-09-03 from `origin/main` @ `ead741577b89849560ab3d3222a48b2a69bf18b7` · **Regenerate** per `docs/records/README.md`
**Covers** hosting, regions, connection pooling, caching, rate limits, idempotency, presigned URLs, observability, the deploy pipeline, staging↔production, secret names, migrations.

## 1 · What this lane is

Zugzwang runs as one Next.js application on Vercel, in a single region, against one
Postgres database per environment on Supabase, with Upstash Redis for the things that must
not live in Postgres — rate-limit counters, idempotency caches and short-lived locks — and
Cloudflare R2 for uploaded images. There is no queue, no worker fleet and no second service.

Two environments exist and they are not symmetric. **Staging** auto-deploys from the
`staging` branch, applies its own migrations from CI, and holds real participant rows.
**Production** does not auto-serve: a push to `main` builds a production-target deployment
but does not move the custom domain onto it. Promoting is a deliberate two-step — apply
migrations, then move the alias — and the health endpoint is the gauge for both halves.

The single idea a reader should carry away is that **every environment fact here is
readable at runtime**. `GET /api/health` returns the environment name, the commit SHA the
running code was built from, the region the function actually executed in, whether the
database answers, and whether the applied migration head matches the code's journal. Nothing
in this record has to be believed; all of it can be re-measured with one `curl`.

## 2 · Environment table — measured, with the command per cell

⚠ **These are measurements taken at generation time and they decay.** Re-run the commands;
do not read the values.

| | Staging | Production alias | Command |
|---|---|---|---|
| URL | `staging.zugzwangworld.com` | `zugzwangworld.com` | — |
| `env` | `staging` | `prod` | `curl -s <url>/api/health` |
| **Served SHA** (`canary`) | `e193cfb63aecde568a4ce705dcfee0380d491f74` — equals `origin/staging` | **`a61859ae92362d20fab27174bf8c842b555505bb`** — 2026-07-02, PR #193 | same curl; `canary` is `VERCEL_GIT_COMMIT_SHA` (`src/app/api/health/route.ts:39`) |
| Distance to `main` | 1 commit (`ead7415`, docs-only) | **326 commits** | `git rev-list --count <canary>..origin/main` |
| `region` | `bom1` | **key absent** — the 2026-07-02 build predates the field (added at PERF-1, #308) | same curl; `VERCEL_REGION` (`route.ts:60`) |
| `db` | `ok` | `ok` | same curl |
| **`migrations`** | `ok` | `ok` *(against a DB that matches the old code)* | same curl; `src/server/health/migration-drift.ts` |
| **Migration head applied** | **27** — `0026_lots_no_delete` | **20** | `doppler run --config <stg\|prd> -- pnpm db:check-drift` |
| Drift verdict | `IN SYNC ✓` | ⛔ **`DRIFT ✗`** | same |
| `identity_pool` total / unassigned | **1,070 / 548** | ⛔ **0 / 0** | `SELECT count(*), count(*) FILTER (WHERE assigned_at IS NULL) FROM identity_pool` |
| `users` | 321 | ⛔ **0** | `SELECT count(*) FROM users` |
| `markets` | 12 (all `Open`) | ⛔ **0** | `SELECT count(*) FROM markets` |

⛔ **Seven migrations are unapplied on production** — `0020_dharma_ledger_seq`,
`0021_truncate_guards`, `0022_bet_receipts`, `0023_positions_market_id_idx`,
`0024_bookmarks`, `0025_lots`, `0026_lots_no_delete`. Among them the durable
idempotency receipts, the TRUNCATE guards and the whole lot-accounting table.
See `docs/STATE.md` §4 · `F-1`.

⛔ **Ordering dependency — migrate to head BEFORE seeding production.** `0022_bet_receipts` is
the durable idempotency backstop; without it a replay inside a Redis-outage window is guarded by
the cache alone. That is harmless today because production holds zero users, markets and pool
rows — there is nothing to double-charge. **It stops being harmless the moment production is
seeded.** Apply migrations to head first; seed second.

⚠ **Staging drifts between reads, and this set holds reads taken minutes apart.** During this
generation `identity_pool` unassigned went **549 → 548** and `users` went **320 → 321** — one
signup. `comments`/`bets` went **1,689 → 1,692** and stayed equal throughout. Where another
record shows the earlier figure, that is live drift, not a contradiction; **re-measure rather
than reconcile.**

⛔ **The production database is empty** — no identity pool, no users, no markets.
See `docs/STATE.md` §4 · `F-2`.

**Region is verified against a second source, not asserted.** `route.ts:52-64` records why:
`VERCEL_REGION` is Vercel-injected per invocation, and its truthfulness proof is that it
equals the compute half of the `x-vercel-id` response header, which the edge generates
independently of the function's environment. `tests/server/health/region.test.ts` holds that.

## 3 · Feature table

| Feature | Status | Code | Spec | ADR | Proved by | Open |
|---|---|---|---|---|---|---|
| Health / canary / region / drift endpoint | SHIPPED | `src/app/api/health/route.ts` | SPEC.2 §22 | 0022, 0024 | `tests/server/health/` | — |
| Single-region execution (`bom1`) | SHIPPED | `vercel.json` (`"regions": ["bom1"]`) | — | 0006 | `tests/server/health/region.test.ts` | — |
| Postgres via Supabase session pooler | SHIPPED | `src/db/index.ts` | SPEC.2 §5 | 0008, 0024 | `tests/unit/db/client-options.test.ts` (pins the shipped pool options); live control `scripts/verify-pooler-mode.ts` | — |
| Transaction-pooler mode behind a flag | PARTIAL — staging only | `src/db/index.ts:45` (`DB_POOLER_MODE`), `:55` refuses `transaction` in prod | — | 0024 P3, 0038 P1 | `tests/unit/db/pooler-mode.test.ts` (13 tests, incl. *"transaction mode in prod is refused at boot"*); live control `scripts/verify-pooler-mode.ts` | `STATE.md` §4 · `F-6` |
| Rate limiting, six sliding windows | SHIPPED | `src/server/middleware/rate-limit.ts:40-87` | SPEC.2 §11 | 0015 | `tests/integration/rate-limit.integration.test.ts`, `tests/unit/rate-limit-prefix.test.ts` | — |
| Idempotency cache (Redis) | SHIPPED | `src/server/idempotency/cache.ts` | SPEC.2 §11 | 0015, 0044 | `tests/integration/idempotency-cache.integration.test.ts`, `tests/unit/idempotency-release.test.ts` | — |
| Durable idempotency receipts (`bet_receipts`) | SHIPPED | `src/db/schema/bets.ts`, `drizzle/migrations/0022_bet_receipts.sql` | SPEC.2 §11 | 0031 | `tests/invariants/I-IDEM-ONCE-001.one-commit-per-idempotency-key.spec.ts` | not on prod — `F-1` |
| User-scoped idempotency keys | SHIPPED | `src/server/idempotency/cache.ts` | SPEC.2 §11 | 0044 | `tests/integration/cross-user-idempotency.integration.test.ts`, `tests/invariants/I-IDEM-NOMASK-001.cached-non-2xx-never-masks-a-commit.spec.ts` | — |
| Redis key namespacing by environment | SHIPPED | `src/server/upstash/keys.ts` | SPEC.2 §11 | — | `tests/unit/upstash-keys.test.ts`, `tests/unit/upstash-redis-config.test.ts` | — |
| Distributed locks (cron singletons) | SHIPPED | `src/server/upstash/lock.ts` | SPEC.2 §12 | — | `tests/integration/upstash-lock.integration.test.ts` | — |
| Presigned PUT (upload) | SHIPPED | `src/server/storage/sign-upload.ts`, `src/app/api/uploads/sign/route.ts` | SPEC.2 §12 | 0028, 0042 | `tests/integration/sign-upload.integration.test.ts`, `tests/server/storage/sign-route-envelope.test.ts` | — |
| Presigned READ (moderation, 60 s) | SHIPPED | `src/server/storage/sign-read.ts`, TTL `src/server/config/limits.ts:40` | SPEC.2 §12 | 0028, 0042 | `tests/integration/sign-read.integration.test.ts` | — |
| R2 orphan sweep (6-hourly cron) | SHIPPED | `src/app/api/cron/r2-orphan-sweep/route.ts`, `vercel.json` | SPEC.2 §12 | — | `tests/integration/orphan-sweep.integration.test.ts` | — |
| Close-due-markets sweep (per minute) | SHIPPED | `src/app/api/cron/close-due-markets/route.ts` | SPEC.1 §14 | — | `tests/server/cron/` | — |
| Alarms drain (5-minutely) | SHIPPED | `src/app/api/cron/alarms-drain/route.ts`, `src/server/observability/drain-cron-alarms.ts` | SPEC.2 §17 | — | `tests/integration/alarms-drain.integration.test.ts` | — |
| Sentry error capture | SHIPPED | `sentry.{server,edge}.config.ts`, `instrumentation*.ts`, `src/server/observability/safe-capture.ts` | SPEC.2 §17 | 0007 | `tests/unit/observability/` | — |
| PostHog product analytics | SHIPPED | `src/lib/posthog/` | SPEC.2 §17 | 0007 | `tests/unit/observability/` | — |
| `cacheComponents` / PPR | SHIPPED | `next.config.ts:26` | — | 0041 | `tests/unit/debate-view/`, `tests/integration/header-portfolio.integration.test.ts` | — |
| Reserves-keyed participant caching | SHIPPED | `src/server/debate-view/cached-view.ts`, `src/server/discovery/cached-series.ts` | — | 0041 | `tests/unit/debate-view/` | — |
| Migration applier — staging | SHIPPED | `scripts/migrate-staging.ts`, `.github/workflows/staging-migrate.yml` | — | 0024 | `tests/integration/migration-drift.integration.test.ts` | — |
| Migration applier — production | SHIPPED, **never run to head** | `scripts/migrate-prod.ts` | — | 0022, 0024 | `tests/integration/migration-drift.integration.test.ts` | `F-1` |
| Schema-drift guard | SHIPPED | `scripts/check-migration-drift.ts`, `src/server/health/migration-drift.ts` | — | 0022, 0024 | `tests/integration/migration-drift.integration.test.ts` | — |
| Doppler-managed secrets (`stg` / `prd`) | SHIPPED | — | SPEC.2 §19 | — | `tests/unit/ci-env-parity.test.ts` (12 tests over `auditEnvParity`); driven by `.github/workflows/env-audit.yml` | `F-7` |
| Origin allowlist | SHIPPED | `src/server/middleware/origin-allowlist.ts` | SPEC.2 §11 | — | `tests/server/middleware/` | — |
| Structured request logging | SHIPPED | `src/server/middleware/logging.ts` | SPEC.2 §17 | 0007 | `tests/server/middleware/` | — |
| Frontend bundle instrument | SHIPPED | `scripts/measure-frontend-bundle.ts`, baseline `scripts/bundle-baseline.json` | — | — | `tests/unit/scripts/bundle-baseline.test.ts` (7 tests — the report shape plus five ceiling ratchets) | — |
| Branch protection / required checks | **NOT BUILT** | — | — | — | none | `F-8` |
| E2E runner (Playwright) | **NOT BUILT** | — | — | — | none | — |
| Enforcement hooks / `permissions.deny` | **NOT BUILT** | — | — | — | none | — |

**On the three NOT BUILT rows.** Each is written NOT BUILT rather than "pending" because
nothing on `main` implements it. Verified by negative assertion with a positive control:
`git grep -l playwright -- package.json` returns nothing, while the control
`git grep -l vitest -- package.json` returns `package.json` — the pattern shape finds a real
dependency. `ls .claude/hooks .claude/settings.json` returns nothing; the control
`ls .claude/agents` returns four files.

## 4 · Invariants and guards this lane carries

**Failure posture is asymmetric on purpose, and the asymmetry is the load-bearing fact.**

| Surface | Posture | Where |
|---|---|---|
| **Rate limit** | **fails OPEN** — an Upstash outage admits the request rather than refusing it, and the admitted-via-fail-open result is distinguishable from admitted-with-quota (`{ allowed: true, remaining: -1, reset: 0 }`) | `src/server/middleware/rate-limit.ts:114-116`, catch at `:164` |
| **Idempotency** | **fails CLOSED** — surfaces as a clean 503 rather than admitting a possibly-duplicate write | `src/server/idempotency/cache.ts:104-109`, `:160`, `:183` |
| **Moderation** | **fails CLOSED** on every terminal branch — see `docs/records/DEBATE-record.md` §4, which states it per branch | `src/server/moderation/openai.ts` |
| **Storage (`HeadObject`)** | terminal 4xx for a client mistake, **503** for an unavailable store, and a 503 is *not* cached so a retry re-attempts | `src/server/bets/errors.ts:386-405` |

**Guards at the storage layer, not the application layer:**

- Bucket A append-only — 10 tables reject `UPDATE`/`DELETE` at the trigger, and `TRUNCATE`
  statement-level. `drizzle/migrations/0003_append_only_triggers.sql`, `0021_truncate_guards.sql`,
  `0022_bet_receipts.sql`. Proved by `tests/db/triggers/` (15 specs) and
  `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts`.
- `lots` carries a row-level `BEFORE DELETE` reject named deliberately outside the `bucket_%`
  family, so it enters neither the append-only contract nor the staging reset's guard
  catalogue — both of which would misdescribe it. `drizzle/migrations/0026_lots_no_delete.sql`,
  proved by `tests/db/triggers/lots-no-delete.spec.ts`.
- `dharma_ledger.seq` gives the ledger a total order. `drizzle/migrations/0020_dharma_ledger_seq.sql`.

**The transaction spine.** Every multi-write user action runs `SERIALIZABLE` with
`SELECT … FOR NO KEY UPDATE` on the contended row and full-jitter retry on `40001`/`40P01`:
W-1 bets `src/server/bets/transaction.ts`, W-3 resolution `src/server/resolution/transaction.ts`,
W-4 market lifecycle `src/server/markets/transaction.ts`.

⛔ **No HTTP call may run inside a database transaction.** The moderation call is the one that
would tempt it, and it is placed at step 6 of the place route with the transaction opening at
step 7 — `src/app/api/bets/place/route.ts:135` (the awaited moderation call) and `:197` (`await runBetTransaction`).

## 4.1 · Secret names — names only, never values

Doppler project `zugzwang-experiment`, configs **`stg`** and **`prd`** (never `staging` /
`production` — the config names are two of the most-repeated mistakes in this repo).
Measured with `doppler secrets --project zugzwang-experiment --config <c> --only-names`.

**`stg` carries 41 names · `prd` carries 36.** The asymmetry is mostly correct and is
recorded here only where a name's presence or absence is itself a fact.

| Name | `stg` | `prd` | Reading |
|---|:-:|:-:|---|
| `DATABASE_URL_STAGING` / `STAGING_PROJECT_REF_FRAGMENT` | ✓ | — | environment-specific; correct |
| `DATABASE_URL_PROD` / `PROD_PROJECT_REF_FRAGMENT` | — | ✓ | environment-specific; correct |
| `SENTRY_API_TOKEN` | ✓ | — | **correct by design** — read by the local staging smoke runner only, never by deployed code |
| `DATABASE_URL_TXN`, `DB_POOLER_MODE` | ✓ | — | the S-1 transaction-pooler pair. `src/db/index.ts:55` **refuses** `transaction` mode in prod, so the absence is enforced by code, not only by configuration |
| `ZUGZWANG_ENV_CANARY` | ✓ | — | ⚠ **dead config.** `/api/health` reads exactly three env vars and this is not one of them (`route.ts:38-60`); ADR-0024 item 7 moved `canary` to `VERCEL_GIT_COMMIT_SHA`. Harmless, but nothing reads it |
| `BETTER_AUTH_TRUSTED_ORIGINS` | ✓ | ⛔ **absent** | ⚠ **Config hygiene, not a security gap — measured, because the obvious reading is wrong.** `src/server/auth/index.ts:330-333` resolves it to `[]`, but that is not an empty trust set: `getTrustedOrigins` pushes `new URL(baseURL).origin` **first and unconditionally** (`node_modules/better-auth/dist/context/helpers.mjs:73`), and `baseURL` is `BETTER_AUTH_URL`, which `auth/index.ts:47-49` hard-throws without. Production serves, so it is set, and the effective trust set is `["https://zugzwangworld.com"]` — **exactly the value** `docs/plans/SCAFFOLD.8-staging-plan.md:173` ratifies. `src/server/middleware/origin-allowlist.ts:24` derives a second, independent allowlist from the same variable. **What is absent is the name and any recorded decision to drop it.** See `STATE.md` §4 · `F-7` |
| `R2_*` (12 names) | ✓ ×12 | ✓ ×12 | full three-arm parity — uploads, pfp, market-media |
| `BETTER_AUTH_SECRET`, `TURNSTILE_*`, `RESEND_*`, `OPENAI_API_KEY`, `UPSTASH_*`, `ADMIN_PASSWORD`, `CRON_SECRET` | ✓ | ✓ | present both |

⚠ **A name's presence says nothing about its value.** Vercel environment values are
write-only once set, which is exactly why `docs/parked.md` SEQUENCE row 1 (a possible
`BETTER_AUTH_SECRET` mismatch between Doppler `stg` and Vercel's `staging` scope) cannot be
discharged by any check this record can run.

## 4.2 · CI, and what it does not gate

`.github/workflows/` holds **three** files and no others: `ci.yml`, `env-audit.yml`,
`staging-migrate.yml`.

`ci.yml` runs, in order (`.github/workflows/ci.yml:68-153`): checkout → pnpm → Node →
`pnpm install --frozen-lockfile` → `pnpm biome check .` → `pnpm tsc --noEmit` →
`pnpm drizzle-kit check` → **strip `pg_cron` statements** (the CI runner has no `pg_cron`, so
`*pg_cron*.sql` statements are removed before applying) → `pnpm drizzle-kit migrate` →
`pnpm db:check-drift` → `pnpm vitest run`, against a Postgres 17 service.

`staging-migrate.yml` fires on a push to `staging` and applies pending migrations with
`--config stg`. `env-audit.yml` is a scheduled Doppler↔Vercel parity check and **is not a
merge gate**.

⛔ **`ci` is not a required status check, because no status check can be required.** There is
no branch protection on any branch — see `STATE.md` §4 · `F-8`. CI green is therefore a thing
to check at the moment of merging, not a gate to lean on.

⚠ **CI reads no markdown.** A docs-only change passes `ci` while touching zero files it
inspects, so a green CI on a documentation PR is not evidence about the documentation. That
is why this record's own lane runs the full test suite locally instead.

## 4.3 · Caching, and where the boundary sits

`cacheComponents` is **enabled** (`next.config.ts:26`), which makes Partial Prerendering the
default and `'use cache'` / `cacheLife` / `cacheTag` available. Two consequences a reader
must hold:

1. **Cookies and headers must be read outside a cached scope.** A segment not yet
   restructured for the framework's instant-navigation validation opts out with
   `instant = false` — which is why Next had to move to `16.3.2`, since `16.2.4` silently
   ignored that option.
2. **The participant cache is keyed on the pool reserves, not on time.** `cached-view.ts`
   and `cached-series.ts` key on the reserve state, so a bet invalidates the read models it
   actually changed rather than waiting out a TTL (ADR-0041).

`next.config.ts` also carries `agentRules: false` — without it the 16.3.x dev/build step
appends a generated block to `AGENTS.md` on every run — and `outputFileTracingIncludes` for
`/api/health` (the migration files it reads) and `/m/[slug]/export` (`public/zugzwang.md`).

**Presigned-URL lifetimes are budgeted against the downstream cache, not chosen for
convenience** (ADR-0042): `PUT_URL_TTL_SECONDS = 60` and
`READ_URL_TTL_SECONDS_MODERATION = 60` (`src/server/config/limits.ts:37,40`).

## 4.4 · Migration conventions

- **Append-only.** A committed migration is never edited; a new one is written.
  `drizzle/migrations/` holds 27 `.sql` files, `0000`–`0026`.
- **Expand / contract.** Schema changes are additive first; no destructive in-place alter on
  a live table.
- **Migrate before serve.** The production migration applies *before* the new code is
  promoted — which is precisely the rule the current production state has not yet satisfied.
- **`events` is hand-partitioned** (`PARTITION BY RANGE`) and excluded from drizzle-kit via
  `tablesFilter: ["!events"]`, so its DDL is raw SQL in a migration.
- **`pg_cron`-coupled migrations** (`0007`, `0011`) carry `cron.schedule()` calls that CI
  strips before applying.
- ⛔ **Trust the `/api/health` gauge, not the migrate step's exit code.** The migrate step can
  report success while the database is not ready (drizzle-orm #5769), so the gate is health.

## 5 · Work history

| Unit | PR | Merge SHA | Date | What landed |
|---|---|---|---|---|
| SCAFFOLD.4 | #37 | `825e18b` | 2026-05-15 | Upstash substrate — rate-limit middleware + idempotency cache |
| SCAFFOLD.5–.7 | #53 | `e6de02a` | 2026-05-26 | observability stack (Sentry + PostHog + structured logging) |
| SCAFFOLD.18 | #54 | `e080dab` | 2026-05-27 | CI gains a Postgres service and applies migrations |
| SCAFFOLD.8 | #57 | `92b7c47` | 2026-05-28 | the staging environment |
| FIX-AUTH-LOGIN | #150 | `3f82371` | 2026-06-20 | session `expiresIn` capped at the 400-day cookie ceiling |
| D3 / OD-1 | #173 | `48ac08c` | 2026-06-27 | stale bare-SHA canary assertions corrected in the staging smoke |
| AUDIT-FIX-B5 | #205 | `01a9d0c` | 2026-07-05 | `moderation.blocked` emit + event-id-reuse payload guard |
| **PERF-1** | **#307** | `cc776bf` | 2026-08-09 | **the ratified `bom1` region applied — ADR-0006 had never been implemented** |
| PERF-1 close | #308 | `6a37677` | 2026-08-09 | health reports the region; the blocker closes |
| PERF-1 re-verify | #392 | `0783b0d` | 2026-08-22 | re-verified post-LOTS-1; PERF-2 opened |
| SCALE S-1 | #404 | `e37da00` | 2026-08-25 | transaction-pooler migration behind `DB_POOLER_MODE` |
| SCALE S-1 close | #409 | `64e0874` | 2026-08-25 | close-out log + the §3.3 install step |
| SCALE S-4 | #423 | `83cf6fb` | 2026-08-26 | the cache invalidation fixes #405 merged without |
| SCALE S-4 | #424, #430 | `c5976c0`, `f7eba3e` | 2026-08-27/28 | caching phases |
| SCALE S-3 | #431 | `2f3497d` | 2026-08-28 | Google OAuth signup connection deadlock fixed (ADR-0043) |
| SCALE S-7 | #432 | `acb71cb` | 2026-08-28 | idempotency scoped to the user holding the key (ADR-0044) |
| HO-T4 | #445 | `44924a7` | 2026-09-01 | the frontend bundle instrument |
| HO-T5 | #456 | `974ed10` | 2026-09-01 | `PositionsTable` code-split |
| HO-T4 R3 | #464 | `881b13f` | 2026-09-02 | count the chunks Turbopack lists, not the webpack fallback |
| HO-T5 fix | #465 | `4b98453` | 2026-09-02 | a boundary for the split component |

**Lanes with no session log in the repository:** SCALE **S-7** (`docs/plans/S-7.md` exists; no
log) and **HO-T4** (no `docs/plans/T4.md`, no log). No repository record — PR #432 and PR #445
merged the work; the lanes have no session log.

## 6 · Known-open

| Pointer | What |
|---|---|
| `docs/STATE.md` §4 · `F-1` | production is 7 migrations behind the code |
| `docs/STATE.md` §4 · `F-2` | the production database is empty |
| `docs/STATE.md` §4 · `F-6` | `DATABASE_URL_TXN` / `DB_POOLER_MODE` present in `stg`, absent in `prd` |
| `docs/STATE.md` §4 · `F-7` | `BETTER_AUTH_TRUSTED_ORIGINS` absent from `prd` — config hygiene; the protection is intact via the baseURL origin |
| `docs/STATE.md` §4 · `F-8` | no branch protection on any branch; `ci` is not a required check |
| `docs/parked.md` — SEQUENCE row 1 | `BETTER_AUTH_SECRET` may differ between Doppler `stg` and Vercel `staging` |
| `docs/parked.md` — SEQUENCE row 2 | the Sentry routing smoke check is a lookalike |
| `docs/parked.md` — SEQUENCE row 3 | AUDIT-FIX-B2 OQ-2, app-as-owner role split — the only complete TRUNCATE fix |
| `docs/parked.md` — SCAFFOLD.12 §10.b | Resend domain verification + `RESEND_FROM_EMAIL` flip |
| `docs/parked.md` — SCAFFOLD.12 §10.c/§10.d | preview-env `BETTER_AUTH_URL`; preview-alias callback URI |
| `docs/parked.md` — PERF-2 | read-path volume, owned by SCALE S-5 |

**Where the rules live:** `docs/runbooks/deploy-pipeline.md` §3 owns the promote sequence and
`docs/runbooks/staging-provisioning.md` owns the sandbox. This record does not restate either.
