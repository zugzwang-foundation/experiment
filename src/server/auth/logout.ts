"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db";
import { auth } from "@/server/auth";
import { insertEvent } from "@/server/events/insert";

// F-AUTH-5 participant logout Server Action per SPEC.2 §8.6 + plan §4
// step 7 + §3 file map + ENGINE.6 §D.5 (V3 carve-out for user.signed_out).
// Delegates to Better Auth's `auth.api.signOut`, which deletes the
// server-side `sessions` row + clears the `zugzwang_session` cookie.
// Then redirect to `/`.
//
// Per §8.7 pillar 6: this action MUST NOT read `zugzwang_admin_session`.
// Better Auth's signOut reads only its own cookie via the headers
// argument. This action does not call `cookies()` at all — the admin
// cookie surface never reaches the participant logout path.
//
// ENGINE.6 §D.5 V3 carve-out (load-bearing, per the SPEC.2 §7
// amendment landing at Phase 5):
//
//   Better Auth's signOut owns the participant-session deletion in its
//   own internal transaction and exposes NO after-hook for events
//   emission. The `user.signed_out` events row therefore lands in a
//   SEPARATE post-commit micro-tx — V3's "synchronous emission in the
//   originating transaction" invariant CANNOT hold here. The accepted
//   tradeoff: a process crash between signOut and the emit-tx commit
//   leaves a session-deleted-with-no-event-row state. The orphan is
//   undetectable but operationally inert — session deletion is itself
//   idempotent (the user can log in again), and the audit-trail gap
//   for a single crashed logout has no consequence beyond a missing
//   log entry. This is the ONLY V3 carve-out across the ENGINE.6
//   migration sites.
//
// Sequence (load-bearing):
//   1. await auth.api.getSession({ headers })  — BEFORE signOut.
//      Captures userId from the live session. After signOut runs the
//      session row is deleted and the userId is unrecoverable.
//   2. await auth.api.signOut({ headers })     — Better Auth mutates.
//   3. if (userId): db.transaction(tx => insertEvent(tx, ...))
//      Post-commit micro-tx emits the audit row.
//   4. redirect('/')
//
// No-session path (double-click logout, already-signed-out call):
// getSession returns null → userId is null → signOut still runs
// (idempotent per Better Auth semantics) → emission skipped via the
// `if (userId)` guard → redirect. Zero events rows, zero side effects
// beyond the no-op signOut.

export async function signOutAction(): Promise<void> {
	const headerStore = await headers();
	const session = await auth.api.getSession({ headers: headerStore });
	const userId = session?.user?.id ?? null;
	await auth.api.signOut({ headers: headerStore });

	if (userId) {
		// ENGINE.6 §D.5: post-commit micro-tx per V3 carve-out (SPEC.2 §7
		// amendment, Phase 5). eventId generated per-handler-invocation
		// per ADR-0016 D1 + plan V6. metadata 7-field set with
		// user_id = actor_id = userId (self-actor per SPEC.2 §8.8);
		// request_id / ip / user_agent 'unknown' (S-C deferred placeholders
		// pending HARDEN.* request-context middleware).
		const eventId = uuidv7();
		const metadata = {
			request_id: "unknown",
			flow_id: "F-AUTH-5",
			user_id: userId,
			actor_id: userId,
			idempotency_key: null,
			ip: "unknown",
			user_agent: "unknown",
		};
		await db.transaction(async (tx) => {
			await insertEvent(tx, {
				eventId,
				eventType: "user.signed_out",
				aggregateType: "user",
				aggregateId: userId,
				payload: { userId },
				metadata,
			});
		});
	}

	redirect("/");
}
