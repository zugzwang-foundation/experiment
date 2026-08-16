"use client";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { AggregateFooter } from "./AggregateFooter";
import { ArgProfile } from "./ArgProfile";
import { LaneBadge, SideBadge } from "./badges";
import { CommentImage, PostImagePlaceholder } from "./CommentImage";
import { RemovedPlaceholder } from "./placeholders";
import type { DebatePost, PresentPost, Side } from "./types";

/**
 * One post in a side column's post-scroller (DEBATE.4 §4). A PRESENT post shows
 * the argprofile · lane badge · title (enters post-focus) · image · a
 * `+` glyph opening the full body in a pop-up · the aggregate footer. The
 * TITLE enters post-focus (row 23); the `+` reads in place (row 24).
 *
 * ⛔ THE TEASER AND THE TWO-SLOT REPLY PREVIEW LEFT THIS CARD at HTML-FINISH ·
 * MARKET DETAIL row 25, under the SPEC.1 1.0.31 amendment (§9 preamble,
 * F-DEBATE-1 System + Acceptance, and the two §17 rows). The card presents ONE
 * ARGUMENT; it does not present replies to it. Reply content surfaces on
 * entering post-focus, whose full stake-sorted per-side list IS the expansion §9
 * names — so the expansion is discharged by entering the post, not by an in-card
 * control. ⚠ THE SELECTION RULE IS UNTOUCHED: `ReplyGroups.twoSlot` is still on
 * the read model and `src/lib/ranking`'s `rankReplies`/`twoSlot` are unchanged.
 * Rendering replies at both zoom levels duplicated the same content twice.
 * ⛔ The disabled `Đ BET` and
 * `Support / Counter` write triggers were REMOVED at POLISH.3 PR 2 rows 1-2
 * (`PD-0-02`, R1) — redundancy plus the thesis ground that argument should be
 * deliberate, not reflexive. A REMOVED post
 * keeps only its structural slot — frozen side badge + the "removed by
 * moderator" placeholder + aggregate + its surviving replies (§6). The post's
 * body/author/marker/badge are absent at the type level on the removed variant,
 * so this component cannot render them.
 */
export function PostCard({
	post,
	bookmarks,
	onEnter,
	onOpenPopup,
	onOpenImage,
	onReplyToPost,
	heldSide,
	marketOpen,
	suspended,
}: {
	post: DebatePost;
	/**
	 * BOOKMARK-ADD-WIRE — viewer bookmark state for this market; `null` when
	 * signed out. Consumed only by the present branch's `ArgProfile`: the removed
	 * branch below constructs no `ArgProfile` (the removed union variant carries
	 * no `author`/`marker`, so it cannot), which is what makes "a removed argument
	 * never renders an add affordance" structural rather than a runtime check.
	 */
	bookmarks: BookmarkAffordance;
	onEnter: (id: string) => void;
	onOpenPopup: (post: PresentPost) => void;
	onOpenImage: (url: string) => void;
	/**
	 * HTML-FINISH · MARKET DETAIL row 22 — the card's Support/Counter trigger
	 * pills. ⚠ It ENTERS THE POST and opens the relation there; it does NOT open
	 * a composer on the card. That is what honours `R1`'s thesis ground while
	 * restoring the mockup's affordance: the reader still lands on the argument
	 * before writing about it.
	 */
	onReplyToPost: (id: string, relation: "support" | "counter") => void;
	/** Viewer state the pills need to apply the F-3 gate. Never optional — a
	 * trigger without its gate invites a bet the viewer cannot place. */
	heldSide: Side | null;
	marketOpen: boolean;
	suspended: boolean;
}) {
	const triggers = {
		heldSide,
		marketOpen,
		suspended,
		onReply: (relation: "support" | "counter") =>
			onReplyToPost(post.id, relation),
	};
	const replyCount = post.aggregate.supportCount + post.aggregate.counterCount;

	if (post.removed) {
		return (
			<Card className="gap-2 p-3">
				<SideBadge side={post.sideAtPostTime} />
				<RemovedPlaceholder />
				{/* The removed variant keeps its frozen side (§6 — thread integrity),
				    so the split bar stays correctly poled on a removed post too. */}
				{/* ⚠ The removed branch gets the triggers too: replying to a removed
				    argument is LEGAL (§6 edge) and its surviving replies are live —
				    `ReplySplitBar` renders on the removed variant for the same
				    reason. Withholding them here would silently retire a legal
				    action. */}
				<AggregateFooter
					aggregate={post.aggregate}
					postSide={post.sideAtPostTime}
					triggers={triggers}
				/>
				{/* ⚠ A removed POST STILL KEEPS ITS SURVIVING REPLIES (§6 — thread
				    integrity), and row 25 does not touch that: what changed is only
				    WHERE they surface. They are reached through `Open debate →`
				    below, which the removed branch KEEPS for exactly this reason
				    (plan F-3) — deleting it here would strand a removed post and its
				    live replies behind no path at all, since `page.tsx`'s `?post=`
				    falls back silently for a removed target. */}
				<Button
					variant="ghost"
					size="xs"
					className="self-start"
					onClick={() => onEnter(post.id)}
				>
					Open debate →
				</Button>
			</Card>
		);
	}

	return (
		/* `.panel{flex:1 1 auto;min-height:0}` (`d5:572`) — the card FILLS its
		   column, which is what gives `.argimg` below a height to take a share of.
		   Without it the card is content-sized, `.argimg`'s `flex-1` has nothing to
		   distribute, and the image falls back to its intrinsic size. */
		<Card className="min-h-0 flex-1 gap-2.5 p-3">
			<div className="flex items-start justify-between gap-2">
				<ArgProfile
					commentId={post.id}
					author={post.author}
					side={post.sideAtPostTime}
					marker={post.marker}
					entryPrice={post.entryPrice}
					authorStake={post.authorStake}
					replyCount={replyCount}
					bookmarks={bookmarks}
				/>
				<LaneBadge badge={post.badge} />
			</div>

			{/* HTML-FINISH · MARKET DETAIL rows 23 + 24 — d5's `.rtitle.plust`
			    (`:1077`): the TITLE enters post-focus (`onclick="enterPost(…)"`) and
			    a `+` glyph beside it opens the pop-up (`onclick="openPostPop(…)"`).
			    One row, two destinations — read the whole argument in place, or go
			    to its debate. The title used to open the pop-up; that is now the
			    `+`'s job alone. */}
			<div className="flex items-start justify-between gap-2">
				{/* HTML-FINISH · MARKET DETAIL round 2 · R6 — THE TITLE ANSWERS THE
				    POINTER. It is the card's primary navigation (it enters post-focus)
				    and it carried NO hover state at all, so the one control on the card
				    that takes you somewhere looked like static text.
				    ⛔ BOTH CLASSES ARE SHIPPED, NEITHER IS A MOCKUP VALUE.
				    · `hover:bg-n1` is the HIGHLIGHT, byte-carried from the Profile
				      surface — `profile/PositionsTable.tsx:672` (the selectable row)
				      and `:984` (the option button) both already use exactly it.
				    · `hover:underline` is the UNDERLINE, byte-carried from the Profile
				      argument title — `profile/ArgumentList.tsx:171` and `:473`, which
				      is the same thing this element is: a title that navigates.
				    · `rounded-(--r-chip)` is the build's own chip radius token, so the
				      highlight has the corner every other soft-cornered surface here
				      has.
				    ⚠ d5 AGREES ON THE HIGHLIGHT AND IS NOT THE SOURCE OF IT. `.rtt`
				    hovers to `background:var(--n1)` (`d5:839-840`) — the SAME token
				    index-wise: d5's `.rtt` sits on a white `--n0` and lifts one step to
				    a light `--n1`; this sits on `--color-n0` #212121 and lifts one step
				    to `--color-n1` #2a2a2a. Same relation, inverted ramp. ⛔ Its
				    `border-radius:4px`, `padding:0 3px` and `margin:0 -3px` are VALUES
				    and are NOT taken — which is also why no padding is added here: the
				    highlight hugs the text block and NOTHING in the card's layout
				    moves. d5 does not underline at all; that half is the founder's, via
				    the Profile pattern.
				    ⚠ NO `aria-label` IS ADDED. The visible text IS the accessible name,
				    and an override would have to contain it to satisfy WCAG 2.5.3. */}
				<button
					type="button"
					className="rounded-(--r-chip) text-left hover:bg-n1 hover:underline"
					onClick={() => onEnter(post.id)}
				>
					<h3 className="font-heading text-base leading-snug font-medium">
						{post.title}
					</h3>
				</button>
				{/* Row 24 — `R4` REVERSED by the founder ruling of 2026-08-16, and the
				    WCAG concern that motivated R4 is ANSWERED rather than dismissed.
				    R4 removed the Plus glyph for a `Read more` text link and
				    deliberately dropped the `aria-label`, because "Read the full
				    argument" does not CONTAIN the visible text "Read more" — a WCAG
				    2.5.3 (Label in Name) failure. With a glyph there IS no visible
				    label, so 2.5.3 does not apply and an `aria-label` becomes REQUIRED
				    rather than forbidden. ⛔ The label is BYTE-CARRIED from the
				    mockup's own control (`d5:1077`, `aria-label="Show more"`), never
				    authored. ✅ `text-n5 hover:text-ink` is kept from the R4 render —
				    CD-A's `#989898`/`#FAFAFA` BY TOKEN (Ruling A / H-HEX). */}
				<Button
					variant="ghost"
					size="xs"
					onClick={() => onOpenPopup(post)}
					aria-label="Show more"
					className="shrink-0 text-n5 hover:text-ink"
				>
					+
				</Button>
			</div>
			{/* HTML-FINISH · MARKET DETAIL round 2 · R2 — d5 substitutes its
			    `POST IMAGE · 640:586` box into `.argimg` on every card with no real
			    attachment (`d5:1682`), and the founder ruled that chrome IN. Where
			    this branch used to render `null`, it now renders the placeholder.
			    ⚠ THE REMOVED BRANCH ABOVE GETS NOTHING, and that is masking, not an
			    oversight: a removed post's variant carries no `imageUrl` field at
			    all, so drawing an image slot there would announce that a withheld
			    argument HAD an attachment. */}
			{/* ⚠⚠ `.argimg` (`d5:648`) — THE CELL, and the founder's measured defect.
			    `flex:1 1 auto;min-height:0;display:flex;align-items:center;
			    justify-content:center`: the attachment takes the card's whole
			    leftover height and sits CENTRED in it. Measured in the mockup — the
			    image is 73% of the card's height and horizontally centred; measured
			    on staging at `5349ae9` — 160 × 90, flush left, because there was no
			    cell at all and the image carried a 160px cap.
			    ⛔ THE CELL IS WHERE THE HEIGHT LIVES, not the image. `max-h-full` on
			    an `<img>` is a percentage and resolves to `none` without a definite
			    height above it; this node is the flex item that has one, which is why
			    `Card` and the scroller wrapper gained `flex-1 min-h-0` in the same
			    commit. Break any of those three and the image silently reverts to
			    intrinsic size — the exact failure mode being fixed. */}
			<div className="flex min-h-0 flex-1 items-center justify-center">
				{post.imageUrl ? (
					<CommentImage url={post.imageUrl} onOpen={onOpenImage} fill />
				) : (
					<PostImagePlaceholder fill />
				)}
			</div>

			{/* Row 23 — `Open debate` is GONE from the present branch: the title
			    above carries that destination now, and two controls for one
			    navigation is the redundancy this row removes. ⛔ The REMOVED branch
			    KEEPS it (plan F-3) — a removed post has no title to click, and
			    `page.tsx` falls back silently for a removed `?post=` target, so
			    deleting it there would leave a removed post and every surviving
			    reply under it reachable by no path at all. */}
			<AggregateFooter
				aggregate={post.aggregate}
				postSide={post.sideAtPostTime}
				triggers={triggers}
			/>
		</Card>
	);
}
