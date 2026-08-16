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
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import { ReplyCard } from "@/components/debate/ReplyCard";
import { ReplyPreview } from "@/components/debate/ReplyPreview";
import { PostScroller, ReplyScroller } from "@/components/debate/scrollers";
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
 *  - ⛔ the download trigger is ABSENT from every cell — removed at POLISH.3
 *    PR 2 row 7 (`PD-3-15`, D3 RULED).
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

/** HTML-FINISH · MARKET DETAIL row 27 — the reply pop-up host. These suites
 * assert bookmarks / spacing / partitioning / images, never the pop-up, so a
 * no-op is the honest stand-in. `reply-card.test.tsx` is where the `+` is
 * pinned. */
const noopPopup = () => {};

/** HTML-FINISH · MARKET DETAIL row 26 — the reply-image lightbox host.
 * These suites assert bookmarks / spacing / partitioning, never the image, so
 * a no-op is the honest stand-in: it keeps the prop REQUIRED at the component
 * (O-1) without pretending this file tests the lightbox. */
const noopImage = () => {};
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
	it("card-actions::download-trigger-is-REMOVED-in-every-viewer-state", () => {
		// Row 7 · PD-3-15 · D3 RULED 2026-08-12 — REMOVED, the same disposition as
		// R1's two card controls. This test previously asserted the trigger stayed
		// DISABLED in every cell; it now asserts it is ABSENT from every cell, and
		// the matrix loop is what makes that a claim about the whole viewer state
		// space rather than about one render.
		for (const bookmarks of [null, FRESH, SIGNED_IN] as BookmarkAffordance[]) {
			const { unmount } = render(
				<CardActions commentId={OTHERS} bookmarks={bookmarks} />,
			);
			expect(
				screen.queryByRole("button", { name: "Download — sign in to use" }),
			).toBeNull();
			unmount();
		}
	});

	it("card-actions::own-argument-renders-no-cluster-controls", () => {
		// ⚠ RENAMED AT ROW 7. The old name was `own-argument-keeps-the-download-
		// trigger`, which is now FALSE — a name is an assertion, and a stale one is
		// a false receipt a reader greps and believes without opening the body.
		// The law it guarded survives: `showActions` is NOT the own-suppression
		// hook. Own-suppression is a condition inside `BookmarkToggle`.
		render(<CardActions commentId={MINE} bookmarks={SIGNED_IN} />);

		expect(
			screen.queryByRole("button", { name: "Download — sign in to use" }),
		).toBeNull();
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
				onReplyToPost={() => {}}
				heldSide={null}
				marketOpen
				suspended={false}
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
				onReplyToPost={() => {}}
				heldSide={null}
				marketOpen
				suspended={false}
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

/**
 * Gate-C remediation (HIGH-1). THE defect class the 15 cases above could not see:
 * every one of them fresh-`render()`s a toggle, so none exercises the path where a
 * MOUNTED toggle is handed a DIFFERENT comment.
 *
 * `PostScroller` pages posts by mutating its own `index` state, re-rendering the
 * same `<PostCard>` element at the same tree position with no `key`. React
 * reconciles that to the SAME instance, so `BookmarkToggle`'s mount-seeded
 * `useState` never re-runs and the icon keeps the PREVIOUS post's fill — a lie
 * that does not self-heal (paging triggers no server render; there is
 * deliberately no `router.refresh()`, D5).
 *
 * These two cases must FAIL before the one-line `key={commentId}` fix in
 * `CardActions` and PASS after. They are deliberately placed at `CardActions`
 * (the unit that carries the key) and at `PostScroller` (the real user path), NOT
 * at a bare `BookmarkToggle` — a bare toggle has no key above it, so it would
 * stay red after the fix and prove nothing.
 */
describe("BOOKMARK-ADD-WIRE — icon state follows the comment, not the mount", () => {
	it("card-actions::rerender-with-new-comment-reflects-new-saved-state", () => {
		// OTHERS is saved; SECOND is not. Same element, same position, new target.
		const SECOND = "0199a0c0-0000-7000-8000-00000000000c";
		const { rerender } = render(
			<CardActions commentId={OTHERS} bookmarks={SIGNED_IN} />,
		);
		expect(
			screen.getByRole("button", { name: "Remove bookmark" }),
		).toBeTruthy();

		rerender(<CardActions commentId={SECOND} bookmarks={SIGNED_IN} />);

		// The unsaved comment must render the ADD affordance, not the stale filled one.
		expect(screen.getByRole("button", { name: "Bookmark" })).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: "Remove bookmark" }),
		).toBeNull();
	});

	it("post-scroller::paging-to-an-unsaved-post-drops-the-filled-icon", () => {
		// The real reproduction: two posts on one side, the first bookmarked and the
		// second not. Paging must not carry the first post's filled icon onto the
		// second — clicking it there would fire removeBookmarkAction against a row
		// that never existed.
		const SECOND = "0199a0c0-0000-7000-8000-00000000000c";
		render(
			<PostScroller
				posts={[presentPost(OTHERS), presentPost(SECOND)]}
				side="YES"
				bookmarks={SIGNED_IN}
				onEnter={() => {}}
				onOpenPopup={() => {}}
				onOpenImage={() => {}}
				onReplyToPost={() => {}}
				heldSide={null}
				marketOpen
				suspended={false}
			/>,
		);
		expect(
			screen.getByRole("button", { name: "Remove bookmark" }),
		).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Next post" }));

		expect(screen.getByRole("button", { name: "Bookmark" })).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: "Remove bookmark" }),
		).toBeNull();
	});
});

/** Present (non-removed) reply fixture. */
function presentReply(id: string) {
	return {
		removed: false as const,
		id,
		side: "YES" as const,
		createdAt: "2026-07-30T00:00:00.000Z",
		body: "Fixture reply body.",
		marker: "none" as const,
		author: { pseudonym: "fixture-replier", pfpUrl: "" },
		stake: "5.000000000000000000",
		entryPrice: "0.500000000000000000",
		imageUrl: null,
	};
}

/** Removed reply fixture — no body/author/marker/stake at the type level. */
function removedReply(id: string) {
	return {
		removed: true as const,
		id,
		side: "YES" as const,
		createdAt: "2026-07-30T00:00:00.000Z",
	};
}

/**
 * Every way a clickable affordance can present itself in the DOM: native
 * interactive elements, anchors that actually navigate/download (`a[href]` —
 * the UI.14 export case), the ARIA interactive roles, editable hosts, and
 * anything deliberately placed in the tab order. Used by the removed-reply
 * masking guard, which must assert the PROPERTY ("no interactive affordance")
 * rather than one element type. Extend this list when a new affordance kind
 * enters the codebase; never narrow it.
 */
const INTERACTIVE_SELECTOR = [
	"button",
	"a[href]",
	"input",
	"select",
	"textarea",
	"summary",
	"[role='button']",
	"[role='link']",
	"[role='checkbox']",
	"[role='switch']",
	"[role='menuitem']",
	"[role='tab']",
	"[contenteditable='true']",
	"[tabindex]:not([tabindex='-1'])",
].join(",");

/** The rendered cluster's markup, located from the bookmark button's parent. */
function clusterHtml(container: HTMLElement): string {
	const button = container.querySelector(
		'button[aria-label="Bookmark"],button[aria-label="Remove bookmark"],button[aria-label="Bookmark — sign in to use"]',
	);
	return button?.parentElement?.outerHTML ?? "";
}

/**
 * BOOKMARK-ADD-WIRE Slice 3 — the reply card carries the FULL cluster (ratified
 * correction C3: the cluster matches ArgProfile byte-for-byte — the download
 * half was removed at row 7), and the masking rule holds on a branch
 * that — unlike the post path — has NO type-level lock.
 */
describe("BOOKMARK-ADD-WIRE — the reply card cluster", () => {
	it("reply-card::present-reply-renders-the-bookmark-affordance", () => {
		// ⚠ RENAMED AT ROW 7 — "the full cluster" was a two-control claim, and the
		// cluster is now one control.
		render(
			<ReplyCard
				reply={presentReply(OTHERS)}
				bookmarks={SIGNED_IN}
				onOpenImage={noopImage}
				onOpenPopup={noopPopup}
			/>,
		);

		expect(
			screen.getByRole("button", { name: "Remove bookmark" }),
		).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: "Download — sign in to use" }),
		).toBeNull();
	});

	it("reply-card::cluster-matches-argprofile-byte-for-byte", () => {
		// C3 asserted structurally, not by copy-paste discipline: both surfaces
		// render the SAME `CardActions`, so their cluster markup must be identical
		// character-for-character for the same (commentId, viewer state).
		const { container: argContainer, unmount } = render(
			<ArgProfile {...argProfileProps(OTHERS, SIGNED_IN)} />,
		);
		const fromArgProfile = clusterHtml(argContainer);
		unmount();

		const { container: replyContainer } = render(
			<ReplyCard
				reply={presentReply(OTHERS)}
				bookmarks={SIGNED_IN}
				onOpenImage={noopImage}
				onOpenPopup={noopPopup}
			/>,
		);
		const fromReplyCard = clusterHtml(replyContainer);

		expect(fromArgProfile).not.toBe("");
		expect(fromReplyCard).toBe(fromArgProfile);
	});

	it("reply-card::removed-reply-renders-no-cluster", () => {
		// @security-auditor forward obligation 1. The post path is protected by the
		// type system (the removed variant carries no author/marker, so ArgProfile
		// cannot be built); a REPLY's removed variant still carries an `id`, so a
		// cluster in the removed branch WOULD compile. This test is the only guard.
		//
		// THE ASSERTION IS PROPERTY-SHAPED ON PURPOSE — DO NOT "SIMPLIFY" IT BACK TO
		// COUNTING `<button>`s. The property is "a removed argument renders NO
		// INTERACTIVE AFFORDANCE", not "renders no button element". Those coincide
		// only while every affordance happens to be a `<button>`. The moment UI.14
		// wires the ADR-0025 export as `<a href download>`, a cluster leaked into
		// this branch for an OWN-argument viewer renders the bookmark as `null` and
		// the download as an anchor — zero buttons, one anchor. A button count would
		// pass while masking is broken, and a `queryByRole(… { name })` check misses
		// it too, because a relabelled control never matches the name. So the sweep
		// below is by ELEMENT TYPE + ARIA ROLE + FOCUSABILITY, and it is the shape
		// that survives the next affordance we add.
		const { container } = render(
			<ReplyCard
				reply={removedReply(OTHERS)}
				bookmarks={SIGNED_IN}
				onOpenImage={noopImage}
				onOpenPopup={noopPopup}
			/>,
		);

		// Non-vacuity first: prove the removed branch actually rendered, so an
		// empty sweep can never be mistaken for a pass on a card that rendered
		// nothing at all.
		expect(screen.getByText(REMOVED_STUB_TEXT)).toBeTruthy();

		// `.outerHTML` rather than a bare count so a failure names what leaked.
		const affordances = Array.from(
			container.querySelectorAll(INTERACTIVE_SELECTOR),
		).map((el) => el.outerHTML);
		expect(affordances).toEqual([]);
	});

	it("reply-scroller::paging-to-an-unsaved-reply-drops-the-filled-icon", () => {
		// R5 — assert, do not assume, that the CardActions key fix covers the
		// ReplyScroller path: it renders <ReplyCard> UN-KEYED, exactly like
		// PostScroller renders <PostCard>.
		const SECOND = "0199a0c0-0000-7000-8000-00000000000c";
		render(
			<ReplyScroller
				replies={[presentReply(OTHERS), presentReply(SECOND)]}
				side="YES"
				bookmarks={SIGNED_IN}
				onOpenImage={noopImage}
				onOpenPopup={noopPopup}
			/>,
		);
		expect(
			screen.getByRole("button", { name: "Remove bookmark" }),
		).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Next reply" }));

		expect(screen.getByRole("button", { name: "Bookmark" })).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: "Remove bookmark" }),
		).toBeNull();
	});

	it("reply-preview::each-listed-reply-gets-its-own-icon-state", () => {
		// R5 — the ReplyPreview path. It outer-keys each <ReplyCard key={reply.id}>,
		// so both cards mount independently: the saved reply renders the filled
		// remove affordance and the unsaved one renders the add affordance, side by
		// side in the same list.
		const SECOND = "0199a0c0-0000-7000-8000-00000000000c";
		const twoSlot = [presentReply(OTHERS), presentReply(SECOND)];
		render(
			<ReplyPreview
				replies={{ support: twoSlot, counter: [], twoSlot }}
				bookmarks={SIGNED_IN}
				onOpenImage={noopImage}
				onOpenPopup={noopPopup}
			/>,
		);

		expect(
			screen.getByRole("button", { name: "Remove bookmark" }),
		).toBeTruthy();
		expect(screen.getByRole("button", { name: "Bookmark" })).toBeTruthy();
	});

	it("reply-card::own-reply-renders-no-bookmark-and-no-download", () => {
		// ⚠ RENAMED AT ROW 7. Own-suppression reaches the reply surface too; with
		// the download trigger removed the own-reply cluster now renders nothing.
		render(
			<ReplyCard
				reply={presentReply(MINE)}
				bookmarks={SIGNED_IN}
				onOpenImage={noopImage}
				onOpenPopup={noopPopup}
			/>,
		);

		expect(screen.queryByRole("button", { name: "Bookmark" })).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Remove bookmark" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Download — sign in to use" }),
		).toBeNull();
	});
});
