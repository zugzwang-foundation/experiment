# ADR-0029 — Dharma-ledger total-order contract (`seq`)

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-07-04 |
| **Deciders** | Hrishikesh (founder) |
| **Tracker task** | AUDIT-FIX-B2 |
| **Frame document** | AUDIT.1 master report finding A2; `docs/plans/AUDIT-FIX-B2.md` |
| **Supersedes** | — (refines ADR-0016 §Consequences/Negative cross-row-ordering guidance, *for `dharma_ledger` only*) |
| **Superseded-by** | — |

**This ADR does not decide:** the TRUNCATE storage guard (ADR-0030); a dedicated non-owner runtime role (parked, pre-Sep-15 target, `parked.md` OQ-2); the strict seq-ordered "D2-C" drift derivation (parked fast-follow, `parked.md` OQ-3).

## Context and Problem Statement

`dharma_ledger` is an append-only Bucket-A table (ADR-0005): every Dharma balance change is a new row carrying `balance_after`, and the running balance is read back by `readLatestBalance` (`src/server/dharma/persist.ts`). Until this ADR that read ordered by `(created_at DESC, id DESC) LIMIT 1`. Both keys fail to totally-order the rows a single transaction writes for one user:

- **`created_at` is transaction-frozen.** It defaults to `now()`, which in Postgres is the transaction start instant — so *every* row a multi-row same-user transaction appends shares an identical `created_at`. It cannot distinguish them.
- **`id` cannot break the tie.** The PK is the userspace `uuidv7()` (ADR-0016). Its millisecond prefix is correct across milliseconds, but the sub-millisecond bits are filled from `gen_random_uuid()` — random. Two inserts in the same wall-clock millisecond therefore order **randomly** under `id DESC`. ADR-0016 §Consequences/Negative already recorded that `uuidv7()` guarantees strict monotonicity *per backend process only, not across the Supavisor pool* (ADR-0006), and instructed downstream code to "sort by `created_at` for cross-row chronological ordering and not assume `id(N+1) > id(N)`." That instruction is **insufficient for this table**: `created_at` cannot order same-transaction rows, which is exactly the case that arises here.

The in-transaction *writer* is safe — it chains each new row off the prior `balance_after` it computed (`previousBalance`), a contract fully discharged across `place.ts`, `accrual.ts`, and `settle/void/correct`. The exposure is the *next, separate* transaction's read: over a committed same-`created_at` tie-group it can return the chain-**earlier** row, whose stale `balance_after` then becomes the base of the next appended row — silently **minting or burning Dharma**. `CHECK (balance_after >= 0)` (INV-2) cannot see it: both the correct and the forked balance are non-negative. The only detector is the nightly `dharma_chain_drift` check — now drained to Sentry as of AUDIT-FIX-B1.

This is not a security-boundary defect (it is probability-gated, no auth/legal boundary), but it silently corrupts the Dharma ledger — the dataset released 2026-11-06 and the sole source `K_eff` is derived from. It is therefore treated co-priority with the A1 CSAM fix, for a different reason.

The modal producers, verified on the live tree: the first commented bet of each UTC day (`accrueDailyCredit` appends `daily_allowance` immediately before `place()` appends `bet_stake`, one W-1 transaction); and the per-user multi-leg loops in `settle`/`void`/`correct` (adjacent inserts one round-trip apart). A settle-then-correct sequence realizes a fork with zero user action.

## Decision Drivers

- Correctness of the released dataset and of `K_eff` (the ledger is the sole source).
- INV-2 integrity against silent mint/burn that the non-negativity CHECK cannot catch.
- A **deterministic** total order, resolved at the source rather than reconstructed at read time.
- Minimal `src/` delta and append-only-safety (no in-place mutation of existing rows).

## Considered Options

- **(a)** A strictly monotonic per-row ordering key — `seq BIGINT GENERATED ALWAYS AS IDENTITY` — and order the latest-row read on it.
- **(b)** Keep the schema; resolve same-`created_at` ties at read time by walking the `balance_after` implied-predecessor chain.

## Decision Outcome

**Chosen: (a).** Add `dharma_ledger.seq BIGINT GENERATED ALWAYS AS IDENTITY` and a unique index on `(user_id, seq)`; `readLatestBalance` orders by `seq DESC LIMIT 1`.

`seq` is the **total-order contract** for the ledger. Because per-user write serialization is already the caller's obligation (`persist.ts` D-2 under SERIALIZABLE/SSI), per-user `seq` order **≡ insert order ≡ chain order**. Cross-user interleaving of the global sequence is irrelevant because the balance read is always per-user (`WHERE user_id = ? ORDER BY seq DESC`). The `previousBalance` chaining contract is retained but **demoted** from the sole correctness mechanism to an in-transaction optimization; correctness of cross-transaction reads now rests on `seq`.

**Append-only-safety.** `ADD COLUMN … GENERATED ALWAYS AS IDENTITY` is DDL: it fires no row-level triggers (the Bucket-A append-only guard is untouched) and performs no app-level `UPDATE`. Existing rows receive `seq` values during the table rewrite (`ACCESS EXCLUSIVE`, trivial at this size). `GENERATED ALWAYS` is verified compatible with every existing `INSERT` (all use explicit column lists that omit `seq`; sweep-confirmed) and rejects any app-supplied value. Column mode is `"number"` (the app never reads `seq` — it exists only for the SQL `ORDER BY` — so no JS `bigint`-precision concern arises; the sequence will not approach 2^53 in the experiment).

**Backfill caveat + mitigation.** The order in which *existing* rows are assigned `seq` during the rewrite is heap/physical order — which matches insertion order in practice for a never-`UPDATE`d/`DELETE`d table but is **not** a documented guarantee. This is mitigated by a post-migration read-only chain audit (walk each user in `seq` order; assert `balance_after` chains, uncollectable rule included). Prod `dharma_ledger` = **0 rows** (read-only probe, OQ-1 resolved); staging = 3 smoke rows. Every *future* `INSERT` receives `seq` at insert time in the correct per-user serialized order, which **is** guaranteed.

## Single-source file map

| File | Role |
|---|---|
| `src/db/schema/dharma.ts` | `seq` column (`.generatedAlwaysAsIdentity()`, mode `"number"`) + `dharma_ledger_user_seq_uq` unique index `(user_id, seq)` |
| `drizzle/migrations/0020_*.sql` | Drizzle-**generated** from the schema edit (`dharma_ledger` is drizzle-kit-tracked; hand-writing would desync the snapshot) — two additive statements |
| `src/server/dharma/persist.ts` | `readLatestBalance` → `ORDER BY seq DESC LIMIT 1`; doc-comment records `seq` as the total-order contract |

## Consequences

**Positive.** Deterministic per-user total order; INV-2 mint/burn via same-`created_at` ties eliminated at the source; one-line read-path delta; `seq` additionally enables a future strict-order drift derivation (D2-C, OQ-3) that closes the detector blind spot recorded in ADR/tests.

**Negative.** A schema migration with a brief `ACCESS EXCLUSIVE` rewrite (trivial pre-launch). The existing-row backfill order is best-effort (audited; ~0 rows). A second index on a Bucket-A table (write-path cost is negligible at experiment scale).

**Neutral.** Chaining logic is unchanged in code — only its *status* (optimization, not sole-correctness) changes. `check_nightly_drift` is order-free (no `ORDER BY`) and needs no change; `ADD COLUMN` is invisible to it.

## Pros and Cons of the Options

**(a) `seq` IDENTITY + order on it.** *Pros:* deterministic at the source; append-only-safe; minimal code delta; enables D2-C. *Cons:* a migration + rewrite; best-effort backfill (mitigated). **Verdict: chosen.**

**(b) Read-time balance-chain walk.** *Pros:* no DDL; instantly reversible. *Cons:* **fatal** — net-zero tie-groups have zero chain sinks and cannot be ordered from the data at all, and the repo's own `BET_MIN_STAKE_POST = DAILY_CREDIT_DHARMA` makes the first-bet-of-day pair net-zero (the modal tie-group), so those users would be permanently bricked (`place()` must read before writing, and append-only forbids repair). Also requires every external/raw-SQL consumer to reimplement an entry-type-coupled walk. **Verdict: disqualified in principle, not merely dispreferred.**

*`seq` makes the ledger's ordering a database fact rather than a property inferred from timestamps and balances; the chain remains as an in-transaction convenience, no longer as the thing standing between a same-millisecond tie and a corrupted dataset.*
