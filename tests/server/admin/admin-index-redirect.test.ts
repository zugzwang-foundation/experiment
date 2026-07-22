import { beforeEach, describe, expect, it, vi } from "vitest";

// UI.6 S0 tests-first — the `/admin` index route (§2.S0). A Server Component
// that gates (requireAdminPage) then redirects to `/admin/moderation` (the
// Moderation default landing, SPEC.1 §15). Follows the `page-guards.test.ts`
// mock recipe: mock `next/navigation` (redirect throws NEXT_REDIRECT),
// `@/server/auth/admin/validate` (the Layer-2 session validator that
// requireAdminPage calls), and `next/headers` (cookies). The REAL
// requireAdminPage runs and drives the mocked redirect.
//
// RED until `src/app/(admin)/admin/page.tsx` lands (module-resolution error).

const { mockRedirect } = vi.hoisted(() => ({
	mockRedirect: vi.fn((_url: string) => {
		throw new Error("NEXT_REDIRECT");
	}),
}));

vi.mock("next/navigation", () => ({
	redirect: mockRedirect,
	notFound: vi.fn(() => {
		throw new Error("NEXT_NOT_FOUND");
	}),
}));

const { mockValidate } = vi.hoisted(() => ({ mockValidate: vi.fn() }));

vi.mock("@/server/auth/admin/validate", () => ({
	validateAdminSession: mockValidate,
}));

vi.mock("next/headers", () => ({
	cookies: () => ({ get: () => undefined }),
}));

// Imported after the mocks are registered.
const importPage = async () =>
	(await import("@/app/(admin)/admin/page")).default;

describe("/admin index — gate then redirect to Moderation (S0)", () => {
	beforeEach(() => {
		mockRedirect.mockClear();
		mockValidate.mockReset();
	});

	it("admin-index::authed-redirects-to-moderation", async () => {
		mockValidate.mockResolvedValue({
			sessionId: "00000000-0000-0000-0000-0000000000ad",
		});
		const AdminIndexPage = await importPage();
		// The page's own redirect("/admin/moderation") throws NEXT_REDIRECT.
		await (AdminIndexPage() as Promise<unknown>).catch(() => {});
		expect(mockRedirect).toHaveBeenCalledWith("/admin/moderation");
		expect(mockRedirect).not.toHaveBeenCalledWith("/admin/login");
	});

	it("admin-index::unauthed-redirects-to-login", async () => {
		mockValidate.mockResolvedValue(null);
		const AdminIndexPage = await importPage();
		// requireAdminPage() redirects to /admin/login BEFORE the page's own
		// redirect — the gate runs first.
		await (AdminIndexPage() as Promise<unknown>).catch(() => {});
		expect(mockRedirect).toHaveBeenCalledWith("/admin/login");
		expect(mockRedirect).not.toHaveBeenCalledWith("/admin/moderation");
	});
});
