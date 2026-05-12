import { afterEach, describe, expect, it } from "vitest";

import { imageUploads, users } from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";

// Bucket B — image_uploads. Per SPEC.2 §6.3 + 0003 lines 134-162.
// Two-column atomic transition: terminal_state AND terminal_at must
// transition together (NULL → set, once). Per-table function
// enforce_image_uploads_terminal_atomic. BEFORE DELETE shares the
// Bucket-A no-delete function (0003 line 196).
//
// FK chain: users → image_uploads.
// Non-whitelisted column chosen for case 6: r2_object_key (text).

describe("image_uploads — append-only trigger (Bucket B)", () => {
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE image_uploads, users CASCADE`);
	});

	async function setupRow(suffix: string) {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "Uploader",
				email: `up-${suffix}@example.com`,
				pseudonym: `up-${suffix}`,
			})
			.returning({ id: users.id });

		const [img] = await testDb
			.insert(imageUploads)
			.values({
				userId: user?.id ?? "",
				r2ObjectKey: "uploads/test.jpg",
			})
			.returning({ id: imageUploads.id });

		return { imgId: img?.id ?? "" };
	}

	it("accepts terminal_state + terminal_at NULL→set together (atomic transition)", async () => {
		const { imgId } = await setupRow("1");

		await testClient.unsafe(
			`UPDATE image_uploads SET terminal_state = 'committed', terminal_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[imgId],
		);

		const rows = await testClient<
			{ terminal_state: string | null; terminal_at: Date | null }[]
		>`SELECT terminal_state, terminal_at FROM image_uploads WHERE id = ${imgId}`;
		expect(rows[0]?.terminal_state).toBe("committed");
		expect(rows[0]?.terminal_at).toEqual(new Date("2026-06-15T12:00:00Z"));
	});

	it("rejects re-firing terminal_state (one-shot)", async () => {
		const { imgId } = await setupRow("2");
		await testClient.unsafe(
			`UPDATE image_uploads SET terminal_state = 'committed', terminal_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[imgId],
		);

		await expect(
			testClient.unsafe(
				`UPDATE image_uploads SET terminal_state = 'blocked' WHERE id = $1`,
				[imgId],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("terminal_state is one-shot"),
		});
	});

	it("rejects re-firing terminal_at (one-shot)", async () => {
		const { imgId } = await setupRow("3");
		await testClient.unsafe(
			`UPDATE image_uploads SET terminal_state = 'committed', terminal_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[imgId],
		);

		await expect(
			testClient.unsafe(
				`UPDATE image_uploads SET terminal_at = '2026-07-01T00:00:00Z' WHERE id = $1`,
				[imgId],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("terminal_at is one-shot"),
		});
	});

	it("rejects partial transition: terminal_state set, terminal_at NULL", async () => {
		const { imgId } = await setupRow("4");

		await expect(
			testClient.unsafe(
				`UPDATE image_uploads SET terminal_state = 'committed' WHERE id = $1`,
				[imgId],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("must transition together"),
		});
	});

	it("rejects partial transition: terminal_at set, terminal_state NULL", async () => {
		const { imgId } = await setupRow("5");

		await expect(
			testClient.unsafe(
				`UPDATE image_uploads SET terminal_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
				[imgId],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("must transition together"),
		});
	});

	it("rejects non-whitelisted column update (r2_object_key)", async () => {
		const { imgId } = await setupRow("6");

		await expect(
			testClient.unsafe(
				`UPDATE image_uploads SET r2_object_key = 'changed.jpg' WHERE id = $1`,
				[imgId],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining(
				"only terminal_state + terminal_at may transition together",
			),
		});
	});

	it("accepts no-op UPDATE on pre-transition row (both NULL)", async () => {
		const { imgId } = await setupRow("7");

		await testClient.unsafe(
			`UPDATE image_uploads SET terminal_state = NULL, terminal_at = NULL WHERE id = $1`,
			[imgId],
		);

		const rows = await testClient<
			{ terminal_state: string | null; terminal_at: Date | null }[]
		>`SELECT terminal_state, terminal_at FROM image_uploads WHERE id = ${imgId}`;
		expect(rows[0]?.terminal_state).toBeNull();
		expect(rows[0]?.terminal_at).toBeNull();
	});

	it("rejects DELETE with P0001", async () => {
		const { imgId } = await setupRow("8");

		await expect(
			testClient.unsafe(`DELETE FROM image_uploads WHERE id = $1`, [imgId]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});
});
