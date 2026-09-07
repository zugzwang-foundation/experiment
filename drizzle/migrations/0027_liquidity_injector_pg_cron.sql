CREATE TABLE "liquidity_policy" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"version" integer NOT NULL,
	"coefficient" numeric(38, 18) NOT NULL,
	"floor" numeric(38, 18) NOT NULL,
	"trigger_ratio" numeric(38, 18) NOT NULL,
	"guard_low" numeric(38, 18) NOT NULL,
	"guard_high" numeric(38, 18) NOT NULL,
	"endgame_hours" integer NOT NULL,
	"lock_timeout_ms" integer NOT NULL,
	"enabled" boolean NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "liquidity_policy_bounds" CHECK ("liquidity_policy"."coefficient" > 0 AND "liquidity_policy"."floor" > 0
				AND "liquidity_policy"."trigger_ratio" > 0 AND "liquidity_policy"."trigger_ratio" <= 1
				AND "liquidity_policy"."guard_low" > 0 AND "liquidity_policy"."guard_high" < 1
				AND "liquidity_policy"."guard_low" < "liquidity_policy"."guard_high"
				AND "liquidity_policy"."endgame_hours" >= 0 AND "liquidity_policy"."lock_timeout_ms" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "liquidity_policy_version_unique" ON "liquidity_policy" USING btree ("version");--> statement-breakpoint
CREATE INDEX "liquidity_policy_effective_idx" ON "liquidity_policy" USING btree ("effective_from" DESC,"version" DESC);
--> statement-breakpoint

-- ═══ (a) liquidity_policy — Bucket A ════════════════════════════════════════
--
-- Reuses the shared functions 0003 (row-level) and 0021 (statement-level)
-- already ship. No new function is defined here: three tables' worth of
-- identical trigger bodies is exactly the drift `0003` centralised away.
--
-- ⚠ These three rows move `EXPECTED_GUARD_CATALOG_ROWS` in
-- tests/staging/_lib/guards.ts from 78 to 81, and
-- tests/unit/staging/guard-list-parity.test.ts DERIVES the expected count by
-- parsing every migration — so it reds the moment this file lands, before any
-- database is touched. That is the interlock working, not a failure.
CREATE TRIGGER bucket_a_no_update BEFORE UPDATE ON "liquidity_policy"
	FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_update();
--> statement-breakpoint
CREATE TRIGGER bucket_a_no_delete BEFORE DELETE ON "liquidity_policy"
	FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();
--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON "liquidity_policy"
	FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();
--> statement-breakpoint

-- ═══ (b) liquidity_heartbeat — operational, deliberately unguarded ══════════
--
-- Follows watermark_state / cron_alarms (0007): OPERATIONAL tables carry no
-- bucket_% trigger and are excluded from the dataset inventory entirely
-- (SPEC.2 §19.3). ⚠ It must NOT be bucket_%-named or the G-4 catalogue count
-- moves and the staging reset tries to disable a guard on a table it never
-- truncates. It is also absent from Drizzle by design — hence
-- "!liquidity_heartbeat" in drizzle.config.ts's tablesFilter, without which
-- db:check-drift reports a table Drizzle does not know about.
--
-- What it is FOR: a stopped pg_cron job produces no error, no log and no
-- alarm. A row here is the only positive evidence that the job ran at all —
-- which is why it is written on EVERY tick, including the disabled, frozen and
-- no-policy paths (R4). It records that the JOB ran, never that it injected.
CREATE TABLE IF NOT EXISTS liquidity_heartbeat (
	id bigserial PRIMARY KEY,
	run_id uuid NOT NULL,
	ran_at timestamptz NOT NULL DEFAULT now(),
	policy_version integer NULL,
	markets_considered integer NOT NULL,
	markets_injected integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS liquidity_heartbeat_ran_at_idx
	ON liquidity_heartbeat (ran_at DESC);
--> statement-breakpoint

-- ═══ (c) zz_add_liquidity — ADR-0047 §A in SQL ══════════════════════════════
--
-- The RUNTIME half of "two implementations, one definition". The TypeScript
-- addLiquidity in src/server/cpmm/calculate.ts is the specification and the
-- test oracle; tests/db/cpmm/liquidity-differential.spec.ts pins the two
-- together across >= 10,000 fuzzed pairs, with a negative control so it cannot
-- degenerate into a function compared against itself.
CREATE OR REPLACE FUNCTION zz_add_liquidity(
	p_yes numeric, p_no numeric, p_amount numeric
) RETURNS TABLE(yes numeric, no numeric, backing numeric, d_yes numeric, d_no numeric)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
	yes_is_long boolean;
	l numeric; s numeric; l_prime numeric; s_prime numeric; discarded numeric;
BEGIN
	-- PRECONDITIONS, NOT VALIDATION. div() truncates TOWARD ZERO (measured:
	-- div(7,2)=3, div(-7,2)=-3), so "truncate == floor" holds only while every
	-- operand is positive. Take this guard away and the arithmetic below stops
	-- being the floor it claims to be on negative input.
	IF p_yes <= 0 OR p_no <= 0 OR p_amount <= 0 THEN
		RAISE EXCEPTION 'zz_add_liquidity: non-positive input (%, %, %)',
			p_yes, p_no, p_amount;
	END IF;

	yes_is_long := p_yes >= p_no;   -- ties to yes; at S/L = 1 both branches agree
	l := CASE WHEN yes_is_long THEN p_yes ELSE p_no END;
	s := CASE WHEN yes_is_long THEN p_no  ELSE p_yes END;

	l_prime := l + p_amount;

	-- floor18(s + a*s/l) == s + floor18(a*s/l), because s is an exact multiple
	-- of 1e-18 (the column is NUMERIC(38,18)) — which is what licenses splitting
	-- the floor across the sum.
	--
	-- div() is EXACT integer division: no result scale is selected, so nothing
	-- here depends on PostgreSQL's select_div_scale. That matters, because the
	-- obvious alternative does: trunc(a*s/l, 18) looks safe and is not, since
	-- scale() of a numeric division is DIVIDEND-dependent (measured
	-- scale(1/3)=20, scale((a*s)/l)=36). Its guard digits are an accident of the
	-- operands, not a guarantee — and the differential's negative control runs
	-- exactly that expression to prove the harness can see the difference.
	--
	-- Every intermediate is UNCONSTRAINED numeric. a*s*1e18 reaches 1e58 at the
	-- column ceiling, which unconstrained numeric holds; a numeric(38,18) cast
	-- anywhere in this chain raises `numeric field overflow` at 10^20. Cast only
	-- on the final assignment into pools.
	s_prime := s + div(p_amount * s * 1000000000000000000::numeric, l)
	               * 0.000000000000000001::numeric;

	-- The discard is a RESIDUAL, never an independently rounded product. That is
	-- what makes (s' - s) + discarded == a EXACT, and the backing identity
	-- (cpmm.md §7.1) rests on it: every Đ deposited is in a reserve, in a
	-- position, or discarded, with nothing lost to a second rounding.
	discarded := p_amount - (s_prime - s);

	RETURN QUERY SELECT
		CASE WHEN yes_is_long THEN l_prime ELSE s_prime END,
		CASE WHEN yes_is_long THEN s_prime ELSE l_prime END,
		p_amount,
		CASE WHEN yes_is_long THEN 0::numeric ELSE discarded END,
		CASE WHEN yes_is_long THEN discarded ELSE 0::numeric END;
END; $$;
--> statement-breakpoint

-- ═══ (d) run_liquidity_injection — the eleven steps of ADR-0047 §D ══════════
--
-- A FUNCTION, invoked with SELECT from cron.schedule(), matching 0007 and 0011
-- (ruling R8). The whole sweep is therefore ONE transaction and this body
-- carries no COMMIT. Each market runs in its own subtransaction so that one
-- bad market cannot cost the other seven.
--
-- ⚠ THE COST OF ONE TRANSACTION, STATED: a pool row locked at the first market
-- stays locked until the sweep ends, where a per-market COMMIT would have
-- released it earlier. Bounded by arithmetic — lock_timeout is 100 ms and
-- there are eight Open markets, so the worst case is ~0.8 s against the bet
-- path's 1,000 ms statement_timeout and its 4-attempt [50,100,200] backoff —
-- and bounded by measurement in
-- tests/db/liquidity-contention.spec.ts. That margin degrades linearly as
-- markets are added; it is the first thing to re-measure if the count rises.
CREATE OR REPLACE FUNCTION run_liquidity_injection()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
	p                liquidity_policy%ROWTYPE;
	v_run_id         uuid := gen_random_uuid();
	v_policy_version integer;
	v_users          bigint;
	v_target         numeric;
	v_considered     integer := 0;
	v_injected       integer := 0;
	m                record;
	pool_row         record;
	v_tank           numeric; v_price numeric; v_a numeric;
	r                record;
	v_event_id       uuid; v_created_at timestamptz;
BEGIN
	-- OVERLAP GUARD, transaction-scoped. It releases on ERROR as well as on
	-- commit, which is what a session-level lock would not do on the ADR
	-- Runbook's own recovery path: "liquidity_silence fires -> call the injector
	-- by hand". A hand-run from psql that threw would leak a session lock into
	-- the operator's session and block every scheduled tick afterwards — a
	-- recovery step that causes the outage it was reaching for.
	IF NOT pg_try_advisory_xact_lock(hashtext('zugzwang.liquidity_injector')) THEN
		RETURN;
	END IF;

	-- Newest effective policy wins; version DESC breaks a same-instant tie.
	SELECT * INTO p FROM liquidity_policy
	WHERE effective_from <= now()
	ORDER BY effective_from DESC, version DESC LIMIT 1;

	v_policy_version := p.version;   -- NULL when there is no policy row at all

	-- The heartbeat is evidence the JOB RAN, never evidence it injected, so it
	-- is written on every tick that reaches here — disabled, frozen and
	-- no-policy included (R4). Conflating "quiet on purpose" with "stopped" is
	-- precisely what makes a dead cron invisible; check_liquidity_alarms() is
	-- the half that knows about `enabled`.
	--
	-- The freeze exit has no exemption, unlike the resolution flows: the
	-- injector is a WRITE surface, and SPEC.1 §12's conclusion freeze means
	-- post-freeze it is a no-op. A market in flight must be able to FINISH;
	-- nothing needs to be able to grow.
	IF NOT FOUND OR NOT p.enabled
	   OR EXISTS (SELECT 1 FROM system_state WHERE frozen_at IS NOT NULL) THEN
		INSERT INTO liquidity_heartbeat
			(run_id, policy_version, markets_considered, markets_injected)
		VALUES (v_run_id, v_policy_version, 0, 0);
		RETURN;
	END IF;

	-- ONCE, at the top. There is no COMMIT in this body to reset it, and a
	-- rolled-back subtransaction does not clear it either (measured on 17.6:
	-- current_setting('lock_timeout') still reads the top-level value after a
	-- subtransaction rolled back).
	--
	-- lock_timeout, never NOWAIT. A bet holding the row is the NORMAL case, not
	-- an error; NOWAIT would surrender to any bet in flight.
	EXECUTE format('SET LOCAL lock_timeout = %s', p.lock_timeout_ms);

	-- ONE count per tick, not one per market. ADR §C: the target is uniform
	-- across every Open market, and eight counts could straddle a signup and
	-- hand two markets different targets in one sweep. Measured Seq Scan,
	-- 8.1 ms at 100,000 rows — 0.013% of the 60 s interval. Deliberately NOT
	-- pg_class.reltuples: that is ANALYZE-lagged, and a target an auditor
	-- cannot reproduce from the shipped dataset is not a target.
	SELECT count(*) INTO v_users FROM users;
	v_target := GREATEST(p.floor, p.coefficient * v_users);

	FOR m IN
		SELECT id, resolution_deadline FROM markets WHERE status = 'Open'
		ORDER BY id
	LOOP
		v_considered := v_considered + 1;

		-- ENDGAME: leave the closing window alone. Skipped BEFORE the
		-- subtransaction is entered, so it costs no lock and no savepoint.
		CONTINUE WHEN now() + make_interval(hours => p.endgame_hours)
		              >= m.resolution_deadline;

		BEGIN
			-- markets -> pools, the canonical order (ADR-0013 P2/P3). A
			-- pools -> markets edge would cycle against W-3/W-4.
			PERFORM 1 FROM markets WHERE id = m.id FOR NO KEY UPDATE;

			SELECT yes_reserves AS yes, no_reserves AS no
			INTO pool_row FROM pools WHERE market_id = m.id FOR NO KEY UPDATE;

			IF FOUND THEN
				v_tank  := pool_row.yes + pool_row.no;
				v_price := pool_row.no / v_tank;         -- p_yes = n / (y + n)

				IF v_tank < p.trigger_ratio * v_target
				   AND v_price <= p.guard_high
				   AND v_price >= p.guard_low THEN

					-- a = L * (target/tank - 1), from tank' = tank + a*(L+S)/L
					-- solved for tank' = target (SIM-2 §0a).
					v_a := GREATEST(pool_row.yes, pool_row.no)
					       * (v_target / v_tank - 1);

					IF v_a > 0 THEN
						SELECT * INTO r
						FROM zz_add_liquidity(pool_row.yes, pool_row.no, v_a);

						UPDATE pools
						SET yes_reserves = r.yes::numeric(38,18),
						    no_reserves  = r.no::numeric(38,18)
						WHERE market_id = m.id;

						-- created_at is DERIVED from the event id's first 48 bits,
						-- exactly as insert.ts's uuidv7ToCreatedAt does. Two tests
						-- assert that property, and `events` is RANGE-partitioned
						-- on this column — a now() here would be a second clock.
						v_event_id   := public.uuidv7();
						v_created_at := to_timestamp(
							(('x' || substr(replace(v_event_id::text, '-', ''), 1, 12))
							 ::bit(48)::bigint) / 1000.0);

						INSERT INTO events
							(event_id, event_type, aggregate_type, aggregate_id,
							 payload, payload_version, metadata, created_at)
						VALUES (v_event_id, 'pool.liquidity_added', 'market', m.id,
							jsonb_build_object(
								'marketId',        m.id,
								'policyVersion',   p.version,
								'target',          v_target::numeric(38,18)::text,
								'tankBefore',      v_tank::numeric(38,18)::text,
								'tankAfter',       (r.yes + r.no)::numeric(38,18)::text,
								'reservesBefore',  jsonb_build_object(
									'yes', pool_row.yes::text, 'no', pool_row.no::text),
								'reservesAfter',   jsonb_build_object(
									'yes', r.yes::numeric(38,18)::text,
									'no',  r.no::numeric(38,18)::text),
								'backingMinted',   r.backing::numeric(38,18)::text,
								'discardedSide',   CASE WHEN r.d_yes > 0 THEN 'YES' ELSE 'NO' END,
								'discardedShares', GREATEST(r.d_yes, r.d_no)::numeric(38,18)::text,
								'priceYesBefore',  v_price::numeric(38,18)::text,
								'priceYesAfter',   (r.no / (r.yes + r.no))::numeric(38,18)::text
							),
							1,
							-- The seven-field metadata set, following the
							-- sweep-orphans.ts system-actor precedent. request_id is
							-- the TICK's run_id, so every row of one sweep shares it
							-- and a reader can group a sweep without guessing.
							jsonb_build_object(
								'request_id', v_run_id::text,
								'flow_id', 'F-CRON-LIQUIDITY-INJECT',
								'user_id', NULL,
								'actor_id', 'system',
								'idempotency_key', NULL,
								'ip', 'pg_cron',
								'user_agent', 'pg_cron'
							),
							v_created_at);

						-- LAST statement in the block, deliberately: a plpgsql
						-- variable is NOT rolled back with its subtransaction, so
						-- incrementing earlier would let the heartbeat report an
						-- injection that never landed.
						v_injected := v_injected + 1;
					END IF;
				END IF;
			END IF;
		EXCEPTION
			-- 55P03. A bet holds the row — the normal case. The trigger is still
			-- true and the next tick is 60 s away, so a skipped market self-heals
			-- and there is nothing to retry inside this tick.
			WHEN lock_not_available THEN
				NULL;
			-- Anything else is news. Record it and keep sweeping: one bad market
			-- must not cost the other seven, and an error swallowed with no row
			-- behind it is the exact invisibility this whole task exists to end.
			WHEN OTHERS THEN
				INSERT INTO cron_alarms (alarm_id, payload) VALUES (
					'liquidity_injection_error',
					jsonb_build_object(
						'run_id', v_run_id::text,
						'market_id', m.id::text,
						'sqlstate', SQLSTATE,
						'message', SQLERRM));
		END;
	END LOOP;

	INSERT INTO liquidity_heartbeat
		(run_id, policy_version, markets_considered, markets_injected)
	VALUES (v_run_id, v_policy_version, v_considered, v_injected);
END; $$;
--> statement-breakpoint

-- ═══ (d2) check_liquidity_alarms — ADR-0047 §H ══════════════════════════════
--
-- A NEW function rather than an addition to 0011's check_nightly_drift(): a
-- 15-minute concern does not belong on a nightly cadence, and coupling them
-- would mean a change to either one re-deploys the other's body.
CREATE OR REPLACE FUNCTION check_liquidity_alarms()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
	v_enabled boolean;
	v_target  numeric;
BEGIN
	-- R4: silence evaluates ONLY while the newest policy is enabled, so the
	-- deliberate window between the migration applying and the arming INSERT
	-- does not alarm. ⚠ The cost is real and is stated rather than assumed
	-- away: a registration that failed BEFORE arming is not caught here. The
	-- ADR Runbook's "verify a heartbeat within 120 s of arming" is what closes
	-- that gap, and is the reason that line is in the Runbook at all.
	SELECT enabled,
	       GREATEST(floor, coefficient * (SELECT count(*) FROM users))
	INTO v_enabled, v_target
	FROM liquidity_policy
	WHERE effective_from <= now()
	ORDER BY effective_from DESC, version DESC LIMIT 1;

	IF NOT FOUND OR NOT v_enabled THEN
		RETURN;
	END IF;

	-- SILENCE. Edge-triggered through watermark_state on 0007's
	-- IS DISTINCT FROM pattern: it fires once per EPISODE, not once every five
	-- minutes for as long as the outage lasts. An alarm that repeats is an
	-- alarm that gets muted.
	WITH new_state AS (
		SELECT CASE WHEN EXISTS (
			SELECT 1 FROM liquidity_heartbeat
			WHERE ran_at > now() - interval '15 minutes'
		) THEN 'above' ELSE 'below' END AS s
	),
	upsert AS (
		INSERT INTO watermark_state (metric, state)
		SELECT 'liquidity_silence', ns.s FROM new_state ns
		ON CONFLICT (metric) DO UPDATE
			SET state = EXCLUDED.state, since = now()
			WHERE watermark_state.state IS DISTINCT FROM EXCLUDED.state
		RETURNING state
	)
	INSERT INTO cron_alarms (alarm_id, payload)
	SELECT 'liquidity_silence',
	       jsonb_build_object('state', u.state, 'window_minutes', 15)
	FROM upsert u WHERE u.state = 'below';

	-- UNDERSHOOT: any Open market below 60% of target. INTEGER ARITHMETIC for
	-- the threshold, per 0007's own header comment (`unassigned * 20 < total`,
	-- deliberately avoiding floating point): tank * 5 < target * 3, never 0.6 *.
	--
	-- ⚠ The 60-MINUTE half of ADR §H's condition is NOT tested here, and that
	-- is deliberate: watermark_state.since already records when the episode
	-- began, so the duration belongs to the drain handler reading the alarm
	-- rather than to a function that runs every five minutes and would have to
	-- re-derive it. What makes that checkable is `since` moving on the
	-- transition and NOT moving on a repeat tick — which is what the ON CONFLICT
	-- WHERE clause above buys, and what the alarms spec asserts.
	WITH under AS (
		SELECT m.id
		FROM markets m JOIN pools po ON po.market_id = m.id
		WHERE m.status = 'Open'
		  AND (po.yes_reserves + po.no_reserves) * 5 < v_target * 3
	),
	new_state AS (
		SELECT CASE WHEN EXISTS (SELECT 1 FROM under) THEN 'below' ELSE 'above' END AS s
	),
	upsert AS (
		INSERT INTO watermark_state (metric, state)
		SELECT 'liquidity_undershoot', ns.s FROM new_state ns
		ON CONFLICT (metric) DO UPDATE
			SET state = EXCLUDED.state, since = now()
			WHERE watermark_state.state IS DISTINCT FROM EXCLUDED.state
		RETURNING state, since
	)
	INSERT INTO cron_alarms (alarm_id, payload)
	SELECT 'liquidity_undershoot',
	       jsonb_build_object('state', u.state,
	                          'markets', (SELECT count(*) FROM under),
	                          'target', v_target::text)
	FROM upsert u WHERE u.state = 'below';
END; $$;
--> statement-breakpoint

-- ═══ (e) The initial policy row — enabled = false, OD-4 / R4 ════════════════
--
-- ADR §G's values, with `enabled` inverted for the reason ADR §G now carries in
-- full: ADR-0024 applies this migration to production BEFORE the code that can
-- read what the injector writes is promoted. Arming is one INSERT after the
-- promote — the mechanism §G already prescribes for every other parameter.
--
-- ON CONFLICT DO NOTHING so a re-applied migration is a no-op rather than a
-- 23505; version is UNIQUE and this row is version 1 forever.
INSERT INTO liquidity_policy
	(version, coefficient, floor, trigger_ratio, guard_low, guard_high,
	 endgame_hours, lock_timeout_ms, enabled, effective_from)
VALUES (1, 500, 100000, 0.80, 0.02, 0.95, 72, 100, false, now())
ON CONFLICT (version) DO NOTHING;
--> statement-breakpoint

-- ═══ (f) The two registrations ══════════════════════════════════════════════
--
-- pg_cron registration follows, stripped by CI on vanilla postgres:17 (the
-- ci.yml *pg_cron* strip). Both patterns are ^-anchored and the terminator is
-- exactly ^);$ — which is why each block starts at COLUMN 0 and closes on a
-- bare `);` with no indentation and no trailing comment. Everything above this
-- point is preserved and applied by CI, which is what makes both functions
-- directly testable there (0011's precedent).
--
-- No CREATE EXTENSION: 0007 owns pg_cron, and 0011:22 says so explicitly.
--
-- '* * * * *' is one minute — pg_cron's finest cron granularity, and exactly
-- the ADR's 60 s INTERVAL. Both live jobs use 5-field cron; pg_cron's interval
-- syntax is deliberately not reached for.
SELECT cron.schedule(
	'liquidity-injector',
	'* * * * *',
	$$SELECT run_liquidity_injection()$$
);
--> statement-breakpoint
SELECT cron.schedule(
	'liquidity-alarms',
	'*/5 * * * *',
	$$SELECT check_liquidity_alarms()$$
);
