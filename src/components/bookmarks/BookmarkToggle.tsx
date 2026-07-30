"use client";

import { Bookmark, Download } from "lucide-react";
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
 * | signed in · own argument          | NOTHING — only someone else's argument is bookmarkable |
 * | signed in · other's, not saved    | active outline icon → `addBookmarkAction` |
 * | signed in · other's, saved        | active FILLED icon → `removeBookmarkAction` |
 *
 * A REMOVED argument renders no cluster at all; that is enforced by the call
 * sites (structurally for posts — `ArgProfile` cannot be constructed on the
 * removed union variant, which carries no `author`/`marker` — and by branch
 * placement for replies), never by a check in here.
 *
 * The own-check runs BEFORE the saved-check on purpose: `add.ts:62` rejects a
 * self-bookmark, but if a row ever existed defensively, own-ness must still win
 * so a viewer can never be shown an active icon on their own argument.
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

	if (bookmarks === null) {
		return (
			<Button
				variant="ghost"
				size="icon-xs"
				disabled
				aria-disabled="true"
				aria-label="Bookmark — sign in to use"
			>
				<Bookmark />
			</Button>
		);
	}

	if (bookmarks.own.has(commentId)) {
		return null;
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
 * The card action cluster (design-language §3.1) — bookmark + download, in that
 * order. Co-located with `BookmarkToggle` rather than given its own file so the
 * POST card (`ArgProfile`) and the REPLY card (`ReplyCard`) render the cluster
 * from ONE source: ratified correction C3 requires the reply card to match
 * `ArgProfile` byte-for-byte, and duplicated markup in two files is exactly how
 * that drifts.
 *
 * The download trigger stays present-but-disabled on every card and in every
 * viewer state (C1/§7 as shipped) — wiring the ADR-0025 export button is a
 * separate task.
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
			<BookmarkToggle commentId={commentId} bookmarks={bookmarks} />
			<Button
				variant="ghost"
				size="icon-xs"
				disabled
				aria-disabled="true"
				aria-label="Download — sign in to use"
			>
				<Download />
			</Button>
		</div>
	);
}
