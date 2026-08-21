// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// `UnbookmarkButton` (the bookmark row's action) is a client component calling
// `useRouter()` and the remove action — mocked at the same boundary the bookmarks
// selection suite mocks them. This suite tests KEY ROUTING, not the action, and
// an unmounted app router throws before any assertion runs.
vi.mock("@/server/bookmarks/remove", () => ({
	removeBookmarkAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh: vi.fn() }),
}));

import { BookmarksTable } from "@/components/bookmarks/BookmarksTable";
import { PositionsTable } from "@/components/profile/PositionsTable";
import type { BookmarkItem } from "@/server/bookmarks/list";
import type { ProfilePositionRow } from "@/server/profile/positions";

/**
 * PROFILE OVERLAP · R4 — ↑/↓ STEP FROM LOAD, WITH NO CLICK.
 *
 * ⚠⚠ TWO DEFECTS WORE ONE COAT, and this file is here because only one of them
 * was ever visible to a test. MEASURED on staging from a fresh load, canary
 * `764f629`: the first row IS selected at mount, and two ArrowDowns moved
 * nothing — once with focus on `<body>` (the keys never arrived: the handler is
 * bound to the `<table>`) and once with focus placed on row one (the keys
 * arrived and the stepper re-selected the row it was already on, because its
 * anchor read the STORED pick, `null` at mount, rather than the DERIVED one).
 *
 * ⇒ Both halves are testable in jsdom even though the layout is not: key
 * routing is events and focus, and both are real here. What jsdom cannot see is
 * the page-scroll condition, since it reports every dimension as zero — so that
 * one case defines the getter it depends on rather than pretending to observe it.
 *
 * ⚠ THE TWO SURFACES SHARE ONE FILE, deliberately: they share the hook, and the
 * whole point of sharing it is that neither can drift. Same reason the row-third
 * and the sticky-header strip are guarded once for both.
 *
 * Fixtures are inline plain objects on the shipped DTOs (type-only imports — no
 * server code executes, no DB). No market content is invented (CLAUDE.md §3).
 */

afterEach(cleanup);

/** An ArrowUp/ArrowDown arriving at `document` with nothing focused — a fresh
 *  page, and the exact gesture R4's acceptance names. */
function pressOnDocument(key: "ArrowUp" | "ArrowDown"): void {
	fireEvent.keyDown(document, { key });
}

// ── positions fixtures ────────────────────────────────────────────────────────
const M = (n: number) => `0190c0de-0000-7000-8000-00000000000${n}`;

function openRow(n: number): ProfilePositionRow {
	return {
		lots: [],
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
const posRow = (n: number) => screen.getByTestId(`position-row-${M(n)}`);
/** The picked rows, among those actually RENDERED — a filter hides the rest, and
 *  a helper that insisted on all three would throw before it could report. */
const posPicked = () =>
	[1, 2, 3].filter(
		(n) =>
			screen
				.queryByTestId(`position-row-${M(n)}`)
				?.getAttribute("aria-current") === "true",
	);

// ── bookmarks fixtures ────────────────────────────────────────────────────────
const ID = (n: number) => `0190c0de-2222-7000-8000-00000000000${n}`;

function item(n: number): BookmarkItem {
	return {
		removed: false,
		kind: "post",
		id: ID(n),
		side: "YES",
		marketSlug: "fixture-alpha",
		marketTitle: "Market fixture-alpha",
		ordinal: n,
		title: `Saved argument ${n}`,
		teaser: "Neutral fixture teaser.",
		body: `Saved argument ${n}\n\nNeutral fixture body.`,
		marker: "none",
		authorStake: "12.000000000000000000",
		// RANK-1 — the substrate stake is SURVIVING basis; nothing is sold in this fixture.
		authorStakeOriginal: "12.000000000000000000",
		authorSold: false,
		priceAtBet: "0.310000000000000000",
		createdAt: "2026-07-01T00:00:00.000Z",
		aggregate: {
			supportCount: 2,
			counterCount: 1,
			supportDharma: "300.000000000000000000",
			counterDharma: "100.000000000000000000",
		},
		authorPseudonym: "RedWolf001",
		staked: "25.000000000000000000",
		current: "31.000000000000000000",
	};
}

const ITEMS = [item(1), item(2), item(3)];
const bmRow = (n: number) => screen.getByTestId(`bookmark-row-${ID(n)}`);
const bmPicked = () =>
	[1, 2, 3].filter(
		(n) =>
			screen
				.queryByTestId(`bookmark-row-${ID(n)}`)
				?.getAttribute("aria-current") === "true",
	);

describe("R4 — the mount selection is the keyboard's anchor (positions)", () => {
	it("anchor::DOWN-from-a-fresh-load-moves-off-row-one", () => {
		// ⛔ THE ROW'S OWN ACCEPTANCE: load, press ↓, NO CLICK. Before this landed
		// the answer was "nothing", twice over.
		render(<PositionsTable payload={PAYLOAD} />);
		expect(posPicked()).toEqual([1]);
		pressOnDocument("ArrowDown");
		expect(posPicked()).toEqual([2]);
	});

	it("anchor::UP-from-a-fresh-load-wraps-to-the-last-row", () => {
		// The wrap is the mockup's `(at + dir + len) % len`, and it is only
		// reachable at all once the anchor is a real index instead of `-1`. With the
		// old anchor this pressed to row ONE — the row it started on.
		render(<PositionsTable payload={PAYLOAD} />);
		pressOnDocument("ArrowUp");
		expect(posPicked()).toEqual([3]);
	});

	it("anchor::a-caret-KEEPS-the-key", () => {
		// ⚠ R4's own warning, and the concrete case is on this surface: the sell
		// module's stake field is an `<input>` INSIDE the table, so position saves
		// nothing. Up/Down there move a caret and belong to the caret.
		render(<PositionsTable payload={PAYLOAD} />);
		const field = document.createElement("input");
		document.body.appendChild(field);
		field.focus();
		fireEvent.keyDown(field, { key: "ArrowDown" });
		expect(posPicked()).toEqual([1]);
		field.remove();
	});

	it("anchor::focus-INSIDE-the-table-steps-exactly-once", () => {
		// ⛔⛔ THE DOUBLE-STEP GUARD, and it is not hypothetical: the table's own
		// `onKeyDown` and the document arm would both see one bubbling press, so
		// without the containment test a single ↓ would land two rows away. This is
		// the assertion that fails if that test is ever removed as redundant.
		render(<PositionsTable payload={PAYLOAD} />);
		posRow(1).focus();
		fireEvent.keyDown(posRow(1), { key: "ArrowDown" });
		expect(posPicked()).toEqual([2]);
	});

	it("anchor::a-focused-control-elsewhere-KEEPS-the-key", () => {
		// The arm is for exactly one state — nobody has taken focus yet. A reader
		// who has tabbed to a control is steering something, and a list that grabs
		// their arrows has taken over the page.
		render(<PositionsTable payload={PAYLOAD} />);
		const trigger = screen.getByTestId("positions-status-filter");
		const button = trigger.querySelector("button");
		expect(button).not.toBeNull();
		button?.focus();
		fireEvent.keyDown(button as HTMLElement, { key: "ArrowDown" });
		expect(posPicked()).toEqual([1]);
	});

	it("anchor::an-OPEN-market-popover-yields-the-key", () => {
		// Canon §5: "`+` popover: ESC / click-out closes; Up/Down yield while open."
		// The popover's options are a list of their own, and two lists cannot both
		// own the arrows.
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(screen.getByTestId("positions-market-filter"));
		expect(screen.getByTestId("positions-market-popover")).toBeTruthy();
		pressOnDocument("ArrowDown");
		expect(posPicked()).toEqual([1]);
	});

	it("anchor::a-list-scrolled-OFF-SCREEN-keeps-the-key", () => {
		// ⛔⛔ THE OLD RULING, NARROWED — and this guard replaces one that pinned the
		// WRONG narrowing. The first attempt stood down whenever the page could
		// scroll at all, which is a clean answer to "a document ArrowDown would kill
		// keyboard scrolling of the route" and made the feature a function of window
		// height: measured at a pinned 1440×777 the profile page is 886 tall, the arm
		// stood down, and ↑/↓ did nothing from a fresh load. A condition that
		// disables the row in its own acceptance case is not a safeguard.
		// ⇒ The question is whether the list is IN FRONT OF THE READER. On screen,
		// the arrows are the list's; scrolled away, they go back to the page.
		// ⚠ THE RECT IS DEFINED, NOT OBSERVED, and that is the point of the test as
		// much as the behaviour: jsdom performs no layout, so an off-screen table
		// cannot arise here. What is pinned is that the rect is read AT KEYPRESS and
		// that an UNMEASURED rect does not disqualify — a naive `bottom <= 0` reads
		// jsdom's zeros as "off screen" and silently disables the arm in every other
		// test in this file.
		render(<PositionsTable payload={PAYLOAD} />);
		const table = screen.getByTestId("positions-table");
		// ⚠ THE RECT IS BUILT BY HAND, NOT SPREAD FROM A `DOMRect`. Its members are
		// prototype getters, so `{...new DOMRect(…)}` is an EMPTY object — the first
		// attempt at this test read `height: undefined`, concluded "unmeasured", and
		// passed the press straight through. A stub that silently stubs nothing is
		// worse than no stub.
		const off = vi.spyOn(table, "getBoundingClientRect").mockReturnValue({
			x: 0,
			y: -800,
			width: 700,
			height: 400,
			top: -800,
			bottom: -400,
			left: 0,
			right: 700,
			toJSON: () => ({}),
		} as DOMRect);
		const viewport = vi
			.spyOn(window, "innerHeight", "get")
			.mockReturnValue(777);
		try {
			pressOnDocument("ArrowDown");
			expect(posPicked()).toEqual([1]);
		} finally {
			off.mockRestore();
			viewport.mockRestore();
		}
		// …and with the list back on screen the same press steps, which is what makes
		// the check above about the predicate rather than about a dead arm.
		pressOnDocument("ArrowDown");
		expect(posPicked()).toEqual([2]);
	});

	it("anchor::re-aims-after-a-FILTER-change", () => {
		// R3 re-selects row one whenever the visible set moves; R4 has to follow it
		// there, or the arrows step from a row that is no longer on screen. Two
		// Closed rows so there is somewhere to step TO after the switch.
		const closed = (n: number): ProfilePositionRow => ({
			...openRow(n),
			marketStatus: "Resolved",
			statusLabel: "Closed",
			settled: true,
		});
		render(
			<PositionsTable
				payload={{ owner: false, rows: [openRow(1), closed(2), closed(3)] }}
			/>,
		);
		expect(posPicked()).toEqual([1]);
		fireEvent.click(screen.getByTestId("positions-status-closed"));
		expect(posPicked()).toEqual([2]);
		pressOnDocument("ArrowDown");
		expect(posPicked()).toEqual([3]);
	});
});

describe("R4 — the same anchor on the bookmarks mode", () => {
	it("anchor::DOWN-from-a-fresh-load-moves-off-row-one", () => {
		// ⛔ R4 says BOTH MODES. Since the bookmark toggle is a route rather than
		// client state, this component IS the other mode.
		render(<BookmarksTable items={ITEMS} />);
		expect(bmPicked()).toEqual([1]);
		pressOnDocument("ArrowDown");
		expect(bmPicked()).toEqual([2]);
	});

	it("anchor::UP-from-a-fresh-load-wraps-to-the-last-row", () => {
		render(<BookmarksTable items={ITEMS} />);
		pressOnDocument("ArrowUp");
		expect(bmPicked()).toEqual([3]);
	});

	it("anchor::focus-INSIDE-the-table-steps-exactly-once", () => {
		render(<BookmarksTable items={ITEMS} />);
		bmRow(1).focus();
		fireEvent.keyDown(bmRow(1), { key: "ArrowDown" });
		expect(bmPicked()).toEqual([2]);
	});

	it("anchor::a-caret-KEEPS-the-key", () => {
		render(<BookmarksTable items={ITEMS} />);
		const field = document.createElement("textarea");
		document.body.appendChild(field);
		field.focus();
		fireEvent.keyDown(field, { key: "ArrowDown" });
		expect(bmPicked()).toEqual([1]);
		field.remove();
	});
});
