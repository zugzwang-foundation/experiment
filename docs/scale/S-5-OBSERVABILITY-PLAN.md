# S-5-OBSERVABILITY-PLAN — what must be measurable before a load run

> **Status:** PLAN · planning only · **no instrumentation is added here**
> **Date:** 2026-08-30 · **Base:** `origin/main` = `44c9f99`
>
> ⛔ **The governing constraint is Scale-tracker W-10 / ADR-0038 P1:** after the transaction-pooler
> flip an overloaded pool **queues** rather than erroring, so *"load run #1 could report 'zero
> errors' against a saturated pool — a false PASS."* **Error rate is not a saturation signal in
> this system.** Queue depth and backend utilisation are.
>
> ⚠ **And the instrument lies before the code does** (S-3's lesson, three times over). Every
> metric below needs a **positive control** — a condition under which it demonstrably moves —
> before a quiet reading is allowed to mean anything.

---

## 0 · What exists today

| Instrument | What it gives | Limit |
|---|---|---|
| **`scripts/sample-backend-activity.ts`** | `pg_stat_activity` sampled to **JSONL** — `state`, `xact_start`, `query_start`, `state_change`, wait event, per period. Carries **`--self-test`** and a clock offset taken at start **and** end | Opens its **own** `:5432` client and **refuses to start against `:6543`** (an observation must not ride the pooler it observes). ⚠ Its docblock records that on 2026-08-24 *"the live screen missed a real 1.7 s bet transaction entirely"* — ⛔ **the console is not the record, the JSONL is** |
| **`scripts/verify-pooler-mode.ts`** | Which pooler the **shipped** `@/db` singleton actually opens | The one script authorised to import `@/db` (AGENTS.md §7 sole exception), run as `tsx --conditions=react-server` |
| **`/api/health`** | `canary` (commit SHA), `region`, `db: ok\|error`, migration-drift status | ⛔ **Booleans only.** Does real DB work through the shipped pool but **opens no transaction, reads back no GUC, returns no timing** — by a hard constraint in its own docblock. **This is why `f_db` is not observable from it** (ADR-0038 P1.4) |
| **Sentry** | Errors + traces, `tracesSampleRate: 1.0` on server, edge and client | ⛔ 1.0 on all three — see MISSING-9 |
| **PostHog** | Product analytics (`posthog-node`, `posthog-js`) | Funnels, not latency percentiles |
| **`pnpm staging:gates`** | Six verification gates; emits `docs/polish/staging-coverage.json`, fails RED on drift | Correctness, not performance |
| **`tests/scale/_harness/perf.ts`** | Recorded-only p50/p95/max per storm, JSONL | In-process, local Postgres, **no HTTP** |

---

## 1 · Metric inventory

**AVAILABLE** = capturable today with no new code · **PARTIAL** = obtainable but not from
this repo, or only for one layer · **MISSING** = nothing produces it.

### 1.1 HTTP

| Metric | Status | Source / gap | Positive control |
|---|---|---|---|
| RPS (offered) | **MISSING** | no load generator exists | rig's own counter |
| RPS (served) | **MISSING** | — | compare offered vs served; divergence *is* the queue |
| Throughput (bytes) | **MISSING** | — | — |
| p50 / p90 / p95 / p99 | **MISSING** | ⚠ `p95 < 500 ms @ 5k VUs` is a **ratified gate with no instrument** (ENGINE.10) | a deliberately slowed endpoint must move p99 |
| Errors by class | **PARTIAL** | Sentry captures them; **not correlated to offered load** | force a 429 by exceeding `betPerIp` |
| **Timeouts / hangs** | **MISSING** | ⛔ **BR-1** — nothing bounds the wall clock, so a hang has no upper edge to record | a saturated pool must produce a measurable tail |
| Status-code distribution | **MISSING** | — | — |
| **Rate-limiter decisions** | **MISSING** | ⛔ `checkRateLimit` **fails open** (ADR-0015) — a degraded Upstash silently stops limiting | drive one IP past 30/min and see the decisions recorded, not inferred |

### 1.2 Database

| Metric | Status | Source / gap | Positive control |
|---|---|---|---|
| Active connections | **AVAILABLE** | `sample-backend-activity.ts` | `--self-test` opens a deliberate READ ONLY tx |
| Idle-in-transaction | **AVAILABLE** | same | same |
| **Waiting / queue depth** | ⛔ **PARTIAL — the critical gap** | ⛔ *"No database query can attribute load to a pooler"* — every pooled connection presents as `application_name = "Supavisor"` from one address. Attribution must come from **the Supabase dashboard** or from an **effect** (backend count against a known ceiling), **never from connection identity** (S-1-close) | offered-vs-served divergence at a known backend ceiling |
| **Backend utilisation vs Pool Size 15** | **PARTIAL** | count from the sampler ÷ the known ceiling; the ceiling itself is dashboard-side | — |
| Query latency | **PARTIAL** | ⚠ `pg_stat_statements` availability **NOT VERIFIED** this session (O-13) | — |
| Transaction duration | **AVAILABLE** | `xact_start` → `state_change` deltas in the JSONL | the 1.7 s bet the console missed was recoverable from exactly this |
| Lock waits | **AVAILABLE** | wait-event column | hot-row storm |
| Deadlocks | **PARTIAL** | Postgres logs; **not surfaced in-repo** | — |
| **Serialization failures (40001/40P01)** | **PARTIAL** | retried internally with full-jitter; ⚠ **`tests/scale` deliberately never asserts retry counts** — so the retry is invisible unless the run captures it | a hot-row storm must raise the count |
| **`f_db`** (fraction of a render holding a backend) | ⛔ **MISSING** | ⛔ *"not observable from S-1… S-5 must measure it. **W-9 does not close without it**"* | — |
| **Stranded connections after suspension** | ⛔ **MISSING** | ⛔ **620 s idle observed** with a 20 s `idle_timeout` and 600 s `max_lifetime` both live, because Fluid suspends and a suspended instance runs no timers | sample for ≥15 min **after** the load stops |

### 1.3 Cache

| Metric | Status | Source / gap | Positive control |
|---|---|---|---|
| **`"use cache"` hit / miss rate** | ⛔ **MISSING** | ⛔ **Nothing in the repo counts a Next Data-Cache or `"use cache"` hit.** S-4's figures are **statement counts on one user**, which is a different quantity | place a bet and watch the debate-view entry miss (it is keyed on `reserves`) |
| Hit rate **segmented by market write-rate** | ⛔ **MISSING** | the measurement **BR-7** needs; invisible to a single-user test by construction | — |
| Upstash command volume | **PARTIAL** | vendor dashboard; ⚠ **≥2,000,000 from the visits `INCR` alone** at target | drive `/api/visits` and watch the counter |
| Upstash latency / errors | **PARTIAL** | dashboard + Sentry; ⚠ transport is pinned (`REDIS_MAX_RETRIES` 1, flat 200 ms backoff, 2000 ms abort) | — |
| **Data Cache holding for the star count** | ⛔ **MISSING, and silent by construction** | ⛔ *"the budget burns within minutes and the header renders with no count **permanently, with nothing going red**"* | assert the rendered count is present **and** GitHub call count stays ≤4/hr |
| Cache stampede | **MISSING** | no in-flight dedup metric | N concurrent misses on one key at t=0 |
| Cold-cache behaviour | **PARTIAL** | `parked.md` COLD-START has one-off figures (~790 ms health, ~1.75 s Discovery after ~10 min idle) | — |

### 1.4 Infrastructure

| Metric | Status | Source | Note |
|---|---|---|---|
| Postgres CPU / memory | **PARTIAL** | Supabase dashboard | ⛔ **the input to the Large→XL decision, which ADR-0038 says requires a measured number, not a projection** |
| Vercel instance count | **PARTIAL** | Vercel dashboard | `max: 4` × instances = the real client ceiling |
| Function execution duration | **PARTIAL** | Vercel dashboard | ⚠ the project's **default duration is UNMEASURED** — S-3 handed this to S-5 as H-5, and it is **BR-1's other half** |
| Cold starts | **PARTIAL** | Vercel + COLD-START figures | — |
| Network / region | **AVAILABLE** | `/api/health` → `region` | ⚠ **prod reports `None`** |
| **Deployed artifact identity** | **AVAILABLE** | `/api/health` → `canary` | ⛔ **record it per run.** The prod pooler guard is *a property of the artifact, not the source* — a preview build eliminates it as dead code |

### 1.5 External services

| Service | Requests | Latency | Failures | Quota events |
|---|---|---|---|---|
| **OpenAI moderation** | **PARTIAL** (vendor) | ⛔ **MISSING as a component of bet wall clock** — the number that matters | PARTIAL (Sentry, fail-closed) | PARTIAL |
| **Resend** | PARTIAL | MISSING | PARTIAL | ⚠ **the 30/s ask is in flight** (tracker F-3/W-6) |
| **R2** | MISSING | MISSING | PARTIAL | MISSING |
| **GitHub** | ⛔ **MISSING** | — | ⛔ **silent** | ⛔ **60/hr per-IP, region-shared** |
| **Sentry** | AVAILABLE | — | — | ⛔ **1.0 sampling — see below** |
| **PostHog** | PARTIAL | — | — | PARTIAL |

---

## 2 · The nine gaps that block a valid run

| # | Gap | Why it blocks | Closes at |
|---|---|---|---|
| **MISSING-1** | HTTP percentiles / RPS | there is no load generator; a ratified `p95` gate has no instrument | Stage 2 (rig) |
| **MISSING-2** | **Queue depth + backend utilisation** | ⛔ **W-10.** Without it a saturated run reports a false PASS | Stage 1 |
| **MISSING-3** | **`f_db`** | ⛔ **W-9 does not close without it**, and it is the denominator the whole ceiling estimate rests on | Stage 1/3 |
| **MISSING-4** | **Stranded connections after suspension** | ⛔ it is the quantity `max` actually protects; a throughput-only run measures the wrong thing | Stage 3 + a post-run window |
| **MISSING-5** | **Cache hit rate under write load** | S-4's numbers are single-user; **BR-7** is invisible without it | Stage 4 |
| **MISSING-6** | Rate-limiter decisions | fail-open means the run can silently change what it measures | Stage 2 |
| **MISSING-7** | Star-count Data-Cache assertion | the failure is **silent by design** | Stage 3 |
| **MISSING-8** | Vercel function duration default | **BR-1's other half** (S-3 handover H-5) | Stage 0 (dashboard read) |
| **MISSING-9** | **Sampling posture** | ⛔ `tracesSampleRate: 1.0` on three runtimes ⇒ the instrumentation both **burns quota** at 2 M loads **and distorts the latency it measures** | ⛔ **Stage 0 — a recorded decision, not a default** |

---

## 3 · Instrumentation roadmap (planning only — build nothing yet)

| Step | Work | Owner | Acceptance |
|---|---|---|---|
| **O-1** | Read the Supabase dashboard for Pool Size, `max_connections`, **`pool_checkout_timeout`**; read Vercel for the function-duration default. **Record values + date** | SRE | four values written down with their date (**O-13**: an endpoint that cannot answer has not answered) |
| **O-2** | Run `sample-backend-activity.ts --self-test` against the intended target | SRE | ⛔ **green before any quiet screen is read as a finding** |
| **O-3** | Decide + record the run's Sentry sampling posture | founder | MISSING-9 closed |
| **O-4** | Define the rig's per-request record: URL · status · **wall clock** · limiter decision · `canary` · pooler mode | load architect | schema written; **not built** |
| **O-5** | Define the correlation key joining rig records to sampler JSONL — ⚠ **via the clock offset the sampler already takes at start and end**, never an assumed shared clock | load architect | documented |
| **O-6** | Define cache hit/miss capture, segmented by market write-rate | frontend/perf | ⚠ **the only genuinely new instrumentation this plan needs**, and it touches a `"use cache"` path — CLAUDE.md §5.14 **SC-1 fires** if any read over `comments.body` changes |
| **O-7** | Define the post-run observation window (≥15 min) for stranded connections | SRE | MISSING-4 closed |
| **O-8** | Define the star-count positive assertion | frontend | MISSING-7 closed |
| **O-9** | Per-run provenance block: invocation · resolved host · **pooler mode** · `canary` · compute tier · fixture state · sampling posture · what ended the run | load architect | template written |

---

## 4 · The three rules every run obeys

1. ⛔ **Never read an exit code from a wrapper.** S-3 saw *"exit code 0"* reported twice while the runner had returned **1** — the wrapper's status, not the measurement's. **Have the command write its own exit code to a file and read that.**
2. ⛔ **A negative result needs a positive control.** *"A deadlock test that always hangs is indistinguishable from one that detects a deadlock."* Every stage needs a level that **passes** as well as one that fails, or *"the system held"* means nothing.
3. ⛔ **Measure the noise floor first.** Staging carries background traffic; without a quiet baseline, attribution is guesswork. S-3's rest measurement (0 of 8 samples) is what made its loaded observation meaningful.

---

*Plan only. No instrumentation was added, no dashboard was changed, no metric was collected.*
