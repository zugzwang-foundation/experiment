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
	it("selection::THE-FIRST-ROW-IS-PICKED-AT-MOUNT", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		// ⚠⚠ PROFILE REFINEMENT · R3 — INVERTED, AND THIS IS THE ROW'S WHOLE POINT.
		// This asserted `isPicked(1) === false` and recorded the reason: "the founder
		// ruled the full argument list the empty state, so this build starts empty."
		// The founder has now ruled the mockup's way — a rail of stubs on load was
		// the defect — so the mockup's own note governs again (`refresh()`, `:571`:
		// "the list auto-selects the first visible row").
		expect(isPicked(1)).toBe(true);
		expect(isPicked(2)).toBe(false);
		// …and picking another still moves it, so the default is a DEFAULT and not a
		// pin.
		fireEvent.click(rowEl(2));
		expect(isPicked(2)).toBe(true);
		expect(isPicked(1)).toBe(false);
	});

	it("selection::clicking-the-picked-row-again-KEEPS-it", () => {
		// ⚠⚠ PROFILE REFINEMENT · R3 — INVERTED. The toggle existed because deselect
		// was the way back to the full argument list; R3 removes that destination, so
		// clearing would immediately re-derive to the first visible row — a silent
		// no-op on row one and a jump-to-row-one everywhere else. The mockup has no
		// deselect either (`:679` sets `sel = i` unconditionally).
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(rowEl(2));
		expect(isPicked(2)).toBe(true);
		fireEvent.click(rowEl(2));
		expect(isPicked(2)).toBe(true);
		// …and exactly ONE row is picked, so "keeps it" is not "picks them all".
		expect([1, 2, 3].filter((n) => isPicked(n))).toEqual([2]);
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
		// ⚠ PROFILE REFINEMENT · R3 — READ ON ROW 2, NOT ROW 1. Row one is picked at
		// mount now, so "clicking its link did not pick it" is unfalsifiable there.
		// Clicking a link inside an UNPICKED row must leave the selection where it
		// was, which is the same claim with a subject that can still fail.
		render(<PositionsTable payload={PAYLOAD} />);
		expect(isPicked(1)).toBe(true);
		const link = rowEl(2).querySelector("a");
		if (link === null) {
			throw new Error("selection: the row renders no link to click");
		}
		fireEvent.click(link);
		expect(isPicked(2)).toBe(false);
		expect(isPicked(1)).toBe(true);
	});
});

describe("item 5 — Up/Down step the selection, wrapping", () => {
	const table = () => screen.getByTestId("positions-table");

	it("selection::ArrowDown-steps-OFF-row-one-on-the-FIRST-press", () => {
		// ⛔⛔ RE-POINTED at PROFILE OVERLAP R4, AND THIS GUARD WAS ASSERTING THE
		// DEFECT. It read `ArrowDown-from-nothing-enters-at-the-first-row` and
		// expected row ONE to be picked after one press — faithful to the mockup's
		// `at < 0 ? 0` (`:745`), but "nothing" stopped being a state the moment R3
		// selected row one at mount. The stepper's anchor still read the STORED
		// pick, `null` until a click, so it fell to `at < 0` and re-selected the row
		// it was already on: THE FIRST PRESS MOVED NOTHING, and this test called
		// that correct. Measured on staging, focus inside the table, two ArrowDowns,
		// no movement.
		// ⇒ The anchor is now the DERIVED row, so one press means one step. The
		// mockup's arithmetic is unchanged — `at < 0 ? 0` still governs the case it
		// was written for, an empty derivation, which is now the only way to have
		// no anchor.
		render(<PositionsTable payload={PAYLOAD} />);
		expect(isPicked(1)).toBe(true);
		fireEvent.keyDown(table(), { key: "ArrowDown" });
		expect(isPicked(2)).toBe(true);
		expect(isPicked(1)).toBe(false);
	});

	it("selection::ArrowUp-on-the-FIRST-press-wraps-to-the-last-row", () => {
		// The other half of the same reversal: from row one, back is the LAST row.
		// This read `ALSO-enters-at-the-first-row`, i.e. it too expected a press
		// that changed nothing.
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.keyDown(table(), { key: "ArrowUp" });
		expect(isPicked(3)).toBe(true);
		expect(isPicked(1)).toBe(false);
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
		// ⚠ PROFILE REFINEMENT · R3 — THE CLAIM IS NOW "THE SELECTION DID NOT MOVE",
		// not "nothing is selected": row one is picked at mount, so an all-false
		// assertion would fail for a reason that has nothing to do with key handling.
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(rowEl(2));
		fireEvent.keyDown(table(), { key: "Tab" });
		fireEvent.keyDown(table(), { key: "a" });
		expect([1, 2, 3].filter((n) => isPicked(n))).toEqual([2]);
	});

	it("selection::the-step-moves-FOCUS-with-the-selection", () => {
		// Focus follows the pick so the NEXT arrow keeps arriving at the table's own
		// handler. ⚠ PROFILE OVERLAP R4 — that used to be the only route in, which
		// is why a fresh page could not be stepped at all; `row-stepper.ts` now
		// carries the first press. This still matters after it: once focus is inside,
		// the document arm stands down and this handler owns every press.
		// ⚠ THE ROW NUMBERS MOVED WITH THE ANCHOR, not the claim — press one now
		// lands on row TWO, because row one is where it started.
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.keyDown(table(), { key: "ArrowDown" });
		expect(document.activeElement).toBe(rowEl(2));
		fireEvent.keyDown(table(), { key: "ArrowDown" });
		expect(document.activeElement).toBe(rowEl(3));
	});

	it("selection::the-roving-tab-stop-follows-the-selection", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		// ⚠ PROFILE REFINEMENT · R3 — the FIRST row is the single tab stop at mount.
		// It used to be so because nothing was selected and the fallback in the
		// `tabIndex` expression caught it; now it is so because row one IS selected.
		// Same observable, different cause — worth the line, because a reader who
		// deletes the `selectedRow === null` half of that expression as dead code
		// would break the empty-list case.
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
		// argument with nothing selected to explain it.
		// ⚠⚠ PROFILE REFINEMENT · R3 — AND THE ANSWER THE MOCKUP GIVES IS NOW OURS.
		// This used to end "the mockup answers the same problem by re-picking the
		// first remaining row (`refresh()`, `:571`); with no auto-select that answer
		// is unavailable here." R3 makes it available: the fallback re-aims at the
		// first VISIBLE row, so a filter change can never leave the rail empty — the
		// half of R3 that says "an empty rail after a filter is the same defect one
		// interaction later".
		// ⚠ THE PICK IS STILL REMEMBERED, NOT DESTROYED, and that half is unchanged:
		// switching the filter back restores it, so a filter is a lens over the
		// selection rather than an eraser of it. Asserted both ways.
		render(
			<PositionsTable payload={{ owner: false, rows: [...ROWS, CLOSED] }} />,
		);
		fireEvent.click(rowEl(1));
		expect(isPicked(1)).toBe(true);
		fireEvent.click(screen.getByTestId("positions-status-closed"));
		expect(screen.queryByTestId(`position-row-${M(1)}`)).toBeNull();
		// The Closed set's FIRST row is picked — the rail is never left empty.
		expect(isPicked(4)).toBe(true);
		// …and coming back restores the remembered pick rather than keeping row 4.
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
	it("item6::the-unselected-row-carries-the-shipped-hairline-AS-AN-OUTLINE", () => {
		// ⚠ RE-POINTED at PROFILE OVERLAP R1. The rung is unchanged — `--hairline`,
		// 1px n2, this file's own panel edge — but it is drawn as an OUTLINE now,
		// because a border cannot be rounded under the collapsing model and the
		// square row was the defect. ⛔ The old assertion is kept as its own
		// negative: a border here would paint square corners behind the outline.
		// ⚠ READ OFF ROW **2**, and that is not cosmetic: the hairline now lives on
		// the UNSELECTED arm, and row one is SELECTED AT MOUNT (R3), so reading row
		// one would look for the unselected edge on the selected row and fail for a
		// reason that has nothing to do with the rung. The old assertion could read
		// row one because the border sat on the BASE, present in both states — which
		// is exactly the thing that changed.
		render(<PositionsTable payload={PAYLOAD} />);
		expect(classesOf(2)).toContain("[outline:var(--hairline)]");
		expect(classesOf(2)).toContain("[outline-offset:-1px]");
		expect(classesOf(2)).toContain("rounded-(--r)");
		expect(classesOf(2)).not.toContain("[border:var(--hairline)]");
		// ⛔ The radius is on the BASE, so the SELECTED row carries it too — that is
		// the whole of R1 and it is asserted here rather than left to inference.
		expect(classesOf(1)).toContain("rounded-(--r)");
		// ⛔ `outline-none` retired WITH the border: it only ever suppressed the UA
		// focus ring, which any author outline beats by cascade origin. Leaving it
		// beside a real outline would be two declarations for one property.
		expect(classesOf(2)).not.toContain("outline-none");
	});

	it("item6::THE-SELECTED-ROW-RENDERS-DIFFERENTLY-not-just-flagged", () => {
		// ⚠⚠ THE CENTRAL ASSERTION. Round 3 shipped a toggle whose two halves
		// were byte-identical on screen because it switched between two `Button`
		// variants the design system renders the same. A flag-only check cannot
		// see that. This compares the row's OWN class string before and after.
		// ⚠ PROFILE REFINEMENT · R3 — MEASURED ON ROW 2, because row one is now
		// SELECTED AT MOUNT and comparing its class string before and after clicking
		// it would compare selected with selected. Row two starts unselected, so the
		// before/after here is a real state change — which is the only way this test
		// can still catch the defect it was written for.
		render(<PositionsTable payload={PAYLOAD} />);
		const before = rowEl(2).className;
		fireEvent.click(rowEl(2));
		const after = rowEl(2).className;
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
		expect(cls).toContain("bg-n1"); // the fill still arrives
		// ⚠⚠ RE-POINTED AGAIN AT PROFILE OVERLAP R1, AND TWO OF THESE LINES MOVED
		// FOR THE SAME REASON THE CODE DID.
		// ⛔ `rounded-(--r)` IS NOW A BASE CLASS, NOT A SELECTED ONE. R6 put the
		// radius on the selected arm alone, which left every UNSELECTED row a square
		// hairline box inside a panel at 8 — the sharp rectangle R1 was opened on.
		// The radius now serves both arms, so the old line
		// `expect(before…).not.toContain("rounded-(--r)")` asserted exactly the
		// defect and is INVERTED here rather than deleted.
		expect(before.split(/\s+/)).toContain("rounded-(--r)");
		expect(cls).toContain("rounded-(--r)");
		// ⛔ AND THE HAIRLINE IS NO LONGER A BORDER AT ALL. It could not be: the
		// collapsing model ignores `border-radius`, measured live — a row with
		// `border-radius: 8px` injected still painted square corners. So the
		// unselected arm's edge is the hairline as an OUTLINE, which the element
		// paints itself and which honours the radius. Both arms outline now; neither
		// borders. The line that asserted the border SURVIVED selection described a
		// mechanism that no longer exists.
		expect(cls).not.toContain("[border:var(--hairline)]");
		expect(before.split(/\s+/)).toContain("[outline:var(--hairline)]");
		expect(before.split(/\s+/)).toContain("[outline-offset:-1px]");
	});

	it("item6::EXACTLY-ONE-outline-utility-is-present-in-either-state", () => {
		// Two arbitrary utilities for ONE property resolve by stylesheet order, not
		// by the order they are written — so the two are a conditional, never both.
		// A regression here is invisible in jsdom and picks the wrong edge in a
		// browser. ⚠ RE-POINTED at PROFILE OVERLAP R1 from `[border:` to `[outline:`
		// because the property under contention MOVED: the row's edge is an outline
		// on both arms now. ⛔ The predicate is the same one and it is if anything
		// tighter — an element has exactly one outline, so two declarations here are
		// not merely ambiguous, one of them is dead.
		render(<PositionsTable payload={PAYLOAD} />);
		const borderCount = (n: number) =>
			classesOf(n).filter((c) => c.startsWith("[outline:")).length;
		expect(borderCount(1)).toBe(1);
		fireEvent.click(rowEl(1));
		expect(borderCount(1)).toBe(1);
	});

	it("item6::a-sellable-row-carries-NO-empty-sell-band", () => {
		// ⚠ RE-POINTED at PROFILE OVERLAP R1, and the claim changed shape with the
		// law. Item 6 asked "does the reserved band draw an empty card under every
		// sellable row?" — and the answer is now that THERE IS NO BAND to draw one:
		// the 50px reservation is reversed, so the host arrives with its module.
		// ⇒ The unbordered-host predicate MOVED to `sell.test.tsx`
		// (`sell-host-is-canon-s-50px-box-and-is-ABSENT-until-opened`), which is
		// the suite that stubs the heavy `SellModule`; opening the real one here
		// would need this file to mock a router it has no other reason to know
		// about. What stays here is the part this suite owns: on a row that IS
		// sellable, nothing is reserved.
		render(
			<PositionsTable
				payload={{
					owner: true,
					rows: [{ ...openRow(1), sellEligible: true }],
				}}
			/>,
		);
		// ⛔ THE POSITIVE CONTROL IS LOAD-BEARING: without it, "no sell row" would
		// pass on a row that renders no sell affordance at all.
		expect(screen.getByTestId(`sell-trigger-${M(1)}`)).toBeTruthy();
		expect(screen.queryByTestId(`sell-row-${M(1)}`)).toBeNull();
		expect(screen.queryByTestId(`sell-host-${M(1)}`)).toBeNull();
	});

	it("item6::the-row-is-keyboard-operable-and-shows-a-focus-ring", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		expect(classesOf(1)).toContain("focus-visible:shadow-(--state-focus-ring)");
		fireEvent.keyDown(rowEl(1), { key: "Enter" });
		expect(isPicked(1)).toBe(true);
	});
});
