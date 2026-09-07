-- ═══ LIQ-1 L-10 · take EXECUTE away from the roles a browser can reach ═════
--
-- ADR-0019 rules RLS out of scope on one explicit premise — that *"no browser,
-- client component, or third party holds a database connection"* — and names
-- its own tripwire: a public PostgREST/data endpoint makes RLS mandatory before
-- that path ships. A Supabase project's Data API is ON BY DEFAULT, so the
-- premise is a thing to check rather than a thing to assume, and `@security-
-- auditor` SURPRISE-1 (`docs/parked.md` LIQ-1 L-10) found it unchecked.
--
-- ⚠ THIS MIGRATION IS DEFENCE IN DEPTH, NOT THE ANSWER TO L-10. Whether the
-- hosted Data API is exposed is STILL NOT ESTABLISHED (`O-13`) — that needs a
-- dashboard read no review session can perform. What this closes is the arm
-- LIQ-1 itself ADDED: three new functions, one of which mutates pool reserves
-- and mints ledger events. It leaves L-10's table arm (`REVOKE ALL ON ALL
-- TABLES`, which pre-dates LIQ-1) open and open on purpose — that is a decision
-- about the whole schema, not a rider on a liquidity PR.
--
-- ── WHY ALL THREE GRANTEES, EACH FOR ITS OWN REASON ────────────────────────
--
-- Measured on the Supabase substrate before this was written:
--
--   zz_add_liquidity(numeric,numeric,numeric)
--     {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--   run_liquidity_injection()   … identical
--   check_liquidity_alarms()    … identical
--
-- `=X/postgres` is the PUBLIC grant every `CREATE FUNCTION` hands out by
-- default. The `anon=X` and `authenticated=X` entries are SEPARATE, EXPLICIT
-- grants installed by Supabase's `ALTER DEFAULT PRIVILEGES` on `public`. So
-- revoking from PUBLIC alone would have left both PostgREST-reachable roles
-- holding EXECUTE — a migration that looked correct and changed nothing that
-- mattered. Each name below is load-bearing.
--
-- `service_role` deliberately keeps EXECUTE: it is reachable only with the
-- service key, which is a server-side secret, not a browser-held one. Widening
-- the revoke to it would break an operator path to buy nothing.
--
-- ⚠ THE DEFAULT PRIVILEGE ITSELF IS NOT TOUCHED, so a FUTURE function created
-- in `public` will be granted to anon/authenticated again. That is the general
-- fix and it belongs with L-10's table arm, not here.
--
-- ── WHY THE DO BLOCK, AND WHY PUBLIC IS OUTSIDE IT ─────────────────────────
--
-- `anon` and `authenticated` are Supabase's; CI's substrate is vanilla
-- `postgres:17` and has neither. Measured, both halves:
--
--   REVOKE EXECUTE ON FUNCTION run_liquidity_injection() FROM <absent role>;
--     → ERROR: role "…" does not exist                                exit 1
--   DO $$ … IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = …) … $$;
--     → NOTICE: role absent, skipped                                  exit 0
--
-- A bare REVOKE would therefore make every CI run red on a migration whose
-- whole purpose is to be applied everywhere. The `pg_roles` guard is what lets
-- ONE file apply on both substrates and mean the same thing on each. PUBLIC
-- needs no guard — it is a pseudo-role and always resolves — so it stays a
-- plain statement, where a typo in a function signature still fails loudly.
--
-- ⚠ `CREATE OR REPLACE FUNCTION` PRESERVES ACLs, so a later replacement of any
-- of these three (0028 and 0029 have each already replaced one) inherits the
-- revoked state rather than silently re-granting. A `DROP` + `CREATE` would
-- not. Replace, never drop-and-recreate, for these three.

REVOKE EXECUTE ON FUNCTION run_liquidity_injection() FROM PUBLIC;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION check_liquidity_alarms() FROM PUBLIC;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION zz_add_liquidity(numeric,numeric,numeric) FROM PUBLIC;--> statement-breakpoint

DO $$
DECLARE
	v_role text;
	v_fn   text;
BEGIN
	FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
		IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
			-- The CI substrate. Not an error: the role this would revoke from
			-- cannot hold a grant it has no identity for.
			RAISE NOTICE 'liquidity revoke: role % absent, skipped', v_role;
			CONTINUE;
		END IF;
		FOREACH v_fn IN ARRAY ARRAY[
			'run_liquidity_injection()',
			'check_liquidity_alarms()',
			'zz_add_liquidity(numeric,numeric,numeric)'
		] LOOP
			EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM %I', v_fn, v_role);
		END LOOP;
	END LOOP;
END $$;
