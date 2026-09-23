import { describe, expect, it } from "vitest";

import {
	fitTitleSize,
	TITLE_LEFT_WINDOW,
	TITLE_SIZE_MIN_PX,
	titleCharsLeft,
	titleLineHeightPx,
} from "@/components/debate/composer/mirror-sizing";
import { TITLE_MAX_CHARS } from "@/components/debate/composer/payload";

/**
 * MIRROR-1 · G3 + G6 — the Mirror title's arithmetic (RF-4).
 *
 * ⚠ THE WRAP BELOW IS A MODEL OF GEIST, NOT A LAYOUT ENGINE. `fitTitleSize`
 * takes its line counts from the caller, so these tests hand it counts from a
 * deterministic greedy word-wrap over Geist's MEASURED per-glyph advances. That
 * proves the RULE — start at 16, step 0.5, stop at the first size that fits,
 * floor at 13 — on the register's own two inputs. It does not model kerning, so
 * WHERE real type lands can differ by a half-step; the real-font figures ("a
 * normal 125-character title fits at 16px; all-caps steps down") are measured
 * in a browser and live in the MIRROR-1 run report.
 */

/** A 1440px Mirror title field: 620 content − 14 gap − 118 toggle. */
const FIELD_PX = 488;

/**
 * Geist at weight 500, per-glyph advance in em — MEASURED, not typed in:
 * `CanvasRenderingContext2D.measureText` at 1000px in a real Chrome on staging
 * (2026-09-23), for every character the two samples below contain. Kerning is
 * not modelled, so this can land one half-step away from a real textarea; the
 * browser figures are in the MIRROR-1 run report.
 */
const GEIST_500_EM: Record<string, number> = {
	" ": 0.243,
	"1": 0.406,
	"2": 0.63,
	"5": 0.641,
	A: 0.689,
	B: 0.688,
	C: 0.713,
	E: 0.609,
	F: 0.595,
	G: 0.713,
	H: 0.716,
	I: 0.28,
	L: 0.583,
	M: 0.89,
	N: 0.745,
	O: 0.751,
	P: 0.657,
	R: 0.68,
	S: 0.654,
	T: 0.568,
	U: 0.694,
	V: 0.688,
	W: 0.968,
	X: 0.633,
	Y: 0.594,
	a: 0.565,
	b: 0.608,
	c: 0.563,
	e: 0.576,
	f: 0.412,
	g: 0.607,
	h: 0.591,
	i: 0.256,
	l: 0.282,
	m: 0.885,
	n: 0.591,
	o: 0.588,
	p: 0.608,
	r: 0.394,
	s: 0.537,
	t: 0.41,
	u: 0.586,
	v: 0.56,
	w: 0.829,
	x: 0.607,
	y: 0.553,
	"—": 0.908,
};

/** RF-4 letter-spacing, −0.01em per glyph. */
const TRACKING_EM = -0.01;

function advanceEm(ch: string): number {
	const em = GEIST_500_EM[ch];
	if (em === undefined) {
		throw new Error(`no measured advance for ${JSON.stringify(ch)}`);
	}
	return em + TRACKING_EM;
}

/** Greedy word wrap: how many lines `text` needs at `sizePx` in `widthPx`. */
function linesFor(text: string, sizePx: number, widthPx: number): number {
	const width = (s: string) =>
		[...s].reduce((sum, ch) => sum + advanceEm(ch) * sizePx, 0);
	let lines = 1;
	let line = "";
	for (const word of text.split(" ")) {
		const next = line === "" ? word : `${line} ${word}`;
		if (width(next) <= widthPx || line === "") {
			line = next;
		} else {
			lines += 1;
			line = word;
		}
	}
	return lines;
}

/** The register's own sample (render 1): exactly 125 characters. */
const NORMAL =
	"Sample title at the full limit — all 125 characters of an argument title stay visible while you type it into the composer box";

describe("MIRROR-1 G6 — fitTitleSize steps down only when a third line is needed", () => {
	it("mirror-sizing::the-fixtures-are-the-limit", () => {
		// Positive control on the fixture itself: both strings are AT the cap, so
		// the pair below compares case alone, never length.
		expect(NORMAL).toHaveLength(TITLE_MAX_CHARS);
		expect(NORMAL.toUpperCase()).toHaveLength(TITLE_MAX_CHARS);
	});

	it("mirror-sizing::a-normal-125-character-title-stays-at-16", () => {
		const probed: number[] = [];
		const size = fitTitleSize((s) => {
			probed.push(s);
			return linesFor(NORMAL, s, FIELD_PX);
		});
		expect(size).toBe(16);
		// Fitted on the FIRST probe — no step-down ran.
		expect(probed).toEqual([16]);
	});

	it("mirror-sizing::a-125-character-all-caps-title-takes-the-step-down-path", () => {
		const caps = NORMAL.toUpperCase();
		const probed: number[] = [];
		const size = fitTitleSize((s) => {
			probed.push(s);
			return linesFor(caps, s, FIELD_PX);
		});
		// It stepped down…
		expect(size).toBeLessThan(16);
		expect(size).toBeGreaterThanOrEqual(TITLE_SIZE_MIN_PX);
		// …to the FIRST size that fits, in half-pixel steps from 16, none skipped.
		expect(linesFor(caps, size, FIELD_PX)).toBeLessThanOrEqual(2);
		expect(linesFor(caps, size + 0.5, FIELD_PX)).toBeGreaterThan(2);
		const expected: number[] = [];
		for (let s = 16; s >= size; s -= 0.5) expected.push(s);
		expect(probed).toEqual(expected);
	});

	it("mirror-sizing::nothing-fits-lands-on-the-13px-floor-after-probing-every-step", () => {
		const probed: number[] = [];
		const size = fitTitleSize((s) => {
			probed.push(s);
			return 3;
		});
		expect(size).toBe(13);
		expect(probed).toEqual([16, 15.5, 15, 14.5, 14, 13.5, 13]);
	});

	it("mirror-sizing::line-height-is-size-times-1-375", () => {
		expect(titleLineHeightPx(16)).toBe(22);
		expect(titleLineHeightPx(13)).toBe(17.875);
		expect(titleLineHeightPx(14.5)).toBe(19.9375);
	});
});

describe("MIRROR-1 G3 — the `{n} left` counter appears only in the last ten", () => {
	it("mirror-sizing::absent-at-114", () => {
		expect(titleCharsLeft(114, TITLE_MAX_CHARS)).toBeNull();
	});

	it("mirror-sizing::10-left-at-115", () => {
		expect(titleCharsLeft(115, TITLE_MAX_CHARS)).toBe(10);
	});

	it("mirror-sizing::0-left-at-125", () => {
		expect(titleCharsLeft(125, TITLE_MAX_CHARS)).toBe(0);
	});

	it("mirror-sizing::the-window-is-ten-and-the-cap-is-125", () => {
		// The two constants the three rows above lean on, pinned so a change to
		// either is a visible edit here rather than a silent shift of the window.
		expect(TITLE_LEFT_WINDOW).toBe(10);
		expect(TITLE_MAX_CHARS).toBe(125);
		expect(titleCharsLeft(0, TITLE_MAX_CHARS)).toBeNull();
	});
});
