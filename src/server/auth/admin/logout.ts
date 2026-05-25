"use server";

import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db";
import { insertEvent } from "@/server/events/insert";

// F-AUTH-5-ADMIN admin logout Server Action per SPEC.2 §8.6 + plan §4 step 8
// + ENGINE.6 §D.4 (admin.signed_out emission). Reads the admin cookie,
// wraps the DELETE in db.transaction so the events row commits atomically
// with the session deletion, clears the cookie OUTSIDE the tx (response-
// shaping), redirects. Idempotent — if the cookie is absent, redirects
// without opening a tx (no DELETE, no events row).
//
// `aggregate_id = cookie.value` — the admin_sessions.session_id UUIDv7 PK
// stored in the cookie at admin/login.ts:173-178. No RETURNING needed
// since the cookie IS the PK (per plan §D.4). The DELETE WHERE clause
// targets the same value; if a concurrent path already deleted the row
// (rare race), the DELETE is a 0-row no-op but the events row still
// records the logout intent — matches plan + test contract.
//
// `metadata.user_id = NULL`, `metadata.actor_id = 'admin-singleton'` per
// SPEC.2 §3.6 + S-F admin-actor encoding. `aggregate_type = 'admin_session'`
// (Phase 5 SPEC.2 §7.1 + §8.8 amendments).

const ADMIN_COOKIE_NAME = "zugzwang_admin_session";

export async function adminLogoutAction(): Promise<void> {
	const cookieStore = await cookies();
	const cookie = cookieStore.get(ADMIN_COOKIE_NAME);

	if (cookie?.value) {
		// ENGINE.6 §D.4: eventId per ADR-0016 D1 + plan V6, generated
		// inside the cookie-present branch (no eventId minted on the
		// no-cookie idempotent no-op path). metadata 7-field with admin-
		// actor encoding; ip + user_agent 'unknown' (S-C deferred
		// placeholders — HARDEN.* request-context middleware tightens
		// once available).
		const sessionId = cookie.value;
		const eventId = uuidv7();
		const metadata = {
			request_id: "unknown",
			flow_id: "F-AUTH-5-ADMIN",
			user_id: null,
			actor_id: "admin-singleton",
			idempotency_key: null,
			ip: "unknown",
			user_agent: "unknown",
		};

		await db.transaction(async (tx) => {
			await tx.execute(
				sql`DELETE FROM admin_sessions WHERE session_id = ${sessionId}`,
			);
			await insertEvent(tx, {
				eventId,
				eventType: "admin.signed_out",
				aggregateType: "admin_session",
				aggregateId: sessionId,
				payload: { sessionId },
				metadata,
			});
		});
		cookieStore.delete({ name: ADMIN_COOKIE_NAME, path: "/admin" });
	}

	redirect("/admin/login");
}
