import "server-only";

import { ImageOversizeError } from "@/lib/errors";
import { IMAGE_UPLOADS_MAX_BYTES } from "@/server/config/limits";
import { headObject } from "@/server/storage/r2";

// AUDIT-FIX-A1 (+A10) — the pre-moderation HeadObject backstop for the
// participant image-attach path (SPEC.2 §12.3). Runs OUTSIDE the bet
// transaction, BEFORE moderation (CLAUDE.md §3 no-HTTP-in-tx). Two jobs, one
// round trip:
//
//   1. (A10) enforce the REAL landed size — the sign-time `byteSize` is
//      client-declared + unverified, so we check the bytes that actually
//      reached R2. Outside `(0, IMAGE_UPLOADS_MAX_BYTES]` ⇒ ImageOversizeError.
//      The lower bound mirrors the existing ImageOversizeError contract in
//      `sign-upload.ts` ("byteSize outside (0, MAX]") and guarantees the
//      `image_upload.committed` `byteSizeActual` field is a positive int (no
//      500-in-tx from a 0-byte object hitting the event schema).
//   2. capture { etag, byteSize } for the append-only `image_upload.committed`
//      audit record — the ETag is a FORENSIC FINGERPRINT (R2 ETag = collision-
//      weak MD5), never a security control. The security guarantee is the
//      physical write-once (`If-None-Match: "*"` at sign time), not any ETag
//      comparison.
//
// FAIL-CLOSED: `StorageObjectMissingError` (R2 404 — the moderator was told to
// read an object that isn't there) and `StorageUnavailableError` (R2 5xx /
// connection) are NOT caught — they PROPAGATE so the caller blocks and the bet
// transaction never opens. The route maps them to 400 / 503 via `toWireError`
// (missing→400 per the ADR-0028 §9 ruling; unavailable→503).

export interface VerifiedUpload {
	etag: string | undefined;
	byteSize: number;
}

export async function verifyUploadedObject(
	key: string,
): Promise<VerifiedUpload> {
	const { contentLength, etag } = await headObject("uploads", key);

	if (
		!Number.isInteger(contentLength) ||
		contentLength <= 0 ||
		contentLength > IMAGE_UPLOADS_MAX_BYTES
	) {
		// A10 — the REAL object is oversize (or a 0-byte / non-integer anomaly).
		// Same class the sign-time size check uses; maps to 400 error_image_oversize.
		throw new ImageOversizeError(contentLength, IMAGE_UPLOADS_MAX_BYTES);
	}

	return { etag, byteSize: contentLength };
}
