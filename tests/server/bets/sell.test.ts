import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ENGINE.8 F-BET acceptance — `sell.test.ts::sell-preserves-comments` (F-BET-3
// happy sell) + the events-idempotency [R4] sell assertion. A user holding YES
// sells back to the pool via the comment-FREE sell flow. Load-bearing
// properties:
//   - the sell writes NO `comments` row and NO `bets` row (comment-free;
//     bets.comment_id NOT NULL forbids a bet row) [R4];
//   - PRIOR comments are UNTOUCHED (the entry's comment survives the sell);
//   - exactly ONE `bet.sold` event (aggregateType "market", aggregateId =
//     marketId; payload.betId is a synthetic fresh UUIDv7, not FK-bound) [R4];
//   - the sell credit is a `bet_stake` POSITIVE ledger row with bet_id = null;
//   - the position decreases (sold-to-zero → flat).
//
// Invariants exercised: INV-3 indirectly (a sell never moves a prior comment's
// frozen side — proven canonically in I-SIDE-BIND-001; asserted here as
// preservation).
//
// CI-RED (DB/route-backed): Postgres :54322 DOWN + greenfield sell-route import.
// REAL DB tx; externals mocked (sell SKIPS moderation per §3.1 — no precommit
// mock needed, but harmless to leave it). Money/share values are decimal STRINGS.

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

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
	computeBodyFingerprint: vi.fn(async () => "fp"),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: vi.fn(async () => {}),
	})),
}));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: vi.fn(async () => ({ outcome: "pass", categories: [] })),
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import { POST as sellPOST } from "@/app/api/bets/sell/route";
import {
	bets,
	comments,
	dharmaLedger,
	events,
	markets,
	pools,
	positions,
	users,
} from "@/db/schema";

import { testClient, testDb } from "../../db/_fixtures/db";

const SEED_RESERVES = "100.000000000000000000";

function req(path: string, body: unknown, idempotencyKey: string) {
	return new Request(`https://prd.example.com${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.22",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Sell User",
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
			title: "Sell Market",
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

async function seedDharmaGrant(userId: string): Promise<void> {
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount: "1000",
			entryType: "initial_grant",
		}),
	);
}

describe("ENGINE.8 F-BET-3 — comment-free sell [R4]", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
	});

	it("bet-sell::sell-preserves-comments", async () => {
		const userId = await seedUser("sell-pre", "sell-pre");
		const marketId = await seedOpenMarketWithPool("sell-pre-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// Entry: buy YES (writes ONE comment + ONE bet).
		const entry = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: "entry argument for sell" },
				"sell-pre-place",
			),
		);
		expect(entry.status).toBe(200);

		// Snapshot the prior comment + held quantity.
		const priorComments = await testDb
			.select({ id: comments.id, sideAtPostTime: comments.sideAtPostTime })
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(priorComments.length).toBe(1);
		const priorCommentId = priorComments[0]?.id ?? "";

		const held = await testDb
			.select({ quantity: positions.quantity })
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		const heldQuantity = held[0]?.quantity ?? "0";

		// SELL the full held quantity (comment-free).
		const sell = await sellPOST(
			req(
				"/api/bets/sell",
				{ marketId, shares: heldQuantity },
				"sell-pre-sell",
			),
		);
		expect(sell.status).toBe(200);
		// §4.4 success envelope (strict on the wrapper; `data` contents are the
		// implementer's open contract — not pinned).
		const payload = await sell.json();
		expect(payload.ok).toBe(true);
		expect(payload.data).toBeDefined();

		// Prior comment UNTOUCHED — still exactly one comment, same id + side.
		const afterSellComments = await testDb
			.select({ id: comments.id, sideAtPostTime: comments.sideAtPostTime })
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(afterSellComments.length).toBe(1);
		expect(afterSellComments[0]?.id).toBe(priorCommentId);
		expect(afterSellComments[0]?.sideAtPostTime).toBe("YES");

		// The sell wrote NO new bets row (still exactly the entry's one bet) [R4].
		const betRows = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(1);

		// Exactly ONE bet.sold event — aggregate "market", aggregateId = marketId
		// [R4]. (The place entry emitted bet.placed "bet" + comment.placed
		// "comment"; the sell adds exactly one "market"-scoped bet.sold.)
		const soldEvents = await testDb
			.select({
				eventType: events.eventType,
				aggregateType: events.aggregateType,
				aggregateId: events.aggregateId,
			})
			.from(events)
			.where(eq(events.eventType, "bet.sold"));
		expect(soldEvents.length).toBe(1);
		expect(soldEvents[0]?.aggregateType).toBe("market");
		expect(soldEvents[0]?.aggregateId).toBe(marketId);

		// The sell credit is a POSITIVE bet_stake ledger row with bet_id = null
		// (no bets row to link) [R4]. Find the most-recent bet_stake with no betId.
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
		// Positive credit (proceeds > 0) — first char is not '-'.
		expect(sellCredit?.amount.startsWith("-")).toBe(false);

		// Position is flat (sold the full held quantity → no held row).
		const { heldSideOrNull } = await import("@/server/positions/read");
		expect(await heldSideOrNull(testDb, { userId, marketId })).toBeNull();
	});
});
