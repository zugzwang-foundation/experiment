# ADR-0038 — Scale target: 100,000 signups and 2,000,000 page loads

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-08-19 |
| **Supersedes** | — (scopes ADR-0006 §Cost and §Sizing; see below) |
| **Superseded-by** | — |
| **Patch records** | — |

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
