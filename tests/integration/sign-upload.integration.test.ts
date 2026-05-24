import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.15 plan §5.1 + §9.1 — substrate tests for
// `signUploadAndInsert({ db, userId, contentType, byteSize })`. Verifies:
//   - MIME-whitelist enforcement (ImageMimeRejectedError)
//   - byte-size cap enforcement (ImageOversizeError)
//   - key shape `u/${userId}/${uploadId}.${ext}` (per Q9 ratification +
//     §12.9 amendment #11)
//   - INSERT into image_uploads with the new content_type + byte_size cols
//     populated (per Q1 narrowing — no moderation_result column)
//   - mintPutUrl call composition + TTL = PUT_URL_TTL_SECONDS (60s, per Q2)
//
// Mocks:
//   - `@/server/storage/r2` `mintPutUrl` — return scripted URL, assert args.
//     Avoids hitting real R2.
//
// NOT mocked:
//   - `@/db` — real testDb (image_uploads INSERT is a real DB round-trip).
//     Cleaned via TRUNCATE in afterEach.
//
// REFUSAL-2 indirect: image-comment surface is enforced via byte-cap + MIME
// gate (CSAM detector is SCAFFOLD.16 add-on; SCAFFOLD.15 only enforces
// upload acceptability boundary).

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
import { imageUploads, users } from "@/db/schema";
import { ImageMimeRejectedError, ImageOversizeError } from "@/lib/errors";
import {
	IMAGE_UPLOADS_ALLOWED_MIME,
	IMAGE_UPLOADS_EXT_BY_MIME,
	IMAGE_UPLOADS_MAX_BYTES,
	PUT_URL_TTL_SECONDS,
} from "@/server/config/limits";
import { signUploadAndInsert } from "@/server/storage/sign-upload";
import { testClient, testDb } from "../db/_fixtures/db";

beforeEach(() => {
	mockMintPutUrl.mockReset();
});

afterEach(async () => {
	// Wipe rows the impl wrote; users cascades into image_uploads via FK
	// (image_uploads.user_id ON DELETE RESTRICT → CASCADE only via raw
	// TRUNCATE … CASCADE; matches the trigger-test convention).
	await testClient.unsafe(`TRUNCATE image_uploads, users CASCADE`);
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

describe("signUploadAndInsert (SCAFFOLD.15 §5.1)", () => {
	// === MIME whitelist enforcement ============================================

	it("sign-upload::rejects-disallowed-mime", async () => {
		// pdf is not in the IMAGE_UPLOADS_ALLOWED_MIME whitelist; impl must
		// throw ImageMimeRejectedError BEFORE mintPutUrl is called and BEFORE
		// the INSERT fires. Verifies the gate ordering (validation → IO).
		const { userId } = await seedUser("mime-bad");

		await expect(
			signUploadAndInsert({
				db: testDb,
				userId,
				contentType: "application/pdf",
				byteSize: 1024,
			}),
		).rejects.toBeInstanceOf(ImageMimeRejectedError);

		expect(mockMintPutUrl).not.toHaveBeenCalled();
		// No image_uploads row was inserted under this user (gate fires
		// BEFORE the DB write).
		const rows = await testDb
			.select({ id: imageUploads.id })
			.from(imageUploads)
			.where(eq(imageUploads.userId, userId));
		expect(rows).toHaveLength(0);
	});

	it("sign-upload::rejects-image-svg-xml-not-whitelisted", async () => {
		// SVG is image/* but explicitly NOT in the whitelist (per Q5 — SVG
		// pulls in XSS/embed surface that bytemap formats don't). Sanity:
		// any "image/svg+xml" attempt fails the MIME gate.
		const { userId } = await seedUser("svg");
		await expect(
			signUploadAndInsert({
				db: testDb,
				userId,
				contentType: "image/svg+xml",
				byteSize: 2048,
			}),
		).rejects.toBeInstanceOf(ImageMimeRejectedError);
		expect(mockMintPutUrl).not.toHaveBeenCalled();
	});

	// === byte-size cap enforcement =============================================

	it("sign-upload::rejects-byte-size-over-cap", async () => {
		// Cap is 8 MiB = 8388608. One byte over → ImageOversizeError.
		const { userId } = await seedUser("over");
		await expect(
			signUploadAndInsert({
				db: testDb,
				userId,
				contentType: "image/jpeg",
				byteSize: IMAGE_UPLOADS_MAX_BYTES + 1,
			}),
		).rejects.toBeInstanceOf(ImageOversizeError);
		expect(mockMintPutUrl).not.toHaveBeenCalled();
	});

	it("sign-upload::rejects-byte-size-zero", async () => {
		// Bound check: 0 is not strictly positive. Mirrors the SQL CHECK
		// constraint (`byte_size > 0`) that lands in 0006.
		const { userId } = await seedUser("zero");
		await expect(
			signUploadAndInsert({
				db: testDb,
				userId,
				contentType: "image/jpeg",
				byteSize: 0,
			}),
		).rejects.toBeInstanceOf(ImageOversizeError);
		expect(mockMintPutUrl).not.toHaveBeenCalled();
	});

	it("sign-upload::rejects-byte-size-negative", async () => {
		// Negative byteSize is malformed input; impl rejects with the same
		// ImageOversizeError (boundary discriminator on a single error).
		const { userId } = await seedUser("neg");
		await expect(
			signUploadAndInsert({
				db: testDb,
				userId,
				contentType: "image/png",
				byteSize: -1,
			}),
		).rejects.toBeInstanceOf(ImageOversizeError);
		expect(mockMintPutUrl).not.toHaveBeenCalled();
	});

	// === happy-path: row + signed-URL contract =================================

	it("sign-upload::inserts-row-with-content-type-and-byte-size", async () => {
		// Happy path: row INSERTed with content_type + byte_size populated;
		// terminal_state stays NULL (set later by W-2 commit transition in
		// DEBATE.2). Asserts the Q1-ratified schema delta is wired.
		const { userId } = await seedUser("ok-jpg");
		mockMintPutUrl.mockResolvedValueOnce("https://r2.example/u/x/y.jpg?sig");

		const { uploadId } = await signUploadAndInsert({
			db: testDb,
			userId,
			contentType: "image/jpeg",
			byteSize: 102400,
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
		// terminal_state stays NULL until W-2 (commit) or orphan-sweep flips
		// it. Verifies the impl does NOT prematurely terminalize on sign.
		expect(rows[0]?.terminalState).toBeNull();
	});

	it("sign-upload::key-shape-u-userid-uploadid-ext-jpg", async () => {
		// Key shape contract per Q9 + §12.9 amendment #11:
		// `u/${userId}/${uploadId}.${ext}` with lowercase canonical ext.
		const { userId } = await seedUser("key-jpg");
		mockMintPutUrl.mockResolvedValueOnce("https://r2.example/u/x/y.jpg?sig");

		const { uploadId, key } = await signUploadAndInsert({
			db: testDb,
			userId,
			contentType: "image/jpeg",
			byteSize: 50_000,
		});

		expect(key).toBe(`u/${userId}/${uploadId}.jpg`);
		// And the DB row carries the same key (single source of truth for
		// the orphan sweep + admin moderation surface).
		const rows = await testDb
			.select({ r2ObjectKey: imageUploads.r2ObjectKey })
			.from(imageUploads)
			.where(eq(imageUploads.id, uploadId));
		expect(rows[0]?.r2ObjectKey).toBe(key);
	});

	it("sign-upload::ext-mapping-png", async () => {
		// MIME → ext mapping per IMAGE_UPLOADS_EXT_BY_MIME. png → png.
		const { userId } = await seedUser("key-png");
		mockMintPutUrl.mockResolvedValueOnce("https://r2.example/u/x/y.png?sig");
		const { uploadId, key } = await signUploadAndInsert({
			db: testDb,
			userId,
			contentType: "image/png",
			byteSize: 50_000,
		});
		expect(key.endsWith(".png")).toBe(true);
		expect(key).toBe(`u/${userId}/${uploadId}.png`);
		expect(IMAGE_UPLOADS_EXT_BY_MIME["image/png"]).toBe("png");
	});

	it("sign-upload::ext-mapping-webp", async () => {
		const { userId } = await seedUser("key-webp");
		mockMintPutUrl.mockResolvedValueOnce("https://r2.example/u/x/y.webp?sig");
		const { key } = await signUploadAndInsert({
			db: testDb,
			userId,
			contentType: "image/webp",
			byteSize: 50_000,
		});
		expect(key.endsWith(".webp")).toBe(true);
		expect(IMAGE_UPLOADS_EXT_BY_MIME["image/webp"]).toBe("webp");
	});

	it("sign-upload::ext-mapping-gif", async () => {
		const { userId } = await seedUser("key-gif");
		mockMintPutUrl.mockResolvedValueOnce("https://r2.example/u/x/y.gif?sig");
		const { key } = await signUploadAndInsert({
			db: testDb,
			userId,
			contentType: "image/gif",
			byteSize: 50_000,
		});
		expect(key.endsWith(".gif")).toBe(true);
		expect(IMAGE_UPLOADS_EXT_BY_MIME["image/gif"]).toBe("gif");
	});

	it("sign-upload::ext-mapping-avif", async () => {
		const { userId } = await seedUser("key-avif");
		mockMintPutUrl.mockResolvedValueOnce("https://r2.example/u/x/y.avif?sig");
		const { key } = await signUploadAndInsert({
			db: testDb,
			userId,
			contentType: "image/avif",
			byteSize: 50_000,
		});
		expect(key.endsWith(".avif")).toBe(true);
		expect(IMAGE_UPLOADS_EXT_BY_MIME["image/avif"]).toBe("avif");
	});

	it("sign-upload::mintPutUrl-called-with-uploads-bucket-and-ttl-60", async () => {
		// mintPutUrl receives ("uploads", key, contentType, PUT_URL_TTL_SECONDS).
		// Verifies bucket-id literal, key composition, content-type passthrough,
		// AND TTL = 60s per Q2 ratification (constant pulled from limits.ts).
		const { userId } = await seedUser("mint-args");
		mockMintPutUrl.mockResolvedValueOnce(
			"https://r2.example/uploads/u/x/y.jpg?sig",
		);

		const { uploadId, key } = await signUploadAndInsert({
			db: testDb,
			userId,
			contentType: "image/jpeg",
			byteSize: 50_000,
		});

		expect(mockMintPutUrl).toHaveBeenCalledTimes(1);
		expect(mockMintPutUrl).toHaveBeenCalledWith(
			"uploads",
			key,
			"image/jpeg",
			PUT_URL_TTL_SECONDS,
		);
		// Sanity floor: PUT_URL_TTL_SECONDS is the Q2-ratified 60 (HARDEN.6
		// is not expected to retune; if a future PR moves this off 60,
		// this surfaces it).
		expect(PUT_URL_TTL_SECONDS).toBe(60);
		expect(typeof uploadId).toBe("string");
	});

	it("sign-upload::returns-put-url-from-mint", async () => {
		// Returns { uploadId, putUrl, key }; putUrl is the value mintPutUrl
		// returned (the impl is a thin composition, not a re-derive).
		const { userId } = await seedUser("ret-url");
		const scriptedUrl = "https://r2.example/some/path?X-Amz-Signature=abc";
		mockMintPutUrl.mockResolvedValueOnce(scriptedUrl);

		const result = await signUploadAndInsert({
			db: testDb,
			userId,
			contentType: "image/jpeg",
			byteSize: 50_000,
		});

		expect(result.putUrl).toBe(scriptedUrl);
		expect(typeof result.uploadId).toBe("string");
		expect(typeof result.key).toBe("string");
	});

	it("sign-upload::accepts-byte-size-at-cap-boundary", async () => {
		// Inclusive upper bound — byteSize == IMAGE_UPLOADS_MAX_BYTES is OK
		// (the check is `byteSize <= MAX`, not strict). Mirrors the SQL
		// CHECK `<= 8388608`.
		const { userId } = await seedUser("at-cap");
		mockMintPutUrl.mockResolvedValueOnce("https://r2.example/u/cap/y.jpg?sig");
		const { uploadId } = await signUploadAndInsert({
			db: testDb,
			userId,
			contentType: "image/jpeg",
			byteSize: IMAGE_UPLOADS_MAX_BYTES,
		});
		const rows = await testDb
			.select({ byteSize: imageUploads.byteSize })
			.from(imageUploads)
			.where(eq(imageUploads.id, uploadId));
		expect(rows[0]?.byteSize).toBe(IMAGE_UPLOADS_MAX_BYTES);
		// Constants sanity (8 MiB).
		expect(IMAGE_UPLOADS_MAX_BYTES).toBe(8 * 1024 * 1024);
	});

	it("sign-upload::allowed-mime-whitelist-shape", async () => {
		// Sanity floor: the five accepted MIME types per Q5. If a future PR
		// drops one (or adds heif/heic without spec amendment), surface.
		expect(IMAGE_UPLOADS_ALLOWED_MIME).toEqual([
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/gif",
			"image/avif",
		]);
	});
});
