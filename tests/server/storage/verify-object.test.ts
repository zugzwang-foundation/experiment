import { beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-A1 (+A10) §7.A — `verifyUploadedObject` UNIT. The NEW pre-moderation
// HeadObject backstop lives at src/server/storage/verify-object.ts, which is NOT
// YET ON DISK — so this file is RED at collection (`Cannot find module
// @/server/storage/verify-object`) until the implementer creates the module.
//
// Contract under test (plan §3.2):
//   verifyUploadedObject(key): Promise<{ etag: string | undefined; byteSize: number }>
//     - calls headObject("uploads", key)
//     - throws ImageOversizeError if the REAL contentLength ∉ (0,
//       IMAGE_UPLOADS_MAX_BYTES]  (A10 — the sign-time byteSize is client-declared
//       + unverified; this checks the bytes that actually landed)
//     - lets StorageObjectMissingError (404) + StorageUnavailableError (5xx)
//       PROPAGATE — fail-closed (a missing object ⇒ moderation would read nothing
//       real)
//     - happy: in-range ⇒ returns { etag, byteSize } from the head response
//
// `@/server/storage/r2` is mocked so `headObject` is a configurable stub — NO
// network. IMAGE_UPLOADS_MAX_BYTES + the ImageOversizeError / Storage* classes
// are the module-under-test's REAL collaborators (unmocked).

const { mockHeadObject } = vi.hoisted(() => ({ mockHeadObject: vi.fn() }));

vi.mock("@/server/storage/r2", () => ({
	headObject: mockHeadObject,
	mintPutUrl: vi.fn(),
	mintReadUrl: vi.fn(),
	deleteObject: vi.fn(),
}));

import {
	ImageOversizeError,
	StorageObjectMissingError,
	StorageUnavailableError,
} from "@/lib/errors";
import { IMAGE_UPLOADS_MAX_BYTES } from "@/server/config/limits";
import { verifyUploadedObject } from "@/server/storage/verify-object";

const KEY =
	"u/0190b3a0-1111-7000-8000-000000000001/0190b3a0-2222-7000-8000-000000000002.png";

describe("verifyUploadedObject — pre-moderation HeadObject backstop (A10 + fail-closed)", () => {
	beforeEach(() => {
		mockHeadObject.mockReset();
	});

	it("verify-object::oversize-real-bytes-fail-closed", async () => {
		// A10: the REAL landed object exceeds the byte cap. HeadObject reports the
		// true size → reject (the sign-time byteSize was unverified).
		mockHeadObject.mockResolvedValue({
			contentLength: IMAGE_UPLOADS_MAX_BYTES + 1,
			contentType: "image/png",
			etag: '"deadbeef"',
		});
		await expect(verifyUploadedObject(KEY)).rejects.toBeInstanceOf(
			ImageOversizeError,
		);
	});

	it("verify-object::zero-byte-real-bytes-fail-closed", async () => {
		// Lower bound of (0, MAX]: a 0-byte object is rejected. Guarantees the
		// image_upload.committed `byteSizeActual` field satisfies .positive() — no
		// 500-in-tx from a zero-size object reaching the event schema.
		mockHeadObject.mockResolvedValue({
			contentLength: 0,
			contentType: "image/png",
			etag: '"e3b0c44298fc1c149afbf4c8996fb924"',
		});
		await expect(verifyUploadedObject(KEY)).rejects.toBeInstanceOf(
			ImageOversizeError,
		);
	});

	it("verify-object::missing-object-propagates-fail-closed", async () => {
		// HeadObject 404 → StorageObjectMissingError must PROPAGATE (not be
		// swallowed): the object the moderator was told to read isn't there.
		mockHeadObject.mockRejectedValue(new StorageObjectMissingError(KEY));
		await expect(verifyUploadedObject(KEY)).rejects.toBeInstanceOf(
			StorageObjectMissingError,
		);
	});

	it("verify-object::storage-unavailable-propagates-fail-closed", async () => {
		// HeadObject 5xx / connection failure → StorageUnavailableError must
		// PROPAGATE — fail-closed (the tx never opens; a retry re-attempts cleanly).
		mockHeadObject.mockRejectedValue(
			new StorageUnavailableError(new Error("R2 500")),
		);
		await expect(verifyUploadedObject(KEY)).rejects.toBeInstanceOf(
			StorageUnavailableError,
		);
	});

	it("verify-object::in-range-returns-etag-and-bytesize", async () => {
		// Happy path: an in-range object returns { etag, byteSize } straight off the
		// head response — the forensic fingerprint + the REAL size for the audit
		// record. Bucket arg is "uploads" (never pfp / market-media).
		mockHeadObject.mockResolvedValue({
			contentLength: 1234,
			contentType: "image/png",
			etag: '"deadbeefdeadbeefdeadbeefdeadbeef"',
		});
		const result = await verifyUploadedObject(KEY);
		expect(result).toEqual({
			etag: '"deadbeefdeadbeefdeadbeefdeadbeef"',
			byteSize: 1234,
		});
		expect(mockHeadObject).toHaveBeenCalledWith("uploads", KEY);
	});
});
