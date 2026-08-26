import { describe, expect, it } from "vitest";

import { type PricePoint, withLiveTail } from "@/server/discovery/price-series";

// CHART-1 — the chart's live right edge on a floored history (SPEC.1 1.0.40 §9,
// *X domain* and *Refresh — floored history, live edge*; founder-ruled).
//
// SPEC.1 §17 rows proved here:
//   debate-view::price-chart-domain-runs-to-now-when-open
//   debate-view::price-chart-domain-frozen-when-not-open   (INV-4)
//   debate-view::price-chart-tail-pinned-to-live-price
//   debate-view::price-chart-single-point-flat-line        (G-10's pin)
//
// ⛔ WHY THIS FUNCTION IS PURE AND TESTED HERE RATHER THAN THROUGH A PAGE. The
// whole mechanism rests on the clock and the live price being read OUTSIDE the
// cache boundary. A `Date.now()` inside `getCachedReserveWalk` would freeze for
// a whole window and put an Open market's right edge up to a minute in the
// past — and nothing would look broken. Making `nowIso` and `spotYes` explicit
// ARGUMENTS is what moves that from a rule someone has to remember into a thing
// a test can hold still and interrogate.

const OPENED = "2026-09-15T00:00:00.000Z";
const LAST_EVENT = "2026-09-20T00:00:00.000Z";
const NOW = "2026-09-27T00:00:00.000Z";

const HALF = "0.500000000000000000";
const SPOT = "0.610000000000000000";

const HISTORY: PricePoint[] = [
	{ at: OPENED, yes: HALF },
	{ at: LAST_EVENT, yes: "0.700000000000000000" },
];

/** A market that has never been bet on: the `market.opened` seed alone. */
const SEED_ONLY: PricePoint[] = [{ at: OPENED, yes: HALF }];

describe("debate-view::price-chart-domain-runs-to-now-when-open", () => {
	it("extends an Open market's domain to the present instant", () => {
		const out = withLiveTail(HISTORY, {
			spotYes: SPOT,
			nowIso: NOW,
			isOpen: true,
		});

		// POSITIVE CONTROL — the input really did end at the last event, so
		// "the output ends at now" is a change this call made and not a property
		// the fixture already had.
		expect(HISTORY[HISTORY.length - 1].at).toBe(LAST_EVENT);

		expect(out).toHaveLength(HISTORY.length + 1);
		expect(out[out.length - 1].at).toBe(NOW);
		expect(out[out.length - 1].yes).toBe(SPOT);
	});

	it("renders a quiet market as a flat tail running to now, not a shortened axis", () => {
		// The behaviour the amendment is FOR: a market nobody has touched in a
		// week says so, instead of ending its axis at some arbitrary past instant.
		const quiet: PricePoint[] = [
			{ at: OPENED, yes: HALF },
			{ at: LAST_EVENT, yes: SPOT },
		];
		const out = withLiveTail(quiet, {
			spotYes: SPOT,
			nowIso: NOW,
			isOpen: true,
		});

		expect(out[out.length - 1].at).toBe(NOW);
		// Flat: the appended point carries the same price as the last real event,
		// so the tail is a horizontal run rather than a fabricated movement.
		expect(out[out.length - 1].yes).toBe(out[out.length - 2].yes);
	});

	it("never rewinds the domain when the clock is not ahead of the last event", () => {
		// Defensive, and it protects against exactly one nasty shape: a clock
		// skewed behind a just-written event would otherwise append a point to the
		// LEFT of the series' end and draw the line back on itself.
		const out = withLiveTail(HISTORY, {
			spotYes: SPOT,
			nowIso: OPENED,
			isOpen: true,
		});
		expect(out).toHaveLength(HISTORY.length);
		expect(out[out.length - 1].at).toBe(LAST_EVENT);
	});
});

describe("debate-view::price-chart-domain-frozen-when-not-open", () => {
	it("never advances a non-Open market's domain past its last event (INV-4)", () => {
		// A resolved market's chart is frozen, forever. The domain advancing after
		// close would be a rendered claim that something happened after the
		// market terminated.
		const out = withLiveTail(HISTORY, {
			spotYes: SPOT,
			nowIso: NOW,
			isOpen: false,
		});

		expect(out).toHaveLength(HISTORY.length);
		expect(out[out.length - 1].at).toBe(LAST_EVENT);
		// POSITIVE CONTROL — `nowIso` really was later, so "did not advance" is a
		// decision and not an accident of the fixture.
		expect(Date.parse(NOW)).toBeGreaterThan(Date.parse(LAST_EVENT));
	});

	it("still restamps the frozen terminal so it agrees with PriceBar", () => {
		// A no-op in practice — a closed market's pool cannot move — kept so the
		// "can never disagree with the bar" property holds by construction in
		// EVERY state rather than in most of them.
		const out = withLiveTail(HISTORY, {
			spotYes: SPOT,
			nowIso: NOW,
			isOpen: false,
		});
		expect(out[out.length - 1].yes).toBe(SPOT);
	});
});

describe("debate-view::price-chart-tail-pinned-to-live-price", () => {
	it("puts the live spot on the terminal in both states", () => {
		for (const isOpen of [true, false]) {
			const out = withLiveTail(HISTORY, { spotYes: SPOT, nowIso: NOW, isOpen });
			expect(out[out.length - 1].yes).toBe(SPOT);
		}
	});

	it("leaves every interior point as the pure replay", () => {
		// The history is the event log's, and only the edge is live. If the pin
		// ever reached backwards it would be rewriting the past to match the
		// present, which is the one thing a price history must not do.
		const out = withLiveTail(HISTORY, {
			spotYes: SPOT,
			nowIso: NOW,
			isOpen: true,
		});
		expect(out.slice(0, HISTORY.length)).toEqual(HISTORY);
	});

	it("leaves the replay's own terminal alone when there is no pool row", () => {
		// Defensive: unreachable for an opened market. Inventing a price here
		// would be worse than showing the replay's last one.
		const out = withLiveTail(HISTORY, {
			spotYes: null,
			nowIso: NOW,
			isOpen: true,
		});
		expect(out).toEqual(HISTORY);
	});

	it("returns an empty series untouched", () => {
		expect(
			withLiveTail([], { spotYes: SPOT, nowIso: NOW, isOpen: true }),
		).toEqual([]);
	});
});

describe("debate-view::price-chart-single-point-flat-line — G-10's pin", () => {
	// ⛔ THE MEASUREMENT THIS RUN OPENED WITH, TURNED INTO A GUARD. Recon found
	// the series is REAL `bet.placed`/`bet.sold` replay on every surface, and
	// that SPEC.1 §9's sparse rule ("fewer than two points → a flat line at the
	// opening price") already held in three independent places. Nothing needed
	// fixing. What was missing was anything that would NOTICE if it stopped
	// holding — so a zero-bet market rendering a line that moves is what this
	// rejects.
	it("a market with no bets stays flat, even after the live tail is composed", () => {
		const out = withLiveTail(SEED_ONLY, {
			spotYes: HALF,
			nowIso: NOW,
			isOpen: true,
		});

		// The tail extends the DOMAIN to now — that is the amendment working.
		expect(out).toHaveLength(2);
		expect(out[1].at).toBe(NOW);

		// ⛔ …and the LINE is still flat, because with no bets the pool has not
		// moved, so the live spot IS the opening price. Every y in the series is
		// identical: a horizontal line at the opening price, which is what §9
		// requires and what the founder's screenshot appeared to contradict.
		const distinct = new Set(out.map((p) => p.yes));
		expect(distinct.size).toBe(1);
		expect([...distinct][0]).toBe(HALF);
	});

	it("POSITIVE CONTROL — the same shape DOES move once a bet lands", () => {
		// Without this, "the series is flat" would also pass on a build that
		// flattened every series, including markets that really did move.
		const out = withLiveTail(SEED_ONLY, {
			spotYes: SPOT,
			nowIso: NOW,
			isOpen: true,
		});
		expect(new Set(out.map((p) => p.yes)).size).toBe(2);
	});
});
