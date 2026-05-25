import "server-only";
import { v7 as uuidv7 } from "uuid";
import type { z } from "zod";

import type { DbTransaction } from "@/db";
import { imageUploads } from "@/db/schema";
import { ImageMimeRejectedError, ImageOversizeError } from "@/lib/errors";
import {
	IMAGE_UPLOADS_ALLOWED_MIME,
	IMAGE_UPLOADS_EXT_BY_MIME,
	IMAGE_UPLOADS_MAX_BYTES,
} from "@/server/config/limits";
import { insertEvent } from "@/server/events/insert";
import type { eventMetadataSchema } from "@/server/events/schemas";

// ENGINE.6 §D.1 SURPRISE-A absorption (CLAUDE.md §3 no-HTTP-in-tx):
//   - `tx` is now REQUIRED (was `DbClient | DbTransaction`). The caller
//     MUST open `db.transaction(...)` wrapping the call.
//   - `mintPutUrl` REMOVED from the helper. The route handler orchestrates
//     `mintPutUrl` AFTER the tx commits — keeps R2 HTTP outside the DB
//     transaction per ADR-0014.
//   - `eventId` + `metadata` are caller-supplied at handler entry per
//     ADR-0016 D1; the helper threads them into the synchronous
//     `image_upload.sign_requested` emission inside the tx.
//   - Return shape: `{ uploadId, key }` (drops `putUrl` — the route mints
//     the URL post-commit and returns it to the client).
//
// READ COMMITTED still suffices — single-row Bucket-B INSERT, no
// cross-row contention to manage (SERIALIZABLE reserved for W-1/W-2/W-3
// per SPEC.2 §3.2). Idempotency-Key remains EXEMPT per SCAFFOLD.15 Q2 +
// SPEC.2 §11 amendment (double-mint risk accepted; orphan-sweep cleans
// within ≤2h).

type AllowedMime = (typeof IMAGE_UPLOADS_ALLOWED_MIME)[number];

function isAllowedMime(mime: string): mime is AllowedMime {
	return (IMAGE_UPLOADS_ALLOWED_MIME as readonly string[]).includes(mime);
}

interface SignUploadArgs {
	userId: string;
	contentType: string;
	byteSize: number;
	eventId: string;
	metadata: z.infer<typeof eventMetadataSchema>;
}

interface SignUploadResult {
	uploadId: string;
	key: string;
}

export async function signUploadAndInsert(
	tx: DbTransaction,
	args: SignUploadArgs,
): Promise<SignUploadResult> {
	const { userId, contentType, byteSize, eventId, metadata } = args;

	if (!isAllowedMime(contentType)) {
		throw new ImageMimeRejectedError(contentType, IMAGE_UPLOADS_ALLOWED_MIME);
	}
	if (
		!Number.isInteger(byteSize) ||
		byteSize <= 0 ||
		byteSize > IMAGE_UPLOADS_MAX_BYTES
	) {
		throw new ImageOversizeError(byteSize, IMAGE_UPLOADS_MAX_BYTES);
	}

	const uploadId = uuidv7();
	const ext = IMAGE_UPLOADS_EXT_BY_MIME[contentType];
	const key = `u/${userId}/${uploadId}.${ext}`;

	await tx.insert(imageUploads).values({
		id: uploadId,
		userId,
		r2ObjectKey: key,
		contentType,
		byteSize,
	});

	await insertEvent(tx, {
		eventId,
		eventType: "image_upload.sign_requested",
		aggregateType: "image_upload",
		aggregateId: uploadId,
		payload: { uploadId, userId, contentType, byteSize, key },
		metadata,
	});

	return { uploadId, key };
}
