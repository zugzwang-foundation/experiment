ALTER TABLE "liquidity_policy" ADD CONSTRAINT "liquidity_policy_lock_timeout_ceiling" CHECK ("liquidity_policy"."lock_timeout_ms" <= 250);--> statement-breakpoint
ALTER TABLE "liquidity_policy" ADD CONSTRAINT "liquidity_policy_endgame_ceiling" CHECK ("liquidity_policy"."endgame_hours" <= 8760);
--> statement-breakpoint

-- ═══ run_liquidity_injection — REPLACED (@db-migration-reviewer MEDIUM-1) ════
--
-- `0027`'s body is unchanged except for one thing: the market's STATUS is now
-- read INSIDE the row lock and re-checked, instead of being trusted from the
-- cursor's snapshot.
--
-- ⛔ WHY IT MATTERS, AND WHY IT IS A MONEY-PATH FIX RATHER THAN TIDYING. The
-- loop's cursor takes a READ COMMITTED snapshot at loop start. `0027` then did
-- `PERFORM 1 FROM markets WHERE id = m.id FOR NO KEY UPDATE` — which fetches the
-- CURRENT row and throws away every column of it, including the one that would
-- have settled this. A market that moved `Open → Resolving / Closed / Voided`
-- between the snapshot and the lock was still injected.
--
-- The consequence lands on a terminal, append-only row. `settleMarket` and
-- `voidMarket` read the pool and sum `pool.liquidity_added` under the pool lock;
-- an injection that commits AFTER that sum was taken adds backing the payout row
-- does not account for, and there is no edge out of `Resolved` to correct it.
-- The window is sub-second, once a minute, and needs a concurrent admin action —
-- low probability, unbounded consequence.
--
-- ⚠ `0027`'s own test for this (`only-Open-markets-are-touched`) exercises the
-- CURSOR FILTER, not the TRANSITION, which is why it passed against the gap.
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
BEGIN
	-- Transaction-scoped: the whole sweep is one transaction (R8), so this
	-- releases on ERROR as well as on commit. There is no COMMIT in this body,
	-- and therefore nowhere to put an unlock that would run on the error path —
	-- the session-scoped form would leak on every exception, not merely on the
	-- Runbook's hand-run.
	IF NOT pg_try_advisory_xact_lock(hashtext('zugzwang.liquidity_injector')) THEN
		RETURN;
	END IF;

	SELECT * INTO p FROM liquidity_policy
	WHERE effective_from <= now()
	ORDER BY effective_from DESC, version DESC LIMIT 1;

	v_policy_version := p.version;

	-- The heartbeat is evidence the JOB RAN, never evidence it injected, so it is
	-- written on every tick that reaches here — disabled, frozen and no-policy
	-- included (R4). Conflating "quiet on purpose" with "stopped" is what makes a
	-- dead cron invisible.
	IF NOT FOUND OR NOT p.enabled
	   OR EXISTS (SELECT 1 FROM system_state WHERE frozen_at IS NOT NULL) THEN
		INSERT INTO liquidity_heartbeat
			(run_id, policy_version, markets_considered, markets_injected)
		VALUES (v_run_id, v_policy_version, 0, 0);
		RETURN;
	END IF;

	-- ONCE, at the top: no COMMIT resets it, and a rolled-back subtransaction
	-- does not clear it either (measured on 17.6).
	--
	-- ⚠ THE SAFE VALUE DEPENDS ON A NUMBER THIS FUNCTION DOES NOT CONTROL. The
	-- sweep holds a pool row from lock to sweep-end, so a bet waiting on the
	-- first market can wait (open_markets − 1) × lock_timeout_ms against its own
	-- non-retryable 1,000 ms statement_timeout. `liquidity_policy_lock_timeout_ceiling`
	-- catches a typo; the ADR §Runbook carries the exact invariant. Measured
	-- 2026-09-07: staging carries TEN Open markets, not the eight the plan
	-- reasons from.
	EXECUTE format('SET LOCAL lock_timeout = %s', p.lock_timeout_ms);

	SELECT count(*) INTO v_users FROM users;
	v_target := GREATEST(p.floor, p.coefficient * v_users);

	FOR m IN
		SELECT id, resolution_deadline FROM markets WHERE status = 'Open'
		ORDER BY id
	LOOP
		v_considered := v_considered + 1;

		CONTINUE WHEN now() + make_interval(hours => p.endgame_hours)
		              >= m.resolution_deadline;

		BEGIN
			-- markets -> pools, the canonical order (ADR-0013 P2/P3).
			--
			-- ⚠ THE STATUS COMES BACK FROM THIS LOCK AND IS RE-CHECKED. The cursor
			-- above read it from a snapshot taken before any lock was held; between
			-- then and now an admin may have closed, voided or begun resolving this
			-- market. `0027` discarded the locked row's columns and injected anyway.
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
									-- L-4: derived from which side is SHORT, not from which
									-- discard is non-zero. `zz_add_liquidity` puts the
									-- residual on the short side and ties to yes-long, so
									-- this names the same side it assigned — including when
									-- the discard is exactly zero, where testing the
									-- magnitude only picks a bias rather than an answer.
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

							-- LAST statement in the block: a plpgsql variable is not
							-- rolled back with its subtransaction.
							v_injected := v_injected + 1;
						END IF;
					END IF;
				END IF;
			END IF;
		EXCEPTION
			-- 55P03. A bet holds the row — the normal case. The trigger is still
			-- true and the next tick is 60 s away, so a skipped market self-heals.
			WHEN lock_not_available THEN
				NULL;
			-- Anything else is news. ⚠ This row's durability is conditional on the
			-- REST of the sweep committing: under R8 there is no per-market COMMIT
			-- to make it durable on its own, so an abort outside a subtransaction
			-- takes it with everything else (L-6).
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
