-- 0007_pg_cron_jobs.sql — SCAFFOLD.17
-- Schedules the identity-pool low-watermark check (alarm 5 per
-- ADR-0007 §4 — decision name) via pg_cron. State-row +
-- transition-detection pattern (research brief R3) fires the alarm
-- exactly once per below-threshold episode regardless of cron tick
-- frequency.
--
-- Per ADR-0006 §6 + research brief R1: pg_cron cannot emit HTTP
-- directly (pg_net rejected). The job INSERTs into `cron_alarms`
-- queue table; SCAFFOLD.5 ships the Vercel Cron drain handler that
-- reads `processed_at IS NULL` rows and emits Sentry events.
--
-- Threshold: 5% unassigned = `unassigned * 20 < total` (integer
-- arithmetic; avoids floating-point per research brief R3).

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS watermark_state (
	metric text PRIMARY KEY,
	state text NOT NULL CHECK (state IN ('above','below')),
	since timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS cron_alarms (
	id bigserial PRIMARY KEY,
	alarm_id text NOT NULL,
	payload jsonb NOT NULL,
	emitted_at timestamptz NOT NULL DEFAULT now(),
	processed_at timestamptz NULL
);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION check_identity_pool_watermark()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
	WITH counts AS (
		SELECT
			count(*) FILTER (WHERE assigned_at IS NULL) AS unassigned,
			count(*) AS total
		FROM identity_pool
	),
	new_state AS (
		SELECT
			CASE WHEN unassigned * 20 < total THEN 'below' ELSE 'above' END AS s,
			unassigned,
			total
		FROM counts
	),
	transition AS (
		UPDATE watermark_state w
		SET state = ns.s, since = now()
		FROM new_state ns
		WHERE w.metric = 'identity_pool_unassigned'
			AND w.state IS DISTINCT FROM ns.s
		RETURNING w.metric, w.state
	)
	INSERT INTO cron_alarms (alarm_id, payload)
	SELECT
		'identity_pool_low_watermark',
		jsonb_build_object(
			'state', t.state,
			'unassigned', ns.unassigned,
			'total', ns.total
		)
	FROM transition t, new_state ns
	WHERE t.state = 'below';
END;
$$;
--> statement-breakpoint

INSERT INTO watermark_state (metric, state)
VALUES ('identity_pool_unassigned', 'above')
ON CONFLICT (metric) DO NOTHING;
--> statement-breakpoint

SELECT cron.schedule(
	'identity-pool-watermark',
	'*/5 * * * *',
	$$SELECT check_identity_pool_watermark()$$
);
