import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";

// DEBATE.2 — the image-attach RESOLVE + OWNERSHIP check (plan §3 step 3 / Files:
// `src/server/comments/image-attach.ts`). Resolves `image_uploads.r2_object_key`
// for an `imageUploadsId` and asserts ownership (uploader === bettor); a key owned
// by ANOTHER user → rejected (no cross-user image disclosure). The resolved
// r2ObjectKey is what the route routes into precommitModerate's `imageR2Key`.
//
// PINNED PUBLIC-API CONTRACT (the implementer matches these names exactly):
//   resolveImageAttachment(
//     client: DbClient | DbTransaction,
//     args: { userId: string; imageUploadsId: string },
//   ): Promise<{ uploadId: string; r2ObjectKey: string }>
//   - resolves the image_uploads row for imageUploadsId
//   - THROWS when the row is absent OR its user_id !== userId (ownership)
//   - returns { uploadId, r2ObjectKey } on success
//
// The ownership-rejection error class is the implementer's choice (the plan mints
// NO new wire code for it — the 3 new codes are comment_requires_bet /
// reply_depth_exceeded / parent_comment_not_found only); this test asserts only
// that the call REJECTS, not a specific class.
//
// DB-backed: seeds image_uploads rows directly. REDs on the greenfield
// `@/server/comments/image-attach` import. TRUNCATE in afterEach.

import { imageUploads, users } from "@/db/schema";
import { resolveImageAttachment } from "@/server/comments/image-attach";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Image-Attach User",
			email: `${tag}@example.com`,
			pseudonym: tag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedImageUpload(userId: string): Promise<{
	uploadId: string;
	key: string;
}> {
	// Mint the uploadId client-side so the final key is written at INSERT time —
	// `r2_object_key` is immutable post-INSERT (Bucket-B trigger), no UPDATE.
	const uploadId = uuidv7();
	const key = `u/${userId}/${uploadId}.png`;
	await testDb.insert(imageUploads).values({
		id: uploadId,
		userId,
		r2ObjectKey: key,
		contentType: "image/png",
		byteSize: 2048,
	});
	return { uploadId, key };
}

describe("resolveImageAttachment — resolve + ownership", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["image_uploads", "users"]);
	});

	it("image-attach::owner-resolves-r2-object-key", async () => {
		const userId = await seedUser("img-owner");
		const { uploadId, key } = await seedImageUpload(userId);

		const resolved = await resolveImageAttachment(testDb, {
			userId,
			imageUploadsId: uploadId,
		});
		expect(resolved.uploadId).toBe(uploadId);
		expect(resolved.r2ObjectKey).toBe(key);
	});

	it("image-attach::cross-user-key-rejected", async () => {
		// The image is owned by `owner`; `attacker` attempts to attach it →
		// rejected (no cross-user image disclosure).
		const owner = await seedUser("img-owner-2");
		const attacker = await seedUser("img-attacker");
		const { uploadId } = await seedImageUpload(owner);

		await expect(
			resolveImageAttachment(testDb, {
				userId: attacker,
				imageUploadsId: uploadId,
			}),
		).rejects.toThrow();
	});

	it("image-attach::missing-upload-rejected", async () => {
		const userId = await seedUser("img-missing");
		await expect(
			resolveImageAttachment(testDb, {
				userId,
				imageUploadsId: "0190b3a0-dead-7000-8000-00000000beef",
			}),
		).rejects.toThrow();
	});
});
