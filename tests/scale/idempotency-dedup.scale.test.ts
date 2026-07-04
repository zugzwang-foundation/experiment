import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { bets } from "@/db/schema";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";
import {
	seedOpenMarketWithPool,
	seedUser,
	userMetadata,
} from "./_fixtures/seed";
import { assertDocumentedRejections } from "./_harness/asserts";
import { collide } from "./_harness/collide";

// ENGINE.10 — idempotency dedup under scale (axis 7 / Q-3). N concurrent
// IDENTICAL submits (same Idempotency-Key) must commit EXACTLY ONE bet spine.
//
// Q-3 MANDATORY (always-available, deterministic): the `bets.idempotency_key`
// DB unique partial index is the hard backstop — driven at the `place()` level
// (no Upstash dependency). N concurrent `place()` calls sharing ONE
// idempotencyKey: exactly one commits; the rest abort on the unique-violation
// (23505) / SSI conflict. The hard exit gate must NOT depend on local Upstash.
//
// Q-3 OPTIONAL: the endpoint Redis SETNX path (the full `runBetEndpoint` stack)
// is asserted ONLY when a test Upstash is configured (env probe); otherwise
// `it.skip` + a logged note. The skip never fails the gate.
//
// DB-BACKED (local Postgres :54322).

const HAS_TEST_UPSTASH =
	typeof process.env.UPSTASH_REDIS_REST_URL === "string" &&
	process.env.UPSTASH_REDIS_REST_URL.length > 0 &&
	!process.env.UPSTASH_REDIS_REST_URL.includes("test.upstash.io");

function identicalPlaceTask(args: {
	userId: string;
	marketId: string;
	idempotencyKey: string;
}): () => Promise<string> {
	// Same key shared across all tasks → the DB unique backstop dedupes. Event
	// ids/body are per-attempt-fresh here (each concurrent submit is a distinct
	// in-flight tx), but the idempotencyKey is the shared dedup axis.
	return () =>
		runBetTransaction({ marketId: args.marketId, flow: "F-BET-1" }, (ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: "YES",
				stake: "10",
				body: "idempotent submit body",
				parentCommentId: null,
				idempotencyKey: args.idempotencyKey,
				betEventId: uuidv7(),
				commentEventId: uuidv7(),
				creditEventId: uuidv7(),
				metadata: userMetadata(args.userId, "F-BET-1"),
			}),
		).then((r) => r.betId);
}

describe("scale — idempotency dedup (axis 7, Q-3)", () => {
	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"payout_events",
			"resolution_events",
			"dharma_ledger",
			"bets",
			"comments",
			"positions",
			"pools",
			"markets",
			"users",
		]);
		vi.clearAllMocks();
	});

	it("idempotency-dedup::exactly-one-spine-per-key-via-db-backstop", async () => {
		// MANDATORY: N concurrent identical submits sharing ONE idempotencyKey →
		// exactly one committed `bets` row carrying that key. The unique partial
		// index `bets_idempotency_key_idx` is the always-available backstop.
		const marketId = await seedOpenMarketWithPool("synthetic-market-idem-1");
		const userId = await seedUser("idem-user", "1000");
		const idempotencyKey = uuidv7();
		const degree = 16;
		const factories = Array.from({ length: degree }, () =>
			identicalPlaceTask({ userId, marketId, idempotencyKey }),
		);

		const results = await collide(factories, { degree });
		const committed = results.filter((r) => r.status === "fulfilled").length;

		// Exactly one of the concurrent identical submits committed.
		expect(committed).toBe(1);
		// §5 taxonomy: the losers surfaced a documented terminal error (the 23505
		// idempotency-key unique violation, or a spent-budget serialization error).
		assertDocumentedRejections(results);

		// And exactly one bets row carries the shared key (the DB unique backstop).
		const betRows = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.idempotencyKey, idempotencyKey));
		expect(betRows.length).toBe(1);

		// The backstop is the index ITSELF: a second bets row reusing the same
		// non-null idempotency_key is rejected at the storage layer (23505), even
		// under a fixture-bypass direct insert — the dedup is a hard constraint,
		// not just an application race outcome. (Folded into the RED storm test so
		// this §7 assertion is never green-from-day-one.)
		await expect(
			testClient.unsafe(
				`INSERT INTO bets (user_id, market_id, side, stake, share_quantity, price_at_bet, comment_id, idempotency_key)
				 SELECT user_id, market_id, side, stake, share_quantity, price_at_bet, comment_id, idempotency_key
				 FROM bets WHERE idempotency_key = $1`,
				[idempotencyKey],
			),
		).rejects.toThrow();
	});

	// ── OPTIONAL: endpoint Redis SETNX path (Q-3) ───────────────────────────
	const maybe = HAS_TEST_UPSTASH ? it : it.skip;
	maybe(
		"idempotency-dedup::endpoint-setnx-dedupes-when-upstash-configured",
		async () => {
			// Asserted ONLY when a real test Upstash is configured. When skipped
			// (the default), the hard gate stands on the DB backstop above — never
			// on local Upstash. (Body filled at BUILD; reaching it without a real
			// Upstash would mean the env probe is wrong.)
			if (!HAS_TEST_UPSTASH) {
				// Logged note: the Redis SETNX path was not exercised (no test
				// Upstash). The DB unique backstop is the asserted hard gate.
				return;
			}
			throw new Error("not implemented");
		},
	);
});
