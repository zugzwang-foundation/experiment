import { ArgProfile } from "./ArgProfile";
import { SideBadge } from "./badges";
import { CommentImage, PostImagePlaceholder } from "./CommentImage";
import { KnowMore } from "./KnowMore";
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
				originalStake={reply.stakeOriginal}
				sold={reply.sold}
				createdAt={reply.createdAt}
			/>
			{/* HTML-FINISH · MARKET DETAIL row 26 — the reply's own attachment.
			    ⛔ ON THE NON-REMOVED BRANCH ONLY. A removed reply's variant has no
			    `imageUrl` field at all, so this cannot compile in the branch above —
			    unlike the bookmark cluster beside it, whose placement this file
			    already records as deliberate-but-not-type-enforced. Here the type
			    system does carry it (SC-1).

			    ⚠⚠ RPLY-1 · R6 — THE IMAGE IS NOW A CELL, AND THE CELL IS WHY THE
			    CARD STOPPED HAVING DEAD SPACE UNDER ITS TEXT. This card's root is
			    `min-h-0 flex-1` deliberately — d5's `.rpanel{flex:1 1 auto}`, so the
			    post arm's arena is a FILLED two-column band rather than two short
			    boxes floating at the top. But all three of its children were
			    content-sized, and in a stretched `flex-col` every pixel of leftover
			    height lands AFTER the last child. The gap was not a spacing bug; it
			    was the absence of anything able to absorb.
			    ⇒ `PostCard` does not have this problem because it has two absorbers
			    this card lacks: an explicit image CELL and an `AggregateFooter`
			    pinned at the bottom. R6 gives this card the FIRST one only.
			    ⛔ AND DELIBERATELY NOT THE FOOTER. A reply has no replies
			    (`REPLY_DEPTH_MAX = 1`) so there is no count to show, and there is no
			    split bar on the reply path at all — both are ALREADY absent, which
			    is exactly what the founder asked for ("like the post view, just
			    without the replies counter and the S/C bar"). The image cell is
			    therefore the whole change, and closing the gap is its side effect
			    rather than a second edit.
			    ⛔ `flex min-h-0 flex-1 items-center justify-center` — byte-carried
			    from `PostCard`'s `.argimg` cell, because THE CELL IS WHERE THE
			    HEIGHT LIVES, not the image: `max-h-full` on an `<img>` is a
			    percentage and resolves to `none` without a definite height above it.
			    Break the chain and the image silently reverts to intrinsic size. */}
			<div className="flex min-h-0 flex-1 items-center justify-center">
				{reply.imageUrl ? (
					<CommentImage url={reply.imageUrl} onOpen={onOpenImage} fill />
				) : (
					/* ⚠ REUSED VERBATIM, `POST IMAGE · 640:586` CHROME AND ALL. Minting
					   a "REPLY IMAGE" variant would be authoring product copy, which
					   needs a founder ruling; the label is one string to change in the
					   morning if he wants it different. ⚠⚠ It remains REVIEW-SURFACE
					   ONLY — docketed at `docs/parked.md` (`HTML-FINISH-MD-PLACEHOLDERS`)
					   to be stripped or gated before the DP.2 production promote, and
					   this is now a FOURTH mount that docket covers. */
					<PostImagePlaceholder fill />
				)}
			</div>
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
				    ⚠⚠ UI-QUICK change set 2 item 2 — THE GLYPH BECOMES `Know more`,
				    and the sentence above is the reason this mount could not be left
				    behind: "one glyph means one thing everywhere" only holds if the
				    conversion reaches everywhere. Two converted mounts and two
				    unconverted ones is the state that teaches a reader nothing.
				    ⛔ AND THE BYTE-CARRIED LABEL HAD TO GO. This read "⛔ Label
				    byte-carried from the mockup (`aria-label="Show more"`)" — correct
				    for a glyph, which has no visible text for WCAG 2.5.3 to bind to.
				    A control reading `Know more` named `Show more` fails Label in Name
				    outright, so mockup fidelity loses to the success criterion here.
				    `KnowMore.tsx` owns that rule for all four mounts. */}
				<KnowMore
					label="Know more about this reply"
					onClick={() => onOpenPopup(reply)}
					className="shrink-0"
				/>
			</div>
		</div>
	);
}
