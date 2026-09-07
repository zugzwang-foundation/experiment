"use client";

import { Card } from "@/components/ui/card";

import { ArgProfile } from "./ArgProfile";
import { SideBadge } from "./badges";
import { CommentImage, PostImagePlaceholder } from "./CommentImage";
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

					    ⛔ AND THE FAILURE WAS INVISIBLE TO THE CHECK THAT CLEARED IT.
					    `<Card>` is `overflow-hidden`, so the clipping happens INSIDE the
					    card and `documentElement.scrollWidth` stays exactly 0px while
					    content is destroyed — the Counter button cut 24px, the Exited
					    badge cut 33px, eight elements with `scrollWidth > clientWidth`.
					    Anything measuring this row measures the clipping ancestor's
					    descendants, never the document. */}
					<div className="flex min-h-0 flex-1 gap-4 max-mobile:flex-col">
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
							<div className="aspect-[16/9] w-auto shrink-0 self-stretch">
								{/* `.hpimg{aspect-ratio:16/9;height:100%;width:auto}` (`d5:787`)
								    — the same height-driven frame the market arm gives
								    `.mmedia`.
								    ⚠⚠ UI-OVERNIGHT entry 3 — `self-stretch` REPLACES `h-full`,
								    AND WITHOUT IT THIS BOX WOULD HAVE COLLAPSED SILENTLY. The
								    superseded note ended "now that the band has a definite
								    height", which was the load-bearing half: `height:100%`
								    resolves against a definite parent height, and entry 3 makes
								    this band CONTENT-SIZED so that its own reply bar stops being
								    clipped. A percentage height inside a chain that derives its
								    height from this element is circular, and a browser resolves
								    it to `auto` — the frame would shrink to one line of
								    placeholder text with no error anywhere.
								    ⇒ `self-stretch` takes the height from the SIBLING text stack
								    instead, which is what actually determines the row: the item
								    keeps `height:auto`, stretch gives it the line's cross size,
								    and `aspect-ratio` derives the width from that. The inner
								    placeholder's own `h-full` then resolves against a height that
								    is definite after layout. Same rendered geometry, obtained
								    from the sibling rather than from an ancestor that no longer
								    declares one.
								    ⚠ NOT VERIFIABLE IN THIS SUITE — jsdom performs no layout, so
								    this is a construction argument and a browser check at 1440 is
								    owed before merge. Reported. */}
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
									<h2 className="font-heading text-lg leading-snug font-medium">
										{post.title}
									</h2>
									{/* ⚠⚠ UI-OVERNIGHT entry 3 — THE INLINE TEASER IS GONE FROM THIS
									    HEADER, and what it cost is the reason. d5's `.tease` (`:972`)
									    is a two-line body teaser, and row 15 had already narrowed it
									    from the whole body to a clamped preview because an unclamped
									    one pushed the reply arena below the fold. The clamp bought
									    room; it did not buy enough. The band this header sits in is a
									    fraction of the viewport, and with a title, an author row, two
									    lines of teaser and a split bar inside it, the bar and the stake
									    summary under it were CLIPPED — the reader saw an argument and
									    no way to answer it.
									    ⇒ Post-focus is where you READ an argument and then reply. Two
									    lines of preview are not reading, and they were being paid for
									    with the control that makes the surface work.
									    ⚠ THE FULL BODY IS NOT LOST — one click away in the pop-up, and
									    still whole in the ADR-0025 `.md` export.
									    ⛔ `post.teaser` IS STILL ON THE WIRE and still derived; nothing
									    server-side changes, and a surface that wants it back needs only
									    to render it. Same posture `HeroPanels` took when its own teaser
									    was removed. */}
									{/* ⚠⚠ UI-QUICK change set 2 item 2 — `Know more` REPLACES THE
									    GLYPH, and the superseded note is the reason it had to. It read:
									    "Byte-carried from the mockup's own control (`d5:972`,
									    `aria-label='Show more'`) — the same string the card's `+`
									    carries, because it is the same action." The second clause is the
									    binding one: it IS the same action, so once the card's control
									    became text this one had to follow or the claim stopped being
									    true. ⛔ The byte-carried label does not survive the relabel — a
									    button reading `Know more` named `Show more` fails WCAG 2.5.3
									    (Label in Name). Mockup fidelity loses to the success criterion;
									    `KnowMore.tsx` owns the rule for every mount.
									    ⚠ UI-OVERNIGHT entry 5 — ONLY WHEN THERE IS MORE TO SHOW, and
									    that reverses d5's "hidden-but-reserved when bodyless". On a
									    post with no second paragraph the full body IS the title, so the
									    pop-up showed the reader the sentence they had just read.
									    ⚠ `self-end` REPLACES the flex row this control shared with the
									    teaser. With the teaser gone that row held one child, and a
									    one-child `justify-between` row is a wrapper that does nothing —
									    except add a `gap-3` of empty space on the posts that render no
									    control at all. */}
									{hasExtendedText(post.body) ? (
										<KnowMore
											label="Know more about this argument"
											onClick={() => onOpenPopup(post)}
											className="self-end"
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
