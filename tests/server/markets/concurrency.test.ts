import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { bets, comments, events, markets, pools, users } from "@/db/schema";
import {
	BetSerializationExhaustedError,
	MarketNotOpenError,
} from "@/server/bets/errors";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { appendLedgerRow } from "@/server/dharma/persist";
import { closeMarket } from "@/server/markets/close";
import { MarketLifecycleStateError } from "@/server/markets/errors";
import { openMarket } from "@/server/markets/open";

import { testClient, testDb } from "../../db/_fixtures/db";

// ENGINE.14 §5.6 tests-first (S1, plan §Test plan charter) — the W-4
// concurrency pair (X1–X2): opened-exactly-once under a double open, and the
// §Wrapper (b) close-vs-bet SSI story. Greenfield VALUE imports from
// `@/server/markets/{open,close}` + `@/server/markets/errors` RED at
// collection until S2 lands. DB-BACKED (:54322). Concurrency is built WITHIN
// one test via Promise.allSettled (fileParallelism:false — ENGINE.7 style).

const SEED = "100.000000000000000000";
const NOW = new Date("2026-07-01T00:00:00.000Z");
const DEADLINE = new Date("2026-08-01T00:00:00.000Z");

function adminMetadata(flowId: string) {
	return {
		request_id: "test-engine14-concurrency",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

async function seedMarket(
	slug: string,
	status: "Draft" | "Open",
): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "PLACEHOLDER — not a real market",
			description: "PLACEHOLDER criterion — not a real criterion",
			status,
			resolutionDeadline: DEADLINE,
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

// User + initial_grant so the in-spine bet_stake debit does not overdraft.
async function seedFundedUser(): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({ name: "X2", email: "x2@example.com", pseudonym: "x2-bettor" })
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount: "1000",
			entryType: "initial_grant",
		}),
	);
	return userId;
}

async function marketStatus(marketId: string): Promise<string | undefined> {
	const [row] = await testDb
		.select({ status: markets.status })
		.from(markets)
		.where(eq(markets.id, marketId));
	return row?.status;
}

async function eventsOfType(eventType: string) {
	return testDb
		.select({ eventId: events.eventId })
		.from(events)
		.where(eq(events.eventType, eventType));
}

describe("ENGINE.14 W-4 — lifecycle concurrency (X1–X2)", () => {
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, dharma_ledger, bets, comments, positions, pools, markets, users, friendly_fire_events CASCADE`,
		);
		vi.clearAllMocks();
	});

	it("markets-concurrency::X1-double-open-single-pool", async () => {
		// Exactly one of two concurrent opens fulfils; the loser surfaces
		// MarketLifecycleStateError (a 40001-retry resolving into it is fine).
		const marketId = await seedMarket("placeholder-x1-double", "Draft");

		const attempt = () =>
			openMarket({
				marketId,
				seedAmount: SEED,
				now: NOW,
				metadata: adminMetadata("F-ADMIN-2"),
			});
		const results = await Promise.allSettled([attempt(), attempt()]);

		expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
		const rejected = results.filter(
			(r): r is PromiseRejectedResult => r.status === "rejected",
		);
		expect(rejected.length).toBe(1);
		expect(rejected[0]?.reason).toBeInstanceOf(MarketLifecycleStateError);

		// Opened exactly once: ONE pools row, ONE market.opened event, Open.
		const poolRows = await testDb
			.select({ id: pools.id })
			.from(pools)
			.where(eq(pools.marketId, marketId));
		expect(poolRows.length).toBe(1);
		expect((await eventsOfType("market.opened")).length).toBe(1);
		expect(await marketStatus(marketId)).toBe("Open");
	});

	it("markets-concurrency::X2-close-vs-bet-serializes", async () => {
		// §Wrapper (b): a FULL W-1 bet races closeMarket purely through SSI.
		// Either order is consistent: the bet commits against a still-Open
		// snapshot (the R-14.3 window), or the close lands first and the bet's
		// retry re-reads 'Closed' → MarketNotOpenError (or budget exhausted).
		const marketId = await seedMarket("placeholder-x2-race", "Open");
		await testDb
			.insert(pools)
			.values({ marketId, yesReserves: SEED, noReserves: SEED });
		const userId = await seedFundedUser();

		// W-1 event ids minted at "handler entry", closed over (retry-purity).
		const betEventId = uuidv7();
		const commentEventId = uuidv7();
		const creditEventId = uuidv7();

		const closePromise = closeMarket({
			marketId,
			now: DEADLINE,
			metadata: adminMetadata("W-4-close"),
		});
		const betPromise = runBetTransaction(
			{ marketId, flow: "F-BET-1" },
			({ tx, pool }) =>
				place(
					{ tx, pool },
					{
						userId,
						marketId,
						side: "YES",
						stake: "10",
						body: "PLACEHOLDER X2 argument — not a real argument.",
						parentCommentId: null,
						idempotencyKey: "x2-close-vs-bet",
						betEventId,
						commentEventId,
						creditEventId,
						metadata: {
							...adminMetadata("F-BET-1"),
							user_id: userId,
							actor_id: userId,
							idempotency_key: "x2-close-vs-bet",
						},
					},
				),
		);
		const [closeResult, betResult] = await Promise.allSettled([
			closePromise,
			betPromise,
		]);

		// closeMarket itself must fulfil under EITHER serialization order.
		expect(closeResult.status).toBe("fulfilled");

		const betRows = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		const commentRows = await testDb
			.select({ id: comments.id })
			.from(comments)
			.where(eq(comments.marketId, marketId));

		if (betResult.status === "fulfilled") {
			// (i) Bet first — the FULL spine committed (1 bets + 1 comments).
			expect(betRows.length).toBe(1);
			expect(commentRows.length).toBe(1);
		} else {
			// (ii) Close first — the typed gate error, ZERO spine rows.
			const reason: unknown = betResult.reason;
			expect(
				reason instanceof MarketNotOpenError ||
					reason instanceof BetSerializationExhaustedError,
			).toBe(true);
			expect(betRows.length).toBe(0);
			expect(commentRows.length).toBe(0);
		}

		// BOTH branches: Closed, ONE market.closed event, no partial spine.
		expect(await marketStatus(marketId)).toBe("Closed");
		expect((await eventsOfType("market.closed")).length).toBe(1);
		expect(betRows.length).toBe(commentRows.length);
	});
});
