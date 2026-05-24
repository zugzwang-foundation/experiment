"use server";

import { eq, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db";
import { users } from "@/db/schema/auth";
import { verifyOnboardingRef } from "@/server/auth/onboarding-ref";
import {
	PRIVACY_VERSION_HASH,
	TOS_VERSION_HASH,
} from "@/server/auth/tos-versions";
import { insertEvent } from "@/server/events/insert";

// F-AUTH-4 ToS acceptance Server Action per SPEC.1 §13 + SPEC.2 §3.5 line
// 281 + plan §4 step 3. Verifies the signed `onboarding_ref` cookie, opens
// a SERIALIZABLE transaction, and writes 5-column acceptance evidence:
//
//   UPDATE users SET tos_accepted_at = now(),
//                    tos_version_hash, privacy_version_hash,
//                    tos_acceptance_ip, tos_acceptance_user_agent
//   WHERE id = $userId
//
// Tab-race idempotency: SELECT FOR UPDATE on the users row makes the
// second submission see `tos_accepted_at IS NOT NULL` and take the
// no-op branch (plan §6 + SPEC.1 line 703). Re-entry from Cancel-from-
// onboarding routes through the same SELECT — no INSERT to identity_pool
// or users (pool consumption is user.create.before's job, not this one).
//
// Failure arms:
//   - No / invalid / expired `onboarding_ref` cookie → redirect /sign-in
//   - Checkbox unchecked → return `{ ok: false, code:
//     "tos_acceptance_required" }` (server-side gate; UX-disabled
//     Continue is not the boundary)
//   - SERIALIZABLE conflict → Postgres aborts the loser; client retries
//
// On success: clear the `onboarding_ref` cookie + redirect to `/`. The
// next request hits Better Auth's session-create path; with
// `tos_accepted_at` now set, the session-deferral hook permits issuance.

const ONBOARDING_REF_COOKIE = "onboarding_ref";

type AcceptTosResult = { ok: false; code: "tos_acceptance_required" };

const TOS_ACCEPTANCE_REQUIRED: AcceptTosResult = {
	ok: false,
	code: "tos_acceptance_required",
};

function getIp(headerStore: { get: (name: string) => string | null }): string {
	const fwd = headerStore.get("x-forwarded-for");
	if (fwd) {
		const first = fwd.split(",")[0]?.trim();
		if (first) return first;
	}
	return "unknown";
}

function getUserAgent(headerStore: {
	get: (name: string) => string | null;
}): string {
	return headerStore.get("user-agent") ?? "unknown";
}

export async function acceptTosAction(
	formData: FormData,
): Promise<AcceptTosResult> {
	const cookieStore = await cookies();
	const refCookie = cookieStore.get(ONBOARDING_REF_COOKIE);
	const refToken = refCookie?.value;

	if (!refToken) {
		redirect("/sign-in");
	}

	const verified = verifyOnboardingRef(refToken);
	if (!verified) {
		redirect("/sign-in");
	}

	const userId = verified.userId;

	// Server-side checkbox gate. UX disables Continue until checked, but
	// this is the actual boundary — plan §4 step 3 + §3 API surface.
	if (formData.get("accepted") !== "true") {
		return TOS_ACCEPTANCE_REQUIRED;
	}

	const headerStore = await headers();
	const ip = getIp(headerStore);
	const ua = getUserAgent(headerStore);

	// eventId generated at handler entry per ADR-0016 D1 + ENGINE.6 plan
	// V6; reused across any SERIALIZABLE retry so the composite-PK
	// ON CONFLICT dedupes the events row on retry (LD-8 + LD-9).
	// metadata 7-field set per SPEC.2 §3.7; request_id 'unknown' is the
	// S-C deferral placeholder until HARDEN.* request-context middleware
	// populates at handler entry.
	const eventId = uuidv7();
	const metadata = {
		request_id: "unknown",
		flow_id: "F-AUTH-4",
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip,
		user_agent: ua,
	};

	await db.transaction(async (tx) => {
		// Per plan §5 failure mode #11 + SPEC.1 line 703: `SELECT … FOR
		// UPDATE` acquires a row-level lock so concurrent tabs serialize
		// through this point. The second tab BLOCKS on this SELECT until
		// the first tab's tx commits; on unblock it re-reads via
		// findFirst() below and sees `tos_accepted_at IS NOT NULL`, taking
		// the no-op branch. Issued as raw SQL (Drizzle RQB findFirst has
		// no `.for("update")` equivalent).
		await tx.execute(sql`SELECT 1 FROM users WHERE id = ${userId} FOR UPDATE`);

		const row = await tx.query.users.findFirst({
			where: eq(users.id, userId),
			columns: { id: true, pseudonym: true, tosAcceptedAt: true },
		});
		if (!row) return; // User row missing — silent no-op
		if (row.tosAcceptedAt !== null) return; // Tab-race idempotent no-op

		// Five-column acceptance evidence in one tx per SPEC.2 §3.5 line 281.
		// Raw SQL via tx.execute so the column-name surface is explicit and
		// asserted in tos.test.ts via regex on the issued SQL.
		await tx.execute(sql`
			UPDATE users
			SET tos_accepted_at = now(),
			    tos_version_hash = ${TOS_VERSION_HASH},
			    privacy_version_hash = ${PRIVACY_VERSION_HASH},
			    tos_acceptance_ip = ${ip},
			    tos_acceptance_user_agent = ${ua}
			WHERE id = ${userId}
		`);

		// ENGINE.6 §D.2: emission INSIDE the existing tx. Commits atomic
		// with the UPDATE — either both rows persist or neither (V3 sync
		// emission). Early-return branches above (missing user / tab-race
		// no-op) skip this emission as intended.
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
				userAgent: ua,
			},
			metadata,
		});
	});

	// Clear the onboarding_ref cookie — ToS is now accepted; subsequent
	// sign-in attempts use the regular session-create path. Match the
	// emission Path so the browser actually clears it.
	cookieStore.delete({ name: ONBOARDING_REF_COOKIE, path: "/onboarding" });

	// Next.js redirect — user is currently anonymous (no participant
	// cookie yet). Hitting `/` triggers middleware-or-page-level
	// redirect to `/sign-in` where the user re-authenticates; session-
	// gate now passes (pseudonym set + tos_accepted_at set). Two-click
	// UX trade-off documented; auto-re-sign-in deferred (not in plan).
	redirect("/");
}
