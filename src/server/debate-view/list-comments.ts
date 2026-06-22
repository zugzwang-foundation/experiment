import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { comments, positions } from "@/db/schema";
import { computeMarker, type Marker } from "@/server/positions/compute";
import { PositionSingleSideError } from "@/server/positions/errors";

/** A bound read client — top-level `db` OR a caller's transaction. */
type DebateViewReader = DbClient | DbTransaction;

/**
 * One comment in the debate-view read-model (DEBATE.5 / SPEC.2 §5.4). The
 * `marker` is the LIVE overlay (recomputed per read); `sideAtPostTime` is the
 * SEPARATE frozen badge (INV-3) that never moves. The author's raw held side /
 * quantity are NOT members — they are consumed by `computeMarker` and dropped,
 * so a leak is a compile error (the exposure boundary). `betId` /
 * `stakeAtPostTime` are vestigial (ADR-0009-dead; dropped DEBATE.8/9) and
 * deliberately omitted.
 */
export type DebateComment = {
	id: string;
	parentCommentId: string | null; // depth-1 thread linkage (DEBATE.4 threads on this)
	userId: string; // author — public; identity resolved downstream
	body: string;
	sideAtPostTime: "YES" | "NO"; // FROZEN badge (INV-3) — distinct from `marker`
	imageUploadsId: string | null; // F-COMMENT-3 attachment (the comment's own image)
	createdAt: Date; // timestamptz; HTTP serialization is DEBATE.4's layer
	marker: Marker; // "Flipped" | "Exited" | "none" — recomputed per read
};

/**
 * List a market's comments as the debate-view read-model (F-DEBATE-2 /
 * F-DEBATE-3): a flat, OLDEST-FIRST list, each comment carrying a live marker
 * = `computeMarker(comment.side_at_post_time, <that author's current held
 * side>)`. Writes nothing; reads only. The marker is **viewer-independent** —
 * it reflects the AUTHOR's position, identical for every reader — so there is
 * no session/viewer parameter.
 *
 * Ordering is `(created_at ASC, id ASC)` (UUIDv7 id = deterministic tiebreak),
 * and is explicitly NOT ranked — debate-view ranking is the separate multi-mode
 * model (§5.4 / ADR-0017 / `RANKING.md`, built at DEBATE.8), layered on top by
 * the consumer, never inside this loader.
 *
 * Freeze-at-resolution is by construction (INV-4): `positions` is written only
 * by `upsertPositionDelta` (buy/sell, which require `market.state = Open`), and
 * resolution writes `resolution_events`/`payout_events` but never `positions`;
 * so the recomputed marker is stable forever once a market leaves Open. No
 * stored marker, no snapshot table.
 *
 * Moderation seam (NOT built here): this returns the UNFILTERED comment list.
 * Reactive removal is render-time body-masking that preserves thread integrity
 * (ADR-0020/0021), not a row exclusion — so this read-model MUST NOT back a
 * public surface until that masking is attached (SPEC.2 §5.4).
 */
export async function listMarketComments(
	client: DebateViewReader,
	args: { marketId: string },
): Promise<DebateComment[]> {
	// Read 1 — the market's comments, oldest-first. Project exactly the
	// DebateComment substrate (no `SELECT *`; no vestigial columns).
	const rows = await client
		.select({
			id: comments.id,
			parentCommentId: comments.parentCommentId,
			userId: comments.userId,
			body: comments.body,
			sideAtPostTime: comments.sideAtPostTime,
			imageUploadsId: comments.imageUploadsId,
			createdAt: comments.createdAt,
		})
		.from(comments)
		.where(eq(comments.marketId, args.marketId))
		.orderBy(asc(comments.createdAt), asc(comments.id));

	// Empty market → skip the held-sides read entirely (an empty `inArray`
	// would degenerate to `WHERE false` / a driver edge). No comments, no read.
	if (rows.length === 0) {
		return [];
	}

	// Read 2 — the SINGLE set-based held-sides read for every listed author in
	// THIS market (no per-comment `getHeldPosition`; no N+1). The `quantity > 0`
	// predicate matches the partial-unique-index predicate exactly, so a
	// sold-to-zero position is excluded → `heldByUser.get(author)` is undefined
	// → marker `Exited`. Held side lives only in this local Map; it is consumed
	// by `computeMarker` and never returned (the exposure boundary).
	const authorIds = [...new Set(rows.map((r) => r.userId))];
	const heldRows = await client
		.select({ userId: positions.userId, side: positions.side })
		.from(positions)
		.where(
			and(
				eq(positions.marketId, args.marketId),
				inArray(positions.userId, authorIds),
				sql`${positions.quantity} > 0`,
			),
		);

	const heldByUser = new Map<string, "YES" | "NO">();
	for (const h of heldRows) {
		if (heldByUser.has(h.userId)) {
			// Defense-in-depth (mirrors read.ts ≤1 + the nightly D3 belt): the
			// structural guarantee is `positions_one_held_side_idx` (unique on
			// (user_id, market_id) WHERE quantity > 0). Two held rows for one
			// author should be impossible; if they exist, fail loud rather than
			// silently pick one side.
			throw new PositionSingleSideError(
				`>1 held position for (user=${h.userId}, market=${args.marketId}) — single-side structural guard absent`,
			);
		}
		heldByUser.set(h.userId, h.side);
	}

	return rows.map((r) => ({
		id: r.id,
		parentCommentId: r.parentCommentId,
		userId: r.userId,
		body: r.body,
		sideAtPostTime: r.sideAtPostTime,
		imageUploadsId: r.imageUploadsId,
		createdAt: r.createdAt,
		marker: computeMarker({
			sideAtPostTime: r.sideAtPostTime,
			heldSide: heldByUser.get(r.userId) ?? null,
		}),
	}));
}
