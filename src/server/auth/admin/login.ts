"use server";

import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { v7 as uuidv7 } from "uuid";
import type { z } from "zod";
import { db } from "@/db";
import { insertEvent } from "@/server/events/insert";
import type { eventMetadataSchema } from "@/server/events/schemas";
import { checkRateLimit, ipIdentifier } from "@/server/middleware/rate-limit";

// F-AUTH-ADMIN login Server Action per SPEC.1 §13 + SPEC.2 §8.4 + plan §4
// step 6 (post-Q1 amendment: NO Turnstile). Four steps:
//
//   1. Per-IP rate-limit `adminLoginPerIp` → deny → identical-401
//   2. HMAC-SHA256 digest comparison via `crypto.timingSafeEqual` over
//      equal-length 32-byte buffers. `createHmac(secret).update(x).digest()`
//      on both sides — avoids the RangeError that direct `timingSafeEqual`
//      throws on different-length inputs (which would leak password length
//      via the error path).
//   3. On mismatch: dummy `SELECT 1 FROM admin_sessions LIMIT 1` +
//      constant-time delay → identical-401 (timing parity per SPEC.2 §8.4
//      step 3; brute-force protection is the per-IP rate limit).
//   4. On match: SERIALIZABLE `DELETE FROM admin_sessions;
//      INSERT INTO admin_sessions (...) RETURNING session_id` → set
//      `zugzwang_admin_session` cookie (HttpOnly+Secure+SameSite=Lax+
//      Path=/admin, no Max-Age per SPEC.2 §8.5) → redirect to `/admin`.
//
// Identical-401 envelope `{ ok: false, code: "admin_login_invalid" }` is
// returned for ALL failure arms — rate-limit, wrong password, missing
// env. No information leak about which condition fired (SPEC.2 §8.4
// line 868).

const ADMIN_COOKIE_NAME = "zugzwang_admin_session";
const TIMING_PARITY_DELAY_MS = 100;

const INVALID = { ok: false, code: "admin_login_invalid" } as const;

// Transient-failure envelope per kickoff Option A-prime (step-25 review
// MEDIUM fix): when the SERIALIZABLE DELETE+INSERT below hits SQLSTATE
// 40001 twice, the loser receives this code (HTTP 503 semantic — service
// temporarily unavailable, retry). Distinct from `admin_login_invalid`
// (HTTP 401, no info-leak shape) because this is a transient
// concurrency outcome, not a credential failure. Route / page layer
// maps to 503 in a future iteration; current page wrapper discards.
const SERIALIZATION_CONFLICT = {
	ok: false,
	code: "admin_login_serialization_conflict",
} as const;

type AdminLoginResult = typeof INVALID | typeof SERIALIZATION_CONFLICT;

function getClientIp(headerStore: {
	get: (name: string) => string | null;
}): string {
	const fwd = headerStore.get("x-forwarded-for");
	if (fwd) {
		const first = fwd.split(",")[0]?.trim();
		if (first) return first;
	}
	return "unknown";
}

function constantTimeDelay(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, TIMING_PARITY_DELAY_MS));
}

function hmacDigestEqual(
	input: string,
	expected: string,
	secret: string,
): boolean {
	const inputDigest = createHmac("sha256", secret).update(input).digest();
	const expectedDigest = createHmac("sha256", secret).update(expected).digest();
	return timingSafeEqual(inputDigest, expectedDigest);
}

// Postgres SQLSTATE 40001 — `serialization_failure`. SERIALIZABLE
// transactions abort with this code when Postgres detects a serialization
// anomaly with another concurrent SERIALIZABLE transaction. Surfaces here
// via the postgres.js driver as an Error with `code: "40001"`.
function isSerializationFailure(err: unknown): boolean {
	if (err === null || typeof err !== "object") return false;
	return (err as { code?: unknown }).code === "40001";
}

// Single SERIALIZABLE attempt at the DELETE+INSERT replace. Hoisted so the
// retry-once wrapper below can invoke it twice without duplicating the
// transaction body.
//
// ENGINE.6 §D.3 + S-F: threads eventId + metadata through so the
// admin.signed_in events row commits inside this SERIALIZABLE tx,
// aggregate_id = the inserted admin_sessions.session_id (UUIDv7 PK).
// aggregate_type = 'admin_session' (the 7th SPEC.2 §7.1 aggregate_type
// entry — same-commit amendment lands at Phase 5).
// metadata.user_id = NULL, metadata.actor_id = 'admin-singleton' per
// SPEC.2 §3.6. NOT an ADMIN_SINGLETON_UUID synthesized constant — the
// JSONB `metadata.actor_id` is the admin-actor surface.
async function attemptAdminSessionReplace(
	eventId: string,
	metadata: z.infer<typeof eventMetadataSchema>,
	ip: string,
): Promise<string | null> {
	return db.transaction(
		async (tx) => {
			await tx.execute(sql`DELETE FROM admin_sessions`);
			const inserted = (await tx.execute(
				sql`INSERT INTO admin_sessions (session_id, issued_at, last_seen_at)
				    VALUES (${uuidv7()}, now(), now())
				    RETURNING session_id`,
			)) as unknown as Array<{ session_id: string }>;
			const sessionId = inserted[0]?.session_id;
			if (!sessionId) return null;

			await insertEvent(tx, {
				eventId,
				eventType: "admin.signed_in",
				aggregateType: "admin_session",
				aggregateId: sessionId,
				payload: { sessionId, ip },
				metadata,
			});

			return sessionId;
		},
		{ isolationLevel: "serializable" },
	);
}

export async function adminLoginAction(
	formData: FormData,
): Promise<AdminLoginResult> {
	const headerStore = await headers();
	const cookieStore = await cookies();
	const ip = getClientIp(headerStore);

	// Step 1: per-IP rate limit (identical-401 on deny, no transaction).
	const rate = await checkRateLimit("adminLoginPerIp", ipIdentifier(ip));
	if (!rate.allowed) {
		return INVALID;
	}

	const submitted = String(formData.get("password") ?? "");
	const envPassword = process.env.ADMIN_PASSWORD ?? "";
	const secret = process.env.BETTER_AUTH_SECRET ?? "";

	// Step 2: HMAC-digest length-safe compare. If env or secret is empty,
	// match is false (which routes to the mismatch arm — identical-401).
	const match =
		envPassword.length > 0 &&
		secret.length > 0 &&
		hmacDigestEqual(submitted, envPassword, secret);

	if (!match) {
		// Step 3: dummy DB read + constant-time delay → identical-401.
		await db.execute(sql`SELECT 1 FROM admin_sessions LIMIT 1`);
		await constantTimeDelay();
		return INVALID;
	}

	// Step 4: SERIALIZABLE DELETE+INSERT single transaction per plan §4
	// step 6.4 + SPEC.2 §8.4 (the DELETE+INSERT step; pre-Q1-amendment
	// step 4, post-amendment step 3). DELETE first so concurrent admin
	// logins (rare, but per SPEC.1 line 736) revoke the prior session row
	// atomically — single-row-at-any-moment invariant without a UNIQUE
	// constraint.
	//
	// **SERIALIZABLE is load-bearing — do NOT downgrade without a plan
	// amendment.** Under READ COMMITTED, two concurrent admin logins can
	// interleave as: T1.DELETE removes R0 → T2.DELETE (pre-T1-commit)
	// finds nothing → both INSERTs commit distinct UUIDs → two rows in a
	// singleton-by-construction table. SERIALIZABLE makes Postgres detect
	// the anomaly on the second commit and abort with SQLSTATE 40001.
	//
	// Retry-once-on-40001 per kickoff Option A-prime: first 40001 → retry
	// immediately; second 40001 → return the
	// `admin_login_serialization_conflict` envelope (HTTP 503 semantic,
	// distinct from the `admin_login_invalid` 401 — surfaces as transient
	// rather than as credential failure, no info-leak concern).
	//
	// ENGINE.6 §D.3: eventId + metadata generated at handler entry per
	// ADR-0016 D1 + plan V6, threaded through both attempts. If attempt 1
	// aborts on 40001, its events row rolls back atomically with the
	// admin_sessions INSERT; attempt 2 inserts the events row fresh with
	// the SAME eventId but a NEW admin_sessions.session_id (the inner
	// uuidv7() call generates per-attempt). Final state: 1 admin_sessions
	// row + 1 events row, aggregate_id matching the committed session_id.
	const eventId = uuidv7();
	const metadata = {
		request_id: "unknown",
		flow_id: "F-AUTH-ADMIN",
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip,
		user_agent: headerStore.get("user-agent") ?? "unknown",
	};

	let newSessionId: string | null;
	try {
		newSessionId = await attemptAdminSessionReplace(eventId, metadata, ip);
	} catch (err) {
		if (!isSerializationFailure(err)) throw err;
		try {
			newSessionId = await attemptAdminSessionReplace(eventId, metadata, ip);
		} catch (retryErr) {
			if (isSerializationFailure(retryErr)) return SERIALIZATION_CONFLICT;
			throw retryErr;
		}
	}

	if (!newSessionId) {
		return INVALID;
	}

	// Indefinite cookie per SPEC.2 §8.5 — no maxAge, no expires. Host-only
	// (no domain), Path=/admin so it isn't sent to participant routes.
	cookieStore.set(ADMIN_COOKIE_NAME, newSessionId, {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/admin",
	});

	redirect("/admin");
}
