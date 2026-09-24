import { describe, expect, it } from "vitest";

import { COMPOSER_COPY } from "@/components/debate/composer/copy";
import {
	fitTitle,
	TITLE_BOX_PX,
	TITLE_FIT_AT_REST,
	TITLE_LEFT_WINDOW,
	TITLE_SIZE_MAX_PX,
	TITLE_SIZE_MIN_PX,
	titleCharsLeft,
	titleLineHeightPx,
	titlePaddingTopPx,
} from "@/components/debate/composer/mirror-sizing";
import { TITLE_MAX_CHARS } from "@/components/debate/composer/payload";

/**
 * MIRROR-2 · RF-4 — the Mirror title's size rule and its counter, as arithmetic.
 *
 * ⚠ THE WRAP BELOW IS A MODEL OF GEIST, NOT A LAYOUT ENGINE. `fitTitle` takes
 * its line counts from the caller, so these tests hand it counts from a
 * deterministic greedy word-wrap over Geist's MEASURED per-glyph advances. That
 * proves the RULE — start at 28, step 0.5, stop at the first size whose lines
 * number at most two AND fit the 53px box, floor at 13 — on the register's own
 * inputs. It does not model kerning, so where real type lands can differ by a
 * half-step; the real-font figures are measured in a browser and live in the
 * MIRROR-2 run report.
 */

/** A 1440px Mirror title field: 620 content − 14 gap − 118 toggle. */
const FIELD_PX = 488;

/**
 * Geist at weight 500, per-glyph advance in em — MEASURED, not typed in:
 * `CanvasRenderingContext2D.measureText` at 1000px in a real Chrome, with the
 * title field's own computed family and weight (MIRROR-1 on staging, 2026-09-23;
 * re-measured identical and extended by `d`, `j` and `q` in the MIRROR-2
 * harness, 2026-09-24), for every character the samples below contain.
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
	d: 0.608,
	e: 0.576,
	f: 0.412,
	g: 0.607,
	h: 0.591,
	i: 0.256,
	j: 0.284,
	l: 0.282,
	m: 0.885,
	n: 0.591,
	o: 0.588,
	p: 0.608,
	q: 0.608,
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

function fitAt(text: string, widthPx = FIELD_PX) {
	const probed: number[] = [];
	const fit = fitTitle((s) => {
		probed.push(s);
		return linesFor(text, s, widthPx);
	});
	return { ...fit, probed };
}

/** Every size the rule may try, largest first: 28, 27.5 … 13. */
function sizesDownTo(last: number): number[] {
	const out: number[] = [];
	for (let s = TITLE_SIZE_MAX_PX; s >= last; s -= 0.5) out.push(s);
	return out;
}

/** The register's own sample: exactly 125 characters. */
const NORMAL =
	"Sample title at the full limit — all 125 characters of an argument title stay visible while you type it into the composer box";
/** The founder's render, row 3: "the line fills — the font eases down to stay on one line". */
const FILLED = "A sample title that has just filled the first line";
/** The founder's render, row 4: "past one line — it flows into two lines". */
const MEDIUM = "A medium sample title that no longer fits on one line at all";

describe("MIRROR-2 RF-4 — the largest size from 28 down that fits two lines in the box", () => {
	it("mirror-sizing::the-fixtures-are-what-they-claim", () => {
		// Positive control on the fixtures: the pair below compares case alone,
		// never length, and the placeholder is the shipped one.
		expect(NORMAL).toHaveLength(TITLE_MAX_CHARS);
		expect(NORMAL.toUpperCase()).toHaveLength(TITLE_MAX_CHARS);
		expect(COMPOSER_COPY.argumentLabel).toBe("Your argument — required");
	});

	it("mirror-sizing::the-placeholder-sits-at-28-on-one-line", () => {
		const fit = fitAt(COMPOSER_COPY.argumentLabel);
		expect(fit).toMatchObject({ sizePx: 28, lines: 1 });
		// Fitted on the FIRST probe — nothing stepped down.
		expect(fit.probed).toEqual([28]);
		// And it is where the field rests before anything is measured.
		expect(TITLE_FIT_AT_REST).toEqual({ sizePx: 28, lines: 1 });
	});

	it("mirror-sizing::hello-sits-at-28-on-one-line", () => {
		expect(fitAt("Hello")).toMatchObject({
			sizePx: 28,
			lines: 1,
			probed: [28],
		});
	});

	it("mirror-sizing::a-filling-line-eases-down-and-stays-on-one-line", () => {
		const fit = fitAt(FILLED);
		expect(fit.lines).toBe(1);
		// Eased down from 28, but above 21 — where it would have to break.
		expect(fit.sizePx).toBeLessThan(28);
		expect(fit.sizePx).toBeGreaterThan(21);
		// The model lands where the founder's render does (23px · 1 line).
		expect(fit.sizePx).toBe(23);
		// The first size that fits, with none skipped on the way down.
		expect(fit.probed).toEqual(sizesDownTo(fit.sizePx));
	});

	it("mirror-sizing::past-one-line-the-text-flows-into-two-at-21-or-below", () => {
		const fit = fitAt(MEDIUM);
		expect(fit.lines).toBe(2);
		expect(fit.sizePx).toBeLessThanOrEqual(21);
		// It is the LARGEST two-line size: half a step up needs three lines, or
		// two lines taller than the box.
		const up = fit.sizePx + 0.5;
		const upLines = linesFor(MEDIUM, up, FIELD_PX);
		expect(upLines > 2 || upLines * titleLineHeightPx(up) > TITLE_BOX_PX).toBe(
			true,
		);
	});

	it("mirror-sizing::a-normal-125-character-title-lands-near-16", () => {
		const fit = fitAt(NORMAL);
		expect(fit).toMatchObject({ sizePx: 16, lines: 2 });
		expect(linesFor(NORMAL, 16.5, FIELD_PX)).toBeGreaterThan(2);
	});

	it("mirror-sizing::a-125-character-all-caps-title-lands-lower", () => {
		const normal = fitAt(NORMAL);
		const caps = fitAt(NORMAL.toUpperCase());
		expect(caps.sizePx).toBeLessThan(normal.sizePx);
		expect(caps.sizePx).toBeGreaterThanOrEqual(TITLE_SIZE_MIN_PX);
		expect(caps.lines).toBeLessThanOrEqual(2);
		expect(caps.probed).toEqual(sizesDownTo(caps.sizePx));
	});

	it("mirror-sizing::two-lines-never-fit-above-21px-because-the-box-is-53", () => {
		// A text that takes two lines at every size: 21.5 × 1.25 × 2 = 53.75 > 53,
		// so the first two-line size that fits the box is 21 — not 28.
		expect(fitTitle(() => 2)).toEqual({ sizePx: 21, lines: 2 });
		// One line at every size fits at once.
		expect(fitTitle(() => 1)).toEqual({ sizePx: 28, lines: 1 });
	});

	it("mirror-sizing::nothing-fits-lands-on-the-13px-floor-after-probing-every-step", () => {
		const probed: number[] = [];
		const fit = fitTitle((s) => {
			probed.push(s);
			return 3;
		});
		expect(fit).toEqual({ sizePx: 13, lines: 3 });
		expect(probed).toEqual(sizesDownTo(13));
		expect(probed).toHaveLength(31);
	});

	it("mirror-sizing::every-search-starts-at-28-so-deleting-lets-the-type-grow-back", () => {
		// No state between calls: after a floor result, a short title is 28 again.
		expect(fitAt(NORMAL.toUpperCase(), 280).sizePx).toBe(13);
		expect(fitAt("Hello", 280).probed[0]).toBe(28);
		expect(fitAt("Hello", 280).sizePx).toBe(28);
	});

	it("mirror-sizing::a-zero-measurement-counts-as-one-line", () => {
		// An element with no layout reads 0; a field always holds a line.
		expect(fitTitle(() => 0)).toEqual({ sizePx: 28, lines: 1 });
	});
});

describe("MIRROR-2 RF-4 — line height and centring", () => {
	it("mirror-sizing::line-height-is-size-times-1-25", () => {
		expect(titleLineHeightPx(28)).toBe(35);
		expect(titleLineHeightPx(16)).toBe(20);
		expect(titleLineHeightPx(21)).toBe(26.25);
		expect(titleLineHeightPx(13)).toBe(16.25);
	});

	it("mirror-sizing::padding-top-centres-the-lines-in-the-53px-box", () => {
		// (53 − lines × line height) / 2
		expect(titlePaddingTopPx({ sizePx: 28, lines: 1 })).toBe(9);
		expect(titlePaddingTopPx({ sizePx: 16, lines: 2 })).toBe(6.5);
		expect(titlePaddingTopPx({ sizePx: 21, lines: 2 })).toBe(0.25);
		expect(titlePaddingTopPx({ sizePx: 13, lines: 3 })).toBe(2.125);
	});

	it("mirror-sizing::text-taller-than-the-box-starts-at-the-top", () => {
		// Four lines of 13px are 65px; they cannot be centred in 53, so they start
		// at the top and the field scrolls — never a negative padding.
		expect(titlePaddingTopPx({ sizePx: 13, lines: 4 })).toBe(0);
		expect(TITLE_BOX_PX).toBe(53);
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
