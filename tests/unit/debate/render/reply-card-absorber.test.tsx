// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReplyCard } from "@/components/debate/ReplyCard";
import type { DebateReply } from "@/components/debate/types";

/**
 * RPLY-1 · R6 · G8 — THE REPLY CARD HAS SOMETHING ABLE TO TAKE UP ITS SLACK.
 *
 * ⚠⚠ WHY THERE WAS DEAD SPACE, because "add some padding" is the wrong fix and
 * the right one is not obvious. `ReplyCard`'s root is `min-h-0 flex-1`
 * DELIBERATELY — d5's `.rpanel{flex:1 1 auto}` — so the post arm's arena renders
 * as a filled two-column band instead of two short boxes floating at the top of
 * their columns. But all three of its children were content-sized, and in a
 * stretched `flex-col` every pixel of leftover height lands AFTER the last
 * child. Nothing inside the card could grow, so the growth went to the bottom.
 *
 * ⛔ `PostCard` never had the problem because it has TWO absorbers this card
 * lacks: an explicit image CELL (`flex min-h-0 flex-1 items-center
 * justify-center`) and an `AggregateFooter` pinned at the foot. R6 gives this
 * card the FIRST one and deliberately not the second — a reply has no replies
 * (`REPLY_DEPTH_MAX = 1`) and there is no split bar on the reply path, so both
 * of the things the founder asked to leave out were already absent.
 *
 * ⛔⛔ THE FAILING SHAPE THIS REJECTS: a card whose only `flex-1` is its ROOT.
 * That is precisely the state before R6 — the root stretched and nothing inside
 * it did. So the assertion is not "an image renders"; it is "**some descendant
 * can absorb**", which is the property, and it is checked on both the
 * with-image and without-image paths because the empty path is the common one.
 *
 * ⚠ jsdom performs no layout, so this cannot measure a gap. What it CAN do is
 * assert the structure that removes it, and assert it on the rendered DOM rather
 * than by reading the source — a source scan could not tell which BRANCH the
 * cell landed in, and the removed branch must not get one.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const noop = () => undefined;
const noopPopup = () => undefined;

function presentReply(imageUrl: string | null): DebateReply {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-00000000db01",
		side: "YES",
		createdAt: "2026-07-30T00:00:00.000Z",
		body: "Fixture reply body.",
		marker: "none",
		author: { pseudonym: "fixture-replier", pfpUrl: "" },
		stake: "10.000000000000000000",
		stakeOriginal: "10.000000000000000000",
		sold: false,
		entryPrice: "0.500000000000000000",
		imageUrl,
	};
}

const removedReply: DebateReply = {
	removed: true,
	id: "0199a0c0-0000-7000-8000-00000000db02",
	side: "NO",
	createdAt: "2026-07-30T00:00:00.000Z",
};

function card(reply: DebateReply) {
	return render(
		<ReplyCard reply={reply} onOpenImage={noop} onOpenPopup={noopPopup} />,
	);
}

/** The card root — the outermost element the component renders. */
function root(container: HTMLElement): HTMLElement {
	const el = container.firstElementChild;
	if (el === null) {
		throw new Error("ReplyCard rendered nothing");
	}
	return el as HTMLElement;
}

/** Descendants (excluding the root) declaring `flex-1` — the absorbers. */
function absorbers(container: HTMLElement): Element[] {
	return Array.from(root(container).querySelectorAll("*")).filter((el) =>
		(el.getAttribute("class") ?? "").split(/\s+/).includes("flex-1"),
	);
}

describe("R6 — the reply card can absorb its own leftover height", () => {
	it("reply-card-absorber::the-ROOT-still-stretches", () => {
		// The premise, asserted so the rest is not about a card that simply stopped
		// filling its column — which would "fix" the gap by reintroducing the two
		// short floating boxes `.rpanel` exists to prevent.
		const cls = root(card(presentReply(null)).container).getAttribute("class");
		expect(cls?.split(/\s+/)).toContain("flex-1");
		expect(cls?.split(/\s+/)).toContain("min-h-0");
	});

	it("reply-card-absorber::WITHOUT-an-image-a-descendant-absorbs", () => {
		// ⛔ THE ASSERTION THIS FILE EXISTS FOR, on the common path. Before R6 this
		// count was 0: the root stretched and nothing inside it could.
		const { container } = card(presentReply(null));
		const found = absorbers(container);
		expect(found.length).toBeGreaterThan(0);
		// …and the absorber is the image cell, centring what it holds.
		const cell = found[0]?.getAttribute("class")?.split(/\s+/) ?? [];
		expect(cell).toContain("min-h-0");
		expect(cell).toContain("items-center");
		expect(cell).toContain("justify-center");

		// ⛔⛔ AND IT IS A DIRECT CHILD OF THE FLEX ROOT, WHICH IS THE HALF THAT WAS
		// MISSING. `flex-1` on an element does NOTHING unless its PARENT is the
		// flex container distributing the space. @test-writer measured the hole:
		// wrapping this cell in a plain `<div className="block">` leaves the class
		// present, the guard 6/6 green, and the dead space fully restored. A class
		// is not a mechanism, and jsdom cannot see the difference — so the
		// structural relationship is asserted instead of inferred from the class.
		expect(found[0]?.parentElement).toBe(root(container));
		// …and the root really is a flex COLUMN, or "direct child" would still not
		// mean the space is distributed down this axis.
		const rootCls = root(container).getAttribute("class")?.split(/\s+/) ?? [];
		expect(rootCls).toContain("flex");
		expect(rootCls).toContain("flex-col");

		// The absorber is the IMAGE cell specifically, not merely some element that
		// happens to carry `flex-1` — `found[0]` is DOM-order dependent on its own.
		// ⚠ IDENTIFIED BY ITS OWN CLASS SET since QUOTE-1 A, which stripped the
		// placeholder this used to look inside for. The cell did not move; only the
		// thing it contained did, so the guard follows the cell.
		const foundCls = found[0]?.getAttribute("class")?.split(/\s+/) ?? [];
		expect(foundCls).toContain("items-center");
		expect(foundCls).toContain("justify-center");
	});

	it("reply-card-absorber::WITH-an-image-a-descendant-absorbs-too", () => {
		const found = absorbers(
			card(presentReply("https://example.invalid/r.png")).container,
		);
		expect(found.length).toBeGreaterThan(0);
	});

	it("reply-card-absorber::the-empty-cell-holds-NOTHING-and-the-full-one-holds-the-image", () => {
		// ⚠ THE FIRST HALF IS INVERTED BY QUOTE-1 A; THE SECOND IS UNTOUCHED. The
		// empty cell used to hold the `POST IMAGE` box and now holds nothing, so
		// what is asserted is the cell's EMPTINESS rather than its absence — the
		// cell itself is R6's absorber and must survive.
		const empty = card(presentReply(null)).container;
		const emptyCell = empty.querySelector(
			".flex-1.items-center.justify-center",
		);
		expect(emptyCell).not.toBeNull();
		expect(emptyCell?.innerHTML).toBe("");
		expect(
			empty.querySelector('[data-testid="post-image-placeholder"]'),
		).toBeNull();
		expect(empty.querySelector("img")).toBeNull();
		cleanup();

		const full = card(presentReply("https://example.invalid/r.png")).container;
		expect(full.querySelector("img")).not.toBeNull();
		// ⛔ Not BOTH — a card drawing a placeholder behind a real attachment would
		// be two slots where the layout expects one. Trivially true since the strip;
		// kept because QUOTE-1 C puts a node back into this arm.
		expect(
			full.querySelector('[data-testid="post-image-placeholder"]'),
		).toBeNull();
	});

	it("reply-card-absorber::a-REMOVED-reply-gets-NO-cell-and-NO-placeholder", () => {
		// ⛔⛔ MASKING, NOT LAYOUT. `PostCard` records the reasoning for its own
		// path: an image box beside a withheld argument announces that the withheld
		// argument HAD an attachment. ⚠ The type system does not carry this one —
		// the removed branch is a separate early return, and R6 added an `else`
		// arm, which needs no field at all. So it is asserted.
		const { container } = card(removedReply);
		expect(
			container.querySelector('[data-testid="post-image-placeholder"]'),
		).toBeNull();
		expect(container.querySelector("img")).toBeNull();
		expect(absorbers(container).length).toBe(0);
		// Non-vacuity: the removed card DID render its own structural slot.
		expect(container.innerHTML).toContain("NO");
	});
});

describe("RPLY-3 · R2 — the reply card is a post card minus the split bar", () => {
	/**
	 * The card's direct children, named by what they carry. The names are the
	 * ANATOMY, so the ordering assertion below reads as the founder's sentence
	 * rather than as index arithmetic.
	 */
	function anatomy(container: HTMLElement): string[] {
		return Array.from(root(container).children).map((el) => {
			// ⚠ THE IMAGE CELL IS IDENTIFIED BY ITS OWN CLASS FIRST, and `img` is
			// only a fallback INSIDE that. The first draft asked `querySelector("img")`
			// before anything else, which would classify the PROFILE ROW as the image
			// cell the moment `ArgProfile`'s avatar mounted an `<img>`. It happens not
			// to today — Radix's `AvatarImage` never resolves a load in jsdom — so the
			// guard was correct by accident of the harness rather than by rule, and the
			// accident would end silently. Caught by `@code-reviewer` (LOW).
			const cls = (el.getAttribute("class") ?? "").split(/\s+/);
			if (cls.includes("flex-1") && cls.includes("justify-center")) {
				return "IMAGE-CELL";
			}
			if (el.querySelector("p") !== null) {
				return "BODY";
			}
			return "PROFILE-ROW";
		});
	}

	it("reply-card-absorber::G5-the-body-comes-BEFORE-the-image-just-as-the-post-title-does", () => {
		// ⛔⛔ THE MEASURED MISMATCH THIS FIXES, which RPLY-1 · R6 did not address
		// because R6 was about the CELL and not about where it sat:
		//     PostCard   profile row → title → image cell → split bar
		//     ReplyCard  profile row → image → body                (no split bar)
		// Founder: "it should be exactly like posts — only the S/C bar is removed
		// and hence the image is enlarged." Two cards in two different reading
		// orders is not "exactly like".
		//
		// ⚠ THE MAPPING IS TITLE→BODY, AND THE FILE ITSELF LICENSES IT: a reply
		// has no separate title, so its BODY *is* its title (`deriveTitleTeaser`
		// is a post-only derivation). `PostCard`'s title slot is therefore this
		// card's body row.
		//
		// ⛔ ASSERTED ON THE RENDERED DOM, NOT ON THE SOURCE. A source scan would
		// compare the order of two JSX blocks in a file and could not tell which
		// BRANCH they landed in — and the removed branch must have neither.
		expect(anatomy(card(presentReply(null)).container)).toEqual([
			"PROFILE-ROW",
			"BODY",
			"IMAGE-CELL",
		]);
	});

	it("reply-card-absorber::G5-the-order-holds-on-the-WITH-image-path-too", () => {
		// The empty path is the common one and the one above; this is the path
		// where a real attachment could plausibly have been special-cased.
		expect(
			anatomy(card(presentReply("https://example.invalid/r.png")).container),
		).toEqual(["PROFILE-ROW", "BODY", "IMAGE-CELL"]);
	});

	it("reply-card-absorber::G5-the-image-cell-is-the-LAST-child-so-the-slack-falls-at-the-foot", () => {
		// ⚠⚠ WHAT "hence the image is enlarged" ACTUALLY MEANS HERE, stated
		// because the honest answer is not the flattering one. This cell is the
		// card's ONLY `flex-1`, so it ALREADY took every leftover pixel — including
		// the ones `PostCard` spends on its `AggregateFooter`. MEASURED before and
		// after the reorder in a real browser: the cell is 360.01px in both, and
		// the card is 493.24px in both. The reorder does not enlarge it; the
		// absence of a split bar already had. What the reorder changes is WHERE
		// the leftover sits — at the card's foot, as on a post, instead of in its
		// middle.
		// ⇒ So the assertion is placement, not size, because size is what was
		// already true and placement is what moved.
		// ⚠ THE CELL IS IDENTIFIED BY WHAT IT IS, NOT BY WHAT IT HELD. This read
		// `last.querySelector('[data-testid="post-image-placeholder"]')` until
		// QUOTE-1 A stripped that box — which would have made a PLACEMENT guard
		// fail for a reason that has nothing to do with placement. The cell is the
		// thing under test and it is still here; the identification moves onto the
		// class set this file already uses for it in `absorbers` above.
		const { container } = card(presentReply(null));
		const kids = Array.from(root(container).children);
		const last = kids[kids.length - 1];
		const cls = last?.getAttribute("class")?.split(/\s+/) ?? [];
		expect(cls).toContain("flex-1");
		expect(cls).toContain("items-center");
		expect(cls).toContain("justify-center");
		// …and it is EMPTY on this path, which is the QUOTE-1 A half: the cell
		// absorbs, and it absorbs nothing.
		expect(last?.innerHTML).toBe("");
	});

	it("reply-card-absorber::G5-the-image-cell-and-its-contents-are-PostCard-s-chrome-verbatim", () => {
		// ⛔ "the image renders in the same chrome as PostCard's" — verified
		// rather than rebuilt. Both files declare the SAME cell class string and
		// mount the SAME two components with the SAME `fill` prop, so this is a
		// check that reported "already true" rather than an edit. Read out of
		// `PostCard.tsx` itself, so a change there reddens here instead of the two
		// drifting silently apart — which is exactly what happened to the card
		// heads before row 26 made them one component.
		const post = readFileSync(
			join(process.cwd(), "src/components/debate/PostCard.tsx"),
			"utf8",
		);
		const CELL =
			'<div className="flex min-h-0 flex-1 items-center justify-center">';
		expect(post).toContain(CELL);
		expect(
			readFileSync(
				join(process.cwd(), "src/components/debate/ReplyCard.tsx"),
				"utf8",
			),
		).toContain(CELL);
		// ⚠ MATCHED AS PROP SYNTAX, never the bare word `fill` — which appears in
		// prose all over both files.
		expect(post).toMatch(/<CommentImage[^>]*\sfill\s*\/>/);
		// ⛔ AND THE PLACEHOLDER MOUNT IS PINNED ABSENT, WHICH IS THE INVERSION OF
		// WHAT THIS LINE USED TO ASSERT. It read `toContain("<PostImagePlaceholder
		// fill />")`; QUOTE-1 A removed that mount, so the assertion flips rather
		// than disappearing — a re-mount still reddens here.
		// ⚠ MATCHED AS JSX-OPEN SYNTAX, never the bare identifier: `PostCard.tsx`
		// names the component in a comment explaining the strip, and a bare-word
		// negative would catch the explanation of the absence rather than the
		// absence. That failure mode has cost this repo six guards.
		expect(post).not.toContain("<PostImagePlaceholder");
	});
});

describe("R6 — the founder's two exclusions were already true", () => {
	const source = readFileSync(
		join(process.cwd(), "src/components/debate/ReplyCard.tsx"),
		"utf8",
	);

	it("reply-card-absorber::no-reply-COUNT-and-no-SPLIT-BAR-on-a-reply", () => {
		// "exactly like the post view, just without the replies counter and the S/C
		// bar" — both were ALREADY absent, which is why the image cell is the whole
		// change rather than the first of three. Pinned so a later "parity with
		// PostCard" pass does not helpfully add them.
		// ⛔ A reply has no replies (`REPLY_DEPTH_MAX = 1`), so a count would render
		// a zero that means nothing.
		const { container } = card(presentReply(null));
		expect(container.innerHTML).not.toContain("Replies ·");
		expect(source).not.toContain("<AggregateFooter");
		// ⚠ MATCHED AS `replyCount=`, THE PROP SYNTAX — never the bare word. The
		// file carries a comment explaining WHY the count is omitted, and that
		// comment necessarily names it; a bare-substring negative went red against
		// its own explanation on the first run. This is the third time in this
		// task that a textual negative caught the prose describing it, which is a
		// pattern worth naming: a guard that forbids MENTIONING the thing it
		// guards will eventually be "fixed" by deleting the explanation, and the
		// explanation is the part worth keeping.
		expect(source).not.toContain("replyCount=");
		// Positive control: the `ArgProfile` head this card DOES share with the
		// post card is present, so the absences above are about the two named
		// pieces and not about a card that renders no head at all.
		expect(source).toContain("<ArgProfile");
		expect(container.innerHTML).toContain("fixture-replier");
	});

	it("reply-card-absorber::G6-RPLY-3-and-the-post-card-DOES-have-both-so-the-absence-means-something", () => {
		// ⛔⛔ THE CONTROL THAT MAKES G6 NON-VACUOUS, and RPLY-3 · R2 is exactly
		// the task that needs it. "Only the S/C bar is removed" is a claim about
		// a DIFFERENCE between two cards; a guard that only reads one of them
		// would stay green if `PostCard` quietly lost its footer too, at which
		// point the two would still match and the sentence would still be false.
		// ⚠ MATCHED AS ELEMENT AND PROP SYNTAX, never bare words: both files
		// discuss `AggregateFooter` and `replyCount` at length in prose, and a
		// bare-substring assertion here would be reading the commentary.
		const post = readFileSync(
			join(process.cwd(), "src/components/debate/PostCard.tsx"),
			"utf8",
		);
		expect(post).toContain("<AggregateFooter");
		expect(post).toContain("replyCount={replyCount}");
		// …and the reply card has neither. (`source` is `ReplyCard.tsx`.)
		expect(source).not.toContain("<AggregateFooter");
		expect(source).not.toContain("replyCount=");
	});
});
