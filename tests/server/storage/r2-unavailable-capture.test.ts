import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B1 A5 (rulings #1, #3) tests-first — the four R2 vendor-failure arms in
// `src/server/storage/r2.ts` each capture kind `r2_unavailable` ONCE (with the
// ORIGINAL vendor error, before wrapping) then throw StorageUnavailableError
// unchanged; the headObject 404 arm throws StorageObjectMissingError with ZERO
// captures (a client-error product condition, NOT vendor-down). Capture-at-source
// covers the sign routes, precommit's signRead, verify-object, and the orphan
// sweep with no second string.
//
// RED reason (extension of an EXISTING module): r2.ts imports fine → ASSERTION-RED.
// Pre-impl no capture fires, so the four capture assertions fail (0 calls) while
// the StorageUnavailableError throw itself is already correct (green sub-assertion
// — the zero-behaviour-change proof). The 404 case is a GREEN regression guard.
//
// The AWS SDK is mocked at the client (`send`) + presigner (`getSignedUrl`) seams
// — no network. `@sentry/nextjs` is the mocked vendor boundary (post-impl
// safeCaptureException routes its captureException call here).

const { mockSend, mockGetSignedUrl } = vi.hoisted(() => ({
	mockSend: vi.fn(),
	mockGetSignedUrl: vi.fn(),
}));
vi.mock("@aws-sdk/client-s3", () => {
	class S3Client {
		send = mockSend;
	}
	class PutObjectCommand {
		input: unknown;
		constructor(input: unknown) {
			this.input = input;
		}
	}
	class GetObjectCommand {
		input: unknown;
		constructor(input: unknown) {
			this.input = input;
		}
	}
	class HeadObjectCommand {
		input: unknown;
		constructor(input: unknown) {
			this.input = input;
		}
	}
	class DeleteObjectCommand {
		input: unknown;
		constructor(input: unknown) {
			this.input = input;
		}
	}
	return {
		S3Client,
		PutObjectCommand,
		GetObjectCommand,
		HeadObjectCommand,
		DeleteObjectCommand,
	};
});
vi.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: mockGetSignedUrl,
}));

const { mockCaptureException } = vi.hoisted(() => ({
	mockCaptureException: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({
	captureException: mockCaptureException,
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
}));

import {
	StorageObjectMissingError,
	StorageUnavailableError,
} from "@/lib/errors";
import {
	deleteObject,
	headObject,
	mintPutUrl,
	mintReadUrl,
} from "@/server/storage/r2";

const KEY = "u/0190b3a0-1111-7000-8000-000000000001/obj.png";

beforeAll(() => {
	// resolveBucketEnv("uploads") reads these at first getClient() call; the mocked
	// S3Client never uses them (R2_BUCKET_UPLOADS is seeded by tests/_setup/env.ts).
	process.env.R2_ENDPOINT_UPLOADS = "https://example.r2.cloudflarestorage.com";
	process.env.R2_ACCESS_KEY_ID_UPLOADS = "AKIAEXAMPLEUPLOADS00";
	process.env.R2_SECRET_ACCESS_KEY_UPLOADS = "0".repeat(64);
});

describe("AUDIT-FIX-B1 A5 — r2_unavailable capture-at-source", () => {
	beforeEach(() => {
		mockSend.mockReset();
		mockGetSignedUrl.mockReset();
		mockCaptureException.mockReset();
	});

	it("r2-capture::mint-put-url-vendor-failure-captures-then-throws", async () => {
		const vendorErr = new Error("presigner boom (put)");
		mockGetSignedUrl.mockRejectedValueOnce(vendorErr);
		await expect(
			mintPutUrl("uploads", KEY, "image/png", 60),
		).rejects.toBeInstanceOf(StorageUnavailableError);
		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		expect(mockCaptureException).toHaveBeenCalledWith(vendorErr, {
			tags: { kind: "r2_unavailable" },
		});
	});

	it("r2-capture::mint-read-url-vendor-failure-captures-then-throws", async () => {
		const vendorErr = new Error("presigner boom (read)");
		mockGetSignedUrl.mockRejectedValueOnce(vendorErr);
		await expect(mintReadUrl("uploads", KEY, 60)).rejects.toBeInstanceOf(
			StorageUnavailableError,
		);
		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		expect(mockCaptureException).toHaveBeenCalledWith(vendorErr, {
			tags: { kind: "r2_unavailable" },
		});
	});

	it("r2-capture::head-object-5xx-captures-then-throws", async () => {
		// A non-404 name → the 5xx arm (StorageUnavailableError), NOT the 404 arm.
		const vendorErr = Object.assign(new Error("R2 500"), {
			name: "InternalError",
		});
		mockSend.mockRejectedValueOnce(vendorErr);
		await expect(headObject("uploads", KEY)).rejects.toBeInstanceOf(
			StorageUnavailableError,
		);
		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		expect(mockCaptureException).toHaveBeenCalledWith(vendorErr, {
			tags: { kind: "r2_unavailable" },
		});
	});

	it("r2-capture::delete-object-vendor-failure-captures-then-throws", async () => {
		const vendorErr = new Error("delete boom");
		mockSend.mockRejectedValueOnce(vendorErr);
		await expect(deleteObject("uploads", KEY)).rejects.toBeInstanceOf(
			StorageUnavailableError,
		);
		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		expect(mockCaptureException).toHaveBeenCalledWith(vendorErr, {
			tags: { kind: "r2_unavailable" },
		});
	});

	// 404 → StorageObjectMissingError, a client-error product condition (NOT vendor
	// down) → ZERO captures. Green regression guard both pre- and post-impl.
	it("r2-capture::head-object-404-missing-no-capture", async () => {
		const notFound = Object.assign(new Error("no such key"), {
			name: "NoSuchKey",
		});
		mockSend.mockRejectedValueOnce(notFound);
		await expect(headObject("uploads", KEY)).rejects.toBeInstanceOf(
			StorageObjectMissingError,
		);
		expect(mockCaptureException).not.toHaveBeenCalled();
	});
});
