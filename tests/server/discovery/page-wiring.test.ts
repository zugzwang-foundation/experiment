import { afterEach, describe, expect, it, vi } from "vitest";

// UI.A4 Slice 6 tests-first (plan §2 row 6 / §4 wiring / §11 "tests/server/
// discovery/* integration wiring") — the RED driver for the Discovery page's
// OWN read-model composition, end-to-end against REAL read-models on the
// local test Postgres (:54322).
//
// RED target: `@/app/(public)/page` does NOT exist yet (only the root
// `src/app/page.tsx` coming-soon placeholder, displaced in this slice) —
// this file fails at COLLECTION on that unresolvable import until Slice 6's
// implement phase lands the page.
//
// DELIBERATE first real-`db` integration precedent: unlike the Slice 1–3
// suites (which pass `testDb` into the loaders), this file imports
// `DiscoveryContent` and lets the page use its OWN `db` from `@/db`
// (DATABASE_URL defaults to :54322 via tests/_setup/env.ts; `server-only` is
// shimmed via vitest.config.ts resolve.alias) — exercising the page's real
// composition path: `listOpenMarkets(db)` → per-market `loadPriceSeries` +
// `selectHeroTopPosts` → `<DiscoveryCarousel markets={…} />`.
//
// Element-assertion law: NO jsdom, NO DOM render — assert on the returned
// React ELEMENT: `el.type` by imported component REFERENCE, and
// `el.props.markets` (the DiscoveryMarketView[]) directly. NEVER
// JSON.stringify the element tree itself (component types don't serialize) —
// stringify `el.props.markets` for the never-echo sweeps.
//
// Fixture kit: the hero.test.ts helpers (seedUser / seedCommentWithBet /
// seedSupportReplies / removeComment / requirePost / at() / truncate list
// incl. market_media) — seedMarket extended with the list.test.ts optional
// `createdAt` (the newest-first arm needs distinct market ages) — plus the
// price-series.test.ts event shapes (eventRow / market.opened seed /
// BET-aggregate bet.placed riding a REAL comment+bet write-shape;
// `bets.comment_id` populated, `comments.bet_id` stays NULL — SPEC.2 §14.1).
// Money crosses as a STRING end-to-end (CLAUDE.md §2); expected series
// values are derived IN-TEST via the same pure CPMM functions the replay
// uses. R2 + Sentry are mocked at the module boundary because the page's
// import graph pulls BOTH: list.ts → media.ts → `@/server/storage/r2`, and
// price-series.ts → safe-capture → `@sentry/nextjs`.

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

vi.mock("@/server/storage/r2", () => ({
	mintReadUrl: vi.fn(
		async (bucket: string, key: string, ttlSeconds: number) =>
			`https://signed.test/${bucket}/${key}?ttl=${ttlSeconds}`,
	),
}));

// RED import: the greenfield Slice-6 page under test (fails collection).
import { DiscoveryContent } from "@/app/(public)/page";
import {
	DiscoveryCarousel,
	type DiscoveryMarketView,
} from "@/components/discovery/DiscoveryCarousel";
import { EmptyState } from "@/components/discovery/EmptyState";
import {
	bets,
	comments,
	events,
	markets,
	modActions,
	users,
} from "@/db/schema";
import { topOrder } from "@/lib/ranking";
import { computeBuy, getPrices, seedPool } from "@/server/cpmm/calculate";
import { loadRankingSubstrate } from "@/server/debate-view/ranking-substrate";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const SEED_AMOUNT = "100.000000000000000000";

// Fixed 2026-09 instants inside the events partition range (2026-05…
// 2027-04). Market B's TWO instants each fall strictly BETWEEN consecutive
// instants of market A's walk (the Slice-2 reviewer's carried isolation
// LOW): a market-scoping bug in the events scan — or any time-window merge —
// pulls the other market's steps into the walk and changes both counts and
// values below. Millisecond-exact Dates round-trip timestamptz losslessly.
const A_OPENED_AT = new Date("2026-09-10T00:00:00.000Z");
const B_OPENED_AT = new Date("2026-09-10T00:02:30.000Z");
const A_BUY1_AT = new Date("2026-09-10T00:05:00.000Z");
const B_BUY1_AT = new Date("2026-09-10T00:07:30.000Z");
const A_BUY2_AT = new Date("2026-09-10T00:10:00.000Z");

/** Deterministic distinct timestamps — i seconds past a fixed UTC base. */
function at(i: number): Date {
	return new Date(Date.UTC(2026, 8, 15, 0, 0, i));
}

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Wiring User",
			email: `${tag}@example.com`,
			pseudonym: tag,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

/** hero.test.ts seedMarket + the list.test.ts optional createdAt (the
 * newest-first assertion needs markets of distinct, controlled age). */
async function seedMarket(slug: string, createdAt?: Date): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Discovery Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
			...(createdAt ? { createdAt } : {}),
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

/** Direct-seed a post/reply + its riding bet (the stake/aggregate source). */
async function seedCommentWithBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	body: string;
	parentCommentId: string | null;
	createdAt: Date;
}): Promise<string> {
	const [c] = await testDb
		.insert(comments)
		.values({
			userId: args.userId,
			marketId: args.marketId,
			body: args.body,
			sideAtPostTime: args.side,
			parentCommentId: args.parentCommentId,
			betId: null,
			createdAt: args.createdAt,
		})
		.returning({ id: comments.id });
	const commentId = c?.id ?? "";
	await testDb.insert(bets).values({
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		stake: args.stake,
		shareQuantity: "0",
		priceAtBet: "0.5",
		commentId,
		createdAt: args.createdAt,
	});
	return commentId;
}

/**
 * Seed `count` Support reply-bets (reply side = parent side) of Đ50 each on a
 * post — 5 replies clear BOTH the traction floor (n ≥ 5) and the stake floor
 * (D = 250 ≥ 200) of the default ranking config, so the parent is a real §9
 * Top floor-clearer, not a created_at accident.
 */
async function seedSupportReplies(args: {
	userId: string;
	marketId: string;
	parentCommentId: string;
	side: "YES" | "NO";
	count: number;
	firstAt: number;
}): Promise<void> {
	for (let i = 0; i < args.count; i++) {
		await seedCommentWithBet({
			userId: args.userId,
			marketId: args.marketId,
			side: args.side,
			stake: "50.000000000000000000",
			body: `support reply ${i + 1}`,
			parentCommentId: args.parentCommentId,
			createdAt: at(args.firstAt + i),
		});
	}
}

/** Record a `content_removed` mod_action against a target comment (the
 * Track-B-hidden masking input — the load-debate-view fixture precedent). */
async function removeComment(commentId: string): Promise<void> {
	await testDb.insert(modActions).values({
		targetCommentId: commentId,
		reason: "content_removed",
		verdict: null,
		categories: {},
		actorId: "admin-singleton",
	});
}

type NewEventRow = typeof events.$inferInsert;

/** aggregate.type/.id mirror the LIVE emitters: market.opened → ("market",
 * marketId); bet.placed → ("bet", betId) — the price-series.test.ts shapes. */
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

/** The market.opened seed event — the replay's first (0.5) point. */
async function seedOpened(marketId: string, createdAt: Date): Promise<void> {
	await testDb
		.insert(events)
		.values(
			eventRow(
				"market.opened",
				{ type: "market", id: marketId },
				{ marketId, seedAmount: SEED_AMOUNT },
				createdAt,
			),
		);
}

/** One live BUY write-shape: a top-level comment + its riding `bets` row +
 * the BET-aggregate `bet.placed` event carrying the REAL ids (shape-complete
 * payload — src/server/events/schemas.ts). The buy's comment IS the
 * market's post — the topPosts pick target. Returns the comment id. */
async function seedBuy(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	shares: string;
	price: string;
	body: string;
	createdAt: Date;
}): Promise<string> {
	const [c] = await testDb
		.insert(comments)
		.values({
			userId: args.userId,
			marketId: args.marketId,
			body: args.body,
			sideAtPostTime: args.side,
			parentCommentId: null,
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
	const betId = b?.id ?? "";
	await testDb.insert(events).values(
		eventRow(
			"bet.placed",
			{ type: "bet", id: betId },
			{
				betId,
				marketId: args.marketId,
				userId: args.userId,
				side: args.side,
				stake: args.stake,
				shares: args.shares,
				price: args.price,
				commentId,
				parentCommentId: null,
			},
			args.createdAt,
		),
	);
	return commentId;
}

/** Narrow a nullable hero side — throws (fails the test) when null. */
function requirePost<T>(post: T | null): T {
	if (post === null) {
		throw new Error("expected a hero post on this side, got null");
	}
	return post;
}

describe("UI.A4 §6 — Discovery page wiring (integration, real read-models)", () => {
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

	it("wiring::two-markets-compose-isolated-series", async () => {
		// Insertion order B-then-A; createdAt makes A the NEWER market — the
		// newest-first output must come from created_at, not insert sequence.
		const marketB = await seedMarket(
			"wiring-market-b",
			new Date("2026-09-10T00:00:00Z"),
		);
		const marketA = await seedMarket(
			"wiring-market-a",
			new Date("2026-09-14T00:00:00Z"),
		);
		const userA = await seedUser("wiring-series-a");
		const userB = await seedUser("wiring-series-b");

		// The two expected walks, derived IN-TEST via the same pure CPMM
		// functions the replay uses: A = seed(100) → YES 25 → NO 10;
		// B = seed(100) → YES 15.
		const buyA1 = computeBuy({
			reserves: seedPool(SEED_AMOUNT),
			side: "yes",
			stake: "25.000000000000000000",
		});
		const buyA2 = computeBuy({
			reserves: buyA1.reserves,
			side: "no",
			stake: "10.000000000000000000",
		});
		const buyB1 = computeBuy({
			reserves: seedPool(SEED_AMOUNT),
			side: "yes",
			stake: "15.000000000000000000",
		});

		await seedOpened(marketA, A_OPENED_AT);
		await seedOpened(marketB, B_OPENED_AT);
		const aYesPost = await seedBuy({
			userId: userA,
			marketId: marketA,
			side: "YES",
			stake: "25.000000000000000000",
			shares: buyA1.shares,
			price: buyA1.pEff,
			body: "Market A YES entry argument.",
			createdAt: A_BUY1_AT,
		});
		const bYesPost = await seedBuy({
			userId: userB,
			marketId: marketB,
			side: "YES",
			stake: "15.000000000000000000",
			shares: buyB1.shares,
			price: buyB1.pEff,
			body: "Market B YES entry argument.",
			createdAt: B_BUY1_AT,
		});
		const aNoPost = await seedBuy({
			userId: userA,
			marketId: marketA,
			side: "NO",
			stake: "10.000000000000000000",
			shares: buyA2.shares,
			price: buyA2.pEff,
			body: "Market A NO entry argument.",
			createdAt: A_BUY2_AT,
		});

		const el = await DiscoveryContent();

		// The carousel arm, by component reference — with BOTH markets'
		// views composed up-front in the props (§22: the carousel re-fetches
		// nothing; the page hands it everything).
		expect(el.type).toBe(DiscoveryCarousel);
		const views: DiscoveryMarketView[] = el.props.markets;
		expect(views).toHaveLength(2);

		// Newest-first (F-DISC-1): A (newer created_at) leads despite B's
		// earlier insert.
		expect(views.map((v) => v.card.id)).toEqual([marketA, marketB]);
		expect(views.map((v) => v.card.slug)).toEqual([
			"wiring-market-a",
			"wiring-market-b",
		]);

		// Cross-market series containment: each market's series is its OWN
		// replay walk ONLY — 3 points for A, 2 for B, values exactly the
		// test-side CPMM walk. B's interleaved instants make any leakage
		// change both counts and values here.
		expect(views[0].series).toHaveLength(3);
		expect(views[0].series).toEqual([
			{ at: A_OPENED_AT.toISOString(), yes: "0.500000000000000000" },
			{ at: A_BUY1_AT.toISOString(), yes: getPrices(buyA1.reserves).yes },
			{ at: A_BUY2_AT.toISOString(), yes: getPrices(buyA2.reserves).yes },
		]);
		expect(views[1].series).toHaveLength(2);
		expect(views[1].series).toEqual([
			{ at: B_OPENED_AT.toISOString(), yes: "0.500000000000000000" },
			{ at: B_BUY1_AT.toISOString(), yes: getPrices(buyB1.reserves).yes },
		]);

		// Hero containment: each market's topPosts are its OWN posts (the buy
		// comments ARE the posts), asserted by id; B has no NO post → null.
		expect(requirePost(views[0].topPosts.yes).id).toBe(aYesPost);
		expect(requirePost(views[0].topPosts.no).id).toBe(aNoPost);
		expect(requirePost(views[1].topPosts.yes).id).toBe(bYesPost);
		expect(views[1].topPosts.no).toBeNull();
	});

	it("wiring::removed-top-post-never-in-payload", async () => {
		const marketId = await seedMarket("wiring-mask");
		const maskedAuthor = await seedUser("wiring-masked-pseudonym");
		const visibleAuthor = await seedUser("wiring-visible-author");
		const replier = await seedUser("wiring-mask-replier");

		// Distinctive identifiers for the removed post: a body marker planted
		// in BOTH the title line and the teaser paragraph, a dedicated author
		// pseudonym, and a stake chosen so NO legitimate aggregate can contain
		// it as a substring (totals.dharmaStaked = 67+21+33+250 =
		// "371.000000000000000000", which does NOT contain "67.000…" — unlike
		// the hero-suite's 60-on-300, this sweep spans the WHOLE page payload
		// including totals).
		const maskedMarker = "WIRING-MASKED-MARKER-4e7d";
		const maskedStake = "67.000000000000000000";
		const postA = await seedCommentWithBet({
			userId: maskedAuthor,
			marketId,
			side: "YES",
			stake: maskedStake,
			body: `${maskedMarker} removed YES title line\n\n${maskedMarker} removed YES teaser paragraph.`,
			parentCommentId: null,
			createdAt: at(1),
		});
		const postB = await seedCommentWithBet({
			userId: visibleAuthor,
			marketId,
			side: "YES",
			stake: "21.000000000000000000",
			body: "Second YES argument — survives masking.",
			parentCommentId: null,
			createdAt: at(2),
		});
		const noPost = await seedCommentWithBet({
			userId: visibleAuthor,
			marketId,
			side: "NO",
			stake: "33.000000000000000000",
			body: "The NO argument — untouched side.",
			parentCommentId: null,
			createdAt: at(3),
		});
		// 5 Support replies × Đ50 on A → A clears the traction + stake floors;
		// B is zero-activity.
		await seedSupportReplies({
			userId: replier,
			marketId,
			parentCommentId: postA,
			side: "YES",
			count: 5,
			firstAt: 10,
		});

		// Fixture sanity — THE DISCRIMINATING PREMISE (the hero-suite
		// pattern): unmasked §9 Top ranks A first, so a masking failure WOULD
		// surface A through the page.
		const ranked = topOrder(await loadRankingSubstrate(testDb, { marketId }));
		expect(
			ranked.filter((p) => p.parentSide === "YES").map((p) => p.id),
		).toEqual([postA, postB]);

		await removeComment(postA);

		const el = await DiscoveryContent();
		expect(el.type).toBe(DiscoveryCarousel);
		const views: DiscoveryMarketView[] = el.props.markets;
		expect(views).toHaveLength(1);

		// The next eligible YES post surfaces through the page composition —
		// never the Track-B-hidden one (F-DISC-2).
		expect(requirePost(views[0].topPosts.yes).id).toBe(postB);
		expect(requirePost(views[0].topPosts.no).id).toBe(noPost);

		// THE WHOLE-PAGE NEVER-ECHO SWEEP (F-DISC-2 through the page): the
		// removed post's argument marker, its author's pseudonym, its comment
		// UUID, and its distinctive stake appear NOWHERE in the ENTIRE
		// serialized markets payload — cards, totals, series, and topPosts
		// alike. (Sweep the props payload, never the element tree —
		// component types don't serialize.)
		const json = JSON.stringify(views);
		expect(json).not.toContain(maskedMarker);
		expect(json).not.toContain("wiring-masked-pseudonym");
		expect(json).not.toContain(postA);
		expect(json).not.toContain(maskedStake);
	});

	it("wiring::zero-markets-empty-state-element", async () => {
		// Nothing seeded → the page's own composition resolves zero open
		// markets → the EmptyState arm, by component reference (no hero, no
		// grid — plan §5 zero-markets row).
		const el = await DiscoveryContent();
		expect(el.type).toBe(EmptyState);
	});
});
