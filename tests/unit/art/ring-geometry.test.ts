import { describe, expect, it } from "vitest";

import {
	interstitialAngles,
	placeLocalPoint,
	pointOnRing,
	ringLinks,
	ringPlacements,
} from "@/components/art/warli/geometry";

/**
 * WARLI-1 slice 3 — the ring engine's geometry.
 *
 * ⚠ THE POINT OF THIS FILE IS THAT IT DOES NOT COMPARE THE ENGINE TO ITSELF.
 * A snapshot guard over placement output would pass against ANY geometry,
 * including a wrong one, because the only thing it ever checks is that today's
 * output equals yesterday's — it can pin a bug in place and report green
 * forever. So the expectations below are worked out BY HAND, from the stated
 * convention, and written as literals.
 *
 * The convention makes that cheap on purpose: `0°` is twelve o'clock and angles
 * increase clockwise, so a four-figure ring of radius 100 about the origin puts
 * its figures at exactly `(0,−100)`, `(100,0)`, `(0,100)`, `(−100,0)`. Every
 * number in the first test is one a reader can confirm by pointing at a clock,
 * and none of them came out of the code.
 *
 * The determinism check is separate and secondary. Determinism is necessary —
 * the animation depends on the ring being a fixed drawing that CSS turns — but
 * it is not sufficient, and a suite that only checked determinism would be the
 * self-comparison this docblock exists to reject.
 */

const ORIGIN = { x: 0, y: 0 };

describe("warli ring geometry — placement", () => {
	it("puts a four-figure ring on the clock positions, computed by hand", () => {
		const placements = ringPlacements({
			centre: ORIGIN,
			radius: 100,
			count: 4,
			phaseDeg: 0,
			facing: "outward",
		});

		expect(placements.map((p) => p.angleDeg)).toEqual([0, 90, 180, 270]);
		expect(placements.map((p) => p.foot)).toEqual([
			{ x: 0, y: -100 }, // twelve o'clock
			{ x: 100, y: 0 }, // three
			{ x: 0, y: 100 }, // six
			{ x: -100, y: 0 }, // nine
		]);
		expect(placements.map((p) => p.rotationDeg)).toEqual([0, 90, 180, 270]);
	});

	it("turns an inward-facing ring by a half turn, so bodies grow toward the centre", () => {
		const [top] = ringPlacements({
			centre: ORIGIN,
			radius: 100,
			count: 4,
			phaseDeg: 0,
			facing: "inward",
		});
		if (top === undefined) {
			throw new Error("expected a placement at twelve o'clock");
		}

		expect(top.foot).toEqual({ x: 0, y: -100 });
		expect(top.rotationDeg).toBe(180);

		// A figure is 58 tall, drawn up its own −y from feet at local (0,0). Turned
		// by 180° at the top of the ring, its crown must end up 58 units CLOSER to
		// the centre than its feet: radius 100 − 58 = 42. This is the assertion
		// that actually proves "inward" means inward; the rotation number alone
		// would be equally consistent with a figure drawn upside down on the spot.
		const crown = placeLocalPoint({ x: 0, y: -58 }, top.rotationDeg, top.foot);
		expect(crown).toEqual({ x: 0, y: -42 });
		expect(Math.hypot(crown.x, crown.y)).toBeCloseTo(42, 10);
	});

	it("places a figure-local point by rotate-then-translate, computed by hand", () => {
		// At three o'clock the figure is turned 90°, which maps its local +x to
		// screen-down and its local −y to screen-right. A left hand at (−20,−40)
		// therefore lands 40 to the right of the foot and 20 above it.
		expect(placeLocalPoint({ x: -20, y: -40 }, 90, { x: 100, y: 0 })).toEqual({
			x: 140,
			y: -20,
		});
		expect(placeLocalPoint({ x: 20, y: -40 }, 90, { x: 100, y: 0 })).toEqual({
			x: 140,
			y: 20,
		});
	});

	it("puts a point on the ring at the angle a clock face would predict", () => {
		expect(pointOnRing(ORIGIN, 10, 0)).toEqual({ x: 0, y: -10 });
		expect(pointOnRing(ORIGIN, 10, 90)).toEqual({ x: 10, y: 0 });
		expect(pointOnRing(ORIGIN, 10, 180)).toEqual({ x: 0, y: 10 });
		expect(pointOnRing(ORIGIN, 10, 270)).toEqual({ x: -10, y: 0 });
		// Off-axis, so the test is not satisfied by a lookup table of four cases.
		expect(pointOnRing({ x: 5, y: 5 }, 10, 30)).toEqual({ x: 10, y: -3.6603 });
	});
});

describe("warli ring geometry — the hand chain", () => {
	const handLeft = () => ({ x: -20, y: -40 });
	const handRight = () => ({ x: 20, y: -40 });

	it("closes the chain: one link per figure, last joined back to first", () => {
		const placements = ringPlacements({
			centre: ORIGIN,
			radius: 100,
			count: 4,
			phaseDeg: 0,
			facing: "outward",
		});
		const links = ringLinks(placements, handLeft, handRight, "outward");
		expect(links).toHaveLength(4);

		// Link 0 runs from the twelve-o'clock figure's RIGHT hand to the
		// three-o'clock figure's LEFT hand. Both endpoints hand-computed:
		//   right hand at 12: rotate 0  → (20,−40)  + (0,−100) = (20,−140)
		//   left  hand at  3: rotate 90 → (40,−20)  + (100,0)  = (140,−20)
		expect(links[0]).toEqual({
			from: { x: 20, y: -140 },
			to: { x: 140, y: -20 },
		});

		// The last link must wrap: nine o'clock back to twelve.
		expect(links[3]?.to).toEqual({ x: -20, y: -140 });
	});

	it("reverses which hand reaches forward when the ring faces inward", () => {
		// This is the sign error the engine exists to hold: an inward-facing
		// figure's local +x points counter-clockwise, so its LEFT hand is the one
		// that reaches the next index. If this ever matched the outward case, every
		// figure would be holding the hand of the person behind them across the
		// front of the person in front — and the ring would still LOOK linked.
		const placements = ringPlacements({
			centre: ORIGIN,
			radius: 100,
			count: 4,
			phaseDeg: 0,
			facing: "inward",
		});
		const links = ringLinks(placements, handLeft, handRight, "inward");

		//   left hand at 12, rotate 180 → (20,40) + (0,−100) = (20,−60)
		expect(links[0]?.from).toEqual({ x: 20, y: -60 });

		const outward = ringLinks(
			ringPlacements({
				centre: ORIGIN,
				radius: 100,
				count: 4,
				phaseDeg: 0,
				facing: "outward",
			}),
			handLeft,
			handRight,
			"outward",
		);
		expect(links[0]?.from).not.toEqual(outward[0]?.from);
	});

	it("returns no links for a degenerate ring", () => {
		const single = ringPlacements({
			centre: ORIGIN,
			radius: 100,
			count: 1,
			phaseDeg: 0,
			facing: "outward",
		});
		expect(ringLinks(single, handLeft, handRight, "outward")).toEqual([]);
	});
});

describe("warli ring geometry — the field, and determinism", () => {
	it("puts field motifs exactly halfway between figures", () => {
		// Eight figures 45° apart, first at 22.5°, so the gaps are at 45°, 90°, …
		expect(interstitialAngles(8, 22.5)).toEqual([
			45, 90, 135, 180, 225, 270, 315, 360,
		]);
	});

	it("is deterministic — identical inputs give a deep-equal drawing", () => {
		const params = {
			centre: { x: 720, y: 500 },
			radius: 330,
			count: 8,
			phaseDeg: 22.5,
			facing: "outward",
		} as const;
		expect(ringPlacements(params)).toEqual(ringPlacements(params));
		// The transform STRING is what reaches the DOM, so equal objects are not
		// enough — float formatting has to be stable too.
		expect(ringPlacements(params).map((p) => p.transform)).toEqual(
			ringPlacements(params).map((p) => p.transform),
		);
	});

	it("keeps the auth card clear of the inner ring — the plan's load-bearing number", () => {
		// docs/plans/WARLI-1.md §3: the card is max-w-md (448) less px-4 either
		// side = 416 wide, and about 480 tall, so its half-diagonal is
		// √(208² + 240²). The inner radius exists to be larger than that number.
		// If someone later shrinks R_INNER for composition, this is what says no.
		const cardHalfDiagonal = Math.hypot(416 / 2, 480 / 2);
		expect(cardHalfDiagonal).toBeCloseTo(317.6, 1);
		expect(330).toBeGreaterThan(cardHalfDiagonal);

		// And the outer ring must fit a 1000-tall frame from a centre at y=500.
		expect(500 - 470).toBe(30);
	});
});
