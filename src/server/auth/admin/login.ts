"use server";

import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db";
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

type AdminLoginResult = typeof INVALID;

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

	// Step 4: SERIALIZABLE DELETE+INSERT single transaction. DELETE first
	// so concurrent admin logins (rare, but per SPEC.1 line 736) revoke
	// the prior session row atomically — single-row-at-any-moment invariant
	// without a UNIQUE constraint.
	const newSessionId = await db.transaction(async (tx) => {
		await tx.execute(sql`DELETE FROM admin_sessions`);
		const inserted = (await tx.execute(
			sql`INSERT INTO admin_sessions (session_id, issued_at, last_seen_at)
			    VALUES (${uuidv7()}, now(), now())
			    RETURNING session_id`,
		)) as unknown as Array<{ session_id: string }>;
		return inserted[0]?.session_id ?? null;
	});

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

	// TODO(ENGINE.6): writeAdminEvent('admin.signed_in', { sessionId: newSessionId, ip })
	redirect("/admin");
}
