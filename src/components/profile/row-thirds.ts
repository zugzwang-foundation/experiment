"use client";

import { type RefObject, useEffect } from "react";

/**
 * PROFILE REFINEMENT · R1 — EVERY ROW IS ONE THIRD OF ITS ROWS REGION, shared by the
 * positions table and the bookmarks table.
 *
 * ⛔ IT LIVES IN ITS OWN MODULE BECAUSE BOTH TABLES NEED IT AND NEITHER OWNS IT.
 * R1 names the POSITION rows, and the bookmark rows are their twin — the two
 * surfaces are one shell with the left panel swapped, and the mockup's bookmark mode
 * reuses the very same `.prow` element with the very same `flex: 0 0 33.3333%`. So
 * equalising one and leaving the other ragged would be the drift the pair is
 * supposed to be immune to. MEASURED before this was shared: positions
 * `[128, 128, 128]` against bookmarks `[136, 92]`.
 *
 * ⛔ THE MOCKUP HAS NO TEXT CLAMP, and that was measured before anything was built:
 * its `#rows` box is 385px, every `.prow` is `flex: 0 0 33.3333%`, all three rows are
 * **128px**, and every `.ptitle` computes `-webkit-line-clamp: none` while rendering
 * 3, 2 and **4** lines. The row height does all the work. ⇒ The clamp each table
 * applies to its argument title is the CAP half of that (a `<tr>` height is a FLOOR
 * and cannot bound content); this is the EQUALISING half.
 *
 * ⚠ WHY JS AND NOT `height: 33.3333%`. Tried first and measured to fail: with the
 * table at `height:100%` and each `<tr>` at `33.3333%` the rows came out
 * `[95, 107, 95]` — a percentage row height resolves against a table box that is
 * itself content-driven, and a `<tr>` height is a minimum either way. A definite px
 * value is what binds.
 *
 * ⛔ IT GATES ON THE REGION BEING DEFINITE. At `lg`+ these routes are one-screen, so
 * the panel's height comes from the viewport and a third of it is a real number.
 * Below `lg` the page grows, the body's height is content-driven, and a third of it
 * would be a function of the rows being sized — so the inline heights are CLEARED
 * rather than chasing their own tail. The test is the PAGE (`doc.scrollHeight`), not
 * a breakpoint literal, which is the same test the positions panel's own window cap
 * uses and needs no `1024` written down.
 */
export function useEqualRowThirds({
	bodyRef,
	tableRef,
	testidPrefix,
	rowWindow,
	rowCount,
}: {
	/** The scroll container whose height the third is taken from. */
	bodyRef: RefObject<HTMLDivElement | null>;
	/** The table holding the rows. */
	tableRef: RefObject<HTMLTableElement | null>;
	/** `data-testid` prefix identifying a data row (never a sell-host row). */
	testidPrefix: string;
	/** How many rows fill the region — the founder's three. */
	rowWindow: number;
	/**
	 * How many rows are currently visible. It is a real DEPENDENCY (a filter change
	 * must re-measure) and it is USED below rather than listed for its own sake — an
	 * unlisted-but-needed dep goes stale, and a listed-but-unused one is a smell the
	 * linter is right to reject.
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
			// Nothing to equalise, and nothing to clean up: a table with no rows has no
			// inline heights left behind — the rows themselves are gone.
			return;
		}
		const measure = () => {
			const rows = table.querySelectorAll<HTMLTableRowElement>(
				`tbody > tr[data-testid^="${testidPrefix}"]`,
			);
			if (rows.length === 0) {
				return;
			}
			const doc = document.documentElement;
			if (doc.scrollHeight > doc.clientHeight + 1) {
				// Growable page ⇒ no definite region to take a third of.
				for (const row of rows) {
					if (row.style.height !== "") {
						row.style.height = "";
					}
				}
				return;
			}
			const cs = getComputedStyle(body);
			const padY =
				(Number.parseFloat(cs.paddingTop) || 0) +
				(Number.parseFloat(cs.paddingBottom) || 0);
			const head = table.querySelector("thead");
			const headH = head ? head.getBoundingClientRect().height : 0;
			// `Math.floor`, never round: a third that rounds UP puts three rows past
			// the region and re-introduces the scroll this is meant to sit inside.
			const third = Math.floor((body.clientHeight - padY - headH) / rowWindow);
			if (third <= 0) {
				// jsdom (no layout) and a not-yet-measured panel both land here.
				return;
			}
			const next = `${third}px`;
			for (const row of rows) {
				// Write only on a real change — the observer below watches the table,
				// and resizing rows resizes the table.
				if (row.style.height !== next) {
					row.style.height = next;
				}
			}
		};
		measure();
		if (typeof ResizeObserver === "undefined") {
			return;
		}
		const observer = new ResizeObserver(measure);
		observer.observe(table);
		return () => observer.disconnect();
	}, [bodyRef, tableRef, testidPrefix, rowWindow, rowCount]);
}
