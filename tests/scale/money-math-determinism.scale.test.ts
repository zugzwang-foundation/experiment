import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { bets, payoutEvents } from "@/db/schema";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { CpmmDecimal, floor18 } from "@/server/cpmm/decimal";
import { prorate } from "@/server/resolution/basis";
import { settleMarket } from "@/server/resolution/settle";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";
import {
	adminMetadata,
	seedOpenMarketWithPool,
	seedUser,
	userMetadata,
} from "./_fixtures/seed";
import { collide } from "./_harness/collide";

// ENGINE.10 — money-math determinism at scale (axis 11). TWO complementary
// halves:
//  (A) the PURE pro-rata kernel `prorate` (src/server/resolution/basis.ts) over
//      a large fan-out — Σ floored payouts + last-row remainder == total EXACTLY,
//      the max-UUID last row carries the remainder reproducibly, floor-18
//      precision (never a JS float). Reuses the basis.property guarantees.
//  (B) the HARNESS-DRIVEN half (D1 ruling): a real concurrent settle fan-out via
//      `collide` → the REAL `settleMarket` (which routes through
//      `applySideBasis` → `prorate`) → assert the live `payout_events` legs
//      conserve EXACTLY against the settle's basis total. This rides `collide`
//      (RED until the harness is wired) — the at-scale, real-output proof that
//      the determinism holds across a concurrent fan-out, not just the kernel.

/** A deterministic fan-out of N rows with pseudo-irregular weights. */
function buildRows(n: number): { id: string; weight: string }[] {
	return Array.from({ length: n }, (_unused, i) => ({
		id: uuidv7(),
		// Weights chosen so total/Σweights is a non-terminating ratio → the floor
		// matters and the remainder is non-zero (a clean ratio would hide drift).
		weight: `${(i % 7) + 1}.000000000000000000`,
	}));
}

function maxId(rows: { id: string }[]): string {
	return [...rows].map((r) => r.id).sort()[rows.length - 1] ?? "";
}

describe("scale — money-math determinism / prorate fan-out (axis 11)", () => {
	it("money-math::sum-equals-total-exactly-over-large-fanout", () => {
		const rows = buildRows(500);
		const total = "12345.678901234567890123";
		const split = prorate({ rows, total });

		// Exact conservation: Σ amounts == total, to the 18th decimal.
		const sum = split.reduce(
			(acc, r) => acc.plus(r.amount),
			new CpmmDecimal(0),
		);
		expect(sum.toFixed(18)).toBe(new CpmmDecimal(total).toFixed(18));

		// Floor-18: every amount is a canonical 18-dp string, none negative.
		for (const r of split) {
			expect(r.amount).toMatch(/^-?\d+\.\d{18}$/);
			expect(new CpmmDecimal(r.amount).greaterThanOrEqualTo(0)).toBe(true);
		}
	});

	it("money-math::remainder-on-max-uuid-last-row-reproducible", () => {
		const rows = buildRows(256);
		const total = "999.999999999999999999";

		const a = prorate({ rows, total });
		// Re-run with the SAME rows in a SHUFFLED order — the result must be
		// identical (prorate sorts by id ascending internally; order-independent).
		const shuffled = [...rows].reverse();
		const b = prorate({ rows: shuffled, total });

		const byIdA = new Map(a.map((r) => [r.id, r.amount]));
		const byIdB = new Map(b.map((r) => [r.id, r.amount]));
		for (const [id, amount] of byIdA) {
			expect(byIdB.get(id)).toBe(amount);
		}

		// The remainder lands on the MAX-id row (the deterministic last row after
		// ascending sort): its floored exact share is ≤ its assigned amount, and
		// every OTHER row equals exactly its floored exact share.
		const last = maxId(rows);
		const sumWeights = rows.reduce(
			(acc, r) => acc.plus(r.weight),
			new CpmmDecimal(0),
		);
		const totalDec = new CpmmDecimal(total);
		let nonLastSum = new CpmmDecimal(0);
		for (const r of rows) {
			if (r.id === last) continue;
			// Mirror prorate's per-row floor exactly (floor18 over the precision-50
			// division) — every non-last row equals its floored exact share.
			const exactShareFloor = floor18(
				totalDec.times(r.weight).dividedBy(sumWeights),
			);
			expect(byIdA.get(r.id)).toBe(exactShareFloor);
			nonLastSum = nonLastSum.plus(byIdA.get(r.id) ?? "0");
		}
		// The last row carries exactly total − Σ(non-last) — the remainder.
		const remainder = totalDec.minus(nonLastSum).toFixed(18);
		expect(byIdA.get(last)).toBe(remainder);
		// Remainder is non-negative (floors under-allocate, never over).
		expect(new CpmmDecimal(remainder).greaterThanOrEqualTo(0)).toBe(true);
	});

	it("money-math::zero-total-fanout-degenerates-to-all-zeros", () => {
		// A zero-stake market resolved/voided → prorate degenerates cleanly (no
		// division-by-zero; every row 0), and the exact-sum invariant still holds.
		const rows = buildRows(64);
		const split = prorate({ rows, total: "0" });
		const sum = split.reduce(
			(acc, r) => acc.plus(r.amount),
			new CpmmDecimal(0),
		);
		expect(sum.toFixed(18)).toBe("0.000000000000000000");
		for (const r of split) {
			expect(r.amount).toBe("0.000000000000000000");
		}
	});
});

// ── (B) HARNESS-DRIVEN money-math at scale (D1 ruling) — rides `collide` ──────
// A real concurrent settle fan-out, then the LIVE `payout_events` legs are
// reconciled against the settle's basis total. DB-BACKED (local Postgres :54322).

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
	const body = `scale money-math argument ${uuidv7()}`;
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

describe("scale — money-math determinism / real settle fan-out (axis 11, D1)", () => {
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

	it("money-math::settle-fanout-payout-legs-sum-to-basis-total-exactly", async () => {
		// Storm a mixed cohort (YES winners + NO losers) onto ONE market via the
		// barrier driver, then settle YES. The REAL settle fan-out
		// (`applySideBasis` → `prorate`) writes one `bet_payout` leg per bet (zero
		// legs for losers / f=0 are real records, §3.6 uniformity). Assert the
		// fan-out conserves EXACTLY: Σ floored payout legs == the settle's basis
		// total (`totalPaidOut`) to the 18th decimal — the deterministic max-UUID
		// last-row remainder closes the gap with zero drift across the concurrent
		// fan-out. RED until `collide` is wired (the at-scale, real-output proof).
		const marketId = await seedOpenMarketWithPool("synthetic-market-money-1");
		const degree = 32;
		const factories: Array<() => Promise<string>> = [];
		for (let i = 0; i < degree; i++) {
			const userId = await seedUser(`money-${i}`, "1000");
			factories.push(
				placeTask({
					userId,
					marketId,
					side: i % 2 === 0 ? "YES" : "NO",
					stake: "10",
				}),
			);
		}
		await collide(factories, { degree, label: "money-math settle fan-out" });

		await testClient.unsafe(
			`UPDATE markets SET status = 'Resolving' WHERE id = $1`,
			[marketId],
		);
		const settled = await settleMarket({
			marketId,
			winningSide: "YES",
			reason: "Money-math fan-out settle.",
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});

		// One bet_payout leg per committed bet (uniformity — zero legs are real).
		const committed = (
			await testDb
				.select({ id: bets.id })
				.from(bets)
				.where(eq(bets.marketId, marketId))
		).length;
		expect(committed).toBeGreaterThan(0);
		const legs = await testDb
			.select({
				amount: payoutEvents.amount,
				payoutType: payoutEvents.payoutType,
			})
			.from(payoutEvents)
			.where(eq(payoutEvents.marketId, marketId));
		const payoutLegs = legs.filter((l) => l.payoutType === "bet_payout");
		expect(payoutLegs.length).toBe(committed);

		// EXACT conservation across the fan-out: Σ legs == totalPaidOut, 18 dp.
		const sum = payoutLegs.reduce(
			(acc, l) => acc.plus(l.amount),
			new CpmmDecimal(0),
		);
		expect(sum.toFixed(18)).toBe(
			new CpmmDecimal(settled.totalPaidOut).toFixed(18),
		);

		// Every leg is a canonical 18-dp non-negative string (floor-18, no float).
		for (const l of payoutLegs) {
			expect(l.amount).toMatch(/^\d+\.\d{18}$/);
			expect(new CpmmDecimal(l.amount).greaterThanOrEqualTo(0)).toBe(true);
		}
	});
});
