import { afterEach, describe, expect, it } from "vitest";

import { userEvents, users } from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";

// Bucket A — user_events. Per SPEC.2 §6.2 + 0003 lines 58-59.
// FK chain: users → user_events.

describe("user_events — append-only trigger", () => {
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE user_events, users CASCADE`);
	});

	it("rejects UPDATE with P0001", async () => {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "Test User",
				email: "ue-test-1@example.com",
				pseudonym: "blue-fox-ue-1",
			})
			.returning({ id: users.id });

		const [event] = await testDb
			.insert(userEvents)
			.values({
				userId: user?.id ?? "",
				eventType: "user.test",
				payload: {},
				metadata: {},
			})
			.returning({ id: userEvents.id });

		await expect(
			testClient.unsafe(
				`UPDATE user_events SET event_type = 'changed' WHERE id = $1`,
				[event?.id ?? ""],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("UPDATE not permitted"),
		});
	});

	it("rejects DELETE with P0001", async () => {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "Test User",
				email: "ue-test-2@example.com",
				pseudonym: "blue-fox-ue-2",
			})
			.returning({ id: users.id });

		const [event] = await testDb
			.insert(userEvents)
			.values({
				userId: user?.id ?? "",
				eventType: "user.test",
				payload: {},
				metadata: {},
			})
			.returning({ id: userEvents.id });

		await expect(
			testClient.unsafe(`DELETE FROM user_events WHERE id = $1`, [
				event?.id ?? "",
			]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});
});
