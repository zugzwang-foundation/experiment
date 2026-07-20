import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

// UI-A6 §5.6 tests-first, Slice 3 — the cross-author read's MASKING + mode
// boundary (plan §5 inherited behaviours; §4.4 DTO union; §7 `masking.test.ts`;
// ADR-0032 D-6 / D-7 / F-BM-3). SAFETY-CRITICAL: a bookmarked removed comment
// must render the removed stub for EVERY viewer, and the forced-visitor surface
// must never carry a Sell affordance. DB-BACKED (local Postgres :54322).
//
// RED-BY-CONSTRUCTION: `@/server/bookmarks/list` DOES NOT EXIST yet — this file
// fails to COLLECT on that import. It GREENs when `loadBookmarks` lands.
//
// Scenarios → plan §7 / §4.4 / §5 / ADR-0032 F-BM-3:
//   removed-stub               — a `content_removed` bookmarked comment → the
//       `{ removed: true }` variant (NO title/teaser/body/marker/staked/current);
//       the bookmark ROW persists (comment is Bucket A; row is Bucket C but never
//       deleted by removal). Masking single-sourced through `loadRemovedSet`.
//   scrubbed-author-placeholder — an H2-scrubbed author (scrub is DATA — the
//       bracketed pseudonym lives in `users`) → authorPseudonym is the bracketed
//       placeholder (via resolveAuthors); figures still compute over persisted
//       rows.
//   no-sell-mount              — the DTO carries NO sell-eligibility field EVER
//       (forced-visitor — every item is someone else's content by D-3). A shape
//       assertion on the present BookmarkItem: its keys are EXACTLY the §4.4
//       union whitelist — any Sell/owner-affordance field is out by construction.

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import {
	bets,
	bookmarks,
	comments,
	markets,
	modActions,
	pools,
	positions,
	users,
} from "@/db/schema";
// ── RED IMPORT: this module does not exist until Slice 3 lands ───────────────
import { type BookmarkItem, loadBookmarks } from "@/server/bookmarks/list";
import { computeSell } from "@/server/cpmm/calculate";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const POOL = "100.000000000000000000";

function dp18(intStr: string): string {
	return `${intStr}.000000000000000000`;
}

async function seedUser(pseudonym: string, emailTag: string): Promise<string> {
	const id = uuidv7();
	await testDb.insert(users).values({
		id,
		name: `Fixture ${emailTag}`,
		email: `${emailTag}@example.com`,
		pseudonym,
		emailVerified: false,
	});
	return id;
}

async function seedMarket(slug: string): Promise<string> {
	const id = uuidv7();
	await testDb.insert(markets).values({
		id,
		slug,
		title: `Market ${slug}`,
		status: "Open",
		resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
	});
	return id;
}

async function seedPool(marketId: string): Promise<void> {
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: POOL, noReserves: POOL });
}

async function seedComment(args: {
	userId: string;
	marketId: string;
	body: string;
	side: "YES" | "NO";
	createdAt: Date;
}): Promise<string> {
	const id = uuidv7();
	await testDb.insert(comments).values({
		id,
		userId: args.userId,
		marketId: args.marketId,
		parentCommentId: null,
		body: args.body,
		sideAtPostTime: args.side,
		createdAt: args.createdAt,
	});
	return id;
}

async function seedBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	shares: string;
	commentId: string;
	createdAt: Date;
}): Promise<void> {
	await testDb.insert(bets).values({
		id: uuidv7(),
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		stake: args.stake,
		shareQuantity: args.shares,
		priceAtBet: "0.500000000000000000",
		commentId: args.commentId,
		createdAt: args.createdAt,
	});
}

async function seedPosition(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	quantity: string;
}): Promise<void> {
	await testDb.insert(positions).values({
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		quantity: args.quantity,
	});
}

async function seedRemoval(commentId: string): Promise<void> {
	await testDb.insert(modActions).values({
		targetCommentId: commentId,
		reason: "content_removed",
		categories: {},
		actorId: "admin-singleton",
	});
}

async function seedBookmark(args: {
	userId: string;
	commentId: string;
	createdAt: Date;
}): Promise<void> {
	await testDb.insert(bookmarks).values({
		userId: args.userId,
		commentId: args.commentId,
		createdAt: args.createdAt,
	});
}

/** A held YES post by `author` in `marketId` (comment + bet + position). */
async function seedHeldPost(args: {
	author: string;
	marketId: string;
	body: string;
}): Promise<string> {
	const commentId = await seedComment({
		userId: args.author,
		marketId: args.marketId,
		body: args.body,
		side: "YES",
		createdAt: new Date("2026-09-01T10:00:00Z"),
	});
	await seedBet({
		userId: args.author,
		marketId: args.marketId,
		side: "YES",
		stake: dp18("50"),
		shares: dp18("20"),
		commentId,
		createdAt: new Date("2026-09-01T10:00:00Z"),
	});
	await seedPosition({
		userId: args.author,
		marketId: args.marketId,
		side: "YES",
		quantity: dp18("20"),
	});
	return commentId;
}

const TRUNCATE_LIST = [
	"bookmarks",
	"mod_actions",
	"bets",
	"comments",
	"positions",
	"pools",
	"markets",
	"users",
];

describe("UI-A6 Slice 3 — loadBookmarks masking + forced-visitor mode (F-BM-3)", () => {
	afterEach(async () => {
		await truncateTables(testClient, TRUNCATE_LIST);
		vi.clearAllMocks();
	});

	it("bookmark-masking::removed-stub", async () => {
		// A `content_removed` bookmarked comment → the removed stub. Viewer-
		// independent (no session param): the ONE returned payload IS what every
		// viewer gets. The bookmark row persists (comment is Bucket A; the row is
		// Bucket C but removal never deletes it).
		const viewer = await seedUser("rm-viewer", "rm-viewer");
		const author = await seedUser("rm-author", "rm-author");
		const marketId = await seedMarket("m-rm");
		await seedPool(marketId);
		const c = await seedHeldPost({
			author,
			marketId,
			body: "this argument will be removed by a moderator",
		});
		await seedRemoval(c);
		await seedBookmark({
			userId: viewer,
			commentId: c,
			createdAt: new Date("2026-10-01T00:00:00Z"),
		});

		const items = await loadBookmarks(testDb, { viewerId: viewer });
		expect(items.length).toBe(1);
		const item = items[0];
		expect(item?.removed).toBe(true);

		// NO content / figure leak on the removed stub (the §4.4 Extract split
		// makes staked/current/marker on a removed variant a COMPILE error; this
		// `in`-check pins the runtime absence too).
		const bag = (item ?? {}) as Record<string, unknown>;
		expect("title" in bag).toBe(false);
		expect("teaser" in bag).toBe(false);
		expect("body" in bag).toBe(false);
		expect("marker" in bag).toBe(false);
		expect("staked" in bag).toBe(false);
		expect("current" in bag).toBe(false);

		// §4.4 removed-variant DTO = the A5 removed content variant + `authorPseudonym`
		// ONLY. The author head still resolves (Q13 resolveAuthors over ALL bookmarked
		// comments' authors, removed INCLUDED — unlike loadDebateView, which skips
		// removed authors) — a non-empty pseudonym, no PII.
		expect("authorPseudonym" in bag).toBe(true);
		expect(typeof bag.authorPseudonym).toBe("string");
		expect(bag.authorPseudonym).toBe("rm-author");

		// The bookmark ROW persists.
		const rows = await testDb
			.select({ id: bookmarks.id })
			.from(bookmarks)
			.where(eq(bookmarks.commentId, c));
		expect(rows.length).toBe(1);
	});

	it("bookmark-masking::scrubbed-author-placeholder", async () => {
		// H2 scrub is DATA — the author's pseudonym is the bracketed placeholder in
		// `users`. resolveAuthors passes it through verbatim (zero PII); the figures
		// still compute over the persisted rows.
		const viewer = await seedUser("sc-viewer", "sc-viewer");
		const scrubbed = await seedUser("[scrubbed_user_7]", "sc-author");
		const marketId = await seedMarket("m-sc");
		await seedPool(marketId);
		const c = await seedHeldPost({
			author: scrubbed,
			marketId,
			body: "argument by a later-scrubbed author",
		});
		await seedBookmark({
			userId: viewer,
			commentId: c,
			createdAt: new Date("2026-10-01T00:00:00Z"),
		});

		const items = await loadBookmarks(testDb, { viewerId: viewer });
		const item = items[0];
		if (item === undefined || item.removed) {
			throw new Error("expected a present bookmark item");
		}

		// The bracketed placeholder carries through as the card-head name.
		expect(item.authorPseudonym).toBe("[scrubbed_user_7]");

		// Figures still compute over the persisted rows (scrub does not zero them).
		expect(item.staked).toBe(dp18("50"));
		const expectedCurrent = computeSell({
			reserves: { yes: POOL, no: POOL },
			side: "yes",
			shares: dp18("20"),
		}).proceeds;
		expect(item.current).toBe(expectedCurrent);
	});

	it("bookmark-masking::no-sell-mount", async () => {
		// Forced-visitor: EVERY bookmarked item is someone else's content (D-3
		// others-only), so the DTO carries NO Sell-eligibility field EVER. This is
		// a shape assertion on the present-post BookmarkItem: its keys are EXACTLY
		// the §4.4 union whitelist (ProfileArgumentItem present-post + authorPseudonym
		// + staked + current). A stray Sell / owner-affordance field would break it.
		const viewer = await seedUser("ns-viewer", "ns-viewer");
		const author = await seedUser("ns-author", "ns-author");
		const marketId = await seedMarket("m-ns");
		await seedPool(marketId);
		const c = await seedHeldPost({
			author,
			marketId,
			body: "a visitor-only argument",
		});
		await seedBookmark({
			userId: viewer,
			commentId: c,
			createdAt: new Date("2026-10-01T00:00:00Z"),
		});

		const items = await loadBookmarks(testDb, { viewerId: viewer });
		const item = items[0];
		if (item === undefined || item.removed) {
			throw new Error("expected a present post bookmark item");
		}

		// The EXACT present-post BookmarkItem key set — a whitelist. No Sell mount,
		// no owner delta, ever.
		expect(Object.keys(item).sort()).toEqual([
			"aggregate",
			"authorPseudonym",
			"body",
			"createdAt",
			"current",
			"id",
			"kind",
			"marker",
			"marketSlug",
			"marketTitle",
			"ordinal",
			"removed",
			"side",
			"staked",
			"teaser",
			"title",
		]);

		// Belt-and-braces: none of the obvious Sell / owner keys exist.
		const bag = item as Record<string, unknown>;
		for (const key of [
			"sell",
			"sellable",
			"canSell",
			"sellEligible",
			"sellMount",
			"owner",
			"isOwner",
			"ownedByViewer",
			"viewerHolds",
		]) {
			expect(key in bag).toBe(false);
		}

		// Type-level guard (compile-time): the present BookmarkItem is assignable
		// WITHOUT any sell field — the §4.4 union is the exposure boundary.
		const _shape: Extract<BookmarkItem, { removed: false }> = item;
		void _shape;
	});
});
