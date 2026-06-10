import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ENGINE.8 F-BET acceptance — `subsequent-buy.test.ts::happy-path-requires-
// comment` (F-BET-2 same-side add). A user already HOLDING YES adds MORE on the
// SAME side via the place flow. Two load-bearing properties:
//   (1) the subsequent buy still REQUIRES a comment (INV-1 — no bet without a
//       comment, even a same-side add) → a SECOND comment row appears;
//   (2) the position accumulates (quantity grows; still a single held YES row —
//       the single-held-side guarantee holds).
//
// Invariants exercised: INV-1 (mandatory commentary on the subsequent bet too).
//
// CI-RED (DB/route-backed): Postgres :54322 DOWN + greenfield place-route import.
// REAL DB tx; externals mocked. Money/share values are decimal STRINGS.

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
import {
	comments,
	dharmaLedger,
	markets,
	pools,
	positions,
	users,
} from "@/db/schema";
// ENGINE.12 (RC9): greenfield constant import — balance math after a paying
// first place tracks the live constant, not a literal.
import { DAILY_CREDIT_DHARMA } from "@/server/config/limits";
import { CpmmDecimal } from "@/server/cpmm/decimal";

import { testClient, testDb } from "../../db/_fixtures/db";

const SEED_RESERVES = "100.000000000000000000";

function placeRequest(body: unknown, idempotencyKey: string) {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.21",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Subsequent-Buy User",
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
			title: "Subsequent-Buy Market",
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

describe("ENGINE.8 F-BET-2 — same-side subsequent buy (INV-1)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
	});

	it("bet-place::happy-path-requires-comment", async () => {
		const userId = await seedUser("subseq", "subseq");
		const marketId = await seedOpenMarketWithPool("subseq-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// First YES buy (entry).
		const first = await placePOST(
			placeRequest(
				{ marketId, side: "YES", stake: "10", body: "first YES argument" },
				"subseq-key-1",
			),
		);
		expect(first.status).toBe(200);

		// Read the held quantity after entry.
		const afterEntry = await testDb
			.select({ quantity: positions.quantity })
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(afterEntry.length).toBe(1);
		const entryQuantity = afterEntry[0]?.quantity ?? "0";

		// SECOND YES buy on the SAME side — requires its OWN comment (INV-1).
		const second = await placePOST(
			placeRequest(
				{ marketId, side: "YES", stake: "10", body: "second YES argument" },
				"subseq-key-2",
			),
		);
		expect(second.status).toBe(200);
		// §4.4 success envelope (strict on the wrapper; `data` contents are the
		// implementer's open contract — not pinned).
		const payload = await second.json();
		expect(payload.ok).toBe(true);
		expect(payload.data).toBeDefined();

		// (1) INV-1: the subsequent bet rode its OWN comment → TWO comments now.
		const commentRows = await testDb
			.select({ id: comments.id, sideAtPostTime: comments.sideAtPostTime })
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(2);
		expect(commentRows.every((c) => c.sideAtPostTime === "YES")).toBe(true);

		// (2) position accumulated — still a SINGLE held YES row, quantity grew.
		const afterSecond = await testDb
			.select({ side: positions.side, quantity: positions.quantity })
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(afterSecond.length).toBe(1);
		expect(afterSecond[0]?.side).toBe("YES");
		expect(
			BigInt(afterSecond[0]?.quantity.split(".")[0] ?? "0"),
		).toBeGreaterThan(BigInt(entryQuantity.split(".")[0] ?? "0"));

		// ENGINE.12 (RC9): the FIRST place of the UTC day paid the Daily Credit;
		// the same-day subsequent buy paid NOTHING — exactly ONE daily_allowance
		// row, and both stake debits chain off the post-credit running balance
		// (grant 1000 → +credit → −10 → −10).
		const ledgerRows = await testDb
			.select({
				entryType: dharmaLedger.entryType,
				balanceAfter: dharmaLedger.balanceAfter,
			})
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		const creditRows = ledgerRows.filter(
			(r) => r.entryType === "daily_allowance",
		);
		expect(creditRows.length).toBe(1);
		expect(creditRows[0]?.balanceAfter).toBe(
			new CpmmDecimal("1000").plus(DAILY_CREDIT_DHARMA).toFixed(18),
		);
		const stakeBalances = ledgerRows
			.filter((r) => r.entryType === "bet_stake")
			.map((r) => r.balanceAfter);
		expect(stakeBalances.length).toBe(2);
		expect(stakeBalances).toContain(
			new CpmmDecimal("1000").plus(DAILY_CREDIT_DHARMA).minus("10").toFixed(18),
		);
		expect(stakeBalances).toContain(
			new CpmmDecimal("1000").plus(DAILY_CREDIT_DHARMA).minus("20").toFixed(18),
		);
	});
});
