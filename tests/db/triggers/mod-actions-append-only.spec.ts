import { afterEach, describe, expect, it } from "vitest";

import { modActions } from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";

// Bucket A — mod_actions. Per SPEC.2 §6.2 + 0003 lines 54-55.
// No FKs required for the test row — target_user_id / target_comment_id /
// target_bet_id are all nullable; actor_id is text 'admin-singleton' (not
// a users FK per SPEC.2 §8.7 pillar 1).

describe("mod_actions — append-only trigger", () => {
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE mod_actions CASCADE`);
	});

	it("rejects UPDATE with P0001", async () => {
		const [action] = await testDb
			.insert(modActions)
			.values({
				verdict: "pass",
				categories: {},
				actorId: "admin-singleton",
			})
			.returning({ id: modActions.id });

		await expect(
			testClient.unsafe(
				`UPDATE mod_actions SET verdict = 'track_a' WHERE id = $1`,
				[action?.id ?? ""],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("UPDATE not permitted"),
		});
	});

	it("rejects DELETE with P0001", async () => {
		const [action] = await testDb
			.insert(modActions)
			.values({
				verdict: "pass",
				categories: {},
				actorId: "admin-singleton",
			})
			.returning({ id: modActions.id });

		await expect(
			testClient.unsafe(`DELETE FROM mod_actions WHERE id = $1`, [
				action?.id ?? "",
			]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});
});
