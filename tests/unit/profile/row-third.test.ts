import { describe, expect, it } from "vitest";

import { rowThird } from "@/components/profile/row-thirds";

/**
 * PROFILE OVERLAP · R1 — THE ROW THIRD, held to the numbers it was measured on.
 *
 * ⚠⚠ WHY A PURE-FUNCTION TEST AND NOT A RENDER TEST. The rule under test is
 * arithmetic about layout, and jsdom performs no layout — every rect is zero, so
 * the hook that calls this returns at its first guard and a render assertion
 * observes nothing whatsoever. That is precisely how the R1 defect shipped: the
 * forced row height did not fit its region, every row measured equal to every
 * other, and a full render suite was green over it. `equal` was the wrong
 * invariant; `fits` is the one that matters, and only numbers can carry it.
 *
 * ⇒ The cases below are the figures measured on the mockup (its fixed-viewport
 * root pinned to a literal 1440×777) and on live staging at the same size, not
 * invented ones.
 */

// The staging positions panel, pinned 1440×777: body `clientHeight` 429, its
// `p-3` contributing 12 + 12, and the sticky column-header row 19.
const STAGING = { regionHeight: 429, padY: 24, headHeight: 19 } as const;
// The rows' natural height on that surface, measured with nothing forced.
const NATURAL = 95;

describe("rowThird — the share three rows divide", () => {
	it("third::matches-the-mockup-at-the-pinned-size", () => {
		// 429 − 24 − 19 = 386 available; 386 / 3 = 128.67 → 128. The mockup at the
		// same pinned size: `.rows` 385, three rows 128, gap 0, sum 384. The build
		// arrives at the mockup's row height by arithmetic, not by copying it.
		expect(rowThird({ ...STAGING, rowWindow: 3, naturalHeight: NATURAL })).toBe(
			128,
		);
	});

	it("third::floors-and-never-rounds-up", () => {
		// ⛔ THE DIRECTION MATTERS. A third that rounds UP puts three rows past the
		// region — the overflow, re-introduced by 1px at a time. 386/3 rounds to
		// 129, and 3 × 129 = 387 > 386.
		const forced = rowThird({
			...STAGING,
			rowWindow: 3,
			naturalHeight: NATURAL,
		});
		expect(forced).not.toBeNull();
		expect((forced ?? 0) * 3).toBeLessThanOrEqual(
			STAGING.regionHeight - STAGING.padY - STAGING.headHeight,
		);
	});

	it("third::REFUSES-a-share-the-content-overruns", () => {
		// ⛔⛔ THE DEFECT R1 WAS OPENED ON. A `<tr>` height is a MINIMUM: a row told
		// to be 85 when its content needs 95 is 95, so forcing the share produces
		// three rows of 95 inside a region that budgeted 255 — and the surplus
		// scrolls a row up behind the sticky header. Refusing leaves them natural,
		// which is content-equal in this table anyway and cannot overrun a share it
		// was never given.
		expect(
			rowThird({
				regionHeight: 300,
				padY: 24,
				headHeight: 19,
				rowWindow: 3,
				naturalHeight: NATURAL,
			}),
		).toBeNull();
	});

	it("third::forces-when-the-content-exactly-fills-the-share", () => {
		// The boundary belongs to the forcing side: a row whose content is exactly
		// the share does fit it, and equalising is then free.
		expect(rowThird({ ...STAGING, rowWindow: 3, naturalHeight: 128 })).toBe(
			128,
		);
		expect(
			rowThird({ ...STAGING, rowWindow: 3, naturalHeight: 129 }),
		).toBeNull();
	});

	it("third::returns-null-where-there-is-no-layout", () => {
		// jsdom, and any panel read before it has been measured. ⛔ Returning 0 here
		// would write `height: 0px` on every row and hide the whole table.
		expect(
			rowThird({
				regionHeight: 0,
				padY: 0,
				headHeight: 0,
				rowWindow: 3,
				naturalHeight: 0,
			}),
		).toBeNull();
	});

	it("third::returns-null-for-an-empty-window", () => {
		// Not reachable from either table (both pass a literal 3), but a divisor of
		// zero is worth being explicit about rather than dividing by.
		expect(
			rowThird({ ...STAGING, rowWindow: 0, naturalHeight: NATURAL }),
		).toBeNull();
	});

	it("third::the-header-and-padding-are-INSIDE-the-region", () => {
		// ⚠ THE ARITHMETIC THAT WENT WRONG WAS THIS SUBTRACTION, one term short.
		// Both the sticky header and the container's own padding sit inside the
		// measured `clientHeight` while being none of the rows, so a divisor that
		// skips them hands out shares the region cannot pay.
		const withChrome = rowThird({
			...STAGING,
			rowWindow: 3,
			naturalHeight: NATURAL,
		});
		const withoutChrome = rowThird({
			regionHeight: 429,
			padY: 0,
			headHeight: 0,
			rowWindow: 3,
			naturalHeight: NATURAL,
		});
		expect(withChrome).toBe(128);
		expect(withoutChrome).toBe(143);
		expect((withoutChrome ?? 0) * 3).toBeGreaterThan(386);
	});
});
