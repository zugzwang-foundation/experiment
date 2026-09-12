import { ArgProfile } from "./ArgProfile";
import { SideBadge } from "./badges";
import { CommentImage } from "./CommentImage";
import { hasExtendedText } from "./composer/payload";
import { KnowMore } from "./KnowMore";
import { RemovedPlaceholder } from "./placeholders";
import type { DebateReply, PresentReply } from "./types";

/**
 * A depth-1 reply row (design-language §3.1 "Reply"). ✅ HTML-FINISH · MARKET
 * DETAIL row 26 rebuilt its anatomy to d5's `.rcardhead` (`:1545-1548`): an
 * `ArgProfile` head (avatar · pseudonym | side chip with entry price | staked ·
 * card actions) · the argument text · the reply's image. ⇒ The head is REUSED
 * from `ArgProfile` rather than hand-rolled, so the post and reply author rows
 * cannot drift apart again — they had already. A removed reply renders only its frozen side + the
 * "removed by moderator" placeholder — its body/author/marker/stake were
 * withheld server-side (§6), so they are absent from `reply` at the type level.
 * No vote control anywhere (§4.3).
 *
 * ⚠ RPLY-3 · R2 REVERSED THE LAST TWO, and the sentence above is corrected in
 * place rather than left for the amendment further down to contradict (`O-5`) —
 * an operative statement a reader reaches first is where the correction has to
 * land. The card now reads head → argument → image, which is `PostCard`'s own
 * order; the reasoning is at the image cell.
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
			{/* `.rtitle` (`:1550`) — the argument itself. A reply has no separate
			    title column, so its BODY is its title; `deriveTitleTeaser` is a
			    post-only derivation and is deliberately not applied here.
			    ⚠ The trailing pseudonym line is GONE: it is in the `ArgProfile`
			    head above now, and rendering it twice was the drift this row
			    removes.

			    ⚠⚠ RPLY-3 · R2 — THIS ROW NOW COMES BEFORE THE IMAGE, WHICH IS THE
			    ORDER `PostCard` HAS ALWAYS HAD. Founder: "it should be exactly like
			    posts — only the S/C bar is removed and hence the image is
			    enlarged." MEASURED against the post card rather than assumed:
			    `PostCard` renders profile row → TITLE → image cell → aggregate
			    footer, while this card rendered profile row → image → body. RPLY-1's
			    R6 gave this card the image CELL but left it where the old hand-rolled
			    anatomy had put it, so the two surfaces still read in different
			    orders.
			    ⛔ THE MAPPING IS TITLE→BODY, AND IT IS NOT A LOOSE ANALOGY. This
			    file's own line above states the rule: a reply has no separate title,
			    so its BODY *is* its title. `PostCard`'s title slot is therefore this
			    row, and putting it above the image is what makes the two cards the
			    same COMPOSITION minus the split bar.
			    ⚠ COMPOSITION, NOT EVERY DETAIL — the founder's "only the S/C bar is
			    removed" is a claim about the arrangement, and overstating it as
			    full parity would be the sort of sentence a later reader audits and
			    finds false. Two known differences survive on purpose and neither is
			    R2's to close: `PostCard` carries a `LaneBadge` beside its head, and
			    its `KnowMore` is OVERLAID on the title in a reserved gutter
			    (`absolute right-0 bottom-0`, `pr-28`) where this card's is a flex
			    sibling. That mount's own comment records why the overlay exists —
			    a flex sibling measured the title down from 628px to 104px — so
			    porting it is a real change with a real measurement behind it, not
			    a tidy-up. Docketed, not done. */}
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
				{/* ⚠ UI-OVERNIGHT entry 5 — ONLY WHEN THE REPLY HAS A DESCRIPTION.
				    The same predicate as the post card's, applied to the reply's own
				    body: a one-paragraph reply opens a pop-up holding the paragraph
				    already on the card, which is a promise the control cannot keep. */}
				{hasExtendedText(reply.body) ? (
					<KnowMore
						label="Know more about this reply"
						onClick={() => onOpenPopup(reply)}
						className="shrink-0"
					/>
				) : null}{" "}
			</div>
			{/* HTML-FINISH · MARKET DETAIL row 26 — the reply's own attachment.
			    ⛔ ON THE NON-REMOVED BRANCH ONLY. A removed reply's variant has no
			    `imageUrl` field at all, so this cannot compile in the branch above —
			    unlike the bookmark cluster beside it, whose placement this file
			    already records as deliberate-but-not-type-enforced. Here the type
			    system does carry it (SC-1).

			    ⚠⚠ RPLY-1 · R6 — THE IMAGE IS A CELL, AND THE CELL IS WHY THE CARD
			    STOPPED HAVING DEAD SPACE UNDER ITS TEXT. This card's root is
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
			    without the replies counter and the S/C bar").

			    ⚠⚠ RPLY-3 · R2 — AND THE CELL IS NOW LAST, WHERE `PostCard` PUTS IT.
			    The founder's "hence the image is enlarged" is DISCHARGED HERE AND IT
			    IS WORTH SAYING HOW, because the mechanism is not the reorder. This
			    cell is the card's ONLY `flex-1`, so it already took every pixel the
			    stretched root had left over — including the pixels `PostCard` spends
			    on its `AggregateFooter`. That is what "inherits the vertical space
			    the split bar would have occupied" means on this card, and it was
			    already true before the reorder: MEASURED before and after, the cell
			    is the same height in the same column. What the reorder buys is that
			    the leftover now falls at the FOOT of the card rather than in its
			    middle, so a reply reads title-then-picture exactly as a post does.
			    ⛔ `flex min-h-0 flex-1 items-center justify-center` — byte-carried
			    from `PostCard`'s `.argimg` cell, because THE CELL IS WHERE THE
			    HEIGHT LIVES, not the image: `max-h-full` on an `<img>` is a
			    percentage and resolves to `none` without a definite height above it.
			    Break the chain and the image silently reverts to intrinsic size. */}
			<div className="flex min-h-0 flex-1 items-center justify-center">
				{/* ⛔ QUOTE-1 A — THE EMPTY ARM DRAWS NOTHING (founder-ruled
				    2026-09-11). This card reused the post placeholder verbatim rather
				    than minting a "REPLY IMAGE" variant, because inventing a second
				    label would have been authoring product copy; the docket at
				    `docs/parked.md` (`HTML-FINISH-MD-PLACEHOLDERS`) covered both mounts
				    together, and both take its STRIP exit together.
				    ⚠ THE CELL ABOVE IS NOT PART OF THE STRIP. It is byte-carried from
				    `PostCard`'s `.argimg` and is this card's ONLY absorber (RPLY-1 ·
				    R6) — the whole reason the reply card stopped growing a dead gap at
				    its foot. It stays on both arms, empty on this one. (The class
				    string is deliberately not repeated here: it sits five lines up, and
				    Tailwind's source scan reads comments.) */}
				{reply.imageUrl ? (
					<CommentImage url={reply.imageUrl} onOpen={onOpenImage} fill />
				) : null}
			</div>
		</div>
	);
}
