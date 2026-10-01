import "server-only";

import { eq, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import { db } from "@/db";
import { users } from "@/db/schema/auth";
import {
	PRIVACY_VERSION_HASH,
	TOS_VERSION_HASH,
} from "@/server/auth/tos-versions";
import { grantInitialDharma } from "@/server/dharma/grant";
import { insertEvent } from "@/server/events/insert";

// F-AUTH-4's evidence transaction, lifted out of `acceptTosAction` so a
// caller with no browser request can run it (SEED-STAGING-1's synthetic
// participants). `acceptTosAction` still owns the cookie, the checkbox gate,
// session issuance and the redirect; this owns only what is written.
//
// ⛔ THIS FILE MUST NEVER CARRY "use server". Every export of a "use server"
// module becomes a publicly callable Server Action, and this function grants
// the initial Dharma to whatever userId it is handed. It lives here, behind
// `server-only`, precisely so it is not reachable from a browser —
// `tests/unit/auth/tos-accept-exports.test.ts` pins both halves.
//
// The body is moved, not rewritten: the lock-then-recheck on the users row,
// the five-column UPDATE, the grant on the first-acceptance branch only, and
// the `user.tos_accepted` emit, in that order (lock order users →
// dharma_ledger → events, ENGINE.13 R1a). The R4a isolation note in
// tos-accept.ts applies here unchanged: READ COMMITTED with FOR UPDATE, and
// grant safety does not depend on isolation.

export type TosAcceptanceMetadata = {
	request_id: string;
	flow_id: string;
	user_id: string;
	actor_id: string;
	idempotency_key: null;
	ip: string;
	user_agent: string;
};

/**
 * Returns false when the users row does not exist, true when acceptance was
 * recorded now OR had already been recorded (the tab-race no-op — no second
 * grant, no second event).
 */
export async function recordTosAcceptance(args: {
	userId: string;
	ip: string;
	userAgent: string;
	metadata: TosAcceptanceMetadata;
}): Promise<boolean> {
	const { userId, ip, userAgent, metadata } = args;
	// Minted once, before the transaction, never per attempt (ADR-0016 D1).
	// Order is load-bearing for log chronology: user.tos_accepted's id sorts
	// before dharma.granted's.
	const eventId = uuidv7();
	const grantEventId = uuidv7();

	return db.transaction(async (tx) => {
		await tx.execute(sql`SELECT 1 FROM users WHERE id = ${userId} FOR UPDATE`);

		const row = await tx.query.users.findFirst({
			where: eq(users.id, userId),
			columns: { id: true, pseudonym: true, tosAcceptedAt: true },
		});
		if (!row) return false;
		if (row.tosAcceptedAt !== null) return true;

		await tx.execute(sql`
			UPDATE users
			SET tos_accepted_at = now(),
			    tos_version_hash = ${TOS_VERSION_HASH},
			    privacy_version_hash = ${PRIVACY_VERSION_HASH},
			    tos_acceptance_ip = ${ip},
			    tos_acceptance_user_agent = ${userAgent}
			WHERE id = ${userId}
		`);

		await grantInitialDharma(tx, { userId, grantEventId, metadata });

		await insertEvent(tx, {
			eventId,
			eventType: "user.tos_accepted",
			aggregateType: "user",
			aggregateId: userId,
			payload: {
				userId,
				tosVersionHash: TOS_VERSION_HASH,
				privacyVersionHash: PRIVACY_VERSION_HASH,
				ip,
				userAgent,
			},
			metadata,
		});
		return true;
	});
}
