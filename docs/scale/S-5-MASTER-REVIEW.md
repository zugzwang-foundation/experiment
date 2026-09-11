# S-5-MASTER-REVIEW — the audit behind the load programme

> **Status:** AUDIT · planning only · **not ratified, not reviewed, not committed**
> **Date:** 2026-08-30 · **Base:** `origin/main` = `44c9f99`
> **Scope:** read-only inspection. No code, config, dependency, schema, cache, fixture or
> infrastructure was modified. No load test was run.
> **Companion documents:** `S-5-LOAD-PLAN.md` · `S-5-BOTTLENECK-REGISTER.md` ·
> `S-5-OBSERVABILITY-PLAN.md` · `S-5-CACHE-PERFORMANCE-PLAN.md` · `S-5-SCALE-ROADMAP.md`

---

## 0 · Two things that must be said before any table

### 0.1 ⛔ The governing documents are not in the repository

`ls docs/scale/` → **does not exist.** The scale programme's sequencer, ground truth and
operating ritual live **only in `~/Downloads`** (and in project knowledge):

| File | Location | On `main`? |
|---|---|---|
| `ZUGZWANG_SCALE-TRACKER_v1_1.md` | `~/Downloads` | ⛔ **no** |
| `ZUGZWANG_SCALE_handover_part-1_ground-truth_v1_0 (1).md` | `~/Downloads` | ⛔ **no** |
| `ZUGZWANG_SCALE_HO-OPS_operating-ritual_v1_0.md` | `~/Downloads` | ⛔ **no** |
| `ZUGZWANG_SCALE_HO-S1_transaction-pooler_v3_0.md` | `~/Downloads` | ⛔ **no** |
| `S-5-LOAD-TEST-APPROACH.md` (2026-08-27) | `~/Downloads` | ⛔ **no** |
| `HO-S5.md`, `HO-NUM.md`, `HO-MAP.md` | — | ⛔ **appear to exist nowhere** |

⇒ **Any plan written from `origin/main` alone structurally cannot see the programme that
governs it.** This is the failure CLAUDE.md §8 names one register over — *"a register that
lives only in PK cannot arbitrate its own numbering."* **Committing `docs/scale/` is a
prerequisite of this programme, not a tidy-up** (Decision D-1, `S-5-SCALE-ROADMAP.md`).

### 0.2 ⚠ Unrelated working-tree anomaly, unresolved

`drizzle/` does not exist; the directory now sits at **`docs/drizzle/`** (55 files, content
byte-identical to `HEAD`, nothing lost). It was moved at ~01:45 on 2026-08-30 by something
outside this session. **Untouched here.** It breaks `drizzle.config.ts`, `db:migrate:*` and
`/api/health`'s `outputFileTracingIncludes` until restored. **Not an S-5 finding; flagged
because a load run against a build with a broken migration-drift path measures the wrong
thing.**

---

## 1 · Source of truth

**Conflicts are shown, never resolved here.** Every "Required action" routes to an owner.

| # | Topic | Source | Current decision | Status | Conflict? | Required action |
|---|---|---|---|---|---|---|
| 1 | **Scale target** | ADR-0038 §Context/Decision | 100,000 signups + 2,000,000 page loads over ~52 days (15 Sep – 5 Nov 2026) | **ratified** 2026-08-19 | no | none — this is the target |
| 2 | **Concurrent-user target** | ADR-0038 §Context, quoting ADR-0006 | **≤5,000 concurrent**; ADR-0038 declines to reopen it — *"even a large peak factor stays under 5,000 concurrent"* | **ratified**, inherited | ⚠ **yes — against the task framing** *"load test 100k users"* | ⛔ **D-2 · founder must rule:** cumulative (ADR-0038) or concurrent? Concurrent falsifies ADR-0038 §Context and needs a superseding record **before** any rig |
| 3 | **Cumulative-user target** | ADR-0038 | 100,000 signups | ratified | no | — |
| 4 | **Page-load target** | ADR-0038 | 2,000,000 | ratified | no | — |
| 5 | **Mean load rate** | ADR-0038 arithmetic | ~0.45 loads/sec; 100k signups ≈ 0.022/sec | ratified (stated in-ADR) | no | averages are the wrong design input — see #8 |
| 6 | **RPS budget** | ADR-0038 decision 6 | ⛔ *"Throughput budgets do not exist in this repository and this ADR does not invent them… the load runs produce the first ones"* | ratified | ⚠ **yes** — see #7, #8, #9 | **D-3** — reconcile the prior figures below against decision 6 |
| 7 | **VUs / latency gate** | `docs/plans/ENGINE.10.md:32`, `:70`; `docs/logs/ENGINE.10.md:39`; `docs/logs/ENGINE.10-build-gate.md:77` | **`p95 < 500 ms @ 5k VUs`**, *"deferred to the immediate-next k6/staging load stratum"*. Local engineered collision already hit **486 ms** — *"likely real work, not a formality"* | **ratified 2026-06-15**, deferred to this stratum | ⚠ **yes — with #8** | **D-3** |
| 8 | **Latency gate, superseding ruling** | `docs/logs/ENGINE-phase-record.md:90`, `:118` | **Founder ruling: throughput-at-relaxed-latency REPLACES the p95<500ms gate** (~2–3 s user-visible write acceptable; throughput is the target). **Target N is TBD** — *"5k / 50k / find-the-ceiling"*, pinned at the A-lite chat (HARDEN.2-PRE) | ruling recorded; **N never pinned** | ⛔ **yes — directly contradicts #7** | ⛔ **D-3 · founder must rule which stands**, and pin N. `S-5-LOAD-PLAN.md` cannot set pass/fail criteria without it |
| 9 | **Read/write mix** | `docs/logs/ENGINE.10.md:39`; `docs/plans/ENGINE.10.md` axes 9, 10 | **~90% audience / ~10% bettors + an adversarial high-writer scenario**, under **mixed** traffic (*"read load on hot markets **while writes land**"*) | ratified | ⚠ **yes** — no prior S-5 draft ran a mixed profile | **adopt as the profile** — `S-5-LOAD-PLAN.md` Stage 4 |
| 10 | **Signup rate** | `docs/parked.md:2240` (SYNC-3) | *"The scale tracker's load profile peaks at **50 signups/sec**"* | measured/derived 2026-08-20 | ⚠ **yes — with #11** | **D-3** |
| 11 | **Signup rate, vendor-facing** | Scale tracker F-3, W-6 | Resend rate-increase request cites **30/s peak**, 100k/month. W-6: *"numbers amend; the ADR does not silently keep 30"* | in flight (support ticket) | ⚠ 30/s vs 50/s | **D-3** — one number, or an explicit split (app-side vs email-side) |
| 12 | **Pool `max` (per instance)** | `src/db/index.ts` | **`max: 4`** — bounds *what a suspended instance can strand*, not throughput | shipped | ⛔ **yes** | **D-8 (O-5)** — see #13 |
| 13 | **Pool `max`, contradicting site** | `docs/logs/POOL-1.md:39`, `:215` | **"RULED · `max` stays at 10 — now for the correct reason"**; *"Why `max: 10` is right. The floor is 5"* | **live position at its own site, never amended** | ⛔ **yes — `4` ships** | ⛔ **D-8 · amend POOL-1 §0.** O-5: a durable amendment must be applied at every site stating the superseded position |
| 14 | **Who moves `max`** | ADR-0038 P1.2; S-3 fence | *"`max` stays at 4 **until S-5 measures it**"*; S-3 was forbidden to raise it | ratified | no | S-5 **measures**; moving the literal is a separate fenced task |
| 15 | **Pool Size (backend)** | Scale tracker W-11 / F-11 | **15**, `max_connections` 60, safe band 24–48. **Routed to S-8**, load run #1 as input | ratified routing | ⚠ **yes** — a prior draft absorbed it | **S-5 produces input only.** S-8 rules (Wed 2 Sep) |
| 16 | **Pooler mode** | ADR-0038 decision 3 + P1; `src/db/index.ts` | Transaction `:6543` **authorised and live on staging**; `prd` **throws at boot** if the flag reaches it (ADR-0024 P3 #8) | ratified | ⚠ **staging ≠ prod** | state the gap in **every** conclusion; **D-6** — measure staging as-is, flip to session for a control, or both |
| 17 | **Statement / idle timeouts** | `src/server/{bets,markets,resolution}/transaction.ts` | `SET LOCAL statement_timeout = 1000`, `idle_in_transaction_session_timeout = 30000` | shipped | ⚠ both are **inside** the tx | see #18 |
| 18 | **Request wall clock** | grep: `maxDuration` → **zero hits** in `src/` and `vercel.json`; `connect_timeout` → **zero hits** | ⛔ **nothing bounds it.** ADR-0038 P1: under `:6543` a bet *"queues for a backend before one exists"*, upstream of every `SET LOCAL` | ⛔ **gap** | ⛔ **yes** | ⛔ **B-1/B-2/B-3** — `S-5-LOAD-PLAN.md` Stage 0. A cap converts a hang into a failed bet: **founder decision** |
| 19 | **`PENDING_TTL_SECONDS`** | `src/server/idempotency/types.ts`; S-1-close H-D; ADR-0044 | **30**, derived from *"bet-transaction worst case ~600 ms upper"* — a bound that held only because `:5432` failed fast. ADR-0044 parks the re-derivation **for S-5** | ⛔ **stale derivation** | ⛔ **yes** | ⛔ **B-1.** S-1-close: ***"Load must not run until it is re-derived or the wall clock is bounded upstream"*** |
| 20 | **Cache architecture** | ADR-0041 (2026-08-26) | Cache Components on; 4 `"use cache"` blocks; participant caches **keyed on `reserves`**; invalidation via `updateTag` / `revalidateTag(tag,{expire:0})` | ratified | no | see `S-5-CACHE-PERFORMANCE-PLAN.md` |
| 21 | **Cache-key strength** | ADR-0041 D-2 + **OQ-1** | *"Provably equal to a previously observed value"* is **strictly weaker** than "unchanged since the entry". Fee-less CPMM ⇒ A→B→A restores the exact reserve pair; `totals`/`topPosts` can lag | ⛔ **OPEN — OQ-1, two candidate fixes named, not fixed** | no | S-5 **measures the hit rate**; the fix is ADR-0041 OQ-1's owner |
| 22 | **Identity pool namespace** | ADR-0011 | 50 × 100 × 10 = **50,000** | superseded — see #23 | ⛔ **yes** | — |
| 23 | **Identity pool namespace, current** | Ground truth §9 | *"**Closed.** 1,000 PFPs × 3-digit numbers ≈ **900k** namespace. **ADR-0011's 50k ceiling no longer binds.** Remaining work is generation and seeding, not curation"* | **ratified**, newer | ⛔ conflicts with #22 and with `scripts/seed-identity-pool.ts` (`EXPECTED_TOTAL = 50_000`) | **D-4** — the scripts still assert 50,000 and will exit 3 against a larger pool |
| 24 | **Identity pool, S-5 deliverable** | Scale tracker line 66 | **"`identity_pool` → 100k"** is listed in S-5's own contents row | ratified | ⚠ a prior draft put it out of scope | **in scope** — Stage 0 / `S-5-LOAD-PLAN.md` §Test data |
| 25 | **Identity pool, staging fixture** | `docs/parked.md:2235` **STAGING-POOL-UNDERSIZED** | staging holds **200 rows — 15 consumed, 185 unassigned**; at 50/s ⛔ *"the pool empties in 3.7 seconds"*, then `503 error_identity_pool_exhausted`. Trigger: ***"BEFORE the load rig is built"*** | ⛔ **OPEN** | no | ⛔ **BLOCKING** any signup run. ⚠ figure dated 2026-08-20, **not re-measured** (O-13) |
| 26 | **k6** | Scale tracker line 66 (*"k6 rig on DGX"*); ENGINE.10 axes 1/6/9/10/12 owner; `S-5-LOAD-TEST-APPROACH.md` §6 | **k6, standalone binary** — selection effectively ratified in two places | ratified in the handover set; **not installed** (`grep k6 package.json justfile scripts/` → zero) | ⚠ a prior draft filed it as an open *choice* | **D-5** — the open item is the **install**, not the selection |
| 27 | **DGX** | Scale tracker line 50 (mode **ULTRA + DGX**), line 66; ground truth §4 | Traffic generator over Tailscale SSH. ⚠ *"**Keep the DGX off the critical path** — it must never compete for resources with the system under test"* | ratified | ⚠ absent from prior drafts | **in remit, no gate** — stand it up |
| 28 | **Staging** | ADR-0024; ADR-0035/0036 | Prod replica; guarded reset + fixture generator + six gates; fixtures **md5-pinned, do not auto-advance** (O-4) | ratified | no | a load run **destroys the pinned set** — an explicit accepted cost (**D-7**) |
| 29 | **Production** | ADR-0038 §5; S-1-close DP.2 | ⛔ Serves a **2026-07-02 build**, reports `region: None`. The prod pooler guard is *a property of the artifact, not the source* — a **preview** build eliminates it as dead code | ⛔ known defect | no | ⛔ **never load-test prod.** Prod comparison invalid until DP.2 promotes |
| 30 | **S-5 ownership** | Scale tracker line 50 | **Dev C** · mode **ULTRA + DGX** · Fri 21 Aug → **Mon 31 Aug** | ratified | ⛔ **yes** — this lane is Dev B (S-1, S-3, S-7) | ⛔ **D-0 · BLOCKING.** Not established that the lane is open |
| 31 | **S-5 schedule** | Scale tracker lines 95, 101 | Load run #1 **Sat 29 Aug**; S-5 closes **Mon 31 Aug** | ratified | ⛔ run #1 has not happened; today is 30 Aug | ⛔ **D-0b · escalate.** 10 Sep precursor freeze at risk |
| 32 | **S-5 dependencies** | Scale tracker line 139 | *"S-5 · run \| Waits on S-1 **and** S-3 \| **Cannot test 30/s signups while signup jams at four**"* | ratified | no | **S-3 (PR #431) must merge before Stage 5** |
| 33 | **S-8 dependency** | Scale tracker line 140; F-11 | *"S-8 \| S-4 **and** S-5 \| **The run-#1 / run-#2 delta *is* the tier answer**"* — S-8 Wed 2 Sep | ratified | no | ⇒ **one run cannot produce a tier decision.** S-5 delivers run #1 only |
| 34 | **Mode vs critical path** | Ground truth §4 | ULTRA is *"Appropriate for: tests, read-only audits, measurement… **Never** for the five critical paths"* | ratified | ⛔ **yes** — Stage-0 preconditions edit `src/db/index.ts`, `src/server/idempotency/`, the money path | ⛔ **D-0c · split Stage 0 out as a RITUAL stratum** |
| 35 | **Bet-contention measurement** | Ground truth §9 decision **6** | ⛔ ***"Bet-contention measurement dropped"*** — RECON-1 §5 shows a clean `pools → users` lock order; Dharma floors bound throughput below infrastructure sensitivity | ratified | ⚠ **yes** — ENGINE.10 axis 1 lists contention as `E10+k6` | **D-9** — reconcile: is axis 1's k6 half dropped, or only the bespoke measurement? |
| 36 | **S-5 deliverables (full)** | Scale tracker line 66 | `identity_pool` → 100k · **k6 rig on DGX** · **moderation throughput (verify only)** · **credit-rollover herd** · load run #1 at ceiling · **queue-depth + backend-utilisation instrumentation (W-10)** | ratified | ⚠ two were absent from prior drafts | **all six are in scope** |
| 37 | **Moderation under load** | Ground truth; ADR-0038 decision 4; `S-5-LOAD-TEST-APPROACH.md` §9 | *"confirm the pipeline does not fall over at rate, report the throughput ceiling, stop. **Zero pipeline edits**"*; ⛔ *"Do not load-test the OpenAI moderation path… metered, costs money per call"* | ratified | ⚠ verify-only vs don't-drive | **D-10** — bounded real-vendor probe vs stub; see `S-5-LOAD-PLAN.md` §Third-party |
| 38 | **Saturation signal** | Scale tracker W-10; ADR-0038 P1 | Transaction mode **queues**; overload presents as **latency, not error**. ⛔ *"Load run #1 could report 'zero errors' against a saturated pool"* | ratified | no | ⇒ instrument **queue depth + backend utilisation**, never error rate |
| 39 | **Backend occupancy `f_db`** | ADR-0038 P1.4; W-9 | *"**not observable from S-1**… S-5 must measure it. Watch item W-9 does not close without it"* | ⛔ **unmeasured** | no | Stage 1/3 deliverable |
| 40 | **Cost posture** | ADR-0038 decision 1 | Ceiling lifted for the live window; ⚠ **returns at archive — nothing authorises spend past 2026-11-08** | ratified | no | a load run in August spends launch budget early |

---

## 2 · System performance map

### 2.1 The stack

```
Browser
  │  no service worker; browser cache per Next defaults
  ↓
Vercel Edge / CDN            region bom1 (vercel.json)  ·  prod alias serves a 2026-07-02 build, region: None
  ↓
Next.js 16.3.2 App Router    cacheComponents: true (ADR-0041) · instant = false on public routes
  │  ├── Data Cache          readStarCount → next:{revalidate:900}
  │  └── "use cache" (×4)    cacheLife("minutes") = stale 300 / revalidate 60 / expire 3600
  ↓
Server Components / Route Handlers   13 route handlers · 3 public pages
  ↓
Application cache            Upstash: idem:* · ratelimit:* · mod-reserve:* · cron-lock:* · visits · header-portfolio (15 s)
  ↓
postgres.js pool             max: 4 PER INSTANCE · prepare: false · idle_timeout 20 · max_lifetime 600 · connect_timeout UNPINNED
  ↓
Supavisor                    staging :6543 transaction (client 200 / backend 15) · prod :5432 session (15/15)
  ↓
Postgres 17 (Supabase, ap-south-1)   events hand-partitioned · 24 tables · 57 declared indexes
  ↓
External                     OpenAI omni-moderation · Resend · Cloudflare R2 · GitHub API · Sentry · PostHog
```

### 2.2 Request amplification per user action

**Statement counts are S-4's exact figures (`S4-FINAL-RECORD.md`) where stated; everything
else is structural, read from source this session.**

| Journey | Requests | Cache ops | DB queries | Tx | External |
|---|---|---|---|---|---|
| **`/` Discovery (cold)** | 1 doc + assets | 1 `discovery` tag read + 8 `market:*` reads | **1 + (8 × 1 live pool SELECT) + 8 cached blocks**, and the 8 are **SEQUENTIAL** (`for…of` with `await`, `(public)/page.tsx:106-111`) | 0 | star-count (Data Cache) |
| **`/` Discovery (warm)** | 1 | 9 hits | **12 cached + N live** (S-4) | 0 | 0 |
| **`/m/[slug]` anon warm** | 1 | 2 | **2 statements** (S-4) | 0 | 0 |
| **`/m/[slug]` signed-in warm** | 1 | 2–3 | **10 statements** (S-4) | 0 | 0 |
| **`/m/[slug]` cold / after any bet** | 1 | miss | `getMarketBySlug` + pool + **`loadDebateView`** — which includes ⛔ **`listMarketComments` with NO `LIMIT`** — + session + viewer ctx + `?post=` resolve | 0 | presigned R2 URL mint per image |
| **Poll tick (15 s/tab)** | 1 RSC `router.refresh()` | same as above | **re-executes LAYOUT + PAGE**; 10 statements signed-in (S-4) | 0 | 0 |
| **Signup (OAuth)** | n × auth | rate-limit | Better Auth user create + `databaseHook` + **`identity_pool` FIFO `FOR UPDATE SKIP LOCKED`** + ToS accept + `initial_grant` | 1+ | Google, R2 PFP |
| **Signup (OTP)** | 2+ | 2 limiters (`otpRequestPerEmail` 5/hr, `otpRequestPerIpBurst` 10/min) | as above | 1+ | **Resend email** |
| **Place bet** | 1 POST | session → freeze → **idem lookup/reserve** → durable replay pre-check → **rate-limit `betPerIp` 30/min** → mod-reserve SETNX | ~**16–19 statements in ONE SERIALIZABLE tx**, pool row `FOR NO KEY UPDATE` | **1** | ⛔ **OpenAI moderation, before the tx** (ADR-0014) + R2 verify if image |
| **Sell** | 1 POST | same minus moderation | tx | 1 | 0 |
| **`/api/visits`** | 1 POST/load | `isbot` → per-IP cap → ⛔ **1 Upstash `INCR` per real load** + a `GET` per render | 0 | 0 |

⛔ **The amplification that matters:** one bet on a hot market invalidates
`getCachedDebateView` **for every reader of that market** (key = `reserves`), and the miss
path re-runs an **unbounded** comment scan. On the busiest market, at the moment it is
busiest, per-reader cost reverts to cold. **`getCachedReserveWalk` fixed exactly this for the
chart** (keyed on market id alone, 60 s floor) — the comments were not given the same
treatment.

---

## 3 · Readiness verdict

| Layer | Readiness | Evidence |
|---|---|---|
| **Frontend** | 🟡 **partial** — S-4 collapsed the read path (12–14 → 2/10 round-trips), but **S-4 is not formally closed**: 2 of 5 budget tests exist, commits unsigned, Gate C not run. Its wall-clock figures were laptop-measured and its own record says treat them as **~10–15× inflated** | `S4-FINAL-RECORD.md` §1, §7 |
| **Cache** | 🟡 **effective but unmeasured under concurrency.** Architecture ratified (ADR-0041); **hit rate has never been measured with more than one user**, and OQ-1 is open | ADR-0041; `S-5-CACHE-PERFORMANCE-PLAN.md` |
| **Database** | 🔴 **not ready.** `connect_timeout` unpinned · nothing bounds the request wall clock · `PENDING_TTL_SECONDS` derived from a dead bound · `f_db` unmeasured · `max` contradicted across two sites | #12, #13, #18, #19, #39 |
| **Infrastructure** | 🟡 staging is the only viable target and differs from prod in **four** recorded ways; prod serves a stale artifact | #16, #29 |
| **Test data** | 🔴 **blocking.** Staging `identity_pool` = **185 unassigned** against a 50/s profile ⇒ empties in **3.7 s** | #25 |
| **Observability** | 🔴 **not ready.** No RPS/percentile capture, no queue-depth capture, no cache hit-rate metric; `tracesSampleRate: 1.0` on all three runtimes | `S-5-OBSERVABILITY-PLAN.md` |
| **Load rig** | 🔴 **does not exist.** k6 not installed; DGX not stood up | #26, #27 |
| **Governance** | 🔴 **blocking.** Lane unconfirmed, schedule overrun, mode conflict, `docs/scale/` not on `main`, two ratified latency gates in direct conflict | #30–#34, #7/#8, §0.1 |

---

## 4 · Final verdict — the fifteen answers

1. **Ratified scale target?** 100,000 signups + 2,000,000 page loads across ~52 days (ADR-0038). **Cumulative, not concurrent.**
2. **Concurrency target?** **≤5,000 concurrent**, inherited from ADR-0006 and explicitly not reopened by ADR-0038. ENGINE.10 independently pins **5k VUs** as the load-gate population — the two agree. ⚠ **The request's "100k users" is not this number**, and D-2 must rule.
3. **What is proven?** Engine *correctness* under concurrency (`tests/scale/`, 8 files, 11 invariant specs). Read-path *statement counts* after S-4 (exact). Region fix (PERF-1: 361.6 → 5.34 ms RTT). Transaction-mode viability (POOL-1, S-1). The S-3 deadlock reproduction with a positive control at N=3.
4. **What is not proven?** Every throughput and latency number. `f_db`. Cache hit rate above one user. Backend occupancy. Queue depth. Stranded connections after suspension. Signup rate. Moderation throughput. Vendor ceilings. Discovery under realistic row volume (**PERF-2**: every measurement to date ran against ~10 bets and ~10 comments *in total*).
5. **Top 10 bottleneck candidates?** See `S-5-BOTTLENECK-REGISTER.md`. In order: unbounded request wall clock under a queuing pooler · `max: 4` stranding · unbounded `listMarketComments` · `reserves`-keyed cache busting on hot markets · staging `identity_pool` at 185 rows · sequential 8-market Discovery waterfall · Upstash command volume (≥2 M from visits alone) · `tracesSampleRate: 1.0` · GitHub star-count 60/hr shared-IP budget · rate-limiters tripping the rig before the app.
6. **Cache readiness?** Architecture 🟢 ratified and reviewed; measurement 🔴 absent; one open correctness question (OQ-1).
7. **Frontend readiness?** 🟡 — the collapse is real and the counts are exact, but the owning stratum has not closed and two of five budget tests exist.
8. **Database readiness?** 🔴 — three unbounded/stale timeout surfaces and one contradicted pool constant.
9. **Infrastructure readiness?** 🟡 staging / 🔴 prod (stale artifact, `region: None`, artifact-dependent pooler guard).
10. **What blocks a valid load test?** **B-1** `PENDING_TTL_SECONDS` (a written *"load must not run"* gate) · **B-2** `connect_timeout` · **B-3** wall clock · **B-4** staging pool at 185 rows · **B-5** no rig · **B-6** no observability · **B-7** governance (lane, schedule, mode, `docs/scale/`) · **B-8** S-3 unmerged.
11. **Decisions first?** D-0/D-0b/D-0c (lane, schedule, mode) · **D-2** (cumulative vs concurrent) · **D-3** (which latency gate, and pin N) — full register in `S-5-SCALE-ROADMAP.md` §Decision register.
12. **What to measure?** `S-5-OBSERVABILITY-PLAN.md` — five categories, every metric marked AVAILABLE / PARTIAL / MISSING.
13. **What must NOT change before measurement?** ⛔ `max` · Pool Size · Supabase tier · any cache key or TTL · any rate-limit constant · the moderation pipeline (**not authorised under any measurement**, ADR-0038 decision 4) · region · schema. ADR-0038 decision 2 is the rule: **sizing from measurement, never estimate.**
14. **Recommended order of work?** `S-5-SCALE-ROADMAP.md` Phases A→K.
15. **Evidence required to declare target readiness?** A run at the ratified profile (#9) reaching the ratified population (#7/#8, once D-3 rules), on volume-realistic data, with **queue depth and backend utilisation** recorded and a **positive control** proving the rig can produce a failure; post-run reconciliation green on all four invariants; `f_db` measured; stranded-connection count after suspension measured; and every vendor ceiling either measured or explicitly bought on headroom with that choice recorded. ⚠ **Plus the statement that a staging number is not a production answer** (#16, #29) — S-8's run #2 delta is what closes the tier question, not S-5 alone.

---

*Read-only audit. Every row is sourced to a file and a date. Conflicts are shown, not resolved
(§2 of the task brief). Nothing was changed.*
