# ENGINE.7 — Bet transaction primitive (the W-1 SERIALIZABLE wrapper)

> **Status:** reviewed-draft (awaiting WEB GREEN + founder ratification). Docs-only plan; no engine code, migrations, or schema land in the plan phase.
> **Task:** the generic **W-1 bet-transaction wrapper** at `src/server/bets/transaction.ts` + `src/server/bets/errors.ts`. The most write-contended path in the system; **Ultrathink mandatory** per the tracker + SPEC.2 §9:1003.
> **Base:** `main` @ `2667140` (ENGINE.11 merged). Greenfield: `src/server/bets/` is absent on disk and in git.

---

## Tracker context

ENGINE.7 is the bet-transaction primitive — the single SERIALIZABLE write wrapper that every bet flow (ENGINE.8) invokes. The tracker gates it on ADR-0013 ("canonical lock order (ADR-0013)", "appends events via ENGINE.6", Ultrathink-mandatory, 3d). ADR-0013 (dated 2026-05-07) **predates** ADR-0017/0018 + SPEC.1 v1.9.0 and was superseded on two axes; the binding contract is now SPEC.2 §9 / §3.2 / §7.5 (source hierarchy: SPEC.1/SPEC.2 > ADR-0013 > tracker). This plan builds the wrapper against the **current** SPEC.2 contract while preserving every still-live ADR-0013 implementation specific.

**Dependencies (all merged):** ENGINE.2 (`cpmm/`), ENGINE.4 (`markets/` state machine + `markets`/`pools` schema), ENGINE.5 (`dharma/` ledger writer), ENGINE.6 (`events/insert.ts`), ENGINE.11 (`positions/` writer). ENGINE.8 (`place.ts`/`sell.ts`) consumes this wrapper and is **out of scope**.

## Drift reconciliation (record; do NOT edit the tracker)

The tracker is operator-maintained external HTML — not edited here. Recorded drifts:

1. **Tracker "canonical lock order (ADR-0013)" → current SPEC.2 §9 4-table order.** ADR-0013 §2:168 reads `pools → positions → dharma_ledger → friendly_fire_events → events` (5 tables). **Superseded.** Binding order is SPEC.2 §9:988 `pools → positions → dharma_ledger → events` (4 tables); `friendly_fire_events` struck (ADR-0017 P1:36-43; SPEC.2 §7.5:758). Map the tracker phrase to the 4-table order.
2. **S1 — `markets.resolving_at` does not exist.** Schema `markets.ts:32-54` has `status`, `resolution_deadline`, `resolved_at`, `resolution_outcome` — no `resolving_at`. ADR-0013 §7:259-271's *fine* F-BET-6 in-flight window reads it. → ENGINE.7 ships only the **coarse** state gate (Open vs not-Open); the fine window is a carry-forward (needs the `resolving_at` column [schema/migration, ENGINE.9-or-dedicated] + `IN_FLIGHT_BET_TIMEOUT_SEC` [HARDEN.6]).
3. **S2 — `error_type` drift.** SPEC.2 §9:1001 prose says `error_type: temporary_unavailable`; the canonical 9-value enum (§15.2:1447) is **`unavailable`**, and §15.2 lists `error_bet_serialization_exhausted` under it. ENGINE.7 mints the error class + the `error_bet_serialization_exhausted` code string only; the canonical `error_type` is `unavailable`. Recorded; ENGINE.8/error-envelope work wires the envelope.

## Approach (one paragraph)

Build one generic, flow-agnostic helper, `runBetTransaction(args, callback)`, that opens a Postgres SERIALIZABLE transaction, locks the pool row by `market_id` with `FOR NO KEY UPDATE`, applies a **coarse** intra-tx market-state gate (plain unlocked `SELECT markets.status`; Open → proceed, non-Open → throw a typed product error), runs the per-flow callback containing the 4-table lock-order chain, and wraps the whole thing in a full-jitter retry loop on SQLSTATE 40001/40P01 with a 3-retry budget, a Sentry breadcrumb per attempt, and a Sentry alarm-3 custom event + `BetSerializationExhaustedError` on exhaustion. The wrapper is unaware of idempotency, moderation, CPMM math, Dharma tags, and event types — all of those live in the ENGINE.8 callback. The single load-bearing cross-cutting contract the wrapper imposes on its callers is **retry-purity**: because the whole callback re-runs on each attempt, all IDs are generated at handler-entry and closed over, never regenerated per attempt.

## Folded rulings & delegated calls (index)

CP-ruled (this review cycle), all incorporated below:

- **(a) Market-state gate = wrapper-level, COARSE, unlocked `SELECT`.** → "Coarse market-state gate".
- **(b) `insertEvent` = CALLBACK calls it; wrapper events-unaware.** → "Lock-order callback contract".
- **(c) CPMM compute = CALLBACK.** → "Per-flow callback contract".
- **(d) I-ATOMICITY-001 lands in ENGINE.7, wrapper-level** (representative callback). No I-ATOMICITY-002. → "Test plan".
- **(e) Concurrency-test split affirmed 7/2.** → "Test plan".
- **(f) Events-idempotency = property test, not a named invariant; retry-purity contract first-class.** → "Retry-purity contract" + "Test plan".
- **S1–S5 + lock-predicate** dispositions: → "Drift reconciliation", "Coarse market-state gate", "Errors", "Carry-forwards", and the `pools WHERE market_id = $marketId` predicate throughout.

## Scope resolution — the two supersessions (with citations)

### Supersession 1 — 4-table lock order (`friendly_fire_events` struck)

Binding: **`pools → positions → dharma_ledger → events`** (SPEC.2 §9:988; §3.2:225,233; §7.5:758). `events` is terminal per ADR-0005's read-model convention; per-user writes (`positions`, `dharma_ledger`) co-located ahead of it. For a **comment-bearing bet**, `bets` + `comments` are Bucket-A appends *inside* the tx but **not lock points** (no `SELECT … FOR …` is taken on them) — they do not change the spine. ADR-0017 P1 confirms `friendly_fire_events` struck from the schema (physical drop deferred to DEBATE.9) and F-COMMENT-6/7/8 removed.

### Supersession 2 — reply-as-bet; W-2 retired

W-1 is the single write path for **every bet**: F-BET-1 (entry post-bet), F-BET-2 (subsequent post-bet), F-BET-3 (sell), and — because every comment rides a bet — F-COMMENT-1 (additional post-bet), F-COMMENT-2 (reply-bet), F-COMMENT-3 (image-attached bet+comment) (SPEC.2 §3.2:225). **W-2 (comment-without-bet) is retired** (§3.2:227,234); `src/server/comments/place.ts` is folded into the bet path. The only comment-free write is the sell (F-BET-3).

### Explicit OUT of scope (stated so the execute chat does not drift)

- `place.ts` / `sell.ts` flow handlers, F-BET-1…10 business logic, the idempotency-key **lookup site**, two-floor min-bet enforcement (ADR-0018) → **ENGINE.8**.
- Idempotency-key **store** internals (Redis SETNX, body-hash, TTLs, error envelopes) → **ADR-0015 / SPEC.2 §11**; the wrapper is idempotency-store-unaware.
- Pre-commit moderation internals (OpenAI, intent key, Track A/B) → **ADR-0014 / §10**; the wrapper is moderation-unaware.
- CPMM math / slippage formula → **ENGINE.2 / cpmm.md** (the callback calls it).
- Resolution flow (W-3 fan-out) → **ENGINE.9**.
- Anything `friendly_fire_events` (table, freeze, F-COMMENT-6/7/8) → **removed**; do NOT implement.
- The events-emit CI-lint rule → **HARDEN.\***.
- Constant **values** — `IN_FLIGHT_BET_TIMEOUT_SEC` (HARDEN.6), alarm-3 thresholds (HARDEN.\*), the two bet floors (number-tuning pass) → deferred; consumed as named constants only.
- The fine F-BET-6 in-flight window → **carry-forward** (S1).

### Dead pieces ADR-0013 still describes — we do NOT implement

- The `friendly_fire_events UPDATE frozen_at = now()` step in the F-BET-3/sell callback (ADR-0013 handler step 9, §6:253-257).
- F-COMMENT-8 friendly-fire freeze.
- The acceptance test `bets::concurrency-friendly-fire-freeze-atomic-with-sell` (ADR-0013 §10:306).
- Any `comments.stake_at_post_time` *logic* (the column survives **NOT NULL** on disk — see S3; `side_at_post_time` survives as INV-3).
- The 5-table lock-order string (ADR-0013 §2:168) — superseded by the 4-table order.

## The W-1 wrapper contract (what ENGINE.7 builds)

### Wrapper signature & responsibilities

`src/server/bets/transaction.ts` (`server-only`). Illustrative shape (final form settled in execute):

```ts
type BetFlow =
  | "F-BET-1" | "F-BET-2" | "F-BET-3"
  | "F-COMMENT-1" | "F-COMMENT-2" | "F-COMMENT-3";

interface LockedPool { id: string; marketId: string; yesReserves: string; noReserves: string }

export async function runBetTransaction<T>(
  args: { marketId: string; flow: BetFlow },
  callback: (ctx: { tx: DbTransaction; pool: LockedPool }) => Promise<T>,
): Promise<T>;
```

The wrapper owns exactly: SERIALIZABLE open · pool-row `FOR NO KEY UPDATE` lock by `market_id` · coarse market-state gate · invoke callback with the locked tx + pool · full-jitter retry · alarm-3 emission · `BetSerializationExhaustedError`. It owns **nothing** flow-specific (no CPMM, no Dharma tag, no event type, no idempotency, no moderation, no min-bet, no single-side friendly error).

### Pool-row lock (still-live ADR-0013)

`SELECT … FOR NO KEY UPDATE` — **not** `FOR UPDATE` (`FOR UPDATE` conflicts with `FOR KEY SHARE`, the lock Postgres takes implicitly on a parent row when a child INSERT validates its FK; it would serialize every concurrent `INSERT INTO positions/bets/comments` against the pool). The bet UPDATE touches only `yes_reserves`/`no_reserves`, never a PK/FK-target column, so the weaker lock is correct (SPEC.2 §9:983; ADR-0013 §1).

**Lock predicate (PLUS correction):** `pools WHERE market_id = $marketId FOR NO KEY UPDATE` — **not** `pools.id = marketId` (ADR-0013 §1:160's snippet conflates pool PK with market id; the schema has `pools.id` PK + `pools.market_id` UNIQUE FK — `markets.ts:57-68`). The caller knows `marketId`.

**API:** Drizzle **core** builder `.for('no key update')` (the relational query API does not expose `.for()`). No existing in-repo usage (`tos-accept.ts:118` notes its absence); ENGINE.7 is the first call site → **execute must verify the exact API form against postgres-js** before relying on it.

### Coarse market-state gate (ruling a)

After acquiring the pool lock, the wrapper does a **plain, UNLOCKED** `SELECT status FROM markets WHERE id = $marketId` in the same tx snapshot.

- **No row lock on `markets`** — it MUST NOT enter the lock-order spine. SERIALIZABLE/SSI catches a concurrent status flip as a serialization anomaly → 40001 → retry (no lost-update window). A row lock on `markets` here would order `pools → markets → …`, which **risks deadlock** against W-3 resolution's `markets → bets → … ` order (SPEC.2 §3.2:235). The MVCC read is correct and deadlock-free.
- **Deadlock-freedom is global, not gate-local.** This coarse unlocked read is the bet flow's **only** touch of `markets` — the flow takes **no `markets` row lock anywhere** (not in the wrapper, not in the callback). So the 4-table spine `pools → positions → dharma_ledger → events` can never collide with W-3's `markets → …` order: the two flows share no row-lock ordering surface at all.
- **`Open`** → run the callback.
- **non-Open** → throw `MarketNotOpenError` carrying the observed `status` (a **product** error, **not** retried — it has no SQLSTATE, so the retry filter rethrows it immediately). ENGINE.8 maps status → §15 code: `Closed → market_closed_at`, `Resolving → in_flight_timeout` (coarse reject-all), `Draft/Resolved/Voided/Frozen → reject` (ENGINE.8 picks the code, likely `market_not_open`).
- **Fine F-BET-6 window** (compare `request.created_at` to `markets.resolving_at` against `IN_FLIGHT_BET_TIMEOUT_SEC`) is **deferred** (S1 — column + constant absent). The coarse gate is conservative-safe: it rejects *all* Resolving-state bets, never admits one it shouldn't.

The state machine confirms only `Open` accepts bets (`markets/transitions.ts:34-42`: `Open → [Closed, Voided]`; betting is an `Open`-only affordance).

### Lock-order callback contract (rulings b + c)

The callback receives `{ tx, pool }` (pool reserves already locked) and performs the per-flow read-modify-write in the 4-table spine, terminating in the events insert. ADR-0013 step 7 reads **both** the positions row (F-BET-10) **and** the user's Dharma balance (F-BET-4) inside the locked snapshot before any write:

```
// READS, in the locked snapshot (ENGINE.8 logic; the wrapper takes no part):
read positions(user, market)   → single-side check (F-BET-10)     // ENGINE.11 read
read dharma balance(user)      → sufficiency check (F-BET-4)       // ENGINE.5 latest-ledger-row read
compute CPMM                   → computeBuy / computeSell           // ENGINE.2 (ruling c)
// WRITES, in the 4-table spine (events terminal):
positions     → upsertPositionDelta(tx, …)         // ENGINE.11
dharma_ledger → appendLedgerRow(tx, …)             // ENGINE.5, tag = bet_stake
( comments    → INSERT )  for comment-bearing bets // ENGINE.8; Bucket-A append; set stake_at_post_time (S3)
( bets        → INSERT )  comment_id = comment.id   // comment before bet (FK target); Bucket-A append
events        → insertEvent(tx, …)                 // ENGINE.6, TERMINAL
pools         → UPDATE reserves                      // the locked row; CPMM-derived
```

- **F-BET-4 Dharma balance read (INV-2 in-snapshot seam).** Before the `dharma_ledger` debit, the callback reads the user's running balance **inside** the wrapper's tx, on the pool-locked snapshot — so the sufficiency check observes the same snapshot as the reserves and the debit (a pre-transaction read could race a concurrent debit). The **read source** is the latest `dharma_ledger` row's `balance_after` (the running-total cursor; canonical query shape at `dharma/persist.ts:24-35` — `WHERE user_id = $u ORDER BY created_at DESC, id DESC LIMIT 1`). **There is no public ENGINE.5 balance-read export today** — that query lives only as the *private* `readLatestBalance` inside `persist.ts`. ENGINE.8 therefore either (i) consumes a small exported ENGINE.5 seam, e.g. `readBalance(tx, userId)` (carry-forward), or (ii) reads it once for the F-BET-4 check and threads the value into `appendLedgerRow({ previousBalance })` (the param exists for exactly this; safe for the single `bet_stake` row under the pool lock). The **friendly** `insufficient_dharma` 400 (F-BET-4) is ENGINE.8's; the **authoritative** backstop is `appendLedgerRow`'s `DharmaOverdraftError` + the storage `CHECK (balance_after >= 0)` (`dharma/ledger.ts:67-70`). The wrapper itself reads no balance and runs no check — generic.
- **(b) `insertEvent` is called by the CALLBACK, not the wrapper.** The wrapper is events-unaware. The tracker's "ENGINE.7 appends events via ENGINE.6" is satisfied by the callback's `insertEvent(tx, …)` running **inside** the wrapper's tx (event_type/payload/`flow_id` are per-flow; the wrapper cannot know them). `events` is terminal in the chain (SPEC.2 §9:991, §7.5:763).
- **(c) CPMM compute is in the CALLBACK.** It reads `pool.yesReserves`/`pool.noReserves` → `computeBuy`/`computeSell` (`cpmm/calculate.ts:57,109`) → derives shares + new reserves → writes. The wrapper is generic.

### Full-jitter retry (still-live ADR-0013)

```
wait_ms = floor(random_uniform(0, BACKOFF_BASES_MS[n]))   // n = 0-indexed retry
BACKOFF_BASES_MS   = [50, 100, 200]   // 3-retry budget = 1 initial + 3 = 4 attempts
RETRYABLE_SQLSTATES = { "40001", "40P01" }                 // serialization_failure + deadlock_detected
```

Retry re-runs the **whole tx body** (not just COMMIT). Constants co-located in `transaction.ts` (decision parameters of ADR-0013, NOT tunables — SPEC.2 §9:1003). Application errors (validation, slippage, FK violations not caused by 40P01, `MarketNotOpenError`, `PositionSingleSideError`) are NOT retried — they bubble immediately. Reference: Marc Brooker, "Exponential Backoff And Jitter" (AWS, 2015).

### Retry-purity contract (ruling f — FIRST-CLASS wrapper contract)

**The wrapper re-runs the entire callback on every attempt.** Therefore every caller (ENGINE.8) MUST:

- Generate all IDs — `event_id` (and, where app-generated, any id used for storage-layer idempotency) — at **handler-entry**, **once**, and close over them in the callback. **Never** regenerate per attempt.
- `event_id` is UUIDv7; `insertEvent` derives `created_at` from its millisecond prefix (NOT `now()`) and dedupes via `ON CONFLICT (event_id, created_at) DO NOTHING` (`events/insert.ts:58-62,125-137`). A regenerated `event_id` per attempt would drift `created_at` and defeat the dedupe.
- **Second governed field: `events.metadata.idempotency_key`.** Carried per bet endpoint (SPEC.2 §3.7:316) and emitted in the events row, it is likewise a **handler-entry value closed over** by the callback under the same purity discipline — stable across attempts. It is the field tying the storage-layer dedupe (above) to ENGINE.8's **API-boundary** idempotency (§11 / ADR-0015); a per-attempt-varying key would desynchronise the two layers.

Each failed attempt rolls back **fully**, so exactly-once is guaranteed by rollback; the stable `event_id` + `ON CONFLICT` is the defense-in-depth layer **and** guarantees `created_at` stability for audit/retry-correlation. (`bets.id` / `comments.id` are DB-default `uuidv7()` — safe under full rollback because an aborted attempt commits nothing; the contract specifically governs the **caller-supplied** `event_id`.) The wrapper documents this contract in its docstring; the property test (below) is its enforcement surface.

### Observability (alarm 3)

`Sentry.addBreadcrumb` per retry attempt (O(1); rides alongside any later event in scope). `Sentry.captureMessage('bet_serialization_exhausted', …)` **only** on terminal exhaustion — alarm 3, tagged with the last SQLSTATE + the originating flow (SPEC.2 §9:995; §17.2 row 3 names `src/server/bets/transaction.ts` as the trigger site). Threshold tuning is HARDEN.\*. Import from `@sentry/nextjs` (existing pattern: `rate-limit.ts:1`, `idempotency/cache.ts:2`).

### Errors

`src/server/bets/errors.ts` (`server-only`) — module-local classes mirroring the `cpmm/errors.ts` / `dharma/errors.ts` / `markets/errors.ts` pattern (`extends Error`, explicit `this.name` for ES2017 `instanceof`/`.name` survival). **S5 distinction:** unlike those modules' caller-bug sentinels, ENGINE.7's classes are **product** errors mapped to §15 codes and carry an observed-state discriminant:

- `BetSerializationExhaustedError` — carries the last SQLSTATE + flow → `error_bet_serialization_exhausted`, `error_type: unavailable` (S2; not `temporary_unavailable`), HTTP 503, `Retry-After: 1`.
- `MarketNotOpenError` — carries `status: MarketStatus` (the observed non-Open state) → ENGINE.8 maps to the §15 code (`market_closed_at` / `in_flight_timeout` / `market_not_open`).

### Postgres knobs (ADR-0013 recommendations → ENGINE.7 implements)

- `statement_timeout ~1000ms` set **inside** the bet tx (a stuck tx must not hold the pool lock indefinitely).
- `idle_in_transaction_session_timeout ~30s` at the pool/connection level (catch orphaned transactions). The `postgres()` client lives at `src/db/index.ts:13-16` — execute settles whether this is a connection option or a per-tx `SET LOCAL`. Values are recommendations, not tuned constants.

## The per-flow callback contract (ENGINE.8 consumes) + dependency call shapes

Verified signatures the ENGINE.8 callback calls inside the wrapper's tx:

| Call | Signature (verified) | Notes for the bet callback |
|---|---|---|
| Dharma balance read (F-BET-4) | **No public ENGINE.5 export today** — the read shape is `persist.ts:24-35`'s private `readLatestBalance` (latest `dharma_ledger.balance_after`) | Read in-snapshot **before** the debit. ENGINE.8 either consumes an exported `readBalance(tx, userId)` seam (carry-forward) or reuses the value as `appendLedgerRow({ previousBalance })`. Friendly `insufficient_dharma` 400 is ENGINE.8's; authoritative backstop is the debit's `DharmaOverdraftError` + `CHECK (balance_after >= 0)`. |
| `appendLedgerRow` | `appendLedgerRow(tx, {userId, amount, entryType, betId?, previousBalance?})` — `dharma/persist.ts:54` | Bet flow tag = **`bet_stake`** (`tags.ts:34`). Per-user serialization is the caller's job — provided by the pool lock. One `bet_stake` row per bet ⇒ no multi-row chaining; `previousBalance` is optional (pass the F-BET-4 read value, or let it re-read). |
| `upsertPositionDelta` | `upsertPositionDelta(tx, {userId, marketId, side, shareDelta, previousQuantity?})` — `positions/persist.ts:46` | **Do NOT pass `previousQuantity`** (S4) — the pool lock is the backstop; v1 wires no chaining. Single-side violation → `PositionSingleSideError`; the friendly F-BET-10 `opposite_side_held` 400 is ENGINE.8's handler-layer read predicate (`heldSideOrNull`). |
| `insertEvent` | `insertEvent(tx, input)` — `events/insert.ts:95` | Caller supplies `eventId` (UUIDv7, handler-entry, stable across retries); terminal write. |
| CPMM | `computeBuy({reserves, side, stake})` / `computeSell({reserves, side, shares})` — `cpmm/calculate.ts:57,109` | Pure; lowercase `"yes"|"no"` (caller case-translates from the `YES`/`NO` pgEnum). |

**S3 trap (for ENGINE.8 + the atomicity-test callback):** `comments.stake_at_post_time` is **NOT NULL** on disk (`comments.ts:55`) though vestigial/superseded — any comment INSERT MUST populate it. `comments.bet_id` is **nullable** (`:59`) — do NOT reconcile (DEBATE.8/9). FK order: comment first (`bet_id` null, `side_at_post_time` + `stake_at_post_time` set), then bet (`comment_id` = comment.id).

## File plan

| File | State | Contents |
|---|---|---|
| `src/server/bets/transaction.ts` | NEW | `runBetTransaction` wrapper; `BACKOFF_BASES_MS` / `RETRYABLE_SQLSTATES` co-located; pool lock; coarse gate; retry loop; alarm-3; retry-purity docstring. `server-only`. |
| `src/server/bets/errors.ts` | NEW | `BetSerializationExhaustedError`, `MarketNotOpenError`. `server-only`. |
| `tests/server/bets/concurrency.test.ts` | NEW | The 7 wrapper concurrency tests + the events-idempotency property test (ruling e/f). |
| `tests/invariants/I-ATOMICITY-001.bet-comment-atomic.spec.ts` | NEW | INV-1 wrapper-level atomicity (ruling d). |

No schema, no migration, no `src/db/` touch. (Hence no `@db-migration-reviewer`.)

## Thesis invariants touched

- **INV-1 (atomic bet+comment) — MINTED.** The wrapper *is* the mechanism (SPEC.2 §14.1:1358, §14.4:1396): one SERIALIZABLE tx wrapping the comment + bet (+ pools/positions/dharma/events) inserts; if any write throws, all roll back. ENGINE.7 lands the canonical `I-ATOMICITY-001` (ruling d).
- **INV-2 (no overdraft) — composed, not owned; the seam is now defined.** The wrapper provides the SERIALIZABLE + pool-lock layer the §14.2:1373 composition relies on. The other layers, all on ENGINE.8's callback (so ENGINE.8 inherits a defined seam, not an undefined one): (i) the **in-snapshot F-BET-4 balance read** before the `dharma_ledger` debit (latest-ledger-row `balance_after`, read inside the locked tx) → friendly `insufficient_dharma`; (ii) the **authoritative** `appendLedgerRow` overdraft guard (`DharmaOverdraftError`) + the storage `CHECK (balance_after >= 0)` (`dharma/ledger.ts:67-70`). ENGINE.7 does not re-test INV-2 (`I-NO-OVERDRAFT-001` exists).
- **INV-3 (side-bound at post time) — mechanism only.** The wrapper's SERIALIZABLE tx prevents a flip racing the side-binding, but the `comments.side_at_post_time` write lives in the ENGINE.8 callback → **`I-SIDE-BIND-001` belongs to ENGINE.8**, not ENGINE.7.
- **INV-4** — not relevant (resolution path, W-3 / ENGINE.9).

## Data model changes

None. (`bets`, `positions`, `comments`, `markets`, `pools`, `dharma_ledger`, `events` schemas all built and merged. `comments.bet_id` nullable + `comments.stake_at_post_time` NOT NULL are specs-ahead artifacts — NOT reconciled here, DEBATE.8/9.)

## API surface

None externally. `runBetTransaction` is an internal server-only primitive consumed by ENGINE.8's Server Actions / Route Handlers. No new routes, no new error-envelope wiring (ENGINE.8 maps the thrown classes to §15 codes).

## Failure modes

- **Serialization failure (40001) / deadlock (40P01):** retried per the full-jitter ladder; exhaustion → alarm 3 + 503.
- **Concurrent status flip (Open → Closed/Resolving mid-bet):** SSI aborts with 40001 → retry; the retried snapshot reads the new status → `MarketNotOpenError`. No lost-update.
- **Non-Open market at gate:** `MarketNotOpenError` (not retried) → ENGINE.8 → §15 400.
- **Single-side violation (callback):** `PositionSingleSideError` from `upsertPositionDelta` (not retried) → ENGINE.8 surfaces `opposite_side_held`.
- **Callback throws any non-retryable error — including PARTWAY through the spine** (e.g. after `dharma_ledger`, before `bets`/`events`): the partial chain rolls back **completely**, the error bubbles — atomicity holds for a partial-chain abort, not merely a last-step one. This is the canonical I-ATOMICITY-001 proof.
- **`statement_timeout` trip:** the tx aborts rather than holding the pool lock; surfaces as an error to ENGINE.8.

## Edge cases

- **Comment-free sell (F-BET-3):** callback omits the comment + bet-comment inserts; same wrapper, subset of the spine.
- **First-ever bet on a pool:** positions/ledger rows absent → the writers return canonical-zero bases (`positions/persist.ts:96-113`, `dharma/persist.ts:24-35`); upserts/appends create them.
- **Mid-spine abort (partial chain):** a throw after `dharma_ledger` but before `bets`/`events` unwinds the already-written `pools`/`positions`/`dharma_ledger` completely — zero rows persist. The canonical I-ATOMICITY-001 scenario (not just a terminal-step abort).
- **Retry after a partial callback:** impossible to leak — each attempt is a full tx; a 40001 abort rolls back everything before the retry.
- **`event_id` regenerated per attempt (anti-pattern):** caught by the events-idempotency property test (created_at drift / >1 row).

## Test plan (RED-first; CI-RED limitation)

`@test-writer` writes failing tests **first**, against this plan, before any implementation. The full DB-backed suite needs local Postgres on :54322; CI runs it on PR (the whole-suite-needs-Postgres convention — DB-backed specs are RED/skipped locally without it; `tests/unit/` is the DB-independent proxy).

**Invariant (ruling d) — `tests/invariants/I-ATOMICITY-001.bet-comment-atomic.spec.ts`:** the **canonical** assertion forces a **MID-SPINE** abort — a representative callback writes `pools` (UPDATE) + `positions` + `dharma_ledger`, then **throws PARTWAY**, after `dharma_ledger` and **before** the `comments`/`bets`/`events` writes — and asserts **zero rows persisted across ALL tables** (full-chain rollback, the strong proof: a partial chain unwinds completely, not just the last step). Variants: (a) the happy path — all rows present (including `comments` with `stake_at_post_time` + `side_at_post_time` populated per S3, and `bets.comment_id` → the comment) iff no throw; (b) an **edge** throw-*before*-`events` (after `bets`) — same zero-rows assertion, exercising the terminal-step abort. No `I-ATOMICITY-002` — ENGINE.8 full-flow atomicity is acceptance-level under `tests/server/bets/`.

**Concurrency (ruling e) — `tests/server/bets/concurrency.test.ts`, the 7 ENGINE.7-owned:**
1. `serializable-isolation-enforced` — the tx runs at SERIALIZABLE (write-skew between two concurrent same-pool txns aborts one with 40001).
2. `pool-row-lock-acquired` — concurrent `runBetTransaction` on the same pool serialize on the `FOR NO KEY UPDATE` row.
3. `no-key-update-allows-fk-share` — a concurrent FK-validating INSERT against the pool (`FOR KEY SHARE`) proceeds while a bet holds the pool lock (does NOT block) — the operative reason for `FOR NO KEY UPDATE`.
4. `canonical-lock-order` — the **4-table** spine `pools → positions → dharma_ledger → events` (asserts no `friendly_fire_events` step).
5. `retry-on-40001` — a forced serialization failure on attempt 1 is retried and succeeds.
6. `retry-on-40P01` — a forced deadlock is retried.
7. `retry-budget-exhausted-emits-alarm-3` — 4 consecutive failures → `captureMessage('bet_serialization_exhausted')` fires once + `BetSerializationExhaustedError` thrown (503/`Retry-After:1` mapping asserted at the class level).

**Events-idempotency property (ruling f) — same file, `bets::concurrency-retry-events-idempotent`:** force a 40001 on attempt 1 with a callback that calls `insertEvent` with a handler-entry `event_id`; after the successful retry assert **exactly one** `events` row AND its `created_at` equals the `event_id`-derived timestamp (stable across the retry — guards the retry-purity contract). NOT a named invariant.

**The 2 handler-level (→ ENGINE.8, recorded not built here):** `idempotency-replay-skips-moderation-and-txn`, `moderation-outside-transaction`.

**Harness note (schedule long-pole):** deterministically forcing 40001/40P01 and proving `FOR KEY SHARE` non-blocking needs a controlled two-connection harness (advisory locks / barrier + an injected fault for the forced-retry path). This is the bulk of the work.

## Out of scope (consolidated)

See "Scope resolution → Explicit OUT" + "Dead pieces". Headlines: ENGINE.8 handlers/idempotency-lookup/min-bet; ADR-0014/0015 internals; CPMM math; W-3 resolution; all `friendly_fire_events`; the events-emit CI-lint; constant values; the fine in-flight window.

## Execute ritual (full, no narrowing)

ENGINE.7 is the most write-contended path + Ultrathink-mandatory — full ritual:

1. **Plan ratified** (this doc) → committed before Phase 1 ends; Phase 2 references `@docs/plans/ENGINE.7.md`.
2. **`@test-writer` RED** — I-ATOMICITY-001 (wrapper-level) + the 7 concurrency tests + `bets::concurrency-retry-events-idempotent`, failing first. Passes `@docs/plans/ENGINE.7.md`.
3. **Implement** `transaction.ts` + `errors.ts` → green.
4. **`@code-reviewer`** (`src/server/` diff vs §2/§3 + stack patterns).
5. **`@security-auditor`** (after code-reviewer) — exploitability of the wrapper as a critical-path integration point (lock semantics, retry, fail posture).
6. **§5.10 pre-PR self-audit** — wrapper vs the plan's wrapper contract item by item; the assertion that proves INV-1 holds; the retry-purity contract present in the docstring.
7. `just verify` (`ZUGZWANG_ENV=preview`) + `pnpm test:invariants` + `pnpm test:integration` / `just test-db`.

**No `@db-migration-reviewer`** (no schema/migration). Subagent kickoffs pass `@docs/plans/ENGINE.7.md`. FAIL in scope → fix before PR; SURPRISE out of scope → `claude-progress.md` + STOP.

## Carry-forwards minted by this plan

- **Fine F-BET-6 in-flight window** — needs (i) a `markets.resolving_at` column (schema + migration — ENGINE.9-or-dedicated; set when a market enters Resolving) and (ii) `IN_FLIGHT_BET_TIMEOUT_SEC` (HARDEN.6). Until both land, the coarse gate rejects all Resolving-state bets. Record the ADR-0013 §7 ↔ schema drift in the SPEC.2 drift ledger when the column lands.
- **S4 (settled design, not a deferral):** the pool-row `FOR NO KEY UPDATE` lock IS the position-write serialization backstop; the bet-flow callback does **not** pass `previousQuantity` to `upsertPositionDelta`; the chaining path (`positions/persist.ts:30-38`) is intentionally unwired in v1.
- **F-BET-4 balance-read seam (ENGINE.8 prereq).** ENGINE.5 exposes **no public balance-read** today (the read lives only as the private `readLatestBalance`, `persist.ts:24`). ENGINE.8's in-snapshot F-BET-4 check needs either a small exported ENGINE.5 `readBalance(tx, userId)` helper or to thread the read value into `appendLedgerRow({ previousBalance })`. ENGINE.7 does not build it (wrapper is balance-unaware); recorded so ENGINE.8 inherits a defined seam.
- **`error_type` envelope wiring** (`error_bet_serialization_exhausted` → `unavailable`; the `MarketNotOpenError` → §15 code map) is ENGINE.8 / error-envelope work, not ENGINE.7.
- **`.for('no key update')` API verification** against postgres-js (first in-repo use) — confirm at execute step 3.

## ADRs needed

None new. ENGINE.7 implements ADR-0013 as superseded-and-reconciled by SPEC.2 §9 — no architectural change, so no ADR (per CLAUDE.md §5.12 a Patch record would only apply if the consumer surface needed scoping; the supersessions are already recorded in SPEC.2's change-log + ADR-0017 P1). The closing-ritual question ("should CLAUDE.md/AGENTS.md/tracker change?") is revisited at execute close-out.

## Open questions — RESOLVED (founder-ruled this cycle)

(a) gate = wrapper-level coarse, unlocked SELECT · (b) callback calls `insertEvent` · (c) CPMM in callback · (d) I-ATOMICITY-001 in ENGINE.7 wrapper-level · (e) 7/2 concurrency split · (f) events-idempotency = property test + retry-purity contract · S1 coarse-only/carry-forward · S2 `unavailable` canonical · S3 populate `stake_at_post_time` · S4 pool-lock-is-the-backstop (settled) · S5 product errors with status discriminant · lock predicate `market_id`. No open questions remain for execute.

## Context to preserve (for the plan-log)

- **Canonical SHA:** base `main` @ `2667140` (ENGINE.11 merged). Plan-merge SHA recorded at close-out (squash-merge on `main`).
- **Scope resolution:** ENGINE.7 = the generic W-1 wrapper (`transaction.ts` + `errors.ts`) only. 4-table lock order `pools → positions → dharma_ledger → events` (friendly-fire struck). Reply-as-bet: W-1 is every bet; W-2 retired. `FOR NO KEY UPDATE` on `pools.market_id`. Coarse market-state gate (Open vs not-Open; fine window deferred — no `resolving_at`). insertEvent/CPMM in the callback; wrapper generic + retry-purity contract. I-ATOMICITY-001 minted wrapper-level; INV-3 test → ENGINE.8. 7 wrapper concurrency tests + 1 events-idempotency property test; 2 handler tests → ENGINE.8.
- **Boundary:** ENGINE.7 = `transaction.ts` + `errors.ts`; ENGINE.8 = `place.ts`/`sell.ts` + idempotency lookup + two floors + the friendly single-side/min-bet codes + `I-SIDE-BIND-001` + the 2 handler concurrency tests.
- **Drifts:** S1 (`resolving_at` absent), S2 (`temporary_unavailable`→`unavailable`), S3 (`stake_at_post_time` NOT NULL vestigial), ADR-0013 §1 lock-predicate snippet (`id`→`market_id`).

## References

- SPEC.2 §3.1-§3.2 (handler stack + W-1), §3.7 (events-row contract), §7.5/§7.7 (write composition + `insertEvent`), §9 (concurrency — binding), §14 (invariant contract), §15 (error envelope), §17.2 (alarm 3).
- SPEC.1 v1.9.0 §5 (INV-1…4), §7 (F-BET-\*), §8 (F-COMMENT-\*).
- ADR-0013 (still-live: lock mode, retry, idempotency-ordering, moderation-outside, observability, error, file map; superseded: 5-table order, friendly-fire freeze, the dead acceptance test). ADR-0017 P1 + ADR-0018 (reply-as-bet / friendly-fire removal / two floors).
- Code: `src/server/bets/` (greenfield) · `events/insert.ts:95` · `dharma/persist.ts:54` + `tags.ts:34` · `positions/persist.ts:46` · `cpmm/calculate.ts:57,109` · `markets/transitions.ts:34` · `markets.ts:32-68` · `bets.ts` · `comments.ts:36-78` · `db/index.ts:13-20` · `auth/admin/login.ts:128` (SERIALIZABLE precedent).
