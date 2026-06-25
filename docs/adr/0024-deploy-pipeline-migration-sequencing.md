# ADR-0024 — Deploy Pipeline + Migration Sequencing (Staging-as-Prod-Replica)

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-06-25 |
| **Deciders** | Hrishikesh (operator) · web Claude (technical co-founder / author) |
| **Tracker task** | — (out-of-tracker infra task; outcomes fold into the next combined tracker sweep — regularize-later) |
| **Frame document** | ADR-0006 (Hosting Topology — parent; refined re two-project split); ADR-0022 (prod-apply path + drift guard — inherited; drift-comparison + health-env-var partially superseded); SPEC.2 §6 (migration set / append-only), §17 (Observability — drift surface), §21 (Operational Runbook Pointers), §22 (ADR Index); AGENTS.md §6 (Migrations) |
| **Supersedes** | ADR-0022 — **scoped:** the `/api/health` drift-comparison method (timestamp → per-hash, `src/server/health/migration-drift.ts` only) and the "health route reads only its two named env vars" line (adds `VERCEL_GIT_COMMIT_SHA`). ADR-0022's prod-apply path and its `db:check-drift` timestamp+count method are **inherited unchanged**. |
| **Superseded-by** | — |

---

## Context and Problem Statement

A read-only recon of the live infrastructure (GitHub `main` canonical for code; live Vercel/Supabase/Doppler canonical for infra) surfaced a cluster of coupled deploy defects. **ADR-0022 (2026-06-20) already resolved one half of that cluster** — the prod migration *apply* path (`scripts/migrate-prod.ts`, per-migration-transaction to avoid Postgres 55P04 on the enum-add→use case, guarded by `DATABASE_URL_PROD` + `PROD_PROJECT_REF_FRAGMENT`, kept a gated manual step) plus a schema-drift *guard* (`scripts/check-migration-drift.ts`, a `/api/health` status field, both comparing journal head vs DB head by timestamp+count). This ADR completes the pipeline *around* ADR-0022's primitives; it does not re-decide them.

What ADR-0022 deliberately did **not** decide, and what this ADR resolves:

- **No staging-as-replica topology.** ADR-0022 references staging operationally (its script mirrors `migrate-staging.ts`; `db:check-drift` targets "staging via `stg`") but ratifies no replica environment. Meanwhile the live staging Vercel custom env (`branchMatcher equals main`, domain `staging.zugzwangworld.com`) is **shadowed** — `main` is owned by Production, so staging never git-auto-deploys and is current only via manual CLI deploys. Staging is not reliably a replica of anything.
- **No promote flow.** ADR-0022 rejected build-coupled migrate-on-deploy and kept prod-apply manual, but said nothing about *how* a build reaches prod safely. Production "Auto-assign Custom Production Domains" is ON, so a push to `main` auto-serves before any migrate gate.
- **No preview-DB binding.** Neither ADR-0022 nor ADR-0023 mentions the preview environment; previews are (indirectly confirmed) bound to the **prod** database.
- **A drift detector that's blind to the failure it most needs to catch — on the one surface where it can afford the stronger check.** ADR-0022 chose timestamp+count for a *correct* reason: `db:check-drift` runs **in CI directly**, and CI strips `pg_cron` from `*pg_cron*.sql` (its Postgres lacks the extension), so a per-hash comparison false-positives in CI (stripped-file hash ≠ committed-file hash for migrations 0007/0011). But drizzle-orm #5769 documents a silent high-water-mark migration **skip** where `migrate` exits `0` while a migration is not applied — a timestamp/count check at head-granularity catches "stopped short" but not a same-timestamp content divergence. The `/api/health` surface runs **only in deployed environments** (prod/staging/preview — all with pg_cron, all unstripped), so it can carry the stronger per-hash check with no CI exposure. ADR-0022 applied one method uniformly; this ADR splits the surfaces.
- **Manual, drift-prone secrets; an ungated `main`.** No native Doppler↔Vercel sync (all Vercel env manual); CI is PR-gated but **not** a required status check on `main`, and `drizzle-kit check` runs nowhere.

Why now: the Experiment goes live 2026-09-15. A prediction market whose thesis is **append-only, frozen-at-resolution** cannot ship where prod silently lags the code that writes its ledger and the deployed drift signal cannot prove otherwise.

This ADR does **not** decide:

- **The prod migration *apply* strategy** — `migrate-prod.ts`, per-migration-transaction, the env-fragment guard, the human gate, the runbook. **ADR-0022, inherited unchanged.** This ADR consumes that path as the migrate step of the promote sequence.
- **The `db:check-drift` CLI comparison method** — stays ADR-0022's **timestamp+count** (it runs in CI against the stripped DB; per-hash would false-positive there). This ADR changes only the `/api/health` surface to per-hash. The two surfaces diverge intentionally.
- **Hosting vendors, region, cron engine, cost tiers** — ADR-0006. This ADR *refines* §two-project below; it does not re-decide the vendor topology.
- **Schema/migration content** (each migration owns its DDL; ADR-0005 / SPEC.2 §6) and **RLS** (ADR-0019, unaffected — no client-direct DB path added).

## Decision Drivers

1. **Append-only + frozen-at-resolution makes prod migrate-before-serve non-negotiable.** No acceptable window where new code serves against an un-migrated prod DB.
2. **drizzle-orm #5769: migrate exit codes are not trustworthy.** The pass/fail signal for a *deployed* DB must be content-level (per-hash). Because per-hash false-positives under CI's pg_cron stripping (ADR-0022), it belongs only on a surface that never runs in CI — `/api/health`.
3. **Solo operator, no second approver.** The prod write cannot hide behind a reviewer-gated GHA approval (self-approval theatre); it must be a deliberate manual action — as ADR-0022 already ruled and this ADR preserves.
4. **Experiment-capacity only; time locked, scope flexes.** Smallest reliable thing. No blue-green, k8s, multi-region, progressive rollout, or release-orchestration tooling. Dispensable at close (2026-11-08 archive).
5. **A correct posture must survive future change.** Record the decisions and their escape hatches so a later edit can't silently reopen the drift.
6. **Two environments, one source of migration truth.** Staging and prod run the *same committed* Drizzle migrations with no schema fork, so "passed on staging" is evidence about prod.

## Considered Options

1. **Hybrid: `staging`-branch sandbox + staged-production-promote on `main`, two standing Supabase projects, ADR-0022's gated-manual prod migrate, per-hash drift on `/api/health` only.** ← chosen
2. **Single-environment + careful manual prod deploys** (no real staging).
3. **Full auto-promote** (push to `main` → auto-migrate prod → auto-deploy, reviewer-gated GHA migrate).
4. **Supabase branching** for staging/preview DBs.

## Decision Outcome

**Chosen: Option 1 — Hybrid pipeline built around ADR-0022's prod-apply primitives.** Each item is marked **[inherited]**, **[minted]**, or **[supersedes-0022]**.

1. **Two standing Supabase projects, same committed migrations. [minted — refines ADR-0006]** Staging (`rwfdoqzsghqhhdapxafg`) and production (`zbvprdcyxhlguxbostdj`), both `ap-south-1`, both running the single mixed-origin Drizzle migration set (ADR-0008). **No Supabase branching.** ADR-0006 ratified the vendor topology and single region but not the staging/prod project split; this ADR names it. *(Commit-time check: confirm ADR-0006 does not already ratify a two-project split; if it does, change this item from "mints" to "inherits from ADR-0006.")*
2. **Staging is a git-auto-deploy sandbox. [minted]** The staging custom Vercel env is repointed from `main` to a `staging` branch (`branchMatcher equals staging`), un-shadowing the matcher. Staging data = **seed scripts** (no clone). Staging **tolerates a migrate/deploy race** — it is a resettable sandbox.
3. **Staging migrate = automatic GHA on push to `staging`. [minted]** A GitHub Actions job runs `pnpm db:migrate:staging` (already guarded) on every push to `staging`. Migrations run in **GHA, never in the Vercel `buildCommand`** (`buildCommand` stays plain `next build`).
4. **Previews point at the staging DB. [minted]** Preview deployments (feature-branch UI review) bind to the staging database; schema-correctness for those branches is covered by **CI's ephemeral Postgres**, not the preview DB. **Accepted consequence:** when a feature branch's migrations lag the `staging` branch's head, a preview URL may render the drift state — cosmetic-only (UI-review surface). **Documented escape hatch (not built):** a dedicated throwaway preview DB, adopted *only if* head-collisions disrupt the sandbox.
5. **Production is strictly migrate-before-serve. [minted, consuming ADR-0022's apply path]** Production "Auto-assign Custom Production Domains" is **disabled**, so a push to `main` yields a staged build that does not auto-serve. The promote sequence: **merge → staged build → gated-manual `doppler run --config prd -- pnpm db:migrate:prod` (ADR-0022) → verify the *staged build's* `/api/health` reports `migrations: ok` against the now-migrated prod DB → promote.** The prod migrate and the promote are the **single execution-time human checkpoint**; it is **not** a reviewer-gated GHA job (driver 3).
6. **Per-hash drift on `/api/health` only. [supersedes-0022, scoped]** `src/server/health/migration-drift.ts` is rewritten from timestamp to a per-hash `readMigrationFiles()` vs `__drizzle_migrations` comparison (`ok` iff the applied-hash multiset equals the journal-hash multiset). **`scripts/check-migration-drift.ts` is NOT changed** — it stays ADR-0022's timestamp+count, because it runs in CI against the stripped DB. **Safety rationale:** `/api/health` runs only in deployed envs (pg_cron present → unstripped → clean); it structurally never sees a stripped DB, so ADR-0022's CI false-positive cannot arise. The detector is a **pure hash-multiset compare with no `CI`/pg_cron conditional** — its safety is *operational* (the surface never runs in CI), and that constraint is recorded here. After any prod migrate, the migrate exit code is **not** trusted (#5769); the per-hash `/api/health` result is the authority, and no promote happens without per-hash `ok`.
7. **`/api/health` canary → `VERCEL_GIT_COMMIT_SHA`. [supersedes-0022, scoped]** The canary field is re-sourced from the static env-canary to the Vercel-injected `VERCEL_GIT_COMMIT_SHA` (a system var, not a secret), so a curl of `/api/health` names the exact commit a deployment is serving — relaxing ADR-0022's "reads only its two named env vars" line. This is what makes the promotion note's "which SHA is live" verifiable.
8. **Pooler + `prepare:false`. [minted]** All envs connect via the session pooler on `:5432`; the runtime client (`src/db/index.ts`) gets `prepare: false` as a defensive measure (safe on 5432; forward-safe if a transaction pooler is ever introduced).
9. **CI becomes a required status check on `main`; `drizzle-kit check` + env audit join CI. [minted]** CI is made a **required status check** on `main`; required-reviews stay **0** (solo operator). `drizzle-kit check` (journal integrity) and `scripts/vercel-env-audit.ts` (Doppler↔Vercel secret drift) are added to CI. If ADR-0022's `db:check-drift`-as-CI-step is specified-but-not-yet-wired, D2 wires it **on its existing timestamp+count method** (CI-safe).
10. **The log = GitHub deployment history + a lightweight promotion note. [minted]** Each promote records SHA, who, when, and the per-hash `/api/health` result. Native Doppler↔Vercel sync is the documented **escalation only**, not built.

**Expand/contract for all schema changes.** Because prod is migrate-before-serve and old/new code briefly coexist during a promote, every schema change is additive-then-cleanup, never a destructive rewrite the currently-serving code cannot tolerate. (Consistent with ADR-0022's append-only migration discipline.)

### Single-source-of-truth file map

| Concern | Source-of-truth file | Disposition |
|---|---|---|
| Per-hash drift on `/api/health` | `src/server/health/migration-drift.ts` | **supersedes-0022** (timestamp → per-hash) |
| `/api/health` canary field | `src/app/api/health/route.ts` | **supersedes-0022** (env-canary → `VERCEL_GIT_COMMIT_SHA`) |
| Drift CLI (timestamp+count, CI-safe) | `scripts/check-migration-drift.ts` | **inherited-0022, unchanged** |
| Prod apply path (per-migration-tx + guard) | `scripts/migrate-prod.ts` | **inherited-0022, unchanged** |
| Runtime DB client (`prepare:false`) | `src/db/index.ts` | minted |
| Staging migrate automation | `.github/workflows/` (new staging-migrate job) | minted |
| CI gate (required check + `drizzle-kit check` + env audit) | `.github/workflows/ci.yml` | minted |
| Doppler↔Vercel secret audit | `scripts/vercel-env-audit.ts` | minted (added to CI) |
| Vercel build contract (no migrate in build) | `vercel.json` | minted (confirm) |
| Pipeline runbook | `docs/runbooks/deploy-pipeline.md` (new; or extend the existing `staging-provisioning.md` per ADR-0022's runbook pointer) | minted |

*Paths are execute-time targets; CC confirms each against the live repo before writing.*

## Consequences

### Positive

- The drift **class** is closed: prod has an apply path (ADR-0022) reached through a safe promote gate (this ADR); the deployed drift signal can now see #5769-class skips on real DBs via per-hash `/api/health`; CI gains journal-integrity + secret-drift gates.
- "Passed on staging" becomes real evidence about prod: same committed migrations, two plain projects, no schema fork.
- The one irreversible action (the live prod write) is isolated to a single deliberate human step with an objective per-hash go/no-go.
- ADR-0022's CI-safety is **preserved** — the CI surface (`check-drift`) is untouched; per-hash lives only where it can never hit a stripped DB.

### Negative

- **Two drift surfaces use different methods** (per-hash on `/api/health`, timestamp+count on `check-drift`). *Acceptable because:* the split is driven by where each surface runs — `/api/health` is real-env-only (can afford per-hash), `check-drift` runs in CI (must stay CI-safe). Each carries the strongest check valid for its runtime context; the ADR records why.
- **Previews can intermittently show the drift state by design.** *Mitigated by:* UI-review surface only; schema-correctness lives in CI; the dedicated-preview-DB escape hatch is documented.
- **The prod write is a manual step that can be forgotten/fat-fingered.** *Mitigated by:* migrate-before-serve + per-hash-`ok` gate blocks a forgotten/failed migrate from promoting; the promotion note creates an audit trail.
- **`prepare:false` is correct only while the pooler stays on session mode `:5432`.** *Acceptable because:* a pooler-mode change is itself a deliberate infra change that would revisit this; the flag is harmless on 5432.
- **Manual secrets remain a drift surface.** *Mitigated by:* the CI env audit fails the build on Doppler↔Vercel divergence; native sync is the recorded escalation.
- **Two standing Supabase projects cost more than one.** *Acceptable* within ADR-0006's tiers for a fixed-duration experiment; both dispensable at close.

### Neutral

- Deliberately disposable: targets the Experiment only; expected to be re-decided (not extended) at testnet.
- Intentionally **not** in the tracker; outcomes regularize into the next combined sweep. The tracker is untouched.

## Pros and Cons of the Options

### Option 1 — Hybrid around ADR-0022's primitives (chosen)

**Pros** — real staging replica with no clone; isolates the irreversible action behind a per-hash-verified manual gate; reuses ADR-0022's apply path; smallest reliable surface; preserves CI-safety by scoping per-hash to `/api/health`.

**Cons** — preview surfaces can show drift cosmetically; two drift methods; manual prod step. All mitigated above.

### Option 2 — Single-environment + careful manual deploys

**Pros** — least infrastructure.
**Cons** — no place to exercise a change before prod; "careful" is not a control; leaves the drift class open. **Verdict:** Rejected — fails drivers 1 and 5.

### Option 3 — Full auto-promote with reviewer-gated GHA migrate

**Pros** — hands-off.
**Cons** — the reviewer gate is self-approval for a solo operator; auto-migrate-then-serve risks serving a half-applied schema if the gate is trusted over per-hash. **Verdict:** Rejected — directly contradicts ADR-0022's deliberate human-gate decision and driver 3.

### Option 4 — Supabase branching

**Pros** — vendor-managed ephemeral DBs.
**Cons** — a second migration-application path alongside the committed Drizzle set, breaking single-source-of-migration-truth (driver 6) and the per-hash check's assumptions; new vendor surface to trust for the load-bearing safety property. **Verdict:** Rejected.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| ADR-0022 | Prod-apply path + drift guard | **Inherits** the apply path (`migrate-prod.ts`, per-migration-tx, env-fragment guard, human gate, runbook) unchanged; consumes it as the promote sequence's migrate step. **Partially supersedes** the drift-comparison method for `/api/health` (timestamp → per-hash, `migration-drift.ts` only) and the "health reads only two named env vars" line (adds `VERCEL_GIT_COMMIT_SHA`). `check-drift`'s timestamp+count method **stands** (CI-safe). |
| ADR-0006 | Hosting topology (vendors, single region) | **Refines.** Names the two-Supabase-project staging/prod split, the staging-branch auto-deploy + staged-prod-promote flow, and disables Production auto-assign-custom-domains. Vendors, region, cron split, cost tiers unchanged. |
| ADR-0008 | Single mixed-origin migration set; client at `src/db/index.ts` | **Consumes.** Both envs run the same set; `prepare:false` added to the client; `drizzle-kit check` added to CI. |
| ADR-0005 / SPEC.2 §6 | Event-sourced schema; append-only enforcement | **Consumes.** Migrate-before-serve protects the ledger writes the triggers guard; expand/contract mandated. |
| SPEC.2 §17 | Observability — drift surface | **Shapes.** `/api/health` drift rewritten to per-hash + `VERCEL_GIT_COMMIT_SHA`; vendor set/alarm catalogue unchanged. |
| SPEC.2 §21 | Operational Runbook Pointers | **Shapes.** Adds the deploy-pipeline promote sequence to the runbook surface. |
| ADR-0019 | RLS out of scope (server-only) | **Unaffected.** No client-direct DB path added. |
| drizzle-orm #5769 | Silent high-water-mark skip | **Consumes (load-bearing).** Migrate exit codes not trusted; per-hash `/api/health` is the promote authority. |
| SPEC.2 §22 | ADR Index | **Mints** an ADR-0024 row + an ADR-0022 partial-supersession annotation (committed same-commit, per §22.4 / SPEC.2 §0 versioning). |
| Tracker | — | **None.** Out-of-tracker; folds into the next sweep. |

## More Information

- ADR-0022 — prod-apply path + drift guard (inherited; partially superseded for `/api/health`). Its timestamp choice for `check-drift` is correct and retained: `check-drift` runs in CI against the pg_cron-stripped DB, where per-hash would false-positive.
- ADR-0006 — hosting topology (parent; refined re two-project split).
- ADR-0008 / SPEC.2 §6 — migration-set discipline + client location.
- drizzle-orm #5769 — silent high-water-mark migration skip (why per-hash is load-bearing on deployed DBs).
- `ci.yml` pg_cron strip (`sed` over `*pg_cron*.sql` before `drizzle-kit migrate`) — the mechanism that makes per-hash CI-unsafe and confines it to `/api/health`.
- Recon snapshot (read-only, 2026-06-25) — prod head `0005` vs journal `0018`; shadowed staging matcher; previews indirectly bound to prod (operator value-confirm pending); timestamp drift on both surfaces.

---

*ADR-0024 ratifies the Experiment-phase deploy pipeline built **around** ADR-0022's primitives: a resettable `staging`-branch sandbox (own Supabase project, seed data, GHA-auto-migrated on push) plus a deliberate staged-production-promote on `main` (auto-assign-domains disabled; merge → staged build → gated-manual `db:migrate:prod` per ADR-0022 → verify the staged build's `/api/health` reports per-hash `migrations: ok` → promote), both environments running the same committed Drizzle migration set with no Supabase branching. It **inherits** ADR-0022's prod-apply path and `check-drift` timestamp+count method unchanged, and **partially supersedes** ADR-0022 only on the `/api/health` surface — rewriting its drift check to per-hash (`readMigrationFiles` vs `__drizzle_migrations`) and its canary to `VERCEL_GIT_COMMIT_SHA`. Per-hash is confined to `/api/health` precisely because that surface runs only in deployed (pg_cron, unstripped) environments and never in CI, so ADR-0022's CI false-positive cannot arise. The prod write is the single human checkpoint; migrate exit codes are not trusted (#5769) and per-hash `/api/health` is the promote authority. CI is made a required check on `main` (required-reviews 0) and gains `drizzle-kit check` + the env audit. This refines ADR-0006 (two-project split) and does not touch RLS (ADR-0019). The primitives in §Decision Outcome are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
