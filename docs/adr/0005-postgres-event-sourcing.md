# ADR-0005 — Postgres + Event Sourcing on the Experiment Stack

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-05-05 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | SPEC.5 |
| **Frame document** | SPEC.2 §1.4 #5 (delegation), §5, §6, §7, §14, §20, §23 (ADR Index) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

The Zugzwang experiment-phase build needs a persistence layer that satisfies three load-bearing properties from SPEC.1:

- **Multi-table ACID atomicity** for the bet flow, comment flow, resolution flow, and Dharma ledger flow (INV-1: bet+comment atomic; INV-4: resolutions append-only; SPEC.2 §9 SERIALIZABLE handler with `SELECT FOR UPDATE`).
- **Append-only enforcement as a database primitive**, not application policy — for INV-4 and the parallel discipline applied to `mod_actions`, `admin_events`, and `friendly_fire_events` per SPEC.1 §16.4.
- **Auditability and dataset-release alignment** — every state-mutating action lands in a canonical event log that, on 2026-11-06, becomes the public dataset (SPEC.1 §12.2; SPEC.2 §20).

CLAUDE.md row 316 ("Postgres 17"), row 317 ("event-sourced schema"), and row 318 ("Supabase as DB provider") name the answer at the locked-decision level. SPEC.2 §1.4 #5 explicitly delegates "Postgres + event-sourcing DDL + position materialisation + append-only trigger SQL" to this ADR. SPEC.2 §5 (Data Model), §6 (Append-Only Enforcement Contract), §7 (Event Model shape), §14 (Invariant Contract), and §20 (Public Dataset Export) are stubs at v0.1-outline that depend on this ADR for substance. This ADR is that ratification.

This ADR does **not** decide:

- Postgres major version pin, hosting vendor, region, PITR retention, cron topology → ADR-0006 (SPEC.6)
- ORM choice and migration tooling → ADR-0008 (SPEC.9)
- Bet transaction concurrency model (SERIALIZABLE + lock order + retry shape) → ADR-0013 (SPEC.14)
- Pre-commit moderation flow → ADR-0014 (SPEC.15)
- Rate-limit and idempotency-key surface → ADR-0015 (SPEC.16)
- UUIDv7 implementation choice (Postgres-native vs userspace function) → ADR-0016 (SPEC.17)
- Specific cron schedules, projector worker runtime topology → ADR-0006 + HARDEN.* tasks
- Specific table DDL (column types, constraints, indexes) → SCAFFOLD.2
- ADR-0004's session-deferral hook contract — already minted upstream

## Decision Drivers

1. **Multi-table ACID atomicity is non-negotiable.** SPEC.2 §9's SERIALIZABLE bet handler writes to `pools`, `positions`, `dharma_ledger`, `bets`, `comments`, and `events` in one transaction. INV-1 (bet+comment atomic) is a database-level guarantee, not an application invariant.

2. **Append-only enforcement must be a DB primitive.** INV-4 and the parallel discipline on `mod_actions`, `admin_events`, `friendly_fire_events` (per SPEC.1 §16.4) cannot rely on application code alone — service-role credentials would bypass it. The DB itself must reject disallowed mutations.

3. **Auditability and dataset-release alignment.** The 2026-11-06 release per SPEC.1 §12.2 is structurally a `pg_dump` over a deterministic view. The architecture must produce this output as a side effect of normal operation, not as a bespoke export pipeline.

4. **Replayability as an architectural property.** Every state mutation must have a corresponding event row, so the read-models are derivable from the events log in principle. This is the discipline; v1 does not need a runtime replay CLI to exercise it.

5. **Solo-developer + Claude Code workflow.** Postgres + SQL has the deepest agent-training-data footprint of any DB option. Every state change reads as "begin transaction, write event row, write read-model rows, commit" — small cognitive surface, agent-friendly.

6. **Build-window stability.** Build runs May → November 2026; codebase archives at conclusion. The DB choice must be stable through that window with no major-version migration required.

7. **AGPL-compatible licensing.** The PostgreSQL License (MIT-style) imposes no obligations on Zugzwang's AGPL-3.0 redistribution per ADR-0001.

## Considered Options

1. **Postgres + event-sourced schema, Pattern A (events log + hand-maintained current state)** ← chosen
2. Postgres + event-sourced schema, Pattern B (strict event-sourced; current state derived only via synchronous projector functions)
3. Firestore + supabase-postgres hybrid (Manifold's stack)
4. Pure Postgres without event sourcing (CRUD only)
5. SQLite + WAL on Vercel functions *(non-option, listed for the record)*

## Decision Outcome

**Chosen: Option 1 — Postgres + event-sourced schema, Pattern A.**

This ADR ratifies five primitives and one hard discipline that downstream code consumes.

### 1. Database family

Postgres. Major-version pin and hosting vendor are out of scope for this ADR (ADR-0006). Single regional primary; no sharding; no replicas in v1; PITR enabled per SCAFFOLD.19.

### 2. Schema architecture: events log + hand-maintained current state (Pattern A)

The bet handler — and every other state-mutating Server Action — writes BOTH the corresponding event row(s) to `events` AND the relevant current-state table rows in a single Postgres transaction. The `events` table is the canonical audit ledger; current-state tables (`pools`, `positions`, `markets`, `users`, `comments`, `bets`, etc.) are co-maintained inside the same transaction for direct read access.

Replay = read events log + re-run hand-written projector logic. Replayability is a property of this architecture (every read-model row has corresponding event rows by handler discipline), not a runtime feature shipped in experiment phase.

This ADR explicitly REJECTS Pattern B (strict event-sourced; the handler writes only events, all read-model writes derived via synchronous projector functions). Rationale: SPEC.2 §9's already-ratified lock order `pools → positions → dharma_ledger → events` requires the handler to acquire row locks on current-state tables before writing the event — Pattern A. Pattern B would invert this ordering and require a projector-function abstraction over every write. The flexibility payoff of Pattern B (post-hoc projector evolution against historical events) is a testnet-phase concern; experiment phase has fixed read-models.

### 3. Per-table append-only-vs-mutable classification

Three buckets, with `image_uploads` deferred to SPEC.2 §12.

**Bucket A — Strictly append-only (9 tables).** `BEFORE UPDATE` AND `BEFORE DELETE` triggers RAISE EXCEPTION on every UPDATE / DELETE without exception:

`events`, `dharma_ledger`, `bets`, `comments`, `resolution_events`, `payout_events`, `mod_actions`, `admin_events`, `user_events`.

**Bucket B — Append-only with one whitelisted column transition (2 tables).** `BEFORE UPDATE` triggers permit exactly one named column's `NULL → timestamp` transition; reject every other change. `BEFORE DELETE` raises:

- `friendly_fire_events`: only `frozen_at` may transition `NULL → timestamp` (SPEC.1 §8 F-COMMENT-8 exit-to-zero freeze).
- `identity_pool`: only `assigned_at` may transition `NULL → timestamp` (SPEC.1 §13 F-AUTH-3 signup consumption).

**Bucket C — Mutable (7 tables).** No append-only trigger; standard UPDATE permitted:

`users`, `markets`, `pools`, `positions`, `sessions`, `admin_sessions`, `verifications` (Better Auth OTP table per ADR-0004).

**Deferred (1 table).** `image_uploads` — classification depends on SPEC.2 §12 (file-storage contract); orphan-sweep semantics drive whether rows are hard-deleted or marked.

### 4. Synchronous-vs-asynchronous read-model classification

The rule: **a read-model updates synchronously, inside the originating transaction, if and only if the originating flow's correctness depends on the updated read-model state. Otherwise it updates asynchronously, in a separate worker, after commit.**

**Synchronous targets** (written inside the originating transaction, alongside the `events` row):

`pools`, `positions`, `bets`, `comments`, `dharma_ledger`, `friendly_fire_events`, `payout_events`, `resolution_events`, `markets` (status update on resolution; denormalised cache of `resolution_events`), `mod_actions`, `admin_events`, `user_events`, `users` (column updates: `last_allowance_accrued_at` on accrual; `pseudonym` on F-AUTH-3; `tos_accepted_at` on F-AUTH-4), `identity_pool` (`assigned_at` on F-AUTH-3 consumption), and the `events` row itself.

**Asynchronous targets:** the `k_eff_dashboard` materialised view, refreshed `CONCURRENTLY` by `pg_cron` on a cadence ratified by ADR-0007. This is the only async target in v1.

**Read-time-computed (no projection table):** debate-view ranking. The ranking function (locked by ADR-0009) runs against `comments` + `friendly_fire_events` per page render; deterministic, no materialisation.

### 5. Events table shape

Columns:

- `event_id` UUID PRIMARY KEY (UUIDv7 per ADR-0016)
- `event_type` TEXT NOT NULL (controlled vocabulary; the canonical enum lives in `src/server/events/schemas.ts`)
- `aggregate_type` TEXT NOT NULL (e.g., `market`, `user`, `comment`, `bet`)
- `aggregate_id` UUID NOT NULL (the entity the event mutates)
- `payload` JSONB NOT NULL (per-event-type schema validated at insertion via Zod in `src/server/events/schemas.ts`)
- `payload_version` SMALLINT NOT NULL (forward-compatibility for payload evolution; no evolution planned in experiment phase)
- `metadata` JSONB NOT NULL (`request_id`, `flow_id`, `user_id` or `null`, `idempotency_key`, IP, user agent — the SPEC.2 §18 observability tag set)
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT `now()`

Idempotency: `event_id` is the storage-layer dedupe key. `INSERT ... ON CONFLICT (event_id) DO NOTHING` is the dedupe primitive, called via the helper at `src/server/events/insert.ts`. The API-boundary idempotency-key surface lives in ADR-0015; this ADR ratifies that the storage primitive is `event_id` collision.

Partitioning: monthly `RANGE` partitions on `created_at`. Twelve partitions are pre-created in the initial schema migration (`events_2026_05` through `events_2027_04`); a `DEFAULT` partition catches any out-of-range insert. Sentry alarms on any DEFAULT-partition row (per SPEC.2 §18). No partition-rotation cron in v1 — twelve months exceeds the build window (codebase archives 2026-11-08).

Per-aggregate event-stream queries are supported by an index on `(aggregate_type, aggregate_id, created_at)`; SCAFFOLD.2 owns the index DDL.

### 6. Append-only enforcement mechanism

`BEFORE UPDATE` triggers (and `BEFORE DELETE` triggers for the strictly-append-only set), shipped as raw SQL in a hand-written migration co-located with the Drizzle migration set. Triggers `RAISE EXCEPTION` with a stable error code on any disallowed mutation. The triggers are the ground-truth enforcement; application-level checks are advisory and exist only to surface friendlier errors before the DB layer fires.

Whitelist transitions for Bucket B are encoded in the trigger function: the trigger inspects `OLD` and `NEW`, allows the row through if and only if the diff is exactly the whitelisted column transition, and raises otherwise.

The triggers are applied via raw SQL because Postgres triggers and table-level rules are not first-class in Drizzle's TypeScript schema API. ADR-0008 ratifies Drizzle for the table-level DDL; this ADR ratifies that triggers and partitioning ship as named SQL files within the same migration set.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Append-only trigger SQL (BEFORE UPDATE / BEFORE DELETE on the 9+2 protected tables) | `drizzle/migrations/<NNNN>_append_only_triggers.sql` |
| Events table partitioning DDL (twelve monthly partitions + DEFAULT partition) | `drizzle/migrations/<NNNN>_events_partitions.sql` |
| Events table column DDL (Drizzle TypeScript) | `src/db/schema/events.ts` |
| `event_type` enum + per-event-type payload Zod schemas | `src/server/events/schemas.ts` |
| Events insertion helper (`INSERT ... ON CONFLICT (event_id) DO NOTHING`) | `src/server/events/insert.ts` |
| Drizzle table definitions (all other tables) | `src/db/schema/*.ts` (per-domain split owned by SCAFFOLD.2) |
| Append-only trigger tests (one expected-failure case per protected table) | `tests/db/append-only.test.ts` |

The first two file paths are the DDL ground truth — they bypass Drizzle's TypeScript schema and are hand-written SQL because triggers and partitioning are not first-class in Drizzle's API. ADR-0008 ratifies the migration-set directory layout; this ADR ratifies that `<NNNN>_append_only_triggers.sql` and `<NNNN>_events_partitions.sql` are the named SQL files within it.

## Consequences

### Positive

- **INV-1, INV-2, INV-4 enforced at the DB layer.** Every protected table has a trigger; every Dharma flow lands as a `dharma_ledger` row inside the originating transaction; every resolution lands as an immutable `resolution_events` row. Bypass requires DDL access (Supabase service role), which is the admin-only operational path.
- **Multi-table ACID atomicity is a Postgres primitive, not application code.** SPEC.2 §9's SERIALIZABLE handler with `SELECT FOR UPDATE` works as written; no application-level coordination layer.
- **Public dataset release reduces to `pg_dump` + a deterministic view.** SPEC.2 §20's pipeline is standard Postgres tooling; SPEC.1 §12.2's release is achievable as a single SQL view per Appendix B.
- **Replayability is preserved by handler discipline.** A future testnet-phase deployment can rehydrate experiment-phase state from the events log without bespoke export code.
- **Solo-developer cognitive surface is small.** Every state change is a transaction; every audit row is an `INSERT`; every read-model row is co-maintained in the same transaction. No projector daemon to monitor in v1.
- **Strongest agent-training-data alignment.** Postgres + SQL is the most documented DB pattern Claude Code generates against; this compounds across every code-generation cycle for the build window.

### Negative

- **Pattern A puts bookkeeping discipline in handler code.** Every state-mutating Server Action MUST call `events.insert(...)` alongside its read-model writes. A forgotten event row = silent audit-log gap. *Mitigated by:* a single `src/server/events/insert.ts` helper called by every handler; CI lint flagging state-mutating handlers without an `events.insert(...)` call (HARDEN.* task).
- **`markets.status` is a denormalised cache of `resolution_events`.** A bug in the resolution handler that updates `resolution_events` but fails to update `markets.status` produces a UI / audit-log mismatch. *Mitigated by:* the resolution Server Action is one transaction; either both writes happen or neither does. A test asserts the invariant after every resolution.
- **No replay CLI in experiment phase = replayability is unverified.** The architecture says replay is possible; no test exercises it. *Acceptable because:* experiment-phase disaster recovery uses Supabase PITR + daily snapshots (SCAFFOLD.19), not replay. Flag for future readers: if testnet phase wants replayability as a live recovery primitive, it must be tested then.
- **Twelve pre-created partitions cover 2026-05 → 2027-04.** Overrun is theoretically possible if the experiment runs past 2027-04. *Acceptable because:* codebase archives 2026-11-08; the DEFAULT partition + Sentry alarm catch any overrun loudly.
- **Triggers and partitioning bypass Drizzle's TypeScript schema.** Two migration files are hand-written SQL, not generated. *Mitigated by:* both files are small, named, version-controlled, and reviewed at SCAFFOLD.2.

### Neutral

- **PostgreSQL License (MIT-style) imposes no obligations on Zugzwang's AGPL-3.0 redistribution.** Confirmed at ADR-0001.
- **Postgres major-version pin** lives in ADR-0006 + `package.json`; this ADR does not pin a major version, only ratifies "Postgres" as the database family.

## Pros and Cons of the Options

### Option 1 — Postgres + event-sourced, Pattern A (chosen)

**Pros**

- Multi-table ACID is a Postgres primitive — INV-1 enforced by `db.transaction(...)`, not application coordination.
- Triggers as append-only enforcement primitive — INV-4 plus the parallel discipline on `mod_actions`, `admin_events`, `friendly_fire_events` enforced at the row level.
- Replayability is a property without a projector daemon in v1.
- `pg_dump` + view = dataset release pipeline; no bespoke export code.
- Solo-developer cognitive surface is small.
- Strongest agent-training-data alignment.

**Cons**

- "Write the event row" is a constant handler discipline; CI lint partially mitigates but is not zero-cost.
- `markets.status` is a denormalised cache — bug surface for the resolution handler.
- Triggers and partitioning are hand-written SQL, not Drizzle-generated.

### Option 2 — Postgres + strict event-sourced (Pattern B)

**Pros**

- Single point of read-model maintenance — the projector function. Handlers cannot forget to write the event because the only thing they write IS the event.
- Adding a new read-model later is a new projector + replay against historical events; cleanest theoretical replayability.

**Cons**

- **Inverts SPEC.2 §9's already-ratified lock order.** `pools → positions → dharma_ledger → events` requires the handler to lock current-state rows before writing the event; Pattern B forces an `events` → projector → current-state ordering that doesn't fit the SERIALIZABLE bet handler shape.
- Forces a synchronous projector function abstraction over every write — net new contract surface in the codebase.
- Flexibility payoff (post-hoc projector evolution) is a testnet-phase concern; experiment phase has fixed read-models.
- Solo-developer cognitive surface is larger — every read-model write goes through a projector indirection layer.

**Verdict:** Rejected. Architectural elegance wins on paper; loses against SPEC.2 §9's already-ratified lock order and the experiment-phase scope ceiling.

### Option 3 — Firestore + supabase-postgres hybrid (Manifold's stack)

**Pros**

- Manifold's existence proof: the stack runs a real prediction market with millions of users.
- Firestore real-time subscriptions reduce client-side polling/SSE infrastructure.
- Generous free tier.

**Cons**

- **No multi-document ACID across the bet+comment+ledger+event surface that SPEC.2 §9 requires.** Firestore's transaction primitive is single-document; multi-document atomicity is application-level orchestration with retry. INV-1 becomes an application invariant, not a database guarantee.
- **No append-only enforcement primitive.** Firestore has no trigger equivalent (Cloud Functions are post-hoc, not BEFORE-write). INV-4 becomes application policy enforced by access-control rules, bypassable via service-role credentials with no audit trail at the DB layer.
- **Eventual consistency on queries** complicates SPEC.2 §9's freshness requirement.
- Hybrid stack = two persistence systems with two operational models.

**Verdict:** Rejected. Manifold's product works on Firestore because Manifold's invariants tolerate eventual consistency; Zugzwang's INV-1 + INV-4 do not.

### Option 4 — Pure Postgres without event sourcing (CRUD only)

**Pros**

- Simpler initially: just tables, just UPDATE/DELETE.
- Smallest schema surface area.
- No events log overhead.

**Cons**

- Loses the audit trail that INV-4 and SPEC.1 §16.4 require. Append-only resolutions, `mod_actions`, `admin_events` still need triggers — at which point the audit-log discipline is half-built without the unifying `events` log abstraction.
- Public dataset release becomes a per-table export with PII scrubbing logic per table; no single canonical event ledger to dump.
- Loses replayability as a property — once a row is updated, the history is gone unless every table maintains its own change log (which is just a worse event log).
- Loses the "every state change has one row in `events` with full context" observability surface that SPEC.2 §18 leans on.

**Verdict:** Rejected. The audit-log + replayability requirements force event sourcing whether you call it that or not; doing it explicitly is cleaner.

### Option 5 — SQLite + WAL on Vercel functions

Listed for the record. Not viable: Vercel functions are stateless, with no persistent local disk; SQLite does not survive function-instance recycling. **Rejected on availability grounds.**

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.2 §1.4 #5 | Delegated decision | Postgres + event-sourcing DDL + position materialisation + append-only trigger SQL — ratified by this ADR |
| SPEC.2 §5 (stub) | Table inventory | Back-pressure on next §5 drafting pass: (a) drop `admin` (no admin row exists per F-AUTH-ADMIN structural separation); (b) rename `otp_codes` → `verifications` (per ADR-0004 Better Auth); (c) drop `daily_allowance_events` (collapsed into `events` + `dharma_ledger` + `users.last_allowance_accrued_at`); (d) drop `projections_state` (no async projector cursor needed in v1; `k_eff_dashboard` is the sole async target and `pg_cron` manages its own state); (e) carry the per-table classification (Bucket A / B / C) ratified in this ADR. |
| SPEC.2 §6 (stub) | Append-only enforcement contract | Mints: trigger SQL lives in `drizzle/migrations/<NNNN>_append_only_triggers.sql`; the trigger pattern is `BEFORE UPDATE` (and `BEFORE DELETE` for the strictly-append-only set) `RAISE EXCEPTION` on disallowed mutations; whitelist transitions per Bucket B are the only exceptions. Back-pressure: §6 absorbs the file path and the per-table classification on the next drafting pass. |
| SPEC.2 §7 (stub) | Event model shape | Mints: events table column shape, monthly RANGE partitioning on `created_at` with twelve pre-created partitions + DEFAULT partition, the synchronous-vs-asynchronous read-model classification rule (synchronous if the originating flow's correctness depends on the read model; asynchronous otherwise), the per-target lists. Back-pressure: §7 substance is now ratified; the §7 drafting pass references this ADR rather than redefining. |
| SPEC.2 §9 | Concurrency contract | Consumes: the SERIALIZABLE bet handler with `SELECT FOR UPDATE` on `pools` (per ADR-0013) is implementable because Postgres provides multi-table ACID. Lock order `pools → positions → dharma_ledger → events` aligns with Pattern A. |
| SPEC.2 §14 (stub) | Invariant contract | Mints: INV-2 (Dharma conservation) is enforced by `dharma_ledger` Bucket A status + bet-handler discipline writing one ledger row per Dharma flow inside the originating transaction; INV-4 (resolutions append-only) is enforced by `resolution_events` + `payout_events` Bucket A status + the BEFORE UPDATE / BEFORE DELETE triggers. Back-pressure: §14's invariant-mechanism table cites the trigger SQL file and the ledger-row discipline. |
| SPEC.2 §18 (stub) | Observability contract | Consumes: `events.metadata` JSONB carries `request_id`, `flow_id`, `user_id`, `idempotency_key`, IP, user agent — the §18 tag set. Mints: a Sentry alarm on any DEFAULT-partition row in `events` (signals partition-range overrun). |
| SPEC.2 §20 (stub) | Public dataset export pipeline | Consumes: `pg_dump` + a per-table view (PII scrubbed, identity columns pseudonymized, audit columns kept raw) is the export pipeline. The events log is the canonical record; the 2026-11-06 release includes the events log per Appendix B. |
| SPEC.2 §23 | ADR Index | Status of ADR-0005 flips from `provisional` to `accepted` on this commit. |
| SPEC.1 INV-1 | Bet+comment atomicity | Implemented via `db.transaction(...)` wrapping both inserts. Postgres ACID is the mechanism; ADR-0013 owns the SERIALIZABLE shape. |
| SPEC.1 INV-2 | Dharma conservation | Implemented by every Dharma flow inserting one `dharma_ledger` row inside the originating transaction; the trigger on `dharma_ledger` (Bucket A) prevents post-hoc tampering. INV-2 is therefore enforced by handler discipline + DB-layer immutability of past entries. |
| SPEC.1 INV-3 | Comments side-bound at post-time | Indirectly supported: `comments` is Bucket A. `comments.side_at_post_time` cannot be modified after insert, which is what INV-3 requires. ADR-0013 / DEBATE.3 own the post-time-side capture itself. |
| SPEC.1 INV-4 | Resolutions append-only | Directly implemented: `resolution_events` and `payout_events` are Bucket A; the BEFORE UPDATE / BEFORE DELETE triggers `RAISE` on any mutation. Corrections are net-new compensating events with `corrects_event_id` (per SPEC.1 §11 F-RESOLVE-2); the original event row stays untouched. |
| SPEC.1 §16.4 | Audit log catalogue | All §16.4 tables are Bucket A or B in this ADR's classification. The "single permitted update" notes in §16.4 (`friendly_fire_events.frozen_at`, `identity_pool.assigned_at`) are the Bucket B whitelist transitions. |
| ADR-0004 | Verifications table | Consumes: ADR-0004 mints the Better Auth `verifications` table for OTP storage; this ADR classifies it as Bucket C (mutable). Row lifecycle is owned by the Better Auth library. |
| ADR-0006 (gating) | Postgres major version, hosting, cron | This ADR ratifies "Postgres" as the database family; ADR-0006 pins the major version, hosting vendor (Supabase per CLAUDE.md row 318), region, PITR retention, and `pg_cron` topology. |
| ADR-0008 (gating) | ORM and migration tooling | This ADR ratifies the file paths for trigger and partition SQL within the migration set; ADR-0008 ratifies Drizzle as the ORM and the migration runner that ships these SQL files. |
| ADR-0013 (gating) | Bet transaction shape | Consumes Pattern A; the SERIALIZABLE bet handler with `SELECT FOR UPDATE` is the canonical Pattern A handler. |
| ADR-0016 (gating) | UUIDv7 implementation | Consumes the `event_id` UUIDv7 PK; ADR-0016 ratifies whether Postgres-native or userspace function. |
| Tracker | SCAFFOLD.2, SCAFFOLD.19, ENGINE.6, ENGINE.7, ENGINE.9, DEBATE.1, DEBATE.3, every state-mutating ENGINE.* / DEBATE.* / UI.* task | All depend on this ADR being `accepted` |

## More Information

- Postgres documentation on partitioning: <https://www.postgresql.org/docs/current/ddl-partitioning.html>
- Postgres documentation on triggers: <https://www.postgresql.org/docs/current/sql-createtrigger.html>
- RFC 9562 (UUIDv7) — referenced for `event_id`; full ratification in ADR-0016
- Manifold's stack (rationale for departure): Firestore + supabase hybrid; eventual-consistency model unsuited to SPEC.1 INV-1 / INV-4
- AGENTS.md §6 (database conventions) — already aligned with Postgres + Drizzle
- CLAUDE.md row 316 (Postgres 17 — locked) — unchanged by this ADR; major-version pin lives in ADR-0006
- CLAUDE.md row 317 (event-sourced schema — locked) — this ADR is the ratification
- CLAUDE.md row 318 (Supabase as DB provider — locked) — consumed by ADR-0006
- CLAUDE.md row 319 (Drizzle ORM — locked) — consumed by ADR-0008
- SPEC.1 §5 (invariants), §11 (resolution surface), §16.4 (audit log catalogue), §12.2 (dataset release)
- SPEC.2 §5, §6, §7 (stubs absorbing this ADR), §9 (concurrency), §14 (invariant contract), §18 (observability), §20 (public dataset), §23 (ADR Index)
- ADR-0001 (license — Postgres' license is AGPL-compatible)
- ADR-0003 (Next.js 16 — provides Server Action contract for Pattern A handlers)
- ADR-0004 (Better Auth — `verifications` table classified as mutable in this ADR)

---

*ADR-0005 ratifies Postgres + event-sourced schema (Pattern A) for the Zugzwang experiment phase, with the per-table append-only-vs-mutable classification, the events table shape, monthly partitioning with twelve pre-created partitions, the synchronous-vs-asynchronous read-model classification rule, and replayability as an architectural property without a v1 replay CLI. The decision body and the per-table classification are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
