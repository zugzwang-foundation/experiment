# S-5-SCALE-ROADMAP — decisions, phases, and the order of work

> **Status:** PLAN · planning only · **nothing here is scheduled, authorised or executed**
> **Date:** 2026-08-30 · **Base:** `origin/main` = `44c9f99`
> **Reads with:** `S-5-MASTER-REVIEW.md` · `S-5-LOAD-PLAN.md` ·
> `S-5-BOTTLENECK-REGISTER.md` · `S-5-OBSERVABILITY-PLAN.md` ·
> `S-5-CACHE-PERFORMANCE-PLAN.md`

---

## 1 · Decision register

⛔ **Nothing below is decided here.** Several belong to other lanes; naming an owner is not
claiming one.

| # | Decision | Why needed | Evidence | Who decides | Blocking? |
|---|---|---|---|---|---|
| **D-0** | **Is S-5 this lane's work?** | Scale tracker line 50 assigns S-5 to **Dev C**, mode **ULTRA + DGX**. This lane is Dev B (S-1, S-3, S-7) | tracker line 50 | **founder** | ⛔ **BLOCKING everything** |
| **D-0b** | **The schedule.** Run #1 was **Sat 29 Aug**; S-5 closes **Mon 31 Aug**; today is 30 Aug and Stage 0 has not started. S-8 (Wed 2 Sep) needs the run-#1/#2 delta | tracker lines 95, 101, 140 | **founder** | ⛔ **BLOCKING** — 10 Sep precursor freeze at risk |
| **D-0c** | **Split Stage 0 out as a RITUAL stratum.** Its items edit `src/db/index.ts`, `src/server/idempotency/`, and the money path — three critical paths. Ground truth §4: ULTRA is *"**Never** for the five critical paths"* | ground truth §4; `S-5-LOAD-PLAN.md` Stage 0 | **founder** | ⛔ **BLOCKING Stage 0** |
| **D-1** | **Commit `docs/scale/` to `main`.** The tracker, ground truth and HO-OPS govern this programme and are **not in the repository** | `ls docs/scale/` → does not exist | programme chat | **HIGH** — every plan written from `main` is blind without it |
| **D-2** | **Cumulative or concurrent?** ADR-0038 says 100k signups cumulative, ≤5k concurrent. The task framing says *"100k users"* | ADR-0038 §Context | **founder** | ⛔ **BLOCKING the load model.** Concurrent falsifies ADR-0038 and needs a superseding record **first** |
| **D-3** | **Which latency gate stands, and what is N?** `p95 < 500 ms @ 5k VUs` (ENGINE.10) vs *"throughput-at-relaxed-latency **replaces** the p95<500ms gate"* with **N never pinned** | `plans/ENGINE.10.md:32`; `logs/ENGINE-phase-record.md:90`, `:118` | **founder** | ⛔ **BLOCKING every pass/fail criterion** |
| **D-4** | **The `identity_pool` seed target, and the scripts' 50k assertion.** Ground truth: ≈900k namespace, *"ADR-0011's 50k ceiling no longer binds"*. `seed-identity-pool.ts` still asserts `EXPECTED_TOTAL = 50_000` and **exits 3** otherwise | ground truth §9; `scripts/seed-identity-pool.ts`, `verify-identity-pool.ts` | founder + ADR-0011 owner | ⛔ **BLOCKING Stage 5** |
| **D-5** | **Install k6 on the DGX.** ⚠ The *selection* is already ratified twice (tracker line 66, ENGINE.10 axes) — **ask the narrow question** | tracker line 66; ENGINE.10 | founder (AGENTS.md §11) | **HIGH** |
| **D-6** | **Pooler-mode fidelity.** Staging runs `:6543`; `prd` **throws at boot** on that flag. Measure staging as-is, flip to session for a control, or both? | `src/db/index.ts`; ADR-0024 P3 #8 | founder | **HIGH** |
| **D-7** | **Accept fixture destruction.** A run destroys the **md5-pinned** staging set (O-4, ADR-0035), which exists so defects stay visible | ADR-0035; O-4 | founder | **HIGH** |
| **D-8** | **Amend `POOL-1.md` §0** — it states *"RULED · `max` stays at 10"* while `max: 4` ships. **O-5:** a durable amendment is applied at every site stating the superseded position | `docs/logs/POOL-1.md:39`, `:215` vs `src/db/index.ts` | POOL-1's owner | **MEDIUM** |
| **D-9** | **Is bet-contention measurement in or out?** Ground truth §9 #6: *"**dropped**"*. ENGINE.10 axis 1: `E10+k6` | ground truth §9; `plans/ENGINE.10.md` | founder | **BLOCKING Stage 6's scope** |
| **D-10** | **Moderation under load: bounded real-vendor probe, or stub/exclude?** Tracker says *"verify only… report the throughput ceiling"*; the approach doc says ⛔ *"Do not load-test the OpenAI moderation path"* | tracker line 66; `S-5-LOAD-TEST-APPROACH.md` §9 | founder | **BLOCKING Stages 4/6 cost** |
| **D-11** | **Signup-path fidelity** — (a) real HTTP+email, (b) internal adapter, (c) a staging-only seeded session. ⛔ **(c) is an auth-surface change on a critical path and needs its own ADR** | `S-5-LOAD-TEST-APPROACH.md` §6; `generate.staging.test.ts` | founder | **BLOCKING Stage 5** |
| **D-12** | **Sentry sampling posture for the run.** `tracesSampleRate: 1.0` on three runtimes both burns quota at 2 M loads and distorts the latency being measured | `sentry.*.config.ts`, `instrumentation-client.ts` | founder/SRE | **BLOCKING Stage 1** |
| **D-13** | **`maxDuration` on the money path?** ⚠ **A cap converts a hang into a failed bet** | ADR-0038 P1; grep → 0 hits | **founder** | ⛔ **BLOCKING Stage 0** |
| **D-14** | **Restore `drizzle/`** — the directory now sits at `docs/drizzle/`, moved outside this session | working tree, 2026-08-30 | operator | **HIGH** — a broken migration-drift path makes `/api/health` untrustworthy as the run's gauge |
| **D-15** | **Reconcile the three S-5 documents.** `~/Downloads/S-5-LOAD-TEST-APPROACH.md` (2026-08-27, proposal) · `docs/plans/S-5.md` (2026-08-30, **superseded by this set**) · these five | §4 below | this lane, on D-0 | **MEDIUM** |

**Owned elsewhere — named so they are not absorbed:** **W-11 / Pool Size** → **S-8**
(F-11, Wed 2 Sep) · **the tier ruling** → **S-8** (*"the run-#1 / run-#2 delta **is** the tier
answer"*) · **ADR-0041 OQ-1** (cache-key staleness) → its own owner · **`listMarketComments`
cap/keyset** → **HARDEN.6** · **XFF rate-limit keying** (finding S-2) → go-live, own owner ·
**identity-pool generation/seeding pipeline** → ADR-0011 / asset pipeline · **DP.2 prod
promote** → deploy lane.

---

## 2 · Phases

| | Phase | Objective | Depends on | Work items | Owner | Acceptance | Risk | Evidence required |
|---|---|---|---|---|---|---|---|---|
| **A** | **Governance / decisions** | Make the programme legible and legal | — | D-0, D-0b, D-0c, D-1, D-2, D-3, D-14 | founder + programme chat | every ⛔ BLOCKING decision ruled and written down | ⛔ **highest** — the whole programme is downstream | ruling recorded in a durable place, not a chat |
| **B** | **Instrumentation** | Make saturation visible | A | O-1…O-9 (`S-5-OBSERVABILITY-PLAN.md` §3); D-12 | SRE + load architect | ⛔ **MISSING-2 (queue depth) and MISSING-3 (`f_db`) closed**; `--self-test` green | a run that reports a **false PASS** (W-10) | sampler JSONL with a self-test record |
| **C** | **Test-data readiness** | Make the target measurable at all | A, B | D-4; `identity_pool` → target; volume fixture per PERF-2; D-7 accepted | Dev C / operator | ⛔ **B-4 discharged**; live unassigned count **re-measured**, not quoted | ⛔ **the run measures exhaustion at second four** | a fresh count with its date (**O-13**) |
| **D** | **Frontend / cache readiness** | Know what the cache does under write load | B | CM-1…CM-10 defined; **CM-2** designed; S-4's Gate C status established | frontend/perf | measurement design agreed; ⛔ **no cache changed** | measuring a cache nobody has closed the gate on | ADR-0041 + S-4 exit status |
| **E** | **Database / pool readiness** | Remove the unbounded surfaces | A (D-0c, D-13) | B-1, B-2, B-3; D-8; read Supavisor `pool_checkout_timeout` | **RITUAL stratum**, not ULTRA | three bounds written and derived | ⛔ a bet that **hangs** | a written derivation per bound |
| **F** | **Load-rig readiness** | A generator that is not the bottleneck | A (D-5), B | k6 on DGX; source-IP strategy; per-request record; ⛔ **prove the rig's own ceiling against a trivial endpoint first** | load architect | rig sustains ⟦TBR⟧ RPS against a static target | ⛔ measuring the rig | the rig's own ceiling, measured |
| **G** | **Baseline** | A floor to attribute against | B–F | Stages 1 + 2 | load architect | ⛔ **positive control's failing arm actually fails** | *"the system held"* meaning nothing | both arms recorded |
| **H** | **Load runs** | Produce the numbers | G | Stages 3–10 | Dev C | every run carries a provenance block | vendor spend; fixture loss | JSONL + k6 JSON + reconciliation |
| **I** | **Bottleneck fixes** | Act on measurement | H | from the register, **on evidence only** | per-area owners | each fix cites the number that justifies it | ⛔ **fixing before measuring** (ADR-0038 decision 2) | before/after at the same profile |
| **J** | **Re-test** | Prove the fix | I | re-run the affected stage | Dev C | delta measured at an identical profile | a fix validated at a different profile | two runs, one variable |
| **K** | **Production readiness** | The capacity verdict | J, **S-8** | tier from run-#1/#2 delta; DP.2 promote; prod pooler posture | **S-8 + deploy lane** | ⛔ **not S-5's to declare** | ⛔ generalising a staging number to prod | S-8's ruling |

---

## 3 · Master flow

```
   READ / RECONCILE            ← docs/scale/ committed (D-1); the three S-5 docs reconciled (D-15)
          ↓
      DECISIONS                ← D-0 lane · D-0b schedule · D-0c mode · D-2 target · D-3 gate+N
          ↓                       ⛔ nothing proceeds past here without these
   INSTRUMENTATION             ← queue depth · f_db · cache hit rate · sampling posture (D-12)
          ↓                       ⛔ W-10: error rate is not a saturation signal
   DATA / FIXTURES             ← identity_pool → target (D-4) · volume per PERF-2 · fixture loss accepted (D-7)
          ↓                       ⛔ 185 rows empties in 3.7 s
 FRONTEND + CACHE READINESS    ← CM-2 designed · S-4 Gate C status established · ⛔ nothing re-keyed
          ↓
   DB / POOL READINESS         ← B-1 TTL · B-2 connect_timeout · B-3 wall clock  [RITUAL, not ULTRA]
          ↓                       ⛔ D-8: POOL-1 says 10, code ships 4
   K6 + DGX READINESS          ← install (D-5) · source-IP plan · ⛔ prove the rig's own ceiling first
          ↓
       BASELINE                ← Stage 1 noise floor  +  Stage 2 POSITIVE CONTROL
          ↓                       ⛔ if the failing arm does not fail, abort the programme
   PROGRESSIVE LOAD            ← Stage 3 read
          ↓
    MIXED TRAFFIC              ← Stage 4 · ⭐ ~90/10, writes landing — THE RATIFIED PROFILE
          ↓
   SIGNUP / WRITE              ← Stage 5 (needs S-3 merged) · Stage 6 (needs D-9 scope)
          ↓
    SPIKE / SOAK               ← Stage 8 · Stage 9 ⛔ the ONLY stage that measures what `max` protects
          ↓
 BOTTLENECK IDENTIFICATION     ← register updated with measured evidence
          ↓
    OPTIMIZATION               ← on evidence only (ADR-0038 decision 2)
          ↓
        RETEST                 ← identical profile, one variable
          ↓
  CAPACITY VERDICT             ← ⛔ S-8's, not S-5's — the run-#1/#2 DELTA is the tier answer
          ↓
 PRODUCTION READINESS          ← ⛔ blocked on DP.2 promote; prod is :5432 and serves a 2026-07-02 build
```

---

## 4 · Document reconciliation (D-15)

| Document | Disposition |
|---|---|
| `~/Downloads/S-5-LOAD-TEST-APPROACH.md` (2026-08-27) | ⭐ **Keep as the input it says it is.** Its §4 (`max: 4` is the thing under test), §8 (the three S-3 instrument lessons) and §11 (the three UNMEASURED handovers — H-3 Supavisor cleanup, H-4 timers during a wedge, H-5 Vercel duration) are **absorbed** into this set. **Recommended amendment: none — move it to `docs/scale/` under D-1** so it stops being Downloads-only |
| `docs/plans/S-5.md` (2026-08-30, this session, untracked) | ⛔ **SUPERSEDED by this set** — it was written from `main` alone and therefore could not see the tracker, the ground truth, ENGINE.10's ratified gate, or the approach doc. **Recommended: rewrite as a one-screen pointer to these five, or delete before anything is committed.** Left in place, untouched, pending D-0 |
| `docs/plans/ENGINE.10.md` + `docs/logs/ENGINE.10*.md` | **Authoritative for the 12-axis spine and the k6 carry-forward.** ⛔ **No amendment** — D-3 resolves the gate conflict in a *new* record, never by editing a ratified plan |
| `docs/parked.md` — PERF-2, STAGING-POOL-UNDERSIZED, COLD-START | **Consumed here.** ⛔ **No amendment until the runs discharge them** |
| `ZUGZWANG_SCALE-TRACKER_v1_1.md` | ⛔ **Do not edit.** *"The programme chat owns this file… A dev who acts against it has left the ritual."* Findings are **reported**, not folded |
| ADR-0038 / P1 | **Governing.** If D-2 rules "concurrent", ADR-0038 §Context needs a **superseding record** — not a patch |
| ADR-0041 **OQ-1** | ⛔ **Open, owned elsewhere.** S-5 measures; it does not fix |

---

## 5 · What this roadmap deliberately does not do

⛔ Install k6 · build a rig · write a k6 script · seed any database · run any test · change
`max`, Pool Size, any TTL, any cache key, any rate-limit constant, the compute tier, the
region, or the schema · touch the moderation pipeline · touch `docs/scale/`, the tracker, or
`ZUGZWANG_*` documents · restore `drizzle/` · commit, branch, or open a PR · rule any decision
in §1 · declare production readiness.

---

*Roadmap only. Every phase is a proposal; every decision is open; nothing is scheduled.*
