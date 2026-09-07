import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { events } from "@/db/schema";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import {
	openingBacking,
	readOpenedReserves,
	requireMarketDiscards,
} from "@/server/markets/backing";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// LIQ-1 Phase 1 · T6b (plan §4 T6/T6b; ADR-0047 §E + contract §3). RED-FIRST:
// `@/server/markets/backing` does NOT exist — this file fails at COLLECTION
// until T6 lands (the ENGINE.9 greenfield-import posture).
//
// The subject is the ONE place the `market.opened` payload union is
// discriminated (R1). Its whole reason for existing is that nothing else may
// inspect the payload shape: `price-series.ts`, `void.ts`, `settle.ts` and every
// conservation caller read through `readOpenedReserves`, so a second reader that
// forgets the legacy branch is the failure this file exists to make loud.
//
// Contract (LIQ-1-P1_contract.md §3):
//   readOpenedReserves(payload) → { yes, no, dYes, dNo, openingPriceYes }
//     · legacy { marketId, seedAmount }  ⇒ yes = no = seedAmount, dYes = dNo = 0,
//       openingPriceYes = 0.5 — a symmetric seed discards NOTHING, which is
//       exactly right and not a stub;
//     · new variant                      ⇒ straight off the payload;
//     · malformed                        ⇒ throws (today's price-series.ts:199
//       `.parse()` posture, preserved).
//   openingBacking(r) → yes + dYes  (== no + dNo). R8's starting term: every
//     conservation caller opens from BACKING, never from `seedAmount`.
//   requireMarketDiscards(client, marketId) → { yes, no } from the genesis row;
//     absent row ⇒ (0,0). Takes a db OR a tx, because `void.ts` and `settle.ts`
//     call it INSIDE their W-3 transaction under the pool lock.
//
// ⚠ The contract does not fix the STRING FORMAT of these outputs (it writes
// `"0"` and `"0.5"`, not the 18-dp canonical forms every other money surface
// uses). Value equality via CpmmDecimal is asserted here rather than a format
// this task has no mandate to choose — flagged in the return.
//
// DB-BACKED (local Postgres :54322). Events are inserted through the DRIZZLE
// builder, not `insertEvent`, deliberately: the payload union is T2's subject
// and `tests/server/events/insert.test.ts` owns it. Going through `insertEvent`
// here would make this file red for T2's reason instead of T6's.

const SEED_AMOUNT = "100.000000000000000000";

const YES_RESERVES = "90000.000000000000000000";
const NO_RESERVES = "10000.000000000000000000";
const OPENING_PRICE_YES = "0.100000000000000000";
const BACKING_MINTED = "90000.000000000000000000";
const DISCARDED_YES = "0.000000000000000000";
const DISCARDED_NO = "80000.000000000000000000";

const OPENED_AT = new Date("2026-09-01T00:00:00.000Z");
const OPENED_AT_2 = new Date("2026-09-01T00:05:00.000Z");

function legacyPayload(marketId: string): Record<string, unknown> {
	return { marketId, seedAmount: SEED_AMOUNT };
}

function asymmetricPayload(
	marketId: string,
	overrides: Partial<{
		yesReserves: string;
		noReserves: string;
		openingPriceYes: string;
		backingMinted: string;
		discardedYes: string;
		discardedNo: string;
	}> = {},
): Record<string, unknown> {
	return {
		marketId,
		yesReserves: YES_RESERVES,
		noReserves: NO_RESERVES,
		openingPriceYes: OPENING_PRICE_YES,
		backingMinted: BACKING_MINTED,
		discardedYes: DISCARDED_YES,
		discardedNo: DISCARDED_NO,
		...overrides,
	};
}

async function insertOpenedRow(
	marketId: string,
	payload: Record<string, unknown>,
	createdAt: Date,
): Promise<void> {
	await testDb.insert(events).values({
		eventType: "market.opened",
		aggregateType: "market",
		aggregateId: marketId,
		payload,
		payloadVersion: 1,
		metadata: {},
		createdAt,
	});
}

function eq(actual: string, expected: string): boolean {
	return new CpmmDecimal(actual).equals(expected);
}

describe("markets/backing — the single market.opened reader (LIQ-1 T6b)", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["events"]);
		vi.clearAllMocks();
	});

	it("backing::legacy-payload-reads-as-symmetric-with-zero-discards", () => {
		const marketId = uuidv7();

		const opened = readOpenedReserves(legacyPayload(marketId));

		// A symmetric seed put C on BOTH sides and discarded nothing.
		expect(opened.yes).toBe(SEED_AMOUNT);
		expect(opened.no).toBe(SEED_AMOUNT);
		expect(eq(opened.dYes, "0")).toBe(true);
		expect(eq(opened.dNo, "0")).toBe(true);
		// p_yes = n / (y + n) = C / 2C = ½ — derived, not defaulted.
		expect(eq(opened.openingPriceYes, "0.5")).toBe(true);
	});

	it("backing::new-variant-payload-reads-straight-off-the-payload", () => {
		const marketId = uuidv7();

		const opened = readOpenedReserves(asymmetricPayload(marketId));

		expect(opened.yes).toBe(YES_RESERVES);
		expect(opened.no).toBe(NO_RESERVES);
		expect(eq(opened.dYes, "0")).toBe(true);
		expect(eq(opened.dNo, "80000")).toBe(true);
		expect(eq(opened.openingPriceYes, "0.1")).toBe(true);
		// The direction pin, at the READ end this time: a 10% YES open leaves
		// the LARGE reserve on YES (plan §9 R2). A reader that swapped the two
		// keys would be invisible everywhere except here and the chart.
		expect(new CpmmDecimal(opened.yes).greaterThan(opened.no)).toBe(true);
	});

	it("backing::malformed-payload-throws-rather-than-defaulting", () => {
		// Preserves `price-series.ts:199`'s `.parse()` posture: a payload that is
		// NEITHER variant is a corrupt event, not a market to guess at. The
		// dangerous failure here is a reader that silently returns (0,0) — the
		// books would then close against a fiction.
		expect(() => readOpenedReserves({ marketId: uuidv7() })).toThrow();
		expect(() => readOpenedReserves({ seedAmount: SEED_AMOUNT })).toThrow();
		expect(() => readOpenedReserves(null)).toThrow();
		expect(() =>
			readOpenedReserves({
				marketId: uuidv7(),
				yesReserves: YES_RESERVES,
				noReserves: NO_RESERVES,
			}),
		).toThrow();
	});

	it("backing::opening-backing-is-the-deposit-and-closes-on-both-sides", () => {
		// ADR §E at t = 0: Y + D_yes == N + D_no == total Đ deposited. R8's
		// starting term for every conservation caller.
		const marketId = uuidv7();

		const asym = readOpenedReserves(asymmetricPayload(marketId));
		const asymBacking = openingBacking(asym);
		expect(eq(asymBacking, "90000")).toBe(true);
		expect(new CpmmDecimal(asym.yes).plus(asym.dYes).toFixed(18)).toBe(
			new CpmmDecimal(asym.no).plus(asym.dNo).toFixed(18),
		);
		expect(
			eq(asymBacking, new CpmmDecimal(asym.no).plus(asym.dNo).toFixed(18)),
		).toBe(true);

		// The legacy row's backing is its seedAmount — the same number, because
		// a symmetric seed's backing IS C (plan §4 T9).
		const legacy = readOpenedReserves(legacyPayload(marketId));
		expect(eq(openingBacking(legacy), SEED_AMOUNT)).toBe(true);
	});

	it("backing::require-discards-legacy-row-is-zero-zero", async () => {
		const marketId = uuidv7();
		await insertOpenedRow(marketId, legacyPayload(marketId), OPENED_AT);

		const discards = await requireMarketDiscards(testDb, marketId);

		expect(eq(discards.yes, "0")).toBe(true);
		expect(eq(discards.no, "0")).toBe(true);
	});

	it("backing::require-discards-new-variant-row-is-the-payload-values", async () => {
		const marketId = uuidv7();
		await insertOpenedRow(marketId, asymmetricPayload(marketId), OPENED_AT);

		const discards = await requireMarketDiscards(testDb, marketId);
		expect(eq(discards.yes, "0")).toBe(true);
		expect(eq(discards.no, "80000")).toBe(true);

		// The SAME read, on a transaction handle. `void.ts` and `settle.ts` call
		// this INSIDE their W-3 transaction under the pool lock; a function that
		// reached for the module-level `db` would read outside that lock, and the
		// symptom would be an intermittently wrong cross-assert rather than a
		// type error.
		const inTx = await testDb.transaction((tx) =>
			requireMarketDiscards(tx, marketId),
		);
		expect(inTx).toEqual(discards);
	});

	it("backing::require-discards-reads-the-OLDEST-genesis-row-never-their-sum", async () => {
		// ⚠ INVERTED at `@code-reviewer` HIGH-1, not deleted — a regression to
		// summing genesis rows reddens here (it would read 125 / 80500).
		//
		// This case asserted the SUM, on the plan's reasoning that
		// `I-GENESIS-001` guarantees one row. It does not: that invariant is a
		// `NOT EXISTS` predicate — AT LEAST one — and no unique index backs it.
		// Summing therefore let a duplicate genesis row double `D`, and
		// `settleMarket` would have written the doubled figure to a terminal,
		// append-only row with no cross-assert to catch it.
		//
		// ⛔ THE ORIGINAL COMMENT'S WARNING STILL STANDS AND IS NOT DISCHARGED:
		// "a `.limit(1)` implementation silently drops every injection in Phase 2".
		// True — which is why Phase 2 adds a SECOND, SUMMING query for
		// `pool.liquidity_added` rather than widening this one to
		// `WHERE event_type IN (...)`. Genesis happens once per market; injections
		// happen many times. Merging them back into one query reintroduces exactly
		// the defect this inversion removes, and this test is what says so.
		//
		// The expected values are the OLDEST row's (`OPENED_AT` < `OPENED_AT_2`),
		// matching `replayReserveSeries`'s `ORDER BY created_at ASC LIMIT 1` — so
		// the chart and the payout can never describe different markets.
		// ⛔ THE NEWER ROW IS INSERTED FIRST, DELIBERATELY. An unordered `LIMIT 1`
		// returns the physically-first row, so inserting oldest-first would let an
		// implementation that KEEPS `.limit(1)` but DROPS `.orderBy(...)` return the
		// right answer by accident and pass. Inserting newest-first makes the
		// ordering load-bearing: without it this reads 125 / 80500 and reds.
		// (`@code-reviewer` M-1 — the previous arrangement pinned the cap but not
		// the ORDER, and the order is the half that stops the chart and the payout
		// describing different markets.)
		const marketId = uuidv7();
		await insertOpenedRow(
			marketId,
			asymmetricPayload(marketId, {
				discardedYes: "125.000000000000000000",
				discardedNo: "500.000000000000000000",
			}),
			OPENED_AT_2,
		);
		await insertOpenedRow(marketId, asymmetricPayload(marketId), OPENED_AT);

		const discards = await requireMarketDiscards(testDb, marketId);

		// The first row's discards, NOT the sum of both.
		expect(eq(discards.yes, "0")).toBe(true);
		expect(eq(discards.no, "80000")).toBe(true);
	});

	it("backing::require-discards-THROWS-when-the-genesis-row-is-absent", async () => {
		// ⛔ AN ABSENT GENESIS ROW IS CORRUPTION, NOT A ZERO — and answering zero
		// is what a tolerant read would do. `settleMarket` would then write
		// `poolUnwindAmount = w` — a D-14 NO outcome under-reported by 80,000 Đ —
		// onto a terminal, append-only row, with no cross-assert behind it and no
		// way to correct it afterwards. `voidMarket` would survive it (its
		// cross-assert sees the gap and throws); settle has nothing behind it.
		//
		// This file used to carry a tolerant sibling and a pair of tests
		// contrasting the two. `@code-reviewer` measured that no caller needed
		// tolerance any more — the scale fixtures gained a genesis row in the same
		// commit that split them — so the sibling is deleted rather than left as a
		// second, wrong choice next to the right one on a money path (O-1: a
		// compile error beats a discipline).
		const marketId = uuidv7();

		await expect(requireMarketDiscards(testDb, marketId)).rejects.toThrow(
			/no market\.opened event/,
		);

		// The CONTROL: the SAME market becomes readable once its genesis row
		// exists. Without it the assertion above could pass because the function
		// throws unconditionally, which no test here would otherwise catch.
		await insertOpenedRow(marketId, asymmetricPayload(marketId), OPENED_AT);
		const after = await requireMarketDiscards(testDb, marketId);
		expect(eq(after.no, "80000")).toBe(true);
	});

	// ─── LIQ-1 Phase 2 · T8 — the SECOND query (plan §3 T8; ADR-0047 §E) ─────
	//
	// ADR §E defines `D` as summed from `market.opened` AND every
	// `pool.liquidity_added` for the market. Phase 1 pays only the first half,
	// and the file's own ⚠ PHASE-2-OWES block is the specification for the
	// second: *"Injections ARE many and DO sum — in their own query, added
	// alongside this one."*
	//
	// ⛔ THE TWO HALVES MUST NOT MERGE BACK INTO ONE QUERY, and the case above
	// (`require-discards-reads-the-OLDEST-genesis-row-never-their-sum`) is the
	// half that says so. `I-GENESIS-001` is a `NOT EXISTS` predicate with no
	// unique index behind it, so a duplicate genesis row is possible and summing
	// would double `D` on a terminal, append-only `poolUnwindAmount`. The three
	// cases below add the opposite obligation — injections sum, all of them —
	// and together they pin `requireMarketDiscards` to exactly one shape:
	// capped read + summing read, composed.
	//
	// ⚠ The failure this bounds is SILENT and terminal (plan §9 R-6): an
	// injector that lands without the second query makes `settleMarket`
	// under-report the residual by the whole injected discard, on a row INV-4
	// forbids correcting, with no cross-assert behind it.
	//
	// Events go in through the DRIZZLE builder, not `insertEvent` — same reason
	// as the cases above: the payload schema is T2's subject, and going through
	// `insertEvent` would make this file red for T2's reason instead of T8's.

	/** An ADR §F `pool.liquidity_added` payload. Only the two discard fields
	 * are load-bearing here; the rest ride so the row is the shape the injector
	 * actually writes rather than a two-key stub the reader could not parse. */
	function injectionPayload(
		marketId: string,
		discarded: { side: "YES" | "NO"; shares: string },
	): Record<string, unknown> {
		return {
			marketId,
			policyVersion: 1,
			target: "500000.000000000000000000",
			tankBefore: "100000.000000000000000000",
			tankAfter: "500000.000000000000000000",
			reservesBefore: { yes: YES_RESERVES, no: NO_RESERVES },
			reservesAfter: {
				yes: "450000.000000000000000000",
				no: "50000.000000000000000000",
			},
			backingMinted: "360000.000000000000000000",
			discardedSide: discarded.side,
			discardedShares: discarded.shares,
			priceYesBefore: OPENING_PRICE_YES,
			priceYesAfter: OPENING_PRICE_YES,
		};
	}

	async function insertInjectionRow(
		marketId: string,
		discarded: { side: "YES" | "NO"; shares: string },
		createdAt: Date,
	): Promise<void> {
		await testDb.insert(events).values({
			eventType: "pool.liquidity_added",
			aggregateType: "market",
			aggregateId: marketId,
			payload: injectionPayload(marketId, discarded),
			payloadVersion: 1,
			metadata: {},
			createdAt,
		});
	}

	const INJECT_AT_1 = new Date("2026-09-01T01:00:00.000Z");
	const INJECT_AT_2 = new Date("2026-09-01T02:00:00.000Z");
	const INJECT_AT_3 = new Date("2026-09-01T03:00:00.000Z");

	it("backing::injections-sum-genesis-does-not", async () => {
		// ⛔ THE HIGH-1 REGRESSION GUARD, AND IT MUST RED ON A SINGLE-QUERY
		// IMPLEMENTATION IN EITHER DIRECTION. Two genesis rows and three
		// injections, deliberately in one fixture, because the two failure modes
		// are opposite and a test that seeds only one of them can be satisfied by
		// the wrong fix:
		//
		//   · a read that KEEPS `LIMIT 1` and merely widens `event_type IN (...)`
		//     sees the genesis row and DROPS all three injections → 80,000;
		//   · a read that drops the cap and sums everything doubles the genesis
		//     → 80,000 + 500 (the second genesis row) + the injections;
		//   · only genesis-once + injections-summed lands on the expected value.
		//
		// The newer genesis row carries DIFFERENT discards (125 / 500) so that
		// double-counting it is visible in the number rather than absorbed.
		const marketId = uuidv7();
		await insertOpenedRow(
			marketId,
			asymmetricPayload(marketId, {
				discardedYes: "125.000000000000000000",
				discardedNo: "500.000000000000000000",
			}),
			OPENED_AT_2,
		);
		await insertOpenedRow(marketId, asymmetricPayload(marketId), OPENED_AT);

		// Three injections on the NO side — a 10% market is YES-long, so every
		// injection discards NO, which is the production direction.
		await insertInjectionRow(
			marketId,
			{ side: "NO", shares: "1000.000000000000000000" },
			INJECT_AT_1,
		);
		await insertInjectionRow(
			marketId,
			{ side: "NO", shares: "250.500000000000000000" },
			INJECT_AT_2,
		);
		await insertInjectionRow(
			marketId,
			{ side: "NO", shares: "0.000000000000000001" },
			INJECT_AT_3,
		);

		// A NEIGHBOUR market with its own genesis and its own injection. The
		// existing `is-scoped-to-its-own-market` case beside this one covers the
		// genesis read only, so without this row a summing query that forgot its
		// `aggregate_id` predicate would pass every case in this file — and the
		// symptom would be one market's residual inflated by another's discards,
		// on a terminal row.
		const neighbour = uuidv7();
		await insertOpenedRow(neighbour, asymmetricPayload(neighbour), OPENED_AT);
		await insertInjectionRow(
			neighbour,
			{ side: "NO", shares: "9999.000000000000000000" },
			INJECT_AT_1,
		);

		const discards = await requireMarketDiscards(testDb, marketId);

		// Genesis ONCE (80,000 from the OLDEST row, never 80,500) plus ALL THREE
		// injections. The third is a single ulp: it is there so that a summation
		// that silently floors, or that skips a "negligible" row, is visible.
		expect(eq(discards.no, "81250.500000000000000001")).toBe(true);
		// The YES side takes the OLDEST genesis row's zero and nothing else — a
		// duplicate-genesis double-count would put 125 here.
		expect(eq(discards.yes, "0")).toBe(true);
	});

	it("backing::zero-injections-is-genesis-alone", async () => {
		// ⭐ THE CONTROL, and it is why the case above means what it says. Same
		// market shape, no injection rows: `D` must be Phase 1's answer, to the
		// digit. Without it, a broken second query that returned a constant, or
		// that failed closed and threw, would still let the case above pass on
		// some other arrangement of the same total.
		//
		// This case is GREEN TODAY and is expected to stay green — it pins that
		// T8 is ADDITIVE. A change here means the genesis read moved, which is
		// the one thing plan §3 T8 forbids ("`readGenesisRow` is untouched").
		const marketId = uuidv7();
		await insertOpenedRow(marketId, asymmetricPayload(marketId), OPENED_AT);

		const discards = await requireMarketDiscards(testDb, marketId);

		expect(eq(discards.yes, "0")).toBe(true);
		expect(eq(discards.no, "80000")).toBe(true);
	});

	it("backing::injection-discards-are-side-scoped", async () => {
		// A market whose long side FLIPS mid-life — YES-long at open, then bet far
		// enough NO-ward that the injector's short side becomes YES. Both sides
		// then carry injection discards, and they must not pool.
		//
		// ⛔ THE FAILURE THIS CATCHES IS A SIGN ERROR THAT BALANCES. A sum that
		// added `discardedShares` to whichever side without reading
		// `discardedSide`, or that put both on `no`, produces the same GRAND
		// TOTAL and a wrong per-side split — and `void.ts`'s cross-assert
		// (`cash = Y + H_yes + D_yes`) is per-side, so it would settle the wrong
		// number on one outcome and the right one on the other.
		const marketId = uuidv7();
		await insertOpenedRow(marketId, asymmetricPayload(marketId), OPENED_AT);

		await insertInjectionRow(
			marketId,
			{ side: "NO", shares: "700.000000000000000000" },
			INJECT_AT_1,
		);
		await insertInjectionRow(
			marketId,
			{ side: "YES", shares: "11.000000000000000000" },
			INJECT_AT_2,
		);
		await insertInjectionRow(
			marketId,
			{ side: "YES", shares: "0.000000000000000009" },
			INJECT_AT_3,
		);

		const discards = await requireMarketDiscards(testDb, marketId);

		// YES: genesis 0 + the two YES injections.
		expect(eq(discards.yes, "11.000000000000000009")).toBe(true);
		// NO: genesis 80,000 + the one NO injection.
		expect(eq(discards.no, "80700")).toBe(true);
		// …and the two sides are DIFFERENT numbers, so a reader that returned the
		// same total twice cannot pass by coincidence.
		expect(eq(discards.yes, discards.no)).toBe(false);
	});

	it("backing::require-discards-is-scoped-to-its-own-market", async () => {
		const mine = uuidv7();
		const theirs = uuidv7();
		await insertOpenedRow(mine, legacyPayload(mine), OPENED_AT);
		await insertOpenedRow(theirs, asymmetricPayload(theirs), OPENED_AT);

		const discards = await requireMarketDiscards(testDb, mine);

		// A missing market_id predicate would leak the neighbour's 80,000 in and
		// void/settle would over-report the residual by exactly that.
		expect(eq(discards.yes, "0")).toBe(true);
		expect(eq(discards.no, "0")).toBe(true);
	});
});
