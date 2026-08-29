import { describe, expect, it } from "vitest";

import {
	amplitudeFor,
	bowedCircle,
	bowedLine,
	bowedPath,
	hash01,
	noise,
	pick,
	seedFrom,
} from "@/components/art/warli/primitives/wobble";

/**
 * WARLI-2 slice 2 — the hand in the line.
 *
 * ⚠ THE ASSERTION THAT MATTERS MOST HERE IS THAT THE WOBBLE IS ACTUALLY THERE.
 * Every other property below — determinism, endpoint preservation, bounded
 * amplitude — is satisfied PERFECTLY by a function that returns the straight
 * line unchanged. A suite that checked only those would pass against a wobble
 * that silently does nothing, which is the most likely way this slice fails:
 * one clamp returning zero, one seed threaded as a constant, and every figure
 * goes back to machine-true while the whole file reports green.
 *
 * So the first describe block is the one that would catch that, and it is
 * written as a POSITIVE control on the mechanism rather than as a bound on it.
 */

/** Every coordinate in a path `d` string, in order. */
const numbersIn = (d: string): number[] =>
	(d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe("wobble — it actually bows the line", () => {
	it("departs from the straight run by a visible amount", () => {
		// A 40-unit run. `amplitudeFor(40)` is 1.8, and the control point is placed
		// at twice that so the drawn curve departs by ~1.8 — a bit over one line
		// weight, which is the point: visible as a hand, not as a defect.
		const d = bowedLine(0, 0, 40, 0, 12345);
		const [, , cx, cy] = numbersIn(d);
		expect(cx).toBeCloseTo(20, 6); // control sits at the midpoint in x…
		// …and is pushed OFF the run in y. This is the assertion that fails if the
		// wobble ever degenerates to a straight line.
		expect(Math.abs(cy as number)).toBeGreaterThan(0.5);
	});

	it("gives DIFFERENT seeds different hands", () => {
		// Two marks in the same place must not bow identically, or a figure shears
		// instead of wandering. This is the property `seedFrom`'s avalanche exists
		// to provide, and consecutive seeds are exactly how it is called.
		const bows = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => {
			const n = numbersIn(bowedLine(0, 0, 30, 0, s));
			return n[3] as number; // control y
		});
		expect(new Set(bows).size).toBe(8);
		// And they are not a ramp — a monotonic sequence would be a spiral around a
		// ring, not noise. At least one sign change across eight consecutive seeds.
		const signs = bows.map((b) => Math.sign(b));
		expect(new Set(signs).size).toBeGreaterThan(1);
	});

	it("spreads the hash over the whole unit interval", () => {
		// POSITIVE CONTROL for `hash01` itself: 2,000 consecutive seeds must fill
		// all ten deciles. A hash that returned a constant, or that correlated with
		// its input, would still satisfy every "is it in range" check.
		const buckets = new Array(10).fill(0);
		for (let i = 0; i < 2000; i++) {
			const h = hash01(i);
			expect(h).toBeGreaterThanOrEqual(0);
			expect(h).toBeLessThan(1);
			buckets[Math.floor(h * 10)]++;
		}
		expect(buckets.every((b) => b > 100)).toBe(true);
		expect(Math.min(...noise2000())).toBeLessThan(-0.9);
		expect(Math.max(...noise2000())).toBeGreaterThan(0.9);
	});
});

const noise2000 = () => Array.from({ length: 2000 }, (_, i) => noise(i));

describe("wobble — the endpoints do not move", () => {
	it("keeps a bowed line's two ends exactly where they were asked for", () => {
		// ⚠ THE LOAD-BEARING PROPERTY OF THE WHOLE SLICE. A figure's hands are the
		// ring engine's chain anchors. If the wobble moved an endpoint by even a
		// tenth of a unit, every hand link would terminate beside a hand rather
		// than on it — the exact defect WARLI-1 records making once with the
		// child's scale, reproduced across every figure in the piece.
		for (const seed of [0, 1, 7, 99, -3, 250000]) {
			const n = numbersIn(bowedLine(3, -14, 20, -40, seed));
			expect(n[0]).toBe(3);
			expect(n[1]).toBe(-14);
			expect(n[n.length - 2]).toBe(20);
			expect(n[n.length - 1]).toBe(-40);
		}
	});

	it("keeps every VERTEX of a bowed polygon exact", () => {
		// The corners are where a triangle's meaning is. Only the edges bow.
		const points = [
			{ x: -9, y: -15 },
			{ x: 9, y: -15 },
			{ x: 0, y: 0 },
		];
		const d = bowedPath(points, 4242, { close: true });
		// Each `Q` contributes control + endpoint; the endpoints are the vertices.
		const endpoints = [
			...d.matchAll(/Q\s+\S+\s+\S+\s+(-?[\d.]+)\s+(-?[\d.]+)/g),
		].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
		expect(endpoints).toEqual([
			{ x: 9, y: -15 },
			{ x: 0, y: 0 },
			{ x: -9, y: -15 }, // the closing edge, back to the first vertex
		]);
		expect(d.startsWith("M -9 -15")).toBe(true);
		expect(d.endsWith("Z")).toBe(true);
	});

	it("leaves a zero-length run alone rather than dividing by it", () => {
		expect(bowedLine(5, 5, 5, 5, 1)).toBe("M 5 5 L 5 5");
	});
});

describe("wobble — it is deterministic, and that is not negotiable", () => {
	it("returns byte-identical strings for identical input", () => {
		// The ring engine's determinism guard depends on this. A `Math.random` in
		// here would not fail loudly — it would make an unrelated snapshot flap on
		// some future night and cost somebody a morning.
		const a = bowedPath(
			[
				{ x: 0, y: 0 },
				{ x: 10, y: -4 },
				{ x: 22, y: 3 },
			],
			777,
			{ close: true },
		);
		const b = bowedPath(
			[
				{ x: 0, y: 0 },
				{ x: 10, y: -4 },
				{ x: 22, y: 3 },
			],
			777,
			{ close: true },
		);
		expect(a).toBe(b);
		expect(bowedCircle(0, 0, 6, 31)).toBe(bowedCircle(0, 0, 6, 31));
		expect(bowedLine(1, 2, 3, 4, 9)).toBe(bowedLine(1, 2, 3, 4, 9));
	});

	it("mixes a seed from coordinates, stably under float noise", () => {
		// Two coordinates that differ only below the quantisation step must produce
		// the SAME seed, or the same drawing computed two ways disagrees and the
		// determinism guard starts measuring float formatting.
		expect(seedFrom(3, 10.001, -4)).toBe(seedFrom(3, 10.002, -4));
		// …but a real difference must still separate them.
		expect(seedFrom(3, 10, -4)).not.toBe(seedFrom(3, 11, -4));
		expect(seedFrom(3, 10, -4)).not.toBe(seedFrom(4, 10, -4));
	});

	it("picks the same item from the same list for the same seed", () => {
		const list = ["a", "b", "c", "d"] as const;
		expect(pick(list, 5)).toBe(pick(list, 5));
		const chosen = new Set(
			Array.from({ length: 200 }, (_, i) => pick(list, i)),
		);
		// All four reachable — a `pick` that always returned the first element
		// would satisfy determinism perfectly.
		expect(chosen.size).toBe(4);
		expect(() => pick([], 1)).toThrow(/empty/);
	});
});

describe("wobble — amplitude is proportional and clamped", () => {
	it("scales with length between a floor and a ceiling", () => {
		// One absolute amplitude cannot serve this drawing: the bow that is a
		// pleasant tremor on a 20-unit forearm is invisible on a 400-unit border
		// run and destroys a 4-unit facial mark.
		expect(amplitudeFor(4)).toBe(0.28); // floored
		expect(amplitudeFor(40)).toBeCloseTo(1.8, 6); // proportional
		expect(amplitudeFor(4000)).toBe(3.2); // ceilinged
		expect(amplitudeFor(20)).toBeGreaterThan(amplitudeFor(10));
	});

	it("never departs further than the amplitude it was given", () => {
		for (let seed = 0; seed < 300; seed++) {
			const n = numbersIn(bowedLine(0, 0, 50, 0, seed));
			// Drawn departure is half the control offset for a quadratic, and the
			// control is placed at 2× amplitude — so the curve stays inside the
			// amplitude by construction. Asserted rather than argued.
			expect(Math.abs((n[3] as number) / 2)).toBeLessThanOrEqual(
				amplitudeFor(50) + 1e-9,
			);
		}
	});

	it("wanders a circle's rim while pinning its centre", () => {
		// The one place the endpoint rule is deliberately reversed: nothing
		// attaches to a circumference, and the rim is the only part of a circle
		// that can show a hand at all.
		const d = bowedCircle(100, 50, 6, 17);
		const n = numbersIn(d);
		const xs = n.filter((_, i) => i % 2 === 0);
		const ys = n.filter((_, i) => i % 2 === 1);
		const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
		const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
		expect(cx).toBeCloseTo(100, 0);
		expect(cy).toBeCloseTo(50, 0);
		// The rim is NOT a perfect circle — the radii vary.
		const radii = xs.map((x, i) => Math.hypot(x - 100, (ys[i] as number) - 50));
		expect(new Set(radii.map((r) => r.toFixed(2))).size).toBeGreaterThan(3);
		expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.05);
	});
});
