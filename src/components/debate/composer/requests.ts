import { IDEMPOTENCY_HEADER_NAME } from "@/server/idempotency/types";

/**
 * UI.A3 slice 2 — the wire-request builders (plan §3.2). Pure: assemble the
 * exact `fetch` arguments for the bet endpoints; the caller owns the fetch.
 * `@/server/idempotency/types` is a zero-import pure-data module (no
 * `server-only`) — the header name binds to the single source of truth,
 * never a duplicated literal.
 */

export type PlaceBody = {
	marketId: string;
	side: "YES" | "NO";
	/** Decimal string (NUMERIC(38,18) domain) — never a JS number. */
	stake: string;
	body: string;
	parentCommentId?: string;
	imageUploadsId?: string;
};

/**
 * `POST /api/bets/place` (SPEC.1 F-BET-1/2). Optional keys are OMITTED when
 * absent — never serialized as null — so the route's zod shape sees exactly
 * the intended payload.
 */
export function buildPlaceRequest(args: {
	body: PlaceBody;
	idempotencyKey: string;
}): { url: string; init: RequestInit } {
	const body: Record<string, string> = {
		marketId: args.body.marketId,
		side: args.body.side,
		stake: args.body.stake,
		body: args.body.body,
	};
	if (args.body.parentCommentId !== undefined) {
		body.parentCommentId = args.body.parentCommentId;
	}
	if (args.body.imageUploadsId !== undefined) {
		body.imageUploadsId = args.body.imageUploadsId;
	}
	return {
		url: "/api/bets/place",
		init: {
			method: "POST",
			headers: {
				"content-type": "application/json",
				[IDEMPOTENCY_HEADER_NAME]: args.idempotencyKey,
			},
			body: JSON.stringify(body),
		},
	};
}
