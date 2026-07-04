import { timingSafeEqual } from "node:crypto";

import { ALARMS_DRAIN_LOCK_TTL_SECONDS } from "@/server/config/limits";
import { drainCronAlarms } from "@/server/observability/drain-cron-alarms";
import { safeCaptureException } from "@/server/observability/safe-capture";
import { getRedisKey } from "@/server/upstash/keys";
import { acquireLock, releaseLock } from "@/server/upstash/lock";

// GET /api/cron/alarms-drain — AUDIT-FIX-B1 A7 (rulings #10-OVERRIDE, #11).
// Mirrors src/app/api/cron/close-due-markets/route.ts MINUS the freeze gate:
// ops-hygiene crons don't gate on freeze (precedent: r2-orphan-sweep has none;
// the drain writes only `processed_at`, no §20.2 participant surface, and
// post-freeze drift alarms should still reach Sentry — OQ-b).
//
// Rate-limit + Idempotency-Key: EXEMPT for this surface (the caller is Vercel
// itself; the distributed lock + the drain's emit-then-stamp idempotence
// handle Vercel cron's at-least-once + may-fire-twice-concurrently semantics).
// The Redis lock IS the serialization the OQ-10 override assumes — the drain
// itself opens no transaction across the Sentry hop.
//
// Three phases:
//   1. Auth   — Bearer ${CRON_SECRET} via constant-time compare
//   2. Lock   — acquireLock → null returns {status:'locked'} HTTP 200
//   3. Drain  — drainCronAlarms inside try/finally { releaseLock }
//
// Status codes returned in the body (NOT as HTTP 5xx) so Vercel cron's
// "cron is failing" surface fires only on actual crashes — a transient drain
// fault is operationally normal at the cron layer.

function jsonResponse(body: unknown, init: ResponseInit): Response {
	return new Response(JSON.stringify(body), {
		...init,
		headers: {
			"content-type": "application/json",
			...(init.headers ?? {}),
		},
	});
}

function constantTimeStringCompare(a: string, b: string): boolean {
	const aBuf = Buffer.from(a, "utf8");
	const bBuf = Buffer.from(b, "utf8");
	if (aBuf.length !== bBuf.length) return false;
	return timingSafeEqual(aBuf, bBuf);
}

export async function GET(request: Request): Promise<Response> {
	// 1. Auth — Bearer ${CRON_SECRET}
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		console.error("cron_misconfigured", "CRON_SECRET not set");
		return jsonResponse({ error: "error_cron_misconfigured" }, { status: 500 });
	}
	const authHeader = request.headers.get("authorization") ?? "";
	if (!constantTimeStringCompare(authHeader, `Bearer ${secret}`)) {
		return jsonResponse({ error: "error_unauthenticated" }, { status: 401 });
	}

	// NO freeze gate — see the header block (OQ-b).

	// 2. Lock — at-most-one-runner across Vercel cron fanout.
	const lockKey = getRedisKey("cron-lock", "alarms-drain");
	let lock: { token: string } | null;
	try {
		lock = await acquireLock(lockKey, ALARMS_DRAIN_LOCK_TTL_SECONDS);
	} catch (err) {
		console.error("cron_lock_acquire_failed", err);
		return jsonResponse({ error: "error_lock_unavailable" }, { status: 503 });
	}
	if (lock === null) {
		// Another drain holds the lock — exit cleanly with HTTP 200.
		return jsonResponse({ status: "locked" }, { status: 200 });
	}

	// 3. Drain — guarded by try/finally so the lock always releases. The inner
	// try maps a drain-side throw to a structured {status:'error'} HTTP 200 +
	// Sentry capture (naming precedent: close_due_markets_handler_failure /
	// orphan_sweep_handler_failure — code-level, no §17.2 master row per OQ-d③).
	try {
		try {
			const result = await drainCronAlarms();
			return jsonResponse({ status: "ok", ...result }, { status: 200 });
		} catch (err) {
			safeCaptureException(err, {
				tags: { kind: "alarms_drain_handler_failure" },
			});
			return jsonResponse({ status: "error" }, { status: 200 });
		}
	} finally {
		try {
			await releaseLock(lockKey, lock.token);
		} catch (err) {
			// Lock release failed (Upstash unreachable). The lock TTLs out after
			// ALARMS_DRAIN_LOCK_TTL_SECONDS; log + swallow so the result still returns.
			console.error("cron_lock_release_failed", err);
		}
	}
}
