import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { markets, positions, users } from "@/db/schema";
import { upsertPositionDelta } from "@/server/positions/persist";
import { testClient, testDb } from "../db/_fixtures/db";

// I-NO-OVERSELL-001 (positions quantity ≥ 0). Naming per SPEC.2 §14.2 — slug
// NO-OVERSELL, seed 001, canonical slug positions-quantity-non-negative.
//
// NOTE (plan §7 / self-critique #5): oversell is a SPEC RULE, not one of the
// four hard invariants (INV-1..4). `I-…` here = an invariant-CLASS integrity
// spec — the I-NO-OVERDRAFT-001 precedent for a non-INV-1..4 integrity property
// (R-3 mints it). Two mechanisms, mirroring I-NO-OVERDRAFT-001's two-`it` shape:
//   (i)  the application-layer guarantee: quantity ≥ 0 holds across a buy/sell
//        sequence driven by upsertPositionDelta (PositionOversellError is the
//        advisory mirror).
//   (ii) the storage-layer ground truth: a FORCED-negative raw insert
//        (bypassing the app via testClient.unsafe) is rejected by the CHECK
//        positions_quantity_non_negative — Postgres 23514. This is the per-row
//        oversell storage floor (Migration A).
//
// DB-BACKED: cannot RED locally (PROBE-P2 — local Postgres :54322 DOWN;
// ECONNREFUSED is infra, not an assertion red). First true run is CI on the PR.
// The greenfield value import (`upsertPositionDelta`) keeps this from resolving
// until ENGINE.11 lands.

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Oversell User",
			email: `${emailTag}@example.com`,
			pseudonym,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedMarket(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Oversell Market",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

describe("I-NO-OVERSELL-001: positions.quantity ≥ 0", () => {
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE positions, markets, users CASCADE`);
	});

	it("positions-no-oversell::quantity-stays-non-negative-across-sequence", async () => {
		const userId = await seedUser("os-seq", "os-seq");
		const marketId = await seedMarket("os-seq-market");

		// Buy 100.
		const buy = await testDb.transaction((tx) =>
			upsertPositionDelta(tx, {
				userId,
				marketId,
				side: "YES",
				shareDelta: "100",
			}),
		);
		expect(buy.quantity).toBe("100.000000000000000000");

		// Sell 40 → 60.
		const partialSell = await testDb.transaction((tx) =>
			upsertPositionDelta(tx, {
				userId,
				marketId,
				side: "YES",
				shareDelta: "-40",
			}),
		);
		expect(partialSell.quantity).toBe("60.000000000000000000");

		// Sell the remaining 60 EXACTLY to zero — allowed, still ≥ 0.
		const sellToZero = await testDb.transaction((tx) =>
			upsertPositionDelta(tx, {
				userId,
				marketId,
				side: "YES",
				shareDelta: "-60",
			}),
		);
		expect(sellToZero.quantity).toBe("0.000000000000000000");

		// Every persisted quantity is ≥ 0.
		const rows = await testDb
			.select({ quantity: positions.quantity })
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		for (const r of rows) {
			// String sign check — exact, float-free (CLAUDE.md §2); also rejects a
			// non-canonical "-0…" that Number(x) >= 0 would accept.
			expect(r.quantity.startsWith("-")).toBe(false);
		}
	});

	it("positions-no-oversell::storage-CHECK-rejects-forced-negative", async () => {
		const userId = await seedUser("os-check", "os-check");
		const marketId = await seedMarket("os-check-market");

		// Bypass the app layer entirely (testClient.unsafe) and force a negative
		// quantity — the storage CHECK is the only enforcement under test here
		// (SPEC.2 §6.6 fixture-bypass posture).
		await expect(
			testClient.unsafe(
				`INSERT INTO positions (user_id, market_id, side, quantity)
				 VALUES ($1, $2, 'YES', '-1')`,
				[userId, marketId],
			),
		).rejects.toMatchObject({
			code: "23514",
			constraint_name: "positions_quantity_non_negative",
		});
	});
});
