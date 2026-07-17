"use client";

import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { ArgProfile } from "./ArgProfile";
import { LaneBadge, SideBadge } from "./badges";
import { CommentImage } from "./CommentImage";
import { ReplySplitBar } from "./composer/ReplySplitBar";
import { RemovedPlaceholder } from "./placeholders";
import type { DebatePost, Side } from "./types";

/**
 * The focused-post header (DEBATE.4 §4 post-view) — the entered post shown in
 * full: argprofile · lane badge · title · image · FULL body, with a "Back to
 * market" toggle (exitPost). The arena's two columns below render this post's
 * replies. UI.A3 slice 3: the footer is the designed SPLIT BAR carrying the
 * F-3-gated Support/Counter trigger pills (market-view cards keep the plain
 * `AggregateFooter` — plan §8 scope). A REMOVED focused post shows only its
 * frozen side + the placeholder + the split bar (replies + triggers stay
 * live — thread intact, §6 edge).
 */
export function PostFocusHeader({
	post,
	heldSide,
	marketOpen,
	suspended,
	activeRelation,
	onToggleRelation,
	onExit,
	onOpenImage,
}: {
	post: DebatePost;
	heldSide: Side | null;
	marketOpen: boolean;
	suspended: boolean;
	activeRelation: "support" | "counter" | null;
	onToggleRelation: (relation: "support" | "counter") => void;
	onExit: () => void;
	onOpenImage: (url: string) => void;
}) {
	const replyCount = post.aggregate.supportCount + post.aggregate.counterCount;
	return (
		<Card className="gap-3 p-4">
			<Button
				variant="ghost"
				size="xs"
				className="self-start"
				onClick={onExit}
				aria-label="Back to the market"
			>
				<ChevronLeft /> Back to market
			</Button>

			{post.removed ? (
				<>
					<SideBadge side={post.sideAtPostTime} />
					<RemovedPlaceholder />
				</>
			) : (
				<>
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
					<h2 className="font-heading text-lg leading-snug font-medium">
						{post.title}
					</h2>
					{post.imageUrl ? (
						<CommentImage url={post.imageUrl} onOpen={onOpenImage} />
					) : null}
					<p className="text-sm whitespace-pre-line">{post.body}</p>
				</>
			)}

			<ReplySplitBar
				postSide={post.sideAtPostTime}
				aggregate={post.aggregate}
				heldSide={heldSide}
				marketOpen={marketOpen}
				suspended={suspended}
				activeRelation={activeRelation}
				onToggleRelation={onToggleRelation}
			/>
		</Card>
	);
}
