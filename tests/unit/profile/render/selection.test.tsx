// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PositionsTable } from "@/components/profile/PositionsTable";
import type { ProfilePositionRow } from "@/server/profile/positions";

/**
 * ROUND 4 items 5 + 6 — ROW SELECTION AND THE BORDERED ROW CARD.
 *
 * ⚠ THE ASSERTIONS ARE THAT THE TWO STATES RENDER DIFFERENTLY, not that a flag
 * flipped. That is the round-3 lesson, minted on this very surface: item 2's
 * toggle carried a real `aria-pressed` and a real state change with ZERO pixels
 * of difference, because the two `Button` variants it switched between render
 * identically. A test that read the flag passed on a toggle nobody could see.
 * So every check below reads the row's CLASS STRING, and the central one asserts
 * that the selected and unselected class strings are NOT EQUAL.
 *
 * ⚠ NO VALUE IS ASSERTED — the class names pin which shipped TOKEN is consumed
 * (`--hairline` rung 1 vs `--ring-active` rung 3), never a colour, width or
 * radius. The mockups are light-mode prototypes (DESIGN.B1).
 *
 * ⚠ jsdom performs no layout, so nothing here can see the collapsing border
 * model resolve. What it CAN see — and what breaks silently without it — is
 * which classes each state carries, that the two differ, that the arrow
 * arithmetic wraps, and that a filtered-away selection clears.
 *
 * Fixtures are inline plain objects on the shipped DTO (type-only import — no
 * server code executes, no DB). No market content is invented (CLAUDE.md §3).
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

const ROWS = [openRow(1), openRow(2), openRow(3)];
const PAYLOAD = { owner: false as const, rows: ROWS };

/** A closed row, so the Open/Closed filter has something to hide a selection with. */
const CLOSED: ProfilePositionRow = {
	...openRow(4),
	marketStatus: "Resolved",
	statusLabel: "Closed",
	settled: true,
};

const rowEl = (n: number) => screen.getByTestId(`position-row-${M(n)}`);
const classesOf = (n: number) =>
	rowEl(n).className.split(/\s+/).filter(Boolean);
const isPicked = (n: number) =>
	rowEl(n).getAttribute("aria-current") === "true";

describe("item 5 — the row is selectable by pointer", () => {
	it("selection::click-picks-the-row", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		// ⛔ NOTHING IS SELECTED AT MOUNT. The mockup auto-selects the first
		// visible row (`refresh()`, `:571`); the founder ruled the full argument
		// list the empty state, so this build starts empty.
		expect(isPicked(1)).toBe(false);
		fireEvent.click(rowEl(1));
		expect(isPicked(1)).toBe(true);
		expect(isPicked(2)).toBe(false);
	});

	it("selection::clicking-the-picked-row-again-CLEARS-it", () => {
		// Deselect is the way back to the full argument list, so the click has to
		// toggle. The mockup has no deselect at all — it always holds one row.
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(rowEl(2));
		expect(isPicked(2)).toBe(true);
		fireEvent.click(rowEl(2));
		expect(isPicked(2)).toBe(false);
	});

	it("selection::picking-a-second-row-releases-the-first", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(rowEl(1));
		fireEvent.click(rowEl(3));
		expect(isPicked(1)).toBe(false);
		expect(isPicked(3)).toBe(true);
	});

	it("selection::a-click-on-a-LINK-inside-the-row-does-not-pick-it", () => {
		// The argument title and the market question are `<Link>`s that navigate,
		// and Sell opens its module. The mockup keeps them working with
		// `event.stopPropagation()` per child (`:548`); here one `closest("a,button")`
		// guard covers every child, so this is the assertion that it does.
		render(<PositionsTable payload={PAYLOAD} />);
		const link = rowEl(1).querySelector("a");
		if (link === null) {
			throw new Error("selection: the row renders no link to click");
		}
		fireEvent.click(link);
		expect(isPicked(1)).toBe(false);
	});
});

describe("item 5 — Up/Down step the selection, wrapping", () => {
	const table = () => screen.getByTestId("positions-table");

	it("selection::ArrowDown-from-nothing-enters-at-the-first-row", () => {
		// The mockup's `at < 0 ? 0` (`:745`) — from no selection BOTH directions
		// enter at index 0, which is why this is asserted for Up as well below.
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.keyDown(table(), { key: "ArrowDown" });
		expect(isPicked(1)).toBe(true);
	});

	it("selection::ArrowUp-from-nothing-ALSO-enters-at-the-first-row", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.keyDown(table(), { key: "ArrowUp" });
		expect(isPicked(1)).toBe(true);
	});

	it("selection::ArrowDown-steps-forward-and-WRAPS-past-the-last", () => {
		// `(at + dir + len) % len` (`:745`).
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(rowEl(3));
		fireEvent.keyDown(table(), { key: "ArrowDown" });
		expect(isPicked(1)).toBe(true);
		expect(isPicked(3)).toBe(false);
	});

	it("selection::ArrowUp-steps-back-and-WRAPS-past-the-first", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(rowEl(1));
		fireEvent.keyDown(table(), { key: "ArrowUp" });
		expect(isPicked(3)).toBe(true);
		expect(isPicked(1)).toBe(false);
	});

	it("selection::a-non-arrow-key-is-left-alone", () => {
		// The handler must not swallow keys it does not own — it sits on the
		// table, and Tab / typing inside the Sell module pass through it.
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.keyDown(table(), { key: "Tab" });
		fireEvent.keyDown(table(), { key: "a" });
		for (const n of [1, 2, 3]) {
			expect(isPicked(n)).toBe(false);
		}
	});

	it("selection::the-step-moves-FOCUS-with-the-selection", () => {
		// Without this the second arrow press never reaches the handler, because
		// the handler is scoped to the table rather than to `document`.
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.keyDown(table(), { key: "ArrowDown" });
		expect(document.activeElement).toBe(rowEl(1));
		fireEvent.keyDown(table(), { key: "ArrowDown" });
		expect(document.activeElement).toBe(rowEl(2));
	});

	it("selection::the-roving-tab-stop-follows-the-selection", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		// Nothing selected ⇒ the FIRST row is the single tab stop, so the keys
		// are reachable without a click.
		expect(rowEl(1).getAttribute("tabindex")).toBe("0");
		expect(rowEl(2).getAttribute("tabindex")).toBe("-1");
		fireEvent.click(rowEl(2));
		expect(rowEl(1).getAttribute("tabindex")).toBe("-1");
		expect(rowEl(2).getAttribute("tabindex")).toBe("0");
	});
});

describe("item 5 — the selection is derived against the VISIBLE set", () => {
	it("selection::a-filter-that-hides-the-picked-row-STOPS-it-counting", () => {
		// ⚠ THE DERIVATION IS AGAINST `visible`, SO A HIDDEN PICK IS NOT A PICK.
		// Storing the derived row as truth instead would leave the argument panel
		// filtered to a row that is no longer on screen — a panel showing one
		// argument with nothing selected to explain it. The mockup answers the
		// same problem by re-picking the first remaining row (`refresh()`, `:571`);
		// with no auto-select that answer is unavailable here.
		// ⚠ THE PICK IS REMEMBERED, NOT DESTROYED, and that is the deliberate
		// half: switching the filter back restores it, so a filter is a lens over
		// the selection rather than an eraser of it. Asserted BOTH ways so the
		// choice is a decision on the record and not an accident.
		render(
			<PositionsTable payload={{ owner: false, rows: [...ROWS, CLOSED] }} />,
		);
		fireEvent.click(rowEl(1));
		expect(isPicked(1)).toBe(true);
		fireEvent.click(screen.getByTestId("positions-status-closed"));
		expect(screen.queryByTestId(`position-row-${M(1)}`)).toBeNull();
		// Nothing in the Closed set is picked while the pick is hidden.
		expect(isPicked(4)).toBe(false);
		// …and coming back restores it.
		fireEvent.click(screen.getByTestId("positions-status-open"));
		expect(isPicked(1)).toBe(true);
	});

	it("selection::arrows-step-only-through-what-the-filter-left", () => {
		render(
			<PositionsTable payload={{ owner: false, rows: [...ROWS, CLOSED] }} />,
		);
		const table = screen.getByTestId("positions-table");
		fireEvent.click(rowEl(3));
		fireEvent.keyDown(table, { key: "ArrowDown" });
		// Wraps to row 1, NOT into the filtered-out closed row 4.
		expect(isPicked(1)).toBe(true);
		expect(screen.queryByTestId(`position-row-${M(4)}`)).toBeNull();
	});
});

describe("item 6 — the row is a bordered card, and the two states differ", () => {
	it("item6::the-unselected-row-carries-the-shipped-hairline", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		expect(classesOf(1)).toContain("[border:var(--hairline)]");
	});

	it("item6::THE-SELECTED-ROW-RENDERS-DIFFERENTLY-not-just-flagged", () => {
		// ⚠⚠ THE CENTRAL ASSERTION. Round 3 shipped a toggle whose two halves
		// were byte-identical on screen because it switched between two `Button`
		// variants the design system renders the same. A flag-only check cannot
		// see that. This compares the row's OWN class string before and after.
		render(<PositionsTable payload={PAYLOAD} />);
		const before = rowEl(1).className;
		fireEvent.click(rowEl(1));
		const after = rowEl(1).className;
		expect(
			after,
			"item 6: the selected row's className is unchanged — the selection is " +
				"invisible, which is exactly the item-2 defect one round earlier.",
		).not.toBe(before);
		// …and specifically, WHAT arrives. ⚠⚠ PROFILE REFINEMENT · R6 — THE
		// MECHANISM CHANGED AND THESE THREE LINES FOLLOW IT. They used to assert a
		// SWAP: "rung 3 replaces rung 1". The founder ruled the selected row must
		// carry the surface's ratified radius token, and a swapped BORDER cannot —
		// `border-collapse:collapse` ignores `border-radius`, which is why the row
		// was square. The mockup's `.prow.sel` never used a border: it ADDS an
		// `outline` (painted by the element, so it honours the radius) on top of the
		// hairline every row keeps.
		// ⛔ THE CENTRAL ASSERTION ABOVE IS UNTOUCHED — the className must still
		// differ between the two states, which is the property this test exists for
		// and the only thing that catches an invisible selection. What moved is the
		// description of HOW it differs, and it moved because the code did.
		const cls = after.split(/\s+/);
		expect(cls).toContain("[outline:var(--ring-active)]"); // rung 3, now an outline
		expect(cls).toContain("[outline-offset:-2px]"); // the mockup's own inset
		expect(cls).toContain("rounded-(--r)"); // R6 — the surface's radius token
		expect(cls).toContain("bg-n1"); // the fill still arrives
		// ⛔ THE HAIRLINE IS NOW EXPECTED TO SURVIVE, which is the inversion of the
		// old third line. The mockup ADDS to `.prow` rather than replacing it, so a
		// selected row that LOST its hairline would be the regression now.
		expect(cls).toContain("[border:var(--hairline)]");
		// …and the radius is absent while unselected, so it is the SELECTION that
		// brings it and not a base class doing nothing.
		expect(before.split(/\s+/)).not.toContain("rounded-(--r)");
	});

	it("item6::EXACTLY-ONE-border-utility-is-present-in-either-state", () => {
		// Two arbitrary `[border:…]` utilities on one element resolve by
		// stylesheet order, not by the order they are written — so the two are a
		// conditional, never both. A regression here is invisible in jsdom and
		// picks the wrong edge in a browser.
		render(<PositionsTable payload={PAYLOAD} />);
		const borderCount = (n: number) =>
			classesOf(n).filter((c) => c.startsWith("[border:")).length;
		expect(borderCount(1)).toBe(1);
		fireEvent.click(rowEl(1));
		expect(borderCount(1)).toBe(1);
	});

	it("item6::the-reserved-sell-host-row-takes-NO-border", () => {
		// Bordering an empty reserved band would draw an empty card under every
		// sellable row. Owner arm, so the host renders.
		render(
			<PositionsTable
				payload={{
					owner: true,
					rows: [{ ...openRow(1), sellEligible: true }],
				}}
			/>,
		);
		const host = screen.getByTestId(`sell-row-${M(1)}`);
		expect(host.className).not.toContain("[border:");
	});

	it("item6::the-row-is-keyboard-operable-and-shows-a-focus-ring", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		expect(classesOf(1)).toContain("focus-visible:shadow-(--state-focus-ring)");
		fireEvent.keyDown(rowEl(1), { key: "Enter" });
		expect(isPicked(1)).toBe(true);
	});
});
