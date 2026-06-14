import { timingSafeEqual } from "node:crypto";

import { captureException } from "@sentry/nextjs";

import { buildAdminMetadata } from "@/server/admin/wire";
import { CLOSE_SWEEP_LOCK_TTL_SECONDS } from "@/server/config/limits";
import { closeDueMarkets } from "@/server/markets/close";
import { isFrozen } from "@/server/system/is-frozen";
import { getRedisKey } from "@/server/upstash/keys";
import { acquireLock, releaseLock } from "@/server/upstash/lock";

// GET /api/cron/close-due-markets — ENGINE.15 R-15.2 + D-15.g. The A-2 mirror
// of src/app/api/cron/r2-orphan-sweep/route.ts. Vercel Cron supports GET only.
//
// Rate-limit + Idempotency-Key: EXEMPT for this surface (the caller is Vercel
// itself; per-IP RL is pointless, and the distributed lock + the idempotent
// `closeDueMarkets` sweep handle Vercel cron's at-least-once +
// may-fire-twice-concurrently semantics). Documented per SPEC.2 §3.4.
//
// Three phases:
//   1. Auth   — Bearer ${CRON_SECRET} via constant-time compare
//   2. Lock   — acquireLock → null returns {status:'locked'} HTTP 200
//   3. Sweep  — closeDueMarkets inside try/finally { releaseLock }
//
// Status codes returned in the body (NOT as HTTP 5xx) so Vercel cron's
// "cron is failing" surface fires only on actual crashes — a transient sweep
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

	// Freeze gate (§20.2) — the automated W-4 write surface. Post-freeze the sweep
	// is skipped (no lock, no closeDueMarkets). HTTP 200 + in-body status per the
	// §3.4 A-2 cron contract (clientless scheduler — the 410 client envelope is the
	// participant contract, not this surface).
	if (await isFrozen()) {
		return jsonResponse({ status: "frozen" }, { status: 200 });
	}

	// 2. Lock — at-most-one-runner across Vercel cron fanout.
	const lockKey = getRedisKey("cron-lock", "close-due-markets");
	let lock: { token: string } | null;
	try {
		lock = await acquireLock(lockKey, CLOSE_SWEEP_LOCK_TTL_SECONDS);
	} catch (err) {
		console.error("cron_lock_acquire_failed", err);
		return jsonResponse({ error: "error_lock_unavailable" }, { status: 503 });
	}
	if (lock === null) {
		// Another sweep holds the lock — exit cleanly with HTTP 200.
		return jsonResponse({ status: "locked" }, { status: 200 });
	}

	// 3. Sweep — guarded by try/finally so the lock always releases. The inner
	// try maps a sweep-side throw to a structured {status:'error'} HTTP 200 +
	// Sentry capture (the A-2 alarm posture), preserving cron-is-not-failing.
	try {
		try {
			const metadata = await buildAdminMetadata({
				flowId: "W-4-CLOSE",
				request,
			});
			const result = await closeDueMarkets({ now: new Date(), metadata });
			return jsonResponse(
				{ status: "ok", closed: result.closed, skipped: result.skipped },
				{ status: 200 },
			);
		} catch (err) {
			captureException(err, {
				tags: { kind: "close_due_markets_handler_failure" },
			});
			return jsonResponse({ status: "error" }, { status: 200 });
		}
	} finally {
		try {
			await releaseLock(lockKey, lock.token);
		} catch (err) {
			// Lock release failed (Upstash unreachable). The lock TTLs out after
			// CLOSE_SWEEP_LOCK_TTL_SECONDS; log + swallow so the result still returns.
			console.error("cron_lock_release_failed", err);
		}
	}
}
