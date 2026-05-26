import { timingSafeEqual } from "node:crypto";

import { captureException } from "@sentry/nextjs";

import { db } from "@/db";
import {
	ORPHAN_SWEEP_BATCH_SIZE,
	ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
	ORPHAN_SWEEP_LOCK_TTL_SECONDS,
	ORPHAN_WINDOW_MINUTES,
} from "@/server/config/limits";
import { deleteObject } from "@/server/storage/r2";
import { sweepOrphans } from "@/server/storage/sweep-orphans";
import { acquireLock, releaseLock } from "@/server/upstash/lock";

// GET /api/cron/r2-orphan-sweep — SCAFFOLD.15 plan §5.6 + SPEC.2 §3.3 + §12.6.
// Vercel Cron contract supports GET only (POST/PUT/etc. not honored at the
// fanout layer); per-cadence `0 */6 * * *` is wired in vercel.json.
//
// Rate-limit + Idempotency-Key: EXEMPT for this surface (caller is Vercel
// itself; per-IP RL is pointless, and the distributed lock + idempotent ops
// handle Vercel cron's at-least-once + may-fire-twice-concurrently
// semantics). Documented per SPEC.2 §3.4 cron-engine-split prose.
//
// Three phases:
//   1. Auth   — Bearer ${CRON_SECRET} via constant-time compare
//   2. Lock   — acquireLock → null returns {status: 'locked'} HTTP 200
//   3. Sweep  — sweepOrphans inside try/finally { releaseLock }
//
// Status codes returned in body (NOT as HTTP 5xx) so Vercel cron's
// "cron is failing" surface only fires on actual crashes — not on a
// universal R2 outage (which is operationally normal at the cron layer
// even if user-facing handlers fail-CLOSED on the same event).

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
		// Configuration error — refuse to run.
		console.error("cron_misconfigured", "CRON_SECRET not set");
		return jsonResponse({ error: "error_cron_misconfigured" }, { status: 500 });
	}
	const authHeader = request.headers.get("authorization") ?? "";
	const expected = `Bearer ${secret}`;
	if (!constantTimeStringCompare(authHeader, expected)) {
		return jsonResponse({ error: "error_unauthenticated" }, { status: 401 });
	}

	// 2. Lock — at-most-one-runner across Vercel cron fanout
	const lockKey = "cron-lock:r2-orphan-sweep";
	let lock: { token: string } | null;
	try {
		lock = await acquireLock(lockKey, ORPHAN_SWEEP_LOCK_TTL_SECONDS);
	} catch (err) {
		console.error("cron_lock_acquire_failed", err);
		return jsonResponse({ error: "error_lock_unavailable" }, { status: 503 });
	}
	if (lock === null) {
		// Another sweep holds the lock — exit cleanly with HTTP 200 so Vercel
		// doesn't treat this as a cron failure.
		return jsonResponse({ status: "locked", swept: 0 }, { status: 200 });
	}

	// 3. Sweep — guarded by try/finally so the lock always releases.
	// Outer try/catch absorbs SCAFFOLD.15 security-auditor MEDIUM #2:
	// an unhandled exception from sweepOrphans itself (e.g., DB connection
	// failure during the candidate SELECT) would otherwise propagate as an
	// HTTP 500 and trigger Vercel cron's "cron is failing" alarm. Map any
	// such throw to a structured `{status: 'error'}` HTTP 200 to preserve
	// the cron-is-not-failing operational signal — the inner `swept` count
	// is whatever was accumulated before the throw (0 if SELECT failed
	// before any row was processed).
	try {
		try {
			const result = await sweepOrphans({
				db,
				deleteObject,
				batchSize: ORPHAN_SWEEP_BATCH_SIZE,
				orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
				circuitBreakerThreshold: ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
			});
			return jsonResponse(result, { status: 200 });
		} catch (err) {
			// Tag `orphan_sweep_handler_failure` per §17 alarm-6 sub-table.
			captureException(err, {
				tags: { kind: "orphan_sweep_handler_failure" },
			});
			return jsonResponse({ status: "error", swept: 0 }, { status: 200 });
		}
	} finally {
		try {
			await releaseLock(lockKey, lock.token);
		} catch (err) {
			// Lock release failed (Upstash unreachable). The lock will TTL out
			// after ORPHAN_SWEEP_LOCK_TTL_SECONDS; log + swallow so the sweep
			// result is still returned to Vercel.
			console.error("cron_lock_release_failed", err);
		}
	}
}
