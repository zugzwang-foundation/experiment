# S-1 · Stage 3 execution — session log

**Task:** S-1 — transaction pooler migration. This session: pre-flight checks for F-1b, the
F-1 gate re-verification, and two runs of criterion 6.
**Ritual:** CC-LIGHT, gated. `ultracode` FORBIDDEN, not used. No subagents invoked (the
cascade is step (c) and did not run).
**Ground:** `origin/main` @ `a1005b6`; branch `fix/pool-transaction-mode` @ `b98efe3`.

> Continues `docs/logs/S-1-stage3.md`. That file is not amended.

---

## ✅ HEADLINE — CRITERION 6 IS **GREEN**

`:6543` on the staging Supabase project **is** multiplexing: a single backend was observed
serving two distinct client connections while both were open. That is transaction-pooler
behaviour, and it is the criterion.

⚠ **THE SHIPPED CONTROL STILL PRINTS `VERDICT: SESSION MODE` AGAINST THIS POOLER.** That
verdict is a **false negative**, reproduced identically on both runs. Anyone who re-runs
`scripts/verify-pooler-mode.ts` here will see RED and must read this log to interpret it. The
criterion is green on the evidence below, **not** on the script's verdict line.

⚠ **THIS SECTION REVERSES AN EARLIER VERSION OF THIS SAME FILE**, which recorded criterion 6
as RED and S-1 as BLOCKED pending a vendor-side pooler check. That conclusion was wrong, it is
preserved below rather than deleted, and **why** it was wrong is the most useful thing here.

**Criterion 2's preview half now has evidence too — Part 2 below.** It is strong, it kills the
Fluid-artifact hypothesis, and it is **NOT conclusive**: §4 property 3's temporal A/B is absent
entirely. **Criteria 3a and 3b are discharged from F-2** and need no new observation.

---

## What landed

**No code changes. No application-code commits. No PR.** This session produced verification
evidence; the only repository artifact is this log.

Two operator actions landed in Doppler `stg` (founder, not CC):

| | Key | State |
|---|---|---|
| F-1 | `DATABASE_URL_TXN` | re-minted mid-session after the first check found it wrong (below) |
| F-1b | `DB_POOLER_MODE` | **SET to `transaction` — and still set as of session close** |

### Pre-flight evidence

| # | Check | Result |
|---|---|---|
| 1 | Doppler `stg` scope — SCOPED or SHARED? | **SHARED**. `stg` syncs to Vercel **Staging AND Preview**, no per-secret filter (ADR-0024 D1 errata `:166`/`:168`, restated `:212`). Inert on other lanes only because `main`/`staging` carry no flag-reading code. |
| 2 | F-1 gate, first check | ⛔ **FAILED** — `DATABASE_URL_TXN` was `db.<staging-ref>.supabase.co:6543`, the **direct** host. The port satisfied the gate's wording; the host did not. A gate that reads discharged on a glance at the port is the failure mode this catch names. |
| 3 | F-1 gate, after re-mint | ✅ `aws-1-ap-south-1.pooler.supabase.com:6543`, staging ref, distinct from `DATABASE_URL`, which is unchanged at `:5432`. |
| 4 | Read-only connectivity probe | ✅ TCP **PASS** · PG connect **PASS** · `SELECT 1` **PASS**. |
| 5 | `DB_POOLER_MODE` in Doppler `stg` | ✅ reads back `transaction`. |

---

## Criterion 6 — two runs, and the chronology matters

### Run 1 — NON-DISCRIMINATING (the run that produced the wrong answer)

| | |
|---|---|
| Control | backend `3928215` · `VERDICT: SESSION MODE` · SET survived 5 sequential reads |
| Idle-hold | backend `3929677`, opened `20:14:05Z`, held idle |
| DASH observation | operator: `3929677` idle **3+ minutes, no `state_change`** |
| Conclusion drawn | criterion 6 **RED**, root cause "most likely vendor-side" |

⛔ **The two halves never overlapped.** The control ran, exited, and only then was the holder
opened. **At no point were two client connections open at once**, so nothing in run 1 could
distinguish a *pinned* backend from an *unused pooled* one. Both look exactly like a row
sitting `idle` with a frozen `state_change`.

### Run 2 — DISCRIMINATING (the decisive run)

Fresh everything. Observing channel `:5432` (observer backend `3932088`), never through the
pooler under test — S-1 plan §4 property 1.

| | |
|---|---|
| Idle-hold | backend **`3932085`**, opened `20:46:53Z`, one statement at `20:46:56.722Z`, then idle |
| Samples 1-6 | `20:47:30` → `20:51:41`, all `state=idle`, `state_change` **frozen** at `20:46:56.722Z`, `idle_for` 00:00:36 → 00:04:47 |
| Control | ran `~20:52:08` **while the holder was still connected** → reported backend **`3932085`** — *the holder's backend* · `VERDICT: SESSION MODE` |
| Post-check `20:53:05` | `3932085` `state_change` **ADVANCED to `20:52:08.275Z`** — the control's run — while the holder had issued nothing since `20:46:56` |
| Holder liveness | `netstat`: socket PID 20688 → `:6543` **ESTABLISHED** at that moment |
| After disconnect `20:54:23` | `3932085` **persists**, `state=idle`, `state_change` unchanged; census steady at 10 backends |

**⇒ One backend served two distinct client connections while both were open.**

Under session mode a server connection is checked out to one client for the life of its
session; a second client cannot be served by it. The holder was therefore holding a **client**
connection while holding **no server backend** — which is multiplexing, i.e. transaction mode.

*(The post-disconnect persistence is corroborating, not decisive: Supavisor pools server
connections in both modes, so a surviving backend proves little on its own. The decisive fact
is the cross-connection sharing while both clients were live.)*

---

## Why the first conclusion was reversed

**The run-1 observation had no discriminating power, and was treated as though it did.**

An idle backend with a frozen `state_change` is produced by two different worlds:

| | Session mode | Transaction mode, quiet system |
|---|---|---|
| Backend row present | yes | yes |
| `state` | `idle` | `idle` |
| `state_change` | frozen | frozen — **nobody else needed it** |

With **zero competing traffic**, these are indistinguishable. Run 1 had exactly one client at
a time, so it could only ever see the shared half of that table and never the half that
separates them. Watching it for longer does not help; three minutes of a non-discriminating
observation is still non-discriminating. **Duration was mistaken for strength.**

What broke the tie in run 2 was **a second concurrent client** — and, candidly, it arrived by
sequencing rather than by design: the control was run while the idle holder happened to still
be open. That overlap is the entire experiment.

**The control's `SESSION MODE` verdict was never independent evidence.** It reproduced on both
runs because it *cannot* distinguish these cases — its own docblock says so: *"a transaction
pooler that reused one backend and never reset it would look identical."* Supavisor does not
reset session GUCs on check-in, and against a quiet pool it hands the same warm backend back
to a single sequential client. Both signals the script checks — backend rotation and SET
persistence — therefore read session-shaped while the pooler multiplexes correctly.

⇒ **Two agreeing observations were counted as corroboration when they shared one blind spot.**
Agreement between instruments means nothing if the instruments fail the same way.

---

## ⊘ SUPERSEDED — the intermediate conclusion, preserved verbatim in substance

*Recorded 2026-08-24, superseded the same session by run 2. Kept because the reasoning is the
lesson, not the verdict.*

> **CRITERION 6 IS RED**, confirmed by two independent methods — the client-side control and
> the DASH-side idle-connection observation. This is **NOT a script defect and NOT a sampling
> artifact**; the control's own caveat was the live alternative hypothesis and the DASH test
> resolved it. **ROOT CAUSE UNCONFIRMED** — most likely the Supabase project's pooler
> configuration (Shared vs Dedicated, transaction mode not enabled on `:6543`); **not** the
> connection string, whose host, port and reachability are verified correct. **STATUS:
> BLOCKED**, pending a dashboard-side pooler configuration check by the operator.

**Why it is wrong, in one line:** the DASH test was described as resolving the ambiguity and
did not — it had the same blind spot as the control, so "two independent methods" was one
method counted twice. The vendor-side hypothesis it pointed at is **not supported**.

---

## Decisions made

- **CRITERION 6 IS GREEN**, on the cross-connection multiplexing evidence of run 2.
- **The shipped control returns a FALSE NEGATIVE against this pooler.** It is not to be read as
  criterion 6's verdict here.
- **The vendor-side hypothesis is withdrawn.** Nothing indicates a Supabase pooler
  misconfiguration; `:6543` behaves as a transaction pooler.
- **`SAMPLES` in the control is strictly SEQUENTIAL** (`await` inside the loop,
  `scripts/verify-pooler-mode.ts:207-224`; postgres-js reuses the one open connection,
  `node_modules/postgres/src/index.js:330-341`). Raising it creates **no** pool contention, so
  the script's own closing advice — *"Raise SAMPLES before concluding"* — **cannot** resolve
  the ambiguity it warns about. Only a **second concurrent client connection** discriminates.
- **A staging redeploy was requested mid-session and refused as out-of-sequence.** Staging
  deploys `25fc31e`, whose `src/db/index.ts:8` reads `DATABASE_URL` unconditionally, so it
  cannot read the flag; the redeploy would have rebuilt the same code and returned `:5432`,
  recording a predicted negative as though it were a measurement. The next ratified step was
  and remains **(b), the preview** — staging's redeploy is step **(g)**.

---

## Remaining uncertainty — stated, not minimised

**This assumes Supavisor session mode would not release an idle client's server connection.**
If it does, the cross-connection sharing observed in run 2 would be explicable under session
mode as well, and the reversal would not hold. That is considered unlikely — it contradicts
session-mode semantics, under which a server connection is bound to the client session for its
lifetime — **but it is the one alternative this evidence does not exclude.**

No stronger claim is made here than the evidence carries: what is established is that **one
backend served two concurrently-open client connections**. Everything else in this section is
inference from that fact.

---

## Part 2 — the preview arrives, and criterion 2's preview half

*Everything below happened after commit `6ece90b` and is the second half of this session.*

### The preview was being SKIPPED, not failing

Deployments of this branch were cancelled by Vercel's **Ignored Build Step**, whose command
skips every ref that is not `main` / `staging` / `verify`. **This is OQ-1 of
`docs/logs/O1-DECK-R2.md:68-77` arriving in practice** — that log measured
`[ "$VERCEL_GIT_COMMIT_REF" != "main" ] && [ … != "staging" ]` and flagged that **O-10's stated
mechanism does not match this project's configuration**, left as "founder to rule." It is the
same finding, one clause wider.

⚠ **The setting is DASHBOARD-side, not in the repo.** `vercel.json` carries `regions` + `crons`
and **no `ignoreCommand`**. It cannot be read or changed from a session — `vercel` CLI absent,
`gh` absent, and **no `VERCEL_*` key in Doppler `stg` or `prd`** (both checked).

The exit-code convention is inverted and is the whole mechanism: **exit 0 ⇒ SKIP, non-zero ⇒
BUILD.** An `&&` chain of `!=` tests exits non-zero exactly when the ref *is* one of the named
branches. A minimal fix appends one clause; verified locally across all five refs. ⚠ **A
branch-specific allowance outlives its branch — delete it at merge, or it becomes a permanent
exception nobody can date.**

### The preview, once building

`https://experiment-e75od9xcz-zugzwang-worlds-projects.vercel.app` —
`env: staging` · `canary: 6ece90b` · `region: bom1` · `db: ok` · `migrations: ok`.

`canary` confirms the flag-reading code, and `env: staging` confirms the Doppler `stg` sync, so
this **is** a post-F-1b build. ⚠ **`migrations: "ok"`, as the Gate C revision predicted** — the
earlier `"error"` prediction had already been inverted in the plan.

### Criterion 2, preview half — 15 concurrent requests

Method: 15 concurrent `GET /api/health` (2 SELECTs each, no writes, no auth, no rate-limiter —
`proxy.ts:42` matches `/admin/:path*` only), while `pg_stat_activity` was sampled every 1.5 s
for 75 s **through `:5432`**, the runner refusing to start if `DATABASE_URL` contained `:6543`.

**Result: 15/15 HTTP 200, all `db:ok`, starts within a 110 ms window — and only TWO backends.**

| PID | backend_start | distinct `query_start` |
|---|---|---|
| `3935767` | 21:38:02 (pre-existing) | 3 |
| `3936705` | **21:46:48.697 — born mid-burst** | 2 |

Max backends in any single sample: **2**. Distinct `x-vercel-id` request tokens: **14**.

⇒ **Real multiplexing, and the Fluid warm-connection artifact is excluded.** A suspended-instance
artifact cannot produce a backend that is *created during the burst* and then serves multiple
statements alongside a second one. **The finding survives the most hostile reading**: even if all
15 requests hit ONE instance, that pool is `max: 4` (`src/db/index.ts:83`), so session mode
predicts ~4 backends against 2 observed; if the 14 tokens are distinct instances, session mode
predicts ≥14 against 2.

⚠ **BUT IT IS NOT CONCLUSIVE FOR CRITERION 2**, and the gap is structural, not a matter of more
samples. Against §4's four properties (`docs/plans/S-1.md:355-372`): property 1 ✅; property 2
⚠ satisfied as a loop but sized against *"one bet is 16–19 statements"* while `/api/health` is
two, the bet path being deliberately excluded; **property 3 ❌ ABSENT ENTIRELY** — the temporal
A/B (*Sample A staging on `:5432`, Sample B staging on `:6543`, same host, same SHA*) does not
exist, and this is the preview, not staging. Per `:524` every criterion is observed **twice**;
this is one half of one.

⚠ **One inference remains unobserved:** nothing here directly proves the preview reaches
`:6543`. `/api/health` has no pooler field. The chain is `canary` + `env: staging` ⇒
`DATABASE_URL_TXN`; the 2-backends-for-15-requests reading is *self-consistent* with it and
inconsistent with `:5432` session mode — **corroboration, not observation.**

### Criteria 3a / 3b — discharged from F-2, no new observation needed

- **3a** (`:533`, client ceiling risen 15 → 200): §8 `:662` states **200 "is the number
  criterion 3a records"**, and F-2 confirmed it live. ⚠ **The number is discharged; the VERB is
  not.** *"Has risen"* is a claim about which ceiling a runtime is subject to, which depends on
  the deployment reaching `:6543` — **3a's verb inherits criterion 2.**
- **3b** (`:534`, backend Pool Size confirmed unchanged): §8 `:661` maps F-2's **15** straight
  onto it. **15 is the BACKEND (server-side) pool size, not a client limit, and it does not
  move** — the two ceilings decouple under transaction mode (`:639-640`). The post-flip re-read
  is confirmatory, since the application cannot alter a Supabase-side setting; the criterion's
  real demand is its own note — *positively record the non-change rather than omit it.*

### ⚠ Two measurement traps, both of which produced wrong-looking data first

1. **DB clock ≈ local clock + 3.3 s.** Burst timestamps are the local Windows clock; poller
   timestamps are the DB clock. Read naively, the burst's activity appeared to be **missing** —
   backends showed a stale `query_start` through the burst window and only "woke" 2 s after it
   ended. Translating the burst into DB time lands it exactly on both backends' fresh
   `query_start` values. **Never correlate `pg_stat_activity` against a local timestamp without
   establishing the offset first**; the failure mode is a burst that looks like it never hit the
   database.
2. **Three defects in the analysis script, authored here, all caught after the fact.**
   (a) `tee /dev/stderr` interleaved stderr into stdout and mangled the first metric's display.
   (b) That metric split `x-vercel-id` on `::` and took the whole third segment — which embeds a
   per-request timestamp and hash, so it counted **requests, not instances** (returning 16 for 15
   requests, the trailing marker line included). The defensible proxy is the **first token**: 14.
   (c) `'\s+'` inside a JS template literal collapses to `'s+'`, so `regexp_replace` blanked the
   `s` characters out of the captured query text. Cosmetic — no analysis column depends on it.
   **None of the three changes the verdict**, and all three are recorded because a metric that
   silently counts the wrong thing is exactly what this session already got burned by once.

---

## Open questions

- **⛔ THE IGNORED BUILD STEP NEEDS A RULING, AND IT IS OQ-1.** Preview builds for this branch
  are skipped by a dashboard-side command. A per-branch allowance unblocks step (b) but leaves a
  dated exception behind; the alternative is resolving OQ-1 properly (`O1-DECK-R2.md:68-77`),
  where O-10's stated mechanism was already found not to match this configuration. **Same
  question, twice, from two directions — worth settling once rather than patching twice.**
- **⚠ S-5 INHERITS THE FALSE NEGATIVE.** `verify-pooler-mode.ts` names S-5 as its downstream
  caller and is to be run **before load run #1** — i.e. against a quiet system, which is
  exactly the condition that produces the false SESSION verdict. Whether the control should
  gain a concurrent second connection is a real question and **is not S-1's to answer**;
  raised here so it is not rediscovered under load.
- **Criterion 1's instrument is weaker than the criteria table implies.** `/api/health` returns
  `status, env, canary, region, db, migrations` and **no pooler or port field** — by a declared
  hard constraint in its own docblock. From outside, `db:"ok"` is a liveness proof plus an
  inference from the flag; it cannot distinguish `:6543` from `:5432`.
- **Unruled recommendation carried forward:** move the step-(d) unset to just **before** the
  merge rather than after. Nothing depends on the flag being set during the merge, and it would
  close the window in which every other lane's preview inherits transaction mode. Raised twice,
  not yet ruled.
- **Not S-1's:** prod `/api/health` reports `"migrations":"drift"` (`env:prod`, canary
  `a1005b6`, region `bom1`).

---

## Next session starts at

**Finish step (b) — criterion 4 is what is left on the preview.** Both earlier prerequisites are
discharged: the preview exists and is a post-F-1b build.

Preview-half status: **1** ✅ (liveness + inference; no pooler field exists to observe) ·
**2** ⚠ strong but not conclusive, property 3 absent · **3a** ✅ number, verb inherits 2 ·
**3b** ✅ · **4** ❌ **not attempted — the bet path, deliberately untouched all session** ·
**5** inference by composition · **6** ✅.

⇒ **The exact next action is criterion 4** — *"Bet path works under `SERIALIZABLE`"* (`:535`),
the money path, DASH-observed. It is the one criterion nothing here has approached, and the
one whose halt condition is absolute (*"A bet after the flip fails, retries out, or produces no
receipt — **money path, full stop**"*).

Then step (c): cascade (`@test-writer` → `@code-reviewer` → `@security-auditor`) → PR → Gate C
→ merge. ⚠ **Criterion 2 cannot be closed on the preview at all** — property 3's Sample A/B is
staging-only by construction, so it stays open until steps (f) and (h).

---

## Context to preserve

- **⚠ `DB_POOLER_MODE=transaction` IS STILL SET IN DOPPLER `stg` AT SESSION CLOSE.** It is inert
  only because `main` and `staging` carry no flag-reading code. ⛔ **If anyone advances `main` →
  `staging` while it is set, the advance IS the flip** (§3.1) — staging jumps to `:6543` at the
  same instant the code lands, **Sample A becomes unobtainable**, and the A/B collapses back to
  *SHA + mode*. Step (d)'s unset is what prevents that. Nothing goes red when this happens; the
  only casualty is a measurement nobody can take any more.
- **⛔ AN IDLE-CONNECTION OBSERVATION NEEDS A SECOND CONCURRENT CLIENT, OR IT PROVES NOTHING.**
  The single most expensive lesson of this session. One client at a time cannot separate a
  pinned backend from an unused pooled one, however long you watch. **Open two, and check
  whether one backend serves both.**
- **The shipped pool must NOT be used for an idle-hold test.** `src/db/index.ts:120` sets
  `idle_timeout: 20`, so a held connection would drop after ~20 s and manufacture the
  "no persisting backend" reading such a test exists to measure. The diagnostics used a separate
  client with `idle_timeout: null` / `max_lifetime: null` for exactly this reason. **An
  instrument that produces its own result is not an instrument.**
- **`application_name` is overwritten by Supavisor.** A client-set `application_name` does not
  survive to the backend — it reads back as `Supavisor`. Correlate a backend by **pid**, not by
  label. (Confirms the connection traverses Supavisor; distinguishes nothing about mode, since
  Supavisor labels its server connections that way in both.)
- **Windows cleanup / tooling note.** The idle-hold holder's **graceful `SIGTERM` path did not
  execute** — the Windows/MSYS process model did not deliver the signal. MSYS `kill` operates in
  its own PID namespace and never saw the native Windows PID (`kill: (3836) - No such process`);
  `taskkill` without `/F` was refused, and `/F` is `TerminateProcess`, which runs no handler by
  design. The holder was therefore **terminated** and the socket closed with it. **The close was
  nonetheless clean and left no residue**, and that is structural rather than lucky: the holder
  issued exactly one statement (`SELECT pg_backend_pid()`), never executed a `SET`, opened no
  explicit transaction, took no locks, touched no table and wrote nothing — so there was nothing
  to unwind. Contrast `verify-pooler-mode.ts`, which *does* set a session GUC and therefore
  carries its own `resetSentinel` cleanup (it reported `sentinel reset on all 1 backend(s)` on
  both runs). ⇒ **On Windows, do not rely on a signal handler for cleanup in an operational
  probe** — make the probe leave nothing that needs cleaning up.
- Worktrees: `C:/Users/anupa/zugzwang/s1/experiment` (this session, `fix/pool-transaction-mode`
  @ `b98efe3`) and `C:/Users/anupa/zugzwang/experiment-b` (same branch/SHA, carries
  `node_modules` — the scripts were run from there).
- **No writes of any kind reached staging data.** No bet placed, no staging rows created,
  Doppler unmodified by CC, no deployment triggered, no application code edited, and
  `scripts/verify-pooler-mode.ts` was run **unmodified** on both runs (`git status` clean). The
  preview burst hit `/api/health` only — two SELECTs per request, no writes, no transaction —
  and every `pg_stat_activity` sample was a read through `:5432`.

---

## Time

Session ran 2026-08-24 IST (≈ 2026-08-23 19:40–21:50 UTC). Ground `a1005b6` / `b98efe3`.
Criterion 6 run 1 ≈ 20:10-20:20 UTC; run 2 ≈ 20:46-20:54 UTC; preview burst ≈ 21:46-21:48 UTC
(local clock; DB clock ≈ +3.3 s). Zero application-code commits; this log is the only artifact,
committed twice — `6ece90b` (Part 1) and this commit (Part 2).
