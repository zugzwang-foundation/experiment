import { describe, expect, it } from "vitest";

// UI.6 slice A — RED-first unit tests for the PURE moderation-audit view layer
// (`@/server/admin/moderation/audit-view`). No IO: `toAuditRowView` /
// `topCategories` / `BLOCKED_REASONS` are pure, so this file imports neither
// `@/db` nor `server-only`. RED until audit-view.ts lands.
//
// Covers kickoff ritual items:
//   (b) blocked rows map to a render-ready view shape;
//   (c) an image-bearing row → `hasBlockedImage: true` and the view model NEVER
//       carries the r2 key or any url/src field — a viewable URL is structurally
//       impossible to produce downstream;
//   (e) `authorBanned` reflects `users.banned_at`.

import {
	BLOCKED_REASONS,
	type ModerationAuditRowRaw,
	toAuditRowView,
	topCategories,
} from "@/server/admin/moderation/audit-view";

const R2_KEY = "zugzwang-uploads/2026/06/blocked-abc123.webp";

function rawRow(
	overrides: Partial<ModerationAuditRowRaw> = {},
): ModerationAuditRowRaw {
	return {
		id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
		reason: "track_b_blocked",
		verdict: "track_b",
		createdAt: new Date("2026-06-18T10:00:00Z"),
		actorId: "system",
		categories: { harassment: 0.91, violence: 0.42, "sexual/minors": 0.05 },
		blockedText: "the rejected comment body",
		imageR2Key: null,
		targetUserId: "0190aaaa-bbbb-7ccc-8ddd-eeeeffff0000",
		targetMarketId: "0190mmmm-nnnn-7ooo-8ppp-qqqqrrrr0000",
		authorPseudonym: "CrimsonOtter042",
		authorBannedAt: null,
		marketSlug: "will-x-happen",
		marketTitle: "Will X happen by 2027?",
		...overrides,
	};
}

describe("BLOCKED_REASONS — the viewer's reason allow-list", () => {
	it("audit-view::blocked-reasons-are-exactly-the-three-gate-reasons", () => {
		expect([...BLOCKED_REASONS].sort()).toEqual(
			[
				"sexual_minors_text_blocked",
				"track_a_autoban",
				"track_b_blocked",
			].sort(),
		);
	});

	it("audit-view::blocked-reasons-exclude-reactive-admin-reasons", () => {
		expect(BLOCKED_REASONS).not.toContain("content_removed");
		expect(BLOCKED_REASONS).not.toContain("user_banned");
	});
});

describe("toAuditRowView — pure raw→view mapper", () => {
	it("audit-view::maps-blocked-row-to-render-ready-shape (b)", () => {
		const view = toAuditRowView(rawRow());
		expect(view.id).toBe("0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b");
		expect(view.reason).toBe("track_b_blocked");
		expect(view.verdict).toBe("track_b");
		expect(view.createdAt).toEqual(new Date("2026-06-18T10:00:00Z"));
		expect(view.actorId).toBe("system");
		expect(view.marketSlug).toBe("will-x-happen");
		expect(view.marketTitle).toBe("Will X happen by 2027?");
		expect(view.authorPseudonym).toBe("CrimsonOtter042");
		// blocked_text rides into the ADMIN view model (admin-gated render only).
		expect(view.blockedText).toBe("the rejected comment body");
	});

	it("audit-view::no-image-row-has-no-placeholder (c)", () => {
		const view = toAuditRowView(rawRow({ imageR2Key: null }));
		expect(view.hasBlockedImage).toBe(false);
	});

	it("audit-view::image-row-flags-placeholder-but-never-leaks-key-or-url (c)", () => {
		const view = toAuditRowView(rawRow({ imageR2Key: R2_KEY }));
		expect(view.hasBlockedImage).toBe(true);
		// The r2 key must NOT survive into the view model — only the boolean.
		expect(view).not.toHaveProperty("imageR2Key");
		expect(Object.keys(view)).toEqual(
			expect.not.arrayContaining([
				"imageR2Key",
				"imageUrl",
				"url",
				"src",
				"signedUrl",
			]),
		);
		// Belt-and-suspenders: the key value appears NOWHERE in the serialized VM.
		expect(JSON.stringify(view)).not.toContain(R2_KEY);
	});

	it("audit-view::author-banned-true-when-banned-at-set (e)", () => {
		const bannedAt = new Date("2026-06-18T09:59:00Z");
		const view = toAuditRowView(rawRow({ authorBannedAt: bannedAt }));
		expect(view.authorBanned).toBe(true);
		expect(view.authorBannedAt).toEqual(bannedAt);
	});

	it("audit-view::author-active-when-banned-at-null (e)", () => {
		const view = toAuditRowView(rawRow({ authorBannedAt: null }));
		expect(view.authorBanned).toBe(false);
		expect(view.authorBannedAt).toBeNull();
	});

	it("audit-view::tolerates-null-target-joins", () => {
		const view = toAuditRowView(
			rawRow({
				targetUserId: null,
				targetMarketId: null,
				authorPseudonym: null,
				marketSlug: null,
				marketTitle: null,
			}),
		);
		expect(view.authorUserId).toBeNull();
		expect(view.authorPseudonym).toBeNull();
		expect(view.authorBanned).toBe(false);
		expect(view.marketSlug).toBeNull();
	});
});

describe("topCategories — sorted score chips", () => {
	it("audit-view::top-categories-sorts-desc-and-limits", () => {
		const scores = { harassment: 0.91, violence: 0.42, "sexual/minors": 0.98 };
		const top = topCategories(scores, 2);
		expect(top).toEqual([
			{ name: "sexual/minors", score: 0.98 },
			{ name: "harassment", score: 0.91 },
		]);
	});

	it("audit-view::top-categories-tolerates-non-numeric-jsonb", () => {
		// jsonb is `unknown` at the type boundary — a malformed map must not throw.
		const top = topCategories(
			{ harassment: 0.5, junk: "nope" } as unknown as Record<string, number>,
			5,
		);
		expect(top).toEqual([{ name: "harassment", score: 0.5 }]);
	});
});
