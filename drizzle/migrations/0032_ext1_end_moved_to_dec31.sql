-- EXT-1 / D-55 — the experiment's end moves from 2026-11-05 to 2026-12-31 23:45 UTC.
-- Copyright (C) The Zugzwang Authors. AGPL-3.0-or-later.
--
-- DATA ONLY. No DDL: no table, column, index, trigger, function or grant is
-- touched, so meta/0032_snapshot.json is 0031's body under a fresh id (the
-- pattern of 0026 and 0030) and EXPECTED_GUARD_CATALOG_ROWS stays 81.
--
-- WHAT IT DOES, for the six live markets and nothing else:
--   1. moves markets.resolution_deadline to 2026-12-31T23:45:00Z;
--   2. replaces the date words in each description (and in Bitcoin's title)
--      with the founder-signed pairs below, one exact substring at a time;
--   3. appends ONE market.deadline_moved event per market, so the move is in
--      the ledger and not only in a mutable row.
--
-- WHY A MIGRATION AND NOT THE PRODUCT. SPEC.1 B8 says a market's deadline can
-- never be extended, and the product has no path that does it
-- (assertDeadlineNotExtended, unchanged). This is the one ruled exception
-- (D-55, ADR-0067). Doing it here means it happens once per database, inside
-- the deploy's own migrate-before-serve step, and leaves no capability behind.
--
-- WHY IT CANNOT HALF-HAPPEN. The whole file is ONE statement, so both appliers
-- (scripts/apply-migrations-per-tx.ts and drizzle-kit migrate) run it in one
-- transaction: any RAISE below undoes every row and every event. For the same
-- reason this file must never gain a statement separator.
--
-- THE THREE ARMS OF THE PRESENCE GATE.
--   none of the six ids  -> NOTICE, change nothing. CI and every test or
--                           freshly-built database lands here. ⚠ The gate
--                           keys on IDS ONLY: a database holding the same six
--                           slugs under other ids also lands here, does
--                           nothing, and is still recorded as migrated. So a
--                           no-op is not proof of a move — check for the six
--                           market.deadline_moved rows, or the served text.
--   some but not all     -> EXCEPTION. A partial slate is not a state this
--                           migration was signed against.
--   all six              -> lock the six rows and continue.
--
-- EVERY TEXT EDIT IS EXACT-ONCE. Each before-text must occur exactly once in
-- its field, as it did on both environments when the pairs were signed. A
-- pair whose before-text is gone and whose after-text is present exactly once
-- is treated as already applied and skipped. Anything else raises. The
-- postcondition then compares md5(description) (and Bitcoin's title) against
-- the signed after-md5, so a text that drifted by one character aborts the
-- deploy instead of being moved to something nobody approved.
--
-- previousDeadline IS READ FROM THE ROW, never assumed: any instant on
-- 2026-11-05 UTC is accepted, and the event records what was actually there.
--
-- The event INSERT follows 0029's SQL-written precedent: uuidv7 id,
-- created_at derived from its first 48 bits, payload_version 1, and all seven
-- eventMetadataSchema fields. src/server/events/schemas.ts carries the
-- matching market.deadline_moved payload schema in the same commit.
--
-- FORWARD-ONLY. Reversal is a new migration with the reverse pairs and its
-- own event, and is only possible before 2026-11-05 23:45 UTC.

DO $ext1$
DECLARE
	c_new_deadline CONSTANT timestamptz := '2026-12-31T23:45:00Z';
	c_day_from     CONSTANT timestamptz := '2026-11-05T00:00:00Z';
	c_day_to       CONSTANT timestamptz := '2026-11-06T00:00:00Z';
	c_iso          CONSTANT text := 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';
	v_present      integer;
	mk             record;
	p              record;
	v_before       markets%ROWTYPE;
	v_after        markets%ROWTYPE;
	v_title        text;
	v_desc         text;
	v_txt          text;
	v_n_before     integer;
	v_n_after      integer;
	v_event_id     uuid;
	v_created_at   timestamptz;
BEGIN
	SELECT count(*) INTO v_present FROM markets m WHERE m.id IN (
		'01a0a0ba-c700-77bf-8395-7f6bd429e53f',
		'01a0a0ba-d969-7613-a701-0f140bd224b1',
		'01a0a0ba-f3bd-70fe-b5fd-70426431e314',
		'01a0a0bb-0dfb-7793-9ff3-057e1a53c10a',
		'01a0a0bb-3141-71ce-9843-2d98002f8c87',
		'01a0a0bb-7e0b-7182-9944-bba33914d94b'
	);

	IF v_present = 0 THEN
		RAISE NOTICE 'EXT-1 (0032): none of the six markets is present; nothing to move';
		RETURN;
	END IF;
	IF v_present <> 6 THEN
		RAISE EXCEPTION 'EXT-1 (0032): % of the 6 markets are present; refusing a partial move', v_present;
	END IF;

	-- FOR NO KEY UPDATE, not FOR UPDATE: nothing below changes a key column,
	-- and FOR UPDATE is the one strength that conflicts with the KEY SHARE a
	-- bet's comment and bet INSERTs take on their market through the foreign
	-- key. Held across six rows it would stall live bets on the earlier
	-- markets while this waited on a later one (bets/transaction.ts rules the
	-- same way, and 0029 locks these rows at this strength). It still
	-- serialises against close, resolution and the liquidity injector.
	PERFORM 1 FROM markets m WHERE m.id IN (
		'01a0a0ba-c700-77bf-8395-7f6bd429e53f',
		'01a0a0ba-d969-7613-a701-0f140bd224b1',
		'01a0a0ba-f3bd-70fe-b5fd-70426431e314',
		'01a0a0bb-0dfb-7793-9ff3-057e1a53c10a',
		'01a0a0bb-3141-71ce-9843-2d98002f8c87',
		'01a0a0bb-7e0b-7182-9944-bba33914d94b'
	) ORDER BY m.id FOR NO KEY UPDATE;

	FOR mk IN
		SELECT * FROM (VALUES
			('01a0a0ba-c700-77bf-8395-7f6bd429e53f'::uuid, '3b2b3629d7daae859162da65c13e175d'::text, '76a64d3e14f49a3afa0548b12bb18dcb'::text),
			('01a0a0ba-d969-7613-a701-0f140bd224b1'::uuid, '5bedd1bef0d453d1733b4233b7b4eb1b'::text, NULL::text),
			('01a0a0ba-f3bd-70fe-b5fd-70426431e314'::uuid, '93e30bb6ca6859549e42c46f64cd9f59'::text, NULL::text),
			('01a0a0bb-0dfb-7793-9ff3-057e1a53c10a'::uuid, 'c3f860f4cec1c54ce17dac01291b7dc4'::text, NULL::text),
			('01a0a0bb-3141-71ce-9843-2d98002f8c87'::uuid, '68bbb6776caa9ef04b57cff8b1193f2d'::text, NULL::text),
			('01a0a0bb-7e0b-7182-9944-bba33914d94b'::uuid, 'c1fe47fd059ac1b2f4274d32a69f33cc'::text, NULL::text)
		) AS v(id, desc_md5, title_md5)
		ORDER BY v.id
	LOOP
		SELECT * INTO STRICT v_before FROM markets m WHERE m.id = mk.id;

		IF v_before.status <> 'Open' THEN
			RAISE EXCEPTION 'EXT-1 (0032): % is %, not Open', v_before.slug, v_before.status;
		END IF;
		IF v_before.resolution_deadline < c_day_from OR v_before.resolution_deadline >= c_day_to THEN
			RAISE EXCEPTION 'EXT-1 (0032): % has deadline %, which is not on 2026-11-05 UTC',
				v_before.slug, to_char(v_before.resolution_deadline AT TIME ZONE 'UTC', c_iso);
		END IF;

		v_title := v_before.title;
		v_desc  := v_before.description;

		FOR p IN
			SELECT * FROM (VALUES
				-- BTC T1
				('01a0a0ba-c700-77bf-8395-7f6bd429e53f'::uuid, 1, 'title', $t$by 5th November?$t$, $t$by 31st December?$t$),
				-- BTC D1
				('01a0a0ba-c700-77bf-8395-7f6bd429e53f'::uuid, 2, 'description', $t$between 15th September 2026 and 5th November 2026, as measured$t$, $t$between 15th September 2026 and 31st December 2026, as measured$t$),
				-- BTC D2
				('01a0a0ba-c700-77bf-8395-7f6bd429e53f'::uuid, 3, 'description', $t$on any date from 15 September to 5 November 2026 inclusive.$t$, $t$on any date from 15 September to 31 December 2026 inclusive.$t$),
				-- BTC D3
				('01a0a0ba-c700-77bf-8395-7f6bd429e53f'::uuid, 4, 'description', $t$The window is the 52 UTC calendar dates from 15 September 2026 to 5 November 2026 inclusive.$t$, $t$The window is the 108 UTC calendar dates from 15 September 2026 to 31 December 2026 inclusive.$t$),
				-- BTC D4
				('01a0a0ba-c700-77bf-8395-7f6bd429e53f'::uuid, 5, 'description', $t$DEADLINE. Trading closes and settlement occurs at 2026-11-05T23:45:00Z.$t$, $t$DEADLINE. Trading closes and settlement occurs at 2026-12-31T23:45:00Z, moved from 5 November 2026 by ruling D-55 (11 October 2026).$t$),
				-- BTC D5
				('01a0a0ba-c700-77bf-8395-7f6bd429e53f'::uuid, 6, 'description', $t$(c) The 5 November daily low is binding as published;$t$, $t$(c) The 31 December daily low is binding as published;$t$),
				-- BTC D6
				('01a0a0ba-c700-77bf-8395-7f6bd429e53f'::uuid, 7, 'description', $t$the full daily-low series for all 52 dates in the window$t$, $t$the full daily-low series for all 108 dates in the window$t$),
				-- CHE D1
				('01a0a0ba-d969-7613-a701-0f140bd224b1'::uuid, 1, 'description', $t$respond publicly on X by 5 November 2026 to$t$, $t$respond publicly on X by 31 December 2026 to$t$),
				-- CHE D2
				('01a0a0ba-d969-7613-a701-0f140bd224b1'::uuid, 2, 'description', $t$Window. Opens at the root post's timestamp, ends 5 November 2026 at 23:45 UTC.$t$, $t$Window. Opens at the root post's timestamp, ends 31 December 2026 at 23:45 UTC, moved from 5 November 2026 by ruling D-55 (11 October 2026).$t$),
				-- CHE D3
				('01a0a0ba-d969-7613-a701-0f140bd224b1'::uuid, 3, 'description', $t$No extensions.$t$, $t$No further extensions.$t$),
				-- CLA D1
				('01a0a0ba-f3bd-70fe-b5fd-70426431e314'::uuid, 1, 'description', $t$on X, between 15 September and 5 November 2026?$t$, $t$on X, between 15 September and 31 December 2026?$t$),
				-- CLA D2
				('01a0a0ba-f3bd-70fe-b5fd-70426431e314'::uuid, 2, 'description', $t$Deadline. 5 November 2026, 23:45 UTC.$t$, $t$Deadline. 31 December 2026, 23:45 UTC, moved from 5 November 2026 by ruling D-55 (11 October 2026).$t$),
				-- CLA D3
				('01a0a0ba-f3bd-70fe-b5fd-70426431e314'::uuid, 3, 'description', $t$No extensions.$t$, $t$No further extensions.$t$),
				-- GIT D1
				('01a0a0bb-0dfb-7793-9ff3-057e1a53c10a'::uuid, 1, 'description', $t$GitHub stars by 5 November 2026?$t$, $t$GitHub stars by 31 December 2026?$t$),
				-- GIT D2
				('01a0a0bb-0dfb-7793-9ff3-057e1a53c10a'::uuid, 2, 'description', $t$Deadline 5 November 2026, 23:45 UTC.$t$, $t$Deadline 31 December 2026, 23:45 UTC, moved from 5 November 2026 by ruling D-55 (11 October 2026).$t$),
				-- MAT D1
				('01a0a0bb-3141-71ce-9843-2d98002f8c87'::uuid, 1, 'description', $t$publicly confirm on X by 5 November 2026 that$t$, $t$publicly confirm on X by 31 December 2026 that$t$),
				-- MAT D2
				('01a0a0bb-3141-71ce-9843-2d98002f8c87'::uuid, 2, 'description', $t$Deadline. 5 November 2026, 23:45 UTC.$t$, $t$Deadline. 31 December 2026, 23:45 UTC, moved from 5 November 2026 by ruling D-55 (11 October 2026).$t$),
				-- MAT D3
				('01a0a0bb-3141-71ce-9843-2d98002f8c87'::uuid, 3, 'description', $t$No extensions.$t$, $t$No further extensions.$t$),
				-- YCP D1
				('01a0a0bb-7e0b-7182-9944-bba33914d94b'::uuid, 1, 'description', $t$Winter 2027 batch by 5 November 2026?$t$, $t$Winter 2027 batch by 31 December 2026?$t$),
				-- YCP D2
				('01a0a0bb-7e0b-7182-9944-bba33914d94b'::uuid, 2, 'description', $t$Deadline. 5 November 2026, 23:45 UTC.$t$, $t$Deadline. 31 December 2026, 23:45 UTC, moved from 5 November 2026 by ruling D-55 (11 October 2026).$t$),
				-- YCP D3
				('01a0a0bb-7e0b-7182-9944-bba33914d94b'::uuid, 3, 'description', $t$No extensions.$t$, $t$No further extensions.$t$)
			) AS v(market_id, ord, field, before_txt, after_txt)
			WHERE v.market_id = mk.id
			ORDER BY v.ord
		LOOP
			v_txt := CASE p.field WHEN 'title' THEN v_title ELSE v_desc END;
			v_n_before := (length(v_txt) - length(replace(v_txt, p.before_txt, ''))) / length(p.before_txt);
			v_n_after  := (length(v_txt) - length(replace(v_txt, p.after_txt, ''))) / length(p.after_txt);

			IF v_n_before = 1 THEN
				v_txt := replace(v_txt, p.before_txt, p.after_txt);
			ELSIF v_n_before = 0 AND v_n_after = 1 THEN
				NULL; -- already applied
			ELSE
				RAISE EXCEPTION 'EXT-1 (0032): % % pair %: the before-text must occur exactly once, found % (after-text found %)',
					v_before.slug, p.field, p.ord, v_n_before, v_n_after;
			END IF;

			IF p.field = 'title' THEN v_title := v_txt; ELSE v_desc := v_txt; END IF;
		END LOOP;

		UPDATE markets m
		SET resolution_deadline = c_new_deadline,
		    title = v_title,
		    description = v_desc
		WHERE m.id = mk.id;

		SELECT * INTO STRICT v_after FROM markets m WHERE m.id = mk.id;

		IF md5(v_after.description) IS DISTINCT FROM mk.desc_md5 THEN
			RAISE EXCEPTION 'EXT-1 (0032): % description md5 is %, not the signed %',
				v_before.slug, md5(v_after.description), mk.desc_md5;
		END IF;
		IF mk.title_md5 IS NOT NULL AND md5(v_after.title) IS DISTINCT FROM mk.title_md5 THEN
			RAISE EXCEPTION 'EXT-1 (0032): % title md5 is %, not the signed %',
				v_before.slug, md5(v_after.title), mk.title_md5;
		END IF;
		IF v_after.resolution_deadline IS DISTINCT FROM c_new_deadline THEN
			RAISE EXCEPTION 'EXT-1 (0032): % deadline is %, not the new end',
				v_before.slug, to_char(v_after.resolution_deadline AT TIME ZONE 'UTC', c_iso);
		END IF;
		IF (v_after.slug, v_after.status, v_after.media_video_url, v_after.created_at)
		   IS DISTINCT FROM
		   (v_before.slug, v_before.status, v_before.media_video_url, v_before.created_at) THEN
			RAISE EXCEPTION 'EXT-1 (0032): % changed outside its deadline and text', v_before.slug;
		END IF;

		v_event_id   := public.uuidv7();
		v_created_at := to_timestamp(
			(('x' || substr(replace(v_event_id::text, '-', ''), 1, 12))
			 ::bit(48)::bigint) / 1000.0);

		INSERT INTO events
			(event_id, event_type, aggregate_type, aggregate_id,
			 payload, payload_version, metadata, created_at)
		VALUES (v_event_id, 'market.deadline_moved', 'market', mk.id,
			jsonb_build_object(
				'marketId',         mk.id,
				'previousDeadline', to_char(v_before.resolution_deadline AT TIME ZONE 'UTC', c_iso),
				'newDeadline',      to_char(c_new_deadline AT TIME ZONE 'UTC', c_iso),
				'ruling',           'D-55'
			),
			1,
			jsonb_build_object(
				'request_id',      'ext-1:' || mk.id::text,
				'flow_id',         'EXT-1',
				'user_id',         NULL,
				'actor_id',        'system',
				'idempotency_key', 'ext-1:deadline-moved:' || mk.id::text,
				'ip',              'migration',
				'user_agent',      'migration'
			),
			v_created_at);
	END LOOP;
END
$ext1$;
