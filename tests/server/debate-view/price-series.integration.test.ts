import { afterEach, describe, expect, it, vi } from "vitest";

// UI.19 Slice 1 tests-first (plan §Slice 1 integration tests / SPEC.1 1.0.22 §9 +
// F-DEBATE-5) — the RED driver for the market-detail price series riding
// `loadDebateView` on the top-level `model.priceChart` (web Gate-C #5). The impl
// adds `src/server/debate-view/price-chart.ts` → `loadMarketPriceSeries` (the §22
// `replayReserveSeries` walk → `getPrices().yes` per step → downsample to
// MARKET_SERIES_MAX_POINTS = 256 → the retained terminal point stamped with the
// shared `PriceBar` spot `pricing.yes`, decision #6) and wires it into
// `load-debate-view.ts` as a sibling of `model.market` / `model.posts`, wrapped
// so a rejection is NON-FATAL (priceChart = null + a WARN, header intact).
//
// RED target: `model.priceChart` does NOT exist on the current `DebateViewModel`,
// so every `seriesOf(model)` assertion fails at runtime (the field is undefined)
// and the non-fatal test's `priceChart === null` / WARN assertions fail — the
// tests are red by ASSERTION, not collection (CLAUDE.md §5.6). `loadDebateView`
// itself already exists; nothing new is imported from a not-yet-existing module,
// so this file COLLECTS today.
//
// Money / prices cross as STRINGS ("0.5…"), sides as "YES"|"NO" (CLAUDE.md §2 —
// never JS floats). Every expected series value is computed by the test ITSELF
// via the same pure CPMM functions the impl replays with (getPrices over the
// FLOORED reserve walk). DB-backed (local Postgres :54322). TRUNCATE in afterEach.
//
// The event-seeding fixtures mirror the LIVE emitter↔replay aggregate contract
// (tests/server/discovery/price-series.test.ts): `market.opened` + `bet.sold`
// ride the MARKET aggregate; `bet.placed` rides the BET aggregate with a REAL
// `bets` row (+ its riding comment; `bets.comment_id` NOT NULL, `comments.bet_id`
// NULL — SPEC.2 §14.1) so the replay's bet-id resolution has something to resolve.

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

// The series-read seam. By DEFAULT it delegates to the REAL `replayReserveSeries`
// (so the six happy-path tests replay from the seeded events); the non-fatal test
// overrides it with a one-shot rejection to prove the derivation is wrapped.
const { mockReplay } = vi.hoisted(() => ({ mockReplay: vi.fn() }));
vi.mock("@/server/discovery/price-series", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/server/discovery/price-series")>();
	mockReplay.mockImplementation(actual.replayReserveSeries);
	return { ...actual, replayReserveSeries: mockReplay };
});

// The mocked module — imported ONLY to assert the non-fatal WARN.
import { captureMessage } from "@sentry/nextjs";

import { bets, comments, events, markets, pools, users } from "@/db/schema";
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

// The additive top-level field the impl lands on `DebateViewModel` (web Gate-C
// #5). Casting the current return to this shape makes the RED explicit: the field
// is `undefined` until the impl assembles it.
type ChartModel = DebateViewModel & {
	priceChart: { series: { at: string; yes: string }[] } | null;
};

const SEED_AMOUNT = "100.000000000000000000";
// MARKET_SERIES_MAX_POINTS — the SPEC.1 §16.1 + Appendix B pinned design value
// (256). Hard-coded here (not imported) so this file collects before the impl
// mints the constant; the downsample cap is asserted against it.
const MARKET_SERIES_MAX_POINTS = 256;

// Fixed 2026-09 instants — inside the events partition range. Millisecond-exact
// Dates round-trip timestamptz losslessly, so `at === instant.toISOString()`
// is a deterministic pin.
const OPENED_AT = new Date("2026-09-10T00:00:00.000Z");
const EVENT_1_AT = new Date("2026-09-10T00:05:00.000Z");
const EVENT_2_AT = new Date("2026-09-10T00:10:00.000Z");

async function seedMarket(
	slug: string,
	status: MarketSummary["status"] = "Open",
): Promise<MarketSummary> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Chart Series Market",
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
			name: "Series User",
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
 * riding `bets` row (`bets.comment_id` populated; `comments.bet_id` NULL). The
 * replay resolves buys via `bets.market_id`, so the REAL ids are required. */
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

/**
 * Seed a market + pool-seed `market.opened` event + a chain of YES/NO buys (each
 * a real bets row + a BET-aggregate `bet.placed` event), walking the pure CPMM
 * reserves so the expected series is derived by the TEST. Returns the market
 * summary, the ISO `at` series (seed + each buy), the pure-replay `yes` series,
 * and the final reserves (for a consistent pool seed).
 */
async function seedMarketWithBuys(args: {
	slug: string;
	status?: MarketSummary["status"];
	buys: { side: "YES" | "NO"; stake: string; at: Date }[];
}): Promise<{
	market: MarketSummary;
	atSeries: string[];
	yesSeries: string[];
	finalReserves: Reserves;
}> {
	const market = await seedMarket(args.slug, args.status ?? "Open");
	const userId = await seedUser(`u-${args.slug}`);

	let reserves = seedPool(SEED_AMOUNT);
	const atSeries = [OPENED_AT.toISOString()];
	const yesSeries = [getPrices(reserves).yes];
	const eventRows: NewEventRow[] = [
		eventRow(
			"market.opened",
			{ type: "market", id: market.id },
			{ marketId: market.id, seedAmount: SEED_AMOUNT },
			OPENED_AT,
		),
	];

	for (const buy of args.buys) {
		const res = computeBuy({
			reserves,
			side: buy.side === "YES" ? "yes" : "no",
			stake: buy.stake,
		});
		reserves = res.reserves;
		const row = await seedBetRow({
			userId,
			marketId: market.id,
			side: buy.side,
			stake: buy.stake,
			shares: res.shares,
			price: res.pEff,
			createdAt: buy.at,
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
					side: buy.side,
					stake: buy.stake,
					shares: res.shares,
					price: res.pEff,
				}),
				buy.at,
			),
		);
		atSeries.push(buy.at.toISOString());
		yesSeries.push(getPrices(reserves).yes);
	}

	await testDb.insert(events).values(eventRows);
	return { market, atSeries, yesSeries, finalReserves: reserves };
}

/** Load the debate view and return `model.priceChart.series`, asserting the
 * additive field is present + non-null. In RED `model.priceChart` is `undefined`
 * → `toBeDefined()` fails → the test reds by assertion. */
function seriesOf(model: ChartModel): { at: string; yes: string }[] {
	expect(model.priceChart).toBeDefined();
	expect(model.priceChart).not.toBeNull();
	return (model.priceChart as { series: { at: string; yes: string }[] }).series;
}

async function loadChart(market: MarketSummary): Promise<ChartModel> {
	return (await loadDebateView(testDb, { market })) as ChartModel;
}

describe("UI.19 §9 — market price-series on model.priceChart (F-DEBATE-5)", () => {
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

	// ── X domain = market.opened → last bet event ──────────────────────────────
	it("market-lifetime-domain", async () => {
		const { market, atSeries, yesSeries, finalReserves } =
			await seedMarketWithBuys({
				slug: "chart-lifetime",
				buys: [
					{ side: "YES", stake: "25.000000000000000000", at: EVENT_1_AT },
					{ side: "NO", stake: "10.000000000000000000", at: EVENT_2_AT },
				],
			});
		// Consistent pool → pricing == the replay final.
		await seedPoolRow(market.id, finalReserves.yes, finalReserves.no);

		const series = seriesOf(await loadChart(market));

		// The domain spans the FIRST event (market.opened) to the LAST bet event.
		expect(series[0].at).toBe(atSeries[0]); // opened instant
		expect(series[series.length - 1].at).toBe(atSeries[atSeries.length - 1]);
		// The opening point is the pure-replay seed price (only the TERMINAL is
		// stamped) — a symmetric seed reads exactly 0.5.
		expect(series[0].yes).toBe(yesSeries[0]);
		expect(series[0].yes).toBe("0.500000000000000000");
	});

	// ── Open-but-unbet market → one point → a flat line at the opening price ────
	it("single-point-renders-flat-line", async () => {
		const { market } = await seedMarketWithBuys({
			slug: "chart-single",
			buys: [],
		});
		await seedPoolRow(market.id, SEED_AMOUNT, SEED_AMOUNT); // symmetric → 0.5

		const series = seriesOf(await loadChart(market));

		// Only the seed point exists; the component renders a flat line from it.
		expect(series).toHaveLength(1);
		expect(series[0].yes).toBe(getPrices(seedPool(SEED_AMOUNT)).yes);
		expect(series[0].yes).toBe("0.500000000000000000");
	});

	// ── > MARKET_SERIES_MAX_POINTS events → capped, first + last retained ───────
	it("downsample-cap-respected", async () => {
		// 257 buys → 258 raw points (seed + 257) > 256 → downsampled.
		const buys = Array.from({ length: 257 }, (_, i) => ({
			side: "YES" as const,
			stake: "10.000000000000000000",
			at: new Date(OPENED_AT.getTime() + (i + 1) * 60_000),
		}));
		const { market, atSeries, finalReserves } = await seedMarketWithBuys({
			slug: "chart-cap",
			buys,
		});
		await seedPoolRow(market.id, finalReserves.yes, finalReserves.no);

		const series = seriesOf(await loadChart(market));

		// Capped at the pinned bound, and actually thinned from the 258 raw.
		expect(series.length).toBeLessThanOrEqual(MARKET_SERIES_MAX_POINTS);
		expect(series.length).toBeLessThan(atSeries.length);
		// First (opened) and last (final bet event) are always retained.
		expect(series[0].at).toBe(atSeries[0]);
		expect(series[series.length - 1].at).toBe(atSeries[atSeries.length - 1]);
	}, 30_000);

	// ── INV-4 (series half): a non-Open market renders the FROZEN series — the
	//    domain ends at the last event and never advances to "now" ──────────────
	it("series-frozen-on-non-open", async () => {
		const { market, finalReserves } = await seedMarketWithBuys({
			slug: "chart-frozen",
			status: "Resolved",
			buys: [
				{ side: "YES", stake: "25.000000000000000000", at: EVENT_1_AT },
				{ side: "NO", stake: "10.000000000000000000", at: EVENT_2_AT },
			],
		});
		await seedPoolRow(market.id, finalReserves.yes, finalReserves.no);

		const model = await loadChart(market);
		expect(model.market.status).toBe("Resolved"); // non-Open

		const series = seriesOf(model);
		// Frozen: seed + 2 buys, ending EXACTLY at the last event instant — never
		// extrapolated forward (INV-4; no `now` parameter in the read path).
		expect(series).toHaveLength(3);
		expect(series[series.length - 1].at).toBe(EVENT_2_AT.toISOString());
	});

	// ── web Gate-C #4/#5: the series and the pricing arrive on the ONE payload ──
	it("series-on-same-payload-as-pricing", async () => {
		const { market, finalReserves } = await seedMarketWithBuys({
			slug: "chart-one-payload",
			buys: [{ side: "YES", stake: "25.000000000000000000", at: EVENT_1_AT }],
		});
		await seedPoolRow(market.id, finalReserves.yes, finalReserves.no);

		// A SINGLE loadDebateView call carries BOTH — no separate client fetch.
		const model = await loadChart(market);
		const series = seriesOf(model);

		expect(Array.isArray(series)).toBe(true);
		expect(series.length).toBeGreaterThanOrEqual(1);
		expect(model.market.pricing).not.toBeNull();
		expect(model.market.pricing?.yes).toBeDefined();
	});

	// ── web Gate-C #6: the terminal point IS the PriceBar spot (stamped) ────────
	it("terminal-equals-pricing-spot", async () => {
		const { market, finalReserves } = await seedMarketWithBuys({
			slug: "chart-terminal",
			buys: [{ side: "YES", stake: "25.000000000000000000", at: EVENT_1_AT }],
		});
		// DELIBERATELY inconsistent pool (yes 40 / no 160 → yes-price 0.8) so the
		// pool-derived spot DIFFERS from the raw replay final — proving the
		// terminal is STAMPED with pricing.yes, not left as the replay value.
		await seedPoolRow(
			market.id,
			"40.000000000000000000",
			"160.000000000000000000",
		);

		const model = await loadChart(market);
		const series = seriesOf(model);

		expect(model.market.pricing?.yes).toBe("0.800000000000000000");
		// Terminal == the shared PriceBar spot (one quantity, one source).
		expect(series[series.length - 1].yes).toBe(model.market.pricing?.yes);
		// …and it is NOT the raw replay final (which the inconsistent pool differs
		// from) — the stamp is doing real work.
		expect(series[series.length - 1].yes).not.toBe(
			getPrices(finalReserves).yes,
		);
	});

	// ── web Gate-C error-state: the series read is NON-FATAL ────────────────────
	// (LAST — the one-shot rejection must not bleed into a sibling test.)
	it("series-read-failure-is-non-fatal", async () => {
		const { market, finalReserves } = await seedMarketWithBuys({
			slug: "chart-nonfatal",
			// One buy → a real post exists, so `model.posts` intactness is provable.
			buys: [{ side: "YES", stake: "25.000000000000000000", at: EVENT_1_AT }],
		});
		await seedPoolRow(market.id, finalReserves.yes, finalReserves.no);

		// Force the series replay to reject for THIS load only.
		mockReplay.mockRejectedValueOnce(
			new Error("forced market_price_series read failure"),
		);

		// The header read must NOT throw — the chart is omitted, the rest stands.
		const model = (await loadDebateView(testDb, { market })) as ChartModel;

		// Chart omitted (null, not undefined — the wrap ran and set it).
		expect(model.priceChart).toBeNull();
		// The rest of the market-detail header is intact.
		expect(model.market.pricing).not.toBeNull();
		expect(model.market.title).toBe(market.title);
		expect(model.market.totals).toBeDefined();
		// Posts survive the chart-read failure.
		expect(Array.isArray(model.posts)).toBe(true);
		expect(model.posts.length).toBeGreaterThanOrEqual(1);

		// WARN captured via the existing observability path (safeCaptureMessage
		// passes name + ctx through verbatim to @sentry/nextjs captureMessage).
		const warn = vi
			.mocked(captureMessage)
			.mock.calls.find((c) => c[0] === "market_price_series_read_failed");
		expect(warn).toBeDefined();
		expect(warn?.[1]).toMatchObject({
			level: "warning",
			tags: { marketId: market.id },
		});
	});
});
