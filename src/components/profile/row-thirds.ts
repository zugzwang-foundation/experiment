"use client";

import { type RefObject, useEffect } from "react";

/**
 * ⚠⚠ THE ROW THIRD IS AN ARITHMETIC DECISION, AND IT LIVES OUT HERE AS A PURE
 * FUNCTION BECAUSE THAT IS THE ONLY WAY IT CAN BE TESTED.
 *
 * ⛔ THE HOOK BELOW CANNOT BE TESTED AND SHOULD NOT BE TRUSTED TO CARRY A RULE.
 * jsdom performs no layout: every rect is zero, so the effect returns at its
 * first guard and a render test observes nothing at all. That is exactly how
 * the defect this function exists to prevent reached staging — a forced row
 * height that did not fit its region, with a suite of green render tests over
 * it and every row measuring equal. ⇒ Everything that can be decided from
 * NUMBERS is decided here, where `row-third.test.ts` can hold it to the numbers
 * measured on the mockup and on staging. The hook keeps only the part that is
 * irreducibly a measurement.
 *
 * @param regionHeight  the scroll container's `clientHeight`
 * @param padY          that container's vertical padding, both edges
 * @param headHeight    the sticky column-header row, which is inside the
 *                      container but is not one of the rows being divided
 * @param rowWindow     how many rows fill the region — the founder's three
 * @param naturalHeight the tallest row's height with NOTHING forced
 * @returns the px height to write on every row, or `null` for "write nothing"
 */
export function rowThird({
	regionHeight,
	padY,
	headHeight,
	rowWindow,
	naturalHeight,
}: {
	regionHeight: number;
	padY: number;
	headHeight: number;
	rowWindow: number;
	naturalHeight: number;
}): number | null {
	if (rowWindow <= 0) {
		return null;
	}
	// `Math.floor`, never round: a third that rounds UP puts three rows past the
	// region and re-introduces the overflow this is meant to sit inside.
	const third = Math.floor((regionHeight - padY - headHeight) / rowWindow);
	if (third <= 0) {
		// jsdom (no layout) and a not-yet-measured panel both land here.
		return null;
	}
	// ⛔⛔ THE FLOOR CHECK — THE WHOLE POINT OF THIS FUNCTION, AND THE DEFECT
	// PROFILE OVERLAP R1 WAS OPENED ON. A `<tr>`'s `height` is a MINIMUM, not a
	// maximum: a row asked to be shorter than its content simply is not, so
	// forcing a third that the content overruns does not make the rows equal —
	// it makes them equal to each OTHER and taller than the share they were
	// given, and three of those overflow the region. The overflow then scrolls a
	// row up behind the sticky header, which is what the founder measured.
	// ⇒ When the third cannot be honoured, DON'T FORCE IT. Natural heights are
	// content-equal in this table anyway (the Position cell dominates), and a
	// natural row cannot overflow a share it was never given. Degrading to
	// "unforced and scrollable" is a bound; forcing and overflowing is a defect.
	if (naturalHeight > third) {
		return null;
	}
	return third;
}

/**
 * PROFILE REFINEMENT · R1 — EVERY ROW IS ONE THIRD OF ITS ROWS REGION, shared by
 * the positions table and the bookmarks table.
 *
 * ⛔ IT LIVES IN ITS OWN MODULE BECAUSE BOTH TABLES NEED IT AND NEITHER OWNS IT.
 * R1 names the POSITION rows, and the bookmark rows are their twin — the two
 * surfaces are one shell with the left panel swapped, and the mockup's bookmark
 * mode reuses the very same `.prow` element with the very same
 * `flex: 0 0 33.3333%`. So equalising one and leaving the other ragged would be
 * the drift the pair is supposed to be immune to. MEASURED before this was
 * shared: positions `[128, 128, 128]` against bookmarks `[136, 92]`.
 *
 * ⚠ WHAT THE MOCKUP ACTUALLY DOES, measured with its fixed-viewport root pinned
 * to a literal 1440×777 so it is comparable to staging: `.rows` is **385**, each
 * `.prow` is `flex: 0 0 33.3333%` **with `min-height: 0`**, all three rows are
 * **128**, the gap between them is **0**, and their sum is **384**. There is no
 * text clamp anywhere near it — every `.ptitle` computes
 * `-webkit-line-clamp: none` and they render 2, 2 and 3 lines. The row height
 * does all the work, and `min-height: 0` is what makes its basis a CAP rather
 * than a floor: content taller than a third overflows the row instead of
 * growing it. ⇒ A `<tr>` has no such switch, which is why `rowThird` above
 * refuses the share rather than forcing one that cannot hold.
 *
 * ⚠ WHY JS AND NOT `height: 33.3333%`. Tried first and measured to fail: with
 * the table at `height:100%` and each `<tr>` at `33.3333%` the rows came out
 * `[95, 107, 95]` — a percentage row height resolves against a table box that
 * is itself content-driven, and a `<tr>` height is a minimum either way. A
 * definite px value is what binds.
 *
 * ⛔ IT GATES ON THE REGION BEING DEFINITE. At `lg`+ these routes are
 * one-screen, so the panel's height comes from the viewport and a third of it is
 * a real number. Below `lg` the page grows, the body's height is content-driven,
 * and a third of it would be a function of the rows being sized — so the inline
 * heights are CLEARED rather than chasing their own tail. The test is the PAGE
 * (`doc.scrollHeight`), not a breakpoint literal, which is the same test the
 * positions panel's own window cap uses and needs no `1024` written down.
 */
export function useEqualRowThirds({
	bodyRef,
	tableRef,
	testidPrefix,
	extraHeadSelector,
	rowWindow,
	rowCount,
}: {
	/** The scroll container whose height the third is taken from. */
	bodyRef: RefObject<HTMLDivElement | null>;
	/** The table holding the rows. */
	tableRef: RefObject<HTMLTableElement | null>;
	/** `data-testid` prefix identifying a data row (never a sell-host row). */
	testidPrefix: string;
	/**
	 * POSREV-1 RF-10 — a selector for rows that are CHROME rather than data: the
	 * sticky market group headers. Their height is subtracted from the region
	 * alongside `<thead>`'s, so the three tiles divide what is actually left.
	 * Omitted ⇒ nothing extra, which is what every pre-POSREV-1 caller meant.
	 */
	extraHeadSelector?: string;
	/** How many rows fill the region — the founder's three. */
	rowWindow: number;
	/**
	 * How many rows are currently visible. It is a real DEPENDENCY (a filter
	 * change must re-measure) and it is USED below rather than listed for its own
	 * sake — an unlisted-but-needed dep goes stale, and a listed-but-unused one
	 * is a smell the linter is right to reject.
	 */
	rowCount: number;
}): void {
	useEffect(() => {
		const body = bodyRef.current;
		const table = tableRef.current;
		if (body === null || table === null) {
			return;
		}
		if (rowCount === 0) {
			// Nothing to equalise, and nothing to clean up: a table with no rows has
			// no inline heights left behind — the rows themselves are gone.
			return;
		}
		const measure = () => {
			const rows = table.querySelectorAll<HTMLTableRowElement>(
				`tbody > tr[data-testid^="${testidPrefix}"]`,
			);
			if (rows.length === 0) {
				return;
			}
			const clear = () => {
				for (const row of rows) {
					if (row.style.height !== "") {
						row.style.height = "";
					}
				}
			};
			const doc = document.documentElement;
			if (doc.scrollHeight > doc.clientHeight + 1) {
				// Growable page ⇒ no definite region to take a third of.
				clear();
				return;
			}
			// ⚠⚠ MEASURE FROM NOTHING FORCED, EVERY TIME. The natural height is only
			// observable with the inline heights off, so this clears FIRST and reads
			// second. Both happen inside one callback, so there is no paint between
			// them — and starting from the same state on every invocation is what
			// makes the sequence idempotent rather than a ratchet: clear → read →
			// decide → maybe write reaches the same terminal state whether it runs
			// once or ten times, so the observer below settles instead of oscillating.
			clear();
			let naturalHeight = 0;
			for (const row of rows) {
				naturalHeight = Math.max(
					naturalHeight,
					row.getBoundingClientRect().height,
				);
			}
			const cs = getComputedStyle(body);
			const head = table.querySelector("thead");
			// ⚠⚠ POSREV-1 RF-10 — THE GROUP HEADERS COUNT AS CHROME, NOT AS ROWS.
			// The founder's rule is "three ARGUMENT tiles; group headers are sticky
			// and do NOT consume a slot". Sticky positioning takes no layout space
			// only while an element is STUCK — in normal flow each group header
			// occupies its own band, so leaving it out of the chrome would hand its
			// height to the three tiles and make each one taller than a third of what
			// is actually left. The row selector above already excludes them (they
			// carry a different testid prefix); this is the other half of the same
			// exclusion, and without it the two halves disagree.
			const extraHead =
				extraHeadSelector === undefined
					? 0
					: [...table.querySelectorAll(extraHeadSelector)].reduce(
							(acc, el) => acc + el.getBoundingClientRect().height,
							0,
						);
			const third = rowThird({
				regionHeight: body.clientHeight,
				padY:
					(Number.parseFloat(cs.paddingTop) || 0) +
					(Number.parseFloat(cs.paddingBottom) || 0),
				headHeight:
					(head ? head.getBoundingClientRect().height : 0) + extraHead,
				rowWindow,
				naturalHeight,
			});
			if (third === null) {
				// Already cleared above — the rows stand at their content height.
				return;
			}
			const next = `${third}px`;
			for (const row of rows) {
				row.style.height = next;
			}
		};
		measure();
		if (typeof ResizeObserver === "undefined") {
			return;
		}
		const observer = new ResizeObserver(measure);
		observer.observe(table);
		return () => observer.disconnect();
	}, [bodyRef, tableRef, testidPrefix, extraHeadSelector, rowWindow, rowCount]);
}
