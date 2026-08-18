"use server";

import { cookies, headers } from "next/headers";

import { auth } from "@/server/auth";

import {
	INTRO_SEEN_COOKIE,
	INTRO_SEEN_MAX_AGE_SEC,
	INTRO_SEEN_VALUE,
} from "./gate";

/**
 * Writes the onboarding deck's seen-marker. ADR-0037.
 *
 * ⚠ CALLED AT COMPLETION, NEVER AT OPEN. That single choice is what makes
 * abandonment safe by construction: a participant who closes the tab halfway
 * through has simply not completed the deck, and sees it again next visit. The
 * alternative — writing on open — would mean a participant who never read past
 * card one is recorded as having read the rules, which is the one outcome
 * §21.9's non-dismissibility exists to prevent.
 *
 * ⚠ NO ARGUMENTS, DELIBERATELY. The version token is a module constant, not a
 * parameter. There is nothing here a caller could usefully supply, and a
 * client-supplied value would let any caller write an arbitrary cookie value —
 * harmless today, but a needless input on a write path is how a write path
 * acquires a first real input later. No arguments also means no zod schema,
 * because there is nothing to validate.
 *
 * ⚠ NO RATE LIMIT. It is idempotent, writes no row, and costs one
 * `Set-Cookie`. Putting an Upstash round-trip on the completion of a
 * first-login modal would spend a network hop to protect nothing.
 *
 * A SIGNED-OUT CALLER IS A NO-OP rather than an error. The action is reachable
 * only from the first-login mount, which by construction has a viewer; the
 * re-check exists so that a stray call cannot mint a marker for a browser that
 * never had a session — which would suppress the gate for the human who later
 * signs in on it.
 *
 * ⛔ NO AUTH FILE IS EDITED. `cookies()` is available in any Server Action;
 * `src/server/auth/tos-accept.ts` establishes this exact shape in this
 * codebase and is read, not touched. ADR-0004's cookie file map is scoped to
 * Better Auth's `advanced.cookies` block and is not amended — as it was not
 * amended by `zugzwang_admin_session` or `onboarding_ref`, both of which
 * already sit outside it.
 *
 * ⚠ `Path=/` IS THE PARTICIPANT SCOPE AND IS READ CAREFULLY, NOT COPIED. The
 * near-miss on record is `(admin)/admin/markets/media/sign/route.ts`, where
 * broadening the ADMIN cookie to `/` would have leaked it to every participant
 * route. This cookie carries no identity, no session material and no secret —
 * its value is the literal string `v1` — and the admin cookie's `Path=/admin`
 * isolation is untouched by it.
 */
export async function completeOnboardingDeckAction(): Promise<void> {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) return;

	const cookieStore = await cookies();
	cookieStore.set(INTRO_SEEN_COOKIE, INTRO_SEEN_VALUE, {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/",
		maxAge: INTRO_SEEN_MAX_AGE_SEC,
	});
}
