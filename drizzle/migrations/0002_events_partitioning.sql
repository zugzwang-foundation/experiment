-- events — canonical audit ledger per SPEC.2 §7 + ADR-0005 §5
-- Hand-written because Drizzle 0.45 cannot express PARTITION BY RANGE.
-- Type inference is provided by src/db/schema/events.ts via drizzle-zod;
-- this DDL is the storage-layer truth.
--
-- Note: 3.A's drizzle.config.ts `tablesFilter: ["!events"]` is a no-op for
-- `drizzle-kit generate` (it applies to push/pull only). 0001 was hand-edited
-- to remove the regular CREATE TABLE "events" block + events_aggregate_idx
-- that drizzle-kit emitted in spite of the filter. See docs/plans/
-- SCAFFOLD.2-3C.md §"3.A drift absorbed" for the rationale.

CREATE TABLE events (
	event_id uuid NOT NULL DEFAULT uuidv7(),
	event_type text NOT NULL,
	aggregate_type text NOT NULL,
	aggregate_id uuid NOT NULL,
	payload jsonb NOT NULL,
	payload_version smallint NOT NULL,
	metadata jsonb NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	-- Composite PK per SCAFFOLD.2 stratum 3.C ratification: Postgres requires
	-- the partition column to be part of any PK/UNIQUE constraint on a
	-- partitioned table. event_id remains the storage-idempotency dedupe
	-- primitive; created_at is supplied deterministically by the insertEvent
	-- helper (ENGINE.6) from the UUIDv7 millisecond prefix so retries that
	-- reuse the same event_id also reuse the same created_at. See SPEC.2 §7.1
	-- + §7.3 (amended same-commit) and docs/plans/SCAFFOLD.2-3C.md
	-- §"3.B events PK + partition contradiction absorbed".
	PRIMARY KEY (event_id, created_at)
) PARTITION BY RANGE (created_at);
--> statement-breakpoint

-- 12 monthly partitions: experiment window + tail per SPEC.2 §7.2.
-- Range bounds are half-open [FROM, TO) — a row at exactly TO lands in the
-- next partition.
CREATE TABLE events_2026_05 PARTITION OF events FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');--> statement-breakpoint
CREATE TABLE events_2026_06 PARTITION OF events FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');--> statement-breakpoint
CREATE TABLE events_2026_07 PARTITION OF events FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');--> statement-breakpoint
CREATE TABLE events_2026_08 PARTITION OF events FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');--> statement-breakpoint
CREATE TABLE events_2026_09 PARTITION OF events FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');--> statement-breakpoint
CREATE TABLE events_2026_10 PARTITION OF events FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');--> statement-breakpoint
CREATE TABLE events_2026_11 PARTITION OF events FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');--> statement-breakpoint
CREATE TABLE events_2026_12 PARTITION OF events FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');--> statement-breakpoint
CREATE TABLE events_2027_01 PARTITION OF events FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');--> statement-breakpoint
CREATE TABLE events_2027_02 PARTITION OF events FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');--> statement-breakpoint
CREATE TABLE events_2027_03 PARTITION OF events FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');--> statement-breakpoint
CREATE TABLE events_2027_04 PARTITION OF events FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');--> statement-breakpoint

-- DEFAULT partition catches out-of-range writes per SPEC.2 §7.2.
-- Sentry alarm 2 (§17 alarm 2) fires on any insert here; alarm wiring is HARDEN.*.
CREATE TABLE events_default PARTITION OF events DEFAULT;--> statement-breakpoint

-- Per-aggregate event-stream lookup index per ADR-0005 §5 / SPEC.2 §7.1.
-- Declared in src/db/schema/events.ts type-only; actual CREATE INDEX ships here.
-- Postgres 11+ auto-creates matching inherited indexes on every existing and
-- future partition — this single CREATE INDEX covers all 13 partitions.
CREATE INDEX events_aggregate_idx ON events (aggregate_type, aggregate_id, created_at);