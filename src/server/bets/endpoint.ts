import "server-only";

import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/server/auth";
import type { EventInsertInput } from "@/server/events/insert";
import {
	computeBodyFingerprint,
	idempotencyLookupOrReserve,
} from "@/server/idempotency/cache";
import {
	type CompletedResponse,
	IDEMPOTENCY_ERROR_CODES,
	IDEMPOTENCY_HEADER_NAME,
	IDEMPOTENCY_KEY_REGEX,
	RATE_LIMIT_ERROR_CODE,
} from "@/server/idempotency/types";
import { logRequest } from "@/server/middleware/logging";
import { checkOrigin } from "@/server/middleware/origin-allowlist";
import { checkRateLimit, ipIdentifier } from "@/server/middleware/rate-limit";
import { safeCaptureException } from "@/server/observability/safe-capture";
import { PositionOversellError } from "@/server/positions/errors";
import { isFrozen } from "@/server/system/is-frozen";
import { toWireError } from "./errors";
import { loadDurableReplay } from "./replay";

// The shared §3.1 handler stack for the two bet endpoints (`/api/bets/place`,
// `/api/bets/sell`). Both routes run the SAME prefix — origin → auth+ban →
// idem-key → idem-lookup → rate-limit → release-in-finally — and differ ONLY in
// the flow-specific tail (step 5 body validation, step 6 moderation [place
// only], step 7 the per-flow wrapper callback), which the route passes as
// `inner`. Factoring it here keeps the §3.1 ordering invariant + the §4.4 wire
// contract in ONE place rather than duplicated across the two route files.
//
// Ordering invariant (SPEC.2 §3.1): idempotency lookup (step 3) MUST precede
// rate-limit (step 4). Moderation (step 6, place-only) runs OUTSIDE the tx
// (ADR-0014) — it lives in `inner`, before `runBetTransaction`.

/** The 7-field events metadata (SPEC.2 §3.7), generated once at handler entry. */
export type BetEventMetadata = EventInsertInput<"bet.placed">["metadata"];

/** Context handed to the flow-specific `inner` after the shared prefix passes. */
export interface BetEndpointCtx {
	userId: string;
	rawBody: unknown;
	idempotencyKey: string;
	/** AUDIT-FIX-B3 A9 — the RFC 8785 body fingerprint (computed at step 3), threaded to the durable receipt writes + the route 23505-catch replay lookup. */
	bodyFingerprint: string;
	ip: string;
	requestId: string;
	userAgent: string;
}

/**
 * A client-supplied `x-request-id` is echoed for trace correlation ONLY if it
 * is a safe token; otherwise the handler mints a fresh UUIDv7. Reflecting a raw
 * value (e.g. a CR/LF-poisoned header) would throw in `new Response(...)` and
 * self-500 the request (security-auditor MEDIUM, ENGINE.8 cascade).
 */
const REQUEST_ID_SAFE = /^[A-Za-z0-9_-]{1,200}$/;

/** §4.4 error envelope. `retry_after` (body) is present only for 429 / 503. */
function envelope(
	code: string,
	message: string,
	retryAfterBody?: number,
): {
	ok: false;
	error: { code: string; message: string; retry_after?: number };
} {
	const error: { code: string; message: string; retry_after?: number } = {
		code,
		message,
	};
	if (retryAfterBody !== undefined) {
		error.retry_after = retryAfterBody;
	}
	return { ok: false, error };
}

function jsonResponse(
	requestId: string,
	status: number,
	body: unknown,
	retryAfterHeader?: number,
): Response {
	const headers: Record<string, string> = {
		"content-type": "application/json",
		"X-Request-Id": requestId,
	};
	if (retryAfterHeader !== undefined) {
		headers["retry-after"] = String(retryAfterHeader);
	}
	return new Response(JSON.stringify(body), { status, headers });
}

function extractIp(request: Request): string {
	const fwd = request.headers.get("x-forwarded-for");
	if (fwd) {
		const first = fwd.split(",")[0]?.trim();
		if (first) return first;
	}
	return "unknown";
}

/** Build the 7-field events metadata once at handler entry (retry-purity). */
export function buildBetMetadata(args: {
	requestId: string;
	flowId: string;
	userId: string;
	idempotencyKey: string;
	ip: string;
	userAgent: string;
}): BetEventMetadata {
	return {
		request_id: args.requestId,
		flow_id: args.flowId,
		user_id: args.userId,
		actor_id: args.userId,
		idempotency_key: args.idempotencyKey,
		ip: args.ip,
		user_agent: args.userAgent,
	};
}

/**
 * Run the shared §3.1 stack, then the flow-specific `inner`. `inner` validates
 * the body (step 5), runs moderation if applicable (step 6), and invokes
 * `runBetTransaction` (step 7), returning `{ status: 200, body: {ok:true,data} }`
 * on success or THROWING a typed bet error (mapped by `toWireError`).
 *
 * On the idempotency `miss` arm the body is wrapped in try/finally: `release`
 * receives the completed response on success / a terminal cached error (4xx +
 * 429, cached per §11), or `null` on a transient 503 / uncaught crash so a retry
 * re-attempts cleanly (opt-C / ADR-0015 §4). Every response carries
 * `X-Request-Id`.
 */
export async function runBetEndpoint(
	request: Request,
	inner: (
		ctx: BetEndpointCtx,
	) => Promise<{ status: number; body: unknown; noCache?: true }>,
): Promise<Response> {
	const startedAt = Date.now();
	const inboundRequestId = request.headers.get("x-request-id");
	const requestId =
		inboundRequestId && REQUEST_ID_SAFE.test(inboundRequestId)
			? inboundRequestId
			: uuidv7();

	// 0. Origin (§4.3).
	if (!checkOrigin(request)) {
		return jsonResponse(
			requestId,
			403,
			envelope("error_origin_not_allowed", "origin not allowed"),
		);
	}

	// 1. Auth + ban (+ defensive onboarding).
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user?.id) {
		return jsonResponse(
			requestId,
			401,
			envelope("error_session_required", "session required"),
		);
	}
	const userId = session.user.id;
	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
		columns: { pseudonym: true, tosAcceptedAt: true, bannedAt: true },
	});
	if (user?.bannedAt != null) {
		return jsonResponse(
			requestId,
			403,
			envelope("banned_user", "user is banned"),
		);
	}
	// Defensive onboarding assertion (opt-A): the session-deferral hook already
	// guarantees pseudonym + tos for any valid participant session, so this only
	// fires as defense-in-depth against a hook bypass — and only when a user row
	// exists to contradict the session's vouching.
	if (user && (!user.pseudonym || !user.tosAcceptedAt)) {
		return jsonResponse(
			requestId,
			403,
			envelope("error_onboarding_required", "onboarding required"),
		);
	}

	// 1.5 Freeze gate (§20.2) — adjacent to auth, before idempotency; no tx opens.
	if (await isFrozen()) {
		return jsonResponse(
			requestId,
			410,
			envelope("error_experiment_concluded", "The experiment has concluded."),
		);
	}

	// 2. Idempotency-Key validate.
	const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER_NAME);
	if (!idempotencyKey) {
		return jsonResponse(
			requestId,
			400,
			envelope(
				IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED,
				"Idempotency-Key header required",
			),
		);
	}
	if (!IDEMPOTENCY_KEY_REGEX.test(idempotencyKey)) {
		return jsonResponse(
			requestId,
			400,
			envelope(
				IDEMPOTENCY_ERROR_CODES.KEY_INVALID,
				"Idempotency-Key malformed",
			),
		);
	}

	// Parse the JSON body (needed for the fingerprint + flow validation).
	let rawBody: unknown;
	try {
		rawBody = await request.json();
	} catch {
		return jsonResponse(
			requestId,
			400,
			envelope("error_invalid_json", "invalid JSON body"),
		);
	}

	// 3. Idempotency cache lookup — MUST precede rate-limit (§3.1 ordering).
	const fingerprint = await computeBodyFingerprint(rawBody);
	const idem = await idempotencyLookupOrReserve(idempotencyKey, fingerprint);
	switch (idem.kind) {
		case "hit":
			return jsonResponse(
				requestId,
				idem.cachedResponse.status,
				idem.cachedResponse.body,
			);
		case "mismatch":
			return jsonResponse(
				requestId,
				409,
				envelope(
					IDEMPOTENCY_ERROR_CODES.KEY_REUSED,
					"Idempotency-Key reused with a different body",
				),
			);
		case "pending":
			return jsonResponse(
				requestId,
				409,
				envelope(
					IDEMPOTENCY_ERROR_CODES.IN_FLIGHT,
					"an identical request is in flight",
				),
				2,
			);
		case "unavailable":
			return jsonResponse(
				requestId,
				503,
				envelope(
					IDEMPOTENCY_ERROR_CODES.UNAVAILABLE,
					"idempotency store unavailable",
					5,
				),
				5,
			);
	}

	// idem.kind === "miss": hold the release for the try/finally (opt-C).
	const release = idem.release;
	const ip = extractIp(request);
	const userAgent = request.headers.get("user-agent") ?? "unknown";

	let completed: CompletedResponse | null = null;
	// AUDIT-FIX-B1 A17 (§16.3): only handler-body outcomes log — set at the
	// `inner` result and the catch's wire, never at the 429 arm, the durable
	// pre-check arms, or any §3.1 prefix rejection (those never reached the handler
	// body — the durable replay/mismatch is an idempotency-family short-circuit,
	// mirroring the no-log Redis-hit arm above).
	let logStatus: number | null = null;
	try {
		// 3.5 AUDIT-FIX-B3 A9 — the durable receipt pre-check, BEFORE rate-limit
		// (part of the step-3 idempotency lookup family: a replay must not consume
		// rate budget, and it must short-circuit BEFORE step-6 moderation so a
		// replayed committed place is never re-moderated into a bogus block for a
		// bet that already landed). Fail-OPEN inside loadDurableReplay: correctness
		// is backstopped by the tx-level unique 23505 catch in the routes.
		const replay = await loadDurableReplay(db, {
			idempotencyKey,
			bodyFingerprint: fingerprint,
		});
		if (replay !== null) {
			if (replay.kind === "replay") {
				// Receipt + fingerprint match → replay the ORIGINAL committed 200. Set
				// `completed` so the finally PROMOTES the sentinel → Redis fast path
				// repopulated.
				const body = { ok: true, data: replay.result };
				completed = { status: 200, body, bodyFingerprint: fingerprint };
				return jsonResponse(requestId, 200, body);
			}
			// Receipt + fingerprint MISMATCH → 409, NEVER cached (caching under the
			// key would poison the original body's rightful replay). `completed` stays
			// null → the finally deletes the sentinel.
			const body = envelope(
				IDEMPOTENCY_ERROR_CODES.KEY_REUSED,
				"Idempotency-Key reused with a different body",
			);
			return jsonResponse(requestId, 409, body);
		}

		// 4. Rate-limit (betPerIp; fails OPEN). 429 IS cached per §11.
		const rl = await checkRateLimit("betPerIp", ipIdentifier(ip));
		if (!rl.allowed) {
			const body = envelope(
				RATE_LIMIT_ERROR_CODE,
				"rate limit exceeded",
				rl.retryAfter,
			);
			completed = { status: 429, body, bodyFingerprint: fingerprint };
			return jsonResponse(requestId, 429, body, rl.retryAfter);
		}

		// 5–7. flow-specific: validate → (moderation, place only) → wrapper.
		const result = await inner({
			userId,
			rawBody,
			idempotencyKey,
			bodyFingerprint: fingerprint,
			ip,
			requestId,
			userAgent,
		});
		// AUDIT-FIX-B3 A9 — cache the 4xx/200 EXCEPT when the inner marks `noCache`
		// (the route's durable 23505-mismatch 409, whose caching would poison the
		// key). 5xx stays uncached (opt-C / ADR-0015 §4).
		completed =
			result.status < 500 && !result.noCache
				? {
						status: result.status,
						body: result.body,
						bodyFingerprint: fingerprint,
					}
				: null;
		logStatus = result.status;
		return jsonResponse(requestId, result.status, result.body);
	} catch (err) {
		const wire = toWireError(err);
		// AUDIT-FIX-B1 A5 (rulings #1, #2): the 500 fallthrough is the only
		// money-path arm with no capture at source (the 4xx/503 classes are
		// captured where they're minted). Original err object — an append-only
		// trigger RAISE message survives verbatim, no rewrap.
		if (wire.body.error.code === "error_internal") {
			safeCaptureException(err, {
				tags: { kind: "bet_handler_internal_error" },
			});
		}
		// AUDIT-FIX-B3 A3 — the storage oversell backstop tripped (it maps to a
		// clean 400 insufficient_shares via toWireError, but a trip means the
		// sell() pre-check was bypassed → alarm loudly; the A5 lesson: no silent
		// backstop trips).
		if (err instanceof PositionOversellError) {
			safeCaptureException(err, {
				tags: { kind: "position_oversell_backstop" },
			});
		}
		// Cache terminal product errors (4xx) + 429; release(null) on a transient
		// 503 / uncaught 5xx so a retry re-attempts cleanly (opt-C / ADR-0015 §4).
		completed =
			wire.status < 500
				? { status: wire.status, body: wire.body, bodyFingerprint: fingerprint }
				: null;
		logStatus = wire.status;
		return jsonResponse(
			requestId,
			wire.status,
			wire.body,
			wire.retryAfterHeader,
		);
	} finally {
		if (logStatus !== null) {
			try {
				logRequest({ request, status: logStatus, userId, startedAt });
			} catch {
				// Fail-open (§17.5 discipline): a log emission failure must never
				// strand the idempotency reservation released below.
			}
		}
		// AUDIT-FIX-B3 A4 (belt) — the release closure is already never-throws
		// (cache.ts guarded), but wrap here too so NO release implementation can let
		// a finally throw supersede the already-built (committed 200 / terminal 4xx)
		// response. `site: endpoint_finally` distinguishes this alarm from the
		// closure's own `site: release`.
		try {
			await release(completed);
		} catch (err) {
			safeCaptureException(err, {
				tags: {
					kind: "upstash_unavailable_idempotency",
					site: "endpoint_finally",
				},
			});
		}
	}
}
