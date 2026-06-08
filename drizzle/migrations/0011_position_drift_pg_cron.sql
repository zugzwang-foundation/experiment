-- 0011_position_drift_pg_cron.sql — ENGINE.11 (R-1/R-2/R-6)
-- Nightly drift-detection cron. Mirrors the 0007_pg_cron_jobs.sql pattern:
-- a plpgsql function INSERTs into the `cron_alarms` queue table (0007); the
-- SCAFFOLD.5 Vercel-Cron drain handler reads `processed_at IS NULL` rows and
-- emits Sentry events (the loud carry-forward — HARDEN-adjacent).
--
-- check_nightly_drift() runs THREE order-free identities (ADR-0016 Driver 7 —
-- no reliance on UUID/created_at ordering), each conditionally alarming:
--   D1 — positions vs events-canonical replay (Σ bet.placed.shares −
--        Σ bet.sold.sharesSold, folded from the Bucket-A `events` log,
--        ADR-0005 Pattern A; keyed per (user,market,side)).
--   D2 — per-user dharma chain integrity, TWO independent derivations that
--        alarm separately (D2-A SUM identity; D2-B edge-link + genesis
--        cardinality). `uncollectable` carve-out per the ENGINE.5 model
--        (amount ≤ 0, balance_after = previous).
--   D3 — single-side belt (defense-in-depth, delegated call 1): a (user,market)
--        with two quantity>0 rows. Structurally impossible under
--        positions_one_held_side_idx (0010); a tripwire if that index is ever
--        dropped/absent.
--
-- Cadence is a PLACEHOLDER ('0 3 * * *'); final value is HARDEN per ADR-0006 §7
-- (no number-pinning). NO `CREATE EXTENSION` — 0007 owns pg_cron; this migration
-- runs after 0007 in prod. The `SELECT cron.schedule(...)` line is stripped by
-- CI before applying on vanilla postgres:17 (ci.yml *pg_cron* strip); the
-- check_nightly_drift() function + cron_alarms INSERTs are plain plpgsql,
-- CI-preserved and directly testable via `SELECT check_nightly_drift()`.
--
-- Operator manual nightly-drift check (until the SCAFFOLD.5 drain-and-emit lands):
--   SELECT alarm_id, payload, emitted_at
--   FROM cron_alarms
--   WHERE alarm_id IN ('position_drift','dharma_chain_drift','single_side_violation')
--     AND processed_at IS NULL
--   ORDER BY emitted_at DESC;

CREATE OR REPLACE FUNCTION check_nightly_drift()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
	-- ── D1: positions vs events-canonical replay (per user_id, market_id, side) ──
	-- replay = Σ bet.placed.shares − Σ bet.sold.sharesSold, keyed on the PAYLOAD
	-- fields (aggregate_id is cosmetic, NOT the fold key). FULL OUTER JOIN so a
	-- position without a matching replay (or a replay without a position) also
	-- surfaces. discrepancy = actual − expected (positive ⇒ stored exceeds
	-- replay). All numeric (exact; no float — CLAUDE.md §2); order-free.
	INSERT INTO cron_alarms (alarm_id, payload)
	WITH replay AS (
		SELECT
			(payload->>'userId')::uuid   AS user_id,
			(payload->>'marketId')::uuid AS market_id,
			(payload->>'side')           AS side,
			SUM(
				CASE event_type
					WHEN 'bet.placed' THEN  (payload->>'shares')::numeric
					WHEN 'bet.sold'   THEN -(payload->>'sharesSold')::numeric
				END
			) AS replayed
		FROM events
		WHERE event_type IN ('bet.placed', 'bet.sold')
		GROUP BY 1, 2, 3
	),
	recon AS (
		SELECT
			COALESCE(p.user_id, r.user_id)     AS user_id,
			COALESCE(p.market_id, r.market_id) AS market_id,
			COALESCE(p.side::text, r.side)     AS side,
			COALESCE(p.quantity, 0)            AS actual,
			COALESCE(r.replayed, 0)            AS expected
		FROM positions p
		FULL OUTER JOIN replay r
			ON p.user_id = r.user_id
			AND p.market_id = r.market_id
			AND p.side::text = r.side
	)
	SELECT
		'position_drift',
		jsonb_build_object(
			'user_id',     user_id,
			'market_id',   market_id,
			'side',        side,
			'expected',    expected::numeric(38, 18)::text,
			'actual',      actual::numeric(38, 18)::text,
			'discrepancy', (actual - expected)::numeric(38, 18)::text
		)
	FROM recon
	WHERE actual <> expected;

	-- ── D2-A: per-user dharma chain SUM identity (order-free) ──
	-- implied_prev = (uncollectable ? balance_after : balance_after − amount).
	-- latest_balance = the balance_after whose count in `produced` exceeds its
	-- count in `implied_prev` by exactly one (net = +1 — the unconsumed sink).
	-- A fires if NO unique net=+1 sink (0 or ≥2 candidates) OR
	-- latest_balance ≠ Σ(non-uncollectable amount). (ENGINE.5 balance model.)
	INSERT INTO cron_alarms (alarm_id, payload)
	WITH ledger AS (
		SELECT
			user_id,
			entry_type,
			amount,
			balance_after,
			CASE WHEN entry_type = 'uncollectable'
				THEN balance_after
				ELSE balance_after - amount
			END AS implied_prev
		FROM dharma_ledger
	),
	net AS (
		SELECT
			COALESCE(p.user_id, i.user_id)          AS user_id,
			COALESCE(p.val, i.val)                  AS val,
			COALESCE(p.cnt, 0) - COALESCE(i.cnt, 0) AS net
		FROM (
			SELECT user_id, balance_after AS val, count(*) AS cnt
			FROM ledger GROUP BY 1, 2
		) p
		FULL OUTER JOIN (
			SELECT user_id, implied_prev AS val, count(*) AS cnt
			FROM ledger GROUP BY 1, 2
		) i ON p.user_id = i.user_id AND p.val = i.val
	),
	sinks AS (
		SELECT
			user_id,
			count(*) FILTER (WHERE net = 1)            AS sink_count,
			(array_agg(val) FILTER (WHERE net = 1))[1] AS sink_val
		FROM net
		GROUP BY user_id
	),
	sum_nonunc AS (
		SELECT
			user_id,
			COALESCE(SUM(amount) FILTER (WHERE entry_type <> 'uncollectable'), 0) AS s
		FROM ledger
		GROUP BY user_id
	)
	SELECT
		'dharma_chain_drift',
		jsonb_build_object('user_id', s.user_id, 'derivation', 'D2-A')
	FROM sinks s
	JOIN sum_nonunc sn ON sn.user_id = s.user_id
	WHERE s.sink_count <> 1
		OR s.sink_val IS DISTINCT FROM sn.s;

	-- ── D2-B: per-user dharma chain edge-link integrity + genesis cardinality ──
	-- B fires if (i) any non-genesis (implied_prev ≠ 0) row has no DISTINCT
	-- predecessor row with balance_after = implied_prev (broken link), OR
	-- (ii) the user does not have EXACTLY ONE genesis row (implied_prev = 0).
	-- Clause (ii) is the A1 fix — a duplicated genesis slips past (i). The
	-- `d.id <> l.id` guard forces a 0-amount loss to find a DISTINCT same-balance
	-- predecessor. Order-free.
	INSERT INTO cron_alarms (alarm_id, payload)
	WITH ledger AS (
		SELECT
			id,
			user_id,
			balance_after,
			CASE WHEN entry_type = 'uncollectable'
				THEN balance_after
				ELSE balance_after - amount
			END AS implied_prev
		FROM dharma_ledger
	),
	broken_link AS (
		SELECT DISTINCT l.user_id
		FROM ledger l
		WHERE l.implied_prev <> 0
			AND NOT EXISTS (
				SELECT 1 FROM dharma_ledger d
				WHERE d.user_id = l.user_id
					AND d.id <> l.id
					AND d.balance_after = l.implied_prev
			)
	),
	bad_genesis AS (
		SELECT user_id
		FROM ledger
		GROUP BY user_id
		HAVING count(*) FILTER (WHERE implied_prev = 0) <> 1
	),
	b_fire AS (
		SELECT user_id FROM broken_link
		UNION
		SELECT user_id FROM bad_genesis
	)
	SELECT
		'dharma_chain_drift',
		jsonb_build_object('user_id', user_id, 'derivation', 'D2-B')
	FROM b_fire;

	-- ── D3: single-side belt (defense-in-depth; delegated call 1 = include) ──
	-- Structurally impossible under positions_one_held_side_idx (0010); fires
	-- only if that index is dropped/absent on a mis-applied environment.
	INSERT INTO cron_alarms (alarm_id, payload)
	SELECT
		'single_side_violation',
		jsonb_build_object('user_id', user_id, 'market_id', market_id)
	FROM positions
	WHERE quantity > 0
	GROUP BY user_id, market_id
	HAVING count(*) > 1;
END;
$$;
-- pg_cron registration follows (stripped by CI on vanilla postgres:17 —
-- ci.yml *pg_cron* strip). Cadence PLACEHOLDER (HARDEN, ADR-0006 §7).
--> statement-breakpoint
SELECT cron.schedule(
	'nightly-drift',
	'0 3 * * *',
	$$SELECT check_nightly_drift()$$
);
