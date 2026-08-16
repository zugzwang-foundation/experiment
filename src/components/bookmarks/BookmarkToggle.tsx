"use client";

import { Bookmark } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { addBookmarkAction } from "@/server/bookmarks/add";
import { removeBookmarkAction } from "@/server/bookmarks/remove";

/**
 * BOOKMARK-ADD-WIRE — the viewer's bookmark affordance state for one market,
 * derived ONCE in `DebateView` from the two ID-only arrays on
 * `ViewerMarketContext` and prop-drilled to the card renders.
 *
 * `null` means SIGNED OUT (there is no anonymous bookmark set, `add.ts` D-6) —
 * distinct from a signed-in viewer with two empty sets. Sets, not arrays: the
 * arrays cross the RSC → client boundary (a `Set` does not serialize), and the
 * client converts once rather than doing a linear scan per card.
 */
export type BookmarkAffordance = {
	/** Comment ids in this market the viewer has already bookmarked. */
	saved: Set<string>;
	/** Comment ids in this market the viewer AUTHORED (own-suppression, D4). */
	own: Set<string>;
} | null;

/**
 * The bookmark trigger on a post/reply card — the single source of the icon
 * matrix (plan §4), so every newly-wired surface renders identical states:
 *
 * | signed out (`bookmarks === null`) | the DISABLED "sign in to use" icon, verbatim as shipped |
 * | signed in · own argument          | the DISABLED "your own argument" icon — R4, see below |
 * | signed in · other's, not saved    | active outline icon → `addBookmarkAction` |
 * | signed in · other's, saved        | active FILLED icon → `removeBookmarkAction` |
 *
 * ⚠⚠ HTML-FINISH · MARKET DETAIL round 2 · R4 — THE OWN-ARGUMENT CELL USED TO
 * RENDER `null`, AND THE FOUNDER RULED AGAINST IT ON 2026-08-16 after seeing it
 * on staging: *"it renders on one card and not the other"*. MEASURED at
 * `/m/sp-m15-fill` signed in as `RedFox000` — the YES card is that viewer's own
 * argument and drew NO affordance; the NO card is `BlueWolf011`'s and drew one.
 * The whole page held exactly ONE bookmark button. That asymmetry reads as a
 * broken render, because nothing on screen explains why one card has a control
 * and its neighbour does not. The affordance is now UNCONDITIONAL: every card,
 * both arms, always an icon.
 *
 * ⛔ DISABLED, NOT ENABLED, AND THAT IS FORCED — not a softening of the ruling.
 * `add.ts:62` rejects a self-bookmark at the write boundary with
 * `self_bookmark_forbidden` (D-3: a bookmark is a pointer at SOMEONE ELSE's
 * argument). An ENABLED icon here would flip optimistically, get `{ ok: false }`,
 * and silently revert — a control that cannot ever succeed, which is strictly
 * worse than the absence the founder objected to. Making it succeed instead
 * would mean editing `src/server/bookmarks/add.ts`, and round 2 §2 forbids a
 * fourth `src/server/**` file outright. ⇒ Rendered always; actionable only where
 * the server would accept it.
 *
 * ⚠ THE OWN-CELL REUSES THE SHIPPED DISABLED RENDER — same `variant`, same
 * `size`, same `disabled` + `aria-disabled` pair, same outline glyph. Only the
 * accessible name differs, because the two refusals have different remedies:
 * signing in fixes one and nothing fixes the other.
 *
 * A REMOVED argument renders no cluster at all; that is enforced by the call
 * sites (structurally for posts — `ArgProfile` cannot be constructed on the
 * removed union variant, which carries no `author`/`marker` — and by branch
 * placement for replies), never by a check in here. ⛔ R4 DOES NOT TOUCH THAT:
 * it changes what the PRESENT branch draws, so no masking surface moves and
 * SC-1 does not fire (no read over `comments.body` is added or edited).
 *
 * The own-check runs BEFORE the saved-check on purpose: `add.ts:62` rejects a
 * self-bookmark, but if a row ever existed defensively, own-ness must still win
 * so a viewer can never be shown an ACTIVE icon on their own argument. R4 makes
 * that ordering MORE load-bearing, not less — it is now the only thing standing
 * between a self-bookmarked row and a live "Remove bookmark" button.
 *
 * Optimistic, with revert on failure (D5). Both actions RETURN typed failures
 * and never throw by contract, so the caller MUST branch on `{ ok }` — but the
 * RPC transport itself can reject, hence the `catch`. Failure handling is a
 * SILENT revert (ratified C6): there is no toast infrastructure in the repo and
 * inventing user-facing failure copy is out of bounds. Invalidation stays
 * caller-owned — deliberately NO `router.refresh()` here: these arrays feed icon
 * state only, and a refresh would re-run `loadDebateView`'s 13–14 sequential
 * queries for an icon toggle (contrast `UnbookmarkButton`, whose item must drop
 * from a list).
 */
export function BookmarkToggle({
	commentId,
	bookmarks,
}: {
	commentId: string;
	bookmarks: BookmarkAffordance;
}) {
	// Seeded from the prop at mount. Per-instance by design: the same comment can
	// be mounted twice (market column + focus header; ReplyPreview + ReplyScroller)
	// and the two instances may disagree until the next server render — accepted
	// for v1 (plan edge case 6 / self-critique #2), a transient cosmetic divergence.
	const [saved, setSaved] = useState(
		() => bookmarks?.saved.has(commentId) ?? false,
	);
	const [pending, startTransition] = useTransition();

	// THE TWO INERT CELLS, RENDERED BY ONE BRANCH (R4) so they cannot drift apart
	// in anything but their accessible name — which is the ONLY thing that should
	// differ, because the two refusals have different remedies. `null` here means
	// "this viewer may act on this comment"; a string is the reason they may not.
	const inert =
		bookmarks === null
			? "Bookmark — sign in to use"
			: bookmarks.own.has(commentId)
				? "Bookmark — your own argument"
				: null;
	if (inert !== null) {
		return (
			<Button
				variant="ghost"
				size="icon-xs"
				disabled
				aria-disabled="true"
				aria-label={inert}
			>
				<Bookmark />
			</Button>
		);
	}

	const onClick = () => {
		const next = !saved;
		setSaved(next);
		startTransition(async () => {
			try {
				const result = next
					? await addBookmarkAction(commentId)
					: await removeBookmarkAction(commentId);
				if (!result.ok) {
					setSaved(!next);
				}
			} catch {
				// Transport rejection (the actions never throw by contract). Never
				// leave the icon in a lying state.
				setSaved(!next);
			}
		});
	};

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-xs"
			disabled={pending}
			aria-label={saved ? "Remove bookmark" : "Bookmark"}
			aria-pressed={saved}
			onClick={onClick}
		>
			<Bookmark className={saved ? "fill-current" : undefined} />
		</Button>
	);
}

/**
 * The card action cluster (design-language §3.1) — the bookmark trigger.
 * Co-located with `BookmarkToggle` rather than given its own file so the
 * POST card (`ArgProfile`) and the REPLY card (`ReplyCard`) render the cluster
 * from ONE source: ratified correction C3 requires the reply card to match
 * `ArgProfile` byte-for-byte, and duplicated markup in two files is exactly how
 * that drifts.
 *
 * ⛔ THE DOWNLOAD TRIGGER IS REMOVED (POLISH.3 PR 2 row 7, `PD-3-15`; D3 RULED
 * 2026-08-12, the same disposition as R1's two card controls). It was a THIRD
 * permanently-disabled control rendering on every post and every reply, and no
 * register row had named it — canon §10 item 2's "wire the icon or remove it"
 * was scoped by SURFACE (Profile + Bookmarks) rather than by COMPONENT, so a
 * shared control inherited the disabled state on a surface the rule never
 * named. Wiring the ADR-0025 export remains a separate task; when it lands it
 * arrives as an `<a href download>`, not as a disabled button.
 */
export function CardActions({
	commentId,
	bookmarks,
}: {
	commentId: string;
	bookmarks: BookmarkAffordance;
}) {
	return (
		<div className="ml-auto flex shrink-0 items-center gap-0.5">
			{/*
			 * `key={commentId}` is load-bearing (Gate-C remediation, HIGH-1). The
			 * scrollers page cards by re-rendering the SAME element at the same tree
			 * position with a new post/reply and no key, so React reconciles to the
			 * same instance and `BookmarkToggle`'s mount-seeded `useState` would keep
			 * the PREVIOUS comment's saved state — a filled icon on an unsaved
			 * argument, which does not self-heal (paging triggers no server render,
			 * D5). Keying by the target remounts ONLY this stateful leaf on a comment
			 * change; scroll position, image loads and animation state elsewhere in
			 * the card are untouched. It covers PostScroller, ReplyScroller and
			 * ReplyPreview alike, because every card renders its cluster through here.
			 */}
			<BookmarkToggle
				key={commentId}
				commentId={commentId}
				bookmarks={bookmarks}
			/>
		</div>
	);
}
