import "server-only";

import { eq } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { imageUploads } from "@/db/schema";
import { InvalidRequestBodyError } from "@/server/bets/errors";

// DEBATE.2 — image-attach RESOLVE + OWNERSHIP (plan §3 step 3). Resolves the
// `image_uploads.r2_object_key` for an `imageUploadsId` and asserts the uploader
// is the bettor (no cross-user image disclosure). Reads only; NO write — the
// route routes the resolved `r2ObjectKey` into the (already image-capable)
// precommitModerate seam, and place() links the upload in-tx.
//
// Ownership/missing error class (NOT pinned by tests; the plan mints NO new wire
// code for it — DEBATE.2's only new codes are comment_requires_bet /
// reply_depth_exceeded / parent_comment_not_found): a UNIFORM
// `InvalidRequestBodyError` (400 `error_invalid_request_body`) for BOTH the
// absent and the cross-user case. Uniform on purpose — it denies an existence
// oracle (a cross-user caller cannot distinguish "exists but not yours" from
// "does not exist") and a bad `imageUploadsId` reference is a malformed request.
// The `u/${userId}/` namespace gate in precommitModerate is the defense-in-depth
// backstop.

type Reader = DbClient | DbTransaction;

export interface ResolvedImageAttachment {
	uploadId: string;
	r2ObjectKey: string;
}

export async function resolveImageAttachment(
	client: Reader,
	args: { userId: string; imageUploadsId: string },
): Promise<ResolvedImageAttachment> {
	const [upload] = await client
		.select({
			id: imageUploads.id,
			userId: imageUploads.userId,
			r2ObjectKey: imageUploads.r2ObjectKey,
		})
		.from(imageUploads)
		.where(eq(imageUploads.id, args.imageUploadsId));

	// Absent OR not owned by the bettor → uniform 400 (no existence oracle).
	if (upload === undefined || upload.userId !== args.userId) {
		throw new InvalidRequestBodyError("invalid image attachment");
	}

	return { uploadId: upload.id, r2ObjectKey: upload.r2ObjectKey };
}
