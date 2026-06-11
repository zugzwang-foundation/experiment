# ENGINE.9 — Resolution trio (settle / correct / void) + F-ADMIN-3 trigger

> **Status:** Founder-ratified 2026-06-11 (R-9.1..R-9.8 + R-9.5e + E-1 + C-1..C-7 +
> OQ-1..OQ-7 ratifications + review defects D-1 (incl. the D2-A extension) / D-2 / D-3
> + micro-folds F-1..F-4 folded) — Phase P commit. Docs-only plan; execute = fresh CC
> session + fresh web chat (§5.8).
> **Task:** the resolution stratum — `src/server/resolution/` (greenfield, S1-proven):
> F-ADMIN-3 trigger (`Closed → Resolving`, `market.resolving` mint), F-RESOLVE-1 settle
> (`Resolving → Resolved`, gross winner payouts, pro-rata basis, pool unwind exits
> circulation), F-RESOLVE-2 correct (clawback floored at zero, uncollectable model A,
> corrects-chain), F-RESOLVE-3 void (`Open|Closed → Voided`, f×stake refunds). Four
> terminal emits, four §19.4.1 rows, migrations 0014 (constraints + terminal-once
> index) and 0015 (drift-function zero-terminal fix), the W-3 sibling wrapper, the
> conservation correction-variant, `I-RESOLVE-ONCE-001`. Critical-path money + events
> + schema — full ritual, Ultrathink-mandatory.
> **Base:** `main` @ `28a8305` (ENGINE.13 execute merged #110/#111). S1 sync-gate 7/7
> PASS · S2 recon 8/8 · round-1 review: identities (♦)/(i)/(ii)/(iii) independently
> re-derived and verified exact · round-2 review: D2-A extension verified, F-1..F-4
> ratified (2026-06-11).

---

## Context

ENGINE.9 is the most pre-wired stratum in the repo. Three shipped surfaces name it as
their consumer: `persist.ts:58-62` ("the caller MUST chain via the prior call's
returned `balanceAfter` (live case: **ENGINE.9 reverse+uncollectable pair**)"),
ADR-0013 §5.12 P1 ("**Consumer:** ENGINE.9's outstanding per-user serialization
obligation for resolution writes (`persist.ts` D-2) must slot into this same order"),
and `transaction.ts:79-82` (W-1 deliberately never locks `markets` because "a `pools →
markets → …` order risks deadlock vs **W-3 resolution's `markets → …`**" — the lock
slot this plan consumes). The schema halves are built and Bucket-A protected
(`resolution_events` + `payout_events`, S2 finding 5); the six `market.*` event types
are registered with zero emit sites (S2 finding 1); the ENGINE.4 state machine is pure
and unpersisted — **ENGINE.9's status writes are the first `markets.status` writes in
the codebase**.

Two S2 SURPRISEs were closed by founder ruling: the per-bet settlement basis after
sells (R-9.8 pro-rata) and the unwind encoding (R-9.5e payload field). One S2
observation (`Resolving → Voided` absent) is ratified as intended (R-9.3). One
editorial conflict (§6.1 vs shipped §15 mapping) is ruled E-1. The review rounds
additionally surfaced that the floor-to-zero clawback interacts with BOTH halves of
0011's chain-integrity detector (D-1, extended) — fixed by migration 0015 under the
same-commit doctrine.

Binding precedence: SPEC > ADR > tracker > kickoff. All rulings below are
founder-ratified 2026-06-11, **binding, not reopenable by this plan**.

## §Rulings — founder-ratified payload (verbatim-faithful; binding)

- **R-9.1 — Resolution note.** The criterion-met evidence note is mandatory and
  immutable on F-RESOLVE-1 — the resolve is where the note matters; correction and void
  keep their already-required reasons, no added ceremony. Schema effect:
  `resolution_events.reason` → NOT NULL for all three kinds (current SPEC.2 B.9 "NULL
  for F-RESOLVE-1" is drift — exactly backwards). Riders pin SPEC.1 §11 (F-RESOLVE-1
  System text) + SPEC.2 B.9.
- **R-9.2 — Losing-side settlement form.** Losers get a `payout_events` row with
  `amount = 0` (the settlement is recorded) and NO `dharma_ledger` row. The SPEC.1
  "dharma_delta = 0 or −S per A2 form" ambiguity is closed to 0; the −S form is struck
  (stake already debited at bet time — −S at resolution would double-debit). Winners:
  one `payout_events` row + one positive `bet_payout` ledger row at the gross
  shares-settle value (shares × 1 Đ = S/p). SPEC.1 §10.3's net math (+S(1−p)/p win /
  −S loss) holds exactly as net outcomes. Rider pins the SPEC.1 §11 wording.
- **R-9.3 — "All shall be resolved."** A correction can never flip a market to VOID —
  corrected outcomes are YES/NO only, encoded as a hard constraint (validation + the
  schema CHECK, which rides — §Migration). Void stays what it is: a pre-resolution exit
  (state ∈ {Open, Closed}). Correction-of-a-correction stays structurally possible (the
  `corrects_event_id` chain is the safety valve; admin discipline governs). Correction
  deadline is structural: nothing after the 2026-11-05 23:59 UTC freeze (the freeze
  blocks all writes; no extra mechanism in ENGINE.9).
- **R-9.4 — Deadline ceiling, no buffer.** `resolution_deadline ≤ 2026-11-05 23:59 UTC`
  is a ceiling validated at market creation (SPEC.1 §12.1 / B8, no extensions) —
  resolution is rolling through the window as criteria settle, NOT same-day-for-all. No
  mandated time buffer between Close and resolve: the admin may trigger and resolve the
  moment a market is Closed; the transaction lock ordering + state preconditions do the
  safety work ("in-flight bet window has cleared" is discharged structurally, not
  temporally — the discharge argument is §Wrapper (b), stated in full).
- **R-9.5 — Pool unwind exits circulation.** Residual pool Dharma is recorded as a
  pool-unwind events record (`metadata.actor_id = 'admin-singleton'`), never a
  `dharma_ledger` row (ledger is user-only, ENGINE.5 R-2). There is no admin balance;
  the Dharma exits circulation, visibly. Rider fixes SPEC.1's "back to admin account"
  wording (§11 F-RESOLVE-1 + F-RESOLVE-3, and the §10.7 echo).
- **R-9.5e — Encoding addendum.** The unwind record rides as a `poolUnwindAmount`
  payload field on the terminal `market.resolved` / `market.voided` events row
  (`metadata.actor_id = 'admin-singleton'`) — NOT a dedicated `pool_unwind` event type.
  Satisfies "recorded as an events row" with one terminal emit per flow, per the
  shipped schemas.ts contract. Rider adjusts SPEC.2 §3.6's "records the pool_unwind as
  an events row" wording to name the payload-field form; the registered Zod payloads
  for `market.resolved` / `market.voided` gain the field same-commit.
- **R-9.6 — No cascade unwind (accepted with eyes open).** Corrections claw back
  floored at zero; spent phantom winnings become `uncollectable` (amount ≤ 0,
  balance_after = previous, ENGINE.5 model A — bespoke sign-guard discipline);
  downstream bets stand; comments stay locked through correction. Accepted manipulation
  surface; mitigations this plan preserves: single-admin path, the immutable correction
  chain in the public dataset, `uncollectableTotal` surfaced in the correction
  response, conservation accounting carrying uncollectable explicitly — the loss is
  visible, never silent.
- **R-9.7 — Scope split.** ENGINE.9 = the resolution trio (`settle.ts`, `correct.ts`,
  `void.ts` emitting `market.resolved` / `market.corrected` / `market.voided` + their
  three §19.4.1 STRIP rows, same-commit) plus F-ADMIN-3 trigger (`Closed→Resolving`) as
  the resolution entry point. **ENGINE.14 — Market lifecycle writes** is minted for
  F-ADMIN-1 create, F-ADMIN-2 seed/open (+ dormant `pool_seed` activation), the close
  transition, the other three `market.*` emits + their STRIP rows; ENGINE.10 + UI.6
  gain ENGINE.14 as a dep. The mint itself is sweep work (tracker is sweep-owned); this
  plan records the boundary in §Out of scope.
- **R-9.8 — Settlement basis after sells: pro-rata** (closes S2 SURPRISE 1). Sells
  decrement positions only; no sale-to-bet attribution exists (`bet.sold` betId is
  synthetic). At settlement, the surviving fraction `f = positions.quantity /
  Σ(same-side bets' share_quantity)` applies UNIFORMLY to every same-side bet of that
  user: surviving shares per bet = `f × share_quantity`; F-RESOLVE-1 winner payout per
  bet = `f × share_quantity × 1Đ`; F-RESOLVE-3 refund per bet = `f × stake` (sale
  proceeds stand — the sale was a real trade; full-stake refund would over-refund
  sellers). Exact-sum rounding: deterministic last-row-remainder ordered by bet id, so
  per-bet amounts sum exactly to the position-level truth. Corollary: a fully-sold bet
  (f = 0) settles with a 0-amount `payout_events` row and NO ledger row — matching
  SPEC.2 §3.6's "one dharma_ledger row per NON-ZERO settlement". Corrections reverse
  what was RECORDED in the original `payout_events` rows, never a recomputation. Riders
  pin SPEC.1 §10.3 (per-bet math holds exactly for unsold bets; pro-rata note added) +
  B.8 amount semantics.
- **E-1 — Editorial (web-lane ruled).** SPEC.1 §6.1's Closed→Resolving bullet ("400
  error_market_closed_at" for post-trigger bets) loses to the shipped §15 mapping: 409
  `market_resolving` (`errors.ts:254-256`). Rider fixes the §6.1 prose.

## Review results folded (rounds 1–2 + founder ratifications — binding, 2026-06-11)

- **D-1 — drift-function fix corrected (and extended; round-2 VERIFIED).** Round-1's
  0015 formula (`Z − L <> 1`) was DEFECTIVE: in a valid chain `Z − L = 1 − [terminal
  row sits at 0]`, so it false-alarms any chain currently parked at zero — exactly the
  just-floored user between correction and their next credit. Corrected clause:
  `(Z − L) NOT IN (0, 1)` (relaxed cardinality), residual blind spot documented.
  **Extension:** the SAME terminal-at-zero condition also false-alarms shipped
  **D2-A** (`sink_count <> 1` fires when the genesis consumption absorbs the terminal
  zero and no net=+1 sink exists) — including the parked-at-zero and
  spend-to-zero-and-stop fixtures. Round-2 verified this against the merged ENGINE.11
  log's shipped form; round-1's "(b) clean under shipped 0011" parenthetical is
  retracted. Migration 0015 corrects BOTH halves; full algebra in §Migration.
- **D-2 (round-2 fold F-1):** residual blind-spot (1) reframed — a fabricated genesis
  appended to a terminal-at-zero chain is multiset-identical to legitimate history and
  invisible to EVERY order-free check by construction (the same fundamental limit as
  the cycle case, not a separate one). §Migration carries the corrected text.
- **D-3 (round-2 fold F-2):** fix-validation matrix corrected — the round-1 formula
  PASSES case (c) (`Z − L = 1` there); cell flipped to "clean".
- **M-1:** execute-ritual step (1) was stale — the plan doc merges via the Phase P
  plan PR; the execute pair starts from a `main` that already carries the merged plan,
  referencing it via `@docs/plans/ENGINE.9.md` (§Execute ritual reflects this).
- **M-2 (round-2 fold F-3, re-sent after truncation):** S4's no-recomputation fixture
  induces divergence SYNTHETICALLY — a real sell between resolve and correct is
  product-impossible (W-1 coarse gate); §Test plan S4 carries the wording.
- **F-4 (nit):** corrected D2-A's zero-sink SQL branch uses `COALESCE(sn.s, 0) = 0` —
  NULL-sum robustness noted in §Migration.
- **OQ-1 RATIFIED:** `statement_timeout` parameterised — default 1_000 (W-1 mirror),
  fan-out flows (settle/correct/void) pass 5_000; co-located decision-parameter style.
- **OQ-2 RATIFIED:** correction updates `markets.resolution_outcome` to the corrected
  side (status + `resolved_at` untouched) — read-model projection of the chain tip.
- **OQ-3 RATIFIED:** same-as-tip corrected outcome → `CorrectionOutcomeError`.
- **OQ-4 RATIFIED:** rider R-B resolves SPEC.1's "`admin_events` log" to the SPEC.2
  §3.6 events-row form.
- **OQ-5 RATIFIED as RIDE:** migration 0015 rides ENGINE.9 (same-commit doctrine),
  with the D-1-corrected formula (both halves).
- **OQ-6:** stays record-only (§Carry-forwards — ENGINE.10/HARDEN).
- **OQ-7 RATIFIED, BROADER FORM:** partial UNIQUE index on `resolution_events
  (market_id) WHERE event_kind IN ('resolve','void')` — "a market terminates exactly
  one way, once" — riding 0014, plus the `I-RESOLVE-ONCE-001` invariant spec and a
  wrapper-bypass 23505 test. The markets lock serializes clean concurrent settles
  (40001 retry), so the index is **belt-vs-bugs only — never a user-facing 23505**.

## Architect constraints folded (C-1..C-7 — binding)

C-1 (two-tx trigger + `market.resolving` mint, inventory 22→23), C-2 (W-3 lock order
`markets → pools → users` consuming the reserved slot; both arguments stated in
prose), C-3 (sibling wrapper, lean mirror, zero shared extraction — §Wrapper; the
`statement_timeout` parameterisation is the one ratified deviation, OQ-1), C-4
(per-bet winner ledger rows, chained; per-user reverse+uncollectable pair;
earliest-affected-bet anchor), C-5 (shipped ★ untouched; correction variant as sibling
pure function; three derivations in full), C-6 (one constraints migration: reason NOT
NULL + kind↔outcome CHECK + corrects-link CHECK + per-type sign CHECKs + the OQ-7
terminal-once index; both leans ACCEPTED), C-7 (two payout legs per bet, zero legs
included; reversal from recorded rows).

## Approach (one paragraph)

Four service functions in greenfield `src/server/resolution/` — `triggerResolution`,
`settleMarket`, `correctResolution`, `voidMarket` — each one SERIALIZABLE transaction
through a new W-3 sibling wrapper (`runResolutionTransaction`) that mirrors the W-1
spine (retry on 40001/40P01, full-jitter 50/100/200, SET LOCAL timeouts, `.cause`-first
SQLSTATE extraction) but locks `markets` FIRST (`FOR NO KEY UPDATE`), then `pools`,
consuming the lock-order slot W-1 reserved; the per-flow state gate runs on the LOCKED
markets row against the ENGINE.4 graph. Trigger flips `Closed → Resolving` and emits
the newly-minted `market.resolving` (payload: marketId only). Settle gates `Resolving`,
fans out per R-9.2/R-9.8 (gross winner ledger rows chained per user via
`previousBalance`; losers and fully-sold bets get 0-amount `payout_events` rows only),
records the unwind as the winning-side reserve in the terminal `market.resolved`
payload (R-9.5e), and writes `markets` → `Resolved` + `resolved_at` +
`resolution_outcome`. Correct gates `Resolved`, reverses the chain-tip's RECORDED
positive legs per user floored at zero (one `correction_reverse` ledger row of
`−min(R,B)` per user + the model-A `uncollectable` remainder row — the documented
pair), applies the corrected side per-bet, appends the `corrects_event_id` chain, and
projects `markets.resolution_outcome` (OQ-2). Void gates `Open|Closed`, refunds
`f × stake` per bet, and unwinds the residual cash (derived `reserves + positions`,
cross-asserted both sides). Positions are NEVER touched (drift-D1 compatibility);
pools reserves are never zeroed (the unwind is a recorded exit, and the untouched
reserve IS the audit source); comments are never touched (locking is emergent — S2
finding 8). Migration 0014 hardens the schema (constraints + the terminal-once belt);
migration 0015 corrects 0011's two zero-terminal false-positive clauses (D-1, both
halves) so the mandated zero-alarms drift charter is achievable.

## The wrapper (`src/server/resolution/transaction.ts` — NEW)

**Signature:**

```ts
export type ResolutionFlow = "F-ADMIN-3" | "F-RESOLVE-1" | "F-RESOLVE-2" | "F-RESOLVE-3";

export interface LockedMarket {
  id: string;
  status: MarketStatus;
  resolutionOutcome: "YES" | "NO" | "VOID" | null;
}

export async function runResolutionTransaction<T>(
  args: {
    marketId: string;
    flow: ResolutionFlow;
    expectedStatus: readonly MarketStatus[];   // per-flow gate, on the LOCKED row
    lockPool: boolean;                         // trigger=false; settle/correct/void=true
    statementTimeoutMs?: number;               // default 1_000 (W-1 mirror); fan-out flows pass 5_000 (OQ-1)
  },
  callback: (ctx: { tx: DbTransaction; market: LockedMarket; pool: LockedPool | null }) => Promise<T>,
): Promise<T>
```

- **Lock order (C-2, consumes the reserved slot):** `SELECT … FROM markets WHERE id =
  $1 FOR NO KEY UPDATE` FIRST, then (if `lockPool`) the pool row by `market_id` `FOR NO
  KEY UPDATE`, then the callback's writes. Global order **markets → pools → positions →
  dharma_ledger → events**, preserving ADR-0013 §2 + §5.12 P1 (`pools → users`) as a
  suffix. Recorded as **ADR-0013 §5.12 P2 patch record** (same-commit).
- **No-cycle argument (a), stated for re-derivation:** W-1 acquires `pools` first and
  NEVER locks `markets` (its status read is deliberately unlocked —
  `transaction.ts:79-82`). W-3 acquires `markets` then `pools`. A lock cycle needs two
  paths acquiring the same two locks in opposite orders; `markets` is locked by W-3
  only, so no path acquires `pools → markets`. Within the suffix both wrappers observe
  `pools → users` (P1). Cross-market same-user W-3/W-1 contention lands on
  `users`/`dharma_ledger` rows as retryable 40001 (consistent order ⇒ never 40P01),
  exactly the P1 shape.
- **Structural discharge of "in-flight window has cleared" (b — R-9.4):** The trigger
  precondition is `Closed`: by the time any resolution action exists, W-1's coarse gate
  (`status !== "Open"` → `MarketNotOpenError`, `transaction.ts:236-238`) already
  rejects every NEW bet, and the gate is conservative (the fine F-BET-6 window is
  deferred — `transaction.ts:83-85`). Remaining race: a W-1 tx that read `Open` in its
  snapshot and is STILL uncommitted when settle/void runs. The pool lock is the fence —
  that W-1 tx holds the pool row, so settle/void's `lockPool` BLOCKS until it commits
  or aborts; settle/void then reads `bets`/`positions` AFTER acquiring the lock and
  sees the committed bet. A W-1 tx that has NOT yet reached its pool lock blocks behind
  settle/void instead; when it proceeds, SSI detects the rw-antidependency (its
  unlocked status read vs our status write; its bet INSERT vs our `bets` read-set) and
  aborts one side with 40001 — W-1 retries, re-reads `Voided`/`Resolved`, and fails the
  gate cleanly. **Void on an Open market races live bets — this same fence argument
  covers it**: every refunded-bet set is exactly the committed set under the pool lock;
  no bet can commit unrefunded after void commits. Trigger itself needs no pool lock:
  it writes nothing the fence protects (status + one events row), and the `Closed`
  precondition means no W-1 traffic gates open.
- **Retry spine (C-3, mirrored verbatim from W-1):** bases `[50, 100, 200]` ms full
  jitter, retry on `40001`/`40P01` only, `.cause.code`-first extraction, Sentry
  breadcrumb per retry, exhaustion → `captureMessage("resolution_serialization_exhausted",
  { tags: { sqlstate, flow } })` + `ResolutionSerializationExhaustedError`. SET LOCAL
  `idle_in_transaction_session_timeout = 30_000` mirrored; **`statement_timeout`
  parameterised per OQ-1 (RATIFIED)** — default 1_000 (W-1 value; trigger uses it),
  settle/correct/void pass 5_000 (the fan-out's batched INSERTs over thousands of bets
  can exceed W-1's single-row budget; a 57014 abort mid-settle is a stranded-Resolving
  operator event). Values remain ADR-0013-style decision parameters co-located in the
  module; HARDEN re-tunes.
- **Retry purity:** all four flows mint their `event_id` at handler entry and close
  over it (ADR-0016 D1); `resolution_events.id` / `payout_events.id` / ledger ids are
  DB-default `uuidv7()` read via `RETURNING` — tx-scoped, safe under full rollback.
- **Zero shared-helper extraction (C-3 lean, stated):** `fullJitter`, `sleep`, and
  `retryableSqlstate` are duplicated (~20 lines) into the W-3 module. Extracting them
  would EDIT `src/server/bets/transaction.ts`; the constraint is W-1 stays untouched.
  Nothing else is extractable without behavior coupling. W-1 diff in this PR: **zero
  lines**.

**Errors (`src/server/resolution/errors.ts` — NEW, ENGINE.7 statics pattern):**
- `ResolutionSerializationExhaustedError` — statics `httpStatus 503`, `code
  "error_resolution_serialization_exhausted"`, `retryAfterSeconds 1`, carries
  `{ sqlstate, flow }`.
- `ResolutionStateError` — carries `{ flow, expected: MarketStatus[], observed:
  MarketStatus }`; NOT retried (no SQLSTATE). Wire mapping is ENGINE.10's.
- `CorrectionOutcomeError` — R-9.3 + OQ-3 (RATIFIED): corrected outcome must be
  YES/NO AND must differ from the chain tip's outcome.
- Defensive plain throws (missing market/pool row, basis sum mismatch, negative
  unwind, cash cross-assert failure) — caller/economics bugs, non-retryable, loud.

## The four flows (tx shape · lock order · write order · emit)

Shared: every flow takes `(args, { metadata })` with the event id(s) minted at handler
entry; `metadata.actor_id = 'admin-singleton'`, `metadata.user_id = NULL` (SPEC.2 §3.7
— admin actor); `aggregate_type "market"`, `aggregate_id = marketId`. **No `dharma.*`
emits and no per-payout events** — SPEC.2 §3.6 / `schemas.ts:105`: "per-bet payouts are
rows in the `payout_events` TABLE, not generic events (D-B reversed pre-merge)"; ONE
terminal events row per flow.

### W-3a — `trigger.ts` · `triggerResolution({ marketId, triggerEventId, metadata })` (F-ADMIN-3)

One tx, `expectedStatus: ["Closed"]`, `lockPool: false`, default statement timeout.
1. Wrapper: lock `markets`, gate `Closed` (the flow additionally calls ENGINE.4
   `transition(observed, "Resolving")` and maps `!ok` → `ResolutionStateError` — the
   §6.1 graph stays the single legality source; the wrapper gate is the fence, the
   graph is the law).
2. `UPDATE markets SET status = 'Resolving' WHERE id = $1 AND status = 'Closed'`
   (belt; rowCount 0 under the lock = impossible → plain throw).
3. `insertEvent(tx, { eventType: "market.resolving", payload: { marketId }, … })` —
   payload is marketId ONLY (C-1): outcome/evidence live on `resolution_events` per
   R-9.1, never duplicated.
Returns `{ marketId, status: "Resolving" }`. Trigger is irreversible (no
`Resolving → Voided` edge — R-9.3); stranded-`Resolving` recovery = invoke settle
(double-trigger fails `illegal_edge`). F-ADMIN-3's "Response: Resolution event ID" is
produced by the COMPOSED admin endpoint (trigger → settle, two txs back-to-back —
ENGINE.10); the winning side + evidence captured on the admin form pass through to
`settleMarket`, not to the trigger tx.

### W-3b — `settle.ts` · `settleMarket({ marketId, winningSide, reason, settleEventId, metadata })` (F-RESOLVE-1)

One tx, `expectedStatus: ["Resolving"]`, `lockPool: true`, `statementTimeoutMs: 5_000`.
`winningSide ∈ {YES, NO}` (service guard); `reason` non-empty (R-9.1).
1. Wrapper: lock `markets` → gate → lock `pools` (fence, §Wrapper b).
2. Read all `bets` for the market (`id, user_id, side, stake, share_quantity`),
   ordered by `id`; read all `positions` for the market.
3. **Pure basis (R-9.8, §Basis):** per (user, winning side): per-bet surviving payout
   via `prorate` — total = the position row's `quantity` (absent row ⇒ 0), weights =
   each bet's `share_quantity`. Losing-side and `f = 0` bets → amount 0.
4. `INSERT resolution_events (market_id, event_kind 'resolve', outcome = winningSide,
   corrects_event_id NULL, reason) RETURNING id` — reason NOT NULL post-0014; the
   terminal-once index (OQ-7) makes a duplicate terminal row a loud 23505
   belt-vs-bugs (unreachable through the gate).
5. `INSERT payout_events` — **one row per bet in the market** (R-9.2 + §3.6
   uniformity), `payout_type 'bet_payout'`, `amount` per basis (0 for losers and
   fully-sold), `resolution_event_id` from step 4. Batched, ordered (user_id, bet id).
6. **Ledger (C-4):** per user ordered by user id: `readBalance(tx, userId)` once, then
   one chained `appendLedgerRow(tx, { entryType: "bet_payout", amount: <recorded
   payout>, betId: <bet id>, previousBalance })` per NON-ZERO bet, threading the
   returned `balanceAfter` — the `>1 row per user per tx` contract (`persist.ts:58-62`).
   Producer sign guard: amount strictly positive (§Sign table).
7. `UPDATE markets SET status='Resolved', resolved_at = now(), resolution_outcome =
   winningSide WHERE id = $1 AND status = 'Resolving'`.
8. **Unwind (R-9.5/R-9.5e):** `poolUnwindAmount := pool.yesReserves` if YES wins else
   `pool.noReserves` — the winning-side reserve of the LOCKED pool row. No `pools`
   write; no ledger row; no admin account. Why this equals the residual:
   §Conservation (i), step 6.
9. Terminal emit: `insertEvent(market.resolved, payload { marketId, winningSide,
   resolutionNote: reason, poolUnwindAmount })`.
Returns `{ resolutionEventId, winningSide, totalPaidOut, poolUnwindAmount }`
(`totalPaidOut = Σ` step-5 amounts `= Σ` winning-side position quantities).
**Positions are NOT touched** — derived constraint: 0011's D1 replays `Σ bet.placed −
Σ bet.sold` from events and compares to `positions.quantity` with no market-status
awareness; zeroing positions at settlement would fire `position_drift` nightly for
every resolved market. Resolved-market positions are historical records.
**Comments are NOT touched** — locking is emergent (S2 finding 8).

### W-3c — `correct.ts` · `correctResolution({ marketId, correctedSide, reason, correctEventId, metadata })` (F-RESOLVE-2)

One tx, `expectedStatus: ["Resolved"]`, `lockPool: true`, `statementTimeoutMs: 5_000`.
1. Wrapper locks + gate.
2. **Chain tip (order-free):** the market's `resolution_events` row whose `id` appears
   in no other row's `corrects_event_id` — under the 0014 corrects-link CHECK and the
   Resolved gate, exactly one exists and its kind ∈ {resolve, correct} (a `void` tip
   is unreachable: void ⇒ status Voided ⇒ gate rejects).
3. `correctedSide` must be YES/NO **and ≠ tip.outcome** (OQ-3, RATIFIED) — else
   `CorrectionOutcomeError` (R-9.3).
4. **Recorded entitlements (R-9.8 corollary — never recomputed):** read
   `payout_events WHERE resolution_event_id = tip.id AND amount > 0`; per user
   `R_u = Σ amount` (these are `bet_payout` rows for a resolve tip, `correction_apply`
   rows for a correction tip). Per bet: `recorded_b`.
5. Read bets + positions; **apply basis** for `correctedSide` via the same `prorate`.
6. `INSERT resolution_events (kind 'correct', outcome = correctedSide,
   corrects_event_id = tip.id, reason) RETURNING id` (the terminal-once index ignores
   `correct` kinds — the chain stays open).
7. `INSERT payout_events` — **TWO rows per bet in the market** (C-7, zero legs
   included): `correction_reverse` `amount = −recorded_b` (0 where no recorded
   entitlement) and `correction_apply` `amount = apply_b` (0 off the corrected side /
   f = 0).
8. **Ledger — the documented reverse+uncollectable pair (C-4), per user ordered by
   user id, fully chained:**
   a. `B_u := readBalance(tx, userId)`; `C_u := min(R_u, B_u)`.
   b. if `C_u > 0`: ONE `correction_reverse` row, `amount = −C_u` → `balance_after =
      B_u − C_u` (exactly 0 when floored). Per-bet reverse rows are IMPOSSIBLE here —
      chaining them walks the balance through intermediate negatives and
      `DharmaOverdraftError` fires mid-walk; the per-user aggregate is the only
      chain-safe floored form. **Anchor `betId` = the user's earliest affected bet id
      (min UUID) in this market** — C-4: per-market conservation gathering keys on
      `bet_id → bets.market_id`; a NULL anchor would be invisible. Same anchor for (c).
   c. if `R_u > B_u`: ONE `uncollectable` row, `amount = −(R_u − B_u)` (≤ 0, model A:
      `balance_after = previous` — the shipped `ledger.ts:57-63` guard is the only
      defense, A9), same anchor `betId`.
   d. per non-zero `correction_apply` bet: chained positive rows, `betId` = that bet.
   (Single-side makes reverse and apply disjoint per user in practice; the code
   handles both within the user block regardless.)
9. `UPDATE markets SET resolution_outcome = correctedSide WHERE id = $1` — status and
   `resolved_at` untouched (OQ-2, RATIFIED: read-model projection of the chain tip).
10. Terminal emit: `market.corrected` payload `{ marketId, correctsEventId: tip.id,
    correctedWinningSide: correctedSide, resolutionNote: reason }` (registered shape,
    unchanged).
Returns `{ correctionEventId, betsAffected, uncollectableTotal }` —
`uncollectableTotal = Σ (R_u − B_u)⁺` surfaced per R-9.6. Comments do not unlock
(emergent lock is status-based; status unchanged).

### W-3d — `void.ts` · `voidMarket({ marketId, reason, voidEventId, metadata })` (F-RESOLVE-3)

One tx, `expectedStatus: ["Open", "Closed"]`, `lockPool: true` (**load-bearing** on
Open — §Wrapper b fence), `statementTimeoutMs: 5_000`.
1. Wrapper locks + gate (+ ENGINE.4 `transition(observed, "Voided")`).
2. Read bets + positions.
3. **Refund basis (R-9.8):** per (user, held side): `T_u = floor18(quantity ×
   Σ stakes / Σ share_quantity)` over that user's held-side bets, distributed per-bet
   by `prorate` (weights = `stake_i`, total = `T_u`) — refund per bet `= f × stake_i`
   with exact-sum remainder. Sold-out sides: f = 0, refund 0 — **sale proceeds stand**.
4. `INSERT resolution_events (kind 'void', outcome 'VOID', corrects NULL, reason)` —
   the terminal-once index covers this kind too ("a market terminates exactly one way,
   once").
5. `INSERT payout_events` — one `void_refund` row per bet (zero legs included).
6. **Ledger:** per user, chained `void_refund` rows per non-zero bet (`betId` = bet
   id; strictly positive, §Sign table).
7. **Unwind:** `cash := pool.yesReserves + Σ(YES positions.quantity)`; cross-assert
   `cash == pool.noReserves + Σ(NO positions.quantity)` exactly (both equal `seed +
   Σ stakes − Σ proceeds` — §Conservation (♦); mismatch = economics bug → plain throw,
   Sentry-loud). `poolUnwindAmount := cash − Σ refunds`; defensive assert ≥ 0.
   (Assumes the symmetric seed `Y₀ = N₀` implied by the single `seedAmount`; recorded
   as a carry-forward for ENGINE.14 — an asymmetric seed breaks the cross-assert
   loudly, not silently.)
8. `UPDATE markets SET status='Voided', resolution_outcome='VOID', resolved_at =
   now() WHERE id = $1 AND status IN ('Open','Closed')`.
9. Terminal emit: `market.voided` payload `{ marketId, voidReason: reason,
   poolUnwindAmount }`.
Returns `{ voidEventId, betsRefunded, poolUnwindAmount }`. SPEC.1's "written to
`admin_events` log" is superseded by the SPEC.2 §3.6 events-row form — `admin_events`
has ZERO writers on disk; rider R-B fixes the prose (OQ-4, RATIFIED).

## The basis module (`src/server/resolution/basis.ts` — NEW, pure)

```ts
export function prorate(args: {
  rows: readonly { id: string; weight: string }[];  // weight: bets.share_quantity or bets.stake
  total: string;                                    // position-level truth (18-dp string)
}): { id: string; amount: string }[]
```

- Sort by `id` ascending (UUIDv7 — stable, deterministic; NOT chronological, which is
  irrelevant here).
- Rows `1..n−1`: `amount_i = floor18(total × weight_i / Σ weights)` — the division is
  computed exactly at CpmmDecimal precision 50 per row (never materialize a rounded
  scalar `f`; rounding compounds).
- Row `n`: `amount_n = total − Σ amount_{1..n−1}` — the deterministic
  last-row-remainder (R-9.8). Floors under-allocate, so `amount_n ≥` its exact share
  `≥ 0`; defensive assert ≥ 0.
- Invariants: `Σ amounts == total` EXACTLY (string-decimal); every amount ≥ 0;
  `total = 0` ⇒ all zeros; empty rows ⇒ requires total = 0 (else throw — caller bug).
- All arithmetic CpmmDecimal (precision 50, ENGINE.5 constructor), canonical 18-dp
  outputs; no floats anywhere (CLAUDE.md §2).

Settle uses `prorate(weights = share_quantity, total = position quantity)`; void uses
`prorate(weights = stake, total = T_u)`. Property-tested (fast-check) for the exact-sum
and non-negativity invariants.

## Ledger sign discipline at the resolution sites (C-4)

Producer-owned per `ledger.ts:38-39`; ENGINE.9 enforces at its write sites (the
`validateCreditAmount` precedent), with 0014 CHECKs as the storage mirror on
`payout_events` (ledger rows are additionally floored by the shipped overdraft guard):

| entry_type | ledger sign (rows written only when ≠ 0) | payout_events sign (zero legs legal) | enforced at |
|---|---|---|---|
| `bet_payout` | > 0 strictly | ≥ 0 | settle producer guard + 0014 CHECK |
| `correction_reverse` | < 0 strictly (−min(R,B)) | ≤ 0 | correct producer guard + 0014 CHECK |
| `correction_apply` | > 0 strictly | ≥ 0 | correct producer guard + 0014 CHECK |
| `void_refund` | > 0 strictly | ≥ 0 | void producer guard + 0014 CHECK |
| `uncollectable` | ≤ 0 (model A; `balance_after = previous`) | — (never a payout row) | shipped `ledger.ts:57-63` (the ONLY defense — A9) |

A blanket `amount >= 0` CHECK is wrong (C-6): SPEC.1's "negative of original" makes
`correction_reverse` signed. The 0014 CHECK is per-type (§Migration).

## Conservation — the three identities, derived in full (C-5 / L-E5.1; review-verified)

**Sign conventions on disk** (`tags.ts` / `sell.ts` [R4] / this plan): `bet_stake` buy
= −S (debit); `bet_stake` sell = +P (proceeds credit, `sell.ts:73`); `bet_payout` = +;
`void_refund` = +; `correction_reverse` = −; `correction_apply` = +; `uncollectable`
excluded from (★), carried explicitly in (ii); issuance rows (`bet_id` NULL
`initial_grant`/`daily_allowance`) excluded by gathering.

**Mechanics premise (verified against `cpmm/calculate.ts:57-101`):** a buy of stake S
adds S to BOTH reserves and removes `floor18(s_exact)` shares from the bought side —
every Đ in mints one YES+NO share-pair, with sub-18-dp dust retained INSIDE the
bought-side reserve. A sell returns shares and removes proceeds P from both sides.
Therefore, at every instant, exactly:

```
pairs := seed + Σ stakes − Σ proceeds            (one pair per Đ in, destroyed per Đ out)
Y + H_yes = pairs = N + H_no                      (♦ — the cash identity)
```
where `Y`/`N` are the pool reserves and `H_side = Σ positions.quantity` on that side
(buy on YES: `Y` loses exactly `floor18(s)` while `H_yes` gains it, and both sides
gain S → both sums grow by exactly S; sell symmetric; symmetric seed `Y₀ = N₀ = seed`,
`H = 0`). The dust never leaks: (♦) is EXACT in recorded 18-dp quantities.

### (i) Resolve — `seed + Σ stakes − Σ proceeds − Σ winner payouts − unwind = 0`

1. Winner payouts (R-9.2 gross form + R-9.8 basis): per user, `Σ per-bet payouts =
   position quantity` exactly (prorate's exact-sum invariant). Summed over winners:
   `Σ payouts = H_W` — the winning side's total held shares, at 1 Đ each.
2. Unwind (settle step 8) `:= W-side reserve = Y_W`.
3. By (♦): `Y_W + H_W = seed + Σ stakes − Σ proceeds`.
4. Substitute 1 and 2 into 3:
   `unwind + Σ payouts = seed + Σ stakes − Σ proceeds`
   ⇔ **`seed + Σ stakes − Σ proceeds − Σ payouts − unwind = 0`**. ∎
5. Ledger-side restatement: `Σ FLOW = −Σ stakes + Σ proceeds + Σ payouts = seed −
   unwind` (directly from 4). The shipped checker closes it as
   `checkMarketConservation({ ledgerFlows, netAdminPoolInjection: seed − unwind })` —
   **(★) untouched** (C-5).
6. This is also WHY settle's unwind is read off the winning reserve: it equals the
   residual by (♦), with zero rounding gap — payouts total the positions truth and the
   dust sits in the reserve.

*Worked check (symmetric seed 100, k = 10⁴):* Alice buys 100 YES → reserves (50, 200),
Alice 150 YES. Bob buys 100 NO → reserves (150, 66.67), Bob 233.33 NO. Cash = 300 =
150 + 150 (Y + H_yes) = 66.67 + 233.33 (N + H_no) ✓. Resolve YES: payouts = 150,
unwind = Y = 150; check: 100 + 200 − 0 − 150 − 150 = 0 ✓. Σ FLOW = −200 + 150 = −50 =
seed − unwind = 100 − 150 ✓.

### (ii) Correction — (i) extended; the uncollectable term explicit and visible

Definitions (all from RECORDED rows, never recomputed — R-9.8 corollary):
`reverseRec := Σ |correction_reverse payout_events legs| = Σ_u R_u`; `applyRec := Σ
correction_apply payout_events legs = H_W′`; `U := Σ_u (R_u − B_u)⁺` (the
uncollectable magnitudes, = −Σ uncollectable ledger amounts).

1. Ledger reverse rows per user: `−C_u = −min(R_u, B_u)`; summed: `−Σ C_u =
   −(reverseRec − U)`.
2. Ledger apply rows: `+applyRec`.
3. Post-correction flow sum:
   `Σ FLOW = [−Σ stakes + Σ proceeds + Σ pay_W] + [−(reverseRec − U)] + [applyRec]`
   `       = (seed − unwind) − reverseRec + applyRec + U`
   (the bracket is (i).5; `Σ pay_W = reverseRec` when the tip is the original resolve;
   for a correction tip the same telescoping holds one link deeper).
4. **Identity (ii): `Σ FLOW == (seed − unwind) − reverseRec + applyRec + U`** — the
   uncollectable loss U is a named, visible, additive term (R-9.6): exactly the
   over-issuance the floor created relative to a perfect clawback. With no correction
   it degenerates to (i). ∎

*Worked check (continuing):* correct YES→NO. Alice's recorded 150 reversed; she has
spent down to 40 → C = 40, U = 110. Bob applied 233.33. Σ FLOW = −200 + 150 − 40 +
233.33 = 143.33. RHS = (100 − 150) − 150 + 233.33 + 110 = 143.33 ✓.

**Sibling checker (S2 option b — C-5):** new export in `src/server/dharma/conservation.ts`,
the shipped function body untouched:

```ts
export function checkCorrectedMarketConservation(args: {
  ledgerFlows: readonly { amount: string; entryType: DharmaEntryType }[]; // FLOW rows ONLY
  netAdminPoolInjection: string;     // seed − unwind, from recorded values
  reverseRecordedTotal: string;      // Σ |correction_reverse| payout legs (≥ 0)
  applyRecordedTotal: string;        // Σ correction_apply payout legs (≥ 0)
  uncollectableTotal: string;        // Σ |uncollectable| ledger rows (≥ 0) — EXPLICIT
}): ConservationResult
```
Same A9 defensive canonicalization; pool tags throw (`DharmaPoolTagError`);
`uncollectable` rows in `ledgerFlows` THROW `DharmaInputError` ("pass the total
explicitly") — explicitness over tolerance: the loss is a named operand, never an
absorbed row (R-9.6). Gathering stays argument-fed at test level; the production
gathering query is out of scope (§Carry-forwards).

### (iii) Void — refunds replace payouts; (★) closes it unchanged

1. Per user refund total `T_u = f_u × Σ stakes_u` (prorate-exact); per bet `f × stake`.
2. `unwind := cash − Σ refunds`, with `cash = Y + H_yes (= N + H_no)` per (♦) — read
   under the pool lock, cross-asserted.
3. `Σ FLOW = −Σ stakes + Σ proceeds + Σ refunds = −(cash − seed) + (cash − unwind)`
   `= seed − unwind` — (★) closes with the SHIPPED checker, no variant needed. ∎
4. **No-sells special case:** `Σ proceeds = 0`, every `f = 1` ⇒ `Σ refunds = Σ stakes`
   EXACTLY, `cash = seed + Σ stakes`, `unwind = seed` — the admin's seed comes back
   out, whole, and exits circulation. The acceptance test pins both equalities.

## Events vocabulary (EDIT `src/server/events/schemas.ts`)

- `EVENT_TYPES` 22 → **23**: insert `"market.resolving"` between `market.closed` and
  `market.resolved` (lifecycle order; set semantics, placement cosmetic); domain
  comment `(6)` → `(7)`, annotations extended with "+ ENGINE.9 (resolving)".
- New payload schema: `"market.resolving": z.object({ marketId: z.string().uuid() })`.
- `"market.resolved"` payload gains `poolUnwindAmount: numericString` (R-9.5e).
- `"market.voided"` payload gains `poolUnwindAmount: numericString` (R-9.5e).
- `"market.corrected"` unchanged. Considered-and-dropped: `resolutionEventId` on
  `market.resolved` — the `resolution_events` table is the chain source; lean wins.
- Same-commit set (C-1, the §19.4.1 foot-rule): inventory test `.toBe(22)` → `.toBe(23)`
  + membership list + the four §19.4.1 rows (rider R-I).

## Schema + migrations

**EDIT `src/db/schema/events.ts`:** `reason: text("reason").notNull()`; the three
`check(...)` constraints on `resolutionEvents` + one on `payoutEvents` (drizzle
`check()` — the `positions_quantity_non_negative` precedent); the terminal-once
partial `uniqueIndex` (OQ-7 — the `positions_one_held_side_idx` precedent).

**NEW `drizzle/migrations/0014_resolution_constraints.sql`** (via `just db-generate
resolution_constraints`; index 0014 re-verified at execute per F-2a — head today is
`0013_initial_grant_user_unique.sql`; both tables EMPTY, plain ALTERs safe):

```sql
ALTER TABLE "resolution_events" ALTER COLUMN "reason" SET NOT NULL;                  -- R-9.1
ALTER TABLE "resolution_events" ADD CONSTRAINT "resolution_events_kind_outcome_check"
  CHECK ((event_kind IN ('resolve','correct') AND outcome IN ('YES','NO'))
      OR (event_kind = 'void' AND outcome = 'VOID'));                                -- R-9.3
ALTER TABLE "resolution_events" ADD CONSTRAINT "resolution_events_correct_link_check"
  CHECK ((event_kind = 'correct') = (corrects_event_id IS NOT NULL));                -- R-9.3
ALTER TABLE "payout_events" ADD CONSTRAINT "payout_events_amount_sign_check"
  CHECK ((payout_type = 'correction_reverse' AND amount <= 0)
      OR (payout_type <> 'correction_reverse' AND amount >= 0));                     -- C-6
CREATE UNIQUE INDEX "resolution_events_terminal_market_uq"
  ON "resolution_events" ("market_id")
  WHERE event_kind IN ('resolve','void');                                            -- OQ-7
```
Both C-6 leans ACCEPTED (CHECKs ride; producer guards duplicate app-side; per-type
sign form replaces the blanket `>= 0` that `correction_reverse` falsifies). The
terminal-once index is **belt-vs-bugs only**: the markets lock + state gate serialize
clean concurrent settles as 40001 retries; a 23505 from this index is always a logic
bug, surfaced loud (ENGINE.12 R3 / ENGINE.13 P2 loud-failure policy — never caught to
"recover").

**NEW `drizzle/migrations/0015_nightly_drift_zero_terminal_fix.sql`** (hand-written
`CREATE OR REPLACE FUNCTION check_nightly_drift()`, full body re-stated, D1/D3
untouched; 0011 itself is append-only and not edited — the 0007→0011 function-replace
precedent; same-commit doctrine, OQ-5 RATIFIED as RIDE):

**The defect, derived (D-1, corrected and extended).** Notation per user: each ledger
row r has `ip(r)` (implied_prev: `ba − amount`, or `ba` for uncollectable) and `ba(r)`
(balance_after). A valid chain `r1..rn` has `ip(r1) = 0` (genesis) and `ip(r_{i+1}) =
ba(r_i)`.

*D2-B genesis cardinality.* Let `Z := count(ip = 0)` and `L := count(ba = 0)`:

```
Z = 1 + #{ i < n : ba(r_i) = 0 }          (genesis, plus every row chained off a zero balance)
L = #{ i < n : ba(r_i) = 0 } + [ba(r_n) = 0]
⇒ Z − L = 1 − [terminal row sits at 0]    — legitimate values {0, 1}
```
The shipped clause (`count(ip = 0) <> 1`, i.e. `Z <> 1`) false-alarms every chain that
EVER touched zero (R-9.6 floors land there by construction; latent today via
spend-to-exactly-zero). Round-1's proposed `Z − L <> 1` false-alarms every chain that
currently ENDS at zero — the just-floored user parked between correction and next
credit. **Corrected clause:**

```sql
HAVING count(*) FILTER (WHERE implied_prev = 0)
     - count(*) FILTER (WHERE balance_after = 0) NOT IN (0, 1)
```

*D2-A sink — the extension (round-2 verified).* The same terminal-at-zero condition
breaks the shipped sink clause. Multiset identity for a valid chain: `multiset(ip) =
multiset(ba) − {ba(r_n)} + {0}`, so per value v, `net(v) := count(ba = v) −
count(ip = v) = [v = ba(r_n)] − [v = 0]`:
- terminal ≠ 0 → `net(terminal) = +1` (the unique sink), `net(0) = −1`, all else 0 —
  the shipped check (`sink_count = 1 AND sink = Σ non-unc amounts`) is correct;
- terminal = 0 → the genesis consumption absorbs the terminal zero: ALL nets are 0,
  **no net=+1 sink exists**, and `Σ non-unc amounts` (which telescopes to the terminal
  balance) `= 0`. Shipped `sink_count <> 1` FIRES — a false alarm on every
  parked-at-zero user, including the spend-to-zero-and-stop case (clean under shipped
  D2-B but NOT under shipped D2-A). **Corrected firing condition:**

```sql
WHERE NOT (   (s.sink_count = 1 AND s.sink_val IS NOT DISTINCT FROM sn.s)
           OR (s.sink_count = 0 AND COALESCE(sn.s, 0) = 0) )
```
The `COALESCE` guards the zero-sink branch against a NULL sum: an all-uncollectable
chain is product-impossible (every user's first row is the grant), and the shipped
`sum_nonunc` CTE already COALESCEs — but the SQL must not rely on NULL propagation
(F-4).

*Residual blind spots, stated (accepted — drift detection is belt, storage triggers +
app logic are primary):* (1) a fabricated genesis row (implied_prev = 0, i.e. amount =
balance_after; or an uncollectable row at balance 0) appended to a chain whose
terminal sits at 0 yields Z − L = 1 AND the valid net pattern — it is
multiset-identical to a legitimate credit-after-zero history and therefore invisible
to EVERY order-free check by construction (the same fundamental limit as the cycle
case below, not a separate one). Corrected D2-A catches a duplicate genesis only when
it produces a second net=+1 sink (terminal ≠ 0) — where corrected D2-B fires anyway
(Z − L = 2). A fabricated row whose amount ≠ balance_after is not a genesis at all
(implied_prev ≠ 0) and is caught by D2-B's edge-link clause (i). The most plausible
concrete source, a duplicate initial_grant, is independently foreclosed by
dharma_ledger_initial_grant_user_uq (0013). (2) a fabricated balance-neutral CYCLE of
rows (each member's `ip` = another's `ba`, telescoping to 0) is invisible to ALL
order-free multiset checks — D2-B's edge-link clause (i) is satisfied within the
cycle, nets stay 0. This is the fundamental limit of order-free verification
(ADR-0016 Driver 7 forbids `created_at` ordering reliance — tx-frozen `now()`; UUIDv7
trailing-bit randomness forbids id ordering); accepted and documented in the migration
comment.

*Fix-validation matrix (each case = an I2 fixture):*

| Chain | shipped D2-A | shipped D2-B | round-1 0015 | corrected 0015 |
|---|---|---|---|---|
| normal, terminal ≠ 0 | clean | clean | clean | clean |
| spend to exactly 0, STOP (b) | **false alarm** | clean | **false alarm** | clean |
| spend to 0, later credit (c) | clean | **false alarm** | clean | clean |
| floored clawback, parked at 0 (a) | **false alarm** | **false alarm** | **false alarm** | clean |
| floored clawback + later apply/credit | clean | **false alarm** | clean | clean |
| duplicate genesis, terminal ≠ 0 | fires ✓ | fires ✓ | fires ✓ | fires ✓ (B; A via sum) |
| broken link (ip ≠ 0, no predecessor) | — | fires ✓ (clause i, untouched) | fires ✓ | fires ✓ |

## File plan (CLOSED diff-stat set — anything outside = surface, don't absorb)

| File | Kind | Content |
|---|---|---|
| `src/server/resolution/transaction.ts` | NEW | W-3 wrapper: locks, gates, retry spine, parameterised timeouts |
| `src/server/resolution/errors.ts` | NEW | exhaustion / state / correction-outcome errors |
| `src/server/resolution/trigger.ts` | NEW | F-ADMIN-3 `triggerResolution` |
| `src/server/resolution/settle.ts` | NEW | F-RESOLVE-1 `settleMarket` |
| `src/server/resolution/correct.ts` | NEW | F-RESOLVE-2 `correctResolution` |
| `src/server/resolution/void.ts` | NEW | F-RESOLVE-3 `voidMarket` |
| `src/server/resolution/basis.ts` | NEW | pure `prorate` + per-flow basis assembly + producer sign guards |
| `src/server/dharma/conservation.ts` | EDIT (additive) | sibling `checkCorrectedMarketConservation`; shipped (★) body untouched |
| `src/server/events/schemas.ts` | EDIT | `market.resolving` + 2 × `poolUnwindAmount`; counts |
| `src/db/schema/events.ts` | EDIT | `reason` NOT NULL + 4 CHECKs + terminal-once uniqueIndex |
| `drizzle/migrations/0014_resolution_constraints.sql` | NEW | constraints + terminal-once index DDL |
| `drizzle/migrations/0015_nightly_drift_zero_terminal_fix.sql` | NEW | hand-written `CREATE OR REPLACE check_nightly_drift()` — D2-A + D2-B corrected clauses |
| `tests/server/admin/resolution.test.ts` | NEW | trigger suite (`resolving-state-then-resolved`) |
| `tests/server/resolution/happy-path.test.ts` | NEW | `resolution-settles-and-locks` + settle suite |
| `tests/server/resolution/pro-rata.test.ts` | NEW | R-9.8 basis after sells (DB-backed) |
| `tests/server/resolution/correction.test.ts` | NEW | `clawback-floors-at-zero` + correction suite |
| `tests/server/resolution/void.test.ts` | NEW | `full-refund-and-pool-unwind` + void suite |
| `tests/server/resolution/concurrency.test.ts` | NEW | W-3 vs W-1 fences; cross-market same-user |
| `tests/unit/resolution/basis.test.ts` | NEW | prorate unit edges |
| `tests/unit/resolution/basis.property.test.ts` | NEW | fast-check exact-sum / non-negativity |
| `tests/unit/dharma/conservation-correction.test.ts` | NEW | sibling-checker unit suite |
| `tests/invariants/I-RESOLVE-ONCE-001.market-terminates-once.spec.ts` | NEW | OQ-7: wrapper-bypass second terminal row → 23505 (the I-GRANT-ONCE-001 mirror) |
| `tests/integration/resolution-conservation.integration.test.ts` | NEW | identities (i)/(ii)/(iii) on real DB |
| `tests/integration/nightly-drift-resolution.integration.test.ts` | NEW | zero-alarms charter incl. the D-1 fixture matrix (a)/(b)/(c) |
| `tests/server/events/insert.test.ts` | EDIT | inventory `.toBe(23)` + membership + `market.resolving` shape fixture |
| `docs/specs/SPEC.1.md` | EDIT | riders R-A..R-E |
| `docs/specs/SPEC.2.md` | EDIT | riders R-F..R-K + §0 changelog row |
| `docs/adr/0013-concurrency-bet-transaction.md` | EDIT | §5.12 **P2 patch record** — W-3 `markets → pools → users` consumes the reserved slot |
| `CLAUDE.md` §1 + §2 | EDIT | critical-path greenfield line: `resolution` → built (absorbs stale `bets` listing); invariant list +`I-RESOLVE-ONCE-001` (8 → 9 specs) |
| `AGENTS.md` §3/§6/§9 | EDIT | greenfield list −`resolution/`; EVENT_TYPES count (stale "11") → 23; migration head 0012 → 0015; tests tree +`resolution/`; invariants 8 → 9 |
| `docs/plans/ENGINE.9.md` | NEW (Phase P, plan PR) | this plan |
| `docs/logs/ENGINE.9*.md` | NEW | per-session logs |

## Riders (CLOSED set R-A..R-K — same execute PR)

- **R-A — SPEC.1 §11 F-RESOLVE-1 System text:** losers settle to 0 — strike "or `−S`
  per A2 form" (R-9.2); winners' rows at gross shares-settle value with the R-9.8
  pro-rata basis sentence; "Write `pool_unwind` flow to admin account" → "record the
  residual as `poolUnwindAmount` on the terminal `market.resolved` events row
  (`metadata.actor_id = 'admin-singleton'`); there is no admin balance — the Dharma
  exits circulation, visibly" (R-9.5/R-9.5e); note mandatory (R-9.1).
- **R-B — SPEC.1 §11 F-RESOLVE-3:** "Pool unwinds back to admin via `pool_unwind`" →
  exits-circulation wording (R-9.5); "Single `voided` event written to `admin_events`
  log" → "one terminal `market.voided` events row (SPEC.2 §3.6 form)" (OQ-4 RATIFIED);
  refund = `f × stake`, sale proceeds stand (R-9.8).
- **R-C — SPEC.1 §10.7:** "Pool unwinds back to admin" echo → exits-circulation.
- **R-D — SPEC.1 §10.3:** pro-rata note (R-9.8) — per-bet math exact for unsold bets;
  after partial sells the surviving fraction applies uniformly; proceeds stand.
- **R-E — SPEC.1 §6.1:** Closed→Resolving bullet "400 `error_market_closed_at`" →
  "409 `market_resolving`" (E-1).
- **R-F — SPEC.2 B.9:** `reason` row → "text — NOT NULL; mandatory for all three
  kinds (R-9.1)"; note the kind↔outcome + corrects-link CHECKs and the terminal-once
  partial unique index (0014).
- **R-G — SPEC.2 B.8:** `amount` semantics — zero legs legal (settlement records);
  per-type signs (reverse ≤ 0, others ≥ 0); gross winner form; pro-rata basis (R-9.8).
- **R-H — SPEC.2 §3.6:** "records the `pool_unwind` as an `events` row" → the
  `poolUnwindAmount` payload-field form (R-9.5e); name the two-transaction trigger
  (F-ADMIN-3 tx + settle tx); align the wrapper name `resolutionTransaction()` →
  `runResolutionTransaction()`.
- **R-I — SPEC.2 §19.4.1:** four rows — `market.resolving`, `market.resolved`,
  `market.corrected`, `market.voided`; STRIP targets "— (none)"; rationale "no
  PII-class payload keys; all research keys SHIP (settlement core for K_eff
  derivation); actor identity is `metadata.actor_id = 'admin-singleton'`, never
  pseudonymised (§19.5)".
- **R-J — SPEC.1 §11 F-RESOLVE-2:** add "reversal amounts are read from the recorded
  `payout_events` rows of the corrected event — never recomputed" (R-9.8 corollary) +
  the one-uncollectable-row-per-user pin.
- **R-K — SPEC.2 §17.2:** alarm row for `resolution_serialization_exhausted` (the W-3
  exhaustion Sentry event — same-commit codify, the middleware-primitive discipline).

## Thesis invariants touched

| Invariant | How ENGINE.9 could break it | Mechanism | Test |
|---|---|---|---|
| INV-4 resolutions append-only | correction implemented as UPDATE of prior rows | corrections are NEW rows + `corrects_event_id` chain; storage triggers (0003) reject UPDATE/DELETE | existing `I-APPEND-ONLY-001` + correction suite asserts prior rows byte-identical |
| Terminal-once (new, OQ-7) | double-settle / settle-then-void writing two terminal rows | markets lock + state gate (primary); `resolution_events_terminal_market_uq` (belt, loud 23505) | `I-RESOLVE-ONCE-001.market-terminates-once` (fixture-bypass 23505) |
| INV-2 no overdraft | per-bet reverse chaining walks balance negative | per-user aggregate `−min(R,B)` floor + shipped `DharmaOverdraftError` + storage CHECK | `clawback-floors-at-zero` (exact-zero landing) |
| INV-2 / R-2 ledger user-only | unwind written as a ledger row ("admin account") | R-9.5/R-9.5e payload-field form; shipped `DharmaPoolTagError` rejects pool tags | settle/void suites assert ZERO `pool_seed`/`pool_unwind` ledger rows |
| Uncollectable model A | wrong sign / balance arithmetic on the forgiveness row | shipped `ledger.ts:57-63` guard (amount ≤ 0, `balance_after = previous`) — the ONLY defense, A9 | uncollectable-pair spec asserts both fields |
| INV-1 / INV-3 | resolution touching bets/comments | settle/correct/void write NO `bets`/`comments` rows; comment lock is emergent | suites assert comments/bets row-counts and contents unchanged |
| I-NO-OVERSELL / I-SINGLE-SIDE | settlement mutating positions | positions NEVER touched (drift-D1 derived constraint) | drift integration suite: zero `position_drift` alarms |
| ADR-0005 event-sourcing | state change without an events row | one terminal emit per flow, same tx | every suite asserts the emit + payload shape |

## Test plan (RED-first via `@test-writer`; local Postgres :54322 convention)

Phase 2 STARTS with `@test-writer` minting the suite below against this section;
implementation follows red. **Final pre-PR gate: full-suite `pnpm vitest run`**
(L-E13) plus `ZUGZWANG_ENV=preview just verify`, `pnpm test:invariants`,
`pnpm test:integration`, `just test-db`.

- **U1 `basis.test.ts`** — prorate: exact-sum on awkward thirds; floor18 on rows
  1..n−1; last-row remainder ≥ 0; `total = 0` ⇒ zeros; single row passthrough; empty
  rows + non-zero total throws.
- **U2 `basis.property.test.ts`** — fast-check ∀ (weights, total): `Σ == total`
  exactly, all amounts ≥ 0, output deterministic under input order permutation.
- **U3 `conservation-correction.test.ts`** — identity (ii) closes / mismatches with
  exact discrepancy; uncollectable visibility (U > 0); `uncollectable` row in
  `ledgerFlows` throws; pool tag throws; A9 canonicalization; degenerates to (★) when
  correction operands are zero.
- **S1 `tests/server/admin/resolution.test.ts`** — `resolving-state-then-resolved`:
  trigger flips Closed→Resolving + emits `market.resolving` (payload = marketId only;
  `actor_id 'admin-singleton'`, `user_id` NULL); negatives: trigger on
  Draft/Open/Resolving/Resolved/Voided/Frozen; double-trigger fails; trigger writes
  NO `resolution_events` row.
- **S2 `happy-path.test.ts`** — `resolution-settles-and-locks`: multi-user multi-bet
  market; winners' gross per-bet rows (R-9.2) + chained ledger (`previousBalance`
  threading asserted via `balance_after` arithmetic); losers' 0-amount payout rows
  with NO ledger rows; `reason` NOT NULL persisted; `resolved_at` +
  `resolution_outcome` written; unwind == winning-side reserve == identity-(i)
  residual; `market.resolved` payload incl. `poolUnwindAmount`; positions untouched;
  pools row untouched; comments untouched; empty-market settle (unwind = seed);
  settle on Resolved/Closed/Open rejected; stranded-Resolving re-invoke succeeds.
- **S3 `pro-rata.test.ts`** — R-9.8: partial sell then win (f < 1, per-bet amounts sum
  exactly to position quantity); fully-sold winning bet → 0-amount row, NO ledger row;
  sold-out-then-switched-sides user; remainder lands on max-UUID bet
  deterministically.
- **S4 `correction.test.ts`** — `clawback-floors-at-zero`: rich user full reversal
  (one `−R` ledger row); poor user floored (balance lands EXACTLY 0; ONE uncollectable
  row, amount = −(R−B), `balance_after = previous`; anchor betId = earliest affected
  bet); reverse+uncollectable+apply chain order; TWO payout legs per bet incl. zero
  legs; reverse amounts == recorded originals — divergence between the recorded payout
  rows and a would-be recomputation is induced SYNTHETICALLY (out-of-band
  positions-row tweak after resolve) — a real sell between resolve and correct is
  product-impossible, the W-1 coarse gate rejects all non-Open trades; the synthetic
  divergence is what makes recorded-vs-recomputed discriminating; VOID outcome
  rejected; same-as-tip rejected (OQ-3); correction-of-correction (reverses
  correction-1's RECORDED apply legs; chain-tip discovery; `corrects_event_id` links);
  status + `resolved_at` unchanged, `resolution_outcome` projected (OQ-2);
  `uncollectableTotal` in response; comments stay locked. **D-1 addition:** the
  floored user's post-correction ledger state is the parked-at-zero fixture consumed
  by I2 (a).
- **S5 `void.test.ts`** — `full-refund-and-pool-unwind`: no-sells → `Σ void_refund ==
  Σ stakes` exactly AND unwind == seed; after-sells → per-bet `f × stake`, proceeds
  stand, cash cross-assert holds; void from Open AND Closed; void on
  Resolving/Resolved/Voided/Frozen rejected (R-9.3); `market.voided` payload incl.
  `poolUnwindAmount`.
- **S6 `concurrency.test.ts`** — void-on-Open vs concurrent `place()`: exactly one of
  {bet refunded inside void's set, bet rejected after retry} — never an unrefunded
  committed bet; cross-market same-user settle×2 → 40001 retry (not 40P01), both
  commit; exhaustion path mints `ResolutionSerializationExhaustedError` with flow tag;
  clean concurrent settle×2 on ONE market → exactly one succeeds via state gate
  (40001/`ResolutionStateError`), NEVER a surfaced 23505 (OQ-7 belt stays silent).
- **V1 `I-RESOLVE-ONCE-001.market-terminates-once.spec.ts`** — fixture-bypass second
  terminal INSERT (`resolve` after `resolve`; `void` after `resolve`) → expect 23505
  from `resolution_events_terminal_market_uq`; a `correct` row after `resolve` is
  ACCEPTED (chain stays open). The I-GRANT-ONCE-001 mirror.
- **I1 `resolution-conservation.integration.test.ts`** — identities (i)/(ii)/(iii)
  close on real fixtures via the shipped (★) checker and the sibling, flows gathered
  argument-fed from the fixture's known rows.
- **I2 `nightly-drift-resolution.integration.test.ts`** — `SELECT check_nightly_drift()`
  → ZERO `cron_alarms` rows over: settled, corrected-with-floored-user, and voided
  markets; **(a)** the floored user PARKED at exactly zero (uncollectable row
  terminal — clean only under corrected 0015); **(b)** spend-to-exactly-zero-and-STOP
  (the discriminating fixture: clean under shipped D2-B, false-alarmed by shipped
  D2-A AND by the round-1 formula, clean under corrected 0015); **(c)**
  spend-to-zero-then-credit (false-alarmed by shipped D2-B, clean under corrected
  0015). Plus positive controls: a genuinely broken link and a duplicate-genesis
  fixture still ALARM under corrected 0015 (detection not weakened). RED against the
  shipped function — this suite drives migration 0015.
- **E1 `insert.test.ts` EDIT** — `.toBe(23)`, membership + `"market.resolving"`,
  payload-shape fixture for the new type.

## Carry-forwards consumed / minted

- **Consumed:** `persist.ts:61` "ENGINE.9 reverse+uncollectable pair" (the chaining
  contract's named live case — W-3c step 8); ADR-0013 P1's "ENGINE.9's outstanding
  per-user serialization obligation" (the W-3 lock order); `transaction.ts:79-82`'s
  reserved W-3 `markets → …` slot (P2 patch record).
- **Minted:** (1) production conservation-gathering scoping — sell-proceeds ledger
  rows are `bet_id` NULL (`sell.ts:75`), so per-market gathering cannot key on
  `bet_id` alone; needs the `bet.sold` events payload or a (user, market) join —
  ENGINE.10/HARDEN (ex-OQ-6, record-only). (2) Symmetric-seed assumption in void's
  cash derivation — ENGINE.14 must preserve `Y₀ = N₀` or revisit (the cross-assert
  fails loud, not silent). (3) Order-free drift verification cannot see
  balance-neutral cycles or fabricated-genesis-at-terminal-zero histories (0015
  migration comment) — accepted residual, HARDEN observability candidate. (4) W-3
  statement-timeout values are HARDEN re-tune candidates alongside W-1's (ADR-0013
  posture).

## Out of scope (stated so execute does not drift)

- **ENGINE.14 — Market lifecycle writes** (R-9.7 boundary, verbatim): F-ADMIN-1
  create, F-ADMIN-2 seed/open (+ dormant `pool_seed` activation), the close
  transition, the other three `market.*` emits (`created`/`opened`/`closed`) + their
  STRIP rows; ENGINE.10 + UI.6 gain ENGINE.14 as a dep. The mint itself is sweep work.
- Freeze enforcement (`system_state.frozen_at` write-gate) — R-9.3's correction
  deadline is structural via that later gate; no mechanism here.
- The PRODUCTION conservation gathering query (carry-forward 1) — ENGINE.10/HARDEN.
- Admin HTTP/route surface, the Hub Markets tab, response-envelope wiring of the
  resolution errors, the composed trigger→settle endpoint — ENGINE.10 / UI.6.
- F-BET-6 fine in-flight window (`markets.resolving_at`) — stays deferred; the coarse
  gate's reject-all is load-bearing here (§Wrapper b).
- F-DEBATE-3 marker freeze (render-time, DEBATE stratum). Value tuning (HARDEN). No
  backfill (tables empty; pre-launch environments reseed).

## Open questions

None open. OQ-1..OQ-5 + OQ-7 ratified and folded into the body (§Review results
folded); OQ-6 converted to carry-forward 1 (record-only).

## Execute ritual (full, no narrowing — critical path + Ultrathink)

This plan merges via the **Phase P plan PR** (docs-only: the plan file; session log
follows in its own PR). The execute pair (fresh CC session + fresh web chat, §5.8)
starts from a `main` that already carries the merged plan, referenced via
`@docs/plans/ENGINE.9.md` in the execute kickoff. `ultrathink` in every coding
prompt. Branch `feat/engine-9-resolution`. Order: (1) `@test-writer` RED suite
against §Test plan; (2) schema + migrations 0014/0015 → `@db-migration-reviewer`;
(3) wrapper + basis + flows to green; (4) schemas.ts + inventory; (5) riders R-A..R-K
+ ADR-0013 P2 + CLAUDE/AGENTS touch-ups; (6) §5.10 self-audit (schema / server /
migration, item-by-item PASS/FAIL/SURPRISE); (7) `@code-reviewer` →
`@security-auditor`; (8) gates: `ZUGZWANG_ENV=preview just verify` +
`pnpm test:invariants` + `pnpm test:integration` + `just test-db` + full
`pnpm vitest run`; (9) session log → PR. Commit identity `Zugzwang/world
<zugzwangworld@proton.me>`; no co-author trailer; multi-line messages via
`/tmp/engine9-commit-msg.txt` (unique name — parallel-lane discipline).

## ADRs needed

- **ADR-0013 §5.12 P2 patch record** (in-place, decision unchanged): W-3 consumes the
  reserved `markets → …` slot; global order `markets → pools → positions →
  dharma_ledger → events`; W-1 unchanged and untouched; the P1 `pools → users` suffix
  preserved. No new ADR: every architectural decision here descends from ADR-0005,
  ADR-0013, ADR-0016, ENGINE.5 R-2, and the founder rulings encoded above; R-9.8's
  basis is product math pinned by SPEC.1 §10.3 rider R-D.

## References

S1 sync-gate + S2 recon + round-1/round-2 reviews (plan chat, 2026-06-11) · SPEC.1
v1.9.0-draft §6.1/§6.2/§10.3/§10.7/§11/§12.1/§15 · SPEC.2
§3.6/§3.7/§9/§17.2/§19.4.1/B.8/B.9 · ADR-0005/0013(+P1)/0014/0015/0016/0018 ·
`persist.ts:51-62` · `ledger.ts:38-74` · `transaction.ts:38-41,56-57,79-108` ·
`sell.ts:35-105` · `tags.ts:43-55` · `conservation.ts:17-68` · `calculate.ts:57-150` ·
0011 D1/D2-A/D2-B · docs/plans/ENGINE.12.md + ENGINE.13.md (template + precedents).
