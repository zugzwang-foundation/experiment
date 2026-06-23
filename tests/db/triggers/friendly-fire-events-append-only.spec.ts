import { afterEach, describe, expect, it } from "vitest";

import { comments, friendlyFireEvents, markets, users } from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";

// Bucket B — friendly_fire_events. Per SPEC.2 §6.3 + 0003 lines 74-104.
// Two independent whitelisted transitions (frozen_at, cleared_at) — either
// alone is permitted, both together rejected. Per-table function
// enforce_friendly_fire_events_transitions. BEFORE DELETE shares the
// Bucket-A no-delete function (0003 line 192).
//
// Universal 3-rule (uniform across Bucket B): permit no-op, reject re-fire
// (DISTINCT FROM), reject non-whitelisted column changes (per-column
// DISTINCT-FROM enumeration).
//
// FK chain: users (voter) → markets → comments (bet_id NULL) → friendly_fire_events.
// Non-whitelisted column chosen for case 6: direction (enum, up → down).

describe("friendly_fire_events — append-only trigger (Bucket B)", () => {
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE friendly_fire_events, comments, markets, users CASCADE`,
		);
	});

	async function setupRow() {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "Voter",
				email: `voter-${Date.now()}-${Math.random()}@example.com`,
				pseudonym: `voter-${Date.now()}-${Math.random()}`,
			})
			.returning({ id: users.id });

		const [market] = await testDb
			.insert(markets)
			.values({
				slug: `ff-mkt-${Date.now()}-${Math.random()}`,
				title: "ff test",
				resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
			})
			.returning({ id: markets.id });

		const [comment] = await testDb
			.insert(comments)
			.values({
				userId: user?.id ?? "",
				marketId: market?.id ?? "",
				body: "tgt",
				sideAtPostTime: "YES",
			})
			.returning({ id: comments.id });

		const [ff] = await testDb
			.insert(friendlyFireEvents)
			.values({
				voterId: user?.id ?? "",
				commentId: comment?.id ?? "",
				direction: "up",
			})
			.returning({ id: friendlyFireEvents.id });

		return { ffId: ff?.id ?? "" };
	}

	it("accepts frozen_at NULL→timestamp transition alone (cleared_at unchanged)", async () => {
		const { ffId } = await setupRow();

		await testClient.unsafe(
			`UPDATE friendly_fire_events SET frozen_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[ffId],
		);

		const rows = await testClient<{ frozen_at: Date | null }[]>`
			SELECT frozen_at FROM friendly_fire_events WHERE id = ${ffId}
		`;
		expect(rows[0]?.frozen_at).toEqual(new Date("2026-06-15T12:00:00Z"));
	});

	it("accepts cleared_at NULL→timestamp transition alone (frozen_at unchanged)", async () => {
		const { ffId } = await setupRow();

		await testClient.unsafe(
			`UPDATE friendly_fire_events SET cleared_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[ffId],
		);

		const rows = await testClient<{ cleared_at: Date | null }[]>`
			SELECT cleared_at FROM friendly_fire_events WHERE id = ${ffId}
		`;
		expect(rows[0]?.cleared_at).toEqual(new Date("2026-06-15T12:00:00Z"));
	});

	it("rejects frozen_at + cleared_at transitioning in same UPDATE", async () => {
		const { ffId } = await setupRow();

		await expect(
			testClient.unsafe(
				`UPDATE friendly_fire_events SET frozen_at = '2026-06-15T12:00:00Z', cleared_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
				[ffId],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("cannot both transition"),
		});
	});

	it("rejects re-firing frozen_at once set (one-shot)", async () => {
		const { ffId } = await setupRow();
		await testClient.unsafe(
			`UPDATE friendly_fire_events SET frozen_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[ffId],
		);

		await expect(
			testClient.unsafe(
				`UPDATE friendly_fire_events SET frozen_at = '2026-07-01T00:00:00Z' WHERE id = $1`,
				[ffId],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("frozen_at is one-shot"),
		});
	});

	it("rejects re-firing cleared_at once set (one-shot)", async () => {
		const { ffId } = await setupRow();
		await testClient.unsafe(
			`UPDATE friendly_fire_events SET cleared_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[ffId],
		);

		await expect(
			testClient.unsafe(
				`UPDATE friendly_fire_events SET cleared_at = '2026-07-01T00:00:00Z' WHERE id = $1`,
				[ffId],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("cleared_at is one-shot"),
		});
	});

	it("rejects non-whitelisted column update (direction up→down)", async () => {
		const { ffId } = await setupRow();

		await expect(
			testClient.unsafe(
				`UPDATE friendly_fire_events SET direction = 'down' WHERE id = $1`,
				[ffId],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining(
				"only frozen_at or cleared_at may transition",
			),
		});
	});

	it("accepts no-op UPDATE on pre-transition row (both frozen_at AND cleared_at NULL)", async () => {
		const { ffId } = await setupRow();

		await testClient.unsafe(
			`UPDATE friendly_fire_events SET frozen_at = NULL, cleared_at = NULL WHERE id = $1`,
			[ffId],
		);

		const rows = await testClient<
			{ frozen_at: Date | null; cleared_at: Date | null }[]
		>`SELECT frozen_at, cleared_at FROM friendly_fire_events WHERE id = ${ffId}`;
		expect(rows[0]?.frozen_at).toBeNull();
		expect(rows[0]?.cleared_at).toBeNull();
	});

	it("accepts no-op UPDATE after frozen_at set (3-rule: DISTINCT FROM on same value)", async () => {
		const { ffId } = await setupRow();
		await testClient.unsafe(
			`UPDATE friendly_fire_events SET frozen_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[ffId],
		);

		await testClient.unsafe(
			`UPDATE friendly_fire_events SET frozen_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[ffId],
		);

		const rows = await testClient<{ frozen_at: Date | null }[]>`
			SELECT frozen_at FROM friendly_fire_events WHERE id = ${ffId}
		`;
		expect(rows[0]?.frozen_at).toEqual(new Date("2026-06-15T12:00:00Z"));
	});

	it("accepts no-op UPDATE after cleared_at set (3-rule: DISTINCT FROM on same value)", async () => {
		const { ffId } = await setupRow();
		await testClient.unsafe(
			`UPDATE friendly_fire_events SET cleared_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[ffId],
		);

		await testClient.unsafe(
			`UPDATE friendly_fire_events SET cleared_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[ffId],
		);

		const rows = await testClient<{ cleared_at: Date | null }[]>`
			SELECT cleared_at FROM friendly_fire_events WHERE id = ${ffId}
		`;
		expect(rows[0]?.cleared_at).toEqual(new Date("2026-06-15T12:00:00Z"));
	});

	it("rejects DELETE with P0001 (Bucket B uses shared no-delete function)", async () => {
		const { ffId } = await setupRow();

		await expect(
			testClient.unsafe(`DELETE FROM friendly_fire_events WHERE id = $1`, [
				ffId,
			]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});
});
