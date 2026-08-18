/**
 * The onboarding deck's first-login gate, and the ADR-0037 cookie contract.
 *
 * SPEC.1 §21.9: "The deck renders when, and only when, BOTH hold: the viewer
 * is authenticated, and the seen-marker is absent." The `(public)` route group
 * is NOT middleware-gated — `proxy.ts` matches `/admin/*` only — so every
 * surface there serves signed-out visitors, and the authenticated term is
 * load-bearing rather than an optimisation. Without it the deck renders to the
 * anonymous audience.
 *
 * WHY THIS IS A PURE PREDICATE AND NOT AN INLINE CONDITION IN THE LAYOUT.
 * `(public)/layout.tsx` is an `async` server component and this repo has no
 * harness that renders one, so a decision left inline is a decision no test can
 * reach. Extracted, the three §17 gate rows assert it directly and the layout
 * keeps one readable call. This is the repo's existing habit for gates
 * (`system/is-frozen.ts`, `auth/session-gate.ts`).
 *
 * ⚠ NO `server-only` IMPORT HERE, DELIBERATELY. This module touches no
 * database and no secret — it is a comparison and three constants. The
 * `server-only` guard marks modules that must never reach a client bundle
 * (AGENTS.md §7); applying it to a pure predicate would buy nothing and would
 * make the module's own unit test depend on the test-time shim.
 */

/** ADR-0037: matches the `zugzwang_` application-cookie convention. */
export const INTRO_SEEN_COOKIE = "zugzwang_intro_seen";

/**
 * ADR-0037: a VERSION TOKEN, not a boolean — "a materially rewritten deck can
 * be re-shown by minting `v2`".
 */
export const INTRO_SEEN_VALUE = "v1";

/**
 * ADR-0037: 400 days — the hard ceiling enforced by both the cookie serializer
 * and modern browsers, and ~8× the live window. Declared as ITS OWN constant
 * and deliberately not reused from the session's (ADR-0004 P1): two
 * independent lifetimes that happen to share a ceiling would be one lifetime
 * the moment someone edited the other.
 */
export const INTRO_SEEN_MAX_AGE_SEC = 60 * 60 * 24 * 400;

export type OnboardingGateInput = {
	/** The server-decided viewer. `null` for a signed-out visitor. */
	viewer: { pseudonym: string | null } | null;
	/** The raw `zugzwang_intro_seen` cookie value, or `undefined` if unset. */
	marker: string | undefined;
};

/**
 * ⚠ THE MARKER TERM COMPARES AGAINST THE CURRENT VERSION TOKEN, NOT MERE
 * PRESENCE — and that is the whole reason ADR-0037 chose a token over a
 * boolean. A presence test would leave a browser holding `v1` suppressed
 * forever, so minting `v2` for a materially rewritten deck would change
 * nothing and the "lever a boolean does not have" would not exist. The two
 * readings are indistinguishable today, because `v1` is the only value the
 * product ever writes; they diverge exactly once, on the day the lever is
 * pulled, and that is the day it must work.
 *
 * ⚠ THE GATE KEYS ON THE VIEWER'S EXISTENCE, NEVER ON THEIR NAME. A mid-signup
 * viewer can carry a null pseudonym; that is a render concern for Card 2's
 * interpolation, not a reason to withhold the rules from them.
 */
export function shouldShowOnboardingDeck({
	viewer,
	marker,
}: OnboardingGateInput): boolean {
	return viewer !== null && marker !== INTRO_SEEN_VALUE;
}
