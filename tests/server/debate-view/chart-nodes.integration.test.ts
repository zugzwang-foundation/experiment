import { afterEach, describe, expect, it, vi } from "vitest";

// UI.19 Slice 2 tests-first (plan §Slice 2 integration tests / SPEC.1 1.0.22 §9
// "Post nodes" + F-DEBATE-5) — the RED driver for the market-detail price chart's
// EXPANDED post nodes riding `loadDebateView` on `model.priceChart.nodes`. The
// impl widens `DebateViewModel.priceChart` from `{ series } | null` to
// `{ series; nodes } | null` and folds `deriveMarketPriceChart` (which calls the
// new pure `selectChartNodes(postSubstrate, removedSet, walk)`) into
// `load-debate-view.ts`, reusing the ALREADY-loaded `postSubstrate` + `removedSet`
// + the ONE `replayReserveSeries` walk.
//
// RED target: the CURRENT (slice-1) `loadDebateView` sets `priceChart = { series }`
// with NO `nodes` field, so `nodesOf(model)`'s `expect(pc.nodes).toBeDefined()`
// fails at runtime (the field is undefined) — RED by ASSERTION, not collection
// (CLAUDE.md §5.6). `loadDebateView` already exists; nothing is imported from a
// not-yet-existing module (the ChartNode shape is INLINED), so this file COLLECTS.
//
// Node selection (plan §3c / SPEC.1 §9 "Post nodes"): `ordered = topOrder(substrate)`
// (pure §9 Top, NO interleave) → iterate in Top order → bucket by
// `(utcDay(createdAt), parentSide)` → the FIRST eligible (not content-removed) post
// per bucket WINS; later bucket members drop. A partition over the existing Top
// order — NEVER a second ranking rule. node = { id, side: parentSide (INV-3), at,
// yYes: getPrices(reservesAt(walk, createdAt)).yes }. Replies are not nodes. The
// set freezes with the market (INV-4).
//
// Top order is made deterministic here with ZERO replies: every post has n=0/D=0,
// so `topOrder` falls to the §3.4 tiebreak (higher authorStake first, then earlier
// createdAt, then smaller id). The intended bucket-WINNER is seeded with a HIGHER
// entry-bet `stake` (= its authorStake) so it ranks first in its bucket.
//
// Money / prices cross as STRINGS ("0.5…"), sides "YES"|"NO" (CLAUDE.md §2 — never
// JS floats). Every expected node price is computed by the test ITSELF via the same
// pure CPMM walk the impl replays (getPrices over the FLOORED reserve walk). Per
// pre-ruled decision (a): a post's comment/bet/`bet.placed` event share ONE
// `createdAt`, so `reservesAt(walk, createdAt)` lands on the post's OWN bet vertex —
// the node's yYes equals getPrices(reserves-after-that-bet).yes. DB-backed (local
// Postgres :54322). TRUNCATE (mod_actions included) in afterEach.

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	captureException: vi.fn(),
	addBreadcrumb: vi.fn(),
	flush: vi.fn(async () => true),
}));

const { mockSignRead } = vi.hoisted(() => ({
	mockSignRead: vi.fn(async (key: string) => `https://signed.example/${key}`),
}));
vi.mock("@/server/storage/sign-read", () => ({ signRead: mockSignRead }));

import {
	bets,
	comments,
	events,
	markets,
	modActions,
	pools,
	users,
} from "@/db/schema";
import {
	computeBuy,
	getPrices,
	type Reserves,
	seedPool,
} from "@/server/cpmm/calculate";
import {
	type DebateViewModel,
	loadDebateView,
} from "@/server/debate-view/load-debate-view";
import type { MarketSummary } from "@/server/markets/get-by-slug";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const SEED_AMOUNT = "100.000000000000000000";

// Fixed 2026-09 instants — inside the events_2026_09 partition range.
const OPENED_AT = new Date("2026-09-10T00:00:00.000Z");

// The additive node field the impl lands on `DebateViewModel.priceChart` (the
// slice-1 `{ series }` widens to `{ series; nodes }`). The shape is INLINED (not
// imported from the not-yet-exported `ChartNode`) so this file collects; the RED
// is that `nodes` is `undefined` on the slice-1 return.
type ChartNodeShape = {
	id: string;
	side: "YES" | "NO";
	at: string;
	yYes: string;
};
type ChartModel = DebateViewModel & {
	priceChart: {
		series: { at: string; yes: string }[];
		nodes: ChartNodeShape[];
	} | null;
};

async function seedMarket(
	slug: string,
	status: MarketSummary["status"] = "Open",
): Promise<MarketSummary> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Chart Nodes Market",
			description: "Resolution criterion text.",
			status,
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({
			id: markets.id,
			slug: markets.slug,
			title: markets.title,
			description: markets.description,
			status: markets.status,
		});
	return market as MarketSummary;
}

async function seedPoolRow(
	marketId: string,
	yesReserves: string,
	noReserves: string,
): Promise<void> {
	await testDb.insert(pools).values({ marketId, yesReserves, noReserves });
}

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Nodes User",
			email: `${tag}@example.com`,
			pseudonym: tag,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

type NewEventRow = typeof events.$inferInsert;

/** aggregate.type/.id mirror the LIVE emitters: market.opened → ("market",
 * marketId); bet.placed → ("bet", betId). */
function eventRow(
	eventType: "market.opened" | "bet.placed",
	aggregate: { type: "market" | "bet"; id: string },
	payload: Record<string, unknown>,
	createdAt: Date,
): NewEventRow {
	return {
		eventType,
		aggregateType: aggregate.type,
		aggregateId: aggregate.id,
		payload,
		payloadVersion: 1,
		metadata: {},
		createdAt,
	};
}

/** The live buy write-shape a `bet.placed` event rides on: a comment + its
 * riding `bets` row (`bets.comment_id` populated; `comments.bet_id` NULL). A
 * reply-bet carries a `parentCommentId`; a top-level post-bet leaves it null. */
async function seedBetRow(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	shares: string;
	price: string;
	createdAt: Date;
	parentCommentId?: string | null;
}): Promise<{ betId: string; commentId: string }> {
	const [c] = await testDb
		.insert(comments)
		.values({
			userId: args.userId,
			marketId: args.marketId,
			body: "post",
			sideAtPostTime: args.side,
			parentCommentId: args.parentCommentId ?? null,
			betId: null,
			createdAt: args.createdAt,
		})
		.returning({ id: comments.id });
	const commentId = c?.id ?? "";
	const [b] = await testDb
		.insert(bets)
		.values({
			userId: args.userId,
			marketId: args.marketId,
			side: args.side,
			stake: args.stake,
			shareQuantity: args.shares,
			priceAtBet: args.price,
			commentId,
			createdAt: args.createdAt,
		})
		.returning({ id: bets.id });
	return { betId: b?.id ?? "", commentId };
}

function betPlacedPayload(args: {
	betId: string;
	marketId: string;
	userId: string;
	commentId: string;
	side: "YES" | "NO";
	stake: string;
	shares: string;
	price: string;
	parentCommentId?: string | null;
}): Record<string, unknown> {
	return {
		betId: args.betId,
		marketId: args.marketId,
		userId: args.userId,
		side: args.side,
		stake: args.stake,
		shares: args.shares,
		price: args.price,
		commentId: args.commentId,
		parentCommentId: args.parentCommentId ?? null,
	};
}

/** Record a `content_removed` mod_action against a target comment (the SINGLE
 * masking signal — never a user ban; ADR-0021 §4). */
async function removeComment(commentId: string): Promise<void> {
	await testDb.insert(modActions).values({
		targetCommentId: commentId,
		reason: "content_removed",
		verdict: null,
		categories: {},
		actorId: "admin-singleton",
	});
}

/** One post to seed: a top-level post-bet (parentTag omitted) OR a reply-bet
 * (parentTag = an already-seeded post's tag). MUST be listed in `at`-ascending
 * order — the replay orders bet events by created_at, so the array order and the
 * running CPMM walk must match it. `stake` doubles as the post's authorStake (the
 * §3.4 tiebreak key) and its buy size. */
type PostSpec = {
	tag: string;
	side: "YES" | "NO";
	stake: string;
	at: Date;
	parentTag?: string;
};

type SeededPost = {
	commentId: string;
	side: "YES" | "NO";
	at: Date;
	/** Reserves AFTER this post's own buy — `reservesAt(walk, at)` resolves here
	 * (the post's bet vertex is the last walk step ≤ its createdAt). */
	reservesAfter: Reserves;
	isReply: boolean;
};

/**
 * Seed a market + `market.opened` seed event + a chain of post/reply bets (each a
 * real `bets` row + a BET-aggregate `bet.placed` event), walking the pure CPMM
 * reserves so the expected node prices are derived by the TEST. Mirrors the
 * slice-1 `seedMarketWithBuys` primitives; captures per-post `commentId` +
 * `reservesAfter` (needed to assert WHICH posts became nodes and their frozen
 * yYes). Uses ONE user per market — irrelevant to ranking, which reads
 * authorStake / createdAt / id, never userId.
 */
async function seedMarketWithPosts(args: {
	slug: string;
	status?: MarketSummary["status"];
	posts: PostSpec[];
}): Promise<{
	market: MarketSummary;
	byTag: Map<string, SeededPost>;
	finalReserves: Reserves;
}> {
	const market = await seedMarket(args.slug, args.status ?? "Open");
	const userId = await seedUser(`u-${args.slug}`);

	let reserves = seedPool(SEED_AMOUNT);
	const byTag = new Map<string, SeededPost>();
	const eventRows: NewEventRow[] = [
		eventRow(
			"market.opened",
			{ type: "market", id: market.id },
			{ marketId: market.id, seedAmount: SEED_AMOUNT },
			OPENED_AT,
		),
	];

	for (const spec of args.posts) {
		const parentCommentId = spec.parentTag
			? (byTag.get(spec.parentTag)?.commentId ?? null)
			: null;
		const res = computeBuy({
			reserves,
			side: spec.side === "YES" ? "yes" : "no",
			stake: spec.stake,
		});
		reserves = res.reserves;
		const row = await seedBetRow({
			userId,
			marketId: market.id,
			side: spec.side,
			stake: spec.stake,
			shares: res.shares,
			price: res.pEff,
			createdAt: spec.at,
			parentCommentId,
		});
		eventRows.push(
			eventRow(
				"bet.placed",
				{ type: "bet", id: row.betId },
				betPlacedPayload({
					betId: row.betId,
					marketId: market.id,
					userId,
					commentId: row.commentId,
					side: spec.side,
					stake: spec.stake,
					shares: res.shares,
					price: res.pEff,
					parentCommentId,
				}),
				spec.at,
			),
		);
		byTag.set(spec.tag, {
			commentId: row.commentId,
			side: spec.side,
			at: spec.at,
			reservesAfter: reserves,
			isReply: parentCommentId !== null,
		});
	}

	await testDb.insert(events).values(eventRows);
	return { market, byTag, finalReserves: reserves };
}

/** Read `model.priceChart.nodes`, asserting the additive field is present. In RED
 * `priceChart.nodes` is `undefined` (slice-1 sets only `{ series }`) →
 * `toBeDefined()` fails → the test reds by assertion (CLAUDE.md §5.6). */
function nodesOf(model: ChartModel): ChartNodeShape[] {
	expect(model.priceChart).toBeDefined();
	expect(model.priceChart).not.toBeNull();
	const pc = model.priceChart as {
		series: { at: string; yes: string }[];
		nodes: ChartNodeShape[];
	};
	expect(pc.nodes).toBeDefined();
	expect(Array.isArray(pc.nodes)).toBe(true);
	return pc.nodes;
}

async function loadChart(market: MarketSummary): Promise<ChartModel> {
	return (await loadDebateView(testDb, { market })) as ChartModel;
}

const idSet = (nodes: ChartNodeShape[]): Set<string> =>
	new Set(nodes.map((n) => n.id));

const findNode = (
	nodes: ChartNodeShape[],
	id: string,
): ChartNodeShape | undefined => nodes.find((n) => n.id === id);

/** The bucket key the selector partitions on: (utcDay, side). */
const bucketKey = (n: ChartNodeShape): string =>
	`${n.at.slice(0, 10)}|${n.side}`;

describe("UI.19 §9 — market price-chart post nodes on model.priceChart.nodes (F-DEBATE-5)", () => {
	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"payout_events",
			"resolution_events",
			"dharma_ledger",
			"bets",
			"comments",
			"positions",
			"pools",
			"market_media",
			"markets",
			"mod_actions",
			"users",
		]);
		vi.clearAllMocks();
	});

	// ── One top post per (UTC day, side) — higher-stake wins its bucket ──────────
	it("top-post-per-utc-day-per-side", async () => {
		const { market, byTag, finalReserves } = await seedMarketWithPosts({
			slug: "nodes-top",
			posts: [
				// Bucket (YES, 09-10): a1 (stake 50) beats a2 (stake 10).
				{
					tag: "a1",
					side: "YES",
					stake: "50.000000000000000000",
					at: new Date("2026-09-10T00:05:00.000Z"),
				},
				{
					tag: "a2",
					side: "YES",
					stake: "10.000000000000000000",
					at: new Date("2026-09-10T00:10:00.000Z"),
				},
				// Bucket (NO, 09-10): sole member b1.
				{
					tag: "b1",
					side: "NO",
					stake: "30.000000000000000000",
					at: new Date("2026-09-10T00:15:00.000Z"),
				},
				// Bucket (YES, 09-11 — a DIFFERENT day): sole member c1.
				{
					tag: "c1",
					side: "YES",
					stake: "20.000000000000000000",
					at: new Date("2026-09-11T00:05:00.000Z"),
				},
			],
		});
		await seedPoolRow(market.id, finalReserves.yes, finalReserves.no);

		const a1 = byTag.get("a1") as SeededPost;
		const a2 = byTag.get("a2") as SeededPost;
		const b1 = byTag.get("b1") as SeededPost;
		const c1 = byTag.get("c1") as SeededPost;

		const nodes = nodesOf(await loadChart(market));

		// Exactly one node per (utcDay, side) bucket — three buckets, three nodes.
		expect(nodes).toHaveLength(3);
		expect(new Set(nodes.map(bucketKey)).size).toBe(3);

		// The winning ids: a1 (beat a2 on stake), b1, c1. a2 dropped its bucket.
		expect(idSet(nodes)).toEqual(
			new Set([a1.commentId, b1.commentId, c1.commentId]),
		);
		expect(idSet(nodes).has(a2.commentId)).toBe(false);

		// Node side is the post's frozen side; node.at is the post's createdAt.
		expect(findNode(nodes, a1.commentId)?.side).toBe("YES");
		expect(findNode(nodes, b1.commentId)?.side).toBe("NO");
		expect(findNode(nodes, c1.commentId)?.side).toBe("YES");
		expect(findNode(nodes, a1.commentId)?.at).toBe(a1.at.toISOString());

		// Node y is the YES price at the post's own bet vertex (decision a) — computed
		// by the test via the same pure CPMM walk, never a JS float.
		expect(findNode(nodes, a1.commentId)?.yYes).toBe(
			getPrices(a1.reservesAfter).yes,
		);

		// Array order: sorted by (at asc, id asc) — strictly ascending ats here.
		expect(nodes[0]?.id).toBe(a1.commentId);
		expect(nodes[1]?.id).toBe(b1.commentId);
		expect(nodes[2]?.id).toBe(c1.commentId);
	});

	// ── Content-removed post excluded from node eligibility (masking, ADR-0021) ──
	it("content-removed-excluded-from-nodes", async () => {
		const { market, byTag, finalReserves } = await seedMarketWithPosts({
			slug: "nodes-removed",
			posts: [
				// Bucket (YES, 09-10): win (stake 50) would beat next (stake 10)…
				{
					tag: "win",
					side: "YES",
					stake: "50.000000000000000000",
					at: new Date("2026-09-10T00:05:00.000Z"),
				},
				{
					tag: "next",
					side: "YES",
					stake: "10.000000000000000000",
					at: new Date("2026-09-10T00:10:00.000Z"),
				},
			],
		});
		await seedPoolRow(market.id, finalReserves.yes, finalReserves.no);

		const win = byTag.get("win") as SeededPost;
		const next = byTag.get("next") as SeededPost;

		// …but `win` is content-removed → the next eligible post takes the slot.
		await removeComment(win.commentId);

		const nodes = nodesOf(await loadChart(market));

		// The removed id is NOT a node; the next-eligible id IS (mirrors §22 F-DISC-2).
		expect(idSet(nodes).has(win.commentId)).toBe(false);
		expect(idSet(nodes).has(next.commentId)).toBe(true);
		expect(nodes).toHaveLength(1);
		expect(nodes[0]?.id).toBe(next.commentId);
		// The slot's y is the surviving post's frozen price (its own bet vertex).
		expect(nodes[0]?.yYes).toBe(getPrices(next.reservesAfter).yes);
	});

	// ── INV-3: node side is the post's frozen side_at_post_time — never re-sided ─
	it("node-side-frozen-at-post-time", async () => {
		const { market, byTag, finalReserves } = await seedMarketWithPosts({
			slug: "nodes-inv3",
			posts: [
				// A YES post at symmetric-ish price…
				{
					tag: "postYes",
					side: "YES",
					stake: "25.000000000000000000",
					at: new Date("2026-09-10T00:05:00.000Z"),
				},
				// …then a LARGE NO buy pushes the market YES price well below the YES
				// post's frozen price — the node must NOT follow the flip.
				{
					tag: "postNo",
					side: "NO",
					stake: "200.000000000000000000",
					at: new Date("2026-09-10T00:10:00.000Z"),
				},
			],
		});
		await seedPoolRow(market.id, finalReserves.yes, finalReserves.no);

		const postYes = byTag.get("postYes") as SeededPost;
		const postNo = byTag.get("postNo") as SeededPost;

		const nodes = nodesOf(await loadChart(market));

		// Each node's side is exactly its post's `side_at_post_time` (immutable,
		// Bucket-A append-only) — the YES post stays YES though the market now leans NO.
		expect(findNode(nodes, postYes.commentId)?.side).toBe("YES");
		expect(findNode(nodes, postNo.commentId)?.side).toBe("NO");

		// Frozen-at-post-time price half of INV-3: the YES node's yYes is the price
		// at ITS OWN vertex, NOT the current (post-NO-buy) spot. They differ here.
		expect(findNode(nodes, postYes.commentId)?.yYes).toBe(
			getPrices(postYes.reservesAfter).yes,
		);
		expect(findNode(nodes, postYes.commentId)?.yYes).not.toBe(
			getPrices(finalReserves).yes,
		);
	});

	// ── INV-4: on a non-Open (Resolved) market the node set is frozen + stable ───
	it("frozen-after-resolution", async () => {
		const { market, byTag, finalReserves } = await seedMarketWithPosts({
			slug: "nodes-frozen",
			status: "Resolved",
			posts: [
				{
					tag: "p1",
					side: "YES",
					stake: "25.000000000000000000",
					at: new Date("2026-09-10T00:05:00.000Z"),
				},
				{
					tag: "p2",
					side: "NO",
					stake: "30.000000000000000000",
					at: new Date("2026-09-10T00:10:00.000Z"),
				},
			],
		});
		await seedPoolRow(market.id, finalReserves.yes, finalReserves.no);

		const p1 = byTag.get("p1") as SeededPost;
		const p2 = byTag.get("p2") as SeededPost;

		const model = await loadChart(market);
		expect(model.market.status).toBe("Resolved"); // non-Open

		const nodes = nodesOf(model);
		expect(idSet(nodes)).toEqual(new Set([p1.commentId, p2.commentId]));

		// Frozen by construction (no `now` param; append-only substrate + walk): a
		// second identical read yields byte-identical nodes.
		const again = nodesOf(await loadChart(market));
		expect(again).toEqual(nodes);
	});

	// ── Replies are NOT nodes — only top-level posts ─────────────────────────────
	it("replies-are-not-nodes", async () => {
		const { market, byTag, finalReserves } = await seedMarketWithPosts({
			slug: "nodes-replies",
			posts: [
				{
					tag: "post",
					side: "YES",
					stake: "25.000000000000000000",
					at: new Date("2026-09-10T00:05:00.000Z"),
				},
				// A reply-bet (parentTag = the post) — a real Support reply-bet, NOT a
				// top-level post, so it is never in the ranking substrate → never a node.
				{
					tag: "reply",
					side: "YES",
					stake: "10.000000000000000000",
					at: new Date("2026-09-10T00:10:00.000Z"),
					parentTag: "post",
				},
			],
		});
		await seedPoolRow(market.id, finalReserves.yes, finalReserves.no);

		const post = byTag.get("post") as SeededPost;
		const reply = byTag.get("reply") as SeededPost;
		expect(reply.isReply).toBe(true); // fixture sanity

		const nodes = nodesOf(await loadChart(market));

		// Only the top-level post is a node; the reply's comment id is never one.
		expect(nodes).toHaveLength(1);
		expect(nodes[0]?.id).toBe(post.commentId);
		expect(idSet(nodes).has(reply.commentId)).toBe(false);
	});
});
