import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import type { DbClient } from "@/db";
import { users } from "@/db/schema/auth";
import { signOnboardingRef } from "@/server/auth/onboarding-ref";

// 10-min TTL on the pre-session onboarding ref per plan §3 Q3 — the cookie
// `Max-Age=600` matches this. Inlined (not imported) so test mocks of the
// onboarding-ref module don't need to re-export the constant.
const ONBOARDING_REF_TTL_SECONDS = 600;

// Session-deferral hook per SPEC.2 §8.3 lines 824-851 verbatim. The
// construction-layer protection of INV-3 (comments side-bound at post-time)
// per SPEC.2 §14 row 3 clause (i).
//
// The hook intercepts before any `sessions` row is written, reads
// `users.pseudonym` + `users.tos_accepted_at`, and throws
// `APIError("FORBIDDEN", { message: "ONBOARDING_REQUIRED" })` when either is
// NULL. The byte-exact "FORBIDDEN" / "ONBOARDING_REQUIRED" strings are the
// contract surface the catch-all route at
// `src/app/api/auth/[...all]/route.ts` matches on to emit the signed
// `onboarding_ref` cookie + redirect to `/onboarding`.
//
// The hook signs the `onboarding_ref` token BEFORE throwing and attaches it
// to the APIError body so the catch-all can lift it into a `Set-Cookie`
// header without re-deriving the userId from the request context.

export function createSessionGate(db: DbClient) {
	return async (
		session: { userId: string },
		_ctx: unknown,
	): Promise<{ data: { userId: string } }> => {
		const user = await db.query.users.findFirst({
			where: eq(users.id, session.userId),
			columns: { pseudonym: true, tosAcceptedAt: true },
		});
		if (!user?.pseudonym || !user?.tosAcceptedAt) {
			const onboardingRef = signOnboardingRef({
				userId: session.userId,
				exp: Math.floor(Date.now() / 1000) + ONBOARDING_REF_TTL_SECONDS,
			});
			throw new APIError("FORBIDDEN", {
				message: "ONBOARDING_REQUIRED",
				onboardingRef,
			});
		}
		return { data: session };
	};
}
