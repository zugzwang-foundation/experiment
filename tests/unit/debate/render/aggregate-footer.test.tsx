// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import { PostCard } from "@/components/debate/PostCard";
import type { DebatePost, ReplyGroups, Side } from "@/components/debate/types";

/**
 * POLISH.3 PR 2 · C1 — the market-view split-bar guard (plan §7; §6 row T3,
 * Tier B-3). **T3 ONLY** — re-scoped at `GC-3`, because this file previously
 * carried row 6 as well and row 6 is only sites 4-5 of `PD-3-07`. Copy is
 * `dharma-spacing.test.tsx`'s subject; this file's subject is presence and
 * POLE BINDING.
 *
 * Row T3 (C2) — `AggregateFooter.tsx:12-22 (AggregateFooter → render body)` vs
 * `d5:1099-1102 (.barrow.f2)`. Read-only; no DTO change, no server touch.
 * ⚠ The anchor is the WHOLE render body, which is why C2 discharges rows 4-6's
 * sites 4-5 by construction (GC-10) — `:14` and `:19` sit strictly inside it.
 *
 * ⛔⛔ FOUR ASSERTIONS, NOT TWO — AND THIS IS THE WHOLE POINT OF THE ROW.
 * The bar is **SIDE-CODED, NOT RELATION-CODED** (plan §7, guard form). Support
 * on a YES post resolves to the YES side; Support on a NO post resolves to the
 * NO side. So the pole a given share is painted in DEPENDS ON THE POST, and a
 * YES-post-only test passes on a bar that is inverted for every NO post.
 *
 * ⚠ THIS IS `side-pole-binding.test.ts`'s DOCUMENTED ROUTE 3, AND THAT GUARD
 * CANNOT CATCH IT. Its own docstring names the case: "a FIXED pole colour on a
 * PER-SIDE element — no side value appears in the expression at all; the pole
 * is hard-coded while the QUANTITY it measures flips meaning with the side",
 * and records that "V17's Support/Counter split bar lived in exactly this hole
 * for the length of this PR ... and this file stayed green throughout". The
 * static guard is structurally blind here; THIS render guard is the control.
 * ⇒ The bar must resolve its poles FROM the post's side. `RR-3` was the same
 * defect on `ReplySplitBar`'s own track and fill spans — corrected at C13, and
 * cited here as the worked example rather than as a live defect. The reference
 * shape is `ReplySplitBar (→ TriggerPill → the pole const)`, which derives from
 * `deriveReplySide`.
 *
 * ⚠ GUARD-COMPOSITION CONSTRAINT (plan §7). Read through `PostCard` — the only
 * component that renders `AggregateFooter` — and scoped by testid to the bar's
 * own elements, so C8/C9's card edits and C11's `Download` deletion cannot move
 * it.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM only.
 */

vi.mock("@/server/bookmarks/add", () => ({ addBookmarkAction: vi.fn() }));
vi.mock("@/server/bookmarks/remove", () => ({ removeBookmarkAction: vi.fn() }));

afterEach(cleanup);

const VIEWER: BookmarkAffordance = { saved: new Set(), own: new Set() };
const EMPTY_REPLIES: ReplyGroups = { support: [], counter: [], twoSlot: [] };

/** Asymmetric on purpose — a 50/50 split hides a swapped fill. */
const AGGREGATE = {
	supportCount: 2,
	counterCount: 1,
	supportDharma: "1000.000000000000000000",
	counterDharma: "2000.000000000000000000",
};

/** Neutral fixture prose — no invented market content (CLAUDE.md §3). */
function presentPost(side: Side): DebatePost {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-00000000af01",
		ordinal: 1,
		sideAtPostTime: side,
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

function renderFooter(side: Side) {
	const { container } = render(
		<PostCard
			post={presentPost(side)}
			bookmarks={VIEWER}
			onEnter={noop}
			onOpenPopup={noop}
			onOpenImage={noop}
		/>,
	);
	const footer = container.querySelector('[data-testid="aggregate-footer"]');
	expect(footer).not.toBeNull();
	return footer as Element;
}

function classOf(root: Element, testid: string): string {
	const node = root.querySelector(`[data-testid="${testid}"]`);
	expect(node).not.toBeNull();
	return node?.getAttribute("class") ?? "";
}

describe("POLISH.3 PR 2 — T3, the market-view split bar's visual half", () => {
	it("aggregate-footer::renders-a-split-bar-with-a-track-and-a-fill", () => {
		// Presence, before poling. The shipped body is a plain text row; the
		// mockup's `.barrow.f2` is a bar.
		const footer = renderFooter("YES");

		expect(
			footer.querySelector('[data-testid="aggregate-split-track"]'),
		).not.toBeNull();
		expect(
			footer.querySelector('[data-testid="aggregate-split-fill"]'),
		).not.toBeNull();
	});

	it("aggregate-footer::on-a-YES-post-the-support-fill-takes-the-YES-pole", () => {
		// Assertion 1 of 4. Support on a YES post resolves to YES.
		const footer = renderFooter("YES");

		expect(classOf(footer, "aggregate-split-fill")).toContain("bg-yes");
	});

	it("aggregate-footer::on-a-YES-post-the-track-takes-the-NO-pole", () => {
		// Assertion 2 of 4. The track is the counter remainder — the opposite
		// side — so it carries the opposite pole.
		const footer = renderFooter("YES");

		expect(classOf(footer, "aggregate-split-track")).toContain("bg-no");
	});

	it("aggregate-footer::on-a-NO-post-the-support-fill-takes-the-NO-pole", () => {
		// ⛔ Assertion 3 of 4 — THE ONE A FIXED-POLE BAR FAILS. Support on a NO
		// post resolves to NO, so the same "support share" element must flip
		// pole. A bar hard-coded `bg-yes` renders the NO-side share in the YES
		// pole on every NO post and passes assertions 1 and 2 regardless.
		const footer = renderFooter("NO");

		expect(classOf(footer, "aggregate-split-fill")).toContain("bg-no");
	});

	it("aggregate-footer::on-a-NO-post-the-track-takes-the-YES-pole", () => {
		// Assertion 4 of 4, the mirror.
		const footer = renderFooter("NO");

		expect(classOf(footer, "aggregate-split-track")).toContain("bg-yes");
	});
});
