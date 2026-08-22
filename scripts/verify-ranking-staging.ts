/**
 * Live ranking verification — READ-ONLY.
 *
 * Proves the read-time ranking model works against the STAGING database: the
 * four per-side aggregates compute, and `ranking.ts` produces a Top order plus
 * lane-dominance badges against real staging rows.
 *
 * Operator usage:
 *   doppler run --config stg -- pnpm tsx scripts/verify-ranking-staging.ts <market-slug>
 *   doppler run --config stg -- pnpm tsx scripts/verify-ranking-staging.ts sp-m2-active
 *
 * ── ITS WRITE PATH WAS DELETED AT STAGING-PARITY SLICE B (D.2) ──────────────
 *
 * This script used to SEED its own demo market before verifying it: raw
 * `INSERT INTO markets / comments / bets` with `share_quantity = '0'` and
 * `price_at_bet = '0.5'`, bypassing the engine entirely. That step was the
 * direct producer of the `debate8-ranking-demo-*` markets (23 comments) on
 * staging, of 37 bets with no `bet.placed` event, and of the
 * `episodes.ts:168` throw that made every event-sourced read model return
 * empty there. It wrote both a `bets` row and no event, which is precisely the
 * corruption STAGING-PARITY exists to remove (manifest §1.1).
 *
 * Steps 1, 3 and 4 were never the problem — they are genuine read-only
 * verification — so they are kept, and the script now takes the market to
 * verify AS AN ARGUMENT instead of manufacturing one. Fixture data comes from
 * `pnpm staging:generate`, which drives the real engine.
 *
 * This makes it the CALIBRATION INSTRUMENT for the C3 lane-dominance shapes:
 * point it at a generated market, read the aggregates and badges it prints, and
 * tune the fixture stakes until each of the three lanes has a dominant post.
 * Calibration by measurement rather than by guesswork.
 *
 * It runs an INLINE `postgres()` client (NOT the `@/db` → `server-only` chain,
 * per the staging-seed/smoke convention) and imports the PURE `ranking.ts` (no
 * IO, no `server-only`, importable from tsx). It refuses to run unless
 * `DATABASE_URL_STAGING` contains `STAGING_PROJECT_REF_FRAGMENT` (the same
 * guard `migrate-staging.ts` uses).
 */

import postgres from "postgres";

import { badgeFor, buildTopList, type PostSubstrate } from "../src/lib/ranking";

const DBURL = process.env.DATABASE_URL_STAGING;
const FRAG = process.env.STAGING_PROJECT_REF_FRAGMENT;
const SLUG = process.argv[2];

if (!DBURL) {
	console.error(
		"[verify-ranking] DATABASE_URL_STAGING not set. Run: doppler run --config stg -- pnpm tsx scripts/verify-ranking-staging.ts <market-slug>",
	);
	process.exit(1);
}
if (!FRAG || !DBURL.includes(FRAG)) {
	console.error(
		"[verify-ranking] STAGING_PROJECT_REF_FRAGMENT guard failed — refusing to run against a URL that is not the staging project.",
	);
	process.exit(1);
}
if (!SLUG) {
	console.error(
		"[verify-ranking] a market slug is required. Usage:\n" +
			"  doppler run --config stg -- pnpm tsx scripts/verify-ranking-staging.ts <market-slug>\n" +
			"This script no longer seeds its own market — generate one with `pnpm staging:generate`.",
	);
	process.exit(1);
}

const sql = postgres(DBURL, { max: 2 });

async function main(): Promise<void> {
	// 1 — schema check.
	const col = await sql`
		SELECT 1 FROM information_schema.columns
		WHERE table_name = 'comments' AND column_name = 'stake_at_post_time'`;
	const idx = await sql`
		SELECT 1 FROM pg_indexes
		WHERE tablename = 'comments' AND indexname = 'comments_ranking_idx'`;
	const colGone = col.length === 0;
	const idxKept = idx.length > 0;
	console.log(
		`[schema] comments.stake_at_post_time dropped : ${colGone ? "yes ✓" : "NO ✗"}`,
	);
	console.log(
		`[schema] comments_ranking_idx survives        : ${idxKept ? "yes ✓" : "NO ✗"}`,
	);
	if (!colGone || !idxKept) throw new Error("staging schema check failed");

	// 2 — resolve the market BY SLUG. (This step used to seed one. See the
	// header: that write path is what corrupted staging, and it is gone.)
	const [market] = await sql`
		SELECT id, title, status FROM markets WHERE slug = ${SLUG}`;
	if (!market) {
		throw new Error(
			`no market with slug ${JSON.stringify(SLUG)} on staging — generate the fixture set first (pnpm staging:generate)`,
		);
	}
	const marketId = market.id as string;
	console.log(
		`\n[market] ${SLUG} — ${market.title} (${market.status}) ${marketId}`,
	);

	// 3 — the SAME aggregate query as ranking-substrate.ts (join via bets.comment_id).
	//
	// ⚠ THIS IS A HAND-KEPT COPY, and at RANK-1 it was found to have DRIFTED. It
	// still read the frozen `bets.stake` on every stake input, which LOTS-1
	// changed for the aggregates and RANK-1 changed for the two rulers. An
	// instrument that computes a different order from the application it is
	// meant to validate does not merely fail to help — it reports the engine
	// wrong. Whatever `ranking-substrate.ts` selects, this must select.
	const rows = await sql`
		SELECT
			p.id,
			p.side_at_post_time AS parent_side,
			p.created_at,
			pb.stake AS author_stake,
			pb.original_stake AS author_stake_original,
			pb.sold AS author_sold,
			pb.price_at_bet AS price_at_bet,
			-- ⚠ TWO DIFFERENT NUMBERS LIVE HERE AND THEY ARE NOT INTERCHANGEABLE
			-- (ADR-0039 patch record P3, RANK-3).
			--
			-- *_count_total  = the DISPLAYED count. Every reply, self-authored and
			--                  removed INCLUDED. It answers "how many replies are
			--                  here" and must match what a reader can count on the
			--                  surface. This is the only one that reaches a DTO.
			-- *_count        = the RANKING input. DISTINCT PEOPLE, self-authored
			--                  excluded. Never rendered anywhere, on any surface.
			--
			-- R-2: the lanes count PEOPLE, not replies. The thesis is K·n > C and n
			-- is how many people hold the knowledge — one person posting five times
			-- is n = 1. COUNT(rb.id) measured the wrong noun; this is a correction
			-- to a definition, not a mitigation.
			--
			-- ⚠ THE SELF-EXCLUSION MOVED FROM THE JOIN INTO THESE FILTERS at RANK-3,
			-- and it had to: a JOIN predicate removes the row, so the total could
			-- not be computed from the same query. A FILTER keeps the row and
			-- declines to count it, which preserves the property the JOIN form was
			-- chosen for — a post whose only replies are its own still appears, with
			-- its ranking counts at zero, rather than vanishing from the listing.
			-- ⚠ THE DISPLAY TOTAL COUNTS REPLY COMMENTS, NOT REPLY-BET ROWS, and the
			-- distinction is load-bearing rather than pedantic. R-1 only holds if
			-- this number equals what a reader can COUNT on the surface, and the
			-- surface is the reply lane, which is one row per reply COMMENT
			-- (reply-substrate.ts takes its bet through a LIMIT 1 LATERAL). The
			-- join below is a plain LEFT JOIN on bets.comment_id, which has an
			-- index but NO unique constraint -- so COUNT(rb.id) would report 2 for
			-- a comment carrying two bets while the lane still showed one row, and
			-- the differential this task exists to close would silently re-open at
			-- exactly the surfaces it was closed at. That a second bet is
			-- unreachable today is a property of place.ts being the sole write
			-- path, not of the schema; COUNT(DISTINCT rc.id) does not depend on it.
			--
			-- AND rb.id IS NOT NULL makes both forms agree with the lane on the
			-- other edge too: the lane's LATERAL is an inner join, so a comment
			-- with no bet at all is absent from it. Without this clause the people
			-- count would score such a row as a whole person of traction at zero
			-- stake, since rc.user_id is non-null whether or not a bet exists.
			COUNT(DISTINCT rc.id) FILTER (
				WHERE rc.side_at_post_time = p.side_at_post_time
					AND rb.id IS NOT NULL
			) AS support_count_total,
			COUNT(DISTINCT rc.id) FILTER (
				WHERE rc.side_at_post_time <> p.side_at_post_time
					AND rb.id IS NOT NULL
			) AS counter_count_total,
			COUNT(DISTINCT rc.user_id) FILTER (
				WHERE rc.side_at_post_time = p.side_at_post_time
					AND rc.user_id <> p.user_id
					AND rb.id IS NOT NULL
			) AS support_count,
			COUNT(DISTINCT rc.user_id) FILTER (
				WHERE rc.side_at_post_time <> p.side_at_post_time
					AND rc.user_id <> p.user_id
					AND rb.id IS NOT NULL
			) AS counter_count,
			-- LOTS-1 / ADR-0039 R4+R5 — the attracted-value aggregates key off SURVIVING
			-- LOT BASIS, not the frozen bets.stake. A replier who sells their lot
			-- down withdraws the weight they lent the parent, which is what R5 names.
			-- The historical figure is not lost: bets.stake is Bucket-A immutable and
			-- still readable; it simply stops being what this aggregate reports.
			--
			-- ⚠ COALESCE FALLS BACK TO THE FROZEN STAKE when a reply-bet has no lot.
			-- Unreachable under R8 (every bet mints a lot), but the alternative on an
			-- unreachable row is to silently score a real contribution as ZERO — the
			-- same class of error as letting missing bookkeeping veto a sell (S5). An
			-- unknown surviving amount is better read as "all of it survives", which
			-- is exactly the pre-LOTS-1 behaviour.
			COALESCE(SUM(COALESCE(rl.surviving_basis, rb.stake)) FILTER (
				WHERE rc.side_at_post_time = p.side_at_post_time
					AND rc.user_id <> p.user_id
			), 0) AS support_dharma,
			COALESCE(SUM(COALESCE(rl.surviving_basis, rb.stake)) FILTER (
				WHERE rc.side_at_post_time <> p.side_at_post_time
					AND rc.user_id <> p.user_id
			), 0) AS counter_dharma
		FROM comments p
		JOIN LATERAL (
			SELECT
				COALESCE(pl.surviving_basis, b.stake) AS stake,
				b.stake AS original_stake,
				COALESCE(pl.surviving_shares = 0, false) AS sold,
				b.price_at_bet
			FROM bets b
			LEFT JOIN lots pl ON pl.bet_id = b.id
			WHERE b.comment_id = p.id
			ORDER BY b.created_at ASC, b.id ASC
			LIMIT 1
		) pb ON true
		LEFT JOIN comments rc ON rc.parent_comment_id = p.id
		LEFT JOIN bets rb ON rb.comment_id = rc.id
		LEFT JOIN lots rl ON rl.bet_id = rb.id
		WHERE p.market_id = ${marketId} AND p.parent_comment_id IS NULL
		GROUP BY p.id, p.side_at_post_time, p.created_at,
			pb.stake, pb.original_stake, pb.sold, pb.price_at_bet
		ORDER BY p.created_at ASC, p.id ASC`;

	const substrate: PostSubstrate[] = rows.map((r) => ({
		id: r.id as string,
		parentSide: r.parent_side as "YES" | "NO",
		supportCount: Number(r.support_count),
		counterCount: Number(r.counter_count),
		supportCountTotal: Number(r.support_count_total),
		counterCountTotal: Number(r.counter_count_total),
		supportDharma: r.support_dharma as string,
		counterDharma: r.counter_dharma as string,
		createdAt: new Date(r.created_at as string),
		authorStake: r.author_stake as string,
		authorStakeOriginal: r.author_stake_original as string,
		authorSold: r.author_sold as boolean,
		priceAtBet: r.price_at_bet as string,
	}));

	if (substrate.length === 0) {
		// Said plainly rather than reported as a pass: an empty substrate produces
		// an empty Top order and zero badges, which reads identical to "the model
		// ran and nothing dominated".
		console.log(
			`\n[aggregates] market ${marketId} has NO top-level posts — nothing to rank.`,
		);
		await sql.end();
		return;
	}

	// 4 — compute + print.
	console.log(
		`\n[aggregates] ${substrate.length} post(s) — the four per-side signals:`,
	);
	for (const s of substrate) {
		console.log(
			`  ${s.id.slice(0, 8)} side=${s.parentSide}  ` +
				`support=${s.supportCount}p/${s.supportCountTotal}r/Đ${s.supportDharma}  counter=${s.counterCount}p/${s.counterCountTotal}r/Đ${s.counterDharma}  a=Đ${s.authorStake}`,
		);
	}

	console.log(`\n[Top order + latest interleave + lane-dominance badge]`);
	const ordered = buildTopList(substrate);
	ordered.forEach((p, i) => {
		const badge = badgeFor(p, substrate);
		console.log(
			`  ${i + 1}. ${p.id.slice(0, 8)} side=${p.parentSide}  badge=${badge ?? "—"}`,
		);
	});

	const badged = ordered.filter((p) => badgeFor(p, substrate) !== null).length;
	console.log(
		`\n✓ ranking verification complete: ${substrate.length} post(s)' four aggregates computed live, ` +
			`Top order produced, ${badged} badge(s) fired.`,
	);
	await sql.end();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
