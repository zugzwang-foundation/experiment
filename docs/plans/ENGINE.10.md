# ENGINE.10 — Correctness-at-Scale Exit Gate (reconciliation/stress harness)

> **Ratified plan.** Test/harness-only deliverable: **no `src/`, no schema/migration, no new ADR.**
> Carries **one same-commit SPEC.2 §3 rider** (applied in this PR). A fresh chat executes the harness.

> **Status:** reviewed — web gate **PASS (2026-06-15)**, operator ratified (3 Q-rulings + 4 amendments + rider wording)
> **Date:** 2026-06-15
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** yes — exercises `src/server/{bets,dharma,resolution,positions,markets}` paths (CLAUDE.md §1)
> **Plan PR / commit:** this PR (plan + SPEC.2 rider, one commit)

---

## Context

ENGINE.10 is the **ENGINE-phase EXIT gate**. Every prior stratum is on disk and CI-green (P0 recon,
2026-06-14): ENGINE.8 bet handlers (#99), ENGINE.9 resolution trio (#114), ENGINE.11 positions (#91),
ENGINE.12 daily-credit (#104), ENGINE.13 initial grant (#110), ENGINE.14 lifecycle (#118), ENGINE.15
HTTP/cron/admin wiring (#122), ENGINE.16 conclusion-freeze read-guard (#127). HEAD `5c624c4`, migration
head `0015`, `EVENT_TYPES` 23. Existing coverage = **113 test files / ~873 runtime cases** (20 invariant
+ 103 integration + the CPMM/resolution property suites) — all at unit / single-flow / handler scope.

The gap ENGINE.10 fills is the seam none of those touch: **the whole engine under engineered-collision
concurrency, then a hard reconciliation that proves no Dharma was created or destroyed and no invariant
bent.** You load-test a system already *proven correct* — never the reverse.

Per operator ruling **Option C** (2026-06-15): ENGINE.10 is a **deterministic, CI-able, vitest-level
correctness-at-scale harness on local Postgres (`:54322`)** — the **hard exit gate**. Its "concurrency"
is **engineered collision**: force many writers onto the 8 hot pool rows to drive the worst-case
SERIALIZABLE retry path and assert correctness. It does **not** open 5k literal connections (local PG
can't, and it isn't meaningful) — that's k6's job. **Perf is recorded, not gated**; the hard
`p95 < 500ms @ 5k VUs` gate is **deferred to the immediate-next k6/staging load stratum** (C-keep —
promoted to top-of-queue, not vague "later").

---

## Web ratification (2026-06-15) — the rulings this plan encodes

**Web gate: PASS.** Three Q-rulings + four amendments + the SPEC.2 rider wording, all folded below.

| Item | Ruling (web-ratified 2026-06-15) | Folded into |
|---|---|---|
| **Q-1** | **Fence-first.** INV-3 side-bind via concurrent post-bets + sell/re-enter flips through `place()`/`sell()`. Reply-as-bet **LOAD** (50Đ floor + Support/Counter aggregates) **defers to the post-DEBATE.2 k6 stratum — NOT ENGINE.10**. **NEVER** call `place()` with a non-null `parentCommentId`. The side-bind *correctness* half is covered now; the reply-posting-*load* half is not. | §1 (2.3), §7 axis-4, §8 |
| **Q-2** | Separate **`test:scale`** script as its **own CI step** (keeps default `vitest run` fast). **Binding:** the ENGINE.10 exit gate requires **BOTH** the default suite green **AND** `test:scale` green — `test:scale` is a **NAMED REQUIRED gate component, not optional.** Exact CI trigger (all-PRs vs engine-path-filtered) is a Phase-2 detail; default to **≥ engine-path-touching PRs**. | §7, Exit criteria |
| **Q-3** | The **DB unique backstop (`bets.idempotency_key`)** is the **MANDATORY hard assertion** (always-available, deterministic). The endpoint **Redis SETNX** path is asserted **ONLY when a test Upstash is configured**, **gracefully skipped + logged** otherwise. **Plan-level constraint:** the hard exit gate must **NOT depend on local Upstash availability.** | §7 axis-7 |
| **Amendment E** | **§7 global conservation = TWO INDEPENDENT DERIVATIONS.** The execute chat MUST produce a **second, independent** derivation of the global "Dharma in == out" identity (**NOT** a scale-up of the per-market checker) and cross-check the two. Per-market-checker reuse = derivation #1; the independent re-derivation = derivation #2 and the safeguard. A subtly-wrong global formula would let the headline gate pass while hiding a leak — two derivations guard exactly that. **Binding execute-phase requirement.** | §7 (headline) |
| **Amendment F** | **§5/§7 two-spine race: INDUCE, don't happy-path.** The bet-during-resolution race is an **EXPLICIT HARD ASSERTION** in §7 (alongside the INV-4 row, not just a §5 line). Execute MUST genuinely induce the race — fire W-3 (resolution) while a W-1 bet is mid-flight at the **unlocked `markets.status` read window** (`bets/transaction.ts:78–82`) — and assert the **XOR**: commit-before-flip ⇒ in payout set; rejected-on-SSI-retry ⇒ not in payout set; **NEVER both, NEVER a torn payout.** A happy-path resolution check does **NOT** substitute. | §1 (2.4), §5, §7 |
| **Amendment D** | **§1/§7 bets-vs-sell write model (minor).** Sells are **NOT** `bets` rows (`bets.comment_id` NOT NULL + selling is the only comment-free action — confirmed `sell.ts:36–38,71–76`), so the INV-1 count-parity assertion is **scoped to commented POSTS**, and sell-driven Dharma movement is captured via the **LEDGER** (`FLOW_TAGS`, `bet_stake` POSITIVE, `bet_id` NULL), not `bets` rows. *Verified against schema at plan time; re-verify at execute.* | §1 (2.1), §7 |
| **SPEC rider** | Web-authored wording applied **verbatim** to SPEC.2 §3 (`:241`/`:300`/`:332`) + §0 patch bump `1.0.5 → 1.0.6` + new change-log row dated 2026-06-15. | this PR |

---

## The ratified stress-axis spine (the §5/§6/§7 build basis)

E10 = this harness asserts it (hard gate). k6 = the deferred staging load test.

| # | Axis | Owner | E10 disposition |
|---|---|---|---|
| 1 | Hot-row write contention on 8 pool rows (SERIALIZABLE + FOR NO KEY UPDATE + jitter) | E10+k6 | **In** — collision driver |
| 2 | INV-1 atomicity, concurrent commented bets via `place()` | E10 | **In** |
| 3 | INV-2 no-overdraft, concurrent near-zero-balance bets | E10 | **In** |
| 4 | INV-3 side-bind, concurrent post + flip | E10 | **In** — post-bets + sell/re-enter (reply half → Q-1, deferred) |
| 5 | INV-4 append-only, resolve/correct/void WHILE bets land (two-spine, **induced** — Amendment F) | E10 | **In** |
| 6 | Reply-as-bet posting load (50Đ floor, Support/Counter aggregates) | E10+k6 | **DEFERRED** — needs DEBATE.2 (Q-1) |
| 7 | Idempotency dedup under duplicate submits (RFC-8785 SHA-256, fail-closed) | E10 | **In** — DB backstop mandatory; Redis path optional (Q-3) |
| 8 | Daily-credit under first-bet-of-day concurrency (I-DAILY-ONCE) | E10 | **In** |
| 9 | Audience read load on hot markets while writes land (MVCC) | k6 (+E10) | **Partial** — read-after-write consistency only |
| 10 | Freeze read-guard under mixed traffic (writes→410, reads→200) | E10+k6 | **In** |
| 11 | Conservation/reconciliation at scale: global (**two derivations**, Amendment E) + per-market | **E10 — HEADLINE** | **In** |
| 12 | Throughput + p95 latency @ 5k VUs over real HTTP | k6 | **Recorded-only in E10** |

---

## Approach (one paragraph)

ENGINE.10 is **not a build** — it adds a deterministic vitest battery under a new `tests/scale/` tree
that (a) seeds 8 synthetic markets (each a hot pool row) into a throwaway local Postgres, (b) drives a
**barrier-synchronized collision storm** of concurrent writers through the *real* engine entry points
(`runBetEndpoint`→`place`/`sell`, `runResolutionTransaction`→`settle`/`correct`/`void`, the close-due
cron, ENGINE.16's freeze gate), and (c) after each storm runs a **hard reconciliation** that proves the
four invariants held, per-market + global Dharma conservation balances exactly (the global identity by
**two independent derivations**), the ledger chain is intact, and money-math is deterministic. The
interleaving is nondeterministic; **the asserted end state is deterministic** — that is what makes it
CI-able. Perf is captured as a recorded-only regression signal; the real latency gate is the next-P0 k6
stratum.

---

## 1. Thesis invariants touched

All four — **asserted at scale, not built.** The guarantees already exist (I-ATOMICITY-001 by ENGINE.7,
I-NO-OVERDRAFT-001 by ENGINE.5, I-SIDE-BIND-001 by ENGINE.8, I-APPEND-ONLY-001). ENGINE.10 proves they
hold under the worst-case retry path.

| Invariant | Touched | How the harness **ASSERTS** it under scale/concurrency | Concrete corruption each assertion catches |
|---|---|---|---|
| **2.1 Bet ↔ comment atomicity** (INV-1) | yes | After a collision storm of N concurrent `place()` calls: every committed `bets` row has a non-null `comment_id` + exactly one matching `comments` row (1:1, no orphans); count parity. **Amendment D:** count-parity is scoped to **commented POSTS** — sells write no `bets`/`comments` row (`sell.ts:36–38`), so they are excluded from the bet↔comment census and their Dharma is reconciled via the ledger instead. Driven via `place()` only (INV fence). | A torn write committing a bet without its comment under SSI retry. Asserts the **built** half (`bets.comment_id NOT NULL`, `place.ts:135`); does **not** assert the unbuilt `comments.bet_id NOT NULL` (nullable v1, DEBATE.8/9). |
| **2.2 Dharma non-transferable / no overdraft** (INV-2) | yes | Per-user ledger-chain walk over `(created_at, id)`: `balance_after[i] == balance_after[i-1] + amount[i]`, `>= 0` at every row, after many concurrent near-zero-balance bets. No user-↔-user flow exists by construction (no transfer tag in `FLOW_TAGS`). | A lost-update under collision letting balance go negative, or a broken `previousBalance` chain (two concurrent same-user appends reading the same stale balance). |
| **2.3 Side frozen at post-time** (INV-3) | yes | Concurrent post-bets on both sides + sell-out/re-enter-other-side flips: `comments.side_at_post_time` for every prior comment is unchanged after any later flip. **Q-1:** exercised via post-bets + flips through `place()`/`sell()`; **no reply endpoint, no non-null `parentCommentId`.** | A flip path that mutates a prior comment's frozen side, or a concurrent write reordering that drifts `side_at_post_time` from the bet's side at insert. |
| **2.4 Resolutions append-only** (INV-4) | yes | **Amendment F (induced, not happy-path):** fire resolve/correct/void **while bets land** at the unlocked `markets.status` read window (`bets/transaction.ts:78–82`). Assert: no UPDATE/DELETE on Bucket-A; a correction is a *new* event with `corrects_event_id`; **XOR** — a racing bet either commits-before-flip (in payout set) or is rejected on SSI-retry (not in payout set), **never both, never a torn payout.** | A bet racing a resolution that lands *after* the market flips and corrupts the settled set; or an in-place "fix" of a payout instead of an append. |

**Failure-mode specificity (critical-path, template §1):** if the §7 **global conservation** assertion
is missing (or its formula is subtly wrong — guarded by Amendment E's two derivations), an over-issuance
bug (Dharma minted from a double-accrual or a double-`bet_payout` under retry) ships undetected — each
single flow's unit test passes; only the cross-flow sum at scale catches the leak. If the
**ledger-chain** assertion is missing, a lost-update netting to a plausible balance ships. These two are
the load-bearing exit assertions.

---

## 2. Data model changes

**None — test/harness-only stratum.** No schema, no migration, no new event type. **Migration head stays
`0015`; `EVENT_TYPES` stays 23. `@db-migration-reviewer` is IDLE** (the harness writes no schema).

**Synthetic fixtures (not real market content — thesis fence + §3 refusal).** The 8 markets and their
"questions" are **synthetic placeholders** (e.g. `Synthetic Market 1..8`, placeholder resolution text) —
**never invented real market questions, criteria, or settlement dates** (those are Hrishikesh's, CLAUDE.md
§3). Fixtures live under `tests/scale/_fixtures/`.

**How direct-insert seeding does NOT bypass the invariants under test.** Setup state (8 markets in
`Open`, their seeded pools, granted balances) MAY be established by direct insert OR — preferred for
fidelity — through the **real** engine paths (`createMarket`/`openMarket` from ENGINE.14, `grantInitial`
from ENGINE.13). Either way the distinction holds: **the writes *under test* — every bet, sell, and
resolution in the storm — flow through the real engine entry points**, so the append-only triggers
(`0003`), `CHECK (balance_after >= 0)`, the unique partial indexes (`dharma_ledger_daily_allowance_day_uq`,
`dharma_ledger_initial_grant_user_uq`, `resolution_events_terminal_market_uq`, `bets.idempotency_key`),
the SERIALIZABLE wrappers, and the FK constraints all fire on the things being stressed. Seeding only
sets *preconditions*; it is never the subject of an assertion. The seeded `pools` reserve is recorded so
the conservation checker's `netAdminPoolInjection` operand is exact.

## 3. API surface

**None — exercises existing handlers.** The harness invokes the already-built entry points:
`runBetEndpoint` (`src/server/bets/endpoint.ts`) → `place`/`sell`; `runResolutionTransaction`
(`src/server/resolution/transaction.ts`) → `settle`/`correct`/`void`; the close-due cron
(`src/app/api/cron/close-due-markets/route.ts`); ENGINE.16's `isFrozen()` gate. No new endpoint,
Server Action, or route handler.

## 4. UI / user flow

**None — backend test stratum.**

## 5. Failure modes (the harness must *induce and survive* these — from axes 1–10)

| Failure mode | Induced by | Detect | Recover / assert |
|---|---|---|---|
| **40001/40P01 retry-storm under hot-row pile-up** (axis 1) | Barrier-launched concurrent writers on one pool row | Retry attempts logged by the W-1/W-3 wrappers | Every write either commits-correct or surfaces the documented terminal error (`bet_serialization_exhausted` / `resolution_serialization_exhausted`) — **never** a torn state. Assert end-state conservation regardless of retry count. |
| **Retry-budget exhaustion** (axis 1) | Collision degree high enough to exhaust the 1+3 ladder | The terminal product error | Assert it surfaces as the typed error (alarm-3 path), not a crash or a partial commit. |
| **Partial commit** (axes 1–5) | Any storm | Post-storm row-count + FK + 1:1 bet↔comment reconciliation | Assert atomicity: no half-written bet spine survives. |
| **Bet during close / freeze / resolve** (axes 5, 10 — **Amendment F: genuinely induced**) | Fire W-3 (resolve) / W-4 (close) / set `frozen_at` *while* W-1 bets land at the unlocked `markets.status` read window (`bets/transaction.ts:78–82`) | The two-spine interaction (W-1 reads `markets.status` UNLOCKED; W-3 locks markets first) | Assert the **XOR** (commit-before-flip ⇒ in payout set; rejected-on-SSI-retry ⇒ not), never both; freeze ⇒ writes 410, reads 200; no post-resolution bet in the payout set. |
| **Idempotency dup double-spend** (axis 7) | N concurrent identical submits (same Idempotency-Key + body) | Count of committed bet spines for the key | Exactly one spine; rest cached/409. Fail-closed. **DB unique backstop mandatory; Redis path optional (Q-3).** |
| **Floor-at-zero clawback** (axis 5) | `correct` storm driving balances negative | `uncollectable` rows | At most ONE `uncollectable` row per user per correction (F-RESOLVE-2); balance never < 0. |
| **Last-row-remainder non-determinism** (axis 11) | Large pro-rata fan-out | Re-run / golden-vector compare | Σ floored payouts + remainder == total exactly; remainder assignment reproducible (deterministic, max-UUID last row). |
| **Read-after-write staleness** (axis 9) | Read a market's price/positions immediately after a committed bet | Compare read projection vs committed state | The synchronous read-model reflects the just-committed write (no async lag in v1). |

## 6. Edge cases (concrete — from axes)

- Two+ users place bets on the **same pool row in the same barrier release** → both reconcile; the loser
  retries, never double-applies.
- User at balance exactly `= stake` (boundary) bets concurrently twice → exactly one succeeds; the other
  hits the friendly pre-check / `CHECK`.
- First-bet-of-UTC-day fired concurrently from one user → exactly one `daily_allowance` row
  (I-DAILY-ONCE; unique partial index backstop).
- Resolve fires the instant a bet's W-1 tx is mid-flight (**Amendment F**) → bet either commits-before-flip
  (in payout set) or is rejected by the retried status re-read (not in payout set); never both, never torn.
- Void a market with **partially-sold** positions → refund `= f × stake`; sale proceeds stand;
  conservation holds.
- Correction that would drive a user negative → truncate at balance + single `uncollectable` remainder.
- `frozen_at` set mid-storm → in-flight committed writes stand; all *new* writes 410; reads 200; cron
  returns 200 `{status:"frozen"}` and does no work.
- Market with **zero** bets resolved/voided → terminal event + `poolUnwindAmount` only; conservation
  degenerates cleanly (no division-by-zero in prorate).
- **Sell attribution (Amendment D):** a sell's `dharma_ledger` row carries `bet_id` NULL **and no
  `market_id`** (`sell.ts:71–76`); per-market conservation must attribute sell `bet_stake` flows via the
  `bet.sold` event's `payload.marketId` / `aggregateId`, not the ledger row. The **global** identity
  (Amendment E) is attribution-independent — the robust headline. *Verify the per-market sell-attribution
  query at execute.*

## 7. Test plan — THE CORE

**Layout (new tree).** `tests/scale/` (a top-level peer of `tests/invariants/`):

```
tests/scale/
├── _fixtures/      8 synthetic markets + seeded pools + user cohorts (placeholder content)
├── _harness/
│   ├── collide.ts        barrier-synchronized concurrent driver (bounded pool, start-gate)
│   └── reconcile.ts      derivation #1 (composes src/server/dharma/conservation.ts checkers)
│   │                     + derivation #2 (independent global re-derivation — Amendment E)
├── hot-row-contention.scale.test.ts     axes 1,2,3
├── two-spine-interaction.scale.test.ts  axis 5 — INDUCED bet-during-resolve/close (Amendment F)
├── side-bind.scale.test.ts              axis 4 (post + flip; no reply endpoint — Q-1)
├── idempotency-dedup.scale.test.ts      axis 7 (DB backstop mandatory; Redis optional — Q-3)
├── daily-credit-race.scale.test.ts      axis 8
├── freeze-under-load.scale.test.ts      axis 10
├── reconciliation.scale.test.ts         axis 11 — HEADLINE (two derivations)
└── money-math-determinism.scale.test.ts axis 11 (floor-18 + last-row remainder)
```

**Methodology — engineered collision (the crux of "deterministic + CI-able").**
- A **bounded** worker pool (collision degree D ≈ 32–64, **not** 5k) released by a single **start
  barrier** (`Promise.all` over pre-built tasks gated on one resolve) so workers hit the same hot pool
  row in the tightest window → maximizes 40001 frequency → exercises the full-jitter retry ladder.
- Bounded write count per storm (≈ low hundreds per market) so the battery runs in a **CI-acceptable
  budget** (a few minutes total) as its own `test:scale` step (Q-2).
- **Nondeterministic schedule, deterministic assertions.** Assert **end-state invariants**, **never**
  retry counts or interleaving order.
- Writes-under-test go through the **real** engine paths; only fixtures are seeded.

### HARD assertions (the exit gate — all must pass; both default suite AND `test:scale` green, Q-2)

| Assertion | Mechanism / reuse |
|---|---|
| **Per-market conservation** (all 8) | `checkMarketConservation({ ledgerFlows, netAdminPoolInjection })` → `ok:true` per market; corrections via `checkCorrectedMarketConservation(...)` (`src/server/dharma/conservation.ts`, identity ★ over `FLOW_TAGS`). Sell flows attributed via the `bet.sold` event (Amendment D). |
| **GLOBAL conservation — HEADLINE, TWO INDEPENDENT DERIVATIONS (Amendment E)** | **#1** composes the per-market checkers + a global SQL aggregation. **#2** is an *independent* re-derivation of "Dharma in == out" — Σ latest `balance_after` reconciles to Σ issuance (`initial_grant` + `daily_allowance`) net of pool-unwind exits (`poolUnwindAmount`) + `uncollectable` forgiveness — derived **separately** (not a scale-up of #1) and **cross-checked equal**. A mismatch fails the gate. (Extends `tests/integration/resolution-conservation` + `dharma-ledger` to 8-market scale; reuses the identity, does not reinvent it for #1.) |
| **INV-1 atomicity** | 1:1 bet↔comment, no orphans, count parity **scoped to posts** (Amendment D); `bets.comment_id NOT NULL` (built half) |
| **INV-2 no-overdraft + chain** | window-function walk: `balance_after = prev + amount`, `>= 0` everywhere |
| **INV-3 side-bind** | prior `side_at_post_time` immutable across flips (post-bets + sell/re-enter; no reply endpoint — Q-1) |
| **INV-4 append-only + two-spine XOR (Amendment F)** | no UPDATE/DELETE Bucket-A; correction = new event; **induced** bet-during-resolution race asserts the XOR (commit-before-flip XOR rejected-on-retry; never both/torn) — a happy-path resolution does NOT substitute |
| **Clawback floors-at-zero** | ≤1 `uncollectable`/user/correction; balance ≥ 0 (F-RESOLVE-2 `clawback-floors-at-zero`) |
| **Idempotency dedup (Q-3)** | exactly one committed spine per key. **MANDATORY:** the `bets.idempotency_key` DB unique backstop (always-available, deterministic). **OPTIONAL:** the endpoint Redis SETNX path, asserted only when a test Upstash is configured, **gracefully skipped + logged** otherwise. The hard gate must **not** depend on local Upstash. |
| **Daily-credit once** | ≤1 `daily_allowance`/user/UTC-day under first-bet race (`I-DAILY-ONCE-001` + unique partial index) |
| **Money-math determinism** | Σ floored payouts + last-row remainder == total exactly; reproducible (max-UUID last row) — `src/server/resolution/basis.ts` `prorate`; reuses `tests/unit/resolution/basis.property` |
| **Freeze write-seal** | post-`frozen_at`: bet endpoints → 410, reads → 200, cron → 200 `{status:"frozen"}`, **zero** new write rows (ENGINE.16 `isFrozen()`) |
| **Resolution acceptance at scale** | settle/void happy paths hold across 8 markets — pinned `resolution-settles-and-locks`, `full-refund-and-pool-unwind` |

### Perf — RECORDED, NOT GATED

- Capture a **local per-tx latency signal** (p50/p95 over the storm) and emit a **summary artifact**
  (printed + JSON under the run dir).
- **No CI assertion on latency.** An egregious number (documented threshold) is a **manual escalation to
  the founder**, never an auto-fail.
- **The hard `p95 < 500ms @ 5k VUs` gate is the k6/staging stratum** (immediate next P0). Local numbers
  do not predict staging/Vercel — they are a *regression tripwire* only.

**Critical-path coverage check:** every "touched" invariant in §1 has ≥1 HARD assertion above. ✔

## 8. Out of scope

- **Building SCAFFOLD.9 / the k6 harness**, and the **hard p95 staging gate** — the next-P0 k6 stratum
  (C-keep).
- **The DEBATE lane (INV fence):** DEBATE.1 commentless-bet 400 guard, DEBATE.3 composer side-freeze,
  DEBATE.2 reply/image endpoints. ENGINE.10 drives INV-1 via `place()` (top-level, `parentCommentId:
  null` — the only branch the built endpoint runs), **never** a comment/reply endpoint and **never** a
  non-null `parentCommentId` (that pre-tests DEBATE.2's unbuilt validation).
- **Reply-as-bet *load*** (axis 6: 50Đ reply floor, Support/Counter aggregates) — needs DEBATE.2; defers
  to the post-DEBATE.2 k6 stratum (Q-1). The side-bind *correctness* half is covered now.
- **100-market scale-out** (optional later), **HARDEN** items, **TESTING.14/15**, design lane,
  Testnet/Mainnet, any **real market content**, any **`src/` change** (incl. a global-conservation helper
  in `src/` — reconciliation logic lives in `tests/scale/_harness/`).
- **Admin participation / moderation bypass / un-freeze / ledger mutation** — the harness *asserts* these
  are impossible; it never performs them (thesis fence).

---

## Open questions

**Q-1, Q-2, Q-3 — RESOLVED at the web gate (2026-06-15); see the ratification table above.** Remaining
genuine residuals (Phase-2 mechanics, none blocking):

- **R-1:** exact `test:scale` CI trigger filter (all-PRs vs engine-path-touching). **Candidate:**
  ≥ engine-path-touching PRs (Q-2 default). **Resolve with:** Phase 2 / CI wiring.
- **R-2:** per-market sell-attribution query shape (sells carry no `market_id`/`bet_id` on the ledger row
  — attribute via the `bet.sold` event). **Candidate:** join through `events` by `aggregateId`/`payload.marketId`;
  the global identity (Amendment E) is the attribution-independent backstop. **Resolve with:** Phase 2 /
  verify against schema at execute.
- **R-3:** collision degree D + per-storm write count tuning to hit the CI-time budget while reliably
  triggering 40001. **Candidate:** D≈32–64, low-hundreds writes/market; tune empirically. **Resolve
  with:** Phase 2.

## ADRs needed

**None.** ENGINE.10 is a test stratum; it sets no new architectural pattern, commits to no new
dependency, and changes no CLAUDE.md §10 default. (The `test:scale` CI step from Q-2 is a justfile/CI
convention, not an ADR.)

---

## Self-critique (Phase-1 self-review, 2026-06-15)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **high** | Axis table lists reply-as-bet (4/6) as E10, but the INV fence forecloses DEBATE.2 and `place()` runs only the top-level branch — silently "covering" it would pre-test unbuilt DEBATE work. | Surfaced as **Q-1**; web ruled fence-first. INV-3 via post-bets + flips; reply-bet *load* deferred. Not silently absorbed. |
| 2 | **medium** | "Global conservation" headline but the existing `src/` checker is **per-market** only — risk of implying a new `src/` helper, or of a subtly-wrong global formula passing the gate. | §7 pins the global aggregator to **`tests/scale/_harness/reconcile.ts`** (no `src/` change); **Amendment E** mandates a second independent derivation + cross-check. |
| 3 | **medium** | "5k concurrency" could be misread as 5k local connections. | §Approach + §7 pin **engineered collision (D≈32–64)**; 5k is the **k6** target, deferred. |
| 4 | **medium** | A scale battery bundled into default `vitest run` would balloon PR CI. | **Q-2** → gated `test:scale` step (named required gate component). |
| 5 | **medium** | A happy-path resolution check would NOT prove the two-spine race is safe. | **Amendment F** elevates it to an INDUCED hard XOR assertion. |
| 6 | **low** | Idempotency assertion that depends on local Upstash would flake / be non-portable. | **Q-3** → DB unique backstop mandatory; Redis path optional + skipped-with-log. |
| 7 | **low** | Determinism risk: asserting on retry counts/interleaving would flake. | §7 methodology: assert **end-state invariants only**. |
| 8 | **low** | Synthetic fixtures could drift into inventing real market content (§3 refusal). | §2 pins **placeholder** content only. |
| 9 | **low** | Asserting `comments.bet_id NOT NULL` would be wrong (nullable v1, specs-ahead). | §1 asserts only the **built** INV-1 half (`bets.comment_id NOT NULL`). |
| 10 | **low** | Sell rows (`bet_id`/`market_id` NULL on the ledger) could break per-market attribution silently. | **Amendment D** + §6/§7: attribute sells via the `bet.sold` event; global identity is attribution-independent; verify at execute. |

INV-fence adherence: ✔ · scope discipline: ✔ (no `src/`/migration/ADR; one SPEC.2 §3 doc rider) ·
assertion completeness: ✔ (every §1 invariant has a §7 HARD assertion) · edge enumeration: ✔ (§6 from
axes 1–10).

---

## Exit criteria + sequencing

- **DONE = the HARD reconciliation/correctness battery green** on local Postgres (`tests/scale/`),
  with **BOTH** the default `pnpm vitest run` suite **AND** the new `pnpm test:scale` green (Q-2 —
  `test:scale` is a named required gate component), plus `just verify` and the standing critical-path
  gates (`pnpm test:invariants` + `pnpm test:integration`, the cross-suite floor). **Green = ENGINE.10
  done = ENGINE-phase EXIT.**
- **Perf recorded** (artifact emitted); no perf gate here.
- **On green, the post-ENGINE.10 sweep mints:** (1) the **k6/staging 5k load stratum as the next P0**
  (C-keep; hard p95 gate lands there; mix ~90% audience / ~10% bettors + an adversarial high-writer
  scenario); (2) the **ENGINE.15 + ENGINE.16 tracker rows** (no tracker rows exist for them) + the
  **ID-order errata** (ENGINE.16 ran before ENGINE.10).
- **Operator-accepted tradeoff (recorded):** ENGINE exits with **correctness gated**, the **5k latency
  test as the immediate next P0** — not folded into ENGINE.10.

---

## Verification (execute)

1. **RED first (§5.6):** author `tests/scale/` via `@test-writer`; the battery fails on assertions
   before any harness wiring.
2. Build the collision driver + reconciler → battery **GREEN** on local Postgres.
3. **Critical-path gate:** `pnpm test:invariants` + `pnpm test:integration` + full `pnpm vitest run` +
   the new `pnpm test:scale` — all green. Needs **local Postgres** (`open -a Docker` + `supabase start`;
   pass the committed test `DATABASE_URL` inline for the DB-backed specs).
4. `ZUGZWANG_ENV=preview just verify` (typecheck → biome → build).
5. **Pre-PR self-audit (§5.10)** item-by-item against this plan; then `@code-reviewer` is **idle** (no
   `src/` diff) and `@db-migration-reviewer` is **idle** (no migration) — the audit is the test-harness's
   own pass against the §7 assertion list.

**ADR-needed: NO.**

---

## References

- `CLAUDE.md` §2 (invariants), §3 (refusals), §4 (push-back), §5 (workflow) — the contract this plan respects.
- `AGENTS.md` §6 (Drizzle/Postgres), §9 (testing layout) — stack patterns.
- `docs/specs/SPEC.1.md` §10.3/§11 F-RESOLVE-1/2/3 (settled v1.0.3); §12.1 freeze.
- `docs/specs/SPEC.2.md` §3 (W-1/W-3 patterns; ENGINE.10 rider applied this PR), §3.6 (resolution fan-out), §9 / §2247 (gating map — the ENGINE.10 "full-invariant stress test" anchor).
- `src/server/dharma/{conservation,tags}.ts` (reconciliation primitives reused — derivation #1).
- `src/server/bets/{endpoint,transaction,place,sell}.ts`; `src/server/resolution/{transaction,settle,correct,void,basis}.ts`; `src/server/system/is-frozen.ts`.
- `docs/logs/ENGINE.{8,9,11,12,13,14,15,16}.md` — predecessor strata.
- P0 recon (this chat, 2026-06-14/15).
- Tracker: ENGINE.10 (EXIT). ADRs: 0013 (concurrency), 0014/0015 (moderation/idempotency), 0016 (UUIDv7), 0017/0018 (reply-as-bet / two-floor).
