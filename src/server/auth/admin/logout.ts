"use server";

import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";

// F-AUTH-5 admin logout Server Action per SPEC.2 §8.6 + plan §4 step 8.
// Reads the admin cookie, deletes the matching `admin_sessions` row,
// clears the cookie, redirects to `/admin/login`. Idempotent — if the
// cookie is absent, redirects without a DB write (no DELETE fired).
//
// Per §8.6: "Admin logout deletes the `admin_sessions` row …
// clears the `zugzwang_admin_session` cookie." No cross-type logout —
// participant logout has a separate action at src/server/auth/logout.ts.

const ADMIN_COOKIE_NAME = "zugzwang_admin_session";

export async function adminLogoutAction(): Promise<void> {
	const cookieStore = await cookies();
	const cookie = cookieStore.get(ADMIN_COOKIE_NAME);

	if (cookie?.value) {
		await db.execute(
			sql`DELETE FROM admin_sessions WHERE session_id = ${cookie.value}`,
		);
		cookieStore.delete({ name: ADMIN_COOKIE_NAME, path: "/admin" });
	}

	// TODO(ENGINE.6): writeAdminEvent('admin.signed_out', { sessionId: cookie?.value })
	redirect("/admin/login");
}
