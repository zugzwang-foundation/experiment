// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * HTML-FINISH · BOOKMARKS — the arrangement guards.
 *
 * WHAT MOVED. `/bookmarks` gained the arena PANEL the Profile surface ships on
 * this branch: a bordered, rounded section whose header bar carries the title
 * and the view chip, and whose body holds the list (or the empty block) and
 * owns the scroll. The header pair was RELOCATED into that bar, not copied.
 *
 * ⚠ THESE ASSERT ON STRUCTURE AND `innerHTML`, NEVER ON `textContent` alone
 * (CLAUDE.md §8 `O-7`). Every claim below is a COMPOSITION claim — which node
 * contains which — and `textContent` flattens away exactly the nesting that
 * carries it: a `textContent` check for "Bookmarks" passes identically on the
 * pre-change build this file was written to reject.
 *
 * ⚠ NO VALUE IS ASSERTED. Colour, radius, px and type size belong to the
 * shipped dark token system (DESIGN.B1); the mockup is a light-mode prototype.
 * What is pinned is topology and the PARITY of the class strings against the
 * Profile panel they are byte-carried from — which is a sameness check, not a
 * value.
 *
 * ASYNC-RSC HARNESS: `render(await BookmarksPage())`, the idiom
 * `surface-states.test.tsx:19-23` records for this surface. No jest-dom in this
 * repo (AGENTS.md §9) — plain DOM assertions only. No DB, no server code.
 */

vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
// `useRouter` is needed because this file renders the POPULATED list, whose
// cards mount `UnbookmarkButton` — the empty-arm suite next door never reaches
// it and so never needed the export.
vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
	useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/server/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/server/bookmarks/list", () => ({ loadBookmarks: vi.fn() }));

import * as bookmarksPage from "@/app/(public)/bookmarks/page";
import { auth } from "@/server/auth";
import type { BookmarkItem } from "@/server/bookmarks/list";
import { loadBookmarks } from "@/server/bookmarks/list";

const BookmarksPage = bookmarksPage.default;

afterEach(cleanup);

beforeEach(() => {
	vi.mocked(auth.api.getSession).mockResolvedValue({
		user: { id: "0190b3a0-9999-7000-8000-00000000000f" },
	} as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);
	vi.mocked(loadBookmarks).mockResolvedValue([]);
});

/**
 * One present post bookmark, on the shipped `BookmarkItem` DTO (type-only
 * import — no server module executes). No market content is invented: the
 * strings are fixture labels, never a question or a resolution criterion
 * (CLAUDE.md §3).
 */
const ITEM: BookmarkItem = {
	removed: false,
	kind: "post",
	id: "0190c0de-ffff-7000-8000-000000000101",
	side: "YES",
	marketSlug: "fixture-alpha",
	marketTitle: "Market fixture-alpha",
	ordinal: 1,
	title: "Fixture argument alpha",
	teaser: "Fixture teaser alpha",
	body: "Fixture argument alpha\n\nFixture teaser alpha",
	marker: "none",
	authorStake: "25.000000000000000000",
	priceAtBet: "0.380000000000000000",
	createdAt: "2026-08-15T00:00:00.000Z",
	aggregate: {
		supportCount: 2,
		counterCount: 1,
		supportDharma: "30.000000000000000000",
		counterDharma: "10.000000000000000000",
	},
	authorPseudonym: "RedFox001",
	staked: "25.000000000000000000",
	current: "31.000000000000000000",
};

describe("the arena panel — the list is inside a bordered panel with a bar", () => {
	it("the-panel-exists-and-wraps-the-list", async () => {
		vi.mocked(loadBookmarks).mockResolvedValue([ITEM]);
		render(await BookmarksPage());

		const panel = screen.getByTestId("bookmarks-panel");
		const body = screen.getByTestId("bookmarks-panel-body");
		const list = screen.getByTestId("bookmark-list");
		// CONTAINMENT, not co-existence. Three `getByTestId` calls prove only that
		// three nodes exist somewhere; the whole claim of this round is that the
		// list moved INSIDE the panel body, so the nesting is what is asserted.
		expect(panel.contains(body)).toBe(true);
		expect(body.contains(list)).toBe(true);
	});

	it("the-empty-state-lands-in-the-panel-body-too-not-beside-the-panel", async () => {
		// The empty arm is the state a reader most often meets on this surface, and
		// it is the arm most easily left outside the frame — POLISH.6 rendered it as
		// a SIBLING of the header row. Panel parity has to hold in both arms or the
		// surface changes shape when the list empties.
		render(await BookmarksPage());
		const body = screen.getByTestId("bookmarks-panel-body");
		expect(body.contains(screen.getByTestId("bookmarks-empty"))).toBe(true);
		expect(screen.queryByTestId("bookmark-list")).toBeNull();
	});

	it("the-header-bar-carries-the-title-and-the-view-chip", async () => {
		render(await BookmarksPage());
		const head = screen.getByTestId("bookmarks-panel-head");
		const h1 = head.querySelector("h1");
		expect(h1?.textContent).toBe("Bookmarks");
		// The chip is asserted through the BAR's own markup, so a chip that drifted
		// back out to page level fails here rather than passing on a document-wide
		// text search.
		expect(head.innerHTML).toContain("Your bookmarks");
	});

	it("`Bookmarks` renders EXACTLY ONCE — the header row moved, it was not copied", async () => {
		// ⚠ THE FAILURE THIS ROUND'S SHAPE INVITES. Titling the panel head while
		// leaving the old `<h1>` above the panel prints the word twice, and every
		// other assertion in this file stays green while it does.
		vi.mocked(loadBookmarks).mockResolvedValue([ITEM]);
		const { container } = render(await BookmarksPage());
		const exact = [...container.querySelectorAll("*")].filter(
			(el) => el.children.length === 0 && el.textContent === "Bookmarks",
		);
		expect(exact.length).toBe(1);
		expect(exact[0]?.tagName).toBe("H1");
	});

	it("the-title-keeps-heading-semantics-while-taking-the-panel-title-tier", async () => {
		// ⛔ THE ELEMENT AND THE CLASSES COME FROM DIFFERENT PLACES, DELIBERATELY.
		// Profile's panel title is a `<span>` because that page carries no
		// page-level heading; this surface has had one since UI-A6, so the `<h1>`
		// survives and only the tier moves. Canon §10 `C-STATES-1`'s DOC-1 rider is
		// the precedent: a shared TREATMENT never ratifies a shared FILE SHAPE.
		render(await BookmarksPage());
		const h1 = screen.getByTestId("bookmarks-panel-head").querySelector("h1");
		const classes = new Set((h1?.getAttribute("class") ?? "").split(/\s+/));
		for (const c of ["text-xs", "font-medium", "text-ink"]) {
			expect(classes.has(c), `panel title declares ${c}`).toBe(true);
		}
		// The pre-change page-title tier is GONE, not merely joined — leaving
		// `text-lg` on would keep the old size winning through twMerge order.
		expect(classes.has("text-lg")).toBe(false);
		expect(classes.has("font-semibold")).toBe(false);
	});

	it("ONE panel, not two — the absent half is absent, not an empty box", async () => {
		// ⚠ THE MEASUREMENT THIS ROUND RESTS ON. Profile's arena has two halves
		// because that surface loads TWO collections; `loadBookmarks` returns ONE
		// `BookmarkItem[]`. A second bordered panel here would be a shape held open
		// with nothing to put in it. If a second collection ever arrives, this row
		// is the one that must be re-derived — deliberately, not by deletion.
		vi.mocked(loadBookmarks).mockResolvedValue([ITEM]);
		const { container } = render(await BookmarksPage());
		expect(container.querySelectorAll("[data-testid$='-panel']").length).toBe(
			1,
		);
	});
});
