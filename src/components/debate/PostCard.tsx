"use client";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { AggregateFooter } from "./AggregateFooter";
import { ArgProfile } from "./ArgProfile";
import { LaneBadge, SideBadge } from "./badges";
import { CommentImage } from "./CommentImage";
import { RemovedPlaceholder } from "./placeholders";
import type { DebatePost, PresentPost } from "./types";

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
}) {
	const replyCount = post.aggregate.supportCount + post.aggregate.counterCount;

	if (post.removed) {
		return (
			<Card className="gap-2 p-3">
				<SideBadge side={post.sideAtPostTime} />
				<RemovedPlaceholder />
				{/* The removed variant keeps its frozen side (§6 — thread integrity),
				    so the split bar stays correctly poled on a removed post too. */}
				<AggregateFooter
					aggregate={post.aggregate}
					postSide={post.sideAtPostTime}
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
		<Card className="gap-2.5 p-3">
			<div className="flex items-start justify-between gap-2">
				<ArgProfile
					commentId={post.id}
					author={post.author}
					side={post.sideAtPostTime}
					marker={post.marker}
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
				<button
					type="button"
					className="text-left"
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
			{post.imageUrl ? (
				<CommentImage url={post.imageUrl} onOpen={onOpenImage} />
			) : null}

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
			/>
		</Card>
	);
}
