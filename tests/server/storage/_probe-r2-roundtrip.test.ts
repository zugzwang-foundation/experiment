import { describe, expect, it } from "vitest";

import { deleteObject, headObject, mintPutUrl } from "@/server/storage/r2";

// Live R2 roundtrip probe per SCAFFOLD.15 plan §8.2 + kickoff Step 8
// safety note. DEFAULT OFF — runs only when `R2_PROBE_LIVE === 'true'`
// (NOT on R2_ENDPOINT_UPLOADS presence; that env var is always set in
// Doppler-synced environments and gating on it would auto-fire the probe
// against prd on every `vitest run`).
//
// Probe key prefix is `probe/` (NOT `u/`) so the operator's R2 lifecycle
// rule (`Object age ≥ 90 days, prefix u/` → DeleteObject per SURPRISE-7)
// does not interact with probe artifacts. Teardown deletes after
// assertion regardless of test outcome.
//
// If the probe fails with `SignatureDoesNotMatch`, per SCAFFOLD.15
// SURPRISE-9 the first root-cause check is the stored R2 secret length
// (must be exactly 64 hex chars). Surface to operator — don't paper over.

const LIVE = process.env.R2_PROBE_LIVE === "true";

describe.skipIf(!LIVE)("R2 live roundtrip probe (SCAFFOLD.15; gated)", () => {
	it("r2-live::sign-put-and-headObject-roundtrip", async () => {
		// 1) Mint a signed-PUT URL against zugzwang-uploads
		// 2) Issue the PUT to the signed URL (small body)
		// 3) HeadObject confirms the upload landed
		// 4) DeleteObject cleans up (idempotent — 204 even if missing)
		const key = `probe/scaffold15-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
		const contentType = "image/jpeg";
		// Minimal valid JPEG body — 4-byte SOI + EOI markers + content.
		// R2 doesn't validate content shape; this is just a non-empty body.
		const body = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

		const putUrl = await mintPutUrl("uploads", key, contentType, 60);
		expect(putUrl).toMatch(/^https:\/\//);
		expect(putUrl).toContain("X-Amz-Signature=");

		try {
			const putResponse = await fetch(putUrl, {
				method: "PUT",
				headers: { "content-type": contentType },
				body,
			});
			expect(putResponse.status).toBe(200);

			const head = await headObject("uploads", key);
			expect(head.contentLength).toBe(body.byteLength);
			expect(head.contentType).toBe(contentType);
		} finally {
			// Teardown — deleteObject is idempotent on R2 (204 even if absent).
			await deleteObject("uploads", key);
		}
	}, 30_000);
});
