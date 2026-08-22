# ADR-0038 — Scale target: 100,000 signups and 2,000,000 page loads

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-08-19 |
| **Supersedes** | — (scopes ADR-0006 §Cost and §Sizing; see below) |
| **Superseded-by** | — |
| **Patch records** | P1 |

## Patch record

### P1 — Transaction pooler migration implementation detail (S-1, 2026-08-21)

In-place Patch record per CLAUDE.md §5.12 (consumer-surface scoping, **not** supersession).
**Decision 3 is unchanged** — *"Transaction mode (`:6543`) with `prepare: false`"* stays
authorised without further ADR, and nothing here widens it. This record exists because the
sentence authorising the flip does not say **how the runtime reaches `:6543`**, and hanging
off that gap are a rollback shape, a Gate C shape, and a `max` question. Those are
implementation detail, which is what a patch record is for.

⚠ **Why a patch record and not ADR-0039.** `0039` is **doubly allocated** — LOTS-1 holds it
on `origin/staging` (accepted 2026-08-21, same date, founder-decided) while HO-S1 §1 declared
it an S-1 output. The prescribed `ls docs/adr/` check reads **one ref** and structurally
cannot see the other. A patch record needs no number and therefore cannot collide, and
decision 3 already carries the authorisation a new ADR would have restated. *(The cross-ref
allocation check S-1 wrote — union `git ls-tree` over `+refs/heads/*` **and**
`+refs/pull/*/head` — scanned 427 refs and, **when it ran on 2026-08-21**, found `0040`
free. **It no longer is: ADR-0040 (UNWIRE-1, #395) landed on `main` 2026-08-22 and the next
free number is `0041`** — re-measured against `origin/main` at Gate C. S-1 mints no ADR, so
this corrects no action; it is corrected because a false statement inside an accepted record
is a trap for whoever reads it next. **And it is the detector's own thesis proving itself:**
a number is claimed by a **commit to `main`**, never by a scan and never by an announcement
— so a scan result is true at an instant and decays from it. Which is why the sentence now
carries the date it was taken.)*

#### P1.1 · The route — the app reads a new secret; the old one is not repointed

Two routes reach the same flip. **Chosen: `src/db/index.ts` reads `DATABASE_URL_TXN`**,
minted by the founder in Doppler `stg` at `:6543` (gate F-1). **Rejected: repointing
`DATABASE_URL` in place.**

| | Repoint `DATABASE_URL` | Read `DATABASE_URL_TXN` *(chosen)* |
|---|---|---|
| **Blast radius** | Doppler `stg` syncs to **two** Vercel environments — Staging (custom env) and Preview — and the sync has **no per-secret include/exclude filter** (ADR-0024 D1 errata 1–2). A repoint reaches the staging runtime **and every open preview**, **unscopably**. | The same secret store, but the value that moves is one nothing else reads yet. |
| **Rollback** | A dashboard edit. **Not `git revert`-able**, and invisible in the repository. | `git revert` — plus a redeploy; see below. |
| **Gate C visibility** | The diff shows **no evidence the flip happened.** A reviewer reads a PR that changed nothing, and cannot review the change. | The diff **is** the change. Gate C reads the plan's statement of intent against a diff that carries it. |

⚠ **The comparison is narrower than it first looked, and the narrowing is recorded because
it cuts against the choice.** A Doppler `stg` change does not reach the running deployment
until staging is redeployed — `docs/runbooks/staging-provisioning.md:122`, *"treat
auto-redeploy as not firing."* That applies **symmetrically to the revert**. So the env
route's escape hatch is a dashboard edit **plus a deployment**, and the code route's
`git revert` is no longer meaningfully slower. Blast radius and Gate C visibility are what
decide it; speed does not.

⚠ **The rollback contains a redeploy.** It is documented today only in a provisioning
runbook nobody has reason to open mid-incident, which is why it is written into a decision
record here. Under option (e), exit criterion 7 therefore means **two redeployments of a
shared staging environment** that two other lanes are measuring against — the scheduling
window must cover both, not just the flip.

#### P1.2 · `max` stays at 4 — and the client ceiling rising is not a reason to raise it

`src/db/index.ts` sets `max: 4` per Vercel instance. **It does not change.**

⚠ **The relaxation argument is real, and is stated here so it is not re-derived later as
though it were new.** Transaction mode **does** decouple the two ceilings:

| | Session `:5432` | Transaction `:6543` |
|---|---|---|
| **Client** connections — app sockets into Supavisor | Pool Size, **15** | the tier's Max Client Connections, **200** |
| **Backend** connections — Supavisor → Postgres | Pool Size, **15** | Pool Size, **still 15** |

The `15 ÷ 4` arithmetic in the comment above `max` is therefore stale **as a derivation** —
it computes an instance count against the one ceiling the flip moves.

**It is stale, and `max` still does not move, for two independent reasons:**

1. **`max` bounds what a *suspended* instance can strand, not what a running one can use.**
   The 2026-08-16 incident was a connection held **idle for 620 s** with a 20 s
   `idle_timeout` **and** a 600 s `max_lifetime` both configured and verified live, because
   Vercel Fluid suspends an instance between requests and a suspended instance runs no
   timers. Raising `max` because the *client* ceiling rose recreates that incident with more
   sockets. The file's own docblock already carries this — *"`max` above is the guarantee"* —
   and **that** is the surviving derivation, not the arithmetic sitting above it.
2. **Decision 2 of this ADR forbids acting on the relaxation without a measurement.**
   *"Sizing is decided from measurement, never from estimate."* The relaxation establishes
   that a higher `max` is now **permissible**; it says nothing about which value is
   **correct**, and no load run has produced one. ⇒ `max` stays at 4 until S-5 measures it.

⇒ At execute, the `15 ÷ 4` sentence is replaced by a stranding-risk derivation; **the value
is not touched.** A stale comment is how the next reader re-derives the wrong number.

#### P1.3 · Verified pre-existing conditions — what the flip rides on

Re-confirmed a **third** time at `7832f5a`, independently of POOL-1 §7 and RECON-2 §4a:

| Condition | State | Site |
|---|---|---|
| Server-side prepared statements | **Disabled globally** — the precondition for transaction mode is already met | the `prepare: false` property on the `postgres(...)` options object, `src/db/index.ts` |
| `LISTEN` / `NOTIFY` / `pg_notify` | **Not found** in `src/**` | — |
| Advisory locks | **Not found** in `src/**` | — |
| Cursors | **Not found** in `src/**` | — |
| Session-level `SET` (non-`LOCAL`) | **Not found** — all three sites are `SET LOCAL`, which is transaction-scoped and resets at `COMMIT`/`ROLLBACK`, so nothing leaks across the pooler's connection reuse | `applyTxTimeouts` in `src/server/{bets,markets,resolution}/transaction.ts` *(evidence: `bets:177,181` · `markets:165,169` · `resolution:191,195`)* |
| **Transaction pinning on the money path** | One `{ isolationLevel: "serializable" }` transaction wraps the whole 16–19-statement bet sequence, with the pool row locked `FOR NO KEY UPDATE` for its life | `runBetTransaction` → `lockPool`, `src/server/bets/transaction.ts` |

⚠ **The pinning row was absent from this record's first draft, and it is the one that
matters.** ADR-0029's ledger total-order contract and INV-1's atomicity survive transaction
mode **only because a transaction-mode pooler pins one backend connection for a
transaction's life.** HO-0 §3 non-negotiable III states it as a halt: if anything in the
approach would let one logical transaction span two pooled connections, stop. That property
is precisely what exit criterion 4 demonstrates — which is why criterion 4 is not
discharged by a note.

⚠ **Fenced by symbol, not by line (CLAUDE.md §8, O-8).** The fences are the **named
property** `prepare: false`, the function **`applyTxTimeouts`**, and the functions
**`runBetTransaction`** / **`lockPool`**. The line numbers above are evidence that a reading
happened; they are not the fence, and they are expected to drift.

#### P1.4 · What this record does not decide

**Production.** Decision 3 authorises the mode; **staging only** is S-1's scope, and all
production work is after 10 Sep by founder ruling. `prd` stays on `:5432` and is untouched
(see ADR-0024 Patch P3, same commit).

**Pool Size.** Stays **15**. Changing it is decision 2's measurement gate, not this record's
(watch item W-11).

**`f_db`.** The fraction of a render during which a backend connection is actually held —
the denominator the entire ceiling estimate rests on — **is not observable from S-1.**
Nothing in HO-S1 §1's declared file set instruments hold time, and no deployed surface
exposes per-statement timing: `/api/health` does real DB work through the shipped pool but
returns a boolean, opens no transaction, and reads back no GUC, by a hard constraint in its
own docblock. **S-5 must measure it. Watch item W-9 does not close without it.**

⚠ **And after the flip, saturation stops being loud.** Session mode fails with
`EMAXCONNSESSION` and a rendered error boundary. Transaction mode **queues** for a free
backend, so the same overload presents as **latency, not error** — a load run can report
"zero errors" against a fully saturated pool. The rig must instrument **queue depth and
backend utilisation**, not error rate (watch item W-10). This is a finding S-1 owes S-5.

## Context

ADR-0006 sized this stack against a **≤5k concurrent** target with a **$300/mo default and
$500/mo upgrade** cost ceiling, and states at §Consequences that *"the $500/mo ceiling is the
architectural ceiling for this ADR; crossing it requires a new ADR."*

The experiment's target is now **100,000 signups and 2,000,000 page loads** across the live
window, with **no cost ceiling** during the window. That is a change of premise ADR-0006
explicitly reserved to a new ADR rather than to a patch record.

⚠ **The two figures are not the same unit and this ADR does not pretend otherwise.**
`≤5k concurrent` is instantaneous; signups and page loads are cumulative over ~52 days.
2,000,000 loads averages ~0.45/sec, and even a large peak factor stays under 5,000 concurrent.
**What changed is not the concurrency estimate — it is that four sizing decisions in ADR-0006
used `≤5k concurrent` as their justification, and those sizings are load-proportional in a way
a concurrency figure does not capture.** This ADR reopens the sizings, not the concurrency
arithmetic.

## Decision

**1 · The cost ceiling is lifted for the live window.** ADR-0006's `$300/mo default` and
`$500/mo upgrade` tiers no longer bind. Spend is founder-authorised per vendor, per decision,
with no aggregate architectural cap through 2026-11-05. ⚠ **The ceiling returns at archive:
nothing in this ADR authorises spend past 2026-11-08.**

**2 · Sizing is decided from measurement, never from estimate.** No compute tier, pooler mode,
replica or vendor plan is bought before a load run has produced a number for it.
⚠ **This is the discipline PERF-1 taught: a ratified decision that was never implemented is
invisible to every control that watches for change.** Buying capacity before measuring is the
same failure with the sign reversed — it hides the defect instead of exposing it.

**3 · The following are authorised without further ADR**, because each is reversible in one
dashboard action and none changes an architectural property:

| | Authorised |
|---|---|
| Supabase compute | Any tier through **Large** (dedicated CPU). ⚠ **XL requires a measured number from a load run, not a projection** |
| Supabase pooler | **Transaction mode (`:6543`)** with `prepare: false`, which POOL-1 already audited VIABLE |
| Upstash | **Pro / dedicated instance** |
| Resend | **Scale tier + dedicated IP**, and a support ticket for a send-rate increase |
| Sentry · PostHog | Quota headroom sized for 2,000,000 page loads |
| PITR | 14-day retention |

**4 · The following still require a decision record, and are NOT authorised here:**
a **read replica** (an architectural change to the failure-mode profile, and probably
unnecessary once the cache lands) · **any change to the single-region posture** ·
**any moderation-pipeline change of any kind**.

**5 · Region is unchanged.** `bom1` / `ap-south-1`, as ADR-0006 ratified and PERF-1 finally
applied. ⚠ **Production still reports `region: None`** — the same defect PERF-1 fixed on
staging, live on production, and it is a promote-window item.

**6 · Throughput budgets do not exist in this repository and this ADR does not invent them.**
A repo-wide sweep at SYNC-3 found **no `req/s` figure anywhere** in `docs/` or `src/`. The
load runs produce the first ones. Until then, no document should state a throughput number,
including this one.

## Consequences

**What this changes.** ADR-0006's §Cost tiers and its Supabase / Upstash / Vercel sizing cells
are superseded for the live window. Its **region**, **failure-mode profile**, **single-service
topology** and **Vercel-Cron-only-for-HTTP-fanout discipline** are untouched and remain
immutable per ADR-0006's own closing constraint.

**What it does not change.** No invariant. No moderation behaviour. No schema. This ADR buys
capacity and authorises spend; it changes nothing about what the product is.

**Two live capacity mechanisms this ADR names so they are not discovered late:**

⚠ **The visits counter issues one Upstash `INCR` per real page load** (`src/server/visitors/
counter.ts`), plus a `GET` per render. At 2,000,000 loads that is **≥2,000,000 commands from
this counter alone**, against a plan whose ADR-0006 sizing cell cites `≤5k concurrent` as its
basis. Sized under decision 3, measured at the load runs.

⚠ **The GitHub star count is an unauthenticated third-party GET on the shell of every public
and auth page** (`src/server/github/star-count.ts`). Cached at 900 s it is 4 fetches/hour
against a **60/hour per-IP** budget; **a serverless region shares its IP across every
instance**, so if the Data Cache ever fails to hold, the budget burns within minutes and the
header renders with no count **permanently, with nothing going red**. The file's own docblock
documents this. **The new target does not falsify the control — it raises the cost of the
cache failing.** No change is authorised here; it is named so a load run watches it.

## Spec impact

⚠ **`SPEC.2` §22 does NOT yet carry a row for this ADR, and that is deliberate.**
`N5` in `docs/parked.md` owns the §22 index and states the fix is a normative
§22.1/§22.5 edit — adding one row without rebuilding the counts around it makes
the index worse, not better. **ADR-0038 is therefore the FOURTH ADR in that
backlog**, after 0035, 0036 and 0037. No `SPEC.1` change.
