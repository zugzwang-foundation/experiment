import { count } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UI.A2 §9 slice 2 §5.6 tests-first — GET /m/[slug]/quote + the unitToWin
// ride-along (plan §3.2 route contract + §0 SG-2/SG-3/SG-7 + §6 edge cases +
// §7 "market-quote.integration" row; ratified OQ-5a session gate; OQ-5b
// advisory / no-market-state-gate / no-rate-limit).
//
// GREENFIELD route — `@/app/(public)/m/[slug]/quote/route` does not exist
// until slice 2 lands → RED at collection (module not found), NOT on a DB
// assertion (the debate-export precedent). DB-BACKED (local Postgres :54322);
// fixtures bypass the app layer (SPEC.2 §6.6). The RED receipt for THIS file
// is COLLECT-ONLY (`pnpm vitest list`) — no DB is touched until the writer
// lands the route and the suite runs for real.
//
// PINNED ROUTE CONTRACT (the implementer matches EXACTLY):
//   export const dynamic = "force-dynamic";
//   GET(request, ctx: { params: Promise<{ slug: string }> })
//   1. Session gate FIRST — auth.api.getSession({ headers: request.headers });
//      no session → 401 { ok: false, error: { code: "error_session_required",
//      message: "session required" } } — the bets-endpoint code string reused
//      per SG-7 (NOT uploads/sign's error_unauthenticated).
//   2. Query (URL search params): side ∈ YES|NO; EXACTLY ONE of stake (buy) /
//      shares (sell); each must match the events-schemas `numericString` AND
//      be strictly > 0. Violation → 400 error_invalid_request_body (SG-7:
//      reused code — assert the CODE, never the message).
//   3. Unknown slug OR Draft slug OR missing pool row → notFound() — Next's
//      REAL throw, digest "NEXT_HTTP_ERROR_FALLBACK;404" (verified against
//      next 16.2.4 dist/client/components/not-found.js). Asserted via
//      `rejects.toMatchObject({ digest })` — next/navigation is NOT mocked
//      (the export-route sibling drives the real module the same way).
//   4. Success → 200 { ok: true, data: QuoteDTO } via the shared
//      middleware/envelope.ts helpers (X-Request-Id echo-or-mint on EVERY
//      response) + `Cache-Control: no-store`.
//   NO rate limit, NO market-state gate (a Closed market still quotes —
//   ratified OQ-5b), NO writes EVER (the INV-2 read-only law, plan §1).
//
// Only `@/server/auth` is mocked (the tests/server/bets route-test pattern —
// vi.hoisted + a controllable getSession). Everything else is REAL: the real
// route, real getMarketBySlug (Draft-excluded), real pool read, real notFound
// throw, real Postgres.

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

vi.mock("@/server/auth", () => ({
	auth: { api: { getSession: mockGetSession } },
}));

import { GET } from "@/app/(public)/m/[slug]/quote/route";
import {
	betReceipts,
	bets,
	dharmaLedger,
	events,
	markets,
	pools,
	users,
} from "@/db/schema";
import { BET_MAX_STAKE } from "@/server/config/limits";
import {
	computeBuy,
	computeSell,
	type Reserves,
} from "@/server/cpmm/calculate";
import { loadDebateView } from "@/server/debate-view/load-debate-view";
import { getMarketBySlug } from "@/server/markets/get-by-slug";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

const DEADLINE = new Date("2027-01-01T00:00:00.000Z");
/** Seeded pool reserves — the E2-family (100,100) symmetric pool at 18 dp. */
const SEED_18DP = "100.000000000000000000";
const SEEDED_RESERVES: Reserves = { yes: SEED_18DP, no: SEED_18DP };
/** next/navigation notFound() digest (next 16.2.4 http-access-fallback). */
const NOT_FOUND_DIGEST = "NEXT_HTTP_ERROR_FALLBACK;404";

/** §4.4 wire envelope, cast at the JSON trust boundary (AGENTS.md §4). */
type WireEnvelope = {
	ok: boolean;
	data?: Record<string, unknown>;
	error?: { code: string; message: string };
};

async function readEnvelope(res: Response): Promise<WireEnvelope> {
	return (await res.json()) as WireEnvelope;
}

async function seedUser(tag: string): Promise<string> {
	const [u] = await testDb
		.insert(users)
		.values({
			name: "Quote Viewer",
			email: `quote-${tag}@example.com`,
			pseudonym: `QuoteViewer-${tag}`,
			tosAcceptedAt: new Date("2026-01-01T00:00:00.000Z"),
		})
		.returning({ id: users.id });
	return u?.id ?? "";
}

async function seedMarket(args: {
	slug: string;
	status: "Draft" | "Open" | "Closed";
	withPool?: boolean;
}): Promise<string> {
	const [m] = await testDb
		.insert(markets)
		.values({
			slug: args.slug,
			title: "Will the quote route serve advisory math before A3 renders it?",
			description: "Resolves YES if the §6.4 bundle crosses the wire intact.",
			status: args.status,
			resolutionDeadline: DEADLINE,
		})
		.returning({ id: markets.id });
	const marketId = m?.id ?? "";
	if (args.withPool !== false) {
		await testDb.insert(pools).values({
			marketId,
			yesReserves: SEED_18DP,
			noReserves: SEED_18DP,
		});
	}
	return marketId;
}

function signedIn(userId: string): void {
	mockGetSession.mockResolvedValue({ user: { id: userId } });
}

function signedOut(): void {
	mockGetSession.mockResolvedValue(null);
}

function quoteRequest(slug: string, query: string): Promise<Response> {
	return GET(new Request(`http://localhost/m/${slug}/quote${query}`), {
		params: Promise.resolve({ slug }),
	});
}

/**
 * Write-surface row counts for the advisory-no-writes law (plan §1 INV-2
 * row: the quote read NEVER appends — no bet, no ledger row, no events row,
 * no receipt). `events` counts through the partitioned parent.
 */
async function writeRowCounts(): Promise<{
	bets: number;
	dharmaLedger: number;
	events: number;
	betReceipts: number;
}> {
	const [b] = await testDb.select({ n: count() }).from(bets);
	const [l] = await testDb.select({ n: count() }).from(dharmaLedger);
	const [e] = await testDb.select({ n: count() }).from(events);
	const [r] = await testDb.select({ n: count() }).from(betReceipts);
	return {
		bets: b?.n ?? -1,
		dharmaLedger: l?.n ?? -1,
		events: e?.n ?? -1,
		betReceipts: r?.n ?? -1,
	};
}

afterEach(async () => {
	await truncateTables(testClient, ["pools", "markets", "users"]);
	vi.clearAllMocks();
});

describe("quote route — session gate first, then slug resolution", () => {
	it("market-quote::signed-out-401-error_session_required", async () => {
		await seedMarket({ slug: "quote-signed-out", status: "Open" });
		signedOut();

		const res = await quoteRequest("quote-signed-out", "?side=YES&stake=10");

		expect(res.status).toBe(401);
		const body = await readEnvelope(res);
		expect(body.ok).toBe(false);
		expect(body.error?.code).toBe("error_session_required");
		expect(body.error?.message).toBe("session required");
		// §4.4: EVERY response carries X-Request-Id (envelope.ts echo-or-mint).
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("market-quote::unknown-slug-404-notFound-throw", async () => {
		signedIn(await seedUser("u404"));

		await expect(
			quoteRequest("no-such-market", "?side=YES&stake=10"),
		).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
	});

	it("market-quote::draft-slug-404-notFound-throw-even-with-a-pool", async () => {
		// Draft + pool seeded: the 404 must come from getMarketBySlug's Draft
		// exclusion (Drafts are admin-only), not from a missing-pool branch.
		await seedMarket({ slug: "quote-draft", status: "Draft" });
		signedIn(await seedUser("udraft"));

		await expect(
			quoteRequest("quote-draft", "?side=YES&stake=10"),
		).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
	});
});

describe("quote route — advisory quotes against a seeded (100,100) Open pool", () => {
	it("market-quote::happy-buy-200-figures-are-computeBuy-on-the-seeded-reserves", async () => {
		await seedMarket({ slug: "quote-buy", status: "Open" });
		signedIn(await seedUser("ubuy"));

		const res = await quoteRequest("quote-buy", "?side=YES&stake=10");

		expect(res.status).toBe(200);
		expect(res.headers.get("cache-control")).toBe("no-store");
		expect(res.headers.get("x-request-id")).toBeTruthy();
		const body = await readEnvelope(res);
		expect(body.ok).toBe(true);
		// The E2 vector on the seeded reserves — derived, never hand-pinned
		// (shares = "19.090909090909090909", pEff = "0.523809523809523810", …).
		const raw = computeBuy({
			reserves: SEEDED_RESERVES,
			side: "yes",
			stake: "10",
		});
		expect(body.data).toEqual({
			kind: "buy",
			side: "YES",
			stake: "10",
			clamped: false,
			shares: raw.shares,
			p0: raw.p0,
			pEff: raw.pEff,
			p1: raw.p1,
			impact: raw.impact,
		});
	});

	it("market-quote::happy-sell-200-figures-are-computeSell-on-the-seeded-reserves", async () => {
		await seedMarket({ slug: "quote-sell", status: "Open" });
		signedIn(await seedUser("usell"));

		const res = await quoteRequest("quote-sell", "?side=NO&shares=5");

		expect(res.status).toBe(200);
		expect(res.headers.get("cache-control")).toBe("no-store");
		const body = await readEnvelope(res);
		expect(body.ok).toBe(true);
		const raw = computeSell({
			reserves: SEEDED_RESERVES,
			side: "no",
			shares: "5",
		});
		expect(body.data).toEqual({
			kind: "sell",
			side: "NO",
			shares: "5", // echoed as submitted — SELL NEVER CLAMPED (SG-2)
			proceeds: raw.proceeds,
			p0: raw.p0,
			pEff: raw.pEff,
			p1: raw.p1,
			impact: raw.impact,
		});
	});

	it("market-quote::clamped-buy-stake-15000-returns-effective-10000-clamped-true", async () => {
		await seedMarket({ slug: "quote-clamped", status: "Open" });
		signedIn(await seedUser("uclamp"));

		const res = await quoteRequest("quote-clamped", "?side=YES&stake=15000");

		expect(res.status).toBe(200);
		const body = await readEnvelope(res);
		expect(body.ok).toBe(true);
		expect(body.data).toMatchObject({
			kind: "buy",
			stake: "10000", // the EFFECTIVE stake (== BET_MAX_STAKE, OQ-1)
			clamped: true, // §16.1: surfaced in the non-blocking preview
		});
		expect(body.data?.stake).toBe(BET_MAX_STAKE);
	});

	it("market-quote::closed-market-still-quotes-200-advisory", async () => {
		// Ratified OQ-5b: NO market-state gate — the preview is advisory pure
		// math (cpmm §6.3); the WRITE path is the enforcement layer.
		await seedMarket({ slug: "quote-closed", status: "Closed" });
		signedIn(await seedUser("uclosed"));

		const res = await quoteRequest("quote-closed", "?side=YES&stake=10");

		expect(res.status).toBe(200);
		const body = await readEnvelope(res);
		expect(body.ok).toBe(true);
		expect(body.data?.kind).toBe("buy");
	});

	it("market-quote::advisory-no-writes-zero-deltas-across-buy-and-sell-quotes", async () => {
		// The INV-2 read-only law (plan §1): the quote surface NEVER writes —
		// no bets row, no dharma_ledger append, no events row, no bet_receipts
		// row. Row-count invariance across a happy buy + sell quote.
		await seedMarket({ slug: "quote-no-writes", status: "Open" });
		signedIn(await seedUser("unowrites"));

		const before = await writeRowCounts();
		const buyRes = await quoteRequest("quote-no-writes", "?side=YES&stake=10");
		const sellRes = await quoteRequest("quote-no-writes", "?side=NO&shares=5");
		// Guard: both quotes actually EXECUTED (a 4xx would zero-delta
		// trivially and prove nothing).
		expect(buyRes.status).toBe(200);
		expect(sellRes.status).toBe(200);

		expect(await writeRowCounts()).toEqual(before);
	});
});

describe("quote route — query validation → 400 error_invalid_request_body", () => {
	let userId: string;

	beforeEach(async () => {
		await seedMarket({ slug: "quote-params", status: "Open" });
		userId = await seedUser("uparams");
	});

	// side ∈ YES|NO; EXACTLY ONE of stake/shares; numericString AND > 0.
	// "0" / "-5" pass the SIGNED numericString regex but fail strict
	// positivity; "abc" fails the regex itself — both layers exercised.
	const INVALID_QUERIES: ReadonlyArray<[label: string, query: string]> = [
		["missing-side", "?stake=10"],
		["bad-side", "?side=MAYBE&stake=10"],
		["both-stake-and-shares", "?side=YES&stake=10&shares=5"],
		["neither-stake-nor-shares", "?side=YES"],
		["stake-zero", "?side=YES&stake=0"],
		["stake-negative", "?side=YES&stake=-5"],
		["stake-not-numeric", "?side=YES&stake=abc"],
		["shares-zero", "?side=NO&shares=0"],
	];

	it.each(
		INVALID_QUERIES,
	)("market-quote::param-400-%s", async (_label, query) => {
		signedIn(userId);

		const res = await quoteRequest("quote-params", query);

		expect(res.status).toBe(400);
		const body = await readEnvelope(res);
		expect(body.ok).toBe(false);
		// Assert the CODE, not the message (plan §3.2; SG-7: reused code).
		expect(body.error?.code).toBe("error_invalid_request_body");
	});
});

describe("unitToWin ride-along — additive DebateMarketHeader field (SG-3)", () => {
	it("market-quote::unitToWin-populates-on-loadDebateView-and-pricing-is-unchanged", async () => {
		await seedMarket({ slug: "quote-unit-to-win", status: "Open" });
		// loadDebateView stays VIEWER-INDEPENDENT (SG-3) — no session involved;
		// the masking gate's no-session contract is untouched.
		const market = await getMarketBySlug(testDb, "quote-unit-to-win");
		if (!market) throw new Error("seed failed: slug did not resolve");

		const model = await loadDebateView(testDb, { market });

		// The additive field: per-side computeBuy(stake "1").shares over the
		// seeded reserves — on (100,100) both sides = "1.990099009900990099"
		// (the plan §6 vector, literal-pinned in the unit suite).
		expect(model.market.unitToWin).toEqual({
			yes: computeBuy({ reserves: SEEDED_RESERVES, side: "yes", stake: "1" })
				.shares,
			no: computeBuy({ reserves: SEEDED_RESERVES, side: "no", stake: "1" })
				.shares,
		});
		// SG-3: the EXISTING pricing contract is untouched — same shape, same
		// values ((100,100) ⇒ 0.5/0.5, half-even 18 dp via getPrices).
		expect(model.market.pricing).toEqual({
			yes: "0.500000000000000000",
			no: "0.500000000000000000",
		});
	});
});
