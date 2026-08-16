import {
	type BookmarkAffordance,
	CardActions,
} from "@/components/bookmarks/BookmarkToggle";

import { PositionMarker, SideBadge } from "./badges";
import { CommentImage } from "./CommentImage";
import { formatDharma } from "./format";
import { RemovedPlaceholder } from "./placeholders";
import type { DebateReply } from "./types";

/**
 * A depth-1 reply row (design-language §3.1 "Reply"): frozen side badge · live
 * position marker · reply stake · the bookmark card action · argument
 * text + author pseudonym. A removed reply renders only its frozen side + the
 * "removed by moderator" placeholder — its body/author/marker/stake were
 * withheld server-side (§6), so they are absent from `reply` at the type level.
 * No vote control anywhere (§4.3).
 *
 * BOOKMARK-ADD-WIRE (C3): the reply card carries the FULL cluster, rendered from
 * the SAME `CardActions` as `ArgProfile` so the two cannot drift. ⚠ Canon §6
 * named bookmark AND download on the reply card; the download half was REMOVED
 * at POLISH.3 PR 2 row 7 (`PD-3-15`, D3).
 *
 * MASKING — the affordance is added to the NON-REMOVED branch ONLY, and the
 * removed branch below gains nothing. Unlike the post path this is NOT enforced
 * by the type system: `DebateReply`'s removed variant still carries an `id`, so
 * a cluster placed in the removed branch WOULD compile. It is a deliberate
 * branch placement, test-locked by `reply-card::removed-reply-renders-no-cluster`
 * (@security-auditor forward obligation 1).
 */
export function ReplyCard({
	reply,
	bookmarks,
	onOpenImage,
}: {
	reply: DebateReply;
	/** Viewer bookmark state for this market; `null` when signed out. */
	bookmarks: BookmarkAffordance;
	/**
	 * HTML-FINISH · MARKET DETAIL row 26 — opens the reply's attached image in
	 * the read-only lightbox, the same host `PostFocusHeader` and `PostCard`
	 * already use. Threaded rather than owned so there is ONE lightbox on the
	 * surface, not one per card.
	 */
	onOpenImage: (url: string) => void;
}) {
	if (reply.removed) {
		return (
			<div className="flex flex-col gap-1 rounded-md p-2 [border:var(--hairline)]">
				<SideBadge side={reply.side} />
				<RemovedPlaceholder />
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-1.5 rounded-md p-2 [border:var(--hairline)]">
			<div className="flex items-center gap-1.5">
				<SideBadge side={reply.side} />
				<PositionMarker marker={reply.marker} />
				{/* The stake keeps its right alignment; the cluster sits beside it, so
				    `CardActions`' own `ml-auto` is inert inside this content-sized group. */}
				<div className="ml-auto flex items-center gap-1.5">
					<span className="font-mono text-xs text-muted-foreground">
						Đ {formatDharma(reply.stake)}
					</span>
					<CardActions commentId={reply.id} bookmarks={bookmarks} />
				</div>
			</div>
			{/* HTML-FINISH · MARKET DETAIL row 26 — the reply's own attachment.
			    ⛔ ON THE NON-REMOVED BRANCH ONLY. A removed reply's variant has no
			    `imageUrl` field at all, so this cannot compile in the branch above —
			    unlike the bookmark cluster beside it, whose placement this file
			    already records as deliberate-but-not-type-enforced. Here the type
			    system does carry it (SC-1). */}
			{reply.imageUrl ? (
				<CommentImage url={reply.imageUrl} onOpen={onOpenImage} />
			) : null}
			<p className="text-sm whitespace-pre-line">{reply.body}</p>
			<span className="text-xs text-muted-foreground">
				{reply.author.pseudonym}
			</span>
		</div>
	);
}
