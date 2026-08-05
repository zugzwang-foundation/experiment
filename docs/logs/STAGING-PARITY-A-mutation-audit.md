# STAGING-PARITY Slice A — mutation audit

**Date:** 2026-08-06 (overnight, unattended)
**Branch:** `slice/staging-parity-a` · **PR:** #298 (OPEN — nothing merged)
**Baseline commit at start:** `1fc06e6`
**Purpose:** evidence for **Gate C** (items 3–6). Every control in Slice A was
mutated, one at a time, and the verdict recorded.

Every mutation in this audit ran against **LOCAL Postgres (:54322)**. The
staging database was read **once**, read-only, at STEP 0, and never written.

---

## Method

Per control, mechanically, one at a time — never batched, so a verdict names one
cause:

1. state the mutation
2. apply it to the source
3. run the **owning suite**
4. record **RED** (the suite failed → the control is live) or
   **GREEN** (the suite passed → **the control is blind**)
5. `git checkout --` the file
6. re-run the same suite and confirm **GREEN**

Between step 3 and step 5 the local guard catalog is repaired — a split-batch or
missing-enable mutation *commits* the disables, and an un-repaired catalog would
contaminate every later verdict.

**A control that stays GREEN under its mutation is a defect, not a curiosity.**
Each one below was fixed, and the mutation re-fired against the fix.

---

## STEP 0 · Ground

| Check | Result |
|---|---|
| PR #298 | OPEN, `MERGEABLE`, base `main`, head `slice/staging-parity-a` |
| Working tree | clean; local `HEAD` == `origin/slice/staging-parity-a` == `1fc06e6` |
| `git diff main...HEAD` | 19 files, +3197 / −7 — unchanged from the reviewed state |
| staging `bets` | **39** |
| staging `users` | **16** |
| staging `identity_pool` | **200** |
| staging `system_state` | **1 row**, `frozen_at` = **NULL** |
| staging `bucket_%` guards | **78 rows, 0 disabled** |
| staging `drizzle.__drizzle_migrations` | 25 |
| staging `session_replication_role` | `origin` |

Read through `doppler run --config stg` with
`PGOPTIONS=-c default_transaction_read_only=on`. **Staging is untouched.**

---

## STEP 1 · F1 — the unverified assumption

> `SET LOCAL` outside a transaction block emits a WARNING and no-ops. Nothing
> asserted that a multi-statement simple-query implicit transaction counts as a
> transaction block for that purpose.

### F1a · Is `lock_timeout` actually in effect?

**YES.** Measured against local Postgres 17, same batch SHAPE `runGuardedReset`
builds, reading `current_setting('lock_timeout')` from inside the same batch.

Verbatim:

| Case | `current_setting('lock_timeout')` | Server notice |
|---|---|---|
| `SET LOCAL lock_timeout = '15s';` **alone** (negative control) | `"0"` | `WARNING 25P01 · "SET LOCAL can only be used in transaction blocks"` (`xact.c:3691`, `CheckTransactionBlock`) |
| `SET LOCAL …;` + `SELECT current_setting(…)` — one batch | **`"15s"`** | *(none)* |
| `SET LOCAL …;` + `ALTER TABLE … DISABLE TRIGGER;` + `TRUNCATE … CASCADE;` + `SELECT current_setting(…)` + `ALTER TABLE … ENABLE TRIGGER;` — one batch | **`"15s"`** | *(none)* |
| next round-trip, after the batch | `"0"` | *(none)* |

The negative control is what makes the positive one mean anything: the same
statement, same connection, same session — only the batching differs, and the
value differs with it.

**Implicit-transaction proof.** `ALTER TABLE bets DISABLE TRIGGER
bucket_a_no_truncate;` followed by `SELECT 1/0;` in one batch aborts with
`division by zero`, and `tgenabled` reads `O` afterwards. The DDL rolled back.
ADR-0035 primitive 2's mechanism is real at the Postgres level.

### F1b · Is it the simple query protocol?

**YES**, established two ways, neither of them documentation:

- **Source.** `postgres@3.4.9` `src/index.js:119` — `unsafe(string, args = [],
  options = {})` sets `simple: 'simple' in options ? options.simple :
  args.length === 0`. `src/connection.js:189` — `q.options.simple ?
  b().Q().str(…)`, and `src/bytes.js:4` maps `Q` to the byte `'Q'.charCodeAt(0)`
  = the PostgreSQL **Query** frontend message. That is the simple query protocol
  by definition; the extended one is `P`/`B`/`E`.
- **Empirically.** Observed `options.simple === true` for a parameterless
  `unsafe()` and `false` with one parameter. And the server-side consequence:
  `SELECT 1 AS a; SELECT $1::int AS b;` with one parameter is refused with
  **`42601 · cannot insert multiple commands into a prepared statement`**, while
  the parameterless `SELECT 1 AS a; SELECT 2 AS b;` returns **two result sets**.
  Only the simple query protocol can carry multiple commands, so a batch that
  executes at all executed as a simple query.

**Verdict: both hold. No halt.**

### Assertions added (F1)

`buildResetBatch(tables)` was split out of `runGuardedReset`, which is now
`await client.unsafe(buildResetBatch(tables))`. All validation moved into the
builder, so nothing can construct an unvalidated batch.

That split exists for one reason: the integration suite now asserts against the
**real batch text** rather than a lookalike. A test that reassembles its own
batch proves nothing about the shipped one.

| Assertion | Location |
|---|---|
| parameterless `unsafe()` → `options.simple === true`; parameterised → `false` | `staging-reset-mechanism` |
| extended path refuses two commands (`42601`); simple path returns two result sets | `staging-reset-mechanism` |
| **negative control** — the same `SET LOCAL` alone leaves `lock_timeout` at `"0"` | `staging-reset-mechanism` |
| the real `buildResetBatch(TRUNCATE_SET)` binds `lock_timeout` to `LOCK_TIMEOUT` | `staging-reset-mechanism` |
| it reverts to `"0"` the moment the batch ends | `staging-reset-mechanism` |
| a DISABLE followed by an in-batch failure rolls the DDL back | `staging-reset-mechanism` |
| the batch is sent as exactly **one** `client.unsafe` round-trip | `runner-gating` |

---

## STEP 2 · F2 — the misleading message

`afterAll` runs even when `beforeAll` throws. It reported
`G-4 FAILED after the run` on both paths — and on a **destructive** artifact
that reads as *"staging was wiped, then verification failed"*, the worst news
this runner can deliver. The truth may be that a guard refused and **nothing
ran**. An operator reading it at 2am reaches for `BREAK_GLASS.md` for a database
nobody touched.

**Fix.** `batchCommitted` is set on the line after `runGuardedReset` **resolves**
— the only point at which the implicit transaction is known to have committed.
`afterAll`'s catch selects between two messages:

- committed → `G-4 FAILED AFTER THE DESTRUCTIVE BATCH COMMITTED. Staging WAS
  wiped and post-run verification did not pass — the database needs attention:`
- not committed → `G-4 failed, but THE DESTRUCTIVE BATCH NEVER RAN — the run was
  refused before it started, so this run did NOT wipe staging. What follows
  describes the database as it already was, not damage this run caused:`

Asserted by `runner-gating` — flag set after the reset call, both arms present in
the hook, and the non-destructive arm says so in words. Mutation-verified below.

---

## STEP 3 · The mutation sweep

Legend — **RED** = the control caught it. **GREEN** = the control was blind
(a defect; fixed, then re-fired).

### GROUP 1 · Atomicity — the assertion ADR-0035 rests on (Q-J)

| # | Mutation | Verdict | Owning suite | Defect found | Fix |
|---|---|---|---|---|---|
| **M1** | Split the single `client.unsafe()` batch into one round-trip per statement | **RED** (3 fail) | `staging-reset-mechanism`, `runner-gating` | — | — |
| **M2** | Remove the `TRUNCATE` from the batch, leaving disable+enable | **RED** (2 fail) — **but its own owning control stayed GREEN** | `staging-reset-mechanism` | `it("empties the truncate set …")` **seeded nothing**. Earlier cases in the file leave the database empty, so counting zero after a reset that never truncated still read as zero. A pre-state of zero makes a post-state of zero unfalsifiable — the control read as coverage while asserting nothing about the statement it is named for. | `seedTwoRows()` inserts one `identity_pool` and one `verifications` row (both dependency-free, two different buckets), asserts both non-empty, and only then resets and asserts zero. |
| **M2-refire** | as M2, against the fix | **RED** (3 fail, incl. `empties the truncate set …`) | `staging-reset-mechanism` | — | — |
| **M3** | Remove the trailing `ENABLE` statements | **RED** (10 fail) | `staging-reset-mechanism` | — | — |

**M1 detail — the one that mattered most.** ADR-0035's primary mechanism is that
the guards *cannot* be left off because they are never committed off. Split into
separate round-trips, the failing `TRUNCATE` no longer rolls the disables back,
and three assertions fire: both atomicity cases and the new one-round-trip shape
check. The proof is **not** decorative.

**M3 detail.** The mutation commits 25 guards in the `off` state. Local repair
put them back before the revert re-run; the revert re-ran GREEN.

