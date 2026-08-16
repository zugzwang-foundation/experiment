"use client";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import { Card } from "@/components/ui/card";

import { ArgProfile } from "./ArgProfile";
import { LaneBadge, SideBadge } from "./badges";
import { CommentImage } from "./CommentImage";
import { ReplySplitBar } from "./composer/ReplySplitBar";
import { FocusMarketCard } from "./FocusMarketCard";
import { HeadZone } from "./HeadZone";
import { RemovedPlaceholder } from "./placeholders";
import type { DebateMarketHeader, DebatePost, Side } from "./types";

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
	market,
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
	 * HTML-FINISH · MARKET DETAIL row 17 — the market this post belongs to,
	 * threaded so the rail can render it as a card. The post arm otherwise has no
	 * market context at all once `MarketHeader` stops rendering beside it (row 1).
	 */
	market: DebateMarketHeader;
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
			// HTML-FINISH · MARKET DETAIL row 17 — `.mcard` (`d5:1021`) is the post
			// arm's whole rail, and it IS THE EXIT. See `FocusMarketCard` for why
			// building it inert would make post-focus a trap: `?post=` syncs with
			// `history.replaceState`, never `pushState`, so browser Back does not
			// leave post view, and this card replaces the only other way out.
			right={
				<FocusMarketCard
					title={market.title}
					imageUrl={market.mediaImageUrl}
					pricing={market.pricing}
					totals={market.totals}
					onExit={onExit}
				/>
			}
			left={
				<Card className="gap-3 p-4">
					{/* HTML-FINISH · MARKET DETAIL row 11 — `.hleft` IS A ROW, NOT A
					    STACK (`d5:448`, `flex:1 1 auto;min-width:0;display:flex;gap:16px`).
					    The focused post's image is `.hpimg` (`:956`) — a LEFT SIBLING of
					    the text stack, occupying the same slot the market arm gives
					    `.mmedia`. It used to render INLINE, between the title and the
					    body, which pushed the argument down the column on every post that
					    carried one. */}
					<div className="flex gap-4">
						{!post.removed && post.imageUrl ? (
							// `.hpimg{flex:0 0 auto}` — does not grow, does not shrink,
							// sized by its own content. `CommentImage` already renders
							// `block w-fit` around a height-bounded image, so `shrink-0` is
							// the whole port.
							// ⛔ `aspect-ratio:16/9` + `overflow:hidden` are NOT taken. That
							// pair CROPS, and T2 (§17 H-T2, RULED 2026-08-13) binds BOTH
							// axes as bounds so the image is "shown whole · any orientation"
							// (canon §107, the promise to the author). d5 AGREES: its own
							// comment at `:955` reads "shown whole at its own aspect; flag 1
							// paused", so the cropping rule is the paused variant, not the
							// ratified one. `CommentImage` is untouched.
							<div className="shrink-0">
								<CommentImage url={post.imageUrl} onOpen={onOpenImage} />
							</div>
						) : null}

						{/* `.hstack` (`d5:462`, `flex:1 1 auto;min-width:0;flex-direction:
						    column`) — everything that is not the image. */}
						<div className="flex min-w-0 flex-1 flex-col gap-3">
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
											entryPrice={post.entryPrice}
											chipSize="detail"
											authorStake={post.authorStake}
											replyCount={replyCount}
											bookmarks={bookmarks}
										/>
										<LaneBadge badge={post.badge} />
									</div>
									<h2 className="font-heading text-lg leading-snug font-medium">
										{post.title}
									</h2>
									<p className="text-sm whitespace-pre-line">{post.body}</p>
								</>
							)}

							{/* HTML-FINISH · MARKET DETAIL row 16 — `.pfoot{margin-top:auto;
							    flex:0 0 auto}` (`d5:856`), with the mockup's own reason at
							    `:978`: "pinned to bottom so bottoms align with image +
							    thumbnail". `mt-auto` in a flex column consumes the free
							    space ABOVE the item, so a short argument no longer leaves
							    the split bar floating halfway up beside a full-height
							    image. `shrink-0` is `flex:0 0 auto` — the bar keeps its
							    height when the stack is squeezed.
							    ⛔ `ReplySplitBar.tsx` IS NOT TOUCHED. Row 16 is PLACEMENT,
							    and placement is this container's business; the bar's
							    internals are allow-list-excluded, and needing to edit them
							    would be H1-f — a halt, not an edit. It was not needed. */}
							<div data-testid="post-focus-foot" className="mt-auto shrink-0">
								<ReplySplitBar
									postSide={post.sideAtPostTime}
									aggregate={post.aggregate}
									heldSide={heldSide}
									marketOpen={marketOpen}
									suspended={suspended}
									activeRelation={activeRelation}
									onToggleRelation={onToggleRelation}
								/>
							</div>
						</div>
					</div>
				</Card>
			}
		/>
	);
}
