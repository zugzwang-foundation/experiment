import type { ReactNode } from "react";

/**
 * ⚠⚠ UI-OVERNIGHT entry 3 — THE TWO BANDS, AND WHY THERE ARE TWO.
 *
 * `BAND_DECLARED` is the shipped market-arm band, byte-for-byte: a fraction of
 * the viewport that does not grow, does not shrink, and contains its own
 * content. Every word of the reasoning below it belongs to that string.
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
 * MOBILE-1 Phase A — `max-mobile:basis-auto max-mobile:overflow-visible` is
 * appended here rather than at the call site, because the two overrides only
 * mean anything against THIS constant: `BAND_CONTENT_SIZED` declares neither
 * `basis-[24.2dvh]` nor `overflow-hidden`, so the same pair would be inert
 * noise on the post arm.
 *
 * Below 640px the arena stacks (`DebateView`'s two `arena` divs), so a band
 * pinned to a viewport FRACTION and clipping its own overflow no longer has
 * the two-column layout it was sized to protect — it just truncates a column
 * that is now full-width. Released to content height and ordinary flow.
 * >=640px both tokens are inert and the band is byte-unchanged.
 */
const BAND_DECLARED =
	"flex min-h-0 shrink-0 basis-[24.2dvh] flex-col gap-5 overflow-hidden lg:flex-row max-mobile:basis-auto max-mobile:overflow-visible";
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
 * below what it holds and the band silently reverts to content height. Pinned by
 * name in `tests/unit/design/debate-height-chain.test.ts`.
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
	 * UI-OVERNIGHT entry 3 — size the band to its CONTENT instead of to a
	 * fraction of the viewport, and stop stretching the rail. Opt-in, and the
	 * post arm is the only caller: see `BAND_CONTENT_SIZED` for why the two arms
	 * genuinely differ rather than one of them being behind.
	 */
	fit?: boolean;
}) {
	return (
		<section
			// ⚠ EVERYTHING IN THIS COMMENT DESCRIBES `BAND_DECLARED` — the market
			// arm's band. The post arm takes `BAND_CONTENT_SIZED` instead, and that
			// constant's own docblock says why the reasoning below does not reach it.
			// ⚠⚠ THE BAND IS A FRACTION OF THE VIEWPORT — not d5's literal `188px`,
			// and NOT a percentage of the container. `.headzone{flex:0 0 188px}`
			// (`d5:447`) is 188/777 = **24.2%** of the viewport at the pinned
			// 1440×777.
			// ⛔ A CONTAINER PERCENTAGE WAS TRIED FIRST AND IS WRONG, MEASURED: at
			// 1800×971 the container's content box is 877px, so d5's band is 21.4%
			// of it; at 1440×777 that box is 683px and the SAME 188px band is 27.5%.
			// One number cannot be both — a container percentage drifts with the
			// container's own padding and chrome, while a viewport percentage is the
			// ratio the mockup's fixed px actually encodes. Shipping 21.4% measured
			// the band at 146px on staging: a −5.4pp miss that dragged the media
			// panel (−5.2pp) and the arena (+5.1pp) with it.
			// ⚠ `dvh`, not `vh` — same reason as the container's own band.
			// `shrink-0` is the `0 0` half of `flex:0 0`.
			// ⚠ `gap-5` = 20px is d5's `.headzone{gap:20px}` (`:447`), the gap
			// between the text column and the chart rail.
			// ⚠⚠ `overflow-hidden` — UI-QUICK change set 4 §C. THE BAND NOW CONTAINS
			// ITS OWN CONTENT, and without it the resolver cards painted over the top
			// border of both debate columns.
			// MEASURED on staging, and the cause is arithmetic rather than a stray
			// margin: `basis-[24.2dvh]` is a VIEWPORT FRACTION while the stack's
			// content has an INTRINSIC height (~185px from the band's top). Below a
			// viewport height of ~715px the fraction is smaller than the content, and
			// with nothing containing it the excess simply painted downward onto the
			// arena — 3.64px at 1440×700, and 29.14px before §B removed the `Know
			// more` trigger.
			// ⛔ THE THREE ALTERNATIVES WERE EACH RULED OUT, not overlooked:
			//   · restore `overflow-y-auto` on the stack — that is precisely what
			//     change set 1 removed by ruling (its scrollbar collided with the
			//     sticky header), so it cannot come back here.
			//   · drop `min-h-0` / add a `min-h-[…]` floor — `min-h-0` is pinned BY
			//     NAME by `debate-height-chain.test.ts` as the link that lets the band
			//     shrink; a floor would contradict it and re-open the one-screen
			//     ruling.
			//   · leave it — the exit bar is zero overlap at every tested width.
			// ⇒ Containment matches what the chain ALREADY does one level up:
			// `PageContainer` declares one screen and hides its own overflow, on the
			// stated ground that content spilling out of a declared box "is the same
			// page scroll under a different name". The band is a declared box too.
			// ⚠ THE COST, MEASURED AND REPORTED: below ~715px of viewport height the
			// resolver-card row is now CLIPPED rather than overlapping. That is worse
			// than fitting and better than painting over the arena, and those were the
			// only two options left once the scroller was ruled out. Both cards are
			// empty placeholder chrome docketed for removal before the DP.2 promote
			// (`docs/parked.md` HTML-FINISH-MD-PLACEHOLDERS), so nothing a
			// participant can read is being cut.
			//
			// ⛔⛔ EVERYTHING ABOVE IS CONTESTED AT HEAD AND MUST NOT BE READ AS LIVE
			// DOCTRINE — RECONCILE-1 OWED-4, awaiting a founder ruling. The
			// main→staging merge took `main`'s components alongside this block, and
			// they DO two of the three things it rules out:
			//   · `MarketHeader.tsx` — the `headzone-stack` carries `overflow-y-auto`,
			//     the exact class bullet 1 says "cannot come back here".
			//   · `ResolverCards.tsx` — carries a `min-h-[78px]` floor (BLOCK-3 §2; was
			//     `min-h-[84px]` — the exact number moved, the contradiction below did
			//     not), which bullet 2 says would "contradict" the `min-h-0` pin; its
			//     own comment calls the previous `min-h-0` a defect that silently
			//     disabled the scroll backstop. The two rulings are in direct
			//     opposition.
			// Also stale by consequence: the row renders FOUR blocks, not "both
			// cards", and per `ResolverCards.tsx` the stack SCROLLS rather than clips.
			// ⚠ And the arithmetic above ("3.64px", "29.14px") was measured against a
			// stack that still contained staging's `ResolutionCriterion` block, which
			// this merge removed — the numbers no longer describe the tree they
			// annotate.
			// ⛔ NEITHER SUITE CAN SEE ANY OF THIS: jsdom performs no layout, and the
			// height chain scans only `headzone`, `-left`, `-right`, `arena` and
			// `column-scroll`. Green here proves nothing about the conflict.
			// ⇒ The prose is marked rather than rewritten, because choosing which
			// ruling governs is a founder call and a merge is not the place to make
			// it. When it is ruled, correct THIS block in place (O-5).
			// ═══ END OF THE CONTESTED BLOCK (RECONCILE-1 OWED-4) — everything
			// below this line is MOBILE-1 Phase A, live doctrine, unrelated to
			// the dispute above. ═══
			// MOBILE-1 Phase A — the viewport-fraction band and its
			// overflow-hidden exist to protect the one-screen /m/[slug]
			// composition (PageContainer, DebateView.tsx), which is itself
			// released below 640px. Below lg the rail already renders nothing
			// (headzone-right is `hidden ... lg:flex`, BLOCK-3), so at phone
			// width this band holds headzone-left ALONE — question, price bar,
			// resolver row — and that content's own height at a typical phone
			// viewport (e.g. ~812px tall) exceeds 24.2dvh (~197px) on its own,
			// with no rail contributing to it. Releasing basis/overflow here
			// is what stops that content being clipped, matching the page
			// around it going to ordinary scroll instead of clipping.
			data-testid="headzone"
			className={fit ? BAND_CONTENT_SIZED : BAND_DECLARED}
		>
			<div
				// `.hleft{flex:1 1 auto;min-width:0;display:flex;gap:16px}` (`d5:448`)
				// — a ROW, not a stack. Its two children are the media panel and the
				// text stack; `MarketHeader`/`PostFocusHeader` supply that row.
				data-testid="headzone-left"
				className="flex min-h-0 min-w-0 flex-1 flex-col gap-3"
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
				<div
					aria-hidden="true"
					className="hidden w-[340px] shrink-0 lg:block"
				/>
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
					// sharing one `basis-[24.2dvh]` band instead of standing side by
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
