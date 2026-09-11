# ZUGZWANG — LOAD PROGRAMME · DAY 1 EXECUTION PACK
## Ratification record · amendments · six kickoff relays

**Version** 1.0 · **Authored** 2026-08-30 (Sun) · **Author** web Claude
**Ratified by** Hrishikesh, 2026-08-30 — *"go with best recoms"*
**For** Mon 31 Aug 2026, 09:00 IST
**Reads with** `ZUGZWANG_LOAD-PROGRAMME-TRACKER_v1_0.md` · `ZUGZWANG_S-5_RULINGS_v1_0.md`
**Repo path on commit** `docs/scale/DAY-1-PACK.md`

---

## 1 · What is now ratified

| # | Ruling | Locked |
|---|---|---|
| **R-1** | Shourav owns the runs. The five dev documents are adopted as **audit input**, not as a lane assignment | ✅ |
| **R-2** | **Cumulative** per ADR-0038. Find the ceiling, state the margin. Do not test *toward* a number | ✅ |
| **R-3** | The later founder ruling stands; **`p95 < 500 ms` is retired**. N is not pre-set. Abort / Reported / one Pass-Fail question, kept strictly separate | ✅ |
| **R-4** | Run #2's single variable is **Pool Size**. Nothing else moves | ✅ |
| **R-5** | **One** RITUAL change (`connect_timeout`). **No `maxDuration` before run #1.** `PENDING_TTL_SECONDS` becomes a written derivation plus an armed abort at **0.5 ×** its value | ✅ |
| **R-6** | Moderation: **no stub, no carve-out.** Real vendor, bounded volume | ✅ |
| **R-7** | `identity_pool` decoupled — staging to run volume + margin; **production 100k belongs to the 10–15 Sep window** | ✅ |
| **R-8** | Signup: **(b) at volume + bounded (a) sample, capped by count.** (c) refused | ✅ |
| **R-9** | Bet contention **OUT**. Retry rates still recorded | ✅ |
| **R-10** | Fixture destruction accepted **once** — one reset, seed once, one rebuild | ✅ |
| **R-11** | Sentry sampling reduced for the run and **recorded in the provenance block** | ✅ |
| **R-12** | Soak folded into S-9. The 24 h soak **ends with a deliberate stop + ≥15 min sampled window** | ✅ |
| **R-13** | Every conclusion carries the **staging-is-not-production** sentence | ✅ |
| **R-14** | Rig-ceiling gate — **3× headroom** or escalate to DGX same day | ✅ |
| **M-0** | **Arrival rate, not VU count.** `constant-arrival-rate` executor. `constant-vus` prohibited outside Stage 2 | ✅ |
| **M-1** | Design target ≈ **450–500 req/s**. Ramp ceiling **1,500 req/s** | ✅ |
| **M-2** | Pass/fail margin **2×** | ✅ |
| **M-3** | First-hour signup share **10 %** ⇒ peak 8–14/s ⇒ **test signup to 30/s** | ✅ |
| **L-1** | Lanes: **Ritam** read · **Aditya** write + S-2 · **Shourav** measurement | ✅ |
| **L-2** | Gate C windows **13:00** and **19:30 IST**, daily | ✅ |

---

## 2 · Amendments arising from the 2 M → 2–5 M revision

### A-1 · The page-load target moved and the record has not

`ADR-0038` ratifies **2,000,000 page loads**. The founder's stated goal is now **2–5 million**.
⛔ **A ratified number has moved and nothing records it.**

**Action:** an **append-only amendment note against ADR-0038** — not an in-place rewrite of the
decision body. One paragraph: the range, the date, and the fact that the concurrency premise
(`≤5,000`, ADR-0006) is **unchanged and still governs the load model**.

### A-2 · What the revision changes — and what it does not

⛔ **It does not change the load model.** The design target is derived from *concurrency*, not
from cumulative volume:

```
5,000,000 loads ÷ 52 days ÷ 86,400 s   =   1.11 req/s  mean
                        × a 50× peak factor  ≈  56 req/s
DESIGN TARGET from concurrency                ≈ 450–500 req/s   ← still ~10× larger
```

⇒ **Every stage, ramp, threshold and abort in the tracker stands unchanged.** Devs do not
re-plan anything.

**It does change four vendor ceilings, all of which are plan-tier questions, none of which are
code:**

| Ceiling | At 2 M | At 5 M | Note |
|---|---|---|---|
| **Upstash commands** | ≥ 2 M `INCR` + a `GET` per render | **≥ 5 M `INCR`** + renders | ⛔ **the visits counter is 1 `INCR` per real load and 1 `GET` per render.** The render count is the bill, not the load count |
| **Sentry / PostHog events** | quota sized for 2 M | **2.5×** | going blind on the busiest day is the failure mode |
| **Vercel invocations + bandwidth** | — | **2.5×** | a spend cap is set; confirm the cap still permits the new ceiling |
| **Cost model** | ~$850–1,500/mo | re-derive | tracker §"What it costs" needs the sweep |

### A-3 · ⛔ "Page load" needs one definition before any plan is sized

The two candidate definitions differ by an order of magnitude, and **the vendors bill the
larger one**:

| Definition | What counts | Rough scale at 100k signups |
|---|---|---|
| **(i) Visit** | a real, bot-filtered page load — what `/api/visits` increments | the 2–5 M figure |
| **(ii) Render** | every server render, **including each 15-second poll tick** | a single 10-minute session = **40 renders**. Sessions × 40 |

A participant with one ten-minute session generates **one visit and forty renders**. If the
2–5 M figure means (i), the render count — and therefore the Upstash, Sentry and Vercel bills —
is very much larger and has never been estimated.

⟦**FOUNDER — one line needed:** does 2–5 M mean visits or renders?⟧
**Recommendation: define the target as (i) visits, and have Stage 3 measure the render
multiplier empirically.** The multiplier is exactly what Stage 3's poll-cost measurement
produces, so the number arrives from the run rather than from a guess — which is the
programme's whole method.

### A-4 · ⭐ The moderation rate limit may be the real ceiling, and it is readable on Monday without running anything

This is the highest-value item on Day 1 and it takes ten minutes.

Every bet carries a comment. Every comment goes through the moderation vendor **before** the
transaction opens. So:

```
DESIGN TARGET       450–500 req/s
× 10 % writers      (the ratified mixed profile)
= WRITE RATE        ~45 bets/s   =   ~2,700 moderation calls per MINUTE
```

⛔ **If the account's moderation rate limit is below ~2,700/min, the vendor is the bet-throughput
ceiling — not Postgres, not the pool, not the cache.** No amount of compute, pool size or
caching moves it, and the entire tier decision on Thursday would be answering the wrong
question.

**Action, Monday morning, before any code:** read the account's moderation rate limit and its
current pricing posture off the vendor dashboard, and write both down with the date.

| If the limit is | Then |
|---|---|
| **≥ 2,700/min** | moderation is not the constraint. Proceed as planned |
| **< 2,700/min** | ⛔ **that number is the ceiling.** It becomes the headline finding of the programme, Stage 6's rate is set by it, and the founder has a vendor conversation, not an infrastructure one |

### A-5 · Moderation budget — provisional, pending A-4

⟦Recommendation, ratified as provisional⟧ **$50 for the whole programme, hard-capped at
150,000 calls**, with the rig counting calls and aborting at the cap.

⚠ The dev audit describes the moderation endpoint as *"metered, costs money per call."*
**That premise is not verified and it changes the shape of Stage 6.** If A-4 shows the endpoint
is free-but-rate-limited, the binding constraint is requests per minute and the dollar cap is
irrelevant. **Verify Monday; do not carry the premise forward unchecked.**

### A-6 · Amendment to R-14 — the rig ceiling needs two probes, not one

Bandwidth, not CPU, is the likely binding constraint on a laptop rig:

```
1,500 req/s  ×  ~50 KB per real page  =  75 MB/s  =  ~600 Mbps sustained
```

⇒ **Two probes, and the rig's ceiling is the lower of the two:**

| Probe | Target | Measures |
|---|---|---|
| **P-1** | a trivial static endpoint (tiny response) | connection + CPU ceiling |
| **P-2** | a **representative-size** static asset | **bandwidth ceiling** |

**Record req/s *and* bytes/s for both.** A rig that clears 4,500 req/s on P-1 and 300 req/s on
P-2 is a 300 req/s rig, and pointing it at the application would produce a number about a home
internet connection.

---

## 3 · The six kickoff relays

**Distribute one block per chat.** Each is self-contained. ⛔ **Do not merge two blocks into one
chat** — compaction is how a measurement gets asserted from memory instead of measured.

**Every block carries the transmission law.** File first, to `~/Downloads`, incrementally,
before any inline output. Headline **≤10 lines**. `LINES` and `MD5` are the **last action taken**
(`wc -l` then `md5`), never asserted from memory.

---

### ▣ RELAY A1 · SHOURAV · Mon 09:00 · **RECON — READ ONLY**

```
TASK: S-5 Day-1 recon. Read-only measurement of live repository and staging state.
MODE: ULTRA. No plan mode needed — nothing is written to the repo in this session.

⛔ HARD FENCE — this session writes NOTHING to the repository, staging, any
dashboard, or any vendor. No branch, no commit, no PR, no migration, no seed,
no config change. If you find yourself about to mutate anything, HALT and report.

⛔ MEASURE, NEVER INFER. Every answer below must be accompanied by the exact
command that produced it and that command's raw output. An answer without a
command is not an answer. If something cannot be measured from this session,
write "NOT MEASURABLE FROM HERE" and say what would measure it. Do not fill a
gap from a planning document, from project knowledge, or from memory.

CONTEXT: A five-document S-5 audit set was written on 2026-08-30 against commit
44c9f99. Every figure in it is now at least a day old and several are load-bearing.
This session re-measures them. Treat the audit set as a list of claims to test,
not as facts.

ANSWER ALL OF THE FOLLOWING:

REPO STATE
 1. origin/main HEAD SHA, its date, and how far the local worktree is from it.
 2. Does `drizzle/` exist at the repository root? Does `docs/drizzle/` exist?
    If the directory moved, confirm content identity against HEAD and report
    exactly which paths differ.
 3. Does `docs/scale/` exist on main? List it if so.
 4. Migration head name; count of migration files; count of journal entries;
    count of rows applied on staging. Report all four — a mismatch is a finding.
 5. Highest ADR number present on main, read by listing docs/adr/, never counting
    from memory.

BOUNDS AND CONSTANTS (each: value, file, line)
 6. Pool `max` in src/db/index.ts.
 7. `connect_timeout` — every hit in src/ and any config file. Zero hits is an answer.
 8. `maxDuration` — every hit in src/, vercel.json, and route files. Zero hits is
    an answer.
 9. `PENDING_TTL_SECONDS` current value and the file it is defined in.
10. `statement_timeout` and `idle_in_transaction_session_timeout` as actually set,
    with their call sites.
11. The poll interval constant, its value, and every place it is consumed.
12. `tracesSampleRate` in each of the three Sentry configs.

RATE LIMITING — this one decides whether the load rig is viable at all
13. Read checkRateLimit and report EXACTLY what it keys on. Specifically: does it
    derive the key from an X-Forwarded-For header, from a socket address, or from
    something else? Quote the code. State whether a caller can influence the key
    by setting a request header.
14. The configured limits for betPerIp, otpRequestPerEmail, otpRequestPerIpBurst.
15. Confirm or refute: checkRateLimit fails OPEN when its backing store is
    unavailable. Show the code path.

MODERATION — highest priority answer in this list
16. Which moderation endpoint/model is called, from which file, at which point in
    the bet path (before or after the transaction opens).
17. `OPENAI_TIMEOUT_MS` and the retry policy as coded.
18. Does any staging-only, test-only or env-gated posture for the moderation call
    ALREADY exist in the codebase? Quote it if so. If none exists, say so plainly
    — the answer determines whether a change would be a new carve-out.

TEST DATA
19. Live staging `identity_pool`: total rows and unassigned rows, as of NOW, with
    the timestamp in the output.
20. `EXPECTED_TOTAL` in scripts/seed-identity-pool.ts, and precisely what the
    script does when the live count does not match it.
21. Row counts for markets, comments, bets, events on staging as of NOW.

ENVIRONMENT
22. GET /api/health on staging — full response. Report canary, region, db, and the
    migration-drift field verbatim.
23. Run scripts/verify-pooler-mode.ts against staging and report which pooler the
    shipped @/db singleton actually opens.
24. Run scripts/sample-backend-activity.ts --self-test against staging. Report
    whether it is GREEN. Attach the self-test record from the JSONL, not the console.
25. Is k6 installed anywhere on this machine? Is it referenced in package.json,
    justfile or scripts/? Report the version if present.
26. This machine's specification: CPU cores, RAM, and a measured download and
    upload throughput to a public endpoint. These decide whether this box can be
    the load generator.

OUTPUT
Write ~/Downloads/zz_S5-RECON_<UTC timestamp>.md incrementally as you go, before
any inline output. One section per numbered item, each with its command and raw
output. End with a table of the six figures that contradict the audit set, if any.

Then a headline of at most 10 lines:
FILE · LINES · MD5 · STATUS · HALTED-AT · up to 4 lines of measurement headline ·
UPLOAD flag. LINES and MD5 are your LAST actions — wc -l then md5 — never asserted.

HALT AND REPORT IMMEDIATELY IF: item 13 shows the limiter keys on a socket
address rather than a header · item 24 is not green · item 19 returns fewer than
500 unassigned rows · item 22 shows migration drift.
```

---

### ▣ RELAY A2 · SHOURAV · Mon 13:00 · **REPO REPAIRS + RIG + CEILING PROOF**

```
TASK: S-5 Day-1 part 2. Two small repo repairs, then build the load rig and prove
its own ceiling. Depends on RELAY A1's output — read it first.
MODE: ULTRA for the repairs and the rig. Both touch tests/, scripts/ and docs/ only.

⛔ HARD FENCE: this session does not touch src/. Not one line. If the rig appears
to need a src/ change, HALT and report — it does not, and needing one is a finding.
⛔ No load is offered to the application in this session. The rig is pointed only
at trivial and static targets today.
⛔ k6 is installed as a STANDALONE BINARY. It never enters package.json. A load
tool has no business in the production bundle and adding a dependency is a
separate decision with its own ritual.

PART 1 — REPAIRS
 1. If A1 confirmed drizzle/ moved to docs/drizzle/, restore it to the repository
    root. Verify afterwards that drizzle.config.ts resolves, the migrate scripts
    resolve, and /api/health's file-tracing include is intact. One PR, merges on green.
 2. Commit docs/scale/ to main, containing: the scale tracker v1.1, the ground
    truth handover, the operating ritual, the S-1 handover, the load-programme
    tracker v1.0, the S-5 ruling record v1.0, and this pack. These documents govern
    the programme and currently exist only in Downloads and project knowledge.
    Same PR or a second one, merges on green.

PART 2 — THE RIG
 3. Install k6 as a standalone binary. Record the version.
 4. Write the load scripts under tests/load/. Requirements, all mandatory:
    · ⛔ constant-arrival-rate executor ONLY. constant-vus and ramping-vus are
      PROHIBITED in this programme except inside the Stage 2 positive control,
      which is written separately and marked as the exception.
      Reason: 5,000 concurrent USERS on a 15-second poll offer ~450-500 req/s.
      5,000 closed-loop VIRTUAL USERS offer ~25,000 req/s. Building the rig on
      the second measures a denial-of-service attack, not this application.
    · Rate is the ramped variable. VUs are allocated to sustain the rate.
    · Per-request record: URL · status · wall clock · limiter decision as RETURNED
      (never inferred) · canary SHA · pooler mode · offered rate step.
    · Correlation to the sampler JSONL uses the clock offset the sampler already
      takes at start AND end. Never an assumed shared clock.
    · Results exported as JSON and retained with the run's provenance block.
 5. Source-address strategy. A1 item 13 decides this:
    · If the limiter keys on a request header the caller can set: vary that header
      per virtual user. Zero code change, no rate-limit constant moved. ⛔ Record
      this in the provenance block of EVERY run — the same weakness is an open
      go-live finding, and a run that routes around it has NOT proven the limiters
      hold. Write that sentence in the report.
    · If it keys on the socket address: HALT. Do not proceed and do not modify any
      limiter constant. This becomes a founder ruling.
 6. Arm the aborts. The rig aborts the run on any of:
    A-1 any invariant violation
    A-2 any bet wall clock exceeding 0.5 × PENDING_TTL_SECONDS (value from A1 #9)
    A-3 any request with no recorded terminal state
    A-4 vendor call count passing the run cap
    A-5 (Stage 2 only) the failing arm not failing

PART 3 — THE CEILING PROOF ⭐ this decides whether this machine can be the generator
 7. TWO probes. The rig's ceiling is the LOWER of the two.
    P-1 · a trivial static endpoint, tiny response → connection and CPU ceiling
    P-2 · a representative-size static asset (~50 KB) → BANDWIDTH ceiling
    Ramp each until it stops scaling. Record req/s AND bytes/s AND generator CPU
    for both. Bandwidth is the likely binding constraint, not CPU: 1,500 req/s at
    ~50 KB is roughly 600 Mbps sustained.
 8. GATE: the rig must sustain at least 4,500 req/s — 3× the 1,500 req/s ramp
    ceiling — on the lower of the two probes, with generator CPU below 60%.
    · PASS → this machine is the generator. Record the measured ceiling; it goes
      in every provenance block from here on.
    · FAIL → HALT and escalate the same day. Do not point the rig at the
      application. A rig whose own ceiling is unknown produces a number about the rig.

OUTPUT
Write ~/Downloads/zz_S5-RIG_<UTC timestamp>.md incrementally. Include both probe
curves as data, not prose. Headline ≤10 lines with MEASURED lines and md5, as A1.
State the PASS/FAIL of item 8 in the first line of the headline.
```

---

### ▣ RELAY B1 · ADITYA · Mon 09:00 · **S-2 — HARNESS HONESTY**

```
TASK: S-2, folded into the load programme. Make the test harness honest before it
is used to judge anything. Every number the load programme produces will be read
through this instrument.
MODE: ULTRA. Tests only.

⛔ HARD FENCE: zero changes to src/. This session touches tests/ and docs/ only.
If a harness defect appears to require a src/ change, that is a FINDING — write it
up and stop. Do not fix it here.

CONTEXT: S-2 was opened 2026-08-20 against "five known harness defects: reproduce,
classify false-PASS / false-FAIL, fix or scope, add positive controls." It was
never closed. Partial work may exist.

STEP 1 — LOCATE
 1. Find the S-2 defect list. Check docs/plans/, docs/logs/, docs/parked.md, and
    any S-2 branch or PR. Report where you found it and quote the five defects.
 2. If the list cannot be found: say so plainly, do not reconstruct it from memory,
    and instead produce your own enumeration by reading the suite — every place the
    harness could report a pass that is not a pass, or a fail that is not a fail.
 3. Report any partial S-2 work already in flight.

STEP 2 — FOR EACH DEFECT
 4. REPRODUCE it. A defect described but not reproduced stays described.
 5. CLASSIFY it: false-PASS (the dangerous class) or false-FAIL (the expensive one).
 6. FIX it, or SCOPE it in writing. A scoped defect is written as: "this harness
    cannot be trusted to say X; it can be trusted to say Y." Scoping is an
    acceptable outcome. Silence is not.
 7. ADD A POSITIVE CONTROL. ⛔ This is the deliverable that matters most.
    A test that always passes is indistinguishable from a test that verifies
    nothing. A deadlock test that always hangs is indistinguishable from one that
    detects a deadlock. Every assertion in this suite needs a condition under which
    it demonstrably FAILS.
    You built exactly this shape in S-3 — clean at N=3, wedged at N=4. Reuse the
    pattern.

STEP 3 — THE STATEMENT
 8. Produce, as the header of your output, a plain statement of what this harness
    can and cannot be trusted to assert as of today. That statement gets quoted in
    the run reports. Write it so a reader in November understands the limits of
    every number this programme produced.

EXIT: every defect fixed with a positive control, or scoped in writing. No defect
left silent.

OUTPUT
Write ~/Downloads/zz_S2-HARNESS_<UTC timestamp>.md incrementally, before any inline
output. Headline ≤10 lines: FILE · LINES · MD5 · STATUS · HALTED-AT · ≤4 lines of
measurement headline · UPLOAD flag. LINES and MD5 measured last, never asserted.
```

---

### ▣ RELAY B2 · ADITYA · Mon 11:00 · **THE TWO BOUNDS — ⛔ PLAN MODE ONLY**

```
TASK: The money path's wall clock. Two bounds, one plan chat.
MODE: ⛔ PLAN MODE. This session writes NO code and opens NO PR. It produces a plan
for web review and founder ratification. A fresh chat executes it afterwards.

⛔ src/db/index.ts and the bet path are named critical paths. Plan-then-execute is
not optional on them regardless of how small the change looks.

BACKGROUND, already ruled — do not reopen:
· Under the transaction-mode pooler a bet queues for a backend BEFORE the
  transaction opens, which is upstream of every SET LOCAL. So statement_timeout
  (1,000 ms) and idle_in_transaction_session_timeout (30,000 ms) both live INSIDE
  a transaction that has not started yet. They do not bound this.
· `maxDuration` on the money path is RULED OUT before run #1. The duration would
  be a guess, and killing the function leaves the transaction to roll back or sit
  idle-in-transaction holding one of fifteen backends, while the pending
  idempotency ticket outlives the request. That produces a bounded ambiguity, not
  a clean failure — and resolving exactly that ambiguity is what ADR-0044 exists
  for. The cap gets chosen from Stage 6's measured distribution, later, as its own
  fenced change.

DELIVERABLE 1 — PENDING_TTL_SECONDS re-derivation (a DOCUMENT, not code)
 1. Read ADR-0044 first. 30 s > 10 s is load-bearing to its double-charge reasoning
    — establish exactly how before you touch the derivation.
 2. The current 30 s was derived from "bet transaction worst case ~600 ms upper", a
    bound that held only because the session pooler failed fast. That premise is
    dead. Re-derive it against the transaction-mode reality.
 3. Output a WRITTEN derivation that names, explicitly, the assumption Stage 6 will
    test. If the conclusion is that 30 s still holds, say so and show the working —
    "unchanged" is a valid result when it is derived.
 4. This discharges S-1's written gate: "load must not run until it is re-derived
    or the wall clock is bounded upstream." It discharges it by DERIVATION plus the
    armed abort below, not by a code change.

DELIVERABLE 2 — connect_timeout, planned (the ONE ritual change of Day 1)
 5. Plan the pinning of connect_timeout in src/db/index.ts. Currently unpinned.
 6. The plan must contain the DERIVATION of the value, not just the value. The
    derivation goes in the code comment alongside the constant — a pinned number
    with no derivation is the next person's mystery.
 7. Blast radius, rollback, and the test that proves the pin took effect.
 8. Confirm this does not disturb anything S-1 established in the same file.

DELIVERABLE 3 — the armed abort, specified for the rig
 9. Specify, for Shourav to implement in the rig: the run ABORTS if any bet's wall
    clock exceeds 0.5 × PENDING_TTL_SECONDS. State the value, how the rig observes
    a bet's wall clock, and what it captures at the moment of abort so the abort is
    itself a measurement rather than just a stop.

OUTPUT
Write ~/Downloads/zz_BOUNDS-PLAN_<UTC timestamp>.md incrementally. The plan goes to
web review, then founder ratification, then a FRESH chat executes deliverable 2.
Gate C window: 13:00 IST.
Headline ≤10 lines with MEASURED lines and md5.
```

---

### ▣ RELAY C1 · RITAM · Mon 09:00 · **TEST DATA — ⚠ THE DAY'S LARGEST SCHEDULE RISK**

```
TASK: Give the load programme data worth measuring against. Today's single biggest
schedule risk — if this slips, Tuesday slips.
MODE: ULTRA. scripts/ and test fixtures only.

⛔ HARD FENCE: nothing is mocked. ADR-0036 primitive 3 — anything that writes a row
or moves Dharma goes through a real entry point. A seeder that INSERTs directly into
the ledger produces a database this application could never have produced, and every
measurement taken against it is a measurement of a fiction.
⛔ Do not change any cache key, TTL, cacheLife profile, rate-limit constant, pool
size, region or schema.

CONTEXT — the problem being solved:
Every performance measurement this project has ever taken ran against a database
holding roughly TEN comments and TEN bets IN TOTAL. Discovery's eight per-market
computations therefore ran over about one row each. The constant is fixed and small;
the variable has never been touched. That is PERF-2, and it is why no existing
number says anything about behaviour at volume.

STEP 0 — ONE RESET, ONCE
 1. Reset staging ONCE, then seed. ⛔ Not between runs. The md5-pinned fixture set
    is accepted as lost for the week — this is a ratified cost, not an accident.
    Rebuild happens once, after the last run, before S-9.

STEP 1 — identity_pool
 2. Seed staging's identity_pool to the run's own signup volume PLUS margin.
    ⛔ NOT to 100k. The 100k figure belongs to PRODUCTION and to the 10-15 Sep
    window; it is not this week's job and seeding it here wastes hours.
    Sizing input: signup stage tests to 30/s. Size for that rate sustained across
    the stage, times three.
 3. If scripts/seed-identity-pool.ts asserts a fixed EXPECTED_TOTAL and exits on a
    mismatch, report that behaviour — do not work around it silently.
 4. Re-measure the live unassigned count AFTER seeding, with a timestamp. A seed
    that was not counted afterwards has not been verified.

STEP 2 — VOLUME FIXTURE ⭐ the deliverable
 5. Markets: the eight featured, PLUS depth beneath them, so Discovery's
    "open markets ordered by creation date, limit eight" is sorting over a realistic
    set rather than over exactly eight rows.
 6. Comments per market: ⛔ spanning a RANGE, not one value. The whole point is to
    learn how cost scales with comment count; a single value tells you one point on
    a curve you cannot then draw. Span at least an order of magnitude across markets.
 7. Bets and events per market: likewise, spanning a range.
 8. Designate at least ONE HOT MARKET that will carry the write load on Wednesday.
    Mark it clearly so every downstream measurement can segment on it.
 9. Record final row counts per table, with a timestamp.

IF YOU RUN OUT OF TIME: reduce the RANGE, never its EXISTENCE. Three markets at
10 / 300 / 3,000 comments is far more useful than twenty markets at 500 each.
One value measures nothing about scaling.

OUTPUT
Write ~/Downloads/zz_FIXTURE_<UTC timestamp>.md incrementally. Include the final
row-count table and the hot market's identifier. Headline ≤10 lines with MEASURED
lines and md5.
HALT AND REPORT IF: seeding through real entry points proves impossible within the
day — that is a finding about the entry points, not a reason to insert directly.
```

---

### ▣ RELAY C2 · RITAM · Mon 14:00 · **CACHE INSTRUMENTATION — ⚠ SC-1 APPLIES**

```
TASK: Make cache hit rate observable. Nothing in this repository currently counts a
cache hit — not the Data Cache, not any "use cache" block, not the Redis
cache-asides. The existing figures are STATEMENT COUNTS from a single user, which
tell you what a warm render costs and never how often a render is warm.
MODE: ULTRA. ⛔ Gate C diff-read at 19:30 IST — this one is reviewed.

⛔ HARD FENCE — read this twice:
· This is INSTRUMENTATION. No cache is added, removed, re-keyed or re-TTL'd.
· ⛔ The reserves-based cache keys are a RATIFIED CORRECTNESS GUARANTEE (ADR-0041
  D-2). They do not move. Not "improved", not "optimised".
· ⛔ cacheLife profiles do not move. They are the framework's defaults and changing
  them is a decision nobody has made.
· ⛔ ANY change to a read over comments.body fires CLAUDE.md §5.14 SC-1, whose test
  obligation is to assert the BODY'S ABSENCE, not the row's. If your counter's
  placement touches such a read, STOP and report before writing a line.

DELIVERABLES
 1. Per-block hit/miss counters for all four "use cache" blocks. Emitted with the
    run's provenance block, not to a console.
 2. ⭐ Segmentation by MARKET WRITE-RATE. This is the headline measurement of the
    entire programme and it is invisible to any single-user test by construction.
    The reason: two of the four blocks are keyed on reserves, so ONE BET on a hot
    market invalidates the cached debate view FOR EVERY READER OF THAT MARKET, and
    the miss path re-runs an unbounded comment scan. On the busiest market, at the
    moment it is busiest, per-reader cost reverts to cold.
    ⛔ The counters must therefore distinguish: hits on the designated hot market
    versus hits on a zero-write market, in the same run. A single aggregate hit
    rate averages the finding away.
 3. A counter for derivations of the reserve walk per minute, so Wednesday can test
    whether its 60-second floor coalesces: fifty bets in thirty seconds must
    produce ONE derivation, not fifty.
 4. A POSITIVE ASSERTION for the star count: assert the count is PRESENT in the
    rendered header AND the upstream call budget is not being burned. ⛔ This
    failure is silent by design — the fetch fails safe to null, the header renders
    without a count, permanently, and nothing goes red.
 5. Invalidation latency: time from an invalidation call to the first evicted serve.
    ⛔ This is the safety property. ADR-0041's CRITICAL was an invalidation that did
    not evict, and the mechanism it broke was the Admin Control Centre's Remove
    action — moderation not taking effect.

POSITIVE CONTROLS — required, per counter
 6. Each counter needs a demonstrated condition under which it MOVES. Place a bet
    and show the debate-view entry miss. Drive a zero-write market and show it hold.
    An uncalibrated counter reading zero is indistinguishable from a broken one.

OUTPUT
Write ~/Downloads/zz_CACHE-INSTR_<UTC timestamp>.md incrementally. State explicitly
whether any read over comments.body was touched — the answer must be NO.
Headline ≤10 lines with MEASURED lines and md5. PR by 19:00 for the 19:30 window.
```

---

## 4 · Monday's shape

| Time (IST) | Ritam | Aditya | Shourav | Founder |
|---|---|---|---|---|
| 09:00 | **C1** fixtures | **B1** S-2 harness | **A1** recon | — |
| ~10:00 | ↓ | ↓ | ↓ | ⭐ **A-4 moderation rate limit + A-2 dashboard values** |
| 11:00 | ↓ | **B2** bounds — plan mode | ↓ | — |
| 13:00 | ↓ | 🚪 **Gate C** — bounds plan | **A2** repairs + rig | 🚪 review |
| 14:00 | **C2** cache instrumentation | execute connect_timeout | ↓ | — |
| ~17:00 | ↓ | ↓ | ⭐ **ceiling proof — PASS/FAIL** | — |
| 19:30 | 🚪 **Gate C** — cache instr. | — | — | 🚪 review |
| EOD | row counts recorded | harness statement written | rig ceiling recorded | Sentry posture applied |

**Day 1 exit criterion:** every row of tracker §4 Day 1 green, and the rig's own ceiling
measured and passing.

**Day 1 abort:** the harness leaves an unfixed, unscoped defect · the rig fails its ceiling and
no DGX · the sampler self-test is not green · the limiter keys on a socket address.

---

## 5 · What Monday does not need

⛔ Nobody waits on a ruling to start. Every block above is runnable at 09:00. The remaining
open items — the page-load unit definition (A-3) and the moderation posture (A-4/A-5) — first
bite on **Tuesday and Wednesday respectively.**

⛔ No load is offered to the application on Monday. Not "briefly", not "to check". The first
request the rig sends to the app is Tuesday's noise floor, and it is sent after the sampler is
green and the harness has been made honest.

---

*Prescriptive record. Web-authored, CC-committed. Ratified 2026-08-30. Nothing here has been executed.*
