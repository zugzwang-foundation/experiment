// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import { PostCard } from "@/components/debate/PostCard";
import type { DebatePost, ReplyGroups } from "@/components/debate/types";

/**
 * POLISH.3 PR 2 · C1 — the `PostCard` guards (plan §7; §6 rows 1 · 2 · 3).
 *
 * Rows under test:
 *  - row 1 (`PD-0-02`, C8) — the disabled `Đ BET` control is REMOVED.
 *  - row 2 (`PD-0-02`, C8) — the disabled `Support / Counter` control is REMOVED.
 *  - row 3 (`PD-0-01`, C9) — `<Plus /> Full` becomes a `Read more` text link
 *    carrying `text-n5 hover:text-ink` (CD-A's `#989898`/`#FAFAFA`, ported by
 *    TOKEN — Ruling A forbids the hex).
 *
 * ⚠ GUARD-COMPOSITION CONSTRAINT (plan §7, v1.4). `PostCard` transitively
 * renders six other allow-list components, five of which a LATER commit writes:
 * C10 rewrites `ArgProfile` / `ReplyCard` / `AggregateFooter` and C11 deletes
 * `CardActions`' `Download` trigger. So every assertion below is keyed to the
 * ROW'S OWN SUBJECT via a targeted query — never a whole-subtree snapshot,
 * never a button COUNT, never a full-`innerHTML` equality over the card root.
 * A count here would go red at C11 for a change that is not this file's subject.
 *
 * ⚠ This is NOT a relaxation of `O-7`. The assertions read `innerHTML` — of the
 * ELEMENT that carries the row's subject, not of the composed root. Narrow the
 * scope; keep the medium.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM only.
 */

vi.mock("@/server/bookmarks/add", () => ({ addBookmarkAction: vi.fn() }));
vi.mock("@/server/bookmarks/remove", () => ({ removeBookmarkAction: vi.fn() }));

afterEach(cleanup);

const VIEWER: BookmarkAffordance = { saved: new Set(), own: new Set() };
const EMPTY_REPLIES: ReplyGroups = { support: [], counter: [], twoSlot: [] };
const AGGREGATE = {
	supportCount: 2,
	counterCount: 1,
	supportDharma: "1000.000000000000000000",
	counterDharma: "2000.000000000000000000",
};

/** Neutral fixture prose — no invented market content (CLAUDE.md §3). */
function presentPost(): DebatePost {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-00000000da01",
		ordinal: 1,
		sideAtPostTime: "YES",
		createdAt: "2026-07-30T00:00:00.000Z",
		title: "Fixture argument title.",
		teaser: "Fixture teaser.",
		body: "Fixture body.",
		imageUrl: null,
		marker: "none",
		badge: null,
		author: { pseudonym: "fixture-author", pfpUrl: "" },
		authorStake: "10.000000000000000000",
		entryPrice: "0.500000000000000000",
		aggregate: AGGREGATE,
		replies: EMPTY_REPLIES,
	};
}

const noop = () => {};

function renderCard() {
	return render(
		<PostCard
			post={presentPost()}
			bookmarks={VIEWER}
			onEnter={noop}
			onOpenPopup={noop}
			onOpenImage={noop}
		/>,
	);
}

/** Every `<button>` inside the card — the search space, never an assertion. */
function buttonsIn(container: HTMLElement): HTMLButtonElement[] {
	return Array.from(container.querySelectorAll("button"));
}

describe("POLISH.3 PR 2 — PostCard's disabled write triggers and Read more", () => {
	it("post-card::disabled-dharma-bet-control-is-removed", () => {
		// Row 1 · PD-0-02 · R1 RULED — REMOVED, not enabled. A signed-in
		// participant was being told to "sign in to bet"; the per-column live
		// entry on the slot header already carries the affordance.
		const { container } = renderCard();

		const offender = buttonsIn(container).find(
			(b) => b.getAttribute("aria-label") === "Đ BET — sign in to bet",
		);

		expect(offender).toBeUndefined();
	});

	it("post-card::disabled-support-counter-control-is-removed", () => {
		// Row 2 · PD-0-02 · R1 RULED — REMOVED on THESIS grounds: entering
		// post-focus to argue means reading the post first, and mandatory
		// commentary is meant to make argument deliberate, not reflexive.
		const { container } = renderCard();

		const offender = buttonsIn(container).find(
			(b) => b.getAttribute("aria-label") === "Reply — sign in to argue",
		);

		expect(offender).toBeUndefined();
	});

	it("post-card::read-more-replaces-the-plus-full-affordance", () => {
		// Row 3 · PD-0-01 · R4 RULED — ADOPT "Read more". The OLD form is a
		// `<Plus />` icon + the word "Full"; asserting only the new copy would
		// pass on a card that rendered BOTH.
		const { container } = renderCard();
		const buttons = buttonsIn(container);

		const readMore = buttons.find((b) => b.innerHTML.includes("Read more"));
		expect(readMore).toBeDefined();

		// The superseded label is gone from every control on the card.
		expect(buttons.some((b) => b.innerHTML.includes("Full"))).toBe(false);
	});

	it("post-card::read-more-is-a-text-link-carrying-the-ported-tokens", () => {
		// Row 3, second half. CD-A's `#989898` / `#FAFAFA` ARE `--color-n5` /
		// `--color-ink`, so the port is BY TOKEN. A raw hex here also reddens
		// `no-raw-hex-view-layer.test.ts` (Ruling A / H-HEX).
		const { container } = renderCard();

		const readMore = buttonsIn(container).find((b) =>
			b.innerHTML.includes("Read more"),
		);
		expect(readMore).toBeDefined();

		const className = readMore?.getAttribute("class") ?? "";
		expect(className).toContain("text-n5");
		expect(className).toContain("hover:text-ink");

		// "text LINK" — CD-A ratified copy, not an icon button. Asserted on the
		// element that carries the row's subject, so C11's `Download` deletion
		// (a different element entirely) cannot move it.
		expect(readMore?.innerHTML).not.toContain("<svg");
	});
});
