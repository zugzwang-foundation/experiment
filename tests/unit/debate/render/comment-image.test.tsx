// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import { CommentImage } from "@/components/debate/CommentImage";
import { PostFocusHeader } from "@/components/debate/PostFocusHeader";
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

vi.mock("@/server/bookmarks/add", () => ({ addBookmarkAction: vi.fn() }));
vi.mock("@/server/bookmarks/remove", () => ({ removeBookmarkAction: vi.fn() }));

afterEach(cleanup);

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
const VIEWER: BookmarkAffordance = { saved: new Set(), own: new Set() };
const EMPTY_REPLIES: ReplyGroups = { support: [], counter: [], twoSlot: [] };

function focusedPost(imageUrl: string | null): DebatePost {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-00000000da03",
		ordinal: 1,
		sideAtPostTime: "YES",
		createdAt: "2026-07-30T00:00:00.000Z",
		title: "Fixture argument title.",
		teaser: "Fixture teaser.",
		body: "Fixture body.",
		imageUrl,
		marker: "none",
		badge: null,
		author: { pseudonym: "fixture-author", pfpUrl: "" },
		authorStake: "10.000000000000000000",
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
			bookmarks={VIEWER}
			heldSide={null}
			marketOpen
			suspended={false}
			activeRelation={null}
			onToggleRelation={noop}
			onExit={noop}
			onOpenImage={noop}
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
		const body = html.indexOf("Fixture body.");

		expect(image).toBeGreaterThan(-1);
		expect(title).toBeGreaterThan(-1);
		// The mount-site claim: the image comes BEFORE the whole stack, not
		// between the title and the body as it used to.
		expect(image).toBeLessThan(title);
		expect(title).toBeLessThan(body);
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
