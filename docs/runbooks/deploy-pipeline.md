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
| **Preview** | ⚠ **NOT any feature branch** — only a ref on Vercel's dashboard-side **Ignored Build Step** allowlist. A non-matching ref is `Canceled by Ignored Build Step` seconds in, with no error. The setting lives in the Vercel dashboard, **not** in `vercel.json`, so it cannot be read from this repo. Escape hatch when you need a preview off a non-allowlisted ref: `vercel deploy --yes -e VERCEL_GIT_COMMIT_SHA=<HEAD>` — a CLI-direct build is not a git-integration build and is not gated. **Never push a shared ref just to force a preview.** | **staging** Supabase | per-deploy `*.vercel.app` | none (schema correctness via CI's ephemeral Postgres) |
| **Staging** | push to **`staging`** branch | **staging** Supabase (`rwfdoqzsghqhhdapxafg`) | `staging.zugzwangworld.com` | **auto** — `staging-migrate.yml` (GHA) on push to `staging` |
| **Production** | merge to **`main`** | **production** Supabase (`zbvprdcyxhlguxbostdj`) | `zugzwangworld.com` | **manual gate** — `db:migrate:prod` then promote (see §3, first exercised at D6) |

Both DBs run the **same committed** `drizzle/migrations/` set (head `0026_lots_no_delete` as measured 2026-08-28 — **read `drizzle/migrations/` and `meta/_journal.json` for the live head rather than this line.** A head written into prose is stale from the next migration onward; this number is evidence, not the source of truth. It said `0024_bookmarks` for the two migrations `lots` added). Migrations **never** run in the Vercel `buildCommand` — `buildCommand` stays plain `next build`.

---

## 1. The `/api/health` verification surface

Every environment exposes `GET /api/health` (`src/app/api/health/route.ts`, public, uncached, Node runtime). It is the **authoritative** deploy/migrate signal — curl it; do not trust migrate exit codes (drizzle-orm #5769).

```json
{ "status": "ok", "env": "staging", "canary": "<git-commit-sha>", "region": "bom1", "db": "ok", "migrations": "ok" }
```

- **`env`** — `ZUGZWANG_ENV` (`prod` / `staging` / `preview`). Proves *which environment config* the deployment booted with.
- **`canary`** — `VERCEL_GIT_COMMIT_SHA`, the **bare commit SHA** the deployment is serving (ADR-0024 item 7). This is how you confirm "which SHA is live". *(It is the bare SHA — **not** a `staging-…`/`preview-…` prefixed string. Any tooling that asserts a prefix is stale; see §4.)*
- **`db`** — `"ok"` iff `SELECT 1` succeeds.
- **`region`** — `VERCEL_REGION`, the region the function actually executed in (`null` off-platform — local and CI have no region, and a fallback string would be a control reporting a region it never read). **This is the PERF-1 control that ADR-0006's ratified `bom1` is really applied.** The project served from `iad1` for three months because nothing read the region back and `vercel.json` was *silent* rather than wrong — so it looked identical to a correct file in every diff, CI run and review. Its truthfulness proof is not that the field exists; it is that the value equals the **compute** half of `x-vercel-id` (`<ingress>::<compute>`) on the same response, a header the edge generates independently of this function's environment. Expect `bom1` on staging. ⚠ **Production is a known exception, not a discovery** — the prod alias serves a pre-#308 build and does not report `bom1`. Any *other* reading, on either environment, is a real finding; if it disagrees with `x-vercel-id`, the header is the authority. *(Added at SYNC-5: the field has shipped since PERF-1 and this bullet list never named it, so the one field that caught a 35 s → 0.7 s regression had no prompt at promote time.)*
- **`migrations`** — the **per-hash** drift verdict (`src/server/health/migration-drift.ts`, ADR-0024 item 6): `"ok"` iff the applied-migration-hash multiset equals the journal-hash multiset; `"drift"` if they diverge; `"error"` if the DB is unreachable. Per-hash lives **only** on this surface (deployed envs have pg_cron → unstripped); CI's `db:check-drift` stays timestamp+count (CI strips pg_cron). a `migrations:"drift"` reading on **prod** was expected *pre-D5* (prod DB lagged the journal by design); post-D5 the prod DB is migrated to head, so a `drift` reading now is a **real failure** to investigate before promoting.

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
#    re-run on a seeded DB → "[seed-staging] Done — 0 new rows, 871 already present"
```

*(The count is **871**, not the 200 this line carried. `scripts/seed-staging.ts` seeds `COLOURS.length * ANIMALS.length` = 13 × 67 = 871, and the script's own header says so. ⚠ **A second lookalike sits in the same gate:** `scripts/smoke-staging.ts` item 8 `identity-pool-seeded` still passes only 100–300 rows, so on a correctly seeded staging DB that smoke item goes **RED**. That is a code finding, raised not fixed — this run does not touch `scripts/`.)*

Full reset (only if the sandbox is wedged): the ratified path is the **guarded reset**, not a hand-rolled schema drop — `pnpm staging:reset` (ADR-0035 + ADR-0036: owner-privilege disablement of the `_no_truncate` guards *only* → `TRUNCATE … CASCADE` → re-enable, issued as one implicit transaction behind the five-guard contract, then `db:seed:staging`; `drizzle.__drizzle_migrations` and `system_state` are never truncated), or `pnpm staging:rebuild` for the composite reset → seed → generate → gates. **Dropping the staging schema and re-running `db:migrate:staging` + `db:seed:staging` is ADR-0035's Option 2, explicitly rejected** — it leaves `drizzle.__drizzle_migrations` claiming every migration applied against an empty schema, and the two `pg_cron` schedules are declared with no `IF NOT EXISTS` and no un-schedule. Reach for it only if the guarded reset itself cannot run. ⛔ **And never `pnpm staging:rebuild` to "check something"** — it does not merely truncate the seeded markets, it replaces them with `sp-*` fixtures and reports green gates while doing it. There is no restore path; `docs/data/staging-markets-snapshot.md` is the only record of the eight hand-authored markets. The DB is disposable; never break-glass a sandbox.

> **Doppler config is `stg` (never `staging`).** *(The "some script headers still say `--config staging`" warning that stood here is removed at SYNC-1 — the defect was fixed and §4 has recorded it **✅ RESOLVED** since D3. Verified: `scripts/migrate-staging.ts:8` and `:42` both read `stg`. The warning had outlived its defect and contradicted §4 in the same file.)*

### 2.4 Operator toggle navigation  *(Vercel UI, web-confirmed 2026-06-26)*

- **Repoint the staging branch (one-time, D3):** Vercel → **Settings → Environments → [Staging custom env] → Branch Tracking** → change the match from `main` to `staging`. (It is a match *rule*; the `staging` branch need not exist yet when you set it.)
- **Disable Production auto-serve (one-time, D3):** Vercel → **Settings → Environments → Production → Branch Tracking** → toggle **OFF** "Auto-assign Custom Production Domains". Per Vercel's docs this affects only **future** pushes; it does **not** unassign the currently-live deployment's domain. **Do not trust the docs for this — prove it with an R2 before/after `/api/health` curl** (canary unchanged across the toggle; domain still serving).

### 2.5 Advance staging — the standing post-merge step

**No task owns this, which is exactly why it gets missed.** Advancing staging has never appeared in any build task's scope, plan, or kickoff, so skipping it fails nothing and reports nothing. By **2026-08-04** that had let **eight** merged commits accumulate on `main` un-deployed, with `origin/staging` still parked at the F-DEBATE-4 merge. Nothing was broken — staging was simply describing a `main` that no longer existed, which is worse, because it looks healthy. Treat this as a **standing step that runs after every merge to `main`**, owned by whoever merged.

**Preconditions — prove all three before you push.** Each answers a question the push itself cannot, and (c) decides whether this section applies at all.

```bash
git fetch origin --prune

# a. TREE IDENTITY — the merged tree is the one that passed review
git diff --stat <reviewed-sha> origin/main                    # → must be EMPTY

# b. FAST-FORWARDABILITY — staging holds nothing main lacks
git log --oneline origin/main..origin/staging                 # → must be EMPTY

# c. MIGRATION DELTA — is this a §2.5 advance or a §3 sequenced deploy?
git diff --stat <staging-sha>..origin/main -- drizzle/migrations/ src/db/
```

- **(a) Tree identity.** EMPTY proves the squash-merged tree is byte-identical to the branch that was reviewed. A squash merge can land a tree that is *not* the reviewed one — an un-pushed local commit on the source branch is enough to do it — and staging is the wrong place to discover that. Cheap to check, and it also confirms the merge you think you are advancing is the merge that happened.
- **(b) Fast-forwardability — and what a rejection actually means.** EMPTY means
staging carries no commit `main` lacks. ⚠ **A non-empty result is NOT by itself
evidence of divergence, and two weaker tests have already failed here.** This
precondition once said a rejected push means divergence; it then said a
**two-directional** `main..staging` diff means divergence. **Neither is true.** A
rejection follows from any non-ancestor relationship. A two-directional diff
follows whenever `main` has *modified* lines rather than only added them — the
ordinary shape of a documentation pass. Both mistake a symptom for the property.

**The property is: does content exist ONLY on `staging`?** Answer it directly,
against the last point `staging` was current with — normally `main`'s parent at
the merge you are advancing past:

```bash
git diff --shortstat <BASE_SHA> origin/staging       # deletions only, ZERO insertions ⇒ staging strictly BEHIND
git merge-base --is-ancestor <BASE_SHA> origin/main  # ⇒ and that base is inside main's history
```

**Both true ⇒ nothing exists only on `staging`, and the force-push in *The
staging advance* below loses nothing.** Either false ⇒ real content lives only on
`staging`: **stop and reconcile, never force.**

⚠ **Do not substitute a cheaper signal for that pair.** Commit counts cannot
separate the cases — 29 commits and 1 commit can encode an identical tree, and on
2026-08-18 they did. Direction counts cannot either — the same day `main..staging`
read 141 insertions against 3,381 deletions while `staging` held **zero** content
of its own. This is the shortest test that answers the actual question.
- **(c) Migration delta.** ⛔ **BOTH results continue in THIS section. A staging advance is §2.5 whether or not migrations are in the delta.** EMPTY → the migrate job will be a no-op. NOT EMPTY → it will apply DDL, and the **production** half of this deploy — whenever it is taken — is what §3 governs.
  ⚠ **This bullet used to route a migration-bearing staging advance to §3, and that was wrong.** **§3 is production-only**: every one of its steps is `--config prd`, `<staged-url>`, `vercel promote`, or `zugzwangworld.com`. A staging advance sent there finds no instruction it can execute, so the reader either improvises or stalls. **ADR-0024 settles it** — item 2 makes staging a git-auto-deploy sandbox that *"tolerates a migrate/deploy race"*, item 3 states *"Staging migrate = automatic GHA on push to `staging`"*, and migrate-before-serve is scoped to **production** at item 5. §0's topology table says the same thing in one word: staging's migrate path is `auto`. This file's header defers to the ADR on conflict, which is the authority this correction rests on. *(Corrected 2026-09-08 at LIQ-1-PROMOTE, where migrations `0027`–`0030` made (c) NOT EMPTY and the old wording sent a correct, healthy staging advance into a section with no staging step in it.)*
  **What (c) does NOT do is verify anything.** It sets the expectation *beforehand*; **the post-migrate check below is what confirms the outcome**, and it is a positive test against the database rather than a reading of the log.

> **An EMPTY result from (a), (b) or (c) is a REAL result — none of them can fail open.** Worth stating because the question comes up: if a ref does not resolve, `git log`/`git diff` **abort loudly** (`fatal: bad revision`, `fatal: ambiguous argument … unknown revision`) and print nothing to stdout. They cannot silently report "no commits" against a ref that is missing. The `git fetch origin --prune` above is what keeps the refs current; the checks themselves are safe.
>
> ⚠ **Do not "confirm the refs resolve" with `git rev-parse --short A B` — it takes ONE revision and fails on two VALID ones.** `git rev-parse --short HEAD HEAD` returns `fatal: Needed a single revision`. Read as a missing remote-tracking ref, that message will send you fetching, re-checking, and doubting three preconditions that were correct all along. **Verified at PERF-1 (2026-08-10), where exactly that happened and the advance was briefly reported as running on vacuous checks — it was not.** Use one rev per call, or drop `--short`.

**The advance sequence.**

```bash
# 1. Advance staging to the merged main — see *The staging advance* below; a
#    rejection here is usually BEHIND, not diverged, and force-with-lease is the
#    documented repair. Read the tree before deciding.
git push --force-with-lease origin origin/main:refs/heads/staging

# 2. Watch the migrate job (§2.1 reaction 1) → GREEN
gh run list --workflow=staging-migrate.yml --limit 1 \
  --json databaseId,status,conclusion,headSha
#    ↳ CONFIRM headSha == the SHA you just pushed, BEFORE trusting the verdict
gh run watch <run-id>

# 3. PRIMARY GATE — health (§1, §2.2)
curl -s https://staging.zugzwangworld.com/api/health | jq
```

**`--limit 1` can hand you a stale run.** It returns the most recent run of that workflow, which is not necessarily *yours* — a run still queueing, a concurrent push, or a re-run of an older commit all put a different run at the top. Confirm the run's `headSha` equals the SHA you just pushed before reading its conclusion as your verdict. The `canary` gate catches this class of mistake at the **health** layer; nothing catches it at the **run** layer except this check.

**Gate on `canary` == the merged SHA.** `canary` is the **bare 40-character commit SHA** — no `sha-` or `g` prefix, no short form, no `v`. Compare it verbatim against `git rev-parse origin/main`. A mismatch means the Vercel build has not finished or has not taken the alias yet: the step is **not** done, poll again. `env` must read `"staging"`; `db` and `migrations` must both read `"ok"`.

**What green looks like — and why the LOG cannot tell you what ran.** A no-op and a full DDL apply both end in `[✓] migrations applied successfully!`, both mark the job green, and ⛔ **both produce the same log.** `drizzle-kit migrate` does not echo the statements it executes, and `CREATE TABLE`, `CREATE FUNCTION` and `cron.schedule()` raise **no** NOTICE — only the `IF NOT EXISTS` bookkeeping does. **Log volume is not evidence. Do not infer success, or a no-op, from it.**

Against an already-initialised database the *Migrate staging DB* step emits exactly two idempotent NOTICEs on **every** run:

```
code: '42P06',  message: 'schema "drizzle" already exists, skipping'
code: '42P07',  message: 'relation "__drizzle_migrations" already exists, skipping'
```

**These are expected output, not errors.** Postgres is reporting that `CREATE SCHEMA IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` found their objects already present — drizzle's own bookkeeping, re-run. A first read mistakes them for failures because they arrive as structured error-shaped objects with a `severity` field; `severity: 'NOTICE'` is the tell. **They say nothing whatever about whether your migrations applied.**

⚠ **This paragraph used to say the opposite, and the opposite nearly halted a correct promote.** It read: *"If you see these two and nothing else, the run was a **no-op** and precondition (c) should have been EMPTY … **A mismatch between the two is the signal to stop and reconcile**."* On **2026-09-08** (LIQ-1-PROMOTE) a run carrying four migrations printed exactly those two NOTICEs and nothing else — the documented mismatch, which is to say the documented instruction to stop — while `0027`–`0030` had in fact applied: the `liquidity_policy` row that `0027` seeds carries `created_at 19:41:41.428Z`, inside that same step's 19:41:38–19:41:51 window. **A test that returns the same answer for both outcomes is not a test**, and this one returned *stop* for the healthy case.

#### The post-migrate check — positive, run AFTER migrate, against the target

Three probes. **1 and 2 always run. 3 runs when the migration names one.**

**1. Journal head == the highest file in `drizzle/migrations/`.** Read the head; never count entries.

```bash
ls drizzle/migrations/*.sql | sort | tail -1                       # highest file on disk
jq -r '.entries[-1].tag' drizzle/migrations/meta/_journal.json     # journal head
```

**2. Per-hash parity — every journal row's hash matches the file on disk.** This is *exactly* the comparison `/api/health` performs (§1: `"ok"` iff the applied-hash multiset equals the journal-hash multiset), so **`migrations:"ok"` from the health gate discharges this probe** and no separate command is owed. Recompute it locally only when you want it independent of the surface being gated:

```bash
# sha256 each drizzle/migrations/*.sql, compare the multiset against
# SELECT hash FROM drizzle.__drizzle_migrations — expect equal counts,
# zero MISSING (in journal, not applied) and zero EXTRA (applied, not in journal).
```

⚠ **Row `id`s are not a check.** They carry gaps from earlier resets; on 2026-09-08 staging held **31 rows with a maximum `id` of 36** and was perfectly correct. The multiset reconciles; the sequence does not have to.

**3. One existence probe per object-creating migration, named in that migration's own header.** ⛔ **A migration whose header names no probe carries no probe** — do not invent one, and do not fall back to reading the log. This is a convention for migrations written from 2026-09-08 onward; `drizzle/migrations/` is append-only, so the existing set cannot be retrofitted and none of them names one.

Worked example — what `0027_liquidity_injector_pg_cron`'s probe would say, taken from the LIQ-1-PROMOTE verification that proved it applied:

```sql
SELECT to_regclass('public.liquidity_policy') IS NOT NULL       AS table_exists;
SELECT count(*) = 3 AS functions_exist FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('zz_add_liquidity','run_liquidity_injection','check_liquidity_alarms');
SELECT count(*) = 2 AS crons_registered FROM cron.job
  WHERE jobname IN ('liquidity-injector','liquidity-alarms') AND active;
```

**Only then read the health gate.** The three probes above answer *did the objects land*; `/api/health` answers *does the DB match the committed set*. Neither substitutes for the other, and neither is the log.

**The health endpoint is the authority — not the migrate exit code.** `drizzle-kit migrate` can exit `0` with a migration unapplied (drizzle-orm #5769 — the silent high-water-mark skip), so a green `staging-migrate.yml` run is a **signal, not a verdict**. Only `migrations:"ok"` from `/api/health` proves the DB matches the committed set. This is the same rule §3 enforces at the production promote gate; staging earns no exemption from it for being resettable.

### The staging advance — the command, and why it is a force-push

`staging` is advanced to `main` by an operator-run force-push to a **pinned SHA**:

```bash
git fetch origin
git push --force-with-lease origin <MAIN_SHA>:refs/heads/staging
```

**Why force, when a fast-forward was the documented path.** Work has more than once been
committed directly onto `staging` and then squash-merged to `main`. The squash produces a
tree identical to the branch's and a SHA that is not its descendant, so `staging` ends up
holding N unsquashed commits that encode exactly what one commit on `main` encodes.
`git diff` between them is empty; `git log` between them is not. **A fast-forward is then
structurally impossible even though nothing has actually diverged**, and this has happened
three times (`DRIFT-1`, and again 2026-08-18).

`--force-with-lease` is the safety: it refuses if `staging` moved since the last fetch.

⚠ **Read CONTENT before forcing — never the log, never a direction count.** The
question is whether anything exists only on `staging`, and §2.5 (b) carries the
two-command test that answers it. A `main..staging` diff reads two-directional
whenever `main` modified lines rather than only adding them, even when `staging`
holds nothing of its own. **Run (b)'s test. Both legs true ⇒ the force-push loses
nothing. Either leg false ⇒ stop and reconcile, never force.**

⚠ **`O-10` applies to the SHA you force to.** Vercel dedups a SHA it has already built. If
`<MAIN_SHA>` already has a `READY` deployment on the `main` ref, forcing `staging` to it may
produce **no staging deployment at all**, leaving `staging.zugzwangworld.com` on the old
build while Staging Migrate reports green. **Prefer a SHA Vercel has never seen** — in
practice, force immediately after a merge that produced a fresh squash — and **verify the
alias afterwards by reading `/api/health`'s `canary`, not by trusting the workflow.**

**This is a manual runbook step, deliberately.** Automating it is correct and is not
experiment-phase work; the docket carries `STAGING-AUTO-ADVANCE` for after go-live.

---

## 3. Production — migrate-before-serve

> **STATUS: ACTIVE.** First exercised 2026-06-28 UTC at 61abb0485e5ec7b251426932704aabd09f367abf (D6). This is the live migrate-before-serve promote path; every production promote follows this sequence. Production is gated — `autoAssignCustomDomains` is OFF, so a `main` merge produces a **staged** build that does not serve `zugzwangworld.com` until this sequence completes and the build is manually promoted. **Governed by ADR-0024 item 5; do not weaken.**

### 3.0 What the staging smoke actually certifies — read before treating it as a gate

`pnpm smoke:staging` is used below as a promote gate. **State its reach honestly, because one of its items is a known lookalike — a control that reports success while asserting nothing (V-3).**

- ✅ **Reaches, and is trustworthy:** the `/api/health` canary assertions (bare 40-char SHA, optional `EXPECTED_SHA` exact match), `env`, `db`, and the per-hash `migrations` verdict. **This is the load-bearing part of the gate and it is sound** — it is what tells you the right SHA is serving against a migrated database.
- ❌ **Does NOT reach — item 9, `sentry-routing`.** This item **has never asserted anything**, for three independent reasons, each alone sufficient: (1) the route it triggers, `/api/_smoke-error`, **can never route** — the `_` prefix makes `src/app/api/_smoke-error/` a Next.js App Router *private folder*, excluded from routing, so the request 404s; (2) the item **skips** whenever `SENTRY_ORG` is unset, and `SENTRY_ORG` is absent from Doppler `stg`, so it has always skipped; (3) it asserts against the Sentry project `zugzwang-prod`, which **does not exist** — the org `zugzwang-foundation` contains only `zugzwang-staging` and `zugzwang-experiment`. Fixing any one leaves the other two.
- ⚠ **The consequence for this section:** **a green `smoke:staging` is not evidence that Sentry is ingesting events.** The server-side SDK's delivery status is still unverified. Do not read a green smoke as clearing that question, and do not promote on the assumption that an error in production would raise an alarm.
- **Do not "fix" this by loosening the gate.** The remedy is a real delivery assertion plus `SENTRY_ORG` in Doppler `stg` and the correct project slug — tracked in `docs/parked.md` (**POOL-2 — the Sentry routing smoke check is a lookalike, three times over**) and sequenced to HARDEN. The route rename alone is **not** sufficient and should not be done alone.

*Recorded at SYNC-1 (2026-08-08). §4 previously asserted the smoke was "once again a valid staging gate" without qualification, while `docs/parked.md` had already ruled item 9 vacuous and named this section's reliance on it as the blast radius. Two documents on the same `main`, disagreeing about whether a promote gate worked.*

### Why this exists (the load-bearing reason — read before executing)

The ledger is append-only and frozen-at-resolution. Production must **never** serve new code against an un-migrated database — there is no acceptable window where the app writes the ledger through a schema the DB hasn't applied. So production is **migrate-before-serve**: the database is migrated and *objectively verified* **before** the new build is allowed to take the `zugzwangworld.com` alias. The `drizzle-kit migrate` exit code is **not trusted** (drizzle-orm #5769 — a silent high-water-mark skip can exit `0` with a migration unapplied); the **per-hash `/api/health` result on the staged build is the only promote authority**. No `migrations:"ok"`, no promote.

### Preconditions (verified at the D5 pre-flight, 2026-06-27; re-confirm before each promote)

- **Auto-assign OFF.** Production → Branch Tracking → "Auto-assign Custom Production Domains" = **Disabled** (set in D3; confirm still off).
- **Prod env vars populated** in Doppler `prd` (→ synced to Vercel Production): `DATABASE_URL_PROD`, `PROD_PROJECT_REF_FRAGMENT`. *(D1 flagged both as not-yet-verified; confirmed present at the D5 pre-flight — the migrate guard refuses without them.)*
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
   - **Confirmed control (D6, 2026-06-28):** `vercel promote <staged-url> --scope <team-slug>` via CLI — an instant alias swap, byte-identical, no rebuild. **The `--scope` flag is required:** the bare `vercel promote <staged-url>` errors `Error: Deployment belongs to a different team`; pass the team slug (here `zugzwang-worlds-projects`). The dashboard **"Promote to Production"** action on the staged deployment is the equivalent alternative.
6. **Verify live:**
```
   curl https://zugzwangworld.com/api/health
```
   Require `migrations:"ok"`, `canary == «PROMOTE-SHA»`, serving `200`. The live alias now points at the migrated build.
7. **Promotion note (the log — ADR-0024 item 10).** Record: «PROMOTE-SHA» · who · when (UTC) · the per-hash `/api/health` result. GitHub deployment history is the rest of the log. *(⚠ ADR-0024 item 10 also reads *"Native Doppler↔Vercel sync is the documented escalation only — not built."* **That clause was overtaken by the ADR's own D1 errata 1**, which found the syncs live: `stg → Vercel Staging`, `stg → Vercel Preview`, `prd → Vercel Production`. Step 1's precondition above depends on that last one being In Sync, so this section previously contradicted itself. Read item 10's **log rule as standing** and its **sync clause as superseded**. **Consequence for this path:** never hand-edit a Vercel env var that a Doppler sync owns — the sync has no per-secret include/exclude filter, so a single key cannot be overridden under a sourced sync and an orphaned value is repopulated. Change it in Doppler, then redeploy: a Doppler change does not reach a running deployment on its own.)*

### Rollback

- **Migrate failed / health not `ok` (pre-promote):** do **not** promote. The prior deployment keeps serving, untouched. Fix the migrate; re-run from step 3. Nothing reached users.
- **Regression discovered after promote (post-serve):** re-promote the prior known-good deployment (instant alias swap, no rebuild). **Caveat:** a schema rolled *forward* is **not** auto-rolled-back — expand/contract is precisely what lets the prior code tolerate the already-applied schema. A destructive schema change is *not* safely reversible by alias swap, which is why every migration is additive-then-cleanup.

### NOT part of this path

- No reviewer-gated GHA migrate job — the prod write is a deliberate manual action by design (solo operator; a reviewer gate would be self-approval theatre — ADR-0024 driver 3).
- No migrate inside the Vercel `buildCommand` (stays plain `next build`; builds run repeatedly and can't gate prod).
- No Supabase branching; no auto-promote on merge.

---

## 4. Known stale references

The deploy tooling predated ADR-0024 item 7's bare-SHA canary and carried stale assertions/comments. The focused post-D3 canary chore fixed the load-bearing ones — **the canary assertions are sound and `pnpm smoke:staging` is a valid gate for what §3.0 says it reaches. It is NOT a Sentry gate.** See §3.0 before using it as one.

- **✅ RESOLVED — `scripts/smoke-staging.ts` (was SURPRISE-1, load-bearing):** the canary assertions (`:185` staging, `:202` preview) now validate a bare 40-char git SHA via `assertCanarySha`, with an optional `EXPECTED_SHA` exact-match (the "canary == pushed SHA" gate; full 40-char SHA only). The `health-preview` `env` assertion (`:199`) was also corrected `"preview" → "staging"` — Preview is `stg`-sourced post-D1, so staging-vs-preview is told apart by which URL is curled, not by env/canary.
- **✅ RESOLVED — `scripts/migrate-staging.ts:8` / `:42`** `--config staging` → `stg` (header comment + the runtime error message).
- **✅ RESOLVED — `docs/runbooks/staging-provisioning.md:157`** Appendix A: dropped `ZUGZWANG_ENV_CANARY=staging-...`; the route reads `VERCEL_GIT_COMMIT_SHA` for the canary.
- **✅ RESOLVED (closed at the SYNC sweep, 2026-07-07) — `scripts/seed-staging.ts:8` / `:48`** `--config staging` → `stg`. Already fixed by the post-D6 pipeline-reconciliation commit `b724094` (2026-06-28) before the sweep ran; the sweep verified zero `--config staging` matches remain anywhere under `scripts/` and closed this note — no code change was owed.

---

*Created at D3 (2026-06-26) per ADR-0024 item 2/3/7 (staging sandbox + canary) — §2 + §4 CC-authored from the live repo. §3 (prod-promote) is a web-authored section, finalized + first-exercised at D6 (2026-06-28). §2.5 (staging advance) was added at POLISH-1-DOCS and **first exercised 2026-08-04**; that run supplied its preconditions block, the run-selection check and the no-op-green note. §3.0 (what the staging smoke certifies) was added at **SYNC-1 (2026-08-08)**, reconciling §4's unqualified "valid staging gate" claim against the POOL-2 docket ruling; the §2.3 `--config staging` warning was removed in the same pass as resolved-since-D3. Maintained per `docs/maintenance.md`.*
