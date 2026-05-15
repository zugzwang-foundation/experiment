import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.3 plan §4 step 6 + §5 failure-modes #9 + #10 + §7 — admin
// login Server Action at `src/server/auth/admin/login.ts`. **No Turnstile
// per Q1** (SPEC.1 §13 line 609). HMAC-SHA256 digest comparison via
// `crypto.timingSafeEqual` over equal-length 32-byte buffers (avoids the
// `RangeError` thrown when input length differs from env password length).
//
// 4 steps per plan §4 step 6:
//   1. checkRateLimit('adminLoginPerIp', ip) → deny → identical-401
//   2. HMAC-digest compare via createHmac('sha256', BETTER_AUTH_SECRET).digest()
//   3. On mismatch: dummy DB read + constant-time delay → identical-401
//   4. On match: SERIALIZABLE DELETE+INSERT admin_sessions + cookie set

const { mockCheckRateLimit, mockIpIdentifier } = vi.hoisted(() => ({
	mockCheckRateLimit: vi.fn(),
	mockIpIdentifier: vi.fn((ip: string) => ip),
}));

vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: mockCheckRateLimit,
	ipIdentifier: mockIpIdentifier,
}));

const { mockDb } = vi.hoisted(() => {
	const tx = {
		execute: vi.fn(),
		select: vi.fn(),
		insert: vi.fn(),
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

const { mockCookiesSet, mockHeadersGet } = vi.hoisted(() => ({
	mockCookiesSet: vi.fn(),
	mockHeadersGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
	cookies: () => ({
		get: vi.fn(),
		set: mockCookiesSet,
		delete: vi.fn(),
	}),
	headers: () => ({
		get: mockHeadersGet,
	}),
}));

// Fetch spy for the no-Turnstile assertion (Note 2).
const fetchSpy = vi.spyOn(globalThis, "fetch");

import { adminLoginAction } from "@/server/auth/admin/login";

beforeEach(() => {
	mockCheckRateLimit.mockReset();
	mockIpIdentifier.mockClear();
	mockDb.transaction.mockReset();
	mockDb.execute.mockReset();
	mockDb._tx.execute.mockReset();
	mockDb._tx.select.mockReset();
	mockDb._tx.insert.mockReset();
	mockDb._tx.delete.mockReset();
	mockCookiesSet.mockReset();
	mockHeadersGet.mockReset();
	fetchSpy.mockReset();
	mockDb.transaction.mockImplementation(
		(cb: (t: typeof mockDb._tx) => unknown) => cb(mockDb._tx),
	);
	process.env.ADMIN_PASSWORD = "correct-admin-password-32-bytes-min";
	process.env.BETTER_AUTH_SECRET = "test-better-auth-secret-32-bytes-min";
	mockHeadersGet.mockImplementation((h: string) => {
		if (h === "x-forwarded-for") return "1.2.3.4";
		return null;
	});
});

afterEach(() => {
	vi.clearAllMocks();
});

function fd(password: string): FormData {
	const f = new FormData();
	f.append("password", password);
	return f;
}

describe("Admin login Server Action (F-AUTH-ADMIN)", () => {
	// === Note 2 — assertion lives in admin-login.test.ts ====================

	it("admin-login::no-turnstile-fetch", async () => {
		// Plan Q1: drop Turnstile from F-AUTH-ADMIN per SPEC.1 §13 line 609.
		// The Server Action MUST NOT call Cloudflare siteverify at any
		// point. Confirm via fetch-spy assertion: no call to any
		// Cloudflare Turnstile URL anywhere in the login flow.
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: true,
			remaining: 9,
			reset: 0,
		});
		mockDb._tx.execute.mockResolvedValueOnce([
			{ session_id: "01234567-89ab-cdef-0123-456789abcdef" },
		]);

		try {
			await adminLoginAction(fd(process.env.ADMIN_PASSWORD as string));
		} catch {
			// redirect on success
		}

		// CRITICAL: no fetch to Cloudflare siteverify endpoint.
		const cloudflareFetches = fetchSpy.mock.calls.filter((c) => {
			const url = c[0];
			const urlStr = typeof url === "string" ? url : (url as URL).toString();
			return /cloudflare\.com|challenges\.cloudflare/.test(urlStr);
		});
		expect(cloudflareFetches.length).toBe(0);

		// Stronger assertion: fetch wasn't called at all during admin
		// login. Admin login is pure DB + crypto; no external HTTP.
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	// === Plan §4 step 6.1 + §5 failure-mode 9 ===============================

	it("admin-login::rate-limit-returns-identical-401", async () => {
		// Plan §4 step 6 step 1: rate-limit denied → return identical-401
		// `admin_login_invalid`. NOT a distinct rate-limit code; identical
		// to wrong-password to avoid information leak (plan §8.4 line 868).
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: false,
			retryAfter: 3600,
		});

		const result = await adminLoginAction(fd("any-password"));
		expect(result).toEqual({ ok: false, code: "admin_login_invalid" });

		// Rate-limit was called with admin-login surface key.
		expect(mockCheckRateLimit).toHaveBeenCalledWith(
			"adminLoginPerIp",
			"1.2.3.4",
		);

		// No transaction was opened on rate-limit denial.
		expect(mockDb.transaction).not.toHaveBeenCalled();
	});

	// === Plan §4 step 6.2 — wrong password identical-401 + dummy DB read ====

	it("admin-login::wrong-password-returns-identical-401-with-timing-parity", async () => {
		// Plan §4 step 6 step 3: on mismatch, run dummy `SELECT 1 FROM
		// admin_sessions LIMIT 1` + constant-time delay before returning.
		// Per SPEC.2 §8.4 step 3. The dummy DB read ensures wrong-password
		// path takes ~same time as right-password path (best-effort timing
		// parity; rate-limit is the actual brute-force protection).
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: true,
			remaining: 9,
			reset: 0,
		});
		// Dummy DB read returns something
		mockDb.execute.mockResolvedValueOnce([{ count: 0 }]);

		const result = await adminLoginAction(fd("wrong-password"));
		expect(result).toEqual({ ok: false, code: "admin_login_invalid" });

		// Dummy `SELECT 1 FROM admin_sessions LIMIT 1` ran. Asserted via
		// the mockDb.execute spy receiving a SELECT-shaped call.
		const allSql = mockDb.execute.mock.calls
			.map((c) => JSON.stringify(c[0]))
			.join(" ");
		expect(allSql).toMatch(/SELECT/i);
		expect(allSql).toMatch(/admin_sessions/i);

		// No cookie was set; no transaction opened.
		expect(mockCookiesSet).not.toHaveBeenCalled();
		expect(mockDb.transaction).not.toHaveBeenCalled();
	});

	// === Note 2 — HMAC-digest length-safe compare ===========================

	it("admin-login::password-shorter-than-env-does-not-throw", async () => {
		// Plan §4 step 6 step 2 + plan-review feedback: `crypto.timingSafe
		// Equal` throws `RangeError` when buffers have different lengths.
		// The implementation MUST hash both sides via createHmac to
		// produce equal-length 32-byte buffers before comparing. Per Note
		// 2 in the kickoff:
		//   ```
		//   const inputDigest  = createHmac('sha256', key).update(input).digest();
		//   const expectedDig  = createHmac('sha256', key).update(env).digest();
		//   timingSafeEqual(inputDigest, expectedDig);  // always 32 bytes
		//   ```
		// Test: short, equal, and long inputs MUST NOT throw RangeError.
		// They MUST all return { ok: false, code: 'admin_login_invalid' }
		// since none match the env password.
		mockCheckRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 9,
			reset: 0,
		});
		mockDb.execute.mockResolvedValue([{ count: 0 }]);

		const cases = ["x", "short", "x".repeat(1000)];
		for (const password of cases) {
			let threw: unknown = null;
			let result: unknown;
			try {
				result = await adminLoginAction(fd(password));
			} catch (e) {
				threw = e;
			}
			// No RangeError. Result is the identical-401 shape.
			expect(threw).toBeNull();
			expect(result).toEqual({
				ok: false,
				code: "admin_login_invalid",
			});
		}
	});

	// === Plan §4 step 6.4 — right password issues cookie + replaces session =

	it("admin-login::right-password-replaces-admin-session-in-serializable-tx", async () => {
		// Plan §4 step 6 step 4: SERIALIZABLE DELETE+INSERT in single
		// transaction. Per SPEC.2 §8.4 line 860 + plan §4 step 6.4:
		// `DELETE FROM admin_sessions; INSERT INTO admin_sessions (...)
		// VALUES (uuidv7(), now(), now()) RETURNING session_id`. Then set
		// `zugzwang_admin_session` cookie.
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: true,
			remaining: 9,
			reset: 0,
		});
		mockDb._tx.execute
			.mockResolvedValueOnce([]) // DELETE
			.mockResolvedValueOnce([
				{ session_id: "01234567-89ab-cdef-0123-456789abcdef" },
			]); // INSERT … RETURNING

		try {
			await adminLoginAction(fd(process.env.ADMIN_PASSWORD as string));
		} catch {
			// redirect throw on success
		}

		expect(mockDb.transaction).toHaveBeenCalledTimes(1);

		// DELETE+INSERT issued.
		const allSql = mockDb._tx.execute.mock.calls
			.map((c) => JSON.stringify(c[0]))
			.join(" ");
		expect(allSql).toMatch(/DELETE.*admin_sessions/i);
		expect(allSql).toMatch(/INSERT.*admin_sessions/i);

		// Cookie set with correct attributes per SPEC.2 §8.5 + plan §4
		// step 6.4: HttpOnly, Secure, SameSite=Lax, Path=/admin, no
		// Max-Age (indefinite, host-only).
		expect(mockCookiesSet).toHaveBeenCalled();
		const cookieCall = mockCookiesSet.mock.calls[0] as [
			string,
			string,
			Record<string, unknown>,
		];
		expect(cookieCall[0]).toBe("zugzwang_admin_session");
		expect(cookieCall[1]).toBe("01234567-89ab-cdef-0123-456789abcdef");
		expect(cookieCall[2]).toMatchObject({
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/admin",
		});
		// CRITICAL: NO maxAge / no expires — indefinite per SPEC.2 §8.5.
		expect(cookieCall[2].maxAge).toBeUndefined();
		expect(cookieCall[2].expires).toBeUndefined();
	});

	// === Plan §6 + SPEC.1 line 736 — concurrent admin login revokes prior ===

	it("admin-login::concurrent-admin-login-revokes-prior-session", async () => {
		// SPEC.1 line 736 + plan §6 edge: admin signs in on tab B while
		// tab A holds a session. The DELETE preceding the INSERT in the
		// SERIALIZABLE transaction revokes tab A's session row. Tab A's
		// next admin call sees no row → 401 → redirect to /admin/login.
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: true,
			remaining: 9,
			reset: 0,
		});
		mockDb._tx.execute
			.mockResolvedValueOnce([{ session_id: "PRIOR_SESSION" }]) // DELETE
			.mockResolvedValueOnce([{ session_id: "NEW_SESSION_UUID" }]); // INSERT

		try {
			await adminLoginAction(fd(process.env.ADMIN_PASSWORD as string));
		} catch {}

		// DELETE ran BEFORE INSERT — both in the same transaction.
		const calls = mockDb._tx.execute.mock.calls.map((c) =>
			JSON.stringify(c[0]),
		);
		const deleteIdx = calls.findIndex((c) => /DELETE.*admin_sessions/i.test(c));
		const insertIdx = calls.findIndex((c) => /INSERT.*admin_sessions/i.test(c));
		expect(deleteIdx).toBeGreaterThanOrEqual(0);
		expect(insertIdx).toBeGreaterThanOrEqual(0);
		expect(deleteIdx).toBeLessThan(insertIdx);
	});

	// === Plan §5 failure-mode #10 — ADMIN_PASSWORD env missing ==============

	it("admin-login::missing-admin-password-env-returns-identical-401", async () => {
		// Plan §5 failure-mode #10: `ADMIN_PASSWORD` env var missing → all
		// admin login attempts return identical-401. Module load detection
		// is the ideal arm; runtime check (graceful identical-401) is the
		// fallback. Either is acceptable per the plan.
		const original = process.env.ADMIN_PASSWORD;
		try {
			delete process.env.ADMIN_PASSWORD;
			mockCheckRateLimit.mockResolvedValueOnce({
				allowed: true,
				remaining: 9,
				reset: 0,
			});
			mockDb.execute.mockResolvedValueOnce([]);

			const result = await adminLoginAction(fd("anything"));
			// Either throws at module-load (caught here) OR returns the
			// identical-401 shape.
			expect(result).toEqual({ ok: false, code: "admin_login_invalid" });
		} finally {
			process.env.ADMIN_PASSWORD = original;
		}
	});

	// === Plan §5 failure-mode #9 — CVE-2025-29927 Layer 2 validator =========
	//
	// "tests/server/auth/admin-login.test.ts::layer2-validator-called-on-
	// bypassed-middleware (mocked)" per plan §5. This test belongs to
	// validate.test.ts conceptually but is enumerated in admin-login.test
	// per plan §5. We assert the Layer 2 validator surface — that
	// `validateAdminSession` exists and rejects on missing/invalid
	// cookie, regardless of any Layer 1 middleware bypass attempt.
	it("admin-login::layer2-validator-called-on-bypassed-middleware", async () => {
		// Import the validator lazily; it lives at
		// `src/server/auth/admin/validate.ts` per plan §3 file map.
		const { validateAdminSession } = await import(
			"@/server/auth/admin/validate"
		);

		// No cookie present → null.
		const noCookie = {
			get: vi.fn().mockReturnValue(undefined),
		} as unknown as Parameters<typeof validateAdminSession>[0];
		expect(await validateAdminSession(noCookie)).toBeNull();

		// Cookie value that doesn't match any admin_sessions row → null.
		mockDb.execute.mockResolvedValueOnce([]); // SELECT returns no rows
		const staleCookie = {
			get: vi.fn().mockReturnValue({
				name: "zugzwang_admin_session",
				value: "stale-uuid",
			}),
		} as unknown as Parameters<typeof validateAdminSession>[0];
		expect(await validateAdminSession(staleCookie)).toBeNull();
	});
});
