// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

afterEach(cleanup);

/** HTML-FINISH · MARKET DETAIL row 22 — the card's Support/Counter pills.
 * These suites assert spacing / card composition, never the
 * trigger gate, so a no-op with `heldSide: null` is the honest stand-in: it
 * keeps the viewer state REQUIRED at the component (a trigger without its
 * F-3 gate invites a bet the viewer cannot place) without pretending this
 * file tests it. `aggregate-footer.test.tsx` is where the gate is pinned. */
const noopReply = () => {};

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
		// ⚠ UI-OVERNIGHT entry 5 — THE BODY NOW CONTAINS ITS OWN TEASER, and
		// that is a fixture CORRECTION rather than an accommodation. The wire
		// `body` is `title\n\nextended` (`composeWireBody`) and the server splits
		// `teaser` back out of it, so a fixture whose `teaser` names a paragraph
		// its `body` does not contain describes a post the product cannot
		// produce. Nothing read the two together until `Know more` became
		// presence-driven; now they have to agree.
		teaser: "Fixture teaser.",
		body: "Fixture argument title.\n\nFixture teaser.",
		imageUrl: null,
		marker: "none",
		badge: null,
		author: { pseudonym: "fixture-author", pfpUrl: "" },
		authorStake: "10.000000000000000000",
		// RANK-1 — the substrate stake is SURVIVING basis; nothing is sold in this fixture.
		authorStakeOriginal: "10.000000000000000000",
		authorSold: false,
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
			onEnter={noop}
			onOpenPopup={noop}
			onOpenImage={noop}
			onReplyToPost={noopReply}
			heldSide={null}
			marketOpen
			suspended={false}
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

	it("post-card::Know-more-replaces-the-plus-glyph", () => {
		// ⚠ ROW 24 REVERSES R4, and the superseded assertion is recorded rather
		// than silently swapped. R4 (2026-08-12) ruled `<Plus /> Full` → a
		// `Read more` TEXT LINK and removed the glyph outright. The founder ruling
		// of 2026-08-16 reverses it: the glyph returns, `Read more` goes.
		//
		// ⚠⚠ AND UI-QUICK CHANGE SET 1 REVERSES *THAT* — the glyph becomes the
		// text control `Know more`. This assertion read:
		//   const plus = buttons.find(b => b.getAttribute("aria-label") === "Show more");
		//   expect(plus?.innerHTML).toContain("+");
		// ⛔ THE THIRD LABEL JOINS THE PINNED-AS-GONE LIST rather than replacing
		// it. `Read more` and `Full` were already pinned absent so a card
		// rendering BOTH forms could not pass; `+` now sits beside them for the
		// same reason. The guard covers strictly more shapes than before.
		const { container } = renderCard();
		const buttons = buttonsIn(container);

		const knowMore = buttons.find((b) => b.innerHTML.includes("Know more"));
		expect(knowMore).toBeDefined();

		// Every superseded form pinned as gone.
		expect(buttons.some((b) => b.innerHTML.includes("Read more"))).toBe(false);
		expect(buttons.some((b) => b.innerHTML.includes("Full"))).toBe(false);
		expect(buttons.some((b) => b.innerHTML.trim() === "+")).toBe(false);
		expect(
			buttons.some((b) => b.getAttribute("aria-label") === "Show more"),
		).toBe(false);
	});

	it("post-card::the-download-placeholder-sits-left-of-Know-more-and-is-inert", () => {
		// UI-QUICK change set 1 item 5. ⛔ A PLACEHOLDER THAT READS AS A WORKING
		// CONTROL IS THE DEFECT — it must be inert to the pointer, inert to the
		// keyboard, and announced as unavailable, or it promises a download this
		// build cannot perform.
		const { container } = renderCard();

		const download = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Download post image"]',
		);
		expect(download).not.toBeNull();
		expect(download?.disabled).toBe(true);
		expect(download?.getAttribute("aria-disabled")).toBe("true");
		// No handler and no navigation — a placeholder with an href would be a
		// working control wearing a disabled costume.
		expect(download?.getAttribute("href")).toBeNull();

		// ⚠ ORDER IS PART OF THE ASK ("to the LEFT of Know more, same row"), and
		// DOM order is what a screen reader and the Tab sequence both follow.
		// `compareDocumentPosition` reads the real tree rather than a class string.
		const knowMore = buttonsIn(container).find((b) =>
			b.innerHTML.includes("Know more"),
		);
		expect(knowMore).toBeDefined();
		expect(
			(download as HTMLElement).compareDocumentPosition(
				knowMore as HTMLElement,
			) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("post-card::Know-more-carries-a-2.5.3-compliant-name-and-keeps-the-tokens", () => {
		// ⚠ THE ACCESSIBILITY ARGUMENT INVERTED WITH THE CONTROL, which is why
		// this is not simply "R4 undone". R4 dropped the `aria-label` DELIBERATELY:
		// "Read the full argument" does not CONTAIN the visible text "Read more",
		// and an accessible name that omits its visible label fails WCAG 2.5.3
		// (Label in Name). A GLYPH has no visible label, so 2.5.3 does not apply
		// and an `aria-label` becomes REQUIRED rather than forbidden — the concern
		// is answered, not dismissed.
		//
		// ⚠⚠ AND IT INVERTS ONCE MORE AT UI-QUICK CHANGE SET 1. The control has
		// visible text again, so 2.5.3 applies again — and the label
		// BYTE-CARRIED from `d5:1077` ("Show more") becomes a FAILURE, because a
		// button reading `Know more` cannot be named `Show more`. This used to
		// assert `aria-label === "Show more"`; it now asserts the strictly
		// stronger property that the name CONTAINS the visible string, which is
		// the actual WCAG rule rather than one hard-coded instance of it.
		const { container } = renderCard();

		const knowMore = buttonsIn(container).find((b) =>
			b.innerHTML.includes("Know more"),
		);
		expect(knowMore).toBeDefined();
		const label = knowMore?.getAttribute("aria-label") ?? "";
		expect(label).toContain("Know more");

		// The ported tokens survive the control swap (Ruling A / H-HEX — a raw hex
		// here also reddens `no-raw-hex-view-layer`).
		const className = knowMore?.getAttribute("class") ?? "";
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
				onEnter={onEnter}
				onOpenPopup={onOpenPopup}
				onOpenImage={noop}
				onReplyToPost={noopReply}
				heldSide={null}
				marketOpen
				suspended={false}
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

	it("post-card::row-6-the-title-hovers-highlighted-AND-underlined", () => {
		// HTML-FINISH · MARKET DETAIL round 2 · R6. The title is the card's primary
		// navigation and had no hover state at all.
		//
		// ⛔ BOTH HALVES ARE ASSERTED, and that is the point of the row: the founder
		// asked for highlighted AND underlined, and a build that shipped only the
		// underline (the Profile title's own pattern, the obvious half to reach for)
		// would look finished and be half the ruling. Two assertions, not one.
		//
		// ⚠ Asserted on the ATTRIBUTE, never on computed style: jsdom performs no
		// layout and resolves no Tailwind, so `getComputedStyle` here would report
		// the absence of everything and pass a component that shipped nothing (O-7's
		// genus — assert on the markup that carries the meaning).
		const { container } = render(
			<PostCard
				post={presentPost()}
				onEnter={noop}
				onOpenPopup={noop}
				onOpenImage={noop}
				onReplyToPost={noopReply}
				heldSide={null}
				marketOpen
				suspended={false}
			/>,
		);

		const title = container.querySelector("h3")?.closest("button");
		expect(title).not.toBeNull();
		const cls = title?.getAttribute("class") ?? "";
		expect(cls.split(/\s+/)).toContain("hover:bg-n1");
		expect(cls.split(/\s+/)).toContain("hover:underline");

		// ⛔ THE HIGHLIGHT IS THE RAMP TOKEN, NOT A PORTED MOCKUP VALUE. d5's
		// `.rtt:hover` is `background:var(--n1)` on a LIGHT ramp; carrying the raw
		// hex or a literal radius would be the H1-c/H3-b class this task forbids.
		expect(cls).not.toContain("#");
		expect(cls).not.toContain("[4px]");

		// ⛔ NO LAYOUT MOVED. d5 pads the highlight (`padding:0 3px;margin:0 -3px`)
		// and those are values; this row adds no padding at all, so a future edit
		// that quietly introduces one is caught here rather than on staging.
		for (const c of cls.split(/\s+/)) {
			expect(
				/^-?[pm][xy]?-/.test(c),
				`title carries no spacing class: ${c}`,
			).toBe(false);
		}
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
				onEnter={onEnter}
				onOpenPopup={noop}
				onOpenImage={noop}
				onReplyToPost={noopReply}
				heldSide={null}
				marketOpen
				suspended={false}
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
			// RANK-1 — the substrate stake is SURVIVING basis; nothing is sold in this fixture.
			stakeOriginal: "10.000000000000000000",
			sold: false,
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
				onEnter={noop}
				onOpenPopup={noop}
				onOpenImage={noop}
				onReplyToPost={noopReply}
				heldSide={null}
				marketOpen
				suspended={false}
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
				onEnter={noop}
				onOpenPopup={noop}
				onOpenImage={noop}
				onReplyToPost={noopReply}
				heldSide={null}
				marketOpen
				suspended={false}
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

/**
 * UI-OVERNIGHT entry 5 — `Know more` renders only where there IS more, and the
 * gutter it sits in is reserved only when it does.
 *
 * ⛔ WHAT THE CONTROL PROMISED AND COULD NOT KEEP. Every card carried one
 * unconditionally, and a post whose author typed a title and nothing else has
 * no second paragraph — so the pop-up it opened held the sentence the reader
 * had just read. The cost of that is not the wasted click; it is that a reader
 * who learns the control is empty stops using it on the posts where it is full.
 *
 * ⚠ THE PREDICATE IS `hasExtendedText(body)`, NOT `teaser !== ""`. The composer
 * writes `title\n\nextended` and the server derives `teaser` back out of it, so
 * the body is the field that decides and the teaser is downstream of it.
 */
describe("UI-OVERNIGHT 5 — Know more is presence-driven", () => {
	function cardWithBody(body: string) {
		// ⚠ NARROWED, NOT CAST. `presentPost()` is typed `DebatePost` — the
		// masking union — and the removed variant carries no `body` at all, which
		// is the SC-1 guarantee working rather than a nuisance.
		const base = presentPost();
		const post: DebatePost = base.removed ? base : { ...base, body };
		return render(
			<PostCard
				post={post}
				onEnter={noop}
				onOpenPopup={noop}
				onOpenImage={noop}
				onReplyToPost={noopReply}
				heldSide={null}
				marketOpen
				suspended={false}
			/>,
		);
	}

	const hasKnowMore = (container: HTMLElement) =>
		buttonsIn(container).some((b) => b.innerHTML.includes("Know more"));

	it("post-card::a-title-only-post-renders-NO-Know-more", () => {
		const { container } = cardWithBody("Fixture argument title.");
		expect(hasKnowMore(container)).toBe(false);
		// Non-vacuity: the card rendered, and its title is intact.
		expect(container.innerHTML).toContain("Fixture argument title.");
	});

	it("post-card::a-whitespace-only-description-counts-as-none", () => {
		// The brief's wording: non-empty AFTER TRIMMING. A body ending in a blank
		// paragraph of spaces is a title-only post that happens to have a stray
		// keystroke in it.
		const { container } = cardWithBody("Fixture argument title.\n\n   \n");
		expect(hasKnowMore(container)).toBe(false);
	});

	it("post-card::a-post-WITH-a-description-still-renders-it", () => {
		// The positive control. Without it every assertion above passes on a card
		// that lost the control for some unrelated reason.
		const { container } = cardWithBody(
			"Fixture argument title.\n\nFixture extended text.",
		);
		expect(hasKnowMore(container)).toBe(true);
	});

	it("post-card::a-description-equal-to-the-title-still-counts-as-present", () => {
		// Stated in the brief, and it falls out of the rule rather than needing a
		// case: the predicate asks whether a second paragraph EXISTS, never what
		// it says. An author who repeats themselves has still written one.
		const { container } = cardWithBody(
			"Fixture argument title.\n\nFixture argument title.",
		);
		expect(hasKnowMore(container)).toBe(true);
	});

	it("post-card::the-title-gutter-is-reserved-only-when-the-control-is-there", () => {
		// ⚠ THE HALF THAT IS NOT THE BUTTON. `pr-21` exists to keep the title clear
		// of the OVERLAID control; with no control it was 84px of width taken off
		// every title-only card for a neighbour that never arrives. The brief:
		// "no button and no reserved space — the title row uses the full width".
		const withMore = cardWithBody(
			"Fixture argument title.\n\nFixture extended text.",
		);
		const titleOnly = cardWithBody("Fixture argument title.");
		const titleButton = (c: HTMLElement) =>
			Array.from(c.querySelectorAll("button")).find(
				(b) => b.querySelector("h3") !== null,
			);
		expect(
			(titleButton(withMore.container)?.getAttribute("class") ?? "").split(
				/\s+/,
			),
		).toContain("pr-21");
		expect(
			(titleButton(titleOnly.container)?.getAttribute("class") ?? "").split(
				/\s+/,
			),
		).not.toContain("pr-21");
	});
});
