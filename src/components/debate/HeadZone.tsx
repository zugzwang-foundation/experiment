import type { ReactNode } from "react";

/**
 * ⚠⚠ UI-OVERNIGHT entry 3 — THE TWO BANDS, AND WHY THERE ARE TWO.
 *
 * `BAND_DECLARED` is the market-arm band. It WAS a fraction of the viewport
 * that did not grow, did not shrink, and contained its own content; it is now
 * content-sized like the post arm's, and the docblock directly above the
 * constants says why. The name is kept because three guards read it by name.
 *
 * `BAND_CONTENT_SIZED` is the POST arm's, and it exists because the post arm
 * put something inside the band that a declared height cannot hold. The market
 * arm's contents are chrome — a question, a stat line, a price bar — and
 * clipping the last few pixels of a resolver card costs a reader nothing. The
 * post arm's contents END IN A CONTROL: the Support / Counter split bar and the
 * stake summary beneath it. Clipping those does not shorten the header, it
 * removes the reply affordance from the surface whose whole purpose is replying,
 * and it does it silently — the band looks full, so nothing looks wrong.
 *
 * ⛔ THE FRACTION IS NOT REPLACED BY A BIGGER FRACTION, and that is the point.
 * Any fixed band is a bet that the content fits at every viewport height; the
 * bet was already lost once at 1440×700, which is what put `overflow-hidden`
 * here in the first place. Content-sizing is what makes the bet unnecessary.
 * `shrink-0` and `min-h-0` are kept — the band still does not grow into the
 * arena's space, and it still may shrink below its content when the page is
 * short, which is the one-screen chain's link.
 * ⚠⚠ `lg:items-start` STAYS, AND THE RAIL STRETCHES ANYWAY — THE ALIGNMENT IS
 * ON THE ITEM, NOT THE CONTAINER (`lg:self-stretch`, on `headzone-right`).
 *
 * Entry 3 added `lg:items-start` for a reason that no longer holds: "on a
 * content-sized band a stretched rail would be as tall as whatever the post
 * happens to say, which is how a market card ends up with a hundred pixels of
 * empty border under it." That was true of a rail whose card ENDED where its
 * content ended. `FocusMarketCard` now closes with a return line pinned to its
 * own floor, so the reclaimed height is spent on the affordance that says what
 * the card is for. The rail should stretch.
 *
 * ⛔⛔ BUT TAKING `items-start` OFF THE CONTAINER STRETCHES `headzone-LEFT` TOO,
 * AND THAT BREAKS THE READING COLUMN — MEASURED AT 1440, NOT REASONED. The post
 * arm's image placeholder is `aspect-[16/9] w-auto self-stretch`, so its WIDTH is
 * derived from its height; stretching the left column changes whether that height
 * is definite when the aspect ratio resolves, and the box went **146.46px →
 * 278.57px** wide. The title column lost that width, a 99-character title wrapped
 * from one line to two (h2 **24.75 → 49.49px**), and the Support / Counter bar
 * beneath it overflowed the header block by **8px** — landing 8.12px BELOW the
 * band, which is entry 3's own defect returning through the fix for it.
 * ⇒ So the rail is stretched BY NAME. `headzone-left` keeps the alignment it had
 * and its geometry is byte-identical to the pre-change render; only the rail's
 * cross-axis size changes, which is the whole of what was asked for.
 *
 * ⚠ THE CLIP CANNOT COME BACK EITHER WAY: entry 3's clip was `basis-[24.2dvh]`
 * plus `overflow-hidden` — a DECLARED height containing its own overflow — and
 * both are still absent, so the band is still sized by its content.
 */
/**
 * THE MARKET ARM IS CONTENT-SIZED TOO, AND THE FRACTION IS GONE.
 *
 * `basis-[24.2dvh]` was a bet that the market arm's stack fits inside 24.2% of
 * any viewport. It lost the same way the post arm's did, and it lost PER
 * MARKET: at a 700–780px window the fraction is ~170–190px while the stack
 * (question + attrs row + price bar + four resolution blocks + three `gap-5`
 * spacers) is ~180–200px BEFORE anything wraps. A market whose title and attrs
 * line happened to be short fitted; one with a longer title or a wrapped attrs
 * row pushed its badge row, price bar and resolution blocks past the band edge
 * — first clipped (`overflow-hidden`), then behind a band-level scrollbar
 * (`overflow-y-auto`, the interim fix this replaces). Either way two markets
 * at the SAME viewport rendered two different headers, and on the longer one
 * the badge, the AI-mode link and the Focus button looked cut.
 *
 * ⇒ The band is its content's height at every width. `shrink-0` and `min-h-0`
 * stay — the one-screen chain's link: the band never grows INTO the arena, and
 * the arena below is still `flex-1 min-h-0` and still the only scroller. What
 * moves is a few pixels of arena height, on exactly the markets whose header
 * used to be cut.
 *
 * ⚠ THE MOBILE-1 TOKENS LEFT WITH THE FRACTION. `max-mobile:basis-auto` and
 * `max-mobile:overflow-visible` released a basis and a clip that no longer
 * exist, so they would be inert; the phone-width outcome they bought (band =
 * content height, nothing clipped) is now what every width gets.
 *
 * ⚠ `BAND_CONTENT_SIZED` still differs, by one token: `lg:items-start`, which
 * the post arm needs for its reading column (measured above) and which the
 * market arm has no reason to carry — its rail stretches by name either way.
 * Two constants, one real difference.
 */
const BAND_DECLARED = "flex min-h-0 shrink-0 flex-col gap-5 lg:flex-row";
const BAND_CONTENT_SIZED =
	"flex min-h-0 shrink-0 flex-col gap-5 lg:flex-row lg:items-start";

/**
 * HTML-FINISH · MARKET DETAIL row 1 — the header zone's two-column FRAME, and
 * nothing else. One frame, two consumers.
 *
 * ⛔ THE FRAME PERSISTS; THE CONTENTS SWAP. This is the finding (plan §2, F-1)
 * that makes row 1 "the spine" rather than a layout tweak. Every element inside
 * the mockup's `.headzone` carries an ARM class — `vm` (market view) or `vp`
 * (post view) — and the two sets are disjoint:
 *
 *   .hleft   vm: .mmedia · .question · .attrs · .criterion · .rescards
 *            vp: .hpimg · .pauthor · .ptitle · .tease · .pfoot
 *   .hright  vm: .graph · .barrow f
 *            vp: .mcard
 *
 * The build did the opposite: `MarketHeader` rendered OUTSIDE the market↔post
 * ternary and `PostFocusHeader` stacked underneath it, so the header was
 * arm-BLIND and no `vp` element could land inside a header column. Hence this
 * component plus the ternary move in `DebateView` — `MarketHeader` renders the
 * market arm through it, `PostFocusHeader` the post arm.
 *
 * ⛔ `DebatePoll` DELIBERATELY STAYS OUTSIDE THE TERNARY. Its mount site is
 * load-bearing for the reason `DebateView.tsx` states in terms: inside the
 * ternary, entering or leaving a post would remount it and reset its `stopped`
 * and `wasSuspended` refs, so "stopped permanently" would last only until the
 * reader opened a post. Nothing here changes that.
 *
 * ⛔ TOPOLOGY ONLY — NO VALUE IS TAKEN FROM THE MOCKUP. The mockup's own
 * declarations are `.headzone{flex:0 0 188px;display:flex;gap:20px;
 * min-height:0}` · `.hleft{flex:1 1 auto;min-width:0}` · `.hright{flex:0 0
 * 340px;min-width:0}`. What is carried is the SHAPE — a row that does not grow,
 * a left column that does, `min-w-0` on both so they may shrink below their
 * content — and NOT the three lengths. The rail is a FRACTION (`lg:w-1/4`), a
 * topology declaration, never `340px`: the mockup is a fixed-desktop light-mode
 * prototype that declares no breakpoint at all, and a fixed track is precisely
 * the defect `shell/page-container.test.ts` records for the profile ("two 356px
 * columns at 1440 — IDENTICAL to its 768 rendering").
 *
 * ⚠ `min-h-0` IS A CHAIN LINK, and dropping it is invisible: a flex item's
 * automatic minimum size is its CONTENT, so without it a node refuses to shrink
 * below what it holds. Pinned by name in
 * `tests/unit/design/debate-height-chain.test.ts`.
 *
 * ⚠ THE RIGHT RAIL IS NOT RENDERED WHEN IT HAS NOTHING TO HOLD. An empty 25%
 * column is visible empty chrome, which is `PD-3-09` / `OD-6` — the ruling that
 * deleted the deferred-work placeholder box from `MarketHeader` for rendering a
 * build-time note to every participant. A consumer with no rail content passes
 * `null` and the surface is one column, exactly as it ships today.
 */
export function HeadZone({
	left,
	right,
	fit = false,
}: {
	left: ReactNode;
	/** `null` ⇒ no rail is rendered at all (see the docblock's last paragraph). */
	right: ReactNode | null;
	/**
	 * UI-OVERNIGHT entry 3 — take the post arm's band, whose one remaining
	 * difference from the market arm's is `lg:items-start` (both are
	 * content-sized now). Opt-in, and the post arm is the only caller: see
	 * `BAND_CONTENT_SIZED`'s docblock for the measurement behind that token.
	 */
	fit?: boolean;
}) {
	return (
		<section
			// ⚠ THIS COMMENT DESCRIBES `BAND_DECLARED` — the market arm's band. The
			// post arm takes `BAND_CONTENT_SIZED`; both constants' docblocks say why.
			// ⚠ `gap-5` = 20px is d5's `.headzone{gap:20px}` (`:447`), the gap
			// between the text column and the chart rail. `shrink-0` is the `0 0`
			// half of `flex:0 0`; `min-h-0` is the chain link pinned by name in
			// `debate-height-chain.test.ts`.
			//
			// ⛔ THE VIEWPORT FRACTION IS GONE, AND SO IS EVERYTHING THAT EXISTED TO
			// CONTAIN IT. The history is kept short, because each step is why the
			// next one happened: d5's `.headzone{flex:0 0 188px}` became
			// `basis-[24.2dvh]` (188/777 at the pinned 1440×777 — a viewport
			// fraction, because a container percentage drifts with the container's
			// own chrome and measured 146px on staging). Below ~715px of viewport
			// height that fraction was smaller than the stack's own content and the
			// excess painted over the arena (UI-QUICK change set 4 §C), so
			// `overflow-hidden` was added and the resolution row was clipped
			// instead. RECONCILE-1 OWED-4 recorded that clip as contested against
			// `MarketHeader`'s `headzone-stack` scroll and `ResolverCards`' floor;
			// the interim answer swapped the clip for `overflow-y-auto`, which put a
			// scrollbar on the band and still cut the badge row on any market whose
			// title or attrs line wrapped — so two markets at the same viewport
			// rendered two different headers. Content-sizing retires all of it:
			// nothing overflows a box sized to what it holds, so there is nothing
			// to clip, scroll, or contest. `headzone-stack`'s own `overflow-y-auto`
			// is left where it is and is now inert, since that box is never
			// smaller than its content either.
			// MOBILE-1 Phase A's phone-width release of the basis and the clip is
			// subsumed for the same reason — see the constant's docblock.
			data-testid="headzone"
			className={fit ? BAND_CONTENT_SIZED : BAND_DECLARED}
		>
			<div
				// `.hleft{flex:1 1 auto;min-width:0;display:flex;gap:16px}` (`d5:448`)
				// — a ROW, not a stack. Its two children are the media panel and the
				// text stack; `MarketHeader`/`PostFocusHeader` supply that row.
				//
				// ⛔ D-52 R5 — ONE HEADER HEIGHT, and this node carries it because it
				// is the one node BOTH arms render. At lg+ the market arm's height is
				// its media panel's: `w-1/3` of this column at 16:9, i.e. 3/16 of this
				// column's width, which is `100vw` less the screen preset's two 28px
				// insets, the 340px rail and the 20px band gap (`100vw − 416px`) —
				// measured 191.98px at 1440 and 281.98px at 1920, on staging's slate
				// and on the local fixture alike. The post arm takes the same value
				// as a FLOOR, so the arena below starts at the same y in both arms.
				// A floor, never a height: a column whose content is taller still
				// grows (the clip history above is why), and the chain's `min-h-0`
				// still governs below lg. ⚠ If the rail, the gap or the screen insets
				// change, this number changes with them.
				data-testid="headzone-left"
				className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:min-h-[calc((100vw_-_416px)_*_3_/_16)]"
			>
				{left}
			</div>
			{/* ⛔⛔ RESO-2 — THE RAIL'S WIDTH IS RESERVED WHEN THE RAIL IS ABSENT, and
			    this spacer is deliberately NOT the rail. When a market has no
			    renderable price series the rail does not render (CRIT-1), and the
			    left column then took the whole band: the block row went 673.73px →
			    1033.73px and each of the four blocks 162.43px → 252.43px. The blocks
			    are not entitled to the chart's space, so the reading column keeps the
			    width it has when the chart is there.
			    ⚠ IT IS A SEPARATE NODE, NOT A RE-RENDERED `headzone-right`, AND THAT
			    IS THE WHOLE CARE HERE. Resurrecting the rail would mechanically
			    revert CRIT-1 — whose fix was that an empty 340px `headzone-right`
			    must never render (`PD-3-09`) — and would red its two guards
			    (`a-null-series-drops-the-RAIL-not-just-the-chart`,
			    `an-EMPTY-series-drops-the-rail-too`). Those rulings stand: there is
			    still no rail. What exists is a width reservation with no testid, no
			    border, no background and no children, which is a layout constant
			    rather than chrome.
			    ⚠ `aria-hidden` + no content: it is invisible to AT and to find-in-page,
			    and contributes nothing but a track width.
			    ⛔ THE CHART COMPONENT AND THE RAIL'S POSITION ARE UNTOUCHED (CHANGE 2)
			    — when `right` is non-null this branch does not run at all. */}
			{right === null ? (
				fit ? null : (
					<div
						aria-hidden="true"
						className="hidden w-[340px] shrink-0 lg:block"
					/>
				)
			) : (
				<div
					// ⛔⛔ THE RAIL IS d5's LITERAL `340px`, AND THE PREVIOUS RULING IS
					// REVERSED. This read `lg:w-1/4` under a rule that a fixed track
					// was the defect; the founder's 2026-08-17 parity ruling names
					// rail width as one of the literals to copy, and the measurement
					// agrees: at the pinned 1800×971 d5's `.hright{flex:0 0 340px}` is
					// 18.9% of the viewport while `w-1/4` of the headzone gave 19.3% —
					// close in the rail itself, but it took its width from a container
					// that was ALSO wrong, and the two errors were cancelling. With
					// the container corrected to full-bleed, `w-1/4` of 1744px would
					// be 436px — 5.7pp too wide, squeezing the text stack.
					// ⚠ `shrink-0` unconditionally now, not `lg:shrink-0`: a fixed
					// basis that is allowed to shrink is not a fixed basis.
					//
					// ⛔⛔ BLOCK-3 — `hidden lg:flex` IS NEW, AND IT CLOSES A GAP THIS
					// BRANCH NEVER HAD TO FACE UNTIL NOW. Below `lg`, `headzone` is
					// `flex-col`: `headzone-left` and this rail stack VERTICALLY,
					// sharing one band (then a viewport fraction) instead of standing side by
					// side. This rail is content-sized (no `flex-1`), so it simply
					// takes whatever height its chart needs FIRST, and `headzone-left`
					// — which holds the market question, the stats line, the price bar
					// and the resolver row — gets only the remainder. MEASURED at
					// 390×844 on a market with a renderable chart: rail 166.4px,
					// `headzone-left` 17.8px — the resolver row rendered inside a
					// sliver under one line tall.
					// ⇒ NOT HYPOTHETICAL, AND NOT REACHABLE AT BLOCK-1's TIME. At
					// BLOCK-1 no market had enough price history for
					// `MarketPriceChartHost` to return non-null (measured then: ZERO
					// of eight), so this branch had never actually competed with
					// `headzone-left` for the stacked band — the `right === null`
					// branch two paragraphs up was the only one BLOCK-1-era markets
					// could exercise below `lg`. Enough time has since passed that at
					// least two of the eight now have one.
					// ⇒ THE FIX MATCHES THE PATTERN THE SIBLING BRANCH ALREADY SET.
					// `right === null` already hides its placeholder below `lg`
					// (`hidden w-[340px] shrink-0 lg:block`, two branches up) — on the
					// ruling that an empty rail is visible chrome with nothing to show
					// at a width where it was never designed to stand. A rail that
					// CAN'T fit without crushing its sibling is the same case: hidden
					// below `lg`, exactly where the chart was always meant to stand
					// beside `headzone-left` rather than above or below it. The chart
					// itself and its wide-viewport position are UNCHANGED — this is a
					// visibility toggle on the container, not a resize of what's
					// inside it.
					// ⚠⚠ `lg:self-stretch` — THE RAIL FILLS THE BAND, BY NAME RATHER THAN
					// BY ITS CONTAINER'S ALIGNMENT. The post arm's band carries
					// `lg:items-start`, and `BAND_CONTENT_SIZED`'s docblock carries the
					// measurement that keeps it there — taking it off the CONTAINER also
					// stretches the reading column, which re-resolves the post image's
					// aspect ratio and wraps a long title into the Support / Counter bar.
					// This opts THIS column out of it instead, so the market card reaches
					// the reading column's bottom edge and its return line is pinned to a
					// floor that exists.
					// ⛔ A NO-OP ON THE MARKET ARM, whose band never declared `items-start`
					// — stretch is already the default there. One arm changes, and this
					// says which.
					data-testid="headzone-right"
					className="hidden w-[340px] min-w-0 shrink-0 flex-col gap-3 lg:flex lg:self-stretch"
				>
					{right}
				</div>
			)}
		</section>
	);
}
