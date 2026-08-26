# S-4 Phase E — Warm-path characterisation

**For:** S-5 (load rig sizing) and S-8 (compute tier / remote cache ruling)
**Measured:** 2026-08-24, post-Phase-D, against the live staging database

> ⚠ **Read the measurement conditions before using these numbers.** Timings were taken from a
> developer laptop over the public internet to `ap-south-1` — **not** from a `bom1` function.
> Each statement here costs ~40–80 ms; co-located, PERF-1 measured the same round trip at
> **5.34 ms**. So treat every millisecond figure as **~10–15× inflated** and use the
> **statement counts** as the load-bearing quantity. The counts are exact; the timings are
> directional.

---

## 1 · The question this answers

> What does the 2nd, 100th, 1000th concurrent viewer of one market cost?

### The short answer

| Viewer | Anonymous | Signed in |
|---|---|---|
| **1st** (cold — cache miss) | **14 statements** | 22 |
| **2nd → Nth** (warm — cache hit) | **2 statements** | 10 |

A cache hit removes **12 statements** — the entire viewer-independent block. What survives is
irreducible: one slug resolve, one **live** pool read (which must stay live, or the price bar
misquotes what a bet will execute at), and for a signed-in viewer their own context.

### The answer that actually governs capacity

**"The 100th viewer" is the wrong unit, because the cache is per-instance and in-memory.**

`'use cache'` with no cache handler configured stores in the process's own memory. On Vercel
that means **each concurrently-running function instance keeps its own copy**, and each pays its
own cold miss. So the real shape is:

```
total statements ≈ (instances × 14) + ((viewers − instances) × 2)      [anonymous]
```

| Concurrent viewers | Instances serving | Statements (anon) | vs. no cache at all |
|---|---|---|---|
| 100 | 1 | 212 | 1,400 |
| 100 | 10 | 320 | 1,400 |
| 1,000 | 10 | 2,120 | 14,000 |
| 1,000 | 50 | 2,600 | 14,000 |

Two things follow, and they are the inputs S-8 needs:

1. **The win is large and it holds at scale** — roughly **6–7× fewer statements** across every
   row above, and it does not degrade as viewers grow.
2. **Instance count is the variable that erodes it**, not viewer count. At 10 instances the
   cold-miss overhead is 5% of total statements; at 50 it is 19%. **A shared/remote cache only
   starts paying when instance count is high enough for that overhead to matter** — which is
   precisely the measurement S-5's load run should produce, and precisely what the S-4 work
   pack's R5 defers to S-8 rather than deciding on opinion.

⚠ The cache is also **discarded on instance teardown and on every deploy**. A deploy during the
live window resets every instance to cold simultaneously.

---

## 2 · Measured breakdown

Statement counts are exact (traced and pinned in
`tests/server/debate-view/round-trip-budget.test.ts`). Timings are the inflated-network figures.

| Segment | Statements | Time | Cached? |
|---|---|---|---|
| `getMarketBySlug` | 1 | 39.0 ms | no — produces the id everything else needs |
| `getMarketPricingAndReserves` | 1 | 77.1 ms | **never** — R3, and it keys the cache |
| **Shared debate block** | **12** | — | **yes** — `getCachedDebateView` |
| Viewer context (no holding) | 5 | 392.0 ms | never — viewer-scoped |
| Layout header (balance/cursor/portfolio) | 3 | 157.7 ms | never — viewer-scoped |

**Anonymous warm tick: 2 statements / 116.1 ms. Signed-in warm tick: 10 statements / 665.8 ms.**

Against Phase A's baseline of **23–29 statements**, that is a **~2.5× reduction for signed-in**
and **~12× for anonymous** — and the anonymous case is the one that matters most, because the
front page and every market page are public and signed-out visitors are expected to dominate.

---

## 3 · The poll, specifically

`POLL_INTERVAL_MS_DEBATE_VIEW` is **unchanged at 15000** — the number is a founder call for the
~1 Sep tuning pass. What changed is the **mechanism's cost per tick**.

One open tab, signed in, market unchanged between ticks:

```
before S-4:  23–29 statements every 15 s
after  S-4:  10     statements every 15 s     (2 if signed out)
```

Because a tick is `router.refresh()`, it re-executes the **layout as well as the page**. That is
unchanged and, within this stratum's constraints, unchangeable — see §4.

**Per-tab steady-state load**, at the co-located 5.34 ms/statement figure:

| | statements/min/tab | est. DB time/min/tab |
|---|---|---|
| Signed-out tab | 8 | ~43 ms |
| Signed-in tab | 40 | ~214 ms |

---

## 4 · Two findings this phase could not fix

### 4.1 The tick still replays the layout — and cannot stop, here

The goal "the tick no longer replays the full layout waterfall" is **not reachable** under the
constraints this stratum operates within. The three ways to reach it are each closed:

- **A dedicated poll endpoint** that refreshes only the debate — forbidden. SPEC.2 §4.3's
  handler catalogue is closed at eleven, ADR-0034 keeps masking single-sourced, and
  `poll-contract.test.ts` pins the repo-wide `route.ts` inventory precisely so a twelfth cannot
  appear. A second read path is a second place for removal-masking to diverge.
- **`use cache: private`** for the per-viewer header figures — ruled off-limits by the work pack
  (an open upstream bug: it fails to cache across client navigation when reading `cookies()`).
- **Restructuring so the header does not re-render** — `DebateView` is a single 744-line
  `"use client"` component and the header lives in the shared layout; this is the same blocker
  Phase D reported against the Suspense split.

What *was* reduced: Phase D's session dedupe removed one of the two session lookups a tick used
to pay. The remaining layout cost is **3 statements**, all genuinely viewer-scoped.

### 4.2 `balance` and `cursor` are read TWICE per signed-in render

Visible in the §2 table as the same two logical reads appearing in both the layout and viewer
context:

- `src/server/dharma/header-balance.ts` — balance (`dharma_ledger`) then cursor (`users`)
- `src/server/debate-view/viewer-context.ts` — `readBalance(tx)` then cursor (`users`)

**2 duplicated statements per signed-in render, i.e. per tick.** Deduping them the way Phase D
deduped the session would take signed-in from 10 → 8 statements.

**Not done, deliberately.** It requires one of two unacceptable moves:

1. Editing `src/server/dharma/**` — a **CLAUDE.md §1 critical path** *and* outside S-4's fence.
   That is an H1 halt, not a judgement call.
2. Reaching across `viewer-context`'s `client.transaction(...)` boundary. Those reads are inside
   a transaction on purpose, and `header-balance.ts` documents its **BALANCE-FIRST /
   CURSOR-SECOND** statement order as a *correctness* constraint — reversing it turns a
   one-credit understatement into a `DAILY_CREDIT_DHARMA` overstatement, a header promising
   capacity the composer will reject.

⇒ **Recommended as its own scoped task**, with the dharma-path ritual, not absorbed here.

---

## 5 · What S-5 should measure

The counts above are exact; what they cannot tell you is **how many instances Vercel actually
runs** at a given concurrency, which is the one variable that governs whether S-8's remote-cache
question has a yes answer.

1. **Instance count under load** — the single most valuable number. Everything in §1's table
   pivots on it.
2. **Cold-miss rate in steady state** — with `cacheLife("minutes")` entries also expire on their
   own, not only on invalidation. The real miss rate is instance churn *plus* expiry.
3. **Re-run these counts from `bom1`**, not a laptop. The statement counts should be identical;
   the timings should fall ~10–15×. If they do not, something other than the read path is wrong.
4. **Signed-in vs. anonymous mix.** The two differ 5× in cost (10 vs 2). A load rig that models
   only one will size the tier wrong in whichever direction it chose.

## 6 · What S-8 needs to rule on

- **Remote / shared cache?** Only worth it once §5.1 shows instance count high enough that the
  per-instance cold-miss overhead exceeds the added network hop on every hit. At 10 instances
  that overhead is 5% — almost certainly not worth a hop on 95% of requests. The crossover is a
  measurement, not an opinion.
- ⚠ **Region check first.** Upstash's primary write region is **not determinable from the
  repo** (dashboard-only — Phase A T6). If it is not co-located with `bom1`, a remote cache adds
  a cross-region hop to every read — the exact failure PERF-1 just fixed (functions in Virginia,
  database in Mumbai, Discovery at 35 s). Confirm the region *before* costing the option.
