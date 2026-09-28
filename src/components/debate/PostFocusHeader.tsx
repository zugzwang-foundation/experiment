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
import { QuoteWell } from "./quote-well/QuoteWell";
import type { DebateMarketHeader, DebatePost, PresentPost } from "./types";

/**
 * The focused-post header (DEBATE.4 §4 post-view) — the entered post shown in
 * full: argprofile · lane badge · title · image · FULL body, with a "Back to
 * market" toggle (exitPost). The arena's two columns below render this post's
 * replies. UI.A3 slice 3: the footer is the designed SPLIT BAR (market-view
 * cards keep the plain `AggregateFooter` — plan §8 scope). ⚠ FEED-3 — the bar is
 * a display now: its F-3-gated Support/Counter triggers moved, with their props,
 * to the column headers below (`PositionStrip`'s left lane). A REMOVED focused
 * post shows only its frozen side + the placeholder + the split bar (its replies
 * and the header triggers stay live — thread intact, §6 edge).
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
				   `min-h-0` is its link in the one-screen chain.
				   ⚠ UIR-4 item 1 — `@container` makes the card the query container the
				   row's floor and column 1's width read below: `100cqw` is the card's
				   content box, so `100cqw + 26px` (12px padding and a 1px border, both
				   sides) is its border box — the width the market arm divides into its
				   picture and its stack. */
				<Card className="@container min-h-0 flex-1 gap-2 p-3 bg-gradient-to-b from-card to-card/90 border border-white/10 shadow-sm">
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
					{/* ⚠⚠ UIR-4 item 1 — THE ROW LIES ON THE MARKET ARM'S THREE COLUMNS.
					    Column 1 (the market arm's picture column) holds the post's image,
					    column 2 (its question and stats column) the post's content, and
					    the rail beside this card (its chart column) the market card.
					    ⚠ COLUMN 1's WIDTH PUTS COLUMN 2's CENTRE ON THE PAGE'S CENTRE LINE,
					    the gap between the YES and NO columns below. From `lg` the rail and
					    the band's gap take 340 + 20px to the right of this card; 344px plus
					    this row's 16px gap is the same 360px to the left of column 2, and
					    the card's padding and border match on both sides, so column 2
					    stands the same distance from both edges of the page. Below `lg`
					    there is no rail (and no chart column on the market arm), so column
					    1 takes the market arm's picture width instead and ends where that
					    picture ends: a third of the section, less this card's 13px inset.
					    ⚠ THE FLOOR IS THE MARKET ARM'S HEIGHT, by the market arm's own rule:
					    its 16:9 picture a third of the section wide (3/16 of the width) or
					    its question · stats · price bar · resolution stack (178.04px,
					    measured on staging at 1280 and 1440), whichever is taller, less
					    this card's 26px of padding and border. So the section is never
					    shorter than the market page's while that page's stats line holds
					    one line, and it grows only when its own content needs more. Items
					    stretch: all three columns take the row's height. */}
					<div className="flex min-h-[calc(max(3*(100cqw_+_26px)/16,_178.04px)_-_26px)] flex-1 gap-4 max-mobile:flex-col max-mobile:items-start">
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
						    rather than flattened — the two arms mean different things.
						    ⚠ UIR-4 item 1 — A FRAME IS BACK, AS A LAYOUT COLUMN RATHER THAN A
						    PLACEHOLDER. Column 1 reserves the width that centres column 2
						    whatever the post carries, and draws nothing of its own. What it
						    holds is `absolute`, so an attachment's natural height can never
						    set the row's.
						    ⚠ UIR-4 item 3 — AND AN IMAGELESS POST NO LONGER GETS THE REMOVED
						    CASE'S NOTHING: its title fills the frame as the quotation well.
						    Only a removed post still draws nothing here. */}
						<div
							data-testid="post-focus-media"
							className="relative w-[calc((100cqw_+_26px)/3_-_13px)] shrink-0 lg:w-[344px]"
						>
							{post.removed ? null : post.imageUrl ? (
								// ⚠ UIR-4 item 2 — THE IMAGE FILLS COLUMN 1's BOX AT THE ROW'S
								// HEIGHT: whole (both axes bounded, scaled to fit, never cropped),
								// centred, with no border and no ground; the 6px `--imgr` radius
								// is on the image itself. It is the market-page card's own `fill`
								// arm — `max-h-full` against a definite height, here the
								// `absolute inset-0` box — so T2 holds as it does there: an image
								// smaller than the box keeps its natural size rather than being
								// upscaled. `border-0!` outranks the image's own hairline, which
								// `CommentImage` concatenates rather than merges, so the order of
								// the two in the stylesheet cannot decide it. The click opens the
								// lightbox, as before.
								<div className="absolute inset-0 flex items-center justify-center">
									<CommentImage
										url={post.imageUrl}
										onOpen={onOpenImage}
										fill
										className="max-h-full border-0!"
									/>
								</div>
							) : (
								// ⚠ UIR-4 item 3 — A POST WITHOUT AN IMAGE SHOWS ITS TITLE AS
								// THE PICTURE: `QuoteWell`, the title between its quotation
								// marks, as the market page's cards and Discovery draw it. It
								// fills column 1's box the way the cards' well fills theirs —
								// unboxed, scaled to fit — and it is the title's heading
								// element (`h2`), so column 2 drops its title row. ⛔ The
								// removed arm above still draws nothing: its variant has no
								// title at the type level, and a well beside a withheld
								// argument would publish the masked content itself.
								<div className="absolute inset-0 flex items-center justify-center">
									<QuoteWell title={post.title} as="h2" boxed={false} />
								</div>
							)}
						</div>

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
									{/* ⚠ UIR-4 item 3 — only a post with an image keeps a title
									    row; without one, the well in column 1 is the title, and
									    `Know more` stands on its own row, right-aligned, where it
									    sits under an image post's title. */}
									{post.imageUrl ? (
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
									) : hasExtendedText(post.body) ? (
										<KnowMore
											label="Know more about this argument"
											onClick={() => onOpenPopup(post)}
											className="shrink-0 self-end"
										/>
									) : null}
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
								/>
							</div>
						</div>
					</div>
				</Card>
			}
		/>
	);
}
