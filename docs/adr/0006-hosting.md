# ADR-0006 — Hosting Topology (Vercel + Supabase + Upstash + Cloudflare R2, Mumbai single-region, pg_cron + Vercel Cron hybrid)

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-05-05 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | SPEC.6 |
| **Frame document** | SPEC.2 §1.4 #5 (delegation), §4 (System Context), §22 (Operational Runbook Pointers), §23 (ADR Index) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

The Zugzwang experiment-phase build runs from 2026-04-24 (build start) through 2026-09-15 (launch) to 2026-11-08 (conclusion at Devcon 8 / ETHGlobal Mumbai). The build is owned by one developer with two support devs and Claude Code; scope freezes at launch and the codebase reaches end-of-life at conclusion. The hosting topology must be locked before SCAFFOLD.* tasks can begin provisioning environments.

ADR-0003 ratified Next.js 16 on the Node.js runtime as the framework. ADR-0004 ratified Better Auth on a locked vendor stack that named Google Identity Services, Resend, Cloudflare Turnstile, and Postgres-on-Supabase. ADR-0005 ratified Postgres + event-sourced schema (Pattern A) but explicitly deferred the Postgres major-version pin, hosting vendor, region, PITR retention, and `pg_cron` topology to this ADR.

`CLAUDE.md` rows 316 (Postgres 17), 317 (event-sourced schema), 318 (Supabase as DB provider), 325 (Cloudflare R2), 328 (Upstash Redis), and 329 (Vercel) name the answer at the locked-decision level; SPEC.2 §1.4 #5 explicitly delegates the substance to this ADR. SPEC.2 §4 (System Context) and §22 (Operational Runbook Pointers) are stubs at v0.1-outline that depend on this ADR for substance.

Following SPEC.1 v1.1.0-draft (2026-05-05), the K_eff dashboard is removed from v1 surfaces. The ADR-0005 sync/async classification rule still stands but v1 has **zero async read-model consumers** — the cron job inventory is therefore narrower than the tracker SPEC.6 description originally implied. This ADR ratifies the corrected inventory.

This ADR does **not** decide:

- Authentication library or admin auth wiring → ADR-0004 (SPEC.4), ADR-0010 (SPEC.11)
- Postgres schema, append-only triggers, partitioning details → ADR-0005 (SPEC.5)
- ORM choice and migration tooling → ADR-0008 (SPEC.9)
- Concurrency model and bet-transaction shape → ADR-0013 (SPEC.14)
- Pre-commit moderation flow → ADR-0014 (SPEC.15)
- Rate-limit and idempotency contract → ADR-0015 (SPEC.16)
- Observability vendor configuration (Sentry / PostHog / Axiom) → ADR-0007 (SPEC.7)
- Specific cron schedule values (cron syntax, cadences) → `HARDEN.*` task outputs
- R2 bucket policy specifics (CORS, signed URL TTLs, object-key conventions) → SCAFFOLD.15
- Backup verification drill / disaster-recovery runbook → HARDEN.9
- Cloudflare Turnstile vendor configuration → SPEC.2 §19 / ADR-0004 (already covered)

## Decision Drivers

1. **Build-window stability through hard end-of-life.** The build runs May 2026 → Nov 2026; codebase archives at conclusion. Every vendor chosen must remain on a stable plan with no announced major-version migration in the window. No part of the topology can be dependent on an alpha or "preview" tier.

2. **Solo-developer + Claude Code workflow.** The vendor surface chosen must have the deepest agent-training-data footprint and the cleanest dashboard-and-CLI ergonomics — every operational task is one developer plus Claude Code.

3. **Cost ceiling for a 7-week live window.** Experiment-phase economics: ≤5k concurrent target (HARDEN.4), zero advertising spend, no revenue. Vendor cost must stay in low triple digits per month at peak; aggressive free / hobby tier usage during build window; Pro tiers only when launch volume requires.

4. **ADR-0003 runtime constraint.** Server Actions and route handlers under `src/server/{bets,comments,dharma,resolution}/` MUST run on Node.js runtime, not Edge runtime. The web-tier vendor chosen must support Node.js runtime as a per-route default.

5. **ADR-0005 multi-table ACID + pg_cron requirement.** The DB must be managed Postgres on a major version that supports `pg_cron` and supports `REFRESH MATERIALIZED VIEW CONCURRENTLY` if any future async target is added (none in v1). The vendor must permit installing the `pg_cron` extension at the Pro plan tier.

6. **Cron topology must be principled, not reflexive.** v1 has four cadenced operational jobs (drift detection, partition-overrun monitoring, R2 orphan sweep, identity-pool low-watermark check). Three are SQL-only; one (R2 orphan sweep) requires HTTP fanout to Cloudflare R2. The topology must use each cadence engine where it is structurally strongest, not pick one for ideological consistency.

7. **Latency for the admin path and the conclusion event.** Admin (Hrishikesh) operates from Mumbai. The conclusion event is at Devcon 8 (Mumbai) and ETHGlobal Mumbai. Region selection minimizes latency on these two paths. Audience is global but ≤5k concurrent — origin-latency-vs-CDN-edge tradeoff is small at this scale.

8. **Failure-domain co-location vs cross-vendor blast radius.** A coherent single-region story across all four vendors is operationally simpler than a multi-region setup, and the testnet phase is the natural place to revisit multi-region architecture. v1 single-region is acceptable because the experiment is read-mostly with a hard end date — a regional outage during the live window is a recoverable narrative event, not a failed experiment.

9. **AGPL-compatible licensing.** All four chosen vendor SaaS surfaces impose no obligations on Zugzwang's AGPL-3.0 redistribution per ADR-0001.

## Considered Options

1. **Vercel (Pro, `bom1`) + Supabase (Pro, `ap-south-1`) + Upstash Redis (`ap-south-1`) + Cloudflare R2 (jurisdiction APAC); pg_cron primary + Vercel Cron carve-out** ← chosen
2. Self-hosted single-VM on Hetzner / DigitalOcean / Linode (Postgres + Caddy + Node + Redis on one box)
3. AWS-native (Lambda + RDS Postgres + ElastiCache Redis + S3 + EventBridge)
4. Vercel platform single-vendor (Vercel + Vercel Postgres + Vercel KV + Vercel Blob)
5. Fly.io / Railway managed-platform (Postgres on platform, app + workers on platform)

## Decision Outcome

**Chosen: Option 1 — Vercel (Pro, `bom1`) + Supabase (Pro, `ap-south-1`) + Upstash Redis (`ap-south-1`) + Cloudflare R2 (jurisdiction APAC); pg_cron primary + Vercel Cron carve-out for R2 orphan sweep.**

This ADR ratifies nine primitives plus one hard discipline.

### 1. Web tier — Vercel Pro, region `bom1`

Vercel Pro plan, single project, primary region `bom1` (Mumbai). Next.js 16 App Router on Node.js runtime (per ADR-0003). Auto-scaling serverless; no separate worker tier. Preview deploys per pull request (per SCAFFOLD.8); production at `zugzwangworld.com`; staging at `staging.zugzwangworld.com` (per SCAFFOLD.12).

Vercel Pro is selected over Hobby because: (a) preview-deploy environment-variable separation requires Pro for per-environment secrets, (b) `bom1` deployment requires Pro, (c) team-account features are not strictly needed in v1 but the cost delta is negligible.

### 2. Database — Supabase Pro, Postgres 17, region `ap-south-1`, 7-day PITR

Supabase Pro plan, single Postgres 17 instance, region `ap-south-1` (Mumbai). Compute add-on at the Small tier (1 GB RAM, 2 vCPU shared) — sufficient for the ≤5k concurrent target per HARDEN.4 at launch. Point-in-time recovery enabled with **7-day retention window** (Supabase Pro default). 30-day PITR is rejected for v1 — the public dataset release on 2026-11-06 captures the full historical record from the `events` log; 7-day covers the realistic "rollback yesterday's bad write" use case for the live window.

**Upgrade path (pre-authorized, traction-gated).** Compute Medium tier (4 GB RAM, dedicated 2 vCPU, ~$60/mo add-on) is pre-authorized as an operational upgrade per §"Cost ceiling"; engaged by Hrishikesh's call when bet-handler p95 latency, Postgres CPU sustained load, or product traction warrant. The bet handler runs Postgres SERIALIZABLE with `SELECT FOR UPDATE` on the pool row (per ADR-0013); under contention this is exactly the workload where shared compute starves and dedicated compute does not — Medium materially reduces bet-flow p95 during launch-night surge or hot-market contention. PITR 14-day retention (~$50/mo add-on) is pre-authorized on the same terms. Engaging either is operational, not architectural — no re-ADR required.

Postgres major version is **17**, ratifying CLAUDE.md row 316. `pg_cron` extension installed at provision time. The `pg_net` extension is **not** installed in v1 — see primitive 6 (cron topology) for rationale.

### 3. Cache + rate-limiter — Upstash Redis, region `ap-south-1`

Upstash Redis, pay-as-you-go pricing model at launch, primary region `ap-south-1` (Mumbai). Used for: per-surface rate-limit token buckets (per ADR-0015 / SCAFFOLD.4), idempotency-key store with 24-hour TTL (per ADR-0015), pre-commit moderation 10-second intent-reservation key (per ADR-0014), and the lightweight job queue for the K2 brand-account propagation, Resend retry, and identity-pool low-watermark alerts (per SCAFFOLD.4). No persistent application data — Redis is treated as ephemeral.

**Upgrade path (pre-authorized, traction-gated).** Pro fixed-instance tier (~$60–80/mo) is pre-authorized as an operational upgrade per §"Cost ceiling"; engaged by Hrishikesh's call when Redis p99 latency, rate-limit-check timeouts in Sentry, pre-commit moderation reservation timeouts, or product traction warrant. Pay-as-you-go runs on Upstash's shared global backend with wobbly p99; Pro provides a dedicated instance with tighter p99 directly affecting the bet-flow critical path (rate-limit check + idempotency lookup + moderation reservation all sit in front of every bet). Engaging is operational, not architectural — no re-ADR required.

### 4. Object storage — Cloudflare R2, jurisdiction `APAC`

Cloudflare R2, account-level jurisdiction set to `APAC`. Two buckets:

- `zugzwang-uploads` — image attachments per F-COMMENT-3 (per SCAFFOLD.15)
- `zugzwang-pfp` — identity-pool PFPs per F-AUTH-3 (per SCAFFOLD.15)

Direct-to-R2 upload pattern: server endpoint mints time-bounded signed-PUT URLs scoped per upload; browser uploads directly to R2 (server bypassed for file bytes per CLAUDE.md row 325 and K3). Bucket-policy specifics (CORS rules, signed URL TTL values, object-key conventions) are SCAFFOLD.15's territory and are not pinned here.

R2 egress is free (Cloudflare's flat pricing model). Storage cost at experiment scale is dominated by the identity-pool PFPs (5,000–10,000 images per SCAFFOLD.17) at low single-digit GB total — well under the cost ceiling.

### 5. Edge / DNS / WAF surface — Vercel Edge Network only; Cloudflare in DNS-only mode

The web-tier edge is Vercel's own edge network. **Cloudflare is engaged for three purposes only:** (a) authoritative DNS for `zugzwangworld.com` (per SCAFFOLD.12), (b) Turnstile CAPTCHA on the email-OTP path (per ADR-0004 / SPEC.1 §13), (c) R2 object storage (primitive 4). **Cloudflare is NOT engaged as a CDN proxy / WAF in front of Vercel.** Cloudflare DNS is configured in DNS-only ("grey-cloud") mode for the apex hostname and the `staging` subdomain.

Putting Cloudflare's CDN proxy in front of Vercel is rejected for v1 because: (a) Vercel's edge network already provides global CDN coverage and DDoS protection at the level required for a ≤5k-concurrent experiment, (b) two-layer edge (Cloudflare → Vercel → origin) doubles failure-domain blast radius for marginal latency gain at experiment scale, (c) origin-cert pinning between two CDNs adds operational overhead for the solo developer that is not justified pre-launch. If the live window surfaces a real DDoS pattern that Vercel's edge cannot absorb, engaging Cloudflare proxy is a same-day flip (DNS-only → orange-cloud) — the option is preserved without ratifying it now.

### 6. Cron topology — pg_cron is the default cadence engine; Vercel Cron is engaged ONLY for HTTP-fanout to non-Postgres services

`pg_cron` extension is the default cadence engine for periodic operational jobs. Job definitions ship as a hand-written raw SQL migration in the Drizzle migration set: single source of truth `drizzle/migrations/<NNNN>_pg_cron_jobs.sql`.

**Vercel Cron is engaged ONLY when a job requires HTTP fanout to a non-Postgres service** and the fanout is structurally inappropriate for `pg_cron` to issue from inside the database. In v1, exactly one job meets this criterion: R2 orphan sweep (it must call Cloudflare R2's HTTP API to delete orphaned objects). Vercel Cron entries live in `vercel.json` under `crons`; they hit protected `/api/cron/*` route handlers.

Vercel Cron is **rejected as a general scheduler** because: (a) the K_eff materialised view refresh that previously justified a marquee cron job is removed per SPEC.1 v1.1.0-draft, (b) the three remaining SQL-only jobs (drift detection, partition-overrun monitoring, identity-pool low-watermark check) are Postgres-internal and have no reason to leave the database to be scheduled, (c) Vercel-Cron-to-route-handler-to-DB introduces a vendor-cross-boundary scheduling layer where pg_cron has none, (d) for SQL-only jobs, pg_cron's failure mode is contained to the database (visible in `cron.job_run_details`) whereas Vercel Cron's failure mode crosses two vendors.

The `pg_net` extension (Postgres-side HTTP) is **not** installed in v1. Routing the R2 orphan sweep through Vercel Cron is the alternative — pg_net's reliability profile and PL/pgSQL error handling are operational liabilities the solo developer should not absorb in a 7-week live window.

### 7. Cron job inventory (v1)

Four cadenced jobs ship in v1. Specific cadence values (cron syntax) are deferred to `HARDEN.*` task outputs; this ADR ratifies the engine, the job, and the source-of-truth file.

| Job | Engine | Source of truth | Note |
|---|---|---|---|
| Position-vs-ledger drift detection | `pg_cron` | `drizzle/migrations/<NNNN>_pg_cron_jobs.sql` | Per ENGINE.11. Nightly comparison between `positions` table and full ledger replay; alert on mismatch. |
| Partition-overrun monitoring | `pg_cron` | `drizzle/migrations/<NNNN>_pg_cron_jobs.sql` | Per ADR-0005 §18 mint. Alarm if any row lands in the `events` DEFAULT partition. |
| Identity-pool low-watermark check | `pg_cron` | `drizzle/migrations/<NNNN>_pg_cron_jobs.sql` | Per SCAFFOLD.4. Alert when unassigned `identity_pool` count drops below threshold (5% per SPEC.1 §15.2 widget #2). |
| R2 orphan sweep | Vercel Cron | `vercel.json` `crons[]` + `/api/cron/r2-orphan-sweep` | Per SCAFFOLD.15. Deletes R2 objects with no committed `comments` row after the orphan-window TTL. |

K_eff materialised view refresh — formerly the marquee pg_cron job — is **not in v1** following SPEC.1 v1.1.0-draft (2026-05-05). v1 has zero async read-model targets per ADR-0005's sync/async classification rule; the rule still stands but has no live consumers, parallel to a TypeScript type definition that is exported but currently unused.

### 8. Cost ceiling — two-tier, traction-gated

This ADR ratifies a two-tier cost model. The **default tier** is the launch posture; the **upgrade tier** is pre-authorized but engaged only when traction or operational signals warrant. Engaging the upgrade tier does not require a new ADR — this ADR is the authorization.

**Build window (May → Sep 2026):** all four vendors run on free / hobby tiers; expected cost ~$0. No upgrade path engaged pre-launch.

**Live window — Default tier: $300/month aggregate ceiling.**

Steady-state expectation ~$70–90/mo at the ≤5k concurrent target; ~$210/mo headroom for launch-night surge and bandwidth spikes.

| Vendor | Default-tier slice | Note |
|---|---|---|
| Vercel | Pro $20/mo | + bandwidth-overage risk |
| Supabase | Pro $25/mo + Small compute $10/mo = $35/mo | 7-day PITR included |
| Upstash | Pay-per-request, $10–30/mo | At ≤5k concurrent target |
| Cloudflare R2 | ~$5/mo | Storage-dominated; egress free |
| **Aggregate steady** | **~$70–90/mo** | |
| **Default ceiling** | **$300/mo** | |

**Live window — Upgrade tier: $500/month aggregate ceiling (pre-authorized, traction-gated).**

Engaged at Hrishikesh's call when product traction (DAU growth, market volume, comment volume) or operational signals (bet-handler p95 latency, Postgres CPU sustained load, Redis p99 latency, rate-limit-check timeouts) warrant. Engagement is per-vendor — Hrishikesh decides which upgrades to engage, in what order, based on which signal is firing.

| Vendor | Upgrade-tier slice | Delta vs default |
|---|---|---|
| Vercel | Pro $20/mo + bandwidth-overage headroom | unchanged tier; bandwidth headroom only |
| Supabase | Pro $25/mo + Medium compute $60/mo + 14-day PITR add-on $50/mo = ~$135/mo | + ~$100/mo |
| Upstash | Pro fixed-instance ~$60–80/mo | + ~$50/mo over default mid-band |
| Cloudflare R2 | ~$5/mo | unchanged |
| **Aggregate steady** | **~$220–280/mo** | + ~$150–190/mo |
| **Upgrade ceiling** | **$500/mo** | + $200/mo headroom |

**Triggers for engaging per-vendor upgrades** (any one is sufficient; Hrishikesh decides):

- **Supabase Medium compute:** bet-handler p95 latency >1s sustained 24h, OR Postgres CPU sustained >70% for 24h, OR connection-pool exhaustion events surfaced in logs, OR product traction (DAU / market-volume growth Hrishikesh judges material).
- **Supabase 14-day PITR:** mid-experiment operational-confidence call by Hrishikesh; no quantitative trigger.
- **Upstash Pro fixed-instance:** Redis p99 latency >50ms sustained 24h, OR rate-limit-check timeouts appearing in Sentry, OR pre-commit moderation reservation timeouts, OR product traction.

**Discipline (default tier).** If any vendor crosses **60% of its default-tier slice for two consecutive days** during the live window, surface to Hrishikesh — engage the relevant upgrade or accept the cost as steady. Operational discipline, not an automated cap.

**Discipline (upgrade tier).** If aggregate spend approaches the $500/mo ceiling, surface to Hrishikesh for explicit reauthorization. The $500/mo ceiling is the **architectural** ceiling for this ADR; crossing it requires a new ADR.

### 9. Failure-mode profile

The failure-mode profile is part of what this ADR ratifies because it shapes operational expectations and informs HARDEN.9 (DR drill) and the pre-launch checklist (HARDEN.10).

| Vendor | Failure mode | User-facing surface | Behavior |
|---|---|---|---|
| Vercel | Web-tier outage | All surfaces | Hard fail. Site-down. No failover in v1. Status page surfaces Vercel's incident; admin acknowledges and waits. |
| Supabase | Postgres outage | All surfaces requiring DB | Hard fail. Read paths and write paths both unavailable. No read replica in v1. Erasure requests still queueable via support email. |
| Upstash | Redis outage | Rate-limit + idempotency + pre-commit moderation reservation | **Mixed:** rate-limit fails open (per ADR-0015 — allow if Upstash unreachable); idempotency fails closed (per ADR-0015 — reject with 503 if Upstash unreachable). Pre-commit moderation reservation fails closed. Net: bet flow is gated by Redis availability; read flow is not. |
| Cloudflare R2 | Object-storage outage | Image upload + image serve | **Degraded:** image uploads fail (signed-PUT mint succeeds, browser PUT fails); existing images served from R2's edge cache continue rendering; `F-COMMENT-3` image-attached comments fail; `F-COMMENT-1/2` text-only comments succeed. PFPs already cached on the client persist; new signups blocked at the F-AUTH-3 PFP-render step. |
| pg_cron job failure | Per job (drift / partition / watermark) | None (admin-only signal) | **Operational only.** Drift-detection failure → drift undetected for one cadence; partition overrun → DEFAULT-partition rows accumulate (existing alarm covers); watermark check → admin doesn't get the low-watermark alert (manual `identity_pool` count query is the fallback). No user-facing surface degrades. |
| Vercel Cron job failure | R2 orphan sweep | None | **Operational only.** Orphaned R2 objects accumulate; storage cost rises by single-digit cents per day of failure. No user-facing impact. Admin notices via Sentry alarm on the route handler or via R2 storage-cost spike. |

The two write paths that hard-fail on Redis outage (idempotency and pre-commit moderation) are deliberate — accepting either failure mode without Redis would be unsafe (idempotency double-charges; moderation reservation race could double-commit moderation). Per ADR-0015 / ADR-0014.

### Hard discipline minted here

**Vercel Cron is reserved for jobs requiring HTTP fanout to non-Postgres services.** Adding a Vercel Cron entry for a SQL-only periodic job is a discipline violation; if a SQL-only job arrives mid-build, it goes in `drizzle/migrations/<NNNN>_pg_cron_jobs.sql`, not in `vercel.json`. CI lint (HARDEN.* task — flagged below) verifies the discipline by parsing `vercel.json` and rejecting `crons[]` entries whose handler bodies do nothing but issue Postgres queries.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Vercel project configuration (region, runtime overrides per route, cron registry) | `vercel.json` |
| Postgres connection string + Supabase env vars | Vercel/Doppler env (per SCAFFOLD.13); not committed to repo |
| `pg_cron` job definitions (job names, handlers, dependencies) | `drizzle/migrations/<NNNN>_pg_cron_jobs.sql` |
| `pg_cron` cadence values (specific cron-syntax schedules) | Same file as above; values pinned by `HARDEN.*` |
| Vercel Cron entries (path + schedule) | `vercel.json` `crons[]` field |
| Vercel Cron handler bodies | `src/app/api/cron/*/route.ts` |
| R2 bucket configuration descriptive note | `infra/r2-bucket-config.md` (descriptive only — buckets created via Cloudflare dashboard or `wrangler` CLI; this file documents intent) |
| Cost-ceiling discipline + per-vendor slices | This ADR (§"Cost ceiling"); operational tracking via vendor dashboards |
| Failure-mode profile | This ADR (§"Failure-mode profile"); HARDEN.10 pre-launch checklist consumes |

## Consequences

### Positive

- **Single-region failure-domain co-location.** All four vendors land in Mumbai. The admin path, the conclusion-event path, and the CDN-edge path share a regional failure domain — easier to reason about, easier to recover from, easier to debug.
- **Cron topology that uses each engine where it is strongest.** pg_cron handles SQL-only jobs without leaving the database; Vercel Cron handles the one HTTP-fanout job in TypeScript with the rest of the codebase. No engine is forced into a job it is structurally bad at.
- **Cost ceiling is auditable and enforced by discipline, not by automation.** $300/month is realistic at scale, leaves headroom for traffic spikes, and forces a human checkpoint if any vendor is consuming disproportionately.
- **Failure-mode profile is explicit, not discovered at runtime.** HARDEN.9 (DR drill) and HARDEN.10 (pre-launch checklist) consume this profile directly. The pre-commit-moderation-fails-closed and idempotency-fails-closed disciplines (per ADR-0014 / ADR-0015) are documented here, not buried in code.
- **All four vendor SaaS surfaces have free / hobby tiers covering the entire build window.** Real cost only kicks in at launch.
- **Cost upgrade path is pre-authorized.** The $500/mo upgrade tier is ratified as an operational lever. Engaging Supabase Medium compute, Upstash Pro fixed-instance, or 14-day PITR when traction or latency signals warrant does NOT require a new ADR; the trigger conditions and per-vendor upgrade slices are documented in §"Cost ceiling".
- **AGPL-3.0 redistribution is unaffected by all four vendors.** No license obligations carry through SaaS use per ADR-0001.

### Negative

- **Single-region means a regional outage is total downtime.** *Mitigated by:* the experiment is read-mostly; even a 4-hour `ap-south-1` regional outage during the live window is recoverable as a narrative event ("the experiment was unreachable for 4 hours on day N"), not a failed experiment. Multi-region is testnet-phase concern.
- **Two cadence engines means two operational surfaces to monitor.** *Mitigated by:* the cut is principled (DB-internal vs HTTP-fanout) and easy to explain; each engine has exactly one alarming surface (`cron.job_run_details` for pg_cron, Sentry for Vercel Cron route handler).
- **No `pg_net` means R2 orphan sweep cannot stay in the database.** *Acceptable because:* the alternative (pg_net + PL/pgSQL HTTP error handling) is operationally worse than a Vercel Cron route handler in TypeScript for the solo developer.
- **R2 orphan sweep is the only carve-out today, but the precedent is that future HTTP-fanout cron jobs also go to Vercel Cron.** *Acceptable because:* the discipline is explicit in this ADR, and the testnet-phase rewrite can revisit cadence-engine choice from a clean slate.
- **Cost ceiling at $300/month is a discipline, not a hard cap.** *Mitigated by:* the 60%-of-slice trigger forces an early conversation; vendor dashboards expose live spend; $300/mo at experiment scale is comfortable headroom over expected $70–90/mo steady state.

### Neutral

- **Cloudflare-as-CDN-in-front-of-Vercel is preserved as a same-day flip option.** Engaging it requires only flipping DNS-only → orange-cloud and minor origin-cert pinning. The decision is not foreclosed; it is explicitly deferred until a real DDoS pattern exists.
- **Postgres 17 is the major-version pin for this build.** Any future migration to Postgres 18 is a testnet-phase concern; the experiment archive at `2026-11-08` does not need to upgrade.
- **`pg_net` is uninstalled in v1.** Future ADRs that want Postgres-side HTTP must install the extension and accept the operational profile; this ADR does not foreclose `pg_net`, it just declines to install it.

## Pros and Cons of the Options

### Option 1 — Vercel + Supabase + Upstash + Cloudflare R2 (chosen)

**Pros**

- Free / hobby tiers cover the entire build window
- Each vendor is the canonical pick for its role in the Next.js + Postgres + Redis + S3-compatible-object-storage ecosystem; agent training data depth is excellent
- Mumbai region available across all four vendors — single-region story holds
- Cloudflare R2 has zero egress fees — significant cost ceiling impact at scale
- Vercel preview-per-PR + production-deploy ergonomics are best-in-class for a solo developer
- ADR-0003's Node.js runtime constraint is satisfied natively
- ADR-0004's vendor stack (Google IS, Resend, Turnstile) integrates cleanly without proxying
- ADR-0005's `pg_cron` requirement is satisfied by Supabase Pro
- Vendor-tier upgrade paths exist on every primitive (Supabase compute, PITR retention, Upstash dedicated-instance) — pre-authorized in §"Cost ceiling" as an operational lever, not an architectural decision

**Cons**

- Four-vendor stack means four separate dashboards, four separate billing relationships, four separate status pages to monitor
- Vercel pricing model has bandwidth-overage risk that is hard to bound in advance — mitigated by the cost ceiling discipline (§8)
- Single-region across all four means a regional outage takes everything down

### Option 2 — Self-hosted single-VM on Hetzner / DigitalOcean / Linode

**Pros**

- Total cost in the $20–40/month range — well below the chosen-option ceiling
- Single failure domain (one VM); single dashboard; no cross-vendor coordination
- Maximum control: any Postgres version, any Redis configuration, any cron mechanism
- No vendor lock-in concerns

**Cons**

- **Operational surface unfit for solo developer + 7-week live window.** OS patching, PG manual upgrades, Redis tuning, TLS cert rotation, log rotation, backup scripting, monitoring, on-call coverage — every operational responsibility falls on Hrishikesh. This is the wrong surface to defend in a 7-week experiment.
- **No PITR out of the box.** Manual `pg_basebackup` + WAL-archiving setup. Restore drill (HARDEN.9) is materially harder.
- **No preview-per-PR equivalent.** Each PR-preview requires either a separate VM, container orchestration, or a custom proxy layer.
- **Manual failover.** A single-VM crash is total downtime until manual intervention, and there is no second pair of hands.
- Deployment ergonomics are 10× worse than Vercel for a Next.js codebase.

**Verdict:** Rejected. Cost saving does not offset the operational tax on a single non-technical product owner with two support devs.

### Option 3 — AWS-native (Lambda + RDS Postgres + ElastiCache Redis + S3 + EventBridge)

**Pros**

- Single billing relationship, single dashboard (AWS Console)
- AWS regional coverage in Mumbai (`ap-south-1`) is mature
- IAM model is the gold standard for cross-service auth
- EventBridge is a strong cron primitive; RDS supports `pg_cron` on recent Postgres versions
- S3 is the canonical object-storage surface

**Cons**

- **Setup cost is materially higher.** VPCs, security groups, IAM roles, Lambda packaging, RDS subnet groups, NAT gateways, parameter groups — every one of those is a real configuration step.
- **Solo-developer + Claude Code workflow penalty.** Agent training data on Vercel + Supabase is denser than on AWS-native equivalents for a Next.js codebase; AWS code generation tends toward CloudFormation / CDK boilerplate that is not optimal for a 7-week build.
- **Cost is comparable or higher** than the chosen option at experiment scale; data transfer fees are non-zero; NAT gateway pricing is opaque.
- **No preview-per-PR equivalent** without custom infrastructure (Amplify is the closest but adds a separate operational surface).
- **License-incompatibility-of-AWS-services** is not an issue (all are SaaS), but the AGPL-3.0 redistribution story benefits from minimal vendor entanglement, which AWS-native maximizes.

**Verdict:** Rejected. Operational and cognitive cost is wrong for a solo non-technical product owner running a 7-week experiment.

### Option 4 — Vercel platform single-vendor (Vercel + Vercel Postgres + Vercel KV + Vercel Blob)

**Pros**

- Single billing relationship, single dashboard
- All-Vercel ergonomics: preview deploys, env-var scoping, local-dev parity all work cleanly
- Zero cross-vendor egress fees
- Reduced operational surface

**Cons**

- **Vercel Postgres is Neon-backed and on a younger product line** than Supabase Postgres (which is Postgres-direct on managed instances). The `pg_cron` story on Vercel Postgres is materially weaker; extension support is gated on Neon's exposure model.
- **Vercel KV is Upstash-backed but with a less mature direct API.** Engaging Upstash directly avoids a wrapper layer.
- **Vercel Blob is younger than Cloudflare R2** and has explicit egress pricing — undermines the cost ceiling.
- **Lock-in concentration risk.** Putting database, cache, and object storage all on Vercel creates a single-vendor blast radius that Cloudflare R2 + Supabase decouple.
- **Pricing is comparable at small scale but worse at any growth scenario** because Vercel marks up its infrastructure dependencies.

**Verdict:** Rejected. Marginal operational simplification at the cost of three weaker primitives, more lock-in concentration, and worse cost ceiling.

### Option 5 — Fly.io / Railway managed-platform

**Pros**

- Strong solo-developer ergonomics
- Postgres-on-platform is reasonable; multi-region story is built-in
- Container-based deployment is more flexible than Vercel functions for some patterns
- Active developer communities

**Cons**

- **Container-based deploy is a worse fit for Next.js 16 + App Router** than Vercel functions; Server Actions and the cache-components model assume Vercel-like runtime
- **Postgres-on-platform is younger and less battle-tested** than Supabase
- **No first-party preview-per-PR analog** as polished as Vercel's; PR-preview is feasible but adds setup
- **Tracker discipline ratified in ADR-0003** ("scope freezes at launch; no mid-build framework migration") is harder to maintain when the deploy primitive is not the framework's first-party target

**Verdict:** Rejected. Architecturally viable but pays a fit penalty for a Next.js codebase with no offsetting gain.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.2 §1.4 #5 | Delegated decision | Hosting topology + regions + PITR + cron engine — ratified by this ADR |
| SPEC.2 §4 (stub) | System Context | Mints substantive deployment topology: end-users + admin → Cloudflare (DNS-only) + Cloudflare Turnstile + Cloudflare R2 → Vercel Edge Network → Next.js 16 on Vercel Node.js runtime, region `bom1` → Supabase Postgres 17 (`ap-south-1`) + Upstash Redis (`ap-south-1`) + Cloudflare R2 (`APAC`) → external services (OpenAI moderation, image moderation vendor, Resend email, Sentry, PostHog, Axiom, Google OAuth). Single-region principle and its failure-mode implications stated. **Back-pressure: §4 is rewritten on the next §4 drafting pass to absorb this topology and the failure-mode profile substance.** |
| SPEC.2 §22 (stub) | Operational Runbook Pointers | Mints: cron-schedule register substance — pg_cron is the engine, Vercel Cron is the HTTP-fanout carve-out, and the four jobs named here are the v1 inventory. Specific cadence values remain `HARDEN.*` territory. **Back-pressure: §22 absorbs the engine-vs-fanout cut and the four-job inventory on the next §22 drafting pass.** |
| SPEC.2 §23 | ADR Index | Status of ADR-0006 flips from `provisional` to `accepted` on this commit. |
| SPEC.1 §13 | Vendor stack (per `K1`, `K2`, `K3`) | Consumes: Cloudflare R2, Cloudflare Turnstile, Resend, Google IS, Upstash Redis, Vercel — all already locked in SPEC.1 §13 and CLAUDE.md decision log. This ADR ratifies the regions, plan tiers, and operational disciplines. |
| SPEC.1 §16.1 | Operational floor | Consumes: rate-limit constants are enforced via Upstash Redis (per ADR-0015 / SCAFFOLD.4); this ADR ratifies the engine choice. |
| SPEC.1 §16.4 | Audit log catalogue + 7-day PITR commitment | Consumes: the `events` log + per-table audit tables ship in Postgres 17 on Supabase Pro per this ADR. PITR retention pinned at 7 days. The 30-day option is rejected per §"Database" rationale. |
| SPEC.1 §3 G3 (post-amendment) | K_eff dataset-derivability | Consumes: the v1 cron job inventory excludes K_eff materialised view refresh per SPEC.1 v1.1.0-draft. |
| ADR-0003 | Node.js runtime constraint | Consumes: Vercel Node.js runtime is the chosen execution model. Edge runtime is permitted for non-`src/server/{bets,comments,dharma,resolution}/` routes per ADR-0003. |
| ADR-0004 | Better Auth + Cloudflare Turnstile | Consumes: Better Auth runs on Vercel Node.js runtime; Cloudflare Turnstile is engaged for the email-OTP path per ADR-0004's `hooks.before` integration. This ADR ratifies that Cloudflare's other surfaces (DNS, R2) are also engaged but Cloudflare-as-CDN-in-front-of-Vercel is explicitly NOT engaged. |
| ADR-0005 | Postgres major version, hosting, pg_cron topology | **Closes** the gating items from ADR-0005's "Flow & invariant constraints absorbed" table: Postgres 17 ratified, Supabase ratified as hosting vendor, region `ap-south-1` ratified, PITR retention 7-day ratified, pg_cron topology ratified as primary cadence engine. ADR-0005's sync/async classification rule has zero v1 consumers post-SPEC.1-v1.1.0-draft; the rule still stands for testnet-phase. |
| ADR-0007 (gating) | Observability vendor configuration | This ADR ratifies the hosting platform on which Sentry / PostHog / Axiom run. ADR-0007 owns the vendor-configuration substance. Vercel deploy hooks → Sentry release tagging is a SCAFFOLD.5 wiring, no §18 substance change here. |
| ADR-0013 | Bet transaction concurrency | Consumes: the Postgres SERIALIZABLE handler with `SELECT FOR UPDATE` runs against Supabase Postgres 17 — multi-table ACID ratified at the DB layer; vendor ratified here. |
| ADR-0014 | Pre-commit moderation reservation | Consumes: the 10-second Redis intent-reservation key runs on Upstash Redis ratified here; failure mode (fail closed) ratified in §"Failure-mode profile". |
| ADR-0015 | Rate-limit + idempotency | Consumes: Upstash Redis ratified here; failure modes (fail open for rate-limit, fail closed for idempotency) ratified in §"Failure-mode profile". |
| Tracker | SCAFFOLD.1, SCAFFOLD.2, SCAFFOLD.4, SCAFFOLD.8, SCAFFOLD.12, SCAFFOLD.13, SCAFFOLD.14, SCAFFOLD.15, SCAFFOLD.17, SCAFFOLD.19, every ENGINE.* / DEBATE.* / UI.* task that runs on the Vercel runtime | All depend on this ADR being `accepted` |
| Tracker | SPEC.6 task description | **Correction flagged for application (Hrishikesh applies):** drop "projectors" (obsolete per ADR-0005 Pattern A), drop "K_eff snapshot" (removed per SPEC.1 v1.1.0-draft), drop "daily allowance accrual" (lazy-on-write per ENGINE.12, not cron). Replace with the four-job inventory in §"Cron job inventory (v1)". |
| Tracker (new HARDEN.* task) | CI lint for cron-engine discipline | **Flagged for tracker addition (Hrishikesh applies):** add a HARDEN.* task — "CI lint: parse `vercel.json` `crons[]`; reject any handler whose body issues only Postgres queries with no external HTTP fanout; the SQL-only-via-Vercel-Cron pattern is a discipline violation per ADR-0006." Estimate 0.5d. |

## More Information

- Vercel pricing & regions: <https://vercel.com/pricing>; Mumbai region `bom1` documentation
- Supabase Pro plan + region availability: <https://supabase.com/pricing>; `ap-south-1` Mumbai
- Supabase `pg_cron` extension exposure: <https://supabase.com/docs/guides/database/extensions/pg_cron>
- Upstash Redis pricing: <https://upstash.com/pricing>; pay-as-you-go global edge with `ap-south-1` primary
- Cloudflare R2 pricing + jurisdictions: <https://developers.cloudflare.com/r2/pricing/>; jurisdiction `APAC`
- Postgres 17 release notes: <https://www.postgresql.org/docs/17/release-17.html>
- ADR-0001 (license — AGPL-3.0; SaaS use does not impose obligations)
- ADR-0003 (Next.js 16 + Node.js runtime constraint)
- ADR-0004 (Better Auth + Cloudflare Turnstile + Resend + Google IS)
- ADR-0005 (Postgres + event-sourced schema + pg_cron designated for async cadence)
- AGENTS.md §1 (stack — already aligned with this ADR's vendor picks)
- CLAUDE.md rows 316 (Postgres 17), 318 (Supabase), 325 (Cloudflare R2), 328 (Upstash), 329 (Vercel) — unchanged in content; this ADR is the ratification
- SPEC.1 §13 (vendor lock), §16.1 (operational floor), §16.4 (audit log + PITR), §3 G3 post-amendment (K_eff dataset-derivability)
- SPEC.2 §1.4 #5 (delegation), §4 (System Context — back-pressure pending), §22 (Operational Runbook Pointers — back-pressure pending), §23 (ADR Index — status flip)

---

*ADR-0006 ratifies the four-vendor hosting topology (Vercel + Supabase + Upstash + Cloudflare R2) for the Zugzwang experiment phase, with Mumbai single-region across all four vendors, Postgres 17 on Supabase Pro with 7-day PITR (default) / 14-day PITR (upgrade), the `pg_cron` + Vercel Cron hybrid cadence topology where Vercel Cron is reserved for HTTP-fanout to non-Postgres services, the four-job v1 cron inventory (drift detection, partition-overrun monitoring, identity-pool low-watermark check on pg_cron; R2 orphan sweep on Vercel Cron), the two-tier traction-gated cost model ($300/mo default, $500/mo upgrade pre-authorized), and the per-vendor failure-mode profile. The decision body, the Vercel-Cron-only-for-HTTP-fanout discipline, the failure-mode profile, and the two-tier cost ceiling are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
