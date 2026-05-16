import { sql } from "drizzle-orm";
import { db } from "@/db";

// Layer 2 admin session validator per CVE-2025-29927 + SPEC.2 §8.4 +
// §8.7 pillar 6 + plan §3 step 12. Called at the entry of every admin
// Server Action / Route Handler — Layer 1 (proxy.ts middleware redirect)
// is UX-only and bypassable; this validator is the security boundary.
//
// Reads ONLY `zugzwang_admin_session`. Per §8.7 pillar 6, the participant
// cookie `zugzwang_session` is never consulted by admin handlers — even
// if a participant cookie is present, the admin validator returns null.
//
// Takes the cookie store as an argument (rather than calling
// `cookies()` from `next/headers`) so callers can pass a Next.js
// readonly cookies object OR a request-derived cookie reader. This
// matches the unit-test invocation pattern.

const ADMIN_COOKIE_NAME = "zugzwang_admin_session";

type CookieEntry = { name: string; value: string };

type CookieStore = {
	get: (name: string) => CookieEntry | undefined;
};

export async function validateAdminSession(
	cookieStore: CookieStore,
): Promise<{ sessionId: string } | null> {
	const cookie = cookieStore.get(ADMIN_COOKIE_NAME);
	if (!cookie?.value) return null;

	const sessionId = cookie.value;

	const rows = (await db.execute(
		sql`SELECT session_id FROM admin_sessions WHERE session_id = ${sessionId} LIMIT 1`,
	)) as unknown as Array<{ session_id: string }>;

	if (rows.length === 0) return null;
	return { sessionId };
}
