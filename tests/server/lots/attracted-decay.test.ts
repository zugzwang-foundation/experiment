import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { lots, markets, pools, users } from "@/db/schema";
import { place } from "@/server/bets/place";
import { sell } from "@/server/bets/sell";
import { runBetTransaction } from "@/server/bets/transaction";
import { loadRankingSubstrate } from "@/server/debate-view/ranking-substrate";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

/**
 * LOTS-1 Slice 9 — **attracted value decays** (ADR-0039 R4 + R5). DB-BACKED.
 *
 * R5: *"support_dharma / counter_dharma decay when a replier's lot sells down."*
 *
 * The semantics this changes are worth stating: the aggregate used to report
 * *conviction once expressed* and now reports *conviction currently held*. A
 * replier who exits withdraws the weight they lent the parent. The historical
 * figure is not lost — `bets.stake` is Bucket-A immutable and still readable —
 * it simply stops being what this number means.
 */

const SEED = "1000.000000000000000000";
/** 18-dp decimal string → exact scaled integer. */
const units = (v: string): bigint => BigInt(v.replace(".", ""));
/** A bare literal → its canonical 18-dp form, so `units()` scales it correctly.
 *  ⚠ `units(dp18("200"))` is 200n, NOT 200e18 — comparing a DB value against an
 *  unpadded literal silently compares different scales. */
const dp18 = (v: string): string => {
	const [int, frac = ""] = v.split(".");
	return `${int}.${frac.padEnd(18, "0")}`;
};

const TABLES = [
	"lots",
	"bets",
	"comments",
	"positions",
	"dharma_ledger",
	"events",
	"bet_receipts",
	"pools",
	"markets",
	"users",
];

function meta(userId: string, flowId: string) {
	return {
		request_id: "test-attracted-decay",
		flow_id: flowId,
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Decay User",
			email: `${tag}@example.com`,
			pseudonym: tag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			lastAllowanceAccruedAt: new Date(),
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount: "5000",
			entryType: "initial_grant",
		}),
	);
	return userId;
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Decay Market",
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
	const r = await runBetTransaction(
		{ marketId: args.marketId, flow: "F-BET-1" },
		(ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body: `decay argument ${uuidv7()}`,
				parentCommentId: args.parentCommentId ?? null,
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				betEventId: uuidv7(),
				commentEventId: uuidv7(),
				creditEventId: uuidv7(),
				metadata: meta(args.userId, "F-BET-1"),
			}),
	);
	return { betId: r.betId, commentId: r.commentId };
}

describe("LOTS-1 Slice 9 — attracted value decays (ADR-0039 R4/R5)", () => {
	afterEach(async () => {
		await truncateTables(testClient, TABLES);
	});

	it("support_dharma FALLS when the replier sells their argument down", async () => {
		const author = await seedUser("decay-author");
		const replier = await seedUser("decay-replier");
		const marketId = await seedOpenMarketWithPool("m-decay-support");

		const post = await placeBet({
			userId: author,
			marketId,
			side: "YES",
			stake: "100",
		});
		// A SUPPORT reply — same side as the parent.
		const reply = await placeBet({
			userId: replier,
			marketId,
			side: "YES",
			stake: "200",
			parentCommentId: post.commentId,
		});

		const before = await loadRankingSubstrate(db, { marketId });
		const beforeRow = before.find((r) => r.id === post.commentId);
		expect(units(beforeRow?.supportDharma ?? "0")).toBe(units(dp18("200")));

		// The replier exits HALF of that argument, per-lot.
		const [lot] = await testDb
			.select()
			.from(lots)
			.where(eq(lots.betId, reply.betId));
		const half = units(lot?.survivingShares ?? "0") / BigInt(2);
		const SCALE = BigInt(`1${"0".repeat(18)}`);
		const halfStr = `${half / SCALE}.${(half % SCALE).toString().padStart(18, "0")}`;

		await runBetTransaction({ marketId, flow: "F-BET-3" }, (ctx) =>
			sell(ctx, {
				userId: replier,
				marketId,
				shares: halfStr,
				lotId: lot?.id,
				sellEventId: uuidv7(),
				syntheticBetId: uuidv7(),
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				metadata: meta(replier, "F-BET-3"),
			}),
		);

		const after = await loadRankingSubstrate(db, { marketId });
		const afterRow = after.find((r) => r.id === post.commentId);
		// R5 — the weight lent to the parent is withdrawn with the position.
		expect(units(afterRow?.supportDharma ?? "0")).toBeLessThan(
			units(dp18("200")),
		);
		// …and it is the SURVIVING basis, not an arbitrary reduction: half the
		// shares gone, half the basis left.
		expect(units(afterRow?.supportDharma ?? "0")).toBe(units(dp18("100")));
	});

	it("support_dharma reaches ZERO when the replier exits entirely", async () => {
		const author = await seedUser("decay-author-2");
		const replier = await seedUser("decay-replier-2");
		const marketId = await seedOpenMarketWithPool("m-decay-zero");

		const post = await placeBet({
			userId: author,
			marketId,
			side: "YES",
			stake: "100",
		});
		const reply = await placeBet({
			userId: replier,
			marketId,
			side: "YES",
			stake: "200",
			parentCommentId: post.commentId,
		});

		const [lot] = await testDb
			.select()
			.from(lots)
			.where(eq(lots.betId, reply.betId));
		await runBetTransaction({ marketId, flow: "F-BET-3" }, (ctx) =>
			sell(ctx, {
				userId: replier,
				marketId,
				shares: lot?.survivingShares ?? "0",
				lotId: lot?.id,
				sellEventId: uuidv7(),
				syntheticBetId: uuidv7(),
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				metadata: meta(replier, "F-BET-3"),
			}),
		);

		const after = await loadRankingSubstrate(db, { marketId });
		const row = after.find((r) => r.id === post.commentId);
		expect(units(row?.supportDharma ?? "0")).toBe(BigInt(0));
		// ⚠ The COUNT does NOT decay — the reply still exists and was still made.
		// Only the Dharma weight is withdrawn. Conflating the two would erase the
		// argument itself from the record, which R9 forbids.
		expect(row?.supportCount).toBe(1);
	});

	it("counter_dharma decays on the OPPOSITE side by the same rule", async () => {
		const author = await seedUser("decay-author-3");
		const replier = await seedUser("decay-replier-3");
		const marketId = await seedOpenMarketWithPool("m-decay-counter");

		const post = await placeBet({
			userId: author,
			marketId,
			side: "YES",
			stake: "100",
		});
		// A COUNTER reply — the opposite side of the parent.
		const reply = await placeBet({
			userId: replier,
			marketId,
			side: "NO",
			stake: "200",
			parentCommentId: post.commentId,
		});

		const before = await loadRankingSubstrate(db, { marketId });
		expect(
			units(before.find((r) => r.id === post.commentId)?.counterDharma ?? "0"),
		).toBe(units(dp18("200")));

		const [lot] = await testDb
			.select()
			.from(lots)
			.where(eq(lots.betId, reply.betId));
		await runBetTransaction({ marketId, flow: "F-BET-3" }, (ctx) =>
			sell(ctx, {
				userId: replier,
				marketId,
				shares: lot?.survivingShares ?? "0",
				lotId: lot?.id,
				sellEventId: uuidv7(),
				syntheticBetId: uuidv7(),
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				metadata: meta(replier, "F-BET-3"),
			}),
		);

		const after = await loadRankingSubstrate(db, { marketId });
		expect(
			units(after.find((r) => r.id === post.commentId)?.counterDharma ?? "0"),
		).toBe(BigInt(0));
	});

	it("leaves the frozen historical stake readable on the bet (R9)", async () => {
		// The decay is a change of MEANING for the aggregate, not a deletion. The
		// stake as placed survives in Bucket-A `bets` and is still the number the
		// public dataset can reconstruct.
		const author = await seedUser("decay-author-4");
		const replier = await seedUser("decay-replier-4");
		const marketId = await seedOpenMarketWithPool("m-decay-frozen");
		const post = await placeBet({
			userId: author,
			marketId,
			side: "YES",
			stake: "100",
		});
		const reply = await placeBet({
			userId: replier,
			marketId,
			side: "YES",
			stake: "200",
			parentCommentId: post.commentId,
		});

		const [lot] = await testDb
			.select()
			.from(lots)
			.where(eq(lots.betId, reply.betId));
		await runBetTransaction({ marketId, flow: "F-BET-3" }, (ctx) =>
			sell(ctx, {
				userId: replier,
				marketId,
				shares: lot?.survivingShares ?? "0",
				lotId: lot?.id,
				sellEventId: uuidv7(),
				syntheticBetId: uuidv7(),
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				metadata: meta(replier, "F-BET-3"),
			}),
		);

		const { bets } = await import("@/db/schema");
		const [betRow] = await testDb
			.select({ stake: bets.stake })
			.from(bets)
			.where(eq(bets.id, reply.betId));
		expect(betRow?.stake).toBe("200.000000000000000000");
		// …and the lot records that none of it survives.
		const [after] = await testDb
			.select()
			.from(lots)
			.where(eq(lots.betId, reply.betId));
		expect(after?.survivingBasis).toBe("0.000000000000000000");
		expect(after?.originalBasis).toBe("200.000000000000000000");
	});
});
