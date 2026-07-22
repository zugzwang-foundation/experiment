import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

// UI-6 slice S3(a) — RED-first INTEGRATION spec for the live-content
// review-feed reader `loadReviewFeed` (`src/server/admin/moderation/
// review-feed.ts`, which is ABSENT: this file fails to RESOLVE that import,
// the documented pre-implementation red state per CLAUDE.md §5.6). DB-backed
// against local Postgres :54322.
//
// Contract (plan §2.S3a + §7): loadReviewFeed returns LIVE comments across ALL
// markets (NO market filter, NO ranking), newest-first by (created_at desc, id
// desc), EXCLUDING any comment carrying a `content_removed` mod_action (the
// SAME masking source of truth as loadRemovedSet, as a NOT EXISTS anti-join so
// the 200 cap applies to LIVE rows). A banned author's non-removed content
// STILL appears (ban ≠ removal, ADR-0021). Images are minted server-side via
// signRead(key, 60) — imageUrl is NEVER a raw R2 key.
//
// The R2 signer is mocked so URLs are deterministic and no creds are needed.
// The reader is PAGE-gated (requireAdminPage on /admin/moderation), NOT
// self-gated — mirroring the loadModerationAuditFeed reader precedent
// (tests/integration/admin-moderation-audit-feed.integration.test.ts calls the
// loader with NO admin-session mock), so no next/headers mock is needed here.

vi.mock("@/server/storage/sign-read", () => ({
	signRead: vi.fn(
		async (key: string, ttl: number) =>
			`https://signed.example/${encodeURIComponent(key)}?ttl=${ttl}`,
	),
}));

import {
	comments,
	dharmaLedger,
	imageUploads,
	markets,
	modActions,
	users,
} from "@/db/schema";
import {
	loadReviewFeed,
	REVIEW_FEED_CAP,
} from "@/server/admin/moderation/review-feed";

import { testClient, testDb } from "../../../db/_fixtures/db";
import { truncateTables } from "../../../db/_fixtures/truncate";

let seq = 0;

/** Seed a participant author + their genesis Dharma row (feed reads balance). */
async function seedAuthor(opts?: { bannedAt?: Date }): Promise<string> {
	seq += 1;
	const [user] = await testDb
		.insert(users)
		.values({
			name: "UI6 S3 Feed Author",
			email: `ui6-feed-${seq}-${Date.now()}@example.com`,
			pseudonym: `Ui6FeedAuthor${seq}`,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			bannedAt: opts?.bannedAt ?? null,
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	await testDb.insert(dharmaLedger).values({
		userId,
		entryType: "initial_grant",
		amount: "500",
		balanceAfter: "500",
	});
	return userId;
}

async function seedMarket(slug: string, title: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title,
			status: "Open",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

/** A live comment (bet_id OMITTED — nullable); createdAt drives feed order. */
async function seedComment(args: {
	userId: string;
	marketId: string;
	body: string;
	createdAt: Date;
	imageUploadsId?: string;
	parentCommentId?: string;
}): Promise<string> {
	const [comment] = await testDb
		.insert(comments)
		.values({
			userId: args.userId,
			marketId: args.marketId,
			body: args.body,
			sideAtPostTime: "YES",
			createdAt: args.createdAt,
			imageUploadsId: args.imageUploadsId ?? null,
			parentCommentId: args.parentCommentId ?? null,
		})
		.returning({ id: comments.id });
	return comment?.id ?? "";
}

async function seedImageUpload(userId: string, key: string): Promise<string> {
	const [row] = await testDb
		.insert(imageUploads)
		.values({
			userId,
			r2ObjectKey: key,
			contentType: "image/webp",
			byteSize: 12345,
		})
		.returning({ id: imageUploads.id });
	return row?.id ?? "";
}

/**
 * The reactive-removal write-side (fixture-bypass) — the SAME `content_removed`
 * row `moderateComment` appends, and the exact masking predicate the feed reads.
 */
async function removeComment(
	commentId: string,
	marketId: string,
): Promise<void> {
	await testDb.insert(modActions).values({
		reason: "content_removed",
		verdict: null,
		categories: {},
		actorId: "admin-singleton",
		targetCommentId: commentId,
		targetMarketId: marketId,
	});
}

describe("UI-6 S3 loadReviewFeed — live-content completeness (ADR-0021)", () => {
	afterEach(async () => {
		await truncateTables(testClient, [
			"mod_actions",
			"image_uploads",
			"dharma_ledger",
			"comments",
			"markets",
			"users",
		]);
		vi.clearAllMocks();
	});

	// Every LIVE row returned; a content_removed comment ABSENT; a BANNED
	// author's non-removed comment PRESENT (ban ≠ removal).
	it("review-feed::returns-every-live-row-excludes-removed-includes-banned-author", async () => {
		const author = await seedAuthor();
		const bannedAuthor = await seedAuthor({
			bannedAt: new Date("2026-06-01T00:00:00Z"),
		});
		const marketId = await seedMarket("ui6-feed-live", "UI6 Feed Live Market");

		const liveA = await seedComment({
			userId: author,
			marketId,
			body: "live A",
			createdAt: new Date("2026-06-10T00:00:03Z"),
		});
		const liveByBanned = await seedComment({
			userId: bannedAuthor,
			marketId,
			body: "banned author still visible",
			createdAt: new Date("2026-06-10T00:00:02Z"),
		});
		const removed = await seedComment({
			userId: author,
			marketId,
			body: "removed content",
			createdAt: new Date("2026-06-10T00:00:01Z"),
		});
		await removeComment(removed, marketId);

		const result = await loadReviewFeed();
		const ids = result.rows.map((r) => r.id);

		// Both live rows present; the removed row is filtered out.
		expect(ids).toContain(liveA);
		expect(ids).toContain(liveByBanned);
		expect(ids).not.toContain(removed);
		expect(result.rows.length).toBe(2);

		// A banned author's non-removed content still surfaces, flagged banned.
		expect(result.rows.find((r) => r.id === liveByBanned)?.authorBanned).toBe(
			true,
		);
		expect(result.rows.find((r) => r.id === liveA)?.authorBanned).toBe(false);
	});

	// Rows span MULTIPLE markets (NO market filter) and are chronological
	// newest-first.
	it("review-feed::spans-multiple-markets-newest-first-no-filter", async () => {
		const author = await seedAuthor();
		const marketOne = await seedMarket("ui6-feed-m1", "Market One");
		const marketTwo = await seedMarket("ui6-feed-m2", "Market Two");

		const oldest = await seedComment({
			userId: author,
			marketId: marketOne,
			body: "oldest",
			createdAt: new Date("2026-06-10T00:00:01Z"),
		});
		const middle = await seedComment({
			userId: author,
			marketId: marketTwo,
			body: "middle",
			createdAt: new Date("2026-06-10T00:00:02Z"),
		});
		const newest = await seedComment({
			userId: author,
			marketId: marketOne,
			body: "newest",
			createdAt: new Date("2026-06-10T00:00:03Z"),
		});

		const result = await loadReviewFeed();

		// No market filter — comments from BOTH markets appear.
		const marketIds = new Set(result.rows.map((r) => r.marketId));
		expect(marketIds.has(marketOne)).toBe(true);
		expect(marketIds.has(marketTwo)).toBe(true);

		// Newest-first (created_at desc).
		expect(result.rows.map((r) => r.id)).toEqual([newest, middle, oldest]);
	});

	// The 200 cap: 201 live rows → exactly 200 returned, truncated, cursor set;
	// the single OLDEST live row is the one the newest-first window drops.
	it("review-feed::caps-at-200-and-flags-truncation-with-cursor", async () => {
		const author = await seedAuthor();
		const marketId = await seedMarket("ui6-feed-cap", "UI6 Feed Cap Market");

		const base = Date.UTC(2026, 5, 1, 0, 0, 0);
		const rows = Array.from({ length: 201 }, (_, i) => ({
			userId: author,
			marketId,
			body: `c${i}`,
			sideAtPostTime: "YES" as const,
			createdAt: new Date(base + i * 1000),
		}));
		await testDb.insert(comments).values(rows);

		const result = await loadReviewFeed();

		expect(REVIEW_FEED_CAP).toBe(200);
		expect(result.cap).toBe(REVIEW_FEED_CAP);
		expect(result.rows.length).toBe(REVIEW_FEED_CAP);
		expect(result.truncated).toBe(true);
		expect(result.nextCursor).not.toBeNull();
		// i=0 is the oldest of 201 → outside the 200 newest-first window.
		expect(result.rows.some((r) => r.body === "c0")).toBe(false);
	});

	// Under the cap: every row returned, not truncated, no continuation cursor.
	it("review-feed::under-cap-returns-all-not-truncated", async () => {
		const author = await seedAuthor();
		const marketId = await seedMarket(
			"ui6-feed-undercap",
			"UI6 Feed Undercap Market",
		);
		await seedComment({
			userId: author,
			marketId,
			body: "u1",
			createdAt: new Date("2026-06-10T00:00:01Z"),
		});
		await seedComment({
			userId: author,
			marketId,
			body: "u2",
			createdAt: new Date("2026-06-10T00:00:02Z"),
		});
		await seedComment({
			userId: author,
			marketId,
			body: "u3",
			createdAt: new Date("2026-06-10T00:00:03Z"),
		});

		const result = await loadReviewFeed();

		expect(result.rows.length).toBe(3);
		expect(result.truncated).toBe(false);
		expect(result.nextCursor).toBeNull();
	});

	// Image mint: a comment with an image → a short-TTL (60s) signed URL, never
	// the raw R2 key anywhere in the serialized rows.
	it("review-feed::mints-short-ttl-signed-image-url-never-raw-key", async () => {
		const author = await seedAuthor();
		const marketId = await seedMarket(
			"ui6-feed-image",
			"UI6 Feed Image Market",
		);
		const rawKey = `u/${author}/${uuidv7()}.webp`;
		const uploadId = await seedImageUpload(author, rawKey);
		const withImage = await seedComment({
			userId: author,
			marketId,
			body: "has image",
			createdAt: new Date("2026-06-10T00:00:02Z"),
			imageUploadsId: uploadId,
		});

		const result = await loadReviewFeed();
		const row = result.rows.find((r) => r.id === withImage);

		expect(row?.imageUrl).toMatch(/^https:\/\/signed\.example\//);
		expect(row?.imageUrl).toContain("ttl=60");
		// The raw R2 key (with unescaped slashes) never leaks into the DTO.
		expect(JSON.stringify(result.rows)).not.toContain(rawKey);
	});

	// A comment WITHOUT an image → imageUrl is null (no mint attempted).
	it("review-feed::comment-without-image-has-null-image-url", async () => {
		const author = await seedAuthor();
		const marketId = await seedMarket(
			"ui6-feed-noimage",
			"UI6 Feed NoImage Market",
		);
		const noImage = await seedComment({
			userId: author,
			marketId,
			body: "no image",
			createdAt: new Date("2026-06-10T00:00:01Z"),
		});

		const result = await loadReviewFeed();
		expect(result.rows.find((r) => r.id === noImage)?.imageUrl).toBeNull();
	});

	// Keyset "load older" is MICROSECOND-precise (§3 #6 / D-4): pagination must
	// NEVER strand a live row that shares the boundary row's millisecond. Three
	// rows in the SAME ms (differ only in the µs tail) are paged one-at-a-time via
	// `before`; a ms-truncated cursor ('…01.000Z') would exclude the two older
	// same-ms rows and return an empty page 2 — a silent completeness hole.
	it("review-feed::load-older-cursor-is-microsecond-precise", async () => {
		const author = await seedAuthor();
		const marketId = await seedMarket("ui6-feed-us", "UI6 Feed Microsecond");

		// Seeded via raw SQL with a LITERAL timestamptz — a JS Date (testDb) only
		// carries ms, and a postgres-js BIND param silently floors to whole seconds;
		// an inlined `TIMESTAMPTZ '…'` literal (hard-coded constants — no injection)
		// is the only path that preserves the µs tail these rows turn on.
		const sameMs: [string, string][] = [
			["sub-ms A", "2026-06-10T00:00:01.000001Z"],
			["sub-ms B", "2026-06-10T00:00:01.000002Z"],
			["sub-ms C", "2026-06-10T00:00:01.000003Z"],
		];
		for (const [body, ts] of sameMs) {
			await testClient.unsafe(
				`INSERT INTO comments (user_id, market_id, body, side_at_post_time, created_at)
				 VALUES ($1, $2, $3, 'YES', TIMESTAMPTZ '${ts}')`,
				[author, marketId, body],
			);
		}

		const page1 = await loadReviewFeed({ limit: 1 });
		expect(page1.rows.map((r) => r.body)).toEqual(["sub-ms C"]);
		expect(page1.truncated).toBe(true);
		// The cursor carries full µs precision, not a ms-floored string.
		expect(page1.nextCursor?.createdAt).toBe("2026-06-10T00:00:01.000003Z");

		// The load-older window surfaces the NEXT older SAME-MS row — a
		// ms-truncated cursor would exclude it and page 2 would be empty.
		const page2 = await loadReviewFeed({
			limit: 1,
			before: page1.nextCursor ?? undefined,
		});
		expect(page2.rows.map((r) => r.body)).toEqual(["sub-ms B"]);

		const page3 = await loadReviewFeed({
			limit: 1,
			before: page2.nextCursor ?? undefined,
		});
		expect(page3.rows.map((r) => r.body)).toEqual(["sub-ms A"]);
		expect(page3.truncated).toBe(false);
		expect(page3.nextCursor).toBeNull();
	});

	// Masking is a property of EVERY body read, not just rows: a LIVE reply under
	// a content_removed PARENT keeps the reply (thread intact) but must NEVER
	// surface the removed parent's body via the parent-snippet path. Mirrors
	// scripts/seed-debate-view-staging.ts:263–282 (the canary that caught it on
	// staging). RED before the fix: the parent body currently leaks into
	// `parentSnippet`.
	it("review-feed::reply-under-removed-parent-masks-body-shows-placeholder", async () => {
		const author = await seedAuthor();
		const marketId = await seedMarket(
			"ui6-feed-removed-parent",
			"UI6 Feed Removed Parent",
		);
		const PARENT_BODY =
			"PARENT BODY MUST NEVER RENDER — it is content_removed.";
		const parent = await seedComment({
			userId: author,
			marketId,
			body: PARENT_BODY,
			createdAt: new Date("2026-06-10T00:00:01Z"),
		});
		const reply = await seedComment({
			userId: author,
			marketId,
			body: "Reply under a removed parent — this MUST still render.",
			createdAt: new Date("2026-06-10T00:00:02Z"),
			parentCommentId: parent,
		});
		await removeComment(parent, marketId);

		const result = await loadReviewFeed();
		const ids = result.rows.map((r) => r.id);

		// The live reply IS returned (thread intact — the child is live content);
		// the removed parent is NOT a row.
		expect(ids).toContain(reply);
		expect(ids).not.toContain(parent);

		// The reply's parent is flagged REMOVED and carries NO body — the
		// placeholder is the only renderable (the type has no snippet field here).
		const replyRow = result.rows.find((r) => r.id === reply);
		expect(replyRow?.parent).toEqual({ removed: true });

		// The removed parent's body appears NOWHERE in the serialized result
		// (same shape as the raw-R2-key leak assertion).
		expect(JSON.stringify(result.rows)).not.toContain(PARENT_BODY);
		expect(JSON.stringify(result.rows)).not.toContain("MUST NEVER RENDER");
	});
});
