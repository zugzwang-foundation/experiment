import { afterEach, describe, expect, it } from "vitest";

import { imageUploads, users } from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";
import { truncateTables } from "../_fixtures/truncate";

// Bucket B — image_uploads. Per SPEC.2 §6.3 + 0003 lines 134-162.
// Two-column atomic transition: terminal_state AND terminal_at must
// transition together (NULL → set, once). Per-table function
// enforce_image_uploads_terminal_atomic. BEFORE DELETE shares the
// Bucket-A no-delete function (0003 line 196).
//
// FK chain: users → image_uploads.
// Non-whitelisted column chosen for case 6: r2_object_key (text).
//
// SCAFFOLD.15 (0006) extension cases added to this file:
//   - 1 driver: terminal transition with content_type/byte_size unchanged
//   - 2 guards: content_type + byte_size each rejected via the extended
//     immutable column list inside enforce_image_uploads_terminal_atomic
//   - 2 guards: CHECK (byte_size > 0 AND byte_size <= 8388608) fires at
//     INSERT for both bound violations (SQLSTATE 23514, NOT P0001 — the
//     CHECK is a constraint, not the trigger).

describe("image_uploads — append-only trigger (Bucket B)", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["image_uploads", "users"]);
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
				contentType: "image/jpeg",
				byteSize: 102_400,
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

	// === SCAFFOLD.15 (0006) trigger-extension cases ===========================

	it("accepts terminal transition with content_type/byte_size unchanged (driver)", async () => {
		// Happy path with the two new columns persisted. terminal_state +
		// terminal_at flip together; content_type + byte_size stay identical
		// (the UPDATE doesn't touch them). Verifies the extended immutable
		// list does NOT reject no-op identity passthrough.
		const { imgId } = await setupRow("9");

		await testClient.unsafe(
			`UPDATE image_uploads SET terminal_state = 'committed', terminal_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[imgId],
		);

		const rows = await testClient<
			{
				terminal_state: string | null;
				terminal_at: Date | null;
				content_type: string;
				byte_size: number;
			}[]
		>`SELECT terminal_state, terminal_at, content_type, byte_size FROM image_uploads WHERE id = ${imgId}`;
		expect(rows[0]?.terminal_state).toBe("committed");
		expect(rows[0]?.terminal_at).toEqual(new Date("2026-06-15T12:00:00Z"));
		expect(rows[0]?.content_type).toBe("image/jpeg");
		expect(rows[0]?.byte_size).toBe(102_400);
	});

	it("rejects content_type mutation (extended immutable list)", async () => {
		const { imgId } = await setupRow("10");

		await expect(
			testClient.unsafe(
				`UPDATE image_uploads SET content_type = 'image/png' WHERE id = $1`,
				[imgId],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining(
				"only terminal_state + terminal_at may transition together",
			),
		});
	});

	it("rejects byte_size mutation (extended immutable list)", async () => {
		const { imgId } = await setupRow("11");

		await expect(
			testClient.unsafe(
				`UPDATE image_uploads SET byte_size = 1024 WHERE id = $1`,
				[imgId],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining(
				"only terminal_state + terminal_at may transition together",
			),
		});
	});

	it("rejects byte_size at INSERT > 8388608 (CHECK constraint, SQLSTATE 23514)", async () => {
		// CHECK (byte_size > 0 AND byte_size <= 8388608) lives in the migration
		// SQL, not the trigger. INSERT-time violation fires SQLSTATE 23514
		// (check_violation), NOT P0001 (trigger raise). The discriminator
		// matters for downstream error mapping (CHECK violations are user-
		// input errors → 400; P0001 from triggers are integrity errors → 500).
		const [user] = await testDb
			.insert(users)
			.values({
				name: "Uploader",
				email: "up-12@example.com",
				pseudonym: "up-12",
			})
			.returning({ id: users.id });

		await expect(
			testClient.unsafe(
				`INSERT INTO image_uploads (user_id, r2_object_key, content_type, byte_size)
				 VALUES ($1, $2, $3, $4)`,
				[user?.id ?? "", "uploads/over.jpg", "image/jpeg", 8_388_609],
			),
		).rejects.toMatchObject({
			code: "23514",
		});
	});

	it("rejects byte_size at INSERT <= 0 (CHECK constraint, SQLSTATE 23514)", async () => {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "Uploader",
				email: "up-13@example.com",
				pseudonym: "up-13",
			})
			.returning({ id: users.id });

		await expect(
			testClient.unsafe(
				`INSERT INTO image_uploads (user_id, r2_object_key, content_type, byte_size)
				 VALUES ($1, $2, $3, $4)`,
				[user?.id ?? "", "uploads/zero.jpg", "image/jpeg", 0],
			),
		).rejects.toMatchObject({
			code: "23514",
		});
	});
});
