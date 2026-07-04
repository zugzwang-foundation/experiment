-- 0021_truncate_guards.sql — AUDIT-FIX-B2 (A20; ADR-0030)
-- TRUNCATE-rejection extension of the 0003 append-only trigger contract
-- (SPEC.2 §6, amended same-commit).
--
-- TRUNCATE fires NO row-level triggers, so one statement bypassed the entire
-- 0003 guard (INV-2/INV-4 storage ground truth) on all 12 protected tables.
-- Closed with BEFORE TRUNCATE … FOR EACH STATEMENT reject triggers: a firing
-- trigger aborts the whole statement BEFORE any truncation, cascaded tables
-- included. One shared bare-RAISE function in the 0003 Bucket-A shape
-- (parameterized by TG_TABLE_SCHEMA/TG_TABLE_NAME); the per-table Bucket-B
-- OLD/NEW functions are row-level-only — NOT statement-safe, deliberately
-- not reused.
--
-- Coverage (25 triggers):
--   Bucket A — 8 non-partitioned tables + the `events` family. Statement-
--   level triggers do NOT clone to partitions (unlike 0003's row-level
--   triggers, which Postgres propagates), and a direct partition TRUNCATE
--   never fires the parent's trigger — so the parent AND all 13 partitions
--   (12 monthly events_2026_05…events_2027_04 + events_default, per 0002)
--   each carry their own trigger. No dynamic partition creation exists as of
--   0021 (0007/0011/0015 are watermark/drift only); any future
--   partition-adding migration MUST attach bucket_a_no_truncate to the new
--   partition.
--   Bucket B — identity_pool, image_uploads, system_state: TRUNCATE is a
--   bulk DELETE and DELETE is universally forbidden on Bucket B (SPEC.2 §6.1
--   clause 2), so the same shared function rejects it (trigger name marks
--   the bucket, mirroring 0003's bucket_b_no_delete convention).
--
-- Owner-privilege note (ADR-0030): the runtime role currently OWNS these
-- tables and an owner can ALTER TABLE … DISABLE TRIGGER — this guard (like
-- all of 0003) is an accident/blast-radius barrier and an unsophisticated-
-- injection stop, not a defense against an owner-level attacker. The
-- complete fix (dedicated non-owner runtime role) is parked in
-- docs/parked.md. Test teardowns clear protected tables via the
-- owner-privilege disable → TRUNCATE → re-enable fixture
-- (tests/db/_fixtures/truncate.ts) — TEST-ONLY, no production escape hatch,
-- no session_replication_role dependency.

CREATE OR REPLACE FUNCTION enforce_bucket_a_no_truncate()
RETURNS TRIGGER AS $$
BEGIN
	RAISE EXCEPTION 'append-only violation on table %.%: TRUNCATE not permitted',
		TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Bucket A — 8 non-partitioned tables.
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON dharma_ledger FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON bets FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON comments FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON resolution_events FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON payout_events FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON mod_actions FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON admin_events FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON user_events FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint

-- events family — parent + all 13 partitions (statement triggers don't clone;
-- a direct partition TRUNCATE skips the parent's trigger).
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON events FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON events_2026_05 FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON events_2026_06 FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON events_2026_07 FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON events_2026_08 FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON events_2026_09 FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON events_2026_10 FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON events_2026_11 FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON events_2026_12 FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON events_2027_01 FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON events_2027_02 FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON events_2027_03 FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON events_2027_04 FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON events_default FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint

-- Bucket B — 3 tables (shared function; name marks the bucket, 0003 style).
CREATE TRIGGER bucket_b_no_truncate BEFORE TRUNCATE ON identity_pool FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_b_no_truncate BEFORE TRUNCATE ON image_uploads FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();--> statement-breakpoint
CREATE TRIGGER bucket_b_no_truncate BEFORE TRUNCATE ON system_state FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();
