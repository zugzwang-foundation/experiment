import { PutObjectCommand } from "@aws-sdk/client-s3";
import { beforeAll, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-A1 §7.G (#8) — SWAP E2E, **SDK-LEVEL MOCK** (necessary-but-
// INSUFFICIENT). The REAL 412 against REAL R2 is the HARD DEPLOY GATE (plan §10
// staging-412 rehearsal); this test only proves the swap SEMANTICS given an armed
// header, with the S3 `send` MOCKED — it does NOT prove R2 actually honors
// If-None-Match. It is tied to the impl: the PutObjectCommand's IfNoneMatch is
// sourced from the REAL mintPutUrl(..., { ifNoneMatch: true }) arming (captured via
// a getSignedUrl mock), so it is RED until mintPutUrl arms write-once.
//
// Write-once model (the MOCK): a PutObjectCommand with IfNoneMatch:"*" against an
// already-existing key → 412 PreconditionFailed; the first PUT creates the object.
// RED: pre-impl the captured command has NO IfNoneMatch, so the mocked send never
// 412s → the second (swap) PUT wrongly resolves → the rejects-412 assertion fails.

const { mockGetSignedUrl, captured } = vi.hoisted(() => {
	const captured: { commands: unknown[] } = { commands: [] };
	return {
		captured,
		mockGetSignedUrl: vi.fn(async (_client: unknown, command: unknown) => {
			captured.commands.push(command);
			return "https://stub.r2/put?X-Amz-Signature=stub";
		}),
	};
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: mockGetSignedUrl,
}));

import { mintPutUrl } from "@/server/storage/r2";

beforeAll(() => {
	process.env.R2_ENDPOINT_UPLOADS = "https://example.r2.cloudflarestorage.com";
	process.env.R2_ACCESS_KEY_ID_UPLOADS = "AKIAEXAMPLEUPLOADS00";
	process.env.R2_SECRET_ACCESS_KEY_UPLOADS = "0".repeat(64);
});

// A MOCK of R2's write-once precondition at the S3 `send` layer (NOT real R2). It
// 412s an IfNoneMatch:"*" PUT to a key that already exists; the real 412 is the
// deploy gate (plan §10), of which this SDK mock is necessary-but-insufficient.
function makeWriteOnceSend() {
	const existing = new Set<string>();
	return vi.fn(async (command: PutObjectCommand) => {
		const key = command.input.Key ?? "";
		const precondition = command.input.IfNoneMatch;
		if (precondition === "*" && existing.has(key)) {
			throw Object.assign(
				new Error(
					"At least one of the pre-conditions you specified did not hold",
				),
				{ name: "PreconditionFailed", $metadata: { httpStatusCode: 412 } },
			);
		}
		existing.add(key);
		return { $metadata: { httpStatusCode: 200 }, ETag: '"first-write"' };
	});
}

const KEY = "u/0190b3a0-1111-7000-8000-000000000001/swap.png";

describe("write-once SWAP — armed PUT blocks the second write (SDK MOCK; real 412 = deploy gate)", () => {
	it("write-once-swap-sdk-mock::second-put-412-precondition-failed", async () => {
		// Source the armed command straight from the REAL participant mint path —
		// this is what ties the test to the impl (RED until mintPutUrl arms it).
		await mintPutUrl("uploads", KEY, "image/png", 60, { ifNoneMatch: true });
		const armedInput = (captured.commands.at(-1) as PutObjectCommand).input;

		const send = makeWriteOnceSend();

		// First PUT — creates the object (benign bytes) → 200.
		const first = await send(new PutObjectCommand({ ...armedInput }));
		expect(first.$metadata.httpStatusCode).toBe(200);

		// Second PUT to the SAME key with the SAME armed precondition — the swap.
		// With write-once armed (IfNoneMatch:"*") this MUST 412. Pre-impl the
		// captured command has no IfNoneMatch, so the swap wrongly succeeds → RED.
		await expect(
			send(new PutObjectCommand({ ...armedInput })),
		).rejects.toMatchObject({ $metadata: { httpStatusCode: 412 } });
	});
});
