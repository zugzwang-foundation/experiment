# 08 — Staging Load / Stress Test Results (2026-09-25)

Executes `07-STAGING-LOAD-TEST-PLAN.md`. STAGING ONLY — `https://staging.zugzwangworld.com` → ALB → 1 ECS task (0.5-vCPU share / 1 GiB, `t3.small` host) → `db.t4g.micro` RDS. Production was not read, written, resolved or deployed at any point; every generator pinned the hostname and the database endpoint before starting (plan §2).

| | |
|---|---|
| **Window** | 05:49 – 08:53 UTC |
| **Generators** | Stage 1 from the operator laptop; Stages 2–6 from a temporary `t3.small` (`i-081765593b42ea0cd`, public subnet, SSM-only, no ingress) running `grafana/k6` — **terminated at 08:56 UTC**, its security group and `zugzwang-staging-loadgen` role/instance-profile deleted |
| **Test data** | market `lt-load-2026-09-25` (`01a0d714-a4a2-728a-aba5-7678a1c667a7`), 200 participants (`lt-load-2026-09-25-<n>@load.invalid`, pool-assigned pseudonyms, minted through `createOAuthUser` → `acceptTosAction`), 400 sessions expiring 2026-09-26 ≈11:10 UTC. **Left in place** (append-only tables); the clean copy is RDS snapshot **`zugzwang-staging-pre-load-2026-09-25`** (taken 06:38 UTC, before the write stages, kept) |
| **Guard** | CloudWatch abort guard (memory ≥ 90 %, RDS credits < 20, connections > 60, unhealthy host) + k6's own aborts (non-503 5xx ≥ 2 %, refusals ≥ 10 %). Ran on the laptop for Stages 1–3 (killed twice by the laptop's memory reaper, never during a level's hold), then on the generator itself |
| **Measured facts that corrected the plan** | RDS `max_connections` = **79** (plan estimated ~112); ECS "task CPU %" is relative to a 512-unit *share*, not a limit — the host's 2 vCPU is the real ceiling; the app log records only bet requests and errors |

## 1. Headline numbers

| Question | Answer |
|---|---|
| **Max safe concurrent readers** (Stage 2 mix, 1–3 s think time) | **10 VUs ≈ 3.8 rps** from inside the VPC. 25 VUs (8.2 rps) failed one target (profile p95 2.99 s > 2.5 s); 50 and 100 not run |
| **Max safe concurrent bettors on ONE market** | **10** (901 bets in 3 min, 0 refused, 0 errors). 25 aborted at 7 % no-response/5xx after 93 s — on a task already degraded by the heap issue below; 50 not run |
| **Max safe concurrent sellers on one market** | **5** (404 sells, 0.5 % 500s). 10 aborted at 3.75 % failed after ~80 s |
| **Soak** (30 min, 10 readers + 2 bettors) | **Held**: 10 502 requests, 5.5 rps, 0.24 % failed, 1 227 bets, 0 refused. Degraded in the last third (p95 1.4 s → 6 s on one minute; memory 41 % → 65 %) |
| **Spike** (0 → 20 readers in 10 s, 2 min) | **Absorbed**: 1 047 requests, 0.19 % failed, all latency targets PASS, CPU back to idle within 1 min, alarms cleared |
| **5xx rate** | Level holds: 0.0–0.5 % (almost all ALB-generated 502s from the keep-alive race, see §4). Aborted levels: 7 % (bettors 25), 3.75 % (sellers 10), 7.7 % (cold-start soak attempt) |
| **First bottleneck** | **The single Node.js process on the 0.5-vCPU task** — one event loop saturating one core on market-page SSR (Stage 1/2), then a **V8 GC storm at the 560 MB default heap ceiling** after ~1 500 bets (Stage 3), which pinned ~0.9 vCPU for 25 min at zero load and needed a task restart |
| **Database** | Never the limit: RDS CPU 4–8 % throughout, **4 connections** (pool `max: 2` per task; peak 6 during checks), `CPUCreditBalance` rose 73 → 93 across the whole test, 0 deadlocks, write latency ~0 ms |
| **Recovery** | Reads: within 1–5 min every time. Writes: **FAIL once** — after Stage 3 the task did not recover on its own (GC storm, ALB health check flapped once, CPU alarm ALARM); `update-service --force-new-deployment` restored it in 2 m 24 s. Soak/spike/sell recovered by themselves; final idle 08:53 UTC: task CPU 6 %, memory 46 %, RDS 2 connections, **11/11 alarms OK** |
| **Integrity** | After every stage and at the end: `bets = comments = lots` (2 936), `bet_receipts` = ledger `bet_stake` rows (3 498 = 2 936 buys + 562 sells), INV-2 0 negative balances, oversell 0, I-LOT-SUM 0 mismatches, single-side 0, no idle-in-transaction, deadlocks 0; `staging-verify.cjs` 20/21 PASS (the one FAIL is "row counts match the archive", expected after adding test data), including the live DELETE/UPDATE rejections. **Restored production-derived markets untouched: 3 170 bets before and after** |

## 2. Per-stage results

### Stage 1 — baseline reads from the laptop (mix home 30 / market 30 / profile 20 / version 10 / health 10)

| VUs | Req · rps | non-2xx | home p50/p95 | market p50/p95 | version | profile | Task CPU avg/peak | RDS CPU · conn | ALB p95/p99 | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 106 · 0.35 | 0 | 87 / 992 ms | 1.07 / 1.74 s | 62 / 197 ms | 88 / 141 ms | 28 % / 51 % | 4 % · 4 | 0.10 / 0.19 s | PASS |
| 5 | 512 · 1.69 | 1 (0.2 %) | 85 / 827 ms | 1.00 / 1.75 s | 53 / 306 ms | 91 / 537 ms | 67 % / 81 % | 5 % · 4 | 0.16 / 0.23 s | PASS |
| 10 | 777 · 2.58 | 1 (0.13 %) | 299 ms / 1.65 s | 1.38 / **8.70 s** | 158 / 993 ms | 319 ms / 1.31 s | 90 % / 111 % | 5 % · 4 | 0.22 / 0.83 s | FAIL (latency; largely the laptop's downlink — ALB p99 was 0.83 s) |

### Stage 2 — read ramp from inside the VPC (mix home 25 / market 25 / version 30 / profile 10 / export 5 / health 5)

| VUs | Req · rps | non-2xx | home | market | version | profile | export | Task CPU (share) | Host CPU | RDS | ALB p95/p99 | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 1 373 · 3.81 | 2 × ELB 502 | 41 / 526 ms | 319 ms / 1.18 s | 25 / 457 ms | 69 / 621 ms | 211 / 836 ms | 120 % / 129 % | 17–22 % | 5 % · 4 | 0.31 / 0.78 s | **PASS** (safe level) |
| 25 | 2 951 · 8.18 | 6 × ELB 502 | 199 ms / 2.18 s | 593 ms / 1.92 s | 194 ms / 1.09 s | 666 ms / **2.99 s** | 799 ms / 2.44 s | 206 % / 232 % (≈1.1 vCPU) | 29 % / 44 % | 6 % · 4 | 0.92 / 1.63 s | FAIL (profile p95) |

### Stage 3 — concurrent bettors, one market (quote → place Đ10 → 2 s think)

| Bettors | Bets OK | Refused | 4xx | 5xx | place p50/p95 | quote p50/p95 | SERIALIZABLE retries | Task CPU | RDS CPU · conn | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| 2 | 183 | 0 | 1 (`insufficient_dharma`, budget) | 0 | 531 ms / 1.14 s | 11 / 37 ms | +1 | 15 % | 4 % · 2 | PASS |
| 5 | 451 | 0 | 0 | 0 | 579 ms / 1.10 s | 11 / 108 ms | +36 (8 %) | 71 % | 5.5 % · 4 | PASS |
| 10 | 901 | 0 | 0 | 0 | 565 ms / 996 ms | 12 / 224 ms | +146 (16 %) | 92 % / 105 % | 6.4 % · 4 | **PASS** (safe level) |
| 25 | 159 (+6 committed with no response) | 0.6 % | 0 | 1 × 500, 1 × 503 `idempotency_unavailable`, ~23 × no response | 732 ms / 1.66 s | 105 ms / **5.6 s** | +78 | 188 % / 193 % | 6.6 % · 4 | **ABORT** at 7 % failed (93 s) |

*"place" includes the OpenAI moderation hop before the transaction. Every retry (rollback counter) then committed; no partial write was ever found.*

### Stage 4 — soak, 30 min, 10 readers (six restored markets) + 2 bettors (test market)

| Slice | Task CPU avg/max | Memory | Host CPU | RDS CPU · conn · credits | ALB req · 2xx · ELB 5xx · target 5xx | ALB p95 / p99 |
|---|---|---|---|---|---|---|
| 0–10 min | 136 % / 150 % | 52–54 % | 30 % / 37 % | 5.5 % · 4 · 87 | 3 362 · 3 358 · 3 · 0 | 0.84 / 1.46 s |
| 10–20 min | 139 % / 148 % | 55–56 % | 36 % | 5.7 % · 4 · 88 | 3 519 · 3 516 · 2 · 0 | 0.82 / 1.50 s |
| 20–30 min | 167 % / 212 % | 59–65 % | 41 % / 48 % | 6.1 % · 4 · 89 | 3 976 · 3 956 · 17 · 2 | 1.41 / 3.15 s (max-minute 6.3 / 15.6 s) |

k6 totals: 10 502 requests, 5.46 rps, 0.24 % failed; home p50 64 ms / p95 1.15 s, market 408 ms / 1.31 s, version 32 / 710 ms, profile 107 ms / 1.13 s, export 335 ms / 1.55 s; place p50 670 ms / p95 1.85 s; 1 227 bets, 0 refused, 3 × `500 error_internal`. **Memory rose 41 % → 65 % over the 30 minutes and stayed at 63–64 % at rest.** A first attempt, started 2½ min after the task restart, aborted at 90 s (7.7 % failed, p95 ≈ 10 s): a **cold task cannot take 12 concurrent VUs**.

### Stage 5 — spike, 0 → 20 readers in 10 s, hold 2 min

1 047 requests at 7.3 rps, 0.19 % failed (2 × ELB 502), **all targets PASS** (home p95 2.35 s, market 1.86 s, profile 2.2 s, export 2.1 s, health 583 ms); task CPU 176 % avg / 222 % peak, host ≈45 %, memory 64 %, RDS 5 % · 4. CPU 221 % → 35 % within one minute of the drop; 11/11 alarms OK at +10 min.

### Stage 6 — sellers (sell 1 share, 2 s think), participants from Stage 3

| Sellers | Sells OK | 5xx | sell p50/p95 | Task CPU | ALB p95 | Verdict |
|---|---|---|---|---|---|---|
| 5 | 404 | 2 × 500 (0.5 %) | 131 / 804 ms | ≈70 % | ≈0.5 s | **PASS** (safe level) |
| 10 | 154 | 1 × 500 + 5 × ELB 502 (3.75 %) | 76 ms / 1.43 s | 64 % / 121 % | 5.7 s (max-minute 16 s) | **ABORT** (~80 s) |

## 3. The bottleneck, in order of appearance

1. **One Node.js event loop.** With `desiredCount: 1` / `maxCapacity: 1` (per-process `cacheComponents` cache, ADR-0051), every render, every bet and every cache revalidation shares one core. Market-page SSR is the expensive unit (~0.3–1.0 s CPU for a ~500-post market). At 10 in-VPC readers the process is at ~0.6 vCPU; at 25 it is at ~1.1 vCPU and latency grows 3–6×. The host (2 vCPU) never exceeded ~48 %.
2. **Market page cost grows with post count.** `/m/lt-load-2026-09-25` rendered in **7.3–7.7 s warm** at ~1 700 posts (2 936 by the end) versus 0.3–1.0 s for the six ~500-post markets. Any market that accumulates thousands of arguments will time out under the 1-second-class targets — and every bet on it invalidates its 15-second shared cache.
3. **Heap growth → GC storm.** After ~1 500 bets (07:09 UTC, idle gap between levels 10 and 25) `next-server` went to ~0.9 vCPU with **no traffic**, memory creeping to 85 %. Thread sampling: main thread 41 % + four V8 GC workers ~10 % each; RSS 480–580 MB against the default **560 MB** `heap_size_limit` (Node 24, no `NODE_OPTIONS`). The ALB health check flapped once (`UnHealthyHostCount 1` at 07:31), the CPU alarm fired, and it did not recover in 25 min; a task restart cleared it in 2 m 24 s. The soak reproduced the growth (41 → 65 % in 30 min) without reaching the ceiling.
4. **Cold start under concurrency.** A task 2½ minutes old collapsed on 12 concurrent VUs (7.7 % failed, p95 ≈ 10 s) and recovered once warmed sequentially.

## 4. Other findings

- **ALB-generated 502s at 0.1–0.5 % on every level**, including idle-ish ones — `HTTPCode_ELB_5XX`, never target 5xx. The signature is the Node keep-alive timeout (default 5 s) being shorter than the ALB idle timeout (60 s): the ALB reuses a connection the target just closed. Fix is in the app server (`server.keepAliveTimeout` > 60 s, `headersTimeout` above that) or the ALB idle timeout below 5 s.
- **Five `500 error_internal` on the write path** (3 place, 2 sell) under contention, all inside degraded minutes; the app log carries only `route/status/latency`, and **Sentry received nothing from staging during the whole window** (0 issues since 05:40 UTC). Either these are unmapped retry-exhaustion errors that should be a 503/409, or error capture is not wired on this path — worth a code-owner look either way.
- **Six bets committed while the client got no response** (bettors 25). No partial writes (spine equal); a client retry with the same `Idempotency-Key` would have received the durable replay. The idempotency layer also refused once with `503 error_idempotency_unavailable` (Redis command timeout under event-loop starvation) — the fail-closed posture working as designed.
- **`CPUCreditBalance` never dipped** on either burstable instance (RDS 73 → 93, EC2 ~203–220): at these levels neither is near its baseline, so the "credit cliff" the plan feared is not the first one.
- **RDS connections stayed at 4** (2 per task + checks): with `max_connections = 79` there is headroom for ~30 tasks of this pool size.
- An external burst of **1 587 × 4xx in one minute** hit the public ALB at 06:43 UTC (not from the harness — k6 made 368 requests in that whole level). Most likely an internet scanner; staging has WAF off.
- Stage-1 latencies above ~1 s at 10 VUs were dominated by the operator laptop's downlink (ALB p99 0.83 s vs k6 8.7 s); the plan's decision to move Stages 2+ into the VPC was the right one.
- The prerender of `/` logs `Next.js encountered the unstable value Date.now() while prerendering` / `Unexpected cache miss after cache warming phase` about once a minute at all times (cron-driven revalidation). Not load-related; pre-existing.

## 5. Recommendations (reported, not applied)

1. **Bound the heap and give it room**: set `NODE_OPTIONS=--max-old-space-size=<≈70 % of the container limit>` and raise the task to ≥ 2 GiB / 1 vCPU (`t3.medium` or larger host) — the GC storm is the only failure that needed an operator, and it is a sizing/config fix. Add a memory alarm at ~75 % (the existing 85 % one never fired because the storm sat at 82–85 %).
2. **Second task / shared cache**: the single event loop is the ceiling for reads and writes alike; `maxCapacity: 1` exists only because the `cacheComponents` cache is per-process (ADR-0051 OQ). A shared cache handler would allow 2+ tasks and roughly double every safe number above.
3. **Cap or paginate the debate view**: render cost is linear in posts (≈ 4 ms/post on this task); the test market at 2 936 posts takes > 7 s. A page window (or a server-side limit on the initial render) keeps the largest markets inside the 3.5 s target.
4. **Keep-alive**: `keepAliveTimeout` > ALB idle timeout removes the 0.1–0.5 % 502 floor.
5. **Map the write-path `500`s** to their real cause (503 on retry exhaustion, 409 on conflict) and confirm Sentry capture on `/api/bets/*`; five silent 500s under load is a diagnostic gap, not (yet) a correctness one.
6. **Warm the task after every deploy** (a few sequential GETs of `/` and each Open market before the ALB target turns healthy, or a larger `healthCheckGracePeriod` with a warm-up hook) — otherwise the first users after a deploy see the cold-start collapse.
7. **Production sizing for launch**: with the above, plan for ≥ 1 vCPU and 2 GiB per task and two tasks; leave RDS at `t4g.micro`/`small` — it was idle throughout — and revisit only if connections or credits move.

## 6. What was created and what remains

| Item | State |
|---|---|
| `i-081765593b42ea0cd` (load generator), `sg-096d411bd91820c1d`, role + instance profile `zugzwang-staging-loadgen` | **deleted** 08:56–08:58 UTC |
| Temporary CloudWatch dashboard | never created (CLI reads were used); nothing to delete |
| RDS snapshot `zugzwang-staging-pre-load-2026-09-25` | **kept** (available; the pre-write-stage clean copy) |
| Test market + 200 participants + their bets/sells/sessions | **kept** on staging (append-only); identifiable by `users.email LIKE 'lt-load-%'` and market slug `lt-load-2026-09-25`; sessions expire 2026-09-26 ≈11:10 UTC |
| Staging ECS service | restarted once (07:33 UTC, force-new-deployment); config, sizing and code unchanged |
| Harness | `scripts/aws-migration/load/` (k6 script, seeder, SSM helpers, CloudWatch guard) — reusable for the production-sized rehearsal; holds no secret. ⚠ Kept OUT of the repository by operator ruling at the AWS-MIGRATION-3 commit (2026-09-26) — it lives only in the operator's working tree |
| Local session file | deleted at the end of the run |
