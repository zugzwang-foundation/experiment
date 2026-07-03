import { PutObjectCommand } from "@aws-sdk/client-s3";
import { beforeAll, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-A1 §7.B (#1) — mintPutUrl WRITE-ONCE ARMED. When called with
// `{ ifNoneMatch: true }` (the participant sign path, plan §3.1/§3.3), mintPutUrl
// must bake `IfNoneMatch: "*"` into the PutObjectCommand → R2 makes the object
// physically write-once (the first PUT creates it; every later PUT → 412). The
// no-opts call — the ADMIN media path (ADR-0026/0027, trusted/unmoderated) — must
// NOT arm it; that path stays byte-for-byte the current behavior.
//
// RED: the current mintPutUrl signature is (bucket, key, contentType, ttlSeconds)
// — it neither accepts opts nor sets IfNoneMatch, so the ARMED assertion
// (IfNoneMatch === "*") fails (the extra arg is ignored at runtime). The UNARMED
// assertion in the same test is the admin-path-untouched guard.
//
// `getSignedUrl` (@aws-sdk/s3-request-presigner) is mocked to CAPTURE its command
// arg — NO network. `@aws-sdk/client-s3` (PutObjectCommand + S3Client) stays REAL,
// so the captured command's `.input.IfNoneMatch` is the real bound value.

const { mockGetSignedUrl, captured } = vi.hoisted(() => {
	const captured: { commands: unknown[] } = { commands: [] };
	return {
		captured,
		mockGetSignedUrl: vi.fn(async (_client: unknown, command: unknown) => {
			captured.commands.push(command);
			return "https://stub.r2.cloudflarestorage.com/put?X-Amz-Signature=stub";
		}),
	};
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: mockGetSignedUrl,
}));

import { mintPutUrl } from "@/server/storage/r2";

// getClient() reads the R2_*_UPLOADS credential triplet at call-time; tests/_setup/
// env.ts seeds only R2_BUCKET_UPLOADS. Seed the rest so the REAL S3Client
// constructs (offline — no network at construction or at the mocked signing).
beforeAll(() => {
	process.env.R2_ENDPOINT_UPLOADS = "https://example.r2.cloudflarestorage.com";
	process.env.R2_ACCESS_KEY_ID_UPLOADS = "AKIAEXAMPLEUPLOADS00";
	process.env.R2_SECRET_ACCESS_KEY_UPLOADS = "0".repeat(64);
});

const KEY = "u/0190b3a0-1111-7000-8000-000000000001/write-once.png";

describe("mintPutUrl — write-once armed only under { ifNoneMatch: true }", () => {
	it("mint-put-url::if-none-match-armed-with-opts-unarmed-without", async () => {
		// ARMED (participant path): opts.ifNoneMatch === true ⇒ IfNoneMatch: "*".
		await mintPutUrl("uploads", KEY, "image/png", 60, { ifNoneMatch: true });
		const armed = captured.commands.at(-1) as PutObjectCommand;
		expect(armed).toBeInstanceOf(PutObjectCommand);
		expect(armed.input.IfNoneMatch).toBe("*");

		// UNARMED (admin / no-opts path): NO IfNoneMatch — the object stays mutable
		// (the admin media sign path is untouched by AUDIT-FIX-A1).
		await mintPutUrl("uploads", KEY, "image/png", 60);
		const unarmed = captured.commands.at(-1) as PutObjectCommand;
		expect(unarmed.input.IfNoneMatch).toBeUndefined();
	});
});
