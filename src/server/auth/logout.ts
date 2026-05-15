"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";

// F-AUTH-5 participant logout Server Action per SPEC.2 §8.6 + plan §4
// step 7 + §3 file map. Delegates to Better Auth's `auth.api.signOut`,
// which deletes the server-side `sessions` row + clears the
// `zugzwang_session` cookie. Then redirect to `/`.
//
// Per §8.7 pillar 6: this action MUST NOT read `zugzwang_admin_session`.
// Better Auth's signOut reads only its own cookie via the headers
// argument. This action does not call `cookies()` at all — the admin
// cookie surface never reaches the participant logout path.

export async function signOutAction(): Promise<void> {
	const headerStore = await headers();
	await auth.api.signOut({ headers: headerStore });
	// TODO(ENGINE.6): writeUserEvent('user.signed_out', { ... })
	redirect("/");
}
