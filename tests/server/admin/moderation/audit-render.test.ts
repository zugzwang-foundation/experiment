import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// UI.6 admin-fixes — the LIVE-RENDER regression guard the merged tests never
// had: it actually renders the Server Component against real seeded rows (the
// mocked suites only invoked the loader / greped source). Exercises the path
// that shipped the 500 unnoticed — and pins the real-data render shape.

vi.mock("@/server/admin/page-guards", () => ({
	requireAdminPage: vi.fn().mockResolvedValue(undefined),
}));

import ModerationAuditPage from "@/app/(admin)/admin/moderation/audit/page";
import { markets, modActions, users } from "@/db/schema";
import { testClient, testDb } from "../../../db/_fixtures/db";

async function render(): Promise<string> {
	return renderToStaticMarkup(await ModerationAuditPage());
}

describe("audit page — live render against real rows", () => {
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE mod_actions, markets, users CASCADE`);
	});

	it("audit-render::empty-result-renders-empty-state", async () => {
		const html = await render();
		expect(html).toContain("No blocked submissions recorded yet");
	});

	it("audit-render::blocked-rows-render-banned-placeholder-and-text", async () => {
		const [u] = await testDb
			.insert(users)
			.values({
				name: "r",
				email: "render@e.com",
				pseudonym: "RenderRaven777",
				tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
				bannedAt: new Date("2026-06-18T00:00:00Z"),
			})
			.returning({ id: users.id });
		const [m] = await testDb
			.insert(markets)
			.values({
				slug: "render-market",
				title: "Render Market",
				status: "Open",
				resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
			})
			.returning({ id: markets.id });
		await testDb.insert(modActions).values({
			targetUserId: u?.id,
			targetMarketId: m?.id,
			reason: "track_a_autoban",
			verdict: "track_a",
			categories: { "sexual/minors": 0.97, sexual: 0.99 },
			blockedText: "UNIQUE-BLOCKED-BODY-XYZ",
			imageR2Key: "uploads/blocked.webp",
			actorId: "system",
		});

		const html = await render();
		expect(html).toContain("Track A");
		expect(html).toContain("BANNED");
		expect(html).toContain("RenderRaven777");
		expect(html).toContain("Image withheld");
		expect(html).toContain("UNIQUE-BLOCKED-BODY-XYZ");
		// The r2 key never reaches the rendered HTML.
		expect(html).not.toContain("uploads/blocked.webp");
	});
});
