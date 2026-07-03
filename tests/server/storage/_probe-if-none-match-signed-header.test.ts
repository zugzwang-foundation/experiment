import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { describe, expect, it } from "vitest";

// AUDIT-FIX-A1 §7.C (#2) — "presigner signs it" VENDOR-CONTRACT PROBE. Mirrors
// tests/server/storage/_probe-aws-sdk-presigned-put.test.ts. Per AGENTS.md §9 /
// CLAUDE.md §5.6, a `_probe-*` file is a REGRESSION GUARD that asserts a
// third-party invariant — distinct from a TDD driver, and GREEN by nature (it
// pins an SDK fact that already holds, and MUST keep holding).
//
// The load-bearing SDK fact this whole plan rests on (plan §"Approach"): when
// `IfNoneMatch` is set on a PutObjectCommand, the @aws-sdk/s3-request-presigner
// bakes `if-none-match` into the SigV4 `X-Amz-SignedHeaders`. ⇒ a client CANNOT
// drop the header on the PUT without invalidating the signature (403 at R2). That
// is precisely what makes write-once UNBYPASSABLE. If this probe ever RED-s, the
// "cannot drop the header" security claim is false and the mechanism needs
// rework — surface it, do not paper over. Signing is offline (no network).

describe("@aws-sdk/s3-request-presigner — IfNoneMatch joins X-Amz-SignedHeaders (write-once unbypassability guard)", () => {
	it("presigner-signs-if-none-match::signed-headers-include-if-none-match", async () => {
		const client = new S3Client({
			region: "auto",
			endpoint: "https://example.r2.cloudflarestorage.com",
			credentials: {
				accessKeyId: "AKIAEXAMPLE",
				secretAccessKey:
					"0000000000000000000000000000000000000000000000000000000000000000",
			},
			forcePathStyle: false,
		});

		const command = new PutObjectCommand({
			Bucket: "zugzwang-uploads",
			Key: "u/test-user/test-upload.png",
			ContentType: "image/png",
			IfNoneMatch: "*",
		});

		const url = await getSignedUrl(client, command, { expiresIn: 60 });

		// The URL is a real signed URL...
		expect(url).toMatch(/^https:\/\//);
		expect(url).toContain("X-Amz-Signature=");

		// ...and `if-none-match` is inside the SIGNED header set — so it cannot be
		// stripped by a client without breaking the signature.
		const signedHeaders =
			new URL(url).searchParams.get("X-Amz-SignedHeaders") ?? "";
		expect(signedHeaders.toLowerCase()).toContain("if-none-match");
	});
});
