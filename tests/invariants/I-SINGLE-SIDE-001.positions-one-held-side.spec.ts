import { afterEach, describe, expect, it } from "vitest";
import { markets, users } from "@/db/schema";
import { getHeldPosition } from "@/server/positions/read";
import { testClient, testDb } from "../db/_fixtures/db";

// I-SINGLE-SIDE-001 (at most one held side per (user,market)). Naming per
// SPEC.2 §14.2 — slug SINGLE-SIDE, seed 001, canonical slug
// positions-one-held-side.
//
// NOTE (plan §7 / self-critique #5): single-side is a SPEC RULE (SPEC.1 §7
// preamble), not one of the four hard invariants (INV-1..4). `I-…` here =
// an invariant-CLASS integrity spec — the I-NO-OVERDRAFT-001 precedent for a
// non-INV-1..4 integrity property (R-5 mints it). Two mechanisms:
//   (i)  the storage-layer ground truth: the partial unique index
//        positions_one_held_side_idx (Migration A) rejects a SECOND quantity>0
//        row per (user,market) — Postgres 23505.
//   (ii) the read predicate (`getHeldPosition`) asserts ≤1 held row
//        (defense-in-depth, R-5/§6); with a single held row seeded it returns
//        exactly that one held side. The "≤1" guarantee is the structural index.
//
// DB-BACKED: cannot RED locally (PROBE-P2 — local Postgres :54322 DOWN;
// ECONNREFUSED is infra, not an assertion red). First true run is CI on the PR.
// The greenfield value import (`getHeldPosition`) keeps this from resolving
// until ENGINE.11 lands.

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Single-Side User",
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
			title: "Single-Side Market",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

async function seedPosition(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	quantity: string;
}): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO positions (user_id, market_id, side, quantity)
		 VALUES ($1, $2, $3, $4)`,
		[args.userId, args.marketId, args.side, args.quantity],
	);
}

describe("I-SINGLE-SIDE-001: at most one held side per (user,market)", () => {
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE positions, markets, users CASCADE`);
	});

	it("positions-single-side::partial-unique-rejects-second-held-side", async () => {
		const userId = await seedUser("ss-dual", "ss-dual");
		const marketId = await seedMarket("ss-dual-market");

		// First held side: YES, quantity 10.
		await seedPosition({ userId, marketId, side: "YES", quantity: "10" });

		// A second held side (NO, quantity 10) for the same (user,market) is
		// rejected by the partial unique index — the structural single-side rule
		// that the whole SPEC.1 §7 single-side argument rests on.
		await expect(
			seedPosition({ userId, marketId, side: "NO", quantity: "10" }),
		).rejects.toMatchObject({
			code: "23505",
			constraint_name: "positions_one_held_side_idx",
		});
	});

	it("positions-single-side::read-returns-the-single-held-side", async () => {
		const userId = await seedUser("ss-read", "ss-read");
		const marketId = await seedMarket("ss-read-market");

		// A YES held row plus a NON-held NO row (quantity 0, dropped from the
		// partial index). getHeldPosition filters quantity>0, asserts ≤1, and
		// returns exactly the single held side.
		await seedPosition({ userId, marketId, side: "YES", quantity: "10" });
		await seedPosition({ userId, marketId, side: "NO", quantity: "0" });

		const held = await getHeldPosition(testDb, { userId, marketId });
		expect(held).toEqual({ side: "YES", quantity: "10.000000000000000000" });
	});
});
