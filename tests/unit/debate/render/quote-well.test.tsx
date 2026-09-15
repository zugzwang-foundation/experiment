// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PostCard } from "@/components/debate/PostCard";
import { PostFocusHeader } from "@/components/debate/PostFocusHeader";
import {
	GEIST_QUOTE_INK,
	GEIST_QUOTE_TOP,
	GEIST_QUOTE_TOP_CLOSE,
	QUOTE_CANVAS,
	QUOTE_TYPE,
	quoteMarkSize,
	quoteTitleSize,
} from "@/components/debate/quote-well/size";
import { ReplyCard } from "@/components/debate/ReplyCard";
import type {
	DebateMarketHeader,
	DebatePost,
	DebateReply,
	ReplyGroups,
} from "@/components/debate/types";

/**
 * QUOTE-1 C — THE TITLE-AS-QUOTATION WELL, AT ITS ONE MOUNT (design-canon
 * `C-QUOTE-1`, SPEC.1 2.0.2, founder-ruled 2026-09-11).
 *
 * ⚠⚠ THE TRIGGER IS A CONJUNCTION AND EVERY ARM OF IT IS ASSERTED SEPARATELY.
 * Canon clause 1 admits the well on exactly one shape: a TOP-LEVEL post, PRESENT
 * (not removed), with NO image, on the MARKET-VIEW card. Four other shapes reach
 * a very similar slot — a reply card's own absorber cell, the post-focus hero, a
 * post WITH an attachment, a removed post — and each is pinned as NOT receiving
 * it. A guard that only proved the positive arm would pass a well mounted
 * everywhere.
 *
 * ⛔⛔ THE REMOVED ARM IS `SC-1` AND IS THE LOAD-BEARING ONE. The well PUBLISHES
 * THE TITLE — it is the masked content itself, at 56px, not a frame around it —
 * so a well on a removed post would be a removal leak rather than a layout bug.
 * ⚠ And the type system does not catch it: the removed union variant carries no
 * `title` field, but `PostCard`'s removed branch is an EARLY RETURN, and nothing
 * about adding an arm below one requires a field. `comment-image.test.tsx`
 * anticipated exactly this ("QUOTE-1 C puts content back into this slot, and
 * when it does, this is the test that says the removed branch must not receive
 * it"); this file asserts it for the well by name, on the BODY's absence rather
 * than the row's.
 *
 * ⚠ THE TITLE MUST APPEAR ONCE. Clause 2 deletes the plain title row on this arm
 * precisely so it does not — a well plus a row is the same sentence twice, and
 * the failure looks like a design choice rather than a bug.
 *
 * ⚠ CASE IS A DISPLAY TRANSFORM. The fixture title is deliberately mixed-case so
 * "the DOM keeps the stored case" is falsifiable: an implementation that
 * uppercased the STRING would still look right on screen and would break the
 * export, a copy-paste and a screen reader at once.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const noop = () => {};

const EMPTY_REPLIES: ReplyGroups = { support: [], counter: [], twoSlot: [] };
const AGGREGATE = {
	supportCount: 2,
	counterCount: 1,
	supportDharma: "1000.000000000000000000",
	counterDharma: "2000.000000000000000000",
};

/**
 * ⚠ MIXED CASE, AND THE LOWERCASE RUNS ARE THE ASSERTION'S SUBJECT — see the
 * docblock. Neutral fixture prose, no invented market content (CLAUDE.md §3).
 */
const TITLE = "Fixture argument title.";
const EXTENDED = `${TITLE}\n\nFixture extended text.`;

function presentPost(opts: {
	imageUrl: string | null;
	body?: string;
	title?: string;
}): DebatePost {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-00000000dc01",
		ordinal: 1,
		sideAtPostTime: "YES",
		createdAt: "2026-07-30T00:00:00.000Z",
		title: opts.title ?? TITLE,
		teaser: "Fixture extended text.",
		// The wire body is `title\n\nextended` and the server splits `teaser` back
		// out of it, so a fixture whose two fields disagree describes a post the
		// product cannot write (`composeWireBody` / `hasExtendedText`).
		body: opts.body ?? EXTENDED,
		imageUrl: opts.imageUrl,
		marker: "none",
		badge: null,
		author: { pseudonym: "fixture-author", pfpUrl: "" },
		authorStake: "10.000000000000000000",
		authorStakeOriginal: "10.000000000000000000",
		authorSold: false,
		entryPrice: "0.500000000000000000",
		aggregate: AGGREGATE,
		replies: EMPTY_REPLIES,
	};
}

const REMOVED_POST: DebatePost = {
	removed: true,
	id: "0199a0c0-0000-7000-8000-00000000dc02",
	ordinal: 2,
	sideAtPostTime: "NO",
	createdAt: "2026-07-30T00:00:00.000Z",
	aggregate: AGGREGATE,
	replies: EMPTY_REPLIES,
};

const MARKET: DebateMarketHeader = {
	id: "0190c0de-4444-7000-8000-000000000005",
	slug: "quote-well-fixture-market",
	title: "Fixture market question.",
	description: "Fixture resolution criterion.",
	status: "Open",
	mediaVideoUrl: null,
	mediaImageUrl: null,
	thumbImageUrl: null,
	pricing: { yes: "0.500000000000000000", no: "0.500000000000000000" },
	unitToWin: { yes: "1.960000000000000000", no: "1.960000000000000000" },
	totals: {
		dharmaStaked: "150.000000000000000000",
		postCount: 3,
		replyCount: 5,
	},
};

function card(post: DebatePost) {
	return render(
		<PostCard
			post={post}
			onEnter={noop}
			onOpenPopup={noop}
			onOpenImage={noop}
			onReplyToPost={noop}
			heldSide={null}
			marketOpen
			suspended={false}
		/>,
	);
}

/** The `.argimg` absorber cell, identified by its own class set (QUOTE-1 A). */
function cell(container: HTMLElement): Element | null {
	return container.querySelector(".flex-1.items-center.justify-center");
}

const IMG_URL = "https://example.invalid/post-attachment.png";

describe("QUOTE-1 C — the well is on the imageless present post card", () => {
	it("quote-well::an-imageless-present-post-draws-THE-WELL-in-the-cell", () => {
		const { container } = card(presentPost({ imageUrl: null }));

		const wells = container.querySelectorAll('[data-testid="quote-well"]');
		expect(wells.length).toBe(1);
		const well = wells[0] as Element;

		// ⛔ IN THE CELL, not merely on the card. The whole ruling is that the well
		// stands where the attachment would — a well rendered above the cell would
		// satisfy every other assertion in this test and be the wrong composition.
		const argimg = cell(container);
		expect(argimg).not.toBeNull();
		expect(argimg?.contains(well)).toBe(true);

		// The heading element the plain title row used, preserved so the document
		// outline does not change with whether a post happens to carry an image.
		const heading = container.querySelector('[data-testid="quote-well-title"]');
		expect(heading?.tagName).toBe("H3");
		expect(heading?.textContent).toBe(TITLE);

		// ⛔ RENDERED ONCE. A well plus a surviving title row is the same sentence
		// twice — that is the claim, and it is about what a reader SEES.
		// ⚠ MEASURED ON `textContent`, WHICH IS NOT AN O-7 RELAXATION. O-7 says
		// assert on `innerHTML` when the MARKUP carries the meaning; here the meaning
		// is "how many times is this string rendered", and `innerHTML` cannot answer
		// it — the button's `aria-label` puts a second, deliberate copy in the markup
		// that is not a second rendering. Both halves are therefore pinned: the
		// rendered count below, and the attribute's identity separately, so neither
		// can drift into the other's business.
		expect(container.textContent?.split(TITLE).length ?? 0).toBe(2); // n+1 splits
		const renderingTheTitle = Array.from(
			container.querySelectorAll("*"),
		).filter((el) => el.textContent === TITLE && el.children.length === 0);
		expect(renderingTheTitle.length).toBe(1);
		expect(renderingTheTitle[0]?.getAttribute("data-testid")).toBe(
			"quote-well-title",
		);

		// The one OTHER copy in the markup is the accessible name, and it is there on
		// purpose — see the click test below for why the SVG makes it necessary.
		expect(container.innerHTML.split(TITLE).length - 1).toBe(2);
		expect(
			container.querySelector(`button[aria-label="${TITLE}"]`),
		).not.toBeNull();

		// …and the case is the STORED case — the uppercase is CSS (clause 4).
		expect(container.innerHTML).toContain(TITLE);
		expect(container.innerHTML).not.toContain(TITLE.toUpperCase());

		// Both marks are decoration, announced to nobody.
		const marks = container.querySelectorAll('[data-testid="quote-well-mark"]');
		expect(marks.length).toBe(2);
		for (const mark of Array.from(marks)) {
			expect(mark.getAttribute("aria-hidden")).toBe("true");
		}

		// The well is a picture, not an attachment, and not d5's mockup box.
		expect(container.querySelector("img")).toBeNull();
		expect(container.innerHTML).not.toContain("POST IMAGE");
		expect(
			container.querySelector('[data-testid="post-image-placeholder"]'),
		).toBeNull();
	});

	it("quote-well::the-foreignObject-child-really-lands-in-the-XHTML-namespace", () => {
		// ⚠ THE ASSERTION THAT REPLACES AN ATTRIBUTE. `QuoteWell` ships no explicit
		// `xmlns` on the `foreignObject`'s `<div>` — it does not typecheck there and
		// forcing it would mean an `as` cast to restate something React already
		// does. So the thing the attribute would have guaranteed is measured
		// instead: an HTML element created in the SVG namespace would lay out as an
		// unknown SVG element, i.e. render nothing, and every geometry assertion
		// downstream would be measuring an empty box.
		const { container } = card(presentPost({ imageUrl: null }));
		const wellDiv = container.querySelector(".qwell");
		expect(wellDiv).not.toBeNull();
		expect(wellDiv?.namespaceURI).toBe("http://www.w3.org/1999/xhtml");
		// …and its parent really is the SVG `foreignObject`, or the namespace above
		// would be trivially true of a div that never entered the svg at all.
		expect(wellDiv?.parentElement?.tagName).toBe("foreignObject");
		expect(wellDiv?.parentElement?.namespaceURI).toBe(
			"http://www.w3.org/2000/svg",
		);
	});

	it("quote-well::a-post-WITH-an-image-keeps-its-title-row-and-gets-NO-well", () => {
		const { container } = card(presentPost({ imageUrl: IMG_URL }));

		expect(container.querySelector('[data-testid="quote-well"]')).toBeNull();
		expect(container.querySelector("img")?.getAttribute("src")).toBe(IMG_URL);

		// ⛔ THE TITLE ROW IS BACK — the clickable heading that enters post-focus,
		// which is the arm this ruling did not touch. Identified the way
		// `post-card.test.tsx` identifies it: an `h3` inside a `<button>`.
		const titleButton = container.querySelector("h3")?.closest("button");
		expect(titleButton).not.toBeNull();
		expect(titleButton?.innerHTML).toContain(TITLE);
	});

	it("quote-well::a-REMOVED-post-gets-NO-well-SC-1", () => {
		// ⛔⛔ THE MASKING GUARD, and the reason this file exists in this shape. The
		// well renders the TITLE — withheld content — so its absence here is not a
		// layout property. Asserted on the BODY's absence (the title string), never
		// merely on the row's, per `SC-1`.
		const { container } = card(REMOVED_POST);

		expect(container.querySelector('[data-testid="quote-well"]')).toBeNull();
		expect(container.querySelector("img")).toBeNull();
		expect(container.innerHTML).not.toContain(TITLE);
		// Non-vacuity: the removed branch really rendered its structural slot.
		expect(container.innerHTML).toContain("Open debate");
	});

	it("quote-well::an-imageless-REPLY-card-keeps-its-EMPTY-cell", () => {
		// Canon clause 1 — "Reply cards render nothing in the slot", by ruling. A
		// reply has no derived title (`deriveTitleTeaser` is post-only), so there is
		// nothing for a well to be; the cell stays R6's absorber and stays empty.
		const reply: DebateReply = {
			removed: false,
			id: "0199a0c0-0000-7000-8000-00000000dd01",
			ordinal: 1,
			title: "",
			side: "YES",
			createdAt: "2026-07-30T00:00:00.000Z",
			body: "Fixture reply body.",
			marker: "none",
			author: { pseudonym: "fixture-replier", pfpUrl: "" },
			stake: "10.000000000000000000",
			stakeOriginal: "10.000000000000000000",
			sold: false,
			entryPrice: "0.500000000000000000",
			imageUrl: null,
		};
		const { container } = render(
			<ReplyCard reply={reply} onOpenImage={noop} onOpenPopup={noop} />,
		);

		expect(container.querySelector('[data-testid="quote-well"]')).toBeNull();
		const argimg = cell(container);
		expect(argimg).not.toBeNull();
		expect(argimg?.innerHTML).toBe("");
		// Non-vacuity: the reply card really rendered.
		expect(container.innerHTML).toContain("Fixture reply body.");
	});

	it("quote-well::the-post-focus-hero-gets-NO-well-either", () => {
		// Canon clause 1 — the hero is explicitly NOT in this clause; it is owed at
		// QUOTE-1 C2. Pinned so C2 is a deliberate change rather than a discovery,
		// and pinned on the HERO because it reaches this slot by a different branch
		// shape than the card does.
		const { container } = render(
			<PostFocusHeader
				post={presentPost({ imageUrl: null })}
				market={MARKET}
				heldSide={null}
				marketOpen
				suspended={false}
				activeRelation={null}
				onToggleRelation={noop}
				onExit={noop}
				onOpenImage={noop}
				onOpenPopup={noop}
			/>,
		);

		expect(container.querySelector('[data-testid="quote-well"]')).toBeNull();
		// Non-vacuity: the hero really rendered its argument stack, with the plain
		// title it keeps.
		expect(container.innerHTML).toContain(TITLE);
	});
});

describe("QUOTE-1 C — Know more moves under the well", () => {
	const knowMoreIn = (container: HTMLElement) =>
		Array.from(container.querySelectorAll("button")).find((b) =>
			b.innerHTML.includes("Know more"),
		);

	it("quote-well::Know-more-renders-AFTER-the-well-inside-the-stack", () => {
		const { container } = card(presentPost({ imageUrl: null }));

		const stack = container.querySelector(".qstack");
		expect(stack).not.toBeNull();
		const well = container.querySelector('[data-testid="quote-well"]');
		const knowMore = knowMoreIn(container);
		expect(knowMore).toBeDefined();

		// Both in the stack — which is what makes the control align to the well
		// rather than to the card (clause 2).
		expect(stack?.contains(well as Node)).toBe(true);
		expect(stack?.contains(knowMore as Node)).toBe(true);

		// ⚠ ORDER ON THE REAL TREE, not by class string: `compareDocumentPosition`
		// is what a screen reader and the Tab sequence both follow, and "under the
		// well" is a reading order before it is a layout.
		expect(
			(well as Element).compareDocumentPosition(knowMore as Element) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();

		// ⛔ AND IT IS NO LONGER IN THE TITLE ROW'S GUTTER. The absolute positioning
		// belonged to a row that does not render on this arm; carrying it into the
		// stack would pin the control to the stack's corner instead of placing it
		// on its own line.
		expect(knowMore?.getAttribute("class")).not.toContain("absolute");
	});

	it("quote-well::a-title-only-imageless-post-gets-the-well-and-NO-Know-more", () => {
		// The presence rule is unchanged by the move (UI-OVERNIGHT entry 5): the
		// control renders only where there IS more to know. Asserted on the arm this
		// phase rewrote, because the predicate and the mount are now in the same
		// branch and a copy-paste could easily have dropped the condition.
		const { container } = card(presentPost({ imageUrl: null, body: TITLE }));

		expect(
			container.querySelector('[data-testid="quote-well"]'),
		).not.toBeNull();
		expect(knowMoreIn(container)).toBeUndefined();
	});
});

/**
 * ⛔⛔ THE ARITHMETIC HAS TO REACH THE DOM, AND UNTIL THIS BLOCK EXISTED IT DID NOT.
 * Every assertion above reads testids, tag names, text, `aria-hidden`,
 * `namespaceURI`, document order and class strings — and not one reads `style`.
 * `@code-reviewer` measured the hole: swapping `size` for `mark` in `QuoteWell`'s
 * inline styles, or deleting the `style` prop outright, left all 1057 tests in
 * `tests/unit/debate` + `tests/unit/design` green. `quote-well-size.test.ts` pins the
 * NUMBERS and this block pins that the component USES them; neither is sufficient
 * alone, and the gap between them is exactly where a well that renders every title
 * at one size would have lived.
 *
 * ⚠ IT IS ALSO THE ONLY THING PINNING `GEIST_QUOTE_TOP` AND `GEIST_QUOTE_TOP_CLOSE`.
 * Those two reach nothing but `markStyle`'s `top`, so before this block they could be
 * set to 0, or swapped with each other, with the whole suite still green and the marks
 * 17–20px out of position on the one axis the component's own docblock calls
 * load-bearing.
 */
describe("QUOTE-1 C — the measured constants reach the rendered node", () => {
	it("quote-well::the-title-carries-the-size-its-length-earns", () => {
		const { container } = card(presentPost({ imageUrl: null }));
		const heading = container.querySelector<HTMLElement>(
			'[data-testid="quote-well-title"]',
		);
		const expected = quoteTitleSize(TITLE.length);
		expect(heading?.style.fontSize).toBe(`${expected}px`);
		expect(heading?.style.lineHeight).toBe(String(QUOTE_TYPE.lineHeight));
		expect(heading?.style.letterSpacing).toBe(`${QUOTE_TYPE.tracking}em`);
		// Non-vacuity: the size is really a FUNCTION of the length, not a constant.
		// A 125-char title must come back smaller than a 23-char one.
		cleanup();
		const long = card(
			presentPost({ imageUrl: null, title: "x".repeat(125) }),
		).container.querySelector<HTMLElement>('[data-testid="quote-well-title"]');
		expect(Number.parseFloat(long?.style.fontSize ?? "0")).toBeLessThan(
			expected,
		);
	});

	it("quote-well::each-mark-occupies-its-INK-and-is-inset-by-MARGINS-not-by-position", () => {
		// ⛔ THE ONE PIECE OF MACHINERY IN THE COMPONENT, and MOBILE-2c R-3 changed
		// how it is expressed without changing what it computes.
		//
		// It used to be `height = INK × mark` with a negative `position: relative`
		// `top` shifting the PAINT onto that footprint. On WebKit, inside the
		// well's `<foreignObject>`, that paint landed in the wrong place: the
		// opening mark rendered on top of the title's first line and right of
		// centre, and the closing mark did not render at all. Chromium was correct.
		// Every box measurement agreed across both engines to within 0.1px — the
		// layout box reported the shifted position while the paint did not use it —
		// so the defect was invisible to geometry and was found by bisecting the
		// declarations live on WebKit until one of them moved the picture.
		//
		// ⇒ The inset is taken with MARGINS. Same optical result, painted
		// correctly by both engines, and no reliance on a 67.5px glyph overflowing
		// a 21px box.
		//
		// ⛔⛔ THE ASSERTION THAT MATTERS IS THE SUM, NOT THE MARGINS. What keeps
		// Chromium pixel-identical — and keeps `quoteTitleSize`'s
		// `2 × ink + 2 × gap + title` arithmetic true — is that the mark's OUTER
		// height is still exactly its ink. Two margins that happen to look right
		// but do not sum to that would move the title and re-wrap it, and no
		// assertion on the individual values would notice.
		const { container } = card(presentPost({ imageUrl: null }));
		const marks = Array.from(
			container.querySelectorAll<HTMLElement>(
				'[data-testid="quote-well-mark"]',
			),
		);
		expect(marks.length).toBe(2);

		const mark = quoteMarkSize(quoteTitleSize(TITLE.length));
		const ink = GEIST_QUOTE_INK * mark;
		for (const m of marks) {
			expect(m.style.fontSize).toBe(`${mark}px`);
			expect(m.style.lineHeight).toBe("1");
			// ⛔ NO `position: relative`, and no `top`. This is the defect's own
			// shape, asserted as an absence — with the positive control below, so a
			// mark that rendered no inline style at all cannot satisfy it.
			expect(m.style.top).toBe("");
			expect(m.className).not.toMatch(/(?:^|\s)relative(?:\s|$)/);
			// THE SUM: outer height === the ink footprint.
			const mt = Number.parseFloat(m.style.marginTop);
			const mb = Number.parseFloat(m.style.marginBottom);
			expect(mark + mt + mb).toBeCloseTo(ink, 6);
		}
		// The two marks carry DIFFERENT offsets because they sit at different
		// heights in the face (0.129 em vs 0.145 em); asserting one value for both
		// would pass against the bug it is here to catch.
		expect(marks[0]?.style.marginTop).toBe(`${-GEIST_QUOTE_TOP * mark}px`);
		expect(marks[1]?.style.marginTop).toBe(
			`${-GEIST_QUOTE_TOP_CLOSE * mark}px`,
		);
		expect(marks[0]?.style.marginTop).not.toBe(marks[1]?.style.marginTop);
	});

	it("quote-well::the-canvas-carries-its-own-545px-ceiling", () => {
		// ⚠ `w-auto` resolves to 100% of the flex parent, so the `width`/`height`
		// ATTRIBUTES supply the ratio and never a cap — measured 532px inside a 532px
		// parent. Without this inline bound the well scales past 545 on a wide column
		// and paints the title above the ratified 56px, with no visible symptom.
		const { container } = card(presentPost({ imageUrl: null }));
		const svg = container.querySelector<SVGElement>(
			'[data-testid="quote-well"]',
		);
		expect(svg?.style.maxWidth).toBe(`${QUOTE_CANVAS.w}px`);
		expect(svg?.getAttribute("viewBox")).toBe(
			`0 0 ${QUOTE_CANVAS.w} ${QUOTE_CANVAS.h}`,
		);
	});

	it("quote-well::the-well-ENTERS-post-focus-and-announces-its-own-title", () => {
		// ⛔⛔ THE AFFORDANCE THE PLAIN TITLE ROW CARRIED, ON THE ARM THAT NO LONGER
		// RENDERS THAT ROW. Row 23 deleted `Open debate →` from the present branch
		// BECAUSE the title carried this destination, so on an imageless card this is
		// the only `onEnter` control there is. Pending founder ratification — but
		// whichever way that goes, it must be ASSERTED rather than incidental.
		//
		// ⚠ AND THE NAME IS ASSERTED BECAUSE THE SVG SWALLOWS IT. Chrome's
		// name-from-contents does not traverse `foreignObject`, so `button > svg >
		// foreignObject > h3` computes an accessible name of `""` — an unnamed button,
		// WCAG 4.1.2 — while the plain `button > h3` above computes the title. jsdom
		// runs no AX tree, so the attribute is what can be pinned here; the AX
		// measurement is in the QUOTE-1 C report §3.6.
		const onEnter = vi.fn();
		const onOpenPopup = vi.fn();
		const post = presentPost({ imageUrl: null });
		const { container } = render(
			<PostCard
				post={post}
				onEnter={onEnter}
				onOpenPopup={onOpenPopup}
				onOpenImage={noop}
				onReplyToPost={noop}
				heldSide={null}
				marketOpen
				suspended={false}
			/>,
		);

		const well = container.querySelector('[data-testid="quote-well"]');
		const button = well?.closest("button");
		expect(button).not.toBeNull();
		// WCAG 2.5.3 holds BECAUSE the name is the title verbatim: an accessible name
		// must CONTAIN the visible text, and here it IS the visible text.
		expect(button?.getAttribute("aria-label")).toBe(TITLE);

		fireEvent.click(button as HTMLButtonElement);
		expect(onEnter).toHaveBeenCalledWith(post.id);
		// ⛔ It does NOT also open the pop-up — that is `Know more`'s job alone, the
		// same split the title row carried.
		expect(onOpenPopup).not.toHaveBeenCalled();
	});
});
