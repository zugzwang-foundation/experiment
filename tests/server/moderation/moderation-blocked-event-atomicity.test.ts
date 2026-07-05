import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B5 (A13) — atomicity: the `moderation.blocked` emit is INSIDE the
// same `recordGateBlock` transaction as the `mod_actions` row + track_a ban, so
// if the emit throws the WHOLE tx rolls back — no orphaned mod_actions row, no
// stamped ban (mirrors the INV-1 bet+comment atomicity property). Forces the
// throw by mocking `insertEvent`; the real `db.transaction` must undo the
// mod_actions INSERT + ban UPDATE.
//
// FAILING-FIRST: RED because `recordGateBlock` does not yet call `insertEvent`, so
// it commits normally — the tx never rolls back and the mod_actions row persists.

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	captureException: vi.fn(),
}));
vi.mock("@/server/events/insert", () => ({
	insertEvent: vi.fn(async () => {
		throw new Error("emit-boom");
	}),
}));

import { modActions, users } from "@/db/schema";
import { recordGateBlock } from "@/server/moderation/consequences";
import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";
import { seedOpenMarketWithPool, seedUser } from "./_fixtures/wire";

describe("AUDIT-FIX-B5 (A13) moderation.blocked — emit atomicity", () => {
	afterEach(async () => {
		await truncateTables(testClient, [
			"mod_actions",
			"events",
			"pools",
			"markets",
			"users",
		]);
	});

	it("emit throw rolls back the mod_actions row AND the ban", async () => {
		const userId = await seedUser("b5-atomic", "b5-atomic");
		const marketId = await seedOpenMarketWithPool("b5-atomic-market");

		await expect(
			recordGateBlock({
				outcome: "track_a",
				categories: ["sexual"],
				categoryScores: { sexual: 0.97 },
				userId,
				marketId,
				blockedText: "atomicity body",
			}),
		).rejects.toThrow(/emit-boom/);

		// The whole tx rolled back — no mod_actions row was persisted.
		const rows = await testDb.select({ id: modActions.id }).from(modActions);
		expect(rows.length).toBe(0);

		// And the track_a ban was undone with it.
		const [u] = await testDb
			.select({ bannedAt: users.bannedAt })
			.from(users)
			.where(eq(users.id, userId));
		expect(u?.bannedAt).toBeNull();
	});
});
