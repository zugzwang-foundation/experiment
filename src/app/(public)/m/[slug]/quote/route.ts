import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { pools } from "@/db/schema";
import { auth } from "@/server/auth";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { buildBuyQuote, buildSellQuote } from "@/server/debate-view/quote";
import { numericString } from "@/server/events/schemas";
import { getMarketBySlug } from "@/server/markets/get-by-slug";
import {
	envelope,
	jsonResponse,
	resolveRequestId,
} from "@/server/middleware/envelope";

// GET /m/[slug]/quote — the composer's interactive preview (UI.A2 §3.2; the
// cpmm.md §6.4 bundle with the §16.1 clamp surfaced). The `/m/[slug]/export`
// sibling shape: slug-resolved, force-dynamic, no-store.
//
// Session-gated (ratified OQ-5a): the quote is act-surface substrate — its
// only consumer is the signed-in composer, not public content. The 401
// REUSES the bets-endpoint `error_session_required` envelope (SG-7: no new
// wire error codes). No rate limit and no market-state gate (ratified
// OQ-5b): the preview is advisory pure math (cpmm §6.3) — one indexed pool
// read + pure decimal math per hit; the write path is the enforcement
// layer. Recorded forward-pointer (OQ-5b rider): HARDEN.2 may bucket this
// route into the per-surface rate-limit table later.
//
// Advisory per §6.3: figures may differ at execution — the authoritative
// recompute happens inside the W-1 tx under the pool lock; no
// slippage-tolerance abort exists by design. READ-ONLY: no write of any
// kind, ever (the plan-§1 INV-2 row). Reserves are NOT echoed in the DTO
// (quotes are derivable outputs; the raw pool pair stays server-side).

export const dynamic = "force-dynamic";

// Query contract (§3.2): side ∈ YES|NO; EXACTLY ONE of stake (buy quote) /
// shares (sell quote); each a `numericString` > 0. Violation → 400
// error_invalid_request_body (reused code — SG-7).
const quoteQuerySchema = z.object({
	side: z.enum(["YES", "NO"]),
	stake: numericString.optional(),
	shares: numericString.optional(),
});

export async function GET(
	request: Request,
	ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
	const requestId = resolveRequestId(request);

	// 1. Session gate FIRST (ratified OQ-5a).
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user?.id) {
		return withNoStore(
			jsonResponse(
				requestId,
				401,
				envelope("error_session_required", "session required"),
			),
		);
	}

	// 2. Query validation (zod + strict positivity; `numericString` admits a
	// sign, so > 0 is checked explicitly via exact decimal compare).
	const url = new URL(request.url);
	const parsed = quoteQuerySchema.safeParse(
		Object.fromEntries(url.searchParams),
	);
	if (!parsed.success) {
		return invalidQuery(requestId);
	}
	const { side, stake, shares } = parsed.data;
	if ((stake === undefined) === (shares === undefined)) {
		// Neither or both — exactly one of stake/shares selects the quote kind.
		return invalidQuery(requestId);
	}
	const amount = stake ?? shares;
	if (amount === undefined || !new CpmmDecimal(amount).greaterThan(0)) {
		return invalidQuery(requestId);
	}

	// 3. Slug resolution (Draft-excluded — the page/export posture) + pool
	// read. A missing pool row on a non-Draft market is structurally
	// unexpected (markets seed at open, ENGINE.14) — degrade to the same 404.
	const { slug } = await ctx.params;
	const market = await getMarketBySlug(db, slug);
	if (market === null) {
		notFound();
	}
	const poolRows = await db
		.select({ yesReserves: pools.yesReserves, noReserves: pools.noReserves })
		.from(pools)
		.where(eq(pools.marketId, market.id))
		.limit(1);
	const pool = poolRows[0];
	if (pool === undefined) {
		notFound();
	}

	// 4. The §6.4 computation — buy clamps (inside buildBuyQuote), sell never.
	const reserves = { yes: pool.yesReserves, no: pool.noReserves };
	const data =
		stake !== undefined
			? buildBuyQuote({ reserves, side, stake })
			: buildSellQuote({ reserves, side, shares: amount });

	return withNoStore(jsonResponse(requestId, 200, { ok: true, data }));
}

function invalidQuery(requestId: string): Response {
	return withNoStore(
		jsonResponse(
			requestId,
			400,
			envelope("error_invalid_request_body", "invalid quote query"),
		),
	);
}

/** Per-request-fresh (SPEC.2 §3.3 R-1 posture): quotes must never cache. */
function withNoStore(res: Response): Response {
	res.headers.set("cache-control", "no-store");
	return res;
}
