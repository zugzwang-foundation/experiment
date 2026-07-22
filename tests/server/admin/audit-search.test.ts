import { afterEach, describe, expect, it } from "vitest";

import { adminEvents, markets, modActions, users } from "@/db/schema";
import { searchAuditLog } from "@/server/admin/moderation/audit-feed";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// UI-6 S4 tests-first (§2.S4 + §7 canonical path `audit-search.test.ts::
// query-by-date-action-market-user`) — F-ADMIN-5 audit-log SEARCH over BOTH
// `admin_events` AND `mod_actions` (A3). Each of the five predicates (date
// range, action type, market, user, pseudonym) narrows the unioned result; the
// user + pseudonym predicates naturally exclude `admin_events` (admin-actor
// rows carry no participant user). Empty filters = current behaviour
// (most-recent-first, capped). Leak-guard preserved: the r2 key is never
// surfaced (boolean `hasBlockedImage` only). DB-BACKED (:54322).
//
// RED-first: `searchAuditLog` does not exist yet → this file fails to resolve
// that import until S4 lands.

const R2_KEY = "u/some-user/blocked-abc123.webp";
let seq = 0;

async function seedUser(pseudonym: string, banned = false): Promise<string> {
	seq += 1;
	const [u] = await testDb
		.insert(users)
		.values({
			name: "UI6 S4 User",
			email: `ui6-s4-${seq}-${Date.now()}@example.com`,
			pseudonym,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			bannedAt: banned ? new Date("2026-06-18T00:00:00Z") : null,
		})
		.returning({ id: users.id });
	return u?.id ?? "";
}

async function seedMarket(slug: string): Promise<string> {
	const [m] = await testDb
		.insert(markets)
		.values({
			slug,
			title: `Market ${slug}`,
			status: "Open",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	return m?.id ?? "";
}

async function seedModAction(args: {
	reason:
		| "track_a_autoban"
		| "track_b_blocked"
		| "sexual_minors_text_blocked"
		| "content_removed"
		| "user_banned";
	userId?: string;
	marketId?: string;
	createdAt: Date;
	imageR2Key?: string;
}): Promise<void> {
	await testDb.insert(modActions).values({
		reason: args.reason,
		verdict: args.reason === "track_a_autoban" ? "track_a" : null,
		categories: {},
		actorId: args.reason.startsWith("track") ? "system" : "admin-singleton",
		targetUserId: args.userId ?? null,
		targetMarketId: args.marketId ?? null,
		imageR2Key: args.imageR2Key ?? null,
		createdAt: args.createdAt,
	});
}

async function seedAdminEvent(args: {
	eventType: string;
	marketId?: string;
	createdAt: Date;
}): Promise<void> {
	await testDb.insert(adminEvents).values({
		eventType: args.eventType,
		payload: args.marketId ? { marketId: args.marketId } : {},
		metadata: { actor_id: "admin-singleton", user_id: null },
		createdAt: args.createdAt,
	});
}

describe("searchAuditLog — F-ADMIN-5 search over admin_events + mod_actions (S4)", () => {
	afterEach(async () => {
		await truncateTables(testClient, [
			"mod_actions",
			"admin_events",
			"markets",
			"users",
		]);
	});

	it("audit-search::empty-filters-returns-both-sources-recent-first-capped", async () => {
		const marketId = await seedMarket("s4-empty");
		await seedModAction({
			reason: "track_b_blocked",
			marketId,
			createdAt: new Date("2026-06-10T01:00:00Z"),
		});
		await seedAdminEvent({
			eventType: "market.resolved",
			marketId,
			createdAt: new Date("2026-06-10T02:00:00Z"),
		});

		const rows = await searchAuditLog({});
		// Both sources present; newest-first.
		expect(rows.map((r) => r.source)).toEqual(["admin_event", "mod_action"]);
		expect(rows[0]?.actionType).toBe("market.resolved");

		// Cap respected.
		const capped = await searchAuditLog({ limit: 1 });
		expect(capped.length).toBe(1);
	});

	it("audit-search::date-range-narrows-both-sources", async () => {
		const marketId = await seedMarket("s4-date");
		await seedModAction({
			reason: "content_removed",
			marketId,
			createdAt: new Date("2026-06-01T00:00:00Z"),
		});
		await seedAdminEvent({
			eventType: "market.closed",
			marketId,
			createdAt: new Date("2026-06-20T00:00:00Z"),
		});

		const rows = await searchAuditLog({
			filters: {
				from: new Date("2026-06-15T00:00:00Z"),
				to: new Date("2026-06-25T00:00:00Z"),
			},
		});
		// Only the admin_event falls in the window; the mod_action is before it.
		expect(rows.length).toBe(1);
		expect(rows[0]?.source).toBe("admin_event");
		expect(rows[0]?.actionType).toBe("market.closed");
	});

	it("audit-search::action-type-matches-reason-or-event-type", async () => {
		const marketId = await seedMarket("s4-action");
		await seedModAction({
			reason: "user_banned",
			marketId,
			createdAt: new Date("2026-06-10T00:00:00Z"),
		});
		await seedAdminEvent({
			eventType: "market.resolved",
			marketId,
			createdAt: new Date("2026-06-11T00:00:00Z"),
		});

		const byReason = await searchAuditLog({
			filters: { actionType: "user_banned" },
		});
		expect(byReason.map((r) => r.actionType)).toEqual(["user_banned"]);

		const byEventType = await searchAuditLog({
			filters: { actionType: "market.resolved" },
		});
		expect(byEventType.map((r) => r.actionType)).toEqual(["market.resolved"]);
	});

	it("audit-search::market-narrows-both-sources", async () => {
		const target = await seedMarket("s4-target");
		const other = await seedMarket("s4-other");
		await seedModAction({
			reason: "content_removed",
			marketId: target,
			createdAt: new Date("2026-06-10T00:00:00Z"),
		});
		await seedAdminEvent({
			eventType: "market.closed",
			marketId: target,
			createdAt: new Date("2026-06-11T00:00:00Z"),
		});
		await seedModAction({
			reason: "content_removed",
			marketId: other,
			createdAt: new Date("2026-06-12T00:00:00Z"),
		});
		await seedAdminEvent({
			eventType: "market.closed",
			marketId: other,
			createdAt: new Date("2026-06-13T00:00:00Z"),
		});

		const rows = await searchAuditLog({ filters: { marketId: target } });
		// Both a mod_action AND an admin_event for the target market; none from other.
		expect(rows.length).toBe(2);
		expect(new Set(rows.map((r) => r.source))).toEqual(
			new Set(["mod_action", "admin_event"]),
		);
		for (const r of rows) expect(r.marketId).toBe(target);
	});

	it("audit-search::user-predicate-selects-mod-actions-only", async () => {
		const marketId = await seedMarket("s4-user");
		const user = await seedUser("TargetTiger777");
		await seedModAction({
			reason: "user_banned",
			userId: user,
			marketId,
			createdAt: new Date("2026-06-10T00:00:00Z"),
		});
		// An admin_event in the same window — must be EXCLUDED by a user filter.
		await seedAdminEvent({
			eventType: "market.resolved",
			marketId,
			createdAt: new Date("2026-06-10T03:00:00Z"),
		});

		const rows = await searchAuditLog({ filters: { userId: user } });
		expect(rows.length).toBe(1);
		expect(rows[0]?.source).toBe("mod_action");
		expect(rows[0]?.authorUserId).toBe(user);
	});

	it("audit-search::pseudonym-predicate-selects-mod-actions-only", async () => {
		const marketId = await seedMarket("s4-pseudo");
		const user = await seedUser("SearchableSeal909");
		const otherUser = await seedUser("UnrelatedUnicorn111");
		await seedModAction({
			reason: "content_removed",
			userId: user,
			marketId,
			createdAt: new Date("2026-06-10T00:00:00Z"),
		});
		await seedModAction({
			reason: "content_removed",
			userId: otherUser,
			marketId,
			createdAt: new Date("2026-06-11T00:00:00Z"),
		});
		await seedAdminEvent({
			eventType: "market.resolved",
			marketId,
			createdAt: new Date("2026-06-12T00:00:00Z"),
		});

		const rows = await searchAuditLog({
			filters: { pseudonym: "SearchableSeal909" },
		});
		expect(rows.length).toBe(1);
		expect(rows[0]?.source).toBe("mod_action");
		expect(rows[0]?.authorPseudonym).toBe("SearchableSeal909");
	});

	it("audit-search::never-leaks-the-raw-r2-key", async () => {
		const marketId = await seedMarket("s4-leak");
		await seedModAction({
			reason: "track_a_autoban",
			marketId,
			createdAt: new Date("2026-06-10T00:00:00Z"),
			imageR2Key: R2_KEY,
		});

		const rows = await searchAuditLog({});
		expect(JSON.stringify(rows)).not.toContain(R2_KEY);
		// The boolean placeholder is surfaced instead.
		expect(rows[0]?.hasBlockedImage).toBe(true);
	});
});
