# ENGINE.12 — Daily Credit accrual (lazy, paid in the commented-bet transaction)

> **Status:** Founder-ratified 2026-06-10 (rulings R1–R6, P1–P5, R-CP1–4, F1–F3 folded) —
> merge pending. Docs-only plan; execute = fresh CC session + fresh web chat (§5.8).
> **Task:** the ADR-0018 / SPEC.1 §10.4 Daily Credit — a flat ~10-Dharma issuance paid
> ONCE per UTC day, ONLY inside a committed comment-bearing bet (post or reply; never a
> sell), accrued lazily at the place() seam. Producer module `src/server/dharma/accrual.ts`,
> the `dharma.credited` emit site, the `users.last_allowance_accrued_at` cursor write, a
> UNIQUE-partial-expression-index storage backstop, `DAILY_CREDIT_DHARMA`, and the
> `I-DAILY-ONCE-001` invariant. Critical-path money code — full ritual, Ultrathink-mandatory.
> **Base:** `main` @ `c2c7af1` (ENGINE.8 execute merged: handlers #99 `66fa532` + log #100
> `1a1cd84`; #101 is the fable5 harness move — no engine overlap). Greenfield: no producer
> code, no day-guard, no accrual constant (recon S4/RC6/RC7).

---

## Context

ENGINE.5 shipped the Dharma core (compute/persist/tags/conservation) with the credit
explicitly producer-owned: "Per-tag sign for the other 7 is NOT enforced — producer-owned
(ENGINE.9/12/signup)" (`ledger.ts:38-39`), and the per-user serialization obligation
assigned by name: "Grant / daily-credit / resolution writes sit outside the ADR-0013 pool
lock; their callers (auth/onboarding, ENGINE.12, ENGINE.9) supply equivalent per-user
serialization" (`persist.ts:51-56`). ENGINE.0 registered the event vocabulary:
`dharma.credited` (`schemas.ts:83`, payload `:239-245` — `creditedForDate` is "a UTC
calendar day (YYYY-MM-DD), not a timestamp — the Daily Credit accrual key (SPEC.1 §10.4)"),
aggregate pinned `dharma_account` (ENGINE.0 plan §map :73); emit site assigned forward
(ENGINE.5 plan :285 — "emitted by the consuming tx (ENGINE.9/12)"). ENGINE.8 shipped the
consuming tx: the parameterized `place()` spine inside the W-1 SERIALIZABLE wrapper.
ENGINE.12 is the join: the producer that pays the credit inside that spine.

Binding rule (SPEC > ADR > tracker): ADR-0018 :85 — daily credit "~10 Dharma, FLAT (never
escalating), paid **only on placing a commented bet**"; SPEC.1 §10.4 — "Paid **only on a
UTC day on which the user places at least one commented bet** (a post or a reply — both
are bets) … Use-or-lose … The accrual cursor is `users.last_allowance_accrued_at`."
The tracker's "first authenticated write" prose is recorded drift (a comment-free sell is
an authenticated write and must NOT pay) — recorded once, no action (recon OQ-7).

## Founder rulings folded (R1–R6 — binding)

- **R1 — event name: KEEP built `dharma.credited`.** SPEC.2 is amended to match code
  (founder-authorized hierarchy inversion): replace `user.daily_allowance_accrued` at
  SPEC.2 `:541` (§5.5 dropped-tables note) and `:2635` (Appendix **B.12** `user_events`
  exemplar row — appendix correction: events = B.13, NOT B.14; B.14 is `identity_pool`).
  Closed rider set, rides the execute PR (ENGINE.5 R-3 precedent). No §7 enumerated list
  exists to amend (closed enum lives in code per §7.1/B.13 — verified); no aggregate
  amendment needed (`dharma_account` already at `:711`/`:2655`).
- **R2 — NO `user_events` audit row.** The complete write set is exactly three:
  `events(dharma.credited)` + `dharma_ledger(daily_allowance)` + cursor UPDATE
  (`users.last_allowance_accrued_at`). Rider amends SPEC.2 `:477` (§5.1 row 9) + `:2635`
  (B.12) to drop "Daily Credit accrual" from `user_events` coverage; the `:541` three-part
  collapse is canonical.
- **R3 — day-guard: SSI read-write conflict on the cursor IS the mechanism;** a UNIQUE
  partial expression index on `dharma_ledger` is the storage backstop; **tx-frozen DB
  `now()` is the SINGLE day authority.** Specifics pinned in "The accrual unit" below,
  incl. the mandatory LOCK-ORDER NOTE and the `creditedForDate` clock-divergence note.
  This discharges `persist.ts:51-56`'s per-user-serialization assignment to ENGINE.12.
- **R4 — the day's credit funds the day's first bet.** Callback order in `place()`:
  `getHeldPosition` → F-BET-10 → `readBalance` (`place.ts:72`) → **accrue-if-unpaid** →
  friendly `insufficient_dharma` pre-check against the **POST-credit** balance → CPMM →
  positions → comments → bets → `bet_stake` debit with `previousBalance` **CHAINED** from
  the credit's returned `balanceAfter` (`persist.ts:58-62` — two same-user rows, one tx,
  chaining REQUIRED) → events → pools. Atomicity delivers ADR-0018 semantics free: any
  in-tx failure rolls back credit + cursor together — "paid only on placing a commented
  bet" enforced by rollback.
- **R5 — the accrual step lives INSIDE `place()`** via a new producer module
  `src/server/dharma/accrual.ts` (keeps the three-write unit in the dharma domain;
  `place.ts`'s diff is a call + chain). DEBATE.2's reply path inherits it for free
  through the parameterized write. `sell.ts` untouched (comment-free, never pays — recon
  confirmed no seam, correctly).
- **R6 — initial grant OUT of scope.** NOT-doing entry below + a tracker note in the
  session log: mint/amend an AUTH-lane row for the grant producer, carrying
  `persist.ts:51-56`'s per-user-serialization warning. Joins the queued tracker sweep.

## Pre-resolved web-lane calls folded (P1–P5 — binding)

- **P1 — third event_id.** `creditEventId` minted UNCONDITIONALLY at handler entry in the
  `place/route.ts:64-75` block, closed over, USED only when paying — retry-purity
  (`transaction.ts:87-92`) upheld; idempotency replay never re-enters the handler → no
  double-pay path there. SQLSTATE propagation (`transaction.ts:101-107`) applies to any
  error the accrual step wraps (it wraps none — driver errors bubble raw).
- **P2 — producer obligations absorbed** (ENGINE.5 A9/M2, `ledger.ts:38-39`): amount
  strictly positive (producer-side validation BEFORE `appendLedgerRow`); `bet_id = NULL`
  on the credit row; per-user serialization = R3; `FLOW_TAGS` gathering-exclusion
  untouched (`tags.ts:44-48`, `conservation.ts:50-54`).
- **P3 — constant.** `DAILY_CREDIT_DHARMA = "10"` (decimal string placeholder, ranged)
  added to `src/server/config/limits.ts` — name ADOPTED from SPEC.1 §16.1; **HARDEN.5**
  ("Number-tuning pass", 2026-09-01) owns the value.
- **P4 — banned users.** Structurally excluded at gate 1 (`endpoint.ts:167-173`, 403
  pre-idem, F-BET-7 `SPEC.1:327-334`) — RECORDED as satisfying the tracker's "banned skip"
  + SPEC.1 §10.7 "No Daily Credit from ban-time forward". No in-callback check. Tracker
  trigger-prose drift recorded, no action.
- **P5 — invariant.** Mint `I-DAILY-ONCE-001` (one `daily_allowance` row per user per UTC
  day) with its invariants spec test, house pattern (I-NO-OVERDRAFT-001 precedent).

## Approach (one paragraph)

A single new producer, `accrueDailyCredit(tx, …)` in `src/server/dharma/accrual.ts`, is
called from `place()` between the existing balance read and the pre-check. In the locked
SERIALIZABLE snapshot it makes ONE decision read (the cursor + the tx clock), and if the
user is unpaid for the tx's UTC day it performs the three-write unit: cursor UPDATE,
`daily_allowance` ledger append (chained off the already-read balance), and the
`dharma.credited` event (id minted at handler entry). It returns the post-credit balance,
which `place()` uses for the friendly pre-check and chains into the `bet_stake` debit.
Concurrency is the ENGINE.7 wrapper's existing retry loop: a same-user race on two
markets serializes on the users-row cursor (40001 → full callback re-run → rerun sees the
cursor → skips; the bet always proceeds, the credit pays exactly once), with a UNIQUE
partial expression index on `dharma_ledger` as the storage backstop that can only fire on
a future logic bug. No new endpoint, no new flow, no cron — the faucet is lazy by
construction and rollback gives ADR-0018's conditionality for free.

## The accrual unit (`src/server/dharma/accrual.ts` — NEW)

**Signature (ruled shape):**
`accrueDailyCredit(tx: DbTransaction, args: { userId: string; previousBalance: string;
creditEventId: string; metadata: z.infer<typeof eventMetadataSchema> }): Promise<{
credited: boolean; balanceAfter: string; creditedForDate: string | null }>`
— `balanceAfter` = `previousBalance` when not credited. Metadata typed from
`@/server/events` (NOT from `bets/endpoint` — no bets→dharma→bets type cycle; same
underlying 7-field shape, `schemas.ts:267-275`).

**Decision read (one statement, locked snapshot):**
`SELECT last_allowance_accrued_at, now() AS tx_now FROM users WHERE id = $userId` —
fetches the cursor AND the tx clock together. Missing row → plain throw (caller bug; the
gate-1 query already proved the row exists — `lockPool` precedent, `transaction.ts:211-213`).
Day math is a pure exported helper `utcDayOf(d: Date): string` (`toISOString().slice(0,10)`
— both operands are DB-sourced timestamps, so the single-clock rule holds). Unpaid ⇔
`last_allowance_accrued_at IS NULL || utcDayOf(cursor) !== utcDayOf(txNow)`. Common-path
contention property (F3c): an already-paid day is a PURE READ — no users write, no added
lock — so steady-state hot-path contention is unchanged (ENGINE.10 p95 relevance).

**Write set when unpaid (R2 — exactly three, in the R-CP1 RULED order):**
1. **Cursor UPDATE:** `UPDATE users SET last_allowance_accrued_at = now(), updated_at =
   now() WHERE id = $userId` (the serialization point — see D-N1). Execute micro-pin
   (F3a): verify `users.updated_at` exists before including it in the UPDATE — else drop
   the clause.
2. **Ledger append:** `appendLedgerRow(tx, { userId, amount: DAILY_CREDIT_DHARMA,
   entryType: "daily_allowance", betId: null, previousBalance })` → `{ id, balanceAfter }`.
   Producer guard runs first: exported `validateCreditAmount(amount)` throws
   `DharmaInputError` unless strictly positive `numericString` (P2; core enforces only the
   overdraft floor per `ledger.ts:38-39` — a positive credit can never trip it).
3. **Event:** `insertEvent(tx, { eventId: creditEventId, eventType: "dharma.credited",
   aggregateType: "dharma_account", aggregateId: userId, payload: { userId, amount:
   DAILY_CREDIT_DHARMA, creditedForDate }, metadata })` — aggregate per merged ENGINE.0
   plan :73; payload schema already registered (`schemas.ts:239-245`, ZERO edit — verified).

**D-N1 — write order inside the unit (RULED at CP — R-CP1).** The order is
**cursor-UPDATE FIRST → ledger append → event.** The racing transaction's FIRST
conflicting statement determines the SQLSTATE: cursor-first makes the users-row
write-write conflict fire first — deterministically `40001` ("could not serialize access
due to concurrent update"), which IS in `RETRYABLE_SQLSTATES` (`transaction.ts:41`) → the
ENGINE.7 wrapper re-runs the whole callback → the rerun sees the cursor → skips; the bet
always proceeds, the credit pays exactly once. Credit-first would make the backstop index
the first conflict and risks a first-conflict `23505` (NOT retryable) → a hard 5xx on a
bet that must succeed. R3's listed order ("append credit row + UPDATE cursor") was
illustrative; the mechanism intent is exactly this. The index stays purely a backstop.
T3 remains the empirical tripwire.

**LOCK-ORDER NOTE (mandatory — discharges `persist.ts:51-56`).** The wrapper acquires the
pool row FIRST (`transaction.ts:120`, `FOR NO KEY UPDATE`); the users-row write happens
SECOND, inside the callback. Global order **pools → users** — no cycle. Different-market
same-user races hold different pool rows, then collide on the one users row →
serialization failure → wrapper retry (NOT deadlock; the order is consistent across all
writers). Same-market same-user is already fully serialized by the pool lock. Compatible
with ADR-0013's canonical chain (`pools → positions → dharma_ledger → events`): the
cursor write is a per-user write co-located in the per-user block of the chain, before the
terminal `events` write, consistent with ADR-0013's co-location rationale (ADR-0013 gains
an in-place §5.12 Patch record for the `pools → users` extension — rider 5). No other
code path writes `users` inside a pool-locked transaction (verified: auth/onboarding paths
run outside W-1), so no ordering conflict is introduced anywhere.

**`creditedForDate` clock note (R3, verbatim semantics).** `creditedForDate` is the
COMMITTING transaction's UTC day by construction — the decision read, the ledger
`created_at` (`DEFAULT now()`, tx-frozen), the payload field, and the index expression all
derive from ONE frozen clock. Midnight-straddling retry: each attempt is a fresh tx, one
clock, one day; the aborted attempt's writes vanish. The ONE divergence: the events ROW
timestamp (`events.created_at`) derives from the handler-entry UUIDv7 ms prefix
(`insert.ts:58-62`) — that is the EVENT-ROW timestamp, NOT the accrual key; the payload's
`creditedForDate` computes from tx `now()`, never from the event_id.

**Replayability (ADR-0005).** The cursor is a derivable projection: reconstructible as
`max((timezone('UTC', created_at))::date)` over the user's `daily_allowance` rows (or the
latest `dharma.credited.payload.creditedForDate`). The append-only event + ledger rows are
the source of truth; mutating the cursor in place is the SPEC-named idempotency-cursor
pattern (SPEC.2 `:541`, B.1 `:2484`), not state-in-place drift.

## The `place()` seam (R4 — EDIT `src/server/bets/place.ts` + `place/route.ts`)

- `PlaceParams` gains `creditEventId: string` (doc'd "generated at handler entry, closed
  over — NEVER regenerated here", matching `:27-29`).
- `place/route.ts:64-75` block mints `creditEventId = uuidv7()` unconditionally alongside
  the existing two (P1) and passes it through.
- In `place()`: after `readBalance` (`:72`), call `accrueDailyCredit`; the friendly
  pre-check (`:73-76`) compares the stake against the returned post-credit `balanceAfter`
  (T4 — ADR-0018's "one extra post-floor unit of voice per active day" funds the day's
  first bet); the `bet_stake` debit (`:125-131`) passes `previousBalance: <post-credit
  balanceAfter>` — the REQUIRED same-user multi-row chaining (`persist.ts:58-62`).
  `InsufficientDharmaError.balance` now reports the post-credit balance (wire shape
  unchanged; semantic noted for tests).
- Write order becomes: reads → **accrual unit** → positions → comments → bets →
  `bet_stake` debit (chained) → `bet.placed` + `comment.placed` events → pools. The
  accrual's event insert precedes the positions write; the ADR-0013 chain's per-user
  co-location rationale is preserved (see LOCK-ORDER NOTE); the terminal-pools UPDATE is
  unchanged.

## Schema + migration (R3 backstop — EDIT `src/db/schema/dharma.ts`, NEW migration)

Backstop index (candidate DDL):
`CREATE UNIQUE INDEX dharma_ledger_daily_allowance_day_uq ON dharma_ledger (user_id,
((timezone('UTC', created_at))::date)) WHERE entry_type = 'daily_allowance';`
— can only fire on a future logic bug → fails loudly (never double-pays). Execute
verification item: expression immutability (`timezone('UTC', timestamptz)` → `timestamp`
and `timestamp::date` are both IMMUTABLE — verified at migration-apply in CI + local
test-db). Bucket A unaffected (DDL, not row mutation; `0003` triggers untouched).
Execute micro-pin (F3b): "0012" is the EXPECTED-next index — re-verify the actual next
migration index at execute (house `<next>` pattern).

**PROBE (re-sequenced to execute — writes files):** can `drizzle-kit generate` express a
partial UNIQUE EXPRESSION index from
`uniqueIndex(...).on(table.userId, sql\`((timezone('UTC', ${table.createdAt}))::date)\`)
.where(sql\`${table.entryType} = 'daily_allowance'\`)`? Fallback PRE-PLANNED: hand-written
`0012_daily_allowance_day_unique.sql` + journal + snapshot (house precedent: `0002`/`0003`
hand-written migrations); `schema.ts` then carries the index declaration or a documented
pointer comment — `@db-migration-reviewer` checks schema↔SQL coherence either way.

## Constant (P3 — EDIT `src/server/config/limits.ts`)

`export const DAILY_CREDIT_DHARMA = "10";` — JSDoc: "Flat (non-escalating) Daily Credit,
paid once per UTC day only on a day the user places a commented bet (ADR-0018 + SPEC.1
§10.4/§16.1). Use-or-lose. PLACEHOLDER VALUE (~10, ranged) — HARDEN.5 (number-tuning
pass, 2026-09-01) owns the value. Decimal string — never a JS float (CLAUDE.md §2)."
Name adopted from SPEC.1 §16.1 — no new name minted.

## Carry-forwards consumed / minted

- **CONSUMED:** `persist.ts:51-56` per-user-serialization assignment to ENGINE.12 (R3);
  ENGINE.0/ENGINE.5 emit-site assignment for `dharma.credited` (ENGINE.0 plan :106,
  ENGINE.5 plan :285); the `previousBalance` >1-row chaining contract's first live
  same-tx-pair (`persist.ts:58-62` named ENGINE.9's pair as the live case — this is now
  the FIRST live case, note in code comment).
- **MINTED:** (a) DEBATE.2 obligation — the reply route must mint `creditEventId` at ITS
  handler entry when it reuses `place()` (one line; recorded here so it isn't missed);
  (b) ENGINE.9 still owes its own per-user serialization for resolution writes
  (`persist.ts:51-56` residue — rider 5's Patch record names it as consumer);
  (c) §19.4.1 catch-up — `bet.placed`/`bet.sold`/`comment.placed` rows missing
  (pre-existing ENGINE.7/8 gap — named SYNC-sweep forward per R-CP3); (d) AUTH-lane
  tracker row for the initial-grant producer (R6 — session-log note, queued tracker sweep).

## File plan (CLOSED diff-stat set)

| File | Status | What |
|---|---|---|
| `src/server/dharma/accrual.ts` | NEW | Producer: decision read, `utcDayOf`, `validateCreditAmount`, the three-write unit, LOCK-ORDER + clock docstrings. |
| `src/server/bets/place.ts` | EDIT | `PlaceParams.creditEventId`; accrual call at the R4 seam; post-credit pre-check; debit chaining. |
| `src/app/api/bets/place/route.ts` | EDIT | Mint `creditEventId` in the `:64-75` retry-purity block; pass through. |
| `src/server/config/limits.ts` | EDIT | `DAILY_CREDIT_DHARMA` (P3). |
| `src/db/schema/dharma.ts` | EDIT | Backstop index declaration (or documented pointer per PROBE fallback). |
| `drizzle/migrations/0012_daily_allowance_day_unique.sql` (+ meta) | NEW | The backstop index (generated or hand-written per PROBE; index per F3b). |
| `src/server/events/schemas.ts` | **ZERO edit** | Payload + type already registered (`:83`, `:239-245`) — verified; stated per draft requirements. |
| `docs/adr/0013-concurrency-bet-transaction.md` | EDIT (execute-PR rider 5) | §5.12 in-place Patch record: lock order extends `pools → users` (R-CP4). |
| `tests/server/bets/daily-credit.test.ts` | NEW | T1–T5 (DB-backed, real route/handlers — events-idempotency harness pattern). |
| `tests/unit/dharma/accrual.test.ts` | NEW | T10 (pure: `utcDayOf` UTC boundaries, `validateCreditAmount`, decision logic). |
| `tests/invariants/I-DAILY-ONCE-001.daily-credit-once-per-utc-day.spec.ts` | NEW | T8 (P5). |
| `tests/server/bets/{events-idempotency,atomicity,validation,subsequent-buy,sell,idempotency-replay}.test.ts` | EDIT (additive) | Recon RC9 touch set — see Test plan. |
| `docs/specs/SPEC.2.md` | EDIT (riders 1–4) | The 4 closed SPEC.2 rider addresses below. |
| `docs/plans/ENGINE.12.md`, `docs/logs/ENGINE.12.md` | NEW | This plan (committed before Phase 1 ends) + session log. |

## Riders (CLOSED enumerated set — same execute PR, ENGINE.5 R-3 precedent)

1. SPEC.2 `:541` (§5.5): `user.daily_allowance_accrued` → `dharma.credited` (R1).
2. SPEC.2 `:477` (§5.1 inventory row 9, `user_events`): drop "daily-allowance accrual"
   from coverage prose (R2).
3. SPEC.2 `:2635` (Appendix **B.12** `user_events` `event_type` exemplar row): remove
   `user.daily_allowance_accrued` (R1+R2; corrected appendix address — B.14 is
   `identity_pool`).
4. SPEC.2 §19.4.1 table (`:1863` ff): ADD row `dharma.credited` | STRIP `payload.userId` |
   "PSEUDO defense-in-depth — `aggregate_id` carries the user id; same rationale as
   `user.signed_out`" — mandated by the table's own footer ("Adding a new event_type …
   same-commit amendment to this table") now that the first emit site lands.
5. `docs/adr/0013-concurrency-bet-transaction.md` (R-CP4): in-place §5.12 Patch record
   (~5 lines) — canonical lock order extends **`pools → users`** (daily-credit cursor
   write inside W-1; the first contended non-pool row lock); consumed by ENGINE.9's
   outstanding per-user-serialization obligation.
- **SPEC.1: ZERO edits — verified.** §10.4 already states the rule + cursor verbatim;
  §16.1 already names `DAILY_CREDIT_DHARMA`; acceptance row `:1084`
  (`economy::daily-credit-only-on-commented-bet-day`) already exists. Stated per draft
  requirements.
- **CLAUDE.md / AGENTS.md: no touches.** AGENTS.md §9's invariant-inventory line is
  already stale (pre-existing — lists 2 specs, repo has 4); adding I-DAILY-ONCE-001
  deepens it by one — owned by the periodic SYNC sweep (CLAUDE.md §7), recorded in the log.

## Thesis invariants touched

- **INV-2 (consumed).** Credit is strictly positive (producer guard) → can never trip the
  overdraft floor; issuance is system→user faucet — no counterparty debit, no transfer
  surface, no new endpoint. Conservation identity untouched: `daily_allowance` is excluded
  from `FLOW_TAGS` (`tags.ts:44-48`) and the checker THROWS if a credit row leaks into
  flow input (`conservation.ts:50-54`) — the gathering-exclusion contract is unchanged.
- **INV-1 (consumed).** The credit rides the same SERIALIZABLE commented-bet tx; rollback
  of any in-tx failure reverts credit + cursor + bet + comment together — ADR-0018's
  "paid only on placing a commented bet" is enforced by atomicity, not by a check.
- **I-DAILY-ONCE-001 (MINTED, P5).** One `daily_allowance` row per user per UTC day.
  Mechanism: cursor conflict (primary) + UNIQUE partial expression index (storage
  backstop). Canonical spec test at `tests/invariants/`.
- **INV-3 / INV-4:** untouched (no comment or resolution surface).
- **ADR-0005 event-sourcing:** `dharma.credited` is the append; the cursor is a derivable
  projection (see Replayability note) — no state-in-place violation.

## Test plan (RED-first via `@test-writer`)

New DB-backed suite `tests/server/bets/daily-credit.test.ts` (real handlers, the
events-idempotency harness pattern; local Postgres `:54322` / CI-gated per convention):

- **T1 — first-commented-bet-of-day pays:** credit row (`entry_type=daily_allowance`,
  `bet_id NULL`, amount `+10`) + debit row; balances CHAIN (`credit.balanceAfter` =
  debit's `previousBalance`); cursor set to tx time; `dharma.credited` payload
  `creditedForDate` = tx UTC day; aggregate `dharma_account`/userId.
- **T2 — second bet same UTC day:** no second credit (cursor path); exactly one
  `daily_allowance` row.
- **T3 — THE RACE (the stratum's money test):** two concurrent first-bets, DIFFERENT
  markets, same user. Assertion set (F2): both bets COMMITTED + exactly ONE
  `daily_allowance` row TOTAL + exactly ONE `dharma.credited` event TOTAL across both
  places (the loser's event never commits) + ≥1 retry breadcrumb (detector-tolerant) +
  per-place `bet.placed`/`comment.placed` counts stable.
- **T4 — credit funds the floor:** seeded balance < `BET_MIN_STAKE_POST` ≤ balance+credit,
  unpaid today → bet SUCCEEDS (post-credit pre-check; ADR-0018 "one extra unit of voice").
- **T5 — rollback purity (F1):** injected post-accrual in-tx fault via the existing fault
  harness — the SOLE vehicle — → NO credit row, cursor UNTOUCHED. (A crafted overdraft is
  IMPOSSIBLE here: the post-credit pre-check guarantees stake ≤ balance, so the debit's
  `balance_after` ≥ 0 and the CHECK is unreachable — which documents why the pre-check is
  load-bearing.)
- **T6 — sell never pays:** extend `tests/server/bets/sell.test.ts` — zero
  `daily_allowance` rows, cursor NULL after a sell-only day.
- **T7 — idempotency replay → no second credit:** extend `idempotency-replay.test.ts` —
  replayed place returns cached response; ledger/cursor unchanged (handler never re-runs).
- **T8 — I-DAILY-ONCE-001:** invariants spec — direct-SQL duplicate
  (same user, same UTC day, `daily_allowance`) → unique violation from the backstop index.
- **T9 — banned 403 pre-path:** EXISTS (`validation.test.ts:213-215`) — cited; extend only
  if a gap appears (the 403 fires pre-tx, so no accrual is reachable — P4).
- **T10 — unit (`tests/unit/dharma/accrual.test.ts`):** `utcDayOf` boundary cases
  (23:59:59.999Z / 00:00:00.000Z, month/year rollovers), accrue-decision logic
  (NULL cursor, same-day, prior-day), `validateCreditAmount` (rejects "0", negatives,
  non-numericString).
- **Additive-touch set (recon RC9 — run, observe, update expectations additively):**
  `events-idempotency.test.ts` (per-type counts + credit-event `created_at` stability
  across retry), `atomicity.test.ts:201-211` (ledger shape gains the credit row;
  `balance_after` arithmetic shifts +10 on first place), `validation.test.ts`
  (insufficient_dharma fixture must seed balance such that balance + credit < stake),
  `subsequent-buy.test.ts` + `sell.test.ts` (balance math after a paying first place),
  `concurrency.test.ts` expected UNAFFECTED (representative callbacks, not real `place()`
  — verify at execute). Maps to SPEC.1 acceptance `:1084`
  `economy::daily-credit-only-on-commented-bet-day`.

## Out of scope (stated so execute does not drift)

- **Initial-grant producer (R6)** — AUTH-lane tracker row minted via the session log;
  carries the `persist.ts:51-56` per-user-serialization warning. Not built here.
- **`user_events` accrual row (R2)** — ruled out; riders strike the SPEC.2 references.
- **§19.4.1 catch-up rows (R-CP3)** for ENGINE.7/8's already-emitted types
  (`bet.placed`/`bet.sold`/`comment.placed`) — deferred because each row needs its own
  STRIP/KEEP privacy ruling; named SYNC-sweep forward, rider set stays closed.
- **Value tuning** (`DAILY_CREDIT_DHARMA` stays "10" placeholder — HARDEN.5 number-tuning
  pass).
- **Streak/retention UI, optional sink, K_eff anything** (refusal-adjacent; ADR-0018 defers).
- **Sell/reply work** — `sell.ts` untouched; DEBATE.2 inherits the seam (one obligation
  minted: `creditEventId` at its handler entry).
- **Cursor backfill** — `last_allowance_accrued_at` NULL ⇔ never paid; no migration of
  existing rows needed.
- **No new `BetFlow`, no new aggregate, no new error code** (insufficient-balance wire
  shape unchanged; accrual introduces no new user-facing failure mode).

## Execute ritual (full, no narrowing — critical path + Ultrathink)

1. Fresh CC session + fresh web chat (§5.8). Sync gate; branch
   `feat/engine-12-daily-credit` off `main` (verify name free; assert `--show-current`).
2. **`@test-writer` RED FIRST** (Phase-2 start, §5.6 — Dharma accounting + bet placement):
   T1–T8 + T10 + the additive-touch set, against this plan (`@docs/plans/ENGINE.12.md`).
   DB-backed suites CI-RED locally if `:54322` down (`tests/unit/` is the local proxy).
3. **PROBE** drizzle-kit expression-index generation; commit the generated migration or
   the pre-planned hand-written fallback (+ journal/snapshot); re-verify the next
   migration index (F3b).
4. Implement: `accrual.ts` → `place.ts`/`route.ts` seam → `limits.ts` → schema → riders
   1–5 (incl. the ADR-0013 Patch record).
5. Gates: `ZUGZWANG_ENV=preview just verify` + `pnpm test:invariants` +
   `pnpm test:integration` / `just test-db` (§5.7 critical path).
6. Cascade (explicit, with `@docs/plans/ENGINE.12.md`): `@code-reviewer` (FLAG the
   cross-module `place.ts` touch + the bets↔dharma seam) → `@security-auditor` (money
   path: faucet race double-pay, replay, midnight straddle, banned exclusion, post-credit
   pre-check semantics) → `@db-migration-reviewer` (REJOINS: migration ordering/
   idempotency, schema↔SQL coherence, expression immutability, Bucket A intact,
   same-commit SPEC amendments grep-verified) → §5.10 self-audit (schema/server/migration,
   item-by-item PASS/FAIL/SURPRISE). No soak.
7. Session log `docs/logs/ENGINE.12.md` (incl. the R6 tracker note) in its own commit;
   PR; squash-merge.

## ADRs needed

**One in-place Patch record (rider 5, ruled at CP — R-CP4):**
`docs/adr/0013-concurrency-bet-transaction.md` gains a §5.12 Patch record (~5 lines)
extending the canonical lock order `pools → users` for the daily-credit cursor write
inside W-1 (the first contended non-pool row lock), naming ENGINE.9's outstanding
per-user-serialization obligation as its consumer. Rides the execute PR (same-commit
doctrine). No new ADR: ADR-0018's economics are unchanged (this implements them); event
naming has no governing ADR — R1's founder-authorized SPEC.2 amendment is recorded here
and in the session log.

## References

ADR-0018 :85 (daily credit row) · SPEC.1 §10.4 :486-495 + §16.1 (`DAILY_CREDIT_DHARMA`) +
§10.7 (banned) + :1084 (acceptance) · SPEC.2 :541/:477/:2635/§19.4.1 :1863 (riders) +
:2484 (cursor) + :711/:2655 (`dharma_account`) · `persist.ts:51-56`/`:58-62` ·
`ledger.ts:38-39`/`:57-64` · `tags.ts:44-55` · `conservation.ts:50-54` · `place.ts:63-131`
· `place/route.ts:64-75` · `transaction.ts:38-41/:87-107/:120` · `endpoint.ts:144-290` ·
`schemas.ts:54-84/:236-245` · `insert.ts:58-62/:75-83` · ENGINE.0 plan :73/:106 ·
ENGINE.5 plan :285 · ENGINE.8 plan/log (structure + seam precedents) · ENGINE.12 recon
report (Segment 1, this session).
