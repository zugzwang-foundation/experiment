// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	type BookmarkAffordance,
	BookmarkToggle,
	CardActions,
} from "@/components/bookmarks/BookmarkToggle";
import { ArgProfile } from "@/components/debate/ArgProfile";
import { PostCard } from "@/components/debate/PostCard";
import type { DebatePost, ReplyGroups } from "@/components/debate/types";

/**
 * BOOKMARK-ADD-WIRE Slice 2 — the bookmark icon matrix (plan §4 "Icon states"),
 * asserted at the render layer.
 *
 * WHY THIS FILE EXISTS. The plan's §7 declared UI behaviour an unavoidable
 * coverage gap ("AGENTS.md §9 documents no component-test harness") and ranked
 * it self-critique #3. That premise is FALSE on disk: `@testing-library/react` +
 * `jsdom` are committed devDependencies and 20+ `*.test.tsx` files use them
 * under a per-file `@vitest-environment jsdom` docblock. So the riskiest new
 * logic — own-argument suppression and the removed-argument matrix, the exact
 * two things @security-auditor flagged as forward obligations — IS covered here
 * rather than deferred to manual review.
 *
 * The Server Actions are mocked: the icon matrix and the `{ ok }`-branching are
 * the laws under test, not the actions' internals (already locked by the 17-case
 * F-BM battery at `tests/server/bookmarks/*`). No DB, no network.
 *
 * Laws under test:
 *  - signed out (`bookmarks === null`) → today's DISABLED icon, verbatim.
 *  - own argument → NO bookmark control at all (not a disabled one).
 *  - other's, unsaved → active "Bookmark"; other's, saved → active "Remove
 *    bookmark", filled.
 *  - own-ness OUTRANKS saved-ness (@security-auditor forward obligation 2).
 *  - a REMOVED post renders no cluster at all (plan §5 matrix; structural).
 *  - optimistic flip, then SILENT revert on `{ ok: false }` and on a transport
 *    throw (D5 / ratified C6 — no toast, no invented copy).
 *  - the download trigger stays `disabled` in EVERY cell (plan §4).
 */

const addBookmarkAction = vi.fn();
const removeBookmarkAction = vi.fn();

vi.mock("@/server/bookmarks/add", () => ({
	addBookmarkAction: (id: string) => addBookmarkAction(id),
}));
vi.mock("@/server/bookmarks/remove", () => ({
	removeBookmarkAction: (id: string) => removeBookmarkAction(id),
}));

afterEach(cleanup);
beforeEach(() => {
	addBookmarkAction.mockReset();
	removeBookmarkAction.mockReset();
	addBookmarkAction.mockResolvedValue({ ok: true });
	removeBookmarkAction.mockResolvedValue({ ok: true });
});

const OTHERS = "0199a0c0-0000-7000-8000-00000000000a";
const MINE = "0199a0c0-0000-7000-8000-00000000000b";

/** Signed in; `OTHERS` is bookmarked, `MINE` is the viewer's own argument. */
const SIGNED_IN: BookmarkAffordance = {
	saved: new Set([OTHERS]),
	own: new Set([MINE]),
};
/** Signed in with nothing saved and nothing authored here. */
const FRESH: BookmarkAffordance = { saved: new Set(), own: new Set() };

const EMPTY_REPLIES: ReplyGroups = { support: [], counter: [], twoSlot: [] };
const AGGREGATE = {
	supportCount: 0,
	counterCount: 0,
	supportDharma: "0.000000000000000000",
	counterDharma: "0.000000000000000000",
};

/** Neutral fixture prose — no invented market content (CLAUDE.md §3). */
function presentPost(id: string): DebatePost {
	return {
		removed: false,
		id,
		ordinal: 1,
		sideAtPostTime: "YES",
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

function removedPost(id: string): DebatePost {
	return {
		removed: true,
		id,
		ordinal: 1,
		sideAtPostTime: "YES",
		createdAt: "2026-07-30T00:00:00.000Z",
		aggregate: AGGREGATE,
		replies: EMPTY_REPLIES,
	};
}

function argProfileProps(id: string, bookmarks: BookmarkAffordance) {
	return {
		commentId: id,
		author: { pseudonym: "fixture-author", pfpUrl: "" },
		side: "YES" as const,
		marker: "none" as const,
		authorStake: "10.000000000000000000",
		replyCount: 0,
		bookmarks,
	};
}

describe("BOOKMARK-ADD-WIRE — the bookmark icon matrix", () => {
	it("bookmark-toggle::signed-out-renders-the-disabled-icon", () => {
		// The shipped signed-out affordance is preserved VERBATIM — no new sign-in
		// prompt and no new copy (plan edge case 4).
		render(<BookmarkToggle commentId={OTHERS} bookmarks={null} />);

		const button = screen.getByRole("button", {
			name: "Bookmark — sign in to use",
		});
		expect((button as HTMLButtonElement).disabled).toBe(true);
		expect(button.getAttribute("aria-disabled")).toBe("true");
	});

	it("bookmark-toggle::own-argument-renders-no-control", () => {
		// NOTHING, not a disabled icon: only someone else's argument is
		// bookmarkable (D4). The absence is the assertion.
		const { container } = render(
			<BookmarkToggle commentId={MINE} bookmarks={SIGNED_IN} />,
		);

		expect(container.querySelectorAll("button")).toHaveLength(0);
	});

	it("bookmark-toggle::own-outranks-saved", () => {
		// @security-auditor forward obligation 2: the own-check runs BEFORE the
		// saved-check, so a defensively-possible self-bookmark row can never
		// surface an active icon on the viewer's own argument.
		const bookmarks: BookmarkAffordance = {
			saved: new Set([MINE]),
			own: new Set([MINE]),
		};
		const { container } = render(
			<BookmarkToggle commentId={MINE} bookmarks={bookmarks} />,
		);

		expect(container.querySelectorAll("button")).toHaveLength(0);
	});

	it("bookmark-toggle::others-unsaved-renders-active-add", () => {
		render(<BookmarkToggle commentId={OTHERS} bookmarks={FRESH} />);

		const button = screen.getByRole("button", { name: "Bookmark" });
		expect((button as HTMLButtonElement).disabled).toBe(false);
		expect(button.getAttribute("aria-pressed")).toBe("false");
		// Unsaved renders the OUTLINE icon — no fill.
		expect(button.querySelector(".fill-current")).toBeNull();
	});

	it("bookmark-toggle::others-saved-renders-active-filled-remove", () => {
		render(<BookmarkToggle commentId={OTHERS} bookmarks={SIGNED_IN} />);

		const button = screen.getByRole("button", { name: "Remove bookmark" });
		expect((button as HTMLButtonElement).disabled).toBe(false);
		expect(button.getAttribute("aria-pressed")).toBe("true");
		// Saved renders FILLED, matching UnbookmarkButton's `fill-current`.
		expect(button.querySelector(".fill-current")).not.toBeNull();
	});

	it("bookmark-toggle::click-unsaved-calls-add-and-flips-optimistically", async () => {
		render(<BookmarkToggle commentId={OTHERS} bookmarks={FRESH} />);

		fireEvent.click(screen.getByRole("button", { name: "Bookmark" }));

		expect(addBookmarkAction).toHaveBeenCalledWith(OTHERS);
		expect(removeBookmarkAction).not.toHaveBeenCalled();
		// Optimistic: the label flips before the action settles.
		expect(
			await screen.findByRole("button", { name: "Remove bookmark" }),
		).toBeTruthy();
	});

	it("bookmark-toggle::click-saved-calls-remove", async () => {
		render(<BookmarkToggle commentId={OTHERS} bookmarks={SIGNED_IN} />);

		fireEvent.click(screen.getByRole("button", { name: "Remove bookmark" }));

		expect(removeBookmarkAction).toHaveBeenCalledWith(OTHERS);
		expect(addBookmarkAction).not.toHaveBeenCalled();
		expect(
			await screen.findByRole("button", { name: "Bookmark" }),
		).toBeTruthy();
	});

	it("bookmark-toggle::returned-failure-reverts-silently", async () => {
		// The actions RETURN failures and never throw (add.ts:23-28). A caller that
		// discarded `{ ok }` would leave the icon lying about the saved state.
		addBookmarkAction.mockResolvedValue({
			ok: false,
			code: "unauthenticated",
		});
		render(<BookmarkToggle commentId={OTHERS} bookmarks={FRESH} />);

		fireEvent.click(screen.getByRole("button", { name: "Bookmark" }));

		// Reverted to unsaved — and no user-facing failure copy anywhere (C6).
		expect(
			await screen.findByRole("button", { name: "Bookmark" }),
		).toBeTruthy();
		expect(screen.queryByText(/error|failed|try again/i)).toBeNull();
	});

	it("bookmark-toggle::transport-throw-reverts-silently", async () => {
		// The actions never throw BY CONTRACT, but the RPC transport can.
		removeBookmarkAction.mockRejectedValue(new Error("transport"));
		render(<BookmarkToggle commentId={OTHERS} bookmarks={SIGNED_IN} />);

		fireEvent.click(screen.getByRole("button", { name: "Remove bookmark" }));

		expect(
			await screen.findByRole("button", { name: "Remove bookmark" }),
		).toBeTruthy();
	});
});

describe("BOOKMARK-ADD-WIRE — the cluster on the card surfaces", () => {
	it("card-actions::download-stays-disabled-in-every-viewer-state", () => {
		// The download trigger is out of scope and must stay disabled on every card
		// in every cell of the matrix (plan §4 / §8).
		for (const bookmarks of [null, FRESH, SIGNED_IN] as BookmarkAffordance[]) {
			const { unmount } = render(
				<CardActions commentId={OTHERS} bookmarks={bookmarks} />,
			);
			const download = screen.getByRole("button", {
				name: "Download — sign in to use",
			});
			expect((download as HTMLButtonElement).disabled).toBe(true);
			expect(download.getAttribute("aria-disabled")).toBe("true");
			unmount();
		}
	});

	it("card-actions::own-argument-keeps-the-download-trigger", () => {
		// `showActions` is NOT the own-suppression hook: suppressing the whole
		// cluster would strip download from the viewer's own arguments too.
		render(<CardActions commentId={MINE} bookmarks={SIGNED_IN} />);

		expect(
			screen.getByRole("button", { name: "Download — sign in to use" }),
		).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Bookmark" })).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Remove bookmark" }),
		).toBeNull();
	});

	it("arg-profile::threads-the-affordance-to-the-cluster", () => {
		render(<ArgProfile {...argProfileProps(OTHERS, SIGNED_IN)} />);

		expect(
			screen.getByRole("button", { name: "Remove bookmark" }),
		).toBeTruthy();
	});

	it("arg-profile::show-actions-false-renders-no-cluster", () => {
		render(
			<ArgProfile
				{...argProfileProps(OTHERS, SIGNED_IN)}
				showActions={false}
			/>,
		);

		expect(
			screen.queryByRole("button", { name: "Remove bookmark" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Download — sign in to use" }),
		).toBeNull();
	});

	it("post-card::present-post-renders-the-add-affordance", () => {
		render(
			<PostCard
				post={presentPost(OTHERS)}
				bookmarks={FRESH}
				onEnter={() => {}}
				onOpenPopup={() => {}}
				onOpenImage={() => {}}
			/>,
		);

		expect(screen.getByRole("button", { name: "Bookmark" })).toBeTruthy();
	});

	it("post-card::removed-post-renders-no-bookmark-affordance", () => {
		// THE masking law B1 propagates (plan §5 / D3): a removed argument never
		// renders an ADD affordance. Structural, not conditional — the removed
		// union variant carries no `author`/`marker`, so `ArgProfile` (and with it
		// the whole cluster) cannot be constructed on this branch.
		render(
			<PostCard
				post={removedPost(OTHERS)}
				bookmarks={FRESH}
				onEnter={() => {}}
				onOpenPopup={() => {}}
				onOpenImage={() => {}}
			/>,
		);

		expect(screen.queryByRole("button", { name: "Bookmark" })).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Remove bookmark" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Bookmark — sign in to use" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Download — sign in to use" }),
		).toBeNull();
	});
});
