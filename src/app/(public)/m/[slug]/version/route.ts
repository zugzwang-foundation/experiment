import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { comments, modActions, pools } from "@/db/schema";
import { getMarketBySlug } from "@/server/markets/get-by-slug";

// GET /m/[slug]/version — "has anything on this market changed?"
//
// ⚠ THIS EXISTS TO KEEP VIEWERS OFF THE DATABASE. `DebatePoll` used to call
// `router.refresh()` every 30 s per open tab, which re-invokes the whole
// `/m/[slug]` server read path: ~5 uncached queries and ~250 ms of CPU, each
// holding a pooled connection for the duration. Measured 2026-09-16 on
// production: the market page broke at 50 req/s offered with the connection
// pool pinned at 53 of 60 while Postgres itself ran 1-3 queries — the ceiling
// was connection SUPPLY, and idle viewers were what consumed it. At 3,000
// concurrent viewers that poll alone is ~100 renders/s and ~500 queries/s.
//
// A viewer now asks this instead and re-renders only when the answer changes.
//
// ⚠ RESERVES CARRY MOST OF THE VERSION, AND THAT IS NOT A SHORTCUT. Every
// comment rides a bet (INV-1) and every bet moves the CPMM pool, so the reserve
// pair changes whenever a post, reply or trade lands. `status` rides along
// because a market can leave `Open` without a bet.
//
// ⛔ MODERATION IS THE ONE THING RESERVES CANNOT SEE, AND LEAVING IT OUT WOULD
// BE A CONTENT-SAFETY REGRESSION. Removing a comment writes a `mod_actions`
// row and moves no money, so a reserves-only version would leave removed
// content on every open tab until the next unrelated bet. The old
// unconditional 30 s refresh cleared it within one tick, and this route must
// not be the reason that stops being true (CLAUDE.md §5.14 SC-1 — masking is a
// property of every read path). The moderation count is therefore part of the
// token, counted through `comments` because `mod_actions` is comment-scoped
// rather than market-scoped.
//
// ⛔ NOT A DTO AND NEVER ECHOED AS ONE. The reserves are hashed into an opaque
// token, never returned raw: `pools` is an internal row shape (AGENTS.md §6)
// and this response is public. The client compares tokens for equality and
// reads nothing out of them.
//
// Cached at TWO layers, and the CDN one is what makes it nearly free:
//   - `s-maxage=5` lets Vercel's edge answer it, so at 3,000 viewers the origin
//     sees roughly one request per 5 s instead of 100 per second.
//   - `stale-while-revalidate` keeps the edge answering while it refreshes.
// Worst-case staleness is the 5 s edge window on top of the poll interval,
// which is invisible next to a 30 s poll.

// ⛔ NO `dynamic`/`revalidate` SEGMENT EXPORTS, DELIBERATELY. The caching that
// matters here is the CDN header below; adding `force-static` under
// `cacheComponents` would additionally ask the framework to prerender a
// live pool read, which is the one thing this route must not do.

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
	const { slug } = await params;
	const market = await getMarketBySlug(db, slug);
	if (!market) notFound();

	// ONE round trip for both halves. The moderation count rides as a scalar
	// subquery rather than a second statement: this route is edge-cached, so it
	// runs about once per market per 5 s however many viewers are watching, and
	// one slightly wider query beats two narrow ones holding the connection
	// twice.
	//
	// ⛔ THE SUBQUERY NAMES ITS COLUMNS THROUGH ALIASES, NOT `${comments.id}`.
	// In a single-table select Drizzle renders an embedded column WITHOUT its
	// table, so the interpolated form became `join "comments" on "id" = …`,
	// which Postgres rejects as ambiguous (`mod_actions` has an `id` too).
	// Every call 500'd in production and the mocked unit tests could not see
	// it; tests/integration/market-version.integration.test.ts runs it for real.
	const [row] = await db
		.select({
			yes: pools.yesReserves,
			no: pools.noReserves,
			moderations: sql<number>`(
				select count(*) from ${modActions} as ma
				join ${comments} as c on c.id = ma.target_comment_id
				where c.market_id = ${market.id}
			)`,
		})
		.from(pools)
		.where(eq(pools.marketId, market.id))
		.limit(1);

	// A market with no pool row yet is still a valid answer — it has no reserves
	// to move, so its token is stable until one is seeded.
	const token = hashVersion(
		`${market.status}:${row?.yes ?? "0"}:${row?.no ?? "0"}:${row?.moderations ?? 0}`,
	);

	return new Response(JSON.stringify({ v: token }), {
		status: 200,
		headers: {
			"content-type": "application/json",
			"cache-control": "public, s-maxage=5, stale-while-revalidate=25",
		},
	});
}

/**
 * FNV-1a over the state string. Not cryptographic and does not need to be —
 * the only property required is that a change in reserves or status changes
 * the token, and the client compares for equality alone.
 */
function hashVersion(input: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(36);
}
