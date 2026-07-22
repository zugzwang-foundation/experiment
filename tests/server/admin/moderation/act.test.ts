import { and, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UI-6 slice S3(b) — RED-first DB-backed spec for the reactive Remove/Ban
// Server Action `moderateComment` (`src/server/admin/moderation/act.ts`, which
// is ABSENT: this file fails to RESOLVE that import, the documented
// pre-implementation red state per CLAUDE.md §5.6 tests-first).
//
// This REWRITES the superseded SCAFFOLD.16 scaffold WHOLESALE (plan §2.S3b
// R1/R2/R3 + §4 D-5). The prior file encoded an `approve`/`block`/
// `remove_pass_verdict` verdict model that mutated `comments.hidden_at` via
// `UPDATE comments`; ADR-0021 (held-queue removed) + ADR-0020 (Remove/Ban
// decoupled) supersede it, so NONE of that vocabulary survives here. The
// specified contract:
//   - `moderateComment({ commentId, action })`, action `'remove' | 'ban'`
//     (NO `remove_and_ban` — two independent axes, two audit rows, ADR-0020);
//   - Remove appends EXACTLY ONE `content_removed` mod_actions row (verdict
//     null) and writes NOTHING to `comments` (masking is read-side via
//     loadRemovedSet — Bucket-A append-only forbids a comments write);
//   - Ban appends ONE `user_banned` row + sets `users.banned_at` ONLY where it
//     was NULL, touching NO position / bet / ledger / comment (ADR-0021 —
//     "ban removes voice, not balance"; INV-1/2/3);
//   - NO events row, `EVENT_TYPES` stays 24 (plan D-6/R3);
//   - admin-session gate first (zero writes on reject).
//
// DB-BACKED against local Postgres :54322 (NOT `vi.mock("@/db")`). The
// admin-session mock recipe mirrors tests/server/admin/markets.test.ts: the
// real `requireAdminSession()` reads cookie `zugzwang_admin_session` via the
// mocked `next/headers`, then SELECTs a real `admin_sessions` row that
// `withAdminSession()` seeds through testClient.

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

const { mockCookiesGet, mockHeadersGet } = vi.hoisted(() => ({
	mockCookiesGet: vi.fn(),
	mockHeadersGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
	cookies: () => ({
		get: mockCookiesGet,
		set: vi.fn(),
		delete: vi.fn(),
	}),
	headers: () => ({
		get: mockHeadersGet,
	}),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

import {
	bets,
	comments,
	dharmaLedger,
	events,
	markets,
	modActions,
	positions,
	users,
} from "@/db/schema";
import { moderateComment } from "@/server/admin/moderation/act";
import { loadRemovedSet } from "@/server/debate-view/load-debate-view";
import { EVENT_TYPES } from "@/server/events/schemas";

import { testClient, testDb } from "../../../db/_fixtures/db";
import { truncateTables } from "../../../db/_fixtures/truncate";

const ADMIN_COOKIE_NAME = "zugzwang_admin_session";

/** Seed an admin_sessions row + point the cookie mock at it (valid session). */
async function withAdminSession(): Promise<string> {
	const sessionId = uuidv7();
	await testClient.unsafe(
		`INSERT INTO admin_sessions (session_id, issued_at, last_seen_at) VALUES ($1, now(), now())`,
		[sessionId],
	);
	mockCookiesGet.mockReturnValue({ name: ADMIN_COOKIE_NAME, value: sessionId });
	return sessionId;
}

/** No admin cookie present → the session gate must reject (no DB row). */
function withoutAdminSession(): void {
	mockCookiesGet.mockReturnValue(undefined);
}

let userSeq = 0;

/** Seed a participant author (unique pseudonym/email); banned_at optional. */
async function seedAuthor(opts?: { bannedAt?: Date }): Promise<string> {
	userSeq += 1;
	const [user] = await testDb
		.insert(users)
		.values({
			name: "UI6 S3 Author",
			email: `ui6-s3-${userSeq}-${Date.now()}@example.com`,
			pseudonym: `Ui6S3Author${userSeq}`,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			bannedAt: opts?.bannedAt ?? null,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedMarket(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "UI6 S3 Market",
			status: "Open",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

/** A bare comment (bet_id OMITTED — nullable; INV-1 is a W-1-tx concern). */
async function seedComment(args: {
	userId: string;
	marketId: string;
	body?: string;
}): Promise<string> {
	const [comment] = await testDb
		.insert(comments)
		.values({
			userId: args.userId,
			marketId: args.marketId,
			body: args.body ?? "argued commentary",
			sideAtPostTime: "YES",
		})
		.returning({ id: comments.id });
	return comment?.id ?? "";
}

/**
 * Read `users.banned_at` through the RAW postgres-js client (testClient), which
 * — unlike the Drizzle-wrapped testDb — preserves timestamptz→Date parsing, so
 * the "did not move" comparison is Date-vs-Date, not identity-string-vs-string.
 */
async function readBannedAt(userId: string): Promise<Date | null> {
	const rows = await testClient.unsafe<{ banned_at: Date | null }[]>(
		`SELECT banned_at FROM users WHERE id = $1`,
		[userId],
	);
	return rows[0]?.banned_at ?? null;
}

describe("UI-6 S3 moderateComment — reactive Remove/Ban (ADR-0020/0021)", () => {
	beforeEach(() => {
		mockCookiesGet.mockReset();
		mockHeadersGet.mockReset();
	});

	afterEach(async () => {
		await truncateTables(testClient, [
			"mod_actions",
			"dharma_ledger",
			"positions",
			"bets",
			"comments",
			"events",
			"admin_sessions",
			"markets",
			"users",
		]);
		vi.clearAllMocks();
	});

	// (1) Remove → EXACTLY ONE content_removed row, verdict null.
	it("moderate-comment::remove-appends-exactly-one-content-removed-row", async () => {
		await withAdminSession();
		const authorId = await seedAuthor();
		const marketId = await seedMarket("ui6-s3-remove-one");
		const commentId = await seedComment({ userId: authorId, marketId });

		const result = await moderateComment({ commentId, action: "remove" });

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable — asserted ok above");
		expect(result.data.action).toBe("remove");

		const rows = await testDb
			.select({
				id: modActions.id,
				reason: modActions.reason,
				verdict: modActions.verdict,
				targetCommentId: modActions.targetCommentId,
				targetMarketId: modActions.targetMarketId,
				categories: modActions.categories,
				actorId: modActions.actorId,
			})
			.from(modActions);

		expect(rows.length).toBe(1);
		expect(rows[0]?.reason).toBe("content_removed");
		expect(rows[0]?.verdict).toBeNull();
		expect(rows[0]?.targetCommentId).toBe(commentId);
		expect(rows[0]?.targetMarketId).toBe(marketId);
		expect(rows[0]?.categories).toEqual({});
		expect(rows[0]?.actorId).toBe("admin-singleton");
		// Semantic pin: the returned id IS the single appended row's id.
		expect(result.data.modActionId).toBe(rows[0]?.id);
	});

	// (2) Remove → ZERO writes to `comments` (Bucket-A append-only; the row is
	// byte-for-byte unchanged, nothing hidden/flipped/updated).
	it("moderate-comment::remove-writes-nothing-to-comments", async () => {
		await withAdminSession();
		const authorId = await seedAuthor();
		const marketId = await seedMarket("ui6-s3-comments-untouched");
		const commentId = await seedComment({
			userId: authorId,
			marketId,
			body: "keep me verbatim",
		});

		const before = await testDb.select().from(comments);

		const result = await moderateComment({ commentId, action: "remove" });
		expect(result.ok).toBe(true);

		const after = await testDb.select().from(comments);
		expect(after.length).toBe(1);
		expect(after).toEqual(before);
		expect(after[0]?.body).toBe("keep me verbatim");
		expect(after[0]?.id).toBe(commentId);
	});

	// (3) The removed comment is masked read-side via the EXISTING loadRemovedSet
	// path (the same gate the debate view uses).
	it("moderate-comment::remove-masks-comment-via-loadRemovedSet", async () => {
		await withAdminSession();
		const authorId = await seedAuthor();
		const marketId = await seedMarket("ui6-s3-remove-masks");
		const commentId = await seedComment({ userId: authorId, marketId });

		const before = await loadRemovedSet(testDb, [commentId]);
		expect(before.has(commentId)).toBe(false);

		const result = await moderateComment({ commentId, action: "remove" });
		expect(result.ok).toBe(true);

		const after = await loadRemovedSet(testDb, [commentId]);
		expect(after.has(commentId)).toBe(true);
		expect(after.size).toBe(1);
	});

	// (4) Ban → a user_banned row is appended AND banned_at is set — but ONLY
	// where it was NULL. A fresh author goes null→set; an already-banned author's
	// timestamp does NOT move (the WHERE banned_at IS NULL guard no-ops).
	it("moderate-comment::ban-appends-user-banned-row-and-sets-banned-at-only-where-null", async () => {
		await withAdminSession();
		const marketId = await seedMarket("ui6-s3-ban");

		// (i) fresh author — banned_at null → set.
		const freshAuthor = await seedAuthor();
		const freshComment = await seedComment({
			userId: freshAuthor,
			marketId,
		});

		expect(await readBannedAt(freshAuthor)).toBeNull();

		const r1 = await moderateComment({
			commentId: freshComment,
			action: "ban",
		});
		expect(r1.ok).toBe(true);
		if (!r1.ok) throw new Error("unreachable — asserted ok above");
		expect(r1.data.action).toBe("ban");

		expect(await readBannedAt(freshAuthor)).toBeInstanceOf(Date);

		const freshRows = await testDb
			.select({
				verdict: modActions.verdict,
				actorId: modActions.actorId,
				targetUserId: modActions.targetUserId,
				targetMarketId: modActions.targetMarketId,
			})
			.from(modActions)
			.where(
				and(
					eq(modActions.reason, "user_banned"),
					eq(modActions.targetUserId, freshAuthor),
				),
			);
		expect(freshRows.length).toBe(1);
		expect(freshRows[0]?.verdict).toBeNull();
		expect(freshRows[0]?.actorId).toBe("admin-singleton");
		expect(freshRows[0]?.targetMarketId).toBe(marketId);

		// (ii) already-banned author — banned_at must NOT move.
		const FIXED_BAN = new Date("2026-06-18T11:00:01.000Z");
		const bannedAuthor = await seedAuthor({ bannedAt: FIXED_BAN });
		const bannedComment = await seedComment({
			userId: bannedAuthor,
			marketId,
		});

		const bannedBefore = await readBannedAt(bannedAuthor);
		expect(bannedBefore).not.toBeNull();

		const r2 = await moderateComment({
			commentId: bannedComment,
			action: "ban",
		});
		expect(r2.ok).toBe(true);

		const bannedAfter = await readBannedAt(bannedAuthor);
		expect(bannedAfter?.getTime()).toBe(bannedBefore?.getTime());

		// The audit row is STILL appended (unconditional) even when the UPDATE
		// no-ops.
		const bannedRows = await testDb
			.select({ id: modActions.id })
			.from(modActions)
			.where(
				and(
					eq(modActions.reason, "user_banned"),
					eq(modActions.targetUserId, bannedAuthor),
				),
			);
		expect(bannedRows.length).toBe(1);
	});

	// (5) Ban → the author's PRIOR non-removed content STAYS VISIBLE (ban ≠
	// removal, ADR-0021): loadRemovedSet is empty for the author's other comment.
	it("moderate-comment::ban-leaves-prior-content-visible", async () => {
		await withAdminSession();
		const authorId = await seedAuthor();
		const marketId = await seedMarket("ui6-s3-ban-visible");
		const banThrough = await seedComment({
			userId: authorId,
			marketId,
			body: "ban trigger",
		});
		const other = await seedComment({
			userId: authorId,
			marketId,
			body: "prior argument",
		});

		const result = await moderateComment({
			commentId: banThrough,
			action: "ban",
		});
		expect(result.ok).toBe(true);

		// NEITHER the comment the ban was issued through NOR the author's other
		// comment is masked — ban removes voice, not past content.
		const removed = await loadRemovedSet(testDb, [banThrough, other]);
		expect(removed.size).toBe(0);
		expect(removed.has(other)).toBe(false);
	});

	// (6) Remove and Ban are INDEPENDENTLY invocable — neither implies the other.
	it("moderate-comment::remove-and-ban-are-independent", async () => {
		await withAdminSession();
		const marketId = await seedMarket("ui6-s3-independent");

		// Remove ALONE → no ban, no user_banned row.
		const authorA = await seedAuthor();
		const commentA = await seedComment({ userId: authorA, marketId });
		expect(
			(await moderateComment({ commentId: commentA, action: "remove" })).ok,
		).toBe(true);

		expect(await readBannedAt(authorA)).toBeNull();
		const userBannedForA = await testDb
			.select({ id: modActions.id })
			.from(modActions)
			.where(
				and(
					eq(modActions.reason, "user_banned"),
					eq(modActions.targetUserId, authorA),
				),
			);
		expect(userBannedForA.length).toBe(0);

		// Ban ALONE → no content_removed row, comment NOT masked.
		const authorB = await seedAuthor();
		const commentB = await seedComment({ userId: authorB, marketId });
		expect(
			(await moderateComment({ commentId: commentB, action: "ban" })).ok,
		).toBe(true);

		const contentRemovedForB = await testDb
			.select({ id: modActions.id })
			.from(modActions)
			.where(
				and(
					eq(modActions.reason, "content_removed"),
					eq(modActions.targetCommentId, commentB),
				),
			);
		expect(contentRemovedForB.length).toBe(0);
		expect((await loadRemovedSet(testDb, [commentB])).size).toBe(0);
	});

	// (7) ZERO writes to positions / bets / dharma_ledger across BOTH remove and
	// ban (a seeded position + bet + ledger row are untouched — INV-1/2/3).
	it("moderate-comment::no-writes-to-positions-bets-dharma-ledger", async () => {
		await withAdminSession();
		const authorId = await seedAuthor();
		const marketId = await seedMarket("ui6-s3-no-ledger-writes");
		const commentId = await seedComment({ userId: authorId, marketId });

		await testDb.insert(positions).values({
			userId: authorId,
			marketId,
			side: "YES",
			quantity: "7.000000000000000000",
		});
		await testDb.insert(dharmaLedger).values({
			userId: authorId,
			entryType: "initial_grant",
			amount: "0",
			balanceAfter: "500",
		});
		await testDb.insert(bets).values({
			userId: authorId,
			marketId,
			side: "YES",
			stake: "10",
			shareQuantity: "10",
			priceAtBet: "0.5",
			commentId,
		});

		const snapshot = async () => ({
			positions: (
				await testDb.select({ quantity: positions.quantity }).from(positions)
			).map((p) => p.quantity),
			bets: (await testDb.select({ id: bets.id }).from(bets)).length,
			ledger: (
				await testDb
					.select({ balanceAfter: dharmaLedger.balanceAfter })
					.from(dharmaLedger)
			).map((l) => l.balanceAfter),
		});

		const before = await snapshot();
		expect(before.positions.length).toBe(1);
		expect(before.bets).toBe(1);
		expect(before.ledger.length).toBe(1);

		expect((await moderateComment({ commentId, action: "remove" })).ok).toBe(
			true,
		);
		expect((await moderateComment({ commentId, action: "ban" })).ok).toBe(true);

		const after = await snapshot();
		// No insert, no update, no delete on any of the three tables.
		expect(after).toEqual(before);
	});

	// (8) The admin-session gate rejects with ZERO writes.
	it("moderate-comment::admin-session-gate-rejects-with-zero-writes", async () => {
		withoutAdminSession();
		const authorId = await seedAuthor();
		const marketId = await seedMarket("ui6-s3-no-session");
		const commentId = await seedComment({ userId: authorId, marketId });

		const rRemove = await moderateComment({ commentId, action: "remove" });
		expect(rRemove.ok).toBe(false);
		if (rRemove.ok) throw new Error("unreachable — asserted not-ok above");
		expect(rRemove.error.code).toBe("admin_session_required");

		const rBan = await moderateComment({ commentId, action: "ban" });
		expect(rBan.ok).toBe(false);
		if (rBan.ok) throw new Error("unreachable — asserted not-ok above");
		expect(rBan.error.code).toBe("admin_session_required");

		// Nothing written on either reject path.
		expect(
			(await testDb.select({ id: modActions.id }).from(modActions)).length,
		).toBe(0);
		expect(await readBannedAt(authorId)).toBeNull();
	});

	// (9) `events` is untouched across a remove and a ban, and EVENT_TYPES stays
	// 24 (reactive Remove/Ban mint NO event and NO new event type — plan D-6/R3).
	it("moderate-comment::events-untouched-and-event-types-stays-24", async () => {
		await withAdminSession();
		const authorId = await seedAuthor();
		const marketId = await seedMarket("ui6-s3-events-untouched");
		const commentId = await seedComment({ userId: authorId, marketId });

		const eventsBefore = (
			await testDb.select({ id: events.eventId }).from(events)
		).length;

		expect((await moderateComment({ commentId, action: "remove" })).ok).toBe(
			true,
		);
		expect((await moderateComment({ commentId, action: "ban" })).ok).toBe(true);

		const eventsAfter = (
			await testDb.select({ id: events.eventId }).from(events)
		).length;
		expect(eventsAfter).toBe(eventsBefore);
		expect(EVENT_TYPES.length).toBe(24);
	});
});
