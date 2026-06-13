import { beforeEach, describe, expect, it, vi } from "vitest";

// ENGINE.15 S5 security remediation — RED-first regression guards for the
// auditor HIGH (admin read-page Layer-2 bypass) + MEDIUM (non-uuid marketId →
// 500). These are HELPER-level tests (the page render isn't unit-testable);
// they pin requireAdminPage's null-session → redirect and requireUuidParam's
// non-uuid → notFound. RED against the import-resolution stub (no-op /
// returns-input); green once the real guards land.

const { mockRedirect, mockNotFound } = vi.hoisted(() => ({
	mockRedirect: vi.fn((_url: string) => {
		throw new Error("NEXT_REDIRECT");
	}),
	mockNotFound: vi.fn(() => {
		throw new Error("NEXT_NOT_FOUND");
	}),
}));

vi.mock("next/navigation", () => ({
	redirect: mockRedirect,
	notFound: mockNotFound,
}));

const { mockValidate } = vi.hoisted(() => ({ mockValidate: vi.fn() }));

vi.mock("@/server/auth/admin/validate", () => ({
	validateAdminSession: mockValidate,
}));

vi.mock("next/headers", () => ({
	cookies: () => ({ get: () => undefined }),
}));

import { requireAdminPage, requireUuidParam } from "@/server/admin/page-guards";

const VALID_UUID = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

describe("requireAdminPage — admin page Layer-2 gate (S5 remediation)", () => {
	beforeEach(() => {
		mockRedirect.mockClear();
		mockValidate.mockReset();
	});

	it("page-guard::no-session-redirects-to-login", async () => {
		mockValidate.mockResolvedValue(null);
		await requireAdminPage().catch(() => {}); // redirect() throws NEXT_REDIRECT
		expect(mockRedirect).toHaveBeenCalledWith("/admin/login");
	});

	it("page-guard::valid-session-does-not-redirect", async () => {
		mockValidate.mockResolvedValue({ sessionId: VALID_UUID });
		await requireAdminPage();
		expect(mockRedirect).not.toHaveBeenCalled();
	});
});

describe("requireUuidParam — non-uuid param → notFound (S5 remediation)", () => {
	beforeEach(() => {
		mockNotFound.mockClear();
	});

	it("page-guard::non-uuid-param-notfound", () => {
		try {
			requireUuidParam("not-a-uuid");
		} catch {
			// notFound() throws NEXT_NOT_FOUND
		}
		expect(mockNotFound).toHaveBeenCalled();
	});

	it("page-guard::valid-uuid-param-returns-and-no-notfound", () => {
		expect(requireUuidParam(VALID_UUID)).toBe(VALID_UUID);
		expect(mockNotFound).not.toHaveBeenCalled();
	});
});
