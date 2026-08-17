"use client";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { ArgProfile } from "./ArgProfile";
import { LaneBadge, SideBadge } from "./badges";
import { CommentImage, PostImagePlaceholder } from "./CommentImage";
import { ReplySplitBar } from "./composer/ReplySplitBar";
import { FocusMarketCard } from "./FocusMarketCard";
import { HeadZone } from "./HeadZone";
import { RemovedPlaceholder } from "./placeholders";
import type {
	DebateMarketHeader,
	DebatePost,
	PresentPost,
	Side,
} from "./types";

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
	onOpenPopup,
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
	/**
	 * HTML-FINISH · MARKET DETAIL row 15 — the `+` beside the teaser opens the
	 * post pop-up, the same host the market-view card's `+` uses. ⛔ One pop-up
	 * on the surface, not one per zoom level.
	 */
	onOpenPopup: (post: PresentPost) => void;
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
				/* ⚠ The focused post's card FILLS the headzone band, so `.hpimg` beside
				   it can be height-driven exactly as the market arm's `.mmedia` is.
				   `min-h-0` is its link in the one-screen chain. */
				<Card className="min-h-0 flex-1 gap-3 p-4">
					{/* HTML-FINISH · MARKET DETAIL row 11 — `.hleft` IS A ROW, NOT A
					    STACK (`d5:448`, `flex:1 1 auto;min-width:0;display:flex;gap:16px`).
					    The focused post's image is `.hpimg` (`:956`) — a LEFT SIBLING of
					    the text stack, occupying the same slot the market arm gives
					    `.mmedia`. It used to render INLINE, between the title and the
					    body, which pushed the argument down the column on every post that
					    carried one. */}
					<div className="flex min-h-0 flex-1 gap-4">
						{/* HTML-FINISH · MARKET DETAIL round 2 · R2 — d5 fills the
						    post-focus `.hpimg` with its `POST IMAGE · 640:586` box
						    (`d5:1491-1492`) whenever the focused post has no real
						    attachment; the founder ruled that chrome IN.
						    ⚠ THE REMOVED CASE STILL DRAWS NOTHING, deliberately: a removed
						    post's variant has no `imageUrl` field at the type level, and
						    an image slot beside a withheld argument would announce that
						    it had an attachment. Hence `!post.removed` gates BOTH arms
						    rather than only the real-image one. */}
						{post.removed ? null : post.imageUrl ? (
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
						) : (
							<div className="aspect-[16/9] h-full w-auto shrink-0">
								{/* `.hpimg{aspect-ratio:16/9;height:100%;width:auto}` (`d5:787`)
								    — the same height-driven frame the market arm gives
								    `.mmedia`, now that the band has a definite height. */}
								<PostImagePlaceholder fill />
							</div>
						)}

						{/* `.hstack` (`d5:462`, `flex:1 1 auto;min-width:0;flex-direction:
						    column`) — everything that is not the image. */}
						<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
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
									{/* HTML-FINISH · MARKET DETAIL row 15 — d5's `.tease` (`:972`):
									    a body TEASER with a `+` opening the full argument in the
									    pop-up. The focused post used to render the whole body
									    inline, which pushed the reply columns below the fold on
									    any long argument — post-focus is where you READ the
									    argument and then reply, so the reply surface has to stay
									    reachable.
									    ⚠ THE FULL BODY IS NOT LOST — one click away in the
									    pop-up, and still whole in the ADR-0025 `.md` export. This
									    defers it; it does not withhold it.
									    ⚠ `deriveTitleTeaser` makes the teaser the SECOND
									    paragraph, so a single-paragraph argument has none. d5
									    marks that case "hidden-but-reserved when bodyless" — the
									    TEXT hides, the `+` does NOT, because the full body exists
									    either way and the control is the only path to it. */}
									<div className="flex items-start justify-between gap-2">
										{post.teaser ? (
											/* ⚠⚠ `line-clamp-2` — `.tease .tx{-webkit-line-clamp:2}`
											   (`d5:607`), and the mockup calls it a "2-line body
											   TEASER" at `:971`. It was missing, so the WHOLE second
											   paragraph rendered: measured on staging at `5349ae9`,
											   a real fixture argument filled ~330px of the header and
											   pushed the reply arena entirely below the fold. A
											   teaser that is not clamped is not a teaser — it is the
											   body, which is exactly what row 15 moved into the
											   pop-up. */
											<p className="line-clamp-2 text-sm whitespace-pre-line text-muted-foreground">
												{post.teaser}
											</p>
										) : (
											<span />
										)}
										{/* Byte-carried from the mockup's own control (`d5:972`,
										    `aria-label="Show more"`) — the same string the card's
										    `+` carries, because it is the same action. */}
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
