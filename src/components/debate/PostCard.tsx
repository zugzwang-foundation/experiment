"use client";

import { Maximize2 } from "lucide-react";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { AggregateFooter } from "./AggregateFooter";
import { ArgProfile } from "./ArgProfile";
import { LaneBadge, SideBadge } from "./badges";
import { CommentImage } from "./CommentImage";
import { RemovedPlaceholder } from "./placeholders";
import { ReplyPreview } from "./ReplyPreview";
import type { DebatePost, PresentPost } from "./types";

/**
 * One post in a side column's post-scroller (DEBATE.4 §4). A PRESENT post shows
 * the argprofile · lane badge · title (opens the pop-up) · teaser · image · a
 * "Read more" link to the full body · the aggregate footer · the two-slot reply
 * preview · an "Open debate" focus toggle. ⛔ The disabled `Đ BET` and
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
				{/* A removed POST keeps its surviving replies (§6 — the thread stays
				    intact), so its live replies keep their own affordances. */}
				<ReplyPreview
					replies={post.replies}
					bookmarks={bookmarks}
					onOpenImage={onOpenImage}
				/>
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

			<button
				type="button"
				className="text-left"
				onClick={() => onOpenPopup(post)}
			>
				<h3 className="font-heading text-base leading-snug font-medium">
					{post.title}
				</h3>
			</button>
			{post.teaser ? (
				<p className="text-sm text-muted-foreground">{post.teaser}</p>
			) : null}
			{post.imageUrl ? (
				<CommentImage url={post.imageUrl} onOpen={onOpenImage} />
			) : null}

			<div className="flex flex-wrap items-center gap-1.5">
				{/* Row 3 (PD-0-01) — R4 RULED 2026-08-12: ADOPT CD-A's "Read more" TEXT
				    LINK. `Read more` had zero occurrences repo-wide.
				    ⚠ The icon goes with the copy. "Text link" is the ratified form, so
				    the Plus glyph is REMOVED rather than relabelled — keeping an icon
				    beside the new copy would preserve the affordance CD-A retired.
				    ⚠ The `aria-label` is removed DELIBERATELY, not dropped. It read
				    "Read the full argument", which does not CONTAIN the visible text
				    "Read more" — an accessible name that omits the visible label is a
				    WCAG 2.5.3 (Label in Name) failure. With self-describing text the
				    visible string IS the accessible name, which is the stronger form.
				    ✅ CD-A's `#989898` / `#FAFAFA` ARE `--color-n5` / `--color-ink`, so
				    the port is BY TOKEN — a raw hex here reddens no-raw-hex-view-layer
				    (Ruling A / H-HEX). */}
				<Button
					variant="ghost"
					size="xs"
					onClick={() => onOpenPopup(post)}
					className="text-n5 hover:text-ink"
				>
					Read more
				</Button>
			</div>

			<AggregateFooter
				aggregate={post.aggregate}
				postSide={post.sideAtPostTime}
			/>
			<ReplyPreview
				replies={post.replies}
				bookmarks={bookmarks}
				onOpenImage={onOpenImage}
			/>

			<Button
				variant="ghost"
				size="xs"
				className="self-start"
				onClick={() => onEnter(post.id)}
				aria-label="Open this debate"
			>
				<Maximize2 /> Open debate
			</Button>
		</Card>
	);
}
