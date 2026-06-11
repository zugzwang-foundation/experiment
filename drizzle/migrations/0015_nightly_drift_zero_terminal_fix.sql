-- 0015_nightly_drift_zero_terminal_fix.sql — ENGINE.9 (D-1, both halves; OQ-5
-- RATIFIED as RIDE; same-commit doctrine)
-- Corrects TWO zero-terminal false-positive clauses in 0011's
-- check_nightly_drift() so the mandated zero-alarms drift charter is achievable
-- once R-9.6 floored clawbacks park users at exactly 0 (latent today via
-- spend-to-exactly-zero). 0011 is append-only and NOT edited; this migration
-- re-states the FULL function via CREATE OR REPLACE (the 0007→0011
-- function-replace precedent). The 0011 cron.schedule('nightly-drift', …)
-- registration persists and resolves to the replaced body by name; no pg_cron
-- statement appears here (filename is deliberately not *pg_cron* — nothing for
-- the ci.yml strip to touch).
--
-- The defect, derived. Notation per user: each ledger row r has
-- ip(r) = implied_prev (balance_after − amount, or balance_after for
-- uncollectable) and ba(r) = balance_after; a valid chain r1..rn has
-- ip(r1) = 0 (genesis) and ip(r_{i+1}) = ba(r_i).
--
--   D2-B genesis cardinality. Z := count(ip = 0), L := count(ba = 0):
--     Z = 1 + #{ i < n : ba(r_i) = 0 }   (genesis + every row chained off zero)
--     L = #{ i < n : ba(r_i) = 0 } + [ba(r_n) = 0]
--     ⇒ Z − L = 1 − [terminal row sits at 0] — legitimate values {0, 1}.
--   The 0011 clause (Z <> 1) false-alarms every chain that EVER touched zero.
--   Corrected: (Z − L) NOT IN (0, 1) — relaxed cardinality.
--
--   D2-A sink. Multiset identity for a valid chain:
--   multiset(ip) = multiset(ba) − {ba(r_n)} + {0}, so per value v,
--   net(v) := count(ba = v) − count(ip = v) = [v = ba(r_n)] − [v = 0]:
--     terminal ≠ 0 → net(terminal) = +1 (the unique sink), net(0) = −1, all
--       else 0 — the 0011 check (sink_count = 1 AND sink = Σ non-uncollectable
--       amounts) is correct;
--     terminal = 0 → the genesis consumption absorbs the terminal zero: ALL
--       nets are 0, NO net=+1 sink exists, and Σ non-uncollectable amounts
--       (which telescopes to the terminal balance) = 0. 0011's
--       `sink_count <> 1` FIRES — a false alarm on every parked-at-zero user,
--       including spend-to-zero-and-stop. Corrected firing condition:
--       NOT (   (sink_count = 1 AND sink_val IS NOT DISTINCT FROM s)
--            OR (sink_count = 0 AND COALESCE(s, 0) = 0) )
--       The COALESCE guards the zero-sink branch against a NULL sum (F-4): an
--       all-uncollectable chain is product-impossible (every user's first row
--       is the grant) and the sum_nonunc CTE already COALESCEs — but the SQL
--       must not rely on NULL propagation.
--
-- Residual blind spots, stated (accepted — drift detection is belt, storage
-- triggers + app logic are primary): (1) a fabricated genesis row (implied_prev
-- = 0, i.e. amount = balance_after; or an uncollectable row at balance 0)
-- appended to a chain whose terminal sits at 0 yields Z − L = 1 AND the valid
-- net pattern — it is multiset-identical to a legitimate credit-after-zero
-- history and therefore invisible to EVERY order-free check by construction
-- (the same fundamental limit as the cycle case below, not a separate one).
-- Corrected D2-A catches a duplicate genesis only when it produces a second
-- net=+1 sink (terminal ≠ 0) — where corrected D2-B fires anyway (Z − L = 2).
-- A fabricated row whose amount ≠ balance_after is not a genesis at all
-- (implied_prev ≠ 0) and is caught by D2-B's edge-link clause (i). The most
-- plausible concrete source, a duplicate initial_grant, is independently
-- foreclosed by dharma_ledger_initial_grant_user_uq (0013). (2) a fabricated
-- balance-neutral CYCLE of rows (each member's ip = another's ba, telescoping
-- to 0) is invisible to ALL order-free multiset checks — D2-B's edge-link
-- clause (i) is satisfied within the cycle, nets stay 0. This is the
-- fundamental limit of order-free verification (ADR-0016 Driver 7 forbids
-- created_at ordering reliance — tx-frozen now(); UUIDv7 trailing-bit
-- randomness forbids id ordering); accepted and documented here.
--
-- D1 (positions replay), D3 (single-side belt), and D2-B's edge-link clause (i)
-- are byte-identical to 0011 — detection is NOT weakened (the I2 positive
-- controls pin this live: broken link and duplicate-genesis fixtures still
-- ALARM under this body).

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
	-- terminal ≠ 0: the balance_after whose count in `produced` exceeds its
	-- count in `implied_prev` by exactly one (net = +1) is the unconsumed sink
	-- and must equal Σ(non-uncollectable amount). terminal = 0: the genesis
	-- consumption absorbs the terminal zero — NO net=+1 sink exists and the
	-- sum telescopes to 0 (the 0015 zero-terminal branch — D-1 extension).
	-- A fires on anything else: ≥2 sinks, a sink ≠ the sum, or a sinkless
	-- chain with a non-zero sum. (ENGINE.5 balance model.)
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
	WHERE NOT (
		(s.sink_count = 1 AND s.sink_val IS NOT DISTINCT FROM sn.s)
		OR (s.sink_count = 0 AND COALESCE(sn.s, 0) = 0)
	);

	-- ── D2-B: per-user dharma chain edge-link integrity + genesis cardinality ──
	-- B fires if (i) any non-genesis (implied_prev ≠ 0) row has no DISTINCT
	-- predecessor row with balance_after = implied_prev (broken link), OR
	-- (ii) Z − L ∉ {0, 1}, where Z = count(implied_prev = 0) and
	-- L = count(balance_after = 0): in a valid chain Z − L = 1 − [terminal
	-- sits at 0] (the 0015 relaxed cardinality — D-1; 0011's Z <> 1
	-- false-alarmed every chain that ever touched zero). The `d.id <> l.id`
	-- guard forces a 0-amount loss to find a DISTINCT same-balance
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
		HAVING count(*) FILTER (WHERE implied_prev = 0)
			- count(*) FILTER (WHERE balance_after = 0) NOT IN (0, 1)
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
