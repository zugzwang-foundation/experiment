import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { bets, comments, payoutEvents } from "@/db/schema";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { voidMarket } from "@/server/resolution/void";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";
import {
	adminMetadata,
	seedOpenMarketWithPool,
	seedUser,
	userMetadata,
} from "./_fixtures/seed";
import { assertDocumentedRejections } from "./_harness/asserts";
import { collide } from "./_harness/collide";

// ENGINE.10 — two-spine interaction (axis 5 / Amendment F): the INDUCED
// bet-during-resolution race. NOT a happy-path resolution check.
//
// Amendment F race window: `assertMarketOpen`, bets/transaction.ts:223–239,
// invoked at bets/transaction.ts:121 (between `lockPool` L120 and the callback
// L125) — the UNLOCKED `SELECT markets.status` (L227–230) with the
// `if (status !== "Open") throw new MarketNotOpenError(status)` (L236–238). W-1
// reads `markets.status` UNLOCKED and never locks `markets`; W-3
// (`runResolutionTransaction`) locks `markets` FIRST. SSI catches a concurrent
// W-3 status flip as 40001 → retry, then the re-read sees non-Open →
// MarketNotOpenError. `voidMarket` has `expectedStatus:["Open","Closed"]`, so it
// can fire against an OPEN market — the cleanest single-step W-3-on-open race
// vehicle (settle requires "Resolving", gating bets out before settle).
//
// Vehicle: a barrier-synced set of `place()` tasks on an Open market + one
// `voidMarket()` task firing concurrently.
//
// XOR HARD assertion (plan §7 / §1 2.4) on END STATE: each racing bet either
//   (a) committed-before-flip ⇒ its `void_refund` payout leg is in the void
//       payout set (a bets row exists, with its comment row), OR
//   (b) was rejected on SSI-retry / MarketNotOpenError ⇒ NO bets row, and NO
//       payout leg for it,
// NEVER both, NEVER a torn payout (no bet row without its comment row; no payout
// leg for a non-committed bet). A happy-path resolution does NOT substitute.
//
// DB-BACKED (local Postgres :54322).

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
	const body = `scale race argument ${uuidv7()}`;
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

async function marketStatus(marketId: string): Promise<string | undefined> {
	const rows = await testClient.unsafe(
		`SELECT status FROM markets WHERE id = $1`,
		[marketId],
	);
	return (rows[0] as { status?: string } | undefined)?.status;
}

/** Operator re-issue: void the market until it terminates (Voided). The W-3
 *  wrapper may exhaust its 40001 budget under the storm; re-issue (fresh event
 *  id) until terminal. Bounded so a genuine stuck market fails loud, never
 *  hangs. */
async function ensureVoided(marketId: string): Promise<void> {
	for (let attempt = 0; attempt < 50; attempt++) {
		if ((await marketStatus(marketId)) === "Voided") return;
		try {
			await voidMarket({
				marketId,
				reason: "Scale race void (operator re-issue).",
				voidEventId: uuidv7(),
				metadata: adminMetadata("F-RESOLVE-3"),
			});
			return;
		} catch {
			// Exhausted again under residual contention, or a prior attempt already
			// flipped it — re-check status on the next loop.
		}
	}
	throw new Error(
		"ensureVoided: market did not reach Voided after 50 re-issues",
	);
}

describe("scale — two-spine interaction / induced bet-during-resolution (axis 5, Amendment F)", () => {
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

	it("two-spine::bet-vs-void-race-resolves-xor-never-torn", async () => {
		// One Open market; a cohort of bettors races a single voidMarket().
		const marketId = await seedOpenMarketWithPool("synthetic-market-race-1");
		const degree = 24;
		const factories: Array<() => Promise<string>> = [];
		for (let i = 0; i < degree; i++) {
			const userId = await seedUser(`spine-race-${i}`, "1000");
			factories.push(
				placeTask({
					userId,
					marketId,
					side: i % 2 === 0 ? "YES" : "NO",
					stake: "10",
				}),
			);
		}

		// The W-3 void task — fired in the SAME barrier release as the bets so it
		// flips `markets.status` Open→Voided while bets are mid-flight at the
		// unlocked `assertMarketOpen` window (bets/transaction.ts:223–239, L121).
		const voidTask = (): Promise<string> =>
			voidMarket({
				marketId,
				reason: "Scale race void.",
				voidEventId: uuidv7(),
				metadata: adminMetadata("F-RESOLVE-3"),
			}).then((r) => r.voidResolutionEventId);

		const results = await collide<unknown>([...factories, voidTask], {
			degree: degree + 1,
		});
		// The void races the bets on ONE pool row; under the storm it may itself
		// EXHAUST its W-3 40001 retry budget (a DOCUMENTED terminal error — alarm-3,
		// never a torn state), in which case the operator RE-ISSUES until the market
		// terminates. End-state determinism (the market always ends Voided); NEVER a
		// retry-count assertion (plan §7 flake guard).
		const voidResult = results[results.length - 1];
		// §5 taxonomy: every racing bet that did NOT commit, and the void if its
		// first attempt lost, surfaced a documented terminal error (MarketNotOpen /
		// serialization-exhausted) — never an undocumented failure.
		assertDocumentedRejections(results);
		if (voidResult?.status !== "fulfilled") {
			await ensureVoided(marketId);
		}
		expect(await marketStatus(marketId)).toBe("Voided");

		// END STATE — the XOR. Every committed bet row is one that committed before
		// the (final) flip; the void's refund payout set must cover EXACTLY that
		// set, with no leg for an uncommitted bet, and no bet without a comment.
		const betRows = await testDb
			.select({ id: bets.id, commentId: bets.commentId })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		const committedBetIds = new Set(betRows.map((b) => b.id));
		// Amendment-F arm evidence: which side of the XOR fired this run.
		console.log(
			`[amendment-F] race arms: committed-before-flip = ${committedBetIds.size}/${degree}; ` +
				`rejected-on-SSI-retry/MarketNotOpen = ${degree - committedBetIds.size}/${degree}; ` +
				`void terminated = fulfilled (first-attempt=${voidResult?.status})`,
		);

		// No torn write: every committed bet has its comment row (the INV-1 spine
		// half survives the race — bet+comment atomic).
		for (const row of betRows) {
			expect(row.commentId).not.toBeNull();
			const commentRow = await testDb
				.select({ id: comments.id })
				.from(comments)
				.where(eq(comments.id, row.commentId ?? ""));
			expect(commentRow.length).toBe(1);
		}

		// The void payout set is EXACTLY the committed-before-flip set: one
		// void_refund leg per committed bet, and NO leg for any non-committed bet.
		const payoutRows = await testDb
			.select({
				betId: payoutEvents.betId,
				payoutType: payoutEvents.payoutType,
			})
			.from(payoutEvents)
			.where(eq(payoutEvents.marketId, marketId));
		const refundBetIds = new Set(
			payoutRows
				.filter((p) => p.payoutType === "void_refund")
				.map((p) => p.betId),
		);
		// XOR: in-payout-set ⟺ committed. No payout leg references a bet that does
		// not exist (no leg for a rejected/rolled-back bet); every committed bet has
		// its leg (none committed-but-unrefunded after void).
		expect(refundBetIds).toEqual(committedBetIds);
		for (const p of payoutRows) {
			expect(committedBetIds.has(p.betId)).toBe(true);
		}

		// INV-4 / INV-1: Bucket-A append-only is never bent by the race — the
		// storage-layer triggers reject UPDATE/DELETE on the resolution + bet spine
		// AFTER the induced flip. (Folded into the RED storm test so this §7
		// assertion is never green-from-day-one.)
		await expect(
			testClient.unsafe(
				`UPDATE payout_events SET amount = '0' WHERE market_id = $1`,
				[marketId],
			),
		).rejects.toThrow();
		await expect(
			testClient.unsafe(`DELETE FROM resolution_events WHERE market_id = $1`, [
				marketId,
			]),
		).rejects.toThrow();
		await expect(
			testClient.unsafe(`UPDATE bets SET stake = '0' WHERE market_id = $1`, [
				marketId,
			]),
		).rejects.toThrow();
	});
});
