import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "@/lib/relative-time";

/**
 * TIME-1 · G1–G4 — the formatter's whole correctness surface.
 *
 * ⚠ EVERY BOUNDARY IS ASSERTED **AT** ITS EDGE, NOT AT A MIDPOINT. A guard that
 * checks 30 s / 30 m / 12 h passes against an off-by-one at every single one of
 * the three boundaries, which is the only defect class this function can
 * plausibly have. The pairs below (59/60 s, 3599/3600 s, 86399/86400 s) are
 * therefore the guard; the midpoints are decoration and are not asserted.
 *
 * ⚠ THE CLOCK IS SYNTHETIC AND FIXED. `NOW` is a literal, never `Date.now()` —
 * a test that reads the real clock is a test whose inputs change between runs,
 * and this function's whole point is that it does not need real data of varying
 * age to be verified.
 */

/** An arbitrary fixed reading instant. Its value is irrelevant — only deltas
 * from it are ever measured — so it is a literal rather than derived. */
const NOW = 1_800_000_000_000;

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Read `at(delta)` as "what a card whose argument is `delta` old renders". */
const at = (deltaMs: number) => formatRelativeTime(NOW, NOW - deltaMs);

describe("relative-time :: G1 — bucket boundaries, asserted at the edges", () => {
	it("relative-time::G1-the-just-now-to-minutes-edge", () => {
		expect(at(0)).toBe("just now");
		expect(at(1)).toBe("just now");
		expect(at(59 * SECOND)).toBe("just now");
		// The edge itself. 59 999 ms is still `just now`; 60 000 ms is `1m ago`.
		expect(at(MINUTE - 1)).toBe("just now");
		expect(at(MINUTE)).toBe("1m ago");
	});

	it("relative-time::G1-the-minutes-to-hours-edge", () => {
		expect(at(2 * MINUTE)).toBe("2m ago");
		expect(at(59 * MINUTE)).toBe("59m ago");
		// 3599 s truncates DOWN to 59m — never rounds up to `1h ago`.
		expect(at(3599 * SECOND)).toBe("59m ago");
		expect(at(HOUR - 1)).toBe("59m ago");
		expect(at(3600 * SECOND)).toBe("1h ago");
		expect(at(HOUR)).toBe("1h ago");
	});

	it("relative-time::G1-the-hours-to-days-edge", () => {
		expect(at(2 * HOUR)).toBe("2h ago");
		expect(at(23 * HOUR)).toBe("23h ago");
		// 86 399 s truncates DOWN to 23h — never rounds up to `1d ago`.
		expect(at(86_399 * SECOND)).toBe("23h ago");
		expect(at(DAY - 1)).toBe("23h ago");
		expect(at(86_400 * SECOND)).toBe("1d ago");
		expect(at(DAY)).toBe("1d ago");
	});

	it("relative-time::G1-the-day-bucket-is-unbounded", () => {
		expect(at(2 * DAY)).toBe("2d ago");
		// The experiment's live window is ~51 days; this is the practical
		// ceiling and it must NOT roll into a weeks or months bucket.
		expect(at(51 * DAY)).toBe("51d ago");
		// …and well past it, because "unbounded" is the ruling.
		expect(at(365 * DAY)).toBe("365d ago");
		expect(at(4000 * DAY)).toBe("4000d ago");
	});

	it("relative-time::G1-every-bucket-truncates-INSIDE-itself-not-only-at-its-edges", () => {
		// ⚠⚠ THIS TEST EXISTS BECAUSE ITS ABSENCE WAS A REAL HOLE, found by
		// `@test-writer` on this branch. Every other day-bucket assertion sits on
		// an EXACT MULTIPLE of a day — where `Math.floor` and `Math.round` agree —
		// so swapping one for the other passed all 32 guards, and an argument
		// written 36 hours ago would have shipped reading `2d ago`.
		//
		// R1 rules two separate things and the edge pairs above only prove one.
		// They prove WHERE a bucket starts; this proves the bucket TRUNCATES
		// toward zero all the way across, which is the other half of the
		// sentence. Every value below is deliberately NOT a whole multiple.
		expect(at(36 * HOUR)).toBe("1d ago"); // `Math.round` → "2d ago"
		expect(at(DAY + 23 * HOUR)).toBe("1d ago"); // `Math.round` → "2d ago"
		expect(at(2 * DAY + 12 * HOUR)).toBe("2d ago"); // `Math.round` → "3d ago"
		expect(at(50 * DAY + 23 * HOUR + 59 * MINUTE)).toBe("50d ago");

		// The same hole, one bucket down in each direction. `3599 s` and
		// `86 399 s` above are interior values, but each is at the very TOP of
		// its bucket; these sit in the middle, where a half-rounding defect that
		// happens to be correct at the top would still be wrong.
		expect(at(90 * SECOND)).toBe("1m ago"); // `Math.round` → "2m ago"
		expect(at(30 * MINUTE + 30 * SECOND)).toBe("30m ago");
		expect(at(90 * MINUTE)).toBe("1h ago"); // `Math.round` → "2h ago"
		expect(at(12 * HOUR + 31 * MINUTE)).toBe("12h ago");
	});

	it("relative-time::G1-every-minute-and-hour-step-reads-back-its-own-number", () => {
		// The three edges above pin the transitions; this pins that nothing in
		// between is silently off by one either. Both full ranges, exhaustively.
		for (let m = 1; m <= 59; m++) {
			expect(at(m * MINUTE), `${m} minutes`).toBe(`${m}m ago`);
		}
		for (let h = 1; h <= 23; h++) {
			expect(at(h * HOUR), `${h} hours`).toBe(`${h}h ago`);
		}
	});
});

describe("relative-time :: G2 — no compounding", () => {
	/** A unit token is a digit-run followed by `m`, `h` or `d` at a word
	 * boundary. Two of them in one string is a compound; `just now` carries
	 * none, which is why the count is compared against a ceiling of 1 rather
	 * than an exact 1. */
	const unitCount = (s: string) => (s.match(/\d+[mhd]\b/g) ?? []).length;

	it("relative-time::G2-the-compound-detector-can-actually-fire", () => {
		// OVN-V1 positive control. A negative assertion whose matcher is wrong
		// is indistinguishable from a passing one, so the matcher is shown
		// catching the exact wrong answer G2 exists to reject BEFORE it is used
		// against real output.
		expect(unitCount("1h 5m ago")).toBe(2);
		expect(unitCount("1d 3h ago")).toBe(2);
		expect(unitCount("1h ago")).toBe(1);
		expect(unitCount("just now")).toBe(0);
	});

	it("relative-time::G2-no-output-ever-carries-two-units", () => {
		// Swept across every boundary neighbourhood and both full ranges — a
		// compound could only ever appear where two units are both non-zero,
		// which is everywhere except the exact multiples.
		const deltas: number[] = [0, MINUTE - 1, MINUTE, HOUR - 1, HOUR];
		for (let m = 0; m <= 130; m++) deltas.push(m * MINUTE + 5 * SECOND);
		for (let h = 0; h <= 30; h++) deltas.push(h * HOUR + 7 * MINUTE);
		for (let d = 0; d <= 60; d++) deltas.push(d * DAY + 5 * HOUR + 9 * MINUTE);

		for (const delta of deltas) {
			const out = at(delta);
			expect(
				unitCount(out),
				`compound at delta=${delta}: "${out}"`,
			).toBeLessThanOrEqual(1);
		}
	});
});

describe("relative-time :: G3 — no zero unit", () => {
	it("relative-time::G3-the-zero-unit-detector-can-actually-fire", () => {
		// OVN-V1 positive control for the sweep below.
		const isZeroUnit = (s: string) => /\b0[mhd] ago\b/.test(s);
		expect(isZeroUnit("0m ago")).toBe(true);
		expect(isZeroUnit("0h ago")).toBe(true);
		expect(isZeroUnit("0d ago")).toBe(true);
		expect(isZeroUnit("10m ago")).toBe(false);
		expect(isZeroUnit("just now")).toBe(false);
	});

	it("relative-time::G3-never-renders-0m-0h-or-0d", () => {
		const isZeroUnit = (s: string) => /\b0[mhd] ago\b/.test(s);
		// Every second of the first two hours — this is where `0m ago` would
		// appear if the `just now` floor were mis-bracketed — plus every second
		// either side of the day edge, where `0d ago` would appear.
		for (let s = 0; s <= 2 * 60 * 60; s++) {
			const out = at(s * SECOND);
			expect(isZeroUnit(out), `zero unit at ${s}s: "${out}"`).toBe(false);
		}
		for (let s = 86_390; s <= 86_410; s++) {
			const out = at(s * SECOND);
			expect(isZeroUnit(out), `zero unit at ${s}s: "${out}"`).toBe(false);
		}
	});

	it("relative-time::G3-only-the-four-ruled-shapes-are-ever-emitted", () => {
		// The strongest form of G2 + G3 together: the output is not merely
		// free of compounds and zeros, it is a member of a closed set of
		// shapes. Anything the function could invent — `1 minute ago`,
		// `in 2 minutes`, an ISO string, a calendar date — fails this.
		const SHAPES = /^(just now|[1-9]\d*m ago|[1-9]\d*h ago|[1-9]\d*d ago)$/;
		const emitted = new Set<string>();
		for (let s = 0; s <= 3 * 60 * 60; s += 1) emitted.add(at(s * SECOND));
		for (let h = 0; h <= 200; h++) emitted.add(at(h * HOUR + 31 * MINUTE));
		for (let d = 0; d <= 400; d++) emitted.add(at(d * DAY + 17 * SECOND));

		const strays = [...emitted].filter((out) => !SHAPES.test(out));
		expect(strays).toEqual([]);
		// Alive check — a set that silently collected nothing passes vacuously.
		expect(emitted.size).toBeGreaterThan(100);
		expect(emitted.has("just now")).toBe(true);
		expect(emitted.has("1m ago")).toBe(true);
		expect(emitted.has("1h ago")).toBe(true);
		expect(emitted.has("1d ago")).toBe(true);
	});
});

describe("relative-time :: G4 — the clamp", () => {
	it("relative-time::G4-a-zero-delta-is-just-now", () => {
		expect(formatRelativeTime(NOW, NOW)).toBe("just now");
	});

	it("relative-time::G4-a-negative-delta-is-just-now-never-a-future-tense", () => {
		// A reader's device clock running ahead of the server's is ordinary.
		for (const ahead of [1, SECOND, MINUTE, HOUR, DAY, 400 * DAY]) {
			const out = formatRelativeTime(NOW, NOW + ahead);
			expect(out, `clock ahead by ${ahead}ms`).toBe("just now");
			expect(out).not.toMatch(/^-/);
			expect(out).not.toContain("in ");
		}
	});

	it("relative-time::G4-an-uncomputable-delta-is-just-now-never-NaN", () => {
		// `Date.parse` of anything unparseable is NaN, and an unguarded NaN
		// walks past all three `<` comparisons into `NaNd ago`. The clamp
		// catches it because it tests finiteness, not sign.
		expect(formatRelativeTime(Number.NaN, NOW)).toBe("just now");
		expect(formatRelativeTime(NOW, Number.NaN)).toBe("just now");
		expect(formatRelativeTime(Number.POSITIVE_INFINITY, NOW)).toBe("just now");
		expect(formatRelativeTime(NOW, Number.NEGATIVE_INFINITY)).toBe("just now");
	});
});
