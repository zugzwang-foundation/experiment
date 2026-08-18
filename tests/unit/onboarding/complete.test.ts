// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * O1-DECK — the seen-marker WRITER. ⚠ THIS FILE CARRIES NO §17 ROW, BY DESIGN.
 *
 * It is a regression guard in the same class as `copy-drift.test.ts` — SPEC.2
 * §13.5 binds every name in an Acceptance block to the §17 catalogue, so naming
 * a file that asserts no row would put a name there with nothing to match it.
 * SPEC.1 is unamended and stays at 1.0.35.
 *
 * WHY UNIT AND NOT INTEGRATION. AGENTS.md §9 scopes the integration layer to
 * "any service-layer function that WRITES" — a row, a ledger entry, state a
 * later read depends on. `completeOnboardingDeckAction` writes none of those:
 * it is one decision and one `Set-Cookie`. There is no schema to exercise and
 * no transaction to observe, so a real Postgres would add minutes and prove
 * nothing this file does not. SPEC.2 §13.4 places by the behaviour under test,
 * and the behaviour under test is a branch.
 *
 * ⛔ WHY THIS FILE EXISTS AT ALL, stated plainly because it is the whole point.
 * The action is a Server Action passed as a prop into a client component, which
 * makes it callable by anyone who can load a public page. The only thing between
 * an anonymous caller and a written marker is one line — `if (!session) return;`
 * — and until this file landed, **deleting that line changed nothing**: the full
 * suite stayed green at 368 files and 3388 tests. A control that is correct today
 * and unguarded against tomorrow is the shape this repo distrusts most.
 *
 * ⚠ THE GUARD WAS PROVEN BY REVERSAL, not by being written first. It could not
 * be RED-first in the ordinary sense — the behaviour it asserts already shipped,
 * so a correct test of it is green on the first run and that green says nothing.
 * The red was manufactured instead: with these tests passing, `if (!session)
 * return;` was deleted, the signed-out case went RED, and the line was restored.
 * That reversal is this file's evidence that it can fail, and it is the same
 * discipline `no-raw-hex-view-layer.test.ts` records for its own enrolment.
 */

const { mockGetSession, mockCookieSet, mockHeaders } = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockCookieSet: vi.fn(),
	mockHeaders: vi.fn(() => ({ get: () => null })),
}));

vi.mock("@/server/auth", () => ({
	auth: { api: { getSession: mockGetSession } },
}));

vi.mock("next/headers", () => ({
	headers: mockHeaders,
	cookies: () => ({ set: mockCookieSet }),
}));

import { completeOnboardingDeckAction } from "@/server/onboarding/complete";
import {
	INTRO_SEEN_COOKIE,
	INTRO_SEEN_MAX_AGE_SEC,
	INTRO_SEEN_VALUE,
} from "@/server/onboarding/gate";

afterEach(() => {
	vi.clearAllMocks();
});

describe("O1-DECK — the marker writer refuses a signed-out caller", () => {
	it("writes NOTHING when getSession returns null", async () => {
		mockGetSession.mockResolvedValue(null);

		const result = await completeOnboardingDeckAction();

		// ⛔ THE ASSERTION THIS ENTIRE FILE EXISTS FOR. A marker minted for a
		// browser that never had a session would suppress the first-login gate
		// for whoever signs in on it later — the one showing §21.9 makes
		// non-dismissible, silently skipped for a real participant.
		expect(mockCookieSet).not.toHaveBeenCalled();

		// A no-op, not an error: the caller is told nothing and nothing throws.
		expect(result).toBeUndefined();
	});

	it("still reads the session server-side rather than trusting the caller", async () => {
		mockGetSession.mockResolvedValue(null);

		await completeOnboardingDeckAction();

		// The action takes no arguments, so the session is the ONLY input it has.
		// If this stopped being called, the branch above would have nothing to
		// branch on.
		expect(mockGetSession).toHaveBeenCalledTimes(1);
	});
});

describe("O1-DECK — the marker writer, signed in", () => {
	it("sets the cookie exactly once, with ADR-0037's attributes", async () => {
		mockGetSession.mockResolvedValue({
			user: { id: "01930000-0000-7000-8000-000000000001" },
		});

		const result = await completeOnboardingDeckAction();

		expect(mockCookieSet).toHaveBeenCalledTimes(1);

		// ⚠ THE OPTIONS OBJECT IS MATCHED WHOLE, not field by field. An added
		// option — `domain`, a widened `sameSite` — fails here, which a set of
		// per-field assertions would wave through.
		expect(mockCookieSet).toHaveBeenCalledWith(
			INTRO_SEEN_COOKIE,
			INTRO_SEEN_VALUE,
			{
				httpOnly: true,
				secure: true,
				sameSite: "lax",
				path: "/",
				maxAge: INTRO_SEEN_MAX_AGE_SEC,
			},
		);

		expect(result).toBeUndefined();
	});

	it("and those constants are ADR-0037's literals, not just internally consistent", () => {
		// ⚠ WITHOUT THIS THE ASSERTION ABOVE IS CIRCULAR. Matching the call
		// against the same constants the call is built from passes no matter what
		// they hold — rename the cookie and both sides move together. The literals
		// are what tie the code to the ADR's table.
		expect(INTRO_SEEN_COOKIE).toBe("zugzwang_intro_seen");
		expect(INTRO_SEEN_VALUE).toBe("v1");
		expect(INTRO_SEEN_MAX_AGE_SEC).toBe(60 * 60 * 24 * 400);
	});

	it("takes no arguments, so no caller value can reach the cookie", () => {
		// The version token is a module constant. A client-supplied value would
		// let any caller write an arbitrary cookie value — harmless today, but a
		// needless input on a write path is how a write path acquires a real one.
		expect(completeOnboardingDeckAction.length).toBe(0);
	});
});
