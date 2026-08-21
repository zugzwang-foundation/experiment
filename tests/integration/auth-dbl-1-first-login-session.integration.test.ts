import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUTH-DBL-1 — first-login double sign-in regression guard.
//
// THE BUG: on a brand-new user's FIRST sign-in, `session.create.before`
// (createSessionGate, session-gate.ts) correctly throws ONBOARDING_REQUIRED
// (pseudonym set by F-AUTH-3, tos_accepted_at still NULL) and routes the
// user to /onboarding. Once the user ticks the box and presses Continue,
// `acceptTosAction` (tos-accept.ts) commits the five-column ToS-acceptance
// evidence + the initial Dharma grant in one transaction — but, on the
// unfixed code, NEVER creates a `sessions` row or issues the participant
// cookie. It just clears `onboarding_ref` and redirects to `/`, where the
// anonymous user bounces to /sign-in and must authenticate a SECOND time.
// SPEC.1 §13 F-AUTH-4 "Response: Session cookie issued. User redirected to
// the post-signup landing page" is violated. ADR-0004's own session-deferral
// section says session creation "re-attempts and succeeds" after F-AUTH-4 —
// that re-attempt was never wired up.
//
// This suite drives the REAL code path end-to-end against test Postgres:
// real `auth.api.signInEmailOTP` (real user.create.before pool consumption
// + real session-gate throw), then the REAL `acceptTosAction` with the
// SERVER-ISSUED onboardingRef token (no mocked verifyOnboardingRef — the
// HMAC round-trips for real). The ONLY mock is the Next.js cookie/header
// shell (`next/headers`), which AGENTS.md §9 sanctions as the sole
// mockable surface for a runner exercising a real write path.
//
// Test 1 is the negative control (V-2): proves the gate still blocks a
// premature session on a genuinely unonboarded user — this must stay RED
// (blocked) on BOTH the pre-fix and post-fix code; it is not what the fix
// changes.
// Test 2 is the decisive measurement: RED on the current code (no
// `sessions` row, no session Set-Cookie call), GREEN once `acceptTosAction`
// issues the session itself after the transaction commits.

const { mockCookiesGet, mockCookiesSet, mockCookiesDelete, mockHeadersGet } =
	vi.hoisted(() => ({
		mockCookiesGet: vi.fn(),
		mockCookiesSet: vi.fn(),
		mockCookiesDelete: vi.fn(),
		mockHeadersGet: vi.fn(),
	}));

vi.mock("next/headers", () => ({
	cookies: () => ({
		get: mockCookiesGet,
		set: mockCookiesSet,
		delete: mockCookiesDelete,
	}),
	headers: () => ({
		get: mockHeadersGet,
	}),
}));

import { identityPool, sessions, users, verifications } from "@/db/schema";
import { auth } from "@/server/auth/index";
import { acceptTosAction } from "@/server/auth/tos-accept";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// BETTER_AUTH_URL defaults to http://localhost:3000 (tests/_setup/env.ts) —
// Better Auth's secure-cookie-prefix auto-detection is protocol-driven, so
// the cookie name carries no `__Secure-` prefix here (the explicit
// `secure: true` cookie ATTRIBUTE in auth/index.ts is independent of the
// NAME prefix — see onboarded-login-session.integration.test.ts's own note).
const SESSION_COOKIE_NAME = "zugzwang_session";

const EMAIL = "auth-dbl-1-first-login@example.com";
const OTP_IDENTIFIER = `sign-in-otp-${EMAIL.toLowerCase()}`;
const OTP_CODE = "135790";

const SEED_COLOUR = "Amber";
const SEED_ANIMAL = "Otter";
const SEED_NUMBER = 1;
const SEED_PSEUDONYM = "AmberOtter001";
const SEED_PFP = "amberotter001.png";

async function truncateAll(): Promise<void> {
	await truncateTables(testClient, [
		"users",
		"accounts",
		"sessions",
		"identity_pool",
		"verifications",
		"events",
		"dharma_ledger",
	]);
}

async function seedTupleAndOtp(): Promise<void> {
	await testDb.insert(identityPool).values({
		colour: SEED_COLOUR,
		animal: SEED_ANIMAL,
		number: SEED_NUMBER,
		pseudonym: SEED_PSEUDONYM,
		pfpFilename: SEED_PFP,
		assignedAt: null,
	});
	await testDb.insert(verifications).values({
		identifier: OTP_IDENTIFIER,
		value: OTP_CODE,
		expiresAt: new Date(Date.now() + 10 * 60 * 1000),
	});
}

beforeEach(async () => {
	await truncateAll();
	await seedTupleAndOtp();
	mockCookiesGet.mockReset();
	mockCookiesSet.mockReset();
	mockCookiesDelete.mockReset();
	mockHeadersGet.mockReset();
});

afterEach(async () => {
	await truncateAll();
	vi.clearAllMocks();
});

function fd(accepted = true): FormData {
	const f = new FormData();
	f.append("accepted", accepted ? "true" : "false");
	return f;
}

describe("AUTH-DBL-1 — first-login double sign-in (F-AUTH-4 session issuance)", () => {
	it("auth-dbl-1::first-otp-verify-blocks-with-no-session-no-cookie [negative control]", async () => {
		// ACT — brand-new user's FIRST OTP verification. Real user.create.before
		// consumes the seeded tuple and assigns the pseudonym; real
		// session.create.before then sees tos_accepted_at NULL and throws.
		let caught: unknown;
		try {
			await auth.api.signInEmailOTP({ body: { email: EMAIL, otp: OTP_CODE } });
			throw new Error("expected ONBOARDING_REQUIRED to throw, call resolved");
		} catch (e) {
			caught = e;
		}

		const err = caught as {
			status?: string;
			body?: { message?: string; onboardingRef?: string };
		};
		expect(err.status).toBe("FORBIDDEN");
		expect(err.body?.message).toBe("ONBOARDING_REQUIRED");
		expect(typeof err.body?.onboardingRef).toBe("string");

		const userRows = await testDb
			.select()
			.from(users)
			.where(eq(users.email, EMAIL));
		expect(userRows.length).toBe(1);
		const user = userRows[0];
		expect(user?.pseudonym).toBe(SEED_PSEUDONYM);
		expect(user?.tosAcceptedAt).toBeNull();

		// DECISIVE MEASUREMENT (b) — no sessions row for this user yet. This
		// must hold both before AND after the fix — the gate predicate (I1)
		// never changes.
		const sessionRows = await testDb
			.select()
			.from(sessions)
			.where(eq(sessions.userId, user?.id ?? ""));
		expect(sessionRows.length).toBe(0);

		// No cookie of any kind was set on this blocked attempt.
		expect(mockCookiesSet).not.toHaveBeenCalled();
	});

	it("auth-dbl-1::tos-continue-issues-session-cookie-without-second-signin [decisive]", async () => {
		// Reach the same blocked state as test 1 — the REAL server-issued
		// onboardingRef is captured off the thrown APIError body, exactly as
		// the catch-all route (src/app/api/auth/[...all]/route.ts) does in
		// production. No mocked verifyOnboardingRef anywhere in this file.
		let caught: unknown;
		try {
			await auth.api.signInEmailOTP({ body: { email: EMAIL, otp: OTP_CODE } });
		} catch (e) {
			caught = e;
		}
		const err = caught as { body?: { onboardingRef?: string } };
		const onboardingRef = err.body?.onboardingRef;
		expect(typeof onboardingRef).toBe("string");

		const preRows = await testDb
			.select()
			.from(users)
			.where(eq(users.email, EMAIL));
		const userId = preRows[0]?.id;
		expect(userId).toBeTruthy();

		mockCookiesGet.mockImplementation((name: string) =>
			name === "onboarding_ref"
				? { name: "onboarding_ref", value: onboardingRef }
				: undefined,
		);
		mockHeadersGet.mockImplementation((h: string) => {
			if (h === "x-forwarded-for") return "203.0.113.9";
			if (h === "user-agent") return "Mozilla/5.0 (AUTH-DBL-1 test)";
			return null;
		});

		// ACT — Continue is pressed for real. acceptTosAction commits the
		// five-column evidence + initial grant, then (post-fix) issues the
		// session itself. Asserted as a REQUIRED throw (not a bare
		// try/catch) so a future change that makes `acceptTosAction`
		// resolve instead of redirect fails this test loudly rather than
		// silently skipping every assertion below it.
		await expect(acceptTosAction(fd())).rejects.toThrow(/NEXT_REDIRECT/);

		// DECISIVE MEASUREMENT (c) — the state the gate observed: both
		// preconditions are now satisfied.
		const after = await testDb
			.select()
			.from(users)
			.where(eq(users.id, userId ?? ""));
		expect(after[0]?.pseudonym).not.toBeNull();
		expect(after[0]?.tosAcceptedAt).not.toBeNull();

		// DECISIVE MEASUREMENT (b) — a sessions row exists for this user NOW,
		// on THIS request — not after a hypothetical second sign-in.
		const sessionRows = await testDb
			.select()
			.from(sessions)
			.where(eq(sessions.userId, userId ?? ""));
		expect(sessionRows.length).toBe(1);

		// DECISIVE MEASUREMENT (a) — the endpoint itself (the code this fix
		// adds) produces a real, correctly-attributed Set-Cookie for the
		// session it just created. This is asserted via a second,
		// explicit `returnHeaders:true` call rather than by observing
		// `nextCookies()`'s replay onto `next/headers`: that plugin's
		// `after` hook dynamically imports the literal specifier
		// `"next/headers.js"` and, finding no real Next.js request scope
		// under Vitest, hits its own documented "outside a request scope"
		// catch and no-ops (confirmed empirically — vi.mock("next/headers")
		// does not intercept that internal import). That relay is stock,
		// officially-shipped Better Auth/Next.js integration code (not
		// authored by this fix) exercised for real by the dev-server +
		// browser check in the root-cause report; what THIS test proves is
		// that the endpoint this fix adds emits a correct Set-Cookie at
		// all — the part that IS this fix's own code.
		const onboardingRefAgain = onboardingRef as string;
		const direct = (await auth.api.issueOnboardingSession({
			body: { onboardingRef: onboardingRefAgain },
			returnHeaders: true,
		})) as { headers: Headers };
		const setCookies = direct.headers.getSetCookie();
		const sessionLine = setCookies.find((c) =>
			c.startsWith(`${SESSION_COOKIE_NAME}=`),
		);
		expect(sessionLine).toBeDefined();
		expect(sessionLine).toMatch(/HttpOnly/);
		expect(sessionLine).toMatch(/Secure/);
		expect(sessionLine).toMatch(/SameSite=Lax/i);

		// ANTI-AMPLIFICATION (security-review finding, HIGH): `onboardingRef`
		// is deliberately not single-use (SPEC.1 §13 line 796's tab-race
		// no-op), so this endpoint is CALLED repeatedly with the same token
		// by design. It must REUSE the existing session, never mint a fresh
		// one per call — replaying it must not be able to grow `sessions`
		// (400-day rows) or the append-only `events` table without bound.
		const sessionRowsAfterSecondCall = await testDb
			.select()
			.from(sessions)
			.where(eq(sessions.userId, userId ?? ""));
		expect(sessionRowsAfterSecondCall.length).toBe(1);
		expect(sessionRowsAfterSecondCall[0]?.id).toBe(sessionRows[0]?.id);

		// The reuse path skips `internalAdapter.createSession` entirely, so
		// `session.create.after` (the sign-in event emit) never re-fires —
		// at most ONE `user.otp_signed_in` row for this user, not one per
		// replay.
		const signInEventRows = await testClient<{ count: string }[]>`
			SELECT COUNT(*)::text AS count FROM events
			WHERE event_type = 'user.otp_signed_in' AND aggregate_id = ${userId}
		`;
		expect(signInEventRows[0]?.count).toBe("1");
	});

	it("auth-dbl-1::next-cookies-plugin-is-last [structural pin]", () => {
		// The decisive test above can't observe `nextCookies()`'s replay
		// under Vitest (see its own comment on why), so nothing else in
		// this suite would catch `nextCookies()` being dropped or
		// reordered — a change that leaves every mocked/DB assertion green
		// while silently restoring the original two-click bug in a real
		// browser. Pin the ordering directly: Better Auth's own runtime
		// requires it last (`src/server/auth/index.ts`'s comment on the
		// `plugins:` array).
		const pluginIds = auth.options.plugins?.map((p) => p.id) ?? [];
		expect(pluginIds.at(-1)).toBe("next-cookies");
		expect(pluginIds).toContain("zugzwang-onboarding-session");
	});
});
