# 07 — Staging Load / Stress Test Plan (STAGING ONLY)

| | |
|---|---|
| **Status** | **EXECUTED 2026-09-25** (approved and run stages 1–6; results in `08-STAGING-LOAD-TEST-RESULTS.md`). Deviations from the text below are recorded there: CPU judged against the host rather than the task share, `max_connections` measured at 79, Stage 2 stopped at 25, Stage 3 at 25, one staging task restart, no temporary dashboard created. |
| **Target** | `https://staging.zugzwangworld.com` → ALB `Zugzwa-Alb16-HmxvcNoTyCq8` → ECS task on `i-0ee255037045d2303` → RDS `zugzwang-staging-database-…` (restored production copy + test data) |
| **Never targets** | `zugzwangworld.com` (production on Vercel + Supabase), any `*.supabase.co` / `*.pooler.supabase.com` host, any `prd` Doppler value |
| **Written** | 2026-09-25, from measured staging facts (§1), not from generic load-test templates |

## 0. Why this plan looks the way it does

Staging is deliberately small — one `t3.small` host running one task reserved at **0.5 vCPU / 1 GiB**, in front of a **`db.t4g.micro`** — and both are *burstable*. That means the interesting failure modes are not "how many thousands of users" but **where the first cliff is** and **whether the system degrades gracefully or falls over**: CPU credits running out (a hard throttle to 10 % of a core on the database), the per-instance connection pool of **2** saturating, the bet path's **1 000 ms `statement_timeout`** starting to refuse writes, and 2.9 MB server-rendered market pages eating the task's CPU. The plan therefore ramps in small steps, stops at the first breach, and spends its budget on the write path — the only path that can lose money.

## 1. Measured baseline the thresholds derive from

| Fact | Value | Where it comes from |
|---|---|---|
| App capacity | 1 task, 512 CPU units (0.5 vCPU), 1024 MiB hard / 512 soft; `maxCapacity: 1` (no scale-out by design) | `infra/config/staging.ts`, ADR-0051 |
| Host | `t3.small` (2 vCPU burstable, 2 GiB), CPU credits now ≈ 203 (earns 24/h, baseline 20 %/vCPU) | CloudWatch `CPUCreditBalance` |
| Database | `db.t4g.micro` (2 vCPU burstable, 1 GiB), CPU credits now ≈ 72 (earns 12/h, cap 288, **baseline 10 % when exhausted**) | CloudWatch `CPUCreditBalance` |
| `max_connections` | `LEAST(DBInstanceClassMemory/9531392, 5000)` ≈ **112**; confirm with `show max_connections` at test time | RDS default parameter group formula |
| App connection pool | **`max: 2` per task**, `idle_timeout` 20 s, `max_lifetime` 600 s, `prepare: false` | `src/db/index.ts` |
| Bet transaction | SERIALIZABLE, pool row locked, `statement_timeout` **1 000 ms**, `idle_in_transaction_session_timeout` 30 s, **6 attempts** full-jitter `[50,100,200,400,800]` on 40001/40P01 | `src/server/bets/transaction.ts` |
| Measured write ceiling (local PG, one pool row) | 0 % refused at 64 concurrent writers with 6 attempts; 64-way storm 595 ms–1.0 s | `tests/scale/write-ceiling-sweep.scale.test.ts` |
| Read caches | shared debate view 15 s · discovery price 5 s · market series 60 s · debate poll every 30 s | `src/server/config/limits.ts` |
| Page weights (measured on staging) | `/` 105 KB in 1.1 s · `/m/[slug]` **2.9 MB** in 2.2–3.1 s · `/u/[pseudonym]` 69–103 KB in 0.4 s · `/api/health` 0.13 s | this session, over HTTPS |
| Stake bounds | post ≥ Đ 10, reply ≥ Đ 50, max Đ 250 | `limits.ts` |
| Outbound per bet | OpenAI moderation (3 s timeout, 1 retry) **before** the tx; Upstash rate-limit (fails open) + idempotency (fails **closed**) | ADR-0014/0015 |
| Alarms already armed (staging) | 5xx ≥ 20 / 5 min · p95 ≥ 3 s ×2 · CPU/memory ≥ 85 % ×2 · unhealthy host · cron failed · cron silent | Monitoring stack |
| Current idle | RDS connections ≈ 1.2, ALB ≈ 2 req/min (health checks + cron) | CloudWatch |

## 2. Safety — how the test cannot touch production

1. **Host pinning.** Every generator run starts with a pre-flight that resolves `staging.zugzwangworld.com` on the authoritative nameservers and **refuses unless the CNAME target is the staging ALB**; it also refuses any base URL that is not exactly that hostname. The apex `zugzwangworld.com` is a hard-coded reject.
2. **Database pinning.** The pre-flight reads the `zugzwang/staging` secret and refuses unless `DATABASE_URL`'s host matches `*staging*.ap-south-1.rds.amazonaws.com`; any `supabase` substring aborts.
3. **Credentials.** Only Doppler `stg` and the `zugzwang/staging` secret are ever loaded. `prd` is never read by any load script.
4. **Test identities and a dedicated market.** Writes are made only by generated test users (`lt-*` pseudonym prefix, minted through the engine's own onboarding path so they hold a real initial grant) and only on **one dedicated test market** created for the run. The six restored production-derived markets and their pools are read-only for the whole test: the generator carries an allow-list of one market id and refuses any other.
5. **Snapshot first.** A manual RDS snapshot of the **staging** instance is taken before phase 3 (`zugzwang-staging-pre-load-<date>`), so the database can be returned to its pre-test state if wanted.
6. **Abort authority.** The operator can stop any stage; every k6 run is bounded by `--duration`, and the abort thresholds in §6 stop a stage automatically.
7. **Nothing changes in infrastructure.** No CDK deploy, no config change, no secret change. If a limit is found that warrants a change, it is reported, not applied.

## 3. Critical flows under test

| # | Flow | Route(s) | Type | Why it matters |
|---|---|---|---|---|
| F1 | Discovery | `GET /` | SSR read, 5 s / 15 s caches | the landing page; first thing every participant loads |
| F2 | Market page | `GET /m/[slug]` | SSR read, **2.9 MB** | the heaviest render; the debate view |
| F3 | Debate poll | `GET /m/[slug]/version` | light read, every 30 s per open tab | scales with open tabs, not clicks — the quiet load multiplier |
| F4 | Profile | `GET /u/[pseudonym]` | SSR read | second most visited page |
| F5 | Export | `GET /m/[slug]/export` | read, 250 KB markdown | occasional, expensive-ish |
| F6 | Quote | `GET /m/[slug]/quote?side&stake` (session) | CPMM read | called while composing a bet |
| F7 | **Place bet** | `POST /api/bets/place` (session, idempotency key, comment) | **the money path**: OpenAI → SERIALIZABLE 9-table tx under the pool-row lock | the only flow that can lose money; contention is per market |
| F8 | **Sell** | `POST /api/bets/sell` (session, idempotency key) | write tx, lots/pro-rata | second write path |
| F9 | Health | `GET /api/health` | DB round trip | what the ALB and the deploy gate believe |

Not tested: Google sign-in (Google would throttle and it isn't our code), OTP email (would spend Resend quota), image upload to R2 (staging bucket cost; covered functionally already), admin surfaces.

## 4. Test identities and sessions (staging only)

- **Users:** minted through the engine's real onboarding path (`createOAuthUser` → pseudonym from `identity_pool` → `acceptTosAction` → initial grant), the same path the existing staging fixture generator (`tests/staging/generate.staging.test.ts`, ADR-0036) uses — run against the staging RDS through the SSM tunnel with `DATABASE_URL` / `STAGING_PROJECT_REF_FRAGMENT` overridden to the RDS endpoint. Count: **60** (enough for the highest write stage; Đ 1 000 each covers 100 bets at the minimum stake).
- **Sessions:** minted directly as Better Auth sessions (`sessions` row + cookie value signed with the staging `BETTER_AUTH_SECRET` from the AWS secret). This is the only "back door" in the plan; it exists because Google sign-in cannot be automated, and it is **staging-only by construction** (the secret it signs with is the staging secret). Sessions expire at the end of the run (short `expires_at`).
- **Test market:** one market created via the engine (`createMarket` → `openMarket`), slug `lt-load-<date>`, seeded pool, deadline in the future, so bets have somewhere to go without touching restored data.
- **Cleanup:** test users, sessions, the test market and every row they created remain in staging (append-only tables cannot be deleted by design); the pre-test snapshot is the clean copy. Load-test rows are identifiable by the `lt-` prefixes.

## 5. Tooling and where the load comes from

- **Generator:** [k6](https://k6.io) via `grafana/k6` (Docker image already present locally); scripts in `scripts/aws-migration/load/` (to be written after approval). Metrics from k6 (per-route p50/p95/p99, error rate, RPS) plus CloudWatch (§7).
- **Location, stages 1–2:** this machine (India → Mumbai, low RTT). Read stages are bandwidth-light except F2 (2.9 MB × RPS — at 10 RPS that is 29 MB/s, more than a laptop uplink can *receive* reliably), so **F2 above 5 RPS runs from a temporary load generator inside AWS**.
- **Location, stages 3–5:** a **temporary `t3.small` EC2 instance in the staging public subnet** running the k6 container, tagged `Environment=staging, Purpose=load-test`, terminated at the end (this is the one resource the plan creates; it is deleted the same day). It talks to the ALB over the public hostname like a real user would.
- **Observation:** the `zugzwang-staging` dashboard + a temporary CloudWatch dashboard `zugzwang-staging-loadtest` (RDS credits/connections/latency, task CPU/memory, ALB codes/latency, EventBridge) — created before, deleted after.

## 6. Stages, concurrency, duration, abort thresholds

Every stage: 60 s ramp-up → hold → 60 s ramp-down → **5 min observation at zero load** (recovery). A stage is PASS only if the hold met the targets *and* recovery restored the idle baseline. Ramp stops at the first FAIL; the previous stage is the safe level.

**Targets (hold):** 5xx < 0.5 % · read p95 ≤ 2 500 ms (market page ≤ 3 500 ms), p99 ≤ 5 000 ms · bet p95 ≤ 2 500 ms, refusal (`503` serialization-exhausted or idempotency-closed) < 2 % · task CPU < 80 %, memory < 80 % · RDS `DatabaseConnections` < 40 · RDS/EC2 `CPUCreditBalance` not falling below 30 · Upstash command errors 0.

**Automatic abort (stage stops immediately):** 5xx ≥ 2 % over any 60 s · ALB `UnHealthyHostCount` ≥ 1 · task memory ≥ 90 % · RDS `CPUCreditBalance` < 20 or `DatabaseConnections` > 60 · bet refusal ≥ 10 % · any `cron_*` error or missed `close-due-markets` invocation · any INV-2 / lot-sum violation on the in-run spot check.

### Stage 1 — Baseline (reads, from this machine)
| VUs | Mix | Hold |
|---|---|---|
| 1 → 5 → 10 | F1 30 % · F2 30 % · F4 20 % · F3 10 % · F9 10 % | 3 min each |
Purpose: per-route baseline latencies at trivial load; validates the harness, the host pinning, and that nothing leaks to production (the only 4xx/5xx allowed is none).

### Stage 2 — Read ramp (from the in-VPC generator)
| VUs | Mix | Hold |
|---|---|---|
| 10 → 25 → 50 → 100 | F1 25 % · F2 25 % · F3 30 % · F4 10 % · F5 5 % · F9 5 % | 4 min each |
Expected first cliff: task CPU on F2 (SSR of 2.9 MB) somewhere between 25 and 50 VUs; the 15 s shared-view cache should keep F1/F2 origin work bounded, which is exactly what this stage verifies. Reports **the safe concurrent-reader level**.

### Stage 3 — Write ramp on ONE market (the pool-row lock; snapshot first)
| Concurrent bettors | Pattern | Hold |
|---|---|---|
| 2 → 5 → 10 → 25 → 50 | each VU: F6 quote → F7 place Đ 10 (unique idempotency key, short unique comment) → 2 s think → repeat | 3 min each |
Expected: this is where `statement_timeout` (1 s) and the 6-attempt budget matter. Local measurement was 0 % refusal at 64 writers; RDS adds a network round trip inside the lock, so refusals are expected earlier — **finding that number is the point**. Every refusal must be a clean `503`/idempotency-closed with **no partial write** (spot-checked in-run: `bets = comments = lots = receipts`).

### Stage 4 — Mixed realistic load (the "opening night" profile)
| Readers | Bettors | Hold |
|---|---|---|
| safe-reader level from stage 2 (e.g. 50) | 20 % of the safe-writer level from stage 3, across **the test market only** | **30 min soak** |
Purpose: sustained credits, memory creep, pool `max_lifetime` churn (600 s), cache windows rolling over, cron jobs firing throughout. The 30 min is chosen because both credit balances and `max_lifetime` only show their behaviour past 10 min.

### Stage 5 — Spike and recovery
| Pattern | Hold |
|---|---|
| 0 → 2× the stage-2 safe reader level in 10 s, hold 2 min, drop to 0 | then **10 min observation** |
Purpose: does the task shed load with 503s or fall over (OOM restart, circuit breaker)? Does the ALB keep the target healthy? Do the alarms fire and then clear? Do the pool and Redis idempotency locks come back clean?

### Stage 6 — Sell path (small)
| Concurrent sellers | Pattern | Hold |
|---|---|---|
| 5 → 10 | F8 sell part of a lot held by the test users from stage 3 | 2 min each |
Purpose: the second write transaction and lot pro-rata under mild contention; verifies I-LOT-SUM afterwards.

**Total wall clock ≈ 2.5–3 h including observation windows.** Runs in one session with the operator present; can be split (stages 1–2 one day, 3–6 another).

## 7. Metrics captured (per stage, every 1 min unless noted)

| Layer | Metric | Source |
|---|---|---|
| Client | RPS, p50/p95/p99 per route, error rate by status, connection errors | k6 summary + JSON |
| ALB | `RequestCount`, `TargetResponseTime` p95/p99, `HTTPCode_Target_2XX/4XX/5XX`, `HTTPCode_ELB_5XX`, `HealthyHostCount`, `ActiveConnectionCount` | CloudWatch AWS/ApplicationELB |
| ECS / EC2 | task `CPUUtilization`, `MemoryUtilization` (Container Insights), host `CPUCreditBalance`, `CPUCreditUsage`, `NetworkOut` | AWS/ECS, ECS/ContainerInsights, AWS/EC2 |
| RDS | `DatabaseConnections`, `CPUUtilization`, **`CPUCreditBalance`**, `FreeableMemory`, `ReadIOPS`/`WriteIOPS`, `DiskQueueDepth`, `ReadLatency`/`WriteLatency`, `Deadlocks` | AWS/RDS |
| Postgres (in-run spot checks through the tunnel, read-only) | `pg_stat_activity` (idle-in-transaction count, longest lock wait), `pg_stat_database` (xact_commit/rollback, deadlocks), `pg_stat_statements` top 5 by total time | psql via SSM |
| Redis | Upstash console: commands/s, latency, errors, plan limits | Upstash |
| App | 5xx bodies sampled, `cron_*` errors, Sentry issues for the `zugzwang-staging` project | CloudWatch Logs, Sentry |
| Scheduler | `Invocations` / `FailedInvocations` per rule during the run (the cron must not miss a minute under load) | AWS/Events |
| Integrity | after every write stage: `bets = comments = lots = receipts`, INV-2, I-LOT-SUM, a DELETE on `bets` still rejected | `scripts/aws-migration/staging-verify.cjs` |

## 8. Pass / fail — what "safe concurrent-user level" means

The report will state, with numbers:
- **Safe readers:** the highest stage-2 level that met every target *and* recovered.
- **Safe concurrent bettors on one market:** the highest stage-3 level with refusal < 2 % and zero partial writes.
- **Soak verdict:** stage 4 held for 30 min with no memory creep > 10 %, no credit balance trend below the floor, cron on time throughout.
- **Recovery:** after stage 5, idle baselines back within 5 min, all 9 alarms back to `OK`, no idle-in-transaction sessions, no stale Redis idempotency keys, integrity checks green.
- **Cliffs found:** which resource broke first (task CPU, RDS credits, pool, statement timeout) and at what level — with the graph.
- **Recommendations** — reported, not applied: e.g. `t4g.small` for staging if credits are the first cliff; whether `max: 2` should rise on a long-lived host (a measurement-first change per ADR-0038); whether the market page's 2.9 MB is worth trimming before launch.

## 9. Deliverables

- `scripts/aws-migration/load/` — k6 scripts + the pre-flight (host/database pinning) + the identity/session minting helper, all staging-only by construction.
- `docs/aws-migration/08-STAGING-LOAD-TEST-RESULTS.md` — per-stage tables, the cliffs, the recovery evidence, the recommendations.
- The staging RDS snapshot name, kept until the results are accepted.

## 10. What needs approval

1. Running the plan as written (stages 1–6), including **creating one temporary `t3.small` load-generator instance** in the staging public subnet and one temporary CloudWatch dashboard, both deleted at the end.
2. Minting ~60 test users + short-lived sessions and one test market **on staging**.
3. Taking a manual snapshot of the **staging** RDS before the write stages.
4. Accepting that load-test rows stay in staging afterwards (append-only), identifiable by the `lt-` prefixes, with the snapshot as the clean copy.
5. Upstash: confirm the staging Redis plan's request limits before stage 3 (the plan reads them from the console; it does not change them).

Nothing in this plan reads, writes, or resolves anything belonging to production.
