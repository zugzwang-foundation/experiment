import { afterEach, describe, expect, it } from "vitest";

import { adminEvents } from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";

// Bucket A — admin_events. Per SPEC.2 §6.2 + 0003 lines 56-57.
// No FKs (admin has no users row per §8.7 pillar 1).

describe("admin_events — append-only trigger", () => {
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE admin_events CASCADE`);
	});

	it("rejects UPDATE with P0001", async () => {
		const [event] = await testDb
			.insert(adminEvents)
			.values({
				eventType: "admin.test",
				payload: {},
				metadata: {},
			})
			.returning({ id: adminEvents.id });

		await expect(
			testClient.unsafe(
				`UPDATE admin_events SET event_type = 'changed' WHERE id = $1`,
				[event?.id ?? ""],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("UPDATE not permitted"),
		});
	});

	it("rejects DELETE with P0001", async () => {
		const [event] = await testDb
			.insert(adminEvents)
			.values({
				eventType: "admin.test",
				payload: {},
				metadata: {},
			})
			.returning({ id: adminEvents.id });

		await expect(
			testClient.unsafe(`DELETE FROM admin_events WHERE id = $1`, [
				event?.id ?? "",
			]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});
});
