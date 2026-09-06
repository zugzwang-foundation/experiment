/**
 * MOBILE-1 · Phase B — the one string ADR-0045's device gate says out loud.
 *
 * Founder-ratified and VERBATIM (MOBILE-1 Decisions received #5). ⚠ Do not
 * edit without a founder ruling: this is shipped copy for a public campaign,
 * not developer-facing text — the same rule `glossary.ts` states for the same
 * reason.
 *
 * ⛔ IT IS A CONSTANT BECAUSE IT HAS TWO CALL SITES. `/sign-in` and
 * `/sign-in/otp` both render it, and a message a visitor might see on either
 * page must not be able to say two different things depending on which one they
 * landed on. `tests/unit/auth/sign-in-device-gate.test.tsx` asserts the two
 * surfaces do not drift apart, which is only a property worth having while
 * there is exactly one source for it.
 *
 * ⚠ THE PHRASING IS DELIBERATE AND IS NOT A PROMISE. ADR-0045 excludes mobile
 * participants from this phase's identity system genuinely — "not a temporary
 * soft gate to be lifted once the responsive join flow is ready." So the line
 * states the present fact and stops; softening it into "not yet" or "coming
 * soon" would commit the experiment to something nobody ruled.
 */
export const MOBILE_AUTH_MESSAGE =
	"Sign-up only works on a computer right now.";
