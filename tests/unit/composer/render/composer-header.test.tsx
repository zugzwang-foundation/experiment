// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BetComposer } from "@/components/debate/composer/BetComposer";
import { COMPOSER_COPY } from "@/components/debate/composer/copy";

import { composerProps, stubWireFetch } from "./_harness";

/**
 * RPLY-1 · R4a + G6 — THE TWO COMPOSER HEADERS ARE ONE ELEMENT, AND THE THIRD
 * STATE SURVIVES.
 *
 * ⚠⚠ WHAT WAS WRONG. The reply variant rendered a two-child flex COLUMN whose
 * first child was `text-[13.5px] leading-snug font-bold` and whose second was
 * the parent post's FULL title, unclamped and with no ellipsis. The fresh-post
 * variant was a single leaf span at `text-sm font-semibold`. Two type
 * treatments and one extra line of copy, on a panel whose height R3 had just
 * spent a whole slice defending.
 *
 * ⛔⛔ THE THIRD STATE IS WHY THIS FILE EXISTS AND NOT JUST A CLASS ASSERTION.
 * `replyContext.authorPseudonym === null` means the PARENT IS REMOVED — masked
 * server-side, no author and no title at the type level (SG-3) — and the header
 * falls back to the canon `Place your Đ BET` line on a composer that is still
 * `kind="reply"`. That branch is deliberate masking, and it sits inside the
 * exact ternary R4a rewrites. A subtitle removal that collapsed the condition
 * would have taken it with it and started rendering a removed author's name, or
 * an empty possessive, with nothing else in the suite to notice.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const PSEUDONYM = "AmberFinch404";
const PARENT_TITLE = "The corridor is built for this volume";

/** The header text node — the span beside the side chip, before the ×. */
function headerSpan(container: HTMLElement): HTMLElement {
	const modhead = container.querySelector("section > div");
	const span = Array.from(modhead?.querySelectorAll("span") ?? []).find(
		(s) =>
			(s.textContent ?? "").includes("argument") ||
			(s.textContent ?? "").includes(COMPOSER_COPY.header),
	);
	if (span === undefined) {
		throw new Error("no composer header span");
	}
	return span;
}

function renderPost() {
	stubWireFetch([]);
	return render(<BetComposer {...composerProps()} />);
}

function renderReply(authorPseudonym: string | null) {
	stubWireFetch([]);
	return render(
		<BetComposer
			{...composerProps()}
			kind="reply"
			parentCommentId="cmt-p1"
			replyContext={{ relation: "support", authorPseudonym }}
		/>,
	);
}

describe("R4a — the reply header matches the fresh-post header", () => {
	it("composer-header::the-two-variants-render-the-SAME-classes", () => {
		const post = headerSpan(renderPost().container).getAttribute("class");
		cleanup();
		const reply = headerSpan(renderReply(PSEUDONYM).container).getAttribute(
			"class",
		);

		// ⛔ THE ASSERTION THIS FILE EXISTS FOR. Before R4a the reply header was
		// `text-[13.5px] leading-snug font-bold` inside a flex column and the post
		// header was `text-sm font-semibold` — they could not have matched.
		expect(reply).toBe(post);
		// Non-vacuity: a class string was actually read, not two nulls agreeing.
		expect(post).toContain("text-sm");
		expect(post).toContain("font-semibold");
	});

	it("composer-header::the-reply-header-is-a-LEAF-span-not-a-stacked-column", () => {
		// ⚠ Asserted on STRUCTURE, not on `textContent`: a row and a column flatten
		// to the same text, so a text assertion cannot see this change at all
		// (OVN-V6). What changed is that the header stopped having children.
		const span = headerSpan(renderReply(PSEUDONYM).container);
		expect(span.children.length).toBe(0);
		expect(span.textContent).toBe(`Support ${PSEUDONYM}'s argument`);
	});

	it("composer-header::the-parent-title-SUBTITLE-is-gone", () => {
		// The positive control comes first: the header IS present and does name the
		// relation and the author, so the absence below is about the subtitle
		// rather than about a component that failed to render.
		const { container } = renderReply(PSEUDONYM);
		expect(container.innerHTML).toContain(`Support ${PSEUDONYM}'s argument`);
		// ⛔ And the parent's title is nowhere in the composer — the prop that
		// carried it was removed, so this cannot come back by a styling change.
		expect(container.innerHTML).not.toContain(PARENT_TITLE);
	});

	it("composer-header::the-relation-is-still-NAMED", () => {
		// design-canon §6 ratifies this wording, and once the composer is open it
		// is the only place the relation appears — the side chip beside it names
		// the SIDE, which is a different fact. R4a shrinks the type; it must not
		// quietly drop the word.
		expect(headerSpan(renderReply(PSEUDONYM).container).textContent).toContain(
			"Support",
		);
		cleanup();
		stubWireFetch([]);
		const counter = render(
			<BetComposer
				{...composerProps()}
				kind="reply"
				parentCommentId="cmt-p1"
				replyContext={{ relation: "counter", authorPseudonym: PSEUDONYM }}
			/>,
		);
		expect(headerSpan(counter.container).textContent).toContain("Counter");
	});
});

describe("G6 — the masked-parent fallback survives R4a", () => {
	it("composer-header::a-MASKED-parent-falls-back-to-the-canon-header", () => {
		// ⛔⛔ THE MASKING BRANCH. A removed parent has no author at the type level,
		// so the header cannot name one and must not invent one.
		const { container } = renderReply(null);
		expect(headerSpan(container).textContent).toBe(COMPOSER_COPY.header);
	});

	it("composer-header::the-masked-fallback-happens-on-a-kind-reply-composer", () => {
		// ⚠ THE HALF THAT IS EASY TO LOSE. The fallback must not be reached by the
		// composer silently becoming a POST composer — it is still a reply, still
		// carrying its parent id onto the wire, and only its HEADING degrades.
		// Asserting the header alone would pass if `kind` had flipped.
		const { container } = renderReply(null);
		expect(headerSpan(container).textContent).toBe(COMPOSER_COPY.header);
		// The reply floor is what the composer seeds its amount from, so it is
		// observable evidence of `kind` from the render alone.
		const amount = container.querySelector<HTMLInputElement>(
			'[aria-label="Stake amount"]',
		);
		expect(amount?.getAttribute("value")).toBe("50");
	});

	it("composer-header::a-masked-parent-leaks-NO-author-and-NO-title", () => {
		// SC-1 shape: assert the CONTENT's absence, not merely that a branch was
		// taken. Neither field can even be passed now, and this is the belt.
		const { container } = renderReply(null);
		expect(container.innerHTML).not.toContain(PSEUDONYM);
		expect(container.innerHTML).not.toContain(PARENT_TITLE);
		expect(container.innerHTML).not.toContain("'s argument");
	});
});
