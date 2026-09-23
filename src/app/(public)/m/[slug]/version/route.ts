import { notFound } from "next/navigation";

import { getVersionToken } from "@/server/markets/version-token";

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
// Cached at THREE layers since CACHE-COALESCE-3 (ADR-0051 P3):
//   - `s-maxage=5` lets Vercel's edge answer it, so at 3,000 viewers the origin
//     sees roughly one request per 5 s per edge location instead of 100 a second.
//   - `stale-while-revalidate` keeps the edge answering while it refreshes.
//   - Behind the edge, the token itself comes from the fleet-wide store
//     (`src/server/markets/version-token.ts`), so an edge MISS opens a Postgres
//     connection only for the one instance fleet-wide re-deriving that market's
//     token in its `VERSION_MIN_WINDOW_MS`. ⚠ This layer is why the route no
//     longer breaks under a burst: R-18 logged 1,000 `EMAXCONN` 500s here in
//     thirteen seconds, every one an edge miss that asked the pooler for a
//     connection past its 200-client cap.
// Worst-case staleness is the 2 s store window plus the 5 s edge window on top
// of the poll interval, which is invisible next to a 30 s poll.
//
// ⛔ NEVER 500. `DebatePoll` reads any non-200 as "no change this tick", so a
// status code here decides only what the edge caches and what a load test
// counts. With the database unreachable, most requests never notice: they are
// served the token entry already in the store, as a fresh answer. The one
// request that took the store's lock and failed is served the last token with
// a SHORT edge life so the next tick asks again; with nothing to serve —
// the store's one-minute token entry gone too — it answers 503, `no-store`,
// `Retry-After: 5`.

// ⛔ NO `dynamic`/`revalidate` SEGMENT EXPORTS, DELIBERATELY. The caching that
// matters here is the CDN header below; adding `force-static` under
// `cacheComponents` would additionally ask the framework to prerender a
// live pool read, which is the one thing this route must not do.

const FRESH = "public, s-maxage=5, stale-while-revalidate=25";
const STALE = "public, s-maxage=2";

function tokenResponse(token: string, cacheControl: string): Response {
	return new Response(JSON.stringify({ v: token }), {
		status: 200,
		headers: {
			"content-type": "application/json",
			"cache-control": cacheControl,
		},
	});
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
	const { slug } = await params;
	const result = await getVersionToken(slug);

	if (result.kind === "not-found") notFound();
	if (result.kind === "token") return tokenResponse(result.token, FRESH);
	if (result.lastToken !== null) return tokenResponse(result.lastToken, STALE);
	return new Response(JSON.stringify({ error: "unavailable" }), {
		status: 503,
		headers: {
			"content-type": "application/json",
			"cache-control": "no-store",
			"retry-after": "5",
		},
	});
}
