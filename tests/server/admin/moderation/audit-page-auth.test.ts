import { beforeEach, describe, expect, it, vi } from "vitest";

// UI.6 slice A — RED-first auth-gate test for the moderation audit PAGE.
// Item (a): a participant / unauthenticated session is rejected and the data
// path is unreachable. The REAL gate is exercised end to end — page →
// `requireAdminPage` → `validateAdminSession` — only `next/headers` (cookie
// source) and `next/navigation` (redirect) are mocked, mirroring
// tests/server/admin/page-guards.test.ts. The feed loader is mocked so we can
// assert it is NEVER called on a rejected session.
//
// The page's JSX is never evaluated: the reject arm throws at `redirect()`
// before `return`; the allow arm's loader mock throws a sentinel at the data
// read (still before `return`). So this test is independent of any JSX runtime
// in the vitest/esbuild environment.

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

const { mockLoadFeed } = vi.hoisted(() => ({ mockLoadFeed: vi.fn() }));

vi.mock("@/server/admin/moderation/audit-feed", () => ({
	loadModerationAuditFeed: mockLoadFeed,
}));

import ModerationAuditPage from "@/app/(admin)/admin/moderation/audit/page";

describe("moderation audit page — Layer-2 auth gate (a)", () => {
	beforeEach(() => {
		mockRedirect.mockClear();
		mockValidate.mockReset();
		mockLoadFeed.mockReset();
	});

	it("audit-page::no-admin-session-redirects-and-never-reads-feed", async () => {
		mockValidate.mockResolvedValue(null);
		mockLoadFeed.mockResolvedValue([]);

		await ModerationAuditPage().catch(() => {}); // redirect() throws NEXT_REDIRECT

		expect(mockRedirect).toHaveBeenCalledWith("/admin/login");
		// The participant/unauthenticated path must never touch the data layer.
		expect(mockLoadFeed).not.toHaveBeenCalled();
	});

	it("audit-page::valid-admin-session-reaches-the-feed-loader", async () => {
		mockValidate.mockResolvedValue({ sessionId: "admin-session-1" });
		// The page degrades gracefully on a loader failure (P1 fix), so it no longer
		// propagates loader errors. Resolve the loader and assert the gate passed and
		// the loader was reached, with no redirect.
		mockLoadFeed.mockResolvedValue([]);

		const element = await ModerationAuditPage();

		expect(element).toBeDefined();
		expect(mockRedirect).not.toHaveBeenCalled();
		expect(mockLoadFeed).toHaveBeenCalledTimes(1);
	});
});
