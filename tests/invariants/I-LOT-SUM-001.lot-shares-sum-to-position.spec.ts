import { and, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";

import { lots, markets, pools, positions, users } from "@/db/schema";
import { place } from "@/server/bets/place";
import { sell } from "@/server/bets/sell";
import { runBetTransaction } from "@/server/bets/transaction";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

/**
 * I-LOT-SUM-001 — **Σ surviving lot shares == `positions.quantity`, per
 * (user, market, side)**. ADR-0039 R2. Minted at LOTS-1.
 *
 * Invariant-CLASS spec rule, not one of the four hard-locked INV-1…INV-4 — the
 * `I-NO-OVERSELL-001` / `I-SINGLE-SIDE-001` class. It exists because a
 * decomposition that can drift from its own total is worse than no
 * decomposition: it renders a breakdown that disagrees with the number above
 * it, and it looks like an answer while doing so.
 *
 * **Storage backstop, stated precisely because it is PARTIAL.** No single
 * constraint can enforce a cross-table equality in Postgres without a trigger,
 * and `lots` is Bucket C by design (ADR-0039 D-1) — so the storage layer bounds
 * every SUMMAND rather than the sum: `lots_surviving_shares_non_negative` and
 * `lots_surviving_shares_monotone` make each lot's contribution lie in
 * [0, original], so no single row can wander and drag the aggregate with it.
 * The EQUALITY itself is held by the application — both writes live in one W-1
 * SERIALIZABLE transaction behind the same pool-row lock — and is asserted
 * here, over live rows written by the real engine.
 *
 * DB-BACKED (local Postgres :54322). Every quantity is compared as an exact
 * scaled integer; a tolerance anywhere in this file would defeat its purpose.
 */

const SEED = "1000.000000000000000000";

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

/** 18-dp decimal string → exact scaled integer. No float, no tolerance. */
const units = (v: string): bigint => BigInt(v.replace(".", ""));

function userMetadata(userId: string) {
	return {
		request_id: "test-i-lot-sum-001",
		flow_id: "F-BET-1",
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
			name: "Lot Sum User",
			email: `${tag}@example.com`,
			pseudonym: tag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
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
			title: "Lot Sum Market",
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
}): Promise<{ betId: string; commentId: string }> {
	const result = await runBetTransaction(
		{ marketId: args.marketId, flow: "F-BET-1" },
		(ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body: `lot sum argument ${uuidv7()}`,
				parentCommentId: args.parentCommentId ?? null,
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				betEventId: uuidv7(),
				commentEventId: uuidv7(),
				creditEventId: uuidv7(),
				metadata: userMetadata(args.userId),
			}),
	);
	return { betId: result.betId, commentId: result.commentId };
}

/**
 * Σ surviving lot shares for (user, market, side), as an exact integer. The
 * predicate is the FULL invariant key — filtering on `user_id` alone would
 * still pass every assertion in this file (one market each) while silently
 * testing a weaker statement than the one R2 makes.
 */
async function lotShareSum(
	userId: string,
	marketId: string,
	side: "YES" | "NO",
): Promise<bigint> {
	const rows = await testDb
		.select({ survivingShares: lots.survivingShares })
		.from(lots)
		.where(
			and(
				eq(lots.userId, userId),
				eq(lots.marketId, marketId),
				eq(lots.side, side),
			),
		);
	return rows.reduce((acc, r) => acc + units(r.survivingShares), BigInt(0));
}

/** `positions.quantity` for (user, market, side), as an exact integer. */
async function positionQuantity(
	userId: string,
	marketId: string,
	side: "YES" | "NO",
): Promise<bigint> {
	const rows = await testDb
		.select({ quantity: positions.quantity })
		.from(positions)
		.where(
			and(
				eq(positions.userId, userId),
				eq(positions.marketId, marketId),
				eq(positions.side, side),
			),
		);
	return units(rows[0]?.quantity ?? "0.000000000000000000");
}

/** A sell through the real engine — position-level, or per-lot when `lotId` is given. */
async function sellShares(args: {
	userId: string;
	marketId: string;
	shares: string;
	lotId?: string;
}) {
	return runBetTransaction(
		{ marketId: args.marketId, flow: "F-BET-3" },
		(ctx) =>
			sell(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				shares: args.shares,
				lotId: args.lotId ?? null,
				sellEventId: uuidv7(),
				syntheticBetId: uuidv7(),
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				metadata: { ...userMetadata(args.userId), flow_id: "F-BET-3" },
			}),
	);
}

/** An exact 18-dp decimal string from scaled integer units. */
function fromUnits(u: bigint): string {
	const SCALE = BigInt(`1${"0".repeat(18)}`);
	return `${u / SCALE}.${(u % SCALE).toString().padStart(18, "0")}`;
}

describe("I-LOT-SUM-001 — Σ surviving lot shares == positions.quantity (ADR-0039 R2)", () => {
	afterEach(async () => {
		await truncateTables(testClient, TABLES);
	});

	it("holds after a single buy", async () => {
		const userId = await seedUser("lotsum1", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sum-1");
		await placeBet({ userId, marketId, side: "YES", stake: "100" });

		expect(await lotShareSum(userId, marketId, "YES")).toBe(
			await positionQuantity(userId, marketId, "YES"),
		);
	});

	it("holds after four buys at four different prices", async () => {
		// Four bets move the pool between each, so every lot is bought at a
		// different price and no two lots share a shares-to-basis ratio. That is
		// the case where a naive "just divide the total" attribution goes wrong,
		// and where this invariant has something to say.
		const userId = await seedUser("lotsum2", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sum-2");
		const post = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "40",
		});
		await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "50",
			parentCommentId: post.commentId,
		});
		await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "500",
			parentCommentId: post.commentId,
		});
		await placeBet({ userId, marketId, side: "YES", stake: "90" });

		const rows = await testDb
			.select()
			.from(lots)
			.where(eq(lots.userId, userId));
		expect(rows).toHaveLength(4);
		// Positive control on the premise: the four lots really do differ in
		// price, so the equality is not holding by everything being identical.
		//
		// ⚠ The ratio is SCALED before dividing. A bare
		// `units(shares) / units(basis)` is BigInt division, which truncates — and
		// since every lot here buys roughly two shares per Đ, all four collapsed
		// to `1` and this control asserted nothing while looking like it did.
		// Scaling by 1e18 first keeps 18 significant digits of the price.
		const SCALE = BigInt(`1${"0".repeat(18)}`);
		const ratios = new Set(
			rows.map(
				(r) => `${(units(r.originalShares) * SCALE) / units(r.originalBasis)}`,
			),
		);
		expect(ratios.size).toBeGreaterThan(1);

		expect(await lotShareSum(userId, marketId, "YES")).toBe(
			await positionQuantity(userId, marketId, "YES"),
		);
	});

	it("holds across two users in one market — lots never cross a user boundary", async () => {
		const a = await seedUser("lotsum3a", "5000");
		const b = await seedUser("lotsum3b", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sum-3");
		await placeBet({ userId: a, marketId, side: "YES", stake: "100" });
		await placeBet({ userId: b, marketId, side: "YES", stake: "200" });
		await placeBet({ userId: a, marketId, side: "YES", stake: "300" });

		expect(await lotShareSum(a, marketId, "YES")).toBe(
			await positionQuantity(a, marketId, "YES"),
		);
		expect(await lotShareSum(b, marketId, "YES")).toBe(
			await positionQuantity(b, marketId, "YES"),
		);
	});

	it("holds after a POSITION-LEVEL partial sell through the real engine", async () => {
		// The case the invariant exists for. Until LOTS-1 Slice 5 the engine moved
		// `positions` and left `lots` untouched, so this equality broke on the
		// FIRST sell any participant ever made.
		const userId = await seedUser("lotsum8", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sum-8");
		await placeBet({ userId, marketId, side: "YES", stake: "100" });
		await placeBet({ userId, marketId, side: "YES", stake: "300" });

		const before = await positionQuantity(userId, marketId, "YES");
		await sellShares({
			userId,
			marketId,
			shares: fromUnits(before / BigInt(3)),
		});

		const after = await positionQuantity(userId, marketId, "YES");
		expect(after).toBeLessThan(before);
		expect(await lotShareSum(userId, marketId, "YES")).toBe(after);
	});

	it("holds after a PER-LOT sell that empties ONE argument and leaves the rest", async () => {
		const userId = await seedUser("lotsum9", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sum-9");
		const first = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "100",
		});
		await placeBet({ userId, marketId, side: "YES", stake: "300" });

		const [target] = await testDb
			.select()
			.from(lots)
			.where(eq(lots.betId, first.betId));
		await sellShares({
			userId,
			marketId,
			shares: target?.survivingShares ?? "0",
			lotId: target?.id,
		});

		// One lot Sold, one untouched, and the aggregate still exact.
		expect(await lotShareSum(userId, marketId, "YES")).toBe(
			await positionQuantity(userId, marketId, "YES"),
		);
	});

	it("holds after a FULL exit — every lot Sold, both sides of the equality zero", async () => {
		const userId = await seedUser("lotsum10", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sum-10");
		await placeBet({ userId, marketId, side: "YES", stake: "40" });
		await placeBet({ userId, marketId, side: "YES", stake: "50" });

		const qty = await positionQuantity(userId, marketId, "YES");
		await sellShares({ userId, marketId, shares: fromUnits(qty) });

		expect(await positionQuantity(userId, marketId, "YES")).toBe(BigInt(0));
		expect(await lotShareSum(userId, marketId, "YES")).toBe(BigInt(0));
	});

	it("STORAGE BACKSTOP: a lot cannot be pushed above its original shares (23514)", async () => {
		// The equality is application-held, so the storage layer instead bounds
		// each SUMMAND. This is the fixture-bypass proof that the bound has teeth
		// — a direct UPDATE, going around every application path.
		const userId = await seedUser("lotsum4", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sum-4");
		const placed = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "100",
		});

		await expect(
			testClient.unsafe(
				`UPDATE lots SET surviving_shares = original_shares + 1 WHERE bet_id = '${placed.betId}'`,
			),
		).rejects.toMatchObject({ code: "23514" });
	});

	it("STORAGE BACKSTOP: a lot cannot be driven negative (23514)", async () => {
		const userId = await seedUser("lotsum5", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sum-5");
		const placed = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "100",
		});

		await expect(
			testClient.unsafe(
				`UPDATE lots SET surviving_shares = -1 WHERE bet_id = '${placed.betId}'`,
			),
		).rejects.toMatchObject({ code: "23514" });
	});

	it("STORAGE BACKSTOP: a fully-sold lot cannot keep a basis (23514)", async () => {
		// R6/R10 — `Sold` must be exact. If a zero-share lot could retain basis,
		// Đa would count an argument the participant no longer holds.
		const userId = await seedUser("lotsum6", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sum-6");
		const placed = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "100",
		});

		await expect(
			testClient.unsafe(
				`UPDATE lots SET surviving_shares = 0 WHERE bet_id = '${placed.betId}'`,
			),
		).rejects.toMatchObject({ code: "23514" });
	});

	it("STORAGE BACKSTOP: one bet cannot carry two lots (23505 on lots_bet_id_uq)", async () => {
		// R1's 1:1. If a bet could carry two lots, the sum would double-count the
		// argument and the invariant would fail in the direction that is hardest
		// to notice — a basis that is too LARGE reads as a healthy position.
		const userId = await seedUser("lotsum7", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sum-7");
		const placed = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "100",
		});

		await expect(
			testClient.unsafe(
				`INSERT INTO lots (bet_id, user_id, market_id, side, original_shares, original_basis, surviving_shares, surviving_basis)
				 SELECT bet_id, user_id, market_id, side, original_shares, original_basis, surviving_shares, surviving_basis
				 FROM lots WHERE bet_id = '${placed.betId}'`,
			),
		).rejects.toMatchObject({ code: "23505" });
	});
});
