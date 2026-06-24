"use client";

import { Maximize2, Plus } from "lucide-react";

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
 * the argprofile · lane badge · title (opens the pop-up) · teaser · image · the
 * disabled write triggers (Buy / Support-Counter, C1 §7) · the aggregate footer
 * · the two-slot reply preview · an "Open debate" focus toggle. A REMOVED post
 * keeps only its structural slot — frozen side badge + the "removed by
 * moderator" placeholder + aggregate + its surviving replies (§6). The post's
 * body/author/marker/badge are absent at the type level on the removed variant,
 * so this component cannot render them.
 */
export function PostCard({
	post,
	onEnter,
	onOpenPopup,
	onOpenImage,
}: {
	post: DebatePost;
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
				<AggregateFooter aggregate={post.aggregate} />
				<ReplyPreview replies={post.replies} />
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
					author={post.author}
					side={post.sideAtPostTime}
					marker={post.marker}
					authorStake={post.authorStake}
					replyCount={replyCount}
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
				<Button
					variant="ghost"
					size="xs"
					onClick={() => onOpenPopup(post)}
					aria-label="Read the full argument"
				>
					<Plus /> Full
				</Button>
				{/* Write triggers render present-but-disabled (C1 / §7) — no handlers. */}
				<Button
					variant="outline"
					size="xs"
					disabled
					aria-disabled="true"
					aria-label="Buy — sign in to bet"
				>
					Buy
				</Button>
				<Button
					variant="outline"
					size="xs"
					disabled
					aria-disabled="true"
					aria-label="Reply — sign in to argue"
				>
					Support / Counter
				</Button>
			</div>

			<AggregateFooter aggregate={post.aggregate} />
			<ReplyPreview replies={post.replies} />

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
