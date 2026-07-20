import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import {
	bets,
	comments,
	dharmaLedger,
	events,
	markets,
	modActions,
	payoutEvents,
	pools,
	positions,
	resolutionEvents,
	users,
} from "@/db/schema";
import { computeSell } from "@/server/cpmm/calculate";
import { deriveTitleTeaser } from "@/server/debate-view/load-debate-view";
import { loadProfilePositions } from "@/server/profile/positions";
import { loadProfileTiles } from "@/server/profile/tiles";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// UI.A5 Slice 2 §5.6 tests-first (plan §2 row 2 + §11) — F-PROF-1 cross-market
// positions read model (SPEC.1 1.0.18 §23 "The read model" + "The Đa staked
// basis" + OQ-3/OQ-9). VALUE imports from `@/server/profile/{positions,tiles}`
// FAIL at collection until Slice 2 lands — red-for-the-right-reason.
// DB-BACKED (local Postgres :54322).
//
// The `current` golden is computed via the SHIPPED `computeSell` (the single
// FI-2 Đb authority, §10.8) — the test pins the impl to that basis, not a
// mark-to-market shares×price. Đa (`staked`) is the episodes.ts walk authority.
// The `argument` cell is the FINAL episode's OPENING argument (N-1a).

const POOL = "100.000000000000000000";

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

async function seedGrant(userId: string, amount: string): Promise<void> {
	await testDb.insert(dharmaLedger).values({
		userId,
		entryType: "initial_grant",
		amount,
		balanceAfter: amount,
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

const TRUNCATE_LIST = [
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

describe("UI.A5 Slice 2 — loadProfilePositions (F-PROF-1 positions read model)", () => {
	afterEach(async () => {
		await truncateTables(testClient, TRUNCATE_LIST);
		vi.clearAllMocks();
	});

	it("one-holding-one-value", async () => {
		// ONE open YES holding. The row's `current` IS Đb via computeSell against
		// the live pool; the tile Σ over the returned rows inherits that SAME
		// string end-to-end (FI-2 basis identity, one value never split).
		const userA = await seedUser("one-value-user", "one-value");
		const marketId = await seedMarket("m-one-value", "Open");
		await seedPool(marketId);
		await seedGrant(userA, dp18("1000"));
		const commentId = await seedComment({
			userId: userA,
			marketId,
			body: "Single holding argument",
			side: "YES",
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId,
			side: "YES",
			stake: dp18("50"),
			shares: dp18("50"),
			commentId,
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		await seedPosition({
			userId: userA,
			marketId,
			side: "YES",
			quantity: dp18("50"),
		});

		const rows = await loadProfilePositions(testDb, { userId: userA });
		expect(rows.length).toBe(1);
		const row = rows[0];

		const expected = computeSell({
			reserves: { yes: POOL, no: POOL },
			side: lc("YES"),
			shares: dp18("50"),
		}).proceeds;

		expect(row?.current).toBe(expected);
		expect(row?.marketStatus).toBe("Open");
		expect(row?.statusLabel).toBe("Open");
		expect(row?.settled).toBe(false);
		expect(row?.side).toBe("YES");
		expect(row?.quantity).toBe(dp18("50"));

		// Structural single-value inheritance: the tile Positions value IS the
		// byte-equal Σ over the returned unsettled rows — never recomputed.
		const tiles = await loadProfileTiles(testDb, {
			userId: userA,
			positions: rows,
		});
		expect(tiles.positionsValue).toBe(expected);
	});

	it("staked-episode-basis-post-partial-sell", async () => {
		// Buy stake 100 → 40 shares; sell 10 (positions → 30). Đa reduces
		// pro-rata: 100 × (40−10)/40 = 75. `current` = computeSell(30) live.
		const userA = await seedUser("partial-sell-user", "partial-sell");
		const marketId = await seedMarket("m-partial-sell", "Open");
		await seedPool(marketId);
		const commentId = await seedComment({
			userId: userA,
			marketId,
			body: "Partial sell argument",
			side: "YES",
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId,
			side: "YES",
			stake: dp18("100"),
			shares: dp18("40"),
			commentId,
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		// Sell strictly AFTER the buy (N-3 merge law).
		await seedSell({
			userId: userA,
			marketId,
			side: "YES",
			sharesSold: dp18("10"),
			proceeds: dp18("5"),
			createdAt: new Date("2026-09-20T11:00:00Z"),
		});
		await seedPosition({
			userId: userA,
			marketId,
			side: "YES",
			quantity: dp18("30"),
		});

		const rows = await loadProfilePositions(testDb, { userId: userA });
		expect(rows.length).toBe(1);
		const row = rows[0];

		expect(row?.staked).toBe(dp18("75"));

		const expected = computeSell({
			reserves: { yes: POOL, no: POOL },
			side: lc("YES"),
			shares: dp18("30"),
		}).proceeds;
		expect(row?.current).toBe(expected);
		expect(row?.quantity).toBe(dp18("30"));
	});

	it("argument-cell-episode-opener", async () => {
		// N-1a: the argument cell is the FINAL episode's opening argument.
		//
		// REPLY case (m-reply): userA posts A (YES) → FULL exit → re-buys via a
		// REPLY B to userC's post P. Final episode opener = B (a reply): isReply,
		// postOrdinal = PARENT P's ordinal, repliedToTitle = P's title.
		const userA = await seedUser("aco-user-a", "aco-a");
		const userC = await seedUser("aco-user-c", "aco-c");
		const mReply = await seedMarket("m-reply", "Open");
		await seedPool(mReply);

		// Top-level comments in m-reply — ordinal by (created_at, id): A=1, P=2.
		const commentA = await seedComment({
			userId: userA,
			marketId: mReply,
			body: "Opening post A that is later exited",
			side: "YES",
			createdAt: new Date("2026-09-10T00:00:00Z"),
		});
		const commentP = await seedComment({
			userId: userC,
			marketId: mReply,
			body: "Parent post P by another author",
			side: "YES",
			createdAt: new Date("2026-09-11T00:00:00Z"),
		});
		// Reply B to P — the final episode's opener (a NO reply-bet, a flip).
		const commentB = await seedComment({
			userId: userA,
			marketId: mReply,
			body: "Counter reply B is the current episode opener",
			side: "NO",
			parentCommentId: commentP,
			createdAt: new Date("2026-09-15T00:00:00Z"),
		});
		// Episode 1: buy A (YES 40) → full exit (sell 40).
		await seedBet({
			userId: userA,
			marketId: mReply,
			side: "YES",
			stake: dp18("100"),
			shares: dp18("40"),
			commentId: commentA,
			createdAt: new Date("2026-09-10T00:00:00Z"),
		});
		await seedSell({
			userId: userA,
			marketId: mReply,
			side: "YES",
			sharesSold: dp18("40"),
			proceeds: dp18("20"),
			createdAt: new Date("2026-09-12T00:00:00Z"),
		});
		// Episode 2: buy B (NO 30) — the held episode.
		await seedBet({
			userId: userA,
			marketId: mReply,
			side: "NO",
			stake: dp18("80"),
			shares: dp18("30"),
			commentId: commentB,
			createdAt: new Date("2026-09-15T00:00:00Z"),
		});
		await seedPosition({
			userId: userA,
			marketId: mReply,
			side: "NO",
			quantity: dp18("30"),
		});

		// PLAIN-POST case (m-post): 2 earlier top-level comments so userA's post
		// Z lands at ordinal 3 (its OWN ordinal); repliedToTitle null.
		const userD = await seedUser("aco-user-d", "aco-d");
		const userE = await seedUser("aco-user-e", "aco-e");
		const mPost = await seedMarket("m-post", "Open");
		await seedPool(mPost);
		await seedComment({
			userId: userD,
			marketId: mPost,
			body: "Earlier post X",
			side: "YES",
			createdAt: new Date("2026-09-05T00:00:00Z"),
		});
		await seedComment({
			userId: userE,
			marketId: mPost,
			body: "Earlier post Y",
			side: "YES",
			createdAt: new Date("2026-09-06T00:00:00Z"),
		});
		const commentZ = await seedComment({
			userId: userA,
			marketId: mPost,
			body: "Plain post Z opener at ordinal three",
			side: "YES",
			createdAt: new Date("2026-09-07T00:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId: mPost,
			side: "YES",
			stake: dp18("50"),
			shares: dp18("20"),
			commentId: commentZ,
			createdAt: new Date("2026-09-07T00:00:00Z"),
		});
		await seedPosition({
			userId: userA,
			marketId: mPost,
			side: "YES",
			quantity: dp18("20"),
		});

		const rows = await loadProfilePositions(testDb, { userId: userA });
		const replyRow = rows.find((r) => r.marketId === mReply);
		const postRow = rows.find((r) => r.marketId === mPost);

		// Reply case: opener = B (the reply), pointing at P's ordinal.
		expect(replyRow?.side).toBe("NO");
		expect(replyRow?.staked).toBe(dp18("80"));
		const replyCell = replyRow?.argument;
		expect(replyCell?.removed).toBe(false);
		if (replyCell && replyCell.removed === false) {
			expect(replyCell.commentId).toBe(commentB);
			expect(replyCell.title).toBe(
				deriveTitleTeaser("Counter reply B is the current episode opener")
					.title,
			);
			expect(replyCell.isReply).toBe(true);
			expect(replyCell.postOrdinal).toBe(2);
			expect(replyCell.repliedToTitle).toBe(
				deriveTitleTeaser("Parent post P by another author").title,
			);
			expect(replyCell.marketSlug).toBe("m-reply");
		}

		// Plain-post case: opener = Z (a post), its own ordinal 3, no reply line.
		const postCell = postRow?.argument;
		expect(postCell?.removed).toBe(false);
		if (postCell && postCell.removed === false) {
			expect(postCell.commentId).toBe(commentZ);
			expect(postCell.title).toBe(
				deriveTitleTeaser("Plain post Z opener at ordinal three").title,
			);
			expect(postCell.isReply).toBe(false);
			expect(postCell.postOrdinal).toBe(3);
			expect(postCell.repliedToTitle).toBeNull();
			expect(postCell.marketSlug).toBe("m-post");
		}
	});

	it("closed-row-derivation", async () => {
		// N-1b / OQ-9 A: a Resolved market with a persisted position AND
		// payout_events → ONE settled=true row. Staked = the final episode's Đa;
		// Current = net Σ payout amounts (bet_payout + correction pair netted).
		const userA = await seedUser("closed-user", "closed");
		const marketId = await seedMarket("m-closed", "Resolved", {
			outcome: "YES",
		});
		await seedPool(marketId);
		const commentId = await seedComment({
			userId: userA,
			marketId,
			body: "Closed market argument",
			side: "YES",
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		const betId = await seedBet({
			userId: userA,
			marketId,
			side: "YES",
			stake: dp18("200"),
			shares: dp18("100"),
			commentId,
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		// Position persists post-settlement (INV-4 — never zeroed at resolve).
		await seedPosition({
			userId: userA,
			marketId,
			side: "YES",
			quantity: dp18("100"),
		});

		// resolve then a correction pair.
		const revResolve = await seedResolution({
			marketId,
			kind: "resolve",
			outcome: "YES",
			reason: "Criterion met.",
		});
		const revCorrect = await seedResolution({
			marketId,
			kind: "correct",
			outcome: "YES",
			reason: "Correcting the payout.",
			correctsEventId: revResolve,
		});
		await seedPayout({
			betId,
			userId: userA,
			marketId,
			resolutionEventId: revResolve,
			payoutType: "bet_payout",
			amount: dp18("300"),
		});
		await seedPayout({
			betId,
			userId: userA,
			marketId,
			resolutionEventId: revCorrect,
			payoutType: "correction_reverse",
			amount: dp18("-300"),
		});
		await seedPayout({
			betId,
			userId: userA,
			marketId,
			resolutionEventId: revCorrect,
			payoutType: "correction_apply",
			amount: dp18("250"),
		});

		const rows = await loadProfilePositions(testDb, { userId: userA });
		const closedRows = rows.filter((r) => r.marketId === marketId);
		// Exactly ONE row — no settled=false duplicate for the same (user, market).
		expect(closedRows.length).toBe(1);
		const row = closedRows[0];

		expect(row?.settled).toBe(true);
		expect(row?.marketStatus).toBe("Resolved");
		expect(row?.statusLabel).toBe("Closed");
		expect(row?.side).toBe("YES");
		expect(row?.quantity).toBe(dp18("100"));
		expect(row?.staked).toBe(dp18("200"));
		// 300 + (−300) + 250 = 250.
		expect(row?.current).toBe(dp18("250"));
	});

	it("fully-exited-open-market-yields-no-row", async () => {
		// OQ-3 A: an exited, still-Open market has nothing to value or settle — NO
		// row. A separate still-held market is the selectivity control.
		const userA = await seedUser("exit-user", "exit");
		const mExit = await seedMarket("m-exit", "Open");
		await seedPool(mExit);
		const exitComment = await seedComment({
			userId: userA,
			marketId: mExit,
			body: "Exited market argument",
			side: "YES",
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId: mExit,
			side: "YES",
			stake: dp18("100"),
			shares: dp18("40"),
			commentId: exitComment,
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		await seedSell({
			userId: userA,
			marketId: mExit,
			side: "YES",
			sharesSold: dp18("40"),
			proceeds: dp18("20"),
			createdAt: new Date("2026-09-20T11:00:00Z"),
		});
		// The position persists at zero after the full exit.
		await seedPosition({
			userId: userA,
			marketId: mExit,
			side: "YES",
			quantity: dp18("0"),
		});

		// Control: a still-held market — proves the loader is selective, not empty.
		const mHeld = await seedMarket("m-held-control", "Open");
		await seedPool(mHeld);
		const heldComment = await seedComment({
			userId: userA,
			marketId: mHeld,
			body: "Held control argument",
			side: "YES",
			createdAt: new Date("2026-09-21T10:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId: mHeld,
			side: "YES",
			stake: dp18("50"),
			shares: dp18("20"),
			commentId: heldComment,
			createdAt: new Date("2026-09-21T10:00:00Z"),
		});
		await seedPosition({
			userId: userA,
			marketId: mHeld,
			side: "YES",
			quantity: dp18("20"),
		});

		const rows = await loadProfilePositions(testDb, { userId: userA });
		expect(rows.filter((r) => r.marketId === mExit).length).toBe(0);
		expect(rows.filter((r) => r.marketId === mHeld).length).toBe(1);
	});

	it("fully-exited-then-settled-yields-no-row", async () => {
		// @code-reviewer HIGH-1 (Slice 2): a user who FULLY EXITS before the
		// market settles has a zero-quantity position AND a zero-amount
		// payout_events row (settle.ts writes one payout per bet, zero legs
		// included). OQ-3 A: an exited participation carries NO positions row —
		// its record lives in the argument list + graph, not the table. The
		// closed-row domain is held-to-settlement, not every payout.
		const userA = await seedUser("exited-settled-user", "exited-settled");
		const marketId = await seedMarket("m-exited-settled", "Resolved", {
			outcome: "YES",
		});
		await seedPool(marketId);
		const commentId = await seedComment({
			userId: userA,
			marketId,
			body: "Exited before settlement argument",
			side: "YES",
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		const betId = await seedBet({
			userId: userA,
			marketId,
			side: "YES",
			stake: dp18("100"),
			shares: dp18("40"),
			commentId,
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		// Full exit BEFORE settlement → position 0.
		await seedSell({
			userId: userA,
			marketId,
			side: "YES",
			sharesSold: dp18("40"),
			proceeds: dp18("20"),
			createdAt: new Date("2026-09-21T10:00:00Z"),
		});
		await seedPosition({
			userId: userA,
			marketId,
			side: "YES",
			quantity: dp18("0"),
		});
		// Settlement still writes a zero-amount payout row for the exited bet.
		const resolutionId = await seedResolution({
			marketId,
			kind: "resolve",
			outcome: "YES",
			reason: "Criterion met.",
		});
		await seedPayout({
			betId,
			userId: userA,
			marketId,
			resolutionEventId: resolutionId,
			payoutType: "bet_payout",
			amount: dp18("0"),
		});

		const rows = await loadProfilePositions(testDb, { userId: userA });
		expect(rows.filter((r) => r.marketId === marketId).length).toBe(0);
	});

	it("held-in-closed-unsettled-market", async () => {
		// A held position in a `Closed` (not yet settled) market: settled=false
		// (no payout exists) but statusLabel="Closed" (market state), current=Đb.
		const userA = await seedUser("closed-unsettled-user", "closed-unsettled");
		const marketId = await seedMarket("m-closed-unsettled", "Closed");
		await seedPool(marketId);
		const commentId = await seedComment({
			userId: userA,
			marketId,
			body: "Closed unsettled argument",
			side: "YES",
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId,
			side: "YES",
			stake: dp18("50"),
			shares: dp18("20"),
			commentId,
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		await seedPosition({
			userId: userA,
			marketId,
			side: "YES",
			quantity: dp18("20"),
		});

		const rows = await loadProfilePositions(testDb, { userId: userA });
		expect(rows.length).toBe(1);
		const row = rows[0];

		expect(row?.settled).toBe(false);
		expect(row?.marketStatus).toBe("Closed");
		expect(row?.statusLabel).toBe("Closed");
		const expected = computeSell({
			reserves: { yes: POOL, no: POOL },
			side: lc("YES"),
			shares: dp18("20"),
		}).proceeds;
		expect(row?.current).toBe(expected);
	});

	it("removed-opener-argument-stub", async () => {
		// A `content_removed` opener → the stub variant: NO title/body fields
		// (compile-level no-leak). The row itself is a normal held row.
		const userA = await seedUser("removed-opener-user", "removed-opener");
		const marketId = await seedMarket("m-removed-opener", "Open");
		await seedPool(marketId);
		const commentId = await seedComment({
			userId: userA,
			marketId,
			body: "This opener will be removed by a moderator",
			side: "YES",
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId,
			side: "YES",
			stake: dp18("50"),
			shares: dp18("20"),
			commentId,
			createdAt: new Date("2026-09-20T10:00:00Z"),
		});
		await seedPosition({
			userId: userA,
			marketId,
			side: "YES",
			quantity: dp18("20"),
		});
		await seedRemoval(commentId);

		const rows = await loadProfilePositions(testDb, { userId: userA });
		expect(rows.length).toBe(1);
		const cell = rows[0]?.argument;

		expect(cell?.removed).toBe(true);
		if (cell && cell.removed === true) {
			expect(cell.marketSlug).toBe("m-removed-opener");
		}
		// No content leak: the stub variant carries no `title` key at all.
		expect("title" in (cell ?? {})).toBe(false);
	});
});
