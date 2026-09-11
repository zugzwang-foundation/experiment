# S-5-LOAD-PLAN — the load-test programme

> **Status:** PLAN · **planning only. No rig is built, no tool installed, no data seeded, no
> run executed.**
> **Date:** 2026-08-30 · **Base:** `origin/main` = `44c9f99`
> **Reads with:** `S-5-MASTER-REVIEW.md` (source of truth + conflicts) ·
> `S-5-OBSERVABILITY-PLAN.md` (what must be measurable) · `S-5-BOTTLENECK-REGISTER.md`
>
> ⛔ **Every number below is either quoted from a ratified document with its citation, or
> marked `⟦TBR⟧` — to be ruled. ADR-0038 decision 6 forbids inventing throughput budgets:
> *"the load runs produce the first ones."* A `⟦TBR⟧` is not a placeholder to fill in at
> execute; it is a founder decision that gates the stage it appears in.**

---

## 1 · Load model

### 1.1 The quantities, kept separate

| Quantity | Value | Source | Status |
|---|---|---|---|
| **Total signups (cumulative)** | **100,000** over ~52 days | ADR-0038 | ratified |
| **Total page loads (cumulative)** | **2,000,000** over ~52 days | ADR-0038 | ratified |
| **Mean page-load rate** | ~**0.45 / sec** | ADR-0038's own arithmetic | ratified |
| **Mean signup rate** | ~**0.022 / sec** (≈1,920/day) | derived from the above | — |
| **Concurrent users (ceiling)** | **≤5,000** | ADR-0006, carried by ADR-0038 §Context — *"even a large peak factor stays under 5,000 concurrent"* | ratified, not reopened |
| **VU population for the gate** | **5,000 VUs** | ENGINE.10 (`p95 < 500 ms @ 5k VUs`) | ⛔ **conflicted — see 1.3** |
| **Active users** | — | **nothing defines it** | ⟦TBR⟧ |
| **Peak signup rate** | **50 / sec** | `docs/parked.md:2240`, quoting the scale tracker's profile | ⛔ conflicts with 30/s |
| **Peak signup rate (vendor-facing)** | **30 / sec** | tracker F-3 (Resend ask), W-6 | ⛔ conflict |
| **Read : write mix** | **~90 % audience / ~10 % bettors**, plus an adversarial high-writer | `docs/logs/ENGINE.10.md:39`; axes 9, 10 | ratified |
| **Writes / sec** | — | derivable once the VU population and mix are pinned | ⟦TBR⟧ |
| **RPS** | ⛔ **none exists** | ADR-0038 decision 6 | the runs produce it |

### 1.2 ⛔ `100,000 ≠ 100,000 concurrent`

The relationship the documents actually support:

```
100,000 signups          cumulative, over ~52 days   →  mean 0.022 signups/sec
2,000,000 page loads     cumulative, over ~52 days   →  mean 0.45 loads/sec
                                    ×  peak factor ⟦TBR⟧
                                    ↓
                        ≤ 5,000 concurrent  (ADR-0006, unreopened)
                                    ↓
                        5,000 VUs  (ENGINE.10's gate population)
```

**The two ratified ceilings agree at 5,000.** ⚠ **The task framing "load test 100k users"
does not**, and `S-5-MASTER-REVIEW.md` **D-2** must rule before Stage 1 — 100k concurrent
would falsify ADR-0038 §Context and needs a superseding record first, not a rig.

### 1.3 ⛔ Two ratified latency gates, in direct conflict

| | Gate | Source | Date |
|---|---|---|---|
| **A** | `p95 < 500 ms @ 5k VUs`, *"deferred to the immediate-next k6/staging load stratum"*. Local engineered collision already hit **486 ms** — *"likely real work, not a formality"* | `docs/plans/ENGINE.10.md:32`, `:70`; `docs/logs/ENGINE.10.md:39` | ratified 2026-06-15 |
| **B** | **Founder ruling: throughput-at-relaxed-latency REPLACES the p95<500ms gate.** ~2–3 s user-visible write acceptable; throughput is the target. ⛔ **Target N never pinned** — *"5k / 50k / find-the-ceiling"* | `docs/logs/ENGINE-phase-record.md:90`, `:118` | later; N deferred to HARDEN.2-PRE |

⛔ **Stages 3–10 cannot state pass/fail criteria until D-3 rules which stands and pins N.**
Not resolved here (task brief §2: *do not silently resolve a conflict*).

### 1.4 Profiles

Three, per `S-5-LOAD-TEST-APPROACH.md` §3 — *"model bursts, not averages"*:

| Profile | Shape | Rationale |
|---|---|---|
| **Steady** | the 52-day mean | the floor; proves nothing on its own |
| **Launch spike** | signups at ⟦TBR⟧ × mean for ⟦TBR⟧ min | *"A Devcon-adjacent experiment with a public announcement takes a large fraction of its signups in the first hours"* |
| **Resolution burst** | write burst against **one** market row | market close/resolve; and the **2026-11-05 23:59 UTC** conclusion freeze |

---

## 2 · Rig — k6 on DGX

### 2.1 Both are already mandated

| Claim | Evidence |
|---|---|
| **k6 is the tool** | scale tracker line 66, S-5 contents: **"k6 rig on DGX"** · `docs/plans/ENGINE.10.md` names **k6** as owner of axes 1, 6, 9, 10, 12 · `S-5-LOAD-TEST-APPROACH.md` §6 recommends k6 standalone |
| **DGX is the generator** | tracker line 50: mode **ULTRA + DGX**; line 66: *"k6 rig on DGX"* · ground truth §4: *"Runs on the DGX box over Tailscale SSH. Load generation, tuple generation, compute-heavy work"* |
| **It is not installed** | `grep -riE "k6\|artillery\|autocannon\|locust\|gatling\|jmeter" package.json justfile scripts/` → **zero hits** |

⇒ **The selection is ratified; the open item is the INSTALL** (D-5). Ask the narrow question.

### 2.2 Required setup — planning level only, do not build

- **k6 as a standalone binary on the DGX**, invoked over Tailscale SSH. ⛔ **Never a `package.json` dependency** — this repo pins `pnpm.onlyBuiltDependencies` and treats a new dep as an AGENTS.md §11 decision; a load tool has no business in the production bundle.
- **Results exported as JSON**, retained with the run's provenance block.
- ⛔ **The generator must never compete with the system under test** (ground truth §4). Concretely: verify the DGX is not the bottleneck by proving the rig can sustain ⟦TBR⟧ RPS against a **trivial static endpoint** before it is pointed at the app. **A rig whose own ceiling is unknown produces a number about the rig.**
- **Source-IP strategy** — `betPerIp` 30/min ⇒ 0.5 bets/sec/IP; `otpRequestPerIpBurst` 10/min ⇒ 0.17 signups/sec/IP. Either distributed egress, or a documented time-boxed limiter posture. ⛔ **Record limiter decisions; never infer them** — `checkRateLimit` fails **open**, so a degraded Upstash silently stops limiting.
- **Observation runs beside, not inside:** `scripts/sample-backend-activity.ts` throughout, **`--self-test` green first**, JSONL retained as the record.

---

## 3 · Test data

### 3.1 The problem

⛔ **PERF-2:** *"Every measurement to date ran against a database holding ~10 comments and ~10
bets IN TOTAL, so Discovery's eight per-market hero computations ran over roughly one row
each. The constant is fixed and small; the variable is untouched."* Owner: **SCALE S-5**, and
explicitly **not** a bespoke seeder — `staging:generate`'s fifteen `sp-*` markets pollute the
eight-market featured set.

⛔ **STAGING-POOL-UNDERSIZED:** staging `identity_pool` holds **200 rows / 185 unassigned**
against a 50/s profile ⇒ *"the pool empties in 3.7 seconds"*. Trigger: ***"BEFORE the load rig
is built."*** ⚠ Figure dated 2026-08-20, **not re-measured** (O-13).

### 3.2 Required volumes

| Entity | Volume | Source |
|---|---|---|
| `identity_pool` | **→ 100k unassigned** | tracker line 66 — an S-5 deliverable. ⚠ ADR-0011's 50k ceiling **no longer binds** (ground truth §9: ≈900k namespace) but `scripts/seed-identity-pool.ts` still asserts `EXPECTED_TOTAL = 50_000` and **exits 3** otherwise (**D-4**) |
| Users | ⟦TBR⟧, from the VU population | — |
| Markets | ≥ the 8 featured, **plus depth** so Discovery's `status='Open' ORDER BY created_at DESC LIMIT 8` sorts over a realistic set | BR-16 |
| Comments per market | ⟦TBR⟧ — ⛔ **the variable BR-6 scales on**; must span a range, not one value | BR-6 |
| Bets / events per market | ⟦TBR⟧ — **the variable BR-13's replay scales on** | BR-13 |
| Hot market | ≥1 designated, carrying the write load | axes 1, 9 |

### 3.3 Strategy

- **Seeding** — extend the engine-driven generator's discipline: ⛔ **the rig writes nothing directly** (ADR-0036 primitive 3: *"never mocked — anything that writes a row or moves Dharma"*). Volume arrives through real entry points or a purpose-built seeder that respects the same rule.
- **Reset / rebuild** — ⛔ a run **destroys the md5-pinned fixture set** (O-4, ADR-0035). Bracket every run: `pnpm staging:reset` → run → `pnpm staging:rebuild`, and **the operator accepts the loss for the duration**. That is an explicit cost (**D-7**), not a footnote — the pinned set exists so defects stay visible.
- **Isolation** — staging only. ⛔ Never local (no Fluid, no suspension, no Supavisor, no real network — it can only measure engine cost, which `tests/scale/` already covers). ⛔ **Never production.**
- **Reproducibility** — every run records the fixture generation input, `canary`, pooler mode, compute tier and `staging-coverage.json` state.

---

## 4 · The stages

**Each stage runs only when the previous one's exit criterion is met.**

---

### Stage 0 — Preconditions ⛔ NO RIG, NO LIVE TARGET

| # | Item | Exit |
|---|---|---|
| 0.1 | **B-1** — re-derive `PENDING_TTL_SECONDS`, or bound the wall clock upstream. Read ADR-0044 first: 30 s > 10 s is load-bearing to its DC reasoning | a written derivation |
| 0.2 | **B-2** — pin `connect_timeout` | pinned, with its derivation in the comment |
| 0.3 | **B-3** — rule on a money-path `maxDuration`. ⚠ **A cap converts a hang into a failed bet — a product decision** | founder ruling, recorded |
| 0.4 | **B-4** — `identity_pool` seeded to target; **D-4** resolved (the scripts' 50k assertion) | live unassigned count re-measured |
| 0.5 | `sample-backend-activity.ts --self-test` green against the intended target | ⛔ *"a quiet screen is not a finding until `--self-test` has passed"* |
| 0.6 | `verify-pooler-mode.ts` — which pooler the target actually runs | mode + date recorded |
| 0.7 | **MISSING-8/9** — read Vercel's function-duration default; **decide and record the Sentry sampling posture** | both written down |
| 0.8 | **D-3** ruled: which latency gate, and N pinned | pass/fail criteria become writable |
| 0.9 | S-3 (PR #431) merged — tracker: *"Cannot test 30/s signups while signup jams at four"* | merged |

⛔ **Governance gates, above all of these:** **D-0** lane · **D-0b** schedule · **D-0c** Stage 0
split out as a **RITUAL** stratum (0.1–0.3 are critical-path edits; ULTRA is *"**Never** for
the five critical paths"*) · **D-1** `docs/scale/` committed.

**Objective** make a number meaningful · **Cost** none (no traffic) · **Abort** any item open.

---

### Stage 1 — Noise floor

**Objective** a quiet baseline, so attribution is not guesswork (S-3 lesson 3).
**Workload** none. Sample the idle system. **Duration** ⟦TBR⟧ ≥ the sampler's period × a
meaningful window. **Measures** background `pg_stat_activity`; quiet p50/p95/p99 on the four
read surfaces; **cold-start** after a measured idle (compare `parked.md` COLD-START: ~790 ms
health / ~1.75 s Discovery); first **`f_db`** reading.
**Pass** a recorded floor. **Abort** sampler self-test not green. **Cost** ~zero.

---

### Stage 2 — Positive control

**Objective** ⛔ **prove the rig can produce a failure.** S-3 lesson 2: *"a deadlock test that
always hangs is indistinguishable from one that detects a deadlock."*
**Workload** a level that **passes** and a level that **fails**, on a surface where the
failure is already known — the S-3 shape (clean at N=3, wedged at N=4) is reusable
**essentially as written**.
**Pass** both arms behave as predicted. ⛔ **Abort the entire programme if the failing arm
does not fail** — every later "the system held" would be uninterpretable. **Cost** minimal.

---

### Stage 3 — Read load

**Objective** the read path at volume — **the first honest post-S-4 latency measurement.**
**Population** audience only. **Workload** `/`, `/m/[slug]`, `/u/[pseudonym]`, `/api/visits`,
plus the 15 s poll. **VUs / arrival** ⟦TBR⟧ from D-3. **Ramp** stepped, holding at each level
long enough for the pool to reach steady state. **Data** volume-realistic (§3.2).
**Measures** p50/p90/p95/p99 per surface · **`f_db`** (**W-9**) · **queue depth + backend
utilisation** (**W-10**) · **cache hit rate** (CM-1) · BR-11's sequential 8-market waterfall ·
BR-6 vs comment count · BR-13 vs event count · poll cost with visibility suspension **on and
off** · Upstash command volume · ⛔ **CM-5, the star-count positive assertion.**
**Pass** ⟦TBR⟧ (D-3). **Abort** star-count budget burning · `f_db` unmeasurable.
**Cleanup** none (read-only). **Cost** Upstash commands + Sentry events at the chosen sampling.

---

### Stage 4 — Mixed traffic ⭐ **the ratified profile**

**Objective** the profile ENGINE.10 actually ratified, and the one that exposes **BR-7**.
**Workload** ⛔ **~90 % audience / ~10 % bettors, concurrently** — axis 9 *"audience read load
on hot markets **while writes land**"*, axis 10 *"freeze read-guard under mixed traffic
(writes→410, reads→200)"*. Plus the adversarial high-writer.
**Measures** everything from Stage 3, **segmented by market write-rate** (**CM-2, the headline
cache measurement**) · CM-4 (C4's 60 s floor coalescing: 50 bets in 30 s ⇒ **one** derivation)
· CM-10 invalidation latency · read-after-write consistency (axis 9's E10 half).
**Pass** ⟦TBR⟧. **Abort** invariant violation · masking leak.
**Cost** moderation calls — see §6.

---

### Stage 5 — Signup load

**Objective** signup at rate; **ADR-0043's fixed deadlock's first volume exercise**.
⛔ **Blocked on B-4 and on S-3 merging.**
**Fidelity — D-11, a genuine fork with no option covering both:**

| | Path | Gets | Misses |
|---|---|---|---|
| **(a)** | OTP over real HTTP | the wire layer, **where ADR-0043's deadlock lived** | ⛔ sends **real Resend email per signup** |
| **(b)** | `ctx.internalAdapter.createOAuthUser` + `acceptTosAction`, as `generate.staging.test.ts` already does | the DB spine at volume, no email | skips the wire layer |
| **(c)** | a staging-only seeded-session path so k6 holds a real cookie | full HTTP fidelity | ⛔ **an auth-surface change on a CLAUDE.md §1 critical path — needs its own ADR.** *"Do not sneak it in as load-test scaffolding"* |

**Recommended:** **(b) at volume + a bounded (a) sample** — `S-5-LOAD-TEST-APPROACH.md` §6
reaches the same split, calling it *"two instruments, each honest about its scope."*
**Measures** signup latency · `identity_pool` FIFO contention under `FOR UPDATE SKIP LOCKED` ·
**deadlock recurrence at `max: 4`** · `I-GRANT-ONCE-001` under concurrency · **exhaustion
behaviour at the pool's edge** (a real go-live failure mode regardless of pool size).
**Abort** ⛔ any deadlock recurrence · any once-only violation.

---

### Stage 6 — Write / transaction load

**Objective** bet + comment cost at rate. ⚠ **Scope is contested — D-9:** ground truth §9
decision 6 says *"bet-contention measurement **dropped**"*, while ENGINE.10 axis 1 lists
contention as `E10+k6`. **Ruled before this stage runs.**
**Measures** bet p50/p95/p99 · **`PENDING_TTL_SECONDS` against the observed worst case**
(closing B-1's derivation) · 40001/40P01 rates (⚠ `tests/scale` deliberately never asserts
retry counts, so they are invisible unless captured here) · SERIALIZABLE hold time ·
moderation latency **as a component of bet wall clock** · idempotency under retry storms.
**Abort** ⛔ any invariant violation · any hang past the 0.3 bound · any double-charge
signature (ADR-0044's territory).
**Cleanup** ⛔ **post-run reconciliation, mandatory** — see §5.

---

### Stage 7 — Hotspot / adversarial

**Objective** the adversarial high-writer, and cache stampede (**CM-8**).
**Workload** one pool row; N concurrent misses on one cache key at t=0; the freeze read-guard
under mixed traffic (axis 10).
**Measures** hot-row throughput ceiling · retry ladder depth · stampede behaviour.
**Abort** invariant violation.

---

### Stage 8 — Spike

**Objective** the launch-day shape. **Workload** signups at ⟦TBR⟧ × mean for ⟦TBR⟧ min,
from a cold cache.
**Measures** cold-cache behaviour under burst · `identity_pool` drain rate · limiter
behaviour · Resend/OpenAI burst response.
**Abort** ⛔ pool exhaustion (means B-4 was under-seeded — a rig failure, not a finding).

---

### Stage 9 — Soak

**Objective** ⛔ **the observation window everything else omits.** `max` bounds *what a
suspended instance can strand*, and **620 s idle was observed with a 20 s `idle_timeout` and a
600 s `max_lifetime` both configured and verified live**, because Fluid suspends and a
suspended instance runs no timers.
**Workload** sustained moderate load, then **stop**, then keep sampling ≥15 min.
**Measures** ⛔ **stranded connections after the load stops** (MISSING-4) · connection growth ·
`max_lifetime` / `idle_timeout` behaviour during a wedge (S-3 handover **H-4**) · Supavisor
cleanup behaviour (recon-2 **H-3**) · memory/connection drift.
⛔ **This stage is where `max`'s real answer comes from.** A throughput-only run produces a
number that is not the number `max` is protecting against.

---

### Stage 10 — Controlled ceiling

**Objective** find the breaking point deliberately, with the abort armed.
⚠ **Under `:6543` the ceiling does not announce itself** — it presents as latency. The
ceiling is read from **queue depth and backend utilisation against Pool Size 15**, never from
an error rate.
**Abort** any invariant violation · any unbounded hang · vendor cost passing the run budget.
**Output** the measured ceiling, with the run's provenance — **input to S-8**, which owns the
tier ruling (*"the run-#1 / run-#2 delta **is** the tier answer"*).

---

## 5 · Post-run reconciliation — mandatory after any write stage

A load run is the highest-concurrency exercise this code will get before real participants.
**A concurrency-only violation is indistinguishable from normal data afterwards.**

| Check | Assertion | Source |
|---|---|---|
| **INV-1** atomicity | no bet without its comment across the run's corpus | `I-ATOMICITY-001` |
| **INV-2** no overdraft | `balance_after >= 0`; ledger conservation over the corpus | `I-NO-OVERDRAFT-001` |
| **INV-3** side-bind | `side_at_post_time` unmoved | `I-SIDE-BIND-001` |
| **INV-4** append-only | `resolution_events` / `payout_events` immutable | `I-APPEND-ONLY-001` |
| Once-only grant / credit | one `initial_grant` per user ever; one `daily_allowance` per UTC day | `I-GRANT-ONCE-001`, `I-DAILY-ONCE-001` |
| **Idempotency** | one commit per key | `I-IDEM-ONCE-001` |
| **Lot sum** | Σ `surviving_shares` == `positions.quantity` | ⭐ `I-LOT-SUM-001` — ⚠ its own docblock says it *"proves the RULE and observes NO live environment."* **A load run is the first chance to exercise it against rows it did not seed** |
| Single side | ≤1 held side per (user, market) | `I-SINGLE-SIDE-001` |
| **Masking** | ⛔ removed bodies absent from **every** read path — assert the **BODY's absence, not the row's** | **CLAUDE.md §5.14 SC-1** |
| Staging gates | `pnpm staging:gates` green | ADR-0036 |

---

## 6 · Third-party — safe testing strategy

⛔ **No proposal here sends 100,000 real emails or makes uncontrolled paid API calls.**

| Service | Quota / limit | Under load | Strategy |
|---|---|---|---|
| **OpenAI moderation** | metered, paid; `OPENAI_TIMEOUT_MS` 3000 + 1 retry; fail-closed | every bet carries a comment ⇒ a write run is a **paid** moderation run | ⚠ **D-10 — two ratified statements to reconcile:** tracker says *"moderation throughput (**verify only**)… report the throughput ceiling, stop. Zero pipeline edits"*; `S-5-LOAD-TEST-APPROACH.md` §9 says ⛔ *"Do not load-test the OpenAI moderation path… Stub it or exclude those routes."* **Recommended: a bounded, budgeted real-vendor probe for the ceiling + stub/exclude for bulk write stages** — but the founder rules it |
| **Resend** | 30/s asked, **not yet granted** (W-6: *"numbers amend; the ADR does not silently keep 30"*) | (a)-path signup sends one email each | ⛔ **bulk email is out.** Bounded sample only, to a controlled domain. Deliverability/reputation is a real risk, not just quota |
| **R2** | per-op cost | PFP read per signup; presigned mint per image | measure ops; **CM-6** asserts URLs valid at cache-lifetime edge |
| **GitHub** | ⛔ **60/hr per IP, region-shared** | 4/hr **if** the Data Cache holds | ⛔ **CM-5 positive assertion** — the failure is silent |
| **Sentry** | quota; **`tracesSampleRate: 1.0` × 3 runtimes** | 2 M loads ⇒ quota burn **and** measurement distortion | ⛔ **Stage 0.7 records the posture** |
| **PostHog** | quota | events/day at target | size from measurement |
| **Supabase** | tier | the Large→XL input | ⛔ **XL requires a measured number, not a projection** |
| **Upstash** | plan ceiling | ≥2 M commands from visits alone | Pro is pre-authorised on a measurement |

⚠ **Spend posture:** ADR-0038 lifts the ceiling **for the live window**, and *"the ceiling
returns at archive: nothing authorises spend past 2026-11-08."* **A run burning vendor quota
in August is spending the launch budget early.** Estimate per-run cost **before** each stage.

---

## 7 · Guardrails

⛔ Never against **production** — not "carefully", not "briefly" · ⛔ **`max` does not move
because a run suggested it** — the measurement is the output; moving the literal is a fenced
code change with its own task, ADR and ritual · ⛔ **No moderation-pipeline change**, not
authorised by ADR-0038 under **any** measurement · ⛔ Nothing touches
`system_state.frozen_at` · ⛔ **No cache key, TTL, `cacheLife` profile, rate-limit constant,
Pool Size, compute tier, region or schema moves before measurement** (ADR-0038 decision 2) ·
⛔ **A read replica, any single-region change, and any moderation-pipeline change each need
their own decision record** (ADR-0038 decision 4).

---

*Plan only. No tool installed, no script written, no data seeded, no run executed, no
configuration changed.*
