# ENGINE.13 — Initial Dharma grant at first ToS acceptance

> **Status:** Founder-ratified 2026-06-11 (R1a–R4a + P1–P5 + F-1/F-2 folded) — merge
> pending. Docs-only plan; execute = fresh CC session + fresh web chat (§5.8).
> **Task:** the ADR-0018 / SPEC.1 §10.1 equal initial grant — ~1,000 Dharma (ranged,
> HARDEN.5-owned), paid EXACTLY ONCE per user, inside the F-AUTH-4 ToS-acceptance
> transaction's first-acceptance branch. Producer module `src/server/dharma/grant.ts`,
> the `dharma.granted` event mint, `INITIAL_USER_DHARMA`, migration 0013's UNIQUE
> partial-index backstop, and the `I-GRANT-ONCE-001` invariant. Critical-path money +
> auth code — full ritual, Ultrathink-mandatory.
> **Base:** `main` @ `3720935` (reconciliation sweep 2026-06 merged #106/#107; ENGINE.12
> execute #104 `af61ce5`). Greenfield: zero `initial_grant` call sites, no constant, no
> grant producer (S1 sync-gate 6/6 PASS, 2026-06-11).

---

## Context

ENGINE.5 shipped the Dharma core with the grant explicitly producer-owned and forward-
assigned: "Per-tag sign for the other 7 is NOT enforced — producer-owned
(ENGINE.9/12/signup)" (`ledger.ts:38-39`), and "Grant / daily-credit / resolution writes
sit outside the ADR-0013 pool lock; their callers (auth/onboarding, ENGINE.12, ENGINE.9)
supply equivalent per-user serialization" (`persist.ts:51-56`). ENGINE.5 R-1 pinned the
grant-row shape: recipient `user_id`, `bet_id` NULL, `amount` = +grant, `balance_after`
= amount, the user's FIRST ledger row; the conservation gathering excludes it (NULL
`bet_id`, non-FLOW tag — `tags.ts:45-47`). The `dharma_entry_type` enum carries
`initial_grant` since migration 0009. ENGINE.12 R6 deferred the grant to an AUTH-lane
task — this is that task.

The consuming transaction exists: `acceptTosAction` (`src/server/auth/tos-accept.ts:66-
172`, SCAFFOLD.3 + ENGINE.6) — one `db.transaction` holding a `users`-row `FOR UPDATE`
lock (`:119`), a tab-race idempotent no-op branch (`:126`), the 5-column acceptance
UPDATE (`:131-139`), and the `user.tos_accepted` emit (`:145-158`), with `eventId`
minted at handler entry (`:100`, ADR-0016 D1). ENGINE.13 is the join: the grant unit
called from the first-acceptance branch of that transaction.

Binding rule (SPEC > ADR > tracker): SPEC.1 §10.1:463 — "Receive an **equal initial
grant** at signup (a single flat amount, identical for every user — magnitude ranged,
~1,000 Dharma, pinned at number-tuning; per ADR-0018)"; ADR-0018 Driver 3 — the grant
"must be **equal for all**"; ADR-0018 issuance table — "~1,000 Dharma (range
1,000–2,000)". Placement decider (recon P2, founder-ratified R1a): grant-at-F-AUTH-3 is
impossible-or-worse — no single F-AUTH-3 tx exists on disk (three independent commits;
recon S2), a `user.create.before` grant predates the `users` row (FK 23503), and an
after-hook grant pins every abandoned signup against the SPEC.1 §13 stale-30d purge via
the two-layer block (`dharma_ledger.user_id` FK `ON DELETE restrict`, 0001:249 + the
Bucket-A no-delete trigger). F-AUTH-4 first acceptance is the participant threshold —
the cookie issues only after it — and supplies the per-user serialization for free.

## Founder rulings folded (R1a–R4a — binding, 2026-06-11)

- **R1a — placement:** inside `acceptTosAction`'s FIRST-ACCEPTANCE branch, after the
  `:126` tab-race no-op, same transaction. Lock order extends `users → dharma_ledger →
  events`. "At signup" = at first ToS acceptance — wording pin rides rider R-A.
- **R2a — event:** mint `dharma.granted`, payload `{ userId, amount }` (`amount` =
  `numericString`), aggregate `dharma_account`/userId, `payload_version` default 1.
  `EVENT_TYPES` entry + payload schema + the SPEC.2 §19.4.1 row land same-commit per the
  table's own foot-rule. No `AggregateType` change (`dharma_account` exists,
  `insert.ts:80`).
- **R3a — constant:** `INITIAL_USER_DHARMA` — the SPEC.1 §16.1:930 name, zero spec edit
  (rider R-E dropped). Decimal string `"1000"`, never a float. JSDoc: PLACEHOLDER ~1,000
  (ranged 1,000–2,000), HARDEN.5 (number-tuning pass, 2026-09-01) owns the value,
  equal-for-all per ADR-0018 Driver 3, name adopted from SPEC.1 §16.1 (ENGINE.12 /
  `DAILY_CREDIT_DHARMA` precedent).
- **R4a — isolation drift RECORDED, not conformed:** no `isolationLevel` change to
  `tos-accept.ts`. The tx runs at READ COMMITTED with a `FOR UPDATE` row lock; the
  file's comments and SPEC.2 §3.5:289 claim SERIALIZABLE (recon S1). Conforming without
  a retry loop would degrade the handled tab-race into a user-visible 40001 (SSI aborts
  the loser; the current handler has no in-handler retry — "client retries"). Grant
  safety is isolation-independent: FOR UPDATE serializes, the no-op branch short-
  circuits, the 0013 index backstops. Carry-forward minted (below): later decision =
  amend SPEC.2 §3.5:289 to bless lock-then-recheck OR conform with a proper retry loop.

## Pre-resolved web-lane calls folded (P1–P5 — binding)

- **P1 — invariant:** mint `I-GRANT-ONCE-001` (at most ONE `initial_grant` row per user,
  EVER); canonical spec at `tests/invariants/`, fixture-bypass double INSERT → expect
  23505 (the I-DAILY-ONCE-001 mirror).
- **P2 — migration 0013:** UNIQUE partial index `dharma_ledger (user_id) WHERE
  entry_type = 'initial_grant'` — plain column, simpler than 0012's expression index.
  Drizzle GENERATED path, no probe/fallback machinery (0012 precedent). The backstop can
  fire only on a logic bug → loud-failure policy (ENGINE.12 R3 mirror): never catch
  23505 to "recover"; it surfaces as a 500 + Sentry.
- **P3 — balance path:** the ledger call uses `appendLedgerRow`'s auto-read (`persist.ts
  :74-75` → `readLatestBalance` → `CANONICAL_ZERO` for a first row); NO explicit
  `previousBalance`. Expected result: `balance_after = amount` = the user's first row
  (ENGINE.5 R-1 shape). Single row in the tx — the >1-row chaining contract does not
  apply (recon P4).
- **P4 — riders close as R-A..R-D** (below). Drifts S2/S4/S5 + SPEC.2 §3.5:287 +
  §8.3:873 recorded once and bound to a later truth-up sweep — NOT this PR.
- **P5 — no backfill.** Pre-launch environments reseed; the execute PR must not invent a
  data migration for pre-existing users. (At execute time `main` has no production
  users; staging reseeds via the existing seed scripts.)

## Approach (one paragraph)

A single new producer, `grantInitialDharma(tx, …)` in `src/server/dharma/grant.ts`
(accrual.ts mirror), is called once from `acceptTosAction`'s first-acceptance branch —
after the 5-column acceptance UPDATE, before the `user.tos_accepted` emit. It validates
the constant's sign (producer-owned discipline per `ledger.ts:38-39`), appends the
`initial_grant` ledger row via the auto-read first-row path (`bet_id` NULL,
`balance_after = amount`), and emits `dharma.granted` (aggregate `dharma_account`,
event id minted at handler entry beside the existing `eventId` and closed over). The
missing-row and tab-race no-op branches return before the grant is reachable, so the
`users`-row FOR UPDATE lock makes the grant once-per-user by construction; migration
0013's UNIQUE partial index is the storage backstop that can only fire on a logic bug
(loud 23505). No new endpoint, no new flow, no cron, no backfill — the grant is one
producer call inside an existing transaction.

## The grant unit (`src/server/dharma/grant.ts` — NEW)

**Signature (ruled shape):**
`grantInitialDharma(tx: DbTransaction, args: { userId: string; grantEventId: string;
metadata: z.infer<typeof eventMetadataSchema> }): Promise<{ balanceAfter: string }>`
— metadata typed from `@/server/events/schemas` (the accrual.ts precedent; same 7-field
shape, `schemas.ts:267-275`). No `previousBalance` arg (P3 — auto-read path; the grant
is the only same-user ledger row in this tx).

**`validateGrantAmount(amount: string): void`** — the producer guard, mirroring
`validateCreditAmount` (`accrual.ts:73-84`) exactly: `numericString` parse →
`DharmaInputError`; strictly positive via `CpmmDecimal` → `DharmaInputError`. `"-0"` is
not strictly positive (the `_probe-decimal-negzero` landmine — `numericString` admits
it; the sign guard must not). This discharges `ledger.ts:38-39`'s "signup" sign-
discipline assignment.

**Body, in order (the complete write set is exactly two):**

1. `validateGrantAmount(INITIAL_USER_DHARMA)` — before any write.
2. `appendLedgerRow(tx, { userId, amount: INITIAL_USER_DHARMA, entryType:
   "initial_grant", betId: null })` — NO `previousBalance` (P3). For a first row the
   in-tx read returns the canonical zero ⇒ `balance_after = amount`, the ENGINE.5 R-1
   shape. (If a logic bug ever lets a second grant reach this line, the 0013 index
   rejects the INSERT with 23505 — loud, never a double grant.)
3. `insertEvent(tx, { eventId: args.grantEventId, eventType: "dharma.granted",
   aggregateType: "dharma_account", aggregateId: userId, payload: { userId, amount:
   INITIAL_USER_DHARMA }, metadata: args.metadata })`.

Returns `{ balanceAfter }`.

**Module JSDoc must carry** (the accrual.ts documentation pattern):
- **Serialization (discharges `persist.ts:51-56` for the auth/onboarding lane):** the
  caller holds the `users`-row `FOR UPDATE` lock (`tos-accept.ts:119`); concurrent
  acceptances serialize through it and the loser takes the `:126` no-op branch — the
  grant is unreachable twice. Works at READ COMMITTED (lock-then-recheck); SSI is not
  load-bearing here (R4a). The 0013 UNIQUE partial index is the storage backstop —
  fires only on a logic bug, loud 23505 (ENGINE.12 R3 mirror).
- **Sign discipline:** producer-owned per `ledger.ts:38-39`; `validateGrantAmount` is
  the discharge.
- **Conservation:** `initial_grant` is an issuance row (`bet_id` NULL) outside the
  per-market flow sum (`tags.ts:45-47`); system-total conservation counts it per SPEC.1
  §10.2:469 ("sum of equal initial grants").
- **No retry loop here:** driver errors bubble raw to the Server Action (the
  `insertEvent` posture, `insert.ts:47-48`).

## The tos-accept seam (EDIT `src/server/auth/tos-accept.ts`)

Three additive touches; nothing existing moves:

1. **Handler entry (`:100` block):** mint `const grantEventId = uuidv7();` immediately
   after the existing `eventId` — both closed over, NEVER regenerated per attempt
   (retry purity, ADR-0016 D1; ENGINE.12 `creditEventId` precedent). Minting order is
   load-bearing for log chronology: events-row `created_at` derives from the UUIDv7 ms
   prefix (`insert.ts:58-62`), so `user.tos_accepted` ≤ `dharma.granted` in the log
   regardless of INSERT order inside the tx.
2. **First-acceptance branch:** insert the grant call between the 5-column UPDATE
   (`:131-139`) and the `user.tos_accepted` emit (`:145`):
   `await grantInitialDharma(tx, { userId, grantEventId, metadata });`
   — reusing the SAME `metadata` object built at `:101-109` (same flow F-AUTH-4, same
   self-actor) for both events. Resulting in-tx write order: `users` (FOR UPDATE →
   UPDATE) → `dharma_ledger` INSERT → `events` INSERT (`dharma.granted`) → `events`
   INSERT (`user.tos_accepted`) — the R1a lock order `users → dharma_ledger → events`,
   strictly. No pool row is touched; the bet path's `pools → users → …` order shares no
   cycle with this tx, and grant-vs-bet same-user concurrency is unreachable anyway
   (no session cookie exists before acceptance).
3. **Comment block (`:25-40` region):** one added paragraph recording (a) the grant
   joins the first-acceptance branch and why the no-op branches never reach it, and
   (b) the R4a posture: the tx runs at READ COMMITTED + FOR UPDATE (lock-then-recheck);
   SPEC.2 §3.5:289's SERIALIZABLE wording is recorded drift, truth-up carry-forward —
   do NOT "fix" by adding `isolationLevel` without a retry loop.

**Guarantee stated for the record:** the missing-row branch (`:125`) and the tab-race
branch (`:126`) `return` before the grant call — neither path can write a grant row, a
`dharma.granted` event, or any ledger state. The checkbox early-return (`:86-88`) and
the cookie redirects (`:73-80`) exit before the tx opens.

## Schema + migration (P2 backstop)

**EDIT `src/db/schema/dharma.ts`** — one entry appended to the `dharmaLedger` index
array (after the 0012 uniqueIndex, before the CHECK), 0012's comment pattern:

```ts
// I-GRANT-ONCE-001 storage backstop (ENGINE.13, plan P2): at most ONE
// initial_grant row per user, EVER. The PRIMARY mechanism is the F-AUTH-4
// users-row FOR UPDATE + tab-race no-op branch (tos-accept.ts); this index
// can only fire on a future logic bug — it fails loudly (23505) rather than
// ever double-granting. Plain-column partial index (no expression — simpler
// than 0012; both halves IMMUTABLE-trivial).
uniqueIndex("dharma_ledger_initial_grant_user_uq")
	.on(table.userId)
	.where(sql`${table.entryType} = 'initial_grant'`),
```

**NEW `drizzle/migrations/0013_initial_grant_user_unique.sql`** via the GENERATED path:
`just db-generate initial_grant_user_unique` (0012 precedent — fallback machinery
unused). Expected DDL (the audit greps for exactly this shape):

```sql
CREATE UNIQUE INDEX "dharma_ledger_initial_grant_user_uq" ON "dharma_ledger"
USING btree ("user_id") WHERE "dharma_ledger"."entry_type" = 'initial_grant';
```

`@db-migration-reviewer` checks schema↔SQL coherence, index naming (0012 mirror),
append-only migration discipline, and that NO other DDL leaks into 0013.

## Constant (R3a — EDIT `src/server/config/limits.ts`)

Appended after the ENGINE.12 block:

```ts
// === ENGINE.13: Initial grant (ADR-0018 + SPEC.1 §10.1/§16.1) =============

/** Equal initial Dharma grant, paid once per user inside the F-AUTH-4 first-
 * acceptance tx (ADR-0018 Driver 3 — equal for all; differentiation by
 * deployment, not endowment). PLACEHOLDER VALUE (~1,000, ranged 1,000–2,000)
 * — HARDEN.5 (number-tuning pass, 2026-09-01) owns the value. Decimal string
 * — never a JS float (CLAUDE.md §2). Name adopted from SPEC.1 §16.1. */
export const INITIAL_USER_DHARMA = "1000";
```

## Events vocabulary (R2a — EDIT `src/server/events/schemas.ts`)

Two edits, same file, same commit — the `as const satisfies Record<EventType, …>` guard
makes shipping one without the other a tsc failure (enum-hygiene, CLAUDE.md gotcha):

1. `EVENT_TYPES`: dharma domain comment becomes `// dharma domain (2) — ENGINE.0 +
   ENGINE.13`; append `"dharma.granted"` after `"dharma.credited"`.
2. `eventPayloadSchemas`: append after the `dharma.credited` entry:

```ts
// dharma.granted — the one-time genesis issuance (ENGINE.13). No day key:
// a genesis row has no accrual date (creditedForDate is dharma.credited's
// key, not this event's). amount is the equal grant (numericString).
"dharma.granted": z.object({
	userId: z.string().uuid(),
	amount: numericString,
}),
```

No `AggregateType` change. `payload_version` rides the `insertEvent` default (1).

## Carry-forwards consumed / minted

**CONSUMED by this plan:**
- `persist.ts:51-56` — the "auth/onboarding" per-user-serialization assignment:
  discharged by FOR UPDATE + no-op branch + 0013 backstop; recorded in `grant.ts`'s
  JSDoc (no `persist.ts` edit — surgical).
- `ledger.ts:38-39` — the "signup" sign-discipline assignment: discharged by
  `validateGrantAmount`.
- ENGINE.12 R6's deferred AUTH-lane grant-producer task — this plan IS that task.

**MINTED by this plan:**
- **R4a isolation truth-up** — SPEC.2 §3.5:289 says SERIALIZABLE; `tos-accept.ts` runs
  READ COMMITTED + FOR UPDATE (and its comments repeat the SERIALIZABLE claim, as does
  `tos-accept-event.test.ts`'s header). Later decision: amend §3.5:289 to bless
  lock-then-recheck OR conform with a proper retry loop. Joins the truth-up sweep.
  The R-B rider deliberately leaves the §3.5:289 isolation clause untouched — the
  truth-up owns it (F-1).
- **Drift set → truth-up sweep (recorded once, NOT this PR):** S2 (F-AUTH-3 is three
  txs, `user.pseudonym_assigned` never emitted — §3.5:287 + §8.3:873 fiction), S4 (the
  spec'd stale-30d sweep's tuple-release contradicts the 0003 Bucket-B one-shot
  trigger), S5 (§4:365 names `acceptPseudonymAndTos` at a path that doesn't exist).
- `tests/server/auth/tos.test.ts:358` stale-30d sweep `it.todo` stays HARDEN-era —
  untouched.

## File plan (CLOSED diff-stat set — anything outside = surface, don't absorb)

| File | Kind | Content |
|---|---|---|
| `src/server/dharma/grant.ts` | NEW | producer: `validateGrantAmount` + `grantInitialDharma` |
| `src/server/auth/tos-accept.ts` | EDIT | `grantEventId` mint + grant call + comment paragraph |
| `src/server/config/limits.ts` | EDIT | ENGINE.13 block + `INITIAL_USER_DHARMA` |
| `src/server/events/schemas.ts` | EDIT | `EVENT_TYPES` + `dharma.granted` payload schema |
| `src/db/schema/dharma.ts` | EDIT | `dharma_ledger_initial_grant_user_uq` uniqueIndex |
| `drizzle/migrations/0013_initial_grant_user_unique.sql` | NEW | generated UNIQUE partial index DDL |
| `tests/server/auth/tos-accept-grant.test.ts` | NEW | DB-backed T1/T2/T3/T5/T7 (tos-accept-event pattern) |
| `tests/invariants/I-GRANT-ONCE-001.initial-grant-once-per-user.spec.ts` | NEW | T4 fixture-bypass 23505 |
| `tests/unit/dharma/grant.test.ts` | NEW | T6 sign-discipline pure unit |
| `tests/server/auth/tos.test.ts` | EDIT (additive) | mock `@/server/dharma/grant`; assert called-once on first acceptance, NOT called on no-op/early-exit paths |
| `docs/specs/SPEC.1.md` | EDIT | rider R-A |
| `docs/specs/SPEC.2.md` | EDIT | riders R-B + R-C + R-D |
| `CLAUDE.md` §2 + `AGENTS.md` §9 | EDIT | invariant-list one-liners: +`I-GRANT-ONCE-001` (7 → 8 specs) — closing-ritual, ENGINE.12 precedent |
| `docs/plans/ENGINE.13.md` | NEW (Phase 1) | this plan |
| `docs/logs/ENGINE.13*.md` | NEW | per-session logs |

**Break-risk assessed (recon-verified):** `tos.test.ts`'s mocked tx has NO `insert` and
a bare `select` vi.fn — an un-mocked grant call would throw inside every first-
acceptance unit test; the module mock is mandatory, and its called/not-called
assertions are the additive budget. Its SQL-regex assertions (`:170-177`, `:348-353`)
collect `tx.execute` calls only and survive unchanged. `tos-accept-event.test.ts` needs
NO edit: every count assertion filters on `event_type = 'user.tos_accepted'`
(`:150-151`, `:200`, `:222`) — the added `dharma.granted` row and ledger write are
invisible to it; it now exercises the real grant en passant (requires 0013 applied
locally, same as every DB-backed suite).

## Riders (CLOSED set R-A..R-D — same execute PR; ENGINE.5 R-3 precedent)

- **R-A — SPEC.1 §13 F-AUTH-4 + §10.1 wording pin.** (1) Acceptance-evidence block,
  append after the five-column list:
  > In the same transaction, on the first-acceptance branch only, the server writes the
  > equal initial grant (ADR-0018): one `dharma_ledger` row (`entry_type =
  > 'initial_grant'`, `bet_id` NULL, `amount = INITIAL_USER_DHARMA`, `balance_after =
  > amount` — the user's first ledger row) and one `dharma.granted` events row. The
  > tab-race no-op acceptance never reaches the grant write; a UNIQUE partial index
  > (`dharma_ledger_initial_grant_user_uq`, migration 0013) is the storage backstop —
  > at most one grant per user, ever.
  (2) §10.1:463, pin the timing inside the existing parenthetical: "…equal initial
  grant at signup (granted at first ToS acceptance — F-AUTH-4, the participant
  threshold; a single flat amount, identical for every user — magnitude ranged, ~1,000
  Dharma, pinned at number-tuning; per ADR-0018)."
- **R-B — SPEC.2 §3.5:289**, the F-AUTH-4 transaction description becomes (final
  wording per F-1 — the isolation clause is retained as the spec has it today; the
  drift stays recorded via the R4a carry-forward + the tos-accept.ts comment):
  > **F-AUTH-4 transaction (ToS acceptance evidence + initial grant).** One Postgres
  > transaction at SERIALIZABLE isolation; lock order `users → dharma_ledger → events`.
  > `UPDATE users SET tos_accepted_at = now(), tos_version_hash = $1,
  > privacy_version_hash = $2, tos_acceptance_ip = $3, tos_acceptance_user_agent = $4`
  > (Bucket-C mutable table per ADR-0005 — no append-only trigger on `users`); on the
  > first-acceptance branch only, `INSERT INTO dharma_ledger` the equal initial grant
  > (`entry_type = 'initial_grant'`, `bet_id` NULL, `amount = INITIAL_USER_DHARMA`,
  > `balance_after = amount` — the recipient's first ledger row; ADR-0018) and `INSERT
  > INTO events` with `event_type = 'dharma.granted'` (aggregate `dharma_account`);
  > `INSERT INTO events` with `event_type = 'user.tos_accepted'` carrying both version
  > hashes and the acceptance evidence in `payload`. The tab-race no-op acceptance
  > reaches none of the grant writes. After commit, the next request's session-deferral
  > hook re-evaluates and the participant cookie issues.
- **R-C — SPEC.2 :762** (§7.x read/write table): "…hit `identity_pool` + `users` +
  `events` (F-AUTH-3) and `users` + `dharma_ledger` + `events` (F-AUTH-4)."
- **R-D — SPEC.2 §19.4.1**, new table row after `dharma.credited`:
  > `| dharma.granted | payload.userId | PSEUDO defense-in-depth — aggregate_id carries
  > the user id; same rationale as dharma.credited (ENGINE.13 emit site) |`

## Thesis invariants touched

| Invariant | Contact | Assertion that proves it |
|---|---|---|
| INV-2 (no overdraft; non-transferable) | Issuance write | `balance_after = amount > 0` (T1); system→user faucet — no counterparty debit, no transfer surface; `validateGrantAmount` rejects non-positive (T6) |
| I-GRANT-ONCE-001 (minted) | The grant's own rule | FOR UPDATE + no-op branch (T2/T3) primary; 0013 index 23505 backstop (T4) |
| INV-1 / INV-3 / INV-4 | NOT touched | no bet, no comment, no resolution surface in this diff |
| Conservation (SPEC.1 §10.2) | Issuance-side identity | grant excluded from per-market flow gathering (NULL `bet_id`, non-FLOW tag — `tags.ts` untouched); counted in system-total |

## Test plan (RED-first via `@test-writer`; local Postgres :54322 convention)

Vehicle for DB-backed tests: the `tos-accept-event.test.ts` pattern — `vi.mock("@/db")`
→ `testDb`, mock `next/headers` + onboarding-ref, drive the REAL `acceptTosAction`.

- **T1 — first acceptance grants.** One real-action call → exactly one `dharma_ledger`
  row: `entry_type = 'initial_grant'`, `bet_id` NULL, `amount` = canonical 18-dp
  `"1000.000000000000000000"`, `balance_after = amount`, and it is the user's ONLY
  ledger row; exactly one `dharma.granted` events row (aggregate
  `dharma_account`/userId, `payload = { userId, amount: "1000" }` — raw constant in
  payload, canonical in ledger, the accrual precedent); the `user.tos_accepted` event
  and the 5 tos columns land as before.
- **T2 — double-invoke idempotency (MANDATORY).** The REAL `acceptTosAction` called
  twice sequentially → second call takes the `:126` no-op branch; exactly ONE grant row
  + ONE `dharma.granted` event TOTAL; tos columns unchanged from the first call.
- **T3 — concurrent-acceptance race (ENGINE.12 T3 mirror).** Two simultaneous real-
  action calls (`Promise.all`) → FOR UPDATE serializes; both resolve without error;
  exactly ONE grant row + ONE event TOTAL.
- **T4 — I-GRANT-ONCE-001 fixture-bypass** (`tests/invariants/`, I-DAILY-ONCE-001
  mirror). Raw `testClient.unsafe` INSERT of a first `initial_grant` row succeeds; a
  second for the same user (distinct `created_at`) rejects with 23505 from
  `dharma_ledger_initial_grant_user_uq`; a second for a DIFFERENT user succeeds; a
  second `daily_allowance` row for the granted user succeeds (the index's WHERE clause
  is tag-scoped).
- **T5 — rollback purity.** Fault vehicle (the daily-credit T5 / events-idempotency
  idiom — partial passthrough mock, no `src/` hooks): mock `@/server/events/insert`
  with `importActual` passthrough that throws a TERMINAL error when `eventType ===
  "user.tos_accepted"` — the tx's FINAL write, so the real UPDATE + grant ledger row +
  `dharma.granted` event execute first, then roll back. Assert: zero `dharma_ledger`
  rows, zero events rows of EITHER type, `tos_accepted_at` still NULL.
- **T6 — sign discipline (pure unit, no IO).** `validateGrantAmount`: accepts `"1000"`;
  rejects `"0"`, `"-1"`, `"-0"` (negzero landmine), `"10.5e2"`, `""`, non-numeric —
  each `DharmaInputError`.
- **T7 — no-op paths write nothing (DB-backed).** (a) user with `tos_accepted_at`
  pre-set → real action → no grant row, no `dharma.granted` event (T2's second half,
  asserted independently); (b) missing users row → silent return, zero writes of any
  kind.
- **Unit additions to `tos.test.ts` (mocked layer):** grant module mock called exactly
  once on the first-acceptance path with `{ userId, grantEventId, metadata }`; NOT
  called on: checkbox early-return, missing/invalid/expired cookie redirects, missing-
  row branch, tab-race branch.

RED-first discipline: `@test-writer` lands T1–T7 failing (grant module + index absent);
T4 cannot RED locally if :54322 is down — start Docker + `supabase start` per the
standing local-gates rule; the value imports from the greenfield `grant.ts` keep the
suite from resolving until implementation lands.

## Out of scope (stated so execute does not drift)

- NO `isolationLevel` change to `tos-accept.ts` (R4a — recorded drift, not conformed).
- NO stale-30d sweep work (`tos.test.ts:358` stays HARDEN-era).
- NO backfill / data migration (P5).
- NO F-AUTH-3 / Better Auth hook / identity-pool changes; NO `user.pseudonym_assigned`
  emit site (S2 drift → truth-up sweep).
- NO `pool_seed`/`pool_unwind` work (dormant, ENGINE.5 R-2); NO enum migration
  (`initial_grant` exists at 0009).
- NO SPEC truth-up beyond riders R-A..R-D (S2/S4/S5 + §3.5:287/§8.3 → sweep).
- NO value tuning (HARDEN.5 owns `INITIAL_USER_DHARMA`'s real value).

## Execute ritual (full, no narrowing — critical path + Ultrathink)

Fresh CC session + fresh web chat off `feat/engine-13-initial-grant` (verify the name
is free; assert `git branch --show-current` after checkout). Kickoff passes
`@docs/plans/ENGINE.13.md` to every subagent. Subagents pinned `model: claude-fable-5`
/ `effort: xhigh`; gated `max` on-demand only.

Micro-pins (F-2):
- **F-2a:** "0013" is the EXPECTED-next migration index — re-verify the actual next
  index at execute before generating (ENGINE.12 F3b house pattern; rename file + plan
  refs if drifted).
- **F-2b:** pre-RED fixture sweep: `grep -rn "initial_grant" tests/` — S1's
  zero-call-site grep covered `src/` only; any pre-existing fixture inserting
  `initial_grant` rows must be surfaced (a same-user duplicate would now 23505 under
  0013) before `@test-writer` starts.

1. **Phase 2 START — `@test-writer`:** T1–T7 RED against this plan's test-plan section
   (never edits `src/`).
2. **Implement** the CLOSED file set; `just db-generate initial_grant_user_unique` for
   0013; riders R-A..R-D + CLAUDE/AGENTS one-liners in the same commits as their code.
3. **Gates (local, pre-PR):** `ZUGZWANG_ENV=preview just verify` + `pnpm
   test:invariants` + `pnpm test:integration` + `just test-db` + targeted `pnpm vitest
   run tests/server/auth tests/unit/dharma` — local :54322 up (Docker + supabase).
4. **Reviewer cascade (post-audit order):** `@code-reviewer` (src/server diff) →
   `@security-auditor` FULL SCOPE — the auth/signup path is explicitly in scope: grant
   reachability from unauthenticated surfaces, the onboarding-ref trust boundary, the
   no-op branches, double-grant exploitability → `@db-migration-reviewer` (0013 +
   schema coherence). FAIL in scope → fix in-session; SURPRISE → `claude-progress.md`
   + STOP.
5. **§5.10 pre-PR self-audit** against this plan item-by-item (schema / server /
   migration / riders grep-verified) — PASS/FAIL/SURPRISE; PR opens only when clean.
6. **PR:** `feat(dharma): ENGINE.13 — initial grant at first ToS acceptance
   (F-AUTH-4 tx + I-GRANT-ONCE-001)`; commit identity `Zugzwang/world
   <zugzwangworld@proton.me>`; multi-line messages via `/tmp/commit-msg.txt` (unique
   per task); squash-merge; canonical SHA = the squash SHA on `main`; session log
   before `/clear`.

## ADRs needed

NONE. ADR-0018 already rules the grant (amount shape, equal-for-all, timing left to
mechanics); R1a–R4a are plan-level mechanics under that decision; the §5.12 same-commit
doctrine is satisfied by riders R-A..R-D. No ADR-0013 patch: this tx never touches a
pool row, and the `users → dharma_ledger → events` order shares no cycle with the W-1
`pools → users → …` chain (grant-vs-bet same-user concurrency is structurally
unreachable pre-cookie).

## References

S1 sync-gate + S2 recon (plan chat, 2026-06-11) · ENGINE.5 R-1/R-2 + `ledger.ts:38-39`
+ `persist.ts:51-62` · ENGINE.12 plan + `accrual.ts` (producer mirror) + 0012 (generated
index path) + I-DAILY-ONCE-001 (backstop spec mirror) · ADR-0018 (Driver 3, issuance
table) · SPEC.1 §10.1:463 / §10.2:469 / §13 F-AUTH-4 / §16.1:930 · SPEC.2 §3.5:287-289 /
:762 / §19.4.1 · ADR-0016 D1 (handler-entry ids) · ADR-0005 (event-sourced) ·
tos-accept.ts / tos-accept-event.test.ts (the seam + DB-backed vehicle).
