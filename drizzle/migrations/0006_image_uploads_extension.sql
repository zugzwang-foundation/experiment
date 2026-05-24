-- 0006_image_uploads_extension.sql — SCAFFOLD.15
-- Extends image_uploads (Bucket B, ratified 3-B §12-R1) with two
-- operational columns + reshapes the orphan-sweep index.
--
-- Pre-launch safety: this migration assumes image_uploads is empty
-- in prd. If a future re-run encounters rows, the NOT NULL ADD fails
-- with a clean error; manual backfill is not in v1 scope.
--
-- Trigger function re-created via CREATE OR REPLACE per SPEC.2 §6.3 +
-- amendment landing in same commit. Immutable-column list extended;
-- the two existing whitelisted transitions (terminal_state +
-- terminal_at atomic XOR) and the one-shot semantics are unchanged.

ALTER TABLE image_uploads ADD COLUMN content_type text NOT NULL;
--> statement-breakpoint

ALTER TABLE image_uploads ADD COLUMN byte_size integer NOT NULL
	CHECK (byte_size > 0 AND byte_size <= 8388608);
--> statement-breakpoint

DROP INDEX IF EXISTS image_uploads_terminal_state_idx;
--> statement-breakpoint

CREATE INDEX image_uploads_orphan_sweep_idx
	ON image_uploads (created_at)
	WHERE terminal_state IS NULL;
--> statement-breakpoint

-- Extended immutable list for SCAFFOLD.15: content_type + byte_size are
-- now operational columns and join id, user_id, r2_object_key, created_at
-- as columns that must NOT change across the lifetime of the row. The
-- two-column atomic transition (terminal_state + terminal_at) remains the
-- ONLY whitelisted change.
CREATE OR REPLACE FUNCTION enforce_image_uploads_terminal_atomic()
RETURNS TRIGGER AS $$
BEGIN
	-- One-shot on terminal_state (immutable once set; permits no-op on terminal rows)
	IF OLD.terminal_state IS NOT NULL AND NEW.terminal_state IS DISTINCT FROM OLD.terminal_state THEN
		RAISE EXCEPTION 'image_uploads: terminal_state is one-shot (immutable once set)';
	END IF;

	-- One-shot on terminal_at (immutable once set; permits no-op on terminal rows)
	IF OLD.terminal_at IS NOT NULL AND NEW.terminal_at IS DISTINCT FROM OLD.terminal_at THEN
		RAISE EXCEPTION 'image_uploads: terminal_at is one-shot (immutable once set)';
	END IF;

	-- Reject partial transition (XOR; one column NULL while other set)
	IF (NEW.terminal_state IS NULL) <> (NEW.terminal_at IS NULL) THEN
		RAISE EXCEPTION 'image_uploads: terminal_state and terminal_at must transition together';
	END IF;

	-- Reject any non-whitelisted column change (extended list per SCAFFOLD.15)
	IF NEW.id IS DISTINCT FROM OLD.id
		OR NEW.user_id IS DISTINCT FROM OLD.user_id
		OR NEW.r2_object_key IS DISTINCT FROM OLD.r2_object_key
		OR NEW.content_type IS DISTINCT FROM OLD.content_type
		OR NEW.byte_size IS DISTINCT FROM OLD.byte_size
		OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
		RAISE EXCEPTION 'image_uploads: only terminal_state + terminal_at may transition together';
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
