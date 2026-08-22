// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// `UnbookmarkButton` (the row's action) is a client component that calls
// `useRouter()` and the remove action. Both are mocked at the same boundary
// `side-encoding.test.tsx` mocks them — this suite tests SELECTION, not the
// action, and an unmounted app router throws before any assertion runs.
vi.mock("@/server/bookmarks/remove", () => ({
	removeBookmarkAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh: vi.fn() }),
}));

import { BookmarksArena } from "@/components/bookmarks/BookmarksArena";
import { BookmarksTable } from "@/components/bookmarks/BookmarksTable";
import type { BookmarkItem } from "@/server/bookmarks/list";

/**
 * HTML-FINISH · BOOKMARKS round 3 · C5 — ROW SELECTION, re-derived from
 * Profile's rather than re-invented.
 *
 * ⚠ THE ASSERTIONS ARE THAT THE TWO STATES RENDER DIFFERENTLY, not that a flag
 * flipped — the lesson Profile minted when it shipped a toggle carrying a real
 * `aria-pressed` with ZERO pixels of difference, because the two Button variants
 * it switched between render identically in this design system. So the central
 * check compares the row's own CLASS STRING before and after.
 *
 * ⚠ NO VALUE IS ASSERTED — the class names pin which shipped TOKEN is consumed
 * (`--hairline` rung 1 vs `--ring-active` rung 3), never a colour or a width.
 *
 * Fixtures are inline plain objects on the shipped DTO (type-only import — no
 * server code executes, no DB). No market content is invented (CLAUDE.md §3).
 */

afterEach(cleanup);

const ID = (n: number) => `0190c0de-2222-7000-8000-00000000000${n}`;

function item(n: number, slug = "fixture-alpha"): BookmarkItem {
	return {
		removed: false,
		kind: "post",
		id: ID(n),
		side: "YES",
		marketSlug: slug,
		marketTitle: `Market ${slug}`,
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

const rowEl = (n: number) => screen.getByTestId(`bookmark-row-${ID(n)}`);
const classesOf = (n: number) =>
	rowEl(n).className.split(/\s+/).filter(Boolean);
const isPicked = (n: number) =>
	rowEl(n).getAttribute("aria-current") === "true";
const table = () => screen.getByTestId("bookmarks-table");

describe("C5 — the row is selectable by pointer", () => {
	it("selection::THE-FIRST-ROW-IS-PICKED-AT-MOUNT", () => {
		// ⚠⚠ PROFILE REFINEMENT · R3 — INVERTED, and inverted on BOTH surfaces in one
		// round. R3 asks for default-select "in BOTH modes (positions and
		// bookmarks)", and since R2 makes bookmarks mode a ROUTE rather than client
		// state, this component IS the other mode. A rail of stubs on load was the
		// defect; the mockup's `refresh()` (`:571`) auto-selects the first visible row.
		render(<BookmarksTable items={ITEMS} />);
		expect(isPicked(1)).toBe(true);
		expect([1, 2, 3].filter((n) => isPicked(n))).toEqual([1]);
	});

	it("selection::click-picks-and-clicking-again-KEEPS", () => {
		// ⚠⚠ PROFILE REFINEMENT · R3 — INVERTED. With a first-row fallback, clearing
		// re-derives to row one, so a second click would be a silent no-op there and
		// a jump-to-row-one elsewhere. The mockup has no deselect either.
		render(<BookmarksTable items={ITEMS} />);
		fireEvent.click(rowEl(2));
		expect(isPicked(2)).toBe(true);
		fireEvent.click(rowEl(2));
		expect(isPicked(2)).toBe(true);
		expect([1, 2, 3].filter((n) => isPicked(n))).toEqual([2]);
	});

	it("selection::picking-a-second-row-releases-the-first", () => {
		render(<BookmarksTable items={ITEMS} />);
		fireEvent.click(rowEl(1));
		fireEvent.click(rowEl(3));
		expect(isPicked(1)).toBe(false);
		expect(isPicked(3)).toBe(true);
	});

	it("selection::a-click-on-a-LINK-inside-the-row-does-not-pick-it", () => {
		// The title and the market question navigate; the unbookmark button acts.
		// One `closest("a,button")` guard covers every child.
		// ⚠ PROFILE REFINEMENT · R3 — READ ON ROW 2. Row one is picked at mount, so the
		// claim is "the selection did not MOVE", asserted on a row that can still fail.
		render(<BookmarksTable items={ITEMS} />);
		const link = rowEl(2).querySelector("a");
		if (link === null) {
			throw new Error("selection: the row renders no link to click");
		}
		fireEvent.click(link);
		expect(isPicked(2)).toBe(false);
		expect(isPicked(1)).toBe(true);
	});

	it("selection::a-click-on-the-UNBOOKMARK-button-does-not-pick-it", () => {
		// The row's own action must not double as a selection gesture — a reader
		// removing a bookmark has not asked to read it.
		// ⚠ PROFILE REFINEMENT · R3 — READ ON ROW 2, same reason as the link case above.
		render(<BookmarksTable items={ITEMS} />);
		const button = rowEl(2).querySelector("button");
		if (button === null) {
			throw new Error("selection: the row renders no button to click");
		}
		fireEvent.click(button);
		expect(isPicked(2)).toBe(false);
		expect(isPicked(1)).toBe(true);
	});
});

describe("C5 — Up/Down step the selection, wrapping", () => {
	it("selection::the-FIRST-press-steps-off-row-one-in-both-directions", () => {
		// ⛔⛔ RE-POINTED at PROFILE OVERLAP R4, AND THIS GUARD WAS ASSERTING THE
		// DEFECT — the same one, on the same day, as Profile's. It read
		// `both-directions-enter-at-the-first-row-from-nothing` and expected row ONE
		// after one press. "Nothing" stopped being a state when R3 selected row one
		// at mount, but the stepper's anchor still read the STORED pick, so it fell
		// to `at < 0` and re-picked where it stood: the first press moved nothing and
		// this test called it correct. ⇒ The anchor is the DERIVED row now, so down
		// is row two and up wraps to the last.
		render(<BookmarksTable items={ITEMS} />);
		expect(isPicked(1)).toBe(true);
		fireEvent.keyDown(table(), { key: "ArrowDown" });
		expect(isPicked(2)).toBe(true);
		cleanup();
		render(<BookmarksTable items={ITEMS} />);
		fireEvent.keyDown(table(), { key: "ArrowUp" });
		expect(isPicked(3)).toBe(true);
	});

	it("selection::ArrowDown-WRAPS-past-the-last", () => {
		render(<BookmarksTable items={ITEMS} />);
		fireEvent.click(rowEl(3));
		fireEvent.keyDown(table(), { key: "ArrowDown" });
		expect(isPicked(1)).toBe(true);
		expect(isPicked(3)).toBe(false);
	});

	it("selection::ArrowUp-WRAPS-past-the-first", () => {
		render(<BookmarksTable items={ITEMS} />);
		fireEvent.click(rowEl(1));
		fireEvent.keyDown(table(), { key: "ArrowUp" });
		expect(isPicked(3)).toBe(true);
	});

	it("selection::a-non-arrow-key-passes-through", () => {
		// The handler sits on the table and must not swallow keys it does not own.
		// ⚠ PROFILE REFINEMENT · R3 — the claim is "the selection did not MOVE", not
		// "nothing is selected".
		render(<BookmarksTable items={ITEMS} />);
		fireEvent.click(rowEl(2));
		fireEvent.keyDown(table(), { key: "Tab" });
		fireEvent.keyDown(table(), { key: "a" });
		expect([1, 2, 3].filter((n) => isPicked(n))).toEqual([2]);
	});

	it("selection::focus-moves-with-the-selection", () => {
		// Focus follows the pick so the NEXT press keeps arriving at the table's own
		// handler. ⚠ PROFILE OVERLAP R4 — that used to be the only way in at all,
		// which is why a fresh page could not be stepped; `row-stepper.ts` carries
		// the first press now and stands down once focus is inside. ⚠ The row numbers
		// moved with the anchor, not the claim.
		render(<BookmarksTable items={ITEMS} />);
		fireEvent.keyDown(table(), { key: "ArrowDown" });
		expect(document.activeElement).toBe(rowEl(2));
		fireEvent.keyDown(table(), { key: "ArrowDown" });
		expect(document.activeElement).toBe(rowEl(3));
	});

	it("selection::the-roving-tab-stop-follows-the-selection", () => {
		render(<BookmarksTable items={ITEMS} />);
		expect(rowEl(1).getAttribute("tabindex")).toBe("0");
		expect(rowEl(2).getAttribute("tabindex")).toBe("-1");
		fireEvent.click(rowEl(2));
		expect(rowEl(1).getAttribute("tabindex")).toBe("-1");
		expect(rowEl(2).getAttribute("tabindex")).toBe("0");
	});

	it("selection::arrows-step-only-through-what-the-market-filter-left", () => {
		const mixed = [item(1), item(2), item(4, "fixture-beta")];
		render(<BookmarksTable items={mixed} />);
		fireEvent.click(screen.getByTestId("bookmarks-market-filter"));
		fireEvent.click(
			screen.getByTestId("bookmarks-market-option-fixture-alpha"),
		);
		expect(screen.queryByTestId(`bookmark-row-${ID(4)}`)).toBeNull();
		fireEvent.click(rowEl(2));
		fireEvent.keyDown(table(), { key: "ArrowDown" });
		// Wraps to row 1, never into the filtered-out row.
		expect(isPicked(1)).toBe(true);
	});
});

describe("C5 — the selected row RENDERS DIFFERENTLY, not just flagged", () => {
	it("selection::THE-CLASS-STRING-CHANGES", () => {
		// ⚠⚠ THE CENTRAL ASSERTION. A flag-only check cannot see a selection that
		// is invisible, which is exactly the defect Profile shipped one round.
		// ⚠ PROFILE REFINEMENT · R3 — MEASURED ON ROW 2: row one is selected at mount, so
		// row one's before/after would compare selected with selected.
		render(<BookmarksTable items={ITEMS} />);
		const before = rowEl(2).className;
		fireEvent.click(rowEl(2));
		const after = rowEl(2).className;
		expect(
			after,
			"C5: the selected row's className is unchanged — the selection is " +
				"invisible.",
		).not.toBe(before);
		// ⚠⚠ PROFILE REFINEMENT · R6 — THE MECHANISM MOVED, HERE AS ON PROFILE. The
		// swap ("rung 3 replaces rung 1") could carry no radius, because
		// `border-collapse:collapse` ignores `border-radius`. The mockup ADDS an
		// outline instead, which the element paints itself and which honours the
		// radius. The hairline now SURVIVES selection — losing it is the regression.
		// ⚠⚠ RE-POINTED AGAIN AT PROFILE OVERLAP R1, in lockstep with Profile's.
		// The radius is a BASE class now — R6 gave it to the selected arm only, which
		// left every unselected row a square hairline box, and the old line
		// `not.toContain("rounded-(--r)")` on `before` asserted precisely that.
		// The hairline is an OUTLINE on both arms, because a border cannot round
		// under the collapsing model.
		const cls = after.split(/\s+/);
		expect(cls).toContain("[outline:var(--ring-active)]");
		expect(cls).toContain("[outline-offset:-2px]");
		expect(cls).toContain("bg-n1");
		expect(cls).toContain("rounded-(--r)");
		expect(before.split(/\s+/)).toContain("rounded-(--r)");
		expect(before.split(/\s+/)).toContain("[outline:var(--hairline)]");
		expect(cls).not.toContain("[border:var(--hairline)]");
	});

	it("selection::EXACTLY-ONE-outline-utility-in-either-state", () => {
		// Two arbitrary utilities for ONE property resolve by stylesheet order, not
		// by the order they are written — so the two are a conditional, never both.
		// A regression is invisible in jsdom and picks the wrong edge in a browser.
		// ⚠ RE-POINTED at PROFILE OVERLAP R1 from `[border:` to `[outline:`: the
		// property under contention moved when the row's edge did. ⛔ Tighter, not
		// looser — an element has exactly one outline, so a second declaration is
		// not ambiguous, it is dead.
		render(<BookmarksTable items={ITEMS} />);
		const count = (n: number) =>
			classesOf(n).filter((c) => c.startsWith("[outline:")).length;
		expect(count(1)).toBe(1);
		fireEvent.click(rowEl(1));
		expect(count(1)).toBe(1);
	});

	it("selection::the-row-is-keyboard-operable-and-shows-a-focus-ring", () => {
		render(<BookmarksTable items={ITEMS} />);
		expect(classesOf(1)).toContain("focus-visible:shadow-(--state-focus-ring)");
		fireEvent.keyDown(rowEl(1), { key: "Enter" });
		expect(isPicked(1)).toBe(true);
	});
});

describe("C6 — the arena's two panels share one selection", () => {
	const mount = () => render(<BookmarksArena items={ITEMS} />);
	const panelTitle = () =>
		screen.getByTestId("bookmarks-replica-panel-title").textContent ?? "";

	it("arena::THE-REPLICA-OPENS-ON-THE-FIRST-ROW", () => {
		// ⚠⚠ PROFILE REFINEMENT · R3 — INVERTED. This asserted the replica body was
		// EMPTY at mount, which was true and was the defect: R3 rules that the rail
		// must show a full argument on load, in BOTH modes. The note below still
		// holds for what happens when there is genuinely nothing to show.
		//
		// ⚠ THE DIVERGENCE FROM PROFILE THIS USED TO RECORD IS UNCHANGED IN KIND:
		// Profile's right panel FILTERS a complete record (SPEC.1 §16.3 D8 / §17),
		// while this route's TABLE already is the complete list, so an empty panel
		// loses nothing here. What changed is only that the panel is no longer empty
		// at MOUNT — it is empty when the list is.
		mount();
		expect(screen.getByTestId(`bookmark-replica-${ID(1)}`)).toBeTruthy();
		expect(panelTitle()).toBe("Market fixture-alpha");
	});

	it("arena::a-click-fills-the-replica-and-retitles-the-panel", () => {
		mount();
		fireEvent.click(rowEl(1));
		expect(screen.getByTestId(`bookmark-replica-${ID(1)}`)).toBeTruthy();
		expect(panelTitle()).toBe("Market fixture-alpha");
	});

	it("arena::A-SECOND-CLICK-KEEPS-THE-PANEL", () => {
		// ⚠⚠ PROFILE REFINEMENT · R3 — INVERTED, for the reason the retired toggle
		// records: with a first-row fallback there is no empty state to return to, so
		// clearing would re-derive to row one immediately.
		mount();
		fireEvent.click(rowEl(2));
		expect(screen.getByTestId(`bookmark-replica-${ID(2)}`)).toBeTruthy();
		fireEvent.click(rowEl(2));
		expect(screen.getByTestId(`bookmark-replica-${ID(2)}`)).toBeTruthy();
		expect(panelTitle()).toBe("Market fixture-alpha");
	});

	it("arena::THE-PANEL-FOLLOWS-THE-ARROW-KEYS-and-wraps", () => {
		// ⚠ PROFILE OVERLAP R4 — the panel starts on row one, so the first press
		// moves to the SECOND. It used to open on the first press because the
		// stepper re-selected row one, i.e. the panel appeared to follow a press
		// that had moved nothing. Same claim, sequence one row earlier.
		mount();
		const t = screen.getByTestId("bookmarks-table");
		expect(screen.getByTestId(`bookmark-replica-${ID(1)}`)).toBeTruthy();
		fireEvent.keyDown(t, { key: "ArrowDown" });
		expect(screen.getByTestId(`bookmark-replica-${ID(2)}`)).toBeTruthy();
		fireEvent.keyDown(t, { key: "ArrowUp" });
		expect(screen.getByTestId(`bookmark-replica-${ID(1)}`)).toBeTruthy();
	});

	it("arena::the-replica-renders-head-title-body-image-slot-footer", () => {
		mount();
		fireEvent.click(rowEl(1));
		const card = screen.getByTestId(`bookmark-replica-${ID(1)}`);
		expect(card.children[0]?.textContent).toContain("RedWolf001");
		expect(screen.getByTestId(`bookmark-replica-title-${ID(1)}`)).toBeTruthy();
		const body = screen.getByTestId(`bookmark-replica-body-${ID(1)}`);
		expect(body.textContent).toBe(ITEMS[0]?.removed ? "" : ITEMS[0]?.body);
		expect(body.className).not.toContain("line-clamp");
		expect(
			screen.getByTestId(`bookmark-replica-aggregate-${ID(1)}`),
		).toBeTruthy();
	});

	it("arena::the-IMAGE-SLOT-exists-and-renders-NOTHING", () => {
		// ⛔ The image is a LIVE VALUE — `comments.imageUploadsId` is never
		// selected by bookmarks/list.ts, so a real image is a new server read per
		// render. The slot is the growth region that pins the footer, and it is
		// EMPTY: not a grey box, which would state "an image is missing" on every
		// argument, most of which have none.
		mount();
		fireEvent.click(rowEl(1));
		const slot = screen.getByTestId(`bookmark-replica-image-slot-${ID(1)}`);
		expect(slot.childNodes.length).toBe(0);
		expect(slot.textContent).toBe("");
		for (const banned of ["bg-", "border"]) {
			expect(slot.className.includes(banned)).toBe(false);
		}
		expect(slot.className.split(/\s+/)).toContain("flex-1");
		expect(slot.className.split(/\s+/)).toContain("min-h-0");
	});

	it("arena::a-filter-that-hides-the-pick-RE-AIMS-the-panel", () => {
		// ⚠⚠ PROFILE REFINEMENT · R3 — INVERTED, and this is the case R3 calls out by
		// name: "an empty rail after a filter is the same defect one interaction
		// later". The hidden pick no longer empties the panel; the fallback re-aims it
		// at the first row the filter LEFT.
		const mixed = [item(1), item(4, "fixture-beta")];
		render(<BookmarksArena items={mixed} />);
		fireEvent.click(rowEl(1));
		expect(screen.getByTestId(`bookmark-replica-${ID(1)}`)).toBeTruthy();
		fireEvent.click(screen.getByTestId("bookmarks-market-filter"));
		fireEvent.click(screen.getByTestId("bookmarks-market-option-fixture-beta"));
		// The old pick is gone from the panel…
		expect(screen.queryByTestId(`bookmark-replica-${ID(1)}`)).toBeNull();
		// …and the surviving row's argument is in it, under ITS market.
		expect(screen.getByTestId(`bookmark-replica-${ID(4)}`)).toBeTruthy();
		expect(panelTitle()).toBe("Market fixture-beta");
	});
});
