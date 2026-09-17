import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";

import { testClient } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";
import {
	seedAllSyntheticMarkets,
	seedUser,
	userMetadata,
} from "./_fixtures/seed";
import { collide } from "./_harness/collide";

// ADR-0056 — the measurement the retry budget was sized from. NOT a guard and
// NOT a gate: it asserts nothing and cannot fail on a regression.
// It answers one question the whole 5,000-user capacity estimate rests on and
// which had only ever been answered by a single 25-way burst taken DURING a
// production deploy — a number that did not survive contact with this sweep (it
// said ~25; the real local figure is 32+): at what concurrency do writers onto
// ONE market start being refused?
//
// ⚠ IT IS COMMITTED SO THE FIGURES IN ADR-0056 ARE REPRODUCIBLE RATHER THAN
// QUOTED. Re-run it before changing `BACKOFF_BASES_MS` again; ADR-0038
// decision 2 forbids sizing that budget from anything else.
//
// Run: DATABASE_URL=<local pg> pnpm vitest run --config vitest.scale.config.ts \
//        tests/scale/write-ceiling-sweep.scale.test.ts
//
// ⚠ LOCAL POSTGRES. Production holds the lock across a network round trip, so
// real contention is worse; the SHAPE transfers, the absolute numbers do not.
//
// Every post is a bet (INV-1), so it takes SERIALIZABLE + FOR NO KEY UPDATE on
// that market's pool row; losers retry on full jitter for a budget of 4 attempts
// and then surface `error_bet_serialization_exhausted`. The refusal is the retry
// budget running out, not the database failing — so the number below is a
// property of the budget and the lock-hold time, and is exactly what a budget
// change would move.
//
// ⚠ ONE market on purpose. The existing storm spreads across eight, which is the
// benign case: the lock is per market, so eight markets are eight lanes. The hot
// market is the case that breaks.

function placeTask(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
}): () => Promise<string> {
	const idempotencyKey = uuidv7();
	const betEventId = uuidv7();
	const commentEventId = uuidv7();
	const creditEventId = uuidv7();
	const body = `measure argument ${uuidv7()}`;
	return () =>
		runBetTransaction({ marketId: args.marketId, flow: "F-BET-1" }, (ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
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

const TABLES = [
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
];

describe("MEASUREMENT — write ceiling on one hot market", () => {
	afterEach(async () => {
		await truncateTables(testClient, TABLES);
		vi.clearAllMocks();
	});

	it("sweeps concurrency and reports the refusal rate", async () => {
		const rows: string[] = [];
		for (const degree of [8, 16, 24, 32, 48, 64]) {
			await truncateTables(testClient, TABLES);
			const marketIds = await seedAllSyntheticMarkets();
			const hot = marketIds[0] ?? "";

			const factories: Array<() => Promise<string>> = [];
			for (let i = 0; i < degree; i++) {
				const userId = await seedUser(`measure-${degree}-${i}`, "1000");
				factories.push(
					placeTask({
						userId,
						marketId: hot, // ⚠ ALL onto ONE market — the contended case
						side: i % 2 === 0 ? "YES" : "NO",
						stake: "10",
					}),
				);
			}

			const t0 = performance.now();
			const results = await collide(factories, { degree });
			const elapsed = performance.now() - t0;

			const committed = results.filter((r) => r.status === "fulfilled").length;
			const reasons = new Map<string, number>();
			for (const r of results) {
				if (r.status !== "rejected") continue;
				const name =
					r.reason instanceof Error ? r.reason.constructor.name : "unknown";
				reasons.set(name, (reasons.get(name) ?? 0) + 1);
			}
			const refused = degree - committed;
			const pct = ((refused / degree) * 100).toFixed(1);
			const why = [...reasons.entries()].map(([k, v]) => `${k}=${v}`).join(" ");
			rows.push(
				`degree=${String(degree).padStart(2)}  committed=${String(committed).padStart(2)}/${degree}  refused=${String(refused).padStart(2)} (${pct.padStart(5)}%)  ${elapsed.toFixed(0)}ms  ${why}`,
			);
		}
		console.log(
			`\n=== WRITE CEILING, ONE HOT MARKET ===\n${rows.join("\n")}\n`,
		);
	}, 600_000);
});
