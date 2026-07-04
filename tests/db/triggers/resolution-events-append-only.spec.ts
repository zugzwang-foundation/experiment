import { afterEach, describe, expect, it } from "vitest";

import { markets, resolutionEvents } from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";
import { truncateTables } from "../_fixtures/truncate";

// Bucket A — resolution_events. Per SPEC.2 §6.2 + 0003 lines 50-51.
// Storage-layer mechanism (ii) of INV-4 (append-only resolutions) at the
// per-table layer. The canonical INV-4 integration test at
// tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts
// re-verifies this at higher granularity.
//
// FK chain: markets → resolution_events.

describe("resolution_events — append-only trigger", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["resolution_events", "markets"]);
	});

	it("rejects UPDATE with P0001", async () => {
		const [market] = await testDb
			.insert(markets)
			.values({
				slug: "test-market-res-1",
				title: "Test Market res 1",
				resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
			})
			.returning({ id: markets.id });

		const [event] = await testDb
			.insert(resolutionEvents)
			.values({
				marketId: market?.id ?? "",
				eventKind: "resolve",
				outcome: "YES",
				reason: "initial",
			})
			.returning({ id: resolutionEvents.id });

		await expect(
			testClient.unsafe(
				`UPDATE resolution_events SET reason = 'changed' WHERE id = $1`,
				[event?.id ?? ""],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("UPDATE not permitted"),
		});
	});

	it("rejects DELETE with P0001", async () => {
		const [market] = await testDb
			.insert(markets)
			.values({
				slug: "test-market-res-2",
				title: "Test Market res 2",
				resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
			})
			.returning({ id: markets.id });

		const [event] = await testDb
			.insert(resolutionEvents)
			.values({
				marketId: market?.id ?? "",
				eventKind: "resolve",
				outcome: "YES",
				reason: "initial",
			})
			.returning({ id: resolutionEvents.id });

		await expect(
			testClient.unsafe(`DELETE FROM resolution_events WHERE id = $1`, [
				event?.id ?? "",
			]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});
});
