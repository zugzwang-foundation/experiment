# S-5 Backend Load-Testing Roadmap & Tracker

**Status:** Execution roadmap / tracker  
**Scope:** Backend, API, DB/pool/pooler, backend observability, load execution support  
**Load generator:** DGX Spark + k6  
**System under test:** `https://staging.zugzwangworld.com`  
**Current HEAD verified on DGX:** `940cdcb1b61d68c99f6d0a2a89894b7b61af77bd`  
**Current k6:** v2.2.0 Linux ARM64  
**Current Doppler CLI:** v3.76.5  

> **Important:** This tracker assumes the required S-5 governance decisions have been approved. Before any stage is marked READY, re-check the live decision register and current staging state. Never invent a target that is still marked TBR/open in the governing S-5 documents.

---

## 1. Backend Mission

Prove the real backend capacity and identify the first backend bottleneck under controlled traffic, while preserving correctness.

The backend work covers:

- API/request latency
- request timeouts and hangs
- database connections
- pool and pooler saturation
- transaction duration
- queue depth
- backend utilisation
- locks / serialization / deadlocks
- idempotency
- signup identity-pool contention
- write-path correctness
- cache/backend interaction
- third-party contribution to backend latency
- post-load connection cleanup

### Ratified scale context

Current S-5 source material distinguishes these quantities:

- **100,000 cumulative signups**
- **2,000,000 cumulative page loads**
- **≤5,000 concurrent users**
- **~90% audience/read + ~10% bettor/write** mixed profile

Do **not** interpret 100,000 cumulative signups as 100,000 concurrent users unless a superseding decision explicitly changes the governing target.

---

# 2. Ownership Split

## Backend Developer 1 — Core API / DB / Pool

Primary ownership:

- API request paths
- DB pool behavior
- pool/pooler measurements
- transaction timing
- timeout / wall-clock implementation when approved
- `PENDING_TTL_SECONDS` derivation input
- bet/signup transaction instrumentation
- DB correctness under load
- post-run reconciliation support

## Backend Developer 2 — Load Harness / Observability / Fixtures / Vendor Boundaries

Primary ownership:

- k6 scenario implementation
- request data model
- test fixture orchestration
- correlation IDs / timestamps
- backend sampler integration
- cache/Upstash measurement support
- third-party safety controls
- run artifacts
- result normalization
- bottleneck reports

> Ownership does not authorize changes outside the assigned lane. Cross-lane production changes require the project's existing approval / ritual process.

---

# 3. Current Environment

| Component | Current state |
|---|---|
| DGX Spark | `spark-3100` |
| Architecture | ARM64 / aarch64 |
| CPU | 20 cores |
| RAM | ~121 GiB |
| GPU | NVIDIA GB10 |
| k6 | v2.2.0, standalone ARM64 |
| k6 path | `/home/zugzwang/.local/bin/k6` |
| Doppler | v3.76.5 |
| Doppler scope | `zugzwang-experiment / stg` |
| Node | v24.19.0 via mise |
| pnpm | v10.33.2 via mise |
| just | v1.58.0 |
| staging | `https://staging.zugzwangworld.com` |
| loadtest directory | `loadtest/` exists; scripts must follow governance before adding content |

### Runtime rule

Do not use bare system Node from `/usr/bin/node` for S-5 Node tooling. Use:

```bash
mise exec -- pnpm <command>
```

For staging-secret-backed commands:

```bash
doppler run --project zugzwang-experiment --config stg -- \
mise exec -- pnpm <command>
```

k6 is standalone and does not require mise:

```bash
k6 run <script>.js
```

---

# 4. Backend Request Inventory

## Read paths

- `GET /`
- `GET /m/[slug]`
- `GET /u/[pseudonym]`
- `GET /m/[slug]/quote`
- `GET /m/[slug]/export`
- `/api/visits`
- market/discovery data paths
- 15-second market polling behavior

## Signup

- `POST /api/auth/[...all]`
- Google OAuth path
- email OTP path
- onboarding Server Action
- identity-pool checkout

## Write / transaction

- `POST /api/bets/place`
- `POST /api/bets/sell`
- comments / comment-related write paths
- moderation dependency where applicable

## Adversarial paths

- concentrated writes on a single hot market
- concurrent cache misses on one cache key
- retry/idempotency storms

---

# 5. Backend Readiness Gates

All items must be tracked before Stage 3+ runs.

| ID | Gate | Owner | State | Evidence / Exit Criteria |
|---|---|---|---|---|
| BE-01 | Governance approvals recorded | Both / owner | ☐ | Decision references attached |
| BE-02 | Current commit / staging canary recorded | Dev 2 | ☐ | Exact canary per run |
| BE-03 | `sample-backend-activity.ts --self-test` | Dev 2 | ☐ | Green, JSONL produced |
| BE-04 | `verify-pooler-mode.ts` | Dev 1 | ☐ | Mode + date recorded |
| BE-05 | `connect_timeout` ruling/implementation | Dev 1 | ☐ | Approved value + rationale |
| BE-06 | money-path wall-clock / `maxDuration` ruling | Dev 1 | ☐ | Approved behavior |
| BE-07 | `PENDING_TTL_SECONDS` derivation plan | Dev 1 | ☐ | Written derivation / bounded upstream wall clock |
| BE-08 | live staging identity count | Dev 2 | ☐ | Fresh count, timestamped |
| BE-09 | test-data volume accepted | Dev 2 | ☐ | Fixture manifest + validation |
| BE-10 | Sentry sampling posture | Dev 2 / SRE | ☐ | Decision recorded |
| BE-11 | queue-depth measurement path | Dev 2 | ☐ | Dashboard/effect method proven |
| BE-12 | `f_db` measurement method | Dev 1 + Dev 2 | ☐ | Formula + correlation method |
| BE-13 | source-IP strategy | Dev 2 | ☐ | Rate-limit behavior documented |
| BE-14 | fixture destruction approval | Dev 2 | ☐ | Reset/rebuild procedure accepted |
| BE-15 | vendor-cost posture | Dev 2 | ☐ | Per-stage spend estimate / cap |

---

# 6. Workstream A — Backend Instrumentation

## A1. HTTP metrics

Capture per request / scenario:

- timestamp
- scenario
- endpoint
- method
- status
- duration
- error classification
- timeout classification
- request/response bytes where useful
- correlation ID / run ID

Required aggregate output:

- offered RPS
- served RPS
- p50
- p90
- p95
- p99
- status distribution
- error rate
- timeout/hang rate

## A2. DB metrics

Capture / correlate:

- active connections
- idle-in-transaction
- queue depth effect
- backend utilisation
- transaction duration
- wait events
- lock waits
- deadlocks
- 40001 / 40P01
- retry counts when available
- `f_db`
- post-load stranded connections

Use `scripts/sample-backend-activity.ts` as the primary sampler where the S-5 plan specifies it.

## A3. Cache-adjacent backend signals

Capture or correlate:

- cache-hit vs miss where instrumentation exists
- invalidation events
- Upstash request/command volume
- write-triggered invalidation frequency
- cache stampede indicators

---

# 7. Workstream B — Test Data & Fixtures

## Required fixture classes

- users / auth identities
- identity-pool rows
- markets
- comments
- bets
- event history
- hot-market distribution
- discovery/featured-market population

### Fixture controls

- deterministic generation where possible
- manifest with counts and IDs
- reset procedure
- rebuild procedure
- md5/hash or equivalent baseline where the project's fixture process requires it
- explicit contamination risk

### Identity-pool gate

Do not assume the namespace size from prose alone.

Record:

- target
- source of truth
- current expected-total assertion in scripts
- live unassigned count
- PFP asset readiness
- ownership of generation/seeding work

---

# 8. Workstream C — k6 Load Harness

## Harness design principles

Use independent scenarios with clear tags:

- `rig-proof`
- `positive-control`
- `read`
- `mixed`
- `signup`
- `write`
- `hotspot`
- `cache-stampede`
- `spike`
- `soak`
- `ceiling`

Use VU executors when testing concurrency.

Use arrival-rate executors only where an approved rate is the actual workload requirement.

Do not invent final RPS values.

## Every request should carry

- `run_id`
- `scenario`
- `endpoint`
- `operation`
- `test_user_id` only if safe and appropriate

Keep secrets out of logs.

---

# 9. Workstream D — Rig Self-Proof

Before the application is hit with meaningful traffic:

```text
DGX
 ↓
k6
 ↓
trivial/static endpoint
 ↓
prove generator ceiling
```

Measure:

- maximum sustainable request rate under the chosen connection-reuse posture
- generator CPU
- generator memory
- network
- connection count
- file descriptor usage

Current DGX limits recorded during setup:

- file descriptors: 500,000 soft/hard
- ephemeral ports: 32768–60999

HTTP keep-alive should be preserved unless the test specifically requires connection churn.

---

# 10. Workstream E — Load Stages

## Stage 0 — Preconditions

**No real load.**

Clear all approved gates before Stage 3.

## Stage 1 — Noise Floor

Purpose:

- establish baseline DB activity
- establish baseline cache behavior
- establish application latency baseline
- validate sampler

Output:

`stage1-baseline-<run_id>.jsonl`

## Stage 2 — Positive Control

Purpose:

- prove the harness can detect a known passing condition
- prove a known failing condition actually fails

Do not use a failure mechanism that has already been fixed unless the current source proves it still reproduces.

## Stage 3 — Read Load

Measure:

- homepage/discovery
- market page
- user page
- quote/export paths where in-scope
- visits
- polling

Special backend risks:

- sequential discovery fan-out
- unbounded comment scan
- unbounded replay/event-history scan
- repeated layout-triggered server work

## Stage 4 — Mixed Traffic

Ratified shape:

- ~90% audience/read
- ~10% bettors/writes
- adversarial high-writer overlay

Measure reads and writes simultaneously.

## Stage 5 — Signup

Default model from current plan:

- high-volume internal signup/database path
- bounded real HTTP sample for wire-level behavior

Measure:

- signup latency
- identity-pool contention
- lock behavior
- deadlock recurrence
- once-only grant/idempotency
- exhaustion behavior

Abort on correctness violation or recurrence of the failure condition being guarded against.

## Stage 6 — Write / Transaction

Measure:

- place bet
- sell bet
- comments as approved
- transaction latency
- queue wait
- lock contention
- retries
- moderation contribution
- idempotency

Post-run reconciliation is mandatory.

## Stage 7 — Hotspot / Adversarial

Test:

- concentrated writes on one market / pool row
- concurrent misses on one cache key

Measure:

- throughput ceiling
- retry ladder
- queue depth
- cache stampede
- lock waits

## Stage 8 — Spike

Start from cold state where the approved profile requires it.

Measure:

- ramp response
- queue growth
- latency tail
- recovery
- cache warm-up
- backend resource recovery

## Stage 9 — Soak / Post-load

Run sustained moderate load, then stop traffic.

Continue observation for at least the approved post-load window; the current S-5 design calls for **≥15 minutes**.

Measure:

- stranded connections
- pool cleanup
- memory/resource recovery
- queue decay
- cache behavior after load

## Stage 10 — Controlled Ceiling

Increase traffic progressively.

At each level record:

- offered RPS
- served RPS
- p95/p99
- queue depth
- backend utilisation
- DB connections
- cache state
- errors/timeouts

The saturation point must be determined from observed system behavior, not a guessed RPS.

---

# 11. Backend Bottleneck Decision Tree

When latency degrades:

```text
Latency ↑
  │
  ├─ Offered RPS > Served RPS?
  │       └─ YES → queue / saturation investigation
  │
  ├─ Backend utilisation near ceiling?
  │       └─ YES → pool/pooler/DB investigation
  │
  ├─ DB connections near Pool Size?
  │       └─ YES → pool pressure
  │
  ├─ Lock waits / 40001 / 40P01 ↑?
  │       └─ YES → contention investigation
  │
  ├─ Cache misses ↑ while writes ↑?
  │       └─ YES → invalidation/cache amplification
  │
  ├─ External latency ↑?
  │       └─ YES → third-party contribution
  │
  └─ CPU/memory saturation?
          └─ YES → compute/runtime investigation
```

### Never conclude “healthy” from zero HTTP errors alone.

Transaction-pool saturation may present as latency/queueing before HTTP failures. Queue depth and backend utilisation are therefore primary saturation evidence.

---

# 12. Backend Correctness Checks

Every write run must reconcile:

- no duplicate charge / double processing
- idempotency
- grant-once semantics
- daily-once semantics where applicable
- lot-sum consistency
- single-side consistency
- event parity
- receipt/ledger completeness
- comment/body correctness where the project's safety assertions require it

A fast but incorrect test is a failed test.

---

# 13. Backend Run Tracker

| Run ID | Stage | Profile | VUs / Rate | Duration | DB Max | Queue Peak | p95 | p99 | Errors | Correctness | Result | Evidence |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| RUN-001 | Rig proof | Static | TBR | TBR | — | — | — | — | — | PASS/FAIL | ☐ | |
| RUN-002 | 1 | Noise floor | 0 | TBR | | | | | | | ☐ | |
| RUN-003 | 2 | Positive control | TBR | TBR | | | | | | | ☐ | |
| RUN-004 | 3 | Read | TBR | TBR | | | | | | | ☐ | |
| RUN-005 | 4 | Mixed 90/10 | TBR | TBR | | | | | | | ☐ | |
| RUN-006 | 5 | Signup | TBR | TBR | | | | | | | ☐ | |
| RUN-007 | 6 | Write | TBR | TBR | | | | | | | ☐ | |
| RUN-008 | 7 | Hotspot | TBR | TBR | | | | | | | ☐ | |
| RUN-009 | 7 | Cache stampede | TBR | TBR | | | | | | | ☐ | |
| RUN-010 | 8 | Spike | TBR | TBR | | | | | | | ☐ | |
| RUN-011 | 9 | Soak | TBR | TBR | | | | | | | ☐ | |
| RUN-012 | 10 | Ceiling | TBR | TBR | | | | | | | ☐ | |

> Replace TBR values only after the governing decision is recorded.

---

# 14. Per-Run Evidence Package

Every real run should produce:

```text
run metadata
├── git commit
├── staging canary
├── environment
├── k6 version
├── scenario configuration
├── VUs / arrival rate
├── duration
├── source-IP posture
├── Sentry sampling posture
├── fixture manifest/hash
└── timestamp

k6
├── raw output
├── summary JSON
└── request-level records if enabled

backend
├── sampler JSONL
├── queue/backend-util evidence
└── DB error/retry evidence

cache
├── hit/miss evidence where available
└── vendor metrics

post-run
├── reconciliation
├── staging gates
└── cleanup / fixture reset result
```

---

# 15. Stop Conditions

Immediately stop a run for:

- data corruption
- invariant violation
- double-charge signature
- deadlock recurrence when it is a guarded failure
- uncontrolled queue growth
- unbounded request hang
- vendor quota/cost risk beyond authorization
- load-generator saturation
- staging instability
- missing observability that makes the result uninterpretable

---

# 16. Backend Bottleneck Register

| ID | Layer | Candidate | Evidence | Measurement | Status | Next Action |
|---|---|---|---|---|---|---|
| BR-BE-01 | Pooler | Queueing before backend assignment | transaction-mode behavior | queue depth + offered/served divergence | ☐ | |
| BR-BE-02 | DB pool | `max` ceiling | current code / pool measurements | backend count vs ceiling | ☐ | |
| BR-BE-03 | DB | Long transaction | transaction duration | sampler JSONL | ☐ | |
| BR-BE-04 | DB | Lock contention | wait events / retries | hot-row run | ☐ | |
| BR-BE-05 | DB | Unbounded read | query duration / returned volume | read workload | ☐ | |
| BR-BE-06 | API | Wall-clock hang | queue wait before backend | request timeout + queue | ☐ | |
| BR-BE-07 | Signup | Identity-pool contention | checkout time | signup volume | ☐ | |
| BR-BE-08 | Cache | Write-driven invalidation | miss rate under writes | mixed run | ☐ | |
| BR-BE-09 | Vendor | Moderation latency | component timing | bounded vendor/stub test | ☐ | |
| BR-BE-10 | Infra | Cold-start penalty | request duration | cold-start test | ☐ | |

---

# 17. Definition of Done — Backend

Backend S-5 is complete only when:

- [ ] Governance decisions are recorded.
- [ ] Current staging canary is recorded for every run.
- [ ] `sample-backend-activity.ts --self-test` is green.
- [ ] Pooler mode is verified and recorded.
- [ ] Required timeout/wall-clock decisions are resolved.
- [ ] Identity-pool readiness is measured.
- [ ] Realistic fixtures are validated.
- [ ] k6 rig self-ceiling is proven.
- [ ] Noise floor is captured.
- [ ] Positive control passes.
- [ ] Read load completed.
- [ ] Mixed 90/10 load completed.
- [ ] Signup workload completed as approved.
- [ ] Write/transaction workload completed as approved.
- [ ] Hotspot/cache-stampede workloads completed.
- [ ] Spike completed.
- [ ] Soak + post-load observation completed.
- [ ] Controlled ceiling completed.
- [ ] Correctness reconciliation passes.
- [ ] Bottleneck register contains measured evidence.
- [ ] Before/after optimization re-test exists for every adopted fix.
- [ ] Final measured capacity is documented.

---

# 18. Daily Operator Checklist

Before each run:

- [ ] confirm approved scenario
- [ ] confirm staging canary
- [ ] confirm fixtures
- [ ] confirm k6 version
- [ ] confirm DGX health
- [ ] confirm source-IP posture
- [ ] confirm vendor-cost posture
- [ ] confirm Sentry posture
- [ ] confirm DB sampler
- [ ] confirm abort conditions

During:

- [ ] watch offered vs served RPS
- [ ] watch p95/p99
- [ ] watch queue depth
- [ ] watch DB utilisation
- [ ] watch cache
- [ ] watch errors/timeouts
- [ ] watch generator utilisation

After:

- [ ] save raw evidence
- [ ] run reconciliation
- [ ] run staging gates
- [ ] reset/rebuild fixtures if approved
- [ ] record result and anomalies

---

# 19. Rule for Optimisation

Do not change backend code simply because a bottleneck is theoretically plausible.

Use this chain:

```text
Observed degradation
        ↓
Measured bottleneck
        ↓
Approved change
        ↓
One-variable re-test
        ↓
Measured improvement
```

Every optimization must state:

- measured problem
- expected benefit
- correctness risk
- owner
- rollback
- verification run

---
