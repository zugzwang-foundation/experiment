import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UI.A2 §9 slice 1 — BET_MAX_STAKE clamp, DB-backed acceptance through the
// REAL place/sell Route Handlers against test Postgres (plan §1 invariant
// narratives + §6 edge cases + §7 integration row; SPEC.1 §16.1). The clamp
// is ONE pre-tx stake transformation at the place route's step 5d
// (clamp-then-floor); `place()`/`transaction.ts`/`sell.ts` take ZERO edits
// (SG-1) and the sell path is NEVER clamped (SG-2).
//
// RED posture (tests-first): file-level collection-RED on the greenfield
// VALUE import of `BET_MAX_STAKE` (limits.ts lacks the export until slice 1
// lands). Behind the import, four scenarios are ALSO assertion-RED against
// today's clamp-less route — an over-max stake executes (or reports
// `required`) at the SUBMITTED amount today:
//   clamped-execution-is-uniform · clamped-insufficient-balance-reports-
//   clamped-required · reply-clamp-then-reply-floor · clamp-replay-same-body
// The remaining three (at-max boundary, sell-never-clamped, replay-different-
// body 409) are regression pins guarding the clamp's edges — GREEN with the
// import, they foreclose the boundary off-by-one, an SG-2 sell-side clamp,
// and the post-clamp-fingerprint aliasing corruption (plan §1 I-IDEM-ONCE).
//
// Mocks mirror place-replay-durable.test.ts: the always-miss idempotency
// cache (release no-op) IS the Redis-lost posture, so same-key replays ride
// the DURABLE `bet_receipts` path; the fingerprint mock is BODY-SENSITIVE
// (JSON.stringify) because the I-IDEM-ONCE narrative (plan §1) is exactly
// that the fingerprint is computed at handler entry over the RAW submitted
// body, BEFORE the clamp — two DIFFERENT over-max bodies must never alias
// even though both would execute at the same clamped 10000.
//
// Money/shares cross as decimal STRINGS; every compare is an exact string or
// CpmmDecimal — NEVER parseFloat/Number on money (CLAUDE.md §2).

const { mockGetSession, mockPrecommit, mockRelease } = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockPrecommit: vi.fn(),
	mockRelease: vi.fn(async (_response: unknown) => {}),
}));

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
	auth: { api: { getSession: mockGetSession } },
}));
vi.mock("@/server/middleware/origin-allowlist", () => ({
	checkOrigin: () => true,
}));
vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: vi.fn(async () => ({
		allowed: true,
		remaining: 99,
		reset: 0,
	})),
	ipIdentifier: (ip: string) => ip,
}));
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async (body: unknown) => JSON.stringify(body)),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: mockRelease,
	})),
}));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: mockPrecommit,
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import { POST as sellPOST } from "@/app/api/bets/sell/route";
import {
	bets,
	dharmaLedger,
	markets,
	pools,
	positions,
	users,
} from "@/db/schema";
// Greenfield VALUE import — the RED driver until slice 1 lands the constant.
import { BET_MAX_STAKE } from "@/server/config/limits";
import { computeBuy } from "@/server/cpmm/calculate";
import { CpmmDecimal } from "@/server/cpmm/decimal";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const SEED_RESERVES = "100.000000000000000000";
/** The clamped stake as NUMERIC(38,18) reads back from Postgres (scale-18). */
const MAX_18DP = new CpmmDecimal(BET_MAX_STAKE).toFixed(18);

function req(path: string, body: unknown, idempotencyKey: string) {
	return new Request(`https://prd.example.com${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.40",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Clamp User",
			email: `${emailTag}@example.com`,
			pseudonym,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Clamp Market",
			status: "Open",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED_RESERVES,
		noReserves: SEED_RESERVES,
	});
	return marketId;
}

async function seedDharmaGrant(userId: string, amount: string): Promise<void> {
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount,
			entryType: "initial_grant",
		}),
	);
}

describe("UI.A2 slice 1 — BET_MAX_STAKE clamp on the place path (SPEC.1 §16.1)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPrecommit.mockResolvedValue({ outcome: "pass", categories: [] });
	});
	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"dharma_ledger",
			"bets",
			"comments",
			"positions",
			"pools",
			"markets",
			"users",
			"bet_receipts",
		]);
	});

	it("bet-clamp::clamped-execution-is-uniform", async () => {
		// THE INV-1/conservation narrative (plan §1): the clamp is applied at ONE
		// point (route step 5d) and the CLAMPED stake is uniformly the stake for
		// the balance check, the CPMM computation, bets.stake, the ledger debit,
		// and the pool move. The corruption scenario this forecloses: a
		// non-uniform clamp (submitted 15000 feeding the ledger while 10000 feeds
		// the pool, or vice versa) silently evaporates Đ from user↔pool
		// conservation per bet.
		const userId = await seedUser("clamp-uni", "clamp-uni");
		const marketId = await seedOpenMarketWithPool("clamp-uni-market");
		await seedDharmaGrant(userId, "20000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			req(
				"/api/bets/place",
				{
					marketId,
					side: "YES",
					stake: "15000",
					body: "over-max entry argument, clamped to the cap",
				},
				"clamp-uni-key",
			),
		);

		expect(res.status).toBe(200);
		const payload = await res.json();
		expect(payload.ok).toBe(true);
		const data = payload.data;

		// bets.stake == BET_MAX_STAKE (NUMERIC(38,18) reads back scale-18).
		const betRows = await testDb
			.select({ id: bets.id, stake: bets.stake })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(1);
		expect(betRows[0]?.stake).toBe(MAX_18DP);

		// The bet_stake ledger debit == −BET_MAX_STAKE exactly (18-dp negative
		// form) — the user was debited the CLAMPED amount, not the submitted one.
		const ledgerRows = await testDb
			.select({
				entryType: dharmaLedger.entryType,
				amount: dharmaLedger.amount,
				betId: dharmaLedger.betId,
			})
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		const stakeRow = ledgerRows.find((r) => r.entryType === "bet_stake");
		expect(stakeRow).toBeDefined();
		expect(stakeRow?.betId).toBe(betRows[0]?.id);
		expect(stakeRow?.amount).toBe(
			new CpmmDecimal(BET_MAX_STAKE).negated().toFixed(18),
		);

		// The pool row is EXACTLY what a clamped-stake buy produces — the
		// strongest uniform-execution pin: if the submitted 15000 leaked into the
		// CPMM computation anywhere, these reserves differ.
		const expected = computeBuy({
			reserves: { yes: SEED_RESERVES, no: SEED_RESERVES },
			side: "yes",
			stake: BET_MAX_STAKE,
		});
		const [poolAfter] = await testDb
			.select({ yesReserves: pools.yesReserves, noReserves: pools.noReserves })
			.from(pools)
			.where(eq(pools.marketId, marketId));
		expect(poolAfter?.yesReserves).toBe(expected.reserves.yes);
		expect(poolAfter?.noReserves).toBe(expected.reserves.no);

		// Pool Đ-inflow ≡ BET_MAX_STAKE, by exact decimal math on the pool row
		// before/after. Mechanics (cpmm §4.1): a buy of stake S adds S to BOTH
		// reserves then removes the bought shares s from the bought side —
		// Δ(yes+no) = 2S − s, so the CASH the pool absorbed is
		// S = (Δ(yes+no) + s) / 2. (The plan-§1 shorthand "Δ(y+n)/2 ≡ stake"
		// omits the +s term; this asserts the intent it names — pool Đ-inflow ==
		// BET_MAX_STAKE — in the exact form the CPMM actually satisfies.)
		const reserveSumBefore = new CpmmDecimal(SEED_RESERVES).times(2);
		const reserveSumAfter = new CpmmDecimal(poolAfter?.yesReserves ?? "0").plus(
			poolAfter?.noReserves ?? "0",
		);
		const dharmaInflow = reserveSumAfter
			.minus(reserveSumBefore)
			.plus(data.sharesBought)
			.dividedBy(2);
		expect(dharmaInflow.equals(BET_MAX_STAKE)).toBe(true);

		// The response's sharesBought is the CLAMPED stake's buy — the figures a
		// conforming client sees imply the max, not the submitted amount.
		expect(data.sharesBought).toBe(expected.shares);
	});

	it("bet-clamp::at-max-boundary-no-op", async () => {
		// Plan §6 edge 1: stake EXACTLY BET_MAX_STAKE → NOT clamped (STRICT `>`),
		// executes at 10000 with the same figures as submitting 10000.
		const userId = await seedUser("clamp-at", "clamp-at");
		const marketId = await seedOpenMarketWithPool("clamp-at-market");
		await seedDharmaGrant(userId, "20000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			req(
				"/api/bets/place",
				{
					marketId,
					side: "YES",
					stake: BET_MAX_STAKE,
					body: "exactly-at-max entry argument",
				},
				"clamp-at-key",
			),
		);

		expect(res.status).toBe(200);
		const payload = await res.json();
		expect(payload.ok).toBe(true);

		const betRows = await testDb
			.select({ stake: bets.stake })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(1);
		expect(betRows[0]?.stake).toBe(MAX_18DP);

		const expected = computeBuy({
			reserves: { yes: SEED_RESERVES, no: SEED_RESERVES },
			side: "yes",
			stake: BET_MAX_STAKE,
		});
		expect(payload.data.sharesBought).toBe(expected.shares);
	});

	it("bet-clamp::clamped-insufficient-balance-reports-clamped-required", async () => {
		// Plan §6 edge 2: stake > max, balance < max → clamp FIRST, then the
		// in-tx F-BET-4 pre-check reports required = the CLAMPED stake (the
		// amount execution actually needs), never the submitted 15000. The wire
		// carries `required` inside the error message
		// ("insufficient dharma: balance <b> < required <r>", errors.ts).
		const userId = await seedUser("clamp-poor", "clamp-poor");
		const marketId = await seedOpenMarketWithPool("clamp-poor-market");
		// 1000 — well above the post floor, far below the max (post-credit 1010).
		await seedDharmaGrant(userId, "1000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			req(
				"/api/bets/place",
				{
					marketId,
					side: "YES",
					stake: "15000",
					body: "over-max argument against an under-max balance",
				},
				"clamp-poor-key",
			),
		);

		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe("insufficient_dharma");
		// required == the CLAMPED stake, byte-form "10000" (the constant string
		// clampStakeToMax returns, passed through to place()).
		expect(payload.error.message.endsWith(`required ${BET_MAX_STAKE}`)).toBe(
			true,
		);
		expect(payload.error.message.includes("15000")).toBe(false);

		// Clean rejection — no partial state (the W-1 tx rolled back whole:
		// no bet, and the in-tx daily credit reverted with it → grant row only).
		const betRows = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(0);
		const ledgerRows = await testDb
			.select({ entryType: dharmaLedger.entryType })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(ledgerRows.length).toBe(1);
		expect(ledgerRows[0]?.entryType).toBe("initial_grant");
	});

	it("bet-clamp::reply-clamp-then-reply-floor", async () => {
		// Plan §6 edge 3: a reply is a buy — the clamp applies, THEN the reply
		// floor asserts on the clamped value (10000 ≥ 50 → succeeds). The reply
		// bet lands at BET_MAX_STAKE, never the submitted amount.
		const author = await seedUser("clamp-parent", "clamp-parent");
		const replier = await seedUser("clamp-replier", "clamp-replier");
		const marketId = await seedOpenMarketWithPool("clamp-reply-market");
		await seedDharmaGrant(author, "1000");
		await seedDharmaGrant(replier, "20000");

		// Parent post (author, modest stake).
		mockGetSession.mockResolvedValue({ user: { id: author } });
		const parentRes = await placePOST(
			req(
				"/api/bets/place",
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "parent post the over-max reply rides",
				},
				"clamp-reply-parent-key",
			),
		);
		expect(parentRes.status).toBe(200);
		const parentCommentId = (await parentRes.json()).data.commentId;

		// Over-max REPLY (replier, same side — a Support reply-bet).
		mockGetSession.mockResolvedValue({ user: { id: replier } });
		const replyRes = await placePOST(
			req(
				"/api/bets/place",
				{
					marketId,
					side: "YES",
					stake: "15000",
					body: "over-max reply argument, clamped then reply-floored",
					parentCommentId,
				},
				"clamp-reply-key",
			),
		);

		expect(replyRes.status).toBe(200);
		const replyPayload = await replyRes.json();
		expect(replyPayload.ok).toBe(true);
		expect(replyPayload.data.parentCommentId).toBe(parentCommentId);

		// The reply bet's stake == BET_MAX_STAKE (clamped; a reply is a buy).
		const [replyBet] = await testDb
			.select({ stake: bets.stake })
			.from(bets)
			.where(eq(bets.id, replyPayload.data.betId));
		expect(replyBet?.stake).toBe(MAX_18DP);
	});

	it("bet-clamp::sell-never-clamped", async () => {
		// SG-2: the clamp is buy/add ONLY — no clamp code on any sell surface.
		// Accumulate a position whose share quantity AND sell-proceeds both
		// exceed BET_MAX_STAKE via three under-max buys, then sell the ENTIRE
		// quantity in ONE /api/bets/sell call: it succeeds whole, and the
		// proceeds credit is > max — a clamp anywhere on the sell path would
		// break one of these.
		const userId = await seedUser("clamp-sell", "clamp-sell");
		const marketId = await seedOpenMarketWithPool("clamp-sell-market");
		await seedDharmaGrant(userId, "20000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		for (const [i, key] of [
			"clamp-sell-buy-1",
			"clamp-sell-buy-2",
			"clamp-sell-buy-3",
		].entries()) {
			const buy = await placePOST(
				req(
					"/api/bets/place",
					{
						marketId,
						side: "YES",
						stake: "6000",
						body: `accumulation buy ${i + 1} of 3 (under the cap)`,
					},
					key,
				),
			);
			expect(buy.status).toBe(200);
		}

		// Precondition: the held quantity exceeds the cap.
		const held = await testDb
			.select({ quantity: positions.quantity })
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(held.length).toBe(1);
		const heldQuantity = held[0]?.quantity ?? "0";
		expect(new CpmmDecimal(heldQuantity).greaterThan(BET_MAX_STAKE)).toBe(true);

		// ONE sell of the FULL quantity → 200, no clamp anywhere.
		const sell = await sellPOST(
			req(
				"/api/bets/sell",
				{ marketId, shares: heldQuantity },
				"clamp-sell-key",
			),
		);
		expect(sell.status).toBe(200);
		const sellPayload = await sell.json();
		expect(sellPayload.ok).toBe(true);

		// Position is flat — the whole quantity sold in one call.
		const { heldSideOrNull } = await import("@/server/positions/read");
		expect(await heldSideOrNull(testDb, { userId, marketId })).toBeNull();

		// The sell's proceeds credit (positive bet_stake, bet_id null) EXCEEDS
		// BET_MAX_STAKE — the sharpest never-clamped proof at the money layer.
		const ledgerRows = await testDb
			.select({
				entryType: dharmaLedger.entryType,
				amount: dharmaLedger.amount,
				betId: dharmaLedger.betId,
			})
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		const sellCredit = ledgerRows.find(
			(r) => r.entryType === "bet_stake" && r.betId === null,
		);
		expect(sellCredit).toBeDefined();
		expect(
			new CpmmDecimal(sellCredit?.amount ?? "0").greaterThan(BET_MAX_STAKE),
		).toBe(true);
	});

	it("bet-clamp::clamp-replay-same-body-returns-original-200", async () => {
		// Plan §6 edge 4 / I-IDEM-ONCE: same key + same over-max body replayed →
		// the ORIGINAL 200 verbatim from the durable receipt — the CLAMPED
		// execution's result (same betId, stake landed at the max), executed
		// exactly once. The always-miss Redis mock forces the durable path.
		const userId = await seedUser("clamp-replay", "clamp-replay");
		const marketId = await seedOpenMarketWithPool("clamp-replay-market");
		await seedDharmaGrant(userId, "20000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const body = {
			marketId,
			side: "YES",
			stake: "15000",
			body: "over-max argument, replayed verbatim",
		};

		const first = await placePOST(
			req("/api/bets/place", body, "clamp-replay-key"),
		);
		expect(first.status).toBe(200);
		const firstBody = await first.json();
		expect(firstBody.ok).toBe(true);

		const second = await placePOST(
			req("/api/bets/place", body, "clamp-replay-key"),
		);
		expect(second.status).toBe(200);
		const secondBody = await second.json();

		// The ORIGINAL 200 verbatim — same betId, same figures.
		expect(secondBody).toEqual(firstBody);
		expect(secondBody.data.betId).toBe(firstBody.data.betId);

		// Executed ONCE, at the CLAMPED stake (the receipt stored the clamped
		// execution's result; the replay re-executed nothing).
		const betRows = await testDb
			.select({ stake: bets.stake })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(1);
		expect(betRows[0]?.stake).toBe(MAX_18DP);
	});

	it("bet-clamp::clamp-replay-different-body-409", async () => {
		// Plan §1 I-IDEM-ONCE fingerprint-order narrative: the fingerprint is
		// computed over the RAW submitted body BEFORE the clamp — so two
		// DIFFERENT over-max submissions ("15000" then "16000", BOTH of which
		// would clamp to the same executed 10000) never alias: the second 409s
		// (error_idempotency_key_reused) instead of replaying the first's 200.
		// A post-clamp fingerprint would make them identical and silently
		// swallow the distinct intent.
		const userId = await seedUser("clamp-alias", "clamp-alias");
		const marketId = await seedOpenMarketWithPool("clamp-alias-market");
		await seedDharmaGrant(userId, "20000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const first = await placePOST(
			req(
				"/api/bets/place",
				{
					marketId,
					side: "YES",
					stake: "15000",
					body: "over-max argument under a reused key",
				},
				"clamp-alias-key",
			),
		);
		expect(first.status).toBe(200);

		// Same key, DIFFERENT raw body (only the stake differs — the sharpest
		// aliasing trap: both clamp to the same executed amount).
		const second = await placePOST(
			req(
				"/api/bets/place",
				{
					marketId,
					side: "YES",
					stake: "16000",
					body: "over-max argument under a reused key",
				},
				"clamp-alias-key",
			),
		);
		expect(second.status).toBe(409);
		const secondBody = await second.json();
		expect(secondBody.ok).toBe(false);
		expect(secondBody.error.code).toBe("error_idempotency_key_reused");

		// The mismatched request wrote NOTHING — still exactly one bet, at the
		// first execution's clamped stake.
		const betRows = await testDb
			.select({ stake: bets.stake })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(1);
		expect(betRows[0]?.stake).toBe(MAX_18DP);
	});
});
