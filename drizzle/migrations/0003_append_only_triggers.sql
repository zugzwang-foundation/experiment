-- 0003_append_only_triggers.sql — SCAFFOLD.2 stratum 3.C
-- Append-only trigger contract per SPEC.2 §6.
--
-- 2 shared Bucket-A functions + 4 per-table Bucket-B functions +
-- 26 trigger declarations across 13 protected tables
-- (9 Bucket A + 4 Bucket B). The trigger SQL is the storage-layer
-- ground truth per SPEC.2 §6.1 clause 4 + §6.5; handler-layer checks
-- are advisory only (§6.4).
--
-- Bucket B trigger functions use the uniform 3-rule (DISTINCT-FROM)
-- pattern per session ratification 2026-05-11: permit no-op UPDATEs,
-- reject per-column re-fires via DISTINCT-FROM, reject non-whitelisted
-- column changes via per-column DISTINCT-FROM enumeration. SPEC.2 §6.3
-- amended same-commit to reflect this uniformity (amendments A + B).

-- ============================================================================
-- Bucket A — strictly append-only (BEFORE UPDATE + BEFORE DELETE both RAISE)
-- Shared functions (parameterized by TG_TABLE_SCHEMA / TG_TABLE_NAME).
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_bucket_a_no_update()
RETURNS TRIGGER AS $$
BEGIN
	RAISE EXCEPTION 'append-only violation on table %.%: UPDATE not permitted',
		TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION enforce_bucket_a_no_delete()
RETURNS TRIGGER AS $$
BEGIN
	RAISE EXCEPTION 'append-only violation on table %.%: DELETE not permitted',
		TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- 9 Bucket A tables × 2 triggers = 18 declarations.
-- For partitioned 'events' parent, Postgres 11+ propagates these
-- row-level triggers to all existing and future partitions automatically.
CREATE TRIGGER bucket_a_no_update BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_update();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_delete BEFORE DELETE ON events FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_update BEFORE UPDATE ON dharma_ledger FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_update();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_delete BEFORE DELETE ON dharma_ledger FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_update BEFORE UPDATE ON bets FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_update();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_delete BEFORE DELETE ON bets FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_update BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_update();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_delete BEFORE DELETE ON comments FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_update BEFORE UPDATE ON resolution_events FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_update();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_delete BEFORE DELETE ON resolution_events FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_update BEFORE UPDATE ON payout_events FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_update();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_delete BEFORE DELETE ON payout_events FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_update BEFORE UPDATE ON mod_actions FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_update();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_delete BEFORE DELETE ON mod_actions FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_update BEFORE UPDATE ON admin_events FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_update();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_delete BEFORE DELETE ON admin_events FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_update BEFORE UPDATE ON user_events FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_update();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_delete BEFORE DELETE ON user_events FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();--> statement-breakpoint

-- ============================================================================
-- Bucket B — append-only with whitelisted column transitions.
-- 4 per-table functions, uniform 3-rule (DISTINCT-FROM) pattern.
-- Column enumerations match src/db/schema/<table>.ts exactly:
--   friendly_fire_events: id, voter_id, comment_id, direction, cleared_at, frozen_at, created_at
--   identity_pool:        id, colour, animal, number, pseudonym, pfp_filename, assigned_at, created_at
--   image_uploads:        id, user_id, r2_object_key, terminal_state, terminal_at, created_at
--   system_state:         id, frozen_at, created_at
-- ============================================================================

-- friendly_fire_events: two independent whitelisted transitions (frozen_at, cleared_at).
-- Permits exactly one whitelisted-column transition per UPDATE; rejects both together;
-- rejects re-fires via DISTINCT-FROM; rejects non-whitelisted column changes; permits no-op.
CREATE OR REPLACE FUNCTION enforce_friendly_fire_events_transitions()
RETURNS TRIGGER AS $$
BEGIN
	-- Reject both whitelisted columns transitioning in the same UPDATE
	IF OLD.frozen_at IS NULL AND NEW.frozen_at IS NOT NULL
		AND OLD.cleared_at IS NULL AND NEW.cleared_at IS NOT NULL THEN
		RAISE EXCEPTION 'friendly_fire_events: frozen_at and cleared_at cannot both transition in the same UPDATE';
	END IF;

	-- One-shot on frozen_at
	IF OLD.frozen_at IS NOT NULL AND NEW.frozen_at IS DISTINCT FROM OLD.frozen_at THEN
		RAISE EXCEPTION 'friendly_fire_events: frozen_at is one-shot (timestamp is immutable once set)';
	END IF;

	-- One-shot on cleared_at
	IF OLD.cleared_at IS NOT NULL AND NEW.cleared_at IS DISTINCT FROM OLD.cleared_at THEN
		RAISE EXCEPTION 'friendly_fire_events: cleared_at is one-shot (timestamp is immutable once set)';
	END IF;

	-- Reject any non-whitelisted column change
	IF NEW.id IS DISTINCT FROM OLD.id
		OR NEW.voter_id IS DISTINCT FROM OLD.voter_id
		OR NEW.comment_id IS DISTINCT FROM OLD.comment_id
		OR NEW.direction IS DISTINCT FROM OLD.direction
		OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
		RAISE EXCEPTION 'friendly_fire_events: only frozen_at or cleared_at may transition';
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- identity_pool: single whitelisted column (assigned_at NULL → timestamp once).
CREATE OR REPLACE FUNCTION enforce_identity_pool_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
	-- One-shot on assigned_at
	IF OLD.assigned_at IS NOT NULL AND NEW.assigned_at IS DISTINCT FROM OLD.assigned_at THEN
		RAISE EXCEPTION 'identity_pool: assigned_at is one-shot (timestamp is immutable once set)';
	END IF;

	-- Reject any non-whitelisted column change
	IF NEW.id IS DISTINCT FROM OLD.id
		OR NEW.colour IS DISTINCT FROM OLD.colour
		OR NEW.animal IS DISTINCT FROM OLD.animal
		OR NEW.number IS DISTINCT FROM OLD.number
		OR NEW.pseudonym IS DISTINCT FROM OLD.pseudonym
		OR NEW.pfp_filename IS DISTINCT FROM OLD.pfp_filename
		OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
		RAISE EXCEPTION 'identity_pool: only assigned_at may transition';
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- image_uploads: two-column atomic transition (terminal_state + terminal_at).
-- 3-rule per session ratification + SPEC.2 §6.3 amendment B.
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

	-- Reject any non-whitelisted column change
	IF NEW.id IS DISTINCT FROM OLD.id
		OR NEW.user_id IS DISTINCT FROM OLD.user_id
		OR NEW.r2_object_key IS DISTINCT FROM OLD.r2_object_key
		OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
		RAISE EXCEPTION 'image_uploads: only terminal_state + terminal_at may transition together';
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- system_state: single whitelisted column (frozen_at NULL → timestamp once).
-- Conclusion-event freeze at 2026-11-05 23:59 UTC per SPEC.2 §20; thaw is
-- BREAK_GLASS.md-only (DISABLE TRIGGER) per §20.3.
CREATE OR REPLACE FUNCTION enforce_system_state_frozen_at()
RETURNS TRIGGER AS $$
BEGIN
	-- One-shot on frozen_at; thaw via BREAK_GLASS.md only (per SPEC.2 §20.3)
	IF OLD.frozen_at IS NOT NULL AND NEW.frozen_at IS DISTINCT FROM OLD.frozen_at THEN
		RAISE EXCEPTION 'system_state: frozen_at is one-shot (conclusion freeze is permanent; thaw via BREAK_GLASS.md)';
	END IF;

	-- Reject any non-whitelisted column change
	IF NEW.id IS DISTINCT FROM OLD.id
		OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
		RAISE EXCEPTION 'system_state: only frozen_at may transition';
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- 4 Bucket B tables × 2 triggers = 8 declarations.
-- BEFORE UPDATE calls per-table function; BEFORE DELETE reuses the shared
-- Bucket-A no-delete function (DELETE is universally forbidden on Bucket B
-- per SPEC.2 §6.1 clause 2).
CREATE TRIGGER bucket_b_update_check BEFORE UPDATE ON friendly_fire_events FOR EACH ROW EXECUTE FUNCTION enforce_friendly_fire_events_transitions();--> statement-breakpoint
CREATE TRIGGER bucket_b_no_delete BEFORE DELETE ON friendly_fire_events FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();--> statement-breakpoint
CREATE TRIGGER bucket_b_update_check BEFORE UPDATE ON identity_pool FOR EACH ROW EXECUTE FUNCTION enforce_identity_pool_assigned_at();--> statement-breakpoint
CREATE TRIGGER bucket_b_no_delete BEFORE DELETE ON identity_pool FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();--> statement-breakpoint
CREATE TRIGGER bucket_b_update_check BEFORE UPDATE ON image_uploads FOR EACH ROW EXECUTE FUNCTION enforce_image_uploads_terminal_atomic();--> statement-breakpoint
CREATE TRIGGER bucket_b_no_delete BEFORE DELETE ON image_uploads FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();--> statement-breakpoint
CREATE TRIGGER bucket_b_update_check BEFORE UPDATE ON system_state FOR EACH ROW EXECUTE FUNCTION enforce_system_state_frozen_at();--> statement-breakpoint
CREATE TRIGGER bucket_b_no_delete BEFORE DELETE ON system_state FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();
