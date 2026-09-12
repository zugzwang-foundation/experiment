import { describe, expect, it } from "vitest";
import { TITLE_MAX_CHARS } from "@/components/debate/composer/payload";
import {
	GEIST_QUOTE_INK,
	GEIST_UPPER_ADV,
	QUOTE_CANVAS,
	QUOTE_CONTENT_H,
	QUOTE_CONTENT_W,
	QUOTE_MARK,
	QUOTE_TYPE,
	quoteMarkSize,
	quoteMaxLines,
	quoteTitleSize,
	WRAP_SLACK,
} from "@/components/debate/quote-well/size";

/**
 * QUOTE-1 C — the well's sizing arithmetic (design-canon `C-QUOTE-1` clause 4,
 * SPEC.1 2.0.2).
 *
 * ⚠⚠ THE NAMED POINTS ARE LITERALS ON PURPOSE, AND THAT IS THE WHOLE VALUE OF
 * THIS FILE. Re-deriving them from the constants would make every assertion
 * tautological — the test would compute what the code computes and agree with
 * itself no matter what either said. `GEIST_UPPER_ADV` and `GEIST_QUOTE_INK` are
 * MEASURED values (headless Chrome 152 against the deployed Geist latin subset,
 * 2026-09-11), and a measured constant edited by hand — or a font swap that
 * invalidates it — is precisely the change that must redden something. So the sizes
 * below are the answers as SHIPPED, written out.
 *
 * ⚠ `WRAP_SLACK` IS NOT ONE OF THEM, and this block said it was. It is a CHOSEN
 * allowance for greedy word-breaking, exactly as `size.ts` describes it. Which
 * constants are measurements is this file's whole thesis, so being wrong about it
 * here was worse than not saying it — caught by `@code-reviewer`.
 *
 * ⛔ IF ONE OF THESE REDS, THE QUESTION IS "DID A CONSTANT MOVE, AND WAS THAT
 * INTENDED", NOT "WHAT SHOULD THE NEW NUMBER BE". Re-measure the face before
 * re-typing the pin (`size.ts` carries the method).
 *
 * ⚠ The brief's worked table assumed ADV ≈ 0.70; the shipped face measured
 * 0.6015 — 14% narrower — so every size here is LARGER than that table. The
 * function is the brief's; only the face is not.
 */

/** The SHIPPED answers at the brief's named lengths. Literals, never derived. */
const PINS: ReadonlyArray<readonly [len: number, size: number]> = [
	[10, 56],
	[25, 53],
	[50, 41],
	[75, 33],
	[100, 28],
	[125, 27],
];

describe("QUOTE-1 C — quoteTitleSize", () => {
	it("quote-well-size::the-named-lengths-carry-their-SHIPPED-sizes", () => {
		for (const [len, size] of PINS) {
			expect(quoteTitleSize(len), `len ${len}`).toBe(size);
		}
	});

	it("quote-well-size::every-size-is-inside-the-ratified-bounds", () => {
		// Clause 4 — "the largest integer size in [24, 56] px". Swept over the whole
		// legal title range rather than at the named points, because a bound is a
		// property of the function and not of six inputs.
		for (let len = 1; len <= TITLE_MAX_CHARS; len++) {
			const s = quoteTitleSize(len);
			expect(s, `len ${len}`).toBeGreaterThanOrEqual(QUOTE_TYPE.min);
			expect(s, `len ${len}`).toBeLessThanOrEqual(QUOTE_TYPE.max);
			expect(Number.isInteger(s), `len ${len} integer`).toBe(true);
		}
		// ⛔ NON-VACUITY, and it is not decoration: an implementation returning the
		// floor for every input satisfies every assertion above. The range must be
		// really USED at both ends of the interesting span.
		expect(quoteTitleSize(1)).toBe(QUOTE_TYPE.max);
		expect(quoteTitleSize(TITLE_MAX_CHARS)).toBeLessThan(QUOTE_TYPE.max);
	});

	it("quote-well-size::size-never-grows-as-the-title-grows", () => {
		// A longer title that rendered LARGER would be the defect a reader sees
		// first and the arithmetic hides best — a single non-monotone step is
		// invisible in any one screenshot.
		let previous = Number.POSITIVE_INFINITY;
		for (let len = 1; len <= TITLE_MAX_CHARS; len++) {
			const s = quoteTitleSize(len);
			expect(s, `len ${len} vs ${len - 1}`).toBeLessThanOrEqual(previous);
			previous = s;
		}
	});

	it("quote-well-size::the-fitted-size-actually-FITS-the-224px-content-box", () => {
		// ⚠ HONEST ABOUT WHAT THIS IS: inside the legal title range it RE-EVALUATES
		// the loop's own exit predicate, so it cannot fail there. Kept as the written
		// statement of the contract — and the assertion that CAN fail is the
		// fall-through boundary below, which `@code-reviewer` found missing. Recorded
		// rather than deleted, because a reader who mistakes this for independent
		// evidence stops looking for the boundary.
		for (let len = 1; len <= TITLE_MAX_CHARS; len++) {
			const s = quoteTitleSize(len);
			const cpl =
				Math.floor(QUOTE_CONTENT_W / (GEIST_UPPER_ADV * s)) * WRAP_SLACK;
			const need =
				Math.ceil(len / cpl) * QUOTE_TYPE.lineHeight * s +
				2 * GEIST_QUOTE_INK * quoteMarkSize(s) +
				2 * QUOTE_TYPE.gap;
			expect(need, `len ${len} needs ${need.toFixed(2)}px`).toBeLessThanOrEqual(
				QUOTE_CONTENT_H,
			);
		}
	});

	it("quote-well-size::the-content-box-is-497-by-224", () => {
		// The two numbers every budget above is computed against. `pad` is the TOTAL
		// inset (border included) — `size.ts` records why 24px of padding inside a
		// 1px border would make these 495 × 222 and every budget optimistic by 2px.
		expect(QUOTE_CANVAS).toEqual({ w: 545, h: 272, pad: 24 });
		expect(QUOTE_CONTENT_W).toBe(497);
		expect(QUOTE_CONTENT_H).toBe(224);
	});
});

describe("QUOTE-1 C — quoteMarkSize", () => {
	it("quote-well-size::the-mark-is-2.5x-the-title-between-its-clamps", () => {
		// Clause 5 — `clamp(60px, 2.5 × title size, 140px)`.
		expect(quoteMarkSize(24)).toBe(60); // 60 exactly — the floor BINDS here
		expect(quoteMarkSize(30)).toBe(75);
		expect(quoteMarkSize(41)).toBe(102.5);
		expect(quoteMarkSize(56)).toBe(140); // 140 exactly — the ceiling BINDS here
	});

	it("quote-well-size::both-clamps-really-clamp", () => {
		// Below the floor and above the ceiling, which the legal size range does not
		// itself reach — so the clamps are asserted on inputs that test them rather
		// than on inputs where the multiplication happens to land inside.
		expect(quoteMarkSize(1)).toBe(QUOTE_MARK.min);
		expect(quoteMarkSize(0)).toBe(QUOTE_MARK.min);
		expect(quoteMarkSize(1000)).toBe(QUOTE_MARK.max);
		for (let s = QUOTE_TYPE.min; s <= QUOTE_TYPE.max; s++) {
			expect(quoteMarkSize(s), `size ${s}`).toBeGreaterThanOrEqual(
				QUOTE_MARK.min,
			);
			expect(quoteMarkSize(s), `size ${s}`).toBeLessThanOrEqual(QUOTE_MARK.max);
		}
	});
});

describe("QUOTE-1 C — quoteMaxLines", () => {
	it("quote-well-size::at-least-one-line-fits-at-every-legal-size", () => {
		// ⛔ A well that can hold ZERO lines is a well that renders no title, and
		// the marks would still draw — an empty frame with two quotation marks in
		// it. The size ceiling is where this is tightest: 140px of mark either side.
		for (let s = QUOTE_TYPE.min; s <= QUOTE_TYPE.max; s++) {
			expect(quoteMaxLines(s), `size ${s}`).toBeGreaterThanOrEqual(1);
		}
	});

	it("quote-well-size::more-lines-fit-at-smaller-sizes", () => {
		expect(quoteMaxLines(QUOTE_TYPE.min)).toBeGreaterThan(
			quoteMaxLines(QUOTE_TYPE.max),
		);
		let previous = 0;
		for (let s = QUOTE_TYPE.max; s >= QUOTE_TYPE.min; s--) {
			const lines = quoteMaxLines(s);
			expect(lines, `size ${s}`).toBeGreaterThanOrEqual(previous);
			previous = lines;
		}
	});

	it("quote-well-size::the-fitted-size-never-needs-more-lines-than-fit", () => {
		// ⚠ IMPLIED, NOT INDEPENDENT — and this docblock said the opposite ("a sign
		// error in either shows up here and nowhere else"), which `@code-reviewer`
		// falsified. On the success branch `lines ≤ (224 − marks − gaps)/(1.15·s)` IS
		// the exit condition, and `lines` is an integer, so
		// `lines ≤ floor(…) = quoteMaxLines(s)` follows arithmetically for every size
		// the loop can return. It is the OTHER branch, below, that has teeth.
		for (let len = 1; len <= TITLE_MAX_CHARS; len++) {
			const s = quoteTitleSize(len);
			const cpl =
				Math.floor(QUOTE_CONTENT_W / (GEIST_UPPER_ADV * s)) * WRAP_SLACK;
			expect(Math.ceil(len / cpl), `len ${len}`).toBeLessThanOrEqual(
				quoteMaxLines(s),
			);
		}
	});

	it("quote-well-size::past-the-fall-through-the-floor-ships-and-does-NOT-fit", () => {
		// ⛔⛔ CANON CLAUSE 6, AND THE ONLY ASSERTION IN THIS FILE THAT EXERCISES THE
		// LOOP'S `return QUOTE_TYPE.min`. Everything else lives on the success branch,
		// where "it fits" is the exit condition restated.
		//
		// The clause promises that a title the estimate cannot fit "clips inside the
		// canvas at the last full line; nothing escapes the well and no layout moves."
		// That is a promise about a state the function CAN reach, so the state is
		// pinned: past some length the floor ships AND the budget is really exceeded.
		//
		// ⚠ The boundary is MEASURED, not chosen — 174 UTF-16 units with the shipped
		// constants — and it sits far outside `TITLE_MAX_CHARS` (125), which is the
		// reassuring half: the product cannot write a title that reaches it. A new
		// face, a wider tracking or a raised cap could bring it inside the legal
		// range, and then this pin moves and clause 6 needs looking at again.
		// ⚠⚠ THERE ARE TWO BOUNDARIES HERE AND THE FIRST DRAFT CONFLATED THEM, which
		// is why both are pinned. Reaching the FLOOR and OUTGROWING the canvas are
		// different events, 33 characters apart:
		//   · 141 — the first length whose size is 24. It still FITS at 24; the loop
		//     exits on its success branch. Nothing is degraded here.
		//   · 174 — the first length that does NOT fit even at 24, so the loop runs
		//     out and `return QUOTE_TYPE.min` ships a size the canvas cannot hold.
		//     THIS is clause 6's state.
		// The draft asserted `size(173) > 24`, on the assumption that one shorter than
		// 174 must still earn a real size. It does not — 173 is already at the floor,
		// by the other route. Measured, then written.
		const FLOOR_LEN = 141;
		const FALL_THROUGH_LEN = 174;
		expect(FLOOR_LEN).toBeGreaterThan(TITLE_MAX_CHARS);

		// Boundary 1 — the floor is reached, and reached exactly here.
		expect(quoteTitleSize(FLOOR_LEN - 1)).toBeGreaterThan(QUOTE_TYPE.min);
		expect(quoteTitleSize(FLOOR_LEN)).toBe(QUOTE_TYPE.min);

		// Boundary 2 — the floor stops sufficing.
		expect(quoteTitleSize(FALL_THROUGH_LEN)).toBe(QUOTE_TYPE.min);

		// …and at the floor the column really does exceed the canvas, which is what
		// makes it degradation rather than a fit. An implementation that returned the
		// floor while still fitting would pass every other assertion in this file.
		const s = QUOTE_TYPE.min;
		const cpl =
			Math.floor(QUOTE_CONTENT_W / (GEIST_UPPER_ADV * s)) * WRAP_SLACK;
		const need =
			Math.ceil(FALL_THROUGH_LEN / cpl) * QUOTE_TYPE.lineHeight * s +
			2 * GEIST_QUOTE_INK * quoteMarkSize(s) +
			2 * QUOTE_TYPE.gap;
		expect(need).toBeGreaterThan(QUOTE_CONTENT_H);
		// …and the line count exceeds what `quoteMaxLines` says there is room for —
		// the relation the test above can only confirm, never test.
		expect(Math.ceil(FALL_THROUGH_LEN / cpl)).toBeGreaterThan(quoteMaxLines(s));

		// ⛔ AND ONE CHARACTER SHORTER STILL FITS, which is what makes 174 a boundary
		// rather than merely a large number. Without this, every assertion above passes
		// for any length past the real edge.
		const needJustUnder =
			Math.ceil((FALL_THROUGH_LEN - 1) / cpl) * QUOTE_TYPE.lineHeight * s +
			2 * GEIST_QUOTE_INK * quoteMarkSize(s) +
			2 * QUOTE_TYPE.gap;
		expect(needJustUnder).toBeLessThanOrEqual(QUOTE_CONTENT_H);
	});

	it("quote-well-size::an-empty-title-is-a-boundary-nobody-reaches", () => {
		// `quoteTitleSize(0)` returns the CEILING — an empty well with two marks and
		// nothing between them. Unreachable in the product: `deriveTitleTeaser` takes
		// a non-empty first line, and the composer's INV-1 gate rejects an
		// empty/whitespace title before that. Documented rather than defended — a
		// guard here would be error handling for an impossible state (CLAUDE.md §5.2)
		// — and pinned so the behaviour is a known quantity if a caller reaches it.
		expect(quoteTitleSize(0)).toBe(QUOTE_TYPE.max);
	});
});
