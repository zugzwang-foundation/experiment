// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CommentImage } from "@/components/debate/CommentImage";
import { PostCard } from "@/components/debate/PostCard";
import { PostFocusHeader } from "@/components/debate/PostFocusHeader";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import { ReplyCard } from "@/components/debate/ReplyCard";
import type {
	DebateMarketHeader,
	DebatePost,
	ReplyGroups,
} from "@/components/debate/types";

/**
 * POLISH.3 PR 2 · C1 — the post-image geometry guard (plan §7; §6 row T2,
 * Tier B-2).
 *
 * Row T2 (C4) — `CommentImage.tsx:28 (CommentImage → img className)` vs
 * `d5:648-654 (.argimg/.media)`. RULED at §17 `H-T2`, 2026-08-13:
 * **ASPECT-RESPECTING WITHIN A MAX BOX** — natural aspect, bounded by
 * `--imgmax` on HEIGHT and 100% on width, corners `--imgr`.
 * ⛔ No fixed box ⇒ the `object-fit` question does not arise.
 *
 * ⚠ NOTE THE AXIS CHANGE, WHICH IS THE ROW'S WHOLE SUBSTANCE. The build binds
 * `max-w-[var(--imgmax)]`; this ruling moves the bound to HEIGHT with width at
 * 100%. A guard that only asserted "an `--imgmax` bound exists" would pass on
 * the unfixed build.
 *
 * ⚠ THE ONLY BUILD DECISION IN THE PLAN, and deliberately not bucket D. The
 * mockup DECLINES to rule: it carries two aspects on purpose (`d5:1079
 * .media.land` 220:96 on YES, `d5:1242 .media.rdt` 640:586 on NO) and files the
 * choice OPEN at `d5:241-244`. Neither answer can be filed as "the mockup is
 * superseded", because the mockup never decided. `"Shown whole · any
 * orientation"` is a PROMISE TO THE AUTHOR (composer hint, canon §107), and a
 * fixed 640:586 box keeps it literally while breaking it practically.
 *
 * ⚠ THE COST, RECORDED: card heights vary, so the two columns read less
 * regularly than a fixed box would give. That is the price of the promise,
 * accepted knowingly. Card-height variance is the CAROUSEL's problem, and the
 * carousel is deferred.
 *
 * ⚠ `--imgmax: 160px` / `--imgr: 6px` at `globals.css:179-180 (:root)`, both
 * re-verified EXACT at the branch point. Asserted BY TOKEN — a raw hex or a
 * literal `160px` here would also redden Ruling A's `no-raw-hex-view-layer`.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM only.
 */

afterEach(cleanup);

/** HTML-FINISH · MARKET DETAIL row 27 — the reply pop-up host. These suites
 * assert spacing / partitioning / images, never the pop-up, so a
 * no-op is the honest stand-in. `reply-card.test.tsx` is where the `+` is
 * pinned. */
const noopPopup = () => {};

const noop = () => {};

function renderImage() {
	const { container } = render(
		<CommentImage url="https://example.invalid/fixture-image" onOpen={noop} />,
	);
	const img = container.querySelector("img");
	expect(img).not.toBeNull();
	return img as HTMLImageElement;
}

describe("POLISH.3 PR 2 — T2, the post image is aspect-respecting in a max box", () => {
	it("comment-image::the-imgmax-bound-is-on-HEIGHT", () => {
		// The ruled half. `--imgmax` governs the HEIGHT axis after T2.
		const img = renderImage();

		expect(img.getAttribute("class")).toContain("max-h-[var(--imgmax)]");
	});

	it("comment-image::the-superseded-WIDTH-bound-is-gone", () => {
		// The axis CHANGE, asserted as a change. Without this the fix could add
		// a height bound and leave the width bound in place, which is a fixed
		// box in all but name — the thing H-T2 ruled against.
		const img = renderImage();

		expect(img.getAttribute("class")).not.toContain("max-w-[var(--imgmax)]");
	});

	it("comment-image::width-is-BOUNDED-at-100-percent-not-stretched", () => {
		// "100% width" — the second half of the ruled recipe, and §17 phrases it
		// as "BOUNDED BY `--imgmax` on height AND 100% on width". Both are max-*
		// BOUNDS, which is precisely why the ruling can say "no fixed box ⇒ the
		// `object-fit` question does not arise": with no pinned axis the UA keeps
		// the intrinsic aspect on its own.
		//
		// ⛔ TIGHTENED at C4 (@code-reviewer LOW-6). The original assertion read
		// `toContain("w-full")`, which "max-w-full" satisfies as a SUBSTRING — so
		// it could not tell a bound from a stretch. A bare `w-full` would force
		// width to 100% and then clamp height at `--imgmax`, BREAKING the aspect:
		// the one outcome H-T2 exists to forbid. Asserted on the token list, not
		// on a substring.
		const tokens = (renderImage().getAttribute("class") ?? "").split(/\s+/);

		expect(tokens).toContain("max-w-full");
		expect(tokens).not.toContain("w-full");
	});

	it("comment-image::corners-ride-the-ratified-imgr-token", () => {
		// `--imgr` is RATIFIED (values-log §3 item 2: images, avatars, media,
		// graph panels). Carried through the change, not re-decided.
		const img = renderImage();

		expect(img.getAttribute("class")).toContain("rounded-[var(--imgr)]");
	});
});

/**
 * HTML-FINISH · MARKET DETAIL row 11 — the focused post's image MOUNT SITE.
 *
 * `.hleft` is a ROW, not a stack (`d5:448`), and `.hpimg` (`:956`) is a LEFT
 * SIBLING of the text stack — the same slot the market arm gives `.mmedia`. The
 * image used to render INLINE between the title and the body, pushing the
 * argument down the column on every post that carried one.
 *
 * ⛔ THE IMAGE ITSELF IS UNCHANGED, and the assertions above are why that
 * matters: `.hpimg` carries `aspect-ratio:16/9` + `overflow:hidden`, which
 * CROPS, and T2 binds both axes as BOUNDS so the image is shown whole. d5
 * agrees — its own comment at `:955` reads "shown whole at its own aspect;
 * flag 1 paused". This is a MOUNT-SITE row only; `CommentImage` is untouched
 * and its geometry guard above still governs.
 *
 * ⚠ O-7 — `innerHTML`, never `textContent`. A mount site is markup structure,
 * and `textContent` cannot see an `<img>` at all.
 */
const EMPTY_REPLIES: ReplyGroups = { support: [], counter: [], twoSlot: [] };

function focusedPost(imageUrl: string | null): DebatePost {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-00000000da03",
		ordinal: 1,
		sideAtPostTime: "YES",
		createdAt: "2026-07-30T00:00:00.000Z",
		title: "Fixture argument title.",
		// ⚠ UI-OVERNIGHT entry 5 — THE BODY CONTAINS ITS OWN TEASER. The wire
		// `body` is `title\n\nextended`, and `teaser` is derived back out of it,
		// so a fixture whose two fields disagree describes a post the product
		// cannot write. It matters here because `Know more` now renders only when
		// the body carries a second paragraph, and this suite reads that control
		// as the end of the argument stack.
		teaser: "Fixture teaser.",
		body: "Fixture argument title.\n\nFixture teaser.",
		imageUrl,
		marker: "none",
		badge: null,
		author: { pseudonym: "fixture-author", pfpUrl: "" },
		authorStake: "10.000000000000000000",
		// RANK-1 — the substrate stake is SURVIVING basis; nothing is sold in this fixture.
		authorStakeOriginal: "10.000000000000000000",
		authorSold: false,
		entryPrice: "0.500000000000000000",
		aggregate: {
			supportCount: 2,
			counterCount: 1,
			supportDharma: "1000.000000000000000000",
			counterDharma: "2000.000000000000000000",
		},
		replies: EMPTY_REPLIES,
	};
}

/** The market the focused post belongs to — row 17's rail needs it. */
const MARKET: DebateMarketHeader = {
	id: "0190c0de-4444-7000-8000-000000000004",
	slug: "comment-image-fixture-market",
	title: "Fixture market question.",
	description: "Fixture resolution criterion.",
	status: "Open",
	mediaVideoUrl: null,
	mediaImageUrl: null,
	// ⚠ UI-OVERNIGHT entry 4 — the DISCOVERY thumbnail, distinct from
	// `mediaImageUrl` above: the detail header takes the secondary media row,
	// the post arm's market CARD takes the default one, because that card is
	// the same locked composition Discovery renders. REQUIRED on the type, so a
	// fixture that forgets it is a compile error rather than a card that
	// silently shows the wrong picture.
	thumbImageUrl: null,
	pricing: { yes: "0.500000000000000000", no: "0.500000000000000000" },
	unitToWin: { yes: "1.960000000000000000", no: "1.960000000000000000" },
	totals: {
		dharmaStaked: "150.000000000000000000",
		postCount: 3,
		replyCount: 5,
	},
};

function renderFocus(imageUrl: string | null) {
	return render(
		<PostFocusHeader
			post={focusedPost(imageUrl)}
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
}

describe("HTML-FINISH · MARKET DETAIL — row 11, the image is a left sibling", () => {
	it("comment-image::the-focused-image-precedes-the-argument-stack", () => {
		const { container } = renderFocus("https://example.invalid/focus-image");

		const row = container.querySelector("img")?.closest("div.flex.gap-4");
		expect(row).not.toBeNull();

		const html = row?.innerHTML ?? "";
		const image = html.indexOf("<img");
		const title = html.indexOf("Fixture argument title.");
		const knowMore = html.indexOf("Know more");

		expect(image).toBeGreaterThan(-1);
		expect(title).toBeGreaterThan(-1);
		// The mount-site claim: the image comes BEFORE the whole stack, not
		// between the title and the body as it used to.
		expect(image).toBeLessThan(title);
		// ⚠ RE-DERIVED TWICE NOW, AND NEVER RELAXED. It first read
		// `expect(title).toBeLessThan(body)` against the full body the focused post
		// rendered inline; row 15 replaced that with a TEASER, so the marker became
		// the teaser. UI-OVERNIGHT entry 3 removes the teaser too — the clamped
		// preview was costing this header the Support/Counter bar at its foot — so
		// the marker moves again, to the control that is now the last thing in the
		// stack. ⛔ THE PROPERTY UNDER TEST HAS NOT MOVED ONCE: the image precedes
		// the argument stack. Only the string that stands for "the end of the
		// stack" has, each time, with the render.
		expect(knowMore).toBeGreaterThan(-1);
		expect(title).toBeLessThan(knowMore);
	});

	it("comment-image::the-image-slot-does-not-grow-and-is-absent-when-there-is-none", () => {
		const withImage = renderFocus("https://example.invalid/focus-image");
		const wrapper =
			withImage.container.querySelector("img")?.parentElement?.parentElement;
		// `.hpimg{flex:0 0 auto}` — does not grow, does not shrink.
		expect(wrapper?.getAttribute("class")).toContain("shrink-0");

		// A post with no image renders NO slot — never an empty reserved box.
		cleanup();
		const without = renderFocus(null);
		expect(without.container.querySelector("img")).toBeNull();
		// Non-vacuity: the stack still rendered.
		expect(without.container.innerHTML).toContain("Fixture argument title.");
	});

	it("comment-image::row-16-pins-the-split-bar-to-the-stack-foot", () => {
		// `.pfoot{margin-top:auto;flex:0 0 auto}` (`d5:856`) — "pinned to bottom
		// so bottoms align with image + thumbnail" (`d5:978`).
		const { container } = renderFocus("https://example.invalid/focus-image");

		const foot = container.querySelector('[data-testid="post-focus-foot"]');
		expect(foot).not.toBeNull();
		const cls = foot?.getAttribute("class") ?? "";
		expect(cls).toContain("mt-auto");
		expect(cls).toContain("shrink-0");

		// It is the LAST child of the stack — `mt-auto` on a non-final child
		// pins nothing.
		expect(foot?.parentElement?.lastElementChild).toBe(foot);
	});
});

/**
 * HTML-FINISH · MARKET DETAIL row 26 (image half) — a REPLY carries its own
 * attachment, and it is the SECOND mount site this row opens.
 *
 * ⛔ THE REMOVED BRANCH IS TYPE-ENFORCED HERE: `DebateReply`'s removed variant
 * has no `imageUrl` field at all, so an image in that branch does not compile.
 * The render assertion below is the belt; the type is the braces. Server-side,
 * the URL is never even minted — pinned by `load-debate-view.integration.test.ts`.
 */
describe("HTML-FINISH · MARKET DETAIL — row 26, the reply's own image", () => {
	const noopOpen = () => {};

	function presentReply(imageUrl: string | null) {
		return {
			removed: false as const,
			id: "0199a0c0-0000-7000-8000-00000000db01",
			ordinal: 1,
			title: "",
			side: "YES" as const,
			createdAt: "2026-07-30T00:00:00.000Z",
			body: "Fixture reply body.",
			marker: "none" as const,
			author: { pseudonym: "fixture-replier", pfpUrl: "" },
			stake: "10.000000000000000000",
			// RANK-1 — the substrate stake is SURVIVING basis; nothing is sold in this fixture.
			stakeOriginal: "10.000000000000000000",
			sold: false,
			entryPrice: "0.500000000000000000",
			imageUrl,
		};
	}

	it("comment-image::a-reply-with-an-image-mounts-it", () => {
		const { container } = render(
			<ReplyCard
				reply={presentReply("https://example.invalid/reply-image")}
				onOpenImage={noopOpen}
				onOpenPopup={noopPopup}
			/>,
		);

		const img = container.querySelector("img");
		expect(img?.getAttribute("src")).toBe(
			"https://example.invalid/reply-image",
		);
		// It rides the SAME `CommentImage` as the post path — same lightbox
		// affordance, not a second image component.
		// ⚠⚠ RPLY-1 · R6 — THE BOUND MOVED FROM `--imgmax` TO `max-h-full`, AND
		// THE SUPERSEDED ASSERTION IS RECORDED RATHER THAN DELETED (O-4). It read
		// `toContain("max-h-[var(--imgmax)]")`, which is `CommentImage`'s
		// NON-`fill` arm — a 160px cap on a `w-fit` box. The reply card now gives
		// its attachment the same `.argimg` CELL the post card has, so the image
		// is bounded by the CELL (`max-h-full`) rather than by a constant, exactly
		// as `PostCard`'s is. T2 is untouched: both axes are still BOUNDS
		// (`max-h-full` + `max-w-full`, no fixed dimension), so the intrinsic
		// aspect is preserved and a small image is never upscaled.
		expect(img?.getAttribute("class")).toContain("max-h-full");
		expect(img?.getAttribute("class")).toContain("max-w-full");
		expect(img?.getAttribute("class")).not.toContain("max-h-[var(--imgmax)]");
		expect(
			container.querySelector('button[aria-label="Open attached image"]'),
		).not.toBeNull();
	});

	it("comment-image::a-reply-without-one-renders-NOTHING", () => {
		// ⚠⚠ THIS TEST'S NAME AND CLAIM HAVE NOW CHANGED TWICE, AND THE FIRST TIME
		// IS THE REASON THE SECOND ONE IS WRITTEN THE WAY IT IS. It began as
		// `a-reply-without-one-mounts-nothing`, asserting only
		// `querySelector("img") === null`. RPLY-1 · R6 then mounted a placeholder
		// `<div>` here — which that assertion happily passed, so the test's name
		// had quietly become false while its colour said everything was fine. R6
		// corrected it in place to `mounts-THE-PLACEHOLDER`.
		// ⇒ QUOTE-1 A strips the placeholder again, and the name goes back — but
		// NOT the original assertion, because the original assertion is precisely
		// the one that could not see the difference. The claim is asserted on the
		// BODY of the render, not on the absence of an `<img>`.
		const { container } = render(
			<ReplyCard
				reply={presentReply(null)}
				onOpenImage={noopOpen}
				onOpenPopup={noopPopup}
			/>,
		);

		// Still no real image — nothing is invented for an attachment-less reply.
		expect(container.querySelector("img")).toBeNull();
		// …and no slot either, by testid AND by label, so a re-mount that renamed
		// one of the two still reddens on the other.
		expect(
			container.querySelector('[data-testid="post-image-placeholder"]'),
		).toBeNull();
		expect(container.innerHTML).not.toContain("POST IMAGE");
		// ⛔ THE CELL IS STILL THERE AND MUST BE. R6's mechanism is the absorber,
		// not the placeholder: the cell is what takes the card's leftover height,
		// and stripping the box did not strip the cell. Asserted here so a later
		// "tidy up the empty div" reddens rather than silently restoring the dead
		// gap at the card's foot that R6 exists to remove.
		const cell = container.querySelector(".flex-1.items-center.justify-center");
		expect(cell).not.toBeNull();
		expect(cell?.innerHTML).toBe("");
		// Non-vacuity: the reply itself rendered.
		expect(container.innerHTML).toContain("Fixture reply body.");
	});

	it("comment-image::a-REMOVED-reply-renders-no-image-no-body-AND-NO-PLACEHOLDER", () => {
		// ⛔ SC-1 at the render. The removed variant carries neither field, so
		// this asserts the BODY's absence as well as the image's — a row-level
		// "it still renders something" check would not.
		const { container } = render(
			<ReplyCard
				reply={{
					removed: true,
					id: "0199a0c0-0000-7000-8000-00000000db02",
					ordinal: 1,
					side: "YES",
					createdAt: "2026-07-30T00:00:00.000Z",
				}}
				onOpenImage={noopOpen}
				onOpenPopup={noopPopup}
			/>,
		);

		expect(container.querySelector("img")).toBeNull();
		expect(container.innerHTML).not.toContain("Fixture reply body.");
		// ⛔⛔ RPLY-1 · R6 — AND NO PLACEHOLDER EITHER, WHICH IS A MASKING CLAIM
		// RATHER THAN A LAYOUT ONE. `PostCard` already records the reasoning for
		// its own path: a "POST IMAGE" box beside a withheld argument announces
		// that the withheld argument HAD an attachment, which is an inference
		// about removed content leaking off a masked payload. The type system does
		// NOT help here — the removed branch is a separate early return, and an
		// `else` arm needs no field — so R6's new mount is exactly the shape that
		// could have reached it, and this is the assertion that says it did not.
		expect(
			container.querySelector('[data-testid="post-image-placeholder"]'),
		).toBeNull();
	});
});

/**
 * QUOTE-1 A — THE POST-IMAGE PLACEHOLDER IS GONE, AND THIS BLOCK IS THE PROOF
 * THAT IT STAYS GONE (founder-ruled 2026-09-11, the `docs/parked.md`
 * `HTML-FINISH-MD-PLACEHOLDERS` docket taking its STRIP exit for kind 2).
 *
 * ⚠ INVERTED, NOT DELETED, AND THE DIFFERENCE IS THE WHOLE VALUE OF THE BLOCK.
 * These four tests were written at round 2 · R2 to prove the box RENDERED; they
 * now prove it does not. Deleting them would have left the surface with no
 * assertion in either direction, so the next person to reach for d5's mockup
 * would re-mount it against a green suite.
 *
 * ⛔⛔ THE MASKING PROPERTY SURVIVES UNCHANGED AND IS STILL THE LOAD-BEARING ONE.
 * A placeholder rendering on every card without an image would have rendered
 * beside a REMOVED post too — and a "POST IMAGE" box next to a withheld argument
 * announces that the withheld argument HAD an attachment, which is an inference
 * about removed content leaking off the masked payload. `SC-1`'s framing is what
 * caught it: assert that the removed branch draws nothing, never merely that the
 * present branch draws something.
 *
 * ⚠⚠ AND QUOTE-1 C HAS NOW ARRIVED, WHICH IS WHY THE KEEPING MATTERED. This block
 * said: "That assertion is now trivially true — every imageless card draws
 * nothing — and it is KEPT anyway, because 'trivially true today' is a property
 * of the current render and not of the surface. QUOTE-1 C puts content back into
 * this slot, and when it does, this is the test that says the removed branch must
 * not receive it." It did, one phase later: the imageless arm now draws the
 * title-as-quotation well, the removed assertion has stopped being trivial, and
 * it went on guarding a leak that is now WORSE than an empty box — the well
 * renders the TITLE, so a well on a removed post would publish the withheld
 * argument rather than merely imply it had an attachment. The present-branch test
 * below is inverted to match (it asserts the well); this one is untouched.
 *
 * ⛔⛔ AND IT IS BLIND TO THE WELL, WHICH IS MEASURED RATHER THAN SUSPECTED — so
 * do not read the sentence above as meaning THIS test now guards the new
 * content. It names two things: the placeholder's `data-testid` and the string
 * `POST IMAGE`. The well carries neither. Mounting a well on the removed branch
 * was tried: `quote-well::a-REMOVED-post-gets-NO-well-SC-1` reds and every test
 * in THIS file stays green. ⇒ `quote-well.test.tsx` is where the well's `SC-1`
 * lives, and it asserts the absence of the TITLE STRING, not of a testid — which
 * is the SC-1 rule itself (assert the BODY's absence, never the row's). This
 * block's value is unchanged and is the placeholder's: it stops d5's mockup box
 * coming back. It was never going to stretch to content it cannot name.
 *
 * ⚠ It was structurally impossible on the POST path — the removed union variant
 * carries no `imageUrl` field, so `post.imageUrl` does not typecheck in that
 * branch — but "impossible by type" is what an ELSE arm silently defeats: an
 * `else` needs no field at all. That is exactly the shape QUOTE-1 C reintroduces.
 */
/** The REMOVED post variant. It carries NO `imageUrl` field at the type level,
 * which is exactly what made R2's `else` arm the thing that needed a guard: an
 * `else` needs no field, so the type system stops helping precisely where a
 * branch is added. Kept for QUOTE-1 C, which adds one back. */
function removedPost(): DebatePost {
	return {
		removed: true,
		id: "0199a0c0-0000-7000-8000-00000000da04",
		ordinal: 2,
		sideAtPostTime: "YES",
		createdAt: "2026-07-30T00:00:00.000Z",
		aggregate: {
			supportCount: 0,
			counterCount: 0,
			supportDharma: "0.000000000000000000",
			counterDharma: "0.000000000000000000",
		},
		replies: EMPTY_REPLIES,
	};
}

const PH_URL = "https://example.invalid/post-attachment.png";

describe("QUOTE-1 A — no image renders nothing, on every arm", () => {
	it("no-image-renders-NOTHING::a-present-post-with-no-image-draws-THE-WELL", () => {
		const { container } = render(
			<PostCard
				post={focusedPost(null)}
				onEnter={noop}
				onOpenPopup={noop}
				onOpenImage={noop}
				onReplyToPost={noop}
				heldSide={null}
				marketOpen
				suspended={false}
			/>,
		);

		expect(
			container.querySelector('[data-testid="post-image-placeholder"]'),
		).toBeNull();
		// ⛔ THE LABEL IS ASSERTED SEPARATELY FROM THE TESTID, and by a PREFIX
		// rather than the full byte-carried literal. R2's box read `POST IMAGE ·
		// 640:586` (middle dot U+00B7, bytes c2 b7); a re-mount that kept the box
		// and changed the aspect string would defeat a full-literal check while
		// putting the identical defect back on the page.
		expect(container.innerHTML).not.toContain("POST IMAGE");
		// ⛔ NON-VACUITY, AND IT IS NOT OPTIONAL ON AN ABSENCE TEST. Both
		// assertions above pass against a component that rendered nothing at all,
		// so without this the test certifies a blank card.
		expect(container.innerHTML).toContain("Fixture argument title.");
		// …and the absorber cell survives — see the reply test above for why this is
		// a property and not a leftover.
		const cell = container.querySelector(".flex-1.items-center.justify-center");
		expect(cell).not.toBeNull();
		// ⚠⚠ QUOTE-1 C — THE CELL IS NO LONGER EMPTY, AND THE ASSERTION IS INVERTED
		// RATHER THAN DELETED. It read `toBe("")`, which was the whole point of
		// Phase A: the placeholder was gone and nothing stood in its place. What
		// stands there now is the title-as-quotation well, so the claim becomes
		// EXACTLY the well's stack and nothing else — a mockup box re-mounted
		// BESIDE the well would defeat a mere non-emptiness check while putting the
		// identical defect back on the page.
		expect(cell?.querySelectorAll('[data-testid="quote-well"]').length).toBe(1);
		expect(cell?.firstElementChild?.getAttribute("class")).toContain("qstack");
		expect(cell?.querySelector("img")).toBeNull();
		expect(cell?.innerHTML).not.toContain("POST IMAGE");
		expect(
			cell?.querySelector('[data-testid="post-image-placeholder"]'),
		).toBeNull();
	});

	it("no-image-renders-NOTHING::a-post-WITH-an-image-still-mounts-it", () => {
		const { container } = render(
			<PostCard
				post={focusedPost(PH_URL)}
				onEnter={noop}
				onOpenPopup={noop}
				onOpenImage={noop}
				onReplyToPost={noop}
				heldSide={null}
				marketOpen
				suspended={false}
			/>,
		);

		expect(container.querySelector("img")?.getAttribute("src")).toBe(PH_URL);
		expect(
			container.querySelector('[data-testid="post-image-placeholder"]'),
		).toBeNull();
		expect(container.innerHTML).not.toContain("POST IMAGE");
	});

	it("no-image-renders-NOTHING::a-REMOVED-post-draws-NO-box-SC-1", () => {
		// ⛔ THE MASKING GUARD. A removed post must not carry an image slot in any
		// form: its attachment was withheld server-side, and reserving space for one
		// tells the reader it existed.
		const { container } = render(
			<PostCard
				post={removedPost()}
				onEnter={noop}
				onOpenPopup={noop}
				onOpenImage={noop}
				onReplyToPost={noop}
				heldSide={null}
				marketOpen
				suspended={false}
			/>,
		);

		// Non-vacuity: the removed branch really rendered.
		expect(container.innerHTML).toContain(REMOVED_STUB_TEXT);
		expect(
			container.querySelector('[data-testid="post-image-placeholder"]'),
		).toBeNull();
		expect(container.innerHTML).not.toContain("POST IMAGE");
	});

	it("no-image-renders-NOTHING::the-post-focus-arm-draws-NO-box-either-way", () => {
		// "Both arms" was the founder's own scope for R2's siblings, and the
		// post-focus header reaches this slot by a different branch shape
		// (`post.removed ? null : post.imageUrl ? … : null`) than the card does —
		// which is why it is asserted separately rather than assumed to follow.
		// ⚠ AND IT IS THE ONE SURFACE WHERE THE STRIP REMOVED A WRAPPER TOO. The
		// card mounts keep their absorber cell; here the `.hpimg` frame existed
		// only to shape the placeholder, so the row is left with a single child.
		// Hence no cell assertion in this test — there is correctly nothing to
		// assert, and saying so beats a reader concluding it was forgotten.
		const { container, unmount } = render(
			<PostFocusHeader
				post={focusedPost(null)}
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
		expect(
			container.querySelector('[data-testid="post-image-placeholder"]'),
		).toBeNull();
		expect(container.innerHTML).not.toContain("POST IMAGE");
		// Non-vacuity: the header really rendered its argument stack.
		expect(container.innerHTML).toContain("Fixture argument title.");
		unmount();

		const { container: removed } = render(
			<PostFocusHeader
				post={removedPost()}
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
		expect(removed.innerHTML).toContain(REMOVED_STUB_TEXT);
		expect(
			removed.querySelector('[data-testid="post-image-placeholder"]'),
		).toBeNull();
		expect(removed.innerHTML).not.toContain("POST IMAGE");
	});
});
