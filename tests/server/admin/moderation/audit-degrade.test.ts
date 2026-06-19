import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// UI.6 admin-fixes — RED-first regression test for the `/admin/moderation/audit`
// 500 (Vercel digest 2374087621). Root cause in prod: migration 0016 was not
// applied, so the audit query hit `42703 column "reason" does not exist`, the
// Server Component threw, and Next returned a raw 500. NONE of the merged tests
// ever rendered the page or exercised a loader failure.
//
// The DEFENSE-IN-DEPTH fix: the page must catch a loader failure, log it, and
// render a clear admin error panel instead of throwing (a raw 500). This test
// renders the page with the loader forced to reject and asserts graceful
// degradation. RED before the fix (the page re-throws → render throws).
//
// (The real production fix is operational — apply the pending migrations — and
// is reported separately; this guards the code-level symptom.)

const { mockCapture } = vi.hoisted(() => ({ mockCapture: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: mockCapture }));

vi.mock("@/server/admin/page-guards", () => ({
	requireAdminPage: vi.fn().mockResolvedValue(undefined),
}));

const { mockLoadFeed } = vi.hoisted(() => ({ mockLoadFeed: vi.fn() }));
vi.mock("@/server/admin/moderation/audit-feed", () => ({
	loadModerationAuditFeed: mockLoadFeed,
}));

import ModerationAuditPage from "@/app/(admin)/admin/moderation/audit/page";

describe("audit page — graceful degradation on loader failure (P1 fix)", () => {
	beforeEach(() => {
		mockCapture.mockClear();
		mockLoadFeed.mockReset();
	});

	it("audit-degrade::loader-failure-renders-error-panel-not-500", async () => {
		// The exact prod failure shape: a missing-column Postgres error.
		const dbError = new Error('column "reason" does not exist');
		mockLoadFeed.mockRejectedValue(dbError);

		// Must NOT throw — the page catches and degrades.
		const element = await ModerationAuditPage();
		const html = renderToStaticMarkup(element);

		// A clear, admin-facing error panel (stable copy the operator can act on).
		expect(html).toContain("Moderation audit unavailable");
		// The failure is observable, not silently swallowed.
		expect(mockCapture).toHaveBeenCalledWith(dbError);
		// The raw DB error text is NOT leaked into the rendered page.
		expect(html).not.toContain('column "reason" does not exist');
	});

	it("audit-degrade::happy-path-still-renders-rows", async () => {
		// A non-failing loader still renders normally (the catch is failure-only).
		mockLoadFeed.mockResolvedValue([]);
		const html = renderToStaticMarkup(await ModerationAuditPage());
		expect(html).toContain("Blocked submissions");
		expect(html).not.toContain("Moderation audit unavailable");
	});
});
