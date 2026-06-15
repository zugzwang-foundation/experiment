# ENGINE.10 — BUILD gate report (correctness-at-scale harness wired to GREEN)

> **Branch:** `feat/engine-10-scale` (off `origin/main` @ `96aed40`). **Status:** BUILD complete, holding for the web BUILD-review gate. **No PR opened.**
> Re-emitted as a committed file (transit caps were mangling the wide tables). Nothing about the green build changed to produce this report — two verification answers are foregrounded below, then the full gate evidence.

---

## ⓐ VERIFICATION — conservation correctness (the formula fixed mid-session, Surprise #1)

Web's concern is exactly right: **the two derivations agreeing to 18 dp does NOT by itself certify correctness** — so here is the residual, the production-anchor, and the independence argument.

### What `-206.600681742015570774` (and `-119.589…` on another run) actually is
It is **a signed net figure, NOT a conservation residual.** It is the **global signed flow sum** — `Σ` over all bet-tied `FLOW_TAGS` ledger amounts across all 8 markets (= net Dharma users gained/lost from market activity; negative because open markets 3–7 hold net parked stakes). It varies run to run with the storm's open-market parked-stake total. It is the *value the two independent routes agree on*, not the thing that must be zero.

### The residual IS exactly zero (captured from the real storm)
The conservation check is `in == out`, expressed as **`residual = derivation1Total − derivation2Total`**, which `crossCheck.ok` asserts via exact `CpmmDecimal` equality. Captured live (temporary instrumentation, reverted):

```
[amendment-E] derivation#1 total = -119.589019702084129182; derivation#2 total = -119.589019702084129182; agree = true
[residual] cross-check (in − out) = d1 − d2 = 0.000000000000000000     ← EXACTLY 0
[residual] derivation1.ok=true failing=[]
[residual] market … (settled/void/open) ΣFLOW−expected = 0.000000000000000000   (×7)
[residual] market … (corrected)         ΣFLOW−expected = 0.000000000000000000   (×1)
```

So conservation holds at **two** levels, both residual `= 0.000000000000000000` exactly:
- **Per-market** (derivation #1): every one of the 8 markets' `checkMarketConservation` / `checkCorrectedMarketConservation` returns `{ok:true}` ⟺ `Σ FLOW − netAdminPoolInjection = 0` exactly. `derivation1.ok = true`, `failingMarketIds = []`.
- **Global cross-check** (Amendment E): `d1Total − d2Total = 0` exactly.

### The fixed formula IS production's constant-product math (not a parallel model)
Open-market injection `= seed − cash`, where `cash = Y + Σ(YES positions)`. This is **the same pool-cash quantity the production void path computes**:
- `src/server/resolution/void.ts:187` — `const cash = new CpmmDecimal(pool.yesReserves).plus(yesHeld);` (with `yesHeld = Σ YES position quantities`, void.ts:178-186), cross-asserted equal to `N + Σ(NO positions)` at void.ts:188-193.
- For **resolved/voided/corrected** markets the harness does not re-derive anything — it reads `poolUnwindAmount` **straight from the production event payload** the engine wrote: `settle.ts:189-207` (`market.resolved`, `poolUnwindAmount = winning-side reserve`) and `void.ts:194-231` (`market.voided`, `poolUnwindAmount = cash − totalRefunds`).
- The discarded formula `(Y₀+N₀) − (Y+N)` was wrong because a constant-product buy barely moves `Y+N` (Δ(Y+N) ≈ 0.099 for a stake of 10 — verified: shares-out 19.900990, so Δ = 2·10 − 19.900990). The cash value, by contrast, grows by exactly the net stakes.

### Derivations #1 and #2 are GENUINELY INDEPENDENT post-fix
The bug was in derivation #1's **input** (the open-market injection formula). The fix touched **only** that input. Derivation #2 was **never touched** and reads a disjoint set of DB columns:
- **#1 (pool-side accounting):** per-market `netAdminPoolInjection` (from `pools.yesReserves` + `positions` for open; `events.payload.poolUnwindAmount` for terminal) checked against per-market `dharma_ledger` FLOW rows (keyed by `bets.id`) + sell flows via the `bet.sold` event. → `reconcile.ts` derivation #1 + `gatherSnapshot` market loop.
- **#2 (user-balance accounting):** `Σ latest balance_after` (`DISTINCT ON (user_id) … dharma_ledger`) − `Σ initial_grant` − `Σ daily_allowance` − `Σ uncollectable`. It reads **no** pool reserves, **no** positions, **no** `poolUnwindAmount`, **no** per-market FLOW rows. → `reconcile.ts` derivation #2.

**Decisive evidence the cross-check is non-vacuous and the derivations are independent:** *the bug surfaced as RED, not as a false agreement.* Pre-fix, derivation #1 used the wrong open formula → its per-market checkers for the open markets returned `{ok:false}` (`d1ok=false`) **and** `d1Total ≠ d2Total` (`crossOk=false`) → the reconciliation test failed at `expect(result.ok).toBe(true)`. Derivation #2 (reading balances) was already correct; #1 (reading the bad pool formula) disagreed with it. A wrong shared-*model* would have made both agree on a wrong number — instead they **disagreed**, which is precisely the cross-check doing its job. Post-fix they agree on the correct value with residual 0.

### Why the `d2ok` "tautology" LOW finding does NOT hollow out the cross-check
`d2ok = reconstructed.equals(latestBalances) && latestBalances ≥ 0 && sumPoolUnwindExits ≥ 0`. The first clause IS an algebraic identity (`issuance + (bal − issuance − unc) + unc ≡ bal`) — always true. **But the conservation guarantee does not come from `d2ok`.** It comes from (1) derivation #1's per-market checkers (`Σ FLOW == injection` each) and (2) the cross-check `d1Total == d2Total` — a comparison of two **independently computed** totals. The cross-check's power is the *independence of the two operands*, not any internal property of `d2`. `d2ok` is a minor sanity guard (non-negativity of balances / unwind), not load-bearing. The non-vacuous leak detector is the cross-check, **proven** by the leaked-snapshot negative control (`reconciliation.scale.test.ts` — feeds a snapshot where balances say 1100 but per-market flows say −10 → `d1Total=−10 ≠ d2Total=100` → `crossCheck.ok=false`). A real double-`bet_payout` leak inflates `Σ balances` (route B) without moving pool injection (route A) → cross-check fails; a per-market double also trips derivation #1 directly. That is Amendment E's whole point, and it holds.

---

## ⓑ VERIFICATION — clawback floors-at-zero (the one §7 item marked PASS-by-reuse)

**Resolution: PASS-by-reuse STANDS — the clawback/uncollectable write is atomic inside the correction's SERIALIZABLE transaction, so a 40001 retry under the storm rolls the *entire* correction back (uncollectable included). No new test needed.** Code path:

- **One SERIALIZABLE tx, full rollback on retry.** `correctResolution` runs its whole body inside `runResolutionTransaction(..., { flow:"F-RESOLVE-2", lockPool:true })` (`correct.ts:69-77`). That wrapper opens `db.transaction(cb, { isolationLevel: "serializable" })` and **re-runs the ENTIRE callback on each 40001/40P01 retry** (`transaction.ts:126-143`); a failed attempt rolls back fully (Postgres tx). This is the identical retry-purity contract that makes settle/void safe — Surprise #2's "W-3 ops retry under the storm" is exactly this mechanism, and it makes a double-write impossible by construction.
- **The uncollectable write is INSIDE that callback.** `correct.ts:285-291` — `appendLedgerRow(tx, { entryType: "uncollectable", … })` is executed on the same `tx`, so it is rolled back with everything else on a retry. A committed correction is therefore exactly-once-by-rollback; there is no path to a duplicate uncollectable from a retry.
- **≤1 uncollectable / user / correction is structural.** The per-user loop (`correct.ts:245-312`) writes at most ONE uncollectable row per user — the single `if (recorded.greaterThan(balance))` branch at `correct.ts:280-293`. Across the (atomic) correction, exactly the final successful attempt's rows survive.
- **balance ≥ 0 is the DB CHECK, asserted at scale.** `CHECK (balance_after >= 0)` — `dharma_ledger_balance_non_negative`, `src/db/schema/dharma.ts:86-89` — fires on every `appendLedgerRow` INSERT, including under retry. The clawback is floored at `min(recorded, balance)` (`correct.ts:264`) so the reverse leg never drives negative; the uncollectable row is Model-A (amount ≤ 0, `balance_after = previous` — `correct.ts:280-292`). The scale battery asserts `balance_after >= 0` pervasively (`walkLedgerChain` per user + the `SELECT count(*) … WHERE balance_after < 0` backstop = 0 in `hot-row-contention`), and the cross-suite floor exercises the negative-driving correction directly (`tests/integration/resolution-conservation` identity-ii with `uncollectable = 110`; `tests/unit/dharma/conservation-correction`) — both green this session.

**MEDIUM-1 fail-safe direction CONFIRMED.** The global (not per-market) `uncollectable` gather in `gatherSnapshot` is correct while at most one market is corrected per snapshot (the battery's case). With two corrected markets it would assign the global total to *each* corrected market's operand → **inflate** `d1Total` → `d1Total ≠ d2Total` → `crossCheck` fails as a **false FAILURE**. It can only ever ADD to `d1Total`, so it can never make a leak pass silently. The direction is fail-safe (loud false-failure, never silent pass). Documented in-code at `reconcile.ts` (the corrected branch). `uncollectable` rows carry `bet_id` NULL + no `market_id`, so per-market attribution is the same R-2 deferred problem as sells; scope it when multi-correction scale coverage lands.

---

## Gate evidence (full)

### Gates 1–4 — suites + verify (real output)
```
LOCAL PG          Postgres :54322 UP; DATABASE_URL self-set by tests/_setup/env.ts:20
pnpm test:scale   Test Files 8 passed (8) · Tests 15 passed | 1 skipped (16)   [stable 5/5 full-battery runs]
pnpm test:invariants    9 files / 20 passed
pnpm test:integration   11 files / 103 passed
pnpm vitest run (DEFAULT, tests/scale/** EXCLUDED)   110 passed | 3 skipped (113 files) · 873 tests passed
ZUGZWANG_ENV=preview just verify    All checks passed (typecheck → biome → next build)
```

### Gate 5 — scope fence (`git diff --stat origin/main`)
18 files, **2569 insertions, 3 deletions** — all under `tests/scale/` (13) + `_harness/{collide,reconcile,perf,asserts}.ts` + Q-2 wiring (`vitest.config.ts`, `vitest.scale.config.ts`, `package.json`, `justfile`). **Zero `src/` / `drizzle/` / `supabase/`** (grep-confirmed). Migration head **0015**; `EVENT_TYPES` **23**. (This report adds one more file under `docs/logs/`.)

### Gate 6 — perf artifact (RECORDED-ONLY, not gated)
Emitted to `$TMPDIR/engine10-scale-perf.jsonl` (per-storm p50/p95/max JSON) + printed per storm. Local p95 range **145–486 ms** across 13 storms. No egregious number → no founder escalation. The hard `p95 < 500ms @ 5k VUs` gate is the deferred next-P0 k6/staging stratum.

### Headline evidence
- **Collision-is-real:** a 48-writer same-market storm fired **116 real SQLSTATE `40001` retries** through the W-1 wrapper (25 committed; the rest surfaced the typed terminal error — never torn). The barrier is not a no-op.
- **Amendment-E** (printed): `derivation#1 total == derivation#2 total` byte-identical, `agree = true`, residual `d1 − d2 = 0.000000000000000000` (see ⓐ).
- **Amendment-F arms** (across 6+ runs): committed-before-flip = `6 / 8 / 11 / 12 / 16` of 24 (nondeterministic), rejected-on-SSI-retry/MarketNotOpen the complement, void always terminated; the XOR `refundBetIds === committedBetIds` held every run.
- **D1 RED→GREEN:** with `collide` stubbed, the 3 pure-kernel money-math tests stayed ✓ green and the new harness-driven `money-math::settle-fanout-payout-legs-sum-to-basis-total-exactly` went **× RED (`not implemented` via collide)**; with `collide` wired → **✓ GREEN** (`Σ` real `payout_events` legs `== totalPaidOut`, 18 dp).
- **Negative controls (non-vacuity):** leaked snapshot → `crossCheck.ok=false`; broken chain → `walkLedgerChain {ok:false, brokenAtIndex:2}` (intact → `{ok:true}`). Green on correct data, red on corrupt.

### Gate 7 — pre-PR self-audit vs §7 HARD-assertion table
| §7 assertion | Verdict | How |
|---|---|---|
| Per-market conservation (all 8) | **PASS** | hot-row (open: `seed − cash`) + reconciliation #1; per-market residual 0 |
| **GLOBAL conservation, TWO derivations (Amend. E)** | **PASS** | #1 ⊕ #2 cross-checked equal; residual `d1−d2 = 0` (see ⓐ) |
| INV-1 atomicity | **PASS** | 1:1 bet↔comment, `comment_id NOT NULL`, count parity scoped to posts |
| INV-2 no-overdraft + chain | **PASS** | `walkLedgerChain` per user + `balance≥0` + SQL backstop count=0 |
| INV-3 side-bind | **PASS** | prior `side_at_post_time` immutable across flips + storage UPDATE rejected |
| INV-4 append-only + two-spine XOR (Amend. F) | **PASS** | induced race, XOR, Bucket-A UPDATE/DELETE rejected |
| Idempotency dedup (Q-3) | **PASS** | exactly-one-spine via `bets.idempotency_key` + 23505 reject; Redis `it.skip` |
| Daily-credit once | **PASS** | ≤1 `daily_allowance`/user/UTC-day + unique partial index reject |
| Money-math determinism | **PASS** | pure `prorate` (500/256/64 fan-out) + harness-driven settle fan-out (D1) |
| Freeze write-seal | **PASS** | post-freeze 410 / reads 200 / cron `{status:"frozen"}` / zero new rows; real `isFrozen()` |
| Resolution acceptance at scale | **PASS** | reconciliation runs settle+void+correct across markets; money-math settle |
| Clawback floors-at-zero | **PASS-by-reuse** | atomic inside SERIALIZABLE correction (rollback-on-retry) + `balance≥0` CHECK at scale + cross-suite floor exercises the negative-driving path — see ⓑ |

### Gate 8 — subagent reviews + resolutions
**`@security-auditor` (thesis fence): ZERO findings at any exploitability level.** All six fences attacked and held — no append-only ledger mutation (the `.rejects.toThrow()` asserts the triggers, never disables them); no un-freeze (the freeze is reset via `TRUNCATE system_state` + reseed because the one-shot Bucket-B trigger rejects `timestamp→NULL`; the freeze behavior hits the real `isFrozen()`); no admin participation (`adminMetadata{user_id:null,actor_id:"admin-singleton"}` only on `F-RESOLVE-*`; no admin `users` row; bets carry real users); no moderation bypass (mocks are clearly endpoint-isolation, not asserted as production); INV fence (`parentCommentId:null` at all 6+ `place()` sites); no Dharma-transfer / market-content invention. Confirmed the reconciler is non-vacuous and the two derivations independent.

**`@code-reviewer` (collide + reconcile): harness SOUND, no CRITICAL/HIGH.** Confirmed all three §5.10 fixes correct. Resolutions:
- **MEDIUM-2** (the `rejected` partition wasn't checked against the §5 documented-terminal-error taxonomy) → **FIXED**: added `tests/scale/_harness/asserts.ts` (`assertDocumentedRejections` — matches by error `.name` ∪ documented SQLSTATEs `40001/40P01/23505/23514`) and wired it into the hot-row, idempotency, and two-spine storms. Enforces the §5 "documented terminal error" half. Stress-tested 12/12, no flake.
- **MEDIUM-1** (global `uncollectable` query, single-correction scope) → **documented in-code**; fail-safe (false-failure only) — see ⓑ.
- **LOW** (collide sparse-array guard) → **FIXED** (writes a `rejected` result instead of leaving an index hole).
- **LOW** (`d2ok` round-trip is tautological) → **acknowledged, left unchanged**; the non-vacuous gate is the cross-check by Amendment-E design — see ⓐ.

### §5.10 surprises caught + fixed in-session
1. **Open-market conservation formula was wrong** in the RED-authored hot-row test *and* my first `gatherSnapshot` — both used the reserve-sum delta `(Y₀+N₀)−(Y+N)`, but a constant-product buy moves `Y+N` by ≈0.099 for a stake of 10, not 10. Fixed both to the pool-cash formula `seed − (Y + ΣYES positions)` (= production `void.ts:187`). Verified mathematically + empirically; surfaced as RED (the cross-check + per-market checkers caught it). Both reviewers confirmed the fix. (Saved to project memory for the k6/DEBATE strata.)
2. **Two-spine flake** (~40% of runs): the test asserted the void task is always `fulfilled`, but the void's own W-3 tx can exhaust its 40001 retry budget under the 24-bet storm → `ResolutionSerializationExhaustedError` (a documented terminal error, never torn). Fixed to assert the **end-state** (market reaches `Voided`) via operator re-issue (`ensureVoided`), per the §7 flake-guard (assert end-state, never retry counts/outcomes). Stress-tested 10/10; reviewer confirmed faithful to Amendment F (the race is still induced in the barrier; the XOR still holds).
3. **D1 ruling** implemented as instructed (harness-driven settle fan-out → real `payout_events` → `Σ == totalPaidOut`), shown RED→GREEN.

---

## tests/scale/ layout (final)
```
tests/scale/
├── _fixtures/{markets,seed}.ts          8 synthetic placeholder markets + seed/metadata helpers
├── _harness/
│   ├── collide.ts                       barrier-synchronized bounded-pool collision driver
│   ├── reconcile.ts                     reconcile (2 derivations + cross-check) · gatherSnapshot · walkLedgerChain
│   ├── asserts.ts                       assertDocumentedRejections (§5 error-taxonomy)
│   └── perf.ts                          recorded-only p50/p95 artifact
├── hot-row-contention.scale.test.ts     axes 1,2,3 (+ broken-chain neg-control)
├── two-spine-interaction.scale.test.ts  axis 5 / Amendment F (induced bet-vs-void XOR)
├── side-bind.scale.test.ts              axis 4 / Q-1 (post + flip; no reply)
├── idempotency-dedup.scale.test.ts      axis 7 / Q-3 (DB backstop; Redis it.skip)
├── daily-credit-race.scale.test.ts      axis 8 (I-DAILY-ONCE)
├── freeze-under-load.scale.test.ts      axis 10 (freeze mid-storm)
├── reconciliation.scale.test.ts         axis 11 HEADLINE (+ leaked-snapshot neg-control)
└── money-math-determinism.scale.test.ts axis 11 (pure prorate + harness-driven D1)
```

**Holding for the web BUILD-review gate. PR is the next relay, after web clears ⓐ and ⓑ. Nothing about the green build changes.**
