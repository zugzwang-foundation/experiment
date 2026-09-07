# ADR-0047 — Asymmetric market open and signup-pegged liquidity injection

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-09-06 |
| **Deciders** | Hrishikesh (founder) |
| **Tracker task** | Number-tuning (SPEC.1 Appendix B, STATE.md F-3) — liquidity subset. Working ID LIQ-1. |
| **Frame document** | Decision record D-14 (opening price); `SPEC.1` §10.1, §10.5, §10.6, §16.1; `docs/specs/cpmm.md` §3, §7, §8, §14; `SPEC.2` §19.4.1 |
| **Supersedes** | — (no ADR; the spec sections below are amended in the same commit) |
| **Superseded-by** | — |
| **Amends** | — |
| **Amended-by** | — |

**This ADR does not decide:** the opening price itself (D-14 stands at 10% YES) · the Dharma economy (grant 1,000, credit 10/day, floors) · bet throughput on a hot market (D-4, SCALE lane) · read-path polling cost (POLISH/SCALE) · the other 22 `TBD` constants in SPEC.1 Appendix B · a `p` curve-weight (rejected below; a testnet ADR if ever) · limit orders or user-provided liquidity (out of scope for the experiment by ruling).

**Evidence base:** `zz_LIQ-RECON_measure_2026-09-05T0731.md` (md5 `99b8b01c…`), `zz_LIQ-RECON-2_measure_2026-09-06T1314.md` (md5 `a1ce6c0f…`), `zz_LIQ-SIM-2_measure_2026-09-06T1444.md` (md5 `d7f8bc6e…`). Section references below are to those files. Nothing in this ADR is asserted from memory.

---

## Context and Problem Statement

A constant-product market has a depth fixed at seed. Participant money is not fixed: every signup adds 1,000 Đ of potential flow, and there is no top-up path — `cpmm.md` §7.4 says reserves change through exactly three doors (seed, buy, sell), and SPEC.1 §10.6 forbids mid-market liquidity adjustment. So the ratio that governs every fill, `flow ÷ depth`, climbs for the whole window, fastest when the experiment is going best.

**Measured.** With the seed fixed and no injector, a market opened at 10% closes its first hour at **0.787** if 5,000 people sign up in that hour and at **0.994** if 40,000 do (SIM-2 §3b). The closing price measures the crowd's size, not the question. That is not a market failure — the pool cannot go insolvent (`cpmm.md` §8.1) — it is an instrument failure: the price stops carrying information, and the dataset published in November inherits that.

**Second problem, same root.** D-14 rules all eight markets open at 10% YES. `openMarket` binds one scalar to both reserve columns (RECON-2 §3b), so the only way to reach 10% is operator-controlled participant accounts betting the price down from 50 — NO positions worth twice the seed per market, riding to resolution, ending the window rich, each carrying a mandatory argument the operator does not hold, all of it needing disclosure in the dataset.

**Why now.** The seed is written once, at `Draft → Open`, on 15 September, and reserves are immutable from then on. Both problems are pre-launch or never. The number-tuning pass (STATE.md F-3) that was to pin the seed has not run; there is no liquidity, seed or depth constant anywhere in `src/` (RECON §6d) — the seed is a per-call argument.

**What this ADR keeps.** `p = ½`. Exact 18-decimal arithmetic. The bet transaction, untouched. R-2: admin↔pool flows are events plus reserve deltas, never ledger rows. INV-1 through INV-4.

## Decision Drivers

1. **No forecasting.** The founder will not estimate turnout. The system must align itself to whatever arrives.
2. **Rate invariance.** Where a market's price lands must not depend on how many people showed up.
3. **Price neutrality.** No operation in this ADR may change the value of any participant's position by any amount.
4. **Bet transaction untouched.** The one production `pools` writer on the participant path (`place.ts`, step 7 of 8 under `SERIALIZABLE` behind `FOR NO KEY UPDATE`, RECON §2b) is not modified.
5. **R-2 and append-only.** New rows, never rewrites; no `dharma_ledger` row for any admin↔pool flow. `pool_seed` / `pool_unwind` stay dormant (RECON §3b).
6. **Exact reproducibility.** An auditor reproduces every fill from the dataset with multiplication and division. No fractional exponents.
7. **Auditable.** Every reserve change is an events row; every parameter change is a policy row; both ship in the dataset.
8. **No operator positions.** Opening at 10% must not create bets, positions, or arguments the operator holds.
9. **Ships before 15 September** with a staging soak, on the 8th–14th window.

## Considered Options

1. **Asymmetric open + signup-pegged proportional injection** ← chosen. Both built on one primitive.
2. **A larger fixed seed.** Guesses the number. Dead at low turnout, pinned at high; a forecast by another name. Rejected.
3. **Reintroduce upstream's `p` weight.** Rewrites every function in `src/server/cpmm/` around fractional powers, weakens the exact-arithmetic contract, needs a column on `pools`. Buys no discarded shares — worthless to a mint — and a differently shaped curve that measures equally lopsided at 10/90 (YES:NO impact 14:1 vs 12:1). Manifold itself runs fixed-`p` with discards for multi-choice (`addCpmmLiquidityFixedP`, RECON §8e). Rejected for the experiment; reasonable as a testnet ADR.
4. **Per-market target keyed on unique bettors.** `count(DISTINCT user_id) WHERE market_id = $1` is a full scan of `bets_user_market_idx` — O(total bets), flat buffers at 1 and 1,004 matching rows (RECON §4e) — with no `(market_id, user_id)` index. And it solves nothing: depth only bites where there is flow, so a uniform target sized for the hottest market is right on hot markets and free on cold ones. Rejected.
5. **Discretionary manual injection.** Makes the operator a discretionary actor inside the instrument. Not reproducible. Rejected.
6. **Limit orders / user liquidity.** Every benchmark has them and two of three have nothing else. Out of scope by ruling.

## Decision Outcome

**Chosen: Option 1.** Nine primitives, each load-bearing.

### A · The reserve-placement primitive

Given reserves `(L, S)` with `L ≥ S` and an amount `a`:

```
L' = L + a
S' = S + a · (S / L)
discarded on the S side = a · (1 − S / L)
```

Price `S' / (L' + S')` equals `S / (L + S)` exactly; both reserves scale by `(L + a) / L`. This is `addCpmmLiquidityFixedP` from `zugzwang-foundation/manifold-reference` @ `d5b55cf9`, `common/src/calculate-cpmm.ts:735–759`, measured price-preserving to 18 dp on symmetric, skewed, and 90:1 pools (RECON §8e; SIM-2 §0a, all 14 fires land `tank/target = 1.000000`). Lifted with attribution under the existing MIT obligation for `src/server/cpmm/`.

Two implementations, one definition: the TypeScript version in `src/server/cpmm/calculate.ts` is the specification and the test oracle; the SQL version inside the injector function is the runtime. A differential fuzz test pins them across ≥ 10,000 random reserve pairs.

### B · Asymmetric open

`openMarket` takes `openingPriceYes` and `tank` and writes `yes = (1 − p) · tank`, `no = p · tank`. For D-14: `90,000 / 10,000` at `tank = 100,000`. The `market.opened` payload carries `yesReserves`, `noReserves`, `openingPriceYes`, `backingMinted`, `discardedYes`, `discardedNo`. `seedPool` takes two values. The admin form takes opening price and tank. All five sites in RECON-2 §3c change; the DB needs nothing (§3c, no CHECK).

The curation slate no longer sets price. It seeds arguments only, with stakes too small to move anything.

### C · The target rule

```
target = max( FLOOR , COEFF × count(*) FROM users )
```

Uniform across every `Open` market. Circulation is 1,000 per user by construction (one `initial_grant`, ever, `I-GRANT-ONCE-001`); daily credit measured under 1% of it on staging (RECON §3c). Counting users is measuring circulation.

### D · The injector

One `pg_cron` job (1.6.4 on both environments, ADR-0006, registration pattern `0011`, amendment pattern `0015` — RECON-2 §8), every 60 s, per `Open` market, in this order:

```
 1. exit if system_state.frozen_at is set
 2. read the newest liquidity_policy row; exit if not enabled
 3. skip if within ENDGAME_HOURS of the market's deadline
 4. tank = yes + no ; skip if tank ≥ TRIGGER × target
 5. price = no / tank ; skip if price > GUARD_HIGH or price < GUARD_LOW
 6. SET LOCAL lock_timeout = LOCK_TIMEOUT_MS ; lock the pools row
    (markets → pools, the canonical order) ; skip on timeout
 7. a = L × (target / tank − 1) ; apply A
 8. insert pool.liquidity_added
 9. insert heartbeat
```

**A `FUNCTION`, invoked with `SELECT` from `cron.schedule()`** — the `0007`/`0011`
registration pattern, so the whole sweep is one transaction and the body carries no
`COMMIT`. Each market runs inside its own `BEGIN … EXCEPTION … END` subtransaction:
`lock_not_available` is a skip (a bet holds the row; the trigger is still true and the
next tick is 60 s away, so a skipped market self-heals), and `WHEN OTHERS` records the
`SQLSTATE` to `cron_alarms` and moves on, so one bad market cannot cost the sweep.
`SET LOCAL lock_timeout` is issued **once at the top** — there is no `COMMIT` to reset
it, and a rolled-back subtransaction does not clear it either (both measured against
PostgreSQL 17.6 at execute). The overlap guard is `pg_try_advisory_xact_lock`, which
releases on error as well as on commit, so a hand-run that throws — the recovery path
the Runbook itself prescribes — cannot wedge the scheduled job.

**No velocity guard.** Measured anti-correlated with the trigger: the fast minute that drains the tank is the minute the guard forbids refilling it; at 40,000 signups/hour it suppressed seven of eight injections (RECON-2 §10.6).

**Frequency, measured.** At 10,000 signups/hour: fires at minutes 2, 3, 4, 5, 7, 9, 12, 15, 19, 24, 30, 37, 46, 57 — fourteen in the hour, gaps growing 2 → 11 minutes, self-quieting (SIM-2 §2b). Each is one UPDATE; a colliding bet retries on the existing three-attempt budget.

### E · The backing identity

Every Đ deposited mints one pair. Each share is in a position, in the pool, or discarded. Per side:

```
Y + H_yes + D_yes  ==  N + H_no + D_no  ==  total Đ deposited
```

`D` is cumulative discards per side, summed from `market.opened` and every `pool.liquidity_added` for the market. Today `D = 0` on both sides, which is why the code omits it — and why `voidMarket` throws on any asymmetric seed (`void.ts:189`, its own comment says so) and `settleMarket` under-reports the residual on NO outcomes by exactly `D_no` (RECON-2 §1).

- `void.ts` — cross-assert with `D`; cash = `Y + H_yes + D_yes`.
- `settle.ts` — residual = winning reserve + `D` on the winning side.
- Conservation callers (five sites, all tests and gates, zero production — RECON-2 §5c) — net admin injection = seed backing + Σ injection backing − unwind.

One function computes `(D_yes, D_no)` for a market; the three call sites consume it. Storage is **sum from events** — no migration on `pools`, at most ~30 rows per market, and the events are the audit trail regardless. Plan-mode may propose columns on `pools` only with a measured reason (a query cost inside `settle`/`void` under the pool lock); absent one, events.

### F · The event

`pool.liquidity_added`, aggregate `market`. Payload:

```
marketId · policyVersion · target · tankBefore · tankAfter
reservesBefore {yes, no} · reservesAfter {yes, no}
backingMinted · discardedSide · discardedShares
priceYesBefore · priceYesAfter
```

`event_type` is `text` with no CHECK — no migration (RECON-2 §5c). `EVENT_TYPES` gains one member; three `.toBe(24)` pins become 25 (RECON-2 §9d). **The dataset export throws on an undeclared type by design** (`strip.ts:299`, RECON-2 §7): a SPEC.2 §19.4.1 SHIP declaration and a `PAYLOAD_SHIP_KEYS` entry land in the same commit, or PR #435's build fails at CI. The extended `market.opened` payload's §19.4.1 SHIP row lands in Phase 1; PR #435 conforms on rebase.

### G · The policy table

`liquidity_policy`, append-only, one row per version, newest `effective_from ≤ now()` wins:

| column | initial |
|---|---|
| `coefficient` | 500 |
| `floor` | 100000 |
| `trigger_ratio` | 0.80 |
| `guard_low` / `guard_high` | 0.02 / 0.95 |
| `endgame_hours` | 72 |
| `lock_timeout_ms` | 100 |
| `enabled` | **false** — see below |
| `effective_from` | migration timestamp |

Changing any parameter is one INSERT. The history ships in the dataset.

**The seeded row is `enabled = false`, and arming is a separate operator step.**
ADR-0024 applies the migration to production *before* the new code is promoted, so a
row seeded `true` would let the injector write `pool.liquidity_added` rows into a
database whose running code cannot read them — under-reporting `settleMarket`'s
residual by the injected discard, on a terminal append-only row. The window is
minutes and the fix costs one INSERT, which is the mechanism this section already
prescribes rather than a workaround for it. **Arm after the promote:**

```sql
INSERT INTO liquidity_policy
  (version, coefficient, floor, trigger_ratio, guard_low, guard_high,
   endgame_hours, lock_timeout_ms, enabled, effective_from)
VALUES (2, 500, 100000, 0.80, 0.02, 0.95, 72, 100, true, now());
```

then **verify a heartbeat row appears within 120 s** —
`SELECT max(ran_at) FROM liquidity_heartbeat;`. The heartbeat is written on every
tick regardless of `enabled`, so a heartbeat that is already current before the arming
INSERT proves the *job* is alive; the one after it proves the *policy* was read.

### H · Heartbeat and alarms

Through the existing `cron_alarms` path (RECON-2 §8a, §8d):

| alarm | condition |
|---|---|
| `liquidity_silence` | no heartbeat row in 15 minutes |
| `liquidity_undershoot` | any `Open` market below 60% of target for 60 minutes |

The first is the one that matters. A stopped job produces no error.

**The heartbeat is written on every tick, including the disabled, frozen and
no-policy paths** — it is evidence the *job* ran, never evidence it injected, and
conflating those two makes a stopped cron indistinguishable from a quiet one.
**`liquidity_silence` evaluates only while the newest policy row has
`enabled = true`**, so the deliberate gap between the migration applying and the
arming INSERT does not alarm. The cost of that gate is that a registration which
failed before arming is not caught by the alarm; the Runbook's 120-second heartbeat
check after the arming INSERT is what closes it.

### I · Chart replay

`price-series.ts` walks every event from the seed (RECON-2 §3c site 5; drift only WARNs). It seeds from two reserves and, on `pool.liquidity_added`, sets reserves to the payload's `reservesAfter` — exact, no recomputation.

### Constants pinned by this ADR

| constant | value | where |
|---|---|---|
| `FLOOR` | 100,000 Đ | `liquidity_policy` |
| `COEFF` | 500 Đ per signup | `liquidity_policy` |
| `TRIGGER` | 0.80 | `liquidity_policy` |
| `GUARD_LOW` / `GUARD_HIGH` | 0.02 / 0.95 | `liquidity_policy` |
| `ENDGAME_HOURS` | 72 | `liquidity_policy` |
| `INTERVAL` | 60 s | cron registration |
| `LOCK_TIMEOUT_MS` | 100 | `liquidity_policy` |
| `BET_MAX_STAKE` | 250 Đ | `limits.ts` — the one Appendix B constant this ADR pins |
| opening reserves, all eight | 90,000 / 10,000 | per-call to `openMarket` |

`COEFF` was not swept (SIM-2 §6.5). It is policy-table-adjustable; see Runbook.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Reserve-placement primitive (spec + oracle) | `src/server/cpmm/calculate.ts` |
| Reserve-placement primitive (runtime) | migration `NNNN` — the injector function body |
| Target rule and parameters | `liquidity_policy` table |
| Backing identity `(D_yes, D_no)` | one function, location per plan-mode; consumed by `void.ts`, `settle.ts`, conservation callers |
| Injection event schema | `src/server/events/schemas.ts` |
| Export SHIP rule | `SPEC.2` §19.4.1 + `src/server/export/dataset/strip.ts` |

## Consequences

**Rate invariance, measured.** With the injector, an 8× change in signup rate moves the closing launch price from 0.2250 to 0.2425 — 1.75 points. Without it, 0.787 to 0.994 (SIM-2 §3b). Seed-invariant: six random seeds, fourteen injections each, final price inside a 0.0049 band (§5).

**The slate is deleted as a price-setter.** No operator positions, nothing to tag, no arguments the operator doesn't hold.

**Discards are large.** The discard fraction is `1 − min(p,1−p) / max(p,1−p)`: 88.9% at the 10/90 open, ~75% across a launch hour (SIM-2 §2c). At 10,000 signups/hour one market commits ~4M Đ and discards ~3M of it; eight markets, ~32M/hour. The currency is minted, soulbound, and dispensable — the cost is bookkeeping. But the numbers will look strange to a reader of the dataset cold; the export carries a one-line explanation of what a discard is, and the `D` identity exists so the books close.

**`k` is no longer preserved across a market's life.** It was never asserted constant — INV-C2 is `k′ ≥ k`, and the staging pools already measure it: **14 pools, 13 with `k > k_at_open`, one exactly at it (a market nobody has bet), none below** (measured 2026-09-07 at LIQ-1-P2 execute; RECON-2 §2/§4.3 measured the same property on the twelve that then existed). ⚠ The pool count is **14**, not twelve — 15 staging fixtures, one of which drops its pool. The invariant becomes: `k` changes only through `pool.liquidity_added` events. Any other change is a named bug.

**Three critical-path functions are touched** — `openMarket`, `voidMarket`, `settleMarket` — plus the chart walker. The bet transaction is not.

**Spec amendments ride in the same commit** (CLAUDE.md §5.12): `cpmm.md` §7.1 (symmetric-only), §7.3 (asymmetric-open rejection), §7.4 (three doors → four), §14 (mid-market liquidity non-goal); SPEC.1 §10.6 (no mid-market adjustment), §10.5/§16.1 (`POOL_SEED_PER_MARKET_DEFAULT` — exists nowhere in `src/`, retired). Of SPEC.1 §10.6's three grounds: "re-prices positions retroactively" is false against A (measured exact); "breaks audit-trail integrity" stood, and E is its fix; "kills the K_eff signal" argues *for* this ADR — a fixed seed is what flattens the signal as turnout grows (RECON-2 §11a).

**What this does not fix.** Every bet on a market still serialises on one row (D-4); the YES:NO impact asymmetry at 10/90 remains ~12:1 and is intrinsic to any market at 10%; polling cost still grows with market age. None is a liquidity property.

## Execution

Two phases, each its own PR, each reviewed at Gate C by the orchestrator's diff read, with this ADR and the three measurement reports in hand. Ratified as below.

| | Phase 1 — open where you say | Phase 2 — depth follows signups |
|---|---|---|
| **Lands** | 8 September | 12 September |
| **Primitives** | B · E (with `D` from `market.opened` only) · I (two reserves) · A in TypeScript | A in SQL · C · D · F · G · H · I (injection replay) · E (injection events) · export rule · conservation callers |
| **Spec** | `cpmm.md` §7.1, §7.3 | `cpmm.md` §7.4, §14; SPEC.1 §10.6, §10.5/§16.1 |
| **Critical-path touches** | `void.ts`, `settle.ts`, `openMarket` | new `pools` writer; extends `D` |
| **If the other slips** | Markets open at 10/90 on a fixed seed with no slate — today minus the staged bets | — |
| **Soak before the 15th** | 7 days, twelve staging markets reseeded at 10/90 | 3 days |

Plan-mode precedes each phase from this ADR. A fresh session executes each ratified plan.

### Acceptance tests

| test | asserts |
|---|---|
| Price invariance | A moves price by ≤ 1e-18 across ≥ 10,000 fuzzed reserve pairs, including 90:1 |
| Differential | SQL and TypeScript A agree across the same fuzz |
| `k` changes only through a named door | every reserve write has exactly one event row; between consecutive events `k` is unchanged; buy/sell `k′ ≥ k`; inject `k′ > k` by the computed amount; open sets `k` |
| Backing identity | E holds after open, after N buys and sells, after N injections, on both outcomes |
| Void, asymmetric | `voidMarket` on a 90,000/10,000 market with positions returns and reconciles |
| Settle, NO outcome | residual = `N + D_no` after injections; `totalPaidOut + residual` = deposited |
| Conservation | all five callers reconcile with injections present |
| Freeze | injector is a no-op with `frozen_at` set |
| Concurrent | injector and bets on the same row under load — no deadlock, bets retry within budget |
| Overlap | two injector runs started together — one works, one exits |
| Replay | chart reserves match the live row after open + buys + injections; drift = 0 |
| Export | `pool.liquidity_added` ships under the §19.4.1 rule; an undeclared sibling still throws |
| Pins | `EVENT_TYPES.length === 25` at all three sites |

### Runbook

| when | what |
|---|---|
| After the prod promote | **Arm it.** `INSERT INTO liquidity_policy (…) VALUES (…, enabled = true, now());` then verify a `liquidity_heartbeat` row within **120 s**. The migration seeds `enabled = false` on purpose (§G) — until this INSERT runs, the injector is a no-op and `liquidity_silence` is not evaluated |
| 15 Sep, 00:00 UTC | Seed all eight at 90,000 / 10,000 — on the day, not before (chart axis clips a pre-window genesis) |
| 15 Sep, 18:00 UTC | Measure real deployment from the ledger. If it differs from staging's 18% by more than 2×, INSERT a new `coefficient` |
| `liquidity_silence` fires | Call the injector function by hand — same body the cron runs. Then find out why the cron stopped |
| `liquidity_undershoot` fires | A market is stuck at a guard or the lock. Look; it is information. ⚠ **The alarm is ONE GLOBAL watermark, so the payload's `markets` count is a SNAPSHOT taken at the transition and a SECOND market going under emits nothing.** Recovery needs ALL markets to clear. And the endgame window makes this routine rather than exceptional: a market inside its last `endgame_hours` is deliberately not topped up, will predictably drain below 60%, and will hold the global state at `below` — masking a genuine undershoot elsewhere for the rest of that window. Read the alarm as *at least one market*, and query the live pools for the current set |
| Any tuning | INSERT into `liquidity_policy`. Never UPDATE. Never a deploy |
| Tuning `lock_timeout_ms` | ⛔ **THE INVARIANT IS `≈ 2 × (open_markets − 1) × lock_timeout_ms + overheads < 1000`.** ⚠ *It was stated as `(N−1) × T` and that UNDERSTATES the worst case by up to 2×*: there are **two** lock acquisitions per market — `markets` then `pools` — and `lock_timeout` is **per statement**, so a markets lock that succeeds just under the budget hands the pools lock a fresh full one. Add `count(*) FROM users` (8.1 ms at 100k, growing), ~5 ms of per-market work, and the final heartbeat INSERT. The participant-reachable case is the 1× form (a bet holds `pools`, never `markets`); the 2× form needs concurrent admin lifecycle actions. The sweep is ONE transaction, so a pool row locked at the first market stays locked until the last finishes, and a bet waiting on it has a **1,000 ms `statement_timeout` whose `57014` is NOT retryable** — a bet that loses that race does not retry, it fails. ⛔ **Migration `0029` tightens the CHECK ceiling to 100 ms — `0028`'s 250 was measured to BREAK the money path** (8 markets, 7 pool rows held: sweep 1,776 ms, and a bet-shaped statement died at 1,004 ms with a `57014` the bet path does not retry). A ceiling that blesses the failure it was added to prevent is worse than none, because it reads as a guard. ⚠ **And the ceiling is still not a proof** — a CHECK cannot see the market count. What makes the bound hold at ANY count is `0029`'s **total-sweep budget**: the loop stops taking new locks after 600 ms, so the worst-case hold is ~750 ms whatever `N` is. The cost is that markets after the cut-off wait a tick, which is the design's own self-healing argument, and `liquidity_undershoot` is the signal if one waits repeatedly. ⚠ **Measured 2026-09-07: staging carries TEN `Open` markets, not the eight this ADR reasons from** — so the safe ceiling there is 111 ms and the shipped 100 ms holds with almost no room. **Re-derive this before adding markets, not after** |
| Any alarm titled `liquidity_injection_error` | A market's subtransaction raised something other than a lock timeout; the row carries `sqlstate`, `message` and `market_id`. ⚠ Not in §H's table because it is not a monitored CONDITION — it is the `WHEN OTHERS` arm making a swallowed error visible. Its durability is conditional on the rest of the sweep committing |

## Closed by plan-mode

All three were open questions for plan-mode and plan-mode has run. Answered here so a
later reader does not re-derive them, and so this section stops describing as undecided
three things that are decided and shipped.

- **Where the backing-identity function lives.** `src/server/markets/backing.ts` —
  `requireMarketDiscards`, landed in Phase 1. Phase 2 adds a *second* query beside the
  genesis read rather than widening it.
- **Whether `count(*) FROM users` needs `pg_class.reltuples` at 100k rows.** **No — and
  the premise above was wrong.** Measured on 100,000 rows: `Aggregate … actual
  time=8.075..8.075`, **Seq Scan**, 736 shared buffers. It is not an index-only scan; the
  conclusion was right for the wrong reason (`O-13`). 8.1 ms is 0.013% of the 60 s
  interval. `reltuples` is refused separately: it is ANALYZE-lagged, which would make the
  target irreproducible for a dataset reader (Driver 6).
- **The exact name of the migration.** `0027_liquidity_injector_pg_cron.sql`. It **does**
  match `*pg_cron*`, and must: it carries the `cron.schedule` registrations, so CI's
  `^`-anchored strip has to find it. The rule reads *must not match unless it carries the
  line* — this file carries the line.

## Patch record

**P1 · 2026-09-07 · LIQ-1-P2 execute.** Seven founder rulings taken at the Phase-2
kickoff. The decision is unchanged; what moved is the consumer surface, so this is an
in-place patch and not a supersession (CLAUDE.md §5.12). **Each correction is written
into the section that carried the superseded text** — this block records the change, it
does not deliver it (`O-5`).

| ruling | section | what changed |
|---|---|---|
| R2 | §Acceptance | the `k` row asserted `k′ > k` only on inject. **False as written** — `cpmm.md` §12 E2 is a *buy* that raises `k` by `floor18` dust, and INV-C2 is `k′ ≥ k`. Restated as the named-door property the §Consequences paragraph already carried. |
| R4 | §G, §H, §Runbook | the seeded policy row becomes `enabled = false`, armed by an operator INSERT after the promote; the heartbeat writes on every tick regardless of `enabled`; `liquidity_silence` evaluates only while the newest policy is enabled. |
| R8 | §D | the injector is a `FUNCTION` invoked with `SELECT`, matching `0007`/`0011`, with a per-market subtransaction and no `COMMIT` in the body. Recorded here; the body lives in the plan's §4 and migration `0027`. |
| R9 | §Execution | Gate C is *the orchestrator's diff read*, not a senior reviewer assigned on the PR. |
| R9 | §Consequences, §Drift | the staging pool count is **14**, not twelve — re-measured. |
| R9 | §Open for plan-mode | retitled **Closed by plan-mode**; all three answered, the `count(*)` one with the measurement that contradicts its stated premise. |

## Drift recorded, not acted on

- `AGENTS.md` §9:445 says staging's markets carry no `market.opened`; **all fourteen do** (`chart-4-genesis-backfill`; re-measured 2026-09-07 — 14 pools, 0 without a genesis row).
- ADR-0013 §2's lock order names `friendly_fire_events`, dropped at `0018`.
- `0007` asks for pg_cron `WITH SCHEMA extensions`; it lives in `pg_catalog`.
