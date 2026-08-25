import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";

import { bets, lots, markets, pools, positions, users } from "@/db/schema";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";

import { testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

/**
 * LOTS-1 Slice 4a — the MINT (ADR-0039 D-2 / R1). DB-BACKED (local Postgres
 * :54322). Tests-first per CLAUDE.md §5.6 — bet placement is named there
 * explicitly, and this adds a write to that spine.
 *
 * The claim under test is R1 as a STORAGE fact rather than a convention: a lot
 * exists if and only if a bet exists, it is minted inside the same W-1
 * SERIALIZABLE transaction, and it starts wholly intact. The interesting cases
 * are the ones where that could quietly stop being true — a reply (which is
 * also a bet), a second bet on the same side, and a rollback.
 */

const SEED = "1000.000000000000000000";

function userMetadata(userId: string, flowId: string) {
	return {
		request_id: "test-lots-mint",
		flow_id: flowId,
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

async function seedUser(tag: string, grant: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Lot Mint User",
			email: `${tag}@example.com`,
			pseudonym: tag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			// Suppress the Daily Credit so the balance is exactly the grant.
			lastAllowanceAccruedAt: new Date(),
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, { userId, amount: grant, entryType: "initial_grant" }),
	);
	return userId;
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Lot Mint Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: SEED, noReserves: SEED });
	return marketId;
}

async function placeBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	parentCommentId?: string | null;
}): Promise<{ betId: string; commentId: string; sharesBought: string }> {
	const result = await runBetTransaction(
		{ marketId: args.marketId, flow: "F-BET-1" },
		(ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body: `lot mint argument ${uuidv7()}`,
				parentCommentId: args.parentCommentId ?? null,
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				betEventId: uuidv7(),
				commentEventId: uuidv7(),
				creditEventId: uuidv7(),
				metadata: userMetadata(args.userId, "F-BET-1"),
			}),
	);
	return {
		betId: result.betId,
		commentId: result.commentId,
		sharesBought: result.sharesBought,
	};
}

const TABLES = [
	"lots",
	"bets",
	"comments",
	"positions",
	"dharma_ledger",
	"events",
	"pools",
	"markets",
	"users",
];

describe("LOTS-1 Slice 4a — lot mint (ADR-0039 D-2)", () => {
	afterEach(async () => {
		const { testClient } = await import("../../db/_fixtures/db");
		await truncateTables(testClient, TABLES);
	});

	it("mints exactly one lot per bet, carrying the bet's own shares and stake (R1)", async () => {
		const userId = await seedUser("lotmint1", "5000");
		const marketId = await seedOpenMarketWithPool("lot-mint-1");
		const placed = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "100",
		});

		const rows = await testDb
			.select()
			.from(lots)
			.where(eq(lots.betId, placed.betId));
		expect(rows).toHaveLength(1);
		const lot = rows[0];

		const [bet] = await testDb
			.select()
			.from(bets)
			.where(eq(bets.id, placed.betId));

		// The lot is the bet, decomposed — not a re-derivation of it.
		expect(lot?.originalShares).toBe(bet?.shareQuantity);
		expect(lot?.originalBasis).toBe(bet?.stake);
		expect(lot?.userId).toBe(userId);
		expect(lot?.marketId).toBe(marketId);
		expect(lot?.side).toBe("YES");
	});

	it("mints a wholly-intact lot — surviving equals original", async () => {
		const userId = await seedUser("lotmint2", "5000");
		const marketId = await seedOpenMarketWithPool("lot-mint-2");
		const placed = await placeBet({
			userId,
			marketId,
			side: "NO",
			stake: "250",
		});

		const [lot] = await testDb
			.select()
			.from(lots)
			.where(eq(lots.betId, placed.betId));
		expect(lot?.survivingShares).toBe(lot?.originalShares);
		expect(lot?.survivingBasis).toBe(lot?.originalBasis);
		expect(lot?.survivingBasis).toBe("250.000000000000000000");
	});

	it("mints a lot for a REPLY-bet too — a reply IS a bet (ADR-0017)", async () => {
		// The reply lane is where a missing mint would hide longest: replies are
		// the majority of an engaged participant's basis (RECON-1 measured 12 of
		// 39 held positions as majority-reply), and nothing else about the reply
		// path differs.
		const userId = await seedUser("lotmint3", "5000");
		const marketId = await seedOpenMarketWithPool("lot-mint-3");
		const post = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "100",
		});
		const reply = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "50",
			parentCommentId: post.commentId,
		});

		const rows = await testDb
			.select()
			.from(lots)
			.where(eq(lots.userId, userId));
		expect(rows).toHaveLength(2);
		const replyLot = rows.find((r) => r.betId === reply.betId);
		expect(replyLot?.originalBasis).toBe("50.000000000000000000");
	});

	it("mints a SECOND lot on a same-side add — it never merges into the first (R1)", async () => {
		// Merging would be the natural "optimisation" and would destroy the whole
		// feature: two arguments would become one row and neither could be sold
		// or marked Sold on its own.
		const userId = await seedUser("lotmint4", "5000");
		const marketId = await seedOpenMarketWithPool("lot-mint-4");
		const first = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "100",
		});
		const second = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "300",
		});

		const rows = await testDb
			.select()
			.from(lots)
			.where(eq(lots.userId, userId));
		expect(rows).toHaveLength(2);
		expect(rows.map((r) => r.betId).sort()).toEqual(
			[first.betId, second.betId].sort(),
		);
		expect(rows.find((r) => r.betId === second.betId)?.originalBasis).toBe(
			"300.000000000000000000",
		);
	});

	it("rolls the lot back with the bet — it is inside the W-1 tx, not beside it (INV-1)", async () => {
		// If the lot INSERT sat outside the transaction, a mid-spine abort would
		// leave an orphan lot pointing at a bet that never committed. Force an
		// abort AFTER place() has written everything and assert nothing survives.
		const userId = await seedUser("lotmint5", "5000");
		const marketId = await seedOpenMarketWithPool("lot-mint-5");

		await expect(
			runBetTransaction({ marketId, flow: "F-BET-1" }, async (ctx) => {
				await place(ctx, {
					userId,
					marketId,
					side: "YES",
					stake: "100",
					body: "argument that will be rolled back",
					parentCommentId: null,
					idempotencyKey: uuidv7(),
					bodyFingerprint: uuidv7(),
					betEventId: uuidv7(),
					commentEventId: uuidv7(),
					creditEventId: uuidv7(),
					metadata: userMetadata(userId, "F-BET-1"),
				});
				// Non-retryable plain Error (no `.code`) — the wrapper bubbles it
				// without retrying.
				throw new Error("forced abort after the full spine");
			}),
		).rejects.toThrow("forced abort after the full spine");

		expect(await testDb.select().from(lots)).toHaveLength(0);
		expect(await testDb.select().from(bets)).toHaveLength(0);
	});

	it("keeps Σ surviving lot shares equal to positions.quantity across three buys (R2)", async () => {
		const userId = await seedUser("lotmint6", "5000");
		const marketId = await seedOpenMarketWithPool("lot-mint-6");
		await placeBet({ userId, marketId, side: "YES", stake: "40" });
		await placeBet({ userId, marketId, side: "YES", stake: "50" });
		await placeBet({ userId, marketId, side: "YES", stake: "500" });

		const lotRows = await testDb
			.select()
			.from(lots)
			.where(eq(lots.userId, userId));
		expect(lotRows).toHaveLength(3);

		const [position] = await testDb
			.select()
			.from(positions)
			.where(eq(positions.userId, userId));

		// Exact string comparison via scaled integers — no tolerance.
		const units = (v: string): bigint => BigInt(v.replace(".", ""));
		const sum = lotRows.reduce(
			(acc, l) => acc + units(l.survivingShares),
			BigInt(0),
		);
		expect(sum).toBe(units(position?.quantity ?? "0.000000000000000000"));
	});
});
