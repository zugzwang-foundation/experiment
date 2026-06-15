# ENGINE.10 — EXECUTE session log

> The ENGINE-phase **EXIT gate**: a test/harness-only correctness-at-scale / reconciliation battery. Built to the ratified contract `docs/plans/ENGINE.10.md` (web gate PASS 2026-06-15; 3 Q-rulings + 4 amendments).
> **Date:** 2026-06-15 · **Author:** Claude Code (EXECUTE tab) + Hrishikesh (operator/relay) + web Claude (gate)

---

## What landed

- **Feature PR #131** — `feat/engine-10-scale` (off `origin/main` `96aed40`): the `tests/scale/` harness ONLY. 18 files, **2569 insertions, 0 `src/` change**.
  - `_harness/collide.ts` — barrier-synchronized bounded-pool collision driver (D≈32–64, one start-gate; `PromiseSettledResult[]`; recorded-only p50/p95 perf via `_harness/perf.ts`).
  - `_harness/reconcile.ts` — the HEADLINE reconciler: **two INDEPENDENT** global conservation derivations cross-checked (Amendment E) + per-user `walkLedgerChain` + live-DB `gatherSnapshot`.
  - `_harness/asserts.ts` — SPEC.2 §5 documented-terminal-error taxonomy on storm rejections (added at BUILD per `@code-reviewer` MEDIUM-2).
  - 8 `*.scale.test.ts` — hot-row (INV-1/2/3-axes 1,2,3), two-spine induced bet-vs-void XOR (INV-4 / Amendment F), side-bind (INV-3 / Q-1), idempotency (Q-3), daily-credit, freeze, reconciliation (HEADLINE), money-math (pure `prorate` + harness-driven D1).
  - Q-2 wiring: gated `pnpm test:scale` (`vitest.scale.config.ts`), excluded from the default `vitest run`.
- **Log PR (this branch)** — `chore/engine-10-execute-log` (off `origin/main`): `docs/logs/ENGINE.10-build-gate.md` (the full BUILD gate report — conservation residual `0`, clawback atomicity, both subagent reviews) + this session log.
- **Gate (local Postgres :54322):** `test:scale` 15 pass + 1 skip (flake-stable); cross-suite floor un-regressed (`test:invariants` 20, `test:integration` 103, default `vitest run` **873**); `ZUGZWANG_ENV=preview just verify` clean. Migration head **0015**, `EVENT_TYPES` **23** (unchanged). The SPEC.2 §3 rider shipped on the PLAN PR (#129/#130), not here.

## Decisions made

- **D1 ruling (web, BUILD):** money-math determinism gets a **harness-driven** assertion at scale, not just the pure-kernel reuse — a real concurrent settle fan-out via `collide` → the REAL `settleMarket` → assert the live `payout_events` legs conserve EXACTLY against the basis total. Shown RED (collide stubbed) → GREEN (wired). The pure `prorate` reuse (basis.property) stays alongside.
- **`@code-reviewer` restored on the harness (web):** even though ENGINE.10 is test-only, `collide.ts` + `reconcile.ts` CERTIFY the critical path, so their correctness is load-bearing — reviewed (sound, no CRITICAL/HIGH). `@security-auditor` ran the thesis-fence audit (zero findings). `@db-migration-reviewer` / `@test-writer` idle at BUILD.
- **Amendment E is the cross-check, not `d2ok`:** derivation #2's internal round-trip is algebraically tautological (honestly documented); the non-vacuous leak detector is `d1Total == d2Total` over two independently-computed totals, proven by the leaked-snapshot negative control. Left `d2ok` as a minor non-negativity guard.
- **Two PRs (feature + log), operator squash-merges FEATURE first** then log (canonical feature SHA backfilled into this log post-merge).

## Surprises caught + fixed in-session (§5.10)

1. **Open-market conservation formula was wrong** in the RED-authored hot-row test AND my first `gatherSnapshot` — both used the reserve-sum delta `(Y₀+N₀)−(Y+N)`, but a constant-product buy barely moves `Y+N` (Δ(Y+N) ≈ 0.099 for a stake of 10, not 10). **The cross-check caught it by going RED** (derivation #1's per-market checkers failed AND `d1Total ≠ d2Total` — a wrong shared *model* would have made both agree on a wrong value; instead they *diverged*, which is the cross-check working). Fixed both to the pool-cash formula `seed − (Y + Σ YES positions)` = production `void.ts:187`. Verified mathematically + empirically; residual now exactly `0`. → memory `project_cpmm_conservation_pool_cash_not_reserve_sum`.
2. **Two-spine flake (~40% of runs):** the test asserted the void task is always `fulfilled`, but the void's own W-3 tx can EXHAUST its 40001 retry budget under the 24-bet storm → `ResolutionSerializationExhaustedError` (a documented terminal error, never torn). Fixed to assert the **end-state** (`market.status === "Voided"`) via operator re-issue (`ensureVoided`), per the §7 flake-guard (assert end-state, never retry counts/outcomes). The induced race is still in the barrier; the XOR still holds. Stress-tested 10/10.
3. **Amendment-F window correction:** the plan cites the race window at `bets/transaction.ts:78–82`, but **those lines are the DOCSTRING**. The actual executable unlocked `markets.status` read is `assertMarketOpen` at **`bets/transaction.ts:223–239`**, invoked at **L121**. The test cites the real range. (Surfaced at opening recon; carried through.)

## Open questions / residuals (non-blocking)

- **MEDIUM-1 (documented):** `gatherSnapshot`'s `uncollectable` gather is global, not market-scoped (R-2 deferred — uncollectable rows carry `bet_id` NULL + no `market_id`). Correct while ≤1 market is corrected per snapshot; a 2nd correction would inflate `d1Total` → cross-check **false-FAILURE** (never a silent pass — fail-safe). Scope per-market when multi-correction scale coverage lands.
- **Clawback floors-at-zero = PASS-by-reuse** (the one §7 item with no dedicated scale test): the clawback/uncollectable write is atomic inside the SERIALIZABLE correction (`correct.ts` + `transaction.ts:126-143`, full rollback on retry → no double-uncollectable); `balance≥0` is the DB CHECK asserted pervasively at scale; the negative-driving path is covered by the cross-suite floor (`resolution-conservation` identity-ii + `conservation-correction`). Confirmed at the BUILD-review gate.

## Carry-forwards for the post-ENGINE.10 sweep

- **k6/staging 5k load stratum = next P0** (C-keep). The hard `p95 < 500ms @ 5k VUs` gate lands THERE (not folded into ENGINE.10). **Note:** local engineered-collision p95 already reached **486 ms** (sub-500 on the FORKS pool, no real network) — the staging latency gate is likely *real work*, not a formality. Mix ~90% audience / ~10% bettors + an adversarial high-writer scenario. Reply-as-bet **LOAD** (axis 6: 50Đ floor, Support/Counter aggregates) defers here, **post-DEBATE.2**.
- **ENGINE.15 + ENGINE.16 tracker rows do not exist — mint them**, plus the **ID-order errata** (ENGINE.16 conclusion-freeze ran BEFORE ENGINE.10). See memory `project_engine15_16_no_tracker_rows`.
- **`tracker_v12.html` ENGINE.10 row is stale** — still reads "10k bets / 100 markets", deps 8/9/12/13. Correct to the ratified **8-market / whole-engine / Option-C** scope (engineered collision, not 5k literal connections; perf recorded-not-gated). Mark the now-DONE engine rows (ENGINE.8/9/11/12/13/14/15/16/10) **DONE**.

## Next session starts at

The **post-merge relay**: after the operator squash-merges FEATURE #131 (first) then this log PR, (1) backfill the canonical feature squash-SHA into this log + the build-gate report, (2) run the post-ENGINE.10 sweep above (mint ENGINE.15/16 tracker rows + ID-order errata, correct the ENGINE.10 tracker row, mark DONE), (3) open the **k6/staging 5k load stratum** as the next P0. **Do NOT** start the sweep or any end-on-main / PK-staging before the merge.

## Context to preserve

- Branches: `feat/engine-10-scale` (#131, harness) + `chore/engine-10-execute-log` (this PR), both off `origin/main` `96aed40`. Repo auto-deletes merged head branches.
- Backup of the gate-green harness (byte-identical, md5-verified) is in the job tmp dir; the harness commit `f6545e1` is byte-identical to the reviewed version (no instrumentation residue).
- ENGINE.10 = ENGINE-phase EXIT. Correctness is gated; the 5k latency test is the immediate next P0 (operator-accepted tradeoff).

## Time

Single EXECUTE session, 2026-06-15: opening recon → RED-first (`@test-writer`) → BUILD (collide+reconcile wired) → `@code-reviewer` + `@security-auditor` → BUILD-review gate → PR.
