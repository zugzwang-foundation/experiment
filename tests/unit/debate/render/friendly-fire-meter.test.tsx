// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	useParams: () => ({ slug: "bitcoin-price-50k" }),
	useRouter: () => ({
		push: () => undefined,
		refresh: () => undefined,
		replace: () => undefined,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => undefined,
	}),
	usePathname: () => "/m/bitcoin-price-50k",
	useSearchParams: () => new URLSearchParams(),
}));

import { DebateView } from "@/components/debate/DebateView";
import type {
	DebatePost,
	DebateReply,
	DebateViewModel,
	ViewerMarketContext,
} from "@/components/debate/types";

import { baseModel, newPost, newReply } from "./_posted-fixtures";

/**
 * FF-1 · CLOSE-3 (D-52) — the desktop focus view after the ruling.
 *
 * This file carried D-51 R5's friendly-fire METER cases; D-52 R2 withdrew the
 * meter, so they are REPLACED, per the round's test budget, by one negative:
 * the meter is absent from the focus view. The file keeps its name so the
 * withdrawal is found where the meter was pinned.
 *
 *   ff-meter::withdrawn — the focused post's aggregate still CARRIES
 *        `friendlyFireDharma` (Đ25 of Đ100 Support: exactly the reading the
 *        meter used to draw), and neither `ff-meter` nor `ff-meter-figure` is
 *        anywhere in the document. POSITIVE CONTROL in the same render: the
 *        flagged reply's `ff-tag` IS there, so the negative is not an empty
 *        or unmounted focus view.
 *
 * Markup, never `textContent` (O-7); selection by `data-testid` and the
 * column's `data-debate-column`, never by class (OVN-V5/V6). No jest-dom.
 */

beforeEach(() => {
	window.scrollTo = () => undefined;
	Object.defineProperty(document, "hidden", {
		configurable: true,
		get: () => false,
	});
	history.replaceState(null, "", "/m/bitcoin-price-50k");
});
afterEach(() => {
	cleanup();
	Reflect.deleteProperty(document, "hidden");
	history.replaceState(null, "", "/");
});

function flagged(id: string): DebateReply {
	return {
		...newReply({ id, side: "YES" }),
		friendlyFire: true,
	} as DebateReply;
}

/** Another author's YES post: one flagged Support reply, the aggregate carrying friendly fire. */
function otherPost(): DebatePost {
	const base = newPost({ id: "p-other", ordinal: 1, sideAtPostTime: "YES" });
	return {
		...base,
		aggregate: {
			supportCount: 1,
			counterCount: 0,
			supportDharma: "100.000000000000000000",
			counterDharma: "0.000000000000000000",
			friendlyFireDharma: "25.000000000000000000",
		},
		replies: { support: [flagged("r-ff")], counter: [], twoSlot: [] },
	} as DebatePost;
}

/** The viewer's own NO post — the other column, so both cards are on screen. */
function ownPost(): DebatePost {
	return newPost({ id: "p-own", ordinal: 2, sideAtPostTime: "NO" });
}

function model(): DebateViewModel {
	return { ...baseModel(), posts: [otherPost(), ownPost()] };
}

/** Signed in, holding nothing. */
const VIEWER: ViewerMarketContext = {
	position: null,
	balance: "1000",
	spendableToday: "1000",
	ownPostIds: ["p-own"],
};

function mount(initialPostId: string | null) {
	return render(
		<DebateView
			model={model()}
			viewer={VIEWER}
			initialPostId={initialPostId}
			ownPseudonym="SlateHeron105"
		/>,
	);
}

describe("D-52 — the desktop focus view after the ruling", () => {
	it("ff-meter::withdrawn — no meter in the focus view (positive control: the ff-tag renders in the same fixture)", () => {
		mount("p-other");
		const html = document.body.innerHTML;
		// The negative: the reading the meter drew is still in the DTO, and
		// nothing of the meter is drawn.
		expect(html).not.toContain('data-testid="ff-meter"');
		expect(html).not.toContain('data-testid="ff-meter-figure"');
		expect(html).not.toContain("% of Support");
		// The positive control: this IS the focus view of the post with the
		// flagged reply, and the tag that stays is drawn.
		expect(html).toContain('data-testid="reply-split-bar"');
		expect(html).toContain('data-testid="ff-tag"');
	});
});
