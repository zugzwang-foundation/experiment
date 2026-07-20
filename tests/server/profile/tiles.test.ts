import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import {
	bets,
	comments,
	dharmaLedger,
	markets,
	modActions,
	users,
} from "@/db/schema";
import type { ProfilePositionRow } from "@/server/profile/positions";
import { loadProfileTiles } from "@/server/profile/tiles";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// UI.A5 Slice 2 §5.6 tests-first (plan §2 row 2 + §11) — the six §23 account
// tiles. VALUE import from `@/server/profile/tiles` FAILS at collection until
// Slice 2 lands — red-for-the-right-reason. DB-BACKED (local Postgres :54322).
//
// §17 row: profile::tile-derivations → `tiles.test.ts::derivations`
// (+ the `::lifetime-net-pl` extra). Positions value is a STRUCTURAL Σ over the
// PASSED rows (settled===false), never recomputed — the FI-2 inheritance law.

function dp18(intStr: string): string {
	return `${intStr}.000000000000000000`;
}

async function seedUser(pseudonym: string, emailTag: string): Promise<string> {
	const id = uuidv7();
	await testDb.insert(users).values({
		id,
		name: `Fixture ${emailTag}`,
		email: `${emailTag}@example.com`,
		pseudonym,
		emailVerified: false,
	});
	return id;
}

async function seedMarket(slug: string): Promise<string> {
	const id = uuidv7();
	await testDb.insert(markets).values({
		id,
		slug,
		title: `Market ${slug}`,
		status: "Open",
		resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
	});
	return id;
}

async function seedComment(args: {
	userId: string;
	marketId: string;
	body: string;
	side: "YES" | "NO";
	parentCommentId?: string;
	createdAt: Date;
}): Promise<string> {
	const id = uuidv7();
	await testDb.insert(comments).values({
		id,
		userId: args.userId,
		marketId: args.marketId,
		parentCommentId: args.parentCommentId ?? null,
		body: args.body,
		sideAtPostTime: args.side,
		createdAt: args.createdAt,
	});
	return id;
}

async function seedBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	commentId: string;
	createdAt: Date;
}): Promise<void> {
	await testDb.insert(bets).values({
		id: uuidv7(),
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		stake: args.stake,
		shareQuantity: dp18("1"),
		priceAtBet: "0.500000000000000000",
		commentId: args.commentId,
		createdAt: args.createdAt,
	});
}

async function seedLedgerRow(args: {
	userId: string;
	entryType: "initial_grant" | "daily_allowance" | "bet_stake" | "bet_payout";
	amount: string;
	balanceAfter: string;
}): Promise<void> {
	await testDb.insert(dharmaLedger).values({
		userId: args.userId,
		entryType: args.entryType,
		amount: args.amount,
		balanceAfter: args.balanceAfter,
	});
}

async function seedRemoval(commentId: string): Promise<void> {
	await testDb.insert(modActions).values({
		targetCommentId: commentId,
		reason: "content_removed",
		categories: {},
		actorId: "admin-singleton",
	});
}

/** A full ProfilePositionRow with the given settled/current overrides. */
function makeRow(o: {
	marketId: string;
	settled: boolean;
	current: string;
}): ProfilePositionRow {
	return {
		marketId: o.marketId,
		marketSlug: `slug-${o.marketId}`,
		marketTitle: "Title",
		marketStatus: "Open",
		statusLabel: "Open",
		settled: o.settled,
		side: "YES",
		quantity: dp18("1"),
		staked: dp18("1"),
		current: o.current,
		argument: { removed: true, marketSlug: `slug-${o.marketId}` },
	};
}

describe("UI.A5 Slice 2 — loadProfileTiles (six §23 account tiles)", () => {
	afterEach(async () => {
		await truncateTables(testClient, [
			"mod_actions",
			"dharma_ledger",
			"bets",
			"comments",
			"markets",
			"users",
		]);
		vi.clearAllMocks();
	});

	it("derivations", async () => {
		const userA = await seedUser("tiles-user-a", "tiles-a");
		const userB = await seedUser("tiles-user-b", "tiles-b");
		const userC = await seedUser("tiles-user-c", "tiles-c");
		const userE = await seedUser("tiles-user-e", "tiles-e");
		const userF = await seedUser("tiles-user-f", "tiles-f");
		const marketId = await seedMarket("m-tiles");

		// Wallet chain: +1000 grant, +50 daily, −200 stake, +300 payout ⇒ 1150.
		await seedLedgerRow({
			userId: userA,
			entryType: "initial_grant",
			amount: dp18("1000"),
			balanceAfter: dp18("1000"),
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "daily_allowance",
			amount: dp18("50"),
			balanceAfter: dp18("1050"),
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "bet_stake",
			amount: dp18("-200"),
			balanceAfter: dp18("850"),
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "bet_payout",
			amount: dp18("300"),
			balanceAfter: dp18("1150"),
		});

		// Top-level posts (each a real post-bet). postX is userE's — NOT userA's.
		const postX = await seedComment({
			userId: userE,
			marketId,
			body: "Post X by another author",
			side: "YES",
			createdAt: new Date("2026-09-05T00:00:00Z"),
		});
		await seedBet({
			userId: userE,
			marketId,
			side: "YES",
			stake: dp18("10"),
			commentId: postX,
			createdAt: new Date("2026-09-05T00:00:00Z"),
		});
		const post1 = await seedComment({
			userId: userA,
			marketId,
			body: "Post 1 by the profile user",
			side: "YES",
			createdAt: new Date("2026-09-06T00:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId,
			side: "YES",
			stake: dp18("20"),
			commentId: post1,
			createdAt: new Date("2026-09-06T00:00:00Z"),
		});
		const post2 = await seedComment({
			userId: userA,
			marketId,
			body: "Post 2 by the profile user, later removed",
			side: "YES",
			createdAt: new Date("2026-09-07T00:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId,
			side: "YES",
			stake: dp18("20"),
			commentId: post2,
			createdAt: new Date("2026-09-07T00:00:00Z"),
		});
		// post2 is content_removed — but STILL counted in the tiles.
		await seedRemoval(post2);

		// Reply-bets on userA's posts (same side = Support, opposite = Counter).
		const r1 = await seedComment({
			userId: userB,
			marketId,
			body: "Support reply to post 1",
			side: "YES",
			parentCommentId: post1,
			createdAt: new Date("2026-09-08T00:00:00Z"),
		});
		await seedBet({
			userId: userB,
			marketId,
			side: "YES",
			stake: dp18("40"),
			commentId: r1,
			createdAt: new Date("2026-09-08T00:00:00Z"),
		});
		const r2 = await seedComment({
			userId: userC,
			marketId,
			body: "Counter reply to post 1",
			side: "NO",
			parentCommentId: post1,
			createdAt: new Date("2026-09-09T00:00:00Z"),
		});
		await seedBet({
			userId: userC,
			marketId,
			side: "NO",
			stake: dp18("25"),
			commentId: r2,
			createdAt: new Date("2026-09-09T00:00:00Z"),
		});
		// Reply to the REMOVED post2 — its attracted Dharma still counts.
		const r4 = await seedComment({
			userId: userB,
			marketId,
			body: "Support reply to the removed post 2",
			side: "YES",
			parentCommentId: post2,
			createdAt: new Date("2026-09-10T00:00:00Z"),
		});
		await seedBet({
			userId: userB,
			marketId,
			side: "YES",
			stake: dp18("15"),
			commentId: r4,
			createdAt: new Date("2026-09-10T00:00:00Z"),
		});
		// Reply on SOMEONE ELSE's post (postX) — must NOT count for userA.
		const r3 = await seedComment({
			userId: userF,
			marketId,
			body: "Reply to post X, not userA's",
			side: "YES",
			parentCommentId: postX,
			createdAt: new Date("2026-09-11T00:00:00Z"),
		});
		await seedBet({
			userId: userF,
			marketId,
			side: "YES",
			stake: dp18("999"),
			commentId: r3,
			createdAt: new Date("2026-09-11T00:00:00Z"),
		});
		// userA's OWN reply (to postX) — a reply attracts nothing; counted only
		// in the arguments tally, never in Support/Counter.
		const rOwn = await seedComment({
			userId: userA,
			marketId,
			body: "userA's own reply to post X",
			side: "YES",
			parentCommentId: postX,
			createdAt: new Date("2026-09-12T00:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId,
			side: "YES",
			stake: dp18("10"),
			commentId: rOwn,
			createdAt: new Date("2026-09-12T00:00:00Z"),
		});

		// Positions value = Σ over PASSED unsettled rows: 120 + 80 = 200
		// (the settled=true 999 row is excluded).
		const passed = [
			makeRow({ marketId: uuidv7(), settled: false, current: dp18("120") }),
			makeRow({ marketId: uuidv7(), settled: false, current: dp18("80") }),
			makeRow({ marketId: uuidv7(), settled: true, current: dp18("999") }),
		];

		const tiles = await loadProfileTiles(testDb, {
			userId: userA,
			positions: passed,
		});

		expect(tiles.walletValue).toBe(dp18("1150"));
		expect(tiles.positionsValue).toBe(dp18("200"));
		// Net P/L (lifetime) = (wallet 1150 + positions 200) − issuance 1050 = 300.
		expect(tiles.netProfitLoss).toBe(dp18("300"));
		// posts (post1, post2 incl. removed) = 2; replies (rOwn) = 1; total 3.
		expect(tiles.argumentsCount).toEqual({ total: 3, posts: 2, replies: 1 });
		// Support = R1 40 + R4 15 = 55; Counter = R2 25. R3/rOwn excluded.
		expect(tiles.supportReceived).toBe(dp18("55"));
		expect(tiles.counterReceived).toBe(dp18("25"));
	});

	it("lifetime-net-pl", async () => {
		// A LOSS: wallet 300 (grant 1000 + daily 100 − stake 800), positions 200 ⇒
		// net worth 500; issuance 1100; Net P/L = 500 − 1100 = −600 (leading '-').
		const userA = await seedUser("net-pl-user", "net-pl");
		await seedLedgerRow({
			userId: userA,
			entryType: "initial_grant",
			amount: dp18("1000"),
			balanceAfter: dp18("1000"),
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "daily_allowance",
			amount: dp18("100"),
			balanceAfter: dp18("1100"),
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "bet_stake",
			amount: dp18("-800"),
			balanceAfter: dp18("300"),
		});

		const passed = [
			makeRow({ marketId: uuidv7(), settled: false, current: dp18("200") }),
		];

		const tiles = await loadProfileTiles(testDb, {
			userId: userA,
			positions: passed,
		});

		expect(tiles.walletValue).toBe(dp18("300"));
		expect(tiles.positionsValue).toBe(dp18("200"));
		expect(tiles.netProfitLoss).toBe("-600.000000000000000000");
		expect(tiles.netProfitLoss.startsWith("-")).toBe(true);
	});
});
