import Link from "next/link";

import { PriceBar } from "@/components/debate/PriceBar";
import { splitMarketTitle } from "@/lib/market-title";
import type { DiscoveryCard } from "@/server/discovery/list";

import { MarketThumb } from "./MarketThumb";
import { StatLine } from "./StatLine";

/**
 * The design-language §3.2 LOCKED card composition (Slot 1): image thumb +
 * question · YES/NO split bar · `Đ staked·posts·replies` — built identical for
 * Discovery and Profile (pure presentational, DTO-driven). The YES/NO bar is
 * the REUSED debate `PriceBar` (F-6 — no fresh MarketBar). The whole card is
 * ONE link → `/m/[slug]` (§22 F-DISC-1).
 *
 * HTML-FINISH row 1 — THE TILE CARRIES NO PRICE CHART. The mockup's `.mcard`
 * is `.qrow` + `.barrow m` with nothing between (`:269-282`), and its `.spark`
 * rule (`:155`) styles NO ELEMENT IN THE DOCUMENT — a dead rule is the tell
 * that the chart was removed from the tile and its CSS left behind. The
 * sparkline box and the `series` prop that fed it are gone from this
 * composition. ⚠ THE TILE STILL CARRIES NO CHART, AND CHART-1 DID NOT CHANGE
 * THAT — the ratified mockup governs the tile and this paragraph stands. What
 * changed is the sentence that used to follow it: `PriceSparkline` was kept
 * alive because the hero rendered it, and at CHART-1 the hero moved onto the
 * `/m/[slug]` chart component, so the sparkline had no caller left and was
 * deleted. `DiscoveryMarketView.series` still carries the series to the hero,
 * so no read model changed here either (removing the FETCH remains PERF-1's,
 * not this task's).
 * The thumb is the shared `MarketThumb` (PRIMITIVES-2 D2), which renders the
 * canon-§6 `IMG` placeholder box for BOTH a null `imageUrl` (defensive arm)
 * and a presigned URL that 404s. Its `alt` is `""`: the same title renders in
 * the adjacent `<h3>` two lines below, so the thumb is decorative here, and a
 * duplicated announcement is also what overflowed the metadata row on a broken
 * load (D4 / PD-2-33 — this supersedes the OQ-6 dynamic-alt rule AT THIS SITE;
 * the WCAG 1.1.1 half remains A11Y.0's row).
 * `active` marks the carousel's ringed card via `data-active` AND carries the
 * ring itself (HTML-FINISH row 4 — see below).
 */
export function MarketCard({
	card,
	active = false,
}: {
	card: DiscoveryCard;
	active?: boolean;
}) {
	/**
	 * MKT-ROSTER-1-P3 · OPTION B — THE TILE SHOWS THE QUESTION. Every live title
	 * is `<Topic> · <Question>`, and at xl the topic was spending the most
	 * prominent line on the tile to say a word the picture beside it already
	 * says. Stripping it is what buys the question a single line at a readable
	 * size; nothing else on the tile moved to pay for it.
	 *
	 * ⛔ THE SPLITTER IS THE EXPORT'S OWN, NOT A SECOND ONE. It was
	 * `compose.ts`'s and now lives at `@/lib/market-title` for one reason: this
	 * component ships in the client graph (via the carousel) and `compose.ts`
	 * imports a VALUE out of `@/server/markets/create`, so importing from there
	 * would drag the `server-only` chain into the browser bundle. One
	 * implementation, two callers. ⚠ `splitMarketTag` in `PositionsTable.tsx`
	 * is a DIFFERENT function — it keeps the separator on `rest` — and nothing
	 * here touches it.
	 *
	 * ⚠ NO TITLE STRING CHANGED, and none can: this is a read-time split of
	 * whatever the row holds. A title with no separator comes back whole
	 * (`category === null`) and renders exactly as it does today, which is the
	 * branch every `sp-m*` fixture and the render suite's own fixture take.
	 */
	const { category, question } = splitMarketTitle(card.title);
	return (
		<Link
			href={`/m/${card.slug}`}
			data-testid="market-card"
			{...(active ? { "data-active": "true" } : {})}
			// V40 — `.mcard` is 13px padding with `justify-content:space-between`
			// (:150-151): the price bar is pinned to the card floor so a 1-line
			// and a 2-line title produce the same card, rather than floating up
			// behind a short title.
			//
			// HTML-FINISH row 4 — THE RING IS ON THE TILE, and the wrapper box
			// that used to carry it is gone. The mockup rings `.mcard` itself
			// (`.mcard.athero`, :152) and `.grid`'s children ARE the cards
			// (:267-282), so the extra `<div>` around every tile had no mockup
			// counterpart: it made the tile a child of the grid cell rather than
			// the cell it fills. Moved here FROM `DiscoveryGrid.tsx` with its
			// geometry unchanged — 1.5px at 3px offset, via the `--ring-active`
			// ladder token.
			//
			// V42 + the colour call, carried verbatim from the grid because it
			// documents THIS line: the mockup rings in `--ink`, but BRIDGE retired
			// ink-emphasis borders and `--border-strong` was aliased to n2 — the
			// exact value of every card's own hairline, so the "active" ring
			// differed from a resting card by 2px of width and nothing else.
			// Mapping `--ink` by name is forbidden (it is #fafafa on the dark
			// ramp, far louder than the mockup's #0A0A0A-on-white), so the ring
			// takes n4: one step brighter than the hero panel's n3 (V7), which is
			// one step brighter than the grid's n2 hairline. Three legible steps,
			// all inside the ratified ramp. Founder ruling requested at Gate C.
			//
			// JS-toggled class — no `:has()` (canon §3.10).
			//
			// ⛔⛔ MOBILE-1 Phase A — THE RING IS SUPPRESSED BELOW 640px, and the
			// reason is that it stops meaning anything there. The ring marks the
			// card whose hero is currently featured; the founder ruled the hero
			// hidden at phone width (`HeroPanels.tsx`), so the ring would point
			// at a panel that is not on screen. Worse, it MOVES: the carousel's
			// 10s auto-advance keeps running behind the hidden hero, so a card
			// highlights itself and the highlight wanders down the list every
			// ten seconds with nothing on screen explaining it. MEASURED in a
			// browser at 375px — this was visible, not theoretical, and it is
			// the user-facing half of the "CSS hide leaves the timer running"
			// cost that this task first recorded as invisible.
			// ⚠ `max-mobile:outline-none` rather than stopping the timer: killing
			// the timer needs a client viewport read, which plan §4 rules against
			// (hydration). Suppressing the only thing it renders is the
			// pure-CSS answer, and it leaves >=640px byte-identical.
			//
			// ⛔⛔ MKT-ROSTER-1-P3 · OPTION B — THE xl (>=1280) ANATOMY, AND IT IS
			// THREE ROWS NOW. This block previously described a two-row grid whose
			// first column held an 84x84 picture beside a stacked title/stats/bar
			// column; that is superseded and the text is replaced rather than
			// annotated. The shape is:
			//
			//     row 1   the QUESTION, spanning BOTH columns — the full inner width
			//     row 2   picture (spanning rows 2-3)  |  stats
			//     row 3                                |  YES/NO bar
			//
			// The title is the one thing on this tile whose length is not ours to
			// choose, so it is the one thing given the whole width. Everything else
			// has a known size and fits beside a picture.
			//
			// ⛔ THE HEIGHT IS ARITHMETIC AND IT IS THE POINT OF THE ROUND: the
			// tile stays **112** and the hero does not move, so the picture is
			// whatever is left after the title band. 13 + 28 + 56 + 13 + 2 = 112 —
			// inset, title band, picture, inset, hairline. The picture yields
			// 84 -> 56 and the grid gives the hero back nothing, because the
			// question row takes exactly what the picture gave up.
			//
			// ⚠ WHY GRID RATHER THAN A ROW WITH A COLUMN IN IT. The bar and the
			// title block are SIBLINGS in this DOM — the bar is full-card-width
			// below xl and must sit inside the right column above it, and one node
			// cannot have two parents. `xl:contents` on BOTH wrappers (the title
			// row and the text column) dissolves them, so the picture, the `<h3>`,
			// the stat block and the bar are all direct children here and each
			// names its own cell. No DOM moved; below xl both wrappers are ordinary
			// boxes again and the render is untouched.
			//
			// ⛔ `content-between`, NOT `grid-rows-[...]`, AND THE DIFFERENCE IS
			// THE PICTURE'S FLOOR. An item spanning a FLEXIBLE track is excluded
			// from that track's intrinsic sizing, so with a `1fr` track the picture
			// would contribute nothing to the height and overflow its own area when
			// the text is short. AUTO rows size to content — the spanning picture is
			// counted, which is what makes "rows 2-3 = max(picture, stats + bar)"
			// true by construction — and `align-content: space-between` then hands
			// any spare pixel to the gaps BETWEEN the rows, which is what keeps the
			// question at the top and the bar on the floor when a taller row-mate
			// stretches the tile.
			//
			// ⚠ `justify-between` above is INERT at xl, not contradictory: on a grid
			// it distributes TRACKS along the inline axis, and `1fr` already consumes
			// the free space there. Left unprefixed so the sub-xl render takes zero
			// diff, which is the whole of ADR-0045's override-never-replace rule.
			//
			// ⛔⛔ `xl:gap-x-3` NOW COMPILES, AND FOR THREE ROUNDS IT DID NOT. It has
			// been in this class string since the xl anatomy landed and the computed
			// `column-gap` was `normal` the whole time — measured on the deployed
			// branch, and confirmed against the Tailwind Oxide scanner, which
			// extracted 13 `xl:` candidates from this file and NOT this one. The
			// cause is a character, not a utility: the template literal read
			// `xl:gap-x-3${`, so the class ran straight into the interpolation with
			// no delimiter and the extractor never saw it. The space before `${` is
			// the entire fix. ⚠ THE 84px COLUMN WAS THEREFORE FLUSH AGAINST THE
			// TEXT, and `MarketCard`'s own docblock quoted a 329px title column that
			// only ever existed on paper. ⇒ A class adjacent to `${` is a class that
			// does not exist; keep the separator, and probe a gap by reading its
			// computed value rather than by reading it back out of the source.
			className={`flex flex-col justify-between rounded-[var(--r)] bg-n0 p-[13px] [border:var(--hairline)] xl:grid xl:grid-cols-[56px_1fr] xl:content-between xl:gap-x-3 ${
				active
					? "[outline:var(--ring-active)] outline-offset-[3px] max-mobile:outline-none"
					: ""
			}`}
		>
			{/* HTML-FINISH row 5 — the picture is CENTRED against the title block,
			    not top-aligned. The mockup uses ONE `.qrow` class for the tile and
			    the hero alike (`align-items:center`, :122) and the hero already
			    shipped `items-center`; the tile was the odd one out. */}
			{/* ⛔ `xl:contents` DISSOLVES THIS ROW ABOVE 1280 — see the root. Its
			    `items-center` and `gap-3` go inert with it, which is correct: the
			    picture is `self-start` at xl and the column gap is the grid's. */}
			<div className="flex items-center gap-3 xl:contents">
				<MarketThumb
					src={card.imageUrl}
					alt=""
					// ⛔⛔ `object-cover` AT EVERY WIDTH, AND THE `xl:object-contain` THAT
					// STOOD HERE IS DELETED RATHER THAN OVERRIDDEN. It reversed this
					// site's `cover` above 1280 on the reasoning that the picture is the
					// tile's subject and a crop is a decision nobody made. ⚠ THE
					// REASONING WAS RIGHT AND THE PREMISE WAS WRONG: `contain` does not
					// show more of a picture, it fits the picture to the LIMITING axis.
					// Measured on the deployed branch at 1440 — every market image is
					// 1200x675, so `contain` painted a 16:9 letterbox inside a square box
					// and left a dead band above and below. The subject got SMALLER, not
					// more complete, and 44% of the box it was given rendered nothing.
					// `cover` fills the square from a source many times its width, so
					// nothing is upscaled and the crop is off the sides of a 16:9 frame
					// rather than out of the middle.
					// ⚠ It is also what ships below 1280, so this class is one value at
					// every width — the tier no longer changes what the picture does,
					// only how big it is.
					// ⛔⛔ MKT-ROSTER-1-P3 · OPTION B — THE BOX IS **56**, AND IT HAS
					// READ 96, 84 AND NOW 56 ACROSS THREE ROUNDS. It is not a taste
					// number and it is not free to move: the tile is pinned at 112 and
					// the title band above it is 28, so 112 - 28 - 26 of inset - 2 of
					// hairline leaves exactly 56. Every pixel added here comes off the
					// question or off the hero. At 56 the source is still ~21x the
					// rendered box, so nothing is upscaled at this size either.
					// `xl:self-start` stays and now matters more: the picture spans rows
					// 2-3, which together are taller than it whenever the stats and the
					// bar are, and `self-start` is what keeps its top edge on the title
					// band rather than floating it in the slack. `--imgr` is untouched.
					className="h-[52px] w-[52px] shrink-0 rounded-[var(--imgr)] object-cover xl:col-start-1 xl:row-span-2 xl:row-start-2 xl:h-[56px] xl:w-[56px] xl:self-start"
					fallback={
						<div
							aria-hidden="true"
							// Tracks the image's geometry exactly — it stands in the same
							// grid area. No `object-*`: this is a div with a word in it.
							className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono text-[8.5px] tracking-[0.16em] text-n4 xl:col-start-1 xl:row-span-2 xl:row-start-2 xl:h-[56px] xl:w-[56px] xl:self-start"
						>
							IMG
						</div>
					}
				/>
				{/* ⛔ `xl:contents` DISSOLVES THIS COLUMN TOO — the `<h3>` has to be a
				    direct grid child to span both tracks, and the stat block has to be
				    a direct grid child to sit in row 2 beside the picture. Below xl it
				    is the flex column it has always been. */}
				<div className="flex min-w-0 flex-col gap-1 xl:contents">
					{/* ⛔⛔ THE QUESTION GETS ITS OWN FULL-WIDTH ROW, AND THAT IS WHAT
					    PAYS FOR THE SIZE. Against the 341px column the widest of the six
					    questions needed 13px to hold one line and the full title never
					    held one at all; against the 425px inner width it holds one line
					    at 15. Same words, same face, 2px of type bought by geometry.
					    ⛔ THE LADDER IS MEASURED, TIER BY TIER, AND `Chess` BINDS AT ALL
					    THREE. Question-only widths for the widest of the six, against
					    the tile's own inner width at that viewport:
					      1440  inner 425.33   15px -> 402.24  (+23.09)   16px overflows
					      1366  inner 400.66   14px -> 375.43  (+25.23)   15px by -1.58
					      1280  inner 372.00   13px -> 348.61  (+23.39)   14px by -3.43
					    So 13 at the tier floor, 14 from 1366, 15 from 1440.
					    ⚠ THE THREE STEPS ARE ARBITRARY VARIANTS, NOT MINTED BREAKPOINTS.
					    They add no `--breakpoint-*` token and generate no utility family —
					    they are one-off measured media queries in exactly the sense
					    `text-[15px]` is a one-off measured size, so ADR-0045's "one minted
					    breakpoint" is untouched.
					    ⛔⛔ ALL THREE ARE `min-[…]`, INCLUDING THE FLOOR, AND WRITING THE
					    FLOOR AS `xl:` SHIPPED THE WRONG SIZE. Tailwind emits EVERY
					    arbitrary `min-[…]` variant in one block and the NAMED breakpoints
					    in a later one — measured in the built sheet at
					    `min-[1366px]` byte 87128, `min-[1440px]` byte 87201, the named
					    block byte 90238. The two arbitrary steps sort correctly against
					    each other; the floor, written as a named step, then landed 3,000
					    bytes after both and won the cascade at every width — so the
					    deployed tile rendered 13px at 1440 with all three rules present and
					    each one correct in isolation. ⇒ A LADDER MUST BE WRITTEN IN ONE
					    IDIOM — mixing a named breakpoint with arbitrary ones sorts by
					    bucket, not by width. Caught only by reading the computed
					    `font-size` off a real tile; every class was in the DOM.
					    ⛔ THE SUPERSEDED FLOOR IS DESCRIBED AND NEVER QUOTED, and that is
					    load-bearing rather than fastidious: Tailwind's scanner reads THIS
					    COMMENT, so spelling the old class out emits it — and because it
					    sorts into the later block it would win the cascade again and undo
					    the fix from inside the paragraph explaining it. Measured: the
					    scanner returned it as a live candidate while no element carried it
					    (AGENTS.md §8, `docs/` and `tests/` emit utilities too).
					    ⚠ THE FLOOR IS `1280px` WHERE THE COMPOSITION AROUND IT IS `xl`
					    (`80rem`). They are the same width at this app's 16px root and
					    diverge only if a reader enlarges their browser's default type —
					    the same px-vs-rem trade `--breakpoint-mobile: 640px` already makes
					    against `sm: 40rem` (AGENTS.md §8), taken here for the same reason:
					    this ladder is measured against DEVICE widths, which do not grow
					    with the root font. The cost in that band is half a pixel of type on
					    the sub-xl composition, not a broken layout.
					    ⚠ Every step is probed by computed value at every width, because
					    which rule won is a sorting fact and a class string cannot tell you.
					    ⛔ `xl:min-h-[28px]` IS WHAT KEEPS THE TILE AT 112 ACROSS THE
					    WHOLE TIER. The three sizes give three different line boxes
					    (19.5 / 18.2 / 16.9 at 1.3), so without a floor the tile would
					    shrink by 1.3px per step down and the hero would drift by twice
					    that. A 28px band absorbs all three; the remainder under the line
					    is the gap to the picture, and it is the band, never the type,
					    that sets this row's height.
					    ⚠ IT IS `min-h`, NOT `h`, AND THE DIFFERENCE IS THE FAILURE MODE.
					    A seventh market with a longer question must GROW ITS TILE rather
					    than lose the end of its own sentence — which is why
					    `xl:line-clamp-none` stays and why `xl:text-balance` stays with
					    it: two lines can still occur here, and when they do they should
					    be evened out. On one line balance is inert, which is the state
					    all six are in today.
					    ⚠ A PREVIOUS VERSION OF THIS BLOCK CALLED 14px A FLOOR, on the
					    ground that "a 13px title is level with its own metadata". The
					    metadata is 11px (`StatLine`'s `card` preset), and more to the
					    point the argument was about a title sharing a narrow column with
					    the stat row. Option B lifts the question onto its own full-width
					    row above everything, so the two are told apart by position rather
					    than by two points of type. The floor is retired deliberately, not
					    forgotten.
					    ⚠ `leading-[1.3]` IS DECLARED ONCE AND IS UNITLESS, WHICH IS WHY
					    THREE SIZES NEED ONE LEADING. An arbitrary `text-[Npx]` does NOT
					    reset the line-height it inherits (AGENTS.md §8) — a unitless 1.3
					    on the same element scales with whichever size wins, where a px
					    leading would have had to be restated at every tier and would
					    have gone stale at one of them. */}
					<h3 className="line-clamp-2 text-[13.5px] leading-[1.32] font-semibold xl:col-span-2 xl:row-start-1 xl:line-clamp-none xl:min-h-[28px] xl:leading-[1.3] xl:text-balance min-[1280px]:text-[13px] min-[1366px]:text-[14px] min-[1440px]:text-[15px]">
						{/* ⛔⛔ THE TOPIC IS NOT LOST — IT IS MOVED OFF THE LINE, NOT OFF
						    THE PAGE. The `sr-only` span carries the WHOLE title, so the
						    heading's accessible name is unchanged and the category is
						    still real DOM text for anything that reads the document
						    rather than the pixels. The visible span is `aria-hidden` so
						    the two are never announced twice.
						    ⚠ An `aria-label` on the anchor was the other option and is
						    rejected: it is not DOM text, so it answers the screen reader
						    and not the crawler, and it would also have replaced the
						    stats and the price in the link's name.
						    ⛔ THE UNSPLIT BRANCH RENDERS A BARE STRING, not an sr-only
						    pair, and that is load-bearing rather than tidy: when a title
						    has no topic the two spans would hold the SAME text, and
						    `getByText` resolves to two elements and throws. Every
						    `sp-m*` staging fixture and the render suite's own fixture are
						    in that state. */}
						{category === null ? (
							card.title
						) : (
							<>
								<span className="sr-only">{card.title}</span>
								<span aria-hidden="true">{question}</span>
							</>
						)}
					</h3>
					{/* ⛔ THE STAT BLOCK NEEDS A BOX OF ITS OWN TO NAME A GRID CELL, and
					    `StatLine` takes no `className` — it is shared with the hero,
					    which wants none of this. `contents` below xl means the wrapper
					    has NO box there, so the `<p>` stays a direct flex item of the
					    column exactly as before and the sub-xl render is untouched; at xl
					    it becomes the row-2 cell. `xl:min-w-0` is the `min-w-0` this
					    wrapper's dissolved parent used to supply — without it the `1fr`
					    track's automatic minimum is the stat row's content and a long
					    total could widen the column. `xl:self-start` keeps the stats on
					    the title band rather than centred in a track the picture has
					    stretched. */}
					<div className="contents xl:col-start-2 xl:row-start-2 xl:block xl:min-w-0 xl:self-start">
						<StatLine totals={card.totals} size="card" />
					</div>
				</div>
			</div>
			{/* ⚠ `xl:self-end` IS WHAT KEEPS THE BAR ON THE FLOOR. The picture spans
			    rows 2-3 and is taller than the stats and the bar together, so the
			    grid distributes the difference into those two tracks — and a grid
			    item's default `stretch` would have let the bar float up inside a
			    track taller than itself. `mt-[9px]` is unchanged and still owns the
			    gap above it. */}
			<div className="mt-[9px] xl:col-start-2 xl:row-start-3 xl:self-end">
				<PriceBar pricing={card.pricing} size="card" />
			</div>
		</Link>
	);
}
