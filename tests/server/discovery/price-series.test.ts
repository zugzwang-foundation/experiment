import { afterEach, describe, expect, it, vi } from "vitest";

// UI.A4 Slice 2 tests-first (plan §2 row 2 / §3 / §16 rulings OQ-2=A+F-1,
// F-4) — the RED driver for `loadPriceSeries`, the Discovery price-series
// replay (SPEC.1 §22): read the market's `market.opened` event
// (aggregate_type 'market') → symmetric seedPool(payload.seedAmount)
// reserves (first point at = opened.created_at ISO, yes = getPrices(seed).yes
// = exactly "0.500000000000000000"), then scan the market's
// `bet.placed`/`bet.sold` events in created_at ASC order applying the pure
// computeBuy/computeSell walk, pushing { at, yes: getPrices(newReserves).yes }
// after each step. Sells write NO bets row — the events table is the ONLY
// faithful source (plan §1d). F-1 soft check: after replay, compare final
// reserves vs the live `pools` row — on mismatch WARN via
// safeCaptureMessage("discovery_price_series_drift") and STILL serve the
// computed series; never throw/500. F-4: the result is thinned server-side to
// ≤ DISCOVERY_SERIES_MAX_POINTS points, always keeping the FIRST (seed) and
// LAST (final) points, order preserved.
//
// RED target: NEITHER `@/server/discovery/price-series` NOR the
// `DISCOVERY_SERIES_MAX_POINTS` export on `@/server/config/limits` exists
// yet — the file fails at COLLECTION on the unresolvable
// `@/server/discovery/price-series` import until Slice 2's implement phase
// lands both.
//
// The five it() names are the plan §2 row 2 set VERBATIM (F-3 naming), one
// describe, no extra blocks. Every expected value is derived by the TEST
// ITSELF via the same pure CPMM functions (computeBuy/computeSell/getPrices/
// seedPool — deterministic, same 18-dp rounding as the implementation);
// series points are getPrices over the FLOORED reserve walk, never
// computeBuy's exact-intermediate p1. Money stays a STRING end-to-end
// (CLAUDE.md §2) — the only number math here is Date arithmetic.
//
// Fixtures mirror the LIVE emitter aggregate contract (the Slice-2 code-
// review HIGH; re-fixtured in-session): `bet.placed` rides the BET aggregate
// — (aggregate_type 'bet', aggregate_id = bets.id, place.ts:184) — with a
// REAL `bets` row (+ its riding comment; `bets.comment_id` NOT NULL, the
// populated FK direction) so the replay's bets-id resolution has something
// to resolve; `bet.sold` rides the MARKET aggregate (sell.ts:96 [R4]) and
// writes NO bets row (a sale is events-only — plan §1d); `market.opened`
// rides the MARKET aggregate. A wrong-aggregate replay scan sees NO buys —
// these fixtures are the regression pin on the emitter↔replay contract.
// DB-backed (local Postgres :54322). TRUNCATE in afterEach. Sentry is mocked
// at the module boundary; the F-1 warn is asserted on the mocked
// `captureMessage` (safeCaptureMessage passes name + ctx through verbatim —
// src/server/observability/safe-capture.ts).

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

// The mocked module — imported ONLY to assert the F-1 drift-warn calls.
import { captureMessage } from "@sentry/nextjs";
import { bets, comments, events, markets, pools, users } from "@/db/schema";
// RED imports: the greenfield constant + loader under test.
import { DISCOVERY_SERIES_MAX_POINTS } from "@/server/config/limits";
import {
	computeBuy,
	computeSell,
	getPrices,
	type Reserves,
	seedPool,
} from "@/server/cpmm/calculate";
import { loadPriceSeries } from "@/server/discovery/price-series";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const SEED_AMOUNT = "100.000000000000000000";

// Fixed 2026-09 instants — inside the events partition range (2026-05…
// 2027-04). Millisecond-exact Dates round-trip timestamptz losslessly, so
// `at === instant.toISOString()` is a deterministic pin.
const OPENED_AT = new Date("2026-09-10T00:00:00.000Z");
const EVENT_1_AT = new Date("2026-09-10T00:05:00.000Z");
const EVENT_2_AT = new Date("2026-09-10T00:10:00.000Z");

async function seedMarket(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Discovery Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

// Named seedPoolRow (not list.test.ts's `seedPool`) — the cpmm `seedPool`
// import owns that name here.
async function seedPoolRow(
	marketId: string,
	yesReserves: string,
	noReserves: string,
): Promise<void> {
	await testDb.insert(pools).values({ marketId, yesReserves, noReserves });
}

type NewEventRow = typeof events.$inferInsert;

/** aggregate.type/.id mirror the LIVE emitters: market.opened + bet.sold →
 * ("market", marketId); bet.placed → ("bet", betId). */
function eventRow(
	eventType: "market.opened" | "bet.placed" | "bet.sold",
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

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Series User",
			email: `${tag}@example.com`,
			pseudonym: tag,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

/** The live buy write-shape a `bet.placed` event rides on: a comment + its
 * riding `bets` row (`bets.comment_id` populated; `comments.bet_id` stays
 * NULL — SPEC.2 §14.1). Returns the REAL bet/comment ids for the payload +
 * the event's bet-aggregate id — the replay resolves buys via
 * `bets.market_id`, so a throwaway uuid would make the buy invisible. */
async function seedBetRow(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	shares: string;
	price: string;
	createdAt: Date;
}): Promise<{ betId: string; commentId: string }> {
	const [c] = await testDb
		.insert(comments)
		.values({
			userId: args.userId,
			marketId: args.marketId,
			body: "post",
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
	return { betId: b?.id ?? "", commentId };
}

/** Shape-complete bet.placed payload (src/server/events/schemas.ts) carrying
 * the REAL bet/comment/user ids of the seeded write-shape. */
function betPlacedPayload(args: {
	betId: string;
	marketId: string;
	userId: string;
	commentId: string;
	side: "YES" | "NO";
	stake: string;
	shares: string;
	price: string;
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
		parentCommentId: null,
	};
}

/** Shape-complete bet.sold payload. A sale writes NO bets row — its payload
 * betId is SYNTHETIC (sell.ts [R4]), so a throwaway uuid is the faithful
 * shape. The replay reads side + sharesSold only. */
function betSoldPayload(args: {
	marketId: string;
	side: "YES" | "NO";
	sharesSold: string;
	proceeds: string;
	price: string;
}): Record<string, unknown> {
	return {
		betId: crypto.randomUUID(),
		marketId: args.marketId,
		userId: crypto.randomUUID(),
		side: args.side,
		sharesSold: args.sharesSold,
		proceeds: args.proceeds,
		price: args.price,
	};
}

/** The quiescent two-buy fixture shared by replay-matches-live-pool /
 * mismatch-logs-and-serves: opened(seed 100) → YES 25 → NO 10 at distinct
 * ascending created_at. The expected walk is derived HERE via the same pure
 * CPMM functions the implementation replays with (plan §3: each point's yes
 * is getPrices(newReserves) over the FLOORED reserve walk). */
async function seedTwoBuyMarket(): Promise<{
	marketId: string;
	expectedSeries: { at: string; yes: string }[];
	finalReserves: Reserves;
}> {
	const marketId = await seedMarket("disc-series-quiescent");
	const userId = await seedUser("disc-series-q");
	const r0 = seedPool(SEED_AMOUNT);
	const buy1 = computeBuy({
		reserves: r0,
		side: "yes",
		stake: "25.000000000000000000",
	});
	const buy2 = computeBuy({
		reserves: buy1.reserves,
		side: "no",
		stake: "10.000000000000000000",
	});
	// Each buy = the live write-shape: bets row (+ comment) AND a bet.placed
	// event under the BET aggregate (place.ts:184).
	const b1 = await seedBetRow({
		userId,
		marketId,
		side: "YES",
		stake: "25.000000000000000000",
		shares: buy1.shares,
		price: buy1.pEff,
		createdAt: EVENT_1_AT,
	});
	const b2 = await seedBetRow({
		userId,
		marketId,
		side: "NO",
		stake: "10.000000000000000000",
		shares: buy2.shares,
		price: buy2.pEff,
		createdAt: EVENT_2_AT,
	});
	await testDb.insert(events).values([
		eventRow(
			"market.opened",
			{ type: "market", id: marketId },
			{ marketId, seedAmount: SEED_AMOUNT },
			OPENED_AT,
		),
		eventRow(
			"bet.placed",
			{ type: "bet", id: b1.betId },
			betPlacedPayload({
				betId: b1.betId,
				marketId,
				userId,
				commentId: b1.commentId,
				side: "YES",
				stake: "25.000000000000000000",
				shares: buy1.shares,
				price: buy1.pEff,
			}),
			EVENT_1_AT,
		),
		eventRow(
			"bet.placed",
			{ type: "bet", id: b2.betId },
			betPlacedPayload({
				betId: b2.betId,
				marketId,
				userId,
				commentId: b2.commentId,
				side: "NO",
				stake: "10.000000000000000000",
				shares: buy2.shares,
				price: buy2.pEff,
			}),
			EVENT_2_AT,
		),
	]);
	return {
		marketId,
		expectedSeries: [
			{ at: OPENED_AT.toISOString(), yes: getPrices(r0).yes },
			{ at: EVENT_1_AT.toISOString(), yes: getPrices(buy1.reserves).yes },
			{ at: EVENT_2_AT.toISOString(), yes: getPrices(buy2.reserves).yes },
		],
		finalReserves: buy2.reserves,
	};
}

describe("UI.A4 §22 — discovery price-series replay (OQ-2 A + F-1)", () => {
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

	it("seed-only-flat-at-50pct", async () => {
		const marketId = await seedMarket("disc-series-seed-only");
		await testDb
			.insert(events)
			.values(
				eventRow(
					"market.opened",
					{ type: "market", id: marketId },
					{ marketId, seedAmount: SEED_AMOUNT },
					OPENED_AT,
				),
			);

		const series = await loadPriceSeries(testDb, marketId);

		// Exactly ONE point — the seed point: at = the opened event's
		// created_at ISO instant; yes = the symmetric-seed spot, EXACTLY the
		// 18-dp half (SPEC.1 §22 "flat at 50%"). toEqual also pins the
		// PricePoint DTO shape ({ at, yes } — nothing else).
		expect(series).toEqual([
			{ at: OPENED_AT.toISOString(), yes: "0.500000000000000000" },
		]);
	});

	it("replay-matches-live-pool", async () => {
		const { marketId, expectedSeries, finalReserves } =
			await seedTwoBuyMarket();
		// The live pools row carries EXACTLY the replayed final reserves —
		// the quiescent-fixture equality arm of the F-1 soft check.
		await seedPoolRow(marketId, finalReserves.yes, finalReserves.no);

		const series = await loadPriceSeries(testDb, marketId);

		// 3 points (seed + 2 buys); each point's yes = the test-computed
		// getPrices at that step; ats = the three event instants, in order.
		expect(series).toEqual(expectedSeries);

		// Replay ≡ pool → the F-1 drift warn must NOT fire.
		expect(vi.mocked(captureMessage)).not.toHaveBeenCalled();
	});

	it("mismatch-logs-and-serves", async () => {
		const { marketId, expectedSeries } = await seedTwoBuyMarket();
		// WRONG live reserves — the replayed finals cannot match.
		await seedPoolRow(
			marketId,
			"999.000000000000000000",
			"111.000000000000000000",
		);

		const series = await loadPriceSeries(testDb, marketId);

		// The F-1 drift warn fired through safeCaptureMessage → the mocked
		// @sentry/nextjs captureMessage: the pinned name, level "warning".
		const calls = vi.mocked(captureMessage).mock.calls;
		expect(calls.length).toBeGreaterThan(0);
		const [driftName, driftCtx] = calls[0];
		expect(driftName).toBe("discovery_price_series_drift");
		expect(driftCtx).toMatchObject({ level: "warning" });

		// …and the FULL replay-computed 3-point series is STILL returned —
		// warn + always-serve, never throw/500 (OQ-2 F-1 verbatim).
		expect(series).toEqual(expectedSeries);
	});

	it("includes-sells", async () => {
		const marketId = await seedMarket("disc-series-sell");
		const userId = await seedUser("disc-series-s");
		const r0 = seedPool(SEED_AMOUNT);
		const buy = computeBuy({
			reserves: r0,
			side: "yes",
			stake: "25.000000000000000000",
		});
		// Sell back ALL bought YES shares — the test-side computeSell yields
		// the payload fields AND the expected post-sell reserves.
		const sell = computeSell({
			reserves: buy.reserves,
			side: "yes",
			shares: buy.shares,
		});
		// The buy rides the live write-shape (bets row + BET-aggregate event);
		// the sale is EVENTS-ONLY under the MARKET aggregate — no bets row, no
		// second comment (sell.ts [R4]; plan §1d "sells write no bets row").
		const b = await seedBetRow({
			userId,
			marketId,
			side: "YES",
			stake: "25.000000000000000000",
			shares: buy.shares,
			price: buy.pEff,
			createdAt: EVENT_1_AT,
		});
		await testDb.insert(events).values([
			eventRow(
				"market.opened",
				{ type: "market", id: marketId },
				{ marketId, seedAmount: SEED_AMOUNT },
				OPENED_AT,
			),
			eventRow(
				"bet.placed",
				{ type: "bet", id: b.betId },
				betPlacedPayload({
					betId: b.betId,
					marketId,
					userId,
					commentId: b.commentId,
					side: "YES",
					stake: "25.000000000000000000",
					shares: buy.shares,
					price: buy.pEff,
				}),
				EVENT_1_AT,
			),
			eventRow(
				"bet.sold",
				{ type: "market", id: marketId },
				betSoldPayload({
					marketId,
					side: "YES",
					sharesSold: buy.shares,
					proceeds: sell.proceeds,
					price: sell.pEff,
				}),
				EVENT_2_AT,
			),
		]);

		const series = await loadPriceSeries(testDb, marketId);

		// Sells write NO bets row (plan §1d) — only the events replay can
		// produce the third point: its yes = the test-computed post-sell
		// getPrices, and it MOVED from the post-buy second point (a bets-row
		// walk would miss the sell and leave the price at the buy level).
		expect(series).toHaveLength(3);
		expect(series[1].yes).toBe(getPrices(buy.reserves).yes);
		expect(series[2].at).toBe(EVENT_2_AT.toISOString());
		expect(series[2].yes).toBe(getPrices(sell.reserves).yes);
		expect(series[2].yes).not.toBe(series[1].yes);
	});

	it("monotone-created-at-order", async () => {
		// F-4 constant pin — an implementation downsample bound, NOT a spec
		// constant (plan §2 row 2 / §16 F-4).
		expect(DISCOVERY_SERIES_MAX_POINTS).toBe(64);

		const marketId = await seedMarket("disc-series-order");
		const userId = await seedUser("disc-series-o");
		const stake = "10.000000000000000000";

		// The TRUE created_at-ordered walk: 70 YES buys, one per minute after
		// the open. STRING reserves loop through the pure CPMM functions —
		// never JS-float money math (CLAUDE.md §2). Each buy gets its live
		// write-shape (bets row + comment) for the BET-aggregate event to ride.
		const steps: {
			at: Date;
			betId: string;
			commentId: string;
			shares: string;
			price: string;
			yesAfter: string;
		}[] = [];
		let reserves = seedPool(SEED_AMOUNT);
		for (let i = 0; i < 70; i++) {
			const buy = computeBuy({ reserves, side: "yes", stake });
			reserves = buy.reserves;
			const at = new Date(OPENED_AT.getTime() + (i + 1) * 60_000);
			const row = await seedBetRow({
				userId,
				marketId,
				side: "YES",
				stake,
				shares: buy.shares,
				price: buy.pEff,
				createdAt: at,
			});
			steps.push({
				at,
				betId: row.betId,
				commentId: row.commentId,
				shares: buy.shares,
				price: buy.pEff,
				yesAfter: getPrices(buy.reserves).yes,
			});
		}

		// INSERT scrambled: reversed created_at order — physical heap order
		// AND uuidv7 event_id order both run OPPOSITE to created_at, so an
		// insertion-order or event_id-order scan produces a descending series.
		// Only `ORDER BY created_at ASC` survives.
		const scrambled = [...steps].reverse();
		await testDb.insert(events).values([
			eventRow(
				"market.opened",
				{ type: "market", id: marketId },
				{ marketId, seedAmount: SEED_AMOUNT },
				OPENED_AT,
			),
			...scrambled.map((s) =>
				eventRow(
					"bet.placed",
					{ type: "bet", id: s.betId },
					betPlacedPayload({
						betId: s.betId,
						marketId,
						userId,
						commentId: s.commentId,
						side: "YES",
						stake,
						shares: s.shares,
						price: s.price,
					}),
					s.at,
				),
			),
		]);

		const series = await loadPriceSeries(testDb, marketId);

		// 71 raw points (seed + 70 buys) thin to EXACTLY the F-4 bound.
		expect(series).toHaveLength(DISCOVERY_SERIES_MAX_POINTS);

		// `at` values strictly ascending ISO instants — time-ordered output.
		for (let i = 1; i < series.length; i++) {
			expect(new Date(series[i].at).getTime()).toBeGreaterThan(
				new Date(series[i - 1].at).getTime(),
			);
		}

		// FIRST point retained = the seed point (F-4 first-point keep).
		expect(series[0]).toEqual({
			at: OPENED_AT.toISOString(),
			yes: "0.500000000000000000",
		});

		// LAST point retained = the final point after applying ALL 70 buys in
		// created_at order (F-4 last-point keep + time-order application: an
		// insertion-order walk would end at the EARLIEST instant instead).
		const lastStep = steps[steps.length - 1];
		expect(series[series.length - 1]).toEqual({
			at: lastStep.at.toISOString(),
			yes: lastStep.yesAfter,
		});

		// Thinning = a SUBSET of the raw walk (F-4 "thinned … order
		// preserved"): every kept point matches the walk value AT ITS OWN
		// instant — never an interpolated/fabricated point.
		const walkYesByAt = new Map<string, string>();
		walkYesByAt.set(OPENED_AT.toISOString(), "0.500000000000000000");
		for (const s of steps) {
			walkYesByAt.set(s.at.toISOString(), s.yesAfter);
		}
		for (const point of series) {
			expect(walkYesByAt.get(point.at)).toBe(point.yes);
		}

		// No pools row seeded → the F-1 check never runs → no warn.
		expect(vi.mocked(captureMessage)).not.toHaveBeenCalled();
	});
});
