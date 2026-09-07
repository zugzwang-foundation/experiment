ALTER TABLE "liquidity_policy" DROP CONSTRAINT "liquidity_policy_bounds";--> statement-breakpoint
ALTER TABLE "liquidity_policy" DROP CONSTRAINT "liquidity_policy_lock_timeout_ceiling";--> statement-breakpoint
ALTER TABLE "liquidity_policy" DROP CONSTRAINT "liquidity_policy_endgame_ceiling";--> statement-breakpoint
ALTER TABLE "liquidity_policy" ADD CONSTRAINT "liquidity_policy_floor_ceiling" CHECK ("liquidity_policy"."floor" <= 10000000);--> statement-breakpoint
ALTER TABLE "liquidity_policy" ADD CONSTRAINT "liquidity_policy_coefficient_ceiling" CHECK ("liquidity_policy"."coefficient" <= 100000);--> statement-breakpoint
ALTER TABLE "liquidity_policy" ADD CONSTRAINT "liquidity_policy_bounds" CHECK ("liquidity_policy"."coefficient" > 0 AND "liquidity_policy"."floor" > 0
				AND "liquidity_policy"."trigger_ratio" > 0 AND "liquidity_policy"."trigger_ratio" < 1
				AND "liquidity_policy"."guard_low" > 0 AND "liquidity_policy"."guard_high" < 1
				AND "liquidity_policy"."guard_low" < "liquidity_policy"."guard_high"
				AND "liquidity_policy"."endgame_hours" >= 0 AND "liquidity_policy"."lock_timeout_ms" > 0);--> statement-breakpoint
ALTER TABLE "liquidity_policy" ADD CONSTRAINT "liquidity_policy_lock_timeout_ceiling" CHECK ("liquidity_policy"."lock_timeout_ms" <= 100);--> statement-breakpoint
ALTER TABLE "liquidity_policy" ADD CONSTRAINT "liquidity_policy_endgame_ceiling" CHECK ("liquidity_policy"."endgame_hours" <= 168);
--> statement-breakpoint

-- ═══ run_liquidity_injection — REPLACED again (@security-auditor H-1) ═══════
--
-- ⛔ THE CEILING WAS NOT ENOUGH, AND THE MEASUREMENT IS WHY.
--
-- The sweep is ONE transaction (R8), so a pool row locked at the first market
-- stays locked until the last finishes. A bet waiting on it has a 1,000 ms
-- `statement_timeout` whose `57014` is NOT in RETRYABLE_SQLSTATES — the bet does
-- not retry, it fails. Measured, 8 Open markets with 7 pool rows held:
--
--     lock_timeout_ms = 100  → sweep   735 ms
--     lock_timeout_ms = 250  → sweep 1,776 ms
--     a bet-shaped statement on market 1 → 57014 at 1,004 ms
--
-- Extrapolated to staging's MEASURED ten Open markets at the shipped 100 ms:
-- ~945 ms against a 1,000 ms budget. **~55 ms of margin, and reachable by a
-- participant** — keep bets in flight across the other markets and the injector
-- burns its full lock_timeout on each one.
--
-- A CHECK cannot close this: it cannot see the market count, and the count is
-- not ours to fix (it has already drifted from the plan's eight to ten). So the
-- bound moves into the sweep itself, where it holds for ANY market count and ANY
-- legal timeout.
--
-- ⚠ THE COST IS STATED: under sustained contention the sweep stops early and the
-- markets after the cut-off are not topped up this tick. That is the design's own
-- self-healing argument, unchanged — the trigger is still true, the next tick is
-- 60 s away, and a market busy enough to exhaust the budget is a market being
-- actively traded rather than one starved of depth. `ORDER BY id` means it is the
-- same late markets each time, so a SUSTAINED squeeze could keep one thin;
-- `liquidity_undershoot` is the signal for exactly that, and it is why that alarm
-- is not decoration.
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
	v_status         text;
	v_tank           numeric; v_price numeric; v_a numeric;
	r                record;
	v_event_id       uuid; v_created_at timestamptz;
	-- The budget clock. `clock_timestamp()` and NOT `now()`: `now()` is the
	-- transaction start and never advances, so a budget measured with it would be
	-- zero forever — a guard that cannot fire.
	v_lock_started   timestamptz;
	-- 600 ms of lock-holding, against the bet path's non-retryable 1,000 ms.
	-- Worst-case overshoot is one more market after the last check — its
	-- lock_timeout (≤100 ms) plus its work — so ~750 ms, inside the budget with
	-- room for the final heartbeat INSERT.
	v_budget         interval := interval '600 milliseconds';
BEGIN
	IF NOT pg_try_advisory_xact_lock(hashtext('zugzwang.liquidity_injector')) THEN
		RETURN;
	END IF;

	SELECT * INTO p FROM liquidity_policy
	WHERE effective_from <= now()
	ORDER BY effective_from DESC, version DESC LIMIT 1;

	v_policy_version := p.version;

	-- The heartbeat is evidence the JOB RAN, never that it injected (R4).
	IF NOT FOUND OR NOT p.enabled
	   OR EXISTS (SELECT 1 FROM system_state WHERE frozen_at IS NOT NULL) THEN
		INSERT INTO liquidity_heartbeat
			(run_id, policy_version, markets_considered, markets_injected)
		VALUES (v_run_id, v_policy_version, 0, 0);
		RETURN;
	END IF;

	EXECUTE format('SET LOCAL lock_timeout = %s', p.lock_timeout_ms);

	SELECT count(*) INTO v_users FROM users;
	v_target := GREATEST(p.floor, p.coefficient * v_users);

	-- Started AFTER the count, because the count takes no row locks and holding
	-- nothing costs nobody anything. The budget bounds the LOCK HOLD, not the
	-- function.
	v_lock_started := clock_timestamp();

	FOR m IN
		SELECT id, resolution_deadline FROM markets WHERE status = 'Open'
		ORDER BY id
	LOOP
		-- ⛔ THE BUDGET, CHECKED BEFORE TAKING ANOTHER LOCK. Everything already
		-- locked stays locked until this transaction ends, so the only thing that
		-- can still be given back is the lock not yet taken.
		EXIT WHEN clock_timestamp() - v_lock_started > v_budget;

		v_considered := v_considered + 1;

		CONTINUE WHEN now() + make_interval(hours => p.endgame_hours)
		              >= m.resolution_deadline;

		BEGIN
			-- The status is re-read INSIDE the lock (0028): the cursor's snapshot
			-- predates every lock, and a market can move Open → Resolving / Closed
			-- / Voided in between.
			SELECT status::text INTO v_status
			FROM markets WHERE id = m.id FOR NO KEY UPDATE;

			IF v_status = 'Open' THEN
				SELECT yes_reserves AS yes, no_reserves AS no
				INTO pool_row FROM pools WHERE market_id = m.id FOR NO KEY UPDATE;

				IF FOUND THEN
					v_tank  := pool_row.yes + pool_row.no;
					v_price := pool_row.no / v_tank;

					IF v_tank < p.trigger_ratio * v_target
					   AND v_price <= p.guard_high
					   AND v_price >= p.guard_low THEN

						v_a := GREATEST(pool_row.yes, pool_row.no)
						       * (v_target / v_tank - 1);

						IF v_a > 0 THEN
							SELECT * INTO r
							FROM zz_add_liquidity(pool_row.yes, pool_row.no, v_a);

							UPDATE pools
							SET yes_reserves = r.yes::numeric(38,18),
							    no_reserves  = r.no::numeric(38,18)
							WHERE market_id = m.id;

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
									'discardedSide',   CASE WHEN pool_row.yes >= pool_row.no
									                        THEN 'NO' ELSE 'YES' END,
									'discardedShares', GREATEST(r.d_yes, r.d_no)::numeric(38,18)::text,
									'priceYesBefore',  v_price::numeric(38,18)::text,
									'priceYesAfter',   (r.no / (r.yes + r.no))::numeric(38,18)::text
								),
								1,
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

							v_injected := v_injected + 1;
						END IF;
					END IF;
				END IF;
			END IF;
		EXCEPTION
			WHEN lock_not_available THEN
				NULL;
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
