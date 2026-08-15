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
	it("selection::nothing-is-picked-at-mount", () => {
		render(<BookmarksTable items={ITEMS} />);
		for (const n of [1, 2, 3]) {
			expect(isPicked(n)).toBe(false);
		}
	});

	it("selection::click-picks-and-clicking-again-CLEARS", () => {
		render(<BookmarksTable items={ITEMS} />);
		fireEvent.click(rowEl(1));
		expect(isPicked(1)).toBe(true);
		fireEvent.click(rowEl(1));
		expect(isPicked(1)).toBe(false);
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
		render(<BookmarksTable items={ITEMS} />);
		const link = rowEl(1).querySelector("a");
		if (link === null) {
			throw new Error("selection: the row renders no link to click");
		}
		fireEvent.click(link);
		expect(isPicked(1)).toBe(false);
	});

	it("selection::a-click-on-the-UNBOOKMARK-button-does-not-pick-it", () => {
		// The row's own action must not double as a selection gesture — a reader
		// removing a bookmark has not asked to read it.
		render(<BookmarksTable items={ITEMS} />);
		const button = rowEl(1).querySelector("button");
		if (button === null) {
			throw new Error("selection: the row renders no button to click");
		}
		fireEvent.click(button);
		expect(isPicked(1)).toBe(false);
	});
});

describe("C5 — Up/Down step the selection, wrapping", () => {
	it("selection::both-directions-enter-at-the-first-row-from-nothing", () => {
		// Profile's `at < 0 ? 0`.
		render(<BookmarksTable items={ITEMS} />);
		fireEvent.keyDown(table(), { key: "ArrowDown" });
		expect(isPicked(1)).toBe(true);
		cleanup();
		render(<BookmarksTable items={ITEMS} />);
		fireEvent.keyDown(table(), { key: "ArrowUp" });
		expect(isPicked(1)).toBe(true);
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
		render(<BookmarksTable items={ITEMS} />);
		fireEvent.keyDown(table(), { key: "Tab" });
		fireEvent.keyDown(table(), { key: "a" });
		for (const n of [1, 2, 3]) {
			expect(isPicked(n)).toBe(false);
		}
	});

	it("selection::focus-moves-with-the-selection", () => {
		// Without this the SECOND arrow press never reaches the handler, because
		// the handler is scoped to the table rather than to `document`.
		render(<BookmarksTable items={ITEMS} />);
		fireEvent.keyDown(table(), { key: "ArrowDown" });
		expect(document.activeElement).toBe(rowEl(1));
		fireEvent.keyDown(table(), { key: "ArrowDown" });
		expect(document.activeElement).toBe(rowEl(2));
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
		render(<BookmarksTable items={ITEMS} />);
		const before = rowEl(1).className;
		fireEvent.click(rowEl(1));
		const after = rowEl(1).className;
		expect(
			after,
			"C5: the selected row's className is unchanged — the selection is " +
				"invisible.",
		).not.toBe(before);
		expect(after.split(/\s+/)).toContain("[border:var(--ring-active)]");
		expect(after.split(/\s+/)).toContain("bg-n1");
		expect(after.split(/\s+/)).not.toContain("[border:var(--hairline)]");
	});

	it("selection::EXACTLY-ONE-border-utility-in-either-state", () => {
		// Two arbitrary `[border:…]` utilities on one element resolve by
		// stylesheet order, not by the order they are written — so the two are a
		// conditional, never both. A regression is invisible in jsdom and picks
		// the wrong edge in a browser.
		render(<BookmarksTable items={ITEMS} />);
		const count = (n: number) =>
			classesOf(n).filter((c) => c.startsWith("[border:")).length;
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

	it("arena::with-nothing-picked-the-replica-body-is-EMPTY", () => {
		// ⚠⚠ THIS IS THE DELIBERATE DIVERGENCE FROM PROFILE. Profile's right panel
		// FILTERS rather than replaces, because SPEC.1 §16.3 D8 / §17 make its
		// argument list the complete record and its table drops exited markets.
		// ⛔ That constraint does not reach /bookmarks: C-BOOKMARKS-1 forked this
		// route and the TABLE already is the complete list, so nothing is lost by
		// an empty panel.
		mount();
		const body = screen.getByTestId("bookmarks-replica-panel-body");
		expect(body.textContent).toBe("");
		expect(panelTitle()).toBe("Arguments");
	});

	it("arena::a-click-fills-the-replica-and-retitles-the-panel", () => {
		mount();
		fireEvent.click(rowEl(1));
		expect(screen.getByTestId(`bookmark-replica-${ID(1)}`)).toBeTruthy();
		expect(panelTitle()).toBe("Market fixture-alpha");
	});

	it("arena::DESELECT-empties-the-panel-and-restores-the-word", () => {
		mount();
		fireEvent.click(rowEl(1));
		fireEvent.click(rowEl(1));
		expect(screen.queryByTestId(`bookmark-replica-${ID(1)}`)).toBeNull();
		expect(panelTitle()).toBe("Arguments");
	});

	it("arena::THE-PANEL-FOLLOWS-THE-ARROW-KEYS-and-wraps", () => {
		mount();
		const t = screen.getByTestId("bookmarks-table");
		fireEvent.keyDown(t, { key: "ArrowDown" });
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

	it("arena::a-filter-that-hides-the-pick-empties-the-panel", () => {
		const mixed = [item(1), item(4, "fixture-beta")];
		render(<BookmarksArena items={mixed} />);
		fireEvent.click(rowEl(1));
		expect(screen.getByTestId(`bookmark-replica-${ID(1)}`)).toBeTruthy();
		fireEvent.click(screen.getByTestId("bookmarks-market-filter"));
		fireEvent.click(screen.getByTestId("bookmarks-market-option-fixture-beta"));
		expect(screen.queryByTestId(`bookmark-replica-${ID(1)}`)).toBeNull();
		expect(panelTitle()).toBe("Arguments");
	});
});
