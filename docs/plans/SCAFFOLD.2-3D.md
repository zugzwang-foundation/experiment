# SCAFFOLD.2-3D — Plan

> Phase 1 deliverable. Do not commence Phase 2 without web Claude sign-off.

## Header

| Field | Value |
|---|---|
| Tracker ID | SCAFFOLD.2 stratum 3.D |
| Phase | 2 — Core Scaffolding |
| Date | 2026-05-12 |
| Branch (Phase 2) | `feat/scaffold-2-stratum-d` |
| Critical-path | **Yes** — `src/db/schema/` + `drizzle/migrations/` are the contract under test |
| Triggers (CLAUDE.md) | §5.1 plan / §5.6 tests-this-stratum-IS-the-test-stratum / §5.10 pre-PR self-audit / §5.11 `@test-writer` invocation |
| Dependencies | 3.A merged (#16), 3.B merged (#25), 3.C merged (#28). Triggers (0003), partitioning (0002), seed (0004) live in main. |
| Estimate | **5–7 h wall-clock** (revised up from master plan's 4–6h per 3-C drift-absorption observation) |
| Refusal-grade out-of-scope | edits to `src/db/schema/*.ts`, `drizzle/migrations/*.sql`, any `src/server/*`, new ADRs, new SPEC amendments, Better Auth (SCAFFOLD.3), bet transaction wrapper (ENGINE.7), events insert helper (ENGINE.6), decimal-arithmetic library (ENGINE.5) |

## Context

3.D is the verification stratum of SCAFFOLD.2. The 26 triggers across 13 protected tables installed by 3.C (PR #28) are the storage-layer enforcement contract for INV-2 (no-overdraft via append-only `dharma_ledger`), INV-3 (comments side-bound via append-only `comments`), and INV-4 (append-only resolutions via append-only `resolution_events` + `payout_events`). 3.D writes the Vitest suite that proves every trigger fires correctly across every documented case in SPEC.2 §6.1–§6.3 + §6.6, and the canonical INV-4 integration test at `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts` that locks the storage-layer foundation in place. The trigger contract is non-trivial — Bucket A is uniform (RAISE on UPDATE/DELETE), Bucket B is per-table (`friendly_fire_events` has two independent transitions, `image_uploads` has a two-column atomic transition, `identity_pool` and `system_state` have single-column transitions, all four use the universal 3-rule with no-op-permitted) — so a thin test layer would leave the contract effectively unverified.

Outcome: every protected table has a `tests/db/triggers/<table>-append-only.spec.ts` file with explicit per-case `it()` blocks, the canonical INV-4 invariant test exists, the test infrastructure (`tests/db/_fixtures/db.ts`, `vitest.config.ts`, `vite-tsconfig-paths`) is in place, `just test-db` is green with ~51 passing cases against a fresh Supabase Postgres 17.6, and the suite catches any future regression to the trigger SQL or the 13-table protected set.

## Scope

### IN

- `vitest.config.ts` at repo root — minimal Vitest config with `vite-tsconfig-paths` plugin, `pool: 'forks'`, `coverage.enabled: false`, `globals: false`, `testTimeout: 10_000`, `include: ['tests/**/*.{test,spec}.ts']`.
- `tests/db/_fixtures/db.ts` — bypasses `src/db/index.ts` (which carries `import 'server-only'`); exports `testDb` (raw Drizzle client) and `createdAtFromUuidV7(id: string): Date` for the events replay test.
- `tests/db/triggers/<table>-append-only.spec.ts` × 13 — one file per protected table (9 Bucket A + 4 Bucket B).
- `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts` — 3 cases verifying the storage-layer foundation of INV-4.
- `package.json` — add `vite-tsconfig-paths` to `devDependencies`. No other dep changes.
- `pnpm-lock.yaml` — refreshed by `pnpm install`.

**File count: 14 test files + 1 fixture + 1 vitest config + 2 package files = 18 entries.**

**Case-count target: ~51 cases (Bucket A 18 + Bucket B 30 + INV-4 3). SPEC.2 §6.6 floor: 33. Target met with comfortable margin.**

### OUT (refusal-grade per CLAUDE.md §5.4 + SCAFFOLD.2 master "Out of scope")

- Any edits to `src/db/schema/*.ts` (including the `src/db/schema/events.ts` composite-PK alignment to `(event_id, created_at)` — that drift is on the PRECURSOR.5 backlog per 3.C log §4 row 4)
- Any edits to `drizzle/migrations/*.sql` (append-only at the file level per AGENTS.md §6)
- Any new business logic under `src/server/*` (entire `src/server/` tree does not exist yet; ENGINE.* and SCAFFOLD.3 carve)
- New ADRs or SPEC amendments — discovered drift surfaces to Hrishikesh; in-PR amendment is REFUSAL-grade for 3.D
- Better Auth wiring (SCAFFOLD.3)
- Bet transaction wrapper `src/server/bets/transaction.ts` (ENGINE.7) and any sketches thereof
- Events insert helper `src/server/events/insert.ts` (ENGINE.6) and any sketches thereof
- Decimal-arithmetic library choice (ENGINE.5)
- Identity-pool data load (SCAFFOLD.17)
- R2 wrappers (SCAFFOLD.15)
- Sentry / PostHog / alarm wiring (SCAFFOLD.5/6/7)
- CI workflow edits (SCAFFOLD.18)
- BREAK_GLASS.md / runbooks (HARDEN.10)

If during Phase 2 anything tempts edits to the out-of-scope set, the @test-writer subagent must STOP and surface to the main session, and the main session writes to `claude-progress.md` and surfaces to Hrishikesh. No silent absorption.

## Pre-flight verification (read-time confirmations)

Confirmed during Phase 1 read pass. All four post-3.C spec amendments landed:

- ✓ **SPEC.2 §6.3 ¶1** describes `friendly_fire_events` as "two independent NULL → timestamp transitions" — frozen_at AND cleared_at, permits either alone, rejects both together. ✓ (line 599)
- ✓ **SPEC.2 §6.3 closing ¶** describes the uniform 3-rule across all four Bucket B tables with no-op UPDATEs permitted. ✓ (line 635)
- ✓ **SPEC.2 §7.1 partition-constraint ¶** names the composite PK `(event_id, created_at)`. ✓ (line 702)
- ✓ **SPEC.2 §7.3** names `ON CONFLICT (event_id, created_at) DO NOTHING`. ✓ (line 716)

No stop-and-surface. Continue.

Additional confirmations:

- ✓ `drizzle/migrations/0003_append_only_triggers.sql` matches SPEC.2 §6.2 + §6.3. 2 Bucket A functions + 4 Bucket B functions + 26 trigger declarations. Bucket B BEFORE DELETE reuses `enforce_bucket_a_no_delete()` (the no-DELETE function is shared across A and B).
- ✓ `drizzle/migrations/0002_events_partitioning.sql` has composite PK `(event_id, created_at)`, 12 monthly partitions (2026-05 → 2027-04), DEFAULT partition, `events_aggregate_idx`. Range bounds are half-open `[FROM, TO)`.
- ✓ `drizzle/migrations/0004_seed_system_state.sql` inserts `('system', NULL)` with `ON CONFLICT (id) DO NOTHING` — the singleton row exists from day 1; tests must UPDATE, not INSERT.
- ✓ `src/db/schema/events.ts` declares `eventId` as single-column PK (Drizzle type-layer) — composite-PK alignment deferred to PRECURSOR.5 per 3-C log. Tests must use raw `sql\`...\`` for the ON CONFLICT replay assertion because Drizzle's `onConflictDoNothing({ target })` won't accept a composite target it doesn't know about.
- ✓ `src/db/index.ts` carries `import "server-only"` as line 1 — fixture MUST instantiate its own postgres-js + Drizzle clients in `tests/db/_fixtures/db.ts`. Importing `db` from `src/db/index.ts` into a test file fails at module-eval time.
- ✓ `tests/` directory does not exist yet — `@test-writer` creates the whole tree.
- ✓ `node_modules/postgres/types/index.d.ts` declares `PostgresError.code: string` — SQLSTATE matching on `.code` is type-safe.
- ✓ All 11 schema files read. 21 tables enumerated with column lists, FK chains, bucket classifications match SPEC.2 §5.1.

Per-table column enumeration (used in CAT 4 for fixture chains and non-whitelisted column choice):

| Table | Bucket | Columns (Drizzle names; not snake_case yet) |
|---|---|---|
| events | A | event_id (composite PK with created_at), event_type, aggregate_type, aggregate_id, payload, payload_version, metadata, created_at |
| dharma_ledger | A | id, user_id, bet_id (nullable), entry_type, amount, balance_after, created_at + CHECK (balance_after >= 0) |
| bets | A | id, user_id, market_id, side, stake, share_quantity, price_at_bet, comment_id (NOT NULL FK — INV-1), idempotency_key (nullable), created_at |
| comments | A | id, user_id, market_id, parent_comment_id (nullable self-FK), body, image_uploads_id (nullable), side_at_post_time, stake_at_post_time, bet_id (nullable, circular pair), created_at |
| resolution_events | A | id, market_id, event_kind, outcome, corrects_event_id (nullable self-FK), reason (nullable), created_at |
| payout_events | A | id, bet_id, user_id, market_id, resolution_event_id, payout_type, amount, created_at |
| mod_actions | A | id, target_user_id (nullable), target_comment_id (nullable), target_bet_id (nullable), verdict, categories (jsonb), image_r2_key (nullable), actor_id (text NOT NULL), created_at |
| admin_events | A | id, event_type, payload, metadata, created_at — **no FKs** |
| user_events | A | id, user_id (NOT NULL), event_type, payload, metadata, created_at |
| friendly_fire_events | B | id, voter_id, comment_id, direction (up/down enum), cleared_at (whitelisted), frozen_at (whitelisted), created_at |
| identity_pool | B | id, colour, animal, number (smallint), pseudonym (unique), pfp_filename, assigned_at (whitelisted), created_at |
| image_uploads | B | id, user_id, r2_object_key, terminal_state (whitelisted), terminal_at (whitelisted), created_at |
| system_state | B (singleton) | id (text 'system' PK — carve-out from UUIDv7), frozen_at (whitelisted), created_at |

Trigger function names from 0003 (used in error-matching comments):

- Bucket A: `enforce_bucket_a_no_update`, `enforce_bucket_a_no_delete`
- Bucket B: `enforce_friendly_fire_events_transitions`, `enforce_identity_pool_assigned_at`, `enforce_image_uploads_terminal_atomic`, `enforce_system_state_frozen_at`

All `RAISE EXCEPTION` calls are bare (no explicit SQLSTATE) → all surface as `'P0001'`. CAT 6 elaborates.

---

## CAT 1 — Files to create / edit

| Path | Action | Purpose |
|---|---|---|
| `vitest.config.ts` | **CREATE** | Repo-root Vitest config; `vite-tsconfig-paths` plugin; `pool: 'forks'`; `coverage.enabled: false`; `testTimeout: 10_000`; `include: ['tests/**/*.{test,spec}.ts']` |
| `tests/db/_fixtures/db.ts` | **CREATE** | `testDb` raw Drizzle client (bypasses `src/db/index.ts`'s `import 'server-only'`); `createdAtFromUuidV7(id: string): Date` helper for events replay test |
| `tests/db/triggers/events-append-only.spec.ts` | **CREATE** | Bucket A — events: 2 cases (UPDATE rejected, DELETE rejected). Fixture supplies `created_at = '2026-06-15T12:00:00Z'` (mid `events_2026_06` partition). |
| `tests/db/triggers/dharma-ledger-append-only.spec.ts` | **CREATE** | Bucket A — dharma_ledger: 2 cases. FK chain: users only. |
| `tests/db/triggers/bets-append-only.spec.ts` | **CREATE** | Bucket A — bets: 2 cases. FK chain: users → markets → comments (bet_id NULL) → bets. |
| `tests/db/triggers/comments-append-only.spec.ts` | **CREATE** | Bucket A — comments: 2 cases. FK chain: users → markets → comments. |
| `tests/db/triggers/resolution-events-append-only.spec.ts` | **CREATE** | Bucket A — resolution_events: 2 cases. FK chain: markets only. |
| `tests/db/triggers/payout-events-append-only.spec.ts` | **CREATE** | Bucket A — payout_events: 2 cases. FK chain: users → markets → comments → bets → resolution_events → payout_events. |
| `tests/db/triggers/mod-actions-append-only.spec.ts` | **CREATE** | Bucket A — mod_actions: 2 cases. No FK required (target_* all nullable; actor_id is text 'admin-singleton'). |
| `tests/db/triggers/admin-events-append-only.spec.ts` | **CREATE** | Bucket A — admin_events: 2 cases. No FKs. |
| `tests/db/triggers/user-events-append-only.spec.ts` | **CREATE** | Bucket A — user_events: 2 cases. FK chain: users only. |
| `tests/db/triggers/friendly-fire-events-append-only.spec.ts` | **CREATE** | Bucket B — friendly_fire_events: 10 cases (two independent transitions, both-together reject, re-fires, non-whitelisted, no-ops including pre-transition both-NULL, DELETE). FK chain: users (voter) → markets → comments → friendly_fire_events. |
| `tests/db/triggers/identity-pool-append-only.spec.ts` | **CREATE** | Bucket B — identity_pool: 6 cases (whitelisted accept, re-fire reject, non-whitelisted (pseudonym) reject, no-op pre-transition, no-op post-transition, DELETE reject). No FKs. |
| `tests/db/triggers/image-uploads-append-only.spec.ts` | **CREATE** | Bucket B — image_uploads: 8 cases (atomic transition, re-fire on terminal_state, re-fire on terminal_at, partial state-alone, partial at-alone, non-whitelisted (r2_object_key), no-op pre-transition, DELETE). FK chain: users only. |
| `tests/db/triggers/system-state-append-only.spec.ts` | **CREATE** | Bucket B — system_state: 6 cases via UPDATE-ONLY pattern (singleton seeded; cannot INSERT). afterEach UPDATE-resets `frozen_at = NULL`. Non-whitelisted column: `created_at`. |
| `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts` | **CREATE** | INV-4 canonical: 3 cases — resolution_events UPDATE rejected; payout_events UPDATE rejected; `ON CONFLICT (event_id, created_at) DO NOTHING` storage-idempotency replay safety (raw `sql\`...\`` since Drizzle composite-PK alignment is PRECURSOR.5). |
| `package.json` | **EDIT** | Add `"vite-tsconfig-paths": "^5.0.0"` to `devDependencies` (target version range is the current 5.x stable; lockfile pins exact). |
| `pnpm-lock.yaml` | **EDIT** | Refreshed by `pnpm install`. Should diff to vite-tsconfig-paths + transitive deps only. |

**Out of touch (verify these are NOT modified in PR diff):**
`src/db/schema/*`, `drizzle/migrations/*`, `docs/specs/SPEC.*`, `docs/adr/*`, `CLAUDE.md`, `AGENTS.md`, `biome.json`, `tsconfig.json`, `justfile`, `mise.toml`, `next.config.ts`, `drizzle.config.ts`, `src/db/index.ts`, `src/**`.

---

## CAT 2 — Per-test rollback / cleanup strategy

**DECIDED: Truncate-after-each (strategy C2).** Per-test isolation via `afterEach` truncation, not per-test BEGIN/ROLLBACK transactions.

**Rationale.** Wrapping each test in a transaction would prevent the Bucket A append-only trigger from being meaningfully exercised on rollback paths (the rollback would unwind the same transaction the trigger fired in, which is fine, but it makes the test reads racy with the rollback). Truncate-after-each is also the AGENTS.md §9 default for integration tests. Forks pool (CAT 5) ensures one DB connection per test file — no shared state across files.

**Per-Bucket-A and per-table-Bucket-B truncation list.** Each test file's `afterEach` issues `TRUNCATE <list> CASCADE` where `<list>` is the union of the protected table plus any FK ancestors inserted by the test. Example:

- `bets-append-only.spec.ts` truncates `bets`, `comments`, `markets`, `users`
- `payout-events-append-only.spec.ts` truncates `payout_events`, `resolution_events`, `bets`, `comments`, `markets`, `users`
- `events-append-only.spec.ts` truncates `events` only (CASCADE to partitions is automatic since they're inherited)
- `identity-pool-append-only.spec.ts` truncates `identity_pool` only

Truncate is fast (~5ms per table on empty test DB) and CASCADE handles partition children.

**system_state carve-out** (document in `system-state-append-only.spec.ts` top comment):

```
// system_state is a singleton: the seed row ('system', NULL) ships in
// 0004_seed_system_state.sql. The Bucket-B trigger forbids DELETE, and
// the row's PK 'system' is occupied — INSERT would PK-conflict.
//
// Test pattern: UPDATE the singleton row directly. afterEach issues
// UPDATE system_state SET frozen_at = NULL WHERE id = 'system' to
// reset state between tests. Truncate is unavailable (DELETE forbidden).
```

The afterEach reset itself is a no-op transition for already-NULL rows (3-rule: no-op accepted) and a one-shot-on-NULL-already-set for post-freeze rows. Both paths are trigger-permitted. The reset uses raw `sql\`UPDATE ... SET frozen_at = NULL\`` to avoid any Drizzle-builder semantics around partial updates.

**Bucket A truncate also reaches partitions for `events`.** `TRUNCATE events CASCADE` propagates to all 13 inherited partitions automatically per Postgres partitioning semantics. No special-case handling.

**One DB, one schema, no schemas-per-test.** The local Supabase Postgres (port 54322) is the single test substrate. No per-test schema cloning. The forks pool isolates file-level state via separate processes; truncate isolates test-level state within a file.

**No `.only` / no `.skip`.** Pre-PR self-audit grep verifies (CAT 7).

---

## CAT 3 — Fixture helper shape

`tests/db/_fixtures/db.ts`:

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

// Tests bypass src/db/index.ts because it carries `import "server-only"`,
// which throws when evaluated in the Vitest/Node runtime (Vitest is not the
// Next.js server). Per SPEC.2 §6.6: "Test fixtures bypass any
// application-layer protection (going straight to the Drizzle client) so
// the trigger is the only enforcement under test."

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL not set; tests cannot connect. Run `supabase start` and source .env.local."
  );
}

// max: 1 ensures all queries in a file share one connection — keeps
// TRUNCATE in afterEach atomic w.r.t. subsequent reads in the next test.
export const testClient = postgres(connectionString, { max: 1 });
export const testDb = drizzle(testClient, { schema });
export type TestDb = typeof testDb;

/**
 * Extracts the first 48 bits of a UUIDv7's hex representation as
 * big-endian unix-ms and returns a Date. Used by the events replay-safety
 * test (and by ENGINE.6's insertEvent helper, when that lands) to supply
 * `created_at` deterministically from the same UUIDv7 across retries — so
 * the composite PK `(event_id, created_at)` reuses the same pair and
 * `ON CONFLICT DO NOTHING` is exactly-once.
 *
 * Per SPEC.2 §7.3 + RFC 9562 §5.7 (UUIDv7 layout: bits 0-47 = unix_ts_ms).
 */
export function createdAtFromUuidV7(id: string): Date {
  const hex = id.replace(/-/g, "").slice(0, 12);
  const ms = Number.parseInt(hex, 16);
  return new Date(ms);
}
```

**Two exports only**: `testDb` and `createdAtFromUuidV7`. Plus `testClient` for the rare case where raw `sql\`...\`` is needed. Plus `TestDb` type alias.

**No shared fixture builders, no seed-factories, no abstract row helpers.** Per AGENTS.md §9 "Fixtures … Don't invent new fixture machinery unless the plan explicitly calls for it." Each test file does its own INSERTs in the test body. Repetition of "insert user, insert market, insert comments" across 5–6 files is acceptable cost vs. a leaky abstraction.

The path alias `@/db/schema` is resolved at test time by `vite-tsconfig-paths` (CAT 5). Without that plugin, the import fails.

---

## CAT 4 — Per-file case enumeration

Each test file follows the pattern:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { testDb, testClient } from "../_fixtures/db";
import { <tables> } from "@/db/schema";

describe("<table> — append-only trigger", () => {
  afterEach(async () => {
    await testClient.unsafe(`TRUNCATE <list> CASCADE`);
  });

  it("<case description>", async () => {
    // Arrange — INSERT parent rows + the row under test
    // Act — UPDATE/DELETE/no-op
    // Assert — toMatchObject({ code: 'P0001' }) for trigger rejections,
    //          or row state for accept cases
  });
});
```

### 4.1 `tests/db/triggers/events-append-only.spec.ts` (Bucket A, 2 cases)

**FK chain:** none.
**Fixture columns:** event_id (`uuidv7()` via `sql\`uuidv7()\``), event_type='test.event', aggregate_type='market', aggregate_id (any uuid), payload={}, payload_version=1, metadata={}, created_at='2026-06-15T12:00:00Z' (mid `events_2026_06` partition).
**Truncate list:** `events`.
**Bucket A note:** the `events` parent has `BEFORE UPDATE`/`BEFORE DELETE` triggers; Postgres 11+ propagates row-level triggers to all partitions automatically. Tests fire against the parent table; the partition routing happens after the trigger fires.

| # | `it()` name | Action | Expect |
|---|---|---|---|
| 1 | `rejects UPDATE with P0001 (append-only violation)` | UPDATE events SET payload='{}'::jsonb WHERE event_id=<id> | rejects → `{ code: 'P0001' }`, message contains "UPDATE not permitted" |
| 2 | `rejects DELETE with P0001 (append-only violation)` | DELETE FROM events WHERE event_id=<id> | rejects → `{ code: 'P0001' }`, message contains "DELETE not permitted" |

**Note:** Drizzle 0.45's `db.update(events).set(...)` knows about `event_id` as a single-column PK. The trigger raises on attempted UPDATE regardless — Drizzle's WHERE clause shape is irrelevant. Test uses Drizzle update for case 1; raw `sql\`DELETE FROM events WHERE event_id = ${id}\`` for case 2 (Drizzle delete has no events-specific quirks but consistent raw-SQL via testClient.unsafe is also fine).

### 4.2 `tests/db/triggers/dharma-ledger-append-only.spec.ts` (Bucket A, 2 cases)

**FK chain:** users → dharma_ledger. Insert one user (any valid row), then one dharma_ledger row with valid entry_type, amount, balance_after.
**Truncate list:** `dharma_ledger, users`.

| # | `it()` name | Action | Expect |
|---|---|---|---|
| 1 | `rejects UPDATE with P0001` | UPDATE dharma_ledger SET amount=999 WHERE id=<id> | P0001, "UPDATE not permitted" |
| 2 | `rejects DELETE with P0001` | DELETE FROM dharma_ledger WHERE id=<id> | P0001, "DELETE not permitted" |

**Note:** the table also has CHECK (balance_after >= 0) but this stratum does NOT test CHECK constraints — those are AGENTS.md §6 not §6 append-only contract. Fixture inserts must use balance_after >= 0 to avoid tripping CHECK on insert.

### 4.3 `tests/db/triggers/bets-append-only.spec.ts` (Bucket A, 2 cases)

**FK chain:** users → markets → comments (with bet_id=NULL) → bets. The bets/comments cycle is broken by inserting comments first without bet_id (nullable), then bets with comment_id pointing to comments.id.
**Required column defaults:** stake/share_quantity/price_at_bet — any positive numeric. side: 'YES'. comment_id: from the inserted comment.
**Truncate list:** `bets, comments, markets, users` (CASCADE handles ordering).

| # | `it()` name | Action | Expect |
|---|---|---|---|
| 1 | `rejects UPDATE with P0001` | UPDATE bets SET stake=999 WHERE id=<id> | P0001, "UPDATE not permitted" |
| 2 | `rejects DELETE with P0001` | DELETE FROM bets WHERE id=<id> | P0001, "DELETE not permitted" |

### 4.4 `tests/db/triggers/comments-append-only.spec.ts` (Bucket A, 2 cases)

**FK chain:** users → markets → comments (bet_id=NULL).
**Required column defaults:** side_at_post_time='YES', stake_at_post_time='1', body='test'.
**Truncate list:** `comments, markets, users`.

| # | `it()` name | Action | Expect |
|---|---|---|---|
| 1 | `rejects UPDATE with P0001` | UPDATE comments SET body='changed' WHERE id=<id> | P0001, "UPDATE not permitted" |
| 2 | `rejects DELETE with P0001` | DELETE FROM comments WHERE id=<id> | P0001, "DELETE not permitted" |

**Note for the @test-writer:** case 1 is the literal INV-3 mechanism — `comments` is Bucket A and `side_at_post_time` cannot mutate post-insert because the entire row cannot. The case verifies the storage-layer mechanism of INV-3.

### 4.5 `tests/db/triggers/resolution-events-append-only.spec.ts` (Bucket A, 2 cases)

**FK chain:** markets → resolution_events.
**Required column defaults:** event_kind='resolve', outcome='YES'.
**Truncate list:** `resolution_events, markets`.

| # | `it()` name | Action | Expect |
|---|---|---|---|
| 1 | `rejects UPDATE with P0001` | UPDATE resolution_events SET reason='changed' WHERE id=<id> | P0001 |
| 2 | `rejects DELETE with P0001` | DELETE FROM resolution_events WHERE id=<id> | P0001 |

**Note:** the canonical INV-4 mechanism (ii) is verified at this surface; also re-verified in the I-APPEND-ONLY-001 canonical at higher granularity.

### 4.6 `tests/db/triggers/payout-events-append-only.spec.ts` (Bucket A, 2 cases)

**FK chain:** users → markets → comments → bets → resolution_events → payout_events. Six-table chain.
**Required column defaults:** payout_type='bet_payout', amount='1'.
**Truncate list:** `payout_events, bets, comments, resolution_events, markets, users` (order doesn't matter under CASCADE).

| # | `it()` name | Action | Expect |
|---|---|---|---|
| 1 | `rejects UPDATE with P0001` | UPDATE payout_events SET amount=999 WHERE id=<id> | P0001 |
| 2 | `rejects DELETE with P0001` | DELETE FROM payout_events WHERE id=<id> | P0001 |

### 4.7 `tests/db/triggers/mod-actions-append-only.spec.ts` (Bucket A, 2 cases)

**FK chain:** none. target_user_id / target_comment_id / target_bet_id are all nullable; actor_id is `text` set to 'admin-singleton' or 'system'. categories is `jsonb` set to `{}`.
**Truncate list:** `mod_actions`.

| # | `it()` name | Action | Expect |
|---|---|---|---|
| 1 | `rejects UPDATE with P0001` | UPDATE mod_actions SET verdict='track_a' WHERE id=<id> | P0001 |
| 2 | `rejects DELETE with P0001` | DELETE FROM mod_actions WHERE id=<id> | P0001 |

### 4.8 `tests/db/triggers/admin-events-append-only.spec.ts` (Bucket A, 2 cases)

**FK chain:** none.
**Required column defaults:** event_type='admin.test', payload={}, metadata={}.
**Truncate list:** `admin_events`.

| # | `it()` name | Action | Expect |
|---|---|---|---|
| 1 | `rejects UPDATE with P0001` | UPDATE admin_events SET event_type='changed' WHERE id=<id> | P0001 |
| 2 | `rejects DELETE with P0001` | DELETE FROM admin_events WHERE id=<id> | P0001 |

### 4.9 `tests/db/triggers/user-events-append-only.spec.ts` (Bucket A, 2 cases)

**FK chain:** users → user_events.
**Required column defaults:** event_type='user.test', payload={}, metadata={}.
**Truncate list:** `user_events, users`.

| # | `it()` name | Action | Expect |
|---|---|---|---|
| 1 | `rejects UPDATE with P0001` | UPDATE user_events SET event_type='changed' WHERE id=<id> | P0001 |
| 2 | `rejects DELETE with P0001` | DELETE FROM user_events WHERE id=<id> | P0001 |

---

### 4.10 `tests/db/triggers/friendly-fire-events-append-only.spec.ts` (Bucket B, 10 cases)

**FK chain:** users (voter_id) → markets → comments (bet_id=NULL) → friendly_fire_events.
**Whitelisted columns:** frozen_at, cleared_at (independent, NULL → timestamp once each).
**Non-whitelisted columns chosen for mutation:** `direction` (enum; mutate 'up' → 'down').
**Truncate list:** `friendly_fire_events, comments, markets, users`.

| # | `it()` name | Action | Expect | Notes |
|---|---|---|---|---|
| 1 | `accepts frozen_at NULL→timestamp transition alone (cleared_at unchanged)` | UPDATE ff SET frozen_at='2026-06-15T12:00:00Z' WHERE id=<id> | succeeds; SELECT row, frozen_at matches | row inserted with frozen_at NULL, cleared_at NULL, direction='up' |
| 2 | `accepts cleared_at NULL→timestamp transition alone (frozen_at unchanged)` | UPDATE ff SET cleared_at='2026-06-15T12:00:00Z' WHERE id=<id> | succeeds | same fresh row insert |
| 3 | `rejects frozen_at + cleared_at transitioning in same UPDATE` | UPDATE ff SET frozen_at='2026-06-15', cleared_at='2026-06-15' WHERE id=<id> | P0001, "cannot both transition" | the function's first IF branch |
| 4 | `rejects re-firing frozen_at once set (one-shot)` | Set frozen_at first; then UPDATE SET frozen_at='2026-07-01' | P0001, "frozen_at is one-shot" | DISTINCT FROM rule fires |
| 5 | `rejects re-firing cleared_at once set (one-shot)` | Set cleared_at first; then UPDATE SET cleared_at='2026-07-01' | P0001, "cleared_at is one-shot" | DISTINCT FROM rule |
| 6 | `rejects non-whitelisted column update (direction up→down)` | UPDATE ff SET direction='down' WHERE id=<id> | P0001, "only frozen_at or cleared_at may transition" | tests the column enumeration branch |
| 7 | `accepts no-op UPDATE on pre-transition row (both frozen_at AND cleared_at NULL)` | UPDATE ff SET frozen_at=NULL, cleared_at=NULL WHERE id=<id> | succeeds (both columns NULL→NULL are DISTINCT-FROM-false) | verifies the 3-rule (no-op accept) **for this specific function** — each Bucket B trigger function is its own implementation, so pre-transition no-op coverage in identity_pool / image_uploads / system_state does NOT verify `enforce_friendly_fire_events_transitions` |
| 8 | `accepts no-op UPDATE after frozen_at set (3-rule: enforces non-mutation, not action)` | Set frozen_at first; then UPDATE SET frozen_at=<same timestamp> WHERE id=<id> | succeeds (no rows changed semantically, but Postgres still issues an UPDATE and trigger evaluates) | DISTINCT FROM returns false on equal values |
| 9 | `accepts no-op UPDATE after cleared_at set` | Set cleared_at first; then UPDATE SET cleared_at=<same> | succeeds | symmetric to case 8 |
| 10 | `rejects DELETE with P0001 (Bucket B uses shared no-delete function)` | DELETE FROM ff WHERE id=<id> | P0001, "DELETE not permitted" | Bucket B trigger calls `enforce_bucket_a_no_delete()` per 0003 line 192 |

### 4.11 `tests/db/triggers/identity-pool-append-only.spec.ts` (Bucket B, 6 cases)

**FK chain:** none.
**Whitelisted column:** assigned_at (NULL → timestamp once).
**Non-whitelisted column chosen for mutation:** `pseudonym` (text; clearly user-visible value).
**Truncate list:** `identity_pool`.
**Fixture row defaults:** colour='blue', animal='fox', number=42, pseudonym='blue-fox-42', pfp_filename='blue-fox-42.png', assigned_at=NULL.

| # | `it()` name | Action | Expect |
|---|---|---|---|
| 1 | `accepts assigned_at NULL→timestamp` | UPDATE identity_pool SET assigned_at='2026-06-15' WHERE id=<id> | succeeds |
| 2 | `rejects re-firing assigned_at once set` | Set assigned_at; then UPDATE assigned_at to a different timestamp | P0001, "assigned_at is one-shot" |
| 3 | `rejects non-whitelisted column update (pseudonym)` | UPDATE identity_pool SET pseudonym='changed' WHERE id=<id> | P0001, "only assigned_at may transition" |
| 4 | `accepts no-op UPDATE on pre-transition (assigned_at NULL) row` | UPDATE identity_pool SET assigned_at=NULL WHERE id=<id> | succeeds (NULL → NULL is DISTINCT-FROM-false) |
| 5 | `accepts no-op UPDATE on post-transition (assigned_at non-NULL) row` | Set assigned_at; then UPDATE SET assigned_at=<same> | succeeds |
| 6 | `rejects DELETE with P0001` | DELETE FROM identity_pool WHERE id=<id> | P0001 |

### 4.12 `tests/db/triggers/image-uploads-append-only.spec.ts` (Bucket B, 8 cases)

**FK chain:** users → image_uploads.
**Whitelisted columns:** terminal_state AND terminal_at (must transition together, two-column atomic).
**Non-whitelisted column chosen for mutation:** `r2_object_key` (text; semantically the load-bearing pointer).
**Truncate list:** `image_uploads, users`.
**Fixture row defaults:** user_id=<inserted user>, r2_object_key='uploads/test.jpg', terminal_state=NULL, terminal_at=NULL.

| # | `it()` name | Action | Expect |
|---|---|---|---|
| 1 | `accepts terminal_state + terminal_at NULL→set together (atomic transition)` | UPDATE image_uploads SET terminal_state='committed', terminal_at='2026-06-15' WHERE id=<id> | succeeds |
| 2 | `rejects re-firing terminal_state (one-shot)` | Set both; then UPDATE SET terminal_state='blocked' | P0001, "terminal_state is one-shot" |
| 3 | `rejects re-firing terminal_at (one-shot)` | Set both; then UPDATE SET terminal_at='2026-07-01' | P0001, "terminal_at is one-shot" |
| 4 | `rejects partial transition: terminal_state set, terminal_at NULL` | UPDATE SET terminal_state='committed' (terminal_at stays NULL) | P0001, "must transition together" |
| 5 | `rejects partial transition: terminal_at set, terminal_state NULL` | UPDATE SET terminal_at='2026-06-15' (terminal_state stays NULL) | P0001, "must transition together" |
| 6 | `rejects non-whitelisted column update (r2_object_key)` | UPDATE SET r2_object_key='changed' | P0001, "only terminal_state + terminal_at may transition together" |
| 7 | `accepts no-op UPDATE on pre-transition row (both NULL)` | UPDATE image_uploads SET terminal_state=NULL, terminal_at=NULL WHERE id=<id> | succeeds |
| 8 | `rejects DELETE with P0001` | DELETE FROM image_uploads WHERE id=<id> | P0001 |

### 4.13 `tests/db/triggers/system-state-append-only.spec.ts` (Bucket B, 6 cases — UPDATE-only, singleton)

**FK chain:** none.
**Whitelisted column:** frozen_at (NULL → timestamp once).
**Non-whitelisted column chosen for mutation:** `created_at` (timestamp).

**SINGLETON CARVE-OUT.** The seed row `('system', NULL, <seeded_at>)` ships in `0004_seed_system_state.sql` with `ON CONFLICT (id) DO NOTHING`. Tests cannot INSERT a second row (PK conflict on `id='system'`). Tests cannot DELETE (Bucket-B trigger forbids). Truncate is unavailable (cannot truncate a singleton that's referenced by ground-truth semantics). UPDATE-reset via `UPDATE system_state SET frozen_at = NULL WHERE id='system'` is **trigger-illegal** after a test sets `frozen_at` non-NULL — the function fires on `OLD.frozen_at IS NOT NULL AND NEW.frozen_at IS DISTINCT FROM OLD.frozen_at`, which catches non-NULL → NULL with `RAISE EXCEPTION 'system_state: frozen_at is one-shot ...'`.

**RESOLUTION (per Q2 sign-off): per-test transaction rollback wrap.** Every test in this file runs inside `testClient.begin(async (tx) => { ... })` and unwinds by throwing a `RollbackSignal` sentinel which the `inRolledBackTx` helper catches silently. The mutation never commits; the singleton row reverts to its seeded `(frozen_at=NULL)` state for the next test by virtue of the rollback.

#### 4.13.1 Required scaffolding at the top of `system-state-append-only.spec.ts`

(File-specific carve-out; NOT in the shared fixture. The other twelve trigger spec files use `afterEach TRUNCATE` and never need this machinery.)

```typescript
import { describe, expect, it } from "vitest";
import type postgres from "postgres";
import { testClient } from "../_fixtures/db";

// system_state is the singleton Bucket-B table. The truncate-after-each
// strategy used by every other 4.x file is unavailable: PK collision
// blocks re-INSERT, the Bucket-B trigger blocks DELETE, and the trigger's
// DISTINCT-FROM guard blocks UPDATE-reset of frozen_at to NULL after it's
// been set. Per-test transaction rollback is the file-specific carve-out.

class RollbackSignal extends Error {
  constructor() {
    super("ROLLBACK_SIGNAL_PER_TEST_ISOLATION");
    this.name = "RollbackSignal";
  }
}

// Run a test body inside testClient.begin() and catch the RollbackSignal
// to unwind the transaction without surfacing the rollback as a test
// failure. Re-throws ANY other error (e.g., a P0001 from the trigger) so
// expect().rejects.toMatchObject(...) catches it at the call site.
async function inRolledBackTx(
  body: (tx: postgres.TransactionSql) => Promise<void>,
): Promise<void> {
  try {
    await testClient.begin(async (tx) => {
      await body(tx);
      throw new RollbackSignal();
    });
  } catch (e) {
    if (e instanceof RollbackSignal) return;
    throw e;
  }
}
```

#### 4.13.2 Hard rule: every mutation goes through `tx`, never `testDb`

`testDb` (and the underlying `testClient` at the file scope) runs on a SEPARATE postgres-js connection. Any statement issued through `testDb` is OUTSIDE the `testClient.begin(...)` transaction and would commit unconditionally — breaking test isolation and leaving `frozen_at` set permanently for downstream tests in the same `vitest` run.

**Rule.** Inside any `it()` body in this file: every `UPDATE`, `DELETE`, `INSERT`, and assertion-`SELECT` MUST be issued via `tx` (the `postgres.TransactionSql` arg passed by `testClient.begin`). The `testDb` symbol does not appear inside any `it()` body in this file. The pre-PR self-audit (CAT 7 step 13) greps for `testDb` in this file and expects zero matches inside `it()` blocks. The import line may still import the `testClient` re-export for `inRolledBackTx` to call `testClient.begin`, but no test body uses `testClient` or `testDb` directly.

#### 4.13.3 Per-case pattern

**Accept cases** (1, 4, 5): inside `inRolledBackTx(async (tx) => { ... })`, issue the UPDATE via `tx`, then assert post-state via `tx\`SELECT ...\``. `inRolledBackTx` throws RollbackSignal internally at end; mutations roll back.

```typescript
it("accepts <transition>", async () => {
  await inRolledBackTx(async (tx) => {
    await tx`UPDATE system_state SET frozen_at = '2026-11-05T23:59:00Z' WHERE id = 'system'`;
    const rows = await tx<{ frozen_at: Date | null }[]>`SELECT frozen_at FROM system_state WHERE id = 'system'`;
    expect(rows[0]?.frozen_at).toEqual(new Date('2026-11-05T23:59:00Z'));
  });
});
```

**Reject cases** (2, 3, 6): wrap the entire `inRolledBackTx(...)` call in `expect(...).rejects.toMatchObject({ code: 'P0001' })`. The trigger fires on the violating `tx`-issued statement, the begin block's transaction aborts, the rejection propagates out. `inRolledBackTx` only catches `RollbackSignal`; the P0001 escapes.

```typescript
it("rejects <violation>", async () => {
  await expect(
    inRolledBackTx(async (tx) => {
      await tx`UPDATE system_state SET created_at = '2099-01-01' WHERE id = 'system'`;
    }),
  ).rejects.toMatchObject({ code: 'P0001', message: expect.stringContaining('only frozen_at may transition') });
});
```

#### 4.13.4 Truncate list

**None.** Per-test rollback handles cleanup; no `afterEach` block is needed (and adding one would be a footgun — `testDb` outside `tx` would never see the test's pending writes, and `tx` is not in scope outside the `it()` body).

#### 4.13.5 Case table

All actions below use `tx` (the `postgres.TransactionSql` from `testClient.begin`). No case uses `testDb` directly.

| # | `it()` name | Action (all via `tx`) | Expect |
|---|---|---|---|
| 1 | `accepts frozen_at NULL→timestamp (conclusion freeze)` | `tx\`UPDATE system_state SET frozen_at = '2026-11-05T23:59:00Z' WHERE id = 'system'\``; then `tx\`SELECT frozen_at FROM system_state WHERE id = 'system'\`` to assert | succeeds; selected `frozen_at` equals the set timestamp |
| 2 | `rejects re-firing frozen_at once set` | Inside one `inRolledBackTx`: first `tx\`UPDATE ... frozen_at = '2026-11-05T23:59:00Z' ...\`` succeeds, then `tx\`UPDATE ... frozen_at = '2026-12-01T00:00:00Z' ...\`` raises | the whole `inRolledBackTx` rejects with `{ code: 'P0001', message: stringContaining('frozen_at is one-shot') }` |
| 3 | `rejects non-whitelisted column update (created_at)` | `tx\`UPDATE system_state SET created_at = '2099-01-01' WHERE id = 'system'\`` | rejects `{ code: 'P0001', message: stringContaining('only frozen_at may transition') }` |
| 4 | `accepts no-op UPDATE on pre-freeze row (frozen_at NULL → NULL)` | `tx\`UPDATE system_state SET frozen_at = NULL WHERE id = 'system'\`` (seed has frozen_at=NULL; NULL→NULL is DISTINCT-FROM-false on the OLD-NOT-NULL guard) | succeeds; selected `frozen_at` remains NULL |
| 5 | `accepts no-op UPDATE on post-freeze row (frozen_at same → same)` | Inside one `inRolledBackTx`: first `tx\`UPDATE ... frozen_at = '2026-11-05T23:59:00Z' ...\`` succeeds, then `tx\`UPDATE ... frozen_at = '2026-11-05T23:59:00Z' ...\`` again (same value) succeeds | both UPDATEs succeed; selected `frozen_at` equals the timestamp |
| 6 | `rejects DELETE with P0001` | `tx\`DELETE FROM system_state WHERE id = 'system'\`` | rejects `{ code: 'P0001', message: stringContaining('DELETE not permitted') }` |

---

### 4.14 `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts` (INV-4 canonical, 3 cases)

**Purpose.** Per SPEC.2 §14.1's INV-4 row + §14.2 two-test-layer split, this file is the **canonical integration test** for INV-4 mechanism (ii) (Bucket-A append-only enforcement on `resolution_events` + `payout_events`) and the §7.3 storage-idempotency primitive. The §14.1 row also lists mechanisms (i) W-3 SERIALIZABLE wrapper, (iii) markets.status whitelisted Bucket-C transition, and (iv) admin auth construction — these require ENGINE.9 + SCAFFOLD.3 and are NOT in scope for 3.D. The file is `001` of the I-APPEND-ONLY-NNN series; subsequent integration tests will increment as HARDEN.* surfaces edge cases.

**Why this file lives at `tests/invariants/`, not `tests/db/triggers/`.** SPEC.2 §14.1 names this exact path as the canonical integration test for INV-4. The trigger-level coverage at `tests/db/triggers/resolution-events-append-only.spec.ts` + `payout-events-append-only.spec.ts` is the unit-test layer; this file is the integration-test layer that locks INV-4 at a higher granularity.

**FK chain for cases 1 and 2:** users → markets → comments → bets → resolution_events → payout_events.
**FK chain for case 3:** none (events has no FKs).
**Truncate list:** `events, payout_events, resolution_events, bets, comments, markets, users`.

| # | `it()` name | Action | Expect |
|---|---|---|---|
| 1 | `INV-4 mechanism (ii): resolution_events UPDATE rejected at storage layer` | INSERT resolution_event then UPDATE reason | P0001, "UPDATE not permitted" |
| 2 | `INV-4 mechanism (ii): payout_events UPDATE rejected at storage layer` | INSERT full chain through payout_event then UPDATE amount | P0001, "UPDATE not permitted" |
| 3 | `SPEC.2 §7.3 storage idempotency: ON CONFLICT (event_id, created_at) DO NOTHING is exactly-once on retry` | INSERT events row with deterministic (eventId, createdAt) via `createdAtFromUuidV7(eventId)`; INSERT again with same (eventId, createdAt) and ON CONFLICT (event_id, created_at) DO NOTHING; assert second INSERT affects 0 rows; SELECT count(*) WHERE event_id=eventId equals 1 | passes |

**Case 3 implementation note for @test-writer:**

```typescript
// Drizzle's events schema at src/db/schema/events.ts declares the PK as
// single-column event_id (composite alignment is PRECURSOR.5 backlog per
// 3.C log §4 row 4). The storage-layer PK IS composite (event_id, created_at)
// per 0002_events_partitioning.sql line 29. Drizzle's onConflictDoNothing()
// would target event_id alone, which is wrong. Use raw sql`...` template:
const eventId = crypto.randomUUID(); // OR use uuidv7 from `uuid` package
const createdAt = createdAtFromUuidV7(eventId);  // deterministic ms from prefix
// ...
const insert1 = await testClient.unsafe(
  `INSERT INTO events (event_id, event_type, aggregate_type, aggregate_id,
                       payload, payload_version, metadata, created_at)
   VALUES ($1, 'test.replay', 'market', $2, '{}'::jsonb, 1, '{}'::jsonb, $3)
   ON CONFLICT (event_id, created_at) DO NOTHING
   RETURNING event_id`,
  [eventId, crypto.randomUUID(), createdAt.toISOString()]
);
// insert1.count === 1
const insert2 = await testClient.unsafe(
  `INSERT INTO events (...) VALUES ($1, ..., $3) ON CONFLICT (event_id, created_at) DO NOTHING RETURNING event_id`,
  [eventId, ..., createdAt.toISOString()]
);
// insert2.count === 0   (the no-op)
// SELECT count(*) FROM events WHERE event_id = eventId   → 1
```

The exact uuid generator is the npm `uuid` package's `v7()` per ADR-0016 + AGENTS.md §6 (already in deps); `crypto.randomUUID()` is v4 and would produce a non-time-prefixed value that `createdAtFromUuidV7` would misinterpret. Use `uuidv7` from `uuid`.

**This case does NOT test the Drizzle path** — it tests the raw SQL contract because the storage layer is the truth and the Drizzle layer needs PRECURSOR.5 catch-up.

---

## CAT 5 — Vitest configuration

`vitest.config.ts` (repo root, NEW):

```typescript
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Per SPEC.2 §6.6 + AGENTS.md §9. Minimal config — no coverage (HARDEN.*
// owns coverage thresholds), no globals (explicit imports per AGENTS.md §4),
// forks pool for process-isolation between test files (matches integration-
// test orthodoxy; one DB connection per file under the testClient { max: 1 }
// setting in tests/db/_fixtures/db.ts).

export default defineConfig({
  plugins: [tsconfigPaths()],   // resolves @/db/schema → ./src/db/schema
  test: {
    globals: false,
    testTimeout: 10_000,
    hookTimeout: 10_000,
    isolate: true,
    pool: "forks",
    coverage: {
      enabled: false,
    },
    include: ["tests/**/*.{test,spec}.ts"],
  },
});
```

**DECIDED items (locked; do not deviate without surfacing):**

- `vite-tsconfig-paths` plugin — resolves the `@/db/schema` import in `tests/db/_fixtures/db.ts`. Added as devDependency. Version `^5.0.0` (current stable).
- `pool: 'forks'` — process-isolation; safe with `testClient { max: 1 }` per file.
- `coverage.enabled: false` — HARDEN.* territory.
- `globals: false` — explicit `import { describe, it, expect, afterEach } from "vitest"` in every spec.
- `testTimeout: 10_000` — 10s; trigger tests are <100ms each, but DB connect can be slow on cold start.
- `include: ['tests/**/*.{test,spec}.ts']` — covers `tests/db/triggers/*.spec.ts` and `tests/invariants/*.spec.ts` and any future `tests/unit/**/*.test.ts`.

**Anti-decided (intentionally NOT enabled):**

- No `setupFiles` — fixture is imported per file, not globally.
- No `vitest.workspace.ts` — single-project setup; v3.x defaults are fine.
- No `environment: 'jsdom'` — Node default suits DB tests.
- No `silent: false` log redirection — Vitest default stderr → reporter.
- No reporter override — Vitest default reporter is fine; `--reporter=verbose` is a Phase-2 verification CLI flag, not a config setting.

---

## CAT 6 — Error-matching strategy

**DECIDED: SQLSTATE on `.code`.** Match `'P0001'` for all RAISE EXCEPTION trigger violations.

**Rationale.** Per AGENTS.md §6 "Postgres triggers" pattern (and verified by inspecting `node_modules/postgres/types/index.d.ts` — `PostgresError.code: string` is the typed surface). The trigger functions in `0003_append_only_triggers.sql` all use bare `RAISE EXCEPTION` without an explicit SQLSTATE clause, which Postgres maps to `'P0001'` (raise_exception). Matching on `.code` is stable across future message text edits; matching on message regex would break every time someone tweaks a RAISE message.

**Assertion shape:**

```typescript
await expect(
  testDb.update(events).set({ payload: {} }).where(...)
).rejects.toMatchObject({ code: "P0001" });
```

**Per-case message verification (loose).** For per-case message assertions (e.g., distinguishing "frozen_at is one-shot" from "cannot both transition" in friendly_fire_events), the test should ALSO `.toMatchObject({ message: expect.stringContaining("frozen_at is one-shot") })` — this catches a future trigger-function regression where the SQLSTATE-correct error fires for the wrong column. The message-contains check is a defense-in-depth assertion, not the primary contract.

**SQLSTATE reference table** (for plan completeness; @test-writer matches `'P0001'` on every trigger reject):

| SQLSTATE | Meaning | Where it arises in our suite |
|---|---|---|
| `'P0001'` | `raise_exception` (PL/pgSQL bare RAISE) | every Bucket A + Bucket B trigger rejection |
| `'23505'` | unique_violation | NOT IN TEST SUITE — would arise on duplicate seed inserts |
| `'23514'` | check_violation | NOT IN TEST SUITE — would arise on `dharma_ledger.balance_after < 0` |
| `'23503'` | foreign_key_violation | NOT IN TEST SUITE — would arise on missing FK parent |

**Drizzle propagation.** The Drizzle `postgres-js` driver passes the `PostgresError` instance through unchanged when a query fails. `rejects.toMatchObject({ code: 'P0001' })` works against the original `PostgresError`. No need to unwrap or cast.

---

## CAT 7 — Verification chain

Run in Phase 2 after @test-writer returns and before pre-PR self-audit. Each step must pass before continuing.

```bash
# 1. Type-check + lint + build — DB-free baseline (always-runnable)
just verify
# Expect: green. Catches any TypeScript shape error in vitest.config.ts,
# the fixture, or the test files.

# 2. Local Supabase running
supabase status
# Expect: API URL + DB URL present. If not, `supabase start`.

# 3. Reset DB to confirm migrations apply cleanly into the test scenario
just db-reset
# Expect: 5 migrations apply (uuidv7 function, initial schema, events
# partitioning, append-only triggers, system_state seed), zero errors.

# 4. Apply migrations (db-reset triggers this, but verify)
just db-migrate
# Expect: "No pending migrations" (already applied by db-reset)

# 5. Run the trigger suite
just test-db
# Expect: ~51 cases pass, 0 fail, 0 skip.

# 6. Count check — at least 33 (SPEC.2 §6.6 floor), targeting 51
pnpm vitest run tests/db/triggers/ tests/invariants/ --reporter=verbose | grep -cE "✓"
# Expect: ≥ 51

# 7. Specific count by bucket
pnpm vitest run tests/db/triggers/ --reporter=verbose | grep -cE "✓"
# Expect: 48 (18 Bucket A + 30 Bucket B)
pnpm vitest run tests/invariants/ --reporter=verbose | grep -cE "✓"
# Expect: 3

# 8. No skipped tests
pnpm vitest run tests/db/triggers/ tests/invariants/ --reporter=verbose | grep -E "↓|SKIPPED|skipped" || echo "no skips ✓"

# 9. No .only() left in
grep -rn "\.only(" tests/db/ tests/invariants/ || echo "no .only ✓"

# 10. No .skip() left in
grep -rn "\.skip(" tests/db/ tests/invariants/ || echo "no .skip ✓"

# 11. Verify the file count and naming
ls tests/db/triggers/*.spec.ts | wc -l
# Expect: 13
ls tests/invariants/I-APPEND-ONLY-001*.spec.ts | wc -l
# Expect: 1
ls tests/db/_fixtures/db.ts
# Expect: 1 file

# 12. Verify only the in-scope files changed
git diff --stat origin/main..HEAD -- src/ drizzle/migrations/ docs/specs/ docs/adr/ CLAUDE.md AGENTS.md
# Expect: empty diff (none of these are in 3.D scope)
git diff --stat origin/main..HEAD -- tests/ vitest.config.ts package.json pnpm-lock.yaml
# Expect: the 17 in-scope files

# 13. system_state spec hard-rule check — no testDb references inside any
#     it() body (the begin/tx pattern is mandatory; testDb writes would
#     commit outside the transaction and break per-test isolation per 4.13.2)
awk '/^[[:space:]]*it\(/{in_it=1} in_it && /testDb/{print FILENAME":"NR": "$0; found=1} /^[[:space:]]*\}\);[[:space:]]*$/{in_it=0} END{exit found?1:0}' tests/db/triggers/system-state-append-only.spec.ts && echo "no testDb inside it() ✓"
# (The file MAY still import testClient at the top — inRolledBackTx calls
#  testClient.begin to open the transaction. testDb itself should not appear
#  inside any it() body. A simpler conservative check: grep -E "^\s+.*testDb"
#  tests/db/triggers/system-state-append-only.spec.ts || echo "✓".)
```

If any of 1–13 fails, fix in-session, re-run from step 1. Do not open PR with a failing verification.

---

## CAT 8 — Commit + PR

### Commit message (single commit, no squash on push)

Plan-file commit (Phase 1 close):

```
docs(plans): scaffold-2 stratum d — phase 1 plan

Plan file for SCAFFOLD.2 stratum 3.D — trigger tests.

- 14 test files target ~51 cases (18 Bucket A + 30 Bucket B + 3 INV-4)
- SPEC.2 §6.6 floor: 33; target meets with margin
- Phase 2: invoke @test-writer per CLAUDE.md §5.11, pre-PR self-audit
  per §5.10, branch feat/scaffold-2-stratum-d

Refs: SCAFFOLD.2 master plan §3.D, SPEC.2 §6 + §7 + §14, CLAUDE.md §5.6 + §5.10 + §5.11
```

Phase 2 implementation commit (after @test-writer):

```
feat(scaffold-2): d — trigger tests (14 files, ~51 cases) + INV-4

- tests/db/_fixtures/db.ts (connection + createdAtFromUuidV7 helper)
- tests/db/triggers/*.spec.ts × 13 (Bucket A: 9 × 2 = 18 cases;
  Bucket B: friendly_fire 10 + identity_pool 6 + image_uploads 8 +
  system_state 6 = 30 cases)
- tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts
  (3 cases: resolution_events UPDATE reject, payout_events UPDATE reject,
   events composite-PK ON CONFLICT replay safety)
- vitest.config.ts at root with vite-tsconfig-paths plugin
- vite-tsconfig-paths added to devDependencies

Case totals: 18 + 30 + 3 = 51; SPEC.2 §6.6 floor 33 met with margin.

Per-test isolation via TRUNCATE … CASCADE in afterEach. system_state uses
per-test rollback wrap (RollbackSignal sentinel + inRolledBackTx helper;
all mutations via tx never testDb). Error matching on SQLSTATE 'P0001'
(stable across future trigger-message edits) + defense-in-depth
message-contains check.

Refs: SCAFFOLD.2, SPEC.2 §6 + §7.3 + §14.1, AGENTS.md §9, CLAUDE.md §5.6 + §5.10 + §5.11
```

### PR title

`feat(scaffold-2): d — trigger tests (14 files, ~51 cases) + INV-4`

### PR body (draft)

- **Summary.** Implements SCAFFOLD.2 stratum 3.D per `docs/plans/SCAFFOLD.2-3D.md`. 13 trigger test files + 1 INV-4 canonical + 1 fixture + 1 vitest config + 1 devDep add.
- **Case counts.** Bucket A 18 / Bucket B 30 / INV-4 3 / total 51 vs SPEC.2 §6.6 floor 33.
- **Decisions surfaced.** SQLSTATE-only matching ('P0001'); truncate-after-each except system_state (per-test rollback wrap via `RollbackSignal` + `inRolledBackTx` helper, all mutations via `tx` never `testDb`); raw `sql\`...\`` for ON CONFLICT in INV-4 case 3 because Drizzle composite-PK alignment is PRECURSOR.5 backlog.
- **Out of scope (unchanged).** `src/db/schema/*`, `drizzle/migrations/*`, ADRs, SPECs, CLAUDE.md, AGENTS.md.
- **Subagent invocation.** `@test-writer` invoked per CLAUDE.md §5.11 with plan path `@docs/plans/SCAFFOLD.2-3D.md`.
- **Pre-PR self-audit.** Per CLAUDE.md §5.10 — walked the per-file plan; all PASS.
- **Verification.** `just verify` green, `just test-db` green (50 cases).

### Session log (per CLAUDE.md §5.9)

After PR opens, write `docs/logs/SCAFFOLD.2-3D.md` in its own commit BEFORE walking away. Pattern follows `docs/logs/SCAFFOLD.2-3C.md`. Six fields: What landed / Decisions / Open questions / Next session starts at / Context to preserve / Time. Carry a "Drifts absorbed (in-PR)" and "Inherited drift (PRECURSOR.5 backlog)" section per 3-C log convention.

---

## Self-critique

Walk per the Step-4 self-critique checklist from the kickoff prompt.

**1. Does the plan deviate from CLAUDE.md §1's critical-path triggers?** No. 3.D is critical-path because the protected tables live under `src/db/schema/` (which it does NOT modify) and the triggers live under `drizzle/migrations/` (which it does NOT modify). All critical-path discipline triggers (plan / tests-this-stratum-IS-the-test-stratum / pre-PR self-audit / @test-writer subagent invocation) apply and are reflected in CAT 7 + CAT 8 + the workflow notes.

**2. Does any plan element silently absorb scope from outside §3.D?** No. Tempted absorptions and explicit rejections:

- The 3-C log §4 row 4 names "`src/db/schema/events.ts` declaration alignment to composite PK" as PRECURSOR.5 backlog. Tempting to fix while writing case 3 of the INV-4 canonical, but the fix is a schema edit and would extend the PR scope. Resolution: **use raw `sql\`...\``** in case 3 + document the inherited drift in the spec file's top comment.
- The `just db-migrate` env-source drift (3-C log §4) tempts a justfile edit. Resolution: **leave alone**; the workaround for Phase 2 verification is `export DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d= -f2)` before invoking. Note this in CAT 7 step 4 as a Phase-2 footnote when running `just db-migrate` if needed.
- The `supabase/` `.gitignore` drift tempts a `.gitignore` edit. Resolution: **leave alone**; PRECURSOR.5 backlog.
- The Drizzle `events.eventId` type-only declaration not aligned to composite PK could tempt `db.insert(events).values({ eventId, createdAt, ... }).onConflictDoNothing({ target: [events.eventId, events.createdAt] })` — Drizzle won't have a typed reference to "the composite PK" but `target: [events.eventId, events.createdAt]` might still compile. Resolution: **use raw `sql\`...\`` for the ON CONFLICT case** to make the contract explicit and not rely on Drizzle internals that may break on type evolution.
- Tempted to add `tests/unit/**/*.test.ts` placeholders for HARDEN.* coverage. Resolution: **NO** — empty tests rot and obscure. Add when business logic lands.

**3. Are all 13 protected tables covered? Enumerate.**

Bucket A (9): events ✓ (4.1) — dharma_ledger ✓ (4.2) — bets ✓ (4.3) — comments ✓ (4.4) — resolution_events ✓ (4.5) — payout_events ✓ (4.6) — mod_actions ✓ (4.7) — admin_events ✓ (4.8) — user_events ✓ (4.9).
Bucket B (4): friendly_fire_events ✓ (4.10) — identity_pool ✓ (4.11) — image_uploads ✓ (4.12) — system_state ✓ (4.13).
INV-4 canonical (1): I-APPEND-ONLY-001 ✓ (4.14). Total: **13 trigger files + 1 invariant file = 14**.

**4. Does the INV-4 canonical test verify all of §14.1's mechanisms for INV-4? Walk them.**

SPEC.2 §14.1 names **four** INV-4 mechanisms, not three. The kickoff prompt's "all three §14.1 mechanisms for INV-4" appears to be off-by-one. Walking the four:

- **(i) W-3 SERIALIZABLE transaction wrapper at `src/server/resolution/settle.ts`** — REQUIRES ENGINE.9. **Not in 3-D scope.** The 3-D canonical test cannot verify this; it can only verify what the storage layer enforces (mechanism ii).
- **(ii) Bucket-A append-only on `resolution_events` + `payout_events`** — VERIFIED in cases 1 + 2 of the canonical, AND in the unit-layer files at 4.5 + 4.6.
- **(iii) `markets.status` whitelisted Bucket-C transition during W-3** — REQUIRES ENGINE.9 (W-3 fan-out) AND there's no Bucket-C trigger on `markets` (Bucket C is unprotected per SPEC.2 §6.1 clause 3). The "whitelist" is application-layer, not trigger-layer. **Not in 3-D scope.**
- **(iv) Admin-side auth construction parallel to §8.3 session-deferral hook** — REQUIRES SCAFFOLD.3 (admin auth). **Not in 3-D scope.**

**Conclusion.** The 3-D canonical I-APPEND-ONLY-001 verifies mechanism (ii) at high granularity (the canonical layer, not the per-table layer) and adds case 3 for the §7.3 storage idempotency primitive that backs mechanism (ii)'s exactly-once semantics. Mechanisms (i), (iii), (iv) lock at ENGINE.9 + SCAFFOLD.3; the I-APPEND-ONLY-NNN file series will gain new entries (002, 003) at those stratums per §14.2's two-test-layer split. **The 3-D test as planned does NOT claim to verify all four mechanisms; it verifies the storage-layer foundation that mechanism (ii) is built on, which is the only mechanism testable at this stratum.** Surfacing this clarification to Hrishikesh in QUESTIONS below — the kickoff prompt's "all three" framing is worth flagging.

**5. Is the Bucket B universal 3-rule reflected in EVERY Bucket B test file's case list? Verify per file.**

- friendly_fire_events (4.10): cases 7+8+9 cover no-op accept (3-rule clause 1: case 7 pre-transition with both columns NULL, cases 8+9 post-transition for each whitelisted column independently — each Bucket B trigger function is its own implementation, so no-op coverage in identity_pool / image_uploads / system_state does NOT verify `enforce_friendly_fire_events_transitions`); cases 4+5 cover re-fire reject via DISTINCT FROM (3-rule clause 2); case 6 covers non-whitelisted column reject (3-rule clause 3). Case 3 covers the table-specific "both-together" reject. ✓
- identity_pool (4.11): cases 4+5 cover no-op accept; case 2 covers re-fire reject; case 3 covers non-whitelisted reject. ✓
- image_uploads (4.12): case 7 covers no-op accept (pre-transition); cases 2+3 cover re-fire reject; case 6 covers non-whitelisted reject. Cases 4+5 cover the table-specific partial-transition reject. ✓
- system_state (4.13): cases 4+5 cover no-op accept; case 2 covers re-fire reject; case 3 covers non-whitelisted reject. ✓

All four Bucket B files reflect the 3-rule uniformly. The table-specific additions (friendly_fire "both-together", image_uploads "partial-transition") sit on top of the 3-rule without contradicting it.

**6. Is the events composite-PK trap addressed in the events test file? Walk the fixture pattern.**

Yes. The trigger spec at 4.1 supplies `created_at = '2026-06-15T12:00:00Z'` explicitly via Drizzle's `db.insert(events).values({ eventId, ..., createdAt: new Date('2026-06-15T12:00:00Z') })`. The Drizzle schema is single-column-PK; the storage is composite-PK. INSERT with explicit `created_at` succeeds at both layers (Drizzle doesn't enforce the composite PK; storage routes to the correct partition based on `created_at`). The trigger fires on UPDATE/DELETE regardless of PK shape. The composite-PK trap only matters for the INV-4 canonical case 3 (ON CONFLICT) — addressed via raw `sql\`...\``. ✓

**7. Does the friendly_fire test cover both independent transitions AND the "both together rejected" case? Walk it.**

Cases 1 (frozen_at alone accept) + 2 (cleared_at alone accept) + 3 (both together reject) + 4 (re-fire frozen_at) + 5 (re-fire cleared_at) + 6 (non-whitelisted) + 7 (no-op pre-transition both NULL) + 8+9 (no-ops post each transition) + 10 (DELETE). 10 cases total. ✓

**8. Is the system_state singleton carve-out handled? Walk the afterEach strategy.**

The kickoff prompt's CAT 2 prescribed "afterEach UPDATE-reset" but the trigger forbids non-NULL → NULL transitions on frozen_at (the DISTINCT-FROM rule fires). I caught this during self-critique and revised the strategy to per-test transaction rollback via `testClient.begin(...)`. Documented in 4.13. This is a deliberate carve-out from the CAT 2 truncate-after-each default, scoped to the one singleton file. The carve-out is named in the spec file's top comment so a reader does not wonder why this file looks different.

**Surfacing to Hrishikesh in QUESTIONS:** the system_state afterEach reset strategy. The CAT 2 default was "UPDATE-reset" but the trigger contract makes that impossible. Hrishikesh may want to weigh: (a) per-test rollback wrap (my decision; clean but file-specific); (b) `ALTER TABLE system_state DISABLE TRIGGER ALL` in afterEach (rejected — BREAK_GLASS.md-grade); (c) drop and re-seed system_state per test (rejected — DELETE forbidden, would need DDL); (d) order tests so post-freeze cases run last and skip the reset (rejected — relies on test ordering, fragile). Decision (a) holds unless web Claude pushes back.

**9. Are FK chains enumerated per test file so Phase 2 doesn't discover them at write time?**

Yes, per-file FK chain enumerated in CAT 1 + at the top of every 4.x subsection. The five-or-more-deep chains (payout_events at 6 ancestors; INV-4 canonical case 2 at 6 ancestors) are flagged. @test-writer will not be discovering FK chains mid-write.

**10. Is there any case where the test would pass even if the trigger were silently broken? Walk each Bucket A test's UPDATE shape.**

Each Bucket A UPDATE specifies a real column with a real changed value:

- events: payload (jsonb)
- dharma_ledger: amount (numeric)
- bets: stake (numeric)
- comments: body (text)
- resolution_events: reason (text)
- payout_events: amount (numeric)
- mod_actions: verdict (enum)
- admin_events: event_type (text)
- user_events: event_type (text)

If the trigger were removed, the UPDATE would succeed and the test would fail to reject — caught by `rejects.toMatchObject`. If the trigger fired SQLSTATE 'P0002' instead of 'P0001', caught by the `.code === 'P0001'` assertion. If the trigger fired correctly but the test forgot the `.rejects`, the test would pass on a still-rejected UPDATE — but that's a test-author error and the message-contains defense-in-depth catches it. **No silent-pass failure modes.**

For Bucket B, each "reject" case specifies the exact column to mutate (direction for friendly_fire, pseudonym for identity_pool, r2_object_key for image_uploads, created_at for system_state) — all are real, non-PK, non-whitelisted columns. The trigger enumerates these in its IF clause; the test exercises one branch per case.

Self-critique passes. The plan is internally consistent and matches SPEC.2 + the 3-C log decisions.

---

## QUESTIONS FOR HRISHIKESH

Both surfaced as `AskUserQuestion` at end of Phase 1; both **RESOLVED** by Hrishikesh before plan file finalised. Captured here for the audit trail; web Claude reads these as already-decided.

### Q1. INV-4 canonical mechanism coverage — **RESOLVED**

The kickoff prompt's self-critique step 4 reads "all three §14.1 mechanisms for INV-4". SPEC.2 §14.1 lists **four** (i–iv). 3-D canonical at `I-APPEND-ONLY-001` verifies mechanism (ii) [Bucket-A append-only on `resolution_events` + `payout_events`] plus §7.3 storage idempotency primitive. Mechanisms (i) [W-3 SERIALIZABLE wrapper], (iii) [`markets.status` whitelisted Bucket-C transition], (iv) [admin auth construction] are ENGINE.9 + SCAFFOLD.3 territory.

**Resolution (Hrishikesh, Phase 1 close):** Read is correct. 3-D canonical covers (ii) + §7.3 only. Mechanisms (i)/(iii)/(iv) land as new entries in the `I-APPEND-ONLY-NNN` series at ENGINE.9 + SCAFFOLD.3 per SPEC.2 §14.2 two-test-layer split. The kickoff prompt's "all three" wording is the off-by-one; future kickoffs reference §14.1 directly.

### Q2. system_state afterEach strategy — **RESOLVED**

The kickoff CAT 2 prescribed "UPDATE-reset" for `system_state` afterEach. The Bucket-B trigger contract forbids non-NULL → NULL on `frozen_at` (the DISTINCT-FROM-and-OLD-not-NULL rule fires). The plan revised the strategy at 4.13.

**Resolution (Hrishikesh, Phase 1 close):** **Per-test transaction rollback wrap via `testClient.begin(async (tx) => { ...; rollback })`** holds. Documented as a file-specific carve-out from CAT 2's truncate-after-each default in the `system-state-append-only.spec.ts` top comment. Alternatives (test ordering; DISABLE TRIGGER ALL) rejected as fragile / BREAK_GLASS.md-grade respectively.

Phase 2 proceeds as planned with both decisions locked.

---

## Anti-pattern checklist (from SCAFFOLD.2 master plan Appendix)

If during Phase 2 the @test-writer or main session is tempted by any of the following, STOP and surface:

- ✗ Writing application logic outside `tests/` — only the test files + fixture + vitest config + package.json devDep edit are in scope. **`src/server/` does not exist yet; do not create it.**
- ✗ Importing from `src/server/` — N/A (doesn't exist), and the test files import from `@/db/schema` only (which does exist).
- ✗ Using `gen_random_uuid()` or `crypto.randomUUID()` for primary keys — fixture uses `sql\`uuidv7()\`` for in-DB defaults, or the npm `uuid` package's `v7()` for client-side generation (case 3 of INV-4 canonical).
- ✗ Writing a "send dharma" or user-to-user transfer function — N/A this stratum, but reinforces CLAUDE.md §3.
- ✗ Writing handler-layer pre-validation that duplicates the trigger logic — N/A (no handlers in 3-D).
- ✗ Adding a `users.role` column or `is_admin` boolean — N/A (no schema edits).
- ✗ **Skipping a Bucket B "no-op accept" case** because "the trigger obviously permits no-ops" — 3-rule clause 1 is the load-bearing premise of the uniform Bucket B contract per SCAFFOLD.2 3-C ratification; if a test file omits no-op-accept cases, the uniform 3-rule is unverified. Per-file enumeration in CAT 4 includes the no-op cases explicitly.
- ✗ Naming a test file `tests/db/triggers/<table>_append_only.spec.ts` (underscore-separator) instead of `<table>-append-only.spec.ts` — SPEC.2 §6.6 names the kebab-case convention.
- ✗ **Editing a committed migration** — `drizzle/migrations/*` is refusal-grade out-of-scope.
- ✗ **Editing `src/db/schema/*` to align the events PK** — refusal-grade out-of-scope (PRECURSOR.5 backlog).
- ✗ Adding `vitest` coverage config — HARDEN.* territory.
- ✗ Adding a Sentry / PostHog import — SCAFFOLD.5/6/7.
- ✗ Adding a CI workflow file — SCAFFOLD.18.
- ✗ Inventing a market question, resolution criterion, or any product copy — N/A this stratum.
- ✗ **Writing tests that PASS on day one and treating that as a smell.** The @test-writer's standard contract is "tests must fail when written". 3-D is the carve-out: the storage-layer implementation (the triggers from 3-C) already exists; we are writing tests AFTER the implementation to lock the contract in place. **Green-on-first-run is the expected and correct outcome.** This is named in the Phase-2 kickoff to @test-writer so the agent does not balk.

Each of these is `REFUSAL:` per CLAUDE.md §3 except where N/A.

---

## Phase 2 kickoff (for future reference — do not execute now)

The Phase 2 prompt (web-Claude-signed-off, in a new Claude Code session) will instruct:

1. Exit `/plan`.
2. `git checkout -b feat/scaffold-2-stratum-d`.
3. `pnpm add -D vite-tsconfig-paths` (this writes to package.json + pnpm-lock.yaml; verify diff is minimal).
4. Invoke @test-writer:

   ```
   @test-writer Read @docs/plans/SCAFFOLD.2-3D.md in full. Write the 14
   test files + tests/db/_fixtures/db.ts + vitest.config.ts per CAT 1–6
   of the plan. Do not edit src/db/schema/ or drizzle/migrations/ —
   those are refusal-grade out of scope for 3.D.

   Note: tests will pass on first run (the trigger contract from 3.C
   already exists). This is the expected outcome for 3.D — we are
   writing tests-AFTER-implementation to lock the storage-layer contract
   in place, not tests-FIRST. Do not balk on green-on-first-run; surface
   if a test you wrote does NOT pass and the trigger contract per
   SPEC.2 §6.2 + §6.3 indicates it should.
   ```

5. Wait for @test-writer to return; review its coverage map output.
6. Run verification chain per CAT 7. Fix in-session any FAIL.
7. Run pre-PR self-audit per CLAUDE.md §5.10 — walk per-file plan; PASS/FAIL/SURPRISE format.
8. `git add` only the in-scope files; commit via the Phase 2 message template in CAT 8.
9. `git push -u origin feat/scaffold-2-stratum-d` then `gh pr create --draft` with PR body from CAT 8.
10. Write `docs/logs/SCAFFOLD.2-3D.md` in a separate commit on the same branch BEFORE walking away (CLAUDE.md §5.9).
11. Surface to Hrishikesh for chat-side sign-off; merge happens after web-Claude review.

Plan commits as the first commit on `feat/scaffold-2-stratum-d`. Branch is created before plan commit; both plan and implementation squash to main when 3-D PR merges (precedent: SCAFFOLD.2-3C plan + impl squashed at PR #28 merge commit `7552d15`).

---

*Plan drafted 2026-05-12 against SPEC.2 v0.3-draft (3-C amendments applied) + SPEC.1 v1.8.0 + ADRs 0003–0016 (ghost references) + CLAUDE.md (post-PR #28 revision) + AGENTS.md (PRECURSOR.5 baseline). Predecessor: docs/plans/SCAFFOLD.2-3C.md + docs/logs/SCAFFOLD.2-3C.md.*
