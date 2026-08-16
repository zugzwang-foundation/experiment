// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
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

	it("post-card::the-plus-glyph-replaces-Read-more", () => {
		// ⚠ ROW 24 REVERSES R4, and the superseded assertion is recorded rather
		// than silently swapped. R4 (2026-08-12) ruled `<Plus /> Full` → a
		// `Read more` TEXT LINK and removed the glyph outright. The founder ruling
		// of 2026-08-16 reverses it: the glyph returns, `Read more` goes.
		const { container } = renderCard();
		const buttons = buttonsIn(container);

		const plus = buttons.find(
			(b) => b.getAttribute("aria-label") === "Show more",
		);
		expect(plus).toBeDefined();
		expect(plus?.innerHTML).toContain("+");

		// Both superseded labels pinned as gone — asserting only the new form
		// would pass on a card that rendered BOTH.
		expect(buttons.some((b) => b.innerHTML.includes("Read more"))).toBe(false);
		expect(buttons.some((b) => b.innerHTML.includes("Full"))).toBe(false);
	});

	it("post-card::the-glyph-carries-an-aria-label-and-WCAG-2.5.3-still-holds", () => {
		// ⚠ THE ACCESSIBILITY ARGUMENT INVERTED WITH THE CONTROL, which is why
		// this is not simply "R4 undone". R4 dropped the `aria-label` DELIBERATELY:
		// "Read the full argument" does not CONTAIN the visible text "Read more",
		// and an accessible name that omits its visible label fails WCAG 2.5.3
		// (Label in Name). A GLYPH has no visible label, so 2.5.3 does not apply
		// and an `aria-label` becomes REQUIRED rather than forbidden — the concern
		// is answered, not dismissed.
		// ⛔ The label is BYTE-CARRIED from `d5:1077`'s own control, not authored.
		const { container } = renderCard();

		const plus = buttonsIn(container).find(
			(b) => b.getAttribute("aria-label") === "Show more",
		);
		expect(plus).toBeDefined();
		// The ported tokens survive the control swap (Ruling A / H-HEX — a raw hex
		// here also reddens `no-raw-hex-view-layer`).
		const className = plus?.getAttribute("class") ?? "";
		expect(className).toContain("text-n5");
		expect(className).toContain("hover:text-ink");
	});

	it("post-card::row-23-the-title-enters-post-focus-and-Open-debate-is-gone", () => {
		// Row 23 — d5's `.rtitle.plust` (`:1077`): the title carries
		// `enterPost(…)`, the `+` carries `openPostPop(…)`. Two destinations, one
		// row, and no third control duplicating either.
		const onEnter = vi.fn();
		const onOpenPopup = vi.fn();
		const { container } = render(
			<PostCard
				post={presentPost()}
				bookmarks={VIEWER}
				onEnter={onEnter}
				onOpenPopup={onOpenPopup}
				onOpenImage={noop}
			/>,
		);

		const title = container.querySelector("h3")?.closest("button");
		expect(title).not.toBeNull();
		fireEvent.click(title as HTMLButtonElement);
		expect(onEnter).toHaveBeenCalledWith(presentPost().id);
		// ⛔ It does NOT also open the pop-up — that is the `+`'s job alone.
		expect(onOpenPopup).not.toHaveBeenCalled();

		// `Open debate` is gone from the PRESENT branch…
		expect(container.innerHTML).not.toContain("Open debate");
	});

	it("post-card::the-REMOVED-branch-keeps-Open-debate", () => {
		// ⛔ …and the removed branch KEEPS it (plan F-3). A removed post has no
		// title to click and `page.tsx` falls back silently for a removed `?post=`
		// target, so without this control a removed post and every surviving reply
		// under it would be reachable by NO path at all.
		const onEnter = vi.fn();
		const { container } = render(
			<PostCard
				post={{
					removed: true,
					id: presentPost().id,
					ordinal: 1,
					sideAtPostTime: "YES",
					createdAt: "2026-07-30T00:00:00.000Z",
					aggregate: AGGREGATE,
					replies: EMPTY_REPLIES,
				}}
				bookmarks={VIEWER}
				onEnter={onEnter}
				onOpenPopup={noop}
				onOpenImage={noop}
			/>,
		);

		expect(container.innerHTML).toContain("Open debate");
		const open = buttonsIn(container).find((b) =>
			b.innerHTML.includes("Open debate"),
		);
		fireEvent.click(open as HTMLButtonElement);
		expect(onEnter).toHaveBeenCalledWith(presentPost().id);
	});
});

/**
 * HTML-FINISH · MARKET DETAIL row 25 — the teaser and the two-slot reply
 * preview LEAVE the market-view card (SPEC.1 **1.0.31**, §9 preamble +
 * F-DEBATE-1 System/Acceptance + the two §17 rows).
 *
 * ⛔ THE SELECTION RULE IS NOT UNDER TEST HERE AND DID NOT CHANGE.
 * `ReplyGroups.twoSlot` is still on the read model and
 * `tests/unit/ranking/replies.test.ts` still pins the ordering, unamended. What
 * this guard pins is the SURFACE: the card presents one argument, not the
 * replies to it.
 *
 * ⚠ BOTH BRANCHES, because both are market-view post cards. The removed branch
 * additionally keeps `Open debate →` (plan F-3) — without it a removed post and
 * its surviving replies would be reachable by no path at all, since `page.tsx`
 * falls back silently for a removed `?post=` target.
 *
 * ⚠ O-7 — `innerHTML`, never `textContent`.
 */
describe("HTML-FINISH · MARKET DETAIL — row 25, the card sheds teaser + replies", () => {
	it("post-card::no-teaser-on-the-card", () => {
		const { container } = renderCard();

		// The fixture's teaser string, pinned as absent. The BODY still exists on
		// the DTO and the pop-up still renders it — this is a card-composition
		// change, not a data change.
		expect(container.innerHTML).not.toContain("Fixture teaser.");
		// Non-vacuity: the card DID render, with its title.
		expect(container.innerHTML).toContain("Fixture argument title.");
	});

	it("post-card::no-reply-preview-on-either-branch", () => {
		const withReplies = presentPost();
		const reply = {
			removed: false as const,
			id: "0199a0c0-0000-7000-8000-00000000ee01",
			side: "YES" as const,
			createdAt: "2026-07-30T00:00:00.000Z",
			body: "Fixture reply body that must not appear on the card.",
			marker: "none" as const,
			author: { pseudonym: "fixture-replier", pfpUrl: "" },
			stake: "10.000000000000000000",
			entryPrice: "0.500000000000000000",
			imageUrl: null,
		};
		withReplies.replies = {
			support: [reply],
			counter: [],
			twoSlot: [reply],
		};

		const present = render(
			<PostCard
				post={withReplies}
				bookmarks={VIEWER}
				onEnter={noop}
				onOpenPopup={noop}
				onOpenImage={noop}
			/>,
		);
		// ⛔ The BODY's absence, not the row's — the reply is still ON the DTO
		// (the read model is untouched); it simply must not render here.
		expect(present.container.innerHTML).not.toContain(
			"Fixture reply body that must not appear on the card.",
		);
		expect(
			present.container.querySelector('[data-testid="reply-group-support"]'),
		).toBeNull();

		// The removed branch is a market-view card too.
		cleanup();
		const removed = render(
			<PostCard
				post={{
					removed: true,
					id: withReplies.id,
					ordinal: 1,
					sideAtPostTime: "YES",
					createdAt: "2026-07-30T00:00:00.000Z",
					aggregate: AGGREGATE,
					replies: withReplies.replies,
				}}
				bookmarks={VIEWER}
				onEnter={noop}
				onOpenPopup={noop}
				onOpenImage={noop}
			/>,
		);
		expect(removed.container.innerHTML).not.toContain(
			"Fixture reply body that must not appear on the card.",
		);
		// …and it KEEPS its way in (plan F-3). Deleting this would strand a
		// removed post and every surviving reply under it.
		expect(removed.container.innerHTML).toContain("Open debate");
	});
});
