import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { place } from "@/server/bets/place";
import { sell } from "@/server/bets/sell";
import { runBetTransaction } from "@/server/bets/transaction";
import { correctResolution } from "@/server/resolution/correct";
import { settleMarket } from "@/server/resolution/settle";
import { voidMarket } from "@/server/resolution/void";

import { testClient } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";
import {
	adminMetadata,
	seedAllSyntheticMarkets,
	seedUser,
	userMetadata,
} from "./_fixtures/seed";
import { collide } from "./_harness/collide";
import {
	type ConservationSnapshot,
	gatherSnapshot,
	reconcile,
} from "./_harness/reconcile";

// ENGINE.10 — reconciliation at scale (axis 11, HEADLINE). After a multi-market
// storm (bets + sells + ≥1 settle + ≥1 void + ≥1 correction across the 8
// synthetic markets), the GLOBAL "Dharma in == out" identity is proven by TWO
// INDEPENDENT DERIVATIONS, cross-checked equal (Amendment E):
//   #1 composes the per-market checkers (`checkMarketConservation` /
//      `checkCorrectedMarketConservation`) + a global SQL aggregation;
//   #2 an independent re-derivation: Σ latest balance_after ↔ Σ issuance net of
//      pool-unwind exits + uncollectable forgiveness.
// The ASSERTION is the cross-check: both AGREE → `{ ok:true }`. A subtly-wrong
// global formula would let a leak pass — the cross-check guards exactly that.
//
// DB-BACKED (local Postgres :54322). Writes-under-test flow through the real
// engine entry points; the snapshot is gathered from the live DB.

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
	const body = `scale recon argument ${uuidv7()}`;
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
				betEventId,
				commentEventId,
				creditEventId,
				metadata: userMetadata(args.userId, "F-BET-1"),
			}),
		).then((r) => r.betId);
}

function sellTask(args: {
	userId: string;
	marketId: string;
	shares: string;
}): () => Promise<string> {
	const sellEventId = uuidv7();
	const syntheticBetId = uuidv7();
	return () =>
		runBetTransaction({ marketId: args.marketId, flow: "F-BET-3" }, (ctx) =>
			sell(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				shares: args.shares,
				sellEventId,
				syntheticBetId,
				metadata: userMetadata(args.userId, "F-BET-3"),
			}),
		).then((r) => r.dharmaReturned);
}

async function setResolving(marketId: string): Promise<void> {
	await testClient.unsafe(
		`UPDATE markets SET status = 'Resolving' WHERE id = $1`,
		[marketId],
	);
}

describe("scale — reconciliation HEADLINE (axis 11, Amendment E)", () => {
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

	it("reconciliation::global-conservation-two-derivations-agree-after-storm", async () => {
		// 8 markets. A storm of bets + sells; then ≥1 settle, ≥1 void, ≥1
		// correction across distinct markets — every monetary flow tag exercised.
		const marketIds = await seedAllSyntheticMarkets();

		// Per-market bettor cohorts (both sides), then a few sells.
		const buyFactories: Array<() => Promise<string>> = [];
		const sellSpecs: Array<{ userId: string; marketId: string }> = [];
		for (let m = 0; m < marketIds.length; m++) {
			const marketId = marketIds[m] ?? "";
			for (let u = 0; u < 4; u++) {
				const userId = await seedUser(`recon-${m}-${u}`, "1000");
				buyFactories.push(
					placeTask({
						userId,
						marketId,
						side: u % 2 === 0 ? "YES" : "NO",
						stake: "10",
					}),
				);
				if (u === 0) sellSpecs.push({ userId, marketId });
			}
		}
		await collide(buyFactories, { degree: 32 });

		// A round of partial sells (comment-free unwinds → bet_stake POSITIVE,
		// attributed per-market via the bet.sold event — Amendment D).
		const sellFactories = sellSpecs.map((s) =>
			sellTask({ userId: s.userId, marketId: s.marketId, shares: "1" }),
		);
		await collide(sellFactories, { degree: 16 });

		// Terminal events across distinct markets: settle market 0, void market 1,
		// settle+correct market 2 (correction needs a Resolved tip).
		await setResolving(marketIds[0] ?? "");
		await settleMarket({
			marketId: marketIds[0] ?? "",
			winningSide: "YES",
			reason: "Scale settle.",
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});
		await voidMarket({
			marketId: marketIds[1] ?? "",
			reason: "Scale void.",
			voidEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-3"),
		});
		await setResolving(marketIds[2] ?? "");
		await settleMarket({
			marketId: marketIds[2] ?? "",
			winningSide: "YES",
			reason: "Scale settle for correction.",
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});
		await correctResolution({
			marketId: marketIds[2] ?? "",
			correctedSide: "NO",
			reason: "Scale correction.",
			correctEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-2"),
		});

		// HEADLINE: gather the live snapshot, reconcile, assert the cross-check.
		const snapshot = await gatherSnapshot();
		const result = reconcile(snapshot);
		// Amendment-E evidence: the two INDEPENDENT derivations + their agreement.
		console.log(
			`[amendment-E] derivation#1 (per-market checkers) total = ${result.crossCheck.derivation1Total}; ` +
				`derivation#2 (independent global re-derivation) total = ${result.crossCheck.derivation2Total}; ` +
				`agree = ${result.crossCheck.ok}`,
		);
		expect(result.ok).toBe(true);
		expect(result.derivation1.ok).toBe(true);
		expect(result.derivation2.ok).toBe(true);
		// The two INDEPENDENT derivations agree (Amendment E — the non-vacuous core).
		expect(result.crossCheck.ok).toBe(true);
		expect(result.crossCheck.derivation1Total).toBe(
			result.crossCheck.derivation2Total,
		);
	});

	// ── Negative control: a leaked / over-issued snapshot must FAIL ──────────
	// Feeds `reconcile()` a deliberately leaked SYNTHETIC snapshot (an
	// over-issuance: derivation #2's Σ latest balances exceeds Σ issuance net of
	// exits, while derivation #1's per-market checks still pass) and asserts the
	// COMBINED check returns `{ ok:false }`. This proves the cross-check is
	// non-vacuous — both-derivations-must-agree FAILS on an injected leak (a
	// double-`bet_payout` under retry, a double-accrual). PURE — no live DB.
	describe("negative control — leaked snapshot fails the cross-check", () => {
		it("reconciliation::reconcile-rejects-over-issued-snapshot", () => {
			const leaked: ConservationSnapshot = {
				markets: [
					{
						marketId: "synthetic-leak-1",
						// Per-market #1 closes locally: −10 stake ↔ injection +10.
						ledgerFlows: [
							{ amount: "-10.000000000000000000", entryType: "bet_stake" },
						],
						netAdminPoolInjection: "-10.000000000000000000",
					},
				],
				global: {
					// THE LEAK: latest balances claim MORE Dharma exists than was
					// issued net of exits + forgiveness — an over-issuance the global
					// identity (derivation #2) must reject even though #1 passed.
					sumLatestBalances: "1100.000000000000000000",
					sumInitialGrants: "1000.000000000000000000",
					sumDailyAllowances: "0.000000000000000000",
					sumPoolUnwindExits: "0.000000000000000000",
					sumUncollectable: "0.000000000000000000",
				},
			};

			const result = reconcile(leaked);
			expect(result.ok).toBe(false);
			// #1 passed locally but the cross-check / #2 caught the leak.
			expect(result.crossCheck.ok).toBe(false);
		});
	});
});
