// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PositionsTable } from "@/components/profile/PositionsTable";
import type { ProfilePositionRow } from "@/server/profile/positions";

/**
 * ROUND 4 item 8 — THE THREE-ROW WINDOW.
 *
 * ⚠⚠ WHAT THIS FILE CAN AND CANNOT SEE. jsdom performs no layout: every
 * `getBoundingClientRect()` is zero, so the measured cap NEVER RUNS here and no
 * assertion in this file can prove the window is the right height. That is not
 * a gap to be papered over — it is the reason the measurement GATES ON THE NODES
 * HAVING A BOX, and the gate itself is exactly what this file proves. Without
 * it, a zero-rect environment would compute a `max-height:0px` and hide every
 * row from every render test in the suite, silently.
 *
 * The resolved geometry is proven in a browser against compiled CSS, which is
 * not a thing CI does — the same split `profile-height-chain.test.ts` records.
 * Here: the mechanism's SHAPE (a bound, never a clip) and its safety gate.
 */

afterEach(cleanup);

const M = (n: number) => `0190c0de-0000-7000-8000-00000000000${n}`;

function openRow(n: number): ProfilePositionRow {
	return {
		marketId: M(n),
		marketSlug: `fixture-${n}`,
		marketTitle: `Market fixture-${n}`,
		marketStatus: "Open",
		statusLabel: "Open",
		settled: false,
		side: "YES",
		quantity: "10.000000000000000000",
		staked: "25.000000000000000000",
		current: "31.000000000000000000",
		argument: {
			removed: false,
			commentId: `0190c0de-1111-7000-8000-00000000000${n}`,
			title: `Opener argument ${n}`,
			isReply: false,
			postOrdinal: n,
			marketSlug: `fixture-${n}`,
			repliedToTitle: null,
		},
	};
}

const SOURCE = readFileSync(
	join(process.cwd(), "src/components/profile/PositionsTable.tsx"),
	"utf8",
);

describe("item 8 — the window is a BOUND, never a clip", () => {
	it("window::the-scroll-container-keeps-its-overflow-y-auto", () => {
		// ⛔ THE WHOLE DISTINCTION. A `max-height` with a scroll container means
		// row four is REACHED BY SCROLLING; the same cap with `overflow-hidden`
		// would LOSE it, which is what RULED A1 forbids.
		render(<PositionsTable payload={{ owner: false, rows: [openRow(1)] }} />);
		const body = screen.getByTestId("positions-panel-body");
		const classes = body.className.split(/\s+/);
		expect(classes).toContain("overflow-y-auto");
		expect(classes).not.toContain("overflow-hidden");
		expect(classes).not.toContain("overflow-clip");
	});

	it("window::the-cap-is-written-to-maxHeight-and-never-to-height", () => {
		// A `style.height` would fix the panel and clip a fourth row instead of
		// letting it scroll. Read from the shipped source, because the write only
		// happens under real layout.
		expect(SOURCE).toContain("style.maxHeight");
		expect(SOURCE).not.toContain("style.height");
	});

	it("window::the-window-is-THREE-and-is-named-once", () => {
		expect(/const ROW_WINDOW = 3;/.test(SOURCE)).toBe(true);
	});

	it("window::the-column-header-row-stays-OUT-of-the-scroll", () => {
		// Row 3's `sticky top-0` on `<thead>`, which is what holds the header out
		// of the scroll the window creates. Without it, capping the body would
		// scroll the column headers away with the rows.
		render(<PositionsTable payload={{ owner: false, rows: [openRow(1)] }} />);
		const thead = screen.getByTestId("positions-table").querySelector("thead");
		const classes = (thead?.className ?? "").split(/\s+/);
		expect(classes).toContain("sticky");
		expect(classes).toContain("top-0");
	});
});

describe("item 8 — the measurement gates on the node having a box", () => {
	it("window::NO-CAP-IS-APPLIED-where-there-is-no-layout", () => {
		// ⚠⚠ THE ASSERTION THIS FILE EXISTS FOR. jsdom returns zero rects; an
		// ungated measurement would compute `max-height: 0px` and hide every row
		// in every render test. Four rows — more than the window — and still no
		// cap, because the gate fires first.
		render(
			<PositionsTable
				payload={{
					owner: false,
					rows: [openRow(1), openRow(2), openRow(3), openRow(4)],
				}}
			/>,
		);
		const body = screen.getByTestId("positions-panel-body");
		expect(body.style.maxHeight).toBe("");
		// …and the rows are all still reachable, which is the observable half.
		for (const n of [1, 2, 3, 4]) {
			expect(screen.getByTestId(`position-row-${M(n)}`)).toBeTruthy();
		}
	});

	it("window::the-zero-box-gate-is-present-in-the-shipped-source", () => {
		// The gate is a behaviour no jsdom assertion can distinguish from "the
		// effect never ran", so it is also pinned textually.
		expect(/height === 0/.test(SOURCE)).toBe(true);
	});

	it("window::FEWER-rows-than-the-window-clear-the-cap-rather-than-keep-it", () => {
		// A stale cap from a wider filter would leave the panel short after the
		// rows shrank under it.
		expect(/visible\.length < ROW_WINDOW/.test(SOURCE)).toBe(true);
		render(<PositionsTable payload={{ owner: false, rows: [openRow(1)] }} />);
		expect(screen.getByTestId("positions-panel-body").style.maxHeight).toBe("");
	});

	it("window::the-observer-is-guarded-for-environments-without-one", () => {
		// jsdom implements no ResizeObserver; constructing one unguarded throws
		// and takes the whole render suite with it.
		expect(SOURCE).toContain('typeof ResizeObserver === "undefined"');
	});
});
