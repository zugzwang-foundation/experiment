"use server";

import { eq, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db";
import { users } from "@/db/schema/auth";
import { auth } from "@/server/auth";
import { verifyOnboardingRef } from "@/server/auth/onboarding-ref";
import {
	PRIVACY_VERSION_HASH,
	TOS_VERSION_HASH,
} from "@/server/auth/tos-versions";
import { grantInitialDharma } from "@/server/dharma/grant";
import { insertEvent } from "@/server/events/insert";
import { safeCaptureException } from "@/server/observability/safe-capture";

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
// On success (AUTH-DBL-1 fix): AFTER the evidence tx has committed — never
// inside it, per I2 — issue the participant session via
// `auth.api.issueOnboardingSession` (src/server/auth/index.ts), then clear
// the `onboarding_ref` cookie and redirect to `/`. SPEC.1 §13 F-AUTH-4
// "Response: Session cookie issued. User redirected to the post-signup
// landing page" — previously this action redirected home WITHOUT a
// session, silently deferring issuance to a second, manual sign-in
// (AUTH-DBL-1). The gate PREDICATE this relies on (session-gate.ts) is
// unchanged — I1: the new call only succeeds because pseudonym +
// tos_accepted_at are now genuinely both set, exactly as the gate always
// required. If issuance itself fails for any reason, the fallback is the
// PRE-FIX behaviour (redirect home unauthenticated, sign in again) — never
// a crash on top of already-committed ToS evidence.
//
// ENGINE.13: the equal initial Dharma grant (ADR-0018 + SPEC.1 §10.1)
// joins the FIRST-ACCEPTANCE branch of this same transaction — after the
// 5-column UPDATE, before the `user.tos_accepted` emit (lock order
// users → dharma_ledger → events, R1a). The missing-row and tab-race
// branches `return` before the grant call, so neither path can write a
// grant row, a `dharma.granted` event, or any ledger state — the grant is
// once-per-user by construction; migration 0013's UNIQUE partial index is
// the loud-23505 storage backstop. R4a posture: this tx actually runs at
// READ COMMITTED with the `FOR UPDATE` row lock (lock-then-recheck) —
// SPEC.2 §3.5's SERIALIZABLE wording (and this file's older comments) is
// recorded drift, carried to the truth-up sweep; do NOT "fix" by adding
// `isolationLevel` without a proper retry loop (SSI would degrade the
// handled tab-race into a user-visible 40001). Grant safety is
// isolation-independent.

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
	// grantEventId minted at handler entry BESIDE eventId, both closed over,
	// NEVER regenerated per attempt (retry purity — ADR-0016 D1; the
	// ENGINE.12 creditEventId precedent). Minting order is load-bearing for
	// log chronology: events-row created_at derives from the UUIDv7 ms
	// prefix (insert.ts), so user.tos_accepted ≤ dharma.granted in the log
	// regardless of INSERT order inside the tx.
	const grantEventId = uuidv7();
	const metadata = {
		request_id: "unknown",
		flow_id: "F-AUTH-4",
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip,
		user_agent: ua,
	};

	// Whether a real users row was found (first-acceptance OR tab-race
	// no-op — either way there is a real user to issue a session for).
	// False only on the missing-row branch, where there is nobody to
	// create a session for. The transaction's own return value (not a
	// mutated closure variable) — no staleness hazard if a retry loop is
	// ever added here.
	const userExists = await db.transaction(async (tx) => {
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
		if (!row) return false; // User row missing — silent no-op
		if (row.tosAcceptedAt !== null) return true; // Tab-race idempotent no-op

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

		// ENGINE.13 R1a: the equal initial grant, on the first-acceptance
		// branch only — one dharma_ledger(initial_grant) row + one
		// events(dharma.granted) row, same tx, SAME metadata object as the
		// tos event (same flow F-AUTH-4, same self-actor). In-tx write order:
		// users (FOR UPDATE → UPDATE) → dharma_ledger → events — strictly.
		await grantInitialDharma(tx, { userId, grantEventId, metadata });

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
		return true;
	});

	// AUTH-DBL-1 — issue the session now that the evidence tx has
	// committed (I2: strictly after, never inside it). Re-derives the
	// userId from the SAME onboarding_ref token verified above — the
	// endpoint independently re-verifies it and re-runs the unchanged gate
	// predicate (I1) via a real `internalAdapter.createSession` call, so
	// this cannot grant a session to a still-unonboarded user. Best-effort:
	// on any failure, fall through to the pre-fix behaviour (redirect home
	// unauthenticated) rather than crash on top of already-committed ToS
	// evidence — the user can still sign in again manually.
	if (userExists) {
		try {
			// Built explicitly from the already-extracted `ip`/`ua` (not
			// `headerStore` itself — Better Auth constructs a real `Headers`
			// from whatever is passed here, which throws on `next/headers`'
			// `ReadonlyHeaders` in some runtimes) so the session/sign-in-event
			// IP+UA are real, not the empty-string default a headerless
			// in-process call would otherwise leave (SPEC.2 §3.7 — the
			// audit-trail fields are canonical, not best-effort).
			await auth.api.issueOnboardingSession({
				body: { onboardingRef: refToken },
				headers: new Headers({
					"x-forwarded-for": ip,
					"user-agent": ua,
				}),
			});
		} catch (err) {
			// Fail-open per SPEC.2 §17.5 (the AUDIT-FIX-B1 posture): never let
			// an observability call — or this best-effort session issuance
			// itself — take down a request that already committed real ToS
			// evidence. Routed through Sentry (not console.error alone) so a
			// silent regression back to the two-click bug this fix closes is
			// actually visible, not just locally logged.
			console.error("onboarding_session_issue_failed", err);
			safeCaptureException(err, {
				tags: { kind: "onboarding_session_issue_failed" },
			});
		}
	}

	// Clear the onboarding_ref cookie — ToS is now accepted; subsequent
	// sign-in attempts use the regular session-create path. Match the
	// emission Path so the browser actually clears it.
	cookieStore.delete({ name: ONBOARDING_REF_COOKIE, path: "/onboarding" });

	// Redirect to the post-signup landing page (SPEC.1 §13 F-AUTH-4
	// Response). The session cookie issued above (when issuance succeeded)
	// makes this an authenticated request from here on.
	redirect("/");
}
