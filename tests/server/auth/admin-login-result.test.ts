import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ENGINE.15 S1 tests-first (charter file 5 — R-15.6 admin-login result-
// discarded loose thread). Isolated in a NEW file (NOT the existing
// admin-login.test.ts, which imports the REAL `adminLoginAction` — a vi.mock of
// it there would collide). Mocks the login action + next/navigation, then
// imports `submitAdminLogin` from the `(admin)/admin/login/page.tsx` wrapper.
//
// RED NOW: the S1 page wrapper still DISCARDS the `{ ok: false, code }` return
// (it `await`s `adminLoginAction(formData)` and ignores the result), so on a
// failed login `redirect` is NEVER called → the assertion below
// (`redirect("/admin/login?error=admin_login_invalid")`) fails on the
// ASSERTION (toHaveBeenCalledWith — got zero calls). S2 adds the ≤12-line
// result-surfacing fix.

const { mockAdminLoginAction } = vi.hoisted(() => ({
	mockAdminLoginAction: vi.fn(),
}));

vi.mock("@/server/auth/admin/login", () => ({
	adminLoginAction: mockAdminLoginAction,
}));

const { mockRedirect } = vi.hoisted(() => ({
	mockRedirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	redirect: mockRedirect,
}));

import { submitAdminLogin } from "@/app/(admin)/admin/login/page";

function loginFormData(password: string): FormData {
	const fd = new FormData();
	fd.append("password", password);
	return fd;
}

describe("submitAdminLogin wrapper surfaces the failure code (R-15.6)", () => {
	beforeEach(() => {
		mockAdminLoginAction.mockReset();
		mockRedirect.mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("admin-login-result::failed-login-redirects-with-error-code", async () => {
		mockAdminLoginAction.mockResolvedValueOnce({
			ok: false,
			code: "admin_login_invalid",
		});

		await submitAdminLogin(loginFormData("wrong-password"));

		// The wrapper no longer discards the result — a failed login surfaces
		// the code via a redirect query param the page renders.
		expect(mockRedirect).toHaveBeenCalledWith(
			"/admin/login?error=admin_login_invalid",
		);
	});
});
