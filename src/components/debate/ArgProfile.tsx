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
 * author's own stake `a` · reply count · the bookmark/download card actions.
 * The marker chip sits after the side badge, before the stake (D5).
 *
 * BOOKMARK-ADD-WIRE: the bookmark trigger is now LIVE — `CardActions` owns the
 * full icon matrix (signed-out disabled / own-argument absent / active
 * outline-or-filled). The download trigger stays present-but-disabled (C1 / §7).
 * The `@entry%`/`→now` enrichments are deferred (D7) — just the side and `Đ a`,
 * never `YES @ 27%` or `Đ a → Đ now`.
 *
 * `showActions` semantics are UNCHANGED: it gates the ENTIRE cluster (bookmark
 * AND download), so it is deliberately NOT the own-suppression hook — using it
 * that way would also strip the download trigger from the viewer's own
 * arguments. Own-suppression is a condition inside `BookmarkToggle`.
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
						<span className="font-mono">Đ{formatDharma(authorStake)}</span>
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
