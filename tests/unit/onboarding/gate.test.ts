// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
	INTRO_SEEN_COOKIE,
	INTRO_SEEN_MAX_AGE_SEC,
	INTRO_SEEN_VALUE,
	shouldShowOnboardingDeck,
} from "@/server/onboarding/gate";

/**
 * O1-DECK — SPEC.1 §17 rows 1–3, the first-login gate.
 *
 * §21.9: "The deck renders when, and only when, BOTH hold: the viewer is
 * authenticated, and the seen-marker is absent." The `(public)` route group is
 * NOT middleware-gated (`proxy.ts` matches `/admin/*` only), so the
 * authenticated term is load-bearing rather than an optimisation — without it
 * the deck renders to the anonymous audience.
 *
 * WHY THESE THREE ARE A PURE PREDICATE AND NOT A LAYOUT RENDER. The caller,
 * `src/app/(public)/layout.tsx`, is an `async` server component and this repo
 * has no harness that renders one — `tests/unit/shell/not-found.test.tsx` is
 * the only page-component render on disk and it is synchronous. So the
 * DECISION is extracted and tested here directly, and the layout keeps one
 * readable call. That is this repo's own habit for gates
 * (`src/server/system/is-frozen.ts`, `src/server/auth/session-gate.ts`), and
 * the reason is recorded in SPEC.1 §21.9's Acceptance paragraph rather than
 * left to be rediscovered.
 */

const VIEWER = { pseudonym: "umber-falcon-31" };

describe("O1-DECK — the first-login gate", () => {
	it("onboarding-deck::renders-for-authenticated-viewer-without-marker", () => {
		expect(
			shouldShowOnboardingDeck({ viewer: VIEWER, marker: undefined }),
		).toBe(true);
	});

	it("onboarding-deck::absent-for-signed-out-visitor", () => {
		// The marker is IRRELEVANT when there is no viewer, and both values are
		// asserted: a predicate that only tested the marker would pass the first
		// of these and ship the deck to the anonymous audience.
		expect(shouldShowOnboardingDeck({ viewer: null, marker: undefined })).toBe(
			false,
		);
		expect(
			shouldShowOnboardingDeck({ viewer: null, marker: INTRO_SEEN_VALUE }),
		).toBe(false);
	});

	it("onboarding-deck::absent-when-marker-present", () => {
		expect(
			shouldShowOnboardingDeck({ viewer: VIEWER, marker: INTRO_SEEN_VALUE }),
		).toBe(false);
	});

	// A viewer mid-signup can hold a null pseudonym (the ADR-0004 session hook
	// refuses a session until it is non-NULL, so this is unreachable in
	// practice) — but the gate keys on the viewer's EXISTENCE, never on their
	// name, and that is what keeps Card 2's interpolation a render concern
	// rather than a gate one.
	it("gates on viewer existence, not on the pseudonym being populated", () => {
		expect(
			shouldShowOnboardingDeck({
				viewer: { pseudonym: null },
				marker: undefined,
			}),
		).toBe(true);
	});
});

/**
 * ADR-0037's cookie table, pinned. These are not §17 rows — they are the
 * regression guard on the three values the ADR fixes, so that moving one is a
 * deliberate edit to a test that says why rather than a silent drift.
 */
describe("O1-DECK — the ADR-0037 cookie contract", () => {
	it("names the cookie on the zugzwang_ application-cookie convention", () => {
		expect(INTRO_SEEN_COOKIE).toBe("zugzwang_intro_seen");
	});

	it("carries a VERSION TOKEN, not a boolean", () => {
		// ADR-0037: "A materially rewritten deck can be re-shown by minting `v2`."
		// The token is only a lever if the gate compares against it, which is why
		// `absent-when-marker-present` above passes the constant rather than a
		// bare truthy string.
		expect(INTRO_SEEN_VALUE).toBe("v1");
	});

	it("caps Max-Age at the 400-day ceiling, as its OWN constant", () => {
		// 400 days is the hard ceiling enforced by both the cookie serializer and
		// modern browsers (ADR-0004 P1), and ~8× the live window. Deliberately not
		// reused from the session's constant: two independent lifetimes that
		// happen to share a ceiling.
		expect(INTRO_SEEN_MAX_AGE_SEC).toBe(60 * 60 * 24 * 400);
	});
});
