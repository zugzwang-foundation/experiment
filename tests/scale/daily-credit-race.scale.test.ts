import { and, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { dharmaLedger } from "@/db/schema";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";
import {
	seedAllSyntheticMarkets,
	seedUserUnpaidCursor,
	userMetadata,
} from "./_fixtures/seed";
import { collide } from "./_harness/collide";

// ENGINE.10 — daily-credit race under scale (axis 8). The FIRST commented bet of
// a UTC day is fired CONCURRENTLY by one user across DIFFERENT markets; the
// primary mechanism (the SSI cursor conflict on `users.last_allowance_accrued_at`
// inside the W-1 SERIALIZABLE tx) + the storage backstop (the unique partial
// index `dharma_ledger_daily_allowance_day_uq`) must yield AT MOST ONE
// `daily_allowance` row per user per UTC day (I-DAILY-ONCE-001). Both bets
// commit; the credit pays exactly once.
//
// DB-BACKED (local Postgres :54322).

function placeTask(args: {
	userId: string;
	marketId: string;
}): () => Promise<string> {
	const idempotencyKey = uuidv7();
	const betEventId = uuidv7();
	const commentEventId = uuidv7();
	const creditEventId = uuidv7();
	const body = `scale daily-credit argument ${uuidv7()}`;
	return () =>
		runBetTransaction({ marketId: args.marketId, flow: "F-BET-1" }, (ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: "YES",
				stake: "10",
				body,
				parentCommentId: null,
				idempotencyKey,
				bodyFingerprint: uuidv7(),
				betEventId,
				commentEventId,
				creditEventId,
				metadata: userMetadata(args.userId, "F-BET-1"),
			}),
		).then((r) => r.betId);
}

async function dailyAllowanceCount(userId: string): Promise<number> {
	const rows = await testDb
		.select({ id: dharmaLedger.id })
		.from(dharmaLedger)
		.where(
			and(
				eq(dharmaLedger.userId, userId),
				eq(dharmaLedger.entryType, "daily_allowance"),
			),
		);
	return rows.length;
}

describe("scale — daily-credit first-bet-of-day race (axis 8, I-DAILY-ONCE)", () => {
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

	it("daily-credit-race::at-most-one-allowance-row-per-user-per-utc-day", async () => {
		// One user with an UNPAID cursor fires its first commented bets of the day
		// CONCURRENTLY across several DIFFERENT markets (different pool rows → they
		// do not serialize on the pool lock; they collide on the one users row).
		const marketIds = await seedAllSyntheticMarkets();
		const userId = await seedUserUnpaidCursor("daily-race", "1000");
		const degree = 8;
		const factories = Array.from({ length: degree }, (_unused, i) =>
			placeTask({ userId, marketId: marketIds[i % marketIds.length] ?? "" }),
		);

		const results = await collide(factories, { degree });
		// The bets always proceed — the loser's attempt retries and re-runs (its
		// rerun sees the cursor and skips the credit). At least one bet commits.
		const committed = results.filter((r) => r.status === "fulfilled").length;
		expect(committed).toBeGreaterThan(0);

		// I-DAILY-ONCE: at most ONE daily_allowance row for the user this UTC day.
		expect(await dailyAllowanceCount(userId)).toBeLessThanOrEqual(1);
		// And — because the user was unpaid and at least one bet committed — exactly
		// one was paid.
		expect(await dailyAllowanceCount(userId)).toBe(1);

		// Storage backstop — the unique partial index
		// `dharma_ledger_daily_allowance_day_uq` fails LOUD (23505): a fixture-bypass
		// second daily_allowance row for the SAME user on the SAME UTC day is
		// rejected at the storage layer. (Folded into the RED storm test so this §7
		// assertion is never green-from-day-one.)
		await expect(
			testClient.unsafe(
				`INSERT INTO dharma_ledger (user_id, entry_type, amount, balance_after, created_at)
				 SELECT user_id, 'daily_allowance', amount, balance_after, created_at
				 FROM dharma_ledger
				 WHERE user_id = $1 AND entry_type = 'daily_allowance'
				 LIMIT 1`,
				[userId],
			),
		).rejects.toThrow();
		// Still exactly one daily_allowance row stands.
		expect(await dailyAllowanceCount(userId)).toBe(1);
	});
});
