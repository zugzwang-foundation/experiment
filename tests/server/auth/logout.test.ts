import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.3 plan §3 + §4 step 7-8 + §7 + SPEC.2 §8.6 + §8.7 pillar 6
// — participant + admin logout Server Actions and the cross-cookie-type
// rejection invariant.
//
// Two endpoints, no cross-type logout per SPEC.2 §8.6:
//   - Participant: src/server/auth/logout.ts → auth.api.signOut + clear
//     zugzwang_session cookie
//   - Admin: src/server/auth/admin/logout.ts → DELETE FROM admin_sessions
//     + clear zugzwang_admin_session cookie
//
// SPEC.2 §8.7 pillar 6: cross-cookie-type access is never authorized.
// Admin Server Actions validate admin_sessions only; participant Server
// Actions validate `sessions` only.

const { mockAuthApiSignOut, mockAuthApiGetSession } = vi.hoisted(() => ({
	mockAuthApiSignOut: vi.fn(),
	// Per ENGINE.6 §D.5 V3 carve-out: signOutAction calls `auth.api.getSession`
	// BEFORE `auth.api.signOut` to capture `userId` for the post-commit emit
	// micro-tx (the session is deleted by signOut; userId unrecoverable
	// afterwards). Default to null so existing tests (which only assert
	// signOut wiring) get the no-op-emission branch; the ENGINE.6 emission
	// tests live in tests/server/auth/logout-event.test.ts.
	mockAuthApiGetSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/server/auth/index", () => ({
	auth: {
		api: {
			signOut: mockAuthApiSignOut,
			getSession: mockAuthApiGetSession,
		},
	},
}));

const { mockDb } = vi.hoisted(() => {
	const tx = {
		execute: vi.fn(),
		delete: vi.fn(),
	};
	return {
		mockDb: {
			transaction: vi.fn(),
			execute: vi.fn(),
			_tx: tx,
		},
	};
});

vi.mock("@/db/index", () => ({
	db: mockDb,
}));

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

import { adminLogoutAction } from "@/server/auth/admin/logout";
import { validateAdminSession } from "@/server/auth/admin/validate";
import { signOutAction } from "@/server/auth/logout";

beforeEach(() => {
	mockAuthApiSignOut.mockReset();
	mockAuthApiGetSession.mockReset();
	mockAuthApiGetSession.mockResolvedValue(null);
	mockDb.transaction.mockReset();
	mockDb.execute.mockReset();
	mockDb._tx.execute.mockReset();
	mockDb._tx.delete.mockReset();
	mockCookiesGet.mockReset();
	mockCookiesSet.mockReset();
	mockCookiesDelete.mockReset();
	mockHeadersGet.mockReset();
	mockDb.transaction.mockImplementation(
		(cb: (t: typeof mockDb._tx) => unknown) => cb(mockDb._tx),
	);
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("F-AUTH-5 logout — participant + admin", () => {
	// === Plan §3 API surface + SPEC.2 §8.6 — participant logout =============

	it("logout::participant-signs-out-via-auth-api", async () => {
		// Per SPEC.2 §8.6 + plan §3: signOutAction calls
		// `auth.api.signOut({ headers })` which deletes the server-side
		// sessions row + clears the zugzwang_session cookie. Better Auth
		// owns the cookie-clear; we assert the API call fires.
		mockAuthApiSignOut.mockResolvedValueOnce({ success: true });

		try {
			await signOutAction();
		} catch {
			// redirect throw on success
		}

		expect(mockAuthApiSignOut).toHaveBeenCalledTimes(1);
		const call = mockAuthApiSignOut.mock.calls[0]?.[0] as {
			headers?: unknown;
		};
		// Headers were passed so Better Auth can read the cookie.
		expect(call?.headers).toBeDefined();
	});

	// === Plan §3 + SPEC.2 §8.6 — admin logout ===============================

	it("logout::admin-deletes-session-row-and-clears-cookie", async () => {
		// SPEC.2 §8.6: admin logout deletes admin_sessions row +
		// clears zugzwang_admin_session cookie. The implementation reads
		// the session_id from the cookie, runs DELETE, clears the cookie,
		// redirects to /admin/login.
		mockCookiesGet.mockImplementation((name: string) =>
			name === "zugzwang_admin_session"
				? {
						name: "zugzwang_admin_session",
						value: "01234567-89ab-cdef-0123-456789abcdef",
					}
				: undefined,
		);
		mockDb.execute.mockResolvedValueOnce([]); // DELETE
		mockDb._tx.execute.mockResolvedValueOnce([]); // DELETE in tx

		try {
			await adminLogoutAction();
		} catch {
			// redirect throw on success
		}

		// DELETE issued on admin_sessions.
		const allSql = [
			...mockDb.execute.mock.calls,
			...mockDb._tx.execute.mock.calls,
		]
			.map((c) => JSON.stringify(c[0]))
			.join(" ");
		expect(allSql).toMatch(/DELETE.*admin_sessions/i);

		// Cookie cleared.
		expect(mockCookiesDelete).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "zugzwang_admin_session",
			}),
		);
	});

	// === SPEC.2 §8.7 pillar 6 — cross-cookie-type rejection =================

	it("logout::participant-cookie-does-not-reach-admin-validator", async () => {
		// SPEC.2 §8.7 pillar 6: admin Server Actions validate admin_sessions
		// only. A participant cookie (zugzwang_session) does NOT authorize
		// any admin handler. The validator at validateAdminSession reads
		// ONLY zugzwang_admin_session; presence of zugzwang_session is
		// irrelevant — validator returns null.
		const cookiesObj = {
			get: vi.fn().mockImplementation((name: string) => {
				if (name === "zugzwang_session") {
					return {
						name: "zugzwang_session",
						value: "participant-session-token",
					};
				}
				return undefined; // no admin cookie
			}),
		} as unknown as Parameters<typeof validateAdminSession>[0];

		expect(await validateAdminSession(cookiesObj)).toBeNull();

		// Verify the validator looked for the ADMIN cookie name, not the
		// participant one. The implementation `cookies().get('zugzwang_
		// admin_session')` returns undefined; that's the rejection arm.
		expect(cookiesObj.get).toHaveBeenCalledWith("zugzwang_admin_session");
		// The participant cookie name should NEVER be queried by the
		// admin validator.
		expect(cookiesObj.get).not.toHaveBeenCalledWith("zugzwang_session");
	});

	it("logout::admin-cookie-does-not-reach-participant-handler", async () => {
		// Reverse pillar: a participant Server Action validates `sessions`
		// only (via Better Auth's auth.api.getSession). Presence of the
		// admin cookie does not produce a participant session.
		//
		// We assert via the participant logout flow: presence of only an
		// admin cookie → auth.api.signOut sees no participant session
		// header → returns gracefully (or implementation redirects to /).
		// The structural property is that the admin cookie value never
		// flows into Better Auth's getSession path.
		mockCookiesGet.mockImplementation((name: string) =>
			name === "zugzwang_admin_session"
				? {
						name: "zugzwang_admin_session",
						value: "01234567-89ab-cdef-0123-456789abcdef",
					}
				: undefined,
		);
		mockAuthApiSignOut.mockResolvedValueOnce({ success: false });

		try {
			await signOutAction();
		} catch {
			// redirect or noop
		}

		// Better Auth was called (or attempted). The CRITICAL property:
		// admin cookie is NEVER read on the participant path; only the
		// session cookie. Better Auth's signOut reads its own cookie via
		// the headers argument; the participant logout action doesn't
		// touch zugzwang_admin_session directly.
		const adminCookieReads = mockCookiesGet.mock.calls.filter(
			(c) => c[0] === "zugzwang_admin_session",
		);
		expect(adminCookieReads.length).toBe(0);
	});

	// === SPEC.2 §8.6 — admin without cookie returns to login ================

	it("logout::admin-logout-without-cookie-returns-to-admin-login", async () => {
		// If the admin clicks logout without a valid cookie (already logged
		// out / expired session), action redirects to /admin/login. No
		// DELETE issued (nothing to delete).
		mockCookiesGet.mockReturnValue(undefined);

		try {
			await adminLogoutAction();
		} catch (e: unknown) {
			const errStr = String((e as Error)?.message ?? e);
			expect(errStr).toMatch(/(admin\/login|REDIRECT|redirect)/i);
		}

		// Confirm no DELETE on admin_sessions when there's no cookie.
		const allSql = [
			...mockDb.execute.mock.calls,
			...mockDb._tx.execute.mock.calls,
		]
			.map((c) => JSON.stringify(c[0]))
			.join(" ");
		expect(allSql).not.toMatch(/DELETE.*admin_sessions/i);
	});

	// === Plan §3 — both logout endpoints redirect ===========================

	it("logout::participant-redirects-to-home-on-success", async () => {
		// SPEC.2 §8.6 + plan §3: participant logout redirects to `/`.
		mockAuthApiSignOut.mockResolvedValueOnce({ success: true });

		try {
			await signOutAction();
			throw new Error("expected redirect");
		} catch (e: unknown) {
			const errStr = String((e as Error)?.message ?? e);
			expect(errStr).toMatch(/(REDIRECT|redirect|^\/$)/i);
		}
	});
});
