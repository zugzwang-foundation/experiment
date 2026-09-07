import { describe, expect, it } from "vitest";

import { FREEZE_INSTANT_UTC } from "@/server/markets/create";

import {
	DEADLINE_CEILING_MARGIN_MS,
	LONG_DEADLINE_MS,
	MARKETS,
	resolutionDeadlineFor,
	SHORT_DEADLINE_MS,
} from "../../staging/fixtures";

// ═══════════════════════════════════════════════════════════════════════════
// LIQ-1-FIX-1 — THE FREEZE-CEILING CLAMP ON FIXTURE DEADLINES
//
// Every deadline in the staging fixture table is an offset from the run
// instant, so each one walks toward `FREEZE_INSTANT_UTC` and eventually past
// it. `createMarket` rejects a deadline beyond the freeze with
// `MarketDeadlineCeilingError`, so on 2026-09-06 — the day
// `now + LONG_DEADLINE_MS` first crossed 2026-11-05T23:59Z — the generator
// began dying on its very first market. `resolutionDeadlineFor` is the clamp.
//
// ⚠ EVERY CLOCK BELOW IS EXPLICIT, AND THAT IS THE POINT OF THE FILE.
// The obvious assertion — "now + LONG_DEADLINE_MS is under the ceiling" — is
// the DEFECT written as a test: it passes until 2026-09-06 and reds every day
// after, forever. `resolutionDeadlineFor` takes `now` as an argument precisely
// so its behaviour can be pinned at a chosen instant, and no test here reads
// the wall clock. A red in this file is a code change, never a date change.
// ═══════════════════════════════════════════════════════════════════════════

const FREEZE_MS = FREEZE_INSTANT_UTC.getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

/** The instant the clamp pins a deadline to when it fires. */
const CEILING_MS = FREEZE_MS - DEADLINE_CEILING_MARGIN_MS;

describe("resolutionDeadlineFor — the freeze ceiling clamp", () => {
	it("clamps to the ceiling when the raw offset would cross the freeze", () => {
		// One day out from the freeze: `now + 60 days` is more than a month past
		// it, so the clamp must fire and land on the ceiling exactly.
		const now = new Date(FREEZE_MS - DAY_MS);
		const deadline = resolutionDeadlineFor(
			{ deadlineOffsetMs: LONG_DEADLINE_MS },
			now,
		);

		expect(deadline.toISOString()).toBe(new Date(CEILING_MS).toISOString());
		expect(deadline.toISOString()).toBe("2026-11-05T22:59:00.000Z");
	});

	it("leaves the raw offset alone when it clears the freeze", () => {
		// Ninety days out: `now + 60 days` is thirty days short of the freeze,
		// so the clamp must NOT fire and the offset must survive untouched.
		const now = new Date(FREEZE_MS - 90 * DAY_MS);
		const deadline = resolutionDeadlineFor(
			{ deadlineOffsetMs: LONG_DEADLINE_MS },
			now,
		);

		expect(deadline.getTime()).toBe(now.getTime() + LONG_DEADLINE_MS);
		expect(deadline.getTime()).toBeLessThan(CEILING_MS);
	});

	it("applies the same ceiling to the short offset", () => {
		// SHORT_DEADLINE_MS is the offset the terminal markets close against. It
		// is 1 minute, so it crosses the freeze only in the last minute before
		// it — but it goes through the same clamp, which is the property that
		// keeps a later-added offset from failing on its own schedule.
		const inside = new Date(FREEZE_MS - 30 * 1000);
		expect(
			resolutionDeadlineFor(
				{ deadlineOffsetMs: SHORT_DEADLINE_MS },
				inside,
			).getTime(),
		).toBe(CEILING_MS);

		const outside = new Date(FREEZE_MS - 10 * DAY_MS);
		expect(
			resolutionDeadlineFor(
				{ deadlineOffsetMs: SHORT_DEADLINE_MS },
				outside,
			).getTime(),
		).toBe(outside.getTime() + SHORT_DEADLINE_MS);
	});

	it("is exact at the boundary — a deadline landing ON the ceiling", () => {
		// The `Math.min` tie. Neither branch may add or drop a millisecond.
		const now = new Date(CEILING_MS - LONG_DEADLINE_MS);
		expect(
			resolutionDeadlineFor(
				{ deadlineOffsetMs: LONG_DEADLINE_MS },
				now,
			).getTime(),
		).toBe(CEILING_MS);
	});
});

describe("the whole fixture table clears the ceiling", () => {
	// The table-level acceptance assertion: this is the thing that was false in
	// production on 2026-09-07 and is the reason this task exists. It runs at a
	// fixed clock deliberately chosen INSIDE the broken window — one day before
	// the freeze, where every raw offset in the table is illegal — so it fails
	// if the clamp is removed, and its verdict never depends on today's date.
	const now = new Date(FREEZE_MS - DAY_MS);

	it("has markets to check", () => {
		// A `for` over an empty array asserts nothing.
		expect(MARKETS.length).toBe(15);
	});

	for (const m of MARKETS) {
		it(`${m.key} · deadline is after now and at or under the freeze`, () => {
			const deadline = resolutionDeadlineFor(m, now);
			expect({
				key: m.key,
				afterNow: deadline.getTime() > now.getTime(),
				atOrUnderFreeze: deadline.getTime() <= FREEZE_MS,
			}).toEqual({ key: m.key, afterNow: true, atOrUnderFreeze: true });
		});
	}

	it("the raw offsets are the ones that would fail — positive control", () => {
		// Without this, the block above is green whether or not the clamp does
		// anything: at a clock far from the freeze every raw offset is legal
		// too. This pins that the chosen clock really IS inside the broken
		// window, so the assertions above are exercising the clamp rather than
		// agreeing with arithmetic that was already fine.
		//
		// Exactly the LONG markets are illegal at this clock — a 1-minute
		// offset one day out from the freeze still clears it — and that is
		// asserted as a set rather than a count, so a fixture whose offset
		// changes shows up here instead of silently rebalancing a tally.
		const illegalKeys = MARKETS.filter(
			(m) => now.getTime() + m.deadlineOffsetMs > FREEZE_MS,
		).map((m) => m.key);
		const longKeys = MARKETS.filter(
			(m) => m.deadlineOffsetMs === LONG_DEADLINE_MS,
		).map((m) => m.key);

		expect(illegalKeys).toEqual(longKeys);
		expect(illegalKeys.length).toBeGreaterThan(0);
	});
});
