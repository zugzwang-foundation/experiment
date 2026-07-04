import { afterEach, describe, expect, it } from "vitest";

import { markets, modActions, users } from "@/db/schema";
import { loadModerationAuditFeed } from "@/server/admin/moderation/audit-feed";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// UI.6 slice A — RED-first INTEGRATION proof for the read-only moderation audit
// loader against real Postgres. Seeds blocked + reactive-admin `mod_actions`
// rows + banned/active authors, then asserts `loadModerationAuditFeed`:
//   (b) returns ONLY the three gate-block reasons (excludes content_removed /
//       user_banned even when they are the NEWEST rows), ordered created_at desc;
//   (e) resolves author ban-state via the users join, and market via the markets
//       join; flags the image placeholder boolean WITHOUT leaking the r2 key.
//
// `loadModerationAuditFeed` runs through the real `@/db` client; the fixtures
// seed through `testDb`/`testClient` — both read DATABASE_URL, same Postgres.

const R2_KEY = "zugzwang-uploads/2026/06/blocked-xyz789.webp";

async function seedUser(args: {
	emailTag: string;
	pseudonym: string;
	banned: boolean;
}): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "UI.6 Audit User",
			email: `${args.emailTag}@example.com`,
			pseudonym: args.pseudonym,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			bannedAt: args.banned ? new Date("2026-06-18T11:00:01Z") : null,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedMarket(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "UI.6 Audit Market",
			status: "Open",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

describe("loadModerationAuditFeed — blocked-rows read surface", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["mod_actions", "markets", "users"]);
	});

	it("audit-feed::empty-state-returns-no-rows", async () => {
		expect(await loadModerationAuditFeed({ limit: 50 })).toEqual([]);
	});

	it("audit-feed::filters-to-blocked-reasons-orders-desc-and-joins (b/e)", async () => {
		const bannedUser = await seedUser({
			emailTag: "ui6-banned",
			pseudonym: "BannedBadger001",
			banned: true,
		});
		const activeUser = await seedUser({
			emailTag: "ui6-active",
			pseudonym: "ActiveAardvark002",
			banned: false,
		});
		const marketId = await seedMarket("ui6-audit-market");

		await testDb.insert(modActions).values([
			// EXCLUDED reactive-admin rows — deliberately the NEWEST, to prove the
			// reason filter (not just recency) drops them.
			{
				targetUserId: bannedUser,
				reason: "content_removed",
				verdict: null,
				categories: {},
				actorId: "admin-singleton",
				createdAt: new Date("2026-06-18T12:00:00Z"),
			},
			{
				targetUserId: bannedUser,
				reason: "user_banned",
				verdict: null,
				categories: {},
				actorId: "admin-singleton",
				createdAt: new Date("2026-06-18T08:00:00Z"),
			},
			// The three gate-block rows the viewer surfaces.
			{
				targetUserId: bannedUser,
				targetMarketId: marketId,
				reason: "track_a_autoban",
				verdict: "track_a",
				categories: { "sexual/minors": 0.97, sexual: 0.99 },
				blockedText: "auto-banned body",
				imageR2Key: R2_KEY,
				actorId: "system",
				createdAt: new Date("2026-06-18T11:00:00Z"),
			},
			{
				targetUserId: activeUser,
				targetMarketId: marketId,
				reason: "track_b_blocked",
				verdict: "track_b",
				categories: { harassment: 0.91 },
				blockedText: "blocked body",
				imageR2Key: null,
				actorId: "system",
				createdAt: new Date("2026-06-18T10:00:00Z"),
			},
			{
				targetUserId: activeUser,
				targetMarketId: marketId,
				reason: "sexual_minors_text_blocked",
				verdict: "track_b",
				categories: { "sexual/minors": 0.96 },
				blockedText: "carve-out body",
				imageR2Key: null,
				actorId: "system",
				createdAt: new Date("2026-06-18T09:00:00Z"),
			},
		]);

		const rows = await loadModerationAuditFeed({ limit: 50 });

		// (b) only the three blocked reasons, newest-first.
		expect(rows.map((r) => r.reason)).toEqual([
			"track_a_autoban",
			"track_b_blocked",
			"sexual_minors_text_blocked",
		]);
		for (const r of rows) {
			expect(r.reason).not.toBe("content_removed");
			expect(r.reason).not.toBe("user_banned");
		}

		// (e) ban-state via the users join.
		expect(rows[0]?.authorBanned).toBe(true);
		expect(rows[0]?.authorPseudonym).toBe("BannedBadger001");
		expect(rows[1]?.authorBanned).toBe(false);
		expect(rows[1]?.authorPseudonym).toBe("ActiveAardvark002");

		// market join.
		expect(rows[0]?.marketSlug).toBe("ui6-audit-market");
		expect(rows[0]?.marketTitle).toBe("UI.6 Audit Market");

		// image placeholder flag — true for the image row, false otherwise.
		expect(rows[0]?.hasBlockedImage).toBe(true);
		expect(rows[1]?.hasBlockedImage).toBe(false);

		// blocked_text rides into the admin view model.
		expect(rows[0]?.blockedText).toBe("auto-banned body");

		// (c) the r2 key never leaks into the returned view models.
		expect(JSON.stringify(rows)).not.toContain(R2_KEY);
	});

	it("audit-feed::respects-the-limit", async () => {
		const u = await seedUser({
			emailTag: "ui6-limit",
			pseudonym: "LimitLemur003",
			banned: false,
		});
		const m = await seedMarket("ui6-limit-market");
		await testDb.insert(modActions).values(
			Array.from({ length: 5 }, (_, i) => ({
				targetUserId: u,
				targetMarketId: m,
				reason: "track_b_blocked" as const,
				verdict: "track_b" as const,
				categories: { harassment: 0.5 },
				blockedText: `body ${i}`,
				actorId: "system",
				createdAt: new Date(`2026-06-18T1${i}:00:00Z`),
			})),
		);

		const rows = await loadModerationAuditFeed({ limit: 2 });
		expect(rows.length).toBe(2);
	});
});
