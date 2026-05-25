import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per ENGINE.6 plan §D.1 (SCAFFOLD.15 helper refactor — SURPRISE-A
// absorption) + §F migration-site tests. RE-BASELINED from the SCAFFOLD.15
// substrate test so the new `signUploadAndInsert(tx, args)` shape is the
// thing under test:
//   - Param shape change: takes `tx: DbTransaction` (NOT `db: DbClient | DbTransaction`).
//   - New params: `eventId`, `metadata` (caller-supplied at handler entry).
//   - Returns `{ uploadId, key }` (drops `putUrl` — the route now mints it AFTER tx).
//   - Calls `insertEvent(tx, { eventType: 'image_upload.sign_requested', ... })`
//     inside the same tx as the image_uploads INSERT.
//   - mintPutUrl runs in the route AFTER the tx commits (HTTP-outside-tx per
//     CLAUDE.md §3 + ADR-0014). The helper itself MUST NOT call mintPutUrl.
//
// Mocks:
//   - `@/server/storage/r2` `mintPutUrl` — defaults to throw to surface any
//     legacy code-path that still calls it from inside the helper. The
//     refactor moves mintPutUrl OUT of the helper into the route handler.
//
// NOT mocked: testDb (image_uploads INSERT is a real round-trip; trigger
// semantics are real).

const { mockMintPutUrl } = vi.hoisted(() => ({
	mockMintPutUrl: vi.fn(),
}));

vi.mock("@/server/storage/r2", () => ({
	mintPutUrl: mockMintPutUrl,
	mintReadUrl: vi.fn(),
	headObject: vi.fn(),
	deleteObject: vi.fn(),
}));

import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import { imageUploads, users } from "@/db/schema";
import { ImageMimeRejectedError, ImageOversizeError } from "@/lib/errors";
import {
	IMAGE_UPLOADS_ALLOWED_MIME,
	IMAGE_UPLOADS_EXT_BY_MIME,
	IMAGE_UPLOADS_MAX_BYTES,
} from "@/server/config/limits";
import { signUploadAndInsert } from "@/server/storage/sign-upload";
import { testClient, testDb } from "../db/_fixtures/db";

beforeEach(() => {
	mockMintPutUrl.mockReset();
	// Default to throw — any helper code path that still calls mintPutUrl
	// inside the tx fails loudly. The refactor at plan §D.1 moves
	// mintPutUrl into the route AFTER the tx commits.
	mockMintPutUrl.mockImplementation(() => {
		throw new Error(
			"mintPutUrl MUST NOT be called from inside signUploadAndInsert post-ENGINE.6 §D.1 refactor",
		);
	});
});

afterEach(async () => {
	await testClient.unsafe(`TRUNCATE events, image_uploads, users CASCADE`);
	vi.clearAllMocks();
});

async function seedUser(suffix: string): Promise<{ userId: string }> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Uploader",
			email: `signup-${suffix}@example.com`,
			pseudonym: `signup-${suffix}`,
		})
		.returning({ id: users.id });
	if (!user) throw new Error("user seed failed");
	return { userId: user.id };
}

function baseMetadata(userId: string) {
	return {
		request_id: "req-sign",
		flow_id: "F-COMMENT-3",
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: "1.2.3.4",
		user_agent: "Mozilla/5.0",
	};
}

describe("signUploadAndInsert (ENGINE.6 §D.1 rebaseline)", () => {
	// === MIME whitelist enforcement (unchanged semantics; shape change only) =

	it("sign-upload::rejects-disallowed-mime", async () => {
		// pdf is not in the IMAGE_UPLOADS_ALLOWED_MIME whitelist; helper
		// throws ImageMimeRejectedError BEFORE the INSERT fires. Refactored
		// helper takes `tx`; we wrap in a transaction that throws on
		// rejection (Drizzle aborts the tx on the throw).
		const { userId } = await seedUser("mime-bad");

		await expect(
			testDb.transaction(async (tx) => {
				await signUploadAndInsert(tx, {
					userId,
					contentType: "application/pdf",
					byteSize: 1024,
					eventId: uuidv7(),
					metadata: baseMetadata(userId),
				});
			}),
		).rejects.toBeInstanceOf(ImageMimeRejectedError);

		const rows = await testDb
			.select({ id: imageUploads.id })
			.from(imageUploads)
			.where(eq(imageUploads.userId, userId));
		expect(rows).toHaveLength(0);
	});

	it("sign-upload::rejects-image-svg-xml-not-whitelisted", async () => {
		const { userId } = await seedUser("svg");
		await expect(
			testDb.transaction(async (tx) => {
				await signUploadAndInsert(tx, {
					userId,
					contentType: "image/svg+xml",
					byteSize: 2048,
					eventId: uuidv7(),
					metadata: baseMetadata(userId),
				});
			}),
		).rejects.toBeInstanceOf(ImageMimeRejectedError);
	});

	// === byte-size cap enforcement (unchanged semantics; shape change only) ==

	it("sign-upload::rejects-byte-size-over-cap", async () => {
		const { userId } = await seedUser("over");
		await expect(
			testDb.transaction(async (tx) => {
				await signUploadAndInsert(tx, {
					userId,
					contentType: "image/jpeg",
					byteSize: IMAGE_UPLOADS_MAX_BYTES + 1,
					eventId: uuidv7(),
					metadata: baseMetadata(userId),
				});
			}),
		).rejects.toBeInstanceOf(ImageOversizeError);
	});

	it("sign-upload::rejects-byte-size-zero", async () => {
		const { userId } = await seedUser("zero");
		await expect(
			testDb.transaction(async (tx) => {
				await signUploadAndInsert(tx, {
					userId,
					contentType: "image/jpeg",
					byteSize: 0,
					eventId: uuidv7(),
					metadata: baseMetadata(userId),
				});
			}),
		).rejects.toBeInstanceOf(ImageOversizeError);
	});

	it("sign-upload::rejects-byte-size-negative", async () => {
		const { userId } = await seedUser("neg");
		await expect(
			testDb.transaction(async (tx) => {
				await signUploadAndInsert(tx, {
					userId,
					contentType: "image/png",
					byteSize: -1,
					eventId: uuidv7(),
					metadata: baseMetadata(userId),
				});
			}),
		).rejects.toBeInstanceOf(ImageOversizeError);
	});

	// === happy-path: row inserted with content_type + byte_size populated ====

	it("sign-upload::inserts-row-with-content-type-and-byte-size", async () => {
		const { userId } = await seedUser("ok-jpg");
		let uploadId = "";

		await testDb.transaction(async (tx) => {
			const r = await signUploadAndInsert(tx, {
				userId,
				contentType: "image/jpeg",
				byteSize: 102400,
				eventId: uuidv7(),
				metadata: baseMetadata(userId),
			});
			uploadId = r.uploadId;
		});

		const rows = await testDb
			.select({
				id: imageUploads.id,
				userId: imageUploads.userId,
				contentType: imageUploads.contentType,
				byteSize: imageUploads.byteSize,
				terminalState: imageUploads.terminalState,
			})
			.from(imageUploads)
			.where(eq(imageUploads.id, uploadId));

		expect(rows).toHaveLength(1);
		expect(rows[0]?.userId).toBe(userId);
		expect(rows[0]?.contentType).toBe("image/jpeg");
		expect(rows[0]?.byteSize).toBe(102400);
		expect(rows[0]?.terminalState).toBeNull();
	});

	// === Return shape: { uploadId, key } only (NO putUrl) ====================

	it("sign-upload::returns-uploadId-and-key-only-no-puturl", async () => {
		// Plan §D.1: the refactored helper returns `{ uploadId, key }`. The
		// route mints `putUrl` AFTER the tx commits. Any code-path that
		// returns `putUrl` from the helper is post-ENGINE.6 wrong.
		const { userId } = await seedUser("ret-shape");

		await testDb.transaction(async (tx) => {
			const r = await signUploadAndInsert(tx, {
				userId,
				contentType: "image/jpeg",
				byteSize: 50_000,
				eventId: uuidv7(),
				metadata: baseMetadata(userId),
			});
			expect(typeof r.uploadId).toBe("string");
			expect(typeof r.key).toBe("string");
			// putUrl is no longer in the helper's return shape.
			expect((r as unknown as { putUrl?: unknown }).putUrl).toBeUndefined();
		});

		// mintPutUrl MUST NOT have been called from the helper (the
		// beforeEach mock throws if it is).
		expect(mockMintPutUrl).not.toHaveBeenCalled();
	});

	// === Key shape contract preserved (unchanged) ============================

	it("sign-upload::key-shape-u-userid-uploadid-ext-jpg", async () => {
		const { userId } = await seedUser("key-jpg");
		let key = "";
		let uploadId = "";
		await testDb.transaction(async (tx) => {
			const r = await signUploadAndInsert(tx, {
				userId,
				contentType: "image/jpeg",
				byteSize: 50_000,
				eventId: uuidv7(),
				metadata: baseMetadata(userId),
			});
			key = r.key;
			uploadId = r.uploadId;
		});

		expect(key).toBe(`u/${userId}/${uploadId}.jpg`);
		const rows = await testDb
			.select({ r2ObjectKey: imageUploads.r2ObjectKey })
			.from(imageUploads)
			.where(eq(imageUploads.id, uploadId));
		expect(rows[0]?.r2ObjectKey).toBe(key);
	});

	// === Ext mapping (unchanged) =============================================

	it("sign-upload::ext-mapping-png", async () => {
		const { userId } = await seedUser("key-png");
		await testDb.transaction(async (tx) => {
			const { key } = await signUploadAndInsert(tx, {
				userId,
				contentType: "image/png",
				byteSize: 50_000,
				eventId: uuidv7(),
				metadata: baseMetadata(userId),
			});
			expect(key.endsWith(".png")).toBe(true);
		});
		expect(IMAGE_UPLOADS_EXT_BY_MIME["image/png"]).toBe("png");
	});

	it("sign-upload::ext-mapping-webp", async () => {
		const { userId } = await seedUser("key-webp");
		await testDb.transaction(async (tx) => {
			const { key } = await signUploadAndInsert(tx, {
				userId,
				contentType: "image/webp",
				byteSize: 50_000,
				eventId: uuidv7(),
				metadata: baseMetadata(userId),
			});
			expect(key.endsWith(".webp")).toBe(true);
		});
		expect(IMAGE_UPLOADS_EXT_BY_MIME["image/webp"]).toBe("webp");
	});

	it("sign-upload::ext-mapping-gif", async () => {
		const { userId } = await seedUser("key-gif");
		await testDb.transaction(async (tx) => {
			const { key } = await signUploadAndInsert(tx, {
				userId,
				contentType: "image/gif",
				byteSize: 50_000,
				eventId: uuidv7(),
				metadata: baseMetadata(userId),
			});
			expect(key.endsWith(".gif")).toBe(true);
		});
		expect(IMAGE_UPLOADS_EXT_BY_MIME["image/gif"]).toBe("gif");
	});

	it("sign-upload::ext-mapping-avif", async () => {
		const { userId } = await seedUser("key-avif");
		await testDb.transaction(async (tx) => {
			const { key } = await signUploadAndInsert(tx, {
				userId,
				contentType: "image/avif",
				byteSize: 50_000,
				eventId: uuidv7(),
				metadata: baseMetadata(userId),
			});
			expect(key.endsWith(".avif")).toBe(true);
		});
		expect(IMAGE_UPLOADS_EXT_BY_MIME["image/avif"]).toBe("avif");
	});

	// === Cap-boundary (inclusive) ============================================

	it("sign-upload::accepts-byte-size-at-cap-boundary", async () => {
		const { userId } = await seedUser("at-cap");
		let uploadId = "";
		await testDb.transaction(async (tx) => {
			const r = await signUploadAndInsert(tx, {
				userId,
				contentType: "image/jpeg",
				byteSize: IMAGE_UPLOADS_MAX_BYTES,
				eventId: uuidv7(),
				metadata: baseMetadata(userId),
			});
			uploadId = r.uploadId;
		});
		const rows = await testDb
			.select({ byteSize: imageUploads.byteSize })
			.from(imageUploads)
			.where(eq(imageUploads.id, uploadId));
		expect(rows[0]?.byteSize).toBe(IMAGE_UPLOADS_MAX_BYTES);
		expect(IMAGE_UPLOADS_MAX_BYTES).toBe(8 * 1024 * 1024);
	});

	// === Whitelist shape (unchanged) =========================================

	it("sign-upload::allowed-mime-whitelist-shape", async () => {
		expect(IMAGE_UPLOADS_ALLOWED_MIME).toEqual([
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/gif",
			"image/avif",
		]);
	});

	// === Helper does NOT call mintPutUrl (new in §D.1) =======================

	it("sign-upload::helper-does-not-call-mintPutUrl-from-inside-tx", async () => {
		// Plan §D.1 + CLAUDE.md §3: HTTP-inside-tx is a refusal trigger. The
		// refactored helper MUST NOT call mintPutUrl. The route handler does
		// it AFTER the tx commits.
		const { userId } = await seedUser("no-mint");
		await testDb.transaction(async (tx) => {
			await signUploadAndInsert(tx, {
				userId,
				contentType: "image/jpeg",
				byteSize: 50_000,
				eventId: uuidv7(),
				metadata: baseMetadata(userId),
			});
		});
		expect(mockMintPutUrl).not.toHaveBeenCalled();
	});
});
