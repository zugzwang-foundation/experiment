"use client";

import { Card } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";

import { ArgProfile } from "./ArgProfile";
import { SideBadge } from "./badges";
import { CommentImage } from "./CommentImage";
import { hasExtendedText } from "./composer/payload";
import { ReplySplitBar } from "./composer/ReplySplitBar";
import { FocusMarketCard } from "./FocusMarketCard";
import { HeadZone } from "./HeadZone";
import { KnowMore } from "./KnowMore";
import { RemovedPlaceholder } from "./placeholders";
import {
	GEIST_QUOTE_INK,
	GEIST_QUOTE_TOP,
	GEIST_QUOTE_TOP_CLOSE,
	GEIST_UPPER_ADV,
	QUOTE_TYPE,
	WRAP_SLACK,
} from "./quote-well/size";
import type { DebateMarketHeader, DebatePost, PresentPost } from "./types";

/**
 * UIR-4 item 4 — the mean advance of a title character, in em: Geist at the
 * title's weight (500), normal tracking, spaces included. Measured on the
 * deployed face on staging, 2026-09-28: 0.452–0.496 across mixed-case prose
 * titles (0.555 in all caps). 0.5 sits at the top of the prose range, so a
 * prose title the estimate fits does fit, at the cost of shrinking a few
 * percent more than the narrowest titles need.
 */
const TITLE_ADVANCE_EM = 0.5;

/**
 * The size at which `title` fills its row on one line: the row's width over
 * the title's estimated width at 1px, in container units, held between 11px
 * and the title's 14px. `length` counts UTF-16 units, as the composer's cap
 * does.
 */
const titleSize = (title: string) =>
	`clamp(11px, ${(100 / (Math.max(title.length, 1) * TITLE_ADVANCE_EM)).toFixed(4)}cqw, 14px)`;

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
				   ⚠ UIR-4 item 1 — `@container` makes the card the query container
				   column 1's width reads below: `100cqw` is the card's content box, so
				   `100cqw + 26px` (12px padding and a 1px border, both sides) is its
				   border box — the width the market arm divides into its picture and its
				   stack. (UIR-5 item 1 took the row's floor, the other reader, away.) */
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
					    ⛔ UIR-7 item 2 — THE CENTRE RULE ABOVE IS DROPPED (founder's call).
					    Column 1 is the picture's own width (item 1) and column 2 takes the
					    rest: its author row, title row and split bar start 16px after the
					    picture and end at this card's right padding, so they grow and
					    shrink with it. A removed post has no picture and no column 1. The
					    width above survives as the picture's ceiling. A text-only post's
					    column 1 is its quote tile, 100px or 200px wide (item 3, UIR-8).
					    ⚠⚠ UIR-5 item 1 — THE HEIGHT IS UIR-3's, AND IT IS FIXED. UIR-4 gave
					    this row the market arm's height as a floor (192px of section at
					    1440); that floor is gone, and the section is back to the 125.25px
					    it measured at UIR-3's head. There it was a RESULT — this card's
					    26px of padding and border around a 24px author row, a 19.25px
					    title line, a 44px split bar and two 6px gaps; here it is a HEIGHT,
					    99.25px of row, which grows neither with what column 2 holds nor
					    with the market card beside it (sized to fit it — see
					    `FocusMarketCard`). Items stretch: all three columns take it. */}
					<div className="flex h-[99.25px] shrink-0 gap-4 max-mobile:flex-col max-mobile:items-start">
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
						    Only a removed post still draws nothing here.
						    ⚠ UIR-7 item 3 — THE WELL IS GONE FROM THIS PAGE; a text-only post
						    gets the well's two marks and no title.
						    ⚠ UIR-8 — AND ITS TITLE IS BACK BETWEEN THEM: `QuoteTile` draws it in
						    the well's type, laid out at the tile's own size rather than scaled
						    down from the well's.
						    ⚠ UIR-7 item 2 — AND IT RESERVES NOTHING NOW EITHER. The frame it
						    kept was the centre rule's, which is dropped, so a removed post has
						    no column 1 and its content starts at the card's left padding.
						    ⚠ UIR-7 item 1 — AN IMAGE POST'S FRAME IS NO LONGER THAT COLUMN: it
						    hugs its picture, in flow, and it is the row's fixed height — not
						    `absolute` — that keeps the attachment from setting the row's. */}
						{post.removed ? null : post.imageUrl ? (
							// ⚠ UIR-4 item 2 — THE IMAGE FILLS ITS BOX AT THE ROW'S HEIGHT:
							// whole (both axes bounded, scaled to fit, never cropped), centred,
							// with no border and no ground; the 6px `--imgr` radius is on the
							// image itself. It is the market-page card's own `fill` arm —
							// `max-h-full` against a definite height, here the row's — so T2
							// holds as it does there: an image smaller than the box keeps its
							// natural size rather than being upscaled. `border-0!` outranks the
							// image's own hairline, which `CommentImage` concatenates rather
							// than merges, so the order of the two in the stylesheet cannot
							// decide it. The click opens the lightbox, as before.
							// ⚠⚠ UIR-7 item 1 — AND THE BOX HUGS THE PICTURE's SHAPE. It was
							// column 1's fixed slot with the image `absolute` inside; the image
							// is in flow now, so the box is as wide as the picture drawn at the
							// row's 99.25px — its aspect ratio × that height — held between
							// 72px and the slot's old width (a third of the section, 344px from
							// `lg`). Past the ceiling (wider than 3.47:1 at `lg`) the picture
							// fills the width and centres down the box; under the floor
							// (narrower than 0.73:1) it fills the height and centres across it.
							// The box is sized by its content, not measured: nothing reads the
							// image in script and no dimension is needed from the server.
							// Measured in Chromium: 16:9 → 176.44px, 2:3 → 72px with the
							// picture 66.16px wide, 5:1 → 344px with the picture 68.8px tall.
							<div
								data-testid="post-focus-media"
								className="flex max-w-[calc((100cqw_+_26px)/3_-_13px)] min-w-[72px] shrink-0 items-center justify-center lg:max-w-[344px]"
							>
								<CommentImage
									url={post.imageUrl}
									onOpen={onOpenImage}
									fill
									className="max-h-full border-0!"
								/>
							</div>
						) : (
							<QuoteTile title={post.title} />
						)}

						{/* `.hstack` (`d5:462`, `flex:1 1 auto;min-width:0;flex-direction:
						    column`) — everything that is not the image.
						    ⚠ UIR-5 item 1 — ITS ROWS SPREAD OVER THE FIXED HEIGHT: the first
						    at the top, the split bar on the floor, the free height shared
						    evenly between them (`justify-between`, no gap). A box that cannot
						    grow has to give somewhere when its content does, and this makes
						    the somewhere the space between the rows rather than the last
						    row — so an author row that wraps at a narrow width closes the
						    gaps instead of pushing the split bar out of the card. */}
						<div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between">
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
									{/* ⚠⚠ UIR-5 item 3 — `Know more` RIDES THE AUTHOR ROW, at its
									    right end, right-aligned in column 2 and centred on the
									    row's height. The row of its own it had under the title is
									    height the fixed section cannot spare.
									    ⚠ THE PROFILE YIELDS TO IT: the profile's box takes what the
									    control leaves (`min-w-0 flex-1`) and clips on the inline
									    axis only. Where even its first group does not fit beside
									    the control — near `lg`, where column 1 is a fixed 344px and
									    column 2 is narrowest — its fields run out under their own
									    edge rather than under the control. The block axis stays
									    visible, so no focus ring is cut. */}
									<div className="flex items-center gap-2">
										<div className="min-w-0 flex-1 overflow-x-clip">
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
										</div>
										{hasExtendedText(post.body) ? (
											<KnowMore
												label="Know more about this argument"
												onClick={() => onOpenPopup(post)}
												className="shrink-0"
											/>
										) : null}
									</div>
									{/* ⚠ UIR-4 item 3 — only a post with an image keeps a title
									    row; without one, the well in column 1 is the title, and
									    `Know more` stands on its own row, right-aligned, where it
									    sits under an image post's title.
									    ⚠ UIR-5 item 3 — `Know more` has left its own row, on both
									    kinds of post, for the author row's right end (above).
									    ⚠ UIR-5 item 5 — AND EVERY POST KEEPS A TITLE ROW AGAIN, on
									    this page: a text-only post's comes back as an image post's
									    is, and the well in column 1 is a picture of the title rather
									    than the title. The masking does not move — a removed post
									    takes the other branch and has no title row at all.
									    ⚠ UIR-7 item 3 — column 1 carries no title now (the marks
									    tile), so this row is the only place a text-only post's title
									    is drawn, as it is for an image post.
									    ⚠ UIR-8 — the tile draws the title again, as a picture hidden
									    from assistive technology, so this row stays the heading and
									    is unchanged. */}
									{/* ⚠ UIR-4 item 4 — AN IMAGE POST'S TITLE IS ONE LINE, ALWAYS
									    (UIR-5 item 5: every post's), across column 2's full width;
									    `Know more` moved to its own row under it (UIR-5 item 3: to
									    the author row, since). The title starts at its 14px and
									    shrinks only as far as its length needs to fit the row,
									    never below 11px: `titleSize` is a pure function of the
									    length, read against the row's width in container units
									    (this row is the query container), so nothing is measured
									    in script. What still does not fit at 11px ends in `…` on
									    the same line, and the full title is in the tooltip. */}
									<div className="@container min-w-0">
										<InfoTip content={post.title} asChild>
											<h2
												className="truncate font-heading leading-snug font-medium"
												style={{ fontSize: titleSize(post.title) }}
											>
												{post.title}
											</h2>
										</InfoTip>
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
							    would be H1-f — a halt, not an edit. It was not needed.
							    ⚠ UIR-4 item 5 — IT IS TOUCHED NOW, by name: its end labels
							    are two lines of equal width, which centres the bar and its
							    `Đ N STAKED` in column 2.
							    ⚠ UIR-5 item 4 — and the whole bar is two lines now, 34px:
							    with a 24px author row and a 19.25px title that leaves the
							    fixed 99.25px room to spare, and with a wrapped (44px) author
							    row it still fits (97.25px).
							    ⚠ UIR-5 item 1 — `mt-auto` IS GONE. The column's
							    `justify-between` already puts the bar on the floor, and an auto
							    margin would take all the free height before `justify-content`
							    could share it between the rows. */}
							<div data-testid="post-focus-foot" className="shrink-0">
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

/** UIR-8 — the marks' size in the text-only tile, as a font size. */
const TILE_MARK_PX = 20;

/** UIR-8 — the tile's height: the row's `h-[99.25px]`. The two move together. */
const TILE_H_PX = 99.25;

/** UIR-8 — the space between each mark's ink and the title's band. */
const TILE_GAP_PX = 4;

/** UIR-8 — the title's size range in the tile, in px. */
const TILE_TITLE_PX = { min: 9, max: 20 } as const;

/** UIR-8 — a title up to this many characters gets the 100px tile; a longer
 * one gets 200px. Counted as `titleSize` counts, in UTF-16 units. */
const TILE_NARROW_MAX_CHARS = 40;

/**
 * UIR-8 — how many lines `title` takes in a `width`-px line at `size` px, or
 * `Infinity` when a word is wider than the line: the browser's own line-break
 * rule — whole words, filled greedily, broken at spaces — run on estimated
 * widths. Every character, the joining space included, is taken at the advance
 * `size.ts` records as the well's safe bound (`GEIST_UPPER_ADV / WRAP_SLACK`,
 * 0.7076 em). `text-wrap: balance` evens the lines out without adding one.
 */
function tileLines(title: string, width: number, size: number): number {
	const perLine = width / ((GEIST_UPPER_ADV / WRAP_SLACK) * size);
	let lines = 1;
	let used = 0;
	for (const word of title.trim().split(/\s+/)) {
		if (word.length > perLine) {
			return Number.POSITIVE_INFINITY;
		}
		if (used === 0) {
			used = word.length;
		} else if (used + 1 + word.length <= perLine) {
			used += 1 + word.length;
		} else {
			lines += 1;
			used = word.length;
		}
	}
	return lines;
}

/**
 * UIR-8 — the title's size in the tile, and how many lines the tile shows at
 * it. A pure function of the title and the tile's box, so nothing is measured
 * in script — the title row's `titleSize` rule, for a title that wraps.
 *
 * The title's band is the tile's height less both marks' ink and a 4px gap
 * under and over them. The size is the largest whole px in [9, 20] at which
 * the title's lines (`tileLines`) fit that band. ⚠ IT COUNTS WORDS, NOT ONLY
 * CHARACTERS, because a 100px line holds a word or two: measured on the 1,563
 * titles staging carried on 2026-09-29, a length-only estimate (the well's own,
 * `quoteTitleSize`) under-counted the lines of 6 of the 51 real titles and 547
 * of the 1,512 load-test ones — each would have been clipped at a size where a
 * smaller one fits — while this one under-counted none, and came within 3px
 * of the largest size that fits. `lines` is the band's whole lines at the
 * chosen size: a title that still overruns the band at 9px shows only full
 * lines and clips after the last.
 */
function tileTitleFit(
	title: string,
	width: number,
): { size: number; lines: number } {
	const band = TILE_H_PX - 2 * GEIST_QUOTE_INK * TILE_MARK_PX - 2 * TILE_GAP_PX;
	let size: number = TILE_TITLE_PX.min;
	for (let s = TILE_TITLE_PX.max; s > TILE_TITLE_PX.min; s--) {
		if (tileLines(title, width, s) * QUOTE_TYPE.lineHeight * s <= band) {
			size = s;
			break;
		}
	}
	return {
		size,
		lines: Math.floor(band / (QUOTE_TYPE.lineHeight * size)),
	};
}

/**
 * UIR-8 — A TEXT-ONLY POST's PICTURE: ITS TITLE BETWEEN THE QUOTE-1 WELL's
 * MARKS, the feed's text-as-image laid out at the tile's own size. It replaces
 * UIR-7 item 3's marks-only tile, and it is not UIR-5 item 5's scaled-down
 * well: the title is set for this box, so its type is as large as the box
 * allows rather than the well's size shrunk with the whole picture.
 *
 * The tile is as tall as the row and 100px wide for a title up to 40
 * characters, 200px for a longer one, with no border and no ground. The type
 * is the well's: Geist bold, uppercase, 0.02em tracking and 1.15 leading, the
 * title in `text-ink` and the marks — `“` and `”` in `text-n4`, here at 20px —
 * in the top-left and bottom-right corners. The title is centred between
 * them, balanced over its lines, at `tileTitleFit`'s size, and a title that
 * still overruns the band at 9px is clipped after its last full line.
 * ⚠ EACH MARK's BOX IS ITS INK, as in `QuoteWell` and off the same measured
 * constants: a mark's `line-height: 1` box is an em tall for 0.311 em of ink,
 * and the two marks sit at different heights in it. The margins make each box
 * exactly its ink, so `top-0` and `bottom-0` put the ink on the tile's edges
 * and the title's band can start and end a fixed gap from it.
 * ⚠ HIDDEN FROM ASSISTIVE TECHNOLOGY: the title row beside it is the heading
 * and says the same thing.
 * ⛔ A removed post never renders it — its variant has no title at the type
 * level, and the tile would publish the masked argument's title.
 */
function QuoteTile({ title }: { title: string }) {
	const width = title.length <= TILE_NARROW_MAX_CHARS ? 100 : 200;
	const { size, lines } = tileTitleFit(title, width);
	const ink = GEIST_QUOTE_INK * TILE_MARK_PX;
	const markStyle = (top: number) => ({
		fontSize: `${TILE_MARK_PX}px`,
		lineHeight: 1,
		marginTop: `${-top * TILE_MARK_PX}px`,
		marginBottom: `${-(TILE_MARK_PX - ink - top * TILE_MARK_PX)}px`,
	});
	return (
		<div
			data-testid="post-focus-media"
			aria-hidden="true"
			className="relative shrink-0"
			style={{ width: `${width}px` }}
		>
			<span
				className="absolute top-0 left-0 block font-sans font-bold text-n4"
				style={markStyle(GEIST_QUOTE_TOP)}
			>
				{"“"}
			</span>
			<div
				className="absolute inset-x-0 flex flex-col justify-center"
				style={{
					top: `${ink + TILE_GAP_PX}px`,
					bottom: `${ink + TILE_GAP_PX}px`,
				}}
			>
				<span
					className="block overflow-hidden text-center font-sans font-bold text-ink uppercase [overflow-wrap:anywhere] [text-wrap:balance]"
					style={{
						fontSize: `${size}px`,
						lineHeight: QUOTE_TYPE.lineHeight,
						letterSpacing: `${QUOTE_TYPE.tracking}em`,
						maxHeight: `${lines}lh`,
					}}
				>
					{title}
				</span>
			</div>
			<span
				className="absolute right-0 bottom-0 block font-sans font-bold text-n4"
				style={markStyle(GEIST_QUOTE_TOP_CLOSE)}
			>
				{"”"}
			</span>
		</div>
	);
}
