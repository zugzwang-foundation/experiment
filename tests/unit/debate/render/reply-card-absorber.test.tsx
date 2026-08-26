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
		expect(
			found[0]?.querySelector('[data-testid="post-image-placeholder"]'),
		).not.toBeNull();
	});

	it("reply-card-absorber::WITH-an-image-a-descendant-absorbs-too", () => {
		const found = absorbers(
			card(presentReply("https://example.invalid/r.png")).container,
		);
		expect(found.length).toBeGreaterThan(0);
	});

	it("reply-card-absorber::the-empty-cell-holds-the-placeholder-and-the-full-one-holds-the-image", () => {
		const empty = card(presentReply(null)).container;
		expect(
			empty.querySelector('[data-testid="post-image-placeholder"]'),
		).not.toBeNull();
		expect(empty.querySelector("img")).toBeNull();
		cleanup();

		const full = card(presentReply("https://example.invalid/r.png")).container;
		expect(full.querySelector("img")).not.toBeNull();
		// ⛔ Not BOTH — a card drawing a placeholder behind a real attachment would
		// be two slots where the layout expects one.
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
});
