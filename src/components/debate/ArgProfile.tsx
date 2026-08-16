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
 * ✅ THE `→ now` HALF LANDED AT HTML-FINISH · MARKET DETAIL row 14, and D7's
 * deferral is discharged FOR IT. `Đ a → Đ now` renders when — and only when —
 * the server sends an `authorValue`, which it does under a deliberately narrow
 * predicate (marker `none` AND exactly one stake-bearing comment by that author
 * in this market; plan F-5 / OD-1, founder-ruled). ⛔ The component does NOT
 * decide this and must never infer it: an arrow drawn from a per-POST stake to
 * a per-MARKET holding is a false claim about money, and the server is where
 * the truth of it is known. `authorValue === null` ⇒ `Đ a` alone, unchanged.
 * ⚠ The `@entry%` half is still row 13's and is NOT taken here.
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
	authorValue,
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
	/**
	 * HTML-FINISH · MARKET DETAIL row 14 — the author's CURRENT value (Đb basis).
	 * `undefined`/`null` ⇒ the arrow does not render and `Đ a` stands alone. The
	 * gate is the SERVER's (see this file's docblock and
	 * `load-debate-view.ts`'s `authorValue`); this prop only carries the answer.
	 */
	authorValue?: string | null;
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
						<span className="font-mono">
							Đ {formatDharma(authorStake)}
							{/* `.ppos` (`d5:966`) — `Đ 1,000 → Đ 1,407`. The arrow is
							    `aria-hidden`: it is punctuation between two figures that
							    already read as themselves, and announcing "right arrow"
							    adds nothing. Canon §107 spaced `Đ ` grammar on BOTH
							    halves — `no-raw-dharma-render` reads them. */}
							{authorValue != null ? (
								<>
									{" "}
									<span aria-hidden="true">→</span> Đ{" "}
									{formatDharma(authorValue)}
								</>
							) : null}
						</span>
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
