import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.3 plan §1 + §7 + SPEC.2 §8.3 verbatim. This is the DIRECT
// construction-layer protection of INV-3 (comments side-bound at post-time)
// per SPEC.2 §14 row 3 clause (i). The session-gate is `databaseHooks.
// session.create.before` in the Better Auth config — it intercepts before
// any `sessions` row is written, reads `users.pseudonym` +
// `users.tos_accepted_at`, and throws `APIError("FORBIDDEN",
// "ONBOARDING_REQUIRED")` when either is NULL.
//
// CRITICAL: if this test asserts the wrong arm, a refactor that drops the
// session-gate would let a participant cookie issue before pseudonym
// assignment, and a subsequent Server Action could write a `comments` row
// with `side_at_post_time` referencing a missing `positions.side` — INV-3
// silently corrupted. Per plan §1: "if `session-gate.test.ts` is omitted
// or asserts the wrong arm... corrupting INV-3 silently."
//
// Substrate pattern: SCAFFOLD.4 vi.hoisted + vi.mock; clearAllMocks (not
// restoreAllMocks) per the spy-attached caveat at
// `tests/integration/idempotency-cache.integration.test.ts:80-85`.

// Mock the Drizzle client so the hook factory's `db.query.users.findFirst`
// is controllable per test. The session-gate factory takes `db` as input
// and returns the hook callback — we'll exercise the hook directly via the
// factory output.
const { mockDb } = vi.hoisted(() => ({
	mockDb: {
		query: {
			users: {
				findFirst: vi.fn(),
			},
		},
	},
}));

vi.mock("@/db/index", () => ({
	db: mockDb,
}));

// Mock the onboarding-ref signer so we can assert what payload the
// session-gate signs into the cookie on throw. Real HMAC isn't being
// tested here — `onboarding-ref.test.ts` covers the crypto round-trip.
const { mockSignOnboardingRef } = vi.hoisted(() => ({
	mockSignOnboardingRef: vi.fn(),
}));

vi.mock("@/server/auth/onboarding-ref", () => ({
	signOnboardingRef: mockSignOnboardingRef,
	verifyOnboardingRef: vi.fn(),
}));

import { createSessionGate } from "@/server/auth/session-gate";

beforeEach(() => {
	mockDb.query.users.findFirst.mockReset();
	mockSignOnboardingRef.mockReset();
	mockSignOnboardingRef.mockReturnValue("signed-onboarding-ref-token");
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("session-deferral hook (INV-3 construction-layer DIRECT)", () => {
	// === Plan §1 INV-3 test row 1 ===========================================

	it("session-gate::session-blocked-when-pseudonym-null", async () => {
		// Per SPEC.2 §8.3 lines 837-838 verbatim: if `pseudonym` is falsy,
		// throw APIError("FORBIDDEN", { message: "ONBOARDING_REQUIRED" }).
		// This is the INV-3 enforcement arm: a session would issue if the
		// hook didn't fire OR didn't throw on null pseudonym.
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		mockDb.query.users.findFirst.mockResolvedValueOnce({
			pseudonym: null,
			tosAcceptedAt: new Date("2026-05-15"),
		});

		const sessionGate = createSessionGate(mockDb as never);
		const session = { userId };

		await expect(
			sessionGate(session as never, {} as never),
		).rejects.toMatchObject({
			// Per SPEC.2 §8.3 verbatim: status "FORBIDDEN", body.message
			// "ONBOARDING_REQUIRED". The APIError shape comes from
			// better-auth (`@better-auth/core/error`); we assert the
			// status/message surface that the catch-all route handler
			// reads when deciding to emit the onboarding_ref cookie.
			status: "FORBIDDEN",
			body: { message: "ONBOARDING_REQUIRED" },
		});
	});

	// === Plan §1 INV-3 test row 2 ===========================================

	it("session-gate::session-blocked-when-tos-null", async () => {
		// Symmetric arm: pseudonym present, ToS NULL → still throw. This is
		// the F-AUTH-4 gate: a user who has consumed an identity_pool tuple
		// but hasn't accepted ToS still cannot be issued a participant
		// session. The Cancel-from-onboarding edge case (plan §6) lands here.
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		mockDb.query.users.findFirst.mockResolvedValueOnce({
			pseudonym: "RedFox001",
			tosAcceptedAt: null,
		});

		const sessionGate = createSessionGate(mockDb as never);
		const session = { userId };

		await expect(
			sessionGate(session as never, {} as never),
		).rejects.toMatchObject({
			status: "FORBIDDEN",
			body: { message: "ONBOARDING_REQUIRED" },
		});
	});

	// === Plan §1 INV-3 test row 3 ===========================================

	it("session-gate::session-issued-when-both-present", async () => {
		// Happy path: both fields set → hook returns the session unchanged
		// so Better Auth's session-INSERT proceeds. The return shape per
		// SPEC.2 §8.3 line 840 is `{ data: session }`.
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		const session = { userId, token: "session-token-32-char" };
		mockDb.query.users.findFirst.mockResolvedValueOnce({
			pseudonym: "RedFox001",
			tosAcceptedAt: new Date("2026-05-15"),
		});

		const sessionGate = createSessionGate(mockDb as never);
		const result = await sessionGate(session as never, {} as never);

		// Hook returns the session payload to allow the INSERT.
		// SPEC.2 §8.3 line 840 verbatim: `return { data: session };`.
		expect(result).toEqual({ data: session });
	});

	// === Plan §1 INV-3 test row 4 (also covers the "both null" arm) =========

	it("session-gate::session-blocked-when-user-row-missing", async () => {
		// Edge: race or stale userId where `users.findFirst` returns
		// undefined. SPEC.2 §8.3 line 837 reads `!u?.pseudonym ||
		// !u?.tosAcceptedAt` — the `?.` short-circuits to undefined which is
		// falsy → throws. Confirms the hook does NOT crash on missing-row;
		// it routes the user back to onboarding (no silent admission).
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		mockDb.query.users.findFirst.mockResolvedValueOnce(undefined);

		const sessionGate = createSessionGate(mockDb as never);
		const session = { userId };

		await expect(
			sessionGate(session as never, {} as never),
		).rejects.toMatchObject({
			status: "FORBIDDEN",
			body: { message: "ONBOARDING_REQUIRED" },
		});
	});

	// === Plan §7 row 5: APIError shape verbatim against SPEC.2 §8.3 =========

	it("session-gate::apierror-shape-matches-spec-2-section-8-3-verbatim", async () => {
		// SPEC.2 §8.3 line 838 verbatim:
		//   throw new APIError("FORBIDDEN", { message: "ONBOARDING_REQUIRED" });
		// The two values are byte-exact contract surfaces — the catch-all
		// route at `src/app/api/auth/[...all]/route.ts` matches on these
		// exact strings to decide whether to emit the onboarding_ref cookie
		// + redirect. A drift (e.g. "FORBIDDEN" → "UNAUTHORIZED" or
		// "ONBOARDING_REQUIRED" → "TOS_REQUIRED") would silently break the
		// onboarding routing. Assert both literally.
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		mockDb.query.users.findFirst.mockResolvedValueOnce({
			pseudonym: null,
			tosAcceptedAt: null,
		});

		const sessionGate = createSessionGate(mockDb as never);

		try {
			await sessionGate({ userId } as never, {} as never);
			throw new Error("expected APIError to be thrown");
		} catch (err: unknown) {
			const e = err as { status?: string; body?: { message?: string } };
			expect(e.status).toBe("FORBIDDEN");
			expect(e.body?.message).toBe("ONBOARDING_REQUIRED");
		}
	});

	// === Plan §1 INV-3 + plan §4 step 2: onboarding-ref cookie emission =====

	it("session-gate::onboarding-ref-signed-with-userid-on-throw", async () => {
		// Plan §4 step 2: on session-gate throw, the catch-all route's
		// APIError handler emits a signed `onboarding_ref` cookie carrying
		// `{ userId, exp }`. The session-gate is responsible for signing the
		// ref BEFORE the throw (or at least exposing the userId to the
		// catch-all so it can sign).
		//
		// Two plausible implementations:
		//   (a) session-gate calls `signOnboardingRef` and stashes the token
		//       on the APIError's body before throwing.
		//   (b) catch-all reads `session.userId` from the thrown error's
		//       context and signs.
		//
		// The plan §4 step 2 phrasing — "emits signed `onboarding_ref` cookie
		// carrying `{ userId }` matching the failed session attempt" —
		// permits either, but the userId MUST flow through. This test
		// asserts that `signOnboardingRef` is called with the failing
		// session.userId at some point in the rejection path. If the
		// implementation chooses path (b), `signOnboardingRef` won't be
		// called inside `createSessionGate` itself, and this test should be
		// moved to the catch-all route test file. Plan §7 explicitly puts
		// the assertion in session-gate.test.ts: "on throw, `onboarding_ref`
		// cookie issued with `{ userId }` matching the failed session
		// attempt" — so implementation (a) is the plan's intent.
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		mockDb.query.users.findFirst.mockResolvedValueOnce({
			pseudonym: null,
			tosAcceptedAt: null,
		});

		const sessionGate = createSessionGate(mockDb as never);

		await expect(
			sessionGate({ userId } as never, {} as never),
		).rejects.toBeDefined();

		// signOnboardingRef called with the failing userId, exp = now + 10
		// min (600s). Plan §3: 10-min TTL on the cookie.
		expect(mockSignOnboardingRef).toHaveBeenCalledTimes(1);
		const call = mockSignOnboardingRef.mock.calls[0]?.[0] as {
			userId: string;
			exp: number;
		};
		expect(call.userId).toBe(userId);

		// exp should be ~10 min from now (within a 5s tolerance for test
		// scheduling jitter). The `exp` is in seconds-since-epoch.
		const nowSec = Math.floor(Date.now() / 1000);
		expect(call.exp).toBeGreaterThanOrEqual(nowSec + 600 - 5);
		expect(call.exp).toBeLessThanOrEqual(nowSec + 600 + 5);
	});

	// === Plan §7 + §6 idempotent reentry semantics ==========================

	it("session-gate::reentry-after-pseudonym-set-still-blocked-if-tos-null", async () => {
		// Cancellation safety per SPEC.2 §8.3 line 849: a user who completed
		// F-AUTH-3 (pseudonym set) but cancelled at F-AUTH-4 (tos NULL)
		// reattempts sign-in. Hook sees pseudonym present, tos NULL, throws
		// → routes back to onboarding. Idempotent — no second pool
		// consumption needed. This test confirms the second-arm short-
		// circuit behaves correctly: it's the same FORBIDDEN throw, not a
		// different error type.
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		mockDb.query.users.findFirst.mockResolvedValueOnce({
			pseudonym: "RedFox001",
			tosAcceptedAt: null,
		});

		const sessionGate = createSessionGate(mockDb as never);

		await expect(
			sessionGate({ userId } as never, {} as never),
		).rejects.toMatchObject({
			status: "FORBIDDEN",
			body: { message: "ONBOARDING_REQUIRED" },
		});

		// signOnboardingRef called with the SAME userId on reentry — no
		// new user is created; only the cookie is reissued.
		expect(mockSignOnboardingRef).toHaveBeenCalledWith(
			expect.objectContaining({ userId }),
		);
	});
});
