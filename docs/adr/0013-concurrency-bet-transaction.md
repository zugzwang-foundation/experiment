# ADR-0013 — Concurrency & Bet Transaction

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-05-07 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | SPEC.14 |
| **Frame document** | SPEC.2 §1.4 #5 (delegation), §9 (Concurrency & Transactions), §14 (Invariant Contract), §15 (Error Envelope), §23 (ADR Index) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

The bet handler is the most write-contended code path in the experiment. Every entry bet (F-BET-1) is an atomic write to six tables — `pools`, `positions`, `dharma_ledger`, `bets`, `comments`, `events` — and INV-1 (bet+comment atomicity) requires that all six commit or none do. Subsequent buys (F-BET-2) and sells (F-BET-3) write subsets of the same tables; F-BET-3 additionally triggers F-COMMENT-8 (friendly-fire freeze) inside the same transaction by updating `friendly_fire_events.frozen_at` for the user's votes in this market. Two concurrent users bidding on the same market hit the same `pools` row.

SPEC.2 §9 names the high-level shape: Postgres SERIALIZABLE transaction with pessimistic lock on the pool row, lock order `pools → positions → dharma_ledger → events`, retry on SQLSTATE 40001 with 50/100/200 ms jittered backoff, OpenAI moderation outside the transaction, idempotency-key replay returns cached response. The high-level decision (D2: drop the in-memory actor; use Postgres SERIALIZABLE + pessimistic pool-row lock) was ratified in SPEC.2 §2.2 RESOLVED block on 2026-05-04. This ADR ratifies the implementation specifics of that decision; D2 itself is not re-litigated here.

Six implementation questions remained open after D2:

1. **Pool-row lock mode.** `SELECT FOR UPDATE` or `SELECT FOR NO KEY UPDATE`?
2. **Canonical lock-order placement of `friendly_fire_events`** in the F-BET-3 chain.
3. **Idempotency-key check ordering** — before pre-commit moderation, or after?
4. **Jitter shape** on the 50/100/200 ms ladder — equal jitter vs full jitter vs decorrelated.
5. **SQLSTATEs to retry** — 40001 only, or 40001 + 40P01?
6. **Per-retry observability** — Sentry breadcrumb per attempt, or only on exhaustion?

This ADR ratifies all six.

This ADR does **not** decide:

- D2 itself (drop in-memory actor; SERIALIZABLE + pessimistic pool-row lock) — already RESOLVED in SPEC.2 §2.2 on 2026-05-04.
- Idempotency-key store shape: storage substrate (Redis vs Postgres-native), key envelope, body-hash discipline, lock-vs-result TTL split, error-envelope shapes for in-flight and body-mismatch cases — ADR-0015 / SPEC.16.
- Pre-commit moderation flow: 60-second Redis intent-reservation key, OpenAI HTTP call shape, Track A vs Track B routing, vendor — ADR-0014 / SPEC.15.
- Specific event-type names and `events.payload` Zod schemas emitted by the bet flow — ADR-0005 / `src/server/events/schemas.ts` / ENGINE.6.
- CPMM math + slippage formula — `cpmm.md` / ENGINE.1.
- Friendly-fire vote eligibility rules — SPEC.1 §8 F-COMMENT-6.
- `positions` table materialisation schema — ENGINE.11 + SCAFFOLD.2.
- Numeric value of `IN_FLIGHT_BET_TIMEOUT_SEC` — HARDEN.6 number-tuning pass.
- Postgres-side `statement_timeout` and `idle_in_transaction_session_timeout` values — implementation defaults at ENGINE.7; this ADR notes recommended ranges in Consequences only.

## Decision Drivers

1. **INV-1 atomicity is non-negotiable.** Bet and comment must commit together or roll back together. The bet handler runs as a single Postgres transaction; nothing in the retry, lock, or idempotency machinery may compromise this.

2. **Manifold-scale write contention is the wrong frame for the experiment.** The 5k peak target lives well within Postgres SERIALIZABLE's competence on a single primary. Architecture must be correct first, fast second.

3. **Avoid stronger-than-necessary locking.** The pool-row lock blocks every concurrent FK-validation read against `pools.id` from `positions`, `bets`, `comments`, and `friendly_fire_events`. The wrong lock mode silently turns unrelated comment posting into a serial workload.

4. **Lock-order discipline must be canonical, not per-flow.** Cross-flow contention (F-BET-1 vs F-BET-3 vs F-COMMENT-8 inside F-BET-3) deadlocks under any inconsistency. One lock order, applied uniformly.

5. **OpenAI moderation cannot be inside the transaction.** A 200–2000 ms HTTP call with a Postgres transaction held open is a Postgres anti-pattern (per ADR-0005 + SPEC.2 §10). The transaction wrapper must be moderation-unaware.

6. **Idempotency must short-circuit the moderation call too.** If a bet committed but the network dropped the response, the client retry with the same key must not pay for moderation a second time — both for cost and for moderation determinism. OpenAI's category scores are not stable across calls; a borderline-Track-B comment that passed first could fail on retry. A failed moderation on a successful first-attempt commit would corrupt the dataset.

7. **Retry exhaustion must be visible without being noisy.** A single 40001 retry is normal traffic; three consecutive failures is a signal worth Sentry alarm 3. Per-retry observability needs to be cheap.

8. **The decision must be defensibly cited.** Retry-jitter folklore is plentiful; the ADR cites the canonical AWS source.

## Considered Options

Six interlocking sub-decisions, each with an explicit verdict on the rejected alternatives. Pros/cons follow in `## Pros and Cons of the Options`.

### Pool-row lock mode (T4)

1. `SELECT … FOR UPDATE`
2. **`SELECT … FOR NO KEY UPDATE`** ← chosen
3. `SELECT … FOR SHARE`

### Canonical lock-order placement of `friendly_fire_events` (T2)

1. **Between `dharma_ledger` and `events` (chain: `pools → positions → dharma_ledger → friendly_fire_events → events`)** ← chosen
2. After `events`
3. Before `dharma_ledger`

### Idempotency-check ordering (T3)

1. **Idempotency check first in handler, before moderation, before transaction** ← chosen
2. Moderation first; idempotency check only before the DB transaction
3. Both checks in parallel

### Jitter shape (T1)

1. **Full jitter: `wait = random(0, base)`** ← chosen
2. Equal jitter: `wait = base/2 + random(0, base/2)`
3. Decorrelated jitter: `wait = min(cap, random(base, prev_wait * 3))`
4. No jitter (deterministic 50/100/200 ms)

### Retry SQLSTATEs (T5)

1. **40001 (`serialization_failure`) + 40P01 (`deadlock_detected`), same ladder** ← chosen
2. 40001 only

### Per-retry observability (T6)

1. **Sentry breadcrumb per retry attempt + Sentry custom event on exhaustion only** ← chosen
2. Sentry custom event per retry attempt
3. Exhaustion event only; no per-retry observability

## Decision Outcome

**Chosen across all six dimensions:** `SELECT … FOR NO KEY UPDATE` on the pool row; canonical lock order `pools → positions → dharma_ledger → friendly_fire_events → events` applied uniformly across F-BET-1/2/3 and F-COMMENT-6/7; idempotency check first in every bet handler before any moderation or transaction work; full jitter on bases [50, 100, 200] ms with a 3-retry budget; retry on both 40001 and 40P01; Sentry breadcrumb per retry attempt + Sentry custom event (alarm 3) only on exhaustion.

The bet transaction wrapper at `src/server/bets/transaction.ts` exposes a single helper that receives the bet payload and a callback containing the per-flow read-modify-write logic, opens a SERIALIZABLE transaction, acquires the pool-row `FOR NO KEY UPDATE` lock, runs the callback, and applies the retry policy on failure.

The full handler sequence — from request arrival to response — is:

```
1.  Auth gate (banned-user 403, F-BET-7) — pre-handler middleware
2.  Idempotency-key cache lookup (per ADR-0015 contract)
       → cache HIT (completed): return cached (status, body) — SHORT-CIRCUIT, no moderation, no transaction
       → cache HIT (in-flight):  return 409 request_in_progress (per ADR-0015)
       → cache MISS:             acquire idempotency lock and continue
3.  Pre-commit moderation (per ADR-0014, F-BET-1 entry case only)
       → Track A or Track B: abort, write moderation event, return F-MOD-* response
       → clean: continue
4.  Open SERIALIZABLE transaction
5.  In-flight Resolving check (F-BET-6, G6) — read market state inside transaction
       → state = Closed:                                          ROLLBACK, return 400 market_closed_at (F-BET-5)
       → state = Resolving and bet was initiated AFTER the flag:  ROLLBACK, return 400 in_flight_timeout (F-BET-6)
       → state = Open:                                            continue
6.  SELECT FOR NO KEY UPDATE on pools WHERE id = market_id
7.  Lock-order chain: read positions (user, market) — validate single-side rule (F-BET-10);
                      read user's dharma balance — validate F-BET-4 (insufficient_dharma)
8.  Compute CPMM share quantity / Dharma return (per cpmm.md)
9.  Per-flow writes in canonical order:
       pools (UPDATE reserves)
       positions (INSERT for entry; UPSERT for subsequent buy; UPDATE for sell)
       dharma_ledger (INSERT one row, tagged from INV-2 enum)
       friendly_fire_events (UPDATE frozen_at = now() for sell-to-zero — F-BET-3 + F-COMMENT-8 only;
                             no-op for F-BET-1 and F-BET-2)
       comments (INSERT — F-BET-1 entry only; F-BET-2/3 skip)  -- precedes bets to satisfy bets.comment_id FK
       bets (INSERT)
       events (INSERT — one row per state-mutating action, per ADR-0005)
10. COMMIT
11. Idempotency-key cache write: store (status, body) under the key with the 24-hour outer TTL
       (per ADR-0015 contract); release the in-flight lock
12. Return response
```

The numbered steps map to the implementation subsections below.

### 1. Pool-row lock: `SELECT … FOR NO KEY UPDATE`

The pool-row lock is `SELECT … FOR NO KEY UPDATE`, not `SELECT … FOR UPDATE`. Postgres 17's row-level lock conflict matrix (https://www.postgresql.org/docs/17/explicit-locking.html, §13.3.2, Table 13.3 "Conflicting Row-Level Locks") makes the difference operationally significant: `FOR UPDATE` conflicts with `FOR KEY SHARE`; `FOR NO KEY UPDATE` does not.

`FOR KEY SHARE` is the lock Postgres takes implicitly on a parent row whenever a child INSERT validates its foreign key against that parent. Every concurrent `INSERT INTO positions`, `INSERT INTO bets`, and (depending on the FK shape SCAFFOLD.2 chooses) `INSERT INTO comments` and `INSERT INTO friendly_fire_events` against the same market takes `FOR KEY SHARE` on the corresponding `pools` row during constraint validation. With `FOR UPDATE`, every such concurrent insert blocks behind every in-flight bet on that pool for the full duration of the bet's transaction, including the SERIALIZABLE commit phase. With `FOR NO KEY UPDATE`, those FK validations proceed concurrently.

The bet handler never modifies `pools.id` nor any column with a unique index that an FK uses as a target — the writes are to `yes_reserves`, `no_reserves`, and the CPMM constant only. The Postgres docs (§13.3.2) state explicitly: *"The `FOR UPDATE` lock mode is also acquired … by an `UPDATE` that modifies the values of certain columns. Currently, the set of columns considered for the `UPDATE` case are those that have a unique index on them that can be used in a foreign key."* The pool-row UPDATE in the bet handler does not satisfy that condition, so the matching UPDATE will already auto-acquire `FOR NO KEY UPDATE` internally; pre-acquiring the same lock on the read leg avoids a lock upgrade between the SELECT and the UPDATE.

Drizzle's core query builder exposes `.for('no key update')` natively. The pool-row lock acquisition reads:

```ts
const [pool] = await tx
  .select()
  .from(pools)
  .where(eq(pools.id, marketId))
  .for('no key update');
```

The `.for()` method is not yet available on Drizzle's relational query builder (`db.query.<table>.findFirst`) per upstream issue drizzle-team/drizzle-orm#4275. The bet transaction wrapper uses the core builder.

### 2. Canonical lock order

```
pools → positions → dharma_ledger → friendly_fire_events → events
```

This order applies uniformly to every flow that mutates more than one of the listed tables: F-BET-1 (entry — touches all five), F-BET-2 (subsequent buy — pools, positions, dharma_ledger, events), F-BET-3 (sell — pools, positions, dharma_ledger, friendly_fire_events, events), F-COMMENT-6 (friendly-fire vote cast — friendly_fire_events, events), F-COMMENT-7 (friendly-fire vote clear — friendly_fire_events, events). Flows that touch only a subset skip the unused steps but never reorder.

Placement rationale for `friendly_fire_events`: the table is read-and-updated only by sell-to-zero (F-BET-3 → F-COMMENT-8 freeze) and by friendly-fire vote cast/clear (F-COMMENT-6/7). Placing it after `dharma_ledger` and before `events` keeps every per-user write co-located in the chain (positions → dharma_ledger → friendly_fire_events are all per-user writes), with `events` as the terminal write per ADR-0005's read-model classification convention. Placing it earlier (before `dharma_ledger`) would split the per-user write block; placing it after `events` would violate the convention.

`bets` and `comments` are not in the canonical chain because they are not contention surfaces — neither is read in the lock-order discipline; both are write-only inside the transaction. Their write order within F-BET-1 is fixed (comment before bet, so `bets.comment_id` FK has a target), but neither participates in the cross-flow lock-order contract.

### 3. Idempotency check is the first step in every bet handler

Idempotency lookup runs before pre-commit moderation, before the SERIALIZABLE transaction opens, and before the pool lock is acquired. A cache hit (completed entry) returns the cached response and exits the handler — no OpenAI call, no Postgres transaction.

The rationale is a failure mode without this ordering: bet commits successfully, network drops the response on the way back to the client, client retries with the same idempotency key, server runs OpenAI moderation a second time before discovering the cached entry. Beyond cost, this re-enters a non-deterministic moderation path: OpenAI's category scores are not stable across calls, and a borderline-Track-B comment that passed on the first call could fail on the retry. A failed moderation on a successful first-attempt commit would corrupt the dataset.

The contract this ADR consumes from ADR-0015:

- A cache lookup executed as the first authenticated work in `src/server/bets/place.ts` and `src/server/bets/sell.ts`.
- A cached `(status, body)` payload returned verbatim on hit.
- A two-tier TTL: short lock TTL for the in-flight window; long outer TTL (24 hours per Stripe's published contract at https://docs.stripe.com/api/idempotent_requests) for the response replay. ADR-0015 owns the TTL values.
- A request-body fingerprint stored alongside the cached response so that a key reused with a different body produces a deterministic error response. ADR-0015 picks the wire shape (Stripe uses HTTP 400 with `code: idempotency_error`; Brandur Leach's reference implementation and the IETF Idempotency-Key draft use HTTP 409 with `error_params_mismatch`). This ADR does not pick — but flags that **HTTP 422 is not a valid choice** here; idempotency-key reuse is a conflict, not a payload-validity problem.

ADR-0015 must reflect this consumption: the idempotency cache lookup MUST be callable before any other server-side work in the bet handler. If ADR-0015 chooses a Postgres-native idempotency store (Brandur's pattern, `INSERT … ON CONFLICT DO NOTHING` on an `idempotency_keys` table — https://brandur.org/idempotency-keys) over Redis, the lookup is still the first step; the storage substrate is invisible to ADR-0013.

### 4. Retry policy: full jitter on bases [50, 100, 200] ms, retry on 40001 + 40P01

On SQLSTATE `40001` (`serialization_failure`) or `40P01` (`deadlock_detected`), the wrapper retries up to 3 times. The wait before retry attempt `n` (1-indexed: attempt 1 = first retry) is:

```
wait_ms = floor(random_uniform(0, base_ms[n - 1]))
where base_ms = [50, 100, 200]
```

This is the **full jitter** strategy from Marc Brooker's 2015 AWS Architecture Blog post *"Exponential Backoff And Jitter"* (https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/), still the canonical reference (May 2023 AWS update banner: *"After 8 years, this solution continues to serve as a pillar for how Amazon builds remote client libraries for resilient systems."*). The post's conclusion: *"Of the jittered approaches, 'Equal Jitter' is the loser. … The 'Full Jitter' approach uses less work, but slightly more time."*

Decorrelated jitter (the post's other top-tier option) is designed for unbounded retry loops where each attempt's upper bound grows multiplicatively from the previous random draw. With three pre-pinned base values, the growth mechanism is bypassed; full jitter is the operationally simpler choice and stateless across attempts.

Worst-case added latency from retries is `50 + 100 + 200 = 350 ms`; expected is ~175 ms. With CPMM transaction time ~10–50 ms per attempt, total p99 stays well under 1 second across the full 4-attempt budget (1 initial + 3 retries).

`40P01` (deadlock) shouldn't occur under canonical lock-order discipline, but if a future flow inadvertently violates the order, the retry is preferable to a crash. Sentry alarm 3's custom event tags the SQLSTATE so 40001 (expected contention) can be distinguished from 40P01 (almost certainly a code-path bug worth investigating). Application-level errors — bet-validation rejections, FK violations not caused by 40P01, slippage exceeded — are NOT retried; they bubble up immediately.

Reference TypeScript implementation:

```ts
const BACKOFF_BASES_MS = [50, 100, 200] as const;
const RETRYABLE_SQLSTATES = new Set(['40001', '40P01']);

async function runBetTxnWithRetry<T>(
  flow: 'F-BET-1' | 'F-BET-2' | 'F-BET-3',
  fn: (tx: PgTransaction) => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= BACKOFF_BASES_MS.length; attempt++) {
    try {
      return await db.transaction(fn, { isolationLevel: 'serializable' });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (!code || !RETRYABLE_SQLSTATES.has(code)) throw e;
      lastErr = e;
      if (attempt === BACKOFF_BASES_MS.length) break;
      Sentry.addBreadcrumb({
        category: 'bet.txn.retry',
        level: 'warning',
        data: { attempt: attempt + 1, sqlstate: code, flow },
      });
      const base = BACKOFF_BASES_MS[attempt];
      await sleep(Math.floor(Math.random() * base));
    }
  }
  Sentry.captureMessage('bet_serialization_exhausted', {
    level: 'error',
    tags: { sqlstate: (lastErr as { code?: string })?.code, flow },
  });
  throw new BetSerializationExhaustedError(lastErr);
}
```

`BetSerializationExhaustedError` is mapped to HTTP 503 by the Server Action error envelope per SPEC.2 §15: `error_code: bet_serialization_exhausted`, `Retry-After: 1`. This is distinct from F-BET-5 (HTTP 400 `market_closed_at`) and F-BET-6 (HTTP 400 `in_flight_timeout`).

### 5. Per-retry observability

`Sentry.addBreadcrumb` per retry attempt; `Sentry.captureMessage` only on terminal exhaustion (alarm 3 firing). Breadcrumbs are O(1) wire cost and ride alongside any subsequent Sentry event in the same scope, providing the post-hoc trail "the bet succeeded, but it took 3 retries — here's the SQLSTATE history." Custom events fire only on real escalations.

This satisfies ADR-0007 §4 alarm 3 verbatim: *"After 3× retries with jittered backoff, on still-40001 the wrapper raises a Sentry custom event tagged `bet_serialization_exhausted`. Indicates contention saturation; bet handler returns 503 to the client."* Breadcrumbs add no alarm noise.

### 6. F-BET-3 sell + F-COMMENT-8 friendly-fire freeze atomicity

F-BET-3 (sell-to-zero) writes `friendly_fire_events.frozen_at = now()` for every row matching `(voter_id = user_id AND market_id = market_id AND frozen_at IS NULL)` inside the SERIALIZABLE transaction, after `dharma_ledger` and before `events` per the canonical chain, in a single SQL UPDATE. The UPDATE is the Bucket B whitelist transition per ADR-0005's classification: `friendly_fire_events.frozen_at` is the only column that can ever be UPDATEd on this table, and only `NULL → timestamp` is permitted. The append-only trigger SQL on `friendly_fire_events` (per ADR-0005 §6) inspects OLD vs NEW and raises on any other diff.

The freeze is atomic with the position-zeroing UPDATE on `positions`: if either fails, both roll back. INV-1 is unaffected — F-BET-3 does not write a comment row (per SPEC.1 §7 F-BET-3, "comment record unaffected") — but the friendly-fire freeze is a derived invariant of F-BET-3 that the wrapper enforces.

### 7. In-flight Resolving window (F-BET-6, G6) interaction

Per SPEC.1 §16.1, `IN_FLIGHT_BET_TIMEOUT_SEC` is the window during which `Resolving`-state in-flight bets may commit (numeric value deferred to HARDEN.6 number-tuning pass). The check sequence inside the SERIALIZABLE transaction:

1. After acquiring `FOR NO KEY UPDATE` on the pool row, read `markets.state` and `markets.resolving_at`.
2. If `state = 'Closed'`: ROLLBACK, return 400 `market_closed_at` (F-BET-5).
3. If `state = 'Resolving'` AND `request.created_at > markets.resolving_at`: ROLLBACK, return 400 `in_flight_timeout` (F-BET-6).
4. If `state = 'Resolving'` AND `request.created_at <= markets.resolving_at` AND `now() - markets.resolving_at > IN_FLIGHT_BET_TIMEOUT_SEC`: ROLLBACK, return 400 `in_flight_timeout`.
5. If `state = 'Open'`: continue.

The check is intra-transaction because the market-state read must observe the same snapshot as the pool reserves. A pre-transaction check is insufficient: the state could flip between the pre-check and the pool lock.

`request.created_at` is captured at handler entry (step 1 in the high-level sequence) and threaded through to step 5 via the wrapper's payload. The wrapper does not synthesize timestamps internally.

### 8. OpenAI moderation outside the transaction

The pre-commit moderation flow (ADR-0014, F-BET-1 entry case only) runs entirely before step 4 (transaction open). It owns its own intent-reservation key in Redis (60-second TTL per ADR-0014) so that two concurrent F-BET-1 attempts on the same `(user_id, market_id, idempotency_key)` triple don't both pay for moderation.

ADR-0013's contract with ADR-0014: the bet transaction wrapper assumes moderation has either succeeded or is irrelevant by the time it runs. F-BET-1 callers invoke moderation before calling the wrapper; F-BET-2 and F-BET-3 callers skip it (no comment to moderate). The wrapper itself is moderation-unaware — passing moderation context into the wrapper would re-introduce the "Postgres transaction held open across HTTP call" anti-pattern.

### 9. Single source of truth file map

| Concern | Source-of-truth file |
|---|---|
| Bet transaction wrapper (SERIALIZABLE open, pool-row lock, retry loop, lock-order callback contract) | `src/server/bets/transaction.ts` |
| Per-flow bet handlers consuming the wrapper | `src/server/bets/place.ts` (F-BET-1/2), `src/server/bets/sell.ts` (F-BET-3) |
| `BetSerializationExhaustedError` class | `src/server/bets/errors.ts` |
| Retry policy constants (`BACKOFF_BASES_MS`, `RETRYABLE_SQLSTATES`) | `src/server/bets/transaction.ts` (co-located with the wrapper; not extracted to config because they are decision parameters of this ADR, not tunables) |
| Sentry alarm 3 emission site | `src/server/bets/transaction.ts` (per ADR-0007 §4 catalogue; threshold values deferred to HARDEN.*) |
| Idempotency-key cache lookup site | `src/server/bets/place.ts` and `src/server/bets/sell.ts`, first call after auth gate (per ADR-0015) |
| Pool-row lock SQL | Inline in the bet transaction wrapper; uses Drizzle's `.for('no key update')` |
| Acceptance test file | `tests/server/bets/concurrency.test.ts` |

### 10. Acceptance tests minted (consumed by SPEC.1 §17)

Ten new rows under the `bets::concurrency-*` family in SPEC.1 §17:

| Test | Section | Invariants |
|---|---|---|
| `bets::concurrency-serializable-isolation-enforced` | ADR-0013 §1 | INV-1 |
| `bets::concurrency-pool-row-lock-acquired` | ADR-0013 §1 | INV-1 |
| `bets::concurrency-no-key-update-allows-fk-share` | ADR-0013 §1 | — |
| `bets::concurrency-canonical-lock-order` | ADR-0013 §2 | INV-1 |
| `bets::concurrency-retry-on-40001` | ADR-0013 §4 | INV-1 |
| `bets::concurrency-retry-on-40P01` | ADR-0013 §4 | INV-1 |
| `bets::concurrency-retry-budget-exhausted-emits-alarm-3` | ADR-0013 §4, §5 | — |
| `bets::concurrency-idempotency-replay-skips-moderation-and-txn` | ADR-0013 §3 | INV-1 |
| `bets::concurrency-friendly-fire-freeze-atomic-with-sell` | ADR-0013 §6 | — |
| `bets::concurrency-moderation-outside-transaction` | ADR-0013 §8 | INV-1 |

## Pros and Cons of the Options

### Pool-row lock mode (T4)

**Option 1 — `SELECT FOR UPDATE` (rejected).** Pros: the most universally understood lock mode; matches the SPEC.2 §9 wording verbatim as drafted. Cons: conflicts with `FOR KEY SHARE`, blocking every concurrent `INSERT` against any table with an FK to `pools.id` for the duration of every in-flight bet on that pool. With the v1 surface (positions, bets, comments, friendly_fire_events all FK to pools via market_id), this is a meaningful contention surface. The Postgres community itself flags this case as the canonical anti-pattern (Cybertec: *"Unless you plan to delete a row or modify a key column, you should use `SELECT FOR NO KEY UPDATE`."* — https://www.cybertec-postgresql.com/en/select-for-update-considered-harmful-postgresql/). **Verdict: rejected.** The SPEC.2 §9 wording predates this distinction and is updated alongside this ADR.

**Option 2 — `SELECT FOR NO KEY UPDATE` (chosen).** Pros: same correctness guarantees for our workload (we never modify pool primary keys or any FK target column); doesn't conflict with `FOR KEY SHARE`; matches the lock the corresponding `UPDATE` would auto-acquire anyway; native Drizzle support via `.for('no key update')`. Cons: less universally recognized at code-review time; Drizzle's relational query API doesn't expose it (use the core builder). **Verdict: chosen.** The ergonomic cost is one comment line; the contention reduction is real.

**Option 3 — `SELECT FOR SHARE` (rejected at glance).** Read-only locks don't prevent the concurrent UPDATEs we need to serialize against. **Verdict: rejected — incorrect for read-modify-write semantics.**

### Canonical lock-order placement of `friendly_fire_events` (T2)

**Option 1 — between `dharma_ledger` and `events` (chosen).** Pros: keeps per-user writes co-located in the chain (positions → dharma_ledger → friendly_fire_events are all per-user writes); `events` stays terminal per ADR-0005 convention; consistent across F-BET-3, F-COMMENT-6, F-COMMENT-7. **Verdict: chosen.**

**Option 2 — after `events` (rejected).** Cons: violates ADR-0005's read-model classification convention that `events` is always the terminal write of any state-mutating transaction. **Verdict: rejected.**

**Option 3 — before `dharma_ledger` (rejected).** Cons: splits the per-user write block (positions and dharma_ledger are also per-user). Less internal coherence; no contention benefit. **Verdict: rejected.**

### Idempotency-check ordering (T3)

**Option 1 — first in handler (chosen).** Pros: short-circuits both moderation and transaction on retried-after-success requests; protects against non-deterministic moderation re-runs; matches Stripe's published contract (*"incoming requests with the same key return the same result, including 500 errors."* — https://docs.stripe.com/api/idempotent_requests). **Verdict: chosen.**

**Option 2 — after moderation, before transaction (rejected).** Cons: pays for OpenAI a second time on every successful-then-network-dropped request. Re-runs OpenAI's non-deterministic moderation, opening a window where the second-attempt moderation result diverges from the first-attempt cached one. **Verdict: rejected.**

**Option 3 — both checks in parallel (rejected).** Cons: a parallel OpenAI call that's never used burns money and time; complexity of cancellation logic exceeds any latency saving. **Verdict: rejected.**

### Jitter shape (T1)

**Option 1 — full jitter (chosen).** Pros: AWS-canonical (Brooker 2015, May 2023 update banner); stateless across attempts; bounded above by base; spreads thundering herds maximally. **Verdict: chosen.**

**Option 2 — equal jitter (rejected).** Cons: Brooker 2015 conclusion verbatim: *"'Equal Jitter' is the loser."* Slightly more work than full jitter, slightly longer total time. **Verdict: rejected.**

**Option 3 — decorrelated jitter (rejected).** Pros: AWS-tier alternative to full jitter for unbounded retry loops. Cons: requires per-attempt state (`prev_wait`); the growth mechanism is bypassed when bases are pre-pinned. **Verdict: rejected.** Designed for a workload we don't have.

**Option 4 — no jitter (rejected).** Cons: defeats the purpose of jitter in the first place — concurrent retries collide deterministically. **Verdict: rejected.**

### Retry SQLSTATEs (T5)

**Option 1 — 40001 + 40P01 (chosen).** Pros: covers both the expected case (serialization failure under contention) and the unexpected one (deadlock under lock-order violation); Sentry tag distinguishes them on alarm 3 firing. **Verdict: chosen.**

**Option 2 — 40001 only (rejected).** Cons: a single deadlock crashes the request to the client when a retry would likely have succeeded; no observability gain (40P01 is rare enough that retry-and-log is preferable to crash-and-page). **Verdict: rejected.**

### Per-retry observability (T6)

**Option 1 — breadcrumb per retry + custom event on exhaustion (chosen).** Pros: O(1) wire cost; provides the post-hoc trail without alarm noise; alarm 3 fires only on real escalations. **Verdict: chosen.**

**Option 2 — custom event per retry (rejected).** Cons: every transient contention event becomes a Sentry alarm; floods the inbox; defeats alarm-as-signal discipline. **Verdict: rejected.**

**Option 3 — exhaustion event only, no per-retry trail (rejected).** Cons: post-hoc debugging of "succeeded after 3 retries" is then impossible; the breadcrumb cost is too low to justify skipping. **Verdict: rejected.**

## Consequences

### Positive

- INV-1 atomicity is mechanically guaranteed by the SERIALIZABLE transaction wrapper; no application-layer atomicity discipline needed.
- Cross-flow contention with comment posting and friendly-fire vote casting is bounded by `FOR NO KEY UPDATE` semantics; the pool-row lock no longer serializes unrelated writes that FK-validate against the pool.
- Lock-order discipline is canonical and SCAFFOLD.2-greppable: any flow that takes any of the listed locks must take them in this order.
- Idempotency-replay protects both transaction and moderation budgets; cost of OpenAI is bounded by unique requests, not by retry count.
- Retry exhaustion is observable as alarm 3 with SQLSTATE tagging; per-retry breadcrumbs survive in Sentry scope for debugging.
- Full-jitter formula is one line; reference implementation lives co-located with the wrapper.

### Negative

- `SELECT FOR NO KEY UPDATE` requires using Drizzle's core query builder (`db.select().from(...)`) rather than the relational query API for the pool-row lock; this is one ergonomic concession.
- The bet transaction wrapper centralizes a lot of policy (isolation, lock mode, lock order, retry, alarm emission); a bug in the wrapper affects every bet flow. Mitigation: the wrapper is small (~50–80 LOC), test-saturated, and ENGINE.7 carries the `Ultrathink mandatory` flag in the tracker.
- Idempotency-first ordering means that a poisoned cache entry (stored response body that's somehow malformed) replays on every retry until the 24-hour outer TTL expires. ADR-0015's response storage discipline is the mitigation surface.
- Postgres `statement_timeout` should be set to ~1000 ms inside the bet transaction (recommendation, not pinned by this ADR — ENGINE.7 implements). Without a statement timeout, a stuck transaction holds the pool lock indefinitely. `idle_in_transaction_session_timeout` should be set globally at the connection-pool level (~30 s) to catch any orphaned transaction.

### Future considerations

- ADR-0015 may want to revisit Redis vs Postgres-native idempotency storage. Brandur Leach's reference implementation (https://brandur.org/idempotency-keys) puts idempotency keys in a Postgres table with `INSERT … ON CONFLICT DO NOTHING` for atomic create-or-fetch, trading one extra Postgres roundtrip per request for elimination of the Redis dependency on the bet's hot path. Stripe itself uses this pattern internally per Brandur's blog. ADR-0015 owns this call.
- Lock-mode optimisation is a single-knob upgrade path: if future profiling shows pool-row contention spikes under specific market patterns (e.g., resolution windows), the lock mode is the first parameter to revisit. Replacing `FOR NO KEY UPDATE` with optimistic concurrency (`UPDATE … WHERE reserves = previous_reserves`) is the documented fallback, not a re-litigation of D2.
- The fallback documented in SPEC.2 §2.2 RESOLVED block (single Fly.io worker as actor) remains the contingency if post-launch measurement shows sustained hot-market contention or function-timeout pressure. ADR-0013 does not pre-commit to that fallback; it remains a SPEC.2-recorded option.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.2 §1.4 #5 | Delegated decision | Bet transaction concurrency model implementation specifics — ratified by this ADR. |
| SPEC.2 §2.2 RESOLVED block (D2) | D2 ratification | Consumes: SERIALIZABLE + pessimistic pool-row lock + lock order + retry shape + OpenAI-outside-transaction. This ADR ratifies the implementation details, not the high-level ratification. |
| SPEC.2 §9 | Concurrency contract | Substance previously stub-only; this ADR is the named substance. Back-pressure: §9 absorbs (a) pool-row lock as `SELECT FOR NO KEY UPDATE` (refining the §9 wording from `FOR UPDATE`), (b) lock order extended with `friendly_fire_events`, (c) retry SQLSTATE set extended to include 40P01, (d) full-jitter formula citation, (e) Sentry breadcrumb-per-attempt + alarm-3-on-exhaustion observability shape. |
| SPEC.2 §14 (stub) | Invariant contract | Mints: INV-1 (bet+comment atomicity) is enforced by the bet transaction wrapper at `src/server/bets/transaction.ts` opening a single Postgres SERIALIZABLE transaction wrapping comment INSERT, bet INSERT, and event INSERT, with retry-on-serialization-failure transparent at the wrapper boundary. Back-pressure: §14's invariant-mechanism table cites this file path. |
| SPEC.2 §15 | Error envelope | Mints: `bet_serialization_exhausted` error code, HTTP 503, `Retry-After: 1`. Distinct from `market_closed_at` (HTTP 400) and `in_flight_timeout` (HTTP 400). Back-pressure: §15 absorbs the new error code on the next §15 drafting pass. |
| SPEC.2 §23 | ADR Index | Status of ADR-0013 flips from `provisional` to `accepted` on this commit. |
| SPEC.1 §5 INV-1 | Bet+comment atomicity | Implemented by SERIALIZABLE transaction wrapping both inserts (per the wrapper at `src/server/bets/transaction.ts`). |
| SPEC.1 §5 INV-2 | Dharma flow tagging | Consumed: every `dharma_ledger` row written inside the wrapper carries a tag from the fixed enum. The wrapper does not enforce the tag itself — tagging is per-flow caller responsibility (F-BET-1/2/3 each pass the appropriate tag). |
| SPEC.1 §5 INV-3 | `comments.side_at_post_time` frozen | Consumed: the wrapper writes the comment row in F-BET-1 with `side_at_post_time` set from the bet payload; the immutability is enforced by the BEFORE UPDATE trigger on `comments` per ADR-0005, not by this ADR. |
| SPEC.1 §5 INV-4 | Resolutions append-only | Not relevant to the bet flow; named here for completeness. |
| SPEC.1 §7 F-BET-1 | Entry bet+comment atomic | Consumed: F-BET-1 calls the wrapper with a callback that, after moderation has already passed, does state checks → pool lock → CPMM compute → write comment, bet, dharma_ledger, events. |
| SPEC.1 §7 F-BET-2 | Subsequent buy | Consumed: F-BET-2 calls the wrapper with a callback that does state checks → pool lock → single-side validation → CPMM compute → write positions UPSERT, bet, dharma_ledger, events. |
| SPEC.1 §7 F-BET-3 | Sell — in-stream exit + friendly-fire freeze | Consumed: F-BET-3 calls the wrapper with a callback that does state checks → pool lock → CPMM compute → write positions UPDATE, dharma_ledger, friendly_fire_events UPDATE (frozen_at = now() for sell-to-zero), bet, events. The friendly-fire freeze and the position update are atomic. |
| SPEC.1 §7 F-BET-5 | Market closed mid-bet | Consumed: state check inside the wrapper after pool-lock acquisition; ROLLBACK + 400 `market_closed_at` if state = Closed. |
| SPEC.1 §7 F-BET-6 | Market resolving mid-bet | Consumed: state check inside the wrapper after pool-lock acquisition; ROLLBACK + 400 `in_flight_timeout` per G6. `IN_FLIGHT_BET_TIMEOUT_SEC` value pending HARDEN.6. |
| SPEC.1 §7 F-BET-7 | Banned user | Consumed: pre-handler middleware check, before idempotency lookup. |
| SPEC.1 §7 F-BET-9 | Slippage | Consumed: response payload includes post-trade price; client-side modal logic owned by UI.4. |
| SPEC.1 §7 F-BET-10 | Single-side rule | Consumed: positions read inside the wrapper validates current side; mismatch → ROLLBACK + 400 `opposite_side_held` before any writes. |
| SPEC.1 §8 F-COMMENT-8 | Friendly-fire freeze on exit-to-zero | Consumed: triggered automatically inside F-BET-3's wrapper callback when sell is to zero. Atomic with the rest of F-BET-3. |
| SPEC.1 §16.1 | `IN_FLIGHT_BET_TIMEOUT_SEC` | Consumed as a constant; value deferred to HARDEN.6. |
| SPEC.1 §17 | Acceptance tests | Mints: ten new `bets::concurrency-*` rows. SPEC.1 §17 absorbs on next drafting pass; this ADR's §10 lists them verbatim. |
| ADR-0003 | Node.js runtime | Consumed: the bet transaction wrapper imports Drizzle and runs on the Node.js runtime per ADR-0003's pin on `src/server/bets/`. |
| ADR-0005 | Pattern A + read-model targets | Consumed: `pools`, `positions`, `bets`, `comments`, `dharma_ledger`, `friendly_fire_events`, `events` are all in the synchronous read-model target list — same-transaction writes per Pattern A. |
| ADR-0005 | `friendly_fire_events` Bucket B classification | Consumed: `frozen_at` is the whitelisted `NULL → timestamp` transition. The wrapper UPDATE complies; the BEFORE UPDATE trigger on `friendly_fire_events` enforces it. |
| ADR-0006 | Postgres 17 on Supabase Pro `ap-south-1` | Consumed: the wrapper's `isolationLevel: 'serializable'` and `.for('no key update')` are Postgres 17 features. |
| ADR-0007 §4 alarm 3 | 40001-retry exhaustion alarm | Consumed: this ADR is the named source of the Sentry custom event; emission site pinned in the file map. |
| ADR-0008 | Drizzle ORM | Consumed: `db.transaction(...)` with `{ isolationLevel: 'serializable' }`; `.for('no key update')` on the core query builder; `sql\`...\`` template available for hot-path raw queries inside the wrapper if ENGINE.7 measures them. |
| ADR-0014 (gating) | Pre-commit moderation | Consumes: moderation runs before the wrapper is invoked, owns its own Redis intent-reservation key (60s TTL). The wrapper is moderation-unaware. |
| ADR-0015 (gating) | Idempotency-key store | Consumes: idempotency lookup is the first call in every bet handler; cache hit short-circuits before moderation and before the wrapper. ADR-0015 owns storage substrate, key envelope, body-hash discipline, and error-envelope shapes for in-flight and body-mismatch cases (HTTP 422 explicitly excluded as a valid choice). |
| Tracker | ENGINE.7, ENGINE.8 | All depend on this ADR being `accepted`. |

## More Information

- Postgres 17 row-level lock conflict matrix: https://www.postgresql.org/docs/17/explicit-locking.html (§13.3.2, Table 13.3 *"Conflicting Row-Level Locks"*)
- Postgres SQLSTATE catalogue (40001 `serialization_failure`, 40P01 `deadlock_detected`): https://www.postgresql.org/docs/17/errcodes-appendix.html
- Cybertec, *"SELECT FOR UPDATE considered harmful in PostgreSQL"*: https://www.cybertec-postgresql.com/en/select-for-update-considered-harmful-postgresql/
- Drizzle ORM lock modes (issue #2875, undocumented but stable): https://github.com/drizzle-team/drizzle-orm/issues/2875
- Marc Brooker, *"Exponential Backoff And Jitter"*, AWS Architecture Blog, 4 Mar 2015 (with May 2023 confirmation banner): https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
- AWS Builders' Library, *"Timeouts, retries, and backoff with jitter"*: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- Stripe API reference, *"Idempotent requests"*: https://docs.stripe.com/api/idempotent_requests (cited for response-replay semantics; ADR-0015 owns full consumption)
- Brandur Leach, *"Implementing Stripe-like Idempotency Keys in Postgres"*: https://brandur.org/idempotency-keys
- ADR-0005 (Postgres + event sourcing): synchronous read-model targets, Pattern A, append-only triggers, `friendly_fire_events` Bucket B classification
- ADR-0006 (Hosting): Postgres 17 on Supabase Pro `ap-south-1`
- ADR-0007 (Observability): Sentry alarm 3 catalogue entry
- ADR-0008 (Drizzle ORM): `db.transaction(...)`, `.for()` API, `sql\`...\`` template
- SPEC.1 §5 (INV-1/2/3/4), §7 (F-BET-1 through F-BET-10), §8 F-COMMENT-8, §16.1 (`IN_FLIGHT_BET_TIMEOUT_SEC`), §17 (acceptance tests)
- SPEC.2 §9 (Concurrency & Transactions), §14 (Invariant Contract), §15 (Error Envelope), §23 (ADR Index)

---

*ADR-0013 ratifies the bet transaction concurrency model for the Zugzwang experiment phase: Postgres SERIALIZABLE isolation, pool-row pessimistic lock via `SELECT … FOR NO KEY UPDATE`, canonical lock order `pools → positions → dharma_ledger → friendly_fire_events → events`, full-jitter retry on SQLSTATE 40001 and 40P01 with bases [50, 100, 200] ms and a 3-retry budget, Sentry breadcrumb per attempt with custom event (alarm 3) on exhaustion, idempotency-key cache lookup as the first authenticated step in every bet handler short-circuiting both moderation and transaction on completed-cache hit, and OpenAI moderation outside the transaction per ADR-0014. The bet transaction wrapper at `src/server/bets/transaction.ts` is the single source of truth; ENGINE.7 implements. The decision body and the file-map subsection are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
