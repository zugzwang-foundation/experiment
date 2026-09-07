# LIQ-1 — the umbrella log

**Lane:** mid-market liquidity. **ADR:** [`0047`](../adr/0047-asymmetric-open-and-signup-pegged-liquidity.md) — asymmetric open + signup-pegged injection.
**Span:** 2026-09-05 → 2026-09-08. **Closed at:** `LIQ-1-SOAK-CLOSE`.
**Shipped in:** PR #491 (`e25fa277`) · PR #496 (`67ceb6b5`) · PR #499 (`5052ae80`) · PR #500 (`da9979b9`).

> ⛔ **This file is an exception, not a precedent.** D-18 abolished per-session logs
> (`CLAUDE.md` §5.9): the record is `docs/records/<LANE>-record.md` plus the commit
> log with its notes. LIQ-1 ran across **fifteen sessions in four days**, three of
> them measurement-only and never committing anything, and two of them incidents
> rather than tasks. A reader asking *"why does the injector look like this"* would
> otherwise have to reconstruct that from fifteen `~/Downloads` reports that are not
> in the repository at all. **This is an index to those reports and the decisions
> they produced — not a replacement for them, and not a session log for any one of
> them.**

---

## §0 · What LIQ-1 was for, in one paragraph

A market that opens at 50/50 tells the participant nothing, and a market that opens
where the operator believes it should is worthless if the first 250 Đ bet moves the
price twenty points. LIQ-1 does two things: it lets a market **open at a stated
price** (asymmetric reserves, not a symmetric seed), and it lets the **depth follow
the population** — every minute, a `pg_cron` sweep tops up every `Open` market's
reserves toward a target pegged to the signup count, at a price it does not move.
The second half is what makes the first half survive contact with a crowd.

---

## §1 · The sessions, in order

| # | Session | Landed | Report |
|---|---|---|---|
| 1 | `LIQ-RECON` | — (read-only) | `zz_LIQ-RECON_measure_2026-09-05T0731.md` |
| 2 | `LIQ-RECON-2` | — (read-only) | `zz_LIQ-RECON-2_measure_2026-09-06T1314.md` |
| 3 | `LIQ-SIM-2` | — (simulation) | `zz_LIQ-SIM-2_measure_2026-09-06T1444.md` |
| 4 | `LIQ-1-P1-PLAN` | `docs/plans/LIQ-1-P1_plan.md` | `zz_LIQ-1-P1_plan_2026-09-06T1459.md` |
| 5 | `LIQ-1-P1-EXEC` | **#491 · `e25fa277`** | `zz_LIQ-1-P1_exec_2026-09-06T1009.md` |
| 6 | `LIQ-1-P1-MERGE` | — | `zz_LIQ-1-P1_merge_2026-09-07T0621.md` |
| 7 | `LIQ-1-FIX-1` | **#494 · `18cd027f`** | `zz_LIQ-1-FIX-1_2026-09-07T0717.md` |
| 8 | `LIQ-1-P2-PLAN` | `docs/plans/LIQ-1-P2_plan.md` | `zz_LIQ-1-P2_plan_2026-09-06T2147.md` |
| 9 | `LIQ-1-P2-EXEC` | — | `zz_LIQ-1-P2_exec_2026-09-07T0920.md` |
| 10 | `LIQ-1-FIX-2` | — | `zz_LIQ-1-FIX-2_2026-09-07T1328.md` |
| 11 | `LIQ-1-MERGE-2` | **#496 · `67ceb6b5`** | `zz_LIQ-1-MERGE-2_exec_2026-09-07T2042.md` |
| 12 | `LIQ-1-RESTORE` | **#499 · `5052ae80`** | `zz_LIQ-1-RESTORE_2026-09-07T1839.md` |
| 13 | `LIQ-1-PROMOTE` | — (operate) | `zz_LIQ-1-PROMOTE_operate_2026-09-08T0109.md` |
| 14 | runbook fix | **#500 · `da9979b9`** | (folded into 13) |
| 15 | `LIQ-1-SOAK-CLOSE` | this close-out PR | `zz_LIQ-1-SOAK-CLOSE_2026-09-08T0142.md` |

---

### 1 · `LIQ-RECON` — measure before deciding anything

Read-only, from a detached worktree at `729724ef`. It answered the question the ADR
could not be written without: **what does the pool actually do today, and where is
depth decided?** It also established the discipline the whole lane then used —
every claim carries the command that produced it, and anything an endpoint refused
to answer is recorded as **NOT ESTABLISHED** rather than inferred (`O-13`).

### 2 · `LIQ-RECON-2` — the five measurements that shaped the design

The pre-ADR pass, at `4133338a`. Four of its findings became decisions:

- **§1 — `settleMarket` under-reports the residual on a NO outcome by exactly
  `D_no`,** and `voidMarket` throws outright on any asymmetric seed. Both were
  *invisible while every discard was zero*, which every symmetric seed guarantees.
  Opening at a price makes them live. This is why §E of the ADR (the backing
  identity) exists at all.
- **§10.6 — the velocity guard is anti-correlated with the trigger.** The fast
  minute that drains a tank is the minute a velocity guard forbids refilling it; at
  40,000 signups/hour it suppressed seven of eight injections. Rejected.
- **§5c — five conservation callers, all tests and gates, zero production.**
  Extending the identity was therefore cheap.
- **§8 — `pg_cron` 1.6.4 on both environments**, registration pattern `0011`,
  amendment pattern `0015`. The injector's shape follows from this.

### 3 · `LIQ-SIM-2` — the number nobody swept

A launch simulation over the corrected injector. **§0a**: all fourteen fires land
`tank/target = 1.000000`, and the placement primitive is price-preserving to 18 dp
on symmetric, skewed and 90:1 pools. **§2b**: at 10,000 signups/hour the injector
fires at minutes 2, 3, 4, 5, 7, 9, 12, 15, 19, 24, 30, 37, 46, 57 — fourteen in the
hour, gaps growing 2 → 11 minutes, **self-quieting**. That last property is why the
design needs no rate limit of its own.

⚠ **`COEFF` was never swept** (§6.5), and the ADR says so rather than implying the
500 was derived. It is policy-table-adjustable; the Runbook's 15 Sep 18:00 UTC row
is how it gets tuned against reality.

### 4 · `LIQ-1-P1-PLAN` → 5 · `LIQ-1-P1-EXEC` — #491, `e25fa277`

**Asymmetric open, the backing identity, two-reserve replay.** `openMarket` takes an
opening price and a tank and writes `yes = (1−p)·tank`, `no = p·tank`; the
`market.opened` payload gains `backingMinted`, `discardedYes`, `discardedNo`;
`settle.ts` and `void.ts` learn the `D` term; the chart replay seeds from two
reserves instead of one.

⚠ **The network dropped at ~20:57 IST mid-turn**, during the mutation check on the
T6b inversion. Nothing was lost — the branch was committed through `1b4a9841` and
the only uncommitted work (`cpmm.md` §13/§12) was on disk and intact, landing as
`8f89c821`. **The resume brief's own premise needed correcting**: it said the spec
edit was committed and `git status` said otherwise, which is the reason a resume
verifies rather than trusts. The mutation check itself was then run properly — the
pre-fix summing body restored, the named test observed to red, then reverted — and
pass 2 showed *that* check was itself incomplete. **A fix whose test cannot fail is
half a fix.**

### 6 · `LIQ-1-P1-MERGE` → 7 · `LIQ-1-FIX-1` — #494, `18cd027f`

Fixture deadlines clamped to the freeze ceiling. Small, and the kind of thing that
only shows up once real dates meet a fixture table written before them.

### 8 · `LIQ-1-P2-PLAN` → 9 · `LIQ-1-P2-EXEC` → 10 · `LIQ-1-FIX-2` → 11 · `LIQ-1-MERGE-2` — #496, `67ceb6b5`

**The injector itself.** Migration `0027` ships `liquidity_policy` (Bucket A, three
guards), the unguarded operational `liquidity_heartbeat`, and three plpgsql routines
— `zz_add_liquidity`, `run_liquidity_injection`, `check_liquidity_alarms` — plus two
`cron.schedule` registrations and one policy row seeded **`enabled = false`**.

Four things in this phase are worth carrying forward, because each was a correction
rather than a build:

- **`0028` — the status is re-read under the lock.** The sweep's cursor snapshot
  predates every lock it takes, so a market can leave `Open` between being
  enumerated and being locked. The lock is only worth taking if you re-read
  underneath it.
- **`0029` — the CHECK ceiling `0028` set was above the value that breaks a bet.**
  Measured: 8 markets at 250 ms ran the sweep 1,776 ms against the bet path's
  **non-retryable** 1,000 ms `statement_timeout`. `0029` lowers the ceiling to 100
  and — because a CHECK cannot see the market count — moves the real bound **into
  the sweep** as a 600 ms lock-hold budget. ⛔ *A ceiling that blesses the failure
  it was added to prevent is worse than none, because it reads as a guard.*
- **L-6 — five staging fixtures stood above the new `BET_MAX_STAKE`.** Split into
  placeable steps, and the generator taught to **refuse** an over-cap fixture using
  the shipped `clampStakeToMax` as its oracle.
- **FIX-2 H-1 — G5.7b was asserting a state the product forbids.** With the cap at
  250, `stake >= 1000` is unsatisfiable by any fixture, so the gate had been green
  only because the fixtures violated the cap. Restated as **(a)** `max(bets.stake)
  <= BET_MAX_STAKE`, reading the constant rather than a literal, and **(b)** a
  four-digit *holding* (`Σ lots.surviving_basis` per user/market/side) still exists.

### 12 · `LIQ-1-RESTORE` — #499, `5052ae80`

⛔ **The incident.** On **2026-09-07** a `pnpm staging:reset` truncated `markets`,
taking the **eight founder-authored content markets** with it. Their copy is not
reproducible from this repository by any means but one:
`docs/data/staging-markets-snapshot.json`, a read-only capture somebody had
committed for exactly this event.

Two things came out of it, and the second is the more important:

- **`scripts/seed-content-markets.ts`** — the recreation tool, which replays the
  snapshot **through the shipped admin engine** (`createMarket` / `openMarket`),
  reusing the original UUIDv7 ids so all sixteen R2 objects stay addressable.
  ⛔ *Nothing in it writes a row, and that is the point:* a restore that INSERTed
  snapshot rows would rebuild the state and skip the events, and since ADR-0047 §E
  a market without its genesis row can no longer be settled or voided at all.
- **A sixth gate on the reset**, and it is the only one that asks about **data**:
  the pre-flight reads `SELECT slug FROM markets` and refuses, naming every slug,
  when it finds one no fixture family claims. Acknowledged with
  `ZUGZWANG_STAGING_INCLUDE_CONTENT_MARKETS=include-content-markets`; a
  boolean-shaped value fails closed.

### 13 · `LIQ-1-PROMOTE` + 14 · the runbook fix — #500, `da9979b9`

The staging advance carried **two instructions that could each stop a healthy
promote**, and on 2026-09-08 they nearly did.

- **A check with no discriminating power.** The runbook said to decide whether
  migrations had applied by reading the migrate log. But drizzle-kit does not echo
  the statements it executes, and `CREATE TABLE`, `CREATE FUNCTION` and
  `cron.schedule()` raise no NOTICE at all — **a no-op and a four-migration apply
  print an identical log.** The LIQ-1 promote hit exactly that: the documented
  mismatch fired, the documented instruction was to halt, and `0027`–`0030` had in
  fact landed — provable only because the row `0027` seeds is timestamped inside the
  migrate step's own window. Replaced by asking the database: journal head against
  the highest file, per-hash parity, and an existence probe where a migration names
  one.
- **A migration-bearing staging advance routed to the production section**, which
  contains no staging step. ADR-0024 had always said staging migrates automatically
  on push; the correction was already decided and only had to be applied where
  someone would read it.

Both were written **into the operative text**, not appended — `O-5`.

### 15 · `LIQ-1-SOAK-CLOSE` — this session

Staging rebuilt under the final code, the injector armed and driven end to end,
then the lane closed. Full report:
`~/Downloads/zz_LIQ-1-SOAK-CLOSE_2026-09-08T0142.md`. The headline results:

- **18 of 18 `Open` markets injected in a single 60 s tick** at `N = 18` — 2.25× the
  eight the ADR reasons from. The 600 ms lock-hold budget did not cut the sweep.
- **`|Δprice_yes|` measured EXACTLY ZERO** on all 18, not merely ≤ 1e-18.
- **`discardedShares == backingMinted − (S′ − S)` exact on all 18**, which is the
  residual construction the backing identity rests on.
- **The NO-outcome settle returned `180,032.000888691401940000`** — `no_reserves +
  D_no` with `D_no` carrying **both** the 80,000-class open discard and the
  80,028-class injection discard. Phase 1 would have returned the reserve alone:
  **20,003.56, under-reporting by 89% of the residual on a terminal, append-only row.**
- **`voidMarket` returned** on an asymmetric pool — the call that used to throw.
- **Chart replay drift `0.000000000000000000`** on all 18, including a 37-point walk.
- **Both alarms fired and neither repeated.**
- **`0030` verified in effect on hosted staging** — all seven
  `has_function_privilege` reads FALSE.

⚠ **Two findings the soak produced, both recorded rather than fixed:** the injector's
`tank′` lands on `target` to a relative **2.4e-19** rather than exactly (PostgreSQL's
`select_div_scale` caps the quotient at scale 18 one line above a primitive that was
written to be scale-independent), and the hosted-staging **table** grants for `anon`
and `authenticated` are now **measured** rather than NOT ESTABLISHED — closing the
evidence half of `L-10` while leaving its substance open.

---

## §2 · Passive watch — what to run, and what green looks like

**Daily, until the production migration:**

```sql
SELECT max(ran_at) AS last_heartbeat,
       (SELECT count(*) FROM liquidity_heartbeat WHERE ran_at > now() - interval '1 hour') AS ticks_last_hour,
       (SELECT count(*) FROM events WHERE event_type = 'pool.liquidity_added') AS injections_total,
       (SELECT state FROM watermark_state WHERE metric = 'liquidity_silence')    AS silence,
       (SELECT state FROM watermark_state WHERE metric = 'liquidity_undershoot') AS undershoot,
       (SELECT count(*) FROM cron_alarms WHERE alarm_id LIKE 'liquidity%' AND processed_at IS NULL) AS open_alarms;
```

**Green is:** `last_heartbeat` within 2 minutes of now · `ticks_last_hour` = 60 ·
`silence` = `above` · `undershoot` = `above`.

⚠ **`injections_total` is NOT a green/red field.** Under the production policy
(target 100,000, tanks at 200,035) nothing is meant to inject, so a flat count is
the expected state, and a rising one is *information* rather than an error.

**STOP conditions** — stop and investigate rather than adjusting anything:

1. **No heartbeat for more than 5 minutes.** The job has stopped. `liquidity_silence`
   takes 15 minutes to notice; the heartbeat is the faster signal. Recovery is to
   call the function by hand and then find out why cron stopped.
2. **`liquidity_silence` reads `below`.** Same condition, confirmed.
3. **Any `pool.liquidity_added` on a market that is not `Open`.** The `0028` status
   re-read has failed; this puts reserves behind a settling pool.
4. **Two `pool.liquidity_added` rows for one market inside one tick's `request_id`.**
   The advisory lock has failed and two sweeps overlapped.
5. **A `liquidity_injection_error` alarm.** A market's subtransaction raised
   something other than a lock timeout; the row carries `sqlstate`, `message` and
   `market_id`.
6. **A bet failing with `57014`.** The sweep is holding a pool lock past the bet
   path's non-retryable 1,000 ms `statement_timeout`. This is the failure `0029`'s
   600 ms budget exists to prevent, and it would mean the budget is not holding.
7. **`liquidity_undershoot` reads `below` and stays there.** Read it as *at least
   one market*, never as the payload's count — the alarm is one **global** watermark
   and a second market going under emits nothing. Query the live pools for the
   current set.

---

## §3 · What LIQ-1 did NOT do

- **`COEFF` is unswept.** 500 Đ per signup is a starting value, tuned by INSERT.
- **The `L-10` table arm is open.** `anon` and `authenticated` hold write privileges
  on every money table; `0030` closed the function arm only. The Supabase Data API
  dashboard read is still owed before 15 Sep.
- **`L-8` (no `system_state` singleton constraint), `L-9` (no freeze gate on
  `check_liquidity_alarms`), `L-7` (the 64-market subxid cliff), `L-5` (a bet
  committed after an injection it queued behind is erased from the replayed tail),
  `L-1`–`L-3` (stale documentation)** all stand. `docs/parked.md` carries each.
- **Production is not armed.** The migration applies before the promote and the
  policy row is seeded `enabled = false`; arming is one INSERT afterwards, and the
  120-second heartbeat check is what proves it took.
