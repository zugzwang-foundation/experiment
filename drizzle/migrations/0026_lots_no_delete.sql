-- 0026_lots_no_delete.sql — PHASE-0 / ADR-0039 R9.
--
-- R9 says a lot never grows and Sold is permanent. 0025 backed the first half
-- at the storage layer with monotonicity CHECKs and left the second half to the
-- application: `surviving_shares` can only fall, but a row that falls to zero
-- can still be DELETEd, and a deleted lot takes its history with it.
--
-- That is not a cosmetic hole. R2 is the invariant-class rule
--   Σ lots.surviving_shares == positions.quantity, per (user_id, market_id, side)
-- and a DELETE breaks it silently in the one direction nothing else checks: the
-- CHECKs bound each surviving row from both ends, so they cannot see a summand
-- that is no longer there. Every other way of reaching a wrong sum leaves
-- evidence in a row; this one removes the row. Worse, it takes the ARGUMENT's
-- accounting with it — a lot is a bet is an argument (R1), so a vanished lot is
-- a participant's stake in a debate quietly ceasing to have been.
--
-- Nothing stops one today, and no code needs to. That is the point: the guard
-- costs nothing to hold and the absence costs everything to discover.
--
-- ── WHY THIS IS *NOT* A BUCKET RECLASSIFICATION ──────────────────────────────
--
-- `lots` stays BUCKET C (mutable) and this migration does not move it. Bucket C
-- is about whether the row may CHANGE, and `lots` rows change on every sell —
-- that is what `surviving_shares` is for. What R9 needs is narrower and
-- differently shaped: the row may change, in one direction, forever, and may
-- never LEAVE. "Append-only" is the wrong name for that and `bucket_a_*` would
-- be the wrong trigger family; it would claim UPDATE is forbidden here, which
-- is the opposite of true.
--
-- So the trigger is named `lots_no_delete` and NOT `bucket_%`, and that choice
-- is load-bearing rather than stylistic:
--
--   * The reset's G-4 catalog reads `tgname LIKE 'bucket_%'`
--     (tests/staging/_lib/reset.ts). A `bucket_`-prefixed name here would
--     enter that catalog and move EXPECTED_GUARD_CATALOG_ROWS 78 → 79 while
--     asserting a bucket family that covers exactly one table. It stays 78,
--     and the live catalog genuinely returns 78 — verified, not assumed.
--   * There is deliberately NO `_no_truncate` companion, and no entry in
--     `tests/db/_fixtures/truncate.ts`'s TRUNCATE_GUARDS. TRUNCATE fires no
--     ROW-level triggers, so `TRUNCATE bets CASCADE` still reaches `lots`
--     through the FK and still empties it. The teardown path and the staging
--     reset are untouched — which is exactly what 0025's header promised and
--     this migration must not quietly revoke.
--
-- The one honest cost: a guard outside the `bucket_%` catalog is a guard G-4
-- does not verify is still enabled. `tests/unit/staging/guard-list-parity.test.ts`
-- takes that job instead — it now pins the non-catalog set to exactly this one
-- trigger, so the classification is asserted rather than assumed, and a second
-- unclassified trigger fails there rather than being silently forgotten.
--
-- ── SCOPE ───────────────────────────────────────────────────────────────────
--
-- Row-level BEFORE DELETE only. NOT a BEFORE TRUNCATE. Purely additive — one
-- function and one trigger, no ALTER on any live table, no data movement — so
-- it satisfies ADR-0024's expand/contract rule trivially, and code that
-- predates it is unaffected because nothing in the repo deletes a lot.
--
-- The UPDATE-monotonicity trigger (rejecting an UPDATE that RAISES
-- `surviving_shares` above its OLD value, which the CHECKs cannot see because
-- they compare against `original_shares` only) is DOCKETED to the phase
-- boundary and deliberately not built here.

CREATE OR REPLACE FUNCTION enforce_lots_no_delete()
RETURNS TRIGGER AS $$
BEGIN
	RAISE EXCEPTION 'R9 violation on table %.%: DELETE not permitted — a lot is permanent (ADR-0039 R9); Sold is a state, not a removal',
		TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER lots_no_delete BEFORE DELETE ON lots FOR EACH ROW EXECUTE FUNCTION enforce_lots_no_delete();

-- ============================================================================
-- DOWN  (recorded, NOT applied — the 0025 convention, and for the same reason)
-- ============================================================================
--
--   DROP TRIGGER IF EXISTS lots_no_delete ON lots;
--   DROP FUNCTION IF EXISTS enforce_lots_no_delete();
--
-- In that order: the trigger depends on the function. Reversal in practice is a
-- NEW forward migration carrying those two statements, because this repo's
-- migrations are forward-only (AGENTS.md §6) and an untested down-runner is
-- more dangerous than none — it invites trust in the one situation where being
-- wrong is unaffordable.
