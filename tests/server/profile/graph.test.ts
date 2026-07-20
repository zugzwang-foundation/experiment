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
	pools,
	positions,
	users,
} from "@/db/schema";
import {
	PROFILE_GRAPH_Y_MAX,
	PROFILE_SERIES_MAX_POINTS,
} from "@/server/config/limits";
import {
	computeBuy,
	computeSell,
	type Reserves,
	seedPool,
} from "@/server/cpmm/calculate";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import { loadProfileGraphSeries } from "@/server/profile/graph-series";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// UI.A5 Slice 4 §5.6 tests-first (plan §2 row 4 + §3 "loadProfileGraphSeries"
// + §7 S2 + §13 items 1/5/6) — the §23 Dharma-graph series derivation
// (SPEC.1 1.0.18 §23 "Net worth + the Dharma graph" on the §10.8 Đb basis).
// The VALUE import from `@/server/profile/graph-series` FAILS at collection
// until Slice 4 lands — red-for-the-right-reason. DB-BACKED (local Postgres
// :54322).
//
// Every expected Đ value is an exact 18-dp decimal string or a
// `computeBuy`/`computeSell` return (the single §10.8 value authority) —
// never JS float arithmetic on Đ (CLAUDE.md §2). The test mirrors the §22
// reserve replay (`replayReserveSeries` semantics: `market.opened` seed →
// `bet.placed`/`bet.sold` steps; the state in effect at instant t = the LAST
// step with at <= t) via the SAME pure cpmm functions, so the expected value
// at any sampled instant IS `computeSell(reserves(t), side, shares(t)).proceeds`.
//
// Fixture contract (kickoff-mandated): every market whose value line is
// asserted seeds a `market.opened` event (MARKET aggregate) before the first
// bet, a `bet.placed` event per buy (BET aggregate, aggregate_id = bets.id),
// and a `bet.sold` event per sell (MARKET aggregate) — with bets/positions/
// pools rows consistent with those events (pool rows are synced to the
// replay-final reserves so the live-pool and replay bases coincide).

const POOL = "100.000000000000000000";
const PRICE_PLACEHOLDER = "0.500000000000000000";

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

/** The LIVE pools row — always synced to the replay-final reserves. */
async function seedPoolRow(
	marketId: string,
	yes: string,
	no: string,
): Promise<void> {
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: yes, noReserves: no });
}

/** The §22 replay anchor: seed 100 symmetric at `at` (MARKET aggregate). */
async function seedMarketOpened(marketId: string, at: Date): Promise<void> {
	await testDb.insert(events).values({
		eventId: uuidv7(),
		eventType: "market.opened",
		aggregateType: "market",
		aggregateId: marketId,
		payload: { marketId, seedAmount: POOL },
		payloadVersion: 1,
		metadata: {},
		createdAt: at,
	});
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

/**
 * One BUY: comment + bets row + the `bet.placed` event on the BET aggregate
 * (`aggregate_type 'bet'`, `aggregate_id = bets.id` — place.ts contract), all
 * at the same instant. `shares` must be the `computeBuy` output for the
 * stake against the reserves in effect (fixture honesty — replay-consistent).
 */
async function seedBuy(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	shares: string;
	at: Date;
	body: string;
}): Promise<{ betId: string; commentId: string }> {
	const commentId = await seedComment({
		userId: args.userId,
		marketId: args.marketId,
		body: args.body,
		side: args.side,
		createdAt: args.at,
	});
	const betId = uuidv7();
	await testDb.insert(bets).values({
		id: betId,
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		stake: args.stake,
		shareQuantity: args.shares,
		priceAtBet: PRICE_PLACEHOLDER,
		commentId,
		createdAt: args.at,
	});
	await testDb.insert(events).values({
		eventId: uuidv7(),
		eventType: "bet.placed",
		aggregateType: "bet",
		aggregateId: betId,
		payload: {
			betId,
			marketId: args.marketId,
			userId: args.userId,
			side: args.side,
			stake: args.stake,
			shares: args.shares,
			price: PRICE_PLACEHOLDER,
			commentId,
			parentCommentId: null,
		},
		payloadVersion: 1,
		metadata: {},
		createdAt: args.at,
	});
	return { betId, commentId };
}

/** A `bet.sold` event on the MARKET aggregate (payload.userId app-filtered). */
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
			price: PRICE_PLACEHOLDER,
		},
		payloadVersion: 1,
		metadata: {},
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

async function seedLedgerRow(args: {
	userId: string;
	entryType: "initial_grant" | "daily_allowance" | "bet_stake" | "bet_payout";
	amount: string;
	balanceAfter: string;
	createdAt: Date;
}): Promise<void> {
	await testDb.insert(dharmaLedger).values(args);
}

/** One test-side replay step: the (reserves, held shares) in effect FROM
 * `atMs` — the step-function state (last step with at <= t governs t). */
type MirrorStep = { atMs: number; reserves: Reserves; shares: string };

/**
 * The value-law oracle: Đb at instant `atIso` = `computeSell(reserves(t),
 * side, shares(t)).proceeds` over the test-side mirror of the §22 walk.
 * Throws when a sample falls before the episode opens or where shares(t) = 0
 * — such an instant has no lawful value (the gap law).
 */
function valueAt(
	steps: MirrorStep[],
	side: "yes" | "no",
	atIso: string,
): string {
	const t = Date.parse(atIso);
	let current: MirrorStep | undefined;
	for (const s of steps) {
		if (s.atMs <= t) {
			current = s;
		}
	}
	if (!current) {
		throw new Error(`sample at ${atIso} precedes the episode-opening trade`);
	}
	if (new CpmmDecimal(current.shares).isZero()) {
		throw new Error(`sample at ${atIso} falls where shares(t) = 0 (gap law)`);
	}
	return computeSell({
		reserves: current.reserves,
		side,
		shares: current.shares,
	}).proceeds;
}

const TRUNCATE_LIST = [
	"events",
	"dharma_ledger",
	"bets",
	"comments",
	"positions",
	"pools",
	"markets",
	"users",
];

describe("UI.A5 Slice 4 — loadProfileGraphSeries (§23 Dharma-graph series)", () => {
	afterEach(async () => {
		await truncateTables(testClient, TRUNCATE_LIST);
		vi.clearAllMocks();
	});

	it("domain-endpoints", async () => {
		// Window law: X domain = the experiment window (Sep 15 → Nov 5 2026,
		// the conclusion freeze at 23:59 UTC); Y ceiling = the spec constant
		// PROFILE_GRAPH_Y_MAX (SPEC.1 §16.1 + Appendix B — 10,000, no autoscale).
		const userA = await seedUser("graph-domain-user", "graph-domain");

		const series = await loadProfileGraphSeries(testDb, { userId: userA });

		expect(series.windowStart).toBe("2026-09-15T00:00:00.000Z");
		expect(series.windowEnd).toBe("2026-11-05T23:59:00.000Z");
		expect(series.yMax).toBe(PROFILE_GRAPH_Y_MAX);
		expect(series.yMax).toBe(10000);
	});

	it("free-dharma-equals-ledger-replay", async () => {
		// The free-Dharma line IS the ledger replay: exactly the user's
		// dharma_ledger rows in seq order, each → { at: created_at ISO, value:
		// balance_after } (balance_after is the running total — cumulative-only).
		// A second user's row is the cross-user isolation control.
		const userA = await seedUser("graph-ledger-user", "graph-ledger");
		const userB = await seedUser("graph-ledger-other", "graph-ledger-other");

		const t1 = new Date("2026-09-16T00:00:00Z");
		const t2 = new Date("2026-09-20T00:00:00Z");
		const t3 = new Date("2026-09-21T00:00:00Z");
		const t4 = new Date("2026-10-01T00:00:00Z");
		await seedLedgerRow({
			userId: userA,
			entryType: "initial_grant",
			amount: dp18("1000"),
			balanceAfter: dp18("1000"),
			createdAt: t1,
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "bet_stake",
			amount: dp18("-200"),
			balanceAfter: dp18("800"),
			createdAt: t2,
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "daily_allowance",
			amount: dp18("10"),
			balanceAfter: dp18("810"),
			createdAt: t3,
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "bet_payout",
			amount: dp18("300"),
			balanceAfter: dp18("1110"),
			createdAt: t4,
		});
		// Isolation control — must NOT appear in userA's line.
		await seedLedgerRow({
			userId: userB,
			entryType: "initial_grant",
			amount: dp18("500"),
			balanceAfter: dp18("500"),
			createdAt: new Date("2026-09-17T00:00:00Z"),
		});

		const series = await loadProfileGraphSeries(testDb, { userId: userA });

		expect(series.freeDharma).toEqual([
			{ at: t1.toISOString(), value: dp18("1000") },
			{ at: t2.toISOString(), value: dp18("800") },
			{ at: t3.toISOString(), value: dp18("810") },
			{ at: t4.toISOString(), value: dp18("1110") },
		]);
	});

	it("networth-now-equals-wallet-plus-positions", async () => {
		// The FI-2 basis identity at t=now: the FINAL net-worth sample ===
		// readBalance (latest balance_after) + Σ computeSell(livePool, side,
		// quantity).proceeds over held markets — computed INDEPENDENTLY here via
		// the shipped computeSell (never shares × price, §10.8).
		const userA = await seedUser("graph-networth-user", "graph-networth");

		await seedLedgerRow({
			userId: userA,
			entryType: "initial_grant",
			amount: dp18("1000"),
			balanceAfter: dp18("1000"),
			createdAt: new Date("2026-09-16T00:00:00Z"),
		});

		// Market 1 — YES buy, stake 50.
		const m1 = await seedMarket("m-graph-nw-one");
		const m1BuyAt = new Date("2026-09-20T10:00:00Z");
		await seedMarketOpened(m1, new Date("2026-09-18T00:00:00Z"));
		const buy1 = computeBuy({
			reserves: seedPool(POOL),
			side: "yes",
			stake: dp18("50"),
		});
		await seedBuy({
			userId: userA,
			marketId: m1,
			side: "YES",
			stake: dp18("50"),
			shares: buy1.shares,
			at: m1BuyAt,
			body: "Net worth fixture argument one",
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "bet_stake",
			amount: dp18("-50"),
			balanceAfter: dp18("950"),
			createdAt: m1BuyAt,
		});
		await seedPoolRow(m1, buy1.reserves.yes, buy1.reserves.no);
		await seedPosition({
			userId: userA,
			marketId: m1,
			side: "YES",
			quantity: buy1.shares,
		});

		// Market 2 — NO buy, stake 30 (Σ over held positions is a real sum).
		const m2 = await seedMarket("m-graph-nw-two");
		const m2BuyAt = new Date("2026-09-22T10:00:00Z");
		await seedMarketOpened(m2, new Date("2026-09-19T00:00:00Z"));
		const buy2 = computeBuy({
			reserves: seedPool(POOL),
			side: "no",
			stake: dp18("30"),
		});
		await seedBuy({
			userId: userA,
			marketId: m2,
			side: "NO",
			stake: dp18("30"),
			shares: buy2.shares,
			at: m2BuyAt,
			body: "Net worth fixture argument two",
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "bet_stake",
			amount: dp18("-30"),
			balanceAfter: dp18("920"),
			createdAt: m2BuyAt,
		});
		await seedPoolRow(m2, buy2.reserves.yes, buy2.reserves.no);
		await seedPosition({
			userId: userA,
			marketId: m2,
			side: "NO",
			quantity: buy2.shares,
		});

		const series = await loadProfileGraphSeries(testDb, { userId: userA });

		// Independent derivation: wallet (latest balance_after = 920) + Đb per
		// held market against the live pool (synced to the replay-final state).
		const db1 = computeSell({
			reserves: buy1.reserves,
			side: "yes",
			shares: buy1.shares,
		}).proceeds;
		const db2 = computeSell({
			reserves: buy2.reserves,
			side: "no",
			shares: buy2.shares,
		}).proceeds;
		const expectedFinal = toFixed18(
			new CpmmDecimal(dp18("920"))
				.plus(new CpmmDecimal(db1))
				.plus(new CpmmDecimal(db2)),
		);

		expect(series.netWorth.length).toBeGreaterThanOrEqual(1);
		const last = series.netWorth[series.netWorth.length - 1];
		expect(last?.value).toBe(expectedFinal);
	});

	it("includes-sells", async () => {
		// After a PARTIAL sell the value line reflects the reduced shares: a
		// post-sell sample = computeSell(post-sell reserves, side, the SMALLER
		// quantity).proceeds — never the pre-sell share count. Seed 100 + buy
		// stake 100 gives exactly 150 shares (hand-derivable); sell 50 → 100.
		const userA = await seedUser("graph-sells-user", "graph-sells");
		const m = await seedMarket("m-graph-sells");

		const openedAt = new Date("2026-09-18T00:00:00Z");
		const buyAt = new Date("2026-09-20T10:00:00Z");
		const sellAt = new Date("2026-09-25T10:00:00Z");

		await seedMarketOpened(m, openedAt);
		const buy = computeBuy({
			reserves: seedPool(POOL),
			side: "yes",
			stake: dp18("100"),
		});
		await seedBuy({
			userId: userA,
			marketId: m,
			side: "YES",
			stake: dp18("100"),
			shares: buy.shares,
			at: buyAt,
			body: "Includes sells fixture argument",
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "initial_grant",
			amount: dp18("1000"),
			balanceAfter: dp18("1000"),
			createdAt: new Date("2026-09-16T00:00:00Z"),
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "bet_stake",
			amount: dp18("-100"),
			balanceAfter: dp18("900"),
			createdAt: buyAt,
		});

		const sell = computeSell({
			reserves: buy.reserves,
			side: "yes",
			shares: dp18("50"),
		});
		await seedSell({
			userId: userA,
			marketId: m,
			side: "YES",
			sharesSold: dp18("50"),
			proceeds: sell.proceeds,
			createdAt: sellAt,
		});
		const heldAfter = toFixed18(
			new CpmmDecimal(buy.shares).minus(new CpmmDecimal(dp18("50"))),
		);
		await seedPosition({
			userId: userA,
			marketId: m,
			side: "YES",
			quantity: heldAfter,
		});
		await seedPoolRow(m, sell.reserves.yes, sell.reserves.no);

		const series = await loadProfileGraphSeries(testDb, { userId: userA });

		const segs = series.perMarket.filter((s) => s.marketId === m);
		expect(segs.length).toBe(1);
		const seg = segs[0];
		expect(seg?.side).toBe("YES");
		expect(seg?.episodeIndex).toBe(0);
		expect(seg?.marketSlug).toBe("m-graph-sells");
		// A partial sell does NOT close the episode — no gap, held to window end.
		expect(seg?.exitedAt).toBeNull();

		const vBefore = computeSell({
			reserves: buy.reserves,
			side: "yes",
			shares: buy.shares,
		}).proceeds;
		const vAfter = computeSell({
			reserves: sell.reserves,
			side: "yes",
			shares: heldAfter,
		}).proceeds;
		// The stale-shares value a no-sell walk would produce — must differ, so
		// the per-point asserts below actually discriminate.
		const vStale = computeSell({
			reserves: sell.reserves,
			side: "yes",
			shares: buy.shares,
		}).proceeds;
		expect(vAfter).not.toBe(vStale);

		const points = seg?.points ?? [];
		expect(points.length).toBeGreaterThanOrEqual(2);
		for (const p of points) {
			const t = Date.parse(p.at);
			expect(t).toBeGreaterThanOrEqual(buyAt.getTime());
			if (t < sellAt.getTime()) {
				expect(p.value).toBe(vBefore);
			} else {
				expect(p.value).toBe(vAfter);
			}
		}
		// Both regimes are actually sampled (the sell step is on the line).
		expect(points.some((p) => Date.parse(p.at) < sellAt.getTime())).toBe(true);
		expect(points.some((p) => Date.parse(p.at) >= sellAt.getTime())).toBe(true);
	});

	it("mid-episode-buy-shares-t", async () => {
		// The W2.6 port item 1 (plan §13 item 1, high): shares(t) is TRUE across
		// mid-episode buys — a SUBSEQUENT same-side buy GROWS shares(t) and the
		// value line steps UP at the buy; never constant-first-buy-shares.
		// Hand-derivable fixture: seed 100; buy1 stake 100 → exactly 150 shares,
		// reserves {yes 50, no 200}; buy2 stake 50 → exactly 60 more shares,
		// reserves {yes 40, no 250}; sell-all of 210 → exactly 150 Đ.
		const userA = await seedUser("graph-midbuy-user", "graph-midbuy");
		const m = await seedMarket("m-graph-midbuy");

		const openedAt = new Date("2026-09-18T00:00:00Z");
		const buy1At = new Date("2026-09-20T10:00:00Z");
		const buy2At = new Date("2026-09-24T10:00:00Z");

		await seedMarketOpened(m, openedAt);
		const buy1 = computeBuy({
			reserves: seedPool(POOL),
			side: "yes",
			stake: dp18("100"),
		});
		await seedBuy({
			userId: userA,
			marketId: m,
			side: "YES",
			stake: dp18("100"),
			shares: buy1.shares,
			at: buy1At,
			body: "Mid episode fixture argument one",
		});
		const buy2 = computeBuy({
			reserves: buy1.reserves,
			side: "yes",
			stake: dp18("50"),
		});
		await seedBuy({
			userId: userA,
			marketId: m,
			side: "YES",
			stake: dp18("50"),
			shares: buy2.shares,
			at: buy2At,
			body: "Mid episode fixture argument two",
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "initial_grant",
			amount: dp18("1000"),
			balanceAfter: dp18("1000"),
			createdAt: new Date("2026-09-16T00:00:00Z"),
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "bet_stake",
			amount: dp18("-100"),
			balanceAfter: dp18("900"),
			createdAt: buy1At,
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "bet_stake",
			amount: dp18("-50"),
			balanceAfter: dp18("850"),
			createdAt: buy2At,
		});

		const totalShares = toFixed18(
			new CpmmDecimal(buy1.shares).plus(new CpmmDecimal(buy2.shares)),
		);
		await seedPosition({
			userId: userA,
			marketId: m,
			side: "YES",
			quantity: totalShares,
		});
		await seedPoolRow(m, buy2.reserves.yes, buy2.reserves.no);

		const series = await loadProfileGraphSeries(testDb, { userId: userA });

		// A mid-episode buy is NOT a gap: ONE segment, still held.
		const segs = series.perMarket.filter((s) => s.marketId === m);
		expect(segs.length).toBe(1);
		const seg = segs[0];
		expect(seg?.episodeIndex).toBe(0);
		expect(seg?.exitedAt).toBeNull();

		const v1 = computeSell({
			reserves: buy1.reserves,
			side: "yes",
			shares: buy1.shares,
		}).proceeds;
		const vAfter = computeSell({
			reserves: buy2.reserves,
			side: "yes",
			shares: totalShares,
		}).proceeds;
		// The constant-first-buy-shares value the W2.6 prototype would emit —
		// the named port defect. shares(t) must be LARGER, value strictly above.
		const vConstFirstBuy = computeSell({
			reserves: buy2.reserves,
			side: "yes",
			shares: buy1.shares,
		}).proceeds;
		expect(vAfter).not.toBe(vConstFirstBuy);
		expect(
			new CpmmDecimal(vAfter).greaterThan(new CpmmDecimal(vConstFirstBuy)),
		).toBe(true);
		// The line steps UP at the buy (more stake in → higher sell-all value).
		expect(new CpmmDecimal(vAfter).greaterThan(new CpmmDecimal(v1))).toBe(true);

		const points = seg?.points ?? [];
		expect(points.length).toBeGreaterThanOrEqual(2);
		for (const p of points) {
			const t = Date.parse(p.at);
			expect(t).toBeGreaterThanOrEqual(buy1At.getTime());
			if (t < buy2At.getTime()) {
				expect(p.value).toBe(v1);
			} else {
				expect(p.value).toBe(vAfter);
			}
		}
		// The step-up is actually sampled at/after the second buy.
		expect(points.some((p) => Date.parse(p.at) < buy2At.getTime())).toBe(true);
		expect(points.some((p) => Date.parse(p.at) >= buy2At.getTime())).toBe(true);
	});

	it("sideepisode-gap-law", async () => {
		// One segment PER SideEpisode: a full sell-out ENDS the segment (a hard
		// gap — exitedAt = the sell's ISO); re-entry (here on the OTHER side)
		// opens a FRESH segment with a new episodeIndex; the two segments share
		// no points; no line exists while holding nothing. Hand-derivable:
		// buy YES 100 → 150 shares @ {yes 50, no 200}; full sell 150 → 100 Đ,
		// pool back to {100, 100}; re-buy NO 100 → 150 shares @ {yes 200, no 50}.
		const userA = await seedUser("graph-gap-user", "graph-gap");
		const m = await seedMarket("m-graph-gap");

		const openedAt = new Date("2026-09-18T00:00:00Z");
		const buyAt = new Date("2026-09-20T10:00:00Z");
		const exitAt = new Date("2026-09-25T10:00:00Z");
		const reentryAt = new Date("2026-10-01T10:00:00Z");

		await seedMarketOpened(m, openedAt);
		const buy = computeBuy({
			reserves: seedPool(POOL),
			side: "yes",
			stake: dp18("100"),
		});
		await seedBuy({
			userId: userA,
			marketId: m,
			side: "YES",
			stake: dp18("100"),
			shares: buy.shares,
			at: buyAt,
			body: "Gap law fixture argument one",
		});
		// FULL exit — sell every held share.
		const exit = computeSell({
			reserves: buy.reserves,
			side: "yes",
			shares: buy.shares,
		});
		await seedSell({
			userId: userA,
			marketId: m,
			side: "YES",
			sharesSold: buy.shares,
			proceeds: exit.proceeds,
			createdAt: exitAt,
		});
		// Re-entry on the OTHER side — a fresh episode.
		const reBuy = computeBuy({
			reserves: exit.reserves,
			side: "no",
			stake: dp18("100"),
		});
		await seedBuy({
			userId: userA,
			marketId: m,
			side: "NO",
			stake: dp18("100"),
			shares: reBuy.shares,
			at: reentryAt,
			body: "Gap law fixture argument two",
		});
		await seedLedgerRow({
			userId: userA,
			entryType: "initial_grant",
			amount: dp18("1000"),
			balanceAfter: dp18("1000"),
			createdAt: new Date("2026-09-16T00:00:00Z"),
		});
		// The exited side's position persists at zero; the held side carries
		// the re-entry quantity (one-held-side: only the NO row is > 0).
		await seedPosition({
			userId: userA,
			marketId: m,
			side: "YES",
			quantity: dp18("0"),
		});
		await seedPosition({
			userId: userA,
			marketId: m,
			side: "NO",
			quantity: reBuy.shares,
		});
		await seedPoolRow(m, reBuy.reserves.yes, reBuy.reserves.no);

		const series = await loadProfileGraphSeries(testDb, { userId: userA });

		const segs = series.perMarket
			.filter((s) => s.marketId === m)
			.sort((a, b) => a.episodeIndex - b.episodeIndex);
		expect(segs.length).toBe(2);
		const first = segs[0];
		const second = segs[1];

		// Episode 1: YES, ENDED by the full sell-out — exitedAt IS the exit ISO.
		expect(first?.side).toBe("YES");
		expect(first?.episodeIndex).toBe(0);
		expect(first?.exitedAt).toBe(exitAt.toISOString());

		// Episode 2: NO, a FRESH episodeIndex, held to window end — no break.
		expect(second?.side).toBe("NO");
		expect(second?.episodeIndex).toBe(1);
		expect(second?.exitedAt).toBeNull();

		// Episode-1 value regime is constant (one buy, then the exit): every
		// pre-exit sample = sell-all of 150 at {yes 50, no 200} = exactly 100 Đ.
		const vEp1 = computeSell({
			reserves: buy.reserves,
			side: "yes",
			shares: buy.shares,
		}).proceeds;
		const firstPoints = first?.points ?? [];
		expect(firstPoints.length).toBeGreaterThanOrEqual(2);
		// The segment starts AT the episode-opening buy.
		expect(firstPoints[0]?.at).toBe(buyAt.toISOString());
		expect(firstPoints[0]?.value).toBe(vEp1);
		for (const p of firstPoints) {
			const t = Date.parse(p.at);
			// Confined to the episode's span — never past the exit instant.
			expect(t).toBeGreaterThanOrEqual(buyAt.getTime());
			expect(t).toBeLessThanOrEqual(exitAt.getTime());
			if (t < exitAt.getTime()) {
				expect(p.value).toBe(vEp1);
			}
		}

		// Episode-2 value regime is constant from re-entry on.
		const vEp2 = computeSell({
			reserves: reBuy.reserves,
			side: "no",
			shares: reBuy.shares,
		}).proceeds;
		const secondPoints = second?.points ?? [];
		expect(secondPoints.length).toBeGreaterThanOrEqual(2);
		// The line RESUMES at the re-entry buy — never inside the flat gap.
		expect(secondPoints[0]?.at).toBe(reentryAt.toISOString());
		expect(secondPoints[0]?.value).toBe(vEp2);
		for (const p of secondPoints) {
			expect(Date.parse(p.at)).toBeGreaterThanOrEqual(reentryAt.getTime());
			expect(p.value).toBe(vEp2);
		}

		// The two segments do not share points (the hard gap between episodes).
		const firstAts = new Set(firstPoints.map((p) => p.at));
		expect(secondPoints.some((p) => firstAts.has(p.at))).toBe(false);
	});

	it("downsample-bound", async () => {
		// §7 S2: EVERY served line — freeDharma, netWorth, each perMarket
		// segment — is thinned to ≤ PROFILE_SERIES_MAX_POINTS, first + last
		// always kept, points a strict SUBSET of the walk (never interpolated).
		// 70 mid-episode buys (one market, ONE episode) + 71 ledger rows push
		// every line past the bound.
		const BUY_COUNT = 70;
		expect(BUY_COUNT).toBeGreaterThan(PROFILE_SERIES_MAX_POINTS);

		const userA = await seedUser("graph-downsample-user", "graph-downsample");
		const m = await seedMarket("m-graph-downsample");
		const openedAt = new Date("2026-09-18T00:00:00Z");
		await seedMarketOpened(m, openedAt);

		await seedLedgerRow({
			userId: userA,
			entryType: "initial_grant",
			amount: dp18("1000"),
			balanceAfter: dp18("1000"),
			createdAt: new Date("2026-09-19T00:00:00Z"),
		});

		// Test-side mirror of the §22 walk: 70 stake-10 YES buys at 1-minute
		// intervals; shares from computeBuy each step (replay-consistent).
		const baseMs = Date.parse("2026-09-20T00:00:00Z");
		let reserves: Reserves = seedPool(POOL);
		let held = new CpmmDecimal(0);
		let balance = new CpmmDecimal(dp18("1000"));
		const mirror: MirrorStep[] = [];
		const commentRows: (typeof comments.$inferInsert)[] = [];
		const betRows: (typeof bets.$inferInsert)[] = [];
		const eventRows: (typeof events.$inferInsert)[] = [];
		const ledgerRows: (typeof dharmaLedger.$inferInsert)[] = [];
		for (let i = 0; i < BUY_COUNT; i++) {
			const at = new Date(baseMs + i * 60_000);
			const buy = computeBuy({ reserves, side: "yes", stake: dp18("10") });
			reserves = buy.reserves;
			held = held.plus(new CpmmDecimal(buy.shares));
			balance = balance.minus(new CpmmDecimal(dp18("10")));
			const commentId = uuidv7();
			const betId = uuidv7();
			commentRows.push({
				id: commentId,
				userId: userA,
				marketId: m,
				parentCommentId: null,
				body: `Downsample fixture argument ${i + 1}`,
				sideAtPostTime: "YES",
				createdAt: at,
			});
			betRows.push({
				id: betId,
				userId: userA,
				marketId: m,
				side: "YES",
				stake: dp18("10"),
				shareQuantity: buy.shares,
				priceAtBet: PRICE_PLACEHOLDER,
				commentId,
				createdAt: at,
			});
			eventRows.push({
				eventId: uuidv7(),
				eventType: "bet.placed",
				aggregateType: "bet",
				aggregateId: betId,
				payload: {
					betId,
					marketId: m,
					userId: userA,
					side: "YES",
					stake: dp18("10"),
					shares: buy.shares,
					price: PRICE_PLACEHOLDER,
					commentId,
					parentCommentId: null,
				},
				payloadVersion: 1,
				metadata: {},
				createdAt: at,
			});
			ledgerRows.push({
				userId: userA,
				entryType: "bet_stake",
				amount: dp18("-10"),
				balanceAfter: toFixed18(balance),
				createdAt: at,
			});
			mirror.push({ atMs: at.getTime(), reserves, shares: toFixed18(held) });
		}
		await testDb.insert(comments).values(commentRows);
		await testDb.insert(bets).values(betRows);
		await testDb.insert(events).values(eventRows);
		await testDb.insert(dharmaLedger).values(ledgerRows);
		await seedPosition({
			userId: userA,
			marketId: m,
			side: "YES",
			quantity: toFixed18(held),
		});
		await seedPoolRow(m, reserves.yes, reserves.no);

		const series = await loadProfileGraphSeries(testDb, { userId: userA });

		const firstBuyAt = new Date(baseMs);
		const lastBuyAt = new Date(baseMs + (BUY_COUNT - 1) * 60_000);

		// freeDharma: 71 ledger rows thinned to the bound; first (the grant) and
		// last (the final stake row, balance 1000 − 700 = 300) always kept.
		expect(series.freeDharma.length).toBeLessThanOrEqual(
			PROFILE_SERIES_MAX_POINTS,
		);
		expect(series.freeDharma[0]).toEqual({
			at: new Date("2026-09-19T00:00:00Z").toISOString(),
			value: dp18("1000"),
		});
		expect(series.freeDharma[series.freeDharma.length - 1]).toEqual({
			at: lastBuyAt.toISOString(),
			value: dp18("300"),
		});

		// netWorth: bounded like every served line.
		expect(series.netWorth.length).toBeLessThanOrEqual(
			PROFILE_SERIES_MAX_POINTS,
		);

		// The single episode's segment: bounded, endpoints preserved, every kept
		// point still on the value law (a SUBSET of the walk — no interpolation).
		const segs = series.perMarket.filter((s) => s.marketId === m);
		expect(segs.length).toBe(1);
		const seg = segs[0];
		expect(seg?.exitedAt).toBeNull();
		const points = seg?.points ?? [];
		expect(points.length).toBeGreaterThanOrEqual(2);
		expect(points.length).toBeLessThanOrEqual(PROFILE_SERIES_MAX_POINTS);
		// First kept: the episode-opening buy.
		expect(points[0]?.at).toBe(firstBuyAt.toISOString());
		expect(points[0]?.value).toBe(
			valueAt(mirror, "yes", firstBuyAt.toISOString()),
		);
		// Last kept: the final regime (at or after the last buy).
		const lastPoint = points[points.length - 1];
		expect(Date.parse(lastPoint?.at ?? "")).toBeGreaterThanOrEqual(
			lastBuyAt.getTime(),
		);
		expect(lastPoint?.value).toBe(
			computeSell({ reserves, side: "yes", shares: toFixed18(held) }).proceeds,
		);
		for (const p of points) {
			expect(p.value).toBe(valueAt(mirror, "yes", p.at));
		}
	});
});
