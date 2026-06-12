# ENGINE.14 — Market lifecycle writes (plan)

> **Status:** Rulings R-14.1–R-14.6 founder-ratified 2026-06-12, **binding, not
> reopenable by this plan**. Plan text ratified at S4 of the ENGINE.14 plan session
> (this revision). Merges via the docs-only Phase P plan PR; the execute pair
> (fresh CC session + fresh web gate chat) starts from a `main` carrying this file.
> **Task:** ENGINE.14 — Market lifecycle writes, per the R-9.7 mint
> (`docs/plans/ENGINE.9.md` §Rulings, ratified 2026-06-11): F-ADMIN-1 market
> create, F-ADMIN-2 seed/open + dormant `pool_seed` activation, the Open → Closed
> transition, and the three remaining `market.*` emits
> (`created` / `opened` / `closed`) + their SPEC.2 §19.4.1 STRIP rows.
> **Base:** `main` @ `b047563` (PR #115 squash) or descendant. Verified at the
> plan-session S1 sync gate (9/9 PASS): plan path absent on every ref,
> EVENT_TYPES = 23 with the three types registered and emit-less, migration head
> 0015 (16 applied locally), `feat/engine-14-*` names free both sides.
> **Branch (execute):** `feat/engine-14-lifecycle`.

---

## Context

ENGINE.9 shipped the resolution half of the market state machine — the first
`markets.status` writers (trigger/settle/void) and the W-3 transaction wrapper.
ENGINE.14 ships the lifecycle half: creation into `Draft`, the seeded
`Draft → Open` commit, and the clock-driven `Open → Closed` cutoff — the last
three `market.*` event types gain their emit sites, completing the market-row
event vocabulary.

The stratum is **not greenfield**. On disk already (S1/S2 recon, 2026-06-12):

- `src/server/markets/transitions.ts` — the ENGINE.4 pure state machine:
  `LEGAL_TRANSITIONS` (8 edges, `Frozen` absorbing), `canTransition`,
  `transition`, `closeOnDeadline` (the single clock-guarded edge, `now` as an
  argument, `==` deadline closes), `assertDeadlineNotExtended` (the B8
  no-extend field-guard). Pure, unpersisted, fully test-pinned
  (`tests/unit/markets/transitions.test.ts`, 49-pair matrix). **Consumed, never
  edited.**
- `src/db/schema/markets.ts` — `markets` (10 columns; `status` enum 7-state,
  default `Draft`; `created_by` default `'admin-singleton'`; **no**
  `open_at`/`close_at`/`seeded_at`) and `pools` (5 columns, 1:1 UNIQUE FK,
  `yes_reserves`/`no_reserves` numeric(38,18) NOT NULL, no `k` column). No CHECK
  constraints on either.
- `src/server/events/schemas.ts` — `market.created` / `market.opened` /
  `market.closed` registered (EVENT_TYPES = 23, inventory pin
  `insert.test.ts:639 .toBe(23)`), **zero emit sites repo-wide**. Shipped
  payloads: `created = {marketId, resolutionDeadline, seedAmount}`,
  `opened = {marketId}`, `closed = {marketId}` — `seedAmount` sits on the wrong
  event for the two-step §15 flow (S2 SURPRISE 3; closed by R-14.1).
- The dormant `pool_seed`: enum value exists (`dharma.ts:24`), rejected on the
  ledger write path and the conservation checker (`POOL_DORMANT_TAGS`,
  `DharmaPoolTagError` — ENGINE.5 R-2), and `dharma_ledger.user_id` is
  **NOT NULL with an FK to `users`** — a `pool_seed` ledger row is structurally
  unwritable (S2 R4 critical fact; closes Q1's form question).
- W-3 (`src/server/resolution/transaction.ts`) — the spine ENGINE.14 duplicates:
  SERIALIZABLE, markets-first `FOR NO KEY UPDATE`, `expectedStatus`
  precondition, full-jitter retry on 40001/40P01, parameterised
  `statement_timeout`. W-1 (`src/server/bets/transaction.ts`) reads
  `markets.status` **unlocked** by design. Both **byte-untouched** this stratum.

Spec substance lives in SPEC.1 §15 (F-ADMIN-1 :861-867, F-ADMIN-2 :869-875 —
note: §15, not §11), §6.1 (lifecycle graph + triggers), §10.1/§10.5/§10.6
(admin actor, seed economics, fixed-at-creation), §12.1 (deadline ceiling), and
cpmm.md §7.1 (symmetric initialisation, exactly once). SPEC.2 carries **no**
§3.x form and **no** §19.4.1 rows for the three types (S2 SURPRISE 2) — both
are same-commit obligations of this stratum under §19.4.1's own amendment rule
(SPEC.2.md:1895).

Binding precedence: SPEC > ADR > tracker > kickoff. The tracker has no
ENGINE.14 row — known drift; the ratified mint in the merged ENGINE.9 plan +
log is the authority (sweep deferred to after ENGINE.10 by founder ruling
2026-06-12).

---

## §Rulings — founder-ratified payload (2026-06-12; binding)

- **R-14.1 — Seed recording form (closes Q1; discharges S2 SURPRISEs 3 + 4).**
  "Dormant `pool_seed` activation" means the seed **flow** ships; the enum value
  stays dormant. F-ADMIN-2's single transaction: insert the `pools` row with
  symmetric reserves `y₀ = n₀ = seedAmount` (cpmm.md §7.1 — "symmetric
  initialisation, exactly once"; ENGINE.9 carry-forward 2 preserved), flip
  `markets.status` `Draft → Open`, and emit `market.opened` carrying
  `seedAmount`, with `metadata.actor_id = 'admin-singleton'`,
  `metadata.user_id = null`. **No `dharma_ledger` row** — R-2 stands;
  `POOL_DORMANT_TAGS` and `DharmaPoolTagError` are untouched. Consequence:
  **`seedAmount` moves from `market.created`'s payload to `market.opened`'s**
  (the seed instant is `Draft → Open`, not creation — SPEC.1 §15 + cpmm.md
  §7.1). The schema edit, both affected payload fixtures, the emit sites, and
  the §19.4.1 rows ride the same commit. Riders fix the three stale
  pre-R-2 / pre-two-step phrasings (cpmm.md §7.1 :306 "ledger entry
  `pool_seed`"; SPEC.1 §10.1 :464 "Seeds pools at market creation"; F-ADMIN-2's
  "synthetic actor in the Dharma ledger"). Seed **magnitude** stays a service
  input — the admin enters it per market; `POOL_SEED_PER_MARKET_DEFAULT` stays
  TBD for the number-tuning pass (~2026-09-01). Nothing in this stratum pins a
  value.

- **R-14.2 — Transaction shape (closes Q2): mint W-4, duplicate the spine.**
  A lifecycle wrapper at `src/server/markets/transaction.ts`, duplicating the
  W-3 spine per the C-3 doctrine (no extraction; **W-1 and W-3 byte-untouched**
  — standing constraint). Open/close lock the `markets` row FIRST
  (`FOR NO KEY UPDATE`) with an `expectedStatus` precondition; create runs the
  same SERIALIZABLE + full-jitter retry spine with **no row lock** (no row
  exists yet — SSI's predicate handling covers the slug race, §Wrapper (c)).
  `statement_timeout` = 1 000 ms for all three (no fan-out flows here). Global
  lock order conformance: `markets → pools → … → events`, the middle tables
  untouched. The close-vs-bets SSI/G6 story is stated in full at §Wrapper (b),
  not assumed. **ADR-0013 §5.12 gains a P3 patch record** (decision unchanged):
  W-4 registered as the second markets-first writer; P2's "markets is locked by
  W-3 only" sentence updated.

- **R-14.3 — Close trigger (closes Q3): clock-driven service; wiring deferred;
  window accepted with eyes open.** Per SPEC.1 §6.1, `Open → Closed` is the
  server clock crossing `resolution_deadline` — not an admin action. ENGINE.14
  ships `closeMarket` (W-4, `expectedStatus ['Open']`, clock-guarded through
  the existing pure `closeOnDeadline` with caller-supplied `now`, emits
  `market.closed`) and a `closeDueMarkets(now)` sweep iterator. The
  **invocation** (cron route; optional admin manual close surface) is
  ENGINE.10's HTTP work. Accepted cost, founder-ratified: between the deadline
  instant and the next sweep tick, a stale-`Open` row still accepts bets — W-1
  is untouched, so no deadline check enters the bet path this stratum. Bounded
  by sweep cadence (per-minute class); resolution cannot race it (F-ADMIN-3
  trigger requires `Closed`). Minted as carry-forward 1.

- **R-14.4 — Payloads + zero columns (closes Q4).** Final payloads:
  `market.created = {marketId, resolutionDeadline}` ·
  `market.opened = {marketId, seedAmount}` · `market.closed = {marketId}`.
  **No new `markets` columns and no migration**: lifecycle instants live in the
  events rows (ADR-0005 Pattern A; `created_at` derives from the UUIDv7 id);
  nothing on disk consumes an `opened_at`/`closed_at`. Create's content
  mapping: **question → `title`, resolution criterion → `description`, with
  `description` service-required** (the column stays nullable — a NOT NULL
  migration would ripple all 33 fixture insert sites, the L-E9.2 class; bad
  trade for a single-admin write path). A dedicated `resolution_criterion`
  column and `display_order` are deferred (carry-forwards 3–4). Riders pin the
  mapping in SPEC.1 §15 and **kill SPEC.2 B.2's 3-state status drift in the
  same B.2 edit** (PRECURSOR.5 backlog, ratified to ride; the now-stale drift
  comment at `src/db/schema/markets.ts:13-14` gets a pre-declared comment-only
  edit — §File plan).

- **R-14.5 — Admin actor belt (closes Q5): born asserted; retrofit stays
  ENGINE.10.** All three ENGINE.14 flows assert
  `metadata.actor_id === 'admin-singleton' && metadata.user_id === null` at
  service entry, via a small shared guard minted at
  **`src/server/admin/actor.ts`** (the ADR-0010 semantic home). ENGINE.10 later
  imports the same guard to retrofit the four resolution call sites — the
  ENGINE.9-approved tree is **not reopened now**. The ENGINE.9 register's
  ENGINE.10 security-handoff row shrinks to: resolution-site retrofit +
  `reason` max-length at the form boundary.

- **R-14.6 — Ceiling enforcement (closes Q6): service guard only; no CHECK;
  zero migrations.** A pinned module constant
  `FREEZE_INSTANT_UTC = 2026-11-05T23:59:00Z` (a fixed J10 date — **not** a
  tuning value) enforced in `createMarket`: reject
  `resolutionDeadline > FREEZE_INSTANT_UTC` (`==` passes — "≤" per SPEC.1
  §12.1). `assertDeadlineNotExtended` remains the no-extend half for future
  edit paths (its callers are later strata — unchanged). A DB CHECK is real
  defense-in-depth but ripples every fixture whose deadline exceeds the ceiling
  (L-E9.2 class, 33 insert sites) to guard a path only the admin can write —
  **HARDEN candidate instead** (carry-forward 2). Combined with R-14.4:
  **ENGINE.14 ships zero migrations**, and `@db-migration-reviewer` is not
  engaged at execute (stated in §Execute ritual).

---

## Plan-level decisions (D-14.a–f — subordinate to the rulings; reviewable at S4)

- **D-14.a — Slug is caller-supplied, format-guarded, pre-checked in-tx.**
  `markets.slug` is NOT NULL UNIQUE on disk. The admin supplies it explicitly
  (single-admin curation; no auto-slugify magic). Service validates
  `^[a-z0-9]+(?:-[a-z0-9]+)*$`, length 3–80. Inside the create transaction, an
  existence pre-check by slug returns the typed `MarketSlugTakenError`; the
  UNIQUE constraint stays the silent belt. Race story: two concurrent creates
  with the same slug both predicate-read "absent" under SERIALIZABLE → SSI
  aborts one with 40001 → retry re-runs the pre-check → typed error. A surfaced
  23505 therefore signals a logic bug (house OQ-7 doctrine), not a handled
  path.
- **D-14.b — Create requires a live deadline.** `createMarket` rejects
  `resolutionDeadline ≤ now` (`MarketDeadlineInPastError`) in addition to the
  R-14.6 ceiling. A born-expired Draft is an admin mistake surfaced, not
  stored.
- **D-14.c — Open rejects an expired deadline.** `openMarket` rejects
  `now ≥ resolutionDeadline` (same typed error) — opening a market the sweep
  would close on its next tick is surfaced, not allowed.
- **D-14.d — The sweep emits as `admin-singleton`.** Clock-driven closes carry
  `actor_id = 'admin-singleton'`, `user_id = null` — the deadline is the
  admin's committed market parameter; the clock executes the admin's standing
  instruction. No `'system'` actor identity is introduced this stratum (the
  R-14.5 assert stays uniform across all three flows). Deferred as
  carry-forward 5.
- **D-14.e — Clock as argument, all the way up.** All three flows take
  `now: Date` as an explicit argument (the `transitions.ts` pure-clock
  discipline extended to the service layer). The HTTP/cron layer injects the
  real clock at ENGINE.10; tests supply instants. No flow reads `Date.now()`
  internally.
- **D-14.f — Response shapes (pinned; ids semantic per L-E9.3).**
  `createMarket → { marketId, slug, status: 'Draft', createdEventId }` ·
  `openMarket → { marketId, poolId, status: 'Open', seedAmount, openedEventId }`
  · `closeMarket → { marketId, status: 'Closed', closedEventId }` ·
  `closeDueMarkets → { closed, skipped, closedMarketIds }`. The RED suite pins
  every returned event id **semantically** (`===` the inserted events row's id;
  `≠ marketId`; `≠` any adjacent id) — the L-E9.3 lesson applied from S1, never
  `toBeDefined()`.

---

## §Wrapper — W-4, the lifecycle transaction

`src/server/markets/transaction.ts`. Duplicates the W-3 spine (C-3 doctrine —
no shared extraction; W-1/W-3 byte-untouched):

- **Spine:** `db.transaction(…, { isolationLevel: "serializable" })`;
  `SET LOCAL statement_timeout = 1000` + `idle_in_transaction_session_timeout =
  30000`; full-jitter retry over `BACKOFF_BASES_MS = [50, 100, 200]` for
  SQLSTATEs `{40001, 40P01}`; exhaustion → Sentry
  `lifecycle_serialization_exhausted` + `LifecycleSerializationExhaustedError`.
- **(a) Locked branch (open, close):** `lockMarket` — `SELECT id, status,
  resolution_deadline FROM markets WHERE id = $1 FOR NO KEY UPDATE` (status
  writes never touch a PK/FK-target column — the W-3 justification holds
  verbatim); then the `expectedStatus` precondition (`['Draft']` for open,
  `['Open']` for close) → `MarketLifecycleStateError` on mismatch. Writes
  follow the global order: `markets` (locked first) → `pools` (open's INSERT)
  → `events`. The middle tables (`positions`, `dharma_ledger`, `users`) are
  never touched by any lifecycle flow.
- **(b) Close vs. bets — the SSI/G6-at-close story, stated:** W-1 deliberately
  reads `markets.status` **unlocked** (`bets/transaction.ts:78-86`) and never
  locks `markets`, so no `pools → markets` acquisition path exists — W-4
  introduces no new deadlock geometry. A bet in flight at the deadline
  crossing races close's `status` write purely through SSI: either the bet
  serializes first (it commits against a still-`Open` snapshot — inside the
  R-14.3 accepted window), or the close serializes first and the bet's
  snapshot read conflicts → 40001 → W-1 retry re-reads `Closed` →
  `MarketNotOpenError`. No interleaving produces a half-applied state. This is
  the Open→Closed analogue of ENGINE.9's §Wrapper (b) Closed→Resolving
  argument; SPEC.1's lettered G6 (in-flight commit-or-timeout) governs the
  **Resolving** flag and is untouched here — F-BET-6's fine window stays
  deferred.
- **(c) Create branch (no lock):** no row exists to lock. The transaction is
  INSERT `markets` → INSERT `events` under SERIALIZABLE; the slug race
  resolves per D-14.a (SSI 40001 → retry → typed error). Lock-order trivially
  conforms (`markets → events`).
- **(d) Open's pool INSERT cannot collide with W-1:** the coarse gate rejects
  all non-`Open` bets, and the `pools` row does not exist until this very
  transaction creates it — there is no pre-`Open` W-1 traffic to contend with.
  The `pools.market_id` UNIQUE is the silent belt behind opened-exactly-once
  (which the `expectedStatus ['Draft']` + markets lock already enforce at the
  logic level).

---

## §Flows

**`createMarket` (F-ADMIN-1)** — args `{ slug, title, description,
resolutionDeadline, now, metadata, eventId? }` (event id minted in-flow,
UUIDv7, matching the shipped resolution flows — execute S0 confirms the mint
idiom against `settle.ts`).
Validation order: (1) `assertAdminActor(metadata)` (R-14.5); (2) slug format
(D-14.a); (3) `title` and `description` non-empty after trim (R-14.4 —
criterion is service-required); (4) `resolutionDeadline > now` (D-14.b);
(5) `resolutionDeadline ≤ FREEZE_INSTANT_UTC` (R-14.6).
Transaction (W-4 create branch): slug pre-check → INSERT `markets`
(status defaults `Draft`, `created_by` defaults `'admin-singleton'`) →
`insertEvent('market.created', {marketId, resolutionDeadline})`.
Response per D-14.f. Errors: `AdminActorError`, `MarketSlugInvalidError`,
`MarketSlugTakenError`, `MarketContentRequiredError`,
`MarketDeadlineInPastError`, `MarketDeadlineCeilingError`.

**`openMarket` (F-ADMIN-2)** — args `{ marketId, seedAmount, now, metadata }`.
Validation: (1) actor assert; (2) `seedAmount` is a valid `numericString`,
strictly `> 0`, scale ≤ 18 — exact-decimal discipline, the same string-math
posture as the shipped cpmm module; no float ever touches the value
(`MarketSeedInvalidError` otherwise); (3) deadline-expiry guard per D-14.c
(read inside the tx from the locked row — not a separate pre-read).
Transaction (W-4 locked, `expectedStatus ['Draft']`): lock markets → assert
`now < resolution_deadline` (D-14.c) → pure `transition('Draft','Open')`
consulted (defensive; illegal_edge here is unreachable and throws) → INSERT
`pools` `{ marketId, yesReserves: seedAmount, noReserves: seedAmount }` — the
exact same string written to both columns (carry-forward 2 preserved **by
construction**: one production `pools` INSERT site in the codebase, symmetric
by code shape) → UPDATE `markets.status = 'Open'` →
`insertEvent('market.opened', {marketId, seedAmount})`.
Response per D-14.f. Errors: `AdminActorError`, `MarketSeedInvalidError`,
`MarketLifecycleStateError`, `MarketDeadlineInPastError`.

**`closeMarket`** — args `{ marketId, now, metadata }`.
Transaction (W-4 locked, `expectedStatus ['Open']`): lock markets →
`closeOnDeadline({ status, now, resolutionDeadline })` — `ok` ⇒ UPDATE
`markets.status = 'Closed'` + `insertEvent('market.closed', {marketId})`;
`deadline_not_reached` ⇒ `MarketDeadlineNotReachedError` (zero writes);
`illegal_edge` is pre-gated by `expectedStatus` ⇒ defensive throw.
Response per D-14.f.

**`closeDueMarkets`** — args `{ now, metadata }`. Unlocked candidate SELECT:
`id WHERE status = 'Open' AND resolution_deadline <= now ORDER BY id` (uses
`markets_status_idx` + `markets_resolution_deadline_idx`). Then **one W-4
transaction per market** via `closeMarket` — a single failure never poisons
the batch; a candidate raced into another state between SELECT and lock
surfaces as `MarketLifecycleStateError`, is counted in `skipped`, and the
sweep continues. Re-running the sweep is idempotent (`{closed: 0, …}`).
Each close mints its own event id. Actor per D-14.d.

**`src/server/admin/actor.ts`** — `assertAdminActor(metadata)`: throws
`AdminActorError` unless `actor_id === 'admin-singleton' && user_id === null`.
~40 lines including the doc block naming ENGINE.10's retrofit consumption.

---

## §Events — same-commit obligations

- `schemas.ts` edit: `seedAmount` **moves** `market.created → market.opened`
  (R-14.1/R-14.4). EVENT_TYPES count **stays 23**; the inventory pin
  (`insert.test.ts:639`) is untouched; the payload-shape fixtures at
  `insert.test.ts:201/:212/:219` are edited to the new shapes (rides the RED
  commit — §Execute ritual, pre-declared per L-E9.1).
- Emit sites: exactly three, one per flow, all inside the W-4 transaction via
  the bound-transaction `insertEvent` (ADR-0005 Pattern A; caller-minted
  UUIDv7; `created_at` derived from the id; ON CONFLICT DO NOTHING dedupe).
- §19.4.1 STRIP rows (SPEC.2), same commit as the emit sites per the table's
  own amendment rule (:1895): `market.created | — (none) | marketId +
  resolutionDeadline both SHIP` · `market.opened | — (none) | marketId +
  seedAmount SHIP (seed is public CPMM state — it IS the reserves)` ·
  `market.closed | — (none) | marketId SHIPS`.
- **The L-E9.1 pre-declared fold:** schema registration edits and emit sites
  cannot split across commits (the `insertEvent` Zod registry enforces it
  mechanically). This plan therefore defines **one implementation commit**
  carrying flows + W-4 + actor guard + `schemas.ts` edit together — there is
  no "schemas step" to fold mid-execute.

---

## §Worked example + identities (hand-verified at S4)

Seed `C = 1000.000000000000000000` Đ at open:

- `pools` row: `yes_reserves = no_reserves = '1000.000000000000000000'` —
  **string-identical** to `seedAmount` and to each other (test P4 pins string
  equality, not numeric closeness).
- Implied price `p_yes = n₀ / (y₀ + n₀) = 1000/2000 = 0.5` exact; constant
  product `k = y₀ · n₀ = 10⁶` (cpmm.md §3.2/§7.1 — pair-mint of C share
  pairs). No `k` column exists; `k` is derived state.
- **Reverse direction:** reading the open-instant state back, both reserve
  strings must equal the `market.opened` payload's `seedAmount` exactly — the
  event row alone reconstructs the pool's initial state (dataset-release
  property).
- **Downstream dependency (carry-forward 2, ENGINE.9):** void's cash
  cross-assert derives residual pool cash on the `Y₀ = N₀` assumption and
  fails loud if it breaks. ENGINE.14 preserves it by construction (single
  symmetric INSERT site) and pins it by test (P4). Conservation identities
  (i)/(ii)/(iii) are **untouched**: lifecycle writes produce zero
  `dharma_ledger` rows, and the checker sums user-only flows.

---

## §Migration

**None.** R-14.4 (zero new columns) + R-14.6 (service-guard ceiling, no CHECK)
⇒ migration head stays `0015`; `drizzle/migrations/` is in the CLOSED set;
`@db-migration-reviewer` is not engaged. Named HARDEN candidates instead:
the ceiling CHECK (carry-forward 2) and the `resolution_criterion` /
`display_order` columns (carry-forwards 3–4) — each would trigger the L-E9.2
fixture-ripple class and is deliberately deferred.

---

## §Invariants posture

| Invariant / constraint | ENGINE.14 effect |
|---|---|
| INV-4 append-only events | Preserved — three new emit sites, zero mutations; `insertEvent` only |
| Conservation (i)/(ii)/(iii) | Untouched — zero ledger rows from lifecycle flows |
| R-2 ledger user-only | Untouched — `POOL_DORMANT_TAGS` / `DharmaPoolTagError` byte-identical |
| Carry-forward 2 (`Y₀ = N₀`) | Preserved by construction + pinned (test P4) |
| W-1 / W-3 | **Byte-untouched** (zero-line diff — standing constraint) |
| `transitions.ts` | Byte-untouched — consumed via imports only |
| EVENT_TYPES inventory | Count stays 23; pin `.toBe(23)` untouched |
| ADR-0013 global lock order | Conformed and extended in prose only (P3 patch record) |
| Opened-exactly-once | `expectedStatus ['Draft']` under the markets lock; `pools.market_id` UNIQUE as silent belt |

---

## §Test plan charter (RED-first by `@test-writer`; DB-backed unless noted)

`tests/server/admin/markets.test.ts` (NEW — SPEC.1-named acceptance home):
- **M1 `deadline-form-validation`** (spec-pinned name): ceiling reject
  (`deadline > FREEZE` → `MarketDeadlineCeilingError`), boundary **pass** at
  `deadline == FREEZE`, past-deadline reject (D-14.b). Zero rows / zero events
  written on every reject (asserted).
- **M2 `create-happy-draft-and-event`**: row lands `Draft`,
  `created_by = 'admin-singleton'`, `market.created` row with payload exactly
  `{marketId, resolutionDeadline}` (no `seedAmount` key — pins the R-14.1
  move), response ids semantic (D-14.f / L-E9.3).
- **M3 `slug-taken-typed`**: second create, same slug → `MarketSlugTakenError`;
  exactly one row persists.
- **M4 `actor-assert-rejects`**: `user_id` non-null and `actor_id ≠
  'admin-singleton'` each → `AdminActorError`, zero writes.

`tests/server/admin/pool-seed.test.ts` (NEW — SPEC.1-named acceptance home):
- **P1 `seed-flow-and-state-transition`** (spec-pinned name): Draft fixture →
  `openMarket` → status `Open`, one `pools` row, `market.opened` payload
  exactly `{marketId, seedAmount}`, response per D-14.f.
- **P2 `rejects-non-draft`**: against `Open` and `Closed` fixtures →
  `MarketLifecycleStateError`; zero pools rows / zero events.
- **P3 `rejects-invalid-seed`**: `'0'`, negative, >18-dp scale, malformed →
  `MarketSeedInvalidError`.
- **P4 `symmetric-seed-pin`** (carry-forward 2): `yes_reserves`,
  `no_reserves`, and payload `seedAmount` are **string-identical** at 18 dp.
- **P5 `rejects-expired-deadline-open`** (D-14.c).

`tests/server/markets/close.test.ts` (NEW):
- **C1 `closes-at-and-after-deadline`**: `now == deadline` and `now >
  deadline` both close + emit (payload `{marketId}` exact).
- **C2 `rejects-before-deadline`**: `MarketDeadlineNotReachedError`, zero
  writes.
- **C3 `rejects-non-open`**: Draft / Closed / Resolved fixtures →
  `MarketLifecycleStateError`.
- **C4 `sweep-mixed-batch`**: fixtures {2 due-Open, 1 future-Open, 1 Closed} →
  `{closed: 2, skipped: 0}` with the Closed row never selected, exactly 2
  `market.closed` events, future-Open untouched.
- **C5 `sweep-idempotent`**: immediate re-run → `{closed: 0}`; event count
  unchanged.

`tests/server/markets/concurrency.test.ts` (NEW):
- **X1 `double-open-single-pool`**: two concurrent `openMarket` calls → exactly
  one succeeds, one `MarketLifecycleStateError` (or one 40001-retry into it);
  exactly one `pools` row, exactly one `market.opened` event.
- **X2 `close-vs-bet-serializes`**: concurrent `closeMarket` + W-1 `placeBet`
  → terminal state is consistent under either serialization order (bet
  committed-then-closed, or `MarketNotOpenError`); no deadlock; no event/row
  partials. (Exercises §Wrapper (b).)

EDIT — `tests/server/events/insert.test.ts`: payload fixtures `:201/:212/:219`
to the new shapes (created loses `seedAmount`; opened gains it). Inventory
lines `:623-625` and the `.toBe(23)` pin untouched. Rides the RED commit.

~24 tests across 4 new files + 1 edit. All fixture arithmetic (the §Worked
example values) hand-derived in the web lane before S5 and re-verified at the
execute gates.

---

## §File plan

**NEW (src):**

| File | Budget (lines) |
|---|---|
| `src/server/markets/transaction.ts` (W-4) | ≤ 220 |
| `src/server/markets/create.ts` | ≤ 140 |
| `src/server/markets/open.ts` | ≤ 170 |
| `src/server/markets/close.ts` (incl. sweep) | ≤ 200 |
| `src/server/admin/actor.ts` | ≤ 60 |

**EDIT (src):** `src/server/markets/errors.ts` (+≤ 70 — the lifecycle error
taxonomy beside `MarketTransitionError`); `src/server/events/schemas.ts`
(± ≤ 8 — the `seedAmount` move + the two payload doc lines);
`src/db/schema/markets.ts` **comment-only** (`:13-14` stale-drift note removed
once B.2 is fixed; −2/+1, zero runtime — pre-declared CLOSED-set carve-out).

**NEW (tests):** `tests/server/admin/markets.test.ts` ≤ 240 ·
`tests/server/admin/pool-seed.test.ts` ≤ 280 ·
`tests/server/markets/close.test.ts` ≤ 280 ·
`tests/server/markets/concurrency.test.ts` ≤ 220.
**EDIT (tests):** `tests/server/events/insert.test.ts` ± ≤ 14.

**EDIT (docs — riders, §Riders):** SPEC.1 (+≤ 50/−≤ 12), SPEC.2 (+≤ 60/−≤ 8),
`docs/specs/cpmm.md` (± ≤ 6), `docs/adr/0013…md` (+≤ 24, P3),
`AGENTS.md` (+≤ 12).

**Hard diff budget: ≤ +2,300 / −60** across the branch (excl. the plan file
itself, which lands at Phase P).

**CLOSED set (zero-line diff, asserted at the §5.10 self-audit):**
`src/server/bets/**` · `src/server/resolution/**` · `src/server/dharma/**` ·
`src/server/events/insert.ts` · `src/server/markets/transitions.ts` ·
`src/db/schema/**` (sole exception: the pre-declared `markets.ts:13-14`
comment edit) · `drizzle/migrations/**` · `src/server/auth/**` · all tests not
named above · `CLAUDE.md` · the tracker.

---

## §Riders (docs-only commit at execute; before-text anchors grep-verified at the gate)

- **R-A — SPEC.1 §15 F-ADMIN-1** (:861-867): System text gains the
  question→`title` / criterion→`description` (service-required) mapping and
  the service-enforced ceiling constant; adds an **Errors** line
  (`deadline_ceiling`, `deadline_in_past`, `slug_taken`, `slug_invalid`,
  `content_required`, `admin_actor`) and an **Invariants** line (INV-4;
  events-per-write). `display_order` marked deferred (carry-forward 4).
- **R-B — SPEC.1 §15 F-ADMIN-2** (:869-875): "a synthetic actor in the Dharma
  ledger" → "an events-log actor; never a `dharma_ledger` row (R-2)"; seed
  recorded as the `seedAmount` payload field on `market.opened`; adds Errors
  (`market_not_draft`, `seed_invalid`, `deadline_in_past`, `admin_actor`) +
  Invariants (carry-forward 2 named) lines.
- **R-C — SPEC.1 §10.1** (:464): "Seeds pools at market creation" → "at the
  Draft → Open commit (F-ADMIN-2)". §6.1 untouched (already correct).
- **R-D — SPEC.2 §3.7 (NEW block)**: "Market lifecycle writes (W-4)" — the
  three events, actor form (`actor_id = 'admin-singleton'`,
  `user_id = null`), `seedAmount` on `opened`, one-emit-per-flow. Mirrors
  §3.6's resolution form.
- **R-E — SPEC.2 §19.4.1**: the three STRIP rows (§Events wording), same
  commit as the emit sites per :1895.
- **R-F — SPEC.2 B.2**: status row 3-state → the built 7-state enum
  (PRECURSOR.5 drift killed, founder-ratified ride); B.3 gains one seed
  sentence ("reserves initialised symmetrically to `seedAmount` at
  `Draft → Open`; W-4").
- **R-G — cpmm.md §7.1** (:306): "ledger entry `pool_seed`, admin → pool" →
  "recorded as the `seedAmount` payload field on the `market.opened` events
  row + the `pools` reserve initialisation; never a `dharma_ledger` row
  (R-2)".
- **R-H — ADR-0013 §5.12 P3 patch record** (in-place, decision unchanged): W-4
  registered as the second markets-first writer; P2's "markets is locked by
  W-3 only" updated to "W-3 and W-4 only"; no-cycle argument extended (W-4
  never acquires `pools → markets`; create acquires no row locks).
- **R-I — AGENTS.md**: file-map rows for `src/server/markets/{transaction,
  create,open,close}.ts` + `src/server/admin/actor.ts` (alphabetical order —
  the S6 LOW-3 lesson).
- **Version bumps:** SPEC.1 1.0.3 → 1.0.4 + §20 changelog row; SPEC.2
  1.0.3 → 1.0.4 + §0.1 row (the established pairing convention).

---

## Carry-forwards consumed / minted

**Consumed:**
- ENGINE.9 carry-forward 2 (`Y₀ = N₀`) — obligation discharged: preserved by
  construction, pinned by P4. The assumption itself stays live for void's
  cross-assert (not retired; now guarded).
- ADR-0013 P2's "markets is locked by W-3 only" — superseded by P3.
- The ENGINE.0 forward-registration of the three payload schemas — emit sites
  land; the `seedAmount` placement defect (S2 SURPRISE 3) corrected.

**Minted:**
1. **Close-lag window** (R-14.3): deadline-to-sweep-tick stale-`Open` bets;
   bounded by cron cadence. Owner: ENGINE.10 (wiring) + HARDEN (cadence
   tuning; optional W-1 deadline guard if ever revisited — would touch W-1,
   founder gate required).
2. **Ceiling CHECK constraint** on `resolution_deadline` — HARDEN
   defense-in-depth candidate (L-E9.2 ripple priced in there).
3. **`resolution_criterion` dedicated column** (criterion currently rides
   `description` per R-14.4) — admin-UI/HARDEN candidate.
4. **`display_order` column** (F-ADMIN-1 optional field) — admin-UI stratum.
5. **`'system'` actor identity** for autonomous ops (sweep currently emits as
   `admin-singleton` per D-14.d) — revisit if any non-admin-parameter
   automation ever lands.
6. **Resolution call-site actor-assert retrofit** via
   `src/server/admin/actor.ts` — ENGINE.10 (sharpened from the ENGINE.9
   register; the guard now exists to import).

---

## Out of scope (stated so execute does not drift)

- ENGINE.10 entirely: HTTP/cron invocation, admin UI surfaces, error-code
  envelope mapping (§15 HTTP codes), the composed trigger→settle endpoint, the
  resolution-site actor retrofit.
- **Market content** — zero real questions/criteria anywhere; fixtures use
  obvious placeholders (`"PLACEHOLDER — not a real market"` class). Founder
  owns content sign-off separately.
- Draft-edit and Draft-discard surfaces (§6.1's "Draft → discard"; the
  `assertDeadlineNotExtended` callers) — later strata.
- F-BET-6 fine in-flight window; freeze enforcement; any W-1/W-3/dharma edit;
  seed-value pinning (number-tuning pass); the tracker (sweep deferred, post-
  ENGINE.10); Testnet/Mainnet anything.

## Open questions

None at ratification. Q1–Q6 → R-14.1–R-14.6; the residual judgment calls are
recorded as D-14.a–f (reviewed at S4).

---

## Execute ritual (full, no narrowing — money-adjacent critical path + Ultrathink)

This plan merges via the **Phase P plan PR** (docs-only; session log follows in
its own PR). The execute pair (fresh CC session + fresh web gate chat) starts
from a `main` carrying the merged plan, referenced as
`@docs/plans/ENGINE.14.md` in the execute kickoff. `ultrathink` in every coding
prompt. Branch `feat/engine-14-lifecycle`. Effort: gated-xhigh default; the
operator may pin `/effort max` session-only at kickoff (the ENGINE.7/9
money-code precedent — recommended). Ultracode OFF.

Order:
1. **S0 sync gate** (zero writes): clean main carrying this plan; W-1/W-3/
   transitions/dharma checksums recorded for the CLOSED-set assert;
   EVENT_TYPES pin = 23 live; migration head 0015; branch free; resolution
   flows' event-id mint idiom confirmed (§Flows note).
2. **S1 RED suite** — `@test-writer` mints the §Test plan charter (M/P/C/X
   files + the insert.test.ts fixture edit, pre-declared). Web gate hand-
   re-verifies every fixture value.
3. **S2 implementation to green** — **one commit** (the L-E9.1 pre-declared
   fold): W-4 + three flows + sweep + actor guard + `errors.ts` +
   `schemas.ts` edit + emit sites + the `markets.ts:13-14` comment edit.
   No subagent (tightly-coupled, §5.11).
4. **S3 riders** — R-A..R-I + version bumps, docs-only commit. Before-text
   anchors grep-verified at the web gate.
5. **S4 §5.10 self-audit** — item-by-item PASS/FAIL/SURPRISE, including:
   CLOSED-set zero-diff proof (`git diff --stat` against the recorded set),
   exactly one production `pools` INSERT site repo-wide, exactly three
   `market.created|opened|closed` emit sites, diff budget respected.
6. **S5 reviewers** — `@code-reviewer` → `@security-auditor` (full branch).
   `@db-migration-reviewer` **not engaged — zero migrations** (stated here so
   its absence is ritual-conformant, not a skip).
7. **S6 gate battery** — `ZUGZWANG_ENV=preview just verify` ·
   `pnpm test:invariants` · `pnpm test:integration` · `just test-db` · full
   `pnpm vitest run` (zero failures).
8. **S7 PR** (squash; body = Summary / Evidence / Notes / Carry-forwards /
   Commit chain; W-1 + W-3 + transitions zero-diff stated) → operator merges
   on CI green → **session log PR** (`chore/engine-14-log`) → END-ON-MAIN →
   PK staging `~/Desktop/zz-pk-refresh-ENGINE.14/` (md5-verified) → final
   report.

Commit identity `Zugzwang/world <zugzwangworld@proton.me>`; no co-author
trailer; multi-line messages via `/tmp/engine14-commit-msg.txt` (unique name —
parallel-lane discipline).

## ADRs needed

- **ADR-0013 §5.12 P3 patch record** only (R-H). No new ADR: W-4 instantiates
  the established ADR-0013 posture; the rulings live in this plan and the
  riders.

## References

SPEC.1 1.0.3 — §6.1 (:204-233), §10.1 (:464-465), §10.5/§10.6 (:498-509),
§12.1 (:578), §15 F-ADMIN-1/2 (:861-875), §16.1, Appendix B
(`POOL_SEED_PER_MARKET_DEFAULT = TBD`, :1402). SPEC.2 1.0.3 — §3.6
(:298-302), §19.4.1 (:1873-1895), B.2 (:2501-), B.3 (:2518-), actor row
(:317). cpmm.md §3.2, §7.1 (:303-317). ADR-0005 (Pattern A); ADR-0013 + P1 +
P2 (live); ADR-0016 D1 (UUIDv7). docs/plans/ENGINE.9.md (R-9.4, R-9.5/R-9.5e,
R-9.7, carry-forward 2, §Wrapper (b)); docs/plans/ENGINE.5.md (R-2);
docs/logs/ENGINE.9.md (carry-forward register; security handoff). Shipped:
`src/server/markets/transitions.ts`, `src/server/resolution/transaction.ts`
(W-3), `src/server/bets/transaction.ts` (W-1), `src/server/events/insert.ts` +
`schemas.ts`. ENGINE.14 plan-session S1 sync-gate + S2 recon reports
(2026-06-12). External lettered register (B5–B8, G6, J10) per SPEC.1 :457 —
not in repo; cited as SPEC.1 renders them.
