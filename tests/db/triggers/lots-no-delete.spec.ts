import { afterEach, describe, expect, it } from "vitest";

import { bets, comments, lots, markets, users } from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";
import { truncateTables } from "../_fixtures/truncate";

// PHASE-0 / ADR-0039 R9 — migration 0026.
//
// `lots` is BUCKET C and stays there: a lot row CHANGES on every sell, which is
// what `surviving_shares` is for. What R9 adds is narrower — the row may change
// in one direction, forever, and may never LEAVE. 0025 backed the direction with
// monotonicity CHECKs and left the permanence to nobody; 0026 closes it with a
// row-level BEFORE DELETE reject.
//
// A DELETE is the one way to break R2 (Σ lots.surviving_shares ==
// positions.quantity) that leaves no evidence: the CHECKs bound every surviving
// row from both ends, so they cannot see a summand that is no longer there.
//
// The second test is the one that matters most, and it is a POSITIVE control
// rather than a rejection: 0025's header promises that `lots` needs no TRUNCATE
// guard and that `TRUNCATE bets CASCADE` still empties it, so the teardown path
// and `pnpm staging:reset` are untouched. 0026 must not quietly revoke that.
// TRUNCATE fires no ROW-level triggers — but "must not have broken the reset"
// is exactly the kind of claim that is cheap to assert and expensive to assume.

async function seedLot(tag: string): Promise<{ lotId: string }> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Lot User",
			email: `lot-nodelete-${tag}@example.com`,
			pseudonym: `lot-nodelete-${tag}`,
		})
		.returning({ id: users.id });
	const [market] = await testDb
		.insert(markets)
		.values({
			slug: `lot-nodelete-market-${tag}`,
			title: "Lot Market",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const [comment] = await testDb
		.insert(comments)
		.values({
			userId: user?.id ?? "",
			marketId: market?.id ?? "",
			body: "a lot is a bet is an argument",
			sideAtPostTime: "YES",
		})
		.returning({ id: comments.id });
	const [bet] = await testDb
		.insert(bets)
		.values({
			userId: user?.id ?? "",
			marketId: market?.id ?? "",
			side: "YES",
			stake: "10",
			shareQuantity: "20",
			priceAtBet: "0.5",
			commentId: comment?.id ?? "",
		})
		.returning({ id: bets.id });
	const [lot] = await testDb
		.insert(lots)
		.values({
			betId: bet?.id ?? "",
			userId: user?.id ?? "",
			marketId: market?.id ?? "",
			side: "YES",
			originalShares: "20",
			originalBasis: "10",
			survivingShares: "20",
			survivingBasis: "10",
		})
		.returning({ id: lots.id });
	return { lotId: lot?.id ?? "" };
}

describe("lots — R9 no-delete trigger (0026)", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["bets", "comments", "markets", "users"]);
	});

	it("rejects DELETE with P0001", async () => {
		const { lotId } = await seedLot("del");

		await expect(
			testClient.unsafe(`DELETE FROM lots WHERE id = $1`, [lotId]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});

	it("rejects a DELETE that names no row in particular", async () => {
		// `DELETE FROM lots` with no WHERE is the shape a panicked cleanup takes,
		// and a BEFORE-ROW trigger fires per row — so this rejects on the first
		// one and aborts the statement. Pinned because the un-WHEREd form is the
		// one that would destroy the most.
		await seedLot("all");

		await expect(testClient.unsafe(`DELETE FROM lots`)).rejects.toMatchObject({
			code: "P0001",
		});

		const survivors = await testDb.select({ id: lots.id }).from(lots);
		expect(survivors).toHaveLength(1);
	});

	it("does NOT block TRUNCATE bets CASCADE — the reset path is unaffected", async () => {
		await seedLot("trunc");
		const before = await testDb.select({ id: lots.id }).from(lots);
		expect(before).toHaveLength(1);

		// The real teardown helper, not a hand-rolled TRUNCATE: the thing under
		// test is that the path `pnpm staging:reset` and every suite teardown
		// already take still works, so it has to be that exact path.
		await truncateTables(testClient, ["bets", "comments", "markets", "users"]);

		const after = await testDb.select({ id: lots.id }).from(lots);
		expect(after).toHaveLength(0);
	});

	it("carries no TRUNCATE guard and stays out of the bucket_% catalog", async () => {
		// The storage-layer statement of the classification. `lots` is Bucket C;
		// the guard is deliberately named `lots_no_delete` rather than `bucket_%`
		// so it cannot enter the reset's G-4 catalog and move
		// EXPECTED_GUARD_CATALOG_ROWS while claiming a bucket family of one.
		const onLots = await testClient.unsafe<Array<{ tgname: string }>>(
			`SELECT t.tgname FROM pg_trigger t
			   JOIN pg_class c ON c.oid = t.tgrelid
			  WHERE c.relname = 'lots' AND NOT t.tgisinternal
			  ORDER BY t.tgname`,
		);
		expect(onLots.map((r) => r.tgname)).toEqual(["lots_no_delete"]);

		const [catalog] = await testClient.unsafe<Array<{ n: string }>>(
			`SELECT count(*)::text AS n FROM pg_trigger t
			   JOIN pg_class c ON c.oid = t.tgrelid
			   JOIN pg_namespace ns ON ns.oid = c.relnamespace
			  WHERE NOT t.tgisinternal
			    AND ns.nspname = 'public'
			    AND t.tgname LIKE 'bucket_%'`,
		);
		expect(catalog?.n).toBe("78");
	});
});
