"use client";

import { Card } from "@/components/ui/card";

import { ArgProfile } from "./ArgProfile";
import { SideBadge } from "./badges";
import { CommentImage } from "./CommentImage";
import { hasExtendedText } from "./composer/payload";
import { ReplySplitBar } from "./composer/ReplySplitBar";
import { FocusMarketCard } from "./FocusMarketCard";
import { HeadZone } from "./HeadZone";
import { KnowMore } from "./KnowMore";
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
	heldSide,
	marketOpen,
	suspended,
	activeRelation,
	onToggleRelation,
	onExit,
	onOpenImage,
	onOpenPopup,
	isOwnPost = false,
}: {
	post: DebatePost;
	/**
	 * HTML-FINISH · MARKET DETAIL row 17 — the market this post belongs to,
	 * threaded so the rail can render it as a card. The post arm otherwise has no
	 * market context at all once `MarketHeader` stops rendering beside it (row 1).
	 */
	market: DebateMarketHeader;
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
	/**
	 * D-52 R1 — the viewer wrote the focused post: both split-bar triggers
	 * render disabled (nobody replies to their own post). Absent = not the
	 * viewer's.
	 */
	isOwnPost?: boolean;
}) {
	const replyCount = post.aggregate.supportCount + post.aggregate.counterCount;
	return (
		<HeadZone
			// ⚠⚠ UI-OVERNIGHT entry 3 — THIS ARM IS CONTENT-SIZED. The band's
			// declared fraction was smaller than this header at ordinary viewport
			// heights, and the band contains its own overflow — so the Support /
			// Counter bar at the foot of this card, and the stake summary under it,
			// were simply cut off. Nothing looked broken: the band was full, and the
			// one control the surface exists for was below its edge.
			// ⛔ THE MARKET ARM IS UNTOUCHED and keeps the declared band — its
			// contents are chrome, and chrome may be clipped. See `HeadZone`.
			fit
			// HTML-FINISH · MARKET DETAIL row 17 — `.mcard` (`d5:1021`) is the post
			// arm's whole rail, and it IS THE EXIT. See `FocusMarketCard` for why
			// building it inert would make post-focus a trap.
			// ⚠ THE REASON GIVEN HERE WAS SUPERSEDED AND IS CORRECTED RATHER THAN
			// LEFT (O-5). It read: "`?post=` syncs with `history.replaceState`,
			// never `pushState`, so browser Back does not leave post view, and this
			// card replaces the only other way out." RPLY-1 · R2 made entering PUSH
			// a rung precisely so Back would work — so Back is now an exit too, and
			// this card is the VISIBLE one rather than the only one. That is a
			// weaker claim and it still forbids an inert card: an exit a reader
			// cannot see is one they do not have.
			right={
				<FocusMarketCard
					title={market.title}
					// UI-FOLLOWUP B — the card is an `<a>` now and needs the market's
					// address. Already on `DebateMarketHeader` (it is `MarketSummary`'s
					// own field, the one `/m/[slug]` resolved this page by), so nothing
					// new is threaded and no read model changes.
					slug={market.slug}
					// ⚠⚠ UI-OVERNIGHT entry 4 — THE DISCOVERY THUMBNAIL, NOT THE HEADER'S
					// IMAGE. This rail is the LOCKED market-card composition (image thumb
					// + question · YES/NO bar · totals), the same one Discovery renders —
					// and it was showing a different picture of the same market, because
					// the detail header deliberately takes the lowest-order NON-default
					// media row (MEDIA-SECOND-ROW) while Discovery's card takes the
					// default one. A reader who entered a post from Discovery saw the
					// market change its face on the way in.
					// ⚠ THE FALLBACK CHAIN IS THE BRIEF'S: thumbnail → the header's own
					// media → the card's placeholder. `MarketThumb` supplies the last
					// step for `null`, so a market with no media at all still renders the
					// `IMG` box rather than a broken image.
					// ⛔ THE HEADER'S OWN PANEL IS UNTOUCHED — `MarketMediaPanel` keeps
					// `mediaImageUrl`. The two surfaces show different images on purpose;
					// what was wrong was that one of them was a CARD.
					imageUrl={market.thumbImageUrl ?? market.mediaImageUrl}
					pricing={market.pricing}
					totals={market.totals}
					onExit={onExit}
					compact={true}
				/>
			}
			left={
				/* ⚠ The focused post's card FILLS the headzone band, so `.hpimg` beside
				   it can be height-driven exactly as the market arm's `.mmedia` is.
				   `min-h-0` is its link in the one-screen chain. */
				<Card className="min-h-0 flex-1 gap-2 p-3 bg-gradient-to-b from-card to-card/90 border border-white/10 shadow-sm">
					{/* HTML-FINISH · MARKET DETAIL row 11 — `.hleft` IS A ROW, NOT A
					    STACK (`d5:448`, `flex:1 1 auto;min-width:0;display:flex;gap:16px`).
					    The focused post's image is `.hpimg` (`:956`) — a LEFT SIBLING of
					    the text stack, occupying the same slot the market arm gives
					    `.mmedia`. It used to render INLINE, between the title and the
					    body, which pushed the argument down the column on every post that
					    carried one. */}
					{/* MOBILE-1 · Job A item 3 — ADR-0048. This row carried NO
					    breakpoint variant at any width, and it is the one place on
					    `/m/[slug]` Phase A missed: `DebateView.tsx:1040`, `:1235` and
					    `MarketHeader.tsx:290` are the same shape and all three received
					    the same token then. (Named once, on the node below, and not
					    repeated here — `docs/parked.md`'s Block D census greps `src/`
					    for these strings, and a class written into a comment inflates
					    the site count it reports.)

					    ⚠ AND IT DEGRADED IN THE WRONG DIRECTION, WHICH IS WHY A WIDTH
					    TWEAK WOULD NOT HAVE DONE. Both image arms are `shrink-0` and the
					    placeholder's width derives from the row's HEIGHT (`self-stretch`
					    + `aspect-[16/9]`), so it demands ~147px of a 285px row REGARDLESS
					    of viewport width — narrowing the phone makes it proportionally
					    worse, and 100% of the deficit lands on the argument text. The text
					    stack is not at fault: it already carries `min-w-0` and shrinks
					    correctly. This is a row that must become a column.

					    ⚠ READ THE PARAGRAPH ABOVE AS HISTORY, NOT AS THE PRESENT TREE.
					    QUOTE-1 A removed the placeholder arm it describes, so this row
					    now has ONE image arm and it is the real-image one. The reflow
					    ruling is unchanged and the token below stays: the defect was
					    measured against the arm that is gone, but a real attachment is
					    `shrink-0` too and the row still has to become a column.

					    ⛔ AND THE FAILURE WAS INVISIBLE TO THE CHECK THAT CLEARED IT.
					    `<Card>` is `overflow-hidden`, so the clipping happens INSIDE the
					    card and `documentElement.scrollWidth` stays exactly 0px while
					    content is destroyed — the Counter button cut 24px, the Exited
					    badge cut 33px, eight elements with `scrollWidth > clientWidth`.
					    Anything measuring this row measures the clipping ancestor's
					    descendants, never the document. */}
					{/* D-52 R5 — `items-stretch`, not `items-center`: on the shared header
					    floor the tile is taller than its content, and only a stretched
					    text column lets `post-focus-foot`'s `mt-auto` sink the split bar
					    to the tile's bottom edge, as the feed cards carry it. The name
					    row and the title stay at the top; the image arm keeps its own
					    `self-center`. */}
					<div className="flex min-h-0 flex-1 gap-4 items-stretch max-mobile:flex-col max-mobile:items-start">
						{/* ⛔ QUOTE-1 A — THE EMPTY ARM AND ITS WHOLE FRAME ARE GONE
						    (founder-ruled 2026-09-11). R2 had filled the post-focus
						    `.hpimg` with d5's `POST IMAGE` box (`d5:1491-1492`) whenever
						    the focused post had no real attachment, and docketed it at
						    `docs/parked.md` (`HTML-FINISH-MD-PLACEHOLDERS`) in the same
						    breath. This is the STRIP exit.
						    ⚠ THE WRAPPER GOES WITH IT, unlike the card mounts. On
						    `PostCard` and `ReplyCard` the cell is the card's ABSORBER and
						    survives; here the `.hpimg` frame existed only to give the
						    placeholder a shape, and `CommentImage` brings its own. A row
						    with one child spends no `gap`, so nothing is left behind.
						    ⚠ THE REMOVED CASE STILL DRAWS NOTHING, deliberately: a removed
						    post's variant has no `imageUrl` field at the type level, and
						    an image slot beside a withheld argument would announce that
						    it had an attachment. That is now the same nothing every
						    imageless post gets, which is why the branch shape is kept
						    rather than flattened — the two arms mean different things. */}
						{post.removed ? null : post.imageUrl ? (
							// `.hpimg{flex:0 0 auto}` — does not grow, does not shrink,
							// sized by its own content. Framed in a clean preview thumbnail
							// that respects any orientation (portrait, landscape, square)
							// without clipping or awkward sliver sizing.
							<div className="shrink-0 flex items-center justify-center self-center overflow-hidden rounded-[var(--imgr)] bg-n1/60 [border:var(--hairline)]">
								<CommentImage
									url={post.imageUrl}
									onOpen={onOpenImage}
									className="h-16 w-16 sm:h-[72px] sm:w-[72px] object-contain p-0.5 transition-transform hover:scale-105"
								/>
							</div>
						) : null}

						{/* `.hstack` (`d5:462`, `flex:1 1 auto;min-width:0;flex-direction:
						    column`) — everything that is not the image. */}
						<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 justify-center">
							{post.removed ? (
								<>
									<SideBadge side={post.sideAtPostTime} />
									<RemovedPlaceholder />
								</>
							) : (
								<>
									{/* ⚠ UI-OVERNIGHT entry 1b — the lane badge rides the author
									    row now (see `ArgProfile`), so the corner wrapper that held
									    it beside this row is gone with it. */}
									<ArgProfile
										author={post.author}
										side={post.sideAtPostTime}
										marker={post.marker}
										entryPrice={post.entryPrice}
										chipSize="detail"
										authorStake={post.authorStake}
										originalStake={post.authorStakeOriginal}
										sold={post.authorSold}
										replyCount={replyCount}
										createdAt={post.createdAt}
										badge={post.badge}
									/>
									<div className="flex items-baseline justify-between gap-2 min-w-0">
										<h2 className="font-heading text-sm leading-snug font-medium line-clamp-1 min-w-0 flex-1">
											{post.title}
										</h2>
										{hasExtendedText(post.body) ? (
											<KnowMore
												label="Know more about this argument"
												onClick={() => onOpenPopup(post)}
												className="shrink-0"
											/>
										) : null}
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
									isOwnPost={isOwnPost}
								/>
							</div>
						</div>
					</div>
				</Card>
			}
		/>
	);
}
