import { describe, expect, it } from "vitest";

import { eventPayloadSchemas } from "@/server/events/schemas";

// T2 — `market.opened`'s two payload arms must REJECT unknown keys, not strip
// them.
//
// ⚠ THE DEFECT THIS GUARDS IS SILENT AND SITS ON A MONEY PATH. `z.object`
// strips unknown keys by default, so a payload carrying BOTH `seedAmount` and
// the ADR-0047 asymmetric keys parses cleanly as the LEGACY arm — and every
// reader downstream then believes the market opened symmetrically at
// `seedAmount / seedAmount` when it actually opened at 90,000 / 10,000. There
// is no error, no warning, and no second signal: `readOpenedReserves` is the
// single discriminator, and it would be discriminating on a shape that had
// already been quietly reduced to the wrong one.
//
// The two arms are described as "disjoint on `seedAmount` XOR `yesReserves`",
// and that description is only TRUE while a stray key cannot be ignored.
// `.strict()` is what makes the sentence in `schemas.ts` accurate rather than
// aspirational.

const opened = eventPayloadSchemas["market.opened"];

const MARKET_ID = "01998b1c-0000-7000-8000-000000000001";

const LEGACY = {
	marketId: MARKET_ID,
	seedAmount: "100000.000000000000000000",
};

const ASYMMETRIC = {
	marketId: MARKET_ID,
	yesReserves: "90000.000000000000000000",
	noReserves: "10000.000000000000000000",
	openingPriceYes: "0.100000000000000000",
	backingMinted: "100000.000000000000000000",
	discardedYes: "0.000000000000000000",
	discardedNo: "80000.000000000000000000",
};

describe("market.opened payload — both arms are strict", () => {
	it("parses the legacy arm", () => {
		// The control. Every historical row on staging and ~20 fixture files are
		// this shape, and `price-series.ts` parses it on every page load — so a
		// change that broke this arm would take out Discovery, not one test.
		expect(opened.parse(LEGACY)).toEqual(LEGACY);
	});

	it("parses the asymmetric arm", () => {
		expect(opened.parse(ASYMMETRIC)).toEqual(ASYMMETRIC);
	});

	it("REJECTS a legacy payload carrying a stray asymmetric key", () => {
		// The defect, exactly. Without `.strict()` this parses as the legacy arm
		// and `yesReserves` is silently dropped — a market that opened at
		// 90,000/10,000 reads back as a symmetric 100,000 seed.
		expect(() =>
			opened.parse({ ...LEGACY, yesReserves: "90000.000000000000000000" }),
		).toThrow();
	});

	it("REJECTS an asymmetric payload carrying a stray seedAmount", () => {
		// The mirror. This one is worse in one respect: with both keys present
		// and no strictness, the LEGACY arm is tried first and WINS, so the six
		// asymmetric fields are all discarded at once.
		expect(() =>
			opened.parse({ ...ASYMMETRIC, seedAmount: "100000.000000000000000000" }),
		).toThrow();
	});

	it("REJECTS an unknown key on either arm, not just the overlapping ones", () => {
		// `.strict()` is a property of the arms, not a hand-written XOR check on
		// two field names. Asserting a key that belongs to NEITHER arm is what
		// tells the two implementations apart.
		expect(() => opened.parse({ ...LEGACY, injected: "1" })).toThrow();
		expect(() => opened.parse({ ...ASYMMETRIC, injected: "1" })).toThrow();
	});

	it("still rejects a payload missing a required key", () => {
		// Strictness must not have replaced required-ness. A schema that only
		// rejected extras would pass every test above and accept `{}`.
		expect(() => opened.parse({ marketId: MARKET_ID })).toThrow();
		const { noReserves: _dropped, ...missing } = ASYMMETRIC;
		expect(() => opened.parse(missing)).toThrow();
	});
});

describe("pool.liquidity_added payload — the injector's record", () => {
	const injection = eventPayloadSchemas["pool.liquidity_added"];

	const VALID = {
		marketId: MARKET_ID,
		policyVersion: 1,
		target: "500000.000000000000000000",
		tankBefore: "100000.000000000000000000",
		tankAfter: "500000.000000000000000000",
		reservesBefore: {
			yes: "90000.000000000000000000",
			no: "10000.000000000000000000",
		},
		reservesAfter: {
			yes: "450000.000000000000000000",
			no: "50000.000000000000000000",
		},
		backingMinted: "360000.000000000000000000",
		discardedSide: "NO",
		discardedShares: "320000.000000000000000000",
		priceYesBefore: "0.100000000000000000",
		priceYesAfter: "0.100000000000000000",
	};

	it("parses the shape migration 0027 actually writes", () => {
		expect(injection.parse(VALID)).toEqual(VALID);
	});

	it("requires policyVersion to be an integer, not a numeric string", () => {
		// Every other money field on this payload is a `numericString`, so the one
		// field that is NOT is the one a later edit will "correct" for consistency.
		// It is an integer because it JOINS `liquidity_policy.version`, and a
		// reader who cannot make that join cannot reproduce the injection at all.
		expect(() => injection.parse({ ...VALID, policyVersion: "1" })).toThrow();
	});

	it("constrains discardedSide to the side enum", () => {
		expect(() =>
			injection.parse({ ...VALID, discardedSide: "BOTH" }),
		).toThrow();
	});

	it("requires both reserve pairs — the replay SETS from reservesAfter", () => {
		// `price-series.ts` assigns the walk's reserves from `reservesAfter`
		// rather than recomputing them (ADR §I). A payload missing it does not
		// degrade the chart; it makes the walk unable to continue at all.
		const { reservesAfter: _a, ...noAfter } = VALID;
		const { reservesBefore: _b, ...noBefore } = VALID;
		expect(() => injection.parse(noAfter)).toThrow();
		expect(() => injection.parse(noBefore)).toThrow();
	});
});
