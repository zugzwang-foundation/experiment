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
	loadMarketDiscards,
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
//   loadMarketDiscards(client, marketId) → { yes, no }, SUMMED from events;
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

	it("backing::load-discards-legacy-row-is-zero-zero", async () => {
		const marketId = uuidv7();
		await insertOpenedRow(marketId, legacyPayload(marketId), OPENED_AT);

		const discards = await loadMarketDiscards(testDb, marketId);

		expect(eq(discards.yes, "0")).toBe(true);
		expect(eq(discards.no, "0")).toBe(true);
	});

	it("backing::load-discards-new-variant-row-is-the-payload-values", async () => {
		const marketId = uuidv7();
		await insertOpenedRow(marketId, asymmetricPayload(marketId), OPENED_AT);

		const discards = await loadMarketDiscards(testDb, marketId);
		expect(eq(discards.yes, "0")).toBe(true);
		expect(eq(discards.no, "80000")).toBe(true);

		// The SAME read, on a transaction handle. `void.ts` and `settle.ts` call
		// this INSIDE their W-3 transaction under the pool lock; a function that
		// reached for the module-level `db` would read outside that lock, and the
		// symptom would be an intermittently wrong cross-assert rather than a
		// type error.
		const inTx = await testDb.transaction((tx) =>
			loadMarketDiscards(tx, marketId),
		);
		expect(inTx).toEqual(discards);
	});

	it("backing::load-discards-absent-row-is-zero-zero", async () => {
		// A market with no `market.opened` row at all — Draft, or a restored
		// snapshot. (0,0), never a throw: the caller's own guards decide what an
		// unopened market means.
		const discards = await loadMarketDiscards(testDb, uuidv7());

		expect(eq(discards.yes, "0")).toBe(true);
		expect(eq(discards.no, "0")).toBe(true);
	});

	it("backing::load-discards-reads-the-OLDEST-genesis-row-never-their-sum", async () => {
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

		const discards = await loadMarketDiscards(testDb, marketId);

		// The first row's discards, NOT the sum of both.
		expect(eq(discards.yes, "0")).toBe(true);
		expect(eq(discards.no, "80000")).toBe(true);
	});

	it("backing::require-discards-THROWS-when-the-genesis-row-is-absent", async () => {
		// ⛔ THE POINT OF THE SECOND ENTRY POINT. `loadMarketDiscards` answers
		// (0,0) here, which is right for a Draft market and for the scale
		// harnesses' synthetic pools. For `settleMarket` it would mean writing
		// `poolUnwindAmount = w` — a D-14 NO outcome under-reported by 80,000 Đ —
		// onto a terminal, append-only row, with no cross-assert behind it and no
		// way to correct it. Void survives that (its cross-assert catches the gap);
		// settle does not, which is why they cannot share the tolerant read.
		const marketId = uuidv7();

		await expect(requireMarketDiscards(testDb, marketId)).rejects.toThrow(
			/no market\.opened event/,
		);

		// The CONTROL: the tolerant read is still tolerant on the same market.
		// Without this the assertion above could pass because both functions
		// throw, which would break every scale harness rather than fix settle.
		const tolerant = await loadMarketDiscards(testDb, marketId);
		expect(eq(tolerant.yes, "0")).toBe(true);
		expect(eq(tolerant.no, "0")).toBe(true);
	});

	it("backing::require-discards-agrees-with-the-tolerant-read-when-a-row-exists", async () => {
		// The two must differ ONLY on the absent case. If they diverge on a
		// present row, settle and the harnesses are reconciling different books.
		const marketId = uuidv7();
		await insertOpenedRow(marketId, asymmetricPayload(marketId), OPENED_AT);

		const strict = await requireMarketDiscards(testDb, marketId);
		const tolerant = await loadMarketDiscards(testDb, marketId);
		expect(strict).toEqual(tolerant);
		expect(eq(strict.no, "80000")).toBe(true);
	});

	it("backing::load-discards-is-scoped-to-its-own-market", async () => {
		const mine = uuidv7();
		const theirs = uuidv7();
		await insertOpenedRow(mine, legacyPayload(mine), OPENED_AT);
		await insertOpenedRow(theirs, asymmetricPayload(theirs), OPENED_AT);

		const discards = await loadMarketDiscards(testDb, mine);

		// A missing market_id predicate would leak the neighbour's 80,000 in and
		// void/settle would over-report the residual by exactly that.
		expect(eq(discards.yes, "0")).toBe(true);
		expect(eq(discards.no, "0")).toBe(true);
	});
});
