"use client";

import { ChevronLeft } from "lucide-react";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { ArgProfile } from "./ArgProfile";
import { LaneBadge, SideBadge } from "./badges";
import { CommentImage } from "./CommentImage";
import { ReplySplitBar } from "./composer/ReplySplitBar";
import { HeadZone } from "./HeadZone";
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
 *
 * HTML-FINISH · MARKET DETAIL row 1 — THIS IS THE HEADZONE'S POST ARM. It no
 * longer stacks UNDERNEATH the market header; it REPLACES it, through the same
 * `HeadZone` frame (see that file for why the swap is the whole finding). Every
 * element here is a `vp` element in the mockup — `.hpimg` · `.pauthor` ·
 * `.ptitle` · `.tease` · `.pfoot` — and they occupy the frame's LEFT column. The
 * rail (`.mcard`, the market card that is also the exit) is row 17's and lands
 * at C11; until then this arm passes `null` and renders one column.
 */
export function PostFocusHeader({
	post,
	bookmarks,
	heldSide,
	marketOpen,
	suspended,
	activeRelation,
	onToggleRelation,
	onExit,
	onOpenImage,
}: {
	post: DebatePost;
	/**
	 * BOOKMARK-ADD-WIRE — viewer bookmark state for this market; `null` when
	 * signed out. Reaches only the non-removed branch's `ArgProfile`; the removed
	 * branch renders side badge + placeholder and no cluster.
	 */
	bookmarks: BookmarkAffordance;
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
		<HeadZone
			// Row 17 (`.mcard`, C11) is the rail's only occupant. `null` until then —
			// an empty rail is visible empty chrome (PD-3-09).
			right={null}
			left={
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
			}
		/>
	);
}
