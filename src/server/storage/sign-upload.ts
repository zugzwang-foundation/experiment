import "server-only";
import { v7 as uuidv7 } from "uuid";

import type { DbClient, DbTransaction } from "@/db";
import { imageUploads } from "@/db/schema";
import { ImageMimeRejectedError, ImageOversizeError } from "@/lib/errors";
import {
	IMAGE_UPLOADS_ALLOWED_MIME,
	IMAGE_UPLOADS_EXT_BY_MIME,
	IMAGE_UPLOADS_MAX_BYTES,
	PUT_URL_TTL_SECONDS,
} from "@/server/config/limits";
import { mintPutUrl } from "@/server/storage/r2";

// READ COMMITTED (the Drizzle default; SERIALIZABLE reserved for W-1/W-2/W-3
// per SPEC.2 §3.2) — sign-upload is a single-row INSERT into a Bucket-B
// table, no cross-row contention to manage. The R2 PUT URL mint happens
// AFTER the INSERT returns so the uploadId in the key is the same id the
// row carries (single source of truth for the orphan-sweep + admin
// moderation surfaces).
//
// Idempotency-Key is EXEMPT on this endpoint per SCAFFOLD.15 Q2 ratification
// + SPEC.2 §11 amendment (double-mint risk accepted; orphan-sweep cleans
// within ≤2h per ORPHAN_WINDOW_MINUTES + cron cadence).

type AllowedMime = (typeof IMAGE_UPLOADS_ALLOWED_MIME)[number];

function isAllowedMime(mime: string): mime is AllowedMime {
	return (IMAGE_UPLOADS_ALLOWED_MIME as readonly string[]).includes(mime);
}

interface SignUploadArgs {
	db: DbClient | DbTransaction;
	userId: string;
	contentType: string;
	byteSize: number;
}

interface SignUploadResult {
	uploadId: string;
	putUrl: string;
	key: string;
}

export async function signUploadAndInsert(
	args: SignUploadArgs,
): Promise<SignUploadResult> {
	const { db, userId, contentType, byteSize } = args;

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

	await db.insert(imageUploads).values({
		id: uploadId,
		userId,
		r2ObjectKey: key,
		contentType,
		byteSize,
	});

	const putUrl = await mintPutUrl(
		"uploads",
		key,
		contentType,
		PUT_URL_TTL_SECONDS,
	);

	// TODO(ENGINE.6): insertEvent(tx, {
	//   eventType: "image_upload.sign_requested",
	//   payload: { uploadId, userId, contentType, byteSize, key },
	//   metadata: { actorId: userId, ... }
	// })

	return { uploadId, putUrl, key };
}
