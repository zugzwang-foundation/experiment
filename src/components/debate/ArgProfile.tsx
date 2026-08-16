import {
	type BookmarkAffordance,
	CardActions,
} from "@/components/bookmarks/BookmarkToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { PositionMarker, SideBadge } from "./badges";
import { formatDharma } from "./format";
import type { AuthorIdentity, Marker, Side } from "./types";

/**
 * A post/reply author header (design-language §3.1 "argprofile"): avatar (PFP
 * placeholder, D8) · pseudonym · frozen SideBadge · live PositionMarker · the
 * author's own stake `a` · reply count · the bookmark card action.
 * The marker chip sits after the side badge, before the stake (D5).
 *
 * BOOKMARK-ADD-WIRE: the bookmark trigger is now LIVE — `CardActions` owns the
 * full icon matrix (signed-out disabled / own-argument absent / active
 * outline-or-filled). ⛔ The download trigger was REMOVED at POLISH.3 PR 2
 * row 7 (`PD-3-15`).
 * The `@entry%`/`→now` enrichments are deferred (D7) — just the side and `Đ a`,
 * never `YES @ 27%` or `Đ a → Đ now`.
 *
 * `showActions` semantics are UNCHANGED: it gates the ENTIRE cluster, so it is
 * deliberately NOT the own-suppression hook. Own-suppression is a condition
 * inside `BookmarkToggle`. ⚠ The original reason for that separation was that
 * `showActions` would also strip the DOWNLOAD trigger from the viewer's own
 * arguments; row 7 removed that trigger, but the separation stands on its own
 * — `showActions` is a caller-side layout switch and own-ness is a viewer
 * fact, and collapsing them would re-couple two unrelated decisions.
 */
export function ArgProfile({
	commentId,
	author,
	side,
	marker,
	authorStake,
	replyCount,
	bookmarks,
	showActions = true,
}: {
	/** The comment this header belongs to — the bookmark target (`post.id`). */
	commentId: string;
	author: AuthorIdentity;
	side: Side;
	marker: Marker;
	authorStake?: string;
	replyCount?: number;
	/** Viewer bookmark state for this market; `null` when signed out. */
	bookmarks: BookmarkAffordance;
	showActions?: boolean;
}) {
	return (
		<div className="flex items-start gap-2">
			<Avatar size="sm">
				<AvatarImage src={author.pfpUrl} alt="" />
				<AvatarFallback>
					{author.pseudonym.slice(0, 2).toUpperCase()}
				</AvatarFallback>
			</Avatar>
			<div className="flex min-w-0 flex-col gap-1">
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="truncate text-sm font-medium">
						{author.pseudonym}
					</span>
					<SideBadge side={side} />
					<PositionMarker marker={marker} />
				</div>
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					{authorStake !== undefined ? (
						<span className="font-mono">Đ {formatDharma(authorStake)}</span>
					) : null}
					{replyCount !== undefined ? (
						<>
							<span aria-hidden="true">·</span>
							<span>Replies · {replyCount}</span>
						</>
					) : null}
				</div>
			</div>
			{showActions ? (
				<CardActions commentId={commentId} bookmarks={bookmarks} />
			) : null}
		</div>
	);
}
