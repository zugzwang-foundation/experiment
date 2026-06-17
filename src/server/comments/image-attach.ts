import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { imageUploads } from "@/db/schema";
import { InvalidRequestBodyError } from "@/server/bets/errors";

// DEBATE.2 — image-attach RESOLVE + OWNERSHIP + UN-ATTACHED (plan §3 step 3 +
// the MEDIUM image-attach ruling). Resolves the `image_uploads.r2_object_key`
// for an `imageUploadsId` and asserts the uploader is the bettor (no cross-user
// image disclosure) AND the upload is still un-attached (`terminal_state IS
// NULL`). Reads only; NO write — the route routes the resolved `r2ObjectKey`
// into the (already image-capable) precommitModerate seam, and place() links
// the upload in-tx.
//
// The `terminal_state IS NULL` predicate closes the SEQUENTIAL half of the
// reuse/dangling hole: an upload already `committed` (attached to a prior
// comment), `blocked`, or `orphan` (swept — its R2 object deleted) is filtered
// out here so re-attaching it can neither double-link a live image nor point a
// new comment at a deleted object. The CONCURRENT half (a racing commit / the
// orphan sweep terminalizing in the TOCTOU window between this pre-tx read and
// place()'s in-tx CAS) is closed by place()'s claimed-exactly-one-row assertion.
//
// Error class (NOT pinned by a new wire code — DEBATE.2's only new codes are
// comment_requires_bet / reply_depth_exceeded / parent_comment_not_found): a
// UNIFORM `InvalidRequestBodyError` (400 `error_invalid_request_body`) for the
// absent, the already-terminalized, AND the cross-user case. Uniform on purpose
// — it denies an existence/reuse oracle (a caller cannot distinguish "exists but
// not yours" / "already used" from "does not exist") and a bad `imageUploadsId`
// reference is a malformed request. The `u/${userId}/` namespace gate in
// precommitModerate is the defense-in-depth backstop.

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
		.where(
			and(
				eq(imageUploads.id, args.imageUploadsId),
				// Un-attached only: an already-terminal upload (committed by a prior
				// comment, or blocked / orphan-swept) is filtered out so it collapses
				// into the same uniform reject below — no reuse, no dangling ref.
				isNull(imageUploads.terminalState),
			),
		);

	// Absent OR already-terminalized OR not owned by the bettor → uniform 400 (no
	// existence/reuse oracle — the caller cannot distinguish the cases).
	if (upload === undefined || upload.userId !== args.userId) {
		throw new InvalidRequestBodyError("invalid image attachment");
	}

	return { uploadId: upload.id, r2ObjectKey: upload.r2ObjectKey };
}
