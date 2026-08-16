// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import { ReplyCard } from "@/components/debate/ReplyCard";
import type { DebateReply } from "@/components/debate/types";

/**
 * HTML-FINISH · MARKET DETAIL row 26 — the reply card's anatomy, rebuilt to
 * d5's `.rcardhead` (`:1545-1548`): avatar · pseudonym | side chip with entry
 * price | staked · card actions, then the image, then the argument.
 *
 * ⚠ THE HEAD IS `ArgProfile`, NOT A SECOND IMPLEMENTATION — the point of the
 * row. The reply card's hand-rolled head had ALREADY drifted from the post's: no
 * avatar, no entry price, a differently-placed cluster, and a pseudonym rendered
 * a second time at the card's foot. Reuse is what stops that recurring, so the
 * assertions below are about the head being the SHARED one.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

vi.mock("@/server/bookmarks/add", () => ({ addBookmarkAction: vi.fn() }));
vi.mock("@/server/bookmarks/remove", () => ({ removeBookmarkAction: vi.fn() }));

afterEach(cleanup);

/** HTML-FINISH · MARKET DETAIL row 27 — the reply pop-up host. These suites
 * assert bookmarks / spacing / partitioning / images, never the pop-up, so a
 * no-op is the honest stand-in. `reply-card.test.tsx` is where the `+` is
 * pinned. */
const noopPopup = () => {};

const VIEWER: BookmarkAffordance = { saved: new Set(), own: new Set() };
const noop = () => {};

function presentReply(overrides?: Partial<DebateReply>): DebateReply {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-00000000ef01",
		side: "YES",
		createdAt: "2026-07-30T00:00:00.000Z",
		body: "Fixture reply argument.",
		marker: "none",
		author: { pseudonym: "fixture-replier", pfpUrl: "" },
		stake: "1000.000000000000000000",
		entryPrice: "0.270000000000000000",
		imageUrl: null,
		...overrides,
	} as DebateReply;
}

describe("ReplyCard — row 26, the mockup's anatomy", () => {
	it("reply-card::the-head-is-the-SHARED-ArgProfile-row", () => {
		const { container } = render(
			<ReplyCard
				reply={presentReply()}
				bookmarks={VIEWER}
				onOpenImage={noop}
				onOpenPopup={noopPopup}
			/>,
		);
		const html = container.innerHTML;

		// avatar · pseudonym | chip @ entry% | staked — d5's `.rcardhead`.
		expect(html).toContain("fixture-replier");
		expect(html).toContain("YES @ 27%");
		expect(html).toContain("Đ 1,000");
		// The pipe separator the shared row renders.
		expect(html).toContain("|");
		// The bookmark cluster rides the same head.
		expect(
			container.querySelector('button[aria-label="Bookmark"]'),
		).not.toBeNull();
	});

	it("reply-card::the-pseudonym-renders-ONCE", () => {
		// The old anatomy printed it in a trailing line as well as (implicitly)
		// owning the head — the exact drift this row removes.
		const { container } = render(
			<ReplyCard
				reply={presentReply()}
				bookmarks={VIEWER}
				onOpenImage={noop}
				onOpenPopup={noopPopup}
			/>,
		);
		const occurrences = (container.innerHTML.match(/fixture-replier/g) ?? [])
			.length;
		expect(occurrences).toBe(1);
	});

	it("reply-card::NO-reply-count-on-a-reply", () => {
		// `REPLY_DEPTH_MAX = 1`, so a reply has no replies. Rendering the field
		// would print a zero that means nothing.
		const { container } = render(
			<ReplyCard
				reply={presentReply()}
				bookmarks={VIEWER}
				onOpenImage={noop}
				onOpenPopup={noopPopup}
			/>,
		);
		expect(container.innerHTML).not.toContain("Replies ·");
	});

	it("reply-card::the-entry-price-renders-RAW-never-the-complement", () => {
		// ⛔ `bets.price_at_bet` is already the price of THE SIDE THE AUTHOR
		// BOUGHT. A NO reply at 55% must read `NO @ 55%`, never `NO @ 45%` —
		// which is also what the shipped `.md` export renders.
		const { container } = render(
			<ReplyCard
				reply={presentReply({
					side: "NO",
					entryPrice: "0.550000000000000000",
				})}
				bookmarks={VIEWER}
				onOpenImage={noop}
				onOpenPopup={noopPopup}
			/>,
		);
		expect(container.innerHTML).toContain("NO @ 55%");
		expect(container.innerHTML).not.toContain("45%");
	});

	it("reply-card::a-REMOVED-reply-keeps-its-own-badge-and-no-head", () => {
		// ⛔ SC-1 at the render. The removed variant carries no author, so it
		// CANNOT construct an `ArgProfile` — the head's absence is structural, not
		// conditional. Its frozen side survives (§6 thread integrity).
		const { container } = render(
			<ReplyCard
				reply={{
					removed: true,
					id: "0199a0c0-0000-7000-8000-00000000ef02",
					side: "NO",
					createdAt: "2026-07-30T00:00:00.000Z",
				}}
				bookmarks={VIEWER}
				onOpenImage={noop}
				onOpenPopup={noopPopup}
			/>,
		);

		expect(container.innerHTML).not.toContain("fixture-replier");
		expect(container.innerHTML).not.toContain("Fixture reply argument.");
		expect(container.querySelector('button[aria-label="Bookmark"]')).toBeNull();
		// The frozen side badge is still there — the slot survives.
		expect(container.innerHTML).toContain("NO");
	});
});

/**
 * HTML-FINISH · MARKET DETAIL rows 27 + 34 — the reply's `+` pop-up and its
 * image lightbox.
 *
 * ⛔⛔ H3-e IS WHY THE POP-UP IS ITS OWN COMPONENT. The plan halts row 27 if it
 * "requires widening `PostPopup`'s union in a way that would let a REMOVED reply
 * reach it." `ReplyPopup` takes `PresentReply | null` —
 * `Extract<DebateReply, { removed: false }>` — so a removed reply is UNPASSABLE
 * at the type level and tracks the masking union automatically. The trigger also
 * lives on the non-removed branch only, so the two controls agree.
 */
describe("ReplyCard — rows 27 + 34, the pop-up and the lightbox", () => {
	it("reply-card::the-plus-opens-the-pop-up-with-THIS-reply", () => {
		const onOpenPopup = vi.fn();
		const reply = presentReply();
		const { container } = render(
			<ReplyCard
				reply={reply}
				bookmarks={VIEWER}
				onOpenImage={noop}
				onOpenPopup={onOpenPopup}
			/>,
		);

		const plus = Array.from(container.querySelectorAll("button")).find(
			(b) => b.getAttribute("aria-label") === "Show more",
		);
		expect(plus).toBeDefined();
		fireEvent.click(plus as HTMLButtonElement);
		expect(onOpenPopup).toHaveBeenCalledWith(reply);
	});

	it("reply-card::a-REMOVED-reply-offers-NO-plus", () => {
		// ⛔ SC-1 / H3-e at the render. Belt: the branch placement. Braces: the
		// type — `onOpenPopup` takes a `PresentReply`, so the removed branch
		// could not call it even if a `+` were added there.
		const { container } = render(
			<ReplyCard
				reply={{
					removed: true,
					id: "0199a0c0-0000-7000-8000-00000000ef03",
					side: "NO",
					createdAt: "2026-07-30T00:00:00.000Z",
				}}
				bookmarks={VIEWER}
				onOpenImage={noop}
				onOpenPopup={noop}
			/>,
		);
		expect(
			Array.from(container.querySelectorAll("button")).some(
				(b) => b.getAttribute("aria-label") === "Show more",
			),
		).toBe(false);
	});

	it("reply-card::row-34-the-image-opens-the-lightbox", () => {
		const onOpenImage = vi.fn();
		const { container } = render(
			<ReplyCard
				reply={presentReply({ imageUrl: "https://example.invalid/r.png" })}
				bookmarks={VIEWER}
				onOpenImage={onOpenImage}
				onOpenPopup={noop}
			/>,
		);

		const open = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Open attached image"]',
		);
		expect(open).not.toBeNull();
		fireEvent.click(open as HTMLButtonElement);
		expect(onOpenImage).toHaveBeenCalledWith("https://example.invalid/r.png");
	});
});
