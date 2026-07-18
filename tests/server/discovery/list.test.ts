import { afterEach, describe, expect, it, vi } from "vitest";

// UI.A4 Slice 1 tests-first (plan §2 row 1 / §11) — the RED driver for
// `listOpenMarkets`, the Discovery list read-model (SPEC.1 §22 F-DISC-1):
// SELECT markets WHERE status='Open' ORDER BY created_at DESC LIMIT
// DISCOVERY_GRID_SIZE, each composed into a DiscoveryCard DTO — pricing from
// `getMarketPricing` (pool-derived spot via the single CPMM `getPrices`
// authority; null when no pool row), totals from `getMarketTotals`
// (Đ staked · posts · replies), imageUrl a presigned GET for the market's
// `is_default` `market_media` row via the NEW `signReadMarketMedia` →
// `mintReadUrl("market-media", …)` (null when no row).
//
// RED target: NEITHER `@/server/discovery/list` NOR the
// `DISCOVERY_GRID_SIZE` export on `@/server/config/limits` exists yet — the
// file fails at COLLECTION on the unresolvable `@/server/discovery/list`
// import until Slice 1's implement phase lands both.
//
// The five it() names are the SPEC.1 §17-registry `discovery::*` rows
// VERBATIM — the FULL `discovery::<row>` tokens (the GATE C naming
// amendment, web-ruled 2026-07-18; plan F-3; the §22 prose variant
// `fewer-than-grid-size-no-placeholders` is superseded by the registry's
// `sparse-no-placeholders`).
// Card-aggregate/composition assertions are FOLDED into the five names —
// no extra blocks.
//
// Each post/reply rides a `bets` row of known stake — `bets.comment_id` is
// the populated FK direction; `comments.bet_id` stays NULL (SPEC.2 §14.1).
// DB-backed (local Postgres :54322). TRUNCATE in afterEach. Money crosses
// as a STRING end-to-end (CLAUDE.md §2); counts are integers. R2 is mocked
// at the module boundary (the markets-media-sign-envelope precedent) — the
// mock exposes ONLY `mintReadUrl`, pinning that media.ts uses the
// "market-media" bucket arm and never the "uploads"-hardcoded `signRead`
// (plan §1e mis-bucket guard).

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

import {
	bets,
	comments,
	marketMedia,
	type marketStatusEnum,
	markets,
	pools,
	users,
} from "@/db/schema";
// RED imports: the greenfield constant + loader under test.
import { DISCOVERY_GRID_SIZE } from "@/server/config/limits";
import { listOpenMarkets } from "@/server/discovery/list";
// The mocked module — imported ONLY to assert the sign calls (bucket/key).
import { mintReadUrl } from "@/server/storage/r2";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const POOL_SEED = "100.000000000000000000";

type MarketStatus = (typeof marketStatusEnum.enumValues)[number];

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Discovery User",
			email: `${tag}@example.com`,
			pseudonym: tag,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedMarket(args: {
	slug: string;
	status: MarketStatus;
	createdAt?: Date;
}): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug: args.slug,
			title: "Discovery Market",
			status: args.status,
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
			...(args.createdAt ? { createdAt: args.createdAt } : {}),
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

async function seedPool(marketId: string): Promise<void> {
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: POOL_SEED, noReserves: POOL_SEED });
}

async function seedDefaultMedia(
	marketId: string,
	r2ObjectKey: string,
): Promise<void> {
	await testDb.insert(marketMedia).values({
		marketId,
		r2ObjectKey,
		displayOrder: 0,
		isDefault: true,
	});
}

/** Direct-seed a comment + its riding bet (the only way to give it a stake). */
async function seedCommentWithBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	parentCommentId: string | null;
	createdAt: Date;
}): Promise<string> {
	const [c] = await testDb
		.insert(comments)
		.values({
			userId: args.userId,
			marketId: args.marketId,
			body: args.parentCommentId === null ? "post" : "reply",
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

describe("UI.A4 §22 — discovery list read-model (F-DISC-1)", () => {
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

	it("discovery::open-markets-only", async () => {
		const u = await seedUser("disc-a");

		// One market in EACH of the 7 lifecycle statuses — only the Open one
		// may surface (F-DISC-1 selection rule).
		const openId = await seedMarket({ slug: "disc-open", status: "Open" });
		await seedMarket({ slug: "disc-draft", status: "Draft" });
		await seedMarket({ slug: "disc-closed", status: "Closed" });
		await seedMarket({ slug: "disc-resolving", status: "Resolving" });
		await seedMarket({ slug: "disc-resolved", status: "Resolved" });
		await seedMarket({ slug: "disc-voided", status: "Voided" });
		await seedMarket({ slug: "disc-frozen", status: "Frozen" });

		// Card aggregates for the Open market: symmetric pool → 0.5/0.5 spot;
		// one post (stake 100) + one reply (stake 50) → totals 150 / 1 / 1;
		// one is_default media row → presigned imageUrl.
		await seedPool(openId);
		const postId = await seedCommentWithBet({
			userId: u,
			marketId: openId,
			side: "YES",
			stake: "100.000000000000000000",
			parentCommentId: null,
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});
		await seedCommentWithBet({
			userId: u,
			marketId: openId,
			side: "NO",
			stake: "50.000000000000000000",
			parentCommentId: postId,
			createdAt: new Date("2026-09-15T01:00:00Z"),
		});
		const objectKey = `m/${openId}/card.webp`;
		await seedDefaultMedia(openId, objectKey);

		const cards = await listOpenMarkets(testDb);

		// Only the Open market — none of the other six statuses leak through.
		expect(cards).toHaveLength(1);
		const card = cards[0];
		expect(card.id).toBe(openId);
		expect(card.slug).toBe("disc-open");
		expect(card.title).toBe("Discovery Market");

		// Pricing: pool-derived spot via the CPMM authority — symmetric
		// 100/100 reserves → exactly "0.5" each, 18-dp quantized strings
		// (the shipped market-pricing precedent pins this exact string).
		expect(card.pricing?.yes).toBe("0.500000000000000000");
		expect(card.pricing?.no).toBe("0.500000000000000000");

		// Totals: Σ bets.stake (post 100 + reply 50) as an exact 18-dp
		// decimal STRING — never a JS float; integer post/reply counts.
		expect(card.totals.dharmaStaked).toBe("150.000000000000000000");
		expect(card.totals.postCount).toBe(1);
		expect(card.totals.replyCount).toBe(1);

		// imageUrl: the presigned GET for the is_default market_media row.
		expect(card.imageUrl).not.toBeNull();
		expect(card.imageUrl).toContain(objectKey);

		// §1e mis-bucket guard: every sign call rides the "market-media"
		// bucket arm with the seeded object key — NEVER "uploads" (the
		// signRead helper is hardcoded to "uploads" and must not be used).
		const signCalls = vi.mocked(mintReadUrl).mock.calls;
		expect(signCalls.length).toBeGreaterThan(0);
		for (const [bucket, key, ttlSeconds] of signCalls) {
			expect(bucket).toBe("market-media");
			expect(key).toBe(objectKey);
			expect(ttlSeconds).toBeGreaterThan(0);
		}
	});

	it("discovery::newest-first", async () => {
		// Insertion order deliberately ≠ recency order — the returned order
		// must come from the created_at DESC query, not insert sequence.
		await seedMarket({
			slug: "disc-mid",
			status: "Open",
			createdAt: new Date("2026-09-12T00:00:00Z"),
		});
		await seedMarket({
			slug: "disc-old",
			status: "Open",
			createdAt: new Date("2026-09-10T00:00:00Z"),
		});
		await seedMarket({
			slug: "disc-new",
			status: "Open",
			createdAt: new Date("2026-09-14T00:00:00Z"),
		});

		const cards = await listOpenMarkets(testDb);

		// Strict created_at-descending order (F-DISC-1 newest-first).
		expect(cards.map((c) => c.slug)).toEqual([
			"disc-new",
			"disc-mid",
			"disc-old",
		]);

		// Defensive arms (folded here per the kickoff): no market_media row →
		// imageUrl null; no pool row → pricing null. Never a throw.
		expect(cards[0].imageUrl).toBeNull();
		expect(cards[0].pricing).toBeNull();
		// No media row anywhere → the signer is never invoked (null comes
		// from the missing-row arm, not a swallowed presign failure).
		expect(vi.mocked(mintReadUrl)).not.toHaveBeenCalled();
	});

	it("discovery::capped-at-grid-size", async () => {
		// The design-canon §2 pinned value (SPEC.1 §16.1/§22 + Appendix B).
		expect(DISCOVERY_GRID_SIZE).toBe(8);

		// DISCOVERY_GRID_SIZE + 2 = 10 Open markets, distinct created_at
		// (i = 0 oldest … i = 9 newest).
		const total = DISCOVERY_GRID_SIZE + 2;
		const slugs: string[] = [];
		for (let i = 0; i < total; i++) {
			const slug = `disc-cap-${String(i).padStart(2, "0")}`;
			slugs.push(slug);
			await seedMarket({
				slug,
				status: "Open",
				createdAt: new Date(Date.UTC(2026, 8, 1, 0, i)),
			});
		}

		const cards = await listOpenMarkets(testDb);

		// Capped at the grid size — and the result set is EXACTLY the 8
		// newest, newest-first (the 2 oldest never surface).
		expect(cards).toHaveLength(DISCOVERY_GRID_SIZE);
		expect(cards.map((c) => c.slug)).toEqual(slugs.slice(2).reverse());
	});

	it("discovery::sparse-no-placeholders", async () => {
		// 3 (< DISCOVERY_GRID_SIZE) Open markets → exactly 3 real cards.
		const ids = [
			await seedMarket({
				slug: "disc-sparse-a",
				status: "Open",
				createdAt: new Date("2026-09-10T00:00:00Z"),
			}),
			await seedMarket({
				slug: "disc-sparse-b",
				status: "Open",
				createdAt: new Date("2026-09-11T00:00:00Z"),
			}),
			await seedMarket({
				slug: "disc-sparse-c",
				status: "Open",
				createdAt: new Date("2026-09-12T00:00:00Z"),
			}),
		];

		// Folded (code-review LOW): the presign-throw degrade arm. The one
		// media row in this scenario gets a rejecting presign — its card must
		// degrade to imageUrl null, never throw the whole render (the
		// mintImageUrls resilience posture, plan §1e).
		await seedDefaultMedia(ids[1], `m/${ids[1]}/card.webp`);
		vi.mocked(mintReadUrl).mockRejectedValueOnce(
			new Error("simulated R2 unavailability"),
		);

		const cards = await listOpenMarkets(testDb);

		// Available markets only — no padding/placeholder entries of any kind.
		expect(cards).toHaveLength(3);
		const seededIds = new Set(ids);
		for (const card of cards) {
			expect(seededIds.has(card.id)).toBe(true);
			expect(card.slug.startsWith("disc-sparse-")).toBe(true);
			// The rejected presign degraded to null; no card carries an image.
			expect(card.imageUrl).toBeNull();
		}
		// All three distinct — no duplicated filler cards either.
		expect(new Set(cards.map((c) => c.id)).size).toBe(3);
	});

	it("discovery::zero-markets-empty-state", async () => {
		// No markets seeded at all → the empty array (the surface renders the
		// empty state from []; the read-model never fabricates entries).
		const cards = await listOpenMarkets(testDb);

		expect(cards).toEqual([]);
		expect(cards).toHaveLength(0);
	});
});
