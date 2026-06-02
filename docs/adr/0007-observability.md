# ADR-0007 — Observability (Sentry + PostHog; Vercel runtime logs serve structured request logging)

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-05-05 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | SPEC.7 |
| **Frame document** | SPEC.2 §1.4 #5 (delegation, observability sub-bullet), §18 (Observability Contract — substantively filled), §22 (Operational Runbook Pointers — alarm catalogue feeds), §23 (ADR Index) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

The Zugzwang experiment-phase build runs from 2026-04-24 (build start) through 2026-09-15 (launch) to 2026-11-08 (conclusion at Devcon 8 / ETHGlobal Mumbai). The build is owned by one developer with two support devs and Claude Code; scope freezes at launch and the codebase reaches end-of-life at conclusion. The observability surface must be locked before SCAFFOLD.5 (Sentry wiring), SCAFFOLD.6 (PostHog wiring), and any task that consumes feature flags can begin.

ADR-0003 ratified Next.js 16 on the Node.js runtime as the framework. ADR-0006 ratified Vercel Pro `bom1` as the web tier and minted a per-vendor failure-mode profile that names the degradation states the alarm catalogue must consume. ADR-0005 Pattern A removed projector workers from v1 and minted a Sentry alarm on any DEFAULT-partition row in the events table; that alarm is absorbed into this ADR's catalogue.

`CLAUDE.md` rows 334 (Sentry), 335 (PostHog), and 336 (Axiom — superseded by this ADR) name the answer at the locked-decision level; SPEC.2 §18 (Observability Contract) is currently a stub naming alarm slots without the substantive vendor configuration. This ADR is the ratification.

The product surface is read-mostly with mandatory commentary on every bet and a hard end date. Solo operation across a 7-week live window means observability serves two operational goals: (a) the smoke-alarm function — surface errors and outages quickly enough that the admin can act before users notice; and (b) the feature-flag function — provide a same-second emergency brake on any feature whose live behaviour proves wrong, without redeploying. Custom-metrics dashboards and ad-hoc structured-log querying are valuable but **not load-bearing for the experiment phase** — the events log in Postgres is the canonical record and ad-hoc analysis can be served by direct SQL post-hoc. This is the architectural cut that drops Axiom from v1.

This ADR does **not** decide:

- Hosting platform / runtime / cron infrastructure → ADR-0006 (SPEC.6)
- Specific alarm threshold values (latency cutoffs, error-rate thresholds, count thresholds) → `HARDEN.*` (number-tuning + alarm-tuning passes)
- v1 feature-flag inventory (which flags ship at launch, what each does) → SCAFFOLD.6 + per-feature ADRs as needed
- Pre-commit moderation flow → ADR-0014 (SPEC.15)
- Concurrency model and retry semantics → ADR-0013 (SPEC.14)
- ORM choice → ADR-0008 (SPEC.9)
- Specific PostHog project names / Sentry organisation slugs → operational, in vendor onboarding (SCAFFOLD.5/6 task outputs)
- Dataset-release procedure → CONCLUDE.2 + `HARDEN.*`
- Uptime monitoring of Vercel itself / Supabase itself (Sentry cannot observe its own host going down) → `HARDEN.*` task addition (Better Stack / Pingdom / Cronitor pattern)
- CI lint enforcement of structured-log redaction discipline → `HARDEN.*` task addition

## Decision Drivers

1. **Solo-operator + 7-week live window.** One human plus Claude Code runs the live experiment. Every observability tool kept must justify itself against the AGENTS.md ground rule "if a decision can be deferred to `HARDEN.*` or to testnet phase without breaking the live window, defer it."

2. **Build-lifetime stability through 2026-11-08.** Every vendor chosen must remain on a stable plan with no announced major migration through 2026-11-08. Vendor lock-in is acceptable because the codebase archives at conclusion.

3. **ADR-0006 hosting topology already names what to integrate with.** Vercel deploy hooks → Sentry release tagging is the integration pattern. Vercel runtime logs already capture per-request data. This ADR builds on those surfaces; it does not replicate them.

4. **SPEC.1 §16.3 H3 privacy floor.** The structured request log MUST contain timestamp, user_id (or anon marker), route, status_code, IP, user_agent, latency_ms — and MUST NOT contain request body or response body. Whichever surface holds the structured log must honor this contract.

5. **Free-tier coverage at experiment scale.** Target ≤5k concurrent (per HARDEN.4); zero-revenue posture; no marketing spend. Vendors chosen must fit free / hobby tiers across the entire build window and most of the live window with comfortable headroom.

6. **Fail-open for the live write path.** Observability tools MUST NOT be load-bearing for user-facing flows. If Sentry Cloud is unreachable, the bet handler still completes. If PostHog is unreachable, `useFlag()` returns the call site's `defaultValue`.

7. **AGPL-3.0 redistribution unaffected.** Vendor SaaS surfaces impose no obligations on Zugzwang's AGPL-3.0 redistribution per ADR-0001.

8. **Solo-developer + Claude Code workflow.** Vendor surfaces chosen must have deep agent-training-data footprint and clean dashboard-and-CLI ergonomics — every operational task is one developer plus Claude Code.

## Considered Options

1. **Sentry (errors) + PostHog (analytics + feature flags); Vercel runtime logs serve the structured request log** ← chosen
2. Sentry + PostHog + Axiom — three-vendor split (errors + analytics/flags + structured logs/metrics)
3. Datadog single-vendor observability platform (errors + APM + logs + RUM + analytics)
4. Honeycomb OpenTelemetry-first single vendor (events + traces + queries)
5. Sentry only — defer PostHog and structured-log surface entirely

## Decision Outcome

**Chosen: Option 1 — Sentry + PostHog; Vercel runtime logs serve structured request logging.**

This ADR ratifies eight primitives plus one hard discipline.

### 1. Error tracking — Sentry (client + server, source maps, Vercel-deploy-hook release tagging)

Sentry Developer (free) tier at launch. Both the client SDK (`@sentry/nextjs` browser layer) and the server SDK (Node.js layer) wired via the Sentry Next.js webpack plugin. Source maps uploaded on every Vercel deploy via the Sentry build-time plugin (configured per Sentry's Next.js integration documentation; the integration runs in CI as part of `next build` on Vercel).

Release tagging is automatic via the Vercel deploy hook → Sentry release tagging integration: every Vercel deployment creates a Sentry release tagged with the Vercel deployment ID. Errors captured after a deploy are attributed to that release, enabling per-deploy error attribution.

The Sentry SDK is configured to fail open: if Sentry Cloud is unreachable, the SDK silently drops the report and the route handler completes normally. No user-facing flow depends on Sentry availability.

### 2. Analytics + feature flags — PostHog (free tier; `useFlag()` runtime contract)

PostHog Cloud free tier at launch (covers 1M events / month, well above experiment scale). Browser SDK (`posthog-js`) and server SDK (`posthog-node`) both wired. PostHog feature flags use **local evaluation** — flag definitions are cached on the server at process start and refreshed periodically; per-request flag checks evaluate locally without a network call.

Runtime contract for feature-flag access:

```typescript
useFlag(flagName: string, defaultValue: T): T
```

Single source of truth: `src/server/flags/use-flag.ts`. Behaviour:

- If PostHog Cloud is reachable and the flag is defined: returns the flag's evaluated value for the current user identity.
- If PostHog Cloud is unreachable: returns `defaultValue` (fail-open).
- If the flag is undefined in PostHog: returns `defaultValue` (fail-open).
- If the user is not yet identified: returns `defaultValue` (fail-open).

`defaultValue` MUST encode the safe behaviour — typically "feature disabled." A feature flag whose `defaultValue` exposes unfinished functionality on PostHog outage is a discipline violation.

The v1 feature-flag inventory is **not** locked in this ADR — SCAFFOLD.6 ratifies the launch-day flag list. Beyond launch, individual feature flags are added per-flow as needed; no per-flag ADR required.

Product analytics: PostHog events are emitted at flow boundaries (signup, bet placement, comment posting, market resolution). Specific event-naming convention deferred to SCAFFOLD.6.

### 3. Structured request log — Vercel runtime logs (no third vendor)

Vercel runtime logs serve the SPEC.1 §16.3 H3 structured request log contract. Every request to a Vercel-hosted route automatically produces a runtime log entry containing timestamp, route, status code, latency, and request metadata; these logs are searchable in the Vercel dashboard and retained per Vercel Pro's default retention.

The user_id field (or `null` for unauthenticated) is added via a server-side helper that calls `console.log()` with a structured prefix on every request entry; the prefix is parsed by the Vercel logs UI as a structured field.

**The §16.3 H3 "no request body, no response body" contract is enforced as a code-level discipline:** route handlers MUST NOT call `console.log(req.body)`, `console.log(response.body)`, or equivalents. The discipline is documented in `src/server/observability/log.ts` and in `CLAUDE.md`. CI lint enforcement is flagged as a `HARDEN.*` task addition; for v1 the discipline is human-enforced.

This is a deliberate cut from the original three-vendor sketch. Axiom was rejected because Vercel runtime logs already capture the per-request data the §16.3 H3 contract requires; Axiom's marginal value (richer query UI, longer retention) does not justify a third vendor in a 7-week live window. Custom-metrics dashboards (CPMM, Dharma ledger, commentary) defer to ad-hoc SQL queries against the Postgres events log — the events log is the canonical record per ADR-0005, more durable than Axiom queries would be, and ships in the public dataset on 2026-11-06.

### 4. Sentry alarm catalogue (six categories — names minted here, threshold values deferred to `HARDEN.*`)

Six alarm categories ship in v1. Specific threshold values are deferred to `HARDEN.*`; this ADR mints the alarm names, the firing condition shape, and the source of the signal.

| # | Alarm | Source | Firing condition shape |
|---|---|---|---|
| 1 | Append-only-trigger violation | Postgres `RAISE EXCEPTION` from the BEFORE UPDATE / BEFORE DELETE triggers (per ADR-0005 §6) | Any uncaught exception of the form `append_only_violation:*` propagates to Sentry as an unhandled error. Indicates application code attempted to mutate an immutable row — serious bug. |
| 2 | DEFAULT-partition insert | `events` table DEFAULT partition (the alarm minted in ADR-0005 §18 absorbed table) | A scheduled `pg_cron` job (per ADR-0006 §7 cron inventory) selects rows from the DEFAULT partition; on any non-zero count, fires a Sentry custom event. Indicates partition-range overrun. |
| 3 | 40001-retry exhaustion | Bet transaction wrapper (per ADR-0013 / SPEC.14) | After 3× retries with jittered backoff, on still-40001 the wrapper raises a Sentry custom event tagged `bet_serialization_exhausted`. Indicates contention saturation; bet handler returns 503 to the client. |
| 4 | OpenAI moderation upstream failure rate | Pre-commit moderation flow (per ADR-0014 / SPEC.15) | Per-call moderation API failures (timeout, 5xx, non-2xx) emit Sentry custom events; Sentry alert rule fires on event volume above threshold rate over a window. |
| 5 | Identity-pool low-watermark | Identity-pool low-watermark check (per ADR-0006 §7 cron inventory) | `identity_pool` unassigned count falls below the §15.2 widget #2 threshold (5% of total). The pg_cron job emits a Sentry custom event when the threshold is breached; the admin hub widget #2 also surfaces the value. |
| 6 | Per-vendor unavailability + cron job failure | ADR-0006 failure-mode profile + `cron.job_run_details` + Vercel Cron route handler 5xx | Multi-alarm category. One Sentry alarm each: Upstash Redis unreachable for >N seconds (route handlers catch the error and emit Sentry events); Cloudflare R2 unreachable for >N seconds (image upload handler catches and emits); pg_cron job failure per job (drift detection / partition-overrun / identity-pool low-watermark — a meta-pg_cron query consumes `cron.job_run_details` and emits Sentry events on failures); Vercel Cron R2 orphan sweep route handler 5xx (Sentry catches the route handler error directly). |

The "projector lag" alarm named in the SPEC.2 §18 stub at v0.1-outline is **dropped** from this catalogue — there are no projector workers in v1 per ADR-0005 Pattern A.

The "R2 orphan count" hook from the §18 stub is **deferred** — the standing-orphan count is a soft operational signal, not a Sentry alarm in v1; if the Vercel Cron sweep job fails, alarm 6 (Vercel Cron route handler 5xx) catches it.

**Uptime monitoring of Vercel and Supabase is OUT OF SCOPE for this ADR** — Sentry cannot observe its own host going down. A third-party uptime monitor (Better Stack / Pingdom / Cronitor pattern) is flagged as a `HARDEN.*` task addition.

### 5. Sentry session-replay disabled in v1

Sentry session-replay is explicitly **off** in v1. Three reasons:

- **Privacy.** Session replays of pseudonymous-but-IP-correlatable users introduce a re-identification surface that goes beyond SPEC.1 §16.3's transparency-by-design contract.
- **Cost.** Replay events burn Sentry free-tier quota fast.
- **Redundancy.** The Vercel runtime log + Postgres events log + Sentry stack trace already provide the post-hoc-debug surface for the experiment phase.

If session replay becomes useful for testnet-phase debugging, it can be enabled then. For v1, session replay is ratified off.

### 6. Cost ceiling — single-tier, $50/month total across both vendors

| Vendor | Plan | Steady cost (median month) | Ceiling |
|---|---|---|---|
| Sentry | Developer (free) | $0 | $25/mo if free tier exceeded |
| PostHog | Free tier (1M events/mo) | $0 | $25/mo if free tier exceeded |
| **Aggregate** | — | **$0** | **$50/mo total** |

The free tiers are expected to cover the entire build window and most of the live window. The $50/mo ceiling is comfort headroom for surprise spikes — e.g., bot-spam volume blowing through Sentry's free-tier event count in a single day. If aggregate spend approaches $50/mo, Hrishikesh decides whether to absorb the cost as steady or take operational action (rate-limit upstream of Sentry SDK; tighten event sampling). Crossing $50/mo requires a new ADR.

No traction-gated upgrade tier exists for this ADR. Neither vendor has a "Pro tier dramatically improves the live experience" lever at our scale. If PostHog's free tier exhausts mid-experiment, the path is to reduce event-emission volume, not to upgrade.

This cost ceiling is **separate from ADR-0006's hosting cost ceiling** ($300/mo default → $500/mo upgrade tier). Observability spend is not subsumed by the hosting tier.

### 7. Vercel deploy-hook → Sentry release tagging integration

Vercel deploy hooks fire on every deployment; Sentry's Next.js integration consumes the deploy-hook payload to create a release tagged with the Vercel deployment ID. Configuration lives in:

- `next.config.js` — Sentry webpack plugin block (source map upload + release-tagging configuration).
- Vercel project env vars — `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` (per SCAFFOLD.13 secrets).

No additional CI workflow file is required at v1 — Sentry's Next.js integration handles the release-tagging end-to-end. If the integration's behaviour proves insufficient mid-build, a `experiment/.github/workflows/release.yml` carve-out is the fallback; not anticipated.

### 8. Failure-mode profile

Both vendors are designed fail-open at the SDK level. The failure-mode profile:

| Vendor | Failure mode | User-facing surface | Behaviour |
|---|---|---|---|
| Sentry | Sentry Cloud unreachable | None | **Fail open.** SDK silently drops the report. Route handler completes normally. Errors stop being captured for the duration of the outage; admin discovers the outage via Sentry's status page or via absence of expected events. |
| PostHog (analytics events) | PostHog Cloud unreachable | None | **Fail open.** SDK silently drops the event. Analytics under-counts for the duration of the outage. |
| PostHog (feature flags, local evaluation) | PostHog Cloud unreachable | Flags fall back to `defaultValue` | **Fail open.** Local cache continues to evaluate. If the cache expires before PostHog returns, `useFlag()` returns `defaultValue` per primitive 2 contract. |
| Vercel runtime logs | Vercel logs UI down | None | **Fail open at the write path** — the runtime continues capturing logs to Vercel's storage; only the UI is degraded. Admin loses ad-hoc query capability for the duration. |

### Hard discipline minted here

**Observability tools fail open. The structured-log "no request body, no response body" contract is enforced as code-level discipline.** A bet flow that depends on Sentry availability, a feature flag whose `defaultValue` exposes unfinished UI, or a route handler that logs `req.body` are all discipline violations. CI lint for the structured-log discipline is flagged as a `HARDEN.*` task addition; the runtime fail-open semantics are enforced by SDK configuration in `src/server/observability/`.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Sentry client + server configuration (DSN, environment, release tagging, sampling rates) | `sentry.client.config.ts` + `sentry.server.config.ts` (per Sentry Next.js convention) |
| Sentry build-time configuration (source map upload, Vercel deploy-hook integration) | `next.config.js` Sentry webpack plugin block |
| Sentry custom events emitted for alarms 2–6 | Catalogued by alarm-name comment at the emission site: bet transaction wrapper (ENGINE.7), pre-commit moderation flow (ADR-0014 / SPEC.15), pg_cron jobs file (`drizzle/migrations/<NNNN>_pg_cron_jobs.sql`), R2 orphan sweep handler (`src/app/api/cron/r2-orphan-sweep/route.ts`) |
| PostHog client + server configuration | `src/server/observability/posthog.ts` |
| PostHog `useFlag()` runtime contract | `src/server/flags/use-flag.ts` |
| Structured-log helper + redaction discipline (the "no request body, no response body" rule) | `src/server/observability/log.ts` (descriptive header comment) + this ADR (substantive contract) + `CLAUDE.md` (developer rule) |
| v1 feature-flag inventory | SCAFFOLD.6 task output (not pinned in this ADR) |
| Alarm threshold values (error rates, latency cutoffs, count thresholds) | `HARDEN.*` task outputs (not pinned in this ADR) |
| Cost ceiling discipline + per-vendor slices | This ADR (§7); operational tracking via vendor dashboards |
| Failure-mode profile | This ADR (§8); HARDEN.10 pre-launch checklist consumes |

## Consequences

### Positive

- **Two vendors, two clear jobs.** Sentry catches errors; PostHog runs analytics + flags. No overlap, no ambiguity about which tool to reach for. Cognitive load minimal for the solo operator.
- **Free tiers cover experiment scale comfortably.** Realistic spend across the entire build + live window is $0; the $50/mo ceiling is comfort headroom, not expected cost.
- **Vercel runtime logs serve §16.3 H3 without a third vendor.** The structured request log contract is honored without paying for Axiom and without adding a third dashboard surface.
- **Fail-open posture is explicit.** Every user-facing flow continues working through any combination of Sentry / PostHog / Vercel-logs outages. Observability is best-effort; the live experiment is not gated on any of it.
- **Vercel deploy hook → Sentry release tagging** ties errors to the deploy that introduced them with no manual operational step.
- **Feature-flag emergency brake.** PostHog flags provide a same-second toggle on any feature whose live behaviour proves wrong, without redeploy. Operational hygiene for the live window.
- **AGPL-3.0 redistribution unaffected** per ADR-0001.

### Negative

- **Per-flow analytics requires manual event emission at flow boundaries.** Without Axiom's log-aggregation surface, ad-hoc questions like "what's the p95 latency of the bet endpoint last hour?" route through the Vercel logs UI (less powerful querying) or the Postgres events log (SQL queries). *Mitigated by:* the events log is the canonical record; SQL is more durable than Axiom queries, and PostHog handles the funnel-analysis surface that's actually thesis-relevant.
- **Structured-log redaction is human-enforced in v1.** No CI lint catches a stray `console.log(req.body)`. *Mitigated by:* flagged as a `HARDEN.*` task addition; the discipline is documented in `CLAUDE.md` and in the file header of `src/server/observability/log.ts`.
- **Vercel logs default retention is shorter than Axiom's.** The post-hoc-debug window for ad-hoc structured-log queries is bounded by Vercel's retention. *Acceptable because:* the Postgres events log retains everything indefinitely (ships in the public dataset on 2026-11-06 per SPEC.1 §12.2) — Vercel logs serve the live-debug surface; the events log serves the durable record.
- **Sentry custom events are the firing primitive for alarms 2–6.** A PR that forgets to emit the custom event silently loses the alarm. *Mitigated by:* the alarm catalogue's "source" column names where each event is emitted; SPEC.8 fresh-session review verifies emission.
- **Free-tier exhaustion is a real (low-likelihood) risk under bot-spam volume.** *Mitigated by:* the $50/mo ceiling permits operational top-up; the rate-limit middleware (per ADR-0015 / SCAFFOLD.4) limits abusive request volume upstream of Sentry capture.
- **No uptime monitor in this ADR.** Sentry cannot observe its own host going down. *Mitigated by:* uptime-monitor task addition flagged for `HARDEN.*` (Better Stack / Pingdom / Cronitor pattern); a 4–8 hour Vercel outage during the live window is a recoverable narrative event, not a failed experiment.

### Neutral

- **`CLAUDE.md` row 336 (Axiom) is struck or marked superseded** as part of this ADR's commit. The "Logs + metrics" row drops; structured logs route to Vercel runtime logs; custom metrics defer to Postgres events log queries.
- **SPEC.2 §18 substance is now this ADR.** Future drafting passes on §18 reference this ADR rather than redefining.
- **Testnet-phase reconsideration** is the natural place to revisit Axiom or another structured-log vendor if the experiment surfaces a real need that Vercel logs cannot serve.
- **SPEC.1 §3 G3 K_eff dataset-derivability** removes any K_eff dashboard observability hooks from v1 (the K_eff dashboard itself was removed per SPEC.1 v1.1.0-draft). No alarm, no PostHog event, no Vercel-log dimension for K_eff in v1.

## Pros and Cons of the Options

### Option 1 — Sentry + PostHog; Vercel runtime logs serve structured request logging (chosen)

**Pros**

- Two vendors, two jobs, no overlap. Minimal cognitive load.
- Free tiers cover experiment scale; realistic spend is $0.
- Vercel runtime logs already capture the §16.3 H3 contract; no third vendor needed.
- Both vendors fail open at the SDK level — observability is best-effort, not load-bearing.
- Vercel deploy hook → Sentry release tagging is a clean integration.
- PostHog's feature-flag emergency brake earns its keep on its own.

**Cons**

- Vercel logs are a weaker ad-hoc query surface than Axiom would be (mitigated: Postgres events log + SQL covers the durable analysis surface).
- Structured-log redaction is human-enforced (mitigated: flagged for CI lint as `HARDEN.*`).
- No metrics dashboard (acceptable: thesis-irrelevant for the experiment phase).

### Option 2 — Sentry + PostHog + Axiom (three-vendor split)

**Pros**

- Best ad-hoc structured-log query surface.
- Custom-metrics dashboards available out of the box.
- Longer log retention than Vercel's default.

**Cons**

- Three vendors, three dashboards, three sets of credentials, three things to set up correctly. Extra cognitive load for a 7-week experiment.
- Axiom's marginal value over Vercel runtime logs is real but small at experiment scale.
- Custom metrics are not thesis-relevant for the experiment phase — the events log answers anything that matters, more durably than Axiom would.

**Verdict:** Rejected. Over-spec'd for a 7-week live window; Axiom's marginal value does not justify a third vendor surface. Testnet phase decides afresh.

### Option 3 — Datadog single-vendor observability platform

**Pros**

- One dashboard, one set of credentials, one mental model.
- Industry-leading APM and distributed tracing.
- Best-in-class log aggregation.

**Cons**

- Free tier is thin; Datadog's pricing kicks in fast — Pro plan likely from week one of live volume, well above the experiment-phase budget.
- Steep learning curve for one developer plus Claude Code.
- APM and distributed tracing are over-spec for a single-region single-service Next.js app at ≤5k concurrent.
- Each individual surface (errors, analytics, logs) is comparable to or weaker than the specialist tools.

**Verdict:** Rejected. Built for 50-engineer organisations with distributed services; cost and cognitive load both wrong for a 7-week solo experiment.

### Option 4 — Honeycomb OpenTelemetry-first single vendor

**Pros**

- OpenTelemetry-native — instrumentation portability.
- Excellent ad-hoc query UX (BubbleUp, traces).
- Reasonable free tier.

**Cons**

- No first-party feature-flag product — would still need a separate flag vendor or build flags in-house.
- Smaller agent-training-data footprint than Sentry / PostHog — Claude Code support is thinner.
- OpenTelemetry instrumentation is a discipline this codebase doesn't otherwise carry; adopting it for one vendor adds setup cost.
- No first-party error-tracking product as polished as Sentry's.

**Verdict:** Rejected. Strong fit for a different codebase shape (microservices, OTel-from-day-one); poor fit here.

### Option 5 — Sentry only; defer PostHog and structured-log surface entirely

**Pros**

- Smallest possible observability surface. One vendor, one dashboard, one wiring task.
- Maximum deferral of decisions to mid-experiment if needed.

**Cons**

- No feature-flag emergency brake. Mid-experiment toggles require a redeploy (~60–90 seconds on Vercel — workable but worse than a PostHog flag flip).
- No funnel-analysis surface. Where users drop off becomes a SQL-against-Postgres question only.
- Adding PostHog mid-experiment under live load is more friction than wiring it pre-launch.

**Verdict:** Rejected. The feature-flag function is operationally valuable enough during a 7-week live window to wire pre-launch; deferring is a false economy.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.2 §1.4 #5 | Delegated decision (observability sub-bullet) | Observability vendor configuration + alarm catalogue + structured-log surface — ratified by this ADR |
| SPEC.2 §18 (stub) | Observability Contract | **Substantively filled** by this ADR. Mints: vendor configuration (Sentry + PostHog), six-category Sentry alarm catalogue, PostHog `useFlag()` runtime contract, structured-log surface (Vercel runtime logs + code-level redaction discipline), failure-mode profile (fail open across the board), session-replay-disabled-in-v1 lock. **Back-pressure:** §18 stub is rewritten on the next §18 drafting pass to reference this ADR rather than restating; the stub's "projector lag" alarm is dropped (no projectors in v1 per ADR-0005); the stub's "structured Axiom log line" phrasing is replaced with "Vercel runtime log entry"; the stub's "Axiom" mentions are struck. |
| SPEC.2 §22 (stub) | Operational Runbook Pointers | Consumes: the alarm catalogue minted here is the input to the per-alarm runbook entries `HARDEN.*` will produce. The failure-mode profile here aligns with ADR-0006's failure-mode profile and feeds the same runbook surface. |
| SPEC.2 §23 | ADR Index | Status of ADR-0007 flips from `provisional` to `accepted` on this commit. |
| SPEC.1 §16.3 H3 | Structured request log contract | Consumes: timestamp, user_id, route, status_code, IP, user_agent, latency_ms — served by Vercel runtime logs. Mints: code-level redaction discipline ("no request body, no response body" enforced as a code rule; CI lint flagged as a `HARDEN.*` task addition). |
| SPEC.1 §15.2 widget #2 | Identity-pool low-watermark visibility | Consumes: 5%-of-pool threshold for the admin hub widget; this ADR mints the corresponding Sentry alarm (catalogue entry #5) so the admin doesn't need the dashboard open to know the pool is exhausting. |
| SPEC.1 §3 G3 (post-amendment) | K_eff dataset-derivability | Consumes: no K_eff dashboard observability hooks in v1 per SPEC.1 v1.1.0-draft. No Sentry alarm, no PostHog event, no Vercel-log dimension for K_eff. The K_eff trajectory series ships in the public dataset only. |
| SPEC.1 §16.4 | Audit log catalogue + 7-day PITR commitment | Consumes: the events log + per-table audit tables ship in Postgres 17 on Supabase Pro per ADR-0006. Audit-log mutations propagate through the Bucket-A append-only triggers, which fire alarm #1 on attempted illegal mutation. |
| ADR-0001 | License | Consumes: vendor SaaS use imposes no obligations on Zugzwang's AGPL-3.0 redistribution. |
| ADR-0003 | Next.js 16 + Node.js runtime | Consumes: Sentry + PostHog SDKs run on the Vercel Node.js runtime per ADR-0003. Server Action instrumentation pattern follows Sentry's Next.js webpack-plugin integration. |
| ADR-0005 | Append-only triggers + DEFAULT-partition alarm | Consumes: append-only-trigger violation alarm (catalogue entry #1) + DEFAULT-partition insert alarm (catalogue entry #2 — the alarm minted in ADR-0005 §18 absorbed table is named here). The "projector lag" alarm in the SPEC.2 §18 stub is dropped (no projectors in v1 per Pattern A). |
| ADR-0006 | Vercel deploy hooks + failure-mode profile + cron inventory | Consumes: Vercel deploy hooks → Sentry release tagging (the SCAFFOLD.5 wiring); per-vendor failure-mode profile feeds catalogue entry #6 (per-vendor unavailability + cron job failure); the four-job cron inventory anchors the per-cron-job alarms within entry #6. The hosting cost ceiling ($300/mo default → $500/mo upgrade) is **separate** from this ADR's $50/mo observability ceiling. |
| ADR-0013 | Bet transaction concurrency + 40001 retry | Consumes: 40001-retry-exhaustion alarm (catalogue entry #3) — the bet transaction wrapper raises a Sentry custom event after retry exhaustion. |
| ADR-0014 | Pre-commit moderation | Consumes: OpenAI moderation upstream-failure-rate alarm (catalogue entry #4) — the pre-commit moderation flow emits Sentry custom events on upstream failure. |
| `CLAUDE.md` row 334 (Sentry) | Vendor lock | This ADR is the ratification — no row content change. |
| `CLAUDE.md` row 335 (PostHog) | Vendor lock | This ADR is the ratification — no row content change. |
| `CLAUDE.md` row 336 (Axiom) | Vendor lock — **superseded** | **Flagged for application by Hrishikesh:** strike row 336, or rewrite as `Logs + metrics | Vercel runtime logs (per ADR-0007); Axiom deferred to testnet phase if needed`. |
| Tracker | SCAFFOLD.5 (Sentry wired) | Depends on this ADR being `accepted` |
| Tracker | SCAFFOLD.6 (PostHog wired) | Depends on this ADR being `accepted` |
| Tracker | SCAFFOLD.7 (Axiom wired) | **Flagged for application by Hrishikesh:** strike SCAFFOLD.7 from the tracker (Axiom not in v1). Recommendation: strike entirely; testnet phase decides afresh. |
| Tracker (SPEC.7 description) | Vendor list | **Flagged for application by Hrishikesh:** SPEC.7 tracker description currently reads "Sentry + PostHog + Axiom. Error tracking, analytics/flags, logs/metrics. Why three tools, not one." — update to "Sentry + PostHog. Error tracking + analytics/flags. Vercel runtime logs serve §16.3 H3 structured request log; Axiom deferred to testnet phase." |
| Tracker (LIVE.5, UI.9, UI.4, SCAFFOLD.2 corrections from SPEC.1-AMEND.1) | K_eff drop ripple | **Reconfirmed flagged from `SPEC.6_log` lines 43–44:** still pending Hrishikesh's application. Not blocking ADR-0007 close. |
| Tracker (HARDEN.* additions flagged) | CI lint for log-redaction discipline; uptime monitor | **Flagged for tracker addition by Hrishikesh:** add `HARDEN.*` task — "CI lint: structured-log redaction discipline. Grep route handlers for `console.log(req.body)`, `console.log(...response.body...)`, and equivalent patterns; reject on match. Per ADR-0007." Estimate 0.5d. Add second `HARDEN.*` task — "External uptime monitor (Better Stack / Pingdom / Cronitor pattern) for Vercel + Supabase availability. Per ADR-0007 §"This ADR does not decide"." Estimate 0.5d. |
| `AGENTS.md` | §1 stack section | **Flagged for next AGENTS.md batched update pass:** drop Axiom from the observability vendor list; structured request log served by Vercel runtime logs; CI lint discipline note. |

## More Information

- Sentry Next.js integration: <https://docs.sentry.io/platforms/javascript/guides/nextjs/>
- Sentry source map upload via the Vercel deploy hook: <https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/>
- PostHog Next.js integration: <https://posthog.com/docs/libraries/next-js>
- PostHog feature flags + local evaluation: <https://posthog.com/docs/feature-flags/local-evaluation>
- Vercel runtime logs: <https://vercel.com/docs/observability/runtime-logs>
- ADR-0001 (license — AGPL-3.0)
- ADR-0003 (Next.js 16 + Node.js runtime constraint)
- ADR-0005 (Postgres + event-sourced schema; DEFAULT-partition Sentry alarm minted)
- ADR-0006 (Hosting topology; failure-mode profile that alarm catalogue entry #6 consumes)
- ADR-0013 (Concurrency + 40001 retry semantics)
- ADR-0014 (Pre-commit moderation)
- `AGENTS.md` §1 (stack — observability section to be updated)
- `CLAUDE.md` rows 334 (Sentry), 335 (PostHog), 336 (Axiom — superseded by this ADR)
- SPEC.1 §16.3 H3 (structured request log contract), §15.2 widget #2 (identity-pool low-watermark)
- SPEC.2 §18 (Observability Contract — substantively filled), §22 (Operational Runbook Pointers — alarm catalogue feeds), §23 (ADR Index — status flip)

---

*ADR-0007 ratifies the two-vendor observability surface (Sentry for error tracking + PostHog for analytics + feature flags) for the Zugzwang experiment phase, with Vercel runtime logs serving the SPEC.1 §16.3 H3 structured request log contract and a code-level redaction discipline (CI lint flagged as `HARDEN.*`) replacing middleware enforcement. The six-category Sentry alarm catalogue (append-only-trigger violation, DEFAULT-partition insert, 40001-retry exhaustion, OpenAI moderation upstream-failure rate, identity-pool low-watermark, per-vendor unavailability + cron job failure) mints alarm names with thresholds deferred to `HARDEN.*`. Sentry session-replay is disabled in v1. PostHog `useFlag()` runtime contract is fail-open with safe `defaultValue` discipline. Cost ceiling is single-tier $50/mo total (free tiers cover experiment scale), separate from ADR-0006's hosting tier. Axiom is dropped from v1 — testnet phase decides afresh. The decision body, the fail-open posture, the alarm catalogue names, the `useFlag()` contract, and the structured-log redaction discipline are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
