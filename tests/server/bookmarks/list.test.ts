import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

// UI-A6 §5.6 tests-first, Slice 3 — the cross-author read model `loadBookmarks`
// (plan §4 "the substance"; §4.3 five-case figure rule; §4.5 FI-2; §7
// `list.test.ts`; ADR-0032 D-4 / F-BM-2). DB-BACKED (local Postgres :54322),
// real cross-author rows. `loadBookmarks(client, { viewerId })` takes an EXPLICIT
// client (the `loadProfilePositions` shape) so testDb is passed directly — no
// @/db mock needed.
//
// RED-BY-CONSTRUCTION: `@/server/bookmarks/list` DOES NOT EXIST yet — this file
// fails to COLLECT on that import. It GREENs when `loadBookmarks` lands against
// the contract below. The comparands `loadProfilePositions` / `computeSell` /
// `computeMarker` ARE implemented (A5) — only the bookmark read is missing.
//
// PINNED CONTRACT (the implementer matches EXACTLY):
//   import type { ProfileArgumentItem } from "@/server/profile/arguments";
//   export type BookmarkItem =
//     | (Extract<ProfileArgumentItem, { removed: true }>  &
//         { authorPseudonym: string })
//     | (Extract<ProfileArgumentItem, { removed: false }> &
//         { authorPseudonym: string; staked: string; current: string });
//   export async function loadBookmarks(
//     client: DbClient, args: { viewerId: string },
//   ): Promise<BookmarkItem[]>;   // ordered by bookmarks.created_at DESC
//
// Scenarios → plan §7 / §4.3 / §4.5:
//   renders-authors-figures-not-viewers  — the item's staked/current/marker are
//       the AUTHOR's, never the viewer's (viewer seeded a DIFFERENT position in
//       the same market to prove independence).
//   recency-order                        — order is `bookmarks.created_at` DESC
//       (recency), NOT comment time and NOT ranking.
//   marker-on-authors-held-side          — marker == computeMarker(sideAtPostTime,
//       A's held side); a DIFFERENT user's opposing position must NOT move it.
//   bookmark-figures-match-author-profile — THE load-bearing FI-2 identity test
//       (§4.5b): staked/current/marker for a held-S item are byte-identical to
//       A's own Profile figures. OPEN + SETTLED + MULTI-EPISODE re-entry.
//   exited-flipped-zero-zero             — steer 3: an exited / flipped author's
//       card STILL renders (0/0 + Exited/Flipped), never dropped.
//   reply-kind-renders                   — the buildReplyItem cross-author path:
//       kind="reply", repliedToTitle = the parent post's derived title, the
//       reply's own `stake` ruler, + §4.3 figures on (A, M, reply-side) that are
//       byte-identical to A's Profile (FI-2 on a reply; Đa distinct from `stake`).

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import {
	bets,
	bookmarks,
	comments,
	events,
	markets,
	payoutEvents,
	pools,
	positions,
	resolutionEvents,
	users,
} from "@/db/schema";
// ── RED IMPORT: this module does not exist until Slice 3 lands ───────────────
import { type BookmarkItem, loadBookmarks } from "@/server/bookmarks/list";
import { computeSell } from "@/server/cpmm/calculate";
import { deriveTitleTeaser } from "@/server/debate-view/load-debate-view";
import { computeMarker } from "@/server/positions/compute";
import { loadProfilePositions } from "@/server/profile/positions";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const POOL = "100.000000000000000000";
const ZERO = "0.000000000000000000";

function dp18(intStr: string): string {
	return `${intStr}.000000000000000000`;
}

function lc(side: "YES" | "NO"): "yes" | "no" {
	return side === "YES" ? "yes" : "no";
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

async function seedMarket(
	slug: string,
	status: "Open" | "Closed" | "Resolving" | "Resolved" | "Voided" | "Frozen",
	resolved?: { outcome: "YES" | "NO" },
): Promise<string> {
	const id = uuidv7();
	await testDb.insert(markets).values({
		id,
		slug,
		title: `Market ${slug}`,
		status,
		resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		resolvedAt: resolved ? new Date("2026-10-15T00:00:00Z") : null,
		resolutionOutcome: resolved?.outcome ?? null,
	});
	return id;
}

async function seedPool(
	marketId: string,
	yes = POOL,
	no = POOL,
): Promise<void> {
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: yes, noReserves: no });
}

async function seedComment(args: {
	userId: string;
	marketId: string;
	body: string;
	side: "YES" | "NO";
	parentCommentId?: string;
	createdAt: Date;
}): Promise<string> {
	const id = uuidv7();
	await testDb.insert(comments).values({
		id,
		userId: args.userId,
		marketId: args.marketId,
		parentCommentId: args.parentCommentId ?? null,
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
}): Promise<string> {
	const id = uuidv7();
	await testDb.insert(bets).values({
		id,
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		stake: args.stake,
		shareQuantity: args.shares,
		priceAtBet: "0.500000000000000000",
		commentId: args.commentId,
		createdAt: args.createdAt,
	});
	return id;
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

/** A `bet.sold` event on the market aggregate (payload.userId filtered app-side). */
async function seedSell(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	sharesSold: string;
	proceeds: string;
	createdAt: Date;
}): Promise<void> {
	await testDb.insert(events).values({
		eventId: uuidv7(),
		eventType: "bet.sold",
		aggregateType: "market",
		aggregateId: args.marketId,
		payload: {
			betId: uuidv7(),
			marketId: args.marketId,
			userId: args.userId,
			side: args.side,
			sharesSold: args.sharesSold,
			proceeds: args.proceeds,
			price: "0.500000000000000000",
		},
		payloadVersion: 1,
		metadata: {},
		createdAt: args.createdAt,
	});
}

async function seedResolution(args: {
	marketId: string;
	kind: "resolve" | "correct" | "void";
	outcome: "YES" | "NO" | "VOID";
	reason: string;
	correctsEventId?: string;
}): Promise<string> {
	const id = uuidv7();
	await testDb.insert(resolutionEvents).values({
		id,
		marketId: args.marketId,
		eventKind: args.kind,
		outcome: args.outcome,
		correctsEventId: args.correctsEventId ?? null,
		reason: args.reason,
	});
	return id;
}

async function seedPayout(args: {
	betId: string;
	userId: string;
	marketId: string;
	resolutionEventId: string;
	payoutType:
		| "bet_payout"
		| "correction_reverse"
		| "correction_apply"
		| "void_refund";
	amount: string;
}): Promise<void> {
	await testDb.insert(payoutEvents).values({
		betId: args.betId,
		userId: args.userId,
		marketId: args.marketId,
		resolutionEventId: args.resolutionEventId,
		payoutType: args.payoutType,
		amount: args.amount,
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

/** A plain top-level post (comment + its opening bet). No position seeded. */
async function seedPost(args: {
	userId: string;
	marketId: string;
	body: string;
	createdAt: Date;
	side?: "YES" | "NO";
	stake?: string;
	shares?: string;
}): Promise<string> {
	const side = args.side ?? "YES";
	const commentId = await seedComment({
		userId: args.userId,
		marketId: args.marketId,
		body: args.body,
		side,
		createdAt: args.createdAt,
	});
	await seedBet({
		userId: args.userId,
		marketId: args.marketId,
		side,
		stake: args.stake ?? dp18("100"),
		shares: args.shares ?? dp18("50"),
		commentId,
		createdAt: args.createdAt,
	});
	return commentId;
}

/** Narrow to the present (non-removed) BookmarkItem variant, or fail loud. */
function present(
	item: BookmarkItem | undefined,
): Extract<BookmarkItem, { removed: false }> {
	if (item === undefined || item.removed) {
		throw new Error("expected a present (removed:false) bookmark item");
	}
	return item;
}

const TRUNCATE_LIST = [
	"bookmarks",
	"events",
	"payout_events",
	"resolution_events",
	"mod_actions",
	"dharma_ledger",
	"bets",
	"comments",
	"positions",
	"pools",
	"markets",
	"users",
];

describe("UI-A6 Slice 3 — loadBookmarks cross-author read (F-BM-2)", () => {
	afterEach(async () => {
		await truncateTables(testClient, TRUNCATE_LIST);
		vi.clearAllMocks();
	});

	it("bookmark-list::renders-authors-figures-not-viewers", async () => {
		// Author A holds YES (stake 100, qty 50). The VIEWER holds a DIFFERENT
		// position in the SAME market (YES, stake 20, qty 10). The viewer bookmarks
		// A's comment: the item's figures must be A's, never the viewer's.
		const viewer = await seedUser("rav-viewer", "rav-viewer");
		const author = await seedUser("rav-author", "rav-author");
		const marketId = await seedMarket("m-rav", "Open");
		await seedPool(marketId);

		const aComment = await seedPost({
			userId: author,
			marketId,
			body: "author A argument",
			createdAt: new Date("2026-09-01T10:00:00Z"),
			side: "YES",
			stake: dp18("100"),
			shares: dp18("50"),
		});
		await seedPosition({
			userId: author,
			marketId,
			side: "YES",
			quantity: dp18("50"),
		});

		// The viewer's own (different) holding in the same market.
		await seedPost({
			userId: viewer,
			marketId,
			body: "viewer own argument",
			createdAt: new Date("2026-09-01T11:00:00Z"),
			side: "YES",
			stake: dp18("20"),
			shares: dp18("10"),
		});
		await seedPosition({
			userId: viewer,
			marketId,
			side: "YES",
			quantity: dp18("10"),
		});

		await seedBookmark({
			userId: viewer,
			commentId: aComment,
			createdAt: new Date("2026-10-01T00:00:00Z"),
		});

		const items = await loadBookmarks(testDb, { viewerId: viewer });
		expect(items.length).toBe(1);
		const item = present(items[0]);

		// A's figures: Đa = A's episode basis (100); Đb = computeSell over A's 50.
		const authorCurrent = computeSell({
			reserves: { yes: POOL, no: POOL },
			side: lc("YES"),
			shares: dp18("50"),
		}).proceeds;
		expect(item.staked).toBe(dp18("100"));
		expect(item.current).toBe(authorCurrent);
		expect(item.marker).toBe("none"); // A holds YES on a YES post.

		// NOT the viewer's figures (stake 20; computeSell over 10 shares).
		const viewerCurrent = computeSell({
			reserves: { yes: POOL, no: POOL },
			side: lc("YES"),
			shares: dp18("10"),
		}).proceeds;
		expect(item.staked).not.toBe(dp18("20"));
		expect(item.current).not.toBe(viewerCurrent);
	});

	it("bookmark-list::recency-order", async () => {
		// Order is bookmarks.created_at DESC — NOT comment time, NOT ranking. The
		// bookmark times are INVERSE of comment times, and the rows are inserted in
		// a scrambled order (so uuidv7 id-order differs from the expected order):
		// any of {comment DESC, id ASC, id DESC} would give a DIFFERENT answer.
		const viewer = await seedUser("rec-viewer", "rec-viewer");
		const a1 = await seedUser("rec-a1", "rec-a1");
		const a2 = await seedUser("rec-a2", "rec-a2");
		const a3 = await seedUser("rec-a3", "rec-a3");
		const marketId = await seedMarket("m-rec", "Open");
		await seedPool(marketId);

		// Comment times ascend c1 < c2 < c3.
		const c1 = await seedPost({
			userId: a1,
			marketId,
			body: "post one",
			createdAt: new Date("2026-09-01T00:00:00Z"),
		});
		const c2 = await seedPost({
			userId: a2,
			marketId,
			body: "post two",
			createdAt: new Date("2026-09-02T00:00:00Z"),
		});
		const c3 = await seedPost({
			userId: a3,
			marketId,
			body: "post three",
			createdAt: new Date("2026-09-03T00:00:00Z"),
		});

		// Bookmark times: c1 newest, c2 mid, c3 oldest (inverse of comment time).
		// Insert scrambled so bookmark id-order (uuidv7 = insertion order) is
		// c3 < c1 < c2 — not the expected [c1, c2, c3].
		await seedBookmark({
			userId: viewer,
			commentId: c3,
			createdAt: new Date("2026-10-01T00:00:00Z"),
		});
		await seedBookmark({
			userId: viewer,
			commentId: c1,
			createdAt: new Date("2026-10-03T00:00:00Z"),
		});
		await seedBookmark({
			userId: viewer,
			commentId: c2,
			createdAt: new Date("2026-10-02T00:00:00Z"),
		});

		const items = await loadBookmarks(testDb, { viewerId: viewer });
		expect(items.map((i) => i.id)).toEqual([c1, c2, c3]);
	});

	it("bookmark-list::marker-on-authors-held-side", async () => {
		// The marker == computeMarker(sideAtPostTime, A's CURRENTLY-held side):
		//   (a) A holds YES on a YES post → "none"; GUARD: viewer holds NO here and
		//       must NOT move A's marker (held side is per-author).
		//   (b) A holds NO  on a YES post → "Flipped".
		//   (c) A holds none on a YES post → "Exited".
		const viewer = await seedUser("mk-viewer", "mk-viewer");
		const author = await seedUser("mk-author", "mk-author");

		const mNone = await seedMarket("m-mk-none", "Open");
		await seedPool(mNone);
		const cNone = await seedPost({
			userId: author,
			marketId: mNone,
			body: "held-same argument",
			createdAt: new Date("2026-09-01T00:00:00Z"),
			side: "YES",
		});
		await seedPosition({
			userId: author,
			marketId: mNone,
			side: "YES",
			quantity: dp18("50"),
		});
		// GUARD: the viewer holds the OPPOSITE side in the same market.
		await seedPosition({
			userId: viewer,
			marketId: mNone,
			side: "NO",
			quantity: dp18("40"),
		});

		const mFlip = await seedMarket("m-mk-flip", "Open");
		await seedPool(mFlip);
		const cFlip = await seedPost({
			userId: author,
			marketId: mFlip,
			body: "flipped argument",
			createdAt: new Date("2026-09-02T00:00:00Z"),
			side: "YES",
		});
		await seedPosition({
			userId: author,
			marketId: mFlip,
			side: "NO",
			quantity: dp18("30"),
		});

		const mExit = await seedMarket("m-mk-exit", "Open");
		await seedPool(mExit);
		const cExit = await seedPost({
			userId: author,
			marketId: mExit,
			body: "exited argument",
			createdAt: new Date("2026-09-03T00:00:00Z"),
			side: "YES",
		});
		// No position for A in mExit → held side null → Exited.

		await seedBookmark({
			userId: viewer,
			commentId: cNone,
			createdAt: new Date("2026-10-01T00:00:00Z"),
		});
		await seedBookmark({
			userId: viewer,
			commentId: cFlip,
			createdAt: new Date("2026-10-02T00:00:00Z"),
		});
		await seedBookmark({
			userId: viewer,
			commentId: cExit,
			createdAt: new Date("2026-10-03T00:00:00Z"),
		});

		const items = await loadBookmarks(testDb, { viewerId: viewer });
		const byId = new Map(items.map((i) => [i.id, i]));

		expect(present(byId.get(cNone)).marker).toBe(
			computeMarker({ sideAtPostTime: "YES", heldSide: "YES" }),
		);
		expect(present(byId.get(cFlip)).marker).toBe(
			computeMarker({ sideAtPostTime: "YES", heldSide: "NO" }),
		);
		expect(present(byId.get(cExit)).marker).toBe(
			computeMarker({ sideAtPostTime: "YES", heldSide: null }),
		);
	});

	it("bookmark-figures-match-author-profile", async () => {
		// THE FI-2 identity test (§4.5b) — OPEN holding. staked/current/marker for
		// the bookmarked (author A, market M, side YES) item are byte-identical to
		// A's OWN Profile positions figures + marker (one holding, one value —
		// ACROSS surfaces). The bookmark read builds its own batched Q9/Q10, so
		// this locks the same-source derivation.
		const viewer = await seedUser("fi2-viewer", "fi2-viewer");
		const author = await seedUser("fi2-author", "fi2-author");
		const marketId = await seedMarket("m-fi2-open", "Open");
		await seedPool(marketId);
		const c = await seedPost({
			userId: author,
			marketId,
			body: "author held argument",
			createdAt: new Date("2026-09-01T10:00:00Z"),
			side: "YES",
			stake: dp18("100"),
			shares: dp18("50"),
		});
		await seedPosition({
			userId: author,
			marketId,
			side: "YES",
			quantity: dp18("50"),
		});
		await seedBookmark({
			userId: viewer,
			commentId: c,
			createdAt: new Date("2026-10-01T00:00:00Z"),
		});

		// Oracle: A's OWN Profile positions row for M (the A5 read, implemented).
		const profileRows = await loadProfilePositions(testDb, { userId: author });
		const profileRow = profileRows.find((r) => r.marketId === marketId);
		if (profileRow === undefined) {
			throw new Error("expected A to have a Profile positions row for M");
		}

		const items = await loadBookmarks(testDb, { viewerId: viewer });
		expect(items.length).toBe(1);
		const item = present(items[0]);

		// Byte-identity across surfaces (FI-2).
		expect(item.staked).toBe(profileRow.staked);
		expect(item.current).toBe(profileRow.current);
		expect(item.marker).toBe(
			computeMarker({ sideAtPostTime: "YES", heldSide: profileRow.side }),
		);
	});

	it("bookmark-figures-match-author-profile-settled", async () => {
		// FI-2, SETTLED branch (Đb via net Σ payout_events, not computeSell). A
		// held-to-settlement YES holding on a Resolved market; the bookmark figures
		// equal A's Profile figures for the same (M, YES).
		const viewer = await seedUser("fi2s-viewer", "fi2s-viewer");
		const author = await seedUser("fi2s-author", "fi2s-author");
		const marketId = await seedMarket("m-fi2-settled", "Resolved", {
			outcome: "YES",
		});
		await seedPool(marketId);
		const c = await seedComment({
			userId: author,
			marketId,
			body: "settled held argument",
			side: "YES",
			createdAt: new Date("2026-09-01T10:00:00Z"),
		});
		const betId = await seedBet({
			userId: author,
			marketId,
			side: "YES",
			stake: dp18("200"),
			shares: dp18("100"),
			commentId: c,
			createdAt: new Date("2026-09-01T10:00:00Z"),
		});
		// The position persists post-settlement (INV-4 — never zeroed at resolve).
		await seedPosition({
			userId: author,
			marketId,
			side: "YES",
			quantity: dp18("100"),
		});
		const rev = await seedResolution({
			marketId,
			kind: "resolve",
			outcome: "YES",
			reason: "Criterion met.",
		});
		await seedPayout({
			betId,
			userId: author,
			marketId,
			resolutionEventId: rev,
			payoutType: "bet_payout",
			amount: dp18("300"),
		});
		await seedBookmark({
			userId: viewer,
			commentId: c,
			createdAt: new Date("2026-10-01T00:00:00Z"),
		});

		const profileRows = await loadProfilePositions(testDb, { userId: author });
		const profileRow = profileRows.find((r) => r.marketId === marketId);
		if (profileRow === undefined) {
			throw new Error(
				"expected A to have a settled Profile positions row for M",
			);
		}
		expect(profileRow.settled).toBe(true);

		const items = await loadBookmarks(testDb, { viewerId: viewer });
		const item = present(items[0]);
		expect(item.staked).toBe(profileRow.staked); // Đa = 200 (episode basis)
		expect(item.current).toBe(profileRow.current); // Đb = net Σ payout = 300
	});

	it("bookmark-figures-match-author-profile-multi-episode-reentry", async () => {
		// FI-2 + self-critique #1: A exits YES (episode E1, the BOOKMARKED comment)
		// then re-enters YES (E2, a new opener). §4.3 shows E2's CURRENT basis on
		// the E1-comment's card (held.side === S) — exactly what A's Profile shows.
		const viewer = await seedUser("fi2m-viewer", "fi2m-viewer");
		const author = await seedUser("fi2m-author", "fi2m-author");
		const marketId = await seedMarket("m-fi2-multi", "Open");
		await seedPool(marketId);

		// E1: buy YES (stake 100, 40 shares) on comment c1, then a FULL exit.
		const c1 = await seedComment({
			userId: author,
			marketId,
			body: "E1 opener (later exited)",
			side: "YES",
			createdAt: new Date("2026-09-01T10:00:00Z"),
		});
		await seedBet({
			userId: author,
			marketId,
			side: "YES",
			stake: dp18("100"),
			shares: dp18("40"),
			commentId: c1,
			createdAt: new Date("2026-09-01T10:00:00Z"),
		});
		await seedSell({
			userId: author,
			marketId,
			side: "YES",
			sharesSold: dp18("40"),
			proceeds: dp18("20"),
			createdAt: new Date("2026-09-02T10:00:00Z"),
		});
		// E2: re-buy YES (stake 60, 30 shares) on comment c2 — currently held.
		const c2 = await seedComment({
			userId: author,
			marketId,
			body: "E2 opener (currently held)",
			side: "YES",
			createdAt: new Date("2026-09-03T10:00:00Z"),
		});
		await seedBet({
			userId: author,
			marketId,
			side: "YES",
			stake: dp18("60"),
			shares: dp18("30"),
			commentId: c2,
			createdAt: new Date("2026-09-03T10:00:00Z"),
		});
		await seedPosition({
			userId: author,
			marketId,
			side: "YES",
			quantity: dp18("30"),
		});

		// The bookmark points at E1's (exited) opener — the figure is still E2's.
		await seedBookmark({
			userId: viewer,
			commentId: c1,
			createdAt: new Date("2026-10-01T00:00:00Z"),
		});

		const profileRows = await loadProfilePositions(testDb, { userId: author });
		const profileRow = profileRows.find((r) => r.marketId === marketId);
		if (profileRow === undefined) {
			throw new Error("expected A to have a Profile positions row for M");
		}

		const items = await loadBookmarks(testDb, { viewerId: viewer });
		const item = present(items.find((i) => i.id === c1));
		// E2 (current episode) basis == A's Profile figure — one holding, one value.
		expect(item.staked).toBe(profileRow.staked); // 60 (E2 basis, not E1's 100)
		expect(item.current).toBe(profileRow.current);
		expect(item.marker).toBe("none"); // held YES on a YES comment
	});

	it("bookmark-list::reply-kind-renders", async () => {
		// A viewer bookmarks a depth-1 REPLY authored by A (a counter reply-bet on
		// userC's parent post P). Exercises buildReplyItem cross-author + figure-
		// attach on a reply: kind="reply", repliedToTitle = P's derived title, the
		// reply's own `stake` ruler, AND §4.3 figures for A on (M, reply-side) —
		// byte-identical to A's Profile. A partial sell makes Đa DISTINCT from the
		// reply-bet ruler, so `staked` cannot be a stray echo of `stake`.
		const viewer = await seedUser("rep-viewer", "rep-viewer");
		const author = await seedUser("rep-author", "rep-author");
		const parentAuthor = await seedUser("rep-parent", "rep-parent");
		const marketId = await seedMarket("m-rep", "Open");
		await seedPool(marketId);

		// Parent post P (top-level YES) by another author — the reply's target.
		const PARENT_BODY = "Parent post headline\n\nthe parent teaser paragraph";
		const parentPost = await seedComment({
			userId: parentAuthor,
			marketId,
			body: PARENT_BODY,
			side: "YES",
			createdAt: new Date("2026-09-01T09:00:00Z"),
		});
		await seedBet({
			userId: parentAuthor,
			marketId,
			side: "YES",
			stake: dp18("30"),
			shares: dp18("15"),
			commentId: parentPost,
			createdAt: new Date("2026-09-01T09:00:00Z"),
		});

		// A's counter REPLY (side NO) on P — reply-bet stake 40, 20 shares.
		const reply = await seedComment({
			userId: author,
			marketId,
			body: "Counter reply argument by A",
			side: "NO",
			parentCommentId: parentPost,
			createdAt: new Date("2026-09-02T10:00:00Z"),
		});
		await seedBet({
			userId: author,
			marketId,
			side: "NO",
			stake: dp18("40"),
			shares: dp18("20"),
			commentId: reply,
			createdAt: new Date("2026-09-02T10:00:00Z"),
		});
		// Partial sell (5 of 20) → the NO episode basis (Đa) reduces pro-rata to
		// 40 × 15/20 = 30, DISTINCT from the reply ruler (stake 40). Position → 15.
		await seedSell({
			userId: author,
			marketId,
			side: "NO",
			sharesSold: dp18("5"),
			proceeds: dp18("2"),
			createdAt: new Date("2026-09-03T10:00:00Z"),
		});
		await seedPosition({
			userId: author,
			marketId,
			side: "NO",
			quantity: dp18("15"),
		});

		await seedBookmark({
			userId: viewer,
			commentId: reply,
			createdAt: new Date("2026-10-01T00:00:00Z"),
		});

		// Oracle: A's own Profile positions row for M (the held NO holding).
		const profileRows = await loadProfilePositions(testDb, { userId: author });
		const profileRow = profileRows.find((r) => r.marketId === marketId);
		if (profileRow === undefined) {
			throw new Error("expected A to have a Profile positions row for M");
		}

		const items = await loadBookmarks(testDb, { viewerId: viewer });
		expect(items.length).toBe(1);
		const item = present(items[0]);
		if (item.kind !== "reply") {
			throw new Error("expected a reply-kind bookmark item");
		}

		// The buildReplyItem shape.
		expect(item.repliedToTitle).toBe(deriveTitleTeaser(PARENT_BODY).title);
		expect(item.stake).toBe(dp18("40")); // the reply-bet's OWN stake (the ruler)

		// §4.3 figures for A on (M, NO) — byte-identical to A's Profile.
		expect(item.staked).toBe(profileRow.staked); // Đa = 30 (post-partial-sell)
		expect(item.current).toBe(profileRow.current);
		expect(item.staked).not.toBe(item.stake); // Đa (30) ≠ the reply ruler (40)
		expect(item.marker).toBe("none"); // A holds NO on a NO reply.
	});

	it("bookmark-list::exited-flipped-zero-zero", async () => {
		// Steer 3 (ARGUMENT-anchored, not position-anchored): a bookmarked comment
		// on (M, YES) where A has EXITED (no held row) OR FLIPPED to ¬S → 0/0 +
		// Exited/Flipped, and the card STILL renders (the comment is permanent —
		// NOT the Profile positions table's exited-row omission).
		const viewer = await seedUser("efz-viewer", "efz-viewer");
		const author = await seedUser("efz-author", "efz-author");

		// EXITED — A bought YES then fully exited (position at 0).
		const mExit = await seedMarket("m-efz-exit", "Open");
		await seedPool(mExit);
		const cExit = await seedComment({
			userId: author,
			marketId: mExit,
			body: "exited comment",
			side: "YES",
			createdAt: new Date("2026-09-01T10:00:00Z"),
		});
		await seedBet({
			userId: author,
			marketId: mExit,
			side: "YES",
			stake: dp18("100"),
			shares: dp18("40"),
			commentId: cExit,
			createdAt: new Date("2026-09-01T10:00:00Z"),
		});
		await seedSell({
			userId: author,
			marketId: mExit,
			side: "YES",
			sharesSold: dp18("40"),
			proceeds: dp18("20"),
			createdAt: new Date("2026-09-02T10:00:00Z"),
		});
		await seedPosition({
			userId: author,
			marketId: mExit,
			side: "YES",
			quantity: dp18("0"),
		});

		// FLIPPED — A posted YES, now holds NO.
		const mFlip = await seedMarket("m-efz-flip", "Open");
		await seedPool(mFlip);
		const cFlip = await seedComment({
			userId: author,
			marketId: mFlip,
			body: "flipped comment",
			side: "YES",
			createdAt: new Date("2026-09-03T10:00:00Z"),
		});
		await seedBet({
			userId: author,
			marketId: mFlip,
			side: "YES",
			stake: dp18("80"),
			shares: dp18("30"),
			commentId: cFlip,
			createdAt: new Date("2026-09-03T10:00:00Z"),
		});
		await seedPosition({
			userId: author,
			marketId: mFlip,
			side: "NO",
			quantity: dp18("25"),
		});

		await seedBookmark({
			userId: viewer,
			commentId: cExit,
			createdAt: new Date("2026-10-01T00:00:00Z"),
		});
		await seedBookmark({
			userId: viewer,
			commentId: cFlip,
			createdAt: new Date("2026-10-02T00:00:00Z"),
		});

		const items = await loadBookmarks(testDb, { viewerId: viewer });
		// BOTH cards render — steer 3 (the argument is permanent, never dropped).
		expect(items.length).toBe(2);
		const byId = new Map(items.map((i) => [i.id, i]));

		const exit = present(byId.get(cExit));
		expect(exit.staked).toBe(ZERO);
		expect(exit.current).toBe(ZERO);
		expect(exit.marker).toBe("Exited");

		const flip = present(byId.get(cFlip));
		expect(flip.staked).toBe(ZERO);
		expect(flip.current).toBe(ZERO);
		expect(flip.marker).toBe("Flipped");
	});
});
