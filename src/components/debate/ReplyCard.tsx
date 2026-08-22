import { Button } from "@/components/ui/button";

import { ArgProfile } from "./ArgProfile";
import { SideBadge } from "./badges";
import { CommentImage } from "./CommentImage";
import { RemovedPlaceholder } from "./placeholders";
import type { DebateReply, PresentReply } from "./types";

/**
 * A depth-1 reply row (design-language §3.1 "Reply"). ✅ HTML-FINISH · MARKET
 * DETAIL row 26 rebuilt its anatomy to d5's `.rcardhead` (`:1545-1548`): an
 * `ArgProfile` head (avatar · pseudonym | side chip with entry price | staked ·
 * card actions) · the reply's image · the argument text. ⇒ The head is REUSED
 * from `ArgProfile` rather than hand-rolled, so the post and reply author rows
 * cannot drift apart again — they had already. A removed reply renders only its frozen side + the
 * "removed by moderator" placeholder — its body/author/marker/stake were
 * withheld server-side (§6), so they are absent from `reply` at the type level.
 * No vote control anywhere (§4.3).
 *
 * UNWIRE-1 — the bookmark/download `CardActions` cluster this reply card used
 * to share with `ArgProfile` is gone (bookmark module unwired product-wide);
 * `ArgProfile` no longer renders any action cluster at all (SUB-3).
 */
export function ReplyCard({
	reply,
	onOpenImage,
	onOpenPopup,
}: {
	reply: DebateReply;
	/**
	 * HTML-FINISH · MARKET DETAIL row 26 — opens the reply's attached image in
	 * the read-only lightbox, the same host `PostFocusHeader` and `PostCard`
	 * already use. Threaded rather than owned so there is ONE lightbox on the
	 * surface, not one per card.
	 */
	onOpenImage: (url: string) => void;
	/**
	 * HTML-FINISH · MARKET DETAIL row 27 — the `+` opens this reply's full
	 * argument in the reply pop-up. ⛔ It receives a `PresentReply`, so a removed
	 * reply cannot reach the pop-up even by mistake (H3-e / SC-1).
	 */
	onOpenPopup: (reply: PresentReply) => void;
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
		/* ⚠ `.rpanel{flex:1 1 auto;min-height:0}` (`d5:832`) — the reply card FILLS
		   its column, so the post arm's arena is the same filled two-column band the
		   market arm's is, rather than two short boxes floating at the top. It can
		   still grow past the column on a long argument, and `DebateColumn`'s
		   `.colwrap` scrolls when it does. */
		<div className="flex min-h-0 flex-1 flex-col gap-1.5 rounded-md p-2 [border:var(--hairline)]">
			{/* HTML-FINISH · MARKET DETAIL row 26 — d5's `.rcardhead` (`:1545-1548`)
			    is avatar · pseudonym | side chip with entry price | staked · card
			    actions, which is EXACTLY the row `ArgProfile` renders after row 12
			    made it one line.
			    ⇒ REUSED, NOT RE-IMPLEMENTED. The reply card had a hand-rolled head
			    that had already drifted from the post's (no avatar, no entry price,
			    a differently-placed cluster); one implementation is what stops them
			    drifting again, and it brings the avatar ring, the entry-price chip
			    and the spaced `Đ ` grammar with it rather than re-deriving each.
			    ⚠ `replyCount` is OMITTED — a reply has no replies
			    (`REPLY_DEPTH_MAX = 1`), so the field would render a zero that means
			    nothing. */}
			<ArgProfile
				author={reply.author}
				side={reply.side}
				marker={reply.marker}
				entryPrice={reply.entryPrice}
				authorStake={reply.stake}
			/>
			{/* HTML-FINISH · MARKET DETAIL row 26 — the reply's own attachment.
			    ⛔ ON THE NON-REMOVED BRANCH ONLY. A removed reply's variant has no
			    `imageUrl` field at all, so this cannot compile in the branch above —
			    unlike the bookmark cluster beside it, whose placement this file
			    already records as deliberate-but-not-type-enforced. Here the type
			    system does carry it (SC-1). */}
			{reply.imageUrl ? (
				<CommentImage url={reply.imageUrl} onOpen={onOpenImage} />
			) : null}
			{/* `.rtitle` (`:1550`) — the argument itself. A reply has no separate
			    title column, so its BODY is its title; `deriveTitleTeaser` is a
			    post-only derivation and is deliberately not applied here.
			    ⚠ The trailing pseudonym line is GONE: it is in the `ArgProfile`
			    head above now, and rendering it twice was the drift this row
			    removes. */}
			<div className="flex items-start justify-between gap-2">
				<p className="text-sm whitespace-pre-line">{reply.body}</p>
				{/* HTML-FINISH · MARKET DETAIL row 27 — d5's `.rtitle.plust` `+`
				    (`:1551`), the same control the post card carries at row 24 and the
				    focused post at row 15, so one glyph means one thing everywhere.
				    ⛔ NON-REMOVED BRANCH ONLY — `ReplyCard` records that this
				    placement is deliberate and NOT type-enforced for the cluster; for
				    the pop-up it IS type-enforced, because `onOpenPopup` takes a
				    `PresentReply` and `reply` is narrowed here.
				    ⛔ Label byte-carried from the mockup (`aria-label="Show more"`). */}
				<Button
					variant="ghost"
					size="xs"
					onClick={() => onOpenPopup(reply)}
					aria-label="Show more"
					className="shrink-0 text-n5 hover:text-ink"
				>
					+
				</Button>
			</div>
		</div>
	);
}
